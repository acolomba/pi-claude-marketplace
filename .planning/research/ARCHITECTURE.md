# Architecture Research: json-output (Mode-Keyed Presentation Strategies)

**Domain:** Brownfield Pi extension. The work adds a JSON presentation strategy next to the text renderer for `/claude:plugin`, selected by `ctx.mode`.
**Researched:** 2026-09-28
**Confidence:** HIGH for the inventory and the Pi runtime facts. Both were checked with grep and by reading source in the installed `@earendil-works/pi-coding-agent@0.86.1`. MEDIUM for the proposed layout, which is a design recommendation.

Terms used below:

- **Producer**: an orchestrator or edge handler that builds a `NotificationMessage`.
- **Report**: the new resolved, serializable presentation model. It is also the typebox wire schema.
- **Strategy**: a pure formatter from Report to one output form (text or JSON).
- **Sink**: the single call that emits output. Today that is `ctx.ui.notify`. After this work it can also be `pi.appendEntry`.

## Standard Architecture

### System Overview (target)

```
 producers (orchestrators/*, edge/handlers/*, bridges/hooks, index.ts, auth-host)
   | build NotificationMessage (unchanged vocabulary, shared/notification-types.ts)
   | + per-command ROW POLICY map (was: per-command RenderFn string map)
   v
 shared/notification-dispatch.ts  -- public notify-family API (thin)
   | resolve(): ONE softDepStatus probe, severity, summary facts, tally counts,
   |            reload flag, {requires ...} markers, cause chains, leaks,
   |            hints, not-added reason        (shared/notification-resolve.ts)
   v
 Report  (typebox Static; schemaVersion)       (shared/notification-model.ts)
   | presentationFor(ctx.mode)  exhaustive     (shared/notification-mode.ts)
   +--------------------------+------------------------------+
   | tui / print              | json / rpc                   | other -> UnsupportedModeError
   v                          v
 text strategy             JSON strategy
 (notification-grammar.ts) (notification-json.ts)
   |                          |
   v                          v
 ctx.ui.notify(text[,sev])  pi.appendEntry("claude-plugin", {schemaVersion,...})
   \______ both calls live ONLY in shared/notification-dispatch.ts ______/
```

`browse` has a third "interactive" capability, but only in `tui`. It is not a strategy over Report. It is a mode gate in `edge/handlers/plugin/browse.ts` that asks the same `presentationFor(mode)` selector (see section 6).

### Component Responsibilities

| Component | Responsibility | New / Modified | Zone |
|-----------|----------------|----------------|------|
| `shared/notification-model.ts` | typebox schemas, `Static` types, `SCHEMA_VERSION`. The Report is the wire schema. | NEW | shared |
| `shared/notification-resolve.ts` | Turns `NotificationMessage` plus row policy plus probe into a Report. Owns every presentation decision. | NEW (absorbs the computation half of `notification-summary.ts` and the derivations in grammar) | shared |
| `shared/notification-mode.ts` | Exhaustive `switch (mode)` that returns `{ strategy: "text" \| "json"; interactive: boolean }`. Unknown mode throws `UnsupportedModeError`. | NEW | shared |
| `shared/notification-json.ts` | JSON strategy. Makes a deep plain-data copy of the Report and adds `schemaVersion`. | NEW | shared |
| `shared/notification-grammar.ts` | Text strategy. Formats a Report into `{ text, severity? }`. It takes no probe and walks no `Error` objects. | MODIFIED (big) | shared |
| `shared/notification-summary.ts` | Returns structured facts (counts, subject, reload) and no longer returns phrases. The phrases move to grammar. It can also be folded into resolve. | MODIFIED | shared |
| `shared/notification-dispatch.ts` | Stays the SOLE sink module. `present(ctx, host, report)` makes exactly one `ctx.ui.notify` or `host.appendEntry` call. The public notify functions become resolvers. | MODIFIED | shared |
| `shared/notify-context.ts` | `CommandContext.render` (a string map) becomes a total map of row policies (data). `RenderFn` and `dispatchRow` string fallback are deleted. | MODIFIED | shared |
| `platform/pi-api.ts` | Adds `ExtensionMode = ExtensionContext["mode"]` (the package root does not export `ExtensionMode`), adds `NotificationContext.mode`, and adds `EntrySink` / `PresentationHost`. | MODIFIED | platform |
| `shared/errors.ts` | Adds `UnsupportedModeError`. Adds the browse-outside-tui error, either as a typed error or as a Report kind (see section 6). | MODIFIED | shared |
| `domain/github-auth.ts` | Replaces the raw `NotifyFn` string callback with a structured device-code callback. | MODIFIED | domain |
| 16 `orchestrators/**/*.messaging.ts` | Render arms (strings) become row policies (data). | MODIFIED | orchestrators |
| `edge/handlers/plugin/browse.ts` | Replaces the list fallback at `:140` with the D6 typed error. | MODIFIED | edge |

All new modules go in `shared/`. That zone already matches `extensions/pi-claude-marketplace/shared/**` and may import `platform` (`.fallowrc.json` rule `shared -> [platform]`). typebox is already a runtime dependency. **So `.fallowrc.json` needs no change.** A new top-level folder such as `presentation/` would need a new zone, allow-list edges, the ESLint `import-x/no-restricted-paths` zone, and updates to `tests/architecture/import-boundaries.test.ts`. The reason is `boundaries.coverage.requireAllFiles: true`. Do not create one.

## 1. Output-surface inventory (complete)

**Search method.** Re-run this to check the numbers:

```
rg -n "\b(notify|notifyWithContext|notifyUpdateWithContext|notifyUpdateNoOpWithContext|notifyReconcileAppliedWithContext|notifyUsageError|notifyUsageInfo|notifyDiagnostic|makeRawNotifyFn|notifyAsyncRewakeSummary|notifyStopHookOverrideCap|renderReinstallPartitionAndNotify)\(" extensions/pi-claude-marketplace -g '*.ts' \
 | rg -v "export function " | rg -v '^\S+:[0-9]+:\s*(//|\*|/\*)' \
 | rg -v "shared/notification-dispatch.ts|shared/notify-context.ts|platform/pi-api.ts"
```

I also checked that `rg -n "\.notify\(" extensions/` finds no direct `ctx.ui.notify` outside `notification-dispatch.ts`. The only other `ctx.ui.*` uses are `addAutocompleteProvider` (`edge/register.ts:149`, `edge/skill-aliases.ts:78`) and `ctx.ui.custom` (`edge/handlers/plugin/browse.ts:178`). None of these is output.

**Totals: 119 call sites in 45 production files.** Two more files define the family: `notification-dispatch.ts` has 9 internal `ctx.ui.notify` calls and `notify-context.ts` has 4 emit calls. That makes **47 production files**, which matches the estimate of about 50.

| Function | Call sites | Files | Kind |
|----------|-----------:|------:|------|
| `notifyWithContext` | 44 | 18 | structured cascade (per-command render map) |
| `notifyUsageError` | 40 | 18 | raw string |
| `notify` | 20 | 12 | structured (legacy central switch + standalone kinds) |
| `notifyDiagnostic` | 3 | 3 | raw string (header + lines) |
| `makeRawNotifyFn` | 3 | 2 | raw callback |
| `notifyUpdateNoOpWithContext` | 2 | 2 | structured |
| `notifyUsageInfo` | 2 | 1 | raw string |
| `notifyUpdateWithContext` | 1 | 1 | structured |
| `notifyReconcileAppliedWithContext` | 1 | 1 | structured |
| `notifyAsyncRewakeSummary` | 1 | 1 | raw string |
| `notifyStopHookOverrideCap` | 1 | 1 | raw string |
| `renderReinstallPartitionAndNotify` (wraps `notifyWithContext`) | 1 | 1 | structured |

### By layer and file (line:function)

**entry (1 file, 2)**
- `index.ts` 128:`makeRawNotifyFn` ("reconcile aborted: ..."). 149:`makeRawNotifyFn` ("plugin PATH not refreshed ..."). Both run inside `resources_discover` and are wrapped in NFR-2 try/catch.

**bridges/hooks (2 files, 2)**
- `bridges/hooks/async-rewake/registry.ts` 434:`notifyAsyncRewakeSummary`. It has `ctx: ExtensionContext` and `pi: ExtensionAPI` in scope (`spawnAndRegister`, :187).
- `bridges/hooks/settle.ts` 378:`notifyStopHookOverrideCap`. It has `pi` and `ctx` in scope (`reenterBounded`).

**edge (21 files, 46)**
- `edge/router.ts` 192, 207, 237, 246: `notifyUsageError`. **The router has no `pi`.** `routeClaudePlugin(args, handlers, ctx)` is called from `edge/register.ts:131`.
- `edge/handlers/shared.ts` 80: `notifyUsageError` (the flag parser, ctx only).
- `edge/handlers/plugin/shared.ts` 76, 119, 153, 163, 195: `notifyUsageError` (arg-parse helpers, ctx only).
- `edge/handlers/marketplace/shared.ts` 61, 122: `notifyUsageError`.
- `edge/handlers/plugin/help.ts` 18, 23: `notifyUsageInfo`. 27: `notifyUsageError`. **`makeHelpHandler()` takes no `pi`.**
- `edge/handlers/plugin/bootstrap.ts` 41, 46, 52: `notifyUsageError`. 77: `notify` (cascade, marketplace `failed`, no plugins).
- `edge/handlers/plugin/browse.ts` 134: `notifyUsageError`. 159: `notify` (cascade with a `(browse)` failed row, `cause: err as Error`). 172: `notify` (empty cascade, "(no marketplaces)").
- `edge/handlers/plugin/enable-disable.ts` 71: `notify` (cascade failed row).
- `notifyUsageError` only, one or more sites each: `fetch.ts` 53, 60, 68, 100. `import.ts` 35, 43. `info.ts` 44, 53, 62. `install.ts` 70, 82. `list.ts` 54, 62. `pending.ts` 41, 43. `reinstall.ts` 45, 51, 85. `update.ts` 52, 65. `marketplace/autoupdate.ts` 44. `marketplace/list.ts` 34. `marketplace/update.ts` 43.

**orchestrators (21 files, 69)**
- `auth-host.ts` 112: `makeRawNotifyFn`. This is the device-flow prompt. The bound fn goes to `domain/github-auth.ts:436` (`Open <uri> and enter: <code>`).
- `import/execute.ts` 1255: `notifyDiagnostic` (import diagnostics). 1307: `notifyWithContext`.
- `marketplace/add.ts` 507, 657. `list.ts` 106. `remove.ts` 322, 604, 869. `update.ts` 283, 752, 818, 826, 854, 880. All are `notifyWithContext`.
- `marketplace/autoupdate.ts` 250, 574, 640: `notifyWithContext`. 554: `notify` (`marketplace-not-added`).
- `marketplace/info.ts` 168: `notify` (not-added). 191: marketplace-info. 193: marketplace-info-cascade. 201: per-scope failure loop (**several emissions per invocation**).
- `marketplace/shared.ts` 597, 617: `notify` (not-added).
- `plugin/enable-disable.ts` 1173, 1182, 1367, 1380. `fetch.ts` 205. `list-flow.ts` 755, 800. `uninstall.ts` 291, 335, 603, 921. `update-swap.ts` 1234. All are `notifyWithContext`.
- `plugin/info.ts` 2469: `notifyWithContext`. 2521: not-added. 2549: plugin-info. 2593: plugin-info. 2595: plugin-info-cascade. 2610: failure loop (**several emissions**).
- `plugin/install-flow.ts` 459, 526, 1053, 1103: `notifyWithContext`. 1029: `notify` (not-added).
- `plugin/reinstall-flow.ts` 307, 377, 394, 491, 537, 663: `notifyWithContext`. 570: `renderReinstallPartitionAndNotify` (-> `reinstall.messaging.ts:202`).
- `plugin/shared.ts` 1292, 1372: `notify` (not-added). 1347: `notifyWithContext`. 1462: `notifyDiagnostic` (discovery warnings).
- `plugin/update-cascade.ts` 204: `notifyUpdateNoOpWithContext`. 212: `notifyUpdateWithContext`.
- `plugin/update-flow.ts` 251: `notifyUpdateNoOpWithContext`. 659, 766: `notifyWithContext`.
- `reconcile/apply.ts` 860: `notifyReconcileAppliedWithContext`. 978: `notifyDiagnostic` (post-install warnings).
- `reconcile/pending.ts` 264: `notify` (`reconcile-pending-empty`). 318: `notifyWithContext`.

**Not output surfaces (checked and excluded):**
- MCP tool results (`edge/handlers/tools.ts`) go to the LLM, not to the user.
- `hookDebugLog` (`shared/debug-log.ts`) is an env-gated debug channel.
- The IL-3 `console.warn` in `persistence/migrate.ts`.
- `pi.sendMessage` in `async-rewake/registry.ts:461` and `settle.ts:395` is model context. It is not presentation.

Requirements should state these exclusions on purpose so that "total coverage" (D2) has a closed boundary.

### Raw-string surfaces (D2): what each becomes in the Report

| Surface | Today (`notification-dispatch.ts`) | Arity | Report kind (proposed) |
|---------|-------------------------------------|-------|------------------------|
| `notifyUsageError` :112 | `` `${message}\n\n${usage}` ``, "error" | 2 | `usage-error { message, usage }` |
| `notifyUsageInfo` :119 | `usage`, "info" (**explicit**) | 2 | `usage-info { usage }` |
| `notifyDiagnostic` :142 | `` `${header}\n\n${lines}` ``, "warning". Empty is a no-op. | 2 | `diagnostic { topic: "import" \| "discovery" \| "reconcile-post-install", subject?, lines[] }`. The **header English moves from 3 producers into text**. Import diagnostics also carry a `code` (`ImportDiagnosticCode`) worth exposing. |
| `makeRawNotifyFn` :347 | severity optional, so 1 or 2 args | 1\|2 | `device-code { host, verificationUri, userCode }` (auth-host) and `lifecycle-warning { topic: "reconcile-aborted" \| "path-not-refreshed", scope?, detail }` (index.ts) |
| `notifyAsyncRewakeSummary` :167 | summary, "info" (**explicit**). Empty is a no-op. | 2 | `hook-rewake-summary { pluginId, summary }` |
| `notifyStopHookOverrideCap` :200 | fixed text with `8`, "warning" | 2 | `stop-hook-cap { pluginId, cap: 8 }` |

**Arity is part of the byte contract.** The catalog harness records `argumentCount` (`tests/architecture/catalog-uat/mock-pi.ts`). Structured info-severity emissions call `ctx.ui.notify(body)` with **one** argument (`emitWithSummary` :96-100). The raw info surfaces pass `"info"` **explicitly**. The text strategy must keep this per-kind rule. The Report carries `severity: "info"` in both cases, so the rule is a text-formatting rule keyed on kind.

## 2. Per-verb renderers and what each derives at render time

There are **19 `CommandContext` consts across 16 `*.messaging.ts` files, with 64 status arms**. There is also the central `renderPluginRow` switch in `notification-grammar.ts:902` (19 statuses). Legacy `notify()` still uses that switch, and `tests/architecture/catalog-uat` drives it. Every arm is a composition of grammar primitives over `(row, probe, mpScope)`.

What the arms decide, and where each decision goes:

| Derivation | Where it happens today | Absorbed by | Notes |
|------------|------------------------|-------------|-------|
| `{requires pi-subagents / pi-mcp / pi-dynamic-workflows}` markers | `composeReasons(..., declaresX, probe)` (`grammar:500`) -> `softDepMarkers` (`shared/concerns/soft-dep.ts:54`) | **resolve** | Only arms built on `installedLikeRow` / `partiallyInstalledRow` / an explicit `dependencies.includes(...)` include markers. That covers installed, updated, reinstalled, and partially-installed. Every `pluginRow` / `render*Row` arm passes `false,false,false`. The Report row carries the **final** reasons list: content reasons first, then markers in the fixed order agents, mcp, workflows. |
| Content reasons shown or suppressed | per arm | **row policy** | Divergences that must be kept (see the table below). |
| Scope bracket elision | `renderScopeBracket(pScope, mpScope)` (`grammar:456`). Candidate rows (available, remote, unavailable, partially-available) force `undefined`. | **text** | Report keeps the real scope. Elision is lossy formatting. |
| Version display (`hash-`/`sha-` to `#abcdef0`, `v` prefix, `from -> to` arrow) | `renderVersion` :425, `composeVersionArrow` :476 | **text** | JSON carries raw `version` / `from` / `to`. |
| Icon glyph | a literal per arm | **text** | This is a pure function of `status` across all 64 arms plus the central switch (checked). It is one table in text. |
| Status token text, e.g. `(will partially install)` versus `(will install)` | `renderPendingRow` :835, `reconcile.messaging.ts:91` | **text** from the Report field `partial` | |
| Description truncation and wrapping | `truncateDescription` :113, `wrapDescription` :146, `DESCRIPTION_BEARING_STATUS` :1526 | **text** (truncation). **resolve** (which statuses bear a description). | JSON gets the full description. |
| Partial / stale-gate / enable hint trailers | `partialHintTrailerFor` :1591, `ENABLE_HINT_TRAILER` | **resolve** chooses `hints: ("partial-install"\|"partial-update"\|"stale-gate-update"\|"enable")[]`. **text** chooses the English. | |
| Cause chain | `renderIndentedCauseChain` :1069 -> `causeChainTrailer(Error)` (`shared/errors.ts:149`) walks a **live `Error`** at render time | **resolve** gives `cause: { chain: string[], truncated: boolean }` | An `Error` is not JSON-serializable. `CleanupContextError` links render cleanup details (`errors.ts` `linkMessage`). |
| Manual-recovery leaks | `manualRecoveryLeaks(p.cause)` (`errors.ts:598`), an `instanceof ManualRecoveryError` walk at render time | **resolve** gives `leaked: string[]` | |
| Rollback-partial lines | `composeRollbackPartialLines` :1085 (phase causes are live Errors) | **resolve** gives `rollbackPartial: { phase, cause? }[]` with serialized causes | |
| Not-added reason | `notAddedReasonFor` :1398 derives a `Reason` from `presentInOtherScope` + `scope` | **resolve** | |
| Marketplace header marker | `renderMpHeader` :229. A `skipped` header with reason `already autoupdate` renders `<autoupdate>` in place of `(skipped)`. A list header renders `<autoupdate>` from `details`. | **text** (data is already present) | |
| Plugin-info glyph and `(${status})` | `pluginInfoStatusGlyph` :1260, `renderPluginInfo` :1434 | **text** | |
| Hard-coded bodies | `"Pending: next reload will apply 0 actions."` (dispatch :243), `UPDATE_NO_OP_HEADLINE`, `"(no marketplaces)"` | **text**. Report kinds are `reconcile-pending { actions: 0 }` and `update-no-op`, plus an empty cascade. | |

**Per-verb divergences the row policies must keep** (checked arm by arm; each is a text byte difference pinned by an owner test):

| Status | Default (central switch) | Divergent command | Divergence |
|--------|--------------------------|-------------------|------------|
| `partially-installed` | markers ON (`partiallyInstalledRow`) | `plugin list` (`list.messaging.ts:126`) | `pluginRow`, so markers OFF |
| `available`, `remote` | content reasons OFF (`undefined`) | `plugin list` (`list.messaging.ts:115`, `:151`) | reasons ON (`p.reasons`) |
| `uninstalled` | reasons ON (`renderUninstalledRow`) | reconcile-applied (`reconcile.messaging.ts:177`) | reasons OFF (`composeReasons(undefined, ...)`) |
| `will *` | no version, no reasons, no probe | (all) | pending arms ignore `probe` |
| `unavailable` | `renderUnavailableRow` | import (`execute.messaging.ts:97`) | byte-identical duplicate, so no policy needed |

A row policy can therefore be small data, for example `{ markers: boolean; contentReasons: boolean }` per status. It lives in a **total** map per command, which keeps the D-04/D-10 `satisfies CommandContext` exhaustiveness anchor. It does not keep the `(row, probe, mpScope) => string` function.

Per-file arm inventory (status arms per const):
- `plugin/list` 11
- `plugin/install` 6
- `plugin/fetch` 6
- `plugin/update` 5
- `reconcile` PENDING 5 and RECONCILE_APPLIED 5
- `plugin/enable-disable` ENABLE 4 and DISABLE 3
- `plugin/reinstall` 4
- `import/execute` 4
- `marketplace/update` 4
- `plugin/uninstall` 2
- `marketplace/remove` 2
- `marketplace/autoupdate` AUTOUPDATE 1 and NOAUTOUPDATE 1
- `plugin/info` 1
- `marketplace/add` 0 (label only)
- `marketplace/list` 0 (label only)

Tests call these arms directly **70 times in 12 test files** (`rg -n "\.render\.|render\[" tests`). Those calls are the byte locks for the divergences above.

## 3. Render-time state probes

| Probe | Where | Moves to |
|-------|-------|----------|
| `softDepStatus(pi)` (3 `getAllTools()` reads) | `notification-dispatch.ts:280` (`notify`), `:387` (`emitCascadeWith`), `:433` (`emitUpdateNoOpCascade`) | `resolve()`. It is still one probe per emission and runs before strategy selection. |
| `softDepStatus(pi)` for **severity** (a second probe of the same state) | `plugin/install-flow.ts:406`, `plugin/update-cascade.ts:190`, `plugin/enable-disable.ts:1347`, all via `companionSeverity` (`notify-reasons.ts:84`) | Recommended: take the probe **once per command invocation** and pass the same snapshot to severity stamping and to `resolve()`. Today severity and markers read two snapshots that can disagree in principle. |
| `causeChainTrailer` / `manualRecoveryLeaks` over live `Error` | grammar :1069, :1616-1641 | `resolve()` (serialized) |
| `crossScopeFlag` (a filesystem probe) | producers (`install-flow.ts:1029`, `plugin/shared.ts:1372`, `autoupdate.ts:554`, `plugin/info.ts:2505`) | Already upstream. No change. |
| `redactAbsolutePaths` | producers (`reconcile/apply.ts:177,187,811,962`, `backfill.ts:156`, `plugin/shared.ts:1457`) | Already upstream. The JSON strategy inherits it. No redaction may move into text only. |
| `pluginScopeOrFallback`, `pluginVersion` | `edge/browser/plugin-browser.ts` (a browse TUI consumer of producer types) | Out of scope (browse polish). |

Test cost: the strict boundary helper (`tests/edge/notification-boundary.ts`, used by **31** suites) and `catalog-uat/mock-pi.ts` pin `getAllTools().times(3)` per emission. If one probe per invocation is adopted, those counts change. If the probe stays in `resolve()`, they do not.

## 4. Proposed layout and gate impact

### Report shape (sketch, typebox)

```typescript
// shared/notification-model.ts
export const SCHEMA_VERSION = 1;
const PluginRow = Type.Object({
  name: Type.String(), status: PluginStatus, scope: Type.Optional(Scope),
  version: Type.Optional(Type.String()), from: Type.Optional(Type.String()), to: Type.Optional(Type.String()),
  reasons: Type.Array(ReasonLiteral),          // FINAL: content + soft-dep markers
  severity: Severity, needsReload: Type.Boolean(),
  description: Type.Optional(Type.String()),   // full; text truncates
  hints: Type.Array(HintLiteral), partial: Type.Optional(Type.Boolean()),
  cause: Type.Optional(Type.Object({ chain: Type.Array(Type.String()), truncated: Type.Boolean() })),
  leaked: Type.Optional(Type.Array(Type.String())),
  rollbackPartial: Type.Optional(Type.Array(RollbackPhase)),
});
export const Report = Type.Union([CascadeReport, MarketplaceInfoReport, PluginInfoReport,
  InfoCascadeReports, MarketplaceNotAddedReport, ReconcilePendingReport, ReconcileAppliedReport,
  UpdateNoOpReport, UsageErrorReport, UsageInfoReport, DiagnosticReport, DeviceCodeReport,
  LifecycleWarningReport, HookRewakeSummaryReport, StopHookCapReport, UnsupportedModeReport /* browse */]);
// every variant: { kind, severity, summary?: {count, subject: "plugin"|"marketplace"|null},
//                  tally?: {label, operation, failures, warnings, successes | {verb,count}},
//                  reloadHint: boolean, advisories: string[] }
```

Design rules:

1. **Report is the wire schema** (`Static<typeof Report>`), so a type change reaches both strategies (D1).
2. Resolve computes **facts**. Text turns facts into English. The summary phrase, the tally text, and the diagnostic headers are formatting. Counts, subjects, and severity are decisions.
3. Lossy formatting stays in text: truncation, `#sha7`, scope elision, glyphs.
4. Add a machine `operation` id (for example `"plugin.install"`) beside `Messaging.label`. Consumers should not parse English labels.

### Gates and tests that must change (check each one)

| Gate | Why it is hit | Action |
|------|---------------|--------|
| `.fallowrc.json` boundaries | — | **No change** if all new modules stay in `shared/`. |
| `eslint.config.js` BLOCK A/B (`:96-150`) | `ctx.ui.notify` is banned outside `notification-dispatch.ts` | Keep it. **Add** a selector `CallExpression[callee.property.name='appendEntry']` with the same single-file exemption. Plant a violation in a test, following the house rule: "a gate wants a test that plants the violation". |
| `rule-packs/architecture.json` | Bans stdio | Optionally add an `appendEntry` banned-call. The ESLint selector is enough and is name-independent. |
| `tests/architecture/eslint-effective-config.test.ts` | Enumerates exemptions | Extend it for the `appendEntry` sink. |
| **unused-type-member gate** (`npm run lint:type-members`) | A declared member that no runtime code reads **fails** | (a) Land `NotificationContext.mode` **together with** its first reader (the selector). (b) Land `EntrySink.appendEntry` together with the JSON sink. (c) JSON-only Report fields (`operation`, `code`, `leaked` if text does not read it) are unread unless the JSON strategy performs a *recognized* whole-object read. A deep `JSON.parse(JSON.stringify(report))` counts as "JSON serialization" in the gate's read model and also guarantees plain data. Also, `contracts.json` line:col pins move with every edit. |
| `no-test-only-production-surface.test.ts` / fallow dead-code | Temporary compatibility adapters | Any adapter kept "for tests" (for example `render = format ∘ project`) must be removed in the same phase that migrates its 70 test calls. |
| `unit-suite-glob-completeness`, `test:corresponding`, direct coverage at 100% | New `shared/notification-{model,resolve,mode,json}.ts` | Each needs a mirrored `tests/shared/*.test.ts` at 100% line, branch, and function coverage. |
| `catalog-uat/*` (20 fixture modules, drives `notify()` against `docs/output-catalog.md`) | The text byte lock | Keep it green at every step. It is the regression harness. Add `mode` to `mock-pi.ts` `makeCtx`. Later, add a schema-conformance pass: every fixture's Report validates against `Report`. |
| `notify-grammar-invariant`, `notify-will-reload-agreement`, `hooks-cap-notify`, `hooks-async-rewake`, `notify-producer-wire-coverage`, `cross-surface-reason-parity` | Drive the notify family with strict `MockCtx` | Add `mode` expectations. The bytes do not change. |
| `no-credential-leak.test.ts` (`:162-164`, `:230`) | Regex-scans `notifyFn(\`...\`)` in `domain/github-auth.ts` | Retarget it at the new structured device-code callback. Keep AUTH-09: the user code may be surfaced, and the access token must never be. |
| `notify-closed-set-locks`, `messaging-guide-doc-pins` | Pin `notification-types.ts` closed sets and the style-guide claims | Unaffected while `NotificationMessage` stays the producer vocabulary. Update them if the guide gains a Report section. |

## 5. How `mode` and `appendEntry` reach every output site

Facts from Pi 0.86.1 (`dist/core/extensions/types.d.ts`):

- `mode: ExtensionMode` is on **`ExtensionContext`** (:214), and `ExtensionCommandContext` extends it (:255). So the command `ctx`, the lifecycle `ctx`, and the hook `ctx` all have it.
- `appendEntry(customType, data?)` is on **`ExtensionAPI`** (:991), the factory `pi`. It is **not** on any ctx.
- Before binding, `appendEntry` is `notInitialized`, and it throws on a stale extension instance (`loader.js:119, 288-290`, `assertActive`).

Recommended plumbing, driven by types and with the least churn:

1. `platform/pi-api.ts`:
   - `export type ExtensionMode = ExtensionContext["mode"]` (the package root does not re-export it).
   - `NotificationContext { ui; readonly mode: ExtensionMode }`.
   - `EntrySink { appendEntry(customType: string, data?: unknown): void }`.
   - `PresentationHost = ToolInventory & EntrySink`.

   Pi's real `ctx` and `pi` already satisfy these structurally. So the **~70 structured call sites that already pass `(ctx, pi)` need no edits**.
2. The raw-string surfaces take only `ctx` today, so they gain a `host: PresentationHost` parameter. Threading cost:
   - `router.ts` (`routeClaudePlugin`/`routeMarketplace` gain `pi`, passed from `edge/register.ts:131`).
   - `makeHelpHandler(pi)`.
   - The arg-parse helpers in `edge/handlers/shared.ts` and `edge/handlers/{plugin,marketplace}/shared.ts` (about 7 helpers).
   - Other edge handler factories already close over `pi`.
   - Orchestrators: `surfaceDiscoveryWarnings` (`plugin/shared.ts:1445`) and `surfaceImportDiagnostics` (`import/execute.ts:1242`).
   - The auth bags: `buildAuthForHost` / `buildCloneAuth` (`auth-host.ts:97,152`) and their 7 callers (`fetch.ts:387,398`, `install-clone-probe.ts:57`, `reinstall-clone-probe.ts:63`, `info.ts:1627,1640`, `update-preflight.ts:165`, `marketplace/add.ts:785,830`, `marketplace/update.ts:408,459`).
   - Hooks (`registry.ts`, `settle.ts`) and `index.ts` already have `pi`.
3. Rejected alternative: wrapping `ctx` at `register.ts` into a ctx-plus-sink object. Pi's ctx is a runtime object with getters and methods, so spreading it is unsafe, and `browse` needs the real `ctx.ui.custom`.
4. Rejected alternative: a factory-bound presenter injected through `EdgeDeps`. It needs more churn than threading `pi`, because orchestrators already take `pi`.
5. **Naming collision:** orchestrators already use `opts.notifications?.mode === "orchestrated"` (`install-flow.ts:660`, `uninstall.ts:645`, `enable-disable.ts:815`, `add.ts:549`, `remove.ts:711`, `autoupdate.ts:419`). The new concept must **not** be spelled `mode` in orchestrator options. Read it only as `ctx.mode` and call it "presentation" everywhere else.

Lifecycle and hook sites:
- `resources_discover` (`index.ts:81-176`): reconcile-applied cascade, diagnostics, reconcile-aborted, PATH warnings. `ctx.mode` is available. **NFR-2:** `UnsupportedModeError` and `appendEntry` throws must be caught there (hookDebugLog). They must never propagate.
- Hooks: rewake summary and Stop cap already run inside try/catch (`registry.ts:433-437`). `settle.ts:377` has **no try/catch** around `notifyStopHookOverrideCap`. Add one when the sink can throw.
- Device flow: change `NotifyFn` (`domain/github-auth.ts:115`) to `onDeviceCode({ verificationUri, userCode })`. The English moves to text. In json/rpc mode this makes the code **visible for the first time**, because `ctx.ui.notify` is a no-op in json mode. Today a device flow under `--mode json` polls without ever showing the code.

**Critical runtime finding (HIGH, source-verified): startup emissions are not streamed in json or rpc mode.** In both `print-mode.js` (`rebindSession`, about lines 52-88) and `rpc/rpc-mode.js` (:228-270), `session.bindExtensions()` runs first. It awaits `session_start` and then `resources_discover` (`agent-session.js:2009-2031`). Only after that does `session.subscribe(...)` start writing events. So any `appendEntry` made during the **first** `resources_discover` is saved to the session file but never emitted as an `entry_appended` line. That covers the load-time reconcile cascade, PATH warnings, and reconcile-aborted. With `--no-session`, those entries exist only in memory.

A `/reload` inside the session runs after subscription and does stream. In rpc mode, today's `ctx.ui.notify` at startup **is** forwarded (the RPC UI context), so moving rpc to appendEntry **regresses startup visibility in rpc**. Requirements need an explicit decision: accept it and document it, or keep a startup-only fallback. D3/D4 are locked, so this is a documentation or acceptance item, not a re-litigation.

## 6. Browse interactive strategy boundary

- Today `browse.ts:140` does `if (ctx.mode !== "tui") { await handlers.list("", ctx); return; }`.
- Target (D6): `presentationFor(ctx.mode).interactive === false` emits a **Report** (`kind: "unsupported-in-mode"` or a typed error mapped to a usage-error-shaped Report) that names `/claude:plugin list`, at `error` severity. It goes through the normal strategy:
  - JSON in json/rpc mode, where it is visible.
  - Text in print mode, where Pi discards it (D5).

  Prefer emitting a Report over throwing. A thrown error in print/json becomes `Extension error (...)` on stderr (`print-mode.js` `onError`), and in rpc it becomes an `extension_error` event. That path bypasses the schema.
- The picker (`ctx.ui.custom`, `edge/browser/plugin-browser.ts`) stays **outside** the Report. It is an interactive component that consumes producer types (`PluginNotificationMessage`) and is out of scope (browse polish).
- The two `notify()` calls in browse (`:159`, `:172`) run only in tui after the gate. They use the text strategy through the normal path.
- One selector module owns the mode switch for both the output strategy and the interactive capability. Keep `ctx.mode` comparisons out of edge handlers. `browse.ts` currently has the only one (`:140`).

## 7. Data flow changes

### Before
```
producer -> NotificationMessage [+ render map of (row, probe, mpScope)=>string]
  -> notify*/notifyWithContext(ctx, pi, ...) -> softDepStatus(pi) (render-time)
  -> grammar (strings; walks Error causes) + summary (severity/phrases/tally/reload)
  -> ctx.ui.notify(string[, severity])          [no-op in print/json]
```
### After
```
producer -> NotificationMessage [+ row-policy map]  (unchanged vocabulary)
  -> notify*(ctx, host, ...) -> resolve(message, policy, probe) -> Report
  -> presentationFor(ctx.mode):
       text -> grammar.format(Report) -> ctx.ui.notify(text[, sev])   (bytes unchanged)
       json -> json.format(Report)    -> host.appendEntry("claude-plugin", payload)
       other-> UnsupportedModeError (caught at lifecycle/hook boundaries; NFR-2)
```

Several emissions per invocation stay possible:
- the `info` failure loops
- import cascade plus diagnostics
- install plus discovery warnings
- the reconcile cascade plus post-install warnings

In JSON each one becomes a separate `entry_appended`. **Gap:** there is no correlation id today. Consider an `invocation` or `origin: "command" | "reload" | "hook"` field so consumers can group entries and tell command replies apart from lifecycle output.

## Suggested build order

Each step keeps `npm run check` green and leaves the text bytes unchanged. The steps are ordered so that no declared member exists without a reader (the unused-type-member gate) and no temporary adapter outlives its phase (the test-only-surface gate).

1. **Model and resolve behind the text strategy (cascade family).**
   - Add `notification-model.ts` (typebox) and `notification-resolve.ts`.
   - `notify()` / `emitCascadeWith` / `emitUpdateNoOpCascade` resolve first. Grammar formats the Report.
   - Move the probe, markers, cause-chain and leak serialization, hints, not-added reason, severity, summary facts, tally counts, and reload flag into resolve.
   - Keep the `RenderFn` call shape temporarily as `formatRow ∘ projectRow`, so the 70 direct arm calls in 12 test files stay green.
   - Gates: catalog-uat and the owner tests stay unchanged.
   - *Risk: grammar is 1655 lines. This step has the largest byte-drift risk.*
2. **Per-command render maps become row policies.**
   - Edit 16 messaging files and `notify-context.ts` (`CommandContext.render` becomes a policy map).
   - Migrate the 70 test calls to assert projections plus text formatting.
   - Delete the adapter, the central `renderPluginRow`, and the `dispatchRow` string fallback.
   - *Largest blast radius in production code and owner tests (about 5.6k lines of messaging tests).*
3. **Raw-string surfaces into the Report (still text only).**
   - Add the usage-error, usage-info, diagnostic (structured topics; the headers move from 3 producers into text), device-code (structured domain callback; retarget `no-credential-leak`), lifecycle-warning (index.ts), rewake, and stop-cap kinds.
   - Every public function routes through one `present()`.
   - Pins: `hooks-cap-notify` and `hooks-async-rewake` byte pins stay. The arity rule is pinned.
4. **JSON strategy as a pure function.**
   - `notification-json.ts`: Report to payload with `schemaVersion`, using a deep JSON round-trip.
   - Add a unit test and a schema-conformance test over all catalog fixtures.
   - Nothing is wired to a sink yet. The only reader is the strategy function, which production must reach. Wire it in step 5 of the same phase if the dead-code gate objects.
5. **Mode selection, host widening, and sink.**
   - `pi-api.ts` gets `mode`, `EntrySink`, and `PresentationHost`.
   - `notification-mode.ts` exhaustive switch and `UnsupportedModeError`.
   - `present()` selects the strategy and calls `appendEntry("claude-plugin", ...)` for json/rpc.
   - Thread `pi` into the raw surfaces (router, help, parse helpers, auth bags, 2 diagnostic helpers).
   - ESLint `appendEntry` single-site selector with a planted-violation test.
   - NFR-2 catches in `index.ts` and `settle.ts:377`.
   - Fakes carry `mode` (D7): `tests/edge/notification-boundary.ts` (31 suites), `catalog-uat/mock-pi.ts`, `tests/e2e/_helpers.ts:85`, and the other about 59 files that fake `ui.notify` or 50 that fake `getAllTools`.
   - **The 23 `as unknown as ExtensionContext` casts in 9 files hide a missing `mode` from the compiler**, so they fail only at runtime with the new default arm. Grep for them explicitly.
   - Add a JSON capture helper.
   - *Largest blast radius in tests.*
6. **Browse typed error (D6)** through the Report and the `interactive` capability. Delete the list fallback.
7. **Documentation.**
   - JSON schema reference, generated from or checked against the typebox schema.
   - The print-mode limitation (D5) and the startup-emission non-streaming finding.
   - The IL-2 amendment in AGENTS.md "Output channel" (D8).
   - An ADR next to `docs/adr/v2-001-structured-notify.md`.
   - `docs/output-catalog.md` does not change.

Steps 1 and 2 could run in the other order: policies first, and then the model. Policies first would still format strings, so the probe would stay in rendering. The chosen order puts the D1 invariant (no probe in rendering) in the very first phase.

**Largest-blast-radius changes (flag for the roadmap):**
- Step 2: render maps to policies (16 production files, 12 test files, 70 assertions).
- Step 5: test fakes (strict `strong-mock` fakes fail on any unexpected `ctx.mode` read) and `pi` threading (about 50 raw call sites, about 15 signatures).
- Step 1: the grammar refactor under byte lock.

## Anti-Patterns

### Keeping the probe or Error walks in the text strategy "because JSON doesn't need markers"
**Why it is wrong:** It breaks D1. JSON would then lack `{requires ...}` markers that text shows, and the two outputs would disagree. **Instead:** resolve puts the final reasons into the Report, and both strategies format them.

### JSON strategy re-deriving severity or reload from rows
**Why it is wrong:** It creates two computations that can drift. The catalog locks only text. **Instead:** the Report carries `severity` and `reloadHint`. The strategies only read them.

### Reading `ctx.mode` in handlers or orchestrators
**Why it is wrong:** The switch is no longer exhaustive in one place, and the name collides with `notifications.mode`. **Instead:** only `notification-mode.ts` switches on mode. `browse` asks it for `interactive`.

### Leaving `Error` objects in the Report
**Why it is wrong:** `appendEntry` data is JSON-serialized by Pi, and an Error becomes `{}`. **Instead:** resolve serializes cause chains and leaks. The deep JSON round-trip in the strategy catches regressions.

### A new top-level `presentation/` folder
**Why it is wrong:** `requireAllFiles` forces a new fallow zone, ESLint zone changes, and boundary-test amendments for no gain. **Instead:** put the modules in `shared/`.

## Integration Points

### External (Pi runtime, 0.86.1)

| Service | Integration | Notes |
|---------|-------------|-------|
| `ctx.ui.notify` | text sink | No-op in print/json (`runner.js:114-118` `noOpUIContext`). Forwarded in rpc today. |
| `pi.appendEntry(customType, data)` | JSON sink | `agent-session.js:2131-2136`: `appendCustomEntry` then `_emit({type:"entry_appended", entry})`. Serialized by `print-mode.js:84-86` and `rpc-mode.js:265-266`. Not in LLM context. **Not streamed during the first `resources_discover`.** Throws before bind or when stale. |
| `ctx.mode` | selector input | `ExtensionContext.mode: "tui"\|"rpc"\|"json"\|"print"` (`types.d.ts:209-214`). |
| Command handler throws | fallback | print/json: `console.error("Extension error ...")`. rpc: `extension_error` event. No schema. |

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| orchestrators -> shared/notify-context | `notifyWithContext(ctx, pi, context, rows, kind, cardinality)` | Signature stable. `context` becomes a policy map. |
| edge -> shared/notification-dispatch | `notifyUsageError(ctx, host, msg)` | Gains `host`. |
| domain/github-auth -> orchestrators/auth-host | structured device-code callback | Replaces the raw string. AUTH-09 gate is retargeted. |
| edge/browse -> shared/notification-mode | `presentationFor(ctx.mode).interactive` | The single mode switch. |
| shared -> platform | `pi-api.ts` types and `softDepStatus` | Already allowed. |

## Sources

- Codebase at `features/json` HEAD `ab3d9c31`. All file:line references were checked with `rg` and `sed` in this worktree.
- `node_modules/@earendil-works/pi-coding-agent@0.86.1`: `dist/core/extensions/types.d.ts` (:209-216, :255, :991), `dist/core/extensions/loader.js` (:110-125, :280-295), `dist/core/extensions/runner.js` (:114-125), `dist/core/agent-session.js` (:2009-2036, :2131-2136), `dist/modes/print-mode.js` (:15-130), `dist/modes/rpc/rpc-mode.js` (:225-275).
- `.fallowrc.json`, `eslint.config.js` (:96-150), `rule-packs/architecture.json`, `docs/unused-type-member-gate.md`, `tests/edge/notification-boundary.ts`, `tests/architecture/catalog-uat/mock-pi.ts`, `tests/architecture/no-credential-leak.test.ts`.

---
*Architecture research for: json-output (mode-keyed presentation strategies)*
*Researched: 2026-09-28*
