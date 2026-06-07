---
phase: 46
slug: type-model-foundations
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-06-07
---

# Phase 46 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in) + `node:assert/strict`; TS via native strip |
| **Config file** | none (`node --test`) |
| **Quick run command** | `npm run typecheck` (the load-bearing proof for TYPE-01..04 lands at typecheck) |
| **Full suite command** | `npm run check` (typecheck + eslint + prettier + tests) |
| **Estimated runtime** | ~typecheck a few seconds; full check ~1-2 min |

---

## Sampling Rate

- **While editing:** Run `npm run typecheck` iteratively -- it is the fastest TYPE-* signal (negative-presence `@ts-expect-error` proofs fail loudly).
- **Single commit gate:** Phase 46 is ONE atomic commit (D-46-06); `npm run check` must exit 0 at that commit (NFR-6).
- **Before `/gsd-verify-work`:** Full `npm run check` green.
- **Max feedback latency:** typecheck < ~10s.

---

## Per-Task Verification Map

> Phase 46 lands as ONE atomic commit (D-46-06). Task IDs are assigned during planning; every task's
> verification resolves to the same typecheck + byte-equality + renderer surfaces below. Reconcile
> concrete task IDs after `/gsd-plan-phase` populates the plan(s).

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| TYPE-01 | dedicated `marketplace-not-added` variant; no placeholder fields; byte-identical row | compile proof + byte-equality | `npm run typecheck` (`@ts-expect-error` `_NoMpScope`/`_NoMpDetails`, `_Assert_NotifSixArms`) + `node --test tests/architecture/catalog-uat.test.ts` | ✅ notify-types.test.ts + catalog-uat.test.ts | ⬜ pending |
| TYPE-02 | `["not added","permission denied"]` unrepresentable on a row | compile-fail | `npm run typecheck` (`@ts-expect-error` `_illegal`, `_Assert_NotAddedExcluded`) | ✅ notify-types.test.ts | ⬜ pending |
| TYPE-03 | single `isInfoKind`; adding a kind = compile error in every consumer | compile proof + behavior | `npm run typecheck` (assertNever in all 4) + `node --test tests/shared/notify-v2.test.ts` | ✅ notify-v2.test.ts | ⬜ pending |
| TYPE-04 | reasons only on skipped arm, details only on list arm | compile proof | `npm run typecheck` (`@ts-expect-error` `_NoReasonsOnMpFailed`/`_NoDetailsOnMpSkipped`) | ✅ notify-types.test.ts | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* All three test files
(`tests/architecture/notify-types.test.ts`, `tests/architecture/catalog-uat.test.ts`,
`tests/shared/notify-v2.test.ts`) exist; the byte-equality runner + type-proof harness are already
in place. Phase 46 ADDS asserts and RE-KEYS fixtures within them -- no new test infrastructure, no
framework install.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.* TYPE-01..04 are proved at compile time
(`@ts-expect-error` / `_Assert_*` constants) plus byte-equality and renderer unit tests -- no manual
verification required.

---

## Validation Sign-Off

- [ ] All tasks resolve to `npm run typecheck` / byte-equality / renderer verify (Wave 0 already satisfied)
- [ ] Sampling continuity: single atomic commit gated by `npm run check`
- [ ] Wave 0 covers all MISSING references (none -- infra exists)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s (typecheck)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
