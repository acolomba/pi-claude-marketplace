---
phase: 48-marketplace-ops-attribution
plan: 01
subsystem: api
tags: [notify, discriminated-union, typebox, marketplace, error-attribution, typescript]

# Dependency graph
requires:
  - phase: 46-type-model-foundations
    provides: "MarketplaceNotificationMessage per-status union, ContentReason, composeReasons, MarketplaceNotAddedMessage, REASONS closed set"
  - phase: 47-plugin-ops-attribution
    provides: "MarketplaceNotAddedSignal pattern, typed-dispatch (instanceof) reason classification convention"
provides:
  - "D-48-A: MpFailed.reasons?: readonly ContentReason[] + renderMpHeader failed-arm reason brace (the marketplace subject can now render its own closed-set reason)"
  - "D-48-B: typed InvalidMarketplaceManifestError thrown structurally by domain/manifest.ts, surviving the manifest negative-cache"
  - "ATTR-07: marketplace add's 5 precondition failures (duplicate name / stale clone / unsupported source / source missing / invalid manifest) routed through notify as (failed) {<reason>} rows"
  - "UnsupportedSourceError typed class; classifyAddError instanceof dispatch"
  - "5 new marketplace-add catalog states + paired catalog-uat fixtures"
affects: [48-02, 48-03, ATTR-10, marketplace-update, marketplace-remove, autoupdate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Marketplace-subject reason rendering via optional MpFailed.reasons + composeReasons (mirrors the MpSkipped arm; reasonsBrace === '' ternary preserves bare-(failed) bytes)"
    - "Typed manifest-error dispatch (InvalidMarketplaceManifestError) replacing SyntaxError/bare-Error sniffing"
    - "Entrypoint try/catch -> classifyAddError -> notify (D-48-C Shape 1, orchestrator-internal routing; github cleanup runs first)"
    - "rethrowPreconditionErrors composition seam for orchestrators (bootstrap) that need the typed throw for control flow"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/domain/manifest.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
    - docs/output-catalog.md
    - tests/architecture/notify-types.test.ts
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/domain/manifest.test.ts
    - tests/domain/manifest-cache.test.ts
    - tests/edge/handlers/marketplace/add.test.ts

key-decisions:
  - "MpFailed.reasons typed ContentReason[] (NOT Reason[]) so 'not added' stays structurally unrepresentable on the failed arm (TYPE-02 preserved)"
  - "InvalidMarketplaceManifestError carries the original SyntaxError as Error.cause; the manifest cache stores/re-throws the SAME typed instance"
  - "S5e 'neither file nor directory' tagged ENOTDIR so classifyAddError routes it to 'source missing' structurally (no substring matching)"
  - "Bootstrap idempotency preserved via rethrowPreconditionErrors:true instead of relaxing its single-signal-per-state-change contract"

patterns-established:
  - "Optional mp-level reasons on a failed arm rendered only when present+non-empty (brace collapses otherwise)"
  - "classifyAddError unwraps ONE level of Error.cause so a github cleanup-leak-wrapped error still classifies (Pitfall 4)"

requirements-completed: [ATTR-07]

# Metrics
duration: ~45min
completed: 2026-06-08
---

# Phase 48 Plan 01: Marketplace-Ops Attribution Foundation Summary

**The D-48-A `MpFailed.reasons?` type+renderer foundation, the typed `InvalidMarketplaceManifestError`, and ATTR-07 `marketplace add` precondition attribution land atomically in one GREEN state -- the marketplace subject can now render its own closed-set reason, and all five `add` precondition failures route through `notify` as `(failed) {<reason>}` rows instead of raw throws.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-08T00:01:33Z (approx; orchestrator session start)
- **Completed:** 2026-06-08
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- **D-48-A (the linchpin):** added `readonly reasons?: readonly ContentReason[]` to the `MpFailed` arm; `renderMpHeader`'s `failed` arm now composes `composeReasons(mp.reasons, false, false, probe)` with the load-bearing `reasonsBrace === ""` ternary so omitted/empty reasons collapse to a byte-identical bare `(failed)`. Inverted the `_NoReasonsOnMpFailed` `@ts-expect-error` to a positive `_Assert_ReasonsOnMpFailed` proof; KEPT `_NoDetailsOnMpFailed`; added a TYPE-02 `["not added"]`-not-assignable proof.
- **D-48-B:** introduced the typed `InvalidMarketplaceManifestError` in `shared/errors.ts`, thrown by `domain/manifest.ts::loadMarketplaceManifestUncached` for BOTH malformed JSON (was `SyntaxError`, now carried as `cause`) and schema-invalid input (was a bare `Error`). Confirmed the Phase 45 manifest negative-cache re-throws the SAME typed instance with its `cause` intact.
- **ATTR-07:** `marketplace add`'s five precondition failures route through `notify` on the marketplace subject using the EXISTING `REASONS` members (no new member added): duplicate name / stale clone (post-manifest → derived name subject), unsupported source / source missing / invalid manifest (pre-manifest → raw-source subject). github precondition failures still run `cleanupStaging` before the failed row is emitted (Pitfall 4 preserved).
- Added 5 new `marketplace add` catalog states + paired catalog-uat fixtures; the pre-existing bare-`(failed)` `failure-unreachable` byte form is byte-unchanged (catalog-uat byte-equality GREEN).

## Task Commits

Committed by orchestrator (this plan executed as one GREEN commit; no per-task commits made by the executor per the plan's commit policy).

1. **Task 1: D-48-A type+renderer+proof + typed InvalidMarketplaceManifestError** -- committed by orchestrator
2. **Task 2: Route marketplace add precondition failures through notify (ATTR-07)** -- committed by orchestrator
3. **Task 3: 5 marketplace-add catalog states + fixtures + byte gate** -- committed by orchestrator

**Plan metadata:** committed by orchestrator

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` -- `MpFailed.reasons?: readonly ContentReason[]` (+ D-48-A docstring); `renderMpHeader` `failed` arm reason-brace block.
- `extensions/pi-claude-marketplace/shared/errors.ts` -- new `InvalidMarketplaceManifestError` and `UnsupportedSourceError`; `StaleSourceCloneError` gained an optional `mpName` (derived-name subject for the failed row).
- `extensions/pi-claude-marketplace/domain/manifest.ts` -- `JSON.parse` wrapped to re-throw `SyntaxError` as `InvalidMarketplaceManifestError` (cause-preserving); schema-invalid throw retyped to the same class.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` -- `classifyAddError` (instanceof dispatch + one-level cause unwrap), `addSubjectName` (A2), `runAddInGuard` extraction, entrypoint try/catch → notify routing; S5a/S5b throw `UnsupportedSourceError`; S5e "neither file nor directory" tagged ENOTDIR; `rethrowPreconditionErrors` option.
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` -- `narrowProbeError` unwraps `InvalidMarketplaceManifestError` whose `cause` is a `SyntaxError` → `unparseable` (preserves the read-only `info`/`list` surface reason after D-48-B).
- `extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts` -- passes `rethrowPreconditionErrors: true` so the idempotent re-bootstrap still catches+swallows the typed `MarketplaceDuplicateNameError` (one-signal-per-state-change preserved).
- `docs/output-catalog.md` -- D-48-A note + 5 new `add-*` catalog states; `failure-unreachable` bare-`(failed)` byte form unchanged.
- `tests/architecture/notify-types.test.ts` -- inverted reasons proof; retained details proof; TYPE-02 not-added lock; TYPE-04 comment updated.
- `tests/architecture/catalog-uat.test.ts` -- 5 paired `add-*` fixtures (expectedSeverity: "error").
- `tests/orchestrators/marketplace/add.test.ts` -- 5 throw-asserting tests converted to notify-byte-form assertions (+ new ENOENT path-missing test); MA-9 cleanupStaging assertion preserved.
- `tests/domain/manifest.test.ts` -- instanceof assertions for schema-invalid + malformed-JSON (cause is SyntaxError).
- `tests/domain/manifest-cache.test.ts` -- D-48-B A1 typed-instance-survives-negative-cache test.
- `tests/edge/handlers/marketplace/add.test.ts` -- 3 raw-throw shim tests converted to notify-byte-form assertions (DEVIATION; see below).

## Decisions Made

- `MpFailed.reasons` typed `ContentReason[]` (not `Reason[]`) -- keeps `"not added"` structurally off the failed arm (TYPE-02). That condition stays the dedicated `MarketplaceNotAddedMessage` variant.
- `InvalidMarketplaceManifestError` (D-48-B Option B2, typed dispatch) over threading `sourceKind` (B1) -- more reusable and consumed by both ATTR-07 (here) and ATTR-10 (Plan 48-03).
- The `add` subject name follows A2: post-manifest failures render the derived marketplace name; pre-manifest failures render the user-typed raw source.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the marketplace add EDGE-handler shim tests to the new notify behavior**
- **Found during:** Task 2 (full-suite run)
- **Issue:** `tests/edge/handlers/marketplace/add.test.ts` had 3 tests asserting the OLD raw-throw add behavior (`assert.rejects`). ATTR-07 now routes precondition failures through `notify`, so the orchestrator no longer throws past the edge handler → "Missing expected rejection."
- **Fix:** Converted the 3 tests to assert the structured `(failed) {<reason>}` notify byte form (mirroring how the Phase 47 plugin-op edge tests were updated). Preserved each test's original intent (scope propagation via the `[scope]` bracket; gitOps passthrough via the recorded clone call). The github-no-fixture case correctly renders `{source missing}` (ENOENT on the absent post-clone manifest), not `{invalid manifest}`.
- **Files modified:** tests/edge/handlers/marketplace/add.test.ts
- **Verification:** `node --test tests/edge/handlers/marketplace/add.test.ts` 4/4 pass.
- **Committed in:** part of the plan's single GREEN commit (by orchestrator).

**2. [Rule 1 - Bug] Preserved the read-only surface `{unparseable}` reason after D-48-B retyped the manifest error**
- **Found during:** Task 1/2 (full-suite run)
- **Issue:** `tests/orchestrators/marketplace/info.test.ts` "malformed JSON surfaces `(failed) {unparseable}`" regressed to `{unreadable}` because `narrowProbeError` keyed on `err instanceof SyntaxError`, and D-48-B now wraps the SyntaxError in `InvalidMarketplaceManifestError`.
- **Fix:** `narrowProbeError` now also maps an `InvalidMarketplaceManifestError` whose `cause instanceof SyntaxError` to `unparseable` (schema-invalid manifests -- no SyntaxError cause -- keep the `unreadable` fallback, preserving prior classification).
- **Files modified:** extensions/pi-claude-marketplace/shared/probe-classifiers.ts
- **Verification:** `node --test tests/orchestrators/marketplace/info.test.ts` 13/13 pass.
- **Committed in:** part of the plan's single GREEN commit (by orchestrator).

**3. [Rule 1 - Bug] Restored bootstrap's one-signal-per-state-change contract after ATTR-07 stopped throwing**
- **Found during:** Task 2 (full-suite run)
- **Issue:** `orchestrators/plugin/bootstrap.ts` relied on `addMarketplace` THROWING `MarketplaceDuplicateNameError` to swallow the idempotent re-bootstrap. ATTR-07 routes duplicate-name through `notify`, so bootstrap's catch no longer fired and a spurious `(failed)` row leaked (2 notifications instead of 1).
- **Fix:** added an optional `rethrowPreconditionErrors?: boolean` composition seam to `AddMarketplaceOptions`; when set, `addMarketplace` re-throws the typed precondition instead of routing to notify. Bootstrap sets it `true`, keeping its existing catch+swallow contract unchanged. The public `marketplace add` command omits the flag and gets the ATTR-07 structured row.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts, extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
- **Verification:** `node --test tests/orchestrators/plugin/bootstrap.test.ts` 5/5 pass.
- **Committed in:** part of the plan's single GREEN commit (by orchestrator).

---

**Total deviations:** 3 auto-fixed (1 blocking test update, 2 bug fixes for D-48-B/ATTR-07 cross-cutting effects).
**Impact on plan:** All three were necessary correctness fixes caused directly by the planned D-48-B/ATTR-07 changes (retyped manifest error + add no-longer-throwing). No scope creep; no new REASONS member; no new dependency. The bootstrap seam keeps the public `marketplace add` path fully ATTR-07-compliant while preserving bootstrap idempotency.

## Issues Encountered

- The github guard's MA-9 catch wraps a precondition error via `appendLeakToError` only when `cleanupStaging` itself leaks (producing a generic `Error` with the typed one as `.cause`). To keep ATTR-07 routing robust through that leak path, `classifyAddError` / `addSubjectName` unwrap ONE level of `Error.cause` (Pitfall 4). In the normal (no-leak) case the typed instance is preserved unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The D-48-A `MpFailed.reasons?` foundation and the typed `InvalidMarketplaceManifestError` are in place for Plans 48-02 (remove/autoupdate `{not added}`) and 48-03 (ATTR-10 path-source `{invalid manifest}` -- `reasonsFromCascadeError` can now narrow on `InvalidMarketplaceManifestError` structurally).
- `npm run check` exits 0 (typecheck + eslint + prettier:check + full node:test, 1493 tests pass). catalog-uat byte gate GREEN (existing bare-`(failed)` states byte-unchanged; 5 new add states paired).
- No intermediate RED: the type touch + renderer + proof inversion + catalog/fixtures all land together.

## Self-Check: PASSED

- `48-01-SUMMARY.md` exists.
- No commits made by the executor (HEAD at the planning commit); nothing staged; `.planning/ROADMAP.md` untouched by the executor.
- Acceptance greps: `MpFailed.reasons?: readonly ContentReason[]` present; `_Assert_ReasonsOnMpFailed` present; `_NoDetailsOnMpFailed` retained; `class InvalidMarketplaceManifestError` present; 2 manifest throw sites typed; `classifyAddError` defined+called; `composeReasons(mp.reasons` in the failed arm; no new REASONS tuple member (length proof === 29 unchanged).
- `npm run check` exits 0 (1493 tests pass). catalog-uat byte gate GREEN; 5 new `add-*` catalog states paired; `failure-unreachable` bare-`(failed)` byte form unchanged.

---
*Phase: 48-marketplace-ops-attribution*
*Completed: 2026-06-08*
