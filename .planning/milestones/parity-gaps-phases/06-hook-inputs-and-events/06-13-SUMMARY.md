---
phase: 06-hook-inputs-and-events
plan: "13"
subsystem: docs
status: complete
tags: [docs, hooks, changelog, user-prompt-expansion, child-session]
requires: ["06-01", "06-02", "06-03", "06-04", "06-05", "06-06", "06-07", "06-08", "06-09", "06-10", "06-11", "06-12"]
provides:
  - "docs/hooks-compatibility.md: the hook inputs, the child's session, the UserPromptExpansion event, and the launch sources as built"
  - "docs/env-vars.md: the child note on CLAUDE_CODE_SESSION_ID (D-PG6-01)"
  - "docs/output-catalog.md: the UserPromptExpansion block and stop notices in the hook-notice prose"
  - "CHANGELOG.md: six sub-bullets under the first Unreleased bullet"
affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - docs/hooks-compatibility.md
    - docs/env-vars.md
    - docs/output-catalog.md
    - CHANGELOG.md
    - features/plugin/subagent-child.feature
decisions:
  - "The page states what the tree does, not the plan's expectation: --fork reads fork, a continued fork reads resume, a nested child names its launcher (one hop), and a child with no root source or no identity keeps its own session."
  - "The catalog prose names the dispatcher's block notice and the event adapters' stop notice, as built, rather than both from the event adapters."
metrics:
  duration: "about 40 min"
  completed: 2026-11-15
estimate:
  tokens: 74000
actuals:
  tokens: 44382
  tasks: 3
  commits: 3
plan_head_before: 8719151a5c0a85a285f0749b84dbdcb2035e563c
plan_head_after: ac38844e0beb04501afb4c4737a9da66985ecbf6
---

# Phase 6 Plan 13: Docs, CHANGELOG, and consolidated records Summary

The hook compatibility page now states the tool fields the bridge sends (`tool_use_id`, `duration_ms`, `mcp_server`, `effort`), the session fields (`custom_instructions`, `model`, `session_title`), why `permission_mode` is not sent, which session a child's tool hook names, the new `UserPromptExpansion` event, and the `resume` and `fork` sources of a Pi launch. The catalog prose, the CHANGELOG, and one feature description follow.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 06-13-01 | `42606c3c` | docs(hooks): state the new hook inputs, child session, and expansion (2 files, +163/-96) |
| 06-13-02 | `be229ad1` | docs(hooks): record the expansion notices and the new hook inputs (2 files, +7/-1) |
| 06-13-03 | `ac38844e` | docs(hooks): say a child's tool hooks name the launching session (1 file, +1/-1) |

`git rev-list --count 8719151a..HEAD` = 3. Before each commit: `SKIP=npm-check pre-commit run --files <task files>`. For task 1, mdformat re-aligned the tables on the first pass and the second pass exited 0. Tasks 2 and 3 passed on the first pass. Each commit was made with `git add <paths>` and `git commit -F - -- <paths>`. Commit 3's hook ran `npm run check:commit ... Passed` (a feature file is a build input); the docs commits skipped it. No `--amend`, `--no-verify`, stash, or `git add -A`. No commit deletes a file. `.planning/STATE.md` (the orchestrator's change) was never staged.

## Verification

| Command | Result |
| --- | --- |
| `SKIP=npm-check pre-commit run --files docs/hooks-compatibility.md docs/env-vars.md` | exit 1 (mdformat changed files), then exit 0 |
| The five stale greps of task 1 (`not decided yet`, `Pi has no effort surface`, `different pipeline`, `not sent (D-CF5-28)`, `the test harness cannot launch Pi this way`) | all 0 |
| Task 1 counts | `UserPromptExpansion` 20, `command_name` 7, `mcp_prompt` 1, `permission_mode` 2, `custom_instructions` 2, `session_title` 3, `D-PG6-` 29; `D-PG6-01` in env-vars.md 1 |
| `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/architecture/hooks-notice-notify.test.ts test/architecture/hooks-cap-notify.test.ts test/architecture/catalog-uat/catalog-contract.test.ts test/architecture/catalog-uat/catalog-parser.test.ts test/architecture/catalog-uat/catalog-wire.test.ts` | exit 0, 83 tests, 83 pass, 0 fail, 0 cancelled |
| `SKIP=npm-check pre-commit run --files docs/output-catalog.md CHANGELOG.md` | exit 0 |
| Task 2 counts | `UserPromptExpansion` in output-catalog.md and CHANGELOG.md ≥ 1, `tool_use_id` in CHANGELOG.md 1. `git show be229ad1 -- docs/output-catalog.md`: one paragraph line changed, no fenced block or marker line |
| `npm run check:features` | exit 0 |
| `npm run test:cucumber:profile -- --profile adapter features/hook/tool-failure.feature features/plugin/subagent-child.feature` | exit 0, 32 scenarios (32 passed), 451 steps (451 passed) |
| Task 3 counts | `D-PG6-04` in tool-failure.feature 1, `D-PG6-01` in subagent-child.feature 1, `D-BG-403` in tool-failure.feature 0 |

Scenario counts (`grep -c Scenario`), before and after task 3: features/plugin/subagent-child.feature 15 and 15, features/hook/tool-failure.feature 14 and 14. No scenario, step, table, or tag changed. Node v26, Linux. I did not run `npm run check`; the orchestrator runs the wave gate.

## What the page states, and the plan's statements it corrects from the summaries

- **Tool fields** (stdin table, rows `tool_use_id`, `duration_ms`, `mcp_server`, `effort`): `tool_use_id` on the three tool events, `<id>#<n>` per pair of a multi-pair Edit, the bare id for one pair, a nested call's `<parent>/<n>` kept, and a result run that numbers the pairs of its own input (06-02). `duration_ms` from the end of the bridge's `PreToolUse` handler to the start of its result handler, with other extensions' handler time inside it, a batch counted from its last top-level mark, and no field without a mark (06-04). `mcp_server` as `{"name": "plugin:<plugin>:<server>", "source": "plugin"}` under both MCP implementations, left out for an MCP tool of no plugin, a cut adapter name with no recovered full name, and a name two servers claim (06-05). `effort` on the three tool events, `Stop`, and `StopFailure`, levels `low` to `max`, none for `off`, `minimal`, or no level (06-11, with findings F1 and F2). The `error` row says `duration_ms` is sent, and the projection paragraph no longer lists execution timing.
- **Session fields**: `custom_instructions` (null for an automatic compaction and for a manual one with no or empty text, 06-06), `model` and `session_title` on `SessionStart`, `session_title` on `UserPromptSubmit`, and `permission_mode` not sent with its reason and the rejected `default` (D-PG6-11).
- **Child identity**: the root rule as 06-07 and 06-09 built it, the two sources and their disagreement, the variable-only case, the fallback (no source or no identity keeps the own session), the debug line, one hop for a nested child, the internal keys on the own session, and the Bash difference. Evidence names the real-child scenarios, the integration test, `child-root-session.test.ts`, and `translation-context.test.ts`.
- **UserPromptExpansion**: a supported row in the Events table, a row in the child table ("does not run"), the upgrade note beside the Events table, the subsection (lines, order, fields, `command_source`, `mcp_prompt` never sent, matcher, answers, differences, evidence), the matcher row, plain stdout, the Additional context row and order sentence, the cap bullet, the label list, and the notice list, whose count is now twelve (one new block entry; the stop joins the existing `UserPromptSubmit` stop entry).
- **Session events**: four launch rows in place of the D-CF5-06 row (`resume` for `--continue` and `--session`, `fork` for `--fork`, `resume` for a continued fork, `startup` for `--continue` with no saved session), and a paragraph with the detection rule, the read-failure fallback (06-03 amendment, commit `0d07e530`), Pi 1.5.0 and 1.5.2, and the scenario names. `PreCompact` in Compaction gains `custom_instructions`.
- **Environment variables**: the `CLAUDE_CODE_SESSION_ID` row in both files and the `CLAUDE_EFFORT` row (not set; stdin `effort`; the `${CLAUDE_EFFORT}` mapping of `off`/`minimal` to `low`).

Deviations of earlier plans that the page follows: `--fork` reads `fork` and a continued fork reads `resume` (06-03, the fork test held in the spike); the throwing launch read keeps `startup` and still dispatches (06-03 amendment); a nested child names its launcher (06-07, one hop); a child with no root source or no identity keeps its own session (06-09); `effort` is not on `UserPromptSubmit` and passes `max` (06-11, F1/F2); a bridged command keeps its Pi name and `prompt` is rebuilt from the Claude-form name (06-08, 06-12).

## Stale-statement search (task 06-13-03)

| Search | Hits | Action |
| --- | --- | --- |
| `D-CF5-28`, `D-BG-403` in extensions/, test/, features/ | none | none (06-05 already corrected tool-failure.feature) |
| `HOOKPAYLOAD-01`, `HOOKLAUNCH-01`, `CHILDSESSIONID-01` in the same trees | none | none |
| A comment that counts ten hook events or thirteen registrations | none; `event-router.ts:1234` and `index.ts:75,153` already say 14 `pi.on` call sites (06-10, 06-12); the only "thirteen" hits are two unrelated test titles in test/shared/notification-grammar.test.ts | none |
| features/hook/tool-failure.feature description | already reads "The payload carries `tool_use_id` and `duration_ms`, and `mcp_server` for a tool of a plugin's MCP server (D-PG6-04, D-PG6-07)" (06-05, commit `7e9aca4b`) | not changed |
| features/plugin/subagent-child.feature description | "A child's tool hooks name its agent and session (D-PG3-06)" | changed in `ac38844e` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Accuracy] Rows that list events gained `UserPromptExpansion`**
- The "Other exit -> non-blocking" row, the `continue: false` row, the Additional context order sentence, and the 10,000-character cap bullet each list the events where a behavior applies. The plan named neither row, but each would read false by omission (06-10: `showsFailures` true, the stop answers `handled`, the context drains after the `UserPromptSubmit` part, the cap applies to plain stdout). Commit `42606c3c`.

**2. [Rule 1 - Accuracy] The catalog prose names the notices as built**
- The plan said "the event adapters show both". The block notice comes from the dispatcher (`dispatch.ts`, `promptBlockedText`, the module the catalog already names), and the stop notice from `event-adapters.ts`. The prose says the event adapters show the `UserPromptExpansion` stop notice and leaves the block notice under the paragraph's dispatcher sentence. Commit `be229ad1`.

**3. [Scope] features/hook/tool-failure.feature not changed**
- Plan 06-05 already rewrote the sentence and cites D-PG6-04 and D-PG6-07, so the three acceptance greps hold at HEAD. Commit 3 holds the one other feature file only.

**4. [Wording] No finding ID on the page**
- The plan asked to cite "finding F12" for the child's Bash variable. F12 is a research record ID that a reader of the page cannot resolve, so the page states the difference and calls it open for a maintainer decision, and the D-PG6-01 citation sits on the env rows. Likewise the page says "measured on Pi 1.5.0 and Pi 1.5.2" rather than naming the spike.

**5. [Wording] The subagent-child description adds "when the launch names it"**
- The plan's sentence would read as true for the stand-in children, which keep their own session because no source names a launcher. The added clause keeps it true for every scenario in the file.

**6. [Wording] Missing-script rule on the new event**
- The plan listed "an exit 2 of a missing script blocks on this event" among the differences. 06-10 records that upstream's missing-script rule does not cover the event either, so the page states it as upstream behavior, not a difference.

## Flagged assumptions

- The CHANGELOG sub-bullets follow the `changelog` skill: six sub-bullets (the plan's five, with the tool fields split from `effort`, because one sentence held too many fields), no decision ID, one sentence each, a second only for the update/reinstall action.
- The heading "Current tool contract (Phase 2, 2026-11-13)" and the page's "Claude Code 2.1.316" line were left as they are (plan: maintainer's choice).
- `docs/json-output.md`, `docs/prd/`, and `docs/research/` were not changed (plan).
- The CHANGELOG's expansion line says "a plugin command or a skill"; the page says the hooks also run for the user's own templates and skills.

## Records for the orchestrator (parent-owned lines, not applied)

This plan edits no parent-owned file. The lines of the whole phase, consolidated:

- **PROJECT.md Key Decisions.** Decision 9 done: the missing stdin fields are sent (D-PG6-04 to D-PG6-10; Claude Code 2.1.323, Pi 1.5.0, pi-mcp-adapter 7.x). Decision 25: `permission_mode` is not sent (D-PG6-11). Decision 26 settled: a child's tool hook names the session that launched it (D-PG6-01 to D-PG6-03; pi-subagents 0.88.x), with the planner's limits: one hop for a nested child, nothing published on `process.env`, and a child with no agent identity keeps its own session. Every D-PG6 decision is "pending maintainer review".
- **PROJECT.md Key Decisions, parent-line text (exact):**
  - "D-PG6-01 (pending maintainer review): in a pi-subagents background child whose identity is known, a tool hook's `session_id`, `transcript_path`, `CLAUDE_CODE_SESSION_ID`, and `CLAUDE_SESSION_ID` name the session that launched the child, and `agent_id` names the child (Claude Code 2.1.323 docs and binary; pi-subagents 0.87.0 read, 0.88.1 run). A child with no root source, or whose identity is unavailable, keeps its own fields, so a payload with the launching session's id always carries `agent_id`. A nested child names the child that launched it (one hop)."
  - "D-PG6-02 (pending maintainer review): the root comes from `PI_SUBAGENT_PARENT_SESSION` (the id; a value holding a path separator is no id) and the child session header's `parentSession` (the file, whose first-line header id must equal the variable when readable), one hop, with the child's own session as the fallback and one debug line."
  - "D-PG6-03: only the fields a hook reads change; the `CLAUDE_ENV_FILE` name, a child's journal owner, and the identity guard stay on the child's own session id."
  - "D-PG6-04 (pending maintainer review): send the missing stdin fields (Claude Code 2.1.323, Pi 1.5.0); supersedes D-CF5-28 and D-BG-403."
  - "D-PG6-05: `tool_use_id` is Pi's `toolCallId`; each pair of a multi-pair Edit gets `<toolCallId>#<n>`, counted from 1, and a one-pair Edit keeps the bare id."
  - "D-PG6-06 (pending maintainer review): the bridge times a call from the end of its `tool_call` handler to the start of its `tool_result` handler, counting a call from the later of its own mark and the last top-level mark of its batch; Pi 1.5.0 gives no start mark that excludes hook time."
  - "D-PG6-07 (pending maintainer review): `mcp_server` is `{name: \"plugin:<plugin>:<server>\", source: \"plugin\"}` for a plugin MCP tool under both MCP implementations (key form read in Claude Code 2.1.323); left out for a non-plugin MCP tool."
  - "D-PG6-08: `PreCompact` carries `custom_instructions`, the `/compact` text for a manual compaction, else `null`."
  - "D-PG6-09 (pending maintainer review): `SessionStart` carries `model` (bare id) and `session_title`; `UserPromptSubmit` also carries `session_title`; each left out when Pi has none."
  - "D-PG6-10 (pending maintainer review), amended by findings F1 and F2: `effort` `{level}` on `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`, and `StopFailure` (not `UserPromptSubmit`); Pi `max` passes as `max`; `off` and `minimal` send none."
  - "D-PG6-11 (pending maintainer review): `permission_mode` is not sent; Pi has no permission modes; Claude Code 2.1.323 types it optional; the rejected alternative is the constant `default`."
  - "D-PG6-12: the runs step projects `tool_use_id` as `{tool use <n>}` (pairs `{tool use <n>}#<m>`), `duration_ms` as `{milliseconds}`, and a session file as `{session file}`."
  - "D-PG6-14 (pending maintainer review): a launch whose Pi reason is `startup` and whose session holds a `message` entry sends `SessionStart` `source` `resume`; read from `ctx.sessionManager.getEntries()` only; a throwing read keeps `startup` and still dispatches. Spike S7 on Pi 1.5.0 and 1.5.2."
  - "D-PG6-15 (pending maintainer review): a launch whose header names `parentSession` and whose header `timestamp` is not older than `performance.timeOrigin` sends `fork`; the fork test runs before the resume test, and a continued fork reads `resume`. Spike S7 on Pi 1.5.0 and 1.5.2."
  - "D-PG6-18 (pending maintainer review): `UserPromptExpansion` runs in a second `input` handler of the hooks bridge, registered directly after the `UserPromptSubmit` handler, for input whose source is not `extension`, for a line the injected typed-line resolver names, only when a hook is routed, and never in a pi-subagents child; a blocked prompt runs no expansion hook, and the hooks see the line before any alias rewrite."
  - "D-PG6-19 (pending maintainer review): the matcher selects on `command_name` by the tool-matcher rules with no tool name map; the stdin holds `expansion_type` `slash_command`, `command_name` (Claude-form for a bridged skill, the Pi name for a bridged command, the bare name otherwise), `command_args` (`\"\"` with none), `command_source` (`plugin`, `userSettings`, `projectSettings`, absent for a temporary item), and `prompt` rebuilt as `/<command_name>[ <args>]`; no `effort`, `permission_mode`, or `session_title`."
  - "D-PG6-20 (pending maintainer review): an expansion block or `continue: false` answers `handled`; the block notice is `UserPromptExpansion operation blocked by hook:` and the reason on the next line, without Claude Code's `Original prompt:` part; the stop shows `Operation stopped by hook[: <stopReason>]`; a context reaches the model after the prompt's part as `UserPromptExpansion hook additional context: <values>`."
  - "D-PG6-21: `UserPromptExpansion` is an admitted event; a plugin that needed `--partial` only for it no longer does; an installed plugin whose group was dropped at install gets it at its next `update` or `reinstall`; a load rewrites no installation state."
  - "D-PG6-22: `expansion_type` is never `mcp_prompt`; Pi has no slash surface for MCP prompts."
  - "D-PG6-23: the compatibility page, the env-vars note, the output catalog prose, and the CHANGELOG state the phase as built."
- **Superseded and amended.** D-CF5-28 and D-BG-403: superseded by D-PG6-04. D-CF5-06: amended by D-PG6-17, deferred to done. D-PG6-10: amended by findings F1 (no `effort` on `UserPromptSubmit`) and F2 (`max` passes). D-PG6-02: amended by findings F3 and F4.
- **BACKLOG.md.** Close HOOKPAYLOAD-01, HOOKLAUNCH-01, and CHILDSESSIONID-01 when the phase verifies. New lines: `mcp_server` for an MCP tool of no plugin; the root session in a child's Bash environment (F12); the root of a nested child; the Claude Code name of a bridged command in `command_name` (PG-CMD-09 covers the alias); a refusal when the plugin name table cannot be loaded; `expansion_type` for MCP prompts if Pi gets a slash surface for them. HOOKRESULT-01: execution timing is no longer missing (`duration_ms`). HOOKENV-01: the stdin field `effort` is sent, the `CLAUDE_EFFORT` variable stays deferred. HOOKHEAL-01: an installed plugin whose `UserPromptExpansion` group was dropped gets it at its next `update` or `reinstall`.
- **REQUIREMENTS.md.** PG-HOOK-04, PG-HOOK-06, and PG-HOOK-11 to done when the phase verifies.
- **`.planning/codebase/`.** ARCHITECTURE.md: 14 `pi.on` call sites of the hooks bridge, the second `input` registration and its injected resolver, `orchestrators/typed-expansion.ts`, the plugin name table and its cache, `bridges/hooks/child-root-session.ts`, `bridges/hooks/mcp-server-table.ts`, `bridges/hooks/payloads/tool-event-facts.ts` and `user-prompt-expansion.ts`, and the hook-facing session beside the own session in the dispatch context. CONVENTIONS.md and TESTING.md: the `fallow-ignore` count if it moved, the run tokens of the hook steps, the saved-session launches of the harness, and the new feature file.
- **Skill rules.** `.agents/skills/cucumber`: the tokens `{tool use <n>}`, `{milliseconds}`, and `{session file}`, the launch kinds of a saved session, and the file `features/hook/prompt-expansion.feature`, if its rules list tokens or files.
- **`docs/prd/parity-gaps-prd.md`.** Section 9, row S7: the result, filled by plan 06-01.
- **`.planning/phases/03-background-subagents/03-VERIFICATION.md`** (from 06-09): the unclassified PG-HOOK-07a row (a child's `session_id` equal to its `agent_id`) is closed by decision 26 (D-PG6-01).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-30 (mitigate): each statement on the page comes from the summary of the plan that built it, and the page names every residual: an installed plugin's dropped `UserPromptExpansion` groups (Events section, upgrade note; CHANGELOG sub-bullet), the events that do not run in a child (child table row), the name differences of a bridged command (expansion subsection), and the fallback of a child's session (Child identity). T-06-SC: no package installs or version changes.

## Self-Check: PASSED

- FOUND: docs/hooks-compatibility.md, docs/env-vars.md, docs/output-catalog.md, CHANGELOG.md, features/plugin/subagent-child.feature
- FOUND: 42606c3c, be229ad1, ac38844e (ancestors of HEAD)
- Working tree after the commits: only the orchestrator's `.planning/STATE.md` change and this SUMMARY.
