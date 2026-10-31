---
phase: 04-wire-schema-and-json-strategy
plan: "02"
subsystem: notifications
tags: [wire-payload, llm-tools, presentation, json-schema, reconcile]

requires:
  - phase: 04-wire-schema-and-json-strategy
    provides: presentCascade, NOTIFICATION_PAYLOAD_SCHEMA (cascade kind), toWirePayload, plugin tool wire details
provides:
  - loadMarketplaceListBlocks, the marketplace-list block loader the command and the LLM tool share
  - pi_claude_marketplace_list details as wire marketplace blocks (LLMT-01)
  - presentUpdateNoOp, ReconcileAppliedPresentation, presentReconcileApplied (WIRE-05)
  - the reconcile-applied-cascade wire kind and its toWirePayload arm
  - schema/claude-plugin.schema.json regenerated with both cascade-family kinds
affects: [04-03, 04-04, 04-05, json-output]

actuals:
  tokens: 22600
  tasks: 2
  commits: 2
plan_head_before: 8256f9e3e4f9ecc7edf145533f8671a7c93b5add
plan_head_after: 2c561635396092252b734cef56c6677c882d688c

tech-stack:
  added: []
  patterns:
    - "toWirePayload switches on presentation.kind with no default arm; noOp is written by the cascade arm only, so a reconcile-applied payload cannot carry it"
    - "Schema tests read one union member's leaf errors (`NOTIFICATION_PAYLOAD_SCHEMA.anyOf`), because the union reports every member's errors"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - extensions/pi-claude-marketplace/shared/notification-present.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - schema/claude-plugin.schema.json
    - scripts/check-unused-type-members.contracts.json
    - tests/orchestrators/marketplace/list.test.ts
    - tests/orchestrators/marketplace/list.messaging.test.ts
    - tests/edge/handlers/tools.test.ts
    - tests/architecture/soft-dep-marker-policy.test.ts
    - tests/shared/notification-present.test.ts
    - tests/shared/notification-json.test.ts
    - tests/shared/notification-wire.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/shared/notification-resolve.test.ts
    - tests/scripts/generate-wire-schema.test.ts

key-decisions:
  - "The marketplace LIST_CONTEXT is renamed MARKETPLACE_LIST_CONTEXT: tools.ts imports both list contexts, and fallow reports a duplicate export when one production module imports two same-named exports"
  - "composeContextBlocks stays in notification-dispatch.ts as the cascade formatter's block composer: it is the only production reader of grammar's exported renderMpHeader and composePluginLines, which about 110 test call sites import. composeMarketplaceBlock becomes grammar-private instead"
  - "A reconcile-applied envelope never needs a reload (the reconcile runs on /reload), so its payload carries needsReload false"

patterns-established:
  - "An LLM tool builds details as toWirePayload(presentCascade(openNotificationRun(pi), <the command's own blocks>, <the command's row policies>)).marketplaces"

requirements-completed: [LLMT-01, WIRE-05]

duration: 85min
completed: 2026-10-03
status: complete
---

# Phase 4 Plan 02: Cascade-Family Presentations and Marketplace Tool Summary

**The marketplace LLM tool now returns the wire blocks of the blocks `/claude:plugin marketplace list` emits. The central cascade arm, the update no-op, and both reconcile-applied paths format their text from one presentation. The wire union gains the `reconcile-applied-cascade` kind, and `noOp` appears only on a no-op cascade.**

## Performance

- **Duration:** about 85 min
- **Started:** 2026-10-03T13:37:32Z
- **Completed:** 2026-10-03T15:02:33Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments

- `loadMarketplaceListBlocks` holds the per-scope, per-record loop of `listMarketplaces`, which still emits the same cascade through `notifyWithContext`. `list.ts` stays a named NFR-5 target, and the network gate passes.
- `pi_claude_marketplace_list` returns `details.marketplaces` as wire blocks `{ name, scope, plugins: [], details? }`, built from one notification run per non-empty invocation (three `getAllTools` reads). The content lines are byte-identical. The empty path still returns `details: { marketplaces: [] }`.
- `presentUpdateNoOp` (rows, then `resolveUpdateNoOpEnvelope`, with no advisories) and `presentReconcileApplied` (rows, then `resolveEnvelope`) join `presentCascade`. `NotificationPresentation` is the union of the cascade and reconcile-applied presentations.
- The dispatch now presents first on the central `notify` cascade arm, `emitContextCascade`, `emitUpdateNoOpCascade`, `emitReconcileAppliedContextCascade`, and the central reconcile-applied arm. `dispatchInfoMessage` takes the run. `emitCascadeWith` is deleted.
- `NOTIFICATION_PAYLOAD_SCHEMA` is `[cascade, reconcile-applied-cascade]`. `toWirePayload` has one arm per kind. The committed schema is regenerated, and the drift test lists both kinds.

## Task Commits

1. **Task 1: The marketplace LLM tool converts the list command's own blocks**: `6c723910` (feat). TASK_BASE `8256f9e3e4f9ecc7edf145533f8671a7c93b5add`.
2. **Task 2: Every cascade-family emission presents before the text strategy formats it**: `2c561635` (feat). TASK_BASE `6c723910`.

Each task commit contains its failing-first owner tests and the implementation.

## TDD Evidence

- Task 1 RED: the rewritten `tests/edge/handlers/tools.test.ts` ran against the HEAD `tools.ts` and exited 1, with 2 of 36 failing (the details still held `pluginCount` and `source`). GREEN: 36/36. The new `loadMarketplaceListBlocks` cases could not run red against a missing export.
- Task 2 RED: the new present, json, wire, and schema tests ran against the HEAD shared modules and schema (TAP) and exited 1, with 5 failing (`presentUpdateNoOp` and `presentReconcileApplied` missing, the reconcile kind absent from the schema). GREEN: all pass.

## Verification

- Task 1: typecheck clean. The list (5 new cases), list.messaging, tools (36), no-orchestrator-network, and soft-dep-marker-policy suites pass (80 tests). Direct coverage is 100% for `list.ts` (17/17 branches) and `tools.ts` (79/79). `lint:type-members` passes, and `fallow dead-code` exits 0. The catalog diff against `4e6c568a` is empty, and `catalog-contract.test.ts` passes 4/4.
- Task 2: typecheck clean. The present, json, wire, dispatch (file unchanged), notify-context (file unchanged), generate-wire-schema, grammar, and resolve suites pass (516 tests). Direct coverage is 100% for notification-present (8/8 branches), -json (98/98), -wire (4/4), -dispatch (52/52), and -grammar (181/181). `lint:type-members` passes, and `npm run fallow` exits 0.
- Corpus wrapper: `Corpus: 3134 present, 0 extra` (exit 0).
- Catalog: `git diff --exit-code 4e6c568a -- docs/output-catalog.md` is empty. `catalog-contract.test.ts` and `presentation-sink.test.ts` pass 17/17.
- Schema: `npm run schema:generate && git diff --exit-code -- schema/claude-plugin.schema.json` exits 0 at `2c561635`.
- Acceptance: `loadMarketplaceListBlocks(` appears on exactly three lines. No tools.ts contract entry remains. No content-line literal was removed from the tools test diff. `presentUpdateNoOp(run, message, rowPolicies)` and `presentCascade(run, message, CENTRAL_ROW_POLICY)` each appear once. The dispatch and notify-context tests have no diff from TASK_BASE. `emitCascadeWith` is gone, but `composeContextBlocks` remains (deviation 2).
- Task 1: focused task verification passed; full phase/PR verification pending.
- Task 2: focused task verification passed; full phase/PR verification pending.

### Full-check evidence

Both task pre-commit runs selected the full scope (`check:changed --list` reports `scope: full`, reason "Shared, removed, configuration, or unclassified inputs"). Task 2's run (`SKIP=trufflehog pre-commit run --files` over the 13 Task 2 paths, log `precommit-t2.log`, `PRECOMMIT_EXIT=0`, Node v26.10.0) ran on the exact tree committed as `2c561635`, with no other uncommitted changes. Under the local-verification reuse rule, it counts as that tree's `npm run check`, so the plan verification step reuses it.

## Contract Entries (scripts/check-unused-type-members.contracts.json)

Deleted (the members no longer exist):
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts:103:9` (marketplaces.name)
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts:104:9` (marketplaces.scope)
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts:105:9` (marketplaces.pluginCount)
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts:106:9` (marketplaces.source)

Re-pinned by line only:
- `notification-dispatch.ts:254:43` -> `:260:43` (dispatchInfoMessage.message `kind`), filter `:254:12` -> `:260:12`

No contract or exception entry was added.

## User-visible Change

The `pi_claude_marketplace_list` tool's `details.marketplaces` entries are now wire blocks: `{ name, scope, plugins: [] }`, plus `details: { autoupdate, lastUpdatedAt? }` when autoupdate is on or a last-update time is recorded. They no longer carry `pluginCount` or the parsed `source`, whose `raw` form can carry URL userinfo. The content line `[<scope>] <name> -- <N> plugin(s) -- <source.logical>` is unchanged and still states both.

**Carried risk T-04-06 (accepted):** the content line echoes `sourceLogical` of a stored url source into the agent's context. A url the user stored with userinfo still reaches the agent through that line, as it did before this phase. PMOD-04 covers the `/claude:plugin` presentations only, so a fix for the tool line needs its own scheduling.

## Decisions Made

- The reconcile-applied payload carries `tally` when the message is plural and labeled. It never carries `noOp`, `advisories`, or `retainedWorkflows`, and the wire schema rejects `noOp` on it.
- `summary` is copied verbatim from the envelope. The WIRE-05 idempotency case proves this with a summary no composer writes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed the marketplace `LIST_CONTEXT` to `MARKETPLACE_LIST_CONTEXT`**
- **Found during:** Task 1 (`fallow dead-code`: duplicate export `LIST_CONTEXT` once tools.ts imported both list contexts)
- **Fix:** renamed the export at its declaration, following the `PLUGIN_INFO_CONTEXT` precedent, and updated list.ts, tools.ts, `list.messaging.test.ts`, and the two `soft-dep-marker-policy.test.ts` labels.
- **Commit:** 6c723910

**2. [Rule 3 - Blocking] `composeContextBlocks` kept; `composeMarketplaceBlock` made grammar-private**
- **Found during:** Task 2 (`fallow dead-code`: deleting `composeContextBlocks` left `renderMpHeader` and `composePluginLines` with no production reader. Switching the formatter back to them then left `composeMarketplaceBlock` unread.)
- **Issue:** the plan asked for the deletion so every block would come from `composeMarketplaceBlock`. The two lower-level composers are imported by about 110 call sites in 14 test files, and the milestone forbids `fallow-ignore`.
- **Fix:** the shared cascade formatter composes blocks through `composeContextBlocks` (same bytes; the dispatch, notify-context, corpus, and catalog gates pin them). `composeMarketplaceBlock` lost its `export`. Its 11 test call sites in `notification-grammar.test.ts` and `notification-resolve.test.ts` now read a one-block body through `composeReconcileAppliedBody([mp])`, which returns the same string. The acceptance grep `! git grep -w composeContextBlocks` therefore fails by design.
- **Follow-up:** recorded in `.planning/WINDOWS.md` (kind `deviation`). A single composer needs the grammar and messaging tests to move to `composeReconcileAppliedBody` or `formatEnvelopeArguments` first.
- **Commit:** 2c561635

**3. [Rule 3 - Blocking] Wire schema tests read one union member's errors**
- **Found during:** Task 2 (`notification-wire.test.ts`: 8 rejection cases failed because the two-member union reports both members' leaf errors)
- **Fix:** `leafErrors` compiles the member its payload's kind names (`NOTIFICATION_PAYLOAD_SCHEMA.anyOf`). Each case also asserts that the union rejects the payload. Two cases were added: the union accepts a full reconcile-applied payload, and it rejects `noOp` on one.
- **Commit:** 2c561635

**4. Test structure:** the new loader and presentation cases use one top-level `describe()` per exported entrypoint. The existing `presentCascade` cases moved into `describe("presentCascade")` with their bodies unchanged. The existing `listMarketplaces` cases stay at the top level, as the plan required.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Issues Encountered

None beyond the deviations above.

## Requirements

No later plan of this phase declares LLMT-01 or WIRE-05. Both LLM tools now build `details` from the JSON strategy (LLMT-01), and every cascade-family payload carries `summary`, `tally`, and `noOp` per WIRE-05, so both are marked complete.

## Next Phase Readiness

04-03 adds the info-kind presentations and `presentNotification`, appends their wire kinds after `reconcile-applied-cascade`, and extends the drift test's kind list again. `toWirePayload` already switches on `kind`. Any edit to `notification-wire.ts` must be followed by `npm run schema:generate` and a commit of the regenerated file.

## Self-Check: PASSED
