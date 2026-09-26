---
phase: 112-install-and-removal-lifecycle
verified: 2026-09-05T22:30:00Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
coincidental_reliance_items: []
---

# Phase 112: Install and Removal Lifecycle Verification Report

**Phase Goal:** Installing a workflow-bearing plugin writes its envelopes as a sixth ledger phase
that unwinds with the rest, and every removal path takes them away again.
**Verified:** 2026-09-05
**Status:** passed
**Re-verification:** No — initial verification (this is the first `112-VERIFICATION.md`; two code-review
iterations and their fix reports already ran and are folded into this report as evidence, not trusted as
claims).

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `runPhases` carries a sixth phase whose `undo` removes the envelopes it wrote; a later-phase failure leaves nothing behind. | ✓ VERIFIED | `install.ts:1168-1245` — `workflowsPhase` inserted between `mcpPhase` and `statePhase` (`install.ts:1346-1352`). `undo` removes by `c.stagedWorkflowNames` (the `onPlaced` report), never `prep.result.stagedNames`. Executed directly: `WLIF-01: a statePhase failure takes the envelope and the staging tree back` asserts `pathExists(envelopePath) === false`, `entriesOf(workflowsSavedDir) === []`, `entriesOf(workflowsStagingDir) === []` as filesystem facts (not a rejected promise). `T-112-01: an envelope this install did not place survives the undo byte-unchanged` proves a foreign colliding-name file is untouched. All 148 cases in `install.test.ts` pass. |
| 2 | The ledger `phase` union in `shared/errors.ts` carries `"workflows"`. | ✓ VERIFIED | `grep -c '"workflows"' shared/errors.ts` ≥ 1; mirrored in `orchestrators/types.ts` (`UpdatePhaseBridge`) and `orchestrators/plugin/update.ts` (`PHASE3_FAILURE_PHASES`), plus the `tests/orchestrators/types.test.ts` exhaustiveness pin. `npm run typecheck` is 0 errors; `update.test.ts` green (no existing phase arm changed behavior). |
| 3 | `uninstall`, `disable` and `marketplace remove --cascade` all remove workflow envelopes; a partial removal reports per-name reasons through a typed error. | ✓ VERIFIED | One edit to `cascadeUnstagePlugin` (`orchestrators/marketplace/shared.ts:403-417`) is the sixth cascade slot, after mcp and before the success freeze; `WorkflowsUnstageFailureError` carries the structured `UnstageWorkflowFailure[]`. Both partial-cascade folds (`orchestrators/plugin/shared.ts:1230-1232`, `orchestrators/marketplace/remove.ts:338-339`) subtract the axis; each has a dedicated test that fails when its line is absent (confirmed present and green). `uninstall.test.ts`, `enable-disable.test.ts`, `marketplace/remove.test.ts` all assert real envelopes gone from disk, adjacency (a second plugin's / user's file byte-unchanged), and empty-inventory no-ops. |
| 4 | `reinstall` re-materializes envelopes from the plugin source and records the names it actually wrote. | ✓ VERIFIED | `reinstall.ts` gains a fifth prepare, a workflows commit as the LAST replace step, and threads `placedWorkflowNames` out for the record and the outer recovery path. Two data-loss Criticals found in iteration-1 review (CR-01: catch discarded the placed-envelope report; CR-02: abort recursively deleted a preserved staging root) were fixed in commit `42f7821a` and independently confirmed by the iteration-2 reviewer via revert-and-observe (both cases went red on the pre-fix code, green after). Code inspection confirms the fix is in place: `workflowsCommitEntered` gates `abortHandles({ skipWorkflows })`, and `unplaceWorkflows` consumes `placedWorkflowNames` at the outer catch. 122/122 `reinstall.test.ts` cases pass; `reinstall.ts` is 100% direct branch/line/function coverage. |
| 5 | Written against the current `install.ts`/`uninstall.ts`/`reinstall.ts`, not transplanted from the spike branch. | ✓ VERIFIED | `git merge-base --is-ancestor features/workflows-spike HEAD` exits 1 (non-ancestor). No `^export (const\|function\|async function) __test_` symbols found in `extensions/`. |
| 6 | An orphaned staging tree is swept or reported; age-bounded so a concurrent install's fresh staging root is never removed. | ✓ VERIFIED | `orchestrators/plugin/workflows-staging-gc.ts`: `garbageCollectWorkflowsStaging` enumerates `workflowsStagingDir`, skips non-directories and anything inside `WORKFLOWS_STAGING_MAX_AGE_MS` (24h, one named exported constant), anchors containment on `workflowsHomeDir` (one level above the staging segment, resolved before any read through the candidate — see WR-07 below), and records each per-entry failure — an `rm` failure, an `lstat` failure, or a containment refusal (WR-01: caught per entry, so one poisoned tree never ends the pass) — as a leak string. Both call sites discard the returned array under D-19-01, so none of the three reaches a user; what a refusal buys is the `rm` that never runs on the refused entry. Both directions executed directly: `"removes a staging tree left behind longer than the maximum age"` (aged tree gone) and `"keeps a staging tree still inside the maximum age"` (fresh tree present, its file byte-intact) — both pass. Called from both an install-side (`install.ts`) and a removal-side (`uninstall.ts`) hygiene block, each swallowing its own failure (`grep -c` ≥ 2 in each file, confirmed). Two iteration-2 Warnings on this file (WR-05: an errno-handling bug that could `rm -rf` a live `.previous/` recovery copy on a transient I/O error; WR-07: the retention probe read through an unvalidated candidate before the containment check) were fixed in commits `01faf6a5`/`eafb3c11` and confirmed present in the current source (read directly, lines 155-214). |
| 7 | `npm run check` is green. | ✓ VERIFIED | Ran directly in this verification session (not taken from a prior SUMMARY claim): `npm run typecheck` 0 errors; `npm run lint` exit 0; `npm run fallow` exit 0; `npm run check` (typecheck + lint + fallow + format:check + test:corresponding + test:corresponding:negative + test:coverage:direct:negative + full unit suite + integration suite) exit 0 — 5442/5442 unit tests pass, 32/32 integration tests pass, including `WINV-02 / WBRG-01: a workflow-bearing plugin installs with no partial flag, and the bridge materializes its script as an envelope`. |

**Score:** 7/7 truths verified (0 present-but-behavior-unverified).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `persistence/state-io.ts` | required `resources.workflows` schema member + `clonePluginRecord` enumeration | ✓ VERIFIED | Line 127 (schema), line 181 (clone enumeration). 100% direct coverage. |
| `persistence/migrate.ts` | four-member default-fill list | ✓ VERIFIED | `ensureOneRecordResources` fills `workflows: []` for legacy records; 100% direct coverage. |
| `orchestrators/plugin/install.ts` | `workflowsPhase` sixth bridge slot | ✓ VERIFIED | Lines 1168-1245; wired into the literal array at 1346-1352; 100% direct coverage (2574/2574 lines, 262/262 branches, per iteration-2 fix report and re-confirmed by direct execution in this session). |
| `orchestrators/marketplace/shared.ts` | `WorkflowsUnstageFailureError`, sixth cascade slot | ✓ VERIFIED | Declared beside `AgentsUnstageFailureError`; `Object.freeze` used for the structured payload; 100% direct coverage (818/818 lines, 102/102 branches). |
| `.fallowrc.json` | `orchestrators` → `bridges-workflows` allow-list edge | ✓ VERIFIED | Present; `npm run fallow` exits 0. |
| `orchestrators/plugin/reinstall.ts` | fifth prepare handle, commit-last, placed-names thread-through, `unplaceWorkflows` | ✓ VERIFIED | 100% direct coverage (1806/1806 lines, 255/255 branches). |
| `orchestrators/plugin/workflows-staging-gc.ts` (new) | `garbageCollectWorkflowsStaging`, `WORKFLOWS_STAGING_MAX_AGE_MS` | ✓ VERIFIED | 100% direct coverage (214/214 lines, 30/30 branches, current post-WR-05/WR-07 state). |
| `tests/orchestrators/plugin/workflows-staging-gc.test.ts` (new) | aged/fresh/missing/containment/leak cases | ✓ VERIFIED | 13 tests, all pass; corresponding-test gate confirms it landed in the same commit as the module. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `install.ts` | `bridges/workflows/index.ts` | `prepareStageWorkflows`/`commitPreparedWorkflows`/`unstagePluginWorkflows` | ✓ WIRED | First orchestrator import of the bridge; `.fallowrc.json` allow-list edge rode the same commit (`d02db74b`). |
| `install.ts` | `persistence/state-io.ts` | `statePhase` composes `resources.workflows` from `c.stagedWorkflowNames` | ✓ WIRED | Line 1322: `workflows: [...c.stagedWorkflowNames]`. |
| `install.ts` | `transaction/phase-ledger.ts` | throwing `undo` → `RollbackPartial`; `PathContainmentError` re-thrown by class | ✓ WIRED | `PI-14: a containment refusal from the workflows undo propagates verbatim` test passes; asserts no rollback-partial marker and no version on the failure row. |
| `orchestrators/marketplace/shared.ts` | `orchestrators/plugin/shared.ts` | `UnstageOutcome.dropped` read structurally by both folds | ✓ WIRED | Both folds confirmed present (`dropped.workflows` in `plugin/shared.ts:1230` and `marketplace/remove.ts:338`); `dropped.hooks` confirmed absent from `remove.ts` (CASCADEAX-01 deliberately unrepaired, pinned at `tests/orchestrators/marketplace/remove.test.ts:1170`). |
| `reinstall.ts` | `bridges/workflows/index.ts` | prepare/commit/abort/unstage across the hand-rolled trio | ✓ WIRED | `prepareStageWorkflows`, `commitPreparedWorkflows`, `abortPreparedWorkflows`, `unstagePluginWorkflows` all present and exercised. |
| `install.ts` / `uninstall.ts` | `workflows-staging-gc.ts` | swallowed hygiene-block call | ✓ WIRED | `garbageCollectWorkflowsStaging` referenced ≥2 times in each file (import + call); both call sites' catch branches covered by planted-failure tests. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rollback leaves nothing behind (Criterion 1) | `node --test tests/orchestrators/plugin/install.test.ts` (targeted cases read above) | 148/148 pass, filesystem facts asserted directly | ✓ PASS |
| Sweeper removes aged / spares fresh (Criterion 6, both directions) | `node --test tests/orchestrators/plugin/workflows-staging-gc.test.ts` | 13/13 pass | ✓ PASS |
| No spike transplant (Criterion 5) | `git merge-base --is-ancestor features/workflows-spike HEAD; echo $?` | `1` | ✓ PASS |
| Full gate chain (Criterion 7) | `npm run check` | exit 0; 5442 unit + 32 integration tests pass | ✓ PASS |
| CR-01/CR-02 non-vacuity (reinstall rollback) | reviewer's revert-and-observe, cross-checked by reading the restored code path in this session | both cases red pre-fix / green post-fix, confirmed present | ✓ PASS |
| WR-05/WR-07 non-vacuity (sweeper retention ordering) | reviewer's revert-and-observe (iteration-2 fix report), cross-checked by reading `workflows-staging-gc.ts:155-214` in this session | containment check precedes the retention probe; only ENOENT/ENOTDIR read as "nothing displaced" | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WLIF-01 | 112-01, 112-03, 112-04 | Install materializes workflows as a 6th ledger phase; a later-phase failure unstages them; sweeper covers crash-orphans | ✓ SATISFIED | `workflowsPhase`, undo semantics, sweeper — all verified above. |
| WLIF-02 | 112-01 | Widen the three mirrored ledger-phase closed sets (type only; behavior deferred) | ✓ SATISFIED (type scope) | Widened in `shared/errors.ts`, `orchestrators/types.ts`, `orchestrators/plugin/update.ts`; `update.test.ts` unchanged and green, confirming no behavior change. Behavior half (update re-stage) is correctly out of scope per ROADMAP Phase 113 — see note below. |
| WLIF-03 | 112-01, 112-02, 112-03 | Cascade removal across uninstall/disable/marketplace-remove/reinstall, with typed per-name failure | ✓ SATISFIED | Sixth cascade slot, both folds, four-verb pinning — all verified above. |

**Requirement-numbering note (not a gap):** `REQUIREMENTS.md:105-106` documents a deliberate,
pre-resolved correction — the archived milestone's WLIF-02 prose names "update," which the current
ROADMAP assigns to Phase 113, while Phase 112 ships only the type-level widening that Phase 113's
behavior depends on. This is recorded with verbatim citations in `112-RESEARCH.md` §"WLIF numbering
conflict" and is consistent with ROADMAP's Phase 112 criterion 2 (union widening only). No orphaned
requirement: `WLIF-04..06` are correctly assigned to Phase 113 in `REQUIREMENTS.md:107`, not silently
dropped.

### Anti-Patterns Found

None. `grep` for `TBD|FIXME|XXX` across every file this phase touched (`git diff 1a478772..HEAD`)
returns zero matches. No new `fallow-ignore` or `eslint-disable` markers were introduced (diffed
against the base commit). No stub patterns (`return null`, empty handlers, hardcoded-empty
props) found in the sixth-phase or cascade code — every branch is backed by a real bridge call and
a filesystem-fact test.

### Deferred Items (verified to have durable carriers)

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | WR-03: `update` never re-stages workflows, and the three widened closed sets stay inert until it does | ROADMAP Phase 113, criterion 6 | Verbatim citation confirmed at `ROADMAP.md` Phase 113 criterion 6: "The `workflows` failure-phase widenings stop being inert." |
| 2 | WR-06: a retained staging tree (aged, `.previous/` non-empty) has no read surface — kept forever, undiscoverable | ROADMAP Phase 113, criterion 7 | Verbatim citation confirmed: "A retained workflows staging tree becomes discoverable." |
| 3 | WR-04's substance: `InstallCtx.bridgeWarnings` (all six bridges, not workflows-specific) is discarded on any ledger-phase throw | `.planning/BACKLOG.md`, `WARN-01` | Confirmed filed with full mechanism, blast radius, rejected narrow fix, and durable fix shape (`InstallLedgerSummary` warnings member or `runPhases` surfacing context warnings). |
| 4 | CASCADEAX-01: the hand-rolled marketplace-removal fold omits the hooks axis (pre-existing, unrelated) | `.planning/BACKLOG.md`, `CASCADEAX-01`; pinned at `tests/orchestrators/marketplace/remove.test.ts:1170` | Confirmed filed and confirmed still deliberately unrepaired — `remove.ts` has no `dropped.hooks` reference; the owner test asserts the record still names the dropped hook after a workflows-only fix. |

### Judgment-Call Adjudications (requested by the verification brief)

**1. WR-04's disposition (honest closure vs. unfixed defect wearing a carrier).** Judged as
**honest closure**. The fixer's position is internally consistent and independently checkable:
(a) the kept reorder is justified on its own terms — `agentsPhase` already pushes its prepare
warnings before its commit, so the workflows phase now matches its true sibling rather than
`mcpPhase` (which pushes after commit only because its warnings are a member of the commit's
return) — confirmed by reading `install.ts` directly; (b) the false comment claiming survival
across a commit throw was removed, not left standing; (c) the underlying defect
(`bridgeWarnings` discarded on any of the six bridge phases' throw, not workflows-specific) is
filed in `BACKLOG.md` as `WARN-01` with enough mechanism detail to act on, and correctly scoped
outside a single-bridge phase since fixing it for workflows alone would make workflows the "odd
one out" among six bridges sharing the same hole. This is not a phase-112 goal-blocking gap: none
of the seven ROADMAP success criteria assert that warnings survive a ledger-phase throw.

**2. IN-01 and IN-02 (left as Info, out of scope without `--all`).** Judged as **correctly left
out of this phase**. IN-01 (the WR-01 sweeper test proves refusal-does-not-abort but not
refusal-then-later-collection specifically through the containment path) was already marked
"Fix: Optional" by the reviewer and does not affect Criterion 6, which is independently proven by
the separate `"continues past a staging tree it cannot remove and names it once"` case (the
rm-leak path). IN-02 (a reinstall crash between a successful workflows commit and a later
state-write/write-back failure can leave the record naming envelopes that no longer exist) is a
narrow, structurally-unavoidable window the reviewer explicitly proposed no fix for — the
manual-recovery contract (re-running reinstall re-resolves and re-materializes) already covers
it, and it is the mirror image of an accepted trade-off already documented elsewhere in this
codebase (hooks) rather than a fresh regression. Neither belongs in Phase 112's success criteria.

### Human Verification Required

None. Every observable truth was resolved by direct code reading and by re-executing the actual
tests and gates in this verification session — not by trusting SUMMARY.md or REVIEW-FIX.md
narration. All 645 targeted unit tests plus the full 5442-test unit suite and 32-test integration
suite pass; `npm run check` is green end-to-end as re-run in this session.

### Gaps Summary

None. Two code-review iterations already surfaced and closed the two data-loss Criticals (CR-01,
CR-02) and five Warnings (WR-04 through WR-08); this verification independently re-confirmed each
fix is actually present in the current source (not merely claimed) by reading the code directly and
by re-running the tests that pin each one. The two remaining open items (WARN-01, and Phase 113
criteria 6/7) are durably carried forward and do not block this phase's goal.

---

_Verified: 2026-09-05_
_Verifier: Claude (gsd-verifier)_
