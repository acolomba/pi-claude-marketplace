---
phase: 77-plugin-clone-cache-install
plan: 01
subsystem: infra
tags: [cache-key, sha256, typebox, path-containment, version-render, git-clone]

# Dependency graph
requires:
  - phase: 76-marketplace-git-url-sources
    provides: parse-time canonical URL (.git-stripped, #ref-split), sources-staging atomic-rename lifecycle, ScopedLocations chokepoint pattern
provides:
  - "pluginCloneKey(canonicalUrl, fullSha): the source-addressed <12hex>-<sha12> cache-key helper (single dedup identity)"
  - "shaVersion / looksLikeShaVersion / SHA_VERSION_RE: the sha-<12hex> git-source version convention"
  - "ScopedLocations.pluginClonesDir + pluginCloneDir(key): the plugin-clones SC-7 path chokepoint (NFR-10)"
  - "PLUGIN_INSTALL_RECORD_SCHEMA.resolvedSha: additive-optional full 40-hex commit sha field"
  - "sha-<12hex> list-surface display transform (renders v#<7hex> via renderVersion)"
affects: [77-02-resolver, 77-clone-seam, 77-install-wiring, 78-gc-update]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-addressed dedup key: hash the pre-canonicalized URL verbatim, truncate to 12 hex, dash-join the sha12"
    - "sha-version sibling of the PI-7 hash-version: anchored-exact regex, exact-equality compare, #<7hex> render"
    - "Additive-optional TypeBox field with NO schemaVersion bump and NO migrate fill (lastReconciledExtensionVersion precedent)"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/clone-key.ts
    - tests/domain/clone-key.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/version.ts
    - extensions/pi-claude-marketplace/persistence/locations.ts
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/shared/notify.ts

key-decisions:
  - "pluginCloneKey does NOT canonicalize -- it hashes the URL verbatim; canonicalization is the caller's responsibility (D-77-04)"
  - "resolvedSha is additive-optional with no schemaVersion bump and no migrate fill (D-77-02)"
  - "renderVersion chains formatHashVersionForDisplay then formatShaVersionForDisplay; each no-ops the other's shape so order is irrelevant"

patterns-established:
  - "Cache-key truncation width (12) shared with domain/version.ts HASH_TRUNC via a local KEY_TRUNC const equal to it"
  - "pluginCloneDir mirrors sourceCloneDir verbatim: assertSafeName -> path.join -> assertPathInside"

requirements-completed: [PURL-04, PURL-09]

coverage:
  - id: D1
    description: "pluginCloneKey(url, sha) returns deterministic filesystem-safe <12hex(sha256(url))>-<sha12>, distinct per canonical URL"
    requirement: "PURL-04"
    verification:
      - kind: unit
        ref: "tests/domain/clone-key.test.ts#PURL-04 pluginCloneKey returns <12hex>-<sha12> with the sha256(url) left half"
        status: pass
      - kind: unit
        ref: "tests/domain/clone-key.test.ts#PURL-04 pluginCloneKey is filesystem-safe: no separators, matches the fixed shape"
        status: pass
    human_judgment: false
  - id: D2
    description: "shaVersion / looksLikeShaVersion / SHA_VERSION_RE implement the sha-<12hex> convention with anchored-exact matching"
    requirement: "PURL-09"
    verification:
      - kind: unit
        ref: "tests/domain/version.test.ts#PURL-09 / D-77-01 shaVersion returns sha- + first 12 hex of the full sha"
        status: pass
      - kind: unit
        ref: "tests/domain/version.test.ts#PURL-09 / D-77-01 looksLikeShaVersion rejects uppercase, wrong length, hash-, and semver"
        status: pass
    human_judgment: false
  - id: D3
    description: "pluginClonesDir + pluginCloneDir(key) enforce NFR-10 containment; a traversal key rejects (T-77-01-01)"
    requirement: "PURL-04"
    verification:
      - kind: unit
        ref: "tests/persistence/locations.test.ts#SC-7 / D-77-03 pluginCloneDir refuses a traversal key (upstream assertSafeName)"
        status: pass
      - kind: unit
        ref: "tests/persistence/locations.test.ts#SC-7 / D-77-03 pluginCloneDir(key) happy path returns under pluginClonesDir"
        status: pass
    human_judgment: false
  - id: D4
    description: "resolvedSha additive-optional field: legacy record loads without it, a 40-hex sha round-trips, toDisabledRecord preserves it; no schemaVersion bump / no migrate fill"
    requirement: "PURL-09"
    verification:
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#D-77-02 saveState + loadState round-trips resolvedSha intact"
        status: pass
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#D-77-02 STATE_VALIDATOR accepts a plugin record WITHOUT resolvedSha (legacy loads unchanged)"
        status: pass
    human_judgment: false
  - id: D5
    description: "sha-<12hex> renders v#<7hex> on the list surface via renderVersion; hash-version and SemVer render paths unchanged (T-77-01-02)"
    requirement: "PURL-09"
    verification:
      - kind: unit
        ref: "tests/domain/version.test.ts#PURL-09 / D-77-01 renderVersion renders sha-<12hex> as v#<first 7 hex>"
        status: pass
      - kind: unit
        ref: "tests/shared/notify-v2.test.ts#D-77-01 / PURL-09 notify renders single-version sha row as v#<7hex> via renderVersion chokepoint"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-07-11
status: complete
---

# Phase 77 Plan 01: Plugin clone cache + install leaf primitives Summary

**Source-addressed `<12hex(sha256(url))>-<sha12>` cache-key helper, the `sha-<12hex>` git-source version convention with its `#<7hex>` list-surface render, the `plugin-clones/` NFR-10 path chokepoint, and the additive-optional `resolvedSha` state field — the dependency roots every later Phase 77 plan consumes.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-11T11:10:42Z
- **Completed:** 2026-07-11T11:18:06Z
- **Tasks:** 4
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments
- `pluginCloneKey(canonicalUrl, fullSha)` — the single source-addressed dedup identity shared by the clone seam and install; deterministic, filesystem-safe, distinct per canonical URL.
- `shaVersion` / `looksLikeShaVersion` / `SHA_VERSION_RE` in `domain/version.ts` — the `sha-<12hex>` git-source version convention, an anchored-exact sibling of the PI-7 `hash-<12hex>` helpers.
- `ScopedLocations.pluginClonesDir` + `pluginCloneDir(key)` — the SC-7 path chokepoint routing the cache key through `assertSafeName` + `assertPathInside`; a `../`/separator key rejects (T-77-01-01 mitigation).
- `PLUGIN_INSTALL_RECORD_SCHEMA.resolvedSha` — additive-optional full 40-hex commit sha; legacy records load unchanged, new records round-trip, no schemaVersion bump, no migrate fill.
- `renderVersion` now renders a persisted `sha-<12hex>` as the compact `v#<7hex>` short form, mirroring the hash-version arm; hash and SemVer render paths are byte-unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Cache-key helper + sha-version helpers** - `92c0ae40` (feat, TDD)
2. **Task 2: plugin-clones SC-7 path chokepoint** - `53b95a9f` (feat)
3. **Task 3: additive resolvedSha state field** - `c6c5733f` (feat)
4. **Task 4: sha-version list-surface display transform** - `75760ecf` (feat)

_Task 1 combined the RED test file and GREEN implementation into one feat commit (both files form one atomic unit under the plan's shared verify command)._

## Files Created/Modified
- `extensions/pi-claude-marketplace/domain/clone-key.ts` (created) - `pluginCloneKey` source-addressed cache-key helper (PURL-04 / D-77-04).
- `extensions/pi-claude-marketplace/domain/version.ts` - added `shaVersion`, `looksLikeShaVersion`, `SHA_VERSION_RE` (PURL-09 / D-77-01).
- `extensions/pi-claude-marketplace/persistence/locations.ts` - added `pluginClonesDir` field + const + bundle entry and the `pluginCloneDir(key)` chokepoint method (SC-7 / D-77-03 / NFR-10).
- `extensions/pi-claude-marketplace/persistence/state-io.ts` - added `resolvedSha: Type.Optional(Type.String())` to the plugin install record (D-77-02 / PURL-09).
- `extensions/pi-claude-marketplace/shared/notify.ts` - added `formatShaVersionForDisplay` and routed `renderVersion` through it (D-77-01 / PURL-09).
- `tests/domain/clone-key.test.ts` (created) - cache-key determinism, cross-url distinctness, filesystem-safety.
- `tests/domain/version.test.ts` - sha-version helper + `renderVersion` display-transform cases.
- `tests/persistence/locations.test.ts` - `pluginCloneDir` containment + traversal-rejection cases.
- `tests/persistence/state-io.test.ts` - `resolvedSha` validator, round-trip, and disable-preservation cases.
- `tests/shared/notify-v2.test.ts` - full-path notify render assertion for the sha-version arm.

## Decisions Made
- **`pluginCloneKey` hashes verbatim (D-77-04):** canonicalization is the caller's responsibility so url-shape and github-object-shape sources that reconstruct the same canonical URL share one left half and dedup to one clone. A local `KEY_TRUNC = 12` const equals `version.ts::HASH_TRUNC`, keeping both halves 12 hex.
- **`resolvedSha` additive-optional (D-77-02):** no schemaVersion bump, no migrate fill — mirrors the `lastReconciledExtensionVersion` precedent; absence of an optional field is legal. `toDisabledRecord`'s `...record` spread preserves it automatically (no change needed there).
- **`renderVersion` formatter chain:** chose the `formatShaVersionForDisplay` sibling (option a) over generalizing the existing formatter, so each formatter stays a single-shape no-op and the `looksLikeShaVersion` predicate is reused from `domain/version.ts` (no regex duplication). notify.ts stays a dumb renderer — pure string transform, no state probing.

## Deviations from Plan

**1. [Rule 2 - Missing critical coverage] Added a full-path notify render test in tests/shared/notify-v2.test.ts**
- **Found during:** Task 4 (sha-version display transform)
- **Issue:** The plan named `tests/domain/version.test.ts` for the display-transform test, but the actual render funnel (`renderVersion`) lives in `notify.ts` and its existing coverage is the full-path `notify(...)` assertions in `tests/shared/notify-v2.test.ts`. A domain-only unit test proves the string transform but not that it fires through the real row-composition path.
- **Fix:** Added the direct `renderVersion` unit cases to `tests/domain/version.test.ts` (satisfying the plan's named verify command) AND a companion full-path `notify(...)` render assertion to `tests/shared/notify-v2.test.ts` mirroring the existing hash-version render test.
- **Files modified:** tests/shared/notify-v2.test.ts (one added file beyond the plan's 9-file list)
- **Verification:** `node --test "tests/shared/notify-v2.test.ts"` — 159 pass.
- **Committed in:** `75760ecf` (Task 4 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical coverage)
**Impact on plan:** The extra test strengthens the render-path guarantee with no source scope creep. All four source files match the plan exactly.

## Issues Encountered
- **Worktree lacks `node_modules`:** `npm run typecheck` cannot run inside the isolation worktree. Ran `tsc --noEmit -p tsconfig.json` using the main repo's `tsc` binary against the worktree's tsconfig — exit 0, all new exports and the optional `resolvedSha` field type-check with no existing caller breakage.
- **`cd` cwd-drift:** the plan's verify commands `cd /home/acolomba/pi-claude-marketplace` (main repo), but the files live in the worktree. Ran `node --test` from the worktree root instead; all named test files pass there.
- **trufflehog under worktree sandbox:** the pre-commit trufflehog auto-updater cannot read the worktree `.git` index (documented CLAUDE.md limitation). Committed with `SKIP=trufflehog` per project policy; the changed files contain only hex fixtures and pure helpers (no secrets).

## Threat Coverage
- **T-77-01-01 (Tampering, high, mitigate):** `pluginCloneDir` routes the key through `assertSafeName` + `assertPathInside(pluginClonesDir, ...)`; traversal/separator keys reject (asserted).
- **T-77-01-02 (Tampering, low, mitigate):** `SHA_VERSION_RE = /^sha-[0-9a-f]{12}$/` rejects uppercase/wrong-length/affixed strings so a malformed pseudo-sha is never rewritten to a misleading `#<7hex>` (asserted).
- **T-77-01-03 (Info disclosure, low, accept):** 12-hex `sha256(url)` truncation per D-77-04; accepted per the milestone threat model (full url+sha persisted for reverse verification).

## Known Stubs
None — every helper is fully wired and tested.

## Next Phase Readiness
- Plans 02 (resolver), 03 (clone seam), and 04 (install wiring) can wire against the stable `pluginCloneKey` / `pluginCloneDir` / `shaVersion` / `resolvedSha` contract.
- Plan 77-02 runs in parallel touching only `domain/resolver.ts`; no file overlap with this plan.

## Self-Check: PASSED

- All created files verified on disk (`clone-key.ts`, `clone-key.test.ts`, `77-01-SUMMARY.md`).
- All 5 commits verified in git log (`92c0ae40`, `53b95a9f`, `c6c5733f`, `75760ecf`, `ba18e3bd`).

---
*Phase: 77-plugin-clone-cache-install*
*Completed: 2026-07-11*
