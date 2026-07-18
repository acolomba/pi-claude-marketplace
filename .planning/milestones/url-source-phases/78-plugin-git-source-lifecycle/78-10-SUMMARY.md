---
phase: 78-plugin-git-source-lifecycle
plan: 10
subsystem: infra
tags: [garbage-collection, plugin-clone-cache, marketplace-remove, fs-only, gap-closure]

# Dependency graph
requires:
  - phase: 78-plugin-git-source-lifecycle
    provides: "garbageCollectPluginClones(locations): fs-only clone GC primitive (Plan 01)"
  - phase: 78-plugin-git-source-lifecycle
    provides: "Post-commit GC placement pattern proven in uninstall.ts (Plan 04)"
provides:
  - "Post-commit garbageCollectPluginClones(locations) call in marketplace/remove.ts: removing the last marketplace that references a git-source plugin reclaims that plugin's plugin-clones/<key> dir; a clone still referenced by a surviving marketplace survives"
affects: [marketplace-remove, reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-state-commit clone GC inside the failedPlugins.length === 0 full-remove branch, beside the marketplace-data-dir / source-clone cleanup, under the D-19-01 silent-swallow discipline (belt-and-braces try/catch over a helper that already returns leak strings rather than throwing)"

key-files:
  created:
    - .planning/workstreams/url-source/phases/78-plugin-git-source-lifecycle/78-10-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - tests/orchestrators/marketplace/remove.test.ts

key-decisions:
  - "GC call placed inside the existing failedPlugins.length === 0 full-commit branch (after source-clone cleanup): on a partial-failure remove the plugin records still exist and still reference their clones, so the sweep would be a no-op anyway — keeping it under the same full-commit guard makes the intent explicit"
  - "Symbol name kept out of the surrounding comment prose so grep-count of garbageCollectPluginClones in remove.ts is exactly 2 (one import, one call) per the plan acceptance criterion"
  - "The GC import is a parent-relative (../plugin/clone-gc.ts) import and belongs in the same import-x group as the other ../../ imports (no blank-line separator), so eslint import-x/order stays clean"

patterns-established:
  - "fs-only clone-gc import keeps remove.ts git-clean: the NFR-5 no-network contract holds and the source-file assertion test (no platform/git, no DEFAULT_GIT_OPS, no gitOps token) stays green"

requirements-completed: [PURL-05, PURL-06]

coverage:
  - id: D1
    description: "Removing the last-referencing marketplace of a git-source plugin garbage-collects that plugin's plugin-clones/<key> dir"
    requirement: "PURL-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#PURL-06 / D-78-01: removing the last-referencing marketplace garbage-collects a git-source plugin's clone dir"
        status: pass
    human_judgment: false
  - id: D2
    description: "remove.ts gains no git surface after importing the fs-only clone-gc helper (NFR-5)"
    requirement: "PURL-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#NFR-5: remove for a path-source marketplace makes no network calls"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-07-13
status: complete
---

# Phase 78 Plan 10: Marketplace-remove clone garbage-collection Summary

**Post-commit `garbageCollectPluginClones(locations)` call in `marketplace/remove.ts` that reclaims a git-source plugin's cached clone once the last marketplace referencing it is removed, at parity with the uninstall/update GC placement, without ever failing the user-visible remove and without adding any git surface.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-13T04:24:14Z
- **Completed:** 2026-07-13T04:33:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Closed the MINOR round-2 UAT gap: `marketplace remove`'s cascade uninstalled the plugins (bridge unstage + state delete + config cascade) but never garbage-collected their now-unreferenced `plugin-clones/<key>/` dirs, so a git-source plugin's clone leaked indefinitely when its last referencing marketplace was removed (UAT test-4: the superpowers clone survived a `claude-plugins-official` remove).
- Wired the Plan-01 `garbageCollectPluginClones` helper into `remove.ts` at the post-state-commit full-remove branch, beside the existing `marketplaceDataDir` / `sourceCloneDir` cleanup, inside the D-19-01 swallow discipline.
- The GC runs AFTER `withLockedStateTransaction` commits, so it derives live clone keys from the just-saved state where the removed plugins' records are gone → their clones are unreferenced → swept; a clone still referenced by a surviving marketplace's plugin survives.
- `remove.ts` stays git-clean: the fs-only `clone-gc` import adds no git surface, and the NFR-5 source-assertion test stays green.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 2 (RED): failing PURL-06 marketplace-remove clone GC test** - `15e9e80b` (test)
2. **Task 1 (GREEN): wire garbageCollectPluginClones into the remove cascade** - `cf6d6217` (feat)

_The regression test was written first and confirmed RED (the leaked clone dir survived: `true !== false`) before the remove.ts edit, then GREEN after._

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` - Import `garbageCollectPluginClones` from `../plugin/clone-gc.ts`; call it inside the `failedPlugins.length === 0` full-commit branch after the source-clone cleanup, wrapped in a belt-and-braces try/catch (D-19-01).
- `tests/orchestrators/marketplace/remove.test.ts` - New `PURL-06 / D-78-01` regression test: seeds a git-source plugin (record with `resolvedSha` + `resolvedSource` under `pluginClonesDir`) and an on-disk `plugin-clones/<key>/` dir, removes the last-referencing marketplace with a clean cascade stub, and asserts the clone dir is garbage-collected and the marketplace record is deleted from state.

## Decisions Made

- **GC under the full-commit guard:** placed the call inside the existing `if (failedPlugins.length === 0)` branch (after `sourceCloneDir` cleanup) rather than unconditionally. On a partial-failure remove the plugin records still exist and still reference their clones, so the sweep would be a no-op anyway — keeping it under the same full-commit guard as the marketplace-data-dir cleanup makes the intent explicit and mirrors the MR-7 clone-retention semantics.
- **Symbol name kept out of comment prose:** the surrounding comment refers to "the GC helper" rather than repeating `garbageCollectPluginClones`, so the plan's grep-count acceptance criterion (exactly 2 occurrences: one import, one call) holds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed import-x/order lint error on the new import**

- **Found during:** Task 1 (GREEN, `npm run check` ESLint gate)
- **Issue:** The new `../plugin/clone-gc.ts` import was placed in its own group with a blank line separating it from the `../../` imports, tripping `import-x/order` ("There should be no empty line within import group").
- **Fix:** Moved the import into the same parent-relative import group as the `../../transaction/with-state-guard.ts` import (no blank-line separator before the `./` local-group imports).
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
- **Verification:** `npx eslint remove.ts` clean; full `npm run check` green.
- **Committed in:** `cf6d6217` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking — an ESLint gate failure that prevented committing the task).
**Impact on plan:** Mechanical gate-satisfaction with no behavioral change. The wiring (import + single post-commit call site) is exactly as planned.

## Issues Encountered

None — no worktree sandbox this run (sequential executor on the main tree); pre-commit hooks (including trufflehog) ran clean without SKIP.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PURL-06 last-ref GC now applies to EVERY uninstall path — standalone uninstall (Plan 04), update post-swap (Plan 06), and the marketplace-remove cascade (this plan). The round-2 test-4 reproduction now passes.
- No blockers. Phase 78 round-2 gap closure complete.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` and `tests/orchestrators/marketplace/remove.test.ts` verified on disk.
- Both task commits (`15e9e80b`, `cf6d6217`) present in git log.
- `npm run check` green (typecheck + ESLint + Prettier + tests + integration, exit 0); the new PURL-06 test passes; `grep -c garbageCollectPluginClones remove.ts` == 2; no git surface (`gitOps`/`DEFAULT_GIT_OPS`/`platform/git` count == 0).

---
*Phase: 78-plugin-git-source-lifecycle*
*Completed: 2026-07-13*
