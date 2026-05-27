---
phase: 20-migration-wave-3-edge-handlers-usageerror
plan: 2
type: execute
wave: 2
depends_on:
  - 20-01
files_modified:
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/index.ts
  - tests/orchestrators/import/execute.test.ts
autonomous: true
requirements:
  - SNM-23
requirements_addressed:
  - SNM-23
must_haves:
  truths:
    - "D-20-02 (strict D-19-02 mirror): `composeImportSummary` (private helper at `execute.ts:366-435`) and `formatClaudeImportSummary` (exported test helper at `execute.ts:350-360`) are RETIRED entirely. Inline construction of `NotificationMessage { marketplaces: readonly MarketplaceNotificationMessage[] }` replaces both V1 emission sites at lines 1001 (catastrophic-error path) and 1018 (final dispatch ternary). The orchestrator only pivots outcomes into the typed payload tree; `notify()` computes severity (D-16-11), reload-hint (D-16-12), and soft-dep markers (D-16-14, D-16-15)."
    - "D-20-02 line-1001 catastrophic-error path: DROP per RESEARCH recommendation. The outer try/catch at `execute.ts:979-1003` is REMOVED. Inner `executeScopedPlan` per-scope try/catch at lines 745-755 already covers expected `loadState` failures; truly catastrophic uncaught throws bubble to Pi runtime (which surfaces a stack trace BETTER for debugging than a polished V1 error message that masks the bug). Mirrors D-20-03 catch-all DROP discipline extended to the inner orchestrator boundary."
    - "V1 -> V2 outcome mapping (LOCKED inline -- the 3 A1-A3 discretionary mappings from RESEARCH are locked here in Plan 20-02 rather than triggering a Source Audit return, per CONTEXT line 144-156 + D-19-01 / D-18-01 precedent): A1 (`ImportWarningOutcome.reason === \"marketplace-failed\" / \"unmappable-marketplace-source\"`) -> DROP entirely (no V2 row; the failing marketplace's own `status: \"failed\"` carries the structural signal); A2 (`orphanDiagnosticLines(result)` -- settings-read-error / malformed-enabled-plugin-ref) -> DROP entirely (no top-level `reasons?:` on `NotificationMessage`; Pi runtime debug logs preserve diagnostic surface); A3 (\"Already up to date\" V1 narrative line + the V1 `Claude plugin import summary` preamble) -> DROP entirely (V2 grammar has no preamble; the no-op case renders structurally as `{ marketplaces: [] }`)."
    - "V1 -> V2 outcome mapping (KEEP-translate): `MarketplaceAddedOutcome` -> `status: \"added\"`; `MarketplaceSkipOutcome.reason === \"already-present\"` -> `status: \"updated\"` (no-op accepted partition); `MarketplaceFailureOutcome` -> `status: \"failed\", plugins: []` (free-text `cause` LOST per D-18-02 precedent -- V2 `MarketplaceNotificationMessage` has no `cause?: Error` field); `SourceMismatchOutcome` -> `status: \"failed\", reasons: [\"source mismatch\"], plugins: [<failed plugin rows>]` (Phase 17.1 `reasons?:` field); `PluginInstalledOutcome` -> `PluginInstalledMessage { dependencies }` (derived from `declaresAgents` + `declaresMcp`); `PluginSkipOutcome` -> `PluginSkippedMessage { reasons: [\"already installed\"] }`; `UnexpectedPluginFailureOutcome` -> `PluginFailedMessage { reasons: [\"not in manifest\"], cause: undefined }` (free-text cause DROPPED); `ImportWarningOutcome.reason === \"unavailable\" / \"uninstallable\"` -> `PluginUnavailableMessage { reasons: [\"no longer installable\"] }`."
    - "D-19-02 + D-16-06 caller-order honored: orchestrator owns iteration order. `compareByNameThenScope` from `presentation/sort.ts` MOVES into the inline payload-construction loop (project before user, name primary case-insensitive). `notify()` does NOT sort. The comparator stays alive in `presentation/sort.ts` for other consumers."
    - "Single `notify(opts.ctx, opts.pi, message)` call per orchestration arm (D-19-01 single-call discipline extended). No SECOND notify after the primary. With the line-1001 outer try/catch DROPPED, the catastrophic-error path no longer exists; only the final-dispatch site at the bottom of `importClaudeSettings` emits."
    - "D-16-14 (single softDepStatus probe per `notify()` call): `softDepStatus` import (`execute.ts:10`) + `probe = softDepStatus(opts.pi)` assignment (line 1012) are RETIRED. The orchestrator only declares `dependencies: readonly Dependency[]` on `PluginInstalledMessage` variants; `notify()` probes once via the renderer per D-16-14."
    - "D-20-06: `tests/orchestrators/import/execute.test.ts` byte-string assertions are REWRITTEN from V1 `formatClaudeImportSummary`-based strings to V2 `notify()`-emitted bytes via `makeCtx()`. Tests targeting dropped V1 surfaces are DELETED outright per D-19-01 precedent: idempotent-skip \"already up to date\" (line 44), source-mismatch diagnostic splice (lines 175, 225), orphan diagnostic `loadState throws` (line 782+), unrecognized stored source diagnostic (line 822). Estimated ~5-8 tests DELETED outright; ~15+ tests REWRITTEN with byte-exact V2 assertions through real `notify()`."
    - "Catalog UAT gate: 4 `/claude:plugin import` fixtures already shipped by Phase 17 (`fresh-mixed-both-scopes`, `scope-project-narrow`, `soft-dep-markers`, `same-mp-both-scopes` at `docs/output-catalog.md:572-654`) gate the V2 byte form. The inline construction MUST produce payloads that round-trip through `notify()` byte-equal to these fixtures."
    - "`orchestrators/import/index.ts:2` barrel re-export `export { formatClaudeImportSummary } from \"./execute.ts\";` is DELETED entirely. The barrel may stay alive (other re-exports survive) or be folded further; planner's discretion (CONTEXT line 156)."
    - "`presentation/cascade-summary.ts` stays alive in-tree (not modified) per CONTEXT line 156 + D-20-02. Plan 20-02 only DROPS the IMPORT from `execute.ts:11`. After Plan 20-02 lands, `cascade-summary.ts` has ZERO production importers; Phase 21 deletes the file."
  byte_contracts:
    - "Final-dispatch site (was: `execute.ts:1018`, V1 dispatch ternary `const dispatch = severity === \"warning\" ? notifyWarning : notifySuccess; dispatch(opts.ctx, finalBody);`): REPLACED by single `notify(opts.ctx, opts.pi, { marketplaces })` call. Severity computed by `notify()` per D-16-11; reload-hint per D-16-12. V2 byte form matches `docs/output-catalog.md:572-654` 4 fixtures: `fresh-mixed-both-scopes`, `scope-project-narrow`, `soft-dep-markers`, `same-mp-both-scopes`."
    - "Catastrophic-error path (was: `execute.ts:1001`, V1 `notifyError(opts.ctx, \\`Import failed: ${errorMessage(err)}\\`, err)` inside outer try/catch at lines 979-1003): DROPPED entirely. The outer try/catch wrapper is REMOVED; truly catastrophic throws bubble to Pi runtime. No V2 emission replaces it. Test consequence per D-19-01: any test asserting the V1 catastrophic-error message is DELETED outright."
    - "No-op import (was: V1 `Import already up to date.` narrative line emitted when `!anyChanges(result) && !hasWarnings(result)`): DROPS entirely. V2 renders as `notify(opts.ctx, opts.pi, { marketplaces: [] })` which the renderer's empty-array sentinel surfaces as `(no marketplaces)` (per `shared/notify.ts` empty-array contract). The behavior change is intentional per A3."
    - "V1 preamble (was: `PREAMBLE = \"Claude plugin import summary\"` constant at `execute.ts:318` + injection at composeImportSummary:422): DROPPED entirely. V2 catalog `/claude:plugin import` fixtures (lines 580-650) show NO preamble -- marketplace blocks render directly. HIGH confidence per 20-RESEARCH.md verified catalog read."
  artifacts:
    - path: "extensions/pi-claude-marketplace/orchestrators/import/execute.ts"
      provides: "Single V2 `notify(opts.ctx, opts.pi, NotificationMessage)` call at the bottom of `importClaudeSettings` replacing both V1 emission sites. `composeImportSummary` (lines 366-435) + `formatClaudeImportSummary` (lines 350-360) + `ComposedImport` type alias (lines 361-364) + outer try/catch (lines 979-1003) + `spliceSourceMismatchDiagnostics` (lines 655-709) + `orphanDiagnosticLines` (lines 711-730) + `enumerateMarketplaceBlocks` helper (lines 438-555) -- all retired or inlined per D-19-02 strict mirror (planner may keep `enumerateMarketplaceBlocks` as a pure helper if it cleans up the inline loop; KEEP-AS-PATTERN per RESEARCH §V1 -> V2 Outcome-Shape Mapping)."
      contains: "notify(opts.ctx, opts.pi, {"
    - path: "extensions/pi-claude-marketplace/orchestrators/import/index.ts"
      provides: "Barrel without the `formatClaudeImportSummary` re-export. Other re-exports survive (planner's discretion to fold the barrel further if shape is trivial)."
      contains: "(absence of formatClaudeImportSummary export)"
    - path: "tests/orchestrators/import/execute.test.ts"
      provides: "Byte-exact V2 cascade assertions via `makeCtx()` recording; V1 `formatClaudeImportSummary` import REMOVED; ~5-8 tests targeting dropped V1 surfaces DELETED outright per D-19-01; ~15+ tests REWRITTEN to drive `importClaudeSettings({...})` with mock `ctx` + `pi` and assert byte-equality on recorded notifications"
      contains: "notifications\\[0\\]\\?\\.message"
  key_links:
    - from: "extensions/pi-claude-marketplace/orchestrators/import/execute.ts::importClaudeSettings"
      to: "extensions/pi-claude-marketplace/shared/notify.ts::notify"
      via: "single V2 `notify(opts.ctx, opts.pi, { marketplaces })` call at the bottom of importClaudeSettings (replacing V1 dispatch ternary at line 1018)"
      pattern: "notify\\(opts\\.ctx,\\s*opts\\.pi"
    - from: "extensions/pi-claude-marketplace/orchestrators/import/execute.ts"
      to: "extensions/pi-claude-marketplace/shared/notify.ts::MarketplaceNotificationMessage + PluginInstalledMessage + PluginSkippedMessage + PluginFailedMessage + PluginUnavailableMessage"
      via: "inline construction of typed payloads per V1 -> V2 outcome mapping table"
      pattern: "status:\\s*\"(added|updated|failed)\""
    - from: "tests/orchestrators/import/execute.test.ts"
      to: "docs/output-catalog.md:572-654 (4 /claude:plugin import fixtures)"
      via: "byte-exact cascade assertions through real `notify()` via mock ctx"
      pattern: "● [a-z-]+ \\[(user|project)\\]"
  coverage_constraints:
    - "Catalog UAT MUST stay GREEN through this plan's merge boundary -- specifically the 4 `/claude:plugin import` catalog states at `docs/output-catalog.md:572-654`."
    - "Zero V1 callers remain in execute.ts: `grep -cE \"notify(Success|Warning|Error)\\(\" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0."
    - "`composeImportSummary` retired: `grep -c \"composeImportSummary\" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0."
    - "`formatClaudeImportSummary` retired: `grep -c \"formatClaudeImportSummary\" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0; `grep -c \"formatClaudeImportSummary\" extensions/pi-claude-marketplace/orchestrators/import/index.ts` returns 0."
    - "`cascadeSummary` import dropped: `grep -c \"cascade-summary\\|cascadeSummary\" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0 (the composer stays alive in `presentation/cascade-summary.ts` -- Phase 21 deletes it)."
    - "`appendReloadHint, reloadHint` imports dropped: `grep -c \"appendReloadHint\\|reloadHint\" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0."
    - "`softDepStatus` import + probe assignment dropped: `grep -c \"softDepStatus\" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0."
    - "Outer try/catch removed: `grep -cE \"Import failed:\" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0 (the V1 catastrophic-error message string is gone with the catch block)."
    - "Single `notify()` call site: `grep -cE \"notify\\(opts\\.ctx,\\s*opts\\.pi\" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns ≥1 (the single dispatch at the bottom of importClaudeSettings)."
    - "Test count delta: tests/orchestrators/import/execute.test.ts has `formatClaudeImportSummary` import removed; ~5-8 tests deleted; remaining tests rewritten to V2 assertions; `node --test tests/orchestrators/import/execute.test.ts` exits 0."
---

<objective>
Migrate `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` from V1 severity-named wrappers (2 callsites + 1 dispatch ternary + cascadeSummary indirection through `composeImportSummary`) to V2 structured `notify(opts.ctx, opts.pi, NotificationMessage)` per D-19-02 strict mirror. This is the LAST orchestrator with V1 wrappers and the LAST consumer of `presentation/cascade-summary.ts`.

V1 sites to retire:

- Line 1018: V1 dispatch ternary `const dispatch = severity === "warning" ? notifyWarning : notifySuccess; dispatch(opts.ctx, finalBody);` → REPLACED by single V2 `notify(opts.ctx, opts.pi, { marketplaces })` call constructing the typed payload inline per the V1→V2 mapping table (locked above).
- Line 1001: V1 `notifyError(opts.ctx, \`Import failed: ${errorMessage(err)}\`, err)` inside the outer try/catch (lines 979-1003) → DROPPED entirely per A3 recommendation + D-20-03 extension. The outer try/catch wrapper is REMOVED; truly catastrophic throws bubble to Pi runtime (BETTER for debugging than a polished V1 message that masks the bug). Inner `executeScopedPlan` per-scope try/catch at lines 745-755 already covers expected `loadState` failures.

V1 surfaces to RETIRE entirely (per D-20-02 strict D-19-02 mirror):

- `composeImportSummary` private helper at lines 366-435 (the pivot-by-marketplace + outcome → cascade-row + severity-aggregation engine).
- `formatClaudeImportSummary` exported test helper at lines 350-360.
- `ComposedImport` interface alias at lines 361-364.
- `spliceSourceMismatchDiagnostics` helper at lines 655-709 (the splice-cause-under-failing-header mechanic; V2 maps source mismatches to marketplace-level `reasons: ["source mismatch"]`, free-text cause LOST per D-18-02 precedent).
- `orphanDiagnosticLines` helper at lines 711-730 (per A2 DROP).
- The V1 `PREAMBLE = "Claude plugin import summary"` constant at line 318.
- The "Already up to date" notice (`composeImportSummary:384-385`) per A3 DROP.

V1 surfaces to DROP from import block:

- `import { cascadeSummary } from "../../presentation/cascade-summary.ts";` (line 11).
- `import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";` (line 12).
- `import { softDepStatus } from "../../platform/pi-api.ts";` (line 10) -- `notify()` probes per D-16-14.
- `import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";` (line 15) -- REPLACE with `import { notify } from "../../shared/notify.ts";` plus per-variant TYPE imports (`NotificationMessage`, `MarketplaceNotificationMessage`, `PluginNotificationMessage`, `PluginInstalledMessage`, `PluginSkippedMessage`, `PluginFailedMessage`, `PluginUnavailableMessage` per V1→V2 mapping table).
- `errorMessage` from `../../shared/errors.ts` -- becomes unused after the catastrophic-error DROP. KEEP `ConcurrentInstallError` + `PluginShapeError` (still used by `dispatchFailedOutcome` at line 921+).

V1 surfaces to KEEP:

- `compareByNameThenScope` from `presentation/sort.ts` (line 13) -- moves into the inline payload-construction loop per D-16-06.
- `enumerateMarketplaceBlocks` helper at lines 438-555 -- KEEP-AS-PATTERN per RESEARCH §V1 -> V2 Outcome-Shape Mapping; the planner may delete or retain as a pure pivot helper if it cleans up the inline loop. If retained, refactor it to return `MarketplaceNotificationMessage[]` instead of the V1 `ImportCascadeInput[]` shape.

Test file: `tests/orchestrators/import/execute.test.ts` -- update in lockstep per D-20-06:

- Drop `formatClaudeImportSummary` import; replace with `importClaudeSettings` + `makeCtx()` pattern.
- DELETE outright (per D-19-01 precedent): the idempotent-skip "already up to date" test at line 44; the source-mismatch diagnostic-splice tests at lines 175 + 225; the orphan-diagnostic `loadState throws` test at line 782+; the unrecognized-stored-source diagnostic test at line 822+. Estimated 5-8 tests deleted.
- REWRITE 7+ remaining `formatClaudeImportSummary(...)` invocations across tests at lines 69, 96, 572, 607, 642, 679, 711 → drive the same fixture through `importClaudeSettings({...})` with mock `ctx` + `pi` and assert byte-equality on recorded `notifications[0]?.message`.
- RENAME test names that reference the helper (lines 44, 72, 685) to describe V2 dispatch behavior.

Drop `orchestrators/import/index.ts:2` barrel re-export `export { formatClaudeImportSummary } from "./execute.ts";`. Other re-exports survive; planner's discretion to fold the barrel further.

Purpose: close the LAST orchestrator V2 migration and orphan `presentation/cascade-summary.ts` for Phase 21 deletion. After Plan 20-02 lands, NO production file imports from `presentation/cascade-summary.ts`. Plan 20-02 contributes to SNM-23 by removing the only remaining V1 wrapper callers in `orchestrators/import/` (Plan 20-01 covered the edge family).

Output: 3 modified files (execute.ts + index.ts + execute.test.ts) in ONE atomic commit; ~6 V1 helper functions retired; 2 V1 emission sites collapsed to 1 V2 `notify()` call; outer try/catch removed; ~6 presentation/* imports dropped; 5-8 V1-only tests deleted; 7+ tests rewritten with byte-exact V2 assertions; `npm run check` GREEN.
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
@.planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-04-PLAN.md
@.planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-04-SUMMARY.md
@extensions/pi-claude-marketplace/shared/notify.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
@docs/output-catalog.md
@tests/architecture/catalog-uat.test.ts
@tests/shared/notify-v2.test.ts
@CLAUDE.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Migrate orchestrators/import/execute.ts -- retire composeImportSummary + formatClaudeImportSummary + spliceSourceMismatchDiagnostics + orphanDiagnosticLines; DROP outer try/catch + line-1001 catastrophic-error path; REPLACE line-1018 dispatch ternary with single V2 `notify(opts.ctx, opts.pi, { marketplaces })` call constructing the typed payload inline per the locked V1→V2 mapping; drop 6+ presentation/* imports + softDepStatus + errorMessage; drop the barrel re-export in index.ts</name>
  <read_first>
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts (full file ~1100 lines; verify the following verbatim line numbers per 20-RESEARCH.md: imports 10-15; PREAMBLE constant 318; `ImportClaudeSettingsOptions` 159; `ClaudeImportExecutionResult` 120-131; `MarketplaceAddedOutcome` 36-41; `MarketplaceSkipOutcome` 43-48; `PluginInstalledOutcome` 50-66; `PluginSkipOutcome` 68-75; `ImportWarningOutcome` 77-89; `MarketplaceFailureOutcome` 91-97; `SourceMismatchOutcome` 99-107; `UnexpectedPluginFailureOutcome` 109-117; `formatClaudeImportSummary` 350-360; `ComposedImport` 361-364; `composeImportSummary` 366-435; `enumerateMarketplaceBlocks` 438-555; `importWarningStatus` ~557; `importWarningReason` ~568; `spliceSourceMismatchDiagnostics` 655-709; `orphanDiagnosticLines` 711-730; `executeScopedPlan` 735+ (with internal loadState try/catch at 745-755); `importClaudeSettings` 979-1003 outer try/catch + line 1001 catastrophic emission + line 1012 softDepStatus probe + line 1018 dispatch ternary).
    - extensions/pi-claude-marketplace/orchestrators/import/index.ts (barrel; the `formatClaudeImportSummary` re-export at line 2 must be dropped).
    - extensions/pi-claude-marketplace/shared/notify.ts lines 290 (`UsageErrorMessage`), 325-479 (per-variant PluginNotificationMessage types: `PluginInstalledMessage` ~325, `PluginSkippedMessage` ~436, `PluginFailedMessage` ~417, `PluginUnavailableMessage` ~470 -- verify exact line numbers in the file), 481-525 (`MarketplaceNotificationMessage` + `MarketplaceStatus`), 524 (`NotificationMessage` top-level shape), 529-700 (renderer body for `renderMpHeader` + `renderPluginRow` -- read to understand byte form), 1034 (`notify()` signature `(ctx, pi, message)`).
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts (Phase 19 Plan 19-04 -- the DIRECT structural mirror for the cascade migration pattern; read the cascade-construction loop verbatim to mirror the iteration + variant-dispatch shape).
    - .planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-04-PLAN.md + 19-04-SUMMARY.md (the structural template).
    - docs/output-catalog.md lines 572-654 (the 4 `/claude:plugin import` catalog states: `fresh-mixed-both-scopes` ~580, `scope-project-narrow`, `soft-dep-markers`, `same-mp-both-scopes`). BYTE-EXACT REFERENCE.
    - tests/architecture/catalog-uat.test.ts (FIXTURES map entries for `/claude:plugin import` -- the V2 payload-shape reference; the FIXTURES values are the canonical reference for how the orchestrator constructs each marketplace block + plugin row).
    - tests/shared/notify-v2.test.ts (per-variant fixtures for `PluginInstalledMessage` with dependencies, `PluginSkippedMessage`, `PluginFailedMessage`, `PluginUnavailableMessage`, `MarketplaceNotificationMessage` with `reasons?:` -- used as byte-form cross-reference if catalog gap exists).
    - extensions/pi-claude-marketplace/presentation/cascade-summary.ts (READ-ONLY -- understand current `cascadeSummary({...})` data flow so inline V2 construction faithfully replicates outcome → variant mapping; do NOT modify per CONTEXT line 156 + D-20-02).
    - extensions/pi-claude-marketplace/presentation/sort.ts (`compareByNameThenScope` -- the comparator that moves into the inline construction loop per D-16-06).
    - 20-CONTEXT.md `<decisions>` D-20-02 (retire composeImportSummary + formatClaudeImportSummary; A1-A3 discretionary mappings locked here) + D-20-05 (parallel-safe with Plan 20-03 -- disjoint files).
    - 20-RESEARCH.md "Per-File Site Table > Plan 20-02" lines 127-144 (every retirement target's verified line numbers) + "V1 → V2 Outcome-Shape Mapping" lines 222-241 (the binding mapping table) + "Recommended SHAPE for line-1001 catastrophic-error path: DROP" lines 243-304.
    - 20-PATTERNS.md "(b) Plan 20-02 -- orchestrators/import/execute.ts Cascade Migration" lines 199-470 (cascade-with-mixed-variants pattern + 13-row V1→V2 mapping table + test rewrite pattern).
  </read_first>
  <files>
    extensions/pi-claude-marketplace/orchestrators/import/execute.ts,
    extensions/pi-claude-marketplace/orchestrators/import/index.ts
  </files>
  <action>
    Operate in this order:

    1. UPDATE IMPORTS. DROP: `softDepStatus` from `../../platform/pi-api.ts` (line 10); `cascadeSummary` from `../../presentation/cascade-summary.ts` (line 11); `appendReloadHint` + `reloadHint` from `../../presentation/reload-hint.ts` (line 12); `notifyError, notifySuccess, notifyWarning` from `../../shared/notify.ts` (line 15); `errorMessage` from `../../shared/errors.ts` (line 14 -- becomes unused after catastrophic-error DROP). KEEP: `compareByNameThenScope` from `../../presentation/sort.ts` (line 13 -- moves into inline construction loop); `ConcurrentInstallError, PluginShapeError` from `../../shared/errors.ts` (still used by `dispatchFailedOutcome` at line 921+). ADD: `notify` from `../../shared/notify.ts`; per-variant TYPE imports `NotificationMessage`, `MarketplaceNotificationMessage`, `PluginNotificationMessage`, `PluginInstalledMessage`, `PluginSkippedMessage`, `PluginFailedMessage`, `PluginUnavailableMessage` from `../../shared/notify.ts`. Use `import type { ... }` for the per-variant interface types (TS strict).

    2. RETIRE `formatClaudeImportSummary` exported helper (lines 350-360) -- DELETE the function entirely. Its sole external consumer is the test file (Task 2 handles).

    3. RETIRE `ComposedImport` interface alias (lines 361-364) -- DELETE the alias entirely.

    4. RETIRE `composeImportSummary` private helper (lines 366-435) -- DELETE the function entirely. Its iteration logic moves inline into `importClaudeSettings` per step 7 below.

    5. RETIRE `spliceSourceMismatchDiagnostics` helper (lines 655-709) -- DELETE entirely. V2 maps source mismatches to marketplace-level `reasons: ["source mismatch"]` directly via `enumerateMarketplaceBlocks` line 478-480 `upsertSourceMismatchHeader` precedent (which already sets the closed-set Reason); free-text cause LOST per D-18-02.

    6. RETIRE `orphanDiagnosticLines` helper (lines 711-730) -- DELETE entirely per A2 DROP. The diagnostic accumulation in `result.diagnostics` STAYS (the in-memory record persists; only the V1 user-facing surfacing is dropped). Pi runtime debug logs preserve diagnostic visibility.

    7. RETIRE the V1 PREAMBLE constant at line 318 (`const PREAMBLE = "Claude plugin import summary";`). DELETE the constant. The V2 catalog has no preamble.

    8. REPLACE the outer try/catch in `importClaudeSettings` (lines 979-1003) per the line-1001 DROP recommendation:

       BEFORE (verbatim shape per RESEARCH §Implementation shape):
       ```
       export async function importClaudeSettings(opts): Promise<...> {
         const result = emptyResult();
         try {
           // loadSettings + buildClaudeImportPlan + executeScopedPlan loop
         } catch (err) {
           notifyError(opts.ctx, `Import failed: ${errorMessage(err)}`, err);
           return result;
         }
         // composeImportSummary + dispatch
       }
       ```

       AFTER:
       ```
       export async function importClaudeSettings(opts): Promise<...> {
         const result = emptyResult();
         // loadSettings + buildClaudeImportPlan + executeScopedPlan loop (no outer try/catch)
         // ... existing body unchanged except the wrapper is gone

         // V2 cascade construction (step 9 below)
         const marketplaces = pivotResultIntoMarketplaces(result);
         notify(opts.ctx, opts.pi, { marketplaces });
         return result;
       }
       ```

       The truly catastrophic throws bubble to Pi runtime (BETTER for debugging per D-20-03 rationale). Inner `executeScopedPlan` per-scope try/catch at lines 745-755 already covers expected `loadState` failures.

    9. INLINE the V2 cascade construction at the bottom of `importClaudeSettings`. Mirror the Phase 19 Plan 19-04 reinstall.ts recipe (read `orchestrators/plugin/reinstall.ts` per the read_first to extract the verbatim shape). Apply the V1 → V2 outcome mapping table from 20-RESEARCH.md lines 222-241:

       Step-by-step iteration (Claude's Discretion within these rails -- planner picks helper-function decomposition vs single inline block):

       a. Build a per-(marketplace × scope) tuple Map<string, { name, scope, status, reasons?, plugins: PluginNotificationMessage[] }>.

       b. Iterate `result.addedMarketplaces` → for each, set `status: "added"` on the (mp, scope) tuple.

       c. Iterate `result.skippedExistingMarketplaces` → for each, set `status: "updated"` on the (mp, scope) tuple (no-op accepted partition).

       d. Iterate `result.marketplaceFailures` → for each, set `status: "failed", plugins: []` on the (mp, scope) tuple. Free-text `cause: string` is LOST (no `cause?: Error` on `MarketplaceNotificationMessage` -- D-18-02 precedent).

       e. Iterate `result.sourceMismatches` → for each, set `status: "failed", reasons: ["source mismatch"]` on the (mp, scope) tuple. Free-text `cause` LOST.

       f. Iterate `result.installedPlugins` → for each, push `PluginInstalledMessage` onto the matching (mp, scope) tuple's `plugins[]` with `dependencies` derived from `declaresAgents` + `declaresMcp` (`[...(o.declaresAgents ? ["agents" as const] : []), ...(o.declaresMcp ? ["mcp" as const] : [])]`). NO `version` field (`PluginInstalledOutcome` carries none per 20-RESEARCH.md line 232).

       g. Iterate `result.skippedExistingPlugins` → for each, push `PluginSkippedMessage` with `reasons: ["already installed"]` per closed-set CMC-11 vocabulary precedent.

       h. Iterate `result.unexpectedPluginFailures` → for each, push `PluginFailedMessage` with `reasons: ["not in manifest"]` and `cause: undefined` (the V1 free-text cause was already non-rendered per A5 precedent + 20-RESEARCH.md line 234 -- preserves V1 behavior).

       i. Iterate `result.warnings` filtered to `reason === "unavailable" || reason === "uninstallable"` → for each, push `PluginUnavailableMessage` with `reasons: ["no longer installable"]`. `PluginUnavailableMessage` carries NO `scope` per SNM-11.

       j. DROP `result.warnings` with `reason === "marketplace-failed"` (A1 DROP -- the failing marketplace's own `status: "failed"` carries the structural signal). DROP `result.warnings` with `reason === "unmappable-marketplace-source"` (A1 DROP -- advisory only).

       k. DROP `result.diagnostics` with `d.marketplace === undefined` (orphan diagnostics) per A2 DROP. The in-memory diagnostic record stays; the user-facing surfacing is silenced. Per CONTEXT.md Pitfall 3 -- this is the riskiest data-loss recommendation, but locked per D-19-01 precedent.

       l. DROP the V1 "Already up to date" notice (per A3 DROP). The no-op import renders structurally as `{ marketplaces: [] }`.

       m. Build the final array `Array.from(byMp.values()).sort(compareByNameThenScope).map(toMarketplaceNotificationMessage)`. The orchestrator owns iteration order per D-16-06 (project before user, name primary case-insensitive); `notify()` does NOT sort.

       n. ORPHAN-FOLD: at plugin-row construction time (within the per-marketplace iteration), set the plugin's `scope?` field ONLY when the plugin's scope DIFFERS from the marketplace's scope (Phase 17.2 contract; `shared/notify.ts::renderScopeBracket` suppresses the bracket when same). For import outcomes, this is the per-scope-iteration pivot output -- plugin and marketplace share scope by construction, so `scope?` should be OMITTED (matches the `unavailable-plugin` row in catalog fixture `fresh-mixed-both-scopes` which has no `[scope]` bracket on plugin row when same as mp.scope).

    10. EMIT a single V2 `notify(opts.ctx, opts.pi, { marketplaces })` call at the end of `importClaudeSettings`. NO severity argument. NO reload-hint composition. NO soft-dep probe at orchestrator level. `notify()` computes everything structurally per D-16-11 + D-16-12 + D-16-14.

    11. DELETE the V1 dispatch ternary at line 1018 (`const dispatch = severity === "warning" ? notifyWarning : notifySuccess; dispatch(opts.ctx, finalBody);`) entirely. Replaced by step 10.

    12. AUDIT `enumerateMarketplaceBlocks` helper (lines 438-555). Per RESEARCH KEEP-AS-PATTERN guidance: the helper's iteration discipline defines the structurally-correct pivot order. The planner picks ONE of:

        Option A (keep + refactor): retain `enumerateMarketplaceBlocks` as a pure pivot helper but refactor its return type from V1 `ImportCascadeInput[]` to V2 `MarketplaceNotificationMessage[]`. Document choice in SUMMARY.

        Option B (delete + inline): delete the helper entirely; inline its iteration loops directly into step 9 above. Total code volume increases inside `importClaudeSettings` but matches the strict D-19-02 inline-cascade mirror.

        Recommendation: Option B (strict D-19-02 mirror); planner picks Option A only if inline code in `importClaudeSettings` exceeds ~150 lines and a pure helper materially improves readability. Document the choice in SUMMARY.

    13. EMBED a single-line reference comment ABOVE the consolidated V2 `notify()` call: `// V2 cascade construction mirrors the Plan 19-04 reinstall.ts recipe at orchestrators/plugin/reinstall.ts; execute.ts substitutes the import-cascade variant set (added / updated / failed marketplaces crossed with installed / skipped / failed / unavailable plugins) per D-20-02 + D-19-02 strict mirror.`.

    14. UPDATE the barrel `orchestrators/import/index.ts`. DELETE line 2 `export { formatClaudeImportSummary } from "./execute.ts";`. Other re-exports survive. Optionally fold the barrel further if the planner sees a cleanliness benefit (CONTEXT line 156). Document choice in SUMMARY.

    15. VERIFY post-edit invariants:

        - `grep -cE "notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0.
        - `grep -c "composeImportSummary" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0.
        - `grep -c "formatClaudeImportSummary" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0.
        - `grep -c "formatClaudeImportSummary" extensions/pi-claude-marketplace/orchestrators/import/index.ts` returns 0.
        - `grep -c "spliceSourceMismatchDiagnostics\|orphanDiagnosticLines" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0.
        - `grep -c "cascade-summary\|cascadeSummary" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0.
        - `grep -c "softDepStatus\|appendReloadHint\|reloadHint" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0.
        - `grep -cE "Import failed:" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0 (the V1 catastrophic-error string is gone).
        - `grep -cE "Claude plugin import summary" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0 (PREAMBLE gone).
        - `grep -cE "notify\(opts\.ctx,\s*opts\.pi" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 1 (the single V2 dispatch).

    Honors D-20-02 (composeImportSummary + formatClaudeImportSummary retired; inline construction; A1-A3 mappings locked) + D-20-05 (parallel-safe with Plan 20-03) + D-19-02 (inline cascade construction; dispatch ternary removed) + D-16-04/06/08/11/12/14 (renderer-as-spec).
  </action>
  <verify>
    <automated>npm run check</automated>
  </verify>
  <done>
    execute.ts compiles under strict TypeScript; imports no longer reference V1 wrappers, `cascadeSummary`, `appendReloadHint`, `reloadHint`, `softDepStatus`, or `errorMessage`; the V1 dispatch ternary at line 1018 is gone; the outer try/catch at lines 979-1003 is gone (line-1001 catastrophic-error DROPPED); `composeImportSummary` + `formatClaudeImportSummary` + `ComposedImport` + `spliceSourceMismatchDiagnostics` + `orphanDiagnosticLines` + `PREAMBLE` are deleted; exactly one V2 `notify(opts.ctx, opts.pi, { marketplaces })` call survives at the bottom of `importClaudeSettings`; inline cascade construction follows the locked V1→V2 mapping (A1-A3 DROPs applied); `enumerateMarketplaceBlocks` is either deleted or refactored to return `MarketplaceNotificationMessage[]` (choice documented in SUMMARY); the orchestrators/import/index.ts barrel no longer re-exports `formatClaudeImportSummary`; a single-line reference comment cross-links the Plan 19-04 recipe. Tests rewritten in Task 2; atomic commit captures all 3 files together.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Update tests/orchestrators/import/execute.test.ts -- byte-exact V2 cascade assertions across the 4 `/claude:plugin import` catalog states; DELETE ~5-8 tests targeting dropped V1 surfaces (idempotent-skip "up to date", source-mismatch diagnostic splice, orphan loadState diagnostics, unrecognized stored source diagnostic); REWRITE ~7+ formatClaudeImportSummary invocations to drive importClaudeSettings() with mock ctx + pi and assert on recorded notifications</name>
  <read_first>
    - tests/orchestrators/import/execute.test.ts (full file -- ~800+ lines; the 8 `formatClaudeImportSummary` invocations across 5 tests are at lines 7 (import), 44 (idempotent-skip test name), 69, 72, 96, 572, 607, 642, 679, 685, 711 per 20-RESEARCH.md "formatClaudeImportSummary Consumers" table lines 206-220).
    - docs/output-catalog.md lines 572-654 (the 4 `/claude:plugin import` catalog states -- BINDING V2 byte forms).
    - tests/architecture/catalog-uat.test.ts (FIXTURES map entries for `/claude:plugin import` -- canonical V2 payload-shape reference; the planner reads these to extract the byte-string assertions for each test).
    - tests/shared/notify-v2.test.ts (per-variant byte-form reference for `PluginInstalledMessage` with dependencies, `PluginSkippedMessage`, `PluginFailedMessage`, `PluginUnavailableMessage`, `MarketplaceNotificationMessage` with `reasons?:`).
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts (post-Task-1 state -- the inline cascade construction is the reference for what V2 byte form to assert in each test).
    - tests/orchestrators/plugin/reinstall.test.ts (Phase 19 Plan 19-04 test-rewrite precedent -- the byte-exact V2 assertion shape via `makeCtx()` recording).
    - 20-CONTEXT.md `<decisions>` D-20-06 (test discipline -- end-to-end through real notify() via mock ctx) + D-20-02 (the test-deletion consequence for dropped V1 surfaces).
    - 20-PATTERNS.md "(b) Plan 20-02 -- Test rewrite pattern" lines 414-457 (V1 helper-based string assertion → V2 mock-ctx + byte-exact assertion).
    - 20-RESEARCH.md "Common Pitfalls" lines 410-453 (Pitfall 3: orphan diagnostic DROP test consequence; Pitfall 4: idempotent "up to date" test deletion; Pitfall 5: source-mismatch cause-text test consequence).
  </read_first>
  <files>tests/orchestrators/import/execute.test.ts</files>
  <action>
    Operate in this order:

    1. SCAN: `grep -n "formatClaudeImportSummary\|notifySuccess\|notifyWarning\|notifyError\|notifications.length\|composeImportSummary\|Import failed:\|already up to date\|source mismatch\|settings-read-error\|loadState\|malformed-enabled" tests/orchestrators/import/execute.test.ts`. Map each hit to one of: KEEP+REWRITE (byte assertion rewriteable to V2), DELETE (test targets a dropped V1 surface).

    2. UPDATE IMPORTS. DROP: `formatClaudeImportSummary` import at line 7. ADD: `importClaudeSettings` from the same execute.ts path; the existing `makeCtx()` helper pattern (if not already in this file, add a local one per the Phase 19 reinstall.test.ts precedent). The V2 mock `ctx` records `{ message, severity }` tuples via `notifications: NotifyRecord[]`. ALSO add the `pi` mock helper that returns `{ getAllTools: () => [] }` (for soft-dep probe; the renderer probes via `softDepStatus(pi)` per D-16-14).

    3. DELETE outright per D-19-01 precedent (each test that targets a dropped V1 surface):

       a. Line ~44: `test("formatClaudeImportSummary reports already up to date for idempotent skips", ...)` -- DELETE entirely. V2 renders the no-op as `{ marketplaces: [] }` (no `Import already up to date.` line per A3 DROP). No V2 equivalent assertion exists.

       b. Lines ~175 + ~225: tests asserting on source-mismatch diagnostic splice text (the V1 free-text cause line spliced beneath the failing marketplace header) -- DELETE entirely. V2 maps source mismatches to `MarketplaceNotificationMessage.reasons: ["source mismatch"]`; the free-text cause is LOST per D-18-02 precedent + A4. Tests that assert ONLY on the cause-text are deleted; tests that ALSO assert on the marketplace status + reasons can be rewritten to V2 form (planner's discretion).

       c. Line ~782+: `test("emits diagnostic and skips scope when loadState throws", ...)` or similar -- DELETE entirely. V2 has no top-level diagnostic surface; the orphan `loadState`-throw diagnostic is DROPPED per A2 (Pitfall 3). The Pi runtime debug logs preserve the diagnostic; the user-facing assertion has no V2 equivalent.

       d. Line ~822+: `test("emits diagnostic for unrecognized stored source", ...)` or similar -- DELETE entirely. Same A2 DROP reasoning -- the diagnostic stays in `result.diagnostics` (in-memory) but is no longer user-facing.

       Estimated 5-8 tests DELETED across these 4 categories. Document the exact list in SUMMARY.

    4. REWRITE the 7+ remaining `formatClaudeImportSummary` invocations across tests at lines 69, 96, 572, 607, 642, 679, 711. For each:

       V1 shape (current):
       ```
       const result = await importClaudeSettings({ ... });
       const body = formatClaudeImportSummary(result, DEFAULT_PROBE);
       assert.equal(body, "Claude plugin import summary\n\n● mp [user] (added)\n  ● plugin (installed)\n\n/reload to pick up changes");
       ```

       V2 shape (target -- mirrors Phase 19 reinstall.test.ts):
       ```
       const { ctx, pi, notifications } = makeCtx();
       await importClaudeSettings({ ctx, pi, ... });
       assert.equal(notifications.length, 1);
       const note = notifications[0];
       assert.ok(note);
       assert.equal(
         note.message,
         "● mp [user] (added)\n  ● plugin (installed)\n\n/reload to pick up changes",
       );
       assert.equal(note.severity, undefined); // info -- D-16-11
       ```

       Notice the V1 `Claude plugin import summary` preamble is GONE (A3 DROP). Severity flips from V1 dispatch-derived (`"success"` / `"warning"` literal strings) to V2 content-derived (`undefined` for info / `"warning"` for warning-mix / `"error"` for failure-mix per D-16-11). Reload-hint computed by `notify()` per D-16-12 (fires when at least one row is in the state-changing set: `installed`, `updated`, `reinstalled`, `uninstalled` per SNM-15).

       Cross-reference the catalog fixtures at `docs/output-catalog.md:572-654` for the exact byte forms. Reference shapes:

       - `fresh-mixed-both-scopes`: 4 marketplace blocks (both scopes), various plugin variants including `unavailable-plugin`. V2 byte form mirrors catalog block at ~lines 580-620.
       - `scope-project-narrow`: single-scope narrowed; expected `marketplaces[]` filtered to one scope.
       - `soft-dep-markers`: plugins carry `dependencies: ["agents"] / ["agents", "mcp"]`; the renderer probes `pi-subagents` + `pi-mcp-adapter` and emits markers per D-16-15.
       - `same-mp-both-scopes`: same marketplace name across user + project scopes (no orphan-fold scope brackets because plugin scope === mp scope per construction).

    5. RENAME tests that referenced the V1 helper. At lines ~44, 72, 685, the V1 names like `"formatClaudeImportSummary reports ..."` become V2-equivalent names like `"importClaudeSettings emits ..."`. Match the V2 dispatch behavior.

    6. KEEP unchanged: state-mutation assertions (result.installedPlugins.length, result.diagnostics.length, etc. -- these inspect in-memory state, not user-facing output, and continue to be valid); error-throw assertions; argument-collection assertions; per-scope `executeScopedPlan` assertions.

    7. NEW byte-form assertions: tests covering the 4 catalog states should reference the FIXTURES map in `tests/architecture/catalog-uat.test.ts` for canonical V2 byte forms. The planner copies the byte string from the catalog UAT FIXTURES entry (or the catalog block directly) and pastes it into the test assertion. Catalog UAT already verifies the same fixture round-trips; the orchestrator unit test verifies the orchestrator constructs the SAME payload from a realistic outcome arrays input.

    8. VERIFY post-edit:

       - `grep -c "formatClaudeImportSummary" tests/orchestrators/import/execute.test.ts` returns 0.
       - `grep -c "composeImportSummary" tests/orchestrators/import/execute.test.ts` returns 0.
       - `grep -c "Claude plugin import summary" tests/orchestrators/import/execute.test.ts` returns 0 (no V1 preamble assertions).
       - `grep -cE "already up to date" tests/orchestrators/import/execute.test.ts` returns 0 (idempotent-skip test deleted per A3).
       - `grep -cE "notifications\.length,\s*[2-9]" tests/orchestrators/import/execute.test.ts` returns 0 (no V1 multi-notify expectations -- V2 emits exactly 1 per orchestration).
       - `grep -cE "● [a-z-]+ \\[(user|project)\\]" tests/orchestrators/import/execute.test.ts` returns ≥4 (one per catalog state covered).
       - `node --test tests/orchestrators/import/execute.test.ts` exits 0.
       - `node --test tests/architecture/catalog-uat.test.ts` exits 0 (the 4 `/claude:plugin import` catalog fixtures stay byte-equal -- the orchestrator now produces the same payloads the FIXTURES map already exercises).

    Honors D-20-06 (test discipline) + D-20-02 (A1-A3 DROP consequences for test deletion) + D-19-01 inheritance (DROP-test-deletion precedent) + D-19-07 inheritance (byte-exact end-to-end through real notify() via mock ctx).
  </action>
  <verify>
    <automated>node --test tests/orchestrators/import/execute.test.ts &amp;&amp; node --test tests/architecture/catalog-uat.test.ts &amp;&amp; npm run check</automated>
  </verify>
  <done>
    All tests in execute.test.ts pass; byte assertions match `docs/output-catalog.md:572-654` across the 4 `/claude:plugin import` catalog states; `formatClaudeImportSummary` import + usages removed; ~5-8 tests deleted outright per D-19-01 precedent (idempotent-skip "up to date", source-mismatch diagnostic splice, orphan loadState diagnostic, unrecognized stored source diagnostic); ~7+ tests rewritten to drive `importClaudeSettings({ ctx, pi, ... })` with mock ctx + pi and assert byte-equality on recorded `notifications[0]?.message`; `notifications.length === 1` per orchestration; `note.severity` directly inspected (V1 dispatch-derived "success"/"warning" → V2 content-derived undefined/"warning"/"error" per D-16-11). Catalog UAT GREEN end-to-end. `npm run check` GREEN at the atomic commit boundary (Task 1 + Task 2 land together).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Internal API refactor; cascade-summary composer indirection removed in favor of inline construction; outer try/catch removed (truly catastrophic throws bubble to Pi runtime); user-visible byte output gated by catalog UAT. Same `ctx.ui.notify` host channel (IL-2). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-02-01 | I (Information disclosure: dropped data surfaces) | `orphanDiagnosticLines` A2 DROP + source-mismatch cause-text A4 DROP + idempotent "up to date" A3 DROP | accept | Per CONTEXT line 144-156 + RESEARCH §Common Pitfalls 3-5: the three dropped surfaces have no V2 representation without a type amendment (REJECTED per CONTEXT.md `<deferred>`). The behavior change is intentional and documented in SUMMARY. Pi runtime debug logs preserve the diagnostic surface for orphan diagnostics (A2). The free-text source-mismatch cause is structurally LOST but mirrors D-18-02 mp-level cause-drop precedent. The idempotent re-import renders as `(no marketplaces)` -- structurally correct but less informative than V1 "up to date" message. Risk LOW-MEDIUM (data-loss but consistent with prior phase precedent). |
| T-20-02-02 | D (Denial of service / Information disclosure: catastrophic-error path dropped) | line-1001 catastrophic-error path DROP per A3 + D-20-03 extension | accept | Inner orchestrators emit V2 failed notifications for all expected failures; the outer catch fires only on bugs. Pi runtime's uncaught-exception boundary surfaces a stack trace with the actual cause -- BETTER for debugging than a polished V1 error message that masks the bug. Risk LOW-MEDIUM (user-visible quality degrades for rare bug-trigger case; CI should monitor `npm run check` logs for new uncaught-exception traces). |
| T-20-02-03 | T (Severity manipulation: V1 dispatch ternary owned classification) | V1 dispatch ternary at line 1018 | mitigate | V1 ternary REMOVED. V2 severity computed structurally by `notify()` per D-16-11 (any failed → error; any skipped/manual recovery without failed → warning; otherwise undefined). Orchestrator cannot misclassify. TypeScript strict mode + the renderer's `assertNever` exhaustiveness gate catches any drift. |
| T-20-02-04 | T (Notification flooding: multi-notify per orchestration) | Plural V1 notify call sites in import cascade | mitigate | D-19-01 single-notify-per-orchestration discipline extended. V1 emitted up to 2 separate notifies (line-1001 catastrophic + line-1018 dispatch) plus indirection through `composeImportSummary`. V2 emits EXACTLY 1 `notify()` call per `importClaudeSettings` invocation -- no SECOND notify after the primary; the catastrophic-error path is DROPPED entirely (no V2 second emission can fire). |
| T-20-02-SC | T (Supply chain: npm/pip/cargo installs in this plan) | (none) | accept | Plan 20-02 performs NO package installs. The migration uses ONLY existing `notify()` (Phase 16), per-variant types (Phase 15 / 17.1), and existing `compareByNameThenScope` (Phase 12). 20-RESEARCH.md `## Package Legitimacy Audit` is not required. Risk NONE for this plan. |
</threat_model>

<verification>
- `node --test tests/orchestrators/import/execute.test.ts` exits 0.
- `node --test tests/architecture/catalog-uat.test.ts` exits 0 (the 4 `/claude:plugin import` catalog fixtures stay byte-equal).
- `npm run check` exits 0 at the atomic commit boundary.
- `grep -cE "notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0.
- `grep -c "composeImportSummary\|formatClaudeImportSummary\|spliceSourceMismatchDiagnostics\|orphanDiagnosticLines" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0.
- `grep -c "formatClaudeImportSummary" extensions/pi-claude-marketplace/orchestrators/import/index.ts` returns 0.
- `grep -c "cascade-summary\|cascadeSummary\|appendReloadHint\|reloadHint\|softDepStatus" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0.
- `grep -cE "Import failed:" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0 (V1 catastrophic-error string gone).
- `grep -cE "Claude plugin import summary" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 0 (V1 PREAMBLE gone).
- `grep -cE "notify\(opts\.ctx,\s*opts\.pi" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns 1 (single V2 dispatch).
- `grep -rcE "cascade-summary\|cascadeSummary" extensions/pi-claude-marketplace/` returns ≥1 (the file `presentation/cascade-summary.ts` itself stays alive; Phase 21 deletes it) but ZERO production importers exist (verified by `grep -rE "from\\s+[^'\"]*cascade-summary\"" extensions/pi-claude-marketplace/ | grep -v presentation/`).
</verification>

<success_criteria>
- execute.ts emits exactly one V2 `notify(opts.ctx, opts.pi, NotificationMessage)` call per `importClaudeSettings` orchestration arm. composeImportSummary + formatClaudeImportSummary + spliceSourceMismatchDiagnostics + orphanDiagnosticLines + PREAMBLE all retired; ComposedImport alias deleted; outer try/catch removed (line-1001 catastrophic DROP); inline cascade construction per locked V1→V2 mapping (A1-A3 DROPs applied).
- `enumerateMarketplaceBlocks` either deleted or refactored to return `MarketplaceNotificationMessage[]`; choice documented in SUMMARY.
- `orchestrators/import/index.ts` no longer re-exports `formatClaudeImportSummary`.
- `presentation/cascade-summary.ts` has ZERO production importers after Plan 20-02 lands (Phase 21 deletes the file).
- execute.test.ts byte assertions match V2 catalog forms across the 4 `/claude:plugin import` states; ~5-8 V1-only tests deleted; ~7+ tests rewritten with byte-exact V2 assertions through real `notify()`.
- Catalog UAT GREEN end-to-end (the 4 catalog fixtures verify both the orchestrator's payload construction AND the renderer's byte output).
- `npm run check` GREEN at the atomic commit boundary.
</success_criteria>

<output>
Create `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-02-SUMMARY.md` documenting:
- The 3 files modified (execute.ts + index.ts + execute.test.ts) in ONE atomic commit.
- The 6+ V1 helpers retired: composeImportSummary, formatClaudeImportSummary, ComposedImport, spliceSourceMismatchDiagnostics, orphanDiagnosticLines, PREAMBLE constant.
- The choice on `enumerateMarketplaceBlocks` (Option A keep + refactor vs Option B delete + inline) per CONTEXT line 156 Claude's Discretion.
- The choice on `orchestrators/import/index.ts` barrel (keep with `formatClaudeImportSummary` re-export removed vs fold further) per CONTEXT line 156 Claude's Discretion.
- The 3 LOCKED discretionary mappings: A1 (`ImportWarningOutcome` marketplace-failed / unmappable-marketplace-source → DROP), A2 (orphan diagnostics → DROP), A3 ("Already up to date" notice + PREAMBLE → DROP). Document any data-loss consequences for user feedback per RESEARCH §Common Pitfalls.
- The line-1001 catastrophic-error DROP rationale + the outer try/catch removal (D-20-03 extension; Pi runtime uncaught-exception boundary BETTER for debugging).
- The list of ~5-8 deleted tests + the ~7+ rewritten tests + the exact byte forms asserted across the 4 catalog states.
- Confirmation that catalog UAT GREEN + `npm run check` GREEN at the atomic commit boundary.
- Note that `presentation/cascade-summary.ts` is now orphaned (ZERO production importers); Phase 21 deletes it.
- Atomic single-commit Conventional Commits message: `refactor(20): migrate import orchestrator cascade to V2 notify() (SNM-23)`. SKIP=trufflehog if executing inside a worktree (per CLAUDE.md).
</output>
</content>
</invoke>
