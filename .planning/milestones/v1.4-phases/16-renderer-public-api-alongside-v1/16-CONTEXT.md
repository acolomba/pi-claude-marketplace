# Phase 16: Renderer & Public API (Alongside V1) - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the v1.4 public `notify(...)` / `notifyUsageError(...)` entry points in `extensions/pi-claude-marketplace/shared/notify.ts` next to the V1 severity-named wrappers, with full per-status unit coverage. Land the v2 grammar in code (always-marketplace-header + indented plugin rows, per-plugin causes, render-time soft-dep probe, computed severity, computed reload-hint). No orchestrator call site migrates yet (Phase 18-20); V1 wrappers and 34-rule MSG-* lint plugin stay intact (Phase 21 deletes); `docs/messaging-style-guide.md` / `docs/output-catalog.md` are NOT rewritten yet (Phase 17 catches them up to what Phase 16 ships).

Scope:

1. Add public exports `notify(ctx, pi, message: NotificationMessage): void` and `notifyUsageError(ctx, message: UsageErrorMessage): void` to `shared/notify.ts` next to (not replacing) the V1 wrappers.
2. Implement the v2 output grammar inline inside `shared/notify.ts` via two file-private helpers (`renderMpHeader`, `renderPluginRow`), each owning its own `switch + assertNever`. Do NOT call the existing `presentation/*` composers -- the V1 wrappers still consume those. The duplication is intentional and ends in Phase 21 when V1 wrappers + composers are deleted together.
3. Compute severity, reload-hint, and soft-dep probe from the payload at notify time. No caller-supplied severity, reload flag, or probe state.
4. Add `tests/shared/notify-v2.test.ts` with per-status unit tests covering all 10 `PluginNotificationMessage` variants, all 4 `MarketplaceStatus` values, plus orphan-fold (`scope?`), `rollbackPartial`, multi-cause cascades, empty `plugins: []`, empty `marketplaces: []`, single-plugin, multi-plugin, multi-marketplace.
5. Keep `npm run check` GREEN. Keep `tests/architecture/catalog-uat.test.ts` UNCHANGED -- it tests V1 composers (still consumed by V1 wrappers); Phase 17 migrates the catalog UAT to drive `notify()` via structured fixtures (SNM-31).

**Authority for "correct output":** Phase 16's per-status unit tests are the de facto v2 spec. Phase 17's catalog rewrite mirrors what this phase ships. Phase 16's PLAN.md SHOULD include a mini-spec section (or annotate the test file) so reviewers can audit the grammar in one place; Phase 17 expands that to the full `docs/output-catalog.md` rewrite.

**Out of scope (not Phase 16):**
- Migrating any orchestrator or edge call site to `notify()` / `notifyUsageError()` (Phase 18 / 19 / 20).
- Deleting V1 wrappers, MSG-* lint rules, `presentation/*` composers (Phase 21).
- Rewriting `docs/messaging-style-guide.md` or `docs/output-catalog.md` (Phase 17).
- Migrating `tests/architecture/catalog-uat.test.ts` to drive `notify()` via structured fixtures (SNM-31; Phase 17).

</domain>

<decisions>
## Implementation Decisions

### Signature & Pi-API access

- **D-16-01:** `notify()` takes `pi: ExtensionAPI` as a 2nd argument: `notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void`. This amends SNM-12's literal 2-arg wording. Rationale: `ExtensionContext` does not expose `pi.getAllTools()`, and SNM-16 mandates render-time soft-dep probing; the cleanest path is to pass `pi` alongside `ctx`, mirroring how orchestrators already receive both separately. `notify()` calls `softDepStatus(pi)` once internally and threads the resulting `SoftDepProbe` into `renderPluginRow`. **REQUIREMENTS.md SNM-12 needs an editorial update to add `pi` to the signature**; flag this for the planner to do as part of Phase 16's plan (one-line REQUIREMENTS edit + ADR alignment if the ADR's "Decision" snippet shows the signature).
- **D-16-02:** `notifyUsageError()` stays 2-arg per SNM-13 verbatim: `notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void`. No `pi` argument -- `UsageErrorMessage` has no plugin rows / dependencies / soft-dep probes, so no `pi` access is needed. On-the-wire format is `${message}\n\n${usage}` (mirrors V1's blank-line discipline at `shared/notify.ts:96`).
- **D-16-03:** Both V2 entry points coexist alongside V1's `notifySuccess` / `notifyWarning` / `notifyError` / `notifyUsageError(ctx, msg, usage)` in `shared/notify.ts`. V1 wrappers are NOT modified. Phase 21 deletes V1 wrappers.

### Output grammar (v2 lands in this phase, not Phase 17)

- **D-16-04:** `notify()` emits the v1.4 v2 always-marketplace-header form starting in Phase 16 -- not byte-equal to V1 callers. Single-plugin install renders as two lines (marketplace header + 2-space-indented plugin row), NOT V1's one-line `● commit-commands [user] (installed)` form. The phase goal's "byte-equal to V1" wording is interpreted as a non-blocker because no V1 caller routes through `notify()` in Phase 16; the catalog UAT (which tests V1 composers) stays GREEN unchanged. Per-status unit tests in `tests/shared/notify-v2.test.ts` are the binding assertion surface for the new grammar.
- **D-16-05:** No cascade-summary line above the marketplace block (no `"X installed, Y skipped"` headline). v2 grammar is uniform: every output renders `marketplace header\n  plugin row\n  plugin row\n  ...` and that is the complete output. V1's `presentation/cascade-summary.ts` is unaffected (still consumed by V1 wrappers). Severity routing replaces the at-a-glance summary; the renderer never emits a separate cascade-summary line.
- **D-16-06:** Sort order is caller-supplied. `notify()` iterates `msg.marketplaces[]` and each `mp.plugins[]` in the order provided by the caller -- no internal sort. Callers (orchestrators) keep responsibility for ordering decisions (cascade chronological vs. list alphabetical etc.). `compareByNameThenScope` (in `presentation/sort.ts`) remains available to callers but `notify()` does not invoke it.
- **D-16-07:** Multi-marketplace payloads emit one blank line between marketplaces. Shape: `mp1-header\n  plugin\n  plugin\n\nmp2-header\n  plugin`. If the reload-hint trailer is emitted, it appends after one additional blank line at the end of the body (mirrors `presentation/reload-hint.ts::appendReloadHint` discipline). No horizontal divider; no inter-marketplace summary line.
- **D-16-08:** Per-plugin `cause?: Error` chains render inline immediately after the failing plugin row, indented one level deeper than the row text (plugin rows are 2-space-indented under the marketplace header; cause chains are 4-space-indented under the plugin row). Each `failed` / `manual recovery` plugin with `cause` gets its own depth-5 cause-chain trailer in place. Multi-failure cascades surface each plugin's cause inline; the v1.3 single top-level cause-chain trailer is retired per SNM-10. Use `causeChainTrailer(cause)` from `shared/errors.ts` (currently re-exported via `presentation/cause-chain.ts`) -- or call the bare implementation from `shared/errors.ts` directly to avoid the `presentation/` dependency. Planner picks; D-11 layering allows either since `shared/errors.ts` is the lowest layer.

### Dispatch structure (assertNever exhaustiveness)

- **D-16-09:** Two file-private helpers extracted from `notify()` at module scope, each owning its own `switch + assertNever`:
  - `renderMpHeader(mp: MarketplaceNotificationMessage): string` -- `switch (mp.status)` over `4 + undefined` (`undefined` = list-surface case using `mp.details`; `"added"|"removed"|"updated"|"failed"` = state-change cases). `default: return assertNever(mp.status);`
  - `renderPluginRow(p: PluginNotificationMessage, probe: SoftDepProbe): string` -- `switch (p.status)` over 10 variants. `default: return assertNever(p);`
  - `notify()` is a thin orchestration loop: probe once → for each marketplace, push header + indented rows → compute severity + reload-hint → `ctx.ui.notify(body, severity?)`. Severity uses Pi API's magic-string second arg verbatim from V1: `"warning"` / `"error"` / omit-for-info.
- **D-16-10:** `assertNever` imported from `extensions/pi-claude-marketplace/shared/errors.ts` (existing). Failures throw at runtime (defensive; should never reach if every variant is handled at compile time). Adding any new plugin or marketplace status literal in `shared/notify.ts` becomes a compile error at the matching switch.

### Severity & reload-hint policy

- **D-16-11:** Severity policy per SNM-14, with one tie-break: any plugin OR marketplace `status === "failed"` → `error`; otherwise any plugin `status` ∈ `{"skipped", "manual recovery"}` → `warning`; otherwise success (omitted second arg). The first-match check wins over later checks (failed beats warning beats success).
- **D-16-12:** Reload-hint emits the canonical literal `"/reload to pick up changes"` (mirrors `presentation/reload-hint.ts::RELOAD_HINT_TRAILER` -- duplicate the literal inside `shared/notify.ts` rather than import from `presentation/`, consistent with D-16-04's no-presentation-coupling). Trigger:
  - Any plugin `status` ∈ `{"installed", "updated", "reinstalled", "uninstalled"}`, OR
  - Any marketplace `status` ∈ `{"added", "removed", "updated"}` (success-class only -- NOT `"failed"`).
  - This refines SNM-15's literal "any marketplace status set" wording to "any state-changing marketplace status set". Failed marketplace operations (rolled back; nothing landed) do not trigger the hint. Plugin `failed` / `skipped` / `manual recovery` / `available` / `unavailable` / `upgradable` do not trigger the hint.
  - **REQUIREMENTS.md SNM-15 needs an editorial refinement to say "any state-changing marketplace status set" rather than "any marketplace status set"**; flag this for the planner alongside the SNM-12 edit (D-16-01).
- **D-16-13:** Reload-hint append discipline mirrors V1's `presentation/reload-hint.ts::appendReloadHint`: the hint is appended as `${body}\n\n${hint}` (one blank line between body and hint). When the hint is suppressed (no qualifying state change), the body is emitted unchanged.

### Soft-dep probe

- **D-16-14:** `notify()` calls `softDepStatus(pi)` (from `extensions/pi-claude-marketplace/platform/pi-api.ts`) ONCE at the top of the function, before the marketplace loop. The resulting `SoftDepProbe` (`{ piSubagentsLoaded, piMcpAdapterLoaded }`) is threaded into `renderPluginRow` for each plugin. Single probe per `notify()` invocation; no per-row re-probing.
- **D-16-15:** Per `dependencies: readonly Dependency[]` on `installed` / `updated` / `reinstalled` variants (SNM-06, D-15-02): for each declared `Dependency` whose probe says "not loaded", emit the corresponding `{requires pi-subagents}` (for `"agents"`) or `{requires pi-mcp}` (for `"mcp"`) marker in the row's reasons-block slot. If both are absent, emit both. If all declared deps are loaded, emit nothing. Markers are NOT typed `Reason` entries -- they are computed at render time and injected into the row's brace block alongside any other reasons. The literal strings `{requires pi-subagents}` and `{requires pi-mcp}` should be duplicated inside `shared/notify.ts` (consistent with D-16-04's no-presentation-coupling) -- though planner may opt to import from `presentation/soft-dep.ts` / `presentation/compact-line.ts` if that file already centralizes the literal.

### Test coverage

- **D-16-16:** New file `tests/shared/notify-v2.test.ts` is the binding test surface for the v2 grammar. The existing `tests/shared/notify.test.ts` (V1 wrappers) stays unchanged; Phase 21 deletes it. The mock-`ctx` pattern is identical: `{ ui: { notify: mock.fn() } }` via `node:test`'s `mock.fn()` (no third-party mocking framework). Mock `pi` for `softDepStatus(pi)`: `{ getAllTools: () => [...] }` shape (probe inspects `tool.name` and `tool.sourceInfo?.source`).
- **D-16-17:** Test taxonomy (≥ 20 cases):
  - Per-plugin-status variants (10 cases): one test per `PluginNotificationMessage` discriminant.
  - Per-marketplace-status values (4 cases): one test per `MarketplaceStatus`; the no-status (`mp.status` undefined, list-surface) case is also covered (so 5 marketplace-header cases total).
  - Empty `plugins: []` (state-change paths emit marketplace header alone).
  - Empty `marketplaces: []` (list surfaces emit the `(no marketplaces)` rendering -- planner decides exact bytes; SNM-30 covers this via the "empty plugins / empty marketplaces" wording).
  - Single-plugin payload (2-line output: header + indented row).
  - Multi-plugin payload (header + N indented rows, caller-supplied order respected).
  - Multi-marketplace payload (blank line between marketplace blocks; reload-hint at end).
  - Orphan-fold (`plugin.scope !== marketplace.scope`): planner decides exact rendering. The PluginNotificationMessage variants except `available` / `unavailable` carry optional `scope?` for this case (SNM-11). Recommended approach: emit the plugin row with an inline `[scope]` bracket when the orphan-fold case is detected; the marketplace header's scope still wins for the header itself.
  - `rollbackPartial` on `failed`: 4-space-indented child rows per phase; cause-chain on each phase's `cause?`.
  - Multi-cause cascade: 2+ failed plugins each with `cause?: Error`; each cause chain renders inline below its row per D-16-08.
  - Severity routing: at least one test per severity tier (info / warning / error) confirming the second-arg passed to `ctx.ui.notify`.
  - Reload-hint trigger / suppression: at least one positive (qualifying state change) and one negative (failed-only payload) case; D-16-12 SNM-15 refinement covered.
  - `notifyUsageError`: at least one test asserting the `${message}\n\n${usage}` shape and the `"error"` severity arg (mirrors V1's existing `notifyUsageError` test).
- **D-16-18:** Test fixtures DO NOT import from `docs/output-catalog.md` (that's Phase 17's catalog UAT migration). Each test constructs its own expected string inline, anchored by D-16-04..D-16-15. The fixtures become the seed for Phase 17's `docs/output-catalog.md` rewrite -- Phase 17 lifts these expected strings into the catalog and the catalog UAT runner.

### Claude's Discretion

The planner has flexibility on:

- Exact byte form of the v2 v2 grammar for each variant -- anchored by D-16-04..D-16-15 but specific row-token order (e.g. `● plugin v1.2.3 (installed)` vs `● plugin (installed) v1.2.3`) is read off V1's `presentation/compact-line.ts` `renderRow` for compatibility ergonomics. Where v1.3 rules give an unambiguous answer, follow it. Where a v2-specific shape is being defined for the first time (e.g. marketplace header line shape), planner picks based on principles: short, scannable, consistent with v1.3 vocabulary (icon `●` for ok; `⊘` for failure-class).
- Exact rendering of orphan-fold `scope?` on plugin rows (D-16-17). Anchored by SNM-11 + MSG-PL-6 (existing scope-bracket carve-out for `available` / `unavailable`). Planner decides whether the bracket appears immediately after the plugin name (`● plugin [project] (installed)`) or in a trailing position.
- Exact rendering of empty `marketplaces: []` and empty `plugins: []`. SNM-30 + D-15-08 / D-15-09 anchor: empty arrays ARE the `(no marketplaces)` / `(no plugins)` rendering. Planner picks bytes (likely `(no marketplaces)` literal alone for empty top-level; `mp-header\n  (no plugins)` for empty per-marketplace, or just the bare header if cleaner).
- Whether to import `causeChainTrailer` from `presentation/cause-chain.ts` or from `shared/errors.ts` directly (both work; the former is the historical surface, the latter avoids any `presentation/` coupling -- both are inside D-11 layering).
- Whether to factor `renderPluginRow` further into per-variant helpers, or keep all 10 cases inline in the switch. Either preserves the assertNever guarantee.
- Mini-spec section in PLAN.md vs. annotated test file as Phase 17's authority source -- both ratify the same content (D-16-04 authority resolution); planner picks readability.
- Whether the SNM-12 / SNM-15 REQUIREMENTS.md edits (per D-16-01 / D-16-12) land as a separate plan in Phase 16, or as a docs-only commit inside the renderer plan. Both are atomic-per-plan compliant.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source-of-truth specs

- `.planning/REQUIREMENTS.md` §"Public API" SNM-12, SNM-13, SNM-14, SNM-15, SNM-16, SNM-17, SNM-18 -- Locked Phase 16 requirements. SNM-12 (`notify` signature) and SNM-15 (reload-hint gate) need editorial refinements per D-16-01 and D-16-12.
- `.planning/REQUIREMENTS.md` §"Test Coverage" SNM-30 -- Per-variant unit-test requirement, anchors D-16-16..D-16-18.
- `.planning/ROADMAP.md` §"Phase 16: Renderer & Public API (Alongside V1)" -- Goal statement + 5 success criteria. Note: SC #5's "catalog UAT byte-equality against V1 callsites unchanged" still holds (V1 callsites are untouched in Phase 16), even though `notify()` itself emits v2 form per D-16-04.
- `docs/adr/v2-001-structured-notify.md` -- Phase 15 refreshed this to Accepted; Phase 16 builds the renderer it specifies. If the ADR's Decision/Consequences section embeds a code snippet of `notify()`'s signature, the signature update from D-16-01 may need to flow there too (planner's call).

### Phase 15 lineage (immediate predecessor)

- `.planning/phases/15-type-model-adr-refresh/15-CONTEXT.md` -- Decisions D-15-01..D-15-16. Most relevant to Phase 16: D-15-01 (reasons placement), D-15-02 (dependencies placement), D-15-04 (version vs from/to placement), D-15-11 (runtime `as const` tuples and derived literal-union types), D-15-12 (per-variant structural invariants -- the compile-check file in `tests/architecture/notify-types.test.ts` already locks these).

### Source files Phase 16 modifies

- `extensions/pi-claude-marketplace/shared/notify.ts` -- Phase 16 ADDS public `notify(ctx, pi, message)` + `notifyUsageError(ctx, message)` + two file-private helpers (`renderMpHeader`, `renderPluginRow`) + the v2 grammar inline (icon constants, reload-hint literal, soft-dep marker literals). Does NOT modify or delete the existing V1 wrappers or the Phase 15 type model (lines 200-462).

### Source files Phase 16 reads but does not modify

- `extensions/pi-claude-marketplace/platform/pi-api.ts` lines 41-86 -- `SoftDepStatus` interface + `hasLoadedPiSubagents` / `hasLoadedPiMcpAdapter` / `softDepStatus(pi)` probe. Phase 16's `notify()` calls `softDepStatus(pi)` once per invocation.
- `extensions/pi-claude-marketplace/shared/errors.ts` -- `assertNever` (used by both file-private helpers' switch defaults) + `causeChainTrailer` depth-5 walker (used by per-plugin cause rendering per D-16-08).
- `extensions/pi-claude-marketplace/shared/types.ts` -- `Scope = "user" | "project"` (already imported by the Phase 15 type model).
- `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` -- `Reason` type + `REASONS` runtime array. Imported for reasons-block typing on the variants that carry `reasons`.
- `extensions/pi-claude-marketplace/presentation/compact-line.ts` -- V1 grammar reference for icon discipline (`ICON_INSTALLED = "●"`, `ICON_AVAILABLE = "○"`, `ICON_UNINSTALLABLE = "⊘"` at lines ~66-68), MSG-IC-1..3 routing rules, scope-bracket carve-outs (MSG-PL-6 / SNM-11), reasons-block formatting (MSG-GR-4). Phase 16 DUPLICATES the relevant constants/grammar inside `shared/notify.ts` rather than importing -- D-16-04 / D-16-09. The duplication ends in Phase 21.
- `extensions/pi-claude-marketplace/presentation/reload-hint.ts` -- V1 reload-hint reference. Phase 16 duplicates the `"/reload to pick up changes"` literal and the `${body}\n\n${hint}` join discipline inline (D-16-12 / D-16-13).
- `extensions/pi-claude-marketplace/presentation/cause-chain.ts` -- Re-exports `causeChainTrailer` from `shared/errors.ts`. Either import path is acceptable (Claude's Discretion).
- `extensions/pi-claude-marketplace/presentation/sort.ts` -- `compareByNameThenScope`. Not called by `notify()` (D-16-06); reference only.

### Tests Phase 16 modifies / adds

- `tests/shared/notify-v2.test.ts` -- NEW FILE. Per-status unit-test suite (≥ 20 cases per D-16-17). Mock-`ctx` pattern from `tests/shared/notify.test.ts` (V1 reference).
- `tests/architecture/notify-types.test.ts` -- Phase 15's compile-check (closed-set + per-variant invariants). NOT modified by Phase 16; planner reads it for context but does not touch it.
- `tests/architecture/catalog-uat.test.ts` -- NOT modified by Phase 16. Continues to test V1 composers via V1 wrappers. Phase 17 migrates it to drive `notify()` via structured fixtures (SNM-31).

### v1.3 user-contract reference (informative, not binding for Phase 16)

- `docs/messaging-style-guide.md` v1.0 -- V1 grammar contract; binding for V1 wrappers, INFORMATIVE for the v2 grammar Phase 16 ships (icon discipline carries; reasons-block formatting carries; scope-bracket carve-out carries). Phase 17 rewrites this to v2.0.
- `docs/output-catalog.md` v1.0 -- V1 per-command byte-equal outputs. Phase 17 rewrites to v2's always-marketplace-header form. Phase 16 unit-test fixtures are the seed for that rewrite.

### Phase boundary

- `.planning/PROJECT.md` §"Current Milestone: v1.4 Structured Notification Messages" -- Top-level rationale + net-LoC delta target (~4300 LoC removed across v1.4) + the always-marketplace-header spec change wording.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `extensions/pi-claude-marketplace/platform/pi-api.ts::softDepStatus(pi)` -- Single-call probe builder. Phase 16's `notify()` calls this once at the top and threads the result into per-row rendering. No re-implementation.
- `extensions/pi-claude-marketplace/shared/errors.ts::assertNever` -- Existing exhaustiveness helper. Phase 16 uses it at both switch defaults.
- `extensions/pi-claude-marketplace/shared/errors.ts::causeChainTrailer` -- Depth-5 cause-chain walker with cycle detection (T-13-04). Phase 16 uses it for per-plugin `cause?: Error` rendering (D-16-08). NFR-9 / T-13-05 invariant (no `.stack`, no absolute paths) is preserved automatically by reusing the walker.
- `extensions/pi-claude-marketplace/shared/notify.ts` Phase 15 type model (lines 200-462) -- `NotificationMessage`, `MarketplaceNotificationMessage`, 10-variant `PluginNotificationMessage` union, `PluginStatus` / `MarketplaceStatus` / `Dependency` derived literal unions, `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` / `DEPENDENCIES` runtime const tuples. Phase 16's switches narrow on `p.status` and `mp.status` via these types.
- `extensions/pi-claude-marketplace/presentation/compact-line.ts` icon constants and grammar (lines ~60-260) -- Reference (not import) for the v2 grammar Phase 16 ships. Duplicate the icon literals (`"●"`, `"○"`, `"⊘"`) and grammar rules inline inside `shared/notify.ts`.

### Established Patterns

- **Severity via Pi API's magic-string second arg** -- V1 wrappers pass `"warning"` / `"error"` / omit-for-info as the second arg to `ctx.ui.notify(message, severity?)`. Phase 16's `notify()` follows the same convention; the new design recomputes severity from payload but emits it the same way. The Pi API's severity arg surface is unchanged.
- **`as const` tuple + derived literal union** -- Phase 15 shipped the type-level pattern; Phase 16 inherits it (no new const tuples needed; the existing `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` are referenced by per-status unit tests' iteration loops if desired).
- **Discriminated union + `switch + assertNever`** -- Established in `presentation/compact-line.ts::renderRow` (kind discriminant). Phase 16 uses the same idiom on `mp.status` and `p.status` discriminants inside two file-private helpers.
- **Mock-ctx test pattern** -- `tests/shared/notify.test.ts` uses `{ ui: { notify: mock.fn() } }` via `node:test`'s `mock.fn()`. Phase 16's new test file uses the same pattern; the mock-`pi` shape (`{ getAllTools: () => [...] }`) is straightforward extension.
- **D-11 layering** -- `shared/` is the lowest layer (no imports from `presentation/` / `persistence/` / `domain/` / `orchestrators/` / `edge/`). Phase 16's `notify()` lives in `shared/notify.ts`; its allowed imports are `shared/types.ts`, `shared/grammar/reasons.ts`, `shared/errors.ts`, `platform/pi-api.ts` (for `softDepStatus` / `ExtensionAPI`). The grammar duplication choice (D-16-04 / D-16-09) keeps this clean -- `notify()` does NOT need to import from `presentation/*`.

### Integration Points

- **V1 wrappers coexist** -- `notifySuccess` / `notifyWarning` / `notifyError` / V1 `notifyUsageError(ctx, msg, usage)` all stay in `shared/notify.ts`. Both V1 and V2 surfaces export from the same module; no barrel changes (the V2 types are already exported per Phase 15).
- **Catalog UAT unchanged** -- `tests/architecture/catalog-uat.test.ts` reads `docs/output-catalog.md` and asserts byte-equality against V1 composer outputs. V1 callers route through V1 wrappers which call V1 composers (`renderRow`, `cascadeSummary`, etc.). `notify()` does not feed into catalog UAT in Phase 16. Phase 17 migrates the UAT to drive `notify()` via structured fixtures (SNM-31).
- **No call site touchpoints** -- Phase 16 adds the V2 entry points and tests them in isolation. No production file outside `shared/notify.ts` references the V2 entry points until Phase 18-20 migration waves.
- **MSG-* lint rules unaffected** -- The 34-rule MSG-* lint plugin scopes its rules via `eslint.config.js` `files:` globs covering orchestrators / edge / presentation. `shared/notify.ts` is already exempt (it's the sole sanctioned `ctx.ui.notify` call site). The V2 entry points live in the same file and inherit the same exemption.

</code_context>

<specifics>
## Specific Ideas

- **Mock `pi` shape for tests:** `{ getAllTools: () => [...] }` -- populate the array with `{ name: "subagent" }` to trigger `piSubagentsLoaded = true`, `{ name: "mcp" }` or `{ sourceInfo: { source: "...pi-mcp-adapter..." } }` for `piMcpAdapterLoaded = true`, empty array for both-absent. Probe failures degrade to `false` (the existing `softDepStatus` try/catch handles thrown `getAllTools`).
- **Reload-hint literal:** `"/reload to pick up changes"` -- exact string from `presentation/reload-hint.ts::RELOAD_HINT_TRAILER`. Duplicate inside `shared/notify.ts` as a file-private const (D-16-12 / D-CMC-07 idiom reference: one-consumer literal does not earn extraction across module boundaries).
- **Soft-dep marker literals:** `"{requires pi-subagents}"` and `"{requires pi-mcp}"` -- exact strings the existing V1 grammar emits. Sourced from `presentation/compact-line.ts` reasons-block composition. Duplicate inside `shared/notify.ts` (D-16-15) consistent with D-16-04.
- **The `"manual recovery"` literal with a space** -- Status discriminator is the literal string `"manual recovery"` (matches Phase 15 `shared/notify.ts:227`). The renderer emits the discriminator literal verbatim into the `(<status>)` slot -- no transformation to `"manual-recovery"` or `"manualRecovery"`.
- **Severity arg shape passed to `ctx.ui.notify`:** info severity → omit the 2nd arg entirely (V1 `notifySuccess` precedent at `shared/notify.ts:56`); warning → pass `"warning"`; error → pass `"error"`. Tests assert via `mock.calls[0]!.arguments` length + values (V1 test reference: `tests/shared/notify.test.ts:25-30`).
- **`notifyUsageError` on-the-wire shape:** `${message}\n\n${usage}` joined with one blank line; passed to `ctx.ui.notify(body, "error")`. Mirrors V1's `shared/notify.ts:96` and `tests/shared/notify.test.ts` `notifyUsageError` tests.

</specifics>

<deferred>
## Deferred Ideas

- **Migrating any orchestrator or edge call site to `notify()`** -- Phases 18 (marketplace family), 19 (plugin family), 20 (edge + UsageError). Phase 16 ships the entry points only.
- **Deleting V1 wrappers, MSG-* lint rules, `presentation/*` composers** -- Phase 21 final teardown. Phase 16's grammar duplication inside `shared/notify.ts` ends when V1 wrappers and composers are deleted together (D-16-04 explicitly bounds the duplication to the Phase 16-20 window).
- **Rewriting `docs/messaging-style-guide.md` (v1.0 → v2.0)** -- Phase 17 (SNM-19). Phase 16's per-status unit-test fixtures are the seed for what v2.0 ratifies.
- **Rewriting `docs/output-catalog.md` to always-marketplace-header form** -- Phase 17 (SNM-20). Phase 16's unit-test expected strings flow into this rewrite.
- **Migrating `tests/architecture/catalog-uat.test.ts` to drive `notify()` via structured fixtures** -- Phase 17 (SNM-31). Phase 16's per-status unit tests prove `notify()` correctness; Phase 17's catalog UAT migration makes the byte-equality gate the binding contract.
- **Splitting `notify()`'s internal helpers into multiple files under `shared/notify/`** -- Phase 16 keeps everything in `shared/notify.ts` for the bounded-duplication window. Phase 21 may split the post-deletion `shared/notify.ts` if it grows past readable bounds.
- **Removing the grammar duplication via a `presentation/* → shared/notify` import** -- Rejected for Phase 16 per D-16-04 / D-16-09. The duplication is intentional and ends in Phase 21.
- **Pruning `Reason` to a v1.4-active subset** -- Carried over from Phase 15's deferred list (D-15-03 rationale). Revisit in Phase 21 alongside the `shared/grammar/` retire-or-keep decision (SNM-29).
- **Branded `Version` type with `hash-<12hex>` / semver validation** -- Carried over from Phase 15. Phase 16 keeps `version: string`. Backlog.
- **JSON output mode for notifications** -- REQUIREMENTS.md §"Out of Scope" -- backlog. Structured payloads make it cheaper post-v1.4 but not in this milestone.

### Reviewed Todos (not folded)

None -- no todo-matching step run (no `gsd-sdk query todo.match-phase 16` matches expected for a renderer phase with no outstanding tech-debt entries pre-targeted at this scope).

</deferred>

---

*Phase: 16-Renderer & Public API (Alongside V1)*
*Context gathered: 2026-05-25*
