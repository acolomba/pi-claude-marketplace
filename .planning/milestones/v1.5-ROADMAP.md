# Roadmap: pi-claude-marketplace

## Milestones

- Done **v1.0 successor architecture** -- Phases 1-7 (shipped 2026-05-11)
- Done **v1.1 Reinstall Command** -- Phases 8-9 (shipped 2026-05-14)
- Done **v1.2 Claude Settings Import** -- Phases 10-11 (shipped 2026-05-20)
- Done **v1.3 Consistent Messaging** -- Phases 12-14.2 (shipped 2026-05-25)
- Done **v1.4 Structured Notification Messages** -- Phases 15-21 (shipped 2026-05-28)
- Done **v1.4.1 Post-ship UAT Patches** -- Phases 22-26 (closed 2026-05-30)
- In progress **v1.5 Notification Output Polish** -- Phases 27-28 (active)

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

### Done v1.4.1 Post-ship UAT Patches (Phases 22-26)

Close the 8 gaps surfaced by the v1.4 milestone-spanning UAT (`.planning/v1.4-MILESTONE-UAT.md`) so v1.4's user-visible message surfaces match the catalog spec and user expectations end-to-end. Three bundles plus a reproduction phase. Most fixes converge on `shared/notify.ts`, `orchestrators/plugin/shared.ts`, and `orchestrators/plugin/list.ts`; phase boundaries respect that convergence to avoid intra-wave merge conflicts.

**Cross-cutting constraints applied to every v1.4.1 phase:**

- NFR-6: `npm run check` (typecheck + ESLint + Prettier + tests) stays green throughout.
- Catalog UAT byte-equality stays GREEN at every phase boundary. Phase 23 (SNM-35) updates the catalog byte forms for hash-version display; the catalog UAT runner is updated in lockstep.
- IL-2 / IL-3: All user-visible messages go through `ctx.ui.notify` from `shared/notify.ts` only; the single sanctioned `console.warn` at `persistence/migrate.ts` stays inline-disabled at the call site.
- Atomic commits per plan; no commits to `main`.
- No state migration tooling for already-installed `hash-<12hex>` plugins; SNM-34's tier-2 fallback fires at NEXT install/reinstall/update only.

- [x] **Phase 22: Reload-hint Discipline Family** -- Gate marketplace-level transition tokens (`MarketplaceAddedMessage` / `MarketplaceRemovedMessage` / `MarketplaceUpdatedMessage`) on `plugins[].some(state-change)` inside `shouldEmitReloadHint`; add byte-equality regression tests for the three "no plugin state change -> no trailer" cases (SNM-33; closes G-MIL-01 / G-MIL-02 / G-MIL-06) (completed 2026-05-29)
- [x] **Phase 23: Version Display Bundle** -- (a) Add tier-2 `installable.manifest?.version` fallback to `resolvePluginVersion` in `orchestrators/plugin/shared.ts:167` with SemVer shape validation (SNM-34; closes G-MIL-05); (b) Renderer-only transform of hash-version display to `v#<7hex>` git-style short SHA in `shared/notify.ts` (`formatHashVersionForDisplay` helper); update byte-form fixtures in `tests/shared/notify-v2.test.ts`, `tests/architecture/catalog-uat.test.ts`, and `docs/output-catalog.md`. Persistence stays at `hash-<12hex>` (PI-7 intact). (SNM-35; closes G-MIL-08) (completed 2026-05-29)
- [x] **Phase 24: Grammar Consistency** -- Rename the `"lspServers"` REASON discriminator in the `REASONS` closed-set at `shared/notify.ts:79` to `"lsp"`. The real shape is a single closed-set tuple edit plus a type-driven compile cascade through two detection-vs-emission seams (`list.ts::narrowResolverNotes` and `install.ts::manifestFieldTokenFromNote`, via a `MANIFEST_FIELD_TO_REASON` map) plus the catalog/fixture byte-form lockstep -- detection substrings stay camelCase, only the emitted Reason renders `lsp` (D-24-04). The manifest-side JSON key `lspServers` (in `domain/components/plugin.ts:31` schema + `domain/resolver.ts` references) stays unchanged. (SNM-36; closes G-MIL-04) (completed 2026-05-29)
- [x] **Phase 25: Runtime Publish & Verification** -- (a) Source-load v0.2.0 (v1.4 source) into a Pi runtime via `scripts/pi.sh` (sandbox home) so v1.4-specific behavior can be exercised live (D-25-01); verify v1.4 identity via a behavioral byte-form smoke (NOT `pi --version`, moot under `-e` source-load per D-25-04) over `/claude:plugin list` -- no `/reload` trailer on read-only list, `v#<7hex>`, `{lsp}`; real-publish validation deferred (D-25-06) (SNM-37; reproduction enabler). (b) Reproduce-or-refute G-MIL-03 (indent ladder 1/3 vs catalog 2/4/6) against the v1.4 runtime; fix or document as not-a-bug per finding (SNM-38). (c) Reproduce-or-refute G-MIL-07 (tab completion for `update @<TAB>` empty) against the v1.4 runtime; fix or defer per root-cause finding (SNM-39). (completed 2026-05-29)
- [x] **Phase 26: GREEN Gate Close** -- Final `npm run check` GREEN end-to-end after Phases 22-25 land. Verify the v1.4.1 regression tests added in SNM-33 / SNM-34 / SNM-35 / SNM-36 are in the suite; record milestone-close summary. (SNM-40) (completed 2026-05-30)

### In progress v1.5 Notification Output Polish (Phases 27-28)

Refine the v2 `NotificationMessage` output grammar and severity presentation per the 2026-05-30 hands-on UAT sweep (`.planning/v1.4-MILESTONE-UAT.md`); source findings in `.planning/BACKLOG.md` (`## v1.4 UAT findings`). The v1.4 byte-contract is verified-correct as shipped -- these are operator-preference refinements. Most changes converge on `shared/notify.ts` + `docs/output-catalog.md`, gated by the `tests/architecture/catalog-uat.test.ts` byte-equality runner (catalog + renderer + tests move in lockstep). Started non-destructively on the unmerged PR #22 branch (D-UXG-01); phases 15-26 intact, archival via `/gsd-complete-milestone` post-merge.

- [x] **Phase 27: Marketplace & Autoupdate Output Grammar** -- (a) drop the `<last-updated <iso>>` marker from the `marketplace list` surface (UXG-01); (b) replace `(autoupdate enabled)` / `(autoupdate disabled)` status tokens with `<autoupdate>` / `<no autoupdate>` markers (explicit off-marker), idempotent -> `<autoupdate> {already autoupdate}` (UXG-04); (c) render `marketplace update` no-op as `(skipped) {up-to-date}` not `(updated)` (UXG-05); (d) doc-only catalog fix -- github `marketplace add` never auto-enables autoupdate + `autoupdate`/`noautoupdate` heading nit (UXG-06). Renderer + catalog + catalog-uat in lockstep. 4 plans across 4 serialized waves (single-file convergence on `shared/notify.ts` + `docs/output-catalog.md`). (UXG-01, UXG-04, UXG-05, UXG-06)
- [x] **Phase 28: Severity Routing & Label Discipline** -- (a) refine the first-match severity ladder so benign-only skip cascades (`{up-to-date}` / `{already …}`) compute `info` not `warning` (UXG-02); (b) suppress the host `Error:`/`Warning:` label on multi-line cascade output (keep on single-line, keep color) -- carries a feasibility spike on whether the Pi host can render color without the label or whether an upstream `@earendil-works/pi-coding-agent` change is required; may resolve as an upstream-tracked finding (UXG-03). (UXG-02, UXG-03) (completed 2026-05-31)
- [x] **Phase 29: Notification Label Suppression & Update Classification** -- (a) suppress the host `Error:`/`Warning:` label on multi-line `notify()` cascades by routing them through `info` (entrypoint-split: single-line `notifyUsageError` keeps the label) -- supersedes the UXG-03 finding now that severity color is expendable, and retires/dormants the UXG-02 `computeSeverity` warning/error arms (UXG-07); (b) `update` of a plugin absent from the marketplace manifest classifies as `{not in manifest}` / `failed` matching `install`, not `{not installed}` / `skipped` (UXG-08). From the 2026-05-31 runtime UAT; reopens v1.5. (UXG-07, UXG-08) (completed 2026-05-31)

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
