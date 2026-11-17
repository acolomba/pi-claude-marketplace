---
phase: 01-companion-floors-and-mcp-defaults
plan: 11
subsystem: documentation
tags: [pi-subagents, pi-mcp-adapter, mcp, changelog]
requires:
  - phase: 01-companion-floors-and-mcp-defaults
    provides: measured companion, naming, and timeout behavior from plans 01-01 through 01-09
provides:
  - fourteen D-PG1 Key Decisions rows with premises and checked versions
  - corrected backlog and upstream fix status
  - one Unreleased entry for installed agents and MCP servers
affects: [parity-gaps, release-notes, mcp-compatibility]
actuals:
  tokens: 5450
  tasks: 3
  commits: 3
commits: 3
plan_head_before: c716fff8131ca7767231528a20af07f64c23a303
plan_head_after: c394ca6dd5e3b782483cb514409b511eceefb4e3
tech-stack:
  added: []
  patterns: [decision rows cite their context and measured summaries]
key-files:
  created: [.planning/phases/01-companion-floors-and-mcp-defaults/01-11-SUMMARY.md]
  modified: [.planning/PROJECT.md, .planning/BACKLOG.md, .planning/upstream/pi-subagents-mcp-direct-tools.md, test/integration/provenance-invisibility.test.ts, CHANGELOG.md]
key-decisions:
  - Recorded D-PG1-02 as a PIFL-02 amendment for pi-subagents only; no suite proves the 0.87.0 floor.
  - Recorded D-PG1-11 as an ANAME-07 amendment limited to default timeouts.
patterns-established: []
requirements-completed: [PG-AGENT-02, PG-AGENT-07b, PG-MCP-02, PG-MCP-01]
coverage:
  - id: D1
    description: Fourteen D-PG1 rows record decisions, premises, and checked versions.
    verification:
      - kind: other
        ref: "command: plan 01-11 decision-row and source-path acceptance checks"
        status: pass
    human_judgment: true
    rationale: Whether each row faithfully represents the decision and evidence needs editorial review.
  - id: D2
    description: Backlog and upstream report reflect the shipped 0.87.0 fixes and remaining background-child check.
    verification:
      - kind: integration
        ref: "test/integration/provenance-invisibility.test.ts"
        status: pass
      - kind: other
        ref: "command: cached pi-subagents changelog quote exact-match check"
        status: pass
    human_judgment: true
    rationale: The backlog status includes a source-based claim without a live background-child run.
  - id: D3
    description: One Unreleased entry explains the floors and when installed agents and plugins change.
    verification:
      - kind: other
        ref: "command: changelog word counts, pre-commit checks, and unchanged-version diff"
        status: pass
    human_judgment: true
    rationale: Reader-facing wording requires editorial review.
duration: 12 min
completed: 2026-11-12
status: complete
---

# Phase 01 Plan 11: Companion Floors and MCP Defaults Records Summary

**Recorded the fourteen companion and MCP decisions, corrected shipped-fix status, and added one release note for installed agents and servers.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-11-12T05:59:29Z
- **Completed:** 2026-11-12T06:11:45Z
- **Tasks:** 3
- **Files modified:** 5, plus this summary

## Accomplishments

- Added D-PG1-01 through D-PG1-14 to the Key Decisions table. D-PG1-02 records that the suite runs pi-subagents 0.88.0 and does not prove its 0.87.0 floor; D-PG1-11 limits the ANAME-07 amendment to default timeouts.
- Updated MCPBG-01 and MCPV2-03, and quoted the installed pi-subagents 0.88.0 changelog's 0.87.0 fix line exactly. The provenance test header now names the suite version.
- Added one Unreleased entry explaining the new floors, bare mapped model IDs, timeout adoption, long tool names, and project-server reapproval.

## Task Commits

1. **Task 1: Decision rows** -- `22f5060bb1c120d96ac2d240406ef0e34ea8899c`
2. **Task 2: Backlog, upstream report, and provenance header** -- `dc39abed513ad6dd126806dbe817ad00ab75f37f`
3. **Task 3: Changelog** -- `c394ca6dd5e3b782483cb514409b511eceefb4e3`

## Verification

- All fourteen row IDs occur once, all fourteen cite `01-CONTEXT.md`, and `PROJECT.md` and `CHANGELOG.md` changed by additions only.
- The quoted pi-subagents 0.87.0 changelog line matches the installed 0.88.0 cache character for character. The stale upstream sentence is absent; MCPBG-01 and MCPV2-03 carry dated corrections.
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/provenance-invisibility.test.ts`: 1 passed, 0 failed.
- Each task's prescribed `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files ...` passed. All three commits passed hooks; Task 2's staged test invoked `npm run check:commit`, which passed.
- `npx --no fallow audit --base c716fff8131ca7767231528a20af07f64c23a303`: no issues in five changed files.
- The new changelog bullets have at most 31 words each. `package.json`, `package-lock.json`, and `sonar-project.properties` have no diff from the plan base.
- The orchestrator owns `npm run check` on the combined tree; this worktree did not run that full gate.

## Changelog Entry

> - Plugin agents and MCP servers now behave more like Claude Code with pi-subagents 0.87.0 or later and pi-mcp-adapter 7.0.1 or later in 7.x.
>
>   - These versions fix plugin MCP grants and shorten long tool names for Pi's 64-character limit.
>   - `--map-model` now writes a bare model ID, so an agent prefers the session's provider. An installed agent keeps its old ID until the next `update --map-model`.
>   - A plugin MCP server without a `timeout` now allows a silent call for 30 minutes with stdio or 5 minutes with a remote server. Your `requestTimeoutMs` in `mcp-adapter.json` still wins.
>   - An installed plugin gets the default at its next update or reinstall under pi-mcp-adapter, or at the next session start under Pi's built-in MCP.
>   - Under pi-mcp-adapter, hooks now match plugin MCP tool names over 64 characters, and agents can exclude them with `disallowedTools`. Update or reinstall the plugin to refresh its agents.
>   - pi-mcp-adapter asks for project server approval again when the new timeout changes an approved server's stored definition.

## Decisions Made

None beyond the plan; the rows preserve D-PG1-01 through D-PG1-14 from `01-CONTEXT.md` and the measured summaries.

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

The optional-peer cache was absent. `node scripts/install-test-peers.mjs` installed the pinned peers before Task 2's source check, as the plan directs.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Ready for the orchestrator's combined-tree wave gate and phase verification. AGTASYNC-01 still needs a live background-child call.

## Self-Check: PASSED

All five changed files and the summary exist; the three task commits are ancestors of HEAD, and the plan acceptance checks passed.
