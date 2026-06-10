# Phase 53: Pure Reconcile Planner & Dry-Run Preview - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 13 (8 new, 5 modified)
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` (NEW) | pure planner (domain) | transform (config+state -> plan) | `orchestrators/import/marketplaces.ts` (`buildClaudeImportPlan`) | exact (D-28 pure-planner template) |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` (NEW) | type module | data-shape | `orchestrators/import/types.ts` | exact |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` (NEW) | projection (plan -> message) | transform | `orchestrators/import/execute.ts::buildImportNotificationMarketplaces` (lines 292-497) | exact |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts` (NEW) | read-only orchestrator | request-response | `orchestrators/marketplace/info.ts` | exact |
| `extensions/pi-claude-marketplace/domain/source.ts` (MODIFIED) | pure helper (add `samePlannedSource`) | transform | existing `samePlannedSource` in `orchestrators/import/execute.ts:186-216` | exact (extraction) |
| `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` (MODIFIED) | re-export shim after extraction | refactor | self (delete-and-import) | exact |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/preview.ts` (NEW) | edge command shim | request-response | `edge/handlers/marketplace/info.ts` (single-positional) AND `edge/handlers/plugin/list.ts` (no positional + flag) | role-match (closer to `list`: no positional) |
| `extensions/pi-claude-marketplace/edge/router.ts` (MODIFIED) | router + subcommand registration | dispatch | `case "info":` / `case "list":` arms (lines 143-149) | exact |
| `extensions/pi-claude-marketplace/edge/completions/provider.ts` (MODIFIED) | tab-completion (TOP_LEVEL_SUBCOMMANDS only) | request-response | `topLevelCompletions` (provider.ts:70) | exact (auto-propagates) |
| `extensions/pi-claude-marketplace/shared/notify.ts` (MODIFIED) | closed-set + renderer arms + variants | type-model + render | existing `MpAdded` / `PluginInstalledMessage` arms (lines 380-700) | exact |
| `extensions/pi-claude-marketplace/docs/output-catalog.md` (MODIFIED) | byte-exact catalog states | docs | existing per-command H2 sections | exact |
| `tests/architecture/reconcile-planner-purity.test.ts` (NEW) | architecture grep-gate | static analysis | `tests/architecture/no-orchestrator-network.test.ts` | exact |
| `tests/architecture/catalog-uat.test.ts` (MODIFIED) | byte-equality fixtures | data fixture | existing `FIXTURES` entries (line 227+) | exact |
| `tests/architecture/notify-types.test.ts` (MODIFIED) | tuple length-lock | static type | `_Assert_PluginStatusesLen` block (lines 122-135) | exact |
| `tests/architecture/no-orchestrator-network.test.ts` (MODIFIED) | extend `FORBIDDEN_TARGETS` | static analysis | self | exact |
| `tests/orchestrators/reconcile/plan.test.ts`, `plan-convergence.test.ts`, `notify.test.ts`, `preview.test.ts` (NEW) | unit test | unit | `tests/orchestrators/marketplace/info.test.ts` | role-match |
| `tests/edge/handlers/plugin/preview.test.ts` (NEW) | edge shim test | unit | `tests/edge/handlers/plugin/list.test.ts` | role-match |

## Pattern Assignments

### `orchestrators/reconcile/plan.ts` (NEW; pure planner, transform)

**Analog:** `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts:84-120`

**Imports pattern (typed-only; no I/O):**
```typescript
// Mirror of import/marketplaces.ts: type-only imports + sibling pure helpers.
import type { MergedConfig } from "../../persistence/config-merge.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";
import { samePlannedSource } from "../../domain/source.ts"; // post-extraction (Pattern X)
```

**Pure-function shape (lines 84-120 of marketplaces.ts):**
```typescript
function scopedPlan(input: ScopedClaudeImportPlanInput): ScopedClaudeImportPlan {
  const extracted = extractEnabledPluginRefs(input.scope, input.settings);
  const marketplacePlan = planMarketplaceSourcesForRefs(
    input.scope,
    extracted.refs,
    input.settings.extraKnownMarketplaces,
  );
  // ... partition into buckets ...
  return {
    scope: input.scope,
    marketplacesToEnsure: marketplacePlan.marketplacesToEnsure,
    pluginsToInstall,
    skippedPlugins,
    diagnostics: [...extracted.diagnostics, ...marketplacePlan.diagnostics],
  };
}

export function buildClaudeImportPlan(
  inputs: readonly ScopedClaudeImportPlanInput[],
): ClaudeImportPlan {
  const scopes = inputs.map(scopedPlan);
  return { scopes, diagnostics: scopes.flatMap((s) => s.diagnostics) };
}
```

**Copy pattern:** flat `for` loops walking `merged.marketplaces` ∪ `state.marketplaces` and `merged.plugins` ∪ recorded plugin records; partition into 7 readonly arrays; return immutable `ReconcilePlan`. No `await`. No fs imports.

---

### `orchestrators/reconcile/notify.ts` (NEW; plan -> message projection)

**Analog:** `orchestrators/import/execute.ts:292-497` (`buildImportNotificationMarketplaces` + `MarketplaceBlock` + `ensureMarketplaceBlock`)

**Block-accumulator pattern (lines 292-319):**
```typescript
interface MarketplaceBlock {
  readonly key: string;
  readonly name: string;
  readonly scope: Scope;
  status?: MarketplaceStatus;
  plugins: PluginNotificationMessage[];
}

function ensureMarketplaceBlock(
  byMp: Map<string, MarketplaceBlock>,
  scope: Scope,
  marketplaceName: string,
): MarketplaceBlock {
  const key = `${scope}:${marketplaceName}`;
  const existing = byMp.get(key);
  if (existing !== undefined) return existing;
  const block: MarketplaceBlock = { key, name: marketplaceName, scope, plugins: [] };
  byMp.set(key, block);
  return block;
}
```

**Bucket-walk pattern (lines 370-420):** one `for` loop per bucket; each loop calls `ensureMarketplaceBlock` and either sets `block.status = "<token>"` or `block.plugins.push({ status: "<token>", name, ... })`. After all buckets walked, sort blocks via `compareByNameThenScope`, return `{ marketplaces: [...] }` (a `CascadeNotificationMessage`).

---

### `orchestrators/reconcile/preview.ts` (NEW; read-only orchestrator)

**Analog:** `orchestrators/marketplace/info.ts`

**Header docstring pattern (lines 1-12):**
```typescript
// Read-only preview surface for `/claude:plugin preview`. MUST NOT touch
// the network (NFR-5) -- no `platform/git`, no `DEFAULT_GIT_OPS`, no
// `refreshGitHubClone`. The grep-gate test in
// `tests/architecture/no-orchestrator-network.test.ts` enforces this
// structurally. NEVER writes any file (NFR-5 read-surface discipline).
// IL-2: exactly one `notify()` call per invocation.
```

**Imports pattern (lines 13-27):**
```typescript
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { notify } from "../../shared/notify.ts";
import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { NotificationMessage } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

import { planReconcile } from "./plan.ts";
import { buildReconcilePreviewNotification } from "./notify.ts";
```

**Options-bag + fan-out pattern (info.ts lines 29-37, 136-156):**
```typescript
export interface PreviewReconcileOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly cwd: string;
  /** When omitted, fan-out across BOTH scopes (project-first per MSG-GR-3). */
  readonly scope?: Scope;
}

export async function previewReconcile(opts: PreviewReconcileOptions): Promise<void> {
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];
  // ... load + plan per scope ...
  // single notify() call at end (IL-2)
  notify(opts.ctx, opts.pi, message);
}
```

**CFG-03 abort pattern (Pitfall 53-1):** check `outcome.base.status === "invalid" || outcome.local.status === "invalid"` BEFORE invoking `planReconcile`; emit a failure-variant row and SKIP planning for that scope.

---

### `edge/handlers/plugin/preview.ts` (NEW; thin shim)

**Analog:** `edge/handlers/marketplace/info.ts` (USAGE + factory shape) crossed with `edge/handlers/plugin/list.ts` (parseArgs pattern; preview has no positional but does have `--scope`).

**Recommended shape:**
```typescript
// edge/handlers/plugin/preview.ts
//
// Thin-shim handler factory for
// `/claude:plugin preview [--scope user|project]`.
// Argument-parsing failures route through `notifyUsageError`; the
// orchestrator handles per-scope projection.

import { previewReconcile } from "../../../orchestrators/reconcile/preview.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { notifyUsageError } from "../../../shared/notify.ts";
import { parseArgs } from "../../args.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";

const USAGE = "Usage: /claude:plugin preview [--scope user|project]";

export function makePreviewHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    let parsed;
    try {
      parsed = parseArgs(args);
    } catch (err) {
      notifyUsageError(ctx, { message: errorMessage(err), usage: USAGE });
      return;
    }

    if (parsed.positional.length > 0) {
      notifyUsageError(ctx, { message: "Too many arguments.", usage: USAGE });
      return;
    }

    await previewReconcile({
      ctx,
      pi,
      cwd: ctx.cwd,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
```

**Notes:** No positional means simpler than `list.ts`; no `BOOLEAN_FLAGS` set; if any positional or unknown flag is supplied, surface USAGE.

---

### `edge/router.ts` (MODIFIED; subcommand registration)

**Analog:** itself (lines 50-61, 132-156).

**Three coordinated edits:**

1. Add `"preview"` to `TOP_LEVEL_SUBCOMMANDS` (line 50-61) — completion provider auto-picks up because it iterates this tuple (`provider.ts:70`).
2. Add new field to `SubcommandHandlers` interface (line ~40): `preview: (args: string, ctx: ExtensionCommandContext) => Promise<void>;`
3. Add new `case "preview":` arm to `routeClaudePlugin` switch (between `case "info":` and `case "import":` is natural alphabetical/grouping):

```typescript
case "info":
  return handlers.pluginInfo(rest, ctx);
case "preview":
  return handlers.preview(rest, ctx);
case "import":
  return handlers.import(rest, ctx);
```

4. Update `TOP_LEVEL_USAGE` block (lines 79-89) to include `preview` line.

---

### `domain/source.ts` (MODIFIED; extract `samePlannedSource`)

**Source:** `orchestrators/import/execute.ts:186-216` — copy verbatim into `domain/source.ts` next to `sourceLogical` (existing pure module).

**Current code at execute.ts:186-216:**
```typescript
function samePlannedSource(stored: unknown, plannedRaw: string): boolean | "unknown-stored" {
  const planned = parsePluginSource(plannedRaw);
  const current = parsePluginSource(stored);
  if (current.kind === "unknown") return "unknown-stored";
  if (planned.kind !== current.kind) return false;
  switch (planned.kind) {
    case "github":
      return current.kind === "github" && planned.owner === current.owner
        && planned.repo === current.repo && planned.ref === current.ref;
    case "path":
      return current.kind === "path" && planned.logical === current.logical;
    case "url":
    case "git-subdir":
    case "npm":
      return sourceLogical(planned) === sourceLogical(current);
  }
}
```

**Post-extraction:** add `export` keyword in `domain/source.ts`; `import/execute.ts` deletes the local definition and adds `import { samePlannedSource } from "../../domain/source.ts";`. Behavior-neutral — existing `execute.test.ts:241` continues to pass because the call sites unchanged (verified: only 2 call sites per RESEARCH A1).

---

### `shared/notify.ts` (MODIFIED; atomic 6-fold catalog amendment)

**Analog:** `STATUS_TOKENS` tuple (lines 152-168), `PLUGIN_STATUSES` (lines 260-272), `MARKETPLACE_STATUSES` (lines 283-291), and per-variant interfaces (lines 380-700).

**Pattern: closed-set `as const` tuple + indexed-access type derivation.**

Add new pending-tense tokens (D-53-02 `will ...` form):
```typescript
export const STATUS_TOKENS = [
  // ... existing 15 ...
  "will add",
  "will remove",
  "will install",
  "will uninstall",
  "will enable",
  "will disable",
] as const; // length 15 -> 21

export const PLUGIN_STATUSES = [
  // ... existing 11 ...
  "will install",
  "will uninstall",
  "will enable",
  "will disable",
] as const; // length 11 -> 15

export const MARKETPLACE_STATUSES = [
  // ... existing 7 ...
  "will add",
  "will remove",
] as const; // length 7 -> 9
```

**New variant interface pattern (mirror MpAdded at lines 593-595):**
```typescript
/** `(will add)` marketplace block (preview surface; planner-only). */
interface MpWillAdd extends MpCommon { readonly status: "will add"; }
interface MpWillRemove extends MpCommon { readonly status: "will remove"; }
// add to MarketplaceNotificationMessage union (line 670)

/** `(will install)` plugin row (preview surface). NO `dependencies` — the
 * soft-dep probe is meaningless before installation. NO `reasons`. */
export interface PluginWillInstallMessage {
  readonly status: "will install";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
}
// similarly PluginWillUninstallMessage / PluginWillEnableMessage / PluginWillDisableMessage
// add 4 to PluginNotificationMessage union (line 562)
```

**Renderer arm pattern (existing `case "installed":` is the template):** add `case "will install":`, `case "will uninstall":`, `case "will enable":`, `case "will disable":` arms — each emits the same subject-first row form but with the pending-tense token.

**`shouldEmitReloadHint` ladder (lines 1791+):** new `will*` tokens MUST NOT appear in the trigger set — preview rows are pre-transition; the `/reload to pick up changes` trailer is grammatically false for them. Verify the function still returns `false` for every new variant.

---

### `docs/output-catalog.md` (MODIFIED; new H2 section)

**Analog:** existing per-command H2 sections (e.g. `/claude:plugin list`, `/claude:plugin info`).

**Required catalog states (5 minimum per Pattern 4):**

1. `<!-- catalog-state: empty-steady-state -->` — empty plan, free-form advisory line (D-53 discretion).
2. `<!-- catalog-state: mp-add-plugin-install -->` — marketplace `(will add)` header with child plugin `(will install)`.
3. `<!-- catalog-state: plugin-pending-uninstall -->` — orphan plugin `(will uninstall)`.
4. `<!-- catalog-state: enable-disable-transitions -->` — `(will enable)` / `(will disable)` rows.
5. `<!-- catalog-state: source-mismatch -->` — marketplace `(failed) {source mismatch}` (truthful reason per Pitfall 53-7; reuses existing `"source mismatch"` REASONS member at notify.ts:87).

Each state: H3 header + `<!-- catalog-state: NAME -->` HTML comment + a single fenced \`\`\`text block holding the byte-exact rendered string.

---

### `tests/architecture/catalog-uat.test.ts` (MODIFIED; FIXTURES extension)

**Analog:** existing `FIXTURES` entries at line 227+ (per-command outer key + per-state inner key + `{ message, pi, expectedSeverity? }`).

**Pattern:**
```typescript
"/claude:plugin preview": {
  "empty-steady-state": {
    pi: piWithBothLoaded(),
    message: { marketplaces: [] }, // OR a new advisory variant — settle in plan
  },
  "mp-add-plugin-install": {
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [
        {
          name: "new-mp",
          scope: "user",
          status: "will add",
          plugins: [{ status: "will install", name: "new-plugin" }],
        },
      ],
    },
  },
  // ... matching every catalog state in output-catalog.md ...
},
```

**MockPi factories** (existing at lines 156-180): `piWithBothLoaded()` is the default for preview rows (no soft-dep probe).

**`expectedSeverity`:** info severity (omit field) — preview never carries `failed` or `manual recovery` rows except in the CFG-03-invalid path, which gets its own state with `expectedSeverity: "error"`.

---

### `tests/architecture/notify-types.test.ts` (MODIFIED; length-locks)

**Analog:** existing length-lock blocks at lines 122-135 and 670.

**Pattern:**
```typescript
type _Assert_PluginStatusesLen = (typeof PLUGIN_STATUSES)["length"] extends 15 ? true : never;
type _Assert_MarketplaceStatusesLen = (typeof MARKETPLACE_STATUSES)["length"] extends 9 ? true : never;
// STATUS_TOKENS gets its lock too (mirror existing pattern)
type _Assert_StatusTokensLen = (typeof STATUS_TOKENS)["length"] extends 21 ? true : never;
```

Bump existing `extends 11` -> `15`, `extends 7` -> `9`. Adds STATUS_TOKENS lock at 21 if not already present.

---

### `tests/architecture/no-orchestrator-network.test.ts` (MODIFIED; extend FORBIDDEN_TARGETS)

**Analog:** itself (lines 50-56).

**Edit:**
```typescript
const FORBIDDEN_TARGETS: ReadonlyArray<string> = [
  // ... existing 5 ...
  "extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts",
  "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts",
  "extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts",
];
```

Same `FORBIDDEN_PATTERNS` + `stripComments` walker — no other changes needed. The ENOENT skip path means this edit is safe to land in the same commit as the new files.

---

### `tests/architecture/reconcile-planner-purity.test.ts` (NEW; planner purity gate)

**Analog:** `tests/architecture/no-orchestrator-network.test.ts` (full template).

**Imports + walker pattern (lines 1-7, 65-69):**
```typescript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
```

**Extended FORBIDDEN_PATTERNS for the planner (broader than the network gate):**
```typescript
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

test("DIFF-01: planReconcile is pure (no fs/network/notify/save/lock imports)", async () => {
  const src = stripComments(await readFile(path.join(REPO_ROOT, PLANNER_FILE), "utf8"));
  const offenders = FORBIDDEN_PATTERNS.filter((p) => p.pattern.test(src)).map((p) => p.name);
  assert.deepEqual(offenders, [], `planReconcile purity violation: ${offenders.join(", ")}`);
});
```

---

## Shared Patterns

### Closed-set lockstep (Pattern 4, atomic commit)

**Source:** `shared/notify.ts` STATUS_TOKENS/PLUGIN_STATUSES/MARKETPLACE_STATUSES + `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts::FIXTURES` + `tests/architecture/notify-types.test.ts` length-locks.

**Apply to:** the SECOND commit of Phase 53 (the user-visible bytes). The FIRST commit (pure planner + architecture purity test + Phase 52 convergence proof) introduces ZERO new tokens / variants / catalog entries.

Six coordinated edits land in ONE atomic commit:
1. `STATUS_TOKENS` tuple — add literals
2. `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` — add literals
3. Renderer arms — `case "will install":` etc.
4. Discriminated-union variant interfaces — `PluginWillInstallMessage` etc., added to the unions
5. `docs/output-catalog.md` — new H2 + ≥5 catalog states with `<!-- catalog-state: NAME -->` annotations + byte-exact code fences
6. `FIXTURES` map — `"/claude:plugin preview"` outer key + per-state entries
+ length-lock numbers updated in `notify-types.test.ts`

### Read-only orchestrator discipline (NFR-5)

**Source:** `orchestrators/marketplace/info.ts:1-12` header docstring.

**Apply to:** `orchestrators/reconcile/preview.ts`, `orchestrators/reconcile/plan.ts`, `orchestrators/reconcile/notify.ts`.

Header docstring MUST state: "MUST NOT touch the network (NFR-5) -- no `platform/git`, no `DEFAULT_GIT_OPS`. NEVER writes any file. IL-2: exactly one `notify()` call per invocation."

### Subject-first row grammar (locked project convention)

**Source:** existing renderer arms in `shared/notify.ts`.

**Apply to:** every new renderer arm (`case "will install":` etc.).

Form: `<glyph> <name> [<scope>] (<status>) {<reason>?}` — status token NEVER precedes the subject. Disabled icon (`⊘`) for `will disable`; installed icon (`●`) for `will enable` / `will install` / `will add`; uninstalled icon (`○`) for `will uninstall` / `will remove`.

### Phase 52 convergence proof discharge

**Source:** `tests/persistence/migrate-config.test.ts:340-368` Section D header comment (deferred to Phase 53).

**Apply to:** `tests/orchestrators/reconcile/plan-convergence.test.ts` (NEW). Assert: `planReconcile(mergeScopeConfigs(buildConfigFromState(state), {}), state, "project")` deepEqual `emptyReconcilePlan("project")`.

## No Analog Found

None. Every Phase 53 file has a direct or near-direct analog in the existing codebase. The phase is intentionally a mechanical derivation from Phase 51 (`MergedConfig`), Phase 52 (`buildConfigFromState`), the import planner family, and the closed-set lockstep precedents (Phase 13/46/50).

## Metadata

**Analog search scope:**
- `extensions/pi-claude-marketplace/orchestrators/{import,marketplace,plugin}/`
- `extensions/pi-claude-marketplace/edge/{router.ts,handlers,completions}/`
- `extensions/pi-claude-marketplace/shared/notify.ts`
- `extensions/pi-claude-marketplace/domain/source.ts`
- `extensions/pi-claude-marketplace/persistence/{config-merge.ts,state-io.ts,locations.ts}`
- `tests/architecture/{no-orchestrator-network,catalog-uat,notify-types}.test.ts`
- `docs/output-catalog.md`

**Pattern extraction date:** 2026-06-10
