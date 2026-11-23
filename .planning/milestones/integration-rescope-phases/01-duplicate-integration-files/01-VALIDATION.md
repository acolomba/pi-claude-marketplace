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
| 01-01-01 | 01 | 1 | ITDUP-01 | T-01-01, T-01-02, T-01-03 | a break is restored in an EXIT trap, runs only in the plan's own checkout, and counts only on an assertion failure | behavioral (tracer) | the detector set of 01-01-PLAN.md (11 scenarios: `features/plugin/session-start-hooks.feature`, `features/hook/session.feature:7`, `:391`, `:410`, `features/hook/failures.feature:31`, `features/hook/session-end.feature:153`, `:200`, `features/hook/async.feature:470`, `features/plugin/subagent-child.feature:542`, `features/agent/frontmatter.feature:410`) green under adapter and builtin (2 selected); then break E1 under adapter | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | ITDUP-01 | T-01-01, T-01-02, T-01-03 | as above | behavioral | breaks E2 to E5 under adapter on the same set; each log names its expected failed scenario | ✅ | ⬜ pending |
| 01-01-03 | 01 | 1 | ITDUP-01 | T-01-01 | no file under `extensions/` changes | static | `test ! -e test/integration/hooks-spawn-end-to-end.test.ts`, `npm run check:static`, `npx fallow audit --base <plan base>` (only `weakened-tests` on the deleted file) | n/a | ⬜ pending |
| 01-02-01 | 02 | 1 | ITDUP-02 | T-01-06 | the new scenario names no MCP implementation and changes no existing table | behavioral (tracer), both profiles | `features/plugin/subagent-child.feature` and `features/agent/frontmatter.feature` under adapter and builtin; the new scenario alone under builtin (`1 scenario (1 passed)`); `npm run check:static` | ❌ W0, created by this task | ⬜ pending |
| 01-02-02 | 02 | 1 | ITDUP-02 | T-01-04, T-01-05, T-01-06, T-01-08 | as 01-01-01; the new scenario must fail under the identity breaks | behavioral | breaks E6 to E11 under adapter and E7 under builtin on `features/plugin/subagent-child.feature:542`, the new scenario, the concurrent scenario, `features/agent/frontmatter.feature:410`, `:423` | ✅ after 01-02-01 | ⬜ pending |
| 01-02-03 | 02 | 1 | ITDUP-02 | T-01-04, T-01-07 | docs cite scenarios that show their claims; no file under `extensions/` changes | static | the docs greps of 01-02-PLAN.md, `SKIP=npm-check pre-commit run --files docs/mcp-compatibility.md docs/hooks-compatibility.md`, `test ! -e test/integration/pi-subagents-child-identity.test.ts`, `npm run check:static`, `npx fallow audit --base <plan base>` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `features/lib/real-subagent-child.ts` — optional `body` column for `parseRealChildAgents` (task 01-02-01)
- [ ] `features/plugin/subagent-child.feature` — the new `@mcp` empty-body child scenario (task 01-02-01)

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
