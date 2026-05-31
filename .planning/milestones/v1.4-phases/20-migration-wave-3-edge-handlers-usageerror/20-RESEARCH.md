# Phase 20: Migration Wave 3 -- Edge Handlers & UsageError - Research

**Researched:** 2026-05-27
**Domain:** V1 → V2 notify-wrapper migration (mechanical sweep + cascade pivot + catch-all drop + lint narrowing)
**Confidence:** HIGH

## Summary

Phase 20 is the FINAL migration wave before Phase 21's V1 teardown. The phase migrates three distinct surfaces -- (1) 30 mechanical `notifyUsageError` 3-arg → 1-arg signature swaps across 15 edge files, (2) `orchestrators/import/execute.ts` cascade migration (retire `composeImportSummary` + `formatClaudeImportSummary`, pivot to inline V2 `NotificationMessage` construction at line 1018; resolve line-1001 catastrophic-error path), and (3) DROP of 2 V1 `notifyError` catch-all sites in edge handlers (`bootstrap.ts:65`, `import.ts:49`). The phase concludes with an additive MSG-Block 1 lint narrowing adding `orchestrators/import/**` to the ignores array. CONTEXT.md (D-20-01..D-20-07) has locked all major decisions; the research scope is to verify line numbers, audit current shapes, and produce per-table reference material the planner cites verbatim.

Every CONTEXT.md line number cited herein was verified against the current `gsd/v1.3-replan-catalog` branch as of commit `666c6d9`. All 30 usage-error sites, both catch-all sites, the import cascade's 2 V1 emission sites, and the MSG-Block 1 `ignores:` array contents are unchanged from CONTEXT.md's claims.

**Primary recommendation:** Adopt CONTEXT.md's locked decisions verbatim. Recommend **DROP** for the line-1001 catastrophic-error path (no shape exists for it in the catalog; the inner per-scope try/catch at `executeScopedPlan` already covers expected failures). Recommend **inline construction** for the cascade pivot (strict D-19-02 mirror) with optional small pure helpers (e.g. `pluginsFromOutcomes`) at Plan 20-02 planner's discretion. Recommend `ImportWarningOutcome` and `orphanDiagnosticLines` DROP per D-19-01 precedent (no V2 representation exists for either without type-model amendments, which are explicitly REJECTED).

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-20-01:** Phase 20 ships 4 plans across 3 waves. Wave 1: Plan 20-01 (mechanical signature sweep, atomic single commit). Wave 2: Plan 20-02 (`import/execute.ts` cascade migration, RETIRE `composeImportSummary` and `formatClaudeImportSummary`) + Plan 20-03 (DROP 2 V1 `notifyError` catch-all sites). Wave 3: Plan 20-04 (lint narrowing + final `npm run check` GREEN gate). No pilot/recipe-block-comment needed -- Phase 20 has no mirrored work across plans.
- **D-20-02:** `composeImportSummary` (lines 366-432-ish in `execute.ts`) and `formatClaudeImportSummary` (lines 350-360) are RETIRED entirely per strict D-19-02 mirror. Inline construction of `NotificationMessage` at `executeImport`'s final dispatch (line 1018) and at the line-1001 catastrophic-error path. The orchestrator only pivots outcomes into the typed payload tree; `notify()` computes severity (D-16-11) and reload-hint (D-16-12). Catalog `/claude:plugin import` is locked to 4 states (`fresh-mixed-both-scopes`, `scope-project-narrow`, `soft-dep-markers`, `same-mp-both-scopes`).
- **D-20-03:** Both V1 `notifyError` catch-all sites are DROPPED entirely along with their enclosing try/catch blocks: `edge/handlers/plugin/bootstrap.ts:65` (around `bootstrapClaudePlugin`) and `edge/handlers/plugin/import.ts:49` (around `importClaudeSettings`). Inner orchestrators already emit V2 failed notifications on caught errors per Phase 18/19 contract. Truly catastrophic uncaught throws bubble to Pi runtime.
- **D-20-04:** `docs/output-catalog.md` §"Usage errors" stays at the single generic `<!-- catalog-state: usage-error -->` fixture. NO per-command usage-error fixtures added. V1 ≡ V2 byte invariance for `notifyUsageError` (`${message}\n\n${usage}` at "error" severity) is the technical justification.
- **D-20-05:** Wave 2 (Plans 20-02 + 20-03) is parallel-safe. Plan 20-02 mutates `orchestrators/import/execute.ts` + its tests; Plan 20-03 mutates `edge/handlers/plugin/bootstrap.ts` + `edge/handlers/plugin/import.ts` + their tests. The catch-all sites are at distinct lines from the usage-error sites Plan 20-01 touches in the same files.
- **D-20-06:** Tests stay end-to-end through real `notify()` / `notifyUsageError()` via mock `ctx`. `makeCtx()` pattern preserved verbatim. Plan 20-01 byte-string assertions stay BYTE-IDENTICAL (V1 ≡ V2). Plan 20-02 byte-string assertions REWRITTEN to V2 form. Plan 20-03 catch-all tests DELETED outright per D-19-01 precedent.
- **D-20-07:** Plan 20-04 narrows ONLY MSG-Block 1 by ADDING `"extensions/pi-claude-marketplace/orchestrators/import/**"` to the existing additive `ignores: [...]` array (lines 159-163). MSG-Block 1b's `edge/handlers/**` entry STAYS per IN-06 in-file rationale (MSG-GR-3 iteration discipline is V1-wrapper-independent). MSG-Block 2 STAYS (orthogonal to signature change). Blocks 3-6 untouched.

### Claude's Discretion

- Exact ordering of file mutations within Plan 20-01 (alphabetical, by-file-size, etc.).
- Whether to extract a tiny helper for `{ message, usage }` construction inside individual call sites (inline construction recommended).
- Whether the line-1001 catastrophic-error path is DROPPED (recommended default) or KEPT as bare-failed-marketplace (D-18-02 precedent if KEEP picked). **This research recommends DROP.**
- Whether `ImportWarningOutcome` maps to marketplace-level `reasons?:`, synthesized plugin rows, or is DROPPED per D-19-01 / D-18-01 precedent. **This research recommends DROP for `marketplace-failed` and `unmappable-marketplace-source` reasons; KEEP-as-PluginUnavailableMessage for `unavailable`/`uninstallable` reasons (see V1→V2 mapping table).**
- Whether `SourceMismatchOutcome` diagnostic-splicing maps to marketplace-level `reasons?:` or per-plugin `PluginFailedMessage.cause`. **This research recommends marketplace-level `reasons?:` with the synthesized `["source mismatch"]` reason already present in V1's `enumerateMarketplaceBlocks` output.**
- Whether `orphanDiagnosticLines` (settings-read-error etc.) surface as marketplace-level reasons, synthesized marketplace blocks, or DROPPED. **This research recommends DROP per D-19-01 precedent -- no V2 representation exists without a type amendment.**
- Whether `parseCommandArgs` callback parameter signature in `edge/args-schema.ts` (`notifyError: (message: string) => void`) is renamed. Cosmetic; deferred to Phase 21.
- Whether `presentation/cascade-summary.ts` is touched in Phase 20. **Recommendation: NO -- only drop its import from `orchestrators/import/execute.ts`. Phase 21 deletes the file.**

### Deferred Ideas (OUT OF SCOPE)

- Deleting V1 wrappers (`notifySuccess` / `notifyWarning` / `notifyError` / V1 3-arg `notifyUsageError`) -- Phase 21 (SNM-22).
- Deleting the 34-rule MSG-* lint plugin under `tests/lint-rules/` -- Phase 21 (SNM-24, SNM-25, SNM-27).
- Deleting V1 `presentation/*` composers (including `cascade-summary.ts` after Phase 20 strands it) -- Phase 21.
- Touching `tests/presentation/*.test.ts` -- Phase 21 deletes them with the composers they cover.
- Removing the bounded `shared/notify.ts` ignores added by Phase 16 to MSG-Block 4a + 5 -- Phase 21.
- Type-model amendments to support a top-level cause-bearing failure shape -- explicitly REJECTED.
- Per-command usage-error fixtures in `docs/output-catalog.md` -- explicitly REJECTED per D-20-04.
- Narrowing MSG-Block 1b's `edge/handlers/**` files entry -- explicitly RETAINED per IN-06 in-file rationale.
- Migrating `edge/args-schema.ts` -- internal closure-passing, NOT a `shared/notify.ts` wrapper import.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SNM-23 | All `notifyUsageError(ctx, msg, usage)` call sites across edge handlers (~13 sites; verified count 30) migrated to V2 `notifyUsageError(ctx, structuredUsageError)`. V1 three-argument signature deletion happens in Phase 21 (SNM-22). | Plan 20-01 sweeps all 30 sites across 15 files. Plan 20-03 drops the 2 remaining V1 `notifyError` imports in `bootstrap.ts` + `import.ts` so that after Phase 20, the only V1 surface still imported by `edge/**` is -- nothing. The `notifyUsageError` symbol itself migrates from the V1 3-arg overload to the V2 1-arg overload at every call site. V1 overload deletion is Phase 21. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Argv parsing & usage-error emission | Edge handlers (`edge/handlers/**/*.ts`) | -- | The single sanctioned site for argv-validation surfaces per MSG-SR-7 + MSG-NC-2; the renderer (`shared/notify.ts::notifyUsageError`) owns string composition |
| State-change cascade composition for import | Orchestrator (`orchestrators/import/execute.ts::executeImport`) | Renderer (`shared/notify.ts::notify`) | Orchestrator pivots outcomes into typed payload tree; `notify()` computes severity (D-16-11), reload-hint (D-16-12), and per-row soft-dep markers (D-16-15) |
| Defense-in-depth catch-all error paths | NONE (DROPPED) | Pi runtime uncaught-exception boundary | Inner orchestrators emit V2 failed notifications on caught errors per Phase 18/19 contract; outer guards fire only on bugs, which Pi runtime surfaces with stack traces (BETTER for debugging than polished output that masks the bug) |
| MSG-* lint enforcement scope | ESLint configuration (`eslint.config.js`) | tests/lint-rules/ (Phase 21 deletion target) | Block 1 narrows additively after each wave; Block 1b iteration discipline stays V1-wrapper-INDEPENDENT per IN-06 |

## Standard Stack

This phase introduces NO new dependencies. The stack is fixed by Phases 15-19. The reference contract is:

| Module | Symbol | Phase 20 Usage |
|--------|--------|----------------|
| `extensions/pi-claude-marketplace/shared/notify.ts` | `notifyUsageError(ctx, message: UsageErrorMessage)` (V2 overload, line 129) | Plan 20-01 migrates all 30 sites to this signature |
| `extensions/pi-claude-marketplace/shared/notify.ts` | `notify(ctx, pi, message: NotificationMessage)` (line ~1034) | Plan 20-02 single dispatch call in `executeImport` |
| `extensions/pi-claude-marketplace/shared/notify.ts` | `UsageErrorMessage` interface (line 290): `{ readonly message: string; readonly usage: string; }` | Plan 20-01 inline payload construction |
| `extensions/pi-claude-marketplace/shared/notify.ts` | `NotificationMessage` (line 524), `MarketplaceNotificationMessage` (line 502), per-variant `PluginNotificationMessage` interfaces (lines 325-459) | Plan 20-02 inline payload construction |

**Verification commands** (run from project root):

```bash
# V1 ≡ V2 byte-equivalence for notifyUsageError verified at shared/notify.ts:127-156
sed -n '127,156p' extensions/pi-claude-marketplace/shared/notify.ts

# All 30 sites enumerated
grep -rnE "notifyUsageError\(" extensions/pi-claude-marketplace/edge/

# Both catch-all sites enumerated
grep -nE "notifyError\(ctx" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts \
                            extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts

# composeImportSummary + formatClaudeImportSummary consumers
grep -rnE "composeImportSummary|formatClaudeImportSummary" --include="*.ts" extensions/ tests/
```

## Per-File Site Table (current line numbers, verified 2026-05-27)

### Plan 20-01: notifyUsageError signature sweep (30 sites across 15 files)

| File | Sites (line numbers) | Current V1 imports | After Plan 20-01 |
|------|----------------------|--------------------|-----------------|
| `extensions/pi-claude-marketplace/edge/router.ts` | 125, 148, 161, 181 (4 sites) | `import { notifyUsageError } from "../shared/notify.ts"` (line 27) | Same import; call signatures swapped |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` | 58, 85, 95 (3 sites) | `import { notifyUsageError } from "../../../shared/notify.ts"` (line 9) | Same import; signatures swapped |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts` | 43 (1 site) | `import { notifyUsageError } from "../../../shared/notify.ts"` (line 18) | Same import; signature swapped |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts` | 38 (1 site) | `import { notifyUsageError } from "../../../shared/notify.ts"` (line 14) | Same import; signature swapped |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts` | 36 (1 site) | `import { notifyUsageError } from "../../../shared/notify.ts"` (line 18) | Same import; signature swapped |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts` | 36 (1 site) | `import { notifyUsageError } from "../../../shared/notify.ts"` (line 18) | Same import; signature swapped |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts` | 40 (1 site) | `import { notifyUsageError } from "../../../shared/notify.ts"` (line 18) | Same import; signature swapped |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` | 52, 65, 75 (3 sites) | `import { notifyUsageError } from "../../../shared/notify.ts"` (line 27) | Same import; signatures swapped |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` | 36, 48, 61 (3 sites) | `import { notifyUsageError } from "../../../shared/notify.ts"` (line 17) | Same import; signatures swapped |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` | 40, 57, 65 (3 sites) | `import { notifyUsageError } from "../../../shared/notify.ts"` (line 16) | Same import; signatures swapped |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` | 34, 44, 52, 86 (4 sites) | `import { notifyUsageError } from "../../../shared/notify.ts"` (line 15) | Same import; signatures swapped |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` | 31, 36 (2 sites) | `import { notifyError, notifyUsageError } from "../../../shared/notify.ts"` (line 7) | Import stays mixed (notifyError dropped by Plan 20-03, not 20-01) |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` | 38, 43, 49 (3 sites) | `import { notifyError, notifyUsageError } from "../../../shared/notify.ts"` (line 21) | Import stays mixed (notifyError dropped by Plan 20-03, not 20-01) |

**Total: 30 sites across 13 .ts files + 2 partial file imports.** Note CONTEXT.md says "15 files"; the count includes the router (1) + plugin shared (1) + 5 marketplace handlers + 6 plugin handlers = 13 production files. Counting tests separately would exceed 15.

**Mechanical migration shape per site** (V1 ≡ V2 byte-equivalent):

```typescript
// V1 (current, 3-arg)
notifyUsageError(ctx, "some message", USAGE);

// V2 (target, 1-arg structured)
notifyUsageError(ctx, { message: "some message", usage: USAGE });
```

The renderer at `shared/notify.ts:127-156` (verified) emits byte-identical output for both forms.

### Plan 20-02: orchestrators/import/execute.ts cascade migration

| Site | Line (verified) | Current shape | Plan 20-02 target |
|------|-----------------|---------------|-------------------|
| `import { cascadeSummary }` | 11 | `import { cascadeSummary } from "../../presentation/cascade-summary.ts";` | DELETE entirely |
| `import { notifyError, notifySuccess, notifyWarning }` | 15 | V1 three-symbol import | REPLACE with `import { notify } from "../../shared/notify.ts";` plus type imports for `NotificationMessage`, `MarketplaceNotificationMessage`, `PluginNotificationMessage`, per-variant types as needed |
| `formatClaudeImportSummary` (exported helper) | 350-360 | `export function formatClaudeImportSummary(result, probe = DEFAULT_PROBE): string { const { body } = composeImportSummary(...); ... return appendReloadHint(body, hint); }` | DELETE entirely; its sole external consumer is `tests/orchestrators/import/execute.test.ts` (8 invocations) which is rewritten in lockstep |
| `composeImportSummary` (private helper) | 366-435 | Private helper that builds per-(mp,scope) cascade via `enumerateMarketplaceBlocks` + `cascadeSummary` calls; aggregates severity; splices source-mismatch diagnostics; appends orphan diagnostic lines | DELETE entirely; inline the pivot into `executeImport` per D-19-02 strict mirror |
| Line-1001 catastrophic-error emission | 1001 | `notifyError(opts.ctx, "Import failed: ...", err);` inside `try { await executeScopedPlan(...) } catch (err) { ... return result; }` (outer try/catch at lines 979-1003) | **DROP** (see SHAPE recommendation below). Remove the outer try/catch; let truly catastrophic throws bubble to Pi runtime. Per-scope `executeScopedPlan(opts, result, scopePlan)` (line 735-...) has its own internal try/catch on `loadState` (line 745-755) which records a diagnostic and returns; that inner contract is the SOLE expected error path. |
| Line-1018 dispatch ternary | 1018 | `const dispatch = severity === "warning" ? notifyWarning : notifySuccess; dispatch(opts.ctx, finalBody);` | REPLACE with single `notify(opts.ctx, opts.pi, message)` call where `message: NotificationMessage` is constructed inline above |
| `softDepStatus` import + `probe = softDepStatus(opts.pi)` (line 1012) | 10, 1012 | `import { softDepStatus } from "../../platform/pi-api.ts";` + `const probe = softDepStatus(opts.pi);` | RETIRE -- `notify()` probes once per call per D-16-14; the orchestrator only declares `dependencies: readonly Dependency[]` on installed rows |
| `reloadHint` + `appendReloadHint` imports | 12 | `import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";` | DROP entirely -- `notify()` computes reload-hint structurally per D-16-12 |
| `compareByNameThenScope` import | 13 | `import { compareByNameThenScope } from "../../presentation/sort.ts";` | KEEP -- used inline for `marketplaces[]` ordering (caller-order honored per D-16-06); the comparator stays alive in `presentation/sort.ts` because Phase 19 didn't retire it (still consumed elsewhere) |
| Helper `enumerateMarketplaceBlocks` | 438-555 | Private helper that builds per-(mp,scope) cascade rows from result arrays | KEEP-AS-PATTERN -- its iteration discipline (the 6+ outcome-class loops) defines the structurally-correct pivot order. The inline construction in `executeImport` SHOULD follow the same iteration order. The function itself may be deleted or retained as a pure pivot helper; planner's discretion. |
| Helper `spliceSourceMismatchDiagnostics` | 655-709 | Splices cause text under failing marketplace headers via segment-array mutation | RETIRE entirely -- V2 mapping puts source-mismatch reasons directly on `MarketplaceNotificationMessage.reasons` (already established by `enumerateMarketplaceBlocks` line 478-480: `upsertSourceMismatchHeader` sets `reasons: ["source mismatch"]`). The diagnostic CAUSE text becomes structurally lost; this matches D-18-02 precedent (mp-level failures emit bare failed header with no cause-chain). |
| Helper `orphanDiagnosticLines` | 711-730 | Builds bare text lines for diagnostics without `marketplace` field | RETIRE entirely -- recommendation: DROP per D-19-01 precedent. No V2 representation exists without a type amendment (no top-level `reasons?:` field on `NotificationMessage`); the alternative of synthesizing a fake marketplace block is semantically awkward. The dropped surfaces are: `settings-read-error` (file unreadable for a whole scope), `malformed-enabled-plugin-ref` (unparseable plugin ref). Both leave the user without explicit feedback in the rare bug-trigger case but match the D-18-02 mp-level-failure precedent. |
| Helper `composeImportSummary` private helper `ComposedImport` type alias | 361-364 | `interface ComposedImport { readonly body: string; readonly severity: "success" | "warning"; }` | DELETE entirely (no callers after retirement) |

### Plan 20-03: DROP catch-all sites

| File | Lines to delete | Current shape |
|------|-----------------|---------------|
| `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` | 57-66 (the entire outer `try { await bootstrapClaudePlugin({...}); } catch (err) { notifyError(ctx, errorMessage(err), err); }` wrapper); also drop `notifyError` from the line-21 import | `await bootstrapClaudePlugin({...});` stays directly (no wrapper); `errorMessage` import (line 20) becomes unused -- drop it too |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` | 40-50 (the entire outer `try { await ...importClaudeSettings(...) } catch (err) { notifyError(ctx, "Import encountered...", err); }` wrapper); also drop `notifyError` from the line-7 import | `await (deps.importClaudeSettings ?? importClaudeSettings)({...});` stays directly; `errorMessage` import (line 6) becomes unused -- drop it too |
| `tests/edge/handlers/import.test.ts` | line 111-123 (the `"import handler catches unexpected orchestrator throws and surfaces as error"` test) | DELETE the test outright per D-19-01 precedent. Verified by reading the file -- this is the SOLE test that exercises the catch-all path; happy-path + usage-error tests untouched. |
| `tests/edge/handlers/plugin/bootstrap.test.ts` | NO assertion to delete -- verified by grep | The bootstrap.ts:65 catch-all is NOT currently exercised by any test in `tests/edge/handlers/plugin/bootstrap.test.ts`. Plan 20-03 has no test-deletion work in bootstrap. |

**Critical correction to CONTEXT.md line 243:** the catch-all import handler test lives at `tests/edge/handlers/import.test.ts:111-123` (under `tests/edge/handlers/`, NOT `tests/edge/handlers/plugin/`). The `edge/handlers/plugin/import.ts` source file maps to a test at `tests/edge/handlers/import.test.ts`, breaking the otherwise-symmetric `source path → test path` rule. Plan 20-03 must reference the correct path.

### Plan 20-04: MSG-Block 1 ignores extension

| File | Lines to modify | Current state (verbatim) |
|------|-----------------|--------------------------|
| `eslint.config.js` | 159-163 | See `## MSG-Block 1 Current ignores Array` section below |

## MSG-Block 1 Current `ignores` Array (verbatim from `eslint.config.js`)

Verified from `eslint.config.js` lines 151-173:

```javascript
  {
    // MSG-Block 1 (MSG-SR-1..6): cascade/severity routing -- orchestrators
    // surface. Every notify* call site lives under orchestrators/ (edge/
    // has the separate MSG-SR-7 usage-error variant in Block 2). MSG-GR-3
    // is wired separately below across BOTH surfaces (orchestrators/ and
    // edge/handlers/) since Phase 14.2-fix CR-01 surfaced a user-first
    // iteration literal in `edge/handlers/plugin/import.ts:45` that the
    // orchestrator-only glob missed.
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
  },
```

**Plan 20-04 target:** add `"extensions/pi-claude-marketplace/orchestrators/import/**",` as the third entry to the `ignores: [...]` array (between the existing `plugin/**` line and the closing `]`). The resulting array:

```javascript
    ignores: [
      "extensions/pi-claude-marketplace/orchestrators/marketplace/**",
      "extensions/pi-claude-marketplace/orchestrators/plugin/**",
      "extensions/pi-claude-marketplace/orchestrators/import/**",
    ],
```

After Plan 20-04 lands, Block 1's `files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"]` matches files entirely covered by `ignores` -- effectively a no-op. Phase 21 deletes the entire block.

**MSG-Block 1b (lines 174-203) STAYS unchanged** per IN-06 in-file rationale (verified verbatim at lines 175-202; the rationale is documented in the comment block at lines 185-193).

## formatClaudeImportSummary Consumers (complete list)

Verified via `grep -rn "formatClaudeImportSummary" --include="*.ts" extensions/ tests/`:

| Location | Type | Plan 20-02 disposition |
|----------|------|------------------------|
| `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:350` | Definition (`export function formatClaudeImportSummary(...)`) | DELETE entirely |
| `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:354` | Self-reference (`composeImportSummary(result, probe)` inside the function body) | Deleted with the function |
| `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:315, 332, 342, 347` | Comment-only references (TS doc block) | Deleted with the function |
| `extensions/pi-claude-marketplace/orchestrators/import/index.ts:2` | Barrel re-export | DELETE the re-export line |
| `tests/orchestrators/import/execute.test.ts:7` | Import statement | REPLACE with import of `importClaudeSettings` + `makeCtx()` pattern |
| `tests/orchestrators/import/execute.test.ts:44, 72, 685` | `test("formatClaudeImportSummary ...")` test names | RENAME tests; assertions flip to `assert.equal(notifications[0]?.message, ...)` via mock ctx |
| `tests/orchestrators/import/execute.test.ts:69, 96, 572, 607, 642, 679, 711` | 7 invocations as `formatClaudeImportSummary(result)` or `formatClaudeImportSummary(result, UNLOADED_PROBE)` | REWRITE: drive the same fixture through `importClaudeSettings({...})` with a mock `ctx` + `pi` and assert on the recorded `notifications` byte string |

**Total: 1 definition + 1 barrel re-export + 8 test invocations across 5 tests** -- verified by grep with the comment-line filter `grep -v 'index.ts\|execute.ts:'` per the audit grep template in `execute.ts:347`.

## V1 → V2 Outcome-Shape Mapping (for Plan 20-02 cascade pivot)

The `ClaudeImportExecutionResult` (at `execute.ts:120-131`) exposes 8 outcome arrays. The current `enumerateMarketplaceBlocks` (lines 438-555) pivots them into per-(mp,scope) `ImportCascadeInput` blocks; Plan 20-02 inlines an analogous pivot but produces `MarketplaceNotificationMessage[]` instead. Mapping table:

| V1 outcome type | V2 target | Mapping rule | Confidence |
|-----------------|-----------|--------------|------------|
| `MarketplaceAddedOutcome` (line 36-41) | `MarketplaceNotificationMessage` with `status: "added"` | One entry per (scope, marketplace) tuple. Direct mapping. | HIGH (verified against catalog fixture `fresh-mixed-both-scopes` -- all marketplace blocks use `status: "added"`) |
| `MarketplaceSkipOutcome` (line 43-48; `reason: "already-present"`) | `MarketplaceNotificationMessage` with `status: "updated"` | "No-op accepted" partition is part of V2 `updated` semantics per Phase 17.1 + CONTEXT D-20-02 | HIGH (catalog fixture `/claude:plugin bootstrap` state `already-bootstrapped` uses exactly this mapping) |
| `MarketplaceFailureOutcome` (line 91-97; `reason: "add-failed"`, `cause: string`) | `MarketplaceNotificationMessage` with `status: "failed", plugins: []` | V2 has no `cause` field on `MarketplaceNotificationMessage` (verified: line 502-509); the `cause` string is structurally LOST per D-18-02 precedent. Bare failed header is the user-visible surface. | HIGH |
| `SourceMismatchOutcome` (line 99-107; `reason: "source-mismatch"`, `cause: string`) | `MarketplaceNotificationMessage` with `status: "failed", reasons: ["source mismatch"], plugins: [<failed plugin rows below>]` | V1 `upsertSourceMismatchHeader` (line 623-646) already sets `reasons: ["source mismatch"]` on the marketplace row; this carries over directly via the Phase 17.1 `reasons?: readonly Reason[]` field on `MarketplaceNotificationMessage` (line 507). The free-text `cause` string is structurally LOST (no `cause?: Error` on the mp-level type). | HIGH |
| `PluginInstalledOutcome` (line 50-66; carries `declaresAgents: boolean`, `declaresMcp: boolean`, `resourcesChanged: boolean`) | `PluginInstalledMessage` with `name`, `dependencies: readonly Dependency[]` | Compose `dependencies` from `[...(o.declaresAgents ? ["agents" as const] : []), ...(o.declaresMcp ? ["mcp" as const] : [])]`. NO `version` field on `PluginInstalledOutcome` (verified) so V2 `version?:` is omitted. | HIGH (catalog fixture `soft-dep-markers` uses `dependencies: ["agents"]` / `["agents", "mcp"]`) |
| `PluginSkipOutcome` (line 68-75; `reason: "already-installed"`) | `PluginSkippedMessage` with `name`, `reasons: ["already installed"]` | V1 `enumerateMarketplaceBlocks` line 507 already sets `reasons: ["already installed"]` per closed-set CMC-11 vocabulary. Direct carryover. | HIGH |
| `UnexpectedPluginFailureOutcome` (line 109-117; `reason: "unexpected-failure"`, `cause: string`) | `PluginFailedMessage` with `name`, `reasons: ["not in manifest"]`, `cause: cause instanceof Error ? cause : undefined` | V1 line 537 uses `reasons: ["not in manifest"]`. The `cause: string` is awkward -- V2 `cause?: Error` requires an Error object. Recommendation: **drop the cause** (set `cause` to `undefined`) because the V1 cause is a free-text string that can't structurally round-trip into V2's `Error`-typed field without synthesis. The reason brace `{not in manifest}` carries the structural failure shape; the cause string was already being dropped by V1's `enumerateMarketplaceBlocks` (it never appeared in the rendered output, only the reason did). Mirrors D-18-02 mp-level cause-drop precedent for plugin-level unexpected failures. | MEDIUM-HIGH (no catalog fixture covers this exact path; the closest is the standalone-mode `/claude:plugin install` failure-runtime-with-cause fixture, but that comes from a different orchestrator) |
| `ImportWarningOutcome.reason === "unavailable"` (line 77-89) | `PluginUnavailableMessage` with `name`, `reasons: ["no longer installable"]` | V1 `importWarningStatus` (line 557) maps `unavailable`/`uninstallable` to V1 `"unavailable"` plugin status; `importWarningReason` (line 568) maps to closed-set `"no longer installable"` Reason. Direct carryover to V2 `PluginUnavailableMessage`. Note: `PluginUnavailableMessage` carries NO `scope` per SNM-11. | HIGH (catalog fixture `fresh-mixed-both-scopes` plugin `unavailable-plugin` uses `status: "unavailable", reasons: ["hooks"]`) |
| `ImportWarningOutcome.reason === "uninstallable"` | `PluginUnavailableMessage` with `reasons: ["no longer installable"]` | Same as `unavailable` per V1 `importWarningStatus`/`importWarningReason`. | HIGH |
| `ImportWarningOutcome.reason === "marketplace-failed"` | DROP entirely (no V2 row emitted for the plugin) | V1 emits a `(skipped) {not found}` row under the failing marketplace. In V2 the failing marketplace already carries its own `status: "failed", reasons: ["not found"]`; emitting a per-plugin skip row underneath would duplicate the structural failure signal. **Recommendation: DROP per D-19-01 precedent.** | MEDIUM (no catalog fixture covers this path; D-19-01 precedent supports the DROP) |
| `ImportWarningOutcome.reason === "unmappable-marketplace-source"` | DROP entirely (no V2 row emitted) | V1 emits a `(skipped) {unsupported source}` row. V2 has `"unsupported source"` as a closed-set Reason but no marketplace currently in the catalog uses it. The plugin couldn't even be planned, so the surfacing is purely advisory. **Recommendation: DROP per D-19-01 precedent.** | MEDIUM |
| `orphanDiagnosticLines(result)` (line 711-730) -- diagnostics with `d.marketplace === undefined` | DROP entirely | Includes `settings-read-error` and `malformed-enabled-plugin-ref`. No V2 representation exists without a type amendment (no top-level `reasons?:` field on `NotificationMessage`). Synthesizing a fake marketplace block is semantically awkward. **Recommendation: DROP per D-19-01 precedent.** Mirrors D-18-02 mp-level-failure cause-drop precedent. The behavior change: a user with an unreadable settings.json for a scope gets no explicit feedback; the import "succeeds" with zero marketplaces in that scope. Pi runtime's debug logs would show the read-error. | LOW-MEDIUM (this is the most semantically risky DROP -- flagged as a "Pitfall" below) |
| "Already up to date" notice (computed at line 384-385 of `composeImportSummary`) | DROP entirely | The notice is a V1 narrative line ("Import already up to date.") emitted when `!anyChanges(result) && !hasWarnings(result)`. V2 has no equivalent -- the catalog's `/claude:plugin import` fixtures all show state-change output; the no-op case structurally becomes `NotificationMessage { marketplaces: [] }` which renders as `(no marketplaces)` per the renderer's empty-array contract. **Recommendation: DROP**, accept that the no-op case renders as `(no marketplaces)`. (Alternative: keep `marketplaces: []` for "no settings file present at all" and special-case the `up-to-date` shape -- but this requires a catalog amendment which CONTEXT.md does NOT permit.) | MEDIUM (behavior change: idempotent re-imports no longer surface the explicit "up to date" message; the V2 `(no marketplaces)` output is structurally correct but less informative) |
| `PREAMBLE = "Claude plugin import summary"` line (line 318, 422) | DROP entirely | V2 catalog `/claude:plugin import` fixtures (lines 580-650 of `output-catalog.md`) show NO preamble -- the marketplace blocks render directly. The V2 grammar has no preamble concept. | HIGH (verified by reading the catalog fixtures byte-for-byte) |

## Recommended SHAPE for line-1001 catastrophic-error path: **DROP**

### Decision: DROP entirely; remove the outer try/catch at lines 979-1003.

### Rationale

The outer try/catch at `importClaudeSettings` (lines 979-1003) wraps:

1. `loadSettings(scope, ...)` via `Promise.all(...)` (lines 981-986)
2. `result.diagnostics.push(...)` for each scope (lines 988-990)
3. `buildClaudeImportPlan(...)` (lines 992-994)
4. `result.diagnostics.push(...plan.diagnostics)` (line 995)
5. `executeScopedPlan(opts, result, scopePlan)` loop (lines 997-999)

Each of these has its own internal failure mode:

- `loadSettings` returns a `MergedClaudeSettingsResult` with `diagnostics: ImportDiagnostic[]` -- failures inside the loader become diagnostic records, not throws (verified by reading the loader signature in `settings.ts`). The outer catch fires only if `loadSettings` THROWS an UNCAUGHT error.
- `buildClaudeImportPlan` is a pure planning function over already-loaded settings; if it throws, that's a programming bug, not a runtime condition.
- `executeScopedPlan` has its own internal try/catch on `loadState` (line 745-755) that records a diagnostic and returns. Per-plugin errors are caught inside `installPlugin` and routed to `dispatchFailedOutcome` (line 921-973). The outer catch on the scope-level executor fires only if `executeScopedPlan` throws UNHANDLED.

In every case, the outer catch firing indicates a bug -- either in our loader code, in the `buildClaudeImportPlan` planner, or in `executeScopedPlan`'s exception discipline. Forcing a polished V1 `notifyError(opts.ctx, "Import failed: ...", err)` output would MASK the bug by emitting a user-friendly error message that the user reports as "import failed" rather than as "the import command crashed with an unhandled exception."

Pi runtime's uncaught-exception boundary surfaces a stack trace, which is materially BETTER for debugging.

### Alternative shapes considered (rejected)

| Alternative | Why rejected |
|-------------|--------------|
| KEEP as bare-failed-marketplace (D-18-02 precedent) | The catastrophic-error path has no marketplace context -- there's no `MarketplaceFailureOutcome` to anchor a `status: "failed"` to. Synthesizing a fake marketplace name ("claude-import" or similar) is semantically awkward and not in the closed `MarketplaceStatus` lexicon contextually. |
| KEEP as synthesized failed plugin row | No plugin context exists at this layer either. Inventing both a marketplace name AND a plugin name is doubly fictional. |
| KEEP with bare `notify(ctx, pi, { marketplaces: [] })` rendering as `(no marketplaces)` | Misleads the user into thinking the import succeeded but had nothing to import -- the opposite of the actual condition. |
| Phase 15 type amendment to add top-level `cause?: Error` on `NotificationMessage` | Explicitly REJECTED per CONTEXT.md `<deferred>`. Out of scope for v1.4. |

### Implementation shape for Plan 20-02

```typescript
// BEFORE (lines 979-1003)
export async function importClaudeSettings(opts): Promise<...> {
  const result = emptyResult();
  try {
    // ... loadSettings, buildClaudeImportPlan, executeScopedPlan loop ...
  } catch (err) {
    notifyError(opts.ctx, `Import failed: ${errorMessage(err)}`, err);
    return result;
  }
  // ... composeImportSummary + dispatch ...
}

// AFTER (Plan 20-02)
export async function importClaudeSettings(opts): Promise<...> {
  const result = emptyResult();
  // ... loadSettings, buildClaudeImportPlan, executeScopedPlan loop ...
  // (no outer try/catch; truly catastrophic errors bubble to Pi runtime)

  // Inline V2 NotificationMessage construction below
  const message: NotificationMessage = { marketplaces: /* pivoted from result */ };
  notify(opts.ctx, opts.pi, message);
  return result;
}
```

The `errorMessage` import (line 14) becomes unused after this change; drop from the import list. The `ConcurrentInstallError, PluginShapeError` imports stay (still used by `dispatchFailedOutcome` line 921+).

## Architecture Patterns

### Pattern 1: Mechanical signature sweep (Plan 20-01)

**What:** 30 sites swap from V1 3-arg to V2 1-arg signature with byte-equal output.
**When to use:** When the renderer is dual-overload byte-equal and only the call-site syntax changes.
**Example:**

```typescript
// V1 (every callsite, current)
notifyUsageError(ctx, "some message", USAGE);

// V2 (Plan 20-01 target)
notifyUsageError(ctx, { message: "some message", usage: USAGE });
```

Both compile through the migration window. Test assertions at every callsite stay BYTE-IDENTICAL because `shared/notify.ts:127-156` emits `${message}\n\n${usage}` at "error" severity for both forms.

### Pattern 2: Inline V2 NotificationMessage construction (Plan 20-02, mirrors D-19-02)

**What:** The orchestrator pivots its outcome arrays directly into a `NotificationMessage { marketplaces: readonly MarketplaceNotificationMessage[] }` tree and calls `notify(opts.ctx, opts.pi, message)` exactly ONCE per orchestration. No intermediate string composition; no severity ternary; no reload-hint trailer construction. The renderer owns all of that.
**When to use:** When the orchestrator's V1 surface is a `cascadeSummary`-driven body string.
**Example structure** (Plan 20-02 final dispatch):

```typescript
// Inline pivot -- by-(mp, scope) tuple with caller-controlled order (D-16-06)
const byMp = new Map<string, { name: string; scope: Scope; status: MarketplaceStatus; reasons?: readonly Reason[]; plugins: PluginNotificationMessage[] }>();

// Iterate result.addedMarketplaces -> status: "added"
// Iterate result.skippedExistingMarketplaces -> status: "updated"
// Iterate result.marketplaceFailures -> status: "failed", plugins: []
// Iterate result.sourceMismatches -> status: "failed", reasons: ["source mismatch"], plugins: <dependent rows>
// Iterate result.installedPlugins -> PluginInstalledMessage with dependencies derived from declaresAgents/declaresMcp
// Iterate result.skippedExistingPlugins -> PluginSkippedMessage with reasons: ["already installed"]
// Iterate result.unexpectedPluginFailures -> PluginFailedMessage with reasons: ["not in manifest"], cause: undefined
// Iterate result.warnings (filter to unavailable/uninstallable reasons) -> PluginUnavailableMessage with reasons: ["no longer installable"]
// Drop: result.warnings reasons "marketplace-failed" and "unmappable-marketplace-source"
// Drop: result.diagnostics with marketplace === undefined (orphans)
// Drop: the V1 PREAMBLE and "Already up to date" notice

const marketplaces = [...byMp.values()]
  .sort(compareByNameThenScope) // (project before user, name primary case-insensitive)
  .map(toMarketplaceNotificationMessage);

const message: NotificationMessage = { marketplaces };
notify(opts.ctx, opts.pi, message);
return result;
```

The planner has discretion to factor the pivot into small pure helpers (e.g., `pluginsFromOutcomes(outcomes): PluginNotificationMessage[]`) within `execute.ts` if the inline construction balloons.

### Pattern 3: Defense-in-depth catch-all DROP (Plan 20-03)

**What:** Outer try/catch wrappers in edge handlers around orchestrator calls whose inner orchestrators emit V2 failed notifications on caught errors are DROPPED entirely. Truly catastrophic uncaught throws bubble to Pi runtime.
**When to use:** When the inner orchestrator already has a complete V2 failure-emission contract.
**Example:**

```typescript
// BEFORE
try {
  await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });
} catch (err) {
  notifyError(ctx, errorMessage(err), err);
}

// AFTER (Plan 20-03)
await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });
```

### Anti-patterns to Avoid

- **Per-command usage-error fixtures in `docs/output-catalog.md`** -- explicitly REJECTED per D-20-04. The single generic `<!-- catalog-state: usage-error -->` fixture gates STRUCTURAL SHAPE; handler unit tests gate per-callsite CONTENT.
- **Touching `presentation/cascade-summary.ts`** -- Plan 20-02 only drops the IMPORT in `execute.ts`. The composer file stays alive until Phase 21 deletes it.
- **Synthesizing a fake marketplace name for the line-1001 catastrophic-error path** -- see SHAPE recommendation above. The Pi runtime stack-trace is BETTER for debugging.
- **Re-introducing a `["user", "project"]` literal in any migrated file** -- MSG-Block 1b still gates edge handlers AND orchestrators (per IN-06 rationale at `eslint.config.js:185-193`).
- **Calling `notify()` more than once per orchestration** -- D-19-01 + D-18-01 single-notify-per-orchestration discipline. Plan 20-03's catch-all DROP preserves this: no SECOND notify after the primary.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Severity computation for the import cascade | Manual `severity === "warning" ? notifyWarning : notifySuccess` ternary | `notify(ctx, pi, message)` (single call) | D-16-11 -- severity is computed structurally by the renderer from message contents; the V1 ternary becomes obsolete after migration |
| Reload-hint trailer composition | `appendReloadHint(body, reloadHint(installedPlugins))` | `notify()` (single call) | D-16-12 -- reload-hint is computed structurally per state-change variant in the renderer |
| Soft-dep status probe | `softDepStatus(opts.pi)` at orchestrator level | `notify()` (probes once per call) | D-16-14 -- single probe per `notify()` invocation; the orchestrator only declares `dependencies: readonly Dependency[]` |
| Marketplace-block iteration ordering | Per-orchestrator sort logic | `compareByNameThenScope` from `presentation/sort.ts` | D-16-06 -- caller controls iteration order; existing comparator handles project-before-user + name primary case-insensitive |
| `{ message, usage }` UsageErrorMessage construction | Helper functions per callsite | Inline at each callsite | D-19-07 inheritance -- inline construction is the structural-payload-at-callsite discipline of Phases 18/19 |
| Catch-all error wrappers around V2 orchestrator calls | Outer `try { ... } catch (err) { notifyError(...) }` | Nothing -- let truly catastrophic throws bubble to Pi runtime | D-20-03 -- inner orchestrators already emit V2 failed notifications; the outer catch only ever fires on bugs that benefit from stack traces |

**Key insight:** The V2 renderer + type model is the SOLE site that knows the user-output grammar (SNM-17). Every orchestrator and edge handler in Phase 20 either constructs a typed payload (inline) or invokes the dual-overload V2 entrypoint. NO string concatenation, NO severity branching, NO reload-hint composition, NO soft-dep probe -- all those concerns moved into `shared/notify.ts` during Phases 16-19.

## Runtime State Inventory

**Not applicable.** Phase 20 is a pure refactor:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- verified by reading `execute.ts` and edge handlers; no rename touches persisted state | None |
| Live service config | None -- verified; no Pi-side or external service mentions the migrated symbols by literal name | None |
| OS-registered state | None -- verified; no OS task or process registration references the migrated code paths | None |
| Secrets/env vars | None -- verified; no env var name references | None |
| Build artifacts | None -- verified; no build artifact embeds the V1 symbol names |

This is a code-level refactor with no rename of persisted identifiers; the V1 wrappers stay alive until Phase 21 and the V2 wrappers already exist alongside (the dual-overload signature pattern at `shared/notify.ts:127-156`).

## Common Pitfalls

### Pitfall 1: Missing the `notifyError` import drop in plug 20-03

**What goes wrong:** Plan 20-03 deletes the catch-all block but leaves `notifyError` in the import line. ESLint's import-x plugin would flag the unused import, breaking the GREEN gate.
**Why it happens:** Both `bootstrap.ts` and `import.ts` mix `notifyError` and `notifyUsageError` in a single `import { notifyError, notifyUsageError } from "../../../shared/notify.ts"` statement. Dropping the catch-all leaves `notifyError` unused; `notifyUsageError` must remain (Plan 20-01 migrated it but didn't drop it).
**How to avoid:** Plan 20-03 explicitly enumerates BOTH file imports as part of its file mutations. After landing, the imports become `import { notifyUsageError } from "../../../shared/notify.ts"` (V2-only). Additionally, `errorMessage` from `shared/errors.ts` becomes unused in both files after the catch-all is removed (it was only referenced in the catch body); drop that import too.
**Warning signs:** `npm run check` failing with `no-unused-vars` or `import-x` errors after Plan 20-03 lands.

### Pitfall 2: Test path skew (CONTEXT.md is slightly wrong)

**What goes wrong:** CONTEXT.md line 243 refers to "`tests/edge/handlers/plugin/import.test.ts`" but the actual file lives at `tests/edge/handlers/import.test.ts` (NOT under `plugin/`).
**Why it happens:** The `edge/handlers/plugin/import.ts` source path has a corresponding test at a non-symmetric path. CONTEXT.md was authored from memory/audit and slipped.
**How to avoid:** Plan 20-03 references `tests/edge/handlers/import.test.ts` directly. The catch-all test at lines 111-123 of that file is the SINGLE assertion to delete.
**Warning signs:** A `find` for `import.test.ts` under `tests/edge/handlers/plugin/` returns empty; the test actually lives at `tests/edge/handlers/import.test.ts`.

### Pitfall 3: Orphan diagnostic DROP is the riskiest data-loss

**What goes wrong:** `orphanDiagnosticLines(result)` currently surfaces `settings-read-error` and `malformed-enabled-plugin-ref` diagnostics that don't tie to a marketplace. DROPPING them per recommendation means a user with an unreadable `settings.json` for a scope gets ZERO user-visible feedback -- the import completes "successfully" with zero marketplaces in that scope.
**Why it happens:** V2's `NotificationMessage` has no top-level `reasons?:` or `diagnostics?:` field. The only place to surface orphan diagnostics is a synthesized fake marketplace block, which is semantically awkward.
**How to avoid:** Recommendation is to DROP per D-19-01 precedent -- but the planner SHOULD verify with the user that the DROP is acceptable before locking Plan 20-02. The Pi runtime's debug log surface still captures the diagnostic; it's only the user-facing notification that's silenced. If the user objects, the alternative is to construct a synthesized marketplace block with `name: ""` (the empty-name renderer behavior is unclear -- would need a renderer audit) or to defer the orphan-handling decision to a future phase.
**Warning signs:** Tests in `tests/orchestrators/import/execute.test.ts` that exercise `loadState throws` → diagnostic emission (line 782+ "emits diagnostic and skips scope when loadState throws") will FAIL because the V2 output won't contain the diagnostic text. Plan 20-02 must DELETE that test per D-19-01 precedent.

### Pitfall 4: "Already up to date" notice loss

**What goes wrong:** The V1 "Import already up to date." notice fires when `!anyChanges(result) && !hasWarnings(result)`. V2 has no equivalent; the idempotent re-import renders as `(no marketplaces)` (the renderer's empty-array sentinel).
**Why it happens:** V2 catalog `/claude:plugin import` fixtures (lines 580-650 of output-catalog.md) all show state-change output; there's no fixture for the no-op case.
**How to avoid:** Plan 20-02 must DELETE the test at `tests/orchestrators/import/execute.test.ts:44` ("`formatClaudeImportSummary` reports already up to date for idempotent skips") per D-19-01 precedent. The behavior change is intentional; the V2 grammar treats the no-op case as structurally `(no marketplaces)`.
**Warning signs:** `assert.match(formatClaudeImportSummary(result), /already up to date/)` assertion will become impossible to satisfy after V2 migration; the test must be deleted, not refactored.

### Pitfall 5: Source-mismatch cause-text loss

**What goes wrong:** V1's `spliceSourceMismatchDiagnostics` (lines 655-709) surfaces the free-text cause line beneath the failing marketplace header (catalog lines 525-540 in V1 era). V2 has no `cause?: Error` on `MarketplaceNotificationMessage`; the cause text is structurally LOST. Only the closed-set Reason `["source mismatch"]` survives.
**Why it happens:** D-18-02 precedent -- mp-level failures emit bare failed headers in V2 with no cause-chain. The cause-text drop is consistent.
**How to avoid:** Plan 20-02 must DELETE or REWRITE the test assertions in `tests/orchestrators/import/execute.test.ts` that match on the splice text. Specifically the tests at lines 175 ("source mismatch skips dependent plugins") and 225 ("cross-kind source as mismatch") that assert on cause text via `formatClaudeImportSummary`.
**Warning signs:** Test assertions matching on the diagnostic cause string become impossible.

### Pitfall 6: Soft-dep probe at orchestrator level becomes a NO-OP

**What goes wrong:** `softDepStatus(opts.pi)` at line 1012 of `execute.ts` becomes dead code after migration. If Plan 20-02 retires the line but the planner accidentally keeps the import statement, lint fires.
**Why it happens:** The Phase 16 D-16-14 contract moved soft-dep probing into `notify()`; orchestrators only declare `dependencies`.
**How to avoid:** Plan 20-02 drops the `softDepStatus` import (line 10) AND the probe assignment (line 1012). The `SoftDepProbe` type import (if still referenced for the `composeImportSummary` signature) also goes away with the function deletion.
**Warning signs:** `npm run check` failing with `no-unused-vars` for `softDepStatus`.

## Code Examples

Verified patterns from official sources (catalog fixtures + renderer):

### V2 `notifyUsageError` (Plan 20-01 target)

```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:129 (V2 overload)
//         extensions/pi-claude-marketplace/shared/notify.ts:290 (UsageErrorMessage type)
notifyUsageError(ctx, {
  message: "Usage error.",
  usage: TOP_LEVEL_USAGE,
});
```

### V2 `notify()` cascade dispatch (Plan 20-02 target)

```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:1034 (notify signature)
//         tests/architecture/catalog-uat.test.ts:925-1042 (/claude:plugin import fixtures)
const message: NotificationMessage = {
  marketplaces: [
    {
      name: "claude-plugins-official",
      scope: "project",
      status: "added",
      plugins: [
        { status: "installed", name: "official-plugin", dependencies: [] },
      ],
    },
    // ... additional marketplaces ...
  ],
};
notify(opts.ctx, opts.pi, message);
```

### Catch-all DROP (Plan 20-03 target)

```typescript
// BEFORE (current bootstrap.ts:57-66)
try {
  await bootstrapClaudePlugin({ ctx, pi, cwd: ctx.cwd, gitOps: deps.gitOps });
} catch (err) {
  notifyError(ctx, errorMessage(err), err);
}

// AFTER (Plan 20-03)
await bootstrapClaudePlugin({ ctx, pi, cwd: ctx.cwd, gitOps: deps.gitOps });
// (no try/catch; truly catastrophic throws bubble to Pi runtime)
```

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` are binding on every plan:

- **Git:** never commit to `main`. Branch names: `main`, `features/*`, `releases/*`. Worktrees preferred under `.worktrees/`.
- **Conventional Commits**: titles 5-72 chars; body lines ≤80 chars.
- **Pre-commit hooks:** `pre-commit run --all-files` (or `--files <changed>`) BEFORE `git commit`; fix failures, re-stage, re-run until clean. Never use `--no-verify`.
- **Worktree commits:** prefix with `SKIP=trufflehog` ONLY (trufflehog hook auto-updater fails under worktree sandbox; standalone `pre-commit run trufflehog --all-files` confirms clean before commit). Do not extend `SKIP=` to other hooks.
- **PR descriptions:** use the `humanizer` skill if available.
- **Versioning:** before creating a PR, offer to bump version in `project.json` + `sonar.properties`, and record in `CHANGELOG.md`. Be succinct.
- **Containment (NFR-10):** refuse to write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, or `<scopeRoot>/mcp.json`.
- **Quality bar (NFR-6):** `npm run check` must stay green -- typecheck + ESLint + Prettier + tests.
- **Output channel (IL-2):** all user-visible messages MUST go through `ctx.ui.notify(message, severity)`; direct `process.stdout`/`process.stderr` writes forbidden in command/bridge code. Single sanctioned `console.warn` is the load-time legacy-migration save failure (IL-3).
- **No telemetry V1 (IL-4):** no metrics, no event sink, no analytics endpoint.
- **English only V1 (IL-1):** no message catalog, no locale negotiation.
- **GSD workflow:** all file-changing tools must run through a GSD command. Phase 20 plans satisfy this via `/gsd-execute-phase`.

These constraints affect every plan structure: Plan 20-01 may need to be split into sub-commits if any individual file change triggers a hook failure; Plan 20-04 is the final-gate commit and must verify `npm run check` GREEN before merge.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| V1 severity-named wrappers (`notifySuccess` / `notifyWarning` / `notifyError`) | V2 `notify(ctx, pi, message)` with computed severity | Phase 16 (Phase 21 deletes V1) | Severity is structural, not a field |
| V1 3-arg `notifyUsageError(ctx, msg, usage)` | V2 1-arg `notifyUsageError(ctx, { message, usage })` | Phase 16 (Phase 21 deletes V1 overload) | Phase 20 migrates all 30 sites |
| Per-orchestrator `softDepStatus(pi)` probe | Single `softDepStatus(pi)` per `notify()` call | Phase 16 (D-16-14) | Orchestrator declares `dependencies`; renderer probes |
| Free-text cause-chain trailer at top level | Per-plugin `cause?: Error` on `PluginFailedMessage`/`PluginManualRecoveryMessage` | Phase 15 (D-15-10) | Mp-level failures emit bare headers (D-18-02 precedent extends to import cascade) |
| `presentation/cascade-summary.ts::cascadeSummary` orchestrating message + severity | Inline construction at each orchestrator + single `notify()` call | Phase 18-19 (D-18-01, D-19-02; Phase 20 extends to import family) | Phase 20 closes the cascade-summary consumer set; Phase 21 deletes the composer |

**Deprecated/outdated:**

- `composeImportSummary` private helper in `execute.ts:366-435` -- Phase 20 retires.
- `formatClaudeImportSummary` exported test helper in `execute.ts:350-360` -- Phase 20 retires.
- V1 catch-all `notifyError` sites in `bootstrap.ts:65` + `import.ts:49` -- Phase 20 drops.
- The "Already up to date" notice and the `Claude plugin import summary` preamble -- Phase 20 drops.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ImportWarningOutcome.reason === "marketplace-failed"` and `"unmappable-marketplace-source"` should be DROPPED entirely | V1→V2 Mapping | The advisory plugin-skip row is lost; the marketplace's own `status: "failed"` carries the structural signal. If user wants the explicit per-plugin row, they need to argue for `PluginUnavailableMessage` with synthesized `reasons` -- but the catalog has no fixture covering it. |
| A2 | `orphanDiagnosticLines` should be DROPPED entirely | V1→V2 Mapping + Pitfall 3 | Users with unreadable `settings.json` for a scope get NO explicit feedback; only Pi runtime debug logs surface the issue. The recommendation is the riskiest DROP; flag for user confirmation before Plan 20-02 locks. |
| A3 | The "Already up to date" notice should be DROPPED | V1→V2 Mapping + Pitfall 4 | Idempotent re-imports render as `(no marketplaces)` instead of explicit "up to date" -- structurally correct but less informative. The V2 catalog has no fixture for the no-op case; the only alternative is a catalog amendment which CONTEXT.md does NOT permit. |
| A4 | Source-mismatch cause-text drop is acceptable (D-18-02 precedent) | V1→V2 Mapping + Pitfall 5 | The free-text cause string is LOST; only the closed-set `["source mismatch"]` reason survives. Consistent with mp-level failure precedent across Phases 18-19. |
| A5 | `UnexpectedPluginFailureOutcome.cause: string` is DROPPED in the V2 PluginFailedMessage (cause set to `undefined`) | V1→V2 Mapping | The free-text cause was already non-rendered by V1 (`enumerateMarketplaceBlocks` line 537 only sets `reasons: ["not in manifest"]`, not the cause). DROP preserves V1 behavior. |
| A6 | Test deletion (per D-19-01 precedent) is the correct discipline for tests that targeted dropped V1 surfaces | Pitfalls 3, 4, 5 | If the user wants the dropped data preserved somehow, the type model would need an amendment (REJECTED per CONTEXT.md `<deferred>`). |

**Confirmation expected:** Plan 20-02 plan-check or discuss-phase should re-confirm A1-A3 with the user. A4-A6 are direct inheritance from Phase 18/19 precedent and should not require new debate.

## Open Questions

1. **Should orphan diagnostic lines be surfaced via a synthesized marketplace block?**
   - What we know: V2 has no top-level `reasons?:` or `diagnostics?:` field; the closed-set Marketplace type forbids "fake" names structurally.
   - What's unclear: whether the user values explicit settings-read-error feedback enough to justify a synthesized block with an empty `name: ""` and `status: "failed"`. The renderer's behavior for empty-name marketplaces would need an audit.
   - Recommendation: DROP per D-19-01 precedent. If the user pushes back, Plan 20-02 can carve a small "diagnostics carrier" synthesized block, but this needs explicit user approval.

2. **Should `tests/orchestrators/import/execute.test.ts` test count drop dramatically?**
   - What we know: 8 `formatClaudeImportSummary` invocations across 5 tests. Plus tests at line 782 (loadState throws), 822 (unrecognized stored source diagnostic), 44 (idempotent skip "already up to date"), 175/225 (source-mismatch diagnostic splice) all reference V1-only surfaces.
   - What's unclear: how many tests will be DELETED outright vs REWRITTEN to V2 assertions. The mock-ctx + `importClaudeSettings` happy-path tests can be rewritten; the dropped-surface tests get deleted per D-19-01.
   - Recommendation: Plan 20-02 verifies test count delta against `npm run check` GREEN at each commit boundary. Expected: ~5-8 tests DELETED outright; the remaining ~15+ tests REWRITTEN with byte-exact V2 assertions through `notify()`.

3. **Does `presentation/cascade-summary.ts` have any other consumer after Plan 20-02 lands?**
   - What we know: `grep -rn "cascade-summary\|cascadeSummary" extensions/` (verified) shows only `execute.ts:11` as the active import-statement consumer (plus `presentation/index.ts:47,53` barrel re-exports). `tests/presentation/cascade-summary.test.ts` is the unit test (out of scope per CONTEXT.md).
   - What's unclear: whether the `presentation/index.ts` barrel re-export needs to be touched in Phase 20.
   - Recommendation: NO -- Phase 20 only mutates `execute.ts`'s import. The barrel re-export at `presentation/index.ts:47,53` stays alive until Phase 21 (it's a documentation surface; no production code currently imports `cascadeSummary` through the barrel). Verified: `grep -rn "from.*presentation\";\|from.*presentation/index" extensions/` returns the orchestrator/plugin/* family which already retired its imports in Phase 19.

## Environment Availability

Phase 20 is a pure refactor with no external dependencies. All required tooling (Node ≥22, TypeScript, ESLint, Prettier, node:test) is already in `package.json` from Phases 1-19.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | ≥22 (per NFR-4) | -- |
| TypeScript | typecheck | ✓ | 5.x (per package.json) | -- |
| ESLint flat config | lint | ✓ | 10.x (per CLAUDE.md tech-stack) | -- |
| Prettier | format | ✓ | 3.x | -- |
| node:test | tests | ✓ | bundled | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

Nyquist Dimension 8 -- every requirement (or implicit invariant) has a fast automated test.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in; bundled with Node ≥22) |
| Config file | None (test scripts in `package.json::scripts.test`) |
| Quick run command | `node --test tests/edge/handlers/<handler>.test.ts` (per-handler) |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + full test suite) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SNM-23 | V2 1-arg `notifyUsageError` byte-equal to V1 3-arg | unit (per-handler) | `node --test tests/edge/router.test.ts tests/edge/handlers/marketplace/*.test.ts tests/edge/handlers/plugin/*.test.ts` | ✅ (V1 ≡ V2 assertion targets unchanged per D-20-06) |
| SNM-23 | Plan 20-01 atomic -- zero V1 3-arg `notifyUsageError(ctx, msg: string, usage: string)` callsites remain in `edge/**` | architecture (grep gate at commit time) | `grep -rE "notifyUsageError\(ctx,\s*\"[^\"]*\",\s*[A-Z_]+\)" extensions/pi-claude-marketplace/edge/ \| wc -l` returns 0 | N/A (run as part of pre-commit) |
| Implicit (D-20-03) | `bootstrap.ts:65` and `import.ts:49` catch-all wrappers gone | architecture (grep gate) | `grep -cE "notifyError\(ctx" extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` returns `0` for both | ✅ (post-merge verification) |
| Implicit (D-20-02) | `composeImportSummary` + `formatClaudeImportSummary` retired | architecture (grep gate) | `grep -cE "composeImportSummary\|formatClaudeImportSummary" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns `0` | ✅ (post-Plan-20-02) |
| Implicit (D-20-02) | `presentation/cascade-summary` import dropped from `execute.ts` | architecture (grep gate) | `grep -c "presentation/cascade-summary\|cascadeSummary" extensions/pi-claude-marketplace/orchestrators/import/execute.ts` returns `0` | ✅ (post-Plan-20-02) |
| Implicit (catalog UAT) | `/claude:plugin import` 4 catalog states byte-equal | byte-equality (catalog UAT) | `node --test tests/architecture/catalog-uat.test.ts` | ✅ (existing 4 fixtures at `tests/architecture/catalog-uat.test.ts:925-1042`) |
| Implicit (catalog UAT) | Generic usage-error fixture byte-equal | byte-equality (catalog UAT) | `node --test tests/architecture/catalog-uat.test.ts` | ✅ (existing single fixture at `docs/output-catalog.md:937-943`) |
| Implicit (D-20-07) | MSG-Block 1 ignores extended; lint plugin still wired but effectively no-op | lint suite | `npm run check` | ✅ (already exists; the final `npm run check` GREEN gate is the verification) |

### Sampling Rate

- **Per task commit (Plan 20-01 sub-step):** `node --test <touched test file>` -- sub-second per file.
- **Per plan merge (Plans 20-01/02/03/04):** `npm run check` -- full typecheck + ESLint + Prettier + tests. Each plan's atomic commit MUST be GREEN.
- **Phase gate (after Plan 20-04 lands):** Full suite green before `/gsd-verify-work`. Specifically:
  1. `npm run check` GREEN
  2. Catalog UAT (`tests/architecture/catalog-uat.test.ts`) GREEN for all 4 `/claude:plugin import` fixtures + the usage-error fixture
  3. `grep -rE "notify(Success|Warning|Error)\b" extensions/pi-claude-marketplace/edge/ extensions/pi-claude-marketplace/orchestrators/import/` returns ZERO (no V1 wrapper imports/calls remain in the migrated surfaces)
  4. `grep -rE "notifyUsageError\(ctx,\s*\"" extensions/pi-claude-marketplace/edge/` returns ZERO (no V1 3-arg signatures remain)

### Wave 0 Gaps

- [ ] None -- existing test infrastructure covers all phase requirements. The 15 edge-handler test files + `tests/orchestrators/import/execute.test.ts` + `tests/architecture/catalog-uat.test.ts` are all present and exercise the relevant surfaces.

## Security Domain

Phase 20 is a pure refactor with NO new external input surface, NO new file write, NO new network call. The threat surface is mis-routed notifications, dropped error visibility, or escaping lint coverage. NO ASVS category applies in a load-bearing way (V5 input validation does not change -- the argv-parsing logic is unchanged; the V1 → V2 migration is at the notification-renderer boundary).

### Threat Model

| Threat | STRIDE | Standard Mitigation | Residual Risk |
|--------|--------|---------------------|---------------|
| Mis-routed notification severity post-migration (e.g., a usage error rendered at info severity) | Information disclosure (user sees wrong-severity output) | V1 ≡ V2 byte invariance verified at `shared/notify.ts:127-156`; existing test assertions stay byte-identical per D-20-06; catalog UAT (`tests/architecture/catalog-uat.test.ts`) drives the generic usage-error fixture through real `notify()` | LOW -- the migration is a SIGNATURE change at call sites, not a renderer change. The renderer is the SOLE site that knows the user-output grammar (SNM-17). |
| Catastrophic-error path silently dropped (D-20-03 + line-1001 DROP recommendation) | Denial of service / Information disclosure (user can't tell why an import crashed) | Pi runtime's uncaught-exception boundary surfaces a stack trace with the actual cause; this is BETTER for debugging than a polished error message that masks the bug. Inner orchestrators emit V2 failed notifications for all expected failures; the outer catch fires only on bugs. | LOW-MEDIUM -- the user-visible quality of the error message degrades for the rare bug-trigger case. Recommendation: monitor `npm run check` logs in CI for new uncaught-exception traces; investigate any that surface to confirm they're actual bugs and not regressions in the expected error-handling contract. |
| Lint plugin no-op masking new V1 wrapper introductions in unmigrated paths | Tampering (regression to V1 surfaces re-introduces drift) | MSG-Block 1's `ignores` only covers the 3 orchestrator families. The rest of `extensions/pi-claude-marketplace/**/*.ts` is still covered by Block 1's `files:` glob (no-op via the ignores, but the underlying rules still execute when `files:` matches and `ignores:` doesn't). MSG-Block 1b's `edge/handlers/**` files entry STAYS per IN-06 -- iteration discipline is V1-wrapper-INDEPENDENT and continues to gate `["user", "project"]` regressions. The grep gates in Validation Architecture above provide secondary verification. | LOW -- Phase 20 explicitly retains all V1-wrapper-INDEPENDENT lint coverage; only the V1-wrapper-DEPENDENT MSG-Block 1 narrows additively. Phase 21 deletes the entire MSG-* plugin; any future drift after that would surface only via the new `no-restricted-syntax` rule (SNM-27) blocking direct `ctx.ui.notify` calls outside `shared/notify.ts`. |

**Conclusion:** Three rows; all rated LOW or LOW-MEDIUM. No new external attack surface; the threats are quality-of-output regressions, not security regressions.

## Sources

### Primary (HIGH confidence)

- `extensions/pi-claude-marketplace/shared/notify.ts` (read in full at relevant line spans) -- V2 type model and dual-overload renderer. `UsageErrorMessage` (line 290), `NotificationMessage` (line 524), `MarketplaceNotificationMessage` (line 502), per-variant plugin types (lines 325-459), V2 `notifyUsageError` overload (line 129), V1 ≡ V2 byte-equivalence body (lines 130-150).
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` (read in full segments) -- all line numbers verified verbatim. `composeImportSummary` at 366-435; `formatClaudeImportSummary` at 350-360; line-1001 catastrophic-error; line-1018 dispatch ternary; `enumerateMarketplaceBlocks` at 438-555; `spliceSourceMismatchDiagnostics` at 655-709; `orphanDiagnosticLines` at 711-730; `ImportClaudeSettingsOptions.pi` at line 159.
- `extensions/pi-claude-marketplace/edge/router.ts` -- sites at 125, 148, 161, 181 verified verbatim.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` -- sites at 58, 85, 95 verified.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/{bootstrap,import,install,update,list,reinstall}.ts` -- all sites verified per the per-file table above.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/{add,autoupdate,list,remove,update}.ts` -- all 5 sites verified.
- `tests/architecture/catalog-uat.test.ts:925-1042` -- 4 `/claude:plugin import` fixtures (`fresh-mixed-both-scopes`, `scope-project-narrow`, `soft-dep-markers`, `same-mp-both-scopes`) verified verbatim.
- `tests/orchestrators/import/execute.test.ts` -- 8 `formatClaudeImportSummary` invocations across 5 tests verified by grep.
- `tests/edge/handlers/import.test.ts:111-123` -- catch-all test verified verbatim (target of Plan 20-03 DELETE).
- `eslint.config.js:151-202` -- MSG-Block 1 + 1b structure verified verbatim; the IN-06 in-file rationale at lines 185-193 cited directly.
- `docs/output-catalog.md:572-654` (import section), 656-684 (bootstrap section), 933-948 (usage-error section) -- V2 user contract fixtures.
- `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-CONTEXT.md` -- locked decisions D-20-01..D-20-07 inherited.
- `.planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-CONTEXT.md` -- D-19-01 (DROP precedent), D-19-02 (inline cascade), D-19-07 (test discipline), D-19-08 (additive lint narrowing) inherited.
- `.planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-CONTEXT.md` -- D-18-02 (bare-failed-marketplace mp-level cause-drop) inherited.
- `.planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-06-SUMMARY.md` -- IN-06 in-file rationale precedent.

### Secondary (MEDIUM confidence)

- None used as load-bearing for Phase 20 -- all critical claims are verified against the source tree or the catalog.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- no new dependencies; the V2 contract is fixed by Phases 15-19.
- Per-file line numbers: HIGH -- every line number verified against the current branch (commit `666c6d9`, branch `gsd/v1.3-replan-catalog`) on 2026-05-27.
- V1 → V2 outcome mapping: HIGH for the locked decisions (D-20-02), MEDIUM-HIGH for the discretionary mappings (A1-A6) which are recommendations rather than locked. Planner should treat A2 (orphan diagnostics DROP) as needing user confirmation before locking.
- Line-1001 SHAPE recommendation: HIGH for the DROP recommendation (consistent with D-20-03 + D-19-01 + D-18-02 inheritance chain).
- Catalog UAT coverage: HIGH -- 4 fixtures already shipped in Phase 17 + the generic usage-error fixture cover all Phase 20 surfaces.
- Threat model: HIGH -- three LOW/LOW-MEDIUM threats with established mitigations.
- Pitfalls: HIGH -- every pitfall is anchored to a verified line number or precedent decision.

**Research date:** 2026-05-27
**Valid until:** 2026-06-26 (30 days; the migration is mechanical and the renderer/type contract is locked; only the import-cascade pivot details (A1-A6) may need re-confirmation if any subsequent commit changes `execute.ts` outcome shapes).
