# Phase 20: Migration Wave 3 -- Edge Handlers & UsageError - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning. Phase 19 (Migration Wave 2 -- Plugin Orchestrator Family) landed 2026-05-27; the dependency is satisfied. All edge handler factories already accept `pi: ExtensionAPI`; `orchestrators/import/execute.ts` already takes `pi` in its `ImportClaudeSettingsOptions` (line 159). No Wave 0 plumbing plan is required (Phase 18's Wave 0 plumbing precedent does not repeat here).

<domain>
## Phase Boundary

Migrate every remaining V1 notify-wrapper call site to the V2 structured entrypoints. After this phase, no code outside `shared/notify.ts` calls `notifySuccess` / `notifyWarning` / `notifyError` or the V1 3-arg `notifyUsageError(ctx, msg, usage)` form.

**Three migration surfaces:**

1. **~30 `notifyUsageError(ctx, msg, usage)` 3-arg sites in `edge/`** -- a structurally mechanical signature swap to V2 `notifyUsageError(ctx, { message: msg, usage })`. The renderer's on-the-wire byte form (`${message}\n\n${usage}` at "error" severity) is byte-identical V1 vs V2; only the call-site signature changes. Sites span `edge/router.ts` (4), `edge/handlers/plugin/shared.ts` (3), `edge/handlers/marketplace/{add,autoupdate,list,remove,update}.ts` (1 each = 5), `edge/handlers/plugin/{install,update,list,reinstall,import,bootstrap}.ts` (3+3+3+4+2+3 = 18). Total: **30 sites across 15 files**.

2. **2 V1 `notifyError` catch-all sites in edge handlers** -- `edge/handlers/plugin/bootstrap.ts:65` and `edge/handlers/plugin/import.ts:49`. Both are defense-in-depth outer try/catch guards around orchestrator calls whose inner orchestrators already emit V2 failed-marketplace notifications on caught errors. DROPPED entirely per D-20-03 (the underlying try/catch is removed; truly catastrophic uncaught throws bubble to Pi runtime).

3. **`orchestrators/import/execute.ts` cascade migration** -- the last orchestrator with V1 callers and the last consumer of `presentation/cascade-summary.ts`. Two V1 emission sites:
   - line 1001 `notifyError(opts.ctx, "Import failed: ...", err)` (catastrophic-error path inside `importClaudeSettings`'s own try/catch).
   - line 1018 `dispatch(opts.ctx, finalBody)` where `dispatch = severity === "warning" ? notifyWarning : notifySuccess` over `composeImportSummary` output.

   Both migrate to a single `notify(opts.ctx, opts.pi, NotificationMessage)` call per dispatch. `composeImportSummary` (private helper in execute.ts) is RETIRED entirely per D-20-02 (strict D-19-02 mirror -- inline construction). `formatClaudeImportSummary` (exported test helper that wraps `composeImportSummary`) is also retired; tests migrate to byte-exact assertions through real `notify()` per D-19-07 inheritance. After Phase 20, `presentation/cascade-summary.ts` has zero importers; Phase 21 deletes it.

**Plus lint narrowing:** `eslint.config.js` MSG-Block 1 `ignores` extended with `orchestrators/import/**` (the last orchestrator family). MSG-Block 1b's `edge/handlers/**` files entry STAYS (per the IN-06 in-file rationale -- MSG-GR-3 project-first iteration discipline is V1-wrapper-independent and continues to gate `["user", "project"]` literal drift in edge handlers). MSG-Block 2 (`msg-sr-7-usage-error-routing` + `msg-nc-2`) STAYS as-is -- it gates argv-validation routing through `notifyUsageError`, which is orthogonal to the 3-arg → 1-arg signature change. Blocks 3-6 untouched. Phase 21 deletes the entire MSG-* plugin wiring.

**In scope (this phase):**

1. Mechanical `notifyUsageError` signature sweep: `(ctx, msg, usage)` → `(ctx, { message: msg, usage })` across all 30 sites in 15 files + their tests (Plan 20-01).
2. Cascade migration of `orchestrators/import/execute.ts`: retire `composeImportSummary`, retire `formatClaudeImportSummary`, inline V2 `NotificationMessage` construction in `executeImport`'s final dispatch + the line-1001 catastrophic-error path; drop the V1 dispatch ternary and `composeImportSummary` import from `presentation/cascade-summary.ts` (Plan 20-02).
3. DROP the 2 V1 `notifyError` catch-all sites in `edge/handlers/plugin/bootstrap.ts:65` and `edge/handlers/plugin/import.ts:49` plus their enclosing try/catch blocks (Plan 20-03).
4. Update each touched file's unit tests in lockstep with its migration (byte-exact V2 assertions per D-19-07 inheritance).
5. Drop now-orphaned `presentation/cascade-summary` import from `orchestrators/import/execute.ts`. After Plan 20-02 lands, `presentation/cascade-summary.ts` has zero importers (Phase 21 deletes the file).
6. Narrow MSG-Block 1 in `eslint.config.js` to additionally exclude `orchestrators/import/**` (Plan 20-04, additive ignores per D-18-07 / D-19-08 inheritance).
7. Verify catalog UAT (`tests/architecture/catalog-uat.test.ts`) byte-equality stays GREEN for every `/claude:plugin import` fixture (4 states already shipped by Phase 17: `fresh-mixed-both-scopes`, `scope-project-narrow`, `soft-dep-markers`, `same-mp-both-scopes`) and every other affected surface.
8. Verify `npm run check` GREEN.

**Out of scope (not Phase 20):**

- **Deleting V1 wrappers (`notifySuccess` / `notifyWarning` / `notifyError` / V1 3-arg `notifyUsageError`)** -- Phase 21 (SNM-22).
- **Deleting the 34-rule MSG-* lint plugin under `tests/lint-rules/`** -- Phase 21 (SNM-24, SNM-25, SNM-27).
- **Deleting V1 `presentation/*` composers** (including `cascade-summary.ts` after Phase 20 strands it) -- Phase 21 alongside SNM-22 wrapper deletion.
- **Touching `tests/presentation/*.test.ts`** -- Phase 21 deletes them with the composers they cover.
- **Removing the bounded `shared/notify.ts` ignores added by Phase 16 to MSG-Block 4a + 5** -- Phase 21 alongside V1 wrapper deletion.
- **Type-model amendments to support a top-level cause-bearing failure shape** -- explicitly REJECTED. The V2 type model has no `cause?: Error` on `MarketplaceNotificationMessage` and Phase 20 does NOT amend it. The 2 V1 `notifyError` catch-all sites are DROPPED entirely (D-20-03) rather than fabricated into a synthetic V2 payload.
- **Per-command usage-error fixtures in `docs/output-catalog.md`** -- explicitly REJECTED per D-20-04. The single generic `<!-- catalog-state: usage-error -->` fixture stays as the structural shape gate; per-callsite content is gated by handler unit tests.
- **Narrowing MSG-Block 1b's `edge/handlers/**` files entry** -- explicitly RETAINED per the IN-06 in-file rationale. MSG-GR-3 iteration discipline is V1-wrapper-independent and continues to gate user-first iteration drift in edge handlers (precedent: `edge/handlers/plugin/import.ts:45` historical `["user", "project"]` literal).
- **Migrating `edge/args-schema.ts`** -- the local `notifyError: (message: string) => void` callback parameter is internal closure-passing, NOT a `shared/notify.ts` wrapper import. Out of scope.

</domain>

<decisions>
## Implementation Decisions

### Plan granularity & wave structure (4 plans, 3 waves)

- **D-20-01:** Phase 20 ships **4 plans** across **3 waves** -- the mechanical-sweep approach diverges from Phases 18 and 19's per-file pattern because 11 of the 13 edge handler files contain only a 1-line signature change (`(ctx, msg, usage)` → `(ctx, { message: msg, usage })`). Per-file scoping would create ~13 plans of 1-line diffs each, which is overkill. The grouped-by-pattern structure keeps the mechanical change in one reviewable diff while isolating the substantive work (`import/execute.ts` cascade + 2 V1 `notifyError` drops + lint) into separate atomic plans.

  **Plan structure:**

  - **Wave 1 (mechanical sweep, low risk):**
    - **Plan 20-01:** `notifyUsageError` signature sweep across all 30 sites in 15 files: `edge/router.ts` (4 sites), `edge/handlers/plugin/shared.ts` (3 sites), `edge/handlers/marketplace/{add,autoupdate,list,remove,update}.ts` (5 sites), `edge/handlers/plugin/{install,update,list,reinstall,import,bootstrap}.ts` (18 sites). Each site migrates `notifyUsageError(ctx, msg, usage)` → `notifyUsageError(ctx, { message: msg, usage })`. Update every matching `tests/edge/**/*.test.ts` file in lockstep with byte-exact V2 assertions through real `notify()` per D-19-07. No drops or surface changes -- pure mechanical signature swap. Atomic single commit.

  - **Wave 2 (substantive migrations, parallel-safe):**
    - **Plan 20-02:** `orchestrators/import/execute.ts` cascade migration. RETIRE `composeImportSummary` entirely (inline construction per D-20-02 / D-19-02 strict mirror); RETIRE `formatClaudeImportSummary` (exported test helper that wraps `composeImportSummary`) and migrate its consumers to byte-exact assertions through real `notify()` per D-19-07. Replace the V1 dispatch ternary at line 1018 with a single `notify(opts.ctx, opts.pi, NotificationMessage)` call constructing `marketplaces[]` inline from the pivoted outcome arrays. Replace the line-1001 catastrophic-error `notifyError(opts.ctx, "Import failed: ...", err)` with a V2 emission whose shape the planner determines from the catalog (`/claude:plugin import` section is locked to 4 states; a "catastrophic-import-failure" shape is NOT in the catalog, mirroring D-18-02 bare-failed-header precedent if needed). Drop `presentation/cascade-summary` import from `execute.ts`. Update `tests/orchestrators/import/*.test.ts` in lockstep.
    - **Plan 20-03:** DROP the 2 V1 `notifyError` catch-all sites in `edge/handlers/plugin/bootstrap.ts:65` and `edge/handlers/plugin/import.ts:49` per D-20-03. The full enclosing try/catch blocks are removed (not the orchestrator call itself); truly catastrophic uncaught throws bubble to Pi runtime. Update `tests/edge/handlers/plugin/bootstrap.test.ts` and any matching test for `edge/handlers/plugin/import.ts` to delete or refactor the assertions that previously expected a `notifyError` emission for unexpected-throw scenarios.

  - **Wave 3 (lint narrowing + final gate):**
    - **Plan 20-04:** Narrow MSG-Block 1 in `eslint.config.js` -- add `"extensions/pi-claude-marketplace/orchestrators/import/**"` to the existing additive `ignores: [...]` array (which already lists `orchestrators/marketplace/**` and `orchestrators/plugin/**`). MSG-Block 1b's `files: [..., "edge/handlers/**/*.ts"]` STAYS unchanged (per IN-06 rationale; MSG-GR-3 iteration discipline is independent of V1 wrapper migration). MSG-Block 2 stays untouched (orthogonal to signature change). Run final `npm run check` and catalog UAT GREEN verification. Atomic single commit.

- **D-20-05:** Wave 2 (Plans 20-02 + 20-03) is parallel-safe because each plan touches disjoint file pairs: Plan 20-02 mutates `orchestrators/import/execute.ts` + its tests + (possibly) related re-exports; Plan 20-03 mutates `edge/handlers/plugin/bootstrap.ts` + `edge/handlers/plugin/import.ts` + their tests. Plan 20-03 has a soft dependency on Plan 20-01 only in that Plan 20-01 may touch the same two edge handler files for the *usage-error* sites within them -- but the *catch-all* `notifyError` sites are at distinct lines (bootstrap.ts:65, import.ts:49) versus the usage-error sites (bootstrap.ts:38/43/49, import.ts:31/36). Wave gating is sufficient to serialize: Plan 20-01 lands in Wave 1, Plan 20-03 follows in Wave 2 after rebase. Wave 3 (Plan 20-04) cannot start until all of Wave 1 and Wave 2 land -- the lint narrowing assumes every V1 caller in `orchestrators/import/**` has been removed.

  **No pilot/recipe block-comment needed.** Phase 18 and Phase 19's pilot-first + recipe-block-comment discipline existed because each Wave 2 plan literally mirrored the pilot's cascade-construction recipe across plugin/marketplace orchestrator families. Phase 20 has NO such mirrored work: Plan 20-01 is a mechanical regex-style sweep; Plan 20-02 is a one-of-a-kind cascade migration with a unique pivot; Plan 20-03 is a pure deletion. No recipe to mirror, no pilot necessary.

### import/execute.ts cascade migration (RETIRE composeImportSummary inline)

- **D-20-02:** `composeImportSummary` (private helper inside `orchestrators/import/execute.ts`, lines 366-432-ish) is RETIRED entirely per D-19-02 strict mirror. The pivot-by-marketplace + outcome → `PluginNotificationMessage` variant mapping is inlined directly into `executeImport`. Two consumers migrate:

  - **Final dispatch (line 1018):** the existing `composeImportSummary(result, probe)` → `{ body, severity }` → `dispatch(opts.ctx, finalBody)` flow is replaced by inline construction of `NotificationMessage { marketplaces: readonly MarketplaceNotificationMessage[] }` followed by a single `notify(opts.ctx, opts.pi, message)` call. Severity is computed by `notify()` (D-16-11); reload-hint is computed by `notify()` (D-16-12). The orchestrator only pivots outcomes into the typed payload tree.

  - **`formatClaudeImportSummary` export (lines ~350-360):** this exported test helper (`formatClaudeImportSummary(result, probe?): string`) currently wraps `composeImportSummary` + `reloadHint` + `appendReloadHint` to produce a V1 body string for test assertions. It is RETIRED in the same plan; its consumers migrate to byte-exact assertions through real `notify()` via mock `ctx` per D-19-07 inheritance. The re-export in `orchestrators/import/index.ts:2` is also deleted. (Audit grep before deletion: `grep -rn "formatClaudeImportSummary" --include="*.ts" extensions/ tests/`.)

  **Inlining shape (Claude's discretion within these rails):**

  - One `marketplaces[]` entry per affected (marketplace × scope) tuple in display order (sorted via `compareByNameThenScope` -- name primary case-insensitive, scope secondary project-before-user per MSG-GR-3 / D-19-08 precedent).
  - `MarketplaceStatus` per block: `added` for `MarketplaceAddedOutcome`; `updated` for `MarketplaceSkipOutcome` (a "no-op accepted" partition that is part of v2 `updated` semantics); `failed` for `MarketplaceFailureOutcome` and `SourceMismatchOutcome`; `undefined` is NOT used here (every import block carries a state-change status). The catalog (`docs/output-catalog.md:572-654`) is the binding shape -- 4 states already locked: `fresh-mixed-both-scopes`, `scope-project-narrow`, `soft-dep-markers`, `same-mp-both-scopes`.
  - `plugins: readonly PluginNotificationMessage[]` built in display order from the per-marketplace partition of `PluginInstalledOutcome`, `PluginSkipOutcome`, `UnexpectedPluginFailureOutcome`. Each outcome maps to its discriminated variant: `installed` → `PluginInstalledMessage` (with `dependencies: readonly Dependency[]` per SNM-06); `skipped` → `PluginSkippedMessage` (with `reasons: readonly Reason[]`); unexpected failure → `PluginFailedMessage` (with `reasons` + `cause?: Error`).
  - **`ImportWarningOutcome`** (general per-marketplace warnings not tied to a plugin) -- planner verifies during research whether these map to a marketplace-level `reasons?:` (added in Phase 17.1) or are surfaced via a synthesized `PluginNotificationMessage` row, or are DROPPED entirely per D-19-01 / D-18-01 precedent if no V2 representation. Catalog has no `ImportWarningOutcome` fixture; the planner makes the call based on per-instance criticality.
  - **Orphan diagnostic lines** (settings-read-error etc., from `orphanDiagnosticLines(result)`) -- planner verifies whether these are surfaced as top-level marketplace-level reasons, as separate marketplace blocks with synthesized names (likely unattractive), or DROPPED entirely. Mirrors the same per-instance-criticality call.
  - **`SourceMismatchOutcome` diagnostic splicing** (currently `spliceSourceMismatchDiagnostics` in `composeImportSummary`) -- the diagnostic line currently splices beneath the failing marketplace header. In V2, this maps to either marketplace-level `reasons?:` OR per-plugin `PluginFailedMessage.cause` if the diagnostic ties to a plugin. Planner picks the shape that round-trips cleanly through `notify()` and matches the existing catalog fixtures.

  **Line-1001 catastrophic-error path:** the existing `notifyError(opts.ctx, "Import failed: ...", err)` inside `importClaudeSettings`'s outer try/catch fires only if `result.diagnostics.push(...)` or the per-scope plan executor itself throws. The V2 shape options the planner has:

  - DROP entirely (consistent with D-20-03 catch-all precedent if the inner orchestrator infrastructure already covers all expected failures). This is the recommended default unless research surfaces a code path where the outer catch is the SOLE error surface.
  - Synthesize a top-level structural failure (e.g., `notify(opts.ctx, opts.pi, { marketplaces: [] })` rendering `(no marketplaces)`) -- misleading; rejected.
  - Synthesize a bare-failed marketplace placeholder with a fabricated name -- semantically awkward; rejected.

  Planner determines during research; if DROP is chosen, the outer try/catch in `importClaudeSettings` is REMOVED along with the line-1001 emission. The defense-in-depth principle (orchestrator boundary catches its own exceptions) is preserved by the inner `executeScopedPlan(opts, result, scopePlan)` per-scope try/catch contract; truly catastrophic throws bubble to Pi runtime.

### 2 V1 notifyError catch-all sites in edge handlers (DROP both)

- **D-20-03:** Both V1 `notifyError` catch-all sites in edge handlers are DROPPED entirely along with their enclosing try/catch blocks:

  - **`edge/handlers/plugin/bootstrap.ts:65`** -- the `catch (err) { notifyError(ctx, errorMessage(err), err); }` block around `bootstrapClaudePlugin({...})`. `bootstrapClaudePlugin` calls `addMarketplace` + `setMarketplaceAutoupdate`; both are post-Phase-18 V2 with their own internal try/catch + V2 failed-marketplace emission per D-18-02. The outer guard is defense-in-depth that fires only if the inner orchestrators THROW unexpectedly (a bug, not normal operation).

  - **`edge/handlers/plugin/import.ts:49`** -- the `catch (err) { notifyError(ctx, "Import encountered an unexpected error: ...", err); }` block around `importClaudeSettings({...})`. `importClaudeSettings` has its own outer try/catch at `execute.ts:994-1002`; the edge handler's catch fires only if that inner catch itself THROWS or if `importClaudeSettings`'s argument-collection (`parsed.scope` access, etc.) throws -- both indicate real bugs.

  **Behavior change:** Pi runtime's outer error boundary now handles truly catastrophic uncaught throws from these two handlers. The user sees an uncaught-exception trace instead of a polished error message in the (rare) defense-in-depth-needed case. This is BETTER for debugging because the trace shows where the bug actually lives. Test consequence: any test that previously asserted a `notifyError` emission for an unexpected-throw scenario is DELETED outright (per D-19-01 precedent for tests targeting dropped surfaces).

  **Rejected alternatives (recorded for completeness):**

  - **Bare failed-marketplace V2 payload:** `notify(ctx, pi, { marketplaces: [{ name: "claude-plugins-official", scope: "user", status: "failed", plugins: [] }] })` for bootstrap. Rejected because (a) the V2 type model has no `cause?: Error` on `MarketplaceNotificationMessage`, so the actual cause is lost; (b) the inner orchestrators ALREADY emit this exact failed-marketplace shape on their own caught errors; (c) reaches the outer catch only on truly unexpected throws where a polished "(failed)" output masks a real bug.
  - **Synthetic failed plugin row:** fabricating `PluginFailedMessage { name: "<bootstrap>", reasons: [...], cause: err }`. Rejected because (a) "bootstrap" is not in the closed `REASONS` set; (b) inventing a plugin name for a marketplace-level error misrepresents the V2 type model's semantics; (c) requires either a Phase 15 type amendment or a `REASONS` enum amendment, both rejected per Phase 19 precedent.
  - **Asymmetric DROP-one-KEEP-one:** dropping `import.ts:49` only (since `importClaudeSettings` has its own catch) and keeping `bootstrap.ts:65` (since `bootstrapClaudePlugin` doesn't emit notifications itself -- its sub-orchestrators do). Rejected because (a) inner sub-orchestrators DO emit V2 failed-marketplace notifications on their own caught errors, making bootstrap's outer catch defense-in-depth in the same sense as import's; (b) symmetric design is simpler and more consistent.

### Catalog coverage for usage errors (stay generic)

- **D-20-04:** `docs/output-catalog.md` §"Usage errors" remains at the single generic `<!-- catalog-state: usage-error -->` fixture. NO per-command usage-error fixtures are added in Phase 20. Justification:

  - The renderer's on-the-wire byte form (`${message}\n\n${usage}` at "error" severity) is byte-identical between V1 3-arg and V2 1-arg overloads (verified by reading `shared/notify.ts:127-156`). The V2 migration is a pure SIGNATURE change at call sites, not a grammar change.
  - The catalog narrative at line 943 ("The exact wording is renderer-/orchestrator-specific; the catalog's expected output mirrors the structural shape (message block, blank line, usage block).") explicitly disclaims per-callsite enumeration. The catalog gates STRUCTURAL SHAPE; handler unit tests gate per-callsite CONTENT.
  - Adding per-command fixtures (~15 new blocks for 13 handlers + 2 router fallbacks) would introduce a new convention for v1.4 not established elsewhere -- the messaging style guide and ADR both treat usage errors as structurally fixed and content-renderer-specific.
  - Phase 20 ROADMAP SC #4 ("catalog UAT byte-equality is GREEN for every edge-handler output and every usage-error output against the v2.0 spec") is satisfied by the structural-shape interpretation: the single generic fixture gates the v2.0 structural contract; per-handler unit tests gate the per-callsite content against `notify()`'s actual emission via mock `ctx`.

### Existing test migration (inherits D-19-07)

- **D-20-06:** Each plan updates its touched files' tests in lockstep with the source migration. Tests stay END-TO-END through real `notify()` / `notifyUsageError()` via mock `ctx` -- the existing `makeCtx()` pattern that records `{ message, severity }` tuples is preserved verbatim per Phase 18/19 inheritance.

  **Specific test discipline per plan:**

  - **Plan 20-01 (usage-error sweep):** byte-exact `assert.equal(note.message, "<V1 byte string>")` assertions stay byte-identical (V1 and V2 emit the same bytes per shared/notify.ts:127-156). The migration changes signature shape at the SOURCE, not at the test assertion. Verifies invariance of the user-contract byte form across the signature change. Test count unchanged (no drops, no additions).
  - **Plan 20-02 (import/execute cascade):** byte-exact assertions rewritten from V1 strings constructed by `composeImportSummary` / `formatClaudeImportSummary` to V2 strings constructed by `notify()` from a `NotificationMessage` payload. Catalog `/claude:plugin import` fixtures at `docs/output-catalog.md:572-654` are the reference shapes. Any test that asserted on `formatClaudeImportSummary` return value flips to assert on `note.message` via `makeCtx()` recording. Tests that targeted V1-only surfaces with no V2 representation (e.g., `ImportWarningOutcome` drop path per D-19-01 precedent if planner picks DROP) are DELETED outright.
  - **Plan 20-03 (DROP catch-alls):** tests that assert a `notifyError` emission for unexpected-throw scenarios in `bootstrap.ts` / `edge/handlers/plugin/import.ts` are DELETED per D-19-01 precedent. Tests for the HAPPY path through the orchestrators are unchanged.
  - **Plan 20-04 (lint narrowing):** no test changes; the plan only edits `eslint.config.js`. The atomic commit includes the final `npm run check` GREEN verification.

### MSG-* lint glob narrowing strategy (inherits D-19-08, with IN-06 caveat)

- **D-20-07:** Plan 20-04 narrows ONLY MSG-Block 1 (`msg-sr-1..6` severity routing) in `eslint.config.js`. The existing additive `ignores: [...]` array under Block 1 currently reads `["...orchestrators/marketplace/**", "...orchestrators/plugin/**"]`; Plan 20-04 ADDS `"extensions/pi-claude-marketplace/orchestrators/import/**"` so the array covers all 3 orchestrator families. After Phase 20, Block 1's `files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"]` matches files entirely covered by ignores -- effectively a no-op (Phase 21 deletes the block entirely as part of SNM-24/25/27).

  **MSG-Block 1b STAYS unchanged.** Per the IN-06 in-file rationale at `eslint.config.js:190-198` (added by Phase 19's Plan 19-06), MSG-GR-3 per-scope iteration discipline is V1-wrapper-independent: it gates user-first iteration drift (`["user", "project"]` literals) and local user-first `scopeOrder` helpers, which can be introduced by ANY orchestrator or edge handler regardless of whether the file uses V1 or V2 notify wrappers. Block 1b's `files: [..., "edge/handlers/**/*.ts"]` entry continues to gate the historical `edge/handlers/plugin/import.ts:45` user-first literal regression (Phase 14.2 CR-01 precedent). The Phase 19 deferred prediction that Phase 20 would "remove Block 1b's `edge/handlers/**` files entry" was OUTDATED relative to IN-06 and is explicitly REJECTED here.

  **MSG-Block 2 STAYS unchanged.** `msg-sr-7-usage-error-routing` enforces that argv-validation errors route through `notifyUsageError` (not `notifyError`). The signature change from 3-arg to 1-arg is orthogonal to routing detection; the rule's AST check is on the callee identifier (`notifyUsageError` vs `notifyError`), not the argument count. Block 2's `files: ["...edge/handlers/**/*.ts"]` continues to gate routing discipline.

  **Blocks 3-6 STAY unchanged.** All other MSG-Blocks are global with composer-specific ignores and detect raw string literals at any callsite. Phase 20's migrations construct `UsageErrorMessage` payloads structurally with no raw token/marker/trailer literals (`notify()` and `notifyUsageError()` own ALL render-time string composition per D-16-04 + SNM-17). No glob narrowing required.

### Claude's Discretion

The planner has flexibility on:

- Exact ordering of file mutations within Plan 20-01 (e.g., alphabetical, by-file-size, by-test-coverage-priority). Atomic single-commit either way.
- Whether to extract a tiny helper for `{ message, usage }` construction inside individual call sites (e.g., `usageError(message: string, usage: string) => UsageErrorMessage`). Per D-19-07 inheritance, inline construction is acceptable; extraction is also acceptable if the planner sees a cleanliness benefit. Inlining is recommended (matches the structural-payload-at-callsite discipline of Phases 18/19).
- Whether the line-1001 catastrophic-error path in `executeImport` is DROPPED entirely (recommended default per the D-20-03 catch-all precedent extended to inner orchestrator boundaries) or KEPT as a bare-failed-marketplace emission (the catalog has no shape for "catastrophic import failure" -- the planner picks DROP unless research surfaces a code path where the outer catch is genuinely the SOLE error surface).
- Whether `ImportWarningOutcome` general per-marketplace warnings map to marketplace-level `reasons?:` (Phase 17.1 surface), to synthesized plugin rows, or are DROPPED entirely per D-19-01 / D-18-01 precedent. Per-instance criticality determines; planner reads `enumerateMarketplaceBlocks` semantics during research.
- Whether `SourceMismatchOutcome` diagnostic-splicing in V2 maps to marketplace-level `reasons?:` OR per-plugin `PluginFailedMessage.cause` if the diagnostic ties to a plugin. Planner picks the shape that round-trips cleanly through `notify()` and matches existing catalog fixtures.
- Whether `orphanDiagnosticLines` (settings-read-error etc.) surface as top-level marketplace-level reasons (likely unattractive -- there is no top-level reasons field), as a synthesized marketplace block with a fabricated name (likely unattractive), or are DROPPED entirely per D-19-01 precedent. Planner makes the call based on per-instance criticality.
- Whether `parseCommandArgs` callback parameter signature in `edge/args-schema.ts` (`notifyError: (message: string) => void`) changes shape. The callback is internal closure-passing (NOT a `shared/notify.ts` wrapper import), so it's technically out of scope for the V1 → V2 migration. Cleanup of the parameter name (e.g., to `onError`) is cosmetic and at planner discretion within Plan 20-01 or deferred to Phase 21.
- Specific severity-tier assertion form in tests: `assert.equal(note.severity, "error")` (status quo for usage errors) vs. helper like `assertSeverity(note, "error")`. Either acceptable per Phase 19 precedent.
- Whether `presentation/cascade-summary.ts` is touched at all in Phase 20 (recommended: NO -- the file stays alive in-tree until Phase 21 deletes it; Plan 20-02 only drops the IMPORT from `orchestrators/import/execute.ts`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source-of-truth design

- `.planning/ROADMAP.md` §"Phase 20: Migration Wave 3 -- Edge Handlers & UsageError" -- Goal + 5 success criteria. SC #1 (zero V1 callers in `edge/handlers/**`) is satisfied by Plans 20-01 + 20-03; SC #2 (~13 → 30 actual `notifyUsageError` 3-arg sites migrated; V1 signature has no remaining callers) is satisfied by Plan 20-01 sweep; SC #3 (MSG-* lint plugin files: globs cover no remaining source files; effectively no-op) is satisfied by Plan 20-04; SC #4 (catalog UAT byte-equality GREEN for every edge-handler output and every usage-error output against v2.0 spec) is satisfied by Plan 20-04's final verification step driving the 4 `/claude:plugin import` fixtures + the generic `usage-error` fixture through real `notify()`; SC #5 (`npm run check` GREEN) is the gate Plan 20-04 verifies.
- `.planning/REQUIREMENTS.md` §"Migration & Deletion" SNM-23 -- "All `notifyUsageError(ctx, msg, usage)` call sites across edge handlers (~13 sites) migrated to the V2 `notifyUsageError(ctx, structuredUsageError)`. The V1 three-argument signature is deleted." Phase 20 satisfies the MIGRATION half (the actual count is ~30 not ~13 -- the original estimate was outdated); DELETION happens in Phase 21 (SNM-22). Phase 20 closes SNM-23's migration half; Phase 21 closes the deletion half via SNM-22.
- `docs/output-catalog.md` -- Phase 17 v2.0 catalog. BINDING USER CONTRACT for every affected surface. Sections to honor:
  - `## /claude:plugin import` (lines 572-654) -- 4 catalog states (`fresh-mixed-both-scopes`, `scope-project-narrow`, `soft-dep-markers`, `same-mp-both-scopes`) gate Plan 20-02.
  - `## /claude:plugin bootstrap` (lines 656-684) -- 2 catalog states (`fresh`, `already-bootstrapped`) gate the happy-path through bootstrap.ts; Plan 20-03's DROP of the catch-all does NOT touch these.
  - `## Usage errors` (lines 933-948) -- 1 generic `usage-error` fixture; structural shape gate for Plan 20-01.
- `docs/messaging-style-guide.md` -- Phase 17 v2.0 pointer doc. Cross-reference for renderer-as-spec discipline; types are the contract.
- `docs/adr/v2-001-structured-notify.md` -- Accepted (Phase 15 D-15-13). Phase 17.1 amendment captured the autoupdate grammar change; no further amendments in Phase 20.

### V2 renderer & types (binding contract)

- `extensions/pi-claude-marketplace/shared/notify.ts` -- The v2 grammar IS this file's renderer behavior.
  - `notify(ctx, pi, message)` at line 1034 -- the binding entry point for structured notifications.
  - `notifyUsageError(ctx, message: UsageErrorMessage)` at line 129 (V2 overload) -- the V2 entry point for argv-validation errors. The dual-overload signature at lines 127-129 means both V1 3-arg and V2 1-arg forms compile through the migration window; Phase 21 deletes the V1 overload (line 127) per SNM-22.
  - `UsageErrorMessage` interface at line 290 -- `{ readonly message: string; readonly usage: string; }`. Both fields REQUIRED.
  - `PluginNotificationMessage` per-variant interfaces at lines 325-459 (consumed by Plan 20-02 cascade construction).
  - `MarketplaceNotificationMessage` shape (consumed by Plan 20-02). Note: NO `cause?: Error` field -- this is the precedent for D-20-03 DROP of catch-all sites (no top-level cause-bearing failure shape exists in V2).
  - `renderMpHeader` (file-private) at line 529 -- 7-arm switch (post-Phase-17.1) with `assertNever` exhaustiveness.
  - `renderPluginRow` (file-private) -- 10-arm switch.
  - `softDepStatus(pi)` -- single probe per `notify()` invocation (D-16-14). Plan 20-02 inherits this.
  - NOT modified by Phase 20 -- this phase only IMPORTS from it.
- `tests/shared/notify-v2.test.ts` -- Phase 16 per-variant unit tests + Phase 17.1 amendment tests + Phase 17.2 orphan-fold tests (1141+ lines, 32+ tests). Authoritative source of V2 expected output strings per (plugin status × marketplace status × edge case). Plan 20-02 orchestrator tests cross-reference these fixtures when an edge-case byte shape isn't covered by the catalog.
- `tests/architecture/catalog-uat.test.ts` -- Phase 17 byte-equality runner. Drives every `(section, state)` catalog fixture through `notify(mockCtx, mockPi, message)` and asserts byte-equality against the catalog block. Plan 20-04 verifies this stays GREEN end-to-end after every V1 caller in `orchestrators/import/**` has migrated. Fixture map keys for `/claude:plugin import` already shipped in Phase 17.

### Phase 18 + 19 lineage (controlling migration decisions inherited)

- `.planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-CONTEXT.md` -- Decisions D-19-01..D-19-08. D-19-01 (DROP V1 surfaces with no V2 representation -- inherited by D-20-03); D-19-02 (inline cascade construction; cascadeSummary retired entirely from migrated callers -- the strict mirror inherited by D-20-02); D-19-07 (test discipline -- byte-exact end-to-end through real notify() -- inherited by D-20-06); D-19-08 (additive MSG-* lint narrowing -- inherited by D-20-07 with the IN-06 caveat).
- `.planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-CONTEXT.md` -- Decisions D-18-01..D-18-09. D-18-01 (DROP precedent for post-success warnings -- extended by D-20-03 to defense-in-depth catch-alls with V2 representation upstream); D-18-02 (bare-failed-marketplace shape with no cause-chain for mp-level failures -- inherited as the precedent for the Plan 20-02 line-1001 path if the planner picks the KEEP option); D-18-06 (byte-exact end-to-end tests -- inherited by D-20-06); D-18-07 (additive MSG-* lint narrowing -- inherited by D-20-07).
- `.planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-06-SUMMARY.md` -- IN-06 in-file documentation precedent. Plan 19-06 added the in-file rationale to MSG-Block 1b explaining why `orchestrators/plugin/**` is NOT ignored even though the V1 wrapper migration completed. D-20-07 inherits this rationale for `edge/handlers/**`.

### Phase 17 / 17.1 / 17.2 lineage (catalog + grammar contract)

- `.planning/phases/17-spec-rewrite-catalog-uat-migration/17-CONTEXT.md` -- D-17-09 (V1 free-text retry-anchor dropped -- precedent for D-20-03 catch-all drops); D-17-10 (V1 install-failure-with-anchor dropped from V2 catalog -- precedent for D-20-04 generic usage-error fixture).
- `.planning/phases/17.1-v2-grammar-amendment-autoupdate-surface/` -- 7-entry MarketplaceStatus + optional `reasons?: readonly Reason[]` on `MarketplaceNotificationMessage`. Plan 20-02 may use marketplace-level `reasons?:` for `ImportWarningOutcome` per planner discretion.
- `.planning/phases/17.2-renderscope-bracket-orphan-fold-contract-fix/` -- Plan 20-02 import-cascade tests must construct payloads that round-trip through the orphan-folded renderer (plugin-scope bracket suppressed when `p.scope === mp.scope`).

### Phase 16 / 15 lineage (renderer & type-model decisions)

- `.planning/phases/16-renderer-public-api-alongside-v1/16-CONTEXT.md` -- D-16-04 (renderer-as-spec); D-16-06 (caller-order honored -- orchestrators control iteration order); D-16-08 (4-space indent for cause-chain under plugin row); D-16-11 (severity ladder -- failed/skipped/manual recovery routing); D-16-12 (reload-hint trigger ladder); D-16-14 (single softDepStatus probe per notify call); D-16-15 (soft-dep markers at render time).
- `.planning/phases/15-type-model-adr-refresh/15-CONTEXT.md` -- D-15-02 (`dependencies` on installed/updated/reinstalled variants); D-15-04 (`from`/`to` on updated variant only); SNM-08 (`UsageErrorMessage` shape -- REQUIRED `message` + `usage` fields, no `cause`, no `severity`).

### Source files Phase 20 modifies

**Plan 20-01 (usage-error sweep -- 30 sites in 15 files + tests):**

- `extensions/pi-claude-marketplace/edge/router.ts` -- 4 sites at lines 125, 148, 161, 181.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` -- 3 sites at lines 58, 85, 95.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts` -- 1 site at line 43.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts` -- 1 site at line 38.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts` -- 1 site at line 36.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts` -- 1 site at line 36.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts` -- 1 site at line 40.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` -- 3 sites at lines 52, 65, 75.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` -- 3 sites at lines 36, 48, 61.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` -- 3 sites at lines 40, 57, 65.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` -- 4 sites at lines 34, 44, 52, 86.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` -- 2 sites at lines 31, 36.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` -- 3 sites at lines 38, 43, 49.
- `tests/edge/router.test.ts`, `tests/edge/handlers/marketplace/*.test.ts`, `tests/edge/handlers/plugin/*.test.ts` -- byte-exact assertions stay byte-identical (V1 ≡ V2 byte shape).

**Plan 20-02 (import/execute cascade migration):**

- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` -- 2 V1 callsites + composeImportSummary retirement.
  - Drop `import { cascadeSummary } from "../../presentation/cascade-summary.ts";` (line 11).
  - Drop `import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";` (line 15) and replace with `import { notify } from "../../shared/notify.ts";`.
  - Replace line-1001 catastrophic-error emission (planner picks DROP per D-20-02 default unless research surfaces sole-error-surface reasoning).
  - Replace line-1018 dispatch ternary with single `notify(opts.ctx, opts.pi, message)` call.
  - Retire `composeImportSummary` (private helper, lines 366-432-ish).
  - Retire `formatClaudeImportSummary` (exported test helper, lines ~350-360).
- `extensions/pi-claude-marketplace/orchestrators/import/index.ts:2` -- drop the `formatClaudeImportSummary` re-export.
- `tests/orchestrators/import/*.test.ts` -- byte-exact assertions rewritten from V1 `formatClaudeImportSummary`-based strings to V2 `notify()`-emitted bytes via `makeCtx()`.

**Plan 20-03 (DROP catch-alls):**

- `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` -- drop lines 64-66 (the `try { await bootstrapClaudePlugin({...}); } catch (err) { notifyError(...); }` outer wrapper; KEEP the inner orchestrator call directly). Drop the `notifyError` import. Note that `notifyUsageError` import remains in use after Plan 20-01 lands.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` -- drop lines 47-50 (the `try { await ...importClaudeSettings(...) } catch (err) { notifyError(...); }` outer wrapper; KEEP the inner orchestrator call directly). Drop the `notifyError` import. `notifyUsageError` import remains.
- `tests/edge/handlers/plugin/bootstrap.test.ts` -- delete or refactor any test that asserted a `notifyError` emission for an unexpected-throw scenario.
- `tests/edge/handlers/plugin/import.test.ts` (if it exists) -- same.

**Plan 20-04 (lint narrowing):**

- `eslint.config.js` -- ADD `"extensions/pi-claude-marketplace/orchestrators/import/**"` to MSG-Block 1's `ignores: [...]` array (lines 159-163). MSG-Block 1b unchanged (per IN-06 / D-20-07). MSG-Block 2 unchanged. Blocks 3-6 unchanged.

### Source files Phase 20 reads but does NOT modify

- `extensions/pi-claude-marketplace/shared/notify.ts` -- V2 renderer + types. Phase 20 only IMPORTS `notify`, `notifyUsageError`, `NotificationMessage`, `MarketplaceNotificationMessage`, `PluginNotificationMessage`, `UsageErrorMessage` (and the per-variant types `PluginInstalledMessage` etc. as needed for type narrowing in Plan 20-02).
- `extensions/pi-claude-marketplace/presentation/cascade-summary.ts` -- V1 cascade composer. STAYS alive in-tree until Phase 21 deletes it. Plan 20-02 only DROPS the IMPORT from `orchestrators/import/execute.ts`. After Plan 20-02 lands, `cascade-summary.ts` has zero importers (verified by `grep -rn "cascade-summary\|cascadeSummary" extensions/`).
- `extensions/pi-claude-marketplace/presentation/{rollback-partial,manual-recovery,cause-chain,version-arrow,compact-line,reload-hint,sort}.ts` -- V1 composers. Phase 19 already orphaned `cause-chain`, `manual-recovery`, `rollback-partial`, `version-arrow`. After Phase 20, `cascade-summary.ts` joins them. `compact-line`, `reload-hint`, `sort` may still have non-deleted internal consumers (planner verifies during research). Phase 21 deletes all orphaned composers.
- `tests/presentation/*.test.ts` -- STAYS untouched (composer tests remain valid until Phase 21 deletes the composers).
- `tests/architecture/catalog-uat.test.ts` -- Plan 20-04 only READS this file to verify GREEN status; the test runner itself is not modified.
- `extensions/pi-claude-marketplace/edge/args-schema.ts` -- The local `notifyError: (message: string) => void` callback parameter is an internal closure-passing signature, NOT a `shared/notify.ts` wrapper import. Out of scope for Phase 20. Cleanup at planner discretion (cosmetic only).
- `extensions/pi-claude-marketplace/edge/register.ts` -- All handler factories already receive `pi`; no plumbing changes. Phase 20 reads to verify factory wiring; does not modify.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`tests/edge/handlers/**/*.test.ts` and `tests/edge/router.test.ts` mock-ctx pattern** -- Each file defines a local `makeCtx()` that returns `{ ctx, notifications: NotifyRecord[] }` recording `{ message, severity }` tuples. Plan 20-01 preserves this pattern verbatim per D-20-06 (inheriting D-18-06 / D-19-07); the byte-string assertion targets stay byte-identical because V1 and V2 `notifyUsageError` emit the same on-the-wire shape.
- **`tests/orchestrators/import/*.test.ts` mock-ctx pattern** -- same as above; byte-string assertion targets are REWRITTEN by Plan 20-02 from V1 `formatClaudeImportSummary`-based strings to V2 `notify()`-emitted bytes.
- **`extensions/pi-claude-marketplace/shared/notify.ts::notifyUsageError` V2 overload** -- Public V2 entry point at line 129. Signature `notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void`. The dual-overload contract guarantees byte-equal output across V1 and V2 during the migration window.
- **`extensions/pi-claude-marketplace/shared/notify.ts::notify`** -- Public V2 entry point. Plan 20-02 imports this in place of the V1 `notifySuccess` / `notifyWarning` / `notifyError`; signature is `(ctx, pi, message)`. `opts.pi` already flows through `executeImport` (verified: `ImportClaudeSettingsOptions` at line 159 carries `pi: ExtensionAPI`).
- **`tests/architecture/catalog-uat.test.ts` FIXTURES map** -- Lines covering `/claude:plugin import` already model the V2 `NotificationMessage` payload shapes Plan 20-02 must construct (`fresh-mixed-both-scopes`, `scope-project-narrow`, `soft-dep-markers`, `same-mp-both-scopes`). Effectively a reference implementation for `executeImport`'s inline construction.

### Established Patterns

- **Renderer-as-spec discipline (D-16-04 inherited)** -- The V2 grammar IS `shared/notify.ts`'s rendering behavior. Plan 20-02 MUST construct payloads such that `notify()` emits the catalog-expected bytes. No orchestrator-level string composition of tokens, markers, or trailers.
- **Single-`notify()`-call-per-orchestration discipline (D-18-01 + D-19-01 inheritance, extended by D-20-03)** -- Every state-changing orchestrator call emits EXACTLY one `notify()` call with one complete `NotificationMessage`. No SECOND notify after the primary. Defense-in-depth catch-alls in edge handlers (D-20-03) are DROPPED entirely rather than emit a second notify.
- **Caller-order honored (D-16-06 inherited)** -- `notify()` does NOT sort `marketplaces[]` or `plugins[]`. Plan 20-02 controls iteration order; the existing `compareByNameThenScope` sort in `composeImportSummary` moves into the inlined construction loop.
- **Single `softDepStatus(pi)` probe per `notify()` call (D-16-14 inherited)** -- Plan 20-02 does NOT compute soft-dep state in `executeImport`; it declares `dependencies: readonly Dependency[]` on installed/updated/reinstalled plugin rows; `notify()` probes once and threads the result through `renderPluginRow`. The existing `probe = softDepStatus(opts.pi)` line in `executeImport` is RETIRED (the work moves entirely into `notify()`).
- **Defense-in-depth catch-all DROP discipline (D-20-03 -- novel for Phase 20)** -- Outer try/catch guards in edge handlers around orchestrator calls whose inner orchestrators emit V2 failed notifications on caught errors are DROPPED entirely. Truly catastrophic uncaught throws bubble to Pi runtime. This extends D-18-01's DROP precedent from secondary post-success warnings to redundant outer guards.

### Integration Points

- **Phase 19 plugin migration (LANDED) ↔ Phase 20 finalization** -- Plugin orchestrators are V2; their internal try/catch blocks emit V2 failed notifications. This is the inner-boundary contract D-20-03 relies on when DROPPING `bootstrap.ts:65` (which composes plugin orchestrators) and `import.ts:49` (which composes `importClaudeSettings` which has its own try/catch).
- **Phase 18 marketplace migration (LANDED) ↔ Phase 20 finalization** -- Marketplace orchestrators are V2; same inner-boundary contract for `bootstrap.ts:65` (which composes `addMarketplace` + `setMarketplaceAutoupdate`).
- **Catalog UAT (Phase 17 + 17.1) ↔ Phase 20 migration** -- Catalog UAT byte-equality MUST stay GREEN across every wave. Wave 1 (Plan 20-01) is structurally invariant (V1 ≡ V2 usage-error bytes); Wave 2 (Plans 20-02 + 20-03) shifts the `/claude:plugin import` surface from V1-composed bodies to V2 `notify()`-emitted bytes that the 4 already-shipped catalog fixtures lock; Wave 3 (Plan 20-04) runs catalog UAT once more as a final safety net before lint narrowing.
- **MSG-* lint scoping (Phase 14 + Phase 16 bounded windows + Phase 18 + Phase 19 additive entries) ↔ Plan 20-04** -- Block 1 gains `orchestrators/import/**` in its `ignores: [...]` array (third orchestrator family). Block 1b stays unchanged per IN-06. Block 2 stays unchanged. Bounded `shared/notify.ts` ignores on Block 4a + Block 5 (Phase 16) are NOT touched by Phase 20.
- **Phase 21 ↔ Phase 20 lint narrowing** -- After Phase 20, all 3 orchestrator families are MSG-Block-1-ignored. Phase 21 deletes the entire MSG-* plugin wiring (including all blocks) per SNM-24, SNM-25, SNM-27. Phase 21 also deletes V1 wrappers (`notifySuccess`, `notifyWarning`, `notifyError`, V1 3-arg `notifyUsageError` overload) per SNM-22.
- **Phase 21 ↔ Phase 20 composer retirement** -- After Plan 20-02 lands, `presentation/cascade-summary.ts` joins `cause-chain`, `manual-recovery`, `rollback-partial`, `version-arrow` in the orphaned-composer set. Phase 21 deletes all orphaned composers + their tests under `tests/presentation/`.

</code_context>

<specifics>
## Specific Ideas

- **V1 ≡ V2 byte invariance for `notifyUsageError`** -- The dual-overload signature at `shared/notify.ts:127-156` emits byte-identical output for both forms: V1 `(ctx, message, usageBlock)` produces `${message}\n\n${usageBlock}` at error severity; V2 `(ctx, { message, usage })` produces `${message}\n\n${usage}` at error severity. This is the technical justification for D-20-04 (catalog stays generic) and D-20-06 Plan 20-01 (byte-exact test assertions stay byte-identical). The migration is a SIGNATURE change, not a contract change.

- **The "30 sites" count vs ROADMAP's "~13 sites" estimate** -- The ROADMAP's SC #2 wording ("All ~13 `notifyUsageError(ctx, message, usage)` call sites") is outdated. Verified count: 30 sites across 15 files (4 in `router.ts`, 3 in `handlers/plugin/shared.ts`, 5 in `handlers/marketplace/*.ts`, 18 in `handlers/plugin/*.ts`). The phase migrates all 30; the original 13-site estimate appears to have predated the v1.2 import command and post-CMC-34 sweep growth.

- **Defense-in-depth catch-all DROP rationale, in plain terms** -- The 2 V1 `notifyError` sites in `bootstrap.ts:65` and `import.ts:49` are paranoid fallbacks. Both inner orchestrators (`bootstrapClaudePlugin` which composes `addMarketplace` + `setMarketplaceAutoupdate`; `importClaudeSettings` which has its own outer try/catch) already emit V2 failed notifications on caught errors. The edge-handler outer catches fire ONLY if those inner catches themselves throw -- which indicates a real bug, not an expected runtime condition. Forcing a polished V2 "(failed)" output in that path would mask the bug from the user.

- **`composeImportSummary` is heavier than plugin cascades but still inlinable** -- Plugin orchestrator cascade migrations in Phase 19 (reinstall, update) retired their `cascadeSummary` callers via inline construction (D-19-02). Each cascade had one outcome type per row. The import cascade has 6+ outcome types (`MarketplaceAddedOutcome`, `MarketplaceSkipOutcome`, `PluginInstalledOutcome`, `PluginSkipOutcome`, `ImportWarningOutcome`, `MarketplaceFailureOutcome`, `SourceMismatchOutcome`, `UnexpectedPluginFailureOutcome`) being merged + pivoted by marketplace. The strict D-19-02 mirror -- inline all of this directly into `executeImport` -- adds significant code to one function. The planner has discretion to factor the pivot into small pure helper functions (e.g., `pluginsFromOutcomes(outcomes): PluginNotificationMessage[]`) within `execute.ts` as long as no V1 string composition leaks. The user accepts this code-volume tradeoff vs. a `composeImportSummary` refactor because the strict mirror is the structurally consistent choice.

- **MSG-Block 1b's `edge/handlers/**` files entry is V1-wrapper-INDEPENDENT** -- the IN-06 in-file rationale at `eslint.config.js:190-198` explicitly notes that MSG-GR-3 per-scope iteration discipline is independent of the V1 wrapper migration. Phase 19's deferred prediction that Phase 20 would "remove Block 1b's `edge/handlers/**` files entry" was outdated relative to IN-06 and is explicitly REJECTED in D-20-07.

- **No new gray areas surfaced during cross-check.** The discussion explicitly covered Areas 1-4 plus quick surveys of: (a) handler factory pi-plumbing (verified already-threaded by Phase 18 Wave 0 + plugin handlers' existing signatures); (b) `composeImportCascade` pre-emission helper (verified no longer exists in the codebase -- the function previously cited in older code references is absent; planner verifies current shape during research); (c) `edge/args-schema.ts` callback signature (verified out of scope -- internal closure-passing, not a `shared/notify.ts` wrapper import); (d) `formatClaudeImportSummary` exported test helper (locked for retirement alongside `composeImportSummary` per D-20-02). All resolved within the 4 locked gray areas or covered by inherited Phase 18 / 19 decisions.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 21 (Final Teardown + GREEN gate)** -- Deletes V1 wrappers (`notifySuccess` / `notifyWarning` / `notifyError`, V1 3-arg `notifyUsageError` overload), the 34-rule MSG-* lint plugin under `tests/lint-rules/`, all orphaned `presentation/*` composers (including `cascade-summary.ts` now orphaned by Phase 20), the bounded `shared/notify.ts` ignores on MSG-Block 4a + 5, and the `shared/grammar/*` closed-set files (retain-vs-delete decision pending). Closes SNM-22, SNM-24, SNM-25, SNM-27, SNM-28, SNM-29, SNM-32.

- **`edge/args-schema.ts` callback parameter rename** -- the `notifyError: (message: string) => void` callback parameter name dates to the V1 era and confusingly shadows the `shared/notify.ts` wrapper name. Renaming to `onError` (or similar) is cosmetic only. Deferred to Phase 21 cleanup or a quick task.

- **Test-helper extraction for `makeCtx()` + `pi: { getAllTools: () => [] }`** -- Currently inlined in every edge handler and orchestrator test file. Cosmetic refactor; deferred to Phase 21 cleanup or a quick task (Phase 18 Claude's Discretion -- left inlined; Phase 19 inherited; Phase 20 also inherits).

- **Per-command usage-error fixtures in `docs/output-catalog.md`** -- explicitly REJECTED per D-20-04 for v1.4. If a future milestone wants exhaustive per-callsite enumeration as a user-contract gate (vs. structural-shape gate), it would be a documentation-style change rather than a code change. Backlog.

- **Branded `Version` type with `hash-<12hex>` / semver validation** -- Carried backlog from Phase 15/16.

- **Type-model amendments to support a top-level cause-bearing failure shape (`cause?: Error` on `MarketplaceNotificationMessage` or on `NotificationMessage` itself)** -- explicitly REJECTED for v1.4. If a future milestone wants polished error output for catastrophic-failure paths (vs. relying on Pi runtime's uncaught-exception boundary), it would require a Phase 15-style type amendment. Backlog.

### Reviewed Todos (not folded)

None -- `gsd-sdk query todo.match-phase 20` returned no matches. No pre-targeted todos in the codebase for this phase.

</deferred>

---

*Phase: 20-Migration Wave 3 -- Edge Handlers & UsageError*
*Context gathered: 2026-05-27*
