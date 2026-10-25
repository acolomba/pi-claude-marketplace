---
phase: 29-load-converges-on-the-catalog
plan: 06
subsystem: notifications
tags: [pending, apply, marketplace-status, closed-set, output-catalog, json-output, cucumber]

requires:
  - phase: 29-load-converges-on-the-catalog
    provides: "29-02: apply makes the marketplace add and remove a hand-edited config declares"
  - phase: 29-load-converges-on-the-catalog
    provides: "29-03: planListNeedsApply and the needsApply envelope fact select the apply trailer"
provides:
  - "MarketplaceStatus and StatusToken gain `will add` and `will remove`; MpWillAdd / MpWillRemove join MarketplaceNotificationMessage"
  - "renderMpHeader renders `● <name> [<scope>] (will add)` and `(will remove)`, with no reasons"
  - "buildReconcilePendingNotification folds marketplacesToAdd into `will add` blocks and marketplacesToRemove into `will remove` blocks (header shown with no plugin)"
  - "planListNeedsApply and isReconcilePlanListEmpty count every marketplace add and remove"
  - "Catalog state marketplace-remove-no-plugins; 310 states, EXPECTED_UTF8_BYTES = 51_136"
affects: [29-08, pending, load, notifications, output-catalog]

actuals:
  tokens: 18650
  tasks: 2
  commits: 2
plan_head_before: e50bd35c866c1cddf8bec6a32c618345eb09507e
plan_head_after: 0a672ff0ee2c51a12e94e560f8954c3e58ba95ea

tech-stack:
  added: []
  patterns:
    - "A pending-tense marketplace header is a status on the block (severity info, needsReload false), so it counts as one success in the tally"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - schema/claude-plugin.schema.json
    - test/shared/notification-wire.test.ts
    - test/shared/notification-grammar.test.ts
    - test/shared/notification-types.test.ts
    - test/orchestrators/reconcile/notify.test.ts
    - test/orchestrators/reconcile/pending.test.ts
    - test/edge/handlers/plugin/pending.test.ts
    - test/architecture/compat-01-no-expansion.test.ts
    - test/architecture/notify-closed-set-locks.test.ts
    - test/architecture/notify-will-reload-agreement.test.ts
    - test/architecture/catalog-uat/fixtures/plugin-pending.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts
    - test/architecture/catalog-uat/catalog-parser.test.ts
    - test/architecture/catalog-uat/catalog-wire.test.ts
    - docs/output-catalog.md
    - docs/json-output.md
    - docs/messaging-style-guide.md
    - features/plugin/pending.feature
    - features/plugin/apply.feature

key-decisions:
  - "The `will add` / `will remove` blocks stamp severity info and needsReload false, so each counts as one success in the pending tally and never asks for a reload (D-20)"
  - "The marketplace add and remove folds moved into a private pushMarketplaceActions helper, because the inline loops pushed buildReconcilePendingNotification to cognitive complexity 16"
  - "notify-will-reload-agreement.test.ts keeps both assertion sets; WILL-02 now covers the plugin-level tokens only, and the realized marketplace forms are D-20 bookkeeping"
  - "Pending scenarios state the header through the `marketplace status` column of `the result lists these plugins:`, and the no-plugin case through `the result lists these marketplaces:`"

patterns-established:
  - "A pending preview of a marketplace change raises the tally success count by one per marketplace (two scopes that each add `mp` with one plugin read 4 successes)"

requirements-completed: []

coverage:
  - id: D1
    description: "pending lists a declared, unadded marketplace under a `(will add)` header and its child installs under it"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/notify.test.ts#D-20: rides a planned install of a newly added marketplace on its will-add header"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#MIG-01 / D-20: a local-only marketplace merges over the state projection as a will-add header and adds no uninstalls"
        status: pass
      - kind: e2e
        ref: "features/plugin/pending.feature#Pending lists a marketplace that a config declares by hand with no plugin"
        status: pass
    human_judgment: false
  - id: D2
    description: "pending lists a recorded, undeclared marketplace under a `(will remove)` header with its `(will uninstall)` rows, and shows the header with no plugin"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/notify.test.ts#D-20: previews a marketplace removal with no recorded plugins as a bare will-remove header"
        status: pass
      - kind: e2e
        ref: "features/plugin/pending.feature#Pending lists the marketplace remove and an uninstall with its version for each plugin of a marketplace the base config no longer declares"
        status: pass
    human_judgment: false
  - id: D3
    description: "apply removes a marketplace the base config no longer declares and uninstalls its plugins"
    requirement: APL-01
    verification:
      - kind: e2e
        ref: "features/plugin/apply.feature#Apply removes a marketplace the base config no longer declares and uninstalls its plugins"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every closed-set gate, the wire schema, the catalog and the JSON reference know the two statuses"
    verification:
      - kind: unit
        ref: "test/architecture/notify-closed-set-locks.test.ts; test/architecture/compat-01-no-expansion.test.ts; test/architecture/wire-schema.test.ts; test/architecture/catalog-uat/catalog-contract.test.ts; test/architecture/json-output-docs.test.ts"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-10-24
status: complete
---

# Phase 29 Plan 06: Pending Previews Marketplace Adds and Removes Summary

**`/claude:plugin pending` now shows `● <name> [<scope>] (will add)` for a marketplace a config declares and the scope has not added, and `● <name> [<scope>] (will remove)` for a recorded marketplace no config declares, with its `(will uninstall)` rows. Both count toward the apply trailer and `needsApply` (D-20).**

## Performance

- **Duration:** 24 min
- **Started:** 2026-10-24T17:04:24Z
- **Completed:** 2026-10-24T17:28:42Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments

- `notification-types.ts`: `"will add"` and `"will remove"` follow `"will disable"` in `StatusToken` and `"skipped"` in `MarketplaceStatus`. `MpWillAdd` and `MpWillRemove` join `MarketplaceNotificationMessage`.
- `notification-wire.ts`: `MARKETPLACE_STATUSES` has both members; the schema was regenerated.
- `notification-grammar.ts`: `renderMpHeader` has a `(will add)` arm and a `(will remove)` arm. They interpolate only the name and the scope (T-29-13). No other production switch needed a change; the compiler named only this one.
- `reconcile/notify.ts`: `ReconcileBlockStatus` takes both tokens. `blockToMarketplaceMessage` stamps them `severity: "info"`, `needsReload: false`. `pushMarketplaceActions` folds the adds and removes before the plugin buckets, so an added marketplace's installs land in its block. A remove with no plugin still shows its header. `planListNeedsApply` and `isReconcilePlanListEmpty` count every add and remove. The header comments say D-20 supersedes WILL-01 / WILL-03 / D-65.1-02 / D-65.1-03.
- The closed-set locks read 26 status tokens and 9 marketplace statuses. The COMPAT-01 lists and the notification-types exhaustiveness proof list the two members.
- `docs/output-catalog.md`: the status table reads 9 members and has the two new rows. The two add states and the remove state show the new headers. The new state "Marketplace remove with no installed plugins" (`marketplace-remove-no-plugins`) is documented. 310 states, 51_136 bytes.
- `docs/json-output.md` lists `will add`, `will remove`. `docs/messaging-style-guide.md` replaces the WILL-01 sentence with D-20.
- `pending.feature`: the two hand-declared scenarios show `will add` with success count 2. The `{}` scenario shows `will remove` with success count 3. A new scenario covers a declared marketplace with no plugin. `apply.feature` has "Apply removes a marketplace the base config no longer declares and uninstalls its plugins".

## Task Commits

1. **Task 1: End-to-end `(will add)` header for a hand-declared marketplace** - `d367c781` (feat). Tracer gate: the full `<verify>` chain ran again after the commit and passed (19 scenarios, both coverage runs at 100%).
2. **Task 2: The catalog and the references name `(will add)` and `(will remove)`** - `0a672ff0` (docs)

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two test files outside the plan's list pinned the old forms**
- **Found during:** Task 1
- **Issue:** `test/shared/notification-types.test.ts` has its own exact-member lists and an exhaustive switch over `MarketplaceStatus`, so the typecheck failed. `test/edge/handlers/plugin/pending.test.ts` expected bare headers for a marketplace no scope records.
- **Fix:** The types test lists both members and handles them in its switch. The edge test's blocks read `(will add)` and its counts are 4 / 2 / 2.
- **Committed in:** d367c781

**2. [Rule 1 - Bug] Stale WILL-03 doc comment in reconcile/types.ts**
- **Found during:** Task 1
- **Issue:** The `PlannedMarketplaceRemove.plugins` comment said de-registration is immediate and the rows sit under a bare header.
- **Fix:** It says the rows sit under the `will remove` header (D-20).
- **Committed in:** d367c781

**3. [Rule 3 - Blocking] Cognitive complexity 16 in buildReconcilePendingNotification**
- **Found during:** Task 1 (ESLint `sonarjs/cognitive-complexity`)
- **Fix:** The two marketplace loops moved to the private `pushMarketplaceActions` helper. ESLint and `fallow health` both pass.
- **Committed in:** d367c781

**4. [Rule 3 - Blocking] Catalog count pins in two files outside the plan's list**
- **Found during:** Task 2
- **Issue:** `catalog-parser.test.ts` pins the tuple count (309) and `catalog-wire.test.ts` pins PRESENTED (319) and the emitted keys (309).
- **Fix:** 310, 320 and 310.
- **Committed in:** 0a672ff0

**5. [Rule 1 - Behavior follow-on] The apply scenario's rows carry no version**
- **Found during:** Task 1
- **Issue:** The `(uninstalled)` rows of a marketplace-remove cascade carry no version, so the scenario's first draft with a `version` column failed.
- **Fix:** The scenario states no version column. The production rows are unchanged; this is how `marketplace remove` rows already render.
- **Committed in:** d367c781

**Total deviations:** 5 auto-fixed (3 blocking, 2 bug or follow-on). **Impact:** none outside the plan's intent; no production behavior beyond D-20 changed.

## Verification

- Task 1 `<verify>` chain: passed (rerun as the tracer gate).
- Task 2 `<verify>` chain: passed, `npm run test:unpaired` included.
- `npm run test:integration`: passed.
- Acceptance greps: `"will add"` in notification-wire.ts = 1; `(will remove)` in notification-grammar.ts = 1; `will add` in pending.feature = 3; `marketplace-remove-no-plugins` marker = 1; `9-member \`MARKETPLACE_STATUSES\`` = 1; `will remove` in json-output.md = 1.
- `npm run check` at plan end (HEAD 0a672ff0): **exit 0**. Tail of the log:

```text
passed typecheck (11.7 s)
passed lint (4.2 s)
passed lint:workflows (0.4 s)
passed fallow (5.3 s)
passed format:check (7.5 s)
passed test:corresponding (3.8 s)
passed check:features (3.3 s)
16 hooks (16 passed)
777 scenarios (777 passed)
7418 steps (7418 passed)
Merged LCOV: coverage/direct.lcov (284 records)
```

## Known Stubs

None. The catalog rows name "the load's pending block", which 29-08 adds; the plan worded the rows that way on purpose.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- 29-08 (the load's pending block) can call `buildReconcilePendingNotification` as is: the marketplace headers come with it.
- Any test that runs pending over a marketplace the scope has not added, or a recorded marketplace no config declares, now expects the header status and one more success.

## Self-Check: PASSED

- d367c781 and 0a672ff0 are ancestors of HEAD.
- All key files exist.
