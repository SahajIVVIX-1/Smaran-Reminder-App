import { useEffect, useState } from 'react';
import type { FieldValue } from '@shared/overrides';
import type { FieldDef } from '../styleFieldDefs';
import { ColorInput } from './ColorInput';
import { NumberInput, Select, Toggle } from './ui';

let fontsPromise: Promise<string[]> | null = null;
function useFonts(): string[] {
  const [fonts, setFonts] = useState<string[]>([]);
  useEffect(() => {
    fontsPromise ??= window.smaran.fonts.list();
    void fontsPromise.then(setFonts);
  }, []);
  return fonts;
}

function FontSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  const fonts = useFonts();
  const options = fonts.includes(value) ? fonts : [value, ...fonts];
  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      style={{ fontFamily: value }}
    >
      {options.map((f) => (
        <option key={f} value={f} style={{ fontFamily: f }}>
          {f}
        </option>
      ))}
    </Select>
  );
}

/** The editor for one style field, driven by its FieldDef. */
export function FieldControl({
  def,
  value,
  onChange,
  id,
}: {
  def: FieldDef;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  id: string;
}) {
  const c = def.control;
  switch (c.kind) {
    case 'number': {
      const scale = c.scale ?? 1;
      return (
        <NumberInput
          id={id}
          aria-label={def.label}
          value={Number(value) * scale}
          min={c.min}
          max={c.max}
          step={c.step}
          unit={c.unit}
          onChange={(n) => {
            const stored = n / scale;
            onChange(
              def.path[0] === 'opacity' ? Math.round(stored * 100) / 100 : Math.round(stored),
            );
          }}
        />
      );
    }
    case 'color':
      return <ColorInput label={def.label} value={String(value)} onChange={onChange} />;
    case 'font':
      return <FontSelect id={id} value={String(value)} onChange={onChange} />;
    case 'bool':
      return <Toggle id={id} label={def.label} checked={Boolean(value)} onChange={onChange} />;
    case 'select':
      return (
        <Select
          id={id}
          value={String(value)}
          onChange={(e) => {
            const raw = e.currentTarget.value;
            const option = c.options.find((o) => String(o.value) === raw);
            if (option) onChange(option.value);
          }}
        >
          {c.options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </Select>
      );
  }
}
