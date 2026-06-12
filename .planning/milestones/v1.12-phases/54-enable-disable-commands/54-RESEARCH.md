# Phase 54: Enable/Disable Commands - Research

**Researched:** 2026-06-10
**Domain:** plugin lifecycle write-back + cache-only re-materialization + three-orthogonal-facts rendering
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All inherited from Phases 51-53 (the frozen foundation):

- Config writes go ONLY through `saveConfig` (`persistence/config-io.ts`); the SPLIT-02 architecture test (`tests/architecture/config-state-write-seams.test.ts`) structurally enforces write-seam ownership. Command write-back is a sanctioned config-write path (SPLIT-02 allows "command write-back or one-time migration").
- `enabled` defaults to `true` at consume time (D-04); entry-level merge semantics from `config-merge.ts` (`MergedConfig` with provenance).
- The reconcile planner (Phase 53, `orchestrators/reconcile/plan.ts`) already ships the enable/disable transition buckets and the `will enable`/`will disable` tokens; this phase wires the disabled-state reality so `pluginsToEnable`/`pluginsToDisable` can become non-empty (the Phase 53→54 hand-off documented in plan.ts and the reconcile README).
- Disabled plugins are NOT in the desired-materialized set: `declared AND enabled` (preview never shows them as pending installs).
- `--local` targets `claude-plugins.local.json`; base file otherwise. Mutating-command conventions (scope resolution, withStateGuard, atomic ops) follow the autoupdate/noautoupdate command family shape.

### Output grammar (locked project conventions)

- Rows render subject-first: `<glyph> <name> [scope] (status) {reason}`.
- Any new status token (e.g. `(disabled)`) is a closed-set catalog amendment: renderer + `docs/output-catalog.md` + `catalog-uat` byte fixtures in the SAME atomic commit.
- `disabled` must render distinctly from soft-degraded `unavailable` on `list` and `info` (ENBL-04) -- three orthogonal facts: declared / enabled / available.
- All user-visible output via `ctx.ui.notify` through structured `notify()` v2 (IL-2); error/warning notifications carry a non-empty summary line (v1.11 GRAM contract).
- `enable` is strictly network-free (NFR-5): re-materializes from cached clone + internal records only.

### Claude's Discretion

All implementation choices are at Claude's discretion -- discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)

None -- discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENBL-01 | User can run `enable <plugin>@<marketplace>` / `disable <plugin>@<marketplace>` in the autoupdate/noautoupdate command shape; `--scope user|project` and `--local` consistent with other mutating commands | Standard Stack §Command-shape mirror; Pattern 1 (single orchestrator parameterized by `enable: boolean`); Pattern 2 (write-back). |
| ENBL-02 | A disabled plugin keeps its config entry AND version pin, but Pi artefacts are not materialized after reload; reconcile's desired-materialized set is `declared AND enabled` | Pattern 3 (artefact removal via existing cascadeUnstagePlugin reuse); Pattern 4 (state-record retention); planner already enforces the rule (plan.ts:233-245). |
| ENBL-03 | `enable` re-materializes the plugin's artefacts from the cached marketplace clone + persisted internal records with NO network | Pattern 5 (cache-only install path -- PI-2 cached manifest + bridge prepare/commit reuse); Pitfall 54-3 (NFR-5 enforcement). |
| ENBL-04 | `disabled` status renders distinct from soft-degraded `unavailable` on list/info (three orthogonal facts: declared / enabled / available) | Pattern 6 (new `disabled` PLUGIN_STATUSES token + variant + renderer arm + catalog state + FIXTURES); atomic-supersession discipline (Pitfall 54-2). |
</phase_requirements>

## Summary

Phase 54 has TWO halves that compose into a single atomic delivery and one large code-rewire:

**Half A (write-back):** Two new edge subcommands `enable`/`disable` that mirror autoupdate/noautoupdate's structural pattern (a single orchestrator parameterized by `enable: boolean`; two factory entrypoints; `--scope` + new `--local` flag), but target the **plugin** entry in the **config file** (NOT the marketplace record in state). The write goes through `saveConfig` after a read-then-patch-then-save pattern under the per-scope `withStateGuard` / `withLockedStateTransaction` lock. The base file (`claude-plugins.json`) is the default; `--local` redirects to `claude-plugins.local.json` without ever touching base (WB-02 forward signal). Phase 56 will reuse the same `saveConfig`-based patch shape for the broader write-back family; Phase 54 builds it once for enable/disable as the first user-visible consumer.

**Half B (reconciler reality):** Phase 53's planner already implements the `declared AND enabled` desired-materialized rule (`plan.ts:233-245`: `enabledExplicitFalse` AND `recorded` → `pluginsToDisable` bucket). Phase 53 left `pluginsToEnable` structurally empty (Pitfall 53-4) because the state model has no "currently disabled" marker -- a recorded plugin cannot be distinguished from a recorded-but-locally-disabled plugin. Phase 54 closes that gap by **defining what disable removes** (the artefacts) and **what it keeps** (the state record + version pin) -- a recorded plugin with EMPTY `resources.*` arrays + an `installable: true` compatibility record is the "currently disabled" marker. The planner reads this state shape and produces `pluginsToEnable` rows when config says `enabled: undefined|true` AND the recorded plugin has zero artefacts. This requires extending Phase 53's `buildRecordedKeys`/`classifyDeclaredPlugin` logic.

**Code rewire bonus:** Phase 51 left 11 files with `// SPLIT-01:` cast markers reading/writing `record.autoupdate` on state records. Phase 54-56 are charged with the proper rewire to MergedConfig. Phase 54 SHOULD include the targeted subset for the plugin read sites (`plugin/list.ts`, `plugin/info.ts`), leaving the marketplace-side autoupdate rewire to Phase 56 alongside `marketplace autoupdate` write-back. The Plan-51 P02 frontmatter explicitly carved this work into Phases 54-56.

**ENBL-04 rendering decision (LOAD-BEARING):** A new closed-set `disabled` `PluginStatus` token + `PluginDisabledMessage` variant + renderer arm + `docs/output-catalog.md` state + `catalog-uat` FIXTURES entry MUST land in ONE atomic commit per the v1.3/v1.10/v1.11/Phase 53 atomic-supersession discipline. The reused-token alternative (`unavailable` with a `{disabled}` reason or `skipped` with a `{disabled}` reason) is REJECTED because ENBL-04 explicitly mandates that disabled and unavailable be distinct facts -- collapsing them into one row token defeats the requirement. The new token brings PLUGIN_STATUSES from 15 to 16 and STATUS_TOKENS from 21 to 22 (length-lock bumps locked in `tests/architecture/notify-types.test.ts:139,153`).

**Primary recommendation:** Build a single orchestrator `setPluginEnabled(opts: { ..., enable: boolean })` that mirrors `setMarketplaceAutoupdate`'s shape exactly (SC-6 scope fan-out, edge `makeEnableDisableHandler(pi, enable)` factory) but composes THREE operations atomically per scope: (1) `loadMergedScopeConfig` to find the entry's provenance file (base vs local; `--local` forces local), (2) inside the state lock, run `cascadeUnstagePlugin` on disable / `runPhases([skills, commands, agents, mcp, state])` on enable (reusing install's exact 5-phase ledger but with PI-2 cached-manifest read only -- NO gitOps surface), (3) `saveConfig(filePath, patchedConfig, scopeRoot)` to flip `enabled`. The state record's `resources.*` arrays + `compatibility` + `version` are the durable bookkeeping that survives disable (the version pin) and is reused by enable (cache-only re-materialization).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parse `<plugin>@<marketplace>`, `--scope`, `--local` | Edge handler | -- | Mirror `edge/handlers/plugin/uninstall.ts` Pattern 1. |
| Tab completion for `enable`/`disable` positionals | Edge completion provider | -- | TC-6 extension; new `enable`/`disable` modes alongside install/uninstall/update/reinstall/info. |
| Cross-scope plugin-target resolution | Orchestrator (plugin) | Persistence (state-io) | `resolveCrossScopePluginTarget` from `orchestrators/plugin/shared.ts` -- distinguishes resolved / other-scope / marketplace-absent. |
| Config read + entry-level patch | Persistence (config-merge + config-io) | -- | `loadMergedScopeConfig` for provenance; `saveConfig` for the patched write (SPLIT-02 sanctioned). |
| Atomic file write of `claude-plugins.json` / `claude-plugins.local.json` | Persistence (config-io) | -- | `saveConfig` is the SOLE sanctioned writer; `assertPathInside` + `atomicWriteJson` enforced. |
| Artefact removal (disable) | Orchestrator (marketplace/shared) | Bridges | `cascadeUnstagePlugin` (skills → commands → agents → mcp) already exists; reuse verbatim from `uninstall.ts`. |
| Artefact materialization from cache (enable) | Orchestrator (plugin) | Bridges + Domain (resolver/manifest) | Reuse install.ts 5-phase ledger MINUS gitOps -- PI-2 cached manifest read + bridge prepare/commit are already network-free. |
| State record update (resources.* arrays + updatedAt timestamp) | Orchestrator (plugin) | Persistence (state-io) | Inside `withStateGuard`; saveState fires on no-throw. |
| List/info row rendering with disabled distinction | Edge handler (list/info) → notify.ts renderer | -- | New `disabled` PLUGIN_STATUSES + renderer arm. |
| Reconcile planner reading "currently disabled" state | Orchestrator (reconcile/plan.ts) | -- | Extend `classifyDeclaredPlugin` to read recorded plugin's `resources.*` arity → produce `pluginsToEnable` when desired-enabled but artefacts empty. |
| Cross-process lock coverage | Transaction (withStateGuard) | -- | Already supports both state-mutating and read-then-write patterns. |

## Standard Stack

### Core (existing -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typebox` | 1.1.38 (peer) | `CONFIG_SCHEMA` / `STATE_SCHEMA` validation on save | Already the codebase standard; saveConfig revalidates via `CONFIG_VALIDATOR.Check`. [VERIFIED: package.json + persistence/config-io.ts] |
| `node:fs/promises` | bundled | Reading + atomic-rename writes | Used everywhere; no new dep. [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts] |
| `write-file-atomic` | ^7 | tmp+rename JSON writes | Already wired through `shared/atomic-json.ts::atomicWriteJson`. [VERIFIED: package.json, STATE.md note "v0.1.2: engines >=20.19.0, write-file-atomic ^7"] |

### Supporting (reused from existing seams)

| Helper | Source File | Phase 54 Reuse |
|--------|-------------|----------------|
| `setMarketplaceAutoupdate` shape | `orchestrators/marketplace/autoupdate.ts` | Reference template for `setPluginEnabled` (SC-6 fan-out; single-orchestrator-parameterized-by-bool; emit-once-per-call). |
| `makeAutoupdateHandler(pi, enable)` shape | `edge/handlers/marketplace/autoupdate.ts` | Reference template for `makeEnableDisableHandler(pi, enable)`. |
| `resolveCrossScopePluginTarget` | `orchestrators/plugin/shared.ts:132` | Plugin-target scope resolution (resolved / other-scope / marketplace-absent discriminator). |
| `parseRequiredPluginMarketplaceRef` | `edge/handlers/plugin/shared.ts:114` | Parse `<plugin>@<marketplace>` + `--scope`. |
| `withStateGuard` | `transaction/with-state-guard.ts:66` | Per-scope state lock around the cascade + state record mutation; saves on no-throw. |
| `loadMergedScopeConfig` | `persistence/config-merge.ts` | Read base + local + merged view with per-file provenance for `--local` write targeting. |
| `loadConfig` | `persistence/config-io.ts:119` | Re-read the EXACT file we're about to patch (base or local) under the state lock to get the latest bytes. |
| `saveConfig(filePath, config, scopeRoot)` | `persistence/config-io.ts:172` | SOLE sanctioned config writer; runs `assertPathInside` + `atomicWriteJson`. |
| `cascadeUnstagePlugin` | `orchestrators/marketplace/shared.ts` | Disable's artefact-removal cascade (D-02/D-03 fail-fast: skills → commands → agents → mcp). |
| `runPhases([skills, commands, agents, mcp, state])` | `orchestrators/plugin/install.ts:674` + `transaction/phase-ledger.ts` | Enable's 5-phase ledger -- reuse the install path's existing phases verbatim. |
| `loadMarketplaceManifest` | `domain/manifest.ts` | PI-2 cached manifest read (no network); used by install for the manifest entry. |
| `resolveStrict` + `requireInstallable` | `domain/resolver.ts` | Resolve manifest entry to `ResolvedPluginInstallable` from the cached clone path. |
| `notify(ctx, pi, msg)` | `shared/notify.ts` | Sole user-visible-output chokepoint (IL-2). |
| `notifyUsageError` | `shared/notify.ts` | Edge-layer argument-parsing errors. |
| `ScopedLocations` { `configJsonPath`, `configLocalJsonPath` } | `persistence/locations.ts` | Path resolution for `--local` flag dispatch. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `disabled` PLUGIN_STATUSES token | Reuse `skipped` with `{disabled}` reason, OR `unavailable` with `{disabled}` reason | **REJECTED** -- ENBL-04 mandates that disabled and unavailable be DISTINCT facts. A reused `unavailable` collapses two orthogonal facts into one row token; a reused `skipped` is wrong-tense (skipped is a cascade-action outcome, not an inventory state). The new token costs one length-lock bump per tuple and zero new icon constants (reuse `ICON_UNINSTALLABLE` `⊘` -- already used by `will disable` in Phase 53). |
| Storing a `disabled: true` marker on the state record | Use EMPTY `resources.*` arrays as the implicit marker | **PREFERRED ALTERNATIVE.** Adding `disabled: boolean` to `PLUGIN_INSTALL_RECORD_SCHEMA` would create a SECOND source of truth (config.enabled vs state.disabled) which contradicts SPLIT-01 ("config file owns user settings"). Empty `resources.*` is already the natural disabled marker -- a disabled plugin has no skills/commands/agents/mcp artefacts present. The state record's `version` field preserves the pin (ENBL-02). |
| New `enabled: boolean` field on STATE_SCHEMA | Stay with the empty-resources marker | **REJECTED** -- SPLIT-01 explicitly carved user-authored desired-state OUT of state.json; adding it back violates the split. Phase 56 verification gate notes (STATE.md): "no production site reads or writes `record.autoupdate` on state". The analog holds for enabled. |
| Separate `enable`/`disable` orchestrators | Single `setPluginEnabled(opts: { enable: boolean })` | **PREFERRED.** Mirrors `setMarketplaceAutoupdate(opts: { enable })` exactly. Less code, identical test surface, one cascade-vs-materialize switch inside one function. |
| Re-running full install path on enable | Cache-only path (PI-2 cached-manifest + bridge prepare/commit; NO gitOps) | **REQUIRED by NFR-5.** Install.ts is already structurally network-free (PI-2 cached-manifest read; the architectural gate at `tests/architecture/no-orchestrator-network.test.ts` enforces this). Phase 54 enable inherits the same structural guarantee by reusing the 5-phase ledger. |

**Installation:** None -- no new dependencies. Phase 54 is an additive code change.

**Version verification:** N/A -- no new packages.

## Package Legitimacy Audit

Not applicable -- Phase 54 introduces zero new external packages. All reused helpers are first-party code under `extensions/pi-claude-marketplace/`.

## Architecture Patterns

### System Architecture Diagram

```
                       ┌────────────────────────────────────────────┐
                       │   /claude:plugin enable <p>@<mp> [--scope] │
                       │   /claude:plugin disable <p>@<mp> [--local]│
                       └─────────────────┬──────────────────────────┘
                                         │ args, ctx
                                         ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  edge/handlers/plugin/enable-disable.ts                      │
   │  makeEnableDisableHandler(pi, enable: boolean)               │
   │                                                              │
   │  • parseRequiredPluginMarketplaceRef -> {plugin, mp, scope?} │
   │  • parse --local flag (NEW; mirror parseMapModelArgs shape)  │
   │  • USAGE on parse failure -> notifyUsageError                │
   └──────────────────────────────┬───────────────────────────────┘
                                  │ {plugin, mp, scope?, local?, enable}
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  orchestrators/plugin/enable-disable.ts                      │
   │  setPluginEnabled(opts: { ctx, pi, cwd, plugin, mp,          │
   │                            scope?, local?, enable })         │
   │                                                              │
   │  resolveCrossScopePluginTarget(cwd, mp, plugin, scope?)      │
   │     ├─ marketplace-absent / other-scope ──► notify           │
   │     │      marketplace-not-added [scope?]                    │
   │     │                                                        │
   │     └─ resolved {scope, locations} ◄─────┐                   │
   │                  │                       │                   │
   │                  ▼                       │                   │
   │   withStateGuard(locations, async state) │                   │
   │     ├─ idempotency check:                │                   │
   │     │    desired === current? ──► (skipped) {already         │
   │     │                                     enabled|disabled}  │
   │     │                                                        │
   │     ├─ ENABLE branch:                                        │
   │     │   • read state.marketplaces[mp]                        │
   │     │   • cached manifest read (PI-2; loadMarketplaceManifest)│
   │     │   • resolveStrict + requireInstallable                 │
   │     │   • runPhases([skills, commands, agents, mcp,          │
   │     │                state-record-rewrite]) on InstallCtx    │
   │     │   • state record version pin PRESERVED                 │
   │     │   • saveConfig(targetPath, patched, scopeRoot)         │
   │     │   • emit PluginEnabledMessage / status:"installed"     │
   │     │                                                        │
   │     ├─ DISABLE branch:                                       │
   │     │   • cascadeUnstagePlugin(plugin, mp, locations, recs)  │
   │     │   • state.marketplaces[mp].plugins[plugin].resources   │
   │     │       reset to { skills:[], prompts:[], agents:[],     │
   │     │                  mcpServers:[] }                       │
   │     │   • state.marketplaces[mp].plugins[plugin].version     │
   │     │       PRESERVED (ENBL-02 version pin)                  │
   │     │   • saveConfig(targetPath, patched, scopeRoot)         │
   │     │   • emit PluginDisabledMessage                         │
   │     │                                                        │
   │     └─ withStateGuard saves state.json on no-throw           │
   │                                                              │
   │  notify(ctx, pi, marketplaces:[{ name, scope, plugins:[..] }])│
   └──────────────────────────────────────────────────────────────┘

   Side-channel reads (used by --local resolution):
     loadMergedScopeConfig(locations)
       → { merged: MergedConfig, base: ConfigLoadResult, local: ConfigLoadResult }
       Used to decide WHICH file to patch:
         --local flag → locations.configLocalJsonPath
         else        → locations.configJsonPath

   Reconcile planner reality update (Phase 53 hand-off):
     orchestrators/reconcile/plan.ts::classifyDeclaredPlugin
       NEW: when (declared enabled !== false) AND (recorded)
            AND (recordedResourcesAllEmpty) → pluginsToEnable bucket
       (Phase 53 left this branch structurally empty per Pitfall 53-4)
```

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── edge/
│   ├── handlers/plugin/
│   │   └── enable-disable.ts             # NEW: makeEnableDisableHandler(pi, enable)
│   ├── router.ts                          # MODIFIED: add enable + disable to TOP_LEVEL_SUBCOMMANDS, SubcommandHandlers, switch, TOP_LEVEL_USAGE
│   ├── register.ts                        # MODIFIED: wire enable + disable handlers
│   └── completions/provider.ts            # MODIFIED: TC-6 mode for enable + disable (installed-plugin completion)
├── orchestrators/
│   ├── plugin/
│   │   ├── enable-disable.ts              # NEW: setPluginEnabled(opts)
│   │   └── shared.ts                      # POTENTIAL helpers: reuse existing
│   └── reconcile/
│       └── plan.ts                        # MODIFIED: classifyDeclaredPlugin reads recorded-resources to populate pluginsToEnable
├── shared/
│   └── notify.ts                          # MODIFIED: PLUGIN_STATUSES + PluginDisabledMessage variant + renderer arm + (optionally) PluginEnabledMessage if we don't reuse PluginInstalledMessage
├── docs/output-catalog.md                 # MODIFIED: new `## /claude:plugin enable` + `## /claude:plugin disable` H2 sections; list/info `disabled` row catalog state
└── tests/
    ├── architecture/notify-types.test.ts  # MODIFIED: length-lock bumps; PluginDisabledMessage shape proof
    ├── architecture/catalog-uat.test.ts   # MODIFIED: FIXTURES entries for new catalog states
    ├── architecture/notify-grammar-invariant.test.ts # MODIFIED: subject-first proof for new disabled row
    ├── architecture/no-orchestrator-network.test.ts  # MODIFIED: FORBIDDEN_TARGETS extension to orchestrators/plugin/enable-disable.ts
    ├── architecture/config-state-write-seams.test.ts # NO CHANGE: saveConfig is already on allow-list; we route through it.
    ├── orchestrators/plugin/enable-disable.test.ts   # NEW: per-scope idempotency, version-pin preservation, cache-only network proof, --local routing
    ├── edge/handlers/plugin/enable-disable.test.ts   # NEW: parse + USAGE shim tests
    ├── orchestrators/reconcile/plan.test.ts          # MODIFIED: pluginsToEnable bucket populated when state has empty-resources record
    └── shared/notify-v2.test.ts                       # MODIFIED: byte-equality for new (disabled) row + (already disabled)/(already enabled) skip rows
```

### Pattern 1: Single orchestrator parameterized by `enable: boolean`

**What:** One `setPluginEnabled(opts)` orchestrator with `enable: boolean` in the options bag. Two edge factories: `makeEnableDisableHandler(pi, true)` for `enable`, `makeEnableDisableHandler(pi, false)` for `disable`.

**When to use:** Mirrors `setMarketplaceAutoupdate`'s shape (which is the load-bearing precedent in this codebase per CONTEXT.md "autoupdate/noautoupdate command shape").

**Example:**

```typescript
// Source: orchestrators/marketplace/autoupdate.ts (template; verified in this session)
export interface EnableDisablePluginOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly enable: boolean;
  readonly scope?: Scope;
  /** WB-02 forward signal: `--local` routes the config write to claude-plugins.local.json. */
  readonly local?: boolean;
}

export async function setPluginEnabled(opts: EnableDisablePluginOptions): Promise<void> {
  // 1. Resolve target scope (resolved / other-scope / marketplace-absent).
  // 2. withStateGuard(locations, async (state) => { ...cascade or materialize... })
  // 3. saveConfig(targetConfigPath, patchedConfig, scopeRoot)
  // 4. ONE notify() call per IL-2.
}
```

### Pattern 2: Targeted entry-level config patch (the WB-01 shape, scoped to ENBL-01)

**What:** Inside the state lock, (a) `loadConfig` the EXACT target file (`configJsonPath` or `configLocalJsonPath` based on `--local`), (b) patch ONE plugin entry's `enabled` field, (c) `saveConfig` the patched config.

**When to use:** Every command write-back; Phase 56 will extend to install/uninstall/etc. but Phase 54 builds this once for enable/disable.

**Crucial detail (Pitfall 54-1):** The read MUST happen INSIDE the lock so a concurrent edit from another process doesn't get clobbered. Read the trichotomy:
- `absent` → start with `{ schemaVersion: 1, marketplaces: {}, plugins: {} }`
- `invalid` → ABORT the operation (CFG-03 contract: never overwrite an invalid file with a re-derived shape; surface as `(failed) {invalid manifest}` with `path.basename`)
- `valid` → use the loaded `config`

**Example:**

```typescript
// Patch shape (inside the state lock):
const readResult = await loadConfig(targetFilePath);
if (readResult.status === "invalid") {
  // CFG-03 abort -- surface error, do NOT touch the file.
  notify(ctx, pi, {
    marketplaces: [{ name: marketplace, scope, plugins: [
      { status: "failed", name: plugin, reasons: ["invalid manifest"] }
    ]}]
  });
  return;
}

const currentConfig: ScopeConfig =
  readResult.status === "absent"
    ? { schemaVersion: 1, marketplaces: {}, plugins: {} }
    : readResult.config;

const flatKey = `${plugin}@${marketplace}`;
const existingEntry = currentConfig.plugins?.[flatKey] ?? {};

const nextPlugins = {
  ...(currentConfig.plugins ?? {}),
  [flatKey]: { ...existingEntry, enabled: opts.enable },
};

const patched: ScopeConfig = {
  ...currentConfig,
  schemaVersion: 1,
  plugins: nextPlugins,
};

await saveConfig(targetFilePath, patched, scopeRoot);
```

### Pattern 3: Disable -- artefact removal via `cascadeUnstagePlugin` reuse

**What:** Disable runs `cascadeUnstagePlugin(plugin, marketplace, locations, installed)` inside `withStateGuard`, then resets the state record's `resources.*` to empty arrays but KEEPS `version`, `resolvedSource`, `compatibility`, `installedAt`. `updatedAt` is bumped to now.

**When to use:** Disable's bridge-removal cascade is IDENTICAL to uninstall's first half. The difference is uninstall then `delete state.marketplaces[mp].plugins[plugin]` whereas disable leaves the record present with empty resources.

**Example:**

```typescript
// Reference: orchestrators/plugin/uninstall.ts and orchestrators/marketplace/shared.ts:cascadeUnstagePlugin
const installed = state.marketplaces[marketplace].plugins[plugin];
const outcome = await cascadeUnstagePlugin(plugin, marketplace, locations, installed);
if (!outcome.ok) throw outcome.cause;

// Disable-vs-uninstall divergence: KEEP the record, reset resources only.
const record = state.marketplaces[marketplace].plugins[plugin];
state.marketplaces[marketplace].plugins[plugin] = {
  ...record,
  resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
  updatedAt: new Date().toISOString(),
  // version, resolvedSource, compatibility, installedAt UNCHANGED.
};
```

### Pattern 4: State-record "currently disabled" marker (no schema bump)

**What:** A recorded plugin with EMPTY `resources.*` arrays AND `compatibility.installable: true` is the implicit "currently disabled" marker. No new schema field; no STATE_SCHEMA bump.

**Why:** SPLIT-01 forbids storing user-authored desired-state in `state.json`. Empty resources is already the natural materialized fact for a disabled-but-pinned plugin, and the planner can detect it without a new field.

**Planner update for Phase 53 hand-off:**

```typescript
// orchestrators/reconcile/plan.ts -- modification to classifyDeclaredPlugin
function isRecordedButDisabled(record: PluginInstallRecord): boolean {
  return record.resources.skills.length === 0
      && record.resources.prompts.length === 0
      && record.resources.agents.length === 0
      && record.resources.mcpServers.length === 0;
}

// In classifyDeclaredPlugin:
if (recorded && !enabledExplicitFalse) {
  // Steady state OR disabled-then-re-enabled-in-config case.
  const recordedRecord = state.marketplaces[marketplace]?.plugins[plugin];
  if (recordedRecord !== undefined && isRecordedButDisabled(recordedRecord)) {
    acc.enable.push({ scope, plugin, marketplace });  // NEW Phase 54 wiring
  }
  // else: steady state, no action.
}
```

### Pattern 5: Enable -- cache-only re-materialization via reused install phases

**What:** Enable reads the EXISTING `state.marketplaces[mp]` record's `marketplaceRoot` (the cached clone path), reads the cached `manifest.json` via `loadMarketplaceManifest` (PI-2 -- no network), `resolveStrict` + `requireInstallable` against the cached `pluginRoot`, runs the existing 5-phase ledger from install.ts, and writes the state record back. The `version` field is taken FROM THE EXISTING RECORD (preserving the pin per ENBL-03).

**Why:** Install.ts is already network-free by construction (Pitfall 54-3 / `tests/architecture/no-orchestrator-network.test.ts`). Reusing its phases gives Phase 54 the same structural NFR-5 guarantee for free.

**Critical divergence from install:** Phase 54 enable does NOT call `resolvePluginVersion` (which can run hash computation) -- it preserves the pinned version from the state record. The `statePhase` in the ledger overwrites `version: c.version` with the existing pin.

```typescript
// Inside the state lock, enable branch:
const installed = state.marketplaces[marketplace].plugins[plugin];
const mp = state.marketplaces[marketplace];

// PI-2 cached read -- no network.
const manifest = await loadMarketplaceManifest(mp.manifestPath);
const entry = manifest.plugins.find(e => e.name === plugin);
if (entry === undefined) {
  // Manifest changed since install -- soft-fail with truthful reason.
  notify(ctx, pi, { /* PluginFailedMessage with reasons: ["not in manifest"] */ });
  return;
}

const resolved = await resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot });
requireInstallable(resolved);

// Reuse install's 5-phase ledger BUT preserve the pinned version.
const ctxLocal: InstallCtx = {
  locations, cwd, marketplace, plugin,
  resolved,
  version: installed.version,  // PRESERVE the pin (ENBL-03)
  pluginDataDir: /* ... */,
  // skillsPrep/commandsPrep/agentsPrep/mcpPrep populated by phases
};
const result = await runPhases(phases, ctxLocal);
```

### Pattern 6: Closed-set `disabled` token landed in atomic-supersession lockstep

**What:** ENBL-04 mandates `disabled` as a distinct fact. The implementation lands ONE commit that simultaneously:

1. Adds `"disabled"` to `PLUGIN_STATUSES` (15 → 16) AND `STATUS_TOKENS` (21 → 22)
2. Adds `PluginDisabledMessage` variant interface to `PluginNotificationMessage` discriminated union
3. Adds a renderer arm in `renderPluginRow` (glyph: `ICON_UNINSTALLABLE` `⊘` -- reused from `will disable`)
4. Adds (skipped + "already enabled" / "already disabled") reasons to `REASONS` (29 → 31) and `BENIGN_REASONS` (so idempotent rows route to info)
5. Adds `## /claude:plugin enable` + `## /claude:plugin disable` H2 sections to `docs/output-catalog.md`
6. Extends list/info catalog sections with `disabled` row state
7. Adds matching FIXTURES entries in `tests/architecture/catalog-uat.test.ts`
8. Updates length-locks: `_l1 = 16`, `_l1s = 22`, `_l4 = 31`
9. Adds variant shape proof + negative-presence proofs in `tests/architecture/notify-types.test.ts`
10. Adds subject-first grammar proof for the new row in `tests/architecture/notify-grammar-invariant.test.ts`
11. Adds new arms to the exhaustive switches in `edge/handlers/tools.ts` and `orchestrators/plugin/list.ts::scopeOf`

**Why:** This is the v1.3/v1.10/v1.11/Phase 53 atomic-supersession lesson -- any intermediate state between the tuple bump and the variant + renderer + catalog + FIXTURES land breaks the catalog-uat byte-equality gate or the length-lock or the discriminated-union exhaustiveness. ONE commit.

### Anti-Patterns to Avoid

- **Storing `disabled: true` on the state record:** Violates SPLIT-01 (user-authored desired-state lives in config). Use the empty-resources implicit marker.
- **Calling the install path's network-reading helpers (refreshGitHubClone / DEFAULT_GIT_OPS):** Violates NFR-5. Architecture test `no-orchestrator-network.test.ts` MUST be extended to include `orchestrators/plugin/enable-disable.ts` in `FORBIDDEN_TARGETS` (Phase 53 precedent extended `orchestrators/reconcile/preview.ts`/`plan.ts`/`notify.ts`).
- **Writing config via raw `atomicWriteJson(configJsonPath, ...)`:** Violates SPLIT-02. The architecture test `config-state-write-seams.test.ts` catches this. Route through `saveConfig`.
- **Resetting the state record's `version` field on disable:** Violates ENBL-02 ("keeps its config entry AND version pin"). The pin is held in the state record's `version` (this is the "machine fact" half of SPLIT-01). Preserve it.
- **Running `resolvePluginVersion` on enable:** Would re-derive a hash version from the current cache and could SILENTLY upgrade past the user's pin. Read `state.marketplaces[mp].plugins[plugin].version` directly.
- **Routing scope or `--local` resolution outside the lock:** A concurrent flip of `enabled` on the same plugin from another process between the read and the write would be lost. Read inside the lock; patch; save before the lock releases.
- **Reusing `unavailable` for the disabled row:** Collapses two orthogonal facts (declared/enabled/available) into one. ENBL-04 explicitly forbids.
- **Reusing `skipped` for the steady-state list inventory of a disabled plugin:** Wrong tense -- `skipped` is a cascade-action outcome. Use the new `disabled` token for the list/info inventory; the enable/disable command's IDEMPOTENT case can use `skipped` + `already enabled` / `already disabled` reasons (matching the autoupdate-flip precedent).
- **Adding a new icon constant for disabled:** `ICON_UNINSTALLABLE` `⊘` already exists and is the established glyph for `will disable` (Phase 53). Reuse it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic JSON write | Hand `fs.writeFile(tmp) + rename` | `saveConfig` → `atomicWriteJson` | SPLIT-02 architecture gate; concurrent-write queue in `write-file-atomic`. |
| Cross-scope plugin resolution | Hand `loadState` calls in handler | `resolveCrossScopePluginTarget` | Returns discriminated union (resolved / other-scope / marketplace-absent); SCOPE-01 contract; existing test coverage. |
| Bridge-cascade artefact removal | Hand-roll skills/commands/agents/mcp unstage sequence | `cascadeUnstagePlugin` | Already encodes PU-1 D-02/D-03 fail-fast order; reused by uninstall. |
| Per-process state lock | Hand-roll `proper-lockfile` calls | `withStateGuard` | Cross-process safe (NFR-3); saves state.json on no-throw. |
| Manifest read | Hand-roll `readFile(manifest.json) + JSON.parse + typebox` | `loadMarketplaceManifest` | Phase 45 manifest memoization in front; NFR-8 cache. |
| Plugin resolver | Hand-roll skills/commands/agents/mcp shape inspection | `resolveStrict` + `requireInstallable` | Returns discriminated `ResolvedPluginInstallable` (NFR-7); `installable: true | false` is the proven seam. |
| User-visible output | `ctx.ui.notify` direct calls | `notify(ctx, pi, msg)` / `notifyUsageError` | IL-2 single chokepoint; ESLint BLOCK A forbids direct calls outside `shared/notify.ts`. |
| Plugin-ref parsing | Hand `string.split("@")` | `splitPluginMarketplaceRef` / `parseRequiredPluginMarketplaceRef` | Correct `indexOf("@")` semantics; existing USAGE wiring. |
| Severity routing | Hand-set `notify(..., "warning")` | Let `computeSeverity` infer from `BENIGN_REASONS` | UXG-02 (D-28-06) closed-set ladder; idempotent rows route to info automatically when reasons in `BENIGN_REASONS`. |

**Key insight:** Phase 54 is a COMPOSITION phase -- almost every piece already exists. The new code is ~1 orchestrator + 1 edge factory + 1 reconcile-planner branch + the closed-set tuple/variant/renderer/catalog/FIXTURES lockstep. Resist the urge to introduce new seams; reuse the autoupdate/install/uninstall precedents byte-for-byte where the shapes match.

## Runtime State Inventory

This is NOT a rename/refactor/migration phase. The only state-shape change is **implicit**: a recorded plugin with empty `resources.*` arrays now MEANS "currently disabled" (vs. install.ts always writing non-empty arrays). No data migration is required because:

- Pre-Phase-54 state.json records always have non-empty `resources.*` (install writes them in the statePhase; nothing else resets them).
- Phase 54 disable is the FIRST code path that produces an empty-resources state record.
- The planner's `isRecordedButDisabled` predicate is a fresh-read check; no migration needed.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | state.json: a recorded plugin with empty `resources.*` is the new "currently disabled" marker (no schema change). | None -- forward-only signal. |
| Live service config | None. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None. | None. |
| Build artifacts | None. | None. |

**Nothing found in category:** Explicitly stated above for each non-applicable category.

## Common Pitfalls

### Pitfall 54-1: Read-outside-lock race on config write-back

**What goes wrong:** A concurrent process flips `enabled: false` while we're reading `enabled: true` and patching to `enabled: true` -- the concurrent flip is silently clobbered.

**Why it happens:** Phase 56 will document the WB-01 contract ("entry-level patch of the base config file, re-read under the scope lock"); Phase 54 must comply preemptively.

**How to avoid:** `loadConfig(targetPath)` MUST happen INSIDE the `withStateGuard` closure, AFTER acquiring the state lock. The same `.state-lock` covers both the state mutation and the config read-then-patch-then-save -- a concurrent process competing for the same scope will fail the lock acquisition and retry per NFR-3.

**Warning signs:** A test that two parallel `setPluginEnabled` calls with different `enable` arguments produce a deterministic final state (last-writer-wins via lock serialization, NOT interleaved overwrite).

### Pitfall 54-2: Token + variant + renderer + catalog + FIXTURES drift

**What goes wrong:** Adding `"disabled"` to `PLUGIN_STATUSES` without simultaneously adding the variant interface breaks the type-level exhaustiveness gate in `notify-types.test.ts`. Adding the variant without the renderer arm breaks the discriminated-union narrowing in `renderPluginRow`. Adding the renderer arm without the catalog state breaks the inverse-walk orphan gate in `catalog-uat.test.ts`. Adding the catalog state without a FIXTURES entry breaks the forward-walk byte-equality.

**Why it happens:** Each test was added in different phases (v1.3 through Phase 53) to catch ONE class of drift; together they form the atomic-supersession contract.

**How to avoid:** Follow Phase 53 Plan 02's 19-file ONE-commit discipline:
1. PLUGIN_STATUSES bump + STATUS_TOKENS bump
2. variant interface + union arm
3. renderer arm
4. catalog state in `docs/output-catalog.md`
5. FIXTURES entry in `tests/architecture/catalog-uat.test.ts`
6. length-lock numeric updates in `notify-types.test.ts`
7. negative-presence proofs (`_NoCauseOnDisabled` etc.)
8. exhaustive-switch arms in `tools.ts` / `list.ts::scopeOf`
9. notify-v2 byte-equality test
10. grammar-invariant test arm

All in ONE git commit.

**Warning signs:** Any RED test on `notify-types.test.ts`, `catalog-uat.test.ts`, `notify-grammar-invariant.test.ts`, or `notify-v2.test.ts` after a partial implementation.

### Pitfall 54-3: NFR-5 network-leak through transitively imported helpers

**What goes wrong:** Importing `refreshGitHubClone` or `DEFAULT_GIT_OPS` (or anything from `platform/git.ts`) into `enable-disable.ts` violates NFR-5. The `loadMarketplaceManifest` is safe (pure cached read). `resolveStrict` is safe (filesystem only). But any cascade through `orchestrators/marketplace/shared.ts` could grow a transitive git import.

**Why it happens:** The architectural gate at `tests/architecture/no-orchestrator-network.test.ts` greps for forbidden surface tokens AT MODULE-IMPORT LEVEL. Phase 53 extended `FORBIDDEN_TARGETS` to include `preview.ts`, `plan.ts`, and `notify.ts`.

**How to avoid:** Extend `FORBIDDEN_TARGETS` in `no-orchestrator-network.test.ts` to include `orchestrators/plugin/enable-disable.ts` in the SAME commit as the new file. Verify the test goes RED if a `platform/git` import is added.

**Warning signs:** Lint-style grep gate failing or a stub test that imports the file and asserts no `DEFAULT_GIT_OPS`/`refreshGitHubClone`/`fetch`/`clone` symbols are reachable.

### Pitfall 54-4: Loss of version pin on enable

**What goes wrong:** Enable reads the manifest, calls `resolvePluginVersion` (the install path), and writes the freshly-computed hash-version back to the state record. The user's existing pin is silently superseded -- ENBL-03 violated.

**Why it happens:** install.ts:resolvePluginVersion is part of the install ledger context construction; copy-pasting the install path verbatim picks it up.

**How to avoid:** In `setPluginEnabled` enable branch, construct `InstallCtx` with `version: installed.version` (the state record's existing pin), NOT a freshly-computed version. Test fixture: enable a plugin whose state record `version = "v1.2.3"` and assert the post-enable state record `version === "v1.2.3"` (NOT a hash-version derived from the current cache).

**Warning signs:** A test where enable changes the recorded version field MUST FAIL.

### Pitfall 54-5: --local writes that fall back to base file

**What goes wrong:** `--local` specified, but `claude-plugins.local.json` doesn't yet exist; code reads `loadConfig(localPath) === absent` and "helpfully" patches the base file instead.

**Why it happens:** The merged-config view collapses base + local; a careless implementation might patch the merged shape and write it to base.

**How to avoid:** `--local` is a TARGETING signal, not a merge signal. When `local === true`:
- Target file = `locations.configLocalJsonPath` (ALWAYS).
- On `absent`: start from `{ schemaVersion: 1, plugins: { [key]: { enabled } } }` -- create the local file fresh.
- On `valid`: patch the local file's entry only.
- NEVER touch the base file.

WB-02 forward signal: assert via test that a `--local enable` against a fresh project (no `.local.json`) creates the local file and leaves `claude-plugins.json` byte-unchanged.

**Warning signs:** mtime check of the base file before/after a `--local` operation -- must be identical.

### Pitfall 54-6: Reconcile planner producing both (will install) AND (will enable) for the same plugin

**What goes wrong:** Phase 54 wires `isRecordedButDisabled` into `classifyDeclaredPlugin`. A bug in the branch ordering could classify a recorded-but-disabled-and-still-declared plugin as BOTH install (because the recorded-keys-set check uses presence) AND enable.

**Why it happens:** The Phase 53 plan.ts code path `if (!recorded) { acc.install.push(...) }` keys on the recorded set having the plugin key -- and a disabled plugin IS still in the recorded set (with empty resources). So install will not fire. But if a new contributor refactors `buildRecordedKeys` to only include plugins with non-empty resources, the branch falls through to install.

**How to avoid:** Keep `buildRecordedKeys` purely structural (records keyed by `${plugin}@${mp}` presence in `state.marketplaces[mp].plugins`). The disable/enable decision is a SECOND check inside the `recorded === true` branch. Add a test: a recorded-but-disabled plugin still in config produces EXACTLY ONE row (`will enable`), never both `will install` AND `will enable`.

**Warning signs:** A reconcile-planner test fixture where both buckets contain the same plugin key.

### Pitfall 54-7: CFG-03 abort during write-back

**What goes wrong:** User hand-edits `claude-plugins.json` to broken JSON, then runs `disable foo@bar`. The code reads `loadConfig === invalid` and -- depending on the implementation -- either crashes, silently overwrites the broken file, or proceeds to disable the plugin in state but leaves the config untouched (so on next reload reconcile re-enables it).

**Why it happens:** The CFG-03 contract is "abort, don't coerce" -- but Phase 54 must decide whether to ALSO skip the state-side artefact removal.

**How to avoid:** On `loadConfig === invalid`, abort the ENTIRE operation BEFORE entering the artefact cascade. Emit a `(failed) {invalid manifest}` row with `path.basename` (T-53-02-02 information-disclosure mitigation: NEVER emit the absolute path). State is untouched; config is untouched.

**Warning signs:** A test where an invalid-config file produces a state.json mtime change MUST FAIL.

## Code Examples

### Enable orchestrator skeleton (cache-only re-materialization)

```typescript
// Source: composed from orchestrators/plugin/install.ts + orchestrators/marketplace/autoupdate.ts (verified in session)
import { runPhases } from "../../transaction/phase-ledger.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";
import { cascadeUnstagePlugin } from "../marketplace/shared.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { resolveStrict, requireInstallable } from "../../domain/resolver.ts";
import { loadConfig, saveConfig } from "../../persistence/config-io.ts";
import { resolveCrossScopePluginTarget } from "./shared.ts";
import { notify } from "../../shared/notify.ts";

export async function setPluginEnabled(opts: EnableDisablePluginOptions): Promise<void> {
  const { ctx, pi, cwd, marketplace, plugin, enable } = opts;

  const resolution = await resolveCrossScopePluginTarget({
    cwd, marketplace, plugin,
    ...(opts.scope !== undefined && { explicitScope: opts.scope }),
  });
  if (resolution.kind === "marketplace-absent" || resolution.kind === "other-scope") {
    notify(ctx, pi, {
      kind: "marketplace-not-added",
      name: marketplace,
      ...(resolution.requestedScope !== undefined && { scope: resolution.requestedScope }),
    });
    return;
  }

  const { scope, locations } = resolution;
  const targetConfigPath = opts.local === true
    ? locations.configLocalJsonPath
    : locations.configJsonPath;

  await withStateGuard(locations, async (state) => {
    // 1. CFG-03 abort guard.
    const readResult = await loadConfig(targetConfigPath);
    if (readResult.status === "invalid") {
      notify(ctx, pi, { /* failed {invalid manifest} with path.basename */ });
      return;
    }

    // 2. Idempotency check.
    const installed = state.marketplaces[marketplace].plugins[plugin];
    const currentlyDisabled = isRecordedButDisabled(installed);
    const desiredDisabled = !enable;
    if (currentlyDisabled === desiredDisabled) {
      notify(ctx, pi, { /* skipped {already enabled|disabled} -- BENIGN, routes to info */ });
      return;
    }

    if (enable) {
      // ENABLE: cache-only re-materialization.
      const mp = state.marketplaces[marketplace];
      const manifest = await loadMarketplaceManifest(mp.manifestPath);
      const entry = manifest.plugins.find(e => e.name === plugin);
      if (entry === undefined) {
        notify(ctx, pi, { /* failed {not in manifest} */ });
        return;
      }
      const resolved = await resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot });
      requireInstallable(resolved);

      // Reuse install's 5-phase ledger; preserve the version pin.
      const ctxLocal: InstallCtx = {
        locations, cwd, marketplace, plugin, resolved,
        version: installed.version,  // ENBL-03 pin preserved
        pluginDataDir: /* ... */,
      };
      const result = await runPhases(phases, ctxLocal);
      if (!result.ok) throw result.error ?? new Error("phase ledger failed");
    } else {
      // DISABLE: cascadeUnstagePlugin + empty-resources state reset.
      const outcome = await cascadeUnstagePlugin(plugin, marketplace, locations, installed);
      if (!outcome.ok) throw outcome.cause;
      state.marketplaces[marketplace].plugins[plugin] = {
        ...installed,
        resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
        updatedAt: new Date().toISOString(),
      };
    }

    // 3. Config write-back.
    const currentConfig: ScopeConfig =
      readResult.status === "absent"
        ? { schemaVersion: 1, marketplaces: {}, plugins: {} }
        : readResult.config;
    const flatKey = `${plugin}@${marketplace}`;
    const patched: ScopeConfig = {
      ...currentConfig,
      schemaVersion: 1,
      plugins: {
        ...(currentConfig.plugins ?? {}),
        [flatKey]: { ...(currentConfig.plugins?.[flatKey] ?? {}), enabled: enable },
      },
    };
    await saveConfig(targetConfigPath, patched, locations.scopeRoot);
  });

  // 4. ONE notify per IL-2.
  notify(ctx, pi, { marketplaces: [{ /* ... installed/disabled row ... */ }] });
}
```

### Edge factory skeleton

```typescript
// Source: edge/handlers/marketplace/autoupdate.ts pattern (verified)
import { setPluginEnabled } from "../../../orchestrators/plugin/enable-disable.ts";
import { parseRequiredPluginMarketplaceRef } from "./shared.ts";
import { notifyUsageError } from "../../../shared/notify.ts";

function usageFor(enable: boolean): string {
  return enable
    ? "Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]"
    : "Usage: /claude:plugin disable <plugin>@<marketplace> [--scope user|project] [--local]";
}

export function makeEnableDisableHandler(pi: ExtensionAPI, enable: boolean) {
  const usage = usageFor(enable);
  return async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
    // Parse positional + scope + --local
    // Reject unknown flags
    const parsed = parseRequiredPluginMarketplaceRef(args, ctx, usage);
    if (parsed === undefined) return;
    const local = /* parse --local flag */;

    await setPluginEnabled({
      ctx, pi, cwd: ctx.cwd, enable,
      marketplace: parsed.marketplace,
      plugin: parsed.plugin,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
      ...(local && { local: true }),
    });
  };
}
```

### Reconcile planner Phase 53→54 hand-off wiring

```typescript
// Source: orchestrators/reconcile/plan.ts:233-245 (verified in session)
// Phase 54 modification to classifyDeclaredPlugin:
function isRecordedButDisabled(
  record: ExtensionState["marketplaces"][string]["plugins"][string],
): boolean {
  return record.resources.skills.length === 0
      && record.resources.prompts.length === 0
      && record.resources.agents.length === 0
      && record.resources.mcpServers.length === 0;
}

// Inside classifyDeclaredPlugin, the `recorded === true && !enabledExplicitFalse` branch:
if (recorded) {
  // Phase 54 hand-off: distinguish steady-state-enabled from recorded-but-disabled.
  const mpRecord = state.marketplaces[marketplace];
  const pluginRecord = mpRecord?.plugins[plugin];
  if (pluginRecord !== undefined && isRecordedButDisabled(pluginRecord)) {
    acc.enable.push({ scope, plugin, marketplace });
    return;
  }
  // else steady state -- no action.
  return;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `enabled` on STATE_SCHEMA | `enabled` on CONFIG_SCHEMA (CFG-01) + empty-resources implicit marker on state | Phase 51 (v1.12) | SPLIT-01: user-authored desired-state lives in config; machine bookkeeping in state. Phase 54 is the FIRST code path that exercises this for the enable/disable surface. |
| Hand-rolled JSON atomic write | `saveConfig` → `atomicWriteJson` (SPLIT-02 sanctioned chokepoint) | Phase 51 (v1.12) | Phase 54 routes ALL config writes through this seam. |
| Autoupdate as a state-record field | Autoupdate as a config-entry field (CFG-01) | Phase 51 (SPLIT-01 cast migration) | Phase 54-56 are charged with the rewire; Phase 54 can do the plugin-side enabled rewire and leave marketplace autoupdate to Phase 56. |
| Phase 53 placeholder Phase 54 hand-off (pluginsToEnable structurally empty) | Phase 54 wires `isRecordedButDisabled` predicate into planner | Phase 54 (this phase) | The `(will enable)` token from Phase 53 starts producing real rows. |

**Deprecated/outdated:**
- Plan-23 (v1.4) era of "render `(disabled)` via reusing existing tokens" -- superseded by ENBL-04's explicit three-orthogonal-facts contract.

## Project Constraints (from CLAUDE.md)

- **NFR-4:** Node >= 20.19.0
- **NFR-7:** Discriminated `installable: true | false` precedent -- apply the same shape to any new discriminated-union resolutions Phase 54 introduces.
- **NFR-1:** All disk mutations atomic (tmp + rename or atomic JSON write).
- **NFR-2:** No fix may require a Pi process restart; `/reload` must suffice.
- **NFR-3:** All operations must be safe to retry -- idempotent or fail-clean.
- **NFR-5:** Network required ONLY for GitHub-source `marketplace add` and `update`/`marketplace update`. `enable` MUST NOT touch network.
- **NFR-10:** Containment: refuse to write outside the scope root.
- **NFR-6:** `npm run check` must stay GREEN (typecheck + ESLint + Prettier + tests).
- **IL-2:** All user-visible messages MUST go through `ctx.ui.notify(message, severity)`.
- **IL-3:** Single sanctioned `console.warn` is the load-time legacy migration save failure -- DO NOT introduce a new one.
- **IL-4:** No telemetry V1.
- **IL-1:** English-only V1.
- **SC-1:** Two scopes only (user, project).
- **Conventional Commits + pre-commit hook discipline:** Run `pre-commit run --all-files` before committing. NEVER `--no-verify`.
- **Always `--squash` PR merges.**
- **`SKIP=trufflehog` for worktree commits** if the trufflehog hook fails inside the worktree sandbox.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Empty `resources.*` arrays is an acceptable implicit marker for "currently disabled" on the state record (preferred over a new schema field). | Pattern 4 / Alternatives Considered | If a pre-Phase-54 install ever produced an empty-resources record (e.g. a plugin manifest with zero artefacts declared), the planner would mis-classify it as `will enable`. The investigation hook: check whether `install.ts::statePhase` admits an "all-arrays-empty" outcome for a plugin that declares NOTHING. If yes, the marker needs to be strengthened (e.g. a new optional `disabled?: true` field on the state record). |
| A2 | The 5-phase ledger from `install.ts` can be reused verbatim for enable without modification beyond `version` preservation and `pluginDataDir` handling. | Pattern 5 | If install's phases have a network-dependent assumption (e.g. agent registry refresh) hidden in a deep import, NFR-5 is violated. Mitigation: extend `no-orchestrator-network.test.ts` FORBIDDEN_TARGETS to include `enable-disable.ts` -- the architectural gate catches the leak structurally. |
| A3 | `cascadeUnstagePlugin` is safe to call when `installed.resources.*` are EMPTY arrays (the disable-then-disable idempotent case is structurally caught at the idempotency check, but defense-in-depth matters). | Pattern 3 | If cascadeUnstagePlugin throws on empty inputs, the idempotency case is the only safeguard. Mitigation: test fixture explicitly exercises the case. |
| A4 | The `disabled` token + `(already enabled)` / `(already disabled)` REASONS member additions land in lockstep without breaking any existing UAT fixture byte form. | Pattern 6 | A reused-existing-fixture incidentally containing a substring like `already enabled` from a different context would break. Verify with grep over the catalog-uat FIXTURES before locking. |
| A5 | The `--local` flag does NOT need a TC-3 flag-completion arm (Phase 54 can leave it as just a known boolean flag without surfacing in the auto-completion list). | (not pulled out in catalog) | UX impact only; tab completion is a polish layer. The router still accepts the flag. |
| A6 | `withStateGuard` re-acquires the lock at retry time and the inner `loadConfig` re-reads fresh -- so concurrent `enable`/`disable` from another process either fails fast at lock acquisition (preferred) or sees the post-flip state on retry. | Pitfall 54-1 | If the lock semantics are different (e.g. fair queueing that returns the SAME stale snapshot), the read-then-patch-then-save still has a TOCTOU. Verify by reading `transaction/with-state-guard.ts:66-83` source before committing the orchestrator. |

**If this table is empty:** N/A -- this table is non-empty. Plan-phase should confirm A1-A6 before locking decisions.

## Open Questions

1. **Where exactly does the `--local` flag get parsed?**
   - What we know: `parseRequiredPluginMarketplaceRef` parses positional + `--scope`. No existing handler parses `--local`.
   - What's unclear: Whether to extend `parseRequiredPluginMarketplaceRef` (touches uninstall/update/reinstall too) or to add a SECOND parse pass for `--local` only in the enable-disable handler.
   - Recommendation: Add a local parse for `--local` in `edge/handlers/plugin/enable-disable.ts` only (mirror `parseMapModelArgs` shape but for `--local`). Phase 56 will extend the broader handlers when WB-02 lands.

2. **Idempotency message shape: row-grammar vs marketplace-row carve-out?**
   - What we know: Autoupdate idempotent flips render as `● <mp> [<scope>] <autoupdate> {already autoupdate}` (a marketplace row with marker-as-status). Phase 54 plugin enable/disable lives under a marketplace block -- the idempotent case is a PLUGIN-row `(skipped) {already enabled}` or `(skipped) {already disabled}`.
   - What's unclear: Whether the disabled-row inventory token on list/info should match the action-side idempotency reason exactly (`disabled` vs `already disabled`).
   - Recommendation: `(disabled)` is the INVENTORY token (list/info row state, NEW PLUGIN_STATUSES member); `{already disabled}` is the REASON on a `(skipped)` cascade row when the user re-runs `disable foo@bar` on an already-disabled plugin. Two different surfaces; two different tokens. Mirror autoupdate's `<no autoupdate>` marker vs `(skipped) {already no autoupdate}` reason split exactly.

3. **Should the `disabled` glyph match `will disable` (`⊘ ICON_UNINSTALLABLE`) or `unavailable` (`⊘` too)?**
   - What we know: Both `will disable` and `unavailable` already render with `⊘`. Visually, they coincide.
   - What's unclear: Whether the visual coincidence weakens ENBL-04's "render distinctly" contract.
   - Recommendation: The DISTINCT-ness lives in the STATUS TOKEN, not the glyph -- `(disabled)` vs `(unavailable)` is the discriminator the user reads. The shared glyph is acceptable (mirrors `available` and `installed` sharing `●`). Document explicitly in the catalog state intro.

4. **Does enable on a plugin whose CACHED CLONE has been corrupted/removed since install fail gracefully?**
   - What we know: `loadMarketplaceManifest` will throw `ENOENT` / read errors that classify through `narrowProbeError` to `unreadable` / `source missing`.
   - What's unclear: Whether the user gets a clear `{source missing}` reason and the state record stays in disabled state, OR enable partially commits.
   - Recommendation: Treat the manifest read failure as an enable-time abort BEFORE the ledger -- state untouched, config untouched, emit `(failed) {source missing}`. Test fixture: delete `mp.marketplaceRoot` then run enable.

5. **Is the SPLIT-01 cast cleanup in `orchestrators/plugin/list.ts` and `orchestrators/plugin/info.ts` in scope for Phase 54?**
   - What we know: STATE.md "Phase 54-56 verification item (MUST): before the config write-path lands, assert that no production site reads or writes `record.autoupdate` on state". Phase 54 is the FIRST of the three phases.
   - What's unclear: Whether Phase 54 takes ONLY the plugin-side (info/list) rewire and Phase 56 takes the marketplace-side (autoupdate orchestrator/info/list/update); OR Phase 56 takes all of it.
   - Recommendation: Phase 54 takes ONLY the rewires it needs to make `enabled` work end-to-end. Concretely: the planner's new `isRecordedButDisabled` read does not require any SPLIT-01 cleanup. The list/info `disabled` rendering reads from state (resources) and config (MergedConfig.enabled). The autoupdate read sites (`record.autoupdate`) are left to Phase 56 with WB-01. This keeps Phase 54 scoped.

## Environment Availability

Not applicable -- Phase 54 is purely code/config changes inside the existing project structure. No new tools, services, runtimes, or external CLIs.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 22+ native test runner) |
| Config file | None (running directly via `node --test`) |
| Quick run command | `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/edge/handlers/plugin/enable-disable.test.ts` |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + tests + integration) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ENBL-01 | `enable <p>@<mp>`/`disable <p>@<mp>` with `--scope` + `--local` | unit | `node --test tests/edge/handlers/plugin/enable-disable.test.ts` | ❌ Wave 0 |
| ENBL-01 | `enabled: true/false` written to config | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ❌ Wave 0 |
| ENBL-02 | Disable keeps config entry + version pin; artefacts not materialized | unit | (same orchestrator test) | ❌ Wave 0 |
| ENBL-02 | Reconcile desired-materialized = `declared AND enabled` | unit (Phase 53 planner test, extended) | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ (modification) |
| ENBL-03 | `enable` re-materializes from cache with NO network | unit + architectural | `node --test tests/architecture/no-orchestrator-network.test.ts tests/orchestrators/plugin/enable-disable.test.ts` | ✅ (extension) + ❌ Wave 0 |
| ENBL-03 | Version pin preserved on enable | unit | (orchestrator test, version-roundtrip fixture) | ❌ Wave 0 |
| ENBL-04 | `disabled` renders distinct from `unavailable` on list | unit + byte-equality | `node --test tests/shared/notify-v2.test.ts tests/architecture/catalog-uat.test.ts` | ✅ (extensions) |
| ENBL-04 | `disabled` renders distinct from `unavailable` on info | unit + byte-equality | (same) | ✅ |
| ENBL-04 | Closed-set token + catalog + FIXTURES atomic | architectural | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/notify-types.test.ts tests/architecture/notify-grammar-invariant.test.ts` | ✅ (extensions) |

### Sampling Rate

- **Per task commit:** `node --test <directly-touched-files>`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` GREEN end-to-end (typecheck + ESLint + Prettier + ~1629 unit tests + 7 integration), `pre-commit run --all-files` GREEN, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/orchestrators/plugin/enable-disable.test.ts` -- covers ENBL-01/02/03 orchestrator-level behavior
- [ ] `tests/edge/handlers/plugin/enable-disable.test.ts` -- covers ENBL-01 edge USAGE + argument parsing
- [ ] No new framework install needed (existing `node --test` covers all needed surfaces)

## Security Domain

Phase 54 is in scope for `security_enforcement: true` (the default; no per-phase override in `.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface introduced |
| V3 Session Management | no | No sessions |
| V4 Access Control | yes | NFR-10 path containment (`assertPathInside`) on `saveConfig` write |
| V5 Input Validation | yes | typebox `CONFIG_VALIDATOR.Check` on saveConfig; `parseRequiredPluginMarketplaceRef` at edge; `--local` flag validation |
| V6 Cryptography | no | No new crypto surface |
| V12 Files & Resources | yes | `loadConfig` trichotomy; CFG-03 abort on invalid manifest |
| V14 Configuration | yes | `--local` write isolation; never touch base file on local-only write |

### Known Threat Patterns for plugin lifecycle write-back

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path-traversal via crafted plugin or marketplace name | Tampering | `saveConfig` runs `assertPathInside(scopeRoot, filePath, ...)` BEFORE `atomicWriteJson`; ScopedLocations construction is pinned at `<scopeRoot>/claude-plugins.json`. |
| Race: concurrent flip clobber | Tampering | `withStateGuard` + read-inside-lock for `loadConfig`. |
| Information disclosure via absolute path in `(failed) {invalid manifest}` row | Information disclosure | T-53-02-02 mitigation: emit `path.basename(filePath)` ONLY, never the absolute path. Inherited from Phase 53. |
| Silent version-pin loss on enable (acts like a SILENT upgrade) | Tampering / unauthorized change | Version pin preserved from existing state record on enable; test fixture asserts byte-equal version field across enable round-trip. |
| Invalid-config coercion to empty desired-state | Tampering / availability | CFG-03 abort contract: `loadConfig === invalid` aborts the entire operation; state untouched; config untouched; surfaces `(failed) {invalid manifest}`. |
| Network leak via reused install path | Information disclosure | NFR-5 + `no-orchestrator-network.test.ts` FORBIDDEN_TARGETS extension to cover `enable-disable.ts`. Architectural gate at module-import level. |
| Foreign-content-owned agent removal during disable | Tampering | `cascadeUnstagePlugin` already encodes the AG-5 `AgentsUnstageFailureError` carry; disable propagates the failure through `outcome.cause` (PU-7 propagation reused). |

## Sources

### Primary (HIGH confidence)

- Codebase grep (verified in this session):
  - `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` -- the command-shape mirror target
  - `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:422` -- `applyAutoupdateFlipInPlace` reference pattern
  - `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts` -- `makeAutoupdateHandler(pi, enable)` reference
  - `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:132` -- `resolveCrossScopePluginTarget` discriminated union
  - `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- `cascadeUnstagePlugin` reuse pattern (Phase 54 disable inherits this)
  - `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:674` -- 5-phase ledger to reuse for enable cache-only re-materialization
  - `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` -- Phase 53 planner already encodes desired-materialized rule + the Phase 54 hand-off slot
  - `extensions/pi-claude-marketplace/persistence/config-io.ts` -- `loadConfig`/`saveConfig` SOLE sanctioned writer
  - `extensions/pi-claude-marketplace/persistence/config-merge.ts` -- `MergedConfig`/`loadMergedScopeConfig` provenance
  - `extensions/pi-claude-marketplace/persistence/state-io.ts:39-56` -- `PLUGIN_INSTALL_RECORD_SCHEMA` (the "currently disabled" implicit marker lives in the `resources` field)
  - `extensions/pi-claude-marketplace/shared/notify.ts` -- PLUGIN_STATUSES, REASONS, PluginNotificationMessage union, renderer
  - `extensions/pi-claude-marketplace/edge/router.ts` -- TOP_LEVEL_SUBCOMMANDS, TOP_LEVEL_USAGE, SubcommandHandlers
  - `extensions/pi-claude-marketplace/edge/completions/provider.ts` -- TC-6 plugin-ref completion mode (extend for enable/disable)
  - `tests/architecture/config-state-write-seams.test.ts` -- SPLIT-02 allow-list architecture gate
  - `tests/architecture/notify-types.test.ts:139,153` -- length-locks `_l1` (PLUGIN_STATUSES) and `_l1s` (STATUS_TOKENS)
  - `tests/architecture/no-orchestrator-network.test.ts` -- FORBIDDEN_TARGETS architecture gate (Phase 53 extended; Phase 54 extends again)
- Phase 53 Plan 02 SUMMARY (`.planning/phases/53-pure-reconcile-planner-dry-run-preview/53-02-SUMMARY.md`):
  - The Phase 54 hand-off shape (PluginWillEnableMessage variant + renderer arm + catalog state already shipped) -- structurally enables Phase 54's planner wiring with NO additional notify-types changes for the will-enable path.
  - The atomic-supersession discipline (19-file ONE commit) -- canonical precedent.
- Phase 51 Plan 02 SUMMARY (`.planning/phases/51-config-schema-persistence-state-split/51-02-SUMMARY.md`):
  - SPLIT-01 cast migration `// SPLIT-01:` markers and the Phase 54-56 rewire contract.
  - D-04 consume-time default for `enabled === undefined → true`.
- `.planning/REQUIREMENTS.md` -- ENBL-01..04 exact text.
- `.planning/STATE.md` -- Phase 53 closure + Operator Next Steps for Phase 54.
- `./CLAUDE.md` -- NFR-1..11, IL-1..4, SC-1.

### Secondary (MEDIUM confidence)

- N/A -- no external sources needed; Phase 54 is purely an internal composition phase building on first-party seams.

### Tertiary (LOW confidence)

- N/A.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- every helper verified by direct codebase grep in this session.
- Architecture: HIGH -- mirrors the autoupdate orchestrator + handler shape exactly, and the install orchestrator's ledger reuse is documented in Phase 53 Pitfall 53-4 hand-off.
- Pitfalls: HIGH -- each pitfall is anchored in an existing test gate (atomic-supersession, FORBIDDEN_TARGETS, SPLIT-02 allow-list, CFG-03 abort), and the assumptions in A1-A6 are explicit so the plan-phase can confirm before locking.

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (~30 days; the upstream surfaces this phase reads from are frozen for v1.12 -- Phase 51 closed, Phase 53 closed, Phase 52 closed; only Phase 55/56 are still pending and they consume Phase 54 outputs rather than producing inputs).
