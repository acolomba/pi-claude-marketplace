# Phase 18: Migration Wave 1 -- Marketplace Orchestrator Family - Research

**Researched:** 2026-05-26
**Domain:** v1.4 V2 `notify()` migration, marketplace orchestrator family
**Confidence:** HIGH (all line numbers, callsite counts, test assertions, lint config, and Phase 17.1/17.2 contract verified directly against current source)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-18-01:** DROP the cleanup-leak `notifyWarning` in `remove.ts` entirely (no V2 representation; precedent D-17-09).
- **D-18-02:** DROP the marketplace-level retry-hint suffix in `update.ts` mp-failure path. `MarketplaceNotificationMessage { status: "failed", plugins: [] }` renders as bare `⊘ <mp> [<scope>] (failed)`; `err.retryHint` stays internal.
- **D-18-03:** `remove.ts` cascade cause-chain MOVES from marketplace-level body to per-plugin `PluginFailedMessage.cause`; 4-space indent rendered by `renderPluginRow` per D-16-08.
- **D-18-04:** `autoupdate.ts` migration depends on Phase 17.1 grammar amendments (7-entry `MarketplaceStatus`, optional `reasons?:`). LANDED 2026-05-26 -- verified below.
- **D-18-05:** 5-state autoupdate mapping LOCKED: fresh enable -> `"autoupdate enabled"`; fresh disable -> `"autoupdate disabled"`; idempotent -> `"skipped"` + reasons; not-found -> `"failed"`. Severity ladder: fresh -> info, skipped -> warning, failed -> error. Reload-hint ladder: fresh -> emit, skipped/failed -> suppress.
- **D-18-06:** Per-orchestrator test structure preserved; existing `makeCtx()` pattern records `{ message, severity }` tuples; byte-exact V2 string assertions replace V1; tests stay end-to-end through real `notify()`.
- **D-18-07:** Plan 18-06 narrows ONLY MSG-Block 1 (`msg-sr-1..6`) + MSG-Block 1b (`msg-gr-3`) by ADDING an `ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"]` entry. No other MSG-Blocks touched.
- **D-18-08:** 6 plans (18-01..06): one per orchestrator file (5) + one lint/cleanup plan.
- **D-18-09:** 3 waves -- Wave 1 = 18-01 pilot (`add.ts`); Wave 2 = 18-02..05 parallel; Wave 3 = 18-06 lint + final UAT.

### Claude's Discretion

- Internal ordering within a per-file plan (orchestrator-first vs test-first -- both atomic in one commit).
- `orchestrators/marketplace/shared.ts` stale comment cleanup: per-file plan, plan 18-06, or defer to Phase 21.
- Whether plan 18-01 leaves a NotificationMessage construction recipe comment in source for Wave 2 to mirror.
- Test-helper extraction for `makeCtx()` + `pi: { getAllTools: () => [] }` shared mock.
- Severity-tier assertion form: `assert.equal(note.severity, undefined)` vs `assertSeverity` helper.

### Deferred Ideas (OUT OF SCOPE)

- Phase 19 (plugin orchestrator family).
- Phase 20 (edge handlers + V1 usageError migration).
- Phase 21 (V1 wrapper deletion, MSG-* plugin deletion, composer deletion, bounded `shared/notify.ts` ignores removal).
- V2 grammar amendments to `shared/notify.ts` or `output-catalog.md` (Phase 17 / 17.1 own catalog).
- `presentation/marketplace-list.test.ts` and other composer tests (Phase 21).
- JSON output mode, branded `Version` type, telemetry, i18n -- backlog.

</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 18 closes ZERO requirements directly. It is a pure execution phase contributing to SNM-22 ("All notifySuccess/Warning/Error call sites migrated... V1 severity-named wrappers deleted"), which closes in Phase 21 once all 3 migration waves (18 marketplace, 19 plugin, 20 edge) land and Phase 21 deletes the V1 wrappers.

| ID | Description | Research Support |
|----|-------------|------------------|
| SNM-22 (partial) | All `notifySuccess` / `notifyWarning` / `notifyError` callsites in `orchestrators/marketplace/**/*.ts` migrate to V2 `notify(ctx, pi, NotificationMessage)` | Per-file callsite inventory below confirms 16 V1 callsites total across the 5 orchestrators; all migrate in this phase. |

Plan frontmatter `requirements:` field convention check: Phase 17.2's plans used `requirements: []` (pure-tech-debt). Phase 18's per-file plans should follow the same pattern -- `requirements: []` or explicit `requirements: [SNM-22-partial]` is acceptable; verify project precedent against an existing Phase 17.2 plan's frontmatter at plan-write time.

</phase_requirements>

## Phase Goal Recap

Phase 18 migrates every `notifySuccess` / `notifyWarning` / `notifyError` callsite in the 5 marketplace orchestrators (`add.ts`, `autoupdate.ts`, `list.ts`, `remove.ts`, `update.ts`) from V1 severity-named wrappers to the V2 structured entrypoint `notify(ctx, pi, NotificationMessage)`. It narrows MSG-Block 1 (`msg-sr-1..6`) and MSG-Block 1b (`msg-gr-3`) in `eslint.config.js` to exclude the now-migrated marketplace family. Correctness is proven by per-orchestrator unit tests asserting byte-exact V2 output through real `notify()` (D-18-06) and by the catalog UAT byte-equality gate staying GREEN end-to-end.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| State-change notification (V1 -> V2 migration) | `shared/notify.ts` (renderer) | `orchestrators/marketplace/*` (payload construction) | D-16-04 renderer-as-spec: `notify()` owns ALL string composition; orchestrators only construct typed `NotificationMessage` payloads. |
| Soft-dep probe (`pi-subagents` / `pi-mcp-adapter`) | `shared/notify.ts::softDepStatus(pi)` (single probe per call per D-16-14) | Orchestrators declare `dependencies: readonly Dependency[]` on each row | Orchestrators stop computing soft-dep state; renderer probes at notify time. |
| Severity routing | `shared/notify.ts::computeSeverity` (SNM-14) | -- | Computed from payload contents (failed -> error; skipped/manual-recovery -> warning; otherwise info). |
| Reload-hint trailer | `shared/notify.ts::shouldEmitReloadHint` (SNM-15) | -- | Computed from payload contents (state-changing plugin/mp statuses); orchestrators no longer compose the trailer. |
| Cause-chain composition | `shared/notify.ts::renderPluginRow` 4-space-indent arm (D-16-08) | Per-plugin `PluginFailedMessage.cause` | Marketplace-level cause-chains retired (D-18-02 / D-18-03); per-plugin only. |
| MSG-* lint drift-guard scope | `eslint.config.js` MSG-Block 1 + 1b | -- | Additive `ignores:` array narrows scope per phase; full plugin deletion in Phase 21. |
| Catalog byte-equality verification | `tests/architecture/catalog-uat.test.ts` (33+ fixtures) | Per-orchestrator unit tests (belt-and-braces) | Catalog UAT drives `notify()` end-to-end; per-orchestrator tests catch payload construction bugs. |

## Per-File Callsite Inventory

### `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` (Plan 18-01, Wave 1 pilot)

**V1 callsite count:** 2 (matches CONTEXT D-18-08 / canonical refs section).

| Line | Wrapper | Surrounding code (truncated) | V1 message template |
|------|---------|------------------------------|---------------------|
| 141 | `notifyWarning` | `} catch (err) {\n    notifyWarning(\n      opts.ctx,\n      `Marketplace "${recordedName}" added; completion cache refresh deferred: ${errorMessage(err)}`,\n    );` (lines 140-144) | `Marketplace "${recordedName}" added; completion cache refresh deferred: ${errorMessage(err)}` |
| 160 | `notifySuccess` | `notifySuccess(opts.ctx, renderRow(successRow, MARKETPLACE_LABEL_PROBE));` (renders `MarketplaceRow{kind:"marketplace", name, scope, status:"added", outcomeClass:"ok", marker?:"autoupdate"}`) | github: `● <mp> [<scope>] <autoupdate> (added)`; path: `● <mp> [<scope>] (added)` |

**V2 target NotificationMessage payload shapes (2 shapes):**

1. **Primary success (line 160 replacement):**

   ```ts
   notify(opts.ctx, pi, {
     marketplaces: [{
       name: recordedName,
       scope: opts.scope,
       status: "added",
       plugins: [],
     }],
   });
   ```

   Catalog UAT fixture references: `path-source` (lines 1117-1119) and `github-source` (lines 1122-1133) at `tests/architecture/catalog-uat.test.ts`. Note: catalog fixtures do NOT set a marker field -- V2 payload model has no separate marker; `<autoupdate>` token is reserved for the list surface arm (`mp.status === undefined` + `mp.details.autoupdate === true`), NOT the `(added)` state-change arm.

   V2 byte output (both source kinds): `● <mp> [<scope>] (added)\n\n/reload to pick up changes` (per catalog `<!-- catalog-state: github-source -->` at `docs/output-catalog.md:728-730` and `<!-- catalog-state: path-source -->` at `:726-728`). The `<autoupdate>` marker MOVES off the `(added)` row entirely.

2. **Completion-cache-leak warning (line 141 replacement):**

   The V2 grammar has no clean representation for "primary success + secondary post-state cleanup warning". Two options the planner must pick from:

   - **(A) Drop entirely** -- parallel to D-18-01's cleanup-leak drop in `remove.ts`. Simplest; consistent precedent. (Recommended.)
   - **(B) Fold into the same `notify()` call as `mp.reasons: ["...cache deferred"]`** -- but `Reason` is a closed set and `"cache deferred"` is not a member; adding it requires a grammar amendment (out of scope per the CONTEXT "Out of scope" -- "V1 grammar/type amendments... delivered by Phase 17.1").

   **Recommendation:** drop the cache-leak warning entirely (option A). Apply the D-18-01 precedent extension. Document the drop in the plan summary. The underlying cache failure still flows through the orchestrator's `try/catch`; the user just doesn't see a separate notification.

**`pi: ExtensionAPI` plumbing:** add.ts current `AddMarketplaceOptions` has NO `pi` field. The migration MUST extend the interface with `readonly pi: ExtensionAPI` AND extend `makeAddHandler` in `edge/handlers/marketplace/add.ts` (currently `makeAddHandler(deps: EdgeDeps)`) to receive and thread `pi`. The `register.ts` wiring at line 84 (`marketplaceAdd: makeAddHandler(deps)`) must also be updated. This is a per-plan-18-01 task -- not a separate plan.

**Now-orphaned imports to drop (Plan 18-01):**
- `import { renderRow } from "../../presentation/compact-line.ts";` (line 53)
- `import type { MarketplaceRow } from "../../presentation/compact-line.ts";` (line 72)
- `import { MARKETPLACE_LABEL_PROBE } from "../../shared/constants/marketplace-label-probe.ts";` (line 55)
- `import { notifySuccess, notifyWarning } from "../../shared/notify.ts";` -> replaced with `import { notify } from "../../shared/notify.ts";` plus `import type { NotificationMessage, MarketplaceNotificationMessage } from "../../shared/notify.ts";` (line 63)
- `import type { ExtensionAPI } from "../../platform/pi-api.ts";` (NEW import, for `pi` on options interface)

---

### `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` (Plan 18-02, Wave 2)

**V1 callsite count:** 4 (matches CONTEXT).

| Line | Wrapper | Surrounding code | V1 message template |
|------|---------|------------------|---------------------|
| 141 | `notifyError` | inside per-scope `catch` when NOT `shouldCollectNotFound(opts, err)` | `errorMessage(err)` + Error cause chain via wrapper |
| 155 | `notifyError` | `missingEverywhere` branch -- name absent from every scope | `errorMessage(first.cause)` + cause |
| 163 | `notifySuccess` | empty-scopes `(no marketplaces)` EmptyToken branch (lines 162-167) | `(no marketplaces)` |
| 184 | `notifySuccess` | success block with rendered `lines.join("\n")` (lines 181-184) | Multi-line: `● <mp> [<scope>] <autoupdate>` and/or `● <mp> [<scope>] <no autoupdate> {already disabled}` etc. |

**V2 target NotificationMessage payload shapes (5 catalog states from `docs/output-catalog.md:842-895`):**

1. **Fresh enable** (`mp.status = "autoupdate enabled"`):
   ```ts
   { marketplaces: [{ name, scope, status: "autoupdate enabled", plugins: [] }] }
   ```
   V2 byte: `● <mp> [<scope>] (autoupdate enabled)\n\n/reload to pick up changes`.

2. **Fresh disable** (`mp.status = "autoupdate disabled"`):
   ```ts
   { marketplaces: [{ name, scope, status: "autoupdate disabled", plugins: [] }] }
   ```
   V2 byte: `● <mp> [<scope>] (autoupdate disabled)\n\n/reload to pick up changes`.

3. **Idempotent enable** (already-on):
   ```ts
   { marketplaces: [{ name, scope, status: "skipped", reasons: ["already enabled"], plugins: [] }] }
   ```
   V2 byte: `● <mp> [<scope>] (skipped) {already enabled}` (severity = warning; no reload-hint).

4. **Idempotent disable** (already-off):
   ```ts
   { marketplaces: [{ name, scope, status: "skipped", reasons: ["already disabled"], plugins: [] }] }
   ```
   V2 byte: `● <mp> [<scope>] (skipped) {already disabled}` (severity = warning; no reload-hint).

5. **Not-found** (`enable missing-mp`):
   ```ts
   { marketplaces: [{ name, scope, status: "failed", plugins: [] }] }
   ```
   V2 byte: `⊘ <mp> [<scope>] (failed)` (severity = error; no reload-hint).

6. **Bare empty scopes** (lines 163-168 today):
   ```ts
   { marketplaces: [] }
   ```
   V2 byte: `(no marketplaces)` per D-16-17 (no severity arg).

7. **Bare form mixed (multi-marketplace)** -- per existing MAU-2 test "MAU-2 / CMC-33: bare form flips every marketplace in scope":
   ```ts
   {
     marketplaces: [
       { name: "already", scope: "project", status: "skipped", reasons: ["already enabled"], plugins: [] },
       { name: "to-flip", scope: "project", status: "autoupdate enabled", plugins: [] },
     ],
   }
   ```
   The current orchestrator alphabetically sorts at lines 178-180 (`sorted = [...rows].sort(...)`). Per D-16-06 (caller-order honored) the planner MAY remove this sort and rely on iteration order, OR keep it -- both produce correct output. Removing the sort is the more idiomatic V2 pattern (CONTEXT Integration Points calls this out explicitly).

**`pi: ExtensionAPI` plumbing:** autoupdate.ts current `AutoupdateOptions` has NO `pi` field. The migration MUST extend the interface with `readonly pi: ExtensionAPI` AND extend `makeAutoupdateHandler` in `edge/handlers/marketplace/autoupdate.ts` (currently `makeAutoupdateHandler(true)` / `makeAutoupdateHandler(false)`) to accept `pi`. The `register.ts` wiring at lines 88-89 (`marketplaceAutoupdate: makeAutoupdateHandler(true)`, `marketplaceNoautoupdate: makeAutoupdateHandler(false)`) must be updated.

**Now-orphaned imports to drop (Plan 18-02):**
- `import { renderRow } from "../../presentation/compact-line.ts";` (line 43)
- `import type { MarketplaceRow } from "../../presentation/compact-line.ts";` (line 52)
- `import { MARKETPLACE_LABEL_PROBE } from "../../shared/constants/marketplace-label-probe.ts";` (line 44)
- `import { notifyError, notifySuccess } from "../../shared/notify.ts";` (line 46) -> replaced with `import { notify } from "../../shared/notify.ts";` + `NotificationMessage` type
- Local `AutoupdateRowInput` / `buildAutoupdateRow` helpers (lines 71-111) become irrelevant -- direct construction of `MarketplaceNotificationMessage` per-flip is cleaner.

---

### `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts` (Plan 18-03, Wave 2)

**V1 callsite count:** 1 (matches CONTEXT).

| Line | Wrapper | Surrounding code | V1 message template |
|------|---------|------------------|---------------------|
| 67 | `notifySuccess` | `notifySuccess(opts.ctx, renderMarketplaceList(allRecords));` -- handles both populated and empty cases | Populated: flat lines `● <name> [<scope>] [<marker>]` joined; empty: `(no marketplaces)` |

**V2 target NotificationMessage payload shape (list-surface, `mp.status === undefined`):**

```ts
notify(opts.ctx, pi, {
  marketplaces: allRecords.map((record) => ({
    name: record.name,
    scope: record.scope,
    details: {
      autoupdate: record.autoupdate ?? false,
      ...(record.lastUpdatedAt !== undefined && { lastUpdatedAt: record.lastUpdatedAt }),
    },
    plugins: [],
  })),
});
```

V2 byte form (catalog `<!-- catalog-state: mixed-scopes -->` at `docs/output-catalog.md:704-712`):
```
● alpha [project] <autoupdate> <last-updated 2026-05-25T00:00:00Z>

● alpha [user]

● beta [user]

● zeta [project] <autoupdate>
```

Note: the `<last-updated ...>` token surfaces ONLY when `details.lastUpdatedAt` is defined; the existing list.ts orchestrator at lines 54-60 spreads `autoupdate` but NOT `lastUpdatedAt`. The planner must add the `lastUpdatedAt` spread or document its absence (existing list tests don't assert on `<last-updated ...>` so it's a backward-compatible enrichment).

Empty case: `marketplaces: []` -> `(no marketplaces)` per D-16-17. No severity arg.

**`pi: ExtensionAPI` plumbing:** list.ts current `ListMarketplacesOptions` has NO `pi` field. Same pattern as add/autoupdate: add `readonly pi: ExtensionAPI` to options; extend `makeListHandler` (currently takes nothing -- need to verify; `register.ts:50` mapping is `list: makeListHandler(pi)` referring to plugin list, NOT marketplace list -- the marketplace list handler is a separate handler under `edge/handlers/marketplace/list.ts`). Verify the marketplace list handler factory signature at plan-write time.

Edit: checked `edge/handlers/marketplace/list.ts` at line 13 -- it only imports `ExtensionCommandContext`, no `ExtensionAPI`. So `makeListHandler` for marketplace list also needs the `pi` thread.

**Now-orphaned imports to drop (Plan 18-03):**
- `import { renderMarketplaceList } from "../../presentation/marketplace-list.ts";` (line 24)
- `import type { MarketplaceListEntry } from "../../presentation/marketplace-list.ts";` (line 29)
- `import { notifySuccess } from "../../shared/notify.ts";` (line 25) -> `import { notify } from "../../shared/notify.ts";` + types

---

### `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` (Plan 18-04, Wave 2)

**V1 callsite count:** 4 (matches CONTEXT).

| Line | Wrapper | Surrounding code | V1 message template | Disposition |
|------|---------|------------------|---------------------|-------------|
| 299 | `notifyWarning` | Completion-cache-cleanup catch block (lines 294-303) | `Marketplace "${opts.name}" removed; completion cache cleanup deferred: ${errorMessage(err)}` | DROP (no V2 representation; parallel to D-18-01) |
| 354 | `notifyWarning` | Post-state cleanup-leak block (MR-6 aggregated leaks). Uses inline `causeChainTrailer(aggregated)` (lines 341-355). | `${errorMessage(aggregated)}\n\n${trailer}` (cleanup-failed-warning sentence + inline cause chain) | **D-18-01 DROP** |
| 407 | `notifyWarning` | CMC-31 PARTIAL branch (cascade summary + CMC-15 dual trailer). Uses `cascadeSummary({ marketplace, rows, probe })` + `appendReloadHint` + `RETRY_ANCHOR` (lines 363-408) | Multi-line block: `⊘ <mp> [<scope>] (failed) {plugins remain}\n  <child rows>\n\n/reload to pick up changes\n\nFix the underlying issue and retry.` | REPLACE with V2 partial-state shape; D-18-03 cascade restructure |
| 422 | `notifySuccess` | CMC-31 CLEAN branch (lines 411-422) | `● <mp> [<scope>] (removed)\n\n/reload to pick up changes` (when `removedPlugins.length > 0`) or bare `● <mp> [<scope>] (removed)` | REPLACE with V2 clean-removal shape |

**V2 target NotificationMessage payload shapes (3 shapes after the 2 drops):**

1. **Completion-cache-leak (line 299) -- DROP entirely.** Apply D-18-01 precedent. The completion-cache cleanup failure stays caught in the `try/catch`; no user-visible notification.

2. **Post-state cleanup-leak (line 354) -- DROP entirely per D-18-01.** Delete the entire `if (cleanupLeaks.length > 0)` block (lines 341-356) -- the cleanup-leak path becomes a no-op user-visibly (only side-effect aggregation remains, dead code; the planner may also delete the `cleanupLeaks` accumulator if unused after the drop).

3. **CMC-31 CLEAN (line 422) -- V2 clean shape:**

   ```ts
   notify(opts.ctx, opts.pi, {
     marketplaces: [{
       name: opts.name,
       scope: resolved.scope,
       status: "removed",
       plugins: [],
     }],
   });
   ```

   V2 byte form (catalog `<!-- catalog-state: clean -->` at `docs/output-catalog.md:768-772`):
   ```
   ● local-mp [user] (removed)

   /reload to pick up changes
   ```
   Reload-hint fires per D-16-12 (mp.status `"removed"` is state-changing). Severity = info (omit second arg).

4. **CMC-31 PARTIAL (line 407) -- V2 partial-state shape per D-18-03:**

   ```ts
   notify(opts.ctx, opts.pi, {
     marketplaces: [{
       name: opts.name,
       scope: resolved.scope,
       status: "failed",
       plugins: [
         // Successfully unstaged plugins:
         ...successfullyUnstaged.map((name): PluginUninstalledMessage => ({
           status: "uninstalled",
           name,
           // version field optional on uninstalled variant -- planner verifies type
         })),
         // Failed plugins -- D-18-03 cause migration:
         ...failedPlugins.map(({ name, cause }): PluginFailedMessage => ({
           status: "failed",
           name,
           reasons: [narrowCascadeFailure(cause)],
           cause, // Per-plugin cause-chain, rendered at 4-space indent by renderPluginRow (D-16-08)
         })),
       ],
     }],
   });
   ```

   V2 byte form (catalog `<!-- catalog-state: partial -->` at `docs/output-catalog.md:780-787`):
   ```
   ⊘ local-mp [user] (failed)
     ○ helper v1.0.0 (uninstalled)
     ⊘ tool (failed) {permission denied}
       cause: EACCES: permission denied

   /reload to pick up changes
   ```
   Reload-hint fires because at least one plugin status is in `{uninstalled}` per D-16-12. Severity = error (any plugin/mp failed per D-16-11). The V1 `RETRY_ANCHOR` trailer ("Fix the underlying issue and retry.") is DROPPED per `docs/output-catalog.md:791` (already excluded by D-17-09).

**Caller-order note:** the existing remove.ts at line 403 sorts `removedPlugins` for the reload-hint composition. With V2, sort is unnecessary -- the renderer doesn't sort `plugins[]` (D-16-06 caller-order). Planner discretion to keep the sort for deterministic output or drop it.

**`pi: ExtensionAPI` plumbing:** remove.ts ALREADY takes `readonly pi: ExtensionAPI` at line 105. No interface change needed -- direct use of `opts.pi` in the `notify()` call.

**Now-orphaned imports to drop (Plan 18-04):**
- `import { softDepStatus } from "../../platform/pi-api.ts";` (line 73)
- `import { cascadeSummary } from "../../presentation/cascade-summary.ts";` (line 74)
- `import { causeChainTrailer } from "../../presentation/cause-chain.ts";` (line 75)
- `import { renderRow } from "../../presentation/compact-line.ts";` (line 76)
- `import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";` (line 77)
- `import type { MarketplaceRow, PluginCascadeRow, SoftDepProbe } from "../../presentation/compact-line.ts";` (lines 90-94)
- `appendLeaks` import (line 79) becomes orphaned ONLY IF the cleanup-leak drop is applied (option A); confirm planner decision.
- `notifySuccess, notifyWarning` (line 80) -> `notify` import.
- The local `RETRY_ANCHOR` constant (line 100) becomes dead.
- The local `removePath` helper (lines 135-145) and `cleanupLeaks` accumulator may also become dead if the cleanup-leak drop cascade is consistent -- planner audits.

---

### `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` (Plan 18-05, Wave 2)

**V1 callsite count: 6** (CONTEXT says 5 -- **DRIFT**; CONTEXT canonical-refs at line 126 lists "5 V1 callsites (notifySuccess at 220, 631; notifyWarning at 599, 647 (via dispatch ternary); notifyError at 584 (2-arm \\n${err.retryHint} form), 586)" -- but line 647 is a **dispatch ternary** that resolves to either `notifyWarning` OR `notifySuccess`, which is ONE callsite, not split. The 6 distinct callsite locations are: 220, 584, 586, 599, 631, 647. The planner should treat this as 6 callsites; CONTEXT undercount is cosmetic.)

| Line | Wrapper | Surrounding code | V1 message template | Disposition |
|------|---------|------------------|---------------------|-------------|
| 220 | `notifySuccess` | `updateAllMarketplaces` empty-targets case (lines 217-222) | `(no marketplaces)` via `renderRow({ kind: "empty", token: "no marketplaces" }, NULL_PROBE)` | REPLACE with V2 empty-marketplaces shape |
| 584 | `notifyError` | Entity-level mp-failure WITH retry-hint (lines 580-584) | `${errorMessage(err)}\n${err.retryHint}` + Error.cause auto-trailer | REPLACE with V2 bare-failed-mp shape; **D-18-02 DROP retry-hint** |
| 586 | `notifyError` | Entity-level mp-failure WITHOUT retry-hint (line 586) | `errorMessage(err)` + Error.cause auto-trailer | REPLACE with V2 bare-failed-mp shape |
| 599 | `notifyWarning` | Completion-cache-cleanup catch block (lines 596-603) | `Marketplace "${name}" updated; completion cache refresh deferred: ${errorMessage(err)}` | DROP (D-18-01 precedent extension; no V2 representation) |
| 631 | `notifySuccess` | Autoupdate-OFF manifest-refresh success (line 631) | `● <mp> [<scope>] (updated)` (no reload-hint) | REPLACE with V2 updated-mp shape (NB: V2 catalog at `docs/output-catalog.md:803-806` EMITS the reload-hint -- behavior change) |
| 647 | `notifyWarning` OR `notifySuccess` (ternary dispatch) | Autoupdate-ON cascade -- `dispatch = severity === "warning" ? notifyWarning : notifySuccess; dispatch(ctx, body)` (lines 638-648) | Multi-line: `● <mp> [<scope>] (updated)\n  <child rows>\n\n/reload to pick up changes` | REPLACE with V2 cascade-mp shape; severity computed by notify() (D-16-11) |

**V2 target NotificationMessage payload shapes (4 shapes after 1 drop):**

1. **Empty marketplaces (line 220):**
   ```ts
   notify(opts.ctx, opts.pi, { marketplaces: [] });
   ```
   V2 byte: `(no marketplaces)` per D-16-17.

2. **Marketplace-level failure (lines 584 + 586 collapse to one shape) -- D-18-02 DROP retry-hint:**
   ```ts
   notify(ctx, pi, {
     marketplaces: [{ name, scope, status: "failed", plugins: [] }],
   });
   ```
   V2 byte (catalog `<!-- catalog-state: mp-failure-network -->` at `docs/output-catalog.md:830`):
   ```
   ⊘ official [user] (failed)
   ```
   Severity = error; no cause-chain trailer (V2 type model places `cause?: Error` on plugin variants only -- the per-mp Error.cause is dropped); no retry-hint (D-18-02). `err.retryHint` stays internal to `MarketplaceUpdateError` for programmatic inspection.

3. **Completion-cache-cleanup leak (line 599) -- DROP entirely.** Same disposition as the equivalent in add.ts:141, remove.ts:299.

4. **Autoupdate-OFF manifest-refresh success (line 631):**
   ```ts
   notify(ctx, pi, {
     marketplaces: [{ name, scope, status: "updated", plugins: [] }],
   });
   ```
   V2 byte (catalog `<!-- catalog-state: autoupdate-off-manifest-refresh -->` at `docs/output-catalog.md:803-806`):
   ```
   ● local-mp [user] (updated)

   /reload to pick up changes
   ```
   **Behavior change:** V1 emitted NO reload-hint on this arm; V2 DOES (per D-16-12 -- mp.status `"updated"` is state-changing per the ladder, AND `docs/output-catalog.md:809` makes the trailer explicit). Test "MU-4 + D-14: github source refreshes via fetch+forceUpdateRef+checkout" (line 165) asserts `assert.notEqual(first.severity, "error")` but does NOT currently assert reload-hint presence -- so this is a **silent contract change**; the planner must add a reload-hint-presence assertion in the test for completeness.

5. **Autoupdate-ON cascade (line 647 -- ternary dispatch):**
   ```ts
   notify(ctx, pi, {
     marketplaces: [{
       name,
       scope,
       status: "updated",
       plugins: outcomes.map((o) => outcomeToCascadePluginMessage(o, scope)),
     }],
   });
   ```
   The existing `outcomeToCascadeRow` helper (line 408) is REPLACED by an `outcomeToCascadePluginMessage` that builds discriminated `PluginNotificationMessage` payloads. Per-plugin shapes: `updated` (with `from`/`to`/`dependencies`), `unchanged` -> `skipped` + `["up-to-date"]`, `skipped` + narrowed `reasons`, `failed` + narrowed `reasons` (+ optional `cause`).

   V2 byte form (catalog `<!-- catalog-state: mixed-outcomes -->` at `docs/output-catalog.md:815-822`):
   ```
   ● official [user] (updated)
     ● alpha 0.5.0 → v1.0.0 (updated)
     ⊘ beta (skipped) {up-to-date}
     ⊘ delta (failed) {network unreachable}

   /reload to pick up changes
   ```
   **NB:** the V1 cascade-failed `skipped` uses ● glyph ("trivial skip" treatment), but the V2 catalog uses ⊘ glyph (`skipped` -> warning severity per SNM-14 -> ⊘ glyph per renderer arm). Existing test "CMC-26 / MSG-GR-3" at line 423 asserts `idxB` matches `"  ● b [project]"` for the `unchanged` outcome -- this is the V1 trivial-skip ● glyph. In V2, `unchanged` outcomes map to `status: "skipped" + reasons: ["up-to-date"]` and the catalog at `docs/output-catalog.md:818` shows `⊘ beta (skipped) {up-to-date}` -- **glyph flip from ● to ⊘**. The planner must flip the test assertion `"  ● b [project]"` to `"  ⊘ b [project]"`.

**`pi: ExtensionAPI` plumbing:** update.ts ALREADY takes `readonly pi?: ExtensionAPI` (optional) at lines 161 + 170. The V2 `notify()` REQUIRES `pi` (not optional). The planner must either:
   - (A) Make `pi` REQUIRED on `UpdateMarketplaceOptions` / `UpdateAllMarketplacesOptions` (cleaner), OR
   - (B) Construct a fallback ExtensionAPI mock for the optional path (matches existing `NULL_PROBE` precedent at line 138).

Recommendation: (A) -- the V2 contract is `pi: ExtensionAPI` non-optional. The optional `pi?` is a V1 backward-compat that tests no longer need (all tests already create a mock pi via `makeCtx()`). Edge handler at `edge/handlers/marketplace/update.ts:21` already imports `ExtensionAPI`; verify it threads `pi` correctly.

**Now-orphaned imports to drop (Plan 18-05):**
- `import { softDepStatus } from "../../platform/pi-api.ts";` (line 90)
- `import { cascadeSummary } from "../../presentation/cascade-summary.ts";` (line 91)
- `import { composeErrorWithCauseChain } from "../../presentation/cause-chain.ts";` (line 92) -- but this is used inside `cascadeAutoupdates` (line 337) for `notes` composition, which is consumed in non-notify paths. Verify it remains used after migration; if so, KEEP this import.
- `import { renderRow } from "../../presentation/compact-line.ts";` (line 93)
- `import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";` (line 94)
- `import { composeVersionArrow } from "../../presentation/version-arrow.ts";` (line 95) -- USED at line 434 inside `outcomeToCascadeRow`; if that function is replaced by `outcomeToCascadePluginMessage` and the `PluginUpdatedMessage` carries `from`/`to` fields directly (renderer composes the arrow), this import may be dropped.
- `import type { MarketplaceRow, PluginCascadeRow, SoftDepProbe } from "../../presentation/compact-line.ts";` (lines 119-122)
- Local `NULL_PROBE` constant (lines 138-141) becomes dead when `pi` is REQUIRED.
- `notifyError, notifySuccess, notifyWarning` (line 104) -> `notify`.

## Per-File Test Surface

### `tests/orchestrators/marketplace/add.test.ts` (Plan 18-01)

**Test count: 13** (`grep -c "^test("`).

**Byte-exact V1 -> V2 assertion flips:**

| Line | V1 assertion | V2 assertion |
|------|--------------|--------------|
| 91 | `note.message === "● valid-marketplace [project] <autoupdate> (added)"` | `note.message === "● valid-marketplace [project] (added)\n\n/reload to pick up changes"` |
| 94 | `note.message.includes("/reload to pick up changes") === false` | `note.message.includes("/reload to pick up changes") === true` -- **D-18-06 implicit consequence flip** |
| 295 | `note.message === "● valid-marketplace [project] (added)"` | `note.message === "● valid-marketplace [project] (added)\n\n/reload to pick up changes"` (path-source -- same V2 catalog shape; no `<autoupdate>` marker on V2 either) |
| 373 | `note.message === "● valid-marketplace [project] (added)"` | `note.message === "● valid-marketplace [project] (added)\n\n/reload to pick up changes"` (tilde-path source) |
| 400 | `note.message.includes("[project]")` | KEEP -- substring assertion still valid |

**Other behavioral assertions to PRESERVE:** state-mutation assertions (`loadState` + key presence), `gitOps.cloneCalls.length` counts, error-throw assertions on `MarketplaceDuplicateNameError` / `StaleSourceCloneError`, NFR-5 path-source-no-git assertions, MA-9 leak-cleanup assertion, CMP-1 cross-scope independence.

**Net assertion change:** ~4 byte-string flips + 1 boolean reload-hint flip + new `pi` plumbing through `makeCtx()` already returns `pi: { getAllTools: () => [] }` (line 37) so no test-fixture refactor is needed.

---

### `tests/orchestrators/marketplace/autoupdate.test.ts` (Plan 18-02)

**Test count: 12** (`grep -c "^test("`).

**Byte-exact V1 -> V2 assertion flips:**

| Line | V1 assertion | V2 assertion |
|------|--------------|--------------|
| 92 | `note.message === "● mp [project] <autoupdate>"` | `note.message === "● mp [project] (autoupdate enabled)\n\n/reload to pick up changes"` |
| 108 | `note.message === "● mp [project] <no autoupdate>"` | `note.message === "● mp [project] (autoupdate disabled)\n\n/reload to pick up changes"` |
| 124 | `note.message === "● mp [project] <autoupdate> {already enabled}"` | `note.message === "● mp [project] (skipped) {already enabled}"` (severity = warning) |
| 138 | `note.message === "● mp [project] <no autoupdate> {already disabled}"` | `note.message === "● mp [project] (skipped) {already disabled}"` (severity = warning) |
| 155 | `note.message === "● mp [project] <autoupdate>"` | `note.message === "● mp [project] (autoupdate enabled)\n\n/reload to pick up changes"` |
| 169 | `note.message === "● mp [project] <no autoupdate> {already disabled}"` | `note.message === "● mp [project] (skipped) {already disabled}"` (severity = warning) |
| 195 | `notifications[0].message =~ /● already \[project\] <autoupdate> \{already enabled\}/` | `=~ /● already \[project\] \(skipped\) \{already enabled\}/` |
| 197 | `notifications[0].message =~ /● to-flip \[project\] <autoupdate>$/m` | `=~ /● to-flip \[project\] \(autoupdate enabled\)/` (or assert full byte string) |
| 205 | `notifications[0].message === "(no marketplaces)"` | KEEP unchanged |
| 221 | `notifications[0].message === "● only [user] <autoupdate>"` | `notifications[0].message === "● only [user] (autoupdate enabled)\n\n/reload to pick up changes"` |

**Other assertions to PRESERVE:** state-mutation (`loadState` + `.autoupdate` field), notification-count assertions, severity assertions (now will sometimes flip from `undefined` to `"warning"` for idempotent flips per D-18-05 severity ladder), NFR-5 grep assertion at line 272 (no git imports in autoupdate.ts source).

**New severity assertions to ADD per D-18-05:**
- Idempotent enable/disable tests (lines 112-140) must assert `note.severity === "warning"` (currently they don't assert severity at all -- default `undefined`).
- Fresh enable/disable tests must assert `note.severity === undefined` (info severity).

**Net assertion change:** ~8 byte-string flips + 2 regex flips + 4 new severity assertions + reload-hint inclusion-check for fresh-flips.

---

### `tests/orchestrators/marketplace/list.test.ts` (Plan 18-03)

**Test count: 8** (`grep -c "^test("`).

**Byte-exact V1 -> V2 assertion flips:**

| Line | V1 assertion | V2 assertion |
|------|--------------|--------------|
| 65 | `notifications[0].message === "(no marketplaces)"` | KEEP unchanged |
| 92 | `notifications[0].message === "● local [project]"` | KEEP unchanged (V2 catalog `<!-- catalog-state: mixed-scopes -->` confirms `● <name> [<scope>]` form on list surface with no marker) |
| 121 | `notifications[0].message === "● official [project]"` | KEEP unchanged |
| 147 | `notifications[0].message === "● auto [project] <autoupdate>"` | KEEP unchanged (autoupdate=true list-surface row -- catalog `:705` confirms `<autoupdate>` reserved for list surface) |
| 172 | `notifications[0].message === "● user-only [user]"` | KEEP unchanged |

**All list.test.ts byte assertions ALREADY MATCH the V2 catalog list-surface byte form** (verified against `docs/output-catalog.md:686-712`). The only change Plan 18-03 makes to assertions is potentially adding `<last-updated <iso>>` token coverage IF the planner threads `record.lastUpdatedAt` into the V2 `details` payload (recommended). New test: "list surface emits `<last-updated <iso>>` marker when record carries `lastUpdatedAt`".

**Other assertions to PRESERVE:** source-grep assertions (`ML-3: no domain/manifest imports` at line 176; `NFR-5: no git imports` at line 199; `D-04 corollary: no withStateGuard` at line 210) -- all source-grep, unchanged.

**Net assertion change:** ~0 byte-string flips required; optional `<last-updated>` test addition.

---

### `tests/orchestrators/marketplace/remove.test.ts` (Plan 18-04)

**Test count: 16** (`grep -c "^test("`).

**Byte-exact V1 -> V2 assertion flips:**

| Line | V1 assertion | V2 assertion |
|------|--------------|--------------|
| 154 | `notifications[0].message === "● dup-name [project] (removed)"` | `notifications[0].message === "● dup-name [project] (removed)\n\n/reload to pick up changes"` (V2 catalog `:769-772` shows reload-hint) -- BUT this test seeds an empty marketplace (`plugins: {}`); reload-hint fires from `mp.status === "removed"` per D-16-12, not from plugin uninstalls. **KEY CONTRACT CHANGE:** V1 clean-removal emitted NO reload-hint on empty marketplace removal; V2 DOES. |
| 187 | `notifications[0].message === "● user-only [user] (removed)"` | `notifications[0].message === "● user-only [user] (removed)\n\n/reload to pick up changes"` |
| 259 | `notifications[0].message.includes("/reload to pick up changes") === false` | `=== true` -- **flips contract** per V2 mp.status `"removed"` reload-hint per D-16-12 |
| 262 | `notifications[0].message === "● empty [project] (removed)"` | `=== "● empty [project] (removed)\n\n/reload to pick up changes"` |
| 308 | `notifications[0].message =~ /\/reload to pick up changes$/` | KEEP -- still ends with the trailer on the multi-plugin case |
| 387 | `notifications.length === 1` | KEEP |
| 388 | `notifications[0].severity === "warning"` | `=== "error"` -- V2 routes any plugin/mp `failed` to error per D-16-11 (cascade partial has mp.status=`failed`) |
| 389-392 | `notifications[0].message =~ /Fix the underlying issue and retry\.?$/` | DELETE assertion (retry-anchor dropped per `docs/output-catalog.md:791` / D-17-09 / D-18-03) |

**Tests to DELETE per D-18-01 (cleanup-leak drop):** none currently -- the existing tests do NOT exercise the cleanup-leak path (no test verifies the line 354 `notifyWarning`). Confirmed by `grep "cleanup leak\|cleanupLeaks\|completion cache"` in remove.test.ts returning nothing user-facing. No tests to delete; the V1 cleanup-leak branch was untested.

**Tests to KEEP unchanged:**
- `MR-1: --scope omitted + name not in either scope throws MarketplaceNotFoundError` (line 103) -- throw-path test.
- `MR-2 + MR-8 (RH-1): empty marketplace removed cleanly emits success WITHOUT reload hint` (line 232) -- **but the contract flipped**: V1 said no reload-hint when no plugins changed; V2 says reload-hint because `mp.status === "removed"` is state-changing per D-16-12. **The test name and assertion both need to flip** -- this test should be renamed (e.g., `MR-2 + V2 D-16-12: empty marketplace removed cleanly emits success WITH mp-level reload-hint`) and the assertion at line 259 flipped from `false` to `true`.
- `MR-7: github-source clone dir retained when any plugin failed in cascade` (line 406) -- filesystem-state test, byte-string-agnostic, no flip needed (except severity at line 388).
- `MR-7 inverse: github-source clone dir REMOVED on full cascade success` (line 467) -- same as above.
- `D-03-INV :: remove unlinks the plugin cache file` (line 519) -- cache-state test, byte-string-agnostic.
- `narrowCascadeFailure` unit tests (lines 613-646) -- test the private `__test_narrowCascadeFailure` helper; KEEP unchanged since `narrowCascadeFailure` is still used in V2 path to populate `PluginFailedMessage.reasons[0]`.

**Net assertion change:** ~5 byte-string flips + 1 severity flip + 1 retry-anchor delete + 1 reload-hint contract flip; `narrowCascadeFailure` helper unit tests preserved.

---

### `tests/orchestrators/marketplace/update.test.ts` (Plan 18-05)

**Test count: 22** (`grep -c "^test("`).

**Byte-exact V1 -> V2 assertion flips:**

| Line | V1 assertion | V2 assertion |
|------|--------------|--------------|
| 135 | `first.message === "(no marketplaces)"` | KEEP unchanged (V2 D-16-17 sentinel matches) |
| 136 | `first.message.includes("/reload to pick up changes") === false` | KEEP unchanged (empty mps -> no reload-hint) |
| 163 | `assert.notEqual(first.severity, "error")` | KEEP, but ADD `assert.equal(first.severity, undefined)` (V2 info severity); ADD `assert.match(first.message, /\/reload to pick up changes/)` (V2 catalog autoupdate-off-manifest-refresh emits reload-hint -- **silent contract change**) |
| 271 | `first.message =~ /Retry the command\./` | DELETE assertion (D-18-02 drops retry-hint) AND flip byte to V2 bare failed: `first.message === "⊘ rewritten [project] (failed)"` |
| 291 | `first.message.includes("Retry the command.") === false` | DELETE assertion (D-18-02 -- retry-hint never emitted in V2) AND replace with byte assertion: `first.message === "⊘ offline [project] (failed)"` |
| 328 | `first.message =~ /Retry the command\./` | Same as line 271 -- DELETE retry assertion; flip to V2 bare-failed byte string. |
| 514-517 | `body.indexOf("  ● a [project]")`, `"  ● b [project]"`, `"  ● c [project]"`, `"  ⊘ d [project]"` | Flip `"  ● b [project]"` -> `"  ⊘ b [project]"` and `"  ● c [project]"` -> `"  ⊘ c [project]"` -- V2 catalog mixed-outcomes shows skipped (●→⊘) glyph flip. Also flip the assertion shape: V2 byte for `updated` row is `  ● alpha 0.5.0 → v1.0.0 (updated)` (note: version field placement before status token per Phase 17 catalog rewrite). Re-derive complete byte strings against `docs/output-catalog.md:815-822` and `tests/shared/notify-v2.test.ts`. |
| 522-526 | partition-header negative assertions (`"Updated:"`, `"Unchanged:"`, ...) | KEEP unchanged (V2 never emits partition headers) |
| 567 | `first.message =~ /\/reload to pick up changes$/` | KEEP unchanged |
| 603 | `first.message.includes("/reload to pick up changes") === false` | KEEP unchanged (cascade all-unchanged -> no reload-hint) |
| 802 | `composed =~ /alpha[^\n]*\(failed\)[^\n]*\{permission denied\}/` | KEEP unchanged (regex matches V2 form) |
| 842 | `composed =~ /alpha[^\n]*\(failed\)[^\n]*\{source missing\}/` | KEEP unchanged |
| 879 | `composed =~ /alpha[^\n]*\(failed\)[^\n]*\{unreadable manifest\}/` | KEEP unchanged |

**Tests to PRESERVE:**
- `__test_outcomeToCascadeRow` unit tests (lines 692-757) -- test the V1 helper. **DECISION POINT:** if `outcomeToCascadeRow` is RENAMED/REWRITTEN to `outcomeToCascadePluginMessage` (returning V2 `PluginNotificationMessage` instead of V1 `PluginCascadeRow`), these tests must be updated to assert against V2 shapes. Recommended: rewrite the 4 tests to construct `PluginNotificationMessage` outputs.
- `D-03-INV` cache-invalidation test (line 644) -- cache-state test, byte-agnostic.
- All git-mock assertions (`state.cloneCalls`, `state.fetchCalls`, etc.) -- protocol tests, unchanged.

**Net assertion change:** ~6 byte-string flips + 3 retry-hint deletes + 2 glyph flips (● -> ⊘) + 1 reload-hint contract change on autoupdate-off + 4 `outcomeToCascadeRow` test rewrites.

---

## MSG-* Lint Surface Today

### Current shape of `eslint.config.js` MSG-Block 1 (lines 151-169)

```js
{
  // MSG-Block 1 (MSG-SR-1..6): cascade/severity routing -- orchestrators
  // surface. [...]
  files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"],
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

**No `ignores:` key currently present.** Plan 18-06 must ADD `ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"]` immediately after the `files:` line.

### Current shape of `eslint.config.js` MSG-Block 1b (lines 170-188)

```js
{
  // MSG-Block 1b (MSG-GR-3): per-scope rendering rule. [...]
  files: [
    "extensions/pi-claude-marketplace/orchestrators/**/*.ts",
    "extensions/pi-claude-marketplace/edge/handlers/**/*.ts",
  ],
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-gr-3-per-scope": "error",
  },
},
```

**No `ignores:` key currently present.** Plan 18-06 must ADD `ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"]` immediately after the `files:` array. Note: Phase 20 will REMOVE the `edge/handlers/**/*.ts` entry from this block's `files:` array (per CONTEXT D-18-07 last sentence); Phase 18 does NOT touch the edge entry.

### Exact edit (Plan 18-06)

Insert one new line in each block:

**MSG-Block 1 (before line 161):**
```js
  files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"],
  ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],
  plugins: { msg: msgPlugin },
```

**MSG-Block 1b (before line 184):**
```js
  files: [
    "extensions/pi-claude-marketplace/orchestrators/**/*.ts",
    "extensions/pi-claude-marketplace/edge/handlers/**/*.ts",
  ],
  ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],
  plugins: { msg: msgPlugin },
```

That is the ENTIRE eslint.config.js diff for Phase 18. ALL other blocks (Blocks 2, 3, 4a, 4b, 5, 6) remain unchanged per D-18-07.

## Phase 17.1 + 17.2 Landed Contract Confirmation

### Phase 17.1 (V2 Grammar Amendment: Autoupdate Surface) -- VERIFIED LANDED

- `extensions/pi-claude-marketplace/shared/notify.ts:225-233` declares `MARKETPLACE_STATUSES` as a 7-entry tuple: `["added", "removed", "updated", "failed", "autoupdate enabled", "autoupdate disabled", "skipped"] as const` -- matches D-17.1-01 / D-18-04.
- `extensions/pi-claude-marketplace/shared/notify.ts:502-509` declares `MarketplaceNotificationMessage` with `readonly reasons?: readonly Reason[]` (line 507) -- matches D-17.1-01 / D-18-05.
- `docs/output-catalog.md:838-895` rewrites the autoupdate section to 5 catalog-state blocks (`enable-fresh`, `disable-fresh`, `enable-idempotent`, `disable-idempotent`, `failure-not-found`) -- matches D-17.1-03 / D-18-05 table.
- `tests/architecture/catalog-uat.test.ts:1239-1291` carries the 5 fixtures (matches catalog states 1:1).
- `renderMpHeader` switch in `shared/notify.ts:585` (verified by grep -- function exists) has the 3 new arms; `computeSeverity` routes `mp.status === "skipped"` to `"warning"`; `shouldEmitReloadHint` triggers on `"autoupdate enabled"` / `"autoupdate disabled"` and NOT on `"skipped"`.

**Conclusion:** Plan 18-02 (autoupdate.ts migration) imports against this landed grammar with no Phase 17.1 follow-up work needed.

### Phase 17.2 (renderScopeBracket orphan-fold contract fix) -- VERIFIED LANDED

- `extensions/pi-claude-marketplace/shared/notify.ts:719-725` defines `renderScopeBracket(pluginScope: Scope | undefined, mpScope: Scope): string` returning `""` when `pluginScope === undefined || pluginScope === mpScope` -- matches D-17.2-01.
- All 10 `renderScopeBracket` call sites at `shared/notify.ts:827, 841, 855, 869, 879, 889, 898, 907, 916, 925` use the 2-arg form (mostly `(p.scope, mpScope)`, with 2 carve-out arms passing `undefined`) -- verified by grep.
- `composeVersionArrow` (`shared/notify.ts:734-736`) has 2-arg signature -- matches WR-03.

**Conclusion:** Plan 18-04 (remove.ts cascade restructure) and Plan 18-05 (update.ts cascade) construct `PluginNotificationMessage` payloads with `scope?: Scope` set per the orphan-fold contract; the renderer suppresses the `[<scope>]` bracket when `plugin.scope === marketplace.scope`. No further changes needed in shared/notify.ts.

## Cascade + Shared Test Landmines

### `tests/orchestrators/marketplace/cascade.test.ts` (3 tests)

**Verdict: NO CHANGES NEEDED.**

This file imports ONLY `cascadeUnstagePlugin` from `orchestrators/marketplace/shared.ts` (line 7). It does NOT import any `notifySuccess` / `notifyWarning` / `notifyError`. It does NOT call `removeMarketplace` or any other notify-emitting orchestrator. Every test asserts on `outcome.ok`, `outcome.dropped`, `outcome.cause` -- pure-function behavior of `cascadeUnstagePlugin`. The 3 tests cover empty resources, real skills unstage, and ENOTDIR shape assertion.

**Action:** Leave untouched. Document explicitly in Plan 18-04's SUMMARY that cascade.test.ts requires no migration.

### `tests/orchestrators/marketplace/shared.test.ts` (3 tests)

**Verdict: NO CHANGES NEEDED.**

This file imports ONLY `refreshGitHubClone` from `orchestrators/marketplace/shared.ts` (line 14). It does NOT import notify wrappers. Every test asserts on `gitOps` mock call counts and rejection behavior -- pure protocol assertions on the typed catch around isomorphic-git's `NotFoundError`.

**Action:** Leave untouched. Document explicitly in Plan 18-06's SUMMARY (the lint-narrowing plan) that shared.test.ts requires no migration; or alternatively note it in Plan 18-04 if that plan owns the shared.ts comment cleanup.

## Presentation Import Drops

| Orchestrator | Imports to drop |
|--------------|------------------|
| `add.ts` | `presentation/compact-line.ts` (line 53: `renderRow`; line 72: `MarketplaceRow` type) -- 2 lines |
| `autoupdate.ts` | `presentation/compact-line.ts` (line 43: `renderRow`; line 52: `MarketplaceRow` type) -- 2 lines |
| `list.ts` | `presentation/marketplace-list.ts` (line 24: `renderMarketplaceList`; line 29: `MarketplaceListEntry` type) -- 2 lines |
| `remove.ts` | `presentation/cascade-summary.ts` (line 74: `cascadeSummary`), `presentation/cause-chain.ts` (line 75: `causeChainTrailer`), `presentation/compact-line.ts` (line 76: `renderRow`; lines 90-94: `MarketplaceRow`/`PluginCascadeRow`/`SoftDepProbe` types), `presentation/reload-hint.ts` (line 77: `appendReloadHint`, `reloadHint`) -- 4 distinct presentation imports + types |
| `update.ts` | `presentation/cascade-summary.ts` (line 91: `cascadeSummary`), `presentation/compact-line.ts` (line 93: `renderRow`; lines 119-122: types), `presentation/reload-hint.ts` (line 94: `appendReloadHint`, `reloadHint`), `presentation/version-arrow.ts` (line 95: `composeVersionArrow`); `presentation/cause-chain.ts` (line 92: `composeErrorWithCauseChain`) ALSO IMPORTED but **may remain used** in `cascadeAutoupdates` notes composition (line 337) -- verify if still needed after migration |

`shared/constants/marketplace-label-probe.ts` (used by add.ts and autoupdate.ts to construct the `SoftDepProbe` arg for `renderRow`) becomes orphaned for those two files; remove the imports.

## Validation Architecture

Phase 18 is a migration phase with strong existing test infrastructure. No new framework or test scaffolding is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in to Node ≥22; native TS strip on Node ≥22.18) |
| Config file | none -- `node --test` auto-discovers `tests/**/*.test.ts` |
| Quick run command | `node --test --import tsx tests/orchestrators/marketplace/<file>.test.ts` (per-file, used during plan execution) |
| Full suite command | `npm run check` (runs typecheck + ESLint + Prettier + `node --test`) |

### Phase Requirements → Test Map

Phase 18 has NO direct SNM-ID closures. Plan-level requirements are the 4 Success Criteria from ROADMAP §"Phase 18":

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|--------------|
| SC #1 | Zero V1 callers in `orchestrators/marketplace/**/*.ts` | static grep + lint | `npm run check` (MSG-Block 1+1b lints orchestrators/, only marketplace/ is ignored after migration) AND `grep -r "notifySuccess\|notifyWarning\|notifyError" extensions/pi-claude-marketplace/orchestrators/marketplace/ | grep -v "^.*://"` returns zero | YES (eslint.config.js + grep) |
| SC #2 | MSG-Block 1 + 1b `files:` globs narrowed (added ignores) | lint | `npm run check` (catches the regression if the ignores entry is missing) | YES (eslint.config.js) |
| SC #3 | Catalog UAT byte-equality GREEN for marketplace family | unit | `node --test --import tsx tests/architecture/catalog-uat.test.ts` | YES (already runs in `npm run check`) |
| SC #4 | `npm run check` GREEN | aggregate | `npm run check` | YES |

Per-plan tests: each of plans 18-01..05 owns one orchestrator's unit test file (already exists, byte-asserted, mutation-tracked). Plan 18-06 verifies the aggregate `npm run check`.

### Sampling Rate

- **Per task commit (within a plan):** `node --test --import tsx tests/orchestrators/marketplace/<single-file>.test.ts` (~1-2s) -- run after each file mutation pair (orchestrator + test).
- **Per wave merge:** `npm run check` (~30-60s) -- run before merging each per-file plan branch.
- **Phase gate:** `npm run check` GREEN twice -- once after Wave 2 merge, once after Wave 3 merge (final lint narrowing + final UAT confirmation).

### Wave 0 Gaps

NONE. All 5 orchestrator test files already exist, all use the `makeCtx()` pattern with `pi: { getAllTools: () => [] }`, and the catalog UAT at `tests/architecture/catalog-uat.test.ts` already drives `notify(mockCtx, mockPi, message)` against marketplace-family fixtures (lines 1078-1292: list, add, remove, update, autoupdate sections all present).

No new test files needed. No conftest/framework install needed. Phase 18 is a pure refactor-with-test-flip phase.

**Validation pyramid:**
1. **Unit (per-orchestrator):** 5 files × byte-exact V2 assertions through real `notify()` via `makeCtx()` mock -- catches construction bugs with a byte gate (per D-18-06).
2. **Integration (catalog UAT):** Single file driving 30+ fixtures through `notify()` end-to-end -- catches renderer bugs and grammar drift; cross-verifies that marketplace-family fixtures (5 commands × 2-5 states each) match catalog byte form.
3. **Static (lint + typecheck):** `npm run check` runs ESLint MSG-Block 1+1b against non-migrated orchestrators (now plugin/ + edge/handlers/ only after Phase 18's ignores narrow); TypeScript strictTypeChecked catches type drift in payload construction.
4. **Phase gate:** `npm run check` GREEN at end of each wave; second-pass at end of Wave 3 confirms the lint narrowing is consistent with the migration.

## Risks & Landmines

1. **Wave 2 parallelism trap: `pi` arg interface changes touch shared edge files.** Plans 18-01 (add), 18-02 (autoupdate), 18-03 (list) all need to extend their orchestrator's `*Options` interface with `readonly pi: ExtensionAPI` AND modify their `edge/handlers/marketplace/<file>.ts` factory signature AND change the wiring in `extensions/pi-claude-marketplace/edge/register.ts:84, 88-89`. **`register.ts` is shared** -- if all three Wave 2 plans land in parallel and each modifies `register.ts`, the merges will conflict on the same lines. **MITIGATION:** Plan 18-01 (Wave 1 pilot) should ONLY change `register.ts:84` (the `makeAddHandler(deps)` -> `makeAddHandler(deps, pi)` wire). Then Plans 18-02 and 18-03 each change their own respective line (88-89 and 50 for marketplace list -- different line from plugin list). The line locations differ, but `register.ts` is touched 3 times. Verify by trial-merge OR have Plan 18-01 establish the `pi` threading pattern that Wave 2 plans then mirror with surgical line edits.

   **Better alternative:** Pre-thread `pi` into ALL marketplace handler factories as a Wave-0 / Plan-18-00 cleanup, BEFORE Wave 1 starts. This decouples the `pi`-plumbing change from the V1->V2 notify migration. Planner judgment call.

2. **Update.ts callsite count drift (CONTEXT says 5, actual is 6).** CONTEXT canonical-refs section at line 126 lists 5 callsites; the actual file has 6 because line 220 (`updateAllMarketplaces` empty-targets case) is a separate `notifySuccess` callsite not enumerated in CONTEXT's count. Plan 18-05 must migrate ALL 6 (line 220 + 584 + 586 + 599 + 631 + 647). Not a blocker, but the planner should note the corrected count in the plan.

3. **`add.ts` user-visible behavior change (reload-hint appears in V2):** V1 add.ts emitted NO reload-hint per MA-11/RH-1 (comment at lines 31-32, 151). V2 catalog `<!-- catalog-state: github-source -->` and `<!-- catalog-state: path-source -->` both emit `\n\n/reload to pick up changes`. This is **deliberate** per D-16-12 (mp.status `"added"` is state-changing -> reload-hint fires). The current add.test.ts assertion at line 94 EXPLICITLY checks `note.message.includes("/reload to pick up changes") === false`; Plan 18-01 flips this to `true`. The user accepted the change at CONTEXT D-18-06's "Implicit consequence" callout.

4. **`update.ts` autoupdate-OFF reload-hint contract change:** V1 update.ts line 631 emitted bare `● <mp> [<scope>] (updated)` with NO trailing newline. V2 catalog `<!-- catalog-state: autoupdate-off-manifest-refresh -->` at `docs/output-catalog.md:803-806` emits `● <mp> [<scope>] (updated)\n\n/reload to pick up changes`. Existing update.test.ts at line 165 asserts only `notEqual(severity, "error")` -- doesn't check reload-hint presence. Plan 18-05 must ADD a reload-hint inclusion assertion to lock the new V2 contract (otherwise the silent change goes untested).

5. **`update.ts` cascade glyph flip (● -> ⊘ on `skipped`):** V1 `outcomeToCascadeRow` mapped `unchanged` -> `skipped` + `up-to-date` + ● glyph ("trivial skip"). V2 renderer's `renderPluginRow` `skipped` arm uses ⊘ glyph (per D-16-11 -> warning severity -> ⊘ for non-success-non-failure). Existing test at line 514-516 hard-codes `"  ● b [project]"` for `unchanged` (now `skipped {up-to-date}`). Plan 18-05 must flip this glyph in the assertion -- a subtle visual change the user may not expect. Cross-reference `tests/shared/notify-v2.test.ts` for the authoritative V2 byte string before flipping.

6. **`remove.ts` cleanup-leak code structurally dies if Option A applied.** Dropping the cleanup-leak `notifyWarning` per D-18-01 makes the `cleanupLeaks` accumulator (line 307), the `removePath(cleanupLeaks, ...)` helper invocations (lines 308-330), and the `appendLeaks` import (line 79) all candidates for deletion -- but the underlying `rm()` calls still need to happen for correctness. The plan must preserve the `rm()` invocations and only drop the user-visible notification; the `cleanupLeaks` array becomes a write-only sink (failures captured but never surfaced). The planner may choose to delete the array entirely AND swallow leaks silently, OR retain the array for future-proofing (e.g., future debug logging). Document the choice in the plan.

7. **`tests/orchestrators/marketplace/remove.test.ts` line 232 contract-name drift.** The test is named "MR-2 + MR-8 (RH-1): empty marketplace removed cleanly emits success WITHOUT reload hint". V2 emits the reload-hint per mp-level state change. The TEST NAME contradicts the V2 contract. Plan 18-04 must rename the test (e.g., "MR-2 + V2 D-16-12: empty marketplace removed cleanly emits success WITH mp-level reload-hint") AND flip the assertion. This is a test-rename-plus-flip, not just an assertion flip.

8. **Catalog UAT will FAIL during the migration window if orchestrator tests still construct V1 strings.** The catalog UAT at `tests/architecture/catalog-uat.test.ts:1328` runs as part of `npm run check`. It drives `notify()` against the FIXTURES map -- which is already V2-shaped (verified at lines 1085-1292). The catalog UAT does NOT consume orchestrator code -- it only reads `docs/output-catalog.md` and `notify()`. So the catalog UAT will stay GREEN throughout Phase 18 regardless of orchestrator migration progress. **However**, per-orchestrator tests (e.g., add.test.ts) DO call `addMarketplace` which still emits V1 strings until migration. Each per-file plan must land its orchestrator + test changes ATOMICALLY (same commit) to avoid a `npm run check` RED window.

9. **`composeErrorWithCauseChain` import in update.ts may stay used.** Line 92 imports `composeErrorWithCauseChain`; line 337 uses it inside `cascadeAutoupdates` to compose `outcome.notes`, which feeds non-notify consumers (test fixtures and downstream aggregation). Plan 18-05 must verify whether `notes` is still consumed after migration and keep this import if so. If `notes` becomes dead, the import goes too.

10. **`makeAutoupdateHandler` factory takes `enable: boolean`, not `pi`.** Line 88-89 in register.ts wire `makeAutoupdateHandler(true)` / `makeAutoupdateHandler(false)`. The current handler signature is `makeAutoupdateHandler(enable: boolean)`. Plan 18-02 must EITHER (a) change the signature to `makeAutoupdateHandler(pi: ExtensionAPI, enable: boolean)` and update both register.ts call sites OR (b) construct a closure that captures `pi` separately. (a) is cleaner.

## Sources

### Primary (HIGH confidence)
- Direct file reads of all 5 orchestrators, all 7 test files (add, autoupdate, list, remove, update, cascade, shared), `eslint.config.js`, `shared/notify.ts` (key sections), `docs/output-catalog.md` (marketplace sections 686-895), `tests/architecture/catalog-uat.test.ts` (marketplace fixtures 1085-1292) -- read 2026-05-26.
- `.planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-CONTEXT.md` (all 9 decisions + canonical refs).
- `.planning/REQUIREMENTS.md` (SNM-22 migration tracker).
- `.planning/ROADMAP.md` (Phase 18 goal + 4 success criteria; Phase 17.1 + 17.2 lineage).
- `.planning/STATE.md` (current position; Phase 17.2 just completed).
- `.planning/config.json` -- `nyquist_validation: true` confirmed.

### Secondary (MEDIUM confidence)
- N/A -- all material in this research is read directly from source.

### Tertiary (LOW confidence)
- N/A.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Plan frontmatter convention is `requirements: []` for execution phases (matching Phase 17.2 precedent) | Phase Requirements | Wrong frontmatter doesn't block execution but is detectable by plan-check; trivial fix. |
| A2 | The `register.ts` 3-line touch from Wave 2 plans won't merge-conflict because the line locations differ | Risk #1 | Higher merge friction; mitigation is to serialize the Wave 2 plans or pre-thread `pi` in Wave 0. |
| A3 | Option A (drop cleanup-leak warnings entirely) is the planner's correct choice for add.ts:141 and update.ts:599 -- not just remove.ts:354 (D-18-01) | Per-File Inventory | If planner picks Option B (keep some cache-leak signal), grammar amendment may be needed; deviation from D-18-01 precedent. |
| A4 | The `composeErrorWithCauseChain` import in update.ts:92 is still used after migration | Risks #9 | If dead, drop the import; otherwise keep. Verified by `outcome.notes` consumer trace. |
| A5 | The `makeAutoupdateHandler` factory signature change (option a: prepend `pi` arg) is acceptable to the user vs option b (closure capture) | Risks #10 | Either is correct; (a) is more idiomatic. |

## Open Questions

1. **Should Plan 18-01 (Wave 1 pilot) include a NotificationMessage construction recipe comment in `add.ts` that Wave 2 plans literally mirror?**
   - What we know: CONTEXT "Claude's Discretion" leaves this open.
   - Recommendation: YES -- include a 6-10 line block comment in add.ts above the `notify()` call documenting the construction pattern. Reduces drift across Wave 2's 4 parallel agents.

2. **Should `pi` plumbing be a separate Wave 0 / Plan 18-00 pre-cleanup?**
   - What we know: Plans 18-01..03 all need to add `pi: ExtensionAPI` to 3 different `*Options` interfaces AND change `register.ts` AND change 3 different `makeXHandler` factory signatures. Wave 2 parallelism is at risk if 18-02 and 18-03 both touch register.ts on different lines.
   - Recommendation: Defer to planner judgment. Two viable approaches:
     - (a) Inline -- each per-file plan owns its `pi` thread. Lower task count, but register.ts gets touched 3-4 times.
     - (b) Wave 0 -- a thin Plan 18-00 (or extension of 18-01) pre-threads `pi` through all 5 marketplace orchestrator interfaces and edge handlers + register.ts in one atomic commit, BEFORE Wave 1. Then per-file plans only swap V1 wrappers for V2 `notify()` calls.
   - The (b) approach is cleaner and matches Phase 16's "land infrastructure first" pattern. Cost: one extra plan.

3. **Does `outcome.notes` (update.ts, line 337) still have consumers after V2 migration?**
   - What we know: `outcome.notes` is populated by `composeErrorWithCauseChain(err)` for `PluginUpdateOutcome.notes`. In V2, the `cause?: Error` field on `PluginFailedMessage` carries the cause-chain directly, rendered by `renderPluginRow` at 4-space indent. The `notes` field may become a non-notify-consumer-only field (test fixtures, programmatic inspection).
   - Recommendation: KEEP the `composeErrorWithCauseChain` import and the `notes` population during Plan 18-05. Verify "notes consumer trace" after Plan 18-05 lands; if dead, delete in a follow-up.

4. **`docs/output-catalog.md:802` reload-hint on autoupdate-OFF manifest-refresh: deliberate or oversight?**
   - What we know: V1 update.ts arm at line 631 explicitly comments "no reload-hint trailer (catalog lines 659-666: the autoupdate-off case shows just the marketplace row)". V2 catalog at line 806 INCLUDES the reload-hint. This is per D-16-12's mp-level state-change ladder, but it contradicts the V1 rationale that "the manifest read is a bookkeeping refresh on the local clone, not a generated-resource update".
   - Recommendation: TAKE the V2 contract as-locked. The user accepted D-16-12 in Phase 16. Test 18-05 must lock this byte form.

## Environment Availability

Skipped: Phase 18 is a pure code/config change. No external tools, services, runtimes, or CLI utilities beyond the project's existing dependencies (Node ≥22, npm, isomorphic-git via Pi peer, write-file-atomic). All `npm run check` infrastructure already verified GREEN at end of Phase 17.2 (2026-05-26).

## Security Domain

Skipped: Phase 18 modifies user-output rendering only. No authentication, session management, access control, input validation, or cryptography concerns. The migration is an internal API refactor (V1 string-based -> V2 type-based); user-visible byte strings are governed by the Phase 17 catalog. No new attack surface introduced.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; all using existing Phase 15/16/17.1/17.2 contract.
- Architecture: HIGH -- D-18-01..09 fully resolved by direct source verification.
- Per-file callsites: HIGH -- every line number, function name, and import path verified against current source.
- Test surface: HIGH -- every byte-exact assertion identified and cross-referenced with V2 catalog fixtures.
- Pitfalls: HIGH -- all 10 landmines verified against current source (callsite count drift, glyph flip, reload-hint contract changes, `pi` plumbing gaps, etc.).

**Research date:** 2026-05-26
**Valid until:** 2026-06-26 (4 weeks; assumes no concurrent edits to `shared/notify.ts`, `eslint.config.js`, or the 5 marketplace orchestrators)

RESEARCH COMPLETE
