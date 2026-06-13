---
phase: 52-first-run-migration
verified: 2026-06-10T00:00:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
deferred:
  - truth: "Migration runs before any reconcile pass in execution order (MIG-01 ordering rail -- SC2)"
    addressed_in: "Phase 55"
    evidence: "Phase 55 success criteria 1 owns the load-wiring order; test file HAZARD comment at lines 29-39 documents the Phase 55 obligation explicitly"
  - truth: "Running a reconcile immediately after a fresh migration is a strict no-op -- planner-level proof (SC4)"
    addressed_in: "Phase 53"
    evidence: "Phase 53 success criteria 1 owns planReconcile; Section D of the test file is the data-level surrogate; comment block at lines 471-477 documents the Phase 53 obligation"
---

# Phase 52: First-Run Migration Verification Report

**Phase Goal:** A Pi user upgrading into v1.12 with an existing install gets a `claude-plugins.json`
generated losslessly from their current `state.json` on first load, with nothing uninstalled -- the
safety rail that guarantees an existing install is never reconciled against absence.

**Verified:** 2026-06-10
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On a scope with no claude-plugins.json, migrateFirstRunConfig with a populated ExtensionState writes a claude-plugins.json containing every marketplace and plugin (MIG-01) | VERIFIED | `migrateFirstRunConfig` calls `loadConfig`, branches on `absent` arm, calls `buildConfigFromState` + `saveConfig`; tests B1/B2 confirm entry count 5 and valid round-trip |
| 2 | Soft-degraded plugins (compatibility.installable===false) appear in the generated config exactly like installable plugins (Pitfall 52-1) | VERIFIED | `buildConfigFromState` iterates `Object.keys(mp.plugins)` unconditionally with no `installable` filter; grep confirms the word "installable" does not appear in migrate-config.ts; test A2 asserts `"soft-degraded@mp-path"` in cfg.plugins |
| 3 | The marketplace source field equals `(mp.source as ParsedSource).raw` -- the verbatim user input (Pitfall 52-3, SP-7) | VERIFIED | Code reads `storedSource?.raw` as string; CR-01 guard falls back to JSON.stringify only for raw-less forward-compat sources; tests A3 and B3 assert byte-stable round-trip for `./mp-path-local` and `acme/tools` |
| 4 | Legacy autoupdate=true/false is captured; undefined is omitted (D-13/D-04) | VERIFIED | Strict `=== true` / `=== false` arms in buildConfigFromState; forward-tampered non-boolean silently dropped; tests A4/A5/A6/A7 cover all four cases including explicit false and tampered string |
| 5 | Plugins with the same name across marketplaces are flat-keyed as `<plugin>@<marketplace>` without collision (Pitfall 52-6) | VERIFIED | Template literal `${pluginName}@${mpName}` in inner loop; test A8 asserts both `code-reviewer@mp-path` and `code-reviewer@mp-github` exist |
| 6 | A second call to migrateFirstRunConfig returns `{ migrated: false }` and does not rewrite the file (MIG-02 idempotency) | VERIFIED | `result.status === "valid"` short-circuits before any write; test C1 asserts migrated=false, reason="existing-valid", and mtime unchanged after 25ms wait |
| 7 | migrateFirstRunConfig NEVER overwrites a pre-existing claude-plugins.json -- valid, invalid, or 0-byte (Pitfall 52-5) | VERIFIED | Both `valid` and `invalid` status arms return early before buildConfigFromState is called; tests C2/C3/C4 assert 0-byte/valid/schema-invalid files are each byte-identical after the call |
| 8 | After migration, loadConfig on the same path returns status='valid' (atomicity/schema-revalidation proxy via saveConfig) | VERIFIED | saveConfig inherits CONFIG_VALIDATOR.Check and write-file-atomic; test B2 calls loadConfig post-migration and asserts status==="valid" with deep-equal round-trip |
| 9 | mergeScopeConfigs(buildConfigFromState(state), {}) has the same marketplace and plugin key sets as state (data-level convergence) | VERIFIED | Tests D1/D2 assert sorted key arrays are deepEqual; test D3 asserts every merged entry has source="base" |

**Score:** 9/9 truths verified

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Migration-before-reconcile ordering rail (SC2) | Phase 55 | Phase 55 SC1: "declared-but-missing ... are added/installed automatically"; test file HAZARD comment lines 29-39 names the Phase 55 call-site obligation |
| 2 | planReconcile(mergeScopeConfigs(...), state) strict no-op (SC4 planner level) | Phase 53 | Phase 53 SC1 owns planReconcile; test file Section D leader comment lines 471-477 and header docstring lines 41-47 document the deferral |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/persistence/migrate-config.ts` | buildConfigFromState + migrateFirstRunConfig + MigrateFirstRunResult; 60+ lines | VERIFIED | 166 lines; exports 3 symbols; routes write through saveConfig only; no atomicWriteJson import |
| `tests/persistence/migrate-config.test.ts` | 16+ tests covering MIG-01/MIG-02 in full | VERIFIED | 24 tests; 24/24 GREEN; Sections A-D with all required anchors |
| `tests/persistence/fixtures/legacy/state-populated-mixed.json` | 2 marketplaces, autoupdate mixed, soft-degraded plugin, cross-mp collision, mixed sources | VERIFIED | 75 lines; fixture validation node script exits 0 for all 6 structural assertions |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `migrate-config.ts` | `config-io.ts` | `import { loadConfig, saveConfig, type ScopeConfig }` | WIRED | Line 23: `from "./config-io.ts"` with all three symbols |
| `migrate-config.ts` | `domain/source.ts` | `import type { ParsedSource }` | WIRED | Line 27: `import type { ParsedSource } from "../domain/source.ts"` |
| `migrate-config.test.ts` | `migrate-config.ts` | named imports buildConfigFromState + migrateFirstRunConfig + type MigrateFirstRunResult | WIRED | Lines 16-19: all three symbols imported and used in tests |
| `migrate-config.test.ts` | `config-merge.ts` | `import { mergeScopeConfigs }` | WIRED | Line 13: imported; 6 grep hits (import + 3 Section D call sites) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `buildConfigFromState` | `state.marketplaces` | passed by caller (in-memory ExtensionState) | Yes -- deterministic projection with no I/O | FLOWING |
| `migrateFirstRunConfig` | `config` from buildConfigFromState | saveConfig writes via write-file-atomic | Yes -- writes real projection to disk | FLOWING |
| Test Section B | reloaded.config from loadConfig | reads file written by migrateFirstRunConfig | Yes -- round-trip through real fs using tmpdir | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 24 migrate-config tests pass | `node --test tests/persistence/migrate-config.test.ts` | 24 pass, 0 fail | PASS |
| SPLIT-02 architecture test unmodified and passing | `node --test tests/architecture/config-state-write-seams.test.ts` | 5 pass, 0 fail | PASS |
| Fixture structural validity | node assertion script checking 6 properties | exits 0 | PASS |

### Probe Execution

Step 7c: No probe scripts found or declared for this phase. Phase produces pure persistence modules tested via node:test suite above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MIG-01 | 52-01-PLAN.md | First load without config generates claude-plugins.json losslessly from state.json; nothing uninstalled | SATISFIED | buildConfigFromState pure projection; unconditional plugin iteration; tests A1-A10 + B1-B3; data confirmed by fixture validation |
| MIG-02 | 52-01-PLAN.md | Migration is atomic and idempotent; reconcile after migration is strict no-op | SATISFIED | Atomic via saveConfig→write-file-atomic; idempotent via loadConfig trichotomy; tests C1-C4 no-overwrite; Section D data-level convergence; planner-level no-op deferred to Phase 53 per documented plan boundary |

REQUIREMENTS.md traceability row for both MIG-01 and MIG-02 shows `Phase 52 | Done (Plan 52-01, 2026-06-10)` -- consistent with verification findings.

No orphaned requirements: REQUIREMENTS.md maps exactly MIG-01 and MIG-02 to Phase 52. No other v1.12 requirements claim Phase 52.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | - |

Scanned `migrate-config.ts`, `migrate-config.test.ts`, and `state-populated-mixed.json` for TBD/FIXME/XXX debt markers: none found. No `return null`, `return {}`, or `return []` stub patterns in production code paths. No notify() or console calls in production module (comment-only references at lines 138-139). `atomicWriteJson` appears once in a comment (line 8) -- not an import or call.

### Human Verification Required

None. All must-haves are verifiable from the codebase. UI/UX and notification surface behavior are Phase 55 obligations, not Phase 52 deliverables.

### Gaps Summary

No gaps. All 9 must-have truths are VERIFIED. The two deferred items (SC2 ordering rail, SC4 planner-level no-op) are explicitly documented cross-phase obligations with clear ownership (Phase 55 and Phase 53 respectively) and are not actionable gaps for Phase 52.

The post-commit code review findings (CR-01 raw-less source guard, WR-01 discriminated union, WR-02 fresh-install tests) are all present in the codebase, confirmed by:
- CR-01: `Partial<ParsedSource>` guard at migrate-config.ts line 97 with JSON.stringify fallback
- WR-01: discriminated union `MigrateFirstRunResult` with `migrated: true | false` discriminant and `reason` field on false arm
- WR-02: NFR-12 regression tests and fresh-install tests in migrate-config.test.ts

---

_Verified: 2026-06-10_
_Verifier: Claude (gsd-verifier)_
