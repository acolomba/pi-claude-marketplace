---
phase: 03-background-subagents
plan: "05"
subsystem: hooks
tags: [hooks, subagents, identity, process-ownership, cucumber]
requires:
  - phase: 03-background-subagents
    provides: Child classification and parent/sibling ownership isolation (03-01) and the pre-tool child identity contract (03-03)
provides:
  - Child identity (agent_type, agent_id) in PostToolUse and PostToolUseFailure stdin
  - Installed-plugin proof that a child runs only tool hooks and leaves parent and sibling hooks running
  - Reusable multi-session hook driver for steps and integration tests
affects: [03-06, 03-07, 03-08]
actuals:
  tokens: 19260
  tasks: 2
  commits: 3
plan_head_before: cd8a06f733a78bd9b36abe2b89df30107133ef91
plan_head_after: ac952b6430c5048f23558f8d359a52574f9778a4
tech-stack:
  added: []
  patterns:
    - Multi-session hook driver runs main and child Pi processes in RPC mode and attributes each waiting hook through its /proc dispatch marker.
key-files:
  created:
    - .planning/phases/03-background-subagents/03-05-SUMMARY.md
    - features/lib/subagent-hook-session.ts
    - features/step_definitions/plugin/subagent-hooks.steps.ts
    - test/integration/subagent-hook-ownership.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
    - test/bridges/hooks/payloads/post-tool-use.test.ts
    - test/bridges/hooks/payloads/post-tool-use-failure.test.ts
    - test/integration/hooks-dispatch-end-to-end.test.ts
    - features/plugin/subagent-child.feature
key-decisions:
  - Result payloads add identity only when the child identity's session matches the dispatching session, as the pre-tool payloads do.
  - RPC new_session stands in for /reload in process tests; it runs the same shutdown and fresh extension load.
patterns-established:
  - Child hook scenarios compare the complete observed hook list and keep a main-session positive control.
requirements-completed: [PG-HOOK-07a]
coverage:
  - id: D1
    description: Successful and failed child tool results carry the child's type and ID; main, absent and mismatched identities carry neither.
    requirement: PG-HOOK-07a
    verification:
      - kind: unit
        ref: node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/payloads/post-tool-use.test.ts test/bridges/hooks/payloads/post-tool-use-failure.test.ts test/integration/hooks-dispatch-end-to-end.test.ts
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
        status: pass
    human_judgment: false
  - id: D2
    description: A child suppresses main-session lifecycle hooks, ignores a blocking Stop hook, and leaves parent and sibling hooks running through load, spawn, exit, new session and stop.
    requirement: PG-HOOK-07a
    verification:
      - kind: integration
        ref: node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/subagent-hook-ownership.test.ts
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile adapter features/plugin/subagent-child.feature
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile builtin features/plugin/subagent-child.feature
        status: pass
    human_judgment: false
duration: "about 2 h from the base commit, including a user-requested pause"
completed: 2026-11-13
status: complete
---

# Phase 03 Plan 05: Child Result Identity and Process Ownership Summary

**Child tool result hooks now carry the child's identity, and installed-plugin and real-process tests prove a child runs no main-session hooks and never disturbs parent or sibling hooks.**

## Performance

- Base commit: 2026-11-13T17:51:07Z. Last task commit: 2026-11-13T19:52:47Z. The run was paused by the user during Task 1's commit and resumed in the same worktree.
- Tasks: 2.
- Files modified: 9 (2 production, 7 test and feature).
- Measured patch: 77,038 characters / 4 = 19,260 estimate-scale tokens.

## Accomplishments

- `translatePostToolUse` and `translatePostToolUseFailure` add `agent_type` and `agent_id` when the child identity's session is the dispatching session. Result precedence, error text and `is_interrupt` are unchanged.
- Five installed-plugin scenarios pass under both MCP profiles: child tool hooks without main-session hooks, a blocking child Stop hook that is ignored, child compaction without main-session hooks, a main-session lifecycle control, and parent and sibling hooks that survive a child's load and stop.
- The process-ownership test proves parent and sibling hooks stay alive with unchanged journals through every child stage, and that a crashed child's hook is reclaimed while a live sibling's hook keeps running.

## Task Commits

1. **Task 1: Record identity after one successful and one failed child tool call** - `1a896787` (`feat(hooks): include child identity in tool result payloads`)
2. **Task 2: Prove lifecycle suppression and process ownership through installed plugins** - `ac952b64` (`test(hooks): prove child lifecycle suppression and process ownership`)

Merged into `features/gaps` as `9a242dc3`. Normal commit hooks passed on both commits.

## Validation

| Scope | Command | Result |
|---|---|---|
| Task 1 RED | The three Task 1 test files with HEAD payload source and the new tests | Exit 1; 28 pass, 3 fail. Each failure is the `child-session` case missing `agent_type`/`agent_id`; the `absent` and `other-session` controls pass. |
| Task 1 owners | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test` the three Task 1 files | Exit 0; 31 pass. |
| Task 1 coverage | `npm run test:coverage:direct --` both payload sources | Exit 0. |
| Task 1 audit | `npx --no fallow audit --base HEAD` | Exit 0; no issues in 5 changed files. |
| Task 2 RED, ownership | Registry child gates disabled in the working tree (`/tmp/pg3-05-task2-red-ownership.patch`) | Both integration cases and the parent/sibling scenario fail: the child's load kills the foreign hook and rewrites its journal. |
| Task 2 RED, suppression | `dispatchesInCurrentSession` forced true (`/tmp/pg3-05-task2-red-suppression.patch`) | Tool-hook, Stop and compaction scenarios fail on extra main-session hooks; the main control passes. |
| Task 2 integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/subagent-hook-ownership.test.ts` | Exit 0; 2 pass, none cancelled or skipped. |
| Adapter behavior | `npm run test:cucumber:profile -- --profile adapter features/plugin/subagent-child.feature` | Exit 0; 9 scenarios, 139 steps passed. |
| Builtin behavior | `npm run test:cucumber:profile -- --profile builtin features/plugin/subagent-child.feature` | Exit 0; 5 scenarios, 72 steps passed. |
| Wave gate | `npm run check` on the combined tree at `9a242dc3` | See the wave-3 tracking record. |

## Deviations from Plan

1. **RPC `new_session` stands in for `/reload`.** RPC-mode Pi has no `/reload` command. `new_session` runs `session_shutdown` and a fresh extension load, the path a reload takes, with reason `new`.
2. **One scenario replaced.** The 03-01 scenario "A background child runs tool hooks without parent lifecycle hooks" was replaced by "A child runs tool hooks without main-session hooks", which covers the same events and adds a failed call, compaction and a blocking Stop.
3. **New child start step.** The existing marker step loads no companion, so it runs only under the adapter profile. A new step starts the child with the profile's MCP implementation; the five scenarios are tagged `@mcp`. The marker step is unchanged.
4. **Mock-only owner arms already existed.** The EPERM, unknown-probe and PID-reuse arms are in `test/bridges/hooks/async-rewake/registry.test.ts` from 03-01; no change was needed.
5. **Lint fix in Task 1.** The first commit hook failed `curly` on a braceless `if`/`else` in `hooks-dispatch-end-to-end.test.ts`; braces were added and the commit retried without bypassing hooks.

**Impact:** No production change beyond the two payload translators; no assertion was weakened.

## Issues Encountered

- The paused run's fallow audit failed because the sandbox could not create its temporary worktree. On resume it passed.
- The first Pi start in the integration file builds the shared jiti cache (about 12 s), inside the 30 s stage bound but the stage closest to it on a slow runner.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

Both task SHAs are ancestors of `9a242dc3`; all five plan verify commands passed; RED for each task failed on the intended assertion.

## Next Phase Readiness

Ready for wave 4 (03-06) after the wave-3 combined-tree gate passes.
