# Phase 54: Enable/Disable Commands - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 14 (new + modified)
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `orchestrators/plugin/enable-disable.ts` (NEW) | orchestrator | request-response + transactional FS | `orchestrators/marketplace/autoupdate.ts` (shape) + `orchestrators/plugin/uninstall.ts` (cascade) + `orchestrators/plugin/install.ts` (ledger) | exact (composite) |
| `edge/handlers/plugin/enable-disable.ts` (NEW) | edge handler factory | request-response | `edge/handlers/marketplace/autoupdate.ts` (factory shape) + `edge/handlers/plugin/uninstall.ts` (ref-parsing) | exact |
| `edge/router.ts` (MOD) | router | request-response | self (extend tuple + switch + USAGE) | exact |
| `edge/register.ts` (MOD) | wiring | request-response | self (mirror `makeAutoupdateHandler(pi, true/false)` lines 92-93) | exact |
| `edge/completions/provider.ts` (MOD) | completion provider | request-response | self (extend TC-6 `PluginRefMode` + branch config) | exact |
| `orchestrators/reconcile/plan.ts` (MOD) | reconcile planner | transform | self (extend `classifyDeclaredPlugin` lines 201-266 + add `isRecordedButDisabled`) | exact |
| `shared/notify.ts` (MOD) | renderer + closed-set authority | transform | self (closed-set lockstep: PLUGIN_STATUSES + STATUS_TOKENS + REASONS + BENIGN_REASONS + variant + renderer arm) | exact |
| `docs/output-catalog.md` (MOD) | docs / fixture source | docs | self (add `## /claude:plugin enable` + `## /claude:plugin disable` H2 sections; extend list/info `disabled` row state) | exact |
| `tests/architecture/notify-types.test.ts` (MOD) | architecture test | test | self (bump `_l1` 15→16, `_l1s` 21→22, `_l4` 29→31 + variant shape + negative-presence proofs) | exact |
| `tests/architecture/catalog-uat.test.ts` (MOD) | architecture test | test | self (add FIXTURES entries) | exact |
| `tests/architecture/notify-grammar-invariant.test.ts` (MOD) | architecture test | test | self (subject-first proof for new `(disabled)` row) | exact |
| `tests/architecture/no-orchestrator-network.test.ts` (MOD) | architecture test | test | self (extend `FORBIDDEN_TARGETS` to cover `enable-disable.ts`) | exact |
| `tests/orchestrators/plugin/enable-disable.test.ts` (NEW) | orchestrator test | test | sibling `tests/orchestrators/plugin/uninstall.test.ts` + `tests/orchestrators/marketplace/autoupdate.test.ts` | role-match |
| `tests/edge/handlers/plugin/enable-disable.test.ts` (NEW) | edge test | test | sibling `tests/edge/handlers/plugin/uninstall.test.ts` + `tests/edge/handlers/marketplace/autoupdate.test.ts` | role-match |

## Pattern Assignments

### `orchestrators/plugin/enable-disable.ts` (orchestrator, transactional)

**Primary analog:** `orchestrators/marketplace/autoupdate.ts` (shape: single orchestrator parameterized by `enable: boolean`).
**Secondary analog:** `orchestrators/plugin/uninstall.ts` (cascade + cross-scope resolver + withStateGuard structure).
**Tertiary analog:** `orchestrators/plugin/install.ts` (5-phase ledger reuse for enable's re-materialization).

**Options-bag shape — copy from `orchestrators/marketplace/autoupdate.ts:77-94`:**
```typescript
export interface AutoupdateOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly name?: string;
  readonly enable: boolean;      // ← the bool that parameterizes the orchestrator
  readonly scope?: Scope;
  readonly cwd: string;
}
```
Phase 54 variant adds `readonly plugin: string`, `readonly marketplace: string`, `readonly local?: boolean`; drops `name?` (enable/disable always targets a single explicit plugin@mp).

**Header file comment — mirror `orchestrators/marketplace/autoupdate.ts:1-60`:** explicit enumeration of every outcome row (fresh enable → installed cascade; fresh disable → uninstalled-resources cascade; idempotent enable → `(skipped) {already enabled}`; idempotent disable → `(skipped) {already disabled}`; precondition failure → standalone `MarketplaceNotAddedMessage`; cache-source-missing pre-ledger abort → `(failed) {source missing}`).

**Cross-scope resolution — copy from `orchestrators/plugin/uninstall.ts:148-177`:**
```typescript
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
```
The helper is exported by `orchestrators/plugin/shared.ts:132-195` and is the discriminated SCOPE-01 chokepoint (resolved / other-scope / marketplace-absent).

**State guard + read-inside-lock — adapt `orchestrators/plugin/uninstall.ts:192-273`:**
```typescript
await withStateGuard(locations, async (state) => {
  // 1. CFG-03 abort guard (read INSIDE the lock — Pitfall 54-1).
  const readResult = await loadConfig(targetConfigPath);
  if (readResult.status === "invalid") {
    /* emit (failed) {invalid manifest} with path.basename(targetConfigPath) — never absolute path (T-53-02-02) */
    return;
  }
  // 2. Idempotency check (mirror autoupdate's already-matching arm).
  // 3. ENABLE: reuse install's 5-phase ledger with version pinned from existing record.
  // 4. DISABLE: cascadeUnstagePlugin + reset resources to empty arrays; preserve version/resolvedSource/compatibility/installedAt.
  // 5. saveConfig(targetConfigPath, patched, locations.scopeRoot).
});
```

**Cascade for disable — copy from `orchestrators/plugin/uninstall.ts:222-265`:** call `cascade(plugin, marketplace, locations, installed)` (default `cascadeUnstagePlugin` from `orchestrators/marketplace/shared.ts:316`). Diverge from uninstall: instead of `delete mp.plugins[plugin]`, mutate the record in place — reset `resources.{skills,prompts,agents,mcpServers}` to `[]`, bump `updatedAt = new Date().toISOString()`, leave `version`, `resolvedSource`, `compatibility`, `installedAt` UNCHANGED (ENBL-02 version pin).

**Enable phase-ledger reuse — copy `InstallCtx` shape and phase array from `orchestrators/plugin/install.ts:456-680`:**
- Build `ctxLocal: InstallCtx` with `version: installed.version` (PRESERVE the pin — DO NOT call `resolvePluginVersion`, see Pitfall 54-4).
- Reuse the literal-array `[skillsPhase, commandsPhase, agentsPhase, mcpPhase, statePhase]` (line 674).
- The `statePhase` block at install.ts:617-664 already writes the resources arrays; for enable, `c.version` is the existing pin.

**Manifest read pre-ledger (cache-only) — adapt from install.ts orchestrator pattern:**
```typescript
const manifest = await loadMarketplaceManifest(state.marketplaces[marketplace].manifestPath);
const entry = manifest.plugins.find(e => e.name === plugin);
if (entry === undefined) { /* (failed) {not in manifest} */ return; }
const resolved = await resolveStrict(entry, { marketplaceRoot: state.marketplaces[marketplace].marketplaceRoot });
requireInstallable(resolved);
```
Both `loadMarketplaceManifest` and `resolveStrict` are network-free (NFR-5).

**Single notify per IL-2 — copy `orchestrators/marketplace/autoupdate.ts:263-282` shape:** one terminal `notify(ctx, pi, { marketplaces: [...] })` carrying a `PluginEnabledMessage`/`PluginDisabledMessage` row, OR a `(skipped) {already enabled|disabled}` row in the idempotent case.

---

### `edge/handlers/plugin/enable-disable.ts` (edge factory, request-response)

**Analog:** `edge/handlers/marketplace/autoupdate.ts` (entire file, 55 lines).

**Imports + usage helper — copy verbatim shape from `edge/handlers/marketplace/autoupdate.ts:13-23`:**
```typescript
import { setPluginEnabled } from "../../../orchestrators/plugin/enable-disable.ts";
import { parseRequiredPluginMarketplaceRef } from "./shared.ts";
import { notifyUsageError } from "../../../shared/notify.ts";

function usageFor(enable: boolean): string {
  return enable
    ? "Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]"
    : "Usage: /claude:plugin disable <plugin>@<marketplace> [--scope user|project] [--local]";
}
```

**Factory shape — copy from `edge/handlers/marketplace/autoupdate.ts:25-54` and merge with `edge/handlers/plugin/uninstall.ts:15-33` ref-parsing:**
```typescript
export function makeEnableDisableHandler(pi: ExtensionAPI, enable: boolean) {
  const usage = usageFor(enable);
  return async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
    const parsed = parseRequiredPluginMarketplaceRef(args, ctx, usage);
    if (parsed === undefined) return;

    // --local flag parse (mirror `parsePositionalsWithFlags` shape from
    // edge/handlers/plugin/shared.ts:49-68 — a new helper or inline scan).
    // Reject unknown flags via notifyUsageError per MSG-NC-2.

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

**`--local` parsing — mirror `parsePositionalsWithFlags` from `edge/handlers/plugin/shared.ts:49-68`:** scan positionals for `--local` (boolean), reject other unknown long flags via `notifyUsageError({ message: 'Unknown flag: "..."', usage })`. Note: `parseRequiredPluginMarketplaceRef` uses `parseCommandArgs` which already extracts `--scope`; a SECOND positional scan over the leftover non-`--scope` tokens captures `--local`. Open Question #1 in RESEARCH.md leaves this as Phase-54-local; do NOT extend `parseRequiredPluginMarketplaceRef`.

---

### `edge/router.ts` (router, modify)

**Pattern source:** the file itself, lines 26-46 (SubcommandHandlers), 52-64 (TOP_LEVEL_SUBCOMMANDS), 82-93 (TOP_LEVEL_USAGE), 136-161 (switch).

**4 atomic edits:**
1. Add to `SubcommandHandlers` interface (after line 38):
   ```typescript
   enable: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
   disable: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
   ```
2. Add `"enable"`, `"disable"` to `TOP_LEVEL_SUBCOMMANDS` tuple (lines 52-64).
3. Add usage lines to `TOP_LEVEL_USAGE` (mirror lines 85-90 shape):
   ```
   enable <plugin>@<marketplace> [--scope user|project] [--local]
   disable <plugin>@<marketplace> [--scope user|project] [--local]
   ```
4. Add cases to switch (lines 136-161, mirror `case "uninstall": return handlers.uninstall(rest, ctx);` shape).

---

### `edge/register.ts` (wiring, modify)

**Pattern source:** lines 42 + 92-93 of register.ts.

**Edit — mirror the autoupdate dual-wiring exactly:**
```typescript
import { makeEnableDisableHandler } from "./handlers/plugin/enable-disable.ts";
// ...
enable: makeEnableDisableHandler(pi, true),
disable: makeEnableDisableHandler(pi, false),
```

---

### `edge/completions/provider.ts` (TC-6 completion, modify)

**Pattern source:** `pluginRefBranchConfig` (lines 174-220) + `PluginRefMode` type (line 174) + branch dispatch (line 266-270).

**Edits:**
1. Extend `PluginRefMode = "install" | "uninstall" | "update" | "reinstall" | "info" | "enable" | "disable"` (line 174).
2. Add cases to `pluginRefBranchConfig` switch (line 186-219): both `enable` and `disable` consume INSTALLED plugins (same shape as `uninstall`), with `allowMarketplaceOnly: false`.
3. No new flag completion needed for `--local` per Assumption A5 in RESEARCH.md (polish layer).

---

### `orchestrators/reconcile/plan.ts` (reconcile planner, modify)

**Pattern source:** the file itself, lines 201-266 (`classifyDeclaredPlugin`).

**Add helper above `classifyDeclaredPlugin`:**
```typescript
function isRecordedButDisabled(
  record: ExtensionState["marketplaces"][string]["plugins"][string],
): boolean {
  return record.resources.skills.length === 0
      && record.resources.prompts.length === 0
      && record.resources.agents.length === 0
      && record.resources.mcpServers.length === 0;
}
```

**Modify the `!enabledExplicitFalse && recorded` branch (lines 258-265):** instead of falling through to a steady-state no-op, check `isRecordedButDisabled(state.marketplaces[marketplace]?.plugins[plugin])` and push to `acc.enable.push({ scope, plugin, marketplace })` when true. Update the `DeclaredPluginAccumulator` interface (line 190-194) to add `readonly enable: PlannedPluginEnable[]`.

**Wire `pluginsToEnable` in the return value (line 364) — replace `pluginsToEnable: []` with `pluginsToEnable: pluginDiff.enable`.**

**Pitfall 54-6 guard:** keep `buildRecordedKeys` (lines 179-188) PURELY STRUCTURAL — a disabled plugin still appears in `recordedKeys` (presence keyed). Do NOT refactor it to exclude empty-resources records, or `install` will fire incorrectly.

---

### `shared/notify.ts` (closed-set + renderer, modify — ATOMIC lockstep)

**Pattern source:** Phase 53 commit `5402f56` is the canonical atomic-supersession precedent (PLUGIN_STATUSES 11→15, STATUS_TOKENS 15→21, 4 new variants + renderer arms, catalog + FIXTURES, length-locks, all in ONE commit).

**This phase's tuple bumps:**
- `PLUGIN_STATUSES` (line 281-297): 15 → 16, add `"disabled"`. New length: 16.
- `STATUS_TOKENS` (line 162-184): 21 → 22, add `"disabled"`. New length: 22.
- `REASONS` (line 72-102): 29 → 31, add `"already enabled"` AND `"already disabled"`. New length: 31.
- `BENIGN_REASONS` (line 129-134): add both `"already enabled"` and `"already disabled"` so idempotent rows route to `info` automatically via `computeSeverity`.

**New variants — copy `PluginUninstalledMessage` shape from line 448-453 (NO `dependencies`, NO `reasons`):**
```typescript
export interface PluginDisabledMessage {
  readonly status: "disabled";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
}
export interface PluginEnabledMessage {
  readonly status: "installed";  // OR new "enabled" — see decision below
  // ...
}
```

**Token decision for enable success row:** per RESEARCH.md "primary recommendation" and CONTEXT.md D-54-01 the `(disabled)` token is for the INVENTORY/list/info surface AND the disable-action terminal row. The enable success row reuses the `(installed)` status (state-changing variant in `shouldEmitReloadHint` set) — re-materialization IS an install. Confirm during planning if planner wants a dedicated `enabled` token; the closed-set length bumps assume ONLY `"disabled"` is added.

**Renderer arm — mirror the `uninstalled` arm at `renderPluginRow` (around line 1535):** glyph `ICON_UNINSTALLABLE` (`⊘`), reused from `will disable` (RESEARCH Pattern 6 §3). Subject-first grammar: `⊘ <name> [<scope>] (disabled)`.

**Union additions:** add `PluginDisabledMessage` to `PluginNotificationMessage` discriminated union (line 637-641 area).

**Exhaustive switch extensions:** `edge/handlers/tools.ts` and `orchestrators/plugin/list.ts::scopeOf` (RESEARCH Pattern 6 §11) — add `case "disabled"` arms.

---

### `tests/architecture/notify-types.test.ts` (length-lock bumps)

**Pattern source:** the file itself.

**Edits (full paths verified in this session):**
- Line 140: `export const _l1: _Assert_PluginStatusesLen = true;` — update the underlying `_Assert_PluginStatusesLen` literal from 15 → 16.
- Line 153: `export const _l1s: _Assert_StatusTokensLen = true;` — update from 21 → 22.
- Line 855: `export const _l4: _Assert_ReasonsLen = true;` — update from 29 → 31.
- Add variant shape proof for `PluginDisabledMessage` (mirror `PluginUninstalledMessage` proof block).
- Add negative-presence proofs (e.g., `_NoCauseOnDisabled`, `_NoReasonsOnDisabled`, `_NoDependenciesOnDisabled`).

---

### `tests/architecture/catalog-uat.test.ts` (FIXTURES extension)

**Pattern source:** the file's `FIXTURES` map.

Add fixture entries paired with new `docs/output-catalog.md` H2 sections:
- `enable-fresh`, `disable-fresh`, `enable-idempotent`, `disable-idempotent` (mirror the autoupdate-flip fixtures cited at `orchestrators/marketplace/autoupdate.ts:261-262`).
- `enable-source-missing`, `disable-invalid-config` (failure forms).
- list/info `disabled` inventory row.

---

### `tests/architecture/notify-grammar-invariant.test.ts` (modify)

**Pattern source:** the file itself.
Add subject-first proof for the new `(disabled)` row: `⊘ <name> [<scope>] (disabled)` — status token NEVER precedes the subject (operator memory constraint).

---

### `tests/architecture/no-orchestrator-network.test.ts` (FORBIDDEN_TARGETS extension)

**Pattern source:** the `FORBIDDEN_TARGETS` array (Phase 53 already extended to include `preview.ts`, `plan.ts`, `notify.ts`).

**Edit:** add `"orchestrators/plugin/enable-disable.ts"` to `FORBIDDEN_TARGETS`. The architectural grep gate forbids any `platform/git` / `DEFAULT_GIT_OPS` / `refreshGitHubClone` / `fetch` / `clone` token at module-import level in listed files (NFR-5, Pitfall 54-3).

---

### `tests/orchestrators/plugin/enable-disable.test.ts` (NEW)

**Analog:** `tests/orchestrators/marketplace/autoupdate.test.ts` (idempotency + per-scope fan-out) + `tests/orchestrators/plugin/uninstall.test.ts` (cascade outcomes + state mutation).

Required coverage per RESEARCH §Validation Architecture:
- ENBL-01: write-back to config (base vs local target).
- ENBL-02: disable preserves `version`/`compatibility`/`installedAt`; resources reset to `[]`.
- ENBL-03: enable round-trip preserves `version` (NEVER calls `resolvePluginVersion`); architecturally network-free.
- Idempotency: re-running same desired state → `(skipped) {already enabled|disabled}` at INFO severity (BENIGN_REASONS routing).
- `--local` routing: `--local enable` on fresh project creates `claude-plugins.local.json`; base file mtime UNCHANGED (Pitfall 54-5).
- CFG-03: invalid config aborts; state untouched (Pitfall 54-7).
- Enable with deleted clone: pre-ledger `(failed) {source missing}`; state and config untouched (Open Question #4).

---

### `tests/edge/handlers/plugin/enable-disable.test.ts` (NEW)

**Analog:** `tests/edge/handlers/plugin/uninstall.test.ts` (USAGE shim) + `tests/edge/handlers/marketplace/autoupdate.test.ts` (dual-form factory parameterization).

Coverage:
- Missing positional → USAGE error.
- Invalid `<plugin>@<marketplace>` → USAGE error.
- Unknown flag → USAGE error.
- `--local` flag parsed and forwarded.
- `--scope user|project` forwarded.

---

## Shared Patterns

### Pattern S1: Single orchestrator parameterized by `enable: boolean`
**Source:** `orchestrators/marketplace/autoupdate.ts:184-283` + `edge/handlers/marketplace/autoupdate.ts:25-54`.
**Apply to:** orchestrator + edge factory in this phase.
**Excerpt:** see autoupdate.ts:25-54 above. The handler builds two factory entrypoints (`makeFooHandler(pi, true)` / `makeFooHandler(pi, false)`); the orchestrator branches once internally on `enable`.

### Pattern S2: Cross-scope plugin-target resolution
**Source:** `orchestrators/plugin/shared.ts:132-195` (`resolveCrossScopePluginTarget`) — discriminated `resolved | other-scope | marketplace-absent`.
**Apply to:** any plugin lifecycle entrypoint that takes `<plugin>@<marketplace>` + optional `--scope`. Excerpt:
```typescript
const resolution = await resolveCrossScopePluginTarget({
  cwd, marketplace, plugin,
  ...(opts.scope !== undefined && { explicitScope: opts.scope }),
});
if (resolution.kind === "marketplace-absent" || resolution.kind === "other-scope") {
  notify(ctx, pi, { kind: "marketplace-not-added", name: marketplace,
    ...(resolution.requestedScope !== undefined && { scope: resolution.requestedScope }) });
  return;
}
```

### Pattern S3: Config write-back through saveConfig (SPLIT-02)
**Source:** `persistence/config-io.ts:172-185` (`saveConfig`).
**Apply to:** every config mutation. NEVER call `atomicWriteJson(configJsonPath, ...)` directly — the architecture gate `tests/architecture/config-state-write-seams.test.ts` will catch it.
```typescript
// Inside withStateGuard closure, AFTER loadConfig of the target file:
await saveConfig(targetConfigPath, patched, locations.scopeRoot);
// saveConfig runs CONFIG_VALIDATOR.Check → assertPathInside → atomicWriteJson.
```

### Pattern S4: CFG-03 trichotomy (loadConfig)
**Source:** `persistence/config-io.ts:119-155` (`loadConfig` returns `absent | invalid | valid`).
**Apply to:** every config read.
```typescript
const readResult = await loadConfig(targetFilePath);
if (readResult.status === "invalid") { /* (failed) {invalid manifest} with path.basename only — never absolute path */ return; }
const currentConfig: ScopeConfig = readResult.status === "absent"
  ? { schemaVersion: 1, marketplaces: {}, plugins: {} }
  : readResult.config;
```

### Pattern S5: withStateGuard wrap (read-inside-lock)
**Source:** Used identically at `orchestrators/plugin/uninstall.ts:193-273` and `orchestrators/marketplace/autoupdate.ts:193-204`.
**Apply to:** every state-mutating orchestrator; ALSO the config read in this phase (Pitfall 54-1).
```typescript
await withStateGuard(locations, async (state) => {
  // 1. loadConfig INSIDE the lock (TOCTOU avoidance).
  // 2. Mutate state in place.
  // 3. saveConfig before the closure returns.
  // Guard saves state.json on no-throw.
});
```

### Pattern S6: Atomic closed-set lockstep (renderer + catalog + FIXTURES)
**Source:** Phase 53 commit `5402f56` (precedent: PLUGIN_STATUSES 11→15, STATUS_TOKENS 15→21, 4 variants, 6 renderer arms, catalog + FIXTURES — ONE commit).
**Apply to:** the `(disabled)` token introduction. All 11 sites listed in RESEARCH Pattern 6 land in ONE commit.

### Pattern S7: notify chokepoint (IL-2)
**Source:** `shared/notify.ts::notify` (and `notifyUsageError`).
**Apply to:** all user-visible output. ZERO direct `ctx.ui.notify` calls outside `shared/notify.ts` (ESLint BLOCK A enforces).

### Pattern S8: Architectural network gate (NFR-5)
**Source:** `tests/architecture/no-orchestrator-network.test.ts` `FORBIDDEN_TARGETS`.
**Apply to:** new file `orchestrators/plugin/enable-disable.ts` added to `FORBIDDEN_TARGETS` in the SAME commit (Pitfall 54-3).

## No Analog Found

All files have a strong analog. None falls into the no-analog bucket.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{orchestrators,edge,persistence,shared,transaction,domain}/**` + `tests/architecture/**`.
**Files scanned:** ~30 files inspected, 8 files read for excerpt extraction (autoupdate.ts orchestrator + handler, plugin/shared.ts, plugin/uninstall.ts edge + orchestrator, install.ts, config-io.ts, router.ts, completions/provider.ts, reconcile/plan.ts, shared/notify.ts head sections).
**Pattern extraction date:** 2026-06-10
