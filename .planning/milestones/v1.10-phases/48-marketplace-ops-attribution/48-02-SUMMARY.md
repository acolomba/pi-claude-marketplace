---
phase: 48-marketplace-ops-attribution
plan: 02
subsystem: api
tags: [typescript, discriminated-union, notify, marketplace-ops, error-attribution]

# Dependency graph
requires:
  - phase: 48-marketplace-ops-attribution (plan 01)
    provides: D-48-A MpFailed.reasons foundation + typed manifest error + ATTR-07 add routing
  - phase: 46
    provides: MarketplaceNotAddedMessage variant + renderMarketplaceNotAdded standalone renderer
  - phase: 47
    provides: MarketplaceNotAddedSignal (orchestrators/plugin/shared.ts) + D-48-C Shape 1 orchestrator-internal routing convention
provides:
  - autoupdate/noautoupdate missing-marketplace routes to standalone (failed) {not added} (ATTR-05; S1 explicit-scope + S2 missing-everywhere)
  - marketplace remove missing-marketplace routes to standalone (failed) {not added} (ATTR-06; S3 explicit-scope pre-guard + S4 bare-form entrypoint catch)
  - remove + autoupdate not-added catalog states paired with catalog-uat fixtures (old reason-less / {not found} autoupdate state superseded with no orphan fixture)
affects: [phase-49 cross-op convergence proof, marketplace-ops attribution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-48-C Shape 1: missing-marketplace precondition routed through notify INSIDE the orchestrator (never raw-thrown past the boundary), reusing the Phase 46 MarketplaceNotAddedMessage variant verbatim"
    - "Pre-guard loadState existence check (read-only, NFR-5-safe) replaces an in-guard raw throw for the explicit-scope remove miss"
    - "Helper extraction (notifyAutoupdateScopeFailure, resolveScopeOrNotifyNotAdded) to keep orchestrator entrypoints under the cognitive-complexity ceiling"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - tests/orchestrators/marketplace/autoupdate.test.ts
    - tests/orchestrators/marketplace/remove.test.ts
    - tests/edge/handlers/marketplace/remove.test.ts
    - tests/architecture/catalog-uat.test.ts
    - docs/output-catalog.md

key-decisions:
  - "Reused the Phase 46 MarketplaceNotAddedMessage `{not added}` variant for ATTR-05/06; no new REASONS member; the `{not added}` brace rides the variant, NOT MpFailed.reasons."
  - "S1 explicit-scope MarketplaceNotFoundError -> standalone variant with the requested scope bracket; StateLockHeldError keeps its synthetic-child (failed) {lock held} routing UNCHANGED (regression-locked)."
  - "S2 missing-everywhere bracket = opts.scope ?? first.scope (project-before-user SC-6 order), per RESEARCH recommendation."
  - "S3 explicit-scope remove enforced via a pre-guard loadState read (the in-guard raw throw removed; a concurrent-removal race becomes a no-op return, not a throw)."
  - "S4 bare-form remove catches resolveScopeFromState's MarketplaceNotFoundError at the entrypoint (no bracket); resolveScopeFromState's throw contract is UNMODIFIED (shared with update.ts)."

patterns-established:
  - "Orchestrator-internal not-added routing (D-48-C Shape 1) keeps the edge handler a thin parse-only shim."
  - "Paired catalog state + catalog-uat fixture under the same H2 op key; superseded states removed with their fixtures in one GREEN change (atomic-supersession)."

requirements-completed: [ATTR-05, ATTR-06]

# Metrics
duration: ~35min
completed: 2026-06-07
---

# Phase 48 Plan 02: Marketplace autoupdate/remove not-added convergence Summary

**autoupdate/noautoupdate (S1+S2) and marketplace remove (S3+S4) of a missing marketplace now converge on the standalone `(failed) {not added}` variant -- no reason-less row, no `{not found}`, no raw `MarketplaceNotFoundError` escaping the orchestrator -- with the StateLockHeldError `{lock held}` path preserved.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- **ATTR-05 (autoupdate.ts):** S1 explicit-scope `MarketplaceNotFoundError` and S2 missing-in-every-scope both route to the standalone `MarketplaceNotAddedMessage` `(failed) {not added}` variant (Pattern 1). The former synthetic-child `{not found}` (S1) and reason-LESS bare `(failed)` (S2) are gone. The `StateLockHeldError -> (failed) {lock held}` synthetic-child path is byte-unchanged (regression-locked by a dedicated test).
- **ATTR-06 (remove.ts):** S3 explicit-scope miss is caught by a pre-guard `loadState` existence check (standalone `{not added}` with the resolved scope bracket); S4 bare-form miss catches `resolveScopeFromState`'s `MarketplaceNotFoundError` at the entrypoint (standalone `{not added}`, no bracket). The in-guard raw `throw new MarketplaceNotFoundError` is removed (count now 0). No raw precondition error escapes the orchestrator boundary.
- **Catalog + fixtures:** Added `remove-missing-not-added` (bracketed) + `remove-missing-not-added-bare` (no bracket) states; amended the autoupdate `failure-not-found` state into `autoupdate-missing-not-added` (bracketed) + `autoupdate-missing-not-added-bare`. All paired with catalog-uat fixtures; the old reason-less/`{not found}` autoupdate fixture was removed with its state (no orphan). catalog-uat byte-equality GREEN; mdformat clean.

## Task Commits

This plan is committed by the orchestrator as one GREEN commit (per the plan's commit policy; the executor committed nothing).

1. **Task 1: Re-route autoupdate/noautoupdate missing-marketplace to standalone {not added} (ATTR-05)** - `committed by orchestrator` (feat + test)
2. **Task 2: Re-route marketplace remove missing-marketplace to standalone {not added} (ATTR-06)** - `committed by orchestrator` (feat + test)
3. **Task 3: Add the remove + autoupdate not-added catalog states + fixtures** - `committed by orchestrator` (docs + test)

**Plan metadata:** `committed by orchestrator`

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` - S1/S2 route to the standalone `{not added}` variant; new `notifyAutoupdateScopeFailure` helper discriminates `MarketplaceNotFoundError` (→ not-added) from all other errors (→ synthetic-child `{lock held}`/`{not found}`).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` - New `resolveScopeOrNotifyNotAdded` helper: bare-form entrypoint catch (S4, no bracket) + explicit-scope pre-guard `loadState` check (S3, bracketed); in-guard raw throw replaced with a no-op return for the concurrent-removal race. Added `loadState` + `ScopedLocations` imports.
- `tests/orchestrators/marketplace/autoupdate.test.ts` - Missing-everywhere test now asserts `{not added}`; added an explicit-scope `{not added}` test (asserts NOT `{not found}`); the lock-held regression test is retained unchanged.
- `tests/orchestrators/marketplace/remove.test.ts` - Bare-form throw test converted to assert standalone `{not added}` (no bracket); added an explicit-scope `{not added}` (bracketed) test; removed the now-unused `MarketplaceNotFoundError` import.
- `tests/edge/handlers/marketplace/remove.test.ts` - Two shim tests converted from `assert.rejects` to `assert.doesNotReject` + notification byte assertions (the precondition no longer escapes the handler).
- `tests/architecture/catalog-uat.test.ts` - Added `remove-missing-not-added` + `remove-missing-not-added-bare` fixtures; replaced the autoupdate `failure-not-found` fixture with `autoupdate-missing-not-added` + `autoupdate-missing-not-added-bare`.
- `docs/output-catalog.md` - New remove + autoupdate `{not added}` catalog states (with prose); the autoupdate `failure-not-found` state superseded; section/ladder prose updated (six states, `{not added}` failure forms). Diff stat: 36 insertions, 8 deletions.

## Decisions Made

- Reused the Phase 46 `MarketplaceNotAddedMessage` variant verbatim for all four sites; no new REASONS member; the `{not added}` brace rides the variant (not `MpFailed.reasons`).
- S3 enforced via a pre-guard `loadState` read (cleaner than a signal-throw); the in-guard `record === undefined` branch became a no-op return to cover the (rare) concurrent-removal race between the pre-guard read and the guard's fresh load.
- S4 catches at the remove entrypoint rather than modifying `resolveScopeFromState` (shared with `update.ts`); `resolveScopeFromState`'s throw contract is unmodified (verified by grep).
- S2 bare-form bracket carries `first.scope` (per RESEARCH); `opts.scope` carries when explicit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted helpers to satisfy the SonarJS cognitive-complexity ceiling**
- **Found during:** Task 1 + Task 2 (the final `npm run check` gate)
- **Issue:** Adding the `MarketplaceNotFoundError` discrimination branch pushed `setMarketplaceAutoupdate` to cognitive complexity 19 (limit 15) and `removeMarketplace` to 16 (limit 15); ESLint (`sonarjs/cognitive-complexity`) failed, plus a `@stylistic/padding-line-between-statements` error in remove.ts.
- **Fix:** Extracted `notifyAutoupdateScopeFailure(opts, scope, err)` from the autoupdate per-scope catch, and `resolveScopeOrNotifyNotAdded(opts, userLocations, projectLocations)` from the remove scope-resolution + precondition block. Behavior unchanged (same notify emissions); the helpers carry the branching out of the entrypoints. Prettier then reformatted the new autoupdate helper signature onto one line.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts, extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
- **Verification:** `npm run check` exits 0 (typecheck + lint + format:check + 1495 tests all GREEN).
- **Committed in:** committed by orchestrator (part of the plan commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The refactor was a pure structural extraction required to pass the project lint gate; no behavior change, no scope creep. All planned byte forms and acceptance greps still hold.

## Issues Encountered

None beyond the lint-gate refactor documented above. There was no pre-existing explicit-scope S1/S3 test in the suites, so those `{not added}` assertions were added new (the plan anticipated this for S1; the equivalent S3 test was added for symmetry).

## TDD Gate Compliance

Tasks 1 and 2 are `tdd="true"`, but the plan's commit policy mandates ONE GREEN commit with no intermediate RED (catalog/byte changes must land with their fixtures). Per the plan's `<commit_policy_CRITICAL>` and `<key_constraints>` ("catalog/byte changes land WITH their fixtures (no intermediate RED)"), source and tests were authored together so the plan is independently GREEN. No separate RED test commit was created; this is the intended supersession discipline for a byte-changing attribution plan, not a TDD-gate violation.

## Verification

- `npx tsc --noEmit` exits 0.
- `node --test tests/orchestrators/marketplace/autoupdate.test.ts` GREEN (13 tests): S1 + S2 → `{not added}`; lock-held `{lock held}` retained.
- `node --test tests/orchestrators/marketplace/remove.test.ts tests/edge/handlers/marketplace/remove.test.ts` GREEN: S3 + S4 → `{not added}`; no raw escape; `resolveScopeFromState` untouched.
- `node --test tests/architecture/catalog-uat.test.ts` GREEN: remove + autoupdate not-added states paired; no orphan fixture.
- `npm run check` exits 0 (1495 tests pass).
- `pre-commit run mdformat --files docs/output-catalog.md` Passed (no reformatting); catalog-uat re-confirmed GREEN.
- Acceptance greps: `marketplace-not-added` count = 2 in each of autoupdate.ts and remove.ts; `throw new MarketplaceNotFoundError` count = 0 in remove.ts; `resolveScopeFromState` signature unchanged in shared.ts; no new REASONS member.

## Next Phase Readiness

ATTR-05 + ATTR-06 closed. Three of the four marketplace ops (autoupdate/noautoupdate, remove) now converge on the canonical `{not added}` model alongside the Phase 46/47 plugin ops. Ready for Phase 49 cross-op convergence proof + GREEN-gate close.

---
*Phase: 48-marketplace-ops-attribution*
*Completed: 2026-06-07*
