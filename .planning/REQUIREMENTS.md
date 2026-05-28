# Requirements: pi-claude-marketplace v1.4.1 -- Post-ship UAT Patches

**Defined:** 2026-05-28
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

## v1.4.1 Milestone Goal

Close the 8 gaps surfaced by the v1.4 milestone-spanning UAT (`.planning/v1.4-MILESTONE-UAT.md`) so v1.4's user-visible message surfaces match the catalog spec and user expectations end-to-end. The UAT was run conversationally on 2026-05-28 against the user's installed pi-claude-marketplace v0.1.7 runtime (V1 wrappers, pre-v1.4) and identified 6 gaps that are already triable in source plus 2 gaps that need a reproduction phase against the not-yet-published v0.2.0 (v1.4) runtime.

## v1.4.1 Requirements (Active)

### Reload-hint Discipline

- [ ] **SNM-33**: `shouldEmitReloadHint` (in `shared/notify.ts`) gates the marketplace-level transition tokens (`MarketplaceAddedMessage` / `MarketplaceRemovedMessage` / `MarketplaceUpdatedMessage`) on whether the embedded `plugins[]` cascade contains at least one row with a state-change discriminator (`installed` / `updated` / `reinstalled` / `uninstalled`). Currently those marketplace-level tokens fire the trailer unconditionally even when no Pi-visible resources changed. Closes G-MIL-01 (`marketplace add` of empty mp), G-MIL-02 (`marketplace remove` of empty mp), G-MIL-06 (`marketplace update` no-op). Same SNM-15 family as the G-21-01 fix in Plan 21-04. Includes byte-equality regression tests in `tests/shared/notify-v2.test.ts` for each of the three "no plugin state change → no trailer" cases.

### Version Resolution & Display

- [ ] **SNM-34**: `resolvePluginVersion` in `orchestrators/plugin/shared.ts` adds a tier-2 fallback that consults `installable.manifest?.version` (the plugin's own `.claude-plugin/plugin.json`'s `version` field) BEFORE falling through to PI-7 `computeHashVersion`. The resolved version order becomes: (1) marketplace.json `plugins[].version` if declared; (2) plugin.json `version` if declared, with SemVer shape validation; (3) PI-7 hash-version as last-resort fallback. Closes G-MIL-05. Documents the precedence in PRD §11 PI-7 contract wording. Includes unit test in `tests/orchestrators/plugin/install.test.ts` for the tier-2 case with a fixture where marketplace.json omits `version` and plugin.json declares a SemVer.

- [ ] **SNM-35**: Hash-version display transforms to git-style short-SHA form `v#<7hex>` instead of the current `vhash-<12hex>`. PERSISTED state.json byte form (`hash-<12hex>`) is UNCHANGED -- PI-7 contract intact, no state migration. The transform is renderer-only: a new `formatHashVersionForDisplay(version)` helper in `shared/notify.ts` detects hash-versions via the existing `looksLikeHashVersion` predicate and emits `#<7hex>` (the `v` prefix is added by `renderVersion` downstream, producing the final byte form `v#<7hex>`). Updates: `renderVersion`, `composeVersionArrow`, and all catalog-state byte-form fixtures in `tests/shared/notify-v2.test.ts`, `tests/architecture/catalog-uat.test.ts`, and `docs/output-catalog.md`. Closes G-MIL-08.

### Grammar Consistency

- [ ] **SNM-36**: The lone camelCase token leak in the user-rendered `REASONS` closed-set at `shared/notify.ts:79` is eliminated. Either (a) rename the REASON discriminator from `"lspServers"` to `"lsp servers"` and update all 13 consumer call-sites in `orchestrators/plugin/list.ts` (8 sites) and `orchestrators/plugin/install.ts` (4 sites) plus the JSDoc comment at `domain/components/plugin.ts:46`, or (b) keep the camelCase discriminator but inject a renderer-side translation `"lspServers" → "lsp servers"` inside `composeReasons` / the reason brace block emitter. Preference (a) per design endorsement -- preserves the closed-set invariant uniformly. The manifest-side JSON key `lspServers` (referenced at `domain/components/plugin.ts:31` and `domain/resolver.ts:142,160`) MUST remain unchanged -- it's the actual `.claude-plugin/plugin.json` field name. Closes G-MIL-04.

### Reproduction Infrastructure & v1.4 Runtime Verification

- [ ] **SNM-37**: Source v0.2.0 (the v1.4 milestone) is published to npm or npm-linked into the user's Pi runtime so the v1.4-specific behavior can be exercised in the live environment. This is the gating prerequisite for SNM-38 and SNM-39 (which need the v1.4 runtime to reproduce). Methodology: publish to npm OR `npm link` from the source tree into `~/.npm-global` and verify Pi loads the new code via `pi --version` and a smoke `/claude:plugin list` invocation that shows v1.4 catalog conformance (e.g., no `/reload` trailer on read-only list; `v#<7hex>` hash form per SNM-35).

- [ ] **SNM-38**: G-MIL-03 (indent ladder visual off-by-one vs catalog D-16-08 documented 2/4/6 ladder) is reproduced or refuted against the v1.4 runtime. Methodology: capture the byte form of a representative `/claude:plugin list` output, count leading whitespace per line, compare against catalog L155-189 canonical examples and `renderPluginRow` / `renderMpHeader` indent constants. If a real off-by-one bug is confirmed, fix at the renderer with a regression test; if catalog rendering matches code intent, document the visual discrepancy as a catalog wording clarification or close as not-a-bug. Depends on SNM-37.

- [ ] **SNM-39**: G-MIL-07 (tab completion for `/claude:plugin update @<TAB>` returns nothing in the runtime despite a passing unit test at `tests/edge/completions/provider.test.ts:806`) is reproduced or refuted against the v1.4 runtime. Methodology: install a fixture with at least one installed plugin per marketplace, type `/claude:plugin update @` and trigger tab completion, observe the result. If empty, trace the completion provider call path against the Pi-tui runtime to isolate whether the gap is in: (a) completion provider code path divergence between v0.1.7 and v0.2.0; (b) Pi-tui consumption / display of the `AutocompleteItem[]` payload; (c) `getInstalledPluginToMarketplacesMap` returning an empty map due to a scope-root mismatch at runtime. Fix or defer per root-cause finding. Depends on SNM-37.

### GREEN Gate

- [ ] **SNM-40**: `npm run check` GREEN end-to-end after all v1.4.1 fixes land: typecheck + ESLint + Prettier + tests. New regression tests added in SNM-33 / SNM-34 / SNM-35 / SNM-36 included in the test suite. `tests/integration/fold-adoption.test.ts` phase 1 pre-existing failure (documented in Plan 21-04 review-fix report) remains out of scope -- it predates this milestone and is on the `npm run test:integration` track, not `npm test`. The milestone-close gate matches the v1.4-close gate pattern (SNM-32).

## v1.4 Requirements (Shipped 2026-05-27)

_Original v1.4 milestone scope. All requirements complete except SNM-23 traceability-row reconciliation (its behavior shipped in Phase 20; traceability bookkeeping is a known record-keeping debt)._

## Milestone Goal

Replace v1.3's string-based notify API + 34-rule ESLint drift-guard plugin with a type-driven structured `NotificationMessage` payload. Simultaneously simplify the user-output spec to a single uniform shape: every output renders a marketplace header at column 0 with plugin rows indented two spaces.

**Source-of-truth artifact:** `docs/adr/v2-001-structured-notify.md` (commit `492d9c4`). The ADR predates several v1.4 design refinements (status renames, `PluginStatus`/`MarketplaceStatus` enums, `Dependency` closed set, always-marketplace-header spec change, per-plugin causes, dropped trailer). The ADR is refreshed during this milestone to reflect the locked design (SNM-21).

## v1.4 Requirements (Active)

### Type Model

- [x] **SNM-01**: `NotificationMessage` type defined in `shared/notify.ts` with shape `{ marketplaces: readonly MarketplaceNotificationMessage[] }`. No `severity` field (computed). No `trailer` field (reload hint computed; no top-level cause).
- [x] **SNM-02**: `MarketplaceNotificationMessage` type defined with shape `{ name: string; scope: Scope; status?: MarketplaceStatus; details?: MarketplaceDetails; plugins: readonly PluginNotificationMessage[] }`.
- [x] **SNM-03**: `PluginNotificationMessage` defined as a discriminated union on `status` with 10 variants: `installed`, `updated`, `reinstalled`, `uninstalled`, `available`, `unavailable`, `upgradable`, `failed`, `skipped`, `manual recovery`. Each variant pins `status` to its literal string for TypeScript narrowing.
- [x] **SNM-04**: `PluginStatus` type derived from `PluginNotificationMessage["status"]` via indexed access; serves as the canonical closed enum for validators, fixture iterators, and external functions that need the bare status list.
- [x] **SNM-05**: `MarketplaceStatus` type defined directly as `"added" | "removed" | "updated" | "failed"`.
- [x] **SNM-06**: `Dependency` type defined as `"agents" | "mcp"`. Each `installed` / `updated` / `reinstalled` plugin variant carries required `dependencies: readonly Dependency[]` (empty array = no soft deps).
- [x] **SNM-07**: `MarketplaceDetails` type defined for the list context (autoupdate state, last-updated timestamp). Optional on `MarketplaceNotificationMessage`.
- [x] **SNM-08**: `UsageErrorMessage` type defined with shape `{ message: string; usage: string }`.
- [x] **SNM-09**: `failed` plugin variant carries optional `rollbackPartial?: readonly { phase: string; cause?: Error }[]`. No separate `rollback failed` status -- rollback partial is structurally a sub-state of `failed`.
- [x] **SNM-10**: `failed` and `manual recovery` plugin variants carry optional `cause?: Error`. Causes are per-plugin -- the v1.3 top-level cause-chain trailer is retired.
- [x] **SNM-11**: All plugin variants except `available` / `unavailable` carry optional `scope?: Scope` representing the orphan-fold case (plugin's scope differs from parent marketplace's scope). `available` / `unavailable` carry no scope at all (MSG-PL-6 carve-out preserved).

### Public API

- [x] **SNM-12**: `notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void` exported from `shared/notify.ts`. The single public entrypoint for state-change notifications. The `pi` argument is required for the render-time soft-dep probe (SNM-16); orchestrators already receive both `ctx` and `pi` separately.
- [x] **SNM-13**: `notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void` exported from `shared/notify.ts`. The single public entrypoint for argv-validation errors.
- [x] **SNM-14**: `notify()` computes severity from contents: any plugin or marketplace `status === "failed"` → error; any plugin status in `{skipped, manual recovery}` → warning; otherwise success. No caller-supplied severity.
- [x] **SNM-15**: `notify()` emits the reload-hint trailer (`/reload to pick up changes`) when contents indicate state change: any plugin status in `{installed, updated, reinstalled, uninstalled}` or any state-changing marketplace status (`added`, `removed`, `updated` -- not `failed`). No caller-supplied flag. Rationale: failed marketplace operations roll back and leave nothing to reload.
- [x] **SNM-16**: `notify()` probes each declared `Dependency` at notify time (no caller-supplied probe state). `agents` → pi-subagents probe; `mcp` → pi-mcp-adapter probe. Emits `{requires pi-subagents}` / `{requires pi-mcp}` marker per absent probe on the corresponding plugin row.
- [x] **SNM-17**: `notify()` internal switch over plugin/marketplace `status` is the SOLE site that knows the user-output grammar. Uses `assertNever` for compile-time exhaustiveness across `PluginStatus` and `MarketplaceStatus`.
- [x] **SNM-18**: `presentation/` composers become module-internal helpers of `notify()`. The barrel re-exports the user-facing TYPES (`NotificationMessage`, `MarketplaceNotificationMessage`, `PluginNotificationMessage`, `PluginStatus`, `MarketplaceStatus`, `Dependency`, `MarketplaceDetails`, `UsageErrorMessage`) so callers can construct payloads, but no longer exports any string-producing render functions.

### Spec & Docs

- [x] **SNM-19**: `docs/messaging-style-guide.md` v2.0 rewritten to describe the structured type model as the binding contract. The `status_tokens` / `reasons` / `markers` / `pattern_classes` frontmatter sets are either deleted (now type-derived) or kept as a documentation aid with a drift test verifying parity against the TypeScript types.
- [x] **SNM-20**: `docs/output-catalog.md` rewritten to reflect the always-marketplace-header spec. Every output renders a marketplace header at column 0 with plugin rows indented two spaces, including single-plugin install / update / uninstall and marketplace add / remove. Per-command sections updated with new expected byte-equal outputs.
- [x] **SNM-21**: `docs/adr/v2-001-structured-notify.md` refreshed to reflect the locked design (status renames, `*NotificationMessage` naming, `PluginStatus`/`MarketplaceStatus` enums, `Dependency` closed set, per-plugin causes, dropped trailer, computed severity, always-marketplace-header spec change). Status flips from "Proposed" to "Accepted" with reference to the phase that landed it.

### Migration & Deletion

- [x] **SNM-22**: All `notifySuccess` / `notifyWarning` / `notifyError` call sites across orchestrators (~20 sites) migrated to `notify(ctx, structuredMessage)`. The V1 severity-named wrappers are deleted from `shared/notify.ts`.
- [ ] **SNM-23**: All `notifyUsageError(ctx, msg, usage)` call sites across edge handlers (~13 sites) migrated to the V2 `notifyUsageError(ctx, structuredUsageError)`. The V1 three-argument signature is deleted.
- [x] **SNM-24**: `tests/lint-rules/` directory deleted in full (34 MSG-\* rule files + 34 RuleTester companion tests + helpers + plugin shell + types).
- [x] **SNM-25**: `tests/architecture/msg-rule-registry.test.ts` (4-way parity test) deleted.
- [x] **SNM-26**: `tests/architecture/grammar-frontmatter.test.ts` rewritten or deleted -- replaced by the spec-vs-types drift verification from SNM-19 (closed-set membership is now compile-enforced; runtime drift test only needed if style-guide retains the frontmatter sets as a documentation aid).
- [x] **SNM-27**: `eslint.config.js` cleaned of all 34 MSG-\* rule wirings. Added: `no-restricted-syntax` rule blocking `ctx.ui.notify` calls outside `shared/notify.ts`; `no-console` rule with per-file override for `persistence/migrate.ts` (IL-3 sanctioned legacy-migration warn).
- [x] **SNM-28**: `tests/architecture/no-legacy-markers.test.ts` reviewed and updated for v2 vocabulary (the 5 ES-5 legacy markers it blocks remain relevant; the test's closed-set source may need to migrate from style-guide frontmatter to the new type definitions).
- [x] **SNM-29**: `shared/grammar/` files (`status-tokens.ts`, `reasons.ts`, `markers.ts`, `pattern-classes.ts`) either deleted (closed sets now type-encoded) or retained as the `Reason` / `Marker` enum source and re-exported from `shared/notify.ts`. Either path preserves the binding contract; pick at phase plan time.

### Test Coverage

- [x] **SNM-30**: Per-status unit tests on `notify()` switch: one test or test block per variant of `PluginNotificationMessage` and per value of `MarketplaceStatus`. Each test passes a structured payload with a mock `ctx`, asserts on the exact string passed to `ctx.ui.notify`. Covers empty `plugins: []`, single-plugin, multi-plugin, orphan-fold (`scope?` set), `rollbackPartial`, multi-cause cascades.
- [x] **SNM-31**: `tests/architecture/catalog-uat.test.ts` rewritten to feed structured `NotificationMessage` fixtures through `notify()` (via mock ctx) and assert byte-equality against `docs/output-catalog.md` per-command expected outputs. The byte-equality assertion remains the user-contract gate.
- [x] **SNM-32**: `npm run check` GREEN after all migrations land: typecheck + ESLint (with new stock rules) + Prettier + tests (1249 v1.3 baseline minus retired lint-rule tests, plus the new per-variant unit tests; expected net change accounted for in the phase plan).

## v1.4.1 Out of Scope

| Feature | Reason |
| --- | --- |
| New user-facing features | This is a bug-fix milestone scoped strictly to the v1.4 post-ship UAT inventory. New capabilities defer to v1.5. |
| v1.4 phase dir archival | v1.4 phase dirs (15-21) remain in `.planning/phases/`; 1.4.1 phases continue numbering at 22+. Archival via `/gsd-complete-milestone` is operator-initiated when desired. |
| State migration for already-installed hash-versioned plugins | A plugin previously installed under v0.1.7 with `version: "hash-<12hex>"` whose plugin.json declares a SemVer will retain the hash form in state. The SNM-34 tier-2 fallback fires at NEXT install/reinstall/update; an explicit migration of existing records is not in scope. Marketplace update will naturally surface the version discrepancy as upgradable for the user to resolve. |
| `tests/integration/fold-adoption.test.ts` phase 1 fix | Pre-existing failure on the v1.4 baseline (`npm run test:integration` track, not `npm test`); documented in Plan 21-04 review-fix report. Tracked for a separate `/gsd-debug` session. |
| Catalog spec restructure | Catalog rendering changes (G-MIL-08 `v#<7hex>`, G-MIL-04 grammar) and PRD §11 PI-7 wording updates land alongside the renderer fixes; no broader spec rewrite. |

## v1.4 Out of Scope (Inherited, Still Active)

| Feature                                           | Reason                                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-locale message support                      | Still deferred (IL-1) -- v1.4 stays English-only                                                                                                        |
| Telemetry / event sink for notification emissions | Still deferred (IL-4) -- no metrics, no analytics endpoint                                                                                              |
| JSON output mode for notifications                | Backlog -- structured payloads make it cheaper later but not in v1.4                                                                                    |
| Multi-process notification serialization          | Out -- concurrent notifies remain safe via Pi host serialization                                                                                        |
| Codegen wrappers from style-guide YAML            | Rejected in ADR alternatives -- adds a build step the type system can handle directly                                                                   |
| Optional `notify*` per-outcome typed wrappers     | Rejected -- the payload IS the API; per-method wrappers added autocomplete win that's already available from the discriminated-union literal on `kind:` |

## Traceability

Phase mapping populated by `gsd-roadmapper` on 2026-05-25.

| Requirement | Phase    | Status   |
| ----------- | -------- | -------- |
| SNM-01      | Phase 15 | Complete |
| SNM-02      | Phase 15 | Complete |
| SNM-03      | Phase 15 | Complete |
| SNM-04      | Phase 15 | Complete |
| SNM-05      | Phase 15 | Complete |
| SNM-06      | Phase 15 | Complete |
| SNM-07      | Phase 15 | Complete |
| SNM-08      | Phase 15 | Complete |
| SNM-09      | Phase 15 | Complete |
| SNM-10      | Phase 15 | Complete |
| SNM-11      | Phase 15 | Complete |
| SNM-12      | Phase 16 | Complete |
| SNM-13      | Phase 16 | Complete |
| SNM-14      | Phase 16 | Complete |
| SNM-15      | Phase 16 | Complete |
| SNM-16      | Phase 16 | Complete |
| SNM-17      | Phase 16 | Complete |
| SNM-18      | Phase 16 | Complete |
| SNM-19      | Phase 17 | Complete |
| SNM-20      | Phase 17 | Complete |
| SNM-21      | Phase 15 | Complete |
| SNM-22      | Phase 21 | Complete |
| SNM-23      | Phase 20 | Pending  |
| SNM-24      | Phase 21 | Complete |
| SNM-25      | Phase 21 | Complete |
| SNM-26      | Phase 17 | Complete |
| SNM-27      | Phase 21 | Complete |
| SNM-28      | Phase 21 | Complete |
| SNM-29      | Phase 21 | Complete |
| SNM-30      | Phase 16 | Complete |
| SNM-31      | Phase 17 | Complete |
| SNM-32      | Phase 21 | Complete |

**Coverage:**

- v1.4 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0
- Complete: 31 (all except SNM-23 -- traceability-row reconciliation deferred to a Phase 20 record-keeping quick-fix per Phase 21 B6 scope discipline; SNM-23's behavior closed in Phase 20)
- Pending: 1 (SNM-23 traceability-row only; behavior is shipped)
- Per-phase distribution: Phase 15 (12: SNM-01..11, SNM-21); Phase 16 (8: SNM-12..18, SNM-30); Phase 17 (4: SNM-19, SNM-20, SNM-26, SNM-31); Phase 18 (0: execution phase); Phase 19 (0: execution phase); Phase 20 (1: SNM-23); Phase 21 (7: SNM-22, SNM-24, SNM-25, SNM-27, SNM-28, SNM-29, SNM-32)

**Mapping rationale:**

- Phases 15-17 are foundation phases (types → renderer → spec/catalog). Each closes a clean set of requirements.
- Phases 18, 19, 20 are execution waves migrating call sites by family. They have rich success criteria (zero V1 callers in the family, lint glob narrowed, catalog UAT GREEN for the family) but only Phase 20 owns a v1.4 requirement (SNM-23: edge-handler `notifyUsageError` migration completes in this wave).
- SNM-22 ("all V1 callers migrated AND V1 wrappers deleted") closes in Phase 21 because the deletion half of the requirement requires the migration waves of 18-20 to have already landed. Phases 18-20 each prove their migration completeness through their own success criteria; SNM-22 records the final closure.
- Phase 21 closes the teardown requirements (SNM-24..29) plus the GREEN gate (SNM-32) plus SNM-22's deletion half.

---

_Requirements defined: 2026-05-25 (v1.4 baseline); 2026-05-28 (v1.4.1 patches added)_
_Last updated: 2026-05-28 -- v1.4.1 Post-ship UAT Patches milestone started. Added SNM-33..SNM-40 (8 requirements) closing 8 UAT findings from `.planning/v1.4-MILESTONE-UAT.md`. v1.4.1 traceability rows will be populated by `gsd-roadmapper` when the milestone roadmap lands. v1.4 traceability table preserved as historical record._
