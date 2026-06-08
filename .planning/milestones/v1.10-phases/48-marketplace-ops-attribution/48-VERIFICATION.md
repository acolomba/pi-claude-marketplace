---
phase: 48-marketplace-ops-attribution
verified: 2026-06-07T00:00:00Z
status: passed
score: 16/16
overrides_applied: 0
re_verification: false
---

# Phase 48: Marketplace-Ops Attribution Verification Report

**Phase Goal:** Route every marketplace-op precondition failure through notify() as structured
(failed) rows instead of raw throws -- autoupdate/noautoupdate/remove of a missing marketplace
→ (failed) {not added}; marketplace add surfaces 5 precondition reasons (duplicate name/stale
clone/unsupported source/source missing/invalid manifest) as structured (failed) rows using
existing REASONS members; path-source manifest failure during marketplace update → {invalid
manifest}, never {network unreachable} (NFR-5). Edge handlers route precondition errors via
notify (no raw escape).

**Verified:** 2026-06-07T00:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | marketplace add of a duplicate name renders (failed) {duplicate name}, not a raw throw | VERIFIED | `classifyAddError` in add.ts:157-159 maps `MarketplaceDuplicateNameError → "duplicate name"`; notify wired at :301-308; MA-8 test asserts byte form |
| 2 | marketplace add of a stale clone renders (failed) {stale clone} | VERIFIED | `classifyAddError` :161-163 maps `StaleSourceCloneError → "stale clone"`; MA-6 test asserts `{stale clone}` byte form |
| 3 | marketplace add of an unsupported/unknown source renders (failed) {unsupported source} | VERIFIED | `classifyAddError` :169-171 maps `UnsupportedSourceError → "unsupported source"`; MA-10 test asserts byte form |
| 4 | marketplace add of a missing path source renders (failed) {source missing} | VERIFIED | `classifyAddError` :173-178 maps ENOENT/ENOTDIR → "source missing"; ATTR-07 ENOENT test asserts byte form |
| 5 | marketplace add of an invalid/malformed manifest renders (failed) {invalid manifest} | VERIFIED | `classifyAddError` :165-167 maps `InvalidMarketplaceManifestError → "invalid manifest"`; MA-9 test asserts byte form |
| 6 | MpFailed arm carries optional ContentReason[] reasons field; not added stays structurally excluded (TYPE-02) | VERIFIED | `notify.ts:620-623`: `interface MpFailed` has `readonly reasons?: readonly ContentReason[]`; notify-types.test.ts:1053-1055 has `@ts-expect-error` proof that "not added" is NOT assignable to MpFailed.reasons |
| 7 | github add precondition failures still run cleanupStaging before the failed row is emitted (no staging-dir leak) | VERIFIED | add.ts wraps entrypoint after `addGithubInGuard` catch (which runs cleanupStaging + appendLeakToError + re-throw); MA-9 Pitfall-4 assertion at test:252-263 confirms cleanupStaging ran before notify |
| 8 | marketplace autoupdate/noautoupdate of an explicit-scope missing marketplace renders standalone (failed) {not added}, not (failed) {not found} | VERIFIED | autoupdate.ts:163-169 -- `notifyAutoupdateScopeFailure` dispatches `MarketplaceNotFoundError → { kind: "marketplace-not-added", name, scope }`; count of "marketplace-not-added" = 2 |
| 9 | marketplace autoupdate/noautoupdate of a name missing in every scope renders standalone (failed) {not added}, not a reason-less (failed) | VERIFIED | autoupdate.ts:234-238 -- `missingEverywhere` branch emits `{ kind: "marketplace-not-added", name: failureName, scope: opts.scope ?? first.scope }`; no bare reason-less (failed) emitted |
| 10 | marketplace autoupdate keeps its StateLockHeldError → (failed) {lock held} synthetic-child routing unchanged | VERIFIED | autoupdate.ts:138 -- `autoupdateFailedRow` still maps `StateLockHeldError → ["lock held"]`; `notifyAutoupdateScopeFailure` only routes `MarketplaceNotFoundError` to not-added; all other errors keep synthetic-child path |
| 11 | marketplace remove of a missing marketplace (explicit scope + bare form) renders standalone (failed) {not added}, no raw MarketplaceNotFoundError escapes | VERIFIED | remove.ts: `resolveScopeOrNotifyNotAdded` (S3 at :201-208, S4 at :186-196) catches `MarketplaceNotFoundError` and routes to `{ kind: "marketplace-not-added" }` before entering guard; `grep -c "throw new MarketplaceNotFoundError"` = 0 |
| 12 | no precondition error from autoupdate/remove escapes raw to the Pi command runner | VERIFIED | Edge handler for remove is a thin shim (remove.ts edge handler passes straight to orchestrator which handles all misses); edge-handler tests assert no escape for both S3 and S4; autoupdate.ts routes all MarketplaceNotFoundError through notify |
| 13 | a path-source malformed/schema-invalid manifest during marketplace update renders (failed) {invalid manifest}, never {network unreachable} | VERIFIED | update.ts:542-546 -- `reasonsFromCascadeError` checks `err instanceof InvalidMarketplaceManifestError` (and one-level cause unwrap) and returns `["invalid manifest"] as const` BEFORE the `?? ["network unreachable"]` default |
| 14 | the refreshOneMarketplace ?? [network unreachable] default does not fire for a path-source manifest failure | VERIFIED | update.ts:543-546 typed branch intercepts `InvalidMarketplaceManifestError` before the `?? ["network unreachable"]` default; update.test.ts asserts path-source invalid-manifest renders `{invalid manifest}` and NOT `{network unreachable}` |
| 15 | the path-source update failure path calls zero gitOps methods (NFR-5) | VERIFIED | update.ts path-source branch at :387-388 calls only `validateManifestAtRoot → loadMarketplaceManifest`; no `platform/git` import on path branch (update.ts imports confirm git is github-only); NFR-5 failure-path zero-gitOps test asserts 0 spy calls |
| 16 | a github-source refresh failure with no errno still defaults to {network unreachable} (path/github classification not collapsed) | VERIFIED | `reasonsFromCascadeError` only intercepts typed `InvalidMarketplaceManifestError`; errno-less github failures return `undefined` → `?? ["network unreachable"]` fires; update.test.ts Pitfall-3 regression lock asserts this |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/shared/notify.ts` | MpFailed.reasons?: readonly ContentReason[] + renderMpHeader failed-arm reason brace | VERIFIED | Line 622: field present; Lines 1078-1090: renderer block with composeReasons + reasonsBrace ternary |
| `extensions/pi-claude-marketplace/shared/errors.ts` | InvalidMarketplaceManifestError typed class | VERIFIED | Line 210: `export class InvalidMarketplaceManifestError extends Error` |
| `extensions/pi-claude-marketplace/domain/manifest.ts` | Throws InvalidMarketplaceManifestError for malformed JSON and schema-invalid input | VERIFIED | Lines 14, 62, 75: import + 2 throw sites confirmed |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | classifyAddError + notify-routed precondition failures | VERIFIED | Lines 155-181: classifyAddError with 5 instanceof branches; Lines 287-308: notify call with reasons |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` | MarketplaceNotFoundError → standalone MarketplaceNotAddedMessage at S1 + S2 | VERIFIED | Lines 163-169 (S1), 234-238 (S2): both emit `{ kind: "marketplace-not-added" }` |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | pre-guard not-added check + bare-form resolveScopeFromState catch → standalone variant | VERIFIED | Lines 186-211: `resolveScopeOrNotifyNotAdded` handles S3 (explicit) + S4 (bare); 0 raw throws |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | reasonsFromCascadeError recognizes InvalidMarketplaceManifestError → [invalid manifest] | VERIFIED | Lines 542-546: typed branch before errno checks |
| `docs/output-catalog.md` | 5 add states + remove/autoupdate not-added states + update path-invalid-manifest state + bare-(failed) states unchanged | VERIFIED | 5 `catalog-state: add-*` entries; `remove-missing-not-added`, `remove-missing-not-added-bare`, `autoupdate-missing-not-added`, `autoupdate-missing-not-added-bare`, `update-path-invalid-manifest`; `failure-unreachable` and `mp-failure-network` bare-(failed) unchanged |
| `tests/architecture/notify-types.test.ts` | _Assert_ReasonsOnMpFailed positive proof; _NoDetailsOnMpFailed retained | VERIFIED | Lines 1047-1052: `_Assert_ReasonsOnMpFailed` type + `_mrf = true` export; line 1052: `_NoDetailsOnMpFailed` retained |
| `tests/architecture/catalog-uat.test.ts` | All new catalog states paired with byte-equal fixtures | VERIFIED | `npm run check` passes with 1502 tests, 0 failures; catalog-uat test passes as test #1 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| orchestrators/marketplace/add.ts | shared/notify.ts MpFailed.reasons | notify({ marketplaces: [{ status: "failed", reasons: [...], plugins: [] }] }) | WIRED | Line 301-308: `status: "failed", reasons: [reason], plugins: []` confirmed |
| shared/notify.ts renderMpHeader failed arm | composeReasons | `composeReasons(mp.reasons, false, false, probe)` | WIRED | Line 1087: call confirmed with both false flags |
| domain/manifest.ts loadMarketplaceManifestUncached | shared/errors.ts InvalidMarketplaceManifestError | throw new InvalidMarketplaceManifestError(...) | WIRED | Lines 62, 75 in manifest.ts confirmed; line 14 import confirmed |
| orchestrators/marketplace/autoupdate.ts S1/S2 | shared/notify.ts MarketplaceNotAddedMessage | notify(ctx, pi, { kind: "marketplace-not-added", name, scope? }) | WIRED | Lines 164-168 and 234-237: both sites use `kind: "marketplace-not-added"` |
| orchestrators/marketplace/remove.ts | shared/notify.ts MarketplaceNotAddedMessage | pre-guard loadState miss → notify standalone variant | WIRED | Lines 191 and 203-207: S4 and S3 respectively emit `{ kind: "marketplace-not-added" }` |
| orchestrators/marketplace/update.ts reasonsFromCascadeError | shared/errors.ts InvalidMarketplaceManifestError | err instanceof InvalidMarketplaceManifestError → [invalid manifest] | WIRED | Lines 542-546: instanceof check + one-level cause unwrap confirmed |
| orchestrators/marketplace/update.ts refreshOneMarketplace catch | the typed reason (not the network default) | typedReasons (now classifies invalid manifest) before ?? network fallback | WIRED | Line 478, 755: `reasonsFromCascadeError(err)` called; typed branch fires before `?? ["network unreachable"]` |

### Data-Flow Trace (Level 4)

All artifacts route through `notify()` which is the output channel; no rendering stubs. The key flows:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| add.ts classifyAddError | `reason: ContentReason` | instanceof dispatch on caught error | Real typed error instances | FLOWING |
| autoupdate.ts notifyAutoupdateScopeFailure | `kind: "marketplace-not-added"` | MarketplaceNotFoundError instanceof check | Real error from withStateGuard | FLOWING |
| remove.ts resolveScopeOrNotifyNotAdded | `kind: "marketplace-not-added"` | loadState miss + resolveScopeFromState catch | Real state read | FLOWING |
| update.ts reasonsFromCascadeError | `["invalid manifest"]` | InvalidMarketplaceManifestError instanceof | Real error from manifest loader | FLOWING |

### Behavioral Spot-Checks

Full `npm run check` used as the definitive spot-check (1502 tests, 0 failures, exit 0).

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite including all ATTR-05/06/07/10 tests | `npm run check` from extensions/pi-claude-marketplace | 1502 pass, 0 fail, exit 0 | PASS |
| catalog-uat byte-equality for all new states | Test #1 in suite: "catalog UAT: every catalog-state annotation pairs byte-equal with notify()" | ok 1 | PASS |
| typecheck (D-48-A type proof + InvalidMarketplaceManifestError) | `tsc --noEmit` (part of npm run check) | exit 0 | PASS |
| REASONS tuple length-lock (type _Assert_ReasonsLen) | notify-types.test.ts included in full suite | pass | PASS |

### Probe Execution

No probe scripts declared or applicable for this phase (TS-only edits, no migration scripts).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| ATTR-05 | 48-02 | autoupdate/noautoupdate of a missing marketplace reports {not added} consistently | SATISFIED | autoupdate.ts S1+S2 emit `marketplace-not-added`; 2 emission sites confirmed; tests assert byte forms |
| ATTR-06 | 48-02 | marketplace remove renders (failed) {not added}, no raw MarketplaceNotFoundError | SATISFIED | remove.ts: 0 raw throws; 2 `marketplace-not-added` emission sites; edge-handler tests assert no escape |
| ATTR-07 | 48-01 | marketplace add surfaces 5 precondition failures as structured (failed) rows | SATISFIED | classifyAddError: 5 instanceof branches; all 5 reason strings asserted in add.test.ts; cleanupStaging preserved (MA-9) |
| ATTR-10 | 48-03 | path-source manifest failure reports {invalid manifest}, never {network unreachable} | SATISFIED | reasonsFromCascadeError typed branch intercepts InvalidMarketplaceManifestError; NFR-5 zero-gitOps test passes |

All 4 requirements assigned to Phase 48 are SATISFIED. No orphaned requirements (REQUIREMENTS.md maps ATTR-05/06/07/10 exclusively to Phase 48).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | -- | TBD/FIXME/XXX scan clean | -- | Zero debt markers in any phase-48 modified file |

### Human Verification Required

None. All phase-48 behaviors are fully verifiable from code + passing tests.

### Gaps Summary

No gaps. All 16 observable truths are VERIFIED against the live codebase. `npm run check` exits 0 with 1502 tests (0 failures). The IN-02 cross-surface asymmetry (probe-classifiers.ts schema-invalid manifest maps to `{unreadable}` instead of `{invalid manifest}`) is intentionally deferred to Phase 49's cross-op convergence proof and is NOT a phase-48 gap.

---

_Verified: 2026-06-07T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
