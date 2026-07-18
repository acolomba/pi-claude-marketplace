---
phase: 78-plugin-git-source-lifecycle
plan: 04
subsystem: infra
tags: [garbage-collection, plugin-clone-cache, uninstall, fs-only, derive-not-persist]

# Dependency graph
requires:
  - phase: 78-plugin-git-source-lifecycle
    provides: "garbageCollectPluginClones(locations): fs-only clone GC primitive (Plan 01)"
provides:
  - "Post-commit garbageCollectPluginClones(locations) call in uninstall.ts: uninstalling the last referencer of a git clone reclaims its plugin-clones/<key> dir; a shared clone survives until its last referencer is gone"
affects: [update, reinstall, 78-06-update-gc]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-state-commit GC beside the existing rm(pluginDataDir) cleanup, inside the D-19-01 silent-swallow discipline (belt-and-braces try/catch over a helper that already returns leak strings rather than throwing)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - tests/orchestrators/plugin/uninstall.test.ts

key-decisions:
  - "GC call placed BEFORE the orchestrated early-return so both standalone and orchestrated uninstall success paths reclaim clones through the single insertion point"
  - "GC leak (rm failure) and post-commit-ordering test cases assert uninstall success + state deletion, which hold regardless of GC — they passed on the RED test run and continue to pass GREEN, proving GC non-fatality (T-78-08 / T-78-09)"

patterns-established:
  - "fs-only clone-gc import keeps uninstall.ts git-clean: the no-orchestrator-network architecture gate stays green with no gitOps token added"

requirements-completed: [PURL-05]

coverage:
  - id: D1
    description: "Uninstalling the last referencer of a git clone deletes its plugin-clones/<key> dir"
    requirement: "PURL-05"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#uninstalling the last referencer of a git clone deletes its plugin-clones dir"
        status: pass
    human_judgment: false
  - id: D2
    description: "A clone shared by two plugins survives the first uninstall and is reclaimed only when the last referencer is uninstalled"
    requirement: "PURL-05"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#uninstalling one of two plugins sharing a git clone leaves the clone until the last referencer is gone"
        status: pass
    human_judgment: false
  - id: D3
    description: "A GC rm leak is swallowed and never fails the user-visible uninstall (D-19-01 / T-78-09)"
    requirement: "PURL-05"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#a GC rm leak does not fail the uninstall (leak swallowed per D-19-01)"
        status: pass
    human_judgment: false
  - id: D4
    description: "GC runs post-state-commit: the committed uninstall persists to state.json even when the GC leaks (T-78-08)"
    requirement: "PURL-05"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#GC never rolls back the committed uninstall: the state record is deleted even when GC leaks"
        status: pass
    human_judgment: false
  - id: D5
    description: "uninstall.ts stays git-clean after importing the fs-only clone-gc helper"
    requirement: "PURL-05"
    verification:
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts#(architecture gate)"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-07-11
status: complete
---

# Phase 78 Plan 04: Uninstall clone garbage-collection Summary

**Post-commit `garbageCollectPluginClones(locations)` call in uninstall.ts that reclaims a git-source plugin's cached clone once its last referencer is removed, leaves a shared clone intact while another installed plugin references it, and never fails the user-visible uninstall on a GC leak.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-11T15:38:31Z
- **Completed:** 2026-07-11T15:43:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Wired the Plan-01 `garbageCollectPluginClones` helper into `uninstall` at the exact post-state-commit spot where uninstall already drops the per-plugin data dir, inside the D-19-01 swallow discipline.
- The GC runs AFTER `withLockedStateTransaction` commits, so a still-installed record keeps its clone (shared-clone keep-alive) and the derive-live-keys logic sees the just-committed state.
- Extended `uninstall.test.ts` with four behavioral cases: last-referencer GC, shared-clone-survives-then-reclaimed, GC-leak-non-fatal, and post-commit-ordering.
- `uninstall.ts` stays git-clean: the fs-only `clone-gc` import adds no git surface, and the `no-orchestrator-network` architecture gate stays green.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: RED tests for uninstall clone GC** - `51004d49` (test)
2. **Task 2: call garbageCollectPluginClones after the uninstall state commit** - `941c3e35` (feat)

_The two referencer cases were RED before the uninstall.ts edit; the leak and post-commit-ordering cases passed on the RED run (they assert uninstall success + state deletion, which hold regardless of GC) and continue GREEN, proving GC non-fatality._

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` - Import `garbageCollectPluginClones` from `./clone-gc`; call it after the post-commit `rm(pluginDataDir)` cleanup inside a belt-and-braces try/catch (before the orchestrated early-return so both success paths run it).
- `tests/orchestrators/plugin/uninstall.test.ts` - New `seedGitPlugin` helper + four GC test cases.

## Decisions Made
- **GC placement before the orchestrated return:** the call sits after the pluginDataDir cleanup and before the `if (orchestrated) return {...}` branch, so orchestrated (reinstall/update-driven) and standalone uninstall both reclaim clones through the single insertion point.
- **Leak / post-commit cases as GREEN-stable proofs:** cases (3) and (4) assert only uninstall success and state-record deletion — both true with or without GC — so they passed on the RED run. They stay GREEN after the wiring and document the T-78-08 / T-78-09 non-fatality guarantees rather than gating RED.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The `trufflehog` pre-commit hook cannot read the git index under the worktree sandbox (`.git/index: not a directory`) — a documented CLAUDE.md limitation. The scan could not run in-place; committed with `SKIP=trufflehog` per project policy. No secrets were introduced (test constants are literal 40-char hex SHA placeholders).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Uninstall clone GC (PURL-05) is complete and green. The same `garbageCollectPluginClones` primitive is now proven at the uninstall call site; Plan 06 wires it into update's post-swap GC (PURL-06).
- No blockers.

## Self-Check: PASSED

- Modified files verified on disk; both task commits (`51004d49`, `941c3e35`) present in git log.
- Working tree clean; no untracked files; no unexpected deletions.
- `node --test uninstall.test.ts no-orchestrator-network.test.ts` → 35 pass / 0 fail; `npm run typecheck` clean; lint + prettier clean.

---
*Phase: 78-plugin-git-source-lifecycle*
*Completed: 2026-07-11*
