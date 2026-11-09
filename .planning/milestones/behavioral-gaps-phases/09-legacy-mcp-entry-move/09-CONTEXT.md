# Phase 9: Legacy MCP Entry Move - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning
**Mode:** autonomous smart discuss in a child session; the user asked for the recommended answer on every question, so each decision below is the recommendation, auto-accepted. Decision IDs use this phase's block, D-BG-901 to D-BG-999 (D-BG-15, P1-DC-13).

<domain>
## Phase Boundary

Phase 9 adds the cucumber scenarios that pin the load-time move of a plugin's legacy `mcp.json` entries into `mcp-adapter.json` (AMIG-01) and the move's care for the user's own, unmarked entries (AMIG-02). It owns `features/mcp-server/legacy-move.feature` (seeded by Phase 1), the new verb step module `features/step_definitions/mcp-server/legacy-move.steps.ts`, and the product file `orchestrators/reconcile/mcp-migration.ts` with its unit pair `test/orchestrators/reconcile/mcp-migration.test.ts`. It changes product code only for a bug that one of its scenarios exposes in that file. A fix anywhere else is a parent line and a dubious choice.

The move is the project's own contract (AMIG-01 to AMIG-04 of mcp-4, MSEL-04 and D-MB-21 of mcp-builtin); Claude Code has no counterpart, so there is no upstream research step.

</domain>

<decisions>
## Implementation Decisions

### What the move reports, and when (D-BG-901, D-BG-902)

- **D-BG-901 — the report is pinned as the session's results.** A scenario reads the move's report through `the session reports these results:`: one `mcp-migration` result with severity `info`, `needs reload` true, no notices, and one `moved` row per legacy server (`from` the declared name, `to` the generated key), as the seed does. The rendered notice text (AMIG-03's wording, the re-sign-in and re-approval sentence, the reload hint) is not pinned: the notification grammar owns it, its unit tests cover it, and AMIG-03 is not a requirement of this milestone.
- **D-BG-902 — the move runs on a load, and a second load is a scenario of its own.** The first load after the legacy entries appear (a new session) moves them and reports. A second load moves nothing, reports nothing, and leaves the bytes of both `mcp.json` and `mcp-adapter.json` as the first load left them (success criterion 3). The feature rules allow one behavior per scenario, so the second load is its own scenario, with the first load as `Given the user has started a new pi session`. A command never runs the move; no scenario expects it from one.

### The builtin profile and the tags (D-BG-903)

- **D-BG-903 — every scenario carries `@mcp` and expects the same result under both profiles.** The move reads no MCP implementation, and `mcp-adapter.json` is written whatever the active implementation (MSEL-04, D-P3-16), so the rows and the bytes of both files are the same under `adapter` and `builtin`. The scenarios have an MCP surface, so they carry `@mcp` (D-BG-05), not a pair. P1-DC-18 left a split open because Pi's built-in MCP reads the same user-scope `mcp.json`; D-MB-21 makes that a one-session duplicate that changes neither file nor the report. If the builtin run of a scenario does show a different expectation, only that scenario becomes an `@adapter-only`/`@builtin-only` pair licensed by D-MB-21, and the split is a dubious choice.

### The servers still run (D-BG-904)

- **D-BG-904 — "the servers still run" is the active implementation listing the moved server's tools under its new name.** A scenario with the stub MCP server (`the published plugin ... has the stub mcp server "stub"`) installs through the run's Pi, writes the 0.19.2 `mcp.json` with the frozen legacy step, then starts the profile Pi with `pi runs with the scripted model and the mcp implementation`, whose load moves the entries. `Given the user has started a new pi session` stands for the reload the move asks for. Then `the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"`, `When the user lists the mcp tools pi offers`, and `Then pi offers these plugin mcp tools:` show `mcp__plugin_demo_stub__echo`, the same rows under both profiles as the MREC-02 scenario of `implementation-switch.feature`. The scenario also states that `mcp.json` holds only the user's own server, so it fails without the move under the builtin profile too, where the extension's own registration serves the server from the record whatever the files hold. No model call: a call needs a script per implementation, which would force a pair for no extra signal. The exact step order inside the frozen-step constraints is the executor's call, as long as every `Given` precedes the first `When`.

### The user's own entries (D-BG-905)

- **D-BG-905 — "byte for byte" means each unmarked entry keeps its content and its place.** The move rewrites `mcp.json` as two-space JSON and drops comments with a `comments-dropped` notice (AFILE-04), so the file's bytes can change while the user's entries do not. A scenario writes the user's own servers in that two-space form before the frozen legacy step adds the plugin's marked entries beside them, and compares the whole text of `mcp.json` after the load: the user's entries keep their members, their member order, and their order among themselves, and only the plugin's marked entries are gone. The user's servers cover several shapes: stdio servers with `args` and `env`, an unexpanded `${VAR}` reference the move must not expand, and an unmarked copy of a plugin entry (the plugin's members and env but no `_piClaudeMarketplace` marker), which stays because only the marker makes an entry the plugin's. Any top-level member other than `mcpServers` that the scenario writes must be one that neither implementation interprets. The Given that writes the user's servers is new and lives in `mcp-server/legacy-move.steps.ts`.

### Scope coverage (D-BG-906, D-BG-907)

- **D-BG-906 — the user scope, plus one project-scope move.** The seed, the second-load scenario, the servers-run scenario, and the AMIG-02 scenario use the user scope. One more scenario installs the plugin in the project scope and shows the load moving the entries of the project's `mcp.json` (`{project dir}/.pi/mcp.json`) into the project's `mcp-adapter.json`, with project rows and the project's data directory, because each scope keeps its own legacy file and the move runs per scope.
- **D-BG-907 — out of scope.** AMIG-03's notice wording, AMIG-04's unowned entries, a disabled plugin's entries, collisions, unparseable files, stub cleanup in the project file, and the write-order fault injection stay with the unit tests in `test/orchestrators/reconcile/mcp-migration.test.ts`. The phase adds no scenario for them.

### Claude's Discretion

- The text of the new Given (D-BG-905) and any other step the scenarios need, within `steps.md`: lower case, a Cucumber expression, whole-value assertions, and a setup Given that asserts its own result.
- Scenario titles and the feature description, within `features.md`.
- Whether the seed's title or steps change, as long as every step layout.md lists for the Phase 9 seed stays in use.
- How the plans split across waves.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `features/step_definitions/mcp-configuration.steps.ts` (frozen): `the mcp.json file of the {word} scope holds the servers of the plugin {string} as release 0.19.2 wrote them, beside the user's own server {string}` writes the 0.19.2 shape through `writeLegacyMcpConfig()` in `features/lib/mcp-configuration.ts`. The writer keeps every existing member and server of `mcp.json`, adds the user's server and then the plugin's marked entries, and removes the plugin's generated entries from `mcp-adapter.json`. `the mcp configuration file {string} of the {word} scope holds this text:` compares a whole file with run tokens projected. Both steps must stay in use.
- `features/step_definitions/session.steps.ts` (frozen): `the user starts a new pi session`, `the user has started a new pi session` (asserts info results only), `the session reports these results:`, and `the session reports no results`.
- `features/step_definitions/mcp-implementation.steps.ts` (frozen): `pi runs with the scripted model and the mcp implementation` and `the mcp implementation has listed the tools of the stub mcp server {string} of the plugin {string}`.
- `features/step_definitions/mcp-server/listing.steps.ts` (frozen): `the published plugin {string} of the marketplace {string} has the stub mcp server {string}`, `the user lists the mcp tools pi offers`, and `pi offers these plugin mcp tools:` (tools starting with `mcp__plugin_`).
- The stub server's entry runs `process.execPath` with the stub's absolute path, which no run token projects, so a scenario with a stub server cannot compare the whole text of `mcp-adapter.json`; the seed's absent-command server can.

### Established Patterns

- `implementation-switch.feature`'s MREC-02 scenario is the `@mcp` pattern for "a plugin's server runs" under both profiles with the same rows.
- An MCP scenario installs through the run's shared Pi before the profile Pi starts, and waits for the startup listing before it lists tools (`world-and-stand-ins.md`).
- `Given the user has run "/claude:plugin install ...", which did not fail` is the setup install for a plugin with MCP servers.

### Integration Points

- `orchestrators/reconcile/mcp-migration.ts` (`migrateLegacyMcpEntries`) runs per scope from the load path (`orchestrators/reconcile/load.ts`, the AMIG-01 step), which is a shared product file: Phase 9 edits only the migration module.
- `bridges/mcp/legacy.ts` (`readLegacyMcpOwners`, `removeLegacyMcpEntries`) is not Phase 9's file; a bug there is a parent line.

</code_context>

<specifics>
## Specific Ideas

- Success criterion 1's "the plugin's servers still connect afterwards" is proven by the listing (D-BG-904); success criterion 2 by the whole `mcp.json` text (D-BG-905); success criterion 3 by the second-load scenario and by every scenario passing under both profiles (D-BG-902, D-BG-903).
- Each scenario's red proof goes in its plan SUMMARY: the move turned off (or the migration step skipped) makes it fail.

</specifics>

<deferred>
## Deferred Ideas

- Scenarios for AMIG-03 (notice wording), AMIG-04 (unowned entries), a disabled plugin's legacy entries, collisions, and unparseable files (D-BG-907). They are unit-tested today; a later milestone may add behavioral coverage.

</deferred>
