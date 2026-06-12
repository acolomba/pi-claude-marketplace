# Phase 53: Pure Reconcile Planner & Dry-Run Preview - Research

**Researched:** 2026-06-10
**Domain:** Pure desired-state diff planner + read-only preview command surface on TypeScript/Node Pi extension
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

Inherited constraints from Phases 51-52 (the frozen foundation):
- `MergedConfig` (with per-entry `source: "base" | "local"` provenance) comes from `persistence/config-merge.ts`; `ConfigLoadResult` trichotomy from `config-io.ts` — `invalid` is an abort signal (CFG-03), never an empty desired state.
- Phase 52 left an explicit obligation: a planner-level convergence exit-gate test — `planReconcile` over a freshly migrated config + the originating state must return an empty plan (zero installs, zero uninstalls). This phase MUST land that test (see `tests/persistence/migrate-config.test.ts` header comments).
- The planner must be pure (no fs, no network imports) — mirror the architecture-test enforcement style used by `tests/architecture/config-state-write-seams.test.ts` and the existing import-planner `samePlannedSource` template (find it in the import orchestrator family).
- Disabled plugins (config `enabled: false`) are NOT part of the desired-materialized set: no pending-install row for them; enable/disable transitions are their own action kind (Phase 54 implements the commands; this phase only plans/classifies the transitions).

### Output grammar (locked project conventions — treat as constraints)
- Rows render subject-first: `<glyph> <name> [scope] (status) {reason}` — a status token never precedes the subject.
- Any new status tokens are closed-set catalog amendments: renderer + `docs/output-catalog.md` + `catalog-uat` byte fixtures land in the SAME atomic commit (v1.3 atomic-supersession lesson).
- All user-visible output goes through `ctx.ui.notify` via the structured `notify()` v2 entrypoint in `shared/notify.ts` (IL-2); error/warning-severity notifications carry a non-empty summary line with the cascade as its own block (v1.11 GRAM contract).
- The read-only command must perform no writes and no network (NFR-5 read-surface discipline; same class as `list`/`info`).

### Claude's Discretion
- Subcommand surface name (`preview`, `reconcile --dry-run`, or `diff` — see Open Questions / Section "Subcommand-name decision")
- Whether to introduce NEW status tokens for pending intent (and which: e.g. `(to install)`, `(to uninstall)`, `(to enable)`, `(to disable)`) OR to reuse existing tokens with a leading non-cascade column-0 advisory header
- Whether the planner module lives at `orchestrators/reconcile/plan.ts` (research dependency-graph suggestion) or `orchestrators/preview/plan.ts` / `orchestrators/diff/plan.ts`; the architecture test expects a single new module location to gate purity

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped. Out of scope from REQUIREMENTS.md:
- Field watching / auto-apply on edit (chokidar / fs.watch).
- Field-level local merge (entry-level only).
- Interactive confirmation at load — the dry-run is the pre-apply gate.
- Sync/apply command — `/reload` is the only way to apply, dry-run is preview-only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIFF-01 | User can run a read-only diff/preview command showing exactly what the next load's reconcile would do (adds, installs, removals, uninstalls, enable/disable transitions) -- no writes, no network. | Section "Architecture Patterns -> Pattern 1" (pure planner) + Section "Architecture Patterns -> Pattern 3" (read-only edge surface mirroring `marketplace info`); Section "Standard Stack" (no new deps; consume existing `loadMergedScopeConfig` + `loadState`); Section "Don't Hand-Roll" (reuse `samePlannedSource`, reuse `notify()` v2). |
| DIFF-02 | Diff output follows the locked row grammar -- subject-first rows (`<glyph> <name> [scope] (status) {reason}`); any new pending-tense status tokens are closed-set extensions landing in lockstep with catalog + byte-UAT fixtures. | Section "Architecture Patterns -> Pattern 4" (atomic catalog amendment workflow); Section "Architecture Patterns -> Pattern 5" (grammar choice: pending-tense token vs. reuse + advisory header); Section "Common Pitfalls -> Pitfall 53-3"; Section "Code Examples -> Example 3" (catalog fixture pairing). |
</phase_requirements>

## Summary

Phase 53 lands two artefacts on the Phase 51 + Phase 52 frozen foundation:

1. **A pure `planReconcile(MergedConfig, ExtensionState) -> ReconcilePlan` function** in a new `orchestrators/reconcile/plan.ts` (or sibling) module — it computes the bidirectional diff between the user-authored config (Phase 51's `MergedConfig`) and the recorded reality (`state.json`), classifying each entry into one of seven action buckets (marketplaces-to-add, marketplaces-to-remove, plugins-to-install, plugins-to-uninstall, plugins-to-enable, plugins-to-disable, source-mismatches). It performs NO I/O, NO network, NO `fs` access; an architecture test (sibling of `tests/architecture/config-state-write-seams.test.ts` and `tests/architecture/no-orchestrator-network.test.ts`) gates this structurally via import-greps.

2. **A read-only edge/orchestrator surface** that loads `MergedConfig` + `state` for both scopes, calls `planReconcile`, and renders the result through the existing `notify()` v2 type model — mirroring the architecture of `orchestrators/marketplace/info.ts` (read-only, no `withStateGuard`, no `gitOps`, single `notify()` call per invocation). The user invokes it as a new `/claude:plugin` subcommand (probable name: `preview`); running it twice produces byte-identical output and zero file/state mutation.

The phase has TWO non-negotiable gates:

- **Convergence proof:** `tests/persistence/migrate-config.test.ts` defers Section D's planner-level proof (`planReconcile(mergeScopeConfigs(buildConfigFromState(state), {}), state)` deepEqual the empty plan) to this phase. The test MUST move into this phase's test suite (or be added here while the migrate-config test remains data-level).

- **Catalog atomicity (DIFF-02):** any new pending-tense status token (e.g. `(to install)`, `(to enable)`) is a closed-set amendment — the `STATUS_TOKENS` tuple in `shared/notify.ts`, the renderer arm(s), the `docs/output-catalog.md` section + states, and the `catalog-uat` `FIXTURES` entries land in the SAME atomic commit. The v1.3 atomic-supersession lesson, the v1.10 atomic-foundation lesson (Phase 46 `TYPE-01..04` shipped as one commit), and the v1.11 byte-rewrite lesson (Phase 50 GRAM-01..05 atomic notify+catalog+fixtures) all apply.

**Primary recommendation:** Land the pure planner + architecture test FIRST (commit 1, byte-neutral to existing surfaces). Then land the edge command + notify-types extension + catalog + catalog-uat fixtures in a SECOND atomic commit (the lockstep rule applies only to the user-visible bytes commit). The Phase 52 convergence proof rides on commit 1 (it uses no new tokens). This split keeps the bisect-clean discipline the v1.4.1/v1.5 lesson formalized: foundations precede atomic catalog amendments.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pure bidirectional diff (config vs state) | `orchestrators/reconcile/` (NEW) | `persistence/config-merge.ts` (data input only — read) | Pure planner is a sibling of `orchestrators/import/marketplaces.ts` (the D-28 pure planner template); reads merged config + state but never mutates. Lives outside `persistence/` because the persistence tier owns I/O seams, not diff logic. |
| Source-shape comparison (`samePlannedSource`) | `orchestrators/reconcile/plan.ts` (re-export or import from `orchestrators/import/execute.ts`) | — | Existing `samePlannedSource` is at `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:186-216`; reuse by importing (not copying) so a future source-shape addition propagates. The cross-orchestrator import is acceptable: both are pure, no cycle introduced because `import/execute.ts` does NOT import from reconcile. |
| Plan-to-notification-message projection | `orchestrators/reconcile/notify.ts` (NEW; sibling of pure planner) | `shared/notify.ts` (consumer) | Mirrors `orchestrators/import/execute.ts::buildImportNotificationMarketplaces` (lines 364-497 of `execute.ts`) — accumulate per-(scope, marketplace) blocks, sort via `compareByNameThenScope`, return `CascadeNotificationMessage`. Pure / no I/O. |
| Read-only preview orchestrator (load + plan + notify) | `orchestrators/reconcile/preview.ts` (or similar single entry function) | `persistence/config-merge.ts` (read), `persistence/state-io.ts` (read), `shared/notify.ts` (emit) | Mirrors `orchestrators/marketplace/info.ts` architecture: one async entry function, reads both scopes' state + merged config, exactly one `notify()` call (per scope or one combined cascade — see Open Questions). No `withStateGuard`, no `gitOps`, no `platform/git` import. |
| Edge command parsing + dispatch | `edge/handlers/<location>/preview.ts` (NEW) | `edge/router.ts` (MODIFIED — add subcommand) | Thin shim mirroring `edge/handlers/plugin/list.ts` (richer flag handling) or `edge/handlers/marketplace/info.ts` (single-name positional). The preview is a top-level subcommand (no positional, optional `--scope`), so its shape is closer to `marketplace list` than `marketplace info`. |
| Tab completion | `edge/completions/provider.ts` (MODIFIED) | `edge/router.ts::TOP_LEVEL_SUBCOMMANDS` (MODIFIED — add `preview`) | The completion provider already enumerates `TOP_LEVEL_SUBCOMMANDS` (imported at `provider.ts:38`); adding `"preview"` to the router tuple propagates the completion automatically. The `--scope` flag completion is already wired (TC-3/TC-4 branches). |
| Convergence-proof integration test | `tests/orchestrators/reconcile/preview.test.ts` (NEW) or moved from `tests/persistence/migrate-config.test.ts` Section D | — | Phase 52's Section D test stub deferred the planner-level proof here. The test invokes `buildConfigFromState` (Phase 52) + `mergeScopeConfigs` (Phase 51) + `planReconcile` (Phase 53) and asserts the empty plan. Lives in the new reconcile test directory. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typebox` | `^1.1.38` (peer dep, already locked) | (No direct use in this phase) | Phase 51 already locked it as the schema authority. Phase 53 consumes Phase 51's static types only — no new schema. [VERIFIED: existing peerDependencies + Phase 51 SUMMARY] |
| `@mariozechner/pi-coding-agent` | `^0.73.1` (peer dep, already locked) | `ExtensionContext`, `ExtensionAPI`, `ctx.ui.notify` | Standard Pi extension API. The preview command surfaces through `pi.registerCommand` like every other `/claude:plugin <verb>`. [VERIFIED: existing peerDependencies] |
| `node:test` (built-in) | bundled with Node >= 20.19.0 | Unit + architecture tests | Phase 52 closed at 1571 GREEN node:test unit tests. Same runner. [VERIFIED: package.json scripts + Phase 52 SUMMARY] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs/promises` (built-in) | bundled | Architecture test walker (`readdir` + `readFile` for grep) | Same shape as `tests/architecture/config-state-write-seams.test.ts:84-94` `walkTsFiles` — for the planner-purity gate. |
| `node:assert/strict` (built-in) | bundled | Test assertions | Existing test convention; `assert.deepEqual` for the empty-plan proof. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `(to install)` / `(to uninstall)` / `(to enable)` / `(to disable)` pending-tense status tokens | Reuse existing `(installed)` / `(uninstalled)` / `(skipped)` tokens with a leading column-0 advisory header (e.g. `Preview: 3 plugin operations pending.`) and the rows below carrying NO status token, just the icon + name + reason like `{to install}` | Pending-tense tokens make the closed set grammatically truthful (the row says what WILL happen, not what HAPPENED). The reuse-with-header approach avoids amending `STATUS_TOKENS` (currently 15 entries) but conflates two distinct semantic states in the renderer's switch (a `(installed)` row now means either "transitioned" or "intended-to-transition" depending on caller context — a `cascade-context` field would be needed, which is a worse modeling mistake). **Recommended: new tokens.** See Pattern 5. |
| `tests/architecture/reconcile-plan-matrix.test.ts` (in-test enumeration of the 7-bucket matrix) | Property-style tests using a random `(MergedConfig, ExtensionState)` generator | The matrix is small enough (config-present × state-present × enabled × installable for 2 entity kinds = ~16 cells per kind) to enumerate exhaustively. Property generators add a dep and surface less precise failure messages. **Recommended: exhaustive matrix.** |
| Putting `planReconcile` under `persistence/` to colocate with merge + state-io | Keep `persistence/` as a pure data seam (Phase 51-02 D-19 + 51-03 SPLIT-02 boundary) | Phase 51's architecture made persistence the data seam (load + save + merge + migrate). The planner is a pure transform from data → action plan; it is NOT persistence. The research SUMMARY proposed `orchestrators/reconcile/`; that's the right home. **Recommended: new `orchestrators/reconcile/`.** |

**Installation:**

No new dependencies. Phase 53 is built entirely on Phase 51 + Phase 52 seams + existing `shared/notify.ts` types.

```bash
# No `npm install` step. Verify:
npm view typebox version
npm view @mariozechner/pi-coding-agent version
```

**Version verification:** Phase 51 SUMMARY confirms `typebox@^1.1.38` and `@mariozechner/pi-coding-agent@^0.73.1` are already pinned. Phase 53 does not bump these. The Phase 52 SUMMARY confirms `npm run check` was GREEN at 1571 unit + 7 integration tests at Phase 52 close — Phase 53's exit gate is at least 1571 + N where N is the new unit-test count (architecture purity gate + planner matrix + edge handler + convergence proof + catalog UAT additions).

## Package Legitimacy Audit

> Not applicable — Phase 53 installs no external packages. All dependencies are pre-existing peer deps (Phase 51) or Node built-ins.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
User runs `/claude:plugin preview [--scope user|project]`
  │
  ▼
edge/router.ts (NEW case "preview")
  │
  ▼
edge/handlers/plugin/preview.ts (NEW thin shim)
  │   parseCommandArgs → { scope? }
  │
  ▼
orchestrators/reconcile/preview.ts (NEW)
  │
  ├─► (per scope: user + project, or just the requested scope)
  │     │
  │     ├─► loadMergedScopeConfig(loc)  ── persistence/config-merge.ts (READ)
  │     │     └─► loadConfig(loc.configJsonPath)        }   pure data
  │     │     └─► loadConfig(loc.configLocalJsonPath)   }   (CFG-03 trichotomy)
  │     │
  │     ├─► loadState(loc.extensionRoot)  ── persistence/state-io.ts (READ)
  │     │
  │     └─► planReconcile(merged, state) ── orchestrators/reconcile/plan.ts (PURE)
  │           │
  │           └─► ReconcilePlan {
  │                  marketplacesToAdd, marketplacesToRemove,
  │                  pluginsToInstall, pluginsToUninstall,
  │                  pluginsToEnable, pluginsToDisable,
  │                  sourceMismatches
  │                }
  │
  ├─► buildReconcilePreviewNotification(plans) ── orchestrators/reconcile/notify.ts (PURE)
  │     │   (mirror of orchestrators/import/execute.ts::buildImportNotificationMarketplaces)
  │     │
  │     └─► CascadeNotificationMessage { marketplaces: [...] }
  │
  └─► notify(ctx, pi, message)  ── shared/notify.ts (EMIT)
        │
        └─► ctx.ui.notify(bytes, severity?)
              │
              ▼
            Pi UI

Architecture gates:
  - tests/architecture/no-orchestrator-network.test.ts adds reconcile/plan.ts + preview.ts + notify.ts
  - tests/architecture/reconcile-planner-purity.test.ts (NEW) gates plan.ts has zero `node:fs`, `notify`, `state-io`, `config-io` (write-side) imports
  - tests/architecture/catalog-uat.test.ts gets a new section "/claude:plugin preview" with byte-fixtures
  - tests/architecture/config-state-write-seams.test.ts unchanged — preview writes nothing
```

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── orchestrators/
│   ├── reconcile/                    # NEW directory
│   │   ├── plan.ts                   # NEW: pure planReconcile (DIFF-01 foundation)
│   │   ├── preview.ts                # NEW: read-only orchestrator (DIFF-01 user surface)
│   │   ├── notify.ts                 # NEW: plan -> CascadeNotificationMessage projection
│   │   ├── types.ts                  # NEW: ReconcilePlan + bucket types
│   │   └── README.md                 # NEW: pattern notes
│   ├── import/                       # EXISTING (template)
│   ├── marketplace/                  # EXISTING
│   └── plugin/                       # EXISTING
├── edge/
│   ├── handlers/
│   │   └── plugin/
│   │       └── preview.ts            # NEW: thin shim
│   └── router.ts                     # MODIFIED: add "preview" subcommand
├── shared/
│   └── notify.ts                     # MODIFIED iff new STATUS_TOKENS land (DIFF-02)
└── docs/
    └── output-catalog.md             # MODIFIED: new "/claude:plugin preview" section

tests/
├── architecture/
│   ├── catalog-uat.test.ts                       # MODIFIED: new FIXTURES entries
│   ├── notify-types.test.ts                      # MODIFIED iff STATUS_TOKENS length changes
│   ├── no-orchestrator-network.test.ts           # MODIFIED: add reconcile/preview.ts target
│   └── reconcile-planner-purity.test.ts          # NEW: gates planReconcile purity
├── orchestrators/
│   └── reconcile/
│       ├── plan.test.ts                          # NEW: exhaustive matrix (DIFF-01)
│       ├── plan-convergence.test.ts              # NEW: Phase 52 deferred proof
│       ├── notify.test.ts                        # NEW: plan -> message projection
│       └── preview.test.ts                       # NEW: read-only + idempotent (DIFF-01)
└── edge/
    └── handlers/
        └── plugin/
            └── preview.test.ts                   # NEW: shim parse + dispatch
```

### Pattern 1: Pure planner mirrors `import/marketplaces.ts::buildClaudeImportPlan`

**What:** A pure function `planReconcile(merged: MergedConfig, state: ExtensionState): ReconcilePlan` that produces a 7-bucket diff without touching the disk. The import planner (`buildClaudeImportPlan`) is the unidirectional template; reconcile generalizes it to bidirectional (also computes removals + transitions).

**When to use:** Always — the architecture test gates purity structurally.

**Example:**
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts (NEW)
// Template: extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts:112-120

import type { MergedConfig } from "../../persistence/config-merge.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";

export interface PlannedMarketplaceAdd {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly source: string;             // raw user input (SP-7)
  readonly configSource: "base" | "local";
}

export interface PlannedMarketplaceRemove {
  readonly scope: Scope;
  readonly marketplace: string;
}

export interface PlannedPluginInstall {
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly configSource: "base" | "local";
}

export interface PlannedPluginUninstall {
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
}

export interface PlannedPluginEnable {
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
}

export interface PlannedPluginDisable {
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
}

export interface PlannedSourceMismatch {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly declaredSource: string;
  readonly recordedSource: string;       // sourceLogical() form, for diagnostics
  readonly cause: "source-mismatch" | "unknown-stored";
}

export interface ReconcilePlan {
  readonly scope: Scope;
  readonly marketplacesToAdd: readonly PlannedMarketplaceAdd[];
  readonly marketplacesToRemove: readonly PlannedMarketplaceRemove[];
  readonly pluginsToInstall: readonly PlannedPluginInstall[];
  readonly pluginsToUninstall: readonly PlannedPluginUninstall[];
  readonly pluginsToEnable: readonly PlannedPluginEnable[];
  readonly pluginsToDisable: readonly PlannedPluginDisable[];
  readonly sourceMismatches: readonly PlannedSourceMismatch[];
}

/** Empty plan factory. Used by callers to deepEqual against an empty result. */
export function emptyReconcilePlan(scope: Scope): ReconcilePlan {
  return {
    scope,
    marketplacesToAdd: [],
    marketplacesToRemove: [],
    pluginsToInstall: [],
    pluginsToUninstall: [],
    pluginsToEnable: [],
    pluginsToDisable: [],
    sourceMismatches: [],
  };
}

/**
 * DIFF-01: pure bidirectional diff between desired state (merged config) and
 * recorded reality (state.json). NEVER touches the disk or network. Every
 * action bucket is independently testable.
 *
 * Disabled-entry rule (Pitfall 53-2, REQUIREMENTS Pitfall 8): a plugin entry
 * with `enabled: false` is DECLARED but NOT in the desired-materialized set.
 * - declared+disabled + recorded+materialized -> pluginsToDisable
 * - declared+disabled + recorded+absent -> NO action (entry is honored as-is)
 * - declared+enabled (or enabled undefined per D-04) + recorded+absent -> pluginsToInstall
 * - declared+enabled + recorded+materialized -> NO action (steady state)
 * - declared+absent + recorded+materialized -> pluginsToUninstall
 *
 * The renderer NEVER shows a disabled+absent plugin as a pending install.
 *
 * Plugin-key format: flat "${plugin}@${marketplace}" (D-01); the planner
 * splits on the LAST `@` to extract (plugin, marketplace) so plugin names
 * containing `@` (theoretical) parse correctly.
 *
 * D-16 dangling references: a plugin entry whose marketplace name does not
 * appear in either marketplaces map is reported in `sourceMismatches` with
 * a synthetic `cause: "source-mismatch"` cause carrying "marketplace not
 * declared" — Phase 55 owns the actual reconcile soft-fail; Phase 53
 * surfaces it as a planning-time advisory.
 */
export function planReconcile(merged: MergedConfig, state: ExtensionState, scope: Scope): ReconcilePlan {
  // Implementation skeleton — full body in Plan phase.
  // Walks merged.marketplaces ∪ state.marketplaces; partitions into 4
  // buckets via 2x2 truth table (declared, recorded) × marketplace.
  // Walks merged.plugins ∪ flattened state plugins; partitions into 6
  // buckets via 3-state (declared+enabled, declared+disabled, undeclared) ×
  // 2-state (recorded, not recorded).
  // ...
  return emptyReconcilePlan(scope);  // placeholder
}
```

**Pattern source:** `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts:84-120` (pure `scopedPlan` + `buildClaudeImportPlan`).

### Pattern 2: `samePlannedSource` reuse for source-shape comparison

**What:** When `merged.marketplaces[k]` exists AND `state.marketplaces[k]` exists, the planner must decide: are they "the same marketplace" (no action needed) or has the user changed the source (source-mismatch -> Phase 55 will surface as advisory)? `samePlannedSource` already implements this comparison for the import path.

**When to use:** Inside the planner's marketplace 2x2 truth table, in the (declared, recorded) cell.

**Example:**
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/import/execute.ts:186-216
//
// Reuse via import (NOT copy) so a future source-shape addition propagates:
import { samePlannedSource } from "../import/execute.ts";

// Inside planReconcile, for each (declared, recorded) marketplace:
const declaredSource = mergedEntry.entry.source;     // raw string from CONFIG_SCHEMA (D-02)
const recordedSource = recordedRecord.source;        // ParsedSource (state-io ST-6 funnel)

const verdict = samePlannedSource(recordedSource, declaredSource);
if (verdict === true) {
  // Steady-state: no action.
} else if (verdict === "unknown-stored") {
  // sourceMismatches.push({ ..., cause: "unknown-stored" });
} else {
  // sourceMismatches.push({ ..., cause: "source-mismatch", ...sourceStrings });
}
```

**Caveat (Pitfall 53-5):** `samePlannedSource` currently lives in `import/execute.ts` which is NOT a pure module (it imports `addMarketplace`, `installPlugin`, etc.). Importing the helper alone from `plan.ts` would pull in the entire transitive closure if the bundler does not tree-shake. Solution: **extract `samePlannedSource` to a new pure module** `shared/source-compare.ts` (or `domain/source-compare.ts`) as part of Phase 53 — both `import/execute.ts` and `reconcile/plan.ts` then import from there. This is a Rule 4-adjacent refactor; flag in plan-phase for user approval.

### Pattern 3: Read-only orchestrator mirrors `marketplace/info.ts`

**What:** The preview orchestrator loads inputs from both scopes (or the requested scope), invokes `planReconcile`, projects the plan into a `CascadeNotificationMessage`, and emits exactly one `notify()` call per scope (or one combined cascade — see Open Questions). It NEVER takes a state lock, NEVER imports `gitOps` / `platform/git`, NEVER writes any file.

**When to use:** Always for the preview surface.

**Example:**
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:1-90
// (architectural template; not a literal copy)

import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { notify } from "../../shared/notify.ts";

import { planReconcile } from "./plan.ts";
import { buildReconcilePreviewNotification } from "./notify.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";

export interface PreviewReconcileOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly cwd: string;
  /** When omitted, fan-out across BOTH scopes (project-first, mirrors info). */
  readonly scope?: Scope;
}

export async function previewReconcile(opts: PreviewReconcileOptions): Promise<void> {
  const scopes: Scope[] = opts.scope !== undefined ? [opts.scope] : ["project", "user"];
  const plans = await Promise.all(
    scopes.map(async (scope) => {
      const loc = locationsFor(scope, opts.cwd);
      const outcome = await loadMergedScopeConfig(loc);
      // CFG-03 abort: if either base or local file is invalid, the preview
      // MUST surface the abort signal (mirroring Phase 55 load behavior)
      // and NOT compute a diff against partial data. Implementation in plan
      // phase — likely a structured (failed) row carrying the invalid file
      // path + error.
      const state = await loadState(loc.extensionRoot);
      return planReconcile(outcome.merged, state, scope);
    }),
  );
  const message = buildReconcilePreviewNotification(plans);
  notify(opts.ctx, opts.pi, message);
}
```

### Pattern 4: Atomic catalog amendment workflow (DIFF-02)

**What:** Any new pending-tense status token (e.g. `(to install)`) requires a SIX-fold atomic edit landing in one commit:

1. `extensions/pi-claude-marketplace/shared/notify.ts::STATUS_TOKENS` tuple — add the new literal at the appropriate position; length lock at `tests/architecture/notify-types.test.ts` updates from `15` to `N`.
2. `shared/notify.ts::PLUGIN_STATUSES` AND/OR `MARKETPLACE_STATUSES` tuple (depending on which surface the token serves) — add literal + length-lock update.
3. `shared/notify.ts` renderer arms — add the new `case "to install":` arm to `renderPluginRow` (or sibling) returning the byte-exact row.
4. `shared/notify.ts` discriminated-union message variants — add the new variant interface (e.g. `PluginToInstallMessage`) to `PluginNotificationMessage` (carries `name`, `marketplace`, optional `scope`; NO `dependencies` because the soft-dep probe is meaningless before installation).
5. `docs/output-catalog.md` — add a new `## ` /claude:plugin preview` H2 section with at least 5 catalog states (empty plan, marketplace-add-only, plugin-install-only, all-buckets-populated, source-mismatch), each carrying a `<!-- catalog-state: STATE -->` HTML comment + a fenced byte-exact code block.
6. `tests/architecture/catalog-uat.test.ts::FIXTURES` — add the new `"/claude:plugin preview"` outer key + N inner-state entries, each pairing a `NotificationMessage` payload with a `MockPi` factory.

**When to use:** Whenever the renderer must emit a byte form not currently in the closed set.

**Why atomic:** Any one of these six landing alone makes the catalog-uat byte-equality runner go RED. The v1.3 lesson, the v1.10 Phase 46 lesson (Phase 46 SUMMARY: "Type-model foundation landed (TYPE-01..04) as ONE atomic commit"), and the v1.11 Phase 50 lesson all converge on this contract.

**Pattern source:** Phase 46 SUMMARY (`STATE.md` line 163) — single atomic commit added the 6th `MarketplaceNotAddedMessage` arm + variant + renderer + 4 catalog-uat fixtures byte-identically. Phase 27 Plan 27-03 (UXG-04) added `<autoupdate>` / `<no autoupdate>` MARKERS as one atomic commit.

### Pattern 5: Pending-tense status tokens vs. reuse + advisory header (DIFF-02 grammar choice)

**What:** Two grammatically truthful renderings of "plugin `foo@mp` would be installed by next load's reconcile":

**Option A — new pending-tense tokens:**
```text
● foo [user] (to install)
○ bar [user] (to uninstall)
● baz [user] (to enable)
⊘ qux [user] (to disable)
```
Each row tells the user exactly what action is pending. The renderer arm narrows via `case "to install":` etc. and the catalog has one state per token.

**Option B — reuse existing tokens with column-0 advisory:**
```text
Preview: next /reload will apply 4 plugin actions.

● foo [user] (installed) {pending}
○ bar [user] (uninstalled) {pending}
...
```
Reuses `(installed)` / `(uninstalled)` etc.; the `{pending}` reason is a new `Reason` member. The advisory header tells the user this is a preview.

**Recommended: Option A** (new tokens). Rationale:
- `(installed)` and `(uninstalled)` are STATE TRANSITION tokens that drive `shouldEmitReloadHint` (per `shared/notify.ts:251-256` — "The four state-change tokens at the head of the tuple ... are the structurally-distinguished transition tokens that drive `shouldEmitReloadHint`"). Reusing them on the preview surface would either: (a) wrongly fire the reload-hint trailer on a preview row (the user has NOT done anything, so `/reload to pick up changes` is grammatically false), OR (b) require a new orthogonal `previewMode: true` flag piped through the entire renderer that re-disables the reload hint — which is a structural carve-out the closed-set discipline was designed to prevent.
- Option A's pending-tense tokens are NEVER in `shouldEmitReloadHint`'s trigger set, so they correctly do NOT emit the reload trailer.
- Option A keeps the renderer's switch exhaustive without context flags; each pending token has a deterministic single-arm rendering.
- The cost is 4 new `STATUS_TOKENS` members (15 → 19), 4 new `PLUGIN_STATUSES` members (11 → 15 — if plugin-only) plus 2 new `MARKETPLACE_STATUSES` members (7 → 9, for `(to add)` + `(to remove)`), and 4 new discriminated-union variants. The length-lock test at `tests/architecture/notify-types.test.ts:670` updates accordingly.

**Sub-decision:** the `(to enable)` / `(to disable)` tokens are introduced in this phase but DO NOT require a new icon — `(to enable)` reuses `ICON_INSTALLED` (●), `(to disable)` reuses `ICON_UNINSTALLABLE` (⊘) matching the disabled = artefacts-removed semantic. The catalog records this in the icon column of the status token reference table at `docs/output-catalog.md:125-149`.

**Alternative grammar to consider:** the diff-output may sit best as a single CASCADE block, not as one row per action. The marketplace-header form (`● <mp> [<scope>] (added)`) could become `● <mp> [<scope>] (to add)` and the per-plugin rows underneath retain the pending tokens. This is structurally what import already does — a per-marketplace block with per-plugin children — so the projection from `ReconcilePlan` to `MarketplaceNotificationMessage[]` follows the import path's template exactly.

### Anti-Patterns to Avoid

- **Catching `loadConfig` invalid as empty desired state.** Phase 51's `ConfigLoadResult` trichotomy makes `invalid` distinct from `absent`; the preview MUST surface invalid as a structured failure row, NEVER diff against `{}`. (Pitfall 53-1)
- **Pulling `gitOps` / `platform/git` into `preview.ts`.** The architecture test gates this — same shape as `tests/architecture/no-orchestrator-network.test.ts:50-56` (which already targets `marketplace/info.ts`); ADD `orchestrators/reconcile/preview.ts` to that test's `FORBIDDEN_TARGETS` list.
- **Mutating state.json or any config file from the preview path.** No write seam may exist; the architecture test `tests/architecture/config-state-write-seams.test.ts` already gates this structurally for the path-name-specific patterns. Verify the `walkTsFiles` walker covers the new `orchestrators/reconcile/` directory (it does — it walks `EXTENSION_ROOT` recursively).
- **Embedding the reload-hint trailer on preview rows.** Preview rows are pending-state by definition; `/reload to pick up changes` is meaningless when nothing has changed yet. The `shouldEmitReloadHint` ladder MUST exclude every pending-tense token.
- **Two-step write-then-diff.** The DIFF-01 success criterion 2 says "running it twice and observing identical output" — any cache, any state mutation between calls would break this. Even a side-effecting log statement is forbidden.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Source-shape comparison (github source with optional ref / path source / future kinds) | A new `samePlannedSource` clone in `reconcile/plan.ts` | Import the existing helper (or its extracted pure form per Pattern 2 caveat) from the import family | The helper has 30 lines of carefully-tested behavior including the `unknown-stored` carve-out. Reimplementing risks divergence on future source kinds (`url` / `git-subdir` / `npm` per `parsePluginSource` switch arms). |
| Plan → notification message projection | A custom `Plan -> string[]` formatter | Build `MarketplaceNotificationMessage[]` and let `notify()` render | The catalog-uat byte gate enforces every emission go through `notify()`; an ad-hoc formatter would fail the gate. `import/execute.ts::buildImportNotificationMarketplaces` is the direct template (lines 364-497). |
| Per-(scope, marketplace) block accumulation | A custom map of marketplaces with manual merge | Reuse the `MarketplaceBlock` / `byMp: Map<key, block>` shape from `orchestrators/import/execute.ts:292-319` | Identical accumulation problem; the `${scope}:${marketplaceName}` key + `ensureMarketplaceBlock` factory are already proven. |
| Marketplace + plugin name validation | Re-call `assertSafeName` or `parsePluginSource` to validate names from `MergedConfig` | Read the names AS-IS — the names are already in MergedConfig because `loadConfig`'s typebox schema accepted them | The CONFIG_SCHEMA gate is the validation seam; a second name validation inside the planner duplicates the gate AND breaks the pure-function contract by introducing throws. If a name slipped through CONFIG_SCHEMA, that's a Phase 51 bug, not a Phase 53 concern. |
| Plugin key parsing (`${plugin}@${marketplace}`) | A new ad-hoc split | Use `String.prototype.lastIndexOf("@")` + split-at-position; document the "@" in plugin name caveat in the planner header docstring (mirror `migrate-config.ts` D-01 / Pitfall 52-6 comments) | The flat-key format is locked at Phase 52's `buildConfigFromState` (`plugins[`${pluginName}@${mpName}`] = {}`); the planner inverts it. A new parser would diverge. |
| ISO timestamps, locking, FS guards | Any I/O in the planner | Don't — the planner is pure. Locking belongs to Phase 55 (reconcile apply) and Phase 56 (write-back) | NFR-1 / NFR-5 / NFR-10 are inherited concerns of the data seams the planner consumes; the planner adds no new I/O surface. |

**Key insight:** Phase 53 is intentionally a small, mechanically-derivable phase BECAUSE Phase 51's data seams (config-io trichotomy, config-merge entry-level reducer, state-io machine bookkeeping) and Phase 52's projection (buildConfigFromState) have done the structural heavy lifting. The pure planner is a matrix walk; the preview orchestrator is a 4-line orchestration of existing seams; the renderer changes are catalog amendments. The discipline lives in the closed-set lockstep (Pattern 4) and the convergence proof (Phase 52 hand-off).

## Runtime State Inventory

> Skipped: Phase 53 is greenfield (new files + atomic catalog amendment); no rename, refactor, or migration. The Phase 52 SPLIT-01 cast migration is complete at the persistence layer; Phase 53 does not extend it. The planner reads `MergedConfig` from Phase 51 directly; no SPLIT-01 cast is introduced or removed.

## Common Pitfalls

### Pitfall 53-1: `loadMergedScopeConfig` returns a sensible-looking merged view even when `base.status === "invalid"`

**What goes wrong:** Per `config-merge.ts:143-153`, when either the base or local file is `invalid`, that file's contribution to the merged view is treated as empty `{}`. The merged view STILL has a sensible shape from the other (valid) file. A naive preview orchestrator that calls `planReconcile(outcome.merged, state, scope)` against an `invalid` base would compute a diff that PRUNES every base-declared plugin and treats the local-declared subset as the entire desired state — exactly the IaC "empty config silently uninstalls everything" hazard (Project Pitfall 1).

**Why it happens:** The merge layer's D-18 contract intentionally separates "merged view" from "load outcome." Callers MUST inspect `outcome.base.status` and `outcome.local.status` to decide policy. Phase 51 SUMMARY says explicitly: "the caller inspects `base.status` / `local.status` to decide what to do."

**How to avoid:**
- The preview orchestrator MUST check both `outcome.base.status` and `outcome.local.status` BEFORE invoking `planReconcile`. If either is `invalid`, emit a structured `(failed) {invalid manifest}`-style row (likely a `MarketplaceNotAddedMessage` analog or a new variant) carrying the file path + parse error, and SKIP planning for that scope.
- Add a test: invalid base + absent local → preview emits the failure row, ZERO planning attempted, planner not called.
- Cross-reference: this is the planning-time analog of the Phase 55 abort policy. Phase 55 will implement the apply-time abort; Phase 53 implements the preview-time abort to keep the "running it twice produces identical output" contract honest.

**Warning signs:** Preview output shows uninstalls when the user knows their config is corrupt and they expected the preview to TELL them it's corrupt.

### Pitfall 53-2: Disabled-plugin double counting (declared+disabled = pending install)

**What goes wrong:** The reconcile success criterion 3 says explicitly: "the planner's disabled-entry handling excludes disabled plugins from the desired-materialized set so the preview never shows them as pending installs." A naive planner that does `if (declared && !recorded) -> pluginsToInstall` would emit a pending-install row for every disabled+absent plugin.

**Why it happens:** `enabled: false` is the third state in the three-state model (declared / enabled / available — REQUIREMENTS Pitfall 8). A planner that collapses to two states (declared / recorded) misses it. D-04 (consume-time defaults: `undefined === true` for `enabled`) is the right rule for the planner: only `=== false` excludes; `undefined` and `=== true` both include in the desired-materialized set.

**How to avoid:**
- The planner's plugin-iteration loop checks `entry.enabled === false` BEFORE the (declared, recorded) cells:
  - `declared+disabled + recorded+materialized` → `pluginsToDisable`
  - `declared+disabled + recorded+absent` → NO action (entry honored as-is; the entry + version pin survive)
  - `declared+enabled + recorded+absent` → `pluginsToInstall`
  - `declared+enabled + recorded+materialized` → NO action (steady state)
  - `declared+absent + recorded+materialized` → `pluginsToUninstall`
  - `declared+enabled + recorded+materialized + locally disabled` (i.e. Phase 54's enable/disable command WOULD have set state.disabled = true, but Phase 54 hasn't shipped) → see Pitfall 53-4
- Lock with an exhaustive matrix test (16-cell truth table for plugin × {declared-enabled, declared-disabled, undeclared} × {recorded, not-recorded} × {installable, not-installable}).

**Warning signs:** A test fixture that disables a plugin in `claude-plugins.json` while the plugin is NOT installed produces a non-empty plan — the planner is treating the disable as an install request.

### Pitfall 53-3: New STATUS_TOKEN ships before catalog + UAT byte fixtures

**What goes wrong:** A developer adds `"to install"` to `STATUS_TOKENS` and the renderer switch arm in commit 1, then plans to add the catalog states + FIXTURES entries in commit 2. The CI run on commit 1 goes RED because `tests/architecture/notify-types.test.ts:670` asserts `(typeof REASONS)["length"] extends 29 ? true : never` and the sibling length-lock for STATUS_TOKENS would fail; `tests/architecture/catalog-uat.test.ts:2213` "inverse walk: every FIXTURES (section,state) has a matching catalog annotation" would fail on the new section that isn't in the catalog yet.

**Why it happens:** The closed-set lockstep is BYTE-LEVEL discipline. The v1.3 lesson is recorded in `STATE.md` line 144: "ES-5 atomic three-file edit ... lives in Phase 13 (CMC-35) per style guide §15 supersession contract." The v1.10 Phase 46 lesson is the same: "Type-model foundation landed (TYPE-01..04) as ONE atomic commit." Every byte change in `STATUS_TOKENS` + renderer + catalog + FIXTURES is one atomic delta.

**How to avoid:**
- Treat the DIFF-02 atomic-commit obligation as a hard pre-commit gate. The plan's first commit (pure planner + architecture purity test) introduces NO new tokens and ZERO bytes in `shared/notify.ts`. The second commit lands ALL of: tokens, renderer arms, variants, catalog states, FIXTURES, length-lock updates, preview command wiring. Tests pass on each commit independently.
- Use `git diff --stat` on the proposed second commit to confirm the file set: `shared/notify.ts`, `orchestrators/reconcile/notify.ts`, `orchestrators/reconcile/preview.ts`, `edge/handlers/plugin/preview.ts`, `edge/router.ts`, `docs/output-catalog.md`, `tests/architecture/catalog-uat.test.ts`, `tests/architecture/notify-types.test.ts`, `tests/architecture/notify-grammar-invariant.test.ts` (if affected). Anything outside this set is suspect.

**Warning signs:** `npm run check` goes RED mid-plan; the developer is tempted to commit-and-fix-forward.

### Pitfall 53-4: Phase 54 hasn't shipped, but the planner emits enable/disable transitions

**What goes wrong:** Success criterion 1 says the planner computes "enable/disable transitions." Success criterion 3 says "Phase 54 implements the commands; this phase only plans/classifies the transitions." If state.json has NO disabled-marker (because Phase 54 hasn't added one), what does the planner compare against to detect "currently disabled"?

**Why it happens:** The disabled-state-on-state-record is a Phase 54 concern. Without it, there is no way for the planner to distinguish "plugin foo@mp is materialized AND enabled" from "plugin foo@mp is materialized AND disabled at runtime." Phase 53 lands the PLAN buckets and the PLANNER LOGIC; the actual transition rendering depends on what Phase 54 adds to the state model.

**How to avoid:**
- **Phase 53 planner produces the `pluginsToDisable` bucket only from the (declared-disabled + recorded-as-materialized) cell.** Because Phase 54 hasn't shipped, "recorded-as-materialized" today === "recorded record present at all" — the planner treats every recorded record as "materialized" (since the only way to have a record is to have been installed). This means: until Phase 54 lands, the only `pluginsToDisable` rows come from someone editing `claude-plugins.json` to set `enabled: false` for an already-installed plugin.
- **The `pluginsToEnable` bucket is dormant until Phase 54.** A plugin is "currently disabled" only if Phase 54's enable/disable command marked it so. Until then, the bucket is structurally empty. The matrix test asserts it's empty for Phase 54-absent state.
- The planner's TYPE shape DOES include `pluginsToEnable` (so Phase 54 doesn't have to revisit the planner module); it's the matrix test that asserts the bucket is empty in Phase 53-only state.
- Document this in the planner's header docstring: "Phase 53 lands the bucket shapes; Phase 54 wires `pluginsToEnable` to a real (state.disabled === true) check."

**Warning signs:** Phase 53 plan-phase fights with whether to add a `disabled?` field to STATE_SCHEMA. It MUST NOT — Phase 54 owns that decision (the SPLIT-01 cast-and-defer markers in the codebase signal where the eventual reads will land).

### Pitfall 53-5: `samePlannedSource` import drags effectful dependencies into the pure planner

**What goes wrong:** `samePlannedSource` lives at `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:186-216`. `import/execute.ts` imports `addMarketplace`, `installPlugin`, `loadState`, `notify`, etc. — a transitive closure that includes effectful modules. If the planner imports `samePlannedSource` from `execute.ts`, the architecture purity test (which greps `from .*node:fs` etc.) might pass but the moral purity is compromised because the module-import graph is no longer minimal.

**Why it happens:** TypeScript imports are not lazy; importing one symbol from a file imports the entire module's top-level for side-effect purposes. The architecture test currently checks specific patterns (`gitOps`, `platform/git`, `DEFAULT_GIT_OPS`, `refreshGitHubClone`); it does NOT prohibit importing from `import/execute.ts`.

**How to avoid:**
- **Extract `samePlannedSource` and the `parsePluginSource` + `sourceLogical` consumers it needs into a new pure module** (`shared/source-compare.ts` or `domain/source-compare.ts`). Update `import/execute.ts:186` to re-import from the new location (or the original site delegates to it). The planner imports from the new location.
- This is a Rule-4-adjacent refactor (one helper moved). It is the cleanest path; flag for user-approval at plan time.
- **Alternative (less clean):** the planner re-implements the 30-line helper inline with a comment cross-referencing the original. This DUPLICATES logic; the divergence risk is real if `parsePluginSource` adds a new `kind` in a later milestone.

**Warning signs:** The architecture purity test passes but a `grep -r samePlannedSource` shows two copies of the logic.

### Pitfall 53-6: The "twice produces identical output" idempotency contract fails because of timestamp leakage

**What goes wrong:** The preview's notification cascade contains a cause / details / source-mismatch row that embeds a wall-clock timestamp (e.g. "preview generated at 2026-06-10T12:34:56Z"). Running twice produces two different timestamps; byte equality fails. Success criterion 2 says "verifiable by running it twice and observing identical output with no file or state mutation."

**Why it happens:** Developers like timestamps; `state.json` already has `lastUpdatedAt` records and the renderer for `marketplace info` consumes them. The temptation is to re-use the pattern.

**How to avoid:**
- **No new timestamp emission in preview rows.** The planner is pure; pure means deterministic; deterministic means no clock reads. Any timestamp in the preview output must come from STATE (e.g. `state.marketplaces[mp].lastUpdatedAt`), which is stable between two reads.
- Add an idempotency test: run preview, capture bytes; run again, assert byte-equal. Mock the clock to a fixed value (or just don't read it).

**Warning signs:** Preview output has a header like "Preview generated at <iso>" or similar — REMOVE it.

### Pitfall 53-7: Source-mismatch row uses `{network unreachable}` lying-reason instead of truthful `{source mismatch}`

**What goes wrong:** When `samePlannedSource` returns `false`, the preview row needs a truthful reason. The v1.10 attribution audit (`STATE.md` line 165, Phase 48 ATTR-10) closed exactly this class: `{network unreachable}` MUST NOT appear for non-network failures. A naive reconcile planner might reach for `{network unreachable}` (because reconcile-apply involves network) when the actual cause is a config-source-vs-state-source mismatch.

**Why it happens:** The reason vocabulary in `REASONS` (29 members) is rich; picking the wrong one is easy.

**How to avoid:**
- Use the existing `"source mismatch"` REASONS member (already in the closed set per `shared/notify.ts:87`). This is the Phase 47 ATTR-09 truthful-reason pattern.
- The catalog state for the source-mismatch row uses `{source mismatch}` byte-for-byte.

**Warning signs:** A preview row carrying `{network unreachable}` when the user has NOT changed network state.

## Code Examples

### Example 1: Architecture test gating planner purity

```typescript
// Source: NEW tests/architecture/reconcile-planner-purity.test.ts
// Template: tests/architecture/no-orchestrator-network.test.ts:1-100

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const PLANNER_FILE = "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";

const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "node:fs", pattern: /from\s+["']node:fs[^"']*["']/ },
  { name: "node:fs/promises", pattern: /from\s+["']node:fs\/promises["']/ },
  { name: "platform/git", pattern: /from\s+["'][^"']*platform\/git[^"']*["']/ },
  { name: "gitOps", pattern: /\bgitOps\b/ },
  { name: "notify", pattern: /\bnotify\b/ },
  { name: "saveState / saveConfig", pattern: /\bsave(State|Config)\b/ },
  { name: "atomicWriteJson", pattern: /\batomicWriteJson\b/ },
  { name: "withStateGuard / withLockedStateTransaction", pattern: /\bwith(StateGuard|LockedStateTransaction)\b/ },
];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("DIFF-01: planReconcile is pure (no fs/network/notify/save/lock imports)", async () => {
  const src = stripComments(await readFile(path.join(REPO_ROOT, PLANNER_FILE), "utf8"));
  const offenders = FORBIDDEN_PATTERNS.filter((p) => p.pattern.test(src)).map((p) => p.name);
  assert.deepEqual(
    offenders,
    [],
    `planReconcile purity violation: ${offenders.join(", ")}. The planner MUST be a pure function.`,
  );
});
```

### Example 2: Phase 52 deferred convergence proof

```typescript
// Source: NEW tests/orchestrators/reconcile/plan-convergence.test.ts
// Discharges the deferral at tests/persistence/migrate-config.test.ts:344-358

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConfigFromState,
} from "../../../extensions/pi-claude-marketplace/persistence/migrate-config.ts";
import {
  mergeScopeConfigs,
} from "../../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import {
  planReconcile,
  emptyReconcilePlan,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";

import { loadPopulatedState } from "../../persistence/fixtures/legacy/_loader.ts";

test("Phase 52 deferred proof: planReconcile(merge(buildConfigFromState(state), {}), state) === empty plan", async () => {
  const state = await loadPopulatedState();
  const merged = mergeScopeConfigs(buildConfigFromState(state), {});
  const plan = planReconcile(merged, state, "project");
  assert.deepEqual(plan, emptyReconcilePlan("project"));
});
```

### Example 3: Catalog fixture pairing for a `(to install)` token

```markdown
<!-- Source: docs/output-catalog.md (NEW section added in atomic commit) -->

## `/claude:plugin preview`

The read-only diff/preview surface. Renders the bidirectional difference between
the merged config (`claude-plugins.json` + `claude-plugins.local.json`) and the
recorded state (`state.json`) for the next load's reconcile. Runs against both
scopes when `--scope` is omitted. NEVER writes any file, NEVER touches the
network. Running it twice produces byte-identical output.

### Empty -- nothing to do (steady state)

<!-- catalog-state: empty-steady-state -->

```text
Preview: next reload will apply 0 actions.
```

The renderer emits a single info-severity advisory when every bucket is empty.
No reload-hint trailer (preview is not a transition).

### Marketplace pending add + plugin pending install

<!-- catalog-state: mp-add-plugin-install -->

```text
Preview: next reload will apply 2 actions.

● new-mp [user] (to add)
  ● new-plugin [user] (to install)
```

The marketplace pending-add header carries the `(to add)` status token; the child
plugin row carries `(to install)`. Subject-first row grammar preserved.

### Plugin pending uninstall (undeclared in config, recorded in state)

<!-- catalog-state: plugin-pending-uninstall -->

```text
Preview: next reload will apply 1 action.

● existing-mp [user]
  ○ orphan-plugin [user] (to uninstall)
```
```

```typescript
// Source: tests/architecture/catalog-uat.test.ts FIXTURES extension
//
// Adds the "/claude:plugin preview" outer key + N inner-state entries.

"/claude:plugin preview": {
  "empty-steady-state": {
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [],
      // NOTE: needs a new variant or a free-form "advisory" arm; flag in plan phase.
    },
  },
  "mp-add-plugin-install": {
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [
        {
          name: "new-mp",
          scope: "user",
          status: "to add",
          plugins: [{ status: "to install", name: "new-plugin", scope: "user", dependencies: [] }],
        },
      ],
    },
  },
  // ... more states
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| State.json holds desired state (autoupdate, enabled) AND machine bookkeeping (resolved versions, artefact records) | SPLIT-01: desired state moves to `claude-plugins.json` via CONFIG_SCHEMA; state.json keeps only machine bookkeeping | Phase 51 (2026-06-10) | Phase 53 planner reads `MergedConfig` (Phase 51's data shape) instead of state.json's autoupdate / enabled fields. |
| Migrating from V1 state.json shape required a manual one-off conversion | First-run migration generates `claude-plugins.json` losslessly from state.json (MIG-01/02 atomic, idempotent) | Phase 52 (2026-06-10) | Phase 53's convergence proof rides on Phase 52's `buildConfigFromState` projection. |
| Reconcile = "apply with side effects" (no pure planning seam) | Pure `planReconcile(merged, state) -> ReconcilePlan` lands before apply (Phase 55 will consume) | Phase 53 (now) | Apply phase becomes a thin executor of the pure plan; the matrix is testable without I/O. Same pattern as `import/marketplaces.ts` (D-28 split, 2026-05). |
| Output composed via ad-hoc strings + console.log | Structured `notify()` v2 type model with discriminated unions + byte-locked catalog | Phase 13 (v1.3, 2026-05-25) | Phase 53's new variants (pending-tense) follow the v2 model exhaustively; the catalog-uat gate enforces conformance. |
| Closed sets (REASONS / STATUS_TOKENS) amended in successive commits | Atomic lockstep amendment (renderer + sets + catalog + UAT in one commit) | Phase 13 / v1.3 (atomic-supersession lesson) reaffirmed Phase 46 (v1.10) | DIFF-02 lockstep is a hard contract; commit hygiene is the verification path. |

**Deprecated/outdated:**
- Reading `state.marketplaces[mp].autoupdate` directly (V1 pattern). Phase 51-02 carved the field out of STATE_SCHEMA; SPLIT-01 cast pattern (`// SPLIT-01:`) marks the legacy reads. Phase 53 must NOT introduce new SPLIT-01 sites — read autoupdate from `MergedConfig` if needed (it isn't strictly needed for Phase 53's diff buckets, but if surfaced in preview output it must come from the merged config).
- Composing diff output as a free-form prose summary. The `notify()` v2 model requires structured messages; the catalog gate requires byte-exact fixtures.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `samePlannedSource` can be safely extracted to a new pure module (`shared/source-compare.ts`) without breaking the import path's tests. | Pattern 2 + Pitfall 53-5 | Medium. The plan-phase user-approval gate exists for this; alternative is in-place duplication (Pitfall 53-5 second bullet). Risk: catalog-uat byte forms involving import-cascade rows might depend on the helper's identity via a type-level cast. **VERIFIED via grep:** `samePlannedSource` has only 2 in-repo callsites (`execute.ts:529` and the test comment at `tests/orchestrators/import/execute.test.ts:241`); extracting and re-exporting from `import/execute.ts` for backward-compat preserves the import path's behavior. [VERIFIED: codebase grep] |
| A2 | The preview command sits as a top-level `/claude:plugin preview` subcommand (not as a flag on an existing subcommand like `marketplace list --preview`). | Architectural Responsibility Map + Pattern 3 | Low. The PRD and roadmap suggest a standalone read-only command; precedent (`list`, `info`, `marketplace info`) supports top-level subcommand. Could be revisited in plan phase if the user prefers a flag-based shape. [ASSUMED] |
| A3 | A single `notify()` call per scope (or one combined cascade) is sufficient — no need for a separate diagnostics channel. | Open Questions 1 | Low. The architecture parallels `marketplace info`'s "exactly one `notify()` call per invocation on the all-success / all-not-added paths" (info.ts:7). If the preview surfaces per-scope cause rows, those land inside the cascade as failed-row variants. [ASSUMED] |
| A4 | The 4 new pending-tense status tokens (`to install`, `to uninstall`, `to enable`, `to disable`) plus 2 marketplace pending tokens (`to add`, `to remove`) are the right grammar. | Pattern 5 | Medium. The alternative (reuse + advisory header) is structurally simpler but conflates state. The recommendation is informed by the `shouldEmitReloadHint` trigger-set discipline; reviewer may have a different aesthetic preference. [ASSUMED — recommendation only; plan phase decides] |
| A5 | The preview surfaces an info-severity advisory header line "Preview: next reload will apply N actions." even when the plan is empty. | Code Examples Example 3 | Low-Medium. Empty plan rendering is a UX choice; alternative is a bare `(no actions)` body line (mirroring `(no marketplaces)` at `docs/output-catalog.md:161`). The catalog gate decides which lands. [ASSUMED] |
| A6 | The CFG-03 abort-on-invalid contract applies at preview time exactly as it will at Phase 55 apply time. | Pitfall 53-1 | Low. Phase 51 SUMMARY makes the abort signal explicit; the preview's idempotency contract demands invalid configs surface deterministically. [VERIFIED: Phase 51 SUMMARY + config-merge.ts:143-153] |
| A7 | Source-mismatches are rendered as `(failed) {source mismatch}` rows on the marketplace subject, NOT on the plugin children. | Pattern 1 + Pitfall 53-7 | Low. Phase 47 ATTR-09 + Phase 48 ATTR-10 lessons converged on truthful marketplace-subject attribution; the preview should mirror. [VERIFIED: STATE.md line 164-165 v1.10 attribution corrections] |

**If this table is empty:** Some claims still need user confirmation; the plan-phase discuss should surface A2, A4, A5 for explicit decision.

## Open Questions

1. **Subcommand-name decision.**
   - What we know: The roadmap describes the surface as "Pure Reconcile Planner & Dry-Run Preview"; the natural names are `preview`, `diff`, `reconcile --dry-run`, or `dry-run`.
   - What's unclear: Which name aligns best with project convention. `list` and `info` already exist; `preview` mirrors them in shape (read-only, no positional / single positional, optional `--scope`). `reconcile` as a top-level subcommand would imply a future `reconcile` (no flag) apply command, which is out of scope per "Out of Scope" in REQUIREMENTS ("Sync/apply command. Reconciliation is load-time only by decision -- restart/reload applies hand-edits; the diff command covers preview").
   - Recommendation: **`preview`** as a top-level `/claude:plugin preview` subcommand. Concise, action-oriented, no implicit future-apply contract.

2. **Plan-rendering granularity: one cascade per scope, or one global cascade with implicit per-scope grouping?**
   - What we know: `marketplace info` fan-out emits per-scope blocks joined with `\n\n` via `MarketplaceInfoCascadeMessage` (lines 843-846 of notify.ts). The list surface already groups per-(scope, marketplace) with the orphan-fold rule.
   - What's unclear: Whether preview output is one global cascade (all marketplaces from both scopes interleaved) or per-scope blocks. Per-scope blocks read more naturally because the user authors per-scope config files.
   - Recommendation: One global cascade with `compareByNameThenScope` ordering (mirrors import's `buildImportNotificationMarketplaces` ordering at `execute.ts:496`).

3. **Empty-plan rendering.**
   - What we know: The catalog has precedents for empty surfaces — `(no marketplaces)` for empty list, `(no plugins)` for plugin list. Both are flat STATUS_TOKENS members.
   - What's unclear: Does empty-plan render as `(no actions)` (new token) or as a free-form advisory line like "Preview: next reload will apply 0 actions." or simply emit no `notify()` call at all (silent steady state)?
   - Recommendation: Free-form advisory header (one line, no new token) — matches the v1.10/v1.11 summary-line discipline (a leading body line summarizing the cascade). Plan-phase confirms.

4. **Does the planner need to handle the `marketplaceUpdate` (autoupdate flip) transition?**
   - What we know: Autoupdate is a marketplace-level user setting now living in CONFIG_SCHEMA (per Phase 51). A user could declare `autoupdate: true` in config while state still records the old setting.
   - What's unclear: Is the autoupdate flip a `marketplaceToUpdate` planner bucket, or is it deferred entirely to Phase 56 write-back (since autoupdate doesn't affect materialized artefacts)?
   - Recommendation: **Defer the autoupdate-flip bucket to Phase 55/56.** Autoupdate is purely a setting; it doesn't trigger reconcile-time install/uninstall. The preview surface need not show it. If the user wants visibility, they can run `marketplace info`. (Phase 53 narrower scope.)

5. **Where does `samePlannedSource` live after extraction?**
   - What we know: Pitfall 53-5 recommends extraction.
   - What's unclear: `shared/source-compare.ts` vs `domain/source-compare.ts` vs `domain/source.ts` (extend the existing module).
   - Recommendation: **Extend `domain/source.ts`** (add `samePlannedSource` as a sibling export to `parsePluginSource` + `sourceLogical`). Already a pure module; no new file.

## Environment Availability

> Skipped: Phase 53 has zero external dependencies. All seams (config-io, config-merge, state-io, notify) are pre-existing Phase 51 / Phase 52 deliverables; the planner is a pure transform; the edge command uses the standard Pi extension API already declared as a peer dep. No CLI tools, no databases, no runtime services.

## Validation Architecture

> nyquist_validation is enabled (not explicitly false in `.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node >= 20.19.0) |
| Config file | none — tests are discovered by `glob` in package.json scripts |
| Quick run command | `node --import tsx --test tests/orchestrators/reconcile/plan.test.ts` |
| Full suite command | `npm run check` (typecheck + lint + format + test + integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIFF-01 | `planReconcile` is a pure function (no fs/network/save imports) | architecture | `node --import tsx --test tests/architecture/reconcile-planner-purity.test.ts` | ❌ Wave 0 |
| DIFF-01 | `planReconcile` produces empty plan for steady state (Phase 52 convergence proof) | unit (integration with persistence) | `node --import tsx --test tests/orchestrators/reconcile/plan-convergence.test.ts` | ❌ Wave 0 |
| DIFF-01 | `planReconcile` populates each of 7 buckets correctly across the exhaustive matrix | unit | `node --import tsx --test tests/orchestrators/reconcile/plan.test.ts` | ❌ Wave 0 |
| DIFF-01 | preview command runs twice and produces byte-identical output (idempotent + no-mutation) | unit | `node --import tsx --test tests/orchestrators/reconcile/preview.test.ts` | ❌ Wave 0 |
| DIFF-01 | preview command performs no network calls (no gitOps surface) | architecture | extension of `tests/architecture/no-orchestrator-network.test.ts` | ✅ (extend existing) |
| DIFF-01 | preview command performs no writes (no atomicWriteJson on config/state paths) | architecture | `tests/architecture/config-state-write-seams.test.ts` (already gates) | ✅ (no changes — walker covers new files automatically) |
| DIFF-02 | output rows follow subject-first grammar with closed-set tokens | architecture (byte-equality) | `tests/architecture/catalog-uat.test.ts` (extended with `"/claude:plugin preview"` section) | ✅ (extend existing) |
| DIFF-02 | new STATUS_TOKENS land in lockstep with `notify-types` length lock | architecture | `tests/architecture/notify-types.test.ts` (update length asserts) | ✅ (extend existing) |
| DIFF-02 | new STATUS_TOKENS land in lockstep with `notify-grammar-invariant` | architecture | `tests/architecture/notify-grammar-invariant.test.ts` | ✅ (extend existing) |
| DIFF-02 | every FIXTURES entry has a catalog annotation (inverse walk) | architecture | `tests/architecture/catalog-uat.test.ts:2213` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `npm run typecheck && node --import tsx --test tests/orchestrators/reconcile/*.test.ts tests/architecture/reconcile-planner-purity.test.ts`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` GREEN at minimum 1571 + N unit tests (Phase 52 close baseline); `tests/integration/` 7+ GREEN.

### Wave 0 Gaps
- [ ] `tests/architecture/reconcile-planner-purity.test.ts` — gates DIFF-01 purity
- [ ] `tests/orchestrators/reconcile/plan.test.ts` — exhaustive matrix coverage of DIFF-01
- [ ] `tests/orchestrators/reconcile/plan-convergence.test.ts` — Phase 52 deferred proof
- [ ] `tests/orchestrators/reconcile/notify.test.ts` — plan-to-message projection
- [ ] `tests/orchestrators/reconcile/preview.test.ts` — idempotency + no-mutation
- [ ] `tests/edge/handlers/plugin/preview.test.ts` — shim parse + dispatch
- [ ] Extension of `tests/architecture/no-orchestrator-network.test.ts` FORBIDDEN_TARGETS to include `orchestrators/reconcile/preview.ts`
- [ ] Extension of `tests/architecture/catalog-uat.test.ts::FIXTURES` with `"/claude:plugin preview"` entries
- [ ] Extension of `tests/architecture/notify-types.test.ts` length-locks for `STATUS_TOKENS` / `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` (if new tokens land)
- [ ] Extension of `tests/architecture/notify-grammar-invariant.test.ts` for the new variants

## Security Domain

> `security_enforcement` is not explicitly `false` in config — included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Preview is read-only, no auth surface; no credentials touched. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | File-system scope containment already covered by `assertPathInside` (NFR-10); preview only reads, never writes. |
| V5 Input Validation | yes | `MergedConfig` is already typebox-validated (CFG-03 trichotomy); `state.json` already STATE_VALIDATOR-validated at load. The planner consumes already-validated inputs. The plugin-key parser (split on last `@`) is the only new parse path; document the "@" in plugin name caveat and rely on the upstream CONFIG_SCHEMA (`Type.Record(Type.String(), ...)`) which accepts any key. |
| V6 Cryptography | no | No new cryptography. PI-7 hash version display is a pre-existing renderer concern. |

### Known Threat Patterns for TypeScript/Node Pi extension

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Maliciously crafted `claude-plugins.json` with adversarial marketplace name (`../escape`) | Tampering | Already mitigated: `assertSafeName` is enforced at every name-derived path construction in `persistence/locations.ts`. The PLANNER does not call any path-construction helper, so the surface is closed. |
| Adversarial source string in MergedConfig causing parse explosion in `samePlannedSource` | DoS | Use the existing `parsePluginSource` (domain/source.ts) which is hardened. No new parsing. |
| Adversarial plugin key (e.g. `evil@evil@@evil`) causing planner to mis-attribute | Tampering | Document the "@" caveat; the planner does NOT execute / dispatch — it merely records buckets. Phase 55 apply path is where actual side effects land; that phase owns the runtime safety gate. |
| Information disclosure via preview output (printing user-private paths from state.json) | Information Disclosure | Preview output already constrained to subject-first row grammar; the renderer never emits absolute paths in the `(failed)` row. The advisory body for an invalid file COULD include `filePath` — verify in plan phase the path is project-relative or path.basename, not absolute. |

## Sources

### Primary (HIGH confidence)
- `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts:84-120` — `buildClaudeImportPlan` template (pure planner pattern)
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:186-216` — `samePlannedSource` helper (source comparison)
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:364-497` — `buildImportNotificationMarketplaces` template (plan → message projection)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:1-90` — read-only orchestrator template (no withStateGuard, no gitOps)
- `extensions/pi-claude-marketplace/persistence/config-merge.ts:143-153` — MergedConfig loader (CFG-03 trichotomy contract)
- `extensions/pi-claude-marketplace/persistence/migrate-config.ts:81-124` — `buildConfigFromState` (Phase 52 projection)
- `extensions/pi-claude-marketplace/shared/notify.ts:70-300` — REASONS / STATUS_TOKENS / MARKERS closed sets + discriminated unions
- `tests/architecture/config-state-write-seams.test.ts` — write-seam architecture test (template for purity gate)
- `tests/architecture/no-orchestrator-network.test.ts` — network-import gate (extend with preview target)
- `tests/architecture/catalog-uat.test.ts:227+` — FIXTURES map structure (atomic-amendment target)
- `tests/persistence/migrate-config.test.ts:340-368` — Phase 52 Section D deferred proof (hand-off into Phase 53)
- `docs/output-catalog.md:125-149` — Status token reference (closed-set authority)

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md:142-180` (v1.12 ecosystem research) — reconcile orchestrator placement guidance
- `.planning/research/PITFALLS.md:25-232` — Project Pitfalls 1-8 (most relevant to Phase 53)
- `.planning/research/SUMMARY.md:115-130` — pure-planner / Phase-3 decomposition

### Tertiary (LOW confidence)
- (none — Phase 53 is entirely brownfield; no external research applies)

## Metadata

**Confidence breakdown:**
- Architecture / pattern reuse: HIGH — direct templates exist in codebase (import planner, marketplace info)
- Closed-set lockstep workflow: HIGH — three precedents (Phase 13, Phase 46, Phase 50)
- Convergence proof: HIGH — Phase 52 hand-off is explicit and the proof shape is mechanical
- Subcommand naming + grammar choice: MEDIUM — multiple reasonable options; recommendations made but plan-phase confirms
- `samePlannedSource` extraction: MEDIUM — clean refactor but requires user approval (Rule 4-adjacent)

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (30 days; reconcile-design domain is stable, Phase 51-52 frozen foundation locked)
