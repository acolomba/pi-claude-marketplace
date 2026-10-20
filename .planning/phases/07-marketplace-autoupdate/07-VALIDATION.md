---
phase: "7"
slug: "marketplace-autoupdate"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-19"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` (scenarios); `node:test` (unit, integration, architecture) |
| **Config file** | `cucumber.json` (`tags: "not @url and not @github"`) |
| **Quick run command** | `npx cucumber-js features/marketplace/autoupdate.feature` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~5 seconds (quick); the autoupdate.ts paired direct coverage ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx cucumber-js features/marketplace/autoupdate.feature` (the commit hook's `check:commit` does not run cucumber)
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

- [ ] The D-09 config-writing step (`features/step_definitions/config.steps.ts` with `features/lib/layer-config.ts`) and the steps.md rule amendment, before the D-05 scenario

*Everything else uses existing infrastructure (07-RESEARCH.md "Validation Architecture").*

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
