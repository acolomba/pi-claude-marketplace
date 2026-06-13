---
phase: 51-config-schema-persistence-state-split
verified: 2026-06-10T00:00:00Z
status: passed
score: 13/13 must-haves verified
overrides_applied: 0
---

# Phase 51: Config Schema, Persistence & State Split Verification Report

**Phase Goal:** A Pi user can declare marketplaces and plugins in a per-scope
`claude-plugins.json` (with a `.local.json` override) validated by a Pi-native schema,
while machine bookkeeping cleanly separates into the internal state file -- the frozen
data foundation every later phase reads.

**Verified:** 2026-06-10
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | `claude-plugins.json` validates against `CONFIG_SCHEMA` via `loadConfig` and round-trips byte-stably through `saveConfig` (CFG-01, NFR-1) | VERIFIED | `config-io.ts` 186 lines: `CONFIG_SCHEMA`, `loadConfig`, `saveConfig` fully wired to `atomicWriteJson` + `assertPathInside`; 15 unit tests GREEN including round-trip |
| SC-2 | `claude-plugins.local.json` overrides base entry wholesale (entry-level, never field-merged) producing `MergedConfig` with provenance `"base" \| "local"` (CFG-02) | VERIFIED | `config-merge.ts` 153 lines: `mergeScopeConfigs` pure reducer; anti-deepmerge test asserts `entry.autoupdate === undefined` when local entry omits it; 12 unit tests GREEN |
| SC-3 | An unparseable/schema-invalid config is never coerced to "empty desired state"; 0-byte, truncated, and malformed files land in `invalid` arm (CFG-03) | VERIFIED | `loadConfig` returns discriminated `absent \| invalid \| valid`; Pitfall-51-1 anchor test (0-byte → `invalid`) present and GREEN; no try/catch+default anywhere in `config-io.ts` |
| SC-4 | `state.json` retains only machine bookkeeping; desired-state fields (autoupdate) removed from `MARKETPLACE_RECORD_SCHEMA`; old `state.json` with `autoupdate: true` still loads (SPLIT-01) | VERIFIED | `grep -nE "autoupdate:\s*Type\."` returns zero; `schemaVersion: Type.Literal(1)` unchanged; fixture `state-with-autoupdate.json` loads cleanly; 2 new SPLIT-01 tests GREEN |
| SC-5 | Write seams are split by ownership: machine records only to state file, user config only via `saveConfig`; enforced by architecture test (SPLIT-02) | VERIFIED | `config-state-write-seams.test.ts` 222 lines; 5 tests GREEN: two walker tests + two `exactly N` sibling assertions + walker regression (positive + negative synthetic offender strings) |

**Score:** 5/5 roadmap success criteria verified

### Required Artifacts

| Artifact | Min Lines | Actual | Status | Details |
|----------|-----------|--------|--------|---------|
| `extensions/pi-claude-marketplace/persistence/config-io.ts` | 90 | 185 | VERIFIED | Exports `CONFIG_SCHEMA`, `CONFIG_VALIDATOR`, `ScopeConfig`, `MarketplaceConfigEntry`, `PluginConfigEntry`, `ConfigLoadResult`, `loadConfig`, `saveConfig`; 21 grep hits for key symbols |
| `extensions/pi-claude-marketplace/persistence/locations.ts` | — | 11KB | VERIFIED | `configJsonPath` and `configLocalJsonPath` added at lines 58, 60 (interface) and 133-134 (construction) and 166-167 (freeze literal); 6 occurrences confirmed |
| `extensions/pi-claude-marketplace/persistence/config-merge.ts` | 70 | 153 | VERIFIED | Exports `MergedConfigEntry<T>`, `MergedConfig`, `ScopeLoadOutcome`, `mergeScopeConfigs`, `loadMergedScopeConfig`; no deepmerge/lodash; no `node:fs` import |
| `extensions/pi-claude-marketplace/persistence/state-io.ts` | — | 9.7KB | VERIFIED | `autoupdate` Type declaration removed from `MARKETPLACE_RECORD_SCHEMA`; `existsSync` imported and `scrubAutoupdate` computed before calling migrator; `Type.Literal(1)` retained |
| `extensions/pi-claude-marketplace/persistence/migrate.ts` | — | 7.5KB | VERIFIED | `ensureNoLegacyAutoupdate` helper present; takes `scrubAutoupdate: boolean` (3rd param); single `console.warn` IL-3 callsite confirmed |
| `tests/persistence/config-io.test.ts` | 150 | 305 | VERIFIED | 15 tests covering trichotomy A/B/C/D, round-trip, containment; 15/15 GREEN |
| `tests/persistence/config-merge.test.ts` | 120 | 277 | VERIFIED | 12 tests: merge matrix, anti-deepmerge anchor, `loadMergedScopeConfig` shape; 12/12 GREEN |
| `tests/persistence/locations.test.ts` | — | 17KB | VERIFIED | 37 tests including 4 new assertions for `configJsonPath`/`configLocalJsonPath`; 37/37 GREEN |
| `tests/persistence/state-io.test.ts` | — | 13KB | VERIFIED | 13 tests including SPLIT-01 legacy load + schemaVersion anchor; 13/13 GREEN |
| `tests/persistence/migrate.test.ts` | — | 12KB | VERIFIED | 16 tests including D-13 GATE CLOSED / GATE OPEN / idempotency; 16/16 GREEN |
| `tests/persistence/fixtures/legacy/state-with-autoupdate.json` | — | 717B | VERIFIED | Contains `"autoupdate": true` on `mp-with-autoupdate` marketplace record |
| `tests/architecture/config-state-write-seams.test.ts` | 120 | 222 | VERIFIED | `ALLOWED_CONFIG_JSON_WRITERS` (1 entry), `ALLOWED_STATE_JSON_WRITERS` (2 entries); 5/5 GREEN; literal `exactly N` deepEqual assertions present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `config-io.ts` | `shared/atomic-json.ts` | `saveConfig` calls `atomicWriteJson` at line 184 | WIRED | Confirmed in source |
| `config-io.ts` | `shared/path-safety.ts` | `saveConfig` calls `assertPathInside` at line 183 (before `atomicWriteJson`) | WIRED | Order is load-bearing; confirmed |
| `config-merge.ts` | `config-io.ts` | `import { loadConfig, ... } from "./config-io.ts"` at line 38 | WIRED | Confirmed |
| `state-io.ts` | `migrate.ts` | `loadState` computes `scrubAutoupdate = existsSync(configJsonPath)` and passes to `migrateLegacyMarketplaceRecords` | WIRED | D-13 gate operates via boolean param; `configJsonPath` derived in `state-io.ts` (line 199-204) |
| `migrate.ts` | `node:fs` (existsSync) | **Moved to `state-io.ts` (WR-03 code-review fix)** — gate predicate hoisted to keep `migrate.ts` a pure function | WIRED | `state-io.ts` imports `existsSync` from `node:fs` at line 25; behavior equivalent |
| `architecture test` | `extensions/pi-claude-marketplace` | Recursive walker on all `.ts` files; path-name-specific forbidden patterns | WIRED | 5 tests pass including walker regression with synthetic offender/benign strings |

### Data-Flow Trace (Level 4)

Phase 51 produces persistence-layer seams only (schemas, load/save functions, pure reducer). No components render dynamic data directly — all are utility modules consumed by downstream phases 52-56. Level 4 data-flow trace not applicable.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `loadConfig` trichotomy: 0-byte file → `invalid` (Pitfall-51-1) | `node --test tests/persistence/config-io.test.ts` | 15/15 pass | PASS |
| `mergeScopeConfigs` anti-deepmerge: local wins, base field not inherited | `node --test tests/persistence/config-merge.test.ts` | 12/12 pass | PASS |
| D-13 gate: CLOSED preserves autoupdate, OPEN scrubs it, idempotent | `node --test tests/persistence/migrate.test.ts` | 16/16 pass | PASS |
| SPLIT-02 architecture enforcement (walker + exactly-N) | `node --test tests/architecture/config-state-write-seams.test.ts` | 5/5 pass | PASS |
| `STATE_SCHEMA` autoupdate carve-out + legacy state loads | `node --test tests/persistence/state-io.test.ts` | 13/13 pass | PASS |
| `configJsonPath`/`configLocalJsonPath` on `ScopedLocations` | `node --test tests/persistence/locations.test.ts` | 37/37 pass | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CFG-01 | 51-01 | User can declare marketplaces and plugins in validated `claude-plugins.json` | SATISFIED | `config-io.ts` + `locations.ts`; round-trip tests GREEN |
| CFG-02 | 51-02 | `.local.json` entry-level override producing `MergedConfig` | SATISFIED | `config-merge.ts`; merge matrix + anti-deepmerge tests GREEN |
| CFG-03 | 51-01 | Unparseable config aborts, never treated as empty desired state | SATISFIED | `loadConfig` trichotomy; 0-byte anchor test GREEN |
| SPLIT-01 | 51-02 | Config owns desired state; `state.json` has only machine bookkeeping | SATISFIED | `autoupdate` removed from `MARKETPLACE_RECORD_SCHEMA`; D-13 gate operational |
| SPLIT-02 | 51-03 | Write seams enforced by architecture test | SATISFIED | `config-state-write-seams.test.ts` + exactly-N assertions GREEN |

**Orphaned requirements check:** No Phase 51 requirements in REQUIREMENTS.md are unaccounted for. CFG-04 is correctly mapped to Phase 56 (not this phase).

### Anti-Patterns Found

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| (none) | — | — | No TBD/FIXME/XXX/TODO/PLACEHOLDER markers found in any phase-modified file |
| `orchestrators/*` (6 production files) | `// SPLIT-01:` cast markers | INFO | Behavior-preserving casts deferring MergedConfig rewire to Phases 54-56; tagged for audit via `grep`; not stubs |

### Human Verification Required

None. All phase-51 deliverables are pure persistence-layer seams (schemas, functions, a pure reducer, an architecture test). No user-visible output, no UI behavior, no real-time interaction, no external service integration. All contracts are fully verifiable by unit and architecture tests.

### Gaps Summary

No gaps. All 5 roadmap success criteria are verified. All 12 declared artifacts exist, are substantive (above minimum line counts), and are wired. All behavioral spot-checks pass. No debt markers found in modified files.

**Noted deviation (accepted):** Plan 02 specified `migrateLegacyMarketplaceRecords(..., configJsonPath: string)` with `existsSync` inside `migrate.ts`. Code-review fix WR-03 (`2113864`) hoisted the `existsSync` gate to `state-io.ts` and changed the third parameter to `scrubAutoupdate: boolean`, restoring `migrate.ts`'s documented purity contract. Behavior is functionally identical; the D-13 ordering rail is preserved. No plan must-have is violated — the key link truth is met through the boolean parameter path.

---

_Verified: 2026-06-10_
_Verifier: Claude (gsd-verifier)_
