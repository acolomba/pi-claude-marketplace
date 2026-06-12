# Phase 56: Write-Back Integration & Documentation - Research

**Researched:** 2026-06-10
**Domain:** Config write-back integration into mutating commands; README documentation
**Confidence:** HIGH

## Summary

Phase 56 closes the v1.12 milestone by integrating config write-back into the remaining mutating commands and documenting the `claude-plugins.json` / `claude-plugins.local.json` workflow. The pattern is **already frozen** in Phase 54's `enable-disable.ts` (`writeConfigEntry` + `extractLocalFlag` + `saveConfig` inside `withLockedStateTransaction`), so this phase is **mechanical replication** across the remaining mutating-command surface, plus a documentation block.

The mutating-command surface is: **marketplace add / remove / autoupdate / noautoupdate** (4 orchestrators), **plugin install / uninstall / reinstall / update** (4 orchestrators), **import** (multi-entry batched), **bootstrap** (multi-entry batched: marketplace + autoupdate). Plus the existing **enable-disable** (already done in Phase 54 -- pattern source).

Two structural constraints from Phase 55 must be preserved: (1) **orchestrated mode never writes the config** (WR-09: reconcile drives `enabled` and `autoupdate` flips from the config -- writing back would clobber the user's authored declaration, possibly in `claude-plugins.local.json`); (2) **idempotent / failed / not-recorded outcomes leave the config UNTOUCHED** (Pitfall 54-7 idempotent arm discipline -- mirrors `autoupdate.ts`'s existing precedent and keeps reconcile no-op convergence byte-stable).

Two architectural opportunities surface in parallel: (a) **SPLIT-01 cast-site rewire** -- the 8 `// SPLIT-01:` sites in `list.ts` / `info.ts` (×2) / `update.ts` / `shared.ts` (×2) read `autoupdate` from the state record via cast; after Phase 56 the autoupdate truth lives in the config, so these reads should rewire to consult `loadMergedScopeConfig`; (b) **SPLIT-02 architecture-test verification** -- new `saveConfig` callers do NOT need allow-list edits (the path-name regex in `config-state-write-seams.test.ts` targets `atomicWriteJson(<...>configJsonPath, ...)`, not `saveConfig` callers), but Phase 52 A1 verification protocol applies (read the test, confirm regex pattern does not match the new sites).

**Primary recommendation:** Extract a single shared helper module `persistence/config-write-back.ts` exposing `writeMarketplaceConfigEntry(currentBase, targetPath, scopeRoot, name, patch)` and `writePluginConfigEntry(currentBase, targetPath, scopeRoot, key, patch)` + batched variants for import/bootstrap. Mirror Phase 54's `extractLocalFlag` into `edge/handlers/shared.ts` as a single shared scanner. Sequence the work in 3 plans: **Plan 01** (shared helpers + add/remove/autoupdate WB-01/02 + WB-04 bootstrap), **Plan 02** (plugin install/uninstall/reinstall/update WB-01/02), **Plan 03** (import WB-03 batched + SPLIT-01 read-path rewire + CFG-04 README + SPLIT-02 verification).

## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation choices are at Claude's discretion -- discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Inherited constraints and prior art (the frozen foundation):

- Phase 54 already built the WB-01-shape patch for enable/disable: read the targeted file fresh inside the lock, patch the entry, save via `saveConfig` (see `writeConfigEntry` in `orchestrators/plugin/enable-disable.ts`) and the `--local` parsing convention (`extractLocalFlag` -- order-insensitive). Generalize, don't duplicate.
- Phase 55 deliberately removed config write-back from reconcile-driven (orchestrated-mode) paths -- reconcile applies config→reality and must NEVER write config (SPLIT-02). Write-back happens ONLY on user-invoked commands (standalone mode). Keep the orchestrated/standalone distinction intact.
- Never serialize the merged view back (Pitfall: MergedConfig is a view; write-back patches the physical base or local file re-read fresh under the lock).
- Unknown keys in config files must be preserved on write-back (forward-compat, lenient schema D-09) -- round-trip integrity test required.
- After a mutating command, reconcile must be a no-op (the command updated both reality AND config) -- consistency architecture test required.
- SPLIT-02 architecture test gates config writers; if new modules call `saveConfig`, the write-seams test's allow-list mechanics may need a deliberate, justified widening (its regexes target `atomicWriteJson` on config paths -- `saveConfig` callers are sanctioned; verify rather than assume, as in Phase 52 A1).
- SPLIT-01 cast sites (`// SPLIT-01:` tagged, Phases 51-52) were scheduled for rewire "in Phases 54-56": this phase should resolve the remaining `record.autoupdate` cast reads on the marketplace side (autoupdate flips become config write-back; state stops being the autoupdate source of truth). Audit remaining tags and either rewire or document why they stay.
- CFG-04 documentation lands in README.md: which file to commit (`claude-plugins.json`), which to keep local (`.local.json` + gitignore convention).

### Claude's Discretion

Everything not listed under Locked Decisions: helper module placement, plan decomposition, test file structure, architecture-test extension shape, README section placement, byte-form of `--local` usage strings, SPLIT-01 rewire scope (partial vs total).

### Deferred Ideas (OUT OF SCOPE)

None -- discuss phase skipped.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WB-01 | Every mutating command (marketplace add/remove/autoupdate/noautoupdate, plugin install/uninstall/reinstall/update) records its change as a targeted entry-level patch of the base config file, re-read under the scope lock | Pattern frozen in Phase 54 `writeConfigEntry`; replicate at the 8 surfaces inventoried in §Architecture Patterns |
| WB-02 | A `--local` flag targets `claude-plugins.local.json` instead; `--local` writes never touch the base file | Pattern frozen in Phase 54 `extractLocalFlag`; lift to a shared edge helper and wire each handler |
| WB-03 | `import` records imported marketplaces and plugins in the config file | Batched multi-entry patch under ONE lock per scope -- see import flow in §Architecture Patterns |
| WB-04 | `bootstrap` records its marketplace and autoupdate setting in the config file | Batched multi-entry patch (marketplace + autoupdate=true) under ONE lock -- bootstrap composes add + autoupdate; both write to the same `claude-plugins.json` |
| CFG-04 | The `.local` gitignore convention and config-file workflow are documented (README) | New README section between Scoping (line 122-128) and `/claude:plugin` reference (line 130); add `claude-plugins.local.json` line to `.gitignore` recommendation |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Config entry-level patch (load/patch/save) | persistence/ (new `config-write-back.ts`) | — | All physical-file writes already live in `persistence/config-io.ts` (`saveConfig` is the SOLE sanctioned writer per SPLIT-02). A new shared helper module belongs in the persistence tier alongside `config-io.ts` and `migrate-config.ts`. |
| Calling write-back inside the transaction closure | orchestrators/ (each mutating command) | persistence/ (the new helper) | The locking discipline + idempotency arm + standalone/orchestrated discriminator are all per-orchestrator concerns; the orchestrator decides WHEN to call the helper. Mirrors Phase 54's `enable-disable.ts` shape. |
| `--local` flag parsing | edge/handlers/ (shared scanner) | orchestrators/ (receive `local?: boolean`) | `extractLocalFlag` lives at `edge/handlers/plugin/enable-disable.ts:49-84` today. Lift to `edge/handlers/shared.ts` so 8 handlers consume one canonical scanner. |
| README documentation | docs / README.md | — | CFG-04 is a documentation-only requirement; no code surface. |
| SPLIT-01 read-path rewire (autoupdate from config) | orchestrators/marketplace + plugin (list/info/update/shared) | persistence/ (`loadMergedScopeConfig`) | The 8 `// SPLIT-01:` cast-read sites currently read autoupdate from the state record; after Phase 56 the truth lives in the config. The new read path consults `loadMergedScopeConfig`'s `merged.marketplaces[name]?.entry.autoupdate`. |

## Standard Stack

No new technologies. Phase 56 is a pure code organization + integration phase against the v1.12 frozen foundation:

### Core (carried forward, no changes)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typebox` | `^1.1.38` | Config schema validation -- CONFIG_VALIDATOR.Check runs inside saveConfig (caller-bug guard) | Already the SOLE schema validator; `saveConfig` revalidates every write |
| `node:fs/promises` | bundled | Locations / containment / state load | Used via `loadConfig` / `saveConfig` -- no new direct use |
| `proper-lockfile` (via `withLockedStateTransaction`) | indirect | Per-scope cross-process lock | Existing seam; new write-back must run INSIDE this lock (Pitfall 54-1) |

### Supporting (carried forward)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `write-file-atomic` | `^7` (current main) | Atomic JSON writes via `atomicWriteJson` | Always; routed through `saveConfig` -- never call directly |

**Installation:** None. Phase 56 adds zero dependencies.

## Package Legitimacy Audit

Not applicable -- Phase 56 installs no new packages. The existing peer dependency `@mariozechner/pi-coding-agent` and direct dependency `write-file-atomic` are already audited in v1.12 phase 51 research. Inventory delta this phase: **0 packages added, 0 removed**.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌───────────────────────────────────┐
                    │   User runs /claude:plugin ...    │
                    └─────────────────┬─────────────────┘
                                      │
                          ┌───────────▼───────────┐
                          │  edge/handlers/<cmd>  │
                          │   extractLocalFlag    │  ← shared helper (lifted)
                          └───────────┬───────────┘
                                      │ ({local, scope, ...positionals})
                          ┌───────────▼───────────┐
                          │ orchestrator/<cmd>.ts │
                          │  standalone mode      │
                          └───────────┬───────────┘
                                      │
                      ┌───────────────▼────────────────┐
                      │ withLockedStateTransaction(loc)│
                      │   ┌─────────────────────────┐  │
                      │   │ loadConfig(targetPath)  │  │  ← fresh under lock
                      │   │ (CFG-03: invalid abort) │  │
                      │   ├─────────────────────────┤  │
                      │   │ business logic mutate   │  │
                      │   │   state record          │  │
                      │   ├─────────────────────────┤  │
                      │   │ writeXxxConfigEntry(    │  │  ← Phase 56 helper
                      │   │   current, targetPath,  │  │     (entry-level patch)
                      │   │   scopeRoot, name,      │  │
                      │   │   patch)                │  │
                      │   │   → saveConfig          │  │  ← SOLE writer
                      │   ├─────────────────────────┤  │
                      │   │ tx.save() (state.json)  │  │
                      │   └─────────────────────────┘  │
                      └────────────────┬───────────────┘
                                       │
                                       ▼
                              notify(ctx, pi, ...)

   targetPath = opts.local ? loc.configLocalJsonPath : loc.configJsonPath

   Idempotent / failed / not-recorded arms: SKIP both saveConfig and tx.save()
   Orchestrated mode (RECON-03): SKIP saveConfig only (apply path is config-driven)
```

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── persistence/
│   ├── config-io.ts                    (existing -- saveConfig SOLE writer)
│   ├── config-merge.ts                 (existing -- read merged view)
│   ├── config-write-back.ts            ★ NEW (Phase 56 Plan 01)
│   └── migrate-config.ts               (existing)
├── edge/handlers/
│   ├── shared.ts                       ← lift extractLocalFlag here
│   ├── plugin/
│   │   ├── enable-disable.ts           (existing -- extractLocalFlag origin)
│   │   ├── install.ts                  ★ add --local
│   │   ├── uninstall.ts                ★ add --local
│   │   ├── reinstall.ts                ★ add --local
│   │   └── update.ts                   ★ add --local
│   └── marketplace/
│       ├── add.ts                      ★ add --local
│       ├── remove.ts                   ★ add --local
│       └── autoupdate.ts               ★ add --local (both autoupdate/noautoupdate)
└── orchestrators/
    ├── marketplace/
    │   ├── add.ts                      ★ wire writeMarketplaceConfigEntry on success
    │   ├── remove.ts                   ★ wire deleteMarketplaceConfigEntry (incl. cascade plugin entries)
    │   ├── autoupdate.ts               ★ wire writeMarketplaceConfigEntry for each fresh flip
    │   └── update.ts                   (NO write-back -- update is non-declarative)
    ├── plugin/
    │   ├── install.ts                  ★ wire writePluginConfigEntry on success
    │   ├── uninstall.ts                ★ wire deletePluginConfigEntry on success
    │   ├── reinstall.ts                (NO write-back -- reinstall preserves the existing record)
    │   ├── update.ts                   (NO write-back -- update is non-declarative)
    │   ├── enable-disable.ts           (existing pattern -- migrate inline writeConfigEntry to shared helper)
    │   └── bootstrap.ts                ★ batched: 1 add + 1 autoupdate write under one lock
    └── import/
        └── execute.ts                  ★ batched per-scope multi-entry patch (WB-03)
```

### Pattern 1: Single-Entry Write-Back Inside Locked Transaction

**What:** Re-read the targeted physical config file fresh inside the scope lock, patch ONE entry, save. Never serialize the merged view back. Skip on idempotent / failed / not-recorded / orchestrated arms.

**When to use:** Every single-entry mutating command (add/remove/autoupdate/install/uninstall + enable/disable already done).

**Example (Phase 54 frozen pattern):**

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:267-289
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
        ...existingPluginEntry,   // ← preserves unknown forward-compat keys
        enabled: enable,
      },
    },
  };
  await saveConfig(targetConfigPath, patched, scopeRoot);
}
```

**Inside the orchestrator (Phase 54 frozen):**

```typescript
// Source: enable-disable.ts:351-403
await withLockedStateTransaction(locations, async (tx) => {
  const state = tx.state;
  const cfg = await loadConfig(targetConfigPath);
  if (cfg.status === "invalid") { outcome = {kind:"invalid-config"}; return; }
  // ... mutation ...
  if (outcome.kind !== "fresh") return;          // ← idempotent / failed: skip writes
  if (!orchestrated) {                            // ← WR-09: reconcile-driven path skips
    const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
    await writeConfigEntry(current, targetConfigPath, locations.scopeRoot, plugin, marketplace, enable);
  }
  await tx.save();
});
```

### Pattern 2: `--local` Flag Extraction (Edge Layer)

**What:** Scan the args string for a bare `--local` token, reject unknown long flags, return `{local, residualArgs}` with `--local` REMOVED from the residual so downstream positional parsers see only positionals + `--scope`. Position-independent.

**When to use:** Every mutating-command edge handler (8 in total).

**Example (Phase 54 frozen, candidate for lift to shared):**

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
    if (tok === "--scope") { i += 2; continue; }      // consumed downstream
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

**Lift target:** `edge/handlers/shared.ts` (new file or existing module). Each handler imports and calls. The handlers that today use `parseCommandArgs` (which does NOT understand `--local`) must adapt the same way Phase 54 did: scan for `--local` first, then call the downstream parser on the residual.

### Pattern 3: Batched Multi-Entry Write-Back Under One Lock (bootstrap, import)

**What:** When ONE command records N entries (bootstrap = 1 marketplace + autoupdate=true; import = many marketplaces + many plugins), acquire the per-scope lock ONCE, read the config ONCE, apply N patches in memory, save ONCE. NEVER N separate withLockedStateTransaction calls per entry -- that would acquire and release the lock N times AND re-read the file N times.

**When to use:** WB-03 (import) and WB-04 (bootstrap).

**Bootstrap shape (Phase 56 target):**

```typescript
// orchestrators/plugin/bootstrap.ts -- post-Phase-56 shape
export async function bootstrapClaudePlugin(opts: BootstrapOptions): Promise<void> {
  // Phase A: marketplace add (own withStateGuard + own write-back) -- already idempotent.
  // Phase B: setMarketplaceAutoupdate (own withStateGuard + own write-back) -- already idempotent.
  // Phase 56 lifts BOTH write-backs to a SINGLE shared transaction so the file is written once.
  // OR: each composed orchestrator does its own write-back (1 add + 1 autoupdate = 2 writes per
  // bootstrap), which is the simpler shape and matches the "one signal per state change" contract.
  //
  // Recommendation: KEEP the composed shape (2 writes). Bootstrap is a 2-step onboarding command;
  // the file is written twice but each step is self-contained and idempotent. The batched approach
  // would require redesigning addMarketplace + setMarketplaceAutoupdate to expose "write-back
  // suppressed; here is the patch to fold into your batched save," which is significantly more
  // complex than 2 sequential writes. The user-observable behavior is identical (config ends in
  // the same state).
  //
  // This decision is consistent with WB-04's letter ("bootstrap records its marketplace AND
  // autoupdate setting") -- both are recorded; one batched write is not mandated.
}
```

**Import shape (Phase 56 target -- N entries per scope):**

```typescript
// orchestrators/import/execute.ts -- post-Phase-56 shape
async function executeScopedPlan(...): Promise<void> {
  // Existing flow drives addMarketplace + installPlugin in ORCHESTRATED mode per-entry,
  // accumulating outcomes for ONE cascade notification at the end of importClaudeSettings.
  // Phase 55 WR-09 means orchestrated callers SKIP their own write-back.
  //
  // Phase 56 import needs a SCOPE-LEVEL post-pass that:
  //   1. Acquires the scope lock (withLockedStateTransaction).
  //   2. Reads the targeted config file once.
  //   3. Applies one patch per successfully-added marketplace + one patch per
  //      successfully-installed plugin (from result.addedMarketplaces +
  //      result.installedPlugins).
  //   4. Saves once.
  //
  // This is the "single batched multi-entry patch under one lock" the success criteria mandate.
}
```

### Pattern 4: Standalone vs Orchestrated Skip Discipline

**What:** Every orchestrator that supports `{ mode: "orchestrated" }` MUST skip write-back when orchestrated. The reconcile apply path is config-driven; writing back would clobber the user's authored declaration -- possibly the local-file override.

**When to use:** All 4 orchestrators wired in Phase 55 Plan 01 (addMarketplace, removeMarketplace, uninstallPlugin, setPluginEnabled) AND any new orchestrator (install) that gets orchestrated mode added in Phase 56.

**Source (Phase 55 frozen):**

```typescript
// Source: enable-disable.ts:380-400 (WR-09)
// WR-09 (Phase 55 review): SKIPPED in orchestrated mode. A reconcile-driven call
// derives the desired state FROM the merged config (base + local), so the
// declaration already exists by construction -- possibly ONLY in
// claude-plugins.local.json (the per-machine override, Pitfall 54-5). Writing
// it back here would copy the local override's enabled flag into the shared
// BASE file and clobber a user-authored base declaration.
if (!orchestrated) {
  await writeConfigEntry(...);
}
```

### Pattern 5: Idempotent / Failure Arm Skip Discipline

**What:** Idempotent ("already X") arms, "not recorded" arms, and "failed" arms MUST NOT call saveConfig. Mirrors `autoupdate.ts`'s existing precedent. Keeps state.json + claude-plugins.json mtime byte-stable across no-op invocations (Phase 52 SC#4 + RECON-05 fixed-point proof).

**Source (Phase 54 frozen):**

```typescript
// Source: enable-disable.ts:376-378
if (outcome.kind !== "fresh") {
  return;        // ← no saveConfig, no tx.save()
}
```

### Pattern 6: Cascade Delete on `marketplace remove`

**What:** `marketplace remove` cascades: deletes the marketplace entry AND every plugin entry whose key is `*@<marketplace>`. The reconcile no-op proof requires that after remove, the planner sees no recorded plugins under the now-removed marketplace, so the config must not retain dangling plugin entries (which would surface as `<marketplace not declared>` source-mismatch diagnostics on the next preview).

**Implementation:** In `writeMarketplaceConfigEntry` for the remove case, also iterate `current.plugins` and delete every key ending in `@<name>`. The shared helper exposes a dedicated `deleteMarketplaceWithCascade` variant rather than overloading the patch entry-point.

### Anti-Patterns to Avoid

- **Serializing the merged view back:** `MergedConfig` is a base+local view; saving it back to `claude-plugins.json` would copy local-only entries into base (clobber). ALWAYS re-read the targeted physical file fresh inside the lock and patch THAT.
- **Calling saveConfig outside a lock:** A concurrent process can race the patch; the read inside the lock prevents this only if the save is also inside.
- **N withLockedStateTransaction calls in import:** Acquiring and releasing the lock per-entry is correctness-equivalent under low contention but breaks the "single batched multi-entry patch under one lock" success criterion (WB-03 verbatim) AND multiplies cross-process race exposure.
- **Writing back in idempotent arms:** Phase 54 catches this -- mirror the discipline. An idempotent flip that re-writes the file changes mtime and breaks the RECON-05 fixed-point invariant.
- **Verbatim cast read of state.autoupdate after Phase 56:** Once write-back is wired, the truth lives in the config; the 8 SPLIT-01 cast-read sites (list/info/update/shared) must rewire to consult MergedConfig or accept a documented divergence window.
- **`--local` writes touching the base file:** WB-02 letter ("`--local` writes never touch the base file"). The orchestrator must select `targetConfigPath` deterministically before entering the lock; ENOENT on the local file is NOT a fallback to base (loadConfig's absent arm yields an empty starting shape that saveConfig writes back to the LOCAL file, creating it).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file write | `fs.writeFile + rename` | `saveConfig` → `atomicWriteJson` → `write-file-atomic` | NFR-1 single sanctioned seam; SPLIT-02 architecture-gated |
| Per-scope cross-process locking | `proper-lockfile` direct | `withLockedStateTransaction(locations, fn)` | ST-7 / D-06; not re-entrant -- nesting self-deadlocks (Phase 54 CR-01) |
| Schema validation | `if (!hasField) ...` | `CONFIG_VALIDATOR.Check(config)` (already inside saveConfig) | Typebox JIT-compiled; runs in saveConfig as caller-bug guard |
| Path containment | regex / string comparison | `assertPathInside(scopeRoot, filePath, ...)` (inside saveConfig) | NFR-10 write-site enforcement; PathContainmentError propagates loudly |
| `--local` flag parsing | per-handler `if (args.includes("--local"))` | One shared `extractLocalFlag` in `edge/handlers/shared.ts` | Phase 54 WR-02 already solved position-independence + unknown-flag rejection; replicating 7 more times is invitations for drift |
| Entry-level patch | Replace whole config | Spread + override one key | Forward-compat per D-09 (lenient schema preserves unknown keys); round-trip integrity test (WB-01 SC#4) catches regressions |
| Cascade plugin-key delete on marketplace remove | Iterate + delete in caller | Helper variant `deleteMarketplaceWithCascade(current, name)` | Centralizes the `*@<name>` filter so caller cannot forget the cascade |

**Key insight:** Phase 54's `writeConfigEntry` and `extractLocalFlag` are already production-tested patterns. Phase 56 is replication + extraction into shared helpers, NOT redesign. The only NEW logic is the marketplace-remove cascade delete and the import batched multi-entry patch.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `claude-plugins.json` + `claude-plugins.local.json` files per scope; existing Phase 52 migration already populates `claude-plugins.json` losslessly from `state.json` on first load. After Phase 56, write-back keeps these files in sync. | Code edit (orchestrators + new persistence helper). No data migration -- migration already done in Phase 52. |
| Live service config | None. Pi reads `claude-plugins.json` at extension load (`/reload`) via `applyReconcile`; there is no live service config outside the file. | None. |
| OS-registered state | None. The extension does not register OS tasks, services, or daemons. | None. |
| Secrets/env vars | `PI_CODING_AGENT_DIR` (already in use; governs user-scope location). No new env vars introduced by Phase 56. | None. |
| Build artifacts | None new. The existing TypeScript build pipeline emits via `npm run check`. | None. |

**Nothing found in category:** State explicitly for OS-registered state, secrets, and build artifacts -- verified by codebase search.

## Common Pitfalls

### Pitfall 1: Writing back the merged view to the base file

**What goes wrong:** Author serializes `MergedConfig` directly to disk; local-only entries get copied to `claude-plugins.json`; on the next load, the user's local override appears in the committed file.

**Why it happens:** It looks like the "right" data to write -- it's the canonical view of desired state.

**How to avoid:** ALWAYS pass the result of `loadConfig(targetConfigPath)` into the patcher, NOT the merged view. The targetConfigPath is the physical file the user expects to mutate.

**Warning signs:** `mergeScopeConfigs(...)` or `loadMergedScopeConfig(...)` appears in any write-back code path. The architecture test should forbid this -- consider extending `config-state-write-seams.test.ts` to assert that NO mutating orchestrator imports `mergeScopeConfigs` or `loadMergedScopeConfig`.

### Pitfall 2: `--local` writes leaking to base on ENOENT

**What goes wrong:** Author writes `targetConfigPath = opts.local ? localPath : basePath`, then on ENOENT-of-local-file falls back to base ("the local file doesn't exist; I'll patch base instead").

**Why it happens:** Defensive coding instinct.

**How to avoid:** `loadConfig`'s `absent` arm yields an empty starting shape that `saveConfig` writes back to the LOCAL file -- saveConfig CREATES the file. Trust the seam; never read targetConfigPath conditionally.

**Warning signs:** Any `if (await pathExists(localPath))` check around the targetConfigPath selection.

### Pitfall 3: Calling saveConfig from inside an orchestrated-mode arm

**What goes wrong:** The apply path drives the orchestrator with `mode: "orchestrated"`; the orchestrator writes back the entry into the base file; the user's authored local-override `enabled: false` declaration in `claude-plugins.local.json` is overwritten by the now-also-in-base-file `enabled: true` from the apply path.

**Why it happens:** Symmetry instinct ("if standalone writes back, orchestrated should too").

**How to avoid:** Mirror Phase 54 WR-09 EXACTLY: `if (!orchestrated) { await writeConfigEntry(...); }`. The apply path's input IS the merged config; writing back would be a tautological round-trip.

**Warning signs:** `saveConfig` invoked unconditionally inside an orchestrator that accepts a `notifications: { mode: "orchestrated" }` option.

### Pitfall 4: Cascade-incomplete `marketplace remove`

**What goes wrong:** `marketplace remove context7` deletes the `marketplaces["context7"]` entry from the config but leaves `plugins["foo@context7"]` behind; on next reconcile, the planner sees a plugin keyed under a non-declared marketplace and emits a `<marketplace not declared>` source-mismatch diagnostic forever.

**Why it happens:** The state-side cascade (Phase 51 `delete state.marketplaces[name]` + iterated plugin unstage) is conceptually separate from the config-side cascade, so the author writes the marketplace delete without the plugin sweep.

**How to avoid:** The shared helper exposes `deleteMarketplaceWithCascade(current, name)` that iterates `current.plugins` and deletes every key ending in `@<name>`. The caller's only job is to invoke the helper with the marketplace name; the cascade lives ONE place.

**Warning signs:** A `delete current.marketplaces[name]` site without an accompanying `Object.keys(current.plugins).filter(...)` loop.

### Pitfall 5: Idempotent flip mtime drift

**What goes wrong:** `autoupdate enable foo` -- foo is ALREADY autoupdate-enabled -- the orchestrator nonetheless writes the entry back to the config; mtime changes; the next `preview` reports a phantom `(updated)` row OR the Phase 52 SC#4 / RECON-05 byte-stable convergence proof fails.

**Why it happens:** The author moves write-back BEFORE the idempotency check.

**How to avoid:** Place the write-back AFTER the idempotency arm returns. Mirror enable-disable.ts:376-378.

**Warning signs:** `await writeConfigEntry(...)` appears before the `if (outcome.kind === "idempotent") return;` short-circuit.

### Pitfall 6: SPLIT-01 read-path divergence window

**What goes wrong:** After Phase 56, autoupdate write-back targets the config, but the 8 SPLIT-01 cast-read sites still read from the state record. The state record's autoupdate field is NEVER updated post-write-back (the write only touches the config now), so list/info shows STALE autoupdate values until the next reconcile.

**Why it happens:** SPLIT-01 cast sites were tagged for rewire "in Phases 54-56" but the read-path rewire is a separate task from the write-back wire-up.

**How to avoid:** Either (a) rewire all 8 SPLIT-01 read sites to consult `loadMergedScopeConfig` in the same phase, OR (b) keep the state record's `autoupdate` field in sync by writing both during write-back (write-through cache pattern) until a later milestone removes the read sites.

**Recommendation:** Option (a). The state record is the implementation detail; the config is the user-facing source of truth. Rewiring the read sites in Plan 03 ties the loop closed within Phase 56.

**Warning signs:** A `list --filter autoupdate=true` query post-Phase-56 returns entries whose flag was just toggled by a command.

### Pitfall 7: Catalog UAT byte drift from new `--local` usage strings

**What goes wrong:** Adding `[--local]` to the USAGE strings of 8 handlers introduces 8 new byte forms; catalog-uat.test.ts's USAGE-string assertions break.

**Why it happens:** Catalog UAT is byte-equality on rendered output.

**How to avoid:** USAGE strings are emitted ONLY on USAGE errors (`notifyUsageError`); they are NOT part of catalog states unless a fixture explicitly exercises a usage-error path. Audit the catalog-uat FIXTURES file for any `Usage:` string assertions and update them in lockstep IN THE SAME COMMIT (the atomic-supersession discipline from v1.3 / v1.10 / v1.11).

**Warning signs:** Any catalog-uat FIXTURES entry whose body contains `Usage:` text.

### Pitfall 8: Import batched-save losing state mutations

**What goes wrong:** Import drives `addMarketplace` + `installPlugin` in orchestrated mode under N independent `withStateGuard` calls (one per entry). Then a SEPARATE Phase 56 batched-save acquires the lock AGAIN, reads the config, writes N entries. Between the last orchestrator's lock release and the batched-save's lock acquire, a concurrent process can race.

**Why it happens:** Each orchestrator owns its own lock; the batched save is "after" all of them.

**How to avoid:** This is a real correctness limitation but acceptable: each orchestrator's per-entry state mutation is committed atomically before the next entry runs; the batched config save reflects the state at the moment the import completed. A concurrent process between the last orchestrator and the batched save can only OBSERVE the partially-committed state -- the next reconcile would see config out of sync and emit a plan to fix it. This is the same race window the standalone path has TODAY and is governed by NFR-3 retry safety.

**Documentation:** Inline comment in import/execute.ts post-pass explaining the race window is bounded and self-healing on next reconcile.

## Code Examples

### Example 1: Shared write-back helper module (new)

```typescript
// Source: NEW -- extensions/pi-claude-marketplace/persistence/config-write-back.ts
// Phase 56 / WB-01 / WB-02 / WB-03 / WB-04
//
// Single sanctioned config-write-back module. All mutating-command write-backs
// route through these helpers; they wrap saveConfig (the SOLE sanctioned writer
// per SPLIT-02) with entry-level patch semantics that preserve unknown keys
// (D-09 lenient schema) and select the targeted physical file (--local).

import { saveConfig, type ScopeConfig, type MarketplaceConfigEntry, type PluginConfigEntry } from "./config-io.ts";

/**
 * Write a marketplace entry by entry-level patch. The `patch` is spread into
 * the existing entry, so unknown forward-compat keys are preserved (D-09 /
 * round-trip integrity per WB-01).
 */
export async function writeMarketplaceConfigEntry(
  current: ScopeConfig,
  targetConfigPath: string,
  scopeRoot: string,
  marketplace: string,
  patch: Partial<MarketplaceConfigEntry>,
): Promise<void> {
  const existing = current.marketplaces?.[marketplace] ?? {};
  // `source` is required on the schema; require it on the merged entry.
  // The caller MUST supply source on the add path; on autoupdate/remove
  // the existing entry MUST already carry source.
  const merged: MarketplaceConfigEntry = { ...existing, ...patch } as MarketplaceConfigEntry;
  const patched: ScopeConfig = {
    ...current,
    schemaVersion: 1,
    marketplaces: { ...(current.marketplaces ?? {}), [marketplace]: merged },
  };
  await saveConfig(targetConfigPath, patched, scopeRoot);
}

/**
 * Delete a marketplace entry AND cascade-delete every plugin entry whose
 * key ends in `@<marketplace>`. Mirrors the state-side cascade so reconcile
 * remains a no-op after `marketplace remove`.
 */
export async function deleteMarketplaceConfigEntryWithCascade(
  current: ScopeConfig,
  targetConfigPath: string,
  scopeRoot: string,
  marketplace: string,
): Promise<void> {
  const marketplaces = { ...(current.marketplaces ?? {}) };
  delete marketplaces[marketplace];

  const suffix = `@${marketplace}`;
  const plugins: Record<string, PluginConfigEntry> = {};
  for (const [key, entry] of Object.entries(current.plugins ?? {})) {
    if (!key.endsWith(suffix)) plugins[key] = entry;
  }

  const patched: ScopeConfig = { ...current, schemaVersion: 1, marketplaces, plugins };
  await saveConfig(targetConfigPath, patched, scopeRoot);
}

export async function writePluginConfigEntry(
  current: ScopeConfig,
  targetConfigPath: string,
  scopeRoot: string,
  plugin: string,
  marketplace: string,
  patch: Partial<PluginConfigEntry>,
): Promise<void> {
  const key = `${plugin}@${marketplace}`;
  const existing = current.plugins?.[key] ?? {};
  const merged: PluginConfigEntry = { ...existing, ...patch };
  const patched: ScopeConfig = {
    ...current,
    schemaVersion: 1,
    plugins: { ...(current.plugins ?? {}), [key]: merged },
  };
  await saveConfig(targetConfigPath, patched, scopeRoot);
}

export async function deletePluginConfigEntry(
  current: ScopeConfig,
  targetConfigPath: string,
  scopeRoot: string,
  plugin: string,
  marketplace: string,
): Promise<void> {
  const key = `${plugin}@${marketplace}`;
  const plugins = { ...(current.plugins ?? {}) };
  delete plugins[key];
  const patched: ScopeConfig = { ...current, schemaVersion: 1, plugins };
  await saveConfig(targetConfigPath, patched, scopeRoot);
}

/**
 * Batched multi-entry patch: read once, apply N patches in memory, save once.
 * Used by import (WB-03) and (optionally) bootstrap (WB-04).
 */
export interface BatchedConfigPatch {
  readonly marketplaces?: Record<string, Partial<MarketplaceConfigEntry>>;
  readonly plugins?: Record<string, Partial<PluginConfigEntry>>;
}

export async function writeBatchedConfigEntries(
  current: ScopeConfig,
  targetConfigPath: string,
  scopeRoot: string,
  batch: BatchedConfigPatch,
): Promise<void> {
  const marketplaces = { ...(current.marketplaces ?? {}) };
  for (const [name, patch] of Object.entries(batch.marketplaces ?? {})) {
    const existing = marketplaces[name] ?? {};
    marketplaces[name] = { ...existing, ...patch } as MarketplaceConfigEntry;
  }

  const plugins = { ...(current.plugins ?? {}) };
  for (const [key, patch] of Object.entries(batch.plugins ?? {})) {
    plugins[key] = { ...(plugins[key] ?? {}), ...patch };
  }

  const patched: ScopeConfig = { ...current, schemaVersion: 1, marketplaces, plugins };
  await saveConfig(targetConfigPath, patched, scopeRoot);
}
```

### Example 2: Wiring write-back into `addMarketplace`

```typescript
// Source: orchestrators/marketplace/add.ts -- post-Phase-56 shape
//
// Before line 482 (the success notify), add the write-back inside a NEW
// withLockedStateTransaction OR convert the existing withStateGuard to
// withLockedStateTransaction + explicit tx.save() so the config write
// participates in the SAME lock as the state save.

// Switch withStateGuard → withLockedStateTransaction:
await withLockedStateTransaction(locations, async (tx) => {
  const state = tx.state;
  // (existing state mutation; sets recordedName)

  // Phase 56 / WB-01 / WB-02:
  if (opts.notifications?.mode !== "orchestrated") {
    const targetConfigPath = opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath;
    const cfg = await loadConfig(targetConfigPath);
    if (cfg.status === "invalid") {
      // CFG-03 abort -- this is a real precondition violation; surface and skip the state save too.
      throw new InvalidConfigAbortError(path.basename(targetConfigPath));
    }
    const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
    await writeMarketplaceConfigEntry(
      current,
      targetConfigPath,
      locations.scopeRoot,
      recordedName,
      { source: opts.rawSource },     // ← VERBATIM user input (Pitfall 6, source-matching reconcile)
    );
  }

  await tx.save();
});
```

**Critical:** The `source` field MUST be the user-typed `rawSource` (verbatim), NOT the parsed source object's `.raw` field (they happen to be equal today via SP-7 but the user's intent is the raw string). This matches what `planReconcile` compares via `samePlannedSource(recordedRecord.source, declaredEntry.entry.source)`.

### Example 3: Round-trip integrity test (WB-01 SC#4)

```typescript
// Source: NEW -- tests/architecture/config-state-consistency.test.ts (or extend write-seams)
// WB-01 SC#4: after each mutating command, reconcile is a no-op AND unknown
// keys are preserved.

test("WB-01 SC#4: write-back preserves unknown keys + reconcile no-op after add", async () => {
  // 1. Set up a fixture: empty state, claude-plugins.json with one unknown field.
  await writeFile(configJsonPath, JSON.stringify({
    schemaVersion: 1,
    marketplaces: { "existing": { source: "owner/repo", autoupdate: true, futureField: "preserve me" } },
    futureTopLevel: "also preserve",
  }));

  // 2. Run a mutating command (e.g. addMarketplace).
  await addMarketplace({...});

  // 3. Read back the config; assert unknown fields survived.
  const after = JSON.parse(await readFile(configJsonPath, "utf8"));
  assert.equal(after.marketplaces.existing.futureField, "preserve me");
  assert.equal(after.futureTopLevel, "also preserve");

  // 4. Run planReconcile(mergeScopeConfigs(after, {}), state, scope); assert empty plan.
  const plan = planReconcile(mergeScopeConfigs(after, {}), state, scope);
  assert.deepEqual(plan, emptyReconcilePlan(scope));
});
```

### Example 4: README CFG-04 section (between Scoping and `/claude:plugin` reference)

````markdown
## Configuration files

Each scope stores its declarative marketplace and plugin configuration in
`claude-plugins.json` under the scope root:

| Scope     | File path                                |
| --------- | ---------------------------------------- |
| `user`    | `~/.pi/claude-plugins.json`              |
| `project` | `<cwd>/.pi/claude-plugins.json`          |

Every mutating command (`marketplace add`, `marketplace remove`,
`marketplace autoupdate`, `marketplace noautoupdate`, `install`,
`uninstall`, `enable`, `disable`, `import`, `bootstrap`) records its
change into this file. The file is the authoritative record of which
marketplaces and plugins are installed; Pi re-applies its contents at
extension load (`/reload`).

### `claude-plugins.local.json` and the `.local` convention

Each scope can also have a `claude-plugins.local.json` file alongside the
base file:

| Scope     | File path                                      |
| --------- | ---------------------------------------------- |
| `user`    | `~/.pi/claude-plugins.local.json`              |
| `project` | `<cwd>/.pi/claude-plugins.local.json`          |

The local file overrides individual entries from the base file:
a marketplace or plugin entry in `claude-plugins.local.json` replaces the
same-keyed entry in `claude-plugins.json` wholesale.

Pass `--local` to any mutating command to target the local file instead:

```text
/claude:plugin install context7-plugin@context7-marketplace --local
/claude:plugin marketplace autoupdate context7-marketplace --local
```

A `--local` write never touches the base file.

### Gitignore convention

For project scope, commit `claude-plugins.json` so collaborators install
the same marketplaces and plugins, but keep `claude-plugins.local.json`
out of version control. Add the following to your project's `.gitignore`:

```text
.pi/claude-plugins.local.json
```

User-scope files live in your home directory; they are personal and never
shared.
````

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| state.json as authoritative source of truth | claude-plugins.json + .local.json as authoritative; state.json as machine bookkeeping | Phase 51 (SPLIT-01) | Phase 56 closes the loop by wiring write-back so the config stays in sync with reality after every mutation |
| autoupdate read from state record via cast | autoupdate read from MergedConfig | Phase 56 (rewire SPLIT-01 sites) | 8 read sites updated; user-visible byte forms unchanged |
| `--local` only on enable/disable | `--local` on every mutating command | Phase 56 | 7 new handlers gain the flag; usage strings extended |
| One per-entry write-back (enable/disable) | Single-entry pattern + batched multi-entry (import/bootstrap) | Phase 56 | New batched helper avoids N reads + N saves under N locks |

**Deprecated/outdated:**

- Reading `state.marketplaces[name].autoupdate` via `as unknown as Record<string, unknown>` cast (the 8 SPLIT-01 sites). Replace with `loadMergedScopeConfig(loc).merged.marketplaces[name]?.entry.autoupdate ?? false`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 56 should rewire ALL 8 SPLIT-01 cast-read sites to consult the merged config | Pitfall 6 / State of the Art | If user wants to defer the read-rewire to a later milestone, the divergence window (Pitfall 6) ships as a known issue |
| A2 | Bootstrap should keep the composed 2-write shape (1 add + 1 autoupdate) rather than a batched single-write | Pattern 3 | Doubles the bootstrap file I/O (negligible) but matches WB-04's letter ("records its marketplace AND autoupdate setting") |
| A3 | `--local` writes must NEVER fall back to base on local-file ENOENT | Pitfall 2 / Pattern 1 | If user wants ENOENT-fallback behavior, the WB-02 letter ("`--local` writes never touch the base file") is violated; A1 needs operator confirmation |
| A4 | The round-trip integrity test belongs in `tests/architecture/` alongside the SPLIT-02 write-seams test | Code Example 3 | If the test belongs under `tests/orchestrators/`, the structure shifts but coverage is equivalent |
| A5 | `marketplace update` and `plugin update` and `plugin reinstall` do NOT write back -- they're non-declarative (they refresh existing entries without changing declarations) | Architecture Patterns project structure | If user wants these to refresh the config too (e.g. update lastUpdatedAt-equivalent), the WB-01 letter explicitly enumerates "marketplace add/remove/autoupdate/noautoupdate, plugin install/uninstall/reinstall/update" -- so reinstall and both updates ARE on the list. **Risk: I underclassified these. Reinstall + update should write back too, even if the patch is a no-op on the entry level.** Re-evaluate during plan. |
| A6 | The 8th SPLIT-01 site (`persistence/state-io.ts:76`) is the schema-level comment, not a cast-read site; the actual user code sites are 7 (excluding state-io.ts and migrate-config.ts) | SPLIT-01 audit | If 8 vs 7 matters for the rewire count, recheck the grep against `as unknown as Record<string, unknown>` reads of `autoupdate` -- I counted 7 actionable code sites: marketplace/list.ts, marketplace/info.ts, marketplace/shared.ts (×2), marketplace/update.ts, plugin/list.ts, plugin/info.ts |
| A7 | `reinstall` and `update` write-back is best modeled as `writeMarketplaceConfigEntry(...,{source: opts.rawSource})` / `writePluginConfigEntry(..., {})` -- preserving the existing entry shape with no fields actually changing | Project Structure | If the patch is empty AND the existing entry equals it, the round-trip is a no-op write that would burn an mtime cycle. **Recommendation: short-circuit when the patched entry deep-equals the existing entry, mirroring Pitfall 5's discipline.** This is a refinement of the idempotency skip pattern. |

**Action for the planner:** Re-evaluate A5 + A7 with the operator before locking the orchestrator scope. The Phase 56 success criteria #1 verbatim says "marketplace add/remove/autoupdate/noautoupdate and plugin install/uninstall/reinstall/update" -- so reinstall and update ARE in scope, but their write-back is a near-no-op patch.

## Open Questions

1. **Should `reinstall` and `update` write a no-op patch or skip entirely?**
   - What we know: Success criterion #1 lists them; they don't change the declarative shape.
   - What's unclear: Whether the write-back should fire (with a deep-equal short-circuit) or skip outright.
   - Recommendation: Implement the deep-equal short-circuit -- this preserves the success criterion's letter (a write-back path exists) AND the RECON-05 fixed-point invariant (no-op flips don't mtime-drift the file).

2. **Should `extractLocalFlag` live in `edge/handlers/shared.ts` or in a new module?**
   - What we know: Phase 54's instance is at `edge/handlers/plugin/enable-disable.ts:49-84`.
   - What's unclear: Whether the existing `edge/handlers/marketplace/shared.ts` is the right home (it currently hosts `makeSingleNameMarketplaceHandler`), or a new `edge/handlers/local-flag.ts` is cleaner.
   - Recommendation: `edge/handlers/shared.ts` (a new file at that path, since today `marketplace/` and `plugin/` each have their own `shared.ts`). The `--local` flag is cross-cutting across both subtrees.

3. **Should the architecture test for `mergeScopeConfigs` import be added?**
   - What we know: Pitfall 1 (writing the merged view back) is a real anti-pattern.
   - What's unclear: Whether grep-gating the import is worth the test surface.
   - Recommendation: Yes, extend `config-state-write-seams.test.ts` with a regex that forbids `mergeScopeConfigs` / `loadMergedScopeConfig` imports from any orchestrator file. Cheap, structural, catches the highest-risk anti-pattern.

4. **Should the README config-files section live before or after the `/claude:plugin` reference?**
   - What we know: README outline currently has Scoping (line 122) → `/claude:plugin` reference (line 130).
   - What's unclear: Best position for discoverability.
   - Recommendation: Insert as `## Configuration files` between Scoping and the `/claude:plugin` reference (lines 122-130 zone). Scoping discusses where things go; configuration files discuss the file-level data model that backs it. Natural flow.

## Environment Availability

> Skipped -- Phase 56 has no new external dependencies. Code/config-only changes.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node ≥22.18 native; bundled) |
| Config file | none -- npm scripts in `package.json` invoke `node --test` directly |
| Quick run command | `npm test -- tests/orchestrators/<changed>.test.ts` (per-file) |
| Full suite command | `npm run check` (typecheck + lint + format + tests + integration) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WB-01 | Each mutating command writes back a targeted entry-level patch | unit | `npm test -- tests/orchestrators/marketplace/add.test.ts tests/orchestrators/marketplace/remove.test.ts tests/orchestrators/marketplace/autoupdate.test.ts tests/orchestrators/plugin/{install,uninstall,reinstall,update}.test.ts` | ✅ (extend) |
| WB-01 SC#4 | Round-trip integrity (unknown keys preserved + reconcile no-op) | architecture | `npm test -- tests/architecture/config-state-consistency.test.ts` | ❌ Wave 0 |
| WB-02 | `--local` targets local file; never touches base | unit | covered in the per-orchestrator tests above with `local: true` fixture variants | ✅ (extend) |
| WB-02 edge | edge handlers parse `--local` and forward | unit | `npm test -- tests/edge/handlers/{marketplace,plugin}/*.test.ts` | ✅ (extend) |
| WB-03 | `import` writes batched multi-entry patch under one lock | unit | `npm test -- tests/orchestrators/import/execute.test.ts` | ✅ (extend) |
| WB-04 | `bootstrap` writes marketplace + autoupdate to config | unit | `npm test -- tests/orchestrators/plugin/bootstrap.test.ts` | ✅ (extend) |
| CFG-04 | README documents config workflow + gitignore convention | manual + content lint | Manual review of `README.md`; markdownlint runs in `npm run check` | ✅ (extend README) |
| SPLIT-02 (verification) | No new `atomicWriteJson(<...>configJsonPath,...)` callsites outside the allow-list | architecture | `npm test -- tests/architecture/config-state-write-seams.test.ts` | ✅ (verify pattern) |
| SPLIT-01 (rewire verification) | The 7 cast-read sites are removed | architecture | NEW -- `tests/architecture/no-split-01-cast-reads.test.ts` (forbids the literal `as unknown as Record<string, unknown>).autoupdate` substring in non-allowed files) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- <changed test file>` (< 5s per file)
- **Per wave merge:** `npm test` (full unit suite, ~10s)
- **Phase gate:** `npm run check` GREEN before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/architecture/config-state-consistency.test.ts` -- covers WB-01 SC#4 (round-trip + reconcile no-op)
- [ ] `tests/architecture/no-split-01-cast-reads.test.ts` -- gates SPLIT-01 rewire completion (optional; can be merged into write-seams test)
- [ ] Per-orchestrator test fixtures with `local: true` variants (e.g. `addMarketplace --local` exercises base-file untouched + local-file written) -- extend existing test files

*(All other Phase 56 behaviors are covered by extending existing test files in lockstep with the orchestrator changes.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface in Phase 56 (config-file writes inside an existing process) |
| V3 Session Management | no | No sessions |
| V4 Access Control | yes | NFR-10 path containment via `assertPathInside(scopeRoot, filePath, "saveConfig")` -- already enforced inside saveConfig |
| V5 Input Validation | yes | typebox `CONFIG_VALIDATOR.Check` (already inside saveConfig); raw user-typed `--local` flag scanner (rejects unknown long flags via notifyUsageError) |
| V6 Cryptography | no | No crypto |
| V12 File and Resources | yes | NFR-1 atomic write via `atomicWriteJson` → `write-file-atomic`; NFR-10 containment at write site |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via attacker-controlled `targetConfigPath` | Tampering | `targetConfigPath` is derived from `ScopedLocations` (hard-coded suffix on scopeRoot), NEVER from user input; `assertPathInside` enforces at write site |
| Race write to claude-plugins.json across two Pi processes | Tampering | `withLockedStateTransaction` per-scope `proper-lockfile`; ELOCKED → StateLockHeldError; serialized cross-process |
| Schema-invalid patch corrupting the file | Tampering | `CONFIG_VALIDATOR.Check(config)` runs INSIDE saveConfig as a caller-bug guard; a malformed patch throws before the disk touch |
| Information disclosure of absolute filesystem paths in errors | Information disclosure | T-54-02-02 / T-53-02-02 mitigation: surface only `path.basename(targetConfigPath)` in user-visible messages (already preserved in enable-disable.ts; replicate) |
| Cross-scope leak (writing user-scope content to project scope or vice-versa) | Tampering / Information disclosure | scope is resolved BEFORE entering the lock; `locations` is derived from scope; `targetConfigPath` is `locations.configJsonPath` / `locations.configLocalJsonPath` -- no cross-scope read or write surface |
| Unbounded entry growth (DoS via massive config) | DoS | Out of scope -- the config is user-authored; an attacker who can author the config can author whatever they want |

## Sources

### Primary (HIGH confidence)

- `[VERIFIED: codebase]` `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` -- Phase 54 frozen `writeConfigEntry` + WR-09 orchestrated-mode skip pattern (lines 267-289, 380-400)
- `[VERIFIED: codebase]` `extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts:49-84` -- Phase 54 frozen `extractLocalFlag` shape
- `[VERIFIED: codebase]` `extensions/pi-claude-marketplace/persistence/config-io.ts` -- saveConfig SOLE writer + SPLIT-02 path-containment write-site enforcement
- `[VERIFIED: codebase]` `extensions/pi-claude-marketplace/persistence/config-merge.ts` -- MergedConfig shape and the per-entry `source: "base" | "local"` provenance (line 47-50 commentary explicitly references Phase 56 write-back)
- `[VERIFIED: codebase]` `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` -- withLockedStateTransaction surface used by Phase 54; non-re-entrant under proper-lockfile
- `[VERIFIED: codebase]` `tests/architecture/config-state-write-seams.test.ts` -- SPLIT-02 architecture test using path-name-specific regex (does NOT need allow-list edit for new saveConfig callers)
- `[VERIFIED: codebase]` `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` -- planReconcile compares `recordedRecord.source` to `declaredEntry.entry.source` via `samePlannedSource` (this dictates the verbatim-rawSource write-back contract)
- `[VERIFIED: codebase]` `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:120-179` -- the per-scope read pass under withLockedStateTransaction that Phase 56 must not disturb
- `[VERIFIED: codebase]` All 7 SPLIT-01 cast-read sites: `marketplace/{list,info,update,shared}.ts` + `plugin/{list,info}.ts` + the read in `marketplace/info.ts:122`
- `[CITED: .planning/REQUIREMENTS.md]` WB-01/02/03/04 + CFG-04 verbatim text (lines 40-44, 18)
- `[CITED: .planning/phases/54-enable-disable-commands/54-02-SUMMARY.md]` Phase 54 closure narrative including CR-01 nested-lock prohibition and Pitfall 54-1/4/5/7

### Secondary (MEDIUM confidence)

- `[CITED: .planning/phases/55-load-time-reconcile-apply-notification-wiring/55-02-SUMMARY.md]` Phase 55 closure narrative; WR-09 orchestrated-mode skip
- `[CITED: .planning/STATE.md]` Phase 56 hand-off context + SPLIT-01 deferred rewire decision (2026-06-10 user-approved cast-and-tag with rewire in Phases 54-56)

### Tertiary (LOW confidence)

- None. Phase 56 is fully grounded in existing codebase patterns and frozen Phase 54-55 architecture.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- no new dependencies; existing seams locked in Phases 51-55
- Architecture: HIGH -- patterns frozen in Phase 54; replication path is mechanical
- Pitfalls: HIGH -- 8 pitfalls drawn from Phase 54/55 review fixes (WR-01, WR-09, Pitfall 54-1/5/7, CR-01) + reconcile invariants (RECON-05, SC#4)
- SPLIT-01 rewire scope: MEDIUM -- the 7-site count is verified by grep, but whether to rewire all in Phase 56 or defer some is an Open Question
- Bootstrap batched-vs-composed: MEDIUM -- A2 marks the composed-shape decision; either shape satisfies WB-04
- Update/reinstall write-back semantics: MEDIUM -- A5/A7 mark the "near-no-op patch" deep-equal short-circuit decision

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (30 days; v1.12 frozen foundation makes the patterns stable; only the planner's question of plan decomposition is fluid)
