import { useMemo, useState } from 'react';
import type { HistoryEntry } from '@shared/schema';
import { AUTOMATION_OUTCOMES, OUTCOME_LABEL, OUTCOME_TONE } from '../outcomes';
import { RichText } from '../../RichText';
import { dayLabel, timeOf } from '../format';
import { useApp } from '../store';
import { Button, Dialog, Pill } from '../ui';
import { BellIcon, GearIcon, SearchIcon, ServerIcon, ShieldIcon, SparkIcon } from '../icons';
import { cx } from '../cx';

export type HistoryFilter = 'all' | 'reminders' | 'automations' | 'fileserver' | 'security' | 'system';

interface FilterOption {
  value: HistoryFilter;
  label: string;
}

const FILTERS: readonly FilterOption[] = [
  { value: 'all', label: 'All Events' },
  { value: 'reminders', label: 'Reminders' },
  { value: 'automations', label: 'Automations' },
  { value: 'fileserver', label: 'File Server' },
  { value: 'security', label: 'Security' },
  { value: 'system', label: 'System' },
];

function getCategory(h: HistoryEntry, autoIds: Set<string>): HistoryFilter {
  if (h.category) {
    if (h.category === 'security') return 'security';
    if (h.category === 'fileserver') return 'fileserver';
    if (h.category === 'automations') return 'automations';
    if (h.category === 'reminders') return 'reminders';
    if (h.category === 'system') return 'system';
  }
  if (h.reminderId === 'fileserver' || h.outcome.includes('login') || h.outcome.includes('server')) {
    if (h.outcome.includes('fail') || h.severity === 'critical') return 'security';
    return 'fileserver';
  }
  if (AUTOMATION_OUTCOMES.includes(h.outcome) || autoIds.has(h.reminderId)) {
    return 'automations';
  }
  return 'reminders';
}

function CategoryIcon({ category, size = 14 }: { category: HistoryFilter; size?: number }) {
  switch (category) {
    case 'security':
      return <ShieldIcon size={size} className="text-danger" />;
    case 'fileserver':
      return <ServerIcon size={size} className="text-accent" />;
    case 'automations':
      return <SparkIcon size={size} className="text-iris" />;
    case 'system':
      return <GearIcon size={size} className="text-muted" />;
    case 'reminders':
    default:
      return <BellIcon size={size} className="text-clay" />;
  }
}

export function History() {
  const history = useApp((s) => s.history);
  const automationIds = useApp((s) => s.config?.automations.map((a) => a.id).join(',') ?? '');
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const autoIdSet = useMemo(() => new Set(automationIds.split(',')), [automationIds]);

  const filteredEntries = useMemo(() => {
    let list = history;

    // Filter by Category
    if (filter !== 'all') {
      list = list.filter((h) => getCategory(h, autoIdSet) === filter);
    }

    // Filter by Search Query
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter((h) => {
        const titleMatch = h.title.toLowerCase().includes(q);
        const detailMatch = h.detail?.toLowerCase().includes(q) ?? false;
        const outcomeMatch = h.outcome.toLowerCase().includes(q);
        const metaMatch = h.metadata ? JSON.stringify(h.metadata).toLowerCase().includes(q) : false;
        return titleMatch || detailMatch || outcomeMatch || metaMatch;
      });
    }

    return list;
  }, [history, filter, query, autoIdSet]);

  const groups = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const entry of filteredEntries) {
      const label = dayLabel(new Date(entry.at));
      map.set(label, [...(map.get(label) ?? []), entry]);
    }
    return [...map.entries()];
  }, [filteredEntries]);

  const counts = useMemo(() => {
    const week = openedAt - 7 * 86_400_000;
    const recent = history.filter((h) => new Date(h.at).getTime() >= week);
    return {
      done: recent.filter((h) => h.outcome === 'done' || h.outcome === 'ran').length,
      missed: recent.filter((h) => h.outcome === 'missed' || h.outcome.includes('fail')).length,
      total: recent.length,
    };
  }, [history, openedAt]);

  return (
    <div className="mx-auto max-w-[760px] px-7 pt-8 pb-16">
      <header className="flex animate-enter items-end gap-4">
        <div className="flex-1">
          <h1 className="font-serif text-[26px] leading-tight">Activity & Notification History</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {counts.total > 0
              ? `Past 7 days: ${counts.done} completed / ran, ${counts.missed} alerts, out of ${counts.total} logged events.`
              : 'Permanent audit trail of all reminders, automations, file server logins, and security events.'}
          </p>
        </div>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
            Clear History
          </Button>
        )}
      </header>

      {/* Filter and Search Bar */}
      <div className="mt-6 space-y-3 animate-enter [animation-delay:40ms]">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            const count =
              f.value === 'all'
                ? history.length
                : history.filter((h) => getCategory(h, autoIdSet) === f.value).length;

            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cx(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
                  active
                    ? 'bg-accent text-on-accent shadow-sm'
                    : 'bg-raised text-muted hover:bg-hover hover:text-ink ring-1 ring-line',
                )}
              >
                <span>{f.label}</span>
                <span
                  className={cx(
                    'rounded-full px-1.5 py-0.2 font-mono text-[10px]',
                    active ? 'bg-black/20 text-white' : 'bg-surface text-faint',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events by title, user, IP, or details…"
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2 pl-9 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <span className="pointer-events-none absolute left-3 top-2.5 text-faint">
            <SearchIcon size={14} />
          </span>
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-2.5 text-xs text-muted hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="mt-16 animate-fade text-center font-serif text-[15px] text-muted italic">
          {query ? 'No matching events found.' : 'No activity logged yet.'}
        </p>
      ) : (
        <div className="mt-6 space-y-7">
          {groups.map(([day, entries]) => (
            <section key={day} className="animate-enter">
              <h2 className="mb-1.5 text-[12.5px] font-medium text-muted">{day}</h2>
              <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
                {entries.map((h) => {
                  const cat = getCategory(h, autoIdSet);
                  const tone = OUTCOME_TONE[h.outcome] || 'neutral';
                  const label = OUTCOME_LABEL[h.outcome] || h.outcome;

                  return (
                    <li
                      key={h.id}
                      className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-hover/30 transition-colors"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-raised">
                        <CategoryIcon category={cat} size={15} />
                      </span>
                      <span className="w-11 shrink-0 font-mono text-[11.5px] text-muted tabular-nums">
                        {timeOf(new Date(h.at || h.dueAt))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink">
                          <RichText text={h.title} />
                        </span>
                        {h.detail && (
                          <span className="block truncate text-[12px] text-faint">{h.detail}</span>
                        )}
                      </span>
                      <Pill tone={tone}>{label}</Pill>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog
        open={confirm}
        title="Clear History?"
        onClose={() => setConfirm(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void window.smaran.history.clear();
                setConfirm(false);
              }}
            >
              Clear History
            </Button>
          </>
        }
      >
        This permanently clears past activity and audit history. Your configured reminders, automations, and server accounts remain intact.
      </Dialog>
    </div>
  );
}
