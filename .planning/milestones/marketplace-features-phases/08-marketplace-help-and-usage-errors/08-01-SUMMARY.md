---
phase: 08-marketplace-help-and-usage-errors
plan: "01"
subsystem: testing
tags: [cucumber, gherkin, marketplace, usage-errors, headless-pi]
status: complete

requires: []
provides:
  - "features/marketplace/usage-errors.feature: five Outlines (43 rows) pinning every marketplace usage rejection through a real headless Pi"
affects: [08-02, 08-03, 08-04, 08-05, marketplace usage lines, edge argument parsers]

actuals:
  tokens: 2336
  tasks: 2
  commits: 2
plan_head_before: 383481010653846f8b9d227d126081251a8c5040
plan_head_after: 8a2b2cddfb1f2e9be3160f475ecaa00d8bb93dec

tech-stack:
  added: []
  patterns:
    - "One Outline per rejection kind, one row per verb, whole usage-error payload compared through `the result has these fields:`"

key-files:
  created:
    - features/marketplace/usage-errors.feature
  modified: []

key-decisions:
  - "Usage-error Outlines name their columns arguments, message, value, and usage only, so Gherkin never rewrites the <name> or <source> text inside a usage cell"
  - "No rm or ls alias rows: the router sends both aliases to the same handler and usage line, and existing scenarios and unit tests already pin them"
  - "Every row carries exactly one fault; combined-fault precedence differs by parser path and stays unpinned"

patterns-established:
  - "Usage-error Outline: When the user runs \"/claude:plugin marketplace <arguments>\", then a five-field table (kind, severity, needs reload, message, usage) with the verb's usage line as a column"

requirements-completed: [USE-03, USE-04, USE-05, USE-06]

coverage:
  - id: D1
    description: "Missing required argument on add, remove, and info reports `Missing required argument.` with the verb's usage line"
    requirement: USE-03
    verification:
      - kind: integration
        ref: "features/marketplace/usage-errors.feature#A marketplace subcommand without its required argument reports a missing argument"
        status: pass
    human_judgment: false
  - id: D2
    description: "One argument too many on each of the seven marketplace verbs reports `Too many arguments.` with the verb's usage line"
    requirement: USE-04
    verification:
      - kind: integration
        ref: "features/marketplace/usage-errors.feature#A marketplace subcommand rejects more arguments than it takes"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unknown flags (including --local on list, info, update, and the first of two unknown flags) are rejected by name on every verb"
    requirement: USE-05
    verification:
      - kind: integration
        ref: "features/marketplace/usage-errors.feature#A marketplace subcommand rejects a flag it does not accept"
        status: pass
    human_judgment: false
  - id: D4
    description: "A bad --scope value before or after the positional, and a trailing --scope with no value, are rejected on every verb and parser path"
    requirement: USE-06
    verification:
      - kind: integration
        ref: "features/marketplace/usage-errors.feature#A marketplace subcommand rejects a --scope value other than user or project in any position"
        status: pass
      - kind: integration
        ref: "features/marketplace/usage-errors.feature#A marketplace subcommand rejects a --scope flag with no value"
        status: pass
    human_judgment: false

duration: 4 min
completed: 2026-10-20
---

# Phase 8 Plan 01: Marketplace usage-error scenarios Summary

**Five cucumber Outlines (43 rows) pin, through a real headless Pi, every marketplace usage rejection that works today: missing and surplus arguments, unknown flags including `--local` on the read-only verbs, and bad or missing `--scope` values on each parser path, each comparing the whole usage-error payload and the verb's own usage line.**

## Performance

- **Duration:** about 4 min
- **Started:** 2026-10-20T12:06:42Z
- **Completed:** 2026-10-20T12:10:24Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- `Feature: Marketplace usage errors` in `features/marketplace/usage-errors.feature`, with two description lines.
- USE-03: 3 rows (`add`, `remove`, `info`) report `Missing required argument.`.
- USE-04: 7 rows, one per verb, report `Too many arguments.`.
- USE-05: 12 rows: `--bogus` on all seven verbs, `--local` on `list`, `info`, and `update`, and `--bogus --other` on `list` and `autoupdate` (the two flag-scan paths), which names the first flag.
- USE-06: 14 bad-value rows (before and after the positional on `add`, `info`, `update`, and `autoupdate`; `--scope --local` on `add` and `autoupdate`; `add --scope tools` taking the positional as the value) and 7 missing-value rows, one per verb.
- No production, unit-test, step, world, or `cucumber.json` change.

## Task Commits

1. **Task 1: Pin the missing-argument and surplus-argument rejections (USE-03, USE-04)** - `863c9e35` (test)
2. **Task 2: Pin the unknown-flag and --scope rejections in every position (USE-05, USE-06)** - `8a2b2cdd` (test)

The tracer gate after Task 1 re-ran its automated `<verify>` (10 scenarios, 10 passed) before Task 2 started.

## Verification Evidence

Node `v26.11.1`, scope `features/marketplace/usage-errors.feature`, run on this worktree (`features/cucumber-behavioral-tests`).

| Command | Commit | Exit | Result |
| --- | --- | --- | --- |
| `npm run test:cucumber -- features/marketplace/usage-errors.feature --parallel 1` (Task 1) | tree of `863c9e35` | 0 | `10 scenarios (10 passed)`, `40 steps (40 passed)` |
| `npm run check:features` (Task 1) | tree of `863c9e35` | 0 | no `Feature gate failed` |
| `npm run test:cucumber -- features/marketplace/usage-errors.feature --parallel 1` (Task 2) | tree of `8a2b2cdd` | 0 | `43 scenarios (43 passed)`, `172 steps (172 passed)` |
| `npm run check:features` (Task 2) | tree of `8a2b2cdd` | 0 | no `Feature gate failed` |
| `SKIP=npm-check pre-commit run --files features/marketplace/usage-errors.feature` (both tasks) | both | 0 | all hooks passed or skipped |
| commit hook `npm run check:commit` (both commits) | `863c9e35`, `8a2b2cdd` | 0 | Passed (incremental evidence only) |
| `git diff --quiet 124f2311 -- extensions/ cucumber.json` | `8a2b2cdd` | 0 | production code unchanged since the research probe |

Acceptance checks: 5 `Scenario Outline:` lines; 0 columns named `name`, `source`, `plugin`, or `marketplace`; every verb appears in the unknown-flag, bad-value, and missing-value Outlines; `git show --stat --format= HEAD -- extensions tests` prints nothing. The combined-tree `npm run check` belongs to plan 08-05.

## Files Created/Modified

- `features/marketplace/usage-errors.feature` - five usage-error Outlines over every marketplace verb (created)

## Decisions Made

- Columns are named `arguments`, `message`, `value`, and `usage` only, so Gherkin's placeholder substitution never rewrites the `<name>`, `<source>`, or `<remove|rm>` text inside a usage cell.
- No `rm` or `ls` rows (plan discretion): both aliases reach the same handler and usage line, and existing scenarios and `tests/edge/register.test.ts` pin them.
- The `--scope --local` rows are pinned (plan discretion): they prove the `--local` scan leaves a `--scope` value alone on both paths that run it.

## Flagged Assumptions From the Spec-less Probe

- `USE-04 / unclassified / unresolved`: the probe supplied no edge shape. The surplus Outline is the manual-review target; no unseen edge is claimed resolved.
- `USE-06 / unclassified / unresolved`: the probe supplied no edge shape. The two `--scope` Outlines are the manual-review target.
- Combined faults are not pinned: every row carries one fault, because precedence differs by parser path (`add --scope bad --bogus` names the flag, `list --scope bad --bogus` names the scope value). Pinning that asymmetry would be a new row set.
- Not pinned and not fixed: a repeated `--local` is accepted, a repeated `--scope` keeps the last value, and a short option such as `-x` reads as a positional.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0. **Impact:** none.

## Issues Encountered

None. Every row passed on the unchanged production code on the first run.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Ready for 08-02: these Outlines pin each verb's usage line end to end, so the signature-table refactor (D-02) is checked against scenarios that already pass.

## Self-Check: PASSED

- FOUND: features/marketplace/usage-errors.feature
- FOUND: 863c9e35
- FOUND: 8a2b2cdd
