---
phase: 78-plugin-git-source-lifecycle
plan: 03
subsystem: api
tags: [plugin-list, plugin-info, git-source, clone-cache, resolver, nfr-5]

# Dependency graph
requires:
  - phase: 77-plugin-clone-cache-install
    provides: resolveGitPluginRoot seam, pluginCloneKey, pluginCloneDir, sha-<12hex> version + resolvedSha field
  - phase: 76-marketplace-url-source
    provides: url / git-subdir / github ParsedSource kinds + canonicalization
provides:
  - "list.ts renders uninstalled git-source plugins (available), not (unavailable)"
  - "info.ts renders uninstalled git-source plugins (available) on the not-installed row"
  - "makePresenceProbe(locations) — fs-only cache-presence probe (materialized/not-cached) for the list upgradable-candidate resolve"
  - "installed git plugins with a missing clone keep recorded status; cold cache never regresses to (unavailable)"
affects: [update, reinstall, uninstall, list, info]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fs-only presence probe injected into resolveGitPluginRoot — reuses the resolver seam without any gitOps/network surface"
    - "manifest-source short-circuit before resolveStrict for not-installed git entries (cross-surface list/info parity)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/orchestrators/plugin/info.test.ts

key-decisions:
  - "D-78-03: not-installed git entries classify (available) directly from the manifest, bypassing the resolver git arm's not-cached->unavailable{not installed} mapping"
  - "D-78-04: the presence probe is fs-only; a cold cache yields not-cached which degrades to plain (upgradable), never (unavailable)"
  - "info (available) git row carries componentsResolved:false (NFR-5 — no fetch), at parity with the INFO-05 non-path installed row"

patterns-established:
  - "makePresenceProbe: reconstruct clone url (github-object -> https://github.com/<owner>/<repo>; url/git-subdir -> source.url) + pluginCloneKey(url, sha) + pathExists(pluginCloneDir(key)), no network"
  - "unpinned git source (no sha) -> not-cached offline (key underivable without resolving remote HEAD)"

requirements-completed: [PURL-08]

coverage:
  - id: D1
    description: "Uninstalled url/github/git-subdir plugin renders (available) on list, not (unavailable)"
    requirement: "PURL-08"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#PURL-08 / D-78-03: an uninstalled url-source plugin renders (available), not (unavailable)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#PURL-08 / D-78-03: an uninstalled github-object-source plugin renders (available)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#PURL-08 / D-78-03: an uninstalled git-subdir-source plugin renders (available)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uninstalled url/github/git-subdir plugin renders (available) on info, not (unavailable)"
    requirement: "PURL-08"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#PURL-08 / D-78-03: uninstalled url-source plugin renders not-installed (available), not (unavailable)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#PURL-08 / D-78-03: uninstalled github-object-source plugin renders not-installed (available)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#PURL-08 / D-78-03: uninstalled git-subdir-source plugin renders not-installed (available)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Installed git plugin with a missing clone keeps recorded status; a newer manifest degrades to plain (upgradable), never (unavailable)"
    requirement: "PURL-08"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#PURL-08 / D-78-04: an installed git-source plugin with a missing clone keeps its recorded (installed) status"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#PURL-08 / D-78-04: an installed git-source plugin with a newer manifest and a missing clone degrades to plain (upgradable), never (unavailable)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#PURL-08 / D-78-04: installed git-source plugin with a missing clone keeps its recorded (installed) status"
        status: pass
    human_judgment: false
  - id: D4
    description: "list and info never clone and never touch the network for git sources (NFR-5)"
    requirement: "PURL-08"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#PURL-08 / NFR-5: list renders an uninstalled git plugin (available) with no plugin-clones dir on disk (no clone, no network)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#PURL-08 / NFR-5: info renders an uninstalled git plugin (available) with no plugin-clones dir on disk (no clone, no network)"
        status: pass
      - kind: integration
        ref: "tests/architecture/no-orchestrator-network.test.ts#NFR-5 + PI-2 + PL-3 + PRL-07: network-free orchestrators have zero gitOps surface"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-07-11
status: complete
---

# Phase 78 Plan 03: Git-source list/info status correctness Summary

**Uninstalled git-source plugins (url / git-subdir / github) now render `(available)` on `list` and `info` via a manifest short-circuit, and installed plugins with a cold clone cache degrade to plain `(upgradable)`/`(installed)` through an fs-only presence probe — all without cloning or touching the network.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-11
- **Completed:** 2026-07-11
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `list.ts` and `info.ts` classify a not-installed url/git-subdir/github entry as `(available)` directly from the manifest, before `resolveStrict`, so the resolver's `not-cached -> unavailable{not installed}` mapping never fires (D-78-03).
- Added `makePresenceProbe(locations)` — an fs-only `resolveGitPluginRoot` implementation that reconstructs the clone cache key and returns `materialized`/`not-cached` from `pathExists`, injected at the list upgradable-candidate resolve so a cold cache degrades to plain `(upgradable)` rather than `(unavailable)` (D-78-04).
- Neither surface imports any git/gitOps/`DEFAULT_GIT_OPS`/`platform/git` symbol; the no-orchestrator-network architecture gate stays green (NFR-5), and behavioral no-clone tests prove the plugin-clones dir is never created.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend list.test.ts + info.test.ts with uninstalled-git (available) and no-network cases** - `60c80e32` (test)
2. **Task 2: Wire the presence probe + uninstalled-git (available) short-circuit into list.ts** - `81d019be` (feat)
3. **Task 3: Wire the (available) short-circuit into info.ts** - `7e80b7df` (feat)

_Note: this plan is TDD-style — Task 1 is the RED commit; Tasks 2/3 are the GREEN commits per surface._

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - Added `makePresenceProbe`; not-installed git-source `(available)` short-circuit in `availableRowMessage`; presence-probe injection at the upgradable-candidate `resolveStrict`; threaded `cwd` into `installedRowMessage`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - Added `isGitSource` + `buildGitNotInstalledRow`; `(available)` short-circuit in `buildNotInstalledRow`; extracted the non-installable not-installed arm into `buildNotInstalledNonInstallableRow` to stay within the cognitive-complexity budget.
- `tests/orchestrators/plugin/list.test.ts` - 6 new PURL-08 cases (url/github/git-subdir available, installed missing-clone, upgradable cold-cache, no-network).
- `tests/orchestrators/plugin/info.test.ts` - 5 new PURL-08 cases (url/github/git-subdir available, installed missing-clone, no-network).

## Decisions Made
None beyond the plan's D-78-03 / D-78-04. `canonicalCloneUrl` (a Plan 02 symbol) was not importable in this worktree, so the presence probe reconstructs the canonical url inline via the pure ternary the plan sanctioned (`github` -> `https://github.com/<owner>/<repo>`, else `source.url`) — identical to `clone-cache.ts::resolvePluginPin`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed an invalid `plugins: undefined` key from a new list.test case**
- **Found during:** Task 2 (typecheck)
- **Issue:** The Task 1 no-network list test passed `plugins: undefined` to `seedMarketplace`, which is not a `SeedMarketplaceOpts` key — `tsc` flagged TS2353.
- **Fix:** Dropped the stray key (the seed helper reads plugins from `manifest`, not a top-level `plugins`).
- **Files modified:** tests/orchestrators/plugin/list.test.ts
- **Verification:** `npm run typecheck` clean; list.test 68/68 green.
- **Committed in:** `81d019be` (Task 2 commit)

**2. [Rule 3 - Blocking] Extracted the non-installable not-installed arm in info.ts to satisfy the cognitive-complexity lint**
- **Found during:** Task 3 (eslint)
- **Issue:** The new `(available)` short-circuit pushed `buildNotInstalledRow`'s cognitive complexity from 15 (the ceiling) to 16 (sonarjs/cognitive-complexity error).
- **Fix:** Extracted the `resolved.state !== "installable"` branch into a new `buildNotInstalledNonInstallableRow` helper (behavior-preserving); this also improved readability. No runtime behavior change.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
- **Verification:** eslint clean; info.test 51/51 green; typecheck clean.
- **Committed in:** `7e80b7df` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes were mechanical (a test typo and a lint-driven extraction). No scope creep; no behavior deviation from the plan.

## Issues Encountered
- Early test runs were executed from the main repo (`/home/acolomba/pi-claude-marketplace`) instead of the worktree, so they picked up the un-edited files and reported false green. Resolved by anchoring all `node --test` runs to the worktree root — the RED gate then confirmed correctly.

## Threat Flags
None — the presence probe and both short-circuits are fs-only; list.ts / info.ts carry zero git surface (T-78-06 mitigation intact, verified by the no-orchestrator-network gate). No new network endpoints, auth paths, or trust-boundary surface were introduced.

## Known Stubs
None — all rows are wired to real manifest/state/fs data; no placeholder values.

## Next Phase Readiness
- `list`/`info` git-source status correctness is complete for the milestone.
- The `makePresenceProbe` shape lives in `list.ts`; if a future surface needs the identical fs-only probe it can be promoted to a shared module, but no consumer requires that today.

## Self-Check: PASSED

- Files verified present: list.ts, info.ts, 78-03-SUMMARY.md
- Commits verified in history: 60c80e32, 81d019be, 7e80b7df

---
*Phase: 78-plugin-git-source-lifecycle*
*Completed: 2026-07-11*
