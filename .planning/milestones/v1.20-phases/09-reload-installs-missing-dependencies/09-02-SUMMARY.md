---
phase: 09-reload-installs-missing-dependencies
plan: 02
subsystem: reconcile
tags: [dependency-resolution, install-cascade, version-range, closed-set-reason]

# Dependency graph
requires:
  - phase: 03-dependency-resolution
    provides: runInstallCascade, resolveMemberConstraints, intersectDependencyRanges, the RESV-03/RESV-05 constraint fold site
  - phase: 08-enablement-parity-for-dependencies
    provides: liveInstalledKeys, the EDEP-03 disabled-record read-through the wall option reverses
provides:
  - InstallCascadeOptions.rootRanges and MemberConstraintOptions.rootRanges, folded into the root member's own (empty) range list at the cascade's one existing fold site
  - the effectiveRanges helper, the single site a root's caller-supplied ranges and a member's declared ranges combine
  - InstallCascadeOptions.treatDisabledAsWall, which keeps a recorded DISABLED key in installedKeys instead of stripping it through liveInstalledKeys
affects: [09-03-apply-step-and-reason-threading]

# Actuals (#2632)
actuals:
  tokens: 4719
  tasks: 2
  commits: 2
  plan_head_before: 105dfd11

tech-stack:
  added: []
  patterns:
    - "One fold site, not two: the root's caller-supplied ranges combine with a member's declared ranges through effectiveRanges, then the SAME intersectDependencyRanges call every member already goes through -- no second range evaluator."
    - "A cascade-level boolean input (treatDisabledAsWall) swaps which installedKeys set the closure walk receives, rather than adding a branch inside the walk itself."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - tests/orchestrators/plugin/install-cascade.test.ts

key-decisions:
  - "D-09-05: effectiveRanges(options, member) returns [...options.rootRanges, ...member.ranges] only when member.key === options.rootKey and rootRanges is defined, else member.ranges unchanged -- called once, in resolveOneMember, and toIntersectionFailure is widened to (key, ranges, failed) so a root-range fold failure still names the root's texts. checkInstalledMember stays root-unaware, per the plan's instruction: disabledRecordOf already exempts the root and the walk never skips it, so a root branch there would be unreachable and the direct-coverage gate would refuse it."
  - "D-09-04: treatDisabledAsWall is read at exactly one site -- the installedKeys argument to resolveDependencyClosure -- choosing options.installedKeys unchanged when the flag is set, else the existing liveInstalledKeys(...) strip. No change to disabledRecordOf, checkRecordedMembers, or the re-enable phase builder: a walled key never reaches the closure at all, so those functions never see it."
  - "Commit split: both tasks touch the same two files in disjoint regions (header paragraphs, sibling interface fields, a sibling call site), so the two commits were produced by implementing both tasks, then temporarily reverting Task 2's hunks, verifying Task 1 alone (100% branch coverage, since removing treatDisabledAsWall removes its own ternary rather than leaving an uncovered branch), committing, and reapplying Task 2's hunks for its own commit -- the same method 09-01-SUMMARY.md recorded for its plan.ts/notify.ts split."

requirements-completed: []  # MISS-01 is also declared by sibling plans 09-01/09-03/09-04 (shared-ID gate); not marked complete until every declaring plan finishes.

coverage:
  - id: D1
    description: "InstallCascadeOptions.rootRanges folds into the root member's own (empty) range list at the cascade's existing fold site: a git-source root reaches the tag probe with the folded range, a path-source root reaches the marketplace tag probe, a wildcard or empty list makes no query, and a fold that fails on the root's texts fails the cascade as range-conflict before anything materializes"
    requirement: MISS-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#D-09-05: a root range pins the root through the tag probe like a constrained member"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#D-09-05: a root range on a path-source root reaches the marketplace tag probe"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#D-09-05: a wildcard root range makes no query"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#D-09-05 / T-06-10: contradictory root ranges fail the cascade as a range conflict before anything materializes"
        status: pass
    human_judgment: false
  - id: D2
    description: "InstallCascadeOptions.treatDisabledAsWall keeps a recorded DISABLED key in installedKeys: the walk stops there, produces no re-enable phase, never rewrites the record, the key appears in alreadyInstalled, and its own declarations are never looked up -- while the RESV-05 constraint check still runs over the walled record"
    requirement: MISS-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#D-09-04: a disabled record is a wall when the caller says so"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#D-09-04 / RESV-05: a walled disabled record still answers to the root's constraint"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#EDEP-03 a disabled already-installed dependency's record ends enabled, materialized under the new marker"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every pre-existing install-cascade.test.ts case (78 before this plan's own 6 new cases) passes unchanged: a call that omits rootRanges and treatDisabledAsWall behaves byte-for-byte as before"
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/install-cascade.test.ts (80/80 passing, 74 pre-existing plus the 6 this plan added)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct:commit (install-cascade.ts branches 138/138, functions 25/25, lines 1241/1241)"
        status: pass
    human_judgment: false

# Metrics
duration: 50min
completed: 2026-09-22
status: complete
---

# Phase 9 Plan 2: Install cascade root-range pinning and the disabled-as-wall option Summary

**`InstallCascadeOptions` gains `rootRanges` (folded into the root member's own range list at the existing fold site, so a missing dependency's root is pinned like a constrained member) and `treatDisabledAsWall` (keeps a disabled record a wall for the reload path instead of a read-through member), both additive and both byte-for-byte inert when omitted.**

## Performance

- **Duration:** 50 min (approx.)
- **Started:** 2026-09-22T04:15:00Z (approx.)
- **Completed:** 2026-09-22T05:05:00Z (approx.)
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `effectiveRanges(options, member)` is the one new fold site: it returns the root's caller-supplied ranges concatenated with the root member's own (empty) list only when the member IS the root, else the member's own ranges unchanged -- called once, from `resolveOneMember`, before the existing `intersectDependencyRanges` call.
- `toIntersectionFailure` is widened from `(member, failed)` to `(key, ranges, failed)` so a fold failure on the root's caller-supplied texts (contradictory declarations, an oversized union, an unparseable range) still reaches the existing `range-conflict` / `range-too-complex` / `range-invalid` arms and names those texts in the rendered range. `checkInstalledMember`'s call site was updated to pass `member.key, member.ranges` directly -- it stays root-unaware by design, since `disabledRecordOf` already exempts the root from ever reaching that function.
- `InstallCascadeOptions.treatDisabledAsWall` is read at exactly one site inside `runInstallCascade`: the `installedKeys` argument handed to `resolveDependencyClosure` is `options.installedKeys` unchanged when the flag is `true`, else the pre-existing `liveInstalledKeys(options.state, options.installedKeys)` strip. A walled disabled key therefore never reaches the closure walk at all -- it lands in `alreadyInstalled` via the walk's own already-installed guard, and the pre-existing `checkRecordedMembers` RESV-05 check (which already iterates `alreadyInstalled`) answers its recorded version against the effective constraint with no code change of its own.
- Six new test cases prove both inputs end to end against the real closure walk and constraint resolver: two for a git-source and a path-source root pinned by `rootRanges`, one for the wildcard no-query case, one for a contradictory-root-ranges failure, and two for `treatDisabledAsWall` (the wall itself, and RESV-05 still firing on a walled record's recorded version).
- Every one of the 74 pre-existing `install-cascade.test.ts` cases -- including the EDEP-03 re-enable case both new options are designed never to touch -- passes unchanged.

## Task Commits

1. **Task 1: root-range pinning** - `832b0abe` (feat) - `InstallCascadeOptions.rootRanges`, `MemberConstraintOptions.rootRanges`, `effectiveRanges`, the widened `toIntersectionFailure`, 4 new test cases
2. **Task 2: disabled-as-wall option** - `c6a972c4` (feat) - `InstallCascadeOptions.treatDisabledAsWall`, the `runInstallCascade` `installedKeys` ternary, 2 new test cases

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` - `rootRanges` (both option interfaces), `effectiveRanges`, the widened `toIntersectionFailure`, `treatDisabledAsWall`, the `installedKeys` ternary in `runInstallCascade`, and two header paragraphs (D-09-05, D-09-04)
- `tests/orchestrators/plugin/install-cascade.test.ts` - 6 new cases covering both options end to end, using the existing `tagProbeAnswering`, `marketplaceTagProbeAnswering`, `recordingLedgerSeam`, `twoScopeFootprint`, and `seedOneDisabledDependency` harness helpers

## Decisions Made
See `key-decisions` in the frontmatter for the fold-site placement, the root-unaware `checkInstalledMember` call site, the single `treatDisabledAsWall` read site, and the commit-split method.

## Deviations from Plan

None - plan executed exactly as written. The two acceptance-criteria greps (`rootRanges` >= 4, `treatDisabledAsWall` >= 2) and the third grep (exactly two `intersectDependencyRanges(` call sites, no third fold site) all passed on the first implementation; no fix-and-retry cycle was needed.

## Issues Encountered

- **First implementation of the wildcard-root test omitted a ledger seam.** Without an injected `seam`, the root member (git-sourced, unconstrained by the wildcard) would have reached the real `runInstallLedger` and attempted an actual network clone of the fixture's `https://example.com/org/repo` URL, failing as `member-failed`. Added `seam: recordingLedgerSeam(...)`, matching the pre-existing `RESV-03 a dependency declared with ${label} makes no tag query` loop's own pattern. Caught immediately by the first test run; no production code was at fault.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09-03 (the apply step and reason threading) can now call `runInstallCascade` with `rootRanges` set to the bucket entry's folded declarer ranges and `treatDisabledAsWall: true` for the reload path's new entry point, exactly as D-09-05 and D-09-04 specify.
- MISS-01 remains `Pending` in `REQUIREMENTS.md`: it is declared by sibling plans (09-01 already summarized; 09-03/09-04 not yet), so the shared-ID gate correctly withholds `Complete` until the last declaring plan finishes.
- No blockers.

## Self-Check: PASSED

Both key files (`extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`, `tests/orchestrators/plugin/install-cascade.test.ts`) confirmed present on disk. Both task commits (`832b0abe`, `c6a972c4`) confirmed present in `git log --oneline --all`.

---
*Phase: 09-reload-installs-missing-dependencies*
*Completed: 2026-09-22*
