# Phase 20: Migration Wave 3 -- Edge Handlers & UsageError - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 22 (15 production + 6 tests + 1 lint config; including barrel)
**Analogs found:** 22 / 22

Phase 20 mirrors the Phase 19 plan structure (mechanical sweep + cascade
migration + drop + lint narrowing) but on disjoint surfaces. Three of the
four patterns are direct in-tree analogs of already-merged Phase 19 work:

- Plan 20-01 (usage-error sweep) -- structurally novel (no cascade), but
  every site is byte-identical V1 vs V2. Analog: the single sanctioned
  Phase 18 callsite at `edge/handlers/marketplace/list.ts:36` (already
  V2-style with structured payload at the wrapper boundary, but the
  payload IS still V1 3-arg because the wrapper itself emits byte-equal
  output -- see Pattern (a)).
- Plan 20-02 (import/execute.ts cascade) -- direct mirror of Phase 19
  Plan 19-04 (reinstall.ts cascade). Same `cascadeSummary` retirement,
  same V1 dispatch ternary removal, same inline `MarketplaceNotificationMessage`
  construction, same single `notify(opts.ctx, opts.pi, message)` call,
  same per-marketplace pivot.
- Plan 20-03 (DROP catch-alls) -- novel pattern (no Phase 18 / 19
  precedent for outer try/catch removal). Closest analog: D-19-01's DROP
  precedent for V1 surfaces with no V2 representation, applied here to
  defense-in-depth wrappers around already-V2 orchestrators.
- Plan 20-04 (lint narrowing) -- direct mirror of Phase 19 Plan 19-06.
  Same `eslint.config.js` array, same additive 1-string extension.

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/edge/router.ts` | router (usage-error emission) | request-response argv routing | self (existing V1 sites) | role-match -- 4 mechanical signature swaps |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` | edge helper (usage-error emission) | request-response argv validation | `edge/handlers/marketplace/list.ts` | role-match -- 3 mechanical signature swaps |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts` | edge handler (usage-error emission) | request-response single-shot | `edge/handlers/marketplace/list.ts` | exact -- 1 mechanical signature swap |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts` | edge handler (usage-error emission) | request-response single-shot | `edge/handlers/marketplace/list.ts` | exact -- 1 mechanical signature swap |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts` | edge handler (usage-error emission) | request-response single-shot | self (canonical V2-style wrapper boundary) | exact -- 1 mechanical signature swap |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts` | edge handler (usage-error emission) | request-response single-shot | `edge/handlers/marketplace/list.ts` | exact -- 1 mechanical signature swap |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts` | edge handler (usage-error emission) | request-response single-shot | `edge/handlers/marketplace/list.ts` | exact -- 1 mechanical signature swap |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` | edge handler (usage-error emission) | request-response single-shot | `edge/handlers/marketplace/list.ts` | role-match -- 3 mechanical signature swaps |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` | edge handler (usage-error emission) | request-response single-shot | `edge/handlers/marketplace/list.ts` | role-match -- 3 mechanical signature swaps |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` | edge handler (usage-error emission) | request-response single-shot | `edge/handlers/marketplace/list.ts` | role-match -- 3 mechanical signature swaps |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` | edge handler (usage-error emission) | request-response single-shot | `edge/handlers/marketplace/list.ts` | role-match -- 4 mechanical signature swaps |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` | edge handler (usage-error + catch-all DROP) | request-response single-shot | `edge/handlers/marketplace/list.ts` (sweep) + bootstrap.ts (DROP twin) | role-match -- 2 mechanical swaps + 1 catch-all DROP + 2 import-line cleanups |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` | edge handler (usage-error + catch-all DROP) | request-response single-shot | `edge/handlers/marketplace/list.ts` (sweep) + import.ts (DROP twin) | role-match -- 3 mechanical swaps + 1 catch-all DROP + 2 import-line cleanups |
| `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` | orchestrator (cascade migration) | request-response cascade (multi-marketplace) | `orchestrators/plugin/reinstall.ts` (Phase 19 Plan 19-04) | role-match -- larger pivot, more outcome variants, same recipe |
| `extensions/pi-claude-marketplace/orchestrators/import/index.ts` | barrel export | static module re-export | `orchestrators/plugin/index.ts` (Phase 19 -- `formatClaudeReinstallSummary` re-export retirement precedent if any) | role-match -- 1-line export deletion |
| `tests/edge/router.test.ts` + `tests/edge/handlers/{marketplace,plugin}/*.test.ts` | test (byte-exact V2 assertion -- INVARIANT) | unit-test request-response | `tests/orchestrators/marketplace/add.test.ts` (`makeCtx()` pattern) | exact -- assertion targets BYTE-IDENTICAL (V1 ≡ V2) |
| `tests/orchestrators/import/execute.test.ts` | test (byte-exact V2 cascade rewrite) | unit-test cascade | `tests/orchestrators/plugin/reinstall.test.ts` (Phase 19 Plan 19-04) | role-match -- larger surface, same rewrite shape |
| `tests/edge/handlers/import.test.ts` | test (DELETE 1 catch-all test) | unit-test request-response | Phase 19 dropped-warning test deletions per D-19-01 | role-match -- 1 test outright DELETE |
| `tests/edge/handlers/plugin/bootstrap.test.ts` | test (NO change) | unit-test request-response | N/A -- no catch-all exercise exists | N/A -- nothing to delete (per RESEARCH finding) |
| `eslint.config.js` | config (lint narrowing -- additive `ignores` entry) | static config | `eslint.config.js` lines 160 (Phase 19 Plan 19-06 entry) | exact -- same array, 1 path string added |

## Pattern Assignments

### (a) Plan 20-01 -- Mechanical `notifyUsageError` Signature Sweep (30 sites × 13 files)

**Applies to:** all 13 production files in Plan 20-01 plus their tests.
**Analog source:** `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts` (canonical
3-arg shape) + the dual-overload renderer at
`extensions/pi-claude-marketplace/shared/notify.ts:127-156` (byte-equality
contract).

#### Recipe (per-site mechanical swap)

**Current V1 shape** (representative -- `edge/handlers/marketplace/list.ts:33-38`):

```typescript
const parsed = parseCommandArgs(
  args,
  {
    positional: [] as const,
    usage: USAGE,
  },
  (message) => {
    notifyUsageError(ctx, message, USAGE);  // <-- V1 3-arg shape
  },
);
```

**Target V2 shape** (Plan 20-01 -- inline object construction per D-19-07
inheritance; helper extraction OPTIONAL per CONTEXT line 149):

```typescript
const parsed = parseCommandArgs(
  args,
  {
    positional: [] as const,
    usage: USAGE,
  },
  (message) => {
    notifyUsageError(ctx, { message, usage: USAGE });  // <-- V2 1-arg structured
  },
);
```

**Renderer byte-equality contract** (the technical justification for D-20-04
+ D-20-06 byte-identical tests):

```typescript
// extensions/pi-claude-marketplace/shared/notify.ts:127-150
/** V1 3-arg overload signature (Phase 21 deletes). */
export function notifyUsageError(ctx: ExtensionContext, message: string, usageBlock: string): void;
/** V2 structured usage-error entry point (SNM-13, D-16-02). Coexists with V1 3-arg notifyUsageError. */
export function notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void;
export function notifyUsageError(
  ctx: ExtensionContext,
  message: string | UsageErrorMessage,
  usageBlock?: string,
): void {
  if (typeof message === "string") {
    // V1 3-arg path
    ctx.ui.notify(`${message}\n\n${usageBlock ?? ""}`, "error");
  } else {
    // V2 structured path -- destructure UsageErrorMessage and emit the
    // same on-the-wire shape (`${message}\n\n${usage}` with "error"
    // severity), byte-equal to V1.
    ctx.ui.notify(`${message.message}\n\n${message.usage}`, "error");
  }
}
```

**Direct-call shape variant** (e.g., `edge/handlers/plugin/bootstrap.ts:38`):

```typescript
// V1 (current)
notifyUsageError(ctx, errorMessage(err), USAGE);

// V2 (Plan 20-01)
notifyUsageError(ctx, { message: errorMessage(err), usage: USAGE });
```

**Multi-argument shape** (e.g., `edge/handlers/plugin/bootstrap.ts:48-54`):

```typescript
// V1 (current)
notifyUsageError(
  ctx,
  "bootstrap does not accept --scope; it always targets user scope.",
  USAGE,
);

// V2 (Plan 20-01)
notifyUsageError(
  ctx,
  {
    message: "bootstrap does not accept --scope; it always targets user scope.",
    usage: USAGE,
  },
);
```

#### Per-file site map (lines from 20-RESEARCH.md, verified 2026-05-27)

| File | Site lines | Imports diff |
|------|------------|--------------|
| `edge/router.ts` | 125, 148, 161, 181 | none -- `notifyUsageError` already imported (line 27) |
| `edge/handlers/plugin/shared.ts` | 58, 85, 95 | none -- imported (line 9) |
| `edge/handlers/marketplace/add.ts` | 43 | none -- imported (line 18) |
| `edge/handlers/marketplace/autoupdate.ts` | 38 | none -- imported (line 14) |
| `edge/handlers/marketplace/list.ts` | 36 | none -- imported (line 18) |
| `edge/handlers/marketplace/remove.ts` | 36 | none -- imported (line 18) |
| `edge/handlers/marketplace/update.ts` | 40 | none -- imported (line 18) |
| `edge/handlers/plugin/install.ts` | 52, 65, 75 | none -- imported (line 27) |
| `edge/handlers/plugin/update.ts` | 36, 48, 61 | none -- imported (line 17) |
| `edge/handlers/plugin/list.ts` | 40, 57, 65 | none -- imported (line 16) |
| `edge/handlers/plugin/reinstall.ts` | 34, 44, 52, 86 | none -- imported (line 15) |
| `edge/handlers/plugin/import.ts` | 31, 36 | KEEP mixed `notifyError, notifyUsageError` import (line 7); Plan 20-03 drops `notifyError` |
| `edge/handlers/plugin/bootstrap.ts` | 38, 43, 49 | KEEP mixed `notifyError, notifyUsageError` import (line 21); Plan 20-03 drops `notifyError` |

#### Test discipline (D-20-06)

Tests stay BYTE-IDENTICAL. The `makeCtx()` pattern in every existing test
file records `{ message, severity }` tuples; the V1 and V2 renderer emit
the same `${message}\n\n${usage}` string at `"error"` severity. No
assertion changes; only the source-side signature changes.

**Existing assertion shape (KEEP verbatim across all 13 test files):**

```typescript
// tests/edge/handlers/import.test.ts:100-109 (representative)
test("import handler rejects invalid --scope value with usage error", async () => {
  const { ctx, notifications } = makeCtx();
  const { handler, calls } = makeHandler();

  await handler("--scope bad", ctx);

  assert.deepEqual(calls, []);
  assert.equal(notifications[0]?.severity, "error");
  assert.match(notifications[0]?.message ?? "", /Usage:/);
});
```

This assertion form continues to pass against the V2 signature with NO
edits because the wire byte form is unchanged.

---

### (b) Plan 20-02 -- `orchestrators/import/execute.ts` Cascade Migration (Phase 19 Plan 19-04 Analog)

**Applies to:** `orchestrators/import/execute.ts`, `orchestrators/import/index.ts`, and
`tests/orchestrators/import/execute.test.ts`.
**Analog source:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
(Phase 19 Plan 19-04 -- bulk-cascade orchestrator with composer retirement;
already-merged on `gsd/v1.3-replan-catalog`). Also see Plan 19-05 (update.ts)
for the version-arrow / dispatch ternary precedent.

#### Imports diff

**Current V1 imports** (`execute.ts:10-15`):

```typescript
import { softDepStatus } from "../../platform/pi-api.ts";
import { cascadeSummary } from "../../presentation/cascade-summary.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { compareByNameThenScope } from "../../presentation/sort.ts";
import { ConcurrentInstallError, errorMessage, PluginShapeError } from "../../shared/errors.ts";
import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";
```

**Target V2 imports** (Plan 20-02 mirror of Phase 19 reinstall.ts diff):

```typescript
// DROP softDepStatus (renderer probes per D-16-14; orchestrator declares dependencies)
// DROP cascadeSummary (D-19-02 strict mirror -- inline construction)
// DROP appendReloadHint, reloadHint (renderer computes per D-16-12)
// KEEP compareByNameThenScope (orchestrator owns iteration order per D-16-06;
//   sort MOVES into the payload-construction loop)
// DROP errorMessage from this import (becomes unused after line-1001 DROP --
//   ConcurrentInstallError + PluginShapeError stay; the latter two are still
//   used by dispatchFailedOutcome at line 921+)
import { ConcurrentInstallError, PluginShapeError } from "../../shared/errors.ts";
// REPLACE V1 wrappers with single V2 notify entry point + per-variant types
import { notify } from "../../shared/notify.ts";
import type {
  NotificationMessage,
  MarketplaceNotificationMessage,
  PluginNotificationMessage,
  PluginInstalledMessage,
  PluginSkippedMessage,
  PluginFailedMessage,
  PluginUnavailableMessage,
} from "../../shared/notify.ts";
```

#### Current V1 emission sites (to retire)

**Line 1000-1003 catastrophic-error path** (`execute.ts:1000-1003`):

```typescript
} catch (err) {
  notifyError(opts.ctx, `Import failed: ${errorMessage(err)}`, err);
  return result;
}
```

**Line 1012-1019 final-dispatch ternary** (`execute.ts:1012-1019`):

```typescript
const probe = softDepStatus(opts.pi);
const { body, severity } = composeImportSummary(result, probe);
const hint = reloadHint(
  result.installedPlugins.filter((o) => o.resourcesChanged).map((o) => o.plugin),
);
const finalBody = appendReloadHint(body, hint);
const dispatch = severity === "warning" ? notifyWarning : notifySuccess;
dispatch(opts.ctx, finalBody);
```

**Lines 350-360 `formatClaudeImportSummary` exported test helper** (`execute.ts:350-359`):

```typescript
export function formatClaudeImportSummary(
  result: ClaudeImportExecutionResult,
  probe: SoftDepProbe = DEFAULT_PROBE,
): string {
  const { body } = composeImportSummary(result, probe);
  const hint = reloadHint(
    result.installedPlugins.filter((o) => o.resourcesChanged).map((o) => o.plugin),
  );
  return appendReloadHint(body, hint);
}
```

**Lines 366-436 `composeImportSummary` private helper** (`execute.ts:366-436`): the
pivot-by-marketplace + outcome → cascade-row + severity-aggregation engine.
RETIRED entirely per D-19-02 strict mirror; its iteration loops move
into `executeImport`'s body.

#### Target V2 shape (Plan 20-02 -- mirrors Phase 19 reinstall.ts cascade recipe)

```typescript
// AFTER (Plan 20-02 final dispatch -- the outer try/catch at 979-1003
// is REMOVED; the line-1001 catastrophic-error notifyError is DROPPED;
// truly catastrophic throws bubble to Pi runtime per D-20-03 extension)
export async function importClaudeSettings(
  opts: ImportClaudeSettingsOptions,
): Promise<ClaudeImportExecutionResult> {
  const result = emptyResult();
  const loadSettings = settingsLoader(opts.deps);
  const settingsResults = await Promise.all(
    opts.selectedScopes.map(async (scope) => ({
      scope,
      loaded: await loadSettings(scope, { cwd: opts.cwd }),
    })),
  );
  for (const loaded of settingsResults) {
    result.diagnostics.push(...loaded.loaded.diagnostics);
  }
  const plan = buildClaudeImportPlan(
    settingsResults.map((entry) => ({ scope: entry.scope, settings: entry.loaded.settings })),
  );
  result.diagnostics.push(...plan.diagnostics);
  for (const scopePlan of plan.scopes) {
    await executeScopedPlan(opts, result, scopePlan);
  }

  // V2 cascade construction mirrors the Phase 19 Plan 19-04 recipe at
  // orchestrators/plugin/reinstall.ts; execute.ts substitutes the
  // import-cascade variant set (added / updated / failed marketplaces
  // crossed with installed / skipped / failed / unavailable plugins)
  // per D-20-02 + D-19-02 strict mirror.

  // Pivot result.* outcome arrays by (marketplace, scope) in display order
  // (compareByNameThenScope per D-16-06; sort MOVES into this loop).
  const marketplaces: MarketplaceNotificationMessage[] =
    pivotOutcomesByMarketplace(result).sort(compareByNameThenScope);

  notify(opts.ctx, opts.pi, { marketplaces });
  return result;
}
```

#### Cascade-with-mixed-variants pivot pattern (Phase 19 reinstall.ts:182-198 analog)

This is the recipe Plan 20-02 inlines, lifted from Phase 19 Plan 19-04
(reinstall.ts) and adapted for the import outcome set:

```typescript
// Phase 19 reinstall.ts recipe (the structural template Plan 20-02
// mirrors with import-specific outcome → variant mapping):
const marketplaceGroups: Map<string, ReinstallPluginOutcome[]> = new Map();
for (const outcome of orderedOutcomes) {
  const key = `${outcome.marketplace}|${outcome.scope}`;
  const existing = marketplaceGroups.get(key) ?? [];
  existing.push(outcome);
  marketplaceGroups.set(key, existing);
}

const marketplaces: MarketplaceNotificationMessage[] =
  Array.from(marketplaceGroups.entries()).map(([key, outcomes]) => {
    const [marketplaceName, scopeStr] = key.split("|");
    const scope = scopeStr as Scope;
    const plugins: PluginNotificationMessage[] = outcomes.map(
      (o): PluginNotificationMessage => {
        if (o.status === "reinstalled") return { status: "reinstalled", ... };
        if (o.status === "skipped") return { status: "skipped", ... };
        if (o.status === "failed") return { status: "failed", ... };
        if (o.status === "manual recovery") return { status: "manual recovery", ... };
        if (o.status === "unavailable") return { status: "unavailable", ... };
        assertNever(o.status);
      },
    );
    return { name: marketplaceName, scope, plugins };
  });

notify(ctx, pi, { marketplaces });
```

**Plan 20-02 substitution** (per 20-RESEARCH.md V1 → V2 mapping table at
lines 222-241):

| V1 result.* outcome | V2 target | Mapping |
|---------------------|-----------|---------|
| `result.addedMarketplaces` | `MarketplaceNotificationMessage { status: "added" }` | Direct -- one entry per (mp, scope) tuple |
| `result.skippedExistingMarketplaces` | `MarketplaceNotificationMessage { status: "updated" }` | "No-op accepted" partition |
| `result.marketplaceFailures` | `MarketplaceNotificationMessage { status: "failed", plugins: [] }` | `cause` LOST per D-18-02 precedent |
| `result.sourceMismatches` | `MarketplaceNotificationMessage { status: "failed", reasons: ["source mismatch"], plugins: [<failed plugin rows>] }` | Phase 17.1 `reasons?:` field |
| `result.installedPlugins` | `PluginInstalledMessage { name, dependencies }` | Compose `dependencies` from `declaresAgents`/`declaresMcp` |
| `result.skippedExistingPlugins` | `PluginSkippedMessage { name, reasons: ["already installed"] }` | Direct |
| `result.unexpectedPluginFailures` | `PluginFailedMessage { name, reasons: ["not in manifest"], cause: undefined }` | String cause DROPPED |
| `result.warnings.reason === "unavailable"/"uninstallable"` | `PluginUnavailableMessage { name, reasons: ["no longer installable"] }` | Direct |
| `result.warnings.reason === "marketplace-failed"` | DROP entirely | Already signaled by mp.status="failed" |
| `result.warnings.reason === "unmappable-marketplace-source"` | DROP entirely | Advisory; no V2 representation |
| `orphanDiagnosticLines(result)` (settings-read-error etc.) | DROP entirely | No top-level reasons field; D-19-01 precedent |
| `PREAMBLE = "Claude plugin import summary"` line | DROP entirely | V2 catalog has no preamble (HIGH confidence) |
| "Already up to date" notice (`composeImportSummary:384`) | DROP entirely | V2 no-op renders as `(no marketplaces)` |

#### Single-`notify()`-call discipline (Phase 19 lineage)

The orchestrator emits EXACTLY one `notify(opts.ctx, opts.pi, message)` call
per orchestration -- no SECOND notify after the primary. The line-1001
catastrophic-error path is DROPPED (per D-20-03 extended to inner
orchestrator boundary). The pattern mirrors Phase 19 reinstall.ts:

```typescript
// Phase 19 reinstall.ts:543-558 (the single notify call replacing the
// V1 dispatch ternary at the same line):
notify(ctx, pi, {
  marketplaces: [
    {
      name: opts.name,
      scope: resolved.scope,
      status: "failed",
      plugins: [
        ...successfullyUnstaged.map(/* PluginUninstalledMessage rows */),
        ...failedPlugins.map(/* PluginFailedMessage rows */),
      ],
    },
  ],
});
```

#### Test rewrite pattern (Phase 19 Plan 19-04 analog)

**Source helper `formatClaudeImportSummary` consumers** (8 invocations across 5 tests
per 20-RESEARCH.md lines 216-220):

```
tests/orchestrators/import/execute.test.ts:7    -- import statement → REPLACE
tests/orchestrators/import/execute.test.ts:44   -- test("formatClaudeImportSummary reports already up to date for idempotent skips") -- DELETE per Pitfall 4
tests/orchestrators/import/execute.test.ts:72   -- test name uses helper → RENAME
tests/orchestrators/import/execute.test.ts:685  -- test name uses helper → RENAME
tests/orchestrators/import/execute.test.ts:69,96,572,607,642,679,711  -- 7 invocations → REWRITE through makeCtx() + importClaudeSettings()
```

**Current V1 assertion shape (representative):**

```typescript
// V1: helper-based string assertion
import { formatClaudeImportSummary } from "../../../extensions/.../execute.ts";
// ...
const result = await importClaudeSettings({ ... });
const body = formatClaudeImportSummary(result, DEFAULT_PROBE);
assert.equal(body, "Claude plugin import summary\n\n● mp [user] (added)\n  ● plugin (installed)\n\n/reload to pick up changes");
```

**Target V2 assertion shape (Phase 19 reinstall.test.ts mirror):**

```typescript
// V2: byte-exact through real notify() via makeCtx() recording
const { ctx, pi, notifications } = makeCtx();
await importClaudeSettings({ ctx, pi, ... });
assert.equal(notifications.length, 1);
const note = notifications[0];
assert.ok(note);
assert.equal(
  note.message,
  "● mp [user] (added)\n  ● plugin (installed)\n\n/reload to pick up changes",
);
assert.equal(note.severity, undefined);  // info -- D-16-11
```

Notice: the V1 `Claude plugin import summary` preamble is GONE; the byte
form starts directly with the marketplace header. Severity flips from
"warning" / "success" (V1 dispatch) to undefined / "error" / "warning"
(V2 content-derived per D-16-11).

#### `index.ts` barrel re-export drop

**Current V1 shape** (`orchestrators/import/index.ts:2`):

```typescript
export { formatClaudeImportSummary } from "./execute.ts";
```

**Target V2 shape (Plan 20-02):** the line is DELETED entirely. No replacement.
The barrel may remain a no-op or be folded further; planner's discretion.

---

### (c) Plan 20-03 -- Defense-in-Depth Catch-all DROP (Novel Pattern)

**Applies to:** `edge/handlers/plugin/bootstrap.ts`, `edge/handlers/plugin/import.ts`,
and `tests/edge/handlers/import.test.ts:111-123`.

**Analog source:** No exact precedent. Closest in-tree analog: D-19-01's
DROP precedent for V1 surfaces with no V2 representation (Phase 19
applied it to post-success warnings inside try blocks; Plan 20-03
extends it to OUTER try/catch wrappers themselves).

#### Current V1 shape (`bootstrap.ts:57-66`)

```typescript
try {
  await bootstrapClaudePlugin({
    ctx,
    pi,
    cwd: ctx.cwd,
    gitOps: deps.gitOps,
  });
} catch (err) {
  notifyError(ctx, errorMessage(err), err);
}
```

**Imports affected** (`bootstrap.ts:19-21`):

```typescript
import { bootstrapClaudePlugin } from "../../../orchestrators/plugin/bootstrap.ts";
import { errorMessage } from "../../../shared/errors.ts";        // <-- becomes unused
import { notifyError, notifyUsageError } from "../../../shared/notify.ts";
//        ^^^^^^^^^^^^                                              <-- drop notifyError
```

#### Target V2 shape (Plan 20-03)

```typescript
// (no try/catch; truly catastrophic throws bubble to Pi runtime per D-20-03)
await bootstrapClaudePlugin({
  ctx,
  pi,
  cwd: ctx.cwd,
  gitOps: deps.gitOps,
});
```

**Imports after Plan 20-03 (verify no-unused-vars + import-x stay GREEN):**

```typescript
import { bootstrapClaudePlugin } from "../../../orchestrators/plugin/bootstrap.ts";
// errorMessage import DROPPED (only used inside the catch body; removed with it)
import { notifyUsageError } from "../../../shared/notify.ts";
// notifyError DROPPED (only used inside the catch body; removed with it)
```

#### Twin pattern in `import.ts:40-50`

**Current V1 shape:**

```typescript
try {
  await (deps.importClaudeSettings ?? importClaudeSettings)({
    ctx,
    pi,
    cwd: ctx.cwd,
    selectedScopes: parsed.scope === undefined ? ["project", "user"] : [parsed.scope],
    gitOps: deps.gitOps,
  });
} catch (err) {
  notifyError(ctx, `Import encountered an unexpected error: ${errorMessage(err)}`, err);
}
```

**Target V2 shape (Plan 20-03):**

```typescript
await (deps.importClaudeSettings ?? importClaudeSettings)({
  ctx,
  pi,
  cwd: ctx.cwd,
  selectedScopes: parsed.scope === undefined ? ["project", "user"] : [parsed.scope],
  gitOps: deps.gitOps,
});
```

**Import lines affected** (`import.ts:6-7`):

```typescript
import { errorMessage } from "../../../shared/errors.ts";        // <-- becomes unused
import { notifyError, notifyUsageError } from "../../../shared/notify.ts";
//        ^^^^^^^^^^^^                                              <-- drop notifyError
```

#### Test treatment

**`tests/edge/handlers/import.test.ts:111-123`** -- DELETE outright per D-19-01
precedent. The test exercises ONLY the catch-all path:

```typescript
// DELETE this test entirely (lines 111-123):
test("import handler catches unexpected orchestrator throws and surfaces as error", async () => {
  const { ctx, notifications } = makeCtx();
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
  const handler = makeImportHandler(pi, {
    gitOps: {} as GitOps,
    importClaudeSettings: () => Promise.reject(new Error("boom")),
  });

  await handler("", ctx);

  assert.equal(notifications[0]?.severity, "error");
  assert.match(notifications[0]?.message ?? "", /boom/);
});
```

**Path correction (RESEARCH-verified):** the test lives at
`tests/edge/handlers/import.test.ts` (NOT under `tests/edge/handlers/plugin/`).
CONTEXT.md line 243 is slightly off; the source `edge/handlers/plugin/import.ts`
maps to a test at the higher-level path. Verified by direct inspection.

**`tests/edge/handlers/plugin/bootstrap.test.ts`** -- NO change. The
`bootstrap.ts:65` catch-all is not exercised by any test in that file
(verified by grep in 20-RESEARCH.md line 152). Plan 20-03 has zero
test-deletion work in bootstrap.

#### Behavior change (documented per D-20-03)

Pi runtime's outer error boundary now handles truly catastrophic uncaught
throws from these two handlers. In the (rare) defense-in-depth-needed
case, the user sees an uncaught-exception trace instead of a polished
error message. This is BETTER for debugging because the trace shows
where the bug actually lives -- the polished V1 output would mask it.

---

### (d) Plan 20-04 -- MSG-Block 1 Lint Narrowing (Phase 19 Plan 19-06 Analog)

**Applies to:** `eslint.config.js`.
**Analog source:** `eslint.config.js` lines 151-173 (the same file, same array;
the entry shape was inserted by Phase 18 Plan 18-06 and extended by Phase 19
Plan 19-06 -- Plan 20-04 appends one more path string).

#### Current state of MSG-Block 1 (`eslint.config.js:151-173`)

```javascript
{
  // MSG-Block 1 (MSG-SR-1..6): cascade/severity routing -- orchestrators
  // surface. Every notify* call site lives under orchestrators/ (edge/
  // has the separate MSG-SR-7 usage-error variant in Block 2). MSG-GR-3
  // is wired separately below across BOTH surfaces (orchestrators/ and
  // edge/handlers/) since Phase 14.2-fix CR-01 surfaced a user-first
  // iteration literal in `edge/handlers/plugin/import.ts:45` that the
  // orchestrator-only glob missed.
  files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"],
  ignores: [
    "extensions/pi-claude-marketplace/orchestrators/marketplace/**",
    "extensions/pi-claude-marketplace/orchestrators/plugin/**",
  ],
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-sr-1-success-routing": "error",
    "msg/msg-sr-2-warning-routing": "error",
    "msg/msg-sr-3-error-routing": "error",
    "msg/msg-sr-4-cascade-success": "error",
    "msg/msg-sr-5-cascade-warning": "error",
    "msg/msg-sr-6-no-cascade-error": "error",
  },
},
```

#### Plan 20-04 target state (D-20-07 -- additive 1 string)

```javascript
ignores: [
  "extensions/pi-claude-marketplace/orchestrators/marketplace/**",
  "extensions/pi-claude-marketplace/orchestrators/plugin/**",
  "extensions/pi-claude-marketplace/orchestrators/import/**",  // <-- ADD
],
```

After Plan 20-04, Block 1's `files: ["...orchestrators/**/*.ts"]` matches
files entirely covered by `ignores` -- effectively a no-op. Phase 21
deletes the entire block.

#### MSG-Block 1b RETAINED (per IN-06 in-file rationale at `eslint.config.js:185-198`)

```javascript
{
  // MSG-Block 1b (MSG-GR-3): per-scope rendering rule. Promoted out of
  // the meta-assertion bag in Phase 14.2 (D-14-2-08 supersedes D-14-09)
  // as an active AST check ...
  //
  // IN-06: `orchestrators/plugin/**` is NOT ignored here even though the
  // Wave 2 V1->V2 migration retired the severity-named notify wrappers
  // that MSG-Block 1 (routing rules) check for. The project-first
  // iteration discipline enforced by MSG-GR-3 is independent of the
  // V1 wrapper migration -- a new helper in `orchestrators/plugin/`
  // that constructs `["user", "project"]` for its iteration order
  // should still get a lint warning. The ignore list below mirrors
  // MSG-Block 1 (orchestrators/marketplace/**) but does NOT ignore
  // orchestrators/plugin/**.
  files: [
    "extensions/pi-claude-marketplace/orchestrators/**/*.ts",
    "extensions/pi-claude-marketplace/edge/handlers/**/*.ts",
  ],
  ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-gr-3-per-scope": "error",
  },
},
```

**Block 1b's `edge/handlers/**` files entry STAYS** per IN-06 rationale.
MSG-GR-3 iteration discipline is V1-wrapper-INDEPENDENT and continues to
gate `["user", "project"]` literal drift in edge handlers (precedent:
`edge/handlers/plugin/import.ts:45` historical regression). Block 1b's
`ignores: [...]` array is also UNCHANGED -- Plan 20-04 only touches Block 1.

**Phase 19's deferred prediction** that Phase 20 would "remove Block 1b's
`edge/handlers/**` files entry" was OUTDATED relative to IN-06 and is
explicitly REJECTED per D-20-07.

#### Verification commands (SC #3)

```bash
grep -c "orchestrators/import/\*\*" eslint.config.js   # expect 1 (newly added to Block 1)
grep -c "orchestrators/plugin/\*\*" eslint.config.js   # expect 1 (Phase 19 -- unchanged)
grep -c "orchestrators/marketplace/\*\*" eslint.config.js   # expect 2 (Block 1 + Block 1b)
grep -c "edge/handlers/\*\*" eslint.config.js   # expect 1 (Block 1b -- RETAINED per IN-06)
```

---

## Shared Patterns

### Pattern: Renderer-as-spec discipline (D-16-04 inherited via Phases 18/19)

**Source:** all of `shared/notify.ts` -- the V2 grammar IS this file's
rendering behavior.
**Apply to:** every Phase 20 emission (Plan 20-01's V2 1-arg usage-error
construction; Plan 20-02's inline `NotificationMessage` cascade construction).

Edge handlers and the import orchestrator MUST construct typed payloads
that round-trip through `notify()` / `notifyUsageError()` byte-equal to
catalog fixtures. NO orchestrator-level composition of:

- token streams (`●`, `○`, `⊘` markers)
- severity argument (V2 signatures are `notify(ctx, pi, message)` 3-args
  and `notifyUsageError(ctx, message)` 2-args; severity is NEVER a
  caller-passed parameter -- it's computed by the renderer per D-16-11)
- `/reload to pick up changes` trailer (renderer fires per D-16-12)
- `{requires pi-subagents}` soft-dep markers (renderer probes once per
  `notify()` call via `softDepStatus(pi)` per D-16-14)
- cause-chain indentation (renderer handles 4-space below plugin row per
  D-16-08)
- preamble lines (V2 catalog has no `Claude plugin import summary`
  equivalent -- DROPPED per Plan 20-02 mapping table)

### Pattern: Single-`notify()`-call-per-orchestration (D-19-01 inherited; extended by D-20-03)

**Source:** `orchestrators/plugin/reinstall.ts` post-Phase-19 (one
`notify(ctx, pi, ...)` call per arm). Mirrored by Plan 20-02
`executeImport`.
**Apply to:** Plan 20-02 (final dispatch); the line-1001 catastrophic-error
path is DROPPED entirely so no SECOND notify exists. Plan 20-03 catch-all
DROPs also enforce this: with the outer try/catch gone, no defense-in-depth
second notify can fire.

### Pattern: Test discipline -- byte-exact through real notify() via mock ctx (D-19-07 inherited)

**Source:** `tests/orchestrators/plugin/reinstall.test.ts` post-Phase-19
(makeCtx() recording `{ message, severity }` tuples; byte-exact V2 string
assertions). Mirrored by Plan 20-01 / 20-02 / 20-03 tests.
**Apply to:**

- Plan 20-01 tests: assertions BYTE-IDENTICAL (V1 ≡ V2 renderer output);
  NO test edits beyond pulling in the source-side signature change if
  the test itself constructs the V1 call (rare; most tests assert on
  recorded notifications, not on the call form).
- Plan 20-02 tests: assertions REWRITTEN from V1 `formatClaudeImportSummary`
  strings to V2 `notify()`-emitted bytes via mock ctx. ~5-8 tests
  DELETED outright (idempotent-skip "up to date", source-mismatch
  diagnostic splice, loadState-throws orphan diagnostic).
- Plan 20-03 tests: 1 test DELETED outright at
  `tests/edge/handlers/import.test.ts:111-123`. No bootstrap test changes.

### Pattern: Additive lint narrowing (D-19-08 inherited)

**Source:** Phase 19 Plan 19-06 entry in `eslint.config.js:160-163`.
**Apply to:** Plan 20-04 -- single path-string append to MSG-Block 1's
`ignores: [...]` array. Block 1b RETAINED per IN-06. Blocks 2-6 untouched.

### Pattern: Imports cleanup (drop now-orphaned `presentation/*` composers)

**Source:** Phase 19 reinstall.ts diff -- dropped `cascadeSummary`,
`renderManualRecovery`, `causeChainTrailer`, `reloadHint`,
`appendReloadHint`, `softDepStatus` from import block when the V2
migration retired them.
**Apply to:** Plan 20-02 (the LAST orchestrator with a
`presentation/cascade-summary` import).

After Plan 20-02 lands, `presentation/cascade-summary.ts` has ZERO
production importers. Phase 21 deletes the file. Plan 20-02 itself does
NOT touch `presentation/cascade-summary.ts` -- it only removes the
import line from `execute.ts:11`.

### Pattern: Catch-all DROP (novel; D-20-03)

**Source:** No prior phase analog. The closest precedent is D-19-01's
DROP discipline for surfaces with no V2 representation; Plan 20-03
extends it to OUTER `try { ... } catch { notifyError } }` wrappers
around already-V2 orchestrators.
**Apply to:** Plan 20-03 -- `bootstrap.ts:57-66` + `import.ts:40-50`.
Inner orchestrators already emit V2 failed notifications on caught
errors (Phase 18/19 contract). Truly catastrophic throws bubble to Pi
runtime.

## No Analog Found

None. Every Phase 20 surface has either a direct Phase 18/19 analog (most
files) or a closest-precedent decision the planner inherits (Plan 20-03
catch-all DROP via D-19-01 lineage; Plan 20-02 mapping-table edge cases
A1-A6 via D-18-02 mp-level cause-drop precedent).

Two surfaces deserve explicit "novel-recipe" flags for the planner:

1. **Plan 20-02 line-1001 catastrophic-error DROP** -- no prior phase
   dropped an inner-orchestrator outer try/catch. Recommendation in
   20-RESEARCH.md lines 243-301 is DROP per the same logic as Plan 20-03's
   defense-in-depth catch-all DROPs.
2. **Plan 20-02 `ImportWarningOutcome` partial DROP / partial KEEP** --
   the 4 reason variants (`unavailable`, `uninstallable`, `marketplace-failed`,
   `unmappable-marketplace-source`) split between KEEP-as-`PluginUnavailableMessage`
   (first two) and DROP (last two). Per 20-RESEARCH.md V1→V2 mapping table.

## Metadata

**Analog search scope:**

- `extensions/pi-claude-marketplace/edge/handlers/{marketplace,plugin}/*.ts` (13 files)
- `extensions/pi-claude-marketplace/edge/router.ts`, `edge/handlers/plugin/shared.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` (Phase 19 Plan 19-04 cascade analog)
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` (read at lines 1-30, 340-436, 975-1023)
- `extensions/pi-claude-marketplace/shared/notify.ts` (read at lines 120-156 -- renderer byte-equality)
- `eslint.config.js` (read at lines 145-205 -- MSG-Block 1 + 1b)
- `.planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-PATTERNS.md` (full)
- `.planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-{04,05,06}-PLAN.md` (lead-in sections)
- `tests/edge/handlers/import.test.ts` lines 95-123 (catch-all test verbatim)

**Files scanned:** 11 production / config / phase-doc files read; 13 edge
files cross-referenced by line number from 20-RESEARCH.md (not re-read --
RESEARCH already verified every line against commit `666c6d9`).

**Pattern extraction date:** 2026-05-27

**Phase lineage commits referenced:**

- Phase 18 Plan 18-06 (lint narrowing entry) -- structural template for
  Plan 20-04.
- Phase 19 Plan 19-04 (reinstall.ts cascade migration) -- structural
  template for Plan 20-02.
- Phase 19 Plan 19-06 (lint narrowing append) -- direct precedent for
  Plan 20-04.
- Phase 19 Plan 19-01 (uninstall.ts pilot recipe block-comment) -- NOT
  mirrored (D-20-01: Phase 20 has no pilot/recipe block-comment because
  no plan mirrors another's recipe).

**Confidence:**

- Plan 20-01 sweep recipe: HIGH -- verified V1 ≡ V2 byte equivalence at
  `shared/notify.ts:127-150`.
- Plan 20-02 cascade recipe: HIGH for the structure (Phase 19 mirror);
  MEDIUM-HIGH for the 4 discretionary mappings (A1-A6 in RESEARCH).
- Plan 20-03 catch-all DROP: HIGH for both bootstrap.ts and import.ts.
- Plan 20-04 lint narrowing: HIGH -- 1-line additive edit, identical
  shape to Phase 19 Plan 19-06.
