---
phase: 20-migration-wave-3-edge-handlers-usageerror
plan: 3
type: execute
wave: 2
depends_on:
  - 20-01
files_modified:
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  - tests/edge/handlers/import.test.ts
autonomous: true
requirements:
  - SNM-23
requirements_addressed:
  - SNM-23
must_haves:
  truths:
    - "D-20-03 (novel for Phase 20; extends D-19-01 DROP precedent to outer try/catch wrappers): Both V1 `notifyError` catch-all sites in edge handlers are DROPPED entirely along with their enclosing try/catch blocks. Inner orchestrators emit V2 failed notifications on caught errors per Phase 18/19 contract; truly catastrophic uncaught throws bubble to Pi runtime (which surfaces a stack trace BETTER for debugging than a polished error message that masks the bug)."
    - "D-20-03 site 1 (bootstrap.ts:57-66): the outer `try { await bootstrapClaudePlugin({...}); } catch (err) { notifyError(ctx, errorMessage(err), err); }` wrapper is REMOVED. `bootstrapClaudePlugin` calls `addMarketplace` + `setMarketplaceAutoupdate`; both are post-Phase-18 V2 with their own internal try/catch + V2 failed-marketplace emission per D-18-02. The outer guard fires only on bugs."
    - "D-20-03 site 2 (import.ts:40-50): the outer `try { await (deps.importClaudeSettings ?? importClaudeSettings)({...}); } catch (err) { notifyError(ctx, \"Import encountered an unexpected error: ...\", err); }` wrapper is REMOVED. `importClaudeSettings` after Plan 20-02 lands has its own outer-catch DROPPED too (see Plan 20-02 line-1001 path); the inner `executeScopedPlan` per-scope try/catch (execute.ts:745-755) is the SOLE expected error surface."
    - "Imports cleanup: BOTH files have a mixed `import { notifyError, notifyUsageError } from \"../../../shared/notify.ts\"` (bootstrap.ts:21, import.ts:7) -- AFTER Plan 20-01 lands, both still need `notifyUsageError` for usage-error sites. Plan 20-03 DROPS only `notifyError` from each import, leaving `import { notifyUsageError } from \"../../../shared/notify.ts\"`. Additionally, `errorMessage` from `../../../shared/errors.ts` (bootstrap.ts:20, import.ts:6) becomes UNUSED after the catch body is removed -- DROP that import too. Per RESEARCH Pitfall 1: failing to drop these imports causes `no-unused-vars` / `import-x` errors at `npm run check`."
    - "D-20-05 (parallel-safe with Plan 20-02 -- disjoint files): Plan 20-02 mutates `orchestrators/import/execute.ts` + `orchestrators/import/index.ts` + `tests/orchestrators/import/execute.test.ts`; Plan 20-03 mutates `edge/handlers/plugin/bootstrap.ts` + `edge/handlers/plugin/import.ts` + `tests/edge/handlers/import.test.ts`. Zero file overlap. Wave 2 plans (20-02 + 20-03) can execute in parallel after Plan 20-01 lands."
    - "Test path correction (RESEARCH-verified): CONTEXT.md line 243 said `tests/edge/handlers/plugin/import.test.ts` -- the test ACTUALLY lives at `tests/edge/handlers/import.test.ts` (NOT under `plugin/`). The source `edge/handlers/plugin/import.ts` maps to test `tests/edge/handlers/import.test.ts` via a non-symmetric path. Plan 20-03 references the correct path."
    - "D-20-06 test discipline (D-19-01 DROP-test-deletion precedent): `tests/edge/handlers/import.test.ts:111-123` -- the single test `\"import handler catches unexpected orchestrator throws and surfaces as error\"` exercises ONLY the dropped catch-all path. DELETE the test outright (lines 111-123). Per RESEARCH verification, this is the SOLE catch-all test in the file; happy-path + usage-error tests are untouched."
    - "D-20-06 test discipline for bootstrap: `tests/edge/handlers/plugin/bootstrap.test.ts` has NO test exercising the catch-all path at `bootstrap.ts:65` (verified by grep in 20-RESEARCH.md line 152). Plan 20-03 has ZERO test-file mutations in bootstrap."
  byte_contracts:
    - "bootstrap.ts: BEFORE -- lines 57-66 wrap `await bootstrapClaudePlugin({ ctx, pi, cwd: ctx.cwd, gitOps: deps.gitOps });` in `try { ... } catch (err) { notifyError(ctx, errorMessage(err), err); }`. AFTER -- the direct call `await bootstrapClaudePlugin({ ctx, pi, cwd: ctx.cwd, gitOps: deps.gitOps });` survives with NO wrapper. NO new V2 emission replaces the catch."
    - "import.ts: BEFORE -- lines 40-50 wrap `await (deps.importClaudeSettings ?? importClaudeSettings)({ ctx, pi, cwd: ctx.cwd, selectedScopes: parsed.scope === undefined ? [\"project\", \"user\"] : [parsed.scope], gitOps: deps.gitOps });` in `try { ... } catch (err) { notifyError(ctx, \"Import encountered an unexpected error: ...\", err); }`. AFTER -- the direct call survives with NO wrapper. NO new V2 emission replaces the catch."
    - "tests/edge/handlers/import.test.ts: BEFORE -- lines 111-123 define test `\"import handler catches unexpected orchestrator throws and surfaces as error\"` exercising `importClaudeSettings: () => Promise.reject(new Error(\"boom\"))` and asserting `notifications[0]?.severity === \"error\"` + `notifications[0]?.message ~= /boom/`. AFTER -- the test block (lines 111-123) is DELETED outright."
  artifacts:
    - path: "extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts"
      provides: "Direct `await bootstrapClaudePlugin({...})` call without outer try/catch wrapper. `notifyError` import + `errorMessage` import DROPPED. `notifyUsageError` import survives (used by sites 38/43/49 migrated by Plan 20-01)."
      contains: "await bootstrapClaudePlugin"
    - path: "extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts"
      provides: "Direct `await (deps.importClaudeSettings ?? importClaudeSettings)({...})` call without outer try/catch wrapper. `notifyError` import + `errorMessage` import DROPPED. `notifyUsageError` import survives (used by sites 31/36 migrated by Plan 20-01)."
      contains: "await \\(deps\\.importClaudeSettings"
    - path: "tests/edge/handlers/import.test.ts"
      provides: "Catch-all test at lines 111-123 DELETED outright per D-19-01 DROP-test-deletion precedent; happy-path + usage-error tests untouched."
      contains: "(absence of catch-all test)"
  key_links:
    - from: "extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts"
      to: "extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts::bootstrapClaudePlugin"
      via: "direct unwrapped call (orchestrator owns its own try/catch + V2 emission per D-18-02 + Phase 18/19 contract)"
      pattern: "await bootstrapClaudePlugin\\("
    - from: "extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts"
      to: "extensions/pi-claude-marketplace/orchestrators/import/execute.ts::importClaudeSettings"
      via: "direct unwrapped call (Plan 20-02 drops the inner outer try/catch too; truly catastrophic throws bubble to Pi runtime per D-20-03 extension)"
      pattern: "await \\(deps\\.importClaudeSettings"
    - from: "tests/edge/handlers/import.test.ts"
      to: "D-19-01 DROP-test-deletion precedent"
      via: "test at lines 111-123 DELETED entirely (no V2 representation exists for the dropped catch-all surface)"
      pattern: "(absence of catches unexpected orchestrator throws)"
  coverage_constraints:
    - "Zero V1 `notifyError` callsites remain in `edge/handlers/plugin/bootstrap.ts`: `grep -cE \"notifyError\\(\" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` returns 0."
    - "Zero V1 `notifyError` callsites remain in `edge/handlers/plugin/import.ts`: `grep -cE \"notifyError\\(\" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns 0."
    - "Zero `notifyError` imports remain in either file: `grep -c \"notifyError\" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns 0 for both."
    - "Zero `errorMessage` imports remain in either file: `grep -c \"errorMessage\" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns 0 for both (unused after catch removal)."
    - "Catch-all test deleted from import.test.ts: `grep -c \"catches unexpected orchestrator throws\" tests/edge/handlers/import.test.ts` returns 0."
    - "Bootstrap test file UNCHANGED: `git diff tests/edge/handlers/plugin/bootstrap.test.ts` returns empty (Plan 20-03 has no bootstrap-test mutations per RESEARCH-verified absence)."
    - "Happy-path tests still pass: `node --test tests/edge/handlers/import.test.ts tests/edge/handlers/plugin/bootstrap.test.ts` exits 0."
    - "`npm run check` GREEN (no `no-unused-vars` or `import-x` errors per Pitfall 1)."
---

<objective>
DROP the 2 V1 `notifyError` catch-all sites in edge handlers along with their enclosing try/catch blocks per D-20-03. After Plan 20-03 lands, NO V1 `notifyError` callsites remain in `edge/handlers/plugin/{bootstrap,import}.ts`; the inner orchestrators' own try/catch + V2 failed-notification emission per Phase 18/19 contract handles all expected failures; truly catastrophic uncaught throws bubble to Pi runtime (which surfaces a stack trace BETTER for debugging than a polished V1 error message that masks the bug).

Two DROP surfaces:

1. **`edge/handlers/plugin/bootstrap.ts:57-66`** -- the entire `try { await bootstrapClaudePlugin({...}); } catch (err) { notifyError(ctx, errorMessage(err), err); }` wrapper is REMOVED; the inner `await bootstrapClaudePlugin({...})` call survives. `bootstrapClaudePlugin` calls `addMarketplace` + `setMarketplaceAutoupdate`; both are post-Phase-18 V2 with their own internal try/catch + V2 failed-marketplace emission per D-18-02. ALSO drop `notifyError` from the mixed import at line 21 (Plan 20-01 migrated the usage-error sites at lines 38/43/49 but left the mixed import intact; Plan 20-03 finishes the cleanup); ALSO drop `errorMessage` from the import at line 20 (only referenced inside the catch body -- unused after removal per Pitfall 1).

2. **`edge/handlers/plugin/import.ts:40-50`** -- the entire `try { await (deps.importClaudeSettings ?? importClaudeSettings)({...}); } catch (err) { notifyError(ctx, "Import encountered an unexpected error: ...", err); }` wrapper is REMOVED; the inner `await (deps.importClaudeSettings ?? importClaudeSettings)({...})` call survives. `importClaudeSettings` after Plan 20-02 lands has its own outer try/catch DROPPED too; the inner `executeScopedPlan` per-scope try/catch (execute.ts:745-755) is the SOLE expected error surface. ALSO drop `notifyError` from the mixed import at line 7; ALSO drop `errorMessage` from the import at line 6.

Test consequence per D-19-01 + D-20-06 (DROP-test-deletion precedent):

- **`tests/edge/handlers/import.test.ts:111-123`** -- DELETE the single test `"import handler catches unexpected orchestrator throws and surfaces as error"` outright. The test exercises ONLY the dropped catch-all path; happy-path + usage-error tests are untouched. Per RESEARCH-verified inspection, this is the SOLE catch-all test in the file.

- **`tests/edge/handlers/plugin/bootstrap.test.ts`** -- NO change. The bootstrap.ts:65 catch-all is not exercised by any test in this file (verified by grep in 20-RESEARCH.md line 152). Plan 20-03 has ZERO bootstrap-test mutations.

Purpose: close the SNM-23 architecture goal by eliminating the last V1 wrapper callsites in `edge/handlers/**`. After Plan 20-03 lands, the only V1 wrappers remaining in the codebase live in `shared/notify.ts` itself (the V1 overloads stay alive for Phase 21 deletion per SNM-22).

Output: 2 modified production files (bootstrap.ts + import.ts) + 1 test file (import.test.ts -- single test deletion) in ONE atomic commit; 2 catch-all wrappers removed; 4 import-line cleanups (2 `notifyError` + 2 `errorMessage` drops); 1 test deleted; `npm run check` GREEN.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-CONTEXT.md
@.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-RESEARCH.md
@.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-PATTERNS.md
@.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-VALIDATION.md
@extensions/pi-claude-marketplace/shared/notify.ts
@CLAUDE.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: DROP the catch-all wrapper at edge/handlers/plugin/bootstrap.ts:57-66 (the `try { await bootstrapClaudePlugin({...}); } catch (err) { notifyError(ctx, errorMessage(err), err); }` block); drop `notifyError` from the mixed import at line 21 (KEEP `notifyUsageError`); drop `errorMessage` from the import at line 20 (unused after catch removal); inner orchestrator call `await bootstrapClaudePlugin({...})` survives directly</name>
  <read_first>
    - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts (full file -- verify the catch-all wrapper is at lines 57-66 per 20-RESEARCH.md; verify the mixed `notifyError, notifyUsageError` import at line 21 + `errorMessage` import at line 20 + the inner `await bootstrapClaudePlugin({ ctx, pi, cwd: ctx.cwd, gitOps: deps.gitOps });` call inside the try block).
    - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts (full file -- verify that `bootstrapClaudePlugin` calls `addMarketplace` + `setMarketplaceAutoupdate` internally; both are post-Phase-18 V2 with their own internal try/catch + V2 failed-marketplace emission per D-18-02). Confirm the inner-boundary contract that justifies the DROP.
    - extensions/pi-claude-marketplace/shared/notify.ts lines 127-156 (the dual-overload `notifyUsageError` signature -- `notifyUsageError` MUST remain imported because Plan 20-01 migrated bootstrap.ts:38/43/49 usage-error sites to V2 form; the import stays for those sites).
    - tests/edge/handlers/plugin/bootstrap.test.ts (full file -- grep for `notifyError\|catches unexpected\|catch (err)\|Promise.reject`; per 20-RESEARCH.md line 152 + 20-PATTERNS.md line 591 NO test exercises the catch-all path; Plan 20-03 has ZERO bootstrap-test mutations).
    - 20-CONTEXT.md `<decisions>` D-20-03 (catch-all DROP rationale) + D-20-05 (parallel-safe with Plan 20-02) + D-20-06 (DROP-test-deletion precedent).
    - 20-RESEARCH.md "Per-File Site Table > Plan 20-03" lines 145-154 (verified line numbers + path correction).
    - 20-PATTERNS.md "(c) Plan 20-03 -- Defense-in-Depth Catch-all DROP" lines 472-604 (the novel pattern recipe + bootstrap.ts/import.ts twin recipes + the explicit DELETE-test list).
    - 20-RESEARCH.md "Common Pitfalls > Pitfall 1: Missing the notifyError import drop in Plan 20-03" lines 412-417 (the lint failure mode if imports aren't cleaned up).
  </read_first>
  <files>extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts</files>
  <action>
    Operate in this order:

    1. LOCATE the catch-all wrapper at lines 57-66 (the `try { await bootstrapClaudePlugin({...}); } catch (err) { notifyError(ctx, errorMessage(err), err); }` block). Verify the surrounding code -- this is the FINAL action of the handler function (after Plan 20-01's usage-error sites at lines 38/43/49 have been migrated).

    2. REMOVE the try/catch wrapper. The inner `await bootstrapClaudePlugin({ ctx, pi, cwd: ctx.cwd, gitOps: deps.gitOps });` call survives unwrapped. Specifically:

       BEFORE (per 20-PATTERNS.md verbatim line 484-494):
       ```
       try {
         await bootstrapClaudePlugin({
           ctx,
           pi,
           cwd: ctx.cwd,
           gitOps: deps.gitOps,
         });
       } catch (err) {
         notifyError(ctx, errorMessage(err), err);
       }
       ```

       AFTER:
       ```
       await bootstrapClaudePlugin({
         ctx,
         pi,
         cwd: ctx.cwd,
         gitOps: deps.gitOps,
       });
       // (no try/catch; truly catastrophic throws bubble to Pi runtime per D-20-03)
       ```

       Match indentation to the surrounding handler function's existing 2-space or 4-space style (read the file to determine). The inline comment is optional but encouraged for future-archaeology clarity.

    3. UPDATE IMPORTS. At line 21, change `import { notifyError, notifyUsageError } from "../../../shared/notify.ts";` to `import { notifyUsageError } from "../../../shared/notify.ts";` (drop `notifyError`; KEEP `notifyUsageError` -- still consumed by Plan-20-01-migrated sites at lines 38/43/49). At line 20, REMOVE `import { errorMessage } from "../../../shared/errors.ts";` entirely (only used inside the now-deleted catch body per Pitfall 1; the import becomes unused). Verify no OTHER usage of `errorMessage` exists in bootstrap.ts (grep `errorMessage` post-edit -- expect 0 hits).

    4. VERIFY post-edit:

       - `grep -cE "notifyError\\(\\|notifyError," extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` returns 0 (no callsites + no import).
       - `grep -c "notifyUsageError" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` returns ≥1 (the import + 3 V2 1-arg callsites from Plan 20-01).
       - `grep -c "errorMessage" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` returns 0 (import + usage gone).
       - `grep -c "catch (err)" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` returns 0 (the only catch in the handler was the catch-all; if other catches exist legitimately, document in SUMMARY).
       - `node --test tests/edge/handlers/plugin/bootstrap.test.ts` exits 0 (no test changes; happy-path tests pass against the unwrapped call).

    Honors D-20-03 (catch-all DROP) + D-20-06 (no bootstrap-test changes) + Pitfall 1 (notifyError + errorMessage import cleanup) + IL-2 (preserved -- inner orchestrator emits V2 notifications via the same `ctx.ui.notify` host channel).
  </action>
  <verify>
    <automated>node --test tests/edge/handlers/plugin/bootstrap.test.ts</automated>
  </verify>
  <done>
    bootstrap.ts compiles under strict TypeScript; the outer try/catch at lines 57-66 is removed; the inner `await bootstrapClaudePlugin({...})` call survives unwrapped; `notifyError` dropped from the mixed import at line 21 (`notifyUsageError` stays for sites 38/43/49); `errorMessage` import at line 20 dropped (unused after catch removal); no `no-unused-vars` or `import-x` lint errors; bootstrap.test.ts continues to pass without modification. Mid-plan commit -- continues to Task 2 for the import.ts twin DROP + test deletion.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: DROP the catch-all wrapper at edge/handlers/plugin/import.ts:40-50 (the `try { await (deps.importClaudeSettings ?? importClaudeSettings)({...}); } catch (err) { notifyError(ctx, "Import encountered...", err); }` block); drop `notifyError` from the mixed import at line 7 (KEEP `notifyUsageError`); drop `errorMessage` from the import at line 6 (unused after catch removal); inner orchestrator call survives directly; DELETE the catch-all test at tests/edge/handlers/import.test.ts:111-123 outright per D-19-01 DROP-test-deletion precedent</name>
  <read_first>
    - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts (full file -- verify the catch-all wrapper is at lines 40-50 per 20-RESEARCH.md; verify the mixed `notifyError, notifyUsageError` import at line 7 + `errorMessage` import at line 6 + the inner `await (deps.importClaudeSettings ?? importClaudeSettings)({ ctx, pi, cwd: ctx.cwd, selectedScopes: parsed.scope === undefined ? ["project", "user"] : [parsed.scope], gitOps: deps.gitOps });` call inside the try block).
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts (read enough to confirm that after Plan 20-02 lands, the outer try/catch at lines 979-1003 is also DROPPED -- this is the inner-boundary justification for the edge-handler DROP; the inner `executeScopedPlan` per-scope try/catch at lines 745-755 is the SOLE expected error surface).
    - tests/edge/handlers/import.test.ts (full file -- specifically verify lines 111-123 contain the test `"import handler catches unexpected orchestrator throws and surfaces as error"` and that this is the SOLE test exercising the catch-all path; verify happy-path + usage-error tests live elsewhere in the file).
    - 20-PATTERNS.md "(c) Plan 20-03 -- Twin pattern in import.ts:40-50" lines 528-562 + "Test treatment" lines 565-589 (the verbatim DELETE-block list for the catch-all test at lines 111-123).
    - 20-RESEARCH.md "Per-File Site Table > Plan 20-03 row 3" line 151 ("Critical correction to CONTEXT.md line 243: the catch-all import handler test lives at `tests/edge/handlers/import.test.ts:111-123` (NOT under `tests/edge/handlers/plugin/`)").
    - 20-CONTEXT.md `<decisions>` D-20-03 (catch-all DROP) + D-20-05 (parallel-safe with Plan 20-02) + D-20-06 (DROP-test-deletion precedent).
    - 20-RESEARCH.md "Common Pitfalls > Pitfall 1" lines 412-417 (import cleanup) + "Pitfall 2: Test path skew" lines 419-424 (CORRECT path is `tests/edge/handlers/import.test.ts`, NOT `tests/edge/handlers/plugin/import.test.ts`).
  </read_first>
  <files>
    extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts,
    tests/edge/handlers/import.test.ts
  </files>
  <action>
    Operate in this order:

    1. LOCATE the catch-all wrapper at lines 40-50 in `edge/handlers/plugin/import.ts` (the `try { await (deps.importClaudeSettings ?? importClaudeSettings)({...}); } catch (err) { notifyError(ctx, \`Import encountered an unexpected error: ${errorMessage(err)}\`, err); }` block). Verify it is the FINAL action of the handler (after Plan 20-01's usage-error sites at lines 31/36 migrated).

    2. REMOVE the try/catch wrapper. The inner call survives unwrapped:

       BEFORE (per 20-PATTERNS.md verbatim line 531-541):
       ```
       try {
         await (deps.importClaudeSettings ?? importClaudeSettings)({
           ctx,
           pi,
           cwd: ctx.cwd,
           selectedScopes: parsed.scope === undefined ? ["project", "user"] : [parsed.scope],
           gitOps: deps.gitOps,
         });
       } catch (err) {
         notifyError(ctx, `Import encountered an unexpected error: ${errorMessage(err)}`, err);
       }
       ```

       AFTER:
       ```
       await (deps.importClaudeSettings ?? importClaudeSettings)({
         ctx,
         pi,
         cwd: ctx.cwd,
         selectedScopes: parsed.scope === undefined ? ["project", "user"] : [parsed.scope],
         gitOps: deps.gitOps,
       });
       // (no try/catch; truly catastrophic throws bubble to Pi runtime per D-20-03)
       ```

       Match the file's existing indentation. The inline comment is encouraged.

    3. UPDATE IMPORTS in `import.ts`. At line 7, change `import { notifyError, notifyUsageError } from "../../../shared/notify.ts";` to `import { notifyUsageError } from "../../../shared/notify.ts";` (drop `notifyError`; KEEP `notifyUsageError` -- still consumed by Plan-20-01-migrated sites at lines 31/36). At line 6, REMOVE `import { errorMessage } from "../../../shared/errors.ts";` entirely (unused after catch body removal). Verify no other usage of `errorMessage` in the file (grep -- expect 0 hits).

    4. DELETE the catch-all test at `tests/edge/handlers/import.test.ts:111-123`. Per 20-PATTERNS.md line 565-589, the verbatim block to delete is:

       ```
       test("import handler catches unexpected orchestrator throws and surfaces as error", async () => {
         const { ctx, notifications } = makeCtx();
         const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
         const handler = makeImportHandler(pi, {
           gitOps: {} as GitOps,
           importClaudeSettings: () => Promise.reject(new Error("boom")),
         });

         await handler("", ctx);

         assert.equal(notifications[0]?.severity, "error");
         assert.match(notifications[0]?.message ?? "", /boom/);
       });
       ```

       Remove the entire `test("import handler catches unexpected orchestrator throws and surfaces as error", ...)` block. Verify it is the SOLE catch-all test (grep `Promise.reject(new Error("boom"))` -- expect 0 hits after deletion). All happy-path tests + usage-error tests in the same file STAY untouched.

    5. CLEANUP TEST IMPORTS. If the deleted test was the ONLY consumer of any test-only import (e.g., if `GitOps` was only referenced in the deleted test block), drop that import too. Verify no `no-unused-vars` errors at `npm run check`.

    6. VERIFY post-edit:

       - `grep -cE "notifyError\\(\\|notifyError," extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns 0 (no callsites + no import).
       - `grep -c "notifyUsageError" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns ≥1 (the import + 2 V2 1-arg callsites from Plan 20-01).
       - `grep -c "errorMessage" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns 0 (import + usage gone).
       - `grep -c "catch (err)" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns 0 (the only catch was the catch-all).
       - `grep -c "catches unexpected orchestrator throws" tests/edge/handlers/import.test.ts` returns 0 (test deleted).
       - `grep -c \"Promise.reject(new Error(\\\\\\\"boom\\\\\\\"))\" tests/edge/handlers/import.test.ts` returns 0.
       - `node --test tests/edge/handlers/import.test.ts` exits 0 (happy-path + usage-error tests pass).
       - PHASE-WIDE invariant: `grep -rcE \"notifyError\\(\" extensions/pi-claude-marketplace/edge/` returns 0 across the whole edge directory.
       - `npm run check` exits 0 -- the phase-level gate; both tasks land in one atomic commit.

    Honors D-20-03 (catch-all DROP) + D-20-06 (DROP-test-deletion precedent) + D-19-01 inheritance + Pitfall 1 (import cleanup) + Pitfall 2 (correct test path) + IL-2 (preserved).
  </action>
  <verify>
    <automated>node --test tests/edge/handlers/import.test.ts &amp;&amp; npm run check</automated>
  </verify>
  <done>
    import.ts compiles under strict TypeScript; the outer try/catch at lines 40-50 is removed; the inner call survives unwrapped; `notifyError` dropped from the mixed import at line 7 (`notifyUsageError` stays for sites 31/36); `errorMessage` import at line 6 dropped (unused); the catch-all test at `tests/edge/handlers/import.test.ts:111-123` is DELETED outright; no other tests are affected; PHASE-WIDE invariant: zero V1 `notifyError` callsites remain in `extensions/pi-claude-marketplace/edge/` after both Task 1 and Task 2 land. `npm run check` GREEN. Atomic single-commit boundary across Task 1 (bootstrap.ts) + Task 2 (import.ts + import.test.ts).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Edge-handler defense-in-depth catch-all wrapper removal; inner orchestrator boundary (`bootstrapClaudePlugin`, `importClaudeSettings`) is the SOLE expected error surface; truly catastrophic uncaught throws bubble to Pi runtime's uncaught-exception boundary (which surfaces a stack trace). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-03-01 | D (Denial of service: catastrophic-error path silently dropped) | bootstrap.ts:57-66 + import.ts:40-50 catch-all wrappers | accept | Per D-20-03 + RESEARCH §Threat Model row 2: Pi runtime's uncaught-exception boundary surfaces a stack trace with the actual cause -- BETTER for debugging than a polished error message that masks the bug. Inner orchestrators (`bootstrapClaudePlugin` composes `addMarketplace` + `setMarketplaceAutoupdate`; `importClaudeSettings` has its own outer-catch DROPPED in Plan 20-02 with the inner `executeScopedPlan` per-scope try/catch as the SOLE expected error surface) emit V2 failed notifications for all expected failures. The outer guard fires only on bugs. Risk LOW-MEDIUM (user-visible quality degrades for the rare bug-trigger case; CI should monitor `npm run check` logs for new uncaught-exception traces). |
| T-20-03-02 | I (Information disclosure: V1 error message format) | V1 `notifyError(ctx, "Import encountered an unexpected error: ...", err)` user-facing string | accept | The V1 wrapper formatted the error message via `errorMessage(err)` which extracted `err.message` (a string). The V2 DROP means the user no longer sees that string in the notification surface; Pi runtime's stack trace surface shows it in its own format. No new exposure. Risk LOW. |
| T-20-03-03 | T (Tampering: regression to V1 notifyError surface in unmigrated files) | The remaining `shared/notify.ts::notifyError` V1 wrapper symbol | accept | The V1 wrapper STAYS exported from `shared/notify.ts` until Phase 21 deletion (SNM-22). Any future `notifyError(...)` callsite introduction in `edge/handlers/**` would be caught by MSG-Block 1's lint rules (Block 1's `files: ["orchestrators/**"]` doesn't cover edge/, but Block 1b's per-scope rule + Block 2's `msg-sr-7-usage-error-routing` rule cover edge handlers). Plan 20-04 narrows Block 1 to additionally ignore `orchestrators/import/**`; edge-handler lint coverage stays intact. Risk LOW. |
| T-20-03-SC | T (Supply chain: npm/pip/cargo installs) | (none) | accept | Plan 20-03 performs NO package installs. Pure code deletion + import cleanup + test deletion. 20-RESEARCH.md `## Package Legitimacy Audit` is not required. Risk NONE for this plan. |
</threat_model>

<verification>
- `node --test tests/edge/handlers/plugin/bootstrap.test.ts tests/edge/handlers/import.test.ts` exits 0.
- `npm run check` exits 0 at the atomic commit boundary.
- `grep -rcE "notifyError\(" extensions/pi-claude-marketplace/edge/` returns 0 (PHASE-WIDE invariant after Plan 20-03 lands).
- `grep -c "notifyError" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns 0 for both files (callsites + imports gone).
- `grep -c "errorMessage" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns 0 for both files (import + usage gone).
- `grep -c "catches unexpected orchestrator throws" tests/edge/handlers/import.test.ts` returns 0 (test deleted).
- `grep -c "notifyUsageError" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` returns ≥1 (Plan-20-01-migrated sites + import still present).
- `grep -c "notifyUsageError" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns ≥1 (Plan-20-01-migrated sites + import still present).
- `git diff --stat tests/edge/handlers/plugin/bootstrap.test.ts` returns empty (no bootstrap-test changes per RESEARCH-verified absence).
</verification>

<success_criteria>
- 2 V1 `notifyError` catch-all sites in edge handlers DROPPED entirely with their enclosing try/catch blocks (bootstrap.ts:57-66 + import.ts:40-50).
- 4 import-line cleanups: `notifyError` dropped from mixed imports in bootstrap.ts:21 + import.ts:7 (KEEP `notifyUsageError`); `errorMessage` dropped from bootstrap.ts:20 + import.ts:6 (unused after catch removal).
- 1 catch-all test DELETED outright at `tests/edge/handlers/import.test.ts:111-123` per D-19-01 DROP-test-deletion precedent.
- PHASE-WIDE invariant: zero V1 `notifyError` callsites remain in `extensions/pi-claude-marketplace/edge/` after Plan 20-03 lands (combined with Plan 20-01's usage-error sweep, this closes the SNM-23 architecture goal for the edge family).
- `npm run check` GREEN at the atomic commit boundary (no `no-unused-vars` or `import-x` errors per Pitfall 1).
- Happy-path + usage-error tests in both files continue to pass; bootstrap.test.ts unchanged.
</success_criteria>

<output>
Create `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-03-SUMMARY.md` documenting:
- The 3 files modified (bootstrap.ts + import.ts + import.test.ts) in ONE atomic commit.
- The 2 catch-all wrappers removed (verbatim before/after shapes per the action steps).
- The 4 import-line cleanups (`notifyError` × 2 + `errorMessage` × 2).
- The 1 test deletion at `tests/edge/handlers/import.test.ts:111-123` per D-19-01 precedent.
- Confirmation that `tests/edge/handlers/plugin/bootstrap.test.ts` is UNCHANGED (no catch-all test existed there per RESEARCH-verified absence).
- The inner-boundary contract that justifies the DROP: `bootstrapClaudePlugin` composes V2-failed-emitting marketplace orchestrators; `importClaudeSettings` after Plan 20-02 lands has its own outer-catch DROPPED with `executeScopedPlan` per-scope try/catch as the SOLE expected error surface; truly catastrophic throws bubble to Pi runtime (BETTER for debugging).
- Confirmation that PHASE-WIDE invariant `grep -rcE \"notifyError\\(\" extensions/pi-claude-marketplace/edge/` returns 0.
- Confirmation that `npm run check` exited 0 at the atomic commit boundary.
- Atomic single-commit Conventional Commits message: `refactor(20): drop edge handler catch-all wrappers in bootstrap + import (SNM-23)`. SKIP=trufflehog if executing inside a worktree (per CLAUDE.md).
</output>
</content>
</invoke>
