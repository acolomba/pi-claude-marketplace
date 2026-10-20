---
phase: "8"
slug: "marketplace-help-and-usage-errors"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-20"
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` (scenarios); `node:test` (unit, architecture) |
| **Config file** | `cucumber.json` (`tags: "not @url and not @github"`) |
| **Quick run command** | `npm run --silent test:cucumber -- features/marketplace/<file>.feature --parallel 1` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~5 seconds per feature file; ~105 seconds for `npm run check` |

---

## Sampling Rate

- **After every task commit:** Run the touched feature file and the touched `node --test` files (the commit hook's `check:commit` does not run cucumber)
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled from the PLAN files during execution) | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements (08-RESEARCH.md "Validation Architecture"): the scenarios use the existing `the user runs` and `the result has these fields:` steps.*

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
