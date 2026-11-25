# Phase 1: Duplicate Integration Files - Context

**Gathered:** 2026-11-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase deletes two integration files whose cases repeat cucumber scenarios: `test/integration/hooks-spawn-end-to-end.test.ts` (ITDUP-01) and `test/integration/pi-subagents-child-identity.test.ts` (ITDUP-02). Before each file goes, a deliberate break of each behavior it pins must fail a scenario (REQUIREMENTS.md rule 2, ROADMAP "Check again, then delete"). The phase adds one missing scenario: a real pi-subagents child of an ordinary agent whose body is empty, whose `Bash` and failing `Read` hooks carry the child's identity. It adds a scenario to `plugin/session-start-hooks.feature` only if a break shows a gap. It changes no product behavior, unless a new scenario exposes a small product bug (rule 4).

Out of this phase: every other integration file (Phases 2 to 8), the suite charter (Phase 8, ITSCOPE-03), and `subagent-hook-ownership` (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Decided autonomously
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/lib/real-subagent-child.ts`: `runRealSubagentChild`, `runConcurrentRealSubagentChildren`, `parseRealChildAgents` (strict four-column table: `name`, `background`, `tools`, `tool calls`; body fixed to "Run the tools the task names."), `parseConcurrentLaunches` (already has a `body` column), `FIXTURE_TIMEOUT_MS`.
- `features/step_definitions/plugin/subagent-hooks.steps.ts`: the When step "pi-subagents, with its async-by-default setting {word}, launches from a main pi session a real child of each of these agents of a plugin with a stub mcp server, whose hooks record every event and whose stop hook would send a main session back:" (`unset` writes no pi-subagents configuration), and the Then steps "pi-subagents ran the real children like this:", "the real children's hooks record these runs in any order, and no main-session run names a child:", and "the main session's hooks record these runs for its control prompt:".
- `features/step_definitions/plugin/session-start-hooks.steps.ts`: the session start hook Given (runs `node "${CLAUDE_PLUGIN_ROOT}/session-start.cjs" <file>`, which appends `session_id` and `source` to a project file) and the "records these session start hook runs:" Then.
- `features/lib/hook-files.ts` and `features/step_definitions/hook/runs.steps.ts`: the hooks fixture writer (columns such as `timeout`, `sleep`, `exit code`) and the runs Then steps.

### Established Patterns
- Real-child scenarios carry `@mcp` when the plugin has a stub MCP server, so they run under both profiles.
- In hook runs tables, a cell holding a session id reads as its ordinal (`first`, `second`, ...); `CLAUDE_PLUGIN_ROOT` of a dir-source fixture is `{home}/marketplaces/<marketplace>/plugins/<plugin>`, outside the extension directory.
- The integration cases being deleted: HOOK-E2E-02 and HOOK-E2E-05 (`hooks-spawn-end-to-end`, a mock Pi with the production `dispatchHookExec`); four child cases, six runs (`pi-subagents-child-identity`: detached background and MCP children under both profiles, the empty-body ordinary child under both profiles, the foreground default under adapter, the concurrent runner children under adapter).

### Integration Points
- Docs that cite `pi-subagents-child-identity.test.ts`: `docs/mcp-compatibility.md` and `docs/hooks-compatibility.md`.
- After this phase, `subagent-hook-ownership.test.ts` is the only integration file that imports from `features/lib`.

</code_context>

<specifics>
## Specific Ideas

Environment facts for every planner, executor, and verifier of this run (from `.planning/research/PITFALLS.md` Pitfall 18 and the component-features child brief; the parent measured them again on 2026-11-21):

- The container runs as root, which ignores the `chmod` tricks of the permission-injection tests: about 167 unit, cucumber, and integration cases fail as root on any tree. Run every npm script, and every commit whose hook runs npm scripts, with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. The wrapper (already created, checked to drop DAC) runs `setpriv --bounding-set=-dac_override,-dac_read_search --inh-caps=-dac_override,-dac_read_search /bin/sh "$@"`. It skips no check.
- Warm ESLint with a lone `npm run lint` first; a cold run under parallel load can run out of memory.
- Inside `.claude/worktrees/...` the commit hook may print "(no files to check)" for `npm run check:commit` and prettier, because the pre-commit `exclude` matches worktree paths. Executors run `npm run check:static` and their tests by hand before committing; the post-merge `npm run check` in the main checkout is the backstop.
- If zizmor fails with 401, run the commit with `env -u GH_TOKEN -u GITHUB_TOKEN`.
- Parallel executors share the scratchpad: each uses its own subfolder for temp files.
- A plan that deletes a file declares it in `files_deleted` frontmatter, or the worktree merge guard blocks it.
- `node scripts/install-test-peers.mjs` installs the cucumber peer cache (`npm run test:cucumber` also runs it).
- The GSD tool `check evaluation-scope` reports 0 commits because project rules keep plan IDs out of commit titles; that is expected.
- Node here is v22.23.5 (inside the engines range); CI runs Node 24.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
