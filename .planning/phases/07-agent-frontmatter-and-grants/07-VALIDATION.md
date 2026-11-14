---
phase: "7"
slug: "agent-frontmatter-and-grants"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-14"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` owner tests; Cucumber scenarios under the `adapter` and `builtin` profiles; integration tests against installed pi-subagents 0.88.1 |
| **Config file** | `cucumber.json`; no runner config for `node:test` |
| **Quick run command** | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <owner test>` and `npx cucumber-js --profile <adapter\|builtin> --name '<scenario>'` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | owner test under 10 s; one scenario under 60 s; full gate about 15 to 25 min on this machine |

---

## Sampling Rate

- **After every task commit:** owner tests and pair coverage (`npm run test:coverage:direct -- <path>`) of the changed files, plus the task's scenarios. The commit hook adds `npm run check:commit`.
- **After every plan wave:** `npm run check` on the worktree tree (wave gate; record commit, Node version, exit, scenario counts).
- **Before `/gsd-verify-work`:** full suite must be green.
- **Max feedback latency:** 60 seconds for focused checks.

---

## Per-Task Verification Map

Filled by the planner and executors from `07-RESEARCH.md` "Phase Requirements → Test Map". Task rows are added per plan.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `extensions/pi-claude-marketplace/shared/frontmatter-repair.ts` and `test/shared/frontmatter-repair.test.ts`, with the moved skills cases.
- [ ] Multi-line description support in `features/lib/upstream/subagents.ts` (`projectDetail`).
- [ ] `subagent` in `AGENT_NAMEABLE_TOOLS` (`features/step_definitions/agent/runs.steps.ts`) if the offered-tools step is used as proof.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Wave Gates

| Wave | Commit | Node | Command | Exit | Adapter scenarios | Builtin scenarios | Notes |
|------|--------|------|---------|------|-------------------|-------------------|-------|

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
