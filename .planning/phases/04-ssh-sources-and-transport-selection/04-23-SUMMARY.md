---
phase: 04-ssh-sources-and-transport-selection
plan: 23
subsystem: notification
tags: [system-git, ssh, notification, clone-note, autoupdate, gap-closure]
requires:
  - phase: 04-ssh-sources-and-transport-selection
    provides: "04-19's clone member on the skipped and partially-upgradable rows; 04-15's withOwnCloneNotes views; 04-17's carriedClone / cloneNoteOf"
provides:
  - "The autoupdate seam (`beginPluginUpdateRun`'s PluginUpdateFn) clones each target over its own view of the run's transport context and returns the note of its own clone on the outcome, with each dependency row noted by its key"
  - "`PluginUpdateBase.clone`, the optional note only the autoupdate seam sets"
  - "`marketplace update`'s autoupdate rows (and the background autoupdate pass's) copy the outcome's note"
affects: [04-VERIFICATION truth 5, WINDOWS #134]
actuals:
  tokens: 6800
  tasks: 2
  commits: 2
plan_head_before: 913c3b987a7ec33612c5acf2af1cf90bd8bdfa02
plan_head_after: 21bbf2360350fbea10e74569abc3005945b30466
tech-stack:
  added: []
  patterns:
    - "carried note: the seam's outcome carries the clone note, so orchestrators/marketplace/ reads no plugin collector (04-17)"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - test/orchestrators/types.test.ts
    - test/orchestrators/marketplace/update.messaging.test.ts
    - test/orchestrators/marketplace/update.test.ts
    - features/marketplace/update.feature
key-decisions:
  - "Every autoupdate row partition copies the outcome's note (updated, partially-installed, the skipped row of an unchanged or skipped outcome, failed); the seam sets it only when the target cloned over GitHub, so a warm or current mirror names nothing (OQ-3)"
  - "The note is applied once, around runCascadeTarget, so the throw arm's failed outcome carries the attempts its clone made"
  - "convergePlugin (apply) is unchanged: apply reads its own per-call views (04-17)"
requirements-completed: [SG-SSH-04]
coverage:
  - id: D1
    description: "The autoupdate seam returns each target's own clone note, probes once per run, never lends a note across targets, and notes each dependency row by its key"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/update-flow.test.ts#D-SG-22, D-SG-19: an autoupdate run returns each github target's own clone note and probes once"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-flow.test.ts#D-SG-22, OQ-3: an autoupdate target whose mirror is warm names no clone, after the other scope's target cloned"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-flow.test.ts#D-SG-22: an autoupdate names each dependency row by the clone of its own key"
        status: pass
    human_judgment: false
  - id: D2
    description: "The marketplace update notification shows each autoupdate row's clone note, dependency rows' own notes, and both attempts of a doubly failed clone"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/update.messaging.test.ts#D-SG-22"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/update.test.ts#D-SG-22: the autoupdate cascade names each update's clone and each dependency row's own, and keeps the step's rows after them"
        status: pass
      - kind: e2e
        ref: "features/marketplace/update.feature#Updating a marketplace with autoupdate on names the clone of the github plugin its cascade updates"
        status: pass
    human_judgment: false
duration: 92min
completed: 2026-11-26
status: complete
---

# Phase 4 Plan 23: Clone notes on the autoupdate cascade rows Summary

**`marketplace update` with autoupdate on, and the background autoupdate pass that runs the same seam and composer, now name the transport of every GitHub clone a cascade plugin update runs: each target clones over its own `withOwnCloneNotes` view of the command's transport context (one probe per run, no note shared across targets or scopes), the outcome carries that note, and the marketplace row copies it (WINDOWS #134, D-SG-22).**

PLAN_BASE: `913c3b987a7ec33612c5acf2af1cf90bd8bdfa02`

## Performance

- **Duration:** about 92 min (much of it whole-suite cucumber runs)
- **Started:** 2026-11-26T19:20:32Z
- **Completed:** 2026-11-26T20:52:06Z
- **Tasks:** 2 of 2
- **Files modified:** 8

## Accomplishments

- `update-flow.ts::updateSinglePluginWith` makes `withOwnCloneNotes(runScoped.transportContext)` per target, clones over it, and wraps `runCascadeTarget`'s outcome (the throw arm included) with `withTargetCloneNotes`: `cloneNoteOf(view.notes, "<plugin>@<marketplace>")` on the outcome, and `withCloneNote(row, view.notes, row.name)` on each dependency row.
- `types.ts`: `PluginUpdateBase.clone?: CloneTransportNote` with the D-SG-22 doc (only the autoupdate seam sets it; the direct update leaves it unset).
- `marketplace/update.messaging.ts::outcomeToCascadePluginMessage`: the partition switch moved to a private `cascadeRowOf`, and the export spreads `carriedClone(outcome)` onto every row.
- `marketplace/update.ts` needed no change: it already spreads `o.dependencyRows` beside each plugin row, and the missing-dependency step's rows follow unchanged.

## Task Commits

1. **Task 1: autoupdate names the clone of the github plugin its cascade updates** (tracer) - `27dc6b2` (feat, RED and GREEN in one commit)
2. **Task 2: the cascade's rows reach the marketplace update notification with their notes** - `21bbf23` (test)

**Plan metadata:** this SUMMARY commit (docs)

Tracer gate after Task 1: `auto_advance` false, `human_verify_mode` end-of-phase, automated-only verify. Both verify commands ran again on the committed tree: the four unit files 387 of 387, the scenario 1 of 1 under adapter ("Tracer verified end-to-end -- expanding").

## TDD Gate Compliance (red runs)

RED and GREEN share the Task 1 commit because the commit hook runs typecheck and every architecture test, so a failing-test-only commit cannot pass it (the 04-08 precedent); the committing skill also forbids plan ids in commit scopes, so there is no `test(04-23):` commit. Task 2 adds tests only: its RED ran against PLAN_BASE's messaging source, and its GREEN is the Task 1 source. Records are in the ignored `.gsd/tdd-evidence/04-23/`; the entries below are the durable record.

- **RED (seam, Task 1):** `node --import scripts/isolated-pi-home.mjs --test --test-reporter=tap --test-name-pattern "an autoupdate" test/orchestrators/plugin/update-flow.test.ts` before the source change: exit 1, tests 7, pass 4, fail 3. Target `D-SG-22, D-SG-19: an autoupdate run returns each github target's own clone note and probes once`: expected each outcome's `ssh-not-configured` note with its SSH retry; actual `clone: undefined` on both, `probes: 1`. The warm-scope case expected the project outcome's `via-https` note (actual none); the dependency case expected `dep@mp`'s note on its row (actual none). Classifier: `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: each target ran, failed its clone against the unanswered base, and failed only on the missing note.
- **RED (row, Task 1):** `--test-name-pattern "D-SG-22" test/orchestrators/marketplace/update.messaging.test.ts` with `update.messaging.ts` at PLAN_BASE: exit 1, tests 6, fail 6, each `clone: undefined` where the outcome's note was expected. Classifier: `RED_EVIDENCE_OK`.
- **RED (scenario, Task 1):** with the three sources at PLAN_BASE, "Updating a marketplace with autoupdate on names the clone of the github plugin its cascade updates" failed at `the results list these marketplaces and plugins:`: the `ghp` row had no `clone note` / `clone url` cells (`via-https`, `https://github.com/acme/ghp.git` expected).
- **RED (notification, Task 2):** `--test-name-pattern "D-SG-22: (the autoupdate cascade names|a failed autoupdate whose clone)" test/orchestrators/marketplace/update.test.ts` with `update.messaging.ts` at PLAN_BASE: exit 1, tests 2, fail 2. The `alpha` row lacked `Cloning via HTTPS: https://github.com/acme/alpha.git`, and the failed `beta` row lacked its two clone lines; the dependency row's own note already rendered. Classifier: `RED_EVIDENCE_OK`.
- **GREEN:** all of the above pass. Direct coverage 100%: `update-flow.ts` (branches 261/261, functions 57/57, lines 1841/1841), `update.messaging.ts` (32/32, 10/10, 305/305), `types.ts` (type-only, passed).

## New and re-baselined scenarios

New: `features/marketplace/update.feature`, "Updating a marketplace with autoupdate on names the clone of the github plugin its cascade updates" (the shared Pi's base override gives `via-https` with `https://github.com/acme/ghp.git`).

Re-baselined: none. No scenario outside this plan's feature file changed: the whole adapter run showed no difference beyond the known baselines and two load flakes that pass alone (below).

Rebaseline audit: `git diff -U0 913c3b9..HEAD -- features` filtered with `grep '^[-+][^-+]' | grep -v -i 'clone\|Cloning via\|retrying with\|SSH not configured'` prints only added lines of the new scenario (its steps, its tables, and its data row). No removed line.

## Suite counts (final tree, `env -u GIT_CONFIG_COUNT`, `CI=1`)

- `npm run check:static`: passed (typecheck, lint, fallow, Prettier, test:corresponding, check:features with 2510 scenarios and 510 step definitions).
- `npm run test:modules`: 20047 of 20047 passed (`dispatch-exec.test.ts:39` passed too).
- `npm run test:integration`: 236 of 236 passed.
- Cucumber, adapter, whole suite: 2401 scenarios, 2394 passed, 7 failed: the 5 known `fd` baselines of `features/hook/tool-use.feature` (lines 296, 355, 443, 1696, 1834), plus `features/marketplace/usage-errors.feature:108` (a `Before` hook `ENOTEMPTY` while removing its temp project directory) and `features/hook/async.feature:261` (a late async context line). Both passed when re-run alone (the usage-errors file 9 of 9, the async scenario 1 of 1); neither touches clone notes.
- Cucumber, builtin, whole suite: 260 of 260 scenarios (3576 steps).
- The commit hook (`check:commit`) passed on both commits. `npm run check` was not run: the orchestrator reserves it for the wave gate.

## Files Created/Modified

- `orchestrators/plugin/update-flow.ts`: per-target view in `updateSinglePluginWith`, `withTargetCloneNotes`.
- `orchestrators/types.ts`: `PluginUpdateBase.clone`.
- `orchestrators/marketplace/update.messaging.ts`: the row copies the outcome's note.
- Tests: `update-flow.test.ts` (3 cases), `types.test.ts` (2 compile checks), `update.messaging.test.ts` (6 cases), `update.test.ts` (2 cases).
- `features/marketplace/update.feature`: the new scenario.

No file outside `files_modified` was touched.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

None in the source or tests. One process note: running the scenario needed the optional-peer test cache, which this new worktree lacked, so `node scripts/install-test-peers.mjs` (the project's own step that `test:integration` and `test:cucumber` run) installed the declared floors into `node_modules/.cache/optional-peers`. No dependency or lockfile changed.

**Total deviations:** 0.

## Issues Encountered

- The kernel killed a process for memory once during the first scenario run while four executors shared the machine; the run itself passed.
- Two adapter scenarios flaked under load (see Suite counts) and passed alone.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-70: each target clones over its own `withOwnCloneNotes` view, so a row never reads another target's or scope's note (pinned by the warm-scope unit case); notes are redacted where `recordNote` makes them. T-04-71: the member is optional and only the autoupdate seam sets it; the direct update's composer still reads its own notes. T-04-SC: no package added.

## Orchestrator actions

- The plan asks for no `gsd-tools windows append`. WINDOWS #134 (the autoupdate cascade rows) is closed in code by `27dc6b2`; resolving the ledger entry is the orchestrator's call.

## User Setup Required

None.

## Next Phase Readiness

Ready for the wave gate (`npm run check` on the merged tree). The 04-22 direct-update and reinstall composers read the command's notes, never `outcome.clone`, so merge order does not matter (the plan's `coupling_justified`).

## Self-Check: PASSED

- Files: all eight `key-files.modified` exist.
- Commits: `27dc6b2` and `21bbf23` are ancestors of HEAD.
- Acceptance: `grep -c 'names the clone of the github plugin its cascade updates' features/marketplace/update.feature` = 1; `grep -c 'CloneTransportNote\|CloneNoted' orchestrators/types.ts` = 2; direct coverage 100% for the three sources; the scenario and the noted-outcome case fail on PLAN_BASE's sources and pass after; the rebaseline audit prints only the new scenario's lines.

---
*Phase: 04-ssh-sources-and-transport-selection*
*Completed: 2026-11-26*
