---
phase: 20-migration-wave-3-edge-handlers-usageerror
plan: 4
type: execute
wave: 3
depends_on:
  - 20-01
  - 20-02
  - 20-03
files_modified:
  - eslint.config.js
autonomous: true
requirements:
  - SNM-23
requirements_addressed:
  - SNM-23
must_haves:
  truths:
    - "D-20-07 (additive narrowing strategy; inherits D-19-08 + D-18-07): Plan 20-04 narrows ONLY MSG-Block 1 in `eslint.config.js`. The existing additive `ignores: [...]` array at lines 159-163 currently reads `[\"...orchestrators/marketplace/**\", \"...orchestrators/plugin/**\"]` (Phase 18 entry + Phase 19 entry); Plan 20-04 ADDS `\"extensions/pi-claude-marketplace/orchestrators/import/**\"` so the array covers ALL 3 orchestrator families. After Plan 20-04, Block 1's `files: [\"...orchestrators/**/*.ts\"]` matches files entirely covered by `ignores` -- effectively a no-op. Phase 21 deletes the entire block."
    - "D-20-07 (MSG-Block 1b STAYS UNCHANGED per IN-06 in-file rationale at `eslint.config.js:185-198`): MSG-GR-3 per-scope iteration discipline is V1-wrapper-INDEPENDENT and continues to gate `[\"user\", \"project\"]` literal drift in edge handlers (precedent: `edge/handlers/plugin/import.ts:45` historical `[\"user\", \"project\"]` regression caught by Phase 14.2 CR-01). Block 1b's `files: [\"...orchestrators/**/*.ts\", \"...edge/handlers/**/*.ts\"]` + `ignores: [\"...orchestrators/marketplace/**\"]` STAY as-is. The Phase 19 deferred prediction that Phase 20 would 'remove Block 1b's edge/handlers/** files entry' was OUTDATED relative to IN-06 and is explicitly REJECTED per CONTEXT line 138 + D-20-07."
    - "D-20-07 (MSG-Block 2 STAYS UNCHANGED -- orthogonal to signature change): `msg-sr-7-usage-error-routing` + `msg-nc-2` enforce that argv-validation errors route through `notifyUsageError` (not `notifyError`). The V1 3-arg → V2 1-arg signature change is orthogonal to routing detection; the rule's AST check is on the callee identifier (`notifyUsageError` vs `notifyError`), not the argument count. Block 2's `files: [\"...edge/handlers/**/*.ts\"]` continues to gate routing discipline."
    - "D-20-07 (Blocks 3-6 STAY UNCHANGED): all other MSG-Blocks are global with composer-specific ignores and detect raw string literals at any callsite. Phase 20's migrations construct payloads structurally with no raw token/marker/trailer literals (`notify()` and `notifyUsageError()` own ALL render-time string composition per D-16-04 + SNM-17). No glob narrowing required."
    - "Phase 20 ROADMAP Success Criteria (SC #1-5) end-to-end verification: SC #1 = zero V1 `notifySuccess`/`notifyWarning`/`notifyError` callers remain in `edge/handlers/**/*.ts` (satisfied by Plan 20-01 + Plan 20-03 combined); SC #2 = all ~30 actual `notifyUsageError(ctx, msg, usage)` 3-arg sites migrated to V2 1-arg signature (satisfied by Plan 20-01 sweep); SC #3 = MSG-* lint plugin `files:` globs cover no remaining source files using V1 wrappers (satisfied by Plan 20-04 narrowing); SC #4 = catalog UAT byte-equality GREEN for every edge-handler output + every usage-error output (satisfied by the structural-shape gate for usage errors per D-20-04 + the 4 import catalog fixtures gating Plan 20-02); SC #5 = `npm run check` GREEN (this plan's gate)."
    - "Phase 21 hand-off: After Plan 20-04, all 3 orchestrator families are MSG-Block-1-ignored; Block 1 is effectively a no-op against the migrated codebase. Phase 21 deletes the entire MSG-* plugin wiring (including Blocks 1, 1b, 2, 3, 4a, 4b, 5, 6) per SNM-24/25/27, along with V1 severity-named wrappers + V1 3-arg `notifyUsageError` overload per SNM-22. Phase 21 also deletes `presentation/cascade-summary.ts` (orphaned by Plan 20-02 per CONTEXT line 256) and the other already-orphaned composers (`cause-chain`, `manual-recovery`, `rollback-partial`, `version-arrow`)."
    - "Wave 3 sequencing constraint: Plan 20-04 MUST run AFTER Plans 20-01 + 20-02 + 20-03 ALL land. The lint narrowing assumes every V1 caller in the targeted family has been removed; if any Wave 1/2 plan failed to fully eliminate V1 callers, the MSG-Block 1 / 1b lints would have FIRED at that plan's commit boundary (each Wave 1/2 plan kept `npm run check` GREEN at its merge -- per VALIDATION.md Sampling Rate)."
  byte_contracts:
    - "eslint.config.js MSG-Block 1 ignores array transformation: BEFORE = `ignores: [\"extensions/pi-claude-marketplace/orchestrators/marketplace/**\", \"extensions/pi-claude-marketplace/orchestrators/plugin/**\"]`; AFTER = `ignores: [\"extensions/pi-claude-marketplace/orchestrators/marketplace/**\", \"extensions/pi-claude-marketplace/orchestrators/plugin/**\", \"extensions/pi-claude-marketplace/orchestrators/import/**\"]`. ONE new path string added; no other modifications."
    - "Catalog UAT GREEN end-to-end across all affected surfaces: the 4 `/claude:plugin import` catalog fixtures (`fresh-mixed-both-scopes`, `scope-project-narrow`, `soft-dep-markers`, `same-mp-both-scopes` at `docs/output-catalog.md:572-654`); the 2 `/claude:plugin bootstrap` catalog fixtures (`fresh`, `already-bootstrapped` at `docs/output-catalog.md:656-684`); the single generic `usage-error` fixture (`docs/output-catalog.md:937-943`) gating the structural shape for all 30 Plan-20-01 callsites. The catalog runner drives every `(section, state)` fixture through `notify(mockCtx, mockPi, message)` and asserts byte-equality."
  artifacts:
    - path: "eslint.config.js"
      provides: "MSG-Block 1 `ignores: [...]` array EXTENDED with the third additive path string `\"extensions/pi-claude-marketplace/orchestrators/import/**\"` per D-20-07. MSG-Block 1b unchanged (per IN-06). MSG-Block 2 unchanged (orthogonal). Blocks 3-6 unchanged."
      contains: "extensions/pi-claude-marketplace/orchestrators/import/\\*\\*"
  key_links:
    - from: "eslint.config.js::MSG-Block 1"
      to: "extensions/pi-claude-marketplace/orchestrators/import/**"
      via: "additive ignores entry (third string after Phase 18 + Phase 19 entries)"
      pattern: "ignores:[^]+\"extensions/pi-claude-marketplace/orchestrators/import/\\*\\*\""
  coverage_constraints:
    - "MSG-Block 1 ignores has 3 entries: `grep -c 'extensions/pi-claude-marketplace/orchestrators/\\(marketplace\\|plugin\\|import\\)/\\*\\*' eslint.config.js` returns ≥3 (one per orchestrator family). The marketplace + plugin entries existed from Phase 18 + Phase 19; the import entry is the Plan 20-04 addition."
    - "MSG-Block 1b's `edge/handlers/**` files entry STAYS: `grep -c 'edge/handlers/\\*\\*' eslint.config.js` returns 1 (the Block 1b files entry; Block 2 may also contain this string -- verify both contexts via the line-numbered grep)."
    - "MSG-Block 1b's `ignores: [...]` UNCHANGED: `grep -c '\"extensions/pi-claude-marketplace/orchestrators/marketplace/\\*\\*\"' eslint.config.js` returns 2 (one for Block 1 + one for Block 1b -- Block 1b kept the marketplace entry per IN-06 + Phase 19 inheritance)."
    - "`npm run check` GREEN -- the FINAL phase gate."
    - "Catalog UAT GREEN end-to-end: `node --test tests/architecture/catalog-uat.test.ts` exits 0 across all 4 import fixtures + 2 bootstrap fixtures + 1 generic usage-error fixture."
    - "Phase 20 SC #1 verification: `grep -rE \"^[^/]*notify(Success|Warning|Error)\\(\" extensions/pi-claude-marketplace/edge/handlers/` returns empty (no CallExpression form; tolerated comment references caught by the leading-non-comment grep)."
    - "Phase 20 SC #2 verification: `grep -rE \"notifyUsageError\\(ctx,\\s*\\\"\" extensions/pi-claude-marketplace/edge/` returns 0 (no V1 3-arg string-literal-second-arg form)."
    - "Phase 20 SC #3 verification: `grep -rE \"^[^/]*notify(Success|Warning|Error)\\(\" extensions/pi-claude-marketplace/orchestrators/import/` returns empty (Plan 20-02 cleared the last orchestrator family)."
---

<objective>
Final narrowing + verification plan for Phase 20. Add `"extensions/pi-claude-marketplace/orchestrators/import/**"` to MSG-Block 1's existing additive `ignores: [...]` array in `eslint.config.js` per D-20-07. After this plan, all 3 orchestrator families (`marketplace/**`, `plugin/**`, `import/**`) are MSG-Block-1-ignored; the block's `files:` glob matches files entirely covered by `ignores` -- effectively a no-op (Phase 21 deletes the entire block).

Verify all 5 Phase 20 ROADMAP Success Criteria GREEN end-to-end:

- SC #1: zero V1 `notifySuccess`/`notifyWarning`/`notifyError` callers remain in `edge/handlers/**/*.ts` (satisfied by Plan 20-01 sweep + Plan 20-03 catch-all DROP).
- SC #2: all 30 actual `notifyUsageError(ctx, msg, usage)` 3-arg sites migrated to V2 1-arg signature; the V1 three-argument signature has no remaining callers (deletion happens in Phase 21).
- SC #3: MSG-* lint plugin's `files:` globs cover no remaining source files using V1 wrappers (satisfied by Plan 20-04's MSG-Block 1 additive ignore; the plugin is still wired but effectively a no-op against the migrated codebase).
- SC #4: catalog UAT byte-equality GREEN for every edge-handler output + every usage-error output against the v2.0 spec (the generic usage-error fixture gates the structural shape per D-20-04; the 4 `/claude:plugin import` catalog fixtures + 2 `/claude:plugin bootstrap` fixtures gate the V2 byte form for the affected surfaces).
- SC #5: `npm run check` GREEN -- the final gate Plan 20-04 verifies.

Critical NO-CHANGE invariants per D-20-07:

- **MSG-Block 1b UNCHANGED** per IN-06 in-file rationale (`eslint.config.js:185-198`). MSG-GR-3 per-scope iteration discipline is V1-wrapper-INDEPENDENT; the `edge/handlers/**` files entry STAYS to continue gating `["user", "project"]` literal drift. The Phase 19 deferred prediction was OUTDATED relative to IN-06.
- **MSG-Block 2 UNCHANGED** -- orthogonal to signature change. `msg-sr-7-usage-error-routing` checks the callee identifier, not the argument count. Continues to gate routing discipline in `edge/handlers/**`.
- **Blocks 3-6 UNCHANGED** -- global rules with composer-specific ignores. Phase 20's structural payload construction emits no raw token/marker/trailer literals at orchestrator/edge level.

Purpose: complete Phase 20's contribution to SNM-23 (full closure: the migration HALF is satisfied by Plans 20-01/02/03; the DELETION half closes in Phase 21 via SNM-22). After Plan 20-04, the v1.4 migration waves are complete; Phase 21 cleans up the V1 wrappers + the entire 34-rule MSG-* plugin under `tests/lint-rules/`.

Output: 1 modified file (`eslint.config.js`, 1 path string added to MSG-Block 1's `ignores` array); all 5 Phase 20 Success Criteria proven GREEN end-to-end.
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
@.planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-06-PLAN.md
@.planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-06-SUMMARY.md
@eslint.config.js
@tests/architecture/catalog-uat.test.ts
@CLAUDE.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add `"extensions/pi-claude-marketplace/orchestrators/import/**"` as the third entry to MSG-Block 1's `ignores: [...]` array in eslint.config.js (lines 159-163) per D-20-07; DO NOT modify MSG-Block 1b, MSG-Block 2, or Blocks 3-6</name>
  <read_first>
    - eslint.config.js (full file -- specifically lines 151-205 covering MSG-Block 1 + MSG-Block 1b + the IN-06 in-file rationale comment block at lines 185-198 added by Phase 19 Plan 19-06).
    - 20-RESEARCH.md "MSG-Block 1 Current `ignores` Array (verbatim from `eslint.config.js`)" lines 162-204 (the verified current state + the Plan 20-04 target shape with the new entry added).
    - 20-CONTEXT.md `<decisions>` D-20-07 (additive narrowing rationale; MSG-Block 1b STAYS per IN-06; MSG-Block 2 STAYS as orthogonal to signature change; Blocks 3-6 STAY).
    - 20-PATTERNS.md "(d) Plan 20-04 -- MSG-Block 1 Lint Narrowing (Phase 19 Plan 19-06 Analog)" lines 607-705 (the verbatim current-state + target-state shapes + the verification grep commands for SC #3).
    - .planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-06-PLAN.md + 19-06-SUMMARY.md (the direct structural mirror -- Phase 19 added the second path string `orchestrators/plugin/**`; Plan 20-04 appends the third).
    - .planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-06-SUMMARY.md (the IN-06 in-file rationale precedent that Phase 20 D-20-07 inherits).
  </read_first>
  <files>eslint.config.js</files>
  <action>
    Operate in this order:

    1. LOCATE MSG-Block 1 in `eslint.config.js`. The block starts with the comment `// MSG-Block 1 (MSG-SR-1..6): cascade/severity routing -- orchestrators surface.` at approximately line 151. The current `ignores: [...]` array is at lines 159-163 per 20-RESEARCH.md verification:

       ```javascript
       files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"],
       ignores: [
         "extensions/pi-claude-marketplace/orchestrators/marketplace/**",
         "extensions/pi-claude-marketplace/orchestrators/plugin/**",
       ],
       plugins: { msg: msgPlugin },
       rules: {
         "msg/msg-sr-1-success-routing": "error",
         "msg/msg-sr-2-warning-routing": "error",
         "msg/msg-sr-3-error-routing": "error",
         "msg/msg-sr-4-cascade-success": "error",
         "msg/msg-sr-5-cascade-warning": "error",
         "msg/msg-sr-6-no-cascade-error": "error",
       },
       ```

    2. EDIT the `ignores: [...]` array to add the third entry. After the edit, the array reads:

       ```javascript
       ignores: [
         "extensions/pi-claude-marketplace/orchestrators/marketplace/**",
         "extensions/pi-claude-marketplace/orchestrators/plugin/**",
         "extensions/pi-claude-marketplace/orchestrators/import/**",
       ],
       ```

       Match the existing indentation (typically 6 spaces inside the block); preserve trailing comma per the existing style; place the new entry as the LAST array element (after the `plugin/**` entry).

    3. DO NOT touch MSG-Block 1b (lines 174-203). Per D-20-07 + IN-06 in-file rationale at lines 185-198: MSG-GR-3 per-scope iteration discipline is V1-wrapper-INDEPENDENT; the `files: [..., "edge/handlers/**/*.ts"]` entry STAYS to continue gating `["user", "project"]` literal drift in edge handlers (precedent: `edge/handlers/plugin/import.ts:45` historical regression caught by Phase 14.2 CR-01). The `ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"]` array also STAYS UNCHANGED -- Phase 20 does NOT extend it with the plugin or import entries because Block 1b's rule is iteration-discipline-only, which applies equally to all 3 orchestrator families.

    4. DO NOT touch MSG-Block 2 (the `msg-sr-7-usage-error-routing` + `msg-nc-2` block). Per D-20-07: the V1 3-arg → V2 1-arg signature change is orthogonal to routing detection; the rule's AST check is on the callee identifier (`notifyUsageError` vs `notifyError`), not the argument count. Block 2 continues to gate routing discipline in `edge/handlers/**`.

    5. DO NOT touch MSG-Blocks 3-6. Per D-20-07: all other MSG-Blocks are global with composer-specific ignores and detect raw string literals at any callsite. Phase 20's structural payload construction emits no raw token/marker/trailer literals.

    6. VERIFY the edit is purely additive (no other diffs):

       - `git diff eslint.config.js` shows ONLY the addition of the single path string (1-2 lines added depending on multi-line vs single-line array style; no deletions; no other block changes).
       - `grep -c "extensions/pi-claude-marketplace/orchestrators/import/\\*\\*" eslint.config.js` returns 1 (the newly added entry; ONLY in Block 1 -- NOT in Block 1b).
       - `grep -c "extensions/pi-claude-marketplace/orchestrators/marketplace/\\*\\*" eslint.config.js` returns 2 (Block 1 + Block 1b -- unchanged from Phase 19 + IN-06 retention).
       - `grep -c "extensions/pi-claude-marketplace/orchestrators/plugin/\\*\\*" eslint.config.js` returns 1 (Block 1 only -- Phase 19 added it to Block 1 but NOT to Block 1b per IN-06).
       - `grep -c "edge/handlers/\\*\\*" eslint.config.js` returns ≥1 (the Block 1b `files:` entry STAYS per IN-06; Block 2 may also reference it).

    Honors D-20-07 (narrow ONLY MSG-Block 1 additively; preserve Block 1b per IN-06; preserve Block 2 as orthogonal; preserve Blocks 3-6).
  </action>
  <verify>
    <automated>npm run check</automated>
  </verify>
  <done>
    eslint.config.js MSG-Block 1's `ignores: [...]` array contains the additive `"extensions/pi-claude-marketplace/orchestrators/import/**"` entry (third element). MSG-Block 1b UNCHANGED (per IN-06). MSG-Block 2 UNCHANGED (orthogonal). Blocks 3-6 UNCHANGED. Git diff shows ONLY the additive path string. `npm run check` exits 0 -- the lint plugin still wired but Block 1 is now effectively a no-op against the migrated orchestrator/import/** family (combined with the marketplace/** + plugin/** entries from Phase 18 + Phase 19).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Final end-to-end Phase 20 Success Criteria verification (SC #1, #2, #3, #4, #5 all GREEN)</name>
  <read_first>
    - .planning/ROADMAP.md §"Phase 20: Migration Wave 3 -- Edge Handlers & UsageError" (the canonical SC list at lines 330-345).
    - 20-VALIDATION.md "Per-Task Verification Map" + "Sampling Rate > Before /gsd-verify-work" (the 4 phase-gate grep checks + catalog UAT + `npm run check`).
    - 20-RESEARCH.md "Validation Architecture > Sampling Rate" lines 612-621 (the 4-check phase gate).
    - eslint.config.js (post-Task-1 state).
    - All Wave 1 + Wave 2 plan SUMMARYs: 20-01-SUMMARY.md, 20-02-SUMMARY.md, 20-03-SUMMARY.md (confirm each landed cleanly with V1 callers eliminated).
    - tests/architecture/catalog-uat.test.ts (the byte-equality runner -- exit 0 is the gate).
  </read_first>
  <files>(read-only verification task; no files modified)</files>
  <action>
    Execute the 5 Phase 20 Success Criteria checks end-to-end. Document each check result in the plan SUMMARY with the exact command + observed result + exit code:

    1. **SC #1 (zero V1 callers in edge/handlers/**):**

       Run `grep -rE "^[^/]*notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/edge/handlers/` (comment-tolerant; excludes lines starting with `//`). Expected: empty output (zero CallExpression matches).

       If matches return:
       - Comment lines that mention the V1 wrapper name (e.g., `// notifyError used to ...`) are tolerated.
       - CallExpression form (`notifyError(...)`, `notifySuccess(...)`, `notifyWarning(...)`) means a Wave 1/2 plan failed -- STOP and escalate to operator.

       Combined with the orchestrators/import/** check:

       Run `grep -rE "^[^/]*notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/orchestrators/import/`. Expected: empty (Plan 20-02 cleared the last orchestrator family).

    2. **SC #2 (all V1 3-arg `notifyUsageError` callsites migrated):**

       Run `grep -rE "notifyUsageError\(ctx,\s*\"" extensions/pi-claude-marketplace/edge/`. Expected: empty (no V1 3-arg string-literal-second-arg form remains).

       Run `grep -rE "notifyUsageError\([^,]+,\s*[^{][^,]*,\s*" extensions/pi-claude-marketplace/edge/`. Expected: empty (no V1 3-arg form remains in any shape -- this catches the wider pattern including non-literal second args).

       Run `grep -rcE "notifyUsageError\(ctx,\s*\{" extensions/pi-claude-marketplace/edge/` and confirm the total across files equals 30 (the verified Plan 20-01 site count).

    3. **SC #3 (MSG-* lint plugin `files:` globs effectively no-op for migrated families):**

       Run `grep -c "extensions/pi-claude-marketplace/orchestrators/import/\\*\\*" eslint.config.js`. Expected: 1 (the Plan 20-04 addition; ONLY in Block 1, NOT in Block 1b per IN-06).

       Run `npx eslint extensions/pi-claude-marketplace/orchestrators/import/` and confirm exit 0 (the MSG-SR-* rules no longer fire on the import family). If ESLint reports other rule violations unrelated to MSG-Block 1, document them in SUMMARY but they are out of scope for SC #3.

       Alternatively run `npm run lint -- extensions/pi-claude-marketplace/orchestrators/import/` and confirm GREEN.

    4. **SC #4 (catalog UAT byte-equality GREEN for every edge-handler output and every usage-error output against the v2.0 spec):**

       Run `node --test tests/architecture/catalog-uat.test.ts` and confirm exit code 0. Per D-20-04, the structural-shape interpretation: the single generic `usage-error` fixture gates the v2.0 structural contract for all 30 Plan-20-01 callsites; per-handler unit tests gate the per-callsite content against `notify()`'s actual emission via mock `ctx`. Plus the 4 `/claude:plugin import` fixtures at `docs/output-catalog.md:572-654` gate Plan 20-02's cascade migration; the 2 `/claude:plugin bootstrap` fixtures gate the happy path through bootstrap.ts (Plan 20-03's DROP does NOT touch the happy-path emissions).

       If exit code is non-zero, the catalog UAT report identifies which `(section, state)` pair diverged. The remediation belongs to the corresponding Wave 1/2 plan -- escalate via a follow-up fix-up rather than amending Plan 20-04.

    5. **SC #5 (`npm run check` GREEN):**

       Run `npm run check` and confirm exit code 0 (typecheck + ESLint + Prettier + tests all pass).

       Confirm scope check: `git diff --name-only main..HEAD -- extensions/pi-claude-marketplace/orchestrators/marketplace/ extensions/pi-claude-marketplace/orchestrators/plugin/` -- expect this to be empty for Phase-20-introduced changes (only Phase 18 + Phase 19 should have modified those directories on `main`).

    6. DOCUMENT each check result in the plan SUMMARY:

       - SC #1: exact grep commands + output (expected: empty for both edge/handlers/ and orchestrators/import/).
       - SC #2: exact grep commands + output (expected: 0 V1 3-arg matches; 30 V2 1-arg matches).
       - SC #3: exact `grep -c` output for eslint.config.js (expected: 1 new entry); `npx eslint` exit code (expected: 0); document Block 1's effective no-op status against all 3 orchestrator families.
       - SC #4: catalog UAT exit code (expected: 0) + per-section subtest pass count for the 7 affected fixtures (4 import + 2 bootstrap + 1 usage-error).
       - SC #5: `npm run check` exit code (expected: 0); scope check confirming no Phase-20-introduced changes to non-import orchestrator families.

    If any check fails: STOP. Phase 20 is not complete; the failing criterion must be remediated either via a follow-up Wave 1/2 fix-up plan or by reverting the offending edits and re-merging. Escalate to operator.

    Honors all 5 ROADMAP §Phase 20 Success Criteria + 20-VALIDATION.md per-task verification map.
  </action>
  <verify>
    <automated>npm run check &amp;&amp; node --test tests/architecture/catalog-uat.test.ts &amp;&amp; ( ! grep -rE "^[^/]*notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/edge/handlers/ ) &amp;&amp; ( ! grep -rE "^[^/]*notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/orchestrators/import/ ) &amp;&amp; ( ! grep -rE "notifyUsageError\(ctx,\s*\"" extensions/pi-claude-marketplace/edge/ )</automated>
  </verify>
  <done>
    All 5 Phase 20 Success Criteria proven GREEN:
    - SC #1: grep returns 0 V1 wrapper callsites in `edge/handlers/**` + `orchestrators/import/**` (comments tolerated; CallExpression form returns nothing).
    - SC #2: grep returns 0 V1 3-arg `notifyUsageError` callsites in `edge/**`; 30 V2 1-arg callsites present (matches the verified Plan 20-01 site count).
    - SC #3: eslint.config.js MSG-Block 1 contains the additive `orchestrators/import/**` entry; targeted lint over `orchestrators/import/` is GREEN; Block 1 is effectively a no-op against all 3 orchestrator families (combined Phase 18 + Phase 19 + Phase 20 entries).
    - SC #4: catalog UAT exits 0 against the 4 import + 2 bootstrap + 1 usage-error fixtures.
    - SC #5: `npm run check` exits 0; no Phase-20-introduced changes to non-import orchestrator families (scope check passes).
    Phase 20 deliverables complete; Phase 21 (Final Teardown + GREEN Gate) can begin (deletes V1 wrappers per SNM-22; deletes 34-rule MSG-* lint plugin under tests/lint-rules/ per SNM-24/25/27; deletes orphaned presentation/* composers including `cascade-summary.ts` per SNM-22).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Lint config narrowing + verification; no source-code execution changes; byte output unchanged from Phase 17 catalog. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-04-01 | T (Tampering: regression to V1 surfaces in unmigrated paths) | MSG-Block 1 `ignores: [...]` extension | accept | Per RESEARCH §Threat Model row 3: MSG-Block 1's `ignores` only covers the 3 orchestrator families. The rest of `extensions/pi-claude-marketplace/**/*.ts` is still covered by Block 1's `files:` glob (no-op via the ignores, but the underlying rules still execute when `files:` matches and `ignores:` doesn't). MSG-Block 1b's `edge/handlers/**` files entry STAYS per IN-06 -- iteration discipline is V1-wrapper-INDEPENDENT and continues to gate `["user", "project"]` regressions. The grep gates in Task 2 SC verification provide secondary verification. Risk LOW. |
| T-20-04-02 | (none) | eslint.config.js additive ignores | accept | No new threats -- lint config change with no runtime effect. The ignore is scoped narrowly to the migrated import family; non-migrated paths remain fully linted by MSG-Block 1 + 1b. Phase 21 will eventually delete the entire MSG-* plugin; until then, the additive contract preserves the security-critical no-direct-notify-outside-shared/notify.ts invariant (IL-2) via MSG-Block 4a + 5 (still cover `shared/notify.ts` boundary enforcement per Phase 16 bounded windows). Risk NONE. |
| T-20-04-SC | T (Supply chain: npm/pip/cargo installs) | (none) | accept | Plan 20-04 performs NO package installs. Pure config edit + verification commands. 20-RESEARCH.md `## Package Legitimacy Audit` is not required. Risk NONE for this plan. |
</threat_model>

<verification>
- `npm run check` exits 0.
- `node --test tests/architecture/catalog-uat.test.ts` exits 0 across all 7 Phase-20-affected fixtures (4 `/claude:plugin import` + 2 `/claude:plugin bootstrap` + 1 generic usage-error).
- `grep -rE "^[^/]*notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/edge/handlers/` returns empty (no CallExpression matches; tolerated comment references caught by the leading-non-comment grep).
- `grep -rE "^[^/]*notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/orchestrators/import/` returns empty.
- `grep -rE "notifyUsageError\(ctx,\s*\"" extensions/pi-claude-marketplace/edge/` returns empty (no V1 3-arg form).
- `grep -c "extensions/pi-claude-marketplace/orchestrators/import/\*\*" eslint.config.js` returns 1 (Plan 20-04 addition; in Block 1 ONLY).
- `grep -c "extensions/pi-claude-marketplace/orchestrators/marketplace/\*\*" eslint.config.js` returns 2 (Block 1 + Block 1b; unchanged from Phase 19 + IN-06 retention).
- `grep -c "extensions/pi-claude-marketplace/orchestrators/plugin/\*\*" eslint.config.js` returns 1 (Block 1 only; Phase 19 added it to Block 1 but NOT Block 1b per IN-06).
- `grep -c "edge/handlers/\*\*" eslint.config.js` returns ≥1 (Block 1b `files:` entry STAYS per IN-06; Block 2 may also reference it).
- `git diff --name-only main..HEAD -- extensions/pi-claude-marketplace/orchestrators/marketplace/ extensions/pi-claude-marketplace/orchestrators/plugin/` returns empty for Phase-20-introduced changes.
</verification>

<success_criteria>
All 5 ROADMAP §Phase 20 Success Criteria proven GREEN end-to-end:

1. Zero `notifySuccess` / `notifyWarning` / `notifyError` callers in `edge/handlers/**/*.ts` (satisfied by Plans 20-01 + 20-03).
2. All 30 actual `notifyUsageError(ctx, msg, usage)` 3-arg sites migrated to V2 1-arg signature; V1 three-argument signature has no remaining callers (satisfied by Plan 20-01 sweep; V1 overload deletion happens in Phase 21).
3. MSG-* lint plugin's `files:` globs cover no remaining source files using V1 wrappers (Block 1 effectively no-op across all 3 orchestrator families after Plan 20-04; Block 1b iteration discipline + Block 2 routing discipline + Blocks 3-6 string-literal detection STAY for unmigrated rule scope).
4. Catalog UAT byte-equality GREEN for every edge-handler output + every usage-error output against the v2.0 spec (4 import + 2 bootstrap + 1 generic usage-error fixtures all pass).
5. `npm run check` GREEN.

SNM-23 migration half closed; deletion half closes in Phase 21 via SNM-22 (V1 wrappers + V1 3-arg `notifyUsageError` overload deletion + 34-rule MSG-* lint plugin teardown).
</success_criteria>

<output>
Create `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-04-SUMMARY.md` documenting:
- The 1 file modified (`eslint.config.js`, 1 path string added to MSG-Block 1's `ignores` array).
- The verification matrix: 5 Success Criteria, each with the exact command run + observed result + exit code.
- The contribution to SNM-23 closure (migration half complete after this plan; deletion half closes in Phase 21 via SNM-22).
- The hand-off to Phase 21: V1 wrappers (`notifySuccess` / `notifyWarning` / `notifyError` / V1 3-arg `notifyUsageError` overload) + the 34-rule MSG-* lint plugin under `tests/lint-rules/` + `presentation/cascade-summary.ts` (orphaned by Plan 20-02) + the other already-orphaned composers (`cause-chain`, `manual-recovery`, `rollback-partial`, `version-arrow`) + the bounded `shared/notify.ts` ignores on MSG-Block 4a + 5 + the `shared/grammar/*` closed-set files all get deleted in Phase 21.
- Confirmation of the IN-06 in-file rationale retention: MSG-Block 1b's `edge/handlers/**` files entry STAYS (not removed by Plan 20-04 per D-20-07; the Phase 19 deferred prediction was OUTDATED).
- The full 5-row Phase 20 Success Criteria verification table for ROADMAP closure tracking.
- Atomic single-commit Conventional Commits message: `chore(20): narrow MSG-Block 1 ignores to cover orchestrators/import (SNM-23)`. SKIP=trufflehog if executing inside a worktree (per CLAUDE.md).
</output>
</content>
</invoke>
