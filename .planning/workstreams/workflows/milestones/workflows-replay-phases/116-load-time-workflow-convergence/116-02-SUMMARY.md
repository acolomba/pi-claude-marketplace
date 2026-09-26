---
phase: 116-load-time-workflow-convergence
plan: 02
subsystem: testing
tags: [reconcile, backfill, node-test, negative-control, nfr-5, mtime, inode]

requires:
  - phase: 116-load-time-workflow-convergence
    provides: "the widened scan (plan 01), whose deletion of the `installable` early return is what makes the disabled filter, the already-touched dedupe and the missing clone-cache resolver load-bearing"
provides:
  - the first case in the backfill suite covering a git-source record — zero outcomes, no failure, empty clone-URL list
  - a disable-shaped already-touched case, pinning that the widened scan cannot re-materialize behind a disable the same load applied
  - "a disabled record is never scanned" as a two-sided MEASURED observation (empty outcomes AND a landed version stamp over a poisoned manifest), with its enabled twin proving the poison visible
  - the one-time bound proved on a frozen {bytes, inode, mtimeNs} triple in both the unit and the integration suite
  - a `sources` override on `writeMarketplaceSource`, so a case can seed a git-shaped manifest entry
affects: [116-03, 116-04, 117, 114 re-verification]

actuals:
  tokens: 5581        # chars/4 over the realized diff, 6b7d9a2e..HEAD
  tasks: 3
  commits: 3          # MEASURED: git rev-list --count 6b7d9a2e..HEAD
plan_head_before: 6b7d9a2e0aa02fe223bf9aaa543b8a852c3e15ca

tech-stack:
  added: []
  patterns:
    - "A measured zero is two-sided: assert the empty observation AND a positive fact downstream that only the not-happening can produce"
    - "Poison the collaborator rather than count the calls — an unreadable manifest turns 'was it read' into an observable with no production seam"
    - "Prove a no-write on a frozen {bytes, inode, mtimeNs} triple compared with one deep equality, so an atomic rewrite of identical content cannot pass"
    - "Control every new gate by planting the removal it is supposed to catch, and record how many cases redden — the count says which existing cases were already inert"

key-files:
  created: []
  modified:
    - tests/orchestrators/reconcile/backfill.test.ts
    - tests/integration/workflow-kind-inversion.test.ts

key-decisions:
  - "Used the manifest-absence probe (research Q6 option A), not the injected `ApplyReconcileOptions` seam. No production file changed."
  - "Seeded the git-source case with BOTH git-shaped sources — the `owner/repo` shorthand and an `https://` URL — since both reach the same missing-resolver arm and neither had any coverage."
  - "Retitled the closed-gate unit case as well as the equal-set one, because its assertion stopped being byte-only."

patterns-established:
  - "Pattern: a `sources` override on the marketplace fixture builder, so a case can vary the manifest entry's source without inlining a whole manifest"
  - "Pattern: run the removal control BEFORE believing a case, and record the full redden count, not just that the new case went red"

requirements-completed: [WCONV-01, WCONV-02, WCONV-03]

coverage:
  - id: D1
    description: "A git-source record whose supported set grew is skipped: no outcome row, no failure, and the counting git fake records no remote at all"
    requirement: WCONV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#NFR-5: skips a git-source record whose supported set grew, and reaches no remote"
        status: pass
    human_judgment: false
  - id: D2
    description: "A record the apply pass disabled earlier in the same load is not re-materialized behind it by the widened scan"
    requirement: WCONV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#RECON-04: does not re-materialize behind a disable the same load already applied"
        status: pass
    human_judgment: false
  - id: D3
    description: "'A disabled record is never scanned' asserted as a measured zero — empty outcomes AND a landed version stamp over a manifest any read of which throws — paired with its enabled twin"
    requirement: WCONV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#ENBL-08 / D-116-03: leaves a disabled record's poisoned manifest unread, so the stamp lands"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#ENBL-08 / D-116-03: reads the same poisoned manifest when the record is enabled, and holds the gate open"
        status: pass
    human_judgment: false
  - id: D4
    description: "The self-heal is one-time: a second load over a converged scope leaves state.json identical in bytes, inode and mtime"
    requirement: WCONV-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#RECON-05: leaves state.json unchanged in bytes, inode and mtime when the recorded stamp already matches"
        status: pass
      - kind: integration
        ref: "tests/integration/workflow-kind-inversion.test.ts#WCONV-01 / WCONV-02: one load converges a record whose kind was invisible, and the next load rewrites nothing"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-09-09
status: complete
---

# Phase 116 Plan 02: Boundaries and one-time proof for the widened scan Summary

**Four cases that fail for four different reasons, each planted and watched go red before it was believed — including the first git-source coverage this suite has ever had and a "never scanned" that is a measured fact rather than a missing row.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-09-09T15:14:54Z
- **Completed:** 2026-09-09T15:41:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- **The git-source bound is now a gate, not an accident.** No case in this suite covered a git-source record. One does now, seeded on BOTH shapes the resolver classifies away from `path` (`acolomba/some-plugin` and an `https://…` URL), each at a set that would grow if reached, asserting zero outcomes, no failure, and `clonedUrls()` deep-equal to `[]`.
- **"A disabled record is never scanned" is a number the suite measured.** The record's marketplace manifest is made unparseable, so any read of it throws. Empty outcomes ALONE would be an absence; the landed version stamp is the positive half, because a scanned record would have thrown, pushed a failure row and held the gate open. Its enabled twin asserts exactly that failure row and the withheld stamp.
- **The one-time bound moved off byte equality.** Both suites now compare a frozen `{bytes, inode, mtimeNs}` triple with one deep equality. The control below shows the unit case going RED on an atomic rewrite of identical content — byte equality passed that same write.
- **The integration twin drives the real reconcile path twice** over the population this phase exists for (`installable: true`, `skills` recorded, nothing unsupported), asserts the FIRST load converged, then asserts the state file and the envelope survive the second load untouched.
- **No production file changed.** The measured zero was built with the manifest-absence probe, so the injected-seam fallback was not needed and `ApplyReconcileOptions` is unchanged.

## Task Commits

1. **Task 1: The two boundaries the widening newly makes load-bearing** — `ab33ecf5` (test)
2. **Task 2: "Never scanned" as a measured zero** — `b40214e1` (test)
3. **Task 3: One-time, proved on bytes, inode and mtime** — `932f8c2d` (test)

## Files Created/Modified

- `tests/orchestrators/reconcile/backfill.test.ts` — four new cases, one retitle-plus-strengthen, one retitle, a `sources` override on the marketplace fixture builder, a `stateSnapshot` triple helper, and the orphaned doc comment moved back onto its function
- `tests/integration/workflow-kind-inversion.test.ts` — the WCONV-01/02 twin and a `fileSnapshot` triple helper, appended to the existing file per D-116-07 (no new integration file)

## Decisions Made

- **The manifest-absence probe, not the injected seam.** Research Q6 offered both. The probe discriminates two-sidedly with zero production change, so option B (a new optional field on `ApplyReconcileOptions`) was not taken and `tests/orchestrators/reconcile/types.test.ts` is untouched.
- **Both git source shapes in one case.** The plan asked for "a `owner/repo` shorthand or an `https://…` URL". Both are seeded, because both reach the same `resolveGitPluginRoot === undefined` arm and neither had coverage; the assertion set is identical either way.
- **The closed-gate unit case was retitled too.** The plan only named the equal-set case for a retitle, but `RECON-05: leaves state.json byte-identical…` stopped being a byte-only assertion the moment Task 3 strengthened it, so its title would have named the weaker check.
- **`Object.freeze` on the snapshot object.** The house precedent (`autoupdate.test.ts`) returns a plain object; the plan's wording is "return one frozen object", so both new helpers freeze.

## What the measured zero actually observes — stated, not glossed

The observable is **the marketplace manifest read**, which on this code path is the first statement of the offline re-resolve (`resolveRecordedPluginOffline` → `loadMarketplaceManifest`). That is **one step downstream of "the resolver was never called"**. A future change that read the manifest before the `isRecordedButDisabled` filter would keep this pair honest about the read while no longer bounding the resolve. The limit is written into the case comment as well as here.

Two facts make the probe sound rather than incidental:

- The manifest cache cannot mask it. `createManifestCache` treats a `stat` failure as a pure miss, the Map is untouched and the loader's error propagates verbatim.
- The filter sits **before** the try block, so a scanned record's throw lands in the per-plugin catch, pushes a `plugin-install-failed` row and returns `true` — which makes `applyBackfillForScope` skip the stamp. Both halves of the observation come from that one structure.

## Negative controls — RUN, with the failing transcripts verbatim

### Control 4 (the one this plan owes): remove the `isRecordedButDisabled` filter

The three-line filter was deleted from `backfillOnePluginIsolated` and the new case run alone.

```
--- filter removed; running the measured-zero case alone ---
▶ applyBackfillForScopeIsolated
  ✖ ENBL-08 / D-116-03: leaves a disabled record's poisoned manifest unread, so the stamp lands (38.819618ms)
✖ applyBackfillForScopeIsolated (43.722515ms)
ℹ tests 1
ℹ suites 1
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2964.89228

✖ failing tests:

test at tests/orchestrators/reconcile/backfill.test.ts:748:3
✖ ENBL-08 / D-116-03: leaves a disabled record's poisoned manifest unread, so the stamp lands (38.819618ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

  + [
  +   {
  +     kind: 'plugin-install-failed',
  +     marketplace: 'mp',
  +     plugin: 'hello',
  +     reason: 'unparseable',
  +     scope: 'project'
  +   }
  + ]
  - []

      at TestContext.<anonymous> (file:///home/acolomba/pi-claude-marketplace-workflows/tests/orchestrators/reconcile/backfill.test.ts:790:12)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Promise.all (index 9)
      at async Suite.run (node:internal/test_runner/test:1905:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ { kind: 'plugin-install-failed', scope: 'project', marketplace: 'mp', plugin: 'hello', reason: 'unparseable' } ],
    expected: [],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }
```

The observation moved off zero: the manifest WAS read, it threw, and a failure row appeared. The filter was restored and the suite re-run green (34/34).

**The redden count is the finding.** With the filter removed the WHOLE suite reddens only twice in 34:

```
  ✖ ENBL-08 / D-116-03: leaves a disabled record's poisoned manifest unread, so the stamp lands (24.061438ms)
  ✖ ENBL-08: skips a record the snapshot reports disabled even when the stored record is enabled (40.5121ms)
ℹ tests 34
ℹ pass 32
ℹ fail 2
```

The pre-existing `ENBL-08: skips a disabled record whose supported set grew` stays **GREEN with the filter deleted** — reinstall's own refusal of a disabled record produces a `skipped` partition, so no row appears either way. That case does not gate the filter; it is satisfied by the second layer. This is exactly the "green because it checks nothing" class the milestone keeps shipping, and it is why the plan asked for a measured zero rather than another missing-row case.

### Control (Task 3): a stale stamp before the second load

Three lines were inserted into the new integration case, forcing `lastReconciledExtensionVersion` back to `"0.0.0"` after the first load and before the snapshot.

```
✖ WCONV-01 / WCONV-02: one load converges a record whose kind was invisible, and the next load rewrites nothing (168.067449ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2878.449877

✖ failing tests:

test at tests/integration/workflow-kind-inversion.test.ts:384:1
✖ WCONV-01 / WCONV-02: one load converges a record whose kind was invisible, and the next load rewrites nothing (168.067449ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  ... Skipped lines

    {
      bytes: '{\n' +
        '  "schemaVersion": 2,\n' +
  +     '  "lastReconciledExtensionVersion": "0.19.0",\n' +
  -     '  "lastReconciledExtensionVersion": "0.0.0",\n' +
        '  "marketplaces": {\n' +
        '    "mp": {\n' +
        '      "name": "mp",\n' +
        '      "scope": "project",\n' +
        '      "source": {\n' +
  ...
        '}\n',
  +   inode: 4067453n,
  +   mtimeNs: 1788968036478969122n
  -   inode: 4067450n,
  -   mtimeNs: 1577836800000000000n
    }
```

The second load re-stamped, so the assertion CAN fail. Restored; the integration suite is 35/35.

### Control (Task 3, additional): an atomic rewrite of identical content

This is the control that proves the strengthening bought something. A `seedState` call was inserted between the snapshot and the act, which rewrites `state.json` atomically with the SAME bytes.

```
▶ applyBackfillForScopeIsolated
  ✖ RECON-05: leaves state.json unchanged in bytes, inode and mtime when the recorded stamp already matches (40.516746ms)
✖ applyBackfillForScopeIsolated (44.979325ms)
ℹ tests 1
ℹ suites 1
ℹ pass 0
ℹ fail 1

✖ failing tests:

test at tests/orchestrators/reconcile/backfill.test.ts:471:3
✖ RECON-05: leaves state.json unchanged in bytes, inode and mtime when the recorded stamp already matches (40.516746ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  ... Skipped lines

    {
      bytes: '{\n' +
        '  "schemaVersion": 2,\n' +
        '  "lastReconciledExtensionVersion": "0.19.0",\n' +
        '  "marketplaces": {\n' +
  ...
        '}\n',
  +   inode: 4066474n,
  +   mtimeNs: 1788967966342417567n
  -   inode: 4066473n,
  -   mtimeNs: 1788967966337417456n
    }
```

The `bytes` field is **identical** on both sides; only `inode` and `mtimeNs` moved. The former byte-equality assertion passed this write. Restored; 34/34.

### Control (Task 1, additional): the two new boundary cases are wired

- **Git-source case.** Swapping the two git sources for the default relative paths reddens it with two `plugin-backfilled` rows, so the seed genuinely WOULD grow and the case is not passing because the growth test skipped the records.
- **Disable-shaped already-touched case.** Dropping the pre-seeded `plugin-disabled` outcome reddens it. Removing the `alreadyTouched` dedupe from production reddens exactly two cases in 34 — the pre-existing generic one and the new disable-shaped one — so the new case gates the mechanism rather than restating it.

## The inherited comment-defect claim, re-measured

`STATE.md:383-386` records: *"A pre-existing bare planning-artifact token sits at `tests/orchestrators/reconcile/backfill.test.ts:320` (commit `c695bdab3`). Phase 116 edits that file, so the token is now in reach — clean it there rather than leaving it."*

**That claim is stale, and the correction is recorded rather than carried.** Measured this session:

- At `c695bdab3` the token was real: line 318 of that revision read `// Pitfall 4 / D-68-03: stamp closes the gate even with nothing backfilled.` — a bare `Pitfall N`, forbidden by `.claude/rules/typescript-comments.md`.
- On the current tree, line 320 is `return [];` inside `savedWorkflowEntries`. A `grep -nE "Phase [0-9]|Plan [0-9]|Wave [0-9]|Pitfall [0-9]|Pattern [0-9]"` over the whole file returns **nothing**. The file was substantially rewritten between that commit and now, and the token went with the rewrite.

**What was actually there is what the plan described, not what STATE described:** an orphaned doc comment. `/** A seeded scope that has been read but not re-materialized. */` sat at line 309 describing `seededScopeTree` (line 324), separated from it when `savedWorkflowEntries` and its own doc block were inserted between the two. The comment has been moved back onto `seededScopeTree`. STATE.md's bullet should be struck or rewritten by whoever next edits it; the defect it names no longer exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — assertion weaker than its title] Retitled the closed-gate case the plan did not name**

- **Found during:** Task 3
- **Issue:** The plan named only the equal-set case for a retitle. But Task 3 changes `RECON-05: leaves state.json byte-identical when the recorded stamp already matches` from byte equality to the triple, and "byte-identical" then names the weaker of the two checks the case performs — the same class of defect as a title naming a deleted filter.
- **Fix:** Retitled to `RECON-05: leaves state.json unchanged in bytes, inode and mtime when the recorded stamp already matches`. The case body's other assertions are unchanged.
- **Files modified:** `tests/orchestrators/reconcile/backfill.test.ts`
- **Verification:** `node --test tests/orchestrators/reconcile/backfill.test.ts` → 34/34.
- **Committed in:** `932f8c2d`

**2. [Rule 2 — enumeration shorter than the set] The git-source case covers two source shapes, not one**

- **Found during:** Task 1
- **Issue:** The plan said "either a `owner/repo` shorthand or an `https://…` URL". Both classify away from `path` and both reach the same missing-clone-resolver arm, and neither had any coverage in this suite; picking one would have left the other unpinned for no saving.
- **Fix:** The case seeds both, in one manifest, both at a would-grow set.
- **Files modified:** `tests/orchestrators/reconcile/backfill.test.ts`
- **Verification:** Swapping both sources for path sources reddens the case with two promotion rows.
- **Committed in:** `ab33ecf5`

**3. [Rule 1 — stale inherited claim] STATE.md's comment-defect description does not match the tree**

- **Found during:** Task 1
- **Issue:** STATE.md names a bare planning-artifact token at `:320`. The token no longer exists anywhere in the file; the actual defect is the orphaned doc comment the plan described.
- **Fix:** Fixed what is actually there (moved the comment back onto `seededScopeTree`) and recorded the correction above rather than restating STATE's claim.
- **Files modified:** `tests/orchestrators/reconcile/backfill.test.ts`
- **Verification:** `grep -nE "Phase [0-9]|Plan [0-9]|Wave [0-9]|Pitfall [0-9]|Pattern [0-9]"` over the file returns nothing; `git show c695bdab3:…` confirms the token existed at that revision.
- **Committed in:** `ab33ecf5`

---

**Total deviations:** 3 auto-fixed (2 × Rule 2, 1 × Rule 1).
**Impact on plan:** none on scope and none on any prohibition. No production file changed, no module-global counter, no mock on a production module, no `times(0)`, no new file under `tests/`, and no new top-level test directory.

## Issues Encountered

- **Trufflehog's git-mode pre-commit hook aborts structurally in this worktree** (`.git` is a file, so `failed to read index file: … not a directory`). Handled per `CLAUDE.md`: a filesystem scan over exactly the paths being committed ran before each of the three commits, each returning `verified_secrets: 0, unverified_secrets: 0`, and only then `SKIP=trufflehog`. No other hook was skipped, `--no-verify` was never used, nothing was amended or rebased, no `git add -A` was run.
- **The prettier and mdformat hooks rewrote nothing.** `git status` after each commit showed only the operator's own pre-existing files (`.claude/settings.json`, `.codex/config.toml`, `STATE.md`, and six untracked paths), all untouched.
- **`npm run check` was deliberately NOT run** — plan 116-04 owns that gate. The `npm-fallow`, `npm-lint`, `npm-format-check` and `npm-typecheck` pre-commit hooks ran green on every commit, so the whole-tree fallow scan is green at each of the three intermediate trees. No fallow duplication finding was raised by the two new `{bytes, inode, mtimeNs}` helpers, despite a fourth and fifth near-copy of a shape that already existed in three suites.

## Verification Run

| Gate | Result |
|---|---|
| `node --test tests/orchestrators/reconcile/backfill.test.ts` | 34/34, fail 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 5650/5650, fail 0 |
| `npm run test:integration` | 35/35, fail 0 |
| `node scripts/test-coverage-direct.mjs …/reconcile/backfill.ts` | branches 61/61, functions 13/13, lines 477/477 — 100% |
| `pre-commit run --files <staged paths>` before each commit | all hooks pass except the structurally-broken trufflehog |
| Negative controls | 4 run, all RED as designed, all restored |

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- **116-03** is unaffected: this plan touched neither the catalog pair, the two `shared/notify*` modules, nor the closed-set lock test. `npm test` at 5650 is the count 116-03 should expect as its own baseline before its amendments.
- **116-04** owns `npm run check` and the per-pair coverage runs. The backfill pair is already at 100% on all three axes, run alone, so 116-04's coverage obligation for that file is met at this tree.
- **Carried into 116-04's re-read, not fixed here:** the pre-existing `ENBL-08: skips a disabled record whose supported set grew` case is satisfied by reinstall's refusal rather than by the filter it names, as the control above shows. It is not wrong — it pins the second layer — but its title claims more than it gates. Renaming it was outside this plan's action.
- **STATE.md's inherited comment-defect bullet is now stale** and should be struck; the correction is recorded above.
- **The path-source population claim (`116-VALIDATION.md`, manual-only row) is still open.** This plan pins the git-source BOUND — a git-source record is skipped with no clone — which is the tree-side half. Whether the two Anthropic-authored workflow plugins are path- or git-source is a fact about upstream repositories and was not measured here.

---
*Phase: 116-load-time-workflow-convergence*
*Completed: 2026-09-09*

## Self-Check: PASSED

Both modified files exist. All three task commits (`ab33ecf5`, `b40214e1`, `932f8c2d`) are
reachable from `git log --all`. All six named case titles are present in the two files.
`extensions/` carries no working-tree change, so the "no production file changed" claim is
measured rather than asserted. Greps for `times(0)`, `_setXForTest` and `t.mock.method`
across both files return nothing.
