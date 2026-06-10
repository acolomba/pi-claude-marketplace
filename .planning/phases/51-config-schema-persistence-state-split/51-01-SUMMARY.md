---
phase: 51-config-schema-persistence-state-split
plan: 01
subsystem: persistence
tags: [persistence, typebox, schema, config-files, v1.12, CFG-01, CFG-03]
requirements: [CFG-01, CFG-03]
dependency_graph:
  requires:
    - extensions/pi-claude-marketplace/shared/atomic-json.ts (atomicWriteJson, NFR-1)
    - extensions/pi-claude-marketplace/shared/path-safety.ts (assertPathInside, NFR-10)
    - extensions/pi-claude-marketplace/shared/errors.ts (errorMessage)
    - extensions/pi-claude-marketplace/persistence/state-io.ts (analog template)
  provides:
    - CONFIG_SCHEMA / CONFIG_VALIDATOR (typebox)
    - MARKETPLACE_CONFIG_ENTRY_SCHEMA / PLUGIN_CONFIG_ENTRY_SCHEMA
    - ScopeConfig / MarketplaceConfigEntry / PluginConfigEntry types
    - ConfigLoadResult discriminated union (absent | invalid | valid)
    - loadConfig(filePath) — never throws
    - saveConfig(filePath, config, scopeRoot) — assertPathInside before write
    - ScopedLocations.configJsonPath / configLocalJsonPath
  affects:
    - Phase 52 (first-run migration) — reads loadConfig trichotomy
    - Phase 53 (reconcile planner / dry-run) — consumes ScopeConfig + ConfigLoadResult
    - Phase 54 (enable/disable) — reads PluginConfigEntry.enabled
    - Phase 55 (load-time reconcile apply) — consumes the planner's output, which consumes this seam
    - Phase 56 (write-back) — calls saveConfig under withLockedStateTransaction
tech-stack:
  added: []
  patterns:
    - "Mirror of persistence/state-io.ts (load + atomic save + typebox schema + JIT-compiled validator)"
    - "Discriminated trichotomy ConfigLoadResult inverts state-io's throw-on-bad-input shape (D-15 / CFG-03)"
    - "saveConfig write-site enforces NFR-10 via assertPathInside BEFORE atomicWriteJson (Pitfall 51-5 / SPLIT-02)"
key-files:
  created:
    - extensions/pi-claude-marketplace/persistence/config-io.ts
    - tests/persistence/config-io.test.ts
  modified:
    - extensions/pi-claude-marketplace/persistence/locations.ts (added configJsonPath, configLocalJsonPath)
    - tests/persistence/locations.test.ts (extended assertions for new fields)
decisions:
  - "D-01 (flat two-record layout): top-level marketplaces + plugins records, both optional"
  - "D-02 (source as raw Type.String()): semantic classification deferred to consume time (Phases 53/55)"
  - "D-04 (optional fields, defaults at consume time): autoupdate / enabled stay undefined after load"
  - "D-05 (top-level records optional): absent != empty"
  - "D-06 (no version on plugin entries): versions are a machine fact owned by state.json"
  - "D-09 (lenient unknown keys): typebox default kept; unknown top-level and entry-level keys pass"
  - "D-11 (schemaVersion Optional Literal(1)): future versions land in a successor file"
  - "D-15 (discriminated ConfigLoadResult): absent | invalid | valid"
  - "Pitfall 51-1: 0-byte file lands in JSON.parse failure -> invalid, never valid-empty"
  - "Pitfall 51-5 / SPLIT-02: saveConfig runs assertPathInside BEFORE atomicWriteJson; PathContainmentError propagates loudly"
metrics:
  duration_minutes: ~20
  completed_date: "2026-06-10"
  tests_added: 19  # 15 in config-io.test.ts + 4 in locations.test.ts
  files_created: 2
  files_modified: 2
---

# Phase 51 Plan 01: Config Schema, Persistence & State Split (Foundation) Summary

One-liner: Locked the typebox `CONFIG_SCHEMA` + discriminated
`ConfigLoadResult` trichotomy + atomic `saveConfig` with write-site NFR-10
containment that the rest of v1.12 reads (Phases 52-56) — `claude-plugins.json`
and `claude-plugins.local.json` paths now sit on `ScopedLocations` under
`scopeRoot` at the same tier as `agentsDir` and `mcpJsonPath`.

## What Shipped

### `extensions/pi-claude-marketplace/persistence/config-io.ts` (NEW, 186 lines)

Mirror of `state-io.ts` with one critical inversion: `loadConfig` returns a
discriminated `ConfigLoadResult` instead of throwing. New exports:

- `MARKETPLACE_CONFIG_ENTRY_SCHEMA` — `Type.Object({ source: Type.String(),
  autoupdate: Type.Optional(Type.Boolean()) })`. D-02 keeps `source` as a raw
  string; classification lives downstream.
- `PLUGIN_CONFIG_ENTRY_SCHEMA` — `Type.Object({ enabled:
  Type.Optional(Type.Boolean()) })`. D-04 keeps defaults out of the schema;
  D-06 omits any `version` field.
- `CONFIG_SCHEMA` — `Type.Object({ schemaVersion: Type.Optional(Type.Literal(1)),
  marketplaces: Type.Optional(Type.Record(...)), plugins:
  Type.Optional(Type.Record(...)) })`. D-05 makes both top-level records
  optional. D-09 (lenient): no extra-property gate anywhere — typebox's
  default permissiveness preserves forward-compat for user-authored typos and
  unknown future keys. D-11 locks `schemaVersion` to literal 1.
- `CONFIG_VALIDATOR = Compile(CONFIG_SCHEMA)` — D-07 mirror.
- Types: `ScopeConfig`, `MarketplaceConfigEntry`, `PluginConfigEntry`.
- `ConfigLoadResult` (D-15 / CFG-03):
  - `{ status: "absent" }` — ENOENT only.
  - `{ status: "invalid"; filePath; error }` — read failure (non-ENOENT),
    JSON parse failure (the Pitfall 51-1 0-byte case lands here), or schema
    validation failure. The `error` string is prefixed by the failure mode
    (`read failed:`, `JSON parse failed:`, `schema validation failed:`).
  - `{ status: "valid"; filePath; config }` — file read, parsed, and
    schema-validated.
- `loadConfig(filePath)` — NEVER throws. No try/catch + default-empty path
  anywhere. The Pitfall 51-1 anchor: a 0-byte file's `JSON.parse("")` throws
  `SyntaxError: Unexpected end of JSON input`, which routes into the
  `invalid` arm.
- `saveConfig(filePath, config, scopeRoot)` — three load-bearing steps in
  order:
  1. `CONFIG_VALIDATOR.Check(config)` — caller-bug guard. Mirrors
     `saveState refused: ...` message format.
  2. `assertPathInside(scopeRoot, filePath, "saveConfig")` — Pitfall 51-5 /
     SPLIT-02 write-site enforcement. `PathContainmentError` propagates
     loudly per the shared seam's PI-14 contract; we do NOT catch it.
  3. `atomicWriteJson(filePath, config)` — the single sanctioned JSON-write
     seam per NFR-1.

### `extensions/pi-claude-marketplace/persistence/locations.ts` (MODIFIED)

Added two new fields to the `ScopedLocations` interface and to the frozen
construction:

- `configJsonPath: string` — `<scopeRoot>/claude-plugins.json` (CFG-01).
- `configLocalJsonPath: string` — `<scopeRoot>/claude-plugins.local.json`
  (CFG-02).

Both sit at the same tier as `agentsDir` and `mcpJsonPath` — under
`scopeRoot`, NOT under `extensionRoot`. They are user-owned files. NFR-10
enforcement happens at the WRITE site in `saveConfig` (per the existing
locations.ts comment block sanctioning hard-coded-suffix joins on
`scopeRoot`).

### `tests/persistence/config-io.test.ts` (NEW, 15 tests)

Coverage matches the plan's `<behavior>` blocks A/B/C/D:

- **A. trichotomy (5):** missing file → `absent`; 0-byte → `invalid`
  (Pitfall 51-1 anchor); malformed JSON → `invalid`; JSON-valid /
  schema-invalid → `invalid`; `schemaVersion: 2` → `invalid`.
- **B. valid (5):** minimal `{}` → `valid` with both records `undefined`;
  CONTEXT specifics example (`acme-tools` + `code-reviewer@acme-tools`) →
  `valid` with `autoupdate` / `enabled` still `undefined` (D-04: defaults
  applied at consume time); unknown top-level keys pass (D-09); unknown
  entry-level fields pass (D-09); explicit `schemaVersion: 1` passes.
- **C. round-trip (2):** `saveConfig` + `loadConfig` is byte-stable modulo
  the trailing `\n` that `atomicWriteJson` appends; `saveConfig` refuses an
  in-memory value that fails `CONFIG_VALIDATOR.Check` with a `saveConfig
  refused: ...` message.
- **D. containment (2):** `saveConfig` rejects an escaping `filePath` with a
  `PathContainmentError`-shaped message (matches `/escapes/`); `saveConfig`
  succeeds when `filePath` is inside `scopeRoot`.
- **CONFIG_VALIDATOR:** is a working JIT-compiled validator.

### `tests/persistence/locations.test.ts` (MODIFIED, +4 assertions)

Extended the existing user-default, user-`PI_CODING_AGENT_DIR`, and
project-with-cwd cases with `configJsonPath` / `configLocalJsonPath`
assertions, plus a new frozen-bundle immutability check for both fields.

## Verification

- `npm run check` GREEN end-to-end (typecheck + lint + format-check + unit
  tests + integration tests): 1527 unit tests pass + 7 integration tests
  pass.
- `node --test tests/persistence/config-io.test.ts` → 15 / 15 GREEN.
- `node --test tests/persistence/locations.test.ts` → 37 / 37 GREEN.

### Acceptance criteria

Task 1:

- [x] `tests/persistence/locations.test.ts` passes for all new assertions
  across user-default, user-`PI_CODING_AGENT_DIR`, and project-with-cwd
  cases.
- [x] `grep -c "configJsonPath\|configLocalJsonPath"
  extensions/pi-claude-marketplace/persistence/locations.ts` returns 6
  (interface declarations × 2 + construction × 2 + freeze literal × 2).
- [x] Both new fields appear inside the `Object.freeze({ ... })` literal at
  the end of `locationsFor`.
- [x] Constructed via `path.join(scopeRoot, ...)`, NOT
  `path.join(extensionRoot, ...)`.
- [x] No call to `assertPathInside` is added to `locations.ts` (containment
  is structural here; enforced in `saveConfig`).
- [x] `npm run check` continues to pass.

Task 2:

- [x] 15 `test(...)` declarations in `config-io.test.ts` (>= 9 required) all
  GREEN, covering A/B/C/D from `<behavior>`.
- [x] `grep -c "CONFIG_SCHEMA\|CONFIG_VALIDATOR\|ScopeConfig\|ConfigLoadResult\|loadConfig\|saveConfig"
  extensions/pi-claude-marketplace/persistence/config-io.ts` returns 21 (>= 10
  required).
- [x] `grep -n "additionalProperties"
  extensions/pi-claude-marketplace/persistence/config-io.ts` returns no
  match (D-09 lenient default).
- [x] `grep -n "assertPathInside\b"
  extensions/pi-claude-marketplace/persistence/config-io.ts` returns
  multiple matches including the call site at line 183.
- [x] `grep -n "atomicWriteJson\b"
  extensions/pi-claude-marketplace/persistence/config-io.ts` returns
  multiple matches including the call site at line 184.
- [x] `grep -nE 'from "\.\./domain/source\.ts"'
  extensions/pi-claude-marketplace/persistence/config-io.ts` returns no
  match (D-02 keeps `source` as `Type.String()`).
- [x] 0-byte test case asserts `status === "invalid"` (Pitfall 51-1
  anchor).
- [x] At least one test asserts unknown keys pass validation (D-09).
- [x] At least one test asserts `saveConfig` rejects an escaping `filePath`
  (NFR-10 / SPLIT-02 write-site).
- [x] `npm run check` GREEN.

### Success criteria

- [x] `loadConfig` returns a discriminated `ConfigLoadResult` and never
  throws on missing / parse / validation failure.
- [x] `saveConfig` writes via `atomicWriteJson` AFTER `assertPathInside(scopeRoot,
  filePath, ...)`.
- [x] `ScopedLocations` exposes `configJsonPath` and `configLocalJsonPath`
  under `scopeRoot`.
- [x] A hand-authored `{ "marketplaces": { "acme-tools": { "source":
  "acme/claude-tools" } }, "plugins": { "code-reviewer@acme-tools": {} } }`
  round-trips through `saveConfig` + `loadConfig` byte-stably modulo
  trailing newline.
- [x] Unknown top-level / entry-level keys pass validation (D-09).
- [x] 0-byte and malformed files land in the `invalid` arm, NEVER `valid`
  with empty config (Pitfall 51-1 closed at the seam).
- [x] CFG-01 + CFG-03 closed at the persistence layer. SPLIT-02 write-site
  half (assertPathInside in `saveConfig`) is in place; the
  architecture-test enforcement half lands in Plan 03.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were
needed; no Rule 4 architectural deviations were encountered; no
authentication gates triggered. The single non-mechanical adjustment was
rephrasing two comments in `config-io.ts` to avoid the literal string
`additionalProperties` (so the acceptance-criterion grep returns zero
matches as specified) — the rephrased comments preserve the original D-09
intent verbatim.

## Threat Model Closure

The plan's `<threat_model>` STRIDE register lists 5 threats (T-51-01-01..05)
plus T-51-01-SC. All `mitigate` dispositions are closed by this plan:

- **T-51-01-01** (0-byte / malformed `claude-plugins.json` → silent empty
  desired state): closed by the Pitfall 51-1 anchor test asserting
  `status === "invalid"` for the 0-byte case. No try/catch + default-empty
  anywhere in `config-io.ts`.
- **T-51-01-02** (JSON-valid but schema-invalid file): closed by
  `CONFIG_VALIDATOR.Check` + `firstConfigValidationErrorDetail` formatting
  the offending instance path.
- **T-51-01-03** (`saveConfig` containment bypass): closed by `await
  assertPathInside(scopeRoot, filePath, "saveConfig")` BEFORE
  `atomicWriteJson`. The escape-path test asserts the
  `PathContainmentError`-shaped message.
- **T-51-01-04** (symlink inside the path): inherited from the shared
  `assertPathInside` seam (D-14 in `path-safety.ts`); no new mitigation
  required.
- **T-51-01-05** (power loss mid-write): closed by routing through
  `atomicWriteJson` → `write-file-atomic`. No new code path.
- **T-51-01-SC** (package legitimacy): no new packages introduced (verified
  in research; `typebox` + `write-file-atomic` already shipped).

## Commits

- `2c61cc1` — feat(51-01): add config paths to ScopedLocations (CFG-01)
- `b2d89b8` — feat(51-01): add CONFIG_SCHEMA + loadConfig + saveConfig
  (CFG-01, CFG-03)

## Files Changed

Created:

- `extensions/pi-claude-marketplace/persistence/config-io.ts` (186 lines)
- `tests/persistence/config-io.test.ts` (262 lines)

Modified:

- `extensions/pi-claude-marketplace/persistence/locations.ts` (+12 lines:
  2 interface fields + 8 lines of comment/construction + 2 freeze entries)
- `tests/persistence/locations.test.ts` (+27 lines: 4 new assertion blocks)

## Known Stubs

None. Every assertion in this plan is wired end-to-end at the
persistence-layer seam. Downstream phases (52-56) consume these shapes as
documented; no placeholder data or hardcoded empty returns were
introduced.

## Self-Check: PASSED

- [x] `extensions/pi-claude-marketplace/persistence/config-io.ts` exists.
- [x] `extensions/pi-claude-marketplace/persistence/locations.ts` exists.
- [x] `tests/persistence/config-io.test.ts` exists.
- [x] `tests/persistence/locations.test.ts` exists.
- [x] Commit `2c61cc1` exists in git log.
- [x] Commit `b2d89b8` exists in git log.
