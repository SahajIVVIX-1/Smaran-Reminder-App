import { useState } from 'react';
import type { Style, StyleFields } from '@shared/schema';
import { addStyle } from '../actions';
import { ListPane } from '../components/ListPane';
import { Preview } from '../components/Preview';
import { StyleForm } from '../components/StyleForm';
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Modal,
  Section,
  Select,
  TextInput,
} from '../components/ui';
import { useSettings } from '../store';

const PREVIEW_TEXT = 'This is how your reminder will look.';

function fieldsOf(style: Style): StyleFields {
  const { id: _id, name: _name, isDefault: _isDefault, ...fields } = style;
  return fields;
}

export function StylesPage() {
  const draft = useSettings((s) => s.draft);
  const selectedId = useSettings((s) => s.selected.styles);
  const { edit, select } = useSettings.getState();
  const [deleting, setDeleting] = useState<Style | null>(null);

  if (!draft) return null;
  const style = draft.styles.find((s) => s.id === selectedId) ?? null;
  const usage = (id: string) => draft.messages.filter((m) => m.styleId === id).length;

  const update = (id: string, change: (s: Style) => Style) =>
    edit((c) => ({ ...c, styles: c.styles.map((s) => (s.id === id ? change(s) : s)) }));

  return (
    <div className="flex h-full">
      <ListPane
        label="Styles"
        items={draft.styles.map((s) => ({
          id: s.id,
          title: s.name,
          subtitle: `${usage(s.id)} message${usage(s.id) === 1 ? '' : 's'}`,
          trailing: s.isDefault ? <Chip>Default</Chip> : undefined,
        }))}
        selectedId={selectedId}
        onSelect={(id) => select('styles', id)}
        emptyText="No styles."
        header={
          <div className="flex justify-end">
            <Button tone="primary" onClick={() => addStyle(style ?? undefined)}>
              New from current
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {style ? (
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="flex-1 text-lg font-semibold">Style</h2>
              <Button
                onClick={() =>
                  void window.smaran.popup.test({ text: PREVIEW_TEXT, style: fieldsOf(style) })
                }
              >
                Test
              </Button>
              <Button
                disabled={style.isDefault}
                onClick={() =>
                  edit((c) => ({
                    ...c,
                    styles: c.styles.map((s) => ({ ...s, isDefault: s.id === style.id })),
                  }))
                }
              >
                Make default
              </Button>
              <Button onClick={() => addStyle(style)}>Duplicate</Button>
              <Button
                tone="danger"
                disabled={draft.styles.length === 1}
                onClick={() => setDeleting(style)}
              >
                Delete
              </Button>
            </div>

            <Section title="Name">
              <Field label="Name" htmlFor="style-name">
                <TextInput
                  id="style-name"
                  value={style.name}
                  onChange={(e) => {
                    const name = e.currentTarget.value;
                    update(style.id, (s) => ({ ...s, name }));
                  }}
                />
              </Field>
            </Section>

            <div className="sticky top-0 z-10 mb-5 bg-bg pb-1">
              <Preview text={PREVIEW_TEXT} style={fieldsOf(style)} />
            </div>

            <StyleForm
              value={fieldsOf(style)}
              onChange={(fields) => update(style.id, (s) => ({ ...s, ...fields }))}
            />
          </div>
        ) : (
          <EmptyState>Select a style.</EmptyState>
        )}
      </div>

      {deleting && (
        <DeleteStyleDialog
          style={deleting}
          used={usage(deleting.id)}
          others={draft.styles.filter((s) => s.id !== deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

/** Deleting a style that messages use asks which style they should use instead. */
function DeleteStyleDialog({
  style,
  used,
  others,
  onClose,
}: {
  style: Style;
  used: number;
  others: Style[];
  onClose: () => void;
}) {
  const { edit, select, showToast } = useSettings.getState();
  const [target, setTarget] = useState(others.find((s) => s.isDefault)?.id ?? others[0]?.id ?? '');

  const confirm = () => {
    edit((c) => {
      const styles = c.styles.filter((s) => s.id !== style.id);
      if (style.isDefault && styles.length > 0) {
        const nextDefault = styles.find((s) => s.id === target) ?? styles[0];
        for (const s of styles) s.isDefault = s === nextDefault;
      }
      return {
        ...c,
        styles,
        messages: c.messages.map((m) => (m.styleId === style.id ? { ...m, styleId: target } : m)),
      };
    });
    select('styles', target || null);
    showToast(`Deleted style “${style.name}”`);
    onClose();
  };

  return (
    <Modal
      title={`Delete “${style.name}”?`}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="primary" onClick={confirm} disabled={!target}>
            Delete style
          </Button>
        </>
      }
    >
      {used > 0 ? (
        <>
          <p className="mb-3">
            {used} message{used === 1 ? ' uses' : 's use'} this style. Choose the style{' '}
            {used === 1 ? 'it' : 'they'} should use instead:
          </p>
          <Select
            aria-label="Replacement style"
            value={target}
            onChange={(e) => setTarget(e.currentTarget.value)}
          >
            {others.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </>
      ) : (
        <p>
          No messages use this style.
          {style.isDefault ? ' Another style will become the default.' : ''}
        </p>
      )}
    </Modal>
  );
}
