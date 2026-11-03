---
phase: 04-agents
verified: 2026-11-03T14:30:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/04-agents/04-01-PLAN.md
  - .planning/phases/04-agents/04-01-SUMMARY.md
  - .planning/phases/04-agents/04-02-PLAN.md
  - .planning/phases/04-agents/04-02-SUMMARY.md
  - .planning/phases/04-agents/04-03-PLAN.md
  - .planning/phases/04-agents/04-03-SUMMARY.md
  - .planning/phases/04-agents/04-04-PLAN.md
  - .planning/phases/04-agents/04-04-SUMMARY.md
  - .planning/phases/04-agents/04-05-PLAN.md
  - .planning/phases/04-agents/04-05-SUMMARY.md
  - .planning/phases/04-agents/04-06-PLAN.md
  - .planning/phases/04-agents/04-06-SUMMARY.md
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/discover.ts
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/agents/skill-preload.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/types.ts
  - extensions/pi-claude-marketplace/domain/name.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - features/agent/companion-missing.feature
  - features/agent/frontmatter.feature
  - features/agent/invocation.feature
  - features/agent/lifecycle.feature
  - features/agent/listing.feature
  - features/agent/project-trust.feature
  - features/lib/agent-files.ts
  - features/step_definitions/agent/listing.steps.ts
  - features/step_definitions/agent/runs.steps.ts
covered_digest: "v4:sha256:046995f4d70b04282a7daba8e8ee2b0b87515092539f8ba68e31fbf1e1a34372"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "04-02 prohibition (AGT-02): MUST NOT run a bridged agent in the background when its source does not ask for it with `background: true` and the call does not ask for it either."
    reason: "User decision A.2 of 2026-11-02 (.planning/DUBIOUS-CHOICES.md l.68-90; D-CF6-10 in PROJECT.md l.1807, 'User accepted'): 'the extension writes `async: true` for agents granted MCP tools, which is consistent with Pi but differs from Claude Code's foreground run', because pi-subagents loads no ambient extension, pi-mcp-adapter included, into a foreground child. 204a8e6 implements it (bridges/agents/convert.ts:899-901, 961). The prohibition still holds for every agent that runs no plugin MCP tool: `async: false` unless the source sets `background: true` (convert.ts:1003, frontmatter.feature). This is the same decision Phase 6 carries as its SC4/MCP-07 override."
    accepted_by: "acolomba"
    accepted_at: "2026-11-02T11:15:00Z"
re_verification:
  previous_status: passed
  previous_score: 5/5
  previous_verified: 2026-11-01T19:10:00Z
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 4: Agents Verification Report

**Phase Goal:** With pi-subagents loaded, a bridged agent is listed, runs a child with the converted system prompt, tools, model, and preloaded skills, recovers when the companion is loaded later, and follows the plugin lifecycle.
**Verified:** 2026-11-03 at `fb79c80` (first verified 2026-11-01T19:10:00Z)
**Status:** passed
**Re-verification:** Yes. This run rechecks every criterion and requirement at `fb79c80` after the MCP-agent launch change (D-CF6-10, 204a8e6), the locality redesign (D-LOC-01) and the W2 guard scenario (b9f40ad). See "Re-verification 2026-11-03" below. Line references in the tables are refreshed; the 2026-11-01 run results are kept beside the new ones.

## Goal Achievement

The verifier did not rely on SUMMARY claims. It re-ran the agent cucumber folder and the agent-related unit suites on the current tree, read the shipped bridge code, and read the scenarios and the asserted texts. HEAD (`2961042`) differs from the last code commit (`ee1b1da`) only in `.planning/` documents (`git diff --stat ee1b1da HEAD`: 4 planning files), so the gate evidence on `ee1b1da` still describes the current build inputs.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | With pi-subagents loaded, its list shows each bridged agent as `<plugin>:<name>` with alias and description, nested files per FG-15 (AGT-01) | VERIFIED | `features/agent/listing.feature` (10 scenarios) compares pi-subagents' whole `subagent {action:"list"}` result in the model call log: single agent, builtins control, description fallback `Agent from <plugin> plugin`, same name in two plugins (`p1:x`, `p2:x`), nested folders, hidden and upper-case `.md`, non-`.md` ignored, declared file, flattened-name collision reported, parent-prompt advertise. Code: `discover.ts` (recursive walk, `MAX_AGENT_NAMESPACE_DEPTH = 32`, only `isDirectory()`/`isFile()` Dirents so symlinks are skipped, `lstat` on declared files), `domain/name.ts` per-segment `assertSafeName`, `convert.ts:794` fallback text, `frontmatter.ts:549` `advertise: true`. All 40 agent scenarios re-ran green (seed 455004). |
| 2 | A foreground run starts a child whose recorded system prompt is the agent body, tools and model follow the conversion rules with and without `--map-model`; `tools`, `disallowedTools`, `model`, `effort`, skill preloads and the FG-17 fields behave as upstream or carry an ID; a preloaded plugin skill's content reaches the child (AGT-02, AGT-03, XK-01) | VERIFIED | `invocation.feature` scenario 1 asserts the whole child system prompt (call 2) is `<active_agent name="demo:reviewer"/>` plus the agent body plus pi-subagents' fixed child text, and the child ran (call 3 tool result `Mission: {uuid} (completed)`). Scenario 2 asserts the child system prompt additionally holds `Base directory for this skill: {agent dir}/.../demo-helper` and the skill body with `${CLAUDE_SKILL_DIR}`/`${CLAUDE_PLUGIN_ROOT}` substituted (XK-01). Scenarios 3-4 pin that a description-less or `disable-model-invocation` skill is not inlined; scenario 5 pins update preloads the new skill version; `Tools:` scenarios pin the child's tool list and a same-name agent's own body. `frontmatter.feature` pins launch mode (`Async: false`/`true`), effort levels, `--map-model` model table, no-`--map-model` inherit, the unknown-model error for a mapped model in a run, tool splitting, `Skill(spec)`, and the apply-time guided warnings. Code: `convert.ts` (`MODEL_MAP` 5.x IDs, `opusplan` to sonnet per the amendment, `asyncSetting`, `THINKING_VALUES`), `skill-preload.ts:81-98` (eligibility rule, `Base directory for this skill:` text), `stage.ts:107` `readSkillPreloads`, wired at `install-outcome.ts:1317` and `update-swap.ts:409`. No `child_process`, `prompt-shell`, or `context-injection` import in `bridges/agents/` (grep rc=1), so inline `!` commands stay literal text. |
| 3 | A background (`async: true`) run completes on pi-subagents 0.84 with the scripted model, or the gap carries a recorded ID (AGT-04) | VERIFIED (recorded gap D-CF4-10) | No scenario launches an `async: true` run (`grep -i 'async":true' features/agent/*.feature`: no match; the only `Async: true` is the `get` field of a `background: true` agent). The gap is recorded under D-CF4-10 in `04-CONTEXT.md` and measured in `04-05-SUMMARY.md` and `04-06-SUMMARY.md`. The verifier re-checked the cause in the peer cache: `pi-subagents/src/runs/background/runner-aliases.js` maps `@earendil-works/pi-ai` to `./compat` and lists only `/compat`, `/oauth`, `/providers/all` (no `/providers/faux`), while `features/lib/scripted-model/extension.ts:24` imports `@earendil-works/pi-ai/providers/faux`. The roadmap and AGT-04 both allow closing on a recorded gap with an ID. The background runner itself was not re-run (see Human Verification, optional). |
| 4 | Without pi-subagents the install shows `{requires pi-subagents}`; loading the companion then `/reload` makes the agents available with no reinstall; project-scope agents behave as upstream in a trusted project; a scenario pins the untrusted behavior (AGT-05, AGT-06) | VERIFIED | `companion-missing.feature` (3 scenarios): install without the companion yields `warning` severity and reason `requires pi-subagents`, install with it yields none, and a new Pi with the companion lists the agent with no reinstall. `project-trust.feature` (4 scenarios): trusted project runs a project-scope plugin agent (explicit and default scope), untrusted project refuses the explicit `agentScope:"project"` run with pi-subagents' trust text, an untrusted project still runs a user-scope agent. The divergence from upstream (plugin agents run in untrusted folders) is licensed as a Pi gap under D-CF4-09. No `persistence/` or `shared/` file changed in the phase (`git diff --stat faa94a2 HEAD`), so project-scope files are not moved to user scope (SC-1). The `/reload` step is stood in by starting a new Pi with the companion (Pi cannot add an extension to a running process); the on-disk agent files exist from the install regardless of the companion, so the stand-in exercises the real recovery path (see Dubious Choices). |
| 5 | Disable, uninstall, and update remove or replace the agent in pi-subagents' list, and enable restores it (AGT-07) | VERIFIED | `lifecycle.feature` (5 scenarios): disable removes, enable restores, uninstall removes, update shows the new description, disabling one plugin keeps another plugin's agent. Each observes the list in a new session. All re-ran green. |

**Score:** 5/5 truths verified (0 present, behavior-unverified). Every lifecycle and runtime-behavior truth is backed by an executing scenario, not by symbol presence.

### Decision honoring (D-CF4-01..14 with the amendments)

| Decision | Honored | Evidence |
| --- | --- | --- |
| D-CF4-01 nested names, amended (declared folder walked, declared symlinked file refused) | Yes | `discover.ts`, `listing.feature` nested, declared, hidden/upper-case scenarios; T-04-02 symlink cases |
| D-CF4-02 same-name across plugins | Yes | `listing.feature` "Agents of the same name in two plugins", `invocation.feature` same-name run |
| D-CF4-03 fallback description | Yes | `convert.ts:794`, listing scenario |
| D-CF4-04 skill preload, amended (source `SKILL.md`, two orchestrator call sites) | Yes | `skill-preload.ts`, `install-outcome.ts:1317`, `update-swap.ts:409`, invocation scenarios |
| D-CF4-05 `async`, amended (MCP and no-tools-with-MCP exception) | Yes, amended again by D-CF6-10 (user decision A.2) | Was: an MCP agent gets no `async` line. Now (204a8e6): `async: backgroundForMcp \|\| isTrueBackground(raw.background)` (`convert.ts:961`), so an agent that runs plugin MCP tools gets `async: true` with the D-CF6-10 warning (`convert.ts:899-901`), every other agent `async: false` unless `background: true` (`isTrueBackground`, `convert.ts:1003`); `frontmatter.ts:551` emits it. Pinned by `frontmatter.feature` and `features/mcp-server/invocation.feature:204`. PROJECT.md's D-CF4-05 row still says "no `async` line" (Info below). |
| D-CF4-06 effort (`max`, `med`, lowercase) | Yes | `convert.ts` `THINKING_VALUES`, effort scenario |
| D-CF4-07 `--map-model` table, `opusplan` to sonnet | Yes | `convert.ts:57-64`, model scenarios |
| D-CF4-08 tool splitting, `Tool(spec)` by name | Yes | `convert.ts` `splitToolList`/`toolNameOf`/`isSkillToken`, tool and Skill-pattern scenarios |
| D-CF4-09 trust, amended (explicit pair pinned) | Yes | `project-trust.feature` |
| D-CF4-10 AGT-04 recorded gap | Yes | 04-05 and 04-06 SUMMARY records, zero `async: true` runs |
| D-CF4-11 companion missing (only the pi-subagents arm may change) | Yes | `shared/concerns/soft-dep.ts` not in the phase diff; `companion-missing.feature` |
| D-CF4-12 lifecycle in a new session | Yes | `lifecycle.feature` |
| D-CF4-13 listing observation, builtins hidden by a Given, control kept | Yes | `listing.steps.ts` `mergeUserSetting`, control scenario |
| D-CF4-14 `advertise: true` | Yes | `frontmatter.ts:549`, advertise scenario |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `bridges/agents/skill-preload.ts` | Skill preload reader | VERIFIED | Substantive, imported by `stage.ts:41`, called at `stage.ts:107`, data flows from skills-phase rows (`skillSources`) at both orchestrator sites |
| `bridges/agents/{convert,discover,frontmatter,stage,types}.ts`, `domain/name.ts` | Conversion, walk, emit | VERIFIED | Behavior re-proved by green scenarios and 1210/1210 unit tests (`test/bridges/agents/*`, `test/domain/name.test.ts`, `update-flow`, `update-swap`, `install-outcome`) |
| `features/agent/*.feature` (6 files, 40 scenarios) | Behavioral proof | VERIFIED | 40 scenarios, 523 steps, 16 hooks passed |
| `features/step_definitions/agent/{listing,runs}.steps.ts`, `features/lib/agent-files.ts` | Agent steps and fixture writer | VERIFIED | Used by the passing scenarios |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `install-outcome.ts` skills phase | agents stage | `c.stagedSkillRecords` to `skillSources` (l.1317) | WIRED |
| `update-swap.ts` prepare | agents stage | `handles.skills.result.recorded` to `skillSources` (l.409) | WIRED |
| `stage.ts` | `skill-preload.ts` | `readSkillPreloads` (l.107) | WIRED |
| `frontmatter.ts` emitter | pi-subagents parser | `advertise`, `async` above provenance mapping; accepted by pi-subagents (listing/advertise/Async scenarios) | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| All agent scenarios | `nondac-sh -c 'npx cucumber-js features/agent'` | exit 0, 40 scenarios and 523 steps passed, seed 455004 | PASS |
| Agent and orchestrator unit suites | `node --test test/bridges/agents/*.test.ts test/domain/name.test.ts test/orchestrators/plugin/{update-flow,update-swap,install-outcome}.test.ts` | 1210 pass, 0 fail | PASS |
| No background-run scenario | `grep -i 'async":true' features/agent/*.feature` | no match | PASS |
| No command execution in the agents bridge | `grep -rn 'child_process\|prompt-shell\|context-injection' bridges/agents/` | no match | PASS |
| Build inputs unchanged since the gate | `git diff --stat ee1b1da HEAD` | planning documents only | PASS |

The full `npm run check` was not re-run; the recorded result (exit 0, seed 17555, 1256/1256 on `ee1b1da`) applies because no build input changed after it.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| AGT-01 | 04-01, 04-06 | Listing as `<plugin>:<name>` with alias, description, nested files | SATISFIED | Truth 1 |
| AGT-02 | 04-02, 04-05, 04-06 | Foreground child with body prompt, tools, model, with and without `--map-model` | SATISFIED | Truth 2 |
| AGT-03 | 04-02, 04-06 | Frontmatter variants as upstream or recorded divergence | SATISFIED | Truth 2, decisions table |
| AGT-04 | 04-05, 04-06 | Background run completes, or gap recorded with an ID | SATISFIED (recorded gap D-CF4-10) | Truth 3 |
| AGT-05 | 04-03, 04-06 | `{requires pi-subagents}` and recovery with no reinstall | SATISFIED | Truth 4 |
| AGT-06 | 04-03, 04-06 | Project-scope trusted behavior and pinned untrusted behavior | SATISFIED | Truth 4 |
| AGT-07 | 04-04, 04-06 | Disable, uninstall, update remove or replace; enable restores | SATISFIED | Truth 5 |
| XK-01 | 04-05, 04-06 | A preloaded plugin skill's content reaches the child session | SATISFIED | Truth 2 |

All eight IDs appear in plan `requirements:` frontmatter and in the SUMMARY `requirements-completed` lists, and all eight are mapped to Phase 4 in REQUIREMENTS.md. No orphaned requirement. The REQUIREMENTS.md checkboxes and traceability rows and the ROADMAP phase checkbox still read pending; the orchestrator updates them with the phase close.

### Prohibitions (plan `must_haves.prohibitions`, all resolved in the plans)

| Prohibition | Status | Evidence |
| --- | --- | --- |
| No silent drop of a plugin agent (flattened duplicate named) | Held | listing scenario "reported as skipped" |
| No silent drop of a field Claude Code reads | Held | `frontmatter.feature` guided-warning scenario |
| No background run unless asked | PASSED (override) | Held for every agent without plugin MCP tools (`Async: false` default pinned). An agent that runs plugin MCP tools now launches in the background by the user's A.2 decision (D-CF6-10); see the override in the frontmatter. |
| No project agents written to user scope to pass trust | Held | no `persistence/` change; untrusted pair pinned |
| No pin of pi-subagents' trust-blind list as desired | Held | not pinned; report drafted, not filed |
| No install failure for a missing companion | Held | companion-missing scenario 1 (install succeeds with a warning) |
| No disabled/uninstalled agent left in the list | Held | lifecycle scenarios |
| No hidden skill in an agent prompt | Held | invocation scenarios 3-4 |
| No inline `!` execution | Held | no process-spawn import in `bridges/agents/` |
| No background-run scenario | Held | grep above |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX` in the phase's source, feature, or step files. The source-code review (04-REVIEW.md, iteration 2) has 0 critical and 0 warning findings; WR-01 was fixed in `ee1b1da` with a red-then-green scenario.

### Advisory (not blocking)

| # | Finding | Category | Note |
| --- | --- | --- | --- |
| 1 | IN-01: a full `claude-*` ID keeps a `[1m]` suffix under `--map-model`, an alias drops it | parity | Deferred in 04-REVIEW-DISPOSITION; parent decides |
| 2 | IN-02: fallback thinking warning quotes the raw effort | cosmetic | Deferred |
| 3 | IN-03: an agent file named `.md` or an unsafe folder name now fails the whole install | robustness | Deferred; upstream behavior not measured |

### Human Verification Required

None required. One optional manual check is recorded in `04-VALIDATION.md` (a real-provider background run on pi-subagents 0.84). It is not a success criterion, because AGT-04 permits closing on the recorded gap.

### Gaps Summary

No gaps. The phase goal is achieved: the agent list, the child run with the converted prompt, tools, model, and preloaded skill content, companion-missing recovery, project trust, and the lifecycle are all proved by executing scenarios that re-passed in this verification. AGT-04 closes on a permitted recorded gap (D-CF4-10) whose cause was re-checked in the pi-subagents source.

### Parent lines (follow-ups, not gaps)

- File the drafted pi-subagents report (the list ignores project trust) and the drafted gap notes (no first-message hook for skill preload; detached runner aliases `@earendil-works/pi-ai` to `./compat`). The phase filed nothing.
- Warn sibling phases that `advertise: true` changes every parent system prompt with pi-subagents loaded (D-CF4-14); re-verify whole-prompt comparisons at merge.
- Phase 6 / MCP-07: the stale ANAME-02 "cannot narrow" warning (pi-subagents applies `excludeTools` beside `tools`).
- Update REQUIREMENTS.md and ROADMAP.md checkboxes for Phase 4.
- `04-DUBIOUS-CHOICES.md` has an uncommitted working-tree modification at verification time; the orchestrator commits it.


## Re-verification 2026-11-03

**Why stale:** `verification.status` named `features/agent/lifecycle.feature`. Five covered files changed after the 2026-11-01 report:

- `features/agent/lifecycle.feature` (b9f40ad, DC-44 item 1, W2): a sixth scenario, "An install that fails in its mcp phase leaves no agent of the plugin in the list" (l.114). A directory blocks the user `mcp-adapter.json`, so the install of `tools` fails in its mcp phase; a new session lists only `demo:reviewer`. It strengthens SC5/AGT-07: a failed install leaves no agent behind. It passes.
- `bridges/agents/convert.ts` (204a8e6, user decision A.2, D-CF6-10): an agent that runs plugin MCP tools now gets `async: true` and a reworded warning, where D-CF4-05 as amended gave it no `async` line. This touches SC2 ("`model`, `effort`, ... and the FG-17 fields behave as upstream or carry an ID"): `background` to `async` now carries D-CF6-10 beside D-CF4-05, so SC2 still holds. It breaks the 04-02 prohibition "MUST NOT run a bridged agent in the background when ... does not ask for it" for MCP agents only. The user decided that (A.2), so I carry it as an override with the A.2 date and signer, the same decision Phase 6 carries for SC4/MCP-07. The override was not separately signed for Phase 4, so the parent should confirm it with the user.
- `features/step_definitions/agent/listing.steps.ts` (204a8e6): a new Then, "the agents folder of the {word} scope holds the file {string} with this text:", used by the Phase 6 staging scenario. No Phase 4 step changed.
- `orchestrators/plugin/install-outcome.ts` and `update-swap.ts` (940b4af..5ecd962, net +2 lines each): the project ledger was added (D-CF3-07) and then removed by D-LOC-01, and 41deffd passes `workflowNames` to the commands stage. The agents stage call is untouched; its `skillSources` lines moved to l.1317 and l.409.

**The locality redesign does not change agents.** D-LOC-01 gates project skills, commands, aliases, the command tool, skill-read fill and hooks on `ctx.isProjectTrusted()`. Project agents stay gated by pi-subagents' own project trust (D-CF4-09), and they are staged in `<cwd>/.pi/agents/`, inside the project. `features/agent/project-trust.feature` (4 scenarios) is unchanged and passes.

**What I rechecked at `fb79c80`:**

| Check | Result |
| --- | --- |
| All agent scenarios, `npx cucumber-js features/agent` (companion-missing 3, frontmatter 9, invocation 9, lifecycle 6, listing 10, project-trust 4) | 41 scenarios, 541 steps passed (seed 120952) |
| MCP agent staging (D-CF6-10) through Phase 6's `features/mcp-server/invocation.feature:204` | passed, in `features/mcp-server` 55/55 |
| `node --test test/bridges/agents/*.test.ts test/domain/name.test.ts test/orchestrators/plugin/{update-flow,update-swap,install-outcome}.test.ts` | 1212 pass, 0 fail |
| No background-run scenario in `features/agent` (`grep -il 'async\":true' features/agent/*.feature`) | no match |
| No process spawn in `bridges/agents/` (`child_process`, `prompt-shell`, `context-injection`) | no match |
| Full gate | reused, not re-run: `npm run check` exit 0 at `ab28834` (cucumber 1539/1539, seed 516814); `fb79c80` changed only the audit |

All five roadmap criteria and AGT-01..07 and XK-01 hold. AGT-04 still closes on the recorded gap D-CF4-10: no agent scenario launches a background run, and the MCP agents that now get `async: true` are staged, not run (Phase 6's MCPBG-01).

**Info for the parent (record lag, not gaps):**

- `.planning/PROJECT.md:1813` (D-CF4-05) still says "an agent that runs MCP tools gets no `async` line". Since 204a8e6 it gets `async: true` (D-CF6-10).
- `.planning/PROJECT.md:1807` (D-CF6-10) still says "Phase verification is `human_needed` on this pin"; Phase 6 closed `passed` with an override.
- `bridges/agents/frontmatter.ts:487` says `async` is emitted "only when set". `convertAgent` now always sets it, so every bridged agent file has an `async:` line. The code is correct; the comment is old.

**Covered files.** None was deleted, none added. The digest is recomputed.

**Verdict:** still passed, 5/5 roadmap criteria. One plan prohibition is carried as an override under the user's A.2 decision. No gap.

---

_Verified: 2026-11-03 (re-verification at `fb79c80`; first verified 2026-11-01T19:10:00Z)_
_Verifier: Claude (gsd-verifier)_
