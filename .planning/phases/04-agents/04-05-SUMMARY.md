---
phase: 04-agents
plan: 05
subsystem: agents-bridge
tags: [agents, pi-subagents, skills, cucumber, preload]
status: complete

requires:
  - phase: 04-agents
    provides: "plan 04-01: shared agent steps (`has these agents:`); plan 04-02: converter changes in convert.ts"
provides:
  - "D-CF4-04 skill preload: the content of each preloaded plugin skill written after the agent body"
  - "bridges/agents/skill-preload.ts: readSkillPreloads"
  - "AgentSkillSource, SkillPreload, StageAgentsInput.skillSources"
  - "The skills phase's rows passed to the agents stage by install-outcome.ts and update-swap.ts"
  - "features/step_definitions/agent/runs.steps.ts: the child-tools Then"
  - "features/agent/invocation.feature: scenarios (A)-(H)"
  - "AGT-04 recorded gap (D-CF4-10)"
affects: [04-06]

actuals:
  tokens: 21500
  tasks: 3
  commits: 4
plan_head_before: ee9428962ed698ab79353a1ca3379673d06994d6
plan_head_after: 627d250c47fe2f09500fbed29c4edfbf5971bac3

tech-stack:
  added: []
  patterns:
    - "The agents bridge declares a structural copy of the skills phase's row instead of importing bridges/skills"
    - "A preload map keyed by generated skill name, read once per stage and passed to every convertAgent call"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/agents/skill-preload.ts
    - test/bridges/agents/skill-preload.test.ts
    - features/step_definitions/agent/runs.steps.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - test/bridges/agents/convert.test.ts
    - test/bridges/agents/stage.test.ts
    - test/bridges/agents/types.test.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - features/agent/invocation.feature

key-decisions:
  - "D-CF4-04: a preloaded plugin skill is written after the agent body as `Base directory for this skill: <staged folder>`, a blank line, and the source SKILL.md body with references rewritten and variables substituted; it leaves `skills:`"
  - "D-CF4-04: a skill with `disable-model-invocation: true`, with no non-blank `description` or `when_to_use`, or whose frontmatter does not parse, is not preloaded and not listed, with a staging warning"
  - "D-CF4-04: the text comes from the plugin source, and install and update pass the skills phase's rows (`skillSources`)"
  - "D-CF4-10: AGT-04 closes on the recorded gap; no scenario launches an `async: true` run"

requirements-completed: [AGT-02, AGT-04, XK-01]

metrics:
  started: 2026-11-01T17:06:17Z
  completed: 2026-11-01T17:37:45Z
  duration: 31m
---

# Phase 4 Plan 05: Agent invocation and skill preload Summary

A bridged agent now gets the content of the plugin skills it preloads, as Claude Code 2.1.316 gives a subagent. The child's system prompt holds, after the agent body, `Base directory for this skill: <staged skill folder>` and the skill's body with its references rewritten and its variables substituted. An update writes the new version's skill. A skill the model cannot invoke is skipped, and the agent's staging warnings say why. pi-subagents' own child model call proves each change. This plan also pins the tools a foreground child gets and the body a same-name agent runs, and it records the AGT-04 background gap.

## Tasks

| Task | Name | Commit | Kind |
| ---- | ---- | ------ | ---- |
| (orchestrator item) | Ignore inherited object keys in agent tool names | 42ae9e3 | fix |
| 1 | Preload a plugin skill's content into an agent run, end to end (tracer) | a53a27c | feat |
| 2 | Preload the new skill after an update and report skipped preloads | 486c5f8 | fix |
| 3 | Pin a foreground run's tools and a same-name agent's body, and record the background gap | 627d250 | test |

Tracer gate: after Task 1, the full `<verify>` chain passed again (the unit tests, direct coverage of the four sources, `npx cucumber-js features/agent` with 34 scenarios, and `check:static`). Then expansion continued.

## Red proofs

Every scenario and unit case below ran before its product change. The quoted text is what pi-subagents, the command, or the test runner returned.

**Orchestrator item (`TOOL_MAP`).** Two new `convert.test.ts` cases failed before the fix:

- "drops a tool named after an inherited object key" (`tools: Read constructor toString hasOwnProperty`) threw `TypeError [Error]: entry.indexOf is not a function` at `isDisallowed`, so such an agent failed the install.
- "does not exclude a disallowed tool named after an inherited object key" (no `tools`, `disallowedTools: constructor toString`) wrote `excludeTools: function Object() { [native code] },function toString() { [native code] }` and the `excludeTools requires pi-subagents >= 0.62.0` warning, not the no-mapping warning.

**Task 1 (D-CF4-04, install path).**

- (A) "An agent that preloads a plugin skill runs with the skill's content in its system prompt" failed. The child prompt had no `Base directory for this skill:` block. Instead, pi-subagents added its own block before `## Acceptance Contract`: `The following configured skills are available to this subagent.` ... `<available_skills>` with `<name>demo-helper</name>`, `<description>Explains the house rules.</description>`, `<location>{agent dir}/pi-claude-marketplace/resources/skills/demo-helper/SKILL.md</location>`.
- (B) "An agent does not preload a skill that has no description" failed. The `get` result had the extra lines `Skills: demo-bare` and `Skill paths: ../pi-claude-marketplace/resources/skills`.
- (C) "An agent does not preload a skill the model cannot invoke" **failed too**, so it is a red proof and not the negative control. Before the change the agent listed `skills: demo-hidden`. pi-subagents left the hidden skill out of `<available_skills>`, but it still wrote two blank lines before `## Acceptance Contract`. As the plan provides for this case, the seed scenario, whose agent preloads nothing, is the negative control. It passed before and after.

After the change, (A), (B), (C), and the seed passed. The measured plugin root in (A) is `{home}/marketplaces/fixtures/plugins/demo`.

**Task 2 (D-CF4-04, update path).**

- (D) "Updating a plugin preloads the new version of its skill" failed. After the update, the `get` result kept `Skills: demo-skill` and `Skill paths: ../pi-claude-marketplace/resources/skills`, and its `System Prompt:` was the agent body alone, with no `Version 1.1.0.` block.
- (E) "Apply reports an agent's preloaded skill that the model cannot invoke" failed. The apply returned only the `reconcile-applied-cascade` row. It had no diagnostic row and no skipped-preload warning.

After the one-line `update-swap.ts` change, both passed.

## Discrimination runs (Task 3 pins)

(F), (G), and (H) are pins: they passed on the first run that used the measured values. To show that (F) and (H) can fail, each ran once with one expected value changed. Then the file was restored from a backup (`cmp` confirmed it is byte-identical).

- (F) with an extra expected `edit` row failed. The actual list is `read`, `bash`, `contact_supervisor`, and the diff shows `- 'edit'`.
- (H) with the `demo` plugin's body expected failed with `+ 'Check the build of the tools plugin and report every failure you find.\n'` / `- 'Review the files named in the task and report every problem you find.\n'`.
- (G) is the control of (F): an agent with no `tools` list offers `read`, `bash`, `edit`, `write`, `bg_wait`, `contact_supervisor`, as measured in E2.

The first draft of (F) expected `bg_wait` beside `read` and `bash`. The run showed that pi-subagents offers `bg_wait` only with its default tool set. The expected table now holds the measured list.

## AGT-04 recorded gap (D-CF4-10)

No scenario launches an `async: true` run (`grep -c 'async":true' features/agent/invocation.feature` prints `0`). AGT-04 closes on this recorded gap, measured as follows.

- **Cause.** The detached background runner loads child extensions through jiti with the `JITI_ALIAS` map that pi-subagents builds from `HOST_PEER_ALIASES` (`node_modules/.cache/optional-peers/node_modules/pi-subagents/src/runs/background/runner-aliases.js`, read this session). That table maps the bare `@earendil-works/pi-ai` specifier to `{ pkg: "@earendil-works/pi-ai", subpath: "./compat" }`. It has entries for `/compat`, `/oauth`, and `/providers/all`, and none for `/providers/faux`. jiti matches the alias as a prefix, so the scripted model's `import ... from "@earendil-works/pi-ai/providers/faux"` (`features/lib/scripted-model/extension.ts:24`) resolves to a path under `compat.js`. The research measured the result. With the scripted model as a default child extension, the wake notice read `Background task failed: **demo:bg** ... Model "faux/faux-1" not found.` Registered as a required child extension, the error read `Required child extension failed to load: .../features/lib/scripted-model/extension.ts: Failed to load extension: Cannot find module '.../node_modules/@earendil-works/pi-ai/dist/compat.js/providers/faux'`.
- **Call-order race.** Even with the import fixed, the parent and the detached child would read one shared script and append to one call log. Their model calls are unordered, so a scenario could not number them reliably.
- **What a fix needs.** One of two changes: the frozen scripted model's import path (for example, importing the faux provider through a specifier the alias table maps), or pi-subagents' alias table (an exact-match alias, or a `providers/faux` entry). Both lie outside this phase's ownership. They are parent lines for plan 04-06.
- **The pin that remains.** Plan 04-02's `get` scenario in `features/agent/frontmatter.feature` shows `Async: true` for `background: true` and `"true"`, and `Async: false` otherwise.

## Non-owned edits and how they stay minimal

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`: four one-line additions and nothing else. They are the `InstallLedgerContext.stagedSkillRecords` field with its comment, its `[]` initializer, `c.stagedSkillRecords = prep.result.recorded;` in the skills phase, and `skillSources: c.stagedSkillRecords,` in the agents phase.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`: one added line, `skillSources: handles.skills.result.recorded,`, in the `prepareStagePluginAgents` call of `prepareUpdateHandles`.
- `test/orchestrators/plugin/update-flow.test.ts`: expected values only, in the two skill-preload tests. Each `assert.match(agent, /^skills: hello-tool$/m)` became one assertion that the agent has no `skills:` line and one that it holds the provenance line `- skill reference "tool" names a skill with no description -- not preloaded (Claude Code skips it too)`. The two titles now say the update reports the skipped preload. `grep -c 'skills: hello-tool'` prints `0`.

## Verification

- `node --test` passed on `skill-preload`, `convert`, `stage`, `types`, `install-outcome`, `update-flow`, and `update-swap` tests.
- `npm run test:coverage:direct` passed (100%) for `skill-preload.ts`, `convert.ts`, `stage.ts`, `types.ts`, `install-outcome.ts`, and `update-swap.ts`.
- `npx cucumber-js features/agent features/plugin/staging-warnings.feature` passed 61 scenarios. `features/agent/invocation.feature` holds the seed and (A)-(H).
- `npm run check:static` passed before each commit. `npx fallow dupes` reports no clone group, and the marked commit block of `stage.ts` is untouched (the new lines sit between step 1 and step 2).
- `npm run test:modules` and `npm run test:integration` passed after the last task.
- Acceptance greps hold: `Base directory for this skill` is in `skill-preload.ts`. `bridges/skills` appears in neither `skill-preload.ts` nor `stage.ts`. `skillSources: c.stagedSkillRecords` and `skillSources: handles.skills.result.recorded` are present. `the agent's model call {int} offers these tools:` is in `runs.steps.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `TOOL_MAP` found `Object.prototype` keys (orchestrator item, plan 04-02's deferred issue)**
- **Found during:** before Task 1, at the orchestrator's request
- **Issue:** `TOOL_MAP[toolNameOf(token)]` on a frozen object literal found inherited members, so `tools: constructor` crashed the conversion and `disallowedTools: constructor` wrote a function's source into `excludeTools:`.
- **Fix:** `TOOL_MAP` is a `ReadonlyMap`, read with `.get` at its two call sites, as `MODEL_MAP` is. `THINKING_VALUES` and `SUPPORTED_SOURCE_FIELDS` are already `Set`s. The guided-field table is only walked with `Object.entries`, an own-key walk, and is never indexed by a source key. So neither has the bug, and neither changed.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts`, `test/bridges/agents/convert.test.ts`
- **Commit:** 42ae9e3

**2. [Plan contingency] Scenario (C) was red before the change**
- **Found during:** Task 1
- **Issue:** the plan expected (C) to pass before the change, as the negative control.
- **Fix:** none needed. As the plan says for this case, (C) is recorded as a red proof, and the seed scenario stays the negative control.

**3. [Rule 1 - Bug in the plan's guess] The measured child tools of (F)**
- **Found during:** Task 3
- **Issue:** the plan expected `read` and `bash` beside pi-subagents' runtime tools. The run shows `read`, `bash`, `contact_supervisor`, with no `bg_wait` for an explicit list.
- **Fix:** the scenario pins the measured list.

**Plan ledger note:** the worktree guard refuses writes into the shared `.git` folder, so the plan ledger is the scratchpad file `exec-04-05/plan-head-before`, value `ee94289`. `commits: 4` is `git rev-list --count ee94289..627d250`.

`REQUIREMENTS.md`, `STATE.md`, and `ROADMAP.md` were not touched. The orchestrator owns them. The plan's requirements are AGT-02, AGT-04, and XK-01.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-12 is mitigated: the eligibility rule reads the source frontmatter before any text is built. Unit rows and scenarios (B), (C), and (E) prove the skips. T-04-13 is mitigated: the agents bridge spawns nothing and writes a skill's `!` lines as literal text. T-04-14 is mitigated: the blocks follow the generated closing `---`, and a convert row parses the file back and finds the frontmatter unchanged. T-04-15 holds: the reader only joins `SKILL.md` to a row's `sourcePath`, and the rows come only from the skills phase. T-04-16 and T-04-SC are accepted as planned.

## Parent lines

- `CHANGELOG.md`: one bullet for this plan. A bridged agent now gets the content of the plugin skills its `skills:` names, as Claude Code gives a subagent. The content is written after the agent body as `Base directory for this skill: <folder>` and the skill's text, and an update writes the new version. A preloaded skill with `disable-model-invocation: true`, with no description, or whose frontmatter does not parse is skipped with a staging warning. An agent tool named `constructor` or `toString` is now dropped like any unknown tool (D-CF4-04).
- AGT-04 (for plan 04-06): to make a background run testable, either change the frozen `features/lib/scripted-model/extension.ts` so it does not import `@earendil-works/pi-ai/providers/faux` through a specifier that the runner's alias table maps by prefix, or report to pi-subagents that `HOST_PEER_ALIASES` maps the bare `@earendil-works/pi-ai` prefix onto `./compat`, which breaks every deeper subpath it does not list. The shared call log would still need a way to order parent and child calls.
- The `TOOL_MAP` parent line of plan 04-02 is resolved by 42ae9e3.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/bridges/agents/skill-preload.ts, test/bridges/agents/skill-preload.test.ts, features/step_definitions/agent/runs.steps.ts, features/agent/invocation.feature
- FOUND commits: 42ae9e3, a53a27c, 486c5f8, 627d250 (all ancestors of HEAD)

## Dubious Choices

- **Only `description` and `when_to_use` qualify a skill for preload.** The hyphenated `when-to-use`, which plan 04-01 accepts for an agent's description, does not count for a skill. That follows the plan and the upstream pool rule (`hasUserSpecifiedDescription` or `whenToUse`).
- **The skill body is trimmed**, with or without frontmatter. Pi's parser trims only a body that follows frontmatter.
- **A YAML frontmatter that parses to a non-object** (a bare scalar, for example) counts as no description, not as unparseable.
- **The unparseable warning has no `(Claude Code skips it too)`**, as the plan's text says. Claude Code's skills loader treats such a skill differently from Pi's.
- **A skipped preload named twice** (bare and self-qualified) warns once, because each generated name counts once. Unknown and foreign references still warn per token, as before.
- **The agent body loses its trailing blank lines only when a skill is inlined** (`trimEnd` before the blocks). An agent with no inlined skill keeps today's bytes.
- **The preloads are read in parallel** (`Promise.all`). The first read error rejects the stage.
- **A source row that no agent names is never read**, so a broken skill that no agent preloads cannot fail the agents stage.
- **(C) is a red proof, not the negative control** (Deviation 2). Before the change, pi-subagents wrote two stray blank lines for a skills list whose only skill it hides.
- **(F) pins `contact_supervisor` and no `bg_wait`** for an explicit `Read, Bash` list, as observed. The tool list is pi-subagents' design, and a Claude Code subagent has neither tool.
- **(E) pins the plugin row's `requires pi-subagents` reason**, because the shared Pi does not load pi-subagents.
- **(D) names the default skill by its source name `demo-skill`**, which is also its generated name.
