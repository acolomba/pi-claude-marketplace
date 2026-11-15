---
phase: 09-adapter-entries-and-mcp-features
plan: "01"
subsystem: cucumber harness (MCP)
status: complete
tags: [cucumber, mcp, pi-mcp-adapter, listing-wait, resources]
requires: []
provides:
  - one listing rule for both MCP implementations, matched on the tools a stub logged
  - the `tool` member of every stub log record
  - the opt-in `STUB_RESOURCE` text resource of the stub
  - the two PG-MCP-08 resource guard scenarios
affects: [09-03]
tech-stack:
  added: []
  patterns: [listing wait ends on Pi's registry when the stub stays connected]
key-files:
  created:
    - features/mcp-server/resources.feature
    - features/step_definitions/mcp-server/resources.steps.ts
  modified:
    - features/lib/mcp-stub-server.ts
    - features/lib/hook-mcp-tool-server.ts
    - features/lib/mcp-implementation.ts
    - features/step_definitions/hook/tool-use.steps.ts
    - features/step_definitions/mcp-server/listing.steps.ts
decisions:
  - "The listing wait ends once the stub logged a tools/list for the server and either no stub runs (pi-mcp-adapter only) or Pi's registry holds a tool of the server; the registry rule needed no mcp-cache.json fallback (RESEARCH A2)."
  - "The stub's resource is opt-in through STUB_RESOURCE in its env, so no default stub-message table changes."
metrics:
  duration: about 75 minutes
  completed: 2026-11-14
requirements: [PG-MCP-08, PG-MCP-06]
actuals:
  tokens: 8200
  tasks: 3
  commits: 2
plan_head_before: cadc312bec3bbbe82a054cd1f3da215c0616ff57
plan_head_after: 012c23bc18c8698aef51e0b7bb0d0823f3dc1109
---

# Phase 9 Plan 01: Listing Wait and Resource Guards Summary

The adapter listing wait now ends on Pi's tool registry when pi-mcp-adapter keeps a stdio stub
connected, matched on the tool the stub logs; every listing feature passes under both profiles,
a resident-stub run shows zero listing-wait failures, and two guard scenarios read a plugin
server's text resource under each MCP implementation.

## Commits

| Task | Commit | Title |
|------|--------|-------|
| 1 | `f0e8979c` | test(mcp): end the adapter listing wait when pi registers the tools |
| 2 | none | measurement only, recorded below |
| 3 | `012c23bc` | test(mcp): read a plugin server's resource under each implementation |

Both commits passed the pre-commit hook, including `npm-check` (`check:commit`).

## Task 1 runs (unchanged product, new listing rule)

| Command | Exit | Result |
|---------|------|--------|
| `npm run test:cucumber:profile -- --profile adapter <20 listing feature files>` | 0 | 180 scenarios (180 passed), 2624 steps (2624 passed) |
| `npm run test:cucumber:profile -- --profile builtin <20 listing feature files>` | 0 | 109 scenarios (109 passed), 1506 steps (1506 passed) |
| `npm run check:features` | 0 | no "Feature gate failed" |

Tracer gate passed. No scenario failed because the wait ended earlier, so no harness defect was
found and no expectation changed. `git diff --quiet cadc312b -- extensions test` and the
feature-file diff check both exit 0.

## Resident listing measurement

Temporary edit, working tree only and never committed: the stdio branch of the closed table
(`stdioFields` in `extensions/pi-claude-marketplace/domain/mcp-server-features.ts`) returned
`lifecycle: "lazy-keep-alive"` as well, so every stdio entry an install wrote was resident. The
file was restored with `git checkout --` right after the run, and `git diff --quiet HEAD --
extensions features test` exits 0.

- Date: 2026-11-14 (run started 2026-11-14T19:20:05Z), on top of commit `f0e8979c` (the new
  listing rule).
- Versions: pi-mcp-adapter 7.0.1 (from `node_modules/.cache/optional-peers`), Pi
  (`@earendil-works/pi-coding-agent`) 1.5.0.
- Command: `npm run test:cucumber:profile -- --profile adapter` over the 20 listing feature
  files of the plan (Task 1's first `<verify>` command).
- Exit code: 1 (expected: expectation failures).
- Counts: 180 scenarios (163 passed, 17 failed); 2624 steps (2600 passed, 7 skipped, 17
  failed). No step timed out.
- Listing-wait failures (error holds "did not finish listing the tools of"): **0**.
- Expectation failures: 17, every one an `AssertionError` in a `Then` that compares a written
  `mcp-adapter.json` text (7), a stub message table (9), or a result field (1):

| Feature file | Expectation failures |
|--------------|----------------------|
| `features/mcp-server/lifecycle.feature` | 6 |
| `features/mcp-server/invocation.feature` | 3 |
| `features/mcp-server/legacy-move.feature` | 3 |
| `features/mcp-server/companion-missing.feature` | 2 |
| `features/mcp-server/configuration.feature` | 2 |
| `features/mcp-server/project-scope.feature` | 1 |
| every other listing feature file | 0 |

The failed scenarios: lifecycle "Enabling a disabled plugin offers its server again", "A
published change to the server reaches no session until the plugin updates", "Updating a plugin
replaces its server with the new version's", and the three PG-MCP-01 timeout scenarios at
`:394`, `:493`, `:528` (entry text); invocation "A scripted call through the mcp tool reaches the
plugin's server and returns its result", "A direct call to the tool a search activated reaches
the plugin's server", "A call to a tool the plugin's server does not list is never sent to the
server"; legacy-move `:8`, `:134`, `:214` (entry text); companion-missing MREC-05 `:82`
(message table) and D-P3-08 `:147` (status row); configuration `:11` (entry text) and `:457`
(message table); project-scope `:9` (message table). `listing.feature` and
`agent-grants.feature` did not fail under the temporary edit (it wrote no `openUi`).

Status row preview (`companion-missing.feature:147`): the adapter reports
`[{"name":"plugin:demo:stub","status":"connected"}]` where the feature expects
`cached, connects on first use`, which confirms the RESEARCH assumption for this row.

Stub message table preview, `features/mcp-server/invocation.feature` "A scripted call through
the mcp tool reaches the plugin's server and returns its result", as the run logged it under
`lazy-keep-alive` with no `openUi` written. This is a preview; plan 09-03 measures it again with
its own defaults:

```
| kind         | method                    | params                                                                                                                                                                                                                                                          |
| request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
| notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
| request      | tools/list                |                                                                                                                                                                                                                                                                 |
| request      | tools/call                | {"name":"echo","arguments":{"text":"ping"},"_meta":{"pi-mcp-adapter/toolCallId":"{tool call 1}","progressToken":2}}                                                                                                                                             |
```

The startup listing connection served the call: the second `initialize`,
`notifications/initialized`, `tools/list` triple is gone. The registry rule of Task 1 needed no
fix, and the `mcp-cache.json` fallback of RESEARCH assumption A2 was not needed.

## Resource guards (PG-MCP-08, D-PG9-10)

`features/mcp-server/resources.feature` holds two regression guards; neither is a red-green
proof, and no red run was forced. The stub's resource is opt-in (`STUB_RESOURCE=notes` in the
server's env): URI `stub://notes`, name `notes`, MIME type `text/plain`, text `stub notes`.

First-run results:

- Adapter, "The model reads a plugin server's resource through pi-mcp-adapter's resource tool
  (PG-MCP-08)": passed on its first run (1 scenario, 13 steps passed).
- Built-in, "The model reads a plugin server's resource through Pi's read_mcp_resource tool
  after a tool search (PG-MCP-08, BLT-01)": the product read `stub notes` on the first run. That
  run was the measuring run: the call table held only a placeholder row, so it failed on the
  table. The table was then written from that run's output and the second run passed. No
  product behavior was in question.

Other Task 3 checks: `--profile adapter features/mcp-server/invocation.feature
features/mcp-server/listing.feature` exit 0 (13 scenarios, 173 steps passed), so the default
stub's answers did not change; `npm run check:features` exit 0.

## Resource call shapes

For the compatibility page. Plugin `demo`, server `stub`, resource `notes`. pi-mcp-adapter
7.0.1, Pi 1.5.0, 2026-11-14.

pi-mcp-adapter, through its `mcp` tool:

```
| call | role        | text                                                       |
| 1    | user        | read the notes                                             |
| 2    | user        | read the notes                                             |
| 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__read_notes"} |
| 2    | tool result | mcp returned: stub notes                                   |
```

Pi's built-in MCP, after a tool search (each tool search reduced to the tools it loads; the
query `read_mcp_resource` loads all three resource tools and the stub's echo tool, so the row
carries Pi's own tool descriptions):

```
| call | role        | text                                                                           |
| 1    | user        | read the notes                                                                 |
| 2    | user        | read the notes                                                                 |
| 2    | assistant   | tool call tool_search {"query":"read_mcp_resource"}                            |
| 2    | tool result | tool_search returned: found list_mcp_resource_templates: Lists resource templates provided by MCP servers. [...]\nfound list_mcp_resources: Lists resources provided by MCP servers. [...]\nfound mcp__plugin_demo_stub__echo: Echoes the text it is given.\nfound read_mcp_resource: Read a specific resource from an MCP server given the server name and resource URI. |
| 3    | user        | read the notes                                                                 |
| 3    | assistant   | tool call tool_search {"query":"read_mcp_resource"}                            |
| 3    | tool result | (same as call 2)                                                               |
| 3    | assistant   | tool call read_mcp_resource {"server":"plugin_demo_stub","uri":"stub://notes"} |
| 3    | tool result | read_mcp_resource returned: stub notes                                         |
```

The full rows are in `features/mcp-server/resources.feature`.

## Deviations from Plan

1. **[Discretion] `isStubTool` became `hasStubTool`.** The name match now takes the registry
   snapshot and the logged tools, and resolves the plugin's basename itself, so `listingDone`
   and `adapterToolMissing` share one call instead of repeating the `allTools.some` loop.
   `listedTools` in `mcp-stub-server.ts` now returns the logged tool names instead of a
   boolean. `STUB_TOOL_NAMES` was removed (no reader left). Commit `f0e8979c`.
2. **Built-in guard table measured in a first run.** See "Resource guards": the first built-in
   run failed only on the placeholder table; the product behavior read the resource. Commit
   `012c23bc`.

No Rule 1-4 deviation. No product or unit test file changed.

## Stale comments for plan 09-03 (outside this plan's files)

These comments still describe the adapter closing its listing connection. They stay true for a
`lazy` server today, so this plan left them alone:

- `features/step_definitions/mcp-server/verdict-settings.steps.ts`, the comment above the When
  "pi-mcp-adapter finishes listing the tools of the stub mcp server ...": "until the stub
  logged a tools/list and the adapter closed the listing connection, so a later prompt's
  connection is the only one open".
- `features/step_definitions/mcp-server/listing.steps.ts`, file header lines 7-11 ("lists them,
  and disconnects").

## Parent-owned lines requested

- `09-VALIDATION.md`: record the two `resources.feature` scenarios as PG-MCP-08 guards that
  passed on their first product run (not red-green proofs), and the Task 1 listing rule as the
  PG-MCP-06 harness prerequisite with the resident measurement of 0 listing-wait failures.
- `REQUIREMENTS.md`: PG-MCP-08 is complete only after the docs plan; PG-MCP-06 needs the
  product default of plan 09-03. Do not mark either complete from this plan alone.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-09-02
held: the temporary `lifecycle` edit was restored, and `git log cadc312b..HEAD --
extensions/pi-claude-marketplace/domain/mcp-server-features.ts` prints nothing.

## Self-Check: PASSED
