---
phase: 80-remote-status-glyph-reassignment-warm-cache-resolution
plan: 04
subsystem: info-surface
tags: [git-source, remote-status, warm-cache-resolution, presence-probe, info, RSTA-04, RSTA-05, RSTA-06]

# Dependency graph
requires:
  - phase: 80-01
    provides: remote PLUGIN_STATUSES member, ICON_REMOTE, PluginInfoRowBase.status widened with remote, remote render arms
  - phase: 80-02
    provides: makePresenceProbe composition, ManifestEntryClassification += remote, resolveStrict presence-probe injection pattern
  - phase: 79.1-mutable-mirror-clones-for-unpinned-git-plugin-sources
    provides: makePresenceProbe mirror arm + readMirrorHeadSha (fs-only presence primitives)
provides:
  - info surface renders (remote) for a not-installed git source with a cold clone
  - info surface resolves components fs-only from a warm clone (not-installed three-way + installed)
  - buildBlock threads per-scope locations into the row builders
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presence-derived info row: makePresenceProbe not-cached -> (remote); materialized -> resolveStrict three-way against the warm pluginRoot"
    - "Warm git-source components enumerated fs-only via composeResolvedComponents(presence.pluginRoot, resolved) -- no derivePluginRootForInfo (that is path-source only)"
    - "D-78-04 degrade on the installed path: cold/missing clone or resolve throw keeps the recorded install status, never (remote)/(unavailable)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/orchestrators/plugin/info.test.ts

key-decisions:
  - "remote derives ONLY on the not-installed info path (buildNotInstalledRow's git branch); the installed path preserves the D-78-04 degrade, never rendering (remote)"
  - "The unavailable warm arm carries no componentPaths (NFR-7), so buildWarmGitNonInstallableRow re-derives from the conventional <pluginRoot>/{skills,commands,agents} locations (mirrors deriveLenientComponentPaths) to still list on-disk components"
  - "isGitSource narrowed to a type guard (src is UrlSource | GitSubdirSource | GitHubSource) so the git source feeds makePresenceProbe without a cast"

patterns-established:
  - "buildGitNotInstalledRow repurposed from the cold (available) row builder into the presence-derived remote-vs-warm-three-way builder; buildRemoteNotInstalledRow is the new cold (remote) leaf"

requirements-completed: [RSTA-01, RSTA-04, RSTA-05, RSTA-06]

coverage:
  - id: D1
    description: "A not-installed git-source plugin with a COLD clone renders (remote) + components: not resolved; bare info touches no network"
    requirement: "RSTA-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#RSTA-01: uninstalled url-source plugin with a cold clone renders `(remote)` + components: not resolved, not (available)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#NFR-5: info renders an uninstalled git plugin `(remote)` with no plugin-clones dir on disk (no clone, no network)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A not-installed git-source plugin with a WARM clone resolves and lists components fs-only, three-way classified"
    requirement: "RSTA-05"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#RSTA-05: uninstalled url-source plugin with a WARM mirror resolves and lists components fs-only (available)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#RSTA-04: uninstalled git source with a WARM clone declaring an unsupported component resolves with a reason brace, not (remote)"
        status: pass
    human_judgment: false
  - id: D3
    description: "An installed git plugin with a WARM clone resolves its components fs-only (amends INFO-05); a cold/missing one keeps the recorded install status and never renders (remote) (D-78-04)"
    requirement: "RSTA-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#RSTA-04: installed git-source plugin with a WARM mirror resolves its components fs-only on the (installed) row"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#PURL-08 / D-78-04: installed git-source plugin with a missing clone keeps its recorded (installed) status, never (remote)"
        status: pass
    human_judgment: false
  - id: D4
    description: "info.ts imports no git seam; bare info stays network-free (NFR-5)"
    requirement: "RSTA-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#NFR-5: info.ts has zero imports from platform/git, DEFAULT_GIT_OPS, or refreshGitHubClone"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts (info.ts git-free grep gate)"
        status: pass
    human_judgment: false

# Metrics
duration: 27min
completed: 2026-07-14
status: complete
---

# Phase 80 Plan 04: Warm-cache resolution on the info surface Summary

**The `info` surface now derives a not-installed git-source plugin's row from its fs-only clone/mirror presence: a cold clone renders `(remote)` + `components: not resolved`, a warm one resolves and lists components fs-only via the three-way resolver, and an installed git plugin with a warm clone resolves its components fs-only (amending INFO-05) while a cold/missing one preserves the D-78-04 degrade -- all network-free.**

## Performance

- **Duration:** 27 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Repurposed the not-installed git-source arm of `buildNotInstalledRow`: `makePresenceProbe(locations)(gitSource)` now decides between a cold `(remote)` row (`buildRemoteNotInstalledRow`, `componentsResolved: false`, D-80-04 marker wording preserved) and a warm `resolveStrict` three-way resolution against the on-disk `pluginRoot`. Installable warm sources list components fs-only via `composeResolvedComponents`; partially-available / unavailable route through the same reason-brace arm a path source uses (`buildWarmGitNonInstallableRow`).
- Gated the installed non-path arm of `buildInstalledRow` on a warm clone (`buildInstalledGitRow`): a materialized clone resolves installable git plugins fs-only onto the `(installed)` row; a cold/missing clone, a non-installable warm resolve, or any probe/read throw preserves the recorded install status (D-78-04) and never regresses to `(remote)` or `(unavailable)`.
- Threaded per-scope `locations` (`locationsFor(scope, opts.cwd)`) from `getPluginInfo` through `buildBlock` (new `cwd` param, both call sites updated) into both row builders so the presence probe runs per scope.
- Narrowed `isGitSource` to a type guard so the parsed git source feeds `makePresenceProbe` (whose input is exactly the url / git-subdir / github union) without a cast.
- Import discipline held: `info.ts` still imports only `makePresenceProbe` + `resolveStrict` + `composeResolvedComponents` -- no `platform/git`, no git seam -- so bare info stays network-free (NFR-5).

## Task Commits

Each task was committed atomically:

1. **Task 1: Presence-derive the not-installed info row (remote cold vs warm three-way)** - `2a26e9be` (feat)
2. **Task 2: Resolve installed git-plugin components fs-only from a warm clone** - `5001d8ce` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - `buildBlock` gains `cwd` and builds per-scope `locations`; `buildNotInstalledRow` / `buildInstalledRow` gain a `locations` param; `buildGitNotInstalledRow` repurposed to the presence-derived remote-vs-warm builder with `buildRemoteNotInstalledRow` + `buildWarmGitNonInstallableRow` leaves; new `buildInstalledGitRow` for the installed warm arm; `isGitSource` narrowed to a type guard; file header + git-source docstrings re-anchored to `RSTA-01 / RSTA-04 / RSTA-05 / RSTA-06 / D-80-04 / NFR-5`.
- `tests/orchestrators/plugin/info.test.ts` - the 3 cold git-source `(available)` cases inverted to `(remote)`; new warm not-installed three-way cases (available + unsupported reason-brace), warm installed component-resolution case, D-78-04 missing-clone regression guard (never `(remote)`), and a strengthened network-free assertion (plugin-clones/ still absent after render). Added `seedWarmMirror` helper (real isomorphic-git mirror) + `isomorphic-git`/`pluginMirrorKey` imports.

## Decisions Made

- `remote` derives ONLY on the not-installed path; the installed path preserves the D-78-04 degrade. A regression-guard test asserts a missing-clone installed plugin renders `(installed)`, never `(remote)`.
- The `unavailable` warm arm carries no `componentPaths` (NFR-7), so `buildWarmGitNonInstallableRow` re-derives from the conventional `<pluginRoot>/{skills,commands,agents}` locations (mirrors the path-source `deriveLenientComponentPaths`) to still enumerate on-disk components.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@typescript-eslint/return-await` in the warm try/catch**
- **Found during:** Task 1 (lint).
- **Issue:** The `resolveStrict` warm arm returned `buildWarmGitNonInstallableRow(...)` / `buildAvailableRow(...)` un-awaited inside a `try`, so a throw would escape the intended catch; ESLint's `return-await` rule flagged both returns.
- **Fix:** Changed to `return await` so a warm-tree throw is caught by the surrounding try/catch and folds to the unreadable arm (behavior-correct, not just lint-appeasing).
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
- **Committed in:** `2a26e9be` (Task 1 commit)

**2. [Plan-fixture correction] Warm non-installable test staged as a mirror, not a pinned per-sha clone**
- **Found during:** Task 1 (test authoring).
- **Issue:** The plan's warm-non-installable idea used a pinned `url#<sha>` source, but `parsePluginSource` populates the fragment into `ref`, leaving `sha` undefined -- so `makePresenceProbe` takes the unpinned mirror arm, not the pinned per-sha arm. A staged pinned clone was never read (probe returned `not-cached` -> `(remote)`).
- **Fix:** Staged the unsupported (`lspServers`) plugin as a warm URL-keyed mirror via `seedWarmMirror`; dropped the unused `seedWarmPinnedClone` helper + `pluginCloneKey` import. The test now proves the warm non-installable reason-brace arm.
- **Files modified:** `tests/orchestrators/plugin/info.test.ts`
- **Committed in:** `2a26e9be` (Task 1 commit)

**Total deviations:** 2 (1 Rule 3 blocking, 1 fixture correction). No architectural changes (no Rule 4). No scope creep.

## Verification

- `node --test tests/orchestrators/plugin/info.test.ts` - 54/54 pass (remote cold ×3, warm not-installed three-way, warm installed, D-78-04 missing-clone guard, network-free).
- `node --test tests/architecture/no-orchestrator-network.test.ts` - 1/1 pass (info.ts git-free).
- `node --test tests/orchestrators/plugin/git-source-probe.test.ts tests/orchestrators/edge-deps.test.ts` - 23/23 pass (no ripple from the info changes).
- `node --test tests/orchestrators/plugin/*.test.ts` - 535/535 pass.
- `node --test tests/architecture/*.test.ts` - 316 pass, 1 skip, 0 fail.
- `npm run typecheck` - exit 0. `eslint` + `prettier --check` on both changed files - clean.

## Deferred Issues

None.

## Self-Check: PASSED

- SUMMARY.md exists at the plan directory.
- Both task commits (`2a26e9be`, `5001d8ce`) present in git history.
- Committed `info.ts` contains `buildRemoteNotInstalledRow`, `buildWarmGitNonInstallableRow`, and `buildInstalledGitRow`; `isGitSource` is a type guard; no `platform/git` / `gitOps` import.

---
*Phase: 80-remote-status-glyph-reassignment-warm-cache-resolution*
*Completed: 2026-07-14*
