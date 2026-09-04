---
phase: 113-orchestrator-support-and-presenters
plan: 20
subsystem: orchestrator-support
tags: [typescript, node-test, filesystem, git-source, direct-coverage]
requires: []
provides:
  - Complete direct ownership of filesystem-only Git source presence and classification probes
  - Exhaustive detached, loose, packed, absent, malformed, and unreadable HEAD evidence
  - Singular owner for manifest and upgrade probe success and failure folding
affects:
  - 113-orchestrator-support-and-presenters verification
  - MOD-06 orchestrator-support ownership
actuals:
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns:
    - Fresh real clone and mirror layouts with case-owned cleanup
    - Complete literal outcomes for filesystem and resolver partitions
key-files:
  created:
    - .planning/phases/113-orchestrator-support-and-presenters/113-20-SUMMARY.md
  modified:
    - tests/orchestrators/plugin/git-source-probe.test.ts
  deleted:
    - tests/orchestrators/plugin/git-source-probe-upgrade.test.ts
    - tests/orchestrators/plugin/mirror-head-read-errors.test.ts
    - tests/orchestrators/plugin/mirror-head-read.test.ts
key-decisions:
  - Replaced live isomorphic-git fixtures with hand-staged filesystem layouts so the direct owner proves offline behavior without Git process or library execution.
  - Kept all four public exports in one alphabetically organized owner with independent lowercase arrange, act, and assert phases.
  - Represented same-version and newer upgrade entries explicitly while asserting the resolver's complete version-independent candidate shapes.
patterns-established:
  - Filesystem probe tests stage only the minimum real directory and ref shape needed by each partition.
  - Error-folding cases distinguish presence failures from resolver failures and assert exact public outcomes.
requirements-completed: [MOD-06]
coverage:
  - id: D1
    description: Mirror HEAD reads cover detached, loose, packed, absent, malformed, unreadable, and unresolved-ref partitions.
    requirement: MOD-06
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/git-source-probe.test.ts#readMirrorHeadSha
        status: pass
    human_judgment: false
  - id: D2
    description: Pinned and unpinned presence probes cover warm, cold, whole-repo, materialized subdir, escaping subdir, missing subdir, and corrupt mirror outcomes.
    requirement: MOD-06
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/git-source-probe.test.ts#makePresenceProbe
        status: pass
    human_judgment: false
  - id: D3
    description: Manifest and upgrade probes cover path and every Git source kind, all classification states, cold candidates, same and newer candidates, and both probe and resolver failure folds.
    requirement: MOD-06
    verification:
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
        status: pass
    human_judgment: false
duration: 16 min
completed: 2026-09-01
status: complete
---

# Phase 113 Plan 20: Git Source Probe Summary

**Git source probing now has one exhaustive filesystem-only owner for mirror HEAD resolution, cache presence, manifest classification, and upgrade-candidate folding at 100% direct coverage.**

## Performance

- **Duration:** 16 min
- **Completed:** 2026-09-01T04:46:24Z
- **Tasks:** 1
- **Files modified:** 1 test file, 3 deleted supplementals, and this summary

## Accomplishments

- Rebuilt the direct owner around 32 independent runtime cases with fresh real filesystem roots, case-owned cleanup, and lowercase arrange, act, and assert phases.
- Covered detached, loose, packed, absent, malformed, unreadable, and unresolved mirror refs without live Git or isomorphic-git.
- Exhausted pinned and unpinned warm/cold cache presence, whole-repository roots, and materialized, escaping, or missing git-subdir roots.
- Proved path and Git manifest classifications across remote, available, partially available, and unavailable results, including corrupt-mirror and unsafe-name folding.
- Proved complete cold, same-version, and newer upgrade candidates plus exact undefined results for presence-probe and resolver failures.
- Closed the paired source at 41/41 branches, 6/6 functions, and 262/262 lines without changing production code.

## Task Commit

1. **Task 1: Complete edge/failure partitions and consolidate supplementals** - `5e04e693` (test)

## Files Created/Modified

- `tests/orchestrators/plugin/git-source-probe.test.ts` - Sole mirrored owner for all four public filesystem-only probe exports.
- `tests/orchestrators/plugin/git-source-probe-upgrade.test.ts` - Deleted after its upgrade success and failure behavior moved into the direct owner.
- `tests/orchestrators/plugin/mirror-head-read-errors.test.ts` - Deleted after its error partitions moved into the direct owner.
- `tests/orchestrators/plugin/mirror-head-read.test.ts` - Deleted after its detached, loose, and packed layouts moved into the direct owner.
- `.planning/phases/113-orchestrator-support-and-presenters/113-20-SUMMARY.md` - Execution, consolidation, security, and verification record.

## Decisions Made

- Hand-staged the exact `.git/HEAD`, loose-ref, and `packed-refs` bytes required by each behavior instead of constructing repositories through isomorphic-git.
- Kept clone-key helpers only for locating real cache directories; expected public results remain complete, independently authored literals.
- Ordered the four public-export suites alphabetically while preserving causal filesystem setup and assertion order inside each case.
- Asserted same-version and newer entries separately even though `probeUpgradeCandidate` returns resolver candidates rather than performing version comparison itself.

## Supplemental Disposition

- `tests/orchestrators/plugin/git-source-probe-upgrade.test.ts` - **DELETED.** Both original upgrade partitions and the complete cold/warm/version/failure matrix now live in the direct owner.
- `tests/orchestrators/plugin/mirror-head-read.test.ts` - **DELETED.** Its healthy detached, loose, and packed layouts now live in the direct owner without live Git fixtures.
- `tests/orchestrators/plugin/mirror-head-read-errors.test.ts` - **DELETED.** Its non-ENOENT and unresolved-ref behavior plus absent and malformed partitions now live in the direct owner.
- `tests/architecture/no-orchestrator-network.test.ts` - **RETAINED UNCHANGED.** It remains the cross-module static owner of the no-network boundary and passes.

## Verification

- The exact Plan 113-20 frozen chain passed: focused owner, three supplemental-absence checks, global typecheck, direct coverage, offline architecture gate, targeted lint and format, structural scan, and scoped diff check.
- The direct owner passed all 32 named runtime cases.
- Direct coverage passed at 41/41 branches, 6/6 functions, and 262/262 lines.
- `tests/architecture/no-orchestrator-network.test.ts` passed its static offline contract.
- No test skip, todo, or only marker; coverage ignore; impossible double assertion; `as any`; uppercase runtime phase; live Git invocation; or production test seam was added.
- The paired production source remained unchanged.

## Deviations from Plan

None - the plan was executed within its assigned test and supplemental scope.

## Issues Encountered

- Node's `EISDIR` read error exposes the error code but not a stable `path` field on this runtime. The unreadable-ref case therefore asserts the behaviorally relevant exact `EISDIR` code; all final gates pass.

## User Setup Required

None.

## Known Stubs

None.

## Security Review

T-113-20 is mitigated: every mutable filesystem layout is isolated under a fresh temporary root and cleaned by its test context; traversal is asserted as a contained `escapes` result; corrupt, missing, malformed, and unreadable refs cannot trigger remote work; and the no-orchestrator-network architecture gate passes. No production test seam, process invocation, credential access, or external network dependency was introduced.

## Next Phase Readiness

P113-20 is complete and ready for phase verification.

## Self-Check: PASSED

- The sole mirrored owner and summary exist; all three assigned supplemental files are absent.
- Only the assigned owner, assigned supplemental deletions, and this summary belong to P113-20.
- Direct coverage is exactly 100% branches, functions, and lines.
- Focused behavior, global typecheck, offline architecture, lint, format, structural, absence, and diff gates pass.
- Commit `5e04e693` contains only the P113-20 owner and assigned supplemental deletions.

---

_Phase: 113-orchestrator-support-and-presenters_
_Completed: 2026-09-01_
