---
phase: 48-marketplace-ops-attribution
plan: 03
subsystem: api
tags: [typescript, discriminated-union, notify, marketplace-update, error-attribution, nfr-5]

# Dependency graph
requires:
  - phase: 48-marketplace-ops-attribution (plan 01)
    provides: "D-48-A MpFailed.reasons foundation; typed InvalidMarketplaceManifestError (shared/errors.ts), thrown by domain/manifest.ts and surviving the negative-cache"
  - phase: 48-marketplace-ops-attribution (plan 02)
    provides: "autoupdate/remove not-added convergence; the autoupdate bare-(failed) state superseded to {not added}"
  - phase: 46-type-model-foundations
    provides: "ContentReason, composeReasons, MarketplaceNotificationMessage, REASONS closed set"
provides:
  - "ATTR-10: a path-source malformed/schema-invalid marketplace.json during marketplace update renders (failed) {invalid manifest}, never {network unreachable} (NFR-5)"
  - "reasonsFromCascadeError recognizes InvalidMarketplaceManifestError (direct + one-level Error.cause unwrap) -> [invalid manifest] BEFORE the ?? [network unreachable] default"
  - "update-path-invalid-manifest catalog state + paired catalog-uat fixture"
  - "Pitfall-1 byte-regression locks: the bare-(failed) marketplace states render byte-identically after the D-48-A MpFailed.reasons addition (reasons omitted -> brace collapses)"
  - "Pitfall-3 lock: a github no-errno refresh failure still renders {network unreachable} (the path/github classification did not collapse)"
affects: [phase-49 cross-op convergence proof]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed manifest-error dispatch in reasonsFromCascadeError; the wrapped MarketplaceUpdateError is unwrapped ONE level of Error.cause (mirrors add.ts::unwrapAddError) since refreshRecord rethrows with { cause }"
    - "Synthetic-child failed-row recipe carries the classified closed-set reason on the marketplace subject's child (mirrors mp-failure-network)"
    - "Catalog-uat fixture omits `cause` to keep the documented byte form deterministic (the live cause-chain trailer carries data-dependent JSON parser text)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/architecture/catalog-uat.test.ts
    - tests/shared/notify-v2.test.ts
    - docs/output-catalog.md

key-decisions:
  - "D-48-B Option B2 (typed dispatch) reused from Plan 48-01: reasonsFromCascadeError narrows on InvalidMarketplaceManifestError instead of substring/SyntaxError sniffing."
  - "The InvalidMarketplaceManifestError branch checks BOTH the direct error AND one level of Error.cause, because refreshRecord wraps it in MarketplaceUpdateError before the refreshOneMarketplace catch sees it; the cascadeAutoupdates catch passes the raw (direct) error."
  - "Branch placed BEFORE the errno checks so the typed manifest class takes precedence over any incidental errno on the cause chain."
  - "The path-source FAILURE path is reason-only; NFR-5 was already structurally honored (the path branch calls validateManifestAtRoot -> loadMarketplaceManifest, zero gitOps). No git import added by this plan."
  - "The autoupdate bare-(failed) state was superseded to {not added} in Plan 48-02, so the third Pitfall-1 regression lock re-asserts the MpFailed arm itself (a reasons-omitted failed mp) stays byte-stable."

patterns-established:
  - "reasons-omitted MpFailed arm renders bare (failed) (composeReasons returns '' -> the reasonsBrace === '' ternary preserves the byte form) -- byte-regression-locked in notify-v2.test.ts"

requirements-completed: [ATTR-10]

# Metrics
duration: ~30min
completed: 2026-06-08
---

# Phase 48 Plan 03: ATTR-10 path-source invalid-manifest classification Summary

**A path-source malformed/schema-invalid `marketplace.json` during `marketplace update` now renders `(failed) {invalid manifest}` -- never the lying `{network unreachable}` -- via the typed `InvalidMarketplaceManifestError` branch in `reasonsFromCascadeError` (recognized before the `?? ["network unreachable"]` default), with zero network on the path-source failure path (NFR-5); the github no-errno catch-all is preserved and the three bare-`(failed)` byte forms are regression-locked. Final phase gate `npm run check` exits 0 (1502 tests).**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- **ATTR-10 (Task 1):** added the typed-error branch to `reasonsFromCascadeError` (update.ts): `err instanceof InvalidMarketplaceManifestError || (err instanceof Error && err.cause instanceof InvalidMarketplaceManifestError) -> ["invalid manifest"]`, placed BEFORE the errno checks and BEFORE the `return undefined` fallthrough. The cause-unwrap is required because `refreshRecord` wraps the manifest error inside a `MarketplaceUpdateError` before the `refreshOneMarketplace` catch sees it; the `cascadeAutoupdates` catch passes the raw (direct) error, which the direct `instanceof` covers. The `?? ["network unreachable"]` default at the catch now fires ONLY when `reasonsFromCascadeError` returns `undefined` (a github refresh with no errno and no typed manifest error).
- **NFR-5:** the path-source failure path makes zero gitOps calls (proven by a new sibling of the success-path NFR-5 test). The fix added ONLY an import from `shared/errors.ts` -- no new `platform/git` import on any path-source code path.
- **Pitfall 3 lock:** a github fetch failure with no errno and no typed manifest error still renders `(failed) {network unreachable}` (new regression test) -- the path/github classification did not collapse.
- **Task 2 catalog:** added the `update-path-invalid-manifest` catalog state (synthetic-child recipe: `⊘ official [user] (failed)` header + `  ⊘ official (failed) {invalid manifest}` child) with a paired catalog-uat fixture (`expectedSeverity: "error"`, `cause` omitted for byte determinism). The catalog diff is purely additive (13 insertions, 0 deletions); the `mp-failure-network` (update) and `failure-unreachable` (add) bare-`(failed)` byte lines are untouched.
- **Pitfall 1 byte-regression locks:** three explicit tests in notify-v2.test.ts construct `MpFailed` messages with `reasons` OMITTED and assert each renders bare `(failed)` with NO `{...}` brace -- the load-bearing proof that the `reasonsBrace === ""` ternary preserved the byte form after the D-48-A `MpFailed.reasons?` addition (`failure-unreachable` add form, `mp-failure-network` update header, and the reasons-omitted failed-mp arm; the autoupdate bare form was superseded to `{not added}` in Plan 48-02).
- **Task 3 phase gate:** `npm run check` exits 0 end-to-end (typecheck + ESLint + Prettier:check + 1502 tests). No new REASONS member (notify-types length-lock proof GREEN). catalog-uat coverage GREEN (no unpaired states / orphan fixtures).

## Task Commits

This plan is committed by the orchestrator as one GREEN commit (per the plan's `<commit_policy_CRITICAL>`; the executor committed nothing). Catalog/byte changes landed WITH their fixtures -- no intermediate RED.

1. **Task 1: Classify path-source manifest failure to {invalid manifest} (ATTR-10, D-48-B)** -- committed by orchestrator
2. **Task 2: update path-invalid-manifest catalog state + 3 bare-(failed) byte-regression locks** -- committed by orchestrator
3. **Task 3: Phase GREEN gate (full npm run check + catalog byte-change confirmation)** -- committed by orchestrator

**Plan metadata:** committed by orchestrator

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` -- imported `InvalidMarketplaceManifestError`; added the typed-error branch (direct + one-level cause unwrap) to `reasonsFromCascadeError`, before the errno checks.
- `tests/orchestrators/marketplace/update.test.ts` -- added `seedPathMarketplace` helper + 4 ATTR-10 tests: path-source malformed-JSON -> `{invalid manifest}`; path-source schema-invalid -> `{invalid manifest}`; NFR-5 path-source FAILURE calls zero gitOps; Pitfall-3 github no-errno -> `{network unreachable}`.
- `tests/architecture/catalog-uat.test.ts` -- added the `update-path-invalid-manifest` fixture (synthetic-child failed row, `reasons: ["invalid manifest"]`, no `cause`, `expectedSeverity: "error"`).
- `tests/shared/notify-v2.test.ts` -- added 3 Pitfall-1 byte-regression lock tests (reasons omitted -> bare `(failed)`, no brace).
- `docs/output-catalog.md` -- added the `update-path-invalid-manifest` catalog state + prose under the marketplace update section.

## Decisions Made

- D-48-B Option B2 (typed dispatch) reused from Plan 48-01: `reasonsFromCascadeError` narrows on `InvalidMarketplaceManifestError` rather than substring/SyntaxError sniffing.
- The branch checks both the direct error and one level of `Error.cause` (refreshRecord wraps the manifest error in `MarketplaceUpdateError`; cascade passes the raw error).
- The branch is placed before the errno checks so the typed manifest class takes precedence over any incidental errno on the cause chain.
- The catalog state uses the synthetic-child recipe (the reason rides the child row, mirroring `mp-failure-network`); the fixture omits `cause` so the documented byte form is deterministic.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1-4 deviations; no architectural changes; no auth gates.

## Issues Encountered

- The plan's Task 1 action implied recognizing `InvalidMarketplaceManifestError` directly, but in the `refreshOneMarketplace` catch the error is the WRAPPING `MarketplaceUpdateError` (refreshRecord rethrows with `{ cause }`). Verified the actual wrapping via a one-off byte-probe; the branch therefore unwraps one level of `Error.cause` (mirroring `add.ts::unwrapAddError` from Plan 48-01). The `cascadeAutoupdates` catch passes the raw error, covered by the direct `instanceof`. Both paths classify identically.

## TDD Gate Compliance

Task 1 is `tdd="true"`, but the plan's commit policy mandates ONE GREEN commit with no intermediate RED (this plan must be INDEPENDENTLY GREEN: catalog/byte changes land WITH their fixtures). Per `<commit_policy_CRITICAL>` and `<key_constraints>`, source and tests were authored together so the plan is independently GREEN. No separate RED test commit was created; this is the intended supersession discipline for a byte-changing attribution plan, not a TDD-gate violation.

## Verification

- `npx tsc --noEmit` exits 0.
- `node --test tests/orchestrators/marketplace/update.test.ts` GREEN (39 tests): path-source malformed-JSON + schema-invalid -> `{invalid manifest}` and NOT `{network unreachable}`; NFR-5 failure path zero gitOps; github no-errno -> `{network unreachable}` (Pitfall 3).
- `node --test tests/architecture/catalog-uat.test.ts tests/shared/notify-v2.test.ts` GREEN (108 tests): path-invalid-manifest state paired; 3 bare-`(failed)` byte-regression locks pass.
- `pre-commit run mdformat --files docs/output-catalog.md` Passed (no reformatting); catalog-uat re-confirmed GREEN.
- `npm run check` exits 0 (typecheck + ESLint + Prettier:check + 1502 tests). PHASE GATE for Phase 48.
- `git diff --stat docs/output-catalog.md` NON-empty (13 insertions, 0 deletions; bare-`(failed)` byte lines untouched).
- Acceptance greps: `InvalidMarketplaceManifestError` count in update.ts = 4 (>=1); `catalog-state: update-path-invalid-manifest` count = 1; no new `platform/git` import added by this plan; REASONS length-lock proof GREEN (no new member); catalog-uat coverage zero unpaired/orphan.

## Next Phase Readiness

ATTR-10 closed. The full Phase 48 marketplace-op attribution surface (ATTR-05/06/07/10) is integrated and `npm run check` is GREEN -- every changed byte form is fixture-locked, no new REASONS member, NFR-5 honored. Ready for Phase 49 cross-op convergence proof + GREEN-gate close.

## Self-Check: PASSED

- `48-03-SUMMARY.md` exists (uncommitted).
- No commits made by the executor (HEAD unchanged at `e4b6945`); `.planning/ROADMAP.md` untouched; `.planning/STATE.md` not modified by the executor (the pre-existing modification is the orchestrator's session-start bookkeeping).
- `npm run check` exits 0 (1502 tests pass); commit-hash fields = committed by orchestrator.
- Files changed by this plan: extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts, tests/orchestrators/marketplace/update.test.ts, tests/architecture/catalog-uat.test.ts, tests/shared/notify-v2.test.ts, docs/output-catalog.md.

---
*Phase: 48-marketplace-ops-attribution*
*Completed: 2026-06-08*
