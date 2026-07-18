---
phase: 78-plugin-git-source-lifecycle
plan: 09
subsystem: api
tags: [git-source, completion, resolver, cache-schema, parity, typescript]

# Dependency graph
requires:
  - phase: 78-plugin-git-source-lifecycle
    provides: "list.ts D-78-03 git-source short-circuit + D-78-04 warm-cache presence probe (78-03/78-04)"
  - phase: 77-plugin-clone-cache
    provides: "resolveStrict git arm, GitPluginRootResult union, plugin clone cache keys"
provides:
  - "Shared git-source probe module (probeManifestEntry / probeUpgradeCandidate / makePresenceProbe) consumed by both list.ts and the completion bucketizer"
  - "Completion bucketizer classifies not-installed git-source entries `available` at parity with list (install completion now offers them)"
  - "PLUGIN_INDEX_CACHE_SCHEMA bumped 4 -> 5 so stale caches with git-source rows misclassified `unavailable` drop+rebuild"
  - "Output-parity drift-guard test locking list and completion to identical git-source status buckets"
affects: [plugin-install-completion, plugin-update-completion, edge-completions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared probe module owns the git-aware resolve inputs both surfaces feed to the shared classifier"
    - "Cache schemaVersion bump as the drop+rebuild migration lever for a classification-logic fix"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
    - tests/orchestrators/plugin/git-source-probe.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
    - extensions/pi-claude-marketplace/shared/completion-cache.ts
    - tests/orchestrators/edge-deps.test.ts
    - tests/shared/completion-cache.test.ts

key-decisions:
  - "Extracted list.ts's two inline probe behaviors (D-78-03 short-circuit + D-78-04 presence probe) into a shared fs-only module rather than duplicating them in edge-deps.ts, so the two surfaces cannot drift"
  - "Bumped PLUGIN_INDEX_CACHE_SCHEMA 4 -> 5 (not a silent in-place fix) so pre-fix caches carrying wrong `unavailable` git-source rows drop+rebuild on next read"
  - "probeManifestEntry never throws (folds catch to `unavailable`), so edge-deps callers drop their local try/catch"

patterns-established:
  - "Shared probe module: list-surface and completion-surface both import probeManifestEntry / probeUpgradeCandidate; the git-source short-circuit lives in exactly one place"
  - "Output-parity drift-guard: feed one fixture through both surfaces and assert.deepEqual the name->status maps to catch future divergence"

requirements-completed: [PURL-08]

coverage:
  - id: D1
    description: "Install completion offers a not-installed git-source plugin (url / git-subdir / github) as (available), at parity with list"
    requirement: "PURL-08"
    verification:
      - kind: unit
        ref: "tests/orchestrators/edge-deps.test.ts#PURL-08 / D-78-03: a not-installed url/git-subdir/github manifest entry is emitted `available` by the completion bucketizer (install completion offers it, not filters it out)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The completion bucketizer and the list row builder feed the SAME git-aware probe inputs to the shared classifier — identical status buckets on the same manifest"
    requirement: "PURL-08"
    verification:
      - kind: unit
        ref: "tests/orchestrators/edge-deps.test.ts#PURL-08 / D-78-03 output-parity: the list row builder and the completion bucketizer emit identical git-source status buckets"
        status: pass
    human_judgment: false
  - id: D3
    description: "A stale plugin-index cache written before the fix (schemaVersion 4) is dropped and rebuilt on next read"
    requirement: "PURL-08"
    verification:
      - kind: unit
        ref: "tests/shared/completion-cache.test.ts#PURL-08 :: stale v4 plugin-index cache (git-source rows misclassified unavailable) drops + rebuilds"
        status: pass
    human_judgment: false
  - id: D4
    description: "The shared probe module is fs-only (no git/network surface); makePresenceProbe returns not-cached for unpinned sources and materialized only when the pinned clone dir exists"
    requirement: "PURL-08"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/git-source-probe.test.ts#makePresenceProbe: a pinned source resolves `materialized` when the clone dir exists on disk"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-07-13
status: complete
---

# Phase 78 Plan 09: Git-source completion parity Summary

**Extracted list.ts's git-source short-circuit and warm-cache presence probe into a shared fs-only module, wired it into the completion bucketizer, and bumped the plugin-index cache schema — so install completion now offers not-installed git-source plugins as (available) at parity with list.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-13T03:45:22Z
- **Completed:** 2026-07-13T04:20:43Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Closed the MAJOR round-2 UAT gap: the completion bucketizer classified every git-source manifest entry `unavailable` (so install completion filtered them out) while list rendered them `(available)`. Both surfaces now feed the same git-aware probe inputs to the shared classifier.
- Created a shared fs-only probe module (`git-source-probe.ts`) owning the D-78-03 short-circuit and D-78-04 presence probe; list.ts and edge-deps.ts both consume it, so the two surfaces cannot drift.
- Bumped `PLUGIN_INDEX_CACHE_SCHEMA` 4 -> 5 so pre-fix caches carrying wrong `unavailable` git-source rows drop+rebuild on next read.
- Added an output-parity drift-guard test that feeds one url+git-subdir+github+path fixture through both the list row builder and the completion bucketizer and asserts identical status buckets.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract the shared git-source probe module from list.ts inline behaviors** - `dcecd655` (feat)
2. **Task 2: Wire the git-aware probe into the completion bucketizer and bump the plugin-index cache schema** - `bec0fc24` (fix)
3. **Task 3: Output-parity drift-guard across a git-source fixture** - `a5299695` (test)

_TDD tasks combined RED+GREEN into a single per-task commit because Task 1 is a behavior-preserving extraction and Tasks 2/3 are fix+guard whose test and implementation are one logical change._

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts` - NEW fs-only shared probe module: `probeManifestEntry` (D-78-03 git-source short-circuit + catch-to-unavailable fold), `probeUpgradeCandidate` (D-78-04 presence-probe injection + CR-01 degrade), `makePresenceProbe` (warm-clone presence probe, moved verbatim from list.ts)
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - Deleted the local `makePresenceProbe`; re-imports it from the shared module; added `__test_availableRowMessage` re-export for the parity guard
- `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` - `classifyNotInstalledPluginRow` / `classifyInstalledPluginRow` now take `locations` and route through `probeManifestEntry` / `probeUpgradeCandidate`; `loadManifestForMarketplace` threads the per-scope `locations`
- `extensions/pi-claude-marketplace/shared/completion-cache.ts` - `PLUGIN_INDEX_CACHE_SCHEMA` schemaVersion 4 -> 5 at all three sites (schema literal + two write literals); header comment documents the git-source drop+rebuild rationale
- `tests/orchestrators/plugin/git-source-probe.test.ts` - NEW unit coverage for the three probe helpers
- `tests/orchestrators/edge-deps.test.ts` - git-source fixture + bucketizer regression test + output-parity drift-guard
- `tests/shared/completion-cache.test.ts` - schemaVersion snapshot 4 -> 5; on-disk cache fixtures updated to v5; new v4-stale-drop test

## Decisions Made
- **Single shared probe module over duplication:** the D-78-03 short-circuit and D-78-04 presence probe were added only to list.ts in 78-03/78-04; the completion bucketizer never got either. Rather than copy the logic into edge-deps.ts, extracted it into a shared fs-only module so both surfaces read from one source. The parity drift-guard makes future divergence a test failure.
- **Cache schema bump as the migration lever:** a classification-logic fix alone would leave pre-fix caches serving the wrong `unavailable` rows until TTL. Bumping the schemaVersion drops+rebuilds every stale cache on next read via the existing mismatch path — no manual migration (the plugin-index cache is an ephemeral optimization cache).
- **probeManifestEntry never throws:** it folds a resolveStrict failure to `unavailable` internally, so edge-deps callers dropped their local try/catch (the shared helper owns the catch).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale hardcoded schemaVersion in completion-cache tests**
- **Found during:** Task 2 (schema bump)
- **Issue:** `tests/shared/completion-cache.test.ts` hardcoded `schemaVersion: 4` in the schema snapshot assertion and five on-disk cache fixtures. After the 4 -> 5 bump, four tests failed (the on-disk v4 caches were now stale-by-schema and dropped+rebuilt instead of being served).
- **Fix:** Updated the snapshot assertion and the current-version cache fixtures to 5, and added a new `PURL-08 :: stale v4 plugin-index cache ... drops + rebuilds` test locking the new bump. The pre-existing v3-stale test kept its v3 fixture (still validly exercises the drop path).
- **Files modified:** tests/shared/completion-cache.test.ts
- **Verification:** `node --test tests/shared/completion-cache.test.ts` — 23 pass, 0 fail
- **Committed in:** `bec0fc24` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — test-fixture staleness directly caused by the in-scope schema bump)
**Impact on plan:** The fix was required for the schema bump to land green; it also added coverage for the new bump. No scope creep — the change is confined to the schema this plan bumped.

## Issues Encountered
- The plan's Task 1 acceptance criterion `grep -v '^import' git-source-probe.ts | grep -cE '\bgitOps\b|...'` expects 0, but the module's doc-comments originally named `gitOps` / `platform/git` when describing what it deliberately excludes. Reworded those comments so the literal grep returns 0; the authoritative `no-orchestrator-network` architecture gate (which strips comments) was green throughout.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The round-2 UAT test-3 reproduction (install completion offering git-source plugins) now passes at the bucketizer level. 78-10 (the remaining round-2 gap plan) can proceed.
- List, completion, install, and update surfaces share one git-source classification path guarded by the parity drift-guard.

## Self-Check: PASSED

- Created files exist: git-source-probe.ts, git-source-probe.test.ts, 78-09-SUMMARY.md
- Task commits exist: dcecd655, bec0fc24, a5299695
- `npm run check` green (typecheck + ESLint + Prettier + 2739 unit pass / 1 pre-existing skip / 0 fail + integration pass)

---
*Phase: 78-plugin-git-source-lifecycle*
*Completed: 2026-07-13*
