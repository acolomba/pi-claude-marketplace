---
phase: "8"
slug: "workflow-agents-and-run-paths"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-14"
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` owner tests; Cucumber scenarios under the `adapter` and `builtin` profiles; integration tests against the companions in `node_modules/.cache/optional-peers` (pi-subagents 0.88.1, engine 3.15.0, pi-mcp-adapter 7.0.1) |
| **Config file** | `cucumber.json`; no runner config for `node:test` |
| **Quick run command** | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <owner test>` and `npx cucumber-js --profile <adapter\|builtin> --name '<scenario>'` |
| **Full suite command** | `npm run check` (wave and phase gates only; never run by an executor task) |
| **Estimated runtime** | owner test under 10 s; one scenario under 60 s; full gate about 15 to 25 min |

---

## Sampling Rate

- **After every task commit:** owner tests and pair coverage (`npm run test:coverage:direct -- <path>`) of the changed files, the owner tests of their callers, the integration tests of the area, and the task's scenarios. The commit hook adds `npm run check:commit`.
- **After every plan wave:** `npm run check` on the combined tree (wave gate; record commit, Node version, exit, scenario counts of both profiles).
- **Before `/gsd-verify-work`:** full suite must be green.
- **Max feedback latency:** 60 seconds for focused checks.

Every check runs in a hermetic home. None reads, lists, stats, or writes the real `~/.pi/agent`.

---

## Per-Task Verification Map

Filled by the planner and executors from `08-RESEARCH.md` "Phase Requirements → Test Map". For a guard scenario (PG-WF-02 (a), PG-WF-07) the "fails" direction is the recorded mutation in the plan SUMMARY.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] The S5 scratch fixture (RESEARCH R1): engine in the main Pi and in `settings.json`, a workflow in the plugin, the scripted `workflow` call with `background: false`, the session-file read, the engine settings at `{agent dir}/workflows/settings.json`. Not committed unless it becomes a committed proof.
- [ ] A `Given` step that makes the session's project a git repository with one commit (RESEARCH R4).
- [ ] A catalog-uat fixture and map entry for the new note's `docs/output-catalog.md` state (RESEARCH R8).
- [ ] Option B of PG-WF-05 only: real-child fixture options and a step text for a plugin with a workflow.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Choice between option A and B for the `Workflow` grant | PG-WF-05 | Product decision: Claude Code gives `Workflow` to no subagent | Maintainer answers the plan's `checkpoint:decision` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
</content>
</invoke>
<invoke name="Bash">
<parameter name="command">cd /home/acolomba/src/pi-claude-marketplace-gaps-agents && F=.planning/phases/08-workflow-agents-and-run-paths/08-VALIDATION.md; SKIP=npm-check pre-commit run --files $F 2>&1 | grep -iv "skipped\|passed"; git add $F && git commit -F - -- $F <<'EOF' 2>&1 | tail -1
docs(workflows): seed the workflow agents validation strategy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EDUMG5CwcEqHMTBJM72kiL
EOF
S=/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-gaps/46275468-1855-49b4-a234-f937cd40117e/scratchpad/planpre.json; node -e 'const o=require(process.argv[1]); for (const c of ["pattern-mapper"]) console.log(o.activeHooks.find(h=>h.capId===c).fragment.inline); for (const h of o.activeHooks.filter(h=>h.kind==="contribution"&&h.into==="planner")) {console.log("=====",h.capId, JSON.stringify(h.configValues||{})); console.log(h.fragment.inline)}' $S
