import { useMemo, useState } from 'react';
import type { HistoryEntry } from '@shared/schema';
import { OUTCOME_LABEL, OUTCOME_TONE } from '../outcomes';
import { dayLabel, timeOf } from '../format';
import { useApp } from '../store';
import { Button, Dialog, Pill, Segmented } from '../ui';

type Filter = 'all' | 'done' | 'missed' | 'snoozed';

export function History() {
  const history = useApp((s) => s.history);
  const [filter, setFilter] = useState<Filter>('all');
  const [confirm, setConfirm] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const groups = useMemo(() => {
    const shown = filter === 'all' ? history : history.filter((h) => h.outcome === filter);
    const map = new Map<string, HistoryEntry[]>();
    for (const entry of shown) {
      const label = dayLabel(new Date(entry.at));
      map.set(label, [...(map.get(label) ?? []), entry]);
    }
    return [...map.entries()];
  }, [history, filter]);

  const counts = useMemo(() => {
    const week = openedAt - 7 * 86_400_000;
    const recent = history.filter((h) => new Date(h.at).getTime() >= week);
    return {
      done: recent.filter((h) => h.outcome === 'done').length,
      missed: recent.filter((h) => h.outcome === 'missed').length,
      total: recent.length,
    };
  }, [history, openedAt]);

  return (
    <div className="mx-auto max-w-[760px] px-7 pt-8 pb-16">
      <header className="flex animate-enter items-end gap-4">
        <div className="flex-1">
          <h1 className="font-serif text-[26px] leading-tight">History</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {counts.total > 0
              ? `This week: ${counts.done} done, ${counts.missed} missed, out of ${counts.total}.`
              : 'What happened to each reminder will show up here.'}
          </p>
        </div>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
            Clear history
          </Button>
        )}
      </header>

      <div className="mt-6 animate-enter [animation-delay:40ms]">
        <Segmented<Filter>
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'done', label: 'Done' },
            { value: 'missed', label: 'Missed' },
            { value: 'snoozed', label: 'Snoozed' },
          ]}
        />
      </div>

      {groups.length === 0 ? (
        <p className="mt-16 animate-fade text-center text-[13.5px] text-muted">Nothing here yet.</p>
      ) : (
        <div className="mt-6 space-y-7">
          {groups.map(([day, entries]) => (
            <section key={day} className="animate-enter">
              <h2 className="mb-1.5 text-[12.5px] font-medium text-muted">{day}</h2>
              <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
                {entries.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center gap-4 border-b border-line px-4 py-2.5 last:border-b-0"
                  >
                    <span className="w-11 shrink-0 text-[12.5px] text-muted tabular-nums">
                      {timeOf(new Date(h.dueAt))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px]">{h.title}</span>
                      {h.detail && (
                        <span className="block truncate text-[12px] text-faint">{h.detail}</span>
                      )}
                    </span>
                    <Pill tone={OUTCOME_TONE[h.outcome]}>{OUTCOME_LABEL[h.outcome]}</Pill>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog
        open={confirm}
        title="Clear history?"
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
              Clear history
            </Button>
          </>
        }
      >
        This removes the record of past reminders. Your reminders themselves stay as they are.
      </Dialog>
    </div>
  );
}
