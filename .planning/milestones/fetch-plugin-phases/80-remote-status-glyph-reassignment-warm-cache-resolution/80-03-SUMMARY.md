---
phase: 80-remote-status-glyph-reassignment-warm-cache-resolution
plan: 03
subsystem: cli
tags: [git-source, list-filter, remote, presence-probe, output-parity]

# Dependency graph
requires:
  - phase: 80-01
    provides: PluginRemoteMessage, ICON_REMOTE, remote render arm in the central renderPluginRow switch
  - phase: 80-02
    provides: probeManifestEntry presence-derived classification, ManifestEntryClassification remote, PluginIndexRow.status remote, schemaVersion 6
provides:
  - list.ts availableRowMessage consolidated onto the shared presence-derived classification (parity-by-construction)
  - FilterBucket + PluginRenderStatus + ListMsg carry remote; the (remote) list render arm
  - ListPluginsOptions.remote + the --remote filter (shouldShow / filtersPassive arms)
  - --remote edge flag (BOOLEAN_FLAGS + spread + USAGE)
  - output-parity drift-guard extended to the remote bucket (list + completion classify a cold git source identically)
affects: [info.ts warm-tree resolution (Plan 04, disjoint), edge completions provider]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "list.ts derives the git-source verdict once via makePresenceProbe: cold clone -> (remote)/bucket remote; warm clone -> the existing three-way switch (resolveStrict with the presence probe injected)"
    - "list/completion parity is structural: both surfaces route the same not-installed manifest entry through the shared presence-derived classification, so the bucket cannot diverge"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/orchestrators/edge-deps.test.ts
    - tests/edge/handlers/plugin/list.test.ts

key-decisions:
  - "availableRowMessage gains a locations: ScopedLocations param threaded from enumerateMarketplacePlugins via locationsFor(pluginScope, opts.cwd) so the git presence probe reads the WARM clone/mirror cache fs-only (NFR-5)"
  - "The git short-circuit is replaced, not extended: a cold clone (not-cached) returns (remote)/bucket remote BEFORE resolveStrict; a warm one feeds the existing switch(resolved.state) unchanged. Non-git sources keep the resolveStrict({ marketplaceRoot }) path"
  - "list.messaging.ts required a remote render arm + ListMsg widen + LIST_STATUSES append-last (D-80-06) since the list surface owns its own render map total over its statuses (D-10)"

requirements-completed: [RSTA-01, RSTA-03, RSTA-07]

coverage:
  - id: D1
    description: "A not-installed git source with no materialized clone renders bare `◌ <name> (remote)` (no scope bracket, no reason brace)"
    requirement: "RSTA-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#RSTA-01 / D-80-03: a not-installed git source with no clone renders bare `◌ <name> (remote)`"
        status: pass
    human_judgment: false
  - id: D2
    description: "`--remote` selects only the remote bucket; `--available` alone excludes cold git sources; `--available --remote` restores the pre-milestone set"
    requirement: "RSTA-07"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#RSTA-07 / D-80-07: `--remote` selects only the remote bucket; `--available` alone EXCLUDES the cold git source; `--available --remote` includes both"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/list.test.ts#RSTA-07 / D-80-07 :: --remote flag calls listPlugins with remote: true"
        status: pass
    human_judgment: false
  - id: D3
    description: "A warm git source classifies its three-way verdict (available), never remote"
    requirement: "RSTA-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#RSTA-05 / D-80-04: a not-installed git source with a WARM clone classifies its three-way verdict (`available`), NOT `remote`"
        status: pass
    human_judgment: false
  - id: D4
    description: "The completion bucketizer and the list row builder classify a cold git source `remote` identically (output-parity drift-guard extended to the remote bucket)"
    requirement: "RSTA-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/edge-deps.test.ts#RSTA-01 output-parity: the completion bucketizer emits `remote` for not-fetched git sources; the non-git buckets stay at parity with the list row builder"
        status: pass
    human_judgment: false
  - id: D5
    description: "Installed git plugins never render (remote); list.ts + edge-deps stay network-free"
    requirement: "RSTA-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#T-80-08 / D-78-04: an INSTALLED git plugin with a missing clone stays `(installed)`, never `(remote)`"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts (list.ts + edge-deps grep for gitOps/platform/git = 0)"
        status: pass
    human_judgment: false

# Metrics
duration: 29min
completed: 2026-07-14
status: complete
---

# Phase 80 Plan 03: list.ts remote consolidation + `--remote` filter Summary

**`list.ts`'s `availableRowMessage` now derives the git-source verdict once via `makePresenceProbe` — a cold clone renders bare `◌ <name> (remote)`, a warm one resolves the existing three-way switch — and `--remote` joins the PL-1 filter family so `--available` no longer admits unfetched git sources; the completion bucketizer inherits `remote` at structural parity.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-07-14T14:34:35Z
- **Completed:** 2026-07-14T15:03:35Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Replaced the inline git short-circuit in `availableRowMessage` (which over-claimed `(available)` for every unfetched git source) with the shared presence-derived classification. The function now takes a `locations: ScopedLocations` param, threaded from `enumerateMarketplacePlugins` via `locationsFor(pluginScope, opts.cwd)`, so the fs-only presence probe reads the WARM clone/mirror cache without touching the network (NFR-5). A cold clone (`not-cached`) returns `(remote)` / bucket `remote`; a warm one feeds the existing `switch (resolved.state)` three-way block unchanged.
- Widened the list-surface type surface: `PluginRenderStatus += "remote"`, `FilterBucket += "remote"`, `ListMsg += PluginRemoteMessage`, `LIST_STATUSES` gains `"remote"` (appended last per D-80-06), and `list.messaging.ts` gains a `remote` render arm lifted verbatim from the central `renderPluginRow` remote arm (bare `◌ <name> (remote)` — no scope bracket, no reasons brace).
- Added `ListPluginsOptions.remote` + the `--remote` filter arms (`filtersPassive` conjunct + `shouldShow` `bucket === "remote"` arm). This makes `--available` stop admitting cold git sources (the INTENDED RSTA-07 behavior change) while `--available --remote` restores the pre-milestone set.
- Wired the `--remote` edge flag: `BOOLEAN_FLAGS` + the `listPlugins` spread + the `USAGE` string now carry `[--remote]`.
- Extended the RSTA-03 output-parity drift-guard so the list row builder and the completion bucketizer both classify a cold git source `remote` — parity is now structural (both route through the same presence-derived classification), closing the 80-02 deferral.

## Task Commits

Each task was committed atomically:

1. **Task 1: Consolidate list.ts onto presence-derived remote classification + FilterBucket/render arms** - `ff76e029` (feat)
2. **Task 2: Wire the `--remote` edge flag + extend the parity drift-guard** - `642b224f` (feat)

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - `availableRowMessage` presence-derived rewrite + `locations` param; `PluginRenderStatus` / `FilterBucket` / `ListPluginsOptions.remote`; `filtersPassive` + `shouldShow` remote arms; `PluginRemoteMessage` + `ScopedLocations` imports; caller threads `locationsFor(pluginScope, opts.cwd)`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` - `ICON_REMOTE` + `PluginRemoteMessage` imports; `LIST_STATUSES += "remote"`; `ListMsg += PluginRemoteMessage`; `remote` render arm.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` - `--remote` in `BOOLEAN_FLAGS` + spread + `USAGE`.
- `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` - refreshed `classifyNotInstalledPluginRow` comment to describe the presence-derived remote/warm classification (verify-only; inherits remote via `probeManifestEntry`).
- `tests/orchestrators/plugin/list.test.ts` - new cold-`(remote)` byte-equal case, `--remote` / `--available` / `--available --remote` filter cases, warm-tree `available` case, installed-never-remote guard; the four pre-existing git-source cases re-pointed `(available)` → `(remote)`; `git` / `fs` / `pluginMirrorKey` imports + a `stageWarmMirror` helper.
- `tests/orchestrators/edge-deps.test.ts` - `__test_availableRowMessage` call updated for the new `locations` arg; parity assertion extended so list + completion both classify a cold git source `remote`.
- `tests/edge/handlers/plugin/list.test.ts` - `--remote` flag-propagation test; the unknown-flag USAGE test now also asserts `[--remote]`.

## Decisions Made
- **`availableRowMessage` gains a `locations` param rather than re-deriving locations internally.** The caller (`enumerateMarketplacePlugins`) already holds `pluginScope` + `opts.cwd`, matching the `probeUpgradeCandidate` injection precedent in `installedRowMessage`. This keeps the row builder pure (no persistence lookups) and threads the correct plugin-scope clone cache.
- **The git short-circuit is replaced, not extended.** A cold clone returns `(remote)` before `resolveStrict`; a warm clone feeds the existing three-way switch with the presence probe injected. Non-git sources keep the unchanged `resolveStrict({ marketplaceRoot })` path. This makes the consolidation minimal and keeps the switch's `assertNever` exhaustiveness intact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a `remote` render arm + `ListMsg` widen in list.messaging.ts**
- **Found during:** Task 1 (typecheck)
- **Issue:** Widening `availableRowMessage`'s return `message` union with `PluginRemoteMessage` propagated into `enumerateMarketplacePlugins`'s `rows.push(row)`, which is typed `ListMsg`. `ListMsg` did not include `PluginRemoteMessage`, and the list surface's render map (`LIST_RENDER`, total over `LIST_STATUSES`) had no `remote` arm — both are TS compile errors.
- **Fix:** Added `PluginRemoteMessage` to `ListMsg`, appended `"remote"` to `LIST_STATUSES` (last, per the D-80-06 append-last tuple discipline), and added the `remote` render arm (lifted verbatim from the central `renderPluginRow` remote arm). `list.messaging.ts` was not in the plan's `files_modified`, but the list-surface render map lives there and the plan's own artifact spec (a `(remote)` row rendering `◌ <name> (remote)`) is unachievable without it.
- **Files modified:** `list.messaging.ts`
- **Verification:** `npm run typecheck` green; the byte-equality list.test.ts case renders `◌ gitplug v1.0.0 (remote)`.
- **Committed in:** `ff76e029` (Task 1 commit)

**2. [Rule 3 - Blocking] Re-pointed the four pre-existing git-source list.test.ts cases `(available)` → `(remote)`**
- **Found during:** Task 1 (test run)
- **Issue:** Four pre-existing cases (`PURL-08 / D-78-03` url/github/git-subdir + the `NFR-5` no-clones-dir case) asserted the pre-milestone `(available)` over-claim for cold git sources. The RSTA-01 consolidation makes those render `(remote)`, so the cases failed.
- **Fix:** Updated their assertions to `◌ ... (remote)`, refreshed the section header and test names/comments to RSTA-01 / D-80-03 anchors. The two `D-78-04` installed-git cases (which correctly stay `(installed)` / `(upgradable)`) were left unchanged and still pass.
- **Files modified:** `tests/orchestrators/plugin/list.test.ts`
- **Verification:** `node --test tests/orchestrators/plugin/list.test.ts` green (72 tests).
- **Committed in:** `ff76e029` (Task 1 commit)

**3. [Rule 3 - Blocking] Updated the edge-deps.test.ts `__test_availableRowMessage` call for the new `locations` arg**
- **Found during:** Task 1 (typecheck)
- **Issue:** The signature change (added `locations` param) broke the existing parity test's `__test_availableRowMessage(entry, marketplaceRoot)` call (TS2554, expected 3 args). This test file is Task 2's, but it had to compile for Task 1's typecheck gate.
- **Fix:** Passed `locationsFor("project", cwd)` and extended the parity assertion (Task 2's drift-guard deliverable) so list + completion both classify the cold git source `remote`. The full parity-test change landed with Task 2's commit; only the call-site fix was strictly needed for Task 1's typecheck.
- **Files modified:** `tests/orchestrators/edge-deps.test.ts`
- **Verification:** `npm run typecheck` green; edge-deps suite green (14 tests).
- **Committed in:** `642b224f` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking).
**Impact on plan:** All three were necessary consequences of the in-scope `availableRowMessage` widen and signature change. The only file touched outside `files_modified` was `list.messaging.ts` (the list-surface render map, required to render the `(remote)` row the plan specifies). No scope creep.

## Issues Encountered
- **Warm-mirror fixture cache-key mismatch (avoided).** `makePresenceProbe` hashes the canonical url (`.git` suffix stripped by `parsePluginSource`). The `stageWarmMirror` helper and the warm-tree test both use a canonical (no-`.git`) url so the staged mirror key matches the probed key — the same gotcha the 80-02 SUMMARY flagged.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `list --remote` filters the remote bucket and the completion bucketizer inherits `remote` at structural parity — the 80-02 list-vs-completion git-source parity deferral is now closed.
- Plan 04 (info surface) runs in parallel on a disjoint file set (`info.ts` + `info.test.ts`); no files touched here overlap it.

## Self-Check: PASSED

All 7 modified source/test files and this SUMMARY.md exist on disk; both task commits (`ff76e029`, `642b224f`) are present in git history. `npm run check` exits 0 (full typecheck + lint + format + test suites green).

---
*Phase: 80-remote-status-glyph-reassignment-warm-cache-resolution*
*Completed: 2026-07-14*
