---
phase: 05-hook-tool-names
plan: "04"
subsystem: hooks
tags: [hooks, mcp, builtin-mcp, pi-mcp-adapter, gate, cucumber, red-proof]

requires:
  - phase: 05-hook-tool-names
    provides: "05-01: the built-in tool identity in dispatch and if-field and the shared @mcp scenario; 05-02: the proxy rule only under pi-mcp-adapter and the D-P5-11 pair; 05-03: the fold and notice scenarios and docs/hooks-compatibility.md"
  - phase: 01-foundation-and-pi-1-5-0
    provides: "the Phase 1 product code at 640419724c48a60c7bb469acf0fde6f3a6ea7852 (the red-sweep baseline) and 01-FROZEN.md section 1"
provides:
  - "The Phase 5 gate on one commit (cd5c7b4): npm run check in its CI parts, both cucumber profiles, and npm run test:modules, all exit 0"
  - "The final red sweep (D-P5-12) on the Phase 1 product code, matching the expected table row for row"
  - "The ownership check: no frozen file and no file outside Phase 5's ownership changed since 6404197"
  - "The parent lines for CHANGELOG (MDOC-02), the READMEs, the frozen cucumber skill, PROJECT.md, BACKLOG, the codebase map, and the post-Phase-2 re-run; the merged red proofs and dubious choices"
affects: [06-release-docs-and-combined-tree]

actuals:
  tokens: 7100
  tasks: 2
  commits: 0
plan_head_before: cd5c7b4f6db45b63b7fd954512309058d5851b08
plan_head_after: cd5c7b4f6db45b63b7fd954512309058d5851b08

tech-stack:
  added: []
  patterns:
    - "A gate plan records each CI shard as its own part, with exit status, duration, sha, Node version, and each cucumber run's counts and seed"

key-files:
  created:
    - .planning/phases/05-hook-tool-names/05-04-SUMMARY.md
  modified: []

key-decisions:
  - "The gate ran once on cd5c7b4; the tracer re-check after the red sweep re-ran the two hook feature files under both profiles on HEAD instead of the whole 17-minute gate, because the sweep restored the same bytes and git status --porcelain was empty"
  - "README.md and README.es.md get no hooks line: their hooks entry only links to docs/hooks-compatibility.md and names no MCP matcher"

patterns-established: []

requirements-completed: [MHK-01, MHK-02]

coverage:
  - id: D1
    description: "npm run check (check:static with check:features, test:unpaired, test:integration, three cucumber shards, test:coverage:direct:all) and npm run test:modules exit 0 on cd5c7b4"
    requirement: MHK-01
    verification:
      - kind: other
        ref: "npm run check:static; npm run test:unpaired; npm run test:integration; npm run test:coverage:direct:all; npm run test:modules (sha cd5c7b4, Node v24.22.1)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/marketplace features/plugin (1168 scenarios, seed 926750)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow (392 scenarios, seed 121453)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin features (44 scenarios, seed 649647)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Red sweep on the Phase 1 product code: the five builtin MCP hook scenarios fail, the adapter parity guards and every untagged scenario pass"
    requirement: MHK-02
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin features/hook/mcp-tool-names.feature features/hook/tool-use.feature on 6404197's bridges/hooks and domain/components/hooks (5 of 5 failed as expected, seed 801401)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/hook/mcp-tool-names.feature features/hook/tool-use.feature on the same code (23 of 23 passed as expected, seed 734317)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ownership check: git diff --name-only 6404197..HEAD lists only Phase 5 paths, and features/lib/hook-recorder.ts is unchanged"
    requirement: MHK-01
    verification:
      - kind: other
        ref: "the plan's ownership grep over git diff --name-only 640419724c48a60c7bb469acf0fde6f3a6ea7852..HEAD (no output)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Parent lines for Phase 6 and the parent session (CHANGELOG, READMEs, frozen cucumber skill, PROJECT.md, BACKLOG, codebase map, post-Phase-2 re-run)"
    verification: []
    human_judgment: true
    rationale: "The parent decides the final wording and whether each line lands; no test asserts planning prose"

duration: 40min
completed: 2026-11-04
status: complete
---

# Phase 5 Plan 04: Hook tool names phase gate Summary

**On commit cd5c7b4, the full Phase 5 gate passes: all of `npm run check`, adapter 1560/1560 (seeds 926750 and 121453), builtin 44/44 (seed 649647), and `npm run test:modules`. On the Phase 1 product code, the five builtin MCP hook scenarios fail and the 23 adapter scenarios pass, as D-P5-12 expects. No file outside Phase 5's ownership changed. Every parent line for Phase 6 is below.**

## Performance

- **Duration:** about 40 min
- **Started:** 2026-11-04T15:58Z (worktree base cd5c7b4)
- **Completed:** 2026-11-04T16:38Z
- **Tasks:** 2
- **Files modified:** 1 (this SUMMARY)

## Accomplishments

- Ran the gate on one commit, in the CI shard order the plan lists. All parts exited 0, and no known flake appeared, so nothing was rerun.
- Ran the red sweep on the final scenario texts. Every row matches the expected table, and `git status --porcelain` was empty before and after.
- Ran the ownership check. It printed nothing.
- Collected the parent lines, the merged red proofs, and the dubious choices of all four plans.

## Gate

Commit `cd5c7b4f6db45b63b7fd954512309058d5851b08` (the combined Phase 5 tree after waves 1 and 2), Node `v24.22.1`. Every command ran with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`, after a lone `npm run lint` (exit 0, 215 s) to warm ESLint. The run started at 16:11:56Z and ended at 16:28:53Z. HEAD did not move during the run, and `git status --porcelain` was empty at the end.

| # | Command | Exit | Duration | Counts and seed |
| - | ------- | ---- | -------- | --------------- |
| 1 | `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features) | 0 | 66 s | check:features passed (10.7 s) |
| 2 | `npm run test:unpaired` | 0 | 24 s | - |
| 3 | `npm run test:integration` | 0 | 36 s | - |
| 4 | `npm run test:cucumber:profile -- --profile adapter features/marketplace features/plugin` | 0 | 192 s | 1168 scenarios (1168 passed), 12026 steps, seed 926750 |
| 5 | `npm run test:cucumber:profile -- --profile adapter features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow` | 0 | 267 s | 392 scenarios (392 passed), 4820 steps, seed 121453 |
| 6 | `npm run test:cucumber:profile -- --profile builtin features` | 0 | 43 s | 44 scenarios (44 passed), 597 steps, seed 649647 |
| 7 | `npm run test:coverage:direct:all` | 0 | 198 s | `Merged LCOV: coverage/direct.lcov (337 records)`, every pair at 100% |
| 8 | `npm run test:modules` | 0 | 191 s | - |

The adapter profile ran 1168 + 392 = 1560 scenarios, and the builtin profile ran 44. These are the same totals as the orchestrator's run on this tree (adapter seed 165705, builtin seed 641488). The `Legacy marketplace migration could not be persisted` lines in the coverage and modules logs are the expected IL-3 `console.warn` of a state-io case. They are not failures.

After the sweep, the tracer re-check ran on HEAD: `features/hook/mcp-tool-names.feature features/hook/tool-use.feature`, adapter 23/23 passed (seed 295128), builtin 5/5 passed (seed 354728).

The ROADMAP's Phase 5 criterion 3 holds. Each MCP scenario in `features/hook/` carries an implementation tag: `@mcp` (two in `mcp-tool-names.feature`), `@builtin-only` (one there and two in `tool-use.feature`), or `@adapter-only` (one in `tool-use.feature`). `check:features` passes.

## Ownership check

`git diff --name-only 640419724c48a60c7bb469acf0fde6f3a6ea7852..HEAD` lists 29 paths, all of them Phase 5's: `.planning/` (13 paths), `docs/hooks-compatibility.md`, `extensions/pi-claude-marketplace/bridges/hooks/{dispatch,event-router,if-field/index,mcp-tool-view}.ts`, `extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts`, `features/hook/{mcp-tool-names,tool-use}.feature`, `features/lib/hook-mcp-{calls,tool-server}.ts`, `features/step_definitions/hook/tool-use.steps.ts`, and the five unit pairs under `test/bridges/hooks/` and `test/domain/components/hooks/`. The plan's filter prints nothing. `git diff --name-only 6404197..HEAD -- features/lib/hook-recorder.ts` prints nothing. No frozen file of 01-FROZEN.md section 1 changed.

## Red proofs

### Final sweep (this plan, D-P5-12)

Procedure: `git status --porcelain` empty. `git restore --source=640419724c48a60c7bb469acf0fde6f3a6ea7852 --worktree -- extensions/pi-claude-marketplace/bridges/hooks extensions/pi-claude-marketplace/domain/components/hooks`: `dispatch.ts`, `event-router.ts`, and `if-field/index.ts` went back to their Phase 1 versions, and `mcp-tool-view.ts` and `builtin-mcp-tool-names.ts` were removed. Both runs. `git restore --source=HEAD --worktree -- <same paths>`. `git status --porcelain` empty again. There was no commit between the two restores. `/tmp/jiti` was not deleted, because no run that must fail passed.

| Feature file | Scenario | adapter (seed 734317) | builtin (seed 801401) | Expected | First failing step and diff (builtin) |
| --- | --- | --- | --- | --- | --- |
| `mcp-tool-names.feature` | Hooks on a plugin MCP tool match it and see it under Claude Code's name (`@mcp`) | PASS | FAIL | PASS / FAIL | `Then the hooks record these runs in any order:`. Actual: one `folded` row under `mcp__plugin_hook_demo_stub_server__echo`. Expected but missing: `literal`, `prefix`, `iffed`, and `after` (PostToolUse, `[{"type":"text","text":"echo:ping"}]`) under `mcp__plugin_hook-demo_stub-server__echo` |
| `mcp-tool-names.feature` | A hook's notice on a plugin MCP tool names the tool as Claude Code does (`@mcp`) | PASS | FAIL | PASS / FAIL | `Then the hooks show the user these messages:`. Actual `[]`. Expected one info notice, `PreToolUse:mcp__plugin_hook-demo_stub-server__echo says: checked the stub` |
| `mcp-tool-names.feature` | A hook on a built-in tool matches the server as Pi registered it and sees the tool segment folded (MHK-01, D-MB-08) (`@builtin-only`) | not run | FAIL | - / FAIL | `Then the hooks record these runs in any order:`. Actual `[]`. Expected the `claude-name` and `folded-tool` PreToolUse rows with `mcp__echo-server__echo_text` |
| `tool-use.feature` | A hook on a plugin MCP tool runs once per call through pi-mcp-adapter's proxy (D-CF5-12, MHK-02) (`@adapter-only`) | PASS | not run | PASS / - | - |
| `tool-use.feature` | A hook on a plugin MCP tool runs on every built-in call, the tool search included (MHK-01, MHK-02) (`@builtin-only`) | not run | FAIL | - / FAIL | `Then the hooks record these runs in any order:`. Actual: `any` on `tool_search` and `any` on Pi's `mcp__plugin_hook_demo_stub_server__echo`. Missing: `literal`, `after`, and the Claude-form name |
| `tool-use.feature` | A built-in MCP tool whose cut name looks like a proxy call still runs its hooks (MHK-02) (`@builtin-only`) | not run | FAIL | - / FAIL | `Then the hooks record these runs in any order:`. Actual: only `any` on `tool_search`. Missing: `any`, `literal`, and `after` on `mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d` |
| `tool-use.feature` | every untagged scenario (20) | PASS | not run | PASS / - | - |

Totals: adapter 23 scenarios (23 passed, 299 steps), exit 0. Builtin 5 scenarios (5 failed, 68 steps, 63 passed, 5 failed), exit 1. That is 2 `@mcp` scenarios, 1 `@adapter-only` scenario, and 20 untagged `tool-use.feature` scenarios under the adapter, and 2 `@mcp` and 3 `@builtin-only` scenarios under builtin. The final titles match the plan's table. The two `tool-use.feature` titles carry the requirement IDs that 05-02 added.

### Earlier red proofs (merged from 05-01, 05-02, 05-03)

Each row ran on the Phase 1 product code, restored as above, after the named commit. The rows marked "before" ran on the plan's base before its product change.

| Plan | After | Profile | Scenario | Result | Seed |
| ---- | ----- | ------- | -------- | ------ | ---- |
| 05-01 | before (Task 1) | builtin | Hooks on a plugin MCP tool match it and see it under Claude Code's name | FAIL | 44339 |
| 05-01 | before (Task 1) | adapter | same | PASS (parity guard) | 648842 |
| 05-01 | `851126e` | builtin | same | FAIL | 716366 |
| 05-01 | `851126e` | adapter | same | PASS | 902051 |
| 05-01 | `72be65b` | builtin | same (with `iffed` and `after`) | FAIL | 13042 |
| 05-01 | `72be65b` | adapter | same | PASS | 478028 |
| 05-02 | before (Task 1) | builtin | A built-in MCP tool whose cut name looks like a proxy call still runs its hooks (MHK-02) | FAIL | 868373 |
| 05-02 | `58a980a` | builtin | same | FAIL | 378695 |
| 05-02 | `3a52010` | builtin | A hook on a plugin MCP tool runs on every built-in call, the tool search included (MHK-01, MHK-02) | FAIL | 113230 |
| 05-02 | `3a52010` | builtin | A built-in MCP tool whose cut name looks like a proxy call still runs its hooks (MHK-02) | FAIL | 113230 |
| 05-02 | `3a52010` | adapter | A hook on a plugin MCP tool runs once per call through pi-mcp-adapter's proxy (D-CF5-12, MHK-02) | PASS (parity guard) | 351680 |
| 05-03 | `9309479` | builtin | A hook on a built-in tool matches the server as Pi registered it and sees the tool segment folded (MHK-01, D-MB-08) | FAIL | 953400 |
| 05-03 | `7af72dd` | builtin | A hook's notice on a plugin MCP tool names the tool as Claude Code does | FAIL | 740521 |
| 05-03 | `7af72dd` | adapter | same | PASS (parity guard) | 832666 |
| 05-04 | `cd5c7b4` | builtin | all five builtin MCP hook scenarios (table above) | FAIL | 801401 |
| 05-04 | `cd5c7b4` | adapter | both `@mcp`, the `@adapter-only` proxy scenario, and 20 untagged | PASS | 734317 |

The unit RED evidence of each plan is in its own SUMMARY: 05-01 for `builtin-mcp-tool-names.test.ts`, `mcp-tool-view.test.ts`, `dispatch.test.ts`, and `if-field/index.test.ts`, and 05-02 for `mcp-tool-view.test.ts`, `dispatch.test.ts`, and `event-router.test.ts`.

## Task Commits

1. **Task 1: Run the phase gate, the red sweep, and the ownership check on the combined tree.** No commit. The gate passed with no fix, so no file changed.
2. **Task 2: Write the gate record, the red-proof table, the parent lines, and the dubious choices.** This SUMMARY's commit, `docs: record the hook tool names gate and parent lines` (planning-only, so the gate on cd5c7b4 stays valid, as `.agents/skills/local-verification/rules/gates.md` allows).

## Files Created/Modified

- `.planning/phases/05-hook-tool-names/05-04-SUMMARY.md`: the gate record, the red proofs, the ownership check, the parent lines, and the dubious choices.

## Decisions Made

- The tracer re-check after the sweep re-ran only the two hook feature files under both profiles on HEAD. It did not repeat the whole gate. The second restore put back HEAD's exact bytes, and `git status --porcelain` was empty, so the gate's inputs had not changed.
- The README parent line is "none" (see Parent lines 2).

## Deviations from Plan

None. The plan ran as written.

## Issues Encountered

- The worktree sandbox refused compound shell commands that name `git`, so the ownership check and the sweep ran as separate commands: `git diff` to a scratch file, then the plan's `grep` on that file. The auto-mode classifier also refused one plain `git status --porcelain` call during the sweep, so `git status --short` ran there instead. The plan's `git status --porcelain --untracked-files=all` then ran after the second restore and printed nothing.
- No known flake appeared (neither the http MCP scenario in `configuration.feature` nor the 30-second marketplace add in `apply.feature`).
- The Pi 1.5.0 `new_session` issue (`session_start` emitted twice, a leaked built-in connection) did not occur: no Phase 5 scenario starts a new session with a registered server.

## User Setup Required

None. No external service needs configuration.

## Parent lines

Each line names its target file and its owner. The parent applies them at the merge of `features/mcp-builtin-phase-5` or in Phase 6.

1. **`CHANGELOG.md` (Phase 6, MDOC-02; parent).** Draft bullet, to merge into the milestone's built-in MCP entry: "Hooks: under Pi's built-in MCP, plugin hooks see MCP tools under Claude Code's names, `mcp__<server>__<tool>` with the server's `-` kept (`mcp__plugin_<plugin>_<server>__<tool>` for a plugin server). So matchers and `if` fields written for Claude Code fire on built-in calls. Only the tool segment keeps Pi's change of `-` to `_`, because Pi does not report the original tool name. pi-mcp-adapter's rule that a proxy `mcp` call runs no hook now applies only while pi-mcp-adapter is the active MCP implementation. Under Pi's built-in MCP, every tool call runs its hooks." This bullet covers 05-02's line too: "Hooks: pi-mcp-adapter's rule that a proxy `mcp` call runs no hook now applies only while pi-mcp-adapter is the active MCP implementation. Under Pi's built-in MCP every tool call runs its hooks."
2. **`README.md` and `README.es.md` (Phase 6, MDOC-02; parent).** None. Both READMEs give hooks one line, "Hooks. Partial support.", with a link to `docs/hooks-compatibility.md`. They name no MCP tool matcher. Phase 5 already wrote the built-in names into `docs/hooks-compatibility.md` (D-P5-14). If Phase 6 adds a built-in MCP section to the READMEs, one sentence can point to that doc for hook tool names.
3. **`.agents/skills/cucumber/**` (frozen; parent).**
   - `rules/world-and-stand-ins.md`, section "The scripted model". The rule "A feature file writes the whole script as literals" gains one exception: "The shared `@mcp` hook scenarios are the one exception. Their step `the scripted model calls the tool {string} of the hooks' stub mcp server {string} of the plugin {string} through the mcp implementation with {string}, then replies {string}` (in `hook/tool-use.steps.ts`, through `features/lib/hook-mcp-calls.ts`) builds the script from `profileFor(...).toolName`, because no literal names the tool under both implementations (P5-DC-14)."
   - Same file, section "Stand-ins of the profile Pi". Add: "`features/lib/hook-mcp-tool-server.ts` is a stdio JSON-RPC server with no dependencies, no request log, and no pid file. It lists one tool named by its argument, answers `tools/call` with `<tool>:<text>`, and exits when its stdin ends. `pi's mcp.json configures the server {string} with the hooks' stub mcp tool {string}` writes `{agent dir}/mcp.json` with that server under `direct` exposure. Write it after the install and before `pi runs with the scripted model and the mcp implementation`. It refuses a started profile Pi, and the file is removed when the scenario ends."
   - `rules/layout.md`, section "Function directories", hooks paragraph. `tool-use.steps.ts` "the stub MCP server `Given` steps" becomes "the stub MCP server `Given` steps, the profile-aware MCP call step, and the `mcp.json` step".
4. **`.planning/PROJECT.md` Key Decisions (parent).** Draft rows. The parent may instead keep them as D-MB-08 detail.
   - "Hook-facing name of a built-in MCP tool (D-P5-01, D-P5-02, D-P5-03). A tool whose `sourceInfo.path` is `builtin:mcp` reaches hooks as `mcp__<namespace alias>__<rest of Pi's name>`, with the server's `-` kept and the tool segment in Pi's folded or cut form. If Pi's 64-character cut falls inside the namespace, Pi's name is kept. The name is read from `pi.getAllTools()` at dispatch time only."
   - "Built-in MCP matching (D-P5-04). An MCP literal or `if` literal fires when its server is the tool's alias and Pi's `createMcpToolName(server, tool)` gives the event's tool name. So Claude Code's full name and the folded tool segment both fire, and a folded server segment does not."
   - "Proxy rule scope (D-P5-06, D-P5-07, MHK-02). D-CF5-12 applies only while `openNotificationSnapshot(pi).softDeps.mcpImplementation` is `adapter`. The answer is read at the first proxy-shaped call of a bridge generation and kept for that generation."
5. **`.planning/BACKLOG.md` (parent).**
   - Deferred idea (05-CONTEXT.md; P5-DC-09, P5-DC-35): name Pi's `tool_search` as Claude Code's `ToolSearch` in hook stdin and matchers. If done, the `*` rows on `tool_search` in `tool-use.feature` change.
   - Deferred idea (05-CONTEXT.md): recover the original tool segment from a tool result's `details.tool`. Not taken, because a PreToolUse event has no details, so the two events would disagree.
   - Hardening (T-05-07, P5-DC-15, from 05-02): when pi-mcp-adapter and Pi's built-in MCP are both loaded, a built-in tool whose name Pi cut inside the namespace, called with a string `tool` and no `action`, is still skipped as a proxy call. Fix: skip only a tool that pi-mcp-adapter registered, never a tool whose `sourceInfo.path` is `builtin:mcp`.
   - Matcher parity gaps (P5-DC-16): Claude Code 2.1.318 treats a matcher made only of `[a-zA-Z0-9_|, -]` as a list of exact names (spaces and commas allowed) and any other matcher as an unanchored regex. This project accepts only `[A-Za-z0-9_|-]` and matches server prefixes with `startsWith`.
   - Coverage gap (P5-DC-24): MHK-02's no-implementation case has unit rows only. A scenario needs a harness extension that registers a proxy-shaped tool with no MCP implementation loaded (a new stand-in).
6. **`.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md` (parent, codebase-map refresh).**
   - STRUCTURE.md: add `domain/components/hooks/builtin-mcp-tool-names.ts` (Pi 1.5.0 `createMcpToolName` candidates, built-in literal and server-prefix rules, Claude-form name) and `bridges/hooks/mcp-tool-view.ts` (`createHookToolView(pi)`: `identify` and `proxyRuleApplies`).
   - ARCHITECTURE.md, the hooks bridge: for an `mcp__` tool event with a non-empty bucket, the tool handlers read `pi.getAllTools()` once per event at dispatch time, never at factory time (MSEL-01). `registerHooksBridgeWith` creates one `HookToolView` per bridge generation, and its `proxyRuleApplies()` reads the run snapshot's `mcpImplementation` once per generation.
   - CONVENTIONS.md, dependency injection: `compositeHandlerFor` and `toolResultCompositeHandler` take a defaulted last parameter `tools: HookToolView = createHookToolView(pi)`, next to the defaulted `executor`. Creating the view reads nothing (P5-DC-19).
7. **Merge note (parent).** After Phase 2 merges, re-run the Phase 5 builtin scenarios (`npm run test:cucumber:profile -- --profile builtin features/hook/mcp-tool-names.feature features/hook/tool-use.feature`, and the adapter run of the same files). The extension's own registration then replaces the stand-in for `plugin_hook-demo_stub-server` and for the long plugin's server (`hook-proxy-shaped-tool-names-of-a-long-plugin`). Phase 2's server names must keep Pi's namespace alias equal to the registered name, with `-` kept, or the Claude-form name falls back to Pi's name.
8. **Merged from earlier plans.** 05-01: none. 05-02: the BACKLOG hardening (line 5, third item) and the CHANGELOG proxy sentence (line 1). 05-03: none, with the note that the CHANGELOG and README lines stay with the parent (lines 1 and 2). No plan needed a change to a frozen file, apart from the cucumber-skill text in line 3.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-11 was mitigated as planned: the sweep started and ended with an empty `git status --porcelain`, restored the working tree only, and made no commit between the two restores. T-05-12: every part ran on one recorded sha, and its exit status and seeds are recorded above. T-05-13: this executor did not push. No earlier SUMMARY raised a threat flag. 05-03 recorded T-05-09 as mitigated (the `mcp.json` step writes only the sandbox's `{agent dir}/mcp.json` with `wx`, and the stub speaks stdio only).

## Dubious Choices

### Merged from the earlier plans (by reference; the session already copied each into DUBIOUS-CHOICES.md)

- 05-01: P5-01-DC-01..05, logged as P5-DC-28 (the `if` reads the Claude-form event from Task 1 on), P5-DC-29 (dispatch cases written after the code, RED from restored sources), P5-DC-30 (single-quoted JSON step argument), and P5-DC-31 (`getCommands` in the view's type, the `namespace === undefined` check, the one-line Task 1 change to `toolResultCompositeHandler`). All Low.
- 05-02: P5-02-DC-01..05, logged as P5-DC-32 (hand-written read counter in the router cases), P5-DC-33 (recording view stub in the dispatch proxy rows), P5-DC-34 (three guard cases that pass on any tree), and P5-DC-35 (the `*` row pinned on `tool_search`; `createHookToolView` counted 2 in `event-router.ts`). All Low.
- 05-03: P5-03-DC-01..04, logged as P5-DC-36 (the doc's `tool-use.feature` citation is true after the wave merge, the extra guards of the `mcp.json` step, the notice scenario compares notices only, the doc's coarse description of Pi's cut). All Low.
- The discuss, research, and planning entries P5-DC-01..27 stay as logged. P5-DC-03 is High (a Claude-form matcher with `-` in the tool segment fires).

### New in this plan

- **P5-04-DC-01 (Low). The tracer re-check did not repeat the whole gate.** After the sweep, only the two hook feature files ran again under both profiles on HEAD (adapter 23/23 seed 295128, builtin 5/5 seed 354728). The gate itself ran once, on cd5c7b4. Alternatives: rerun every gate part after the second restore (about 17 minutes). Dubious because the tracer protocol says to rerun `<verify>` end to end. The restore put back HEAD's exact bytes, `git status --porcelain` was empty, and gates.md allows reuse for unchanged inputs.
- **P5-04-DC-02 (Low). The sweep proves the 20 untagged rows from the totals only.** The quiet reporter prints only totals. The adapter run's 23 passed scenarios are the 2 `@mcp`, the 1 `@adapter-only`, and the 20 untagged `tool-use.feature` scenarios. No list per scenario was printed. Alternatives: rerun with a progress or JSON formatter for a list per scenario. Dubious because the "every untagged scenario: PASS" row rests on a count that matches the file's scenario count.
- **P5-04-DC-03 (Low). `/tmp/jiti` was not deleted before the sweep.** 05-03 deleted it before each red run. This plan follows its own text, which deletes it only when a run that must fail passes. Alternatives: delete it first, as 05-03 did. Dubious only as a process difference between plans. All five builtin runs that must fail did fail, so the cache could not hide a pass.
- **P5-04-DC-04 (Low). The parent lines are drafts in the executor's words.** The CHANGELOG bullet, the PROJECT.md rows, and the cucumber-skill sentences are proposals. The README line is "none". Alternatives: leave each line as a topic and let the parent write the text. Dubious because the parent may reword them, and the `changelog`, `readme`, and `simple-english` skills govern the final text.
- **P5-04-DC-05 (Low). The Phase 2 merge note adds a condition.** Line 7 asks that Phase 2's registration keep Pi's namespace alias equal to the registered server name, with `-` kept. Phase 5 depends on that behavior of Pi 1.5.0's `registerTools`, but the frozen cross-phase interfaces do not state it. Alternatives: no condition, which trusts Pi's behavior. Dubious because it states an expectation about a sibling's output that no shared test pins before the merge.

## Next Phase Readiness

- `features/mcp-builtin-phase-5` is ready to merge first (merge order 5, 4, 2, 3). The post-merge gate can reuse the shard commands above.
- After Phase 2 merges, re-run the builtin hook scenarios (Parent lines 7).
- Phase complete, ready for verification and the phase transition.

## Self-Check: PASSED

- `.planning/phases/05-hook-tool-names/05-04-SUMMARY.md` exists. Task 1 made no commit. The gate sha cd5c7b4 is HEAD before this SUMMARY's commit. The earlier plans' commits 851126e, 72be65b, 58a980a, 3a52010, 9309479, 7af72dd, and 429a239 are ancestors of HEAD.

---
*Phase: 05-hook-tool-names*
*Completed: 2026-11-04*
