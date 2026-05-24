# Phase 14: Drift Guard & Test Alignment - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 14 is the **v1.3 milestone gate**. It locks the messaging contract structurally by:

1. Closing the two audit-flagged BLOCKER partials surfaced in `.planning/v1.3-MILESTONE-AUDIT.md` (CMC-16 manual-recovery orphan; CMC-34 six edge handlers using `notifyError` instead of `notifyUsageError`).
2. Refactoring the audit's WARNING-level finding at `transaction/rollback.ts:56-62` (hand-composed `(failed) {rollback partial}` literal) to flow through the renderer.
3. Deduping the audit's WARNING-level `MARKETPLACE_LABEL_PROBE` constant duplication into a single module.
4. Landing the CMC-38 drift-guard test suite: 34 custom MSG-* ESLint rules under `tests/lint-rules/` (one rule per MSG-* ID) + a shared frontmatter loader at `tests/lint-rules/lib/frontmatter.js` (using the `yaml` package) + frontmatter set-equality test extended to all 4 closed-set keys + a rule-registry parity test under `tests/architecture/`.

After this phase, the v1.3 milestone is complete: every CMC-01..38 requirement is `Complete` in REQUIREMENTS.md; `npm run check` enforces the user-contract structurally — no future commit can silently drift on closed-set tokens (status_tokens, reasons, markers, pattern_classes) or violate an MSG-* rule.

**In scope:**
- CMC-16 closure (orchestrators/plugin/reinstall.ts emission + orchestrators/marketplace/remove.ts dead-code seam cleanup)
- CMC-34 closure (6 edge handler migrations: edge/handlers/plugin/{list,reinstall,update,bootstrap}.ts + edge/handlers/marketplace/{list,autoupdate}.ts)
- transaction/rollback.ts emission refactor through the renderer (closes WARNING-level finding)
- MARKETPLACE_LABEL_PROBE dedup into a single constant module (closes WARNING-level finding)
- 34 MSG-* ESLint rules (1:1 with style-guide IDs) under tests/lint-rules/ as a local plugin
- Shared frontmatter loader using the `yaml` package; grammar-frontmatter.test.ts migrated + extended to status_tokens / reasons / markers / pattern_classes
- tests/architecture/msg-rule-registry.test.ts asserting rule-file ↔ MSG-* ID parity ↔ eslint.config.js registration
- Extension of npm test glob to include tests/lint-rules/ for per-rule RuleTester companion tests

**Out of scope:**
- New requirements beyond CMC-16 / CMC-34 / CMC-38 (the audit-flagged closures + the drift guard itself)
- v1.4 enhancements (markers: list expansion beyond the current 2 entries, pattern_classes: expansion)
- Telemetry or structured event channels (EVOL-02; deferred per IL-4)
- i18n / message catalogs (IL-1; deferred per the v1 boundary)
- Changes to the per-row soft-dep predicate semantics (CMC-13 closed by Phase 14.1; further changes risk regression)

**Cross-cutting constraints (carried forward — NOT re-discussed):**
- IL-2: All user-visible messages flow through the four `notify*` wrappers in `shared/notify.ts`
- IL-3: Single sanctioned `console.warn` at `persistence/migrate.ts` with inline ESLint disable
- D-30: `docs/messaging-style-guide.md` v1.0 + `docs/output-catalog.md` are the v1.3 user-contract
- NFR-6: `npm run check` (typecheck + ESLint + Prettier + tests) must stay green throughout every wave
- NFR-7: TypeScript strict; discriminated unions where ambiguity matters

</domain>

<decisions>
## Implementation Decisions

### Audit Gap Pre-Condition

- **D-14-01 [LOCKED]** Phase 14 absorbs CMC-16 + CMC-34 closure as scope alongside the CMC-38 drift guard. The audit's "Gap Closure Plan" (`.planning/v1.3-MILESTONE-AUDIT.md` lines 189-202) offered two paths — option (A) pre-phases like 14.1 vs. option (B) Phase 14 absorption — and this phase takes path (B). No 14.2 / 14.3 insertions. Rationale: the drift guard catches CMC-34 on landing (the MSG-NC-2 `\n\n` separator rule); pairing closure + structural guard in one phase produces one milestone-close commit instead of three sequential roadmap rows.

- **D-14-02 [LOCKED]** CMC-16 (renderManualRecovery orphan) closed by emitting `ManualRecoveryLine` from `orchestrators/plugin/reinstall.ts` when `ManualRecoveryError` propagates from a bridge stage (today the orchestrator at `reinstall.ts:498-548` reroutes the error into a `PluginCascadeRow{status:'failed', reasons:['rollback partial']}` cascade row — this loses the manual-recovery anchor's separate-top-level emission). The dead-code `void renderManualRecovery;` seam at `orchestrators/marketplace/remove.ts:73,91-96` is dropped or replaced with a real consumption. CMC-34 (six edge handlers route usage errors via `notifyError`) closed by migrating all six (`edge/handlers/plugin/{list.ts:40,57,65, reinstall.ts:34,44,52,86, update.ts:36,48,61, bootstrap.ts:37,42,48}` + `edge/handlers/marketplace/{list.ts:28, autoupdate.ts:37}`) to `notifyUsageError`. The audit's separately-requested router `\n\n` byte-exact test (Gap Closure Plan #4) is satisfied inside the drift guard's MSG-NC-2 / MSG-SR-7 rules — no separate edge-test addition needed.

- **D-14-03 [LOCKED]** Wave structure: **Wave 1 — CMC-16 closure** (reinstall.ts emission + marketplace/remove.ts seam cleanup); **Wave 2 — CMC-34 closure** (6 edge handler migrations; may parallelize Wave 1 since file sets don't overlap); **Wave 3 — CMC-38 drift-guard suite + WARNING-level closures** (34 MSG-* ESLint rules + frontmatter loader + registry test + transaction/rollback.ts refactor through the renderer + MARKETPLACE_LABEL_PROBE dedup). Each wave keeps `npm run check` green; the drift guard arrives last with nothing to find. Each wave independently revertable.

- **D-14-04 [LOCKED]** Drift guard covers `transaction/rollback.ts:56-62` (no allow-list). The hand-composed `(failed) {rollback partial}` literal is refactored to flow through `presentation/compact-line.ts`'s `renderRow` + `presentation/rollback-partial.ts`'s composer. Today's barrier was "the transaction layer has no plugin/scope/marketplace context"; the planner / researcher decides between (a) plumbing partial context into the transaction layer, or (b) accepting a partial-context renderer variant that omits the optional slots. Either path satisfies CMC-38 structurally; the MSG-RP-1 ESLint rule prevents recurrence.

- **D-14-05 [LOCKED]** Phase 14 plan dedupes the `MARKETPLACE_LABEL_PROBE` constant (currently duplicated across 3 files per the audit) into a single constant module — natural home is `extensions/pi-claude-marketplace/shared/grammar/` next to `status-tokens.ts` and `reasons.ts`, or `extensions/pi-claude-marketplace/shared/constants/` if `grammar/` is reserved for closed-set tokens; planner picks. Existing call sites import from the canonical location. Drift-guard rule (analog to no-legacy-markers) catches re-introductions.

### MSG-* Detection Technique Mix

- **D-14-06 [LOCKED]** Drift guard uses **custom ESLint rules** built on typescript-eslint AST. Rules run under the existing `npm run lint` step (already part of `npm run check`). Failure attribution: ESLint reports the specific source location with the MSG-* rule ID embedded in the rule name (e.g., `msg/msg-sr-7-usage-error-routing`). Tests/architecture/ adds two assertions: (a) frontmatter set-equality between the YAML closed sets and the in-code literal-union types; (b) rule-registry parity (every MSG-* ID has a corresponding rule file and registration). Rejected: pure regex/grep scan (can't differentiate `notifyError(ctx, msg)` from `notifyError(ctx, msg + '\n' + USAGE)` without AST shape); the precedent of test-suite-only architectural assertions (Phase 12 + 13) is intentionally expanded for Phase 14 since ESLint's AST + RuleTester infrastructure is strictly better-suited for callsite-level rule enforcement.

- **D-14-07 [LOCKED]** Custom rules live under `tests/lint-rules/` as a **local ESLint plugin module**, loaded via flat-config `plugins: { msg: ... }`. Each MSG-* rule is its own file (e.g., `tests/lint-rules/msg-sr-7-usage-error-routing.js`) with a docstring referencing the style-guide section it enforces. Files are individually testable via ESLint's built-in `RuleTester` API. Mirrors how `typescript-eslint` and `eslint-plugin-import-x` ship rules (ESM since eslint.config.js is ESM). Rules consume the closed sets via a shared memoized loader at `tests/lint-rules/lib/frontmatter.js` so SC #3 ("modifying frontmatter requires no changes to drift-guard test code") holds automatically.

- **D-14-08 [LOCKED]** Each MSG-* rule registered in `eslint.config.js` under the **narrowest `files:` pattern** it needs (e.g., `msg-sr-7` only on `extensions/pi-claude-marketplace/edge/handlers/**/*.ts`; `msg-lc-1` only on `extensions/pi-claude-marketplace/persistence/migrate.ts`; `msg-rh-1` on every file except `presentation/reload-hint.ts`). Rule-registry test asserts every rule's flat-config registration has a documented file scope. Minimizes false-positive surface; ESLint's native pattern model handles it.

- **D-14-09 [LOCKED]** **34 MSG-* ESLint rules (1:1 with style-guide rule IDs).** Rules whose semantic content is already structurally enforced (MSG-SD-3 by the `PluginCascadeRow` / `PluginInlineUninstalledRow` discrimination in `presentation/compact-line.ts`; MSG-GR-4 reasons-from-closed-enum by the `Reason` literal-union in `shared/grammar/reasons.ts`; MSG-PL-1..6 by `tests/architecture/catalog-uat.test.ts` byte-equality) become thin "structural meta-assertion" rules: they assert the structural mechanism exists (e.g., the RowSpec union has the expected discriminator and consumes the closed-set type) and cite the structural enforcement in metadata. Rules needing real lint coverage (MSG-MR-1..2, MSG-RP-1, MSG-CC-1, MSG-NC-1..2, MSG-SR-1..7, MSG-LC-1..2, MSG-RH-1, MSG-IC-1..3 outside-renderer emissions, MSG-GR-5 hand-composed marker slot) get full implementations. SC #2 (failure includes MSG-* rule ID) satisfied by rule-name embedding.

### YAML Parsing Strategy

- **D-14-10 [LOCKED]** Adopt the **`yaml` package** (already a transitive dep — verified at `node_modules/yaml/`) as a direct dev dep. Shared loader at `tests/lint-rules/lib/frontmatter.js` uses `yaml.parse()` on the frontmatter block (extract `^---\n(.*?)\n---\n` via regex first; pass the YAML body to `yaml.parse()` second). Exports the four closed-set arrays as named bindings: `STATUS_TOKENS_FRONTMATTER`, `REASONS_FRONTMATTER`, `MARKERS_FRONTMATTER`, `PATTERN_CLASSES_FRONTMATTER`. Memoize via module-scope cache so 34 rule files don't re-parse the file 34 times per lint run. `tests/architecture/grammar-frontmatter.test.ts` migrates from the hand-rolled `extractFrontmatterList` regex extractor (Phase 12 D-CMC-04) to the shared loader and extends from 2-key (`status_tokens`, `reasons`) set-equality to 4-key (adds `markers` and `pattern_classes`). The Phase 12 D-CMC-04 deferral ("Phase 14 owns the richer reader") is satisfied. Rejected: regex-only path (fragile to v1.4 YAML style changes — quoted strings, multi-line, comments would silently break); hybrid (two parse paths to maintain for no clear benefit).

- **D-14-10b [DERIVED]** In-code literal-union types in `extensions/pi-claude-marketplace/shared/grammar/` extend correspondingly: `STATUS_TOKENS` already exists (15 entries post Phase 13 D-13-20); `REASONS` already exists (28 entries); add `MARKERS` and `PATTERN_CLASSES` as `as const` literal-union arrays (new files `markers.ts` and `pattern-classes.ts`, OR added as named exports under existing `grammar/` files — planner picks). Set-equality test asserts in-code arrays equal frontmatter arrays for all four. Phase 12's D-CMC-04 invariant carries forward: the frontmatter is the binding contract; the in-code constants follow.

### Test File Structure + Planted-Violation Gate

- **D-14-11 [LOCKED]** Per-rule RuleTester companion tests **co-located under `tests/lint-rules/`** (`msg-sr-7-usage-error-routing.js` + `msg-sr-7-usage-error-routing.test.js`, or `.ts` if planner prefers and the local plugin format permits). Each test file uses ESLint's `RuleTester` API with `valid:` and `invalid:` fixture cases — invalid cases assert the specific error message that includes the MSG-* rule ID (satisfies SC #1 "intentional planted violation makes npm run check fail with clear, locatable error" structurally). The npm `test` script glob in `package.json:test` extends to include `tests/lint-rules/**/*.test.{js,ts}`. Plus a top-level `tests/architecture/msg-rule-registry.test.ts` that asserts: (a) every MSG-* ID found in `docs/messaging-style-guide.md` has a corresponding `tests/lint-rules/msg-*.js` rule file, (b) every rule file is registered in `eslint.config.js` under a documented `files:` pattern, (c) every rule's metadata cites the style-guide section it enforces. Provides the "no orphan rule / no missing rule" guard.

- **D-14-12 [LOCKED]** Registry test discovers the canonical MSG-* ID set by **scanning the style-guide body** — reads `docs/messaging-style-guide.md`, regex-extracts unique `MSG-[A-Z]+-[0-9]+` tokens (currently 34: MSG-GR-1..5, MSG-IC-1..3, MSG-SD-1..3, MSG-SR-1..7, MSG-MR-1..2, MSG-RP-1, MSG-CC-1, MSG-NC-1..2, MSG-ER-1, MSG-PL-1..6, MSG-RH-1, MSG-LC-1..2), and asserts each has a corresponding rule file. Linear-time extractor (~10 lines). No `msg_rule_ids:` frontmatter duplication; adding a new MSG-* in v1.4 only requires editing the style-guide body and adding the rule — no test-code changes (honors SC #3). Mirrors the no-legacy-markers.test.ts pattern of pinning by-form rather than by-list.

### Claude's Discretion

- **Wave 3 plan decomposition.** The wave gives Phase 14 a natural 3-wave decomposition (CMC-16 closure / CMC-34 closure / drift guard + WARNING closures). Inside Wave 3, the planner decides whether to land the frontmatter loader, the 34 rules, the registry test, the rollback.ts refactor, and the MARKETPLACE_LABEL_PROBE dedup as one plan, several plans, or per-rule plans. Plan-count estimate: 3-6 plans total. The wave structure (D-14-03) is binding; plan count inside each wave is at planner discretion.
- **Rule-file extension (.js vs .ts).** ESLint flat config is ESM JS today; rule files can be `.js` (matches plugin convention) or `.ts` (matches project's TS-strict posture — would require native TS strip on Node 22.18+, which is the project baseline). Planner picks; either is acceptable provided RuleTester works under `node --test`.
- **Grammar file layout for new closed sets.** D-14-10b leaves the choice of `markers.ts` / `pattern-classes.ts` new files vs. additions to existing `grammar/` files to the planner. Phase 12's D-CMC-01..D-CMC-05 set the precedent of one closed-set-per-file under `shared/grammar/`; consistency argues for two new files, but the small size (2 markers, 12 pattern classes) could also justify combining.
- **transaction/rollback.ts refactor approach (D-14-04).** Planner / researcher chooses between plumbing partial context into the transaction layer vs. accepting a partial-context renderer variant. Either satisfies CMC-38 + the WARNING-level audit closure; the trade-off is layering purity vs. renderer API surface.
- **MARKETPLACE_LABEL_PROBE constant location (D-14-05).** Planner picks between `shared/grammar/` (if treated as a closed-set token) and `shared/constants/` (if treated as a non-closed-set string constant). Either is fine; the dedup is the binding contract.
- **Memoization mechanism for the frontmatter loader.** D-14-10 specifies memoization but leaves the implementation (module-scope `Map` vs. lazy-init singleton vs. simple module-scope const) to the planner. Plain module-scope cache is the simplest valid approach.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Normative Style + Catalog Contract (THE binding inputs for v1.3)

- `docs/messaging-style-guide.md` v1.0 — Normative. Drift-guard binding contract. Phase 14 MUST read:
  - **Frontmatter** (lines 1-65) — the four closed sets (`status_tokens:` 15 entries, `reasons:` 28 entries, `markers:` 2 entries, `pattern_classes:` 12 entries) that the loader reads. Adding a key here requires zero rule-code changes (SC #3).
  - **§§ 1-15** — the 34 normative MSG-* rule IDs. Each rule's text governs the corresponding `tests/lint-rules/msg-*.js` rule implementation. Section ↔ rule mapping: §1 → MSG-GR-1..5; §2 → MSG-IC-1..3; §3 → status-token reference; §4 → reasons enum; §5 → MSG-RH-1; §6 → MSG-SD-1..3; §7 → MSG-MR-1..2; §8 → MSG-RP-1; §9 → MSG-CC-1; §10 → MSG-SR-1..7; §11 → MSG-PL-1..6; §12 → MSG-NC-1..2; §13 → MSG-ER-1; §14 + §14.1 → MSG-LC-1..2; §15 → ES-5 supersession table (already enforced by no-legacy-markers.test.ts).
- `docs/output-catalog.md` — Per-command rendered contract. Phase 14 does NOT touch (catalog-uat.test.ts is the consumer); drift-guard rules are complementary (callsite-level token usage + MSG-* conformance, not rendered output).

### Audit Source (drives Phase 14 scope)

- `.planning/v1.3-MILESTONE-AUDIT.md` — Audited 2026-05-24, `status: gaps_found`. Phase 14 closes the audit. Specifically:
  - **lines 19-25 (CMC-16 evidence)** — manual-recovery orphan; `orchestrators/plugin/reinstall.ts:498-548` reroutes ManualRecoveryError to a rollback-partial cascade row; `orchestrators/marketplace/remove.ts:73,91-96` dead-code import seam.
  - **lines 26-32 (CMC-34 evidence)** — 6 edge handler call sites listed by file:line; MSG-NC-2 `\n\n` separator violation; `tests/edge/router.test.ts:70-86` doesn't catch byte-shape.
  - **lines 33-39 (CMC-38 evidence)** — Phase 14 unsatisfied; partial CMCs above are exactly what the guard catches structurally.
  - **lines 62-66 (rollback.ts WARNING)** — `transaction/rollback.ts:56-62` hand-composed literal; "intentional, documented" today but structurally unprotected.
  - **lines 67-70 (MARKETPLACE_LABEL_PROBE WARNING)** — DRY drift risk across 3 files.
  - **lines 189-202 (Gap Closure Plan)** — explicit two-option sequencing the user resolved (D-14-01 takes path B: absorb into Phase 14).

### Phase Scope + Requirements

- `.planning/ROADMAP.md` §Phase 14 (lines 206-229) — Phase 14 success criteria #1..#5; SC #1 (planted-violation must fail with locatable error) → D-14-11; SC #2 (failure includes MSG-* rule ID) → D-14-09 rule-name embedding; SC #3 (frontmatter is sole source of truth; modifying it requires no test-code changes) → D-14-12 body-scan + D-14-10 loader; SC #4 (`npm run check` green after Phase 13 + Phase 14 land together) → D-14-03 wave order; SC #5 (every CMC-01..38 row Complete; v1.3 Coverage 38/38) → completion gate.
- `.planning/ROADMAP.md` §Progress (lines 233-244) — Execution order `12 → 13 → 14.1 → 14`; Phase 14 IS the milestone gate. Phase 14.1 already closed CMC-13.
- `.planning/REQUIREMENTS.md` line 380 (CMC-13 — already complete via Phase 14.1), line 389 (CMC-16 — marked Complete but audit flagged partial; D-14-02 closes), line 416 (CMC-34 — marked Complete but audit flagged partial; D-14-02 closes), line 426 (CMC-38 — Phase 14's primary requirement).

### Phase 12 Foundations (carry-forward decisions Phase 14 consumes)

- `.planning/phases/12-messaging-foundations-renderer-primitives/12-CONTEXT.md` — D-CMC-04 explicitly deferred the richer YAML reader (`markers:` + `pattern_classes:` + a shared helper) to Phase 14 (D-14-10 satisfies this); D-CMC-08 set the precedent of `as const` literal-union arrays for closed sets; D-CMC-11..D-CMC-13 four-wrapper minimalism in `shared/notify.ts` carries forward (no new wrapper introduced).
- `tests/architecture/grammar-frontmatter.test.ts` — Existing 98-line test with hand-rolled `extractFrontmatterList` regex. D-14-10 migrates this to the shared loader and extends from 2-key to 4-key. The test's `extractFrontmatterList throws` cases (lines 87-98) carry forward as loader-level error tests.

### Phase 13 Foundations (carry-forward decisions Phase 14 consumes)

- `.planning/phases/13-conformance-refactor-es-5-supersession/13-CONTEXT.md` — D-13-05..D-13-08 single grammar-aware renderer with `RowSpec` discriminated union (Phase 14's "structural meta-assertion" rules cite this enforcement); D-13-12 static-audit test pattern in `tests/architecture/` (precedent for `msg-rule-registry.test.ts`); D-13-20 `(reinstalled)` reconciliation explains the 15-entry status_tokens set.
- `tests/architecture/catalog-uat.test.ts` — 1712-line byte-equality runner. Complementary to drift guard: catalog UAT verifies rendered output; drift guard verifies callsite token usage + MSG-* conformance. Phase 14 does NOT touch.
- `tests/architecture/no-legacy-markers.test.ts` — 124-line static-audit pattern (recursive walk + regex match against literal pins + ALLOW_LIST). Precedent for several MSG-* ESLint rules (banned-pattern detection style); the test itself stays untouched (it's the CMC-35 lifetime gate).

### Phase 14.1 Closure (already landed)

- `.planning/phases/14.1-close-gap-cmc-13-propagate-declaresagents-mcp-through-import/14.1-CONTEXT.md` — Closed CMC-13 (audit BLOCKER on import surface). Phase 14 does NOT re-touch any CMC-13 callsite (D-13-13 from Phase 14.1 forbids touching adjacent CMC-13-compliant surfaces).

### V1 Architecture + Project Contract

- `docs/prd/pi-claude-marketplace-prd.md` §6.10 (module diagram + D-11 layering), §6.13 IL-2 (single output channel via `ctx.ui.notify`), §6.13 IL-3 (single sanctioned `console.warn` at `persistence/migrate.ts` — preserved through Phase 14; MSG-LC-1..2 enforce this).
- `.planning/PROJECT.md` Constraints block (lines 93-106) — NFR-6 (`npm run check` quality bar), NFR-7 (TS strict discriminated unions), IL-2 (single output channel), IL-3 (single sanctioned console.warn), D-30 (style guide + catalog ARE the v1.3 user-contract).

### Existing Source Files Phase 14 Touches

**CMC-16 closure (Wave 1):**
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:498-548` — Today's ManualRecoveryError → rollback-partial cascade-row rerouting; replace with `ManualRecoveryLine` emission via `presentation/manual-recovery.ts::renderManualRecovery`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:73,91-96` — Dead-code `void renderManualRecovery;` import seam; drop or replace with real consumption.
- `extensions/pi-claude-marketplace/presentation/manual-recovery.ts` — Existing composer; consumed (not modified) by the new emission paths.

**CMC-34 closure (Wave 2):**
- `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts:40,57,65` — Migrate to `notifyUsageError`.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts:34,44,52,86` — Migrate to `notifyUsageError`.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts:36,48,61` — Migrate to `notifyUsageError`.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts:37,42,48` — Migrate to `notifyUsageError`.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts:28` — Migrate to `notifyUsageError`.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts:37` — Migrate to `notifyUsageError`.
- `extensions/pi-claude-marketplace/shared/notify.ts` — `notifyUsageError` exists today; not modified.

**WARNING-level closures (Wave 3):**
- `extensions/pi-claude-marketplace/transaction/rollback.ts:56-62` — Refactor hand-composed `(failed) {rollback partial}` literal through the renderer (D-14-04).
- 3 files containing `MARKETPLACE_LABEL_PROBE` (planner identifies via grep) — Consolidate into a single constant module (D-14-05).

**Drift guard infrastructure (Wave 3):**
- `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts` — Existing 15-entry `STATUS_TOKENS` literal-union; no semantic change, possibly extended by D-14-10b's parity assertion if the loader adds typed exports.
- `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` — Existing 28-entry `REASONS` literal-union; same posture.
- `extensions/pi-claude-marketplace/shared/grammar/markers.ts` **(NEW or added to existing file)** — `MARKERS` literal-union: `["autoupdate", "no autoupdate"] as const` (matches frontmatter `markers:`).
- `extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts` **(NEW or added to existing file)** — `PATTERN_CLASSES` literal-union: 12 entries matching frontmatter `pattern_classes:`.
- `package.json` — Add `yaml` to `devDependencies` (already transitive); extend the `test` script glob to include `tests/lint-rules/**/*.test.{js,ts}`.
- `eslint.config.js` — Register the `msg` local plugin; turn on each of the 34 rules under a documented `files:` pattern.

### Existing Test Files Phase 14 Touches

- `tests/architecture/grammar-frontmatter.test.ts` — Migrate `extractFrontmatterList` regex extractor to import from `tests/lint-rules/lib/frontmatter.js`. Extend set-equality from 2 keys to 4 keys.

### NEW Files (Phase 14 creates)

- `tests/lint-rules/lib/frontmatter.js` — Shared memoized loader; uses `yaml.parse()`; exports the 4 closed-set arrays.
- `tests/lint-rules/lib/index.js` — Plugin entry point exporting all 34 rules + meta.
- `tests/lint-rules/msg-gr-{1..5}-*.js` — 5 rule files.
- `tests/lint-rules/msg-ic-{1..3}-*.js` — 3 rule files.
- `tests/lint-rules/msg-sd-{1..3}-*.js` — 3 rule files.
- `tests/lint-rules/msg-sr-{1..7}-*.js` — 7 rule files.
- `tests/lint-rules/msg-mr-{1..2}-*.js` — 2 rule files.
- `tests/lint-rules/msg-rp-1-*.js` — 1 rule file.
- `tests/lint-rules/msg-cc-1-*.js` — 1 rule file.
- `tests/lint-rules/msg-nc-{1..2}-*.js` — 2 rule files.
- `tests/lint-rules/msg-er-1-*.js` — 1 rule file.
- `tests/lint-rules/msg-pl-{1..6}-*.js` — 6 rule files (thin meta-assertion for catalog-uat coverage).
- `tests/lint-rules/msg-rh-1-*.js` — 1 rule file.
- `tests/lint-rules/msg-lc-{1..2}-*.js` — 2 rule files.
- `tests/lint-rules/msg-{rule}.test.{js,ts}` — Per-rule RuleTester companion tests (×34).
- `tests/architecture/msg-rule-registry.test.ts` — Registry parity test (scans style-guide body for MSG-* IDs; asserts file + config registration).
- Optionally `tests/architecture/markers-grammar-frontmatter.test.ts` and `tests/architecture/pattern-classes-grammar-frontmatter.test.ts` if grammar-frontmatter.test.ts is split per-key (planner picks; single-file extension also fine).

### ESLint + Tooling

- `eslint.config.js` (ESM flat config) — Wave 3 adds the local plugin import + 34 rule registrations with per-rule `files:` patterns. Phase 13's `no-restricted-imports` for legacy markers is already gone (Wave 3 atomic commit cleaned it up).
- `package.json` — `test` script extended; `yaml` promoted to direct dev dep.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`extractFrontmatterList` regex extractor** (`tests/architecture/grammar-frontmatter.test.ts:42-65`) — Hand-rolled, scoped to two keys. Pattern is sound; loader migration in D-14-10 replaces the regex body with `yaml.parse()` but preserves the "extract `^---\n.*\n---\n` block first" framing.
- **Recursive directory walk** (`tests/architecture/no-legacy-markers.test.ts:82-99` `walkTs` async generator) — Precedent for any custom rule that needs to scan multiple files (most MSG-* rules don't need this since ESLint already walks files for them).
- **`as const` literal-union pattern** (`extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts:44-62`, `.../reasons.ts:46-77`) — Direct model for new `MARKERS` and `PATTERN_CLASSES` arrays.
- **`presentation/compact-line.ts` RowSpec union + `renderRow`** — Already enforces several MSG-* rules structurally (MSG-GR-1, MSG-GR-2, MSG-GR-4, MSG-GR-5, MSG-SD-3, MSG-IC-1..3). Phase 14's meta-assertion rules cite this and assert the structural shape exists.
- **`presentation/manual-recovery.ts::renderManualRecovery`** — Existing composer, currently orphan in production. D-14-02 wires it into reinstall.ts; no composer changes.
- **`presentation/rollback-partial.ts`** — Existing composer; D-14-04 routes transaction/rollback.ts emission through it (or through `compact-line.ts::renderRow`).
- **`shared/notify.ts::notifyUsageError`** — Existing wrapper; D-14-02 migrates 6 edge handlers to consume it.

### Established Patterns

- **One closed-set-per-file under `shared/grammar/`** — Phase 12 D-CMC-01..D-CMC-05 precedent; D-14-10b extends.
- **Test-suite architectural assertions under `tests/architecture/`** — `grammar-frontmatter.test.ts`, `catalog-uat.test.ts`, `no-legacy-markers.test.ts`, `markers-snapshot.test.ts`, `import-boundaries.test.ts`, `manifest-read-seam.test.ts`, `no-shell-out.test.ts`, `no-telemetry-deps.test.ts`, `no-orchestrator-network.test.ts`, `reinstall-docs.test.ts`. `msg-rule-registry.test.ts` joins this family.
- **Wave-based plan decomposition** (Phase 12 D-CMC-01, Phase 13 D-13-01..D-13-04) — Phase 14 uses the same shape per D-14-03.
- **Layering: presentation/ does NOT import from persistence/; orchestrators own state-reads** — D-14-02's reinstall.ts emission of `ManualRecoveryLine` stays consistent (the orchestrator builds the line spec; the renderer renders).
- **ESLint flat config is ESM** (eslint.config.js, "type": "module") — Local plugin must be ESM-compatible.
- **Inline ESLint disable for IL-3** (`extensions/pi-claude-marketplace/persistence/migrate.ts:178`) — Precedent that MSG-LC-2 must accept this single inline disable as the IL-3 sanctioning mechanism.

### Integration Points

- **`npm run check` = typecheck + ESLint + Prettier + tests** — Phase 14's ESLint rules participate in the `lint` step; the registry test + frontmatter set-equality participate in the `test` step. Both run under `npm run check` so any drift fails the milestone gate.
- **`tests/lint-rules/` is NEW** — Currently outside the `package.json:test` glob; Phase 14 extends the glob to include `tests/lint-rules/**/*.test.{js,ts}`. The lint glob in `eslint.config.js` already covers the directory via the default `tests/` pattern; verify and tighten if needed.
- **typescript-eslint AST infrastructure** — Already a project dep (Phase 13's eslint setup). Local plugin reuses `@typescript-eslint/utils`'s `ESLintUtils.RuleCreator` for typed rule definitions.
- **`yaml` package** — Already at `node_modules/yaml/` as transitive (verified). Promote to direct devDependencies.
- **126 user-visible notify callsites across orchestrators/ + edge/** — Rule scope for the wrapper-routing rules (D-14-08 per-rule `files:` patterns).

</code_context>

<specifics>
## Specific Ideas

- **Audit-driven scope expansion is intentional and lockable.** Phase 14 is the milestone gate, so absorbing the audit's two BLOCKER closures + two WARNING closures into the same phase produces one cohesive milestone-close commit and avoids the 14.2/14.3 sprawl pattern. The CMC-38 drift guard then arrives last with nothing to find — the "no callsite-level drift on landing" property is the gate's reason for existing.
- **34 rules 1:1 with style-guide MSG-* IDs.** Granularity over consolidation. Failure attribution to a single MSG-* ID is the reviewer's mental model; consolidating rules into archetypes would force a translation layer per SC #2 (failure message must include MSG-* rule ID).
- **`yaml` package over hand-rolled regex.** D-CMC-04's "no yaml dep" posture from Phase 12 was a deferral, not a permanent decision. With four keys (vs two) and v1.4 mutation forward-compat in scope, `yaml.parse()` is the safer foundation. The 1-line `import { parse } from "yaml";` is worth the v1.4 robustness it buys.
- **Per-rule RuleTester is the planted-violation gate.** No new fixture-directory infrastructure needed — RuleTester's `invalid:` cases ARE the planted violations, and they execute under `npm run check` via the extended test glob. SC #1 is structurally satisfied.
- **Body-scan over frontmatter list for MSG-* IDs.** Avoids a dual-edit burden; the style-guide body is already the source of truth for the rules themselves. Adding a new MSG-* in v1.4 means editing one place (the body) and adding one rule file; no list synchronization.

</specifics>

<deferred>
## Deferred Ideas

- **v1.4 frontmatter additions** — adding a new reason, status token, marker, or pattern_class would happen post-v1.3. The drift guard's design (SC #3) accepts these without any test-code change; only callsites consuming the new value need code changes.
- **Future MSG-* rules** — adding a new MSG-* in v1.4 requires only (a) writing the rule in the style-guide body and (b) adding a `tests/lint-rules/msg-*.js` file + RuleTester companion. No registry-test edit.
- **Restructuring `tests/architecture/grammar-frontmatter.test.ts` into per-key files** — single-file extension (status_tokens + reasons + markers + pattern_classes parity in one file) is also fine; the planner picks. Per-key split would be a refactor for clarity, not a contract change.
- **Promoting `tests/lint-rules/` to a published `eslint-plugin-pi-claude-marketplace-msg` package** — out of scope; the local-plugin pattern is sufficient for project-internal use. Could happen post-v1.3 if other Pi extensions want to consume the rules.
- **`MARKETPLACE_LABEL_PROBE` rename or semantic tightening** — D-14-05 dedupes the constant but does not rename or change semantics; that would be a separate refactor.
- **Replacing `tests/architecture/no-legacy-markers.test.ts` with an ESLint rule** — the no-legacy-markers test is the CMC-35 lifetime gate; works fine as a test. Could become an ESLint rule for consistency with the MSG-* drift-guard suite, but no functional benefit; deferred.
- **Auto-generating in-code closed-set literal-unions from frontmatter at build time** — would eliminate the parity test, but breaks the "source code as the artifact" model. Parity test is the right approach.

</deferred>

---

*Phase: 14-drift-guard-test-alignment*
*Context gathered: 2026-05-24*
