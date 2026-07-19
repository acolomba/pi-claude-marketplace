---
phase: 66-derived-force-state-glyphs
plan: 04
subsystem: orchestrators
tags: [reconcile, pending, will-force-install, no-network, resolveStrict, force-install]

# Dependency graph
requires:
  - phase: 66-01
    provides: the PluginWillInstallMessage.force render modifier + the central will-install force arm the pending row stamps
  - phase: 64-resolver-three-way-state
    provides: resolveStrict three-way state (the no-network candidate resolver)
provides:
  - the reconcile pending will-install force modifier (renders (will force install)) driven by a no-network resolveStrict of the planned install candidate
  - resolvePendingForceInstalls (no-network resolveStrict over pluginsToInstall candidates; unsupported -> force key) in reconcile/notify.ts
  - the PENDING_CONTEXT will-install render arm honoring p.force (the command-local render map that the pending surface actually routes through)
  - asserted vacuity of will-force-update on the reconcile surface (the plan has no update bucket)
affects: [67-list-filters, 69-force-path-severity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Precompute a force-key set via an async no-network resolve (resolveStrict) in the orchestrator, then stamp a render-time modifier inside the pure projection -- keeping the projection synchronous and its existing call sites unbroken"
    - "A render-time boolean modifier on an existing pending-tense discriminator (will install + force) avoids any new closed-set token (no will-force-update surface)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
    - tests/orchestrators/reconcile/notify.test.ts
    - tests/orchestrators/reconcile/pending.test.ts

key-decisions:
  - "buildReconcilePendingNotification stays SYNC + pure; it gains an optional force-key set so existing sync call sites (notify-stamp-coverage + the projection unit tests) keep passing without an async signature break"
  - "resolveStrict lives in reconcile/notify.ts (resolvePendingForceInstalls); the orchestrator only LOCATES the candidate (marketplaceRoot + manifest entry) from recorded marketplaces -- honoring NFR-5 (no network) and the no-orchestrator-network architecture gate"
  - "only RECORDED marketplaces are resolvable for the preview; a same-run marketplace add is not yet cloned, so its installs stay (will install) -- the preview never claims a degrade it cannot resolve offline"
  - "will force update is VACUOUS (D-66-05): the ReconcilePlan has no update bucket, so the projection structurally cannot emit one; the absence is asserted, not built"

patterns-established:
  - "Pattern: orchestrator-computed force-key set + pure-projection stamping keeps a heavily-tested pure projection synchronous while still threading a no-network resolver signal"
  - "Pattern: a new pending-tense render variant must be added to the command-local render map (reconcile.messaging.ts PENDING_CONTEXT), not only the central renderPluginRow switch, or the surface renders the un-modified token"

requirements-completed: [FSTAT-06]

# Metrics
duration: ~55min
completed: 2026-06-27
---

# Phase 66 Plan 04: Reconcile Pending Will-Force-Install Preview Summary

**The reconcile pending surface now stamps a force modifier on the will-install row -- rendering `(will force install)` -- when the planned install candidate resolves `unsupported` via a no-network `resolveStrict`, while structurally asserting that no `will force update` row is ever produced (the plan has no update bucket).**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2 (landed as feat + fix + test commits)
- **Files modified:** 5

## Accomplishments

- Added `resolvePendingForceInstalls(plans, locate)` to `reconcile/notify.ts`: resolves each planned install candidate no-network via `resolveStrict` and collects the `(scope, marketplace, plugin)` keys whose candidate resolves `state === "unsupported"`. A probe throw or an unlocatable candidate degrades to NO force (the safe, truthful preview), never a crash on the read-only surface (IL-2).
- Threaded an optional `forceInstallKeys` set into the still-synchronous, still-pure `buildReconcilePendingNotification`; the `pluginsToInstall` loop stamps `force: true` exactly when the planned install's key is present -- the row renders `(will force install)` via the 66-01 modifier.
- Honored `p.force` in the `PENDING_CONTEXT` `renderWillInstall` arm (the command-local render map the pending surface actually routes through) so the modifier surfaces in the real bytes.
- Wired `pending.ts` to locate candidates from the recorded marketplaces' on-disk manifests (no network) and pass the resolved force-key set to the projection.
- Proved end-to-end through `pendingReconcile` that a degrading planned install renders `(will force install)` and an installable one renders plain `(will install)`; asserted no update / `will force update` row is ever emitted (D-66-05 vacuity), structurally and through the surface.

## Task Commits

1. **Task 1 -- will-force-install pending modifier (no-network resolve):** `fd158866` (feat)
2. **Task 1 -- candidate-lookup key delimiter fix:** `9b71b8cc` (fix)
3. **Task 2 -- pending will-force-install + vacuity coverage:** `0c1ed791` (test)

**Plan metadata:** (final docs commit -- this SUMMARY + STATE + ROADMAP + REQUIREMENTS)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` -- `resolvePendingForceInstalls` (no-network resolveStrict over install candidates) + `forceInstallKey` helper + optional `forceInstallKeys` param on `buildReconcilePendingNotification` stamping the will-install force modifier; D-66-05 vacuity documented inline
- `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts` -- recorded-marketplace lookup map + candidate locator (on-disk manifest, no network) + the `resolvePendingForceInstalls` -> projection wiring
- `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts` -- the `PENDING_CONTEXT` `renderWillInstall` arm branches on `p.force` to emit `(will force install)`
- `tests/orchestrators/reconcile/notify.test.ts` -- five FSTAT-06 cases (real resolveStrict unsupported -> force; installable -> no force; unlocatable -> no force; cross-scope key isolation; update/force-update vacuity)
- `tests/orchestrators/reconcile/pending.test.ts` -- two e2e cases rendering `(will force install)` vs `(will install)` through `pendingReconcile`, asserting no will-(force-)update row

## Decisions Made

None beyond the LOCKED D-66-01..05 and RESEARCH assumptions (A2 force-as-modifier, Open Question 2 preview-only token derivation). All honored as specified. The one design choice within Claude's discretion -- keeping the projection synchronous via an orchestrator-computed force-key set rather than making it async -- was made to avoid breaking the projection's existing synchronous call sites (`notify-stamp-coverage`, the projection unit tests) while still placing the `resolveStrict` call in `reconcile/notify.ts` per the plan's key-link.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Honored the force modifier in the command-local PENDING render map (reconcile.messaging.ts), not in `files_modified`**
- **Found during:** Task 1 (implementation review)
- **Issue:** The reconcile pending surface renders through `PENDING_CONTEXT`'s command-local `renderWillInstall` arm, which hard-coded `(will install)` and ignored `p.force`. 66-01 added the force branch only to the CENTRAL `renderPluginRow` switch, so stamping `force: true` alone would still render `(will install)` on this surface (the same command-local-map class the 66-02 list deriver hit).
- **Fix:** Branched `renderWillInstall` on `p.force === true` to emit `(will force install)`, lifted verbatim from the central arm.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
- **Verification:** the pending.test.ts e2e renders `(will force install)` through the real surface; `npm run check` green.
- **Committed in:** fd158866

**2. [Rule 3 - Blocking] Wired the orchestrator (pending.ts), not in `files_modified`**
- **Found during:** Task 1 (implementation)
- **Issue:** `buildReconcilePendingNotification` is a PURE projection that receives only `plans`; it has no access to the marketplaceRoot / manifest entry a no-network `resolveStrict` needs. The candidate location must happen where state + manifests are reachable -- the `pendingReconcile` orchestrator.
- **Fix:** `pending.ts` accumulates the recorded marketplaces' `(marketplaceRoot, manifestPath)`, builds a locator that soft-loads the on-disk manifest (no network) and finds the plugin entry, calls `resolvePendingForceInstalls`, and passes the force-key set to the projection.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
- **Verification:** `no-orchestrator-network` architecture test green (no gitOps surface); pending.test.ts e2e green; idempotency + no-mutation pending tests still green.
- **Committed in:** fd158866

**3. [Rule 1 - Bug] Fixed a key-delimiter mismatch that silently disabled the preview**
- **Found during:** Task 2 (pending.test.ts e2e)
- **Issue:** The recorded-marketplace lookup key used a stray NUL delimiter on the populate side but a space delimiter on the read side, so the locator never matched and the force preview never fired (the e2e rendered plain `(will install)`).
- **Fix:** Normalized both sides to a single space delimiter.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
- **Verification:** pending.test.ts e2e now renders `(will force install)`; full `npm run check` green.
- **Committed in:** 9b71b8cc

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** The two blocking deviations are the same compile/render-map-coverage class the prior force-state plans (66-01/66-02) anticipated -- a new pending-tense render variant must reach both the central switch AND the command-local render map, and a pure projection cannot perform I/O so the resolve is orchestrator-driven. The bug fix restored the feature's correctness. No scope creep, no architectural change; the apply path is untouched (preview-only per RESEARCH Open Question 2).

## Issues Encountered

- The pending projection's PURE / synchronous contract conflicted with the plan's request to "resolve in the pluginsToInstall loop." Resolved by splitting responsibilities: the orchestrator computes a force-key set via the async no-network resolver (`resolvePendingForceInstalls`, which owns the `resolveStrict` call in `reconcile/notify.ts`), and the projection stays synchronous and pure, consuming the precomputed set. This keeps the existing synchronous call sites (`notify-stamp-coverage`, the projection unit tests) green without an async signature break.
- `npm run check` ran fully green this session: 2398 unit tests pass (0 fail, 2 pre-existing skips), integration 16/16. No flaky temp-teardown races appeared on this run.

## Known Stubs

None. The force preview is wired end-to-end: a recorded marketplace's planned install whose candidate resolves `unsupported` renders `(will force install)` through the real `pendingReconcile` surface. `will force update` is intentionally absent (vacuous -- the reconcile plan has no update bucket, D-66-05).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FSTAT-06 is complete; the reconcile pending surface previews force installs truthfully, consistent with the list/info/success surfaces' no-network candidate signal.
- No blockers. Wave 2 of Phase 66 (66-02 list deriver, 66-03 info/success, 66-04 reconcile pending) is fully landed.

## Self-Check: PASSED

- Created file present: `.planning/phases/66-derived-force-state-glyphs/66-04-SUMMARY.md`
- Modified source present: `reconcile/notify.ts` (resolvePendingForceInstalls), `reconcile/reconcile.messaging.ts` (force render arm), `reconcile/pending.ts` (locator wiring)
- Commits present: `fd158866` (feat), `9b71b8cc` (fix), `0c1ed791` (test)

---
*Phase: 66-derived-force-state-glyphs*
*Completed: 2026-06-27*
