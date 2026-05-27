---
phase: 19-migration-wave-2-plugin-orchestrator-family
plan: 2
subsystem: plugin-orchestrator-migration
tags: [migration, v1-to-v2, wave-2, plan-19-02, install, plugin-family, rollback-partial]
requires:
  - phase: 19-01-uninstall-pilot
    provides: notification-message-cascade-recipe + wave-2-mirror-template-for-plugin-family
  - phase: 18-marketplace-orchestrator-family
    provides: postCommitWarnings-drop-precedent (D-18-01)
  - phase: 16-shared-notify-renderer
    provides: PluginInstalledMessage / PluginFailedMessage / PluginUnavailableMessage variants + renderer
provides:
  - install-ts-v2-migration
  - composeRollbackPartialBody-retirement
  - install-failure-three-branch-router (PathContainment / rollback-partial / entity-shape / generic-runtime)
  - cascade-caller-postCommitWarnings-audit (Open Question 1)
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - tests/orchestrators/plugin/install.test.ts
  - "Wave 2 sibling plans (19-03 list.ts / 19-04 reinstall.ts / 19-05 update.ts) -- structural template confirmed"
tech-stack:
  added: []
  patterns:
    - "Single V2 notify(ctx, pi, message) call per orchestration arm in standalone mode; orchestrated-mode return path unchanged"
    - "composeInstallFailureMessage helper: discriminated-branch dispatch returning PluginNotificationMessage union (failed / unavailable per classifier.status)"
    - "formatOrchestratedCause helper: preserves V1 D-CMC-12 string-cause contract for InstallPluginOutcome.cause via shared/errors.ts::causeChainTrailer (orchestrated-mode only; standalone-mode trailers emitted by V2 notify() from PluginFailedMessage.cause)"
    - "5 DROPPED post-state-commit warnings (mkdir / dropMarketplaceCache / agentForeignFailures / bridgeWarnings / PI-13 deps note) per D-19-01: try/catch (and for-loop) retained; side-effects still fire; orchestrated-mode postCommitWarnings.push branches preserved verbatim"
    - "RollbackPartial.cause?: Error threaded directly into PluginFailedMessage.rollbackPartial[i].cause -- NO synthesis from the free-form .msg per RESEARCH Finding 1"
    - "Entity-shape classifier discriminator (`failed` | `unavailable`) preserved verbatim through V2 notify() so catalog `failure-unsupported-features` byte form round-trips"
key-files:
  created:
    - .planning/phases/19-migration-wave-2-plugin-orchestrator-family/19-02-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - tests/orchestrators/plugin/install.test.ts
decisions:
  - "D-19-01 (DROP precedent): 5 post-state-commit notifyWarning sites DROPPED in standalone mode (mkdir / cache-refresh / agentForeignFailures / bridgeWarnings / PI-13 deps note). try/catch and for-loop preserved; only the user-visible warning surface gone. Orchestrated-mode postCommitWarnings.push preserved verbatim."
  - "D-19-02 (inline construction in orchestrator): no presentation/cascade-summary modifications; payloads built inline above each notify() call. Inline helper composeInstallFailureMessage stays in install.ts (single consumer)."
  - "D-19-03 (composeRollbackPartialBody retirement): V1 CMC-17 / MSG-RP-1 composer fully deleted. Three failure-path branches preserved as discriminated dispatch in composeInstallFailureMessage."
  - "D-19-06 (disjoint file pair): only install.ts + install.test.ts touched among orchestrators/tests. Wave 2 parallel-safe with 19-03 / 19-04 / 19-05."
  - "D-19-07 (test discipline): byte-exact V2 assertions through real notify() via existing makeCtx(); makeCtx() preserved verbatim; deleted assertions targeting dropped warnings (PI-13 + AS-6 + AS-7); severity assertions retain undefined/error form per D-16-11."
  - "D-15-01 + D-15-02 + D-16-08 + D-16-11 + D-16-12 + D-16-14 + D-16-15 (renderer-as-spec): orchestrator passes no severity / reload-hint / soft-dep markers; all derived structurally from PluginInstalledMessage.dependencies + PluginFailedMessage.cause + .rollbackPartial."
  - "Claude's Discretion -- RH-1 reload-hint noop-suppression flip: V2 emits the reload-hint structurally from `installed` status per D-16-12 even when stagedAny is false; the V1 noop-gate (suppress when nothing staged) is GONE. Mirrors the Plan 19-01 pilot's PU-8 (b) behavior change."
  - "Entity-shape classifier status preserved: classifier returns EntityErrorRow.status (`failed` | `unavailable`); install.ts emits PluginUnavailableMessage for `unavailable` and PluginFailedMessage for `failed`. This preserves catalog byte forms (`failure-unsupported-features` uses unavailable; `failure-rollback-partial` / `failure-runtime-with-cause` use failed) and is a CLAUDE'S-DISCRETION departure from the plan's strict 'always failed' wording (the plan also said 'or refactors classifyEntityShapeError to return readonly Reason[] directly -- Claude's Discretion'; this is the byte-equivalent path)."
  - "Open Question 1 (postCommitWarnings cascade-caller audit): orchestrators/import/execute.ts:890 consumes outcome.postCommitWarnings and injects each into its pushDiagnostic channel as a `post-install-warning` diagnostic. The diagnostic surface renders per-marketplace in the import cascade -- ORCHESTRATED MODE PRESERVES THE WARNINGS USER-VISIBLY. The standalone/orchestrated asymmetry is INTENTIONAL and consistent with D-19-01: standalone-mode drops; orchestrated-mode routes through the cascade's distinct diagnostic channel. No behavior change required in Plan 19-02."
metrics:
  duration: 27min
  completed: 2026-05-27
---

# Phase 19 Plan 2: `install.ts` V1 -> V2 Migration Summary

Migrates `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
from the V1 severity-named wrappers (`notifySuccess` + `notifyWarning` +
`notifyError`, 8 callsites) to the V2 structured entry point
`notify(ctx, pi, NotificationMessage)` (one call per orchestration arm in
standalone mode), retires the `composeRollbackPartialBody` rollback-partial
body composer entirely (D-19-03), and drops 5 post-state-commit
`notifyWarning` sites (D-19-01). Mirrors the Plan 19-01 pilot's
NotificationMessage cascade recipe via a single-line cross-reference
comment above the success-path `notify()` call.

## Performance

- **Duration:** 27 min
- **Started:** 2026-05-27T12:15:28Z
- **Completed:** 2026-05-27T12:42:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- 8 V1 callsites resolved: 3 migrated to V2 `notify()` (failure / internal-defensive / success arms); 5 DROPPED entirely per D-19-01 (mkdir / cache-refresh / agentForeignFailures / bridgeWarnings / PI-13 deps note).
- `composeRollbackPartialBody` (lines 821-881 in pre-migration source) fully deleted; V2 `PluginFailedMessage.rollbackPartial: readonly { phase; cause? }[]` is the structural replacement.
- `RollbackPartial.cause` typed `Error` threaded directly from the phase-ledger (no synthesis from `.msg`) per RESEARCH Finding 1.
- Entity-shape classifier status discriminator (`failed` | `unavailable`) preserved through V2 so all 5 catalog states (`success` / `success-with-soft-dep` / `failure-unsupported-features` / `failure-runtime-with-cause` / `failure-rollback-partial`) round-trip byte-exact.
- Orchestrated-mode `InstallPluginOutcome` contract preserved: `error` (typed Error) + `cause` (formatted string via `formatOrchestratedCause` using `shared/errors.ts::causeChainTrailer`). The import-cascade consumer at `orchestrators/import/execute.ts:890` is unchanged.
- `npm run check` GREEN at the atomic commit boundary (typecheck + lint + format:check + 1363/1365 tests pass / 0 fail / 2 todo -- identical to the Phase 18 baseline reported in Plan 19-01 SUMMARY).

## Task Commits

Each task is committed atomically per the parallel-executor contract:

1. **Task 1 + Task 2: install.ts + install.test.ts V1 -> V2 migration** -- one atomic commit (see Plan metadata commit below).

Plan 19-02 PLAN.md frontmatter `artifacts` block specifies `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` + `tests/orchestrators/plugin/install.test.ts` together; the verification step requires both to land at the same commit boundary so `npm run check` stays green end-to-end. Hence one combined commit rather than two.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
  - Drop V1 wrapper imports (`notifyError`, `notifySuccess`, `notifyWarning`) and presentation composer imports (`renderRow`, `appendReloadHint`, `reloadHint`, `causeChainTrailer`, `renderRollbackPartial`, `softDepStatus`).
  - Drop `PluginInlineRow`, `RollbackChild`, `SoftDepProbe` type imports (only `EntityErrorRow` retained -- the classifier shape).
  - Add `notify` from `../../shared/notify.ts` plus V2 type imports `Dependency` / `PluginFailedMessage` / `PluginInstalledMessage` / `PluginNotificationMessage` / `PluginUnavailableMessage`.
  - Add `causeChainTrailer` from `../../shared/errors.ts` (consumed only by the orchestrated-mode `formatOrchestratedCause` helper).
  - Delete `composeRollbackPartialBody` (definition + all call sites) per D-19-03; replace with V2 `PluginFailedMessage.rollbackPartial` threading.
  - Add `composeInstallFailureMessage` helper: discriminated-branch dispatch (PathContainment / rollback-partial / entity-shape failed-or-unavailable / generic-runtime) returning `PluginNotificationMessage`.
  - Add `formatOrchestratedCause` helper: preserves V1 D-CMC-12 string-cause contract for `InstallPluginOutcome.cause` via `shared/errors.ts::causeChainTrailer`.
  - Replace V1 failure-path catch (lines 660-688 pre-migration) with one V2 `notify()` call + the discriminated helper.
  - Replace V1 internal-error defensive arm (line 700 pre-migration) with one V2 `notify()` call carrying a synthetic `PluginFailedMessage`.
  - Replace V1 success-path emission (lines 768-810 pre-migration) with one V2 `notify()` call carrying a `PluginInstalledMessage` whose `dependencies: readonly Dependency[]` is derived from `installCtx.stagedAgentNames` / `installCtx.stagedMcpServerNames`.
  - Drop 5 post-state-commit standalone-mode `notifyWarning` lines (mkdir / cache-refresh / agentForeignFailures / bridgeWarnings / PI-13 deps note). Surrounding `try/catch` (and `for`-loop for bridgeWarnings) retained with D-19-01 explanatory comments. Orchestrated-mode `postCommitWarnings.push(msg)` branches preserved verbatim (4 surfaces -- PI-13 was standalone-mode-only).
  - Add a single-line reference comment cross-linking the Plan 19-01 recipe location at `orchestrators/plugin/uninstall.ts` above the V2 success-path `notify()` call (no 10-line recipe duplication; the recipe lives in uninstall.ts).
- `tests/orchestrators/plugin/install.test.ts`
  - V2 byte-string flips for the 5 catalog states (`success` / `success-with-soft-dep` / `failure-unsupported-features` / `failure-runtime-with-cause` / `failure-rollback-partial`).
  - Renamed tests to drop V1 surface references (`-> notifyError ...` becomes `-> V2 failed/{...}` etc.).
  - PI-9 (success arm) byte-exact: full marketplace-header + plugin-row + reload-hint trailer with soft-dep markers (`{requires pi-subagents, requires pi-mcp}` because the default `makeCtx()` mock has nothing loaded).
  - PI-3 / PI-3b / PI-5 (entity-shape `failed`) byte-exact: marketplace header + indented `⊘ <plugin> (failed) {<reason>}` + 4-space-indent `cause:` trailer. No version slot because the early-sanity / not-in-manifest throws pre-date `resolvePluginVersion` (`failureVersion === undefined`).
  - PI-4 (entity-shape `unavailable`) byte-exact: marketplace header + indented `⊘ <plugin> (unavailable) {unsupported source}`. Severity flipped to `undefined` (info) per D-16-11 (only `failed` discriminator triggers `error` severity in V2); no `cause:` trailer per D-15-01/SNM-10 (`unavailable` has no `cause?` field).
  - PI-9 corollary (noop install) flipped: V2 emits the `/reload to pick up changes` trailer structurally from the `installed` status per D-16-12 even when no resources were staged. This is the V1->V2 behavior change documented in Plan 19-02 (Claude's Discretion + mirrors Plan 19-01 pilot's PU-8 (b) flip).
  - AS-6 / AS-7 / PI-13: warning assertions DELETED per D-19-01; replaced with defense-in-depth `assert.equal(..., false)` checks confirming the dropped phrases do NOT appear on the V2 notification surface. `notifications.length` flipped from 2 to 1 on PI-13.
  - CMP-3 / CMP-4 / PI-17 byte forms flipped to V2 (regex updated to match the marketplace-header + indented-plugin-row shape).
  - `makeCtx()` preserved verbatim per D-19-07 inheriting D-18-06.

## Decisions Made

See frontmatter `decisions` block. Key load-bearing decisions:

1. **`PluginUnavailableMessage` vs `PluginFailedMessage` for entity-shape errors** (Claude's Discretion): The plan's D-19-03 wording specified `status: "failed"` for all three entity-shape branches. But the catalog `failure-unsupported-features` state binds the byte form `(unavailable) {hooks, lspServers}` -- emitted only by `PluginUnavailableMessage`. The catalog UAT fixture at `tests/architecture/catalog-uat.test.ts:457-474` uses `status: "unavailable"`. Preserving the classifier's `EntityErrorRow.status` discriminator and routing to the matching V2 variant resolves the inconsistency byte-equivalently. The plan explicitly granted Claude's Discretion here ("or refactors classifyEntityShapeError to return readonly Reason[] directly -- Claude's Discretion").
2. **RH-1 reload-hint noop-suppression flip** (Claude's Discretion): Always emit `plugins: [installedRow]`; let the renderer emit the reload-hint structurally on the `installed` status per D-16-12. The V1 RH-1 noop-gate is gone in V2, mirroring the Plan 19-01 pilot's PU-8 (b) behavior change. `InstallPluginOutcome.resourcesChanged` still tracks staged-or-not for cascade consumers (no functional regression).
3. **`composeInstallFailureMessage` helper inline in install.ts** (D-19-02 honored): The discriminated dispatch is install.ts-specific (single consumer per D-01 corollary "second-consumer rule"); no presentation/cascade-summary modifications.
4. **`formatOrchestratedCause` uses `shared/errors.ts::causeChainTrailer`** (lint compliance): Initially drafted a hand-rolled depth-5 walker; ESLint's `msg/msg-cc-1-cause-chain` rule caught the hand-composed `cause:` literal and required routing through the canonical walker. Verified `causeChainTrailer` is the correct entry per the rule's error message; presentation/cause-chain.ts is a re-export of the same function so the lint-recommended `presentation/cause-chain.ts::renderCauseChain` path is byte-equivalent. Used `shared/errors.ts` directly to avoid re-introducing a `presentation/*` import.

## Cascade-Caller postCommitWarnings Audit (RESEARCH Open Question 1)

Audit per Task 1 step 7:

```
$ grep -rEn "postCommitWarnings" extensions/pi-claude-marketplace/orchestrators/
extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:134:      readonly postCommitWarnings?: readonly string[];
extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:182: *   outcome, and collects post-commit warnings in `outcome.postCommitWarnings`.
extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:711:  const postCommitWarnings: string[] = [];
extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:823:      postCommitWarnings.push(msg);
extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:843:      postCommitWarnings.push(msg);
extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:863:      postCommitWarnings.push(msg);
extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:875:      postCommitWarnings.push(w);
extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:944:    ...(postCommitWarnings.length > 0 && { postCommitWarnings }),
extensions/pi-claude-marketplace/orchestrators/import/execute.ts:890:        for (const w of outcome.postCommitWarnings ?? []) {
```

The sole cascade-caller consumer is `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:890`:

```typescript
// Surface any post-commit warnings collected in orchestrated mode.
for (const w of outcome.postCommitWarnings ?? []) {
  pushDiagnostic(result, plugin.scope, "post-install-warning", w, {
    ref: refLabel(plugin),
  });
}
```

The cascade caller INJECTS each warning into its `pushDiagnostic` channel as a `"post-install-warning"` diagnostic. The diagnostic surface renders per-marketplace inside the import cascade's `orphanDiagnosticLines` / per-marketplace block rendering -- **orchestrated mode surfaces the warnings user-visibly via a distinct channel** (NOT the V2 `notify()` channel, but the import cascade's diagnostic block channel).

**Standalone/orchestrated asymmetry summary:**
- Standalone-mode: 5 post-success warnings DROPPED entirely in V2 per D-19-01 (no user-visible surface).
- Orchestrated-mode: 4 post-success warnings (PI-13 was standalone-only) routed through the import cascade's distinct `pushDiagnostic("post-install-warning", ...)` channel which surfaces per-marketplace.

The asymmetry is INTENTIONAL and consistent with D-19-01: standalone-mode and orchestrated-mode use different rendering channels (V2 `notify()` for standalone; import cascade's diagnostic block for orchestrated), and only the V2 `notify()` channel has the structural limitation that there's "no clean MarketplaceNotificationMessage representation for soft warning after successful state mutation". The cascade's diagnostic channel preserves the warning surface where it makes architectural sense to do so. **No behavior change required in Plan 19-02.** A future Phase 20+ could revisit unification (e.g., extend `MarketplaceNotificationMessage` with a `postCommitWarnings?: readonly string[]` field) but Plan 19-02's scope is install.ts standalone-mode only.

## Verification

### Plan invariants

| Check                                                                                                            | Expected   | Actual    |
| ---------------------------------------------------------------------------------------------------------------- | ---------: | --------: |
| `grep -cE "notify(Success\|Warning\|Error)\(" extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`  | 0          | 0         |
| `grep -c "composeRollbackPartialBody" extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`          | 0          | 0         |
| `grep -c "new Error(p\.msg)" extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`                   | 0          | 0         |
| `grep -c "postCommitWarnings\.push" extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`            | 4          | 4         |
| `grep -c 'from "\.\./\.\./presentation/' extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`       | 0 or bounded | 1 (EntityErrorRow type only -- non-notify utility, allowed per plan audit clause) |
| `grep -c "cache refresh deferred" tests/orchestrators/plugin/install.test.ts`                                    | 0          | 0         |
| `grep -c "notifications\.length, [2-9]" tests/orchestrators/plugin/install.test.ts`                              | 0          | 0         |

### Test pipeline

```
$ node --test tests/orchestrators/plugin/install.test.ts
# tests 40
# pass 40
# fail 0

$ node --test tests/architecture/catalog-uat.test.ts
# tests 3
# pass 3
# fail 0

$ npm run check
typecheck     PASS
lint          PASS
format:check  PASS
test          1365 tests / 1363 pass / 0 fail / 2 todo (identical to Phase 18 baseline)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint MSG-CC-1 lint rule on hand-composed cause-chain literal**

- **Found during:** Task 1 (`npm run check` after first pass)
- **Issue:** Initial draft of `formatOrchestratedCause` hand-rolled a depth-5 recursive walker that built strings of the form `cause: <text>`. ESLint's `msg/msg-cc-1-cause-chain` lint rule flagged this as a hand-composed cause-chain literal: "MSG-CC-1: hand-composed `cause:` chain literal detected; route through `causeChainTrailer` (shared/errors.ts) or `renderCauseChain` (presentation/cause-chain.ts) per docs/messaging-style-guide.md §9".
- **Fix:** Replaced the hand-rolled walker with a direct call to `causeChainTrailer` from `shared/errors.ts` (the canonical depth-5 walker). Removed the inner recursive helper entirely. `formatOrchestratedCause` is now a 3-line composition: `errorMessage(err)` + `causeChainTrailer(err)` joined with a blank line when present.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
- **Verification:** `npm run check` GREEN end-to-end after the fix.
- **Committed in:** This plan's atomic commit (Task 1 + Task 2 land together).

**2. [Rule 3 - Blocking] Prettier formatting on test file**

- **Found during:** Task 2 (`npm run check` after byte-form rewrites)
- **Issue:** The multi-line `assert.equal` calls with template-concatenation across multiple lines needed Prettier-canonical formatting (specific brace placement + arrow function indents).
- **Fix:** `npx prettier --write tests/orchestrators/plugin/install.test.ts` collapsed the formatting to the canonical form.
- **Files modified:** `tests/orchestrators/plugin/install.test.ts`
- **Verification:** `npm run format:check` GREEN after the fix.
- **Committed in:** This plan's atomic commit.

### Behavior changes documented in the plan (not deviations)

**1. PI-4 severity flip (info instead of error)**

PI-4 (non-path source) in V1 surfaced via `notifyError` (severity `"error"`). In V2 the entity-shape classifier returns `EntityErrorRow.status === "unavailable"`; install.ts emits `PluginUnavailableMessage`. The V2 severity derivation per D-16-11 returns `undefined` (info) because `unavailable` is NOT in the error-severity set -- only the `failed` discriminator triggers `error`. The catalog confirms: `docs/output-catalog.md:295-302` shows no severity annotation for `failure-unsupported-features`, while `failure-runtime-with-cause` / `failure-rollback-partial` explicitly note `Severity: error`. The test assertion was flipped from `"error"` to `undefined` to match the V2 contract. **Not a deviation -- this is the V1->V2 behavior shift the catalog binding requires.**

**2. PI-3 / PI-5 entity-shape version-slot drop**

PI-3 / PI-5 in V1 used regex `/⊘ <plugin>@<marketplace> \[<scope>\] \(failed\) \{...\}/` without asserting a `v<version>` slot. In V2 the byte-exact assertion shows no `v<version>` on these rows because the entity-shape throws (not-in-manifest / already-installed) pre-date `resolvePluginVersion`, leaving `failureVersion === undefined`. The V2 renderer's `renderVersion(undefined)` returns the empty token, which the `joinTokens` filter drops. The byte form is `⊘ <plugin> (failed) {<reason>}\n    cause: ...` (no version). **Not a deviation -- the V1 regex was lenient enough not to expose this; the V2 byte-exact assertion makes it explicit.**

**3. PI-9 corollary reload-hint flip (mirrors Plan 19-01 pilot PU-8 (b))**

The V1 contract (RH-1) suppressed the reload-hint when no resources were staged. V2 emits the trailer structurally from the `installed` status per D-16-12 -- the trigger ladder is per-variant, not per-cascade-outcome resource count. The PI-9-corollary test's assertion is flipped to expect the trailer. **Not a deviation -- this is the V1->V2 behavior shift the plan explicitly requires (Claude's Discretion per CONTEXT line 110 + RESEARCH Open Question 3) and mirrors the Plan 19-01 pilot's PU-8 (b) flip documented in Phase 19 Plan 1 SUMMARY.**

### Other deviations

None. All other plan steps executed verbatim.

## Authentication Gates

None.

## V1 -> V2 Migration Status (install.ts only)

| Status                                                          | Count |
| --------------------------------------------------------------- | ----: |
| V1 wrapper callsites remaining in install.ts                    | 0     |
| V2 `notify()` callsites in install.ts (standalone mode)         | 3 (failure / internal-defensive / success) |
| `presentation/*` imports remaining in install.ts                | 1 (`EntityErrorRow` type only -- non-notify utility) |
| V1 wrapper callsites DROPPED entirely per D-19-01               | 5 (mkdir / cache-refresh / agentForeignFailures / bridgeWarnings / PI-13 deps note) |
| `composeRollbackPartialBody` lines deleted                      | 38 (definition + helper docstring; lines 821-881 pre-migration) |
| Catalog UAT plugin-install fixtures still GREEN                 | 5/5 (success / success-with-soft-dep / failure-unsupported-features / failure-runtime-with-cause / failure-rollback-partial) |

Plugin-family aggregate V1 callsite count (all 5 plugin orchestrators):

```
$ grep -rE "notify(Success|Warning|Error)\(" \
    extensions/pi-claude-marketplace/orchestrators/plugin/*.ts | wc -l
17
```

Pre-Plan-19-02 (post-Plan-19-01): 25 V1 callsites. Net -8 in this plan (3 migrated + 5 dropped in install.ts). Plans 19-03 / 19-04 / 19-05 will close the remaining 17 (3 list.ts + 7 reinstall.ts + 7 update.ts).

## Threat Flags

None. Per the plan's `<threat_model>` block, Phase 19 Plan 19-02 is an internal API refactor:

- T-19-02-01 (cause-chain information disclosure): `accept` -- V2 inherits the existing V1 cause-message behavior verbatim via `causeChainTrailer`; the depth-5 walk (MSG-CC-1) applies at the same indent. No new disclosure.
- T-19-02-02 (notification flooding): `mitigate` -- V2 emits exactly one notification per orchestration arm in standalone mode (worst-case V1 install emitted success + 5 dropped warnings = 6 notifications; V2 emits 1).
- T-19-02-03 (severity manipulation): `mitigate` -- V2 `notify(ctx, pi, message)` signature has no severity argument; renderer-derived per D-16-11. The PI-4 severity flip (`error` -> `undefined` for unavailable) is a documented V1->V2 behavior shift driven by the catalog binding, not a security regression.
- T-19-02-04 (cause masking / silent error suppression): `mitigate` -- the 5 DROPPED warning sites preserve the surrounding `try { sideEffect(); } catch (...) { if (orchestrated) postCommitWarnings.push(msg); /* else: D-19-01 silent */ }` shape. The side-effect call still throws and is still caught; orchestrated-mode still observes the error via `postCommitWarnings`. Tests assert on `loadState` + the agents-index file to verify the underlying side effects still execute.

## Known Stubs

None. The V2 emissions construct real `PluginInstalledMessage` / `PluginFailedMessage` / `PluginUnavailableMessage` payloads with all required fields populated from runtime state.

## Self-Check: PASSED

- File `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` exists, compiles under strict TypeScript, and passes ESLint + Prettier.
- File `tests/orchestrators/plugin/install.test.ts` exists and 40/40 tests pass.
- `npm run check` exits 0 (typecheck + lint + format:check + 1363 pass / 0 fail / 2 todo -- identical to the Phase 18 baseline).
- Catalog UAT runner `tests/architecture/catalog-uat.test.ts` exits 0 with 3/3 subtests passing (byte-equality through real `notify()` is preserved end-to-end for the 5 plugin-install fixtures).
- Plan's verification invariants confirmed: V1-wrapper grep returns 0; `composeRollbackPartialBody` grep returns 0; `new Error(p.msg)` grep returns 0; `postCommitWarnings.push` grep returns 4; presentation/* import grep returns 1 (audited and bounded to the non-notify `EntityErrorRow` type utility per plan audit clause).
- Cascade-caller postCommitWarnings audit (RESEARCH Open Question 1) documented above: `orchestrators/import/execute.ts:890` is the sole consumer; the asymmetry is intentional per D-19-01.
- Claude's Discretion (CONTEXT line 110) for RH-1 reload-hint noop-suppression flip documented: V2 emits the trailer structurally on `installed`; the V1 noop-gate is gone.
- Reference comment cross-linking the Plan 19-01 recipe at `orchestrators/plugin/uninstall.ts` is present at the V2 success-path `notify()` call (single line, not the 10-line recipe which lives only in the pilot).
- No modifications to STATE.md, ROADMAP.md, or REQUIREMENTS.md (orchestrator owns those writes per `<parallel_execution>` rules).

## Next Phase Readiness

- Wave 2 sibling plans (19-03 list.ts / 19-04 reinstall.ts / 19-05 update.ts) can mirror this plan's structural template:
  - Single V2 `notify(ctx, pi, ...)` call per orchestration arm.
  - Inline `compose...FailureMessage` discriminated dispatch helper local to the orchestrator.
  - Inline `formatOrchestrated...` helper for orchestrated-mode `outcome.cause` preservation via `shared/errors.ts::causeChainTrailer` (lint-compliant).
  - DROPPED post-state-commit warnings per D-19-01; orchestrated-mode `postCommitWarnings.push` branches preserved verbatim.
  - Entity-shape classifier discriminator (`failed` | `unavailable` | `skipped` | `manual recovery`) preserved verbatim so catalog byte forms round-trip.
- After Plan 19-05 merges, Phase 19 closes with 0 V1 callsites in `orchestrators/plugin/*.ts`. Phase 21 will delete the V1 wrappers and `presentation/*` composers globally.

---
*Phase: 19-migration-wave-2-plugin-orchestrator-family*
*Plan: 02*
*Completed: 2026-05-27*
