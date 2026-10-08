import { getField, setField } from '@shared/overrides';
import type { StyleFields } from '@shared/schema';
import { FIELD_DEFS, SECTIONS } from '../styleFieldDefs';
import { FieldControl } from './FieldControl';
import { DEFAULT_ANCHOR } from '../anchor';
import { AnchorEditor } from './PositionEditor';
import { Field, Section } from './ui';

/** Every field of a style, grouped in sections. */
export function StyleForm({
  value,
  onChange,
}: {
  value: StyleFields;
  onChange: (v: StyleFields) => void;
}) {
  const position = value.position.kind === 'anchor' ? value.position : DEFAULT_ANCHOR;
  return (
    <>
      {SECTIONS.map((section) => (
        <Section key={section} title={section}>
          {FIELD_DEFS.filter((d) => d.section === section).map((def) => {
            const id = `style-${def.path.join('-')}`;
            return (
              <Field key={id} label={def.label} htmlFor={id}>
                <FieldControl
                  id={id}
                  def={def}
                  value={getField(value, def.path)}
                  onChange={(v) => onChange(setField(value, def.path, v))}
                />
              </Field>
            );
          })}
        </Section>
      ))}
      <Section title="Default position">
        <AnchorEditor
          idPrefix="style"
          value={position}
          onChange={(p) => onChange({ ...value, position: p })}
        />
      </Section>
    </>
  );
}
