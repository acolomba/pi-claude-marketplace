---
phase: 81-fetch-verb-info-fetch
plan: 06
subsystem: api
tags: [git-subdir, presence-probe, resolver, containment, fs-only, NFR-5, NFR-10]

# Dependency graph
requires:
  - phase: 81-fetch-verb-info-fetch
    provides: shared fs-only makePresenceProbe seam behind info/list/completion/fetch
provides:
  - Warm git-subdir sources anchor their pluginRoot at <clone>/<source.path> across every fs-only read surface
  - Shared fs-only resolveGitSubdirRoot helper importable by both the git-tainted clone-cache seam and the network-free probe
  - Regression coverage for warm git-subdir subdir-anchoring and the missing-subdir fold
affects: [info, list, completion, fetch, resolver, clone-cache]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fs-only containment helper shared between a git-tainted seam and a network-free consumer via shared/fs-utils.ts (no git surface leak)"
    - "presence-probe subdir-anchoring mirrors install's resolveGitPluginRootWithSubdir (escapes / missing-subdir arms propagate to resolver unavailable)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/fs-utils.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
    - tests/orchestrators/plugin/git-source-probe.test.ts
    - tests/orchestrators/plugin/info.test.ts

key-decisions:
  - "Extract resolveGitSubdirRoot to shared/fs-utils.ts (not clone-cache.ts) so the network-free probe reaches it without pulling clone-cache's DEFAULT_GIT_OPS / refreshGitHubClone surface"
  - "Re-export resolveGitSubdirRoot from clone-cache.ts under the same name so install/update/reinstall import sites stay unbroken"
  - "Subdir escapes / missing-subdir fold into the probe's existing GitPluginRootResult arms -> resolver unavailable; no new REASONS member, no new status token"

patterns-established:
  - "A single fs-only seam (makePresenceProbe) fixes every git-subdir read surface (info/list/completion/fetch) at once"

requirements-completed: [RSTA-04, RSTA-05, FTCH-04, FTCH-06]

coverage:
  - id: D1
    description: "Warm git-subdir source resolves its subdir components (skills + mcp) at <clone>/<source.path>, not the empty monorepo root, and no longer over-claims (available)"
    requirement: RSTA-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/git-source-probe.test.ts#a warm git-subdir clone resolves its subdir components, not the empty monorepo root (RSTA-05 / D-77-03)"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/info.test.ts#RSTA-05 / D-77-03: uninstalled git-subdir plugin with a WARM mirror renders the subdir's components, not an empty (available) row"
        status: pass
    human_judgment: false
  - id: D2
    description: "A warm git-subdir clone whose declared source.path is absent classifies unavailable via the missing-subdir fold, never leaking the monorepo-root pluginRoot (NFR-10 containment)"
    requirement: RSTA-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/git-source-probe.test.ts#a warm git-subdir clone whose declared path is absent classifies `unavailable`, never the monorepo root (NFR-10 / D-77-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "url / github whole-repo anchoring is unregressed -- a warm whole-repo url source still resolves available at the clone root (no double-append)"
    requirement: FTCH-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/git-source-probe.test.ts#a warm whole-repo url source still resolves `available` at the clone root (subdir fix is git-subdir-specific)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The fs-only presence probe touches no network and pulls no git seam via shared/fs-utils.ts (NFR-5 network-free gate stays green)"
    requirement: FTCH-06
    verification:
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 32min
completed: 2026-07-15
status: complete
---

# Phase 81 Plan 06: Warm git-subdir probe subdir-anchoring Summary

**makePresenceProbe now anchors a warm git-subdir source's pluginRoot at `<clone>/<source.path>` across every fs-only read surface (info/list/completion/fetch), so the canva-shaped monorepo plugin resolves its subdir components instead of rendering a silently-empty `(available)` row.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-07-15T09:56:27Z
- **Completed:** 2026-07-15T10:28:09Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Extracted `resolveGitSubdirRoot` into `shared/fs-utils.ts` as a byte-preserving move, shared by the git-tainted clone-cache seam and the network-free presence probe without leaking the git surface into the probe's transitive closure.
- Fixed the root cause: both materialized arms of `makePresenceProbe` (pinned per-sha clone dir + unpinned mirror dir) now apply the git-subdir subdir-anchoring tail, so a git-subdir source resolves at `<cloneDir>/<source.path>` at parity with install's containment; url/github sources stay byte-unchanged.
- Added regression coverage A-D proving warm git-subdir resolves its subdir skills + mcp server (A/D), a missing subdir folds to `unavailable` (B), url anchoring is unregressed (C), all fs-only and network-free.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract resolveGitSubdirRoot into shared/fs-utils.ts** - `7fb5f720` (refactor)
2. **Task 2: Anchor makePresenceProbe git-subdir pluginRoot fs-only** - `1fb7e10d` (fix)
3. **Task 3: Regression coverage for warm git-subdir subdir-anchoring** - `e10cb166` (test)

_Note: This is a `type: execute` plan; Task 3 (`tdd="true"`) landed as a single `test(...)` commit because the corrective implementation (Tasks 1-2) already preceded it — the tests are GREEN by construction and each discriminates against the pre-fix clone-root resolution (an empty monorepo root would fail the non-empty-component / `available` assertions)._

## Files Created/Modified
- `extensions/pi-claude-marketplace/shared/fs-utils.ts` - New home of the fs-only `resolveGitSubdirRoot` (path.resolve + assertPathInside containment + pathExists), imports path-safety.
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` - Deleted the local `resolveGitSubdirRoot`; re-exports it from fs-utils under the same name; dropped the now-unused path-safety import.
- `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts` - Added a module-private `anchorSubdir` helper applied on both materialized arms; imports `resolveGitSubdirRoot` from fs-utils (not clone-cache) to stay git-free.
- `tests/orchestrators/plugin/git-source-probe.test.ts` - Tests A (warm git-subdir resolves subdir components via resolveStrict), B (missing subdir -> unavailable), C (url anchoring unregressed).
- `tests/orchestrators/plugin/info.test.ts` - Test D (bare info on a warm git-subdir mirror renders subdir components, not an empty `(available)` row) + `seedWarmSubdirMirror` fixture helper.

## Decisions Made
- **Shared-home location:** `resolveGitSubdirRoot` moved to `shared/fs-utils.ts` rather than staying in `clone-cache.ts`. The probe reaches it via `shared/fs-utils.ts` so its transitive closure never touches `DEFAULT_GIT_OPS` / `refreshGitHubClone` — the network-free gate stays green.
- **Import-then-nothing / direct re-export:** Used a direct `export { resolveGitSubdirRoot } from "../../shared/fs-utils.ts"` in clone-cache.ts so install/update/reinstall import sites need no edits.
- **Containment folds into existing vocabulary:** escapes / missing-subdir are already members of the probe's `GitPluginRootResult` union — the resolver folds both to `unavailable`. No new closed-set REASONS member, no new status token.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The trufflehog pre-commit hook's auto-updater hangs when spawned inside `git commit` in this environment. Per project CLAUDE.md, ran `pre-commit run trufflehog --files ...` separately (Passed) and committed with `SKIP=trufflehog`. All other hooks (npm lint / format / typecheck) ran normally and passed.

## Verification

- `npm run check` (full gate: typecheck + ESLint + Prettier + tests + integration) ran GREEN — `# fail 0` across all suites (exit 0).
- Targeted suites: `git-source-probe.test.ts` + `info.test.ts` (70 tests pass), `no-orchestrator-network.test.ts` (network-free gate pass), `clone-cache.test.ts` + `install.test.ts` (117 tests pass, install/update/reinstall callers untouched).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 81 gap closure complete: warm git-subdir plugins now resolve honestly across info/list/completion/fetch. Ready for re-verification of the git-subdir warm-fetch UAT item.

## Self-Check: PASSED

- All modified files present on disk.
- All three task commits present in git history (`7fb5f720`, `1fb7e10d`, `e10cb166`).

---
*Phase: 81-fetch-verb-info-fetch*
*Completed: 2026-07-15*
