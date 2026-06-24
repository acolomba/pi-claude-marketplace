# Phase 1: Localized type model & command-context spine - Research

**Researched:** 2026-06-24
**Domain:** TypeScript discriminated-union refactor of a 3119-line notification monolith; output-neutral type-model reshape across 18 commands
**Confidence:** HIGH (the entire surface is internal code read directly this session; no external library claims are load-bearing)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** No central status/reason registry, no central `satisfies` value↔type drift gate. Each command owns its statuses and message shapes locally. A command cannot construct a message whose status it did not declare.
- **D-02:** `notify()` receives the command's `CommandContext` and its rows **at the call site** (roughly `notify(context, rows)`), not unioned from a central registry.
- **D-03:** The bidirectional `notify-types.test.ts` set-equality proofs are **deleted** — the central tuples they guarded are gone; per-command ownership makes drift a local compile error.
- **D-04:** Each command exposes a **`CommandContext`** (class-typed) const. Its **`Messaging`** member carries the **`label`** (human operation name, e.g. `"Plugin install"`, `"Marketplace add"`). The label is the one thing published horizontally. Nothing else is exposed centrally beyond what the context carries.
- **D-05:** **Shared naming convention (HARD REQUIREMENT).** Member/field names identical across every command: `CommandContext`, `Messaging`, `label`, `severity`, `needsReload`, `dependencies`.
- **D-06:** `severity`, `needsReload`, `dependencies` are part of the **base message structure common to all commands** — NOT per-command declarations. They live on the universal row/message shape.
- **D-07:** This phase introduces `severity`/`needsReload` as **optional** fields the Phase-1 reducer does **not** read (output byte-identical). Phase 2 flips reduction on. (Exact typing at planner discretion, constrained by output-neutrality.)
- **D-08:** **Statuses are command-internal.** Each command keeps its own status set privately; the notification system neither unions nor validates them centrally.
- **D-09:** **Reasons split:** shared reasons become **topic-grouped enums** (e.g. "unsupported components" group covering hooks/LSP/… soft-dep topics); command-specific reasons stay private. The closed `reasons` set is preserved for catalog stability (OUT-08).
- **D-10:** Each command renders its own rows via a **render map total over its OWN status set** — omitting an arm is a **compile error**. MOD-03's missing-arm-is-a-compile-error relocates from a central `Record<Status,RenderFn>` to per-command render maps.
- **D-11:** The **shared presentation vocabulary stays central** in `notify.ts`: `ICON_*` constants, `renderScopeBracket`, `composeReasons`, version/scope composers, row-composition primitives. Command render maps *call* these; they do not duplicate them.
- **D-12:** Cascade cardinality expressed via **tuple-vs-array typing**: single = 1-tuple (`[Row]`), plural = array (`Row[]`). The type system enforces cardinality directly; render-time row counting no longer determines it.
- **D-13:** **Migrate all 18 commands now.** Full cutover this phase.

### Claude's Discretion
- Exact typing mechanism for introducing optional `severity`/`needsReload` (D-07), provided output byte-identical and `catalog-uat` green.
- Whether `CommandContext` is literally a `class` vs interface + const factory — user said "class," planner picks the most idiomatic TS that keeps the `Messaging` member contract and shared naming (D-04/D-05); the contract (a command can't be wired without supplying `Messaging.label` and a total render map) must hold.
- The precise topic-group taxonomy for shared reasons (D-09), derived from the existing closed `REASONS` set.
- Internal file layout for command-local declarations (sibling module vs. co-located in orchestrator) — per-command, idiomatic, additive.

### Deferred Ideas (OUT OF SCOPE — do NOT plan, research, or implement)
- **Phase 2:** Reducer behavior (max-severity / OR-needsReload / tally), content-ladder deletions (`BENIGN_REASONS`/`allBenign`/`cascadeSeverity`/`shouldEmitReloadHint`), `present`→`installed` collapse, `disable-cascade` removal, GATE-01 architecture test.
- **Phase 3:** Summary surface redesign (leading severity sentence, trailing tally, always-rendered marketplace header) + atomic catalog supersession.
- **Phase 4:** Concern-module extraction (`appendHooksBlock`, soft-dep marker injection) and the ≤3-central-files / 0-`notify.ts`-edits open-closed proof.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOD-01 | Each command co-locates its own notification vocabulary (private status set, owned reasons, operation label via `CommandContext.Messaging`, per-status render map) — none hand-appended to central tuples in `notify.ts`. | §"What stays central vs. moves out" gives the exact dividing line by symbol+line; §"Per-command inventory" gives every command's status set and call sites; §"Architecture Patterns" gives the co-located module shape. |
| MOD-02 | No central status/reason registry; value/type drift caught at the command module; `notify()` receives `CommandContext` + rows at the call site; `notify-types.test.ts` proofs deleted. | §"The notify() signature reshape" traces the current 3-arg signature and the central lookups (severity/reload/summary) that must thread via context+rows; §"notify-types.test.ts deletion" confirms exactly what coverage is removed. |
| MOD-03 | Each command renders rows via a render map total over its OWN status set (missing arm = compile error), calling the shared presentation vocabulary that stays central. No central `switch`+`assertNever`. | §"Pattern 1: total per-command render map" gives the idiomatic `Record<Status, RenderFn>` mapped-type that makes a missing arm a TS2741/TS2741-class compile error; §"What stays central" confirms `ICON_*`/composers stay. |
| OUT-07 | Cascade cardinality structural in the type model (single vs plural), not inferred by counting rows at render time. | §"Cardinality: tuple-vs-array (D-12)" inventories every single vs plural call site and identifies the exact `.length`/`.filter().length` render-time counting that the typing replaces. |
| OUT-08 | (Per CONTEXT D-09) The closed `reasons` set is preserved for output-grammar/catalog stability. | §"Reasons split (D-09)" enumerates the full closed `REASONS` set membership (32 entries) and proposes topic groups while preserving the closed set byte-for-byte. |
</phase_requirements>

## Summary

The notification subsystem is a single 3119-line file, `extensions/pi-claude-marketplace/shared/notify.ts`, that owns every closed grammar tuple, every per-status message interface, two large discriminated unions (`PluginNotificationMessage` 16 arms, `MarketplaceNotificationMessage` 10 arms), the per-status renderer switches (`renderPluginRow`, `renderMpHeader`), the shared presentation vocabulary (`ICON_*`, `renderScopeBracket`, `renderVersion`, `composeVersionArrow`, `composeReasons`, `joinTokens`, `pluginRow`), and the severity/summary/reload ladders. All 18 commands construct message literals inline and pass the whole envelope to a single 3-argument entry point `notify(ctx, pi, message)`. The output contract is locked by two byte-equality gates: `tests/architecture/catalog-uat.test.ts` (114 fixtures, drives `notify()` and byte-compares against `docs/output-catalog.md`) and `tests/shared/notify-v2.test.ts` (4194-line per-status grammar mini-spec).

This phase is an **output-neutral type-model reshape**. The work is: (1) give every command a co-located `CommandContext` const carrying `Messaging.label`; (2) move each command's status set and per-status render map out of the central switches into the command's own module, typed so a missing arm is a compile error; (3) split the closed `REASONS` tuple into shared topic-grouped enums + command-private reasons while keeping the closed set byte-identical for the catalog; (4) add optional `severity`/`needsReload`/`dependencies` base fields the Phase-1 renderer ignores; (5) express cardinality via tuple-vs-array typing; and (6) reshape `notify()` to receive the command's `CommandContext` + rows at the call site instead of looking severity/reload/render up centrally. The bidirectional `notify-types.test.ts` proofs are deleted because the central tuples they guarded no longer exist.

**Primary recommendation:** Land a shared base-message type + `CommandContext` shape first (Wave 0), then migrate commands family-by-family (plugin, marketplace, reconcile/import) keeping `catalog-uat` and `notify-v2` green after every command. Use a total `Record<Status, RenderFn>` mapped type per command as the exhaustiveness anchor (the only TS construct that turns a missing render arm into a compile error). Keep the central `notify()` dispatcher delegating to per-command render maps so rendered bytes never change. Treat `notify()` signature evolution as the highest-risk task: 114 catalog fixtures + ~70 orchestrator call sites pass the current 3-arg form.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Notification type model (statuses, message shapes) | Command vertical (`orchestrators/<group>/<cmd>.ts` + co-located module) | — | D-01/D-08/D-10: statuses are command-internal; ownership moves to the command. |
| Operation label (`Messaging.label`) | Command vertical (`CommandContext` const) | Shared naming convention (D-05) | D-04: label is the one horizontally-published fact; applies across many plugins. |
| Shared presentation vocabulary (`ICON_*`, composers) | `shared/notify.ts` (central) | — | D-11: cross-cutting grammar primitives; command render maps call them. |
| `notify()` dispatch + envelope | `shared/notify.ts` (central) | — | The envelope/dispatcher is the single sanctioned `ctx.ui.notify` site (IL-2, eslint BLOCK A). |
| Closed reasons set (catalog stability) | `shared/notify.ts` (shared enums) + command-private (specific) | — | D-09/OUT-08: shared reasons topic-grouped centrally; specific reasons private; closed set preserved. |
| Rendered byte output (the user contract) | `catalog-uat` + `notify-v2` gates | — | GATE-02/GATE-03: byte-equality is the end-to-end correctness anchor; unchanged this phase. |

## Standard Stack

This phase adds **zero new dependencies**. It is a pure TypeScript type-model refactor of existing in-repo code. The relevant existing toolchain (verified from `package.json` this session):

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (strict) | `tsc --noEmit` via `npm run typecheck` | Compile-time exhaustiveness is the entire enforcement mechanism (D-10) | Already the project's typecheck gate. `[VERIFIED: package.json scripts.typecheck]` |
| `node:test` (built-in) | bundled, Node `>=20.19.0` | Test runner for `catalog-uat`, `notify-v2`, `notify-grammar-invariant` | `[VERIFIED: package.json scripts.test, engines.node]` |
| eslint (flat config) | `npm run lint` | BLOCK A forbids direct `ctx.ui.notify` outside `shared/notify.ts` | `[VERIFIED: eslint.config.js BLOCK A lines 84–140]` |
| prettier | `npm run format:check` | Byte-stable formatting; part of `npm run check` | `[VERIFIED: package.json scripts.check]` |

**`npm run check`** = `typecheck && lint && format:check && test && test:integration` `[VERIFIED: package.json:71]`. This is GATE-03 and must stay green at the phase boundary.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Total `Record<Status, RenderFn>` mapped type per command (D-10 anchor) | Relocated `switch` + `assertNever` per command | A `switch` in a command module CAN be exhaustive via `assertNever`, but a `Record<Status, Fn>` over the command's literal union is more declarative and directly maps to "render map" wording; both make a missing arm a compile error. Planner's call. |
| `class CommandContext` (user's word) | `interface` + `const` factory | Discretion D-04. A `const` object literal `satisfies CommandContext` is the most idiomatic TS for a value that's mostly data (`label`) + a render map; a `class` adds ceremony without behavior. Either satisfies "can't be wired without `Messaging.label` + total render map." |

**Installation:** None.

## Package Legitimacy Audit

> Not applicable — this phase installs **zero external packages**. It is an internal TypeScript refactor. No registry, slopcheck, or postinstall verification is required.

## The notify() signature reshape (RQ-1, MOD-02)

### Current signature and central lookups

`[VERIFIED: notify.ts:2987]` The sole public state-change entry point is:

```ts
export function notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void
```

`message` is the **whole envelope** — a top-level discriminated union `NotificationMessage` `[VERIFIED: notify.ts:1260]` whose arms are either a `CascadeNotificationMessage` (`{ kind?: "cascade" | "disable-cascade"; marketplaces: readonly MarketplaceNotificationMessage[] }`, `notify.ts:1018`) or one of seven standalone `kind`-tagged variants (info surfaces, `marketplace-not-added`, `reconcile-pending-empty`, `reconcile-applied-cascade`).

Inside `notify()`, the central lookups that today derive everything **from message contents** (not from any caller intent) are:

| Central derivation | Symbol / line | What it inspects | Phase-1 disposition |
|--------------------|---------------|------------------|---------------------|
| Soft-dep probe | `softDepStatus(pi)` `notify.ts:2996` | host extension load state | STAYS central (threaded into render maps) |
| Standalone-vs-cascade routing | `isInfoKind` `notify.ts:1299` | `message.kind` | STAYS central (the dispatcher) |
| Severity | `computeSeverity` → `cascadeSeverity` `notify.ts:2084,2134` | row statuses + `allBenign(reasons)` | Phase-1 UNCHANGED (still content-derived); Phase 2 flips to caller-stamped |
| Summary line | `buildSummaryLine` `notify.ts:2304` | counts of failed/skipped rows | Phase-1 UNCHANGED |
| Reload hint | `shouldEmitReloadHint` `notify.ts:2386` | row statuses + cascade `kind` | Phase-1 UNCHANGED |
| Per-row render | `renderPluginRow` `notify.ts:1798`, `renderMpHeader` `notify.ts:1462` | `p.status` switch | MOVES OUT to per-command render maps (D-10) |

**The key reshape (D-02):** today the command publishes nothing to `notify()` except the message contents. After this phase, the command threads its `CommandContext` (carrying `Messaging.label` and the command's render map) into `notify()` at the call site. The render dispatch (`renderPluginRow`/`renderMpHeader` central switches) is replaced by calling the per-command render map carried on the context. **Phase 1 keeps severity/summary/reload content-derived** (those ladders are Phase 2 deletions); the label is introduced now but the summary surface that consumes it lands in Phase 3 — so Phase 1 must thread the label without changing any rendered byte.

> **Planner tension to resolve (HIGH priority):** `notify(context, rows)` is the *target* shape, but there are **114 catalog-uat fixtures** (`message:` payloads, `catalog-uat.test.ts`) and **~70 orchestrator call sites** (enumerated below) all passing the current `notify(ctx, pi, message)` form. The signature change touches every one. The planner must choose: (a) a new entry point that takes `(ctx, pi, context, rows)` with the old `notify` kept as an adapter that synthesizes the envelope (lower blast radius, output-neutral), or (b) a hard cutover of all call sites + all fixtures in one wave. Given output-neutrality and the 114-fixture gate, the adapter-then-migrate path is lower risk. Either way, `catalog-uat` and `notify-v2` must stay green throughout.

### Two end-to-end traces (verified this session)

**Install** `[VERIFIED: install.ts:1128,1168,1194,1222,1375 + MESSAGING-COUPLING.md A.4]`: `makeInstallHandler` (edge) → `installPlugin` (`orchestrators/plugin/install.ts`). The orchestrator builds `PluginInstalledMessage`/`PluginFailedMessage`/`PluginUnavailableMessage` literals inline (`status: "installed"|"failed"|"unavailable"`, plus a `marketplace-not-added` standalone at `install.ts:~1194`) and calls `notify(ctx, pi, { marketplaces: [{ ..., plugins: [...] }] })`. The status literal type-checks against the central `PluginNotificationMessage` union; the renderer arm is `renderPluginRow` `case "installed"` (`notify.ts:1809`). After reshape: install owns statuses `{installed, failed, unavailable}` + a render map total over them; `notify` is handed install's `CommandContext`.

**Marketplace add** `[VERIFIED: add.ts:469,557 + MESSAGING-COUPLING.md A.4]`: `makeAddHandler` → `addMarketplace`. Success builds `{ status: "added", name, plugins: [] }`; failure builds `{ status: "failed", reasons: [reason], plugins: [] }` where `reason` comes from the `classifyAddError` map (`add.ts`) returning closed-set `ContentReason` values (`"duplicate name"`, `"stale clone"`, …). The `failed` mp arm renders via `renderMpHeader` `case "failed"` (`notify.ts:1470`). After reshape: add owns mp-statuses `{added, failed}` + its private reasons (`duplicate name`, `stale clone`) and the shared reasons it references; render map total over its mp-statuses.

## Per-command inventory (RQ-2, MOD-01)

The 18 commands (`[VERIFIED: router.ts:55–85 SubcommandHandlers + *_SUBCOMMANDS; register.ts:78–97 wiring]`). Status sets below cross-referenced against `PLUGIN_STATUSES`/`MARKETPLACE_STATUSES` and the orchestrator `status:` literals grepped this session (some grep hits like `converged`/`partial`/`enabled` are domain-internal outcome objects, NOT notification statuses — the notification status sets are the intersection with the closed tuples).

| # | Command | Handler field | Orchestrator file | Notification statuses it emits | notify() call sites (file:line) | Reasons it uses |
|---|---------|---------------|-------------------|-------------------------------|----------------------------------|-----------------|
| 1 | bootstrap | `bootstrap` | `orchestrators/plugin/bootstrap.ts` (delegates to marketplace add + autoupdate) | (delegated — emits via add/autoupdate) | (via delegated commands) | (delegated) |
| 2 | install | `install` | `orchestrators/plugin/install.ts` | `installed`, `failed`, `unavailable`; standalone `marketplace-not-added` | `install.ts:1128,1168,1194,1222,1375` | `invalid manifest`, `orphan rewake`, soft-dep markers |
| 3 | uninstall | `uninstall` | `orchestrators/plugin/uninstall.ts` | `uninstalled`, `failed` | `uninstall.ts:225,258,296,626` | `not installed`, `permission denied`, `source missing`, … |
| 4 | update | `update` | `orchestrators/plugin/update.ts` | `updated`, `skipped`, `failed` | `update.ts:213,376,1436,1696,1758,1895` | `up-to-date`, `concurrently updated`, … |
| 5 | reinstall | `reinstall` | `orchestrators/plugin/reinstall.ts` | `reinstalled`, `skipped`, `failed`, `manual recovery` | `reinstall.ts:288,300,368,403,481,501,761` | `rollback partial`, `source mismatch`, … |
| 6 | list | `list` | `orchestrators/plugin/list.ts` | `present`, `available`, `unavailable`, `upgradable`, `disabled`, `failed` (list-surface) | `list.ts:852,890` | `no longer installable`, `unsupported source`, soft-dep |
| 7 | info (plugin) | `pluginInfo` | `orchestrators/plugin/info.ts` | standalone `plugin-info`, `plugin-info-cascade`, `marketplace-not-added`; embedded row statuses `installed/available/unavailable/failed` | `info.ts:987,1000,1016,1048,1050,1062,1067` | `not in manifest`, `unreadable manifest`, … |
| 8 | pending | `pending` | `orchestrators/reconcile/pending.ts` | `will install/uninstall/enable/disable` (plugin), `will add/will remove` (mp), `failed`; standalone `reconcile-pending-empty` | `pending.ts:183,203` | (pending rows are reasons-less, except `failed`) |
| 9 | enable | `enable` | `orchestrators/plugin/enable-disable.ts` | `installed` (re-enable), `skipped`, `failed` | `enable-disable.ts:432,599,678,825` | `already enabled` |
| 10 | disable | `disable` | `orchestrators/plugin/enable-disable.ts` | `disabled`, `skipped`, `failed` (+ `disable-cascade` kind) | (same file) | `already disabled` |
| 11 | import | `import` | `orchestrators/import/execute.ts` | `added`, `installed`, `updated`, `skipped`, `unavailable`, `failed` (mixed-subject cascade) | `execute.ts:1041` | many shared |
| 12 | marketplace add | `marketplaceAdd` | `orchestrators/marketplace/add.ts` | `added`, `failed` | `add.ts:469,557` | `duplicate name`, `stale clone`, `unsupported source`, `lock held` |
| 13 | marketplace remove | `marketplaceRemove` | `orchestrators/marketplace/remove.ts` | `removed`, `failed`, `uninstalled` (child rows); partial | `remove.ts:314,583,738` | `plugins remain`, `permission denied` |
| 14 | marketplace list | `marketplaceList` | `orchestrators/marketplace/list.ts` | list-surface (status-omitted `MpList`) | `list.ts:96` | (none — inventory) |
| 15 | marketplace info | `marketplaceInfo` | `orchestrators/marketplace/info.ts` | standalone `marketplace-info`, `marketplace-info-cascade`, `marketplace-not-added` | `info.ts:161,184,186,194` | (info surface) |
| 16 | marketplace update | `marketplaceUpdate` | `orchestrators/marketplace/update.ts` (+ `shared.ts`) | `updated`, `skipped`, `failed` | `update.ts:253,795,852,858,875,889`; `shared.ts:549,563` | `up-to-date`, `network unreachable`, `not added` |
| 17 | marketplace autoupdate | `marketplaceAutoupdate` | `orchestrators/marketplace/autoupdate.ts` | `autoupdate enabled`, `skipped`, `failed` | `autoupdate.ts:201,209,495,508,559` | `already autoupdate` |
| 18 | marketplace noautoupdate | `marketplaceNoautoupdate` | `orchestrators/marketplace/autoupdate.ts` (shared, boolean flag) | `autoupdate disabled`, `skipped`, `failed` | (same file) | `already no autoupdate` |

**Load-time (not a slash command but a cascade producer):** `orchestrators/reconcile/apply.ts:856` emits `reconcile-applied-cascade`; `orchestrators/reconcile/notify.ts` and `apply-outcomes.ts` build the mp/plugin rows. These reuse the same per-status shapes (RECON-04) and must also migrate their render dispatch, but are not one of the 18 user commands.

**Modules importing `notify` directly** `[VERIFIED: grep]`: `marketplace/{autoupdate,remove,shared,list,info,update}.ts`, `plugin/{install,uninstall,update,reinstall,enable-disable,list,info}.ts`, `import/execute.ts`, `reconcile/{apply,pending}.ts`. (bootstrap delegates.)

## What stays central vs. moves out (RQ-3, MOD-03, D-11)

Precise dividing line by symbol and line in `shared/notify.ts`:

### STAYS central (shared presentation vocabulary — D-11)
| Symbol | Line | Why |
|--------|------|-----|
| `ICON_INSTALLED` `●`, `ICON_AVAILABLE` `○`, `ICON_UNINSTALLABLE` `⊘`, `ICON_DISABLED` `◌` | `notify.ts:1323–1336` | Shared glyph vocabulary; render maps reference these. |
| `joinTokens` | `notify.ts:1590` | Empty-slot-suppressing join primitive. |
| `renderScopeBracket` | `notify.ts:1663` | Orphan-fold scope-bracket policy (single source). |
| `renderVersion`, `formatHashVersionForDisplay`, `looksLikeHashVersion`, `composeVersionArrow` | `notify.ts:1602–1685` | Version composition (incl. PI-7 hash short-SHA). |
| `composeReasons` | `notify.ts:1706` | Reasons-brace + soft-dep marker injection. |
| `pluginRow` | `notify.ts:1776` | Folds the 4 structurally-identical scope+reasons rows. |
| `truncateDescription`, `wrapDescription` | `notify.ts:1345,1378` | Description column-66 / hard-wrap. |
| `redactAbsolutePaths`, `renderIndentedCauseChain`, `composeRollbackPartialLines`, `collectManualRecoveryLeaks`, `composePluginLines`, `composeMarketplaceBlock` | `notify.ts:244,2447,2463,2488,2513,~2879` | Shared multi-line composition primitives. |
| `notify()` envelope + dispatcher, `isInfoKind`, `dispatchInfoMessage`, `emitWithSummary` | `notify.ts:2987,1299,2935,2919` | The single sanctioned `ctx.ui.notify` site + standalone routing. |
| `compareByNameThenScope`, `makeRawNotifyFn`, `notifyUsageError`, `notifyDiagnostic`, `notifyAsyncRewakeSummary` | `notify.ts:3087,3109,349,372,397` | Cross-cutting helpers; unrelated to per-command grammar. |
| `MarketplaceDetails`, `HookSummaryEntry`/`HookSummary`/`ClaudeHookEvent`, `MpCommon` | `notify.ts:530,198–221,873` | Genuinely shared payload shapes (info surface, soft-dep). |

### MOVES OUT to per-command modules (MOD-01/03, D-08/D-10)
| Central construct | Line | Moves to |
|-------------------|------|----------|
| `renderPluginRow` 16-arm switch | `notify.ts:1798–1977` | Per-command render maps (each total over its OWN status subset). |
| `renderMpHeader` 10-arm switch | `notify.ts:1462–1566` | Per-(marketplace-)command render maps. |
| Per-variant `Plugin*Message` interfaces | `notify.ts:590–834` | Co-located with the owning command (the command declares its own message shapes). |
| Per-variant `Mp*` interfaces | `notify.ts:880–964` | Co-located with the owning marketplace command. |
| `PluginNotificationMessage` / `MarketplaceNotificationMessage` unions | `notify.ts:844,975` | Become a union assembled from command-local shapes (or kept as the envelope's row type; planner's structural call — D-01 forbids a *registry*, not a row-type union). |
| `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` / `STATUS_TOKENS` tuples | `notify.ts:450,479,275` | Each command's `as const` status tuple in its own module (D-08). |

### Reasons split (D-09, RQ-5, OUT-08)
| Construct | Line | Disposition |
|-----------|------|-------------|
| `REASONS` (32 entries) | `notify.ts:72–113` | SPLIT into shared topic-grouped enums + command-private reasons; **closed set preserved byte-identical** for the catalog (OUT-08). |
| `ContentReason = Exclude<Reason, "not added">` | `notify.ts:127` | Preserve the exclusion semantics; `"not added"` stays the structural marker. |
| `DEPENDENCIES` (`agents`/`mcp`), `SOFT_DEP_MARKER_*` | `notify.ts:498,1582` | STAY (soft-dep concern is cross-cutting; full extraction is Phase 4). |

## Cardinality: tuple-vs-array (D-12, OUT-07, RQ-4)

**How cardinality is determined today (render-time row counting that gets replaced):**
- `blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n")` `[VERIFIED: notify.ts:3036]` — array length decides the empty sentinel.
- `countFailedRows` / `countSkippedRows` use `mp.plugins.filter(...).length` and `.some(...)` over arrays `[VERIFIED: notify.ts:2202–2244]`.
- `cascadeSeverity` uses `.some()` over `message.marketplaces[]` and `mp.plugins[]` `[VERIFIED: notify.ts:2094–2120]`.

**Single-cascade (1-tuple `[Row]`) call sites today** (literal single-element arrays):
- `install.ts:1128,1168,1222` → `marketplaces: [{ ..., plugins: [failureMessage] }]` `[VERIFIED]`
- `add.ts:469` → `marketplaces: [{ status: "failed", plugins: [] }]`; `add.ts:557` → `marketplaces: [{ status: "added", plugins: [] }]` `[VERIFIED]`
- `marketplace/shared.ts:549` → `{ kind: "marketplace-not-added", name }` (single subject)
- `plugin/list.ts:890` → `marketplaces: [mp]` (single)

**Plural (array `Row[]`) call sites today:**
- `plugin/list.ts:852`, `marketplace/list.ts:96`, `import/execute.ts:1041`, `plugin/update.ts:1696`, `reinstall.ts:761`, `autoupdate.ts:559`, `reconcile/apply.ts:856` → `marketplaces` is a variable-length array built from a loop.

**D-12 reshape:** a command that structurally always emits exactly one marketplace/plugin row (single-target ops: `install`, `marketplace add`) types its row slot as a 1-tuple `readonly [Row]`; bulk ops (`list`, `update` cascade, `import`, `reconcile`) type it as `readonly Row[]`. **Phase-1 caveat:** the *rendered output* must not change — the 1-tuple still renders identically; only the type narrows. The render-time `.length`/`.filter().length` counting in the severity/summary ladders is NOT removed this phase (that is Phase 2's reducer work) — D-12 adds the structural typing, and the ladders continue to work over arrays (a 1-tuple IS an array at runtime). Confirm with the planner that this is additive typing, not a ladder rewrite.

## Architecture Patterns

### System Architecture Diagram

```
 18 command orchestrators (vertical slices)
 ┌─────────────────────────────────────────────────────────────┐
 │ orchestrators/<group>/<cmd>.ts                               │
 │   • CommandContext const  { Messaging: { label }, render }   │  ← NEW (D-04/D-05)
 │   • command-private status tuple (as const)                  │  ← MOVED OUT (D-08)
 │   • command-private reasons + referenced shared reasons      │  ← SPLIT (D-09)
 │   • render map: Record<Status, RenderFn> (TOTAL)             │  ← MOVED OUT (D-10)
 │   • builds rows (each carries optional severity/needsReload) │  ← NEW base fields (D-06/07)
 └──────────────────────────────┬──────────────────────────────┘
                                 │ notify(ctx, pi, context, rows)   ← reshaped (D-02)
                                 ▼
 shared/notify.ts (central — STAYS)
 ┌─────────────────────────────────────────────────────────────┐
 │ notify() envelope + dispatcher (isInfoKind routing)          │
 │ calls the command's render map, which calls shared vocab:    │
 │   ICON_*, renderScopeBracket, renderVersion, composeReasons, │  ← D-11 stays central
 │   joinTokens, pluginRow, composeVersionArrow                 │
 │ severity/summary/reload ladders (content-derived — Phase 1   │
 │   UNCHANGED; deleted in Phase 2)                             │
 └──────────────────────────────┬──────────────────────────────┘
                                 ▼  exactly one ctx.ui.notify(string, severity?)
                          host  ctx.ui.notify  (IL-2, eslint BLOCK A)

 GATES (unchanged this phase): catalog-uat byte-equality (114 fixtures) +
 notify-v2 grammar mini-spec + notify-grammar-invariant
```

### Recommended Project Structure (additive, per-command — D-04 discretion)
```
orchestrators/plugin/install.ts          # orchestrator (existing)
orchestrators/plugin/install.messaging.ts # NEW: CommandContext + statuses + render map (sibling module — recommended)
  └─ or co-located in install.ts if small; planner's layout call (D-04 discretion)
shared/notify.ts                          # STAYS: vocabulary + envelope + dispatcher
shared/notify-reasons.ts (optional)       # shared topic-grouped reason enums (D-09)
```

### Pattern 1: Total per-command render map (the D-10 exhaustiveness anchor)
**What:** A `Record<CommandStatus, RenderFn>` over the command's OWN `as const` status literal union. Omitting a key for a declared status is a compile error (TS2741 "Property X is missing"), exactly preserving the central `assertNever` guarantee but localized.
**When to use:** Every command's render map.
**Example:**
```ts
// install.messaging.ts (illustrative — NOT verified output; planner finalizes)
const INSTALL_STATUSES = ["installed", "failed", "unavailable"] as const;
type InstallStatus = (typeof INSTALL_STATUSES)[number]; // the (typeof X)[number] idiom, used ~16x in notify.ts

type RenderFn<M> = (row: M, probe: SoftDepStatus, mpScope: Scope) => string;

// Missing an arm => TS2741 at this object literal. Extra arm => TS2353.
const INSTALL_RENDER: { [K in InstallStatus]: RenderFn<Extract<InstallMsg, { status: K }>> } = {
  installed: (p, probe, mpScope) =>
    joinTokens([ICON_INSTALLED, p.name, renderScopeBracket(p.scope, mpScope),
                renderVersion(p.version), "(installed)",
                composeReasons(p.reasons, p.dependencies.includes("agents"),
                               p.dependencies.includes("mcp"), probe)]),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
  unavailable: (p, probe, mpScope) => /* ... */,
};
```
Source pattern basis: `[VERIFIED: notify.ts:1809 installed arm, :1905 failed arm, :1798 renderPluginRow switch]` — the render bodies are LIFTED verbatim from the existing switch arms so bytes do not change.

### Pattern 2: CommandContext shape (D-04/D-05)
**What:** A const per command carrying `Messaging.label` and the render map, with identical member names everywhere.
**Example:**
```ts
// Shared shape (central type, not a registry — D-01 forbids a registry of contributions, not a shared interface)
interface CommandContext<Status extends string, Msg> {
  readonly Messaging: { readonly label: string };
  readonly render: { [K in Status]: RenderFn<Extract<Msg, { status: K }>> };
}

export const INSTALL_CONTEXT = {
  Messaging: { label: "Plugin install" },   // D-04: the one horizontally-published fact
  render: INSTALL_RENDER,
} as const satisfies CommandContext<InstallStatus, InstallMsg>;
```
The `satisfies` here pins the const to the shared shape **without** centralizing the statuses (D-01-compliant: there is no central union of all commands' statuses — each `satisfies` is local to the command).

### Pattern 3: Optional base fields introduced output-neutrally (D-06/D-07)
**What:** Add `severity?`, `needsReload?`, `dependencies?` to the universal row base. Phase-1 renderer never reads `severity`/`needsReload`, so output is byte-identical.
**Why output-neutral:** the existing message shapes already carry optional fields (`scope?`, `version?`, `reasons?`) `[VERIFIED: notify.ts:594–596, 632–634]`; adding more optionals follows the same pattern. `dependencies` already exists as REQUIRED on `installed/updated/reinstalled` `[VERIFIED: notify.ts:593,609,620]` — D-06 makes it part of the universal base; the planner must reconcile "required on 3 variants today" vs "optional base field" without changing rendered bytes (the render map for those 3 statuses still reads it).

### Anti-Patterns to Avoid
- **Touching rendered byte output.** Any change to icon constants, token spacing, brace composition, or join order will trip `catalog-uat` (114 fixtures) or `notify-v2`. Lift render bodies verbatim.
- **Building a central registry / `satisfies`-pinned value↔type union of all commands' statuses.** Explicitly forbidden (D-01). Each command's `satisfies` is local.
- **Reading `severity`/`needsReload` in the Phase-1 renderer.** They are inert this phase (D-07). Reading them is a Phase-2 behavior change.
- **Collapsing `present`→`installed`, removing `disable-cascade`, deleting `BENIGN_REASONS`/ladders.** All Phase 2. Out of scope.
- **Mutating the closed `REASONS` membership.** D-09/OUT-08 require it byte-stable; only its *organization* (topic enums vs private) changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exhaustiveness over a command's statuses | A runtime `if/throw` "did I cover all statuses" check | `Record<Status, RenderFn>` mapped type (compile-time TS2741) | D-10 wants a *compile* error, not a runtime one. The type system already does this. |
| Scope bracket / version / reasons composition in a command module | Re-implementing brace/space logic per command | Central `renderScopeBracket`/`renderVersion`/`composeReasons` (D-11) | Re-implementing risks byte drift vs catalog. These are the single source. |
| Cardinality detection | Counting `rows.length` at render time | Tuple-vs-array typing (D-12) | The type already encodes single-vs-plural; counting is what D-12 removes (structurally). |
| Drift detection between status tuple and message variants | A new bidirectional `extends` proof test | Local construction: a command literally cannot build a message whose status it didn't declare (D-01/D-02) | The whole point of localization — the proof becomes a local compile error, so the test is deleted (D-03). |

**Key insight:** every "custom solution" temptation in this phase is already solved by either the TypeScript type system (exhaustiveness, drift) or the existing central vocabulary (byte-stable composition). The work is *relocation and threading*, not invention.

## Runtime State Inventory

> This is a code/type-model refactor with **no stored data, no live-service config, no OS-registered state, no secrets, no build artifacts** affected. It is in-repo TypeScript only.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified: notification statuses/reasons are render-time literals, not persisted. (Persistence uses its own typebox schemas in `persistence/*`, untouched.) | None |
| Live service config | None — verified: no external service stores notification vocabulary. | None |
| OS-registered state | None — verified: no task/launchd/systemd references to notification types. | None |
| Secrets/env vars | None — verified: no env var names reference statuses/reasons. | None |
| Build artifacts | None — pure `.ts` edits; `tsc --noEmit` typecheck only, no emitted package. | None |

**The canonical question — after every file is updated, what runtime systems still cache the old shape?** Answer: none. The only "cached contract" is the **catalog byte fixtures** (`docs/output-catalog.md` + `catalog-uat`), which are *intentionally* unchanged this phase (output-neutral) and serve as the regression gate, not a migration target.

## Common Pitfalls

### Pitfall 1: Rendered-byte drift during render-map relocation
**What goes wrong:** Lifting a `renderPluginRow` arm into a command module but subtly reordering `joinTokens` args or changing a label literal.
**Why it happens:** The arms are verbose and structurally similar; copy-paste edits introduce one-token differences.
**How to avoid:** Lift each arm verbatim (the bodies at `notify.ts:1809–1971` and `:1464–1556` are the source of truth). Run `catalog-uat` + `notify-v2` after each command.
**Warning signs:** A single `catalog-uat` fixture fails with a one-character diff.

### Pitfall 2: The notify() signature change rippling into 114 fixtures + ~70 call sites at once
**What goes wrong:** A big-bang signature change leaves both the gate fixtures and the producers red simultaneously, making it impossible to bisect which command broke.
**Why it happens:** `notify(ctx, pi, message)` is called everywhere; changing it touches every producer and every test fixture.
**How to avoid:** Introduce the reshaped entry point alongside the existing one (adapter), migrate command-by-command, keep gates green between commands. Only remove the old entry point once all 18 + reconcile/import are migrated.
**Warning signs:** `npm run typecheck` reports errors in >1 command family at once.

### Pitfall 3: Accidentally enabling Phase-2 behavior
**What goes wrong:** Wiring `severity`/`needsReload` into the renderer or summary while "it's right there."
**Why it happens:** The fields are introduced this phase but consumed next phase; the temptation to "finish the wiring" is strong.
**How to avoid:** Treat D-07 literally — the fields are inert. The reducer that reads them is Phase 2 and gated by GATE-01 (a Phase-2 deliverable). Output-neutrality is the test.
**Warning signs:** Any `catalog-uat` fixture's *severity arg* changes, or a fixture's body gains/loses the reload trailer.

### Pitfall 4: `dependencies` base-field reconciliation
**What goes wrong:** D-06 says `dependencies` is a universal base field, but today it's REQUIRED on exactly 3 variants (`installed`/`updated`/`reinstalled`) and ABSENT on the rest (uninstalled forbids the soft-dep marker, `notify.ts:626`).
**Why it happens:** Promoting a required-on-3 field to an optional base field can change which rows can carry soft-dep markers.
**How to avoid:** Keep the soft-dep marker injection gated exactly as today (only the 3 dep-bearing render arms pass `p.dependencies.includes(...)` to `composeReasons`; the other arms pass `false`, `notify.ts:1878–1970`). The base field can be optional; the *render* still only consults it on those 3 statuses.
**Warning signs:** A `requires pi-subagents`/`requires pi-mcp` marker appears on an uninstalled/available row in `catalog-uat`.

## Reasons split detail (D-09, OUT-08) — closed REASONS membership

`[VERIFIED: notify.ts:72–113]` The full closed set (32 entries), with a proposed topic grouping (planner finalizes the taxonomy — discretion):

**Shared idempotent / no-op (topic: "already in requested state"):** `up-to-date`, `already installed`, `already autoupdate`, `already no autoupdate`, `already enabled`, `already disabled`. (These are today's `BENIGN_REASONS` set, `notify.ts:140` — note: the *set* is a Phase-2 deletion, but the *reason literals* stay in the closed set.)

**Shared "unsupported components" / soft-dep (topic group the user named explicitly):** `unsupported hooks`, `lsp`, `requires pi-subagents`, `requires pi-mcp`, `unsupported source`, `no longer installable`.

**Shared failure-class (topic: "operation could not complete"):** `permission denied`, `source missing`, `network unreachable`, `unreadable`, `unparseable`, `unreadable manifest`, `invalid manifest`, `not in manifest`, `rollback partial`, `lock held`, `source mismatch`, `concurrently uninstalled`, `concurrently updated`.

**Command-specific (stay private to the owning command):** `duplicate name` (add), `stale clone` (add), `not found`, `not installed` (uninstall), `plugins remain` (mp remove), `orphan rewake` (install), `not added` (structural marketplace-absent marker — NOT a `ContentReason`, `notify.ts:127`).

**Constraint:** whatever the grouping, the *union of all groups + privates* must equal today's 32-entry closed set exactly so `catalog-uat` and the catalog status-token tables stay byte-stable (OUT-08).

## State of the Art

| Old (current monolith) | New (this phase) | Impact |
|------------------------|------------------|--------|
| Central `renderPluginRow`/`renderMpHeader` switches with `assertNever` | Per-command `Record<Status, RenderFn>` total maps | Missing-arm exhaustiveness localizes (D-10). |
| Whole-envelope `notify(ctx, pi, message)` | `notify(context, rows)` with per-command `CommandContext` | Command owns vocabulary; no central lookup (D-02). |
| Central `PLUGIN_STATUSES`/`REASONS` tuples + bidirectional proof tests | Command-local status tuples; shared reasons topic-grouped; proofs deleted | Drift becomes a local compile error (D-01/D-03). |
| Cardinality inferred by `array.length` at render | Tuple-vs-array typing | Structural cardinality (D-12). |

**Deprecated/removed by this phase:** `tests/architecture/notify-types.test.ts` (the bidirectional set-equality + length-lock proofs — D-03). See deletion analysis below.

## notify-types.test.ts deletion — what coverage is removed (D-03)

`[VERIFIED: notify-types.test.ts:1–220]` The file asserts, purely at compile time:
1. `PluginStatus` ⇄ `PluginNotificationMessage["status"]` set-equality (forward + backward `extends`).
2. Tuple length-locks: `PLUGIN_STATUSES.length extends 16`, `MARKETPLACE_STATUSES.length extends 9`, `STATUS_TOKENS.length extends 22`, `DEPENDENCIES.length extends 2`, `REASONS.length extends 32`.
3. Exact literal-set membership (`_PluginStatusExpected extends PluginStatus` and back).
4. (Lower in the file) per-variant field-presence `@ts-expect-error` blocks (e.g. `failed` has `cause?`, `installed` does not).

**Why it's safe to delete (D-03 rationale):** items 1–3 guard the *central tuples*, which no longer exist after localization — there is no `PLUGIN_STATUSES` union to drift from `PluginNotificationMessage`. Item 4 (field-presence) **travels with the message interface** to the command module; if the planner wants to keep field-presence guards, they relocate as co-located `@ts-expect-error` blocks per command. **What replaces it:** nothing central is needed — a command cannot construct a message whose status it didn't declare (D-01), and the total render map (D-10) catches a missing render arm. The byte-equality gates (`catalog-uat`, `notify-v2`, `notify-grammar-invariant`) remain the behavioral coverage.

**`notify-grammar-invariant.test.ts` SURVIVES** `[VERIFIED: file header lines 1–25]` — it tests `notify()` *output behavior* (summary first-line grammar), not the type tuples. It is output-neutral and must stay green.

## Validation Architecture

> nyquist_validation: enabled (no `workflow.nyquist_validation: false` found in config this session). Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in), Node `>=20.19.0` `[VERIFIED: package.json]` |
| Config file | none — globs in `package.json` scripts |
| Quick run command | `node --test "tests/architecture/catalog-uat.test.ts" "tests/shared/notify-v2.test.ts" "tests/architecture/notify-grammar-invariant.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format:check + test + test:integration) |

### Phase Requirements → Test Map
| Req ID | Behavior to validate | Test type | Automated command | Exists? |
|--------|----------------------|-----------|-------------------|---------|
| MOD-01 | Each command co-locates statuses/reasons/label/render map | typecheck-as-proof (compiles only if local) + structural | `npm run typecheck` | ✅ (typecheck) |
| MOD-02 | `notify()` takes context+rows; no central registry; drift is local compile error | typecheck-as-proof | `npm run typecheck` | ✅ |
| MOD-02 | `notify-types.test.ts` proofs deleted | absence check | file removed | ✅ (delete the file) |
| MOD-03 | Render map total over command's statuses (missing arm = compile error) | typecheck-as-proof (TS2741) | `npm run typecheck` | ✅ |
| OUT-07 | Cardinality structural (tuple vs array) | typecheck-as-proof | `npm run typecheck` | ✅ |
| OUT-08 | Closed reasons set preserved; output byte-identical | byte-equality | `node --test tests/architecture/catalog-uat.test.ts` | ✅ existing (114 fixtures) |
| (all) | Zero rendered-byte change | byte-equality + grammar | `catalog-uat` + `notify-v2` + `notify-grammar-invariant` | ✅ existing |

### Sampling Rate
- **Per task commit:** `node --test tests/architecture/catalog-uat.test.ts tests/shared/notify-v2.test.ts` + `npm run typecheck` (fast; the output-neutrality tripwire).
- **Per wave merge (per command family):** `npm run check`.
- **Phase gate:** Full `npm run check` green before `/gsd-verify-work`; `catalog-uat` byte-identical.

### Output-neutrality validation strategy (the core of this phase)
1. **Byte gate (catalog-uat):** 114 `(section, state)` fixtures drive `notify()` and byte-compare against `docs/output-catalog.md`; asserts exactly one `ctx.ui.notify` call per invocation `[VERIFIED: catalog-uat.test.ts:2649–2654]`. Do NOT edit `docs/output-catalog.md` this phase. If the planner introduces a new `notify` entry point, the fixtures must drive whichever entry point produces the canonical bytes (adapter keeps fixtures unchanged → lowest risk).
2. **Grammar mini-spec (notify-v2):** 4194-line per-status invariant suite (icon dispatch, scope-bracket placement, reasons-brace format, soft-dep injection) `[VERIFIED: notify-v2.test.ts:1–60]` — the binding per-row contract that must stay byte-identical.
3. **Typecheck-as-exhaustiveness-proof:** `npm run typecheck` is the MOD-03/D-10 enforcement — a per-command render map missing an arm is TS2741. This replaces the deleted central `assertNever`.
4. **Grammar-invariant survives:** `notify-grammar-invariant.test.ts` (summary first-line grammar) is output-behavior coverage, unaffected.

### Wave 0 Gaps
- [ ] None new required — existing `catalog-uat`, `notify-v2`, `notify-grammar-invariant` cover output-neutrality; `tsc --noEmit` covers exhaustiveness.
- [ ] **Delete** `tests/architecture/notify-types.test.ts` (D-03) — this is a planned removal, not a gap; ensure no other test imports its `_V*`/`_Assert_*` aliases (verified: it is self-contained, runtime-inert, nothing imports it `[VERIFIED: notify-types.test.ts header lines 9–13]`).

## Security Domain

> `security_enforcement`: not explicitly `false` in config this session → treated as enabled. This phase is an internal type-model refactor with no new trust boundary, no new input parsing, no new I/O, no new dependency.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface touched. |
| V3 Session Management | no | N/A. |
| V4 Access Control | no | N/A. |
| V5 Input Validation | no (no new input) | Existing `redactAbsolutePaths` path-redaction (`notify.ts:244`) stays central and unchanged — it must NOT be moved or weakened (NFR-9: surface message text, never `.stack`/absolute paths). |
| V6 Cryptography | no | The PI-7 hash-version display (`formatHashVersionForDisplay`) is presentation-only, not security crypto; stays unchanged. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Mitigation (preserve, do not regress) |
|---------|--------|---------------------------------------|
| Absolute-path / stack leakage in notifications | Information Disclosure | `redactAbsolutePaths` (NFR-9) stays central in `notify.ts:244`; render maps that emit cause-chain trailers must route through the existing `renderIndentedCauseChain`/`causeChainTrailer` seam, never raw `.stack`. |
| Containment (write-outside-scope) | Tampering | Not applicable — this phase performs no disk writes (NFR-10 unaffected). |

## Sources

### Primary (HIGH confidence — read directly this session)
- `extensions/pi-claude-marketplace/shared/notify.ts` (full file, 3119 lines) — all symbol names/line numbers above.
- `extensions/pi-claude-marketplace/edge/router.ts` (lines 26–214) — the 18-command surface.
- `extensions/pi-claude-marketplace/edge/register.ts` (lines 78–97) — handler wiring.
- `tests/architecture/notify-types.test.ts` (lines 1–220) — the proofs to delete.
- `tests/architecture/catalog-uat.test.ts` (lines 1–160, 199–246, 2602–2654) — the byte gate + fixture shape + 114 fixtures.
- `tests/architecture/notify-grammar-invariant.test.ts` (lines 1–90) — survives.
- `tests/shared/notify-v2.test.ts` (lines 1–60) — grammar mini-spec header.
- `package.json` (scripts, engines), `eslint.config.js` (BLOCK A lines 84–140) — gates.
- Orchestrator call-site grep across `orchestrators/{plugin,marketplace,reconcile,import}/` — the ~70 notify call sites + per-command status sets.
- `.planning/workstreams/notification-refactor/{REQUIREMENTS.md, ROADMAP.md}` and the phase `01-CONTEXT.md` — locked decisions.

### Secondary (context only)
- `.planning/workstreams/notification-refactor/research/MESSAGING-COUPLING.md` — Part B classification + the two end-to-end traces (Part C registry shape is SUPERSEDED by CONTEXT.md and was NOT planned to).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The lowest-risk `notify()` reshape is adapter-then-migrate (keep old entry as a synthesizer) rather than big-bang, given 114 fixtures + ~70 call sites. | notify() reshape / Pitfall 2 | If planner big-bangs, more churn but still achievable; output-neutrality unaffected. |
| A2 | `Record<Status, RenderFn>` mapped type is preferred over a relocated `switch`+`assertNever` for D-10. | Pattern 1 | Both satisfy "missing arm = compile error" (D-10 discretion); `switch` is equally valid. |
| A3 | The proposed reason topic-grouping (idempotent / unsupported-components / failure-class / command-specific) is a starting taxonomy; planner finalizes. | Reasons split | Wrong grouping is cosmetic — the closed set membership (the OUT-08 constraint) is byte-exact regardless. |
| A4 | `dependencies` can be an optional base field while soft-dep marker injection stays gated to the 3 dep-bearing render arms, keeping bytes identical. | Pattern 3 / Pitfall 4 | If promoting it changes marker emission, `catalog-uat` catches it immediately. |
| A5 | D-12 tuple-vs-array is additive typing this phase; the render-time `.length` counting in severity/summary ladders is not rewritten until Phase 2. | Cardinality | If planner tries to remove counting now, risks output change (Phase-2 work leaking into Phase 1). |

## Open Questions

1. **New `notify()` entry-point name & exact signature.**
   - Known: target is `notify(context, rows)` (D-02); current is `notify(ctx, pi, message)`; `ctx`+`pi` are still needed (probe + the sanctioned `ctx.ui.notify`).
   - Unclear: whether `ctx`/`pi` fold into a single object, and whether the old name is reused or a new name introduced with the old as adapter.
   - Recommendation: introduce reshaped entry alongside old; migrate command-by-command; remove old last (A1).

2. **Does the row-type union survive centrally, or assemble from command-local shapes?**
   - Known: D-01 forbids a central *registry of contributions*; it does not forbid the envelope referencing a union of row types.
   - Unclear: whether `notify()`'s `rows` param is typed as a broad union or generically over the command's own `Msg`.
   - Recommendation: type `notify` generically over the `CommandContext<Status, Msg>` so each call site is checked against its OWN command's shapes (strongest D-01/D-08 alignment).

3. **`CommandContext` for delegating/load-time producers (bootstrap, reconcile, import).**
   - Known: bootstrap delegates to add+autoupdate; reconcile/import are mixed-subject cascades.
   - Unclear: whether a mixed-subject cascade gets one `CommandContext` with a render map spanning multiple subjects' statuses, or composes per-subject maps.
   - Recommendation: give import/reconcile their own `CommandContext` whose render map is total over the union of statuses they actually emit (enumerated in the inventory table).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | typecheck + tests | ✓ | `>=20.19.0` (engines) | — |
| TypeScript (`tsc`) | exhaustiveness proof | ✓ | via `npm run typecheck` | — |
| `node:test` | byte gates | ✓ | bundled | — |

No external services, network, or tools required (this phase touches no network per NFR-5 and writes no disk).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; toolchain verified from `package.json`/`eslint.config.js`.
- Architecture (what stays/moves, signatures, call sites): HIGH — every claim cites a read line range in `notify.ts`/orchestrators/tests.
- Pitfalls: HIGH — derived from the actual byte gates and the field-presence constraints in the code.
- Reason grouping taxonomy: MEDIUM — the membership is verified (32 entries); the *grouping* is a proposal (planner discretion, A3).

**Research date:** 2026-06-24
**Valid until:** ~30 days (internal code; stable unless `notify.ts` is edited by another workstream before planning).

## RESEARCH COMPLETE
