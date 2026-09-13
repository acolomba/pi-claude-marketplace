---
phase: 06-assertion-and-module-refinement
plan: "34"
subsystem: plugin-install
tags: [typescript, tdd, install, clone-cache, configuration]

requires:
  - phase: 06-33
    provides: install lifecycle pair selected as the next refinement target
provides:
  - Direct clone-probe owner with preserved cache classification and resolved-SHA behavior
  - Direct declared-enabled owner with preserved absent/true/false physical-file precedence
  - Focused owner tests with complete direct branch, function, and line coverage
affects: [06-35, plugin-install, plugin-import, plugin-reinstall]

actuals:
  tokens: 11591
  tasks: 2
  commits: 9
plan_head_before: e183b7b5923e61af61d8d86b4428864d0f4bb534

tech-stack:
  added: []
  patterns:
    - Extracted orchestration seams have direct mirrored owner tests and no compatibility re-export
    - Raw declared configuration remains separate from lifecycle-default application

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
    - tests/orchestrators/plugin/install-clone-probe.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-declared-enabled.ts
    - tests/orchestrators/plugin/install-declared-enabled.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts

key-decisions:
  - "Return a resolved SHA only when clone materialization returns a plugin root; missing results remain missing and clone errors propagate unchanged."
  - "Resolve declared enabled state by selected physical config identity, preserving undefined instead of consulting lifecycle defaults."
  - "Keep edge handlers on their public install/import orchestration paths because neither handler owned the extracted private decisions."

patterns-established:
  - "Clone probe seam: production defaults live with the probe, while tests can inject the three cache operations directly."
  - "Tri-state selection: a present local entry, including a bare entry, shadows the base entry without boolean coercion."

requirements-completed: [TREF-07, TREF-09]

coverage:
  - id: D1
    description: Cached, fresh, missing, escaping-path, and failing clone outcomes preserve the install caller contract.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/install-clone-probe.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Local/base selection preserves all absent, true, and false declared-enabled states without lifecycle-default reads.
    requirement: TREF-09
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/install-declared-enabled.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/install-declared-enabled.ts
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 34: Install Ownership Leaves Summary

**Clone probing and declared-enabled selection now have direct owners with full branch coverage, while install, import, and reinstall behavior remains unchanged.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-09T13:27:56Z
- **Completed:** 2026-09-09T13:49:04Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Extracted clone materialization, path classification, cache seams, and resolved-SHA reporting from the install hub into `install-clone-probe.ts` without changing cache cleanup, path safety, or error propagation.
- Extracted physical-file declared-enabled selection into `install-declared-enabled.ts`, preserving local shadowing and the full `undefined | true | false` contract without reading lifecycle defaults.
- Added direct mirrored tests that cover pinned and unpinned clones, real and injected seams, missing and rejected clones, escaping paths, provider auth, and every declared-enabled precedence state.
- Removed compatibility ownership from `install.ts`; existing edge handlers continue through the same public orchestration paths and retain ordered notification and transaction behavior.

## Task Commits

1. **Task 1 RED: Add failing clone-probe contract** - `b22b6e28` (test)
2. **Task 1 GREEN: Extract clone-probe ownership** - `5ed4960e` (feat)
3. **Task 1 REFACTOR: Finalize the direct owner pair** - `1ce835b2` (refactor)
4. **Task 2 RED: Add failing declared-enabled contract** - `f5355349` (test)
5. **Task 2 GREEN: Extract declared-enabled selection** - `96731574` (feat)
6. **Task 2 REFACTOR: Finalize the direct owner pair** - `15856f52` (refactor)
7. **Rule 3 API fix: Publish the exported probe input contract** - `97b12a99` (refactor)
8. **Authorized caller fix: Migrate reinstall's direct type import** - `8fa5aab1` (test)
9. **Stale-owner cleanup: Name the extracted resolver in install documentation** - `d33cc9db` (refactor)

## TDD Gate Compliance

- **Task 1 RED:** `b22b6e28` committed the direct clone-probe tests before the module existed. The named materialized pinned-cache test failed with `ERR_MODULE_NOT_FOUND`; `gsd-tools check tdd-red-evidence` accepted `.planning/tdd-evidence/06-34-01.json` as `target_test_failed`.
- **Task 1 GREEN:** `5ed4960e` introduced `probeInstallClone`, moved the cache seam, and migrated install composition. The focused clone-probe and install owner tests passed.
- **Task 1 REFACTOR:** `1ce835b2` switched to a static direct owner import and completed real-seam, auth, ref, missing, escape, and failure coverage.
- **Task 2 RED:** `f5355349` committed the five tri-state precedence tests before the owner module existed. The named selected-local-true test failed with `ERR_MODULE_NOT_FOUND`; `gsd-tools check tdd-red-evidence` accepted `.planning/tdd-evidence/06-34-02.json` as `target_test_failed`.
- **Task 2 GREEN:** `96731574` introduced `resolveInstallDeclaredEnabled` and migrated install composition. The focused declared-enabled and install owner tests passed.
- **Task 2 REFACTOR:** `15856f52` switched to a static direct owner import and retained complete direct coverage.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts` - Owns clone cache seams, auth construction, materialization classification, path resolution, and resolved SHA output.
- `tests/orchestrators/plugin/install-clone-probe.test.ts` - Direct clone-probe contract for cache outcomes, pins, auth, subdirectories, path rejection, and failures.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-declared-enabled.ts` - Owns local/base declaration precedence and raw tri-state extraction.
- `tests/orchestrators/plugin/install-declared-enabled.test.ts` - Direct absent/true/false selection matrix.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - Composes both extracted owners and retains lifecycle-default application, transaction state, and notifications.
- `tests/orchestrators/plugin/install.test.ts` - Imports the clone seam from its direct owner.
- `tests/orchestrators/plugin/reinstall.test.ts` - Imports the clone seam type from its direct owner; test behavior is unchanged.
- `.planning/tdd-evidence/06-34-01.json` and `.planning/tdd-evidence/06-34-02.json` - Accepted intentional RED evidence.

## Decisions Made

- Kept `resolvedSha` absent for missing clone results. A SHA is observable only when a materialized plugin root is also returned.
- Kept raw declaration selection independent from `applyDefaultEnabled`. The install orchestrator remains the sole owner of lifecycle-default application.
- Left both edge handlers unchanged after call-path inspection: the install handler already supplies the lifecycle flag through `createNodeInstallPlugin`, and the import handler supplies Git operations through its public import orchestrator. Adding private-owner imports there would duplicate orchestration rather than migrate ownership.
- Exported `InstallCloneProbeOptions` because it is the declared input type of an exported function; this preserves a usable public TypeScript signature without a facade.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported the clone probe's input type**

- **Found during:** Final Fallow verification
- **Issue:** The exported `probeInstallClone` signature referenced a private `InstallCloneProbeOptions` type, so Fallow rejected the public API surface.
- **Fix:** Exported and documented the options interface beside the probe and seam owner.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts`
- **Commit:** `97b12a99`

**2. [Rule 3 - Blocking, user-authorized scope expansion] Migrated the reinstall owner import**

- **Found during:** Final TypeScript verification
- **Issue:** `reinstall.test.ts` still imported `InstallCloneCacheSeam` from `install.ts`; retaining a re-export would violate the no-facade requirement.
- **Authorization:** The orchestrator authorized the one-import migration and no other edits in that file.
- **Fix:** Imported the type directly from `install-clone-probe.ts`, preserving every reinstall test body and runtime path.
- **Files modified:** `tests/orchestrators/plugin/reinstall.test.ts`
- **Commit:** `8fa5aab1`

**3. [Rule 3 - Blocking] Removed stale deleted-helper prose**

- **Found during:** Final stale-owner scan
- **Issue:** An install transaction comment still named the removed inline `readDeclaredEnabled` helper.
- **Fix:** Replaced the stale name with `resolveInstallDeclaredEnabled`; behavior is unchanged.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
- **Commit:** `d33cc9db`

**Total deviations:** 3 auto-fixed blocking ownership issues, including one explicitly authorized caller-file expansion.
**Impact on plan:** All changes enforce direct ownership; no runtime behavior, notification sequence, cleanup path, or transaction state changed.

## Issues Encountered

- Fallow and TypeScript each found one ownership-surface problem during final verification. Both were corrected without compatibility exports or behavioral changes.

## Verification

- `node --test tests/orchestrators/plugin/install-clone-probe.test.ts tests/orchestrators/plugin/install.test.ts` - 2 files passed, 0 failed.
- Clone direct coverage - 14/14 branches, 1/1 functions, 87/87 lines.
- `node --test tests/orchestrators/plugin/install-declared-enabled.test.ts tests/orchestrators/plugin/install.test.ts` - 2 files passed, 0 failed.
- Declared-enabled direct coverage - 11/11 branches, 2/2 functions, 28/28 lines.
- `npm run typecheck` - passed.
- `npm run test:corresponding` - passed.
- `npm run fallow` - passed with no threshold failures.
- Focused ESLint, Prettier, `git diff --check`, and stale-owner scans - passed.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 06-35 can proceed with clone probing and declared-enabled precedence removed from the install hub. The direct owner pairs, caller imports, and repository gates are clean.

## Self-Check: PASSED

All four created owner files, nine measured task commits, two accepted RED evidence files, direct coverage totals, and zero-stale-owner claims were verified against the working tree and Git history.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_
