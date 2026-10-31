# Phase 2: Row Policies - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 43 planned source and test owners
**Analogs found:** 43 / 43

## File Classification

| New/modified files | Role | Data flow | Closest tracked analog | Match |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/shared/notify-context.ts` | model, utility | request-response | itself | exact |
| `extensions/pi-claude-marketplace/shared/notification-resolve.ts` | service | transform | itself | exact |
| `extensions/pi-claude-marketplace/shared/notification-grammar.ts` | utility | transform | itself | exact |
| `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` | service | request-response | itself | exact |
| `extensions/pi-claude-marketplace/shared/notification-types.ts` | model | request-response | itself | exact |
| `extensions/pi-claude-marketplace/shared/notification-summary.ts` | utility | transform | itself | exact |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts` | service | file-I/O, request-response | itself | exact |
| `extensions/pi-claude-marketplace/orchestrators/{import,marketplace,plugin,reconcile}/*.messaging.ts` (15 modules, 18 contexts; exact names in RESEARCH.md §Current production census) | service | request-response | `orchestrators/plugin/list.messaging.ts`, `orchestrators/reconcile/reconcile.messaging.ts` | exact |
| `tests/shared/{notify-context,notification-resolve,notification-grammar,notification-dispatch,notification-summary}.test.ts` | test | transform, request-response | corresponding current owner tests | exact |
| `tests/orchestrators/{import,marketplace,plugin,reconcile}/*.messaging.test.ts` (12 direct-render owners, plus shape-only owners) | test | request-response | corresponding current owner tests | exact |
| `tests/orchestrators/reconcile/pending.test.ts` | test | file-I/O, request-response | itself | exact |
| `tests/architecture/{soft-dep-marker-policy,workflows-marker-coverage}.test.ts` | test | batch | itself | exact |
| `tests/architecture/catalog-uat/fixtures/plugin-pending.ts` | config, test | request-response | itself | exact |

The grouped test rows are an owner map, not an exhaustive filename prediction. Use RESEARCH.md §Direct render-call migration census for the exact 12-file list and include shape-only tests that compile against changed contexts. All analog paths above were checked with `git ls-files`; no install mirror is named.

## Pattern Assignments

### Shared contract and resolver

**`notify-context.ts`**: retain the existing `as const satisfies CommandContext<...>` declaration convention. The current mapped contract at lines 70-75 is `readonly render: { [K in Status]: RenderFn<Extract<Msg, { status: K }>> }; readonly markers: Readonly<Record<Status, boolean>>;`. Replace those members with one total row-policy map while preserving the wrapper's producer constraint `Msg extends PluginNotificationMessage & { status: Status }` (lines 137-145) and its widening to `MarketplaceNotificationMessage[]` (lines 156-160). The old fallback sentence at lines 354-365 is the byte contract for missing policy: `${"name" in row ? row.name : "?"} (failed) {internal: no render arm for "${row.status}"}`.

**`notification-resolve.ts`**: copy the exhaustive central table form at lines 301-321: `as const satisfies Record<PluginNotificationMessage["status"], boolean>`. Replace the boolean values with complete policy data. In `resolveRows` (lines 371-391), policy selection precedes `resolveRow`; the current reason order at lines 397-409 is `...content` followed by `softDepMarkers(agents, mcp, workflows, snapshot)`. Preserve the missing-arm severity floor before resolution and distinguish a present `{markers:false, contentReasons:false}` entry from a missing key. Keep the frozen-input catch behavior in `floorMissingArmSeverity` (lines 422-431).

**`notification-types.ts`**: the two existing advisory carriers are `CascadeNotificationMessage` (lines 607-623) and `ReconcilePendingEmptyMessage` (lines 730-741). Add a specific readonly retained-workflow fact collection to each. Keep their existing `advisories?: readonly string[]` because marketplace add still sends text advisories. Fact shape comes from tracked `orchestrators/plugin/workflows-staging-gc.ts` lines 215-229: `{ readonly name: string; readonly envelopeCount?: number }`.

### Text and dispatch

**`notification-grammar.ts`**: central `renderPluginRow` at lines 860-949 gives the current exhaustive status layout. For example, installed joins `[ICON_INSTALLED, p.name, renderScopeBracket(p.scope, mpScope), renderVersion(p.version), "(installed)", composeReasons(p.reasons)]` (lines 870-879); updated uses `composeVersionArrow(p.from, p.to)` (lines 883-893). Copy the helper calls and token order into a total formatter-owned layout table. Preserve status-specific carve-outs such as available/remote reason suppression (lines 904-920) and pending partial-install token (lines 639-654). This is the central notification renderer; `edge/handlers/tools.ts:194` has a separate tool renderer.

**`notification-dispatch.ts`**: `emitCascadeWith` (lines 387-408) currently runs `resolveRows`, then `resolveEnvelope`, then `composeContextBlocks`, `foldAdvisories`, and `emitWithSummary`. Preserve that order and the public wrapper's notification severity/argument behavior while passing policies and the shared row formatter. Pending facts should be formatted before `foldAdvisories` in both cascade and pending-empty paths (the latter is at lines 249-253 and 356-367).

**`notification-summary.ts`**: `composeRetainedWorkflowsAdvisories` at lines 408-417 is already the single text owner. It maps each `{name, envelopeCount?}` to `    retained workflow staging: ${tree.name}${envelopes} under the workflows staging directory`; `undefined` count gives no parenthetical, while zero remains observable. Reuse this function from dispatch.

**`orchestrators/reconcile/pending.ts`**: `retainedWorkflowsAdvisories` at lines 153-158 scans once and omits the field when empty; `pendingEmptyMessage` at lines 165-169 conditionally spreads the field. Keep the same scan and omission pattern, passing facts instead of composing strings. The scanner itself owns filesystem observation.

### Command maps and owner tests

**All 15 messaging modules**: copy the complete status-key declaration structure from `orchestrators/plugin/list.messaging.ts:100-165` and `orchestrators/reconcile/reconcile.messaging.ts:60-210`, replacing each callback and marker map with explicit data entries. `plugin/list.messaging.ts:101-123` demonstrates the meaningful list divergence: available calls `renderAvailableRow(..., p.reasons)` and partially-installed uses its own status while list markers remain off. `reconcile/reconcile.messaging.ts:176-184` demonstrates applied uninstall's suppressed reasons; its pending rows choose `(will partially install)` when `p.partial === true` (lines 86-104). Preserve all 18 context declarations, including empty maps over `never`.

**Owner tests**: follow existing full-message assertions in `tests/orchestrators/plugin/enable-disable.messaging.test.ts:36-64` and `tests/orchestrators/plugin/install.messaging.test.ts:143-160`. Change direct callback calls to the shared formatter path while retaining literal glyph, scope, version, status and reason assertions. `tests/shared/notification-resolve.test.ts:720-755` pins frozen missing-arm input; `tests/shared/notify-context.test.ts:533-625` pins fallback row order and copied facts. The latter and `tests/shared/notification-dispatch.test.ts:5717-5849` contain synthetic callback outputs whose corpus disposition is pending D-07; do not infer a production policy from those strings.

**Architecture and catalog tests**: `tests/architecture/soft-dep-marker-policy.test.ts:78-100` enumerates every context marker map and central policy independently; project the marker field from the new data while keeping the expected literal booleans. `tests/architecture/catalog-uat/fixtures/plugin-pending.ts:10-31,76-90` supplies two retained-workflow fixture messages; replace only the input with `{name, envelopeCount}` facts and keep expected bytes unchanged.

## Shared Patterns

- **No authentication layer:** these are local Pi notifications. All user-visible output reaches `ctx.ui.notify` through the dispatcher; do not add stdout/stderr output.
- **Failure visibility:** `notification-resolve.ts:371-391,422-431` floors a writable missing-policy row's input severity before envelope reduction. A frozen row keeps its old severity. Keep the diagnostic wording from `notify-context.ts:354-365` in text formatting.
- **Reason ordering:** `notification-resolve.ts:397-409` puts content before agents, MCP, workflow markers; do not sort or deduplicate.
- **Text grammar:** `notification-grammar.ts:870-920` owns glyphs, scope elision, raw-version formatting, tokens and braces. Command policy declares semantic inclusion only.
- **Advisory formatting:** `notification-summary.ts:408-417` owns retained-workflow sentence and indentation. The scanner passes observations, including an absent count.
- **Testing:** exact `ctx.ui.notify` payload and argument count remain the owner assertion style; catalog fixtures pin output bytes.

## No Analog Found

None. Every planned owner modifies an existing tracked file with a same-role analog in place.

## Metadata

**Search scope:** shared notification pipeline, 15 orchestrator messaging modules, pending scanner/orchestrator, paired shared/orchestrator/architecture/catalog tests.
**Method:** CodeGraph first, then focused current-source ranges and tracked-source check.
**Synthetic corpus:** 25 callback-derived entries await D-07; this map neither changes nor resolves the baseline.
