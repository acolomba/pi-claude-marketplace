---
phase: 04-git-source-plugins
plan: 02
subsystem: plugin install messaging
tags: [cucumber, git-source, install, reasons]
requirements-completed: [INS-06]
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - test/orchestrators/plugin/install.messaging.test.ts
    - features/plugin/git-source.feature
    - CHANGELOG.md
commits: [2674e21c, dc36bf49]
status: complete
completed: 2026-10-23
---

# Phase 4 Plan 02: A refused git-source install names its reason

**Product fix (D-06):** `composeInstallFailureMessage` classifies a runtime
throw with `classifyGitSourceAccessFailure` (the ladder `marketplace add` uses),
so a 404 fails as `source missing` and a dropped connection as
`network unreachable`; both keep their cause chain. `authentication required`
stays bare (D-79-03). Before, 404 and a drop failed with an empty reasons list.

## Accomplishments

- `install.messaging.ts`: the private auth-only `classifyGitAuthFailure` is
  removed; the runtime branch uses the source-access ladder.
- `install.messaging.test.ts`: new 404 case (`source missing`, cause kept); the
  errno case now expects `network unreachable` with its cause (ECONNRESET).
  57/57 pass.
- `git-source.feature`: Outline "An install fails as <reason> when the git host
  <refusal> and leaves nothing behind" (404, connection drop) and Scenario "An
  install fails as authentication required when the git host asks for a
  credential the user has not stored". Each compares the fields, the whole
  plugin row, and the request log, then: no installed plugins, no git clones,
  a new session offers no skills.

## Verification

- `npx cucumber-js features/plugin/git-source.feature --parallel 1`: 9 pass.
- Planted check: the probe run before the fix (same scenario shape) showed
  `reasons` empty for 404 and the drop, so the Outline fails without Task 1.
- Commit hook passed on both commits.

## Deviations

- The auth row carries no cause columns, so it is a separate Scenario instead
  of a third Outline row (a table cannot vary its columns per example).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
