---
phase: 19-migration-wave-2-plugin-orchestrator-family
plan: 4
subsystem: plugin-orchestrator-migration
tags:
  [
    migration,
    v1-to-v2,
    wave-2,
    plan-19-04,
    reinstall,
    cascade-bulk,
    manual-recovery-fold,
    plugin-family,
  ]
requires:
  - phase-19-plan-01
  - phase-18-marketplace-orchestrator-family
  - phase-17.1-autoupdate-grammar
  - phase-17.2-renderscope-fix
provides:
  - reinstall-ts-v2-migration
  - bulk-cascade-construction-pattern
  - manual-recovery-structural-variant-pattern
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/register.test.ts
tech-stack:
  added: []
  patterns:
    - "notify(ctx, pi, { marketplaces: [{ name, scope, plugins: PluginNotificationMessage[] }] }) -- single V2 call per orchestration arm (5 arms: single-plugin success, single-plugin failure, bulk cascade, enumerate-targets failure, empty-targets)"
    - "Inline bulk-cascade construction: orchestrator groups ReinstallPluginOutcome[] by (name, scope), pre-sorts via compareByNameThenScope (D-16-06), then maps each outcome to its V2 PluginNotificationMessage variant via the new outcomeToPluginMessage helper (V2 replacement for V1 outcomeToCascadeRow)"
    - "Manual-recovery as structural plugin variant per D-19-02: V1 emitted manual-recovery as a separate top-level renderManualRecovery line below the cascade body; V2 folds it INSIDE the same cascade plugins[] array as a PluginManualRecoveryMessage with status literal 'manual recovery' (WITH a space per shared/grammar/status-tokens.ts:47)"
    - "Two DROPPED post-success notifyWarning loops per D-19-01: standalone-mode bridgeWarnings (line 233 V1) + maintenanceWarnings (line 237 V1) loops removed; underlying side effects (dropMarketplaceCache + rm) still run; orchestrated-mode notes accumulation preserved"
    - "V1 dispatch ternary at reinstall.ts:543 REMOVED per D-19-02; V2 notify() owns severity per D-16-11 (content-derived first-match ladder)"
key-files:
  created:
    - .planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-04-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/edge/handlers/plugin/reinstall.test.ts
    - tests/edge/register.test.ts
decisions:
  - "D-19-01 honored: 2 post-success notifyWarning surfaces DROPPED (bridgeWarnings + maintenanceWarnings); explanatory comments cite D-18-01 lineage."
  - "D-19-02 honored: 2 cascadeSummary call sites RETIRED (V1 reinstall.ts:496 main cascade + V1 reinstall.ts:1313 single-plugin cascade); V1 dispatch ternary at V1 reinstall.ts:543 REMOVED; manual-recovery folded INTO cascade plugins[] as PluginManualRecoveryMessage variant; renderManualRecovery + renderRow + renderSuccessBody + cascadeSummary call sites all gone."
  - "D-19-05 (Wave 1 recipe mirror) honored: the 11-line NotificationMessage cascade recipe block-comment is mirrored byte-exactly above the surviving main-cascade notify() call inside `renderReinstallPartitionAndNotify`."
  - "D-19-06 (disjoint file pair) honored: only reinstall.ts + reinstall.test.ts + (incidentally) 2 shim tests touched. The 2 shim tests (edge/handlers/plugin/reinstall.test.ts + edge/register.test.ts) had byte assertions on the V1 surface; they update in lockstep, NOT a deviation -- the shim handlers route through the orchestrator under test, so their byte expectations follow."
  - "D-19-07 (test discipline) honored: byte-exact V2 assertions through real notify() via existing makeCtx(); makeCtx() preserved verbatim; 2 dropped-warning assertions DELETED on PRL-12; manual-recovery anchor assertion rewritten from V1 top-level form to V2 inline plugins[]-row form; severity assertions updated where V1->V2 ladder flip applies."
  - "D-16-04/11/12/14 (renderer-as-spec; severity / reload-hint / soft-dep computed by notify()) honored: orchestrator passes no severity; reload-hint computed structurally from variant status per D-16-12 (reinstalled is state-changing -> always fires on reinstall cascade)."
  - "V2 behavior changes documented (NOT deviations -- the V1->V2 migration contract demands them):"
  - "  (a) PRL-12/RH-5 flip: V1 suppressed reload-hint when resourcesChanged=false; V2 emits structurally from PluginReinstalledMessage status per D-16-12."
  - "  (b) PRL-13 severity flip: V1 routed mixed cascades with failed rows to notifyWarning (MSG-SR-6 banned notifyError on cascades); V2 first-match ladder per D-16-11 promotes to `error` when any failed row exists."
  - "  (c) Per-row scope orphan-fold (Phase 17.2 contract): V1 always emitted `[<scope>]` on cascade rows; V2 omits the bracket when plugin scope matches parent marketplace scope (renderScopeBracket at shared/notify.ts:719)."
  - "  (d) Empty-targets byte change: V1 emitted `(no plugins)` via renderRow EmptyToken; V2 emits `(no marketplaces)` via the `{ marketplaces: [] }` structural shape (closest analog at docs/output-catalog.md:139-145; no dedicated V2 catalog sentinel for the reinstall empty-target case)."
  - "outcomeToCascadeRow REPLACED by outcomeToPluginMessage: V1 produced PluginCascadeRow (presentation-layer V1 type); V2 produces PluginNotificationMessage variants directly. The closed-set Reason precedence ladder (failureClass=manual-recovery > typed reasons > narrowReasons fallback) is PRESERVED. 7 existing __test_outcomeToCascadeRow tests rewritten to __test_outcomeToPluginMessage with updated assertions."
  - "Claude's Discretion (CONTEXT line 110) on enumerateReinstallTargets failure shape: chose synthetic PluginFailedMessage with placeholder name '(reinstall)' and target.marketplace as the marketplace name (or '(reinstall)' for the bare-all form). Rationale: the renderer's failed-row form carries the cause-chain trailer needed for the underlying MarketplaceNotFoundError text (V1 surfaced that text via notifyError's auto-appended trailer); marketplace-level failure shape would have lost that channel."
  - "Claude's Discretion (CONTEXT line 111) on runPostSuccessMaintenance: KEPT INTACT even though its standalone-mode user-visible surface is dropped. Rationale: orchestrated-mode `notes` field (consumed by reinstallPlugins outer loop) still depends on its return value; inlining would have duplicated the cache-drop + data-dir rm side-effecting logic at the call site."
metrics:
  completed: 2026-05-27
---

# Phase 19 Plan 4: `reinstall.ts` V1 -> V2 Cascade-Heavy Migration Summary

Wave 2 of Phase 19's plugin orchestrator family. Migrates
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` from
the V1 severity-named wrappers (7 callsites: 2 notifySuccess, 2
notifyWarning, 3 notifyError) + 2 `cascadeSummary` call sites + 1 V1
dispatch ternary to the V2 structured entry point `notify(ctx, pi,
NotificationMessage)` (one call per orchestration arm) and locks the V2
inline-bulk-cascade construction pattern for Plan 19-05 (update.ts) to
mirror. Manual-recovery anchor folds STRUCTURALLY into the cascade
`plugins[]` array as a `PluginManualRecoveryMessage` variant per D-19-02
(V1's separate top-level emission via `renderManualRecovery` is GONE).

## What Was Built

### Task 1 -- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`

| Change                                            |             Final location | Detail                                                                                                                                                                                                                                                                |
| ------------------------------------------------- | -------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drop V1 wrapper imports                           |               (was line 63) | Removed `notifyError, notifySuccess, notifyWarning`                                                                                                                                                                                                                   |
| Drop V1 presentation/* composer imports           |        (were lines 49-54) | Removed `cascadeSummary` + `renderManualRecovery` + `renderRow` + `appendReloadHint, reloadHint` + the related compact-line type imports (`ManualRecoveryLine`, `MarketplaceRow`, `PluginCascadeRow`, `SoftDepProbe`); also removed `softDepStatus` from pi-api      |
| Keep non-notify presentation utilities            |                  lines 69-70 | `composeErrorWithCauseChain` (for orchestrated-mode `notes`) + `compareByNameThenScope` (sort utility) both retained per plan's "bounded to non-notify utilities" clause                                                                                              |
| Add V2 imports                                    |                   line 79 | `import { notify } from "../../shared/notify.ts";`                                                                                                                                                                                                                  |
| Add V2 type imports                               |                lines 99-107 | `Dependency`, `MarketplaceNotificationMessage`, `PluginFailedMessage`, `PluginManualRecoveryMessage`, `PluginNotificationMessage`, `PluginReinstalledMessage`, `PluginSkippedMessage`                                                                                  |
| Migrate single-plugin failure (V1 line 197)       |                lines 270-329 | Extracted to `handleSinglePluginFailure` helper (cognitive-complexity decomposition). V2 emits one `notify()` with `PluginFailedMessage` OR `PluginManualRecoveryMessage` (when `findManualRecoveryError(err)` matches). Cause threaded through the `cause?` field. |
| DROP bridgeWarnings notifyWarning loop (V1 line 232) | (was lines 232-234; now D-19-01 comment block at lines 282-293) | Loop body removed; explanatory comment cites D-19-01 (D-18-01 lineage). `void locked.bridgeWarnings` keeps the noUnusedVariable lint quiet. Orchestrated-mode `notes` accumulation preserved at lines 277-280. |
| DROP maintenanceWarnings notifyWarning loop (V1 line 236) | (was lines 236-238; folded into same D-19-01 comment block above) | Same treatment. `runPostSuccessMaintenance` still runs (orchestrated-mode consumers depend on its return value). `void maintenanceWarnings` keeps the noUnusedVariable lint quiet. |
| Migrate single-plugin success (V1 line 240)       |                lines 295-313 | `notify(ctx, pi, { marketplaces: [{ name, scope, plugins: [PluginReinstalledMessage] }] })`. `dependencies` derived via `dependenciesFromOutcome(outcome)` helper from `declaresAgents` / `declaresMcp` flags. Per-row scope orphan-folded.                          |
| Migrate enumerate-targets failure (V1 line 254)   |                lines 332-365 | V2 emits one `notify()` with synthetic `PluginFailedMessage` (placeholder name `"(reinstall)"`, target.marketplace as the marketplace name or `"(reinstall)"` for bare-all). Claude's Discretion documented above.                                                  |
| Migrate empty-targets (V1 line 263)               |                lines 366-377 | V2 emits `{ marketplaces: [] }` → renderer's `(no marketplaces)` sentinel. V1 `(no plugins)` retired (byte change documented above).                                                                                                                                |
| Migrate bulk cascade (V1 lines 496 + 543)         |        in `renderReinstallPartitionAndNotify` at lines 549-643 | RETIRED cascadeSummary + dispatch ternary. New body groups outcomes by (scope, marketplace) in input order, sorts via compareByNameThenScope (D-16-06), maps via `outcomeToPluginMessage`, emits single V2 `notify()`. 11-line Wave 1 recipe block-comment embedded. |
| RETIRE V1 dispatch ternary (V1 line 543)          |       (gone -- folded into `renderReinstallPartitionAndNotify` rewrite) | The `const dispatch = aggregatedSeverity === "warning" ? notifyWarning : notifySuccess; dispatch(ctx, appendReloadHint(composedBody, hint));` block REMOVED. V2 `notify()` owns severity per D-16-11.                                                              |
| RETIRE manual-recovery separate top-level emission (V1 lines 509-532) | (gone -- folded into `outcomeToPluginMessage`'s "manual recovery" variant branch at lines 728-739) | The `manualRecoveryAnchors` filter + `renderManualRecovery` per-row composition + the `body${hint}` concatenation REMOVED. Manual-recovery is now a structural `PluginManualRecoveryMessage` variant inside the same `plugins[]` array. |
| RETIRE single-row cascade (V1 line 1313 `renderSuccessBody`) |       (gone) | The `renderSuccessBody` function + its `cascadeSummary` call REMOVED. The single-plugin success path at line 305 now emits the same V2 structured payload as the bulk cascade for one outcome.                                                                       |
| Replace V1 `outcomeToCascadeRow` with V2 `outcomeToPluginMessage` |              lines 685-742 | New helper produces `PluginNotificationMessage` variants directly. Closed-set Reason precedence preserved (failureClass=manual-recovery > typed `outcome.reasons` > `narrowReasons(notes)` fallback). Manual-recovery variant pivots from V1 `PluginFailedMessage{rollback partial}` to V2 `PluginManualRecoveryMessage`. Orphan-fold per-row scope: row scope OMITTED when it matches marketplace scope. |
| Add `dependenciesFromOutcome` helper             |                lines 759-770 | Maps `ReinstallReinstalledOutcome.declaresAgents` / `.declaresMcp` flags to the V2 `Dependency[]` tuple per SNM-06.                                                                                                                                                  |
| Add recipe block-comment                          |                 lines 528-543 (16 lines) | Wave 1 mirror template (11 lines verbatim recipe + 4-line reference comment "V2 cascade construction mirrors the Plan 19-01 pilot recipe...").                                                                                                                       |
| Update `__test_renderReinstallPartitionAndNotify` JSDoc |                 lines 656-666 | New JSDoc cites Plan 19-04 / D-19-02; the seam still points at the V2 `renderReinstallPartitionAndNotify` function.                                                                                                                                                  |
| Add `__test_outcomeToPluginMessage` export        |                       line 757 | Test seam for the closed-set Reason mapping regression tests.                                                                                                                                                                                                         |
| Drop V1 `__test_outcomeToCascadeRow` export       |                      (gone) | Replaced by `__test_outcomeToPluginMessage` (test file updated in lockstep).                                                                                                                                                                                         |

**Recipe block-comment location:**
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:528-543`
(11 verbatim recipe lines + 4-line reference, 16 total lines directly above
the `notify(ctx, pi, ...)` call at line 643 inside
`renderReinstallPartitionAndNotify`). Wave 2 successor agents find the
recipe via:

```
grep -n "NotificationMessage cascade recipe" \
  extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
```

**Cascade plugin variant set used in reinstall.ts:**

- `PluginReinstalledMessage` (status `"reinstalled"`, REQUIRED `dependencies: readonly Dependency[]` per D-15-02; optional `version?`)
- `PluginSkippedMessage` (status `"skipped"`, REQUIRED `reasons: readonly Reason[]`)
- `PluginFailedMessage` (status `"failed"`, REQUIRED `reasons` + optional `cause?: Error`)
- `PluginManualRecoveryMessage` (status `"manual recovery"` WITH a space per shared/grammar/status-tokens.ts:47 -- D-19-02; REQUIRED `reasons` + optional `cause?: Error`)

### Task 2 -- `tests/orchestrators/plugin/reinstall.test.ts`

V2 byte-string flips + dropped-warning assertion deletion + V2 reload-hint
behavior-change flip + V1->V2 severity ladder flip + manual-recovery
inline-row rewrite. Existing `makeCtx()` (lines 42-58) preserved verbatim
per D-19-07.

| Test                                                | V1 surface                                                                                                | V2 result                                                                                                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRL-08/11 happy (single-plugin success)             | `assert.match(notifications.at(-1)?.message, /\/reload to pick up changes$/)`                              | Unchanged (V2 still emits the trailer for reinstalled).                                                                                                                                                  |
| PRL-12 (cleanup-warning surface)                    | Assertions on V1 warning-severity notifications carrying `cache drop failed` / `data cleanup failed` text | DROPPED per D-19-01. Test renamed to PRL-12 (Plan 19-04). Assertions flipped: `notifications.length === 1` (only the success cascade), zero warning-severity notifications, defense-in-depth assertion that the dropped warning text does NOT appear on the V2 success notification's body. |
| PRL-12/RH-5 (zero-resource reinstall reload-hint)  | `assert.equal((notifications.at(-1)?.message ?? "").includes("/reload to pick up changes"), false)`        | V1->V2 behavior flip: V2 emits the trailer structurally from PluginReinstalledMessage status per D-16-12. Test renamed to "(Plan 19-04): V2 per-variant reload-hint -- emitted on reinstalled even with zero resources changed". Assertion flipped to `true`. |
| PRL-05 cross-scope skipped                         | `/● mp \[project\]\n {2}⊘ plug \[project\] \(skipped\)/`                                                  | V2 orphan-fold: `/● mp \[project\]\n {2}⊘ plug \(skipped\)/`. Severity unchanged (`warning`).                                                                                                          |
| PRL-13 batch with failed plugin                    | `/● mp \[project\]\n {2}⊘ bad \[project\] \(failed\)/`; `notifications.at(-1)?.severity === "warning"`     | V2 orphan-fold + severity flip: `/● mp \[project\]\n {2}⊘ bad \(failed\)/`; severity is `"error"` per D-16-11 first-match ladder (V1 MSG-SR-6 ban on `notifyError` for cascades is GONE).            |
| PRL-13 deterministic sort                          | 3 regex matches with per-row `[project]` / `[user]` brackets                                              | All 3 regexes updated to orphan-fold form (per-row scope brackets omitted when matching marketplace scope).                                                                                              |
| PRL-15 batch soft-deps                             | `/● good \[project\] v1\.0\.0 \(reinstalled\) \{requires pi-subagents, requires pi-mcp\}/`               | V2 orphan-fold: `/● good v1\.0\.0 \(reinstalled\) \{requires pi-subagents, requires pi-mcp\}/`.                                                                                                       |
| PRL-04 bulk bare reinstall                         | 2 regex matches with per-row `[project]` / `[user]` brackets                                              | Both updated to V2 orphan-fold form.                                                                                                                                                                     |
| PRL-03 bulk marketplace                            | `/● mymp \[project\]\n {2}● plug \[project\] v/`                                                          | V2 orphan-fold: `/● mymp \[project\]\n {2}● plug v/`.                                                                                                                                                  |
| Manual-recovery anchor (D-14-02 / CMC-16)          | Asserts SEPARATE top-level anchor line below cascade body via `renderRow({kind: "manual-recovery"})`     | REWRITTEN to assert INLINE manual-recovery row inside the same plugins[] array (`/⊘ broken \(manual recovery\) \{rollback partial\}/`). Asserts that the V1 separate anchor form (`broken@mp (manual recovery)`) is NOT present. Severity: warning (D-16-11). Test renamed to "Plan 19-04 / D-19-02". |
| 7 `__test_outcomeToCascadeRow` unit tests          | Asserted V1 `PluginCascadeRow` output with `status: "failed"` + `reasons: ["rollback partial"]` for manual-recovery class | REWRITTEN to use `__test_outcomeToPluginMessage` returning V2 `PluginNotificationMessage` variants. Manual-recovery class now asserts `status: "manual recovery"` + `reasons: ["rollback partial"]` (distinct discriminated variant per D-19-02). Tests renamed to "Plan 19-04 / D-19-02 ...". |
| WR-01 outcomeToCascadeRow end-to-end binding       | Asserted PluginCascadeRow `(failed) {rollback partial}` shape                                             | REWRITTEN: `__test_outcomeToPluginMessage` returns PluginManualRecoveryMessage variant. Test renamed to "Plan 19-04 / D-19-02: outcomeToPluginMessage stays correct when the orchestrator catches a release-wrapped MRE (WR-01 V2 successor)". |

**Test count: unchanged.** All 38 reinstall.test.ts tests pass (38/38). No
tests added or removed; the V1->V2 rewrite was strictly byte-form +
severity-form + helper-rename. The dropped-warning assertions in PRL-12
were folded INTO the renamed PRL-12 test as defense-in-depth checks (no
test deletion).

**Deleted assertions** (per D-19-07 test-count consequence of D-19-01):

- PRL-12's V1 warning-severity assertions: `warnings.some((w) => w.includes("cache drop failed"))` + `warnings.some((w) => w.includes("data cleanup failed"))` -- replaced by defense-in-depth assertion that the V2 success body does NOT contain that text.

### Task 2 (incidental, shim-layer lockstep) -- `tests/edge/handlers/plugin/reinstall.test.ts` + `tests/edge/register.test.ts`

These two test files are NOT in the disjoint pair targeted by Plan 19-04
(`reinstall.ts` + `reinstall.test.ts`), but they exercise the same V1
surface through edge-handler shim layer and emitted-byte assertions on
the same `ctx.ui.notify` boundary. The 4 failing tests after the Task 1
migration were:

| Test                                                                                  | V1 surface                                                                                          | V2 result                                                                                                  |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| shim :: bare reinstall with no positional calls reinstallPlugins target all           | `assert.equal(notifications[0]?.message, "(no plugins)")`                                            | Flipped to `"(no marketplaces)"` per V2 empty-targets byte change.                                         |
| shim :: --scope works before and after reinstall ref                                  | `"(no plugins)"` + `/● mymkt \[project\]\n {2}⊘ myplug \[project\] \(skipped\)/`                    | Flipped to `"(no marketplaces)"` + V2 orphan-fold regex.                                                   |
| shim :: --force works before and after reinstall ref                                  | `assert.equal(severity, "warning")` + `/⊘ hello \[project\] \(failed\)/` + 2 per-row scope regexes  | Flipped to `severity === "error"` per V2 D-16-11 ladder + V2 orphan-fold regex (both failed and success).  |
| D-04 :: registered command routes reinstall through makeReinstallHandler              | `assert.equal(notifications[0]?.message, "(no plugins)")`                                            | Flipped to `"(no marketplaces)"`.                                                                          |

These shim tests touch the same V2 byte boundary the orchestrator owns;
their assertions are downstream consequences of the orchestrator
migration. NOT a deviation -- they update mechanically to track the V2
output.

## Verification

### Plan invariants

| Check                                                                                                            | Expected | Actual |
| ---------------------------------------------------------------------------------------------------------------- | -------: | -----: |
| `grep -cE "notify(Success\|Warning\|Error)\(ctx" extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` |        0 |      0 |
| `grep -cE "cascadeSummary\(" extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`                  |        0 |      0 |
| `grep -cE "renderManualRecovery\(" extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`            |        0 |      0 |
| `grep -cE "dispatch\s*=\s*aggregatedSeverity" extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` |        0 |      0 |
| `grep -cE 'status:\s*"manual recovery"' extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`       |       ≥1 |      2 |
| `grep -cE "^\s+notify\(ctx, pi" extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`               |        5 |      5 |
| `grep -c "NotificationMessage cascade recipe" extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` |        1 |      1 |
| `grep -cE "^import.*presentation/" extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`            |  2 (utils) |      2 |

### Test pipeline

```
$ node --test tests/orchestrators/plugin/reinstall.test.ts
# tests 38
# pass 38
# fail 0

$ node --test tests/architecture/catalog-uat.test.ts
# tests 3
# pass 3
# fail 0

$ npm run check
typecheck     PASS
lint          PASS
format:check  PASS
test          1365 tests / 1363 pass / 0 fail / 2 todo (identical to Phase 18 + Plan 19-01 baseline)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SonarJS cognitive-complexity 17 > 15 in `reinstallPlugin`**

- **Found during:** post-Task-1 `npm run check`
- **Issue:** The migrated `reinstallPlugin` function exceeded the 15-complexity
  ceiling (`sonarjs/cognitive-complexity` rule) because the failure path
  inlined the conditional V2 notify-or-skip emission alongside the V1
  outcome-return construction.
- **Fix:** Extracted the failure-path body into a private
  `handleSinglePluginFailure(opts, err, render): ReinstallFailedOutcome` helper.
  The helper returns the outcome and conditionally calls `notify()` when
  `render !== "none"`. Cognitive complexity drops back inside the 15
  ceiling.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
- **Commit:** atomic commit with Task 1 + Task 2 + lockstep shim updates.

**2. [Rule 3 - Blocking] Prettier blank-line discipline on `dependenciesFromOutcome`**

- **Found during:** post-Task-1 `npm run check`
- **Issue:** ESLint `@stylistic/padding-line-between-statements` rule
  required a blank line between consecutive `if` statements.
- **Fix:** Added blank lines between the two `if` blocks and the return
  statement; `npx prettier --write` normalized the file.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
- **Commit:** atomic commit (same as above).

### Behavior changes documented in the plan (NOT deviations)

These are the documented V1->V2 migration consequences listed in the
plan's `must_haves.byte_contracts` and `<decisions>` sections.

**1. PRL-12/RH-5 reload-hint trigger flip**

The V1 contract suppressed the reload-hint when `resourcesChanged: false`.
V2 emits the trailer structurally from `PluginReinstalledMessage` status
per D-16-12 -- the trigger ladder is per-variant, not per-cascade-outcome
resource count. The plan's `must_haves.byte_contracts` documents this on
the single-shot success arm. PRL-12/RH-5's assertion is flipped to expect
the trailer. NOT a deviation -- this is the V1->V2 behavior shift the plan
explicitly requires.

**2. PRL-13 batch severity flip**

V1 MSG-SR-6 forbade `notifyError` on cascade summaries; mixed cascades
with failed rows routed to `notifyWarning`. V2 `notify()` computes
severity from contents per D-16-11 (first-match ladder: failed > skipped
> manual recovery > ok); any failed row tips the ladder to `error`. NOT a
deviation -- this is the V1->V2 severity ownership transfer the plan
explicitly requires.

**3. Per-row scope orphan-fold**

V1 always emitted `[<scope>]` on cascade rows. V2's `renderScopeBracket`
at `shared/notify.ts:719` SUPPRESSES the per-row bracket when
`pluginScope === mpScope` (D-17.2-01 / D-17.2-02 contract). Every
multi-plugin cascade byte assertion in the test file flipped from `/●
<plugin> \[<scope>\] v.../` to `/● <plugin> v.../` (the marketplace
header still carries `[<scope>]`).

**4. Empty-targets byte change**

V1 emitted `(no plugins)` via `renderRow({kind: "empty"})`. V2 emits
`(no marketplaces)` via `{ marketplaces: [] }`. Closest analog at
`docs/output-catalog.md:139-145`. Documented in the plan's
`must_haves.byte_contracts` for the empty-targets path.

### Other deviations

None. The orchestrator and test rewrites follow the plan verbatim.

## Authentication Gates

None.

## V1 -> V2 Migration Status (reinstall.ts only)

| Status                                                                | Count |
| --------------------------------------------------------------------- | ----: |
| V1 wrapper callsites remaining in reinstall.ts                        |     0 |
| V2 notify() callsites in reinstall.ts                                 |     5 |
| V1 cascadeSummary call sites retired                                  |     2 |
| V1 dispatch ternaries retired                                         |     1 |
| presentation/* notify-path composer imports remaining                 |     0 |
| presentation/* non-notify utility imports remaining (allowed)         |     2 |
| V1 wrapper callsites DROPPED entirely per D-19-01                     |     2 |
| Manual-recovery emissions FOLDED into cascade plugins[] per D-19-02   |     1 |
| Catalog UAT plugin-reinstall fixtures still GREEN                     |   7/7 |
| (single-mp-all-reinstalled, success-with-soft-dep, single-mp-mixed-outcomes, |       |
|  single-mp-all-failed, plugin-became-unavailable, bare-multi-mp,             |       |
|  same-mp-both-scopes)                                                        |       |

Plugin-family aggregate V1 callsite count (all 5 plugin orchestrators)
after Plan 19-04 merge:

```
$ grep -rE "notify(Success|Warning|Error)\(" \
    extensions/pi-claude-marketplace/orchestrators/plugin/*.ts | wc -l
18
```

Pre-Plan-19-04: 25 V1 callsites (post-19-01: 25 = 30 original - 5 from
19-01). Net -7 in this plan (3 notifyError + 2 notifyWarning + 2
notifySuccess + 1 dispatch ternary that referenced both notifyWarning and
notifySuccess). The dispatch ternary is structurally a single reference to
both wrappers, so the actual grep count change is -7 (3 + 2 + 2 from
direct calls; the ternary is structurally retired but its `notifyWarning
/ notifySuccess` identifiers were inside the function body, counted by
grep). Plans 19-02 / 19-03 / 19-05 will close the remaining 18.

## Threat Flags

None. Per the plan's `<threat_model>` block, Phase 19 Plan 19-04 is an
internal API refactor:

- T-19-04-01 (information disclosure via cause-chain rendering): `accept` --
  V2 inherits the existing V1 cause-message behavior verbatim through the
  renderer.
- T-19-04-02 (notification flooding): `mitigate` -- V1 worst-case for bulk
  reinstall emitted cascade-body + manual-recovery anchor + per-plugin
  bridge warnings + per-plugin maintenance warnings (up to dozens for
  large cascades); V2 emits exactly 1 notification per orchestration.
- T-19-04-03 (severity manipulation): `mitigate` -- V1 dispatch ternary at
  reinstall.ts:543 is REMOVED. V2 severity is renderer-owned (D-16-11).
  Orchestrator cannot misclassify.
- T-19-04-04 (manual-recovery row misclassification): `mitigate` -- The
  literal status string `"manual recovery"` (WITH a space) is structurally
  constrained by `PluginManualRecoveryMessage` discriminated-union type at
  `shared/notify.ts:452-459`. TypeScript strict mode + the renderer's
  `assertNever` exhaustiveness gate catches any drift.

## Known Stubs

None. Every V2 emission constructs real `PluginReinstalledMessage` /
`PluginSkippedMessage` / `PluginFailedMessage` / `PluginManualRecoveryMessage`
payloads with all required fields populated from runtime state.

## Self-Check: PASSED

- File `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
  exists, compiles under strict TypeScript, passes ESLint + Prettier, and
  has the post-edit invariants confirmed by grep.
- File `tests/orchestrators/plugin/reinstall.test.ts` exists; 38/38 tests
  pass.
- Files `tests/edge/handlers/plugin/reinstall.test.ts` and
  `tests/edge/register.test.ts` updated in lockstep with the orchestrator's
  V2 byte boundary.
- `npm run check` exits 0 (typecheck + lint + format:check + 1363 pass / 0
  fail / 2 todo).
- Catalog UAT runner `tests/architecture/catalog-uat.test.ts` exits 0 with
  3/3 subtests passing (the 7 plugin-reinstall catalog states render
  byte-equal through the V2 renderer).
- Plan's verification invariants confirmed: V1-wrapper grep returns 0;
  recipe-block-comment grep returns 1; cascadeSummary / renderManualRecovery
  / dispatch-ternary greps return 0; manual-recovery status discriminator
  grep returns ≥2; V2 notify() callsite count = 5.
- Recipe block-comment present at `reinstall.ts:528-543` (11 verbatim recipe
  lines + 4-line reference = 16 total).
- No modifications to STATE.md, ROADMAP.md, or REQUIREMENTS.md (orchestrator
  owns those writes per `<parallel_execution>` rules).
