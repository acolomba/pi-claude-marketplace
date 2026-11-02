---
phase: 06-mcp-servers
verified: 2026-11-02T11:15:31Z
status: passed
score: 5/5 roadmap truths verified (4 VERIFIED, 1 PASSED (override) on SC4/MCP-07)
covered_files:
  - ".planning/phases/06-mcp-servers/06-01-PLAN.md"
  - ".planning/phases/06-mcp-servers/06-01-SUMMARY.md"
  - ".planning/phases/06-mcp-servers/06-02-PLAN.md"
  - ".planning/phases/06-mcp-servers/06-02-SUMMARY.md"
  - ".planning/phases/06-mcp-servers/06-03-PLAN.md"
  - ".planning/phases/06-mcp-servers/06-03-SUMMARY.md"
  - ".planning/phases/06-mcp-servers/06-04-PLAN.md"
  - ".planning/phases/06-mcp-servers/06-04-SUMMARY.md"
  - ".planning/phases/06-mcp-servers/06-05-PLAN.md"
  - ".planning/phases/06-mcp-servers/06-05-SUMMARY.md"
  - ".planning/phases/06-mcp-servers/06-06-PLAN.md"
  - ".planning/phases/06-mcp-servers/06-06-SUMMARY.md"
  - ".planning/phases/06-mcp-servers/06-07-PLAN.md"
  - ".planning/phases/06-mcp-servers/06-07-SUMMARY.md"
  - ".planning/phases/06-mcp-servers/06-08-PLAN.md"
  - ".planning/phases/06-mcp-servers/06-08-SUMMARY.md"
  - ".planning/phases/06-mcp-servers/06-09-PLAN.md"
  - ".planning/phases/06-mcp-servers/06-09-SUMMARY.md"
  - "docs/mcp-compatibility.md"
  - "extensions/pi-claude-marketplace/bridges/agents/convert.ts"
  - "extensions/pi-claude-marketplace/domain/components/mcp.ts"
  - "extensions/pi-claude-marketplace/domain/manifest-containment.ts"
  - "extensions/pi-claude-marketplace/domain/mcp-resolution.ts"
  - "features/lib/mcp-server-environment.ts"
  - "features/lib/mcp-server-files.ts"
  - "features/lib/mcp-server-http.ts"
  - "features/mcp-server/companion-missing.feature"
  - "features/mcp-server/configuration.feature"
  - "features/mcp-server/invalid-configs.feature"
  - "features/mcp-server/invocation.feature"
  - "features/mcp-server/lifecycle.feature"
  - "features/mcp-server/listing.feature"
  - "features/mcp-server/project-scope.feature"
  - "features/mcp-server/sources.feature"
  - "features/plugin/update.feature"
  - "features/step_definitions/agent/listing.steps.ts"
  - "features/step_definitions/mcp-server/configuration.steps.ts"
  - "features/step_definitions/mcp-server/invalid-configs.steps.ts"
  - "features/step_definitions/mcp-server/invocation.steps.ts"
  - "features/step_definitions/mcp-server/lifecycle.steps.ts"
  - "features/step_definitions/mcp-server/listing.steps.ts"
  - "features/step_definitions/mcp-server/sources.steps.ts"
  - "features/step_definitions/mcp-server/status.steps.ts"
  - "test/bridges/agents/convert.test.ts"
  - "test/domain/components/mcp.test.ts"
  - "test/domain/components/plugin.test.ts"
  - "test/domain/mcp-resolution.test.ts"
  - "test/domain/plugin-resolver.test.ts"
  - "test/integration/mcp-migration.test.ts"
  - "test/orchestrators/plugin/install-flow-ledger.test.ts"
  - "test/orchestrators/reconcile/mcp-migration.test.ts"
covered_digest: "v4:sha256:0c5c84e28f02057a3c25e1ca898d7dc4271aaa6d79301228df1a214b32586d13"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "An agent granted a plugin MCP tool calls it in a foreground run, and the stub logs the call (MCP-07)"
    reason: "Accepted deviation (user decision A.2 of 2026-11-02, .planning/DUBIOUS-CHOICES.md). pi-subagents' documented design (docs/agents.md l.553) loads no ambient extension, pi-mcp-adapter included, into a foreground child, so a foreground call cannot reach a plugin MCP tool; the user accepted that refusal as pi-subagents' design. pi-subagents 0.84.0 bug A (its validator rejects directTools: \"search\", which this extension writes for every plugin server) drops every bridged server even for a background child, which is the refusal features/mcp-server/invocation.feature pins; bug B (${VAR:-default} cache-key mismatch) is a second upstream defect. The extension now writes async: true for every agent that runs plugin MCP tools (bridges/agents/convert.ts, commits 204a8e6/fceb752, pinned by the invocation.feature staging scenario). Upstream patches for A and B are drafted in .planning/upstream/pi-subagents-mcp-direct-tools.patch for the user's review. BACKLOG MCPBG-01 tracks proving a background call later."
    accepted_by: "acolomba"
    accepted_at: "2026-11-02T11:15:00Z"
re_verification:
  previous_status: human_needed
  previous_score: 4/5
  gaps_closed:
    - "SC4/MCP-07: the human decision the previous report requested was made (A.2); recorded here as an override"
    - "WR-01/WR-02 link rule: implemented as the user decided (A.3); a referenced mcpServers file follows a link whose real target stays inside the plugin root"
  gaps_remaining: []
  regressions: []
---

# Phase 6: MCP Servers Verification Report

**Phase Goal:** With pi-mcp-adapter 7.x loaded, a bridged MCP server connects under Claude's tool names, receives its configuration as upstream, answers calls from the model and from agents, starts in a project as decided, recovers when the adapter is loaded later, and follows the plugin lifecycle.
**Verified:** 2026-11-02T11:15:31Z at `2ba505a` (working tree clean)
**Status:** passed
**Re-verification:** Yes. The previous report (2026-11-01) was `human_needed` at 4/5, with no `gaps:` section. It asked a human to decide SC4/MCP-07. The user decided on 2026-11-02 (A.2 and A.3 in `.planning/DUBIOUS-CHOICES.md`). I re-verified the whole tree, not only the open item, because two product changes landed after the previous report.

## Summary

SC1, SC2, SC3, and SC5 hold on the current tree. Each has whole-literal cucumber scenarios that I re-ran at `2ba505a`. SC4 is not met as written: no scenario shows an agent calling a plugin MCP tool, and none shows the stub logging such a call. The user accepted that as a deviation (A.2). I record it as `PASSED (override)` with `accepted_by: acolomba`. The `async: true` change that A.2 asked for is in `bridges/agents/convert.ts` and a scenario pins it. The A.3 link rule is in `domain/mcp-resolution.ts`. A scenario pins each direction, and unit tests cover the note text, dangling links, and link loops.

No BLOCKER. I found two warnings, both about wording, and neither changes a must-have. The docs and the install warning describe the background launch as the way to reach MCP tools, but they do not say that on pi-subagents 0.84.0 an agent with an explicit `mcp:` grant still fails in the background (bug A). BACKLOG MCPBG-01 and MCPSUB-01 also predate the A.2 decision. Details are under Anti-Patterns.

## Goal Achievement

### Observable Truths (ROADMAP success criteria are the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 (MCP-01, MCP-02): a bridged stdio server connects (the stub logs `initialize` and `tools/list`), its tools register as `mcp__plugin_<plugin>_<server>__<tool>`, and a scripted `mcp` proxy call reaches the stub with the given arguments and returns its result to the model | VERIFIED | `listing.feature`: search activates `mcp__plugin_demo_stub__echo`, with the whole stub log; `api` and `my.db` give `mcp__plugin_demo_api__echo` and `mcp__plugin_demo_my_db__echo`; negative controls. `invocation.feature`: the proxy call logs `tools/call {"name":"echo","arguments":{"text":"ping"}}` and returns `mcp returned: echo:ping`; a direct call returns `echo:direct`; an unlisted tool never reaches the stub. My re-run: 55/55 scenarios in `features/mcp-server`. |
| 2 | SC2 (MCP-03, MCP-04): args, env, `${VAR}`, `${VAR:-default}`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and loopback remote servers with headers reach the server as upstream; the documented rows hold on 7.x; multiple sources and a malformed server behave as FG-27/FG-28 decide | VERIFIED | `configuration.feature`: whole request tables for loopback headers; env Outline for the literal value, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PLUGIN_ROOT}`, and `${VAR:-default}`. `sources.feature` (7 scenarios, including the new in-plugin link scenario) and `invalid-configs.feature` (6 scenarios, including the new out-of-plugin link scenario). `domain/mcp-resolution.ts` implements the FG-27 merge order, the FG-28 silent file skip and inline-fatal rule, and the A.3 link rule (see the link section below). `docs/mcp-compatibility.md` names pi-mcp-adapter 7.0.0 on Pi 1.4.0, and its link text (l.46, l.245, l.473) matches the code. |
| 3 | SC3 (MCP-05, MCP-06): in a trusted project, project-scope plugin servers start as FG-29 decides, and the untrusted case is pinned; without the adapter the install shows `{requires pi-mcp-adapter}`, and loading the adapter then `/reload` makes the servers available with no reinstall | VERIFIED | `project-scope.feature`: an allowed server connects; headless without the setting is blocked; an untrusted project is blocked even with the setting; `info` shows `pending approval` (D-CF6-03). `companion-missing.feature`: the install reason is `requires pi-mcp-adapter`; a Pi started later with the adapter answers `echo:ping` with no reinstall (the fresh-Pi stand-in for `/reload` is D-CF6-11). No change since the previous report; re-run green. |
| 4 | SC4 (MCP-07): an agent granted a plugin MCP tool calls it in a foreground run, and the stub logs the call | PASSED (override) | Override: accepted deviation. pi-subagents' design refuses MCP tools to foreground children, and 0.84.0 bug A drops every bridged server even for background children. The extension writes `async: true` for MCP agents, and upstream patches for bugs A and B are drafted. Accepted by acolomba on 2026-11-02T11:15:00Z. Codebase evidence for what was delivered: `convert.ts:899-901` computes `backgroundForMcp = runsMcpTools(...)` and pushes the D-CF6-10 warning; `convert.ts:961` emits `async: backgroundForMcp \|\| isTrueBackground(raw.background)`; `runsMcpTools` (l.1011) covers an explicit `mcp:` entry and an omitted list in a plugin with MCP servers. The `invocation.feature` scenario "Installing an agent granted a plugin MCP tool stages it to run in the background (D-CF6-10)" pins the whole staged file, including `async: true` and the warning. Without the change the file would have no `async:` line, so the scenario fails. Unit tests in `test/bridges/agents/convert.test.ts` cover `background: false` with an explicit grant (l.2199) and with an omitted list (l.2219). The two D-CF6-10 refusal pins remain green. No scenario shows a working agent call. |
| 5 | SC5 (MCP-08): disable, uninstall, and update remove or replace the server entries the adapter sees | VERIFIED | `lifecycle.feature` (8 scenarios): disable and uninstall give `Tool ... not found`, `MCP: 0/0 servers, 0 tools`, and an empty stub log; enable restores the answer; update to `v2` answers `v2:echo:ping`; a user's `disabled: true` survives update, disable then enable, and uninstall then install. No change since the previous report; re-run green. |

**Score:** 5/5 truths: 4 VERIFIED, 1 PASSED (override). 0 present-but-behavior-unverified.

### The A.3 link rule (WR-01/WR-02), checked against the code

| Claim (A.3) | Code | Test evidence | Status |
|---|---|---|---|
| A referenced `mcpServers` file follows a link whose real target is inside the plugin root | `mcp-resolution.ts::locateReference` lexically refuses absolute and `..` references, then calls `locateManifestCandidate(copyManifestBoundary(pluginRoot), spelled)`. When `assertPathInside` refuses (a link), `manifest-containment.ts::locateLinkedCandidate` realpaths the plugin root and the candidate and returns `{kind:"open", path: target}` only when `assertPathInside(realRoot, target)` passes. The read opens the resolved target, not the link as written. | `sources.feature` "A server reference that is a symbolic link to a file inside the plugin loads its servers" (`servers.json` -> `config/servers.json`; `mcp__plugin_demo_r__echo` is offered). Before 8aef795 this plugin was refused, so the scenario fails without the change. Unit tests: "reads ... through a file link" and "... through a directory link" assert that the only read is `config/real.json`. | VERIFIED |
| A link that points outside stays refused | `locateLinkedCandidate` returns `ESCAPES`, and `locateReference` maps it to `refused` with `malformed mcp reference: symbolic link resolves outside plugin root: "<raw>"` | `invalid-configs.feature` "...symbolic link out of the plugin makes the plugin unavailable..." (`(unavailable) {malformed mcp}`). The outside behavior did not change, so this scenario is a regression guard and would also pass without the change. Unit test "refuses ... whose link resolves outside the plugin root without reading it" asserts `reads: []` and the exact note. | VERIFIED |
| The note stops saying "escapes plugin root" for a link | The note `escapes plugin root` is now produced only by the lexical `..` check. A link outside the root gets the `symbolic link resolves outside` note, and a link inside the root is read. | Unit test pins the new wording. The note reaches only the debug log; users see `{malformed mcp}` (DC-39 item 6). | VERIFIED |
| The root `.mcp.json` keeps following links anywhere | 8aef795 does not touch the root `.mcp.json` path | The `sources.feature` and `invalid-configs.feature` root-link scenarios from the earlier waves stay green | VERIFIED |
| A dangling link or a link loop contributes nothing, silently (D-CF6-02) | `ABSENT` -> `unreachable` ("its symbolic link is dangling"); `ELOOP` -> `unresolvable` -> `unreachable` | Unit tests "skips ... through a dangling link / a link loop silently" | VERIFIED |

MCPR-04's amendment is recorded in `.planning/PROJECT.md` l.1213.

### PLAN must-haves cross-check

The PLAN frontmatter truths add detail to the roadmap contract and remove none of it. The 06-01..06-09 rows from the previous report still hold. Two items changed after the plans: 06-04's D-CF6-10 pins now sit beside a third scenario that pins `async: true`, and 06-07's "an escaping reference stays fatal" now covers only a lexical escape or a link whose real target leaves the plugin root. Both changes follow the user decisions. Neither drops a plan truth.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `features/mcp-server/*.feature` (8 files) | one feature per topic | VERIFIED | 55 scenario runs pass (52 + 3 new) |
| `features/step_definitions/mcp-server/*.steps.ts` | shared and topic steps | VERIFIED | New link Given in `listing.steps.ts` asserts the link text with `readlink` |
| `features/lib/mcp-server-files.ts` | fixture writers | VERIFIED | `linkPublishedMcpFile` refuses a link path outside the plugin and takes `dir` publications only |
| `extensions/pi-claude-marketplace/domain/mcp-resolution.ts` | merge, silent file skip, inline fatal, link rule | VERIFIED | Wired via `resolveStrictMcp` from `plugin-resolver.ts` |
| `extensions/pi-claude-marketplace/domain/manifest-containment.ts` | the D-PL2-24 locator reused | VERIFIED | `copyManifestBoundary`, `locateManifestCandidate` imported by `mcp-resolution.ts` |
| `extensions/pi-claude-marketplace/bridges/agents/convert.ts` | `async: true` for MCP agents | VERIFIED | l.899-901, l.961, l.1011 |
| `docs/mcp-compatibility.md` | 7.0.0 rows; link and agent text | VERIFIED (with a wording warning) | See Anti-Patterns |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `domain/plugin-resolver.ts` | `domain/mcp-resolution.ts` | `resolveStrictMcp(` | WIRED | unchanged |
| `domain/mcp-resolution.ts` | `domain/manifest-containment.ts` | `locateManifestCandidate(copyManifestBoundary(...))` | WIRED | new in 8aef795 |
| `bridges/agents/convert.ts::convertAgent` | staged agent frontmatter | `async:` field | WIRED | the scenario reads the staged file |
| `listing.steps.ts` | `mcp-server-files.ts` | `linkPublishedMcpFile(` | WIRED | new in 8aef795 |
| `invocation.steps.ts` | `mcp-server-files.ts` | `publishMcpServerAgent(` | WIRED | unchanged |
| `lifecycle.steps.ts` | `mcp-server-files.ts` | `writeMcpAdapterOverride(` | WIRED | unchanged |

### Data-Flow Trace (Level 4)

Each scenario sends values through the real Pi 1.4.0, pi-mcp-adapter 7.0.0, and pi-subagents 0.84.0, and asserts them at the stub, the HTTP request table, the scripted model's call log, or the staged agent file. For the link rule, the in-plugin link scenario shows the linked file's server reaching pi-mcp-adapter as an offered tool. I found no hollow props and no static fallbacks.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All MCP scenarios, including the 3 new ones | `NODE_OPTIONS=--max-old-space-size=6144 npx cucumber-js features/mcp-server` | 55 scenarios (55 passed), 704 steps (704 passed), seed 228118, exit 0 | PASS |
| Resolver, schema, agents conversion, AMIG-01 | `node --test test/domain/mcp-resolution.test.ts test/domain/components/mcp.test.ts test/bridges/agents/convert.test.ts test/integration/mcp-migration.test.ts` | 229 pass, 0 fail | PASS |
| Full gate (reused) | `npm run check` at `2ba505a`, reported by the orchestrator | exit 0; cucumber 1554/1554 (seed 82800); direct coverage 330 records; `EXIT=0` in the log `decisions-check.log`. The log does not print the commit; the commit is the orchestrator's statement. `2ba505a` changes only `.planning/DUBIOUS-CHOICES.md` on top of `b68d4ad`. | PASS (reused) |

### Probe Execution

SKIPPED. The phase declares no `probe-*.sh` scripts, and none exist under `scripts/*/tests/`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MCP-01 | 06-01, 06-09 | stdio server connects; Claude Code tool names | SATISFIED | `listing.feature` |
| MCP-02 | 06-04, 06-09 | proxy call reaches the stub and returns | SATISFIED | `invocation.feature` |
| MCP-03 | 06-02, 06-08, 06-09 | configuration variants; doc rows on 7.x | SATISFIED | `configuration.feature`; `docs/mcp-compatibility.md` |
| MCP-04 | 06-03, 06-07, 06-09 | multiple sources and a malformed server (FG-27/FG-28) | SATISFIED | `sources.feature`, `invalid-configs.feature`, `mcp-resolution.ts`, unit tests; link rule per A.3 |
| MCP-05 | 06-05, 06-09 | project-scope servers per FG-29; untrusted pinned | SATISFIED | `project-scope.feature`; D-CF6-03 |
| MCP-06 | 06-05, 06-09 | `{requires pi-mcp-adapter}`; recovery with no reinstall | SATISFIED | `companion-missing.feature` |
| MCP-07 | 06-04, 06-09 | an agent granted a plugin MCP tool can call it in a foreground run | ACCEPTED DEVIATION (override) | User decision A.2; `async: true` emitted and pinned; working call untested (BACKLOG MCPBG-01) |
| MCP-08 | 06-06, 06-09 | disable, uninstall, update remove or replace entries | SATISFIED | `lifecycle.feature` |

No orphaned requirements: `REQUIREMENTS.md` maps only MCP-01..08 to Phase 6. `REQUIREMENTS.md` l.112 and ROADMAP SC4 still say "in a foreground run" and show MCP-01..08 as Pending. I did not edit them. The parent owns that wording.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| phase-modified product, feature, step, lib, and doc files | -- | `TBD`, `FIXME`, `XXX` | none | grep found none |
| `docs/mcp-compatibility.md`; `bridges/agents/convert.ts` (`MCP_ASYNC_WARNING`) | 277, 474; 120-123 | The docs and the install warning present the background launch as the way to reach plugin MCP tools. They never say that on pi-subagents 0.84.0 an agent with an explicit `mcp:` grant also fails in the background, because bug A drops every server written with `directTools: "search"`. That is every plugin server, per `.planning/upstream/pi-subagents-mcp-direct-tools.md`. The scenario title "A foreground run ... is refused" also gives the foreground launch as the cause. Per A.2, bug A is the cause. | Warning | Wording only. It changes no must-have, and the user accepted the deviation. A reader of the docs may expect a background launch to work on 0.84.0. Suggest one sentence in the docs and the warning that names bug A and the drafted patch. |
| `.planning/BACKLOG.md` MCPBG-01, MCPSUB-01 | 4587-4593 | MCPBG-01 exists and tracks the later background-call proof. Its trigger names only the harness change; it does not name the pi-subagents bug A/B fix that A.2 makes a precondition. MCPSUB-01 still says "file the gap report" and "replace the D-CF6-10 pin with a working foreground call". Both conflict with A.2: the foreground refusal is accepted as design, and the report became drafted patches. | Warning | Stale tracking. A planner could chase a foreground call that will never exist. |
| `domain/mcp-resolution.ts` | `fileSystemFailureDetail` | skips every coded fs error (WR-03), as before | Info (accepted) | Unchanged; D-CF6-02 |
| `test/live-uat/mcp-adapter-canary.mjs` | -- | canary parent line (D-CF6-04) | Info | Unchanged |

### Human Verification Required

None. The one item the previous report raised (SC4/MCP-07) was decided by the user on 2026-11-02 and is recorded above as an override.

### Gaps Summary

No gaps. Seven of eight requirements are satisfied, each with whole-literal scenario evidence that I re-ran at `2ba505a`. MCP-07 closes as an accepted deviation under the user's A.2 decision: the extension writes `async: true` for MCP agents, a scenario pins it, and BACKLOG MCPBG-01 tracks a later proof of a background call. The A.3 link rule is implemented as decided and pinned in both directions. The two warnings above are wording and tracking fixes. They do not block the phase.

---

_Verified: 2026-11-02T11:15:31Z_
_Verifier: Claude (gsd-verifier)_
