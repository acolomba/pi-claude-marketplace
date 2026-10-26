---
phase: 29-load-converges-on-the-catalog
plan: 04
subsystem: notifications
tags: [apply, pending, notification-grammar, output-catalog, json-output, cucumber]

requires:
  - phase: 29-load-converges-on-the-catalog
    provides: "29-02: apply.ts serves only the apply verb; load.ts owns the load"
  - phase: 29-load-converges-on-the-catalog
    provides: "29-03: the pending apply trailer and the needsApply envelope fact"
provides:
  - "ReconcilePendingEmptyMessage.command: \"pending\" | \"apply\" (required; text strategy only, not on the wire)"
  - "renderReconcilePendingEmpty(command): `Pending: /claude:plugin apply has nothing to change.` or `Apply: nothing to change.`"
  - "createApplyReconcile's operation notifies { kind: \"reconcile-pending-empty\", command: \"apply\" } when its pass accumulated no outcome, after the MCP migration notice"
  - "test/architecture/catalog-uat/fixtures/plugin-apply.ts: PLUGIN_APPLY_FIXTURES, state nothing-to-change"
  - "docs/output-catalog.md: `## /claude:plugin apply` section; pending empty states show the new text"
  - "docs/json-output.md: reconcile-pending-empty is reported by pending and apply, told apart by origin.commandId"
  - "features/plugin/apply.feature: 'Apply with nothing to change reports so and changes nothing'"
affects: [29-05, 29-08, apply, pending, notifications, output-catalog]

actuals:
  tokens: 17000
  tasks: 2
  commits: 2
plan_head_before: ee3612930cbdd3392b173a0d638f42a97cce6e50
plan_head_after: 7d0bc63b5a5837960a65cdcc56826887ceda800e

tech-stack:
  added: []
  patterns:
    - "One wire kind, two commands: the message carries a text-only discriminant and the JSON payload leaves it out, because origin.commandId already names the command"

key-files:
  created:
    - test/architecture/catalog-uat/fixtures/plugin-apply.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
    - test/shared/notification-grammar.test.ts
    - test/shared/notification-dispatch.test.ts
    - test/shared/notification-present.test.ts
    - test/shared/notification-json.test.ts
    - test/shared/notification-summary.test.ts
    - test/shared/notification-types.test.ts
    - test/orchestrators/reconcile/pending.test.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/orchestrators/plugin/enable-disable.test.ts
    - test/orchestrators/plugin/install-flow.test.ts
    - test/integration/mcp-migration.test.ts
    - test/integration/workflow-kind-inversion.test.ts
    - test/architecture/catalog-uat/fixtures/plugin-pending.ts
    - test/architecture/catalog-uat/fixture-maps.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts
    - test/architecture/catalog-uat/catalog-wire.test.ts
    - test/architecture/catalog-uat/catalog-parser.test.ts
    - features/plugin/apply.feature
    - docs/output-catalog.md
    - docs/json-output.md

key-decisions:
  - "The empty apply advisory reuses the reconcile-pending-empty kind with a required text-only command member; the JSON payload stays unchanged and origin.commandId names the command (D-08)"
  - "The apply operation sends the advisory where it used to return silently, after the MCP migration notice; notifyScopePasses stays shared and silent, so the load keeps D-05"
  - "The pending catalog fixtures and the two pending example lines moved into the Task 1 commit, because the typecheck and the catalog contract in the commit hook fail on a fixture without command"

patterns-established:
  - "A test that drives the apply operation over an empty pass expects exactly one `Apply: nothing to change.` notice (APPLY_EMPTY_NOTICE in apply.test.ts, mcp-migration.test.ts and workflow-kind-inversion.test.ts)"

requirements-completed: []

coverage:
  - id: D1
    description: "An apply with nothing to change reports `Apply: nothing to change.` and leaves state.json bytes and mtime and the configs unchanged"
    requirement: APL-01
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/apply.test.ts#RECON-05 / D-08: two consecutive reconciles over a converged scope report nothing to change and leave both files byte-identical and untouched"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/apply.test.ts#LOAD-01 / D-08: a scope whose declarations are all satisfied reports nothing to change and leaves state.json untouched"
        status: pass
      - kind: e2e
        ref: "features/plugin/apply.feature#Apply with nothing to change reports so and changes nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "An empty pending reports `Pending: /claude:plugin apply has nothing to change.`, with retained-workflow advisories folded under it"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts"
        status: pass
      - kind: unit
        ref: "test/shared/notification-dispatch.test.ts#WR-06: the retained-workflow advisory folds under the pending advisory"
        status: pass
      - kind: e2e
        ref: "features/plugin/pending.feature#Pending reports nothing when the configs and the records agree"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both reports are the reconcile-pending-empty kind; the JSON payload carries no command member"
    requirement: APL-01
    verification:
      - kind: unit
        ref: "test/shared/notification-json.test.ts#D-08: converts an apply-empty presentation to the bare envelope without its command"
        status: pass
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-wire.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The catalog documents the apply section and its nothing-to-change state; the JSON reference names both commands"
    requirement: APL-01
    verification:
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
      - kind: unit
        ref: "test/architecture/json-output-docs.test.ts"
        status: pass
    human_judgment: false

duration: 29min
completed: 2026-10-24
status: complete
---

# Phase 29 Plan 04: Apply Reports an Empty Pass Summary

**An apply with nothing to change now reports `Apply: nothing to change.` and writes nothing. An empty pending reports `Pending: /claude:plugin apply has nothing to change.`. Both are the `reconcile-pending-empty` kind, and a JSON consumer tells them apart by `origin.commandId`.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-10-24T15:45:59Z
- **Completed:** 2026-10-24T16:14:22Z
- **Tasks:** 2
- **Files modified:** 27 (1 created)

## Accomplishments

- `ReconcilePendingEmptyMessage.command` (`"pending" | "apply"`, required). `renderReconcilePendingEmpty(command)` picks the wording through an exhaustive switch. The dispatch arm passes it, and the JSON arm still projects only the envelope and the advisories.
- `apply.ts`: when `notifyScopePasses` reports no cascade, the operation sends `{ kind: "reconcile-pending-empty", command: "apply" }` and returns. The MCP migration notice still comes first. `notifyScopePasses` is unchanged, so the load stays silent on an empty pass (D-05).
- `pending.ts`: the empty branch sends `command: "pending"`. The module header quotes the new text.
- The catalog has a `/claude:plugin apply` section with the `nothing-to-change` state. Its fixture module is registered after the pending one. The gates count 22 modules, 22 sections, 309 states, and 50_605 example bytes.
- A new apply scenario installs `demo@fixtures`, runs `apply --scope project`, and expects `reconcile-pending-empty`, `info`, no reload, and the record unchanged.

## Task Commits

1. **Task 1: End-to-end empty apply reports `Apply: nothing to change.`** - `358d100a` (feat)
2. **Task 2: The catalog's `/claude:plugin apply` section and the JSON reference** - `7d0bc63b` (docs)

## Tests Changed for the Apply-Empty Notice

Each of these drove the apply operation over an empty pass and expected silence. Each now expects one `Apply: nothing to change.` notice. Nothing else about what they prove changed. Titles that claimed silence now say "reports nothing to change".

- `test/orchestrators/reconcile/apply.test.ts`: 15 cases (WR-05 x2, LOAD-03 x2, WR-06 x2, D-27, RECON-05, RECON-02, LOAD-01, D-06-02, LOAD-02 x2, NFR-5, AFILE-04, AMIG-03). AMIG-03 now reads "the migration notice precedes the apply-empty advisory when reconcile has no outcome".
- `test/orchestrators/plugin/enable-disable.test.ts`: both DFEN-07 cases (four reload expectations).
- `test/orchestrators/plugin/install-flow.test.ts`: the two "a converged pass" expectations (D-04-05 / CMP-3, DFEN-06 / CFG-02).
- `test/integration/mcp-migration.test.ts`: 12 cases. The `reload()` helper drives the apply operation with `reason: "reload"`. "sends no notice" became "sends no migration notice".
- `test/integration/workflow-kind-inversion.test.ts`: RECON-05 (both passes) and WCONV-01 / WCONV-02 (second pass).
- `hooks-cross-scope-reconcile`, `plugin-layer-consistency`, `reserved-record-keys` and `load-reconcile-race-child` needed no change. None of them asserts silence on an empty apply pass.

## Decisions Made

- `command` is required, not optional. The compiler then names every producer, and `notification-types.test.ts` holds a `@ts-expect-error` proof for a message without it.
- The advisory is sent in `applyReconcileWithReader`, not in the shared `notifyScopePasses`. That function also serves the load, which must stay silent.
- The `reconcile-applied-cascade` catalog intro now says that an empty load is silent and an empty apply emits the advisory. The reconcile README contract item 3 says the same.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pending catalog fixture and examples moved into Task 1**
- **Found during:** Task 1
- **Issue:** The required `command` member broke the typecheck of `fixtures/plugin-pending.ts`, a Task 2 file. The catalog contract (run by the hook's `test:unpaired`) then needed the new pending text in `docs/output-catalog.md` and a new byte total.
- **Fix:** Added `command: "pending"` to both pending fixtures. Changed the two example lines in the catalog and set `EXPECTED_UTF8_BYTES` to 50_580, all in the Task 1 commit. Task 2 made the remaining catalog changes.
- **Files modified:** test/architecture/catalog-uat/fixtures/plugin-pending.ts, docs/output-catalog.md, test/architecture/catalog-uat/catalog-contract.test.ts
- **Committed in:** 358d100a

**2. [Rule 3 - Blocking] Type literals in two tests the plan did not list**
- **Found during:** Task 1 (typecheck)
- **Issue:** `test/shared/notification-summary.test.ts` and `test/shared/notification-types.test.ts` hold `ReconcilePendingEmptyMessage` literals without `command`.
- **Fix:** Added `command` to each. Added a `@ts-expect-error` line for a message without it.
- **Committed in:** 358d100a

**3. [Rule 1 - Bug] Stale silence claim in the reconcile README**
- **Found during:** Task 1
- **Issue:** `orchestrators/reconcile/README.md` contract item 3 said that empty reconciles are silent. That is no longer true for apply.
- **Fix:** It now says that an empty apply reports the advisory and an empty load stays silent.
- **Committed in:** 358d100a

**4. [Rule 3 - Blocking] Tuple and section counts in `catalog-parser.test.ts`**
- **Found during:** Task 2
- **Issue:** `catalog-parser.test.ts` (not in the plan's list) pins 308 tuples and 21 sections. `catalog-wire.test.ts` also pins 318 presentations and 308 emitted keys.
- **Fix:** Set them to 309 / 22 and 319 / 309. Updated the contract test title from 21/308 to 22/309.
- **Committed in:** 7d0bc63b

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug)
**Impact on plan:** All four follow from the required field and the new catalog section. No scope creep.

## Issues Encountered

None.

## Notes for Later Plans

- A planned `pluginsToDependencyInstall` bucket counts as a change for `pending` (`planListNeedsApply`). But apply still drives it only with `reason: "reload"`, so today an apply over that plan says `Apply: nothing to change.` (see the LOAD-02 retry-bucket case). 29-05 drops that gate, and then the two agree.
- A first apply after an extension version bump can stamp `lastReconciledExtensionVersion` (the backfill gate) and still report `Apply: nothing to change.`, because the stamp alone is no outcome row.

## Verification

- Task 1 `<verify>`: the owner tests (grammar, dispatch, present, json, summary, types, pending, apply, enable-disable, install-flow) passed: 1306 tests, then 460 after the last enable-disable fix. Direct coverage passed at 100% for `reconcile/apply.ts`, `notification-grammar.ts`, `notification-dispatch.ts`, and `reconcile/pending.ts`. `npm run typecheck` exit 0. `npm run test:integration` exit 0. `npx cucumber-js features/plugin/apply.feature features/plugin/pending.feature` gave 17/17 scenarios, and the full cucumber suite gave 775/775.
- Task 2 `<verify>`: catalog-contract, catalog-wire, catalog-parser, and json-output-docs passed (186 tests). `npm run test:unpaired` exit 0.
- Acceptance: `"Apply: nothing to change."` 1, `"Pending: /claude:plugin apply has nothing to change."` 1 in notification-grammar.ts. `command: "apply"` 1 in apply.ts. `catalog-state: nothing-to-change` 1, the apply heading 1, and the old `Pending: next reload will apply 0 actions.` 0 in the catalog. `EXPECTED_SECTION_COUNT = 22` 1. The named scenario passes.
- Both commit hooks ran `npm run check:commit`: Passed.
- No file under `~/.pi/agent` changed during the run.
- Full `npm run check` after the last task commit: **exit 0**. Log tail:

```text
passed typecheck (11.8 s)
passed lint (4.3 s)
passed lint:workflows (0.4 s)
passed fallow (5.5 s)
passed format:check (7.8 s)
passed test:corresponding (3.6 s)
passed check:features (3.3 s)
16 hooks (16 passed)
775 scenarios (775 passed)
7398 steps (7398 passed)
Merged LCOV: coverage/direct.lcov (284 records)
```

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 29-05 can rely on an empty apply reporting the advisory. When it adds the reload trailer or drops the dependency-install gate, the empty branch in `applyReconcileWithReader` stays the one place that reports "nothing to change".
- 29-08 (the load block) keeps the load silent on an empty pass. `notifyScopePasses` has no empty-advisory behavior.

## Self-Check: PASSED

- Commits 358d100a and 7d0bc63b are ancestors of HEAD.
- test/architecture/catalog-uat/fixtures/plugin-apply.ts exists, and every modified file listed above exists.

---
*Phase: 29-load-converges-on-the-catalog*
*Completed: 2026-10-24*
