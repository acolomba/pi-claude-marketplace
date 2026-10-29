---
phase: 01-staging-warning-channels
plan: 05
subsystem: staging-warnings
status: complete
tags: [warnings, enable, diagnostics, orchestrated-outcome, cucumber]
requires:
  - "01-01: features/plugin/staging-warnings.feature and its colliding-skill Given step"
  - "01-02: surfaceStagingDiagnostics / surfaceDiscoveryWarnings (verb union includes `enabled`), InstallLedgerSummary.discoveryWarnings / bridgeWarnings"
provides:
  - "A standalone enable renders its root's discovery warnings after the enable row and before the MCP config notices (D-PL1-12, D-PL1-07)"
  - "EnableDisablePluginOutcome `enabled` arm: `readonly stagingWarnings?: readonly StagingWarning[]` (both halves, omitted when empty) for apply to consume (D-PL1-12, D-PL1-09)"
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - "01-07 (apply renders the enable carrier)"
tech-stack:
  added: []
  patterns:
    - "The MCP notice sink carries the root's staging warnings beside the notices"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - test/orchestrators/plugin/enable-disable.test.ts
    - features/plugin/staging-warnings.feature
key-decisions:
  - "The standalone render helper calls `surfaceStagingDiagnostics` with one entry. That function is the D-PL1-07 placement renderer, and it sends only the discovery half through `surfaceDiscoveryWarnings`. So the enable path needs no partition call of its own."
  - "`assertRootMaterialized` now also narrows `rootStagingWarnings` to defined. The root phase sets it beside `root`, so the `ok` arm passes it without a `?? []` fallback, a branch that no test could reach."
requirements-completed: [WRN-01]
metrics:
  duration: "~45m"
  completed: "2026-10-27"
estimate:
  tokens: 85000
  tasks: 2
actuals:
  tokens: 6600
  tasks: 2
  commits: 2
plan_head_before: 320e4495d6ec6e1b1f0eb8b5d33a3acb8ad7ce35
plan_head_after: 41f39739cf0978aa887a8df0232c9ea05bb329ea
commits: 2
---

# Phase 1 Plan 05: Enable reports its staging warnings Summary

`/claude:plugin enable` now shows the same skip lines that `install` shows for
a plugin whose components collide. The lines come under the header
`Plugin "<name>" [<scope>] enabled; 1 declared component has a note.`, after
the enable row and before any MCP config notice. The orchestrated `enabled`
outcome carries both halves of the root's staging warnings for `apply`.
Only the enable root reports. Re-enabled dependencies and failed enables
report nothing.

## Tasks

| Task | Name | Commit | Hook |
| ---- | ---- | ------ | ---- |
| 1 | Show the staging warnings of a standalone enable | 97fde69d | TruffleHog, prettier, `npm run check:commit`, gitlint: all Passed (first attempt) |
| 2 | Carry the enable root's staging warnings on the orchestrated outcome | 41f39739 | First attempt: `npm run check:commit` Failed with "files were modified by this hook". Every check inside it had passed, and the modified files were plan 01-04's concurrent `reinstall-flow.*` edits. Retry: TruffleHog, prettier, `npm run check:commit`, gitlint all Passed |

`git show --stat 97fde69d 41f39739` lists no change to
`orchestrators/plugin/install-outcome.ts` (D-PL1-23).

### Task 1 (D-PL1-12, D-PL1-07)

- `McpConfigNoticeSink` gains `stagingWarnings?`, and its doc says what it
  holds. `MaterializedEnableRoot` gains `stagingWarnings`, and
  `materializeEnableRoot` returns
  `[...summary.discoveryWarnings, ...summary.bridgeWarnings]`.
- `runEnableBranch` (orchestrated enable) sets `sink.stagingWarnings` at the
  point where it sets the MCP notices.
- `EnableCascadeRun.rootStagingWarnings?` is set by `buildEnableRootPhase`
  beside `run.root`. The member-phase builder's accumulator literal is
  unchanged. `runEnableCascadeWithRoot` returns the slot on its `ok` arm.
  `runFreshEnableCascadeWithRoot` copies it to the sink only after the
  `!merged.ok` return.
- New `surfaceEnableStagingWarnings` renders with verb `enabled` and the
  resolved scope, and only for an enable whose outcome is `fresh`. It is
  called in `runSetEnabledOutcome` between `dispatchOutcome` and
  `notifyMcpConfigNotices`, so `runSetEnabledOutcome` gains no branch.
- New scenario: "Enabling a plugin whose skills collide reports the skip
  install reports, under a header that names the scope".
- New unit cases (hermetic homes, whole notify sequence, literal bytes):
  - the colliding root gives the row, then the redacted diagnostic, then the
    comments-dropped MCP notice;
  - a hygiene-only enable (an agent with a dropped tool) gives the row only;
  - a config-write failure after the root committed gives the failed row
    only;
  - a re-enabled dependency `b` whose skills collide gives the cascade row
    only.

### Task 2 (D-PL1-12, D-PL1-09, NREG-01)

- The `enabled` arm of `EnableDisablePluginOutcome` gains
  `readonly stagingWarnings?: readonly StagingWarning[];` with its doc.
- `outcomeToTypedResult` takes `stagingWarnings` (the caller passes
  `sink.stagingWarnings ?? []`). Its `case "fresh"` passes them to
  `freshOutcomeToTypedResult`, which spreads them on the `enabled` return only,
  through the small `stagingWarningsMember` helper.
- New unit cases, each comparing the whole outcome:
  - an orchestrated enable with a skill collision and an agent dropped-tool
    note carries `[discovery, hygiene]` and sends no notification;
  - an orchestrated enable with no warnings has no `stagingWarnings` key;
  - an orchestrated disable of a plugin whose skills collide has no
    `stagingWarnings` key;
  - an orchestrated enable whose save throws after the root's ledger filled
    the sink returns a `failed` outcome with no `stagingWarnings` key and
    sends no notification.

## Scenario failure before the change

On the unchanged code, the new scenario failed at
`the command reports these results:`. The command emitted only the `cascade`
payload, and no `diagnostic` payload followed the enable row. After Task 1 it
passes.

## Verification

- `npm run typecheck`: no error in this plan's files. During the run, the
  only errors were plan 01-04's in-progress `resourcesChanged` literals in
  its own files. The commit hooks ran typecheck on the stashed tree, and it
  passed for both commits.
- `node --test test/orchestrators/plugin/enable-disable.test.ts`: 183 pass,
  0 fail (8 new D-PL1-12 cases).
- `npm run test:coverage:direct -- .../enable-disable.ts`: exit 0 (100%)
  after each task.
- `npx cucumber-js` over `staging-warnings.feature`, `enable.feature` and
  the `apply*` features: 52 scenarios, 748 steps passed.
  `npm run check:features`: exit 0.
- `npm run fallow`: exit 0 after each task. ESLint on both touched files:
  exit 0.
- Consumers of the outcome type (`import/execute`, `install-flow`,
  `operations`, `reconcile/apply` unit tests, and the four integration tests
  that drive enable): all pass.
- Mutation check (Task 1): making the helper render hygiene warnings too
  fails the hygiene-only case, so that case tests something real.
- Acceptance greps: `verb: "enabled"` 1, and
  `readonly stagingWarnings?: readonly StagingWarning[];` 2 (one in the
  outcome arm, one in the `stagingWarningsMember` return type).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] One existing orchestrated enable case pinned the old outcome shape**

- **Found during:** Task 2
- **Issue:** `orchestrated enable returns every live degradation and
  companion signal without writing config` seeds an agent with no
  description. Its root's ledger yields the hygiene note `[helper] source
  description was missing or empty -- using fallback`. The outcome now
  carries that note as D-PL1-12 requires, so the case's full-outcome
  comparison failed.
- **Fix:** The expected outcome now includes that hygiene warning.
- **Commit:** 41f39739

### Plan notes

- The plan named `surfaceDiscoveryWarnings` plus the discovery half. The
  helper calls `surfaceStagingDiagnostics`, which does both steps (see
  key-decisions).
- `assertRootMaterialized` is outside the plan's list of functions. Only
  its narrowed type changed, to drop a branch that no test could cover.
- The plan's third Task 1 case says the sink "holds the root's warnings" on
  an `enable-failed` outcome. On the standalone merged path that cannot
  happen: the sink is filled only after the merged ledger succeeds. So that
  case shows the end result (no diagnostic), and the `fresh` guard in the
  helper is a second safety check. The Task 2 save-failure case covers a
  sink that really does hold warnings on a non-`enabled` outcome.
- `writeToolDroppingAgent` (a Task 1 test helper) gained a `description` in
  Task 2, so the agent produces exactly one hygiene line.
- Commit count: four commits landed between `plan_head_before` and
  `plan_head_after`. Two of them (ba532015 and 2236b1c0) belong to plan
  01-04, which ran in the same worktree. This plan's commits are 97fde69d
  and 41f39739.

### Shared-worktree note

While Task 2 was being edited, plan 01-04's `git commit` stashed this
plan's unstaged edits for the length of its hook. Pre-commit restored them
when it finished, and nothing was lost. Backups of each edit are in the
scratchpad (`01-05-task*-*`).

## Backlog dispositions

- **ENWARN-01:** closed by D-PL1-12. A standalone enable shows its root's
  discovery warnings, and the orchestrated `enabled` outcome carries both
  halves for `apply` (plan 01-07).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-09 holds: the enable diagnostic goes only through
`surfaceStagingDiagnostics` -> `surfaceDiscoveryWarnings`, which redacts
absolute paths (NFR-9) and accepts discovery warnings only. The unit case
asserts the redacted `in "skills"` bytes. The orchestrated carrier holds the
raw messages, as the update carrier does, and a renderer redacts them.
T-01-10 holds: only `buildEnableRootPhase` writes the root slot, and the
dependency-member case asserts that no diagnostic is shown. T-01-11 holds:
the merged path copies warnings only on its `ok` branch, and the helper
renders only a `fresh` outcome.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
- FOUND: test/orchestrators/plugin/enable-disable.test.ts
- FOUND: features/plugin/staging-warnings.feature
- FOUND: 97fde69d (ancestor of HEAD)
- FOUND: 41f39739 (ancestor of HEAD)
