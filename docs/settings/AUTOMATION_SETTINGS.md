# Automation Settings & Safety Policies

The **Automation Settings** tab controls automated task scheduling, countdown durations, pre-execution alerts, failure notifications, and disruptive action safety.

---

## 1. Global Automation Configuration

| Setting | Key | Type | Default | Options | Detailed Description |
|---|---|---|---|---|---|
| **Enable Automations** | `settings.automation.enabled` | `boolean` | `true` | `true`, `false` | Master switch controlling the entire automations subsystem. When disabled, all triggers and automated schedules are paused. |
| **Global Pause** | `settings.automation.paused` | `boolean` | `false` | `true`, `false` | Temporarily suspends automation executions without altering individual rule enable/disable toggles. |
| **Pre-Execution Notification** | `settings.automation.notifyPreExecution` | `boolean` | `true` | `true`, `false` | Displays a desktop notification card **before** executing any scheduled automation action. |
| **Default Countdown** | `settings.automation.preExecutionCountdownSec` | `number` | `5` sec | `1` to `60` sec | Duration in seconds the desktop countdown notification displays before launching the automated action. |
| **Notify on Failure** | `settings.automation.notifyOnFailure` | `boolean` | `true` | `true`, `false` | Displays an expanded failure alert if a script, executable, or system command fails (non-zero exit code or timeout). |
| **Notify on Success** | `settings.automation.notifyOnSuccess` | `boolean` | `false` | `true`, `false` | Optional desktop notification displayed upon successful execution of an automation step. |
| **Automation Audio** | `settings.automation.sound` | `boolean` | `true` | `true`, `false` | Plays an audio alert tone when the pre-execution notification appears. |

---

## 2. Smart Pre-Execution Countdown Cards

Whenever an automation is about to run (e.g. at 10:00:00 AM with a 5-second countdown), Smaran displays an expanded notification card at **09:59:55 AM**:

```
+-------------------------------------------------------------+
| [Smaran Brandmark]  AUTOMATION PRE-EXECUTION                |
|                                                             |
| Open Google Chrome Work Workspace                           |
| Action: Open App - C:\Program Files\Google\Chrome\chrome.exe|
| Scheduled: 10:00 AM                                         |
|                                                             |
| Starting in: 5... 4... 3... 2... 1...                       |
| [======================== progress bar ===================] |
|                                                             |
| [ Cancel ]                                     [ Run Now ]  |
+-------------------------------------------------------------+
```

### Action Controls
- **`[Run Now]` Button:** Immediately executes the automation without waiting for the remaining countdown seconds to expire.
- **`[Cancel]` Button:** Immediately aborts the upcoming execution, cancels all pending steps, and records the outcome as `canceled` in History.
- **Countdown Expiration:** The automation only executes once the countdown timer reaches zero in the main process engine. The renderer interface does not execute actions independently.

---

## 3. Disruptive Power Actions Safety Policy

Certain automation actions can disrupt user work (e.g. shutting down, sleeping, or restarting Windows). Smaran enforces a mandatory safety rule for all disruptive power actions (`isDisruptive(action)`):

- Actions classified as disruptive: `signOut`, `sleep`, `hibernate`, `shutdown`, `restart`.
- For any disruptive action, a mandatory **Cancel card** is presented for `warnSec` seconds (configured per rule, minimum recommended 10 seconds).
- The user can click `[Cancel]` at any point to stop the power action from executing.
- `lock` action does not terminate user processes and therefore executes without a disruptive warning.
