import type { Placement } from '@shared/schema';
import { DEFAULT_ANCHOR, type Anchor } from '../anchor';
import { Button, Field, NumberInput, Select } from './ui';

const ANCHORS: { value: Anchor['anchor']; label: string }[] = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top centre' },
  { value: 'top-right', label: 'Top right' },
  { value: 'center', label: 'Centre' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom centre' },
  { value: 'bottom-right', label: 'Bottom right' },
];

/** Anchor + offsets + which screen. */
export function AnchorEditor({
  value,
  onChange,
  idPrefix,
}: {
  value: Anchor;
  onChange: (v: Anchor) => void;
  idPrefix: string;
}) {
  return (
    <>
      <Field label="Corner or edge" htmlFor={`${idPrefix}-anchor`}>
        <Select
          id={`${idPrefix}-anchor`}
          value={value.anchor}
          onChange={(e) =>
            onChange({ ...value, anchor: e.currentTarget.value as Anchor['anchor'] })
          }
        >
          {ANCHORS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Distance from edge" hint="Horizontal, then vertical">
        <div className="flex gap-3">
          <NumberInput
            aria-label="Horizontal offset"
            value={value.offsetX}
            min={-4000}
            max={4000}
            unit="px"
            onChange={(n) => onChange({ ...value, offsetX: Math.round(n) })}
          />
          <NumberInput
            aria-label="Vertical offset"
            value={value.offsetY}
            min={-4000}
            max={4000}
            unit="px"
            onChange={(n) => onChange({ ...value, offsetY: Math.round(n) })}
          />
        </div>
      </Field>
      <Field label="Screen" htmlFor={`${idPrefix}-display`}>
        <Select
          id={`${idPrefix}-display`}
          value={value.display}
          onChange={(e) =>
            onChange({ ...value, display: e.currentTarget.value as Anchor['display'] })
          }
        >
          <option value="primary">Main screen</option>
          <option value="cursor">Screen with the mouse pointer</option>
        </Select>
      </Field>
    </>
  );
}

/** Message position: style default, its own anchor, or the exact spot it was dragged to. */
export function MessagePositionEditor({
  value,
  styleDefault,
  onChange,
}: {
  value: Placement | undefined;
  styleDefault: Placement;
  onChange: (v: Placement | undefined) => void;
}) {
  const mode = value === undefined ? 'style' : value.kind;
  return (
    <>
      <Field label="Position" htmlFor="message-position-mode">
        <Select
          id="message-position-mode"
          value={mode}
          onChange={(e) => {
            const next = e.currentTarget.value;
            if (next === 'style') onChange(undefined);
            else if (next === 'anchor')
              onChange(styleDefault.kind === 'anchor' ? { ...styleDefault } : DEFAULT_ANCHOR);
          }}
        >
          <option value="style">Use the style’s position</option>
          <option value="anchor">Place it myself</option>
          {value?.kind === 'exact' && <option value="exact">Where I dragged it</option>}
        </Select>
      </Field>
      {value?.kind === 'anchor' && (
        <AnchorEditor idPrefix="message" value={value} onChange={onChange} />
      )}
      {value?.kind === 'exact' && (
        <Field
          label="Dragged spot"
          hint="Drag a popup of this message to move it again."
          action={
            <Button small tone="ghost" onClick={() => onChange(undefined)}>
              Reset
            </Button>
          }
        >
          <span className="text-sm">
            {value.x}, {value.y} px on screen {value.displayId}
          </span>
        </Field>
      )}
    </>
  );
}
