---
phase: 41
slug: documentation-and-test-closeout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 41 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, via `tsx`) |
| **Config file** | none -- uses `npm run check` |
| **Quick run command** | `npm run test -- tests/bridges/agents/stage.test.ts tests/orchestrators/plugin/list.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~18 seconds full suite |

---

## Sampling Rate

- **After every task commit:** Run the relevant test file
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5s single-file / ~18s full

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 1 | TR-07 | -- | commitPreparedAgents step-1 inline comment present (ENOENT-tolerant idempotency); behavior-asserting regression test | unit | `npm run test -- tests/bridges/agents/stage.test.ts` | ✅ | ⬜ pending |
| 41-01-02 | 01 | 1 | TR-08 | -- | availableRowMessage probe-failure swallow comment references D-19-01; source-grep test asserts no module-level PROBE_FAILURES accumulator | unit | `npm run test -- tests/orchestrators/plugin/list.test.ts` | ✅ | ⬜ pending |
| 41-01-03 | 01 | 1 | -- | -- | full check passes; no regression from 1366 baseline | integration | `npm run check` | ✅ | ⬜ pending |

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
