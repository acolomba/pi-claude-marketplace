---
phase: 06-load-time-dependency-check-and-allowed-uninstall
plan: 01
subsystem: reconcile
tags: [reconcile, dependencies, load-time-check, closed-set-vocabulary, state-schema]
requires:
  - phase: 05-prune-on-uninstall
    provides: the offline declaration walk (dependency-index.ts) and its fail-closed posture
  - phase: 03-dependency-resolution
    provides: the declared-dependency parser and the range evaluator
provides:
  - a persisted `dependencyDisabled` marker on the plugin install record
  - a constraint-preserving declaration walk beside the dependents index
  - the per-scope satisfaction verdict with its propagation fixpoint
  - a `pluginsToDependencyDisable` plan bucket and the planner gate that stops the oscillation
  - a reconcile apply step that disables, unstages and stamps in one pass
  - the `dependency unsatisfied` closed-set reason and an interpolating cause trailer on a `(disabled)` row
affects: [06-02, 06-03, 06-04, phase-07, phase-08, phase-09]
actuals:
  tokens: 36000
  tasks: 3
  commits: 6
plan_head_before: a74d84dbe496e146775637679286217fb711be0f
tech-stack:
  added: []
  patterns:
    - "A precomputed verdict as a planner input, computed inside the read pass's own locked closure"
    - "A fixpoint whose loop head is its own bound, so the termination guard is covered rather than unreachable"
    - "An outcome builder beside the outcome shape, so the remedy sentence is composed by the producer"
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
    - tests/orchestrators/reconcile/dependency-verdict.test.ts
  modified:
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - docs/output-catalog.md
key-decisions:
  - "D-06-08: the load-time disable is performed through setPluginEnabled in orchestrated mode, not by writing the record directly, because resource discovery walks the materialized directories and never reads a record"
  - "D-06-09: the propagation entry for a dependency this same pass holds down carries kind `disabled`, not `missing`, because the dependency IS installed and an install remedy for it would be false"
  - "D-06-10: `planReconcile`'s verdict parameter is optional and defaults to a frozen empty verdict, so the `pending` preview and every convergence proof keep their three-argument call"
  - "D-06-11: the outcome carries the rendered remedy and the row's brace, not the structured verdict fields, on the `plugin-uninstall-failed.cause` precedent"
  - "D-06-12: a verdict failure is reported as a `(failed) {unreadable}` row naming the declarer, suppressed when this pass already reported that plugin (RECON-04)"
patterns-established:
  - "Bound a fixpoint with its own loop head (`held.size < declarers.length`) so both exits are reachable and the direct-coverage gate stays green without a pin"
  - "Extract an optional-field-filling builder into the module that declares the shape when a conditional spread would otherwise be uncoverable from its caller"
requirements-completed: []
coverage:
  - id: D1
    description: "The persisted `dependencyDisabled` marker: schema, clone, and the COMPAT-01 key-set pin"
    requirement: LOAD-01
    verification:
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#validates a record held down by the dependency check"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the persisted install record holds exactly its inherited key set"
        status: pass
    human_judgment: false
  - id: D2
    description: "The constraint-preserving declaration walk beside the dependents index"
    requirement: LOAD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-index.test.ts#keeps every declared constraint and fills each declaration's marketplace"
        status: pass
    human_judgment: false
  - id: D3
    description: "The per-scope satisfaction verdict: the missing arm, the propagation fixpoint, cycle termination and deterministic order"
    requirement: LOAD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/dependency-verdict.test.ts#holds down a declarer whose own dependency the same pass holds down"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/dependency-verdict.test.ts#returns rather than looping when two recorded plugins declare each other"
        status: pass
    human_judgment: false
  - id: D4
    description: "The `pluginsToDependencyDisable` bucket and the three-term enable gate that stops the oscillation"
    requirement: LOAD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#buckets a held-down declarer and plans no enable for it"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/types.test.ts#returns the complete project plan in canonical bucket order"
        status: pass
    human_judgment: false
  - id: D5
    description: "The apply step: the plugin is disabled, its artifacts unstaged, the marker stamped, and an already-disabled record left alone"
    requirement: LOAD-01
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#LOAD-01: a plugin whose declared dependency is not recorded is disabled, stamped and unstaged"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-06-02: a record disabled before the pass is held down without being stamped or reported"
        status: pass
      - kind: manual_procedural
        ref: "a live Pi session: declare a plugin whose dependency is not installed, /reload, confirm the plugin's components stop loading"
        status: unknown
    human_judgment: true
    rationale: "The suite drives the real install, disable and unstage against a temporary tree, but nothing automated proves Pi's own resource view drops the components after the reload the check runs on."
  - id: D6
    description: "A declarer whose manifest cannot be read disables nothing and is reported once"
    requirement: LOAD-01
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-05-07: a declarer whose own manifest cannot be read is reported and nothing in the scope is disabled"
        status: pass
    human_judgment: false
  - id: D7
    description: "The `dependency unsatisfied` token, the interpolating cause trailer on a `(disabled)` row, and the warning-severity row"
    requirement: LOAD-01
    verification:
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#renders the remedy cause trailer on a disabled row that carries one"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply-outcomes.test.ts#names the install remedy and the recorded version for a missing dependency"
        status: pass
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: REASONS is the closed 57-entry reason set"
        status: pass
    human_judgment: false
  - id: D8
    description: "The published catalog state for the load-time disable row"
    requirement: LOAD-01
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 20 fixture modules to 216 exact documented states"
        status: pass
    human_judgment: false
duration: 100min
completed: 2026-09-18
status: complete
---

# Phase 6 Plan 1: Load-time dependency check, end to end on the missing arm Summary

**At `/reload`, an installed plugin whose declared dependency has no record in the scope is disabled, unstaged and stamped, and reported on a `(disabled)` row carrying `{dependency unsatisfied}` and the upstream remedy naming both parties.**

## Performance

- Duration: ~100 min
- Started: 2026-09-18 18:42
- Completed: 2026-09-18 20:22
- Tasks: 3
- Files modified: 32 (2 created)
- Commits: 6 (3 RED + 3 GREEN)

## Accomplishments

- `PLUGIN_INSTALL_RECORD_SCHEMA` carries an optional `dependencyDisabled` boolean, additive with no `schemaVersion` bump and no migrate fill, preserved across `clonePluginRecord`'s enumerating snapshot.
- `buildScopeDeclarationDetail` walks every record in a scope and keeps each declaration whole, where its neighbour flattens to a bare key. Both walks share one read path and one fail-closed failure arm.
- `buildScopeSatisfactionVerdict` decides which recorded plugins the check holds down, running the propagation to a fixpoint so a chain is fully resolved in one pass. The loop head is the bound, so a declaration cycle returns instead of hanging.
- `planReconcile` takes the verdict as a fourth, optional argument, emits the new `pluginsToDependencyDisable` bucket, and refuses to re-enable a held-down record — reading the live verdict, never the stored marker, so a satisfied dependency lifts the hold.
- `applyDependencyDisables` performs the disable through the same orchestrated `setPluginEnabled` seam the toggle buckets drive, then stamps the marker for the whole bucket in one transaction. An already-disabled record is neither stamped nor reported, so a reload of an unchanged tree stays silent.
- `dependency unsatisfied` joined the closed reason set (56 → 57) across all six pin surfaces, and the grammar's cause trailer now admits the `disabled` status so the remedy — the only channel that may interpolate an identifier — reaches the row.
- The three notification gates the plan flagged now exercise the new row instead of staying green beside it.

## Task Commits

1. Task 1: the verdict, the marker, the walk and the bucket — `db337a22` (test), `1c7c6185` (feat)
2. Task 2: the read-pass wiring and the apply step — `ec4c7dc1` (test), `0aa804ea` (feat)
3. Task 3: the reason token, the remedy cause line and the three gates — `0d632be1` (test), `8a420691` (feat)

Plan metadata: see the `docs(06-01)` commit that carries this file.

## Files Created/Modified

- `orchestrators/reconcile/dependency-verdict.ts` — the per-scope satisfaction verdict and its fixpoint (new).
- `orchestrators/plugin/dependency-index.ts` — `buildScopeDeclarationDetail`, the constraint-preserving sibling walk.
- `persistence/state-io.ts` — the `dependencyDisabled` schema field and its clone line.
- `orchestrators/reconcile/types.ts` — `PlannedDependencyDisable`, the eighth bucket, the carried verdict.
- `orchestrators/reconcile/plan.ts` — the verdict parameter, the bucket builder, the three-term enable gate.
- `orchestrators/reconcile/apply.ts` — the read-pass verdict call, `applyDependencyDisables`, the unreadable-declarer row.
- `orchestrators/reconcile/apply-outcomes.ts` — the new outcome arm, the remedy builder and the three remedy shapes.
- `orchestrators/reconcile/notify.ts`, `reconcile.messaging.ts` — the row arm and the brace constant it forwards.
- `shared/notification-types.ts`, `notify-reasons.ts`, `notification-grammar.ts` — the closed-set member, its group home and counts, the widened trailer gate.
- `docs/output-catalog.md` — the `reconcile-dependency-unsatisfied` catalog state and the amended reasons paragraph.

## Decisions Made

**D-06-08: the disable runs through `setPluginEnabled` in orchestrated mode.** The plan specified a direct record write (`toDisabledRecord` plus the marker, saved once). Traced `orchestrators/discover.ts`: resource discovery walks the materialized directories and never reads a record, so a record-only disable would leave every skill, prompt, agent, MCP entry and hook of a "disabled" plugin live on the next session — LOAD-01's claim would be false. The orchestrated mode also SKIPS the config write-back (RECON-03, read at `enable-disable.ts`), which is what keeps T-06-07 intact: the consequence-disable never reaches `claude-plugins.json`. `enable-disable.ts` is unmodified; it is called, exactly as the two toggle buckets call it.

**D-06-09: propagation carries `kind: "disabled"`.** The plan said task 1 produces only the `missing` kind. A declarer held down because its dependency is itself held down would then render `Install "X"` for a plugin that IS installed. The declared union already had the arm, so the truthful kind is used and the remedy switch has been total from the start.

**D-06-10: the verdict parameter is optional.** `pending.ts` and ~40 test call sites pass three arguments. A required fourth would have forced `pending.ts` — outside this plan's boundary — to compute a verdict of its own. The default is a frozen empty verdict, documented as "this caller computed none, so nothing is held down". Consequence recorded below.

**D-06-11: the outcome carries the rendered remedy, not the structured verdict fields.** Keeping `dependency` / `kind` / `range` on the outcome as well would have left three fields nothing reads. The producer builds the sentence beside the shape that declares it, on the `plugin-uninstall-failed.cause` precedent, and the renderer forwards it.

**D-06-12: `isHeldByUnsatisfiedDependency` stays module-private.** The plan listed it as an export. Exporting it would put a test-only export into the tree, which `UNOWNED_EXPORT_CENSUS` measures and `skills/typescript-unit-testing/SKILL.md` forbids. The requirement — a named predicate instead of an inline third term under two cognitive ceilings — is met either way; the rule is asserted through `planReconcile`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The load-time disable now unstages the plugin's artifacts**
- **Found during:** Task 2
- **Issue:** The plan's apply step wrote the disabled record and the marker and saved once. Resource discovery (`orchestrators/discover.ts`) enumerates `skillsTargetDir` / `promptsTargetDir` on disk and consults no record, and `mcp.json`, the agents index and the hooks routing are likewise on-disk state. A record-only disable leaves a "disabled" plugin fully loaded.
- **Fix:** The step drives `setPluginEnabled(..., enable: false, notifications: { mode: "orchestrated" })` per bucket entry — the sanctioned cascade the toggle buckets already use — then stamps the marker for the transitioned records in one `withStateGuard` transaction.
- **Files modified:** `orchestrators/reconcile/apply.ts`
- **Verification:** `tests/orchestrators/reconcile/apply.test.ts` asserts the staged skill directory is gone after the pass.
- **Commit:** `0aa804ea`

**2. [Rule 1 - Bug] The propagation arm named an installed plugin "missing"**
- **Found during:** Task 1
- **Issue:** Emitting `kind: "missing"` for a dependency the same pass holds down would render `Install "X" or uninstall "Y"` for a dependency that is installed.
- **Fix:** That arm emits `kind: "disabled"`.
- **Files modified:** `orchestrators/reconcile/dependency-verdict.ts`
- **Verification:** `tests/orchestrators/reconcile/dependency-verdict.test.ts#holds down a declarer whose own dependency the same pass holds down`
- **Commit:** `1c7c6185`

**3. [Rule 3 - Blocking] The fixpoint's belt-and-braces bound could not be covered**
- **Found during:** Task 1
- **Issue:** The plan asked for an iteration bound asserted against the record count (T-06-04). Any such assertion is unreachable through the module's exports, and its block would be an uncovered line the direct-coverage gate rejects, forcing a new pin entry.
- **Fix:** The bound IS the loop head (`while (held.size < declarers.length)`). Both exits are reachable and exercised — the cycle fixture exits through the bound, the ordinary fixture through the empty batch — so the mitigation is kept without a coverage exception.
- **Files modified:** `orchestrators/reconcile/dependency-verdict.ts`
- **Verification:** `npm run test:coverage:direct:commit` reports 22/22 branches on the module; the three pinned shortfalls are unchanged.
- **Commit:** `1c7c6185`

**4. [Rule 3 - Blocking] Files outside the declared scope had to move with the required bucket**
- **Found during:** Tasks 1-3
- **Issue:** Adding a required `ReconcilePlan` field and a `PerEntryOutcome` member breaks every hand-written plan literal and every exhaustive switch.
- **Fix:** `tests/integration/reconcile-plan-convergence.test.ts` gained the empty bucket in its three convergence expectations; `tests/index.test.ts`'s `seedEnabledPlugin` now writes the marketplace manifest its recorded plugin claims (see item 5).
- **Files modified:** `tests/integration/reconcile-plan-convergence.test.ts`, `tests/index.test.ts`
- **Verification:** `npm test` and `npm run test:integration` both green.
- **Commit:** `8a420691`

**5. [Rule 1 - Bug] An under-specified fixture described a broken installation**
- **Found during:** Task 3
- **Issue:** `tests/index.test.ts::seedEnabledPlugin` recorded a plugin under a marketplace whose manifest was never written. The check now reports a scope whose declarations cannot be established, so three cases that promised zero emissions saw one.
- **Fix:** The seed writes the marketplace manifest that declares the recorded plugin, which is what a real installation looks like.
- **Files modified:** `tests/index.test.ts`
- **Verification:** `node --test tests/index.test.ts` — 18/18.
- **Commit:** `8a420691`

**Total deviations:** 5 auto-fixed (2 bugs, 1 missing critical functionality, 2 blocking). **Impact:** one is behavioral and load-bearing (item 1 — without it the phase's central claim is false); the rest are local. No architectural decision was deferred to the operator.

## Issues Encountered

- **A new row on a scope whose marketplace manifest is unreadable.** The verdict fails closed and the pass reports `⊘ <plugin> (failed) {unreadable}`. A tree whose marketplace clone is missing therefore gains one row per reload where it was previously silent. This is the designed posture (D-05-07), the row is suppressed when the pass already reported that plugin, and it surfaced exactly one under-specified fixture — but it is a visible change worth an operator's eye at phase UAT.
- **`pending` does not see the verdict.** `planReconcile`'s new parameter is optional and `orchestrators/reconcile/pending.ts` (outside this plan's file scope) still calls it with three arguments, so `/claude:plugin pending` will preview `will enable` for a plugin the next reload holds down. Plan 06-02 or 06-04 should decide whether the preview computes a verdict of its own.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 06-02. The seams it needs are in place and total from the start: `UnsatisfiedKind` declares all three members, the remedy switch has all three arms (two of them reachable only once 06-02 produces those kinds), `PlannedDependencyDisable` carries the optional range, and `recordedVersionSatisfies` / `isRecordedButDisabled` are unused by the verdict so far — 06-02 adds the `disabled` and `out-of-range` producers behind them. A module that starts classifying on `isRecordedButDisabled` must join `DISABLED_STATE_TARGETS` **and** `DECLARED_MODULE_ORDER` in `tests/architecture/gate-targets.ts` in the same edit.

Carried, not done here:
- `docs/plugin-enablement.md` still claims the planner's only enablement inputs are the config value and the record's own flag, and that no persisted field was added on either side. Both are now false. Plan 06-04 owns that rewrite and already names them in its truths.
- LOAD-01 stays Pending in `REQUIREMENTS.md`: plans 06-02 and 06-04 declare it too, so the shared-ID gate refuses to mark it.

## Self-Check: PASSED

Both created files exist on disk, and all seven commits this plan claims resolve in `git log`.

---
*Phase: 06-load-time-dependency-check-and-allowed-uninstall*
*Completed: 2026-09-18*
