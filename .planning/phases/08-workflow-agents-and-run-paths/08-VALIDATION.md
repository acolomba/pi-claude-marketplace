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
| 08-01-01 | 01 | 1 | PG-WF-05, PG-WF-04 (spike S5(a)) | T-08-01, T-08-02, T-08-03 | every Pi of the probe has HOME inside the fixture; no probe file is left in the tree | spike record | the row check of the task for a1 to a6 in `08-SPIKE-S5.md`; `test -z "$(git status --porcelain -- extensions features test scripts package.json package-lock.json)"` | ❌ W0: the task creates the record | ⬜ pending |
| 08-01-02 | 01 | 1 | PG-WF-04, PG-WF-05 (spike S5(b), verdicts) | T-08-01, T-08-02 | control run with no engine settings file | spike record, PRD cell | the row check of the task for b1 to b5; six verdict lines; `pre-commit run --files` on the record and `docs/prd/parity-gaps-prd.md` | ❌ W0: created by 08-01-01 | ⬜ pending |
| 08-02-01 | 02 | 2 | PG-WF-02 (b) | T-08-04, T-08-05, T-08-06, T-08-07, T-08-08 | `forMessage` on each span; five notes and a count line for one script; an overlong agent type is not printed | unit (TDD), scenario, integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/discover-names.test.ts` and the caller tests; `npm run test:coverage:direct --` the four sources; `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-types.feature features/workflow/agent-restrictions.feature`; `npm run check:static` | ✅ owner test; ❌ W0: the task creates the feature file | ⬜ pending |
| 08-02-02 | 02 | 2 | PG-WF-02 (a), (b), (c) | T-08-05, T-08-06 | no note for a name outside the plugin's namespace; the limit is pinned | scenario (three with a mutation, one that pins the engine), docs | `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-types.feature`; `git diff --quiet HEAD -- extensions test` | ✅ after 08-02-01 | ⬜ pending |
| 08-02-03 | 02 | 2 | PG-WF-02 (c), catalog | — | — | catalog gate | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test "test/architecture/catalog-uat/*.test.ts"` | ✅ | ⬜ pending |
| 08-03-01 | 03 | 2 | PG-WF-07 (worktree) | T-08-09, T-08-10, T-08-11 | git only through `runGit`, in the sandbox project | scenario (guard with a mutation), static | `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-steps.feature`; `npm run check:static` | ❌ W0: the task creates the step module | ⬜ pending |
| 08-03-02 | 03 | 2 | PG-WF-07 (object `args`, sibling call) | T-08-10 | — | scenario (two guards with a mutation each) | `npm run test:cucumber:profile -- --profile adapter features/workflow/run.feature features/workflow/references.feature`; `npm run check:features` | ✅ | ⬜ pending |
| 08-03-03 | 03 | 2 | PG-WF-07 (schema, one `meta.name`) | T-08-10 | a failed install writes nothing | scenario (two guards with a mutation each) | `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-steps.feature features/workflow/collisions.feature`; `npm run check:features` | ✅ | ⬜ pending |
| 08-04-01 | 04 | 3 | PG-WF-04 | T-08-12, T-08-13, T-08-14, T-08-15 | the cost of the adapter setting is stated; no advice to list this extension | docs, cited scenarios | `pre-commit run --files docs/workflows-compatibility.md`; `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-steps.feature features/workflow/run.feature` | ✅ | ⬜ pending |
| 08-04-02 | 04 | 3 | PG-WF-04 (D-PG8-10) | T-08-15 | — | docs | `pre-commit run --files docs/workflows-compatibility.md`; the greps of the task | ✅ | ⬜ pending |
| 08-05-01 | 05 | 4 | PG-WF-05 | T-08-16 | a human decides; no mode selects an option | manual (`checkpoint:decision`) | none; see "Manual-Only Verifications" | — | ⬜ pending |
| 08-05-02 | 05 | 4 | PG-WF-05 (option A only) | T-08-16, T-08-17 | the grant stays dropped | scenario (guard with a mutation), docs | `node scripts/install-test-peers.mjs && npx cucumber-js --profile adapter --name 'An agent that grants Workflow gets no workflow tool'`; `npm run check:features` | ✅ | ⬜ pending |
| 08-06-01 | 06 | 5 | PG-WF-05 (option B only) | T-08-18, T-08-19, T-08-20, T-08-22 | the grant maps only with a staged workflow; a deny wins; the name in parentheses is not written | unit (TDD), scenario under both profiles, integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test "test/bridges/agents/*.test.ts" test/orchestrators/mcp/agent-grants-step.test.ts`; `npm run test:coverage:direct --` convert.ts and grant-forms.ts; the four conformance tests; `npm run check:static` | ✅ | ⬜ pending |
| 08-06-02 | 06 | 5 | PG-WF-05 (option B only, live run) | T-08-23 | the fixture is under the OS temp folder and its processes are killed | scenario with a real child, integration | `node scripts/install-test-peers.mjs && npx cucumber-js --profile adapter --name 'A real background child of an agent that grants Workflow'`; `test/integration/pi-subagents-child-identity.test.ts` | ✅ harness exists | ⬜ pending |
| 08-06-03 | 06 | 5 | PG-WF-05 (option B only, docs) | T-08-18, T-08-20, T-08-21 | the cost for an agent with a narrow tool list is stated | docs, cited scenarios | `pre-commit run --files docs/mcp-compatibility.md README.md README.es.md`; `npx cucumber-js --profile adapter --name 'workflow tool'` | ✅ | ⬜ pending |

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
