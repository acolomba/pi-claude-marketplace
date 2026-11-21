---
phase: "1"
slug: "duplicate-integration-files"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-21"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cucumber-js 13.3.0 (behavioral); `node:test` for the integration files being deleted |
| **Config file** | `cucumber.json` (profiles `adapter` and `builtin`) |
| **Quick run command** | `npm run test:cucumber:profile -- --profile <adapter\|builtin> <paths or file:line>` with the non-DAC environment of `01-CONTEXT.md` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~20-60 seconds per focused run; the full check is far longer (2,400-second limit) |

---

## Sampling Rate

- **After every task commit:** Run the task's focused cucumber command under the touched profiles, plus `npm run check:static` by hand in a worktree
- **After every plan wave:** Run `npm run check` on the combined tree
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 600 seconds

---

## Per-Task Verification Map

Filled by the planner from `01-RESEARCH.md` "Phase Requirements → Test Map"; the task IDs follow the plans.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-* | 01 | 1 | ITDUP-01 | — | N/A | behavioral | focused runs of `features/plugin/session-start-hooks.feature`, `features/hook/session.feature:7`, `:391`, `:410`, `features/hook/failures.feature:31`, `features/hook/async.feature:470`, `features/hook/session-end.feature:153`, `:200` | ✅ | ⬜ pending |
| 1-02-* | 02 | 1 | ITDUP-02 | — | N/A | behavioral, both profiles | `features/plugin/subagent-child.feature` (adapter and builtin), `features/agent/frontmatter.feature:410`, `:423` | ❌ W0 (new scenario) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `features/lib/real-subagent-child.ts` — optional `body` column for `parseRealChildAgents`
- [ ] `features/plugin/subagent-child.feature` — the new `@mcp` empty-body child scenario

---

## Manual-Only Verifications

All phase behaviors have automated verification. Each deliberate break is a manual, reverted experiment whose command and failing scenario the plan's SUMMARY.md records.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 600s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
