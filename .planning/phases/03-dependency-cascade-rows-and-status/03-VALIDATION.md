---
phase: "3"
slug: "dependency-cascade-rows-and-status"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-26"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, integration), `@cucumber/cucumber` (behavioral), catalog UAT (`test/architecture/catalog-uat/`) |
| **Config file** | `package.json` scripts, `cucumber.json` |
| **Quick run command** | `node --test <test-path>` plus `npm run test:coverage:direct -- <source>`; one scenario: `npx cucumber-js --name '<title>'` |
| **Full suite command** | `npm run check` (never piped; read `$?`) |
| **Estimated runtime** | ~75 seconds for `npm run check` on this machine; owner tests a few seconds |

---

## Sampling Rate

- **After every task commit:** the owner test files, the changed pairs' direct coverage, and each changed or new cucumber scenario (the hook's `check:commit` runs no cucumber)
- **After every plan wave:** `npm run check` on the combined tree
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

See `03-RESEARCH.md` § Validation Architecture → Phase Requirements → Test Map for the requirement-level map; plans fill task IDs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-xx-xx | — | — | CAS-01..07 | — | names in causes escaped/bounded | unit / cucumber | per plan `<verify>` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (every new scenario uses existing step definitions).

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
