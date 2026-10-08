import { useMemo, useState } from 'react';
import { effectiveStyle, resolveStyle } from '@shared/effectiveStyle';
import type { Config, Message } from '@shared/schema';
import { addMessage, deleteSelected, moveById, parseTags } from '../actions';
import { ListPane } from '../components/ListPane';
import { OverridesPanel } from '../components/OverridesPanel';
import { MessagePositionEditor } from '../components/PositionEditor';
import { Preview } from '../components/Preview';
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Section,
  Select,
  TextArea,
  TextInput,
  Toggle,
} from '../components/ui';
import { useSettings } from '../store';

export function MessagesPage() {
  const draft = useSettings((s) => s.draft);
  const selectedId = useSettings((s) => s.selected.messages);
  const { edit, select } = useSettings.getState();
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    if (!draft) return [];
    const q = query.trim().toLowerCase();
    return draft.messages.filter(
      (m) =>
        !q || m.text.toLowerCase().includes(q) || m.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [draft, query]);

  if (!draft) return null;
  const message = draft.messages.find((m) => m.id === selectedId) ?? null;

  const updateMessage = (id: string, change: (m: Message) => Message) =>
    edit((c) => ({
      ...c,
      messages: c.messages.map((m) =>
        m.id === id ? { ...change(m), updatedAt: new Date().toISOString() } : m,
      ),
    }));

  return (
    <div className="flex h-full">
      <ListPane
        label="Messages"
        items={items.map((m) => ({
          id: m.id,
          title: m.text.split('\n')[0] || '(empty)',
          muted: !m.enabled,
          subtitle:
            m.tags.length > 0 ? (
              <span className="flex gap-1">
                {m.tags.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </span>
            ) : undefined,
          trailing: (
            <Toggle
              label={`${m.enabled ? 'Disable' : 'Enable'} “${m.text.slice(0, 20)}”`}
              checked={m.enabled}
              onChange={(enabled) => updateMessage(m.id, (x) => ({ ...x, enabled }))}
            />
          ),
        }))}
        selectedId={selectedId}
        onSelect={(id) => select('messages', id)}
        onMove={
          query
            ? undefined
            : (from, to) => edit((c) => ({ ...c, messages: moveById(c.messages, from, to) }))
        }
        emptyText={query ? 'No messages match.' : 'No messages yet. Press New to add one.'}
        header={
          <div className="flex gap-2">
            <TextInput
              aria-label="Search messages"
              placeholder="Search text or tags"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
            <Button tone="primary" onClick={() => addMessage()}>
              New
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {message ? (
          <MessageEditor
            message={message}
            config={draft}
            onChange={(change) => updateMessage(message.id, change)}
          />
        ) : (
          <EmptyState>Select a message, or press New.</EmptyState>
        )}
      </div>
    </div>
  );
}

function MessageEditor({
  message,
  config,
  onChange,
}: {
  message: Message;
  config: Config;
  onChange: (change: (m: Message) => Message) => void;
}) {
  const { edit, select, showToast } = useSettings.getState();
  const style = resolveStyle(message.styleId, config.styles);
  const effective = effectiveStyle(message, config.styles);
  const [tagsText, setTagsText] = useState(message.tags.join(', '));
  const [tagsFor, setTagsFor] = useState(message.id);
  if (tagsFor !== message.id) {
    setTagsFor(message.id);
    setTagsText(message.tags.join(', '));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="flex-1 text-lg font-semibold">Message</h2>
        <Button
          onClick={() =>
            void window.smaran.popup.test({ text: message.text || ' ', style: effective })
          }
        >
          Test
        </Button>
        <Button
          onClick={() => {
            const copy = {
              ...structuredClone(message),
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
            };
            edit((c) => {
              const list = [...c.messages];
              list.splice(list.findIndex((m) => m.id === message.id) + 1, 0, copy);
              return { ...c, messages: list };
            });
            select('messages', copy.id);
            showToast('Duplicated');
          }}
        >
          Duplicate
        </Button>
        <Button tone="danger" onClick={() => deleteSelected('messages')}>
          Delete
        </Button>
      </div>

      <Section title="Text">
        <div className="py-2">
          <TextArea
            aria-label="Message text"
            value={message.text}
            onChange={(e) => {
              const text = e.currentTarget.value;
              onChange((m) => ({ ...m, text }));
            }}
          />
        </div>
        <Field
          label="Tags"
          htmlFor="message-tags"
          hint="Separate tags with commas. Schedules can pick messages by tag."
        >
          <TextInput
            id="message-tags"
            value={tagsText}
            onChange={(e) => {
              const text = e.currentTarget.value;
              setTagsText(text);
              onChange((m) => ({ ...m, tags: parseTags(text) }));
            }}
          />
        </Field>
        <Field label="Enabled" htmlFor="message-enabled">
          <Toggle
            id="message-enabled"
            label="Enabled"
            checked={message.enabled}
            onChange={(enabled) => onChange((m) => ({ ...m, enabled }))}
          />
        </Field>
      </Section>

      <Section title="Preview">
        <div className="py-2">
          <Preview text={message.text} style={effective} />
        </div>
      </Section>

      <Section title="Look">
        <Field label="Style" htmlFor="message-style">
          <Select
            id="message-style"
            value={style.id}
            onChange={(e) => {
              const styleId = e.currentTarget.value;
              onChange((m) => ({ ...m, styleId }));
            }}
          >
            {config.styles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title="Changed for this message only">
        <OverridesPanel
          overrides={message.overrides}
          base={style}
          effective={effective}
          onChange={(overrides) =>
            onChange((m) => ({ ...m, overrides: { ...overrides, position: m.overrides.position } }))
          }
        />
      </Section>

      <Section title="Position">
        <MessagePositionEditor
          value={message.overrides.position}
          styleDefault={style.position}
          onChange={(position) =>
            onChange((m) => {
              const overrides = { ...m.overrides };
              if (position) overrides.position = position;
              else delete overrides.position;
              return { ...m, overrides };
            })
          }
        />
      </Section>
    </div>
  );
}
