import type { FieldPath } from '@shared/overrides';

export type FieldControl =
  | { kind: 'number'; min: number; max: number; step?: number; unit?: string; scale?: number }
  | { kind: 'color' }
  | { kind: 'font' }
  | { kind: 'bool' }
  | { kind: 'select'; options: readonly { value: string | number; label: string }[] };

export interface FieldDef {
  path: FieldPath;
  label: string;
  section: 'Text' | 'Colours' | 'Shape' | 'Size' | 'Timing';
  control: FieldControl;
}

/** Every style field the forms can edit; drives the style form and the overrides panel alike. */
export const FIELD_DEFS: readonly FieldDef[] = [
  { path: ['font', 'family'], label: 'Font', section: 'Text', control: { kind: 'font' } },
  {
    path: ['font', 'sizePx'],
    label: 'Font size',
    section: 'Text',
    control: { kind: 'number', min: 6, max: 200, unit: 'px' },
  },
  {
    path: ['font', 'weight'],
    label: 'Weight',
    section: 'Text',
    control: {
      kind: 'select',
      options: [
        { value: 400, label: 'Regular' },
        { value: 600, label: 'Semibold' },
        { value: 700, label: 'Bold' },
      ],
    },
  },
  { path: ['font', 'italic'], label: 'Italic', section: 'Text', control: { kind: 'bool' } },
  {
    path: ['colors', 'text'],
    label: 'Text colour',
    section: 'Colours',
    control: { kind: 'color' },
  },
  {
    path: ['colors', 'background'],
    label: 'Background',
    section: 'Colours',
    control: { kind: 'color' },
  },
  {
    path: ['colors', 'border'],
    label: 'Border colour',
    section: 'Colours',
    control: { kind: 'color' },
  },
  {
    path: ['opacity'],
    label: 'Opacity',
    section: 'Colours',
    control: { kind: 'number', min: 10, max: 100, unit: '%', scale: 100 },
  },
  {
    path: ['border', 'widthPx'],
    label: 'Border width',
    section: 'Shape',
    control: { kind: 'number', min: 0, max: 50, unit: 'px' },
  },
  {
    path: ['border', 'radiusPx'],
    label: 'Corner radius',
    section: 'Shape',
    control: { kind: 'number', min: 0, max: 200, unit: 'px' },
  },
  {
    path: ['paddingPx'],
    label: 'Padding',
    section: 'Shape',
    control: { kind: 'number', min: 0, max: 200, unit: 'px' },
  },
  {
    path: ['size', 'mode'],
    label: 'Size',
    section: 'Size',
    control: {
      kind: 'select',
      options: [
        { value: 'auto', label: 'Fit the text' },
        { value: 'fixed', label: 'Fixed' },
      ],
    },
  },
  {
    path: ['size', 'maxWidthPx'],
    label: 'Max width (fit)',
    section: 'Size',
    control: { kind: 'number', min: 50, max: 4000, unit: 'px' },
  },
  {
    path: ['size', 'widthPx'],
    label: 'Width (fixed)',
    section: 'Size',
    control: { kind: 'number', min: 50, max: 4000, unit: 'px' },
  },
  {
    path: ['size', 'heightPx'],
    label: 'Height (fixed)',
    section: 'Size',
    control: { kind: 'number', min: 20, max: 4000, unit: 'px' },
  },
  {
    path: ['timing', 'fadeInMs'],
    label: 'Fade in',
    section: 'Timing',
    control: { kind: 'number', min: 0, max: 10, step: 0.1, unit: 's', scale: 0.001 },
  },
  {
    path: ['timing', 'stayMs'],
    label: 'Stay',
    section: 'Timing',
    control: { kind: 'number', min: 0, max: 600, step: 0.5, unit: 's', scale: 0.001 },
  },
  {
    path: ['timing', 'fadeOutMs'],
    label: 'Fade out',
    section: 'Timing',
    control: { kind: 'number', min: 0, max: 10, step: 0.1, unit: 's', scale: 0.001 },
  },
];

export const FIELD_PATHS = FIELD_DEFS.map((d) => d.path);
export const SECTIONS = ['Text', 'Colours', 'Shape', 'Size', 'Timing'] as const;
