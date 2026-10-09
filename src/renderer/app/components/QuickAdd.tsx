import { useMemo, useState } from 'react';
import { createReminder } from '@shared/defaults';
import { quickParse } from '@shared/quickParse';
import { ruleSummary } from '@shared/ruleSummary';
import { cx } from '../cx';
import { ArrowUpIcon, SparkIcon } from '../icons';
import { defaultRule } from '../rules';
import { useApp } from '../store';

const EXAMPLES = [
  'Stretch every 45 min',
  'Call mom at 6pm',
  'Standup every weekday at 9:30',
  'Pay rent on the 1st of every month',
];

/**
 * The composer: type a reminder the way you'd say it. Enter creates it; "More Options" opens the
 * full editor with what was understood filled in.
 */
export function QuickAdd() {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const { upsertReminder, edit, toastMsg } = useApp.getState();
  const parsed = useMemo(() => (text.trim() ? quickParse(text) : null), [text]);

  const create = () => {
    if (!parsed) return;
    const reminder = createReminder({
      title: parsed.title,
      rule: parsed.rule ?? defaultRule('once'),
    });
    if (!parsed.rule) {
      // No time understood: let the user choose one.
      edit({ mode: 'new', draft: reminder });
    } else {
      upsertReminder(reminder);
      toastMsg(`Added “${reminder.title}” · ${ruleSummary(reminder.rule)}`);
    }
    setText('');
  };

  return (
    <div
      className={cx(
        'rounded-2xl border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] duration-200',
        focused ? 'border-accent/40 shadow-[0_4px_18px_-6px_rgba(0,0,0,0.12)]' : 'border-line',
      )}
    >
      <div className="flex items-center gap-2 px-4 pt-3">
        <input
          aria-label="Quick add"
          className="h-9 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:font-serif placeholder:text-[16px] placeholder:text-faint placeholder:italic"
          placeholder="Remind me to…"
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              create();
            }
          }}
        />
        <button
          type="button"
          aria-label="Add reminder"
          disabled={!parsed}
          onClick={create}
          className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-on-accent transition-[background-color,opacity,transform] duration-150 hover:bg-accent-hover active:scale-95 disabled:opacity-30"
        >
          <ArrowUpIcon size={16} />
        </button>
      </div>
      <div className="flex min-h-10 items-center gap-2 px-4 pb-2.5 text-[12.5px]">
        {parsed ? (
          <span
            className="flex min-w-0 animate-fade items-center gap-1.5 text-muted"
            data-testid="quick-preview"
          >
            <SparkIcon size={14} className="shrink-0 text-accent" />
            <span className="truncate">
              <span className="text-ink">{parsed.title}</span>
              {' · '}
              {parsed.rule ? ruleSummary(parsed.rule) : 'no time yet, you’ll pick one next'}
            </span>
          </span>
        ) : (
          <span className="truncate text-faint">
            Try “{EXAMPLES[new Date().getMinutes() % EXAMPLES.length]}”
          </span>
        )}
        {parsed && (
          <button
            type="button"
            className="ml-auto shrink-0 rounded-md px-2 py-1 text-muted transition-colors hover:bg-hover hover:text-ink"
            onClick={() => {
              edit({
                mode: 'new',
                draft: createReminder({
                  title: parsed.title,
                  rule: parsed.rule ?? defaultRule('once'),
                }),
              });
              setText('');
            }}
          >
            More Options
          </button>
        )}
      </div>
    </div>
  );
}
