---
phase: 04-agents
plan: 03
subsystem: agents-bridge
tags: [agents, pi-subagents, cucumber, soft-dependency, project-trust]
status: complete

requires:
  - phase: 04-agents
    provides: "plan 04-01's shared agent steps (seed agent Given, `pi-subagents hides its builtin agents`)"
  - phase: 01-harness
    provides: profile Pi, untrusted profile Pi, scripted model, call log, frozen command steps
provides:
  - "features/agent/companion-missing.feature: AGT-05 scenarios (A)-(C)"
  - "features/agent/project-trust.feature: the seed pair plus the trusted default-scope run and the untrusted user-scope run (AGT-06)"
  - "Measured, unpinned texts for plan 04-06's pi-subagents report: the untrusted default-scope run and the trust-blind list"
affects: [04-06]

actuals:
  tokens: 2900
  tasks: 2
  commits: 2
plan_head_before: 51ad1d7cf709171670f07c8fa02ff7f7d6ce8241
plan_head_after: 3c609a50b220f6e7624bd14f50d0fef146d67c31

tech-stack:
  added: []
  patterns:
    - "A shared-Pi setup install followed by a profile Pi start stands in for loading a companion and running /reload"

key-files:
  created:
    - features/agent/companion-missing.feature
  modified:
    - features/agent/project-trust.feature

key-decisions:
  - "An install without pi-subagents is pinned at today's severity, `warning` with the summary `A plugin operation needs attention.` (SEV-01 companionSeverity), not the plan's `info`; D-CF4-11 says to pin today's behavior"
  - "Scenario (C) installs with the frozen `the user has run {string}, which warned` setup step, because the plain setup step requires every result to be info"

requirements-completed: [AGT-05, AGT-06]

coverage:
  - id: D1
    description: "An install without pi-subagents installs the agent and names `requires pi-subagents`; with pi-subagents loaded the reason is absent"
    requirement: AGT-05
    verification:
      - kind: e2e
        ref: "features/agent/companion-missing.feature#Installing a plugin with agents without pi-subagents names the missing companion"
        status: pass
      - kind: e2e
        ref: "features/agent/companion-missing.feature#Installing a plugin with agents while pi-subagents runs names no missing companion"
        status: pass
    human_judgment: false
  - id: D2
    description: "A pi started with pi-subagents after the install lists the bridged agent with no reinstall"
    requirement: AGT-05
    verification:
      - kind: e2e
        ref: "features/agent/companion-missing.feature#Starting pi with pi-subagents after the install lists the agents with no reinstall"
        status: pass
    human_judgment: false
  - id: D3
    description: "A trusted project runs its plugin agent with the default agent scope; an untrusted project still runs a user-scope plugin agent; the seed pair is unchanged"
    requirement: AGT-06
    verification:
      - kind: e2e
        ref: "features/agent/project-trust.feature#A trusted project runs its plugin agent with the default agent scope"
        status: pass
      - kind: e2e
        ref: "features/agent/project-trust.feature#An untrusted project still runs a user-scope plugin agent"
        status: pass
      - kind: e2e
        ref: "features/agent/project-trust.feature#An untrusted project does not run its plugin agent"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-11-01
---

# Phase 4 Plan 03: Agent companion missing and project trust Summary

Two feature files now pin what a user sees for bridged agents. An install made without pi-subagents still installs the agent, names `{requires pi-subagents}`, and warns. A pi started with pi-subagents afterwards lists the agent with no reinstall. Under project trust, a trusted project runs its plugin agent with the default agent scope. An untrusted project still runs a user-scope plugin agent, as Claude Code does. The explicit project-scope pair from Phase 1 is unchanged. No product file changed.

## Performance

- **Duration:** 17 min
- **Started:** 2026-11-01T16:16:32Z
- **Completed:** 2026-11-01T16:33:51Z
- **Tasks:** 2
- **Files modified:** 2

## Task Commits

1. **Task 1 (tracer): Install without pi-subagents, then list the agents once pi-subagents runs** - `2f97d94` (test)
2. **Task 2: Pin how project trust reaches bridged agents** - `3c609a5` (test)

Tracer gate: `human_verify_mode` is the default `end-of-phase` and the tracer's `<verify>` is automated only. So after the Task 1 commit, the verify ran again: the companion-missing feature, then the final run of both features together (7 scenarios, 83 steps, all passed). Expansion then continued.

## Files Created/Modified

- `features/agent/companion-missing.feature` - `Feature: Agent companion missing`, scenarios (A) without the companion, (B) the negative control with pi-subagents, and (C) the later listing.
- `features/agent/project-trust.feature` - the seed pair byte for byte, a description that now names the divergence from Claude Code, and the new scenarios (C) "A trusted project runs its plugin agent with the default agent scope" and (D) "An untrusted project still runs a user-scope plugin agent".

## Discrimination runs (Task 1)

The plan asked for proof that pins (A) and (C) fail when their expected values change. Both ran in one run, then the file was restored from a scratch copy. `diff` against the copy printed nothing.

- **(A)** expected reasons cell emptied. It failed with `+ 'requires pi-subagents'` / `- ''` in the plugin row.
- **(C)** agent line removed from the expected list (`subagent returned: Executable agents:\nUser agents`). It failed. The actual text was `subagent returned: Executable agents:\nUser agents\n- demo:reviewer (user, aliases: pi-claude-marketplace-demo-reviewer): Reviews the files it is given.`
- (B), the negative control, passed in the same run: `3 scenarios (1 passed, 2 failed)`.

For Task 2, the seed's untrusted scenario, which is unchanged and passing, is the negative control for (C) and (D). Its explicit project-scope call is refused with pi-subagents' trust message.

## Measured unpinned texts (for plan 04-06's pi-subagents report)

Both were measured on 2026-11-01 with pi-subagents 0.84.0. The measurement used a throwaway feature under the scratch folder (`exec-04-03/measure/untrusted-measure.feature`), never under `features/`. The step projected run tokens. It did not project the builtin directory, which is under the checkout.

**1. Untrusted default-scope run.** Not pinned (D-CF4-09). Setup: project-scope install, untrusted project with a pi settings file, call `{"agent":"demo:reviewer","task":"Review the README.","async":false}` with no `agentScope`. The tool result (`isError`, so it starts with `subagent failed: `):

```text
subagent failed: Unknown agent: demo:reviewer
Effective cwd: {project dir}
Consulted agent-definition directories:
- builtin: <checkout>/node_modules/.cache/optional-peers/node_modules/pi-subagents/agents (13 candidates)
- user: {agent dir}/agents (absent)
- user: {home}/.agents (absent)
Available agents:
- claude-code (builtin) — Read-only Claude Code CLI analysis; requires local authentication and trusted u…
- claude-code-writer (builtin) — Explicit file-writing Claude Code CLI mode; requires local authentication and t…
- codex-exec (builtin) — Read-only one-shot analysis through the installed Codex CLI
- codex-exec-writer (builtin) — Explicit workspace-writing one-shot execution through the installed Codex CLI
- cursor-agent (builtin) — Read-only one-shot analysis through the installed Cursor CLI
- cursor-agent-writer (builtin) — Explicit workspace-writing one-shot execution through the installed Cursor CLI
- delegate (builtin) — Lightweight subagent that inherits the parent model with no default reads
- evidence-auditor (builtin) — Independent evidence reviewer for checking whether important research claims ar…
- oracle (builtin) — High-context decision-consistency oracle that protects inherited state and prev…
- researcher (builtin) — Autonomous web researcher — searches, evaluates, and synthesizes a focused rese…
- reviewer (builtin) — Versatile review specialist for code diffs, plans, proposed solutions, codebase…
- scout (builtin) — Fast codebase recon that returns compressed context for handoff
- worker (builtin) — Implementation agent for normal tasks and approved oracle handoffs
```

`<checkout>` is the checkout's absolute path. In this worktree it was `/home/user/pi-claude-marketplace/.claude/worktrees/agent-aab2e0b5ea9b9dac6`. It matches RESEARCH E6, except that builtins were not hidden here, so `Available agents:` lists the 13 builtins and not `- (none)`. The message never says that the project agent exists but was skipped for trust. It tells the user the agent is unknown.

**2. Trust-blind list.** Not pinned (D-CF4-09). Setup: same install, untrusted project, builtins hidden, call `{"action":"list"}`:

```text
subagent returned: Executable agents:
Project agents
- demo:reviewer (project, aliases: pi-claude-marketplace-demo-reviewer): Reviews the files it is given.
```

The list offers a project agent that this session refuses to run, under either scope. This matches 04-PI-SUBAGENTS Q3 (`extension/index.js:511` wires `discoverAgentsAll` with no `projectTrusted`).

## Decisions Made

- Pinned the install's measured severity (`warning`) as D-CF4-11 directs ("pin today's behavior"). See Deviation 1.
- Scenario (C) has no `Given the user has started a new pi session`. The profile Pi starts after the install, so its first session already sees the agent file, and the plan's step list leaves it out too.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's expectation] An install without pi-subagents is `warning`, not `info`**
- **Found during:** Task 1
- **Issue:** The plan's truth and action say the install result has severity `info`. They cite `features/plugin/reinstall.feature:191-197`. Measured: `install` stamps the row through `companionSeverity` (`shared/notify-reasons.ts:89-102`, SEV-01: a missing declared companion is `warning`). The result is `severity: warning` with `summary: A plugin operation needs attention.`. The reinstall precedent is info because reinstall stamps its rows another way. For the same reason, scenario (C)'s plain `Given the user has run ...` failed: that step requires every result to be info.
- **Fix:** (A) pins `warning` and the summary row. (C) uses the frozen `Given the user has run {string}, which warned`. No product change: D-CF4-11 says to pin today's behavior, and SEV-01 is a recorded decision. The install still succeeds and the agent is installed (the AGT-05 prohibition holds).
- **Files modified:** `features/agent/companion-missing.feature`
- **Verification:** the feature passes. The discrimination runs above fail as expected.
- **Committed in:** `2f97d94`

**2. [Rule 3 - Blocking] The feature description of `project-trust.feature` had to change beyond one added sentence**
- **Found during:** Task 2
- **Issue:** The old text said "both scenarios hold a pi settings file, so only the trust entry differs between them". With four scenarios that is false, because (D) also differs in install scope.
- **Fix:** "every scenario holds a pi settings file, so the trust entry decides", plus the new sentence "Claude Code runs plugin agents in an untrusted folder; refusing a project-scope one is a Pi gap." The description is now four lines. No scenario line changed (`git diff` removes only the two description lines).
- **Committed in:** `3c609a5`

**Total deviations:** 2 auto-fixed (1 plan-expectation bug, 1 blocking wording).
**Impact on plan:** None on scope. No product file changed (`git diff --stat 51ad1d7..HEAD -- extensions` is empty).

**Plan ledger note:** the worktree guard refuses writes to the shared `.git` folder, so the plan ledger is at the scratchpad path `exec-04-03/plan-head-before` (value `51ad1d7`). `commits: 2` is `git rev-list --count 51ad1d7..3c609a5`, measured before this SUMMARY's own commit.

## Verification

- `npx cucumber-js features/agent/companion-missing.feature features/agent/project-trust.feature`: 7 scenarios, 83 steps passed.
- `npm run check:static` passed before each commit: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features.
- `SKIP=npm-check pre-commit run --files <file>` was clean before each commit. Inside the worktree, the hook skipped `check:commit` as expected.
- Acceptance greps: `Feature: Agent companion missing` 1; `requires pi-subagents` 1; the extensions diff is empty; each new Task 2 scenario title appears on one line (66, 96); the seed scenarios have no removed lines.
- Every run in these scenarios passes `"async":false`. The expected texts are pi-subagents' list and run results and the install result rows. None is a generated agent byte, so they hold before and after plan 04-02's converter changes.

## Issues Encountered

None beyond the deviations.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-09 holds: no change moves project-scope agents, and the seed's untrusted refusal is still pinned. T-04-10 holds: the untrusted default-scope text, which names the checkout path, appears only in this SUMMARY.

## Parent lines

- `features/lib/run-tokens.ts` (frozen) and the cucumber skill's token list (frozen): a `{pi-subagents dir}` token would let the untrusted default-scope text be pinned portably. That is only needed if the parent decides to pin it. D-CF4-09 as amended leaves it unpinned.
- `.planning/phases/04-agents/04-CONTEXT.md` D-CF4-11 and the plan text: the companion-missing install is `warning` (SEV-01), not `info`. `install` and `reinstall` disagree for the same missing companion: install warns, while reinstall reports info (`features/plugin/reinstall.feature:191-197`). Whether reinstall should also warn under SEV-01 is a question for the parent or plan 04-06. It is not in this plan's files.
- `CHANGELOG.md`: none. This plan adds only behavioral tests.

## Next Phase Readiness

Plan 04-06 can draft the pi-subagents report from the two measured texts above. AGT-05 and AGT-06 have passing scenarios.

## Self-Check: PASSED

- FOUND: features/agent/companion-missing.feature, features/agent/project-trust.feature
- FOUND commits: 2f97d94, 3c609a5 (ancestors of HEAD)

## Dubious Choices

- **Pinned `warning` where the plan said `info`.** D-CF4-11's "pin today's behavior" won over the plan's stated severity. If the intent was that a missing soft dependency should read as info at install, that would be a product change outside this plan's allowed edit (only the pi-subagents arm of `soft-dep.ts`; severity lives in `notify-reasons.ts`).
- **Install and reinstall severities differ for a missing companion** and both are left as they are (listed as a parent line, not fixed).
- **The `project-trust.feature` description is four lines.** The cucumber rule asks for two or three. Six other features have four or more lines, and the plan asked for an added sentence. The decision ID D-CF4-09 is left out of the feature text, because no feature file cites decision IDs. It is cited in the commit body and here.
- **Scenario (D) uses the seed's three-step script**, with the child's reply and the parent's reply, and the expected rows mirror the trusted seed. The plan named those two rows. The rest is the seed's full call table.
- **Scenario (C) of `companion-missing.feature` starts no new session** after the profile Pi starts. It relies on pi-subagents reading `pi-subagents hides its builtin agents` at list time. It passed, which shows the setting is read per call.
- **The measured default-scope text was taken with builtins shown.** So it differs from RESEARCH E6's `- (none)` in the `Available agents:` block. The plan allowed either a citation or a measurement.
