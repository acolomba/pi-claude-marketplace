---
phase: 37
slug: phase-ledger-undo-gap
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 37 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, via `tsx`) |
| **Config file** | none -- uses `npm run check` script in `package.json` |
| **Quick run command** | `npm run test -- tests/transaction/phase-ledger.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~18 seconds full suite (per existing CI baseline) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tests/transaction/phase-ledger.test.ts`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds (single-file test) / ~18 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 01 | 1 | TR-02 | -- | failing-phase undo runs exactly once before rollback walk | unit | `npm run test -- tests/transaction/phase-ledger.test.ts` | ✅ | ⬜ pending |
| 37-01-02 | 01 | 1 | TR-02 | -- | reverse-walk excludes failing phase (no double rollback) | unit | `npm run test -- tests/transaction/phase-ledger.test.ts` | ✅ | ⬜ pending |
| 37-01-03 | 01 | 1 | TR-02 | -- | PathContainmentError from failing-phase undo re-throws | unit | `npm run test -- tests/transaction/phase-ledger.test.ts` | ✅ | ⬜ pending |
| 37-01-04 | 01 | 1 | TR-02 | -- | Phase<C>.undo JSDoc documents partial-do tolerance | static | `npm run typecheck && grep -cE "tolerate" extensions/pi-claude-marketplace/transaction/phase-ledger.ts \| awk '$1>=1{rc=0} END{exit rc=rc?rc:1}' && grep -cE "partial-do" extensions/pi-claude-marketplace/transaction/phase-ledger.ts \| awk '$1>=1{rc=0} END{exit rc=rc?rc:1}'` | ✅ | ⬜ pending |
| 37-01-05 | 01 | 1 | TR-02 | -- | full check passes, no regression | integration | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* `tests/transaction/phase-ledger.test.ts` and the `node:test` runner are already in place from prior milestones.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A -- no Wave 0 required)
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
