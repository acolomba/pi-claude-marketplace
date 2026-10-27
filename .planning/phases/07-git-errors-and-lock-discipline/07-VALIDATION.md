---
phase: "7"
slug: "git-errors-and-lock-discipline"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-26"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test + @cucumber/cucumber |
| **Config file** | package.json scripts; cucumber.json |
| **Quick run command** | `node --test <owner test>` + `npx cucumber-js --name <scenario>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~75 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run owner tests + pre-commit check:commit
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 75 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner per task) | — | — | GLK-01..08 | — | N/A | unit/cucumber | see RESEARCH.md Validation Architecture | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A two-process intent-mark race in one millisecond | GLK-06 | not deterministic across processes | covered by a unit test with mocked `Date` |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 75s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
