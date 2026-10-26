# Phase 29: Apply Command and Read-Only Reload - Pattern Map

**Mapped:** 2026-10-24
**Files analyzed:** 24 (new + modified, grouped where they share one analog)
**Analogs found:** 23 / 24

All paths below are relative to the repo root; `E/` = `extensions/pi-claude-marketplace/`. Every analog is git-tracked source (no mirror paths). CONTEXT.md D-20..D-27 govern; autoupdate (`orchestrators/marketplace/autoupdate.ts`, `marketplace/update.ts`) is out of scope (D-27).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `E/edge/handlers/plugin/apply.ts` (NEW) | controller (edge handler) | request-response | `E/edge/handlers/plugin/pending.ts` (+ deps shape from `import.ts`) | exact |
| `E/edge/router.ts` (MOD) | route | request-response | its own `pending` entries | exact |
| `E/edge/register.ts` (MOD) | config / wiring | request-response | `pending:` / `import:` / `marketplaceUpdate:` entries | exact |
| `E/edge/flag-catalog.ts` (MOD) | config | n/a | `pending: []` entry | exact |
| `E/orchestrators/reconcile/apply.ts` (MOD -> apply command orchestrator, NETWORK_SEAM) | service | batch (per-scope, per-entry soft-fail) | itself: `applyReconcileWithReader` / `applyPlan` / `createApplyReconcile` | exact |
| `E/orchestrators/reconcile/load.ts` (NEW, network-free) | service | batch, read-only | `E/orchestrators/reconcile/pending.ts::pendingReconcile` + kept steps of `apply.ts:1383-1518` | role-match |
| `E/orchestrators/reconcile/read-pass.ts` (NEW, optional extraction) | service | file-I/O (locked read, no save) | `apply.ts::readPassForScope` (192-303) | exact (move) |
| `E/orchestrators/reconcile/convergence.ts` (NEW, network-free planner) | service | transform (offline) | `E/orchestrators/reconcile/backfill.ts` (`maybeBackfillPlugin`, `supportedSetGrew`, `resolveRecordedPluginOffline`) + `orchestrators/plugin/list-candidate-version.ts::resolveListCandidate` | role-match |
| `E/orchestrators/reconcile/pending.ts` (MOD) | service | read-only | itself | exact |
| `E/orchestrators/reconcile/notify.ts` (MOD) | utility (row projection) | transform | its pending projection (`will disable` fold, notify.ts:484-497) | exact |
| `E/orchestrators/reconcile/reconcile.messaging.ts` (MOD) | config (CommandContext) | n/a | `PENDING_CONTEXT` (lines 30-53) | exact |
| `E/orchestrators/reconcile/backfill.ts` (DELETE; move `runScopeIsolated`) | service | batch | — | n/a |
| `E/orchestrators/plugin/update-flow.ts` (MOD: new converge-run entry) | service | request-response (runner) | `createPluginUpdateOperations` / `beginPluginUpdateRun` (1195-1272) | exact |
| `E/orchestrators/plugin/update-preflight.ts` (MOD only if a tag-search knob is added, D-23) | service | request-response | `MaterializationPolicy` (131-150) | exact |
| `E/index.ts` (MOD) | entry / event wiring | event-driven | `prepareResources` (111-152) | exact |
| `E/shared/notification-types.ts`, `notification-wire.ts`, `notification-json.ts`, `notification-grammar.ts`, `notification-resolve.ts`, `notification-summary.ts`, `E/edge/browser/plugin-browser.ts` (MOD: `will update` + marketplace `will add`/`will remove`, apply trailer) | model / closed set | transform | the `"will enable"` member at every site | exact |
| `schema/claude-plugin.schema.json` (REGEN) | config (generated) | n/a | `npm run schema:generate` | exact |
| `E/shared/extension-version.ts` + tests (DELETE, if stamp retired, D-13) | utility | n/a | — | n/a |
| `features/plugin/apply.feature` (NEW) | test (cucumber) | request-response | `features/plugin/pending.feature`, `features/plugin/reconcile.feature` | exact |
| `features/plugin/reconcile.feature`, `pending.feature`, `help.feature`, `usage-errors.feature`, `git-source-update.feature` (MOD) | test | — | themselves | exact |
| `test/edge/handlers/plugin/apply.test.ts` (NEW) | test | — | `test/edge/handlers/plugin/pending.test.ts` | exact |
| `test/orchestrators/reconcile/{load,convergence,read-pass}.test.ts` (NEW) | test | — | `test/orchestrators/reconcile/pending.test.ts`, `backfill.test.ts` | role-match |
| `test/architecture/*` closed-set + catalog-uat enrollments (MOD) | test | — | the `pending` / `will enable` enrollments | exact |
| Marketplace-level pending rows `will add` / `will remove` (D-20) in `notification-types.ts` `MarketplaceStatus` | model | transform | none at marketplace level (plugin `will *` rows are the nearest) | partial / see No Analog |

## Pattern Assignments

### `E/edge/handlers/plugin/apply.ts` (controller, request-response)

**Analog:** `E/edge/handlers/plugin/pending.ts` (whole file, 55 lines). Deps object shape from `E/edge/handlers/plugin/import.ts:18-33`.

**Imports + usage (pending.ts:18-27):**
```typescript
import { pendingReconcile } from "../../../orchestrators/reconcile/pending.ts";
import { notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { parseArgs } from "../../args.ts";
import { rejectUnknownFlag } from "../shared.ts";

import { withParsedArgs } from "./shared.ts";

import type { SubcommandHandler } from "../../router.ts";

const USAGE = "Usage: /claude:plugin pending [--scope user|project]";
```

**Core pattern (pending.ts:34-54):**
```typescript
export function makePendingHandler(): SubcommandHandler {
  return withParsedArgs(parseArgs, USAGE, async (parsed, ctx, run): Promise<void> => {
    if (rejectUnknownFlag(parsed.positional, { ctx, run, usage: USAGE })) {
      return;
    }

    if (parsed.positional.length > 0) {
      notifyUsageError(ctx, run, { message: "Too many arguments.", usage: USAGE });
      return;
    }

    await pendingReconcile({
      ctx,
      run,
      cwd: ctx.cwd,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  });
}
```

**Deps shape to copy (import.ts:18-33)** — apply needs `completionCache`, `gitOps` (marketplace adds, D-20), `hooksRouting`, plus the new converge runner:
```typescript
export interface ImportHandlerDeps {
  readonly completionCache: CompletionCache;
  readonly gitOps: GitOps;
  ...
}
export function makeImportHandler(
  deps: ImportHandlerDeps,
  hooksRouting: InstallHooksRouting,
): SubcommandHandler {
```
Type imports: `GitOps` from `orchestrators/marketplace/shared.ts`, `InstallHooksRouting` from `orchestrators/plugin/install-disable-cascade.ts`, `CompletionCache` from `shared/completion-cache.ts`. Use `withParsedArgs` (pending's form), not import's hand-rolled try/catch.

---

### `E/edge/router.ts` (route)

**Analog:** the `pending` entries in the same file.
- `SubcommandHandlers` interface, line 57-58: `// DIFF-01 SC #2 ...` + `pending: SubcommandHandler;` -> add `apply: SubcommandHandler;`.
- `TOP_LEVEL_SUBCOMMANDS` (lines 79-97), contains `"pending",` — completions import this (`edge/completions/provider.ts:39,73,150-151`), so completions follow automatically.
- `TOP_LEVEL_USAGE` line 140 (the `<bootstrap|install|...|pending|...>` verb list) and line 150 `"  pending [--scope user|project]\n" +` — this is the help text; add `apply` to both.
- Dispatch (lines 256-257):
```typescript
    case "pending":
      return { commandId: "plugin pending", handler: handlers.pending, args: rest };
```
-> `case "apply": return { commandId: "plugin apply", handler: handlers.apply, args: rest };`

Byte-pinned consumers of `TOP_LEVEL_USAGE`: `features/plugin/help.feature`, `features/plugin/usage-errors.feature`, `test/edge/router.test.ts`, `test/edge/register.test.ts`, `test/edge/handlers/plugin/help.test.ts`.

---

### `E/edge/register.ts` (wiring)

**Analog:** handler table at lines 116-140.
```typescript
    pending: makePendingHandler(),
    ...
    import: makeImportHandler(deps, hooksRouting),
    ...
    marketplaceUpdate: makeMarketplaceUpdateHandler({
      completionCache: deps.completionCache,
      gitOps: deps.gitOps,
      beginPluginUpdateRun: deps.beginPluginUpdateRun,
    }),
```
Pass the converge runner through `EdgeDeps` exactly like `beginPluginUpdateRun` (`E/edge/types.ts`; `index.ts:211-219` fills it from `createPluginUpdateOperations`). Update the command description string at register.ts:82 that lists verbs.

---

### `E/edge/flag-catalog.ts` (config)
Add `| "apply"` to `CatalogVerb` (lines 52-75, beside `| "pending"` at 63) and `apply: [],` beside `pending: [],` (line 203). Also the header comment at line 19 listing verbs that hard-reject. Gate: `test/architecture/flag-catalog-drift.test.ts`.

---

### `E/orchestrators/reconcile/apply.ts` (service, batch; stays a NETWORK_SEAM)

**Analog:** itself. Keep the mutating body, drop load-only steps.

**Mutating core to drive from the command (apply.ts:1275-1289):**
```typescript
async function applyPlan(reader, opts, plan, outcomes): Promise<void> {
  await applyPluginUninstalls(opts, plan, outcomes);
  await applyMarketplaceRemoves(opts, plan, outcomes);
  await applyMarketplaceAdds(opts, plan, outcomes);
  await applyPluginInstalls(opts, plan, outcomes);
  const satisfied = await applyDependencyInstalls(opts, plan, outcomes);
  const toggles = satisfied ? await refreshTogglePlan(reader, opts, plan, outcomes) : plan;
  await applyToggleSteps(opts, toggles, outcomes);
  applySourceMismatches(plan, outcomes);
}
```

**Per-scope loop + WR-01 isolation (apply.ts:1383-1430):** scopes `opts.scope === undefined ? ["project", "user"] : [opts.scope]`; read-pass throw coerced into an `invalid-block` outcome (`classifyReadPassThrow`, `redactAbsolutePaths`, `MigrateConfigSaveError` -> config basename). Every awaited per-scope call carries `// eslint-disable-next-line no-await-in-loop -- <reason>`.

**Step order to preserve in apply (1436-1473):** `migrateScopeIsolated` (AMIG-01; per D-22 apply also re-runs the sweep after its installs) -> invalid rows short-circuit -> `applyPlan` -> (replace `applyBackfillForScopeIsolated` with the convergence move step) -> `reportUnreadableDeclarer` -> `reportDelistedPlugins` -> `rebuildScopeRoutingTableIsolated`.

**Emission tail (1476-1518):** `notifyMcpMigration` first; empty outcomes -> return silently today (apply instead must emit its empty advisory, D-08); one cascade notify; then the two sanctioned follow-ups `surfacePostCommitWarnings(opts, outcomes)` and `surfaceMcpConfigNotices(opts, outcomes)`. Today's cascade is `notifyReconcileAppliedWithContext(..., RECONCILE_APPLIED_CONTEXT, buildReconcileAppliedCascade(outcomes))`; note `reconcile-applied-cascade` is excluded from the reload hint in `shared/notification-summary.ts:476-491` (Pitfall 2) — apply must either drop that exclusion or emit a plain `cascade` via `notifyWithContext` with an `APPLY_CONTEXT`.

**Factory form (1526-1534):**
```typescript
export function createApplyReconcile(
  reader: ReconcileStateReader,
): (opts: ApplyReconcileOptions) => Promise<void> {
  return async function applyReconcile(opts: ApplyReconcileOptions): Promise<void> {
    await applyReconcileWithReader(reader, opts);
  };
}
```
Lock rule: NO outer `withLockedStateTransaction` around apply (proper-lockfile not re-entrant; contract comment apply.ts:18-23). Each driven orchestrator locks itself.

---

### `E/orchestrators/reconcile/load.ts` (service, read-only; NOT a NETWORK_SEAM)

**Analog:** `pending.ts::pendingReconcile` for plan + emission; `apply.ts` kept steps for the per-scope loop.

**Index wiring today (index.ts:111-130)** — `load.ts` replaces the `applyReconcile` call with the same option bag and the same abort catch:
```typescript
    const run = openNotificationRun(pi, { kind: "load" });
    ...
    try {
      await applyReconcile({ ctx, run, cwd: event.cwd, hooksRouting, completionCache, reason: event.reason });
    } catch (err) {
      try {
        notifyReconcileAborted(ctx, run, err);
      } catch (notifyErr) {
        hookDebugLog(`reconcile-abort notify failed: ${errorMessage(notifyErr)}`, "env");
      }
    }
```
Keep `hydrateProjectScopeForCwd` before it and `recomputePluginPath` after it unchanged (index.ts:117-150).

**Kept-at-load steps (D-04, D-22):** read pass (MIG-01), `migrateScopeIsolated` + `notifyMcpMigration`, `reportUnreadableDeclarer`, `reportDelistedPlugins`, `rebuildScopeRoutingTableIsolated`. Must not name `gitOps`/`DEFAULT_GIT_OPS`/`platform/git` (BLOCK F, `eslint.config.js:44-100`).

**Emission:** shared composer with pending (D-05/D-06): `notifyWithContext(ctx, run, PENDING_CONTEXT, marketplaces, undefined, "plural", retained)` (pending.ts:397-405) plus the apply trailer; matching state -> no notify (RECON-05).

---

### `E/orchestrators/reconcile/pending.ts` (service, read-only)

**Analog:** itself. Plan loop (pending.ts:239-322):
```typescript
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];
  ...
    plans.push(planReconcile(mergedViewForPlanning(outcome, state), state, scope));
```
Changes: compute the LOAD-01 verdict (`buildScopeSatisfactionVerdict`, offline; today pending passes none — PENDING-VERDICT-01, notify.ts:406-420), include marketplace add/remove (D-20, today dropped at notify.ts:436-440), call the convergence planner, extract the plan+compose step into one function shared with `load.ts` and `apply.ts`.

**Empty case (pending.ts:338-342):**
```typescript
  if (invalidBlocks.length === 0 && isReconcilePlanListEmpty(plans)) {
    notify(opts.ctx, opts.run, { kind: "reconcile-pending-empty", ...retained });
    return;
  }
```
Frozen line at `shared/notification-grammar.ts:880`: `return "Pending: next reload will apply 0 actions.";` -> reword to name apply (D-14).

---

### `E/orchestrators/reconcile/reconcile.messaging.ts` (CommandContext)

**Analog (lines 30-53):**
```typescript
type PendingStatus = "will install" | "will uninstall" | "will enable" | "will disable" | "failed";

export const PENDING_CONTEXT = {
  Messaging: { label: "Reconcile pending" },
  rowPolicies: {
    "will install": { markers: false, contentReasons: false },
    ...
    failed: { markers: false, contentReasons: true },
  },
} as const satisfies CommandContext<PendingStatus>;
```
Add `"will update"`, plus `"skipped"` / `"partially-upgradable"` for D-12 blocked rows (`contentReasons: true`). New `APPLY_CONTEXT` with the same `satisfies CommandContext<ApplyStatus>` shape, label e.g. `"Apply"`; its status set = today's applied set + `updated` + the blocked statuses.

---

### `E/orchestrators/reconcile/convergence.ts` (offline planner)

**Analogs:**
- Population/growth/consent: `backfill.ts` — `isRecordedButDisabled` filter (backfill.ts:317), RECON-04 dedupe (254-259, 321-325), WCONV-01 refusal (404-419), `resolveRecordedPluginOffline` (539), `supportedSetGrew` (571-578).
- Candidate: `orchestrators/plugin/list-candidate-version.ts::resolveListCandidate` (45-82); `list-installed-row.ts:79-95` for the version compare.
- Same-revision test: `update-preflight.ts::isRecordedCandidate` (376-389, module-private; export or replicate).
- Range block: `update-constraint-gate.ts::buildScopeDeclarationDetail` (465-480), `intersectDependencyRanges`, `admitResolvedVersion` (521-543, exported, pure).
- Blocked row shape (copy, restamping `severity: "warning"` and the D-24 hint), `update-cascade.ts:60-94`:
```typescript
  if (outcome.partialUpgradable === true) {
    return {
      status: "partially-upgradable",
      name: outcome.name,
      scope: target.scope,
      ...version,
      reasons: outcome.reasons,
      partialHint: true,
      severity: cardinality === "single" ? "warning" : "info",
      needsReload: false,
    };
  }
  const cause = constraintCauseFor(outcome);
  return { status: "skipped", ..., severity: cascadeSkipSeverity(outcome.reasons, cardinality), needsReload: false, ...(cause !== undefined && { cause }) };
```
Must be network-free and must not live in `planReconcile` (purity gate `test/architecture/reconcile-planner-purity.test.ts`).

---

### `E/orchestrators/plugin/update-flow.ts` — converge-run entry (D-26)

**Analog (update-flow.ts:1195-1272):**
```typescript
const UPDATE_MATERIALIZATION: MaterializationPolicy = {
  refreshSource: true,
  skipSameRevision: true,
  overwrite: false,
};

async function runPluginUpdate(args: ThreePhaseArgs): Promise<UpdateRunOutcome> {
  await refuseOtherLayerUpdate(args);
  return materializeLatestVersion(args, UPDATE_MATERIALIZATION);
}
...
  const beginPluginUpdateRun = (): PluginUpdateFn => {
    const constraintTagMemo = new Map<string, readonly RemoteTag[]>();
    const constraintMarketplaceTagMemo = new Map<string, readonly ReleaseTagCandidate[]>();
    return (plugin, marketplace, scope) =>
      updateSinglePluginWith(bindings, run, plugin, marketplace, scope, {
        tagMemo: constraintTagMemo,
        marketplaceTagMemo: constraintMarketplaceTagMemo,
      });
  };

  return { updatePlugins, beginPluginUpdateRun };
```
New sibling policy `refreshSource: false, skipSameRevision: true, overwrite: false`; take `cwd` explicitly (`updateSinglePluginWith` uses `process.cwd()` at update-flow.ts:643) and `partial` from the caller (only for `installable: false` records). D-23: tag search off — gate stage one skips when `options.auth.notification` is unset (update-constraint-gate.ts:394-396); `materializeLatestVersion` sets `notification` only when `!args.cascade` (materialize-latest.ts:60-64), so a cascade-mode call already skips the remote tag list, but `probePathStageOne` (419-446) still reads local marketplace tags — a knob is needed to fully disable it. Add the entry to `PluginUpdateOperations` interface (doc block ~1185).

`MaterializationPolicy` lives in `update-preflight.ts:131-150` (three readonly booleans with doc comments); a fourth knob follows that exact doc-comment style.

---

### Closed-set sites for `will update` (and marketplace `will add`/`will remove`)

Copy the `"will enable"` member at each site:
- `shared/notification-types.ts`: `StatusToken` 325, `PluginStatus` 350, message interface 698-702 (`PluginWillEnableMessage { readonly status: "will enable"; readonly name: string; readonly scope?: Scope; }` — `will update` adds `version` + `toVersion` like `updated`), union 729, `SCOPE_BEARING_LIST_STATUS` 757, `pluginVersion` switch 820.
- `shared/notification-wire.ts:38-58` `PLUGIN_STATUSES` (`"will enable": true,` ... `satisfies Record<PluginStatus, true>`).
- `shared/notification-json.ts` `wireScope` 591, `wireVersion` 641.
- `shared/notification-grammar.ts` `PLUGIN_ROW_LAYOUT` 436 (`"will enable": { icon: ICON_INSTALLED, scope: true, version: "none" }` — `will update` wants the `from → to` version layout of `updated`), `DESCRIPTION_BEARING_STATUS` 1034.
- `shared/notification-resolve.ts:339` `CENTRAL_ROW_POLICY`.
- `edge/browser/plugin-browser.ts` switches at 136, 170, 207.
- Tests: `test/architecture/compat-01-no-expansion.test.ts` (318-366), `notify-closed-set-locks.test.ts` (122-170), `notify-will-reload-agreement.test.ts`, `soft-dep-marker-policy.test.ts` (242, 277); regenerate `schema/claude-plugin.schema.json`; docs `output-catalog.md` (status table line 136, count line 45), `json-output.md:839`, `messaging-style-guide.md:61`.

Apply trailer: parallel the `needsReload` path — `RELOAD_HINT_TRAILER` (`notification-grammar.ts:1161`), `formatEnvelopeArguments` (1225-1236), `shouldEmitReloadHint` (`notification-summary.ts:461-515`).

---

### `features/plugin/apply.feature` (cucumber)

**Analog:** `features/plugin/pending.feature` Background (lines 1-14) and `reconcile.feature:14-33`:
```gherkin
  Scenario: A new session installs a plugin that a config declares by hand and reports it
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user starts a new pi session
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | false                     |
      | tally label         | Reconcile                 |
      ...
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
```
Moved scenarios: swap `When the user starts a new pi session` for `When the user runs "/claude:plugin apply --scope project"`, keep the row assertions, update kind/label/`needs reload: true`. Every field must be stated (`namesLike`, `features/lib/field-rows.ts`). Request-log steps only in git-source features (`git-source-update.feature`). Catalog-uat: add `["/claude:plugin apply", "plugin apply"]` beside `test/architecture/catalog-uat/catalog-wire.test.ts:130` and to `catalog-contract.test.ts:38`.

## Shared Patterns

### Output (IL-2)
**Source:** `shared/notification-dispatch.ts` (`notify`, `notifyUsageError`), `shared/notify-context.ts` (`notifyWithContext`). **Apply to:** handler, load, pending, apply. One cascade notify per command; the only extra emits are `notifyMcpMigration` before and `surfacePostCommitWarnings` / `surfaceMcpConfigNotices` after (apply.ts:1478, 1512, 1517).

### Per-scope fault isolation
**Source:** `backfill.ts:145-161` `runScopeIsolated` (move to apply.ts or a reconcile leaf when backfill.ts is deleted; `apply.ts:112` imports it; `test/architecture/gate-targets.ts:136-137` names backfill.ts):
```typescript
export async function runScopeIsolated(scope: Scope, outcomes: PerEntryOutcome[], op: () => Promise<void>): Promise<void> {
  try {
    await op();
  } catch (err) {
    outcomes.push({
      kind: "invalid-block",
      scope,
      basename: "state.json",
      reason: classifyReadPassThrow(err),
      cause: new Error(redactAbsolutePaths(errorMessage(err))),
    });
  }
}
```

### Scope selection and ordering
`opts.scope === undefined ? ["project", "user"] : [opts.scope]` (pending.ts:242, apply.ts:1387); rows sorted with `compareByNameThenScope` (MSG-GR-3).

### Network boundary
New `load.ts`, `convergence.ts`, `read-pass.ts` must not import `platform/git` or name `gitOps`/`DEFAULT_GIT_OPS`/`refreshGitHubClone` (BLOCK F). `apply.ts` and `reconcile/types.ts` stay in `NETWORK_SEAMS`.

### Disabled check
Use `isRecordedButDisabled` (persistence/state-io.ts), never `!record.enabled` (`test/architecture/disabled-state-classification.test.ts`).

## No Analog Found

| File / item | Role | Data Flow | Reason |
|---|---|---|---|
| Marketplace-level pending rows `will add` / `will remove` (D-20) | model (closed set) | transform | No pending-tense marketplace status exists; pending drops `marketplacesToAdd` today (notify.ts:436-440). Model on the plugin `will *` members and the `MarketplaceStatus` union in `shared/notification-types.ts`. |

## Metadata

**Analog search scope:** `E/edge/{router,register,flag-catalog}.ts`, `E/edge/handlers/plugin/{pending,import}.ts`, `E/orchestrators/reconcile/{apply,pending,backfill,reconcile.messaging}.ts`, `E/orchestrators/plugin/{update-flow,update-preflight,update-cascade,materialize-latest}.ts`, `E/index.ts`, `E/shared/notification-{types,wire,json,grammar,resolve}.ts`, `E/edge/browser/plugin-browser.ts`, `features/plugin/{pending,reconcile}.feature`, `test/architecture/catalog-uat/*`
**Files scanned:** ~22
**Pattern extraction date:** 2026-10-24
