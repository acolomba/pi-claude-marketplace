---
phase: "13"
slug: "prune"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-11-08"
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js (default profile `adapter`) |
| **Config file** | `cucumber.json` (frozen) |
| **Quick run command** | `npx cucumber-js features/plugin/prune.feature` |
| **Full suite command** | `npm run check` (both cucumber profiles), plus `npm run test:modules` at the phase gate |
| **Estimated runtime** | ~25 seconds quick; the full gate several minutes |

---

## Sampling Rate

- **After every task commit:** Run `npx cucumber-js features/plugin/prune.feature` and `npm run check:features`
- **After every plan wave:** Run the parts of `npm run check` in order (background, exit code to a file)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | PRUNE-01 | — | N/A | cucumber | `npx cucumber-js features/plugin/prune.feature` | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | PRUNE-02 | — | N/A | cucumber | `npx cucumber-js features/plugin/prune.feature` | ✅ | ⬜ pending |
| 13-01-03 | 01 | 1 | PRUNE-01, PRUNE-02 | — | N/A | cucumber | `npx cucumber-js features/plugin/usage-errors.feature:88:102:135:167:203 features/plugin/state-lock.feature:331:358` | ✅ | ⬜ pending |

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
