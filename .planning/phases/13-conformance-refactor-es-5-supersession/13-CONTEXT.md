# Phase 13: Conformance Refactor & ES-5 Supersession - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 13 is the **mechanical conformance refactor** that consumes the Phase 12 primitives (closed-set constants at `shared/grammar/`, the collapsed reload-hint composer at `presentation/reload-hint.ts`, the four sanctioned `notify*` wrappers in `shared/notify.ts`, the migrate.ts §14.1 wording) and rewrites every user-visible callsite plus the renderers behind them to conform to `docs/messaging-style-guide.md` v1.0 + `docs/output-catalog.md`. It also lands the §15 ES-5 supersession as a single atomic three-file commit.

**Scope (locked by ROADMAP.md and the style guide + catalog -- not re-discussed):**

1. Universal compact-line grammar + icons (CMC-01..07)
2. Status-token + reasons callsite discipline (CMC-09, CMC-10, CMC-12, CMC-13)
3. Reload-hint coexistence with recovery anchor + manual recovery + rollback-partial + cause-chain (CMC-15..18)
4. Severity routing for cascade summaries (CMC-20)
5. Per-scope rendering + plugin folding + adoption (CMC-21)
6. Per-command catalog conformance for `list`, `install`, `uninstall`, `reinstall`, `update`, `import`, `bootstrap`, `marketplace list`, `marketplace add`, `marketplace remove`, `marketplace update`, `marketplace autoupdate enable|disable`, entity-shaped non-cascade errors + usage errors (CMC-22..34)
7. ES-5 atomic three-file commit (CMC-35)

**Out of scope (deferred to Phase 14):** the frontmatter-driven drift-guard suite (CMC-38) that reads `status_tokens:` / `reasons:` / `markers:` / `pattern_classes:` from the style guide and asserts MSG-* rule compliance across the codebase. Phase 13 produces a conforming codebase; Phase 14 locks it structurally.

**Cross-cutting constraints (carried forward):** NFR-6 (`npm run check` stays green throughout), IL-2 (output channel via the four `notify*` wrappers; no direct `ctx.ui.notify` outside `shared/notify.ts`), IL-3 (single sanctioned `console.warn` at `persistence/migrate.ts` with inline eslint disable -- already in place from Phase 12), D-30 (style guide + catalog are the v1.3 user-contract; the §15 ES-5 supersession is the milestone's only user-contract change boundary; the Phase 12 D-CMC-10 reload-hint carve-out already landed).

</domain>

<decisions>
## Implementation Decisions

### Plan Decomposition + Wave Order

- **D-13-01:** Slicing is **layered**, not per-command or per-concern.
  - **Wave 1 -- cross-cutting primitives:** the new `presentation/` composers and the RowSpec payload model (see D-13-05..D-13-08), the sort helper (D-13-15), the interim-state ESLint rule (D-13-09), and any `PluginListEntry` / cascade-row payload extensions. Wave 1 lands ONCE; Wave 2 consumes its surface unchanged.
  - **Wave 2 -- per-command rewrites:** 12 commands rewritten against the Wave 1 primitives. Wave 2 is sub-divided in D-13-02.
  - **Wave 3 -- ES-5 supersession + catalog UAT:** see D-13-11..D-13-14.
  - Matches Phase 12's foundation-then-callsite pattern (D-CMC-01..D-CMC-10 from the Phase 12 context); maximises parallelism in Wave 2 by landing primitives once.

- **D-13-02:** Wave 2 is **grouped by render shape**, sub-waves serialise, commands within a sub-wave parallelise:
  - **Sub-wave 2a -- cascades:** `reinstall`, `update`, `import`. Shared shape = marketplace-header + indented cascade rows + per-row soft-dep marker + severity routing per MSG-SR-4..6.
  - **Sub-wave 2b -- single-plugin:** `install`, `uninstall`, `bootstrap`. Shared shape = inline single-plugin compact line (no marketplace header).
  - **Sub-wave 2c -- marketplace:** `marketplace list`, `marketplace add`, `marketplace remove` (conditional bare-row vs header), `marketplace update`, `marketplace autoupdate enable|disable`. Shared shape = marketplace-row outcome-class icon + marker slot.
  - **Sub-wave 2d -- list:** `/claude:plugin list`. The only PL-4 description-truncating surface; consumes the orchestrator-constructed folded payload (D-13-19).
  - Within each sub-wave, individual command plans can parallelise. Sub-waves serialise because each may surface a primitive refinement that subsequent sub-waves benefit from.

- **D-13-03:** The ES-5 atomic three-file edit (`extensions/pi-claude-marketplace/shared/markers.ts` + `tests/architecture/markers-snapshot.test.ts` + `docs/prd/pi-claude-marketplace-prd.md` §6.12) lives in **Wave 3 -- final cutover**, AFTER all Wave 2 sub-waves complete. Reasoning: when the cutover lands, every callsite is already conformant (the interim ESLint rule -- D-13-09 -- structurally proves this), so the atomic deletion of the legacy exports does not introduce any user-visible behavior change. The PRD §6.12 ES-5 edit + the snapshot test rows + the marker exports are deleted in a single git commit per the style guide §15 supersession contract. Other Wave 3 options (incremental per-marker; before Wave 2) are rejected -- the supersession is contractually atomic and pre-Wave 2 cutover would fail `npm run check` while callsites are still migrating.

- **D-13-04:** Wave 3 contains **two plans, executed in order**:
  - **First:** a per-command catalog conformance verification plan that runs each command's catalog examples through the new renderers and asserts byte-equal output against `docs/output-catalog.md`. This plan is the cutover gate -- if any UAT fails, the ES-5 atomic commit does not run. (Complementary to Phase 14's frontmatter drift guard -- Phase 14 reads the YAML closed sets, not the rendered catalog examples.)
  - **Second:** the ES-5 atomic three-file commit itself. If a regression slips past, rollback is a single `git revert <es-5-sha>` (D-13-13). The static-audit test (D-13-12) prevents re-introducing legacy emissions.

### Renderer Composer + Payload Model

- **D-13-05:** Compact-line composers use a **typed `RowSpec` discriminated union flowing through a single grammar-aware renderer**. The renderer owns MSG-GR-1 token order, the `<marker>` slot position, the `@<marketplace>` carve-out, the `[<scope>]` brackets, the `{reasons}` block, and the icon-set rule (MSG-IC-1..3). Orchestrators construct `RowSpec` values from state; they never hand-format compact-line tokens. Pattern continues `presentation/plugin-list.ts`'s payload-driven design and gives Phase 14's drift guard a single emission site to assert against. String-helper and hybrid approaches are rejected -- they spread token-order discipline across N call sites.

- **D-13-06:** The discriminated union covers at least: `PluginRow`, `MarketplaceRow`, `EmptyToken` (the bare `(no marketplaces)` / `(no plugins)` form), `ManualRecoveryLine`, `RollbackChild`. The planner / researcher may refine the shape during Wave 1 (e.g., whether `BootstrapMarketplaceRow` is a distinct kind or a `MarketplaceRow` variant). The discriminant key is at planner discretion -- `kind` is the codebase precedent.

- **D-13-07:** Per-row soft-dep predicates (CMC-13, the `{requires pi-subagents}` / `{requires pi-mcp}` reasons) live **on the `RowSpec` itself** as optional `declaresAgents?: boolean` and `declaresMcp?: boolean` fields. The orchestrator computes the `declares*` value from the plugin's manifest + installed-resource state (it already has that knowledge); the renderer probes the unloaded-companion predicate via the existing `orchestrators/edge-deps.ts` mechanism and emits the marker iff (declares AND companion unloaded). MSG-SD-3 ("never on `(uninstalled)` rows") is enforced structurally inside the renderer -- `(uninstalled)` status discriminates the row type so the renderer cannot emit the soft-dep reason on it. Renderer-injected probe and orchestrator-resolved markers are rejected -- the first violates D-11 (renderer reading persistence), the second forfeits structural enforcement of MSG-SD-3.

- **D-13-08:** Cascade summary severity (CMC-20, MSG-SR-4..6) lives in a **pure helper in `presentation/`**: `cascadeSeverity(rows: RowSpec[]) => 'success' | 'warning'`. The `cascadeSummary({mp, scope, rows})` composer returns `{message, severity}`; orchestrators destructure and call the matching `notifySuccess` / `notifyWarning` wrapper. Composer-internal `ctx.ui.notify` is rejected -- it would break D-07 (`shared/notify.ts` is the sole `ctx.ui.notify` callsite). Per-orchestrator severity computation is rejected -- duplicates MSG-SR-4..6 policy across the 5 cascade surfaces (reinstall, update, import, and the conditional partial-failure surfaces on `marketplace remove` / `marketplace update`).

### Composer Layout

- **D-13-15:** New `presentation/` files (**one file per concern**, consumed by the existing per-surface files):
  - `presentation/compact-line.ts` -- the `RowSpec` discriminated union, the grammar-aware renderer (handles MSG-GR-1 token order + the `@<marketplace>` carve-out per MSG-GR-2 + the `<marker>` slot per MSG-GR-5 + the reasons-block formatting per MSG-GR-4), and any private icon constants.
  - `presentation/cascade-summary.ts` -- `cascadeSummary({mp, scope, rows}) -> {message, severity}` and the `cascadeSeverity(rows)` helper.
  - `presentation/manual-recovery.ts` -- the top-level `⊘ <resource> (manual recovery) {<reason>}` composer with blank-line discipline (MSG-MR-1..2).
  - `presentation/rollback-partial.ts` -- the `(failed) {rollback partial}` parent + indented per-phase children composer (MSG-RP-1).
  - `presentation/cause-chain.ts` -- the `cause: <link1> -> <link2> -> ...` trailer with depth-5 bounded walk + `(truncated)` suffix (MSG-CC-1).
  - `presentation/sort.ts` (or named export from `compact-line.ts`) -- `compareByNameThenScope(a, b)` using `localeCompare` with `sensitivity: 'base'` and project-before-user tie-breaker per MSG-GR-3.
  - Existing files (`plugin-list.ts`, `marketplace-list.ts`, `reload-hint.ts`, `soft-dep.ts`) consume the new modules where they need a compact line or a sorted list. `presentation/index.ts` barrels each new module's public surface.
  - Bundle-into-`presentation/grammar/` and add-to-existing-files options are rejected -- the first risks confusion with `shared/grammar/` (which already exists for the closed-set constants); the second grows `plugin-list.ts` and `marketplace-list.ts` beyond their existing single concerns.

### ES-5 Atomic-Commit Positioning

- **D-13-09:** During Wave 2, the 5 legacy marker strings stay exported from `shared/markers.ts` (so the existing `tests/architecture/markers-snapshot.test.ts` keeps passing) but are **import-forbidden everywhere except `shared/markers.ts` itself and `markers-snapshot.test.ts`**. Enforcement: an ESLint `no-restricted-imports` rule added in Wave 1 that names each of `PI_SUBAGENTS_NOT_LOADED`, `PI_MCP_ADAPTER_NOT_LOADED`, `RELOAD_HINT_PREFIX`, `MANUAL_RECOVERY_REQUIRED`, `ROLLBACK_PARTIAL` and forbids importing from anywhere outside those two files. Any callsite still importing a legacy marker fails `npm run check` immediately. Ensures every Wave 2 sub-wave migrates cleanly; the Wave 3 atomic commit then deletes the exports, deletes the snapshot rows, deletes the ESLint rule entry, and edits PRD §6.12 in a single commit. Marking `@deprecated` is rejected -- it's a JSDoc warning, not a `npm run check` gate. "Migrate when ready" is rejected -- relies on plan discipline rather than structural enforcement.

- **D-13-10:** Phase 12's D-CMC-08 retains `RELOAD_HINT_PREFIX` as a snapshot-test-only export. The new ESLint rule from D-13-09 must accept this -- the rule's allow-list includes `markers-snapshot.test.ts` so the existing legacy assertion stays valid until the Wave 3 atomic commit removes both the export AND the snapshot row.

- **D-13-11:** PRD §6.12 ES-5 is rewritten in the atomic commit to a **brief pointer to the style guide §15 supersession table**: "v1.3 supersedes the V1 ES-5 marker strings; see `docs/messaging-style-guide.md` §15 (Supersession of ES-5) for the replacement table." The PRD remains the architectural contract; the style guide is the operational contract. Matches Phase 12's D-CMC-15 pattern (style guide owns the wording; the PRD or code aligns). Inline-replacement-table and delete-§6.12-entirely options are rejected -- the first duplicates content with style guide §15 (drift risk); the second breaks the PRD numbering and back-references to ES-1..ES-5.

- **D-13-12:** A **static-audit test in `tests/architecture/`** asserts the 5 legacy marker strings appear in zero non-test files outside `shared/markers.ts`. The test pins the 5 strings literally in its body (since they're being deleted from `markers.ts` in the same commit it gates). Until the Wave 3 atomic commit lands, the test is green because every Wave 2 sub-wave migrated cleanly under the D-13-09 ESLint rule. After the Wave 3 commit, the test continues to enforce zero re-introductions across the rest of the codebase's lifetime -- `npm run check`-gated. Programmatic enforcement of CMC-35 success criterion #2 ("AST/grep audit returns zero matches in user-visible emission sites"). Pre-commit grep script and manual grep options are rejected -- neither runs under `npm run check`.

- **D-13-13:** Rollback for the ES-5 atomic commit is **`git revert <es-5-sha>`** -- restores `shared/markers.ts` + snapshot rows + PRD §6.12 atomically. The Wave 3 catalog UAT plan (D-13-04, runs FIRST) acts as the pre-commit gate. The static-audit test (D-13-12) prevents legacy strings from being re-introduced into callsites even if a revert happens. Feature-flagged cutover is rejected -- the markers-snapshot test asserts byte-equality, which conflicts with conditional emission.

### CMC-21 Adoption Semantics

- **D-13-17:** Adoption is **render-time folding only**. State stays scope-pinned (each plugin record carries its own `scope` and marketplace name; marketplace records are independent per scope -- no change to the existing state model). The list renderer reads both scopes' marketplaces + plugins and either:
  - renders project-scoped `<mp>` plugins under the `<mp>[project]` header when that marketplace exists in project scope, OR
  - folds project-scoped `<mp>` plugins under the `<mp>[user]` orphan header when the project-scope marketplace does NOT exist.
  Adoption is automatic on the next list render after `marketplace add` lands the project-scope marketplace -- zero state mutation in the `marketplace-add` orchestrator beyond adding the marketplace itself. The marketplace-add orchestrator's CMC-30 contract is unchanged. State-mutation and hybrid options are rejected -- neither buys anything over render-time folding, and the latter grows the state schema with new invariants.

- **D-13-18:** The `[<scope>]` bracket on every plugin row reflects the plugin's **actual install scope on every surface** (list, install, update, reinstall, import cascades, mp list, mp remove children, mp update children, mp autoupdate). The fold rule from D-13-17 affects the *grouping* (which marketplace header the plugin appears under) on the list surface only; the per-row `[<scope>]` truth-value is universal across surfaces. Matches MSG-GR-3 ("scope rendering is per-scope on every surface"). List-only scope-truth is rejected -- introduces surface-specific divergence for the same plugin.

- **D-13-19:** The orphan-fold lookup lives in **`orchestrators/plugin/list.ts`** -- it reads both scopes' state, computes which project-scoped plugins are orphans (no project-scope marketplace exists for their marketplace name), and constructs a `PluginListPayload` where orphan project plugins are nested under the matching user-scope marketplace block (each row carries its actual `scope: 'project'`). The `plugin-list.ts` renderer just emits what it gets. Keeps fold policy in the orchestrator alongside state-reads per D-06; the renderer stays a pure formatter per D-11. Renderer-side folding is rejected -- the renderer would need state-structure knowledge. A separate `presentation/plugin-fold.ts` module is rejected -- over-extraction (one consumer ever).

### Claude's Discretion

- **`RowSpec` discriminant key.** D-13-06 leaves the key name (`kind`, `type`, etc.) to the planner. Codebase precedent at `presentation/plugin-list.ts:55` uses descriptive type names without a discriminant key (the union is inferred from required fields); the planner may keep that style or introduce an explicit `kind` field. Either is acceptable provided the union is exhaustive under `--strict` and exhaustiveness checks fire on missing cases.

- **Sub-wave 2c internal ordering (marketplace commands).** `mp remove`'s conditional bare-row-vs-header form (CMC-31) interacts with the recovery-anchor + reload-hint coexistence rule (CMC-15). `mp update`'s autoupdate-on-vs-off form (CMC-32) interacts with cascade severity (CMC-20). The planner decides whether to land `mp remove` and `mp update` first inside sub-wave 2c (because they exercise the most cross-cutting rules) or after the simpler `mp list` / `mp add` / `mp autoupdate` commands.

- **Cause-chain depth-5 walk implementation.** MSG-CC-1 specifies the output shape (`cause: <link1> -> <link2> -> ...`, depth 5, `(truncated)` suffix). The walk itself (`error.cause` traversal) can be iterative or recursive; the planner picks. The existing `errorMessage(cause)` helper in `shared/notify.ts` is single-level; D-CMC-12 from Phase 12 explicitly deferred the rewrite to Phase 13.

- **Plan count.** The wave structure (D-13-01..D-13-04) implies roughly: 1-3 plans in Wave 1 for primitives + payload model + ESLint rule; 4 sub-wave-2 plans (one per sub-wave) potentially split further into per-command plans; 2 plans in Wave 3. The planner decides the exact decomposition; the wave + sub-wave structure is the binding contract.

- **Catalog UAT runner shape.** Wave 3 plan #1 (per-command catalog conformance) needs to run each command's catalog example through the new renderers and assert byte-equal output. The planner / researcher decides whether this is a new test under `tests/architecture/`, a separate runner script invoked from `npm run check`, or a per-command snapshot test colocated with each surface. The contract is "byte-identical to the catalog example for each rendered state".

### Folded Todos

No todos folded -- `gsd-sdk query todo.match-phase 13` returned zero matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Normative Style + Catalog Contract (THE binding inputs for v1.3)

- `docs/messaging-style-guide.md` v1.0 -- Normative; supersedes PRD §6.12 ES-5. Phase 13 MUST read **§2** (universal compact-line grammar + MSG-GR-1..5), **§3** (status tokens + MSG-PL-4 `(upgradable)` list-only rule), **§4** (reasons enum + 23 frontmatter members), **§5** (reload hint MSG-RH-1), **§6** (icon discipline MSG-IC-1..3), **§7** (per-scope rendering MSG-GR-3 + plugin folding + adoption -- CMC-21 binding text), **§8** (rollback-partial parent + indented children -- MSG-RP-1), **§9** (manual recovery line MSG-MR-1..2), **§10** (severity routing MSG-SR-1..7), **§11** (cause chain MSG-CC-1, depth-5 + `(truncated)`), **§12** (soft-dep marker MSG-SD-1..3), **§13** (non-cascade error + usage error split MSG-NC-1..2), **§14** + **§14.1** (IL-3 console.warn -- already landed in Phase 12), **§15** (ES-5 replacement table -- Phase 13 binding contract for the atomic commit). The YAML frontmatter `status_tokens:` / `reasons:` are the binding closed sets -- Phase 12 already locked the codebase to them at `shared/grammar/status-tokens.ts` and `shared/grammar/reasons.ts`.
- `docs/output-catalog.md` -- Per-command rendered contract. Every Wave 2 sub-wave reads the relevant command's catalog section; the Wave 3 catalog UAT plan asserts byte-equality against every rendered example. Sections that drive Phase 13 plans: `list`, `install`, `uninstall`, `reinstall`, `update`, `import`, `bootstrap`, `marketplace list`, `marketplace add`, `marketplace remove`, `marketplace update`, `marketplace autoupdate enable|disable`.

### Phase Scope + Requirements

- `.planning/ROADMAP.md` §Phase 13 -- Authoritative Phase 13 scope, in-scope vs out-of-scope demarcation, success criteria #1..#5. Particularly: success criterion #1 (byte-identical catalog conformance) is the verification target for the Wave 3 UAT plan; success criterion #2 (zero legacy marker matches) is the verification target for D-13-12's static-audit test; success criterion #3 (per-row soft-dep markers fire correctly) drives D-13-07; success criterion #4 (per-scope rendering, fold + adoption round-trip) drives D-13-17..D-13-19; success criterion #5 (cascade severity routes correctly + reload-hint discipline) drives D-13-08.
- `.planning/REQUIREMENTS.md` §Milestone v1.3 -- The 31 CMC requirements in scope: CMC-01..07, CMC-09, CMC-10, CMC-12, CMC-13, CMC-15..18, CMC-20, CMC-21, CMC-22..34, CMC-35. Each requirement cites the relevant MSG-* rule(s) that govern conformance.

### Phase 12 Foundations (carry-forward decisions)

- `.planning/phases/12-messaging-foundations-renderer-primitives/12-CONTEXT.md` -- Phase 12 decisions Phase 13 consumes:
  - D-CMC-01..D-CMC-05: closed-set constants module shape at `shared/grammar/{status-tokens,reasons}.ts`.
  - D-CMC-06..D-CMC-10: collapsed reload-hint composer + 6 callsite migrations (already landed). D-CMC-10's carve-out narrative is relevant for understanding why Phase 12's user-visible change was authorized.
  - D-CMC-08: `RELOAD_HINT_PREFIX` retained as snapshot-test-only export until Phase 13 -- now deleted by the Wave 3 atomic commit.
  - D-CMC-11..D-CMC-13: four-wrapper minimalism in `shared/notify.ts`; no 5th wrapper introduced in Phase 13. Composers return strings (or `{message, severity}`) that flow into the four wrappers.
  - D-CMC-12: `notifyError`'s body cause-chain rewrite to MSG-CC-1 form is **explicitly Phase 13's work** -- driven by D-13-15 (`presentation/cause-chain.ts`).
  - D-CMC-14..D-CMC-16: migrate.ts §14.1 wording + IL-3 comment + style guide §14.1 doc edit -- all already landed in Phase 12; Phase 13 does not touch these.

### V1 Architecture + Stable User-Contract Primitives

- `docs/prd/pi-claude-marketplace-prd.md` §6.10 (module diagram + D-11 layering), §6.12 ES-2 (no `[error]` / `[warning]` prefix embedding -- reaffirmed by CMC-19), §6.12 ES-5 (the 5 legacy marker strings -- deleted by the Wave 3 atomic commit; replaced with a pointer to style guide §15 per D-13-11), §6.13 IL-2 (single output channel via `ctx.ui.notify`), §6.13 IL-3 (single sanctioned `console.warn` at `persistence/migrate.ts` -- preserved). PI-7 hash-version contract is informational only; Phase 13 doesn't touch hash-version logic.

### Existing Source Files Phase 13 Touches

- `extensions/pi-claude-marketplace/presentation/plugin-list.ts` -- Existing list renderer; Wave 2 sub-wave 2d migrates it to the `RowSpec` model and adds the orphan-fold consumption (D-13-19 constructs the folded payload upstream).
- `extensions/pi-claude-marketplace/presentation/marketplace-list.ts` -- Existing marketplace-list renderer; Wave 2 sub-wave 2c migrates it to the `RowSpec` model and adds the `<marker>` slot + outcome-class icon (CMC-05, CMC-07).
- `extensions/pi-claude-marketplace/presentation/reload-hint.ts` -- Already at the single-trailer form (Phase 12 D-CMC-06). Phase 13 only touches it if coexistence with the recovery anchor (CMC-15) requires composer changes.
- `extensions/pi-claude-marketplace/presentation/soft-dep.ts` -- Today's aggregated trailer composer. Wave 1 evaluates whether to delete it (per-row markers replace the aggregated form per CMC-12..13) or to repurpose it; planner decides.
- `extensions/pi-claude-marketplace/presentation/index.ts` -- Barrel updated to export the new compact-line, cascade-summary, manual-recovery, rollback-partial, cause-chain, and sort surfaces.
- `extensions/pi-claude-marketplace/shared/notify.ts` -- Four wrappers unchanged (Phase 12 D-CMC-11). The `errorMessage(cause)` helper is rewritten by D-13-15 / the cause-chain composer in Phase 13 to produce the MSG-CC-1 trailer (single-level → depth-5).
- `extensions/pi-claude-marketplace/shared/markers.ts` -- Wave 2 forbids importing the 5 legacy markers from anywhere except this file + the snapshot test (D-13-09 ESLint rule). Wave 3 atomic commit deletes the 5 exports.
- `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts`, `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` -- Phase 12's closed-set constants; Phase 13 callsites import from here.
- `extensions/pi-claude-marketplace/orchestrators/types.ts` -- Cascade-row payload types. Wave 1 extends with the `RowSpec` discriminated union OR with new fields on existing types (planner decides per D-13-06).
- `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` -- The companion-extension load probe (`pi-subagents` + `pi-mcp-adapter`). D-13-07's per-row soft-dep predicate consumes this from the renderer.
- `extensions/pi-claude-marketplace/orchestrators/plugin/{install,uninstall,update,reinstall,bootstrap,list}.ts` -- Plugin orchestrator callsites; sub-waves 2a / 2b / 2d migrate.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/{add,remove,update,autoupdate,list}.ts` -- Marketplace orchestrator callsites; sub-wave 2c migrates.
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` -- Import cascade; sub-wave 2a migrates.

### Existing Test Files Phase 13 Touches

- `tests/architecture/markers-snapshot.test.ts` -- Untouched during Wave 2 (the snapshot still asserts the 5 legacy strings); Wave 3 atomic commit deletes the relevant snapshot rows in the same commit it deletes the marker exports.
- `tests/architecture/grammar-frontmatter.test.ts` -- Already in place from Phase 12 (D-CMC-04). Asserts `STATUS_TOKENS` + `REASONS` set-equality against the YAML frontmatter; Phase 13 does not touch it (Phase 14 may extend it to cover `markers:` and `pattern_classes:`).
- **NEW: `tests/architecture/no-legacy-markers.test.ts`** (or planner-chosen name) -- D-13-12 static-audit test; greps the codebase for the 5 legacy strings in non-test files outside `shared/markers.ts`. Lands in Wave 1 alongside the D-13-09 ESLint rule (initially green because no callsite has been migrated yet, becomes the cutover gate during Wave 3).
- **NEW: catalog UAT test(s)** -- Wave 3 plan #1's runner. Asserts each command's renderer output is byte-equal to the corresponding rendered example in `docs/output-catalog.md`. Planner decides exact location + shape per the "catalog UAT runner shape" Claude-discretion item above.

### ESLint Configuration

- `eslint.config.js` -- Wave 1 adds the `no-restricted-imports` rule from D-13-09 forbidding non-`markers.ts` / non-`markers-snapshot.test.ts` imports of the 5 legacy marker names. Wave 3 atomic commit deletes the rule entry alongside the marker exports.

### Reinstall Cascade Awareness

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` -- Sub-wave 2a migrates this. Note: the `reinstalled` partition kind is internal (already documented in Phase 12 CMC-08 reconciliation); Phase 13 renders the row as `(reinstalled)` via the closed status-token set.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`as const` + literal-union pattern** at `extensions/pi-claude-marketplace/presentation/plugin-list.ts:45` (`type PluginRenderStatus = "installed" | "available" | "uninstallable"`). Direct precedent for D-13-06's `RowSpec` discriminated union shape.
- **Private icon constants** at `presentation/plugin-list.ts:23-25` (`ICON_INSTALLED = "●"`, `ICON_AVAILABLE = "○"`, `ICON_UNINSTALLABLE = "⊘"`). Wave 1 moves these into `presentation/compact-line.ts` (the single grammar-aware renderer needs them for MSG-IC-1..3 cross-surface).
- **Column-66 description truncation** at `presentation/plugin-list.ts:30-40` (`MAX_LINE_COLUMN = 66`, `truncateColumn66`). Stays in `plugin-list.ts` (list-only per existing comment); not promoted to a shared helper.
- **D-11 / D-06 layering boundary** -- presentation/ does NOT import from persistence/; orchestrators own state-reads and pass payloads to presentation. D-13-07's renderer probe of `edge-deps.ts` is consistent (edge-deps is an orchestrator-layer concern; the renderer receives it as an injected dependency, not a persistence read).
- **Phase 12 `shared/grammar/{status-tokens,reasons}.ts`** -- already-landed closed sets; Phase 13's `RowSpec` types use `StatusToken` + `Reason` derived literal unions for the `status` and `reasons` fields.

### Established Patterns

- **D-07 single-callsite discipline for `ctx.ui.notify`:** Only `shared/notify.ts` calls `ctx.ui.notify`. Phase 13's composers return strings (or `{message, severity}`) that flow into the four wrappers; D-13-08 explicitly keeps the cascade-summary helper from calling `notify` directly.
- **One-concern-per-file in `presentation/`:** Phase 12 left presentation/ at `plugin-list`, `marketplace-list`, `reload-hint`, `soft-dep`. D-13-15 continues this pattern (one new file per new concern).
- **Wave-based parallelism + sub-wave serialisation** -- Phase 12's plan structure (Wave 1 primitives → Wave 2 callsites) is the precedent for D-13-01..D-13-04.
- **Static-audit test pattern in `tests/architecture/`** -- `import-boundaries.test.ts`, `no-orchestrator-network.test.ts`, `markers-snapshot.test.ts`, and the Phase 12 `grammar-frontmatter.test.ts` are the precedent for D-13-12's new no-legacy-markers test.
- **ESLint inline disable for IL-3** at `persistence/migrate.ts` -- precedent for narrow `no-restricted-imports` allow-list entries in D-13-09.

### Integration Points

- **~89 user-visible notify callsites across 12 orchestrator files** (grep against `notifySuccess|notifyWarning|notifyError|notifyUsageError` in `extensions/pi-claude-marketplace/orchestrators/`). Wave 2 sub-waves touch all of them.
- **`presentation/index.ts` barrel** is the public surface for `presentation/`; Wave 1 updates with the 6 new exports (compact-line + cascade-summary + manual-recovery + rollback-partial + cause-chain + sort).
- **`shared/markers.ts`** is the cutover surface; Wave 1 wires the import-forbidden ESLint rule; Wave 3 deletes the legacy exports.
- **`tests/architecture/`** is the standing home for cross-cutting architectural assertions; D-13-12's new test fits naturally.
- **`docs/messaging-style-guide.md` + `docs/output-catalog.md`** are the binding inputs; Wave 3 plan #1 (catalog UAT) reads `docs/output-catalog.md` rendered examples and asserts byte-equality.

</code_context>

<specifics>
## Specific Ideas

- **Layered slicing + group-by-shape sub-waves.** The Wave 1 / Wave 2 / Wave 3 structure (with Wave 2 sub-divided into cascades / single-plugin / marketplace / list) is the binding plan-decomposition contract. Wave 1 lands all cross-cutting primitives in one pass so Wave 2 sub-waves can consume an unchanging API.
- **ES-5 atomic commit is Wave 3 plan #2, gated by Wave 3 plan #1 (catalog UAT).** This pairing means the legacy markers are only deleted after every command's output has been verified byte-equal to the catalog. Pre-commit gating + atomic revert = a recoverable cutover.
- **`compareByNameThenScope` is THE sort.** Every per-scope surface uses this single helper (MSG-GR-3). The planner doesn't re-derive the sort policy per command.
- **No new wrappers, no new direct `ctx.ui.notify` callsites.** Phase 12's D-CMC-11..D-CMC-13 four-wrapper minimalism is reaffirmed by D-13-08; the `cascadeSummary` composer returns `{message, severity}` and orchestrators call the matching wrapper.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 14 frontmatter drift-guard suite (CMC-38).** Phase 13 produces a conforming codebase; Phase 14 locks it structurally by reading `status_tokens:` / `reasons:` / `markers:` / `pattern_classes:` from the style guide YAML and asserting MSG-* rule conformance across every callsite. The Phase 14 drift-guard is **complementary** to the Wave 3 catalog UAT plan in this phase -- catalog UAT verifies rendered output byte-equality; drift-guard verifies callsite token usage against the closed sets + MSG-* rules.
- **`hash-<12hex>` plugin-version abbreviation in list rendering.** Out of scope per `REQUIREMENTS.md` `Out of Scope` block; possible V1.4 enhancement.
- **Bulk uninstall cascade form** (`uninstall @<marketplace>` / bare `uninstall`). Out of scope per the output catalog's "Possible future features"; v1.3 keeps `uninstall` as single-plugin single-shot.
- **Marketplace versions** (`hash-<12hex>` for github-source marketplaces). Out of scope; would require state-schema migration.
- **Tone-changing rewordings** beyond the §14.1 console.warn (Phase 12) and the §15 ES-5 supersession (Phase 13). Style guide §15 scopes the supersession to exactly the 5 ES-5 marker strings; other operator wording stays.
- **Wider drift-guard surface (`markers:` and `pattern_classes:` frontmatter reads).** Phase 12 D-CMC-04 deferred this to Phase 14's broader drift-guard; Phase 13's static-audit test (D-13-12) covers only the 5 ES-5 legacy strings, not the wider `markers:` set.
- **`RELOAD_HINT_PREFIX` retention as snapshot-test-only export** (Phase 12 D-CMC-08) was the interim contract until Phase 13. The Wave 3 atomic commit (D-13-03) deletes both the export and the snapshot row alongside the other 4 legacy markers.

</deferred>

---

*Phase: 13-conformance-refactor-es-5-supersession*
*Context gathered: 2026-05-23*
