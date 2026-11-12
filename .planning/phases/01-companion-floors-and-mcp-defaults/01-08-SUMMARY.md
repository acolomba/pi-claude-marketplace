---
phase: 01-companion-floors-and-mcp-defaults
plan: 08
subsystem: hooks
tags: [pi-mcp-adapter, hooks, tool-names, cucumber]
requires:
  - phase: 01-companion-floors-and-mcp-defaults
    provides: exact adapter name fitting and hook-literal recovery from plan 01-07
provides:
  - PostToolUse recovers a shortened adapter tool's full name from successful result details
  - PreToolUse and PostToolUseFailure capability gaps are named in adapter scenarios
  - Cut-shaped direct tools run hooks even when their input names a tool
affects: [hook compatibility, MCP compatibility, adapter proxy routing]
actuals:
  tokens: 8083
  tasks: 2
  commits: 2
commits: 2
plan_head_before: 7ba310bc6a678799ce60253e731f95fbf3f0096a
plan_head_after: be28b72689984f433cc8b549ecf3ea7829f4ee8e
tech-stack:
  added: []
  patterns:
    - Rebuild successful adapter tool names from result details, then require an exact fitted-name match
    - Exclude 64-character adapter cut shapes before testing namespace proxy input
key-files:
  created:
    - .planning/phases/01-companion-floors-and-mcp-defaults/01-08-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/domain/mcp-implementation.ts
    - extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - features/hook/mcp-tool-names.feature
    - features/hook/tool-use.feature
    - test/domain/mcp-implementation.test.ts
    - test/domain/components/hooks/builtin-mcp-tool-names.test.ts
    - test/bridges/hooks/dispatch.test.ts
key-decisions:
  - "D-PG1-08: Read result-detail candidates only for successful results; failed results keep Pi's name unless a hook literal supplies the full name."
  - "D-PG1-08: Treat a 64-character name with the adapter's lowercase hash tail as a direct tool before the proxy input check."
patterns-established:
  - All adapter name construction uses joinedAdapterToolName before fittedAdapterToolName.
requirements-completed: [PG-MCP-02]
coverage:
  - id: D1
    description: Successful PostToolUse hooks recover a shortened tool's full name from adapter result details
    requirement: PG-MCP-02
    verification:
      - kind: e2e
        ref: 'features/hook/mcp-tool-names.feature#With no hook that names the tool, PreToolUse hooks see the name pi-mcp-adapter shortened and PostToolUse hooks its full Claude Code name'
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
        status: pass
      - kind: integration
        ref: node --import test/platform/isolated-pi-home.ts --test test/integration/adapter-tool-name-conformance.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: PreToolUse and PostToolUseFailure shortened-name capability gaps have passing scenarios
    requirement: PG-MCP-02
    verification:
      - kind: e2e
        ref: npx cucumber-js --profile adapter --name "With no hook that names the tool" features/hook/mcp-tool-names.feature
        status: pass
    human_judgment: false
  - id: D3
    description: Cut-shaped adapter direct tools run hooks while adapter proxy calls remain excluded
    requirement: PG-MCP-02
    verification:
      - kind: e2e
        ref: npx cucumber-js --profile adapter --name "pi-mcp-adapter tool whose cut name looks like a proxy call" features/hook/tool-use.feature
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile adapter features/hook
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile builtin features/hook/mcp-tool-names.feature features/hook/tool-use.feature
        status: pass
    human_judgment: false
duration: 29 min from the first preserved red proof
completed: 2026-11-12
status: complete
---

# Phase 01 Plan 08: Companion Floors and MCP Defaults Summary

**Successful adapter results now give PostToolUse hooks a shortened tool's full Claude Code name, while cut-shaped direct tools keep their hooks.**

## Performance

- **Duration:** 29 min from the first preserved red proof
- **First preserved red proof:** 2026-11-12T05:10:13Z
- **Completed:** 2026-11-12T05:39:01Z
- **Tasks:** 2
- **Files changed:** 8 production and test files
- **Node:** v26.13.0

## Accomplishments

- Exported one adapter join and used it in the profile and result-detail recovery. A rebuilt name reaches hooks only when the adapter fit equals Pi's registered name.
- Pinned the PreToolUse and PostToolUseFailure cells that stay shortened when no hook names the full tool, and the PostToolUse cell that recovers it from successful result details.
- Kept real adapter tool calls out of the proxy skip rule when their 64-character cut names resemble namespace proxies; existing proxy calls still skip their outer hooks.

## Task Commits

1. **Result-detail recovery and gap scenarios:** `6174033f48f73275ae04224f4783cf2e85bbaf1b` — `feat(hooks): recover adapter tool names from result details` (hook passed).
2. **Cut-shaped direct tool proxy rule:** `be28b72689984f433cc8b549ecf3ea7829f4ee8e` — `fix(hooks): run hooks for cut names shaped like proxies` (hook passed).

## Verification

- Task 1 red: `npx cucumber-js --profile adapter --name "With no hook that names the tool" features/hook/mcp-tool-names.feature` exited 1 with **2 scenarios (1 passed, 1 failed)**. The recorded-runs comparison failed: `after` had Pi's 64-character name and `prefixed-after` did not run. The PostToolUseFailure gap scenario passed already. After the product change, the same command exited 0 with **2 scenarios (2 passed)**; it passed again as the committed tracer gate.
- Task 1 direct coverage of `dispatch.ts` and `mcp-implementation.ts` exited 0, including the committed tracer reruns. The installed-adapter naming conformance test exited 0. All Task 1 acceptance counts and the unchanged-file diff check passed.
- Task 2 red: the new adapter scenario exited 1 with **1 scenario (1 failed)** at the recorded-runs comparison, with no hooks recorded. The new proxy unit rows also failed on their expected hook calls before the fix. After the fix, the scenario exited 0 with **1 scenario (1 passed)**.
- Task 2 direct coverage of `dispatch.ts` and `builtin-mcp-tool-names.ts` exited 0. The exact adapter hook suite exited 0 with **179 scenarios (179 passed), 2,332 steps (2,332 passed)** on its final run. The specified built-in feature pair exited 0 with **5 scenarios (5 passed), 73 steps (73 passed)**. All Task 2 acceptance counts passed; the recorded-runs table has no outer `mcp` row.
- Both task commits passed their hooks, including `npm run check:commit`. `npx fallow audit --base 7ba310bc6a678799ce60253e731f95fbf3f0096a` exited 0. The orchestrator owns the combined-tree `npm run check` wave gate.

## Lines for later plans

| Tool event | A hook spells the full name | No hook spells it |
| --- | --- | --- |
| PreToolUse | All hooks receive the full name; a long server-prefix matcher runs. | Hooks receive Pi's shortened name; a server-prefix matcher longer than the 55 kept characters does not run. |
| PostToolUse | All hooks receive the full name; a long server-prefix matcher runs. | Successful adapter result details recover the full name for all hooks; a long server-prefix matcher runs. |
| PostToolUseFailure | All hooks receive the full name; a long server-prefix matcher runs. | Hooks receive Pi's shortened name; a long server-prefix matcher does not run. |

The adapter's own proxy is `mcp`. A third-party proxy-only server could coincidentally register a namespace proxy with exactly 64 characters and the cut-shaped eight-digit lowercase hash tail. Its outer call would then run hooks alongside its nested call; this rare residual is left as documented in the proxy rule (D-PG1-08).

## Deviations from Plan

**[Rule 1 - Bug] Keep failed results out of result-detail recovery** — Found during Task 1. The failed-call scenario acquired a full name after the first implementation even though it had no full-name hook. The result event exposed a `tool` detail in that path, so recovery now reads details only for a successful event. The failed scenario and a unit row with a `tool` detail passed after the guard. Committed in `6174033f48f73275ae04224f4783cf2e85bbaf1b`.

**Total deviations:** 1 auto-fixed bug. **Impact:** The guard is required for the planned PostToolUseFailure gap.

## Issues Encountered

- The first optional-peer install and cucumber loopback run were blocked by the restricted sandbox. Approved escalation installed the pinned peers and ran the local stub servers.
- The first Task 1 red attempt used an incomplete run table; after adding all recorded fields, the red run had the planned one-fail, one-pass result. Pre-commit formatted changed TypeScript files before both task commits; reruns passed.
- The first two broad adapter hook-suite runs each failed a different existing async process cleanup scenario in `features/hook/async.feature`. The named project-process scenario passed alone, and the third exact broad run passed all 179 scenarios. No async code was changed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Ready for the remaining Phase 01 plans. The two shortened-name capability gaps are ready for the compatibility page in plan 01-10. The combined-tree wave check remains with the orchestrator.

## Self-Check: PASSED

Both production commits are ancestors of HEAD, all eight changed production and test files exist, and every task verification command reached exit 0. The summary records the red proof, the later-plan matrix, the transient suite failures, and threat flags.
