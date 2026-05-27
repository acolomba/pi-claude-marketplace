---
phase: 20-migration-wave-3-edge-handlers-usageerror
plan: 2
plan_name: import-cascade-migration
subsystem: orchestrators/import
tags:
  - migration
  - notify-v2
  - cascade
  - SNM-23
requirements_addressed:
  - SNM-23
dependency_graph:
  requires:
    - "shared/notify.ts::notify (Phase 16, SNM-12)"
    - "shared/notify.ts per-variant types (Phase 15, SNM-01..11)"
    - "presentation/sort.ts::compareByNameThenScope (Phase 12)"
  provides:
    - "extensions/pi-claude-marketplace/orchestrators/import/execute.ts::importClaudeSettings (V2 cascade payload; single notify(ctx, pi, message) call)"
    - "extensions/pi-claude-marketplace/orchestrators/import/index.ts barrel without formatClaudeImportSummary re-export"
  affects:
    - "presentation/cascade-summary.ts (now zero production importers; Phase 21 deletes)"
    - "presentation/reload-hint.ts (one fewer importer; Phase 21 deletes)"
tech_stack:
  added: []
  patterns:
    - "V2 cascade construction inline per Plan 19-04 reinstall.ts recipe (D-19-02 / D-20-02 strict mirror)"
    - "Orchestrator owns iteration order via compareByNameThenScope; notify() does NOT sort (D-16-06)"
    - "Per-row scope OMITTED on import cascade rows (Phase 17.2 orphan-fold; plugin scope matches mp scope by construction)"
    - "Catastrophic-error path DROP discipline extended from D-20-03 to the import orchestrator boundary (truly catastrophic throws bubble to Pi runtime)"
key_files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/import/index.ts
    - tests/orchestrators/import/execute.test.ts
key_decisions:
  - "D-20-02 (strict D-19-02 mirror) honored: composeImportSummary + formatClaudeImportSummary + ComposedImport + spliceSourceMismatchDiagnostics + orphanDiagnosticLines + PREAMBLE all retired; inline V2 cascade construction"
  - "A1 (ImportWarningOutcome marketplace-failed / unmappable-marketplace-source) -> DROP entirely. No V2 row; failing marketplace's own status: failed carries the structural signal"
  - "A2 (orphan diagnostics -- settings-read-error / malformed-enabled-plugin-ref) -> DROP entirely. In-memory result.diagnostics persists; user-facing surfacing silenced"
  - 'A3 ("Already up to date" notice + V1 PREAMBLE "Claude plugin import summary") -> DROP entirely. V2 grammar has no preamble; no-op import renders structurally as { marketplaces: [] }'
  - "Line-1001 catastrophic-error path DROPPED (outer try/catch + V1 notifyError). Truly catastrophic throws bubble to Pi runtime per D-20-03 extension. Inner executeScopedPlan per-scope try/catch at lines 745-755 already covers expected loadState failures"
  - "enumerateMarketplaceBlocks choice: Option B (delete + inline as buildImportNotificationMarketplaces). The strict D-19-02 mirror; inline construction stays compact at ~110 lines"
  - "orchestrators/import/index.ts barrel choice: KEEP with formatClaudeImportSummary re-export removed. Other re-exports survive (buildClaudeImportPlan, extractEnabledPluginRefs, etc.)"
metrics:
  duration_min: 26
  task_count: 2
  files_changed: 3
  insertions: 344
  deletions: 714
  net_loc_delta: -370
  tests_pass: 1364
  tests_fail: 0
  tests_todo: 2
  completed: 2026-05-27
---

# Phase 20 Plan 2: Import Cascade Migration Summary

Migrated `orchestrators/import/execute.ts` from the V1 severity-named
wrappers + cascade-summary indirection to a single V2 `notify(ctx, pi,
NotificationMessage)` call per orchestration, closing the LAST orchestrator
V2 migration in `orchestrators/import/` and orphaning
`presentation/cascade-summary.ts` for Phase 21 deletion.

## Overview

**Files modified (1 atomic commit):**

| File | Insertions | Deletions | Net |
| --- | --- | --- | --- |
| `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` | ~145 | ~545 | -400 |
| `extensions/pi-claude-marketplace/orchestrators/import/index.ts` | 0 | 1 | -1 |
| `tests/orchestrators/import/execute.test.ts` | ~200 | ~170 | +30 |
| **Total** | **~344** | **~714** | **-370 LoC** |

**Commit:** `fa11bf2` `refactor(20): migrate import orchestrator cascade to V2 notify() (SNM-23)`

## V1 surfaces retired (6+ helpers)

1. **`composeImportSummary`** (private helper, lines 366-435) -- the
   pivot-by-marketplace + outcome → cascade-row + severity-aggregation
   engine. DELETED.
2. **`formatClaudeImportSummary`** (exported test helper, lines 350-360)
   -- the V1 `(result, probe?) -> string` formatter the tests pinned via
   byte-equal assertions. DELETED.
3. **`ComposedImport`** interface alias (lines 361-364) -- the
   `{ body, severity }` return shape of composeImportSummary. DELETED.
4. **`spliceSourceMismatchDiagnostics`** helper (lines 655-709) -- the
   splice-cause-under-failing-header mechanic. DELETED; V2 maps
   source-mismatch to marketplace-level `reasons: ["source mismatch"]`
   directly (free-text cause LOST per D-18-02 precedent).
5. **`orphanDiagnosticLines`** helper (lines 711-730) -- the V1
   user-facing diagnostic surfacing. DELETED per A2 DROP.
6. **`PREAMBLE`** constant (line 318, `"Claude plugin import summary"`)
   -- the V1 user-visible preamble. DELETED per A3 DROP. V2 catalog
   has no preamble.

**Bonus retirements** (unused after the V1 retirement above):

- `enumerateMarketplaceBlocks` helper + its 3 sub-helpers (`ensureBlock`,
  `ensureBareHeader`, `upsertSourceMismatchHeader`) -- replaced by a
  single local `buildImportNotificationMarketplaces` function that
  constructs `MarketplaceNotificationMessage[]` directly.
- `importWarningStatus` helper -- folded inline into the new V2 builder
  (the A1 DROP eliminates 2 of the 4 input cases; the surviving 2 both
  map to PluginUnavailableMessage).
- `DEFAULT_PROBE` constant + the `SoftDepProbe` import -- companion
  probing now lives inside `notify()` per D-16-14.
- `hasWarnings` / `anyChanges` predicate helpers -- only used by the
  retired `composeImportSummary`.

**V1 emission sites collapsed:**

- Line-1001 catastrophic-error path (`notifyError(opts.ctx,
  \`Import failed: ${errorMessage(err)}\`, err)` inside outer try/catch
  at lines 979-1003) -- DROPPED entirely per A3 + D-20-03 extension.
- Line-1018 dispatch ternary (`const dispatch = severity === "warning" ?
  notifyWarning : notifySuccess; dispatch(opts.ctx, finalBody);`) --
  REPLACED by a single `notify(opts.ctx, opts.pi, { marketplaces })`
  call.

## Discretionary mappings (LOCKED in plan; documented for record)

### A1: marketplace-failed / unmappable-marketplace-source -> DROP

`ImportWarningOutcome.reason ∈ { "marketplace-failed", "unmappable-marketplace-source" }`
has no V2 row. Rationale: the failing marketplace's own
`status: "failed"` (from `result.marketplaceFailures` or
`result.sourceMismatches`) carries the structural signal at the
marketplace-header level. The advisory-only `unmappable-marketplace-source`
case (no marketplace ever existed in either `extraKnownMarketplaces` or
the official mapping) has no equivalent in the V2 grammar -- there's
no "unmapped" marketplace status.

**Data-loss consequence:** zero. The structural failure surface is
preserved via the marketplace-level `(failed)` header. The
in-memory `result.warnings` array still carries the V1 record so
orchestrated-mode consumers (none currently) could inspect it.

### A2: orphan diagnostics -> DROP

`result.diagnostics[]` entries with `marketplace === undefined`
(orphan -- e.g. `settings-read-error` thrown by `loadState`,
`malformed-enabled-plugin-ref` carrying an unparseable `ref`) have no
V2 representation. `MarketplaceNotificationMessage` carries no
top-level `reasons?:`/`diagnostics?:` array, and synthesizing a fake
marketplace block for orphan diagnostics would be structurally
misleading.

**Data-loss consequence:** medium. The in-memory
`result.diagnostics` array stays populated and is returned by
`importClaudeSettings`; Pi runtime debug logs preserve the
diagnostic visibility for operators. The user-facing surface
loses the orphan-diagnostic line beneath the V1 preamble. This is
the highest-risk DROP in Plan 20-02 (per CONTEXT.md Pitfall 3),
but locked per D-19-01 precedent and CONTEXT.md `<deferred>` (a
type amendment to surface orphan diagnostics structurally was
REJECTED).

### A3: "Already up to date" notice + PREAMBLE -> DROP

The V1 `composeImportSummary` emitted `"Import already up to date."`
when `!anyChanges(result) && !hasWarnings(result)`, alongside the
V1 PREAMBLE `"Claude plugin import summary"`. Both DROPPED entirely.

**V2 no-op shape:** when nothing was added and no plugins were
installed, `importClaudeSettings` invokes
`notify(opts.ctx, opts.pi, { marketplaces: [] })`. The renderer
emits the empty-array sentinel `(no marketplaces)` per
`shared/notify.ts:1158`.

**Data-loss consequence:** low-medium. The behavior change is
intentional and matches the V2 catalog (`docs/output-catalog.md:572-654`
shows NO preamble across all 4 `/claude:plugin import` fixtures).
Idempotent re-imports render structurally as `(no marketplaces)`
which is less narrative than V1 "Import already up to date." but
structurally correct. The catalog UAT runner verifies the byte
form across the 4 binding states.

## Line-1001 catastrophic-error DROP rationale

**V1 shape (lines 979-1003):**

```typescript
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

**V2 shape:**

```typescript
export async function importClaudeSettings(opts): Promise<...> {
  const result = emptyResult();
  // loadSettings + buildClaudeImportPlan + executeScopedPlan loop (no outer try/catch)
  const marketplaces = buildImportNotificationMarketplaces(result);
  notify(opts.ctx, opts.pi, { marketplaces });
  return result;
}
```

**Rationale (D-20-03 extension):** the outer try/catch wrapper at the
orchestrator boundary catches only truly catastrophic errors (the
inner `executeScopedPlan` per-scope try/catch at lines 745-755
already covers expected `loadState` failures and per-marketplace
add failures). When a catastrophic uncaught throw does happen, the
Pi runtime's uncaught-exception boundary surfaces a STACK TRACE with
the actual cause -- objectively BETTER for debugging than a polished
V1 message like `"Import failed: ..."` that masks the underlying
bug behind a single-line summary.

**Risk:** low-medium. CI should monitor `npm run check` logs for
new uncaught-exception traces. Mirrors D-20-03 catch-all DROP
discipline extended to the inner orchestrator boundary.

## Test rewrite delta

**Tests DELETED outright (per D-19-01 precedent, 6 tests total):**

| Line | Test name | Reason |
| --- | --- | --- |
| 44 | `formatClaudeImportSummary reports already up to date for idempotent skips` | A3 DROP -- no V2 equivalent of "already up to date" line |
| 72 | `formatClaudeImportSummary keeps warning records actionable by scope plugin@marketplace reason and cause` | A2 DROP -- orphan diagnostic line gone; warning-record fields no longer surfaced as standalone text |
| 685 | `formatClaudeImportSummary includes the canonical reload-hint trailer when changedResources is true` | V1 helper gone; replaced by a new test driving the same shape through `importClaudeSettings` + `makeCtx()` |
| 782 | `importClaudeSettings emits diagnostic and skips scope when loadState throws` | A2 DROP -- diagnostic stays in `result.diagnostics` (in-memory), no user-facing assertion possible |
| 822 | `importClaudeSettings emits unrecognized-stored-source diagnostic and blocks dependent plugins` | A2 DROP -- same reasoning |
| 944 | `importClaudeSettings catches top-level unexpected error and returns empty result` | Line-1001 catastrophic-error DROP -- the outer try/catch no longer exists |

**Tests REWRITTEN (10 tests, all formerly using V1 `formatClaudeImportSummary` or asserting on V1 byte form):**

All remaining tests now drive `importClaudeSettings({ ctx, pi, ... })`
with mock `ctx` + `pi` via `makeCtx()` and assert byte-equality on
recorded `notifications[0]?.message`. `notifications.length === 1`
per orchestration. Severity inspected directly per D-16-11.

`makeCtx()` extended with `{ piSubagentsLoaded?, piMcpAdapterLoaded? }`
options (defaulted to `true`) so `softDepStatus()` inside `notify()`
returns the desired probe state. The 4 declaresAgents/declaresMcp
predicate-combination tests pass `{ piSubagentsLoaded: false,
piMcpAdapterLoaded: false }` so `{requires pi-subagents}` /
`{requires pi-mcp}` markers surface on the rendered cascade body.

**Byte-equal assertions** across the V2 cascade body for representative
states:

| State | V2 byte form (recorded `notifications[0].message`) |
| --- | --- |
| Fresh single-plugin install | `● mp [user] (added)\n  ● my-plugin (installed)\n\n/reload to pick up changes` |
| Existing mp + already-installed plugin | `● mp [user] (updated)\n  ⊘ plugin (skipped) {already installed}\n\n/reload to pick up changes` |
| Marketplace add failure (cascade with mixed mp statuses) | `⊘ mp-a [user] (failed)` + `● mp-b [user] (added)\n  ● b (installed)` (joined by blank line) |
| Mixed unavailable / failed / installed plugins | `⊘ missing (unavailable) {no longer installable}` + `⊘ boom (failed) {not in manifest}` + `● ok (installed)` under `● mp [project] (added)` |
| Soft-dep markers (agents-only / mcp-only / both / neither) | `● plugin (installed) {requires pi-subagents}` / `{requires pi-mcp}` / `{requires pi-subagents, requires pi-mcp}` / `(installed)` (bare) |

## enumerateMarketplaceBlocks choice: Option B (delete + inline)

Per the plan's "Option A (keep + refactor) vs Option B (delete +
inline)" decision, I picked **Option B** -- the strict D-19-02 mirror.

**Rationale:** the V1 helper's pivot iteration discipline is naturally
expressed as a single local `buildImportNotificationMarketplaces`
function. The inline V2 construction stays compact (~110 lines,
including the per-outcome iteration loops and the
`compareByNameThenScope`-driven sort + freeze tail). A pure helper
adds no readability benefit over the inline construction when the
returned shape (`MarketplaceNotificationMessage[]`) is already a
flat array.

The Plan 19-04 reinstall.ts recipe (the structural template) uses
the same inline pattern: `renderReinstallPartitionAndNotify` is a
single function that pivots `ReinstallPluginOutcome[]` into
`MarketplaceNotificationMessage[]`.

## orchestrators/import/index.ts barrel choice: KEEP

Per CONTEXT line 156 ("planner's discretion"), I kept the barrel
intact with only the `formatClaudeImportSummary` re-export
removed. Other re-exports survive:

- `importClaudeSettings`
- Outcome types (`ClaudeImportExecutionResult`, `ImportWarningOutcome`,
  `MarketplaceFailureOutcome`, `PluginInstalledOutcome`,
  `PluginSkipOutcome`, `SourceMismatchOutcome`,
  `UnexpectedPluginFailureOutcome`)
- `buildClaudeImportPlan`, `planMarketplaceSourcesForRefs`
- `extractEnabledPluginRefs`, `parseEnabledPluginRef`
- `loadMergedClaudeSettingsForScope`, `mergeClaudeSettings`,
  `resolveClaudeSettingsPaths`
- 13 re-exported types from `./types.ts`

Folding the barrel further (e.g. inlining `./types.ts` re-exports
or eliminating the barrel entirely in favor of direct imports
from each submodule) offers no immediate cleanliness benefit and
would require a broad consumer refactor for marginal gain.

## presentation/cascade-summary.ts: orphaned

After Plan 20-02 lands, NO production file under
`extensions/pi-claude-marketplace/` imports from
`presentation/cascade-summary.ts`:

```bash
$ grep -rE "from\s+[\"'][^\"']*cascade-summary[\"']" \
    extensions/pi-claude-marketplace/ | grep -v presentation/
# (no output)
```

The file itself stays alive in-tree (Phase 21 deletes it per
CONTEXT line 156 + D-20-02). Plan 20-02 contributes to SNM-23
by removing the only remaining V1 wrapper callers in
`orchestrators/import/` (Plan 20-01 covered the edge family).

## Verification

- `npm run check`: **GREEN** -- 1364 pass / 0 fail / 2 todo
- `node --test tests/orchestrators/import/execute.test.ts`: **16/16 pass**
- `node --test tests/architecture/catalog-uat.test.ts`: **3/3 pass**
  (the 4 `/claude:plugin import` catalog fixtures stay byte-equal
  through real `notify()`)

**Audit invariants (`grep` counts):**

| Invariant | Required | Actual |
| --- | --- | --- |
| `notify(Success\|Warning\|Error)\(` in execute.ts | 0 | 0 |
| `composeImportSummary` in execute.ts | 0 | 0 |
| `formatClaudeImportSummary` in execute.ts | 0 | 0 |
| `formatClaudeImportSummary` in index.ts | 0 | 0 |
| `spliceSourceMismatchDiagnostics\|orphanDiagnosticLines` | 0 | 0 |
| `cascade-summary\|cascadeSummary` in execute.ts | 0 | 0 |
| `softDepStatus\|appendReloadHint\|reloadHint` in execute.ts | 0 | 0 |
| `Import failed:` in execute.ts | 0 | 0 |
| `Claude plugin import summary` in execute.ts | 0 | 0 |
| `notify\(opts\.ctx,\s*opts\.pi` in execute.ts | ≥1 | 1 |
| `cascade-summary` production importers outside `presentation/` | 0 | 0 |

## Self-Check: PASSED

- **Files modified exist:**
  - `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` -- FOUND
  - `extensions/pi-claude-marketplace/orchestrators/import/index.ts` -- FOUND
  - `tests/orchestrators/import/execute.test.ts` -- FOUND
- **Commit hash exists:** `fa11bf2` -- FOUND (`git log --oneline -1 fa11bf2`)

## Deviations from Plan

**1. `[Rule 1 - Bug]` Kept `errorMessage` import alive**

- **Found during:** Task 1, step 1 (UPDATE IMPORTS)
- **Issue:** The plan instructed to DROP `errorMessage` from the
  `../../shared/errors.ts` import on the grounds that it "becomes
  unused after the catastrophic-error DROP." This is incorrect:
  `errorMessage` is still used at lines 752 and 821 (inside
  `executeScopedPlan` for the `settings-read-error` diagnostic
  message and the `marketplace-failure` cause text). Dropping it
  would have caused a TypeScript compile error.
- **Fix:** Retained `errorMessage` in the import (alongside the
  preserved `ConcurrentInstallError` + `PluginShapeError`).
- **Files modified:** execute.ts only.
- **Commit:** `fa11bf2`

No other deviations from plan.

## Known Stubs

None. The V2 cascade construction inlines the full V1 -> V2 outcome
mapping; all 8 outcome arrays on `ClaudeImportExecutionResult` are
either translated to V2 rows or DROPPED per A1/A2.

## Threat Flags

None. The migration introduces no new trust boundaries, network
endpoints, file access paths, or schema changes. Per the plan's
threat register, T-20-02-01 (information disclosure via dropped
data surfaces) is accepted per CONTEXT.md `<deferred>`; T-20-02-02
(catastrophic-error path DROP) is accepted per D-20-03 extension;
T-20-02-03 / T-20-02-04 (severity manipulation / notification
flooding) are mitigated structurally by the V2 single-notify
discipline.
