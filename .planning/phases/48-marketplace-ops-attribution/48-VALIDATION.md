---
phase: 48
slug: marketplace-ops-attribution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 48 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in) + `node:assert/strict` |
| **Config file** | none (CLI invocation in package.json `test` script) |
| **Quick run command** | `node --test "tests/orchestrators/marketplace/<op>.test.ts"` (per-op) |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier:check + npm test) |
| **Byte-contract runner** | `node --test "tests/architecture/catalog-uat.test.ts"` |
| **Type-proof gate** | `npx tsc --noEmit` (drives notify-types.test.ts `_Assert_*` / `@ts-expect-error`) |
| **Estimated runtime** | per-op a few seconds; full check ~1-2 min |

---

## Sampling Rate

- **While editing / per task:** `npx tsc --noEmit` + the touched op's `node --test tests/orchestrators/marketplace/<op>.test.ts` + (after any catalog/renderer edit) `node --test tests/architecture/catalog-uat.test.ts` + (after the type-model edit) `node --test tests/architecture/notify-types.test.ts`.
- **Per wave merge:** `npm run check` (the phase converges on shared/notify.ts -- serialize through one merge gate, like Phase 47).
- **Phase gate:** full `npm run check` GREEN before `/gsd-verify-work`. `git diff --stat docs/output-catalog.md` is NON-empty (bytes change); every changed/added state has a paired catalog-uat fixture.
- **Max feedback latency:** typecheck < ~10s.

---

## Per-Task Verification Map

> Task IDs assigned during planning. Reconcile after `/gsd-plan-phase`.

| Requirement | Behavior | Test Type | Automated Command | Status |
|-------------|----------|-----------|-------------------|--------|
| ATTR-05 | autoupdate/noautoupdate missing-mp (explicit + missing-everywhere) → standalone `(failed) {not added}` (no reason-less failed, no `{not found}`) | unit + byte | `node --test tests/orchestrators/marketplace/autoupdate.test.ts`; catalog-uat | ⬜ pending |
| ATTR-06 | remove missing-mp → `(failed) {not added}`; no raw MarketplaceNotFoundError; edge handler routes via notify | unit + byte | `node --test tests/orchestrators/marketplace/remove.test.ts`; `node --test tests/edge/handlers/marketplace/remove.test.ts`; catalog-uat | ⬜ pending |
| ATTR-07 | add precondition failures (duplicate name / stale clone / unsupported source / source missing / invalid manifest) → `(failed) {<reason>}` on the marketplace subject | unit + byte | `node --test tests/orchestrators/marketplace/add.test.ts`; `node --test tests/edge/handlers/marketplace/add.test.ts`; catalog-uat | ⬜ pending |
| ATTR-10 | path-source manifest failure → `{invalid manifest}`, never `{network unreachable}`; zero gitOps on path failure (NFR-5) | unit + byte | `node --test tests/orchestrators/marketplace/update.test.ts`; catalog-uat | ⬜ pending |
| D-48-A (type) | `MpFailed.reasons?: readonly ContentReason[]` exists; `not added` still excluded; `details` still excluded on failed | type-proof | `npx tsc --noEmit` (notify-types.test.ts) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The genuinely-new surfaces this phase must add (existing per-op orchestrator tests, edge-handler
tests, catalog-uat byte runner, and the notify-types type-proof file already exist):

- [ ] `tests/architecture/notify-types.test.ts` -- invert `_NoReasonsOnMpFailed` → `_Assert_ReasonsOnMpFailed` (D-48-A type-model touch); keep `_NoDetailsOnMpFailed`; lands WITH the renderer change.
- [ ] New catalog states + FIXTURES entries:
  - `marketplace add`: duplicate-name, stale-clone, unsupported-source, source-missing, invalid-manifest (5 states, `expectedSeverity: "error"`).
  - `marketplace remove`: missing-not-added standalone variant (mirror Phase 47 update fixtures).
  - `marketplace autoupdate|noautoupdate`: amend the `{not found}` failure → standalone `{not added}` (+ absent-from-both if applicable).
  - `marketplace update`: path-invalid-manifest `(failed) {invalid manifest}`.
- [ ] Byte-regression assertions that the 3 existing bare-`(failed)` states (add unreachable, update network, autoupdate bare not-found) stay byte-unchanged after the `MpFailed.reasons?` addition (Pitfall 1).

No framework install. (Only-if a typed `InvalidMarketplaceManifestError` is introduced for ATTR-10: add a domain/manifest test that it is thrown for malformed/schema-invalid input and survives the manifest-cache negative-cache re-throw.)

---

## Manual-Only Verifications

*All phase behaviors have automated verification* (per-op + edge-handler unit tests for reason
routing, catalog-uat byte-equality, notify-types type proofs).

---

## Validation Sign-Off

- [ ] All tasks have automated verify (per-op/edge test + catalog-uat where bytes change + typecheck for the type touch)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the proof inversion + new catalog states + bare-(failed) byte-regression locks
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s (typecheck/per-op)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
