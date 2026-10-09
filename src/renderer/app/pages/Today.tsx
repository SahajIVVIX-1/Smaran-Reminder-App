import { endOfDay, format, startOfDay } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { occurrencesBetween } from '@shared/time';
import type { HistoryEntry, Reminder } from '@shared/schema';
import { COLOR_BG } from '../../colors';
import { QuickAdd } from '../components/QuickAdd';
import { cx } from '../cx';
import { greeting, timeOf, whenLabel } from '../format';
import { useApp } from '../store';
import { Button, Pill } from '../ui';
import { OUTCOME_LABEL, OUTCOME_TONE } from '../outcomes';

/** Re-render every 30 s so "in 5 min" stays true. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

interface Slot {
  at: Date;
  reminder: Reminder;
}

export function Today() {
  const config = useApp((s) => s.config);
  const history = useApp((s) => s.history);
  const nextTimes = useApp((s) => s.nextTimes);
  const { edit } = useApp.getState();
  const now = useNow();

  const later = useMemo(() => {
    if (!config) return [];
    const slots: Slot[] = [];
    const end = endOfDay(now);
    for (const reminder of config.reminders) {
      if (!reminder.enabled) continue;
      const next = nextTimes.find((n) => n.reminderId === reminder.id)?.at;
      if (!next) continue;
      const first = new Date(next);
      if (first > end) continue;
      slots.push({ at: first, reminder });
      // Later occurrences today (a few, so a frequent reminder doesn't fill the list).
      for (const at of occurrencesBetween(reminder.rule, first, end, 3))
        slots.push({ at, reminder });
    }
    return slots.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 12);
  }, [config, nextTimes, now]);

  const done = useMemo(() => {
    const start = startOfDay(now).getTime();
    return history.filter((h) => new Date(h.at).getTime() >= start).slice(0, 8);
  }, [history, now]);

  if (!config) return null;
  const next = later[0] ?? upcomingBeyondToday(config.reminders, nextTimes);
  const snoozed = config.reminders.filter((r) => config.state[r.id]?.snoozedUntil);

  return (
    <div className="mx-auto max-w-[720px] px-7 pt-9 pb-16">
      <header className="animate-enter">
        <h1 className="font-serif text-[30px] leading-tight tracking-[-0.01em]">{greeting(now)}</h1>
        <p className="mt-1 font-serif text-[15px] text-muted italic">
          {format(now, 'EEEE d MMMM')}
        </p>
      </header>

      <div className="mt-6 animate-enter [animation-delay:40ms]">
        <QuickAdd />
      </div>

      {next ? (
        <section className="mt-6 animate-enter rounded-xl border border-line bg-surface px-4 py-3.5 [animation-delay:80ms]">
          <div className="text-[12px] font-medium tracking-wide text-muted uppercase">Up Next</div>
          <div className="mt-2 flex items-start gap-3">
            <span
              className={cx(
                'mt-2 h-2.5 w-2.5 shrink-0 rounded-full',
                COLOR_BG[next.reminder.color],
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">{next.reminder.title}</div>
              <div className="mt-0.5 text-[13px] text-muted">
                {whenLabel(next.at, now)} ·{' '}
                <span className="font-mono text-[12.5px]">{timeOf(next.at)}</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => edit({ mode: 'edit', id: next.reminder.id })}
            >
              Edit
            </Button>
            <Button
              size="sm"
              onClick={() =>
                void useApp.getState().track(window.smaran.reminders.showNow(next.reminder.id))
              }
            >
              Show Now
            </Button>
          </div>
        </section>
      ) : (
        <section className="mt-6 animate-enter rounded-2xl border border-dashed border-line p-8 text-center [animation-delay:80ms]">
          <p className="font-serif text-[19px]">Nothing Scheduled</p>
          <p className="mt-1 font-serif text-[14px] text-muted italic">
            Add a reminder above. Smaran will take it from there.
          </p>
        </section>
      )}

      {later.length > 1 && (
        <section className="mt-6 animate-enter [animation-delay:120ms]">
          <h2 className="mb-2 font-serif text-[15.5px] font-semibold">Later Today</h2>
          <ol className="relative ml-1.5 border-l border-line">
            {later.slice(1).map((slot, i) => (
              <li
                key={`${slot.reminder.id}-${slot.at.getTime()}-${i}`}
                className="relative py-0.5 pl-5"
              >
                <span
                  className={cx(
                    'absolute top-3 -left-[4.5px] h-2 w-2 rounded-full',
                    COLOR_BG[slot.reminder.color],
                  )}
                />
                <button
                  type="button"
                  onClick={() => edit({ mode: 'edit', id: slot.reminder.id })}
                  className="flex w-full items-baseline gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-hover"
                >
                  <span className="w-12 shrink-0 font-mono text-[12px] text-muted tabular-nums">
                    {timeOf(slot.at)}
                  </span>
                  <span className="truncate text-[13.5px]">{slot.reminder.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {snoozed.length > 0 && (
        <section className="mt-6 animate-enter [animation-delay:140ms]">
          <h2 className="mb-2 font-serif text-[15.5px] font-semibold">Snoozed</h2>
          <ul className="space-y-1">
            {snoozed.map((r) => {
              const until = new Date(config.state[r.id]?.snoozedUntil ?? '');
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13.5px]"
                >
                  <span className={cx('h-2 w-2 rounded-full', COLOR_BG[r.color])} />
                  <span className="flex-1 truncate">{r.title}</span>
                  <span className="text-[12.5px] text-muted">{whenLabel(until, now)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="mt-6 animate-enter [animation-delay:160ms]">
          <h2 className="mb-2 font-serif text-[15.5px] font-semibold">Earlier Today</h2>
          <ul className="space-y-0.5">
            {done.map((h) => (
              <HistoryLine key={h.id} entry={h} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function HistoryLine({ entry }: { entry: HistoryEntry }) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13.5px]">
      <span className="w-12 shrink-0 font-mono text-[12px] text-muted tabular-nums">
        {timeOf(new Date(entry.dueAt))}
      </span>
      <span className="flex-1 truncate text-muted">{entry.title}</span>
      <Pill tone={OUTCOME_TONE[entry.outcome]}>{OUTCOME_LABEL[entry.outcome]}</Pill>
    </li>
  );
}

function upcomingBeyondToday(
  reminders: Reminder[],
  nextTimes: { reminderId: string; at: string | null }[],
): Slot | undefined {
  return reminders
    .flatMap((reminder) => {
      const at = reminder.enabled ? nextTimes.find((n) => n.reminderId === reminder.id)?.at : null;
      return at ? [{ reminder, at: new Date(at) }] : [];
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
}
