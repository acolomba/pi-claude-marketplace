---
phase: 40
slug: update-state-before-commit-reorder
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 40 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, via `tsx`) |
| **Config file** | none -- uses `npm run check` |
| **Quick run command** | `npm run test -- tests/orchestrators/plugin/update.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~18 seconds full suite |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tests/orchestrators/plugin/update.test.ts`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5s single-file / ~18s full

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | TR-04 | -- | markUpdateInProgress sets compatibility.installable=false before commits | unit | `npm run test -- tests/orchestrators/plugin/update.test.ts` | ✅ | ⬜ pending |
| 40-01-02 | 01 | 1 | TR-04 | -- | finalizeUpdateRecord per-bridge resources + all-or-nothing version bump | unit | `npm run test -- tests/orchestrators/plugin/update.test.ts` | ✅ | ⬜ pending |
| 40-01-03 | 01 | 1 | TR-04 | -- | D-03 continue-on-failure preserved (all 4 bridges attempt; failures accumulate; hint fires) | unit | `npm run test -- tests/orchestrators/plugin/update.test.ts` | ✅ | ⬜ pending |
| 40-01-04 | 01 | 1 | TR-04 | -- | 4-bridge x 2-outcome matrix: each bridge fails alone; resources reflect committed bridges only | unit | `npm run test -- tests/orchestrators/plugin/update.test.ts` | ✅ | ⬜ pending |
| 40-01-05 | 01 | 1 | TR-04 | -- | retry test: partial-success seed -> second run reaches version=NEW | unit | `npm run test -- tests/orchestrators/plugin/update.test.ts` | ✅ | ⬜ pending |
| 40-01-06 | 01 | 1 | -- | -- | full check passes; no regression from 1362 baseline | integration | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A)
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
