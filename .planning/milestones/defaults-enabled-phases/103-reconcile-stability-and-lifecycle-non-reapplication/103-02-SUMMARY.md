---
phase: 103-reconcile-stability-and-lifecycle-non-reapplication
plan: 02
subsystem: testing
tags: [node-test, architecture-gate, source-scan, manifest-cache, defaultEnabled]

# Dependency graph
requires:
  - phase: 102
    provides: "the DFEN-04 install-disabled path and the `entryDefaultEnabled` fixture idiom in install.test.ts"
provides:
  - "tests/architecture/no-lifecycle-default-enabled-read.test.ts — the DFEN-07 source-level gate over update.ts and reinstall.ts"
  - "an `entryDefaultEnabled` knob on update.test.ts's seedPathMarketplace and rewriteManifest"
  - "an `omitPluginJsonVersion` knob on update.test.ts's seedPathMarketplace"
  - "the DFEN-07 / D-103-10 manifest-flip case for `update`, with a manifest-sourced version control"
affects: [103-03, 103-05, 105]

actuals:
  tokens: 86000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Architecture gate delegating read/comment-strip/offender-accumulate to tests/helpers/source-scan.ts::assertNoForbiddenSurface (D-98-09)"
    - "Manifest-flip characterization with a manifest-sourced version bump as the cache control"

key-files:
  created:
    - tests/architecture/no-lifecycle-default-enabled-read.test.ts
  modified:
    - tests/orchestrators/plugin/update.test.ts

key-decisions:
  - "The gate lists two independent word-boundary patterns; a \\b match on `defaultEnabled` does not fire inside `applyDefaultEnabled`, confirmed empirically by two separate mutation runs."
  - "No `allowMissing` entry: a renamed or deleted target must fail the gate (WR-06)."
  - "The mutation check was run against `update.ts` rather than `reinstall.ts`, because plan 103-03 held `reinstall.ts` open in the same wave."
  - "seedPathMarketplace gained a third knob, `omitPluginJsonVersion`, so the version control is sourced from the marketplace ENTRY rather than from plugin.json — otherwise the control proves the wrong file was re-read."

patterns-established:
  - "New architecture gates get their own file with their own requirement IDs rather than a clause bolted onto an unrelated gate."
  - "A lifecycle characterization that depends on a third-party file being re-read carries a control asserting the re-read happened."

requirements-completed: [DFEN-07]

coverage:
  - id: D1
    description: "A source-level gate asserts that orchestrators/plugin/update.ts and orchestrators/plugin/reinstall.ts reference neither `defaultEnabled` nor `applyDefaultEnabled`, fails loudly if either target is renamed or deleted, and forbids neither `resolveStrict` nor a comment explaining the rule."
    requirement: DFEN-07
    verification:
      - kind: unit
        ref: "tests/architecture/no-lifecycle-default-enabled-read.test.ts#DFEN-07 (D-103-08, D-103-09): the lifecycle verbs never name the declared-enablement field"
        status: pass
      - kind: unit
        ref: "node --test \"tests/architecture/**/*.test.ts\" (353 pass, 0 fail, 1 pre-existing skip)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`update` against a marketplace entry whose `defaultEnabled` was flipped false→true between the install and the update leaves an install-disabled record at `enabled: false`, renders the inherited `(skipped) {already disabled}` row, and leaves the ENBL-18 inventory unmoved — with the entry version bumped in the same rewrite and asserted to have reached the record, so a stale manifest cache fails the case instead of passing it."
    requirement: DFEN-07
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#DFEN-07 / D-103-10: update against a flipped defaultEnabled moves the version, not the enablement"
        status: pass
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/update.test.ts (100 pass, 0 fail)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The gate was observed FAILING against a deliberately introduced read, not merely observed passing."
    verification:
      - kind: manual_procedural
        ref: "uncommitted append to orchestrators/plugin/update.ts, run twice (one token each), file restored from a byte copy; `git diff -- extensions/` empty after each"
        status: pass
    human_judgment: false

duration: 34min
completed: 2026-08-15
status: complete
---

# Phase 103 Plan 02: DFEN-07 pinned at the source and at the behavior Summary

**A source-level gate that fails the moment either lifecycle verb names the declared-enablement field, plus an `update` case driven by a mid-flight manifest flip whose entry-version bump proves the flip was actually read.**

## Performance

- **Duration:** ~34 min
- **Started:** 2026-08-15T07:52Z
- **Completed:** 2026-08-15T08:26Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `tests/architecture/no-lifecycle-default-enabled-read.test.ts` gates `orchestrators/plugin/{update,reinstall}.ts` against `defaultEnabled` and `applyDefaultEnabled`, delegating its whole mechanic to `assertNoForbiddenSurface`. It names no `allowMissing` target, so a rename fails the gate rather than uncovering it.
- The gate was **seen failing**, twice, once per pattern — see "Mutation check" below.
- `update.test.ts` gained the DFEN-07 / D-103-10 case: install with the entry declaring `false`, rewrite the entry to `2.0.0` + `true` in one call, `update`, then assert the version moved (control) and the enablement did not (requirement), with the `(skipped) {already disabled}` row and an unmoved ENBL-18 inventory.
- Three additive, defaulted fixture knobs; every one of the 100 pre-existing cases in `update.test.ts` still passes.

## Task Commits

1. **Task 1: the source-level gate** — `e0d7dfe9` (test)
2. **Task 2: `update` against a flipped manifest** — `8eb5f74f` (test)

## Files Created/Modified

- `tests/architecture/no-lifecycle-default-enabled-read.test.ts` — the DFEN-07 gate: two targets, two patterns, one `test()`, and a doc comment carrying the exempt list (`install.ts`, `enable-disable.ts`), the `resolveStrict` carve-out, the pattern-independence argument, and the comment-strip rationale.
- `tests/orchestrators/plugin/update.test.ts` — `installPlugin` import; `entryDefaultEnabled` on `seedPathMarketplace` and `rewriteManifest`; `omitPluginJsonVersion` on `seedPathMarketplace`; the DFEN-07 / D-103-10 case beside the D-UPD disabled-record family.

## Mutation check (acceptance criterion, manual and uncommitted)

Run against `orchestrators/plugin/update.ts` rather than `reinstall.ts` — see Deviation 1. The file was copied to the scratchpad first and restored from that copy, and `git diff --name-only -- extensions/` was empty after each run.

1. Appended `const dfenProbe = resolved.defaultEnabled;`. The gate failed with:
   `DFEN-07 violation: a re-materializing lifecycle verb names the declared-enablement field:` followed by
   `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts matches forbidden defaultEnabled reference: /\bdefaultEnabled\b/`
   and the closing hint that enablement comes from the RECORD.
2. Appended `const dfenProbe = { applyDefaultEnabled: true };`. The gate failed naming **only** `applyDefaultEnabled reference` — the `defaultEnabled reference` pattern did **not** fire. That is the pattern-independence claim, measured rather than argued: neither pattern subsumes the other, so removing either leaves a real hole.

## Decisions Made

- **The version control had to be manifest-sourced.** See Deviation 2. `plugin.json` is tier 1 of the SNM-34 ladder, so bumping it would have produced a control that proves `plugin.json` was re-read — which says nothing about the `marketplace.json` cache the control exists to defeat.
- **No cache-invalidation call.** `dropMarketplaceCache` appears nowhere in the new case (its two occurrences in `update.test.ts` are pre-existing prose in an unrelated comment at `:2089`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The mutation check was run against `update.ts`, not `reinstall.ts`**

- **Found during:** Task 1
- **Issue:** The acceptance criterion names `reinstall.ts` as the mutation target, but plan `103-03` was editing that exact file concurrently in this wave. Appending and reverting a line there could have clobbered a sibling's in-flight edit.
- **Fix:** Ran the identical check against the gate's other target, `update.ts`, which no sibling in this wave touches. The gate treats both targets identically, so the check proves the same thing.
- **Files modified:** none persisted — a byte copy was taken before each append and restored after.
- **Verification:** `git diff --name-only -- extensions/` empty after both runs.
- **Committed in:** nothing to commit (the check is deliberately uncommitted).

**2. [Rule 1 - Bug] The planned version control would have proved the wrong thing**

- **Found during:** Task 2
- **Issue:** The plan specifies two fixture knobs and a version bump on the marketplace ENTRY as the control. But `seedPathMarketplace` writes the plugin's own `plugin.json` with `version: spec.version`, and `resolvePluginVersion` puts `plugin.json` at tier 1 above `entry.version` (`orchestrators/plugin/shared.ts:638-664`). With `plugin.json` carrying a version, an entry-version bump never reaches the record at all — so the case would have had to bump `plugin.json` too, and a version that moved would then prove `plugin.json` was re-read. The manifest cache the control exists to defeat is keyed on `marketplace.json`'s `(mtimeMs, size)`, so that control would have been silent about exactly the failure it was written for.
- **Fix:** Added a third additive, defaulted knob, `omitPluginJsonVersion`, which writes `plugin.json` without a `version` field so tier 2 (`entry.version`) decides. The record then reads `1.2.3` after the install and `2.0.0` after the update, from the manifest and from nothing else.
- **Files modified:** `tests/orchestrators/plugin/update.test.ts`
- **Verification:** The case asserts both versions; `plugin.json` is never rewritten, so `2.0.0` can only have come from the re-read manifest.
- **Committed in:** `8eb5f74f`

---

**Total deviations:** 2 auto-fixed (1 blocking / coordination, 1 correctness).
**Impact on plan:** Neither changes what the plan proves. Deviation 2 makes the plan's own stated control (`must_haves.truths`: "a stale manifest cache therefore fails the test loudly") actually true, which the two-knob form would not have been.

## Issues Encountered

- **The wave shares one scratchpad directory.** A sibling agent overwrote the commit-message file at the generic path used for the Task 1 commit, after that commit had already landed. Task 2 used a plan-scoped filename. No commit was affected; recording it so the next parallel wave namespaces its scratch files.
- **`git diff --name-only -- extensions/` is not empty in this worktree**, but every entry belongs to a sibling (`reinstall.ts`, `enable-disable.ts`, `shared.ts`, `reconcile/apply.ts`). It was empty for both of this plan's tasks — verified immediately after each mutation-check restore, before the siblings' edits landed.

## Verification Status

| Command | Result |
|---|---|
| `node --test tests/architecture/no-lifecycle-default-enabled-read.test.ts` | 1 pass, 0 fail |
| `node --test "tests/architecture/**/*.test.ts"` | 353 pass, 0 fail, 1 pre-existing skip |
| `node --test tests/orchestrators/plugin/update.test.ts` | 100 pass, 0 fail |
| `node --test tests/orchestrators/plugin/update.test.ts tests/orchestrators/marketplace/update.test.ts` | 155 pass, 0 fail |
| `npm run typecheck` | clean |
| `eslint` over both changed files | clean |
| `prettier --check` over both changed files | clean |
| Gate grep criteria (`assertNoForbiddenSurface` 2, `readFile\|stripComments` 0, `allowMissing` 0, `orchestrators/plugin/` 2, comment lines excluded) | all four exact |

`npm run check` was deliberately NOT run: plan `103-05` owns the phase-boundary gate, and three siblings were mid-edit in this worktree.

## Note for the wave-3 boundary gate

The gate reads the source of `orchestrators/plugin/reinstall.ts`, which plan `103-03` edits in this same wave. It was green against that file at the time of this plan's commits. `103-03` adds a disabled-record short-circuit and touches nothing about the manifest field, so the gate is expected to stay green — but it is a genuine cross-plan coupling and the boundary run is the one that settles it.

## User Setup Required

None.

## Next Phase Readiness

- DFEN-07 is pinned for `update` at both the source and the behavior. The `reinstall` behavioral half is plan `103-03`'s (`103-03-T3`), against an ENABLED record, because `reinstall` today re-enables a disabled one — the defect D-103-12 fixes.
- The `entryDefaultEnabled` knob now exists in `update.test.ts` on the same shape `install.test.ts` and `apply.test.ts` already use; `reinstall.test.ts` and `enable-disable.test.ts` add their own in sibling plans.

## Self-Check: PASSED

Both created/modified files exist on disk and both commit hashes (`e0d7dfe9`, `8eb5f74f`) resolve in `git log --all`.

---
*Phase: 103-reconcile-stability-and-lifecycle-non-reapplication*
*Completed: 2026-08-15*
