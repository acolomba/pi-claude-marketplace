---
phase: 02-built-in-materialization
plan: "09"
subsystem: mcp
tags: [mcp, pi-builtin-mcp, pi-mcp-adapter, cucumber, listing, tool-names]
status: complete

requires:
  - phase: 02-built-in-materialization
    provides: "plan 02-01: builtinRegistrationStep, the lifted listing.feature, and the tool-search calls step"
  - phase: 01-foundation-and-pi-1-5-0
    provides: "the frozen builtin profile (serverName, toolName, toolNamePrefix) and waitForStubListing"
provides:
  - "features/mcp-server/listing.feature: the no-match @builtin-only twin, the hyphen-fold and 64-character-cut @builtin-only gap scenarios, the per-server-names and server-less-plugin @mcp scenarios"
affects: []

actuals:
  tokens: 1600
  tasks: 2
  commits: 2
plan_head_before: fe2fa04fb4a259a013cc06bfc0fd0aef02aa8590
plan_head_after: 7539775079d5932e76104be18affc899ce0a8548

tech-stack:
  added: []
  patterns:
    - "A scenario whose expectation holds with no registration rests on a listing wait or a control plugin, so it fails on the seed"

key-files:
  created: []
  modified:
    - features/mcp-server/listing.feature

key-decisions:
  - "The cut scenario uses the server name a-server-whose-name-runs-well-past-the-limit: its namespace (63 characters with the __) passes Pi's 55-character kept prefix, so toolNamePrefix returns undefined, and mcp__<server>__echo is 67 characters, so Pi cuts it"
  - "The hyphen and cut scenarios also state the registry table (the registered name keeps the hyphens), since both are @builtin-only and the registry is the other half of the gap"
  - "The lifted per-server names scenario gains the IDs (BLT-01, BLT-04, D-MB-13) in its title"

requirements-completed: [BLT-01, BLT-04]

coverage:
  - id: D1
    description: "Under Pi's built-in MCP a tool search that matches no plugin tool loads none, and the registered server receives no tools/call"
    requirement: BLT-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/listing.feature#A search that matches no tool loads none and sends the server no call (BLT-01) (builtin profile)"
        status: pass
  - id: D2
    description: "Each server of a plugin gets tools named mcp__plugin_<plugin>_<server>__<tool>, a . normalized to _, under both implementations"
    requirement: BLT-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/listing.feature#Each server of a plugin gets tools named after the plugin and the server (BLT-01, BLT-04, D-MB-13) (adapter and builtin profiles)"
        status: pass
  - id: D3
    description: "A hyphen in a server name stays in Pi's registry and folds to _ in its tool names (Pi capability gap)"
    requirement: BLT-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/listing.feature#A server name with a hyphen keeps it in Pi's registry while its tools fold it to an underscore, a Pi capability gap (BLT-04, D-MB-13) (builtin profile)"
        status: pass
  - id: D4
    description: "A tool name past 64 characters gets Pi's cut name, which the frozen toolName predicts (Pi capability gap)"
    requirement: BLT-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/listing.feature#A server whose tool names pass Pi's 64-character limit gets Pi's cut tool names, a Pi capability gap (BLT-04, D-MB-13) (builtin profile)"
        status: pass
  - id: D5
    description: "A plugin without MCP servers adds no tool beside a plugin whose server the active implementation offers"
    requirement: BLT-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/listing.feature#A plugin without MCP servers adds no tool beside a plugin whose server Pi offers (BLT-01) (adapter and builtin profiles)"
        status: pass

duration: 35min
completed: 2026-11-04
---

# Phase 2 Plan 09: Listing lift under Pi's built-in MCP Summary

listing.feature now pins, under Pi's built-in MCP, a tool search that matches nothing (no tool loaded, no tools/call), Claude Code's per-server tool names under both implementations, Pi's hyphen fold and 64-character cut as recorded gaps, and a server-less plugin beside a control plugin. Every pi-mcp-adapter scenario keeps its steps and rows, except the per-server names scenario the plan lifts to `@mcp`.

## Performance

- **Duration:** about 35 min
- **Completed:** 2026-11-04
- **Tasks:** 2
- **Files modified:** 1

## Task Commits

1. **Task 1: A search that matches no tool loads none under Pi's built-in MCP** - `1e13533` (test)
2. **Task 2: Names under both implementations, Pi's naming gaps, and a plugin without servers** - `7539775` (test)

## Tracer feedback gate

Task 1 is a tracer. Its `<verify>` was re-run end to end: `npm run check:features`, then listing.feature under the builtin profile (4 scenarios passed) and the adapter profile (7 scenarios passed). Interactive mode, `end-of-phase` human verification, automated-only verify: no checkpoint.

## Final runs

- Builtin profile, listing.feature: 8 scenarios (8 passed), 98 steps. That is the file's 3 `@mcp` plus 5 `@builtin-only` scenarios.
- Adapter profile, listing.feature: 8 scenarios (8 passed), 97 steps.
- `npm run check:static`: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features all passed.

## Red runs against the Phase 1 seed

Each red run restored `extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts` from `87d3f28`, ran under the builtin profile, then ran `git checkout HEAD --` on that file. The reverted file was never committed.

| Scenario | Failing step | Message |
| --- | --- | --- |
| A search that matches no tool loads none and sends the server no call (BLT-01) | `the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"` | `the builtin mcp implementation did not finish listing the tools of demo/stub: {"requests":[],"running":[]}` |
| Each server of a plugin gets tools named after the plugin and the server (BLT-01, BLT-04, D-MB-13) | `... of the stub mcp server "api" of the plugin "demo"` | `... did not finish listing the tools of demo/api: {"requests":[],"running":[]}` |
| A server name with a hyphen keeps it in Pi's registry ... (BLT-04, D-MB-13) | `... of the stub mcp server "my-db" of the plugin "demo"` | `... did not finish listing the tools of demo/my-db: {"requests":[],"running":[]}` |
| A server whose tool names pass Pi's 64-character limit ... (BLT-04, D-MB-13) | `... of the stub mcp server "a-server-whose-name-runs-well-past-the-limit" of the plugin "demo"` | `... did not finish listing the tools of demo/a-server-whose-name-runs-well-past-the-limit: {"requests":[],"running":[]}` |
| A plugin without MCP servers adds no tool beside a plugin whose server Pi offers (BLT-01) | `... of the stub mcp server "stub" of the plugin "other"` (the control plugin) | `... did not finish listing the tools of other/stub: {"requests":[],"running":[]}` |

## The cut tool name Pi gave

- Plugin `demo`, server `a-server-whose-name-runs-well-past-the-limit`, tool `echo`.
- Registered server name: `plugin_demo_a-server-whose-name-runs-well-past-the-limit`.
- Pi's tool name: `mcp__plugin_demo_a_server_whose_name_runs_well_past_the_ca340f16` (64 characters). The uncut name `mcp__plugin_demo_a_server_whose_name_runs_well_past_the_limit__echo` has 67 characters.
- The frozen `toolName` predicted this exact name: `profileFor("builtin").toolName("demo", "a-server-whose-name-runs-well-past-the-limit", "echo")` returns it, and `toolNamePrefix` returns `undefined`. The listing wait (which then matches full names) and the `pi offers these plugin mcp tools:` table both passed. No parent line for `domain/mcp-implementation.ts` is needed.

## Files Created/Modified

- `features/mcp-server/listing.feature` - the no-match `@builtin-only` twin, the hyphen and cut `@builtin-only` gap scenarios, the lifted per-server names `@mcp` scenario, and the server-less plugin `@mcp` scenario

## Decisions Made

See `key-decisions` in the frontmatter. In short: the cut scenario's server name was chosen so that both the 55-character prefix rule and the 64-character cut apply; the two gap scenarios state the registry table as well as the tool table.

## Deviations from Plan

None - plan executed exactly as written. The plan asked the cut scenario for the tool table only; it also states the registry table. That adds an expectation, it removes none.

## Issues Encountered

None. No known flake fired.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Parent lines

None.

## Dubious Choices

| Choice | Alternatives | Why dubious | Severity |
| --- | --- | --- | --- |
| The cut scenario and the hyphen scenario each state the registry table (`pi lists these registered mcp servers:`) as well as the tool table | State only the tool table, as the plan wrote for the cut scenario | The extra table repeats what "Pi lists the plugin's server under Claude Code's name" already pins for a plain name; a reader may see it as noise. It does pin that the registry keeps the hyphens of a long name, which no other scenario shows | low |
| The lifted `@mcp` per-server names scenario gained `(BLT-01, BLT-04, D-MB-13)` in its title | Keep the old title unchanged | An `@mcp` scenario needs no ID, and the title change breaks any outside reference to the old title; the old title appears only in the archived component-features plan and summary (06-01), which a title prefix search still finds | low |

## Next Phase Readiness

listing.feature is fully lifted: every scenario carries one implementation tag, and the builtin profile runs 8 of its 13 scenarios and the adapter profile runs 8 (5 `@adapter-only`, 3 `@mcp`).

## Self-Check: PASSED

- FOUND: features/mcp-server/listing.feature
- FOUND: 1e13533
- FOUND: 7539775
