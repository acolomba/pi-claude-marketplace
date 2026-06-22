---
phase: quick
plan: 260621-kmm
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/persistence/migrate.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - tests/orchestrators/reconcile/plan.test.ts
autonomous: true
requirements: [ENBL-02]

must_haves:
  truths:
    - "plugin records loaded from pre-migration state.json gain enabled: true via migration"
    - "isRecordedButDisabled reads record.enabled === false instead of empty-resources arrays"
    - "install.ts statePhase writes enabled: true on new and re-materialized records"
    - "disable branch sets record.enabled = false; enable branch sets record.enabled = true"
    - "STATE_VALIDATOR accepts schemaVersion 2 records with enabled field"
    - "npm run check stays green"
  artifacts:
    - path: "extensions/pi-claude-marketplace/persistence/migrate.ts"
      provides: "ensurePluginEnabled migration helper for schemaVersion 1->2"
      contains: "ensurePluginEnabled"
    - path: "extensions/pi-claude-marketplace/persistence/state-io.ts"
      provides: "enabled: Type.Boolean() in PLUGIN_INSTALL_RECORD_SCHEMA, schemaVersion 2"
      contains: "enabled"
    - path: "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts"
      provides: "isRecordedButDisabled reads record.enabled"
      contains: "record.enabled"
  key_links:
    - from: "migrate.ts::ensurePluginEnabled"
      to: "state-io.ts::PLUGIN_INSTALL_RECORD_SCHEMA"
      via: "fills enabled: true before STATE_VALIDATOR.Check"
    - from: "plan.ts::isRecordedButDisabled"
      to: "state-io.ts::ExtensionState"
      via: "reads record.enabled === false"
    - from: "install.ts statePhase"
      to: "state-io.ts::PLUGIN_INSTALL_RECORD_SCHEMA"
      via: "writes enabled: true at record creation"
---

<objective>
Replace the inferred empty-resources disabled marker with an explicit
`enabled: boolean` field on the plugin state record.

Purpose: `enabled: boolean` makes intent explicit and removes the fragile
five-array-emptiness heuristic that treats any installable plugin with
zero resources as "disabled". The new field is the single source of truth.

Output:
- `PLUGIN_INSTALL_RECORD_SCHEMA` gains `enabled: Type.Boolean()`
- STATE_SCHEMA bumps to `schemaVersion: 2` (Literal union 1|2 at load, writes 2)
- Migration in `migrate.ts` fills `enabled: true` on all existing records
- `isRecordedButDisabled` reads `!record.enabled` (plan.ts)
- `isCurrentlyDisabled` in enable-disable.ts reads `!installed.enabled`
- disable branch sets `installed.enabled = false`; enable branch sets `installed.enabled = true`
- install.ts statePhase writes `enabled: true`
- T5 drift gate updated to assert `enabled` axis instead of five array axes
</objective>

<execution_context>
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/acolomba/src/pi-claude-marketplace/.planning/STATE.md
@/Users/acolomba/src/pi-claude-marketplace/CLAUDE.md
@/Users/acolomba/src/pi-claude-marketplace/extensions/pi-claude-marketplace/persistence/state-io.ts
@/Users/acolomba/src/pi-claude-marketplace/extensions/pi-claude-marketplace/persistence/migrate.ts
@/Users/acolomba/src/pi-claude-marketplace/extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
@/Users/acolomba/src/pi-claude-marketplace/extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
@/Users/acolomba/src/pi-claude-marketplace/extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Schema, migration, and statePhase</name>
  <files>
    extensions/pi-claude-marketplace/persistence/state-io.ts,
    extensions/pi-claude-marketplace/persistence/migrate.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  </files>
  <action>
**state-io.ts** — three changes:

1. Add `enabled: Type.Boolean()` as a required field to `PLUGIN_INSTALL_RECORD_SCHEMA`. Place it after `resources` and before `installedAt` to match declaration order.

2. Change `STATE_SCHEMA.schemaVersion` from `Type.Literal(1)` to `Type.Union([Type.Literal(1), Type.Literal(2)])` so both old (1) and new (2) files pass `STATE_VALIDATOR.Check` during the load/migration cycle. The normalized shape written back by `persistMigratedState` should be passed with `schemaVersion: 2`. Update `DEFAULT_STATE.schemaVersion` to `2`. Update the ENOENT early-return in `loadState` to return `{ schemaVersion: 2, marketplaces: {} }`. Update the `const normalized: unknown = { schemaVersion: 1, marketplaces }` line to use `2` so migrated state is written at the new version. Update `saveState`'s `STATE_VALIDATOR.Check` — the validator now accepts both 1 and 2, so saves of version-2 objects pass cleanly.

   Export `ExtensionState` continues to derive from the schema; TypeScript will infer `schemaVersion: 1 | 2`, which is fine.

**migrate.ts** — add `ensurePluginEnabled`:

Add a new helper `ensurePluginEnabled(mp: Record<string, unknown>): boolean` that mirrors `ensurePluginResources`. It iterates `mp.plugins` values; for each plugin record `pl`, if `pl.enabled === undefined`, sets `pl.enabled = true` and marks `mutated = true`. Returns `mutated`. The rationale: all existing plugin records with `resources.*` arrays populated (or even unpopulated) were actively installed and therefore enabled by definition — they would not have been kept in state.json otherwise.

Call `ensurePluginEnabled(mp)` inside `migrateLegacyMarketplaceRecords`'s per-marketplace loop, after `ensurePluginResources(mp)`, with the same `mutated = helper() || mutated` pattern.

Update the file-level JSDoc: add a note that `ensurePluginEnabled` fills `enabled: true` on v1 records (additive default-fill, same discipline as the hooks arm in `ensurePluginResources`).

**install.ts statePhase** — add `enabled: true` to the record being written:

In the `statePhase.do` closure, the block `mpInner.plugins[c.plugin] = { version: ..., resolvedSource: ..., compatibility: ..., resources: ..., installedAt: ..., updatedAt: ... }` needs `enabled: true` added. Place it after `resources` and before `installedAt` so it matches the schema field order. The `allowExistingRecord` arm (re-materialization) should also set `enabled: true` — this is the enable-path writing back the explicit flag (the disable path previously zeroed resources; after this change the disable path sets `enabled: false` explicitly, but the enable path re-runs statePhase via `runInstallLedger`, so statePhase must write `enabled: true` here).

Do NOT touch the `existing?.installedAt ?? nowIso` line — the installedAt preservation logic for re-materialization is unchanged.

After all three edits, run `npm run check` to confirm typecheck + lint + tests pass. Expect failures in plan.ts and enable-disable.ts (next task fixes those) — but state-io and install changes alone should not introduce new type errors if the schema union is wide enough.

Actually: because `PLUGIN_INSTALL_RECORD_SCHEMA` now requires `enabled`, TypeScript will immediately surface missing-field errors in every fixture builder and test helper that constructs plugin records inline. Fix those in the same task: search for `plugins[c.plugin] = {` and inline plugin record literals in tests (state-io.test.ts, migrate.test.ts, plan.test.ts, enable-disable.test.ts, install-related tests) and add `enabled: true` wherever a `PLUGIN_INSTALL_RECORD_SCHEMA`-shaped literal appears. Use grep: `grep -rn "installedAt:" tests/ extensions/` to locate all inline record literals.

The disable branch in enable-disable.ts (next task) currently zeros resources arrays — that still compiles fine since `enabled` just starts as `true` there; next task sets it to `false`. So task 1 can be committed independently once typecheck is clean.
  </action>
  <verify>
    <automated>cd /Users/acolomba/src/pi-claude-marketplace && npm run check 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `PLUGIN_INSTALL_RECORD_SCHEMA` has `enabled: Type.Boolean()`
    - `STATE_SCHEMA.schemaVersion` is `Type.Union([Type.Literal(1), Type.Literal(2)])`
    - `DEFAULT_STATE.schemaVersion` is `2`
    - `migrateLegacyMarketplaceRecords` calls `ensurePluginEnabled`
    - `statePhase` writes `enabled: true`
    - All inline plugin record literals in tests have `enabled: true`
    - `npm run check` exits 0
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace disabled marker in plan.ts and enable-disable.ts; update T5 drift gate</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts,
    tests/orchestrators/reconcile/plan.test.ts
  </files>
  <action>
**plan.ts — `isRecordedButDisabled`**:

Replace the entire body of `isRecordedButDisabled` with:

```
return record.compatibility.installable && record.enabled === false;
```

Update the JSDoc above it: remove the long explanation of the five-array-emptiness heuristic and the `requireInstallable` gate reasoning. Replace with a short note: reads the explicit `enabled` field; `enabled === false` is the sole disabled marker; `installable === true` guard retained so soft-degraded (`installable: false`) records with `enabled: false` (hypothetically) are not classified as disabled-but-re-enableable. Remove the SPLIT-01 preservation note (no longer relevant).

Also update the module-level block comment at the top of plan.ts: remove the paragraph starting "ENBL-02: the recorded-but-disabled hand-off closes here. `isRecordedButDisabled(record)` reads the empty-resources marker (all four `resources.*` arrays empty -- A1; SPLIT-01 preserved)" and replace it with: "ENBL-02: `isRecordedButDisabled(record)` reads `record.enabled === false` (explicit field, schemaVersion 2). The `installable === true` guard retains the soft-degraded exclusion."

**enable-disable.ts — `isCurrentlyDisabled`**:

Replace the entire body of `isCurrentlyDisabled` with:

```
return installed.compatibility.installable && installed.enabled === false;
```

The function signature parameter type already references the state record shape via `InstalledPluginRecord = ExtensionState["marketplaces"][string]["plugins"][string]`. After Task 1 adds `enabled: boolean` to the schema, `installed.enabled` is typed `boolean` — no cast needed.

Update the JSDoc on `isCurrentlyDisabled`: replace the five-axis explanation with "Reads `enabled === false`; installable guard retains soft-degraded exclusion. Duplicated from `isRecordedButDisabled` to keep the orchestrator import graph free of the reconcile module."

**enable-disable.ts — disable branch**:

In `runDisableBranch`, after `installed.resources.hooks = []` and before the `dropCachedHooks` call, add:

```
installed.enabled = false;
```

The existing five resource-array zeroing MUST remain — clearing resources is still the mechanism that removes artefacts from Pi. `enabled: false` is the explicit intent marker; the arrays being empty remains the physical state. Both must be set.

**enable-disable.ts — enable branch (idempotent config-flip arm)**:

In the `isCurrentlyDisabled(installed) === !enable` branch (the config-flip arm for mismatched config), after `writeBatchedConfigEntries` and before `outcome = { kind: "fresh", ... }`, add `installed.enabled = enable;` and then `await tx.save();`. Wait — read the existing arm carefully. Currently this arm does NOT call `tx.save()` (the state-side is already correct). With the new field, when the enable branch hits the config-flip arm, `installed.enabled` is already `true` (state matches), so no state update needed there. When the disable branch hits it (`enable === false`), `installed.enabled` is already `false`. So this arm needs no change to state — state truth is correct; only config was diverged. No modification needed.

**enable-disable.ts — enable branch (main path)**:

In `runEnableBranch`, the enable path calls `runInstallLedger` which runs `statePhase` which sets `enabled: true` (Task 1). So the enable branch naturally sets `enabled: true` via `statePhase`. No separate assignment needed here.

**tests/orchestrators/reconcile/plan.test.ts — T5 drift gate**:

The T5 test block (lines ~612-811) has two tests:

1. The truth-table test over `isRecordedButDisabled`: update the `recordWith` helper to accept an `enabled?: boolean` parameter (default `true`) and set `enabled: enabled ?? true` on the returned record. Update the test cases: the matrix is now `installable x enabled` (two boolean dimensions, not three). Keep cases:
   - `(installable: true, enabled: true)` → `false` (enabled)
   - `(installable: true, enabled: false)` → `true` (the disabled marker)
   - `(installable: false, enabled: true)` → `false` (soft-degraded, never disabled)
   - `(installable: false, enabled: false)` → `false` (soft-degraded, never disabled)
   Remove the `hooksPopulated` dimension entirely — it is no longer relevant since the heuristic is gone. Remove references to `D-63-04`.

2. The `isCurrentlyDisabled` source-shape pin test: update `requiredAxes` to:
   - `"compatibility.installable"`
   - `"enabled === false"` (or `"installed.enabled === false"`)
   Remove the five `resources.*.length === 0` entries. Remove the `||` conjunction check (no longer relevant — the new body uses `&&` but over two axes, not six). Keep the `&&` check.

   Update the regex that extracts the function body from the source file if needed, but the function signature should still be findable by name.

Run `npm run check` after all changes to confirm full green.
  </action>
  <verify>
    <automated>cd /Users/acolomba/src/pi-claude-marketplace && npm run check 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `isRecordedButDisabled` returns `record.compatibility.installable && record.enabled === false`
    - `isCurrentlyDisabled` returns `installed.compatibility.installable && installed.enabled === false`
    - `runDisableBranch` sets `installed.enabled = false` alongside zeroing resource arrays
    - T5 truth table reduced to `installable x enabled` matrix (4 cases, no hooksPopulated dimension)
    - T5 source-shape pin asserts `enabled === false` axis, not the six resource-array axes
    - `npm run check` exits 0
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| state.json → loadState | Untrusted bytes from disk; schema validation gates all fields |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-kmm-01 | Tampering | migration: enabled default | mitigate | Migration sets `enabled: true` unconditionally for absent field; validation rejects absent field after migration runs |
| T-kmm-02 | Information disclosure | n/a | accept | `enabled` is a boolean, not PII; no new disclosure surface |
</threat_model>

<verification>
- `npm run check` exits 0 (typecheck + ESLint + Prettier + tests)
- `STATE_VALIDATOR.Check({ schemaVersion: 1, marketplaces: {} })` returns false (missing enabled on any plugin would fail; but schemaVersion 1 with no plugins passes)
- A state.json with schemaVersion 1 and an existing plugin record (no `enabled` field) loads, migration fills `enabled: true`, `STATE_VALIDATOR.Check` passes, and `persistMigratedState` writes back schemaVersion 2
- After install: `state.marketplaces[mp].plugins[plugin].enabled === true`
- After disable: `state.marketplaces[mp].plugins[plugin].enabled === false` AND all five resource arrays are empty
- After enable: `state.marketplaces[mp].plugins[plugin].enabled === true` AND resource arrays are repopulated
- `isRecordedButDisabled` returns `true` only for `{ installable: true, enabled: false }` records
- No test references `resources.skills.length === 0` as a disabled-detection heuristic
</verification>

<success_criteria>
- `enabled: boolean` is a required field in `PLUGIN_INSTALL_RECORD_SCHEMA`
- schemaVersion bumps to 2; version 1 files load and migrate cleanly in a single `loadState` call
- `isRecordedButDisabled` and `isCurrentlyDisabled` are one-liners reading `enabled === false`
- Disable sets `enabled: false`; enable (via statePhase) sets `enabled: true`
- T5 drift gate reflects the new predicate shape
- `npm run check` is green with no pre-existing test regressions
</success_criteria>

<output>
Create `.planning/quick/260621-kmm-add-explicit-enabled-boolean-field-to-pl/260621-kmm-SUMMARY.md` when done
</output>
