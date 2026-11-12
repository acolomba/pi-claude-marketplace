---
phase: 01-companion-floors-and-mcp-defaults
plan: 04
subsystem: mcp
tags: [mcp, builtin, timeout, cucumber]
requires:
  - phase: 01-01
    provides: Companion floors and the current built-in MCP test environment
provides:
  - Claude Code idle defaults by MCP server type
  - Built-in Pi registrations with 1800-second stdio and 300-second remote defaults
  - Updated built-in config expectations across unit and behavioral tests
affects: [01-06, 01-09, mcp-compatibility]
actuals:
  tokens: 5139
  tasks: 2
  commits: 2
plan_head_before: f8adca62bd90d8e5ac067d70746a0a88dbb921a2
plan_head_after: 821a5acc36dd86905b081116a5d66f27dd05f24d
tech-stack:
  added: []
  patterns:
    - Keep plugin-declared timeout translation separate from consumer defaults
key-files:
  created:
    - .planning/phases/01-companion-floors-and-mcp-defaults/01-04-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
    - extensions/pi-claude-marketplace/domain/mcp-builtin-translation.ts
    - test/domain/mcp-server-features.test.ts
    - test/domain/mcp-builtin-translation.test.ts
    - features/mcp-server/configuration.feature
    - features/mcp-server/builtin-values.feature
    - test/bridges/mcp/builtin-entry.test.ts
    - test/orchestrators/mcp/builtin-registration-step.test.ts
key-decisions:
  - "D-PG1-11: Use 30 minutes for stdio and 5 minutes for remote when no usable plugin timeout is declared."
  - "D-PG1-12: Apply the built-in default at session registration without changing stored plugin records."
patterns-established:
  - "The closed translation table carries only plugin-declared timeout values; consumers apply defaults after translation."
requirements-completed: [PG-MCP-01]
coverage:
  - id: D1
    description: "The domain returns Claude Code's idle default for known MCP server types and no default for unknown types."
    requirement: PG-MCP-01
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/mcp-server-features.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Built-in MCP registration uses the idle default when a plugin declares no usable timeout, while declared values win."
    requirement: PG-MCP-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A server that declares no timeout is registered with the idle window of Claude Code"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/mcp-builtin-translation.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "All pinned built-in configs expect the new default and the adapter MCP profile remains green."
    requirement: PG-MCP-01
    verification:
      - kind: unit
        ref: "npm test"
        status: pass
      - kind: integration
        ref: "npm run test:integration"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin features"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/mcp-server"
        status: pass
    human_judgment: false
duration: 82 min
completed: 2026-11-12
status: complete
---

# Phase 01 Plan 04: Built-in MCP Idle Defaults Summary

**Built-in MCP now registers plugin servers with Claude Code's 30-minute stdio and 5-minute remote idle defaults, while preserving a usable declared timeout.**

## Performance

- **Duration:** 82 min
- **Started:** 2026-11-12T02:02:33Z
- **Completed:** 2026-11-12T03:24:27Z
- **Tasks:** 2
- **Production and test files changed:** 8
- **Node:** v26.13.0

## Accomplishments

- Added `defaultRequestTimeoutMs` for the five supported server type values, with no fallback for an unknown type. `translateMcpServer` still records only plugin-declared timeout values.
- Applied the default in `translateBuiltinMcpServer` after translation. A new built-in scenario checks the registered stdio and HTTP configs without waiting for a slow tool call; an installed plugin receives the default at session registration without an update.
- Updated the built-in config expectations in `features/mcp-server/builtin-values.feature`, `test/bridges/mcp/builtin-entry.test.ts`, and `test/orchestrators/mcp/builtin-registration-step.test.ts`. The integration conformance test required no expectation change: it validates the translated config's JSON rather than pinning the previous config literal.

## Task Commits

1. **Default function, translation, unit cases, and red/green scenario:** `a69c4429820e3b6f43b5dc4e1e25ea569aad2165` — `feat(mcp): apply Claude idle timeouts to built-in servers` (hook passed).
2. **Other built-in config expectations:** `821a5acc36dd86905b081116a5d66f27dd05f24d` — `test(mcp): expect idle defaults in built-in configs` (hook passed).

## Verification

- The red scenario exited 1 with `1 scenario (1 failed)` at **Then pi holds these mcp server configs, apart from each stdio server's command and arguments**: the actual stdio and HTTP configs lacked `timeout: 1800` and `timeout: 300`. After the change, the same scenario exited 0 with `1 scenario (1 passed)`.
- Both direct coverage commands exited 0. `npm run check:features` exited 0. The Task 2 focused run passed 113 tests and 18 built-in scenarios.
- `npm test` exited 0 after the expectation updates (the first run had 23 built-in config assertion or mock failures). `npm run test:integration` exited 0 both before and after. The full built-in profile passed 154/154 scenarios; the adapter MCP profile passed 124/124 scenarios.
- The three `"timeout":1800` rows and one `"timeout":300` row in `builtin-values.feature` match the plan; the explicit 2.5-second row and adapter entry expectations did not change. `npx --no fallow audit --base f8adca62bd90d8e5ac067d70746a0a88dbb921a2` reported no issues in eight changed files.
- Both commits passed the repository's `npm run check:commit` hook. The orchestrator owns the combined-tree `npm run check` gate.

## Decisions Made

Followed D-PG1-11 and D-PG1-12 as planned. A server type outside the closed table gets no default, and the two Claude Code timeout environment variables remain unread.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The restricted sandbox denied npm peer setup and local loopback binding (`EPERM`) before the red scenario ran. Approved escalation let the peer setup and loopback tests run; the red scenario then failed at its intended config comparison.
- Fallow's first audit could not create its temporary Git worktree in the restricted sandbox. The approved escalated audit passed.

## User Setup Required

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

All eight changed files exist, both task commits are ancestors of this branch, every task verification passed after the implementation, and the working tree was clean before this summary was written.

## Next Phase Readiness

Ready for the adapter default and carried user-value work in 01-06. STATE.md and ROADMAP.md remain with the orchestrator.
