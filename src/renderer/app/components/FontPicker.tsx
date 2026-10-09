import { useEffect, useMemo, useRef, useState } from 'react';
import { ANTHROPIC, BUNDLED, fontLabel, fontStack, type FontCatalog } from '@shared/fonts';
import { cx } from '../cx';
import { SearchIcon } from '../icons';
import { useApp } from '../store';
import { Popover } from './Popover';

interface Group {
  title: string;
  fonts: { family: string; note?: string }[];
}

/**
 * Picks the app font: Anthropic's typefaces first (with the bundled stand-in shown until the real
 * font is installed or added), then the fonts bundled with Smaran, fonts you added, and every font
 * installed on this PC. Each name is drawn in its own font. "Add Font Files…" copies .ttf/.otf/.woff
 * files into Smaran so they work even if they aren't installed in Windows.
 */
export function FontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (family: string) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const catalog = useApp((s) => s.fonts);
  const { loadFonts, toastMsg, track } = useApp.getState();

  useEffect(() => {
    if (open) window.setTimeout(() => search.current?.focus(), 30);
  }, [open]);

  const groups = useMemo(() => buildGroups(catalog, query), [catalog, query]);

  const choose = (family: string) => {
    onChange(family);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="Font"
        aria-expanded={open}
        onClick={() => {
          setQuery('');
          setOpen((o) => !o);
          if (!catalog) void loadFonts();
        }}
        className={cx(
          'inline-flex h-8 w-64 items-center justify-between gap-2 rounded-lg border border-line bg-surface pr-2 pl-2.5 text-[13.5px] text-ink',
          'transition-[border-color,box-shadow,background-color] duration-150 hover:bg-raised focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent-soft focus-visible:outline-none',
          open && 'border-accent/60 ring-3 ring-accent-soft',
        )}
        style={{ fontFamily: fontStack(value) }}
      >
        <span className="truncate">{fontLabel(value)}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden
          className={cx(
            'shrink-0 text-faint transition-transform duration-200',
            open && 'rotate-180',
          )}
        >
          <path
            d="M3 4.5l3 3 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <Popover anchor={trigger} open={open} onClose={() => setOpen(false)} className="w-80 p-0">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <SearchIcon size={14} className="text-faint" />
          <input
            ref={search}
            aria-label="Search fonts"
            placeholder="Search fonts"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            className="h-9 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1" role="listbox" aria-label="Fonts">
          {!catalog && (
            <p className="px-2.5 py-3 text-[12.5px] text-muted">Looking for fonts on this PC…</p>
          )}
          {groups.map((g) => (
            <div key={g.title} className="mb-1">
              <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">
                {g.title}
              </div>
              {g.fonts.map((f) => (
                <button
                  key={`${g.title}-${f.family}`}
                  type="button"
                  role="option"
                  aria-selected={f.family === value}
                  onClick={() => choose(f.family)}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors duration-100 hover:bg-hover',
                    f.family === value && 'bg-hover',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[14px]"
                      style={{ fontFamily: fontStack(f.family) }}
                    >
                      {fontLabel(f.family)}
                    </span>
                    {f.note && (
                      <span className="block truncate text-[11px] text-faint">{f.note}</span>
                    )}
                  </span>
                  {f.family === value && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      aria-hidden
                      className="shrink-0 text-accent"
                    >
                      <path
                        d="M2.5 6.5l2.5 2.5 4.5-5.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ))}
          {catalog && groups.length === 0 && (
            <p className="px-2.5 py-3 text-[12.5px] text-muted">No fonts match.</p>
          )}
        </div>
        <div className="border-t border-line p-1">
          <button
            type="button"
            onClick={async () => {
              const r = await track(window.smaran.fonts.add());
              if (!r.ok) toastMsg(r.error, 'error');
              else if (r.added.length > 0) {
                await loadFonts();
                toastMsg(`Added ${r.added.join(', ')}`);
                choose(r.added[0] ?? value);
              } else if (r.skipped.length > 0)
                toastMsg('Those files are not fonts Smaran can use.', 'error');
            }}
            className="flex h-8 w-full items-center rounded-lg px-2.5 text-[13px] text-accent transition-colors hover:bg-hover"
          >
            Add Font Files…
          </button>
        </div>
      </Popover>
    </>
  );
}

function buildGroups(catalog: FontCatalog | null, query: string): Group[] {
  const q = query.trim().toLowerCase();
  const has = (family: string) =>
    !!catalog &&
    (catalog.system.includes(family) || catalog.custom.some((c) => c.family === family));
  const match = (family: string) => !q || fontLabel(family).toLowerCase().includes(q);
  const customFamilies = [...new Set(catalog?.custom.map((c) => c.family) ?? [])];
  const groups: Group[] = [
    {
      title: 'Anthropic',
      fonts: ANTHROPIC.map((f) => ({
        family: f.family,
        note: has(f.family)
          ? undefined
          : `Using ${fontLabel(f.standIn)} until it's installed or added`,
      })),
    },
    { title: 'Included with Smaran', fonts: BUNDLED.map((f) => ({ family: f.family })) },
    { title: 'Your Fonts', fonts: customFamilies.map((family) => ({ family })) },
    {
      title: 'On This Computer',
      fonts: (catalog?.system ?? [])
        .filter((f) => !customFamilies.includes(f))
        .map((family) => ({ family })),
    },
  ];
  return groups
    .map((g) => ({ ...g, fonts: g.fonts.filter((f) => match(f.family)) }))
    .filter((g) => g.fonts.length > 0);
}
