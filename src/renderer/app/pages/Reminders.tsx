import { useMemo, useState } from 'react';
import { createReminder } from '@shared/defaults';
import { ruleSummary } from '@shared/ruleSummary';
import { COLOR_BG } from '../../colors';
import { cx } from '../cx';
import { whenLabel } from '../format';
import { PlusIcon, SearchIcon } from '../icons';
import { defaultRule } from '../rules';
import { useApp } from '../store';
import { Button, Pill, Segmented, Switch } from '../ui';

type Filter = 'all' | 'on' | 'off';

export function Reminders() {
  const config = useApp((s) => s.config);
  const nextTimes = useApp((s) => s.nextTimes);
  const { edit, upsertReminder } = useApp.getState();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const list = useMemo(() => {
    if (!config) return [];
    const q = query.trim().toLowerCase();
    return config.reminders.filter(
      (r) =>
        (filter === 'all' || (filter === 'on') === r.enabled) &&
        (!q ||
          r.title.toLowerCase().includes(q) ||
          r.note.toLowerCase().includes(q) ||
          r.lines.some((l) => l.toLowerCase().includes(q))),
    );
  }, [config, query, filter]);

  if (!config) return null;

  return (
    <div className="mx-auto max-w-[820px] px-8 pt-10 pb-16">
      <header className="flex animate-enter items-end gap-4">
        <div className="flex-1">
          <h1 className="font-serif text-[30px] leading-tight">Reminders</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {config.reminders.length === 0
              ? 'Nothing yet.'
              : `${config.reminders.filter((r) => r.enabled).length} on, ${config.reminders.filter((r) => !r.enabled).length} off`}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() =>
            edit({ mode: 'new', draft: createReminder({ title: '', rule: defaultRule('daily') }) })
          }
        >
          <PlusIcon size={16} /> New reminder
        </Button>
      </header>

      <div className="mt-6 flex animate-enter items-center gap-3 [animation-delay:40ms]">
        <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 transition-[border-color,box-shadow] duration-150 focus-within:border-accent/60 focus-within:ring-3 focus-within:ring-accent-soft">
          <SearchIcon size={15} className="text-faint" />
          <input
            aria-label="Search reminders"
            placeholder="Search"
            className="h-full flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </label>
        <Segmented<Filter>
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <p className="mt-16 animate-fade text-center text-[13.5px] text-muted">
          {query || filter !== 'all'
            ? 'No reminders match.'
            : 'Create your first reminder to get started.'}
        </p>
      ) : (
        <ul className="mt-5 space-y-2" aria-label="Reminders">
          {list.map((r, i) => {
            const next = nextTimes.find((n) => n.reminderId === r.id)?.at;
            const completed = r.rule.kind === 'once' && config.state[r.id]?.completed;
            return (
              <li
                key={r.id}
                className="animate-enter"
                style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => edit({ mode: 'edit', id: r.id })}
                  onKeyDown={(e) => e.key === 'Enter' && edit({ mode: 'edit', id: r.id })}
                  className={cx(
                    'group flex cursor-pointer items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3.5',
                    'transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-px hover:border-ink/15 hover:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.15)]',
                    'focus-visible:outline-2 focus-visible:outline-accent',
                  )}
                >
                  <span
                    className={cx(
                      'h-2.5 w-2.5 shrink-0 rounded-full',
                      COLOR_BG[r.color],
                      !r.enabled && 'opacity-40',
                    )}
                  />
                  <div className={cx('min-w-0 flex-1', !r.enabled && 'opacity-55')}>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14.5px] font-medium">{r.title}</span>
                      {r.priority === 'important' && <Pill tone="accent">Important</Pill>}
                      {r.lines.length > 0 && <Pill>{r.lines.length} lines</Pill>}
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-muted">
                      {ruleSummary(r.rule)}
                      {r.enabled && !completed && next && ` · next ${whenLabel(new Date(next))}`}
                      {completed && ' · completed'}
                    </div>
                  </div>
                  <Switch
                    label={`${r.enabled ? 'Turn off' : 'Turn on'} ${r.title}`}
                    checked={r.enabled}
                    onChange={(enabled) =>
                      upsertReminder({ ...r, enabled, updatedAt: new Date().toISOString() })
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
