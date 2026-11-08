# Phase 9: Legacy MCP Entry Move - Research

**Researched:** 2026-11-08
**Domain:** cucumber behavioral coverage of the load-time AMIG-01 move (`orchestrators/reconcile/mcp-migration.ts`) under both MCP profiles
**Confidence:** HIGH (every scenario shape below was run in this worktree under both profiles, green and red)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### What the move reports, and when (D-BG-901, D-BG-902)

- **D-BG-901 — the report is pinned as the session's results.** A scenario reads the move's report through `the session reports these results:`: one `mcp-migration` result with severity `info`, `needs reload` true, no notices, and one `moved` row per legacy server (`from` the declared name, `to` the generated key), as the seed does. The rendered notice text (AMIG-03's wording, the re-sign-in and re-approval sentence, the reload hint) is not pinned: the notification grammar owns it, its unit tests cover it, and AMIG-03 is not a requirement of this milestone.
- **D-BG-902 — the move runs on a load, and a second load is a scenario of its own.** The first load after the legacy entries appear (a new session) moves them and reports. A second load moves nothing, reports nothing, and leaves the bytes of both `mcp.json` and `mcp-adapter.json` as the first load left them (success criterion 3). The feature rules allow one behavior per scenario, so the second load is its own scenario, with the first load as `Given the user has started a new pi session`. A command never runs the move; no scenario expects it from one.

#### The builtin profile and the tags (D-BG-903)

- **D-BG-903 — every scenario carries `@mcp` and expects the same result under both profiles.** The move reads no MCP implementation, and `mcp-adapter.json` is written whatever the active implementation (MSEL-04, D-P3-16), so the rows and the bytes of both files are the same under `adapter` and `builtin`. The scenarios have an MCP surface, so they carry `@mcp` (D-BG-05), not a pair. P1-DC-18 left a split open because Pi's built-in MCP reads the same user-scope `mcp.json`; D-MB-21 makes that a one-session duplicate that changes neither file nor the report. If the builtin run of a scenario does show a different expectation, only that scenario becomes an `@adapter-only`/`@builtin-only` pair licensed by D-MB-21, and the split is a dubious choice.

#### The servers still run (D-BG-904)

- **D-BG-904 — "the servers still run" is the active implementation listing the moved server's tools under its new name.** A scenario with the stub MCP server (`the published plugin ... has the stub mcp server "stub"`) installs through the run's Pi, writes the 0.19.2 `mcp.json` with the frozen legacy step, then starts the profile Pi with `pi runs with the scripted model and the mcp implementation`, whose load moves the entries. `Given the user has started a new pi session` stands for the reload the move asks for. Then `the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"`, `When the user lists the mcp tools pi offers`, and `Then pi offers these plugin mcp tools:` show `mcp__plugin_demo_stub__echo`, the same rows under both profiles as the MREC-02 scenario of `implementation-switch.feature`. The scenario also states that `mcp.json` holds only the user's own server, so it fails without the move under the builtin profile too, where the extension's own registration serves the server from the record whatever the files hold. No model call: a call needs a script per implementation, which would force a pair for no extra signal. The exact step order inside the frozen-step constraints is the executor's call, as long as every `Given` precedes the first `When`.

#### The user's own entries (D-BG-905)

- **D-BG-905 — "byte for byte" means each unmarked entry keeps its content and its place.** The move rewrites `mcp.json` as two-space JSON and drops comments with a `comments-dropped` notice (AFILE-04), so the file's bytes can change while the user's entries do not. A scenario writes the user's own servers in that two-space form before the frozen legacy step adds the plugin's marked entries beside them, and compares the whole text of `mcp.json` after the load: the user's entries keep their members, their member order, and their order among themselves, and only the plugin's marked entries are gone. The user's servers cover several shapes: stdio servers with `args` and `env`, an unexpanded `${VAR}` reference the move must not expand, and an unmarked copy of a plugin entry (the plugin's members and env but no `_piClaudeMarketplace` marker), which stays because only the marker makes an entry the plugin's. Any top-level member other than `mcpServers` that the scenario writes must be one that neither implementation interprets. The Given that writes the user's servers is new and lives in `mcp-server/legacy-move.steps.ts`.

#### Scope coverage (D-BG-906, D-BG-907)

- **D-BG-906 — the user scope, plus one project-scope move.** The seed, the second-load scenario, the servers-run scenario, and the AMIG-02 scenario use the user scope. One more scenario installs the plugin in the project scope and shows the load moving the entries of the project's `mcp.json` (`{project dir}/.pi/mcp.json`) into the project's `mcp-adapter.json`, with project rows and the project's data directory, because each scope keeps its own legacy file and the move runs per scope.
- **D-BG-907 — out of scope.** AMIG-03's notice wording, AMIG-04's unowned entries, a disabled plugin's entries, collisions, unparseable files, stub cleanup in the project file, and the write-order fault injection stay with the unit tests in `test/orchestrators/reconcile/mcp-migration.test.ts`. The phase adds no scenario for them.

### Claude's Discretion

- The text of the new Given (D-BG-905) and any other step the scenarios need, within `steps.md`: lower case, a Cucumber expression, whole-value assertions, and a setup Given that asserts its own result.
- Scenario titles and the feature description, within `features.md`.
- Whether the seed's title or steps change, as long as every step layout.md lists for the Phase 9 seed stays in use.
- How the plans split across waves.

### Deferred Ideas (OUT OF SCOPE)

- Scenarios for AMIG-03 (notice wording), AMIG-04 (unowned entries), a disabled plugin's legacy entries, collisions, and unparseable files (D-BG-907). They are unit-tested today; a later milestone may add behavioral coverage.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AMIG-01 | On load, a plugin's entries in a legacy `mcp.json` move to `mcp-adapter.json`, and its servers still run. | The seed (moved row + both files) passes today under both profiles. The servers-run scenario (D-BG-904) was prototyped and passes under both profiles only with the reload step; without the reload it fails under `adapter` (no `mcp__plugin_` tool). The second-load scenario (D-BG-902) and the project-scope scenario (D-BG-906) were prototyped green under both profiles. Red proof measured: every one fails with the move turned off. |
| AMIG-02 | The move leaves the user's own, unmarked `mcp.json` entries untouched. | Prototyped: user servers written before the frozen legacy step (stdio with args/env, a `${VAR:-default}` reference, a plain `${HOME}` reference, an unmarked copy of the plugin entry, and an extra top-level member) keep their members, member order, server order, and top-level position after the move, under both profiles. The new Given must not run `{HOME}`-style text through `expandTokens` (Pitfall 1). |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Never commit to `main`; Conventional Commits with no phase/plan IDs in title or scope; never `--no-verify`, never rebase or amend; stage named paths only (AGENTS.md "Git", child-rules.md).
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario that fails without the change (AGENTS.md "Behavioral tests"). Here the inverse applies: every new scenario must fail without the move, and the plan SUMMARY records that red proof.
- GSD gates run `npm run check` on the combined tree; a passing commit hook is not a gate (AGENTS.md "Build verification", `.agents/skills/local-verification/SKILL.md`).
- Every plan `SUMMARY.md` has `## Threat Flags`, even when "None" (AGENTS.md "GSD records").
- Frozen for this phase: everything under `features/support/` and `features/lib/`, every existing step module (including `mcp-configuration.steps.ts`, `session.steps.ts`, `mcp-implementation.steps.ts`, `mcp-server/listing.steps.ts`), `cucumber.json`, `scripts/check-features.mjs`, `.agents/skills/cucumber/**`, `package.json` (child-rules.md). Phase 9 owns only `features/mcp-server/legacy-move.feature`, NEW `features/step_definitions/mcp-server/legacy-move.steps.ts`, `orchestrators/reconcile/mcp-migration.ts`, and `test/orchestrators/reconcile/mcp-migration.test.ts`.
- Comments and test titles cite durable IDs, never phase/plan numbers (CONVENTIONS.md "Comments").
- Hermetic home: a unit test run uses `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <path>`; a probe that needs Pi runs through cucumber (child-rules.md, `.agents/skills/local-verification/rules/commands.md`).

## Summary

No product change is expected. The move already does what AMIG-01 and AMIG-02 ask: every prototype scenario passed green under both profiles against the unchanged product, and every one failed with `migrateLegacyMcpEntries` stubbed to return at once. Phase 9 is a feature file plus one small step module. The product file and its unit pair are touched only if a planned scenario exposes a bug, and the probes found none.

The move runs inside the extension's `resources_discover` handler (the load). Pi emits `session_start` to every extension first and only then `resources_discover` [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:2698-2700]. So both MCP implementations read the legacy `mcp.json` before the move runs in the same session. Pi's built-in MCP connects the legacy entry under its old name for that one session (D-MB-21). pi-mcp-adapter imports `{agent dir}/mcp.json` as its "Pi mcp.json" source on Pi 1.5.0, so it also lists the stub under the old name at startup. The servers reach their new names only in the next session. That is why the servers-run scenario needs `Given the user has started a new pi session`: without it, the `adapter` profile shows no `mcp__plugin_demo_stub__echo` (measured), while the `builtin` profile passes anyway, because the extension registers the server from the record.

The profile Pi's first session report (the one whose load did the move) is recorded nowhere. `usePiWithProfile()` neither reads nor records it, unlike `restartPi()`. So the servers-run scenario cannot also pin the moved row; the seed pins it on the run's shared Pi (D-BG-901).

**Primary recommendation:** Keep the seed, and add four `@mcp` scenarios: second load, servers run (with the reload Given), user's own servers (with one new Given in `legacy-move.steps.ts`), and project scope. Use the exact step sequences in "Code Examples", which all passed here under both profiles. Record the measured red proofs in the SUMMARY.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detecting marked legacy entries | Product: `bridges/mcp/legacy.ts` (`readLegacyMcpOwners`) | — | The marker is the only trigger (COMPAT-01); not Phase 9's file |
| Moving entries, writing both files | Product: `orchestrators/reconcile/mcp-migration.ts` | `bridges/mcp/legacy.ts` (`removeLegacyMcpEntries`), `bridges/mcp/stage.ts` | Phase 9 owns only the orchestrator |
| Running the move on load | Product: `orchestrators/reconcile/read-pass.ts` (`openScopePass`) called by `load.ts` | — | Shared load path; Phase 9 must not edit it |
| Reporting the move | Product: `shared/notification-dispatch.ts` (`notifyMcpMigration`) + `notification-resolve.ts` | — | Severity and `needsReload` are computed there |
| Writing the 0.19.2 shape | Harness: `features/lib/mcp-configuration.ts` (`writeLegacyMcpConfig`), frozen | — | Phase 9 uses it, never edits it |
| Writing the user's own servers | NEW step in `features/step_definitions/mcp-server/legacy-move.steps.ts` | — | The only new code Phase 9 needs |
| Showing servers run | Harness: `mcp-implementation.steps.ts`, `mcp-server/listing.steps.ts`, `lib/mcp-implementation.ts` (frozen) | Registry probe | Same steps as MREC-02 |

## Standard Stack

No new library. The phase uses what the repository already has.

| Tool | Version | Purpose |
|------|---------|---------|
| `@cucumber/cucumber` | installed (`node_modules/@cucumber/cucumber`) | Runner for `features/` |
| `node:assert/strict` | Node 26.13.0 here | Whole-value assertions in the new step |
| `@earendil-works/pi-coding-agent` | 1.5.0 | The Pi under test (built-in MCP) |
| `pi-mcp-adapter` | 7.0.0 (optional-peer cache) | The adapter profile's implementation [VERIFIED: install-test-peers output "Installed optional test peers pi-mcp-adapter@7.0.0 pi-subagents@0.84.0 @quintinshaw/pi-dynamic-workflows@3.15.0"] |

## Package Legitimacy Audit

Not applicable: the phase installs no package. `npm run test:cucumber:profile` runs `scripts/install-test-peers.mjs`, which installs the three declared optional peers at their floors into `node_modules/.cache/optional-peers`; it did so on the first run here (pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, @quintinshaw/pi-dynamic-workflows 3.15.0). That is existing, frozen tooling.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### Load-time data flow (what a scenario exercises)

```
scenario Given: install via run's shared Pi ──► {scope root}/mcp-adapter.json gets plugin_<p>_<s>_
scenario Given: frozen legacy step ──► mcp-adapter.json loses the plugin's entry
                                   └─► mcp.json = existing servers, then "mine", then marked <s>
      │
      ▼
new session / profile Pi start (Pi agent-session.bindExtensions)
  1. session_start to all extensions
       ├─ Pi built-in MCP: loadMcpConfig reads {agent dir}/mcp.json (+ trusted project .pi/mcp.json)
       │     → connects legacy <s> under its OLD name once (D-MB-21)
       ├─ pi-mcp-adapter: imports Pi mcp.json → lists legacy <s> under its OLD name
       └─ this extension: MCP session steps → registers plugin_<p>_<s> with Pi built-in (builtin only)
  2. resources_discover → loadReconcile → readOnlyPass, per scope, project first
       └─ openScopePass → read pass → migrateScopeIsolated → migrateLegacyMcpEntries
            ├─ no marked entry / no state.json → nothing (no lock)
            └─ lock → stage <s> into mcp-adapter.json as plugin_<p>_<s>_ → save state if changed
                 → remove marked entries from mcp.json (two-space JSON, keys kept in place)
  3. notifyMcpMigration → one `mcp-migration` custom entry (rows non-empty)
      │
      ▼
next session: both implementations read the moved files → tools under the new name
```

### Product facts the scenarios pin

- **Entry point.** `migrateLegacyMcpEntries(input, operations = REAL_OPERATIONS, env = process.env)` [VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:893-915]. It reads the owners without a lock, returns at once when there are none, reports every owner `unowned` when `state.json` is missing, and otherwise runs `migrateLocked` under `withLockedStateTransaction`.
- **Write order under the lock:** check `mcp-adapter.json` parses, re-read owners, stage each owner (`prepareStageMcpServers` + `commitPreparedMcp`), save `state.json` once if a record changed, clear user-scope project disable stubs, then remove the marked entries from `mcp.json` [VERIFIED: mcp-migration.ts:841-876]. The trigger goes last, so a rerun converges.
- **Where the load calls it.** `openScopePass` runs the read pass, then `migrateScopeIsolated({ migrateMcpEntries: input.migrateMcpEntries, scope, cwd, plan: readResult.plan, rows, notices })` [VERIFIED: orchestrators/reconcile/read-pass.ts:555-576]. `migrateScopeIsolated` calls `(migrateMcpEntries ?? migrateLegacyMcpEntries)(step)` and turns a throw into a `stopped` row [VERIFIED: read-pass.ts:438-451]. `loadReconcile`'s `readOnlyPass` passes `migrateMcpEntries: opts.migrateMcpEntries` (undefined in production) and sends `notifyMcpMigration(opts.ctx, opts.run, accumulators.migration)` once after both scopes [VERIFIED: orchestrators/reconcile/load.ts:202, 220]. A pi-subagents background child gets `NO_MCP_MOVE` instead [VERIFIED: load.ts:106, 245].
- **One notice per load.** `notifyMcpMigration`: "if (report.rows.length === 0) { notifyMcpConfigNotices(ctx, run, report.notices); return; }" then `emitLoadSurface(ctx, run, { kind: "mcp-migration", rows: report.rows, notices: report.notices })` [VERIFIED: shared/notification-dispatch.ts:411-422]. So a load with no row and no notice emits nothing, which is what the second-load scenario's `Then the session reports no results` checks.
- **Severity and needs reload.** `const warns = left.length > 0 || removed.some(isWarningRemoval) || notices.some(isWarningNotice);` … `severity: warns ? "warning" : "info", needsReload: moved.length > 0 || removed.length > 0` [VERIFIED: shared/notification-resolve.ts:1041-1047]. Rows are ordered moved, removed, then left. A plain move of a server with no unset variable is `info` / `true`.
- **Moved row shape.** `kind: "moved"; scope: Scope; plugin: string; marketplace: string; from: string; to: string` [VERIFIED: shared/notification-types.ts:1416-1425]. The rows cell renders it as `{"kind":"moved","scope":"user","plugin":"demo","marketplace":"fixtures","from":"srv","to":"plugin_demo_srv_"}` (seed, passing).
- **How `mcp.json` is rewritten.** `removeLegacyMcpEntries` reads with `PI_MCP_SERVER_KEYS` (`"mcpServers"` only), computes `ownedNames`, writes nothing when none, else `atomicWriteJson(locations.mcpJsonPath, withPluginServers(config, pluginName, marketplaceName, {}))`, and returns a `comments-dropped` notice when the bytes held comments [VERIFIED: bridges/mcp/legacy.ts:377-416]. `withPluginServers` starts from `{ ...config.doc }` and replaces each server map in place, so every top-level member keeps its position and every unmarked server keeps its order [VERIFIED: bridges/mcp/adapter-doc.ts:385-412]. `atomicWriteJson` writes `JSON.stringify(value, null, 2) + "\n"` [VERIFIED: shared/atomic-json.ts:27-32]. Only the `_piClaudeMarketplace` marker decides ownership (`markerOwnerOf` / `isOwnedBy`) [VERIFIED: bridges/mcp/legacy.ts:92-109].

### Harness facts the scenarios depend on

- **Frozen legacy step** `the mcp.json file of the {word} scope holds the servers of the plugin {string} as release 0.19.2 wrote them, beside the user's own server {string}` [VERIFIED: features/step_definitions/mcp-configuration.steps.ts:116-137 (registration at 118-119)]. It calls `writeLegacyMcpConfig`, which: removes the plugin's marked entries from `mcp-adapter.json` (`{ ...adapter, mcpServers: Object.fromEntries(kept) }`), then writes `mcp.json` as `{ ...mcp, mcpServers: { ...serversOf(mcp, mcpFile), [userServer.name]: { command: userServer.command }, ...Object.fromEntries(legacy) } }` with `JSON.stringify(doc, null, 2)` + `\n` [VERIFIED: features/lib/mcp-configuration.ts:175-194, 87-89]. So existing servers and top-level members are kept in place, the user's server follows them, and the marked entries come last. It reads `mcp.json` with plain `JSON.parse` (`readObject`) [VERIFIED: features/lib/earlier-version-state.ts:43-45], so a commented file fails it. It throws on a declared server that contains `${` [VERIFIED: features/lib/mcp-configuration.ts:113-116]; the default stub server has none (its entry is `command: process.execPath, args: [MCP_STUB_SERVER, plugin, server]`) [VERIFIED: features/lib/mcp-server-files.ts:73-83].
- **Whole-text step** `the mcp configuration file {string} of the {word} scope holds this text:` reads `mcp.json` or `mcp-adapter.json` of the scope root and compares `projectTokens("text", content, this.tokens)` with the doc string [VERIFIED: mcp-configuration.steps.ts:139-147]. Scope roots: `user` is `sandbox.agentDir`, `project` is `path.join(sandbox.cwd, ".pi")` [VERIFIED: features/support/world.ts:323-333].
- **Session steps.** `Given the user has started a new pi session` sends `new_session` and asserts only that no payload is non-info; it records nothing [VERIFIED: features/step_definitions/session.steps.ts:73-79]. `When the user starts a new pi session` records the payloads as session results [VERIFIED: session.steps.ts:81-83]. `Then the session reports no results` asserts an empty session result list [VERIFIED: session.steps.ts:174-176]. Pi's RPC `new_session` binds the extension twice; the move runs in the first bind, and the seed shows exactly one `mcp-migration` result.
- **Profile Pi.** `usePiWithProfile()` prepares the harness directory and trust, then `startProfilePi(profile)` [VERIFIED: features/support/world.ts:677-695]. It records no session report. `restartPi()` returns `readSession(this.pi)`, which the restart steps record [VERIFIED: world.ts:758-773; features/step_definitions/mcp-implementation.steps.ts:29-34].
- **MCP implementation steps** (frozen interface 9): `Given pi runs with the scripted model and the mcp implementation` starts the profile Pi with `mcpImplementationLaunch(this.mcpProfile)`: pi-mcp-adapter under `adapter`, the built-in stand-in under `builtin` [VERIFIED: mcp-implementation.steps.ts:46-52; features/lib/mcp-implementation.ts:155-159]. `Given the mcp implementation has listed the tools of the stub mcp server {string} of the plugin {string}` calls `waitForStubListing(this.mcpProfile, ...)` [VERIFIED: mcp-implementation.steps.ts:56-62]. Under `adapter` the wait ends once the stub logged a `tools/list` and no stub runs; under `builtin` once Pi has a tool of the server [VERIFIED: features/lib/mcp-implementation.ts:488-505]. The stub logs its argv plugin and server, so a startup listing under the OLD name also satisfies the adapter wait; `When the user lists the mcp tools pi offers` (`registryAfterListing`) then polls up to `ADAPTER_TOOLS_WAIT_MS` for a tool of every listed stub and never fails itself [VERIFIED: mcp-implementation.ts:577-592; listing.steps.ts:154-156]. `Then pi offers these plugin mcp tools:` lists tools that start with `mcp__plugin_`, sorted, with `active` yes/no [VERIFIED: listing.steps.ts:221-234].
- **Built-in stand-in.** It serves only stub servers a `Given a stand-in registers ...` step named; Phase 9 names none, so under `builtin` the plugin's server is served by the extension's own registration from the record.
- **Sandbox reset.** The shared Pi's `Before()` empties every sandbox directory and starts a new session [VERIFIED: features/support/pi-process.ts:210-238], so a new Given that writes `mcp.json` needs no release of its own.

### How each implementation reads the files, and when

| Reader | Reads | When | Effect in a Phase 9 scenario |
|--------|-------|------|------------------------------|
| Pi built-in MCP | `{agent dir}/mcp.json`, and `{project dir}/.pi/mcp.json` only when the project is trusted (`loadMcpConfig`) [VERIFIED: dist/extensions/mcp/config.js:104-117] | Its `session_start` handler [VERIFIED: dist/extensions/mcp/index.js:971-1009] | Before the move in the same session: runs the legacy entry under its old name once (D-MB-21) and tries to start the user's absent-command servers (they fail with no visible effect on results). Validates names: two names that differ only in `-`/`_` clash. Reads top-level `autoEnableCodemode` [VERIFIED: config.js:61-64] |
| pi-mcp-adapter 7.0.0 | Its own `mcp-adapter.json` files, plus `{agent dir}/mcp.json` as source "Pi mcp.json" and the project `.pi/mcp.json` as "Pi project mcp.json" when `piMcpConfigEnabled` [VERIFIED: node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/config.ts:880-892, 955-966]; on Pi 1.5.0 it is enabled because Pi has `registerMcpServer` [VERIFIED: pi-mcp-adapter/index.ts:79-82] | Its `session_start` | Lists the legacy entry under its old name at startup (measured: Probe B's listing wait passed with no `mcp__plugin_` tool) |
| This extension's load | Both scope files, per scope, project first | `resources_discover`, after every `session_start` handler [VERIFIED: agent-session.js:2698-2700] | Moves the entries; the next session's readers see the new files |

**Consequence for a scenario that writes the 0.19.2 `mcp.json` and then starts the profile Pi:** that Pi's first load moves the entries, but both implementations already read the old files. Only after `Given the user has started a new pi session` do the tools appear under `mcp__plugin_demo_stub__`.

### Anti-Patterns to Avoid

- **Checking the servers-run result without the reload.** Measured: under `adapter` the tool table is empty; under `builtin` it passes for the wrong reason (the record registration). Keep `Given the user has started a new pi session` before the listing wait.
- **Putting the listing wait before the reload.** Under `adapter` the startup listing under the old name satisfies `waitForStubListing`, so the wait would prove nothing about the new name.
- **Comparing the whole `mcp-adapter.json` in a stub-server scenario.** The stub entry holds `process.execPath` and the repository path of `mcp-stub-server.ts`, which no run token projects (seen in the red builtin diff: `"command": "/home/linuxbrew/.linuxbrew/Cellar/node/26.13.0_2/bin/node"`). Compare `mcp.json` (only the user's server remains) and the tool table instead.
- **Trying to pin the move's report in the profile-Pi scenario.** The first session report of a profile Pi is not recorded by any frozen step.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| The 0.19.2 `mcp.json` shape | A new writer of marked entries | The frozen legacy step | It mirrors 0.19.2's stage (marker, injected env) and must stay in use (seed rule) |
| Comparing a config file | Partial JSON assertions | `the mcp configuration file {string} of the {word} scope holds this text:` | Whole-text compare with token projection, already frozen |
| Waiting for MCP servers | Sleeps or polling in the new module | `the mcp implementation has listed ...` and `the user lists the mcp tools pi offers` | They handle both implementations and the adapter's async registration |
| Run-token expansion | A private replace chain of `{home}`/`{agent dir}` | `expandTokens` from `features/lib/run-tokens.ts` (with the Pitfall 1 constraint) | One rule for every step; a private copy risks a `fallow dupes` clone group |

## Runtime State Inventory

Not a rename/refactor phase. Omitted.

## Common Pitfalls

### Pitfall 1: `expandTokens` throws on a plain `${HOME}` reference
**What goes wrong:** The new Given fails with `unknown run token: {HOME}`.
**Why:** `expandTokens` rejects any leftover `/\{[a-z][a-z0-9 ._-]*\}/iu` match after expansion [VERIFIED: features/lib/run-tokens.ts:104-120]. Measured with that regex: `${HOME}/a` matches `{HOME}`; `${ALPHA_HOME:-/srv/alpha}`, `$HOME/a`, and `${PI_CM_STUB_TAG:-install-default}` do not.
**How to avoid:** Either (a) expand tokens and write references in the `${VAR:-default}` form, which Claude Code and pi-mcp-adapter both treat as a variable reference (D-CF1-13 already uses `${PI_CM_STUB_TAG:-install-default}`), or (b) write the doc string verbatim with no expansion, which then cannot use `{home}`/`{agent dir}` for the unmarked copy's env paths. Both were run green here (Probe C1 = a, Probe C2 = b). Recommendation: (a), because the unmarked copy is strongest when its env is byte-identical to the plugin's legacy env, which needs the tokens. The `Then` step needs no change: it projects the actual text and compares, and a `${HOME}` in the expected doc string is harmless there.
**Warning signs:** The new Given fails before the legacy step runs.

### Pitfall 2: The legacy step overwrites a user server with the same name
**What goes wrong:** A user server named like the frozen step's user server (`"mine"`) or like the plugin's declared server (`"srv"`, `"stub"`) is overwritten in place by the frozen writer's object spread [VERIFIED: features/lib/mcp-configuration.ts:184-191].
**How to avoid:** Give the user's servers other names (`alpha`, `srv-copy`, …). Also avoid names that fold to another server's under `-`/`_` (Pi built-in reports a clash) and any `plugin_…` name (it would shadow or collide with the generated key; collisions are D-BG-907, out of scope).

### Pitfall 3: The new Given must run before the legacy step, and write plain JSON
**What goes wrong:** Written after, it clobbers the marked entries; written with comments, the legacy step's `JSON.parse` throws.
**How to avoid:** Order: install → new Given (user servers) → frozen legacy step → load. The legacy step rewrites the file in two-space form anyway, so the doc string should already be `JSON.stringify(…, null, 2)` + newline for the "byte for byte" claim to be honest. After a user-scope or project-scope install no `mcp.json` exists yet, so the Given may create the file with `flag: "wx"` (measured).

### Pitfall 4: Top-level members either implementation interprets
**What goes wrong:** Pi's built-in reads top-level `autoEnableCodemode` from `mcp.json` [VERIFIED: config.js:61-64]; pi-mcp-adapter's old-adapter keys (`settings`, `imports`, `claudePlugins`) appear in its legacy detection [VERIFIED: pi-mcp-adapter/config.ts:259-269].
**How to avoid:** Use a neutral member such as `"note": "kept by the user"` (measured green under both profiles, and it stayed first in the file).

### Pitfall 5: Unowned scope of `the user has started a new pi session`
It asserts only that payloads are info. The first load's `mcp-migration` result is info, so the step passes and nothing records it. That is what the second-load scenario wants. Do not use it where the scenario's point is the report.

### Pitfall 6: Cucumber rules that bite this file
- Every `Given` before the first `When`; never `And`/`But`; step text lower case outside quotes (checked by `npm run check:features`).
- One behavior per scenario: the second load is its own scenario (D-BG-902).
- Every scenario has an MCP surface (step text contains `mcp`), so each needs exactly one implementation tag: `@mcp` (D-BG-903). An `@mcp` scenario never names `pi-mcp-adapter` in steps, tables, or doc strings (DUAL-02 gate).
- A session result's fields must be compared (`the session reports these results:` marks them); a `When the user starts a new pi session` that reports a result no step states fails the scenario in `After()`.
- Whole literals: tables list every row; doc strings are whole files with the trailing blank line that encodes the final `\n`.
- The new step module exports nothing, starts with `@fileoverview`, registers `Given` before `When` before `Then`, uses a `function` with typed `this` only when it touches the world, and a `Given` that writes asserts what it wrote (`steps.md`).
- The seed's two `mcp-configuration.steps.ts` steps must stay in use (layout.md "Seeds").
- Step text of a verb module names its verb (D-08). Suggested wording for the new Given: `the user's own servers in the mcp.json file of the {word} scope, before the legacy move, are:` or similar. The wording is the writer's call.

### Pitfall 7: Requirement ID reuse in the unit pair
The unit test titles use `AMIG-02` for the mcp-4 meaning (write order, unfinished rows), e.g. "AMIG-02: a plain move writes mcp-adapter.json, then mcp.json" [VERIFIED: test/orchestrators/reconcile/mcp-migration.test.ts:1957]. This milestone's AMIG-02 is "the user's own entries stay". A new unit case, if any, should not assume the old title meaning.

### Pitfall 8: Harness timing under load
The servers-run scenario under `adapter` is the slowest (~15-20 s): the profile Pi start, a reload, the listing wait, and `registryAfterListing`. The red run of it waits the full `ADAPTER_TOOLS_WAIT_MS` (10 s) before the table step fails. Per child-rules.md, a timeout failure gets one rerun before it counts as red.

## Code Examples

All five scenarios below were run in this worktree, in one temporary copy of `legacy-move.feature`, under both profiles: 5/5 green (`adapter` 34 s wall, `builtin` 27 s wall, `--parallel 1`). Titles here are placeholders; the writer chooses final titles and the new Given's text. The file was restored afterwards and `git status --short` was clean.

### Second load moves nothing and reports nothing (D-BG-902)
```gherkin
  @mcp
  Scenario: <title>
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the mcp.json file of the user scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given the user has started a new pi session
    When the user starts a new pi session
    Then the session reports no results
    Then the mcp configuration file "mcp.json" of the user scope holds this text:
      (the seed's mcp.json text: only "mine")
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      (the seed's mcp-adapter.json text: plugin_demo_srv_ with {home}/{agent dir} env, directTools "search", toolPrefix "mcp", marker)
```

### Servers still run under the new name (D-BG-904)
```gherkin
  @mcp
  Scenario: <title>
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the mcp.json file of the user scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given pi runs with the scripted model and the mcp implementation
    Given the user has started a new pi session
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi offers these plugin mcp tools:
      | tool                        | active |
      | mcp__plugin_demo_stub__echo | no     |
    Then the mcp configuration file "mcp.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "mine": {
            "command": "pi-features-users-own-mcp-server"
          }
        }
      }

      """
```
Measured variant without `Given the user has started a new pi session`: `adapter` fails at `pi offers these plugin mcp tools:` (actual table has only the header); `builtin` passes.

### User's own servers keep content and order (D-BG-905)
The new Given (in `legacy-move.steps.ts`) writes the doc string, after `expandTokens`, to `<scope root>/mcp.json` with `flag: "wx"` and asserts the file reads back equal. Doc string used in the probe (green under both profiles):
```json
{
  "note": "kept by the user",
  "mcpServers": {
    "alpha": {
      "command": "pi-features-users-own-mcp-server",
      "args": [
        "--alpha",
        "1"
      ],
      "env": {
        "ALPHA_MODE": "on",
        "ALPHA_HOME": "${ALPHA_HOME:-/srv/alpha}"
      }
    },
    "srv-copy": {
      "command": "pi-features-absent-mcp-server",
      "args": [],
      "env": {
        "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
        "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
      }
    }
  }
}
```
Sequence: the seed's first five Givens (with `declares the mcp server "srv"`), the new Given, the frozen legacy step, `When the user starts a new pi session`, `Then the session reports these results:` (the seed's one moved row), `Then the mcp configuration file "mcp.json" of the user scope holds this text:` with the same text plus `"mine": { "command": "pi-features-users-own-mcp-server" }` appended as the last server. A verbatim variant with plain `"${HOME}/beta"` and `"${BETA_TOKEN}"` (no token expansion in the Given) was also green under both profiles. Neither profile showed a failed start, an extension error, or a slow timeout from the user's servers (each such scenario ran in under 4 s of step time).

### Project-scope move (D-BG-906)
```gherkin
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the mcp.json file of the project scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    When the user starts a new pi session
    Then the session reports these results:
      | kind          | severity | needs reload | notices | rows                                                                                                             |
      | mcp-migration | info     | true         |         | [{"kind":"moved","scope":"project","plugin":"demo","marketplace":"fixtures","from":"srv","to":"plugin_demo_srv_"}] |
```
Measured file texts (identical under both profiles): the project `mcp.json` holds only `"mine"`, as in the seed. The project `mcp-adapter.json` holds the seed's entry with `"CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo"` and `"CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"`. A marketplace added only to the user scope (D-MF-04 adds it to the project on install) gave the same rows and the same `mcp-adapter.json`; a dir marketplace has one root, so `CLAUDE_PLUGIN_ROOT` is the same either way. Use the project-scope marketplace: it keeps the scenario to one scope. The run's shared Pi needs no trust step for this; the move runs in the read-only pass whatever the trust.

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| Plugin servers in `<scope>/mcp.json` under the declared name | `<scope>/mcp-adapter.json` under `plugin_<p>_<s>_` | 0.20.0 (commit `94160614`, #250, per `features/lib/mcp-configuration.ts:131-132`) | The move exists only for upgrades from ≤ 0.19.2 |
| Built-in MCP skipping the legacy entry | Runs it once under its old name (D-MB-21, locked 2026-11-06) | mcp-builtin | Explains the one-session duplicate the servers-run scenario sees under `builtin` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `${VAR:-default}` form satisfies D-BG-905's "unexpanded `${VAR}` reference" | Pitfall 1 | Low: the verbatim variant with plain `${HOME}` was also green; the user may prefer that form and accept literal paths in the unmarked copy |
| A2 | The slowest scenario stays within the default step timeouts on CI | Pitfall 8 | Low: the MREC-02 scenario has the same shape plus no reload and runs in CI today |

## Open Questions

1. **Which form of the unexpanded reference to write (D-BG-905).**
   - What we know: `expandTokens` rejects `${HOME}`; `${VAR:-default}` passes it; a verbatim Given cannot use `{home}`.
   - Recommendation: expand tokens and use `${VAR:-default}`; record the choice as a Low/Medium dubious choice.
2. **Whether the servers-run scenario should also pin the moved row.**
   - What we know: no frozen step records a profile Pi's first session. A Phase 9 step could call the exported `readSession(this.pi)` and `this.recordResults(…, "session")`, as the frozen restart helper does.
   - Recommendation: do not; the seed pins the row (D-BG-901), and a second "starts pi" step would duplicate the frozen MCP implementation step's role.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v26.13.0 | — |
| Pi (`@earendil-works/pi-coding-agent`) | profile and shared Pi | ✓ | 1.5.0 | — |
| Optional peers cache | adapter profile | ✓ after first `npm run test:cucumber:profile` (installed here; needs the npm registry once) | pi-mcp-adapter 7.0.0 | — |
| `/tmp` inodes | cucumber sandboxes (tmpfs) | ✓ | 4% used (35,855 / 1,048,576) at 09:11 | — |

No real `~/.pi` file changed during any run of this research (checked with `find ~/.pi -newer <start marker>` after the last run: empty). Note that one early run of the unit pair used a bare `node --test` without the `--import` of `test/platform/isolated-pi-home.ts`; it left `~/.pi` untouched, but plans must use the `--import` form.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` (behavioral), `node:test` (unit pair) |
| Config file | `cucumber.json` (profiles `adapter`, `builtin`; frozen) |
| Quick run command | `npm run test:cucumber:profile -- --profile adapter --parallel 1 features/mcp-server/legacy-move.feature`, then the same with `--profile builtin` |
| Full suite command | `npm run check` (runs `check:static`, `test:unpaired`, `test:integration`, `test:cucumber` both profiles, `test:coverage:direct:all`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AMIG-01 | Load moves marked entries, reports one moved row, writes both files (seed) | behavioral, both profiles | `npm run test:cucumber:profile -- --profile <adapter\|builtin> --parallel 1 features/mcp-server/legacy-move.feature` | ✅ seed |
| AMIG-01 | Servers run under the new name after the reload | behavioral, both profiles | same | ❌ new scenario |
| AMIG-01 | Second load moves and reports nothing; both files unchanged | behavioral, both profiles | same | ❌ new scenario |
| AMIG-01 | Project scope moves its own legacy file | behavioral, both profiles | same | ❌ new scenario |
| AMIG-02 | User's own servers keep content, member order, server order, top-level member | behavioral, both profiles | same | ❌ new scenario + new Given in `features/step_definitions/mcp-server/legacy-move.steps.ts` |
| AMIG-01/02 | Write order, failures, unowned, collisions (D-BG-907) | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/reconcile/mcp-migration.test.ts` | ✅ (70 tests) |
| layout and wording | step use, tags, order, lower case | static | `npm run check:features` | ✅ |

### Measured run times (this machine, 28 cores, load average 3.6-7.4, Node 26.13.0)
| Command | Result | Wall |
|---------|--------|------|
| Seed, `adapter`, `--parallel 1` (first run, includes peer install) | pass | 40.6 s |
| Seed, `builtin`, `--parallel 1` | pass | 11.6 s |
| 5 candidate scenarios, `adapter`, `--parallel 1` | 5/5 pass | 34.1 s |
| 5 candidate scenarios, `builtin`, `--parallel 1` | 5/5 pass | 26.8 s |
| Same 5 with the move disabled, `adapter` | 5/5 fail | 45.5 s |
| Same 5 with the move disabled, `builtin` | 5/5 fail | 35.9 s |
| `npm run check:features` | pass | 12.3 s |
| Unit pair with `--import` isolated home | 70/70 pass | 5.8 s |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts` | pass | 8.3 s |
| `npm run check` | not run here; the parent measured ≈2 min plus the three cucumber legs (≈6 min) at the Phase 1 head | — |

Pass `--parallel 1` (or at most 3) when running one file: each profile config sets `parallel: 8`, and each worker starts its own shared Pi.

### Red proof (measured)
Method: temporarily insert an early return as the first statement of `migrateLegacyMcpEntries` (mcp-migration.ts:897-898), for example `if (input.scope !== ("never" as string)) return; // RED PROBE`, run both profiles, then restore with `git checkout -- extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts` and confirm `git status --short`. Never commit the probe. Failing assertion per scenario:

| Scenario | `adapter` fails at | `builtin` fails at |
|----------|--------------------|--------------------|
| Seed | `the session reports these results:` (no payload) | same |
| Second load | `mcp.json` whole text (marked `srv` still there) | same |
| Servers run | `pi offers these plugin mcp tools:` (header only) | `mcp.json` whole text (marked `stub` still there); the tool table passes because the extension registers the server from the record |
| User's own servers | `the session reports these results:` | same |
| Project scope | `the session reports these results:` | same |

### Sampling Rate
- **Per task commit:** the file under both profiles (`--parallel 1`), `npm run check:features`; plus `SKIP=npm-check pre-commit run --files <changed>` and the commit hook (`check:commit`).
- **Per wave merge:** `npm run check` on the combined tree (background call, exit code to a file).
- **Phase gate:** `npm run check` and `npm run test:modules` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `features/step_definitions/mcp-server/legacy-move.steps.ts` — new module with the D-BG-905 Given (does not exist yet; `check:features` fails on an unused step, so create it together with the scenario that uses it).
- No framework install and no new fixture are needed.

## Security Domain

Test-only phase; no new product surface.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | marginal | The move reads JSONC through `readMcpConfigDoc` (existing); scenarios feed only well-formed JSON |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A test writing outside its sandbox | Tampering | Write only under `this.scopeRoot(scope)` (sandbox agent dir or `{project dir}/.pi`); `Before()` empties the sandbox |
| A test touching the real `~/.pi` | Information disclosure / Tampering | Cucumber sandbox via `features/support/isolated-pi-home.ts`; unit runs with `--import test/platform/isolated-pi-home.ts` |

## Sources

### Primary (HIGH confidence)
- This repository, read this session: `orchestrators/reconcile/{mcp-migration,load,read-pass}.ts`, `bridges/mcp/{legacy,adapter-doc}.ts`, `shared/{notification-dispatch,notification-resolve,notification-types,atomic-json}.ts`, `features/support/{world,pi-process}.ts`, `features/lib/{mcp-configuration,mcp-implementation,mcp-server-files,run-tokens,earlier-version-state,pi-commands}.ts`, `features/step_definitions/{session,mcp-configuration,mcp-implementation}.steps.ts`, `features/step_definitions/mcp-server/listing.steps.ts`, `scripts/check-features.mjs`, `.agents/skills/cucumber/**`, `.agents/skills/local-verification/**`.
- Pi 1.5.0 dist: `core/agent-session.js` (event order), `extensions/mcp/{index,config}.js` (built-in config reads).
- pi-mcp-adapter 7.0.0 source in the optional-peer cache: `index.ts`, `config.ts`.
- Cucumber runs in this worktree (logs in `/tmp/claude-1000/-home-acolomba-pi-claude-marketplace/45e74ef7-b24a-4893-854b-b4c04365a440/scratchpad/p9r/`).

### Secondary / Tertiary
- None. The ROADMAP flags no upstream research for this phase, and none was done.

## Metadata

**Confidence breakdown:**
- Harness and step choices: HIGH — every scenario shape run green and red under both profiles.
- Product behavior: HIGH — read in source and confirmed by the runs.
- Timing: MEDIUM — measured on a shared, loaded machine with `--parallel 1`.

**Research date:** 2026-11-08
**Valid until:** 2026-12-08, or until the frozen harness or Pi/pi-mcp-adapter floors change.
