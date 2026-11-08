---
phase: "3"
slug: "stopfailure-hooks"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-08"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` (behavioral); `node:test` (unit) |
| **Config file** | `cucumber.json` (profiles `adapter`, `builtin`) |
| **Quick run command** | `npx cucumber-js --profile adapter --parallel 3 features/hook/stop-failure.feature` |
| **Full suite command** | `npm run check` (phase gate also `npm run test:modules`) |
| **Estimated runtime** | ~60 seconds quick; ~8 minutes full under load |

---

## Sampling Rate

- **After every task commit:** the commit hook (`npm run check:commit`, staged pairs) plus the quick run
- **After every plan wave:** the parts of `npm run check` in order
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-xx (SC1, SC2) | 01 | 1 | STOPF-01 | — | N/A | behavioral | quick run command | ✅ seed | ⬜ pending |
| 3-xx (SC3, SC4) | 01 | 1 | STOPF-01 | — | N/A | behavioral | quick run command | ✅ | ⬜ pending |
| 3-xx (D-BG-301..303) | 02 | 2 | STOPF-01 | — | N/A | behavioral + unit | quick run command; `npm run test:coverage:direct -- <the four sources>` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

The planner replaces the `3-xx` rows with its task IDs.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
