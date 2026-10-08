import { clearOverride, getField, overriddenPaths, pathKey, setOverride } from '@shared/overrides';
import type { StyleFields, StyleOverrides } from '@shared/schema';
import { FIELD_DEFS, FIELD_PATHS } from '../styleFieldDefs';
import { FieldControl } from './FieldControl';
import { Button, Field, Select } from './ui';

/**
 * Lists only the fields this message changes from its style, each with its own reset.
 * "Change a field…" adds an override starting from the style's current value.
 */
export function OverridesPanel({
  overrides,
  base,
  effective,
  onChange,
}: {
  overrides: StyleOverrides;
  /** The style's own values. */
  base: StyleFields;
  /** Style + overrides. */
  effective: StyleFields;
  onChange: (o: StyleOverrides) => void;
}) {
  const changed = overriddenPaths(overrides, FIELD_PATHS);
  const changedKeys = new Set(changed.map(pathKey));
  const available = FIELD_DEFS.filter((d) => !changedKeys.has(pathKey(d.path)));

  return (
    <div>
      {changed.length === 0 && (
        <p className="py-2 text-sm text-muted">This message looks exactly like its style.</p>
      )}
      {changed.map((path) => {
        const def = FIELD_DEFS.find((d) => pathKey(d.path) === pathKey(path));
        if (!def) return null;
        const id = `override-${path.join('-')}`;
        return (
          <Field
            key={id}
            label={def.label}
            htmlFor={id}
            action={
              <Button
                small
                tone="ghost"
                title="Use the style’s value"
                onClick={() => onChange(clearOverride(overrides, path))}
              >
                Reset
              </Button>
            }
          >
            <FieldControl
              id={id}
              def={def}
              value={getField(effective, path)}
              onChange={(v) => onChange(setOverride(overrides, path, v))}
            />
          </Field>
        );
      })}
      {available.length > 0 && (
        <div className="py-2">
          <Select
            aria-label="Change a field for this message only"
            className="w-60"
            value=""
            onChange={(e) => {
              const def = available.find((d) => pathKey(d.path) === e.currentTarget.value);
              if (def) onChange(setOverride(overrides, def.path, getField(base, def.path)));
            }}
          >
            <option value="">Change a field for this message…</option>
            {available.map((d) => (
              <option key={pathKey(d.path)} value={pathKey(d.path)}>
                {d.section}: {d.label}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
