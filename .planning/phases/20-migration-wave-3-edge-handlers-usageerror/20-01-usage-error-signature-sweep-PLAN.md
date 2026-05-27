---
phase: 20-migration-wave-3-edge-handlers-usageerror
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - tests/edge/router.test.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/autoupdate.test.ts
  - tests/edge/handlers/marketplace/list.test.ts
  - tests/edge/handlers/marketplace/remove.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/edge/handlers/plugin/list.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/handlers/import.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
autonomous: true
requirements:
  - SNM-23
requirements_addressed:
  - SNM-23
must_haves:
  truths:
    - "D-20-01 / SNM-23: Plan 20-01 is the Wave 1 mechanical signature sweep across all 30 `notifyUsageError(ctx, msg, usage)` V1 3-arg callsites in 13 production edge files. Migration target: V2 `notifyUsageError(ctx, { message: msg, usage })` per SNM-13 + D-16-02. Atomic single commit covering both Task 1 (15 sites in router + marketplace handlers + plugin/shared + plugin/list) and Task 2 (15 sites in 5 plugin handlers: install/update/reinstall/import/bootstrap)."
    - "D-20-04 + V1 ≡ V2 byte invariance: the dual-overload renderer at `shared/notify.ts:127-156` emits byte-identical output for both forms (`${message}\\n\\n${usage}` at severity `\"error\"`). The migration is a SIGNATURE change at call sites only -- byte form on the wire is unchanged. Therefore test assertions stay BYTE-IDENTICAL per D-20-06 (D-19-07 inheritance)."
    - "D-20-06: tests stay END-TO-END through real `notifyUsageError()` via existing makeCtx() pattern recording `{ message, severity }` tuples; no assertion edits required because byte form is invariant; the only test-file edits would be if the test itself constructs a V1 call directly (rare -- most tests assert on recorded notifications, not on the call form)."
    - "Claude's Discretion (CONTEXT line 149): inline `{ message, usage }` construction at each callsite is the structural-payload-at-callsite discipline of Phases 18/19; helper extraction is NOT recommended for Plan 20-01 to preserve mechanical-sweep simplicity."
    - "Claude's Discretion (CONTEXT line 154): `edge/args-schema.ts` callback parameter `notifyError: (message: string) => void` is internal closure-passing (NOT a `shared/notify.ts` wrapper import) -- explicitly OUT OF SCOPE per CONTEXT line 46. Cosmetic rename deferred to Phase 21."
    - "Plan 20-01 atomic single commit boundary: all 13 production-file mutations + their lockstep test updates land in ONE commit. Per-file pre-commit hook validates as a unit; `npm run check` GREEN at the commit boundary."
    - "Import lines: `notifyUsageError` is already imported in every touched file (verified line numbers per 20-RESEARCH.md per-file site table). NO new imports required for Plan 20-01. The `notifyError` co-imports in `edge/handlers/plugin/{bootstrap,import}.ts` STAY (Plan 20-03 drops them with the catch-all wrappers; Plan 20-01 does NOT touch the import lines)."
  byte_contracts:
    - "All 30 sites: V1 `notifyUsageError(ctx, message, USAGE)` -> V2 `notifyUsageError(ctx, { message, usage: USAGE })`. Test assertions on `note.message` (e.g. `assert.match(notifications[0]?.message ?? \"\", /Usage:/)` or `assert.equal(note.message, \"<V1 byte string>\")`) stay BYTE-IDENTICAL because the renderer produces `${message}\\n\\n${usage}` at `\"error\"` severity for both overloads."
    - "Catalog UAT generic `usage-error` fixture at `docs/output-catalog.md:937-943` continues to assert the structural shape gate; the migration is structurally invariant per D-20-04."
  artifacts:
    - path: "extensions/pi-claude-marketplace/edge/router.ts"
      provides: "4 V2 notifyUsageError signature swaps at lines 125, 148, 161, 181 (router argv-routing usage errors)"
      contains: "notifyUsageError(ctx, { message"
    - path: "extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts"
      provides: "3 V2 notifyUsageError signature swaps at lines 58, 85, 95 (shared edge helper)"
      contains: "notifyUsageError(ctx, { message"
    - path: "extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts"
      provides: "1 V2 notifyUsageError signature swap at line 43"
      contains: "notifyUsageError(ctx, { message"
    - path: "extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts"
      provides: "1 V2 notifyUsageError signature swap at line 38"
      contains: "notifyUsageError(ctx, { message"
    - path: "extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts"
      provides: "1 V2 notifyUsageError signature swap at line 36"
      contains: "notifyUsageError(ctx, { message"
    - path: "extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts"
      provides: "1 V2 notifyUsageError signature swap at line 36"
      contains: "notifyUsageError(ctx, { message"
    - path: "extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts"
      provides: "1 V2 notifyUsageError signature swap at line 40"
      contains: "notifyUsageError(ctx, { message"
    - path: "extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts"
      provides: "3 V2 notifyUsageError signature swaps at lines 52, 65, 75"
      contains: "notifyUsageError(ctx, { message"
    - path: "extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts"
      provides: "3 V2 notifyUsageError signature swaps at lines 36, 48, 61"
      contains: "notifyUsageError(ctx, { message"
    - path: "extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts"
      provides: "3 V2 notifyUsageError signature swaps at lines 40, 57, 65"
      contains: "notifyUsageError(ctx, { message"
    - path: "extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts"
      provides: "4 V2 notifyUsageError signature swaps at lines 34, 44, 52, 86"
      contains: "notifyUsageError(ctx, { message"
    - path: "extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts"
      provides: "2 V2 notifyUsageError signature swaps at lines 31, 36 (notifyError import line 7 STAYS; Plan 20-03 drops it with the catch-all)"
      contains: "notifyUsageError(ctx, { message"
    - path: "extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts"
      provides: "3 V2 notifyUsageError signature swaps at lines 38, 43, 49 (notifyError import line 21 STAYS; Plan 20-03 drops it with the catch-all)"
      contains: "notifyUsageError(ctx, { message"
  key_links:
    - from: "extensions/pi-claude-marketplace/edge/router.ts"
      to: "extensions/pi-claude-marketplace/shared/notify.ts::notifyUsageError (V2 overload at line 129)"
      via: "V2 1-arg structured payload `notifyUsageError(ctx, { message, usage })`"
      pattern: "notifyUsageError\\(ctx,\\s*\\{\\s*message"
    - from: "extensions/pi-claude-marketplace/edge/handlers/**/*.ts"
      to: "extensions/pi-claude-marketplace/shared/notify.ts::UsageErrorMessage (line 290)"
      via: "structured payload type `{ readonly message: string; readonly usage: string }`"
      pattern: "\\{\\s*message[^}]+usage:\\s*USAGE"
    - from: "tests/edge/**/*.test.ts"
      to: "extensions/pi-claude-marketplace/shared/notify.ts::notifyUsageError (V2 overload)"
      via: "makeCtx() recording of byte-identical `${message}\\n\\n${usage}` at `\"error\"` severity"
      pattern: "notifications\\[0\\]\\?\\.(message|severity)"
  coverage_constraints:
    - "Zero V1 3-arg callsites remain: `grep -rcE \"notifyUsageError\\(ctx,\\s*\\\"\" extensions/pi-claude-marketplace/edge/` returns 0 (no V1 string-literal-as-second-arg form)."
    - "Zero V1 3-arg callsites remain (broader pattern): `grep -rE \"notifyUsageError\\([^,]+,\\s*[^{][^,]*,\\s*\" extensions/pi-claude-marketplace/edge/ | wc -l` returns 0 (no third-arg form)."
    - "30 V2 callsites present: `grep -rcE \"notifyUsageError\\(ctx,\\s*\\{\" extensions/pi-claude-marketplace/edge/` summed across all files returns 30 (matches verified 20-RESEARCH.md per-file site table)."
    - "All 13 edge production-file unit-test suites remain GREEN: `node --test tests/edge/router.test.ts tests/edge/handlers/marketplace/*.test.ts tests/edge/handlers/plugin/*.test.ts tests/edge/handlers/import.test.ts` exits 0."
    - "Catalog UAT `usage-error` fixture remains byte-equal at `tests/architecture/catalog-uat.test.ts` (structural-shape gate per D-20-04)."
    - "`npm run check` GREEN at the atomic commit boundary."
---

<objective>
Migrate all 30 `notifyUsageError(ctx, message, USAGE)` V1 3-arg callsites in 13 production edge files to the V2 1-arg structured form `notifyUsageError(ctx, { message, usage: USAGE })` per SNM-23 + D-20-01 + D-20-06.

V1 sites to migrate (per 20-RESEARCH.md per-file table verified 2026-05-27 -- total 30 sites):

Task 1 (15 sites across 8 files):

- `edge/router.ts`: lines 125, 148, 161, 181 (4 sites)
- `edge/handlers/plugin/shared.ts`: lines 58, 85, 95 (3 sites)
- `edge/handlers/marketplace/add.ts`: line 43 (1 site)
- `edge/handlers/marketplace/autoupdate.ts`: line 38 (1 site)
- `edge/handlers/marketplace/list.ts`: line 36 (1 site)
- `edge/handlers/marketplace/remove.ts`: line 36 (1 site)
- `edge/handlers/marketplace/update.ts`: line 40 (1 site)
- `edge/handlers/plugin/list.ts`: lines 40, 57, 65 (3 sites)

Task 2 (15 sites across 5 files):

- `edge/handlers/plugin/install.ts`: lines 52, 65, 75 (3 sites)
- `edge/handlers/plugin/update.ts`: lines 36, 48, 61 (3 sites)
- `edge/handlers/plugin/reinstall.ts`: lines 34, 44, 52, 86 (4 sites)
- `edge/handlers/plugin/import.ts`: lines 31, 36 (2 sites; `notifyError` co-import line 7 STAYS -- Plan 20-03 drops it with the catch-all)
- `edge/handlers/plugin/bootstrap.ts`: lines 38, 43, 49 (3 sites; `notifyError` co-import line 21 STAYS -- Plan 20-03 drops it with the catch-all)

Update each touched file's unit tests in lockstep with byte-identical assertions per D-20-06 (D-19-07 inheritance) -- the V1 and V2 renderer overloads produce the same on-the-wire `${message}\n\n${usage}` at `"error"` severity (verified at `shared/notify.ts:127-156`), so the existing `makeCtx()`-recorded byte assertions need no edits.

Purpose: close the SNM-23 migration half (the V1 3-arg signature has no remaining callers after Plan 20-01 lands; the deletion half closes in Phase 21 via SNM-22). This is the structurally simplest plan in Phase 20 -- pure mechanical signature swap with byte-invariant output.

Output: 13 modified production files + their lockstep test updates in ONE atomic commit; 30 V1 3-arg callsites retired (15 in Task 1 + 15 in Task 2); ZERO byte-form regressions.
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
@docs/output-catalog.md
@CLAUDE.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Migrate 15 sites across edge/router.ts (4) + edge/handlers/plugin/shared.ts (3) + edge/handlers/marketplace/*.ts (5 sites across 5 files) + edge/handlers/plugin/list.ts (3) -- swap V1 3-arg `notifyUsageError(ctx, msg, USAGE)` to V2 1-arg `notifyUsageError(ctx, { message: msg, usage: USAGE })`</name>
  <read_first>
    - extensions/pi-claude-marketplace/edge/router.ts (full file -- 4 sites at lines 125, 148, 161, 181; identify the surrounding `parseCommandArgs` callback pattern in `(message) => notifyUsageError(ctx, message, USAGE)` form vs the direct-call form `notifyUsageError(ctx, "<literal>", USAGE)`).
    - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts (full file -- 3 sites at lines 58, 85, 95).
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts (line 43); autoupdate.ts (line 38); list.ts (line 36); remove.ts (line 36); update.ts (line 40).
    - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts (lines 40, 57, 65).
    - extensions/pi-claude-marketplace/shared/notify.ts lines 127-156 (the V1 + V2 dual-overload signature and body; verify the byte-equality contract `${message}\n\n${usage}` at `"error"` severity for both forms).
    - extensions/pi-claude-marketplace/shared/notify.ts line 290 (UsageErrorMessage interface: `{ readonly message: string; readonly usage: string }`).
    - tests/edge/router.test.ts + tests/edge/handlers/marketplace/{add,autoupdate,list,remove,update}.test.ts + tests/edge/handlers/plugin/list.test.ts (full files; identify `makeCtx()` mock and any direct V1 call constructions in test code; identify byte-string assertions on `notifications[0]?.message`).
    - 20-PATTERNS.md "Pattern Assignments > (a) Plan 20-01" lines 56-196 (recipe + per-file site map + test discipline).
    - 20-RESEARCH.md "Per-File Site Table" lines 95-114 (verified line numbers).
    - .planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-CONTEXT.md `<decisions>` D-20-01 (mechanical sweep structure) + D-20-04 (byte invariance + catalog gate) + D-20-06 (test discipline).
  </read_first>
  <files>
    extensions/pi-claude-marketplace/edge/router.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts,
    extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts,
    extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts,
    extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts,
    extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts,
    extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts,
    tests/edge/router.test.ts,
    tests/edge/handlers/marketplace/add.test.ts,
    tests/edge/handlers/marketplace/autoupdate.test.ts,
    tests/edge/handlers/marketplace/list.test.ts,
    tests/edge/handlers/marketplace/remove.test.ts,
    tests/edge/handlers/marketplace/update.test.ts,
    tests/edge/handlers/plugin/list.test.ts
  </files>
  <action>
    Operate in this order:

    1. SWEEP across 8 production files. For each V1 3-arg callsite, swap to V2 1-arg structured form per the 20-PATTERNS.md recipe. Three callsite shapes apply:

       Shape A (callback form -- the dominant pattern in `parseCommandArgs` consumers): the V1 line reads `notifyUsageError(ctx, message, USAGE)` inside `(message) => { ... }`. After the swap, the line reads `notifyUsageError(ctx, { message, usage: USAGE })`. The closure captures `message` from the callback parameter; the V2 payload uses object-property shorthand for `message` and explicit `usage: USAGE` referencing the local `USAGE` constant.

       Shape B (direct-call form -- argv-validation literal messages, e.g. `edge/router.ts` may carry these): the V1 line reads `notifyUsageError(ctx, "literal message", USAGE)`. After the swap, the line reads `notifyUsageError(ctx, { message: "literal message", usage: USAGE })`.

       Shape C (multi-arg / wrapped form -- present where the message contains a function call like `errorMessage(err)`): the V1 line reads `notifyUsageError(ctx, errorMessage(err), USAGE)`. After the swap, the line reads `notifyUsageError(ctx, { message: errorMessage(err), usage: USAGE })`.

       Per-file mappings (15 sites total for Task 1):

       - `edge/router.ts` (4 sites at lines 125, 148, 161, 181): swap each per the appropriate shape (read the file to determine A/B/C per site).
       - `edge/handlers/plugin/shared.ts` (3 sites at lines 58, 85, 95): swap per appropriate shape.
       - `edge/handlers/marketplace/add.ts` (line 43): single callback-form swap.
       - `edge/handlers/marketplace/autoupdate.ts` (line 38): single callback-form swap.
       - `edge/handlers/marketplace/list.ts` (line 36): single callback-form swap.
       - `edge/handlers/marketplace/remove.ts` (line 36): single callback-form swap.
       - `edge/handlers/marketplace/update.ts` (line 40): single callback-form swap.
       - `edge/handlers/plugin/list.ts` (lines 40, 57, 65): three swaps per appropriate shapes.

       Inline construction per D-19-07 inheritance (CONTEXT line 149) -- NO helper extraction. Each swap is a single-line edit; total 15 line edits across 8 files.

    2. IMPORT CHECK. Verify each touched production file imports `notifyUsageError` from `../../../shared/notify.ts` (path may be `../../shared/notify.ts` for `router.ts`). Per 20-RESEARCH.md verified import lines: `router.ts:27`, `plugin/shared.ts:9`, `marketplace/add.ts:18`, `marketplace/autoupdate.ts:14`, `marketplace/list.ts:18`, `marketplace/remove.ts:18`, `marketplace/update.ts:18`, `plugin/list.ts:16`. NO import changes required for any file in this task.

    3. TEST FILE UPDATES (lockstep with each production file mutation). For each touched test file:

       - `tests/edge/router.test.ts`, `tests/edge/handlers/marketplace/{add,autoupdate,list,remove,update}.test.ts`, `tests/edge/handlers/plugin/list.test.ts`: grep for `notifyUsageError(` to identify whether tests directly construct V1 calls. If the test code itself contains a `notifyUsageError(ctx, "msg", USAGE)` direct invocation (rare -- most tests assert on `notifications[0]?.message` via `makeCtx()`), swap to V2 form. Otherwise NO test edit -- the byte-equality assertions stay byte-identical.

       - The dominant pattern (verified per 20-PATTERNS.md lines 180-195) is: `assert.match(notifications[0]?.message ?? "", /Usage:/)` + `assert.equal(notifications[0]?.severity, "error")`. This form is invariant under the V1 -> V2 migration.

       - Verify each test file still compiles + passes after the production-side swap. The `makeCtx()` mock pattern is preserved verbatim per D-20-06.

    4. VERIFY post-edit (per 20-VALIDATION.md sampling rate):

       - `grep -cE "notifyUsageError\(ctx,\s*\"" extensions/pi-claude-marketplace/edge/router.ts extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts extensions/pi-claude-marketplace/edge/handlers/marketplace/*.ts extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` returns 0 (no V1 string-literal-second-arg form).
       - `grep -cE "notifyUsageError\(ctx,\s*\{" extensions/pi-claude-marketplace/edge/router.ts extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts extensions/pi-claude-marketplace/edge/handlers/marketplace/*.ts extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` (summed across all files) returns 15 (the V2 form count for Task 1's surface).
       - `node --test tests/edge/router.test.ts tests/edge/handlers/marketplace/*.test.ts tests/edge/handlers/plugin/list.test.ts` exits 0.

    Honors D-20-01 (mechanical sweep) + D-20-04 (byte invariance) + D-20-06 (test discipline) + D-19-07 (inline construction) + CONTEXT line 149 (no helper extraction).
  </action>
  <verify>
    <automated>node --test tests/edge/router.test.ts tests/edge/handlers/marketplace/add.test.ts tests/edge/handlers/marketplace/autoupdate.test.ts tests/edge/handlers/marketplace/list.test.ts tests/edge/handlers/marketplace/remove.test.ts tests/edge/handlers/marketplace/update.test.ts tests/edge/handlers/plugin/list.test.ts</automated>
  </verify>
  <done>
    15 V1 3-arg callsites swapped to V2 1-arg structured form across 8 production files (router.ts + plugin/shared.ts + 5 marketplace handlers + plugin/list.ts). Inline `{ message, usage: USAGE }` payload at each callsite per D-19-07 inheritance. All 7 touched test files compile + pass. Byte-equality assertions stay byte-identical (V1 ≡ V2 wire form). No import-line changes. Mid-plan -- continues to Task 2 for the remaining 15 sites in plugin handlers; both tasks share one atomic commit.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Migrate remaining 15 sites across edge/handlers/plugin/{install (3), update (3), reinstall (4), import (2), bootstrap (3)} -- swap V1 3-arg `notifyUsageError(ctx, msg, USAGE)` to V2 1-arg `notifyUsageError(ctx, { message: msg, usage: USAGE })`; preserve the mixed `notifyError, notifyUsageError` import in import.ts + bootstrap.ts (Plan 20-03 drops notifyError)</name>
  <read_first>
    - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts (full file -- 3 sites at lines 52, 65, 75).
    - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts (full file -- 3 sites at lines 36, 48, 61).
    - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts (full file -- 4 sites at lines 34, 44, 52, 86).
    - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts (full file -- 2 usage-error sites at lines 31, 36; identify the `notifyError` import at line 7 -- KEEP IT, Plan 20-03 drops it with the catch-all wrapper at lines 47-50).
    - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts (full file -- 3 usage-error sites at lines 38, 43, 49; identify the `notifyError` import at line 21 -- KEEP IT, Plan 20-03 drops it with the catch-all wrapper at lines 57-66).
    - extensions/pi-claude-marketplace/shared/notify.ts lines 127-156 (dual-overload byte-equality).
    - tests/edge/handlers/plugin/{install,update,reinstall,bootstrap}.test.ts + tests/edge/handlers/import.test.ts (the production-source `edge/handlers/plugin/import.ts` maps to test path `tests/edge/handlers/import.test.ts` per 20-PATTERNS.md line 587-590 path-correction note).
    - 20-PATTERNS.md "Pattern Assignments > (a) Plan 20-01" (recipe per-site shape + import preservation note for import.ts + bootstrap.ts).
    - 20-RESEARCH.md "Per-File Site Table" lines 109-113 (verified line numbers for the 5 plugin handlers).
    - 20-CONTEXT.md `<decisions>` D-20-01 + D-20-03 (Plan 20-03 owns catch-all DROP -- Plan 20-01 does NOT touch the notifyError import lines).
  </read_first>
  <files>
    extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts,
    tests/edge/handlers/plugin/install.test.ts,
    tests/edge/handlers/plugin/update.test.ts,
    tests/edge/handlers/plugin/reinstall.test.ts,
    tests/edge/handlers/import.test.ts,
    tests/edge/handlers/plugin/bootstrap.test.ts
  </files>
  <action>
    Operate in this order:

    1. SWEEP across 5 production files. For each V1 3-arg callsite, swap to V2 1-arg structured form per the same Shape A / B / C decision tree from Task 1.

       Per-file mappings (15 sites total for Task 2):

       - `edge/handlers/plugin/install.ts` (lines 52, 65, 75): three swaps per appropriate shape.
       - `edge/handlers/plugin/update.ts` (lines 36, 48, 61): three swaps per appropriate shape.
       - `edge/handlers/plugin/reinstall.ts` (lines 34, 44, 52, 86): four swaps per appropriate shape.
       - `edge/handlers/plugin/import.ts` (lines 31, 36): two swaps per appropriate shape; CRITICAL -- the `notifyError, notifyUsageError` mixed import at line 7 STAYS UNCHANGED. Plan 20-03 will drop `notifyError` together with the catch-all wrapper at lines 47-50. If Plan 20-01 prematurely drops the `notifyError` import here, the file will not compile (the catch-all wrapper still references `notifyError`).
       - `edge/handlers/plugin/bootstrap.ts` (lines 38, 43, 49): three swaps per appropriate shape; same CRITICAL note as import.ts -- the `notifyError, notifyUsageError` mixed import at line 21 STAYS UNCHANGED. Plan 20-03 drops `notifyError` with the catch-all wrapper at lines 57-66.

       Inline construction per D-19-07 inheritance. No helper extraction. Total 15 line edits across 5 files.

    2. IMPORT CHECK. Verify each touched production file imports `notifyUsageError` from `../../../shared/notify.ts`. Per 20-RESEARCH.md verified import lines: `install.ts:27`, `update.ts:17`, `reinstall.ts:15`, `import.ts:7` (mixed -- stays as-is), `bootstrap.ts:21` (mixed -- stays as-is). NO import changes required for any file in this task. The mixed-import files (import.ts + bootstrap.ts) keep the `notifyError, notifyUsageError` form; Plan 20-03 will drop `notifyError` after this plan lands.

    3. TEST FILE UPDATES (lockstep). Same discipline as Task 1 -- byte-equality assertions stay byte-identical. Test files:

       - `tests/edge/handlers/plugin/install.test.ts`, `tests/edge/handlers/plugin/update.test.ts`, `tests/edge/handlers/plugin/reinstall.test.ts`, `tests/edge/handlers/plugin/bootstrap.test.ts`: standard `makeCtx()` recording + `notifications[0]?.message` assertions; the only edits needed are if a test directly constructs a V1 `notifyUsageError(ctx, "msg", USAGE)` call (rare).
       - `tests/edge/handlers/import.test.ts` (NOT under `tests/edge/handlers/plugin/`; the source-file → test-file mapping is non-symmetric per 20-PATTERNS.md line 587-590): same discipline; Plan 20-01 does NOT touch the test at lines 111-123 (the catch-all-test that Plan 20-03 will delete). Plan 20-01 only updates whatever usage-error test code in this file constructs V1 calls directly (rare).

    4. VERIFY post-edit:

       - `grep -cE "notifyUsageError\(ctx,\s*\"" extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` returns 0.
       - `grep -cE "notifyUsageError\(ctx,\s*\{" extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` (summed across files) returns 15.
       - PHASE-WIDE invariant: `grep -rcE "notifyUsageError\(ctx,\s*\"" extensions/pi-claude-marketplace/edge/` returns 0 across the whole edge directory after BOTH Task 1 and Task 2 complete.
       - PHASE-WIDE invariant: `grep -rcE "notifyUsageError\(ctx,\s*\{" extensions/pi-claude-marketplace/edge/` (summed across all files) returns 30 (Task 1 contributed 15; Task 2 contributes 15; total 30 matches the 20-RESEARCH.md verified site count).
       - `node --test tests/edge/handlers/plugin/install.test.ts tests/edge/handlers/plugin/update.test.ts tests/edge/handlers/plugin/reinstall.test.ts tests/edge/handlers/import.test.ts tests/edge/handlers/plugin/bootstrap.test.ts` exits 0.
       - `npm run check` exits 0 -- the phase-level gate; both tasks must land in one atomic commit.

    Honors D-20-01 (mechanical sweep) + D-20-04 (byte invariance) + D-20-06 (test discipline) + IL-2 (output channel preserved via `notify()` host) + CLAUDE.md Conventional Commits (single atomic commit for both Task 1 + Task 2 mutations).
  </action>
  <verify>
    <automated>node --test tests/edge/handlers/plugin/install.test.ts tests/edge/handlers/plugin/update.test.ts tests/edge/handlers/plugin/reinstall.test.ts tests/edge/handlers/import.test.ts tests/edge/handlers/plugin/bootstrap.test.ts &amp;&amp; npm run check</automated>
  </verify>
  <done>
    All 15 remaining V1 3-arg callsites swapped to V2 1-arg structured form across 5 plugin-family edge handlers. Mixed `notifyError, notifyUsageError` imports in import.ts (line 7) + bootstrap.ts (line 21) preserved unchanged (Plan 20-03 will drop `notifyError` with the catch-all). All 5 plugin-handler test files compile + pass. PHASE-WIDE invariant: zero V1 3-arg form remains across the entire `edge/` directory; 30 V2 1-arg forms present (15 from Task 1 + 15 from Task 2). `npm run check` GREEN. Atomic single commit boundary across Task 1 + Task 2.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Pure signature swap at edge handler argv-validation boundary; `ctx.ui.notify` host channel (IL-2) unchanged; renderer at `shared/notify.ts` is the SOLE site that knows the user-output grammar (SNM-17). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-01-01 | I (Information disclosure: mis-routed notification severity post-migration) | V2 `notifyUsageError` overload at `shared/notify.ts:129-156` | mitigate | V1 ≡ V2 byte invariance verified at `shared/notify.ts:127-156` (both forms emit `${message}\n\n${usage}` at `"error"` severity); existing test assertions stay byte-identical per D-20-06; catalog UAT generic `usage-error` fixture exercises the structural-shape gate. Risk LOW -- the migration is a SIGNATURE change at call sites, not a renderer change. |
| T-20-01-SC | T (Tampering: supply chain) | npm/pip/cargo installs in this plan | accept | NO new package installs in Plan 20-01. The migration uses ONLY existing `notifyUsageError` (V2 overload added in Phase 16) and existing `UsageErrorMessage` type (Phase 15). The 20-RESEARCH.md `## Package Legitimacy Audit` is not required for this plan because no `npm install` operation is performed. Risk: NONE for this plan. |
</threat_model>

<verification>
- `node --test tests/edge/router.test.ts tests/edge/handlers/marketplace/*.test.ts tests/edge/handlers/plugin/*.test.ts tests/edge/handlers/import.test.ts` exits 0.
- `node --test tests/architecture/catalog-uat.test.ts` exits 0 (catalog UAT `usage-error` structural fixture remains byte-equal).
- `npm run check` exits 0 at the atomic commit boundary.
- `grep -rcE "notifyUsageError\(ctx,\s*\"" extensions/pi-claude-marketplace/edge/` returns 0 (no V1 3-arg string-literal-second-arg form remains).
- `grep -rE "notifyUsageError\([^,]+,\s*[^{][^,]*,\s*" extensions/pi-claude-marketplace/edge/ | wc -l` returns 0 (no V1 3-arg form remains in any shape).
- `grep -rcE "notifyUsageError\(ctx,\s*\{" extensions/pi-claude-marketplace/edge/` summed across all files returns 30 (matches the verified site count from 20-RESEARCH.md per-file table).
- `grep -c "notifyError" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns ≥1 (the `notifyError` import + the catch-all wrapper at lines 47-50 STAY -- Plan 20-03 drops them).
- `grep -c "notifyError" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` returns ≥1 (same -- Plan 20-03 drops with the catch-all at lines 57-66).
</verification>

<success_criteria>
- All 30 V1 3-arg `notifyUsageError(ctx, msg, usage)` callsites across 13 production edge files migrated to V2 1-arg `notifyUsageError(ctx, { message: msg, usage })` form (15 in Task 1 + 15 in Task 2).
- Zero V1 3-arg callsites remain in `extensions/pi-claude-marketplace/edge/**/*.ts`: phase-wide grep returns 0.
- Test assertions stay byte-identical (V1 ≡ V2 wire form per shared/notify.ts:127-156 byte-equality contract); no `makeCtx()` pattern changes; no assertion-string edits.
- Mixed `notifyError, notifyUsageError` imports in `edge/handlers/plugin/import.ts:7` + `edge/handlers/plugin/bootstrap.ts:21` preserved unchanged (Plan 20-03 drops `notifyError` with the catch-all wrappers).
- `npm run check` GREEN at the atomic commit boundary.
- Catalog UAT `usage-error` structural-shape fixture (`docs/output-catalog.md:937-943`) remains byte-equal per D-20-04.
</success_criteria>

<output>
Create `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-01-SUMMARY.md` documenting:
- The 13 production files modified (all edge handlers per the verified site table) + their lockstep test-file updates.
- The phase-wide invariant proof: zero V1 3-arg `notifyUsageError` callsites remain in `edge/**`; 30 V2 1-arg callsites present (15 from Task 1 + 15 from Task 2).
- Confirmation that import lines were preserved unchanged across all 13 files (no `notifyError` drops in this plan; Plan 20-03 owns that for `bootstrap.ts` + `import.ts`).
- Confirmation that catalog UAT byte-equality stays GREEN (the generic `usage-error` fixture exercises the structural-shape gate; V1 ≡ V2 byte invariance per `shared/notify.ts:127-156`).
- Confirmation that `npm run check` exited 0 at the atomic commit boundary.
- Atomic single-commit Conventional Commits message: `refactor(20): migrate edge handler usageerror callsites to V2 1-arg form (SNM-23)`. SKIP=trufflehog if executing inside a worktree (per CLAUDE.md).
</output>
</content>
</invoke>
