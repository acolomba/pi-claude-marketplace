---
phase: 01-presentation-model
plan: 03
subsystem: notify
tags: [notify, presentation-model, resolve-step, failure-detail, hints]

requires:
  - phase: 01-presentation-model
    provides: "01-02 notification-resolve.ts with the envelope resolve step, and the resolve -> format -> notify seam in dispatch"
provides:
  - "errors.ts: SerializedCauseChain, serializeCauseChain, formatCauseChain; causeChainTrailer rebuilt on them"
  - "notification-resolve.ts: ResolvedRollbackPhase, ResolvedFailure, ResolvedRowFacts (failure, hint), ResolvedRow<M>, ResolvedMarketplace, RowHint, resolveRows, resolveNotAddedReason"
  - "notification-types.ts: WithPlugins (moved from notify-context.ts)"
  - "notification-grammar.ts: formats resolved rows only; a module-private RowHint -> literal map"
  - "emitContextCascade, emitUpdateNoOpCascade, emitReconcileAppliedContextCascade take a hasRenderArm predicate"
affects: [01-presentation-model marker policy and resolved arms, json-output wire schema, PMOD-04 redaction]

actuals:
  tokens: 22432
  tasks: 2
  commits: 2
plan_head_before: e48b69b515045081b58dd6e641229963f6399c79
plan_head_after: 76e2383e8daf2a7f0873cfc6ec4dbf634b7febff

tech-stack:
  added: []
  patterns:
    - "Resolved row: a distributive Omit over the producer row union plus ResolvedRowFacts, so each member keeps its status discriminant"
    - "Rows resolve before the envelope and before any body text; the missing-render-arm floor is a resolve decision"
    - "Hints are ids in the model; the text strategy maps each id to its frozen literal through a map total over RowHint"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - tests/shared/errors.test.ts
    - tests/shared/notification-resolve.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/shared/notification-summary.test.ts
    - tests/shared/notification-types.test.ts
    - tests/shared/notify-context.test.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "dispatchInfoMessage keeps rendering the standalone body before it resolves the envelope, and resolves rows inside the reconcile-applied arm only, because getter-backed kind tests in notification-dispatch.test.ts pin that read order"
  - "The emitter hasRenderArm parameter is required; the dispatch and summary tests pass a stub that always returns true"
  - "hasRenderArmFor reads the render-map lookup as unknown, which satisfies no-unnecessary-condition and adds no Extract type-selection candidate"

patterns-established:
  - "Failure detail growth: add the fact to ResolvedFailure, serialize it in resolveFailure, and format it in composeFailureLines"
  - "New hint: add the id to RowHint, set it in resolveRow, and add its literal to ROW_HINT_TRAILERS (typecheck fails until the map is total)"

requirements-completed: [PMOD-03, PMOD-01]

coverage:
  - id: D1
    description: "serializeCauseChain walks the depth-5 cause chain once into causeChain strings and a truncated flag; formatCauseChain writes the one cause-line format; causeChainTrailer keeps its behavior for the producer-side callers"
    requirement: PMOD-03
    verification:
      - kind: unit
        ref: "tests/shared/errors.test.ts#serializeCauseChain"
        status: pass
      - kind: unit
        ref: "tests/shared/errors.test.ts#formatCauseChain"
        status: pass
      - kind: unit
        ref: "tests/shared/errors.test.ts#causeChainTrailer"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/errors.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "resolveRows gives each failed and manual-recovery row a failure member with the serialized cause, leaks, and rollback phases, floors a row with no render arm to error on the input row, and adds no key the input lacked; SC-4 @ts-expect-error proves a resolved failed row rejects a live Error"
    requirement: PMOD-03
    verification:
      - kind: unit
        ref: "tests/shared/notification-resolve.test.ts#resolveRows"
        status: pass
      - kind: unit
        ref: "tests/shared/notify-context.test.ts#a missing render arm reports its named row before the adjacent present arm"
        status: pass
      - kind: unit
        ref: "tests/shared/notify-context.test.ts#a frozen unnamed missing-arm row still precedes the adjacent present arm"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "The grammar formats the cause line, leaked lines, and rollback rows from row.failure and the hint line from row.hint, importing only formatCauseChain and SerializedCauseChain from errors.ts"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#composes descriptions, hints, causes, leaks, and rollback failures in order"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#renders the <hint> hint after the description and before any failure line"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notification-grammar.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Row hints resolve as ids (partial-install, partial-update, stale-gate-update, enable) and resolveNotAddedReason picks the marketplace-not-added token"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/shared/notification-resolve.test.ts#resolveRows"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-resolve.test.ts#resolveNotAddedReason"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#renders marketplace-not-added as <expected>"
        status: pass
    human_judgment: false
  - id: D5
    description: "Emitted bytes are unchanged: the wire corpus, the output catalog, and catalog-contract all match, and npm run check passes"
    requirement: PMOD-03
    verification:
      - kind: other
        ref: "node scripts/notify-corpus.mjs check"
        status: pass
      - kind: other
        ref: "git diff --exit-code 2f173031 -- docs/output-catalog.md"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false

duration: 67min
completed: 2026-09-29
status: complete
---

# Phase 1 Plan 03: Resolved Row Facts Summary

**`resolveRows` now serializes each failed row's cause chain, leaks, and rollback phases, turns hint flags into `RowHint` ids, and floors a row with no render arm to error before the envelope resolves. The grammar formats these facts and never walks an `Error`. All 2622 corpus entries and the output catalog are byte-identical.**

## Performance

- **Duration:** 67 min
- **Started:** 2026-09-29T15:39:13Z
- **Completed:** 2026-09-29T16:46:35Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- `errors.ts` exports `serializeCauseChain`, which returns `{ causeChain, truncated }` or `undefined` for `undefined` and `null`, and `formatCauseChain`, which writes `cause: a -> b` plus ` (truncated)`. Both reuse the one `causeChain` generator and `linkMessage`, so the depth bound, the cycle guard, and the `CleanupContextError` basename suffix each stay in one place. `causeChainTrailer` is rebuilt on the two. Its producer-side callers still work, and its doc comment names this as the single PMOD-04 redaction site.
- `notification-resolve.ts` adds `ResolvedRow<M>`, a distributive `Omit<M, "cause" | "rollbackPartial" | "partialHint" | "enableHint"> & ResolvedRowFacts`, plus `ResolvedMarketplace` and `resolveRows`. A failed or manual-recovery row gets `failure: { cause?, leaks, rollbackPartial }`. A flagged row gets one `hint` id. When the emitter's predicate reports no render arm, the guarded `severity = "error"` write lands on the input row. A frozen row keeps its severity, and the rejection goes to `hookDebugLog`.
- `resolveNotAddedReason` moved into resolve verbatim with its CMP-4 / SCOPE-01 comment. `renderMarketplaceNotAdded` now takes the resolved `Reason`.
- `WithPlugins` moved to `notification-types.ts`. Resolve does not import `notify-context.ts`, so the import graph stays acyclic.
- Every structured emitter resolves the rows, then the envelope, then renders the body from the resolved marketplaces. `dispatchRow` still renders the missing-arm diagnostic, but it no longer writes severity.
- The grammar deletes `renderIndentedCauseChain`, `composeRollbackPartialLines`, `partialHintTrailerFor`, `notAddedReasonFor`, and the enable-hint branch. `composeFailureLines` and the `ROW_HINT_TRAILERS` map replace them.

## Task Commits

1. **Task 1: Failure detail reaches the renderer as serialized data from resolved rows** - `e941b7bd` (feat)
2. **Task 2: Row hints and the not-added reason resolve as ids** - `76e2383e` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/errors.ts` - the structured cause-chain walk and the single cause-line formatter
- `extensions/pi-claude-marketplace/shared/notification-resolve.ts` - resolved row types, `resolveRows`, the missing-arm floor, hint ids, `resolveNotAddedReason`
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` - formats `row.failure` and `row.hint`, and reads only `formatCauseChain` and `SerializedCauseChain` from errors.ts
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` - resolve rows, then the envelope, then the body; `hasRenderArm` on the three context emitters; `composeContextBlocks`
- `extensions/pi-claude-marketplace/shared/notify-context.ts` - `hasRenderArmFor(context)` passed to the emitters; `dispatchRow` no longer writes severity; `WithPlugins` removed
- `extensions/pi-claude-marketplace/shared/notification-types.ts` - `WithPlugins`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` - imports `WithPlugins` from notification-types.ts
- `tests/shared/errors.test.ts` - `serializeCauseChain` and `formatCauseChain` cases with literal values
- `tests/shared/notification-resolve.test.ts` - `resolveRows` failure, floor, frozen-row, and hint cases; `resolveNotAddedReason`; the SC-4 `@ts-expect-error` proof
- `tests/shared/notification-grammar.test.ts` - composer cases use resolved-row literals; hint lines for each id; not-added reasons
- `tests/shared/notification-types.test.ts` - the `WithPlugins` satisfies case, moved from notify-context.test.ts
- `tests/shared/notification-dispatch.test.ts`, `tests/shared/notification-summary.test.ts` - direct emitter calls pass a `hasRenderArm` stub
- `tests/shared/notify-context.test.ts` - the `WithPlugins` case left; the missing-arm cases are unchanged
- `scripts/check-unused-type-members.contracts.json` - pins moved by line only; the `isDescriptionBearingRow` contract repinned to its new `Extract<ResolvedRow, ...>` position, with its purpose wording updated to name `ResolvedRow`

## Decisions Made

- `dispatchInfoMessage` still renders the standalone body before it resolves the envelope. Only the reconcile-applied arm needs rows, so it calls `resolveRows` inside its switch arm. Two getter-backed `kind` tests in `notification-dispatch.test.ts` pin how many times `kind` is read and in what order. Moving `resolveEnvelope` ahead of the switch would change their bytes.
- The emitters' `hasRenderArm` parameter is required, because every production caller has a render map. The direct emitter tests pass a stub that always returns `true`. The legacy `notify()` and the reconcile-applied standalone arm call `resolveRows` without a predicate.
- `hasRenderArmFor` reads the render-map lookup as `unknown` before the `!== undefined` test. The plain form fails `no-unnecessary-condition`. The `RenderFn<Extract<...>> | undefined` cast that `dispatchRow` uses would add a new `type-selection` candidate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Standalone emitter order kept as body, then envelope**
- **Found during:** Task 1
- **Issue:** The plan says every structured emitter resolves the envelope before it renders the body. The standalone path in `dispatchInfoMessage` reads `message.kind` in its switch. The getter-backed kind tests pin that read order, which the 01-02 summary also records.
- **Fix:** The cascade paths (`notify`'s cascade arm and the three context emitters) resolve rows, then the envelope, then the body. The standalone arm keeps its order and resolves rows inside the reconcile-applied case. `resolveRows` reads no `kind`.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`
- **Verification:** The dispatch getter cases pass, and the corpus check passes.
- **Committed in:** `e941b7bd`

**2. [Rule 3 - Blocking] `no-unnecessary-condition` on the render-arm predicate**
- **Found during:** Task 1
- **Issue:** `context.render[status as Status] !== undefined` fails ESLint, because the mapped type says every lookup is defined.
- **Fix:** The lookup is read into an `unknown` local first. The runtime test is the same.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify-context.ts`
- **Committed in:** `e941b7bd`

**3. [Rule 1 - Duplication] `composeContextBlocks` extracted in dispatch**
- **Found during:** Task 1
- **Issue:** The block rendering in `emitCascadeWith` and `emitUpdateNoOpCascade` grew. `fallow audit` then reported it as an introduced clone group (`dup:8660dbeb`).
- **Fix:** Extracted a private `composeContextBlocks(marketplaces, probe, renderPluginRowBody)`. Both emitters call it.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`
- **Verification:** `fallow audit` no longer lists the dispatch clone, and direct coverage for dispatch passes (45/45 branches).
- **Committed in:** `e941b7bd`

**4. [Plan wording] Private grammar helpers for the failure lines**
- **Found during:** Task 1
- **Issue:** The plan deletes `renderIndentedCauseChain` and `composeRollbackPartialLines`. Inlining all failure lines would push `composePluginLinesWith` toward the cognitive-complexity ceiling.
- **Fix:** Two module-private helpers, `composeFailureLines(failure)` and `pushCauseLine(lines, chain, indent)`, read only resolved facts. The line order matches the old output.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notification-grammar.ts`
- **Committed in:** `e941b7bd`

---

**Total deviations:** 4 (1 order-preserving bug avoidance, 1 blocking lint fix, 1 duplication fix, 1 structure adjustment).
**Impact on plan:** No scope change. The corpus, the catalog, and `npm run check` show no byte change.

## Issues Encountered

- The first `node scripts/notify-corpus.mjs check` after Task 1 failed because the type-member contract pins had moved, so `unused-type-member-gate.test.ts` failed. After a line-mapped repin, the check passed. The 01-02 run hit the same failure.
- An out-of-band `partialHint` or `enableHint` on a status that does not declare it passes through to the resolved copy unchanged, and it yields no hint. `resolveRows` destructures only the keys each status declares. A test pins this whole value.

## Verification

- `node scripts/notify-corpus.mjs check`: `Notify corpus check passed: 2622 baseline entries present, 0 extra.` It passed after Task 1, after the Task 1 dispatch refactor (tracer re-run), and after Task 2.
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty (exit 0).
- `tests/architecture/catalog-uat/catalog-contract.test.ts`: passes.
- Direct coverage passed for errors.ts (138/138 branches), notification-resolve.ts (68/68), notify-context.ts (19/19), notification-grammar.ts (187/187), notification-dispatch.ts (45/45), and notification-types.ts (26/26).
- `rg -n "causeChainTrailer|manualRecoveryLeaks|partialHintTrailerFor|notAddedReasonFor|enableHint" extensions/pi-claude-marketplace/shared/notification-grammar.ts`: no match. The grammar's errors.ts imports are `formatCauseChain` and `type SerializedCauseChain`.
- `rg -n 'severity = "error"' extensions/pi-claude-marketplace/shared/notify-context.ts`: no match. The guarded write is in notification-resolve.ts. `rg -n "notify-context" extensions/pi-claude-marketplace/shared/notification-resolve.ts`: no match.
- `npm run check`, run unpiped and logged: `CHECK_EXIT=0`. The unit suite ran 7311/7311 and the integration suite 36/36. The type-member gate and its 7 negative controls passed.
- `fallow audit`: verdict `warn`. The only introduced clone groups are the three `scripts/*.mjs` entry-point groups from the corpus-baseline plan.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

`ResolvedRow` and `resolveRows` are ready for the marker policy and the resolved render arms. When a plan moves `RenderFn` onto resolved rows, the arms receive rows that already carry `failure` and `hint`, and they carry no `cause`, `rollbackPartial`, `partialHint`, or `enableHint`. Any new `message.kind` read in `dispatchInfoMessage` or `resolveEnvelope` must keep the order that the getter-backed dispatch tests pin.

## Self-Check: PASSED

- The modified files named above exist, and `.planning/phases/01-presentation-model/01-03-SUMMARY.md` exists.
- Commits `e941b7bd` and `76e2383e` exist on `features/json`.

---
*Phase: 01-presentation-model*
*Completed: 2026-09-29*
