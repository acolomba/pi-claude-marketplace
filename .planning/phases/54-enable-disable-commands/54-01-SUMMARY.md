---
phase: 54-enable-disable-commands
plan: 01
subsystem: orchestrators
tags: [reconcile, planner, enable-disable, tdd-scaffold, architecture-gate]

# Dependency graph
requires:
  - phase: 53-pure-reconcile-planner
    provides: planReconcile pure 7-bucket diff with structurally-empty pluginsToEnable hand-off slot (Pitfall 53-4)
provides:
  - isRecordedButDisabled predicate gating on empty-resources marker AND installable:true (A1)
  - DeclaredPluginAccumulator.enable bucket + PluginDiff.enable field
  - pluginsToEnable wired into planReconcile return (replaces Phase 53 placeholder [])
  - Empty-plan fast path includes totalEnables in the zero-sum check
  - FORBIDDEN_TARGETS entry for orchestrators/plugin/enable-disable.ts (NFR-5 gate armed for Plan 02)
  - Wave 0 RED scaffolds for tests/orchestrators/plugin/enable-disable.test.ts (11 skipped) + tests/edge/handlers/plugin/enable-disable.test.ts (5 skipped)
affects: 54-02-PLAN (enable-disable orchestrator + edge handler + catalog amendment), 55 (load-time reconcile apply consuming pluginsToEnable bucket)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 4 (Plan 01): empty-resources arrays + compatibility.installable === true as the implicit 'currently disabled' marker (SPLIT-01 preserved -- no new schema field)"
    - "Wave 0 RED scaffold: dynamic import() inside skipped test bodies preserves the 'source missing -> tests RED' sentinel while keeping the Wave 1 load-time path GREEN under node --test"

key-files:
  created:
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/edge/handlers/plugin/enable-disable.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - tests/architecture/no-orchestrator-network.test.ts
    - tests/orchestrators/reconcile/plan.test.ts

key-decisions:
  - "D-54-01-A: isRecordedButDisabled gates on compatibility.installable === true in addition to the four-empty-resources check. Without the installable guard the convergence proof in plan-convergence.test.ts misclassifies the populated fixture's `soft-degraded` entry (installable: false, all four resources empty) as pluginsToEnable, breaking the Phase 52 SC#4 no-op proof. The guard is load-bearing (Rule 2 deviation from the plan's literal behavior block)."
  - "D-54-01-B: Wave 0 RED scaffolds use dynamic await import(...) inside skipped test bodies instead of static top-level @ts-expect-error imports. Static imports would crash the test file at load time under node --test (ERR_MODULE_NOT_FOUND) BEFORE test.skip suppression takes effect, RED-failing the Wave 1 suite. Dynamic imports inside skipped bodies preserve the architectural sentinel (Plan 02's source file landing = test files load; missing = bodies fail when un-skipped) without breaking Wave 1 (Rule 3 deviation)."
  - "D-54-01-C: Existing stateWithOneGithubMarketplace / stateWithOnePathMarketplace test helpers updated to populate resources.skills = ['s1'] for non-disabled fixtures. The previous all-empty pattern accidentally collided with the new isRecordedButDisabled predicate. Helpers now document the contract: non-empty resources = installed-and-enabled; the new stateWithDisabledRecord helper carries the all-empty + installable:true shape for explicit disabled-state tests."

patterns-established:
  - "Pitfall 54-6 (Plan 01): install/enable mutual exclusion proven structurally -- the !recorded branch returns before the enable branch executes, so no single plugin can land in both pluginsToInstall and pluginsToEnable in the same planner pass."

requirements-completed: [ENBL-02]

# Metrics
duration: ~21min
completed: 2026-06-10
---

# Phase 54 Plan 01: Wave 1 byte-neutral planner foundation Summary

**isRecordedButDisabled predicate (empty-resources + installable:true marker) wires pluginsToEnable from Phase 53's structurally-empty placeholder into a real bucket; NFR-5 network gate armed for Plan 02's orchestrator file; Wave 0 RED scaffolds (16 skipped tests) landed for Plan 02 to fill in lockstep.**

## Performance

- **Duration:** ~21 min
- **Started:** 2026-06-10T18:21:12Z
- **Completed:** 2026-06-10T18:42:13Z
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `isRecordedButDisabled(record): boolean` predicate added to `orchestrators/reconcile/plan.ts` reading the empty-resources marker (all four `resources.{skills,prompts,agents,mcpServers}.length === 0`) AND `record.compatibility.installable === true` -- the latter is the D-54-01-A load-bearing guard that preserves the Phase 52 SC#4 convergence proof for soft-degraded fixture entries (see Decisions Made).
- `DeclaredPluginAccumulator` and `PluginDiff` interfaces extended with the `enable` bucket; `classifyDeclaredPlugin` re-routes the recorded + declared-enabled branch through `isRecordedButDisabled` so the enable bucket fires when the marker matches and stays empty otherwise (steady-state preserved).
- `planReconcile` return swaps the Phase 53 placeholder `pluginsToEnable: []` for `pluginDiff.enable`; the empty-plan fast path now sums `totalEnables` so a back-to-back zero-action plan still short-circuits to `emptyReconcilePlan(scope)`.
- `tests/architecture/no-orchestrator-network.test.ts` `FORBIDDEN_TARGETS` extended with `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`; the ENOENT-skip path keeps the gate GREEN until Plan 02 creates the file (at which point the gate activates structurally and would RED-fail any `platform/git` / `gitOps` / `refreshGitHubClone` import).
- `tests/orchestrators/reconcile/plan.test.ts` extended with 5 new tests proving the new branch: ENBL-02 (a) recorded + empty-resources + enabled!==false -> enable bucket non-empty; (b) recorded + non-empty resources -> enable empty (steady state); (c) recorded + empty + enabled===false -> disable bucket (NOT enable); (d) NOT recorded + enabled!==false -> install ONLY, Pitfall 54-6 mutual-exclusion proof; (e) back-to-back same-input call returns deepEqual plans (purity preserved across the new branch).
- Two Wave 0 RED scaffolds landed: `tests/orchestrators/plugin/enable-disable.test.ts` (11 `test.skip` blocks covering 10 ENBL behaviors + Pitfall 54-5 --local file isolation) and `tests/edge/handlers/plugin/enable-disable.test.ts` (5 `test.skip` blocks covering 3 USAGE + 2 flag-forwarding behaviors). Each skipped body is `assert.fail("Plan 02 implements this -- ...")` so accidentally un-skipping in Wave 1 RED-fails loudly.
- Phase 53 hand-off TODO comments removed from the planner header (per source-comment-cleanup-policy memory: history lives in git, not comments). The new docstring credits the hand-off as closed in Phase 54 (ENBL-02 / isRecordedButDisabled).

## A1 Verification (plan output requirement)

A1 confirmation: read of `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` lines 615-664 confirmed `statePhase` is the ONLY code path that writes `resources.*` arrays. The phase copies from `c.stagedXxxNames` which the resolver populates from the plugin's component lists. The `requireInstallable` gate in the resolver rules out the zero-component installable degenerate, so an INSTALLABLE plugin always lands with at least one populated array.

CAVEAT discovered during execution: a **soft-degraded** (`installable: false`) plugin -- e.g. one whose companion extension is missing -- legally records all four `resources.*` arrays empty (the bridge phases skip when the resolver did not stage anything for them). The populated fixture at `tests/persistence/fixtures/legacy/state-populated-mixed.json` proves this: its `soft-degraded` entry has `installable: false` and all four arrays empty. Without the `installable === true` guard, the convergence proof in `tests/orchestrators/reconcile/plan-convergence.test.ts` would misclassify that entry as `pluginsToEnable` and BREAK the Phase 52 SC#4 no-op proof. The guard is therefore load-bearing -- recorded as D-54-01-A.

The plan's `<behavior>` block said `isRecordedButDisabled(record)` returns true iff the four `resources.*` lengths are zero (no installable check). The actual implementation widens this to: `record.compatibility.installable && all four lengths === 0`. Same end-state for the empty-bucket case Plan 02 will write through (Plan 02's disable orchestrator empties all four arrays while keeping `installable: true`), so the user-contract is unchanged; only the soft-degraded edge case is now handled correctly.

## A6 Verification (plan output requirement)

Read of `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:66-83` was deferred to Plan 02. The plan's `<output>` block lists A6 as a Plan 01 requirement, but A6's claim concerns `loadConfig` placement INSIDE `withStateGuard` -- a Plan 02 concern (Plan 01 ships zero orchestrator code that calls `loadConfig` under a state guard). Recording the deferral: Plan 02's orchestrator MUST honor Pitfall 54-1 by reading `loadConfig` inside the `withStateGuard` closure (fail-fast on contention; loser retries; no stale-snapshot retry). Plan 02 owns the A6 read and the lock-discipline implementation in lockstep.

## Bytes-touched table

| File | Lines added / removed | What |
|------|----------------------|------|
| `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` | +60 / -16 | Header docstring rewritten; `PlannedPluginEnable` import added; `isRecordedButDisabled` predicate (32 lines incl. docstring); `DeclaredPluginAccumulator.enable` field; `PluginDiff.enable` field; `state` parameter threaded through `classifyDeclaredPlugin`; recorded + declared-enabled branch split on the predicate; `planReconcile` fast-path includes `totalEnables`; `pluginsToEnable: pluginDiff.enable` wiring |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` | +9 / -7 | `PlannedPluginEnable` docstring updated to describe the empty-resources + installable:true marker (replaces "structurally empty in Phase 53" prose) |
| `tests/architecture/no-orchestrator-network.test.ts` | +5 / -0 | `enable-disable.ts` added to `FORBIDDEN_TARGETS` with Phase 54 / Pitfall 54-3 / ENBL-03 inline credit |
| `tests/orchestrators/reconcile/plan.test.ts` | +131 / -10 | 5 new ENBL-02 tests; new `stateWithDisabledRecord` helper; existing `stateWithOneGithubMarketplace` / `stateWithOnePathMarketplace` helpers updated to populate `resources.skills = ["s1"]` for installed-and-enabled fixtures with an inline contract comment; one prose-only update to the Pitfall 53-4 test |
| `tests/orchestrators/plugin/enable-disable.test.ts` | +137 (new file) | 11 `test.skip` blocks covering 10 ENBL behaviors + Pitfall 54-5 --local file isolation; dynamic import sentinel + header docstring |
| `tests/edge/handlers/plugin/enable-disable.test.ts` | +80 (new file) | 5 `test.skip` blocks covering 3 USAGE + 2 flag-forwarding behaviors; dynamic import sentinel + header docstring |

## Plan 02 hand-off

The orchestrator + edge handler + token lockstep is the next plan. The import sentinels in the Wave 0 scaffolds (dynamic `await import(...)` paths) + the `FORBIDDEN_TARGETS` entry will RED-fail the moment Plan 02 ships:

- Plan 02 creates `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` and `extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts`. The architectural gate activates structurally (the ENOENT-skip path no longer fires for the orchestrator) and would RED-fail any `platform/git` / `gitOps` / `refreshGitHubClone` import in `enable-disable.ts`. NFR-5 / Pitfall 54-3 enforced.
- Plan 02 replaces each scaffold's `await import(ENABLE_DISABLE_*_PATH)` with a STATIC top-level import (`import { setPluginEnabled } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"`) in lockstep with the new source files. Flips `test.skip(...)` -> `test(...)` for each behavior.
- Plan 02's `pluginsToEnable` bucket now produces real rows from this plan's planner change. The notify projection + renderer + catalog amendments (token `(enabled)` / `(disabled)`; ENBL-04 list/info visibility of declared/enabled/available facts) land in the same atomic commit as the orchestrator (Pitfall 54-2 atomic-supersession discipline; v1.3 / v1.10 / v1.11 / Phase 53 lineage).
- Plan 02 honors Pitfall 54-1 by reading `loadConfig` INSIDE the `withStateGuard` closure (A6 read deferred from Plan 01 -- see A6 Verification above).

## Decisions Made

- **D-54-01-A: isRecordedButDisabled gates on `compatibility.installable === true`.** The plan's literal behavior block specified only the four-empty-resources check. During verification the convergence proof in `plan-convergence.test.ts` FAILED because the populated fixture's `soft-degraded` entry (`installable: false`, all four resources empty) was misclassified as `pluginsToEnable`. The `installable === true` guard is therefore load-bearing for the Phase 52 SC#4 no-op proof. No user-contract impact: Plan 02's disable orchestrator empties all four arrays while keeping `installable: true`, so a properly-disabled plugin still matches the predicate.
- **D-54-01-B: Wave 0 RED scaffolds use dynamic `await import(...)` inside skipped test bodies.** The plan's literal action specified static top-level `import` guarded by `@ts-expect-error`. Under `node --test` the native-TS-strip loader resolves imports eagerly at file-load time and the missing source file would crash the test file with `ERR_MODULE_NOT_FOUND` BEFORE `test.skip` suppression. Dynamic imports inside skipped bodies preserve the sentinel ("source missing in Plan 02 -> tests RED") without breaking Wave 1. Plan 02 swaps to static imports in lockstep with the source file creation.
- **D-54-01-C: Existing test helpers populated with non-empty resources.** The previous `stateWithOneGithubMarketplace` / `stateWithOnePathMarketplace` helpers built records with all-empty `resources.*` arrays. Under the new predicate that pattern accidentally collides with "currently disabled". The helpers now populate `resources.skills = ["s1"]` to represent the steady-state "installed and enabled" shape; the new `stateWithDisabledRecord` helper carries the disabled shape explicitly. Inline contract comment added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / Rule 2 - Missing Critical] isRecordedButDisabled also requires `compatibility.installable === true`**
- **Found during:** Task 1 verification (npm test surfaced 2 failures in plan-convergence.test.ts after the GREEN implementation)
- **Issue:** The plan's literal behavior block defined `isRecordedButDisabled(record)` as the four-way AND of resources lengths === 0. The populated fixture at `tests/persistence/fixtures/legacy/state-populated-mixed.json` contains a `soft-degraded` plugin entry with `installable: false` AND all four resources arrays empty (a legitimate soft-degraded state when the companion extension is missing). Without the installable guard the convergence proof `planReconcile(mergeScopeConfigs(buildConfigFromState(state), {}), state, scope) deepEqual emptyReconcilePlan(scope)` failed because the soft-degraded entry was being placed in `pluginsToEnable`.
- **Fix:** Added `record.compatibility.installable &&` as the first conjunct of the predicate. Docstring updated to credit the load-bearing guard + Phase 52 SC#4 convergence proof as the verification anchor.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`
- **Verification:** `tests/orchestrators/reconcile/plan-convergence.test.ts` both project + user variants GREEN; the 5 new ENBL-02 tests GREEN; the Phase 52 SC#4 no-op proof preserved.
- **Committed in:** part of the single Plan 01 atomic commit.

**2. [Rule 3 - Blocking] Wave 0 RED scaffolds use dynamic import() instead of static @ts-expect-error imports**
- **Found during:** Task 2 (writing the scaffold files)
- **Issue:** The plan's literal action specified a static top-level `import { setPluginEnabled } from "...enable-disable.ts"` guarded by `@ts-expect-error`. Under `node --test` (the test runner used by `npm test`) the native-TS-strip loader resolves all top-level imports eagerly at file-load time. A static import of a non-existent `.ts` source file crashes the entire test file with `ERR_MODULE_NOT_FOUND` BEFORE any `test.skip` suppression can take effect. This would RED-fail the Wave 1 suite immediately, breaking the plan's success criterion that `npm run check` stays GREEN.
- **Fix:** Switched to a constant string path + dynamic `await import(...)` inside each skipped test body. The skipped bodies never execute the import in Wave 1, so the file loads cleanly. Plan 02 replaces each `await import(...)` with a static top-level `import` (and flips `test.skip(...)` -> `test(...)`) in lockstep with the new source file. The architectural sentinel is preserved: if Plan 02 forgets the source file, the static import will fail at file-load time and the suite RED-fails. Header docstring documents the substitution and gives Plan 02 the exact replacement instructions.
- **Files modified:** `tests/orchestrators/plugin/enable-disable.test.ts`, `tests/edge/handlers/plugin/enable-disable.test.ts`
- **Verification:** `npm test -- tests/orchestrators/plugin/enable-disable.test.ts tests/edge/handlers/plugin/enable-disable.test.ts` GREEN with 16 skipped, 0 failures; `npm run typecheck` GREEN; `npm run check` GREEN end-to-end.
- **Committed in:** part of the single Plan 01 atomic commit.

**3. [Rule 1 - Bug] Existing test helpers updated to populate `resources.skills = ["s1"]`**
- **Found during:** Task 1 verification (the GREEN implementation also broke 3 existing tests in `plan.test.ts` whose fixtures had all-empty resources arrays as the "default installed" shape)
- **Issue:** The existing helpers `stateWithOneGithubMarketplace` and `stateWithOnePathMarketplace` built records with all-empty `resources.*` arrays. Under the new predicate that shape unambiguously matches "currently disabled" (for an installable plugin), so 3 existing tests asserting steady-state behavior failed: "Plugin cell (declared+enabled-true, recorded): NO action (steady state)" and 2 others.
- **Fix:** Both helpers now populate `resources.skills = ["s1"]` to represent a properly-installed, steady-state plugin. Inline contract comment added pointing readers to the new `stateWithDisabledRecord` helper for explicit disabled-state tests.
- **Files modified:** `tests/orchestrators/reconcile/plan.test.ts`
- **Verification:** All pre-existing tests in `plan.test.ts` GREEN; the 5 new ENBL-02 tests GREEN.
- **Committed in:** part of the single Plan 01 atomic commit.

**4. [Rule 1 - Bug / lint] isRecordedButDisabled: dropped `=== true` literal comparison after typecheck flagged @typescript-eslint/no-unnecessary-boolean-literal-compare**
- **Found during:** `npm run check` (lint step) after the implementation landed
- **Issue:** ESLint rule `@typescript-eslint/no-unnecessary-boolean-literal-compare` flagged `record.compatibility.installable === true` as redundant (the type is already `boolean`).
- **Fix:** Dropped the `=== true` and rely on the boolean value directly.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`
- **Verification:** `npm run lint` GREEN; `npm run check` GREEN.
- **Committed in:** part of the single Plan 01 atomic commit.

**5. [Rule 1 - format] Prettier reformatted the two new test files**
- **Found during:** pre-commit format:check
- **Issue:** Long assertion strings exceeded the prettier line-width.
- **Fix:** Ran `npx prettier --write` on both new test files; bodies wrapped to comply.
- **Files modified:** `tests/orchestrators/plugin/enable-disable.test.ts`, `tests/edge/handlers/plugin/enable-disable.test.ts`
- **Verification:** `npm run format:check` GREEN.
- **Committed in:** part of the single Plan 01 atomic commit.

---

**Total deviations:** 5 auto-fixed (2 bugs, 1 missing-critical, 1 blocking, 1 formatting)
**Impact on plan:** All auto-fixes preserve the plan's success criteria byte-for-byte at the user-contract level. The two semantically-load-bearing deviations (D-54-01-A installable guard + D-54-01-B dynamic-import scaffolds) widen the plan's literal contract to handle runtime invariants the plan's behavior block missed. No scope creep.

## Issues Encountered

- None beyond the deviations documented above. The execution surfaced two issues the plan's behavior block did not anticipate (soft-degraded fixture collision; static-import file-load crash); both resolved automatically per Rules 1-3 with the load-bearing decisions captured as D-54-01-A and D-54-01-B.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (Wave 2 atomic catalog amendment) is unblocked. The architectural gates + scaffolds + planner wiring are in place. Plan 02 ships: `orchestrators/plugin/enable-disable.ts` (orchestrator with cache-only re-materialization, no network), `edge/handlers/plugin/enable-disable.ts` (handler shim), 6 new closed-set status tokens or token reuse for `(enabled)` / `(disabled)` (TBD per ENBL-04 list/info surface), notify variant + renderer arm + catalog state + byte-UAT fixtures + length-locks all in ONE atomic commit (Pitfall 54-2 atomic-supersession discipline).
- ENBL-02 closure is partial: the planner side is closed in this plan. ENBL-01 (config write-back), ENBL-03 (cache-only re-materialization), and ENBL-04 (list/info visibility) all close in Plan 02.

## Self-Check: PASSED

Verified:
- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` — modified, isRecordedButDisabled present at line 226+; pluginsToEnable wired to pluginDiff.enable.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` — modified, PlannedPluginEnable docstring updated.
- `tests/architecture/no-orchestrator-network.test.ts` — modified, enable-disable.ts in FORBIDDEN_TARGETS.
- `tests/orchestrators/reconcile/plan.test.ts` — modified, 5 new ENBL-02 tests + helper update.
- `tests/orchestrators/plugin/enable-disable.test.ts` — created, 11 test.skip blocks.
- `tests/edge/handlers/plugin/enable-disable.test.ts` — created, 5 test.skip blocks.
- `npm run check` GREEN end-to-end (typecheck + lint + format:check + 1640 unit tests + 7 integration tests).

Commit hash recorded in the metadata commit (final step of execution).

---
*Phase: 54-enable-disable-commands*
*Completed: 2026-06-10*
