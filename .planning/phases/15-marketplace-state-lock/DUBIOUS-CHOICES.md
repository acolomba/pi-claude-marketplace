# Phase 15 (Marketplace State Lock): Dubious Choices

The choices Phase 15 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 15.
Only the phase's child session writes this file: it copies each item from
the report of each step and from the `## Dubious Choices` section of each
plan SUMMARY.md. A subagent never edits this file.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 15's.

## Discuss step

The autonomous run took the recommended option at every discuss question.
Those answers are the decisions D-BG-1501 to D-BG-1512 in 15-CONTEXT.md, so
most are not repeated here. The entries below are the ones a reviewer may
want to reverse.

- **P15-DC-01 (High, open). The scenarios pin D-06, not Claude Code's
  fallback.** Claude Code 2.1.319 retries its `known_marketplaces.json` lock 5
  times and then writes without it. The MLOCK-01 scenarios pin this project's
  D-06 behavior instead: no retry, the verb fails as `lock held`, and nothing
  changes. D-06 is a recorded decision, so it licenses the divergence. The
  requirement wording asks for exactly this behavior (D-BG-1501).
- **P15-DC-02 (Medium, open). No scenario for the unnamed or cross-scope
  flip.** An unnamed flip under a held lock reports the `(unknown)` aggregate
  subject. A flip without `--scope` can write the project scope and then fail
  on the user scope. Unit tests pin both, and no scenario does. The `(unknown)`
  subject is left as a candidate BACKLOG item, not fixed, because it is
  deliberate, unit-tested wording, not a bug (D-BG-1506).
- **P15-DC-03 (Low, open). The seed is rewritten.** The Phase 1 MLOCK-02 seed
  becomes the exact twin of the live project-scope remove scenario, with
  `demo` installed, so its result now holds the cascade's uninstall row. Its
  lock step stays in use (D-BG-1508).
- **P15-DC-04 (Low, open). No verb step module.** Every step exists in the
  shared modules, so the reserved `marketplace/state-lock.steps.ts` is not
  created (D-BG-1510).
