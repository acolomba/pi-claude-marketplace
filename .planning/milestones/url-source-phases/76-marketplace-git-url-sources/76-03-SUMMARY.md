---
phase: 76-marketplace-git-url-sources
plan: 03
subsystem: orchestrators
tags: [url-source, marketplace-info, notify, import, catalog-uat, state-io]

# Dependency graph
requires:
  - phase: 76-marketplace-git-url-sources
    plan: 01
    provides: "UrlSource discriminated union arm, generic-https parser, samePlannedSource url arm"
provides:
  - "marketplace info renders url sources as `url: <url>[#ref]` (never `path:`)"
  - "marketplace info last_updated: gate widened to all git-backed kinds (github + url), never path"
  - "state-io loadState revalidates persisted url-kind source records"
  - "import maps nested extraKnownMarketplaces {source:{...}} shape (url/github/directory) plus the flat legacy shape"
  - "catalog UAT + output-catalog carry byte-equal url info forms"
affects: [marketplace-info, import, provider-auth]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "buildBlock branches url BEFORE the path fallback so a url source never renders its clone dir"
    - "last_updated gate widened from sourceKind === github to sourceKind !== path (all git-backed kinds)"
    - "import dual-shape reader: flat legacy shape first (no regression), then nested upstream {source:{...}} shape"

key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts"
    - "extensions/pi-claude-marketplace/shared/notify.ts"
    - "extensions/pi-claude-marketplace/persistence/state-io.ts"
    - "extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts"
    - "tests/orchestrators/marketplace/info.test.ts"
    - "tests/orchestrators/import/marketplaces.test.ts"
    - "tests/architecture/catalog-uat.test.ts"
    - "docs/output-catalog.md"

key-decisions:
  - "D-76-09: url sources project a kind-labeled `url: <url>[#ref]` line, branched before the path fallback"
  - "D-76-10: last_updated: gate widens to all git-backed kinds (sourceKind !== path)"
  - "D-76-13: import reads BOTH the flat legacy shape and the nested upstream {source:{...}} shape"

patterns-established:
  - "Persisted-record revalidation must gain a url arm in normalizeStoredSource whenever a new git-backed kind lands"

requirements-completed: [MURL-05, MURL-07]

coverage:
  - id: D1
    description: "marketplace info renders a url source as `url: <url>[#ref]` (never `path:`), with `last_updated:` for the git-backed kind"
    requirement: "MURL-05"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/info.test.ts#MURL-05: single-scope url source with ref + lastUpdatedAt renders `url: <url>#<ref>` and `last_updated:`"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/info.test.ts#MURL-05: single-scope url source without ref drops the #<ref> suffix from the `url:` line"
        status: pass
    human_judgment: false
  - id: D2
    description: "path sources still never render last_updated:; github output is byte-identical (regression)"
    requirement: "MURL-05"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/info.test.ts#INFO-01: single-scope path source renders `path: <abs>`; NO `last_updated:`; NO `description:`"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/info.test.ts#INFO-01: single-scope github source with autoupdate + lastUpdatedAt + description renders the 4-line body"
        status: pass
    human_judgment: false
  - id: D3
    description: "catalog UAT + docs carry byte-equal url info forms (with and without #ref, with last_updated)"
    requirement: "MURL-05"
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() (url-single-scope-full)"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() (url-single-scope-minimal)"
        status: pass
    human_judgment: false
  - id: D4
    description: "import maps nested {source:{source:url|github|directory}} entries AND the flat legacy shapes; file/unrecognized stay unmappable"
    requirement: "MURL-07"
    verification:
      - kind: unit
        ref: "tests/orchestrators/import/marketplaces.test.ts#MURL-07 planMarketplaceSourcesForRefs maps nested url/github/directory extra-known entries"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/import/marketplaces.test.ts#MURL-07 planMarketplaceSourcesForRefs leaves the nested file shape unmappable"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/import/marketplaces.test.ts#planMarketplaceSourcesForRefs maps directory and github.repo extra-known entries"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-07-11
status: complete
---

# Phase 76 Plan 03: url info render + nested import mapping Summary

**`marketplace info` now renders url sources as `url: <url>[#ref]` with `last_updated:` for git-backed kinds (never `path:`), a persisted url record loads correctly, and `import` maps both the flat legacy and nested upstream `extraKnownMarketplaces` shapes.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-07-11
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Added a `url` source projection to `buildBlock` in `info.ts`, branched BEFORE the `path` fallback so a url source renders `url: <url>[#ref]` (its clone dir would be wrong) — D-76-09.
- Widened the `MarketplaceInfoMessage.source` union with a `url` arm and added a `case "url"` to `renderMarketplaceInfo`; lifted the `last_updated:` emission out of the github case and re-gated it on `sourceKind !== "path"` so it fires for all git-backed kinds (github + url) but never for path — D-76-10. The `assertNever` exhaustiveness check confirms the url arm is handled.
- Upgraded `marketplaceSourceFromExtra` in `import/marketplaces.ts` to read BOTH the flat legacy shape (`{directory}`, `{github:{repo}}` — no regression) and the nested upstream `{source:{source, ...}}` shape (url + github + directory), returning a source string the parser accepts; the `file` shape and unrecognized discriminators stay unmappable — D-76-13. Widened the unmappable diagnostic wording (the `code` identifier is unchanged).
- Added catalog UAT fixtures (`url-single-scope-full`, `url-single-scope-minimal`) and matching `docs/output-catalog.md` byte forms so the catalog and the renderer stay byte-equal (MURL-05).

## Task Commits

1. **Task 1: Render url sources on the info surface** — `97671495` (feat)
2. **Task 2: Read the nested extraKnownMarketplaces url shape in import** — `219b80cf` (feat)
3. **Task 3: Add catalog UAT byte-forms for the url info surface** — `7461ec31` (test)

_TDD tasks 1-2 combined RED tests and GREEN implementation into a single feat commit per task (tests and implementation live in the same task `<files>`)._

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` — `buildBlock` gains a `url` projection arm before the `path` fallback; header comment updated.
- `extensions/pi-claude-marketplace/shared/notify.ts` — `MarketplaceInfoMessage.source` gains a `url` arm; `renderMarketplaceInfo` gains a `case "url"` and the `last_updated:` gate widened to `sourceKind !== "path"`; doc comments updated.
- `extensions/pi-claude-marketplace/persistence/state-io.ts` — `normalizeStoredSource` gains a `url` revalidation arm (see Deviations).
- `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts` — dual-shape `marketplaceSourceFromExtra` + `nestedMarketplaceSource` helper; widened diagnostic wording.
- `tests/orchestrators/marketplace/info.test.ts` — url-with-ref, url-without-ref cases; stale forward-compat comment corrected.
- `tests/orchestrators/import/marketplaces.test.ts` — nested url/github/directory/file cases.
- `tests/architecture/catalog-uat.test.ts` — two url info fixtures.
- `docs/output-catalog.md` — url info byte-form rows + widened section intro.

## Decisions Made
- **url stored-record revalidation (D-76-09 follow-through):** `normalizeStoredSource` re-parses the stored `raw` via `parsePluginSource` and asserts it classifies as `url`, mirroring the existing `github` arm — a corrupt raw throws a clear error. Without this, a persisted url record was unloadable, which would have made MURL-05 unreachable end-to-end.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `normalizeStoredSource` rejected persisted url-kind records**
- **Found during:** Task 1 (GREEN — the info test roundtrips through `saveState`/`loadState`)
- **Issue:** `persistence/state-io.ts::normalizeStoredSource` only handled `path`/`github` object records and threw `"malformed source object (missing kind/raw)"` for a `kind: "url"` record. A persisted url marketplace therefore could not be loaded, blocking the entire MURL-05 info render path end-to-end (not just the test).
- **Fix:** Added a `url` arm that re-parses the stored `raw` through `parsePluginSource` (ST-6 factory funnel) and asserts it classifies as `url`, mirroring the `github` arm.
- **Files modified:** `extensions/pi-claude-marketplace/persistence/state-io.ts`
- **Verification:** `node --test "tests/orchestrators/marketplace/info.test.ts"` (15 pass); `node --test "tests/persistence/state-io.test.ts"` (25 pass, no regression); `npm run typecheck` green.
- **Committed in:** `97671495` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The state-io fix is a correctness prerequisite for the plan's goal (info rendering a *persisted* url record). It is outside the plan's declared `files_modified` list but strictly within scope (directly on the MURL-05 path) and does not overlap the parallel executor's files (add/update/remove/git.ts). No scope creep.

## Issues Encountered
- **No `node_modules` in the worktree:** a full `npm run check` (typecheck + lint + format:check + tests + coverage) cannot run standalone here, but `node --test` runs natively (Node strips TS) and `npm run typecheck` resolves. Full-suite `npm run check` and coverage counting are deferred to the orchestrator post-merge, standard in worktree mode.
- **trufflehog:** cannot scan inside the worktree sandbox (the documented auto-updater/index limitation); commits used the sanctioned `SKIP=trufflehog` prefix. Other pre-commit hooks ran normally.

## Next Phase Readiness
- MURL-05 (info render) and MURL-07 (import mapping) are complete. Together with plan 76-01 (parser + REASONS) and the parallel plan 76-02 (add/update/remove clone plumbing), the marketplace url-source surface is wired across parse, add, update, remove, list (unchanged, D-76-11), info, config reconcile, and import.

## Self-Check: PASSED

- SUMMARY.md present on disk.
- Task commits verified in git log: `97671495`, `219b80cf`, `7461ec31`.
- Modified files exist on disk (info.ts, notify.ts, state-io.ts, import/marketplaces.ts, three test files, output-catalog.md).

---
*Phase: 76-marketplace-git-url-sources*
*Completed: 2026-07-11*
