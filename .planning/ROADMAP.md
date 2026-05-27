# Roadmap: pi-claude-marketplace

## Milestones

- ✅ **v1.0 successor architecture** -- Phases 1-7 (shipped 2026-05-11)
- ✅ **v1.1 Reinstall Command** -- Phases 8-9 (shipped 2026-05-14)
- ✅ **v1.2 Claude Settings Import** -- Phases 10-11 (shipped 2026-05-20)
- ✅ **v1.3 Consistent Messaging** -- Phases 12-14.2 (shipped 2026-05-25)
- 🚧 **v1.4 Structured Notification Messages** -- Phases 15-21 (in progress)

For full details of each milestone, see `.planning/milestones/v[X.Y]-ROADMAP.md` and `.planning/milestones/v[X.Y]-REQUIREMENTS.md`.

## Phases

<details>
<summary>✅ v1.0 successor architecture (Phases 1-7) -- SHIPPED 2026-05-11</summary>

PRD-derived V1 surface. See PROJECT.md "Validated" section for details; phase summaries live under `.planning/phases/`.

- [x] Phase 1: Foundations
- [x] Phase 2: Primitives
- [x] Phase 3: Bridges
- [x] Phase 4: Marketplace Orchestrators
- [x] Phase 5: Plugin Orchestrators
- [x] Phase 6: Edge
- [x] Phase 7: Integration & Real Pi Wiring

</details>

<details>
<summary>✅ v1.1 Reinstall Command (Phases 8-9) -- SHIPPED 2026-05-14</summary>

`reinstall` command with atomic per-plugin replacement, cached-manifest reuse, no network sync, bulk-cascade partitioning, reload-hint + soft-dep aggregation, installed-only tab completion plus reinstall-specific `--force`.

- [x] Phase 8: Atomic Reinstall Core (4/4 plans) -- completed 2026-05-13
- [x] Phase 9: Reinstall Edge & Bulk UX (4/4 plans) -- completed 2026-05-14

</details>

<details>
<summary>✅ v1.2 Claude Settings Import (Phases 10-11) -- SHIPPED 2026-05-20</summary>

`/claude:plugin import [--scope user|project]` with Claude settings discovery, base/override merge, enabled-plugin extraction, official + extraKnownMarketplaces source mapping, idempotent orchestration, unavailable-plugin warning aggregation, source-mismatch protection.

- [x] Phase 10: Claude Settings Import Foundation -- completed 2026-05-19
- [x] Phase 11: Import Command Orchestration -- completed 2026-05-20

</details>

<details>
<summary>✅ v1.3 Consistent Messaging (Phases 12-14.2) -- SHIPPED 2026-05-25</summary>

Closed-set grammar primitives, Wave 1 presentation composers, ES-5 atomic supersession, per-command catalog conformance via byte-equality UAT runner, 34-rule ESLint drift-guard plugin. v1.3 user-contract is structurally enforced. 38/38 CMC requirements satisfied. See `.planning/milestones/v1.3-ROADMAP.md` for full details.

- [x] Phase 12: Messaging Foundations & Renderer Primitives (4/4 plans) -- completed 2026-05-22
- [x] Phase 13: Conformance Refactor & ES-5 Supersession (10/10 plans) -- completed 2026-05-24
- [x] Phase 14: Drift Guard & Test Alignment (6/6 plans) -- completed 2026-05-24
- [x] Phase 14.1: Close gap: CMC-13 propagate declaresAgents/Mcp through import (2/2 plans) -- completed 2026-05-24
- [x] Phase 14.2: Address tech debt: CR-01 + retroactive Phase 12 / 14.1 gates (5/5 plans) -- completed 2026-05-24

</details>

### 🚧 v1.4 Structured Notification Messages (Phases 15-21)

Replace v1.3's string-based notify API + 34-rule ESLint drift-guard plugin with a type-driven structured `NotificationMessage` payload. Simplify the user-output spec to always render a marketplace header with indented plugin rows. Net code delta target: ~4300 LoC removed (~+400 new types/switch/wrappers vs ~-4700 deleted lint plugin + parity test + absorbed presentation composers).

**Cross-cutting constraints applied to every v1.4 phase:**

- NFR-6: `npm run check` (typecheck + ESLint + Prettier + tests) stays green throughout.
- Catalog UAT byte-equality stays GREEN at every phase boundary. After Phase 17 the new always-marketplace-header spec is the binding contract; no phase may break it mid-flight.
- IL-2 / IL-3: All user-visible messages go through `ctx.ui.notify` from `shared/notify.ts` only; the single sanctioned `console.warn` at `persistence/migrate.ts` stays inline-disabled at the call site.
- Atomic commits per plan; no commits to `main`.

- [x] **Phase 15: Type Model & ADR Refresh** -- Pure type definitions in `shared/notify.ts` (`NotificationMessage`, `MarketplaceNotificationMessage`, `PluginNotificationMessage`, `PluginStatus`, `MarketplaceStatus`, `Dependency`, `MarketplaceDetails`, `UsageErrorMessage`) plus refreshed source-of-truth ADR (completed 2026-05-25)
- [x] **Phase 16: Renderer & Public API (Alongside V1)** -- `notify(ctx, payload)` and `notifyUsageError(ctx, payload)` exported from `shared/notify.ts`; internal switch with `assertNever`; computed severity; computed reload hint; renderer-time dependency probe; per-status unit tests (completed 2026-05-26)
- [x] **Phase 17: Spec Rewrite & Catalog UAT Migration** -- `docs/messaging-style-guide.md` v2.0 + `docs/output-catalog.md` rewritten to always-marketplace-header spec; catalog UAT runner fed by structured `NotificationMessage` fixtures (completed 2026-05-26)
- [x] **Phase 17.1: V2 Grammar Amendment: Autoupdate Surface (INSERTED)** -- Amend the V2 type model + renderer + catalog + ADR to restore the user-visible distinction between fresh autoupdate enable/disable, idempotent flips, and failures collapsed by Phase 17 into a single `(updated)` status. Implements the user-locked design from Phase 18 D-18-05 so Plan 18-02 (autoupdate.ts call-site migration) can construct typed messages that round-trip through `notify()` to byte-correct V2 output. (completed 2026-05-26)
- [x] **Phase 17.2: renderScopeBracket orphan-fold contract fix (INSERTED)** -- Fix the renderer to honor the documented orphan-fold contract: `renderScopeBracket(pluginScope, mpScope)` returns `""` when scopes match, thread `mp.scope` through `composePluginLines`/`renderPluginRow`, update the 10 call sites. Fold in WR-01..WR-06 (docstring refresh, composeVersionArrow simplification, soft-dep probe coverage tests, dead-helper deletion, exhaustiveness gate hardening, catalog narrative tightening) as a single notify.ts hygiene sweep. Closes CR-01 + WR-01..WR-06 from the 17.1 code review; unblocks Phase 18. (completed 2026-05-26)
- [x] **Phase 18: Migration Wave 1 -- Marketplace Orchestrator Family** -- Migrate all `orchestrators/marketplace/*` call sites to `notify(ctx, structured)`; retire MSG-* lint globs covering marketplace orchestrators (completed 2026-05-27)
- [ ] **Phase 19: Migration Wave 2 -- Plugin Orchestrator Family** -- Migrate all `orchestrators/plugin/*` call sites to `notify(ctx, structured)`; retire MSG-* lint globs covering plugin orchestrators
- [ ] **Phase 20: Migration Wave 3 -- Edge Handlers & UsageError** -- Migrate all `edge/handlers/*` call sites; migrate all `notifyUsageError(ctx, msg, usage)` sites to V2 `notifyUsageError(ctx, structuredUsageError)`; retire remaining MSG-* lint globs
- [ ] **Phase 21: Final Teardown & GREEN Gate** -- Delete V1 severity-named wrappers; delete `tests/lint-rules/` (34 rules + 34 RuleTester suites + helpers); delete `tests/architecture/msg-rule-registry.test.ts`; replace MSG-* config in `eslint.config.js` with stock `no-restricted-syntax` + `no-console` (with `persistence/migrate.ts` per-file override); update / delete `tests/architecture/grammar-frontmatter.test.ts`; resolve `shared/grammar/` retain-or-delete; review `no-legacy-markers.test.ts`; `npm run check` GREEN

## Phase Details

### Phase 15: Type Model & ADR Refresh

**Goal:** The complete v1.4 type model is defined in `shared/notify.ts` with zero runtime impact, and the source-of-truth ADR matches the locked design so all later phases consume one consistent contract.

**Depends on:** v1.3 Phase 14.2 complete

**Requirements:** SNM-01, SNM-02, SNM-03, SNM-04, SNM-05, SNM-06, SNM-07, SNM-08, SNM-09, SNM-10, SNM-11, SNM-21

**Success Criteria** (what must be TRUE):

1. `shared/notify.ts` exports `NotificationMessage`, `MarketplaceNotificationMessage`, `PluginNotificationMessage`, `PluginStatus`, `MarketplaceStatus`, `Dependency`, `MarketplaceDetails`, and `UsageErrorMessage` types with the exact shapes specified by SNM-01..SNM-11 (no `severity` or `trailer` field on `NotificationMessage`; `PluginNotificationMessage` is a 10-variant discriminated union on `status`; `PluginStatus` is derived via indexed access; `Dependency = "agents" | "mcp"`; `failed` carries optional `rollbackPartial` and optional `cause?: Error`; orphan-fold `scope?` only on non-`available`/`unavailable` variants).
2. A TypeScript-only compile check (e.g. a `tests/architecture/notify-types.test.ts` or in-file `type _Assert = …` block) proves the 10 plugin-status literals and 4 marketplace-status literals are exactly the documented closed sets, and that `PluginStatus extends PluginNotificationMessage["status"]` round-trips.
3. `docs/adr/v2-001-structured-notify.md` status is flipped from "Proposed" to "Accepted" with a forward reference to Phase 15; ADR body reflects status renames (`PluginStatus`/`MarketplaceStatus` named enums), `*NotificationMessage` type names, `Dependency` closed set, per-plugin causes, dropped top-level trailer, computed severity, always-marketplace-header spec change.
4. `npm run check` stays GREEN; no runtime call site references the new types yet (types are unused outside their own declarations and the compile-check file).

**Plans:** 3/3 plans complete
**Wave 1**

- [x] 15-01-PLAN.md -- Append v1.4 structured type model + const tuples (PLUGIN_STATUSES, MARKETPLACE_STATUSES, DEPENDENCIES) to shared/notify.ts (SNM-01..SNM-11; D-15-01..D-15-11)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 15-02-PLAN.md -- Add tests/architecture/notify-types.test.ts compile-time proofs (closed-set + bidirectional SNM-04 round-trip + per-variant invariants per D-15-12)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 15-03-PLAN.md -- Refresh docs/adr/v2-001-structured-notify.md (Status Proposed -> Accepted; Decision/Consequences/Migration rewrite; Alt-2 flip; Open Questions deletion) (SNM-21)

### Phase 16: Renderer & Public API (Alongside V1)

**Goal:** The new `notify(ctx, NotificationMessage)` and `notifyUsageError(ctx, UsageErrorMessage)` entrypoints exist in `shared/notify.ts` next to the V1 severity-named wrappers, with full per-status unit coverage, and produce byte-equal output to the V1 callers when given equivalent payloads -- but no orchestrator call sites have migrated yet.

**Depends on:** Phase 15

**Requirements:** SNM-12, SNM-13, SNM-14, SNM-15, SNM-16, SNM-17, SNM-18, SNM-30

**Success Criteria** (what must be TRUE):

1. `shared/notify.ts` exports `notify(ctx, NotificationMessage): void` and `notifyUsageError(ctx, UsageErrorMessage): void` as the sole structured-payload entrypoints; both coexist with the V1 `notifySuccess/Warning/Error/UsageError` wrappers (V1 wrappers are not yet deleted).
2. `notify()` derives severity from contents (failed → error, `skipped`/`manual recovery` → warning, otherwise success), emits the `/reload to pick up changes` trailer iff any plugin status is in `{installed, updated, reinstalled, uninstalled}` or any marketplace status is set, and probes `pi-subagents` / `pi-mcp-adapter` at render time for each declared `Dependency`. No caller-supplied severity, reload flag, or probe state.
3. `notify()`'s internal switch over plugin/marketplace `status` is the SOLE site that knows the user-output grammar; an `assertNever(...)` arm makes adding an unhandled status a compile error. `presentation/` composers consumed by the switch are not re-exported from the barrel (only the user-facing TYPES are public).
4. Per-status unit tests exist for every variant of `PluginNotificationMessage` (10 variants) and every value of `MarketplaceStatus` (4 values), passing a structured payload through a mock `ctx` and asserting on the exact string passed to `ctx.ui.notify`. Tests cover empty `plugins: []`, single-plugin, multi-plugin, orphan-fold (`scope?` set), `rollbackPartial`, and multi-cause cascades.
5. Catalog UAT (`tests/architecture/catalog-uat.test.ts`) still passes byte-equality against V1 callsites unchanged; `npm run check` stays GREEN.

**Plans:** 6/6 plans complete
Plans:
**Wave 1**

- [x] 16-01-PLAN.md -- Editorial REQUIREMENTS.md SNM-12 + SNM-15 refinements + ADR Decision-snippet alignment (D-16-01 + D-16-12)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 16-02-PLAN.md -- Add V2 notifyUsageError(ctx, UsageErrorMessage) export alongside V1 (SNM-13, D-16-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 16-03-PLAN.md -- Add file-private renderMpHeader switch helper + icon constants (SNM-17, D-16-09)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 16-04-PLAN.md -- Add file-private renderPluginRow 10-arm switch + soft-dep markers + composeReasons / joinTokens / renderVersion / composeVersionArrow helpers (SNM-16, SNM-17, SNM-18, D-16-09, D-16-15)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 16-05-PLAN.md -- Add public notify(ctx, pi, message) orchestration + RELOAD_HINT_TRAILER + computeSeverity + shouldEmitReloadHint (SNM-12, SNM-14, SNM-15, SNM-16, SNM-17, SNM-18, D-16-01, D-16-04..D-16-14)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 16-06-PLAN.md -- Create tests/shared/notify-v2.test.ts with mini-spec header and >=20 per-variant unit tests (SNM-30, D-16-16..D-16-18)

### Phase 17: Spec Rewrite & Catalog UAT Migration

**Goal:** `docs/messaging-style-guide.md` and `docs/output-catalog.md` describe the v1.4 type-driven contract with always-marketplace-header rendering, and the catalog UAT runner verifies that contract by driving the new `notify()` through structured fixtures -- not pre-assembled strings.

**Depends on:** Phase 16

**Requirements:** SNM-19, SNM-20, SNM-26, SNM-31

**Success Criteria** (what must be TRUE):

1. `docs/messaging-style-guide.md` v2.0 is published and describes the structured type model as the binding contract; the v1.3 `status_tokens` / `reasons` / `markers` / `pattern_classes` YAML frontmatter sets are either deleted (now type-derived) or kept as a documentation aid with a runtime parity check against the TypeScript types in `shared/notify.ts`.
2. `docs/output-catalog.md` is rewritten so every per-command section renders a marketplace header at column 0 with plugin rows indented two spaces, including single-plugin install / update / uninstall / reinstall and marketplace add / remove. The single-plugin install line shape changes from `● commit-commands [user] (installed)` to `● claude-plugins-official [user]\n  ● commit-commands (installed)`.
3. `tests/architecture/catalog-uat.test.ts` constructs `NotificationMessage` fixtures and routes them through `notify(ctx, …)` via mock `ctx`, asserting byte-equality against the per-command expected outputs in `docs/output-catalog.md`. The byte-equality assertion remains the user-contract gate.
4. Catalog UAT is GREEN against the new always-marketplace-header spec when driven through the new `notify()`; V1 callsites still produce pre-v2 output but no test of the new contract runs against them (V1 callsites are excluded from catalog UAT or covered by a separate transitional snapshot until their migration phase).
5. `npm run check` stays GREEN; `docs/adr/v2-001-structured-notify.md` Accepted-status cross-reference to Phase 17 for the spec change is added if not already present.

**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 17-01-PLAN.md -- Style guide v2.0 rewrite + grammar-frontmatter.test.ts deletion + REQUIREMENTS.md SNM-26 traceability + ADR Phase 17 cross-ref (SNM-19, SNM-26; D-17-01, D-17-02, D-17-07, D-17-08)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 17-02-PLAN.md -- output-catalog.md v2.0 rewrite to always-marketplace-header form (SNM-20; D-17-04, D-17-09, D-17-10)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 17-03-PLAN.md -- catalog-uat.test.ts rewrite to drive notify() via structured fixtures + REQUIREMENTS.md SNM-19/20/31 completion flips (SNM-31; D-17-03, D-17-05, D-17-06)

### Phase 17.2: renderScopeBracket orphan-fold contract fix (INSERTED)

**Goal:** Fix the divergence between the documented orphan-fold plugin-row scope-bracket contract (D-16-17 + `docs/messaging-style-guide.md:73` + `docs/output-catalog.md:39/46/196`) and the current `renderScopeBracket` implementation at `extensions/pi-claude-marketplace/shared/notify.ts:683-685`. Thread `mp.scope` through `composePluginLines`/`renderPluginRow`; update all 10 call sites to the 2-arg `renderScopeBracket(p.scope, mp.scope)` form; sync the catalog byte form + fixture; fold in the remaining six 17.1 review warnings (WR-01..WR-06) as a single notify.ts / pi-api.ts test / catalog hygiene sweep. Unblocks Phase 18.

**Requirements:** None directly (pure tech-debt fix closing the 17.1 review CR-01 + WR-01..WR-06 findings; no SNM-* requirement closes in this phase. Per D-17.2-09 there is no Phase-18 hand-off scaffolding beyond fixing the renderer.)

**Depends on:** Phase 17.1

**Success Criteria** (what must be TRUE):

1. `renderScopeBracket(pluginScope: Scope | undefined, mpScope: Scope): string` returns `""` when `pluginScope === undefined || pluginScope === mpScope`, otherwise `` `[${pluginScope}]` ``.
2. `mpScope` is threaded from `composeMarketplaceBlock` through `composePluginLines` into `renderPluginRow`; all 10 per-arm `renderScopeBracket` call sites use the 2-arg form (8 with `p.scope`, 2 carve-out arms with `undefined`).
3. Four new byte-equality unit tests in `tests/shared/notify-v2.test.ts` lock the orphan-fold contract for representative variants (same-scope `installed`, orphan-fold `installed`, same-scope `updated`, orphan-fold `failed`).
4. `docs/output-catalog.md:191` byte form drops the `[user]` bracket on the same-scope `alpha v1.0.0` row inside the `project-orphan-folded` state; narratives at `:182` and `:196` accurately describe the corrected rule.
5. The `project-orphan-folded` fixture at `tests/architecture/catalog-uat.test.ts:282-313` has the misleading 4-line workaround comment removed; the `void piWithSubagentsLoaded;` dead-code hack at lines 1328-1332 is deleted along with its rationalisation comment.
6. `composeVersionArrow` has signature `(from: string, to: string): string` with a single live branch (WR-03); the top-of-file docstring (lines 16-56) and `notifyUsageError` preamble (lines 97-105) are refreshed without historical-fiction futurism clauses (WR-01); both default arms in `renderMpHeader` AND `renderPluginRow` use the hardened `{ assertNever(...); return ""; }` shape (WR-06).
7. Three new tests in `tests/platform/pi-api.test.ts` cover the WR-04 boundary branches (`pi-mcp-adapter` source-substring boundary; `try/catch` fallback hardening; `tool.name === undefined` boundary).
8. `npm run check` exits 0; catalog UAT byte-equality is GREEN.

**Plans:** 4/4 plans complete

Plans:

**Wave 1** *(parallel-safe: plan 01 modifies notify.ts + notify-v2.test.ts; plan 03 modifies pi-api.test.ts; no overlap)*

- [x] 17.2-01-PLAN.md -- CR-01 renderScopeBracket signature fix + threading + 10 call sites + 4 new byte-equality unit tests + WR-01/WR-03/WR-06 notify.ts hygiene sweep (D-17.2-01, D-17.2-02, D-17.2-03, D-17.2-04, D-17.2-07, D-17.2-10, D-17.2-11)
- [x] 17.2-03-PLAN.md -- WR-04 soft-dep probe coverage tests in tests/platform/pi-api.test.ts (3 new tests for source-substring boundary, try/catch fallback, tool.name === undefined boundary) (D-17.2-08)

**Wave 2** *(blocked on plan 01 completion)*

- [x] 17.2-02-PLAN.md -- docs/output-catalog.md byte form update at line 191 + narrative tightening at lines 182/196 + tests/architecture/catalog-uat.test.ts project-orphan-folded fixture cleanup + WR-05 dead-helper deletion (D-17.2-05, D-17.2-06)

**Wave 3** *(blocked on Waves 1+2 completion)*

- [x] 17.2-04-PLAN.md -- Final `npm run check` GREEN gate + WR-01..WR-06 + CR-01 closure mapping recorded in SUMMARY (D-17.2-04 rollup, D-17.2-09, D-17.2-10, D-17.2-11)

### Phase 17.1: V2 Grammar Amendment: Autoupdate Surface (INSERTED)

**Goal:** Amend the V2 notify grammar (type model + renderer + catalog + ADR) to restore the user-visible distinction between fresh autoupdate enable/disable, idempotent no-ops, and failures -- collapsed by Phase 17's v2 catalog into a single `(updated)` status -- so Phase 18's plan 18-02 (autoupdate.ts call-site migration) can construct typed messages that round-trip through `notify()` to byte-correct V2 output. Implements the user-locked design from Phase 18 D-18-05.

**Requirements:** None directly (pure layered amendment of Phase 15 / 16 / 17 surfaces locked by D-18-04 / D-18-05; the amendment is justified by the user-locked design in Phase 18 CONTEXT.md rather than by a REQUIREMENTS.md SNM-ID. Phase 18's plan 18-02 unblocks once Phase 17.1 verifies passed.)

**Depends on:** Phase 17

**Success Criteria** (what must be TRUE):

1. `MARKETPLACE_STATUSES` has 7 entries: original 4 (`added`, `removed`, `updated`, `failed`) + 3 new (`autoupdate enabled`, `autoupdate disabled`, `skipped`); `MarketplaceNotificationMessage` carries optional `readonly reasons?: readonly Reason[]`.
2. `renderMpHeader` has 3 new arms; `computeSeverity` routes `mp.status === "skipped"` to `"warning"`; `shouldEmitReloadHint` triggers on `"autoupdate enabled"` / `"autoupdate disabled"` and NOT on `"skipped"`.
3. `docs/output-catalog.md` has 5 new catalog-state blocks matching the normative byte forms: `enable-fresh`, `disable-fresh`, `enable-idempotent`, `disable-idempotent`, `failure-not-found`.
4. `tests/architecture/catalog-uat.test.ts` has 5 new fixtures matching the catalog-state discriminators; catalog UAT byte-equality is GREEN.
5. `tests/architecture/notify-types.test.ts` length lock is 7; `_MarketplaceStatusExpected` covers all 7; `_MarketplaceMessageExpected` includes `readonly reasons?: readonly Reason[]`. `tests/shared/notify-v2.test.ts` has 5 new tests (3 arms + 2 ladder).
6. ADR Decision section reflects 7 entries; new `## Amendment: Phase 17.1 ({date})` section captures what + why + ladders. Consequences / Migration / Alternatives sections are byte-identical.
7. `docs/messaging-style-guide.md` MarketplaceStatus pointer says `7 literal strings`; any drift prose refreshed.
8. `npm run check` exits 0.

**Plans:** 4/4 plans complete

Plans:

**Wave 1**

- [x] 17.1-01-PLAN.md -- Extend MARKETPLACE_STATUSES 4→7 + add reasons? on MarketplaceNotificationMessage + update notify-types.test.ts closed-set + shape proofs (D-17.1-01, D-17.1-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 17.1-02-PLAN.md -- Add 3 new renderMpHeader arms + extend computeSeverity (skipped→warning) + extend shouldEmitReloadHint (autoupdate enabled/disabled trigger) + 5 new byte-equality tests in notify-v2.test.ts (D-17.1-02, D-17.1-05)

**Wave 3** *(blocked on Wave 2 completion; 17.1-03 and 17.1-04 parallel)*

- [x] 17.1-03-PLAN.md -- Rewrite docs/output-catalog.md autoupdate section with 5 state blocks + replace catalog-uat.test.ts fixture map + update messaging-style-guide.md pointer 4→7 (D-17.1-03, D-17.1-04, D-17.1-06)
- [x] 17.1-04-PLAN.md -- In-place ADR Decision section updates (lines 35/42/88) + append ## Amendment: Phase 17.1 section (D-17.1-07, D-17.1-08)

### Phase 18: Migration Wave 1 -- Marketplace Orchestrator Family

**Goal:** Every call site in `orchestrators/marketplace/*` uses the new `notify(ctx, structured)` entrypoint, and the catalog UAT proves the marketplace command surface is byte-equal to the v2.0 spec.

**Depends on:** Phase 17

**Requirements:** (no SNM-IDs close in this phase; this is an execution phase contributing to SNM-22 closure in Phase 21)

**Success Criteria** (what must be TRUE):

1. Zero `notifySuccess` / `notifyWarning` / `notifyError` callers remain in `orchestrators/marketplace/**/*.ts`; every state-change notification in the marketplace family flows through `notify(ctx, NotificationMessage)`.
2. The MSG-* lint plugin's `files:` globs are narrowed in `eslint.config.js` so the marketplace orchestrator family is no longer scoped by the v1.3 drift-guard rules (rules remain wired for the still-unmigrated plugin/edge families).
3. Catalog UAT byte-equality is GREEN for every marketplace-family command output (`add`, `remove`, `update`, `list` marketplace headers and rows where applicable) against the v2.0 always-marketplace-header spec.
4. `npm run check` stays GREEN; no orchestrators outside marketplace have changed call-site shape.

**Plans:** 7/7 plans complete

Plans:

**Wave 0** *(pre-cleanup -- must land first)*

- [x] 18-00-PLAN.md -- Pre-thread `pi: ExtensionAPI` through the 3 marketplace orchestrators that don't currently accept it (`add.ts`, `autoupdate.ts`, `list.ts`) + edge handler factories + `register.ts` wiring (D-18-08-amendment)

**Wave 1** *(pilot -- depends on Wave 0)*

- [x] 18-01-PLAN.md -- Migrate `orchestrators/marketplace/add.ts` (2 V1 callsites) + tests; drop presentation/* imports; DROP cache-leak warning per D-18-01 precedent; include NotificationMessage construction recipe block-comment for Wave 2 to mirror (Wave 1 pilot)

**Wave 2** *(parallel migrations -- depend on Wave 1)*

- [x] 18-02-PLAN.md -- Migrate `orchestrators/marketplace/autoupdate.ts` (4 V1 callsites) against Phase 17.1's landed 7-entry MarketplaceStatus + optional reasons?: (D-18-04, D-18-05)
- [x] 18-03-PLAN.md -- Migrate `orchestrators/marketplace/list.ts` (1 V1 callsite) -- list-surface arm (mp.status === undefined); add lastUpdatedAt enrichment
- [x] 18-04-PLAN.md -- Migrate `orchestrators/marketplace/remove.ts` (4 V1 callsites); DROP cleanup-leak warnings per D-18-01; restructure cascade cause-chain per D-18-03
- [x] 18-05-PLAN.md -- Migrate `orchestrators/marketplace/update.ts` (6 V1 callsites -- research-verified count); DROP retry-hint suffix per D-18-02; restructure cascade per D-18-03; complete factory pi-required wiring (option-a)

**Wave 3** *(lint narrowing + final gate -- depends on all of Wave 2)*

- [x] 18-06-PLAN.md -- Add `ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"]` to MSG-Block 1 + MSG-Block 1b per D-18-07; final end-to-end SC #1..#4 verification

### Phase 19: Migration Wave 2 -- Plugin Orchestrator Family

**Goal:** Every call site in `orchestrators/plugin/*` uses the new `notify(ctx, structured)` entrypoint, and the catalog UAT proves the plugin command surface is byte-equal to the v2.0 spec.

**Depends on:** Phase 18

**Requirements:** (no SNM-IDs close in this phase; this is an execution phase contributing to SNM-22 closure in Phase 21)

**Success Criteria** (what must be TRUE):

1. Zero `notifySuccess` / `notifyWarning` / `notifyError` callers remain in `orchestrators/plugin/**/*.ts`; every state-change notification in the plugin family (install / update / uninstall / reinstall / cascade summaries) flows through `notify(ctx, NotificationMessage)`.
2. The MSG-* lint plugin's `files:` globs are narrowed in `eslint.config.js` so the plugin orchestrator family is no longer scoped by the v1.3 drift-guard rules; only edge handlers remain scoped.
3. Catalog UAT byte-equality is GREEN for every plugin-family command output (single-plugin install with the new marketplace header + indented row shape, bulk cascades, manual-recovery rows, rollback-partial sub-state, per-plugin cause chains in multi-failure cascades) against the v2.0 spec.
4. `npm run check` stays GREEN; no edge handlers have changed call-site shape.

**Plans:** TBD

### Phase 20: Migration Wave 3 -- Edge Handlers & UsageError

**Goal:** Every remaining call site -- including all edge handlers and all `notifyUsageError(ctx, msg, usage)` sites -- uses the v2 structured entrypoints. After this phase, no code outside `shared/notify.ts` calls the V1 severity-named wrappers or the V1 three-argument `notifyUsageError`.

**Depends on:** Phase 19

**Requirements:** SNM-23

**Success Criteria** (what must be TRUE):

1. Zero `notifySuccess` / `notifyWarning` / `notifyError` callers remain in `edge/handlers/**/*.ts`; every notification from the edge layer flows through `notify(ctx, NotificationMessage)`.
2. All ~13 `notifyUsageError(ctx, message, usage)` call sites across edge handlers are migrated to the V2 `notifyUsageError(ctx, { message, usage })` signature; the V1 three-argument signature has no remaining callers (deletion happens in Phase 21).
3. The MSG-* lint plugin's `files:` globs cover no remaining source files; the lint plugin is still wired but is effectively a no-op against the migrated codebase (deletion happens in Phase 21).
4. Catalog UAT byte-equality is GREEN for every edge-handler output and every usage-error output against the v2.0 spec.
5. `npm run check` stays GREEN.

**Plans:** TBD

### Phase 21: Final Teardown & GREEN Gate

**Goal:** The v1.3 drift-guard infrastructure is fully retired -- 34-rule lint plugin gone, registry parity test gone, V1 wrappers gone, `eslint.config.js` swapped to stock rules -- and `npm run check` is GREEN against the new minimal surface.

**Depends on:** Phase 20

**Requirements:** SNM-22, SNM-24, SNM-25, SNM-27, SNM-28, SNM-29, SNM-32

**Success Criteria** (what must be TRUE):

1. `tests/lint-rules/` is absent from the repo (34 MSG-* rule files + 34 RuleTester companion tests + helpers + plugin shell + types fully deleted). `tests/architecture/msg-rule-registry.test.ts` is absent.
2. V1 severity-named wrappers (`notifySuccess` / `notifyWarning` / `notifyError`) and the V1 three-argument `notifyUsageError(ctx, msg, usage)` signature are deleted from `shared/notify.ts`; only `notify(ctx, NotificationMessage)` and `notifyUsageError(ctx, UsageErrorMessage)` remain exported.
3. `eslint.config.js` no longer wires any MSG-* rule; it carries (a) `no-restricted-syntax` blocking `ctx.ui.notify` calls outside `shared/notify.ts` and (b) `no-console` with a per-file override for `persistence/migrate.ts` (IL-3 sanctioned legacy-migration warn).
4. `tests/architecture/grammar-frontmatter.test.ts` is either rewritten to verify spec-vs-types parity (if the style guide retains frontmatter as a documentation aid) or deleted; `tests/architecture/no-legacy-markers.test.ts` is reviewed and updated for v2 vocabulary; `shared/grammar/` is either deleted (closed sets type-encoded) or retained as the canonical enum source and re-exported from `shared/notify.ts` (decision recorded in phase plan).
5. `npm run check` is GREEN: typecheck + ESLint (with new stock rules) + Prettier + tests pass. Test count change is accounted for (1249 v1.3 baseline minus retired lint-rule tests, plus new per-variant unit tests).

## Progress

| Phase                                                                | Milestone | Plans Complete | Status      | Completed  |
| -------------------------------------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1-7. (v1.0 successor architecture)                                   | v1.0      | --             | Complete    | 2026-05-11 |
| 8. Atomic Reinstall Core                                             | v1.1      | 4/4            | Complete    | 2026-05-13 |
| 9. Reinstall Edge & Bulk UX                                          | v1.1      | 4/4            | Complete    | 2026-05-14 |
| 10. Claude Settings Import Foundation                                | v1.2      | --             | Complete    | 2026-05-19 |
| 11. Import Command Orchestration                                     | v1.2      | --             | Complete    | 2026-05-20 |
| 12. Messaging Foundations & Renderer                                 | v1.3      | 4/4            | Complete    | 2026-05-22 |
| 13. Conformance Refactor & ES-5                                      | v1.3      | 10/10          | Complete    | 2026-05-24 |
| 14. Drift Guard & Test Alignment                                     | v1.3      | 6/6            | Complete    | 2026-05-24 |
| 14.1. CMC-13 import propagation closure                              | v1.3      | 2/2            | Complete    | 2026-05-24 |
| 14.2. CR-01 + retroactive Phase 12/14.1 gates                        | v1.3      | 5/5            | Complete    | 2026-05-24 |
| 15. Type Model & ADR Refresh                                         | v1.4      | 3/3 | Complete    | 2026-05-25 |
| 16. Renderer & Public API (Alongside V1)                             | v1.4      | 6/6 | Complete    | 2026-05-26 |
| 17. Spec Rewrite & Catalog UAT Migration                             | v1.4      | 3/3 | Complete   | 2026-05-26 |
| 17.1. V2 Grammar Amendment: Autoupdate Surface (INSERTED)            | v1.4      | 4/4 | Complete   | 2026-05-26 |
| 17.2. renderScopeBracket orphan-fold contract fix (INSERTED)         | v1.4      | 4/4 | Complete    | 2026-05-26 |
| 18. Migration Wave 1 -- Marketplace Orchestrator Family              | v1.4      | 7/7 | Complete    | 2026-05-27 |
| 19. Migration Wave 2 -- Plugin Orchestrator Family                   | v1.4      | 0/?            | Not started | --         |
| 20. Migration Wave 3 -- Edge Handlers & UsageError                   | v1.4      | 0/?            | Not started | --         |
| 21. Final Teardown & GREEN Gate                                      | v1.4      | 0/?            | Not started | --         |
