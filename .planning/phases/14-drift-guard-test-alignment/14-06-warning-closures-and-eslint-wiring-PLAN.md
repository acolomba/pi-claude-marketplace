---
phase: 14-drift-guard-test-alignment
plan: 06
type: execute
wave: 3
depends_on:
  - 14-04-meta-assertion-rules
  - 14-05-full-impl-rules-and-registry
files_modified:
  - extensions/pi-claude-marketplace/transaction/rollback.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/presentation/rollback-partial.ts
  - tests/transaction/rollback.test.ts
  - eslint.config.js
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
autonomous: true
requirements:
  - CMC-16
  - CMC-34
  - CMC-38

must_haves:
  truths:
    - "`transaction/rollback.ts::formatRollbackError` no longer composes the user-visible `(failed) {rollback partial}` body inline (the hand-composed literal at the original lines 56-62 is gone); rendering moves to calling orchestrators via `presentation/rollback-partial.ts` per RESEARCH.md §Pitfall 6 (orchestrator-owns-rendering)."
    - "Every orchestrator currently calling `formatRollbackError` is updated to consume the new structured return type (no presentation/ import added to transaction/; D-11 layering preserved)."
    - "All 34 MSG-* rules are registered in `eslint.config.js` under per-rule `files:` patterns + appropriate `ignores:` for canonical composer files (RESEARCH.md §Pitfall 9). Exactly 34 unique `\"msg/<name>\":` registrations exist; no slug appears in two blocks."
    - "The registry parity test's assertion (c) -- every rule name registered in eslint.config.js -- transitions from t.todo() (gated, Plan 05 commit) to ACTIVE+PASSING (Plan 06 commit); all 4 assertions of `tests/architecture/msg-rule-registry.test.ts` pass at the Plan 06 commit."
    - "`tests/transaction/rollback.test.ts` is updated to match the new `formatRollbackError` signature (the existing 4 tests that assert the hand-composed body shape get rewritten or replaced with tests asserting the new structured return)."
    - "MSG-RP-1 ESLint rule's planted-violation case still passes (Plan 05 wrote the rule; Plan 06's refactor removes the only existing violation site so the rule fires on planted-only -- no legitimate code triggers it)."
    - "REQUIREMENTS.md CMC-16, CMC-34, CMC-38 rows show Status=Complete with Phase 14 attribution (rows 745, 763, 767)."
    - "ROADMAP.md `## Progress` table Phase 14 row Status column = `Complete` with the actual completion date."
    - "ROADMAP.md `## Coverage (v1.3)` rows for CMC-16, CMC-34, CMC-38 show Status=Complete (lines 280, 298, 302)."
    - "`npm run check` is GREEN at the Plan 06 commit -- this is the v1.3 milestone close. SC #5 (38/38 v1.3 coverage) is satisfied IN-PHASE per Phase 14 ROADMAP SC #5."
  artifacts:
    - path: extensions/pi-claude-marketplace/transaction/rollback.ts
      provides: "Structured RollbackErrorResult return; no user-visible body composition; no presentation/ import"
      contains_not: "(failed) {rollback partial}"
    - path: eslint.config.js
      provides: "Per-rule files: patterns registering all 34 MSG-* rules + composer-file ignores"
      contains: 'msg/msg-sr-7'
    - path: .planning/REQUIREMENTS.md
      provides: "CMC-16/CMC-34/CMC-38 Coverage table rows updated to Status=Complete with Phase 14 attribution"
      contains: 'CMC-38      | Phase 14 | Complete'
    - path: .planning/ROADMAP.md
      provides: "Progress table Phase 14 row + Coverage table CMC-16/CMC-34/CMC-38 rows updated to Complete"
      contains: 'CMC-38      | Phase 14 | Complete'
  key_links:
    - from: "extensions/pi-claude-marketplace/orchestrators/plugin/{install,update,reinstall}.ts"
      to: extensions/pi-claude-marketplace/presentation/rollback-partial.ts
      via: "orchestrators consume the new RollbackErrorResult and compose the body via presentation/"
      pattern: "renderRollbackPartial\\(|formatRollbackError\\("
    - from: eslint.config.js
      to: tests/lint-rules/index.js
      via: "import msgPlugin + plugins: { msg: msgPlugin } registration"
      pattern: "msgPlugin|tests/lint-rules"
    - from: .planning/ROADMAP.md
      to: .planning/REQUIREMENTS.md
      via: "Coverage tables must agree on CMC-16/CMC-34/CMC-38 status across both files"
      pattern: "CMC-(16|34|38).*Complete"
---

<objective>
Land the WARNING-level audit closures + the eslint.config.js per-rule wiring that activates all 34 MSG-* drift-guard rules + the REQUIREMENTS.md/ROADMAP.md updates that mark CMC-16/CMC-34/CMC-38 as Complete with Phase 14 attribution. This is the v1.3 milestone-close commit.

Three interlocked refactors:

**A. transaction/rollback.ts refactor (D-14-04 + RESEARCH.md Pitfall 6):** The audit's WARNING-level finding at `transaction/rollback.ts:56-62` hand-composes the user-visible `(failed) {rollback partial}` body inline because the transaction layer has no plugin/scope/marketplace context. D-14-04 offered two paths; RESEARCH.md Pitfall 6 ruled out option (b) -- "transaction calls presentation/" -- because `eslint.config.js:194-202` BLOCK C zone forbids `transaction/` from importing `presentation/`. The recommended path (this plan) is **orchestrator-owns-rendering**: `formatRollbackError` returns a structured `RollbackErrorResult` carrying the `rollbackPartials` data; orchestrators call `presentation/rollback-partial.ts`'s composer themselves to produce the user-visible body. The hand-composed literal at the original lines 56-62 GOES AWAY; MSG-RP-1 (Plan 05) catches re-introductions.

**B. eslint.config.js per-rule wiring + composer-file ignores (D-14-08):** Register all 34 MSG-* rules from Plan 04 + Plan 05 in eslint.config.js under per-rule `files:` patterns (RESEARCH.md Pattern 4 -- full template). Apply RESEARCH.md Pitfall 9 -- `ignores:` arrays for the canonical composer files so the literal-detection rules (MSG-MR-1..2, MSG-RP-1, MSG-CC-1, MSG-RH-1) don't fire false positives on the files that legitimately contain those literals. Imports the local plugin via `import msgPlugin from "./tests/lint-rules/index.js";`. **This wiring flips the assertion (c) gate in `tests/architecture/msg-rule-registry.test.ts` from t.todo() to ACTIVE -- all 4 assertions must pass at the Plan 06 commit.**

**C. REQUIREMENTS.md + ROADMAP.md milestone-close updates (SC #5):** Phase 14's ROADMAP SC #5 mandates "every CMC-01..38 requirement has its traceability row marked `Complete` (Phase 12 / Phase 13 / Phase 14 as appropriate); the v1.3 line in REQUIREMENTS.md Coverage block shows 38/38 mapped and complete." This plan owns the bulk doc edit that flips CMC-16, CMC-34, CMC-38 from Pending (or Phase 13 attribution) to Complete (Phase 14 attribution). Per D-14-02 (LOCKED), Phase 14 absorbs CMC-16/CMC-34 closure -- their attribution flips from Phase 13 to Phase 14 in both files. CMC-38 was always Phase 14; status flips from Pending to Complete.

After this plan lands:
- The registry parity test from Plan 05 passes all 4 assertions (including (c) -- the gate is removed).
- All 34 drift-guard rules ACTIVELY run during `npm run lint`.
- `transaction/rollback.ts` no longer carries the only known MSG-RP-1 violation site.
- `MARKETPLACE_LABEL_PROBE` already landed in shared/constants/ from Plan 03.
- REQUIREMENTS.md + ROADMAP.md mark CMC-16/CMC-34/CMC-38 as Complete with Phase 14 attribution.
- `npm run check` is green -- the v1.3 milestone is complete (every CMC-01..38 row mapped to Complete).

Per D-14-04 (LOCKED) + RESEARCH.md Pitfall 6 (orchestrator-owns-rendering -- option (b) is BLOCKED by D-11 BLOCK C) + D-14-08 (LOCKED narrow per-rule scoping) + D-14-09 (LOCKED meta vs full split now wires) + Phase 14 ROADMAP SC #5 (milestone-close).
Output: WARNING-level audit closures complete; 34 rules active in eslint.config.js; REQUIREMENTS.md + ROADMAP.md show 38/38 Complete; milestone-close commit.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md
@.planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md
@.planning/v1.3-MILESTONE-AUDIT.md
@docs/messaging-style-guide.md
@eslint.config.js
@extensions/pi-claude-marketplace/transaction/rollback.ts
@extensions/pi-claude-marketplace/transaction/phase-ledger.ts
@extensions/pi-claude-marketplace/presentation/rollback-partial.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
@tests/transaction/rollback.test.ts
@tests/lint-rules/index.js
@tests/architecture/msg-rule-registry.test.ts

<interfaces>
<!-- Templates the executor consumes. -->

From RESEARCH.md "Code Examples" subsection on transaction/rollback.ts refactor:
- New return type: `interface RollbackErrorResult { readonly error: Error; readonly rollbackPartials: readonly RollbackPartialEntry[]; }`
- New signature: `export function formatRollbackError(result: RunPhasesResult, originalError: Error): RollbackErrorResult { ... }`
- Function body returns the original error + the unrendered `rollbackPartials` data; the user-visible body is composed by the orchestrator.
- For `PathContainmentError`: short-circuit returns `{ error: originalError, rollbackPartials: [] }`.
- For zero partials: returns `{ error: originalError, rollbackPartials: [] }`.
- For ≥1 partial: returns `{ error: new Error(originalError.message, { cause: originalError }), rollbackPartials: result.rollbackPartials }`.

From extensions/pi-claude-marketplace/presentation/rollback-partial.ts (existing composer -- load it):
- Existing function (verify the export -- likely `renderRollbackPartial(parentRow, partials, probe?)` or similar). If a "bare children" helper doesn't exist, ADD one -- a helper that takes `readonly RollbackPartialEntry[]` and returns the indented children block (suggested: `composeRollbackPartialChildren(partials: readonly RollbackPartialEntry[]): string` returning the indented children string without the parent row; orchestrators stitch this under their own parent row context).
- The orchestrators currently call `formatRollbackError(result, err)` and end up calling `notifyError(ctx, err.message, err)` -- the `err.message` carries the hand-composed body. After this refactor, orchestrators call `formatRollbackError(result, err)`, receive the structured result, compose the body via the new helper from presentation/, and call `notifyError(ctx, body, structuredErrorChain)`.

From extensions/pi-claude-marketplace/transaction/phase-ledger.ts:
- Exports `RunPhasesResult` and `RollbackPartialEntry` types -- both stay unchanged.
- This file is in the same layer (transaction/) as rollback.ts; no changes needed.

From extensions/pi-claude-marketplace/orchestrators/plugin/install.ts (grep verified caller):
- Calls `formatRollbackError(result, err)` and passes the result through to notifyError. Current call site (line ~222 per grep) -- verify exact call shape in the source file.

From extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:
- Same caller pattern -- verify exact call shape.

From extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:
- Same caller pattern -- verify exact call shape.

From RESEARCH.md Pattern 4 (eslint.config.js per-rule wiring template -- verbatim worked example with 5-6 blocks):
- Block 1: MSG-SR-1..6 → `files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"]`
- Block 2: MSG-SR-7 + MSG-NC-2 → `files: ["extensions/pi-claude-marketplace/edge/handlers/**/*.ts"]`
- Block 3: MSG-LC-1..2 → `files: ["extensions/pi-claude-marketplace/persistence/migrate.ts"]`
- Block 4: MSG-MR-1..2, MSG-RP-1, MSG-CC-1, MSG-RH-1 → `files: ["extensions/pi-claude-marketplace/**/*.ts"]` + `ignores: [composer files]` (Pitfall 9)
- Block 5: MSG-NC-1 + MSG-SD-1..2 → `files: ["extensions/pi-claude-marketplace/**/*.ts"]` + `ignores: ["...compact-line.ts"]`
- Block 6: meta-assertion rules (16 entries: MSG-GR-1..5, MSG-IC-1..3, MSG-SD-3, MSG-PL-1..6, MSG-ER-1) → `files: ["extensions/pi-claude-marketplace/**/*.ts"]`

From RESEARCH.md Pitfall 9 (per-file ignores for composer files):
- MSG-MR-1..2 → `ignores: ["extensions/pi-claude-marketplace/presentation/manual-recovery.ts"]`
- MSG-RP-1 → `ignores: ["extensions/pi-claude-marketplace/presentation/rollback-partial.ts"]`
- MSG-CC-1 → `ignores: ["extensions/pi-claude-marketplace/presentation/cause-chain.ts", "extensions/pi-claude-marketplace/shared/errors.ts"]`
- MSG-RH-1 → `ignores: ["extensions/pi-claude-marketplace/presentation/reload-hint.ts"]`
- MSG-LC-1..2 → no ignores needed (the rules are SCOPED to migrate.ts via `files:` -- the sanctioned callsite passes via the inline-disable; the rule must accept inline eslint-disable comments)

From tests/lint-rules/index.js (Plan 04 + 05 result):
- `RULE_NAMES.length === 34`; `default.rules` has 34 entries.
- ESM default export shape: `{ meta: { name: ..., version: ... }, rules: { ... } }`.
- Plan 06 imports this as: `import msgPlugin from "./tests/lint-rules/index.js";` (relative to eslint.config.js at repo root).

From tests/architecture/msg-rule-registry.test.ts (Plan 05 result):
- 4 assertions; assertion (c) is GATED via t.todo() pending Plan 06.
- This plan's eslint.config.js wiring adds the `msg/msg-*` literals; the gate detection (`eslintConfigText.includes('"msg/msg-')`) flips to true; assertion (c) becomes ACTIVE and asserts 1:1 parity across all 34 rule names.

From .planning/REQUIREMENTS.md (current Coverage table at lines 730-767):
- Line 745: `| CMC-16      | Phase 13 | Complete |` -- this attribution PRE-DATES Phase 14's audit-driven scope absorption (D-14-02 LOCKED). Reattribute to Phase 14 with Status=Complete confirming the closure landed in Phase 14 Plan 01.
- Line 763: `| CMC-34      | Phase 13 | Complete |` -- same reattribution: Phase 13 → Phase 14, Status remains Complete (now confirming the closure landed in Phase 14 Plan 02).
- Line 767: `| CMC-38      | Phase 14 | Pending  |` -- flip to `| CMC-38      | Phase 14 | Complete |`.
- Also update the per-phase counts block (lines 775+) to reflect the reattribution: CMC-16 + CMC-34 + CMC-38 are Phase 14, not Phase 13.

From .planning/ROADMAP.md (current `## Progress` + `## Coverage (v1.3)` blocks at lines 246-302):
- Line 258 (Progress table Phase 14 row): currently `| 14. Drift Guard & Test Alignment (v1.3)      | ... | CMC-16, CMC-34, CMC-38 | 0/6 plans  | Planned     | --         |` -- update Plans to `6/6 plans`, Status to `Complete`, Completed to the actual completion date (2026-05-24 or the executor's commit date).
- Lines 280 (CMC-16), 298 (CMC-34), 302 (CMC-38) in `## Coverage (v1.3)` table: currently show `Pending` status (or Phase 13 attribution for CMC-16 / CMC-34). Update each to Phase 14 + Complete.
- Line 317-318 (per-phase distribution): the row for Phase 13 must drop CMC-16 + CMC-34 (re-attributed to Phase 14); the row for Phase 14 expands from `CMC-38` to `CMC-16, CMC-34, CMC-38` (count 1 → 3). The Phase 13 count decreases from 31 to 29.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor transaction/rollback.ts to RollbackErrorResult; update 3 orchestrator callers + rollback.test.ts</name>
  <files>
    extensions/pi-claude-marketplace/transaction/rollback.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/install.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/update.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts,
    tests/transaction/rollback.test.ts,
    extensions/pi-claude-marketplace/presentation/rollback-partial.ts
  </files>
  <read_first>
    - extensions/pi-claude-marketplace/transaction/rollback.ts (current full file -- 63 lines; lines 48-62 are the formatRollbackError function that gets refactored)
    - extensions/pi-claude-marketplace/transaction/phase-ledger.ts (focus the `RunPhasesResult` + `RollbackPartialEntry` exports; UNCHANGED by this plan)
    - extensions/pi-claude-marketplace/presentation/rollback-partial.ts (existing composer -- confirm the exported function names; if a "bare children" helper doesn't exist, this plan ADDS one. The helper signature: `composeRollbackPartialChildren(partials: readonly RollbackPartialEntry[]): string` returning the 2-space-indented children block -- see RESEARCH.md §Code Examples for the shape that currently lives at transaction/rollback.ts:58-60)
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts (focus the `formatRollbackError(result, err)` callsite ~line 222)
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts (same -- locate the formatRollbackError callsite via grep)
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts (same -- locate the formatRollbackError callsite via grep; this file may have multiple, especially around the wave-1 manual-recovery integration from Plan 01)
    - tests/transaction/rollback.test.ts (focus the 4 tests asserting the hand-composed body shape -- these MUST be rewritten to assert the new RollbackErrorResult shape)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md "Code Examples" subsection (the full refactored shape)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pitfall 6 (the D-11 BLOCK C constraint that forces this approach)
    - eslint.config.js:194-202 (the BLOCK C zone enforcement; confirm the layering constraint hasn't changed since RESEARCH.md was written)
  </read_first>
  <action>
    Implement RESEARCH.md Pitfall 6's orchestrator-owns-rendering refactor:

    **A. Refactor `transaction/rollback.ts`** per RESEARCH.md "Code Examples":
    1. Replace the existing `formatRollbackError(result, originalError): Error` with `formatRollbackError(result, originalError): RollbackErrorResult`.
    2. Define + export the new return type: `export interface RollbackErrorResult { readonly error: Error; readonly rollbackPartials: readonly RollbackPartialEntry[]; }`. The `RollbackPartialEntry` type is imported from `./phase-ledger.ts` (same layer; allowed by BLOCK C).
    3. Function body:
       - `if (originalError instanceof PathContainmentError) return { error: originalError, rollbackPartials: [] };`
       - `if (result.rollbackPartials.length === 0) return { error: originalError, rollbackPartials: [] };`
       - Otherwise: `return { error: new Error(originalError.message, { cause: originalError }), rollbackPartials: result.rollbackPartials };`
    4. DELETE the hand-composed `parentLine`, `childLines`, `composed` literal composition (the original lines 56-61). The MSG-RP-1 rule (Plan 05) will fire on any future re-introduction.
    5. Update the file's top JSDoc / comment block: NEW rationale "orchestrator-owns-rendering per D-14-04 + RESEARCH.md Pitfall 6 + D-11 BLOCK C constraint."

    **B. Update `presentation/rollback-partial.ts`** to expose the children-composition helper that the orchestrators now need:
    1. Read the existing exports. If there is already a function that takes `RollbackPartialEntry[]` and returns the indented child rows block, reuse it.
    2. If not, ADD a small exported helper: function name `composeRollbackPartialChildren(partials: readonly RollbackPartialEntry[]): string` (or equivalent -- pick a name consistent with the existing module's conventions). Body: maps each partial to `  [${p.phase}] (rollback failed) {rollback partial}` (2-space indent + RowSpec-style compact line) and joins with `\n`. This helper produces text byte-equal to the OLD `childLines` in transaction/rollback.ts:58-60 -- preserves the catalog UAT byte-binding.

    **C. Update 3 orchestrator callsites** to consume the new structured return:
    1. `orchestrators/plugin/install.ts`: locate the `formatRollbackError(result, err)` callsite. Today it likely flows into `notifyError(ctx, err.message, err)` via the returned Error. After refactor:
       - Capture `const { error, rollbackPartials } = formatRollbackError(result, err);`
       - If `rollbackPartials.length === 0`: pass-through unchanged -- `notifyError(ctx, errorMessage(error), error);`
       - If `rollbackPartials.length > 0`: compose the body via the new helper: `const childrenBlock = composeRollbackPartialChildren(rollbackPartials);` and `const parentLine = "(failed) {rollback partial}";` then `notifyError(ctx, `${errorMessage(error)}\n\n${parentLine}\n${childrenBlock}`, error);`.
       - The notifyError cause-chain trailer (causeChainTrailer at depth-5) is still appended automatically -- no change to that path.
    2. `orchestrators/plugin/update.ts`: same pattern.
    3. `orchestrators/plugin/reinstall.ts`: same pattern. The wave-1 manual-recovery integration from Plan 01 emits a separate ManualRecoveryLine anchor; that path is UNCHANGED by this task -- the rollback-partial body composition is a separate trailer.

    **D. Update `tests/transaction/rollback.test.ts`** to match the new contract:
    1. The 4 tests (lines 28-160+ per grep) currently assert hand-composed body shapes via `got.message` byte-equality. After refactor, `formatRollbackError` returns `RollbackErrorResult` -- tests must assert the new shape:
       - `got.error` is the expected Error (with cause chain).
       - `got.rollbackPartials` is the expected array of `RollbackPartialEntry`.
       - The hand-composed body shape is now produced by an orchestrator-level integration test -- NEW tests under `tests/orchestrators/plugin/{install,update,reinstall}.test.ts` are NOT introduced by this plan unless an existing test now fails (in which case it gets updated minimally to match the new composition path).
    2. The PathContainmentError short-circuit test stays in shape but asserts the new structured return.
    3. The ES-4 cause-chain test stays similar but checks `got.error.cause === originalError`.

    Run `npm run check` after each file edit to catch type errors immediately. The compilation will fail until ALL 5 files (rollback.ts, install.ts, update.ts, reinstall.ts, rollback-partial.ts) are consistently updated -- atomic refactor.

    **NEVER** add `import { ... } from "../presentation/..."` to `transaction/rollback.ts` -- that would violate BLOCK C and ESLint would fail immediately (RESEARCH.md Pitfall 6).
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # No hand-composed literal in transaction/rollback.ts:
      grep -c '(failed) {rollback partial}' extensions/pi-claude-marketplace/transaction/rollback.ts
      # Expect: 0
      # transaction/ does NOT import from presentation/:
      grep -c 'from.*presentation' extensions/pi-claude-marketplace/transaction/rollback.ts
      # Expect: 0 (BLOCK C compliance -- Pitfall 6 mitigation)
      # New RollbackErrorResult type:
      grep -c 'RollbackErrorResult' extensions/pi-claude-marketplace/transaction/rollback.ts
      # Expect: ≥2 (interface + return-type usage)
      # New helper in presentation/rollback-partial.ts:
      grep -c 'composeRollbackPartialChildren\|composeRollbackPartialBody' extensions/pi-claude-marketplace/presentation/rollback-partial.ts
      # Expect: ≥1 (the helper exported)
      # Orchestrator callsites updated:
      grep -rn 'formatRollbackError' extensions/pi-claude-marketplace/orchestrators/plugin/ | head -10
      # Expect: 3 callsites (install.ts, update.ts, reinstall.ts), each pattern-matching the new structured-destructure shape
      # rollback.test.ts updated:
      node --test tests/transaction/rollback.test.ts 2>&1 | tail -10
      # Expect: pass
      # Catalog UAT byte-binding preserved (the key regression risk):
      node --test tests/architecture/catalog-uat.test.ts 2>&1 | tail -10
      # Expect: pass -- catalog rendering byte-equal to the documented output
      # Full check:
      npm run typecheck 2>&1 | tail -3
      # Expect: success
    </automated>
  </verify>
  <done>
    1. `transaction/rollback.ts::formatRollbackError` returns `RollbackErrorResult` (no Error-with-composed-body); no hand-composed literal remains.
    2. `presentation/rollback-partial.ts` exposes a helper that orchestrators consume to compose the children block.
    3. install.ts, update.ts, reinstall.ts (3 callsites) all destructure the new structured return + compose the body via the presentation helper.
    4. tests/transaction/rollback.test.ts updated to the new contract; passes.
    5. tests/architecture/catalog-uat.test.ts still passes (byte-binding preserved).
    6. `npm run typecheck` is green.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire 34 MSG-* rules in eslint.config.js with per-rule files: + composer-file ignores; flip registry test assertion (c) gate</name>
  <files>eslint.config.js</files>
  <read_first>
    - eslint.config.js (the full current file -- focus on the existing flat-config block layout, BLOCK A/B/C/D/E patterns, and where to insert the new msg-plugin blocks)
    - tests/lint-rules/index.js (after Plan 05 -- exports default plugin with all 34 rules; this plan imports it)
    - tests/architecture/msg-rule-registry.test.ts (Plan 05 -- assertion (c) is gated; this plan's wiring flips the gate to active)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 4 (verbatim per-rule wiring template with 5-6 blocks)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pitfall 9 (composer-file `ignores:` arrays)
    - .planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md D-14-08 (LOCKED narrow per-rule scoping)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Plan Decomposition Plan 3d (the rule families + their `files:` scopes)
  </read_first>
  <action>
    Implement D-14-08 (LOCKED) per RESEARCH.md Pattern 4 + Pitfall 9: register all 34 MSG-* rules under per-rule `files:` patterns in `eslint.config.js`.

    1. **Add the plugin import at the top of eslint.config.js**: `import msgPlugin from "./tests/lint-rules/index.js";` (placed alongside the existing plugin imports -- typescript-eslint, stylistic, import-x, etc.)

    2. **Add 6 flat-config blocks** at an appropriate position in the file (after BLOCK B sanctioned-syntax-disables for shared/notify.ts and persistence/migrate.ts; before or after BLOCK C path-import zones is acceptable -- locality with the existing per-file overrides is preferred). Each block follows RESEARCH.md Pattern 4 verbatim with appropriate `files:` and `ignores:`:

       **Block 1: MSG-SR-1..6 (cascade-routing rules -- orchestrators surface)**
       - `files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"]`
       - `plugins: { msg: msgPlugin }`
       - `rules:` 6 entries -- `"msg/msg-sr-1-success-routing": "error"` through `"msg/msg-sr-6-no-cascade-error": "error"` (use the exact rule slugs from RULE_NAMES set in Plan 05 Task 3).

       **Block 2: MSG-SR-7 + MSG-NC-2 (usage-error edge surface)**
       - `files: ["extensions/pi-claude-marketplace/edge/handlers/**/*.ts"]`
       - `plugins: { msg: msgPlugin }`
       - `rules: { "msg/msg-sr-7-usage-error-routing": "error", "msg/msg-nc-2-usage-separator": "error" }`

       **Block 3: MSG-LC-1..2 (console.warn discipline -- narrowest scope)**
       - `files: ["extensions/pi-claude-marketplace/persistence/migrate.ts"]`
       - `plugins: { msg: msgPlugin }`
       - `rules: { "msg/msg-lc-1-console-warn-form": "error", "msg/msg-lc-2-eslint-discipline": "error" }`

       **Block 4: MSG-MR-1..2, MSG-RP-1, MSG-CC-1, MSG-RH-1 (composer-chokepoint rules)**
       - `files: ["extensions/pi-claude-marketplace/**/*.ts"]`
       - `ignores: ["extensions/pi-claude-marketplace/presentation/manual-recovery.ts", "extensions/pi-claude-marketplace/presentation/rollback-partial.ts", "extensions/pi-claude-marketplace/presentation/cause-chain.ts", "extensions/pi-claude-marketplace/presentation/reload-hint.ts", "extensions/pi-claude-marketplace/shared/errors.ts"]` (the last for cause-chain-related literals in shared/errors.ts -- RESEARCH.md Pitfall 9)
       - `plugins: { msg: msgPlugin }`
       - `rules:` 5 entries -- `"msg/msg-mr-1-manual-recovery-anchor": "error"`, `"msg/msg-mr-2-manual-recovery-system": "error"`, `"msg/msg-rp-1-rollback-partial": "error"`, `"msg/msg-cc-1-cause-chain": "error"`, `"msg/msg-rh-1-reload-hint": "error"`

       **Block 5: MSG-NC-1 + MSG-SD-1..2 (presentation-renderer chokepoint rules)**
       - `files: ["extensions/pi-claude-marketplace/**/*.ts"]`
       - `ignores: ["extensions/pi-claude-marketplace/presentation/compact-line.ts"]` (NC-1 + SD-1..2 detect renderer literals -- the renderer itself is the canonical owner)
       - `plugins: { msg: msgPlugin }`
       - `rules: { "msg/msg-nc-1-entity-error": "error", "msg/msg-sd-1-soft-dep-reason": "error", "msg/msg-sd-2-soft-dep-predicate": "error" }`

       **Block 6: All structural meta-assertion rules + MSG-SD-3 + MSG-ER-1 (globally enabled)**
       - `files: ["extensions/pi-claude-marketplace/**/*.ts"]`
       - `plugins: { msg: msgPlugin }`
       - `rules:` 16 entries -- all meta-assertion rules from Plan 04 (MSG-GR-1..5, MSG-IC-1..3, MSG-SD-3, MSG-PL-1..6, MSG-ER-1). Exact slugs: `"msg/msg-gr-1-line-grammar"`, `"msg/msg-gr-2-marketplace-token"`, `"msg/msg-gr-3-per-scope"`, `"msg/msg-gr-4-reasons-block"`, `"msg/msg-gr-5-marker-slot"`, `"msg/msg-ic-1-filled-icon"`, `"msg/msg-ic-2-open-icon"`, `"msg/msg-ic-3-blocked-icon"`, `"msg/msg-sd-3-soft-dep-scope"`, `"msg/msg-pl-1-description"`, `"msg/msg-pl-2-version-slot"`, `"msg/msg-pl-3-version-arrow"`, `"msg/msg-pl-4-upgradable-listonly"`, `"msg/msg-pl-5-hash-version"`, `"msg/msg-pl-6-version-non-success"`, `"msg/msg-er-1-empty-token"`.

    3. **Verify the total registered count equals 34**: count the per-rule registrations across all 6 new blocks. Sum: 6 + 2 + 2 + 5 + 3 + 16 = 34. (Deviation is a planning failure; the locked split is 16 meta + 18 full = 34.)

    4. **Avoid double-registration**: each rule name appears in EXACTLY ONE block -- `files:` patterns may overlap, but the rule name itself must not be registered in two blocks (would produce conflicting severity settings). Cross-check this when assembling the blocks.

    5. **Verify the BLOCK D / E (existing overrides) compatibility**: the new blocks must not conflict with the existing `eslint.config.js` self-override (line ~316) or any other per-file override. Insert the new blocks at a position consistent with the existing flat-config conventions (after BLOCK B, before the existing self-override block).

    6. **Flip the registry test assertion (c) gate**: this task's wiring causes `eslintConfigText.includes('"msg/msg-')` (the gate-detection literal in `tests/architecture/msg-rule-registry.test.ts`) to return TRUE -- assertion (c) transitions from t.todo() to ACTIVE. The acceptance criterion below asserts the registry test now passes all 4 assertions.

    After the edit, run `npm run check`:
    - typecheck: unaffected (no TS source change).
    - lint: NOW ACTIVE -- all 34 MSG-* rules run against the extension surface. Any unintended violation in the codebase fails this step. Most rules should pass: Plan 01 + Plan 02 closed the CMC-16/CMC-34 surface; Task 1 above closed MSG-RP-1's only known site; Phase 12/13 closed every legacy ES-5 marker; the codebase should be conformant by construction.
    - format:check: unaffected.
    - test: registry test from Plan 05 assertion (c) NOW passes -- all 34 rule names found in eslint.config.js.

    If any rule fires false positives (unexpected lint failures), debug:
    - Verify the `ignores:` lists cover every legitimate composer file.
    - Verify the rule's AST visitor matches what the source actually emits.
    - For known structural-enforcement cases (meta-assertion rules), confirm the rule's `create()` returns the no-op `Program: () => {}` (Plan 04 Task 1).

    NEVER place fenced code blocks in this action; the RESEARCH.md Pattern 4 worked example contains the template.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # Plugin imported:
      grep -c 'import msgPlugin from "./tests/lint-rules' eslint.config.js
      # Expect: 1
      # Exactly 34 unique rule registrations (WARNING-6 lock):
      grep -oE '"msg/msg-[a-z]+-[0-9]+-[a-z0-9-]+"' eslint.config.js | sort -u | wc -l
      # Expect: 34
      # No slug appears in two blocks (WARNING-6 lock):
      grep -oE '"msg/msg-[a-z]+-[0-9]+-[a-z0-9-]+"' eslint.config.js | sort | uniq -d
      # Expect: empty (no duplicate rule registrations across blocks)
      # Composer-file ignores present (per Pitfall 9):
      grep -c 'presentation/manual-recovery.ts' eslint.config.js
      grep -c 'presentation/rollback-partial.ts' eslint.config.js
      grep -c 'presentation/cause-chain.ts' eslint.config.js
      grep -c 'presentation/reload-hint.ts' eslint.config.js
      grep -c 'presentation/compact-line.ts' eslint.config.js
      # Each: expect ≥1
      # Registry test now passes ALL 4 assertions (gate flipped from t.todo to active):
      node --test tests/architecture/msg-rule-registry.test.ts 2>&1 | tail -10
      # Expect: all 4 assertions pass (assertion (c) was gated under Plan 05; now active under Plan 06 -- gate detection sees the msg/msg- literal and runs the loop)
      # Full milestone-close check:
      npm run check 2>&1 | tail -15
      # Expect: SUCCESS -- v1.3 milestone close (lint + test + typecheck + format all green)
    </automated>
  </verify>
  <done>
    1. `eslint.config.js` imports the local plugin via `import msgPlugin from "./tests/lint-rules/index.js";`.
    2. All 34 MSG-* rules are registered via `"msg/<name>": "error"` entries across 6 flat-config blocks with appropriate `files:` patterns + composer-file `ignores:`.
    3. `grep -oE '"msg/msg-[a-z]+-[0-9]+-[a-z0-9-]+"' eslint.config.js | sort -u | wc -l` returns exactly 34.
    4. `grep -oE '"msg/msg-[a-z]+-[0-9]+-[a-z0-9-]+"' eslint.config.js | sort | uniq -d` returns nothing (no duplicate registrations).
    5. The registry parity test from Plan 05 now passes all 4 assertions (assertion (c) gate flipped to active; loop runs against all 34 rules).
    6. `npm run check` is GREEN -- Plan 06 milestone gate satisfied.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update REQUIREMENTS.md + ROADMAP.md to mark CMC-16/CMC-34/CMC-38 Complete with Phase 14 attribution (SC #5 milestone-close)</name>
  <files>.planning/REQUIREMENTS.md, .planning/ROADMAP.md</files>
  <read_first>
    - .planning/REQUIREMENTS.md (focus lines 730-779: the Coverage table at 730-767 + the per-phase counts block at 775+)
    - .planning/ROADMAP.md (focus lines 246-318: the `## Progress` table at 250-259 + the `## Coverage (v1.3)` table at 261-302 + the per-phase distribution table at 312-318)
    - .planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md D-14-02 (LOCKED reattribution -- Phase 14 absorbs CMC-16 + CMC-34 from Phase 13)
    - .planning/ROADMAP.md SC #5 for Phase 14 (lines 227-228): "The milestone is complete: every CMC-01..38 requirement has its traceability row marked `Complete` (Phase 12 / Phase 13 / Phase 14 as appropriate); the v1.3 line in REQUIREMENTS.md Coverage block shows 38/38 mapped and complete."
  </read_first>
  <action>
    Per Phase 14 ROADMAP SC #5 (LOCKED -- the milestone-gate property), update REQUIREMENTS.md + ROADMAP.md so CMC-16, CMC-34, CMC-38 reflect Phase 14 closure status. This is a bulk doc edit with three sub-operations:

    **A. Update `.planning/REQUIREMENTS.md` Coverage table (lines 730-767):**

    1. Line 745: `| CMC-16      | Phase 13 | Complete |` → `| CMC-16      | Phase 14 | Complete |` (reattribution per D-14-02 LOCKED).
    2. Line 763: `| CMC-34      | Phase 13 | Complete |` → `| CMC-34      | Phase 14 | Complete |` (same reattribution).
    3. Line 767: `| CMC-38      | Phase 14 | Pending  |` → `| CMC-38      | Phase 14 | Complete |`.

    4. Update the v1.3 Coverage summary at line 775 (currently `Phase 13: CMC-01..07, CMC-09, CMC-10, CMC-12, CMC-13, CMC-15..18, CMC-20, CMC-21, CMC-22..34, CMC-35; Phase 14: CMC-38`):
       - Phase 13 list: REMOVE CMC-16 and CMC-34 (now reattributed to Phase 14). Note `CMC-15..18` collapses to `CMC-15, CMC-17, CMC-18` (CMC-16 moved); `CMC-22..34` becomes `CMC-22..33` (CMC-34 moved). Verify the prose stays consistent.
       - Phase 14 list: EXPAND from `CMC-38` to `CMC-16, CMC-34, CMC-38`.

    5. Per-phase counts elsewhere in REQUIREMENTS.md (search around line 779+ for `**Per-phase counts:**`): update the Phase 13 count (decrement by 2: was 31, becomes 29); update the Phase 14 count (increment by 2: was 1, becomes 3). Confirm the totals still sum to 38.

    **B. Update `.planning/ROADMAP.md` `## Progress` table (line 258):**

    Current row: `| 14. Drift Guard & Test Alignment (v1.3)      | Frontmatter-driven drift test suite + CMC-16/CMC-34 audit-absorbed closures       | CMC-16, CMC-34, CMC-38                                                                                                                                    | 0/6 plans  | Planned     | --         |`

    Updated row: `| 14. Drift Guard & Test Alignment (v1.3)      | Frontmatter-driven drift test suite + CMC-16/CMC-34 audit-absorbed closures       | CMC-16, CMC-34, CMC-38                                                                                                                                    | 6/6 plans  | Complete    | YYYY-MM-DD |`

    Where `YYYY-MM-DD` is the actual completion date (typically the executor's commit date; if running on 2026-05-24 the value is `2026-05-24`). Use the commit date in the executor's environment.

    **C. Update `.planning/ROADMAP.md` `## Coverage (v1.3)` table (lines 280, 298, 302):**

    1. Line 280: `| CMC-16      | Phase 13 | Pending |` → `| CMC-16      | Phase 14 | Complete |` (reattribution + status flip).
    2. Line 298: `| CMC-34      | Phase 13 | Pending |` → `| CMC-34      | Phase 14 | Complete |` (same).
    3. Line 302: `| CMC-38      | Phase 14 | Pending |` → `| CMC-38      | Phase 14 | Complete |`.

    Per-phase distribution table at lines 312-318:
    - Phase 13 row (line 317): REMOVE CMC-16 + CMC-34 from the requirements list; decrement count from 31 to 29.
    - Phase 14 row (line 318): EXPAND requirements list from `CMC-38` to `CMC-16, CMC-34, CMC-38`; increment count from 1 to 3.

    **D. Cross-file consistency check (BLOCKING)**: REQUIREMENTS.md and ROADMAP.md MUST agree on CMC-16/CMC-34/CMC-38 attribution + status. After both files are edited, the verify section asserts both sides match.

    NEVER place fenced code blocks in this action. The edits are mechanical table-cell updates; the executor uses the Edit tool with precise old/new strings per line.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # REQUIREMENTS.md status flips:
      grep -c "^| CMC-16.*Phase 14.*Complete" .planning/REQUIREMENTS.md
      # Expect: ≥1
      grep -c "^| CMC-34.*Phase 14.*Complete" .planning/REQUIREMENTS.md
      # Expect: ≥1
      grep -c "^| CMC-38.*Phase 14.*Complete" .planning/REQUIREMENTS.md
      # Expect: ≥1
      # No remaining "Pending" status anywhere in v1.3 Coverage rows of REQUIREMENTS.md:
      grep -cE "^\| CMC-(0[1-9]|[12][0-9]|3[0-8]).*Pending" .planning/REQUIREMENTS.md
      # Expect: 0 (all v1.3 CMC rows Complete)
      # ROADMAP.md Progress table:
      grep -E '^\| 14\. Drift Guard.*Complete' .planning/ROADMAP.md
      # Expect: the Phase 14 row shows Complete (not Planned)
      # ROADMAP.md Coverage table:
      grep -c "^| CMC-16.*Phase 14.*Complete" .planning/ROADMAP.md
      # Expect: ≥1
      grep -c "^| CMC-34.*Phase 14.*Complete" .planning/ROADMAP.md
      # Expect: ≥1
      grep -c "^| CMC-38.*Phase 14.*Complete" .planning/ROADMAP.md
      # Expect: ≥1
      # No "Pending" status remaining in ROADMAP.md Coverage (v1.3):
      grep -cE "^\| CMC-(0[1-9]|[12][0-9]|3[0-8]).*Pending" .planning/ROADMAP.md
      # Expect: 0
      # Cross-file consistency check (BLOCKING):
      # REQUIREMENTS.md attribution must match ROADMAP.md for the 3 CMCs:
      for cmc in CMC-16 CMC-34 CMC-38; do
        REQS=$(grep -E "^\| ${cmc} " .planning/REQUIREMENTS.md | head -1)
        ROAD=$(grep -E "^\| ${cmc} " .planning/ROADMAP.md | head -1)
        echo "$cmc REQ: $REQS"
        echo "$cmc ROAD: $ROAD"
      done
      # Expect both lines for each CMC mention Phase 14 + Complete
    </automated>
  </verify>
  <done>
    1. `.planning/REQUIREMENTS.md` Coverage table shows CMC-16, CMC-34, CMC-38 with Phase 14 attribution + Status=Complete.
    2. `.planning/ROADMAP.md` `## Progress` table Phase 14 row shows `6/6 plans  | Complete    | YYYY-MM-DD`.
    3. `.planning/ROADMAP.md` `## Coverage (v1.3)` table shows CMC-16, CMC-34, CMC-38 with Phase 14 + Complete.
    4. Per-phase distribution / counts in both files are internally consistent (Phase 13: 29 v1.3 CMCs; Phase 14: 3 v1.3 CMCs; total: 38).
    5. No v1.3 CMC row in either file still shows Status=Pending.
    6. Phase 14 ROADMAP SC #5 ("v1.3 Coverage shows 38/38 mapped and complete") is structurally satisfied.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| eslint.config.js → tests/lint-rules/ | The local plugin module is evaluated at lint-config time; its rule modules are project-internal source under the same git tree |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14-09 | Tampering | transaction/rollback.ts refactor introduces orchestrator-side body composition | mitigate | Catalog UAT byte-equality (`tests/architecture/catalog-uat.test.ts`) is the structural protection -- if the orchestrator body composition drifts from the original byte shape, the test fails. Task 1 verify runs catalog-uat explicitly. |
| T-14-10 | Tampering | eslint.config.js per-rule registration | mitigate | The registry parity test from Plan 05 enforces 1:1 between RULE_NAMES and eslint.config.js registrations; missing or extra registrations fail the test on the next `npm run check`. Plan 06 Task 2 verify also asserts exact count 34 + no duplicates. |
| T-14-11 | DoS | All 34 ESLint rules running on every npm run lint | accept | Meta-assertion rules with `Program: () => {}` visitors have negligible runtime cost (one function call per file). Full-impl rules visit specific AST node types -- bounded cost. Lint runtime is dominated by typescript-eslint type-aware analysis already in scope. |
| T-14-12 | Repudiation | REQUIREMENTS.md / ROADMAP.md cross-file consistency | mitigate | Task 3 verify cross-checks both files for the 3 reattributed CMCs; any drift surfaces as a script failure in the verify step. |
</threat_model>

<verification>
- `transaction/rollback.ts` no longer composes the user-visible `(failed) {rollback partial}` body; returns `RollbackErrorResult` structured value.
- `transaction/rollback.ts` does NOT import from `presentation/` (BLOCK C compliance -- Pitfall 6).
- `presentation/rollback-partial.ts` exposes a children-composition helper for the orchestrator side.
- `tests/transaction/rollback.test.ts` updated; passes.
- `tests/architecture/catalog-uat.test.ts` still passes (byte-binding preserved).
- `eslint.config.js` imports the local plugin + registers all 34 rules with per-rule `files:` patterns + composer-file `ignores:`; exactly 34 unique `"msg/<name>":` strings; no duplicates.
- `tests/architecture/msg-rule-registry.test.ts` passes ALL 4 assertions (assertion (c) gate flipped from t.todo to active).
- REQUIREMENTS.md + ROADMAP.md mark CMC-16/CMC-34/CMC-38 as Phase 14 / Complete; cross-file consistency confirmed; no v1.3 CMC row in either file shows Pending.
- `npm run check` is GREEN -- v1.3 milestone close commit.
</verification>

<success_criteria>
1. WARNING-level audit closure: `transaction/rollback.ts` hand-composed literal gone; MSG-RP-1 rule fires only on planted-violation tests, not on legitimate code.
2. All 34 MSG-* drift-guard rules are active in `npm run lint`; registry test passes all 4 assertions.
3. Registry parity test passes -- 1:1 across style-guide body ↔ rule files ↔ plugin module ↔ eslint.config.js.
4. REQUIREMENTS.md + ROADMAP.md mark CMC-16, CMC-34, CMC-38 as Phase 14 + Complete; v1.3 Coverage shows 38/38 (SC #5).
5. v1.3 milestone-close commit: `npm run check` green; CMC-16 / CMC-34 / CMC-38 all addressed (Plans 01/02/03/04/05/06).
6. Phase 14 success criteria #1 through #5 from ROADMAP.md all structurally satisfied:
   - SC #1 (planted violation makes npm run check fail with locatable error) -- every full-impl rule's `invalid:` case proves this.
   - SC #2 (failure includes MSG-* rule ID) -- every rule's `messageId` text contains the ID literal.
   - SC #3 (frontmatter is sole source of truth) -- loader + 4-key set-equality + body-scan registry test.
   - SC #4 (`npm run check` green after Phase 13 + 14) -- gate confirmed.
   - SC #5 (38/38 v1.3 coverage) -- REQUIREMENTS.md + ROADMAP.md updates in Task 3 land the bulk doc edit in-phase.
</success_criteria>

<output>
Create `.planning/phases/14-drift-guard-test-alignment/14-06-SUMMARY.md` when done.
</output>
</content>
</invoke>