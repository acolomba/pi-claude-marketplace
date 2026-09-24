---
phase: 112-install-and-removal-lifecycle
plan: 03
subsystem: infra
tags: [workflows, reinstall, rollback, manual-recovery, path-containment]

requires:
  - phase: 112-install-and-removal-lifecycle
    provides: "`resources.workflows` on the install record, and the workflows bridge triplet the install ledger already drives"
provides:
  - "reinstall's fifth prepare handle, reading previous names off the old record's workflow inventory"
  - "the workflows commit as the LAST step of the replace sequence, with the placed names threaded out"
  - "`unplaceWorkflows`: a never-throwing recovery composer consumed at the only catch that can see a post-commit failure"
  - "the reinstall record axis fed from the PLACED names rather than the prepared handle"
affects: [112-04 staging sweep, 113 update re-stage]

actuals:
  tokens: 96200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "a bridge step deliberately outside the replacement ledger threads its own removal payload out of `replaceAll`, exactly as the hooks slot threads `hookEntries`"
    - "a recovery composer nested inside an unwinding catch converts EVERY throw, containment refusals included, into a leak string"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - tests/orchestrators/plugin/reinstall.test.ts

key-decisions:
  - "The flagged containment assumption is ADOPTED as written: `unplaceWorkflows` converts a `PathContainmentError` into a leak line instead of letting it propagate. The bridge's raise and the ledger's re-throw are untouched."
  - "`previousWorkflowNames` is passed by direct assignment, not a conditional spread: `resources.workflows` is a REQUIRED record member, so it can never be `undefined` at that site."
  - "`replaceAll` gained TWO new members, not one: the placed names AND the commit's staging-cleanup leak. Discarding the leak would have silently dropped a report the install ledger makes."
  - "The plan's task-1 behavior bullet naming a LATER prepare failure is unreachable by construction; the abort arm is driven from `replaceAll`'s catch instead."
  - "`seedInstalledGitSourcePlugin` was NOT extended -- no case earns it, and an unused fixture option is the padding the phase warnings forbid."

patterns-established:
  - "Recovery-composer shape: early-return on an empty payload, map per-name failures to labelled leaks, wrap the whole call in a catch that labels any throw. Never throws."
  - "Containment-refusal vehicle: the post-commit sabotage replaces the just-placed envelope with a symlink before throwing, so the recovery's own path chokepoint raises `SymlinkRefusedError`."

requirements-completed: [WLIF-01, WLIF-03]

coverage:
  - id: D1
    description: "Reinstall re-materializes workflow envelopes from the plugin source, displacing the recorded ones rather than refusing the occupied target"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WLIF-01: a reinstall re-materializes the envelope over the recorded one"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WLIF-01: the record names both envelopes a two-workflow reinstall wrote"
        status: pass
    human_judgment: false
  - id: D2
    description: "The persisted record names exactly the envelopes the commit reported placing, and an empty inventory is an own empty array"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WLIF-01: a reinstall with no workflows records an empty array, not an absent key"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WLIF-01: a workflow the new version drops leaves neither an envelope nor a record entry"
        status: pass
    human_judgment: false
  - id: D3
    description: "A failure after the commit removes every placed envelope and leaves a foreign envelope in the same shared directory byte-unchanged"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WLIF-01: a failure after the commit removes exactly the envelopes it placed"
        status: pass
    human_judgment: false
  - id: D4
    description: "A containment refusal raised during recovery becomes a leak rather than replacing the primary error, and an unremovable envelope promotes the failure to manual recovery"
    requirement: "WLIF-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#T-112-14: a containment refusal during recovery becomes a leak, not the surfaced error"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WLIF-03: an unremovable placed envelope becomes a manual-recovery leak"
        status: pass
    human_judgment: false
  - id: D5
    description: "A failed replace leaves no orphaned workflows staging tree, and a plugin with no workflows touches neither workflow directory"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WLIF-01: a replace-step failure leaves no workflows staging tree behind"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WLIF-01: a reinstall of a plugin with no workflows touches neither workflow directory"
        status: pass
    human_judgment: false
  - id: D6
    description: "The workflows commit's staging-cleanup leak reaches the cascade surface's notes instead of being discarded"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WLIF-01: a workflows staging-cleanup leak reaches the reinstall bridge warnings"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-05
status: complete
---

# Phase 112 Plan 03: Install and removal lifecycle Summary

**Reinstall now re-materializes workflow envelopes as the last step of its replace sequence, records exactly the names the commit reported placing, and takes those names back through a recovery composer that turns even a containment refusal into a leak string rather than losing the primary error.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-05T17:42:00Z (approx; first commit at 18:08:21Z)
- **Completed:** 2026-09-05T18:36:27Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- `PreparedHandles` and its partial twin carry a `PreparedWorkflowsStaging`; `prepareAllHandles` runs a fifth prepare after mcp, reading `input.oldRecord.resources.workflows` — the same slot the skills and commands prepares read theirs from.
- `abortPartialHandles` gained a workflows arm FIRST in its reverse unwind order. It is reached from `replaceAll`'s catch (see the deviation below), and `abortPreparedWorkflows` tolerates a staging root a successful commit already removed.
- `replaceAll` commits the envelopes LAST and returns two new members: `placedWorkflowNames` (from the `onPlaced` callback) and `workflowsCommitLeaks`. `ReplacementEntry` stays four-armed — `grep -c 'phase: "workflows"'` prints `0`.
- `unplaceWorkflows` is consumed at the outer catch wrapping the state write, the config write-back and the transaction save. It never throws.
- `resourcesFromHandles` takes the placed names as a defaulted fourth argument, so `successOutcome`'s projection still carries an empty array and no state write happens on that path.
- The workflow prepare's warnings ride the bridge half at the composition site. `splitStagingWarnings` is byte-unchanged and `update.ts`'s call-site count is still `3`.
- `reinstall.ts` is at 100% direct coverage: branches 243/243, functions 49/49, lines 1757/1757. No `fallow-ignore`, no accepted shortfall. `npm run fallow` exits 0 with no health finding on the replace step or the reinstall entry point, so no extraction was required.

## Task Commits

1. **Task 1: prepare and abort a workflows handle** — `b6ed30e8` (feat)
2. **Task 2: commit the envelopes, thread the placed names, remove on later failure** — `c97ca097` (feat)
3. **Task 3: pin the record and replace semantics** — `e785a865` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` — the workflows handle on both handle types, the fifth prepare, the abort arm, the commit step, the placed-names thread-through, `unplaceWorkflows`, the outer-catch consumer, the record axis, and the warnings composition
- `tests/orchestrators/plugin/reinstall.test.ts` — `ResourceSet.workflows`, `writeWorkflowScripts`, `entriesOf`, `seedForeignEnvelope`, a `workflows` arm on `seedDisabledInstall`, and nine cases

## Decisions Made

**The flagged containment assumption is adopted as written.** `unplaceWorkflows` wraps its whole `unstagePluginWorkflows` call in a `try/catch` that converts ANY throw — `PathContainmentError` included — into a `workflows: <message>` leak string. The reading that holds is the plan's: PI-14's "propagate loudly" governs the ledger's primary undo boundary, where 112-01 applies it verbatim, but this composer runs inside a catch already unwinding a different error and already collecting leak strings. Letting the refusal escape there would replace the primary error and discard every leak gathered — strictly worse, and the same shape the preceding phase's review flagged for a throwing callback. The bridge's contract is untouched: `unstagePluginWorkflows` still raises by class, and `phase-ledger.ts` still re-throws it. The behavior is pinned by `T-112-14`, which asserts the surfaced notes carry `save-failure` and do NOT mention the symlink.

**`previousWorkflowNames` is a direct assignment, not a conditional spread.** The plan hedged ("if the value can be undefined at this site use a conditional spread"). It cannot: plan 112-01 made `resources.workflows` a REQUIRED member of the record schema, so `input.oldRecord.resources.workflows` is always a `string[]`. A conditional spread there would have been unreachable-branch padding that the coverage gate would then refuse.

**`replaceAll` gained two members, not one.** The plan named only the placed names. The workflows commit also returns a staging-cleanup leak string, and the install ledger pushes that onto its bridge warnings. Discarding it here would have left a staging tree in the user's `~/.pi/workflows/.pi-claude-marketplace-staging/` with nothing reported. `workflowsCommitLeaks` carries it to the same composition site as the prepare warnings, and `D6` pins it.

**The bridge's abort tolerates a commit-removed staging root.** `abortPreparedWorkflows` delegates to `cleanupStaging`, which calls `rm` with `{ recursive: true, force: true }` AND separately swallows `ENOENT`. The plan asked this be confirmed before placing the commit inside the same `try` whose catch calls the abort; it is confirmed, and no guard was needed.

**The shared staging-warning classifier was left alone, deliberately.** `splitStagingWarnings` is consumed by `update.ts` as well, so a required new member would have dragged a file this work does not otherwise change into the commit. The workflow prepare's warnings are appended at the `bridgeWarnings` composition site instead, with the reason stated in a comment there. The later phase that widens the classifier should fold this append back in.

**`seedInstalledGitSourcePlugin` was not extended.** The plan's artifact table listed all three seeders. No case in this plan earns a git-source workflow fixture: workflow discovery reads `resolved.pluginRoot`, and reinstall's git path is about clone materialization, which is orthogonal. Adding an unused options field would have been fixture padding.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] The task-1 behavior bullet describes an unreachable failure**

- **Found during:** Task 1
- **Issue:** The plan asks for a case where "a prepare failure in a LATER handle aborts the workflows staging tree". The same plan places the workflows prepare LAST, after mcp, so no later prepare exists — `handles.workflows` is set only when every prepare has already succeeded, and `prepareAllHandles`' catch can therefore never see it.
- **Fix:** The arm is driven from the reachable direction instead. `abortHandles` is also called from `replaceAll`'s catch with the full handle set, so the case sabotages the FIRST replace step (a `rename` into the skills target dir) and asserts the workflows staging directory holds no entries afterwards, plus that the install's envelope is byte-unchanged because the failure landed before the workflows step. The intent the criterion checks — no orphaned staging tree after a failure — is verified directly.
- **Files modified:** `tests/orchestrators/plugin/reinstall.test.ts`
- **Verification:** removing the workflows arm from `abortPartialHandles` turns exactly that case red and nothing else; restoring it returns the suite to green
- **Committed in:** `b6ed30e8`

**2. [Rule 2 - Missing critical] The workflows commit's staging-cleanup leak was unreported**

- **Found during:** Task 2
- **Issue:** `commitPreparedWorkflows` returns a leak string when it cannot remove its staging root. The plan's `replaceAll` widening named only the placed names, which would have discarded it — a staging tree left under the user's workflow home with nothing said about it, where the install ledger reports the same condition.
- **Fix:** `replaceAll` returns `workflowsCommitLeaks` alongside `placedWorkflowNames`, spread into `bridgeWarnings` at the composition site.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`, `tests/orchestrators/plugin/reinstall.test.ts`
- **Verification:** a case mocks `rm` to refuse the staging root and asserts the exact leak line reaches `outcome.notes` on the `render: "none"` surface
- **Committed in:** `c97ca097`

**3. [Rule 3 - Blocking] The `failed[]` mapping arrow was the one uncovered function**

- **Found during:** Task 2
- **Issue:** After the first four workflows cases the module reported branches 243/243 and lines 1757/1757 but functions 48/49. The uncovered one was the `result.failed.map(...)` callback inside `unplaceWorkflows` — no case produced a per-name removal failure during recovery, only clean removals and a containment refusal.
- **Fix:** Added `WLIF-03: an unremovable placed envelope becomes a manual-recovery leak`, which mocks `unlink` to raise `EPERM` for the envelope path (with `syncBuiltinESMExports()` on both sides, because the bridge binds `unlink` through a static ESM import). It also pins the promotion a non-empty leak list causes.
- **Files modified:** `tests/orchestrators/plugin/reinstall.test.ts`
- **Verification:** `node scripts/test-coverage-direct.mjs` reports functions 49/49
- **Committed in:** `c97ca097`

**4. [Rule 1 - Bug] Two drafted assertions did not survive contact with the real surfaces**

- **Found during:** Task 2
- **Issue:** (a) The clean-removal case asserted `failureClass === "manual-recovery"`; it is `undefined`, because `errorWithManualRecovery` does not promote an error with zero leaks and a clean take-back produces none. (b) The staging-leak case asserted on the rendered notification; `bridgeWarnings` are hygiene warnings that D-19-01 surfaces only on the `render: "none"` cascade surface, never in the rendered row.
- **Fix:** (a) The case now asserts `failureClass === undefined` with a comment stating that a clean take-back is not a condition the user repairs by hand, and separately asserts the primary `save-failure` reaches the notes. (b) The case calls `reinstallPlugin` with `render: "none"` and asserts on `outcome.notes`.
- **Files modified:** `tests/orchestrators/plugin/reinstall.test.ts`
- **Verification:** both cases green; the suite is 120 tests
- **Committed in:** `c97ca097`

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 missing critical, 1 blocking)
**Impact on plan:** None widened scope. Two are drafted assertions corrected against measured behavior, one is a coverage closure the gate demanded, and one restores a report the plan's return-type widening would have dropped. No file outside the plan's declared two was touched.

## Issues Encountered

**`grep -c 'unplaceWorkflows'` prints exactly `2`, which is the criterion's floor and not a coincidence.** The declaration and the single outer-catch consumer are the only two mentions, and there is deliberately no third: `replaceAll`'s own catch does NOT call it. Adding one would be uncoverable — the only way to reach it is a commit that throws AFTER `onPlaced` reported stranded names, and the bridge already emits those names as leak strings on its own thrown error. The plan's truth that the outer catch is "the only thing that can remove them" is implemented literally.

**The `previousWorkflowNames` conditional spread the plan budgeted for does not exist,** so no case exercises an `undefined` arm at that site. That is correct rather than a gap: the field is required on the record.

**Every workflows case constructs `locationsFor` INSIDE the `withHermeticHome` closure.** `workflowsSavedDir` derives from `os.homedir()` and honors no environment override, so a bundle built outside the closure would point at the developer's real home — the hazard plan 112-02 hit in two other suites.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four removal-and-materialization verbs now carry the workflows axis: install and enable through the ledger, uninstall / disable / `marketplace remove --cascade` through `cascadeUnstagePlugin`, and reinstall through this bespoke trio.
- Plan 112-04's staging sweep still owns crash-orphaned staging trees. Everything reachable in-process is cleaned: the commit removes its own root on success, `abortPreparedWorkflows` removes it on a replace failure, and a cleanup refusal is now reported rather than swallowed.
- Phase 113's update re-stage inherits the divergence recorded above: the workflow warnings are appended at reinstall's composition site rather than through `splitStagingWarnings`. Widening that classifier is the natural place to fold the append back in.

## Self-Check: PASSED

- Both modified files verified present on disk.
- All three commit hashes verified in `git log`.
- `npm run check` exits 0 — typecheck (0 errors), lint, fallow (all three sub-gates), format:check, 5423 unit tests and 32 integration tests, zero failures.
- `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` reports `hit === found`: branches 243/243, functions 49/49, lines 1757/1757.
- `grep -c 'prepareStageWorkflows' reinstall.ts` = 2, `abortPreparedWorkflows` = 3, `commitPreparedWorkflows` = 3, `unplaceWorkflows` = 2, `oldRecord.resources.workflows` = 1, `phase: "workflows"` = 0.
- `grep -c 'splitStagingWarnings' update.ts` = 3, unchanged from its pre-task value.
- `grep -c 'workflowsSavedDir' tests/orchestrators/plugin/reinstall.test.ts` = 16.
- `git merge-base --is-ancestor features/workflows-spike HEAD` exits 1 — no spike commit entered the branch.
- `grep -rnE '^export (const|function|async function) __test_' extensions/pi-claude-marketplace/ | wc -l` prints 0.
- `git status --short` shows no tracked modification left behind after any of the three commits.

---
*Phase: 112-install-and-removal-lifecycle*
*Completed: 2026-09-05*
