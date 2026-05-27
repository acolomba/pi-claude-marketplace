---
phase: 20-migration-wave-3-edge-handlers-usageerror
plan: 5
type: execute
wave: 1
depends_on:
  - 20-04
files_modified:
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  - tests/orchestrators/import/execute.test.ts
  - eslint.config.js
autonomous: true
gap_closure: true
requirements:
  - SNM-23
must_haves:
  truths:
    - "WR-02 Option A applied: in `extensions/pi-claude-marketplace/orchestrators/import/execute.ts::executeScopedPlan` (current installPlugin call at lines 638-646), the `await installPlugin({...})` call is wrapped in try/catch. On unexpected throw the catch block pushes one entry to `result.unexpectedPluginFailures` with the SAME shape `dispatchFailedOutcome` uses at lines 737-745 (`kind: \"plugin-failure\"`, `scope: plugin.scope`, `plugin: plugin.ref.plugin`, `marketplace: plugin.ref.marketplace`, `ref: refLabel(plugin)`, `reason: \"unexpected-failure\"`, `cause: errorMessage(err)`), then `continue`s the per-plugin install loop. The next plugin on the same scope is SKIPPED only by the `continue` semantics -- i.e. the failing plugin is recorded but the loop proceeds to the next plugin. The per-scope outer loop in `importClaudeSettings` (lines 769-771) is NOT aborted; the final `notify(opts.ctx, opts.pi, { marketplaces })` at line 787 still fires."
    - "Behavioral guarantee (test-locked): when `installPlugin` mocked to throw for one plugin on scope A, (a) the per-scope loop completes both remaining plugins on scope A, (b) the next scope's loop DOES run, (c) the final `notify()` is invoked exactly once with a cascade that includes a `PluginFailedMessage { reasons: [\"not in manifest\"] }` row for the thrown plugin (matching the V2 mapping `buildImportNotificationMarketplaces` already applies to `result.unexpectedPluginFailures` at lines 457-465), and (d) recorded notifications include the cascade row matching `/⊘ <plugin> \\(failed\\) \\{not in manifest\\}/`."
    - "WR-01/WR-03 comment in `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts:52-55` REWRITTEN to reflect the post-WR-02-fix behavior. The new comment text MUST: (a) drop the stale `execute.ts:745-755` citation, (b) cite `execute.ts:518-528` (loadState wrap) and `577-608` (addMarketplace wrap) AND the new installPlugin try/catch wrap, (c) NOT claim a per-scope try/catch via `executeScopedPlan` (no such function-level catch exists), (d) state that with the WR-02 fix, unexpected `installPlugin` throws are now ALSO caught and routed to `unexpectedPluginFailures`; only uncaught throws from the inline cascade build (`buildImportNotificationMarketplaces`) or from non-installPlugin code paths would abort the per-scope loop, and per D-20-03 such catastrophic uncaught throws bubble to Pi runtime where a stack trace is more useful than a polished message that masks the bug."
    - "IN-01 ESLint doc note ADDED: MSG-Block 1b comment in `eslint.config.js` (currently at lines 175-203) is extended with one short paragraph noting that `orchestrators/import/**` follows the same pattern as `orchestrators/plugin/**` -- MSG-Block 1 IGNORES it (since the V1 routing wrappers no longer exist there after Phase 20 Plan 20-02), but MSG-Block 1b does NOT ignore it because MSG-GR-3 project-first iteration discipline is V1-wrapper-INDEPENDENT. Wording follows REVIEW.md IN-01 §Fix verbatim (paraphrasing is acceptable as long as the import-vs-plugin parallel is explicit and the Phase-20 / Plan-20-02 anchor is named)."
    - "IN-02 `Object.freeze` calls in `execute.ts:354` (`dependenciesFromInstalled` return) and `execute.ts:490, 499` (`buildImportNotificationMarketplaces` return + per-block `plugins` freeze) are KEPT, with a single-line `// defense-in-depth: typed readonly + runtime freeze` comment added directly above each remaining freeze call (3 sites total: line 354, line 490, line 499). Rationale: the codebase grep confirms `Object.freeze(...)` on `readonly`-typed arrays is the dominant convention (≥30 sites across `bridges/**` and `orchestrators/discover.ts`); dropping only the import.ts sites would be inconsistent."
    - "IN-03 `MarketplaceBlock` interface in `execute.ts:302-309`: `name: string` and `scope: Scope` are marked `readonly`. The interface block becomes: `{ readonly key: string; readonly name: string; readonly scope: Scope; status?: MarketplaceStatus; reasons?: readonly Reason[]; plugins: PluginNotificationMessage[] }`. `status?`, `reasons?`, `plugins` stay mutable (the builder writes them across loops; see `buildImportNotificationMarketplaces` at lines 400-481). Verification before locking: no callers reassign `.name` or `.scope` on a `MarketplaceBlock` instance (the only construction site is `ensureMarketplaceBlock` at lines 311-330)."
    - "`npm run check` stays GREEN after all changes land (typecheck + ESLint + Prettier + tests)."
    - "Catalog UAT byte-equality stays GREEN -- the WR-02 fix does NOT change any catalog-fixture-emitted output; it only changes a previously-aborted code path into a recorded `(failed) {not in manifest}` row which is already covered by the existing V2 mapping at lines 457-465."
  artifacts:
    - path: "extensions/pi-claude-marketplace/orchestrators/import/execute.ts"
      provides: "installPlugin call wrapped in try/catch (executeScopedPlan, current lines 638-646); unexpected throw pushes one `unexpectedPluginFailures` entry matching dispatchFailedOutcome's shape (lines 737-745) and `continue`s. `MarketplaceBlock.name` and `.scope` marked readonly (lines 302-309). Three `Object.freeze` sites (lines 354, 490, 499) carry a defense-in-depth comment."
      contains: "result.unexpectedPluginFailures.push"
    - path: "extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts"
      provides: "Comment block at lines 52-55 rewritten to accurately describe post-WR-02 error boundary: cite `execute.ts:518-528` (loadState wrap), `577-608` (addMarketplace wrap), AND the new installPlugin try/catch wrap. Drop the stale `execute.ts:745-755` citation."
      contains: "execute.ts:518-528"
    - path: "tests/orchestrators/import/execute.test.ts"
      provides: "One new test asserting unexpected installPlugin throw is caught, routed to unexpectedPluginFailures, and surfaced in the final V2 cascade. Test name matches `/installPlugin.*unexpected.*throw|partial.*cascade/i`."
      contains: "installPlugin"
    - path: "eslint.config.js"
      provides: "MSG-Block 1b comment (currently lines 175-203) extended with a paragraph noting `orchestrators/import/**` follows the same Block-1-ignore / Block-1b-keep pattern as `orchestrators/plugin/**`, with Phase 20 / Plan 20-02 anchor."
      contains: "orchestrators/import/**"
  key_links:
    - from: "extensions/pi-claude-marketplace/orchestrators/import/execute.ts::executeScopedPlan"
      to: "extensions/pi-claude-marketplace/orchestrators/import/execute.ts::result.unexpectedPluginFailures"
      via: "try/catch wrapping the `await installPlugin({...})` call; catch handler pushes one entry with reason=\"unexpected-failure\" and `continue`s"
      pattern: "result\\.unexpectedPluginFailures\\.push"
    - from: "extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts (comment at lines 52-55)"
      to: "extensions/pi-claude-marketplace/orchestrators/import/execute.ts (line refs 518-528 + 577-608 + new installPlugin try/catch)"
      via: "rewritten comment documenting the actual per-scope error-boundary contract"
      pattern: "execute\\.ts:518-528"
    - from: "tests/orchestrators/import/execute.test.ts (new subtest)"
      to: "extensions/pi-claude-marketplace/orchestrators/import/execute.ts::executeScopedPlan installPlugin try/catch"
      via: "mock `installPlugin` throws for one plugin; assertion verifies loop continuation + final notify() emission + cascade row"
      pattern: "throw new Error"
  coverage_constraints:
    - "WR-02 code: `grep -c \"result.unexpectedPluginFailures.push\" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns ≥ 2 (one in `dispatchFailedOutcome` at lines 737-745 -- pre-existing -- and one in the new `executeScopedPlan` try/catch -- added by this plan)."
    - "WR-02 test: `node --test tests/orchestrators/import/execute.test.ts` exits 0 and includes a subtest whose name matches `/installPlugin.*unexpected.*throw|partial.*cascade/i` (one new test added; no existing tests deleted)."
    - "WR-01/WR-03 comment: `grep -c \"execute.ts:518-528\" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` ≥ 1 AND `grep -c \"execute.ts:745-755\" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` = 0."
    - "IN-01 doc note: `grep -c \"orchestrators/import\" eslint.config.js` ≥ 2 (Block 1 ignore at line 163 -- pre-existing -- plus the new doc note in Block 1b)."
    - "IN-02 defense-in-depth comments: `grep -B1 \"Object.freeze\" extensions/pi-claude-marketplace/orchestrators/import/execute.ts | grep -c \"defense-in-depth\\|intentional\"` ≥ 3 (one per remaining freeze at lines 354, 490, 499)."
    - "IN-03 readonly fields: `grep -E \"readonly name:|readonly scope:\" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns ≥ 1 match within the `MarketplaceBlock` interface body (lines 302-309 region)."
    - "Plan-level gate: `npm run check` exits 0."
    - "Catalog UAT: `node --test tests/architecture/catalog-uat.test.ts` exits 0."
---

<objective>
Close the 5 actionable code-review gap items from `20-REVIEW.md` (WR-01, WR-02, WR-03, IN-01, IN-02, IN-03) per the locked human decisions captured in `<gap_inputs>`. The phase goal -- "every remaining call site uses the v2 structured entrypoints" -- is already verified GREEN by Plans 20-01..20-04 (per `20-VERIFICATION.md`); this plan tightens behavioral safety on the import path (WR-02), corrects the misleading comment that documents it (WR-01/WR-03), and applies the type-safety + doc polish items (IN-01, IN-02, IN-03). IN-04 (sonarjs cognitive-complexity disable) is explicitly DEFERRED.

Purpose: refine SNM-23's behavioral surface. The original phase verified that 30 V2 `notifyUsageError` callsites are in place; this plan ensures the import orchestrator does NOT silently lose a partial cascade when `installPlugin` throws unexpectedly (the one residual gap D-20-03 acknowledged but did not close).

Output:
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` with (a) installPlugin try/catch in executeScopedPlan, (b) `readonly` modifiers on MarketplaceBlock.name + .scope, (c) defense-in-depth comments on the 3 remaining `Object.freeze` calls.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` with a corrected error-boundary comment block at lines 52-55.
- `tests/orchestrators/import/execute.test.ts` with one new test locking the unexpected-installPlugin-throw behavior.
- `eslint.config.js` MSG-Block 1b comment extended with the orchestrators/import/** parallel note.
- `npm run check` GREEN.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-CONTEXT.md
@.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-VERIFICATION.md
@.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-REVIEW.md
@.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-02-SUMMARY.md
@.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-03-SUMMARY.md
@.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-04-SUMMARY.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1 (Wave 1): WR-02 -- wrap installPlugin in try/catch, route unexpected throws to unexpectedPluginFailures, add lock-test</name>
  <files>extensions/pi-claude-marketplace/orchestrators/import/execute.ts, tests/orchestrators/import/execute.test.ts</files>
  <read_first>
    - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` lines 1-50 (imports -- confirm `errorMessage` already imported from `../../shared/errors.ts` at line 11; confirm `refLabel` is the existing helper used by `dispatchFailedOutcome`)
    - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` lines 620-683 (the existing `for (const plugin of scopePlan.pluginsToInstall)` loop and the installPlugin call at lines 638-646; note the existing `switch (outcome.status) { case "installed": ... case "failed": dispatchFailedOutcome(...) }` shape)
    - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` lines 694-746 (the existing `dispatchFailedOutcome` function -- the catch handler's push MUST match the exact shape at lines 737-745: `{ kind: "plugin-failure", scope: plugin.scope, plugin: plugin.ref.plugin, marketplace: plugin.ref.marketplace, ref: refLabel(plugin), reason: "unexpected-failure", cause }` where `cause: string` -- the catch supplies `cause: errorMessage(err)`)
    - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` lines 457-465 (the V2 mapping `result.unexpectedPluginFailures` → `PluginFailedMessage { reasons: ["not in manifest"] }` in `buildImportNotificationMarketplaces` -- verifies that the new push automatically renders the correct cascade row without further changes)
    - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` lines 748-790 (`importClaudeSettings` outer loop at lines 769-771 and final `notify()` at line 787 -- verifies that the catch-and-continue keeps the loop and the notify intact)
    - `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-REVIEW.md` WR-02 section (lines 118-181) for the locked Option A snippet shape -- particularly the example code block showing `try { outcome = await installPlugin(...) } catch (err) { result.unexpectedPluginFailures.push({...}); continue; }`
    - `tests/orchestrators/import/execute.test.ts` lines 1-48 (the `makeCtx()` helper and `NotifyRecord` shape -- the new test reuses this verbatim)
    - `tests/orchestrators/import/execute.test.ts` lines 343-427 (the existing `"importClaudeSettings classifies unavailable and unexpected plugin failures..."` test -- the closest analog; mocks `installPlugin` to RETURN `status: "failed"`. The new test mocks `installPlugin` to THROW instead. Use the same loadSettings/loadState/addMarketplace scaffolding and the same assertion style for the cascade-row regex.)
  </read_first>
  <action>
    Step 1 -- Edit `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`. Inside `executeScopedPlan` (currently at lines 508-683), locate the per-plugin install loop body. The current code (lines 638-681) calls `const outcome = await installPlugin({ ctx, pi, scope, cwd, marketplace, plugin, notifications: { mode: "orchestrated" } });` followed by `switch (outcome.status) { case "installed": ... case "failed": dispatchFailedOutcome(...) }`.

    Rewrite the call site to declare `outcome` with `let`, wrap the `await installPlugin({...})` in a try/catch, and route unexpected throws to `result.unexpectedPluginFailures` then `continue`. The push payload MUST match `dispatchFailedOutcome`'s shape at lines 737-745 exactly (REVIEW.md WR-02 §Option A):

    - `kind: "plugin-failure"` (literal string)
    - `scope: plugin.scope`
    - `plugin: plugin.ref.plugin`
    - `marketplace: plugin.ref.marketplace`
    - `ref: refLabel(plugin)`
    - `reason: "unexpected-failure"` (literal string)
    - `cause: errorMessage(err)` -- `errorMessage` is already imported from `../../shared/errors.ts` (line 11). DO NOT add a new import.

    After the push, `continue` (skip to the next plugin in the loop, mirroring `dispatchFailedOutcome`'s pattern of recording-and-continuing). The next plugin on the same scope MUST still run; the per-scope outer loop at `importClaudeSettings:769-771` MUST still iterate to the next scope; the final `notify(opts.ctx, opts.pi, { marketplaces })` at line 787 MUST still fire.

    Preserve the existing `switch (outcome.status) { case "installed": ...; case "failed": dispatchFailedOutcome(...) }` block UNCHANGED -- it operates on `outcome` set in the try branch.

    Add a 1-2 line comment above the new try/catch identifying it as the WR-02 fix: `// WR-02 (gap closure, Plan 20-05): catch unexpected installPlugin throws and route them to result.unexpectedPluginFailures matching dispatchFailedOutcome's shape; per-scope loop continues and the final notify() at importClaudeSettings:787 still fires.`

    Step 2 -- Edit `tests/orchestrators/import/execute.test.ts`. Append (do NOT modify existing tests) a new test whose `test(...)` name string matches the regex `/installPlugin.*unexpected.*throw|partial.*cascade/i`. Suggested name: `"importClaudeSettings catches unexpected installPlugin throws and surfaces a partial cascade row (WR-02)"`.

    The test reuses `makeCtx()`. Scaffold THREE plugins on a single scope (e.g., scope `"project"`) -- `before`, `boom`, `after` -- so the test can assert all three of: (a) `before` ran, (b) `boom` was caught and recorded, (c) `after` STILL ran. Mock `installPlugin`:
      - `opts.plugin === "boom"` → `throw new Error("simulated host crash")`.
      - Otherwise → return `{ status: "installed", resourcesChanged: true, declaresAgents: false, declaresMcp: false }`.

    Use the same loadSettings/loadState shape as the existing test at lines 343-427 (mp registered with no plugins). Use `enabledPlugins: { "before@mp": true, "boom@mp": true, "after@mp": true }`.

    Assertions (REQUIRED -- all four):
      1. `assert.deepEqual(attempted, ["before", "boom", "after"])` -- proves the per-plugin loop completes all three despite the throw on `boom`. (Use the same `attempted: string[]` push-in-mock pattern as the existing analogous test at lines 376-377.)
      2. `assert.equal(result.unexpectedPluginFailures.length, 1)` and `assert.equal(result.unexpectedPluginFailures[0]?.plugin, "boom")` and `assert.equal(result.unexpectedPluginFailures[0]?.reason, "unexpected-failure")` and `assert.equal(result.unexpectedPluginFailures[0]?.cause, "simulated host crash")` -- proves the catch handler pushed the correct discriminated entry.
      3. `assert.equal(notifications.length, 1)` and `assert.equal(notifications[0]?.severity, "error")` -- proves the final `notify()` at execute.ts:787 fired exactly once and severity routes to error per D-16-11 (failed plugin row in cascade).
      4. `assert.match(notifications[0]?.message ?? "", /⊘ boom \(failed\) \{not in manifest\}/)` -- proves the `result.unexpectedPluginFailures` entry round-trips through `buildImportNotificationMarketplaces` (lines 457-465) to the existing V2 `PluginFailedMessage { reasons: ["not in manifest"] }` mapping. Also assert `assert.match(notifications[0]?.message ?? "", /● before \(installed\)/)` and `assert.match(notifications[0]?.message ?? "", /● after \(installed\)/)` to lock the loop-continuation guarantee end-to-end.

    DO NOT delete or modify the existing test at lines 343-427 -- it covers the structured `status: "failed"` return path. The new test covers the `throw` path; both are required.

    Run `node --test tests/orchestrators/import/execute.test.ts` after the edits -- MUST exit 0.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace &amp;&amp; grep -c "result.unexpectedPluginFailures.push" extensions/pi-claude-marketplace/orchestrators/import/execute.ts | grep -qE "^[2-9]$" &amp;&amp; node --test tests/orchestrators/import/execute.test.ts 2&gt;&amp;1 | tail -20 &amp;&amp; node --test tests/orchestrators/import/execute.test.ts 2&gt;&amp;1 | grep -iE "installPlugin.*unexpected.*throw|partial.*cascade" | head -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "result.unexpectedPluginFailures.push" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns ≥ 2 (pre-existing in `dispatchFailedOutcome` + new in `executeScopedPlan`).
    - `grep -E "let outcome|let installOutcome" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns ≥ 1 (the try/catch requires the outcome variable be re-assignable; mutable binding scoped to the loop body is fine).
    - `grep -E "catch \\(err\\)" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns a count ≥ 3 (pre-existing loadState catch line 520, pre-existing addMarketplace catch line 592, plus the new installPlugin catch).
    - `grep -c "errorMessage(err)" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns ≥ 3 (pre-existing in loadState catch + addMarketplace catch + new installPlugin catch).
    - `node --test tests/orchestrators/import/execute.test.ts` exits 0.
    - `node --test tests/orchestrators/import/execute.test.ts` output includes a subtest line whose description matches `/installPlugin.*unexpected.*throw|partial.*cascade/i`.
    - The existing test at lines 343-427 (`"importClaudeSettings classifies unavailable and unexpected plugin failures..."`) STILL passes -- the new try/catch must not change the path that goes through the structured `status: "failed"` return.
  </acceptance_criteria>
  <done>WR-02 Option A behavior is in place: unexpected `installPlugin` throws are caught and recorded in `result.unexpectedPluginFailures` matching `dispatchFailedOutcome`'s entry shape; the per-plugin loop continues; the per-scope loop continues; the final `notify()` fires once with a cascade including the failed row. The new test locks all four behavioral guarantees.</done>
</task>

<task type="auto">
  <name>Task 2 (Wave 1): WR-01/WR-03 -- rewrite comment in edge/handlers/plugin/import.ts to match post-WR-02 behavior</name>
  <files>extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts</files>
  <read_first>
    - `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` (entire file, 57 lines -- see the current comment block at lines 52-55)
    - `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-REVIEW.md` WR-01 section (lines 71-116) for the suggested rewrite shape -- note that WR-01's literal §Fix snippet predates the WR-02 fix; the comment written here MUST reflect the POST-WR-02 reality (installPlugin throws are NOW caught)
    - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` lines 518-528 (loadState wrap), lines 577-608 (addMarketplace wrap), and the new try/catch around installPlugin added in Task 1 -- these are the THREE wraps the new comment must cite
  </read_first>
  <action>
    Replace the comment block currently at `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts:52-55` (the comment that reads "No try/catch: the inner `importClaudeSettings` after Plan 20-02 owns its own per-scope try/catch via `executeScopedPlan` (execute.ts:745-755); catastrophic uncaught throws bubble to Pi runtime per D-20-03.").

    The new comment block MUST:
      1. Open with `// No try/catch: ...` (same general structure)
      2. Cite the three per-scope wraps in `executeScopedPlan` BY LINE NUMBER and BY NAME: `loadState` at `execute.ts:518-528`, `addMarketplace` at `execute.ts:577-608`, and `installPlugin` (the new wrap from Task 1; cite as "Plan 20-05 (WR-02 gap closure)" so future readers can find the rationale -- exact line numbers may shift, so the line reference is OPTIONAL for the new installPlugin wrap as long as the function name + WR-02/Plan-20-05 anchor is present)
      3. NOT use the phrase "per-scope try/catch via executeScopedPlan" (overstates safety -- `executeScopedPlan` itself has no function-level catch; the wraps are per-statement inside it)
      4. State that with WR-02 in place, unexpected `installPlugin` throws ARE NOW CAUGHT and routed to `result.unexpectedPluginFailures`, so the per-scope loop continues and the final `notify()` still fires
      5. State that the ONLY remaining catastrophic-throw paths are (a) uncaught throws from `buildImportNotificationMarketplaces` (the inline cascade builder) or (b) bugs in code paths NOT covered by the three wraps -- and per D-20-03 these intentionally bubble to Pi runtime where a stack trace is more useful than a polished message that masks the bug

    Suggested wording (paraphrase acceptable as long as content #1-#5 above is present):

    `// No try/catch: importClaudeSettings wraps loadState (execute.ts:518-528), addMarketplace (execute.ts:577-608), and installPlugin (Plan 20-05 WR-02 gap closure) per-scope; expected installPlugin failures already route through the discriminated {status: "failed"} return. With WR-02 in place, unexpected installPlugin throws are ALSO caught and routed to result.unexpectedPluginFailures; the per-scope loop continues and the final notify() emission still fires. Only uncaught throws from the inline cascade builder (buildImportNotificationMarketplaces) or from code paths NOT covered by these wraps would abort the loop -- per D-20-03 such catastrophic throws bubble to Pi runtime where a stack trace is more useful than a polished message that masks the bug.`

    DO NOT modify any other line in the file (`notifyUsageError` imports, handler body, USAGE constant all stay verbatim).
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace &amp;&amp; grep -c "execute.ts:518-528" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts &amp;&amp; grep -c "execute.ts:577-608" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts &amp;&amp; ( ! grep -q "execute.ts:745-755" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts ) &amp;&amp; ( ! grep -q "per-scope try/catch via .executeScopedPlan" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts ) &amp;&amp; grep -cE "WR-02|Plan 20-05" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "execute.ts:518-528" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns ≥ 1.
    - `grep -c "execute.ts:577-608" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns ≥ 1.
    - `grep -c "execute.ts:745-755" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns 0 (stale citation gone).
    - `grep -E "per-scope try/catch via .executeScopedPlan" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns 0 matches (overstated claim gone).
    - `grep -cE "WR-02|Plan 20-05" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns ≥ 1 (anchor for future readers).
    - The file's behavior is UNCHANGED -- `node --test tests/edge/handlers/import.test.ts` exits 0 with no test count delta.
  </acceptance_criteria>
  <done>The error-boundary comment accurately describes the post-WR-02 contract: three named wraps with their line refs, the WR-02 acknowledgement that installPlugin throws are now caught, and the residual catastrophic-throw escape hatch per D-20-03.</done>
</task>

<task type="auto">
  <name>Task 3 (Wave 2): IN-01 + IN-02 + IN-03 -- quality polish (ESLint comment, defense-in-depth freezes, readonly MarketplaceBlock fields)</name>
  <files>eslint.config.js, extensions/pi-claude-marketplace/orchestrators/import/execute.ts</files>
  <read_first>
    - `eslint.config.js` lines 175-203 (current MSG-Block 1b configuration and the IN-06 comment block -- extension target)
    - `eslint.config.js` lines 144-174 (MSG-Block 1 -- for the `orchestrators/import/**` entry at line 163 the new comment must reference)
    - `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-REVIEW.md` IN-01 section (lines 198-225) for the suggested wording -- paraphrase is acceptable as long as the "Block 1 ignores it, Block 1b does NOT" parallel between `orchestrators/plugin/**` and `orchestrators/import/**` is explicit and the Phase 20 / Plan 20-02 anchor is named
    - `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-REVIEW.md` IN-02 section (lines 227-243) for the "keep + comment" option this task implements
    - `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-REVIEW.md` IN-03 section (lines 244-267) for the readonly modifier snippet
    - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` lines 302-309 (current `MarketplaceBlock` interface declaration -- IN-03 target)
    - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` lines 311-330 (`ensureMarketplaceBlock` -- the ONLY construction site for `MarketplaceBlock`; readonly modifiers on `name`/`scope` must not break it)
    - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` line 354 (`Object.freeze(deps)` in `dependenciesFromInstalled`)
    - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` lines 490 + 499 (the two `Object.freeze` calls in `buildImportNotificationMarketplaces` -- top-level array + per-block `plugins` freeze)
    - Run `grep -nE "\\.name\\s*=|\\.scope\\s*=" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` before locking IN-03; the readonly modifier is safe only if no callers reassign `.name` or `.scope` on a `MarketplaceBlock` instance after construction. (Expected result: no matches; if matches found, narrow the readonly application or split the field rename.)
  </read_first>
  <action>
    Step 1 -- IN-01 (`eslint.config.js` MSG-Block 1b doc note):

    Extend the IN-06 comment block currently at `eslint.config.js:186-194` (the paragraph starting "// IN-06: `orchestrators/plugin/**` is NOT ignored here..."). Add a short paragraph (3-4 lines, JS comment style with `//` prefix per existing convention) immediately below the existing IN-06 paragraph and BEFORE the `files: [...]` array starts. The new paragraph MUST state:

      - The Phase 20 migration (Plan 20-02) extended the same Block-1-ignore treatment to `orchestrators/import/**` (the V1 routing wrappers no longer exist there after the inline V2 cascade construction landed)
      - Just like `orchestrators/plugin/**`, `orchestrators/import/**` is NOT ignored from MSG-Block 1b because MSG-GR-3 project-first iteration discipline is V1-wrapper-INDEPENDENT
      - A maintainer scanning these blocks should see `orchestrators/import/**` follows the same Block-1-ignore / Block-1b-keep pattern as `orchestrators/plugin/**`

    Suggested wording (paraphrase OK):

    `// The Phase 20 migration (Plan 20-02) extended this pattern to`
    `// orchestrators/import/** -- MSG-Block 1 ignores it (the V1 routing`
    `// wrappers no longer exist there after the inline V2 cascade`
    `// construction landed), but MSG-Block 1b does NOT ignore it because`
    `// MSG-GR-3 project-first iteration discipline is V1-wrapper-INDEPENDENT.`

    DO NOT modify the `files: [...]`, `ignores: [...]`, `plugins:`, or `rules:` keys of Block 1b -- comment-only change.

    Step 2 -- IN-02 (`Object.freeze` defense-in-depth comments):

    The codebase grep confirms `Object.freeze(...)` on `readonly`-typed arrays is the dominant convention (≥30 sites across `bridges/**` and `orchestrators/discover.ts`). Drop is NOT chosen; the KEEP-with-comment option is correct here.

    Add a single-line comment immediately above EACH of the three remaining `Object.freeze` call sites in `execute.ts`:

      - Line 354 (`return Object.freeze(deps);` in `dependenciesFromInstalled`):
        `// defense-in-depth: typed readonly + runtime freeze (codebase convention)`
      - Line 490 (`return Object.freeze([...byMp.values()].sort(...).map(...));` in `buildImportNotificationMarketplaces`):
        `// defense-in-depth: typed readonly + runtime freeze (codebase convention)`
      - Line 499 (`plugins: Object.freeze(block.plugins),` inside the `.map((block) => ({...}))` callback):
        `// defense-in-depth: typed readonly + runtime freeze (codebase convention)`

    The comment wording matters for the grep gate: each occurrence MUST contain BOTH `defense-in-depth` AND either `intentional` or `convention` (the grep is `defense-in-depth\|intentional` -- including "convention" is acceptable as long as `defense-in-depth` is present on the same line; the suggested wording satisfies this).

    Step 3 -- IN-03 (`MarketplaceBlock` interface readonly modifiers):

    Verify first: run `grep -nE "\\.name\\s*=|\\.scope\\s*=" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` BEFORE editing. Expected: no matches in any `MarketplaceBlock` instance context. If matches exist on `MarketplaceBlock` instances, STOP -- readonly cannot be applied safely; record in SUMMARY and skip the IN-03 part of this task.

    If verification passes, edit lines 302-309 from:

    ```
    interface MarketplaceBlock {
      readonly key: string;
      name: string;
      scope: Scope;
      status?: MarketplaceStatus;
      reasons?: readonly Reason[];
      plugins: PluginNotificationMessage[];
    }
    ```

    to:

    ```
    interface MarketplaceBlock {
      readonly key: string;
      readonly name: string;
      readonly scope: Scope;
      status?: MarketplaceStatus;
      reasons?: readonly Reason[];
      plugins: PluginNotificationMessage[];
    }
    ```

    (Only `name` and `scope` flip to `readonly`; `key` was already readonly; `status?`, `reasons?`, `plugins` stay mutable -- the builder writes to them in `buildImportNotificationMarketplaces` at lines 400-481.)

    Run `npm run check` after all three steps. MUST exit 0. If typecheck fails because a write site to `.name` or `.scope` was missed, narrow the readonly application or revert IN-03 only (keep IN-01 and IN-02) and record the reason in the SUMMARY.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace &amp;&amp; grep -c "orchestrators/import" eslint.config.js &amp;&amp; grep -B1 "Object.freeze" extensions/pi-claude-marketplace/orchestrators/import/execute.ts | grep -cE "defense-in-depth" &amp;&amp; grep -E "readonly name:|readonly scope:" extensions/pi-claude-marketplace/orchestrators/import/execute.ts | head -3 &amp;&amp; npm run check 2&gt;&amp;1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - IN-01: `grep -c "orchestrators/import" eslint.config.js` returns ≥ 2 (line 163 pre-existing Block 1 ignore entry + new doc note in Block 1b comment). The new doc note explicitly names "Phase 20" or "Plan 20-02" or "Plan 20-05".
    - IN-02: `grep -B1 "Object.freeze" extensions/pi-claude-marketplace/orchestrators/import/execute.ts | grep -c "defense-in-depth"` returns ≥ 3 (one comment per remaining freeze site).
    - IN-02 sanity: `grep -c "Object.freeze" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns ≥ 3 (no freezes accidentally removed -- KEEP-with-comment option, not DROP).
    - IN-03: `grep -E "readonly name:" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns ≥ 1 match within the file (specifically inside the `MarketplaceBlock` interface body at lines 302-309 region). Same for `readonly scope:`.
    - IN-03 sanity: `grep -nE "\\.name\\s*=" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns no matches against a `MarketplaceBlock` instance (no callers reassign `.name`).
    - `npm run check` exits 0 (typecheck + ESLint + Prettier + tests).
    - `node --test tests/architecture/catalog-uat.test.ts` exits 0 (catalog UAT byte-equality unchanged).
  </acceptance_criteria>
  <done>IN-01 / IN-02 / IN-03 all landed with the dominant-convention KEEP-with-comment choice for IN-02 and explicit readonly modifiers for IN-03 verified safe against the builder mutation site. ESLint config carries the import-vs-plugin parallel note. `npm run check` GREEN.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| host runtime → orchestrator | Pi runtime invokes `importClaudeSettings`; any uncaught throw from inside `executeScopedPlan` bubbles back to Pi runtime. WR-02 narrows this boundary: throws from `installPlugin` (a sub-orchestrator that may invoke fs / state-io / bridge work) are now caught and converted to a structured cascade row rather than aborting the per-scope loop. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20.5-01 | Denial of Service (partial result loss) | `executeScopedPlan` per-plugin loop in `orchestrators/import/execute.ts:620-682` | mitigate | WR-02 Option A: wrap installPlugin in try/catch + push to unexpectedPluginFailures + continue. Loop completes; final notify() fires with cascade including the failed row. (Task 1) |
| T-20.5-02 | Repudiation (misleading documentation) | Comment block in `edge/handlers/plugin/import.ts:52-55` | mitigate | WR-01/WR-03 fix: rewrite comment to cite actual wrap line numbers (518-528, 577-608) and acknowledge WR-02's installPlugin wrap. Stale `execute.ts:745-755` removed. (Task 2) |
| T-20.5-03 | Tampering | npm/pip/cargo installs | accept | No new package installs introduced by this plan. Existing audit table from prior phases stands. |
| T-20.5-04 | Information Disclosure | `cause: errorMessage(err)` in unexpectedPluginFailures push | accept | `errorMessage()` is the existing helper at `shared/errors.ts` used by `dispatchFailedOutcome`; it stringifies Error.message without exposing stack traces. Mirrors the pre-existing pattern at lines 737-745 verbatim. No new leak surface. |
</threat_model>

<verification>
Plan-level verification (run after both waves complete):

```
cd /home/acolomba/pi-claude-marketplace
# WR-02 code
grep -c "result.unexpectedPluginFailures.push" extensions/pi-claude-marketplace/orchestrators/import/execute.ts  # expect ≥ 2
# WR-02 test
node --test tests/orchestrators/import/execute.test.ts 2>&1 | grep -iE "installPlugin.*unexpected.*throw|partial.*cascade"  # expect ≥ 1 match
# WR-01/WR-03 comment
grep -c "execute.ts:518-528" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts  # expect ≥ 1
grep -c "execute.ts:745-755" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts  # expect 0
# IN-01 ESLint doc note
grep -c "orchestrators/import" eslint.config.js  # expect ≥ 2
# IN-02 defense-in-depth comments
grep -B1 "Object.freeze" extensions/pi-claude-marketplace/orchestrators/import/execute.ts | grep -c "defense-in-depth"  # expect ≥ 3
# IN-03 readonly modifiers
grep -E "readonly name:|readonly scope:" extensions/pi-claude-marketplace/orchestrators/import/execute.ts  # expect ≥ 1 match each
# Plan-level full-suite gate (NFR-6)
npm run check  # MUST exit 0
# Catalog UAT (sanity -- must be unchanged)
node --test tests/architecture/catalog-uat.test.ts  # MUST exit 0
```
</verification>

<success_criteria>
1. Task 1 (WR-02) lands: `installPlugin` wrapped in try/catch in `executeScopedPlan`; unexpected throws routed to `result.unexpectedPluginFailures` matching `dispatchFailedOutcome`'s entry shape; loop continues; new test in `tests/orchestrators/import/execute.test.ts` locks the four behavioral guarantees.
2. Task 2 (WR-01/WR-03) lands: comment in `edge/handlers/plugin/import.ts:52-55` rewritten to cite `execute.ts:518-528` + `577-608` + new installPlugin wrap; stale `execute.ts:745-755` removed; overstated "per-scope try/catch via executeScopedPlan" claim removed.
3. Task 3 (IN-01 + IN-02 + IN-03) lands: ESLint Block 1b carries the import/plugin parallel note; three `Object.freeze` calls in import/execute.ts carry defense-in-depth comments; `MarketplaceBlock.name` and `.scope` are `readonly`.
4. `npm run check` exits 0 (NFR-6).
5. Catalog UAT byte-equality unchanged (`node --test tests/architecture/catalog-uat.test.ts` exits 0).
6. IN-04 explicitly NOT addressed (deferred per `<gap_inputs>` decision 6).
7. Plans 20-01..20-04 files unchanged; only the 4 listed `files_modified` paths are touched.
</success_criteria>

<output>
Create `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-05-SUMMARY.md` when done. The summary MUST record:
- Which of the 6 gap items closed (WR-01, WR-02, WR-03, IN-01, IN-02, IN-03 -- all 6) and which were deferred (IN-04).
- For IN-03: confirmation that the `grep -nE "\\.name\\s*=|\\.scope\\s*=" execute.ts` precheck returned no matches against `MarketplaceBlock` instances (or, if it failed and IN-03 was reverted, the exact reason).
- For IN-02: confirmation that the dominant-convention KEEP-with-comment option was chosen (with the ≥30-site codebase grep evidence noted) over the DROP option.
- The new test name added to `tests/orchestrators/import/execute.test.ts`.
- Final `npm run check` and `node --test tests/architecture/catalog-uat.test.ts` exit codes (both must be 0).
- Confirmation that SNM-23's behavioral surface is now hardened against unexpected `installPlugin` throws (refinement, not new requirement closure -- the requirement was already satisfied by 20-01..20-04 per VERIFICATION.md).
</output>
