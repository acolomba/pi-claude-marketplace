# Phase 20: Migration Wave 3 -- Edge Handlers & UsageError - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 20-Migration Wave 3 -- Edge Handlers & UsageError
**Areas discussed:** Plan granularity & waves, import/execute cascade migration, notifyError shape in bootstrap.ts + edge import.ts, Catalog coverage for usage errors

---

## Plan granularity & waves

| Option | Description | Selected |
|--------|-------------|----------|
| 4 plans, 3 waves | W1: usage-error sweep (30 sites, 15 files, atomic). W2 parallel: import/execute cascade + edge V1 notifyError migration. W3: lint narrowing + final UAT. | ✓ |
| Per-file like Phase 19 | ~15 plans: one per edge handler file (13) + import/execute + lint. Highest granularity, smallest atomic commits, but 11 of 13 handlers are 1-line trivia. | |
| 3 plans (collapse W2) | Sweep + (cascade & notifyError together in one plan) + lint. Smallest plan count; one plan touches both substantive concerns. | |

**User's choice:** 4 plans, 3 waves
**Notes:** The mechanical-sweep approach diverges from Phase 18/19 per-file precedent because 11 of 13 edge handler files contain only a 1-line signature change. Grouped-by-pattern structure keeps mechanical change in one reviewable diff while isolating substantive work (import/execute cascade, 2 V1 notifyError drops, lint) into separate atomic plans. Recorded as D-20-01 + D-20-05 in CONTEXT.md. No pilot/recipe block-comment needed -- no mirrored work pattern across plans.

---

## import/execute cascade migration

| Option | Description | Selected |
|--------|-------------|----------|
| REFACTOR composeImportSummary | Keep composeImportSummary as private helper but flip return from { body, severity } to NotificationMessage. execute.ts dispatches via notify(ctx, pi, message). Retires V1 string composition but keeps the 6-outcome-type pivot logic readable as a named function. | |
| RETIRE composeImportSummary inline | Strict D-19-02 mirror: delete composeImportSummary; inline all by-marketplace pivot + outcome → PluginNotificationMessage variant mapping directly in executeImport. Most consistent with Phase 19. | ✓ |
| KEEP composeImportSummary (return-shape unchanged) | Continue returning { body, severity } -- NOT viable under D-16-04 renderer-as-spec. Listed for explicit rejection. | |

**User's choice:** RETIRE composeImportSummary inline (D-19-02 strict)
**Notes:** Recorded as D-20-02 in CONTEXT.md. `composeImportSummary` retired entirely; `formatClaudeImportSummary` exported test helper also retired in the same plan; tests migrate to byte-exact assertions through real `notify()` per D-19-07 inheritance. Planner retains discretion to factor the pivot into small pure helper functions within `execute.ts` as long as no V1 string composition leaks.

---

## notifyError shape in bootstrap.ts + edge import.ts

| Option | Description | Selected |
|--------|-------------|----------|
| DROP both | Remove the catch-all try/catch in bootstrap.ts and import.ts entirely. Sub-orchestrators already handle their own errors with V2 failed-marketplace emissions. Pi runtime handles truly catastrophic uncaught throws. Consistent with D-18-01 / D-19-01 DROP precedent extended to redundant outer guards. | ✓ |
| KEEP both as bare failed-marketplace | bootstrap → `notify({ marketplaces: [{ name: "claude-plugins-official", scope: "user", status: "failed", plugins: [] }] })`. import → degenerate (no top-level marketplace identity; would emit `(no marketplaces)`). Cause lost in both. | |
| DROP import, KEEP bootstrap | Asymmetric: bootstrap has known marketplace identity so a bare failed-marketplace shape is meaningful; import has no top-level identity so its catch is redundant defense-in-depth. | |

**User's choice:** DROP both
**Notes:** Recorded as D-20-03 in CONTEXT.md. Behavior change: Pi runtime's outer error boundary now handles truly catastrophic uncaught throws. Tests that previously asserted `notifyError` emissions for unexpected-throw scenarios are DELETED outright per D-19-01 precedent. Inner orchestrators (`addMarketplace`, `setMarketplaceAutoupdate`, `importClaudeSettings`) already emit V2 failed notifications on their own caught errors -- the outer guards are paranoid fallbacks that mask real bugs behind a polished "(failed)" output.

---

## Catalog coverage for usage errors

| Option | Description | Selected |
|--------|-------------|----------|
| Stay generic | Keep the single generic `<!-- catalog-state: usage-error -->` fixture. Catalog gates structural shape; per-handler unit tests gate specific content. Consistent with current catalog narrative ("renderer-/orchestrator-specific"). | ✓ |
| Add per-command fixtures | ~15 catalog blocks -- one for each distinct (message, usage) pair across the 13 handlers + 4 router fallbacks. Exhaustive but a large catalog diff and a new convention not established elsewhere in v1.4. | |
| Representative subset | ~6-8 blocks covering one per command family (router, marketplace, install, update, list, reinstall, bootstrap, import). Middle ground. | |

**User's choice:** Stay generic
**Notes:** Recorded as D-20-04 in CONTEXT.md. Justified by V1 ≡ V2 byte invariance: the dual-overload signature at `shared/notify.ts:127-156` emits byte-identical output for both forms. The V2 migration is a pure SIGNATURE change at call sites, not a grammar change. The single generic catalog fixture gates structural shape; per-handler unit tests gate per-callsite content via byte-exact assertions through real `notifyUsageError()`.

---

## Claude's Discretion

Locked under D-20-02 (cascade migration) -- the planner retains discretion on:

- Inline pivot factoring (e.g., small pure helper functions like `pluginsFromOutcomes(outcomes): PluginNotificationMessage[]`) within `execute.ts`.
- Line-1001 catastrophic-error path treatment: DROP (recommended default per D-20-03 extension) vs. bare-failed-marketplace KEEP. Planner determines during research.
- `ImportWarningOutcome` general per-marketplace warnings: marketplace-level `reasons?:` (Phase 17.1 surface) vs. synthesized plugin rows vs. DROP per D-19-01 precedent.
- `SourceMismatchOutcome` diagnostic splicing in V2: marketplace-level `reasons?:` vs. per-plugin `PluginFailedMessage.cause`.
- `orphanDiagnosticLines` (settings-read-error etc.): top-level marketplace-level reasons vs. synthesized marketplace block vs. DROP.

Locked under D-20-01 (plan granularity) -- the planner retains discretion on:

- Exact ordering of file mutations within Plan 20-01 (alphabetical, by-file-size, etc.). Atomic single-commit either way.
- Helper extraction for `{ message, usage }` construction inside individual call sites (inlining recommended; extraction acceptable).
- Specific severity-tier assertion form in tests: `assert.equal(note.severity, "error")` vs. helper like `assertSeverity(note, "error")`.
- `parseCommandArgs` callback parameter signature in `edge/args-schema.ts`: cosmetic cleanup at planner discretion within Plan 20-01 or deferred to Phase 21.

## Deferred Ideas

- **Phase 21 (Final Teardown + GREEN gate)** -- Deletes V1 wrappers, the 34-rule MSG-* lint plugin, all orphaned `presentation/*` composers (including `cascade-summary.ts` orphaned by Phase 20), bounded `shared/notify.ts` ignores, `shared/grammar/*` closed-set files.
- **`edge/args-schema.ts` callback parameter rename** -- cosmetic-only `notifyError` → `onError` rename; deferred to Phase 21 or quick task.
- **Test-helper extraction for `makeCtx()` + `pi: { getAllTools: () => [] }`** -- inlined in every test file; cosmetic refactor; deferred to Phase 21 or quick task.
- **Per-command usage-error fixtures in `docs/output-catalog.md`** -- explicitly REJECTED for v1.4 per D-20-04; backlog if a future milestone wants exhaustive per-callsite enumeration.
- **Type-model amendments for a top-level cause-bearing failure shape** -- explicitly REJECTED for v1.4 per D-20-03 / Phase 19 precedent; backlog if a future milestone wants polished error output for catastrophic-failure paths.
- **Branded `Version` type with `hash-<12hex>` / semver validation** -- Carried backlog from Phase 15/16.
