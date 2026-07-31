---
phase: 87
slug: bucket-a-admission-platform-floor
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-29
---

# Phase 87 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in runner, TS via native strip) |
| **Config file** | package.json `scripts.test` |
| **Quick run command** | `node --test tests/domain/components/hooks.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~60 seconds (full check) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command scoped to the touched suite
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 87-01-01 | 01 | 1 | ADMIT-01 (prep) | — | N/A | typecheck + unit | `npm run typecheck && node --test tests/architecture/hooks-translators.test.ts tests/bridges/hooks/dispatch-exec.test.ts` | ✅ | ✅ green |
| 87-01-02 | 01 | 1 | ADMIT-01 (prep) | — | N/A | unit | `node --test tests/domain/resolver-strict.test.ts tests/domain/components/hooks.test.ts tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/install.test.ts tests/shared/notify-v2.test.ts tests/architecture/hooks-supportability.test.ts` | ✅ | ✅ green |
| 87-02-01 | 02 | 2 | ADMIT-01 | — | N/A | typecheck + unit (tracer) | `npm run typecheck && node --test tests/architecture/hooks-supportability.test.ts tests/architecture/hooks-translators.test.ts tests/domain/resolver-strict.test.ts tests/bridges/hooks/dispatch-exec.test.ts` | ✅ | ✅ green |
| 87-02-02 | 02 | 2 | ADMIT-01, FLOOR-01 | — | N/A | unit + grep | `node --test tests/domain/components/hooks.test.ts tests/architecture/hooks-supportability.test.ts && grep -n "0.80.5" package.json` | ✅ | ✅ green |
| 87-02-02 | 02 | 2 | FLOOR-01 | — | N/A | architecture | `node --test tests/architecture/peer-floor.test.ts` | ✅ (added by validate-phase) | ✅ green |
| 87-03-01 | 03 | 3 | ADMIT-02 | — | N/A | fixture parse | `node -e "for (const f of ['tests/fixtures/hookify-hooks.json','tests/fixtures/ralph-wiggum-hooks.json']) { JSON.parse(require('node:fs').readFileSync(f,'utf8')); } console.log('ok')"` | ❌ ralph-wiggum fixture created by task | ✅ green |
| 87-03-02 | 03 | 3 | ADMIT-02 | — | N/A | unit | `node --test tests/domain/resolver-strict.test.ts tests/orchestrators/plugin/info.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (node:test suites under
`tests/domain/components/` already exercise the admission machinery).

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing suites cover the phase)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-30

---

## Validation Audit 2026-07-30

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

FLOOR-01 lacked a persistent automated test (verified only by a one-shot grep
in the plan verify block). Resolved by `tests/architecture/peer-floor.test.ts`
— asserts the `@earendil-works/pi-coding-agent` peer range is `>=0.80.5` in
package.json AND that package-lock.json's root mirror stays in sync.
Adversarially verified (reverting the floor makes both assertions fail).
ADMIT-01 / ADMIT-02 were already COVERED by green suites. Execution statuses
in the Per-Task Verification Map confirmed green by the phase verifier.
