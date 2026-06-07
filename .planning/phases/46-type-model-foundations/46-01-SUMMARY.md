---
phase: 46-type-model-foundations
plan: 01
subsystem: notifications
tags: [typescript, discriminated-union, type-model, notify, content-reason, exhaustiveness]

# Dependency graph
requires:
  - phase: 46-type-model-foundations (context/research)
    provides: D-46-01..07 decisions, exact current shapes, 32-site construction sweep
provides:
  - "MarketplaceNotAddedMessage variant (6th NotificationMessage arm) carrying only name + optional scope"
  - "ContentReason = Exclude<Reason, 'not added'> retyped onto all 7 row reasons fields"
  - "MarketplaceNotificationMessage as a per-status discriminated union (reasons only on skipped, details only on list, neither on failed)"
  - "Single isInfoKind guard over the 5 standalone-dispatched kinds, routed through by all four consumers with assertNever tails"
  - "renderMarketplaceNotAdded renderer lifted out of the renderPluginInfo carve-out (byte-identical output)"
affects: [47-attribution-corrections, 48-marketplace-op-failures]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural-vs-content reason split via Exclude<> so an illegal mix is a compile error, not a render-time guard"
    - "Per-status discriminated union with status?: undefined list arm for co-occurrence enforcement"
    - "Single-source isInfoKind type-predicate + assertNever exhaustiveness across every consumer"
    - "ContentReason propagated to the orchestrator outcome vocabulary (orchestrators/types.ts) and reason-narrowing helpers"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - tests/architecture/notify-types.test.ts
    - tests/architecture/catalog-uat.test.ts
    - tests/shared/notify-v2.test.ts

key-decisions:
  - "Retyped ALL 7 row reasons fields to ContentReason (not just the 2 named in D-46-02) per RESEARCH recommendation A3 -- byte-neutral, closes the foot-gun uniformly."
  - "Propagated ContentReason into orchestrators/types.ts outcome reasons fields and all reason-narrowing helper return types rather than casting at the row boundary -- keeps the TYPE-02 proof intact end-to-end (no `not added` ever reaches a content row)."
  - "Kept _Assert_NotifFourArms and _Assert_NotifFiveArms as cheap regression coverage; added _Assert_NotifSixArms (_l12) for the new arm (D-46-07)."
  - "Internal mp arm names: MpAdded / MpRemoved / MpUpdated / MpFailed / MpAutoupdateEnabled / MpAutoupdateDisabled / MpSkipped / MpList."
  - "renderMpHeader default tail changed from assertNever(mp.status) to assertNever(mp): under the exhaustive per-status union the residual is `never` at the value level, so mp.status access is illegal."
  - "import/execute.ts final mapping refactored into a per-status arm constructor (blockToMarketplaceMessage); dead block.reasons field + assignment removed (D-46-03a)."

patterns-established:
  - "Pattern: structural reason marker lives on a dedicated union arm, never on an open Reason[] row field."
  - "Pattern: list/inventory union arm modeled as status?: undefined so status-omitted construction sites compile unchanged and the renderer's case undefined narrows to it."

requirements-completed: [TYPE-01, TYPE-02, TYPE-03, TYPE-04]

# Metrics
duration: ~50min
completed: 2026-06-07
---

# Phase 46 Plan 01: Type-Model Foundations Summary

**A dedicated `marketplace-not-added` variant + `ContentReason` exclusion + per-status `MarketplaceNotificationMessage` union + a single `isInfoKind`/`assertNever` guard make the v1.10 attribution foot-guns unrepresentable -- with ZERO rendered-byte changes for any v1.0-v1.9 command.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-06-07
- **Tasks:** 3 (executed as one continuous, uncommitted edit set per D-46-06)
- **Files modified:** 15 (12 source, 3 test); `docs/output-catalog.md` deliberately NOT edited

## Accomplishments

- **TYPE-01:** Added `MarketplaceNotAddedMessage` (6th `NotificationMessage` arm) carrying only `kind`/`name`/`scope?`; lifted the `renderPluginInfo` `{not added}` carve-out into a dedicated `renderMarketplaceNotAdded` and DELETED the predicate `if` block. The two confirmed info construction sites (`marketplace/info.ts::buildNotAddedMessage`, `plugin/info.ts` not-added branch) now emit the variant with the placeholder `marketplaceScope`/`marketplaceDetails` fields gone.
- **TYPE-02:** Added `export type ContentReason = Exclude<Reason, "not added">` and retyped all 7 row `reasons` fields. `["not added", "permission denied"]` is now a compile error.
- **TYPE-03:** Added a single `StandaloneKind`/`isInfoKind` guard (5 kinds in one place) and routed all four consumers (`computeSeverity`, `buildSummaryLine`, `shouldEmitReloadHint`, `notify()` early-dispatch) through it, each with an `assertNever` tail (3 of 4 lacked one before). New-arm behavior: severity `error`, no summary line, no reload-hint, dispatched via `dispatchInfoMessage`.
- **TYPE-04:** Converted `MarketplaceNotificationMessage` to a per-status discriminated union (8 arms): `reasons?` only on `MpSkipped`, `details?` only on `MpList` (status?: undefined), `MpFailed` carries neither (D-46-03a).
- **Byte contract:** `catalog-uat` byte-equality GREEN over every existing state; the 4 `{not added}` info fixtures re-keyed to the variant asserting identical bytes; `docs/output-catalog.md` untouched.

## Task Commits

This plan landed as ONE atomic edit set with NO intermediate commit (D-46-06 / NFR-6). All changes are left UNCOMMITTED for the orchestrator to commit once, after `npm run check` is GREEN.

1. **Task 1: Type-model reshape in shared/notify.ts** - committed atomically by orchestrator (D-46-06)
2. **Task 2: Switch info construction sites + import/execute per-status arm constructor** - committed atomically by orchestrator (D-46-06)
3. **Task 3: TYPE-01..04 compile proofs + re-key info fixtures** - committed atomically by orchestrator (D-46-06)

**Plan metadata:** committed atomically by orchestrator (D-46-06)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` - Added `ContentReason`, `MarketplaceNotAddedMessage`, `StandaloneKind`/`isInfoKind`, `renderMarketplaceNotAdded`; converted `MarketplaceNotificationMessage` to the per-status union (`MpAdded`/.../`MpList`); retyped 7 row reasons fields; routed 4 consumers through `isInfoKind` + `assertNever`; deleted the `renderPluginInfo` carve-out; changed `renderMpHeader` default tail to `assertNever(mp)`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` - `buildNotAddedMessage` returns the variant (placeholders deleted); `buildManifestFailureMessage` param `Reason` -> `ContentReason`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - inline not-added branch returns the variant; three `narrowProbeError` locals `Reason[]` -> `ContentReason[]`.
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` - final mapping refactored to `blockToMarketplaceMessage` (per-status arm constructor); dead `MarketplaceBlock.reasons` field + `block.reasons = ["source mismatch"]` assignment removed; `importWarningReason` -> `ContentReason`.
- `extensions/pi-claude-marketplace/orchestrators/types.ts` - 3 outcome `reasons` fields `Reason[]` -> `ContentReason[]`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/{autoupdate,remove,update}.ts`, `plugin/{install,reinstall,uninstall,update}.ts` - reason-narrowing helper return types / local annotations `Reason` -> `ContentReason` (no runtime change; none produce `not added`).
- `tests/architecture/notify-types.test.ts` - rewrote `_mms` (was `_Assert_MarketplaceMessageShape`) to per-arm proofs; added TYPE-01 (`_vna`/`_vnr`/`_vnaa`/`_NoMpScopePlaceholder`/`_NoMpDetailsPlaceholder`/`_NoReasonsOnNotAdded`), TYPE-02 (`_car`/`_crs`/`_illegal`), TYPE-04 (`_mrs`/`_mdl`/`_NoReasonsOnMpFailed`/`_NoDetailsOnMpFailed`/`_NoDetailsOnMpSkipped`/`_NoReasonsOnMpList`), and 6-arm arity (`_l12`); kept `_l4`/`_l4b` byte-unchanged.
- `tests/architecture/catalog-uat.test.ts` - re-keyed the 4 `{not added}` fixtures to the variant (identical bytes).
- `tests/shared/notify-v2.test.ts` - re-keyed the 2 INFO-04 not-added tests to the variant (same bytes / severity / no-reload).

## Decisions Made

- **Retype all 7 row reasons fields (not just 2):** RESEARCH A3 -- byte-neutral; closes the foot-gun uniformly. Confirmed via grep that no site constructs `not added` on any of them.
- **ContentReason propagated into the outcome vocabulary + helpers:** see Deviations (Rule 3). Chosen over a boundary cast so the TYPE-02 guarantee holds end-to-end.
- **`assertNever(mp)` instead of `assertNever(mp.status)` in `renderMpHeader`:** under the now-exhaustive per-status union the residual narrows to `never` at the value level (TS2339 on `.status` otherwise).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ContentReason ripple beyond the plan's literally-named sites**
- **Found during:** Task 1/2 (interdependent typecheck iteration).
- **Issue:** Retyping all 7 row `reasons` fields to `ContentReason` (TYPE-02) surfaced ~22 source typecheck errors at notify-row construction sites that source reasons from `Reason`-returning helpers or from the `orchestrators/types.ts` outcome vocabulary (`PluginUpdateSkippedOutcome.reasons`, `PluginUpdateFailedOutcome.reasons`, `ReinstallFailedOutcome.reasons`) -- broader than the plan's explicitly-enumerated 3 info sites + import/execute. The plan's Task-1 acceptance criterion anticipated this ("iterate until exit 0 across Tasks 1+2"); RESEARCH Open Question #1 flagged the possibility but underestimated the breadth.
- **Fix:** Narrowed the affected outcome `reasons` fields and every reason-narrowing helper return type (`narrowCascadeFailure`, `reasonsFromCascadeError`, `narrowSkipReason`, `narrowFailReason`, `narrowReason(s)`, `reasonsFromTypedError`, `narrowDirectFailReason`, `manifestFieldTokenFromNote`, `narrowResolverReasons`, `importWarningReason`, plus a handful of local `readonly Reason[]` annotations) from `Reason` to `ContentReason`. Verified by grep that NONE of these helpers/producers ever emits `"not added"` (the structural marker is only ever the variant). This is byte-neutral (no runtime change) and strengthens the TYPE-02 invariant by propagating it into the outcome model.
- **Files modified:** orchestrators/types.ts, orchestrators/marketplace/{autoupdate,remove,update,info}.ts, orchestrators/plugin/{info,install,reinstall,uninstall,update}.ts, orchestrators/import/execute.ts
- **Verification:** `npm run check` exit 0 (typecheck + lint + format + 1473 tests pass).
- **Committed in:** committed atomically by orchestrator (D-46-06)

**2. [Rule 1 - Bug] renderMpHeader default-arm value access on `never`**
- **Found during:** Task 1 (per-status union conversion).
- **Issue:** `default: assertNever(mp.status)` failed (`Property 'status' does not exist on type 'never'`) once the switch became exhaustive over the discriminated union -- `mp` narrows to `never`, so `mp.status` is illegal.
- **Fix:** Changed to `assertNever(mp)`.
- **Files modified:** extensions/pi-claude-marketplace/shared/notify.ts
- **Verification:** typecheck exit 0.
- **Committed in:** committed atomically by orchestrator (D-46-06)

**3. [Rule 3 - Blocking] ESLint no-unnecessary-type-conversion on import/execute default arm**
- **Found during:** Task 2 (import/execute per-status constructor).
- **Issue:** `String(block.status)` in the unreachable-status throw was flagged because `block.status` there is a string union (not `never`); `String()` on a string is a no-op conversion.
- **Fix:** Dropped the `String()` wrapper -- template interpolation handles the string union directly.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/import/execute.ts
- **Verification:** `npm run lint` exit 0.
- **Committed in:** committed atomically by orchestrator (D-46-06)

**4. [Rule 1 - Bug] Stale docstrings referencing the removed carve-out**
- **Found during:** Task 3 (verification grep).
- **Issue:** The `REASONS` docstring and `PluginInfoMessage` docstring still described `"not added"` as living on `PluginInfoMessage`/the renderer carve-out (now removed).
- **Fix:** Updated both to describe `"not added"` as the structural marker reachable only via `MarketplaceNotAddedMessage`. (Kept decision/requirement IDs; stripped the obsolete carve-out narrative.)
- **Files modified:** extensions/pi-claude-marketplace/shared/notify.ts
- **Verification:** `npm run check` exit 0; `git diff --stat docs/output-catalog.md` empty.
- **Committed in:** committed atomically by orchestrator (D-46-06)

---

**Total deviations:** 4 auto-fixed (2 Rule 3 blocking, 2 Rule 1 bug)
**Impact on plan:** All necessary to land the type reshape GREEN as one atomic unit. Deviation #1 is the substantive one -- it widens the byte-neutral `ContentReason` retype into the outcome vocabulary, which the plan/research had scoped only to the row fields. No scope creep beyond the type-model invariant; zero behavior/byte changes.

## Issues Encountered

- The plan's "30/32 sites compile unchanged" premise held for the *construction shape* (the per-status union accepts every literal), but NOT for the *reason source types*: many sites flow a `Reason`-typed value into the now-`ContentReason[]` field. Resolved via deviation #1 (narrow the source types, never cast).

## Threat Surface Scan

No new security-relevant surface. This is a compile-time type reshape with zero I/O, zero network (NFR-5 preserved), zero new dependencies, zero on-disk state-shape change. T-46-01..04 mitigations are in place (byte-equality runner GREEN; `@ts-expect-error` co-occurrence + exclusion proofs consumed; `isInfoKind`/`assertNever` arity locked).

## Known Stubs

None. No stub patterns introduced; every variant/arm is wired and exercised by tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The type model now structurally forbids the v1.10 attribution foot-guns (B-1/M-5, B-2, B-3, B-7). Phases 47-48 can construct attribution corrections on a sound model.
- The `MarketplaceNotAddedMessage` variant is a TOP-LEVEL union arm (matches info's single-emission model); Phase 47 must still decide the multi-target emission/embedding model (deferred per 46-CONTEXT.md).
- `npm run check` exits 0; nothing committed (orchestrator owns the single atomic commit + STATE.md/ROADMAP.md).

## Self-Check: PASSED

- `npm run check` (typecheck + eslint + prettier:check + 1473 node:test cases) exits 0.
- `MarketplaceNotAddedMessage` exists with only `kind`/`name`/`scope?`; `renderMarketplaceNotAdded` exists; the `renderPluginInfo` carve-out `if` is deleted (grep: no `=== "not added"` remains).
- `ContentReason` exists; zero `reasons: ["not added"]` construction sites remain (only `composeReasons(["not added"], ...)` inside `renderMarketplaceNotAdded`).
- `isInfoKind` has exactly one definition + four consumer call sites; arity asserts `_l9b`/`_l10b`/`_l12` all present.
- `docs/output-catalog.md` unedited (`git diff --stat` empty); `_l4`/`_l4b` (REASONS===29, `not added` membership) byte-unchanged.
- STATE.md / ROADMAP.md not modified by this executor; nothing committed.

---
*Phase: 46-type-model-foundations*
*Completed: 2026-06-07*
