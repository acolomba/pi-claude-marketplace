---
phase: 29-load-converges-on-the-catalog
plan: 08
subsystem: reconcile
tags: [load, pending, apply, reconcile, read-pass, output-catalog, json-output, cucumber]

requires:
  - phase: 29-load-converges-on-the-catalog
    provides: "29-02: the read-only load step (load.ts) over the shared read pass (openScopePass / closeScopePass / notifyScopePasses)"
  - phase: 29-load-converges-on-the-catalog
    provides: "29-03: the apply trailer and the needsApply envelope fact"
  - phase: 29-load-converges-on-the-catalog
    provides: "29-07: pending's satisfaction verdict, withPlannedInstallsLanded and withoutDisabledDependents"
provides:
  - "composePendingReport({ cwd, scopes }) and notifyPendingReport(ctx, run, report) in reconcile/pending.ts, shared by pending and the load (D-06)"
  - "A load prints pending's block on a mismatch, with the apply trailer and no reload hint, and nothing on a match (APL-03, D-05)"
  - "The load's per-session warnings and read failures keep their own reconcile-applied-cascade payload (D-18)"
  - "pending's invalid-config block carries a failed child with the redacted parse cause (I5)"
  - "read-pass.ts: optional ScopePassInput.configOutcomes sink and an exported notifyScopeOutcomes"
affects: [29-09, 29-10, 29-11, 29-12, 29-13, 29-14, load, pending, docs]

actuals:
  tokens: 16700
  tasks: 2
  commits: 2
plan_head_before: c33fe89ab69be06f04e79acba6ccbe2f55e6aa37
plan_head_after: dd55f04adb6475d516a14b106dcd618133a5d221

tech-stack:
  added: []
  patterns:
    - "One composer, two senders: pending and the load both call composePendingReport and send through notifyPendingReport, so their bytes cannot drift"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
    - test/orchestrators/reconcile/pending.test.ts
    - test/orchestrators/reconcile/load.test.ts
    - test/orchestrators/reconcile/read-pass.test.ts
    - test/index.test.ts
    - features/plugin/reconcile.feature
    - features/plugin/configuration.feature
    - features/plugin/apply.feature
    - features/plugin/git-source.feature
    - test/architecture/catalog-uat/fixtures/plugin-pending.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts
    - docs/output-catalog.md
    - docs/json-output.md

key-decisions:
  - "The load and pending share composePendingReport (the report) and notifyPendingReport (the one notifyWithContext call), so the load's block is pending's output byte for byte (D-06)"
  - "The load composes the report over every scope whose read pass did not throw; an invalid config or a layer gap counts as readable (pending's block reports it), and a read-pass throw (corrupt state.json, held lock, refused first-run config write) stays a warnings row and out of the block, so each is reported once"
  - "The load drops the read pass's invalid-config and layer-gap rows through a scope-local configOutcomes sink on openScopePass, and no longer pushes source-mismatch outcomes; apply's use of openScopePass is unchanged"
  - "The load's emission order is: the MCP migration notice, the pending block, then the warnings cascade (notifyScopeOutcomes, split out of notifyScopePasses)"
  - "pending's invalid-config block gains one failed child named by the basename with the redacted read/parse/schema detail as cause, the form the load's I5 row had; its summary becomes 'Some operations have failed.' and the tally counts 2 failures"

patterns-established:
  - "Session scenarios over a pending change state two `cascade` payloads (Pi reports a lasting payload twice) with tally label `Reconcile pending` and needs apply true"

requirements-completed: []

coverage:
  - id: D1
    description: "A new session after a hand edit prints pending's block with the apply trailer and changes nothing"
    requirement: APL-03
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/load.test.ts#APL-03 / D-05: a config that declares a plugin the scope never installed prints pending's block and changes nothing"
        status: pass
      - kind: e2e
        ref: "features/plugin/reconcile.feature#A new session after a hand edit of the config prints the pending block and changes nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "A new session whose configs match the records prints nothing"
    requirement: APL-03
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/load.test.ts#RECON-05 / D-05: a config that matches the records prints nothing and changes nothing"
        status: pass
      - kind: e2e
        ref: "features/plugin/reconcile.feature#A new session with nothing pending prints nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "The load's block and pending's output are byte-identical"
    requirement: APL-03
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/load.test.ts#D-06: the load's block and pending's output over the same tree are byte-identical"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-session warnings and read failures stay a separate payload; an invalid config and a corrupt state are each reported once"
    requirement: APL-03
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/load.test.ts#CFG-03 / D-06, WR-01, IL-2 order and D-18 cases"
        status: pass
    human_judgment: false
  - id: D5
    description: "pending's invalid-config block carries the redacted cause; composePendingReport's empty, change and scope-filter cases"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#I5 / T-53-02-02 and the composePendingReport cases"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every scenario that starts a session over a pending change states the block; the catalog and JSON reference describe the load's output"
    requirement: APL-03
    verification:
      - kind: e2e
        ref: "npm run test:cucumber (780 scenarios)"
        status: pass
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts, catalog-wire.test.ts, json-output-docs.test.ts"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-10-24
status: complete
---

# Phase 29 Plan 08: The Load Prints Pending's Block Summary

**A new session or `/reload` now prints the exact block `/claude:plugin pending` prints, from one shared composer, ending with the apply trailer; a matching state prints nothing, and the per-session warnings keep their own payload.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-10-24T17:57:04Z
- **Completed:** 2026-10-24T18:23:42Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- `pending.ts` exports `composePendingReport({ cwd, scopes })` (returns `{ marketplaces, retained, needsApply }`, empty `marketplaces` when nothing is pending) and `notifyPendingReport(ctx, run, report)`. `pendingReconcile` is now compose, then either the empty notice or `notifyPendingReport`.
- `load.ts` composes the report over the readable scopes after the passes and sends, in order: the MCP migration notice, the pending block (when not empty), then the warnings cascade. It no longer reports invalid-config, layer-gap or source-mismatch rows itself.
- pending's invalid-config block carries a failed child with the redacted parse cause, so the cause the load used to show is not lost.
- The scenarios that start a session over a pending change state the block, and the catalog and JSON reference describe the load's output.

## Task Commits

1. **Task 1: End-to-end -- a hand edit plus a new session prints pending's block** - `e21e3536` (feat)
2. **Task 2: Every scenario that starts a session over a pending change states the block; docs follow** - `dd55f04a` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts` - composePendingReport, PendingReport, notifyPendingReport; invalid-config cause child
- `extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts` - the load's pending block, readable-scope filter, emission order, header
- `extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts` - optional `configOutcomes` sink on openScopePass; `notifyScopeOutcomes` split out of notifyScopePasses
- `test/orchestrators/reconcile/load.test.ts` - block, match, byte-identity, invalid config once, corrupt state once, payload order
- `test/orchestrators/reconcile/pending.test.ts` - composePendingReport cases, redacted cause, updated CFG-03 rows
- `test/orchestrators/reconcile/read-pass.test.ts` - the sink and notifyScopeOutcomes
- `test/index.test.ts` - the missing-dependency reload case states the `● helper (will install)` block; invalid-config constant renamed to the pending form
- `features/plugin/reconcile.feature` - the hand-edit scenario states the block; two new scenarios (nothing pending prints nothing; the D-21 `will disable` session block)
- `features/plugin/configuration.feature`, `apply.feature`, `git-source.feature` - session results stated
- `test/architecture/catalog-uat/fixtures/plugin-pending.ts`, `catalog-contract.test.ts`, `docs/output-catalog.md` - invalid-config-abort gains the cause child; EXPECTED_UTF8_BYTES 51_136 -> 51_283; pending and reconcile-applied-cascade intros
- `docs/json-output.md` - Origin: a load's pending changes are a `cascade` with `origin.kind` `load`, its warnings a `reconcile-applied-cascade`

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] read-pass.ts and read-pass.test.ts changed**
- **Found during:** Task 1
- **Issue:** `openScopePass` pushes the read pass's invalid-config and layer-gap rows into the shared outcomes before returning, and `notifyScopePasses` sends the migration notice and the warnings together. The load could not drop those rows, tell a read-pass throw from an invalid config, or put the block between the notice and the warnings without a change there.
- **Fix:** `ScopePassInput.configOutcomes` (optional; `outcomes` when absent) receives those rows, and `notifyScopeOutcomes` is exported, with `notifyScopePasses` now the notice plus `notifyScopeOutcomes`. apply.ts is untouched. Owner tests added for both.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts, test/orchestrators/reconcile/read-pass.test.ts
- **Verification:** read-pass owner suite (24 pass), 100% direct coverage, fallow green
- **Committed in:** e21e3536

**2. [Rule 1 - Bug in a test] index.test.ts missing-dependency case passed vacuously**
- **Found during:** Task 1
- **Issue:** with 0 stated emissions, the load's new block made the strict boundary throw inside `prepareResources`, whose catch (and the failing abort notice) swallowed it, so the test stayed green with no output checked.
- **Fix:** the case states 1 emission and the exact `● helper (will install)` block. I also logged that catch temporarily over the whole suite (not committed): only the deliberate refusal cases reach it.
- **Committed in:** e21e3536

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 test bug)
**Impact on plan:** both were needed for the plan's behavior and its proof. No scope creep.

## Issues Encountered

None beyond the deviations.

## Known Stubs

None.

## Deferred

- `docs/output-catalog.md` still has two "reload" phrasings for the layer error: the pending LAYER-06 state ("The layer error the next reload stops on ... before the reload") and `reload-layer-marketplace-undeclared` ("the reload stops for the scope"). Both should name `apply`. Left for the docs plan (29-14), outside this plan's named sections.

## Verification

- Task 1 `<verify>`: pending, load and index suites pass; 100% direct coverage for pending.ts, load.ts and read-pass.ts; `npm run lint` exit 0; `npm run fallow` exit 0; reconcile.feature (7 scenarios) and pending.feature (9) pass.
- Task 2 `<verify>`: `npm run test:cucumber` 780/780 scenarios; `npm run check:features` exit 0; catalog-contract, catalog-wire and json-output-docs tests pass.
- Acceptance: `export async function composePendingReport` in pending.ts = 1 (baseline 0); `composePendingReport` in load.ts = 3 (baseline 0); `Reconcile pending` in configuration.feature = 5 (baseline 3); both named reconcile scenarios pass.
- `npm run check` at plan end (HEAD dd55f04a, Node v26.12.1): **exit 0**. Tail of the log:

```text
passed typecheck (11.5 s)
passed lint (4.2 s)
passed lint:workflows (0.4 s)
passed fallow (5.5 s)
passed format:check (7.7 s)
passed test:corresponding (3.7 s)
passed check:features (3.3 s)
16 hooks (16 passed)
780 scenarios (780 passed)
7461 steps (7461 passed)
Merged LCOV: coverage/direct.lcov (284 records)
exit=0
```

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-29-17: composePendingReport stays in pending.ts, outside NETWORK_SEAMS (lint green). T-29-18: the cause child is redacted and named by basename; pending.test.ts asserts an EACCES cause carries only `claude-plugins.json`. T-29-19: load.test.ts asserts one block for an invalid config and one row for a corrupt state.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The load and `pending` now share one composer, so later plans that add pending rows (the D-14 `will update` catalog moves, the D-12 blocked rows) only need to change `composePendingReport` for the load to show them too.

## Self-Check: PASSED
