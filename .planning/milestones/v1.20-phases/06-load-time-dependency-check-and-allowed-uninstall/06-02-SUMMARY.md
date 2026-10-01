---
phase: 06-load-time-dependency-check-and-allowed-uninstall
plan: 02
subsystem: reconcile
tags: [reconcile, dependencies, load-time-check, version-ranges, convergence]
requires:
  - phase: 06-load-time-dependency-check-and-allowed-uninstall
    plan: 01
    provides: the verdict module, the plan bucket, the apply-side disable step and the first closed-set token
  - phase: 03-dependency-resolution
    provides: the range algebra (intersect, unconstrained, satisfies, render)
provides:
  - the `disabled` and `out-of-range` arms of the per-scope satisfaction verdict
  - the `dependency version unsatisfied` closed-set reason and its row brace
  - the terminal-state gate that stops the consequence-disable oscillating
  - the one-pass lift of a held chain, mirroring the one-pass hold
  - the convergence, chain-propagation and cycle-termination proofs
affects: [06-03, 06-04, phase-07, phase-08, phase-09]
actuals:
  tokens: 19000
  tasks: 3
  commits: 5
plan_head_before: d3e3bc1f2eb8fc50e75154fbeb5003771a6f299d
tech-stack:
  added: []
  patterns:
    - "An optimistic read of a record the same pass will repair, made safe by the fixpoint that re-holds it"
    - "A brace chosen by the outcome's own discriminant, so two upstream error codes keep two tokens"
    - "A convergence proof that re-plans from disk rather than from the literals the case seeded"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - docs/output-catalog.md
    - scripts/test-coverage-direct.pin.json
key-decisions:
  - "D-06-13: the out-of-range entry carries the CANONICAL folded range, not the declared text, because one evaluator canonicalizes and a row showing `^2.0.0` beside a comparison run on `>=2.0.0 <3.0.0-0` would describe a test that did not happen"
  - "D-06-14: a fold that intersects to nothing, or that trips an input cap, is reported as out-of-range against the conjunction of the declared texts -- never as no constraint (T-06-10)"
  - "D-06-15: the out-of-range row carries its own token, chosen by kind at the outcome builder, so each upstream error code has exactly one token and a grep for either returns only its own situation"
  - "D-06-16: the stored marker is read in exactly two places, both answering `did the check already do this`: plan.ts's terminal-state gate and the verdict's optimistic read of a record this pass will lift"
  - "D-06-17: the load-time check's lift propagates through a chain in ONE pass, because a hold that goes down in one pass and comes back one level per reload is an asymmetry the user experiences as the plugin needing three restarts"
patterns-established:
  - "Read a record the same pass is about to repair as already repaired, and let the fixpoint that re-holds it make the optimism safe"
  - "Prove convergence by re-planning from what is on disk after an apply, compared against the empty-plan FACTORY so a later bucket cannot slip past"
requirements-completed: []
coverage:
  - id: D1
    description: "The verdict's `disabled` arm: a declared dependency whose own record is disabled"
    requirement: LOAD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/dependency-verdict.test.ts#reports a declared dependency whose own record is disabled as disabled"
        status: pass
      - kind: unit
        ref: "tests/architecture/disabled-state-classification.test.ts#requires every former definition site to import the single predicate"
        status: pass
    human_judgment: false
  - id: D2
    description: "The verdict's `out-of-range` arm: the fold, the unconstrained short-circuit, the satisfaction test, and the two fail-closed arms"
    requirement: LOAD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/dependency-verdict.test.ts#reports a recorded version outside its declared range as out-of-range"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/dependency-verdict.test.ts#folds two declarations of one dependency into a single intersected range"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/dependency-verdict.test.ts#reports out-of-range rather than unconstrained when the fold trips an input cap"
        status: pass
    human_judgment: false
  - id: D3
    description: "The `dependency version unsatisfied` token on every pin surface, its group home, and the row brace chosen by kind"
    requirement: LOAD-01
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: REASONS is the closed 58-entry reason set"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: REASONS holds exactly its inherited members, in order"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply-outcomes.test.ts#names the declared range in the update remedy of an out-of-range dependency"
        status: pass
    human_judgment: false
  - id: D4
    description: "The two published catalog states for the disabled and version arms"
    requirement: LOAD-01
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 20 fixture modules to 218 exact documented states"
        status: pass
    human_judgment: false
  - id: D5
    description: "The lift: a satisfied dependency re-enables its dependent and the marker key leaves the record"
    requirement: LOAD-02
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#LOAD-02: a satisfied dependency lifts the hold and the marker leaves the record"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-outcome.test.ts#LOAD-02: re-materializing a held-down record drops the dependency marker"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall-record.test.ts#LOAD-02: a reinstall of a held-down record drops the dependency marker"
        status: pass
    human_judgment: false
  - id: D6
    description: "A disable the user asked for is never lifted by the check"
    requirement: LOAD-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#LOAD-02: never lifts a disable the user asked for"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#LOAD-02: an unmarked disabled record is enabled by the ordinary path, not by the check"
        status: pass
    human_judgment: false
  - id: D7
    description: "Convergence: a second reload over an unchanged unsatisfied tree re-plans the empty plan, writes nothing and emits nothing"
    requirement: LOAD-02
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#LOAD-02: a second reload over an unchanged unsatisfied tree re-plans nothing and is silent"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#LOAD-02: plans neither bucket for a marked record whose dependency is still unsatisfied"
        status: pass
    human_judgment: false
  - id: D8
    description: "Chain propagation and chain lift, each in one pass, in the fixpoint's sorted order"
    requirement: LOAD-02
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#LOAD-02: one pass propagates a broken dependency the full depth of a chain"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#LOAD-02: restoring the dependency lifts the whole chain in one pass"
        status: pass
    human_judgment: false
  - id: D9
    description: "The fixpoint terminates on a declaration cycle within a stated bound"
    requirement: LOAD-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/dependency-verdict.test.ts#returns rather than looping when two recorded plugins declare each other"
        status: pass
    human_judgment: false
  - id: D10
    description: "The three arms reach a live Pi session correctly: a disabled or out-of-range dependency stops the dependent's components loading, and satisfying it brings them back on one /reload"
    requirement: LOAD-01
    verification:
      - kind: manual_procedural
        ref: "a live Pi session: disable a dependency, /reload, confirm the dependent's components stop loading; enable it, /reload once, confirm they return"
        status: unknown
    human_judgment: true
    rationale: "The suite drives the real disable, unstage, enable and re-stage against a temporary tree and asserts the staged skill directory comes back, but nothing automated proves Pi's own resource view follows within a single reload. It is the same gap 06-01 recorded for its missing arm, now widened to the lift."
duration: 165min
completed: 2026-09-18
status: complete
---

# Phase 6 Plan 2: The disabled and out-of-range arms, and the lift Summary

**LOAD-01's condition is now total — missing, disabled, and recorded-at-a-version-outside-the-range each disable the dependent with their own remedy — and LOAD-02 is closed as a convergence property: the hold does not oscillate, and a chain that goes down in one pass comes back up in one.**

## Performance

- Duration: ~165 min
- Tasks: 3
- Files modified: 24
- Commits: 5 (2 RED + 3 GREEN)

## Accomplishments

- `buildScopeSatisfactionVerdict` answers all three arms. The `disabled` arm tests the record's own stored state through `isRecordedButDisabled`; the `out-of-range` arm accumulates every constraint a declarer names for one key, folds them with `intersectDependencyRanges`, short-circuits through `isUnconstrainedRange`, and decides with `recordedVersionSatisfies`. No second comparator was added.
- A fold that intersects to nothing, and one that trips either project-owned input cap, are reported as out-of-range rather than thrown or read as "no constraint" — the load-time check runs under `resources_discover`, where a throw must never escape, and a cap trip read as unconstrained would silently satisfy every dependency an attacker can make expensive to fold (T-06-09 / T-06-10).
- `dependency version unsatisfied` joined the closed reason set (57 → 58) on all pin surfaces, with its group home and its own row brace. Each upstream error code now has exactly one token, so a grep for either returns only its own situation.
- The dependency-disable bucket skips a record that is already disabled AND already marked. That is what makes a second reload over an unchanged unsatisfied tree plan the empty plan and stay silent.
- The lift is deliberate rather than accidental: both re-materializing record literals now record that omitting `dependencyDisabled` is load-bearing, and name the deliberate opposite at `clonePluginRecord` and `toDisabledRecord`.
- A chain now lifts in one pass. A record carrying the check's own marker reads as available to its dependents, because this same pass will lift it if its own declarations are satisfied; the fixpoint re-holds it on the same pass when they are not.
- Two catalog states with their typed fixtures (216 → 218), and the reasons paragraph re-counted.

## Task Commits

1. Task 1: the disabled and out-of-range arms, the second token, the catalog — `3f80276f` (test), `74f091ff` (feat)
2. Task 2: the terminal-state gate and the clear-on-lift contract — `2eb39668` (test), `54808347` (feat)
3. Task 3: the one-pass lift and the convergence proofs — `ca3649c8` (feat; its RED cases were written and run inside the same task, see Deviations item 4)

Plan metadata: see the `docs(06-02)` commit that carries this file.

## Files Created/Modified

- `orchestrators/reconcile/dependency-verdict.ts` — the two new arms, the per-key constraint fold, and `isDisabledIndependently`.
- `orchestrators/reconcile/plan.ts` — `isAlreadyDependencyDisabled`, the terminal-state gate on the dependency-disable bucket.
- `orchestrators/reconcile/apply-outcomes.ts`, `reconcile.messaging.ts` — the second row brace and the kind-to-brace selector.
- `orchestrators/plugin/install-outcome.ts`, `reinstall-record.ts` — the load-bearing-omission notes at both record literals.
- `shared/notification-types.ts`, `notify-reasons.ts` — the 58th member, its group home, the re-counted header prose.
- `docs/output-catalog.md` — two catalog states and the amended reasons paragraph.
- `scripts/test-coverage-direct.pin.json` — the moved `install-outcome.ts` line reading, with its reason.
- Tests: `dependency-verdict.test.ts`, `plan.test.ts`, `apply.test.ts`, `apply-outcomes.test.ts`, `install-outcome.test.ts`, `reinstall-record.test.ts`, `notification-types.test.ts`, `compat-01-no-expansion.test.ts`, `notify-closed-set-locks.test.ts`, `disabled-state-classification.test.ts`, `gate-targets.ts`, `catalog-uat/fixtures/reconcile-applied.ts`, `catalog-uat/catalog-parser.test.ts`, `catalog-uat/catalog-contract.test.ts`.

## Decisions Made

**D-06-13: the carried range is the canonical fold, not the declared text.** `intersectDependencyRanges` canonicalizes through `validRange`, so a declared `^2.0.0` becomes `>=2.0.0 <3.0.0-0` and that is what the row shows. Keeping the declared shorthand for the single-declaration case would have needed a second code path, and it would have shown the operator a range the satisfaction test did not actually run.

**D-06-14: a failed fold is out-of-range, measured against the conjunction of the declared texts.** There is no folded range to carry when the fold fails, and the honest rendering of "these declarations demand incompatible things" is the demands themselves. `renderConstraintRange` bounds the result at the row, so the 70-declaration cap-trip fixture renders with the overflow marker rather than flooding the line.

**D-06-15: the out-of-range row carries its own token.** The plan called for a second closed-set member; the brace that carries it is selected by `held.kind` at `dependencyDisabledOutcome`, one constant per arm, so exactly one token ever rides a row.

**D-06-16: the stored marker has exactly two readers, and both ask the same question.** `plan.ts`'s terminal-state gate asks "did the check already do this"; the verdict's `isDisabledIndependently` asks "is this record disabled for a reason other than the check". Neither asks "should the check keep doing this" — that is the live verdict's question alone, and answering it from the marker is what would make the lift impossible.

**D-06-17: the lift propagates through a chain in one pass.** See deviation 4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `DECLARED_MODULE_ORDER` does not live where the plan said**

- **Found during:** Task 1
- **Issue:** The plan directed both lists the disabled-state gate maintains to be edited in `tests/architecture/gate-targets.ts`. `DISABLED_STATE_TARGETS` is there; the parallel basename list `DECLARED_MODULE_ORDER` lives in `tests/architecture/disabled-state-classification.test.ts`, which the plan's file scope did not name.
- **Fix:** Both lists were amended, in the same change, with the verdict module appended in matching position.
- **Files modified:** `tests/architecture/gate-targets.ts`, `tests/architecture/disabled-state-classification.test.ts`
- **Verification:** `node --test tests/architecture/disabled-state-classification.test.ts` — green, and it fails without the second edit (the `deepEqual` on the two lists is the whole point of the pin).
- **Commit:** `3f80276f`

**2. [Rule 3 - Blocking] The second token needed a producer the plan did not scope**

- **Found during:** Task 1
- **Issue:** The plan's `files_modified` reached the token's declaration and its group home, but not the module that stamps a row's brace. Without a producer, `dependency version unsatisfied` would have been a closed-set member nothing ever emits — and the plan's own truth ("rendered with the `{dependency version unsatisfied}` token") would be false.
- **Fix:** `reconcile.messaging.ts` gained a second brace constant beside the first, and `apply-outcomes.ts` gained `dependencyRowReasons(kind)`, a two-arm selector at the one site that already composed the remedy.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`, `tests/orchestrators/reconcile/apply-outcomes.test.ts`
- **Verification:** `tests/orchestrators/reconcile/apply-outcomes.test.ts#names the declared range in the update remedy of an out-of-range dependency` now asserts the brace as well as the sentence.
- **Commit:** `74f091ff`

**3. [Rule 3 - Blocking] Three pinned counts outside the plan's file scope moved with the change**

- **Found during:** Tasks 1 and 2
- **Issue:** Adding two catalog states moves `catalog-contract.test.ts`'s `EXPECTED_STATE_COUNT` (216 → 218) and `EXPECTED_UTF8_BYTES` (29,363 → 29,802), which the plan named only the parser test for. Adding a fourteen-line comment inside `install-outcome.ts`'s record literal moves the direct-coverage pin's line reading (1075/1081 → 1089/1095).
- **Fix:** All three were updated with a written reason, as each record requires. The coverage deficit is unchanged — the same two arms, one branch and six lines — and no new exception was introduced.
- **Files modified:** `tests/architecture/catalog-uat/catalog-contract.test.ts`, `scripts/test-coverage-direct.pin.json`
- **Verification:** `npm run test:coverage:direct:commit` reports `3 pinned shortfall(s) matched … exactly`.
- **Commits:** `74f091ff`, `54808347`

**4. [Rule 1 - Bug] The lift propagated one level per reload while the hold propagated the whole chain in one**

- **Found during:** Task 3
- **Issue:** The plan's behaviour spec asks for "satisfying C and reloading lifts both A and B in one pass". It did not. The verdict read every disabled record as unsatisfying, including one the check itself had disabled, so on the lift pass B was still stored disabled and A stayed held by it. A three-deep chain went down in one reload and came back in three — the asymmetry a user experiences as the plugin needing several restarts.
- **Fix:** `isDisabledIndependently` reads a record carrying the check's own marker as available to its dependents, because this same pass will lift it if its declarations are satisfied. The optimism never outlives the walk: the fixpoint re-holds that record on the same pass when its own dependency is still unsatisfied, and its dependents then see it in the held set. A record disabled WITHOUT the marker is the user's decision and still holds its dependents down.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts`
- **Verification:** `tests/orchestrators/reconcile/apply.test.ts#LOAD-02: restoring the dependency lifts the whole chain in one pass` (both records enabled, both markers gone, the pass after it silent), plus the two module-local cases that pin the optimism and its limit.
- **Commit:** `ca3649c8`

### Scope Deviations

**5. `tests/architecture/cross-op-convergence.test.ts` was not touched.**

The plan placed the cross-operation convergence proofs in that suite. Its subject is a different one: it proves that eight ORCHESTRATORS emit byte-identical rows for one precondition, and it carries a harness built for that. The reconcile convergence proofs need `writeMarketplaceSource`, `seedState`, `createHermeticScopes`, `configBytes` and the offline git ops — roughly four hundred lines that live in `tests/orchestrators/reconcile/apply.test.ts`. Copying them into a suite about a different subject would have created a duplication liability with no extra proof, so the three apply-driven proofs went where their harness already is, and `replanFromDisk` was added beside `recordFor` so each of them re-plans from what the previous pass actually left on disk. The plan's acceptance criterion — the second plan `deepEqual`s the empty-plan FACTORY for the same scope — is met there and again at the planner level.

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking) and 1 scope deviation. **Impact:** item 4 is behavioural and load-bearing — without it LOAD-02's lift claim is only half true. The rest are mechanical consequences of pins the plan's file scope did not reach.

## Issues Encountered

- **The out-of-range remedy shows canonical semver, not the author's shorthand.** `Update "x@mp" to satisfy >=2.0.0 <3.0.0-0` is correct and is what the comparison actually ran, but it is less readable than `^2.0.0` for an operator who wrote the caret. The alternative was a second code path that renders declared text for the single-declaration case and canonical text otherwise, which would make the row and the test disagree about what was measured. Worth an operator's eye at phase UAT.
- **`pending` still does not see the verdict.** Carried unchanged from 06-01: `orchestrators/reconcile/pending.ts` calls `planReconcile` with three arguments, so `/claude:plugin pending` previews `will enable` for a plugin the next reload holds down. Plan 06-04 should decide whether the preview computes a verdict of its own.
- **A manual enable on a still-unsatisfied record leaves a stale marker.** `enable-disable.ts` is outside this phase's boundary and was not edited (proved by an explicit commit-range check). The next reconcile pass self-corrects either way: it clears the marker if the dependency is satisfied, or re-disables and re-stamps if it is not. No defensive code is needed, and this is a boundary note rather than a deferred bug.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 06-03. LOAD-01's condition is total and LOAD-02 is closed. The seams 06-03 needs are in place: `REASONS` has 58 members (06-03 retires one and adds one, leaving 58), the catalog carries 218 states, and `UnsatisfiedKind` is exhausted by both the verdict and the remedy switch, so a fourth condition would fail to compile rather than fall through.

Carried, not done here:

- `docs/plugin-enablement.md` still claims the planner's only enablement inputs are the config value and the record's own flag. That was already false after 06-01 and is now false twice over — `plan.ts` reads the marker at the dependency-disable gate. Plan 06-04 owns that rewrite.
- LOAD-01 and LOAD-02 stay Pending in `REQUIREMENTS.md`: plans 06-04 declares them too, so the shared-ID gate refuses to mark them.

## Self-Check: PASSED

All five commits this plan claims resolve in `git log`, every file named under Files Created/Modified exists on disk, and the four full gates the plan's verification section names are green: `npm run check`, `npm run test:coverage:direct:all`, `pre-commit run --all-files`, and the disabled-state, reconcile-planner-purity and six closed-set pin surfaces inside them.

---
*Phase: 06-load-time-dependency-check-and-allowed-uninstall*
*Completed: 2026-09-18*
