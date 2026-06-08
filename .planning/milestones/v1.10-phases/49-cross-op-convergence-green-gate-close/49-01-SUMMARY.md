---
phase: 49-cross-op-convergence-green-gate-close
plan: 01
subsystem: api
tags: [notify, marketplace-update, convergence, catalog-uat, error-attribution]

# Dependency graph
requires:
  - phase: 47-..-..
    provides: "MarketplaceNotAddedSignal / marketplace-not-added variant convergence for the plugin-update forms"
  - phase: 48-..-..
    provides: "remove.ts::resolveScopeOrNotifyNotAdded catch-and-reroute pattern + ATTR-06/D-48-C standalone {not added} model"
provides:
  - "marketplace-form `marketplace update <missing-mp>` converges on the canonical standalone `(failed) {not added}` variant (explicit-scope bracket + bracketless bare form)"
  - "Closes the last residual Class-C raw-throw (SC#1 cross-op convergence is now literally true across the full op matrix)"
  - "Two new catalog states (update-missing-not-added, update-missing-not-added-absent-from-both) byte-locked by paired catalog-uat fixtures"
affects: [milestone-v1.10-close, gsd-verify-work, gsd-audit-milestone]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-guard loadState existence read + narrowed MarketplaceNotFoundError catch-and-reroute (mirrors remove.ts::resolveScopeOrNotifyNotAdded)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/edge/handlers/marketplace/update.test.ts

key-decisions:
  - "Reused the existing MarketplaceNotAddedMessage variant -- NO new REASONS member (tuple stays 29)."
  - "Narrowed the catch to `instanceof MarketplaceNotFoundError` only; genuine refresh failures keep their `(failed)` cascade (Pitfall 2)."
  - "Implemented as a private `resolveScopeOrNotifyNotAdded` helper paralleling remove.ts, returning `{scope,locations}|undefined`."

patterns-established:
  - "Marketplace-absent precondition gating happens BEFORE the refresh/withStateGuard seam via a network-free loadState read (NFR-5)."

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-06-08
---

# Phase 49 Plan 01: Cross-Op Convergence -- marketplace update <missing-mp> Summary

**`marketplace update <missing-mp>` now converges on the canonical standalone `(failed) {not added}` variant (explicit-scope `⊘ <name> [scope] (failed) {not added}` + bracketless bare form) instead of raw-throwing MarketplaceNotFoundError -- closing the last residual Class-C gap so SC#1 is literally true.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-08T01:57:12Z
- **Completed:** 2026-06-08T02:03:15Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added a `resolveScopeOrNotifyNotAdded` pre-guard to `updateMarketplace` (mirrors `remove.ts`): the bare form catches `resolveScopeFromState`'s `MarketplaceNotFoundError` and emits the bracketless `marketplace-not-added` variant; the explicit-scope form does a single network-free `loadState` existence read and emits the bracketed variant -- both BEFORE the refresh / `withStateGuard` seam, so the raw throw can no longer escape the orchestrator.
- The catch is narrowed to `instanceof MarketplaceNotFoundError` only -- genuine refresh failures (`MarketplaceUpdateError` / network / clone / lock / invalid-manifest) keep their existing `(failed)` cascade routing through `refreshOneMarketplace`'s catch (the unchanged `mp-failure-network` / `update-path-invalid-manifest` catalog-uat fixtures stay GREEN, proving nothing was swallowed).
- Documented both new byte forms as catalog states `update-missing-not-added` (explicit scope) + `update-missing-not-added-absent-from-both` (bare), paired with two catalog-uat fixtures; byte-equality + severity-arg checks GREEN, no `missing-fixture`.
- Tightened the existing loose absent-name orchestrator test to the exact canonical row and added a bare-form sibling regression test (`assert.doesNotReject` proving the raw error no longer escapes).
- No new REASONS member -- the tuple stays 29 (`_l4` length-lock unchanged).

## Task Commits

Commits are owned by the orchestrator (this plan executor committed nothing).

1. **Task 1: MarketplaceNotFoundError catch-and-reroute in updateMarketplace** - committed by orchestrator (feat)
2. **Task 2: catalog states + catalog-uat fixtures + regression tests** - committed by orchestrator (feat/test/docs)

**Plan metadata:** committed by orchestrator (docs: complete plan)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` - Added private `resolveScopeOrNotifyNotAdded(opts, userLocations, projectLocations)` helper (bare-form catch + explicit-scope pre-guard `loadState`), and rewired `updateMarketplace` to call it and return early on a miss (variant already emitted).
- `docs/output-catalog.md` - Two new annotated blocks under `## /claude:plugin marketplace update <name>`: `update-missing-not-added` (`⊘ ghost-mp [project] (failed) {not added}`) and `update-missing-not-added-absent-from-both` (`⊘ ghost-mp (failed) {not added}`).
- `tests/architecture/catalog-uat.test.ts` - Two new fixtures under the `"/claude:plugin marketplace update <name>"` outer key pairing each new catalog state with a `{ kind: "marketplace-not-added", ... }` payload (expectedSeverity "error").
- `tests/orchestrators/marketplace/update.test.ts` - Retargeted the former loose absent-name test to assert the exact `⊘ ghost [project] (failed) {not added}` row; added a bare-form sibling asserting `⊘ ghost (failed) {not added}` + no rejection.
- `tests/edge/handlers/marketplace/update.test.ts` - Updated the `named /marketplace update <name>` shim test (and its header comment) from asserting `assert.rejects(.../mymkt/)` (old raw-throw) to asserting the converged single bracketless not-added notification with no rejection.

## Decisions Made

- Reused the existing `MarketplaceNotAddedMessage` variant; no new REASONS member, no new renderer, no new mechanism (the byte form is shared by construction with the other converged ops).
- Implemented the gate as a `remove.ts`-parallel private helper rather than an inline try/catch around the refresh, so the existence check is structurally identical to the already-reviewed `remove`/`autoupdate` convergence pattern and is reachable only from the single-name `updateMarketplace` form (never from `updateAllMarketplaces`, which enumerates existing records).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the stale edge-handler raw-throw test**
- **Found during:** Task 1 (convergence fix)
- **Issue:** `tests/edge/handlers/marketplace/update.test.ts` (outside `files_modified`) asserted the OLD raw-throw behavior via `assert.rejects(async () => handler("mymkt", ctx), /mymkt/)`. The convergence fix makes the handler emit the not-added variant and resolve, so this test (and its header comment claiming `MarketplaceNotFoundError -> notifyError`) would have gone RED, blocking `npm run check`.
- **Fix:** Rewrote the test to call `await handler("mymkt", ctx)` and assert one notification `⊘ mymkt (failed) {not added}` at severity `error` (bare form -- the shim omits `--scope`); updated the file header comment to cite SC#1 convergence.
- **Files modified:** tests/edge/handlers/marketplace/update.test.ts
- **Verification:** `node --test tests/edge/handlers/marketplace/update.test.ts` GREEN; full `npm run check` GREEN.
- **Committed in:** committed by orchestrator (part of the plan commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The edge-handler test update was a required lockstep change for the byte-additive convergence (the old assertion encoded the exact behavior being removed). No scope creep -- it asserts the same converged variant the orchestrator now emits.

## Issues Encountered

- Prettier flagged the new bare-form orchestrator test (a long `assert.doesNotReject` arrow). Resolved by running `prettier --write` on the file; re-ran `npm run check` GREEN.

## Final Gate

`npm run check` exit code: **0** (GREEN). Final tail:

```
1..1496
# tests 1503
# suites 3
# pass 1503
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 22613.068166
```

- `grep -c "throw new MarketplaceNotFoundError" extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` -> **1** (only the `snapshotAfterRefresh` defense-in-depth site at line 500, now unreachable for the explicit-scope miss because the pre-guard `loadState` blocks it first -- matches the plan's expected `verification` value).
- REASONS stays 29 (`_l4` length-lock unchanged; no new member).
- `pre-commit run mdformat --files docs/output-catalog.md` -> Passed (no reformat); catalog-uat byte-equality holds.
- Catalog diff stat: `docs/output-catalog.md | 20 ++++++` (2 new states, +20 lines, no existing byte form mutated).

## Next Phase Readiness

- SC#1 cross-op convergence is now literally true: all op-paths (install / uninstall / reinstall / update-plugin / update-marketplace / marketplace remove / autoupdate) route the marketplace-absent precondition to the SAME `marketplace-not-added` variant; no live Class-C raw-throw remains.
- Ready for the remaining Phase 49 plans (cross-op convergence matrix test, SC#3 inverse-walk coverage, IN-02 manifest-asymmetry close) and the milestone GREEN gate.

## Self-Check: PASSED

- SUMMARY.md present at `.planning/phases/49-cross-op-convergence-green-gate-close/49-01-SUMMARY.md`.
- All 5 modified files present in `git status --short` as uncommitted working-tree changes.
- HEAD unchanged (`3bb6533`) -- this executor committed nothing (orchestrator owns the GREEN commit).
- `.planning/STATE.md` and `.planning/ROADMAP.md` were NOT edited by this executor (the STATE.md diff is the orchestrator's pre-spawn "execution started" bookkeeping).

---
*Phase: 49-cross-op-convergence-green-gate-close*
*Completed: 2026-06-08*
