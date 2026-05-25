# Roadmap: pi-claude-marketplace v1.3 Consistent Messaging

## Overview

Milestone v1.3 brings every user-visible `ctx.ui.notify` callsite (and the single sanctioned `console.warn`) into conformance with `docs/messaging-style-guide.md` v1.0 (normative, supersedes PRD §6.12 ES-5) and the per-command rendered contract in `docs/output-catalog.md`. No new commands, no new dependencies, no new domain logic -- this is an internal refactor whose user-contract change boundary is the ES-5 supersession (D-30).

The roadmap continues phase numbering from the completed v1.2 import milestone (last phase: 11). v1.3 begins at Phase 12. The work splits into three dependency-driven phases: first the renderer / notify primitives the conformance refactor will consume; then the mechanical callsite rewrite plus the atomic ES-5 supersession commit and per-command catalog conformance; finally a frontmatter-driven drift guard that locks the contract structurally.

**Cross-cutting constraints applied to every v1.3 phase:**

- NFR-6: `npm run check` (typecheck + ESLint + Prettier + tests) stays green throughout.
- IL-2 / IL-3: All user-visible messages go through `ctx.ui.notify` via the four sanctioned wrappers; the single sanctioned `console.warn` at `persistence/migrate.ts` stays inline-disabled at the call site (no config-file widening).
- D-30: The style guide + catalog are the v1.3 user-contract; PRD §6.12 ES-5 marker strings are superseded by the §15 replacement table.

## Phases

**Phase Numbering:** continued from previous milestone; v1.3 starts at Phase 12.

- [x] **Phase 8: Atomic Reinstall Core** (v1.1) -- Dedicated reinstall orchestrator and replacement-safe transaction primitives for one plugin
- [x] **Phase 9: Reinstall Edge & Bulk UX** (v1.1) -- `/claude:plugin reinstall` routing, batch forms, completions, docs, and user-facing output
- [x] **Phase 10: Claude Settings Import Foundation** (v1.2) -- Read/merge Claude settings, extract enabled plugin refs, map marketplace sources including official built-in marketplace
- [x] **Phase 11: Import Command Orchestration** (v1.2) -- `/claude:plugin import [--scope user|project]` handler, idempotent marketplace/plugin orchestration, warnings and reload-hint integration
- [x] **Phase 12: Messaging Foundations & Renderer Primitives** (v1.3) -- Closed-set constants, renderer/notify primitives, reload-hint composer collapse, sentence-form `console.warn` rewording: the scaffolding the conformance refactor will consume (completed 2026-05-22)
- [x] **Phase 13: Conformance Refactor & ES-5 Supersession** (v1.3) -- Mechanical rewrite of every user-visible callsite + ES-5 atomic three-file edit + per-command catalog conformance + display-semantics (per-scope rendering, plugin folding, adoption) (completed 2026-05-24)
- [x] **Phase 14: Drift Guard & Test Alignment** (v1.3) -- Frontmatter-driven drift test suite that reads the style guide as the binding contract; `npm run check` fails on out-of-set tokens or MSG-* violations (completed 2026-05-24)

Phases 1-7 belong to the v1.0 successor architecture and are documented in `PROJECT.md` under Validated requirements.

## Phase Details

### Phase 8: Atomic Reinstall Core

**Goal:** A single installed plugin can be reinstalled from the cached marketplace manifest without network access, while preserving the old install on any reinstall failure.

**Depends on:** v1.0 Phase 7 complete

**Requirements:** PRL-02, PRL-06, PRL-07, PRL-08, PRL-09, PRL-10, PRL-11, PRL-12

**Success Criteria** (what must be TRUE):

1. `reinstall <plugin>@<marketplace>` resolves only an already-installed plugin and returns `No plugins installed.` or an explicit not-installed outcome without mutating disk when the target is absent.
2. Reinstall reads the cached `marketplace.json` from state and never imports or invokes Git/network helpers; a test/architecture guard proves no `gitOps`, `DEFAULT_GIT_OPS`, `refreshGitHubClone`, or `platform/git` usage exists in the reinstall orchestrator.
3. Reinstall restages resources from the cached manifest but preserves the existing installed record version even when the manifest or plugin source now reports a different version.
4. If preflight, resource preparation, bridge replacement, or state save fails, the old `state.json`, generated skills/prompts/agents/MCP entries, agents index, and plugin data directory remain available.
5. Plugin data is deleted only after resource replacement and state commit both succeed; data cleanup failure emits a warning and does not turn the successful reinstall into failure.

**Plans:** 4 plans

Plans:

- [x] `08-01-PLAN.md` -- Lock-held manual-save transaction helper and no-network architecture guard
- [x] `08-02-PLAN.md` -- Backup-backed skills and commands replacement helpers
- [x] `08-03-PLAN.md` -- Backup-backed agents and MCP replacement helpers
- [x] `08-04-PLAN.md` -- Single-plugin atomic reinstall orchestrator core

### Phase 9: Reinstall Edge & Bulk UX

**Goal:** A Pi user can drive reinstall through `/claude:plugin` with update-analogous target forms, scope filtering, deterministic batch output, reload hints, soft-dependency warnings, and tab completion.

**Depends on:** Phase 8

**Requirements:** PRL-01, PRL-03, PRL-04, PRL-05, PRL-13, PRL-14, PRL-15, PRL-16

**Success Criteria** (what must be TRUE):

1. `/claude:plugin reinstall`, `/claude:plugin reinstall @<marketplace>`, and `/claude:plugin reinstall <plugin>@<marketplace>` route through the command surface with a clear `Usage:` block on empty/invalid forms.
2. `--scope user|project` is accepted at any argument position; bare reinstall enumerates the selected scope set, while marketplace/plugin targets resolve scope with the same ambiguity/not-found behavior as `update`.
3. Batch reinstall continues per plugin and reports deterministic `reinstalled` / `skipped` / `failed` partitions; one plugin failure does not corrupt or uninstall other plugins.
4. Successful reinstall emits the existing `refresh` reload hint only when generated resources changed and includes existing pi-subagents/pi-mcp-adapter soft-dependency warnings when relevant.
5. Tab completion surfaces `reinstall`, completes installed plugin refs, supports `@<marketplace>` form, includes trailing spaces, and preserves existing per-marketplace soft-fail and top-level state-error behavior.

**Plans:** 4 plans

Plans:

- [x] `09-01-PLAN.md` -- Bulk reinstall orchestrator, quiet seam, deterministic summary output
- [x] `09-02-PLAN.md` -- Reinstall edge handler, router, registration, --scope, and --force
- [x] `09-03-PLAN.md` -- Reinstall tab completion and failure semantics
- [x] `09-04-PLAN.md` -- README docs, static docs test, full validation, and traceability

### Phase 10: Claude Settings Import Foundation

**Goal:** A pure, testable import-planning foundation can read Claude Code settings for user/project scopes, merge base plus local override correctly, extract only true-enabled plugin refs, and resolve marketplace sources for official and extra-known marketplaces without mutating Pi state.

**Depends on:** Phase 7 and the separately-developed v1.1 milestone merge

**Requirements:** IMP-04, IMP-05, IMP-06, IMP-07, IMP-08

**Success Criteria** (what must be TRUE):

1. Settings discovery reads the correct files per scope: user Claude settings and project `.claude/settings*.json`; missing files are treated as empty while malformed JSON reports a warning/error through the import result path rather than crashing the process.
2. Merge semantics are deterministic: `settings.local.json` overrides `settings.json`, including disabling a base `enabledPlugins["plugin@marketplace"]: true` by setting the local value to `false`.
3. Enabled-plugin extraction returns only refs whose merged value is exactly boolean `true`; malformed keys and non-true values are ignored or warned according to import policy without blocking valid refs.
4. Marketplace source planning maps `claude-plugins-official` to `anthropics/claude-plugins-official` when missing, and maps `extraKnownMarketplaces` Claude `directory` and `github.repo` sources into existing Pi source parser inputs.
5. Unit tests cover both-scope duplication: if the same plugin/marketplace is enabled in user and project Claude settings, the import plan contains one action per matching Pi scope.

**Plans:** 3 plans

- [x] `10-01-PLAN.md` -- Settings file discovery and merge model for user/project scopes with local override tests (Wave 1)
- [x] `10-02-PLAN.md` -- Enabled-plugin ref extraction and malformed/non-true entry handling (Wave 1)
- [x] `10-03-PLAN.md` -- Marketplace source planning: official built-in mapping + extraKnownMarketplaces directory/github mapping (Wave 2)

### Phase 11: Import Command Orchestration

**Goal:** A Pi user can run `/claude:plugin import [--scope user|project]` and have enabled Claude Code plugins installed into the matching Pi scopes idempotently, with missing marketplaces added first and unavailable plugins reported as warnings while valid imports continue.

**Depends on:** Phase 10

**Requirements:** IMP-01, IMP-02, IMP-03, IMP-09, IMP-10, IMP-11

**Success Criteria** (what must be TRUE):

1. `/claude:plugin import` is routed and documented consistently with existing commands; `--scope` accepts only `user` and `project`, may appear at any position, and omitted scope processes both scopes.
2. Import adds missing marketplaces before installing enabled plugins, skips marketplaces/plugins already present in the target scope, and preserves same-name marketplace/plugin imports in both user and project scopes when both Claude scopes enable them.
3. Import reuses existing marketplace-add and plugin-install semantics so network access, state locking, atomic staging, soft-dependency warnings, and reload hints match the underlying operations.
4. Unavailable/uninstallable enabled plugins do not abort the whole import; they are aggregated and reported at warning severity with enough context to identify `plugin@marketplace` and target scope.
5. Integration tests exercise a mixed import: official GitHub marketplace, extra-known directory marketplace, extra-known GitHub marketplace, local override disabling a base plugin, already-installed skip, and unavailable-plugin warning.

**Plans:** 3 plans

- [x] `11-01-PLAN.md` -- Import orchestrator: action execution, idempotency, per-scope state locking, warning aggregation (Wave 1)
- [x] `11-02-PLAN.md` -- Edge handler/router/completion updates for `/claude:plugin import [--scope user|project]` (Wave 2)
- [x] `11-03-PLAN.md` -- End-to-end import fixtures and validation sign-off (Wave 3)

### Phase 12: Messaging Foundations & Renderer Primitives

**Goal:** Land the closed-set constants, renderer primitives, notify-helper signatures, single-trailer reload-hint composer, and the rewritten sanctioned `console.warn` wording -- everything the Phase 13 mechanical refactor depends on but that can land without breaking the user contract.

**Depends on:** Phase 11 (continues from the v1.2 close; baseline = green `main`).

**Requirements:** CMC-08, CMC-11, CMC-14, CMC-19, CMC-36, CMC-37

**Scope (what lands in this phase):**

- Closed status-token constants matching `status_tokens:` in the style-guide frontmatter (CMC-08), with the `(upgradable)` membership and the folded `(skipped) {up-to-date}` representation in place (the legacy `unchanged` partition shape is defined here but its callsite rewrite is Phase 13's mechanical work).
- Closed reasons enum constants matching `reasons:` in the style-guide frontmatter (CMC-11) -- all 23 reasons including the v1.3 additions (`{plugins remain}`, `{unparseable}`, `{unreadable manifest}`, `{not in manifest}`, `{not installed}`, `{invalid manifest}`, `{source mismatch}`, `{concurrently uninstalled}`, `{concurrently updated}`, `{stale clone}`, `{duplicate name}`, `{lock held}`) (frontmatter at `docs/messaging-style-guide.md` is the binding count; reconciled from 24 to 23 in Plan 12-01 per Phase 12 research §2.1).
- `presentation/reload-hint.ts` composer collapses to the single canonical trailer `/reload to pick up changes` -- `reloadHint(names) → names.length > 0 ? "/reload to pick up changes" : ""` (CMC-14). The three-verb (`load` / `refresh` / `drop`) selector is retired internally; the new composer is available for Phase 13's callsite migrations.
- Severity wrapper inventory affirms the four sanctioned wrappers (`notifySuccess`, `notifyWarning`, `notifyError`, `notifyUsageError`) and any signature evolution needed to carry the new compact-line / cascade / reload-hint payloads to Phase 13 callers (CMC-19). No `[error]` / `[warning]` prefix embedding -- structural severity preserved.
- `persistence/migrate.ts` sanctioned `console.warn` is rewritten to the §14.1 sentence-form wording (terminal period, no compact-grammar tokens, no `MANUAL RECOVERY REQUIRED:` prefix) (CMC-36).
- The IL-3 inline `eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: <rationale>` comment is preserved directly above the rewritten `console.warn(...)`; no config-file rule widening (CMC-37).

**Out of scope (deferred to Phase 13):**

- The `<marker>` slot rendering, the marketplace-header form, per-row soft-dep emission, the new manual-recovery / rollback-partial line structure, per-scope rendering + folding + adoption, and every per-command callsite rewrite. Phase 12 ships the primitives the renderer needs; the renderer's use sites are Phase 13.
- The ES-5 atomic three-file edit (`shared/markers.ts` + `tests/architecture/markers-snapshot.test.ts` + PRD §6.12) lands in Phase 13 per §15 supersession contract -- the snapshot test's prefix-extraction shape is structurally incompatible with the new tokenised forms, so the deferral is mandatory.

**Success Criteria** (what must be TRUE):

1. Importing the closed status-tokens module yields exactly the set in the style-guide frontmatter `status_tokens:` block; importing the reasons enum module yields exactly the 23 entries in `reasons:` (programmatic equality test against the YAML).
2. `reloadHint(names)` returns the literal `/reload to pick up changes` when at least one name is non-empty and the empty string otherwise; the three-verb selector is gone from `presentation/reload-hint.ts` (AST or `grep` audit against legacy `load|refresh|drop` selectors returns no match in the composer source).
3. The single sanctioned `console.warn` at `persistence/migrate.ts` emits the §14.1 sentence-form wording with terminal period and no compact-grammar tokens; the inline `eslint-disable-next-line -- IL-3` comment is present directly above the call.
4. `npm run check` is green: typecheck + ESLint + Prettier + the existing test suite all pass without regression. Phase 13's mechanical refactor has not yet started, so user-visible output is unchanged except for the single migrate.ts diagnostic.
5. No second `console.warn` callsite exists; ESLint `no-restricted-syntax` + `no-console` rules remain enforced at config level with no new exceptions.

**Plans:** 4/4 plans complete

Plans:

- [ ] `12-01-PLAN.md` -- Closed status-token + reasons constants under shared/grammar/ with frontmatter drift test; reconcile REQUIREMENTS.md CMC-08 (drop +reinstalled clause) and REQUIREMENTS/ROADMAP/CONTEXT 24-vs-23 reasons count (Wave 1)
- [ ] `12-02-PLAN.md` -- Reload-hint composer collapse to single canonical trailer; 8 callsite migrations across orchestrators; reload-hint test rewrite; D-CMC-10 carve-out narrative (Wave 2)
- [ ] `12-03-PLAN.md` -- persistence/migrate.ts:178 byte-exact §14.1 wording rewrite + IL-3 comment preservation + style guide §14.1 atomic doc edit (Wave 1)
- [ ] `12-04-PLAN.md` -- Notify wrapper inventory affirmation as docs comment in shared/notify.ts; D-CMC-11/13 (Wave 1)

### Phase 13: Conformance Refactor & ES-5 Supersession

**Goal:** Mechanically rewrite every user-visible `ctx.ui.notify` callsite (and the rendered output composers behind them) to conform to the universal compact-line grammar, plugin-row icon discipline, marketplace-icon outcome-class rule, closed status-token + reasons enums, per-scope marketplace and plugin rendering, autoupdate marker grammar, marketplace-header form on multi-plugin commands, per-row soft-dep emission, single canonical reload-hint, manual-recovery / rollback-partial / cause-chain formatting, cascade-severity routing, and per-command catalog conformance. Land the ES-5 atomic three-file edit. After this phase, every command in `docs/output-catalog.md` renders the documented output for each state it covers.

**Depends on:** Phase 12 (closed-set constants, reload-hint composer collapse, notify wrapper signatures, sanctioned `console.warn` wording).

**Requirements:** CMC-01, CMC-02, CMC-03, CMC-04, CMC-05, CMC-06, CMC-07, CMC-09, CMC-10, CMC-12, CMC-13, CMC-15, CMC-16, CMC-17, CMC-18, CMC-20, CMC-21, CMC-22, CMC-23, CMC-24, CMC-25, CMC-26, CMC-27, CMC-28, CMC-29, CMC-30, CMC-31, CMC-32, CMC-33, CMC-34, CMC-35

**Scope (logical groupings inside the phase -- exact plan decomposition is for `/gsd:plan-phase 13`):**

- *Universal line grammar + icons:* token-order rewrite (CMC-01), `@<marketplace>` carve-out on cascade rows (CMC-02), reasons rendering inside single `{}` block (CMC-04), `<autoupdate>` / `<no autoupdate>` marker slot rendering (CMC-05), plugin-row effective-state icon set (CMC-06), marketplace-row outcome-class icon (CMC-07).
- *Per-scope rendering, fold rule, and adoption (display semantics):* per-scope marketplace and plugin headers / rows with name-primary case-insensitive `localeCompare` sort and project-before-user tie-breaker (CMC-03); orphan plugin folding under user-scope marketplace headers + adoption when a project-scope marketplace is later added (CMC-21).
- *Status tokens at the callsite:* `(upgradable)` rendered only by `list`, never on install / update / uninstall / reinstall result rows (CMC-09); empty-result bare-token form `(no marketplaces)` / `(no plugins)` routed via `notifySuccess` (CMC-10).
- *Soft-dep markers (D-13 expansion):* `{requires pi-subagents}` / `{requires pi-mcp}` per-row emission on installed / updated / reinstalled rows, on `list`-rendering `(available)` / `(installed)` rows, and per-row inside `import` / `update` / `reinstall` cascades (CMC-12, CMC-13). Today's aggregated trailer goes away; `PluginListEntry` (or the orchestrator's pre-render payload) gains `declaresAgents` / `declaresMcp` predicates so the renderer can probe per-row.
- *Reload hint, manual recovery, rollback-partial, cause chain:* reload hint coexists with the partial-failure recovery anchor (CMC-15); manual recovery emits as a separate top-level compact line with system-level resource name discipline (CMC-16); rollback-partial uses the `(failed) {rollback partial}` parent + indented per-phase children form (CMC-17); cause chains render as `cause: <link1> -> <link2> -> ...` bounded to depth 5 with `(truncated)` suffix (CMC-18).
- *Severity routing:* cascade summaries route via `notifyWarning` when any row is non-trivially `(skipped)` or `(failed)`, via `notifySuccess` when every row is trivially-successful or trivially-`(skipped) {up-to-date}`, never via `notifyError` (CMC-20).
- *Per-command conformance against the catalog:* `list` (CMC-22), single-plugin `install` (CMC-23), single-plugin `uninstall` (CMC-24), `reinstall` cascade (CMC-25), `update` cascade (CMC-26), `import` cascade (CMC-27), `bootstrap` (CMC-28), `marketplace list` (CMC-29), `marketplace add` (CMC-30), `marketplace remove` conditional form (CMC-31), `marketplace update` (CMC-32), `marketplace autoupdate enable|disable` (CMC-33), entity-shaped non-cascade errors as compact lines + sentence-form usage errors (CMC-34).
- *ES-5 atomic three-file edit:* `shared/markers.ts` + `tests/architecture/markers-snapshot.test.ts` + `docs/prd/pi-claude-marketplace-prd.md` §6.12 in a single commit (CMC-35) per the style-guide §15 supersession contract. The snapshot test's prefix-extraction shape is structurally incompatible with the new tokenised forms; this is why the edit is atomic.

**Success Criteria** (what must be TRUE):

1. Every command listed in `docs/output-catalog.md` produces output byte-identical to the catalog's rendered example for each of its rendered states (success, mixed, all-failed, all-unchanged, empty, usage error). Per-command UAT against catalog examples passes for: `list`, `install`, `uninstall`, `reinstall`, `update`, `import`, `bootstrap`, `marketplace list`, `marketplace add`, `marketplace remove`, `marketplace update`, `marketplace autoupdate enable|disable`.
2. The legacy ES-5 marker strings (`pi-subagents is not loaded; …`, `pi-mcp-adapter is not loaded; …`, `Run /reload to <verb> …`, `MANUAL RECOVERY REQUIRED: …`, `(rollback partial: [<phase>] <msg>; …)`) are gone from the codebase -- AST / `grep` audit returns zero matches in user-visible emission sites. The atomic three-file commit (`shared/markers.ts` + `tests/architecture/markers-snapshot.test.ts` + PRD §6.12) is present in git history as a single commit.
3. Per-row soft-dep markers (`{requires pi-subagents}` / `{requires pi-mcp}`) fire correctly: emitted on installed / updated / reinstalled rows and on `list` `(available)` / `(installed)` rows when the predicate holds; absent from `(uninstalled)` rows; never aggregated into a single trailing sentence (the legacy aggregated emission is gone).
4. Per-scope rendering works end-to-end: a marketplace that exists in both scopes renders as two separate headers (one per scope, each with its own marker / status / reasons); the plugin-list orphan fold rule and the marketplace-add adoption behavior round-trip correctly (orphan plugins fold under user-scope, get adopted when a project-scope marketplace is later added).
5. Cascade severity routes per MSG-SR-4..6: an all-trivial cascade uses `notifySuccess`; a cascade with any non-trivial `(skipped)` or `(failed)` row uses `notifyWarning`; no cascade summary uses `notifyError`. The reload-hint trailer fires exactly once per body when any resource changed; omitted on all-failed cascades and bare manifest-only refreshes; coexists with the recovery anchor (reload above retry, blank line between) on partial-failure remove surfaces.

**Plans:** 10/10 plans complete

Plans:

- [ ] `13-01-01-PLAN.md` -- Wave 1 keystone: RowSpec discriminated union + compact-line renderer + sort helper + STATUS_TOKENS extension to 15 entries (reinstalled per D-13-20) + presentation/index.ts barrel update + unit tests
- [ ] `13-01-02-PLAN.md` -- Wave 1 composers: cause-chain depth-5 walker + cascade-summary + manual-recovery + rollback-partial + reload-hint MSG-RH-1 blank-line fix + notifyError body rewrite + formatErrorWithCauses deletion + caller migration
- [ ] `13-01-03-PLAN.md` -- Wave 1 cutover gates: ESLint no-restricted-imports for the 5 legacy markers (D-13-09) + tests/architecture/no-legacy-markers.test.ts static-audit (D-13-12) + presentation/soft-dep.ts thinning
- [ ] `13-02a-01-PLAN.md` -- Wave 2 sub-wave 2a (cascades): reinstall + update + import migration to cascadeSummary + PluginCascadeRow + per-row soft-dep + rollback-partial (CMC-25/26/27)
- [ ] `13-02a-02-PLAN.md` -- Wave 2 sub-wave 2a continuation (manual-recovery + rollback-partial callsite migration): migrate the 6 remaining legacy ES-5 marker emission sites (4 manual-recovery: `bridges/skills/stage.ts`, `bridges/commands/stage.ts`, `bridges/agents/stage.ts`, `orchestrators/plugin/reinstall.ts::errorWithManualRecovery` helper; 2 rollback-partial: `transaction/rollback.ts::formatRollbackError` D-03 chokepoint + `tests/transaction/rollback.test.ts` D-03 contract tests) onto the Wave 1 composers (`renderManualRecovery`, `renderRollbackPartial`) and retire the `MANUAL_RECOVERY_REQUIRED` / `ROLLBACK_PARTIAL` marker imports at every callsite; unblocks 13-03-02 ES-5 atomic commit (CMC-16/CMC-17 mop-up)
- [ ] `13-02b-01-PLAN.md` -- Wave 2 sub-wave 2b (single-plugin): install + uninstall + bootstrap migration to PluginInlineRow + PluginInlineUninstalledRow + edge handler entity errors (CMC-23/24/28)
- [ ] `13-02c-01-PLAN.md` -- Wave 2 sub-wave 2c (marketplace): list + add + remove + update + autoupdate migration + marketplace-list renderer rewrite + edge handler entity errors + platform/pi-api.ts trailer-helper deletion (CMC-29..34)
- [ ] `13-02d-01-PLAN.md` -- Wave 2 sub-wave 2d (list): orchestrators/plugin/list.ts orphan-fold computation + presentation/plugin-list.ts rewrite + fold-adoption integration test (CMC-22, CMC-21)
- [ ] `13-03-01-PLAN.md` -- Wave 3 plan #1 (catalog UAT pre-cutover gate): docs/output-catalog.md HTML-comment discriminators + tests/architecture/catalog-uat.test.ts byte-equality runner (CMC-22..34 verification)
- [ ] `13-03-02-PLAN.md` -- Wave 3 plan #2 (ES-5 atomic commit): single git commit deleting 5 marker exports + 5 snapshot rows + rewriting PRD §6.12 + rolling back ESLint marker entries (CMC-35; milestone v1.3 user-contract boundary)

### Phase 14: Drift Guard & Test Alignment

**Goal:** Lock the contract by adding a test suite that reads the style-guide YAML frontmatter (`status_tokens:`, `reasons:`, `markers:`, `pattern_classes:`) plus the normative `MSG-*` IDs as the binding contract. `npm run check` fails when a callsite emits a token outside the closed sets or violates an MSG-* rule. After this phase, the milestone's user-contract is enforced structurally -- no future commit can silently drift.

**Depends on:** Phase 13 (every callsite must already conform; otherwise the drift guard would fail on landing).

**Requirements:** CMC-16, CMC-34, CMC-38

**Scope:**

- Drift-guard test suite under `tests/architecture/` (or equivalent) that READS the style-guide YAML frontmatter at test time -- NOT a duplicated list in the test code. The frontmatter is the binding contract; the test asserts conformance.
- Token-set assertions: every status token rendered anywhere in the codebase belongs to the frontmatter `status_tokens:` set; every reason belongs to `reasons:`; every marker belongs to `markers:`; every callsite's `pattern_class` (inventory-classified or AST-detected) belongs to `pattern_classes:`.
- MSG-* rule assertions: token order per MSG-GR-1; `@<marketplace>` carve-out per MSG-GR-2; per-scope rendering and flat-list (no group headers) per MSG-GR-3; reasons-block formatting per MSG-GR-4; marker slot position per MSG-GR-5; effective-state icon predicate per MSG-IC-1..3; severity routing per MSG-SR-1..7; reload-hint emission predicate per MSG-RH-1; soft-dep predicate per MSG-SD-1..3; manual-recovery and rollback-partial formatting per MSG-MR-1..2 and MSG-RP-1; cause-chain trailer per MSG-CC-1; non-cascade vs usage error split per MSG-NC-1..2; empty-result bare token per MSG-ER-1; sanctioned `console.warn` discipline per MSG-LC-1..2.
- Drift-guard suite is `npm run check`-gated: a failing assertion fails the check, blocking merge.
- Audit-driven absorbed scope (per D-14-01..D-14-05): closes CMC-16 BLOCKER (manual-recovery orphan in reinstall.ts), CMC-34 BLOCKER (6 edge handlers using notifyError + USAGE instead of notifyUsageError), the WARNING-level transaction/rollback.ts hand-composed literal, and the WARNING-level MARKETPLACE_LABEL_PROBE triplication.

**Success Criteria** (what must be TRUE):

1. The drift-guard suite parses `docs/messaging-style-guide.md` YAML frontmatter at test time and asserts every closed-set token used by any callsite is a member of the corresponding frontmatter list. An intentional planted violation (in a test fixture or a removed-then-restored callsite) makes `npm run check` fail with a clear, locatable error.
2. Each normative MSG-* ID has at least one assertion in the suite that, if violated, fails the test with the rule ID in the failure message (`MSG-GR-1`, `MSG-IC-3`, `MSG-SR-5`, etc.). A reviewer can map a failure back to the style-guide rule without code archaeology.
3. The frontmatter is the SOLE source of truth for the closed sets; no test file duplicates the lists. Modifying the frontmatter (e.g. adding a reason in a future v1.4) requires no changes to the drift-guard test code -- only callsites consuming the new value need code changes, and the guard automatically accepts the new value.
4. `npm run check` is green after Phase 13 + Phase 14 land together: typecheck + ESLint + Prettier + the existing test suite + the new drift-guard suite all pass on the v1.3 milestone close commit.
5. The milestone is complete: every CMC-01..38 requirement has its traceability row marked `Complete` (Phase 12 / Phase 13 / Phase 14 as appropriate); the v1.3 line in REQUIREMENTS.md Coverage block shows 38/38 mapped and complete.

**Plans:** 6/6 plans complete

Plans:

**Wave 1**
- [ ] `14-01-cmc-16-closure-PLAN.md` -- CMC-16 closure: wire renderManualRecovery into reinstall.ts emission; drop dead-code `void renderManualRecovery;` seam in remove.ts; reinstall.test.ts assertion (Wave 1)

**Wave 2** *(parallelizable with Wave 1 -- independent file sets)*
- [ ] `14-02-cmc-34-closure-PLAN.md` -- CMC-34 closure: migrate 13 callsites across 6 edge handler files from notifyError to notifyUsageError; router byte-shape test audit (Wave 2)

**Wave 3** *(depends on Wave 1 + Wave 2)*
- [ ] `14-03-drift-guard-infrastructure-PLAN.md` -- Wave 3a: rule-tester + yaml devDep installs; tests/lint-rules/ scaffold (loader + plugin shell); shared/grammar/{markers,pattern-classes}.ts; shared/constants/marketplace-label-probe.ts dedup; grammar-frontmatter.test.ts 2→4-key extension (Wave 3)
- [ ] `14-04-meta-assertion-rules-PLAN.md` -- Wave 3b: 16-19 meta-assertion MSG-* rules (MSG-GR-1..5 / MSG-IC-1..3 / MSG-SD-3 / MSG-PL-1..6 / MSG-ER-1) + RuleTester companions citing structural enforcement (Wave 3, depends on 14-03)
- [ ] `14-05-full-impl-rules-and-registry-PLAN.md` -- Wave 3c: 15-18 full-impl MSG-* rules with real AST visitors (MSG-SR-1..7 / MSG-MR-1..2 / MSG-RP-1 / MSG-CC-1 / MSG-NC-1..2 / MSG-RH-1 / MSG-LC-1..2 / MSG-SD-1..2) + RuleTester planted-violation tests + msg-rule-registry.test.ts (Wave 3, depends on 14-03)
- [ ] `14-06-warning-closures-and-eslint-wiring-PLAN.md` -- Wave 3d: transaction/rollback.ts orchestrator-owns-rendering refactor (D-14-04 + Pitfall 6); wire 34 MSG-* rules into eslint.config.js with per-rule files: + composer-file ignores; v1.3 milestone-close commit (Wave 3, depends on 14-04 + 14-05)

## Progress

**Execution Order:** 8 → 9 (v1.1 milestone); 10 → 11 (v1.2 milestone); 12 → 13 → 14.1 → 14 (v1.3 milestone -- 14.1 is an audit-driven gap-closure phase, sequenced before Phase 14 so the drift guard doesn't fail on the CMC-13 partial). v1.0 executed 1 → 2 → 3 → 4 → 5 → 6 → 7.

| Phase                                        | Goal                                                                              | Requirements                                                                                                                                              | Plans      | Status      | Completed  |
| -------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- | ---------- |
| 8. Atomic Reinstall Core                     | Atomic single-plugin reinstall with preserve-old-on-failure semantics             | PRL-02, PRL-06, PRL-07, PRL-08, PRL-09, PRL-10, PRL-11, PRL-12                                                                                            | 4/4 plans  | Complete    | 2026-05-14 |
| 9. Reinstall Edge & Bulk UX                  | Command routing, batch forms, scope, completion, output, docs                     | PRL-01, PRL-03, PRL-04, PRL-05, PRL-13, PRL-14, PRL-15, PRL-16                                                                                            | 4/4 plans  | Complete    | 2026-05-14 |
| 10. Claude Settings Import Foundation (v1.2) | Pure import-planning foundation                                                   | IMP-04..IMP-08                                                                                                                                            | 3/3 plans  | Complete    | 2026-05-14 |
| 11. Import Command Orchestration (v1.2)      | `/claude:plugin import` command                                                   | IMP-01..IMP-03, IMP-09..IMP-11                                                                                                                            | 3/3 plans  | Complete    | 2026-05-14 |
| 12. Messaging Foundations (v1.3)             | Closed-set constants, renderer/notify primitives, reload-hint collapse            | CMC-08, CMC-11, CMC-14, CMC-19, CMC-36, CMC-37                                                                                                            | 0/4 plans  | Not started | --         |
| 13. Conformance Refactor & ES-5 (v1.3)       | Mechanical callsite rewrite + ES-5 atomic edit + per-command catalog conformance  | CMC-01..07, CMC-09, CMC-10, CMC-12, CMC-13, CMC-15..18, CMC-20, CMC-21, CMC-22..34, CMC-35                                                                | 0/9 plans  | Not started | --         |
| 14. Drift Guard & Test Alignment (v1.3)      | Frontmatter-driven drift test suite + CMC-16/CMC-34 audit-absorbed closures       | CMC-16, CMC-34, CMC-38                                                                                                                                    | 0/6 plans  | Planned     | --         |
| 14.1. Close gap: CMC-13 import propagation   | Close v1.3 audit BLOCKER on `/claude:plugin import` cascade soft-dep markers       | CMC-13                                                                                                                                                    | 2/2 plans  | Complete    | 2026-05-24 |

## Coverage (v1.3)

| Requirement | Phase    | Status  |
| ----------- | -------- | ------- |
| CMC-01      | Phase 13 | Complete |
| CMC-02      | Phase 13 | Complete |
| CMC-03      | Phase 13 | Complete |
| CMC-04      | Phase 13 | Complete |
| CMC-05      | Phase 13 | Complete |
| CMC-06      | Phase 13 | Complete |
| CMC-07      | Phase 13 | Complete |
| CMC-08      | Phase 12 | Pending |
| CMC-09      | Phase 13 | Complete |
| CMC-10      | Phase 13 | Complete |
| CMC-11      | Phase 12 | Pending |
| CMC-12      | Phase 13 | Complete |
| CMC-13      | Phase 13 | Complete |
| CMC-14      | Phase 12 | Pending |
| CMC-15      | Phase 13 | Complete |
| CMC-16      | Phase 14 | Complete |
| CMC-17      | Phase 13 | Complete |
| CMC-18      | Phase 13 | Complete |
| CMC-19      | Phase 12 | Pending |
| CMC-20      | Phase 13 | Complete |
| CMC-21      | Phase 13 | Complete |
| CMC-22      | Phase 13 | Complete |
| CMC-23      | Phase 13 | Complete |
| CMC-24      | Phase 13 | Complete |
| CMC-25      | Phase 13 | Complete |
| CMC-26      | Phase 13 | Complete |
| CMC-27      | Phase 13 | Complete |
| CMC-28      | Phase 13 | Complete |
| CMC-29      | Phase 13 | Complete |
| CMC-30      | Phase 13 | Complete |
| CMC-31      | Phase 13 | Complete |
| CMC-32      | Phase 13 | Complete |
| CMC-33      | Phase 13 | Complete |
| CMC-34      | Phase 14 | Complete |
| CMC-35      | Phase 13 | Complete |
| CMC-36      | Phase 12 | Pending |
| CMC-37      | Phase 12 | Pending |
| CMC-38      | Phase 14 | Complete |

**Coverage:**

- v1.3 requirements: 38 total (CMC-01..38)
- Mapped to phases: 38 (100%)
- Unmapped: 0 ✓
- Orphans: 0
- Duplicates: 0

**Per-phase distribution (v1.3):**

| Phase | REQ-IDs                                                                                                                                                                                                                            | Count |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 12    | CMC-08, CMC-11, CMC-14, CMC-19, CMC-36, CMC-37                                                                                                                                                                                     | 6     |
| 13    | CMC-01, CMC-02, CMC-03, CMC-04, CMC-05, CMC-06, CMC-07, CMC-09, CMC-10, CMC-12, CMC-13, CMC-15, CMC-17, CMC-18, CMC-20, CMC-21, CMC-22, CMC-23, CMC-24, CMC-25, CMC-26, CMC-27, CMC-28, CMC-29, CMC-30, CMC-31, CMC-32, CMC-33, CMC-35 | 29    |
| 14    | CMC-16, CMC-34, CMC-38                                                                                                                                                                                                             | 3     |

## Phase Sequencing Rationale (v1.3)

The style guide's §19 cross-references name two consumer phases by intent: a conformance refactor that consumes the guide as the input contract, and a drift-guard suite that consumes the guide's YAML frontmatter as the binding contract. A foundation phase precedes the conformance refactor because the renderer plumbing it consumes is non-trivial: the `<marker>` slot rendering, the per-row soft-dep predicate (requiring `PluginListEntry` to gain `declaresAgents` / `declaresMcp` fields), the `cascadeSummary({ marketplace, scope, rows })` API shape, and the single-canonical reload-hint composer collapse are all primitives that must exist before any callsite can adopt them. CMC-08 (status-token closed set) and CMC-11 (reasons closed set) also belong here because they define what the closed-set tokens *are* before Phase 13's mechanical rewrite consumes them.

The ES-5 atomic three-file edit (CMC-35) lives in Phase 13 per the style-guide §15 supersession contract -- the `tests/architecture/markers-snapshot.test.ts` prefix-extraction shape is structurally incompatible with the new tokenised forms, so the snapshot, the markers source, and the PRD §6.12 row must change in one commit. Splitting that edit across phases would necessarily fail `npm run check` mid-phase.

The display-semantics changes (CMC-21: per-scope marketplaces and plugins, plugin folding, adoption at marketplace-add time) live in Phase 13 because they are callsite-level changes -- the renderer reads per-scope state and folds orphan plugins under user-scope headers; the marketplace-add orchestrator's adoption behavior is a state-mutation change driven by the same per-scope rendering contract. Both are consumed by the same callsite rewrite pass.

The drift-guard suite (CMC-38) lands LAST because it asserts conformance for every callsite; running it before Phase 13's mechanical refactor completes would fail on every still-legacy callsite. Phase 14 is the milestone gate: when Phase 14 lands green, the user-contract is enforced structurally and no future commit can silently drift.

## Stable User-Contract Boundary (v1.3)

D-30 locks the style guide + catalog as the v1.3 user-contract. The ES-5 supersession (the five marker strings in PRD §6.12 ES-5) is the ONLY user-contract change in this milestone -- everything else is an internal refactor that preserves observable lifecycle / scope / reload-hint / soft-dep / retry-safety contracts but normalizes how each surface renders. Phase 13's atomic three-file commit (CMC-35) is the boundary.

## Research Notes

- v1.3 has no separate research artifact. The style guide (`docs/messaging-style-guide.md` v1.0) and the per-command output catalog (`docs/output-catalog.md`) ARE the input contract. Phase 12 reads them as scaffolding requirements; Phase 13 reads them as the conformance target; Phase 14 reads the style guide's YAML frontmatter as the binding drift-guard contract.
- Phase 8 should receive deeper design attention during planning for bridge backup/restore details and rollback-failure/manual-recovery semantics. (Historical note; Phase 8 complete.)
- Phase 9 follows existing update/router/completion patterns and should not need external research unless Phase 8 changes the result model. (Historical note; Phase 9 complete.)

______________________________________________________________________

*Roadmap created: 2026-05-13 for milestone v1.1 Reinstall Command*
*Last updated: 2026-05-14 after Phase 8 completion*
*Last updated: 2026-05-14 after Phase 9 completion*
*Last updated: 2026-05-16 after merge from main brought in v1.2 phases 10 & 11.*
*Last updated: 2026-05-22 -- v1.3 Consistent Messaging milestone added: Phases 12 (Foundations), 13 (Conformance Refactor & ES-5), 14 (Drift Guard). 38/38 CMC requirements mapped (100% coverage). Continued phase numbering from 11; no reset.*
*Last updated: 2026-05-23 -- Phase 13 expanded to 10 plans (Wave 2 sub-wave 2a continuation `13-02a-02` inserted between `13-02a-01` and `13-02b-01`): migrate the 6 remaining legacy ES-5 marker emission sites (4 manual-recovery + 2 rollback-partial) onto the Wave 1 composers; unblocks 13-03-02 ES-5 atomic commit.*

### Phase 14.2: Address tech debt: CR-01 + retroactive Phase 12 / 14.1 gates (INSERTED)

**Goal:** Close v1.3 milestone tech debt so `/gsd:complete-milestone v1.3` archives cleanly with zero outstanding gates: replace 3 local user-first `scopeOrder` helpers with canonical `compareByNameThenScope` (CR-01, affecting CMC-03/25/26/27); tighten the MSG-GR-3 lint rule from no-op to active AST detector; run retroactive `/gsd:secure-phase` + `/gsd:validate-phase` against Phase 12 (existing draft VALIDATION.md) and Phase 14.1 (no prior artefacts); flip 29 Phase-13 CMC checkboxes in ROADMAP.md Coverage and update the 14.1 Phase Details row.
**Requirements**: CMC-03, CMC-25, CMC-26, CMC-27 (observably-affected v1.3 requirements per CR-01; gate-running plans address no new requirements)
**Depends on:** Phase 14
**Plans:** 5/5 plans complete

Plans:
- [ ] `14.2-01-PLAN.md` -- CR-01 cascade-block-ordering fix: replace 3 local `scopeOrder` helpers with `compareByNameThenScope`; flip `autoupdate.ts:114` iteration order; extend `catalog-uat.test.ts` cross-scope fixture; update 3 orchestrator unit-test cross-scope fixtures (Wave 1)
- [ ] `14.2-02-PLAN.md` -- MSG-GR-3 lint rule tightening: rewrite `tests/lint-rules/msg-gr-3-per-scope.js` from no-op to active two-axis AST detector; move to orchestrator-scoped ESLint block; PROJECT.md D-14-2-08 supersession entry (Wave 1, depends on 14.2-01)
- [ ] `14.2-03-PLAN.md` -- Phase 12 retroactive gates: `/gsd:secure-phase 12` + `/gsd:validate-phase 12` (existing draft to validated) (Wave 2)
- [ ] `14.2-04-PLAN.md` -- Phase 14.1 retroactive gates: `/gsd:secure-phase 14.1` + `/gsd:validate-phase 14.1` (fresh artefacts) (Wave 2)
- [ ] `14.2-05-PLAN.md` -- ROADMAP cosmetic drift: flip 29 Phase-13 CMC checkboxes in Coverage table; update 14.1 Phase Details row; SUMMARY.md investigation note on GSD-plugin auto-flip gap (Wave 3)

### Phase 14.1: Close gap: CMC-13 -- propagate declaresAgents/Mcp through import cascade rows (INSERTED)

**Goal:** Propagate `declaresAgents` / `declaresMcp` predicates from the install
path through the import-orchestrator cascade rows so per-row
`{requires pi-subagents}` / `{requires pi-mcp}` soft-dep markers fire on
`/claude:plugin import`. Replaces the hard-coded
`declaresAgents=false`/`declaresMcp=false` literals at
`extensions/pi-claude-marketplace/orchestrators/import/execute.ts:474-475`
that the v1.3 milestone audit flagged as a BLOCKER integration-layer gap on
CMC-13. After this phase, CMC-13 moves from PARTIAL (per audit) to
SATISFIED on every cascade surface (install / reinstall / update / import).
**Requirements:** CMC-13
**Depends on:** Phase 13 (consumes the cascade-row schema and renderer wired
there); sequenced BEFORE Phase 14 so the drift-guard suite landing in
Phase 14 does not retroactively fail `npm run check` on the partial.
**Plans:** 2/2 plans complete

Plans:

**Wave 1**
- [x] 14.1-01-PLAN.md -- Plumbing: widen `InstallPluginOutcome.installed` and
  `PluginInstalledOutcome` with required `declaresAgents`/`declaresMcp`
  predicates, propagate through the case-`installed` switch arm, replace
  the hard-coded literals at `import/execute.ts:474-475`, widen the 12
  historical `installPlugin` test-doubles, add 4 predicate-coverage unit
  tests.

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 14.1-02-PLAN.md -- Catalog + UAT round-trip: add a
  `<!-- catalog-state: soft-dep-markers -->` fixture under
  `## /claude:plugin import` in `docs/output-catalog.md`, paired with the
  fixture function in `tests/architecture/catalog-uat.test.ts` using
  `cascadeSummary` + `PROBE_BOTH_UNLOADED` (no hand-composed literals).
  The byte-equal-pairing test proves the new wiring end-to-end.
