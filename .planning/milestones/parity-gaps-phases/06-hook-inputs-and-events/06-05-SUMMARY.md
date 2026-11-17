---
phase: 06-hook-inputs-and-events
plan: "05"
subsystem: hooks
status: complete
tags: [hooks, mcp_server, cucumber, mcp]
requires: ["06-03", "06-04"]
provides:
  - "`mcp_server` (`{name: plugin:<plugin>:<server>, source: plugin}`) on PreToolUse, PostToolUse, and PostToolUseFailure for a plugin MCP tool"
  - "bridges/hooks/mcp-server-table.ts: `McpServerEntry`, `mcpServerEntries`, `findMcpServer`"
  - "Two HooksRuntime operations: `setMcpServers`, `mcpServerFor`"
  - "The cucumber step `Given the mcp implementation allows the project's plugin mcp servers`"
affects: [06-13]
tech-stack:
  added: []
  patterns:
    - "A fact the bridge looks up rides on the event copy the hooks read and reaches stdin through `toolFactFields`, as `hookDurationMs` does"
    - "A per-scope table in the runtime closure, set by the scope hydrate from the state it already loaded"
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/mcp-server-table.ts
    - test/bridges/hooks/mcp-server-table.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/tool-event-facts.ts
    - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
    - extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
    - features/hook/mcp-tool-names.feature
    - features/hook/tool-use.feature
    - features/hook/tool-failure.feature
    - features/step_definitions/mcp-implementation.steps.ts
    - features/step_definitions/mcp-configuration.steps.ts
    - features/lib/mcp-configuration.ts
decisions:
  - "mcp_server names only a plugin's server, by the registered name under Pi's built-in MCP and by the adapter key prefix under pi-mcp-adapter; two different servers that claim one key give none (D-PG6-07)"
  - "A profile-neutral step allows a project's plugin MCP servers: the adapter's allow setting under pi-mcp-adapter, nothing under Pi's built-in MCP (orchestrator decision, option A, pending maintainer review)"
metrics:
  duration: "~2.5 h"
  completed: 2026-11-14
estimate:
  tokens: 98000
actuals:
  tokens: 34550
  tasks: 2
  commits: 2
plan_head_before: a43ded587ca4da2cee665e8d438bfbc0ea57cb48
plan_head_after: 97b98b22747e0bd9de12d465dec82bfab7ab8d6b
---

# Phase 6 Plan 05: mcp_server for a plugin MCP tool Summary

A hook on a tool of a plugin's MCP server now gets `mcp_server` on `PreToolUse`, `PostToolUse`, and `PostToolUseFailure`. The value is `{"name":"plugin:<plugin>:<server>","source":"plugin"}`, the same under pi-mcp-adapter and under Pi's built-in MCP. The bridge builds a table of plugin servers from each scope's installation state when it hydrates that scope. A tool it cannot name gets no field.

## Commits

| Task | Commit | Title |
|---|---|---|
| 06-05-01 | `7e9aca4b` | feat(hooks): send mcp_server for a plugin MCP tool (21 files, +1021/-75) |
| 06-05-02 | `97b98b22` | test(hooks): guard mcp_server of a project-scope plugin's MCP tool (4 files, +55/-12) |

`git rev-list --count a43ded58..HEAD` = 2. Before each commit I ran `SKIP=npm-check pre-commit run --files <task files>`: exit 0, and the fixers changed nothing. Both commits passed the commit hook on the first try (`npm run check:commit ... Passed`). I did not use `--amend`, `--no-verify`, `git stash`, or `git add -A`. Neither commit holds bridges/hooks/translation-context.ts, a file under test/integration/, or features/plugin/subagent-child.feature (`git diff --name-only a43ded58..HEAD` matches none of them).

## Task 06-05-01: the field

- **Table (mcp-server-table.ts, new, with its paired test).** It exports `McpServerEntry` (`builtinServer`, `adapterKey`, `server`), `mcpServerEntries(state, scope)`, and `findMcpServer(entries, tool)`.
  - `mcpServerEntries` walks the marketplaces of the scope and skips a record that `isRecordedButDisabled` marks. It gives one entry per name in `mcpServerConfigs`: `builtinMcpServerName`, `generatedMcpServerKey`, and `mcpServerDisplayName` with the source `plugin`. A record without the list, and a plugin name the key builders refuse, give no entry.
  - `findMcpServer` matches by `builtinServer` when the tool has one. Otherwise it matches by the prefix `mcp__<adapterKey>_` through `serverPrefixNames`. So a recovered `claudeName` takes the place of a cut name, and a name cut inside the prefix matches nothing. It returns nothing when no entry or two different servers match.
  - The module imports `domain/`, `persistence/`, `shared/` types, and the bridge only. The fallow check of the commit hook passed.
- **Facts (tool-event-facts.ts).** `HookMcpServer` (`name`, `source: "plugin"`), the member `hookMcpServer?` of `HookToolFacts`, and `mcp_server` in what `toolFactFields` returns, after `duration_ms`.
- **Runtime (runtime.ts).** `setMcpServers(scope, entries)` and `mcpServerFor(tool)`, each with a doc comment. A `Map<Scope, entries>` in the closure holds one list per scope. `setMcpServers` is also in `RoutingStateOperations` and in the router's `EventRouterRoutingState` `Pick`.
- **Router (event-router.ts).** `hydrateScopeFromState` first sets the scope's servers from the state it receives. For a state that fails to load at a load, that is `DEFAULT_STATE`, so the scope gets none. Where `hydrateProjectScopeForCwdWith` deletes the project's cached configs, it also empties the project's servers. So an untrusted project, a failed state read, and a stale generation leave the project with none.
- **Dispatch (dispatch.ts).** `mcpServerFacts(runtime, tool)` is the one small function. `hookEventView` now takes `runtime` in place of the candidates callback. On the PreToolUse path it adds the facts with `withToolFacts`. The result path adds them beside the duration: `{ ...facts, ...mcpServerFacts(runtime, seen.tool) }`. With no server, `withToolFacts` returns Pi's event itself. The copy shares Pi's `input`, so an input rewrite still reaches Pi.
- **Translators.** `readonly mcp_server?: HookMcpServer` comes after `tool_use_id` on `PreToolUseStdin`, and after `duration_ms` on the two result stdins. `translatePreToolUse` takes `ToolCallEvent & HookToolFacts` and spreads `toolFactFields(event)` after `tool_use_id`. Each header gained one sentence that cites D-PG6-07.

### Owner cases

- mcp-server-table.test.ts:
  - Entries: `demo`/`stub` gives the three keys. `stub-server.v1` keeps its text in `name`. A disabled record, a record with no `mcpServerConfigs`, a record with an empty list, a plugin name `de/mo`, and a record of the other scope each give `[]`.
  - Lookup: by built-in name, and nothing for an unknown built-in name. By adapter prefix. A recovered `claudeName` finds the server, and the same cut name without it finds nothing. `mcp__other__echo`, `mcp__plugin_demo_stub_x__echo`, `mcp__plugin_demo_stub`, and `bash` find nothing. Two different servers on one key find nothing, under both forms. One server in both scopes finds that server.
- runtime.test.ts: both scopes are read; `setMcpServers("project", [])` keeps the user scope's servers; a new runtime has none.
- routing-state.test.ts: the bound `setMcpServers` reaches the runtime.
- event-router.test.ts:
  - A load sets the user scope's server for a plugin with no hooks.
  - A failed user state read replaces a seeded entry with none.
  - The project hydrate of an untrusted project, and of one whose state fails to load, each clear a seeded project entry and set none.
  - A trusted project hydrate sets its server and keeps the user scope's.
- dispatch.test.ts, `describe("MCP server facts (D-PG6-07)")`:
  - PreToolUse gives `{ ...event, hookMcpServer }`, and the copy shares `input`.
  - The result gives `{ ...event, hookDurationMs: 75, hookMcpServer }`.
  - A tool with no server gets Pi's own event objects, checked with `strictEqual`.
- Translator tests: `Object.entries` shows `mcp_server` after `tool_use_id` (PreToolUse) and after `duration_ms` (the result events). Without the fact, `Object.hasOwn(payload, "mcp_server")` is false. tool-event-facts.test.ts: `toolFactFields` puts `mcp_server` after `duration_ms`.

TDD order: the criterion scenario was seen red first. I wrote the owner cases after the implementation, so they were not seen red on their own.

### Red and green of "A hook of a plugin MCP tool receives the server's name and source"

Red, on the unchanged production tree, with only the scenario added:

```
npm run test:cucumber:profile -- --profile adapter features/hook/mcp-tool-names.feature --name "receives the server's name and source"
           -     'mcp server',
           -     '{"name":"plugin:hook-demo:stub-server","source":"plugin"}',
1 scenario (1 failed)
15 steps (14 passed, 1 failed)
```

The builtin profile gave the same result: exit 1, 1 scenario failed, 15 steps (14 passed, 1 failed). The actual table had no `mcp server` column.

Green after the change: adapter exit 0 (1 scenario passed, 15 steps passed) and builtin exit 0 (1 scenario passed, 15 steps passed).

### The sweep

The sweep script `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-gaps/46275468-1855-49b4-a234-f937cd40117e/scratchpad/p0605-sweep.py` is not committed. It adds `mcp server` after `duration ms`, or after `tool use id` when the table has no `duration ms`. It does this in each runs table that holds a row of a plugin MCP tool. Each such row gets the object, and every other row gets an empty cell. It pads only the new column.

| File | Tables changed |
|---|---|
| features/hook/mcp-tool-names.feature | 6 (5 swept + the criterion scenario) |
| features/hook/tool-use.feature | 8 |
| features/hook/tool-failure.feature | 2 |

That is 16 tables. The six complete-inputs records (tool-use.feature lines 114, 115, 157, 158; tool-failure.feature lines 401, 402) each gained `,"mcp_server":{"name":"plugin:hook-demo:stub-server","source":"plugin"}` after `"duration_ms":"{milliseconds}"`. The adapter and builtin records state the same value. The plan counted 17 tables with an MCP tool row. Of those, the echo-server table and the cut-name failure table below get no column, and the criterion scenario adds one.

Every changed table and record passed on the first run under both profiles. No column states one value for the adapter and another for the built-in profile.

**Rows of a plugin MCP tool with no server, and why:**

- mcp-tool-names.feature, "With no hook that names the tool, PreToolUse hooks see the name pi-mcp-adapter shortened and PostToolUse hooks its full Claude Code name…": the `PreToolUse` row `mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plug_aa6b8bc3` has an empty cell. pi-mcp-adapter cut the name inside the server part, and no hook literal recovers it. The table's `PostToolUse` rows recover the full name from the result details, so they carry the server.
- mcp-tool-names.feature, "With no hook that names the tool, a PostToolUseFailure hook sees the name pi-mcp-adapter shortened…": the table's only row is that cut name, so it gets no column. A column whose cells are all empty would fail the table.
- mcp-tool-names.feature, "A hook on a built-in tool matches the server as Pi registered it…": the tool belongs to `echo-server` of Pi's own `mcp.json`, so the table gets no column, as the plan says.
- tool-use.feature, the `@builtin-only` table at header line 1272: Pi's built-in MCP cut the name (`mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d`). `builtinServer` still names the server, so these rows carry it. That fits the plan: only an adapter name cut inside the server part is left out.

Column-removal check (`/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-gaps/46275468-1855-49b4-a234-f937cd40117e/scratchpad/p0605-check.sh`, `BASE=a43ded58`). It removes the `mcp server` column, the complete-inputs member, and the two new scenarios, unpads every runs-table cell, and compares the result with the same projection of the base:

```
EQUAL  features/hook/mcp-tool-names.feature
EQUAL  features/hook/tool-use.feature
DIFFER features/hook/tool-failure.feature: 3 changed lines
<   `tool_use_id`, `duration_ms`, and `mcp_server` (D-CF5-28, D-BG-403).
>   `tool_use_id` and `duration_ms`, and `mcp_server` for a tool of a plugin's
>   MCP server (D-PG6-04, D-PG6-07).
```

The only difference is the Feature description (deviation 1). No table differs.

### Verification (task 1)

| Command | Result |
|---|---|
| `node --import "$PWD/test/platform/isolated-pi-home.ts" --test` the 12 files of the plan's first verify | exit 0, 720 tests, 720 pass, 0 fail, 0 cancelled |
| `npm run test:coverage:direct --` the 7 named sources plus post-tool-use.ts and post-tool-use-failure.ts | exit 0 (100%) |
| Owner tests of callers: the 48 non-integration test files that name `createHooksRuntime`, a tool translator, `createRoutingStateOperations`, or `registerHooksBridge` | exit 0, 3843 pass |
| `node scripts/install-test-peers.mjs && node --import ... --test test/integration/hooks-*.test.ts` (5 files, including both of the plan's) | exit 0, 16 tests, 16 pass. The 06-04 deferred failures no longer occur |
| adapter profile, the three features | exit 0, 86 scenarios (86 passed), 1293 steps |
| builtin profile, the three features | exit 0, 14 scenarios (14 passed), 221 steps |
| `npm run check:features` | exit 0 |
| `npm run fallow`; `npx tsc --noEmit`; `npx eslint --max-warnings 0` on the changed files | exit 0 each |

## Task 06-05-02: the project-scope guard

The scenario "A hook of a project-scope plugin's MCP tool receives the server's name and source" (`@mcp`) does these steps in order:

- Adds the marketplace to the project scope and installs `hook-demo` with `--scope project`.
- Holds a Pi settings file in the project, so that trust matters. The profile Pi trusts the project.
- Allows the project's plugin MCP servers with the new step.
- Calls the tool once.
- States the runs table. Its `CLAUDE_PLUGIN_DATA` is `{project dir}/.pi/pi-claude-marketplace/data/fixtures/hook-demo`.

The first draft, without an allow step, passed under builtin. Under adapter it failed at `the mcp implementation has listed the tools…` with `{"requests":[],"running":[]}`: pi-mcp-adapter blocks a project server without approval or the user's allow setting (D-CF6-03). The only existing step that writes that setting names pi-mcp-adapter, which an `@mcp` scenario may not do (DUAL-02). I stopped with a checkpoint. The orchestrator chose option A (deviation 3).

- **New step** in features/step_definitions/mcp-implementation.steps.ts: `Given the mcp implementation allows the project's plugin mcp servers`. Under the adapter profile it calls `allowProjectServersForUser(this)`. Under the builtin profile it does nothing, because Pi's built-in MCP asks only for trust (BLT-03, D-MB-09). The file's header lists it.
- **No duplicated logic.** `allowProjectServersForUser(world)` in features/lib/mcp-configuration.ts now holds the write, the release, and the read-back that the step `pi-mcp-adapter allows project mcp servers for the user` used to hold, and both steps call it. `writeProjectServersAllowedConfig` became that helper, and `PROJECT_SERVERS_ALLOWED_CONFIG` is no longer exported, because nothing outside the module reads it.

Runs:

| Run | Result |
|---|---|
| adapter, the guard scenario | exit 0, 1 scenario passed, 16 steps passed |
| builtin, the guard scenario | exit 0, 1 scenario passed, 16 steps passed |
| Mutation, builtin: `routingState.setMcpServers("project", [])` after the scope hydrate in `hydrateProjectScopeForCwdWith`, working tree only. Run on the draft before the allow step existed; that step does nothing under builtin | exit 1: `- 'mcp server'`, 1 scenario failed, 15 steps (14 passed, 1 failed) |
| Mutation, adapter, same edit | exit 1: `- 'mcp server'`, 1 scenario (1 failed), 16 steps (15 passed, 1 failed) |
| `git diff --quiet HEAD -- extensions test` after each mutation | exit 0 (restored with `git checkout -- <file>`) |
| adapter, mcp-tool-names.feature + features/mcp-server/project-scope.feature (the other user of the refactored step) | exit 0, 13 scenarios (13 passed), 189 steps |
| builtin, the same two files | exit 0, 7 scenarios (7 passed), 106 steps |
| `npm run check:features`; `npx tsc --noEmit`; eslint on the three step and lib files | exit 0 each |
| hooks integration (`test/integration/hooks-*.test.ts`), rerun before this commit | exit 0, 16 of 16 |

Acceptance greps: `mcpServerFor` appears 2 times in runtime.ts, `mcp_server` 2 in pre-tool-use.ts, `"source":"plugin"` 19 in mcp-tool-names.feature, `Scenario` 10, and `project-scope plugin's MCP tool receives` 1. The guard scenario names no MCP implementation in a step, a cell, or a doc string (`check:features` passes).

Node v26.13.1. I did not run `npm run check`, because the orchestrator runs the wave gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale description in tool-failure.feature**
- **Found during:** Task 1.
- **Issue:** The Feature description said "The payload leaves out `tool_use_id`, `duration_ms`, and `mcp_server` (D-CF5-28, D-BG-403)". 06-02 and 06-04 had already made the first two false, and this plan makes the third false.
- **Fix:** It now says "The payload carries `tool_use_id` and `duration_ms`, and `mcp_server` for a tool of a plugin's MCP server (D-PG6-04, D-PG6-07)." This is the only line outside the column that the column-removal check shows.
- **Files:** features/hook/tool-failure.feature. **Commit:** 7e9aca4b.

**2. The table count is 16, not 17**
- **Found during:** Task 1, the sweep.
- **Issue:** The planner counted the 17 tables with an MCP tool row at cff84369. Two of them can get no column: the echo-server table, whose server is in Pi's own `mcp.json`, and the failure table whose only row is an adapter name cut inside the server part. The criterion scenario adds one table.
- **Files:** none beyond the sweep.

### Orchestrator decision

**3. A new step for a project's plugin MCP servers (option A, pending maintainer review)**
- **Found during:** Task 2.
- **Issue:** The plan wanted one `@mcp` scenario with no new step text. pi-mcp-adapter needs the allow setting for a project server, and the only step that writes it names pi-mcp-adapter.
- **Fix:** The new profile-neutral step `Given the mcp implementation allows the project's plugin mcp servers`, and the helper `allowProjectServersForUser`, which the existing step now calls. The task-2 commit holds four files, not only the feature file: features/step_definitions/mcp-implementation.steps.ts, features/step_definitions/mcp-configuration.steps.ts, and features/lib/mcp-configuration.ts are outside the plan's file list.
- **Commit:** 97b98b22.

### Other notes

- Like the hooks hydrate, the table skips only the records that `isRecordedButDisabled` marks. A `dependencyDisabled` record still gives entries. Its servers are not registered, so this can only matter in a two-claim case, where it drops the field.
- `translatePreToolUse` spreads all of `toolFactFields`. A PreToolUse event never carries `hookDurationMs`, so it sends no `duration_ms`.
- I made no `gsd-tools windows append`, because no stub, skipped test, or unrun verify remains. The orchestrator records deviation 3.

## Flagged assumptions (repeated from the plan)

- **A6 (06-RESEARCH.md):** a plugin's MCP servers reach Pi only on a load, so a table built when the bridge hydrates is never staler than the tools. A server that Pi registered in the middle of a session would send no `mcp_server` until the next load. Not run.
- **A non-plugin MCP tool gets no field in this phase.** D-PG6-07 allows the object for such a tool only when the bridge can name its server and its Pi config scope. Under Pi's built-in MCP the bridge has the registered name but not the scope, and under pi-mcp-adapter it has neither, so the field is left out (06-RESEARCH.md finding F6 and open question 2). Plan 06-13 says so on the compatibility page. Pending maintainer review.
- **A server of Pi's own `mcp.json` that is registered under a plugin server's exact name** would read as that plugin's server under the built-in MCP. Pi's registry holds one server per name, so the two cannot be registered together.
- **The runtime value of Claude Code's field was not observed.** The key form `plugin:<plugin>:<server>` and the source `plugin` were read in the 2.1.323 binary (records U4 and U5), not in a run. D-PG6-07 marks the name as pending maintainer review.
- **A cut adapter name.** pi-mcp-adapter keeps the first 55 characters of a long tool name. When the server part fits in them, the prefix still names the server. When it does not, and no hook literal recovered the full name, the field is left out. The sweep found two such rows (see above).
- **Size and the second task.** The field, the table, and the sweep are one change, so task 06-05-01 holds them all. Task 06-05-02 is a guard scenario with recorded red runs.
- **Platform:** the scenarios run on Linux only.

## Records for the orchestrator (parent-owned lines, not applied)

- PROJECT.md Key Decisions: D-PG6-07 (`mcp_server` as an object; the name `plugin:<plugin>:<server>` and the source `plugin` read in Claude Code 2.1.323; left out for a non-plugin MCP tool), pending maintainer review.
- `.planning/codebase/ARCHITECTURE.md`, bridges section: the hooks bridge now reads a record's `mcpServerConfigs` from the state type for the server table (`bridges/hooks/mcp-server-table.ts`); `orchestrators/mcp/recorded-servers.ts` stays the one reader with the legacy path.
- BACKLOG.md: a new item for `mcp_server` on a non-plugin MCP tool (needs the Pi config scope of a server), if the maintainer wants it tracked.
- `.agents/skills/cucumber/rules/world-and-stand-ins.md`, section "The profile Pi and project trust". Add directly after the bullet that starts "Approval of project MCP servers is a separate `Given`":
  `- An `@mcp` scenario that needs a project-scope plugin's MCP server allows it with `Given the mcp implementation allows the project's plugin mcp servers` (`mcp-implementation.steps.ts`), before the profile Pi starts. Under pi-mcp-adapter it writes the same user-level `projectServers` setting (D-CF6-03); under Pi's built-in MCP it does nothing, because the built-in MCP asks only for trust (BLT-03, D-MB-09).`
- The orchestrator's deviation record for option A: the step and the helper above, pending maintainer review.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- **T-06-12 (mitigate):** the lookup is exact on the registered name under the built-in MCP, and on the whole `mcp__<key>_` prefix under the adapter. A name cut inside the prefix matches nothing, and two different servers on one key give no field. Owner cases cover the partial prefix, the cut name, and both two-claim forms.
- **T-06-14 (mitigate):** each hydrate rebuilds the table from the state, skips disabled records, and empties the project's table before the trust check. Owner cases cover the untrusted project, the failed read, and the replaced user entry, and the task-2 scenario with its two mutation reds guards the project path.
- **T-06-SC:** no package was installed and no version changed.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/bridges/hooks/mcp-server-table.ts
- FOUND: test/bridges/hooks/mcp-server-table.test.ts
- FOUND: 7e9aca4b (ancestor of HEAD)
- FOUND: 97b98b22 (HEAD)
- Working tree: only this SUMMARY, uncommitted.
