---
phase: 01-companion-floors-and-mcp-defaults
plan: 09
subsystem: mcp
tags: [mcp, timeout, cucumber, lifecycle]
requires:
  - phase: 01-companion-floors-and-mcp-defaults
    provides: "Plan 01-04's built-in timeout defaults and plan 01-06's adapter default marker"
provides:
  - "Behavioral proof that user-written adapter timeouts survive updates"
  - "Behavioral proof that adapter defaults are recomputed, restored, and added on reinstall"
  - "Recorded 65-second silent tool call and 5-second control under both MCP implementations"
affects: [mcp-adapter, built-in-mcp, phase-verification]
actuals:
  tokens: 5220
  tasks: 3
  commits: 2
plan_head_before: 7ba310bc6a678799ce60253e731f95fbf3f0096a
plan_head_after: 9eb076eec3bfa1a4616551d96592d7c94b2f55ab
tech-stack:
  added: []
  patterns:
    - "Compare complete adapter entries after each plugin verb, including defaultFields"
key-files:
  created:
    - .planning/phases/01-companion-floors-and-mcp-defaults/01-09-SUMMARY.md
  modified:
    - features/mcp-server/lifecycle.feature
    - features/step_definitions/mcp-server/lifecycle.steps.ts
    - features/lib/mcp-server-files.ts
key-decisions:
  - "The slow-call proof remains a one-off recorded run; no waiting scenario enters the suite (D-PG1-14)."
patterns-established:
  - "Whole-file lifecycle assertions distinguish an extension-owned default from a user value."
requirements-completed: [PG-MCP-01]
coverage:
  - id: D1
    description: A user-written request timeout survives a plugin update while a sibling keeps the default
    requirement: PG-MCP-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/lifecycle.feature#A request timeout the user wrote for a plugin server survives an update"
        status: pass
    human_judgment: false
  - id: D2
    description: An adapter default changes with server type, survives disable and enable as extension-owned, and appears on reinstall of an earlier-release entry
    requirement: PG-MCP-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/mcp-server/lifecycle.feature"
        status: pass
    human_judgment: false
  - id: D3
    description: A silent tool call longer than 60 seconds completes under both implementations and each declared 5-second timeout ends its control call
    requirement: PG-MCP-01
    verification:
      - kind: other
        ref: "D-PG1-14 temporary cucumber runs recorded under Slow call"
        status: pass
    human_judgment: false
duration: 29 min
completed: 2026-11-12
status: complete
---

# Phase 01 Plan 09: MCP Timeout Lifecycle Summary

**Whole-file lifecycle checks protect user-written adapter timeouts and extension-owned defaults; one-off slow calls completed under both MCP implementations.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-11-12T05:05:34Z
- **Completed:** 2026-11-12T05:34:31Z
- **Tasks:** 3
- **Files modified:** 4, including this summary

## Accomplishments

- An update kept the user's 45,000 ms timeout without a `defaultFields` marker, while the sibling entry kept the 1,800,000 ms extension default.
- An update from stdio to remote recomputed the default to 300,000 ms; disable and enable restored 1,800,000 ms as extension-owned; reinstall added the default to an earlier-release entry.
- A tool call silent for 65 seconds returned `echo:ping` under both MCP implementations, and each 5-second control timed out.

## Task Commits

1. **Task 1:** `39288fa8234d5503a63d8cbe4b1ca94ead0f7419` — user timeout update scenario and Given step.
2. **Task 2:** `9eb076eec3bfa1a4616551d96592d7c94b2f55ab` — three default lifecycle scenarios and earlier-release fixture.
3. **Task 3:** this summary commit; the slow-call harness edits were temporary and were not committed.

## Verification

- Task 1: focused adapter scenario, `1 scenario (1 passed)`; `npm run check:features`, exit 0; commit hook passed.
- Task 2: adapter lifecycle, `13 scenarios (13 passed)`; built-in lifecycle, `8 scenarios (8 passed)`; `npm run check:static`, exit 0; commit hook passed.
- Task 3: both temporary profiles, `2 scenarios (2 passed)` each; summary section count 1; clean tracked source and no temporary feature; `npm run check:features`, exit 0.
- Falsification: changing the expected timeout in each of the four new scenarios failed at `Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:`. The original expectations were restored before verification.

## Files Created/Modified

- `features/mcp-server/lifecycle.feature` — four adapter-only whole-file lifecycle scenarios.
- `features/step_definitions/mcp-server/lifecycle.steps.ts` — Given steps for the user's timeout edit and an earlier-release entry.
- `features/lib/mcp-server-files.ts` — removes the timeout and default marker to create the earlier-release fixture.
- `.planning/phases/01-companion-floors-and-mcp-defaults/01-09-SUMMARY.md` — records the one-off slow-call evidence and task verification.

## Decisions Made

- Followed D-PG1-14: the two slow scenarios and two controls are recorded here and absent from the committed suite.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The initial Task 1 command step left an unexamined cascade result. Using the existing `which did not fail` command step gave the scenario a complete result assertion.
- The sandbox initially denied npm registry access, loopback listeners, and Git's worktree metadata writes. Approved escalations allowed the prescribed dependency setup, checks, and commits.

## Slow call (D-PG1-14)

Measured on 2026-11-12 with pi-mcp-adapter 7.0.1 and Pi 1.5.0 in the local cucumber harness. The temporary stub delayed `tools/call` by `STUB_CALL_DELAY_MS` (65,000 ms for the slow case, 10,000 ms for the control). Temporary harness edits raised `STEP_TIMEOUT_MS` to 150,000 ms and `MODEL_TURN_TIMEOUT_MS` to 120,000 ms. Each control declared a 5,000 ms server timeout. Cucumber's JSON formatter recorded the sum of each scenario's step durations and the model-turn duration; the command's separate wall clock includes startup and parallel execution.

| Profile | Command | Exit | Slow scenario / model turn | Slow result received by model | Control scenario / model turn | Control result received by model |
| --- | --- | ---: | ---: | --- | ---: | --- |
| Adapter | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/slow-call.feature --format progress --format json:/tmp/gsd-01-09-agent-p01-09-1794459600/adapter-slow.json` | 0 | 88.237 s / 66.386 s | `mcp returned: echo:ping` | 27.704 s / 6.343 s | `mcp failed: Failed to call tool: Request timed out\n\nExpected parameters:\n  text (string) *required*` |
| Built-in | `npm run test:cucumber:profile -- --profile builtin features/mcp-server/slow-call.feature --format progress --format json:/tmp/gsd-01-09-agent-p01-09-1794459600/builtin-slow.json` | 0 | 78.436 s / 65.087 s | `mcp__plugin_demo_stub__echo returned: echo:ping` | 18.538 s / 5.092 s | `mcp__plugin_demo_stub__echo failed: MCP request timed out after 5000ms` |

The adapter control also sent `notifications/cancelled` with `SdkError: Request timed out`; the built-in control sent it with `Request timed out`. The control results show that the declared timeout governs the call in this harness. No slow scenario is part of the committed suite.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Plan 01-09 is complete. The orchestrator can run the combined-tree wave gate; this worktree did not run the full `npm run check` by plan instruction.

## Self-Check: PASSED

- All three changed production test files exist, and both task commits are ancestors of this branch.
- The four new lifecycle scenarios and both profile runs passed their required checks.
- The temporary feature is absent, its three harness files match the plan base, and no temporary file was committed.
