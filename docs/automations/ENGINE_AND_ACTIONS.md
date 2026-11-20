# Automation Engine, Triggers & Actions

## 1. Automation Model (`AutomationSchema`)

Each automation rule in Smaran is represented as follows:

```typescript
export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  steps: Step[];
  warnSec: number;        // Pre-execution warning/cancel duration (seconds)
  respectPause: boolean;  // Suppress when Smaran is paused or during quiet hours
  createdAt: string;
  updatedAt: string;
}
```

---

## 2. Trigger Types (`TriggerSchema`)

Automations can be scheduled or triggered by operating system events:

### A. System Startup & Login Triggers (`kind: 'start'`)
- `when: 'boot'`: Triggers upon first user sign-in after Windows starts.
- `when: 'signIn'`: Triggers on every user sign-in.
- `when: 'smaran'`: Triggers when the Smaran application process launches.
- `delaySec`: Configurable delay (0 to 3600 seconds) before starting the automation.

### B. Time-Based Schedules (`kind: 'schedule'`)
- Embeds any full `Rule` (interval, once, daily, weekly, monthly, yearly).

### C. System State & Activity Events (`kind: 'event'`)
Listens to native Windows power and session events:
- `'lock'` / `'unlock'`: User locks or unlocks their Windows workstation.
- `'sleep'` / `'wake'`: Computer enters or resumes from low-power sleep state.
- `'pluggedIn'` / `'onBattery'`: AC power connected or switched to battery power.
- `'idle'`: User has been inactive for `idleMin` minutes.
- `'active'`: User resumes keyboard or mouse activity after being idle.

---

## 3. Action Kinds (`ActionSchema`)

Each automation consists of one or more sequential `Step` entries (`{ action: Action, waitSec: number }`):

### 1. Power Action (`kind: 'power'`)
Controls Windows power states:
- `'lock'`: Locks Windows (`rundll32.exe user32.dll,LockWorkStation`).
- `'signOut'`: Logs out user session (`shutdown /l`).
- `'sleep'`: Puts PC to sleep (`rundll32.exe powrprof.dll,SetSuspendState 0,1,0`).
- `'hibernate'`: Hibernates system (`shutdown /h`).
- `'shutdown'`: Turns off PC (`shutdown /s /t 0`).
- `'restart'`: Reboots PC (`shutdown /r /t 0`).

*Note: All actions other than `lock` are disruptive and trigger mandatory cancellation safety countdowns.*

### 2. Open Action (`kind: 'open'`)
Launches applications, opens documents, or executes local scripts:
- `what: 'app' | 'file' | 'script'`
- `path`: Absolute file system path to target executable or document.
- `args`: Command-line parameters passed to the executable.
- `hidden`: If `true`, runs scripts without spawning a visible Windows console (`cmd.exe` / `powershell.exe`) window.

### 3. Web Link Action (`kind: 'link'`)
Opens a URL in a specific browser:
- `url`: Must start with `http://` or `https://`.
- `browser`: Specific browser executable path, or empty string to use Windows Default Browser.
- `private`: Launches browser in incognito / private browsing mode (e.g. `--incognito` for Chromium browsers, `-private-window` for Firefox).

---

## 4. Execution Pipeline & Error Handling

1. **Pre-Execution Check:** Verifies master toggles (`settings.automation.enabled` and `!settings.automation.paused`). If `respectPause` is active and quiet hours are ongoing, execution is skipped and recorded as `skipped`.
2. **Countdown Notification:** Displays the 5-second countdown card on screen. If the user clicks `[Cancel]`, execution is aborted and recorded as `canceled`.
3. **Sequential Stepping:** Steps execute in order. If a step defines `waitSec > 0`, the engine waits for the specified seconds before running the next step.
4. **Execution Failure Recovery:** If a process exits with a non-zero code or throws an error:
   - The failure is logged in History.
   - An expanded Failure Desktop Notification card is shown (`notifyOnFailure: true`).
