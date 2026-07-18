---
phase: 78-plugin-git-source-lifecycle
plan: 01
subsystem: infra
tags: [garbage-collection, plugin-clone-cache, fs-only, node-fs-promises, derive-not-persist]

# Dependency graph
requires:
  - phase: 77-plugin-clone-cache-install
    provides: "plugin-clones/<key> cache, pluginCloneDir chokepoint, resolvedSha/resolvedSource state fields, materializePluginClone"
provides:
  - "garbageCollectPluginClones(locations): fs-only clone GC primitive that derives live keys from surviving git-source records and deletes unreferenced plugin-clones/<key> dirs"
  - "tests/orchestrators/plugin/clone-gc.test.ts: behavioral coverage for derive/keep-alive/orphan-delete/idempotency/ENOENT/leak-swallow"
affects: [78-04-uninstall-gc, 78-06-update-gc, uninstall, update]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derive-not-persist GC: live-key set computed from state records at GC time, no refcount artifact (D-78-01 Option A)"
    - "fs-only sibling helper outside orchestrators so a git-forbidden caller (uninstall) can import it without touching the git surface"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts
    - tests/orchestrators/plugin/clone-gc.test.ts
  modified: []

key-decisions:
  - "Live-key derivation uses path.relative(pluginClonesDir, resolvedSource).split(path.sep)[0] so git-subdir plugins (resolvedSource = <key>/<subdir>) map back to the clone root key"
  - "Records without resolvedSha (path/github-name plugins) contribute no live key and protect no clone dir"
  - "Extracted deriveLiveCloneKeys helper to keep garbageCollectPluginClones under the cognitive-complexity lint ceiling"

patterns-established:
  - "GC swallows per-dir rm leaks into a returned string[] (D-19-01) — callers ignore it; the next idempotent pass retries (NFR-3)"
  - "Every delete target routes through locations.pluginCloneDir(key) (SC-7 chokepoint) BEFORE any rm — assertSafeName + assertPathInside enforce NFR-10"

requirements-completed: [PURL-05, PURL-06]

coverage:
  - id: D1
    description: "garbageCollectPluginClones derives the live clone-key set from surviving git-source records and deletes only unreferenced plugin-clones/<key> dirs; shared clones stay alive until the last referencer is gone"
    requirement: "PURL-05"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-gc.test.ts#derives live keys and deletes only unreferenced clone dirs"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-gc.test.ts#keeps a shared clone alive while any record references it"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-gc.test.ts#deletes a clone once its last referencer is gone"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-gc.test.ts#a record without resolvedSha contributes no live key"
        status: pass
    human_judgment: false
  - id: D2
    description: "GC is idempotent, ENOENT-safe, containment-safe, and leak-swallowing (safe for both uninstall and update to call post-state-commit)"
    requirement: "PURL-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-gc.test.ts#is idempotent: a second pass over a swept cache is a no-op"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-gc.test.ts#returns [] when the plugin-clones dir is absent (ENOENT no-op)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-gc.test.ts#routes every delete target through the pluginCloneDir chokepoint"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-gc.test.ts#swallows a per-dir rm failure and returns leak strings instead of throwing"
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-07-11
status: complete
---

# Phase 78 Plan 01: Clone garbage-collection primitive Summary

**fs-only `garbageCollectPluginClones` that derives live clone keys from surviving git-source state records (derive-not-persist) and deletes unreferenced `plugin-clones/<key>` dirs through the containment chokepoint, with ENOENT no-op and leak-swallow semantics.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-11T15:01:55Z
- **Completed:** 2026-07-11T15:12:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `garbageCollectPluginClones(locations): Promise<string[]>` — the single shared primitive both uninstall (PURL-05) and update (PURL-06) will call after their state mutation commits.
- Live-key derivation follows D-78-01 Option A: only records carrying `resolvedSha` contribute a key, taken as the first path segment of `resolvedSource` relative to `pluginClonesDir` (git-subdir plugins map back to their clone root).
- Zero git surface: the module imports `loadState` + `node:fs/promises` `rm`/`readdir` only, so `uninstall.ts` (forbidden the git surface by the no-orchestrator-network gate) can import it cleanly.
- Eight behavioral test cases proving derive, shared-clone keep-alive, orphan delete, idempotent double-run, ENOENT no-op, no-resolvedSha-no-key, chokepoint routing, and leak-swallow.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: clone-gc.test.ts RED scaffold** - `876ef2ee` (test)
2. **Task 2: implement garbageCollectPluginClones** - `17f17ea7` (feat)

_The Task 2 commit also carries the SHA_C-removal and cognitive-complexity refactor described under Deviations._

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts` - New fs-only module exporting `garbageCollectPluginClones` plus the private `deriveLiveCloneKeys` helper.
- `tests/orchestrators/plugin/clone-gc.test.ts` - New behavioral test scaffold (8 cases).

## Decisions Made
- **git-subdir key recovery:** derived the clone key as `path.relative(pluginClonesDir, resolvedSource).split(path.sep)[0]` rather than an exact-match, so a git-subdir plugin whose `resolvedSource` is `<key>/<subdir>` still protects its clone root. Matches the plan's D-78-01 Option A instruction verbatim.
- **Helper extraction:** split the nested-loop live-key derivation into `deriveLiveCloneKeys` to keep the exported function within the repo's `sonarjs/cognitive-complexity` ceiling (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused `SHA_C` test constant**
- **Found during:** Task 2 (typecheck gate)
- **Issue:** `tsc --noEmit` failed with TS6133: `SHA_C` declared but never read in the test scaffold.
- **Fix:** Deleted the unused constant (only `SHA_A`/`SHA_B` are referenced).
- **Files modified:** tests/orchestrators/plugin/clone-gc.test.ts
- **Verification:** `npm run typecheck` clean; all 8 tests still pass.
- **Committed in:** `17f17ea7` (Task 2 commit)

**2. [Rule 3 - Blocking] Extracted `deriveLiveCloneKeys` to satisfy cognitive-complexity lint**
- **Found during:** Task 2 (ESLint gate)
- **Issue:** `npm run lint` failed — `garbageCollectPluginClones` had cognitive complexity 18 > the 15 allowed (`sonarjs/cognitive-complexity`), from the two nested record loops plus the segment guards.
- **Fix:** Moved the live-key derivation into a pure `deriveLiveCloneKeys(state, pluginClonesDir)` helper, leaving the exported function focused on the readdir/sweep loop.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts
- **Verification:** `npm run lint`, `npm run typecheck`, `npm run format:check` all clean; fs-only gate still GATE-CLEAN; all 8 tests pass.
- **Committed in:** `17f17ea7` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking — a quality-gate failure that prevented committing the task).
**Impact on plan:** Both fixes were mechanical gate-satisfaction with no behavioral change. The public contract (`garbageCollectPluginClones` signature, semantics) is exactly as planned. No scope creep.

## Issues Encountered
- The `pre-commit run --files` invocation timed out at 2 min under the worktree sandbox (trufflehog's auto-updater cannot spawn child processes here — a documented CLAUDE.md limitation). Ran the relevant hooks directly (`npm run lint` / `typecheck` / `format:check`) and confirmed the trufflehog scan separately, then committed with `SKIP=trufflehog` per project policy.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `garbageCollectPluginClones` is ready for import by Plan 04 (uninstall post-state-commit GC) and Plan 06 (update post-swap GC). Both must call it AFTER their state mutation commits (its safety model assumes the surviving records already reflect the mutation).
- No blockers. The threat-model mitigations (T-78-01 containment via chokepoint, T-78-02 shared-clone keep-alive, T-78-03 leak-swallow + idempotency) are all covered by passing tests.

## Self-Check: PASSED

- All created files verified on disk.
- All task commits (`876ef2ee`, `17f17ea7`) and the metadata commit (`30d018fe`) present in git log.
- Working tree clean.

---
*Phase: 78-plugin-git-source-lifecycle*
*Completed: 2026-07-11*
