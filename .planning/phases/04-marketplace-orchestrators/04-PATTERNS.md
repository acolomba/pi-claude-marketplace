# Phase 4: Marketplace Orchestrators - Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 22 (10 new source + 11 new test + 1 V1 reference)
**Analogs found:** 22 / 22 (every file has a strong Phase 1-3 analog)

______________________________________________________________________

## Why This Map Matters

Phase 1-3 deliberately built the foundation Phase 4 needs. **There is no V1-style monolithic orchestrator in the codebase yet** -- the `orchestrators/` directory is a placeholder (`orchestrators/index.ts` is `export {}`). Phase 4 is the first real consumer of `withStateGuard`, `platform/git.ts`, and the bridge `unstage*` surface.

Closest analogs therefore live one layer down:

- **Bridge files** (`bridges/*/{unstage,stage,index}.ts`) for module shape: imports, exported function signatures, frozen-result discipline, `node:fs/promises` IO pattern, ENOENT idempotency, header docstring with REQ-ID + V1 cross-reference.
- **`transaction/with-state-guard.ts`** for the load-mutate-save closure shape that every mutating orchestrator copies.
- **`persistence/locations.ts`** for the `assertPathInside` chokepoint pattern and the `Object.freeze` brand discipline.
- **`bridges/index.ts`** files for the public-surface barrel idiom (one re-export line per public symbol + `export type {}` block).
- **V1 (`features/initial:.../marketplace/*.ts`)** for the high-level subcommand SHAPE only -- not the implementation details (D-14 supersedes V1's `pull --ff-only`; D-09 supersedes V1's staging location).

The planner uses this map to point every new file at the closest existing file from which to copy imports, error-handling, and frozen-result shape. Where excerpts are reproduced below they are load-bearing copy-templates, not summaries.

______________________________________________________________________

## File Classification

### Source Files (new under `extensions/claude-marketplace/`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `orchestrators/types.ts` | types-only module | n/a (static types) | `extensions/claude-marketplace/bridges/agents/types.ts` | role-match |
| `orchestrators/marketplace/shared.ts` | shared utility module (cross-orchestrator) | request-response (sync state mutation + async cascade) | `extensions/claude-marketplace/shared/errors.ts` + `bridges/agents/unstage.ts` (cascade composition) | role-match |
| `orchestrators/marketplace/add.ts` | orchestrator (mutating) | request-response with network IO + atomic-rename | `bridges/agents/stage.ts` (closest staging+commit shape) + `transaction/with-state-guard.ts` (guard envelope) | role-match |
| `orchestrators/marketplace/remove.ts` | orchestrator (mutating) | request-response with cascade | `bridges/agents/unstage.ts` (per-entry try/catch loop + outcome partitioning) | exact-shape |
| `orchestrators/marketplace/list.ts` | orchestrator (read-only) | request-response (state read + format) | `tests/persistence/state-io.test.ts` (state-read pattern) + `extensions/claude-marketplace/persistence/state-io.ts::loadState` | role-match |
| `orchestrators/marketplace/update.ts` | orchestrator (mutating + cascade fan-out) | request-response with network IO + injected fn | `bridges/agents/stage.ts` (prepare-then-commit) + `transaction/with-state-guard.ts` | role-match |
| `orchestrators/marketplace/autoupdate.ts` | orchestrator (mutating, no IO beyond state) | request-response (state mutation only) | `bridges/skills/unstage.ts` (simplest mutator) + `transaction/with-state-guard.ts` | role-match |
| `presentation/reload-hint.ts` | presentation helper (pure string composition) | transform (function-only) | `extensions/claude-marketplace/shared/markers.ts` (constants source) + `bridges/agents/marker.ts` (composer pattern) | role-match |
| `presentation/soft-dep.ts` | presentation helper (capability probe + string composition) | request-response (probe + transform) | `extensions/claude-marketplace/shared/notify.ts` (ctx parameter shape) | role-match |
| `presentation/marketplace-list.ts` | presentation helper (pure formatter) | transform | `presentation/reload-hint.ts` (Phase 4 sibling) | role-match (sibling) |
| `persistence/locations.ts` (extension) | locations helper extension (existing file) | n/a (path-string compute) | EXISTING: `extensions/claude-marketplace/persistence/locations.ts` -- add a method to the `ScopedLocations` interface following the `sourceCloneDir(mp)` pattern | EXACT (extending existing) |
| `domain/source.ts` (extension) | helper export extension (existing file) | n/a (pure) | EXISTING: `extensions/claude-marketplace/domain/source.ts` -- add `sourceLogical(source: ParsedSource): string` discriminated-union switch | EXACT (extending existing) |
| `shared/errors.ts` (extension) | error class additions (existing file) | n/a (types) | EXISTING: `extensions/claude-marketplace/shared/errors.ts` -- add 4 new error classes following the `Error` extension pattern at the bottom of the file | EXACT (extending existing) |

### Test Files (new under `tests/`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tests/orchestrators/marketplace/add.test.ts` | unit test (mocked git) | request-response | `tests/bridges/agents/stage.test.ts` | role-match |
| `tests/orchestrators/marketplace/remove.test.ts` | unit test (cascade) | request-response | `tests/bridges/agents/unstage.test.ts` + `tests/bridges/integration-foreign-content.test.ts` | role-match |
| `tests/orchestrators/marketplace/list.test.ts` | unit test (read-only) | request-response | `tests/persistence/state-io.test.ts` | role-match |
| `tests/orchestrators/marketplace/update.test.ts` | unit test (mocked git + mocked PluginUpdateFn) | request-response | `tests/bridges/agents/stage.test.ts` + `tests/transaction/with-state-guard.test.ts` | role-match |
| `tests/orchestrators/marketplace/autoupdate.test.ts` | unit test (state mutation only) | request-response | `tests/bridges/skills/unstage.test.ts` (simplest mutator test shape) | role-match |
| `tests/orchestrators/marketplace/cascade.test.ts` | unit test (primitive in isolation) | request-response | `tests/bridges/integration-foreign-content.test.ts` (cross-bridge composition) | role-match |
| `tests/presentation/reload-hint.test.ts` | snapshot test (pure formatter) | transform | `tests/architecture/markers-snapshot.test.ts` (PRD-as-fixture) | exact-shape |
| `tests/presentation/soft-dep.test.ts` | unit test (capability probe via mocked ctx) | request-response | `tests/shared/notify.test.ts` (ExtensionContext mocking) | role-match |
| `tests/presentation/marketplace-list.test.ts` | unit test (pure formatter) | transform | `tests/architecture/markers-snapshot.test.ts` + sibling `reload-hint.test.ts` | role-match |
| `tests/helpers/git-mock.ts` | test helper (mock factory) | n/a (factory) | `tests/helpers/prd-extract.ts` (Phase 1 test helper precedent) | role-match |
| `tests/orchestrators/marketplace/_fixtures/` | fixture directory | n/a (data) | `tests/bridges/_fixtures/` (Phase 3 fixture layout) | exact-shape |

______________________________________________________________________

## Pattern Assignments

### `orchestrators/types.ts` (types-only module)

**Analog:** `extensions/claude-marketplace/bridges/agents/types.ts` (types-only module shape) and `extensions/claude-marketplace/shared/types.ts` (the `Scope` definition Phase 4 reuses).

**Imports pattern** (one type-only import for `Scope`; no value imports):

```typescript
// orchestrators/types.ts
//
// Cross-orchestrator types (D-06). Sits at the ROOT of `orchestrators/`
// so Phase 4 (marketplace/update.ts) and Phase 5 (plugin/update.ts) both
// import from here without an orchestrators/marketplace ↔
// orchestrators/plugin cycle. Mirrors Phase 3 D-01's escalation note
// about a future BridgeOps<Prep, Target> belonging at this same path.

import type { Scope } from "../shared/types.ts";
```

**Discriminated-union export pattern** (mirrors `ParsedSource` discriminated union in `domain/source.ts:24-44`):

```typescript
/** MU-7 partition tag. */
export type PluginUpdatePartition = "updated" | "unchanged" | "skipped" | "failed";

/**
 * D-06 outcome shape. Discriminated by `partition`; consumers exhaust-switch.
 * Field optionality reflects what MU-7 says each partition carries:
 *   - updated: fromVersion + toVersion required
 *   - unchanged/skipped: name only (notes optional)
 *   - failed: notes contains the chained error message tail
 */
export interface PluginUpdateOutcome {
  readonly partition: PluginUpdatePartition;
  readonly name: string;
  readonly fromVersion?: string;
  readonly toVersion?: string;
  readonly notes?: readonly string[];
}

/**
 * D-05 function-injection seam. Phase 4 calls this once per installed
 * plugin during the autoupdate cascade. Phase 5 ships the real
 * implementation; tests inject a mock. Phase 7's index.ts performs the
 * registration-time wiring.
 */
export type PluginUpdateFn = (
  plugin: string,
  marketplace: string,
  scope: Scope,
) => Promise<PluginUpdateOutcome>;
```

---

### `orchestrators/marketplace/shared.ts` (shared utility module)

**Analog (cascade primitive shape):** `extensions/claude-marketplace/bridges/agents/unstage.ts:50-123` (per-entry outcome partitioning with `Outcome` discriminated union -- the exact shape `cascadeUnstagePlugin` adapts to 4 bridges).

**Analog (GitOps interface placement):** Self-contained interface at file top, default const at file middle. Mirrors `platform/git.ts` shape but at orchestrator layer (D-12: GitOps is local to marketplace orchestrators, not shared).

**Header docstring pattern** (mirrors `transaction/with-state-guard.ts:1-29` and `bridges/agents/unstage.ts:1-15` -- REQ-IDs in title block, D-numbers in body):

```typescript
// orchestrators/marketplace/shared.ts
//
// Cross-subcommand helpers (D-01 SHARED.TS escalation note: cap at ~300 LOC).
//
//   - GitOps interface + DEFAULT_GIT_OPS (D-12, D-13). The interface
//     surface is the FIVE primitives explicitly chosen by D-13:
//     clone + fetch + forceUpdateRef + checkout + resolveRef.
//     NO `pull` -- D-14 follow-upstream-blindly semantics require the
//     three-step force-overwrite path that `pull --ff-only` cannot
//     express.
//
//   - cascadeUnstagePlugin (D-02, D-03): per-plugin hand-rolled
//     try/catch envelope that composes the 4 bridge unstage*
//     primitives in PU-1 order (skills → commands → agents → mcp).
//     Phase 5 reuses this when it ships plugin uninstall.
//
//   - resolveScopeFromState (MR-1, MU-1, MAU-1): cross-scope ambiguity
//     funnel; throws MarketplaceNotFoundError or
//     MarketplaceAmbiguousScopeError.
//
//   - applyAutoupdateFlip (MAU-1..4): single helper used by
//     autoupdate.ts. Consumed by update.ts only if the cascade ever
//     needs to reset the flag (deferred).
//
// Per D-02 ANTI-PATTERN: this file MUST NOT import from `transaction/`
// (no runPhases). Code review enforces; ESLint does not.
```

**Imports pattern** (mirrors `bridges/agents/unstage.ts:17-26` -- group node built-ins, then `extensions/claude-marketplace/*` siblings, then types last):

```typescript
import { unstagePluginAgents } from "../../bridges/agents/index.ts";
import { unstagePluginCommands } from "../../bridges/commands/index.ts";
import { unstageMcpServers } from "../../bridges/mcp/index.ts";
import { unstagePluginSkills } from "../../bridges/skills/index.ts";
import { loadState } from "../../persistence/state-io.ts";
import * as defaultGit from "../../platform/git.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";
```

**Cascade per-plugin try/catch pattern** (modeled on `bridges/agents/unstage.ts:67-97` -- the `Outcome` discriminated union with `kind: "removed" | "preserved"`, here adapted to ok/cause):

```typescript
// PU-1 order: skills → commands → agents → mcp. D-03 fail-fast within
// one plugin's cascade. The FIRST bridge throw halts THIS plugin and
// the plugin lands in failedPlugins[]; already-unstaged resources stay
// unstaged (bridges are idempotent).
export async function cascadeUnstagePlugin(
  plugin: string,
  marketplace: string,
  locations: ScopedLocations,
  installedPlugin: ExtensionState["marketplaces"][string]["plugins"][string],
): Promise<UnstageOutcome> {
  const dropped = {
    skills: [] as string[],
    commands: [] as string[],
    agents: [] as string[],
    mcpServers: [] as string[],
  };

  try {
    const skillsResult = await unstagePluginSkills({
      locations,
      previousSkillNames: installedPlugin.resources.skills,
    });
    dropped.skills = [...skillsResult.removedNames];

    const cmdResult = await unstagePluginCommands({
      locations,
      previousCommandNames: installedPlugin.resources.prompts,
    });
    dropped.commands = [...cmdResult.removedNames];

    const agentsResult = await unstagePluginAgents({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
    });
    dropped.agents = [...agentsResult.removedNames];

    if (agentsResult.failed.length > 0) {
      // AG-5 foreign content: bridge preserved index rows; surface as
      // plugin failure to drive MR-3 aggregation in the caller.
      const reasons = agentsResult.failed
        .map((f) => `${f.generatedName}: ${f.reason}`)
        .join("; ");
      throw new Error(
        `Failed to remove ${agentsResult.failed.length} agent(s): ${reasons}`,
      );
    }

    const mcpResult = await unstageMcpServers({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
    });
    dropped.mcpServers = [...mcpResult.removedNames];

    return { ok: true, dropped };
  } catch (err) {
    return {
      ok: false,
      dropped,
      cause: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
```

**GitOps default-impl pattern** (mirrors `platform/git.ts:88-153` wrapper style -- spread-conditional optional fields):

```typescript
export const DEFAULT_GIT_OPS: GitOps = {
  clone: defaultGit.clone,
  fetch: async (o): Promise<void> => {
    await defaultGit.fetch(o);
  },
  checkout: defaultGit.checkout,
  resolveRef: defaultGit.resolveRef,
  forceUpdateRef: async ({ dir, ref, value }): Promise<void> => {
    // isomorphic-git writeRef({ force: true }) is the documented force-overwrite
    // primitive (verified in node_modules/isomorphic-git/index.d.ts:695).
    const git = await import("isomorphic-git");
    const fs = await import("node:fs");
    await git.writeRef({ fs: fs.default, dir, ref, value, force: true });
  },
};
```

**Error-class additions pattern** (mirrors `shared/path-safety.ts` shipping `PathContainmentError` + `SymlinkRefusedError`):

```typescript
// In shared/errors.ts -- NOT in shared.ts. The 4 new error classes live
// alongside appendLeakToError so the audit surface stays single-file.
export class MarketplaceUpdateError extends Error {
  readonly retryHint: string;
  constructor(message: string, opts: { cause?: unknown; retryHint?: string } = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "MarketplaceUpdateError";
    this.retryHint = opts.retryHint ?? "";
  }
}

export class StaleSourceCloneError extends Error {
  constructor(absPath: string) {
    super(`stale source clone at ${absPath}`);
    this.name = "StaleSourceCloneError";
  }
}

export class MarketplaceNotFoundError extends Error { /* ... */ }
export class MarketplaceDuplicateNameError extends Error { /* ... */ }
```

---

### `orchestrators/marketplace/add.ts` (orchestrator -- mutating)

**Analog:** `bridges/agents/stage.ts` (prepare-then-commit shape) + `transaction/with-state-guard.ts:52-60` (guard envelope) + `bridges/agents/unstage.ts:67-123` (catch-and-cleanup-with-leak shape).

**Header docstring pattern** (REQ-IDs front-loaded; D-numbers in body; V1 cross-reference):

```typescript
// orchestrators/marketplace/add.ts
//
// MA-1..6, MA-8..11. (MA-7 superseded by Phase 1 D-21; isomorphic-git
// removes the "git not found on PATH" failure mode entirely.)
//
// Flow (D-04 outer guard wraps the ENTIRE flow, network IO included):
//
//   withStateGuard(locations, async (state) => {
//     1. MA-8 duplicate check: state.marketplaces[name] -> throw.
//     2. Source-kind dispatch (path | github | unknown).
//     3. If github:
//        - MA-6 stale-clone check: pathExists(finalDir) && non-empty -> throw.
//        - gitOps.clone(stagingDir).
//        - Read + MARKETPLACE_VALIDATOR.Check(manifest.json).
//        - On failure: cleanupStaging(stagingDir, "marketplace clone")
//          + appendLeakToError (D-10).
//        - fs.rename(stagingDir, finalDir).
//     4. If path: validate via parsePluginSource; read manifest at the
//        resolved on-disk location (assertPathInside).
//     5. Mutate state.marketplaces[name] = { ..., plugins: {} }.
//     // Guard saves state.json on no-throw.
//   });
//
//   notifySuccess(ctx, `Added marketplace "<name>" in <scope> scope.`);
//   // MA-11: NO reload hint here -- add never stages resources.
//
// V1 carry-forward: features/initial:extensions/claude-marketplace/
//   marketplace/add.ts (shape only; D-09 staging location supersedes V1;
//   D-12 GitOps injection supersedes V1's direct execFile).
```

**Imports pattern** (mirrors `bridges/agents/stage.ts` import grouping):

```typescript
import { randomUUID } from "node:crypto";
import { readFile, rename } from "node:fs/promises";
import path from "node:path";

import { MARKETPLACE_VALIDATOR } from "../../domain/manifest.ts";
import { parsePluginSource, type ParsedSource } from "../../domain/source.ts";
import { locationsFor, type ScopedLocations } from "../../persistence/locations.ts";
import { notifyError, notifySuccess } from "../../shared/notify.ts";
import { appendLeakToError, errorMessage, MarketplaceDuplicateNameError, StaleSourceCloneError } from "../../shared/errors.ts";
import { cleanupStaging, pathExists } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import { DEFAULT_GIT_OPS, type GitOps } from "./shared.ts";

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { Scope } from "../../shared/types.ts";
```

**Core orchestrator shape** (composition of `withStateGuard` + clone-then-rename, modeled on `bridges/agents/stage.ts` commit pattern):

```typescript
export interface AddMarketplaceOpts {
  readonly ctx: ExtensionContext;
  readonly name: string;
  readonly rawSource: string;
  readonly scope: Scope;            // SC-5: edge layer defaults to user; orchestrator receives resolved scope
  readonly cwd: string;
  readonly gitOps?: GitOps;          // D-12 injection seam; default applied below
}

export async function addMarketplace(opts: AddMarketplaceOpts): Promise<void> {
  const { ctx, name, rawSource, scope, cwd, gitOps = DEFAULT_GIT_OPS } = opts;
  const locations = locationsFor(scope, cwd);
  const source = parsePluginSource(rawSource);

  // MA-10: reject unknown-kind source with the parser's reason.
  if (source.kind === "unknown") {
    throw new Error(`Cannot add marketplace "${name}": ${source.reason}`);
  }

  await withStateGuard(locations, async (state) => {
    // MA-8: duplicate name in this scope.
    if (state.marketplaces[name] !== undefined) {
      throw new MarketplaceDuplicateNameError(name, scope);
    }

    if (source.kind === "github") {
      await addGitHubMarketplace({ state, name, source, locations, gitOps });
    } else {
      await addPathMarketplace({ state, name, source, locations, cwd });
    }
  });

  notifySuccess(ctx, `Added marketplace "${name}" in ${scope} scope.`);
}
```

**Cleanup-with-leak-tracking pattern** (lifted from the bridge prepare-then-commit pattern in `bridges/agents/stage.ts` -- the `appendLeakToError` chain is the canonical recovery primitive):

```typescript
// MA-9: clone advanced but a later step failed -> cleanupStaging +
// appendLeakToError (D-10). Mirrors the bridge prepare→commit→abort
// envelope.
try {
  await gitOps.clone({ dir: stagingDir, url, ref: source.ref });
  const manifest = await loadAndValidateManifest(stagingDir);
  await rename(stagingDir, finalDir);
  // ... mutate state ...
} catch (err) {
  const leak = await cleanupStaging(stagingDir, "marketplace clone");
  throw appendLeakToError(err, leak);
}
```

---

### `orchestrators/marketplace/remove.ts` (orchestrator -- mutating + cascade)

**Analog:** `bridges/agents/unstage.ts:50-123` (per-entry outcome partitioning -- the cascade loop in `remove.ts` is a direct adaptation: replace "agent entry" with "plugin record", replace "rm targetPath" with "cascadeUnstagePlugin").

**Per-plugin loop pattern** (modeled on `bridges/agents/unstage.ts:67-110` outcomes partition):

```typescript
await withStateGuard(locations, async (state) => {
  const record = state.marketplaces[name];
  if (record === undefined) {
    throw new MarketplaceNotFoundError(name, [scope]);
  }

  const failedPlugins: { name: string; cause: Error }[] = [];
  const removedPlugins: string[] = [];
  const droppedTotal = { skills: [] as string[], commands: [] as string[], agents: [] as string[], mcpServers: [] as string[] };

  // D-02: hand-rolled loop. NOT runPhases. The ledger halts on first
  // throw; MR-3 explicitly requires continuation across per-plugin
  // failures.
  for (const [pluginName, plugin] of Object.entries(record.plugins)) {
    const outcome = await cascadeUnstagePlugin(pluginName, name, locations, plugin);
    if (outcome.ok) {
      delete record.plugins[pluginName];
      if (outcome.dropped.skills.length || outcome.dropped.commands.length ||
          outcome.dropped.agents.length || outcome.dropped.mcpServers.length) {
        removedPlugins.push(pluginName);
      }
      droppedTotal.skills.push(...outcome.dropped.skills);
      droppedTotal.commands.push(...outcome.dropped.commands);
      droppedTotal.agents.push(...outcome.dropped.agents);
      droppedTotal.mcpServers.push(...outcome.dropped.mcpServers);
    } else {
      failedPlugins.push({ name: pluginName, cause: outcome.cause! });
    }
  }

  // MR-3 / MR-7: marketplace record retained iff any plugin failed.
  if (failedPlugins.length === 0) {
    delete state.marketplaces[name];
  }

  return { failedPlugins, removedPlugins, droppedTotal };
});
```

**MR-4 single aggregated warning pattern** (mirrors `shared/notify.ts:27-29` -- ONE notifyWarning call per orchestrator end, never per-plugin):

```typescript
// MR-4: ONE aggregated warning notification. Never call notifyError
// inside the per-plugin loop -- multiplies user-visible noise.
if (failedPlugins.length > 0) {
  const body = [
    `Marketplace "${name}" not fully removed.`,
    "",
    "Failed plugins:",
    ...failedPlugins.map((f) => `  - ${f.name}: ${errorMessage(f.cause)}`),
    "",
    "Fix the underlying issue and retry.", // PRD §5.1.2 MR-4 trailer
  ].join("\n");
  notifyWarning(ctx, body);
  return;
}
```

**Post-state cleanup pattern (MR-5/MR-6/MR-7)** (mirrors `shared/fs-utils.ts:31-43` -- `cleanupStaging` returns leak strings, aggregated):

```typescript
// MR-5 / MR-6 / MR-7: post-state cleanup. Aggregated leak descriptors.
const leaks: (string | undefined)[] = [];
for (const pluginName of cleanedPluginNames) {
  leaks.push(await cleanupStaging(await locations.pluginDataDir(name, pluginName), `plugin data ${name}/${pluginName}`));
}
if (failedPlugins.length === 0) {
  leaks.push(await cleanupStaging(await locations.marketplaceDataDir(name), `marketplace data ${name}`));
  if (record.source.kind === "github") {
    leaks.push(await cleanupStaging(await locations.sourceCloneDir(name), `source clone ${name}`));
  }
}
const realLeaks = leaks.filter((l): l is string => l !== undefined);
if (realLeaks.length > 0) {
  throw new Error(`Marketplace removed but post-state cleanup failed for ${realLeaks.length} path(s): ${realLeaks.join("; ")}`);
}
```

---

### `orchestrators/marketplace/list.ts` (orchestrator -- read-only)

**Analog:** `extensions/claude-marketplace/persistence/state-io.ts::loadState` (the canonical state-read entry point; `list` calls it directly without a guard) + `presentation/marketplace-list.ts` (Phase 4 sibling for the rendering).

**Imports pattern** (read-only orchestrator -- NO `transaction/` import):

```typescript
import { loadState } from "../../persistence/state-io.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { notifySuccess } from "../../shared/notify.ts";
import { renderMarketplaceList } from "../../presentation/marketplace-list.ts";

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { Scope } from "../../shared/types.ts";
```

**Core pattern** (ML-3 forbids manifest reads; ML-4 empty case via marker string):

```typescript
export async function listMarketplaces(opts: { ctx: ExtensionContext; scope?: Scope; cwd: string }): Promise<void> {
  // SC-6: bare form (scope omitted) enumerates BOTH scopes.
  const scopes: Scope[] = opts.scope !== undefined ? [opts.scope] : ["user", "project"];
  const allRecords = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    const state = await loadState(locations.extensionRoot); // D-04: NO guard for read-only.
    for (const record of Object.values(state.marketplaces)) {
      allRecords.push(record);
    }
  }
  notifySuccess(opts.ctx, renderMarketplaceList(allRecords));
}
```

---

### `orchestrators/marketplace/update.ts` (orchestrator -- mutating + cascade fan-out)

**Analog:** `orchestrators/marketplace/add.ts` (D-04 guard envelope + GitOps injection) + `bridges/agents/stage.ts` (multi-step commit) + the locked D-14 sequence (`fetch` → `forceUpdateRef` (or noop for SHA) → `checkout`).

**D-14 follow-upstream-blindly sequence** (locked in CONTEXT.md):

```typescript
async function refreshGitHubClone(cloneDir: string, storedRef: string | undefined, gitOps: GitOps): Promise<void> {
  await gitOps.fetch({ dir: cloneDir, remote: "origin", ref: storedRef });

  if (storedRef === undefined) {
    // Default-branch tracking.
    const remoteSha = await gitOps.resolveRef({ dir: cloneDir, ref: "refs/remotes/origin/HEAD" });
    const currentBranch = await gitOps.resolveRef({ dir: cloneDir, ref: "HEAD" });
    await gitOps.forceUpdateRef({ dir: cloneDir, ref: currentBranch, value: remoteSha });
    await gitOps.checkout({ dir: cloneDir, ref: currentBranch });
    return;
  }

  // Probe whether storedRef is a branch on origin.
  let remoteSha: string | undefined;
  try {
    remoteSha = await gitOps.resolveRef({ dir: cloneDir, ref: `refs/remotes/origin/${storedRef}` });
  } catch {
    remoteSha = undefined;
  }

  if (remoteSha !== undefined) {
    await gitOps.forceUpdateRef({ dir: cloneDir, ref: `refs/heads/${storedRef}`, value: remoteSha });
    await gitOps.checkout({ dir: cloneDir, ref: storedRef });
  } else {
    // Detached HEAD or tag. If SHA no longer exists, checkout throws; caller wraps.
    await gitOps.checkout({ dir: cloneDir, ref: storedRef });
  }
}
```

**D-08 outer guard / outside cascade pattern**:

```typescript
// D-08: marketplace state-guard wraps ONLY the refresh + persist.
// Cascade runs OUTSIDE the guard; each PluginUpdateFn call opens its
// own state-guard internally (Phase 5's concern).
const installedPlugins = await withStateGuard(locations, async (state) => {
  const record = state.marketplaces[name];
  if (record === undefined) throw new MarketplaceNotFoundError(name, [scope]);
  let cloneAdvanced = false;
  try {
    if (record.source.kind === "github") {
      const cloneDir = await locations.sourceCloneDir(name);
      await refreshGitHubClone(cloneDir, record.source.ref, gitOps);
      cloneAdvanced = true;
    }
    const manifest = await loadAndValidateManifest(record.marketplaceRoot);
    record.lastUpdatedAt = new Date().toISOString();
    // ... refresh manifestPath/marketplaceRoot from on-disk locations ...
  } catch (err) {
    // MU-5: clone advanced but manifest save failed -> "Retry the command."
    throw new MarketplaceUpdateError(
      cloneAdvanced ? "Marketplace clone advanced but manifest could not be persisted. Retry the command." : `Failed to update marketplace "${name}".`,
      { cause: err, retryHint: cloneAdvanced ? "Retry the command." : "" },
    );
  }

  return { autoupdate: record.autoupdate ?? false, plugins: Object.keys(record.plugins) };
});

// MU-6: cascade gates on the autoupdate flag.
// D-07: plugin enumeration is state-driven, NOT manifest-driven.
if (installedPlugins.autoupdate === true) {
  for (const pluginName of installedPlugins.plugins) {
    const outcome = await pluginUpdate(pluginName, name, scope); // injected PluginUpdateFn (D-05)
    // ... partition into updated/unchanged/skipped/failed (MU-7) ...
  }
}
```

---

### `orchestrators/marketplace/autoupdate.ts` (orchestrator -- state-only mutation)

**Analog:** `bridges/skills/unstage.ts:29-59` (simplest mutator -- single-purpose loop + frozen result). Mostly delegates to `applyAutoupdateFlip` in `shared.ts`.

**Core pattern**:

```typescript
export async function setMarketplaceAutoupdate(opts: {
  ctx: ExtensionContext; name?: string; enable: boolean; scope?: Scope; cwd: string;
}): Promise<void> {
  const scopes: Scope[] = opts.scope !== undefined ? [opts.scope] : ["user", "project"];
  const overallChanged: string[] = [];
  const overallUnchanged: string[] = [];

  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    const result = await withStateGuard(locations, (state) => {
      return applyAutoupdateFlip(state, opts.name, opts.enable); // D-01: applyAutoupdateFlip lives in shared.ts.
    });
    overallChanged.push(...result.changed);
    overallUnchanged.push(...result.unchanged);
  }

  // MAU-3: idempotent flip -- "Already enabled/disabled: ..." for unchanged.
  const verb = opts.enable ? "Enabled" : "Disabled";
  const lines: string[] = [];
  if (overallChanged.length > 0) lines.push(`${verb} autoupdate: ${overallChanged.join(", ")}.`);
  if (overallUnchanged.length > 0) lines.push(`Already ${verb.toLowerCase()}: ${overallUnchanged.join(", ")}.`);
  notifySuccess(opts.ctx, lines.join("\n"));
}
```

---

### `presentation/reload-hint.ts`

**Analog:** `extensions/claude-marketplace/shared/markers.ts` (constants source) + `bridges/agents/marker.ts` (composer pattern -- pure string functions, no IO, no ctx).

**Imports pattern** (NO ExtensionContext -- pure formatter):

```typescript
import { RELOAD_HINT_PREFIX } from "../shared/markers.ts";
```

**Core pattern** (exact copy from RESEARCH.md Pattern 4, verified against PRD §6.8 RH-1/RH-2):

```typescript
export type ReloadVerb = "load" | "refresh" | "drop";

/**
 * RH-1 / RH-2. Returns "" when names is empty (no hint emitted).
 *   - 0 names: ""
 *   - 1 name:  "Run /reload to <verb> it."
 *   - N names: 'Run /reload to <verb> "n1", "n2".'
 *
 * Caller responsibility: pass non-empty names only when generated
 * resources actually changed (RH-1 gate). This function trusts its
 * input and renders mechanically.
 */
export function reloadHint(verb: ReloadVerb, names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${RELOAD_HINT_PREFIX}${verb} it.`;
  return `${RELOAD_HINT_PREFIX}${verb} ${names.map((n) => `"${n}"`).join(", ")}.`;
}

export function appendReloadHint(body: string, hint: string): string {
  return hint === "" ? body : `${body}\n${hint}`;
}
```

---

### `presentation/soft-dep.ts`

**Analog:** `extensions/claude-marketplace/shared/notify.ts` (ExtensionContext parameter shape; pure ctx-consuming function with try/catch graceful-degrade discipline).

**Imports pattern**:

```typescript
import { PI_MCP_ADAPTER_NOT_LOADED, PI_SUBAGENTS_NOT_LOADED } from "../shared/markers.ts";

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
```

**Core probe pattern** (try/catch graceful-degrade per Pitfall 3 in RESEARCH.md):

```typescript
/**
 * RH-3: pi-subagents loaded iff `pi.getAllTools()` contains a tool
 * named "subagent". Pitfall 3: pi.getAllTools() may throw during Pi
 * startup race; treat throw as "not loaded" (spurious warning is the
 * lesser evil).
 */
export function hasLoadedPiSubagents(ctx: ExtensionContext): boolean {
  try {
    return ctx.pi.getAllTools().some((tool) => tool.name === "subagent");
  } catch {
    return false;
  }
}

/**
 * RH-4: pi-mcp-adapter loaded iff tool name === "mcp" OR
 * sourceInfo.source substring-match for "pi-mcp-adapter".
 */
export function hasLoadedPiMcpAdapter(ctx: ExtensionContext): boolean {
  try {
    return ctx.pi.getAllTools().some(
      (tool) => tool.name === "mcp" || tool.sourceInfo?.source?.includes("pi-mcp-adapter"),
    );
  } catch {
    return false;
  }
}
```

---

### `presentation/marketplace-list.ts`

**Analog:** `presentation/reload-hint.ts` (Phase 4 sibling -- both are pure formatters with no IO and no ctx).

**Core pattern** (mirrors `domain/source.ts:24-44` discriminated-union switch -- the `source.kind` branch handles `PathSource.logical` vs `GitHubSource.raw`):

```typescript
import { sourceLogical } from "../domain/source.ts";

import type { ExtensionState } from "../persistence/state-io.ts";

const ICON = "●";

type MarketplaceRecord = ExtensionState["marketplaces"][string];

export function renderMarketplaceList(records: readonly MarketplaceRecord[]): string {
  if (records.length === 0) return "No marketplaces configured."; // ML-4

  const byScope: Record<"user" | "project", MarketplaceRecord[]> = { user: [], project: [] };
  for (const m of records) byScope[m.scope].push(m);

  const lines: string[] = [];
  for (const scope of ["user", "project"] as const) {
    const entries = byScope[scope];
    if (entries.length === 0) continue;
    if (lines.length > 0) lines.push("");
    lines.push(`${scope} scope marketplaces:`);
    for (const m of entries) {
      const auto = m.autoupdate === true ? " [autoupdate]" : "";
      // ML-2: source.logical for PathSource; logical github URL for GitHubSource.
      lines.push(`  ${ICON} ${m.name} (${sourceLogical(m.source as ParsedSource)})${auto}`);
    }
  }
  return lines.join("\n");
}
```

---

### `persistence/locations.ts` (extension)

**Analog:** EXISTING -- `extensions/claude-marketplace/persistence/locations.ts:142-146` (`sourceCloneDir` method as the prototype for the new `sourcesStagingDir`).

**Pattern to copy** (lines 142-146 of the existing file):

```typescript
// EXISTING in persistence/locations.ts:142-146 -- the prototype.
async sourceCloneDir(mp: string): Promise<string> {
  const candidate = path.join(sourcesDir, mp);
  await assertPathInside(sourcesDir, candidate, `sourceCloneDir(${mp})`);
  return candidate;
},
```

**New method (add to the interface AND the bundle object literal)**:

```typescript
// In interface ScopedLocations:
/** Returns `<extensionRoot>/sources-staging/<uuid>/` after SC-7 containment check (D-09). */
sourcesStagingDir(uuid: string): Promise<string>;

// In locationsFor() bundle (alongside sourceCloneDir):
async sourcesStagingDir(uuid: string): Promise<string> {
  const sourcesStagingRoot = path.join(extensionRoot, "sources-staging");
  const candidate = path.join(sourcesStagingRoot, uuid);
  await assertPathInside(sourcesStagingRoot, candidate, `sourcesStagingDir(${uuid})`);
  return candidate;
},
```

**Why this exact shape:** The existing `sourceCloneDir` is the established precedent for `assertPathInside`-protected name-derived path methods. The new `sourcesStagingDir` MUST follow the same async-method pattern (the brand doesn't allow sync alternates). Same-FS guarantee (D-09) holds by construction because both `sources-staging/` and `sources/` are siblings under `extensionRoot`.

---

### `domain/source.ts` (extension)

**Analog:** EXISTING -- the `ParsedSource` discriminated union at `extensions/claude-marketplace/domain/source.ts:24-44` and the factory functions at lines 169-188 (`pathSource`, `githubSource`). The new `sourceLogical` helper switches on `source.kind`.

**Pattern to copy** (the discriminated-union switch idiom from `parsePluginSource`):

```typescript
// Append to domain/source.ts.
//
// Helper used by presentation/marketplace-list.ts (ML-2) and PRD §5.1.3
// list-format requirements. PathSource already exposes `logical`;
// GitHubSource synthesizes the canonical URL form.
//
// Forward-compat: UnknownSource falls back to `raw` (this matches the
// list renderer's tolerance for forward-compat source kinds -- they get
// listed verbatim with whatever the user typed).

export function sourceLogical(source: ParsedSource): string {
  switch (source.kind) {
    case "path":
      return source.logical; // SP-7 verbatim path
    case "github": {
      const refSuffix = source.ref === undefined ? "" : `#${source.ref}`;
      return `https://github.com/${source.owner}/${source.repo}${refSuffix}`;
    }
    case "unknown":
      return source.raw;
  }
}
```

---

### `shared/errors.ts` (extension)

**Analog:** EXISTING -- `extensions/claude-marketplace/shared/errors.ts:1-33` (existing `errorMessage`, `appendLeakToError`, `appendLeaks` exports). Add 4 new exported error classes at the bottom.

**Pattern to copy** (Error-subclass idiom verified at `shared/path-safety.ts::PathContainmentError` and `shared/path-safety.ts::SymlinkRefusedError`):

```typescript
// Append to shared/errors.ts.

/** MA-6: stale source clone refusal. The absolute path is the canonical hint. */
export class StaleSourceCloneError extends Error {
  readonly absPath: string;
  constructor(absPath: string) {
    super(`stale source clone at ${absPath}`);
    this.name = "StaleSourceCloneError";
    this.absPath = absPath;
  }
}

/** MA-8: duplicate marketplace name in chosen scope. */
export class MarketplaceDuplicateNameError extends Error {
  constructor(name: string, scope: "user" | "project") {
    super(`Marketplace "${name}" already exists in ${scope} scope.`);
    this.name = "MarketplaceDuplicateNameError";
  }
}

/** MR-1: cross-scope ambiguity or not-found. */
export class MarketplaceNotFoundError extends Error {
  constructor(mpName: string, scopes: readonly ("user" | "project")[]) {
    super(`Marketplace "${mpName}" not found in ${scopes.join(", ")} scope${scopes.length > 1 ? "s" : ""}.`);
    this.name = "MarketplaceNotFoundError";
  }
}

/** D-14: marketplace update failure (preserves MU-5 retry-hint slot). */
export class MarketplaceUpdateError extends Error {
  readonly retryHint: string;
  constructor(message: string, opts: { cause?: unknown; retryHint?: string } = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "MarketplaceUpdateError";
    this.retryHint = opts.retryHint ?? "";
  }
}
```

---

### Test File Patterns

### `tests/orchestrators/marketplace/add.test.ts`

**Analog:** `tests/bridges/agents/stage.test.ts` (multi-step happy-path + failure-path coverage) + `tests/transaction/with-state-guard.test.ts` (state-guard envelope assertions).

**Imports pattern** (mirrors `tests/bridges/skills/unstage.test.ts:1-9`):

```typescript
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";

import { addMarketplace } from "../../../extensions/claude-marketplace/orchestrators/marketplace/add.ts";
import { locationsFor } from "../../../extensions/claude-marketplace/persistence/locations.ts";
import { loadState } from "../../../extensions/claude-marketplace/persistence/state-io.ts";

import { makeMockGitOps } from "../../helpers/git-mock.ts";
```

**`withTmpScope` helper** (lifted from `tests/bridges/skills/unstage.test.ts:11-21`):

```typescript
async function withTmpScope<T>(
  fn: (ctx: { scopeRoot: string; locations: ReturnType<typeof locationsFor>; ctx: ExtensionContextStub }) => Promise<T>,
): Promise<T> {
  const tmp = await mkdtemp(path.join(tmpdir(), "mp-add-"));
  const locations = locationsFor("project", tmp);
  await mkdir(locations.extensionRoot, { recursive: true });
  try {
    return await fn({ scopeRoot: tmp, locations, ctx: makeCtxStub() });
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
```

**ExtensionContext stub pattern** (mirrors `tests/shared/notify.test.ts` ctx-stub idiom):

```typescript
interface ExtensionContextStub {
  notifications: { message: string; severity?: string }[];
  ui: { notify: (msg: string, sev?: string) => void };
  pi: { getAllTools: () => unknown[] };
}
function makeCtxStub(): ExtensionContextStub {
  const notifications: { message: string; severity?: string }[] = [];
  return {
    notifications,
    ui: { notify: (msg, sev) => notifications.push({ message: msg, severity: sev }) },
    pi: { getAllTools: () => [] },
  };
}
```

---

### `tests/orchestrators/marketplace/remove.test.ts`

**Analog:** `tests/bridges/integration-foreign-content.test.ts` (cross-bridge composition with failure surface) + `tests/bridges/agents/unstage.test.ts` (per-entry partitioning assertions).

The integration-foreign-content test is the closest existing model because remove.test.ts needs to verify (a) some plugins succeed and some fail, (b) failed plugins surface causes via Error.cause, (c) the marketplace record is retained when any failed, (d) one aggregated warning fires at the end.

---

### `tests/orchestrators/marketplace/cascade.test.ts`

**Analog:** `tests/bridges/integration.test.ts:85-99` (cross-bridge happy path; cascade.test.ts mirrors this but in unstage direction).

Test taxonomy (from CONTEXT.md):
- (a) all four bridges succeed → `{ ok: true, dropped: {...} }`
- (b) skills succeed, agents throw → `{ ok: false, cause }` and skills stay unstaged
- (c) all four bridges throw → `{ ok: false, cause }` with first throw chained

---

### `tests/presentation/reload-hint.test.ts`

**Analog:** `tests/architecture/markers-snapshot.test.ts:37-70` (PRD-as-fixture pattern -- uses `extractEs5MarkerLiterals` to verify the RH-2 prefix is byte-identical to PRD §6.8).

**Imports pattern** (snapshot-test idiom from markers-snapshot test):

```typescript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { reloadHint, appendReloadHint } from "../../extensions/claude-marketplace/presentation/reload-hint.ts";
import * as markers from "../../extensions/claude-marketplace/shared/markers.ts";
import { extractEs5MarkerLiterals } from "../helpers/prd-extract.ts";
```

**Snapshot assertion pattern** (lifted from markers-snapshot.test.ts:38-69):

```typescript
test("RH-2 verb table renders byte-for-byte per PRD §6.8", () => {
  // Verbs from PRD §6.8 RH-2 (load/refresh/drop).
  assert.equal(reloadHint("load", ["a"]), `${markers.RELOAD_HINT_PREFIX}load it.`);
  assert.equal(reloadHint("refresh", ["a", "b"]), `${markers.RELOAD_HINT_PREFIX}refresh "a", "b".`);
  assert.equal(reloadHint("drop", []), "");
});
```

---

### `tests/presentation/soft-dep.test.ts`

**Analog:** `tests/shared/notify.test.ts` (ExtensionContext stub) + `tests/persistence/state-io.test.ts` (mock factory pattern).

**Mock ctx.pi.getAllTools pattern**:

```typescript
function makeCtx(tools: { name: string; sourceInfo?: { source: string } }[]): ExtensionContext {
  return { pi: { getAllTools: () => tools } } as unknown as ExtensionContext;
}

test("RH-3: hasLoadedPiSubagents returns true when 'subagent' tool present", () => {
  assert.equal(hasLoadedPiSubagents(makeCtx([{ name: "subagent" }])), true);
});

test("RH-3: hasLoadedPiSubagents returns false when probe throws", () => {
  const ctx = { pi: { getAllTools: () => { throw new Error("not ready"); } } } as unknown as ExtensionContext;
  assert.equal(hasLoadedPiSubagents(ctx), false);
});
```

---

### `tests/helpers/git-mock.ts`

**Analog:** `tests/helpers/prd-extract.ts` (Phase 1 test helper precedent -- single-file module with named exports + JSDoc strategy block).

**File header pattern** (mirrors `tests/helpers/prd-extract.ts:1-11`):

```typescript
/**
 * tests/helpers/git-mock.ts -- in-memory GitOps stub.
 *
 * Returned mock implements the same 5-method GitOps interface defined
 * in orchestrators/marketplace/shared.ts (clone/fetch/forceUpdateRef/
 * checkout/resolveRef). The mock maintains a tiny in-memory bookkeeping
 * record (HEAD SHA, remote refs map) that test bodies mutate between
 * calls to simulate force-push and ref-deletion. The mock does NOT
 * touch the filesystem -- it just trips the orchestrator's flow.
 *
 * Strategy: each mock method records its call args in a call log so
 * tests can assert the D-14 sequence (fetch → forceUpdateRef →
 * checkout) is called in the exact prescribed order with the correct
 * ref names.
 */
```

**Factory pattern** (mirrors `tests/bridges/skills/unstage.test.ts::withTmpScope` -- closure-captured state):

```typescript
export interface MockGitState {
  remoteRefs: Record<string, string>;     // 'refs/remotes/origin/main' -> SHA
  localRefs: Record<string, string>;      // 'refs/heads/main' -> SHA
  head: string;                            // current HEAD SHA
  cloneCalls: Array<{ dir: string; url: string; ref?: string }>;
  fetchCalls: Array<{ dir: string; ref?: string }>;
  // ... etc
}

export function makeMockGitOps(initial?: Partial<MockGitState>): { gitOps: GitOps; state: MockGitState } {
  const state: MockGitState = { remoteRefs: {}, localRefs: {}, head: "", cloneCalls: [], fetchCalls: [], ...initial };
  const gitOps: GitOps = {
    clone: async (opts) => { state.cloneCalls.push(opts); /* simulate clone */ },
    fetch: async (opts) => { state.fetchCalls.push(opts); /* refresh remoteRefs */ },
    forceUpdateRef: async ({ ref, value }) => { state.localRefs[ref] = value; },
    checkout: async ({ ref }) => { /* update head */ },
    resolveRef: async ({ ref }) => state.localRefs[ref] ?? state.remoteRefs[ref] ?? (() => { throw new Error("ref not found"); })(),
  };
  return { gitOps, state };
}
```

---

### `tests/orchestrators/marketplace/_fixtures/`

**Analog:** `tests/bridges/_fixtures/` (Phase 3 fixture layout).

Existing fixture layout to mirror:
```
tests/bridges/_fixtures/
├── empty-agents/          # fixture for empty-bridge cases
├── empty-mcp/
├── foreign-agents/        # fixture for AG-5 foreign content
└── test-plugin/           # full-plugin fixture used by integration.test.ts
```

**Phase 4 fixture layout** (following the same shape):
```
tests/orchestrators/marketplace/_fixtures/
├── valid-marketplace/     # clean marketplace.json + minimal plugin tree
├── invalid-manifest/      # malformed marketplace.json for MA-9 cleanup test
└── empty-marketplace/     # empty plugins array for MU-1 silent-succeed test
```

______________________________________________________________________

## Shared Patterns

### Authentication / Permissions

**Not applicable.** Pi extensions run with the user's filesystem permissions; no auth layer.

### Path Containment (NFR-10)

**Source:** `extensions/claude-marketplace/shared/path-safety.ts::assertPathInside` + `extensions/claude-marketplace/persistence/locations.ts:142-146` (the `sourceCloneDir` method demonstrating the integrated chokepoint pattern).

**Apply to:** Every Phase 4 path computation that joins a name-derived component onto a base dir -- ESPECIALLY the new `sourcesStagingDir(uuid)` method and the `addMarketplace` final-dir resolution.

```typescript
// Always go THROUGH a locations.* method or assertPathInside directly:
const candidate = path.join(sourcesStagingRoot, uuid);
await assertPathInside(sourcesStagingRoot, candidate, `sourcesStagingDir(${uuid})`);
```

### Error Handling / Notifications (IL-2)

**Source:** `extensions/claude-marketplace/shared/notify.ts` -- the SOLE sanctioned `ctx.ui.notify` call site.

**Apply to:** Every Phase 4 user-visible message. NO direct `ctx.ui.notify` calls in orchestrator/presentation files; NO direct `process.stdout` writes.

```typescript
// Success:
notifySuccess(ctx, `Added marketplace "${name}" in ${scope} scope.`);

// Warning (single aggregated at end of remove cascade):
notifyWarning(ctx, body);

// Error (with chained cause):
notifyError(ctx, message, cause);
```

### Marker Constants (ES-5)

**Source:** `extensions/claude-marketplace/shared/markers.ts:9-13` (`PI_SUBAGENTS_NOT_LOADED`, `PI_MCP_ADAPTER_NOT_LOADED`, `RELOAD_HINT_PREFIX`).

**Apply to:** `presentation/reload-hint.ts` (consumes `RELOAD_HINT_PREFIX`) and `presentation/soft-dep.ts` (consumes both `PI_SUBAGENTS_NOT_LOADED` and `PI_MCP_ADAPTER_NOT_LOADED`). Orchestrators NEVER inline the literal strings.

Tested by `tests/architecture/markers-snapshot.test.ts` -- if reload-hint.ts inlines `"Run /reload to "` instead of importing `RELOAD_HINT_PREFIX`, the snapshot test still passes but a future PRD edit will silently break the contract. Code review enforcement.

### State-Guard Envelope (D-04)

**Source:** `extensions/claude-marketplace/transaction/with-state-guard.ts:52-60` (the canonical guard signature).

**Apply to:** Every mutating Phase 4 orchestrator (`add.ts`, `remove.ts`, `update.ts`, `autoupdate.ts`). `list.ts` does NOT use the guard (D-04 corollary: read-only).

```typescript
await withStateGuard(locations, async (state) => {
  // 1. Read invariants (e.g., state.marketplaces[name]).
  // 2. Mutate state in-memory.
  // 3. Return result (NOT the state).
});
// withStateGuard saves state.json on no-throw.
```

### Atomic JSON Writes (NFR-1)

**Source:** `extensions/claude-marketplace/shared/atomic-json.ts::atomicWriteJson` (called transitively via `saveState` inside `withStateGuard`).

**Apply to:** Phase 4 does NOT call `atomicWriteJson` directly. `state.json` writes happen through the guard's `saveState` call. Phase 4 just wraps the guard.

### Cleanup-With-Leak-Tracking (D-10)

**Source:** `extensions/claude-marketplace/shared/fs-utils.ts::cleanupStaging` + `extensions/claude-marketplace/shared/errors.ts::appendLeakToError`.

**Apply to:** Every Phase 4 site that creates a staging directory (`add.ts` for the MA-9 cleanup; `update.ts` if a future staging path is added) AND every post-state cleanup site (`remove.ts` for the MR-5/MR-6 aggregation).

```typescript
// Single-leak (add.ts MA-9):
try { /* clone + manifest + rename */ } catch (err) {
  const leak = await cleanupStaging(stagingDir, "marketplace clone");
  throw appendLeakToError(err, leak);
}

// Multi-leak aggregation (remove.ts MR-5/MR-6):
const leaks = await Promise.all([cleanupStaging(a, "a"), cleanupStaging(b, "b")]);
const realLeaks = leaks.filter((l): l is string => l !== undefined);
if (realLeaks.length > 0) {
  throw new Error(`Marketplace removed but post-state cleanup failed for ${realLeaks.length} path(s): ${realLeaks.join("; ")}`);
}
```

### Frozen-Result Discipline

**Source:** `extensions/claude-marketplace/bridges/skills/unstage.ts:55-58` (`Object.freeze` on `removedNames` and `warnings`).

**Apply to:** All public-surface result types returned by Phase 4 orchestrators and the cascade primitive. Mirrors the bridge surface so consumers cannot mutate names arrays in place.

```typescript
return {
  removedNames: Object.freeze(removed),
  warnings: Object.freeze<string[]>([]),
};
```

### Import-Boundary Discipline (D-11)

**Source:** `tests/architecture/import-boundaries.test.ts:62-80` (the forbidden-imports matrix).

**Apply to:** All Phase 4 source files. `orchestrators/` may import from `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/`, `platform/`, `shared/`. **NOT** from `edge/` (which doesn't exist in Phase 4 yet but the rule pre-exists).

`orchestrators/marketplace/*.ts` MUST NOT import from `orchestrators/plugin/` (Phase 5 sibling) -- the cross-file `PluginUpdateFn` lives in `orchestrators/types.ts` precisely to avoid this cycle.

### Test File Naming + Layout

**Source:** `tests/bridges/{agents,commands,skills,mcp}/*.test.ts` (mirrors source layout exactly).

**Apply to:** Phase 4 tests at `tests/orchestrators/marketplace/{add,remove,list,update,autoupdate,cascade}.test.ts` -- one test file per source file, plus `cascade.test.ts` for the shared primitive. `_fixtures/` lives as a sibling.

______________________________________________________________________

## No Analog Found

**None.** Every Phase 4 file has at least one strong analog in the existing codebase. The match qualities are:

- **EXACT (extending existing):** 3 files -- `persistence/locations.ts`, `domain/source.ts`, `shared/errors.ts` are file extensions, not new files. Pattern is the existing file itself.
- **exact-shape:** 2 files -- `orchestrators/marketplace/remove.ts` (mirrors `bridges/agents/unstage.ts:50-123` directly), `tests/presentation/reload-hint.test.ts` (mirrors `tests/architecture/markers-snapshot.test.ts`).
- **role-match:** 17 files -- closest analog is a Phase 1-3 file in the same architectural tier, but with adapted shape.

The V1 reference (`features/initial:.../marketplace/*.ts`) is available as a SHAPE template only -- D-09 (staging location), D-12 (GitOps injection), D-13 (forceUpdateRef explicit), D-14 (follow-upstream-blindly) all supersede V1 details. Use V1 to remember which REQ-IDs cluster around which subcommand; do NOT copy V1 code structure.

______________________________________________________________________

## Metadata

**Analog search scope:**
- `extensions/claude-marketplace/{orchestrators,bridges,transaction,persistence,domain,platform,presentation,shared}/`
- `tests/{bridges,transaction,persistence,domain,shared,architecture,helpers,fixtures}/`
- `git show features/initial:extensions/claude-marketplace/marketplace/*.ts` (V1 reference; not copy-target)

**Files scanned in detail:**
- `bridges/{skills,commands,agents,mcp}/{unstage,index}.ts` (4 unstage primitives + 4 barrel re-exports)
- `transaction/with-state-guard.ts` (guard envelope)
- `platform/git.ts` (GitOps default impl source)
- `persistence/{locations,state-io}.ts` (state shape + path methods)
- `domain/source.ts` (discriminated-union pattern)
- `shared/{notify,markers,errors,fs-utils,path-safety}.ts` (every helper Phase 4 consumes)
- `tests/bridges/{integration,integration-foreign-content,skills/unstage}.test.ts` (test idioms)
- `tests/helpers/prd-extract.ts` (test-helper precedent)
- `tests/architecture/{markers-snapshot,import-boundaries}.test.ts` (PRD-fixture + boundary tests)

**Pattern extraction date:** 2026-05-10

**Notable absence:** `orchestrators/index.ts` is currently `export {}` (placeholder); `orchestrators/marketplace/` directory does not exist. Phase 4 is the first phase to populate `orchestrators/` beyond the placeholder. There is NO `orchestrators/plugin/install.ts` from Phase 3 -- the closest "orchestrator-shaped" code is the bridge `prepare/commit` pair, which is the analog for `add.ts`'s clone-then-rename flow.
