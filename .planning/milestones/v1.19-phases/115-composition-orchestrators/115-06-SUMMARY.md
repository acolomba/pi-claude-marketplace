---
phase: 115-composition-orchestrators
plan: 06
subsystem: testing
tags: [node-test, strong-mock, coverage, reconcile, backfill, filesystem]

requires:
  - phase: 114-plugin-and-marketplace-lifecycle
    provides: "Direct proofs for reinstallPlugin, so the re-materialize is an input here rather than a subject"
  - phase: 115-composition-orchestrators
    provides: "P115-04's shared scope-tree-inventory helper, consumed read-only"
provides:
  - "Sole mirrored owner for orchestrators/reconcile/backfill.ts at 100 percent direct coverage"
  - "A silence boundary idiom: strong mocks with no promised call, so any notify emission or soft-dep probe throws at the call site"
  - "An empty git allow-list as the offline proof for a composition that must never reach the network"
affects: [115-05, 116, 117]

actuals:
  tokens: 16500
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Owner tests drive the module's own exports rather than a sibling composition entrypoint"
    - "Every filesystem case asserts three complete values: the returned outcome list, the state record read back through loadState, and the scope-root path inventory"

key-files:
  created: []
  modified:
    - tests/orchestrators/reconcile/backfill.test.ts

key-decisions:
  - "Drive every case through backfill's own three exports instead of applyReconcile, so the suite owns the module it is paired with"
  - "Assert the structured outcome rows rather than rendered cascade bytes; the byte projection belongs to the reconcile/notify owner"
  - "Prove offline behavior with an empty createGitOpsFake allow-list, so any remote at all is a hard failure"
  - "Add a snapshot-disabled/stored-enabled case, because the plain ENBL-08 case cannot tell the caller-side filter from reinstall's own refusal"

patterns-established:
  - "Silence proof: a strong mock with no stated expectation makes an unpromised notify or getAllTools call throw where it is made, instead of counting calls afterwards"
  - "Fail-fast network edge: createGitOpsFake with allowedRemoteUrls [] plus a clonedUrls() assertion of []"
  - "Frozen Date through t.mock.timers keeps a re-materialized record byte-comparable as one whole value"

requirements-completed: [MOD-08]

coverage:
  - id: D1
    description: "orchestrators/reconcile/backfill.ts reaches 100 percent direct function, line, and branch coverage with its owner run alone"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The version-stamp gate, the force-installed scan, the strict-superset rule, and the per-plugin isolation arms are proved with complete independently authored outcomes and complete on-disk state"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#BFILL-02: stamps the running version when the recorded stamp is older"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#BFILL-01: promotes a plugin whose supported set grew into a fully installed record"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#D-68-03: skips a resolved set that is longer than the recorded set but not a superset"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#SF-02: promotes a healthy plugin under one marketplace while a corrupt manifest fails its own"
        status: pass
    human_judgment: false
  - id: D3
    description: "The six previously uncovered branches close through disk-shaped inputs with no seam, cast, or coverage exception"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#WR-05: skips a pristine scope whose read pass carried no state"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#WR-01: scans and stamps a state-file-absent scope whose snapshot records a partially-installed plugin"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#SF-01: surfaces the pre-narrowed reason when the re-materialize reports one"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#SURF-05: records an orphan rewake on a promotion whose re-resolve reports one"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#WARN-01: records the degraded component kinds a promotion's re-materialize produced"
        status: pass
    human_judgment: false
  - id: D4
    description: "No production file and no shared test helper changed"
    verification:
      - kind: unit
        ref: "git diff --quiet -- extensions/ tests/orchestrators/plugin/scope-tree-inventory.ts"
        status: pass
    human_judgment: false

duration: 38min
completed: 2026-09-01
status: complete
---

# Phase 115 Plan 06: Reconcile Backfill Owner Summary

**The backfill owner now drives backfill's own three exports against case-owned temporary trees with an empty git allow-list, and reaches 100 percent direct coverage with 28 contract-shaped cases and no production change.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-09-02T00:50:34Z
- **Completed:** 2026-09-02T01:28:04Z
- **Tasks:** 2
- **Files modified:** 1

## Measured numbers

| Measure | Before | After |
| --- | --- | --- |
| Runtime cases | 20 | 28 |
| File length | 1025 lines | 1861 lines |
| Lowercase `// arrange` markers | 0 | 28 |
| `t.after()` registrations | 0 | 1 helper, used by 26 of 28 cases |
| Doubles built through `as unknown as` | 9 | 0 |
| Process-wide runner mock trackers | 1 | 0 |

Direct coverage verdict, verbatim.

Before:

```text
Incomplete direct coverage for extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts: branches 54/60, lines 452/461
```

After:

```text
Direct coverage passed: extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts (branches 63/63, functions 13/13, lines 461/461)
```

The branch denominator moved from 60 to 63 because V8 only instruments blocks it
enters; the new cases reach code the old suite never executed, so more branches
became visible at the same time as they were covered.

## Accomplishments

- Rewrote all 20 existing cases and added 8 more, organized as one top-level
  `describe()` per exported entrypoint: `applyBackfillForScopeIsolated` (9 cases),
  `runScopeIsolated` (2), `scanForceInstalledBackfills` (17).
- Retired the process-wide runner mock tracker and all nine `as unknown as`
  doubles. Every double is now a per-case `strong-mock` or a hand-built typed
  record literal with fixed timestamps.
- Every filesystem case asserts three complete values with `deepStrictEqual`:
  the returned outcome list, the state record read back through `loadState`, and
  the scope-root path inventory from the shared `retryTree` helper.
- Closed the six uncovered branches through disk-shaped inputs only: a pristine
  read result, a populated snapshot on the state-file-absent path, an ENOTDIR
  staging target that yields a pre-narrowed failure reason, a `hooks.json`
  carrying `rewakeMessage` without `asyncRewake`, and an unparseable SKILL.md
  frontmatter that degrades the staged skill.

## Task Commits

1. **Task 1 + Task 2: rebuild the owner and close the six branches** - `8f65db35` (test)

Both tasks landed in one commit. Task 1's rewrite and Task 2's new cases are
edits to the same file, and Task 1's verification requires the file to
typecheck and pass as a whole; splitting them would have committed a suite that
could not run.

## Files Created/Modified

- `tests/orchestrators/reconcile/backfill.test.ts` - Sole mirrored owner for
  `orchestrators/reconcile/backfill.ts`. 28 cases across three entrypoint
  `describe()` blocks, each hermetic, each asserting complete whole values.

## Decisions Made

**Drive the module's own exports, not `applyReconcile`.** The old suite ran 14 of
its 20 cases through `applyReconcile`, which made backfill's owner a second
oracle for `reconcile/apply.ts` and for the notify projection. Every case now
calls `applyBackfillForScopeIsolated`, `runScopeIsolated`, or
`scanForceInstalledBackfills` directly. Two of the six uncovered branches are
only reachable this way: they live behind `ScopeReadResult` fields that the
apply read pass never combines.

**Assert structured outcomes, not rendered bytes.** The old cases asserted
`body.includes("hello") && body.includes("(installed)")` against a notification
string. The projection from a `plugin-backfilled` outcome to an `(installed)` row
is `reconcile/notify.ts`'s contract, and P115-07 owns it directly. Backfill's own
contract is the outcome row, so each case now compares the whole row. This is
strictly stronger: a substring check passes for any message containing those
tokens anywhere.

**An empty git allow-list is the offline proof.** `createGitOpsFake({ boundary:
"memory", allowedRemoteUrls: [] })` refuses every remote, and each case also
asserts `clonedUrls()` deep-equals `[]`. The old suite proved NFR-5 in one case
by counting calls on an ad-hoc throwing object; the refusal now applies in all 28.

**The notification boundary promises no call.** Backfill runs `reinstallPlugin`
with `render: "none"` and never notifies, so `createSilentBoundary` states no
expectation at all. I verified this actually fires: an unpromised `ctx.ui.notify`
call and an unpromised `pi.getAllTools()` probe both throw. Note that reading the
`ctx.ui` property alone does not throw, so the header comment says "call", not
"read".

## Deviations from Plan

### 1. [Rule 1 - Bug] The plan's description of the uncovered `??` branch was inverted

- **Found during:** Task 2
- **Issue:** The plan predicted the missing operand was "the fallback ... when the
  outcome carries no reasons at all". The zero-hit record at `backfill.ts:387` is
  the opposite: it is the optional-chain index `outcome.reasons?.[0]`, never
  evaluated because every failure the old suite provoked (a cross-plugin name
  conflict) produces an outcome with NO `reasons` field. The fallback operand was
  already covered.
- **Fix:** Added a case that provokes an ENOTDIR staging failure, which
  `reinstall.ts::reasonsFromTypedError` pre-narrows to `["source missing"]`, so
  `reasons[0]` is read. Kept the conflict case for the fallback arm and retitled
  both to name which arm they exercise.
- **Verification:** Planting `classifyOrchestratorThrow(...)` in place of the
  whole `??` expression turns the new case red; reverted.
- **Committed in:** `8f65db35`

### 2. [Rule 2 - Missing coverage of a stated rule] The ENBL-08 filter had no discriminating case

- **Found during:** Task 2 planting pass
- **Issue:** Deleting the `isRecordedButDisabled(record)` filter from
  `backfillOnePluginIsolated` left the whole suite GREEN. `reinstallPlugin`
  refuses a disabled record on its own, so the caller-side filter's only
  observable difference is that the re-materialize is never called.
- **Fix:** Added "ENBL-08: skips a record the snapshot reports disabled even when
  the stored record is enabled". The scan reads its own snapshot while reinstall
  re-reads fresh state, so the two mechanisms disagree exactly there.
- **Verification:** The new case passes with the filter and fails without it.
- **Committed in:** `8f65db35`

### 3. [Rule 3 - Blocking] The held-lock case hung on a `t.after(release)` hook

- **Found during:** Task 1
- **Issue:** `t.after(release)` passes node's `TestContext` to
  `proper-lockfile`'s `release(options, callback)`, which raised
  "callback is not a function" as asynchronous activity after the test ended and
  stalled the case to the test timeout.
- **Fix:** Release the lock at the end of the act phase instead. That also removes
  a race: node runs after-hooks concurrently, and the scope helper's hook removes
  the directory the lock file lives in.
- **Verification:** The case now runs in ~30 ms; the whole suite in 3.6 s.
- **Committed in:** `8f65db35`

---

**Total deviations:** 3 auto-fixed (1 Rule 1, 1 Rule 2, 1 Rule 3)
**Impact on plan:** No scope creep. Two of the three strengthened proofs the plan
already asked for; the third was a test-harness defect.

## Planted violations

Per the carry-forward instruction, every non-obvious proof was planted against
and confirmed red before reverting. Production was restored with
`git checkout --` after each plant; `git diff -- extensions/` is empty.

| Plant | Case | Result |
| --- | --- | --- |
| Replace `outcome.reasons?.[0] ?? classify(...)` with the fallback alone | pre-narrowed reason | RED |
| Delete `...(resolved.orphanRewake === true && { orphanRewake: true })` | orphan rewake | RED |
| Delete the `degradedKinds` conditional spread | degraded component kinds | RED |
| Delete the `state === undefined` guard outright | pristine scope | RED |
| Replace the guard with `readResult.state ?? emptyState` | pristine scope | **GREEN** |
| Drop `!hasForceInstalledPlugin(state)` from the WR-01 skip | state-file-absent with a recorded partial | RED |
| Replace the strict-superset test with `return true` | longer but not a superset | RED |
| Delete the `isRecordedButDisabled` filter | plain disabled record | **GREEN** |
| Delete the `isRecordedButDisabled` filter | snapshot-disabled, stored-enabled | RED |
| Delete the already-touched dedupe | already represented in the outcomes | RED |

Two plants stayed green, and both are reported rather than papered over.

**The pristine guard is behaviorally redundant with the WR-01 guard for its
outcome.** Replacing `if (state === undefined) return;` with a default empty
state still yields no state.json and no outcome row, because the very next guard
(`!stateExisted && !hasForceInstalledPlugin`) returns for the same input. What
the pristine guard uniquely buys is that a pristine scope is a SILENT skip rather
than a `TypeError` coerced by `runScopeIsolated` into an `invalid-block` row —
which is what deleting it outright proves. The case discriminates that, and it
does not claim more.

**The ENBL-08 caller-side filter needed its own arrangement.** See deviation 2.
The plain disabled case is still worth keeping — the user-facing guarantee that a
disable survives a load is real — but it is now paired with a case that fails when
only the caller-side filter is removed.

## Issues Encountered

**The plan asked for a `t.after()`-owned temporary tree in every case.** The two
`runScopeIsolated` cases own none. That entrypoint reads no file, no environment
variable, and no scope root: it takes a scope, an outcome array, and a callback.
Creating an unused `mkdtemp` root there would be theater. Both cases are hermetic
by construction; a comment above the `describe()` records why. The other 26 cases
each own one `cwd` and one `HOME` root, removed together with the `HOME` and
`PI_CODING_AGENT_DIR` restore in a single `t.after()` registered before the act.

**The plan asked for a dedicated NFR-5 no-network case.** There is no separate one.
The empty git allow-list and the `clonedUrls()` assertion of `[]` are installed in
all 28 cases, which subsumes the single case the old suite carried.

**`npm run check` still short-circuits at `format:check`.** Eight untracked
operator files (`.mcp.json` and seven `.planning/research/.cache/*.json`) fail
Prettier, which stops the chain before its test steps. This is pre-existing and
out of scope; `npm test` (4791 pass, 0 fail) and `npm run test:integration`
(30 pass, 0 fail) were run separately and both are green. `pre-commit run --files`
reports the same two known environmental failures: this trufflehog hook is
git-mode and cannot read a linked worktree's index, and the same `format:check`
noise. The trufflehog scan was cleared through the filesystem route
(`verified_secrets: 0, unverified_secrets: 0`).

**The correspondence gate still reports 15 violations, none of them mine.**
`tests/orchestrators/reconcile/backfill.test.ts` is not among them; the
remaining entries belong to Phases 116 and 117.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`reconcile/backfill.ts` is closed. Two things are worth carrying into P115-05
(`reconcile/apply.ts`), which is the only reconcile owner still outstanding:

- The 14 cases this suite used to run through `applyReconcile` proved apply-tier
  facts (one cascade carrying both a promotion row and an install row, the
  rendered `(installed)` and `(failed)` row bytes, the reload-hint trailer's
  absence). Those facts now have no owner asserting them end to end. They belong
  to `apply.ts`'s owner, which composes the backfill pass; P115-05 should confirm
  it carries them rather than assume this suite still does.
- `createSilentBoundary` and `createOfflineGitOps` are file-local here. If
  P115-05 wants the same two idioms, copy them; `fallow dupes` sits at
  `threshold: 3` and two near-identical copies are still under it, but a third
  would not be.

---
*Phase: 115-composition-orchestrators*
*Completed: 2026-09-01*

## Self-Check: PASSED

- `tests/orchestrators/reconcile/backfill.test.ts` present.
- `.planning/phases/115-composition-orchestrators/115-06-SUMMARY.md` present and uncommitted.
- Commit `8f65db35` present on `features/unit-test-refactor`.
- `git diff 87227cbd HEAD -- extensions/ tests/orchestrators/plugin/scope-tree-inventory.ts` is empty.
- 3 top-level `describe()` blocks, 28 `test()` cases, 28 of each lowercase phase marker.
