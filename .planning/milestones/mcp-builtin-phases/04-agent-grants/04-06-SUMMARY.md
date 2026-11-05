---
phase: 04-agent-grants
plan: "06"
subsystem: agents-bridge
status: complete
tags: [gate, parent-lines, agents, pi-subagents, mcp, builtin-mcp, cucumber]

requires:
  - phase: 04-agent-grants
    provides: "04-01..04-05: grant forms, child gate, per-form staging, load rewrite, call sites and scenarios"
provides:
  - "The Phase 4 gate record on one combined-tree input set (8e801f4 = 8c95f25 for build inputs), with seeds and counts"
  - "The boundary proof against PHASE_BASE f5069e0: no frozen, closed-set, catalog, or sibling-owned file changed"
  - "Eleven parent lines for files Phase 4 may not edit, each with its timing"
  - "Every Phase 4 dubious choice, for the session to log"
affects: [Phase 3 verdict-markers.feature, Phase 2 docs/mcp-compatibility.md, Phase 6 docs and .fallowrc.json, parent merge of Phase 4]

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/04-agent-grants/04-06-SUMMARY.md
  modified: []

key-decisions:
  - "Gate evidence from the orchestrator's run on 8e801f4 reused under local-verification gates.md: git diff 8e801f4 -- . ':(exclude,glob).planning/**/*.md' is empty at 8c95f25; test:modules was run here, on 8c95f25"
  - "No combined-tree fix was needed; the only builtin failure is the recorded P4-DC-23 row of Phase 3's verdict-markers.feature"

requirements-completed: [MGRT-01, MGRT-02]

duration: 10min
completed: 2026-11-04

estimate:
  tokens: 80000
  tasks: 2
actuals:
  tokens: 9000
  tasks: 2
  commits: 1
plan_head_before: 8c95f25701e120fb9a10c4bf7d7d14b5ed44bc2c
plan_head_after: see the commit that adds this file (the SUMMARY commit is the plan's only commit)
---

# Phase 4 Plan 06: Phase Gate and Parent Lines Summary

**The combined Phase 4 tree passes every local gate under both cucumber profiles and the whole unit suite. The one builtin failure is the recorded cross-phase row of Phase 3's `verdict-markers.feature`. No file outside Phase 4's ownership changed. Eleven parent lines hand the parent every change Phase 4 needs in files it may not edit.**

## Performance

- **Started:** 2026-11-04T15:33Z
- **Completed:** 2026-11-04T15:44Z
- **Tasks:** 2
- **Files modified:** 1 (this SUMMARY)

## Gate results

Node `v24.22.1`. Container runs as root, so every npm script ran through the `nondac-sh` wrapper (`npm_config_script_shell=.../scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`).

**Input set.** The orchestrator ran the gate on `8e801f4` (the merge of 04-05) with `scratchpad/gate.sh wave3`. The later commits up to `8c95f25` touch only `.planning/ROADMAP.md`, `.planning/STATE.md`, and the phase `DUBIOUS-CHOICES.md`. `git diff 8e801f4 -- . ':(exclude,glob).planning/**/*.md'` prints nothing at `8c95f25`, and the tree has no untracked files. By the reuse rule in `.agents/skills/local-verification/rules/gates.md`, the `8e801f4` results stand for `8c95f25`. This plan ran the one command that run left out, `npm run test:modules`, on `8c95f25`.

| Command | Commit | Exit | Wall time | Counts | Seed |
| ------- | ------ | ---- | --------- | ------ | ---- |
| `npm run lint` (warm-up) | 8e801f4 | 0 | 18 s | -- | -- |
| `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features) | 8e801f4 | 0 | 13 s | all 7 passed | -- |
| `npm run test:unpaired` | 8e801f4 | 0 | 23 s | -- | -- |
| `npm run test:integration` (peers: pi-subagents 0.84.0 from the optional-peers cache) | 8e801f4 | 0 | 35 s | -- | -- |
| `npx cucumber-js --profile adapter` (the whole adapter profile: the lifecycle leg and the components leg in one run) | 8e801f4 | 0 | 414 s (cucumber 6m 51.3s) | 1567 scenarios (1567 passed), 16945 steps (16945 passed) | 324047 |
| `npx cucumber-js --profile builtin --name '^(?!Update preserves dependency move warnings and MCP notices, under Pi.s built-in MCP$)'` over `features` | 8e801f4 | 0 | 45 s (cucumber 41.7 s) | 43 scenarios (43 passed), 584 steps (584 passed) | 234219 |
| `npx cucumber-js --profile builtin features/mcp-server/verdict-markers.feature --name '^Update preserves dependency move warnings and MCP notices, under Pi.s built-in MCP$'` (the excluded row, alone) | 8e801f4 | 1 (expected) | 11 s (cucumber 7.8 s) | 1 scenario (1 failed), 18 steps (16 passed, 1 skipped, 1 failed) | 77644 |
| `npm run test:coverage:direct:all` | 8e801f4 | 0 | 199 s | merged LCOV `coverage/direct.lcov`, 340 records, every pair 100% | -- |
| `npm run test:modules` (whole unit suite) | 8c95f25 | 0 | 191 s | -- | -- |

The quiet reporter prints no unit-test counts on a pass. The stderr lines `Legacy marketplace migration could not be persisted ...` in the coverage and modules logs are the sanctioned IL-3 `console.warn` from tests that remove the target directory. They are not failures.

**The tolerated builtin failure (P4-DC-23).** The excluded scenario, at `features/mcp-server/verdict-markers.feature:604`, fails only at the `lines` cell of its `diagnostic` row in `Then the command reports these results:`:

```text
- ... where Claude Code runs it in the foreground; a launch before pi-mcp-adapter has cached the server's tools still fails, [helper] dropped fields: color
+ ... where Claude Code runs it in the foreground; a launch before Pi's built-in MCP has listed the server's tools still fails, [helper] dropped fields: color
```

(`-` expected, `+` actual.) Every other cell matches. The run that excludes exactly this scenario name exits 0. Parent line 1 fixes the row.

**Boundary proof** (`PHASE_BASE=f5069e0`, "docs: plan the agent grants work in six plans"):

- `git diff --stat "$PHASE_BASE" -- package.json package-lock.json cucumber.json .fallowrc.json eslint.config.js rule-packs scripts features/support .github extensions/pi-claude-marketplace/index.ts .../platform/pi-api.ts .../domain/mcp-implementation.ts .../persistence/state-io.ts .../orchestrators/mcp/session-materialize.ts .../orchestrators/mcp/recorded-servers.ts .../edge .../shared/notification-types.ts .../shared/notification-wire.ts .../shared/notify-reasons.ts docs/output-catalog.md docs/json-output.md test/architecture/catalog-uat features/mcp-server/verdict-markers.feature` prints nothing.
- `git diff --name-only "$PHASE_BASE" -- extensions test features` lists 38 files, each one Phase 4 owns or one CONTEXT names:
  - `bridges/agents/{convert,frontmatter,grant-forms,grant-rewrite,index,legacy-grant-form,mcp-async-warning,stage,types}.ts`.
  - `orchestrators/mcp/agent-grants-step.ts` and `orchestrators/plugin/{install-outcome,update-swap}.ts`.
  - `orchestrators/reconcile/load.ts`, the unowned file CONTEXT names.
  - `persistence/agents-index-schema.ts` and `platform/subagent-child.ts`.
  - `features/lib/mcp-agent-earlier-index.ts`, `features/lib/upstream/subagents.ts` (unowned, named), `features/mcp-server/agent-grants.feature`, and `features/step_definitions/mcp-server/agent-grants.steps.ts`.
  - Their test pairs under `test/{bridges/agents,orchestrators/{mcp,plugin,reconcile},persistence,platform}/`, `test/integration/agents-builtin-grant-conformance.test.ts`, and `test/bridges/agents/agent-grant-seeds.ts` (P4-DC-59).
- The whole-tree diff outside `.planning/` lists the same 38 files. No other path changed.
- `git diff --stat "$PHASE_BASE" -- .planning/DUBIOUS-CHOICES.md` prints nothing. `.planning/phases/04-agent-grants/DUBIOUS-CHOICES.md` shows 33 added lines since the base. The session's own log commits added them (`ccda5f4`, `cdd49ef`). This plan does not touch the file.

## Accomplishments

- Verified the combined Phase 4 tree on one input set: static checks, unpaired, integration, the whole adapter profile, the builtin profile minus one named row, direct coverage, and the whole unit suite.
- Proved the ownership boundary against the phase base.
- Wrote the eleven parent lines below, with timing.
- Collected every Phase 4 dubious choice for the session.

## Task Commits

1. **Task 1: Run the full gate on the combined Phase 4 tree.** No commit: no fix was needed, and the results are recorded here.
2. **Task 2: Write the parent lines and the phase's dubious choices.** The commit that adds this file.

## Parent lines

Each line names the file, the exact change, and when the parent applies it.

1. **`features/mcp-server/verdict-markers.feature` (Phase 3's).** In the `@builtin-only` scenario "Update preserves dependency move warnings and MCP notices, under Pi's built-in MCP" (line 604), in the `lines` cell of the `diagnostic` row, replace `a launch before pi-mcp-adapter has cached the server's tools still fails` with `a launch before Pi's built-in MCP has listed the server's tools still fails`. Change nothing else in the row. **When:** in the Phase 4 merge commit on the milestone branch, or the post-merge builtin gate fails. Phase 3 keeps the new text when it merges the milestone branch into its own branch (P4-DC-04, P4-DC-23).
2. **`extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts` (Phase 4's function `updateAgentImplementation`).** Repoint it at Phase 3's implementation field on `ThreePhaseArgs`. Read that field first, then the direct run, then `preflightNotification.run`, then `none`. Then autoupdate and `apply` convergence stage the active form at once, and the adapter form no longer stays under built-in until the next session. **When:** after Phase 3 merges, in the first commit that has both phases' code. Add a `@builtin-only` cucumber scenario for an autoupdate or apply-convergence update that pins the built-in grant before a reload (P4-DC-13, P4-DC-46, P4-DC-60).
3. **`.planning/phases/01-foundation-and-pi-1-5-0/01-FROZEN.md`, interface 5 (session step contracts).** Record the signature `agentGrantsStep(input: AgentGrantsStepInput, env: SubagentChildEnv = process.env): Promise<void>`. It takes an optional second parameter with a `process.env` default, and it stays assignable to the materializer's one-argument step type `(input: AgentGrantsStepInput) => Promise<void>` (P4-DC-14). Also record that the unowned `createLoadReconcile(reader, applyReconcile, env: SubagentChildEnv = process.env)` takes an optional third `env` parameter. The frozen `index.ts` call does not change (P4-DC-08). `SubagentChildEnv` is `Readonly<Record<string, string | undefined>>` from `platform/subagent-child.ts`. **When:** at the Phase 4 merge.
4. **`docs/mcp-compatibility.md` (Phase 2's), agents text.** Drafted in the file's style. **When:** with Phase 2's built-in docs, after Phase 2 and Phase 4 are both on the milestone branch. Phase 6 folds them in if Phase 2 has already merged.
   - Line 27, after "pi-subagents `mcp:` entries also use the key.", add: "Under Pi's built-in MCP, they use the built-in server name instead, `plugin_<plugin>_<server>`, with no `_` at the end."
   - The line-275 bullet ("A `tools:` entry that names one of the plugin's own MCP tools ..."), after the whole-server sentence, add: "Under Pi's built-in MCP, these entries are `mcp:plugin_<plugin>_<server>/<tool>` and `mcp:plugin_<plugin>_<server>`. The grant names the server of the MCP implementation that is active when the agent is written. A per-tool `disallowedTools` entry of an agent without `tools:` becomes, in `excludeTools`, the tool name that Pi's built-in MCP gives the tool: `mcp__plugin_<plugin>_<server>__<tool>` with each character other than a letter, a digit, or `_` replaced by `_`. Pi shortens a name longer than 64 characters and adds a hash. Under pi-mcp-adapter the entry keeps the Claude Code name. A grant of a server that Pi's built-in MCP cannot run, such as an `sse` server, is dropped with a warning under built-in and kept under pi-mcp-adapter."
   - The line-277 paragraph (async), after "also after pi-mcp-adapter has cached the server's tools.", add: "Under Pi's built-in MCP the install warning ends `a launch before Pi's built-in MCP has listed the server's tools still fails`. pi-subagents 0.84.0 refuses a foreground launch of such an agent because an extension registered the server. For the stub server of `demo`, it returns: `Agent 'demo:runner' selects MCP tools from servers that extensions registered (plugin_demo_stub). Only background children (async: true) load those extensions; run the agent in the background or add the server to the global mcp.json or a trusted project's .pi/mcp.json.`" Change both citations of `features/mcp-server/invocation.feature` in this section (line 275 bullet 1 and line 277) to `features/mcp-server/agent-grants.feature`, the file Phase 1 renamed.
   - The line-283 paragraph ("In Claude Code, a subagent ..."), change its last sentence to: "A launch before pi-mcp-adapter has cached the server's tools, or before Pi's built-in MCP has listed them, fails too."
   - The override example: add a second line after the JSON block: "Under Pi's built-in MCP, write `mcp:plugin_foo_github` instead." In the paragraph after it, add: "Under Pi's built-in MCP, an `mcp:<name>` entry grants the tools of the built-in server `<name>`, such as `plugin_foo_github`."
   - A new paragraph at the end of "Customizing generated agents": "When you switch between pi-mcp-adapter and Pi's built-in MCP, the next start or `/reload` rewrites each generated agent file whose MCP grant differs for the new implementation. It rewrites only those files, one at a time, and reports nothing (D-MB-03, MGRT-01). With no MCP implementation active, the files stay as they are. A file that you edited stays as it is. An agent that an earlier release installed is translated to the built-in form at the first built-in session, with two known gaps: an agent with a per-tool `disallowedTools` name longer than 64 characters stays in the pi-mcp-adapter form, and the grant of a server that Pi's built-in MCP cannot run is translated, not dropped, so the launch still fails. Run `/claude:plugin reinstall` for such a plugin to write the exact form. A pi-subagents background child that loads this extension changes nothing: it rewrites no agent file, runs no autoapply, and moves no MCP server (MGRT-02)."
5. **`CHANGELOG.md`.** Two reader-facing lines for the milestone's entry. **When:** Phase 6 folds them into the milestone bullet.
   - MGRT-01: "A generated agent's MCP grant now names the server in the form of the active MCP implementation, pi-mcp-adapter or Pi's built-in MCP. After you switch, the next start or `/reload` rewrites only the agent files whose grant changed."
   - MGRT-02: "A pi-subagents background child that loads the extension no longer changes any installation state. It runs no autoapply, moves no MCP server, and rewrites no agent file."
6. **`README.md` and `README.es.md`.** The Features list says only "Agents. Requires pi-subagents." The MCP naming text at line 126 describes the adapter key, and Phase 2 or Phase 6 owns its built-in update. The agents text does not need a sentence on grants. If Phase 6 adds the built-in MCP option to the Features list, add after the agents bullet's first sentence: "An agent's MCP grants follow the MCP implementation in use." README.es.md: "Los permisos MCP de un agente siguen la implementación MCP en uso." **When:** Phase 6, with the milestone's README pass, only if the built-in option enters the Features list.
7. **`.planning/PROJECT.md` Key Decisions.** D-MB-03 row: add "Implemented by mcp-builtin Phase 4: the session-start grants step (`orchestrators/mcp/agent-grants-step.ts`, `bridges/agents/grant-rewrite.ts`) swaps a stored frontmatter form, and earlier releases' agents get a textual translation (P4-DC-06)." D-MB-12 row: add "Implemented by Phase 4 with the `PI_SUBAGENT_CHILD=1` marker (`platform/subagent-child.ts`, P4-DC-07). In a child the grants step does nothing, and the load skips autoapply and the AMIG-01 move. The MIG-01 config migration and `loadState`'s legacy migration stay ungated, because they are idempotent and the parent's load runs them first (P4-DC-08)." **When:** at the Phase 4 merge, or by Phase 6.
8. **`.planning/BACKLOG.md`.** Two items from CONTEXT "Deferred Ideas":
   - "Exact legacy translation of agent grants under Pi's built-in MCP: per-tool `excludeTools` names over 64 characters (Pi's hashed name), and grants of servers built-in cannot run (`sse`), which should be dropped with the staging warning (P4-DC-06, P4-DC-30)."
   - "A user-visible load warning when the grants step cannot rewrite an agent (edited file, held lock, corrupt index row). Needs a closed-set reason and catalog states (P4-DC-09, P4-DC-32)."
   **When:** at the Phase 4 merge, or by Phase 6.
9. **`.planning/codebase/ARCHITECTURE.md` and `STACK.md`.** **When:** Phase 6's codebase-map refresh (P4-DC-40).
   - ARCHITECTURE.md, `platform/` layer "Contains": add "`subagent-child.ts` (`isSubagentChild(env)`, reads pi-subagents' `PI_SUBAGENT_CHILD=1`; D-MB-12)".
   - ARCHITECTURE.md, `bridges/` layer "Contains": add "`agents/grant-forms.ts` (renders an agent's adapter and built-in forms), `agents/grant-rewrite.ts` (the session-start swap of a stored frontmatter form), `agents/legacy-grant-form.ts` (the textual adapter-to-built-in translation for rows an earlier release wrote), `agents/mcp-async-warning.ts` (the D-CF6-10 warning per implementation)". Add that an agents-index row may hold `mcpImplementation` plus one stored form per implementation (frontmatter block, warnings, dropped tools), additive with `schemaVersion` 1.
   - ARCHITECTURE.md, "Load-Time Reconcile Flow": add that the session materializer's agent grants step (`orchestrators/mcp/agent-grants-step.ts`) rewrites, under the state lock, the generated agent files whose stored form differs from the active implementation (D-MB-03 amends APL-D1). Add that in a pi-subagents background child `loadReconcile` skips autoapply and the AMIG-01 move, and the grants step does nothing (D-MB-12).
   - STACK.md, `pi-subagents` bullet: add "a background child is detected by the `PI_SUBAGENT_CHILD=1` variable its runner sets (`platform/subagent-child.ts`)".
10. **`.fallowrc.json` (frozen).** In the `ignoreExports` entry for `domain/mcp-implementation.ts`, drop `ActiveMcpImplementation`. Phase 4's `bridges/agents/types.ts` and `orchestrators/plugin/update-swap.ts` import it from that module, so the entry is no longer needed. fallow never reports an `ignoreExports` name as stale. **When:** Phase 6, when it removes the frozen-module entries.
11. **Re-run after Phase 2 merges.** Run `features/mcp-server/agent-grants.feature` under both profiles: `npm run test:cucumber:profile -- --profile adapter features/mcp-server/agent-grants.feature` (12 scenarios today) and `... --profile builtin features/mcp-server/agent-grants.feature` (5 scenarios today). Phase 2's own registration then serves the stub in place of the Phase 1 stand-in, and the `@own-implementation` built-in Pis connect it. **When:** in the post-merge gate of the Phase 2 merge. A failure there is fixed in the step module or the scenario, not by retagging.

## Deviations from Plan

**1. [Rule 3 - Reuse] Gate results reused, not rerun.**
- **Found during:** Task 1.
- **Issue:** The plan asks for every command on one commit. The orchestrator had already run all of them except `test:modules` on `8e801f4`. Since then, only planning Markdown changed.
- **Fix:** I checked the gates.md reuse condition (`git diff 8e801f4 -- . ':(exclude,glob).planning/**/*.md'` empty, no untracked files) and ran `npm run test:modules` on `8c95f25`. The adapter evidence is one run of the whole adapter profile, not the plan's two directory legs. It covers the union of the two legs, and the leg split is for CI time only. The builtin evidence is the name-excluded run plus the excluded scenario alone, not a first full builtin run. Together they cover every builtin scenario.
- **Files modified:** none.

**Total deviations:** 1 (evidence reuse). **Impact:** none on coverage.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-04-20 (push) is transferred as planned: I did not push. T-04-21 is mitigated: the tolerated builtin failure is pinned to one scenario name and one cell, and the run that excludes exactly that name exits 0. T-04-SC is accepted: this plan installed nothing.

## Dubious Choices

### New in this plan

1. **Gate evidence reused from the orchestrator's run**
   - Severity: Low
   - Choice: The SUMMARY records the `8e801f4` gate (adapter seed 324047, builtin seed 234219) as the verdict for `8c95f25`, under the gates.md planning-Markdown reuse rule. Only `test:modules` ran in this plan.
   - Alternatives: Rerun the whole gate on `8c95f25` (about 15 minutes more).
   - Why dubious: The plan says "on one commit". The evidence is two commits whose build inputs are identical, and the adapter legs ran as one profile run.
   - Recorded in: this SUMMARY, Gate results and Deviations.
2. **The phase DUBIOUS-CHOICES.md diff is not empty against the phase base**
   - Severity: Low
   - Choice: The acceptance check `git diff --stat "$PHASE_BASE" -- .planning/phases/04-agent-grants/DUBIOUS-CHOICES.md .planning/DUBIOUS-CHOICES.md` shows 33 lines. The session's own log commits added them. I read the check as "no executor edited the file" and did not edit it.
   - Alternatives: Report the criterion as failed.
   - Why dubious: The criterion as written cannot pass while the session logs each wave.
   - Recorded in: this SUMMARY, Boundary proof.
3. **README needs no grants sentence now**
   - Severity: Low
   - Choice: Parent line 6 drafts a sentence but advises adding it only if the built-in option enters the README Features list.
   - Alternatives: Add the sentence to the agents bullet now.
   - Why dubious: A README reader under built-in MCP learns about grant forms only from docs/mcp-compatibility.md.
   - Recorded in: Parent line 6.
4. **Parent line 2 asks for a new scenario after Phase 3 merges**
   - Severity: Medium
   - Choice: The repoint of `updateAgentImplementation` comes with a `@builtin-only` scenario for an autoupdate or apply-convergence update, because the behavior a user sees changes then.
   - Alternatives: Unit cases only. Or leave the repoint unproven until Phase 6.
   - Why dubious: It adds post-merge work that no plan schedules.
   - Recorded in: Parent line 2.
5. **Claude-Session trailer value**
   - Severity: Low
   - Choice: The commit ends with `Claude-Session: https://claude.ai/code/session_01EDUMG7S9uXh4o5dikBwum8`, as the child brief and the plan require. That is P4-DC-48, carried.
   - Alternatives: The harness reminder names `session_01EDUMG87PKcySw33ikhvFmE`.
   - Why dubious: The two sources disagree.
   - Recorded in: this SUMMARY.

### Reported by the executors of plans 04-01 to 04-05 (already logged by the session)

Each entry has its full title, severity, choice, alternatives, and reason in `.planning/phases/04-agent-grants/DUBIOUS-CHOICES.md` and in the plan SUMMARY named.

| ID | Sev. | Plan | Choice (short) | Why dubious (short) |
| -- | ---- | ---- | -------------- | ------------------- |
| P4-DC-48 | Low | 04-01..05 | Trailer session URL from the child brief | The brief and the harness reminder disagree |
| P4-DC-49 | Low | 04-01 | Conformance test reproduces Pi's `createMcpToolName` with node:crypto | Pi's module is outside its exports map |
| P4-DC-50 | Low | 04-01 | An io test pins TypeBox's error text | Couples to a library message |
| P4-DC-51 | Low | 04-01 | Part of the RED proof is type-level only | No runtime red for some cases |
| P4-DC-52 | Low | 04-02 | Child autoapply red fails at the session-report step | The reader must infer the install |
| P4-DC-53 | Low | 04-03 | Built-in server set keeps declaration order, unpinned | Order cannot change output today |
| P4-DC-54 | Low | 04-03 | A stage without `mcpGrantForms` drops stored forms | The load then leaves that file |
| P4-DC-55 | Low | 04-03, 04-04 | RED for new modules taken by restoring base sources | Some fail at import, not on behavior |
| P4-DC-56 | Low | 04-04 | A legacy row with a non-generated or missing file stays a candidate | One lock and one read per built-in load |
| P4-DC-57 | Low | 04-04 | Warning translation runs on every list line of the block | Could touch a dropped-tool item |
| P4-DC-58 | Low | 04-04 | Swap reads and writes UTF-8 strings | Invalid UTF-8 would become U+FFFD |
| P4-DC-59 | Low | 04-04 | `test/bridges/agents/agent-grant-seeds.ts` outside `files_modified` | Unplanned file |
| P4-DC-60 | High | 04-05 | Autoupdate and apply convergence stage the adapter form until the next load | A wrong grant and warning text for one session under built-in (parent line 2) |
| P4-DC-61 | Medium | 04-05 | The four `@adapter-only` verb scenarios have no red proof | Nothing visible changed under the adapter |
| P4-DC-62 | Medium | 04-05 | The built-in D-CF6-10 twin has no stub-message step | Does not prove that no `tools/call` reached the server |
| P4-DC-63 | Low | 04-05 | The feature description runs ten lines | The skill says two or three |
| P4-DC-64 | Low | 04-05 | No unit red run for the update-swap cases | Red rests on the cucumber runs |

### Discuss, research, plan, and plan-check entries (already logged)

P4-DC-01..12 (discuss), P4-DC-13..21 (research), P4-DC-22..44 (plan), and P4-DC-45..47 (plan check) are in the phase `DUBIOUS-CHOICES.md` with their full text. The ones that parent lines act on: P4-DC-04 and P4-DC-23 (line 1), P4-DC-13, P4-DC-46, and P4-DC-60 (line 2), P4-DC-08 and P4-DC-14 (line 3), P4-DC-06, P4-DC-09, P4-DC-30, and P4-DC-32 (line 8), and P4-DC-40 (line 9).

## Next Phase Readiness

- Phase 4 is ready for the parent to merge after Phase 5 and before Phases 2 and 3, with parent line 1 in the merge commit.
- MGRT-01 and MGRT-02 hold end to end under both profiles. P4-DC-60 is open until parent line 2 lands.

## Self-Check: PASSED

- FOUND: .planning/phases/04-agent-grants/04-06-SUMMARY.md
- FOUND: gate logs in /tmp/claude-0/-home-user-pi-claude-marketplace/f243baba-9933-5a9c-bf6c-1345067f42f7/scratchpad/gate-wave3/ and /tmp/claude-0/-home-user-pi-claude-marketplace/f243baba-9933-5a9c-bf6c-1345067f42f7/scratchpad/04-06/modules.log
- FOUND: 8e801f4 and 8c95f25 are ancestors of HEAD
