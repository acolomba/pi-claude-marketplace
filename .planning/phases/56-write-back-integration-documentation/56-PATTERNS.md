# Phase 56: Write-Back Integration & Documentation - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 22 (1 new module, 8 orchestrators, 8 edge handlers, 1 shared edge module, 2 architecture tests, 1 README, 1 import post-pass)
**Analogs found:** 22 / 22 (the entire phase is mechanical replication of Phase 54 frozen patterns)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/persistence/config-write-back.ts` | persistence helper (NEW) | transform / atomic write | `persistence/config-io.ts` (saveConfig); `orchestrators/plugin/enable-disable.ts:267-289` (writeConfigEntry shape) | exact (frozen shape lifted to module) |
| `extensions/pi-claude-marketplace/edge/handlers/shared.ts` | edge cross-cutting helper (NEW or extend) | input-validation | `edge/handlers/plugin/enable-disable.ts:49-84` (extractLocalFlag); existing `edge/handlers/{marketplace,plugin}/shared.ts` | exact (lift) |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | orchestrator | request-response + atomic write | `orchestrators/plugin/enable-disable.ts:305-403` | role-match (different domain, same shape) |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | orchestrator | request-response + atomic write + cascade | `orchestrators/plugin/enable-disable.ts:305-403` + cascade variant | role-match |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` | orchestrator | request-response + atomic write | `orchestrators/plugin/enable-disable.ts:305-403` | exact (autoupdate is the Phase 54 frozen mirror) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | orchestrator | request-response + atomic write | `orchestrators/plugin/enable-disable.ts:305-403` | role-match |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | orchestrator | request-response + atomic delete | `orchestrators/plugin/enable-disable.ts:305-403` | role-match |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | orchestrator | request-response + near-no-op write | `enable-disable.ts` + deep-equal short-circuit (Open Q #1) | partial (write semantics TBD) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | orchestrator | request-response + near-no-op write | `enable-disable.ts` + deep-equal short-circuit | partial |
| `extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts` | orchestrator (composed) | composed 2-step write-back | self (composes addMarketplace + setMarketplaceAutoupdate, each writing back) | exact (A2: keep composed shape) |
| `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` | orchestrator (batched) | batched multi-entry transform + atomic write | NEW shape; closest analog `enable-disable.ts` lock idiom + new batched helper | role-match (novel batched post-pass) |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts` | edge handler | request-response | `edge/handlers/plugin/enable-disable.ts` (extractLocalFlag + parse) | role-match |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts` | edge handler | request-response | `edge/handlers/plugin/enable-disable.ts` | role-match |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts` | edge handler | request-response | `edge/handlers/plugin/enable-disable.ts` | exact |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` | edge handler | request-response | `edge/handlers/plugin/enable-disable.ts` | role-match |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts` | edge handler | request-response | `edge/handlers/plugin/enable-disable.ts` | role-match |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` | edge handler | request-response | `edge/handlers/plugin/enable-disable.ts` | role-match |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` | edge handler | request-response | `edge/handlers/plugin/enable-disable.ts` | role-match |
| `orchestrators/marketplace/{list,info,update,shared}.ts` + `orchestrators/plugin/{list,info}.ts` (SPLIT-01 sites) | read-path rewire (7 sites) | request-response (read) | `persistence/config-merge.ts::loadMergedScopeConfig` | role-match |
| `tests/architecture/config-state-consistency.test.ts` (NEW) | architecture test | property/round-trip | `tests/architecture/config-state-write-seams.test.ts` | role-match |
| `tests/architecture/config-state-write-seams.test.ts` | architecture test (verify) | property/grep | self | exact (Phase 52 A1 protocol: read + verify, no edit expected) |
| `README.md` | documentation | n/a | self (existing `### Scoping` section structure) | exact |

## Pattern Assignments

### `persistence/config-write-back.ts` (NEW module)

**Analog:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:267-289` (the writeConfigEntry to lift) + `persistence/config-io.ts` (saveConfig contract).

**Imports pattern** (mirror Phase 54 frozen shape):
```typescript
// Source: orchestrators/plugin/enable-disable.ts:58-60
import path from "node:path";
import { loadConfig, saveConfig } from "../../persistence/config-io.ts";
```
The new module sits in `persistence/`; its imports look like:
```typescript
import {
  saveConfig,
  type ScopeConfig,
  type MarketplaceConfigEntry,
  type PluginConfigEntry,
} from "./config-io.ts";
```

**Core entry-level patch pattern** (lift VERBATIM from `enable-disable.ts:267-289`):
```typescript
// Source: orchestrators/plugin/enable-disable.ts:267-289
async function writeConfigEntry(
  current: ScopeConfig,
  targetConfigPath: string,
  scopeRoot: string,
  plugin: string,
  marketplace: string,
  enable: boolean,
): Promise<void> {
  const key = `${plugin}@${marketplace}`;
  const existingPluginEntry = current.plugins?.[key] ?? {};
  const patched: ScopeConfig = {
    ...current,
    schemaVersion: 1,
    plugins: {
      ...(current.plugins ?? {}),
      [key]: {
        ...existingPluginEntry,   // ← preserves D-09 unknown forward-compat keys
        enabled: enable,
      },
    },
  };
  await saveConfig(targetConfigPath, patched, scopeRoot);
}
```
Generalize to `writePluginConfigEntry(current, targetConfigPath, scopeRoot, plugin, marketplace, patch: Partial<PluginConfigEntry>)`. Add the marketplace twins (`writeMarketplaceConfigEntry`, `deleteMarketplaceConfigEntryWithCascade`, `deletePluginConfigEntry`) and the batched variant (`writeBatchedConfigEntries`) — full shapes are spelled out in RESEARCH.md §"Code Examples" Example 1.

---

### `edge/handlers/shared.ts` (NEW shared scanner)

**Analog:** `edge/handlers/plugin/enable-disable.ts:49-84` (extractLocalFlag).

**Lift VERBATIM** (Phase 54 frozen, WR-02-corrected):
```typescript
// Source: edge/handlers/plugin/enable-disable.ts:49-84
function extractLocalFlag(
  args: string,
  ctx: ExtensionCommandContext,
  usage: string,
): { local: boolean; residualArgs: string } | undefined {
  let local = false;
  const tokens = args.split(/\s+/).filter((t) => t.length > 0);
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === undefined) break;
    if (tok === "--scope") { i += 2; continue; }       // consumed downstream
    if (tok === "--local") { local = true; i += 1; continue; }
    if (tok.startsWith("--")) {
      notifyUsageError(ctx, { message: `Unknown flag: "${tok}".`, usage });
      return undefined;
    }
    i += 1;
  }
  return { local, residualArgs: tokens.filter((t) => t !== "--local").join(" ") };
}
```
The lifted version goes in `edge/handlers/shared.ts` (cross-cutting; `marketplace/` and `plugin/` subtrees each retain their domain-specific `shared.ts`). Each of 8 handlers imports it. The original at `edge/handlers/plugin/enable-disable.ts:49-84` then collapses to a re-export or direct usage.

---

### `orchestrators/marketplace/add.ts` (and remove.ts, plugin/install.ts, plugin/uninstall.ts)

**Analog:** `orchestrators/plugin/enable-disable.ts:343-403` (the full WB-01/WB-02/WR-09 disciplined lock body).

**Target-path selection** (copy this discipline exactly, Pitfall 2 / WB-02):
```typescript
// Source: orchestrators/plugin/enable-disable.ts:343-345
const targetConfigPath =
  opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath;
const configBasename = path.basename(targetConfigPath);
```
Set BEFORE the lock; never read conditionally; never fall back to base on local-file ENOENT.

**Lock body skeleton** (copy this exact arm-skip discipline; WR-01 / WR-09 / idempotency):
```typescript
// Source: orchestrators/plugin/enable-disable.ts:349-403
await withLockedStateTransaction(locations, async (tx) => {
  const state = tx.state;
  const cfg = await loadConfig(targetConfigPath);
  if (cfg.status === "invalid") {
    outcome = { kind: "invalid-config" };
    return;                                              // ← skip writes
  }

  // ... business mutation; sets outcome.kind ...

  if (outcome.kind !== "fresh") {
    return;                                              // ← idempotent/failed/not-recorded skip
  }

  // WR-09: orchestrated mode is reconcile-driven; config is the INPUT.
  if (!orchestrated) {
    const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
    await writeMarketplaceConfigEntry(                   // or writePluginConfigEntry, or delete*
      current,
      targetConfigPath,
      locations.scopeRoot,
      recordedName,
      { source: opts.rawSource },                        // ← VERBATIM user input (planReconcile contract)
    );
  }

  await tx.save();
});
```

**Source-field contract** (RESEARCH §"Code Examples" Example 2):
`writeMarketplaceConfigEntry` MUST receive `source: opts.rawSource` (the verbatim user-typed string), not a parsed `.raw`. `orchestrators/reconcile/plan.ts::samePlannedSource` compares against this exact string; using a re-rendered form risks a perpetual reconcile mismatch.

**Existing seam to migrate (add/remove/install/uninstall):** these orchestrators currently use `withStateGuard` (auto-saves on no-throw). Two viable patterns:
1. Convert to `withLockedStateTransaction` + explicit `tx.save()` — matches enable-disable exactly; gives explicit control over which arms save.
2. Keep `withStateGuard` and call write-back inside the closure on success arms only — simpler change-set, but the auto-save-on-no-throw behavior must continue to NOT save on idempotent throws (verify each call-site).

Recommendation: option 1 (mirrors Phase 54 exactly; same review pattern; same idempotency skip discipline).

---

### `orchestrators/marketplace/remove.ts` (cascade variant)

**Analog:** `orchestrators/plugin/enable-disable.ts:349-403` (lock idiom) + NEW cascade helper.

The marketplace-remove cascade is the only genuinely new logic in this phase. Pattern from RESEARCH §"Code Examples" Example 1 (`deleteMarketplaceConfigEntryWithCascade`):
```typescript
// Inside the helper, NEW shape:
const suffix = `@${marketplace}`;
const plugins: Record<string, PluginConfigEntry> = {};
for (const [key, entry] of Object.entries(current.plugins ?? {})) {
  if (!key.endsWith(suffix)) plugins[key] = entry;
}
```
This mirrors the state-side cascade already in `orchestrators/marketplace/remove.ts`. The cascade lives in ONE place (the helper); the orchestrator's only job is to invoke it with the marketplace name.

---

### `orchestrators/plugin/bootstrap.ts` (composed 2-write)

**Analog:** self — bootstrap already composes `addMarketplace` + `setMarketplaceAutoupdate` at lines 99 and 122 (per grep above).

**Pattern:** NO change to bootstrap's body. Once `addMarketplace` and `setMarketplaceAutoupdate` write back to the config in standalone mode (default), bootstrap inherits both writes for free. WB-04 is satisfied by composition; no explicit batched-helper call is needed (A2 in RESEARCH §"Assumptions Log": keep the composed shape; 2 writes are correctness-equivalent).

---

### `orchestrators/import/execute.ts` (batched post-pass — NEW shape)

**Analog:** `orchestrators/plugin/enable-disable.ts:349-403` (lock idiom) + new batched helper + `orchestrators/reconcile/apply.ts:120-179` (per-scope read-pass under lock; verified in RESEARCH §Sources).

**Novel shape** (RESEARCH §"Code Examples" Example 1 + §"Architecture Patterns" Pattern 3):
```typescript
// After all orchestrated-mode addMarketplace/installPlugin calls complete,
// run a per-scope post-pass under ONE lock:
for (const scope of Object.keys(resultsByScope) as readonly Scope[]) {
  const locations = locationsFor(scope, cwd);
  const targetConfigPath = locations.configJsonPath;   // import always targets base; --local not in import surface
  await withLockedStateTransaction(locations, async (tx) => {
    const cfg = await loadConfig(targetConfigPath);
    if (cfg.status === "invalid") {
      // surface a per-scope outcome; do not save state
      return;
    }
    const current = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
    await writeBatchedConfigEntries(current, targetConfigPath, locations.scopeRoot, {
      marketplaces: collectMarketplacePatches(result),  // {name: {source: rawSource, autoupdate?}}
      plugins: collectPluginPatches(result),            // {key: {}}
    });
    // No tx.save() needed — state was already saved by the per-entry orchestrators.
  });
}
```
**Race-window comment is mandatory** (Pitfall 8 from RESEARCH): inline a comment explaining the bounded race between the last per-entry lock release and the batched-save lock acquire is self-healing on next reconcile.

---

### Edge handlers (8: marketplace add/remove/autoupdate, plugin install/uninstall/reinstall/update)

**Analog:** `edge/handlers/plugin/enable-disable.ts:86-115` (the makeEnableDisableHandler shape).

**Pattern** (each handler adopts this exact shape):
```typescript
// Source: edge/handlers/plugin/enable-disable.ts:86-115
const localFlag = extractLocalFlag(args, ctx, usage);
if (localFlag === undefined) return;

const parsed = parseRequiredXxxRef(localFlag.residualArgs, ctx, usage);   // domain-specific parser
if (parsed === undefined) return;

await xxxOrchestrator({
  ctx,
  pi,
  cwd: ctx.cwd,
  // ...domain fields from parsed...
  ...(parsed.scope !== undefined && { scope: parsed.scope }),
  ...(localFlag.local && { local: true }),
});
```

**USAGE-string extension:** each handler's usage gains a trailing `[--local]`:
```typescript
// Source: edge/handlers/plugin/enable-disable.ts:23-27
function usageFor(enable: boolean): string {
  return enable
    ? "Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]"
    : "Usage: /claude:plugin disable <plugin>@<marketplace> [--scope user|project] [--local]";
}
```
Pitfall 7 (catalog UAT byte drift): USAGE strings render only via `notifyUsageError`; audit catalog-uat fixtures for any literal `Usage:` body and update in lockstep (atomic-supersession).

---

### SPLIT-01 read-path rewire (7 sites in `marketplace/{list,info,update,shared}.ts` + `plugin/{list,info}.ts`)

**Analog:** `persistence/config-merge.ts::loadMergedScopeConfig` (and the `merged.marketplaces[name]?.entry.autoupdate` shape).

**Current cast read pattern** (drawn from RESEARCH §"State of the Art"):
```typescript
// e.g. orchestrators/marketplace/list.ts:68 region
// SPLIT-01: autoupdate carved out of MARKETPLACE_RECORD_SCHEMA in Phase 51-02;
const autoupdate = (record as unknown as Record<string, unknown>).autoupdate as boolean | undefined ?? false;
```

**Rewire target:**
```typescript
// post-Phase-56
const merged = await loadMergedScopeConfig(locations);
const autoupdate = merged.marketplaces[name]?.entry.autoupdate ?? false;
```
RESEARCH §Pitfall 6 + Open Question #1: rewire ALL 7 in this phase to close the divergence window. Optionally add a NEW architecture test `tests/architecture/no-split-01-cast-reads.test.ts` that greps for `as unknown as Record<string, unknown>).autoupdate` outside an allow-list, OR merge that assertion into the existing write-seams test.

---

### `tests/architecture/config-state-write-seams.test.ts` (verify, do NOT edit)

**Analog:** self.

**Verification protocol** (Phase 52 A1, repeated in RESEARCH §Locked Decisions): READ the test (Read tool). Confirm the allow-list regexes target `atomicWriteJson(<...>configJsonPath, ...)` (already verified — patterns at lines 102-104). The new write-back helpers call `saveConfig`, NOT `atomicWriteJson` directly, so they do NOT trip the patterns. NO edit expected. If verification surprises (a new direct `atomicWriteJson` callsite slips in), then `ALLOWED_CONFIG_JSON_WRITERS` widens AND the matching "exactly N" sibling assertion updates in the same commit.

```typescript
// Source: tests/architecture/config-state-write-seams.test.ts:102-104 (verified)
const FORBIDDEN_STATE_JSON_PATTERN = /atomicWriteJson\(\s*(?:\w+\.)?stateJsonPath\b/;
const FORBIDDEN_CONFIG_JSON_PATTERN = /atomicWriteJson\(\s*(?:\w+\.)?configJsonPath\b/;
const FORBIDDEN_CONFIG_LOCAL_JSON_PATTERN = /atomicWriteJson\(\s*(?:\w+\.)?configLocalJsonPath\b/;
```

---

### `tests/architecture/config-state-consistency.test.ts` (NEW)

**Analog:** `tests/architecture/config-state-write-seams.test.ts` (test-file structure: per-test naming, ReadonlySet allow-lists, regex-driven walks) — for STRUCTURE only.

**Shape:** see RESEARCH §"Code Examples" Example 3 (round-trip integrity + reconcile no-op). Two test cases minimum:
1. Unknown-key preservation: write fixture config with `futureField`; run mutating command; assert `futureField` survives.
2. Reconcile no-op: after the mutating command, `planReconcile(mergeScopeConfigs(after, {}), state, scope)` returns `emptyReconcilePlan(scope)`.

---

### `README.md` (CFG-04 documentation)

**Analog:** self — existing `### Scoping` section (line 122) and `## /claude:plugin reference` (line 130).

**Insertion point:** between lines 128 (end of Scoping) and 130 (start of reference). New top-level `## Configuration files` section with two subsections:
- `### claude-plugins.local.json and the .local convention`
- `### Gitignore convention`

Full markdown body in RESEARCH §"Code Examples" Example 4 (verbatim ready-to-paste).

## Shared Patterns

### Atomic Write-Back via saveConfig

**Source:** `persistence/config-io.ts::saveConfig` (SOLE sanctioned writer per SPLIT-02; runs `assertPathInside` before `atomicWriteJson`).
**Apply to:** EVERY write-back call in the new helper module. NEVER call `atomicWriteJson` directly; NEVER bypass `saveConfig`.

### Per-Scope Lock via withLockedStateTransaction

**Source:** `transaction/with-state-guard.ts::withLockedStateTransaction` (used in `enable-disable.ts:351` and `reinstall.ts:205`).
**Apply to:** All 8 mutating orchestrators + import post-pass. Lock is NOT re-entrant (CR-01); never nest. `loadConfig` MUST run INSIDE the closure for fresh read.

### WR-09 Orchestrated-Mode Skip

**Source:** `orchestrators/plugin/enable-disable.ts:380-400`.
**Apply to:** Every orchestrator that supports `notifications.mode === "orchestrated"`. Reconcile-driven calls SKIP write-back; config is the apply path's INPUT.

```typescript
if (!orchestrated) {
  await writeXxxConfigEntry(...);
}
```

### Idempotent / Failed / Not-Recorded Arm Skip

**Source:** `orchestrators/plugin/enable-disable.ts:376-378`.
**Apply to:** Every mutating orchestrator. Place write-back AFTER the `outcome.kind !== "fresh"` short-circuit. Preserves RECON-05 byte-stable convergence proof (Pitfall 5).

### Target-Path Selection (--local discipline)

**Source:** `orchestrators/plugin/enable-disable.ts:343-345`.
**Apply to:** Every mutating orchestrator that accepts `opts.local`. Selection is unconditional; ENOENT-on-local is NOT a fallback (Pitfall 2 / WB-02).

### Verbatim rawSource for Marketplace Patches

**Source:** `orchestrators/reconcile/plan.ts::samePlannedSource` (the comparison contract).
**Apply to:** Every write-back of a marketplace `source` field. Pass `opts.rawSource` verbatim — never re-render through the parsed source object.

### Information Disclosure Mitigation

**Source:** `orchestrators/plugin/enable-disable.ts:345` (`const configBasename = path.basename(targetConfigPath);`).
**Apply to:** Every user-visible message that references the config file. Surface `path.basename(targetConfigPath)`, never the absolute path (T-53-02-02 / T-54-02-02).

### USAGE String `[--local]` Suffix

**Source:** `edge/handlers/plugin/enable-disable.ts:23-27`.
**Apply to:** All 7 new edge handlers gaining the flag (enable/disable already done). Audit catalog-uat fixtures for `Usage:` body strings in lockstep (Pitfall 7).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/architecture/no-split-01-cast-reads.test.ts` (OPTIONAL) | architecture test | property/grep | NEW gating test; closest structural analog is `config-state-write-seams.test.ts` for the ReadonlySet + regex walk shape. May be folded into the existing write-seams test per Open Question #3. |

Everything else in this phase has a strong analog. The marketplace-remove cascade and the import batched post-pass are NEW logic but their structural patterns (lock + load + patch + save) are direct frozen-Phase-54 derivatives.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{orchestrators,edge/handlers,persistence,transaction}/`, `tests/architecture/`, `README.md`.
**Files scanned:** ~30 (grep-driven; only the relevant Phase 54 frozen analog and direct successors fully read).
**Pattern extraction date:** 2026-06-10
**Confidence:** HIGH — every pattern is frozen Phase 54/55 production code; this phase is mechanical replication + one new module + one new test + one README section.
