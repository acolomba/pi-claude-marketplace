---
phase: "7"
slug: "agent-frontmatter-and-grants"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
audited: "2026-11-14"
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
| 07-01-01 | 01 | 1 | PG-AGENT-05 (enabler) | — | skills bytes unchanged | unit + scenario | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/shared/frontmatter-repair.test.ts "test/bridges/skills/*.test.ts"`; `features/skill/frontmatter.feature` | ✅ | ✅ green |
| 07-01-02 | 01 | 1 | PG-AGENT-05 (enabler) | — | trigger gates repair | unit (TDD) | `test/shared/frontmatter-repair.test.ts:350` (always-true trigger rows), `:389` (`colonRepairTrigger`) | ✅ | ✅ green |
| 07-02-01 | 02 | 2 | PG-AGENT-05 | T-07-03, T-07-05, T-07-07 | `__proto__` key, line-break key | unit + scenario | `test/bridges/agents/frontmatter.test.ts:12` (`readAgentFrontmatter`); `features/agent/frontmatter.feature:613` "Quoted frontmatter values are listed without their quote marks"; `features/agent/frontmatter.feature:642` "A comment after a frontmatter value is not part of the value" | ✅ | ✅ green |
| 07-02-02 | 02 | 2 | PG-AGENT-05 | T-07-04, T-07-06, T-07-08 | one path-free note | unit + scenario | `test/bridges/agents/discover.test.ts:757,823,851,873,893`; `features/agent/frontmatter.feature:693` "Installing an agent whose frontmatter cannot be parsed reports the agent"; `features/agent/frontmatter.feature:718` (listed under file name) | ✅ | ✅ green |
| 07-02-03 | 02 | 2 | PG-AGENT-05 (docs) | — | — | catalog gate | `node --import ... --test "test/architecture/catalog-uat/*.test.ts"` | ✅ | ✅ green |
| 07-03-01 | 03 | 3 | PG-AGENT-05 | — | block cannot become a key | scenario + integration | `features/agent/frontmatter.feature:776` "A description block keeps its lines"; `test/integration/provenance-invisibility.test.ts` (D-PG7-06 hostile block) | ✅ | ✅ green |
| 07-03-02 | 03 | 3 | PG-AGENT-05 (rename) | — | old file removed | scenario (guard) | `features/agent/frontmatter.feature:837` update rename; `features/agent/frontmatter.feature:958` reinstall rename | ✅ | ✅ green |
| 07-03-03 | 03 | 3 | docs | — | — | doc cites scenario titles | manual cite check; titles exist in `features/agent/frontmatter.feature` | ✅ | ✅ green |
| 07-04-01 | 04 | 4 | PG-AGENT-03 | T-07-13 | type list not applied | unit + scenario + integration | `test/bridges/agents/convert.test.ts:2730` (D-PG7-08); `features/agent/frontmatter.feature:1069` outline (Agent, Agent(demo:helper), Task, Task(a, b)); `features/agent/frontmatter.feature:1103` deny; `features/agent/invocation.feature:305` "A child of an agent that grants Agent starts a second agent and gets its reply"; `test/integration/pi-subagents-child-launch-conformance.test.ts:326` | ✅ | ✅ green |
| 07-04-02 | 04 | 4 | PG-AGENT-07a | T-07-14 | only literal `inherit` written | unit + scenario + integration | `test/bridges/agents/convert.test.ts:729,762` (D-PG7-11); `features/agent/frontmatter.feature:1171`, `features/agent/frontmatter.feature:1198`; `test/integration/pi-subagents-child-launch-conformance.test.ts:385` (INHERIT_MODEL sentinel) | ✅ | ✅ green |
| 07-04-03 | 04 | 4 | docs | — | — | doc cites scenario titles | titles exist | ✅ | ✅ green |
| 07-05-01 | 05 | 5 | PG-AGENT-03 | — | key refused beside tools list | unit + type proof + scenario | `test/bridges/agents/convert.test.ts:2881` (D-PG7-09); `test/bridges/agents/frontmatter.test.ts:639,691,795` (`@ts-expect-error`); `features/agent/invocation.feature:340` "A child of an agent without a tools list starts a second agent and gets its reply"; `features/agent/invocation.feature:246` | ✅ | ✅ green |
| 07-05-02 | 05 | 5 | PG-AGENT-03 | — | deny writes `excludeTools: subagent` | scenario + integration | `features/agent/frontmatter.feature:1137`; `features/agent/invocation.feature:375` "A child of an agent that disallows Agent cannot start a second agent"; `test/integration/pi-subagents-child-launch-conformance.test.ts:342,366` | ✅ | ✅ green |
| 07-05-03 | 05 | 5 | docs | — | — | doc cites scenario titles | titles exist | ✅ | ✅ green |
| 07-06-01 | 06 | 6 | PG-AGENT-09 | T-07-18 | exclude name = registered name | unit + scenario (both profiles) | `test/bridges/agents/convert.test.ts:2185-2277,3390`; `test/bridges/agents/frontmatter.test.ts:745`; `test/bridges/agents/grant-forms.test.ts:173`; `features/mcp-server/agent-grants.feature:43` (adapter), `features/mcp-server/agent-grants.feature:95` (builtin), staged `warnings:` has no cannot-narrow line | ✅ | ✅ green |
| 07-06-02 | 06 | 6 | PG-AGENT-09 | T-07-19 | 0.62.0 warning gone | unit + scenario | `test/bridges/agents/convert.test.ts:2965` (D-PG7-13); `features/agent/frontmatter.feature:588` "Apply reports no staging warning for an agent that disallows a tool without a tools list" | ✅ | ✅ green |
| 07-06-03 | 06 | 6 | PG-AGENT-09 | T-07-18 | — | integration | `test/integration/pi-subagents-child-launch-conformance.test.ts:222`; `test/integration/agents-builtin-grant-conformance.test.ts:212` | ✅ | ✅ green |
| 07-06-04 | 06 | 6 | docs | T-07-20 | — | doc cites titles/paths | titles and paths exist | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `extensions/pi-claude-marketplace/shared/frontmatter-repair.ts` and `test/shared/frontmatter-repair.test.ts`, with the moved skills cases.
- [x] Multi-line description support in `features/lib/upstream/subagents.ts` (`projectDetail`).
- [x] `subagent` in `AGENT_NAMEABLE_TOOLS` (`features/step_definitions/agent/runs.steps.ts`) if the offered-tools step is used as proof.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Wave Gates

| Wave | Commit | Node | Command | Exit | Adapter scenarios | Builtin scenarios | Notes |
|------|--------|------|---------|------|-------------------|-------------------|-------|
| baseline | 7584d581 | v26.13.1 | `npm run check` | 0 | 1926 passed | 184 passed | before execution; `/tmp/pg7-wave0.log` |
| 1 (07-01) | 856ab595 | v26.13.1 | `npm run check` | 0 | 1926 passed | 184 passed | 363 direct-coverage records; `/tmp/pg7-wave1.log` |
| 2 (07-02) | f31f7361 | v26.13.1 | `npm run check` | 0 | 1930 passed | 184 passed | 363 records; `/tmp/pg7-wave2.log` |
| 3 (07-03) | 8e188faf | v26.13.1 | `npm run check` | 0 | 1933 passed | 184 passed | 363 records; `/tmp/pg7-wave3.log` |
| 4 (07-04) | 21ae6201 | v26.13.1 | `npm run check` | 0 | 1941 passed | 184 passed | 363 records; `/tmp/pg7-wave4.log` |
| 5 (07-05) | 61f504e1 | v26.13.1 | `npm run check` | 0 | 1944 passed | 184 passed | 363 records; `/tmp/pg7-wave5.log` |
| 6 (07-06) | b9921dda | v26.13.1 | `npm run check` | 0 | 1946 passed | 185 passed | 363 records; `/tmp/pg7-wave6.log` |

---

## Requirement Coverage (Nyquist audit 2026-11-14)

| Requirement | Success criterion | Automated proof | Verdict |
|-------------|-------------------|-----------------|---------|
| PG-AGENT-05 | SC1 quoted values, `name: "x"` → `demo:x`, colon description + `model: "sonnet"` | `features/agent/frontmatter.feature:613` | COVERED |
| PG-AGENT-05 | SC2 comment not a value; `description: \|` keeps lines | `features/agent/frontmatter.feature:642`, `features/agent/frontmatter.feature:776`, `test/bridges/agents/frontmatter.test.ts:12` | COVERED |
| PG-AGENT-05 | unparseable agent / rename at next update or reinstall | `features/agent/frontmatter.feature:693,718,837,958`; `test/bridges/agents/discover.test.ts:823-893` | COVERED |
| PG-AGENT-03 | SC3 Agent/Task with and without type list; no tools field; deny; scripted nested call | `features/agent/frontmatter.feature:1069` (4 examples), `features/agent/frontmatter.feature:1103,1137`; `features/agent/invocation.feature:305,340,375`; `test/integration/pi-subagents-child-launch-conformance.test.ts:326,342,366` | COVERED |
| PG-AGENT-07a | SC4 `model inherit` with and without `--map-model` | `features/agent/frontmatter.feature:1171,1198`; `test/integration/pi-subagents-child-launch-conformance.test.ts:385`; `convert.test.ts:729,762` | COVERED (WARNING: no scenario runs a child under a changed `subagents.defaultModel`; the run-time proof is the sentinel conformance against pi-subagents' `INHERIT_MODEL`) |
| PG-AGENT-09 | SC5 list shows tools and excluded tools; neither stale warning | `features/mcp-server/agent-grants.feature:43,95` (staged `warnings:` lacks cannot-narrow), `features/agent/frontmatter.feature:588` (no 0.62.0 warning); `test/integration/pi-subagents-child-launch-conformance.test.ts:222`; `agents-builtin-grant-conformance.test.ts:212` | COVERED |

Gaps found: 0. Tests added by the audit: none. Audit re-ran the owner tests: `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/shared/frontmatter-repair.test.ts test/bridges/agents/{frontmatter,convert,discover,grant-forms}.test.ts` → 391 pass, 0 fail. Scenarios and integration cases were not re-run by the audit; their green evidence is the wave gates above and the SUMMARY runs below.

## Red/Green and Mutation Evidence (from SUMMARYs)

- **07-01-02:** RED, new owner cases failed at load (`does not provide an export named 'colonRepairTrigger'`); GREEN 251/251.
- **07-02-01:** RED on 856ab595, 2 new scenarios failed (`demo:"x"`, quoted description, missing model); GREEN after change.
- **07-02-02:** RED, install showed no diagnostic; listing scenario is a guard (green before and after).
- **07-03-01:** RED on f31f7361, description flattened to one line. Mutation: removing the two-space block indent failed the integration case (`description` came back `''`).
- **07-03-02:** guard scenarios; mutation of both branches of `partitionPreviousEntries` (`bridges/agents/stage.ts`) failed both rename scenarios (old `pi-claude-marketplace-demo-"x".md` kept).
- **07-04-01:** RED on 8e188faf, 6 of 34 failed (lead not offered `subagent`, no helper call); denial scenario is a guard.
- **07-04-02:** RED, 3 of 26 failed (no `model` line; no `; model inherit` in `--map-model` row).
- **07-05-01:** RED on 21ae6201, 2 of 11 failed (child not offered `subagent`). Type mutation: removing the key under `@ts-expect-error` gave TS2578.
- **07-05-02:** mutation `allowNestedSubagent` typo → conformance `fanoutChild: false`; mutation skipping `subagent` disallow tokens in convert.ts → both deny scenarios failed.
- **07-06-01:** RED under both profiles (list had no excluded tool).
- **07-06-02:** RED, extra `excludeTools requires pi-subagents >= 0.62.0` staging warning.
- **07-06-03:** mutation writing raw tool name as `excludeName` → 2 of 14 conformance cases failed under both implementations.

Open flagged assumption (not a coverage gap): D-PG7-04 (unparseable agent loads with every tool plus a note) vs. the fail-closed-on-corrupt-data preference awaits maintainer review.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (phase-gate sign-off left to the maintainer)
