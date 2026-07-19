---
phase: 80-remote-status-glyph-reassignment-warm-cache-resolution
plan: 02
subsystem: api
tags: [git-source, classification, completion-cache, typebox, presence-probe]

# Dependency graph
requires:
  - phase: 80-01
    provides: remote PLUGIN_STATUSES member, ICON_REMOTE, STATUS_TOKENS tuple + render arms
  - phase: 79.1-mutable-mirror-clones-for-unpinned-git-plugin-sources
    provides: makePresenceProbe mirror arm + readMirrorHeadSha (fs-only presence primitives)
provides:
  - probeManifestEntry classifies not-fetched git sources `remote`, warm ones three-way
  - ManifestEntryClassification carries `remote` (classification-layer, not a resolver arm)
  - PluginIndexRow.status + completion-cache status union carry `remote`; schemaVersion 6
  - INSTALL_STATUSES offers `remote` (install performs the fetch)
affects: [80-03, list.ts FilterBucket, info.ts warm-tree resolution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presence-derived classification: makePresenceProbe not-cached -> remote, materialized -> resolveStrict three-way"
    - "classifyManifestEntry return type narrowed via Exclude<..., 'remote'> so resolver-driven consumers keep the three-way bucket type"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
    - extensions/pi-claude-marketplace/shared/completion-cache.ts
    - extensions/pi-claude-marketplace/edge/completions/data.ts
    - tests/orchestrators/plugin/git-source-probe.test.ts
    - tests/orchestrators/edge-deps.test.ts
    - tests/shared/completion-cache.test.ts

key-decisions:
  - "remote derives at the classification layer in probeManifestEntry, NOT as a resolver arm (resolver union stays three-way, NFR-7)"
  - "classifyManifestEntry returns Exclude<ManifestEntryClassification, 'remote'> to keep list.ts/edge-deps consumers on the three-way bucket type without a cast"
  - "Dropped the optional degraded warm-tree test arm (git-source materialized roots resolve installable without plugin.json validation; not deterministically stageable through makePresenceProbe, which does no subdir/manifest validation)"

patterns-established:
  - "Presence-probe + resolveStrict composition (probeUpgradeCandidate template) applied to probeManifestEntry"
  - "schemaVersion triple-bump: schema literal + poison writer + main writer must move together"

requirements-completed: [RSTA-01, RSTA-03, RSTA-05, RSTA-06]

coverage:
  - id: D1
    description: "A not-fetched git-source plugin (url/git-subdir/github) with no materialized clone classifies `remote`, not `available`"
    requirement: "RSTA-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/git-source-probe.test.ts#a not-fetched url source with no clone classifies `remote`"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/edge-deps.test.ts#RSTA-01: a not-fetched url/git-subdir/github manifest entry is emitted `remote` by the completion bucketizer"
        status: pass
    human_judgment: false
  - id: D2
    description: "A not-installed git-source plugin with a WARM clone/mirror classifies via the three-way resolver (available shown)"
    requirement: "RSTA-05"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/git-source-probe.test.ts#a WARM unpinned url source with a valid clone tree classifies `available`"
        status: pass
    human_judgment: false
  - id: D3
    description: "Plugin-index completion cache schemaVersion is 6; pre-fix v5 caches drop+rebuild"
    requirement: "RSTA-03"
    verification:
      - kind: unit
        ref: "tests/shared/completion-cache.test.ts#schemaVersion snapshot :: PLUGIN_INDEX_CACHE_SCHEMA.schemaVersion === 6"
        status: pass
      - kind: unit
        ref: "tests/shared/completion-cache.test.ts#RSTA-03 :: stale v5 plugin-index cache drops + rebuilds into `remote`"
        status: pass
    human_judgment: false
  - id: D4
    description: "Install completion still offers `remote` plugins (install performs the fetch)"
    requirement: "RSTA-01"
    verification:
      - kind: unit
        ref: "tests/edge/completions/provider.test.ts (INSTALL_STATUSES consumer suite, 62 tests green)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Fetched-state derivation: unpinned via mirror-dir presence, pinned via exact per-sha key (RSTA-06)"
    requirement: "RSTA-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/git-source-probe.test.ts#makePresenceProbe: an unpinned source with a WARM mirror dir returns materialized with the fs-read HEAD sha"
        status: pass
    human_judgment: false

# Metrics
duration: 32min
completed: 2026-07-14
status: complete
---

# Phase 80 Plan 02: Remote/warm git-source classification substrate Summary

**`probeManifestEntry` now derives `remote` from an fs-only cold clone/mirror and the three-way resolver verdict from a warm one; `ManifestEntryClassification` + the completion-cache status union carry `remote`, and the cache schemaVersion is bumped 5→6 so pre-fix caches drop+rebuild.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-07-14T13:56:01Z
- **Completed:** 2026-07-14T14:27:35Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Rewrote `probeManifestEntry` to consume `makePresenceProbe`: a cold clone/mirror classifies `remote`; a warm one resolves the three-way verdict (`available` / `partially-available` / `unavailable`) against the on-disk tree via `resolveStrict` with the presence probe injected. Import discipline stays git-free (NFR-5).
- Widened `ManifestEntryClassification` with `remote` at the classification layer; the resolver union stays strictly three-way (NFR-7). Narrowed `classifyManifestEntry` to `Exclude<..., "remote">` so resolver-driven consumers keep the three-way bucket type.
- Added `remote` to the completion-cache status `Type.Union` and `PluginIndexRow.status`; bumped `schemaVersion` 5→6 at all three sites (schema literal + poison writer + main writer). Pre-fix v5 caches drop+rebuild via the existing drop-on-mismatch path (RSTA-03).
- Grew `INSTALL_STATUSES` to `{available, remote}` — install performs the fetch, so a not-yet-fetched git plugin is a valid install target (D-80-05).
- Inverted the three cold-cache unit tests (probe + bucketizer) to `remote`, added a warm-tree `available` case, added a v5 stale-drop cache test, and updated the completion-cache schemaVersion snapshot + current-version writes to 6.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite probeManifestEntry + widen ManifestEntryClassification** - `e3a9ee92` (feat)
2. **Task 2: Bump completion-cache schemaVersion 5→6, add `remote` to status union, offer `remote` in install completion** - `9aeeda86` (feat)

_Note: Task 1 was a TDD task; RED/GREEN landed in a single commit because the union widen and the test inversion are one atomic type-level change (a split RED commit would have left the tree typecheck-red)._

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts` - `probeManifestEntry` presence-derived rewrite; `_locations` → `locations` (now used); docstring replaced.
- `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts` - `ManifestEntryClassification += "remote"`; `classifyManifestEntry` return narrowed to `Exclude<..., "remote">`.
- `extensions/pi-claude-marketplace/shared/completion-cache.ts` - `remote` in status `Type.Union` + `PluginIndexRow.status`; schemaVersion 5→6 at all three sites; RSTA-03 comment.
- `extensions/pi-claude-marketplace/edge/completions/data.ts` - `INSTALL_STATUSES = new Set(["available", "remote"])`.
- `tests/orchestrators/plugin/git-source-probe.test.ts` - three cold tests inverted to `remote`; warm-tree `available` case added.
- `tests/orchestrators/edge-deps.test.ts` - bucketizer + parity git-source assertions re-pointed `available` → `remote`.
- `tests/shared/completion-cache.test.ts` - schemaVersion snapshot + current-version writes → 6; v5 stale-drop test added.

## Decisions Made
- `remote` derives at the classification layer (`probeManifestEntry`), never as a resolver arm — the resolver's three-way union is untouched (NFR-7 / D-80-06).
- `classifyManifestEntry` return type narrowed with `Exclude<ManifestEntryClassification, "remote">`: a `ResolvedPlugin` can only produce the three mapped arms, so this keeps `list.ts` (`FilterBucket`) and `edge-deps.ts` consumers compiling without a cast, and without preempting Plan 03's list.ts rewrite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Narrowed `classifyManifestEntry` return type to keep typecheck green**
- **Found during:** Task 1 (union widen)
- **Issue:** Widening `ManifestEntryClassification` with `remote` propagated the wider return type of `classifyManifestEntry` into `list.ts` (`FilterBucket` assignment, lines 586/601/615) and `edge-deps.test.ts`, breaking `npm run typecheck`. `list.ts` is Plan 03's file (not in this plan's `files_modified`), so a full list.ts rewrite was out of scope.
- **Fix:** Narrowed `classifyManifestEntry`'s return type to `Exclude<ManifestEntryClassification, "remote">`. `remote` is provably never produced from a `ResolvedPlugin` (it derives from fs-only presence, outside the resolver switch), so this is sound and non-invasive.
- **Files modified:** `plugin-state-classifier.ts`
- **Verification:** `npm run typecheck` green; `list.ts` and `edge-deps.test.ts` errors resolved.
- **Committed in:** `e3a9ee92` (Task 1 commit)

**2. [Rule 3 - Blocking] Updated out-of-plan test files broken by in-scope changes**
- **Found during:** Task 2 (schema + status widen)
- **Issue:** `tests/shared/completion-cache.test.ts` (schemaVersion snapshot pinned to 5, five current-version cache writes) and `tests/orchestrators/edge-deps.test.ts` (git-source bucketizer + parity assertions pinned to `available`) failed after the schema bump and the classifier inversion. Neither file is in this plan's `files_modified`.
- **Fix:** Updated the schemaVersion snapshot + current-version writes to 6; added a v5 stale-drop test (RSTA-03 invalidation coverage); re-pointed the edge-deps git-source assertions `available` → `remote`. For the edge-deps output-parity drift-guard, the git-source parity vs `list.ts` is left to Plan 03 (list.ts's short-circuit still emits `available`); the guard now pins the completion surface to `remote` and keeps the non-git (`path` → `unavailable`) parity intact so it does not silently disable.
- **Files modified:** `tests/shared/completion-cache.test.ts`, `tests/orchestrators/edge-deps.test.ts`
- **Verification:** `node --test` on both suites green; full `npm run check` exit 0.
- **Committed in:** `9aeeda86` (Task 2 commit)

**3. [Rule 3 - Blocking] Dropped the optional degraded warm-tree unit test**
- **Found during:** Task 1 (warm-tree test authoring)
- **Issue:** The plan offered an optional degraded warm-tree arm ("if a partial/unavailable fixture is convenient"). A git-source materialized root resolves `installable` even without a `.claude-plugin/plugin.json` (git sources have relaxed manifest requirements vs path sources), and `makePresenceProbe` performs no subdir/manifest validation — it returns the whole mirror as `pluginRoot` regardless of the requested subdir. There is no deterministic way to stage a non-`available` warm fixture through the presence probe alone.
- **Fix:** Kept the required `available` warm case (RSTA-05); dropped the optional degraded arm rather than assert a fixture that resolves `available` in practice.
- **Files modified:** `tests/orchestrators/plugin/git-source-probe.test.ts`
- **Verification:** git-source-probe suite green (9 tests).
- **Committed in:** `e3a9ee92` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking).
**Impact on plan:** All three were necessary to keep the tree green (`npm run check` exit 0) without expanding into Plan 03's list.ts scope. No scope creep — the classifier narrow and test updates are the minimal consequences of the union widen and schema bump.

## Issues Encountered
- **Warm-mirror test staged the wrong cache key.** `parsePluginSource` canonicalizes a url by stripping the `.git` suffix (`https://example.com/plugin.git` → `https://example.com/plugin`), and `makePresenceProbe` hashes the canonical `source.url`. The first warm test staged the mirror at the literal-url key and the probe read the canonical-url key → `not-cached`. Fixed by using a canonical (no-`.git`) url in the fixture so the staged key matches the probed key.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The classification substrate (`ManifestEntryClassification += remote`, `PluginIndexRow.status += remote`, schemaVersion 6) is ready for Plan 03's `edge-deps.ts` parity verification and the list.ts / info.ts git-source short-circuit rewrites.
- **Carry into Plan 03:** `list.ts`'s `availableRowMessage` git short-circuit still emits `available` (its migration to the shared presence-derived classifier is Plan 03). Until then, list-vs-completion git-source parity is intentionally split — the edge-deps output-parity drift-guard pins the completion surface to `remote` and Plan 03 restores full parity.

## Self-Check: PASSED

All 7 modified source/test files and the SUMMARY.md exist on disk; both task commits (`e3a9ee92`, `9aeeda86`) are present in git history.

---
*Phase: 80-remote-status-glyph-reassignment-warm-cache-resolution*
*Completed: 2026-07-14*
