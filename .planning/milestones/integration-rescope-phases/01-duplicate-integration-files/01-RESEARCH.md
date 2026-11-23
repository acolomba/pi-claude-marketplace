# Phase 1: Duplicate Integration Files - Research

**Researched:** 2026-11-21
**Domain:** Behavioral test coverage (cucumber-js over real Pi processes) of the hooks bridge spawn path and pi-subagents child hook identity; deleting two `node:test` integration files
**Confidence:** HIGH (every break below was run in this session against the real scenarios, then reverted)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

(Copied verbatim from `01-CONTEXT.md` `## Implementation Decisions` / `### Decided autonomously`.)

- [ITDUP-01 breaks] Q: "Which behaviors of hooks-spawn-end-to-end must a deliberate break prove covered before the file goes?" → Selected: "Five, one break at a time: (1) the SessionStart handler is spawned and its side effect lands; (2) `${CLAUDE_PLUGIN_ROOT}` in a hook command resolves to the record's real plugin root, not a synthesized path under the extension directory; (3) the declared hook `timeout` is read as seconds, not milliseconds (HOOK-E2E-02 declares 30 and sleeps 0.3 s); (4) a plugin whose root lies outside the extension directory still spawns its hooks (HOOK-E2E-05: no containment check against the extension root in `bridges/hooks/dispatch-exec.ts` or `bridges/hooks/async-rewake/registry.ts`); (5) a user-scope plugin's SessionStart hook still runs when the project scope records nothing (the cross-scope wipe regression the file names)" — test approach only; every break is reverted and never committed.
- [ITDUP-01 breaks] Q: "Which scenarios run under each break?" → Selected: "`plugin/session-start-hooks.feature` (its hook runs `node '${CLAUDE_PLUGIN_ROOT}/session-start.cjs'` from a dir-source plugin outside the extension directory) and the `features/hook/` scenarios that the planner finds for each break (for example `hook/failures.feature`, `hook/session.feature`, and the scenarios with `timeout` and `sleep` columns), under both profiles; the plan's SUMMARY.md records each break, the command that ran, and the scenario that failed" — choosing which scenarios to run is local to the plan.
- [ITDUP-01 gaps] Q: "What happens when a break fails no scenario?" → Selected: "The phase adds a scenario to `plugin/session-start-hooks.feature` that fails under that break, then deletes the file. For break (3) such a scenario declares a timeout whose millisecond reading is shorter than the hook's work and whose seconds reading is far longer, and expects the run to be recorded" — matches the ROADMAP note for Phase 1; a scenario is cheap to change later.
- [ITDUP-02 scenario] Q: "Where does the empty-body child scenario go?" → Selected: "`plugin/subagent-child.feature`, beside 'A real background child runs its plugin tool hooks and completes', tagged `@mcp` because its plugin has a stub MCP server, so it runs under both profiles (D-BG-04, DUAL-02)" — moving a scenario between feature files is cheap.
- [ITDUP-02 scenario] Q: "What does the scenario launch and check?" → Selected: "pi-subagents with its async-by-default setting unset, so its own default detaches the child (D-PG3-01); one ordinary agent `plain` with no background setting, the tools `Bash, Read`, no MCP grant, no launch mode in the call, and an empty body; the calls `bash, failing read`. Then: the child ran in background mode and completed with its own runner process and session; its PreToolUse and PostToolUse runs of `Bash` and its PreToolUse and PostToolUseFailure runs of `Read` carry agent type `demo:plain` and the child's agent id, with the main session in `session_id` (D-PG6-01); no main-session run names a child; and the main session's control-prompt runs carry no child identity" — it mirrors the integration case it replaces; rows are cheap to change.
- [ITDUP-02 harness] Q: "How does the real-child step get an empty body?" → Selected: "`parseRealChildAgents` in `features/lib/real-subagent-child.ts`, a shared library file that the plan names, also accepts a table with a fifth `body` column; a table without that column keeps today's body 'Run the tools the task names.', so no existing table changes. The scenario must show a reader that the body is empty without opening a step definition" — an internal harness shape.
- [ITDUP-02 breaks] Q: "Which cases of pi-subagents-child-identity need a deliberate break before the file goes?" → Selected: "All four, each mapped to the scenario that must fail: the detached children of a background agent and an MCP agent ('A real background child runs its plugin tool hooks and completes', both profiles); the ordinary empty-body child (the new scenario, both profiles; one break should hit an empty-body launch tag specifically, if the identity reader treats the body separately); the foreground default ('Explicit background and MCP grants keep a child in the background' in `agent/frontmatter.feature`); and the concurrent children of one runner process ('Concurrent companion children keep separate hook identities'). The researcher finds where the identity is read (`bridges/hooks/`, the child prompt section pi-subagents writes) and picks each break" — test approach only.
- [References] Q: "What happens to the docs that cite the deleted files?" → Selected: "`docs/mcp-compatibility.md` (three citations of `pi-subagents-child-identity.test.ts`, near lines 495, 527, and 770) and `docs/hooks-compatibility.md` (one, near line 77) cite the new and existing scenarios instead, in the same plain style; planning records under `.planning/` keep their history" — doc wording is cheap to change.
- [Helpers] Q: "What happens to code that only the deleted files used?" → Selected: "Any export or module under `test/` or `features/lib/` that nothing imports after the deletion goes with it (checked with fallow, `npm run check:features`, and the typecheck); `features/lib/real-subagent-child.ts` stays because the subagent steps use it" — deleting dead helpers is local.
- [Process] Q: "Does this phase edit CHANGELOG.md, BACKLOG.md, or the PROJECT.md Key Decisions table?" → Selected: "No CHANGELOG entry: the change is test-only, and the milestone's PR handoff decides on its one bullet. BACKLOG.md only under rule 4. This autonomous run executes phases one after another in one session, so a phase edits those files itself when it must, instead of listing Parent lines" — reversible process choice.
- [Gate] Q: "How are the checks scheduled?" → Selected: "As the local-verification skill says: focused `npm run test:cucumber:profile -- --profile <adapter|builtin> <paths>` runs of the touched features under both profiles while editing, and `npm run check` at the phase gate, all through the non-DAC wrapper below" — scheduling only.

### Claude's Discretion

- Scenario titles and step wording, within the cucumber skill's rules.
- The exact code edit of each deliberate break, as long as SUMMARY.md records it and it is reverted.
- Plan count and wave split (the phase is small: likely one plan for ITDUP-01 and one for ITDUP-02, which can run in parallel because they touch disjoint files, apart from the docs).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ITDUP-01 | `test/integration/hooks-spawn-end-to-end.test.ts` is deleted, after the phase confirms that the hook scenarios cover the SessionStart side effect and a `CLAUDE_PLUGIN_ROOT` outside the extension directory (HOOK-E2E-05). | Experiments E1 to E5: every one of the five locked breaks fails at least one existing scenario. No new scenario is needed. See "ITDUP-01 break map". |
| ITDUP-02 | A scenario covers a pi-subagents child of an agent with an empty body, and the failing read in the ordinary launch case. Then `test/integration/pi-subagents-child-identity.test.ts` is deleted. | The proposed scenario was run in a scratch file with a temporary harness patch: green under both profiles, and red under four identity breaks (E7 to E10). The empty-body tag path itself is guarded by the concurrent scenario, not by the new one (E6). See "ITDUP-02 break map". |
</phase_requirements>

## Project Constraints (from AGENTS.md)

The repo keeps its instructions in `./AGENTS.md` (no `CLAUDE.md`). The directives that bind this phase:

- Read a file before editing it; trace a function's callers before changing it.
- Never commit to `main`; never rebase or rewrite history; commit as `.agents/skills/committing/SKILL.md` says; never `--no-verify`.
- Every plan `SUMMARY.md` has a `## Threat Flags` section, even when it is "None".
- GSD gates run `npm run check` on the combined tree (post-merge wave gate, phase gate). A passing commit hook is not a full verdict.
- A change to `/claude:plugin` behavior a user can see ships with a cucumber scenario. This phase changes no product behavior (rule 4 aside).
- Upstream parity: a scenario expects Claude Code's behavior or names the ID that licenses a divergence. The new scenario pins D-PG3-01, D-PG6-01, D-PG3-08, which are already recorded.
- `npm run check` must stay green: typecheck, ESLint, fallow, Prettier, pairing, `check:features`, unit, integration, cucumber (both profiles), direct coverage.
- Comments and test titles name no phase, plan, wave, or pitfall numbers (typescript-style `rules/comments.md`).
- `gsd-tools windows append --description` gets the `[integration-rescope]` prefix.

## Summary

Both integration files are duplicates, and this session proved it by breaking each behavior and watching scenarios fail. For `hooks-spawn-end-to-end`, all five locked breaks fail existing scenarios: the SessionStart dispatch, the plugin-root value, and a re-added containment check each fail both scenarios of `plugin/session-start-hooks.feature`; the milliseconds reading of `timeout` fails four `features/hook/` scenarios (a declared 1 s timeout read as 1 ms kills the hook before it records its run); and the cross-scope wipe fails two user-scope `hook/session.feature` scenarios and two real-child scenarios. So ITDUP-01 needs no new scenario. It only needs the recorded breaks and the deletion.

For `pi-subagents-child-identity`, three of its four cases already have matching scenarios. The fourth, the ordinary agent with an empty body and a failing read, needs the new scenario that CONTEXT locks. A temporary patch of `parseRealChildAgents` that accepts an optional `body` column, plus the proposed scenario in a scratch feature file, passed under both profiles (adapter 30 s, builtin 24 s with two neighbours). Four identity breaks failed it. One finding changes how the planner should read the "empty-body-specific break" decision: pi-subagents 0.88.1 always appends its "Intercom orchestration channel" section after the agent body in a real background launch, and it uses the `customPrompt` (replace) section. So a real empty-body child never reaches the bare `<active_agent .../>\n\n` path. The extension's identity reader has no body-dependent branch. The only body-sensitive part is the regex's trailing blank line. A break there (E6) fails only "Concurrent companion children keep separate hook identities", whose `demo:alpha` row has an empty body in append mode. Even the integration case it replaces passes under E6.

Nothing else depends on the two files. With both files moved out, `npm run fallow`, `npm run typecheck`, `npm run check:features`, and `npm run test:corresponding` all pass. Four doc lines cite `pi-subagents-child-identity.test.ts`, and no doc cites `hooks-spawn-end-to-end.test.ts`.

**Primary recommendation:** Two independent plans. Plan A (ITDUP-01): record breaks E1 to E5 against the scenario set below, then delete the file. No feature edit. Plan B (ITDUP-02): add the optional `body` column to `parseRealChildAgents` and the new `@mcp` scenario to `plugin/subagent-child.feature`. Record breaks E6 to E11 (E6 to show the concurrent scenario guards the bare-tag path). Then update the four doc lines and delete the file. Plan B owns `docs/`, because only `pi-subagents-child-identity` is cited.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SessionStart dispatch on `session_start` | Extension bridge (`bridges/hooks/event-router.ts`) | — | The bridge registers the Pi event and runs the composite handler |
| Hook env (`CLAUDE_PLUGIN_ROOT`, data, env file) | Extension bridge (`bridges/hooks/hook-env.ts`) | both exec lanes | One builder that both lanes call (WR-01) |
| Declared `timeout` (seconds) and ladder | `bridges/hooks/timeout.ts` + `exec-timer.ts` | both lanes | `exec-timer.ts` holds the only seconds-to-ms conversion |
| Per-scope routing cache (cross-scope wipe) | `bridges/hooks/event-router.ts` hydration | `runtime.ts` cache | The project hydrate deletes only project keys |
| Child identity (`agent_type`, `agent_id`) | `bridges/hooks/runtime.ts` (tag parse) + `translation-context.ts` | payload translators | Captured at `before_agent_start`, read at dispatch |
| Launching session in `session_id` | `translation-context.ts` (root replaces the session fields) | `child-root-session.ts` | D-PG6-01/02 |
| Launch mode of an ordinary agent | `bridges/agents/convert.ts` | pi-subagents config | The generated file names no launch mode (D-PG3-01) |
| Real child launch, prompt tag | pi-subagents 0.88.1 (peer) | — | `src/runs/shared/child-launch.js:214-216`; intercom overlay |
| Test fixture of real children | `features/lib/real-subagent-child.ts` | `subagent-hooks.steps.ts` | Shared library; the plan names it |

## Standard Stack

No new library. The phase uses what the repo already runs.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@cucumber/cucumber` | 13.3.0 installed (`^13.3.0`) [VERIFIED: node_modules/@cucumber/cucumber/package.json] | Behavioral scenarios | The project's behavioral suite (`cucumber.json`, `scripts/cucumber.mjs`) |
| `node:test` | Node v22.23.5 here, 24 in CI | The integration files being deleted | Built in |
| pi-subagents | 0.88.1 in the optional-peer cache [VERIFIED: `node scripts/install-test-peers.mjs` output] | Real child launches | Optional peer, installed into `node_modules/.cache/optional-peers` |
| pi-mcp-adapter | 7.0.1 [VERIFIED: same output] | Adapter profile | Optional peer |

**Installation:** none. `node scripts/install-test-peers.mjs` fills the peer cache (8.7 s here); `npm run test:cucumber:profile` runs it first anyway.

## Package Legitimacy Audit

This phase installs no external package.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### Data flow of the behaviors under test

```
scenario Given/When (features/step_definitions)
   │  installs plugin via "/claude:plugin install" in a real Pi (RPC)
   ▼
Pi session_start ──► event-router.ts session_start handler
   │                    ├─ hydrateProjectScopeForCwdWith  (deletes "project\x00" keys only)  ◄── E5
   │                    ├─ rebuildRoutingTablesWith
   │                    └─ sessionStartHandler(...)                                        ◄── E1
   ▼
dispatch.ts composite ──► dispatch-exec.ts (sync lane)  |  async-rewake/registry.ts (background lane)
   │                         │                                 │
   │                         ├─ runtime.childIdentityFor ──► translation-context.ts   ◄── E8, E9
   │                         ├─ payloads/*.ts (agent_type/agent_id)                    ◄── E7
   │                         ├─ hook-env.ts prepareHookEnv (CLAUDE_PLUGIN_ROOT)        ◄── E2, E4
   │                         └─ timeout.ts resolveTimeoutSeconds ─► exec-timer ladder  ◄── E3
   ▼
spawned hook process ──► recorder appends JSON line ──► Then steps compare whole tables

pi-subagents real child:  agent file (convert.ts async field ◄── E10/E11)
   ─► child-launch.js tags prompt "<active_agent name=..."/>\n\n" + body (+ intercom section)
   ─► child Pi before_agent_start ─► runtime.captureChildIdentity (ACTIVE_AGENT_PREFIX) ◄── E6
```

### Pattern 1: The deliberate-break protocol (ROADMAP "Check again, then delete")

**What:** Apply one exact replacement to one product file, run the named scenarios, record which fail, and restore with `git checkout -- <file>`. Confirm `git status --porcelain` is clean.
**When to use:** Before each deletion, once per behavior.
**Example (the helper used in this session):**

```bash
# research-01/break.sh <file> <old> <new> -- <command...>
# Applies one replacement that must occur exactly once, runs the command,
# and restores the file in an EXIT trap with `git checkout -- <file>`.
npm_config_script_shell=$SCRATCH/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 \
  npm run --silent test:cucumber:profile -- --profile adapter <feature paths or file:line>
```

A `file:line` argument may name an `Examples:` row of an Outline (for example `features/hook/failures.feature:31`); cucumber runs that row only. This was verified this session.

### Pattern 2: Optional `body` column in `parseRealChildAgents`

**What:** Accept exactly two headers. The four-column header keeps today's body. The five-column header reads `body` from the table. `tableRecords` stays strict (exact header, in order), so a typo still throws.
**Verified shape (applied temporarily, run, reverted):**

```ts
// features/lib/real-subagent-child.ts -- replaces lines 1063-1072
export function parseRealChildAgents(rows: readonly (readonly string[])[]): RealChildAgent[] {
  const withBody = rows[0]?.includes("body") === true;
  const columns = withBody
    ? ["name", "background", "tools", "body", "tool calls"]
    : ["name", "background", "tools", "tool calls"];
  return tableRecords(rows, columns).map((row) => ({
    name: row.name ?? "",
    frontmatter: (["background", "tools"] as const).flatMap((key) => {
      const value = row[key] ?? "";
      return value === "" ? [] : [[key, value] as const];
    }),
    body: withBody ? (row.body ?? "") : "Run the tools the task names.",
    calls: namedCalls(row["tool calls"] ?? ""),
  }));
}
```

The current code it replaces [VERIFIED: features/lib/real-subagent-child.ts:1057-1072], verbatim:

```ts
/**
 * Reads an agents table with the columns `name`, `background`, `tools`, and
 * `tool calls`: an empty `background` or `tools` cell leaves that line out of
 * the agent's frontmatter, and `tool calls` names the calls its child makes,
 * from `bash`, `failing read`, and `stub mcp tool`, separated by commas.
 */
export function parseRealChildAgents(rows: readonly (readonly string[])[]): RealChildAgent[] {
  return tableRecords(rows, ["name", "background", "tools", "tool calls"]).map((row) => ({
    ...
    body: "Run the tools the task names.",
    calls: namedCalls(row["tool calls"] ?? ""),
  }));
}
```

Planner notes:
- Put `body` before `tool calls`. That matches the existing concurrent table, `| agent | mode | body | tool calls |`, which `parseConcurrentLaunches` reads [VERIFIED: features/lib/real-subagent-child.ts:1083 `tableRecords(rows, ["agent", "mode", "body", "tool calls"])`]. Either position works. Pick one and say so in the doc comment.
- Update the doc comment above the function: name the optional `body` column and the body a table without it gets. Keep `{@link}`-free plain prose. Apply the `simple-english` and `humanizer` passes (typescript-style comments rule).
- The written agent file is `---\n<frontmatter>\n---\n${agent.body}\n` [VERIFIED: features/lib/real-subagent-child.ts:442-449, `return \`---\n${lines.join("\n")}\n---\n${agent.body}\n\`;`]. So an empty cell gives a file whose body is empty.
- No change to `features/step_definitions/plugin/subagent-hooks.steps.ts`: its When step passes `table.raw()` straight to `parseRealChildAgents` [VERIFIED: subagent-hooks.steps.ts:431-445, `agents: parseRealChildAgents(table.raw()),`]. No new step text, so `check:features` sees no new step to define or use.
- How a reader sees the body is empty: an empty cell in a column named `body`, and a title that says "an empty body". The precedent is the concurrent scenario's `demo:alpha` row, which already states an empty body as an empty `body` cell [VERIFIED: features/plugin/subagent-child.feature:570-571].

### Pattern 3: The new ITDUP-02 scenario (verified green under both profiles)

Insert after line 566 of `features/plugin/subagent-child.feature` (after "A real background child runs its plugin tool hooks and completes", before "Concurrent companion children keep separate hook identities"). The tables below are the ones that passed in this session. The title is at the planner's discretion.

```gherkin
  @mcp
  Scenario: A real child of an ordinary agent with an empty body runs in the companion's default mode and hooks its tools with its own identity
    When pi-subagents, with its async-by-default setting unset, launches from a main pi session a real child of each of these agents of a plugin with a stub mcp server, whose hooks record every event and whose stop hook would send a main session back:
      | name  | background | tools      | body | tool calls         |
      | plain |            | Bash, Read |      | bash, failing read |
    Then pi-subagents ran the real children like this:
      | agent      | mode       | state    | runner process | session |
      | demo:plain | background | complete | recorded       | first   |
    Then the real children's hooks record these runs in any order, and no main-session run names a child:
      | session | event              | tool name | agent type | agent id | transcript path      | CLAUDE_CODE_SESSION_ID |
      | main    | PreToolUse         | Bash      | demo:plain | first    | session file of main | main                   |
      | main    | PostToolUse        | Bash      | demo:plain | first    | session file of main | main                   |
      | main    | PreToolUse         | Read      | demo:plain | first    | session file of main | main                   |
      | main    | PostToolUseFailure | Read      | demo:plain | first    | session file of main | main                   |
    Then the main session's hooks record these runs for its control prompt:
      | event            | tool name | child identity |
      | SessionStart     |           | none           |
      | UserPromptSubmit |           | none           |
      | PreToolUse       | Bash      | none           |
      | PostToolUse      | Bash      | none           |
      | Stop             |           | none           |
      | Stop             |           | none           |
```

- It must carry `@mcp`: its step text contains "mcp", so `check:features` requires exactly one implementation tag. It must not name `pi-mcp-adapter` anywhere (features.md "MCP implementations").
- Consider adding one sentence to the feature description that an empty agent body still gets the tag (D-PG3-06). Optional.

### Anti-Patterns to Avoid

- **A break in `exec-timer.ts` for E3:** dropping `* MS_PER_SECOND` at `exec-timer.ts:204` [VERIFIED: `}, seconds * MS_PER_SECOND);`] also shrinks every default (600 s becomes 600 ms) and fails scenarios for the wrong reason. Break the declared value in `timeout.ts:139` instead. That is the regression the integration file pins.
- **Editing `features/lib/real-subagent-child.ts` without a plan entry:** ROADMAP makes `features/lib/**` shared. The plan names the file.
- **Counting the builtin profile as "ran":** `plugin/session-start-hooks.feature` and the `features/hook/` scenarios used here carry no implementation tag, so the builtin profile selects none of them (0 scenarios, measured). By DUAL-02 that counts as passing. Record it as "0 scenarios selected (DUAL-02)", not as a run.
- **Narrating the removed tests in comments or docs:** say what the scenarios show now. Do not write "replaces the former integration test" (comments.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Launching a real pi-subagents child | A new fixture or step | `runRealSubagentChild` via the existing When step | It already starts the loopback provider, both profiles, and the release |
| Reading child sessions / identity rows | New Then steps | "pi-subagents ran the real children like this:", "the real children's hooks record these runs in any order, and no main-session run names a child:", "the main session's hooks record these runs for its control prompt:" | Whole-table compares already exist |
| A timeout scenario for E3 | A new SessionStart timeout scenario | Existing `hook/failures.feature:31`, `hook/async.feature:470` | They already fail under E3 (measured) |
| Revert of a break | Manual undo | `git checkout -- <file>` in an EXIT trap | No residue; verified clean each time |

## ITDUP-01 break map (all measured this session, adapter profile)

| # | Behavior | Site and smallest break | Scenarios that FAILED | Gap? |
|---|----------|------------------------|-----------------------|------|
| E1 | SessionStart is spawned and its side effect lands | `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:1509-1512`: replace `await sessionStartHandler(\n { source: claudeSessionStartSource(event.reason, launch) },\n ctx,\n );` with `void launch;` | `plugin/session-start-hooks.feature:6` "A new session runs the session start hook once" and `:19` "Each later session runs the session start hook again" (both `ENOENT ... session-starts.log`) | No |
| E2 | `${CLAUDE_PLUGIN_ROOT}` is the record's real root | `bridges/hooks/hook-env.ts:47` `pluginRoot: entry.resolvedSource,` → `pluginRoot: path.join(loc.extensionRoot, "sources", entry.marketplace, "plugins", entry.pluginId),` | `session-start-hooks.feature:6`, `:19`; `hook/session.feature:7` "A new session runs SessionEnd with reason clear and SessionStart with source clear" | No |
| E3 | Declared `timeout` is seconds | `bridges/hooks/timeout.ts:139` `return capSessionEndTimeout(raw, event, pluginId, lane);` → `...(raw / 1000, ...)` | `hook/failures.feature:31` (row `timeout 1, sleep 3` of "A failing prompt hook with onFailure block stops the prompt"; the run is missing because SIGTERM at 1 ms beats the recorder); `hook/session-end.feature:153` and `:200` (rows `timeout 60, sleep 60` of the two "A SessionEnd hook that fails or outlasts its budget ..." Outlines); `hook/async.feature:470` "A background hook process that ignores SIGTERM stops at its timeout" ("the hook wake logged no start within 19981 ms"). 58 other scenarios in those five files passed. | No |
| E4 | A root outside the extension directory still spawns | `bridges/hooks/hook-env.ts:93`, after `const vars = hookPathVars(entry, transCtx, loc);` add `await assertPathInside(loc.extensionRoot, vars.pluginRoot, "CLAUDE_PLUGIN_ROOT");` (both lanes call `prepareHookEnv`: `dispatch-exec.ts:233`, `async-rewake/registry.ts:952`) | `session-start-hooks.feature:6`, `:19`; `hook/session.feature:7`; `hook/async.feature:470` (background lane) | No |
| E5 | User-scope SessionStart runs when the project records nothing | `bridges/hooks/event-router.ts:994` `const projectKeyPrefix = "project\x00";` → `const projectKeyPrefix = "";` (the project hydrate then deletes every cached key) | `hook/session.feature:391` "Reloading pi in the terminal runs no session hook" and `:410` "Quitting pi in the terminal runs SessionEnd with reason prompt_input_exit" (both: "the terminal pi ran no SessionStart startup hook", asserted by the Given at `features/step_definitions/hook/session.steps.ts:186-192`); `plugin/subagent-child.feature:542`; `agent/frontmatter.feature:410`. `session-start-hooks.feature` (project scope) stays green. | No |

Notes for the planner:
- The dir-source plugin root `{home}/marketplaces/<mp>/plugins/<plugin>` is outside `<scopeRoot>/pi-claude-marketplace`. That is why E4 fails the session-start scenarios. The hook-env comment states this as the contract [VERIFIED: hook-env.ts:56-62, "for a path source the user pointed at an external directory deliberately, so no containment assertion is meaningful on it. `CLAUDE_PLUGIN_DATA` IS contained, and asserted."].
- The containment guard the CONTEXT places in `dispatch-exec.ts` / `async-rewake/registry.ts` now lives in their shared builder, `hook-env.ts` (WR-01). Break it there so both lanes are covered.
- E3's strongest detectors are `failures.feature:31` and `async.feature:470` (1 s read as 1 ms, against a recorder that needs tens of ms). The SessionEnd rows depend on a 60 ms budget against the recorder's start, which is a thinner margin. Cite all four, and lead with the two 1 ms rows.
- `hook/compaction.feature` ("slow", timeout 1, sleep 3) and `hook/async.feature:261` (plain async, no timer) did not fail under E3.
- Because no break shows a gap, CONTEXT's "[ITDUP-01 gaps]" branch does not fire: `plugin/session-start-hooks.feature` stays unchanged.

## ITDUP-02 break map (measured this session, adapter profile)

Where the identity comes from (all read this session):
- Tag parse: `bridges/hooks/runtime.ts:55` [VERIFIED] `const ACTIVE_AGENT_PREFIX = /^<active_agent name="((?:[^"&<>]|&(?:amp|quot|lt|gt);)+)"\/>\n\n/;`. `captureChildIdentity` (`runtime.ts` around 551-575) reads `customPrompt` and `appendSystemPrompt`, and is gated by `isSubagentChild(process.env)`.
- Capture point: `createBeforeAgentStartHandler`, `event-router.ts:322-345`, which also resolves the launching session (`childRootSession`).
- Dispatch: `childHookIdentityOf` (`translation-context.ts:81-91`) and `buildTranslationContext` (`translation-context.ts:131-152`), whose `sessionId: kept?.root?.sessionId ?? ownSessionId,` (line 141) puts the launching session in `session_id`.
- Payload fields: `...(ctx.childIdentity === undefined ? {} : { agent_type: ..., agent_id: ... })` in `payloads/pre-tool-use.ts:56`, `post-tool-use.ts:82`, `post-tool-use-failure.ts:78`.
- Launch mode: `bridges/agents/convert.ts:1092` [VERIFIED] `...((backgroundForMcp || isTrueBackground(raw.background)) && { async: true }),`.
- pi-subagents tag: `node_modules/.cache/optional-peers/node_modules/pi-subagents/src/runs/shared/child-launch.js:214-216` [VERIFIED] `` `<active_agent name="${escapeXmlAttr(input.childAgentName)}"/>\n\n${input.systemPrompt}` `` (only when `systemPrompt` is not `undefined`/`null`, so `""` still gets the tag).

Does an empty body take a different path? Measured with a logging-only diagnostic (reverted): in the real background launch of the empty-body `plain`, the child's `customPrompt` was `<active_agent name="demo:plain"/>\n\nIntercom orchestration channel:\n...`. pi-subagents' `applyIntercomBridgeToAgent` (`src/intercom/intercom-bridge.js:171-185`) replaces an empty prompt with its instruction, because its mode defaults to `"always"` (`resolveIntercomBridgeMode`, line 74-78) when an orchestrator target exists. In the concurrent runner, `demo:alpha` got `appendSystemPrompt` `<active_agent name="demo:alpha"/>\n\n` with nothing after it, and `demo:beta` got `customPrompt` `<active_agent name="demo:beta"/>\n\n<active_agent name="spoof"/>`. So the reader treats an empty body no differently, and the bare-tag case is reachable only through the concurrent runner (or a pi-subagents config with `intercomBridge.mode: "off"`, which the fixture does not write).

| # | Break (site → change) | Failed | Passed |
|---|-----------------------|--------|--------|
| E6 | `runtime.ts:55`: `"\/>\n\n/;` → `"\/>\n\n(?=[\s\S])/;` (identity needs text after the blank line: the empty-remainder tag) | `plugin/subagent-child.feature:568` "Concurrent companion children keep separate hook identities" | `subagent-child.feature:542`, `agent/frontmatter.feature:410`, `:423`, the proposed new scenario, AND the integration case "an ordinary adapter agent with an empty body ..." |
| E7 | `payloads/post-tool-use-failure.ts:78-80`: delete the identity spread | `subagent-child.feature:542`, `frontmatter.feature:423`, the new scenario | `:568`, `frontmatter.feature:410` (no failing call) |
| E8 | `translation-context.ts:141`: `sessionId: kept?.root?.sessionId ?? ownSessionId,` → `sessionId: ownSessionId,` | `subagent-child.feature:542`, `frontmatter.feature:410`, `:423`, the new scenario | `:568` (its runner gives no launching session, D-PG6-02) |
| E9 | `translation-context.ts:82`: `if (identity.kind !== "known") {` → `if (identity.kind === "known" \|\| identity.kind !== "known") {` (no identity in either lane) | all four existing scenarios and the new one | — |
| E10 | `convert.ts:1092` → `async: backgroundForMcp \|\| isTrueBackground(raw.background),` (an ordinary agent is written `async: false`) | `frontmatter.feature:410`, the new scenario (both at "pi-subagents ran the real children like this:") | `:542`, `:423` |
| E11 | `convert.ts:1092` → `async: true,` (every agent written as background) | `frontmatter.feature:423` (row `demo:plain \| foreground`) | (only `:423` was run) |

Mapping of the four integration cases (six runs) to scenarios:

| Integration case | Replacing scenario | Profiles | Breaks that fail it |
|------------------|--------------------|----------|---------------------|
| detached background + MCP children (adapter, builtin) | `subagent-child.feature:542` "A real background child runs its plugin tool hooks and completes" (`@mcp`) | both | E7, E8, E9 |
| ordinary empty-body child, pi-subagents default (adapter, builtin) | NEW scenario (Pattern 3), `@mcp` | both | E7, E8, E9, E10 |
| ordinary agent, foreground default (adapter) | `agent/frontmatter.feature:423` "Explicit background and MCP grants keep a child in the background" (`@mcp`, row `demo:plain \| foreground \| \| none \|`) | both | E9, E11 |
| concurrent runner children (adapter) | `subagent-child.feature:568` "Concurrent companion children keep separate hook identities" (no tag: adapter only, as the integration case) | adapter | E6, E9 |

Answer to CONTEXT's "one break should hit an empty-body launch tag specifically, if the identity reader treats the body separately": it does not treat the body separately. Record E6 in SUMMARY.md as the evidence. It is the only body-sensitive break, and the concurrent scenario's empty-body row catches it. The new scenario guards the pi-subagents side of an empty body (a peer that dropped the tag for an empty prompt would fail it). Its product-side protection comes from E7 to E10.

## Runtime State Inventory

Not a rename or migration phase. It deletes tests and adds one scenario, so it leaves no runtime state behind. Every category is "None":
- Stored data: none. The fixtures live in per-run temp dirs (`/tmp/pi-cm-features-*`), and the release removes them.
- Live service config, OS-registered state, secrets/env vars: none.
- Build artifacts: none (Node runs `.ts` directly). Caches: the jiti cache in the run's TMPDIR.

## Common Pitfalls

### Pitfall: Root ignores DAC, so permission scenarios fail
**What goes wrong:** About 167 cases fail as root on any tree.
**How to avoid:** Run every npm script with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. Every run in this research used it.

### Pitfall: Reading "1 scenario" as no result
**What goes wrong:** cucumber prints `1 scenario (1 passed)` (singular). A grep for `scenarios (` misses it. That happened once in this session's E6 run against the new scenario.
**How to avoid:** Grep `scenarios? \(` and check the exit code of the run.

### Pitfall: The doc ordinals in `hooks-compatibility.md:77`
**What goes wrong:** The paragraph says "The first scenario shows ... The second shows children whose runner gives neither source". Inserting the new scenario's title between them breaks those ordinals. The paragraph's last sentence ("Those tests launch an explicit background agent, ... an ordinary agent with an empty body ..., and two child sessions at once in one runner process") also refers to the deleted real-child tests. After the edit, "Those tests" would point at the launching-session and dispatch-context unit tests.
**How to avoid:** Rewrite the sentence so that the scenarios are its subject, and keep each ordinal pointing at the right scenario.

### Pitfall: Worktree commits skip the hook
**What goes wrong:** Inside `.claude/worktrees/...` the hook may print "(no files to check)".
**How to avoid:** Run `npm run check:static` and the focused scenarios by hand before committing. The post-merge `npm run check` is the backstop (CONTEXT specifics).

### Pitfall: A plan that deletes files without declaring them
**How to avoid:** List both files in `files_deleted` frontmatter, or the worktree merge guard blocks the merge (CONTEXT specifics).

## Code Examples

### Focused verify commands (realistic timeouts; measured wall times on this 4-CPU container)

```bash
W="npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144"

# ITDUP-01 detector set, 10 scenarios: adapter 27 s; builtin 20 s (selects only subagent-child:542)
env $W npm run --silent test:cucumber:profile -- --profile adapter \
  features/plugin/session-start-hooks.feature features/hook/session.feature:7 \
  features/hook/session.feature:391 features/hook/session.feature:410 \
  features/hook/failures.feature:31 features/hook/session-end.feature:153 \
  features/hook/session-end.feature:200 features/hook/async.feature:470 \
  features/plugin/subagent-child.feature:542

# ITDUP-02 files: subagent-child adapter 34 s (19 sc.) / builtin 27 s (14 sc.);
# agent/frontmatter adapter 52 s (40 sc.) / builtin 27 s (2 sc.)
env $W npm run --silent test:cucumber:profile -- --profile adapter features/plugin/subagent-child.feature features/agent/frontmatter.feature
env $W npm run --silent test:cucumber:profile -- --profile builtin features/plugin/subagent-child.feature features/agent/frontmatter.feature
```

Other measured times: `session-start-hooks.feature` alone, adapter 15 s (2 scenarios), builtin 4 s (0 scenarios). Five hook files together (`session-start-hooks`, `failures`, `compaction`, `async`, `session-end`), adapter 65 s (62 scenarios). The two integration files, 64 s (8 tests). A timeout of 600000 ms covers any focused run. `npm run check` was not timed (the config's `test_gate_timeout` is 2400 s).

### Doc replacements (item 4)

No doc outside `.planning/` cites `hooks-spawn-end-to-end`. The citations of `pi-subagents-child-identity.test.ts` [VERIFIED: grep plus a read of each line]:

| Location | Current citation | Point it at |
|----------|------------------|-------------|
| `docs/mcp-compatibility.md:495` | "...in `features/agent/frontmatter.feature`, and the [real-child tests](../test/integration/pi-subagents-child-identity.test.ts) for an ordinary agent with an empty body." | the new scenario's title in `features/plugin/subagent-child.feature` |
| `docs/mcp-compatibility.md:527` | "The cucumber suite and the integration tests now launch real children ... (`features/agent/frontmatter.feature`, `features/plugin/subagent-child.feature`, `test/integration/pi-subagents-child-identity.test.ts`)" | drop "and the integration tests" (make the verb agree) and the third path. The remaining `subagent-hook-ownership` integration file uses stand-in children, not real launches. |
| `docs/mcp-compatibility.md:770` | "An agent with a plugin MCP grant then does not launch (`test/integration/pi-subagents-child-identity.test.ts`)." | `features/plugin/subagent-child.feature` "A real background child runs its plugin tool hooks and completes" and `features/agent/frontmatter.feature` "Explicit background and MCP grants keep a child in the background", whose granted agents launch and complete |
| `docs/hooks-compatibility.md:77` | "...and in the [real-child tests](../test/integration/pi-subagents-child-identity.test.ts)." plus the closing "Those tests launch ..." sentence | add the new scenario's title to the list of real-child scenarios, then rewrite the closing sentence with the scenarios as its subject (see Pitfall) |

Untouched: `.planning/**` (history), `test/integration/hooks-dispatch-end-to-end.test.ts:304`, whose title reuses the label "HOOK-E2E-02" for a different case. That file is Phase 6's.

### Helpers only the deleted files use (item 4b)

Measured by moving both files out of the tree (restored afterwards): `npm run fallow` exit 0, `npm run typecheck` clean, `npm run check:features` clean, `npm run test:corresponding` clean. Every import of `hooks-spawn-end-to-end` has other users (`withHermeticEnvironment` and the hooks-bridge exports). In `features/lib/real-subagent-child.ts`, the types `RealChildAgent` and `ConcurrentChildLaunch` lose their only outside importer. Both are part of the module's exported signatures (`parseRealChildAgents`, `RealChildOptions.agents`, `parseConcurrentLaunches`, `ConcurrentChildrenOptions`), and fallow reports nothing. **Keep them exported.** Removing `export` would leak a private type through exported functions (fallow `private-type-leak`) [ASSUMED for the leak claim; fallow passing as-is is VERIFIED]. No module becomes dead, so no helper goes.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| A mock-Pi integration test of `dispatchHookExec` (HOOK-E2E-02/05) | Real Pi scenarios that spawn real hook processes from dir-source plugins | Same assertions, with real spawns, in the suite that also checks both profiles |
| A `node:test` real-child suite that imports `features/lib` | The real-child cucumber steps that use the same lib | One fixture, one run surface. After this phase, only `subagent-hook-ownership.test.ts` imports from `features/lib` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Unexporting `RealChildAgent` / `ConcurrentChildLaunch` would trip fallow `private-type-leak` | Helpers | Low. The recommendation is to leave them, which is measured to pass |
| A2 | The SessionEnd rows (`session-end.feature:153`, `:200`) fail E3 reliably on a slower CI runner, where the 60 ms budget races the recorder start | ITDUP-01 map | Low. The two 1 ms detectors are decisive on their own |
| A3 | pi-subagents 0.88.1's intercom section is present in every real background launch of the fixture (mode defaults to `"always"` with an orchestrator target) | ITDUP-02 map | Low. If it ever drops, the new scenario reaches the bare-tag path, which E6 would then catch: stronger, not weaker |

## Open Questions

1. **Should a real (not runner-built) child reach the bare-tag path?**
   - What we know: only the concurrent runner reaches `<tag>\n\n` with nothing after (E6). A real pi-subagents launch always appends the intercom section.
   - What's unclear: whether a user config with `intercomBridge.mode: "off"` is worth a scenario.
   - Recommendation: out of scope (CONTEXT locks "async-by-default unset", and the fixture writes no other pi-subagents config). Record E6 and move on.

2. **Feature description of `subagent-child.feature`.**
   - Recommendation: optional one-line mention that a child of an agent with an empty body still carries its identity. Planner's discretion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v22.23.5 (CI: 24) | — |
| npm | scripts | ✓ | bundled | — |
| `@cucumber/cucumber` | scenarios | ✓ | 13.3.0 | — |
| Optional-peer cache (pi-subagents 0.88.1, pi-mcp-adapter 7.0.1, pi-dynamic-workflows 3.15.0) | real-child scenarios, both profiles | ✓ after `node scripts/install-test-peers.mjs` | as listed | — |
| `setpriv` + non-DAC wrapper | running as root | ✓ | `/usr/bin/setpriv`; wrapper at `.../scratchpad/nondac-sh` | — |

**Missing dependencies:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | cucumber-js 13.3.0 (behavioral), `node:test` (integration being deleted) |
| Config file | `cucumber.json` (profiles `adapter`: `not @builtin-only`; `builtin`: `(@mcp or @builtin-only) and not @adapter-only`) |
| Quick run command | `npm run test:cucumber:profile -- --profile <adapter\|builtin> <paths or file:line>` (with the non-DAC env) |
| Full suite command | `npm run check` (phase gate; includes `test:cucumber` for both profiles and `check:features`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ITDUP-01 | SessionStart spawn + side effect (E1) | behavioral | `... --profile adapter features/plugin/session-start-hooks.feature` | ✅ |
| ITDUP-01 | real `CLAUDE_PLUGIN_ROOT` (E2) | behavioral | `... features/plugin/session-start-hooks.feature features/hook/session.feature:7` | ✅ |
| ITDUP-01 | `timeout` in seconds (E3) | behavioral | `... features/hook/failures.feature:31 features/hook/async.feature:470 features/hook/session-end.feature:153 features/hook/session-end.feature:200` | ✅ |
| ITDUP-01 | root outside extension dir (E4) | behavioral | `... features/plugin/session-start-hooks.feature features/hook/async.feature:470` | ✅ |
| ITDUP-01 | user-scope SessionStart, empty project (E5) | behavioral | `... features/hook/session.feature:391 features/hook/session.feature:410` | ✅ |
| ITDUP-01 | file deleted | static | `test ! -e test/integration/hooks-spawn-end-to-end.test.ts && npm run check:static` | n/a |
| ITDUP-02 | empty-body ordinary child, failing read, identity | behavioral, both profiles | `... --profile adapter features/plugin/subagent-child.feature` and `--profile builtin` | ❌ new scenario (Wave 0 of Plan B) |
| ITDUP-02 | breaks E6 to E11 recorded | behavioral | `... features/plugin/subagent-child.feature:542 features/plugin/subagent-child.feature:<new line> features/plugin/subagent-child.feature:568 features/agent/frontmatter.feature:410 features/agent/frontmatter.feature:423` | ✅ after the new scenario |
| ITDUP-02 | file deleted, docs updated | static | `test ! -e test/integration/pi-subagents-child-identity.test.ts && ! grep -rn "pi-subagents-child-identity" docs && npm run check:static` | n/a |

### Sampling Rate
- **Per task commit:** the focused cucumber command of the task under the touched profile(s), plus `npm run check:static` by hand in a worktree.
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `features/lib/real-subagent-child.ts`: optional `body` column (Pattern 2), needed before the new scenario can pass.
- [ ] `features/plugin/subagent-child.feature`: the new `@mcp` scenario (Pattern 3).
- No framework install is needed. Plan A has no Wave 0 gap.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it counts as enabled. This phase changes only tests and docs, and each deliberate break is reverted and never committed.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | indirectly | `tableRecords` keeps exact-header validation for the new column |
| V6 Cryptography | no | — |
| V12 Files and Resources | yes (containment) | E4 shows that `CLAUDE_PLUGIN_ROOT` is not contained, by design (hook-env.ts:56-62). `CLAUDE_PLUGIN_DATA` and `CLAUDE_ENV_FILE` are contained. Do not "fix" that while doing E4 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A deliberate break committed by accident | Tampering | Restore in an EXIT trap with `git checkout -- <file>`, check `git status --porcelain`, keep breaks out of every commit |
| A child identity spoofed through a body tag | Spoofing | Kept by the anchored `ACTIVE_AGENT_PREFIX` and covered by the concurrent scenario's `demo:beta` `<active_agent name="spoof"/>` row |

## Experiments Log (all reverted; tree verified clean after each)

Baseline: both integration files, 8/8 passed in 64 s. `session-start-hooks` adapter 2/2, builtin 0 selected. Real-child pair 2/2.

| Exp | Change | Command scope | Result |
|-----|--------|---------------|--------|
| E1 | event-router.ts:1509-1512 dispatch removed | session-start-hooks (adapter) | 2 failed |
| E2 | hook-env.ts:47 synthesized root | session-start-hooks + session.feature:7 | 3 failed |
| E3 | timeout.ts:139 `raw / 1000` | session-start-hooks, failures, compaction, async, session-end (62 sc.) | 4 failed (failures:31, session-end:153, :200, async:470) |
| E3b | same | failures.feature:31 alone | failed: the hooks record no run |
| E4 | hook-env.ts:93 containment added | session-start-hooks, async:470, session:7 | 4 failed |
| E5 | event-router.ts:994 prefix `""` | session-start-hooks, session:391, :410, subagent-child:542, frontmatter:410 | 4 failed (session-start stayed green) |
| E6 | runtime.ts:55 needs text after the blank line | 542, 568, frontmatter 410, 423 + integration empty-body case + new scenario | only 568 failed; integration case passed; new scenario passed |
| diag | runtime.ts: log prompt sections (no behavior change) | integration empty-body + concurrent cases | intercom section follows the empty body; runner alpha has a bare tag |
| E7 | post-tool-use-failure.ts:78-80 identity removed | four existing + new | 542, 423, new failed |
| E8 | translation-context.ts:141 own session | four existing + new | 542, 410, 423, new failed |
| E9 | translation-context.ts:82 no identity | four existing + new | all five failed |
| E10 | convert.ts:1092 `async: false` for ordinary | 542, 410, 423 + new | 410, new failed |
| E11 | convert.ts:1092 `async: true` always | 423 | failed (`demo:plain` not foreground) |
| new | Pattern 2 + Pattern 3 in a scratch feature file | new + 542 + frontmatter 410, both profiles | 3/3 passed under each profile (adapter 30 s, builtin 24 s) |
| deps | both files moved out | fallow, typecheck, check:features, test:corresponding | all pass |

Scratch files (untracked, outside the repo): `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/research-01/break.sh`, `.../research-01/lib-patch.mjs`, `.../research-01/features/empty-body.feature`, `.../research-01/prompts.log`.

## Sources

### Primary (HIGH confidence)
- Repository source read this session: `bridges/hooks/{event-router,hook-env,timeout,exec-timer,runtime,translation-context,dispatch-exec}.ts`, `bridges/hooks/payloads/*.ts`, `bridges/agents/convert.ts`, `features/lib/{real-subagent-child,hook-files}.ts`, `features/step_definitions/plugin/{subagent-hooks,session-start-hooks}.steps.ts`, `features/step_definitions/hook/session.steps.ts`, the feature files cited, both integration files, `cucumber.json`, `package.json` scripts, `.fallowrc.json`.
- pi-subagents 0.88.1 source in the peer cache: `src/runs/shared/child-launch.js`, `src/runs/shared/effective-system-prompt.js`, `src/intercom/intercom-bridge.js`, `src/agents/agents.js`.
- Runs of the scenarios and the integration tests in this session (Experiments Log).
- Skills: `cucumber` (SKILL.md, `rules/features.md`, `rules/steps.md`), `local-verification` (SKILL.md, `rules/commands.md`, `rules/gates.md`), `typescript-style` (SKILL.md, `rules/comments.md`).

### Secondary / Tertiary
- None. No web sources were needed. The phase is internal to this repository and its pinned peers.

## Metadata

**Confidence breakdown:**
- ITDUP-01 coverage: HIGH. Every break was run, and each failed named scenarios.
- ITDUP-02 scenario and harness: HIGH. Run green under both profiles and red under four breaks.
- Empty-body path analysis: HIGH. Observed through a logging diagnostic and the pi-subagents source.
- Doc edits: HIGH for the locations; wording is the planner's.

**Research date:** 2026-11-21
**Valid until:** about 2026-12-21, or until the pi-subagents peer version changes (the intercom finding is version-specific).
