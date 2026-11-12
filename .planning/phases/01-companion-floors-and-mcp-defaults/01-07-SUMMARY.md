---
phase: 01-companion-floors-and-mcp-defaults
plan: 07
subsystem: hooks
tags: [pi-mcp-adapter, hooks, tool-names, cucumber]
requires:
  - phase: 01-companion-floors-and-mcp-defaults
    provides: the adapter fit rule and installed-adapter conformance proof from plan 01-03
provides:
  - Full Claude Code tool literals match adapter names cut to 64 characters
  - All hooks of a tool event receive a recovered full name after exact hash-fit validation
  - Failed shortened-tool calls run PostToolUseFailure hooks under the full name
affects: [hook compatibility, MCP compatibility, adapter result recovery]
actuals:
  tokens: 10798
  tasks: 3
  commits: 4
plan_head_before: a2c659a60aaa0ff540632f78360dee9fef0d1352
plan_head_after: aa54540a2b3101c334595871e68094ea13f1de44
tech-stack:
  added: []
  patterns:
    - Validate a recovered Claude Code name by fitting it to Pi's registered adapter name
    - Recover once from all three tool-event hook buckets before dispatching an event
key-files:
  created:
    - .planning/phases/01-companion-floors-and-mcp-defaults/01-07-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/domain/mcp-implementation.ts
    - extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
    - features/hook/mcp-tool-names.feature
    - test/domain/mcp-implementation.test.ts
    - test/domain/components/hooks/builtin-mcp-tool-names.test.ts
    - test/bridges/hooks/dispatch.test.ts
key-decisions:
  - "D-PG1-08: Recover only a candidate longer than 64 characters whose adapter fit equals Pi's cut name."
  - "D-PG1-08: Search matcher and if literals across all three tool-event buckets so every hook sees one event name."
  - "T-01-19: An unrecovered cut name accepts only server prefixes within its 55 retained characters."
patterns-established:
  - Tool-name recovery is lazy for cut-shaped adapter names and leaves built-in and short names untouched.
requirements-completed: [PG-MCP-02]
coverage:
  - id: D1
    description: A full Claude Code literal matches the tool name pi-mcp-adapter cut
    requirement: PG-MCP-02
    verification:
      - kind: e2e
        ref: features/hook/mcp-tool-names.feature#full-name successful call
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/mcp-implementation.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Every hook receives the validated full name and server prefixes avoid sibling matches
    requirement: PG-MCP-02
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
        status: pass
      - kind: e2e
        ref: features/hook/mcp-tool-names.feature#five full-name hook runs
        status: pass
    human_judgment: false
  - id: D3
    description: A failed shortened-tool call runs full-name failure hooks while built-in MCP behavior stays intact
    requirement: PG-MCP-02
    verification:
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile adapter features/hook/mcp-tool-names.feature features/hook/tool-use.feature features/hook/tool-failure.feature
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile builtin features/hook/mcp-tool-names.feature features/hook/tool-use.feature features/hook/tool-failure.feature
        status: pass
    human_judgment: false
duration: 31 min
completed: 2026-11-12
status: complete
---

# Phase 01 Plan 07: Companion Floors and MCP Defaults Summary

**Hooks now match and receive a shortened adapter tool's full Claude Code name after an exact hash-fit check, on successful and failed calls.**

## Performance

- **Duration:** 31 min from the first recorded red run
- **First recorded run:** 2026-11-12T03:57:11Z
- **Completed:** 2026-11-12T04:28:25Z
- **Tasks:** 3
- **Files changed:** 8 production and test files
- **Node:** v26.13.0

## Accomplishments

- Exported the adapter's existing fit rule and used it to match a full hook literal to the 64-character registered name. The first adapter scenario failed at its recorded-runs assertion before the product change, then passed.
- Recovered a full name only when it hashes to Pi's cut name, before any hook of the event runs. Matchers, if fields, payloads, notices, and block reasons share that name. An unrecovered cut name refuses a server prefix beyond the 55 retained characters.
- Added a failed-call scenario using the long-plugin stub server and confirmed that three PostToolUseFailure hooks receive the full name while the PostToolUse hook does not run. Existing built-in behavior passed in both cucumber profiles.

## Task Commits

1. **Full literal match and red-to-green adapter scenario:** aeee2623bf0301aaa38542899a74811199236c63 — feat(hooks): match full MCP names against adapter cuts (hook passed).
2. **Exact name recovery and shared event view:** ff62137437de80db759f9ae832c53b04f447fdbe — feat(hooks): recover full names for shortened MCP tools (hook passed).
3. **Failed-call proof and if-field comments:** 71151cb37b49366039a96753af81174fe07cfbca — test(hooks): cover failed shortened MCP tool calls (hook passed).
4. **Adapter notice, block, and input-rewrite assertions:** aa54540a2b3101c334595871e68094ea13f1de44 — test(hooks): pin adapter labels and input rewrites (hook passed).

## Verification

- Task 1 red: the adapter scenario exited 1 with 1 scenario (1 failed). Its failing step was Then the hooks record these runs in any order; the actual rows were empty. The green run exited 0 with 1 scenario (1 passed). Both domain direct-coverage commands and check:features exited 0.
- Task 2 red: the serverPrefixNames case for confluence-apis expected false and saw true; the dispatch case for a full-name PreToolUse literal expected the full name and saw Pi's cut name. Both targeted Node test runs exited 1 on those assertions before product edits. The complete five-hook scenario, both changed-source direct-coverage commands, and check:static exited 0 after the edits.
- Task 3: the new failed-call scenario exited 0 with 1 scenario (1 passed). The adapter profile passed 34 scenarios and 480 steps; the built-in profile passed 6 scenarios and 87 steps. Direct coverage of bridges/hooks/if-field/index.ts exited 0.
- The follow-up dispatch cases assert the full name in the notice, block reason, and model context, and verify that a hook input rewrite reaches Pi's original input. Dispatch direct coverage exited 0 again.
- All four production and test commits passed their hooks. Fallow audit reported no issues. The orchestrator owns the combined-tree npm run check wave gate.

## Lines for later plans

A hook may spell a shortened adapter tool's full Claude Code name in a matcher or if literal. When any tool-event hook spells a full name whose adapter cut exactly matches Pi's name, every hook of that event receives the full name. Without recovery, a server prefix longer than the 55 retained characters does not match a cut name because a sibling server can share the retained text.

Measured failed-call error: Error: echo:ping

## Decisions Made

Recovery uses hook literals from PreToolUse, PostToolUse, and PostToolUseFailure. It does not read the adapter cache; plan 01-08 owns recovery from result details and the remaining shortened-name cases.

## Deviations from Plan

None - the plan's fixture and product behavior worked as specified.

## Issues Encountered

- The restricted sandbox blocked the first optional-peer install and the cucumber loopback server. Approved escalation let both run; pi-mcp-adapter 7.0.1 was installed in the test peer cache.
- Task 1's first commit attempt failed the required hook on an import-order blank line. I moved the test block below the imports, restaged the file, and the retry passed. Task 2's first check:static run found formatting differences; Prettier fixed them and the rerun passed.
- Task 2's unit cases ran red before the production edit and green afterward. The plan's per-task commit contains both tests and implementation; workflow.tdd_mode is false, so no separate RED commit was made. The summary self-check found two missing adapter-specific assertions and they were added in the fourth commit.

## Threat Flags

None -- no security-relevant surface outside the plan's <threat_model> was introduced.

## User Setup Required

None.

## Next Phase Readiness

Ready for plan 01-08 to recover names from adapter result details and document the remaining capability gap.

## Self-Check: PASSED

All eight changed production and test files exist. The four production and test commits are ancestors of HEAD; their hooks and the task verification commands passed. The summary has the required lines for later plans and threat flags.

---
*Phase: 01-companion-floors-and-mcp-defaults*
*Completed: 2026-11-12*
