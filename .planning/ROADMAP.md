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
- [ ] **Phase 16: Renderer & Public API (Alongside V1)** -- `notify(ctx, payload)` and `notifyUsageError(ctx, payload)` exported from `shared/notify.ts`; internal switch with `assertNever`; computed severity; computed reload hint; renderer-time dependency probe; per-status unit tests
- [ ] **Phase 17: Spec Rewrite & Catalog UAT Migration** -- `docs/messaging-style-guide.md` v2.0 + `docs/output-catalog.md` rewritten to always-marketplace-header spec; catalog UAT runner fed by structured `NotificationMessage` fixtures
- [ ] **Phase 18: Migration Wave 1 -- Marketplace Orchestrator Family** -- Migrate all `orchestrators/marketplace/*` call sites to `notify(ctx, structured)`; retire MSG-* lint globs covering marketplace orchestrators
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

**Plans:** 6 plans (Wave 1: 1 docs-only plan; Wave 2: 4 in-file additions; Wave 3: 1 test plan)
Plans:
**Wave 1**

- [ ] 16-01-PLAN.md -- Editorial REQUIREMENTS.md SNM-12 + SNM-15 refinements + ADR Decision-snippet alignment (D-16-01 + D-16-12)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 16-02-PLAN.md -- Add V2 notifyUsageError(ctx, UsageErrorMessage) export alongside V1 (SNM-13, D-16-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 16-03-PLAN.md -- Add file-private renderMpHeader switch helper + icon constants (SNM-17, D-16-09)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 16-04-PLAN.md -- Add file-private renderPluginRow 10-arm switch + soft-dep markers + composeReasons / joinTokens / renderVersion / composeVersionArrow helpers (SNM-16, SNM-17, SNM-18, D-16-09, D-16-15)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 16-05-PLAN.md -- Add public notify(ctx, pi, message) orchestration + RELOAD_HINT_TRAILER + computeSeverity + shouldEmitReloadHint (SNM-12, SNM-14, SNM-15, SNM-16, SNM-17, SNM-18, D-16-01, D-16-04..D-16-14)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 16-06-PLAN.md -- Create tests/shared/notify-v2.test.ts with mini-spec header and >=20 per-variant unit tests (SNM-30, D-16-16..D-16-18)

### Phase 17: Spec Rewrite & Catalog UAT Migration

**Goal:** `docs/messaging-style-guide.md` and `docs/output-catalog.md` describe the v1.4 type-driven contract with always-marketplace-header rendering, and the catalog UAT runner verifies that contract by driving the new `notify()` through structured fixtures -- not pre-assembled strings.

**Depends on:** Phase 16

**Requirements:** SNM-19, SNM-20, SNM-31

**Success Criteria** (what must be TRUE):

1. `docs/messaging-style-guide.md` v2.0 is published and describes the structured type model as the binding contract; the v1.3 `status_tokens` / `reasons` / `markers` / `pattern_classes` YAML frontmatter sets are either deleted (now type-derived) or kept as a documentation aid with a runtime parity check against the TypeScript types in `shared/notify.ts`.
2. `docs/output-catalog.md` is rewritten so every per-command section renders a marketplace header at column 0 with plugin rows indented two spaces, including single-plugin install / update / uninstall / reinstall and marketplace add / remove. The single-plugin install line shape changes from `● commit-commands [user] (installed)` to `● claude-plugins-official [user]\n  ● commit-commands (installed)`.
3. `tests/architecture/catalog-uat.test.ts` constructs `NotificationMessage` fixtures and routes them through `notify(ctx, …)` via mock `ctx`, asserting byte-equality against the per-command expected outputs in `docs/output-catalog.md`. The byte-equality assertion remains the user-contract gate.
4. Catalog UAT is GREEN against the new always-marketplace-header spec when driven through the new `notify()`; V1 callsites still produce pre-v2 output but no test of the new contract runs against them (V1 callsites are excluded from catalog UAT or covered by a separate transitional snapshot until their migration phase).
5. `npm run check` stays GREEN; `docs/adr/v2-001-structured-notify.md` Accepted-status cross-reference to Phase 17 for the spec change is added if not already present.

**Plans:** TBD

### Phase 18: Migration Wave 1 -- Marketplace Orchestrator Family

**Goal:** Every call site in `orchestrators/marketplace/*` uses the new `notify(ctx, structured)` entrypoint, and the catalog UAT proves the marketplace command surface is byte-equal to the v2.0 spec.

**Depends on:** Phase 17

**Requirements:** (no SNM-IDs close in this phase; this is an execution phase contributing to SNM-22 closure in Phase 21)

**Success Criteria** (what must be TRUE):

1. Zero `notifySuccess` / `notifyWarning` / `notifyError` callers remain in `orchestrators/marketplace/**/*.ts`; every state-change notification in the marketplace family flows through `notify(ctx, NotificationMessage)`.
2. The MSG-* lint plugin's `files:` globs are narrowed in `eslint.config.js` so the marketplace orchestrator family is no longer scoped by the v1.3 drift-guard rules (rules remain wired for the still-unmigrated plugin/edge families).
3. Catalog UAT byte-equality is GREEN for every marketplace-family command output (`add`, `remove`, `update`, `list` marketplace headers and rows where applicable) against the v2.0 always-marketplace-header spec.
4. `npm run check` stays GREEN; no orchestrators outside marketplace have changed call-site shape.

**Plans:** TBD

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

**Requirements:** SNM-22, SNM-24, SNM-25, SNM-26, SNM-27, SNM-28, SNM-29, SNM-32

**Success Criteria** (what must be TRUE):

1. `tests/lint-rules/` is absent from the repo (34 MSG-* rule files + 34 RuleTester companion tests + helpers + plugin shell + types fully deleted). `tests/architecture/msg-rule-registry.test.ts` is absent.
2. V1 severity-named wrappers (`notifySuccess` / `notifyWarning` / `notifyError`) and the V1 three-argument `notifyUsageError(ctx, msg, usage)` signature are deleted from `shared/notify.ts`; only `notify(ctx, NotificationMessage)` and `notifyUsageError(ctx, UsageErrorMessage)` remain exported.
3. `eslint.config.js` no longer wires any MSG-* rule; it carries (a) `no-restricted-syntax` blocking `ctx.ui.notify` calls outside `shared/notify.ts` and (b) `no-console` with a per-file override for `persistence/migrate.ts` (IL-3 sanctioned legacy-migration warn).
4. `tests/architecture/grammar-frontmatter.test.ts` is either rewritten to verify spec-vs-types parity (if the style guide retains frontmatter as a documentation aid) or deleted; `tests/architecture/no-legacy-markers.test.ts` is reviewed and updated for v2 vocabulary; `shared/grammar/` is either deleted (closed sets type-encoded) or retained as the canonical enum source and re-exported from `shared/notify.ts` (decision recorded in phase plan).
5. `npm run check` is GREEN: typecheck + ESLint (with new stock rules) + Prettier + tests pass. Test count change is accounted for (1249 v1.3 baseline minus retired lint-rule tests, plus new per-variant unit tests).

**Plans:** TBD

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
| 16. Renderer & Public API (Alongside V1)                             | v1.4      | 0/6            | In progress | --         |
| 17. Spec Rewrite & Catalog UAT Migration                             | v1.4      | 0/?            | Not started | --         |
| 18. Migration Wave 1 -- Marketplace Orchestrator Family              | v1.4      | 0/?            | Not started | --         |
| 19. Migration Wave 2 -- Plugin Orchestrator Family                   | v1.4      | 0/?            | Not started | --         |
| 20. Migration Wave 3 -- Edge Handlers & UsageError                   | v1.4      | 0/?            | Not started | --         |
| 21. Final Teardown & GREEN Gate                                      | v1.4      | 0/?            | Not started | --         |
