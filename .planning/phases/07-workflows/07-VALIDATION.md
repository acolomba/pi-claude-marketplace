---
phase: "7"
slug: "workflows"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-01"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | @cucumber/cucumber (behavioral) + node:test (unit, integration) |
| **Config file** | cucumber.json (frozen) |
| **Quick run command** | `npx cucumber-js features/workflow/<file>.feature` |
| **Full suite command** | `npm run check` + `npm run test:modules` + `npm run test:cucumber` (nondac-sh wrapper) |
| **Estimated runtime** | ~7 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx cucumber-js features/workflow/<file>.feature` then `npm run check:features`
- **After every plan wave:** Run `npx cucumber-js features/workflow` (3 seeds), then `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 7 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01 | 01 | 1 | WFL-01 | — | N/A | e2e | `npx cucumber-js features/workflow/listing.feature` | ❌ W1 | ⬜ pending |
| 7-02 | 02..05 | 2 | WFL-02..05 | see plans | stale command refused; no run approval recorded | e2e | `npx cucumber-js features/workflow/<file>.feature` | ❌ W2 | ⬜ pending |
| 7-06 | 06 | 3 | all | — | N/A | gate | `npm run check` | ✅ | ⬜ pending |

(The planner's task IDs supersede these rows; see each PLAN's `<verify>`.)

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|


*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 7s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
