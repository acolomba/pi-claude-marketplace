# Phase 30: Autoapply Setting - Discussion Log

> Audit trail only. Decisions live in 30-CONTEXT.md.

**Date:** 2026-10-25
**Mode:** `--auto` (no prompts; recommended option taken for each question)

[auto] Selected all gray areas: combination of values, load output, non-boolean value, visibility in pending/list/info.

- [auto] Combination — Q: "How do per-file and per-scope values combine?" → Selected: "one effective value, most specific layer wins (project local > project base > user local > user base), governs both scopes" (upstream settings precedence). Alternative considered: each scope's own value governs only that scope's apply.
- [auto] Output — Q: "What does an autoapply load print?" → Selected: "apply's report unchanged, reload trailer kept when rows stamp it; silent when nothing changed".
- [auto] Validation — Q: "What does a non-boolean value do?" → Selected: "the file is schema-invalid (CFG-03) and any invalid config file keeps the load read-only" (fail closed).
- [auto] Visibility — Q: "Do pending/list/info show autoapply?" → Selected: "no".

## Deferred Ideas

- Trust prompt for project files (rejected by AAP-D1).
- A toggle verb for the setting.
