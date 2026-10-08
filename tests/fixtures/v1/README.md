# v1 settings fixtures

No real v1 `smaran_settings.json` was available, so these files are reconstructed from the v1 audit in
the build plan: a list of messages, look settings at the top level that act as the global defaults,
per-message look overrides in `message_settings` keyed by message text, and one global schedule.

- `smaran_settings.default.json`: a typical v1 file.
- `smaran_settings.messy.json`: the v1 bugs the importer must survive (duplicate texts, a `GLOBAL`
  row from the CSV round-trip bug, bad colours, out-of-range numbers, a 29 February yearly schedule).

If a real v1 file turns up, add it here and adjust `src/main/store/migrations/v0_to_v1.ts`.
