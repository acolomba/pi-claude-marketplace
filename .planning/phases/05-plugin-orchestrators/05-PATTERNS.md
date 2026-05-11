# Phase 5: Plugin Orchestrators - Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 31 (8 NEW source, 8 EDIT-EXISTING source, 11 NEW tests, 4 EDIT-EXISTING tests, 2 doc/planning edits, plus orchestrators/index.ts barrel)
**Analogs found:** 30 / 31 (one new file -- `presentation/plugin-list.ts` -- has only a partial analog in `presentation/marketplace-list.ts`; truncation + icon legend are net-new)

This document is the planner's pattern vocabulary. For every Phase 5 file, it names a single existing analog (or two when the file straddles two patterns), points at the exact lines to copy, and lists the cross-cutting concerns the file MUST adopt without re-litigating (notify discipline, marker sourcing, `withStateGuard` composition, soft-dep helpers, D-11 boundaries).

The planner should treat each "Pattern Assignments" entry as a contract: the file's task list in PLAN.md should reference the analog file/lines verbatim and the cross-cutting rules block once.

---

## File Classification

> **Role taxonomy (Phase 5 specific):** `orchestrator` = under `orchestrators/plugin/`; `shared` = `orchestrators/plugin/shared.ts`; `presentation` = pure formatter under `presentation/`; `bridge` = bridge-tier source under `bridges/{kind}/`; `domain` = `domain/`; `transaction` = `transaction/`; `markers` = `shared/markers.ts`; `errors` = `shared/errors.ts`; `architectural-test` = under `tests/architecture/`; `unit-test` = pure-logic test; `integration-test` = uses tmp HOME / on-disk state.
>
> **Data-flow taxonomy:** `CRUD` = mutates state.json + bridge targets; `request-response` = pure function or single-shot read; `event-driven` = phase ledger callback; `transform` = data → string render; `read-only` = no disk mutations.

| New/Modified File | New/Edit | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|----------|------|-----------|----------------|---------------|
| `extensions/claude-marketplace/orchestrators/plugin/install.ts` | NEW | orchestrator | CRUD (5-phase ledger + state) | `orchestrators/marketplace/add.ts` (D-04 outer guard, MA-style record-write) + `transaction/phase-ledger.ts` (ledger consumer pattern; install is THE first production consumer per Phase 2 D-01) | composite |
| `extensions/claude-marketplace/orchestrators/plugin/uninstall.ts` | NEW | orchestrator | CRUD (cascade reuse + post-state cleanup) | `orchestrators/marketplace/remove.ts` (closest: cascade loop + post-state rm of dataDir + sourceCloneDir) -- adapt for SINGLE-plugin cascade + PU-5 silent converge + PU-7 propagation | exact |
| `extensions/claude-marketplace/orchestrators/plugin/update.ts` | NEW | orchestrator | CRUD (hand-rolled 3-phase swap + cascade-safe entrypoint) | `orchestrators/marketplace/update.ts` (closest: outer-guard + cascade + partition rendering + RH-5 WR-04 composition) -- but D-03 mandates hand-rolled 3-phase instead of the marketplace orchestrator's `withStateGuard(refresh)` shape | role-match (heterogeneous-undo deviation noted) |
| `extensions/claude-marketplace/orchestrators/plugin/list.ts` | NEW | orchestrator | read-only | `orchestrators/marketplace/list.ts` (loadState per scope + payload to renderer; NO `withStateGuard`, NO `gitOps`) -- but EXTEND with PL-5 upgradable detection (re-read manifest per marketplace, soft-fail per PL-6) | role-match (Phase 5 list adds manifest reads on top of state) |
| `extensions/claude-marketplace/orchestrators/plugin/shared.ts` | NEW | shared | request-response (pure function over state snapshot) | `orchestrators/marketplace/shared.ts::applyAutoupdateFlipInPlace` (idempotent helper that takes state + returns structured result) for `assertNoCrossPluginConflicts`; `orchestrators/marketplace/update.ts::refreshGitHubClone` for any `syncCloneOnce` memo | role-match |
| `extensions/claude-marketplace/presentation/plugin-list.ts` | NEW | presentation | transform (payload → string) | `presentation/marketplace-list.ts` (groups-by-scope, icon-prefix, byte-stable empty case, header-then-rows) -- truncate-at-66 + icon legend (●/○/⊘) + version paren + [autoupdate] header are NEW; pattern shape is identical | partial (rendering shape match; private helpers are new) |
| `extensions/claude-marketplace/domain/resolver.ts` | EDIT | domain | (schema migration + Step-7 logic) | self (modify in place); the strict resolver's Step 7 loop at lines 379-410 is the migration site | self (D-07 schema + Step-7 list union) |
| `extensions/claude-marketplace/bridges/skills/discover.ts` | EDIT | bridge | request-response | self (modify in place); the existing for-loop at lines 56-100 is the iteration site -- wrap the body in an outer `for (const skillsDir of input.resolved.componentPaths.skills)` loop | self (array iteration; first-wins dedup) |
| `extensions/claude-marketplace/bridges/commands/discover.ts` | EDIT | bridge | request-response | self + `bridges/skills/discover.ts` pattern | self |
| `extensions/claude-marketplace/bridges/agents/discover.ts` | EDIT | bridge | request-response | self (already takes `agentsDir: string`; caller now passes ONE per array element OR signature flips to array) -- prefer signature flip for symmetry with skills/commands; the existing read loop at lines 42-99 stays unchanged inside | self (signature change to plural; dedup map at caller) |
| `extensions/claude-marketplace/shared/markers.ts` | EDIT | markers | (constant addition) | self (extend in place); existing constants at lines 9-13 are the pattern | self |
| `extensions/claude-marketplace/shared/errors.ts` | EDIT | errors | (class additions) | self (extend); existing `MarketplaceDuplicateNameError` (lines 46-55) + `MarketplaceUpdateError` (lines 84-91) are the two patterns -- one-arg name and aggregate-with-cause-and-retryHint | self |
| `extensions/claude-marketplace/transaction/rollback.ts` | EDIT | transaction | request-response | self (add `instanceof PathContainmentError` short-circuit at top of `formatRollbackError`) -- mirrors the SAME bypass already present in `phase-ledger.ts` lines 86-88 for undo failures | self (single chokepoint extension) |
| `extensions/claude-marketplace/persistence/locations.ts` | EDIT (CONFIRMED EXISTS) | persistence | request-response | self; `pluginDataDir` is ALREADY present at lines 132-136 (see Pitfall below). Phase 5 only adds containment-escape test coverage; no source change required. | self (verify-existence-only) |
| `extensions/claude-marketplace/orchestrators/index.ts` | EDIT | (barrel) | (none) | `orchestrators/marketplace/index.ts` (template; mirror its 5-line per-subcommand barrel pattern at the plugin layer) | exact |
| `extensions/claude-marketplace/orchestrators/plugin/index.ts` | NEW | (barrel) | (none) | `orchestrators/marketplace/index.ts` -- copy the structure 1:1 | exact |
| `tests/orchestrators/plugin/install.test.ts` | NEW | integration-test | (tmp HOME + state seed + bridge spy) | `tests/orchestrators/marketplace/update.test.ts` (hermetic-HOME helper + NotifyRecord ctx + state seed + outcome partition assertions) + `tests/orchestrators/marketplace/cascade.test.ts` (withTmpScope + bridge pre-stage on disk) | composite |
| `tests/orchestrators/plugin/uninstall.test.ts` | NEW | integration-test | (state seed + cascade reuse + foreign-content fixture) | `tests/orchestrators/marketplace/cascade.test.ts` (closest: real cascade IO surface assertions + bogus-locations shape tests; bridge IO seeds) + `tests/orchestrators/marketplace/update.test.ts` (notify recorder + hermetic HOME) | composite |
| `tests/orchestrators/plugin/update.test.ts` | NEW | integration-test | (3-phase swap + partition outcome) | `tests/orchestrators/marketplace/update.test.ts` (D-14 sequencing assertion via gitOps mock; partition rendering; WR-04 stagedAgents threading) | exact (model after this) |
| `tests/orchestrators/plugin/list.test.ts` | NEW | integration-test | read-only | `tests/orchestrators/marketplace/list.test.ts` (closest: hermetic HOME + state seed + notify recorder; source-grep guards for NFR-5 / no-withStateGuard / no-manifest-import) | exact |
| `tests/orchestrators/plugin/shared.test.ts` | NEW | unit-test | request-response | `tests/orchestrators/marketplace/cascade.test.ts` style for one-off integration; PURE-fn unit test pattern is simpler: import the helper, build a hand-rolled ExtensionState literal, assert throw shape. Closest pure helper-test: there is no perfect analog; the closest is the rollback test (`tests/transaction/rollback.test.ts`) which hand-builds the input + asserts the thrown Error message | role-match (use rollback.test.ts shape) |
| `tests/presentation/plugin-list.test.ts` | NEW | unit-test | transform | `tests/presentation/marketplace-list.test.ts` (closest: pure renderer + payload literal + byte-for-byte string equality; will need parametric col-66 truncation cases) | exact |
| `tests/domain/resolver-comp01.test.ts` | NEW | integration-test | (fixture plugins on tmp dir) | look at `tests/domain/resolver-strict.test.ts` and `resolver-loose.test.ts` (already exist; same `ResolveContext { marketplaceRoot, readFileText, statKind }` injection pattern) | exact (same neighbor) |
| `tests/domain/resolver-strict.test.ts` | EDIT | unit-test | (update string→array assertions) | self | self |
| `tests/domain/resolver-loose.test.ts` | EDIT | unit-test | (update string→array assertions) | self | self |
| `tests/bridges/skills/discover.test.ts` | EDIT | unit-test | (array fixtures) | self | self |
| `tests/bridges/commands/discover.test.ts` | EDIT | unit-test | (array fixtures) | self | self |
| `tests/bridges/agents/discover.test.ts` | EDIT | unit-test | (signature-flip fixtures) | self | self |
| `tests/transaction/rollback.test.ts` | EDIT | unit-test | request-response | self -- add two cases mirroring existing tests at lines 20-95: PathContainmentError originalError → returns original verbatim; SymlinkRefusedError subclass → same | self |
| `tests/architecture/markers-snapshot.test.ts` | EDIT | architectural-test | (PRD prefix-equivalence) | self at lines 37-70 (one new row in the `expected` array for `RECOVERY_PLUGIN_REINSTALL_PREFIX`); but note CONTEXT.md D-04 marks this as a Phase 5 EXTENSION to the surface, not a member of the ES-5 enum -- a SEPARATE test block may be cleaner than appending to the 5-row table | self (new test block recommended) |
| `tests/architecture/no-orchestrator-network.test.ts` | NEW | architectural-test | (source-grep) | `tests/architecture/no-shell-out.test.ts` (closest: walk every `.ts` under the extension tree, regex-grep for forbidden import patterns) + `tests/orchestrators/marketplace/list.test.ts` lines 175-216 (per-file `readFile` + `stripComments` + grep for `gitOps` / `platform/git` / `DEFAULT_GIT_OPS`) | composite |
| `tests/persistence/locations.test.ts` | EDIT (only if escape case missing) | unit-test | request-response | self | self |

---

## Pattern Assignments

### `orchestrators/plugin/install.ts` (orchestrator, CRUD via 5-phase ledger)

**Analog:** composite of `orchestrators/marketplace/add.ts` (outer-guard structure + record write) + `transaction/phase-ledger.ts` (literal-array ledger callsite).

**Imports pattern** (mirror `add.ts:42-66`, replace marketplace-specific helpers with plugin-specific):
```typescript
import { mkdir, rename } from "node:fs/promises";

import { PLUGIN_MANIFEST_VALIDATOR } from "../../domain/components/plugin.ts";
import { resolveStrict, requireInstallable } from "../../domain/resolver.ts";
import { computeHashVersion } from "../../domain/version.ts";
import {
  generatedSkillName,
  generatedCommandName,
  generatedAgentName,
} from "../../domain/name.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import {
  mcpAdapterWarningIfNeeded,
  subagentWarningIfNeeded,
} from "../../presentation/soft-dep.ts";
import {
  ConcurrentInstallError,
  CrossPluginConflictError,
  appendLeaks,
  errorMessage,
} from "../../shared/errors.ts";
import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";
import { runPhases, type Phase } from "../../transaction/phase-ledger.ts";
import { formatRollbackError } from "../../transaction/rollback.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import { assertNoCrossPluginConflicts } from "./shared.ts";

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { Scope } from "../../shared/types.ts";
```

**Options interface pattern** (mirror `add.ts:68-78`):
```typescript
export interface InstallPluginOptions {
  readonly ctx: ExtensionContext;
  readonly pi?: ExtensionAPI;        // RH-5 soft-dep probe target (optional like update.ts)
  readonly scope: Scope;             // Phase 6 edge resolves --scope before calling
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
}
```

**Ledger composition pattern** (RESEARCH.md §"Pattern 2" lines 363-428 is the canonical sketch; cross-check against `phase-ledger.ts:66-104`):
```typescript
const phases: readonly Phase<InstallCtx>[] = [
  { name: "skills",   do: skillsDo,   undo: skillsUndo },
  { name: "commands", do: commandsDo, undo: commandsUndo },
  { name: "agents",   do: agentsDo,   undo: agentsUndo },
  { name: "mcp",      do: mcpDo,      undo: mcpUndo },
  { name: "state",    do: stateDo /* PI-15 sanity + state mutation; undo: noop */ },
];

await withStateGuard(locations, async (state) => {
  // PI-15 early sanity (Pitfall 2): assert plugin record absent BEFORE ledger.
  if (state.marketplaces[marketplace]?.plugins[plugin] !== undefined) {
    throw new ConcurrentInstallError(...);
  }
  const ctx: InstallCtx = { ..., stateSnapshot: state };
  const result = await runPhases(phases, ctx);
  if (!result.ok) {
    throw formatRollbackError(result, result.error!);
  }
});
```

**PI-6 guard callsite pattern** (placement: after resolver + name generation, BEFORE first bridge `prepare*`; D-05 says "BEFORE any disk write"):
```typescript
const generatedNames = {
  skills:   discoveredSkills.map(s => s.generatedName),
  commands: discoveredCommands.map(c => c.generatedName),
  agents:   discoveredAgents.map(a => a.generatedName),
};
assertNoCrossPluginConflicts(scope, generatedNames, state);  // throws CrossPluginConflictError
```

**Post-state-commit data-dir mkdir** (warning-only, AS-6 leak severity):
```typescript
try {
  await mkdir(await locations.pluginDataDir(marketplace, plugin), { recursive: true });
} catch (err) {
  notifyWarning(
    ctx,
    `Plugin "${plugin}" installed; data dir creation deferred: ${errorMessage(err)}`,
  );
}
```

**Reload-hint composition** (mirror `remove.ts:226-248` shape):
```typescript
const subagentWarn = subagentWarningIfNeeded(pi, stagedAgentNames);
const mcpWarn = mcpAdapterWarningIfNeeded(pi, stagedMcpServerNames);
let body = `Installed plugin "${plugin}" from marketplace "${marketplace}".`;
if (subagentWarn !== "") body = `${body}\n${subagentWarn}`;
if (mcpWarn !== "") body = `${body}\n${mcpWarn}`;
const hint = reloadHint("load", [plugin]);  // PI-13 verb "load"
notifySuccess(ctx, appendReloadHint(body, hint));
```

---

### `orchestrators/plugin/uninstall.ts` (orchestrator, CRUD via cascade reuse)

**Analog:** `orchestrators/marketplace/remove.ts` -- the closest analog by structure (cascade per plugin + post-state rm). Adapt for the SINGLE-plugin case and add PU-5 silent-converge + PU-7 propagation.

**Imports pattern** (mirror `remove.ts:36-48`):
```typescript
import { rm } from "node:fs/promises";

import { locationsFor } from "../../persistence/locations.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import {
  mcpAdapterWarningIfNeeded,
  subagentWarningIfNeeded,
} from "../../presentation/soft-dep.ts";
import { appendLeaks, errorMessage } from "../../shared/errors.ts";
import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import {
  cascadeUnstagePlugin,
  formatErrorWithCauses,
} from "../marketplace/shared.ts";

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { Scope } from "../../shared/types.ts";
```

**Closure pattern** (RESEARCH.md §"Pattern 4" lines 463-522 is the canonical sketch; mirror `remove.ts:69-148` for the guard structure but loop over ONE plugin):
```typescript
let alreadyGone = false;
let outcome: UnstageOutcome | undefined;
await withStateGuard(locations, async (state) => {
  const mp = state.marketplaces[marketplace];
  if (mp === undefined) { alreadyGone = true; return; }
  const installed = mp.plugins[pluginName];
  if (installed === undefined) {        // PU-5 silent converge
    alreadyGone = true;
    return;
  }
  outcome = await cascadeUnstagePlugin(pluginName, marketplace, locations, installed);
  if (!outcome.ok) throw outcome.cause!;
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete mp.plugins[pluginName];
});
```

**Post-state data-dir cleanup** (mirror `remove.ts:152-185` but limited to plugin data dir; D-08 says cleanup AFTER state commit; PU-4 says leaks → warning):
```typescript
const cleanupLeaks: (string | undefined)[] = [];
try {
  await rm(await locations.pluginDataDir(marketplace, pluginName), {
    recursive: true,
    force: true,
  });
} catch (err) {
  cleanupLeaks.push(`plugin data ${marketplace}/${pluginName}: ${errorMessage(err)}`);
}
const realLeaks = cleanupLeaks.filter((l): l is string => l !== undefined);
if (realLeaks.length > 0) {
  notifyWarning(ctx, appendLeaks(new Error("Plugin removed; cleanup partial."), realLeaks).message);
}
```

**PU-7 propagation:** `cascadeUnstagePlugin` already throws `AgentsUnstageFailureError` when foreign content is detected (see `shared.ts:184-198`). The catch path here ends in `notifyError(ctx, formatErrorWithCauses(err), err)` (mirror `remove.ts:208-222`).

**PU-8 reload hint gate** (only when ≥1 resource actually dropped):
```typescript
const anyDropped =
  outcome!.dropped.skills.length > 0 ||
  outcome!.dropped.commands.length > 0 ||
  outcome!.dropped.agents.length > 0 ||
  outcome!.dropped.mcpServers.length > 0;
const hint = reloadHint("drop", anyDropped ? [pluginName] : []);
```

---

### `orchestrators/plugin/update.ts` (orchestrator, CRUD via hand-rolled 3-phase swap)

**Analog (primary structure):** `orchestrators/marketplace/update.ts` -- mirror its `(updateMarketplace, updateAllMarketplaces)` paired entrypoints, partition-rendering helper, and WR-04 RH-5 composition.

**Analog (3-phase swap shape):** D-03 mandates HAND-ROLLED, NOT `runPhases`. RESEARCH.md §"Pattern 1" lines 281-359 is the canonical sketch.

**Paired entrypoint pattern** (mirror `orchestrators/marketplace/update.ts:126-185`):
```typescript
// PluginUpdateFn-conformant single-plugin updater (cascade-safe; never throws).
export const updateSinglePlugin: PluginUpdateFn = async (plugin, marketplace, scope) => {
  // ... 3-phase swap; catch → PluginUpdateOutcome.partition='failed' (PUP-9 cascade path)
};

// Direct top-level entrypoint (PUP-1 bare/`@mp`/`pl@mp`); throws via notifyError on phase-2-or-earlier failures.
export async function updatePlugins(opts: UpdatePluginsOptions): Promise<void> {
  // ... enumerate targets per PUP-1; syncCloneOnce per marketplace via gitOps; loop calling updateSinglePlugin
}
```

**`syncCloneOnce` memo pattern** (PUP-2; do NOT re-fetch the same marketplace clone; mirror the D-14 fetch+forceUpdateRef+checkout sequence at `orchestrators/marketplace/update.ts:393-467`):
```typescript
const synced = new Set<string>();
async function syncCloneOnce(marketplace: string, locations: ScopedLocations): Promise<void> {
  if (synced.has(marketplace)) return;
  synced.add(marketplace);
  // call gitOps.fetch + forceUpdateRef + checkout (delegate to a refresh helper)
}
```

**Phase 1 (prepare): sequential prepare + abort-already-prepared on throw** (Pitfall 1 -- guard each `abortPrepared*` with `if (handles.X !== undefined)`):
```typescript
const prepHandles: Partial<PrepHandles> = {};
try {
  prepHandles.skills   = await prepareStageSkills({ ... });
  prepHandles.commands = await prepareStageCommands({ ... });
  prepHandles.agents   = await prepareStagePluginAgents({ ... });
  prepHandles.mcp      = await prepareStageMcpServers({ ... });
} catch (err) {
  const leaks: (string | undefined)[] = [];
  if (prepHandles.mcp)      abortPreparedMcp(prepHandles.mcp);
  if (prepHandles.agents)   leaks.push(await abortPreparedAgents(prepHandles.agents));
  if (prepHandles.commands) await abortPreparedCommands(prepHandles.commands);
  if (prepHandles.skills)   await abortPreparedSkills(prepHandles.skills);
  throw appendLeaks(err, leaks);
}
```

**Phase 2 (state-guard swap with old-resource snapshot capture)** -- ST-9 concurrent change throw inside the closure:
```typescript
let oldResources: PluginRecord["resources"];
await withStateGuard(locations, async (state) => {
  const record = state.marketplaces[mp].plugins[plugin];
  if (record === undefined) throw new ConcurrentChangeError(...);
  if (record.version !== fromVersion) throw new ConcurrentChangeError(...);
  oldResources = record.resources;
  record.resources = { /* mapped from prepHandles.*.result.recorded */ };
  record.version = toVersion;
  record.updatedAt = new Date().toISOString();
});
```

**Phase 3a (physical replace, aggregate failures, continue across bridges):**
```typescript
const phase3aFailures: Phase3Failure[] = [];
for (const [name, commit] of [
  ["skills",   () => commitPreparedSkills(prepHandles.skills!)],
  ["commands", () => commitPreparedCommands(prepHandles.commands!)],
  ["agents",   () => commitPreparedAgents(prepHandles.agents!)],
  ["mcp",      () => commitPreparedMcp(prepHandles.mcp!)],
] as const) {
  try { await commit(); }
  catch (err) {
    phase3aFailures.push({ phase: name, msg: errorMessage(err), cause: err });
  }
}
```

**Phase 3b (recovery-hint composition on phase-3a failure):**
```typescript
if (phase3aFailures.length > 0) {
  const recoveryHint = `${RECOVERY_PLUGIN_REINSTALL_PREFIX} "${plugin}".`;
  const aggregate = new PluginUpdatePhase3Error(
    `Plugin "${plugin}" update failed during physical replace.\n${recoveryHint}`,
    phase3aFailures,
  );
  notifyError(ctx, formatErrorWithCauses(aggregate), aggregate);
  return { partition: "failed", name: plugin, notes: [errorMessage(aggregate)] };
}
```

**WR-04 RH-5 threading** (success path -- mirror `orchestrators/marketplace/update.ts:332-354` -- the stagedAgents/stagedMcpServers fields on `PluginUpdateOutcome` are EXACTLY for this):
```typescript
return {
  partition: "updated",
  name: plugin,
  fromVersion,
  toVersion,
  stagedAgents: prepHandles.agents!.result.recorded.map(r => r.generatedName),
  stagedMcpServers: prepHandles.mcp!.result.recorded.map(r => r.generatedName),
};
```

**PUP-9 cascade-vs-direct severity routing:** `updateSinglePlugin` (PluginUpdateFn) NEVER throws -- catches into `partition: 'failed'`. The top-level `updatePlugins` direct entrypoint, when phase-2-or-earlier throws, calls `notifyError(ctx, ...)` (error severity).

---

### `orchestrators/plugin/list.ts` (orchestrator, read-only with manifest soft-fail)

**Analog:** `orchestrators/marketplace/list.ts` (lines 37-63). Mirror the `scopes: readonly Scope[] = opts.scope !== undefined ? [opts.scope] : ["user", "project"]` enumeration + per-scope `loadState`. EXTEND with per-marketplace manifest re-read (for PL-5 upgradable detection) wrapped in try/catch (PL-6 soft-fail).

**Imports pattern** (mirror `orchestrators/marketplace/list.ts:19-27` and ADD manifest loader):
```typescript
import { readFile } from "node:fs/promises";

import { MARKETPLACE_VALIDATOR } from "../../domain/manifest.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { renderPluginList } from "../../presentation/plugin-list.ts";
import { notifySuccess } from "../../shared/notify.ts";

import type { PluginListPayload } from "../../presentation/plugin-list.ts";
import type { Scope } from "../../shared/types.ts";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
```

**Flow pattern:**
```typescript
export async function listPlugins(opts: ListPluginsOptions): Promise<void> {
  const scopes: readonly Scope[] = opts.scope !== undefined ? [opts.scope] : ["user", "project"];
  const payload: PluginListPayload = { marketplaces: [] };
  const warnings: string[] = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    const state = await loadState(locations.extensionRoot);
    for (const [mpName, mp] of Object.entries(state.marketplaces)) {
      let manifest: ManifestForList | undefined;
      try {
        manifest = await loadManifest(mp.manifestPath);  // PL-5 upgradable input
      } catch (err) {
        warnings.push(`could not load manifest: ${errorMessage(err)}`);  // PL-6 soft-fail
      }
      payload.marketplaces.push(toListEntry(mp, scope, manifest));
    }
  }
  notifySuccess(opts.ctx, renderPluginList(payload, warnings));
}
```

**Source-grep guards (mirror `tests/orchestrators/marketplace/list.test.ts:198-216`)** -- `list.ts` MUST NOT import `platform/git` / `DEFAULT_GIT_OPS` / `gitOps` / `withStateGuard`. The Phase 5 source-grep tests under `tests/orchestrators/plugin/list.test.ts` reproduce this pattern.

---

### `orchestrators/plugin/shared.ts` (shared helper module)

**Analog:** `orchestrators/marketplace/shared.ts::applyAutoupdateFlipInPlace` (lines 257-291) -- the closest pattern is "pure function over a state snapshot, returns a structured result, mutates in place when the caller is inside a `withStateGuard` closure."

**`assertNoCrossPluginConflicts` pattern** (RESEARCH.md §"Pattern 3" lines 432-459 is the canonical sketch):
```typescript
export function assertNoCrossPluginConflicts(
  scope: Scope,
  generatedNames: { skills: readonly string[]; commands: readonly string[]; agents: readonly string[] },
  state: ExtensionState,
): void {
  const conflicts: string[] = [];
  const seen = {
    skills:   new Map<string, string>(),
    commands: new Map<string, string>(),
    agents:   new Map<string, string>(),
  };
  for (const mp of Object.values(state.marketplaces)) {
    for (const [pluginName, plugin] of Object.entries(mp.plugins)) {
      for (const n of plugin.resources.skills)   seen.skills.set(n, pluginName);
      for (const n of plugin.resources.prompts)  seen.commands.set(n, pluginName);
      for (const n of plugin.resources.agents)   seen.agents.set(n, pluginName);
      // MCP EXCLUDED per PRD §6.5
    }
  }
  for (const n of [...generatedNames.skills].sort())
    if (seen.skills.has(n))   conflicts.push(`skill "${n}" already owned by plugin "${seen.skills.get(n)!}"`);
  for (const n of [...generatedNames.commands].sort())
    if (seen.commands.has(n)) conflicts.push(`command "${n}" already owned by plugin "${seen.commands.get(n)!}"`);
  for (const n of [...generatedNames.agents].sort())
    if (seen.agents.has(n))   conflicts.push(`agent "${n}" already owned by plugin "${seen.agents.get(n)!}"`);
  if (conflicts.length > 0) throw new CrossPluginConflictError(conflicts);
}
```

**Cross-scope independence (Phase 2 D-10):** the loop reads `state.marketplaces` from the SAME-scope state only. The caller passes the loaded-this-scope state. Tests assert other-scope plugins do NOT conflict.

---

### `presentation/plugin-list.ts` (pure formatter)

**Analog:** `presentation/marketplace-list.ts` (lines 1-74). Mirror the structure:
1. `ICON` constant at module top.
2. `MarketplaceListEntry` interface declared LOCALLY (D-11: `presentation/` cannot import from `persistence/`); for Phase 5, declare `PluginListEntry` and `PluginListPayload` locally with the minimal structural shape needed.
3. Single exported `renderPluginList(payload, warnings)` returning a string.
4. Empty-payload returns a byte-stable sentinel (mirror line 40-42).
5. Grouped by scope (mirror lines 44-72) -- here Phase 5 groups by `(scope, marketplace)` with `[autoupdate]` header tag (PL-7).

**Column-66 truncation private helper** (NOT exported; CONTEXT.md D-06 corollary):
```typescript
function truncateColumn66(s: string): string {
  if (s.length <= 66) return s;
  return s.slice(0, 63) + "...";  // confirm against PRD §5.3.1
}
```

**Icon table** (PL-4; reuse the `●` constant pattern from `marketplace-list.ts:32`):
```typescript
const ICON_INSTALLED = "●";
const ICON_AVAILABLE = "○";
const ICON_UNINSTALLABLE = "⊘";
```

**Manifest-soft-fail warning rendering** (PL-6 -- the orchestrator collects `warnings: string[]`; the renderer prepends each as `[warning] could not load manifest: <reason>` lines):
```typescript
const lines: string[] = [];
for (const w of warnings) lines.push(`[warning] ${w}`);
// ... then per-marketplace headers + per-plugin entries
```

**Test analog:** `tests/presentation/marketplace-list.test.ts` is the exact unit-test shape: pure renderer + payload literal + `assert.equal(renderPluginList(...), expected)` byte-for-byte.

---

### `domain/resolver.ts` EDIT (D-07 / COMP-01 supplement-not-replace)

**In-place edit, two surgical changes**:

1. **`ComponentPathsSchema` shape change** (lines 36-40):
   ```typescript
   const ComponentPathsSchema = Type.Object({
     skills:   Type.Array(Type.String()),   // was: Type.Optional(Type.String())
     commands: Type.Array(Type.String()),
     agents:   Type.Array(Type.String()),
   });
   ```
   `Type.Array(...)` keeps TypeBox JIT compile shape compatible (readonly array of strings).

2. **`PartialResolution.componentPaths` shape** (line 148) -- change from `{ skills?: string; commands?: string; agents?: string }` to `{ skills: string[]; commands: string[]; agents: string[] }`; initialize to empty arrays in `emptyResolution()` (line 152-160).

3. **`resolveStrict` Step 7 union logic** (lines 379-410) -- REPLACE the if/else-if/else chain with a UNION accumulator:
   ```typescript
   for (const kind of SUPPORTED_COMPONENT_KINDS) {
     const seenPaths = new Set<string>();
     // Declared paths: entry > manifest (D-07 supersession of PR-4 -- supplement, not short-circuit)
     const fromEntry = readPathOrArray((entry as Record<string, unknown>)[kind]);
     const fromManifest = readPathOrArray(manifest?.[kind]);
     for (const raw of [...fromEntry, ...fromManifest]) {
       const v = await validateComponentPath(kind, raw, pluginRoot);
       if (v.ok) {
         if (!seenPaths.has(v.relative)) {
           seenPaths.add(v.relative);
           partial.componentPaths[kind].push(v.relative);
         }
       } else {
         partial.notes.push(v.reason);
         dirty = true;
       }
     }
     // Implicit-by-convention: always check, dedupe against declared paths.
     if ((await statKindOf(ctx)(path.join(pluginRoot, kind))) === "dir") {
       if (!seenPaths.has(kind)) {
         partial.componentPaths[kind].push(kind);
         seenPaths.add(kind);
       }
     }
     if (partial.componentPaths[kind].length > 0) partial.supported.push(kind);
   }
   ```

4. **`resolveLoose` Step 7** (lines 478-500) -- entry-only; populate arrays with single entry; do NOT detect implicit-by-convention; manifest declaration without entry stays a conflict.

5. **`validateComponentPath`** -- the "array form rejected" guard at lines 325-327 must be REMOVED for the strict path (since arrays are now valid input via TOP-LEVEL Type.Array); keep the per-element validation. Add an array-detection coercion in `readPathOrArray`.

**Test coupling:** `tests/domain/resolver-strict.test.ts` + `tests/domain/resolver-loose.test.ts` -- every assertion `componentPaths.skills === "skills"` must become `componentPaths.skills === ["skills"]` (or `.deepEqual([...])`).

---

### `bridges/{skills,commands,agents}/discover.ts` EDIT (array iteration)

**Skills/commands discover -- analog: self** (skills lines 32-101, same shape for commands):

Wrap the existing single-dir loop in an OUTER loop over the array. Use a `Map<generatedName, sourcePath>` to dedup with first-wins semantics; emit a warning string to a parallel `failed[]` (or `warnings[]`) channel on duplicates.

```typescript
export async function discoverPluginSkills(input: {
  pluginName: string;
  resolved: ResolvedPluginInstallable;
}): Promise<readonly DiscoveredSkill[]> {
  const seenByGenerated = new Map<string, DiscoveredSkill>();
  for (const skillsDir of input.resolved.componentPaths.skills) {  // array now
    // ... existing readdir + lstat + assertSafeName loop ...
    for (const candidate of /* per-entry */) {
      if (seenByGenerated.has(candidate.generatedName)) continue;  // first-wins
      seenByGenerated.set(candidate.generatedName, candidate);
    }
  }
  return [...seenByGenerated.values()];
}
```

**Agents discover -- analog: self** (lines 35-100): change signature from `agentsDir: string` to `agentsDirs: readonly string[]` (so callers can pass the array directly), OR keep single-dir and have orchestrators loop externally. RESEARCH.md line 257 prefers signature change for symmetry. The inner loop body (lines 56-99) stays unchanged.

**Within-plugin source-name collision (RN-6):** ALREADY enforced by `domain/name.ts`'s `assertNoSkillCollisions` / equivalent; not changed here.

---

### `shared/markers.ts` EDIT (new prefix constant)

**Analog: self** (lines 9-13). Single-line addition:

```typescript
/**
 * PUP-6 recovery hint (Phase 5 extension beyond ES-5).
 * Stable user-contract prefix; the runtime caller appends `"${plugin}".` after.
 */
export const RECOVERY_PLUGIN_REINSTALL_PREFIX = "plugin-uninstall + plugin-install for";
```

**Why placement here:** D-04 mandates `shared/markers.ts` as the single chokepoint. JSDoc explicitly notes this is NOT in the ES-5 enum (PUP-6 is a Phase 5 extension, not in §6.12).

---

### `shared/errors.ts` EDIT (new error classes)

**Analog: self** -- two existing patterns to mirror:

**Pattern A: simple-message constructor** (mirror `MarketplaceDuplicateNameError` at lines 46-55):
```typescript
export class CrossPluginConflictError extends Error {
  readonly conflicts: readonly string[];
  constructor(conflicts: readonly string[]) {
    super(`Cross-plugin name conflict:\n${conflicts.map(c => `  - ${c}`).join("\n")}`);
    this.name = "CrossPluginConflictError";
    this.conflicts = conflicts;
  }
}

export class ConcurrentInstallError extends Error {
  constructor(plugin: string, marketplace: string) {
    super(`Plugin "${plugin}" was installed concurrently in marketplace "${marketplace}".`);
    this.name = "ConcurrentInstallError";
  }
}

export class ConcurrentUninstallError extends Error {
  constructor(plugin: string) {
    super(`Plugin "${plugin}" already uninstalled.`);
    this.name = "ConcurrentUninstallError";
  }
}
```

**Pattern B: aggregate-with-cause-and-payload** (mirror `MarketplaceUpdateError` at lines 84-91):
```typescript
export interface Phase3Failure {
  readonly phase: "skills" | "commands" | "agents" | "mcp";
  readonly msg: string;
  readonly cause: unknown;
}

export class PluginUpdatePhase3Error extends Error {
  readonly failures: readonly Phase3Failure[];
  constructor(message: string, failures: readonly Phase3Failure[]) {
    super(message);
    this.name = "PluginUpdatePhase3Error";
    this.failures = failures;
  }
}
```

---

### `transaction/rollback.ts` EDIT (PI-14 bypass at the chokepoint)

**Analog: self** (lines 30-39); also mirror the SAME bypass already in `phase-ledger.ts:86-88` (undo failures with PathContainmentError re-throw).

**Edit:**
```typescript
import { ROLLBACK_PARTIAL } from "../shared/markers.ts";
import { PathContainmentError } from "../shared/path-safety.ts";  // NEW import

import type { RunPhasesResult } from "./phase-ledger.ts";

export function formatRollbackError(result: RunPhasesResult, originalError: Error): Error {
  // D-02 / PI-14: PathContainmentError (and SymlinkRefusedError subclass)
  // MUST NOT be folded into the (rollback partial: ...) marker. Single
  // chokepoint for the bypass -- every mutating orchestrator inherits.
  if (originalError instanceof PathContainmentError) {
    return originalError;
  }
  if (result.rollbackPartials.length === 0) return originalError;
  const partialBody = result.rollbackPartials.map(p => `[${p.phase}] ${p.msg}`).join("; ");
  const marker = `${ROLLBACK_PARTIAL}${partialBody})`;
  return new Error(`${originalError.message} ${marker}`, { cause: originalError });
}
```

**Test coupling:** `tests/transaction/rollback.test.ts` already follows a 5-case pattern (lines 20-95). Add two cases mirroring the existing shape: case (a) `PathContainmentError` originalError → `assert.strictEqual(got, original)` AND `assert.equal(got.message.includes(ROLLBACK_PARTIAL), false)`; case (b) `SymlinkRefusedError` (subclass of `PathContainmentError`) → identical assertions.

---

### `tests/orchestrators/plugin/*.test.ts` (integration tests)

**Analog (test scaffolding):** `tests/orchestrators/marketplace/update.test.ts` (lines 1-60). The `makeCtx()` + `withHermeticHome()` helpers are the canonical pattern.

**Imports + helpers** (copy verbatim):
```typescript
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

// ... orchestrator imports ...

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

interface NotifyRecord { message: string; severity?: string; }

function makeCtx(): { ctx: ExtensionContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
    pi: { getAllTools: (): unknown[] => [] },
  } as unknown as ExtensionContext;
  return { ctx, notifications };
}

async function withHermeticHome<T>(
  fn: (env: { home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "plugin-X-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "plugin-X-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ home, cwd });
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}
```

**State seed pattern** (mirror `update.test.ts:72-104` `seedGithubMarketplace`; for plugin tests seed `mp.plugins[name] = makePluginRecord({...})` -- see `update.test.ts:106-115`).

**Bridge IO + cascade reuse pattern (for uninstall):** mirror `tests/orchestrators/marketplace/cascade.test.ts:64-83`: pre-stage a real skill at `<skillsTargetDir>/hello-greet/SKILL.md`, then assert the cascade dropped it.

**Source-grep architectural assertion** (for `list.test.ts` and other read-only orchestrators -- mirror `tests/orchestrators/marketplace/list.test.ts:175-216`):
```typescript
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("NFR-5: list source has zero gitOps surface", async () => {
  const src = await readFile("extensions/claude-marketplace/orchestrators/plugin/list.ts", "utf8");
  const code = stripComments(src);
  assert.equal(code.includes("platform/git"), false);
  assert.equal(code.includes("DEFAULT_GIT_OPS"), false);
  assert.equal(code.includes("gitOps"), false);
});
```

**Pitfall guard for header comments:** `stripComments` is REQUIRED -- the source files include header docstrings that may MENTION the forbidden symbols (as in `tests/orchestrators/marketplace/list.test.ts:188-196`). Without `stripComments` the assertion fails on prose.

---

### `tests/architecture/markers-snapshot.test.ts` EDIT

**Analog: self** (lines 37-70). CONTEXT.md D-04 specifies the new marker is a PHASE 5 EXTENSION beyond ES-5 (not in the §6.12 enum). RECOMMENDED: add a SEPARATE test block (mirror the AG-5 block at lines 88-94), not a 6th row in the `expected` table:

```typescript
test("PUP-6 recovery-hint prefix is byte-for-byte 'plugin-uninstall + plugin-install for'", () => {
  assert.equal(
    markers.RECOVERY_PLUGIN_REINSTALL_PREFIX,
    "plugin-uninstall + plugin-install for",
  );
});
```

This avoids breaking the `assert.equal(literals.length, 5, ...)` assertion at line 41-45.

---

### `tests/architecture/no-orchestrator-network.test.ts` NEW (architectural source-grep)

**Analog: composite** of `tests/architecture/no-shell-out.test.ts` (closest -- walk every `.ts` under the extension tree, regex-grep for forbidden imports) and `tests/orchestrators/marketplace/list.test.ts:175-216` (per-file readFile + stripComments + grep for `gitOps`).

**Imports + walker** (copy verbatim from `no-shell-out.test.ts:1-38`).

**Forbidden patterns** (the NFR-5 / PI-2 / PL-3 architectural surface):
```typescript
const FORBIDDEN_TARGETS = [
  "extensions/claude-marketplace/orchestrators/plugin/install.ts",
  "extensions/claude-marketplace/orchestrators/plugin/list.ts",
];
const FORBIDDEN_PATTERNS: ReadonlyArray<RegExp> = [
  /from\s+["'][^"']*platform\/git[^"']*["']/,
  /\bDEFAULT_GIT_OPS\b/,
  /\bgitOps\b/,
];

test("NFR-5 + PI-2 + PL-3: install + list orchestrators have zero gitOps surface", async () => {
  for (const rel of FORBIDDEN_TARGETS) {
    const src = await readFile(path.join(REPO_ROOT, rel), "utf8");
    const code = stripComments(src);
    for (const pat of FORBIDDEN_PATTERNS) {
      assert.equal(pat.test(code), false, `${rel} matches ${String(pat)}`);
    }
  }
});
```

---

### `tests/domain/resolver-comp01.test.ts` NEW (D-07 supplement-not-replace verification)

**Analog: neighbor** -- `tests/domain/resolver-strict.test.ts` (existing). Use the same `ResolveContext` injection pattern with `marketplaceRoot`, `readFileText`, `statKind` callbacks (matching the resolver's exported `ResolveContext` interface at `domain/resolver.ts:80-84`).

**3-fixture pattern** (CONTEXT.md §"Specific Ideas"):
```typescript
test("COMP-01 fixture a: only default skills/ exists; no manifest field -- array is ['skills']", async () => {
  const ctx: ResolveContext = {
    marketplaceRoot: "/mp",
    statKind: (p) => p.endsWith("/plugins/p1/skills") ? Promise.resolve("dir") : Promise.resolve(null),
    readFileText: () => Promise.reject(new Error("no manifest")),
  };
  const r = await resolveStrict({ name: "p1", source: "./plugins/p1" } as PluginEntry, ctx);
  assert.equal(r.installable, true);
  if (r.installable) assert.deepEqual(r.componentPaths.skills, ["skills"]);
});

test("COMP-01 fixture b: custom-only; manifest declares ['custom/skills'] and default does NOT exist", async () => { /* ... */ });

test("COMP-01 fixture c: BOTH; manifest declares ['custom/skills'] AND default skills/ exists -- UNION", async () => {
  // expect: componentPaths.skills === ['custom/skills', 'skills']
});
```

---

## Shared Patterns

### Pattern S-1: User-output channel discipline (D-07 / IL-2)

**Source:** `extensions/claude-marketplace/shared/notify.ts` (lines 21-47).
**Apply to:** EVERY new orchestrator file (`install.ts`, `uninstall.ts`, `update.ts`, `list.ts`); the `presentation/plugin-list.ts` formatter MUST NOT touch `ctx`.

```typescript
import { notifySuccess, notifyWarning, notifyError } from "../../shared/notify.ts";

// Success path (default severity, no second arg to ctx.ui.notify).
notifySuccess(ctx, `Installed plugin "${plugin}".`);

// Partial-success or post-commit leak (warning severity).
notifyWarning(ctx, `Plugin installed; cleanup partial: ${detail}`);

// Operation did not succeed; state unchanged or fully rolled back. Optional cause feeds Error.cause.
notifyError(ctx, formatErrorWithCauses(err), err);
```

**Lint enforcement:** ESLint `no-restricted-syntax` rule (see CONTEXT.md). Direct `ctx.ui.notify(...)` calls outside `shared/notify.ts` are linter errors. The single sanctioned `console.warn` is the load-time legacy-migration save failure (IL-3, not in Phase 5 scope).

### Pattern S-2: Marker-constant sourcing (D-04 / D-08)

**Source:** `extensions/claude-marketplace/shared/markers.ts` (5 existing + 1 new constant).
**Apply to:** EVERY new file that mentions user-contract strings.

```typescript
// Reload hint prefix:
import { RELOAD_HINT_PREFIX } from "../../shared/markers.ts";

// PUP-6 recovery hint composed in update.ts:
import { RECOVERY_PLUGIN_REINSTALL_PREFIX } from "../../shared/markers.ts";
const hint = `${RECOVERY_PLUGIN_REINSTALL_PREFIX} "${plugin}".`;
```

**Enforcement:** `tests/architecture/markers-snapshot.test.ts` -- the snapshot test fails loudly if any marker literal drifts vs PRD §6.12 (and now vs PUP-6).

### Pattern S-3: `withStateGuard` outer composition (Phase 2 D-02)

**Source:** `extensions/claude-marketplace/transaction/with-state-guard.ts` (lines 52-60).
**Apply to:** install (wraps `runPhases`), uninstall (wraps cascade + state delete), update phase-2 (wraps the swap).

```typescript
await withStateGuard(locations, async (state) => {
  // ST-7: load fresh, mutate in place, save only on no-throw.
  // ST-8/ST-9: caller-supplied invariants checked INSIDE the closure.
});
```

**Concurrency scope:** intra-process only (see `with-state-guard.ts:5-10` docstring). Cross-process byte-safety lives in `write-file-atomic` underneath.

### Pattern S-4: Soft-dep warning composition (RH-3..5)

**Source:** `extensions/claude-marketplace/presentation/soft-dep.ts` (lines 73-99).
**Apply to:** install (PI-11/12), update (RH-5 phase-3b), uninstall (when agents/mcp were dropped).

```typescript
import { subagentWarningIfNeeded, mcpAdapterWarningIfNeeded } from "../../presentation/soft-dep.ts";

// Helpers take ExtensionAPI, NOT ExtensionContext (see soft-dep.ts:9-17).
const subagentWarn = subagentWarningIfNeeded(pi, stagedAgentNames);
const mcpWarn = mcpAdapterWarningIfNeeded(pi, stagedMcpServerNames);
// Empty-string "" means no warning. Append to body conditionally.
```

**Critical API note:** `getAllTools()` lives on `ExtensionAPI` (the factory `pi` parameter), NOT on `ExtensionContext` (the slash-command `ctx`). Pass `pi` separately in the options bag (mirror `orchestrators/marketplace/remove.ts:52-53`).

### Pattern S-5: Reload-hint composition (RH-1/RH-2)

**Source:** `extensions/claude-marketplace/presentation/reload-hint.ts` (lines 29-48).
**Apply to:** install (verb `"load"`), uninstall (verb `"drop"`; gated on ≥1 dropped resource per PU-8), update (verb `"refresh"`; gated on partition.updated nonempty).

```typescript
import { reloadHint, appendReloadHint, type ReloadVerb } from "../../presentation/reload-hint.ts";

const hint = reloadHint("load", [pluginName]);  // returns "" when names is empty
notifySuccess(ctx, appendReloadHint(body, hint));
```

### Pattern S-6: Error-cause walk depth-5 (ES-4)

**Source:** `extensions/claude-marketplace/orchestrators/marketplace/shared.ts::formatErrorWithCauses` (lines 339-361).
**Apply to:** uninstall PU-7 propagation (chained `AgentsUnstageFailureError`); update PUP-6 phase-3 aggregate error surface.

```typescript
import { formatErrorWithCauses } from "../marketplace/shared.ts";

notifyError(ctx, formatErrorWithCauses(err), err);
```

### Pattern S-7: Path containment (NFR-10 / PS-1..5)

**Source:** `extensions/claude-marketplace/shared/path-safety.ts` -- `assertPathInside`, `PathContainmentError`, `SymlinkRefusedError` (subclass).
**Apply to:** every name-derived path. ALREADY enforced by `locations.pluginDataDir(...)` (which routes through `assertPathInside` at `locations.ts:132-136`).

**For Phase 5:** orchestrators call `locations.pluginDataDir(...)` only; they do NOT compose path strings themselves. The D-02 PI-14 rollback bypass means a containment violation propagates verbatim instead of being folded into `(rollback partial: ...)`.

### Pattern S-8: 9-zone D-11 import boundaries

**Source:** `tests/architecture/import-boundaries.test.ts` + `eslint.config.js` `import-x/no-restricted-paths`.
**Apply to:** every new file. Phase 5 specific:
- `orchestrators/plugin/*` MAY import from: `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/`, `platform/` (via injected gitOps), `shared/`.
- `orchestrators/plugin/*` MAY import from `orchestrators/marketplace/shared.ts` (only the named exports `cascadeUnstagePlugin`, `GitOps`, `DEFAULT_GIT_OPS`, `formatErrorWithCauses`, `resolveScopeFromState`) and `orchestrators/types.ts` (`PluginUpdateFn`, `PluginUpdateOutcome`, `PluginUpdatePartition`).
- `orchestrators/marketplace/*` MUST NOT import from `orchestrators/plugin/*` (cycle break -- the cascade uses the injected `PluginUpdateFn` only; see `orchestrators/marketplace/update.ts:107`).
- `presentation/plugin-list.ts` MAY NOT import from `persistence/` (D-11; declare the minimal payload structurally, mirror `presentation/marketplace-list.ts:25-30`).

### Pattern S-9: D-13 layering (orchestrators don't import platform/git)

**Source:** `orchestrators/marketplace/shared.ts` (lines 35-114) -- the `GitOps` interface + `DEFAULT_GIT_OPS` is the ONLY surface that touches `platform/git.ts`.
**Apply to:** `update.ts` only (install + list + uninstall have ZERO git surface per NFR-5 / PI-2 / PL-3).

```typescript
import { DEFAULT_GIT_OPS, type GitOps } from "../marketplace/shared.ts";

export interface UpdatePluginsOptions {
  // ... other fields ...
  readonly gitOps?: GitOps;  // D-12 injection seam
}

export async function updatePlugins(opts: UpdatePluginsOptions): Promise<void> {
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;
  // ... use gitOps.fetch / forceUpdateRef / checkout only via this interface ...
}
```

### Pattern S-10: D-14 sequencing in tests (architectural-test verifications)

**Source:** `tests/orchestrators/marketplace/update.test.ts:130-155` -- the `state.fetchCalls.length === 1`, `state.forceUpdateRefCalls.length === 1`, `state.checkoutCalls.length === 1` shape using `makeMockGitOps()` from `tests/helpers/git-mock.ts`.
**Apply to:** `tests/orchestrators/plugin/update.test.ts` PUP-2 syncClone-once assertion.

---

## No Analog Found (or partial only)

| File | Role | Why no perfect analog |
|------|------|----------------------|
| `presentation/plugin-list.ts` (truncate + icon legend + version paren + autoupdate header) | presentation | `presentation/marketplace-list.ts` matches the structural skeleton (lines 39-74) but does not have description-truncation, icon-table-per-status, or version-paren. These three helpers are net-new logic; tests must verify byte-for-byte. |
| `assertNoCrossPluginConflicts` (cross-scope-aware pure-fn helper) | shared | `applyAutoupdateFlipInPlace` is the closest in mechanics (pure state-mutating helper) but the cross-scope read shape is different. Use RESEARCH.md §"Pattern 3" verbatim as the canonical sketch. |

---

## Pitfalls (planner: surface these in plan tasks)

These mirror RESEARCH.md §"Common Pitfalls" but are restated here so the planner can quote them in task descriptions:

1. **`pluginDataDir` already exists.** `persistence/locations.ts:132-136` already exports an async `pluginDataDir(mp, plugin)` helper. CONTEXT.md D-08 and RESEARCH.md treat it as new; in fact only the containment-escape TEST may be missing. Plan should verify-then-add-test, not re-add the helper.

2. **`runPhases` for update is FORBIDDEN.** D-03 + Phase 4 D-02 precedent: heterogeneous undo semantics (phase-3a aggregates rather than reverse-undoes) + AS-4 "(rollback partial:)" would fire incorrectly. Use the hand-rolled three try/catch blocks shown in RESEARCH.md §"Pattern 1".

3. **PI-15 detection at LEDGER END causes unnecessary rollback (Pitfall 2).** Detect concurrent install at the TOP of the `withStateGuard` closure, BEFORE `runPhases`, so the ledger never runs when the plugin already exists in state.

4. **`abortPreparedAgents` returns leak descriptor; `abortPreparedMcp` is sync void.** Per Pitfall 1 + RESEARCH.md §"Pattern 1": `if (handles.X !== undefined)` guard each call individually; collect leaks with `appendLeaks(err, leaks)`.

5. **`stripComments` is required for header-prose grep.** `tests/orchestrators/marketplace/list.test.ts:192-196` documents this: header docstrings can MENTION `gitOps`/`withStateGuard` legally; source-grep tests must strip block + line comments before pattern-matching.

6. **`presentation/` cannot import from `persistence/` (D-11).** `presentation/plugin-list.ts` MUST declare the `PluginListEntry` / `PluginListPayload` shapes locally as structural supersets, mirroring `presentation/marketplace-list.ts:25-30`.

7. **markers-snapshot.test.ts has `assert.equal(literals.length, 5, ...)`** at lines 41-45. Adding `RECOVERY_PLUGIN_REINSTALL_PREFIX` is a PHASE 5 EXTENSION beyond §6.12; use a SEPARATE test block (mirror AG-5 lines 88-94) instead of appending a 6th row, to avoid breaking the count assertion.

8. **`getAllTools()` lives on `ExtensionAPI`, NOT `ExtensionContext`.** Every orchestrator with soft-dep composition MUST accept `pi: ExtensionAPI` as a separate options-bag field. Mirror `orchestrators/marketplace/update.ts:113` and `remove.ts:52-53`.

9. **Cascade-vs-direct severity routing (PUP-9).** `updateSinglePlugin: PluginUpdateFn` catches into `partition: 'failed'` (never throws -- cascade-safe per the contract at `orchestrators/types.ts:50-54`). `updatePlugins(opts)` direct entrypoint surfaces phase-2-or-earlier throws via `notifyError(ctx, ...)`.

10. **WR-04 fields on `PluginUpdateOutcome` are already in place.** `orchestrators/types.ts:38-40` exposes `stagedAgents?` and `stagedMcpServers?` -- Phase 4 already plumbs these into RH-5 composition in `marketplace/update.ts:332-354`. Phase 5's `updateSinglePlugin` ONLY needs to populate them on success.

---

## Metadata

**Analog search scope:**
- `extensions/claude-marketplace/orchestrators/marketplace/{add,remove,list,update,autoupdate,shared,index}.ts`
- `extensions/claude-marketplace/orchestrators/types.ts`
- `extensions/claude-marketplace/transaction/{phase-ledger,rollback,with-state-guard}.ts`
- `extensions/claude-marketplace/presentation/{marketplace-list,reload-hint,soft-dep}.ts`
- `extensions/claude-marketplace/shared/{markers,errors,notify,fs-utils,path-safety}.ts`
- `extensions/claude-marketplace/persistence/locations.ts`
- `extensions/claude-marketplace/domain/resolver.ts`
- `extensions/claude-marketplace/bridges/{skills,commands,agents}/{discover,types,index}.ts`
- `extensions/claude-marketplace/bridges/agents/index.ts`
- `tests/orchestrators/marketplace/{list,update,cascade}.test.ts`
- `tests/presentation/marketplace-list.test.ts`
- `tests/transaction/rollback.test.ts`
- `tests/architecture/{markers-snapshot,import-boundaries,no-shell-out}.test.ts`

**Files scanned:** 30 source files + 8 test files + 3 helpers (path-safety, fs-utils, prd-extract).

**Pattern extraction date:** 2026-05-10
