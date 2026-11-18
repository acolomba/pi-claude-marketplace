---
phase: 01-companion-floors-and-mcp-defaults
plan: 10
subsystem: documentation
tags: [pi-subagents, pi-mcp-adapter, mcp, hooks, timeouts]
requires:
  - phase: 01-companion-floors-and-mcp-defaults
    provides: Companion floors, measured agent results, timeout behavior, and long-name scenarios from plans 01-01 through 01-09
provides:
  - Compatibility guidance for the new companion floors and measured foreground failures
  - Compatibility guidance for default MCP timeouts and their lifecycle
  - Compatibility guidance for shortened adapter tool names in listings, hooks, and agents
affects: [parity-gaps verification, MCP compatibility, hook compatibility]
actuals:
  tokens: 22163
  tasks: 3
  commits: 3
plan_head_before: c716fff8131ca7767231528a20af07f64c23a303
plan_head_after: cabf9501a0d5a51783245216ad857bd23f226748
tech-stack:
  added: []
  patterns:
    - Compatibility claims name a scenario, a dated run, or versioned companion source
key-files:
  created:
    - .planning/phases/01-companion-floors-and-mcp-defaults/01-10-SUMMARY.md
  modified:
    - docs/mcp-compatibility.md
    - docs/hooks-compatibility.md
key-decisions:
  - "D-PG1-03: State that no real background-child tool call is recorded for pi-subagents 0.88.0."
  - "D-PG1-08: Describe the two hook events that can receive a shortened name without a full-name hook."
patterns-established: []
requirements-completed: [PG-AGENT-02, PG-MCP-01, PG-MCP-02]
coverage:
  - id: D1
    description: "The MCP page names the companion floors, fixed pi-subagents bugs, and measured foreground behavior."
    requirement: PG-AGENT-02
    verification:
      - kind: other
        ref: "Task 1 acceptance checks and exact comparison with 01-01-SUMMARY.md Measured texts"
        status: pass
      - kind: other
        ref: "SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files docs/mcp-compatibility.md"
        status: pass
    human_judgment: true
    rationale: "The harness cannot start a detached pi-subagents child, and no real background-child tool call is recorded."
  - id: D2
    description: "The MCP page explains the default timeout, precedence, restaging, and remaining differences from Claude Code."
    requirement: PG-MCP-01
    verification:
      - kind: other
        ref: "Task 2 acceptance checks and 01-09-SUMMARY.md Slow call (D-PG1-14)"
        status: pass
      - kind: other
        ref: "SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files docs/mcp-compatibility.md"
        status: pass
    human_judgment: true
    rationale: "The prose combines upstream documentation, scenarios, companion source, and a recorded one-off run; technical review must assess the synthesis."
  - id: D3
    description: "Both pages explain the 64-character adapter rule and its effects on hooks and agents."
    requirement: PG-MCP-02
    verification:
      - kind: other
        ref: "Task 3 acceptance checks, listing-example comparison, and Markdown anchor checks"
        status: pass
      - kind: other
        ref: "SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files docs/mcp-compatibility.md docs/hooks-compatibility.md"
        status: pass
    human_judgment: true
    rationale: "The documentation describes companion capability gaps whose user-facing adequacy needs review."
duration: at least 6 min from first task commit
completed: 2026-11-12
status: complete
---

# Phase 01 Plan 10: Companion Floors and MCP Defaults Summary

**The MCP and hook compatibility pages now describe the verified companion floors, timeout defaults, and shortened tool-name behavior.**

## Performance

- **Duration:** At least 6 minutes from the first task commit; the exact start time was not captured.
- **First task commit:** 2026-11-12T06:03:28Z
- **Completed:** 2026-11-12T06:09:01Z, before this summary commit
- **Tasks:** 3
- **Production files modified:** 2
- **Node:** v26.13.0

## Accomplishments

- `docs/mcp-compatibility.md` now names the pi-mcp-adapter 7.0.1 and pi-subagents 0.87.0 floors, the tested pi-subagents 0.88.0, the two fixed pi-subagents bugs, and the exact foreground results measured on 0.88.0. The live-check sentence is: "No live run of a background child that calls a granted plugin MCP tool is recorded for pi-subagents 0.88.0."
- The MCP page now states the 30-minute stdio and 5-minute remote defaults, timeout precedence and restaging, the project approval consequence, and the recorded 65-second silent calls from 2026-11-12. It names the hard-limit, environment-variable, and first-byte differences that remain.
- The MCP and hook pages now state the adapter's 64-character rule, the name a hook can receive on each tool event, the registered name used in an agent's `excludeTools`, and the measured pi-subagents long-grant gap.

## Task Commits

1. **Companion floors and foreground results:** `99fd17c65b7a44ba50ae53e11961b7c9420af686` -- `docs(mcp): correct companion floors and agent failures` (hooks passed).
2. **Timeout defaults:** `24bebef8b1a4721a5be481a7e3b028493b3b592f` -- `docs(mcp): explain plugin server timeout defaults` (hooks passed).
3. **Shortened tool names:** `cabf9501a0d5a51783245216ad857bd23f226748` -- `docs(mcp): explain names shortened by the adapter` (hooks passed).

## Verification

- All three tasks' acceptance checks passed. Both foreground fenced blocks match `01-01-SUMMARY.md` character for character; the long-name example matches `features/mcp-server/listing.feature`; the changed internal and cross-page anchors resolve.
- Each task's required `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files ...` check passed. Task 3's first run reformatted the hooks table; after restaging, the rerun and commit hooks passed. The documentation-only commits correctly skipped `npm run check:commit`.
- `npx --no fallow audit --base c716fff8131ca7767231528a20af07f64c23a303` exited 0. `git diff --check` passed, and the production diff from the plan base contains only the two requested documents. The orchestrator owns the combined-tree `npm run check` gate.

## Files Created/Modified

- `docs/mcp-compatibility.md` -- corrected header, floors, name length, timeout, agent, divergence, and canary passages.
- `docs/hooks-compatibility.md` -- corrected matcher rows, tool-name mapping, and proxy paragraph.
- `.planning/phases/01-companion-floors-and-mcp-defaults/01-10-SUMMARY.md` -- execution evidence and the outstanding live-check boundary.

## Decisions Made

- Followed the plan's transparency rule: no real background-child call is claimed, and the 65-second result is identified as a one-off run rather than suite coverage.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The optional peer cache was absent. The prescribed installer failed with `spawnSync npm EPERM` in the restricted sandbox, then installed the pinned peers under approved escalation. The cached pi-mcp-adapter 7.0.1 package declares MCP SDK client 2.3.1.
- The Task 3 Markdown formatter rewrote the expanded table. Its output was restaged, and the verification rerun passed before the task commit.

## User Setup Required

None. Phase verification still needs the plan's human check of a real background child using a granted plugin MCP tool; the harness cannot start that detached child.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

The two compatibility pages are ready for the orchestrator's combined-tree gate and the remaining phase work. STATE.md and ROADMAP.md remain owned by the orchestrator.

## Self-Check: PASSED

All three task commits are ancestors of HEAD. Both documentation files exist, every task verification reached exit 0, all acceptance checks passed, and the summary records the unperformed live background-child check.
