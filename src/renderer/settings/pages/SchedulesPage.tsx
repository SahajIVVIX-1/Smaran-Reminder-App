import { format } from 'date-fns';
import { useEffect } from 'react';
import { ruleSummary } from '@shared/ruleSummary';
import type { Config, Schedule } from '@shared/schema';
import { addSchedule, deleteSelected, parseTags } from '../actions';
import { ListPane } from '../components/ListPane';
import { RuleEditor } from '../components/RuleEditor';
import {
  Button,
  EmptyState,
  Field,
  NumberInput,
  Section,
  Select,
  TextInput,
  Toggle,
} from '../components/ui';
import { isDirty, useSettings } from '../store';

function nextLabel(at: string | null | undefined): string {
  if (!at) return 'Not scheduled';
  const date = new Date(at);
  const today = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  return `Next: ${format(date, today ? 'HH:mm' : 'EEE d MMM, HH:mm')}`;
}

export function SchedulesPage() {
  const draft = useSettings((s) => s.draft);
  const saved = useSettings((s) => s.saved);
  const selectedId = useSettings((s) => s.selected.schedules);
  const nextTimes = useSettings((s) => s.nextTimes);
  const { edit, select, refreshNextTimes } = useSettings.getState();

  useEffect(() => {
    void refreshNextTimes();
    const timer = window.setInterval(() => void refreshNextTimes(), 30_000);
    return () => window.clearInterval(timer);
  }, [refreshNextTimes, saved]);

  if (!draft) return null;
  const schedule = draft.schedules.find((s) => s.id === selectedId) ?? null;
  const update = (id: string, change: (s: Schedule) => Schedule) =>
    edit((c) => ({ ...c, schedules: c.schedules.map((s) => (s.id === id ? change(s) : s)) }));

  return (
    <div className="flex h-full">
      <ListPane
        label="Schedules"
        items={draft.schedules.map((s) => ({
          id: s.id,
          title: s.name,
          muted: !s.enabled,
          subtitle: (
            <>
              {ruleSummary(s.rule)}
              <br />
              {s.enabled ? nextLabel(nextTimes.find((n) => n.scheduleId === s.id)?.at) : 'Off'}
            </>
          ),
          trailing: (
            <Toggle
              label={`${s.enabled ? 'Turn off' : 'Turn on'} “${s.name}”`}
              checked={s.enabled}
              onChange={(enabled) => update(s.id, (x) => ({ ...x, enabled }))}
            />
          ),
        }))}
        selectedId={selectedId}
        onSelect={(id) => select('schedules', id)}
        emptyText="No schedules yet. Press New to add one."
        header={
          <div className="flex justify-end">
            <Button tone="primary" onClick={() => addSchedule()}>
              New
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {schedule ? (
          <ScheduleEditor
            schedule={schedule}
            config={draft}
            unsaved={!saved || isDirty({ saved, draft })}
            onChange={(change) => update(schedule.id, change)}
          />
        ) : (
          <EmptyState>Select a schedule, or press New.</EmptyState>
        )}
      </div>
    </div>
  );
}

function ScheduleEditor({
  schedule,
  config,
  unsaved,
  onChange,
}: {
  schedule: Schedule;
  config: Config;
  unsaved: boolean;
  onChange: (change: (s: Schedule) => Schedule) => void;
}) {
  const { showToast } = useSettings.getState();
  const allTags = [...new Set(config.messages.flatMap((m) => m.tags))].sort();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="flex-1 text-lg font-semibold">Schedule</h2>
        <Button
          disabled={unsaved}
          title={unsaved ? 'Save your changes first' : undefined}
          onClick={async () => {
            const ok = await window.smaran.schedule.runNow(schedule.id);
            showToast(
              ok ? `Running “${schedule.name}” now` : 'Save this schedule first',
              ok ? 'info' : 'error',
            );
          }}
        >
          Run now
        </Button>
        <Button onClick={() => addSchedule(schedule)}>Duplicate</Button>
        <Button tone="danger" onClick={() => deleteSelected('schedules')}>
          Delete
        </Button>
      </div>

      <Section title="Schedule">
        <Field label="Name" htmlFor="schedule-name">
          <TextInput
            id="schedule-name"
            value={schedule.name}
            onChange={(e) => {
              const name = e.currentTarget.value;
              onChange((s) => ({ ...s, name }));
            }}
          />
        </Field>
        <Field label="On" htmlFor="schedule-enabled">
          <Toggle
            id="schedule-enabled"
            label="Schedule on"
            checked={schedule.enabled}
            onChange={(enabled) => onChange((s) => ({ ...s, enabled }))}
          />
        </Field>
      </Section>

      <Section
        title="When"
        aside={<span className="text-xs text-muted">{ruleSummary(schedule.rule)}</span>}
      >
        <RuleEditor rule={schedule.rule} onChange={(rule) => onChange((s) => ({ ...s, rule }))} />
      </Section>

      <Section title="Burst">
        <Field label="Show it" hint="How many times in a row the popup appears.">
          <NumberInput
            aria-label="Popups per burst"
            value={schedule.burst.count}
            min={1}
            max={100}
            unit="times"
            onChange={(n) =>
              onChange((s) => ({ ...s, burst: { ...s.burst, count: Math.round(n) } }))
            }
          />
        </Field>
        <Field label="Gap between">
          <NumberInput
            aria-label="Seconds between popups"
            value={schedule.burst.gapMs / 1000}
            min={0}
            max={86_400}
            step={0.5}
            unit="seconds"
            onChange={(n) =>
              onChange((s) => ({ ...s, burst: { ...s.burst, gapMs: Math.round(n * 1000) } }))
            }
          />
        </Field>
        <Field label="If a burst is running" htmlFor="schedule-overlap">
          <Select
            id="schedule-overlap"
            value={schedule.burst.overlap}
            onChange={(e) => {
              const overlap = e.currentTarget.value as Schedule['burst']['overlap'];
              onChange((s) => ({ ...s, burst: { ...s.burst, overlap } }));
            }}
          >
            <option value="skip">Skip this one</option>
            <option value="queue">Wait, then show it</option>
            <option value="replace">Stop the running burst and show this</option>
          </Select>
        </Field>
      </Section>

      <Section title="Which message">
        <Field label="Pick" htmlFor="picker-mode">
          <Select
            id="picker-mode"
            value={schedule.picker.mode}
            onChange={(e) => {
              const mode = e.currentTarget.value as Schedule['picker']['mode'];
              onChange((s) => ({
                ...s,
                picker:
                  mode === 'fixed'
                    ? { mode, messageId: s.picker.messageId ?? config.messages[0]?.id ?? '' }
                    : { mode, tags: s.picker.tags },
              }));
            }}
          >
            <option value="sequential">In order</option>
            <option value="random">At random</option>
            <option value="shuffle">At random, no repeats until all are shown</option>
            <option value="fixed">Always the same message</option>
          </Select>
        </Field>
        {schedule.picker.mode === 'fixed' ? (
          <Field label="Message" htmlFor="picker-message">
            <Select
              id="picker-message"
              value={schedule.picker.messageId ?? ''}
              onChange={(e) => {
                const messageId = e.currentTarget.value;
                onChange((s) => ({ ...s, picker: { ...s.picker, messageId } }));
              }}
            >
              {config.messages.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.text.split('\n')[0]?.slice(0, 60)}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field
            label="From"
            htmlFor="picker-tags"
            hint={
              allTags.length > 0
                ? `Tags in use: ${allTags.join(', ')}. Leave empty for all messages.`
                : 'Leave empty for all messages.'
            }
          >
            <TextInput
              id="picker-tags"
              placeholder="All enabled messages"
              defaultValue={(schedule.picker.tags ?? []).join(', ')}
              key={schedule.id}
              onChange={(e) => {
                const tags = parseTags(e.currentTarget.value);
                onChange((s) => {
                  const picker = { ...s.picker };
                  if (tags.length > 0) picker.tags = tags;
                  else delete picker.tags;
                  return { ...s, picker };
                });
              }}
            />
          </Field>
        )}
      </Section>
    </div>
  );
}
