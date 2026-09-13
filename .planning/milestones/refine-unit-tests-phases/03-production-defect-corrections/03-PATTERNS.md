# Phase 3: Production Defect Corrections - Pattern Map

**Mapped:** 2026-09-06
**Authority:** Active Phase 3 records in `01-REVALIDATION.json`, as narrowed by `03-CONTEXT.md` and the Authorized Implementation Inventory in `03-RESEARCH.md`
**Files classified:** 26 production/test owners
**Analogs found:** 26 / 26

Historical review claims that are stale, struck, superseded, supporting-only, evidence-only, size-only, or routed to Phases 4-8 are excluded.

## File Classification

| New/Modified File | Role | Data Flow | Closest Tracked Analog | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts` | service | file-I/O / transform | `extensions/pi-claude-marketplace/bridges/agents/discover.ts` | exact contract |
| `extensions/pi-claude-marketplace/bridges/agents/types.ts` | model | transform | `extensions/pi-claude-marketplace/bridges/agents/discover.ts` | exact contract |
| `extensions/pi-claude-marketplace/bridges/agents/stage.ts` | service | file-I/O / batch | `extensions/pi-claude-marketplace/bridges/agents/discover.ts` | exact contract |
| `extensions/pi-claude-marketplace/orchestrators/plugin/{install,update,reinstall}.ts` (agent-path callers) | service | request-response / file-I/O | `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts` | same flow |
| `tests/bridges/agents/{discover,stage}.test.ts`, `tests/orchestrators/plugin/{install,update,reinstall}.test.ts` | test | file-I/O | `tests/bridges/agents/discover.test.ts` | exact |
| `extensions/pi-claude-marketplace/bridges/hooks/payloads/{pre-compact,post-compact}.ts` | service | event-driven / transform | each other plus `domain/components/hook-events.ts` | exact |
| `extensions/pi-claude-marketplace/domain/components/hook-events.ts` | model | event-driven | `domain/components/hook-tool-names.ts` | role-match |
| paired compact payload tests and `tests/domain/components/hook-events.test.ts` | test | event-driven | existing neighboring payload/matcher cases | exact |
| `extensions/pi-claude-marketplace/transaction/rollback.ts` | utility | request-response / transform | itself (selected ES-4 rule) | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (failed ledger path) | service | transactional request-response | `transaction/rollback.ts` | exact rule |
| `tests/transaction/rollback.test.ts`, `tests/orchestrators/plugin/install.test.ts` | test | transactional | `tests/transaction/rollback.test.ts` | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/{uninstall,update}.ts` | service | request-response | `shared/git-failure-classifiers.ts` and uninstall's errno ladder | role/flow match |
| `tests/orchestrators/plugin/{uninstall,update}.test.ts` | test | request-response | existing typed errno/class cases | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` (cleanup paths) | service | transactional file-I/O | `bridges/agents/stage.ts` plus `shared/errors.ts` | exact composition |
| `extensions/pi-claude-marketplace/domain/components/{hook-tool-names.ts,hooks/matcher.ts}` | utility | transform | `shared/git-failure-classifiers.ts` (`Map`/`Set` membership) | data-flow match |
| paired hook tool/matcher tests | test | transform | their existing real-key and passthrough cases | exact |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/{plan,apply}.ts` | service | CRUD / batch | `domain/source.ts::samePlannedSource` plus current plan diff | role-match |
| paired reconcile plan/apply tests | test | CRUD / batch | existing convergence/source-alias cases | exact |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/{autoupdate,list}.ts` | service | batch / request-response | `orchestrators/plugin/fetch.ts` and `plugin/reinstall.messaging.ts` | exact API |
| owner tests plus `tests/architecture/catalog-uat.test.ts` | test | batch / output | existing exact notification boundary/catalog cases | exact |

All analog paths above were checked against `git ls-files`; no runtime/plugin mirror is named.

## Pattern Assignments

### Multi-directory agent propagation

**Apply to:** `discover-names.ts`, `bridges/agents/types.ts`, `bridges/agents/stage.ts`, and install/update/reinstall caller fields and tests.

**Analog:** `extensions/pi-claude-marketplace/bridges/agents/discover.ts:57-99`

```typescript
export async function discoverPluginAgents(input: {
  pluginName: string;
  agentsDirs: readonly string[];
}): Promise<DiscoverPluginAgentsResult> {
  const { pluginName, agentsDirs } = input;
  const seenByGenerated = new Map<string, DiscoveredAgent>();
  const warnings: string[] = [];

  for (const agentsDir of agentsDirs) {
    // ...sorted discovery...
    if (seenByGenerated.has(generatedName)) {
      warnings.push(duplicateWarning(sourceName, agentsDir, generatedName));
      continue;
    }
  }
}
```

Copy the ordered-array contract upstream. Replace, rather than retain beside it, the singular `agentsSourceDir`. Do not add a second merge/dedup layer: the bridge owns deterministic first-wins behavior and warning text.

**Current asymmetry to remove:** `orchestrators/plugin/discover-names.ts:54-64`

```typescript
const agentsSourceDir = pickAgentsSourceDir(resolved);
const agentsDiscovery =
  agentsSourceDir === null
    ? { discovered: [] as readonly { readonly generatedName: string }[] }
    : await discoverPluginAgents({ pluginName: plugin, agentsDirs: [agentsSourceDir] });
```

Tests must construct declared and conventional directories independently, compare the complete discovered/staged result, and assert that the later duplicate is absent and its existing warning is present.

### Compact trigger translation

**Apply to:** pre/post compact translators, `hook-events.ts`, and their three paired suites.

**Analog:** the symmetric translator shape in `pre-compact.ts:16-37` and `post-compact.ts:12-30`.

```typescript
import type { SessionBeforeCompactEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export function translate(event: SessionBeforeCompactEvent, ctx: TranslationContext): PreCompactStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PreCompact",
    trigger: event.reason === "manual" ? "manual" : "auto",
  };
}
```

Use the same direct mapping in both owners. The architecture contract must admit exactly `manual` and `auto`. Each payload suite needs independent `manual`, `threshold`, and `overflow` cases; replace stale constant-auto comments and fixtures.

### Rollback ownership

**Apply to:** `transaction/rollback.ts`, install's failed-ledger branch, and direct plus live integration tests.

**Canonical analog/rule:** `transaction/rollback.ts:59-74`

```typescript
export function formatRollbackError(
  result: RunPhasesResult,
  originalError: Error,
): RollbackErrorResult {
  if (originalError instanceof PathContainmentError) {
    return { error: originalError, rollbackPartials: [] };
  }
  if (result.rollbackPartials.length === 0) {
    return { error: originalError, rollbackPartials: [] };
  }
  return {
    error: new Error(originalError.message, { cause: originalError }),
    rollbackPartials: result.rollbackPartials,
  };
}
```

Install currently captures `result.rollbackPartials` and throws `result.error` directly at `install.ts:1252-1270`. Replace that duplicate interpretation with one call to `formatRollbackError`, store its returned partials, and throw its returned error.

**Test style:** `tests/transaction/rollback.test.ts:13-32,92-119` compares the whole result, then verifies error identity/cause and the original partial-array identity. Mirror this in the live install test; a helper-only proof is insufficient.

### Typed failure classification

**Apply to:** uninstall cascade and confirmed update sibling-sweep/malformed-input branches only.

**Analog 1:** `orchestrators/plugin/uninstall.ts:168-192`

```typescript
if (cause instanceof AgentsUnstageFailureError) return "source mismatch";
if (isErrnoException(cause)) {
  switch (cause.code) {
    case "EACCES":
    case "EPERM": return "permission denied";
    case "ENOENT": return "source missing";
  }
}
return "unreadable";
```

**Analog 2:** `shared/git-failure-classifiers.ts:18-49,70-87` uses closed `Map`/`Set` tables and stable `code`/HTTP status signals. Add explicit `StateLockHeldError -> "lock held"`; use local classes, discriminants, or stable codes for confirmed update cases. Remove the authorized message-substring branches at `update.ts:674-685` and `update.ts:2896-2922`; preserve each owner's honest generic fallback.

Regression inputs must keep the same typed signal while changing the human-readable message, then assert the same exact reason.

### Structured update cleanup

**Apply to:** update prepare/abort/commit/rollback failure paths and `update.test.ts`.

**Analog 1:** `bridges/agents/stage.ts:325-361,392-417,426-433` returns `string | undefined` descriptors, preserves the primary error through a cause chain, and treats successful cleanup as no warning.

**Analog 2:** `shared/errors.ts:359-370`

```typescript
export interface Phase3Failure {
  readonly phase: "skills" | "commands" | "agents" | "hooks" | "mcp";
  readonly msg: string;
  readonly cause: unknown;
}

export class PluginUpdatePhase3Error extends Error {
  readonly failures: readonly Phase3Failure[];
}
```

Collect every commands/skills descriptor currently dropped at `update.ts:1393-1415` and `2099-2103`. Extend this readonly production-owned record or add a narrow sibling; keep the original operation error as identity or `cause`. Freeze accumulated rows. Render only at notification boundaries.

Tests must assert the primary error, exact structured cleanup rows, and exact filesystem absence. A deliberately failed cleanup asserts its residual descriptor and remaining artifact.

### Safe open-string lookup and trace correction

**Apply to:** `hook-tool-names.ts`, `hooks/matcher.ts`, and only a terminal-ledger-authorized dead branch.

**Analog:** `shared/git-failure-classifiers.ts:18-49` uses `Map.get` and `Set.has`, never inherited object membership.

Current unsafe reads are `hook-tool-names.ts:132-134` and `hooks/matcher.ts:44-58`. Use a `Map` or own-key guard before indexing. Preserve custom Pi tool passthrough, real Claude-key translation, regex handling, and trust-boundary filesystem/path guards. Add `constructor` and `toString` cases.

Before removing a branch, record its production-producer trace in the plan/task and delete only the artificial paired case. Do not use casts, prototype mutation, ignore pragmas, mutable discriminators, or test-only exports.

### Reconcile alias source claims

**Apply to:** `reconcile/plan.ts`, `apply.ts` only if outcome threading requires it, and their paired tests.

**Current flow to evolve:** `plan.ts:118-170` iterates recorded marketplaces, returns the first source match, and stores only its recorded name in `sourceClaimed`.

Use a readonly one-to-one declared-key to canonical recorded-name claim map. Gather all eligible same-source candidates before deciding: exactly one succeeds; zero or multiple fail closed. Preserve the manifest-derived recorded name as state identity and use that canonical marketplace identity for action lookup.

The regression must author distinct declared and manifest names independently, assert the exact plan and apply outcome, then apply again and assert no operation and no network call.

### Structural notification cardinality

**Apply to:** marketplace `autoupdate.ts`, `list.ts`, owner suites, and catalog UAT.

**Analog API:** `shared/notify-context.ts:193-216` requires the caller to pass `cardinality: "single" | "plural"`. Existing callers such as `orchestrators/plugin/fetch.ts:194` and `plugin/reinstall.messaging.ts:199` choose it from command shape before rendering.

Pass `single` for named autoupdate; pass `plural` for bare autoupdate and list, including zero and one row. Do not derive it from `rows.length`. Update exact owner output and catalog fixtures together for named-single, bare-zero, bare-one, and bare-many.

## Shared Patterns

### Error semantics stay separate from rendering

Typed classes/codes/discriminants determine a closed reason. Structured readonly rows cross bridge/orchestrator boundaries. `shared/notify.ts` and `notify-context.ts` alone render final bytes. Never parse a rendered cleanup or diagnostic string to recover control flow.

### Direct owner regression

Each changed production module keeps its mirrored `tests/.../*.test.ts` regression. Use `node:test` and `node:assert/strict`; compare whole public results/state before interaction verification. For filesystem behavior, create a case-owned temporary tree and inspect final bytes/paths. Errors are asserted by class, identity/cause, and structured fields—not message substrings.

### Verification

Run each changed owner suite directly, then its direct-pair coverage command. After shared contracts or architecture fixtures change, run `npm run test:coverage:direct -- :all` and the full `npm run check` gate.

## No Analog Found

None. Every authorized correction has a current tracked production seam and a paired owner suite. Planner should not create a Phase 3 umbrella module or revive a historical-only claim.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{bridges,domain,orchestrators,shared,transaction}` and mirrored `tests/`
**Tracked production/test files in scope scanned:** 552 repository entries, narrowed by CodeGraph and the terminal ledger inventory
**Strong analogs retained:** 5 pattern families (ordered discovery, typed classifiers, rollback result, structured cleanup, caller-owned notification cardinality)
**Pattern extraction date:** 2026-09-06
