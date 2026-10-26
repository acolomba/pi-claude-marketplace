---
phase: 29-load-converges-on-the-catalog
plan: 10
subsystem: reconcile
tags: [pending, load, convergence, constraint-fold, blocked-moves, row-hint, output-catalog, json-output, cucumber]

requires:
  - phase: 29-load-converges-on-the-catalog
    provides: "29-09: planConvergence and the `will update` pending row"
  - phase: 29-load-converges-on-the-catalog
    provides: "29-08: composePendingReport, shared by pending and the load"
provides:
  - "orchestrators/plugin/constraint-fold.ts: the network-free range fold (foldDeclaredConstraint, admitResolvedVersion, admitsRange, transportHeld and the verdict types) that update's gate and the convergence planner share (D-23)"
  - "ConvergencePlan { moves, holds, declines }: range holds and consent declines, judged against the plan-adjusted scope to a fixed point (D-12)"
  - "pending and the load list a range-held move as `(skipped) {dependents constrain}` with update's cause line, and a consent decline as `(partially-upgradable)` with the catalog hint; neither counts for needsApply"
  - "RowHint `catalog-partial-update`, PluginPartiallyUpgradableMessage.catalogHint, CATALOG_PARTIAL_UPDATE_HINT_TRAILER (D-24)"
affects: [29-11, 29-12, 29-13, 29-14, pending, load, apply, update, docs]

actuals:
  tokens: 41700
  tasks: 3
  commits: 3
plan_head_before: 1ac10e3b3f8884123e014e40d1cd9639882d7fde
plan_head_after: 5d12dc16b8762351fc7eb9f2005bc284ebb1cc10

tech-stack:
  added: []
  patterns:
    - "Blocked moves ride beside the moves in ConvergencePlan; the composer counts them for emptiness but not for needsApply, and the projection appends their rows after the moves"
    - "The convergence fixed point blocks only grow and the candidates arrive sorted, so the judgement is deterministic and independent of state insertion order"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts
    - test/orchestrators/plugin/constraint-fold.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - schema/claude-plugin.schema.json
    - test/orchestrators/plugin/update-constraint-gate.test.ts
    - test/orchestrators/reconcile/convergence.test.ts
    - test/orchestrators/reconcile/notify.test.ts
    - test/orchestrators/reconcile/pending.test.ts
    - test/orchestrators/reconcile/reconcile.messaging.test.ts
    - test/shared/notification-resolve.test.ts
    - test/shared/notification-grammar.test.ts
    - test/shared/notification-wire.test.ts
    - test/architecture/soft-dep-marker-policy.test.ts
    - test/architecture/catalog-uat/fixtures/plugin-pending.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts
    - test/architecture/catalog-uat/catalog-parser.test.ts
    - test/architecture/catalog-uat/catalog-wire.test.ts
    - features/plugin/pending.feature
    - features/plugin/update.feature
    - docs/output-catalog.md
    - docs/json-output.md
    - docs/messaging-style-guide.md

key-decisions:
  - "The range fold, its cause composer and stage two moved to the network-free constraint-fold.ts; it exports admitsRange and transportHeld so update-constraint-gate.ts keeps its tag-probe arms without the private describeConstraint leaving the module"
  - "The planner reads each move candidate's installed copy up front, so the fixed point is a pure synchronous loop; a blocked candidate's declarations are replaced by its installed copy, and an unreadable copy keeps the catalog declarations"
  - "Range is checked first and consent second, as update does; once a candidate is blocked it stays blocked with its first reason"
  - "Only move candidates swap to installed-copy declarations; disabled, git-source and unavailable records keep their catalog declarations, the same walk update's gate uses"
  - "Hold and decline rows carry no scope field, like the will update row; the wire derives it from the block"

patterns-established:
  - "A blocked catalog move is warning in every cardinality and never sets needsApply, so a block of blocked rows alone has no apply trailer"

requirements-completed: [APL-02, APL-04]

coverage:
  - id: D1
    description: "The range fold lives in a network-free module shared by update's gate, with update's hold bytes unchanged"
    requirement: APL-02
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/constraint-fold.test.ts and update-constraint-gate.test.ts (100% direct coverage for both)"
        status: pass
      - kind: e2e
        ref: "features/plugin/update.feature#Updating a dependency past the version range its dependent declares holds the update and changes nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "The planner holds a move a dependent's range does not admit, against the plan-adjusted scope, to a deterministic fixed point"
    requirement: APL-02
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/convergence.test.ts (D-12 cases: held, admitted, disjoint, uninstalled dependent, disabled dependent, two-round fixed point, input order, unreadable copy; 100% direct coverage)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A clean record's partial candidate is declined; an installable:false record moves; a held partial candidate is held"
    requirement: APL-02
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/convergence.test.ts#D-12 / WCONV-01: a clean record whose candidate would drop components is declined"
        status: pass
    human_judgment: false
  - id: D4
    description: "pending and the load list the hold and decline rows at warning, with no apply trailer"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#D-12 cases and notify.test.ts#D-12 / D-24"
        status: pass
      - kind: e2e
        ref: "features/plugin/pending.feature#Pending lists a move a dependent's range blocks as held; #Pending lists a partial move a clean plugin needs consent for as partially upgradable"
        status: pass
    human_judgment: false
  - id: D5
    description: "The catalog hint, its wire id, the catalog states and the references"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/shared/notification-resolve.test.ts, notification-grammar.test.ts, notification-wire.test.ts, test/architecture/catalog-uat/catalog-contract.test.ts, json-output-docs.test.ts"
        status: pass
      - kind: other
        ref: "npm run check (exit 0 at 5d12dc16)"
        status: pass
    human_judgment: false

duration: 54min
completed: 2026-10-24
status: complete
---

# Phase 29 Plan 10: Blocked Catalog Moves Summary

**`planConvergence` now holds a catalog move a dependent's range does not admit and declines a clean record's partial move, so `pending` and the load list update's `(skipped) {dependents constrain}` and `(partially-upgradable)` rows, judged by a range fold that moved into the network-free `constraint-fold.ts`.**

## Performance

- **Duration:** 54 min
- **Started:** 2026-10-24T19:25:00Z
- **Completed:** 2026-10-24T20:19:00Z
- **Tasks:** 3
- **Files modified:** 31

## Accomplishments

- New `orchestrators/plugin/constraint-fold.ts`, outside `NETWORK_SEAMS`. It holds the holders, the range fold, the cause lines and stage two. `foldDeclaredConstraint` returns `held`, `unconstrained` or a range-only `admits`, and lists no tag (D-23). `evaluateUpdateConstraint` is now the walk, the fold, then its tag search. Update's bytes are unchanged: the update tests and `update.feature` pass as before.
- `planConvergence` judges each move against the scope as the plan leaves it. A move whose catalog version the dependents' ranges do not admit becomes a `PlannedHold` with the gate's cause line. A clean record whose candidate resolves `partially-available` becomes a `PlannedDecline` with the kinds it would drop. A record already installed partial still moves. The checks run to a fixed point: a blocked plugin is judged by its installed copy (DLS-D1), and the result does not depend on input order.
- `pending` and the load list each hold as `⊘ lib v1.0.0 (skipped) {dependents constrain}` with its cause line, and each decline as `● demo v1.0.0 (partially-upgradable) {unsupported component}` with the hint `Run update --partial on this plugin to update it with the supported components.` Both rows are warnings. Neither counts for `needsApply`, so a block of blocked rows alone has no apply trailer.
- The catalog has two new pending states. The status table, `json-output.md` and the messaging style guide name the new surfaces and the fourth frozen hint trailer.

## Task Commits

1. **Task 1: End-to-end range hold in pending**: `e6c7d794` (feat)
2. **Task 2: Consent declines with the catalog hint**: `60ad904a` (feat)
3. **Task 3: The catalog and the references document the blocked rows**: `5d12dc16` (docs)

The commit hook (`npm run check:commit`) passed on all three. Tracer gate after Task 1: its `<verify>` chain re-ran green, so expansion continued.

## Files Created/Modified

- `orchestrators/plugin/constraint-fold.ts` (new): `ConstraintHolder`, `UpdateTagPin`, `UpdateConstraintVerdict`, `StageTwoVerdict`, `admitsRange`, `transportHeld`, `foldDeclaredConstraint`, `admitResolvedVersion`.
- `orchestrators/plugin/update-constraint-gate.ts`: the walk, the fold and the tag search. `update-preflight.ts` imports `admitResolvedVersion` and the verdict types from the fold.
- `orchestrators/reconcile/convergence.ts`: `PlannedHold`, `PlannedDecline`, `ConvergencePlan.holds` / `.declines`, the installed-copy read and the fixed point (`blockOf`, `blockRound`, `settleCandidates`).
- `orchestrators/reconcile/notify.ts`: `buildReconcilePendingNotification` takes the whole `ConvergencePlan` as its fourth argument. `pushConvergence` appends the move, hold and decline rows.
- `orchestrators/reconcile/pending.ts`: collects the three lists per scope. Emptiness counts all three, and `needsApply` counts moves only.
- `orchestrators/reconcile/reconcile.messaging.ts`: `PendingStatus`, `PendingMsg` and `PENDING_CONTEXT` gain `skipped` and `partially-upgradable`.
- `shared/notification-{types,resolve,grammar,wire}.ts`, `schema/claude-plugin.schema.json`: `catalogHint`, the `catalog-partial-update` hint and its frozen trailer.
- Tests: `constraint-fold.test.ts` holds the fold, `admitsRange`, `transportHeld` and stage-two cases, moved from `update-constraint-gate.test.ts`. New planner, projection, pending, resolve, grammar and wire cases.
- Scenarios: two new `pending.feature` scenarios. The new-session blocks of `update.feature`'s hold and decline scenarios now state the blocked rows.
- Catalog fixtures and pins, `docs/output-catalog.md`, `docs/json-output.md`, `docs/messaging-style-guide.md`.

## Decisions Made

See `key-decisions` in the frontmatter. In short:

- The fold exports `admitsRange` and `transportHeld`, so the private cause composer stays in one module.
- Installed copies are read up front, so the fixed point is a pure loop.
- A blocked candidate keeps its first reason: range, then consent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Files outside a task's list**
- **Found during:** Tasks 1 to 3
- **Issue:** Some changes the plan requires touch files outside a task's `<files>` or the plan's `files_modified`:
  - `test/architecture/soft-dep-marker-policy.test.ts` pins `PENDING_CONTEXT`'s row policies.
  - `pending.ts` (Task 2) has to collect the declines.
  - `catalog-parser.test.ts` and `catalog-wire.test.ts` pin the catalog counts.
  - Task 1's `update.feature` run failed on the line-352 session block. The plan gives that block to Task 2, but the holds change it in Task 1.
- **Fix:** I updated each file in the task that needed it. The hold block of `update.feature` landed in Task 1, and the decline block in Task 2. I added the two blocked pending statuses to `reconcile.messaging.ts` in Task 1, as Task 1's files list says.
- **Committed in:** `e6c7d794`, `60ad904a`, `5d12dc16`

**2. [Rule 1 - Bug] Stale module reference in the output catalog**
- **Found during:** Task 3
- **Issue:** The `update-held-out-of-range` prose said that `admitResolvedVersion` lives in `update-constraint-gate.ts`.
- **Fix:** The prose now names `constraint-fold.ts`.
- **Committed in:** `5d12dc16`

**3. [Gate wording] partial-vocabulary guard**
- The D-75-01 guard rejects a backticked `unsupported` in production text. The `PlannedDecline` doc comment says "the listed component kinds" instead.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 stale doc), plus 1 wording note.
**Impact on plan:** None on behavior. Every extra file holds a pin or a scenario that the planned change moves.

## Issues Encountered

- The plan's fixed-point example needs a dependent that sorts after its dependency. Otherwise one round holds both. The convergence test uses `core` < `widget` < `zhost`, so only a second round can hold `core`.
- The hold and decline session tables in `update.feature` and `pending.feature` leave out the `needs apply` and `tally success count` columns. The payload has neither field. The step compares the columns a table states, plus any the payload adds.

## Verification

- Owner tests pass for every touched pair. Direct coverage is 100% for `constraint-fold.ts`, `update-constraint-gate.ts`, `convergence.ts`, `notify.ts`, `pending.ts`, `notification-resolve.ts`, `notification-grammar.ts`, `notification-wire.ts` and `notification-types.ts`.
- Acceptance greps:
  - `export function foldDeclaredConstraint` appears once in `constraint-fold.ts`.
  - `export function admitResolvedVersion` no longer appears in `update-constraint-gate.ts`.
  - The trailer literal appears once in `notification-grammar.ts`.
  - `"catalog-partial-update"` appears once in `notification-wire.ts`.
  - The `plugin-pending-update-held` catalog-state marker appears once in `docs/output-catalog.md`.
  - `catalog-partial-update` appears once in `docs/json-output.md`.
  - Both named cucumber scenarios pass.
- Full gate: I ran `npm run check` once after the last task commit, at HEAD `5d12dc16` on Node v26.12.1. **Exit code 0.** Log tail:

```text
passed typecheck (11.7 s)
passed lint (4.1 s)
passed lint:workflows (0.4 s)
passed fallow (5.3 s)
passed format:check (7.9 s)
passed test:corresponding (3.6 s)
passed check:features (3.3 s)
16 hooks (16 passed)
783 scenarios (783 passed)
7520 steps (7520 passed)
Merged LCOV: coverage/direct.lcov (286 records)
CHECK_EXIT=0
```

## Known Stubs

None. Git-source records are still skipped and `grew` is still always `false`. Both are 29-09's stated scope, and 29-11 adds them.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 29-11. Git and growth candidates must go through `settleCandidates`, so they are judged for range and consent too. `apply` must report the same hold and decline rows. Its applied context has no `skipped` or `partially-upgradable` policy yet.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts
- FOUND: test/orchestrators/plugin/constraint-fold.test.ts
- FOUND: e6c7d794, 60ad904a, 5d12dc16 (ancestors of HEAD)
