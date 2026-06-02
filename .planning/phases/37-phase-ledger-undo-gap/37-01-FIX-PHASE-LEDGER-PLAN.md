---
phase: 37-phase-ledger-undo-gap
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/transaction/phase-ledger.ts
  - tests/transaction/phase-ledger.test.ts
autonomous: true
requirements:
  - TR-02
requirements_addressed:
  - TR-02
tags:
  - transaction
  - phase-ledger
  - saga
  - rollback

must_haves:
  truths:
    - "When phase.do(ctx) throws inside runPhases, the failing phase's own undo (if defined) runs exactly once from the catch block BEFORE rollbackExecuted walks executed[] in reverse (per D-01/SC#1, TR-02)."
    - "executed[] never contains the failing phase, so the reverse walk cannot double-invoke the failing phase's undo (Pitfall 2 over-correction guard, TR-02)."
    - "PathContainmentError thrown from the failing phase's own undo re-throws immediately at the new catch-block call site, never folded into a RollbackPartial row (per PI-14, SC#3, mirroring phase-ledger.ts:84-86)."
    - "When the failing phase's own undo throws a non-PathContainmentError, its RollbackPartial appears at index 0 of rollbackPartials[], with the reverse-walk partials at indices 1..N-1 (newest-first per AS-4 / MSG-RP-1, SC#4 ordering)."
    - "When the failing phase has no undo property (e.g. statePhase in install.ts), the new call site is a graceful no-op and behavior remains byte-identical to the pre-fix path (preserves the 9 existing phase-ledger tests, SC#5)."
    - "Phase<C>.undo JSDoc on the interface declaration documents that undo MUST tolerate being called after a partial-do throw and cannot assume do ran to completion (SC#2 contract documentation, Pitfall 4 guard)."
    - "runPhases still never throws on its own; only PathContainmentError from any undo (failing-phase or reverse-walk) escapes -- the line-109 contract is preserved."
    - "npm run check is GREEN: typecheck + ESLint + Prettier + the full test suite pass (SC#5 regression preservation)."
  artifacts:
    - path: "extensions/pi-claude-marketplace/transaction/phase-ledger.ts"
      provides: "runPhases catch-block restructure invoking failing-phase undo before rollbackExecuted; Phase<C>.undo JSDoc amended"
      contains: "PathContainmentError"
    - path: "tests/transaction/phase-ledger.test.ts"
      provides: "Three new regression tests appended (TR-02 sequence, PI-14 failing-phase-undo re-throw, AS-4 newest-first ordering)"
      contains: "TR-02 runPhases"
  key_links:
    - from: "extensions/pi-claude-marketplace/transaction/phase-ledger.ts"
      to: "extensions/pi-claude-marketplace/shared/path-safety.ts"
      via: "PathContainmentError re-throw at the new failing-phase undo catch site (mirroring the existing site at lines 84-86)"
      pattern: "PathContainmentError"
    - from: "tests/transaction/phase-ledger.test.ts"
      to: "extensions/pi-claude-marketplace/transaction/phase-ledger.ts"
      via: "runPhases import from ../../extensions/pi-claude-marketplace/transaction/phase-ledger.ts (existing import on line 5-8)"
      pattern: "runPhases"
    - from: "extensions/pi-claude-marketplace/shared/notify.ts (line 1343)"
      to: "RollbackPartial[] ordering produced by runPhases"
      via: "renderer walks rollbackPartial[] top-down -- failing-phase partial at index 0 reads as 'most recent first'"
      pattern: "for \\(const phase of p\\.rollbackPartial\\)"
---

<objective>
Close TR-02 (Phase-Ledger Undo Gap) by restructuring the `runPhases` catch block
in `extensions/pi-claude-marketplace/transaction/phase-ledger.ts` so the failing
phase's own `undo` is invoked exactly once -- as a SEPARATE catch-block call site
BEFORE `rollbackExecuted(executed, ctx)` -- with `PathContainmentError` re-throw
discipline mirroring the existing site at lines 84-86 and the failing-phase
RollbackPartial prepended to the reverse-walk partials (newest-first per AS-4 /
MSG-RP-1). Amend the `Phase<C>.undo` JSDoc on the interface declaration to
document the new "tolerate partial-do throw" contract. Append three regression
tests to `tests/transaction/phase-ledger.test.ts` covering SC#1/SC#4 sequence,
SC#3 PathContainmentError re-throw, and AS-4 newest-first ordering.

Purpose: Today the failing phase never gets its own `undo` called because
`executed.push(phase)` runs AFTER `await phase.do(ctx)` returns; a partial-do
throw aborts the push, the reverse walk sees only fully-succeeded phases, and any
partial side effects laid down by the failing phase's `do` leak. The fix gives
the failing phase its compensation invocation (per saga-literature "started ->
eligible for compensation") without introducing the over-correction trap (Pitfall
2: pushing the failing phase onto `executed[]` before `await` would
double-rollback when combined with the separate catch-block call). The
discipline is structural, not infrastructural -- no new dependencies, no new
files, no new helpers required (per RESEARCH "Don't Hand-Roll" verdict).

Output: One source file modified (~12-line catch-block restructure + ~5-line
JSDoc amendment), one test file appended (three new tests using existing helpers
`noopAsync`, `throwAsync`, `TraceCtx`). Zero new dependencies, zero new files.
</objective>

<execution_context>
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/37-phase-ledger-undo-gap/37-CONTEXT.md
@.planning/phases/37-phase-ledger-undo-gap/37-RESEARCH.md
@.planning/phases/37-phase-ledger-undo-gap/37-VALIDATION.md
@.planning/research/PITFALLS.md
@extensions/pi-claude-marketplace/transaction/phase-ledger.ts
@extensions/pi-claude-marketplace/shared/path-safety.ts
@extensions/pi-claude-marketplace/shared/errors.ts
@tests/transaction/phase-ledger.test.ts
@CLAUDE.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Append three TR-02 regression tests to phase-ledger.test.ts (RED gate)</name>
  <files>tests/transaction/phase-ledger.test.ts</files>
  <read_first>
    - tests/transaction/phase-ledger.test.ts (READ IN FULL, lines 1-308) -- mirror the existing test style: top-of-file imports on lines 1-8, TraceCtx interface on lines 25-27, noopAsync / throwAsync helpers on lines 38-41, D-01 reverse-order trace test pattern on lines 43-85, AS-4 multi-failure pattern on lines 115-144, PI-14 re-throw pattern on lines 146-163, 260525-cjr non-Error pattern on lines 289-307. Reuse helpers; do NOT redeclare them.
    - extensions/pi-claude-marketplace/transaction/phase-ledger.ts (lines 70-141) -- understand the existing rollbackExecuted shape so the new tests align with the post-fix RollbackPartial ordering and PathContainmentError re-throw contract.
    - .planning/phases/37-phase-ledger-undo-gap/37-RESEARCH.md "Required new regression test" subsections (~lines 522-606) -- the three tests are sketched there verbatim; the implementer adapts naming/imports to match the existing test file's conventions.
    - .planning/phases/37-phase-ledger-undo-gap/37-VALIDATION.md "Per-Task Verification Map" table (lines 39-45) -- five verifications 37-01-01..37-01-05; this task lands the test-side proofs for 37-01-01 (sequence), 37-01-02 (no double rollback, asserted as exact-once via deepEqual), 37-01-03 (PathContainmentError re-throw).
  </read_first>
  <behavior>
    - Test 1 "TR-02 runPhases: failing-phase undo runs BEFORE reverse-walk, exactly once each" -- 3-phase ledger [p0, p1, p2] where ALL THREE define do AND undo arms that each push a string to ctx.trace (TraceCtx). p2.do pushes "do:p2" then throws Error("boom"). Assert result.ok === false, result.error?.message === "boom", and assert.deepEqual on ctx.trace exactly equals ["do:p0", "do:p1", "do:p2", "undo:p2", "undo:p1", "undo:p0"] (failing-phase undo FIRST in catch block, then reverse walk over executed = [p0, p1]). Also assert result.rollbackPartials.length === 0 (no undo threw so no partials).
    - Test 2 "PI-14 runPhases: PathContainmentError from FAILING phase's own undo is RE-THROWN" -- 2-phase ledger [p1, p2]. p1: noopAsync do, noopAsync undo. p2: do throws Error("boom"); undo rejects with new PathContainmentError("/parent", "/parent/../escape", "p2 undo"). Use `await assert.rejects(() => runPhases(phases, {}), (err: unknown) => err instanceof PathContainmentError)`. This test exercises the NEW failing-phase undo call site; the existing PI-14 test at lines 146-163 exercises the reverse-walk call site at lines 84-86 (do NOT modify the existing test).
    - Test 3 "AS-4 runPhases: failing-phase undo failure is FIRST in rollbackPartials[]" -- 3-phase ledger [p0, p1, p2] where ALL THREE undo arms throw distinct errors ("p0 undo failed", "p1 undo failed", "p2 undo failed"); p2.do throws Error("boom"). Use noopAsync for p0/p1 do; p2.do uses throwAsync("boom"). Assert result.ok === false, result.error?.message === "boom", result.rollbackPartials.length === 3, result.rollbackPartials[0]?.phase === "p2", result.rollbackPartials[0]?.msg === "p2 undo failed", result.rollbackPartials[1]?.phase === "p1", result.rollbackPartials[1]?.msg === "p1 undo failed", result.rollbackPartials[2]?.phase === "p0", result.rollbackPartials[2]?.msg === "p0 undo failed". Also assert each partial.cause instanceof Error.
  </behavior>
  <action>
    Append the three new tests to the END of tests/transaction/phase-ledger.test.ts (after line 307, after the existing "260525-cjr C1: undo throw of a non-Error" test).

    Style discipline (mirror existing file conventions verified at lines 1-308):
    - Test name string MUST start with "TR-02 runPhases:" or "PI-14 runPhases:" or "AS-4 runPhases:" (matches the prefix convention used by lines 43, 115, 146, 260).
    - Use the existing TraceCtx interface (line 25) for Test 1; use `Phase<object>[]` and `runPhases(phases, {})` for Tests 2-3 (matches lines 88, 99, 147, 159).
    - Reuse `noopAsync` (line 38) and `throwAsync(msg)` (line 39) helpers verbatim; do NOT redeclare.
    - Test 1 phase array element style mirrors lines 45-79: `{ name: "p0", do: (c) => { c.trace.push("do:p0"); return Promise.resolve(); }, undo: (c) => { c.trace.push("undo:p0"); return Promise.resolve(); } }`. For p2's throwing do, write inline: `do: (c) => { c.trace.push("do:p2"); throw new Error("boom"); }` -- mirrors the throw-after-side-effect shape (the existing tests use throwAsync without side effects, so this inline shape is the new pattern for the side-effect-then-throw case).
    - Test 2: use `Phase<object>[]`; for p2.undo use `() => Promise.reject(new PathContainmentError("/parent", "/parent/../escape", "p2 undo"))` -- mirrors line 152.
    - Test 3: use `Phase<object>[]`; for each phase use `undo: throwAsync("...")` -- mirrors line 92, 120, 125.
    - Imports: the file already imports `PathContainmentError`, `runPhases`, and `type Phase` on lines 4-8; do NOT add or modify imports.
    - Place a single horizontal-rule block-comment divider (mirroring lines 253-258 style: lines of `// ─` box-drawing-dash characters) BEFORE the three new tests with the heading: "Phase 37 / TR-02: failing-phase own-undo invocation (separate catch-block call site)". Keep the block comment to 4-6 lines including the dividers; no fenced code blocks.

    This task is the RED gate: the three new tests MUST FAIL against the current `runPhases` implementation (Test 1's deepEqual fails because trace lacks "undo:p2"; Test 2's assert.rejects fails because no PathContainmentError is thrown -- the result returns ok:false with empty partials and the original "boom" error; Test 3's length assertion fails because rollbackPartials.length === 2 not 3). Confirm RED by running the test command in <verify> below before committing.

    Commit message (Conventional Commits, <=72 char title, body <=80 char/line):
      `test(transaction): add TR-02 failing-phase undo regression tests`

      Body should reference Phase 37 / TR-02 and note the tests are expected RED
      until the runPhases catch block is restructured in Task 2.

    Pre-commit discipline (per CLAUDE.md):
    - Run `pre-commit run --files tests/transaction/phase-ledger.test.ts` BEFORE `git commit`.
    - If hooks rewrite the file (em-dash normalization, prettier), re-stage the changed file and re-run `pre-commit run` until clean.
    - Do NOT use `--no-verify`. Do NOT amend the previous commit on hook failure -- a failed pre-commit means the commit did NOT happen.
  </action>
  <verify>
    <automated>cd /Users/acolomba/src/pi-claude-marketplace && node --test tests/transaction/phase-ledger.test.ts 2>&1 | grep -E "^(ok|not ok|# tests|# pass|# fail)" | tail -20</automated>
    Expected output BEFORE running this task: 9 tests pass (existing tests).
    Expected output AFTER running this task (RED gate): 9 existing pass, 3 new fail with at least one failure mentioning "TR-02 runPhases: failing-phase undo" (sequence mismatch in ctx.trace), one mentioning "PI-14 runPhases: PathContainmentError from FAILING" (assert.rejects expectation failed because runPhases returned instead of threw), and one mentioning "AS-4 runPhases: failing-phase undo failure is FIRST" (rollbackPartials.length actual 2 expected 3).
    Additional static check: `grep -c "TR-02 runPhases:" tests/transaction/phase-ledger.test.ts` returns 1; `grep -c "PI-14 runPhases: PathContainmentError from FAILING" tests/transaction/phase-ledger.test.ts` returns 1; `grep -c "AS-4 runPhases: failing-phase undo failure is FIRST" tests/transaction/phase-ledger.test.ts` returns 1.
  </verify>
  <done>
    All three new tests are appended to tests/transaction/phase-ledger.test.ts after line 307. The existing 9 tests are byte-unchanged (verify with `git diff -U0 tests/transaction/phase-ledger.test.ts | grep -E "^-[^-]" | wc -l` -- the count of removed non-divider lines is 0 except possibly trailing whitespace normalized by prettier). Running `node --test tests/transaction/phase-ledger.test.ts` shows 9 pass + 3 fail (RED). The test file is committed in a single Conventional Commits commit with title `test(transaction): add TR-02 failing-phase undo regression tests`.
  </done>
  <acceptance_criteria>
    - [ ] Test file contains exactly three new tests with names starting "TR-02 runPhases:", "PI-14 runPhases: PathContainmentError from FAILING", and "AS-4 runPhases: failing-phase undo failure is FIRST".
    - [ ] Grep returns the three expected counts: `grep -c "TR-02 runPhases:" tests/transaction/phase-ledger.test.ts` -> 1; `grep -c "PI-14 runPhases: PathContainmentError from FAILING" tests/transaction/phase-ledger.test.ts` -> 1; `grep -c "AS-4 runPhases: failing-phase undo failure is FIRST" tests/transaction/phase-ledger.test.ts` -> 1.
    - [ ] `node --test tests/transaction/phase-ledger.test.ts` reports 12 tests total (9 pass + 3 fail) -- the RED gate is satisfied.
    - [ ] The 9 existing tests are byte-unchanged outside whitespace normalization: `git diff -U0 HEAD~1 -- tests/transaction/phase-ledger.test.ts | grep -E "^-[^-]" | wc -l` reports 0 (or only trailing-whitespace lines normalized by prettier).
    - [ ] `pre-commit run --files tests/transaction/phase-ledger.test.ts` exits 0 after up to one re-stage cycle.
    - [ ] Single commit with title `test(transaction): add TR-02 failing-phase undo regression tests` (verify with `git log -1 --pretty=%s` matches the expected title and is <=72 chars).
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Restructure runPhases catch block to invoke failing-phase undo first; amend Phase<C>.undo JSDoc (GREEN gate)</name>
  <files>extensions/pi-claude-marketplace/transaction/phase-ledger.ts</files>
  <read_first>
    - extensions/pi-claude-marketplace/transaction/phase-ledger.ts (READ IN FULL, lines 1-141) -- the file is small enough to hold in context. Key surfaces: the file-header comment block on lines 1-21 (PI-14 + AS-4 / MSG-RP-1 contracts -- do NOT modify), the `Phase<C>` interface on lines 26-34 (JSDoc on lines 26-29 will be amended in this task), the `RollbackPartial` interface on lines 36-55 (do NOT modify), the `RunPhasesResult` interface on lines 57-68 (do NOT modify), the `rollbackExecuted` helper on lines 70-102 (do NOT modify -- the new failing-phase catch-block logic mirrors the inner try/catch on lines 81-98), the `runPhases` JSDoc on lines 104-118 (do NOT modify -- "never throws on its own" + "PathContainmentError re-throw" contract is preserved), the `runPhases` body on lines 120-141 (THIS is the fix site -- restructure the catch block at lines 126-137).
    - extensions/pi-claude-marketplace/shared/path-safety.ts (lines 1-40, the PathContainmentError class declaration) -- confirm the import on line 24 of phase-ledger.ts is sufficient; no new imports required.
    - extensions/pi-claude-marketplace/shared/errors.ts -- confirm `errorMessage(err)` is the existing helper used at line 95 of phase-ledger.ts; reuse it in the new call site without modification.
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts (lines 463-600) -- verify (per RESEARCH Assumption A2) that all four bridge consumer phases (skillsPhase, commandsPhase, agentsPhase, mcpPhase) gate undo on `if (c.<bridge>Prep === undefined) return;`. The post-fix runPhases will invoke these undo arms after a partial-do throw; the existing gates make them tolerant (no orchestrator-side change needed).
    - .planning/phases/37-phase-ledger-undo-gap/37-RESEARCH.md "Pattern 1: Failing-phase own-undo invocation" subsection (~lines 189-261) -- the post-fix runPhases shape is sketched there. Inline the try/catch directly in `runPhases` per RESEARCH Open Question 1 recommendation ("Inline. The catch block grows by ~12 lines; the file stays <160 lines; the structural invariant ('two call sites in the catch') is more obvious when both are visible at the call site.").
    - .planning/research/PITFALLS.md lines 146-227 (Pitfall 2: phase-ledger undo includes the failing phase, TR-02 over-correction) -- read in full for the over-correction guard rationale.
    - tests/transaction/phase-ledger.test.ts (post-Task-1 state, all 12 tests including the 3 new TR-02 ones) -- the 3 new tests are the GREEN gate.
  </read_first>
  <behavior>
    - After this task lands, `node --test tests/transaction/phase-ledger.test.ts` reports 12/12 GREEN (the 9 existing tests still pass per SC#5; the 3 new TR-02 tests added in Task 1 now pass per SC#1/SC#3/SC#4).
    - `runPhases` still NEVER throws on its own (line-109 contract preserved): only PathContainmentError from any undo (failing-phase OR reverse-walk) escapes.
    - executed[] never contains the failing phase: the `executed.push(phase)` statement stays AFTER `await phase.do(ctx)` (current line 125 position is correct; do NOT move it before the await).
    - The failing-phase undo invocation is a SEPARATE, visually-distinct call site in the catch block, placed BEFORE `rollbackExecuted(executed, ctx)`.
    - PathContainmentError from the failing-phase undo re-throws immediately, mirroring the rollbackExecuted inner catch at lines 84-86 EXACTLY (do NOT silently capture into RollbackPartial).
    - Non-PathContainmentError thrown from the failing-phase undo is captured into a RollbackPartial with shape `{ phase: phase.name, msg: errorMessage(undoErr), ...(undoErr instanceof Error && { cause: undoErr }) }` -- byte-identical to the existing rollbackExecuted push shape on lines 93-97.
    - When the failing-phase undo throws a non-PathContainmentError, the resulting RollbackPartial is PREPENDED to the reverse-walk partials: final shape `[failingPartial, ...reversePartials]` (newest-first per AS-4 / MSG-RP-1). When the failing-phase undo succeeds OR phase.undo is undefined, the result is just `reversePartials`.
    - Phase<C>.undo JSDoc on lines 26-29 of the interface declaration is amended in place to document the "tolerate partial-do throw" contract (SC#2). Per RESEARCH Open Question 2 recommendation, replace the existing sentence "`undo` (optional) is invoked in reverse order if a later phase throws." with one that documents BOTH the reverse-walk case AND the failing-phase own-undo case AND the new contract. The amendment MUST include the substring tokens `tolerate` and `partial-do` so the static grep check in 37-VALIDATION.md (`grep -E "tolerate|partial-do|ENOENT" extensions/pi-claude-marketplace/transaction/phase-ledger.ts`) finds them in this file.
    - `npm run check` exits 0 (typecheck + ESLint + Prettier + full test suite GREEN; SC#5).
  </behavior>
  <action>
    Modify extensions/pi-claude-marketplace/transaction/phase-ledger.ts in TWO non-overlapping regions, in a single atomic commit:

    Region 1 -- Phase<C>.undo JSDoc amendment (lines 26-29):
    - Replace the existing JSDoc block on lines 26-29 with an amended JSDoc that documents both call sites (reverse-walk over executed[] AND failing-phase own-undo in the catch block) and the new contract.
    - The amended JSDoc MUST contain the words `tolerate` and `partial-do` (both lowercase, exact substring match) somewhere in its body so the static grep check in 37-VALIDATION.md row 37-01-04 passes.
    - The amended JSDoc SHOULD also reference the established convention used by the install.ts bridge consumer phases (the `if (c.<bridge>Prep === undefined) return;` gate at install.ts:481-492, :514-523, :560-572, :590-600) WITHOUT inlining install.ts code. Cite by file:line only.
    - Keep the JSDoc style consistent with the rest of the file (JSDoc block comment opening `/**`, ` *` continuation lines, closing ` */`). Per RESEARCH Open Question 2 recommendation, amend the single interface-level JSDoc in place rather than adding a field-level JSDoc above the `undo` declaration.
    - The amendment should be ~5 lines total including the existing two sentences -- DO NOT write a multi-paragraph essay. Keep it referential.

    Region 2 -- runPhases catch block restructure (lines 120-141):
    - Keep the function signature on line 120 unchanged.
    - Keep the local `executed: Phase<C>[] = []` declaration on line 121 unchanged.
    - Keep the `for (const phase of phases)` loop on line 122 unchanged.
    - Inside the try block: keep `await phase.do(ctx)` on line 124 and `executed.push(phase)` on line 125 unchanged -- the push MUST stay AFTER the await (per Pitfall 2 over-correction guard).
    - Inside the catch block (currently lines 126-137): restructure as follows:
      1. Capture `const original = err instanceof Error ? err : new Error(String(err));` (current line 127, unchanged).
      2. NEW: declare `let failingPartial: RollbackPartial | undefined`. If `phase.undo !== undefined`, run an inline try/catch invoking `await phase.undo(ctx)`. In the catch: `if (undoErr instanceof PathContainmentError) { throw undoErr; }` (mirroring lines 84-86 byte-for-byte). Otherwise assign `failingPartial = { phase: phase.name, msg: errorMessage(undoErr), ...(undoErr instanceof Error && { cause: undoErr }) }` (mirroring lines 93-97 byte-for-byte). If `phase.undo === undefined`, leave `failingPartial` undefined.
      3. NEW: const `reversePartials = await rollbackExecuted(executed, ctx)` (replacing current line 129).
      4. NEW: const `rollbackPartials: RollbackPartial[] = failingPartial === undefined ? reversePartials : [failingPartial, ...reversePartials]` -- the prepend is the AS-4 / MSG-RP-1 newest-first ordering. Use exactly this shape (do NOT use Array.prototype.unshift on a mutable array; use the explicit conditional + spread for readability and to make the intent visually obvious).
      5. Return shape unchanged: `return { ok: false, error: original, rollbackPartials, leaks: [] };` (the property name `rollbackPartials` matches the local variable name via shorthand; explicit `rollbackPartials: rollbackPartials` is also acceptable -- match the style of the existing return on lines 131-136).
    - The success exit on line 140 `return { ok: true, rollbackPartials: [], leaks: [] };` is unchanged.
    - Inline the failing-phase undo try/catch directly in the catch block (DO NOT extract a helper function like `invokeFailingPhaseUndo` -- per RESEARCH Open Question 1 recommendation, inlining keeps the file <160 lines and the structural invariant ("two call sites in the catch") visually obvious).

    Style discipline:
    - Use 2-space indentation matching the file's existing style (verified at lines 70-101).
    - Trailing semicolons (project convention via prettier).
    - DO NOT add any inline comments INSIDE the new catch-block code beyond what is necessary; the structural intent should be readable from the variable names. A single brief comment above the NEW failing-phase undo block (e.g. `// Failing phase's own undo runs FIRST -- separate call site from the reverse walk below (TR-02 / saga "started -> eligible for compensation"). PathContainmentError still re-throws (PI-14, mirroring lines 84-86).`) IS welcome and matches the file's existing comment density (cf. lines 86-92, 128-129).
    - The post-fix `runPhases` function body should stay <=35 lines total. The whole file should stay <=160 lines.

    Verification gate (before commit):
    - Run `node --test tests/transaction/phase-ledger.test.ts`; all 12 tests MUST pass (9 existing + 3 new TR-02). If any FAIL, fix the implementation -- do NOT modify the tests.
    - Run `npm run typecheck`; MUST exit 0 (strict-mode TypeScript verifies Phase<C> generic interface and discriminated rollback result shape; the JSDoc amendment is type-checked).
    - Run `npm run lint`; MUST exit 0 (ESLint flat config).
    - Run `npm run check`; MUST exit 0 end-to-end (this is the SC#5 phase gate).

    Commit message (Conventional Commits, <=72 char title, body <=80 char/line):
      `fix(transaction): invoke failing-phase undo in runPhases catch`

      Body should reference Phase 37 / TR-02, summarize the structural fix
      (failing-phase undo as separate catch-block call site before reverse walk;
      PathContainmentError re-throw discipline preserved; failing-phase
      RollbackPartial prepended for newest-first ordering), cite the Phase<C>.undo
      JSDoc amendment for the documented "tolerate partial-do throw" contract,
      and note that all 12 phase-ledger tests are GREEN plus `npm run check` is
      GREEN. Reference D-01 / AS-4 / PI-14 contracts as preserved.

    Pre-commit discipline (per CLAUDE.md):
    - Run `pre-commit run --files extensions/pi-claude-marketplace/transaction/phase-ledger.ts` BEFORE `git commit`.
    - If hooks rewrite the file (em-dash -> --, prettier reformat), re-stage and re-run `pre-commit run` until clean.
    - Do NOT use `--no-verify`. Do NOT amend if hooks fail.

    Branch discipline (per CLAUDE.md):
    - NEVER commit to main; verify with `git branch --show-current` returns a `features/*` branch before commit (the current branch is `features/transaction-resilience-hardening`).
  </action>
  <verify>
    <automated>cd /Users/acolomba/src/pi-claude-marketplace && node --test tests/transaction/phase-ledger.test.ts 2>&1 | grep -E "^# (tests|pass|fail)" | head -5 && grep -cE "tolerate|partial-do" extensions/pi-claude-marketplace/transaction/phase-ledger.ts</automated>
    Expected output: `# tests 12`, `# pass 12`, `# fail 0`, and a grep count >= 2 (the JSDoc contains both "tolerate" and "partial-do").
    Additional check: `cd /Users/acolomba/src/pi-claude-marketplace && npm run check` exits 0 end-to-end (typecheck + ESLint + Prettier + full test suite GREEN per SC#5).
    Static structural check: `grep -nE "executed\\.push\\(phase\\)" extensions/pi-claude-marketplace/transaction/phase-ledger.ts` returns exactly one match, and that match's line number is AFTER the `await phase.do(ctx)` line (confirm by reading lines around the match). This locks the Pitfall 2 over-correction guard: executed[] never contains the failing phase.
    File-size sanity check: `wc -l extensions/pi-claude-marketplace/transaction/phase-ledger.ts` reports <=160 lines.
  </verify>
  <done>
    The runPhases catch block invokes the failing phase's own undo as a SEPARATE call site BEFORE rollbackExecuted, with PathContainmentError re-throw discipline mirroring lines 84-86 and the failing-phase RollbackPartial prepended to the reverse-walk partials. The Phase<C>.undo JSDoc on the interface declaration is amended in place to document the "tolerate partial-do throw" contract (contains substrings "tolerate" and "partial-do"). All 12 phase-ledger tests pass (9 existing per SC#5 + 3 new TR-02 per SC#1/SC#3/SC#4). `npm run check` exits 0 end-to-end. The file is committed in a single Conventional Commits commit with title `fix(transaction): invoke failing-phase undo in runPhases catch`.
  </done>
  <acceptance_criteria>
    - [ ] `node --test tests/transaction/phase-ledger.test.ts` reports 12 pass, 0 fail (9 existing + 3 new TR-02 all GREEN).
    - [ ] `npm run check` exits 0 end-to-end (typecheck + lint + format:check + full test suite GREEN per SC#5).
    - [ ] `grep -cE "tolerate" extensions/pi-claude-marketplace/transaction/phase-ledger.ts` >= 1 AND `grep -cE "partial-do" extensions/pi-claude-marketplace/transaction/phase-ledger.ts` >= 1 (Phase<C>.undo JSDoc documents the new contract per SC#2 and 37-VALIDATION row 37-01-04).
    - [ ] `grep -cE "executed\\.push\\(phase\\)" extensions/pi-claude-marketplace/transaction/phase-ledger.ts` returns exactly 1; verify by reading the surrounding lines that the push stays AFTER `await phase.do(ctx)` (Pitfall 2 over-correction guard: executed[] never contains the failing phase).
    - [ ] `grep -cE "if \\(undoErr instanceof PathContainmentError\\)" extensions/pi-claude-marketplace/transaction/phase-ledger.ts` returns 2 (one at the existing rollbackExecuted site at lines 84-86 and one at the NEW failing-phase undo call site in runPhases -- the loud re-throw discipline is present at BOTH call sites per SC#3).
    - [ ] `wc -l extensions/pi-claude-marketplace/transaction/phase-ledger.ts` reports <= 160 lines (file size sanity check; the inline restructure keeps the file compact per RESEARCH Open Question 1 recommendation).
    - [ ] `pre-commit run --files extensions/pi-claude-marketplace/transaction/phase-ledger.ts` exits 0 after up to one re-stage cycle.
    - [ ] Single commit with title `fix(transaction): invoke failing-phase undo in runPhases catch` (verify with `git log -1 --pretty=%s` matches expected title and is <=72 chars).
    - [ ] `git branch --show-current` returns a `features/*` branch (NEVER main per CLAUDE.md).
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Bridge `undo` -> ledger catch block | Bridge undo helpers (skills/commands/agents/mcp) write to disk; their thrown errors traverse the ledger catch block. PathContainmentError from `assertPathInside` (shared/path-safety.ts) signals attempted path traversal and MUST re-throw loudly. |
| Plugin manifest -> bridge `do` | Out of scope for this phase (existing trust boundary, untouched). The fix only restructures rollback control flow; it does NOT introduce new inputs from manifests. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-37-01 | Tampering | `runPhases` failing-phase undo call site | mitigate | Re-throw `PathContainmentError` immediately at the new call site (mirroring lines 84-86 of phase-ledger.ts); never fold it into a RollbackPartial row. The new test "PI-14 runPhases: PathContainmentError from FAILING phase's own undo is RE-THROWN" locks this. Asserted via `grep -cE "if \\(undoErr instanceof PathContainmentError\\)" returning 2 (both call sites). |
| T-37-02 | Tampering / Repudiation | `runPhases` original error preservation | mitigate | The `original` Error reference (captured at the top of the catch block) is preserved verbatim in the returned result's `error` field; undo failures surface via the separate `rollbackPartials[]` channel without overwriting the original. The existing test at lines 87-113 ("AS-4 runPhases: undo failure aggregated with phase name") locks this contract and is unchanged. |
| T-37-03 | Tampering | Failing-phase undo double-invocation (Pitfall 2 over-correction) | mitigate | `executed.push(phase)` stays AFTER `await phase.do(ctx)` (Pitfall 2 over-correction guard); the failing-phase undo invocation is a SEPARATE catch-block call site, NOT folded into `rollbackExecuted`. Asserted via `grep -cE "executed\\.push\\(phase\\)" returning exactly 1 (no second push before the await) AND the TR-02 sequence test (Test 1) asserting exact-equality on ctx.trace catches any double-invocation. |
| T-37-SC | Tampering | npm/pip/cargo installs | N/A | Phase 37 installs ZERO new packages (verified in RESEARCH "Package Legitimacy Audit"). No `[ASSUMED]`/`[SUS]` packages; no legitimacy checkpoint required. |
</threat_model>

<verification>
Phase-wide checks (run after both tasks complete):

1. `cd /Users/acolomba/src/pi-claude-marketplace && npm run check` exits 0 (typecheck + ESLint + Prettier + full test suite GREEN per SC#5).
2. `cd /Users/acolomba/src/pi-claude-marketplace && node --test tests/transaction/phase-ledger.test.ts 2>&1 | grep "^# tests"` reports `# tests 12` (9 existing + 3 new TR-02). All 12 GREEN.
3. `cd /Users/acolomba/src/pi-claude-marketplace && node --test "tests/orchestrators/plugin/{install,uninstall,reinstall}.test.ts" 2>&1 | tail -5` reports zero failures (SC#5 -- existing install/uninstall/reinstall tests unchanged, verifying the four bridge consumer phases' undo gates remain compatible with the new "may be called after partial-do" contract per RESEARCH Assumption A2).
4. `grep -cE "tolerate|partial-do" extensions/pi-claude-marketplace/transaction/phase-ledger.ts` returns >= 2 (Phase<C>.undo JSDoc documents the new contract per SC#2).
5. `wc -l extensions/pi-claude-marketplace/transaction/phase-ledger.ts` reports <=160 lines (file remains compact per RESEARCH Open Question 1 recommendation).
6. `git log --oneline -3 | head -3` shows two new commits on the current `features/transaction-resilience-hardening` branch (one `test(transaction):` from Task 1, one `fix(transaction):` from Task 2). Neither commit lands on main (per CLAUDE.md).

Per-Task Verification Map (from 37-VALIDATION.md) coverage:
- 37-01-01 (failing-phase undo runs exactly once before rollback walk) -> Task 1 Test 1 + Task 2 GREEN gate.
- 37-01-02 (reverse-walk excludes failing phase, no double rollback) -> Task 1 Test 1 deepEqual + Task 2 grep on executed.push position.
- 37-01-03 (PathContainmentError from failing-phase undo re-throws) -> Task 1 Test 2 + Task 2 grep returning 2.
- 37-01-04 (Phase<C>.undo JSDoc documents partial-do tolerance) -> Task 2 grep on `tolerate|partial-do` substrings.
- 37-01-05 (full check passes, no regression) -> Task 2 `npm run check` exit 0.
</verification>

<success_criteria>
The phase is complete when ALL of the following are true:

1. **SC#1 (TR-02 core fix):** In `runPhases`, when `phase.do(ctx)` throws, the failing phase's `undo(ctx)` is called exactly once from the catch block BEFORE `rollbackExecuted(executed, ctx)`; `executed[]` does NOT contain the failing phase. Locked by Task 1 Test 1 ("TR-02 runPhases: failing-phase undo runs BEFORE reverse-walk, exactly once each") asserting `assert.deepEqual(ctx.trace, ["do:p0", "do:p1", "do:p2", "undo:p2", "undo:p1", "undo:p0"])`.

2. **SC#2 (JSDoc contract documentation):** `Phase<C>.undo` JSDoc on the interface declaration (lines 26-29) documents that undo must tolerate being called after a partial-do throw (ENOENT-tolerant, no-op if nothing to clean up). Locked by `grep -cE "tolerate|partial-do" extensions/pi-claude-marketplace/transaction/phase-ledger.ts >= 2`.

3. **SC#3 (PathContainmentError re-throw at new call site):** `PathContainmentError` from the failing phase's `undo` re-throws immediately, matching the existing discipline at `phase-ledger.ts:84-86`. Locked by Task 1 Test 2 ("PI-14 runPhases: PathContainmentError from FAILING phase's own undo is RE-THROWN") and `grep -cE "if \\(undoErr instanceof PathContainmentError\\)" returning 2.

4. **SC#4 (Newest-first ordering):** A regression test asserts the exact undo-call sequence for a 3-phase ledger where phase 2 throws: `phase2.undo`, then `phase1.undo` (reverse walk), `phase0.undo` (reverse walk) -- each invoked exactly once. AND when all three undos throw, the resulting `rollbackPartials[]` is `[p2-partial, p1-partial, p0-partial]` (newest first per AS-4 / MSG-RP-1). Locked by Task 1 Tests 1+3.

5. **SC#5 (Regression preservation):** `npm run check` GREEN; existing install/uninstall/reinstall tests unchanged. Locked by Task 2 `npm run check` exit 0 + the 9 existing phase-ledger tests still passing per Task 1 acceptance criterion.

6. **Multi-source coverage audit:**
   - GOAL (ROADMAP Phase 37): "Phase-Ledger Undo Gap (TR-02)" -- COVERED by Tasks 1+2.
   - REQ (REQUIREMENTS.md TR-02): "runPhases invokes the failing phase's own undo before reverse-walking executed[]; failing phase's undo is called exactly once as a separate catch-block call site, never via executed[] addition (prevents double-rollback); Phase interface JSDoc documents that undo must tolerate being called after a partial-do throw." -- COVERED by Tasks 1 (tests) + 2 (implementation + JSDoc).
   - RESEARCH (37-RESEARCH.md): Locked fix structure (separate catch-block call site, PathContainmentError re-throw, prepended partial for newest-first ordering, inline rather than helper extraction, in-place JSDoc amendment) -- COVERED by Task 2 action.
   - CONTEXT (37-CONTEXT.md SC#1..#5): All five success criteria -- COVERED above.
   - No missing items. No PHASE SPLIT required.
</success_criteria>

<output>
After both tasks complete, create `.planning/phases/37-phase-ledger-undo-gap/37-01-SUMMARY.md` per the template at `@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md`. The summary should:
- State that TR-02 is closed (failing-phase undo invoked exactly once from a separate catch-block call site in runPhases before rollbackExecuted; PathContainmentError re-throw discipline preserved; failing-phase RollbackPartial prepended for newest-first ordering; Phase<C>.undo JSDoc amended in place to document the "tolerate partial-do throw" contract).
- Record the two commits (test commit + fix commit) with their hashes and titles.
- Confirm the verification gates (12/12 phase-ledger tests GREEN, npm run check exit 0, install/uninstall/reinstall tests unchanged).
- Note that no orchestrator-side changes were needed (per RESEARCH Assumption A2 -- all four bridge consumer phases in install.ts already satisfy the new contract via existing `if (c.<bridge>Prep === undefined) return;` gates).
- Reference RESEARCH Assumption A1 was confirmed during planning by reading shared/notify.ts:1343 (`for (const phase of p.rollbackPartial)` -- top-down walk -> failing-phase partial at index 0 reads as "most recent first").
</output>
