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
  - tests/transaction/rollback.test.ts
  - eslint.config.js
autonomous: true
requirements:
  - CMC-38

must_haves:
  truths:
    - "`transaction/rollback.ts::formatRollbackError` no longer composes the user-visible `(failed) {rollback partial}` body inline (the hand-composed literal at the original lines 56-62 is gone); rendering moves to calling orchestrators via `presentation/rollback-partial.ts` per RESEARCH.md §Pitfall 6 (orchestrator-owns-rendering)."
    - "Every orchestrator currently calling `formatRollbackError` is updated to consume the new structured return type (no presentation/ import added to transaction/; D-11 layering preserved)."
    - "All 34 MSG-* rules are registered in `eslint.config.js` under per-rule `files:` patterns + appropriate `ignores:` for canonical composer files (RESEARCH.md §Pitfall 9)."
    - "The registry parity test's assertion (c) -- every rule name registered in eslint.config.js -- passes (Plan 05 Option A unblocks here; Plan 05 Option B's gate is removed)."
    - "`tests/transaction/rollback.test.ts` is updated to match the new `formatRollbackError` signature (the existing 4 tests that assert the hand-composed body shape get rewritten or replaced with tests asserting the new structured return)."
    - "MSG-RP-1 ESLint rule's planted-violation case still passes (Plan 05 wrote the rule; Plan 06's refactor removes the only existing violation site so the rule fires on planted-only -- no legitimate code triggers it)."
    - "`npm run check` is GREEN at the Plan 06 commit -- this is the v1.3 milestone close."
  artifacts:
    - path: extensions/pi-claude-marketplace/transaction/rollback.ts
      provides: "Structured RollbackErrorResult return; no user-visible body composition; no presentation/ import"
      contains_not: "(failed) {rollback partial}"
    - path: eslint.config.js
      provides: "Per-rule files: patterns registering all 34 MSG-* rules + composer-file ignores"
      contains: 'msg/msg-sr-7'
  key_links:
    - from: "extensions/pi-claude-marketplace/orchestrators/plugin/{install,update,reinstall}.ts"
      to: extensions/pi-claude-marketplace/presentation/rollback-partial.ts
      via: "orchestrators consume the new RollbackErrorResult and compose the body via presentation/"
      pattern: "renderRollbackPartial\\(|formatRollbackError\\("
    - from: eslint.config.js
      to: tests/lint-rules/index.js
      via: "import msgPlugin + plugins: { msg: msgPlugin } registration"
      pattern: "msgPlugin|tests/lint-rules"
---

<objective>
Land the WARNING-level audit closures + the eslint.config.js per-rule wiring that activates all 34 MSG-* drift-guard rules. This is the v1.3 milestone-close commit.

Two interlocked refactors:

**A. transaction/rollback.ts refactor (D-14-04 + RESEARCH.md Pitfall 6):** The audit's WARNING-level finding at `transaction/rollback.ts:56-62` hand-composes the user-visible `(failed) {rollback partial}` body inline because the transaction layer has no plugin/scope/marketplace context. D-14-04 offered two paths; RESEARCH.md Pitfall 6 ruled out option (b) -- "transaction calls presentation/" -- because `eslint.config.js:194-202` BLOCK C zone forbids `transaction/` from importing `presentation/`. The recommended path (this plan) is **orchestrator-owns-rendering**: `formatRollbackError` returns a structured `RollbackErrorResult` carrying the `rollbackPartials` data; orchestrators call `presentation/rollback-partial.ts`'s composer themselves to produce the user-visible body. The hand-composed literal at the original lines 56-62 GOES AWAY; MSG-RP-1 (Plan 05) catches re-introductions.

**B. eslint.config.js per-rule wiring + composer-file ignores (D-14-08):** Register all 34 MSG-* rules from Plan 04 + Plan 05 in eslint.config.js under per-rule `files:` patterns (RESEARCH.md Pattern 4 -- full template). Apply RESEARCH.md Pitfall 9 -- `ignores:` arrays for the canonical composer files so the literal-detection rules (MSG-MR-1..2, MSG-RP-1, MSG-CC-1, MSG-RH-1) don't fire false positives on the files that legitimately contain those literals. Imports the local plugin via `import msgPlugin from "./tests/lint-rules/index.js";`.

After this plan lands:
- The registry parity test from Plan 05 passes assertion (c).
- All 34 drift-guard rules ACTIVELY run during `npm run lint`.
- `transaction/rollback.ts` no longer carries the only known MSG-RP-1 violation site.
- `MARKETPLACE_LABEL_PROBE` already landed in shared/constants/ from Plan 03.
- `npm run check` is green -- the v1.3 milestone is complete (every CMC-01..38 row mapped).

Per D-14-04 (LOCKED) + RESEARCH.md Pitfall 6 (orchestrator-owns-rendering -- option (b) is BLOCKED by D-11 BLOCK C) + D-14-08 (LOCKED narrow per-rule scoping) + D-14-09 (LOCKED meta vs full split now wires).
Output: WARNING-level audit closures complete; 34 rules active in eslint.config.js; milestone-close commit.
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
- Existing function (verify the export -- likely `renderRollbackPartial(parentRow, partials, probe?)` or similar). If a "bare children" helper doesn't exist, ADD one -- a helper that takes `readonly RollbackPartialEntry[]` and returns the indented children block:
  ```
  // Suggested: `composeRollbackPartialChildren(partials: readonly RollbackPartialEntry[]): string` returning the indented children string (without the parent row). Orchestrators stitch this under their own parent row context.
  ```
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

From RESEARCH.md Pattern 4 (eslint.config.js per-rule wiring template -- verbatim worked example with 5 blocks):
- Block 1: MSG-SR-1..6 → `files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"]`
- Block 2: MSG-SR-7 + MSG-NC-2 → `files: ["extensions/pi-claude-marketplace/edge/handlers/**/*.ts"]`
- Block 3: MSG-LC-1..2 → `files: ["extensions/pi-claude-marketplace/persistence/migrate.ts"]`
- Block 4: MSG-MR-1..2, MSG-RP-1, MSG-CC-1, MSG-RH-1 → `files: ["extensions/pi-claude-marketplace/**/*.ts"]` + `ignores: [composer files]` (Pitfall 9)
- Block 5: meta-assertion rules → `files: ["extensions/pi-claude-marketplace/**/*.ts"]`

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
    2. If not, ADD a small exported helper:
       - Function name: `composeRollbackPartialChildren(partials: readonly RollbackPartialEntry[]): string` (or equivalent -- pick a name consistent with the existing module's conventions).
       - Body: maps each partial to `  [${p.phase}] (rollback failed) {rollback partial}` (2-space indent + RowSpec-style compact line) and joins with `\n`.
       - This helper produces text byte-equal to the OLD `childLines` in transaction/rollback.ts:58-60 -- preserves the catalog UAT byte-binding.

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
  <name>Task 2: Wire 34 MSG-* rules in eslint.config.js with per-rule files: + composer-file ignores</name>
  <files>eslint.config.js</files>
  <read_first>
    - eslint.config.js (the full current file -- focus on the existing flat-config block layout, BLOCK A/B/C/D/E patterns, and where to insert the new msg-plugin blocks)
    - tests/lint-rules/index.js (after Plan 05 -- exports default plugin with all 34 rules; this plan imports it)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 4 (verbatim per-rule wiring template with 5 blocks)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pitfall 9 (composer-file `ignores:` arrays)
    - .planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md D-14-08 (LOCKED narrow per-rule scoping)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Plan Decomposition Plan 3d (the rule families + their `files:` scopes -- examples in the prompt's section 11)
  </read_first>
  <action>
    Implement D-14-08 (LOCKED) per RESEARCH.md Pattern 4 + Pitfall 9: register all 34 MSG-* rules under per-rule `files:` patterns in `eslint.config.js`.

    1. **Add the plugin import at the top of eslint.config.js**:
       ```
       import msgPlugin from "./tests/lint-rules/index.js";
       ```
       (placed alongside the existing plugin imports -- typescript-eslint, stylistic, import-x, etc.)

    2. **Add 5 (or 6) flat-config blocks** at an appropriate position in the file (after BLOCK B sanctioned-syntax-disables for shared/notify.ts and persistence/migrate.ts; before or after BLOCK C path-import zones is acceptable -- locality with the existing per-file overrides is preferred). Each block follows RESEARCH.md Pattern 4 verbatim with appropriate `files:` and `ignores:`:

       **Block: MSG-SR-1..6 (cascade-routing rules -- orchestrators surface)**
       - `files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"]`
       - `plugins: { msg: msgPlugin }`
       - `rules:` 6 entries -- `"msg/msg-sr-1-success-routing": "error"` through `"msg/msg-sr-6-no-cascade-error": "error"` (use the exact rule slugs from RULE_NAMES -- match Task 3's chosen slug names from Plan 05).

       **Block: MSG-SR-7 + MSG-NC-2 (usage-error edge surface)**
       - `files: ["extensions/pi-claude-marketplace/edge/handlers/**/*.ts"]`
       - `plugins: { msg: msgPlugin }`
       - `rules: { "msg/msg-sr-7-usage-error-routing": "error", "msg/msg-nc-2-usage-separator": "error" }`

       **Block: MSG-LC-1..2 (console.warn discipline -- narrowest scope)**
       - `files: ["extensions/pi-claude-marketplace/persistence/migrate.ts"]`
       - `plugins: { msg: msgPlugin }`
       - `rules: { "msg/msg-lc-1-console-warn-form": "error", "msg/msg-lc-2-eslint-discipline": "error" }`

       **Block: MSG-MR-1..2, MSG-RP-1, MSG-CC-1, MSG-RH-1 (composer-chokepoint rules)**
       - `files: ["extensions/pi-claude-marketplace/**/*.ts"]`
       - `ignores: ["extensions/pi-claude-marketplace/presentation/manual-recovery.ts", "extensions/pi-claude-marketplace/presentation/rollback-partial.ts", "extensions/pi-claude-marketplace/presentation/cause-chain.ts", "extensions/pi-claude-marketplace/presentation/reload-hint.ts", "extensions/pi-claude-marketplace/shared/errors.ts"]` (the last for cause-chain-related literals in shared/errors.ts -- RESEARCH.md Pitfall 9)
       - `plugins: { msg: msgPlugin }`
       - `rules:` 5 entries -- `"msg/msg-mr-1-manual-recovery-anchor": "error"` through `"msg/msg-rh-1-reload-hint": "error"`

       **Block: MSG-NC-1 + MSG-SD-1..2 (presentation-renderer chokepoint rules)**
       - `files: ["extensions/pi-claude-marketplace/**/*.ts"]`
       - `ignores: ["extensions/pi-claude-marketplace/presentation/compact-line.ts"]` (NC-1 + SD-1..2 detect renderer literals -- the renderer itself is the canonical owner)
       - `plugins: { msg: msgPlugin }`
       - `rules: { "msg/msg-nc-1-entity-error": "error", "msg/msg-sd-1-soft-dep-reason": "error", "msg/msg-sd-2-soft-dep-predicate": "error" }`

       **Block: All structural meta-assertion rules + MSG-SD-3 + MSG-ER-1 (globally enabled)**
       - `files: ["extensions/pi-claude-marketplace/**/*.ts"]`
       - `plugins: { msg: msgPlugin }`
       - `rules:` 16-19 entries -- all meta-assertion rules from Plan 04 (MSG-GR-1..5, MSG-IC-1..3, MSG-SD-3, MSG-PL-1..6, MSG-ER-1)

    3. **Verify the total registered count equals 34**: count the per-rule registrations across all the new blocks. Sum: 6 + 2 + 2 + 5 + 3 + 16 = 34. (Adjust the meta-assertion block if the count from Plan 04 was 19 not 16 -- sum still must be 34.)

    4. **Avoid double-registration**: each rule name appears in EXACTLY ONE block -- `files:` patterns may overlap, but the rule name itself must not be registered in two blocks (would produce conflicting severity settings). Cross-check this when assembling the blocks.

    5. **Verify the BLOCK D / E (existing overrides) compatibility**: the new blocks must not conflict with the existing `eslint.config.js` self-override (line ~316) or any other per-file override. Insert the new blocks at a position consistent with the existing flat-config conventions (after BLOCK B, before the existing self-override block).

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
      # All 34 rules registered:
      grep -oE '"msg/msg-[a-z]+-[0-9]+-[a-z0-9-]+"' eslint.config.js | sort -u | wc -l
      # Expect: 34
      # No duplicate registration:
      grep -oE '"msg/msg-[a-z]+-[0-9]+-[a-z0-9-]+"' eslint.config.js | sort | uniq -c | awk '$1 > 1 { print "DUP:", $2 }' | head
      # Expect: empty (no duplicate rules)
      # Composer-file ignores present:
      grep -c 'presentation/manual-recovery.ts' eslint.config.js
      grep -c 'presentation/rollback-partial.ts' eslint.config.js
      grep -c 'presentation/cause-chain.ts' eslint.config.js
      grep -c 'presentation/reload-hint.ts' eslint.config.js
      # Each: expect ≥1
      # Registry test now passes assertion (c):
      node --test tests/architecture/msg-rule-registry.test.ts 2>&1 | tail -10
      # Expect: all 4 assertions pass
      # Full milestone-close check:
      npm run check 2>&1 | tail -15
      # Expect: SUCCESS -- v1.3 milestone close
    </automated>
  </verify>
  <done>
    1. `eslint.config.js` imports the local plugin via `import msgPlugin from "./tests/lint-rules/index.js";`.
    2. All 34 MSG-* rules are registered via `"msg/<name>": "error"` entries across 5-6 flat-config blocks with appropriate `files:` patterns + composer-file `ignores:`.
    3. No rule is registered twice (each name in exactly one block).
    4. The registry parity test from Plan 05 now passes assertion (c).
    5. `npm run check` is GREEN -- Plan 06 milestone gate satisfied + the v1.3 milestone close.
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
| T-14-10 | Tampering | eslint.config.js per-rule registration | mitigate | The registry parity test from Plan 05 enforces 1:1 between RULE_NAMES and eslint.config.js registrations; missing or extra registrations fail the test on the next `npm run check`. |
| T-14-11 | DoS | All 34 ESLint rules running on every npm run lint | accept | Meta-assertion rules with `Program: () => {}` visitors have negligible runtime cost (one function call per file). Full-impl rules visit specific AST node types -- bounded cost. Lint runtime is dominated by typescript-eslint type-aware analysis already in scope. |
</threat_model>

<verification>
- `transaction/rollback.ts` no longer composes the user-visible `(failed) {rollback partial}` body; returns `RollbackErrorResult` structured value.
- `transaction/rollback.ts` does NOT import from `presentation/` (BLOCK C compliance -- Pitfall 6).
- `presentation/rollback-partial.ts` exposes a children-composition helper for the orchestrator side.
- `tests/transaction/rollback.test.ts` updated; passes.
- `tests/architecture/catalog-uat.test.ts` still passes (byte-binding preserved).
- `eslint.config.js` imports the local plugin + registers all 34 rules with per-rule `files:` patterns + composer-file `ignores:`.
- `tests/architecture/msg-rule-registry.test.ts` passes ALL 4 assertions (including (c)).
- `npm run check` is GREEN -- v1.3 milestone close commit.
</verification>

<success_criteria>
1. WARNING-level audit closure: `transaction/rollback.ts` hand-composed literal gone; MSG-RP-1 rule fires only on planted-violation tests, not on legitimate code.
2. All 34 MSG-* drift-guard rules are active in `npm run lint`.
3. Registry parity test passes -- 1:1 across style-guide body ↔ rule files ↔ plugin module ↔ eslint.config.js.
4. v1.3 milestone-close commit: `npm run check` green; CMC-16 / CMC-34 / CMC-38 all addressed (Plans 01/02/03/04/05/06).
5. Phase 14 success criteria #1 through #5 from ROADMAP.md all structurally satisfied:
   - SC #1 (planted violation makes npm run check fail with locatable error) -- every full-impl rule's `invalid:` case proves this.
   - SC #2 (failure includes MSG-* rule ID) -- every rule's `messageId` text contains the ID literal.
   - SC #3 (frontmatter is sole source of truth) -- loader + 4-key set-equality + body-scan registry test.
   - SC #4 (`npm run check` green after Phase 13 + 14) -- gate confirmed.
   - SC #5 (38/38 v1.3 coverage) -- REQUIREMENTS.md update to mark CMC-16/CMC-34/CMC-38 as Complete is part of the milestone-close commit (handled by a follow-up command, NOT this plan).
</success_criteria>

<output>
Create `.planning/phases/14-drift-guard-test-alignment/14-06-SUMMARY.md` when done.
</output>
