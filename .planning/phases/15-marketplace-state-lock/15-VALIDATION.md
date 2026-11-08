---
phase: "15"
slug: "marketplace-state-lock"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-11-08"
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` (`adapter` profile) plus the `npm run check:features` dry-run gate |
| **Config file** | `cucumber.json` (frozen) |
| **Quick run command** | `npx cucumber-js --profile adapter --parallel 3 --order defined --format progress features/marketplace/state-lock.feature` |
| **Full suite command** | the parts of `npm run check` in order: `npm run check:static`, `npm run test:unpaired`, `npm run test:integration`, `npm run test:cucumber:profile -- --profile adapter --parallel 3`, `npm run test:cucumber:profile -- --profile builtin --parallel 3`, `npm run test:coverage:direct:all` |
| **Estimated runtime** | ~35 seconds (quick); ~10 minutes (full, under shared load) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command and `npm run check:features`
- **After every plan wave:** Run the full suite command parts, each in the background with its exit code written to a file
- **Before `/gsd-verify-work`:** Full suite must be green; the phase gate also runs `npm run check` once and `npm run test:modules`
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | MLOCK-01 | — | A flip under a live lock changes no config or record | cucumber | quick run command | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | MLOCK-02 | — | A stale lock blocks no verb; a live lock still blocks | cucumber | quick run command | ✅ | ⬜ pending |
| 15-01-03 | 01 | 1 | MLOCK-01, MLOCK-02 | — | N/A | static + gate | `npm run check:features` and the full suite parts | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

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
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
