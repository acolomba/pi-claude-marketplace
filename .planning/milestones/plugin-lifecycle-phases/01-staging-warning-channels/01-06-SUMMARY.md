---
phase: 01-staging-warning-channels
plan: 06
subsystem: staging-warnings
status: complete
tags: [warnings, install, update, reinstall, failure-path, diagnostics, cucumber]
requires:
  - "01-01: features/plugin/staging-warnings.feature and its colliding-skill Given step"
  - "01-02: surfaceStagingDiagnostics / surfaceDiscoveryWarnings (verb union includes the three `... failed` verbs), the typed update and reinstall carriers"
  - "01-04: resourcesChanged on the update and reinstall outcomes (literals this plan's tests extend)"
  - "01-05: the enable carrier (no overlap; listed for the wave order)"
provides:
  - "InstallFailureCapture.stagingWarnings (optional, both halves), set on a runPhases failure (D-PL1-13)"
  - "A standalone install failure renders `Plugin \"<name>\" [<scope>] install failed; ...` after the failed row; a dependency's failure and an orchestrated failure render nothing (D-PL1-24)"
  - "ThreePhaseArgsBase.onStagingWarnings; CandidateReport.stagingWarnings; recordCandidate wires it; reportedStagingWarnings(report) builds the failed-outcome member (D-PL1-14, D-PL1-24)"
  - "PluginUpdateFailedOutcome.stagingWarnings (optional): phase-3 failure, swapAfterSettle failure, cascade target throw (D-PL1-10, D-PL1-14)"
  - "A direct update abort renders only the failed target's `update failed` diagnostic; a failed outcome the batch keeps renders after the cascade (D-PL1-22)"
  - "ReinstallFailedOutcome.discoveryWarnings (optional); the reinstall command renders `reinstall failed` diagnostics in row order (D-PL1-11, D-PL1-14)"
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - "01-07 (apply / import read the failed-arm carriers)"
tech-stack:
  added: []
  patterns:
    - "A per-target report holder (CandidateReport) carries warnings across a thrown error to the catch site that builds the failed outcome"
    - "The swap reports only a non-empty warning set, so the holder key stays absent when there is nothing (NREG-01)"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/orchestrators/plugin/install-flow.test.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - test/orchestrators/plugin/materialize-latest.test.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - test/orchestrators/plugin/reinstall-record.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - features/plugin/staging-warnings.feature
key-decisions:
  - "The swap's onStagingWarnings fires only for a non-empty set. Reporting an empty array would have put `stagingWarnings: []` on every CandidateReport, which broke the existing UPR-03 whole-report case and contradicts NREG-01. So `reportedStagingWarnings` only checks for `undefined`."
  - "swapAfterSettle writes into its own local CandidateReport and still forwards to the caller's callback, so both its own failed outcome and the caller's holder see the warnings."
  - "The install failure renders through `surfaceStagingDiagnostics`. It passes the whole capture, and that renderer keeps only the discovery half."
  - "The direct abort passes the failed target's diagnostic to `abortUpdateBatch` as a new positional `failedDiagnostics` array, placed before the optional phase-3 `failed` argument. The syncClone abort passes `[]`."
requirements-completed: [WRN-04]
metrics:
  duration: "~1h30m"
  completed: "2026-10-27"
estimate:
  tokens: 140000
  tasks: 3
actuals:
  tokens: 17000
  tasks: 3
  commits: 3
commits: 3
plan_head_before: 4016bba4edab7e1879766ee41be1504f3524a8ef
plan_head_after: 3356955fb85266c38592630e5a1631dce0bd062f
---

# Phase 1 Plan 06: Failure-path staging warnings Summary

A failed install, update, or reinstall now reports the skip lines that its
earlier phases collected. Before this plan, the failure threw those lines away
together with the ledger context or the prepared handles. Each verb shows the
diagnostic after its failed row and before its MCP config notices. The header
is `Plugin "<name>" [<scope>] install failed; ...` (or `update failed` /
`reinstall failed`). Orchestrated outcomes carry the tagged warnings for
`apply` and `import`, except a failed install, which belongs to a later phase.

## Tasks

| Task | Name | Commit | Hook |
| ---- | ---- | ------ | ---- |
| 1 | Show a failed install's staging warnings after its failed row | cd02a3e5 | TruffleHog, prettier, `npm run check:commit`, gitlint: all Passed (first attempt) |
| 2 | Show a failed update's staging warnings after its failed row | 6bc5603f | TruffleHog, prettier, `npm run check:commit`, gitlint: all Passed (first attempt) |
| 3 | Show a failed reinstall's staging warnings after its cascade | 3356955f | TruffleHog, prettier, `npm run check:commit`, gitlint: all Passed (first attempt) |

### Task 1 (D-PL1-13, D-PL1-24, D-PL1-07)

- `InstallFailureCapture` gains `stagingWarnings?` and a doc comment. The
  `runPhases` failure block in `runInstallLedgerBody` calls the new
  `captureStagingWarnings(capture, ctxLocal)`. That function sets
  `[...discoveryWarnings, ...bridgeWarnings]` only when the list is not
  empty, so every existing whole-capture expectation stays the same.
- After the failed row in its standalone branch, `handleInstallThrow` calls
  `surfaceStagingDiagnostics` with `verb: "install failed"`.
  `handleCascadeThrow` and the orchestrated branch are unchanged.
- Unit cases (hermetic):
  - The capture holds `[discovery, hygiene]` when the mcp phase fails after
    the agents phase.
  - The capture keeps only `{ rollbackPartials, version }` when no warning
    was collected.
  - A standalone failure gives the failed row, then the redacted diagnostic.
    The cause line uses the runtime's own EISDIR wording, read back from the
    runtime, so the Node 24 CI and local Node 26 agree.
  - An orchestrated failure sends nothing and has no `stagingWarnings` key.
  - A dependency whose skills collide and whose mcp phase fails gives the
    cascade block only.
- Mutation check: I made the cascade path render the capture for a short
  time. The dependency case then failed with the
  `some-other-plugin-tool` skip under `"hello"`. So that fixture really
  collects a warning.

### Task 2 (D-PL1-10, D-PL1-14, D-PL1-22, D-PL1-24)

- `orchestrators/types.ts`: `PluginUpdateFailedOutcome.stagingWarnings?`.
- `update-swap.ts`:
  - `ThreePhaseArgsBase.onStagingWarnings?`.
  - `collectUpdateWarnings` now takes `Partial<PrepHandles>`. It uses
    `flatMap` over the five handles in bridge order, so it adds no branch.
  - The new `reportStagingWarnings(args, handles)` is called from the
    `prepareUpdateHandles` catch before the rethrow, and once in
    `swapPluginUpdate` right after `prepareUpdateHandles` returns. That
    second call is outside the intent-mark `try` block, which stayed
    untouched.
  - `composePhase3FailureOutcome` takes the handles' warnings and spreads
    them when the list is not empty.
- `materialize-latest.ts`:
  - `CandidateReport.stagingWarnings?`. `recordCandidate` also returns
    `onStagingWarnings`.
  - The new exported `reportedStagingWarnings(report)` returns the
    failed-outcome member.
  - `swapAfterSettle` runs the swap with
    `forwardingStagingWarnings(args, report)`, and its catch spreads the
    member.
- `update-flow.ts`:
  - `updateStagingDiagnostic` (the helper of `surfaceUpdateDiscoveryWarnings`)
    now also maps `failed` outcomes through the new
    `updateFailedDiagnostic`. That helper holds the one
    `verb: "update failed"` literal.
  - `abortUpdateBatch` takes `failedDiagnostics` and renders them between
    the cascade and the MCP notices. Its three calls pass `[]` (syncClone),
    the report's diagnostic (thrown), and the aggregate's diagnostic
    (phase 3).
  - `runCascadeTarget` omits `onStagingWarnings` from its parameter type.
    It spreads `reportedStagingWarnings(report)` over
    `cascadeFailureOutcome(...)`, and `cascadeFailureOutcome` itself is
    unchanged.
- Unit cases (hermetic):
  - update-swap:
    - A prepare that throws in its mcp step reports `[skills discovery,
      agents hygiene]` once.
    - An agent-target refusal after a full prepare reports once.
    - A phase-3 workflows refusal returns a whole failed outcome that
      carries both halves.
  - materialize-latest:
    - The report holds the warnings after a swap.
    - A post-settle save failure carries the warnings on its whole failed
      outcome and forwards them to the caller's holder.
    - A post-settle PI-6 refusal before any prepare carries none.
  - update-flow (whole notify sequences):
    - `aaa` (colliding skills, updated) and then `zzz` (prepare throws):
      zzz's failed row, then aaa's cascade, then only zzz's
      `update failed` diagnostic (D-PL1-22).
    - The phase-3 abort: the same order, with UUIDs normalized.
    - A kept `failed` outcome from a post-settle save failure: the cascade,
      then the `update failed` diagnostic.
    - A cascade target's prepare throw returns a whole failed outcome that
      carries `stagingWarnings`.

### Task 3 (D-PL1-11, D-PL1-14)

- `ReinstallFailedOutcome` gains
  `readonly discoveryWarnings?: readonly DiscoveryWarning[];`.
- `reinstall-record.ts`: the new exported `discoveryWarningsMember(warnings)`
  takes the discovery half and leaves the key out when that half is empty.
  `reinstallOutcomeFromRun`'s `failed` arm spreads it from
  `run.stagingWarnings`.
- `reinstall-flow.ts`:
  - `failReinstall` now takes the per-call `CandidateReport`, not only its
    move, and spreads `discoveryWarningsMember(candidate.stagingWarnings)`.
  - `reinstallStagingDiagnostic` (the helper of
    `surfaceReinstallDiscoveryWarnings`) maps `failed` outcomes with
    `verb: "reinstall failed"`.
- Unit cases:
  - A failed run with both halves carries only the discovery one.
  - A hygiene-only failed run carries no key.
  - A reinstall whose mcp prepare throws carries the discovery half and
    sends nothing under `render: "none"`.
  - A bulk reinstall gives the cascade, then aaa's `reinstalled` diagnostic,
    then zzz's `reinstall failed` diagnostic, in row order.

## Scenario failures before each change

All three scenarios are in `features/plugin/staging-warnings.feature`.

- **Install** ("An install that fails in its mcp phase reports the skill the
  skills phase skipped after the failed row"): on the unchanged code it
  failed at `the command reports these results:`. Only the `cascade` payload
  came out, and no `diagnostic` row followed it. It passes after Task 1.
- **Update** ("An update that fails in its mcp phase ..."): I ran it with
  the four Task 2 sources put back to their HEAD bytes (my edits were backed
  up in the scratchpad and restored per file). It failed at the same step,
  with the same missing `diagnostic` row. It passes after Task 2.
- **Reinstall** ("A reinstall that fails in its mcp phase ..."): on the
  unchanged code it failed at the same step, again with no `diagnostic`
  row. It passes after Task 3.

## Verification

- `npm run typecheck`: exit 0 after each task.
- Owner tests: Task 1 had 375 passing in install-outcome and install-flow.
  Task 2 had 553 passing in types, update-swap, materialize-latest and
  update-flow. Task 3 had 193 passing in types, reinstall-record and
  reinstall-flow. None failed.
- `npm run test:coverage:direct`: exit 0 (100%) for every touched source:
  install-outcome, install-flow, update-swap, materialize-latest,
  update-flow, reinstall-record and reinstall-flow.
- `node --test "test/orchestrators/**/*.test.ts" "test/edge/**/*.test.ts"`:
  6269 pass, 0 fail.
- `npm run test:integration`: exit 0.
- `npx cucumber-js` (full suite): 908 scenarios, 9058 steps passed.
  `staging-warnings.feature` has 7 scenarios, and all pass.
  `npm run check:features`: exit 0.
- `npm run fallow`: exit 0 after each task (dead code, cycles, health,
  dupes). ESLint on every touched file: exit 0.
- Acceptance greps:
  - `verb: "install failed"` in install-flow.ts: 1.
  - `surfaceDiscoveryWarnings` inside `handleCascadeThrow`: 0.
  - `onStagingWarnings`: 3 in update-swap.ts and 4 in materialize-latest.ts.
  - `stagingWarnings` inside `cascadeFailureOutcome`: 0.
  - `verb: "update failed"` in update-flow.ts: 1.
  - `verb: "reinstall failed"` in reinstall-flow.ts: 1.
  - The `ReinstallFailedOutcome` member line: 1.
- The full `npm run check` was not run. The wave gate owns it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] An empty report would have changed the existing CandidateReport shape**

- **Found during:** Task 2
- **Issue:** At first the swap reported every time, even with no warnings.
  So `report.stagingWarnings` became `[]` for every clean swap, and the
  existing `UPR-03: a candidate report holds the whole move ...` case failed
  its whole-report comparison.
- **Fix:** `reportStagingWarnings` now calls the callback only when the set
  is not empty (NREG-01), and the `ThreePhaseArgsBase` doc says so. Because
  a report is never empty, `reportedStagingWarnings` checks only for
  `undefined`.
- **Files modified:** update-swap.ts, materialize-latest.ts
- **Commit:** 6bc5603f

**2. [Rule 3 - Blocking] `switch-exhaustiveness-check` rejected a `default` arm**

- **Found during:** Task 2
- **Issue:** `updateStagingDiagnostic`'s switch used `default:`, and the
  ESLint `@typescript-eslint/switch-exhaustiveness-check` rule failed it.
- **Fix:** I replaced `default:` with explicit `case "skipped": case "unchanged":`
  arms.
- **Commit:** 6bc5603f

### Plan notes

- **Functions outside the plan's lists.**
  - `updateStagingDiagnostic` (update-flow.ts) and `reinstallStagingDiagnostic`
    (reinstall-flow.ts) changed. They are the one-line helpers that
    `surfaceUpdateDiscoveryWarnings` and `surfaceReinstallDiscoveryWarnings`
    call, so the change in those two named functions lives there.
  - New helpers were added: `captureStagingWarnings`, `reportStagingWarnings`,
    `reportedStagingWarnings`, `forwardingStagingWarnings`,
    `updateFailedDiagnostic` and `discoveryWarningsMember`. Each keeps new
    branches out of the functions that are near the complexity ceiling.
- **Rendering placement.** The direct update's thrown-failure row comes from
  `notifyDirectFailure` before `abortUpdateBatch`. So the order is: failed
  row, then the earlier targets' cascade, then the failed target's
  diagnostic, then the MCP notices. This is the order the plan describes:
  the diagnostic comes after the cascade of the earlier outcomes.
- **The reinstall failed row has no cause chain.** The reinstall scenario's
  rows table lists `leaks` and `rollback partial` but no `cause chain`,
  because the reinstall failed row keeps its error text in `notes` only.
  That behavior predates this plan.
- **The update scenario's before-run.** For Task 2, the scenario's failure
  was seen with the HEAD sources put back temporarily, not before the edits.
  The edits were already in place when I wrote the scenario. The failure it
  showed is the same one the plan expects.

## Backlog dispositions

- **WARN-01:** closed by D-PL1-13 (install capture and the standalone
  `install failed` diagnostic) and D-PL1-14 (the update and reinstall report
  holder, the phase-3 carrier, and the `update failed` / `reinstall failed`
  diagnostics).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- **T-01-12 holds.** Every new render goes through `surfaceStagingDiagnostics`
  and then `surfaceDiscoveryWarnings`. That path redacts absolute paths
  (NFR-9) and shows the discovery half only. Every unit case and scenario
  asserts the redacted `in "skills"` bytes.
- **T-01-13 holds.** The install diagnostic renders only in
  `handleInstallThrow`'s standalone branch. The `handleCascadeThrow` grep
  reads 0, and the dependency case (mutation-checked) asserts the cascade
  block only.
- **T-01-14 holds.** Each catch site still creates one `CandidateReport` per
  target, and `swapAfterSettle` creates its own as well. The D-PL1-22 case
  asserts that the earlier `aaa`, whose skills also collide, renders no
  diagnostic.

## Self-Check: PASSED

- FOUND: every file in key-files.modified
- FOUND: cd02a3e5, 6bc5603f, 3356955f (ancestors of HEAD)
