# Roadmap: pi-claude-marketplace

## Milestones

- Done **v1.0 successor architecture** -- Phases 1-7 (shipped 2026-05-11)
- Done **v1.1 Reinstall Command** -- Phases 8-9 (shipped 2026-05-14)
- Done **v1.2 Claude Settings Import** -- Phases 10-11 (shipped 2026-05-20)
- Done **v1.3 Consistent Messaging** -- Phases 12-14.2 (shipped 2026-05-25)
- Done **v1.4 Structured Notification Messages** -- Phases 15-21 (shipped 2026-05-28)
- Done **v1.4.1 Post-ship UAT Patches** -- Phases 22-26 (closed 2026-05-30)
- Done **v1.5 Notification Output Polish** -- Phases 27-29 (shipped 2026-05-31)
- Done **v1.6 GitHub Private Marketplace Authentication** -- Phases 30-36 (shipped 2026-06-01)
- Done **v1.7 Transaction Resilience Hardening** -- Phases 37-41 (shipped 2026-06-02)
- Active **v1.8 Plugin and Marketplace Info Commands** -- Phases 42-44 (started 2026-06-03)

For full details of each milestone, see `.planning/milestones/v[X.Y]-ROADMAP.md` and `.planning/milestones/v[X.Y]-REQUIREMENTS.md`.

## Phases

<details>
<summary>Done v1.0 successor architecture (Phases 1-7) -- SHIPPED 2026-05-11</summary>

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
<summary>Done v1.1 Reinstall Command (Phases 8-9) -- SHIPPED 2026-05-14</summary>

`reinstall` command with atomic per-plugin replacement, cached-manifest reuse, no network sync, bulk-cascade partitioning, reload-hint + soft-dep aggregation, installed-only tab completion plus reinstall-specific `--force`.

- [x] Phase 8: Atomic Reinstall Core (4/4 plans) -- completed 2026-05-13
- [x] Phase 9: Reinstall Edge & Bulk UX (4/4 plans) -- completed 2026-05-14

</details>

<details>
<summary>Done v1.2 Claude Settings Import (Phases 10-11) -- SHIPPED 2026-05-20</summary>

`/claude:plugin import [--scope user|project]` with Claude settings discovery, base/override merge, enabled-plugin extraction, official + extraKnownMarketplaces source mapping, idempotent orchestration, unavailable-plugin warning aggregation, source-mismatch protection.

- [x] Phase 10: Claude Settings Import Foundation -- completed 2026-05-19
- [x] Phase 11: Import Command Orchestration -- completed 2026-05-20

</details>

<details>
<summary>Done v1.3 Consistent Messaging (Phases 12-14.2) -- SHIPPED 2026-05-25</summary>

Closed-set grammar primitives, Wave 1 presentation composers, ES-5 atomic supersession, per-command catalog conformance via byte-equality UAT runner, 34-rule ESLint drift-guard plugin. v1.3 user-contract is structurally enforced. 38/38 CMC requirements satisfied. See `.planning/milestones/v1.3-ROADMAP.md` for full details.

- [x] Phase 12: Messaging Foundations & Renderer Primitives (4/4 plans) -- completed 2026-05-22
- [x] Phase 13: Conformance Refactor & ES-5 Supersession (10/10 plans) -- completed 2026-05-24
- [x] Phase 14: Drift Guard & Test Alignment (6/6 plans) -- completed 2026-05-24
- [x] Phase 14.1: Close gap: CMC-13 propagate declaresAgents/Mcp through import (2/2 plans) -- completed 2026-05-24
- [x] Phase 14.2: Address tech debt: CR-01 + retroactive Phase 12 / 14.1 gates (5/5 plans) -- completed 2026-05-24

</details>

<details>
<summary>Done v1.4 Structured Notification Messages (Phases 15-21) -- SHIPPED 2026-05-28</summary>

Replaced v1.3's string-based notify API + 34-rule ESLint drift-guard plugin with a type-driven structured `NotificationMessage` payload. Simplified the user-output spec to always render a marketplace header with indented plugin rows. Final state: 1120/1120 tests GREEN, ~4300 LoC net removal, V1 severity wrappers + `tests/lint-rules/` + `presentation/` + `shared/grammar/` all retired. See `.planning/milestones/v1.4-ROADMAP.md` for full details (when archived).

- [x] Phase 15: Type Model & ADR Refresh (3/3 plans) -- completed 2026-05-25
- [x] Phase 16: Renderer & Public API (Alongside V1) (6/6 plans) -- completed 2026-05-26
- [x] Phase 17: Spec Rewrite & Catalog UAT Migration (3/3 plans) -- completed 2026-05-26
- [x] Phase 17.1: V2 Grammar Amendment: Autoupdate Surface (INSERTED) (4/4 plans) -- completed 2026-05-26
- [x] Phase 17.2: renderScopeBracket orphan-fold contract fix (INSERTED) (4/4 plans) -- completed 2026-05-26
- [x] Phase 18: Migration Wave 1 -- Marketplace Orchestrator Family (7/7 plans) -- completed 2026-05-27
- [x] Phase 19: Migration Wave 2 -- Plugin Orchestrator Family (6/6 plans) -- completed 2026-05-27
- [x] Phase 20: Migration Wave 3 -- Edge Handlers & UsageError (6/6 plans) -- completed 2026-05-27
- [x] Phase 21: Final Teardown & GREEN Gate (4/4 plans) -- completed 2026-05-28

</details>

<details>
<summary>Done v1.4.1 Post-ship UAT Patches (Phases 22-26) -- CLOSED 2026-05-30</summary>

Closed the 8 gaps surfaced by the v1.4 milestone-spanning UAT: reload-hint suppression on read-only/no-op marketplace ops (G-MIL-01/02/06), plugin.json version tier-2 fallback (G-MIL-05), hash-version `v#<7hex>` display (G-MIL-08), `{lsp}` grammar token rename (G-MIL-04), runtime reproduction of indent ladder (G-MIL-03 refuted) and tab-completion gap (G-MIL-07 deferred-with-finding). 1137/1137 tests GREEN at close.

- [x] Phase 22: Reload-hint Discipline Family (1/1 plans) -- completed 2026-05-29
- [x] Phase 23: Version Display Bundle (2/2 plans) -- completed 2026-05-29
- [x] Phase 24: Grammar Consistency (1/1 plans) -- completed 2026-05-29
- [x] Phase 25: Runtime Publish & Verification (3/3 plans) -- completed 2026-05-29
- [x] Phase 26: GREEN Gate Close (1/1 plans) -- completed 2026-05-30

</details>

<details>
<summary>Done v1.5 Notification Output Polish (Phases 27-29) -- SHIPPED 2026-05-31</summary>

8 UXG output-grammar and severity-presentation refinements from the 2026-05-30 hands-on UAT sweep. Benign no-ops suppressed from `Warning:` (UXG-02), autoupdate marker grammar corrected (UXG-04), update no-op renders `(skipped)` (UXG-05), `<last-updated>` timestamp dropped (UXG-01), summary line prepended to error/warning cascades (UXG-07), update of manifest-absent plugin classifies as `(failed)` (UXG-08). 1168/1168 tests GREEN. Full details: `.planning/milestones/v1.5-ROADMAP.md`.

- [x] Phase 27: Marketplace & Autoupdate Output Grammar (5/5 plans) -- completed 2026-05-31
- [x] Phase 28: Severity Routing & Label Discipline (2/2 plans) -- completed 2026-05-31
- [x] Phase 29: Notification Label Suppression & Update Classification (3/3 plans) -- completed 2026-05-31

</details>

<details>
<summary>Done v1.6 GitHub Private Marketplace Authentication (Phases 30-36) -- SHIPPED 2026-06-01</summary>

On-demand Device Flow auth for private GitHub marketplace sources. Tries `git credential fill` first (silent reuse); triggers Device Flow only on a cache miss or 401; stores the resulting token via `git credential approve`; evicts via `git credential reject` on `onAuthFailure`. No env vars required. Two new modules (`platform/git-credential.ts`, `domain/github-auth.ts`) plus targeted wiring changes. 10/10 AUTH requirements.

- [x] Phase 30: Duplicate Type Fix (AUTH-10) (completed 2026-06-01)
- [x] Phase 31: Credential Subprocess Layer (AUTH-06, AUTH-08, AUTH-09) (completed 2026-06-01)
- [x] Phase 32: Device Flow State Machine (AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-07) (completed 2026-06-01)
- [x] Phase 33: git.ts Auth Wiring (AUTH-01, AUTH-02) (completed 2026-06-01)
- [x] Phase 34: GitOps Interface Threading (AUTH-01, AUTH-02) (completed 2026-06-01)
- [x] Phase 35: Orchestrator Call Sites & Output Catalog (AUTH-01, AUTH-02, AUTH-03)
- [x] Phase 36: Integration Gate (all AUTH) (completed 2026-06-01)

</details>

<details>
<summary>Done v1.7 Transaction Resilience Hardening (Phases 37-41) -- SHIPPED 2026-06-02</summary>

Eight correctness fixes to the existing saga/two-phase-commit infrastructure: phase-ledger
undo gap, parallel-rename orphan leaks in agents and commands bridges, ghost state records
on partial cascade unstage, update.ts state-before-commit divergence, reinstall blocking
on orphan targets, and inline documentation for two already-safe patterns. No new
dependencies; no user-visible behavior changes on the happy path.

- [x] Phase 37: Phase-Ledger Undo Gap (TR-02)
- [x] Phase 38: Sequential Commit Loops + Orphan Tolerance (TR-01, TR-05, TR-06)
- [x] Phase 39: Cascade Ghost Record (TR-03)
- [x] Phase 40: Update State-Before-Commit Reorder (TR-04)
- [x] Phase 41: Documentation and Test Closeout (TR-07, TR-08)

</details>

**Active v1.8 Plugin and Marketplace Info Commands (Phases 42-44)**

Two new read-only detail-surface commands (`/claude:plugin marketplace info <name>` and `/claude:plugin info <plugin>@<marketplace>`) picking up the PRD-deferred `info` subcommand. Both work on uninstalled, installed, and unavailable targets, support `--scope user|project` filtering, render per-scope when no scope is given, read existing local data only (preserves NFR-5), and lock byte-form via the catalog UAT.

- [ ] **Phase 42: Type Model & Render Seam Foundations** -- Land `MarketplaceInfoMessage` / `PluginInfoMessage` discriminated-union variants in `shared/notify.ts`, the `wrapDescription(text, indentCol, wrapCol)` renderer helper, and the new `"not added"` REASON in the closed-set tuple -- in one atomic commit alongside the first catalog state and UAT fixture that consume them.
- [ ] **Phase 43: Marketplace Info Command** -- Edge handler + orchestrator + completion + catalog states + UAT fixtures for `marketplace info <name> [--scope user|project]`; closes the marketplace half of per-scope rendering, completion plumbing, and catalog UAT coverage.
- [ ] **Phase 44: Plugin Info Command** -- Edge handler + orchestrator + per-scope rendering + completion mode + `components: not resolved` marker + catalog states + UAT fixtures for `plugin info <plugin>@<marketplace> [--scope user|project]`; closes the milestone with the second info surface.

## Phase Details

<details>
<summary>Shipped milestones -- Phases 15-41 historical details (v1.4 → v1.7)</summary>

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
2. `notify()` derives severity from contents (failed -> error, `skipped`/`manual recovery` -> warning, otherwise success), emits the `/reload to pick up changes` trailer iff any plugin status is in `{installed, updated, reinstalled, uninstalled}` or any marketplace status is set, and probes `pi-subagents` / `pi-mcp-adapter` at render time for each declared `Dependency`. No caller-supplied severity, reload flag, or probe state.
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

- [x] 17.1-01-PLAN.md -- Extend MARKETPLACE_STATUSES 4->7 + add reasons? on MarketplaceNotificationMessage + update notify-types.test.ts closed-set + shape proofs (D-17.1-01, D-17.1-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 17.1-02-PLAN.md -- Add 3 new renderMpHeader arms + extend computeSeverity (skipped->warning) + extend shouldEmitReloadHint (autoupdate enabled/disabled trigger) + 5 new byte-equality tests in notify-v2.test.ts (D-17.1-02, D-17.1-05)

**Wave 3** *(blocked on Wave 2 completion; 17.1-03 and 17.1-04 parallel)*

- [x] 17.1-03-PLAN.md -- Rewrite docs/output-catalog.md autoupdate section with 5 state blocks + replace catalog-uat.test.ts fixture map + update messaging-style-guide.md pointer 4->7 (D-17.1-03, D-17.1-04, D-17.1-06)
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

**Plans:** 6/6 plans complete

Plans:

**Wave 1** *(pilot -- locks the V2 inline-cascade construction recipe block-comment for Wave 2 to mirror)*

- [x] 19-01-PLAN.md -- Migrate `orchestrators/plugin/uninstall.ts` (5 V1 callsites: 3 migrated, 2 DROPPED per D-19-01); embed Wave-1-pilot recipe block-comment + V2 byte-exact tests (D-19-04 / D-19-05)

**Wave 2** *(parallel migrations -- depend on Wave 1)*

- [x] 19-02-PLAN.md -- Migrate `orchestrators/plugin/install.ts` (8 V1 callsites: 3 migrated, 5 DROPPED per D-19-01); retire `composeRollbackPartialBody` per D-19-03; thread `RollbackPartial.cause` directly per RESEARCH Finding 1
- [x] 19-03-PLAN.md -- Migrate `orchestrators/plugin/list.ts` (3 V1 callsites: 2 migrated, 1 DROPPED per D-19-01); remove `PROBE_FAILURES` module-level capture-buffer + drain entirely
- [x] 19-04-PLAN.md -- Migrate `orchestrators/plugin/reinstall.ts` (7 V1 callsites + dispatch ternary + 2 cascadeSummary calls: 5 migrated, 2 DROPPED per D-19-01); retire 2 cascadeSummary calls per D-19-02; fold manual-recovery anchor into cascade plugins[] as PluginManualRecoveryMessage variant
- [x] 19-05-PLAN.md -- Migrate `orchestrators/plugin/update.ts` (7 V1 callsites + dispatch ternary + 1 cascadeSummary call: 6 migrated, 1 DROPPED per D-19-01); retire cascadeSummary at line 929 per D-19-02; PluginUpdatedMessage with required from/to per D-15-04 (RESEARCH Finding 3 corrects CONTEXT line-attribution for the 4 direct-path failures)

**Wave 3** *(lint narrowing + final gate -- depends on all of Wave 2)*

- [x] 19-06-PLAN.md -- Add `"extensions/pi-claude-marketplace/orchestrators/plugin/**"` to MSG-Block 1 + MSG-Block 1b ignores per D-19-08; final end-to-end SC #1..#4 verification

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

**Plans:** 6/6 plans complete

**Wave 1** *(mechanical sweep -- low risk; atomic single commit)*

- [x] 20-01-usage-error-signature-sweep-PLAN.md -- Migrate all 30 V1 3-arg `notifyUsageError(ctx, msg, USAGE)` callsites across 13 production edge files (router + plugin/shared + 5 marketplace handlers + 6 plugin handlers) to V2 1-arg `notifyUsageError(ctx, { message: msg, usage })`; preserve mixed `notifyError, notifyUsageError` imports in bootstrap.ts + import.ts (Plan 20-03 drops them with catch-alls) (SNM-23; D-20-01, D-20-04, D-20-06)

**Wave 2** *(parallel-safe migrations -- depend on Wave 1; disjoint files per D-20-05)*

- [x] 20-02-import-cascade-migration-PLAN.md -- Migrate `orchestrators/import/execute.ts` cascade: retire `composeImportSummary` + `formatClaudeImportSummary` + `spliceSourceMismatchDiagnostics` + `orphanDiagnosticLines` + V1 PREAMBLE; DROP outer try/catch + line-1001 catastrophic-error per A3 default; REPLACE line-1018 dispatch ternary with single V2 `notify(opts.ctx, opts.pi, { marketplaces })` constructing payload inline; locked A1-A3 mappings (DROP marketplace-failed/unmappable warnings, orphan diagnostics, "Already up to date" notice); rewrite tests/orchestrators/import/execute.test.ts to V2 byte-exact via makeCtx() (D-20-02, D-20-05, D-19-02 strict mirror)
- [x] 20-03-edge-handler-catchall-drop-PLAN.md -- DROP 2 V1 `notifyError` catch-all wrappers in `edge/handlers/plugin/bootstrap.ts:57-66` + `edge/handlers/plugin/import.ts:40-50` (truly catastrophic throws bubble to Pi runtime per D-20-03); clean `notifyError` + `errorMessage` imports from both files; DELETE catch-all test at `tests/edge/handlers/import.test.ts:111-123` outright per D-19-01 (D-20-03, D-20-05, D-20-06)

**Wave 3** *(lint narrowing + final gate -- depends on all of Wave 2)*

- [x] 20-04-lint-narrow-orchestrators-import-PLAN.md -- Add `"extensions/pi-claude-marketplace/orchestrators/import/**"` to MSG-Block 1's `ignores: [...]` array in `eslint.config.js` per D-20-07; MSG-Block 1b STAYS unchanged per IN-06 in-file rationale (MSG-GR-3 iteration discipline is V1-wrapper-INDEPENDENT); Blocks 2-6 STAY unchanged (orthogonal); final end-to-end SC #1..#5 verification (D-20-07)

**Wave 4** *(gap closure from REVIEW.md WR-01..03 + IN-01..03 -- depends on Wave 3)*

- [x] 20-05-importer-error-boundary-and-polish-PLAN.md -- WR-02 Option A: wrap installPlugin in try/catch in executeScopedPlan + route unexpected throws to result.unexpectedPluginFailures + new test locking partial-cascade preservation; WR-01/WR-03: rewrite stale comment in edge/handlers/plugin/import.ts:52-55 to cite execute.ts:518-528 + 577-608 + new installPlugin wrap (drop the execute.ts:745-755 ghost ref); IN-01: add MSG-Block 1b doc note noting orchestrators/import/** follows the same Block-1-ignore / Block-1b-keep parallel as orchestrators/plugin/**; IN-02: keep Object.freeze on the 3 import.ts sites (dominant codebase convention) and annotate each as defense-in-depth; IN-03: mark MarketplaceBlock.name and .scope readonly. IN-04 deferred.

**Wave 5** *(gap closure from REVIEW.md (post-closure) WR-01..02 -- depends on Wave 4)*

- [x] 20-06-citation-anchor-and-cross-scope-test-PLAN.md -- WR-01 Option B (REVIEW.md post-closure): replace line-anchored citations (`execute.ts:NNN-NNN`, `importClaudeSettings:NNN`) with function-anchored citations across edge/handlers/plugin/import.ts + orchestrators/import/execute.ts WR-02 comment + tests/orchestrators/import/execute.test.ts; WR-02 (post-closure): add sibling cross-scope regression test exercising selectedScopes: ["project", "user"] with installPlugin throwing on scope A and succeeding on scope B; asserts both scopes attempted, single merged notify() emission, and merged cascade rendering. Refinement only -- SNM-23 was already SATISFIED by Plans 20-01..20-05.

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

### Phase 22: Reload-hint Discipline Family

**Goal:** A read-only or zero-Pi-resource-change operation no longer emits the `/reload to pick up changes` trailer; the trailer is reserved for cases where at least one Pi-visible resource actually changed. Three currently-misfiring cases (G-MIL-01 add of empty mp, G-MIL-02 remove of empty mp, G-MIL-06 update with all-no-op plugin cascade) are corrected at the single `shouldEmitReloadHint` chokepoint, mirroring the G-21-01 pattern landed in Plan 21-04.

**Depends on:** v1.4 Phase 21 complete

**Requirements:** SNM-33

**Success Criteria** (what must be TRUE):

1. Running `/claude:plugin marketplace add <mp>` on a marketplace with zero installed plugins outputs the `(added)` header row but NO `/reload to pick up changes` trailer.
2. Running `/claude:plugin marketplace remove <mp>` on a marketplace that had no installed plugins outputs the `(removed)` header row but NO `/reload to pick up changes` trailer.
3. Running `/claude:plugin marketplace update <mp>` on a marketplace whose plugin cascade is all `(skipped) {up-to-date}` outputs the `(updated)` header + the cascade rows but NO `/reload to pick up changes` trailer.
4. State-changing variants still emit the trailer: `marketplace add` whose cascade installed at least one plugin, `marketplace remove` whose cascade uninstalled at least one plugin, and `marketplace update` whose cascade updated/reinstalled/installed/uninstalled at least one plugin all still terminate with `/reload to pick up changes`.

**Plans:** 1/1 plans complete
**Wave 1**

- [x] 22-01-PLAN.md -- Collapse shouldEmitReloadHint to plugin-row-only (D-22-01), make clean marketplace remove carry (uninstalled) rows (D-22-02), drop autoupdate fresh-flip trailer (D-22-03); catalog + fixture + test lockstep (SNM-33)

### Phase 23: Version Display Bundle

**Goal:** Versions render to the user with maximum signal: when a plugin declares a SemVer in its own `plugin.json` it appears as that SemVer (not a content hash), and when a hash-version is shown it uses a compact git-style short form (`v#<7hex>`) instead of the verbose `vhash-<12hex>`. Persistence remains hash-based per the PI-7 contract -- the changes are scoped to resolution and rendering.

**Depends on:** Phase 22

**Requirements:** SNM-34, SNM-35

**Success Criteria** (what must be TRUE):

1. When `marketplace.json` omits a `plugins[].version` but the plugin's own `<pluginRoot>/.claude-plugin/plugin.json` declares a version string (e.g. `"version": "0.1.5"`), installing or updating that plugin records and renders that version (e.g. `v0.1.5`), NOT a `vhash-…` token. A malformed, empty, or non-string `version` in plugin.json is accepted only as a non-empty string (no SemVer enforcement, per D-23-03); otherwise it falls through to the marketplace entry tier and ultimately the PI-7 hash fallback.
2. When the resolved version is a PI-7 content hash (`hash-<12hex>` shape), the user sees it rendered as `v#<7hex>` (git-style short SHA) -- e.g. `v#2ea95f8` instead of `vhash-2ea95f85703d` -- in every surface that renders versions (list rows, install/update/reinstall cascade rows, the `from -> to` arrow in update rows).
3. State.json byte form for hash-versioned plugins is unchanged: persisted `version` field remains `hash-<12hex>`. The PI-7 12-hex collision envelope is preserved internally for compare semantics; the 7-hex form is display-only.
4. Catalog spec (`docs/output-catalog.md`) examples use the new `v#<7hex>` form wherever a hash-version appears; the catalog UAT runner (`tests/architecture/catalog-uat.test.ts`) and `tests/shared/notify-v2.test.ts` byte fixtures are updated in lockstep and remain GREEN.

**Plans:** 2/2 plans complete

**Wave 1**

- [x] 23-01-PLAN.md -- SNM-34: reorder `resolvePluginVersion` to 3-tier (plugin.json `version` -> marketplace `entry.version` -> PI-7 hash) via in-place plugin.json re-read; fixture knob + new tier test + repaired PI-7 (a)/(b); amend SNM-34 / SC#1 wording (D-23-01/02/03)

**Wave 2** (serialized after Wave 1 per the `shared/notify.ts` convergence constraint, D-23-07)

- [x] 23-02-PLAN.md -- SNM-35: `looksLikeHashVersion` + `formatHashVersionForDisplay` helpers; route `renderVersion` + `composeVersionArrow` through the transform (`v#<7hex>`); catalog + `catalog-uat` + `notify-v2` byte-equality lockstep (D-23-04/05/06)

### Phase 24: Grammar Consistency

**Goal:** The `lspServers` camelCase token no longer leaks into user-visible output anywhere; the rendered REASON reads `lsp` per the v1.4 grammar contract (parallel to the single-word `{hooks}` carve-out), while the underlying manifest JSON key `lspServers` (a real `.claude-plugin/plugin.json` field name) stays untouched.

**Depends on:** Phase 23

**Requirements:** SNM-36

**Success Criteria** (what must be TRUE):

1. Running `/claude:plugin list` against a plugin whose manifest declares unsupported `lspServers` shows the row's reason brace block as `{lsp}`, never `{lspServers}`.
2. Running `/claude:plugin install` whose preflight surfaces an `lspServers` rejection row produces the same `{lsp}` rendering.
3. The `REASONS` closed-set tuple in `shared/notify.ts:79` no longer contains the string `"lspServers"`; the renamed discriminator `"lsp"` propagates via a type-driven compile cascade through the two detection-vs-emission seams in `orchestrators/plugin/list.ts` (`narrowResolverNotes`) and `orchestrators/plugin/install.ts` (`manifestFieldTokenFromNote`, via a `MANIFEST_FIELD_TO_REASON` map) plus the catalog/fixture byte-form lockstep -- the detection substrings stay camelCase `lspServers`, only the emitted Reason becomes `"lsp"` (D-24-04).
4. The manifest-side field name `lspServers` remains in `domain/components/plugin.ts:31` (typebox schema), `domain/resolver.ts:142,160`, and any related manifest-parsing surfaces -- changing it would break parsing of real Claude plugin manifests.

**Plans:** 1/1 plans complete

**Wave 1**

- [x] 24-01-PLAN.md -- SNM-36: rename the `REASONS` closed-set member `"lspServers"` -> `"lsp"` and rewire both detection-vs-emission seams (`list.ts::narrowResolverNotes`, `install.ts::manifestFieldTokenFromNote` via a `MANIFEST_FIELD_TO_REASON` map); catalog + `catalog-uat` + `install.test` byte-form lockstep with the KEEP-bucket false-GREEN guard; fold 6 stale `shared/grammar/reasons.ts` pointers; amend ROADMAP/REQUIREMENTS/UAT/PROJECT "lsp servers" -> "lsp" (D-24-01..09; single atomic commit per D-24-07)

### Phase 25: Runtime Publish & Verification

**Goal:** The v1.4 source (v0.2.0) is loadable in the user's Pi runtime so v1.4-specific behavior can be exercised end-to-end; the two remaining UAT findings that were unverifiable against the v0.1.7 runtime (G-MIL-03 indent ladder, G-MIL-07 tab completion) are reproduced or refuted in the live v1.4 environment, with a fix landed or a not-a-bug rationale recorded per finding.

**Depends on:** Phase 24

**Requirements:** SNM-37, SNM-38, SNM-39

**Success Criteria** (what must be TRUE):

1. The Pi runtime loads pi-claude-marketplace v0.2.0 from source via `scripts/pi.sh` (sandbox home) -- NOT a real `npm publish` / `npm link` (D-25-01); v1.4 identity is proven by a behavioral byte-form smoke (NOT `pi --version`, which is moot under an `-e` source-load per D-25-04) asserting a `/claude:plugin list` at the pre-tui notify boundary shows v1.4 catalog-conformant byte forms: no `/reload` trailer on read-only list, `v#<7hex>` hash display, `{lsp}` not `{lspServers}`. Real-publish / packaged-artifact validation is deferred (D-25-06).
2. G-MIL-03 (indent ladder) is conclusively reproduced or refuted against the v1.4 runtime: leading-whitespace byte counts of a representative `/claude:plugin list` output are compared against the catalog `docs/output-catalog.md` 2/4/6 ladder per D-16-08. A real off-by-one bug is fixed at the renderer with a regression test; otherwise a not-a-bug rationale or catalog wording clarification is recorded.
3. G-MIL-07 (tab completion for `/claude:plugin update @<TAB>` empty) is conclusively reproduced or refuted against the v1.4 runtime: an installed fixture with at least one plugin per marketplace is loaded, the completion is triggered, and the result is captured. A real runtime gap is traced to its root cause (provider divergence, Pi-tui consumption, or scope-root mismatch) and fixed; otherwise a not-a-bug or defer-with-rationale outcome is recorded.

**Plans:** 3/3 plans complete

**Wave 1 (gate)**

- [x] 25-01-PLAN.md -- SNM-37: source-load v0.2.0 via `scripts/pi.sh` (sandbox home) + behavioral byte-form smoke proving v1.4 identity (no `/reload` trailer on read-only list, `v#<7hex>`, `{lsp}`); amend SNM-37 text + SC#1 in lockstep (D-25-03/04); real-publish validation deferred (D-25-06)

### Phase 26: GREEN Gate Close

**Goal:** Final `npm run check` GREEN end-to-end after Phases 22-25 land; the v1.4.1 milestone closes with all SNM-33..SNM-40 regression tests confirmed in the suite.

**Depends on:** Phase 25

**Requirements:** SNM-40

**Plans:** 1/1 plans complete

**Wave 1**

- [x] 26-01-PLAN.md -- SNM-40 GREEN gate close

### Phase 27: Marketplace & Autoupdate Output Grammar

**Goal:** Bring the marketplace-surface output grammar in line with operator expectations -- drop the noisy `<last-updated>` marker, give autoupdate an explicit marker grammar, fix the misleading `marketplace update` no-op status, and correct the stale catalog autoupdate-default claim.

**Requirements:** UXG-01, UXG-04, UXG-05, UXG-06

**Success criteria:**

1. `marketplace list` renders no `<last-updated <iso>>` marker on any header; catalog + catalog-uat fixtures updated in lockstep and GREEN.
2. `marketplace autoupdate` / `noautoupdate` render `<autoupdate>` / `<no autoupdate>` markers (fresh flip) and `<autoupdate> {already autoupdate}` / `<no autoupdate> {already no autoupdate}` (idempotent); the `(autoupdate enabled/disabled)` and `(skipped) {already enabled/disabled}` forms are gone.
3. `marketplace update` with no plugin change renders `(skipped) {up-to-date}`, not `(updated)` -- for both autoupdate-OFF (manifest-only refresh) and autoupdate-ON (cascade) marketplaces.
4. `docs/output-catalog.md` correctly documents that `marketplace add` never auto-enables autoupdate, and the autoupdate heading matches the `autoupdate`/`noautoupdate` verbs.
5. `npm run check` + catalog-uat GREEN.

**Plans:** 5/5 plans complete

- [x] 27-01-PLAN.md (Wave 1) -- UXG-06: correct github-source autoupdate-default prose + rename the autoupdate heading to the real `autoupdate`/`noautoupdate` verbs + sync the catalog-uat FIXTURES key byte-for-byte
- [x] 27-02-PLAN.md (Wave 2) -- UXG-01: drop the `<last-updated <iso>>` token from the list-surface renderer + catalog + notify-v2 + catalog-uat + list orchestrator test; retain the `lastUpdatedAt` field in state/type
- [x] 27-03-PLAN.md (Wave 3) -- UXG-04: autoupdate flip emits `<autoupdate>`/`<no autoupdate>` markers + idempotent `{already autoupdate}`/`{already no autoupdate}` via Strategy B (rename 2 REASONS, rewrite renderer arms, no MARKETPLACE_STATUSES/MARKERS churn); orchestrator payload + catalog + 3 byte-test surfaces in lockstep
- [x] 27-04-PLAN.md (Wave 4) -- UXG-05: manifest content-compare change detector in update.ts; autoupdate-OFF no-op emits `(skipped) {up-to-date}` (warning, no trailer), changed path stays `(updated)`; catalog + byte tests + orchestrator change-detector tests; phase GREEN gate + nyquist sign-off
- [x] 27-05-PLAN.md (Wave 1, gap closure) -- UXG-05 UAT Test-3 gap: autoupdate-ON `marketplace update` no-op now consults `snapshot.changed` + every-plugin-`unchanged` to emit `(skipped) {up-to-date}` instead of always `(updated)`; folds in WR-01 (correct `.Parse` comment) + WR-02 (ENOENT-narrow PRE-read catch) + WR-03 (autoupdate-ON no-op/changed orchestrator + catalog-uat + notify-v2 coverage)

### Phase 28: Severity Routing & Label Discipline

**Goal:** Make severity presentation match operator expectations -- stop warning on benign no-ops, and stop the host severity label from breaking multi-line cascade formatting -- while preserving the severity color and the single-line label.

**Requirements:** UXG-02, UXG-03

**Success criteria:**

1. A cascade whose only non-success rows are benign skips (`{up-to-date}` / `{already …}`) computes `info` severity (no severity arg); actionable skips still compute `warning`.
2. Multi-line cascade notifications render without the `Error:`/`Warning:` host label; single-line messages (usage errors) retain it; severity color retained in both.
3. UXG-03's feasibility is confirmed via a spike against the Pi host API; if the host cannot render color without the label, UXG-03 is recorded as an upstream-tracked finding with the spike evidence rather than forced in-extension.
4. `npm run check` + catalog-uat GREEN.

**Plans:** 2/2 plans complete
Plans:

- [x] 28-01-PLAN.md -- UXG-02: rewrite computeSeverity as the D-28-06 5-arm benign-softening ladder (+ BENIGN_REASONS, both test gates, ADR/style-guide/catalog prose sync)
- [x] 28-02-PLAN.md -- UXG-03: run the host label/color feasibility spike and record the upstream-tracked finding (defer-with-finding per D-28-12)

### Phase 29: Notification Label Suppression & Update Classification

**Goal:** Stop the host `Error:`/`Warning:` label from prefixing multi-line cascade output (the residual UXG-03 pain, now fixable in-extension because severity color is expendable per the operator), and make `update` of a nonexistent plugin report the same `{not in manifest}` / `failed` outcome as `install`. Surfaced by the 2026-05-31 runtime UAT; reopens the v1.5 milestone.

**Requirements:** UXG-07, UXG-08

**Success criteria:**

1. Multi-line structured `notify()` cascades emit NO severity 2nd arg, so the host renders them via `showStatus` -- no `Error:`/`Warning:` label prefix, indent ladder intact. The single-line `notifyUsageError()` retains `"error"` (entrypoint-split, D-28-13).
2. `update <plugin>@<marketplace>` of a plugin absent from the marketplace manifest renders `(failed) {not in manifest}` (matching `install`), not `(skipped) {not installed}`; a real-but-uninstalled plugin still renders `{not installed}`.
3. The now-vestigial `computeSeverity` warning/error arms are retired or made dormant (decided in discuss/plan); `shared/notify.ts` + `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` + `tests/shared/notify-v2.test.ts` move in lockstep.
4. `npm run check` GREEN; catalog-uat byte gate GREEN.

**Plans:** 3/3 plans complete

**Wave 1** *(parallel: plans 01 + 03 have no file overlap)*

- [x] 29-01-PLAN.md -- UXG-07: add buildSummaryLine helper + update notify() to prepend summary for error/warning severity + notify-v2.test.ts lockstep (D-29-01/02/03/04/06)
- [x] 29-03-PLAN.md -- UXG-08: reorder preflightUpdate to consult manifest before not-installed guard; absent-from-manifest + not-installed returns failed {not in manifest} (D-29-08/09)

**Wave 2** *(blocked on Wave 1)*

- [x] 29-02-PLAN.md -- UXG-07 lockstep: output-catalog.md byte blocks + catalog-uat.test.ts fixtures + messaging-style-guide.md + ADR amendment (D-29-06/07)


### Phase 30: Duplicate Type Fix

**Goal:** Remove the duplicate `GitCredentials` type declaration from `platform/git.ts` so `npm run check` passes clean -- this is the prerequisite gate that unblocks all auth wiring.

**Depends on:** Phase 29 (v1.5 complete)

**Requirements:** AUTH-10

**Success Criteria** (what must be TRUE):

1. `platform/git.ts` compiles without the duplicate `GitCredentials` type error; `npm run check` exits 0.
2. No functional change to clone/fetch behavior; all existing tests remain GREEN.

**Plans:** 1/1 plans complete

**Wave 1**

- [x] 30-01-PLAN.md -- Export canonical GitCredentials type to platform/git.ts; npm run check GREEN gate (AUTH-10)

### Phase 31: Credential Subprocess Layer

**Goal:** `platform/git-credential.ts` wraps `git credential fill/approve/reject` as injectable `CredentialOps` interface so tests never touch the developer's OS keychain.

**Depends on:** Phase 30

**Requirements:** AUTH-06, AUTH-08, AUTH-09

**Success Criteria** (what must be TRUE):

1. `git credential fill` returns a `GitAuth`-shaped credential on a hit and `null` on a miss (non-zero exit / empty stdout); no hang on missing blank-line terminator + `stdin.end()`.
2. `git credential approve` persists a credential to the OS keychain; `git credential reject` evicts it -- both confirmed by the `CredentialOps` interface contract and unit tests with a mock implementation.
3. The access token never appears in any error message or `ctx.ui.notify` output; architecture-level tests assert no credential field leaks through state write paths.
4. `npm run check` GREEN; `CredentialOps` interface defined with a `makeMockCredentialOps` test helper following the `GitOps`/`makeMockGitOps` pattern.

**Plans:** 2/2 plans complete

**Wave 1**

- [x] 31-01-PLAN.md -- Narrow tests/architecture/no-shell-out.test.ts D-21 gate with ALLOWED_CHILD_PROCESS_FILES whitelist (Phase 31 narrowing) + add tests/platform/ to npm test glob (architecture-gate prerequisite for Plan 31-02)

**Wave 2** *(blocked on Wave 1)*

- [x] 31-02-PLAN.md -- Implement extensions/pi-claude-marketplace/platform/git-credential.ts (CredentialOps interface + DEFAULT_CREDENTIAL_OPS spawn-based impl) + tests/helpers/credential-mock.ts (makeMockCredentialOps) + tests/platform/git-credential.test.ts + tests/architecture/no-credential-leak.test.ts (AUTH-09 architecture gate) + README entry (AUTH-06, AUTH-08, AUTH-09)

### Phase 32: Device Flow State Machine

**Goal:** `domain/github-auth.ts` implements the full GitHub Device Flow loop with injectable `DeviceFlowHttp` + `CredentialOps` seams -- poll, slow_down handling, timeout/access_denied error paths, and `ctx.ui.notify` via a pre-bound `notifyFn` callback.

**Depends on:** Phase 31

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-07

**Success Criteria** (what must be TRUE):

1. Device Flow displays `user_code` + `verification_uri` via `ctx.ui.notify` only (no `process.stdout` writes); the token itself never appears in any notification.
2. `slow_down` responses increment `currentInterval` cumulatively by 5 s per occurrence; two consecutive `slow_down` responses produce `initial + 10` on the third poll.
3. `access_denied` and `expired_token` exit the poll loop immediately with a clear, actionable error message (not a raw HTTP error object).
4. A rejected stored token triggers `git credential reject` eviction before Device Flow re-triggers (`onAuthFailure` path); the `authAttempted` boolean guard prevents an infinite retry loop.

**Plans:** 1/2 plans complete

### Phase 33: git.ts Auth Wiring

**Goal:** `platform/git.ts` `CloneOptions`/`FetchOptions` accept optional auth callbacks and `buildAuthCallbacks` assembles the `onAuth`/`onAuthFailure` closure pair that isomorphic-git needs.

**Depends on:** Phase 32

**Requirements:** AUTH-01, AUTH-02

**Success Criteria** (what must be TRUE):

1. `buildAuthCallbacks` returns an `onAuth` that calls `credentialOps.fill` first; only on a miss does it invoke the Device Flow `onAuthRequired` handler.
2. `onAuthFailure` calls `credentialOps.reject` then returns `{ cancel: true }` when `authAttempted` is already true (second failure), preventing the isomorphic-git infinite-retry loop (CP-9).
3. Exceptions from `onAuth`/`onAuthFailure` are caught and return `{ cancel: true }` rather than propagating raw (CP-10).
4. `npm run check` GREEN; no change to existing clone/fetch call sites yet.

**Plans:** 1/1 plans complete

**Wave 1**

- [x] 33-01-PLAN.md -- buildAuthCallbacks + AuthAttemptResult/OnAuthRequiredFn local types in platform/git.ts; CloneOptions/FetchOptions opt-in auth bundle; tests/platform/git-auth-callbacks.test.ts covers fill-hit, fill-miss->DF, CP-9 cancel, CP-10 catch (AUTH-01, AUTH-02)

### Phase 34: GitOps Interface Threading

**Goal:** `GitOps.clone` and `GitOps.fetch` gain an optional `onAuthRequired` field threaded through `shared.ts`, `DEFAULT_GIT_OPS`, and `refreshGitHubClone` so orchestrators can inject auth without knowing the git platform internals.

**Depends on:** Phase 33

**Requirements:** AUTH-01, AUTH-02

**Success Criteria** (what must be TRUE):

1. `GitOps` interface `clone`/`fetch` signatures accept an optional `onAuthRequired` callback; `DEFAULT_GIT_OPS` wires `buildAuthCallbacks` from `platform/git.ts` when the callback is provided.
2. `refreshGitHubClone` threads `onAuthRequired` from its options bag into the `clone`/`fetch` calls.
3. Existing tests that use `makeMockGitOps` remain GREEN with no changes (backward-compatible optional field).
4. `npm run check` GREEN.

**Plans:** 1/1 plans complete

Plans:

**Wave 1**

- [x] 34-01-PLAN.md -- Widen GitOps.clone/fetch + refreshGitHubClone with optional `auth?: GitAuthBundle` bundle; verify DEFAULT_GIT_OPS structural pass-through; lock auth-threading via 3 new shared.test.ts unit tests (AUTH-01, AUTH-02)

### Phase 35: Orchestrator Call Sites & Output Catalog

**Goal:** `marketplace/add.ts` and `marketplace/update.ts` construct and pass the auth closure; the Device Flow `ctx.ui.notify` prompt pattern is registered in `docs/output-catalog.md` and the catalog UAT fixture.

**Depends on:** Phase 34

**Requirements:** AUTH-01, AUTH-02, AUTH-03

**Success Criteria** (what must be TRUE):

1. `addGithubInGuard` constructs the `onAuthRequired` closure (pre-binding `ctx` + `notifyFn`) and passes it to `refreshGitHubClone`; private-repo `marketplace add` triggers Device Flow on first access.
2. `refreshRecord` in `update.ts` passes the `onAuthRequired` closure; subsequent `marketplace update` against the same host reuses the stored token silently (no Device Flow prompt).
3. The Device Flow user-code prompt (`user_code` + `verification_uri`) appears in `docs/output-catalog.md` with a catalog-uat fixture proving the byte form.
4. `npm run check` GREEN; catalog-uat byte gate GREEN.

**Plans:** 4/4 plans executed

**Wave 0** *(pre-cleanup -- unblocks Wave 1 parallel execution)*

- [x] 35-00-PLAN.md -- Widen `tests/helpers/git-mock.ts` `cloneCalls` + `fetchCalls` element types with `auth?: GitAuthBundle` so Plans 35-01 + 35-02 are file-disjoint in Wave 1. Runtime push form (`{ ...opts }`) byte-unchanged; type-only widening (AUTH-01, AUTH-02)

**Wave 1** *(parallel-safe: Plan 03 has no Wave 0 dependency; Plans 01 + 02 depend on Wave 0's helper widening but touch disjoint orchestrator + test files relative to each other and to Plan 03)*

- [x] 35-01-PLAN.md -- Wire Device Flow `onAuthRequired` closure into `addGithubInGuard`; forward `GitAuthBundle` to `gitOps.clone`; optional `credentialOps?` + test-seam `deviceFlowHttp?` on `AddMarketplaceOptions`; 3 new tests in `add.test.ts` covering fill-hit silent reuse, fill-miss triggers Device Flow, by-reference forwarding (AUTH-01)
- [x] 35-02-PLAN.md -- Wire Device Flow `onAuthRequired` closure into `refreshRecord`; forward `GitAuthBundle` as 5th positional arg of `refreshGitHubClone`; optional `credentialOps?` + test-seam `deviceFlowHttp?` on `UpdateMarketplaceOptions` + `UpdateAllMarketplacesOptions`; 2 new tests in `update.test.ts` covering AUTH-02 silent reuse + by-reference forwarding (AUTH-02)
- [x] 35-03-PLAN.md -- Document the Device Flow user-code prompt in `docs/output-catalog.md` as a new `## Out-of-band notifications` H2 section; new byte-form lock test at `tests/shared/device-flow-prompt.test.ts`; extend AUTH-09 architecture gate to scan `add.ts` + `update.ts` (closes Phase 33 review WR-02) (AUTH-03)

### Phase 36: Integration Gate

**Goal:** All AUTH requirements are demonstrably satisfied: `npm run check` GREEN, all failure paths tested (slow_down, timeout, access_denied, reject-evict, cancel guard), and the env-var credential path removed.

**Depends on:** Phase 35

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10

**Success Criteria** (what must be TRUE):

1. `npm run check` exits 0 with all existing tests GREEN; no regression in test count from Phase 30 baseline.
2. The old env-var credential path is removed from `platform/git.ts` and any call sites; NFR-5 (no network on non-add/update commands) is unaffected.
3. All Device Flow failure paths have unit coverage: `slow_down` cumulative interval, `access_denied` early exit, `expired_token` early exit, `onAuthFailure` `authAttempted` cancel guard, `git credential fill` miss (null return), `git credential reject` before re-auth.
4. Architecture test confirms no credential field in state write functions (SEC-1/SEC-3); token-absence spot-check passes.

**Plans:** 1/1 plans complete

**Wave 1**

- [x] 36-01-PLAN.md -- Integration test (auth-e2e.test.ts: 3 tests) + REQUIREMENTS.md AUTH-01..AUTH-10 marked [x]

</details>

### Phase 42: Type Model & Render Seam Foundations

**Goal:** The complete v1.8 info-surface type model lives in `shared/notify.ts` with the new `"not added"` REASON closed-set member and the `wrapDescription` renderer helper -- all landed atomically with the first catalog state and UAT fixture that consume them, per the v1.3 retrospective atomic-supersession lesson. Phases 43 and 44 then build their command surfaces on top of this contract without further closed-set churn.

**Depends on:** v1.7 Phase 41 complete

**Requirements:** INFO-04, INFO-08

**Success Criteria** (what must be TRUE):

1. `shared/notify.ts` exports two new discriminated-union variants reachable from `NotificationMessage`: `MarketplaceInfoMessage` (carries marketplace header + source-kind detail line + optional `last_updated` + optional `description`, with NO plugin rows) and `PluginInfoMessage` (carries marketplace header + plugin row with status `installed`/`available`/`unavailable`/`failed`, plus either a resolved-components shape with sorted per-kind component arrays and an optional `dependencies` field OR an unresolved-marker shape encoding the `components: not resolved` state via a `componentsResolved: false` discriminator -- the renderer's switch chooses between the two shapes via discriminated-union exhaustiveness per NFR-7).
2. `REASONS` tuple in `shared/notify.ts` contains the new entry `"not added"`; `tests/architecture/notify-types.test.ts` length lock and closed-set proof are updated to the new count and the new member; rendering a row with `reason: "not added"` produces the byte form `⊘ <name> [<scope>] (failed) {not added}` at column 0 with severity `error`. This change lands in ONE commit alongside the first catalog state that consumes it (`docs/output-catalog.md` `--scope` mismatch fixture) and the matching `tests/architecture/catalog-uat.test.ts` fixture.
3. A new file-private `wrapDescription(text: string, indentCol: number, wrapCol: number): string[]` helper in `shared/notify.ts` hard-wraps a description at the requested column count (no ellipsis), preserving word boundaries and emitting one line per wrap segment indented at `indentCol`; per-status unit tests in `tests/shared/notify-v2.test.ts` lock the behavior at the 4-col-indent / 66-col-total used by `plugin info`.
4. The renderer switch in `notify()` has new arms for both info variants gated by exhaustive `assertNever` defaults; the existing 10-arm plugin status + 7-arm marketplace status surfaces are byte-unchanged for all non-info call sites (Phase 42 produces zero behavior change for any v1.0-v1.7 command).
5. `npm run check` exits 0; catalog UAT byte-equality remains GREEN; the atomic-supersession commit contains the REASON tuple addition, the new types, the new helper, the new fixture(s) for `--scope` mismatch, and the catalog state(s) -- nothing else.

**Plans:** 1 plan

**Wave 1**

- [ ] 42-01-PLAN.md -- Atomic-supersession commit: extend NotificationMessage to a 3-arm discriminated union (CascadeNotificationMessage + MarketplaceInfoMessage + PluginInfoMessage); add `"not added"` to REASONS (length-lock + closed-set proof at 29); add file-private `wrapDescription` helper + renderMarketplaceInfo + renderPluginInfo; rewrite `notify()` dispatcher on `message.kind ?? "cascade"` with assertNever; add first catalog state (`scope-mismatch-not-added`) under new `## /claude:plugin marketplace info <name>` H2 + catalog-uat FIXTURES entry; per-status tests for wrapDescription + new render arms + cascade backward-compat; zero behavior change for any v1.0-v1.7 cascade call site (INFO-04, INFO-08)

### Phase 43: Marketplace Info Command

**Goal:** `/claude:plugin marketplace info <name> [--scope user|project]` lands as a working read-only command with byte-locked render, per-scope fan-out when no `--scope` is given, argument completion via the TC-5 union pattern, and full catalog UAT coverage of every status/scope state -- exercising the Phase 42 type model and `{not added}` REASON end-to-end.

**Depends on:** Phase 42

**Requirements:** INFO-01, INFO-03, INFO-06, INFO-07

**Success Criteria** (what must be TRUE):

1. Running `/claude:plugin marketplace info <name>` against a marketplace present in only one scope renders a single block: per-scope header `● <name> [<scope>]` with the `<autoupdate>` / `<no autoupdate>` marker, followed by `github: <owner>/<repo>` (with `#<ref>` suffix only when `ref` was originally specified) OR `path: <abs-path>`, optionally `last_updated: <ISO8601>` for github sources only, and optionally `description: <text>` when `marketplace.json` carries one. No plugin rows. No `/reload to pick up changes` trailer.
2. Running the same command against a marketplace present in both scopes (no `--scope` filter) renders two marketplace blocks separated by one blank line, project-scope first then user-scope, each conforming to the per-block byte form in SC #1 (per-scope fan-out via the existing `composeBlock` ordering in `shared/notify.ts`).
3. Running `/claude:plugin marketplace info <missing-name>` renders `⊘ <name> (failed) {not added}` and exits with error severity; running `/claude:plugin marketplace info <name> --scope <wrong-scope>` where the marketplace is present in the other scope renders `⊘ <name> [<wrong-scope>] (failed) {not added}` with error severity (`{not added}` REASON sourced from Phase 42).
4. `marketplace info <TAB>` returns the union of marketplace names across both scopes (TC-5 pattern matching `marketplace remove` / `marketplace update` / `marketplace autoupdate`); a new entry in the completion provider's TC-5 surface covers the verb.
5. `docs/output-catalog.md` gains a new H2 section `` ## `/claude:plugin marketplace info <name>` `` enumerating every state (github single-scope, path single-scope, github both-scopes, path both-scopes, `{not added}` missing-marketplace, `{not added}` `--scope` mismatch); each fenced byte block is paired with a fixture in `tests/architecture/catalog-uat.test.ts` FIXTURES map and byte-equality is GREEN.

**Plans:** 2 plans

**Wave 1**

- [ ] 43-01-PLAN.md -- Orchestrator + edge handler + TC-5 completion extension + `MarketplaceInfoCascadeMessage` fan-out variant; per-status notify-v2 byte tests + orchestrator/handler/completion integration tests; NFR-5 grep-gate on info.ts (INFO-01, INFO-03, INFO-06)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 43-02-PLAN.md -- Catalog states (`github-single-scope-full`, `github-single-scope-minimal`, `path-single-scope`, `path-single-scope-with-description`, `both-scopes-fan-out`, `absent-from-both`) + paired catalog-uat FIXTURES; preserves Phase 42's `scope-mismatch-not-added` byte-identical (INFO-07)

### Phase 44: Plugin Info Command

**Goal:** `/claude:plugin info <plugin>@<marketplace> [--scope user|project]` lands as a working read-only command using the install-cascade always-marketplace-header form, with status-aware plugin rows, hard-wrapped descriptions at col 4 indent / 66-col total, sorted-by-kind component lists, the `components: not resolved` marker for unsynced external sources, plugin-info argument completion in a new TC-6 mode, and full catalog UAT coverage -- closing the v1.8 milestone.

**Depends on:** Phase 43

**Requirements:** INFO-02, INFO-05

**Success Criteria** (what must be TRUE):

1. Running `/claude:plugin info <plugin>@<marketplace>` renders the marketplace header at column 0 (matching the install cascade form) followed by an indented plugin row with status `(installed)`, `(available)`, or `(unavailable)`; the row is followed by a description block hard-wrapped at col 4 indent / 66-col total width with no ellipsis (via the Phase 42 `wrapDescription` helper); component lists by kind appear sorted alphabetically by kind name (`agents`, `commands`, `mcp`, `skills`) with per-kind names sorted alphabetically; `dependencies: <plugin>@<marketplace>, ...` appears last when the plugin declares dependencies.
2. Running the command against a plugin whose `plugin.json` lives at an unsynced external source (separate git repo, npm, etc.) renders the marker line `components: not resolved` in place of the per-kind component lists; this state is driven by the Phase 42 `componentsResolved: false` discriminator on the `PluginInfoMessage` variant (no network access -- preserves NFR-5).
3. Running the command against a plugin present in both scopes (no `--scope` filter) renders two plugin blocks under their per-scope marketplace headers, separated by one blank line, in the existing per-scope ordering (project first, user second).
4. Running `/claude:plugin info <missing-plugin>@<known-marketplace>` renders `(failed) {not in manifest}` (existing reason); running against an unknown marketplace renders `{not added}` (Phase 42 REASON); running with `--scope` mismatch renders `{not added}` at the marketplace level.
5. `plugin info <TAB>` returns `<plugin>@<marketplace>` combos for all known plugins (installed + available + unavailable) across both scopes via a new `"info"` mode of the TC-6 plugin-ref completer; `docs/output-catalog.md` gains a new H2 section `` ## `/claude:plugin info <plugin>@<marketplace>` `` enumerating every state (installed single-scope, available single-scope, unavailable single-scope, installed-both-scopes, components-not-resolved, `{not in manifest}` missing-plugin, `{not added}` missing-marketplace, `{not added}` `--scope` mismatch); each fenced byte block is paired with a `catalog-uat.test.ts` fixture and byte-equality is GREEN; `npm run check` exits 0 -- v1.8 milestone closes.

**Plans:** 2 plans

**Wave 1**

- [ ] 44-01-PLAN.md -- Orchestrator + edge handler + TC-6 `info` completion mode + `PluginInfoCascadeMessage` fan-out variant + per-status notify-v2 byte tests + orchestrator/handler/completion/router integration tests; NFR-5 grep-gate on info.ts (INFO-02, INFO-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 44-02-PLAN.md -- Catalog states (`installed-single-scope`, `installed-single-scope-with-dependencies`, `available-single-scope`, `unavailable-single-scope`, `installed-both-scopes-fan-out`, `components-not-resolved`, `missing-plugin-not-in-manifest`, `missing-marketplace-not-added-absent-from-both`, `missing-marketplace-not-added-scope-mismatch`) + paired catalog-uat FIXTURES under new `## /claude:plugin info <plugin>@<marketplace>` H2; preserves Phase 42 + Phase 43 fixtures byte-identical (INFO-02, INFO-05; extends INFO-07 plugin-info catalog coverage)

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
| 15. Type Model & ADR Refresh                                         | v1.4      | 3/3            | Complete    | 2026-05-25 |
| 16. Renderer & Public API (Alongside V1)                             | v1.4      | 6/6            | Complete    | 2026-05-26 |
| 17. Spec Rewrite & Catalog UAT Migration                             | v1.4      | 3/3            | Complete    | 2026-05-26 |
| 17.1. V2 Grammar Amendment: Autoupdate Surface (INSERTED)            | v1.4      | 4/4            | Complete    | 2026-05-26 |
| 17.2. renderScopeBracket orphan-fold contract fix (INSERTED)         | v1.4      | 4/4            | Complete    | 2026-05-26 |
| 18. Migration Wave 1 -- Marketplace Orchestrator Family              | v1.4      | 7/7            | Complete    | 2026-05-27 |
| 19. Migration Wave 2 -- Plugin Orchestrator Family                   | v1.4      | 6/6            | Complete    | 2026-05-27 |
| 20. Migration Wave 3 -- Edge Handlers & UsageError                   | v1.4      | 6/6            | Complete    | 2026-05-27 |
| 21. Final Teardown & GREEN Gate                                      | v1.4      | 4/4            | Complete    | 2026-05-28 |
| 22. Reload-hint Discipline Family                                    | v1.4.1    | 1/1 | Complete    | 2026-05-29 |
| 23. Version Display Bundle                                           | v1.4.1    | 2/2 | Complete    | 2026-05-29 |
| 24. Grammar Consistency                                              | v1.4.1    | 1/1 | Complete    | 2026-05-29 |
| 25. Runtime Publish & Verification                                   | v1.4.1    | 3/3 | Complete    | 2026-05-29 |
| 26. GREEN Gate Close                                                 | v1.4.1    | 1/1 | Complete    | 2026-05-30 |
| 27. Marketplace & Autoupdate Output Grammar                          | v1.5      | 5/5 | Complete    | 2026-05-31 |
| 28. Severity Routing & Label Discipline                              | v1.5      | 2/2 | Complete    | 2026-05-31 |
| 29. Notification Label Suppression & Update Classification          | v1.5      | 3/3 | Complete    | 2026-05-31 |
| 30. Duplicate Type Fix                                               | v1.6      | 1/1 | Complete    | 2026-06-01 |
| 31. Credential Subprocess Layer                                      | v1.6      | 2/2 | Complete   | 2026-06-01 |
| 32. Device Flow State Machine                                        | v1.6      | 1/2 | Complete    | 2026-06-01 |
| 33. git.ts Auth Wiring                                               | v1.6      | 1/1 | Complete   | 2026-06-01 |
| 34. GitOps Interface Threading                                       | v1.6      | 1/1 | Complete    | 2026-06-01 |
| 35. Orchestrator Call Sites & Output Catalog                         | v1.6      | 4/4 | Complete    | 2026-06-01 |
| 36. Integration Gate                                                 | v1.6      | 1/1 | Complete   | 2026-06-01 |
| 37. Phase-Ledger Undo Gap                                            | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 38. Sequential Commit Loops + Orphan Tolerance                       | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 39. Cascade Ghost Record                                             | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 40. Update State-Before-Commit Reorder                               | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 41. Documentation and Test Closeout                                  | v1.7      | 1/1 | Complete   | 2026-06-02 |
| 42. Type Model & Render Seam Foundations                             | v1.8      | 1   | Planned     | -          |
| 43. Marketplace Info Command                                         | v1.8      | 0/2 | Planned     | -          |
| 44. Plugin Info Command                                              | v1.8      | 0/2 | Planned     | -          |
