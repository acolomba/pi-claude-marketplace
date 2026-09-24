---
phase: 104-workflow-lifecycle-completion
plan: 03
subsystem: bridges
tags: [workflows, install-ledger, ownership-refusal, enable-disable, typed-errors]

# Dependency graph
requires:
  - phase: 104-workflow-lifecycle-completion
    provides: tests/helpers/workflow-home.ts (withHermeticWorkflowHome), the sixth cascade slot that makes disable remove envelopes
  - phase: 103-workflow-artifact-materialization
    provides: prepareStageWorkflows/commitPreparedWorkflows, previousWorkflowNames as a declared but unsupplied parameter
provides:
  - previousWorkflowNames supplied from the install ledger's state snapshot — the first production supplier of the re-stage branch
  - WorkflowTargetOccupiedError + isWorkflowTargetOccupiedError — the WR-06 refusal as a typed, cause-walkable error
  - the commit's pre-rename occupancy pass, which makes "a refusal placed nothing" a provable fact
affects: [104-04, 104-05, 104-06]

actuals:
  tokens: 8900
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - A commit that can refuse checks the whole target set before its first mutation, so the caller can reason about what was placed
    - A typed refusal the caller must act on is recognised through a cause-walking predicate, not a bare instanceof, because leak wrappers re-wrap it

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
    - extensions/pi-claude-marketplace/shared/errors-bridges.ts
    - tests/bridges/workflows/stage.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/install-workflows.test.ts

key-decisions:
  - "The refusal is a single arm, not the sibling bridges' three-arm owned/orphan/foreign policy. `displacePreviousTargets` has already moved every owned target aside, so the owned and orphan arms are unreachable on this path."
  - "The occupancy check runs over the WHOLE rename set before the first rename, not per iteration. Per-iteration is equivalent for the refusal itself but not for the caller: only the up-front pass makes 'a refusal completed zero renames' provable, which is what lets the ledger drop its removal payload safely."
  - "The ledger drops its removal payload on the refusal and ONLY on the refusal. Every other commit failure keeps it, because those can leave a committed envelope at its target when the commit's own reversal loop leaks."
  - "`WorkflowTargetOccupiedError` is recognised through `isWorkflowTargetOccupiedError`, which walks `Error.cause`. `appendLeaks` re-wraps in a plain Error when a cleanup leak occurs, and that double-fault case is exactly where a wrong answer deletes a user's file."

patterns-established:
  - "Enable-convergence proof: plant the old envelope back at its recorded path before the enable, or the remove half of a rename is unobservable and the case passes with the previous-name list unwired."
  - "A workflow fixture that drives the REAL install ledger, then setPluginEnabled, so the recorded inventory under test is the one production writes."

requirements-completed: [WLIF-05, WLIF-02]

coverage:
  - id: D1
    description: "The install ledger supplies the pre-existing record's `resources.workflows` as the previous-name list, so the bridge's re-stage branch is reachable, while a fresh install supplies nothing and is byte-unchanged."
    requirement: "WLIF-05"
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/enable-disable.test.ts — 'WLIF-05: enable converges when re-materialization produces a different generated name' (fails without the supply: the old envelope survives)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-workflows.test.ts — all 12 cases pass unchanged in meaning; a fresh install still creates no storage root and stages the same names"
        status: pass
    human_judgment: false
  - id: D2
    description: "A pre-existing target this plugin does not own is refused with the path named, and the refusal routes through the existing rollback so displaced envelopes are restored."
    requirement: "WLIF-05"
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts — 'WR-06 refuses a pre-existing target this plugin does not own, naming the path' (asserts /non-previous content/, the path, and byte-identical foreign content)"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts — 'WR-06 a refusal mid-loop restores every displaced previous envelope'"
        status: pass
    human_judgment: false
  - id: D3
    description: "A target named in the previous list is replaced successfully — the refusal does not reject the plugin's own re-materialization."
    requirement: "WLIF-05"
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/stage.test.ts — 'WR-01 / WLIF-05 replaces a target named in the previous list'"
        status: pass
    human_judgment: false
  - id: D4
    description: "disable removes the envelopes while the kept record still names them, and enable puts them back and names them again."
    requirement: "WLIF-05"
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/enable-disable.test.ts — 'WLIF-05: disable removes the plugin's workflow envelopes and enable puts them back' (real installPlugin, non-vacuity assertion before the disable)"
        status: pass
    human_judgment: false
  - id: D5
    description: "enable converges when re-materialization produces a DIFFERENT generated name: the new name is written and no envelope survives under the old one."
    requirement: "WLIF-05"
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/enable-disable.test.ts — the rename case asserts BOTH halves, with the old envelope planted back so the remove half is observable"
        status: pass
    human_judgment: false
  - id: D6
    description: "A disabled record whose `resources.workflows` is empty re-enables with no displacement, no refusal and no error."
    requirement: "WLIF-05"
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/enable-disable.test.ts — 'WLIF-05: a disabled record with an empty workflow inventory enables cleanly' (orchestrated outcome asserts status 'enabled')"
        status: pass
    human_judgment: false
  - id: D7
    description: "An envelope the record does not name is refused rather than clobbered, and the ledger's undo does not delete it either."
    requirement: "WLIF-05"
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/enable-disable.test.ts — 'WR-06 / WLIF-05: enable refuses an envelope the record does not name rather than clobbering it' (typed outcome, path in the message, bytes unchanged, record still disabled)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-workflows.test.ts — 'WLIF-01 / WR-06 a refused workflows commit drops the removal payload instead of unlinking the occupant'"
        status: pass
    human_judgment: false
  - id: D8
    description: "The recorded-name versus regenerated-name comparison is exact string equality — no normalization, no case folding."
    requirement: "WLIF-05"
    verification:
      - kind: other
        ref: "code inspection: `displacePreviousTargets` iterates `_previousNames` and joins each verbatim; the occupancy pass compares paths, not names. No Intl, localeCompare, normalize or toLowerCase appears on either side."
        status: pass
    human_judgment: false
  - id: D9
    description: "A successful disable preserves `resources.workflows` wholesale and in order, and that array is what enable reads back."
    requirement: "WLIF-05"
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/enable-disable.test.ts — the round-trip case asserts the disabled record's array by deepEqual, then that the enable materializes exactly it"
        status: pass
    human_judgment: false

# Metrics
duration: 55min
completed: 2026-08-15
status: complete
---

# Phase 104 Plan 03: Recorded inventory and the ownership refusal Summary

**`previousWorkflowNames` finally has a production supplier, so the bridge's re-stage branch runs for the first time — and in the same commit a workflow commit stopped renaming over content the plugin does not own.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2
- **Commits:** 4
- **Files modified:** 6 (0 created)

## Accomplishments

- **The dead parameter is alive.** The install ledger's workflows phase reads `c.stateSnapshot.marketplaces[..].plugins[..]?.resources.workflows` — the same shape the state phase already uses — and spreads it into `prepareStageWorkflows`. A fresh install has no record, so the value is absent and behavior is byte-identical to before; the `enable` path reaches the deliberately-kept disabled record, which is the only thing naming what the disable removed.
- **The shared directory is defended.** `commitPreparedWorkflows` refuses a target path still occupied after the displacement, naming the path. One arm, not the sibling bridges' three: `displacePreviousTargets` has already moved every owned target aside, so anything left is foreign by construction and the owned/orphan arms are unreachable.
- **Both halves are one commit,** per the ordering constraint. Split, they would trade a silent overwrite for a broken `enable` — with the previous-name list always empty, the refusal would reject every re-materialization of a plugin's own envelopes.
- **`enable` converges on a changed name.** When the plugin's script declares a different name between disable and enable, the run is an add plus a remove and both halves complete: the new envelope is written and nothing survives under the old name. That case is what the wiring buys, and it is written so it FAILS if the previous-name list is unwired.
- **A hole the refusal opened is closed.** The refusal protected the occupant and then the ledger's own undo deleted it — see the deviation below. The commit now checks every target before its first rename, so a refusal provably places nothing, and the ledger drops its removal payload on that one error.

## Task Commits

1. **Task 1 RED — the failing refusal proof** — `e7edfd84` (test)
2. **Task 1 GREEN — the supply and the refusal, one commit** — `042d39c0` (feat)
3. **Deviation fix — the undo carve-out** — `dc017522` (fix)
4. **Task 2 — the disable/enable round trip** — `3275cd4a` (test)

## Files Created/Modified

- `orchestrators/plugin/install.ts` — the snapshot read supplying `previousWorkflowNames`; the try/catch that drops `stagedWorkflowNames` on a WR-06 refusal and only on a refusal.
- `bridges/workflows/stage.ts` — `assertTargetsUnoccupied`, run after the displacement and before the first rename; the widened `shared/fs-utils.ts` import; the commit's doc comment.
- `shared/errors-bridges.ts` — `WorkflowTargetOccupiedError` and the cause-walking `isWorkflowTargetOccupiedError`.
- `tests/bridges/workflows/stage.test.ts` — three cases: the refusal with the path named and the bytes intact, the previously-named replace, the mid-loop refusal restoring displaced envelopes. `stageAndCommit` gained an optional previous-name argument.
- `tests/orchestrators/plugin/enable-disable.test.ts` — four integration cases plus a workflow-marketplace seeder, a disabled-record patcher and a prefix-filtered saved-directory reader.
- `tests/orchestrators/plugin/install-workflows.test.ts` — the rollback-partial case rewritten as the refusal carve-out it became.

## Decisions Made

- **The occupancy pass is up front, not per-iteration.** For the refusal alone the two are equivalent. They differ for the caller: only the up-front pass makes "zero renames completed" a fact the ledger can rely on, and that fact is what makes dropping the removal payload safe rather than a guess.
- **The refusal is typed, and recognised through a `cause` walk.** `appendLeaks` returns the original error untouched when nothing leaked, but re-wraps it in a plain `Error` when staging cleanup fails. A bare `instanceof` would miss the wrapped form — which is precisely the double-fault case where a wrong answer deletes a user's file.
- **Only the refusal drops the payload.** A genuine mid-sequence rename failure can leave a committed envelope at its target when the commit's own reversal loop leaks, and the undo is the only thing that removes it. That case keeps the payload it always had.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The ledger's undo deleted the file the refusal had just protected**

- **Found during:** Task 2, by the refusal integration case
- **Issue:** The workflows phase assigns its removal payload BEFORE the commit (a deliberate choice, so a part-way rename failure can still be unwound). That payload names every target the run intended to place — including a target the WR-06 refusal declined to touch. So the phase refused to overwrite the user's hand-saved workflow, then the ledger's `undo` unlinked it. The end state was worse than the silent overwrite the refusal exists to prevent, and it violated the plan's stated prohibition outright.
- **Fix:** `commitPreparedWorkflows` checks every target before its first rename and raises a typed `WorkflowTargetOccupiedError`; the ledger phase recognises that one error (through a `cause`-walking predicate) and clears `stagedWorkflowNames` before rethrowing. Every other commit failure is unchanged.
- **Files modified:** `bridges/workflows/stage.ts`, `shared/errors-bridges.ts`, `orchestrators/plugin/install.ts`, `tests/orchestrators/plugin/install-workflows.test.ts`
- **Commit:** `dc017522`

**2. [Rule 1 - Collateral] The prior rollback-partial case lost its inducer**

- **Found during:** Task 2
- **Issue:** `install-workflows.test.ts`'s WLIF-01 case induced a commit throw by planting a DIRECTORY at the target path, then read the resulting rollback partial as proof the undo acted on a non-empty list. An occupied target is now a refusal, so the payload is dropped by design and no partial appears. Searching for a replacement inducer showed the proof is not recoverable: the only way to make the undo's unlink FAIL is an existing target, and an existing target is now refused. A read-only saved directory was tried and rejected — the rename fails, but the undo's unlink then returns ENOENT rather than EACCES, so no partial is produced either.
- **Resolution:** The case was rewritten to pin the carve-out it became: a refused commit leaves the occupant byte-identical, produces NO rollback partial, and writes no record. The doc comment states why the occupied target is the only inducible commit throw and points at the bridge-level tests that cover the reversal and the displaced-envelope restore directly.
- **Files modified:** `tests/orchestrators/plugin/install-workflows.test.ts`
- **Commit:** `dc017522`

**3. [Rule 1 - Lint] `commitPreparedWorkflows` exceeded the cognitive-complexity ceiling**

- **Found during:** Task 2 verification (`npm run lint`)
- **Issue:** Adding the occupancy pass took the function from 15 to 16 against `sonarjs/cognitive-complexity: 15`, an ESLint error here.
- **Fix:** The pass was extracted to `assertTargetsUnoccupied`, which also gave the rationale a natural home.
- **Commit:** `dc017522`

### Plan Statements Corrected

**4. [Acceptance-criterion wording] The `previousWorkflowNames` grep returns 2, not 1**

The criterion expects `grep -v comments install.ts | grep -c 'previousWorkflowNames'` to return `1`. It returns `2`: line 1178 is the supply to `prepareStageWorkflows` (this plan's change) and line 1207 is the *unstage* bridge's own input field of the same name, pre-existing since the workflows bridge landed. The criterion's stated intent — supplied at exactly one site, the ledger phase's prepare — holds. This is the same class of wording gap 104-02 recorded for `unstagePluginWorkflows`.

**5. [must_haves truth] The post-failed-disable behavior is the inverse of what the plan states**

The plan's backstop truth reads: *"After a FAILED disable, the partial fold has shrunk `resources.workflows` to only what was removed, so a surviving envelope is no longer named in the record."* `applyPartialCascadeFold` filters OUT the dropped (successfully removed) names, so what the record retains is exactly the FAILURES — the envelopes still on disk. 104-02's own retry case pins this: a partial failure over `["acme:ship", "acme:deploy"]` leaves the record naming `["acme:deploy"]`, the one that failed. A real failed disable therefore leaves the survivor NAMED, and the next enable legitimately displaces and replaces it rather than refusing.

Two further facts make the plan's scenario unreachable as written: a failed disable never flips `enabled` to `false` (the record stays enabled with a shrunken inventory), so the next `enable` takes the idempotent "already enabled" arm and never re-materializes at all.

The DECISION the truth exists to pin — refuse rather than clobber — is pinned, on the shape where it actually applies: a disabled record that does not name an envelope sitting at a target path the re-materialization produces. That is the shared-directory collision the refusal was written for (T-104-03-01 / T-104-03-02), and the test asserts the refusal names the path, the bytes are unchanged, and the record stays disabled.

## Issues Encountered

The one skipped test in the full-suite run (`# skipped 1`) is the known pi-subagents global-peer environment skip, unrelated to this plan and identical to 104-01's and 104-02's runs.

## Verification

- `npm run check` green: typecheck, ESLint and Prettier clean; 3636 unit tests — 3635 pass, 0 fail, 1 skipped (pre-existing environment skip) — plus 18 integration/e2e, all passing.
- `node --test tests/bridges/workflows/stage.test.ts tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/plugin/install-workflows.test.ts` — 68/68.
- `node --test "tests/orchestrators/plugin/*.test.ts" "tests/bridges/workflows/*.test.ts"` — 811/811 before the deviation fix; the full suite covers it after.
- `git show --stat 042d39c0` lists BOTH `install.ts` and `bridges/workflows/stage.ts` — the ordering constraint is satisfied in one commit.
- `grep -v comments bridges/workflows/stage.ts | grep -c 'pathExists'` → 2 (the import and the guard); `grep -c 'removeOrphanIfPresent'` → 0 (the collapsed single-arm form).
- RED was observed before GREEN: the two refusal cases failed with "Missing expected rejection" / a surviving foreign file on commit `e7edfd84`.
- No source or test comment added by this plan cites a GSD process artifact — the anchors are `WLIF-01`, `WLIF-05`, `WR-01`, `WR-06`, `PI-6`, `ENBL-18`, `NFR-3`.
- `STATE.md` and `ROADMAP.md` were not staged or modified by this plan. (`STATE.md` carries an unrelated working-tree modification owned by the orchestrator, unchanged since before this plan started.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 104-04 and 104-05 (`update` and `reinstall` re-stage) inherit a working previous-name path and a commit that refuses rather than overwrites. Both should supply their own previous names from `oldRecord.resources.workflows` the way the sibling kinds already do, and both should expect `WorkflowTargetOccupiedError` on a foreign collision.
- Any future caller that holds a removal payload across `commitPreparedWorkflows` must apply the same carve-out. `isWorkflowTargetOccupiedError` exists so the check is one call, not a re-derivation.

No blockers.

## Self-Check: PASSED

All 6 modified files verified present on disk. All four task commits verified in `git log`: `e7edfd84`, `042d39c0`, `dc017522`, `3275cd4a`. `git show --stat 042d39c0` confirmed to carry both `install.ts` and `bridges/workflows/stage.ts`. `npm run check` re-run green after the last code commit.

---
*Phase: 104-workflow-lifecycle-completion*
*Completed: 2026-08-15*
