---
phase: 12-standalone-prune-with-dry-run
plan: "08"
subsystem: plugin-lifecycle
tags: [prune, dry-run, documentation, integration, regression]
requires:
  - phase: 12-standalone-prune-with-dry-run
    provides: Plans 01-07 standalone prune, preview, output, and flag contracts
  - phase: 05-prune-on-uninstall
    provides: Existing uninstall --prune fixpoint and removal rows
  - phase: 06-load-time-dependency-check-and-allowed-uninstall
    provides: Allowed uninstall of a plugin that dependents still declare
provides:
  - Public standalone prune and preview instructions with exact output and scope rules
  - Closed PRUNE-CMD-01 disposition without a list or info orphan marker
  - Command-level regression evidence for actual, preview, failure, scope, and flag behavior
affects: [phase-verification, user-documentation]
actuals:
  tokens: 7062
  tasks: 2
  commits: 2
plan_head_before: 0712fccd4e5ce33a5c3e52f0d1beb0fcc0b48c1d
tech-stack:
  added: []
  patterns:
    - Assert full command notifications and disk state from independently stated fixtures
    - Check preview bytes, modification time, and scope trees before and after calls
key-files:
  created: []
  modified:
    - README.md
    - docs/dependency-resolution.md
    - .planning/BACKLOG.md
    - tests/architecture/dependency-doc-agreement.test.ts
    - tests/edge/register.test.ts
    - tests/integration/standalone-prune.test.ts
key-decisions:
  - Keep standalone prune distinct from uninstall --prune in both public documents.
  - Drop the proposed list and info orphan marker under D-12-03.
  - Correct registered-command test literals to the shipped Plan 07 usage and unknown-flag wording.
requirements-completed: [PRUNE-06, PRUNE-07, FLAG-02]
coverage:
  - id: D1
    description: Public instructions state the standalone actual and preview commands, exact rows, scope selection, and retained uninstall behavior.
    requirement: PRUNE-06
    verification:
      - kind: unit
        ref: tests/architecture/dependency-doc-agreement.test.ts#PRUNE-06 and PRUNE-07 docs name standalone actual and preview behavior
        status: pass
      - kind: unit
        ref: tests/architecture/dependency-doc-agreement.test.ts#PRUNE-06 docs keep allowed uninstall, uninstall pruning, and explicit reload semantics
        status: pass
    human_judgment: false
  - id: D2
    description: Actual prune removes the same-scope orphan fixpoint and retains held members after a failed removal.
    requirement: PRUNE-06
    verification:
      - kind: integration
        ref: tests/integration/standalone-prune.test.ts#preview and actual preserve alternating marketplaces and held neighbors
        status: pass
      - kind: integration
        ref: tests/integration/standalone-prune.test.ts#failed actual member holds its dependency until a later retry
        status: pass
    human_judgment: false
  - id: D3
    description: Preview is read-only on current, legacy, and absent state, and a later actual run selects its own fresh state.
    requirement: PRUNE-07
    verification:
      - kind: integration
        ref: tests/integration/standalone-prune.test.ts#prune --dry-run previews the orphan without writing current state
        status: pass
      - kind: integration
        ref: tests/integration/standalone-prune.test.ts#repeated legacy previews normalize in memory without writing the scope
        status: pass
      - kind: integration
        ref: tests/integration/standalone-prune.test.ts#preview of a missing project state leaves both scope trees unchanged
        status: pass
      - kind: integration
        ref: tests/integration/standalone-prune.test.ts#actual prune reselects after a stale preview changes on disk
        status: pass
    human_judgment: false
  - id: D4
    description: Prune accepts the documented scope and dry-run flags and rejects unsupported flags before selecting an installed orphan.
    requirement: FLAG-02
    verification:
      - kind: integration
        ref: tests/integration/standalone-prune.test.ts#prune -y rejects before selecting an installed orphan
        status: pass
      - kind: unit
        ref: tests/edge/register.test.ts#registered prune rejects --prune before reaching state
        status: pass
      - kind: unit
        ref: tests/architecture/flag-catalog-drift.test.ts#catalog vs help text
        status: pass
    human_judgment: false
duration: 65min
completed: 2026-09-24
status: complete
---

# Phase 12 Plan 08: Standalone prune closeout summary

The README and dependency guide now explain standalone prune and read-only preview. Command-level tests cover removal order, failed-member holds, fresh selection after a stale preview, and the closed flag surface.

## Performance

- Duration: about 65 minutes, from the prior plan commit at 2026-09-24T02:50:03Z to the Task 2 commit at 2026-09-24T03:55:36Z.
- Tasks: 2.
- Files changed: 6, excluding this summary.
- Commits: 2, measured with `git rev-list --count 0712fccd..HEAD` after Task 2.
- Actual tokens: 7,062, measured as 28,249 committed diff characters divided by four.

## Accomplishments

- README and the dependency guide show user-default and explicit project-scope commands for actual prune and `--dry-run`. They state the same-scope orphan rule, disabled-declarer hold, explicit-install protection, fixpoint, exact actual and pending rows, informational empty result, read-only snapshot limit, and reload behavior.
- README now states that uninstall can remove a depended-on plugin and names its dependents. The guide keeps the Phase 5 `uninstall --prune` behavior, including its no-extra-output case.
- PRUNE-CMD-01 is closed. D-12-03 drops the proposed `list` and `info` orphan marker without a replacement backlog entry.
- Integration tests prove alternating marketplace order, held neighbors, failed-member retention and retry, stale-preview re-selection, no-write previews over current, legacy, and absent state, both scope orders, and rejection of extra flags. Registered-command expectations now match the shipped Plan 07 help and scanner wording.

## Task Commits

1. Task 1: `27ed83f2` (`docs: document standalone prune and close backlog item`).
2. Task 2: `f0a70143` (`test: cover standalone prune command boundaries`).

## Verification

- The focused architecture, catalog, network, register, and standalone integration suite passed across six files. The standalone integration file contains 22 passing cases.
- All 13 production TypeScript files changed since Plan 01's base passed direct source/test-pair coverage. The uninstall pair needed elevated sandbox access for its existing `mkfifo` concurrency case and passed at 125/125 branches, 28/28 functions, and 1304/1304 lines. The register pair passed at 15/15 branches, 9/9 functions, and 178/178 lines.
- The full `npm run check` passed typecheck, ESLint, positive and negative workflow gates, and Fallow. It stopped at `format:check` solely because operator-owned `.planning/config.json` fails Prettier. That file was not edited or staged by this plan. Changed-file Prettier passed.
- Each downstream gate passed when run separately: corresponding-test positive and negative controls, direct-coverage negative controls, unit coverage (7,702 tests and 100% aggregate lines, branches, and functions), integration (15/15 files), and positive and negative type-member checks. The negative type-member gate needed elevated sandbox access after `spawnSync node EPERM` and passed all seven controls.
- Task 1 and Task 2 changed-file pre-commit runs passed with only TruffleHog and the repository-wide format hook skipped. The linked checkout's TruffleHog cannot read `.git/index` as a directory; the format hook sees only the operator-owned configuration drift. Fallow `audit --base HEAD` passed with no issues before each handoff. The agent-marker audit returned a JSON temporary-worktree or rule-pack runtime error; project policy treats that error as nonblocking.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking test expectations] Updated registered prune usage and flag errors.** The existing registration test still expected Plan 07's old prune usage and `Unknown option` wording. The shipped command uses `[--dry-run]` and `Unknown flag`. The parent authorized the extra test file. Task 2 updated those exact literals in `tests/edge/register.test.ts`, then its direct pair passed at 100% in `f0a70143`.

The Task 2 work was test-only against behavior already implemented by Plans 01-07. Its new assertions passed on first execution, so there was no intentional RED failure or production GREEN change. The shared-checkout handoff used one parent-owned commit per task.

## Issues Encountered

The sandbox refused the existing unit test's `mkfifo` call and the type-member negative control's child Node process. Each passed when rerun with elevated sandbox access. The full check's remaining limit is the pre-existing formatting drift in operator-owned `.planning/config.json`.

## Next Phase Readiness

PRUNE-06, PRUNE-07, and FLAG-02 have command-level, direct-pair, architecture, and full unit and integration evidence. No implementation blocker remains. The operator-owned formatting drift remains outside this plan.

## Self-Check: PASSED

The summary and all six changed files exist. Both task commits exist, and `git rev-list` measures two commits from `plan_head_before` through Task 2. The summary passes changed-file Prettier, and no new stub or skipped test appears in the changed tests.
