---
phase: 06-mcp-servers
plan: 09
subsystem: mcp
tags: [mcp, pi-mcp-adapter, pi-subagents, cucumber, phase-gate, docs]

requires:
  - phase: 06-mcp-servers
    provides: "plans 06-01..06-08: the eight features/mcp-server feature files, the D-CF6-01 merge and D-CF6-02 skip in domain/mcp-resolution.ts, and docs/mcp-compatibility.md re-measured on pi-mcp-adapter 7.0.0"
provides:
  - "the Phase 6 gate result on the combined tree: npm run check, npm run test:modules, and npm run test:cucumber twice, all exit 0 at 822a1ac"
  - "docs/mcp-compatibility.md checked against the merged resolver, with two small fixes"
  - "eleven ready-to-paste PROJECT.md Key Decisions rows (D-CF6-01..D-CF6-11)"
  - "the drafted, unfiled pi-subagents gap report (D-CF6-10)"
  - "the parent lines for every parent-owned or frozen file"
affects: [phase-6-merge, PROJECT.md, CHANGELOG.md, REQUIREMENTS.md, ROADMAP.md, BACKLOG.md]

actuals:
  tokens: 9000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "The gate plan's doc check reads the merged code and the scenarios, and fixes the doc in its own commit before the gate runs"

key-files:
  created:
    - .planning/phases/06-mcp-servers/06-09-SUMMARY.md
  modified:
    - docs/mcp-compatibility.md

key-decisions:
  - "The doc check found two gaps in Invalid server configs (a file with no server map; a skipped file server never replaces an earlier one) and one wrong Further reading line (the canary already pins 7.0.0); each was fixed in docs/mcp-compatibility.md before the gate"
  - "The canary raise to 7.0.0 that D-CF6-04 deferred is already done in the script; the parent line is now a live re-run and a new observed-result section"
  - "MCP-07 and ROADMAP SC4 are met by the D-CF6-10 pin, not by a working call"

patterns-established:
  - "A gate run that is stopped for an input change is restarted whole on the new commit, not resumed"

requirements-completed: [MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07, MCP-08]

coverage:
  - id: D1
    description: "The combined Phase 6 tree passes npm run check, npm run test:modules, and npm run test:cucumber twice in random order"
    verification:
      - kind: other
        ref: "npm run check (exit 0, 465 s, cucumber seed 961879, 1268 scenarios) at 822a1ac, Node v24.22.1"
        status: pass
      - kind: unit
        ref: "npm run test:modules (exit 0, 177 s)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber twice (exit 0; seeds 512508 and 920909; 1268 scenarios each)"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/mcp-compatibility.md Server sources and Invalid server configs match the merged domain/mcp-resolution.ts and the sources and invalid-configs scenarios"
    verification:
      - kind: manual_procedural
        ref: "line-by-line reading of mcp-resolution.ts against the doc; commits 556a44d and 822a1ac"
        status: pass
    human_judgment: true
    rationale: "Prose accuracy against code is a reading judgment; no test reads the doc"
  - id: D3
    description: "Eleven D-CF6 decision rows and the pi-subagents gap report, drafted for the parent"
    verification:
      - kind: other
        ref: "grep -c 'D-CF6-11' and grep -c 'pi-subagents gap report' on this SUMMARY (both >= 1)"
        status: pass
    human_judgment: true
    rationale: "Whether each row's wording and the report's request are what the user wants is a reading judgment; filing the report is the user's call"
  - id: D4
    description: "Parent lines for every parent-owned or frozen file, and no phase change to those files"
    verification:
      - kind: other
        ref: "git diff --quiet 3a7a707..HEAD -- CHANGELOG.md README.md README.es.md .planning/BACKLOG.md .fallowrc.json docs/output-catalog.md docs/prd docs/hooks-compatibility.md test/live-uat .agents/skills/cucumber .github (exit 0)"
        status: pass
    human_judgment: true
    rationale: "The parent applies the lines; whether each line is complete is checked at the merge"

duration: 55min
completed: 2026-11-01
status: complete
plan_head_before: eb31ac76eeca09b8698855bf6351d5944749bbdf
---

# Phase 6 Plan 09: MCP servers phase gate Summary

**The combined Phase 6 tree passes the whole gate at `822a1ac` on Node v24.22.1: `npm run check` (1268 scenarios, seed 961879), `npm run test:modules`, and `npm run test:cucumber` twice (seeds 512508 and 920909), all exit 0. `docs/mcp-compatibility.md` now matches the merged resolver. The parent gets eleven D-CF6 decision rows, a drafted pi-subagents gap report, and every line a component phase may not apply.**

## Performance

- **Duration:** about 55 min
- **Started:** about 2026-11-01T17:12Z
- **Completed:** 2026-11-01T18:07Z
- **Tasks:** 3
- **Files modified:** 2 (`docs/mcp-compatibility.md`, this SUMMARY)

## Gate evidence

All commands ran one after another in this worktree with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144` (direct `npx` commands through the same wrapper). The peer cache was filled first by `node scripts/install-test-peers.mjs` (pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, `@quintinshaw/pi-dynamic-workflows` 3.15.0).

- **Commit:** `822a1acdc2c71dcb2f72fb51a57a45a235cd74bd` (the tree of `eb31ac7` plus the two doc commits of Task 1)
- **Node:** v24.22.1

| Command | Exit | Run time | Result |
| --- | --- | --- | --- |
| `npm run lint` (lone ESLint warm-up) | 0 | 2 s (a first warm-up at `556a44d` also exited 0) | no finding |
| `npm run check` | 0 | 465 s | `check:static` passed all seven steps (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features). `test:unpaired` and `test:integration` passed. Cucumber: seed 961879, 1268 scenarios (1268 passed), 13245 steps (13245 passed), 3 m 11 s. Direct coverage for all pairs passed (`Merged LCOV: coverage/direct.lcov (318 records)`). |
| `npm run test:modules` | 0 | 177 s | no failure (the local reporter prints no count on a pass) |
| `npm run test:cucumber` (run 1) | 0 | 187 s | seed 512508, 1268 scenarios (1268 passed), 13245 steps (13245 passed), 3 m 04 s |
| `npm run test:cucumber` (run 2) | 0 | 199 s | seed 920909, 1268 scenarios (1268 passed), 13245 steps (13245 passed), 3 m 16 s |
| `npx cucumber-js features/mcp-server` | 0 | 63 s wall | seed 620424, 52 scenarios (52 passed), 663 steps, cucumber 1 m 01 s |
| `npx cucumber-js features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow` (the components shard paths) | 0 | 82 s wall | seed 285390, 110 scenarios (110 passed), 1319 steps, cucumber 1 m 20 s |

The noise lines `Legacy marketplace migration could not be persisted ...` in the logs are the sanctioned IL-3 `console.warn`, printed by cases whose legacy-migration save fails. They are not failures, and every run shows them.

A first gate run started at `556a44d` and was stopped after two minutes, during `check:static`, when the doc check found the Further reading line. The whole gate then ran again from the lone lint on `822a1ac`. No result of the stopped run is used.

The acceptance listing holds: `ls features/mcp-server` prints exactly `companion-missing.feature`, `configuration.feature`, `invalid-configs.feature`, `invocation.feature`, `lifecycle.feature`, `listing.feature`, `project-scope.feature`, and `sources.feature`, and `features/step_definitions/mcp-server/calls.steps.ts` does not exist.

No gate command failed, so no gate fix was needed.

Tracer gate: the run was interactive, the mode was `end-of-phase`, and Task 1's verify is automated only. The verify (the gate above) passed, so Tasks 2 and 3 followed with no checkpoint.

## Doc check (Task 1, step 1)

`docs/mcp-compatibility.md` "Server sources", "Invalid server configs", the Upgrading bullet, and the Migration divergence were read against the merged `domain/mcp-resolution.ts`, `features/mcp-server/sources.feature`, `features/mcp-server/invalid-configs.feature`, and the 06-07 SUMMARY.

| Doc text | Merged behavior | Result |
| --- | --- | --- |
| Server sources: order, the three value shapes, array order, replace-and-keep-position, entry only without `plugin.json`, file with or without the wrapper, bundles, the `./` residual | `resolveStrictMcp`, `readDeclaredMcp`, `readMcpArray`, `fileServerMap`, `isMcpBundle`, `recordMergedServers` | holds |
| Invalid server configs: "A file source that is missing, does not parse, or cannot be read is skipped" | `mergeServerFile` also skips a document that holds no server map (for example `[]`, or an `mcpServers` member that is not a map) | **gap, fixed** in `556a44d`: the list now adds "or holds no server map" |
| Invalid server configs: a skipped server and an earlier server of its name | a malformed server in a file is dropped before the merge, so it never replaces an earlier server of its name; upstream's `mit` does the same (06-RESEARCH) | **gap, fixed** in `556a44d`: "A skipped server does not replace a server with the same name from an earlier source, so that earlier server stays." |
| Invalid server configs: inline malformed server, and an absolute or escaping path, give `(unavailable) {malformed mcp}` | `mergeServerMap` and `locateReference` add a fatal note; the three refusal scenarios pin `malformed mcp` | holds |
| Upgrading: "A malformed server in a file source does not stop the move: the move treats that server as one that the plugin no longer declares" (06-08 inferred it) | 06-07's integration case "AMIG-01: /reload skips a malformed server in .mcp.json, moves its valid sibling, and removes the skipped one's old entry (D-CF6-02)" measures `hello no longer declares it.` with severity `info` | holds, now measured |
| Migration divergence: the move removes every server of a plugin whose inline config is not valid, or whose path is absolute or escaping | the same fatal notes make the migration's malformed arm remove every old entry (06-07 kept that case inline) | holds |
| Further reading: "the live test that runs this extension with pi-mcp-adapter 5.2.0" | `test/live-uat/mcp-adapter-canary.mjs` pins `ADAPTER_VERSION = "7.0.0"` (Phase 1); only its README's recorded result is from 5.2.0 | **wrong, fixed** in `822a1ac`: "runs this extension with pi-mcp-adapter 7.0.0. Its recorded result is from a run on pi-mcp-adapter 5.2.0." |

`docs/mcp-compatibility.md` is no build input (the `npm-check` hook skips it, and `format:check` does not glob `docs/`), so its commits ran pre-commit's mdformat and markdownlint and a manual `npx prettier --check`, which passed.

## Task Commits

1. **Task 1 (tracer): pass the phase gate on the combined tree**: `556a44d` (docs, the two Invalid server configs gaps), `822a1ac` (docs, the Further reading line), and the gate-evidence part of this SUMMARY
2. **Task 2: draft the D-CF6 decision records and the pi-subagents gap report**: SUMMARY sections, committed with this file
3. **Task 3: collect the parent lines**: SUMMARY sections, committed with this file

## Decision records

Ready to paste into the Key Decisions table of `.planning/PROJECT.md` (columns `Decision | Rationale | Outcome`), after the D-CF1 rows. Each row carries the residuals the plans measured.

| Decision | Rationale | Outcome |
| --- | --- | --- |
| **D-CF6-01 (component-features, Phase 6, settled autonomously, DUBIOUS-CHOICES P6-DC-01, P6-DC-07 items 3 and 5): a plugin's MCP servers are the ordered union of its sources, as Claude Code 2.1.316 merges them**. The plugin-root `.mcp.json` comes first, then the declared `mcpServers` value: the manifest's, or the marketplace entry's only when the plugin has no `plugin.json`. A declared value is a server map, a `./` path, or an array of both, read in order. A later server with the same name replaces the earlier one and keeps its position. A file holds its servers with or without the `mcpServers` wrapper. Supersedes PRD MC-1 ("first match wins, no merge"). | The 2.1.316 loader reads `.mcp.json` and then each manifest shape and merges them with object spread; the plugin loader uses the entry as the manifest only when `plugin.json` is absent, and the `strict: false` conflict list does not name `mcpServers` (binary strings and the plugins reference, 06-RESEARCH). Residuals kept under this ID: a path without `./` (`servers.json`) still loads, where Claude Code refuses the manifest, so plugins that install today keep installing; an `.mcpb` or `.dxt` path makes the plugin `(partially-available) {unsupported mcp}` with no note that names the bundle, because pi-mcp-adapter has no bundle runner (Pi gap); a file's map is read by the presence of an own `mcpServers` member, not by upstream's truthiness test, which differs only when `mcpServers` is `null`, `0`, or `""`; an absolute or escaping bundle path is refused `{malformed mcp}`, because containment runs first. Proof: `features/mcp-server/sources.feature` (6 scenarios, red runs for the merge and the array), `test/domain/mcp-resolution.test.ts`. | ✓ Good |
| **D-CF6-02 (component-features, Phase 6, settled autonomously, DUBIOUS-CHOICES P6-DC-02, P6-DC-07 items 1 and 2, P6-DC-18): a defect in a file source contributes nothing, silently; a defect written inline, or a path that is absolute or leaves the plugin root, makes the plugin `(unavailable) {malformed mcp}`**. A file source is `.mcp.json` or a file that `mcpServers` names. A missing file, a file that cannot be read (EACCES included) or parsed, a file that holds no server map, a path walk I/O error (ENOTDIR and the like), and a malformed server inside a file are each skipped, and the other servers and components install. A skipped server never replaces an earlier server of its name. An array with one element that is neither a path nor a map is refused whole. | Claude Code's loader drops such a server or file at debug level, and only `claude plugin validate` reports it ("The plugin loader silently drops this server at load"); an inline map is part of the manifest, so one bad server fails the manifest and the install (2.1.316 probes in a throwaway HOME). The CONTEXT's "install warning" is withdrawn, because upstream shows none and the warning would need edits outside Phase 6. Each skip writes one line to the env-gated debug channel (`PI_CLAUDE_MARKETPLACE_DEBUG=1`, category `mcp`) and no notification. AMIG-01 inherits the rule through `resolveStrict`: the move skips such a server, moves its siblings, and removes the skipped one's old entry with the info row `<plugin> no longer declares it.` (`test/integration/mcp-migration.test.ts`). Residual: a real permission problem on the user's disk now goes unreported, as upstream. Proof: `features/mcp-server/invalid-configs.feature` (8 scenarios, red runs recorded), `test/domain/mcp-resolution.test.ts`. | ✓ Good |
| **D-CF6-03 (component-features, Phase 6, settled autonomously, DUBIOUS-CHOICES P6-DC-03): project-scope plugin servers keep pi-mcp-adapter's project trust, a licensed divergence**. This extension never writes `<agent dir>/mcp-project-approvals.json`. | pi-mcp-adapter 7.0.0 keys each approval by project root, server name, and definition hash and offers no API for another extension to approve a server; that file is outside the NFR-10 write set (Pi gap plus NFR-10). Claude Code never asks to approve a plugin server. Pinned on 7.0.0 in a headless session: with the user-global `settings.projectServers: "allow"` in a trusted project the server answers a call; without it the proxy answers `Tool "mcp__plugin_demo_stub__echo" not found. ...` and `mcp({})` lists the server as `blocked: project server approval required`; in a project Pi does not trust it is `blocked by project trust` even with the setting; the stub never starts; `info` shows `pending approval` (`features/mcp-server/project-scope.feature`, 4 scenarios). The interactive dialog and `pi --mcp-project-servers allow` were checked in the 7.0.0 source only. | ✓ Good |
| **D-CF6-04 (component-features, Phase 6, settled autonomously): every row of `docs/mcp-compatibility.md` is re-measured on pi-mcp-adapter 7.0.0 and Pi 1.4.0**. Each run-time statement cites a `features/mcp-server/` scenario, a dated run, or "checked in the 7.0.0 source". | Two rows broke and were rewritten: `MCP_DIRECT_TOOLS` (an unnamed server now gets one per-server tool and deferred tools named `mcp__plugin_<p>_<s>___<tool>`, recorded as a Naming divergence), and the hooks row (since adapter 6.0 a proxied call also runs as a nested Pi tool call under the real name). No product break was found. Rows that still rest on older runs, and say so: the name lengths (2026-10-06, Pi 1.0.0, adapter 5.0.0) and the extra `/reload` after an upgrade (canary, 2026-10-09, adapter 5.2.0). Rows checked only in the 7.0.0 source: `PI_MCP_CONFIG_MODE`, `--mcp-config`, the interactive approval dialog, `--mcp-project-servers`, the SSE fallback, and the `claudePlugins` loader. The canary script already pins 7.0.0; its recorded result is still the 5.2.0 run. | ✓ Good |
| **D-CF6-05 (component-features, Phase 6, settled autonomously, DUBIOUS-CHOICES P6-DC-11 items 1 and 2): MCP tool names are observed through what pi-mcp-adapter returns to the model, and through the registry probe**. | A scripted `mcp({ search: "echo" })` returns `Activated as direct tools: mcp__plugin_demo_stub__echo.`, and the next request offers that tool (`features/mcp-server/listing.feature`). The probe shows the deferred tool registered but inactive before the search; the probe When reads until two reports 250 ms apart agree, because the adapter registers the tool after the listing connection closes (a heuristic). Residual: the lazy `mcp({ server })` listing holds an em dash that the `fix-unicode-dashes` hook rewrites in feature files, so that scenario connects before it lists, and the first listing a model sees is not compared whole. | ✓ Good |
| **D-CF6-06 (component-features, Phase 6, settled autonomously, DUBIOUS-CHOICES P6-DC-04, P6-DC-08 item 9): Phase 6 adds its own stand-ins and leaves the frozen stdio stub unchanged**. `features/lib/mcp-server-http.ts` is a loopback Streamable HTTP MCP server on `127.0.0.1`, port 0, that logs each request's method, params, and headers and closes in the scenario's release. `features/lib/mcp-server-environment.ts` is a `--import` preload that copies named variables into `STUB_TAG`, so the frozen stub's echo shows its own environment. | The frozen stub cannot report its argv, environment, or HTTP headers. With these stand-ins, `features/mcp-server/configuration.feature` (10 scenarios) shows the headers on every request with `${NAME}` expanded at connect time, and `env`, `args`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and `${NAME:-default}` as Claude Code expands them. Residual: the HTTP stand-in's answers differ slightly from the stub's (no protocol-version fallback, no `required` list) to avoid a fallow clone; the OAuth scenario cannot tell OAuth mode apart from non-OAuth mode, so only the integration test pins the written `auth: "oauth"`. | ✓ Good |
| **D-CF6-07 (component-features, Phase 6, settled autonomously, DUBIOUS-CHOICES P6-DC-04): the agent granted a plugin MCP tool is written by `publishMcpServerAgent` in `features/lib/mcp-server-files.ts` through the frozen `writePublishedPluginFile`, never through `features/lib/agent-files.ts`**. | Phase 4 owns `agent-files.ts`. The run uses only Phase 1 stand-ins: the scripted model, the MCP stub, and pi-subagents 0.84.0. The agents bridge converts `tools: mcp__plugin_demo_stub__echo` into `mcp:plugin_demo_stub_/echo` and warns that such an agent needs `async: true` (`features/mcp-server/invocation.feature`). | ✓ Good |
| **D-CF6-08 (component-features, Phase 6, settled autonomously, DUBIOUS-CHOICES P6-DC-15): without pi-mcp-adapter, install and `info` keep `{requires pi-mcp-adapter}` and `(missing)`; a later Pi with the adapter reaches the server with no reinstall**. | No product fix was needed. Pinned on 7.0.0: the install row `installed` with `requires pi-mcp-adapter` (severity `warning`, `needs reload true`); `info` lists `plugin:demo:stub` as `status unknown` without the adapter and `cached, connects on first use` with it; the later Pi's call returns `echo:ping` (`features/mcp-server/companion-missing.feature`, 4 scenarios). A mutation of the soft-dep adapter arm failed 3 of 4 scenarios. Residual: right after the adapter first lists a server, `info` can read `status unknown` for a moment (once in ten runs under load), so the scenarios poll `info` until the adapter has reported. | ✓ Good |
| **D-CF6-09 (component-features, Phase 6, settled autonomously, DUBIOUS-CHOICES P6-DC-14): disable, uninstall, enable, and update are observed through what pi-mcp-adapter does in a Pi started after the change**. | Each scenario scripts the `mcp` proxy and `mcp({})`, because the proxy's not-found text cannot tell a removed server from a disabled one. Pinned on 7.0.0: after disable or uninstall `mcp({})` returns `MCP: 0/0 servers, 0 tools` and the stub never starts; after enable the call returns `echo:ping`; after an update it returns `v2:echo:ping`, and without the update it stays `echo:ping`; the user's `disabled: true` survives an update, a disable then enable, and an uninstall then install (`(1 disabled)`, `⊘ plugin_demo_stub_ (disabled)`) (`features/mcp-server/lifecycle.feature`, 8 scenarios). No product break. Residual: the update scenario publishes a root `.mcp.json` without the `mcpServers` wrapper, because of the fixture writer's stub-marker rule. | ✓ Good |
| **D-CF6-10 (component-features, Phase 6, settled autonomously, DUBIOUS-CHOICES P6-DC-07 item 4, P6-DC-09): MCP-07 is met as a recorded companion gap, not by a working call**. pi-subagents 0.84.0 gives MCP tools only to background children. A foreground launch of an agent with `tools: mcp__plugin_<p>_<s>__<tool>` is refused before the child runs; a foreground child without `tools:` gets no MCP tool. | Measured on Pi 1.4.0, pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, after the adapter had cached the server's tools: the tool result is `subagent failed: Unresolved MCP direct-tool selectors: plugin_demo_stub_/echo. Direct MCP tools require a matching configured server and fresh metadata cache; runtime-registered servers require a host/pi-mcp-adapter handoff before child launch.`, and the stub receives nothing after its startup listing; the no-tools child is offered `read, bash, edit, write, bg_wait, contact_supervisor` (`features/mcp-server/invocation.feature`). pi-subagents `docs/agents.md` says foreground children never load ambient extensions, so such agents must run with `async: true`. A background run is not tested: the harness's background children load neither the profile's companions nor the scripted model. The root cause of the cache wording is not claimed. The pi-subagents report is drafted in `06-09-SUMMARY.md` and not filed; filing is the user's call. ROADMAP SC4 and MCP-07 read as met by this pin. | ⚠ Revisit (gap pinned; report not filed) |
| **D-CF6-11 (component-features, Phase 6, settled autonomously, DUBIOUS-CHOICES P6-DC-07 item 6): a fresh profile Pi started after a change stands in for `/reload` where the harness has no reload step**. | A Pi reads `mcp-adapter.json` and the extension's state at startup, as a reload does. The companion-missing scenarios (MCP-06) and every lifecycle scenario (MCP-08) start a profile Pi after the change. Residual: no Phase 6 scenario runs `/reload` inside a running session, so a difference between a reload and a fresh start is not covered. | ✓ Good |

## pi-subagents gap report (D-CF6-10, drafted, not filed)

This report is text only. It was not posted, because a public post is the user's call. File it at the pi-subagents issue tracker if the user agrees.

**Title:** Foreground subagents cannot use pi-mcp-adapter tools, so a Claude Code plugin agent with an MCP tool cannot run

**Versions:** Pi 1.4.0, pi-subagents 0.84.0, pi-mcp-adapter 7.0.0. The parent Pi loads both companions with `--extension`.

**What a Claude Code plugin expects.** A Claude Code plugin can ship an MCP server and an agent. The agent's `tools:` list can name a tool of that server, such as `mcp__plugin_demo_stub__echo`. In Claude Code, the main session can start this agent in the foreground, and the agent can call the tool.

**What pi-subagents 0.84.0 does.** pi-claude-marketplace converts that agent into a pi-subagents agent with `tools: mcp:plugin_demo_stub_/echo`. pi-mcp-adapter has already connected to the server, listed its tools, and saved them in its cache. A foreground launch, `subagent {"agent": "demo:runner", "task": "say ping", "async": false}`, then fails before the child starts. The tool result is:

```text
subagent failed: Unresolved MCP direct-tool selectors: plugin_demo_stub_/echo. Direct MCP tools require a matching configured server and fresh metadata cache; runtime-registered servers require a host/pi-mcp-adapter handoff before child launch.
```

The MCP server receives no request after its startup listing. An agent without a `tools:` list does run in the foreground. Its child gets `read`, `bash`, `edit`, `write`, `bg_wait`, and `contact_supervisor`, and no `mcp` tool and no MCP server tool.

`docs/agents.md` says that a foreground child runs inside the parent Pi process and never loads the parent's ambient extensions, so an agent that needs MCP tools from pi-mcp-adapter must run with `async: true`. The docs also say that a foreground launch of such an agent "fails with a diagnostic that says exactly that". The diagnostic above does not say that. It names a missing configured server or a stale metadata cache, although the server is configured and its cache is fresh.

**What a user sees.** A user installs a Claude Code plugin whose agent uses the plugin's own MCP tool. A foreground run of that agent fails every time. The error points at the cache, not at the foreground rule.

**What pi-claude-marketplace cannot do.** The installer warns that such an agent needs `async: true`, but it cannot change how the main model launches the agent. A Claude Code agent file has no way to declare pi-subagents' own `extensions` or `subagentOnlyExtensions` list, and Claude Code ignores agent-level `mcpServers` on plugin agents. Our test harness cannot show a working background call either, because its background children do not load the profile's companions or its scripted model.

**Request.** One of these, in order of preference:

1. Give a foreground child the MCP tools that the parent's pi-mcp-adapter already has, for the `mcp:` selectors that the agent lists. For example, a handoff from pi-mcp-adapter to the child session, without a second copy of the adapter.
2. Or document a supported handoff that another extension can use to give a foreground child those tools.
3. At least, make the foreground diagnostic say that MCP tools need `async: true`, as `docs/agents.md` promises.

**Steps to reproduce.** Install pi-mcp-adapter 7.0.0 and pi-subagents 0.84.0. Configure a stdio MCP server under the key `plugin_demo_stub_` with one tool, `echo`, and start Pi once so that the adapter caches its tools. Add an agent `runner` with `tools: mcp:plugin_demo_stub_/echo`. Ask the model to run `subagent` with `"agent": "runner"` and `"async": false`.

<!-- gsd:write-continue -->
