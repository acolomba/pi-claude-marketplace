---
phase: 01-harness-and-version-raise
plan: 07
subsystem: testing
tags: [cucumber, pi-subagents, agents, project-trust, scripted-model, faux-provider]

requires:
  - phase: 01-harness-and-version-raise
    provides: "The profile Pi with trust.json and an untrusted mode, the scripted model with its call log and system prompt record, the companions Given, the prompt When, and the model-calls Then (plan 01-03)"
provides:
  - "features/lib/agent-files.ts: the agent file writer for published plugins (D-CF1-08)"
  - "features/step_definitions/agent/runs.steps.ts: the published-plugin agent Given"
  - "A numbered-call system-prompt Then in model.steps.ts, and a {uuid} projection in both model-call Thens"
  - "The pi settings Given and the untrusted-profile Given in companion.steps.ts (HAR-06, D-CF1-07)"
  - "features/agent/invocation.feature: a foreground subagent run whose child system prompt is compared whole (HAR-07)"
  - "features/agent/project-trust.feature: the trusted and untrusted pair (HAR-06)"
affects: [01-09, agents, mcp-servers, workflows]

actuals:
  tokens: 4685     # chars/4 over the added diff lines (18,741 chars)
  tasks: 2
  commits: 2       # MEASURED: git rev-list --count c5a8396..HEAD
plan_head_before: c5a8396c78f5d9c5f11097f31b1b5c02da0f63ef
plan_head_after: 7f09f42be501045ff3a0d450836f378a734b7a60

tech-stack:
  added: []
  patterns:
    - "A model-call text reads each UUID as {uuid}, so a per-run id such as pi-subagents' mission id has a stable form"
    - "A trust scenario writes <project>/.pi/settings.json before the profile Pi starts, so only the trust.json entry differs"
    - "A step timeout above the default is a named constant beside the step that needs it"

key-files:
  created:
    - features/lib/agent-files.ts
    - features/step_definitions/agent/runs.steps.ts
    - features/agent/invocation.feature
    - features/agent/project-trust.feature
  modified:
    - features/step_definitions/model.steps.ts
    - features/step_definitions/companion.steps.ts

key-decisions:
  - "The trust pair observes a project-scope run (agentScope project), not the list action: pi-subagents 0.84 lists project agents even in an untrusted project"
  - "Model-call texts project each UUID to {uuid}; the mission id pi-subagents appends to a subagent result changes every run"
  - "The untrusted-profile Given has a 60-second timeout, because Pi loads every extension twice in a project that needs a trust decision"

patterns-established:
  - "Agent seeds use agentScope project to prove trust, and a foreground run (async false) to prove the child system prompt"

requirements-completed: [HAR-06, HAR-07]

coverage:
  - id: D1
    description: "A foreground subagent run of demo:reviewer starts a child that takes call 2 of the script; its whole system prompt (agent body, pi-subagents' child instructions, {project dir}) and all three model calls are compared"
    requirement: HAR-07
    verification:
      - kind: e2e
        ref: "features/agent/invocation.feature#A foreground agent run starts a child whose system prompt is the agent body"
        status: pass
      - kind: manual_procedural
        ref: "red run without the agent Given, recorded in this SUMMARY, not committed"
        status: pass
    human_judgment: false
  - id: D2
    description: "With .pi/settings.json in both projects, the trusted project runs the project-scope agent demo:reviewer, and the untrusted one (no trust.json entry) refuses it for want of trust"
    requirement: HAR-06
    verification:
      - kind: e2e
        ref: "features/agent/project-trust.feature (both scenarios)"
        status: pass
      - kind: manual_procedural
        ref: "trap run without the settings Given, recorded in this SUMMARY, not committed"
        status: pass
    human_judgment: true
    rationale: "The plan's truth names the list action; the scenarios observe a project-scope run instead, because pi-subagents 0.84 lists project agents whatever the trust. The verifier must accept the changed observation (deviation 1)."
  - id: D3
    description: "features/agent/, features/lib/agent-files.ts, and features/step_definitions/agent/runs.steps.ts exist and are used; check:features, fallow, and check:static pass"
    requirement: HAR-07
    verification:
      - kind: other
        ref: "npm run check:static (typecheck, lint, fallow, format:check, test:corresponding, check:features)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber -- features/agent (3/3), and features/skill features/agent (5/5)"
        status: pass
    human_judgment: false

duration: 38min
completed: 2026-11-01
status: complete
---

# Phase 1 Plan 07: Agent Seeds and the Project Trust Pair Summary

**A foreground pi-subagents run of the bridged agent `demo:reviewer` now has its child's whole system prompt compared, and a trusted and an untrusted project, both holding `.pi/settings.json`, show that only the trusted one runs its project-scope agent.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-11-01T04:37:04Z
- **Completed:** 2026-11-01T05:15:25Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `features/lib/agent-files.ts` writes `agents/<name>.md` with `name` and `description` frontmatter and a body. The agent Given asserts the file it wrote.
- `the model call {int} receives this system prompt:` compares the whole system prompt of one call of the last turn and marks the turn compared.
- Both model-call Thens read each UUID as `{uuid}`.
- `the project holds a pi settings file` writes `<project>/.pi/settings.json` (`{}`), asserts it, and registers its removal. The untrusted-profile Given starts the profile Pi with `trust: "untrusted"`, asserts that the companions loaded, and asserts that `<agent dir>/trust.json` does not exist.
- `features/agent/invocation.feature` (1 scenario) and `features/agent/project-trust.feature` (2 scenarios) pass.

## Task Commits

1. **Task 1: Run a bridged agent in the foreground and compare its child's system prompt**: `9504218` (test)
2. **Task 2: Show project trust both ways with a project-scope agent**: `7f09f42` (test)

## Step texts added

| Keyword | Text | Module |
| --- | --- | --- |
| Given | `the published plugin {string} of the marketplace {string} has the agent {string} described as {string} with this body:` (doc string) | `features/step_definitions/agent/runs.steps.ts` |
| Given | `the project holds a pi settings file` | `features/step_definitions/companion.steps.ts` |
| Given | `pi runs with the scripted model and these companions in an untrusted project:` (one column, `companion`) | `features/step_definitions/companion.steps.ts` |
| Then | `the model call {int} receives this system prompt:` (doc string; run tokens and `{uuid}` projected) | `features/step_definitions/model.steps.ts` |

Library export: `features/lib/agent-files.ts`: `PluginAgent`, `agentFileText`, `publishAgentFile`.

New run token for plan 01-09 to add to `.agents/skills/cucumber/rules/features.md`: `{uuid}` reads any lowercase RFC 4122 UUID in a model-call text (system prompt or message). It projects only. A command never expands it.

## Evidence

### Measured child system prompt (call 2 of `invocation.feature`)

The child of `subagent {"agent":"demo:reviewer","task":"Review the README.","async":false}` received this system prompt. It holds no date. The only run-specific value is the project directory:

```text
<active_agent name="demo:reviewer"/>

Review the files named in the task and report every problem you find.

Intercom orchestration channel:
The inherited thread is reference-only. Do not continue that conversation or send questions, status updates, or completion handoffs to the supervisor in normal assistant text.

Use contact_supervisor first. It resolves the supervisor session and run metadata automatically.
- Need a decision, blocked, approval, or product/API/scope ambiguity: contact_supervisor(...)
- ... (four more contact_supervisor lines; the feature file holds them whole)

Do not use contact_supervisor for routine completion handoffs. If no coordination is needed, return a focused task result.

## Acceptance Contract
Acceptance level: attested
... (the acceptance-report contract and its JSON shape; the feature file holds it whole)

<cwd>
{project dir}
</cwd>

You are a child subagent, not the parent orchestrator.
... (four more child-role lines)
```

The full text is in `features/agent/invocation.feature`, lines 29-107. The child's tools were `read`, `bash`, `edit`, `write`, `bg_wait`, and `contact_supervisor`. The calls step states all three calls: the parent's prompt, the child's `Task: Review the README.`, and the parent's second call with the tool call and the result `subagent returned: Run fan-out: 1/64 used, 63 remaining\nThe README has no problems.\nMission: {uuid} (completed)`.

### Red run (Task 1; the agent Given removed, reverted, not committed)

With no agent published, the subagent call fails, and call 2 is the parent's second call on Pi's main system prompt:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected
+ '\n' +
- '<active_agent name="demo:reviewer"/>\n' +
    '\n' +
+   'You are an expert coding assistant operating inside pi, a coding agent harness. ...
-   'Review the files named in the task and report every problem you find.\n' +
1 scenario (1 failed), 12 steps (10 passed, 1 skipped, 1 failed)
```

### Trust pair outputs (Task 2)

Both scenarios script the same call, `subagent {"agent":"demo:reviewer","agentScope":"project","task":"Review the README.","async":false}`.

- Trusted: the child runs and takes call 2 (`Task: Review the README.`). Call 3 carries `subagent returned: Run fan-out: 1/64 used, 63 remaining\nThe README has no problems.\nMission: {uuid} (completed)`.
- Untrusted: no child runs. Call 2 carries `subagent failed: agentScope: "project" requires project trust. This session declined trust for {project dir}, so project agents and project subagent settings are ignored. Re-run with agentScope: "user" or approve the project folder.`

The `list` outputs that the plan asked for, measured before the switch to a run: both scenarios returned the same list. The untrusted one also listed `- demo:reviewer (project, aliases: pi-claude-marketplace-demo-reviewer): Reviews the files it is given.` under `Project agents`, followed by the 13 builtin agents. See deviation 1.

A scratch probe extension (`/trust-probe`, not committed) showed that `ctx.isProjectTrusted()` returns `false` in that untrusted project, at start and after `new_session`. So Pi's decision was right, and pi-subagents' `list` ignored it.

### Trap run (Task 2; the settings Given removed from the untrusted scenario, reverted, not committed)

Without `.pi/settings.json`, Pi trusts the project, even though `trust.json` has no entry. The child ran and took the step meant for the parent's reply, so the parent called a third time:

```text
When the user prompts "Ask the reviewer to check the README."
AssertionError [ERR_ASSERTION]: the model was called past the end of its script
+ [
+   'call 3'
+ ]
- []
```

This is the trap that the settings file closes. `.pi/agents/` and `.pi/pi-claude-marketplace/`, which the project-scope install wrote, are not trust-requiring.

### Suite runs

- `npm run test:cucumber -- features/agent`: 3/3 scenarios, 39 steps.
- `npx cucumber-js features/skill features/agent`: 5/5. The `{uuid}` projection leaves the skill seed unchanged.
- `npm run check:static`: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features all passed.
- `npx fallow dead-code --fail-on-issues`: pass. The commit hook skipped `check:commit` on both commits, because no staged file was a build input.
- Step durations, measured alone: the untrusted profile Given took 12.9 s and the trusted one 14.2 s. Earlier, while other agents loaded the machine, the untrusted Given overran the 30 s default twice.

## Files Created/Modified

- `features/lib/agent-files.ts`: the agent file writer.
- `features/step_definitions/agent/runs.steps.ts`: the agent Given.
- `features/step_definitions/model.steps.ts`: the system-prompt Then, and the `{uuid}` projection in both call Thens.
- `features/step_definitions/companion.steps.ts`: the pi settings Given and the untrusted-profile Given. The trusted Given now shares one private helper with the untrusted one.
- `features/agent/invocation.feature`: the agent seed, 1 scenario.
- `features/agent/project-trust.feature`: the trust pair, 2 scenarios.

## Decisions Made

- The fixture writer is named `publishAgentFile`, because `published-marketplace.ts` already exports `publishAgent`, with fixed text.
- The invocation seed installs at user scope, as the plan says. The trust pair installs at project scope.
- The system-prompt Then marks the turn compared, as the plan says. The invocation scenario still states every call with the calls Then.
- The settings Given comes before the profile Given, so Pi sees the file when it decides trust at start.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's observation] The trust pair observes a project-scope run, not the `list` action**

- **Found during:** Task 2
- **Issue:** The plan has a `subagent {action:"list"}` call show `demo:reviewer` in the trusted scenario only. Measured with pi-subagents 0.84.0, the untrusted scenario listed it too, while `ctx.isProjectTrusted()` returned `false`. The cause is in pi-subagents: `withSessionProjectTrust` (`src/runs/foreground/subagent-executor.js`) wraps only `discoverAgents`. Management actions get `deps.discoverAgentsAll`, which `src/extension/index.js:511` binds without `projectTrusted`, and `handleList` has no trust check. A run does honor the trust decision.
- **Fix:** Both scenarios now script `subagent {"agent":"demo:reviewer","agentScope":"project","task":"Review the README.","async":false}`. The trusted one runs the child. The untrusted one gets pi-subagents' trust refusal. The titles now read "A trusted project runs its plugin agent" and "An untrusted project does not run its plugin agent". I chose `agentScope: "project"` over an unscoped run, because an unscoped run in the untrusted project fails with `Unknown agent` and lists the builtin agents. That list holds a path inside this checkout's `node_modules`, which no run token covers, and em dashes, which the `fix-unicode-dashes` pre-commit hook would rewrite in the feature file.
- **Files modified:** `features/agent/project-trust.feature`
- **Verification:** both scenarios pass. The trap run proves that the untrusted scenario fails when Pi trusts the project.
- **Committed in:** `7f09f42`

**2. [Rule 3 - Blocking] A per-run mission id in the subagent result**

- **Found during:** Task 1
- **Issue:** pi-subagents ends every subagent result with `Mission: <uuid> (completed)`, and the UUID changes every run, so a whole-value comparison cannot state it.
- **Fix:** both model-call Thens project each UUID to `{uuid}`. The helper documents the token.
- **Files modified:** `features/step_definitions/model.steps.ts`
- **Committed in:** `9504218`

**3. [Rule 3 - Blocking] The untrusted profile start overran the 30-second step timeout**

- **Found during:** Task 2
- **Issue:** The untrusted Given timed out at 30 s on two runs. Pi 1.4.0 loads every extension twice in a project that needs a trust decision (`ResourceLoader.loadProjectTrustExtensions`, then `reload`).
- **Fix:** a named constant `UNTRUSTED_START_TIMEOUT_MS = 60_000`, with a comment that says why, on that Given only.
- **Files modified:** `features/step_definitions/companion.steps.ts`
- **Committed in:** `7f09f42`

---

**Total deviations:** 3 auto-fixed (1 observation bug, 2 blocking).
**Impact on plan:** HAR-06 still compares trusted and untrusted behavior side by side, with only the trust entry different. The observation is now a run rather than a listing.

## Issues Encountered

- The worktree guard refused compound commands with an inline Python heredoc or a chain that named git. The temporary edits ran as scratch scripts and separate calls.
- The measurement runs used temporary dumps of the call log into `.../scratchpad/agent-01-07/`. Each was reverted before its commit, and the committed `model.steps.ts` holds no dump.

## Known Stubs

None.

## Flagged assumption (from the plan)

- **HAR-06 (unclassified, unresolved):** I assumed that the agent pair in `features/agent/project-trust.feature` satisfies "a scenario shows the untrusted behavior beside it" (DC-13 item 8). I also assumed that plan 01-06's separate approval Given satisfies "approves project MCP servers as the pre-fan-out decision specifies", rather than a default. Flagged for the verifier.

## Side finding for the agents phase

pi-subagents 0.84.0's `subagent {action:"list"}` lists the agents of an untrusted project, while runs refuse them. Claude Code's behavior for untrusted project agents needs research before an agents scenario pins either side.

## Dubious Choices

1. **Run instead of list for HAR-06 (deviation 1).** The plan's truth names the list. I changed the observation without asking. The list behavior looks like a pi-subagents defect, not this extension's.
2. **`agentScope: "project"` in both trust scenarios.** This proves pi-subagents' explicit project-scope trust check, not the default `both` scope discovery filter. Both read Pi's decision. The unscoped error text holds a checkout path and em dashes (see deviation 1).
3. **`{uuid}` matches any UUID.** It does not check that a mission id stays the same across calls, or that it is a real mission. A wrong id of the same shape passes.
4. **60-second timeout on the untrusted Given.** It rests on two timeouts under machine load and on Pi's double extension load, which I read in Pi's source. Alone, the Given took 12.9 s.
5. **The child system prompt pins pi-subagents' own boilerplate**, such as the intercom and acceptance-contract text. A pi-subagents upgrade that rewords it breaks the seed. That is intended for a whole-value comparison, but it couples the seed to the peer floor 0.84.0.
6. **The trusted Given now passes `trust: "trusted"` explicitly.** Before, it left `trust` undefined. The world treats both the same.
7. **No windows ledger entry for deviation 1.** `.planning/WINDOWS.md` is shared by parallel worktrees, and the orchestrator collects dubious choices. The deviation is recorded here and in coverage D2 (`human_judgment: true`).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-01-36 is mitigated: both scenarios hold `.pi/settings.json`, and the trap run is recorded. T-01-37 is mitigated: only foreground runs, inside the profile Pi's process, which the release stops with its group.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The agents phase can build runs, preloads (XK-01), and trust scenarios on the agent Given, the system-prompt Then, and the untrusted Given.
- Plan 01-09 should add `{uuid}` to the run-token list in `.agents/skills/cucumber/rules/features.md`, and note in `world-and-stand-ins.md` that trust is observed through a project-scope run, because pi-subagents' list ignores trust.

---
*Phase: 01-harness-and-version-raise*
*Completed: 2026-11-01*

## Self-Check: PASSED

- FOUND: `features/lib/agent-files.ts`, `features/step_definitions/agent/runs.steps.ts`, `features/agent/invocation.feature`, and `features/agent/project-trust.feature` (2 `Scenario:` lines).
- FOUND on HEAD: `9504218` and `7f09f42` (`git rev-list --count c5a8396..7f09f42` = 2).
- `grep -c untrusted features/step_definitions/companion.steps.ts` is at least 1.
