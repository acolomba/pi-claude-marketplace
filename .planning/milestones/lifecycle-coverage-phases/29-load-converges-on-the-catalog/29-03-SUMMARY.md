---
phase: 29-load-converges-on-the-catalog
plan: 03
subsystem: notifications
tags: [pending, apply, notification-grammar, json-wire, schema, output-catalog, cucumber]

requires:
  - phase: 29-load-converges-on-the-catalog
    provides: "29-01: /claude:plugin apply (the command the trailer names)"
provides:
  - "CascadeNotificationMessage.needsApply?: true, set only by the pending composer"
  - "notifyWithContext options bag accepts needsApply beside advisories and retainedWorkflows"
  - "needsApply: boolean envelope fact on InfoEnvelope / AttentionEnvelope (true only for a cascade whose message sets it; false on the update no-op envelope)"
  - "APPLY_HINT_TRAILER = \"/claude:plugin apply to make these changes\", folded by formatEnvelopeArguments as the last segment, after the reload trailer"
  - "CASCADE_PAYLOAD_SCHEMA.needsApply optional literal true; wireCascade emits it only when true; schema/claude-plugin.schema.json regenerated"
  - "planListNeedsApply(plans) in orchestrators/reconcile/notify.ts; isReconcilePlanListEmpty is now !planListNeedsApply plus no source mismatch"
  - "docs: pending catalog intro + six states with the trailer, cascade needsApply row in docs/json-output.md, 'Computed apply trailer' bullet in docs/messaging-style-guide.md"
affects: [29-04, 29-05, 29-08, pending, apply, load, notifications]

actuals:
  tokens: 21150
  tasks: 2
  commits: 3
plan_head_before: c6c0c935e11ee4ddf760ae7b74ec3378cdea3a4c
plan_head_after: 1ac9a78c6168e3592c430bc93fc03031564b649f

tech-stack:
  added: []
  patterns:
    - "A trailer is an envelope fact: the producer sets a message flag, resolve turns it into a boolean, the grammar maps it to a fixed literal, the JSON strategy emits an optional literal-true field"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - schema/claude-plugin.schema.json
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
    - test/shared/notify-context.test.ts
    - test/shared/notification-resolve.test.ts
    - test/shared/notification-grammar.test.ts
    - test/shared/notification-json.test.ts
    - test/shared/notification-wire.test.ts
    - test/shared/notification-present.test.ts
    - test/orchestrators/reconcile/notify.test.ts
    - test/orchestrators/reconcile/pending.test.ts
    - test/edge/handlers/plugin/pending.test.ts
    - test/architecture/catalog-uat/fixtures/plugin-pending.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts
    - features/plugin/pending.feature
    - docs/output-catalog.md
    - docs/json-output.md
    - docs/messaging-style-guide.md

key-decisions:
  - "The apply trailer reads `/claude:plugin apply to make these changes` (no terminal period, no interpolation), folded after the tally and after the reload trailer when both are set"
  - "needsApply counts the same buckets isReconcilePlanListEmpty counted, minus source mismatches; isReconcilePlanListEmpty is re-expressed through planListNeedsApply so the two cannot drift"
  - "The notify.test.ts bucket table is hoisted to CHANGE_BUCKETS and SOURCE_MISMATCH_ACTIONS, shared by the isReconcilePlanListEmpty and planListNeedsApply cases"
  - "docs/json-output.md's needsApply row landed with the code commit, not the docs commit: the json-output-docs gate runs in the commit hook and fails while the schema has an undocumented field"

patterns-established:
  - "A new optional cascade wire field needs its docs/json-output.md row in the same commit as the schema change"

requirements-completed: [APL-04]

coverage:
  - id: D1
    description: "A pending list with at least one change ends with the block `/claude:plugin apply to make these changes`, after the tally, one blank line above"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts"
        status: pass
      - kind: unit
        ref: "test/shared/notification-grammar.test.ts#formatEnvelopeArguments APL-04 / D-14: puts the apply trailer last, one blank line below the tally"
        status: pass
      - kind: unit
        ref: "test/shared/notify-context.test.ts#APL-04 / D-14: a caller-supplied needsApply ends the cascade with the apply trailer"
        status: pass
      - kind: unit
        ref: "test/edge/handlers/plugin/pending.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The pending JSON cascade payload carries needsApply: true only when its list holds a change; the schema accepts it, rejects needsApply false, and rejects it on a reconcile-applied payload"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/shared/notification-json.test.ts#APL-04 / D-14: emits needsApply true when the envelope needs apply"
        status: pass
      - kind: unit
        ref: "test/shared/notification-wire.test.ts"
        status: pass
      - kind: unit
        ref: "test/architecture/wire-schema.test.ts"
        status: pass
      - kind: e2e
        ref: "features/plugin/pending.feature (six scenarios state needs apply true)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A pending list of failures alone (source mismatch, invalid config, layer gap) and the empty list carry no apply trailer and no needsApply"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#APL-04 / D-14: a list whose only row is a source mismatch carries no apply trailer"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/notify.test.ts#planListNeedsApply"
        status: pass
    human_judgment: false
  - id: D4
    description: "The output catalog, the JSON reference and the style guide document the apply trailer; the catalog fixtures render the six changed states byte for byte"
    requirement: APL-04
    verification:
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-wire.test.ts"
        status: pass
      - kind: unit
        ref: "test/architecture/json-output-docs.test.ts"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-10-24
status: complete
---

# Phase 29 Plan 03: Pending Advises Apply Summary

**`pending` now ends a list of changes with `/claude:plugin apply to make these changes`, and its JSON cascade carries `needsApply: true`. The value travels as an envelope fact from the message through resolve, grammar and the wire schema. A list of failures alone carries neither.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-10-24T15:14:28Z
- **Completed:** 2026-10-24T15:41:53Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments

- `CascadeNotificationMessage.needsApply?: true`, accepted by `notifyWithContext`, resolved into an envelope fact (`true` only for a cascade that sets it), and folded by `formatEnvelopeArguments` as the fixed literal `APPLY_HINT_TRAILER` after the reload trailer.
- `CASCADE_PAYLOAD_SCHEMA.needsApply: Type.Optional(Type.Literal(true))`. `wireCascade` adds it only when the envelope sets it, and `schema/claude-plugin.schema.json` is regenerated.
- `planListNeedsApply(plans)` counts install, uninstall, enable, disable, dependency-disable, dependency-install, and marketplace removals that still have plugins. `pending.ts` passes `needsApply: true` only when it holds. `isReconcilePlanListEmpty` is now `!planListNeedsApply(plans)` plus "no source mismatch".
- Six pending scenarios state `| needs apply | true |` (all six cascade scenarios with a `will ...` row; the empty-steady-state scenario is unchanged).
- The pending catalog section's intro now says what `pending` lists after this phase. The six states with a change end with the trailer, and the byte total moves from 50_296 to 50_560 (six times 44 bytes). The JSON reference and the style guide name the field and the trailer.

## Task Commits

1. **Task 1: End-to-end apply trailer on one pending install** - `1cab3b6d` (feat)
2. **Deviation fix: pending edge handler expectations** - `c2c870b0` (test)
3. **Task 2: The catalog, the JSON reference and the style guide name the apply trailer** - `1ac9a78c` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-types.ts` - `needsApply?: true` on the cascade message
- `extensions/pi-claude-marketplace/shared/notify-context.ts` - the options bag carries `needsApply`
- `extensions/pi-claude-marketplace/shared/notification-resolve.ts` - `needsApply` envelope fact
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` - `APPLY_HINT_TRAILER` and its fold
- `extensions/pi-claude-marketplace/shared/notification-json.ts` - `needsApplyField`
- `extensions/pi-claude-marketplace/shared/notification-wire.ts`, `schema/claude-plugin.schema.json` - the wire field
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` - `planListNeedsApply`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts` - sets the field; header paragraph
- `test/shared/*.test.ts`, `test/orchestrators/reconcile/{notify,pending}.test.ts`, `test/edge/handlers/plugin/pending.test.ts` - owner cases and updated expectations
- `test/architecture/catalog-uat/fixtures/plugin-pending.ts`, `catalog-contract.test.ts` - fixtures and byte total
- `features/plugin/pending.feature` - `needs apply` field in six scenarios
- `docs/output-catalog.md`, `docs/json-output.md`, `docs/messaging-style-guide.md` - documentation

## Decisions Made

- The trailer literal is `/claude:plugin apply to make these changes`, parallel to `/reload to pick up changes`. It has no period and interpolates nothing (T-29-09). With both flags set, the reload trailer comes first. No producer sets both today.
- `isReconcilePlanListEmpty` is defined through `planListNeedsApply`, so the two bucket lists cannot drift apart.
- The module header of `pending.ts` gained an APL-04 paragraph. The empty-plan paragraph still quotes the current `Pending: next reload will apply 0 actions.` literal, which 29-04 changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Envelope literals in `test/shared/notification-present.test.ts`**
- **Found during:** Task 1
- **Issue:** `needsApply` is a required envelope fact, so the 27 hand-written envelopes in `notification-present.test.ts` (not in the plan's file list) stopped typechecking.
- **Fix:** Added `needsApply: false` to each envelope literal.
- **Files modified:** test/shared/notification-present.test.ts
- **Committed in:** 1cab3b6d

**2. [Rule 3 - Blocking] `docs/json-output.md` row moved into the Task 1 commit**
- **Found during:** Task 1 (pre-commit check)
- **Issue:** `test/architecture/json-output-docs.test.ts` (run by the hook's `test:unpaired`) fails while the schema has a field the reference does not list.
- **Fix:** Added the `needsApply` row to the `cascade` field table in the Task 1 commit instead of Task 2.
- **Files modified:** docs/json-output.md
- **Committed in:** 1cab3b6d

**3. [Rule 1 - Bug] Pending edge handler expectations**
- **Found during:** Task 2 (the commit hook ran every pair because a shared fixture was staged)
- **Issue:** `test/edge/handlers/plugin/pending.test.ts` (not in the plan's file list) asserts the real pending output for planned installs. Its four expectations lacked the new trailer. The Task 1 hook ran only the staged pairs, so it did not catch them.
- **Fix:** Appended `\n\n/claude:plugin apply to make these changes` to the four expectations. The pair stays at 100% direct coverage.
- **Files modified:** test/edge/handlers/plugin/pending.test.ts
- **Committed in:** c2c870b0 (a separate commit; no amend)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All three follow from the new field and were needed to keep the gates green. No scope creep.

## Issues Encountered

None.

## Verification

- Task 1 `<verify>`: the eight owner test files plus `wire-schema.test.ts` passed (676 tests). Direct coverage passed at 100% for `notification-grammar.ts`, `notification-resolve.ts`, `reconcile/pending.ts`, `reconcile/notify.ts`, `notify-context.ts`, `notification-json.ts` and `notification-wire.ts`. `npx cucumber-js features/plugin/pending.feature` gave 7/7 scenarios. `configuration.feature`, `usage-errors.feature` and `apply.feature` gave 132/132.
- Task 2 `<verify>`: catalog-contract, catalog-wire and json-output-docs passed (171 tests). `npm run test:unpaired` exit 0.
- Acceptance: the trailer literal appears once in notification-grammar.ts; `needsApply` once in the schema; `export function planListNeedsApply` once; `| needs apply ` 6 times in pending.feature (= 6 pending scenarios with a `will ...` row). The catalog has 6 trailer lines; json-output.md has 1 `needsApply`; the style guide has 1 `Computed apply trailer`.
- Full `npm run check` after the last task commit: **exit 0**. Log tail:

```text
passed typecheck (11.6 s)
passed lint (4.3 s)
passed lint:workflows (0.4 s)
passed fallow (5.4 s)
passed format:check (7.7 s)
passed test:corresponding (3.7 s)
passed check:features (3.1 s)
16 hooks (16 passed)
774 scenarios (774 passed)
7389 steps (7389 passed)
Merged LCOV: coverage/direct.lcov (284 records)
```

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 29-04 changes the empty advisory text. The cascade arm already carries the apply trailer.
- 29-08 can reuse the trailer at load: pass `needsApply: true` through `notifyWithContext` (or set it on the cascade message) when `planListNeedsApply(plans)` holds.

## Self-Check: PASSED

- Commits 1cab3b6d, c2c870b0 and 1ac9a78c are ancestors of HEAD.
- Every modified file listed above exists.

---
*Phase: 29-load-converges-on-the-catalog*
*Completed: 2026-10-24*
