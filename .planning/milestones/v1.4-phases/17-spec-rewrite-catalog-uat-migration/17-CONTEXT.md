# Phase 17: Spec Rewrite & Catalog UAT Migration - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Catch the user-facing spec (`docs/messaging-style-guide.md` v1.0 → v2.0 and `docs/output-catalog.md` v1.0 → v2.0) up to what Phase 16's `notify()` renderer already ships, and migrate `tests/architecture/catalog-uat.test.ts` to drive `notify()` via structured `NotificationMessage` fixtures through a mock `ctx` (instead of running V1 composers like `renderRow` / `cascadeSummary` directly). The v2 grammar's always-marketplace-header form becomes the binding contract for every per-command section; the byte-equality assertion against the catalog remains the user-contract gate per SNM-31.

Phase 17 ships requirements SNM-19, SNM-20, SNM-31, and (by D-17-02 forced consequence) advances SNM-26 from Phase 21 → Phase 17.

Scope:

1. Rewrite `docs/messaging-style-guide.md` v1.0 → v2.0 as a thin pointer doc (~150-250 lines, ~5-7 sections -- see D-17-07). Delete YAML frontmatter (`status_tokens`, `reasons`, `markers`, `pattern_classes`) per D-17-01. Delete §16 Pattern Class Reference (~260 lines) and merge §17 Worked Examples Gallery into the catalog. Preserve §15 ES-5 Supersession Table with a "fully retired Phase 21" annotation per D-17-08.
2. Rewrite `docs/output-catalog.md` v1.0 → v2.0 keeping the existing 14 per-command H2 structure but rewriting EVERY per-command section to the always-marketplace-header form. Single-plugin install / update / uninstall / reinstall now render two-line output (`● <mp> [<scope>]\n  ● <plugin> (<status>)`). Catalog is silent on migration state per D-17-04 -- v2 expected outputs are the forward-looking spec; readers consult REQUIREMENTS.md SNM-23 / ROADMAP.md for migration progress.
3. Rewrite `tests/architecture/catalog-uat.test.ts` to:
   - Continue walking `docs/output-catalog.md` per-command H2 sections + extracting `<!-- catalog-state: STATE -->` annotated fenced blocks per D-17-06 (marker convention unchanged).
   - Replace V1-composer fixture construction with a `Map<(section, state), NotificationMessage>` per D-17-05; each entry's payload is fed through `notify(ctx, pi, message)` against a mock `ctx` + mock `pi` (mirroring the pattern Phase 16's `tests/shared/notify-v2.test.ts` already established).
   - Assert byte-equality between `notify()` output and the catalog's expected block.
   - Drop all V1-composer assertions per D-17-03 (pure exclusion).
4. Delete `tests/architecture/grammar-frontmatter.test.ts` per D-17-02 (frontmatter gone → nothing to assert parity against; closed-set membership locked at compile time by Phase 15's `tests/architecture/notify-types.test.ts`).
5. Update `.planning/REQUIREMENTS.md` traceability: SNM-26 owner column `Phase 21 → Phase 17`, status `Pending → Complete` when this phase lands.
6. Add the Phase 17 cross-reference inside `docs/adr/v2-001-structured-notify.md` "Accepted" status block (success criterion #5; editorial only).
7. Keep `npm run check` GREEN per success criterion #5 -- this includes resolving any incidental failures from `tests/architecture/no-legacy-markers.test.ts` if its source set referenced the deleted frontmatter (planner inspects + adjusts; the test itself stays through Phase 21 per SNM-28).

**Out of scope (not Phase 17):**

- Migrating any orchestrator / edge / plugin-family callsite from V1 wrappers to `notify()` -- Phases 18 (marketplace family), 19 (plugin family), 20 (edge + UsageError).
- Deleting V1 wrappers (`notifySuccess` / `notifyWarning` / `notifyError` / V1 `notifyUsageError`), the 34-rule MSG-* lint plugin, or the V1 `presentation/*` composers -- Phase 21 (SNM-22, SNM-27, SNM-32).
- Reviewing / updating `tests/architecture/no-legacy-markers.test.ts` source set against V2 vocabulary -- Phase 21 (SNM-28); Phase 17 only patches it if `npm run check` breaks as a side-effect.
- Retiring `shared/grammar/*.ts` files (`status-tokens.ts`, `reasons.ts`, `markers.ts`, `pattern-classes.ts`) -- Phase 21 (SNM-29). `shared/notify.ts` still imports `Reason` from `shared/grammar/reasons.ts` per Phase 15 D-15-03; that import survives Phase 17.

</domain>

<decisions>
## Implementation Decisions

### Style guide v2.0 shape

- **D-17-01:** Delete YAML frontmatter (`status_tokens`, `reasons`, `markers`, `pattern_classes`) from `docs/messaging-style-guide.md` v2.0. The binding closed-set authority is now the const tuples in `extensions/pi-claude-marketplace/shared/notify.ts` (`PLUGIN_STATUSES`, `MARKETPLACE_STATUSES`, `DEPENDENCIES` per Phase 15 D-15-11) plus `REASONS` in `extensions/pi-claude-marketplace/shared/grammar/reasons.ts`. Aligned with D-16-04 "renderer is the spec authority" and the v1.4 net-LoC reduction target. Style guide drops ~60 frontmatter lines.
- **D-17-02:** Delete `tests/architecture/grammar-frontmatter.test.ts` (91 lines). With frontmatter gone, the YAML↔REASONS parity assertion has nothing to validate. Closed-set membership is already locked at compile time by Phase 15's `tests/architecture/notify-types.test.ts` (D-15-10/12). Advances SNM-26 from Phase 21 → Phase 17 (forced consequence of D-17-01, not scope creep -- Phase 17's success criterion #5 requires `npm run check` GREEN). Planner updates `.planning/REQUIREMENTS.md` traceability table accordingly.
- **D-17-07:** v2.0 style guide is a thin pointer doc, ~150-250 lines, ~5-7 H2 sections:
  - **Overview** -- purpose + audience + v1.0→v2.0 supersession note.
  - **Type Model Reference** -- short narrative + pointers at `extensions/pi-claude-marketplace/shared/notify.ts` (types + const tuples + the `notify(ctx, pi, message)` renderer) and `tests/architecture/notify-types.test.ts` (compile-check). NO enumeration of closed sets in the prose -- types ARE the contract.
  - **Output Grammar Summary** -- one-page rule list: always-marketplace-header form, indentation discipline (header at column 0, plugin rows at 2-space indent, per-plugin cause chains at 4-space indent), computed severity routing, computed reload-hint with state-changing-marketplace refinement (per D-16-12), computed soft-dep markers (per D-16-15), inline per-plugin cause chains (per D-16-08), no separate cascade-summary line (per D-16-05).
  - **Severity Routing** -- first-match-wins ladder (failed → error; skipped/manual recovery → warning; else success/info) per Phase 16 D-16-11.
  - **ES-5 Supersession Table** -- verbatim retention of v1.0 §15 with a one-line annotation "fully retired Phase 21 -- see `tests/architecture/no-legacy-markers.test.ts`" per D-17-08.
  - **Cross-References** -- links to `docs/output-catalog.md` (byte-equal examples), `docs/adr/v2-001-structured-notify.md` (design rationale), `extensions/pi-claude-marketplace/shared/notify.ts` (types + renderer), `tests/architecture/notify-types.test.ts` (closed-set proof), `tests/architecture/catalog-uat.test.ts` (user-contract gate), PRD §6.12 (ES-5 origin).
  - **Deletions vs. v1.0:** §16 Pattern Class Reference (~260 lines) deleted -- patterns flow from the discriminated-union switches in `shared/notify.ts`; per-command examples live in the catalog. §17 Worked Examples Gallery (~100 lines) merged into the catalog's per-command sections (no duplication). §3 Status Tokens, §4 Reasons Enum -- deleted as standalone enumeration sections; their content is now a single sentence pointing at the const tuples. §11 Plugin List Rendering -- folded into "Output Grammar Summary" (one paragraph; binding form is in catalog).
- **D-17-08:** ES-5 Supersession Table stays in v2.0 style guide §"ES-5 Supersession Table" verbatim from v1.0 §15, with an added one-line annotation: "The 5 ES-5 legacy markers remain blocked by `tests/architecture/no-legacy-markers.test.ts` and are fully retired alongside V1 wrapper deletion in Phase 21." ADR and PRD are NOT modified on this axis (D-17-08 is strictly a style-guide editorial; the supersession record was originally in the style guide and stays co-located).

### Catalog v2.0 shape & migration-state signaling

- **D-17-04:** `docs/output-catalog.md` v2.0 is silent on per-command migration state. The catalog presents v2 expected outputs as the authoritative forward-looking spec. No "currently V1 / migrated via notify()" annotations per section. Readers consult `.planning/REQUIREMENTS.md` SNM-23 traceability + `.planning/ROADMAP.md` Phase 18/19/20 entries for migration progress. Lowest doc-churn (no edits required when Phase 18/19/20 land); cleanest catalog as binding spec.
- **Section preservation:** Keep all 14 existing per-command H2 sections (`/claude:plugin list`, `install`, `uninstall`, `reinstall`, `update`, `import`, `bootstrap`, `marketplace list`, `marketplace add`, `marketplace remove`, `marketplace update`, `marketplace autoupdate`) plus `Manual recovery anchors`, `Empty / no-op surfaces`, `Usage errors`. Rewrite each section's expected outputs to the v2 form. The non-command structural sections (`Conventions`, `Severity routing`, `Status token reference`, `Cross-references`, `Resolutions to apply to docs/messaging-style-guide.md`) survive but are rewritten or pruned consistent with D-17-07's "renderer is the spec" framing.
- **Single-plugin command headline change:** Per goal + Phase 16 D-16-04, single-plugin install / update / uninstall / reinstall rewrite from one-line `● commit-commands [user] (installed)` to two-line:
  ```
  ● claude-plugins-official [user]
    ● commit-commands (installed)
  ```
  Plugin-row scope bracket is OMITTED when plugin.scope == marketplace.scope (header carries the scope); orphan-fold case (plugin.scope ≠ marketplace.scope) emits the bracket on the plugin row per Phase 16 D-16-17. Catalog includes at least one orphan-fold example to lock the rule.

### Catalog UAT test rewrite (SNM-31)

- **D-17-03:** Pure exclusion strategy for V1 callsites during Phase 17-20 migration window. The rewritten `tests/architecture/catalog-uat.test.ts` runs `notify()` only -- every catalog state's expected output is asserted against `notify(ctx, pi, message)` invoked with a structured `NotificationMessage` fixture under a mock `ctx` (`{ ui: { notify: mock.fn() } }`). V1 wrappers (`notifySuccess` / `notifyWarning` / `notifyError` / V1 `notifyUsageError`) stay covered only by their existing unit tests (`tests/shared/notify.test.ts`); no byte-equal catalog gate runs against V1 composers or V1 callsites. Justification: V1 wrappers FROZEN per Phase 16 D-16-04, deletion scheduled Phase 21 (SNM-22), bounded migration window. Risk acknowledged: subtle V1-side regression in Phase 17-20 wouldn't be caught by catalog UAT (only by V1 unit tests). Mitigation: V1 wrappers are not being modified.
- **D-17-05:** Inline catalog parser pattern mirrored from V1: the test reads `docs/output-catalog.md` at runtime, walks per-command H2 sections, pairs each `<!-- catalog-state: STATE -->` HTML-comment marker with the next fenced output block. Fixtures live in the test file as a `Map<(section, state), NotificationMessage>` constant -- one entry per catalog state. Catalog text is the SOLE source of expected output bytes; the test never duplicates rendered examples in TS code. Test body composition mirrors the current `tests/architecture/catalog-uat.test.ts` shape (sections, per-state fenced blocks, byte-equality assertion) but the renderer call switches from `renderRow` / `cascadeSummary` / etc. to `notify(ctx, pi, message)`. Mock `pi` shape: `{ getAllTools: () => [...] }` matching Phase 16's pattern (per Phase 16 specifics).
- **D-17-06:** Reuse existing `<!-- catalog-state: STATE -->` HTML-comment marker convention verbatim. STATE strings remain human-readable identifiers (`"happy-path"`, `"scope-mismatch"`, `"marketplace-not-found"`, etc.). (section, state) tuple keys the fixture lookup map. No new marker shape introduced; reviewers' learning curve is zero.
- **Fixture coverage scope:** Every (section, state) tuple in the rewritten catalog must have a corresponding fixture entry. Phase 17's catalog state set EXTENDS Phase 16's per-variant fixture set: each command section composes one or more `MarketplaceNotificationMessage` instances each containing 0-N `PluginNotificationMessage` rows, where each plugin variant is drawn from the 10 plugin statuses + 4 marketplace statuses + edge cases (rollbackPartial, multi-cause cascade, soft-dep markers, scope-bracket carve-out, orphan-fold). Phase 16's unit test fixtures (`tests/shared/notify-v2.test.ts`) are the SEED -- planner may import (after refactoring to a shared module) or hand-rebuild for clarity; either is acceptable.
- **D-17-09:** v2 catalog DROPS V1-only free-text augmentations that have no representation in the v2 `notify()` grammar: the `Claude plugin import summary` preamble, the `Fix the underlying issue and retry.` retry anchor, and the `source-mismatch` diagnostic line. Preserving them would require production-source changes to `notify()`, which is out of scope for Phase 17's documentation-and-test-only charter. The v2.0 catalog Conventions section documents the v1→v2 behavior change so readers understand the deliberate simplification. The catalog UAT therefore has no fixture entries for these dropped surfaces -- they exit the user-contract gate.
- **D-17-10:** v2 catalog DROPS the V1-only `install-failure-with-anchor` manual-recovery state (failed install row paired with a top-level free-form `(manual recovery)` line for a system-level resource like `agent index`). The v2 type model has no top-level free-form recovery anchor -- `PluginManualRecoveryMessage` is a per-plugin variant inside a marketplace block, not a system-level wrapper. Preserving the state would require either extending `PluginManualRecoveryMessage` with an `orphanDetails` field (production-source change, out of scope) or semantically awkward modeling via `cause: Error` text. v2 catalog rewrite simply omits the state; the `manual-recovery` Phase 16 fixtures already cover the per-plugin recovery anchor under a marketplace block, which is the v2-canonical shape. Phase 17 catalog UAT has no fixture entry for `install-failure-with-anchor`.

### Claude's Discretion

The planner has flexibility on:

- Exact heading numbering / wording of the v2.0 style guide's ~5-7 sections -- D-17-07 anchors the section inventory, but exact ordering is planner's call.
- Whether the v2.0 style guide's "Type Model Reference" section embeds a small TypeScript code snippet (e.g., the `NotificationMessage` union shape) inline or strictly pointers at `shared/notify.ts`. Either preserves the "renderer is the spec" framing.
- Whether the existing `## Resolutions to apply to docs/messaging-style-guide.md` section (catalog lines 925-967) survives the rewrite or gets folded into the v2.0 style guide's Overview section as historical context. It was an authoring-time scratchpad in v1.0; v2.0 may absorb or retire it.
- Whether Phase 17's `tests/architecture/catalog-uat.test.ts` rewrite happens as one atomic plan (full replacement) or two plans (rewrite parser + fixture map, then swap V1-composer calls → `notify()` calls). Both are atomic-per-plan compliant.
- Exact fixture-module organization for catalog fixtures -- inline in the test file (simplest, current pattern) or factored to a `tests/architecture/catalog-fixtures.ts` helper (DRY if any fixtures are reused by per-variant unit tests too). Both satisfy D-17-05.
- Whether to refactor Phase 16's `tests/shared/notify-v2.test.ts` fixtures into a shared module that catalog-uat imports -- net win if it eliminates duplication; planner picks based on whether the variant→command mapping is clean.
- Where the SNM-23 traceability-table edit for SNM-26 lands (separate REQUIREMENTS.md plan vs. inside the style-guide rewrite plan vs. inside the test-deletion plan). All three are atomic-per-plan compliant.
- The Phase 17 cross-reference inside the ADR (success criterion #5) -- may land as a separate plan or be folded into the style-guide rewrite plan. Both are atomic.
- Exact rendering of `docs/output-catalog.md` §Conventions in v2.0 -- the existing Conventions section (lines 5-129) covers glyphs, fold rules, marketplace-header rules, etc. v2 grammar simplifies some of these (always-marketplace-header eliminates the "single-plugin commands skip header" carve-out). Planner trims / rewrites Conventions as the v2 grammar dictates.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source-of-truth design

- `.planning/REQUIREMENTS.md` §"Spec & Docs" SNM-19, SNM-20 + §"Migration & Deletion" SNM-26 -- Locked Phase 17 requirements. SNM-19 (style guide rewrite, frontmatter strategy), SNM-20 (catalog rewrite, always-marketplace-header), SNM-26 (`grammar-frontmatter.test.ts` rewrite or delete -- Phase 17 deletes per D-17-02). Traceability table updates per D-17-02 (SNM-26 owner Phase 21 → Phase 17).
- `.planning/REQUIREMENTS.md` §"Test Coverage" SNM-31 -- Catalog UAT migration to `notify()` via structured fixtures. Byte-equality assertion remains the binding user-contract gate.
- `.planning/ROADMAP.md` §"Phase 17: Spec Rewrite & Catalog UAT Migration" -- Goal statement + 5 success criteria. Criterion #4 (V1 callsites excluded or covered by transitional snapshot) resolved by D-17-03 (pure exclusion). Criterion #5 ADR cross-reference is a small editorial pass.
- `docs/adr/v2-001-structured-notify.md` -- Accepted (Phase 15 D-15-13). Phase 17 adds a small "Landed via Phase 17 -- spec + catalog UAT migration" cross-reference to the Accepted-status block (success criterion #5; editorial only).

### Phase 16 lineage (immediate predecessor -- authority for v2 grammar)

- `.planning/phases/16-renderer-public-api-alongside-v1/16-CONTEXT.md` -- Decisions D-16-01..D-16-18. D-16-04 ("renderer is the spec authority") is the controlling anchor for Phase 17's catalog rewrite: every catalog-stated expected output must be byte-equal to what `notify()` emits. D-16-18 explicitly designates Phase 16's per-variant unit-test fixtures as the SEED for Phase 17's catalog content.
- `extensions/pi-claude-marketplace/shared/notify.ts` (1065 lines after Phase 16) -- The v2 grammar IS this file's renderer behavior. `notify(ctx, pi, message)` is the binding entry point. File-private helpers `renderMpHeader` + `renderPluginRow` own the per-status switches with `assertNever` exhaustiveness. Phase 17 catalog UAT calls this function via mock `ctx` + mock `pi`.
- `tests/shared/notify-v2.test.ts` (1141 lines) -- Phase 16's per-variant unit tests. Authoritative source for v2 expected output strings per `(plugin status × marketplace status × edge case)` combination. Phase 17 catalog UAT lifts these expected strings into per-command catalog states + adds composition fixtures.

### Phase 15 lineage (closed-set authority)

- `.planning/phases/15-type-model-adr-refresh/15-CONTEXT.md` -- Decisions D-15-01..D-15-16. Most relevant to Phase 17: D-15-10/12 (`tests/architecture/notify-types.test.ts` locks compile-time closed-set membership -- the safety net that justifies D-17-02 deleting `grammar-frontmatter.test.ts`); D-15-11 (`PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` / `DEPENDENCIES` as const tuples -- Phase 17's style guide v2.0 points at these instead of duplicating in frontmatter).
- `tests/architecture/notify-types.test.ts` -- Phase 15 compile-check file. NOT modified by Phase 17; referenced by D-17-07 style-guide "Type Model Reference" section as the compile-time closed-set proof.

### Source files Phase 17 modifies

- `docs/messaging-style-guide.md` -- Full rewrite v1.0 → v2.0 per D-17-01 + D-17-07 + D-17-08. Delete YAML frontmatter; restructure to ~5-7 sections (~150-250 lines); preserve ES-5 Supersession Table verbatim with retirement annotation; merge §17 Worked Examples into the catalog.
- `docs/output-catalog.md` -- Full rewrite v1.0 → v2.0 per D-17-04 + always-marketplace-header form. Keep 14 per-command H2 structure; rewrite each section's expected outputs to v2 grammar; single-plugin commands now render two-line marketplace-header form; silent on migration state; `<!-- catalog-state: STATE -->` marker convention preserved per D-17-06.
- `tests/architecture/catalog-uat.test.ts` -- Full rewrite per D-17-03 + D-17-05. Swap V1-composer calls (`renderRow` / `cascadeSummary` / `renderManualRecovery` / `renderRollbackPartial` / `renderPluginList` / `renderMarketplaceList` / `appendReloadHint`) for a single `notify(ctx, pi, message)` invocation per fixture under mock `ctx` + mock `pi`. Fixture map keyed by (section, state) tuples extracted from the rewritten catalog.
- `.planning/REQUIREMENTS.md` -- Traceability table edit per D-17-02: SNM-26 owner `Phase 21 → Phase 17`, status `Pending → Complete` upon phase completion. Per-phase distribution line update (Phase 17 +SNM-26; Phase 21 -SNM-26).
- `docs/adr/v2-001-structured-notify.md` -- Add Phase 17 cross-reference to Accepted-status block (success criterion #5; one-line editorial).

### Source files Phase 17 deletes

- `tests/architecture/grammar-frontmatter.test.ts` (91 lines) -- Deleted per D-17-02. Frontmatter ↔ REASONS parity no longer applicable when frontmatter is removed.

### Source files Phase 17 reads but does not modify

- `extensions/pi-claude-marketplace/shared/notify.ts` -- Read for v2 grammar reference. NOT modified.
- `tests/shared/notify-v2.test.ts` -- Read for per-variant expected-string seeds. NOT modified.
- `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` -- `Reason` type + `REASONS` const array still imported by `shared/notify.ts`'s plugin variants per Phase 15 D-15-03. NOT modified in Phase 17 (Phase 21 SNM-29 decides retire-or-keep).
- `tests/architecture/no-legacy-markers.test.ts` -- Read for impact assessment. If its source-set logic referenced the deleted frontmatter, planner patches the source resolution (minimal change to keep `npm run check` GREEN). Full review/update is SNM-28 (Phase 21).
- `tests/shared/notify.test.ts` -- Read for V1-wrapper test pattern reference (mock-ctx shape). V1 wrappers' BEHAVIOR coverage. NOT modified.
- `extensions/pi-claude-marketplace/presentation/*` -- V1 composers (`compact-line.ts`, `cascade-summary.ts`, `manual-recovery.ts`, `rollback-partial.ts`, `plugin-list.ts`, `marketplace-list.ts`, `reload-hint.ts`, `cause-chain.ts`, `sort.ts`). Read-only references for V1 grammar to validate the v2 catalog's `(no marketplaces)` / `(no plugins)` / orphan-fold renderings remain consistent with what V1 surfaces emitted. NOT modified in Phase 17.

### v1.4 net-LoC milestone context

- `.planning/PROJECT.md` §"Current Milestone: v1.4 Structured Notification Messages" -- Top-level rationale + net-LoC delta target (~4300 LoC removed across v1.4). Phase 17 contributes: style guide -~720 lines (970 → ~250); `grammar-frontmatter.test.ts` -91 lines; catalog rewrite is net-neutral (rewrite, not deletion).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `tests/architecture/catalog-uat.test.ts` lines 1-80 (header + extraction logic) -- The catalog-state-marker walking pattern is preserved per D-17-05/D-17-06. Lines that extract per-command H2 sections and pair `<!-- catalog-state: STATE -->` annotations with the next fenced block carry forward; the changes are confined to the renderer-call site (V1 composers → `notify()`) and the fixture-map shape (per-command RowSpec/inputs → per-(section,state) `NotificationMessage`).
- `tests/shared/notify-v2.test.ts` mock-ctx pattern -- `{ ui: { notify: mock.fn() } }` via `node:test`'s `mock.fn()`. Mock-`pi` shape: `{ getAllTools: () => [...] }`. Phase 17's catalog UAT uses the identical mocking surface; no third-party mocking framework.
- `extensions/pi-claude-marketplace/shared/notify.ts::notify()` -- Public entry point. Catalog UAT calls this once per (section, state) fixture with `(mockCtx, mockPi, fixtureMessage)`. The mock `ctx.ui.notify` capture extracts the emitted body string + severity arg for the byte-equality assertion.
- `tests/architecture/notify-types.test.ts` -- Compile-check file. Style-guide v2.0 §"Type Model Reference" points readers here as the closed-set proof. NOT modified.

### Established Patterns

- **Catalog-state-marker convention** -- `<!-- catalog-state: STATE -->` HTML comments paired with the NEXT fenced block, scoped to per-command H2 sections. Phase 17 preserves verbatim per D-17-06; STATE strings remain human-readable identifiers.
- **Byte-equality user-contract gate** -- V1's catalog UAT asserted `actual === expected` against catalog-extracted text. Phase 17's V2 UAT preserves this discipline; the change is at the renderer-input layer, not the assertion shape.
- **Renderer-as-spec discipline** -- Phase 16 D-16-04 established that the v2 grammar in `shared/notify.ts` IS the spec; docs catch up. Phase 17 catalog and style-guide rewrites materialize this -- catalog byte-strings come from what the renderer emits, style guide points at the renderer.
- **Closed-set authority hierarchy** -- Const tuples in `shared/notify.ts` (Phase 15 D-15-11) > derived literal-union types > prose references. Phase 17's style guide v2.0 reflects this: prose never duplicates closed-set membership; pointers go to the const tuples + the compile-check file.
- **Mock-ctx test composition** -- `node:test`'s `mock.fn()` for `ctx.ui.notify`; structural-mock `pi` for `softDepStatus(pi)`. Established by Phase 16 (`tests/shared/notify-v2.test.ts`); Phase 17 catalog UAT inherits.
- **D-11 layering** -- `shared/notify.ts` is the lowest layer; no `presentation/` / `persistence/` / `domain/` / `orchestrators/` / `edge/` imports. Phase 17's catalog UAT imports `notify()` from `shared/notify.ts`; does NOT import V1 composers from `presentation/*` (drop per D-17-03 pure exclusion).

### Integration Points

- **Phase 16's `notify()` ↔ Phase 17's catalog UAT** -- Phase 16 ships `notify()`; Phase 17 wires it to byte-equality assertion against the rewritten catalog. The interface is fixed (`(ctx, pi, message)`); Phase 17's plan does not modify it.
- **Phase 15's `notify-types.test.ts` ↔ Phase 17's style guide** -- The compile-check file is the closed-set proof; v2.0 style guide §"Type Model Reference" cites it as the binding closed-set source instead of duplicating in frontmatter.
- **REQUIREMENTS.md traceability ↔ Phase 17 deliverables** -- Phase 17 lands SNM-19, SNM-20, SNM-26 (advanced from Phase 21), SNM-31. Per-phase distribution line in REQUIREMENTS.md needs updating.
- **`tests/shared/notify.test.ts` (V1 wrappers, unchanged)** -- Stays as the SOLE byte-shape coverage for V1 wrappers during Phase 17-20 migration window. No catalog gate against it per D-17-03.
- **`tests/architecture/no-legacy-markers.test.ts`** -- Continues to block the 5 ES-5 legacy markers. Source-set update is Phase 21 (SNM-28); Phase 17 only patches if `npm run check` breaks as a side-effect of the frontmatter deletion.

</code_context>

<specifics>
## Specific Ideas

- **Goal's headline single-plugin example** -- `● commit-commands [user] (installed)` (v1.0 form) → `● claude-plugins-official [user]\n  ● commit-commands (installed)` (v2.0 form). Plugin row OMITS the scope bracket because plugin.scope == marketplace.scope. Catalog must include both this same-scope case and at least one orphan-fold case (plugin.scope ≠ marketplace.scope) per Phase 16 D-16-17 to lock the rule.
- **Soft-dep marker literals in catalog** -- `{requires pi-subagents}` and `{requires pi-mcp}` (exact strings per Phase 16 specifics). v2 catalog states that trigger these markers must include the marker in the expected output; the marker is render-time computed per D-16-15 (probe `softDepStatus(pi)` once per `notify()` call).
- **Reload-hint literal** -- `"/reload to pick up changes"` (exact string per Phase 16 D-16-12). v2 catalog appends this with a `${body}\n\n${hint}` join when any plugin status ∈ {installed, updated, reinstalled, uninstalled} OR any marketplace status ∈ {added, removed, updated} per D-16-12's refined SNM-15. Failed-only payloads do NOT trigger the hint -- the v2 catalog must include at least one failed-only state to lock the suppression case.
- **Multi-marketplace blank-line discipline** -- One blank line between marketplace blocks per Phase 16 D-16-07. v2 catalog includes at least one multi-marketplace state (e.g., `/claude:plugin list` with multiple marketplaces) to lock this rendering.
- **Severity arg shape** -- `info` → omit 2nd arg; `warning` → `"warning"`; `error` → `"error"` (per Phase 16 D-16-11 + specifics). Catalog UAT asserts severity arg via `mock.calls[0]!.arguments` length + values for each fixture.
- **`(no marketplaces)` / `(no plugins)` rendering** -- Phase 15 D-15-08/D-15-09 anchor: empty arrays ARE the explicit rendering. Catalog covers both via the Empty / no-op surfaces section.
- **The `"manual recovery"` literal with a space** -- Status discriminator is `"manual recovery"` (Phase 15 specifics). The v2 catalog emits the discriminator verbatim in the `(<status>)` slot.

</specifics>

<deferred>
## Deferred Ideas

- **Migrating callsites from V1 wrappers to `notify()`** -- Phase 18 (marketplace family: `marketplace add` / `remove` / `update` / `autoupdate` / `list`), Phase 19 (plugin family: `install` / `uninstall` / `reinstall` / `update` / `import` / `bootstrap`), Phase 20 (edge + UsageError). Phase 17 ships the spec the migration waves catch up to.
- **Deleting V1 wrappers (`notifySuccess`/`notifyWarning`/`notifyError`/V1 `notifyUsageError`)** -- Phase 21 (SNM-22). Co-located with Phase 21's lint plugin teardown + `presentation/*` deletion.
- **Deleting the 34-rule MSG-* lint plugin** -- Phase 21 (SNM-27).
- **Updating `tests/architecture/no-legacy-markers.test.ts` source set for V2 vocabulary** -- Phase 21 (SNM-28). Phase 17 only patches if `npm run check` breaks as a side-effect.
- **Retiring `shared/grammar/*.ts` files (`status-tokens.ts`, `reasons.ts`, `markers.ts`, `pattern-classes.ts`)** -- Phase 21 (SNM-29). `shared/notify.ts` still imports `Reason` from `reasons.ts` per Phase 15 D-15-03; that import survives Phase 17.
- **Deleting V1 `presentation/*` composers** -- Phase 21 (alongside SNM-22 wrapper deletion). All composers stay imported by V1 wrappers until then.
- **`npm run check` baseline drift accounting** -- Phase 21 SNM-32 accounts for net test-count change after all migrations land (1249 v1.3 baseline minus retired lint-rule tests, plus the new per-variant + catalog UAT tests). Phase 17 just keeps GREEN; no baseline reconciliation.
- **Branded `Version` type with `hash-<12hex>` / semver validation** -- Carried from Phase 15/16 backlog. Not relevant to Phase 17.
- **JSON output mode for notifications** -- REQUIREMENTS.md §"Out of Scope" backlog.
- **Pruning `Reason` to v1.4-active subset** -- Carried from Phase 15/16 backlog. Phase 21 may revisit alongside `shared/grammar/` retire-or-keep.
- **Factoring `tests/shared/notify-v2.test.ts` fixtures into a shared module imported by both per-variant unit tests AND catalog UAT** -- Planner discretion in Phase 17 (Claude's Discretion); if not done in Phase 17, may be revisited in Phase 21's test cleanup.

### Reviewed Todos (not folded)

None -- `gsd-sdk query todo.match-phase 17` not run; no outstanding tech-debt entries pre-targeted at the spec/catalog rewrite scope (the deferred ideas above are all phase-mapped already in REQUIREMENTS.md).

</deferred>

---

*Phase: 17-Spec Rewrite & Catalog UAT Migration*
*Context gathered: 2026-05-26*
