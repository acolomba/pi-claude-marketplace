---
phase: 8
slug: atomic-reinstall-core
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-13
---

# Phase 8 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
| -------- | ----- |
| **Framework** | Node built-in `node:test` with TypeScript ESM runtime |
| **Config file** | none - package scripts drive test globs |
| **Quick run command** | `node --test "tests/{architecture,bridges,orchestrators,transaction}/**/*.test.ts"` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~30-90 seconds depending on full suite |

---

## Sampling Rate

- **After every task commit:** Run the task-specific `node --test ...` command listed in the plan.
- **After every plan wave:** Run `node --test "tests/{architecture,bridges,orchestrators,transaction}/**/*.test.ts"`.
- **Before `/gsd-verify-work`:** `npm run check` must be green.
- **Max feedback latency:** Target < 60 seconds for focused task checks; full suite allowed at phase gate.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
| ------- | ---- | ---- | ----------- | --------- | ----------------- | ----------- | ------ |
| 08-01-01 | 01 | 1 | PRL-07, PRL-10 | transaction unit | `node --test tests/transaction/with-state-guard.test.ts` | ✅ | ✅ green |
| 08-01-02 | 01 | 1 | PRL-07 | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ | ✅ green |
| 08-02-01 | 02 | 2 | PRL-09, PRL-10 | bridge unit | `node --test tests/bridges/skills/stage.test.ts tests/bridges/commands/stage.test.ts` | ✅ | ✅ green |
| 08-02-02 | 02 | 2 | PRL-09, PRL-10 | bridge unit | `node --test tests/bridges/skills/stage.test.ts tests/bridges/commands/stage.test.ts` | ✅ | ✅ green |
| 08-03-01 | 03 | 2 | PRL-09, PRL-10 | bridge unit | `node --test tests/bridges/agents/stage.test.ts` | ✅ | ✅ green |
| 08-03-02 | 03 | 2 | PRL-09, PRL-10 | bridge unit | `node --test tests/bridges/mcp/stage.test.ts` | ✅ | ✅ green |
| 08-04-01 | 04 | 3 | PRL-02, PRL-06, PRL-07, PRL-08 | orchestrator unit | `node --test tests/orchestrators/plugin/reinstall.test.ts tests/architecture/no-orchestrator-network.test.ts` | ✅ | ✅ green |
| 08-04-02 | 04 | 3 | PRL-09, PRL-10 | orchestrator unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ | ✅ green |
| 08-04-03 | 04 | 3 | PRL-11, PRL-12 | orchestrator unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Plan 04 created the focused orchestrator test file and all Phase 8 automated checks are green.

---

## Manual-Only Verifications

All Phase 8 behaviors have automated verification. Phase 9 will own user-facing command/manual UX checks.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands.
- [x] Sampling continuity: no 3 consecutive implementation tasks without automated verify.
- [x] Wave 0 covers all MISSING references by assigning new test-file creation to Plan 04.
- [x] No watch-mode flags.
- [x] Feedback latency target documented.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** complete - Plan 08-04 ran `node --test tests/orchestrators/plugin/reinstall.test.ts tests/architecture/no-orchestrator-network.test.ts`, `node --test "tests/{architecture,bridges,orchestrators,transaction}/**/*.test.ts"`, and `npm run check` successfully.
