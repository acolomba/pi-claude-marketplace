---
phase: 02-built-in-materialization
plan: "08"
subsystem: docs
tags: [mcp, pi-builtin-mcp, docs, phase-gate, parent-lines]
status: complete

requires:
  - phase: 02-built-in-materialization
    provides: "every Wave 1 and Wave 2 plan (02-01 to 02-07, 02-09): the built-in registration, status, scenarios, and their SUMMARYs"
provides:
  - "docs/mcp-compatibility.md: a Pi built-in column in five comparison tables and the built-in sections, every built-in statement cited"
  - "the phase gate on the combined tree, with seeds per cucumber profile"
  - "the merged parent lines of the whole phase"
affects: ["Phase 3 read-time verdicts (re-verification list)", "Phase 6 (CHANGELOG, README, PROJECT.md, BACKLOG, .fallowrc.json, output docs)"]

actuals:
  tokens: 21000
  tasks: 3
  commits: 2
plan_head_before: 86491c8b93c4892fe885ad7ad2f8f9151fa98ab4
plan_head_after: 52b8d955c39d03182ff6ea5356c7082bf0f9bcb5

tech-stack:
  added: []
  patterns:
    - "A doc table column whose every cell cites a scenario or a Pi dist/ file, checked by the plan's inline citation check (P2-DC-40)"

key-files:
  created:
    - .planning/phases/02-built-in-materialization/02-08-SUMMARY.md
  modified:
    - docs/mcp-compatibility.md

key-decisions:
  - "The built-in column of each table cites per cell, not in the header, because no single source proves a whole column"
  - "Two new sections hold the built-in text: 'Choosing an implementation' after the intro, and 'Pi's built-in MCP' (seven subsections) after the pi-mcp-adapter settings; the adapter sections gain one pointer sentence each instead of being rewritten"
  - "Divergences gain a '### Pi's built-in MCP' subsection with twelve items, each starting 'Under Pi's built-in MCP' and naming its license; three earlier adapter items now say 'Under pi-mcp-adapter'"
  - "The partially-available table gains an `sse` row (pi-mcp-adapter runs it, Pi refuses it), and `bareElicitationCapability` reads ✓ for Pi built-in"

requirements-completed: [MDOC-01]

duration: 45m
completed: 2026-11-04
---

# Phase 2 Plan 08: MCP compatibility docs for Pi's built-in MCP, and the phase gate Summary

**`docs/mcp-compatibility.md` now shows Pi's built-in MCP beside Claude Code and pi-mcp-adapter in five tables and seven new subsections, each built-in statement citing a `features/mcp-server/` scenario or a Pi 1.5.0 `dist/` file; the merged phase passes the whole gate in parts, and this SUMMARY holds every parent line of the phase.**

## Performance

- **Duration:** about 45 min (docs about 25 min, gate about 15 min)
- **Completed:** 2026-11-04T15:50Z
- **Tasks:** 3 of 3
- **Files:** 1 modified (`docs/mcp-compatibility.md`), plus this SUMMARY

## Accomplishments

- **Tables (Task 1).** The names table gains `Pi built-in server name and tool names`. The tool search and partially-available tables rename `Pi` to `pi-mcp-adapter` and add `Pi built-in`. The translated fields table adds `Pi built-in field` after `pi-mcp-adapter field`. The info status table renames `Meaning` to `Meaning under pi-mcp-adapter` and adds `Meaning under Pi's built-in MCP`. Every old row keeps its place; new rows follow them (`tool_search` off; `sse`; `overridden by mcp.json`; `project not trusted`). Each built-in cell cites a scenario or a `dist/` file, or reads `--` (cached, needs authentication, pending approval, failed, status unknown).
- **Intro and Name length (Task 1).** The intro names both implementations and how each column is proven. "Name length" states Pi's 64-character cut (55 characters, `_`, an 8-character hash; the measured `mcp__plugin_demo_a_server_whose_name_runs_well_past_the_ca340f16`) and that pi-mcp-adapter turns the built-in MCP off.
- **Sections (Task 2).** New `## Choosing an implementation` (the selection rule, switching both ways with a restart and no plugin command, D-MB-01 no settings edits, the `none` case, MREC-02). New `## Pi's built-in MCP` with seven subsections: When the servers register (D-MB-10, eager connection, refusals); Variables under Pi's built-in MCP (resolution at registration, `$$` and `$!`, the literal `${NAME}`, P2-DC-02 values visible to every extension in the process); Project trust (BLT-03, P2-DC-07, P2-DC-14); Servers in mcp.json (Pi's by-name rule against Claude Code's command-or-URL rule, P2-DC-08, P2-DC-15); A name that another extension registered (P2-DC-46, `dist/core/extensions/loader.js`); Tool search and /mcp (session-only choices); Legacy mcp.json entries (P2-DC-11); Other gaps (`cwd`, `timeout`, `description` kept, deny-lists at 2.1.291).
- **Pointers.** Connection lifecycle, Project-scope servers, User overrides, Variables, Server status in info, and Upgrading each gain one sentence that says which implementation they describe and links to the built-in text.
- **Divergences.** A new `### Pi's built-in MCP` subsection with twelve items, each with its license: the `-` fold, the 64-character cut, the legacy one-session gap, `cwd`, `timeout`, the `mcp.json` override, the same-name registration, `tool_search` off, `not connected` ambiguity, resolved values in the session, the `127.0.0.1` OAuth redirect, and the deny-list pin. Three adapter items (lazy start, `tool_search` off by default, project approval) now start with "Under pi-mcp-adapter".

## Task Commits

1. **Task 1 (tracer): the built-in column in the five comparison tables** - `1e8aef7` (docs)
2. **Task 2: the built-in sections and divergences** - `52b8d95` (docs)
3. **Task 3: the phase gate and the parent lines** - no source change; this SUMMARY

Tracer gate: Task 1's verify (the citation check and pre-commit) passed again before Task 2 started.

## Verification of the doc

- Citation check (the plan's node one-liner, from the repository root): exit 0 after Task 1 and after Task 2. Five tables name "built-in"; no uncited built-in cell; every cited feature file exists.
- `env -u GH_TOKEN -u GITHUB_TOKEN SKIP=npm-check pre-commit run --files docs/mcp-compatibility.md`: clean on the second run after each task (mdformat realigned the tables on the first run of Task 1).
- Task 1 acceptance: `Claude Code | pi-mcp-adapter | Pi built-in |` matches 2 lines; `pi-mcp-adapter field | Pi built-in field |` matches 1.
- Task 2 acceptance: `features/mcp-server/implementation-switch.feature` 5; `features/mcp-server/builtin-trust.feature` 1; `dist/extensions/mcp/` 25; lines naming "built-in" inside Divergences 15; `dist/core/extensions/loader.js` 5.
- Prohibition (MDOC-01, values): the doc states twice that Pi gives every registered config, resolved secrets included, to every extension in the same Pi process ("Variables under Pi's built-in MCP" and the Divergences item); no sentence calls the values private.

### Statements that do not cite a scenario or a Pi file

These cite a decision ID, a test, a source file of this extension, or Claude Code, because no scenario or Pi 1.5.0 file proves them:

- `${CLAUDE_PROJECT_DIR}` is the session directory in both scopes (P2-DC-03): proven by `test/orchestrators/mcp/builtin-registration-step.test.ts`; no scenario reads it from a user-scope server.
- Info counts an `mcp.json` entry when it has a `command` or `url` (P2-DC-15, P2-DC-72): `test/bridges/mcp/builtin-overrides.test.ts`; no scenario uses an entry Pi refuses.
- Claude Code matches a duplicate by command or URL, and `/plugin` reports it (P2-DC-15): a Claude Code 2.1.318 fact (02-RESEARCH.md Q4 (e)), not provable by a Pi file.
- No load-time notice for an overridden server (P2-DC-08): an absence; `builtin-status.feature` shows only that info reports it.
- Info reads the other extension's server after a same-name refusal (P2-DC-46): no harness extension registers a clashing name; the refusal itself cites `dist/core/extensions/loader.js`.
- The deny-lists stay at Claude Code 2.1.291 (P2-DC-22): cites `test/integration/mcp-builtin-encoding-conformance.test.ts`.
- The partially-available verdict follows the active implementation (D-MB-07): cites `extensions/pi-claude-marketplace/domain/mcp-builtin-features.ts`; the read-time verdicts own the scenarios.
- Claude Code starts a stdio server in its resolved project root (P2-DC-21): minified binary strings, 02-RESEARCH.md Q4 (a).

## Phase gate

Combined tree: commit `52b8d95` (every Wave 1 and Wave 2 merge plus this plan's two doc commits; all 22 task commits of 02-01 to 02-07 and 02-09 are in its history). Node v24.22.1. Each command used the prefix `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`, one call each, in this order:

| Command | Exit | Result | Time (UTC) |
| --- | --- | --- | --- |
| `npm run lint` | 0 | clean | 15:34 |
| `npm run check:static` | 0 | typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features all passed | 15:34-15:35 |
| `npm run test:unpaired` | 0 | all pass | 15:35 |
| `npm run test:integration` | 0 | all pass | 15:35-15:36 |
| `npm run test:coverage:direct:all` | 0 | every source-test pair at 100% direct coverage | 15:36-15:38 |
| `npm run test:modules` | 0 | all pass | 15:38-15:40 |
| `npm run test:cucumber:profile -- --profile builtin <every features/*/*.feature but features/mcp-server/companion-missing.feature>` | 0 | 93 scenarios, 1224 steps passed, seed 294302, 49.5 s | 15:41 |
| companion-missing check, first run (`--profile builtin --format rerun:...`) | 1 (expected) | 4 scenarios, 3 passed, 1 failed; rerun file `features/mcp-server/companion-missing.feature:61` only, seed 570831 | 15:42 |
| companion-missing check, second run with the one cell at `"not loaded"` | 0 | 4 scenarios, 43 steps passed, seed 880167 | 15:42 |
| `npm run test:cucumber:profile -- --profile adapter features/mcp-server features/agent features/hook` | 0 | 195 scenarios, 2545 steps passed, seed 675282, 2 min 3 s | 15:43-15:45 |
| `npm run test:cucumber:profile -- --profile adapter features/plugin` | 0 | 674 scenarios, 7440 steps passed, seed 227714, 1 min 17 s | 15:45-15:46 |
| `npm run test:cucumber:profile -- --profile adapter features/marketplace features/skill features/slash-command features/workflow` | 0 | 695 scenarios, 6928 steps passed, seed 183047, 2 min 6 s | 15:46-15:48 |

- Adapter profile total: 1564 of 1564 scenarios, the same count as the Wave 2 post-merge gate. Builtin profile total: 97 scenarios, 96 passed, and the one failure is the tolerated cell below.
- No listed flake fired, so no rerun was needed.
- **Companion-missing outcome (a).** The file still pins `"status":"status unknown"`. The first run failed only `Plugin info names pi-mcp-adapter as a missing companion` (line 61), and only on its `plugin components mcp` cell: actual `[{"name":"plugin:demo:stub","status":"not loaded"}]`, expected `status unknown`. With that one cell changed to `"not loaded"` in the working tree, the whole file passed. `git checkout HEAD -- features/mcp-server/companion-missing.feature` restored it at once; `git status --porcelain features/mcp-server/companion-missing.feature` then printed nothing, and the file still holds one `"status":"status unknown"`. The change was never staged or committed. Its parent line is below.
- The plan's companion command was run as three plain commands (the first run with the rerun-file check, then `sed` and the second run, then the `git checkout`), because the worktree guard refuses a compound command or a script that names git. The checks are the same.

## Requirement coverage

| Requirement | Plans | Proof |
| --- | --- | --- |
| MSEL-02 | 02-07 | `features/mcp-server/implementation-switch.feature`: "A plugin's server moves from pi-mcp-adapter to pi's built-in mcp and back with no plugin command (MSEL-02, MSEL-03, D-MB-01)" |
| MSEL-03 | 02-01, 02-07 | `listing.feature`: "Under pi-mcp-adapter the extension registers no server with Pi (MSEL-03)"; the `none` and last adapter legs of the switch scenario; `test/orchestrators/mcp/builtin-registration-step.test.ts` |
| MSEL-04 | 02-07 | `implementation-switch.feature`: "A plugin installed under pi's built-in mcp runs through pi-mcp-adapter after a restart, with no rewrite at load (MSEL-04)" |
| MREC-02 | 02-01, 02-07 | `implementation-switch.feature`: "A plugin an earlier release installed reaches its server with no reinstall (MREC-02)" (`@mcp`); the step's unit test |
| BLT-01 | 02-01, 02-02, 02-03, 02-06, 02-09 | `listing.feature` (tool search, no-match search, server-less plugin), `invocation.feature` twins, `builtin-direct.feature`, `lifecycle.feature` autoapply. Gap: "A new session offers the plugin's tool again (BLT-01)" runs `@adapter-only` (P2-DC-77) |
| BLT-02 | 02-01, 02-02, 02-03 | `configuration.feature` twins (launch variable, headers, unset header literal, env outline, plugin directories), `invocation.feature` variable twin, `builtin-values.feature`, `sources.feature` twins; `test/integration/mcp-builtin-encoding-conformance.test.ts` (63 cases) |
| BLT-03 | 02-05 | `project-scope.feature` trusted and untrusted twins; `builtin-trust.feature` (both scopes, trusted and untrusted) |
| BLT-04 | 02-01, 02-04, 02-09 | `listing.feature` (name, per-server names, hyphen fold, 64-character cut); `builtin-status.feature` (`overridden by mcp.json`, refused registration `not loaded`) |
| BLT-05 | 02-04 | `builtin-status.feature`, 7 scenarios (connected, not connected, not loaded, overridden by mcp.json, project not trusted, overridden by project scope, disabled through `/mcp`) |
| BLT-06 | 02-06 | `lifecycle.feature` built-in twins: enable, disable in session, disable and uninstall then next session, update, published change without update |
| MDOC-01 | 02-08 | `docs/mcp-compatibility.md`; the citation check exits 0 |

## Red-run roll-up

Every product change was shown failing before it passed; no reverted file was ever committed.

- **02-01:** step unit test against the `87d3f28` seed, 4 pass / 9 fail (Task 1) and 4 pass / 19 fail (Task 2); builtin `listing.feature` with the seed step, 2 of 2 then 3 of 3 failed at the listing wait; adapter profile with the MSEL-03 gate removed, 2 of 7 failed (`plugin_demo_stub` listed, adapter proxied the duplicate).
- **02-02:** seed step, 1 failed (Task 1), 12 of 12 failed (Task 2), 3 of 3 failed (Task 3), all at the listing wait; escaping removed, 3 of 3 failed (`!echo pwned` ran a shell command; `$HOME` expanded; the unset header never connected); adapter IN-02 without a notice failed in the IN-02 step (Task 1 and Task 2).
- **02-03:** seed step, 1 of 1, 6 of 6, and 9 of 10 failed (the bundle scenario needs no registration); conformance test with the secret-field escape removed, 10 of 63 failed.
- **02-04:** reader and stamp units at `87d3f28`, 13 of 58 failed (Task 1) and 6 of 59 against the Task 1 module (Task 2); builtin `builtin-status.feature` with both product files at the seed, every scenario failed only on its status cell (`status unknown`), the disabled one through the terminal.
- **02-05:** seed step, 4 of 4 failed at the listing wait; trust check forced to `true`, the two untrusted scenarios failed (registry listed `plugin_demo_stub`; the call used the project data directory); per-name precedence reversed, the trusted both-scope scenario failed on the data directory.
- **02-06:** seed step, 1, 4, and 7 failed at the listing wait; enabled filter removed, the disable next-session scenario failed (registry listed the server); `resyncBuiltinRegistrations` emptied, only the autoapply scenario failed.
- **02-07:** seed step and a rejecting legacy reader, the MREC-02 scenario failed at the listing wait; the adapter entry write skipped, both adapter-leg scenarios failed; the MSEL-03 gate removed, the switch scenario failed on Pi's `register_mcp_server` extension error; seed step, the built-in leg failed.
- **02-09:** seed step, each of the five scenarios failed at its listing wait (the control plugin for the server-less one).
- **02-08:** docs only; the citation check exits 1 at the base (no built-in table), per the plan, and 0 after Task 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The companion-missing and builtin-profile commands ran as plain split commands**
- **Found during:** Task 3
- **Issue:** The worktree guard refused the plan's compound command (command substitution feeding `npm`, and `git checkout` inside a script).
- **Fix:** The builtin file list went through a scratch script with no git; the companion check ran as a first-run script, then `sed` plus the second run, then a separate `git checkout HEAD -- features/mcp-server/companion-missing.feature`. Same assertions; the file was restored and `git status --porcelain` printed nothing.
- **Files modified:** none committed.

**2. [Plan detail] Added rows and per-cell citations**
- The plan allowed a header citation for a column one source proves whole. No column has one source, so every built-in cell cites its own. New rows (`tool_search` off, `sse`, the two built-in status tokens) follow the old rows.

**3. [Plan detail] `bareElicitationCapability` reads ✓ under Pi built-in**
- Pi announces only `roots` (the stub logs it in `project-scope.feature`), and `domain/mcp-builtin-features.ts` never blocks the field, so the row cannot read ✗ for Pi built-in.

## Parent lines

Each line names the file, the change, and the evidence. Items 1-9 come from the plan; items 10-20 are the Wave 1 and Wave 2 SUMMARYs' parent lines and unowned-file notes.

1. **`CHANGELOG.md`** (`## [Unreleased]`), one bullet per the changelog skill: "Plugin MCP servers now run through Pi's built-in MCP when pi-mcp-adapter is absent, at each start and `/reload`, only in projects that Pi trusts, with their status in `info`. Switching needs no plugin command." Evidence: BLT-01..06, MSEL-02 scenarios above.
2. **`README.md` line 29** (`- MCP servers. Requires [pi-mcp-adapter]...`): name either pi-mcp-adapter or Pi's built-in MCP, add that Pi's built-in MCP runs project servers only in a trusted project and picks up plugin changes at `/reload`. **Line 40** (pi-mcp-adapter "optional but recommended"): say it is optional because Pi's built-in MCP runs plugin servers without it. **Line 126**: add the built-in name `plugin_<plugin>_<server>` beside the adapter key. **Line 144**: "a feature that pi-mcp-adapter cannot run" becomes "a feature that the active MCP implementation cannot run". **`README.es.md`**: the same four lines (29, 40, 126, 144). Evidence: `docs/mcp-compatibility.md` "Choosing an implementation".
3. **`.planning/PROJECT.md` Key Decisions**, one row each: P2-DC-02 (built-in values resolved by the extension at registration, visible to every extension in the process; amends D-MB-04); P2-DC-08 (`mcp.json` overrides and refused registrations reported in `info` only, no load notice); P2-DC-10 (built-in status inferred from Pi's tool list); P2-DC-13 (containment root: the marketplace root or the plugin clones directory); P2-DC-14 (the project record wins per server name); P2-DC-05 (`timeout` as ms / 1000, no rounding); P2-DC-04 (no `cwd` written); P2-DC-20 (`callbackUrl` only with `callbackPort`).
4. **`.planning/BACKLOG.md`**: (a) move the `tool_search` projection (`features/lib/mcp-builtin-tool-search.ts` and the step in `features/step_definitions/mcp-server/builtin-tool-search.steps.ts`) into `features/lib/upstream/` (P2-DC-18); (b) re-pin the AVAR-05 deny-lists to Claude Code 2.1.318 (P2-DC-22); (c) a load-time notice for an overridden or refused built-in registration (deferred, P2-DC-08); (d) a fallback when `tool_search` is off (deferred); (e) info that tells a plugin server whose name another extension registered first from this extension's own registration, which needs this extension's own `extensionPath` and so a change to the frozen `createBuiltinMcpStatusReader` parameter (P2-DC-46).
5. **`docs/output-catalog.md`**: beside the adapter status mapping table (lines 3044-3056), add the built-in mapping: `connected` (a namespace tool not hidden), `disabled` (all hidden), `not connected` (registered, no tool), `not loaded` (not registered), `overridden by mcp.json`, `project not trusted`, `overridden by project scope`; add an example block for `overridden by mcp.json` and one for `project not trusted`. The example at line 3161 ("With pi-mcp-adapter absent, the `github` server's state is `status unknown`") now reads `not loaded` under Pi's built-in MCP for a plugin installed in the session (evidence: the companion-missing cell above). **`docs/json-output.md`** (line 951 lists the tokens): add a sentence on which tokens each implementation emits. Evidence: `builtin-status.feature`.
6. **`features/mcp-server/companion-missing.feature` line 76** (Phase 3, scenario `Plugin info names pi-mcp-adapter as a missing companion`): the `plugin components mcp` cell `"status":"status unknown"` becomes `"status":"not loaded"` under the builtin profile, realigning the table (from 02-04). Evidence: this gate's outcome (a), seeds 570831 and 880167.
7. **`test/orchestrators/plugin/info.test.ts`** (shared with the read-time verdicts): the MSEL-01 `builtin` case's reader snapshot names `plugin_alpha_srv`, not `plugin_alpha_srv_` (`builtin: statusSnapshot([{ name: "plugin_alpha_srv", status: "failed" }])`), changed by 02-04 (P2-DC-31). Keep that line when the read-time verdicts merge.
8. **`.fallowrc.json`** (frozen): `orchestrators/mcp/builtin-registration-step.ts` now imports `recordedMcpServers` and `createLegacyServersReader`, so drop `orchestrators/mcp/recorded-servers.ts` from `entry` and those two names from its `ignoreExports` (fallow never reports an `ignoreExports` name as stale). Run `npx fallow dead-code` after the edit; keep any other name it then reports as unused.
9. **Re-verify after the read-time verdicts merge:** the `info` scenarios of `builtin-status.feature` (their `plugin requires` and `plugin status` rows, P2-DC-16); every restart result of `implementation-switch.feature` (02-07 recorded none today); each `which did not fail` install that could become strict (the builtin twins of `configuration.feature`, `invocation.feature`, `sources.feature`, `builtin-values.feature`, `builtin-direct.feature`, `builtin-trust.feature`, `project-scope.feature`, and the enable and update twins of `lifecycle.feature`, P2-DC-78); and whether AMIG-01 stays ungated by implementation (if it becomes adapter-only, the legacy gap of P2-DC-11 spans every built-in session, and the doc's "Legacy mcp.json entries" text changes).
10. **`test/architecture/manifest-read-agreement.test.ts`** (unowned, from 02-01): add `bridges/mcp/builtin-description.ts` to the MANF-01 gate; it reads `MANIFEST_CANDIDATES` through `locateManifestCandidate`.
11. **`test/integration/adapter-expansion-conformance.test.ts`** (unowned, from 02-01): pass `ADAPTER_FIELD_ENCODER` at its two `substituteAndInject` calls; then make the encoder parameter of `bridges/mcp/substitute.ts` required and drop its default (P2-DC-19 as planned, P2-DC-53).
12. **`features/lib/upstream/`** (from 02-01): same move as item 4 (a), in Phase 6 (P2-DC-18).
13. **`.planning/codebase/CONVENTIONS.md`** (from 02-01 and 02-03): the `fallow-ignore` count goes from 44 to 45; `unused-export` markers on loader-read default exports are now seven, and the harness Pi extensions that Pi's `--extension` loader reads are five, adding `features/lib/mcp-builtin-config-probe/extension.ts`. Also note the three reasoned `@typescript-eslint/unbound-method` disables in the step and registration tests (strong-mock precedent).
14. **`.agents/skills/cucumber/rules/world-and-stand-ins.md`** (frozen, from 02-03, optional): name the config probe (`features/lib/mcp-builtin-config-probe/`) beside the registry probe as the extension a built-in values scenario loads through `extraExtensions` (P2-DC-24).
15. **`features/mcp-server/project-scope.feature`** description (from 02-05): it points to `builtin-status.feature` for the untrusted info row. 02-04 used that exact name, so no change is needed; listed so the parent can close it.
16. **`features/support/world.ts` / `features/lib/turn-records.ts`** (frozen harness, from 02-06): `assertStandInsStopped` runs at once after `pi.stop()`; poll briefly before it fails (a stand-in that Pi lost track of exits only when its stdin closes), or make `startSession` in `features/lib/pi-commands.ts` avoid the RPC double bind. Then lift "A new session offers the plugin's tool again (BLT-01)" in `features/mcp-server/lifecycle.feature` from `@adapter-only` to `@mcp`, and close the matching `.planning/WINDOWS.md` `unmet-truth` entry (P2-DC-77).
17. **Upstream Pi report** (from 02-06, not a repo edit): RPC `new_session` emits `session_start` twice (`dist/modes/rpc/rpc-mode.js` with `AgentSessionRuntime.finishSessionReplacement`), and the built-in MCP `session_start` handler (`dist/extensions/mcp/index.js`) does not close the connections of an earlier `session_start` in the same runtime.
18. **`.planning/phases/02-built-in-materialization/02-06-PLAN.md`** flagged assumption 2 (from 02-06, record only): "the scenarios hold either way" is false for Pi's built-in MCP when a server stays registered across `new_session`.
19. **After Phase 2 merges** (ROADMAP): rerun `npx fallow dupes` (the built-in and adapter entry and escape modules), and re-run the Phase 4 and Phase 5 built-in scenarios, since the extension's registration now serves the same tools as the stand-in.
20. **None** from 02-02, 02-07, and 02-09.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-02-31 is mitigated: the doc states twice that Pi gives every registered config, resolved secrets included, to every extension in the Pi process. T-02-32 is mitigated: "Legacy mcp.json entries" and its Divergences item state the one-session gap, its cause, and that Pi reads the entry with its own `$` and `!` rules; parent line 9 carries the re-verification. T-02-33 is mitigated by the gate above. T-02-34 is mitigated by the parent lines. T-02-SC: no package was added.

## Dubious Choices

**DC-A: Every built-in table cell carries its own citation**
- **Choice:** Per-cell citations, so table rows grow long.
- **Alternatives:** A header citation, which the plan allows only for a column that one source proves whole.
- **Why dubious:** The tables read heavier. No column has a single source, so a header citation would claim more than its file proves.
- **Severity:** Low.

**DC-B: `bareElicitationCapability: true` reads ✓ for Pi built-in, cited by `project-scope.feature`**
- **Choice:** The cited scenario shows the `initialize` Pi sends (`capabilities: {"roots":{}}`), so Pi announces no elicitation.
- **Alternatives:** Mark it `⚠`, or add a scenario that installs a server with the field.
- **Why dubious:** No scenario installs a server with `bareElicitationCapability: true` under Pi's built-in MCP.
- **Severity:** Low.

**DC-C: The verdict sentence under "Partially available plugins" cites this extension's own source**
- **Choice:** `extensions/pi-claude-marketplace/domain/mcp-builtin-features.ts`, the built-in classifier that Phase 1 wrote.
- **Alternatives:** A read-time-verdict scenario, which belongs to the next phase.
- **Why dubious:** The read-time verdicts can change how the verdict reaches the user; parent line 9 covers the re-verification.
- **Severity:** Low.

**DC-D: The switching steps name no Pi command and say "start Pi again"**
- **Choice:** "Remove pi-mcp-adapter from the packages that Pi loads", remove `-builtin:mcp` from the user settings, then start Pi again.
- **Alternatives:** Name a Pi package command; say `/reload` suffices.
- **Why dubious:** The scenario uses harness restart steps, not a user command, and no run measured whether `/reload` alone switches the implementation.
- **Severity:** Low.

**DC-E: The `request_timeout_ms` built-in cell cites `builtin-values.feature`, which pins only `timeout`**
- **Choice:** The cell says "`timeout`, in seconds, as for `timeout`", because both fields share the adapter table's normalization before the built-in conversion.
- **Alternatives:** Cite `test/domain/mcp-builtin-translation.test.ts`, which the citation check does not accept.
- **Why dubious:** No scenario declares `request_timeout_ms` under Pi's built-in MCP.
- **Severity:** Low.

**DC-F: The doc cites `P2-DC-NN` IDs as licenses**
- **Choice:** As the plan asks (P2-DC-02, -04, -05, -08, -10, -11, -15, -20, -21, -22, -46, and others).
- **Alternatives:** Cite only requirement and decision IDs.
- **Why dubious:** The `P2-` prefix names a phase, and the IDs need mapping when Phase 6 merges this log into the root `DUBIOUS-CHOICES.md`.
- **Severity:** Low.

**DC-G: The companion-missing check ran as split commands**
- **Choice:** Three plain commands instead of the plan's one compound command, because the worktree guard refused it.
- **Alternatives:** None that the guard allows.
- **Why dubious:** The restore was a separate call, so an interruption between the two calls would have left the file changed; the plan's recovery (`git checkout HEAD -- features/mcp-server/companion-missing.feature`) was run and confirmed.
- **Severity:** Low.

## Self-Check: PASSED

- `docs/mcp-compatibility.md` and this SUMMARY exist.
- Commits `1e8aef7` and `52b8d95` are ancestors of HEAD.
- `git status --porcelain features/mcp-server/companion-missing.feature` printed nothing.
