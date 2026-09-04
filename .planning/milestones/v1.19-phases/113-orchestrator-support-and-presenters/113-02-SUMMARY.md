---
phase: 113-orchestrator-support-and-presenters
plan: 02
subsystem: orchestrator-resource-discovery
tags: [typescript, node-test, filesystem, symlink-safety, direct-coverage]
requires: []
provides:
  - Deterministic aggregate discovery across user and project resource trees
  - Exact filtering for skills, prompts, hidden entries, non-files, and symlinks
  - Four-read hard-failure aggregation in declared traversal order
affects:
  - 113-orchestrator-support-and-presenters verification
  - MOD-06 orchestrator-support ownership
actuals:
  tokens: 4038
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns:
    - Canonical ScopedLocations factories with synchronously restored user-directory environment state
    - Stable real-filesystem partitions with complete expected outputs and deterministic malformed-path failures
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/discover.ts
    - tests/orchestrators/discover.test.ts
key-decisions:
  - Refactored entry classification to lstat each visible candidate so stable symlink fixtures exercise the TOCTOU guards.
  - Read each real skill directory for SKILL.md metadata, preserving missing-file exclusion while propagating directory-read failures.
  - Retained the bridge skills discovery suite unchanged as the separate owner of bridges/skills/discover.ts, not as supplemental coverage for the aggregate orchestrator.
patterns-established:
  - Aggregate filesystem owners use one fresh temp root per case and restore ambient path configuration synchronously.
  - Cross-scope order is asserted as user then project, with alphabetic order asserted only within each directory.
requirements-completed: [MOD-06]
coverage:
  - id: D1
    description: Aggregate discovery returns complete frozen skill and prompt lists in user-before-project and per-directory alphabetic order while excluding every unsupported filesystem shape.
    requirement: MOD-06
    verification:
      - kind: unit
        ref: tests/orchestrators/discover.test.ts#aggregateDiscoveredResources keeps scope order and sorts within each resource directory
        status: pass
      - kind: unit
        ref: tests/orchestrators/discover.test.ts#aggregateDiscoveredResources excludes hidden, nonmatching, nondirectory, and symlink entries
        status: pass
    human_judgment: false
  - id: D2
    description: Missing and ENOTDIR paths soft-skip, while all four hard reads are attempted and reported in exact skills-then-prompts traversal order.
    requirement: MOD-06
    verification:
      - kind: unit
        ref: tests/orchestrators/discover.test.ts#aggregateDiscoveredResources aggregates all four hard read failures in traversal order
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/discover.ts
        status: pass
    human_judgment: false
duration: 30 min
completed: 2026-08-31
status: complete
---

# Phase 113 Plan 02: Aggregate resource discovery summary

**Aggregate resource discovery now proves deterministic ordering, exhaustive real-filesystem filtering, frozen outputs, and ordered four-read error aggregation at 100% direct coverage.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-01T03:09:00Z
- **Completed:** 2026-09-01T03:39:10Z
- **Tasks:** 1
- **Files modified:** 2 implementation files

## Accomplishments

- Replaced the casted location stub, shared production cleanup helper, permission mutation, and platform skip with canonical locations and one self-cleaning real temp root per case.
- Proved user-before-project order, per-directory sorting, frozen complete arrays, missing and ENOTDIR soft skips, every skill and prompt entry shape, and exact four-read hard-failure aggregation.
- Preserved symlink/TOCTOU safety while making directory links, file links, non-directory entries, missing or non-file `SKILL.md`, and regular markdown files reachable through stable fixtures.
- Closed the direct owner at 36/36 branches, 7/7 functions, and 122/122 lines.

## Task Commits

1. **Task 1: Exhaust partitions, consolidate ownership, and close direct coverage** - `9c45b542`

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/discover.ts` - Classifies visible skill and prompt candidates after `lstat`, retains symlink rejection, and discovers `SKILL.md` through real directory entries.
- `tests/orchestrators/discover.test.ts` - Canonical P113-02 owner with five isolated real-filesystem cases and complete ordered expectations.

## Decisions Made

- Used `locationsFor` to produce complete branded location inputs; the user-scope environment override is restored synchronously before any discovery begins.
- Used NUL-bearing target paths as deterministic malformed inputs for hard read errors, avoiding permissions, timing, polling, and host-specific errno assumptions.
- Asserted scope order independently from alphabetic order: user entries remain before project entries even when a project name sorts earlier globally.
- Retained `tests/bridges/skills/discover.test.ts` unchanged because it directly owns the distinct bridge module `bridges/skills/discover.ts`; it is not credited toward aggregate-orchestrator coverage.

## Verification

- The exact Plan 113-02 automated chain passed: focused owner, typecheck, direct coverage, targeted lint, targeted format, structural scan, and diff check.
- Direct coverage passed at 36/36 branches, 7/7 functions, and 122/122 lines.
- `node --test tests/bridges/skills/discover.test.ts tests/architecture/no-orchestrator-network.test.ts` passed with both suites green.
- Source-side ESLint, Prettier, and diff checks passed for the authorized pair-local production refactor.
- No test skip/todo/only marker, coverage ignore, double assertion, `as any`, or uppercase runtime phase remains.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made symlink guards reachable without unsafe filesystem races**

- **Found during:** Task 1 direct-coverage gate
- **Issue:** The original pre-`lstat` `Dirent.isDirectory()` and `Dirent.isFile()` filters rejected stable symlinks before the post-read security guards, while the `lstat(SKILL.md)` hard-error arm required permissions, a race, or host-specific path limits. The first comprehensive owner run reached 96.90% lines and 92.11% branches.
- **Fix:** With orchestrator authorization, expanded ownership to the paired source. Visible candidates are now classified after `lstat`; real skill-directory entries classify `SKILL.md`; symlink rejection and hard directory-read propagation remain intact.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/discover.ts`, `tests/orchestrators/discover.test.ts`
- **Verification:** The exact direct gate reports 100% branches, functions, and lines; focused, type, lint, format, structural, bridge, and architecture checks pass.
- **Committed in:** `9c45b542`

---

**Total deviations:** 1 auto-fixed blocking issue
**Impact on plan:** Pair-local source ownership expanded with approval; no public symbol, second P113 pair, network behavior, or test-only seam was added.

## Issues Encountered

Static `Dirent` type checks made the original post-read symlink branches unreachable through stable real filesystem fixtures. The authorized pair-local refactor preserved the security checks and removed the need for platform-dependent permission or timing techniques.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Security Review

The high-severity T-113-02 filesystem boundary is mitigated by case-owned roots, exact hidden/type/symlink filtering, post-entry `lstat` checks, complete cleanup, offline execution, and the no-orchestrator-network architecture gate.

## Next Phase Readiness

P113-02 is complete. Other Phase 113 owners can proceed independently.

## Self-Check: PASSED

- The paired production source, canonical direct owner, and summary exist.
- Focused behavior, direct coverage, typecheck, lint, format, structural, bridge, and architecture gates pass.
- Only the authorized paired source, owner test, and this summary are modified by this task.
- Task commit `9c45b542` exists.
