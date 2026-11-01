---
phase: 06-mcp-servers
verified: 2026-11-01T19:30:00Z
status: human_needed
score: 4/5 roadmap truths verified (SC4 is met only as a recorded gap pin under D-CF6-10; see Human Verification)
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
  - "extensions/pi-claude-marketplace/domain/components/mcp.ts"
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
  - "features/step_definitions/mcp-server/configuration.steps.ts"
  - "features/step_definitions/mcp-server/invalid-configs.steps.ts"
  - "features/step_definitions/mcp-server/invocation.steps.ts"
  - "features/step_definitions/mcp-server/lifecycle.steps.ts"
  - "features/step_definitions/mcp-server/listing.steps.ts"
  - "features/step_definitions/mcp-server/sources.steps.ts"
  - "features/step_definitions/mcp-server/status.steps.ts"
  - "test/domain/components/mcp.test.ts"
  - "test/domain/components/plugin.test.ts"
  - "test/domain/mcp-resolution.test.ts"
  - "test/domain/plugin-resolver.test.ts"
  - "test/integration/mcp-migration.test.ts"
  - "test/orchestrators/plugin/install-flow-ledger.test.ts"
  - "test/orchestrators/reconcile/mcp-migration.test.ts"
covered_digest: "v4:sha256:c95d059eeef89d79085d6c640ee1a943f0596b5d12b882e41b415c31b8031c33"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Decide whether the D-CF6-10 gap pin satisfies MCP-07 and ROADMAP success criterion 4"
    expected: "Either accept the pin (then record it as an override with an accepted_by name, and apply the SC4/MCP-07 wording lines from 06-09-SUMMARY.md), or reject it and open a gap for a working agent call"
    why_human: "The literal criterion says an agent calls the tool and the stub logs the call. No scenario shows that. pi-subagents 0.84.0 refuses the foreground launch, and the harness's background children load neither the profile's companions nor the scripted model. D-CF6-10 was settled autonomously, not by the user, so no recorded user acceptance exists."
---

# Phase 6: MCP Servers Verification Report

**Phase Goal:** With pi-mcp-adapter 7.x loaded, a bridged MCP server connects under Claude's tool names, receives its configuration as upstream, answers calls from the model and from agents, starts in a project as decided, recovers when the adapter is loaded later, and follows the plugin lifecycle.
**Verified:** 2026-11-01
**Status:** human_needed
**Re-verification:** No -- initial verification

## Summary

Every success criterion except the agent-call half of SC4 is backed by passing, whole-literal cucumber scenarios and unit tests that I re-ran. The agent half is a recorded Pi companion gap, not a working call. Judged against locked decision D-CF6-10, the gap pin is delivered and correct. Judged against the literal SC4 and MCP-07 wording, an agent calling a plugin MCP tool and the stub logging the call is NOT demonstrated anywhere. That decision was settled autonomously with no user sign-off, so I route it to a human instead of passing it silently.

No BLOCKER was found. The code review (0 critical, 8 warnings) is fully dispositioned in `06-REVIEW-DISPOSITION.md` (open: 0).

## Goal Achievement

### Observable Truths (ROADMAP success criteria are the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 (MCP-01, MCP-02): a bridged stdio server connects (stub logs `initialize`, `notifications/initialized`, `tools/list`), its tools register as `mcp__plugin_<plugin>_<server>__<tool>`, and a scripted `mcp` proxy call reaches the stub with the given arguments and returns the result to the model | VERIFIED | `features/mcp-server/listing.feature`: search returns `Activated as direct tools: mcp__plugin_demo_stub__echo.` and the whole stub log; call 1 is offered no plugin tool, call 2 is; the registry-probe scenario shows `mcp__plugin_demo_stub__echo` registered but inactive; `api` and `my.db` give `mcp__plugin_demo_api__echo` and `mcp__plugin_demo_my_db__echo`; negative controls (no MCP server, search with no match). `invocation.feature`: proxy call logs `tools/call {"name":"echo","arguments":{"text":"ping"}}` and returns `mcp returned: echo:ping`; direct call returns `echo:direct`; an unlisted tool is answered by the adapter and never reaches the stub. Re-run: `npx cucumber-js features/mcp-server` 52/52 scenarios passed. |
| 2 | SC2 (MCP-03, MCP-04): args, env, `${VAR}`, `${VAR:-default}`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and loopback remote servers with headers reach the server as upstream; the documented rows hold on 7.x; multiple sources and a malformed server behave as FG-27/FG-28 decide | VERIFIED | `configuration.feature`: loopback HTTP server receives `Authorization: Bearer t0k3n` and `X-Team: core` on every POST and GET (whole request table); OAuth-entry and unset-header variants pinned (the unset header reaches the server empty, a documented Pi gap); env Outline pins literal, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PLUGIN_ROOT}`, and `${PI_CM_STUB_TAG:-install-default}`; a variable set when Pi starts; `${CLAUDE_PLUGIN_ROOT}` in args; the stdio server's own environment. `sources.feature` (6 scenarios): union order, array order, entry only without `plugin.json`, ignored with one, `.mcpb` as partially available, reference without `./`. `invalid-configs.feature` (5 scenarios, 8 runs with the Outline): a malformed server in `.mcp.json` is skipped, inline and entry defects and an outside reference make the plugin `(unavailable) {malformed mcp}`, four broken-file states contribute no server. `domain/mcp-resolution.ts` implements both rules (file sources skip silently via `mergeServerFile`, inline defects call `addDefect`, `Map` merge keeps first position). `docs/mcp-compatibility.md` names pi-mcp-adapter 7.0.0 on Pi 1.4.0 and cites the scenarios. |
| 3 | SC3 (MCP-05, MCP-06): in a trusted project, project-scope plugin servers start as FG-29 decides and the untrusted case is pinned; without the adapter the install shows `{requires pi-mcp-adapter}`, and loading the adapter then `/reload` makes the servers available with no reinstall | VERIFIED | `project-scope.feature`: allowed project server connects and answers (user-global `projectServers: allow`); headless without the setting is blocked (`MCP: 0/0 servers, 0 tools (1 blocked)`, approval-required reason, empty stub log); untrusted project is blocked even with the setting (`blocked by project trust`); `info` shows `{"name":"plugin:demo:stub","status":"pending approval"}`. FG-29 is decided as D-CF6-03, a licensed divergence (adapter-owned trust, NFR-10); no write of `mcp-project-approvals` exists in `extensions/`. `companion-missing.feature`: install reports `installed` with reason `requires pi-mcp-adapter`; a Pi started later with the adapter answers `echo:ping` with no reinstall; `info` names the adapter missing, then present. The fresh-Pi stand-in for `/reload` is D-CF6-11. |
| 4 | SC4 (MCP-07): an agent granted a plugin MCP tool calls it in a foreground run, and the stub logs the call | UNCERTAIN (met only as a gap pin under D-CF6-10) | `invocation.feature` pins two scenarios, both green on my re-run. (a) A foreground `subagent` run of an agent with `tools: mcp__plugin_demo_stub__echo` returns the whole text `subagent failed: Unresolved MCP direct-tool selectors: plugin_demo_stub_/echo. Direct MCP tools require a matching configured server and fresh metadata cache; ...`, and the stub log holds only the startup listing. (b) A foreground agent with no `tools:` runs, and its child call is offered `read, bash, edit, write, bg_wait, contact_supervisor` with no MCP tool. No scenario shows an agent calling the tool or the stub logging a call. The agent is written by `publishMcpServerAgent` (D-CF6-07), with no Phase 4 file. See Human Verification. |
| 5 | SC5 (MCP-08): disable, uninstall, and update remove or replace the server entries the adapter sees | VERIFIED | `lifecycle.feature` (8 scenarios): disable and uninstall give `Tool ... not found`, `MCP: 0/0 servers, 0 tools`, and an empty stub log; enable restores the answer; update to a `v2` tag answers `v2:echo:ping`; a published change with no update still answers `echo:ping`; a user's `disabled: true` survives an update (the update also changes `STUB_TAG`, per WR-08), a disable then enable, and an uninstall then install. No Then reads `mcp-adapter.json`. |

**Score:** 4/5 roadmap truths verified. SC4 is UNCERTAIN because it is met only by the D-CF6-10 gap pin. 0 truths are present-but-behavior-unverified.

### PLAN must-haves cross-check

The PLAN frontmatter truths add detail to the roadmap contract and reduce none of it. I checked each against the tree.

| Plan | Result |
|------|--------|
| 06-01 | `features/step_definitions/mcp-server/calls.steps.ts` is gone (renamed to `listing.steps.ts`); `listing.feature`, `project-scope.feature`, and the exported fixture writers exist; the project-scope scenario moved out of `invocation.feature` |
| 06-02 | `features/lib/mcp-server-http.ts` binds `127.0.0.1` only and its close is registered as a release; `mcp-server-environment.ts` exists; the pinned request tables are present |
| 06-03 | `domain/mcp-resolution.ts` and `domain/components/mcp.ts` (`MCP_SERVERS_SCHEMA` union of map and array, `MCP_SERVER_MAP_VALIDATOR`); `resolveStrictMcp` is called from `domain/plugin-resolver.ts:765`; `domain/components/plugin.ts` is unedited |
| 06-04 | Both D-CF6-10 pins and the direct-call scenarios exist |
| 06-05 | The four project-scope scenarios and the four companion-missing scenarios exist; no product file was changed for them |
| 06-06 | All eight lifecycle scenarios exist; the override Given uses `writeMcpAdapterOverride` |
| 06-07 | The file-source skip and inline-fatal rule are in `mcp-resolution.ts`; the `.mcpb` rule and AMIG-01 integration cases pass |
| 06-08 | Only `docs/mcp-compatibility.md` changed for FG-30; the canary line still names 5.2.0 as the plan requires |
| 06-09 | The SUMMARY carries gate evidence, decision rows D-CF6-01..11, the drafted (unfiled) pi-subagents report, and parent lines, including the SC4/MCP-07 wording |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `features/mcp-server/{listing,configuration,sources,invalid-configs,invocation,project-scope,companion-missing,lifecycle}.feature` | one feature per topic | VERIFIED | 8 files, 1456 lines; 52 scenario runs passed |
| `features/step_definitions/mcp-server/*.steps.ts` (7 modules) | shared and topic steps | VERIFIED | All wired; no unmatched steps (cucumber run clean) |
| `features/lib/mcp-server-files.ts`, `mcp-server-http.ts`, `mcp-server-environment.ts` | fixture writers and stand-ins | VERIFIED | `mcp-server-http.ts` binds `127.0.0.1` only (T-06-04) |
| `extensions/pi-claude-marketplace/domain/mcp-resolution.ts` | ordered merge, silent file skip, inline fatal | VERIFIED | 373 lines, substantive; used by `plugin-resolver.ts` |
| `extensions/pi-claude-marketplace/domain/components/mcp.ts` | map-or-array schema | VERIFIED | Wired through `plugin.ts` via `MCP_SERVERS_SCHEMA` |
| `docs/mcp-compatibility.md` | 7.0.0 re-measure | VERIFIED | Header, Pi column, and rows name 7.0.0 on Pi 1.4.0 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `domain/plugin-resolver.ts` | `domain/mcp-resolution.ts` | `resolveStrictMcp(` | WIRED | line 765; AMIG-01 inherits the rule through `resolveStrict` |
| `domain/components/plugin.ts` | `domain/components/mcp.ts` | `MCP_SERVERS_SCHEMA` | WIRED | no edit to `plugin.ts` was needed |
| `invocation.steps.ts` | `mcp-server-files.ts` | `publishMcpServerAgent(` | WIRED | D-CF6-07 |
| `lifecycle.steps.ts` | `mcp-server-files.ts` | `writeMcpAdapterOverride(` | WIRED | |
| `configuration.steps.ts` | `mcp-server-http.ts` | `onRelease(` close | WIRED | T-06-06 |

### Data-Flow Trace (Level 4)

Each scenario asserts values that reach the stub or the model through the real Pi 1.4.0 and pi-mcp-adapter 7.0.0, so the data flow is exercised end to end. The stub log, the HTTP request table, and the scripted model's call log are the evidence. No hollow props or static fallbacks were found.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All MCP scenarios | `nondac-sh -c 'NODE_OPTIONS=--max-old-space-size=6144 npx cucumber-js features/mcp-server'` | 52 scenarios (52 passed), 669 steps (669 passed), random seed 265729 | PASS |
| Resolver, schema, and AMIG-01 tests | `node --test test/domain/mcp-resolution.test.ts test/domain/components/mcp.test.ts test/domain/plugin-resolver.test.ts test/integration/mcp-migration.test.ts` | 289 pass, 0 fail | PASS |

I did not re-run `npm run check`. The recorded evidence is `npm run check` passing at c6d618e (seed 154136, 1268 scenarios) and the phase gate at 822a1ac (`test:modules` and `test:cucumber` twice, seeds 512508 and 920909). `git diff --stat c6d618e HEAD` should show only `.planning/**/*.md`; I confirmed that HEAD's last commit (787c9b9) is a docs-only commit.

### Probe Execution

SKIPPED. The phase declares no `probe-*.sh` scripts, and none exist under `scripts/*/tests/`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MCP-01 | 06-01, 06-09 | stdio server connects; tools named `mcp__plugin_<plugin>_<server>__<tool>` | SATISFIED | `listing.feature` |
| MCP-02 | 06-04, 06-09 | scripted `mcp` proxy call reaches the stub and returns its result | SATISFIED | `invocation.feature` (proxy, direct, unlisted-tool control) |
| MCP-03 | 06-02, 06-08, 06-09 | configuration variants reach the server; doc rows re-measured on 7.x | SATISFIED | `configuration.feature`; `docs/mcp-compatibility.md` |
| MCP-04 | 06-03, 06-07, 06-09 | multiple sources and a malformed server behave as FG-27/FG-28 decide | SATISFIED | `sources.feature`, `invalid-configs.feature`, `mcp-resolution.ts`, unit tests |
| MCP-05 | 06-05, 06-09 | project-scope servers start as FG-29 decides; untrusted pinned | SATISFIED | `project-scope.feature`; D-CF6-03 |
| MCP-06 | 06-05, 06-09 | `{requires pi-mcp-adapter}`; adapter loaded later makes servers available | SATISFIED | `companion-missing.feature` |
| MCP-07 | 06-04, 06-09 | an agent granted a plugin MCP tool can call it in a foreground run | GAP-PINNED, NEEDS HUMAN | Satisfied only as the D-CF6-10 pin; no working call exists. Not literally satisfied. |
| MCP-08 | 06-06, 06-09 | disable, uninstall, update remove or replace server entries | SATISFIED | `lifecycle.feature` |

All eight IDs in the roadmap and in the plan frontmatter are accounted for, and `REQUIREMENTS.md` maps no other ID to Phase 6, so there are no orphans. `REQUIREMENTS.md` still shows MCP-01..08 unchecked, as the orchestrator intended; I did not edit it.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (phase-modified product, feature, doc, and test files) | -- | `TBD`, `FIXME`, `XXX` debt markers | none | grep found none |
| `domain/mcp-resolution.ts` | `fileSystemFailureDetail` | skips every coded file-system error, so a transient `EMFILE` or `EIO` while reading `.mcp.json` drops its servers silently, and an update, apply, or reload then removes their entries | Warning (accepted) | WR-03 weighed this. The fix keeps the skip because Claude Code 2.1.316's `mit` loader returns no servers for every failed read. It follows D-CF6-02 and is documented. A human may still want a louder signal. |
| `docs/mcp-compatibility.md` | 96, 9 | two statements still rest on Pi 1.0.0 / adapter 5.x measurements (name lengths, extra `/reload` after an upgrade) | Info | The doc says so itself, and the plan allows a stated earlier measurement. |
| `test/live-uat/mcp-adapter-canary.mjs` | -- | still pins 5.2.0 | Info | A parent line, as D-CF6-04 and plan 06-08 require. |

Review findings dispositioned in `06-REVIEW-DISPOSITION.md`: 6 fixed, WR-01 and WR-02 skipped with documented upstream evidence, and 7 info findings deferred.

### Human Verification Required

#### 1. Accept or reject the D-CF6-10 gap pin for MCP-07 and SC4

**Test:** Read `features/mcp-server/invocation.feature` (the two D-CF6-10 scenarios), decision row D-CF6-10 in `06-09-SUMMARY.md`, and the drafted pi-subagents report.
**Expected:** Either the user accepts the pin as satisfying MCP-07 (then add an `overrides:` entry with an `accepted_by` name, and apply the drafted REQUIREMENTS and ROADMAP wording lines from `06-09-SUMMARY.md`, "Parent lines"), or the user rejects it and a gap is opened for a working agent call.
**Why human:** The literal criterion asks for an agent calling the tool with the stub logging the call, and that is not demonstrated. A background run, the only mode where pi-subagents gives MCP tools, is untested because the harness's background children load neither the profile's companions nor the scripted model (BACKLOG item MCPBG-01). The decision was made autonomously (P6-DC-07, P6-DC-09 in `DUBIOUS-CHOICES.md`), and the user has not accepted it.

Two open items do not block the phase, but a human should know about them:

- **Link rule for MCP files (WR-01, WR-02).** The root `.mcp.json` follows symlinks anywhere (upstream parity, measured). A referenced `mcpServers` file refuses any symlink, even inside the plugin root (licensed by MCPR-04 and NFR-10, a divergence from upstream). `06-REVIEW-FIX.md` lists three options and asks for a user decision. The note text `escapes plugin root` is also wrong for an in-root link.
- **The pi-subagents gap report** is drafted in `06-09-SUMMARY.md` and not filed. Filing is the user's call.

### Gaps Summary

No gaps block the phase. Seven of eight requirements are satisfied with whole-literal scenario evidence that I re-ran. MCP-07 is satisfied only as a recorded Pi/companion gap (D-CF6-10), with the refusal text pinned. The phase goal clause "answers calls ... from agents" is not achieved as written, and the only authority for reading it as met is an autonomous decision. If the user accepts the pin, the status becomes `passed` and an override entry records the acceptance.

---

_Verified: 2026-11-01_
_Verifier: Claude (gsd-verifier)_
