---
phase: 03-background-subagents
plan: "01"
subsystem: hooks
tags: [subagents, hooks, child-journals, event-routing, identity]
requires: []
provides:
  - Per-runtime, per-session child async journals with conservative orphan recovery
  - Exhaustive child hook event policy with owned shutdown cleanup
  - Session-bound child identity captured from structured before-run metadata
affects: [03-background-subagents, hook-payloads, child-integration]
actuals:
  tokens: 26858
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - Immutable journal owner captured by async spawn and finalizer closures
    - Factory-local child identity refreshed on every before_agent_start callback
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - test/bridges/hooks/runtime.test.ts
    - test/bridges/hooks/async-rewake/registry.test.ts
    - test/bridges/hooks/event-router.test.ts
    - features/plugin/subagent-child.feature
key-decisions:
  - "Keep child async rows in private, bounded journals keyed by runtime and session; preserve the parent legacy table."
  - "Classify all ten admitted events in the router and admit only tool events in children."
  - "Accept only the companion's anchored structured active_agent prefix; use the current Pi session ID as child ID."
patterns-established:
  - "Child journal recovery requires both confirmed owner death and a matching dispatch marker before signalling."
requirements-completed: ["PG-HOOK-07a"]
coverage:
  - id: D1
    description: "Child async hooks preserve parent and sibling process ownership through spawn, exit, recovery, and reload."
    requirement: PG-HOOK-07a
    verification:
      - kind: unit
        ref: "test/bridges/hooks/async-rewake/registry.test.ts#keeps a waiting parent hook and its table intact while a child hook runs"
        status: pass
      - kind: other
        ref: "TEST_CONCURRENCY=1 npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/runtime.ts extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts extensions/pi-claude-marketplace/bridges/hooks/event-router.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Child sessions dispatch only the three tool hook events while setup and owned shutdown continue."
    requirement: PG-HOOK-07a
    verification:
      - kind: unit
        ref: "test/bridges/hooks/event-router.test.ts#child routes SessionStart by the ten-event policy"
        status: pass
      - kind: e2e
        ref: "features/plugin/subagent-child.feature#A background child runs tool hooks without parent lifecycle hooks"
        status: pass
    human_judgment: false
  - id: D3
    description: "The before-run callback captures a current-session child identity from the structured companion prefix and clears invalid metadata."
    requirement: PG-HOOK-07a
    verification:
      - kind: unit
        ref: "test/bridges/hooks/event-router.test.ts#before_agent_start captures the companion prefix while draining pending context"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/runtime.test.ts#child identity accepts escaped producer name"
        status: pass
    human_judgment: false
duration: 55 min
completed: 2026-11-13
status: complete
commits: 3
plan_head_before: 12a49b23c7d85e0b2d137cadd9f8bd69e734bdd1
plan_head_after: 62b5b3c496d56dae7e12f31fec8612392a160d35
---

# Phase 03 Plan 01: Background Child Hook Ownership Summary

**Child async journals now isolate process ownership, the router admits only tool hooks in child sessions, and before-run callbacks capture a session-bound companion identity.**

## Performance

- **Started:** 2026-11-13T15:48:11Z
- **Completed:** 2026-11-13T16:43:00Z
- **Duration:** 55 min
- **Tasks:** 3
- **Files modified:** 7
- **Actual diff scale:** 107431 characters / 4 = 26858 tokens

## Accomplishments

- Child async hooks write contained, atomic journals keyed by immutable runtime/session ownership. Parent PID table bytes and sibling rows survive child operations; recovery requires a dead owner and matching hook marker.
- The router classifies all ten admitted events. Child sessions dispatch PreToolUse, PostToolUse, and PostToolUseFailure, while trust hydration, context delivery, and owned reload/shutdown cleanup continue.
- The real before_agent_start callback reads the anchored active_agent prefix from structured prompt options, decodes the four producer entities once, binds the type to the current Pi session, and logs only a fixed diagnostic for unavailable metadata.

## Task Commits

1. **Task 03-01-01, child async ownership:** `dc8e90dce41a694cc59a183c65ad86e5188dd479`
2. **Task 03-01-02, child event policy and cleanup:** `14518c7a35e9efe56e6346e1b6becd7373f2a368`
3. **Task 03-01-03, before-run identity capture:** `62b5b3c496d56dae7e12f31fec8612392a160d35`

## Validation

| Command or check | Scope | Result |
| --- | --- | --- |
| Targeted RED test for parent table survival | Task 1, before implementation | Failed on the intended parent-row assertion; GREEN passed |
| Targeted RED child input policy test | Task 2, before implementation | Failed because UserPromptSubmit ran; GREEN passed |
| Targeted RED before-run identity test | Task 3, before implementation | Failed because the identity snapshot was absent; GREEN passed |
| `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/runtime.test.ts test/bridges/hooks/async-rewake/registry.test.ts test/bridges/hooks/event-router.test.ts` | Final worktree code head `62b5b3c4` | Exit 0; 3 owner modules passed, 0 failed/cancelled/skipped |
| `TEST_CONCURRENCY=1 npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/runtime.ts extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` | Final worktree code head, Node v26.13.1 | Exit 0; 100% direct coverage for all three source/test pairs |
| `npm run test:cucumber` | Worktree code including the new scenario; adapter and builtin profiles | Exit 0; adapter 1870/1870 scenarios and builtin 162/162 scenarios passed |
| `npm run check:features` | Changed behavioral feature | Exit 0 |
| `npm run --silent typecheck` and `./node_modules/.bin/fallow audit --base 12a49b23c7d85e0b2d137cadd9f8bd69e734bdd1` | Final worktree code head | Exit 0; Fallow found no issues in 7 changed files |
| Normal `git commit` hooks | Each of the three task commits | Passed; no hook bypass |
| `npm run check` | Combined tree after wave 1 merge | Pending parent-owned gate; not run in this isolated worktree |

The unqualified combined direct-coverage command intermittently reported the registry test file as failed when owner pairs ran concurrently. The same final-head owners passed together in the Node test run and passed direct coverage with `TEST_CONCURRENCY=1`. No failed run is counted as a pass.

## Decisions Made

- Preserved the legacy PID table for main sessions and gave child sessions private journals, so a child cannot rewrite a live parent's rows.
- Kept unsupported SubagentStart and SubagentStop counterpart labels in the router policy only; neither is an admitted hook event.
- Used the exact child marker and Pi session ID for identity, with no fallback to rendered prompt, task text, display name, or environment agent name.

## Deviations from Plan

**[Rule 2 - Required integration]** Task 1 also changed `event-router.ts` to account for the registry shutdown API becoming awaitable; Task 2 completed the awaited registration and shutdown paths. Task 2 added `features/plugin/subagent-child.feature` because the project requires Cucumber coverage for visible hook behavior. These are the actual seven changed files, compared with the plan's six declared files.

**Total deviations:** 2 required integration adjustments. **Impact:** No dependency, peer floor, or shared planning file changed.

## Issues Encountered

- The first Task 1 commit hook found TypeScript and ESLint errors; these were fixed and the normal hook passed on retry.
- The Cucumber harness initially lacked its pinned optional peer cache; `node scripts/install-test-peers.mjs` installed the declared test peers. Its loopback listener required the approved local-process sandbox escalation. No real credentials or model network calls were used.
- Parallel combined direct coverage intermittently failed at the registry test file level; a serial rerun passed at the final code head.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

All three task SHAs are ancestors of the code head, the three required production artifacts and the behavioral feature exist, owner tests and direct coverage pass, and the seven-file Fallow audit is clear. The parent still owns the combined-tree `npm run check` gate after the wave merge.

## Next Phase Readiness

Ready for plan 03-02. The parent should merge wave 1 and run its combined-tree `npm run check` gate. Permanent real detached companion identity integration remains assigned to the later phase plan.
