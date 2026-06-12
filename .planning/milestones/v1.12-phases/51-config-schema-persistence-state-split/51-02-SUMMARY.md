---
phase: 51-config-schema-persistence-state-split
plan: 02
subsystem: persistence
tags: [persistence, merge, state-split, migrate, v1.12, CFG-02, SPLIT-01]
requirements: [CFG-02, SPLIT-01]
dependency_graph:
  requires:
    - 51-01 (Plan 01)
        provides:
          - extensions/pi-claude-marketplace/persistence/config-io.ts (CONFIG_SCHEMA, loadConfig, ConfigLoadResult trichotomy)
          - ScopedLocations.configJsonPath / configLocalJsonPath
    - extensions/pi-claude-marketplace/persistence/state-io.ts (analog template; MARKETPLACE_RECORD_SCHEMA target)
    - extensions/pi-claude-marketplace/persistence/migrate.ts (existing ensure* helpers; persistMigratedState IL-3 callsite)
  provides:
    - extensions/pi-claude-marketplace/persistence/config-merge.ts (NEW)
    - MergedConfigEntry<T> / MergedConfig / ScopeLoadOutcome types
    - mergeScopeConfigs(base, local) pure entry-level reducer
    - loadMergedScopeConfig(loc) async loader returning merged + per-file ConfigLoadResults
    - MARKETPLACE_RECORD_SCHEMA carve-out: `autoupdate` field REMOVED (lives in CONFIG_SCHEMA now)
    - ensureNoLegacyAutoupdate(mp) helper in migrate.ts (file-private)
    - migrateLegacyMarketplaceRecords signature extended to (parsed, extensionRoot, configJsonPath)
    - tests/persistence/fixtures/legacy/state-with-autoupdate.json (NEW fixture)
  affects:
    - Phase 52 (first-run migration) — consumes loadMergedScopeConfig per-scope shape; reads legacy `autoupdate` from in-memory state BEFORE the D-13 gate opens
    - Phase 53 (reconcile planner / dry-run) — input is MergedConfig per scope; CMP-3 cross-scope visibility uses per-scope merged views
    - Phase 54 (enable/disable) — reads MergedConfigEntry.entry.enabled; this plan establishes the seam
    - Phase 55 (load-time reconcile apply) — D-18 one-invalid-file fallback consumes ScopeLoadOutcome.{base,local}.status
    - Phase 56 (write-back) — uses ScopeLoadOutcome.base/local provenance to target the correct physical file (Pitfall 51-4)
    - Phases 54-56 (SPLIT-01 cast-migration cleanup) — readers/writers of `record.autoupdate` outside `persistence/` carry `// SPLIT-01:` markers for audit-and-rewire
tech-stack:
  added: []
  patterns:
    - "Pure entry-level reducer: union the key sets of base + local; local-wins per entry (NEVER field-merge). Provenance `\"base\" | \"local\"` is carried per entry so write-back can target the right file."
    - "loadMergedScopeConfig returns both `merged` and per-file `ConfigLoadResult`s (Pitfall 51-4 / D-18); invalid arms contribute empty `{}` to merged but their status is exposed for downstream policy."
    - "Existing typebox lenient default + the D-13 ORDERING RAIL: schema carve-out + scrub gated on existsSync(configJsonPath) preserves legacy `autoupdate` for one extra load until Phase 52 captures it."
    - "// SPLIT-01: cast pattern at ~15 production + ~10 test sites — `(record as unknown as Record<string, unknown>).autoupdate === true` for reads, `(mut as Record<string, unknown>).autoupdate = enable` for writes. D-04 anti-pattern guard: undefined === false everywhere."
key-files:
  created:
    - extensions/pi-claude-marketplace/persistence/config-merge.ts
    - tests/persistence/config-merge.test.ts
    - tests/persistence/fixtures/legacy/state-with-autoupdate.json
    - .planning/phases/51-config-schema-persistence-state-split/51-02-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/persistence/state-io.ts (MARKETPLACE_RECORD_SCHEMA carve-out + configJsonPath thread)
    - extensions/pi-claude-marketplace/persistence/migrate.ts (existsSync gate + ensureNoLegacyAutoupdate helper + 3-arg signature)
    - tests/persistence/state-io.test.ts (2 SPLIT-01 cases)
    - tests/persistence/migrate.test.ts (3 D-13 GATE cases + 3-arg call-site updates)
    - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts (SPLIT-01 cast: 2 reads)
    - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts (SPLIT-01 cast: 1 read)
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts (SPLIT-01 cast: 4 sites — autoupdate flip read/write)
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts (SPLIT-01 cast: 1 read)
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts (SPLIT-01 cast: 1 read)
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts (SPLIT-01 cast: 1 read)
    - tests/edge/handlers/plugin/bootstrap.test.ts (SPLIT-01 cast: 1 read)
    - tests/orchestrators/marketplace/autoupdate.test.ts (recordAutoupdate helper + 6 read sites + factory write cast)
    - tests/orchestrators/marketplace/info.test.ts (withAutoupdate helper + 4 fixture writes)
    - tests/orchestrators/marketplace/list.test.ts (withAutoupdate helper + 2 fixture writes)
    - tests/orchestrators/plugin/bootstrap.test.ts (factory cast + 2 read sites)
decisions:
  - "D-01 (entry-level override unit, anti-deepmerge): mergeScopeConfigs replaces the entry wholesale when local has the same key; no field-by-field merge. Anti-deepmerge anchor test asserts `merged.marketplaces[k].entry.autoupdate === undefined` when local omits autoupdate even though base set it."
  - "D-09 / D-10 (lenient unknown keys + write-back preservation contract): merge does NOT inject the absent autoupdate; preservation is a Phase 56 write-back concern, not a merge concern."
  - "D-12 (no STATE_SCHEMA bump): schemaVersion stays Type.Literal(1); the carve-out is structural (field removed from schema) — typebox lenient default accepts legacy state.json with an extra `autoupdate` property on load."
  - "D-13 ORDERING RAIL: autoupdate scrub gated on `existsSync(configJsonPath)`. On FIRST load of an upgraded v1.0-v1.11 install (no config file yet), legacy autoupdate is PRESERVED in-memory for Phase 52 to read. Subsequent loads see the config file and scrub. SYNC `existsSync` chosen by design — the gate predicate must not race the in-memory transform."
  - "D-14 (source KEEPS on STATE_SCHEMA): `source: Type.Unknown()` unchanged on MARKETPLACE_RECORD_SCHEMA — the materialized machine fact is a state concern even though the user-authored desired-state lives in CONFIG_SCHEMA."
  - "D-16 (dangling plugin reference is VALID merged config): merge does not abort on a plugin entry whose marketplace name does not appear in either marketplaces map; reconcile soft-fails per-entry in Phase 55."
  - "D-18 (per-file results returned): ScopeLoadOutcome exposes both `base` and `local` ConfigLoadResults so downstream Phase 55 can implement one-invalid-file fallback policy without re-reading the files."
  - "loadMergedScopeConfig does NOT inject notify; messaging (D-19) routes through shared/notify.ts in Phases 52/55/56."
  - "Rule 4 deviation (user-approved 2026-06-10) — SPLIT-01 cast migration: the schema carve-out broke ~27 TS sites across 11 files outside `persistence/`. Option A chosen over Option B (full rewire to MergedConfig): apply behavior-preserving `Record<string, unknown>` casts now, mark each production site with `// SPLIT-01:`, defer the proper rewire to Phases 54-56. Runtime behavior is identical."
patterns-established:
  - "Pattern: entry-level provenance-bearing reducer — `{ entry, source }` is the merged shape unit; the override unit is the entry, never the field."
  - "Pattern: schema carve-out + lenient typebox default + existence-gated migrate scrub — combine these three so the on-disk state evolves without a schemaVersion bump and without destroying user intent before the migrator captures it."
  - "Pattern: `// SPLIT-01:` cast-and-defer markers — when a structural schema change cascades broadly, tag every surviving call site with a per-phase marker so the rewire audit is `grep`-able."
requirements_completed: [CFG-02, SPLIT-01]
metrics:
  duration_minutes: ~95
  completed_date: "2026-06-10"
  tests_added: 18  # 12 in config-merge.test.ts (Task 1) + 2 state-io + 3 migrate + 1 anti-deepmerge anchor
  files_created: 3
  files_modified: 14
---

# Phase 51 Plan 02: MergedConfig + STATE_SCHEMA Carve-out Summary

One-liner: Locked the entry-level base+local merge that downstream consumers
read (MergedConfig with provenance), carved `autoupdate` out of
MARKETPLACE_RECORD_SCHEMA, and gated the legacy-shape scrub on
`existsSync(configJsonPath)` so Phase 52's first-run migration can capture the
user's pre-12.0 autoupdate intent before it is destroyed — and propagated the
SPLIT-01 cast at every reader/writer outside `persistence/` so `npm run check`
stays GREEN while Phases 54-56 do the proper rewire.

## Performance

- **Duration:** ~95 min (Task 1: ~45 min, Task 2: ~50 min including the
  approved Rule 4 cast-migration deviation across 11 files)
- **Started:** 2026-06-10T16:00:00Z (Plan 02 wave 2; spawn of Task 1
  executor)
- **Completed:** 2026-06-10T17:35:00Z
- **Tasks:** 2 of 2 complete
- **Files modified:** 14
- **Files created:** 3
- **Commits:** 3 (2 task commits + 1 docs commit)
- **Tests added:** 18 (Task 1: 12 in config-merge.test.ts; Task 2: 2
  state-io + 3 migrate, plus the anti-deepmerge anchor test in Task 1)

## Accomplishments

- **CFG-02 closed:** `mergeScopeConfigs` is a pure entry-level reducer. The
  anti-deepmerge contract is locked by a behavior test: when local sets
  `source` and base set `{ source, autoupdate }`, the merged entry has
  `entry.autoupdate === undefined` (NOT inherited).
- **SPLIT-01 closed at the persistence layer:** the desired-state
  `autoupdate` field is structurally absent from `MARKETPLACE_RECORD_SCHEMA`
  (state.json layer). Its home going forward is `MARKETPLACE_CONFIG_ENTRY_SCHEMA`
  in Plan 01's CONFIG_SCHEMA. D-12 holds: schemaVersion stays
  `Type.Literal(1)`.
- **D-13 ORDERING RAIL in place:** the new file-private
  `ensureNoLegacyAutoupdate` helper scrubs the legacy field, BUT only when
  `existsSync(configJsonPath)` returns true. The GATE CLOSED test
  (configJsonPath does not exist) asserts the legacy `autoupdate: true`
  survives the in-memory migration. The GATE OPEN test (configJsonPath
  exists) asserts it is scrubbed and `mutated === true`. Idempotency holds
  on the second call.
- **Pitfall 51-4 closed:** `loadMergedScopeConfig` returns both the merged
  view AND the per-file `ConfigLoadResult`s, so Phase 56 write-back can
  target the correct physical file without replaying the merge.
- **`loadState` external signature unchanged:** orchestrator callers were
  not touched at their call sites; the `configJsonPath` computation lives
  inline inside `loadState` and matches `locationsFor`'s construction
  byte-for-byte (`<scopeRoot>/claude-plugins.json` =
  `path.join(path.dirname(extensionRoot), "claude-plugins.json")`).

## Task Commits

1. **Task 1: config-merge.ts + mergeScopeConfigs + loadMergedScopeConfig** —
   `81bf1a2` (feat — 12 tests covering the merge matrix, per-file return
   shape, anti-deepmerge anchor, absent/valid/invalid arms)
2. **Task 2: STATE_SCHEMA carve-out + D-13-gated scrub + SPLIT-01 cast
   migration** — `928fdd9` (feat — schema removal, helper + signature
   extension, fixture, 5 new persistence tests, 16-file SPLIT-01 cast
   migration documented as approved Rule 4 deviation)

**Plan metadata commit:** (this commit — `docs(51-02)`)

## Files Created/Modified

### Created

- `extensions/pi-claude-marketplace/persistence/config-merge.ts` — Pure
  entry-level reducer + scope-level loader. Exports
  `MergedConfigEntry<T>`, `MergedConfig`, `ScopeLoadOutcome`,
  `mergeScopeConfigs`, `loadMergedScopeConfig`. No `node:fs` import (reducer
  is pure); no `deepmerge` / `lodash` import (D-01 anti-pattern). Provenance
  `"base" | "local"` literals on both branches verifiable by `grep`.
- `tests/persistence/config-merge.test.ts` — 12 tests: empty matrix,
  base-only, local-only, both-present (anti-deepmerge anchor), disjoint,
  dangling plugin ref (D-16), and the `loadMergedScopeConfig` shape matrix
  (both-absent, base-only, both-valid, base-invalid-local-absent).
- `tests/persistence/fixtures/legacy/state-with-autoupdate.json` — v1.x
  shape with `autoupdate: true` on the `mp-with-autoupdate` marketplace.
  Schema-valid against the v1.x MARKETPLACE_RECORD_SCHEMA modulo the carved
  field.

### Modified (persistence-internal)

- `extensions/pi-claude-marketplace/persistence/state-io.ts` —
  `autoupdate` removed from `MARKETPLACE_RECORD_SCHEMA`; `source` KEEPS
  (D-14). `loadState` computes `configJsonPath =
  path.join(path.dirname(extensionRoot), "claude-plugins.json")` inline and
  threads it as the 3rd argument to `migrateLegacyMarketplaceRecords`.
- `extensions/pi-claude-marketplace/persistence/migrate.ts` — new
  `existsSync` import (sync by design, documented in the comment); new
  file-private `ensureNoLegacyAutoupdate(mp): boolean` helper; signature of
  `migrateLegacyMarketplaceRecords` extended to `(parsed, extensionRoot,
  configJsonPath)`; per-marketplace loop adds `if (scrubAutoupdate) { mutated
  = ensureNoLegacyAutoupdate(mp) || mutated; }` after the existing two
  ensures. No new `console.warn` introduced (IL-3 callsite count stays
  at 1).
- `tests/persistence/state-io.test.ts` — 2 new SPLIT-01 tests: (1) legacy
  state.json with `autoupdate: true` still loads via typebox lenient default;
  (2) `saveState` rejects `schemaVersion: 2` (D-12 anchor).
- `tests/persistence/migrate.test.ts` — 3 new D-13 GATE tests
  (CLOSED / OPEN / idempotency); existing 6 tests updated to pass a
  non-existent path as the 3rd `NO_CONFIG` argument (preserves prior
  behavior).

### Modified (SPLIT-01 cast migration — approved Rule 4 deviation)

Production sites (all tagged with `// SPLIT-01:`):

- `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` —
  2 reads inside the info-message projection.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts` —
  1 read inside the list-row projection (`recordAutoupdate` local).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` —
  4 sites covering the autoupdate flip logic (read-check + write per
  branch, both the named-marketplace and the all-marketplaces loops).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` —
  1 read inside the post-refresh return object.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` —
  1 read inside the plugin-info marketplaceDetails composition.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` —
  1 read inside the plugin-list `detailsField` gate.

Test sites:

- `tests/edge/handlers/plugin/bootstrap.test.ts` — 1 read cast.
- `tests/orchestrators/marketplace/autoupdate.test.ts` — added
  `recordAutoupdate(rec)` reader helper + the `makeMarketplaceRecord`
  factory writes `autoupdate` via cast; 6 read sites switched to the helper.
- `tests/orchestrators/marketplace/info.test.ts` — added `withAutoupdate`
  helper; 4 fixture writes use it.
- `tests/orchestrators/marketplace/list.test.ts` — added `withAutoupdate`
  helper; 2 fixture writes use it.
- `tests/orchestrators/plugin/bootstrap.test.ts` — factory return cast +
  2 reads cast.

## Decisions Made

All decisions inherited from `51-DISCUSSION-LOG.md` (D-01, D-09, D-10, D-12,
D-13, D-14, D-16, D-18). One new in-plan decision recorded:

- **Option A (cast-migrate) vs Option B (full rewire)** for the cascade
  surfaced by the STATE_SCHEMA carve-out: the user approved Option A on
  2026-06-10. Rationale: a full rewire of `mp.autoupdate` reads to the
  yet-to-be-loaded MergedConfig would conflate Phase 51's data-seam work
  with Phase 54-56's enable/disable/reconcile orchestration. Casting now
  with grep-able `// SPLIT-01:` markers keeps Phase 51 atomic and leaves a
  precise audit trail for the rewire phase.

## Deviations from Plan

### Auto-fixed Issues

**None at Rule 1-3 level.** All persistence-internal changes followed the
plan exactly. The migrate-call-site `NO_CONFIG` sentinel for the 5
pre-existing migrate tests is the plan's explicit instruction
(GATE-CLOSED preservation).

### Rule 4 deviation — user-approved 2026-06-10

**1. [Rule 4 — Architectural cascade] SPLIT-01 cast migration across
11 files outside `persistence/`**

- **Found during:** Task 2 (immediately after the `MARKETPLACE_RECORD_SCHEMA`
  carve-out compiled — `npm run check` surfaced 27 TS errors at the cast
  sites listed above).
- **Issue:** RESEARCH Pitfall 51-2 explicitly drew the persistence boundary:
  "readers of `mp.autoupdate` outside `persistence/` migrate in Phases
  54-56." The plan's acceptance criterion #11 directed that any TS errors
  outside `persistence/` be lifted to a follow-up plan, NOT fixed inline.
  However, leaving them as compile errors would have failed acceptance
  criterion #12 (`npm run check` GREEN). The plan's two acceptance
  criteria were in tension once the carve-out actually broke broadcasts.
- **Resolution:** A planning-level decision was needed. The Plan 02 spawn
  emitted a `checkpoint:decision` rather than silently picking one branch.
  The user picked **Option A — cast-migrate the readers** on 2026-06-10
  with the instruction "tag each touched production site with a
  `// SPLIT-01:` comment so Phases 54-56 can audit and properly rewire
  them to read from the merged config; runtime behavior MUST be identical
  (D-04: undefined === false)."
- **Files modified:** 11 (6 production, 5 test) — see "Modified (SPLIT-01
  cast migration)" above.
- **Verification:** `npm run check` GREEN end-to-end (1544 unit tests + 7
  integration tests pass). Source assertions:
  `grep -nE "// SPLIT-01:" extensions/pi-claude-marketplace/orchestrators/**/*.ts`
  returns 7 marker comments across the 6 production files (shared.ts has
  the shared umbrella + the per-loop annotation). All cast reads use the
  `(record as unknown as Record<string, unknown>).autoupdate === true`
  form so D-04 `undefined === false` is preserved.
- **Committed in:** `928fdd9` (Task 2 commit — schema carve-out and cast
  migration are one atomic delta because typecheck must pass together).

---

**Total deviations:** 1 user-approved Rule 4 deviation.
**Impact on plan:** Plan scope expanded by ~11 files but all touched in a
behavior-preserving way; no runtime semantics changed; the SPLIT-01 cast
markers leave a clean rewire path for Phases 54-56. No further deviations.

## Issues Encountered

**None.** The Task 1 implementation matched RESEARCH Pattern 3 cleanly.
Task 2's TS cascade (27 errors) was the expected Pitfall 51-2 surface;
the cascade was anticipated by the plan and routed through the proper
decision checkpoint.

## User Setup Required

None — Phase 51 is a pure data-seam phase. No external services, no env
vars, no dashboard configuration. Phase 52 will introduce the first-run
migration that writes `claude-plugins.json` on user installs.

## Known Stubs

**None.** This plan's deliverables are pure data layer: types, a reducer,
a loader, a schema field removal, and a migrate gate. The downstream
consumers (Phase 54-56) wire MergedConfig into the autoupdate
read/write path. The cast-migration sites in this plan are explicitly
NOT stubs — they preserve V1 runtime behavior and are tagged
`// SPLIT-01:` for audit.

## Threat Flags

The plan's STRIDE register at `<threat_model>` covers the merge
seam (T-51-02-01 / T-51-02-02), the D-13 ordering rail
(T-51-02-03), the accepted Pitfall 51-2 risk that downstream readers carry
the cast (T-51-02-04), and the TOCTOU class on the gate predicate
(T-51-02-05 — accepted; converges on next load).

**Code-review follow-up (WR-02, accepted interim hazard):** the D-13 scrub
gates on bare `claude-plugins.json` existence, not on a positive Phase-52
capture marker. Because `claude-plugins.json` is a USER-AUTHORED file
(CFG-01), a user who hand-creates it before Phases 54-56 rewire the
autoupdate read/write paths puts the install in a state where every
`loadState` scrubs `autoupdate` from in-memory records AND persists the
scrubbed state, while all SPLIT-01 cast sites still read/write
`autoupdate` on the state record — so `marketplace autoupdate on` becomes
silently non-durable (each flip survives only until the next load). This
is the locked D-13 Mechanism A and is acceptable ONLY because the window
closes when the milestone ships as a whole.

**Phase 54-56 verification item (MUST):** before the config write-path
lands, assert that no production site reads or writes `record.autoupdate`
on state — i.e. `grep -nE "// SPLIT-01:" extensions/` returns zero
production markers and the autoupdate read/write path is fully rewired to
MergedConfig (CFG-02). This hazard must not survive past Phases 54-56.

## Verification Run

Final pre-commit verification:

```
> npm run check
> npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:integration

typecheck: clean
lint (eslint .): clean
format:check (prettier): clean
test (node:test): 1544 pass / 0 fail
test:integration: 7 pass / 0 fail
```

## Self-Check: PASSED

Files referenced in this SUMMARY exist on disk:

- `extensions/pi-claude-marketplace/persistence/config-merge.ts` — FOUND
- `extensions/pi-claude-marketplace/persistence/state-io.ts` — FOUND
- `extensions/pi-claude-marketplace/persistence/migrate.ts` — FOUND
- `tests/persistence/config-merge.test.ts` — FOUND
- `tests/persistence/migrate.test.ts` — FOUND
- `tests/persistence/state-io.test.ts` — FOUND
- `tests/persistence/fixtures/legacy/state-with-autoupdate.json` — FOUND

Commits referenced in this SUMMARY exist in git history:

- `81bf1a2` (Task 1) — FOUND
- `928fdd9` (Task 2) — FOUND
