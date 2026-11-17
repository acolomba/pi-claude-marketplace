---
phase: 03-background-subagents
plan: "02"
subsystem: agents
tags: [mcp, grants, migration, cucumber]
requires: []
provides:
  - Exact historical and corrected MCP warning translation across implementations
  - Safe migration eligibility for implementation-less agent records
  - Both-profile behavioral coverage of warning switches and edited-file protection
affects: [03-04, 03-07, 03-08]
actuals:
  tokens: 9076
  tasks: 3
  commits: 3
plan_head_before: 12a49b23c7d85e0b2d137cadd9f8bd69e734bdd1
plan_head_after: 2caae2fab46b4835cc6e0853894c9aa4bb4aa86b
tech-stack:
  added: []
  patterns:
    - Finite complete-string warning recognition preserves stored wording generation.
    - Behavioral fixtures write literal grant forms and compare full file and index state.
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts
    - test/bridges/agents/mcp-async-warning.test.ts
    - extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts
    - test/bridges/agents/legacy-grant-form.test.ts
    - extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts
    - test/bridges/agents/grant-rewrite.test.ts
    - features/mcp-server/agent-grants.feature
    - features/step_definitions/mcp-server/agent-grants.steps.ts
key-decisions:
  - Keep fresh mcpAsyncWarning output historical until plan 03-04 changes the emitter and its consumers together.
  - Keep near-match rejection in its own behavioral scenario so it cannot be hidden by a successful migration row.
patterns-established:
  - Stored warning translation selects a known full-string generation before changing the implementation suffix.
requirements-completed: [PG-AGENT-01]
coverage:
  - id: D1
    description: Historical and corrected stored MCP warnings translate both ways without changing generation.
    requirement: PG-AGENT-01
    verification:
      - kind: unit
        ref: test/bridges/agents/mcp-async-warning.test.ts#rewriteMcpAsyncWarning
        status: pass
      - kind: unit
        ref: test/bridges/agents/legacy-grant-form.test.ts#a stored corrected warning keeps its generation and unrelated provenance
        status: pass
    human_judgment: false
  - id: D2
    description: Implementation-less exact candidates migrate while near matches and user edits remain untouched.
    requirement: PG-AGENT-01
    verification:
      - kind: unit
        ref: test/bridges/agents/grant-rewrite.test.ts#an implementation-less corrected warning switches twice and retains exact provenance
        status: pass
      - kind: unit
        ref: test/bridges/agents/grant-rewrite.test.ts#a one-byte user edit preserves the file and recorded provenance
        status: pass
    human_judgment: false
  - id: D3
    description: Both MCP profiles exercise stored warning switches, missing metadata, retries, near matches, and edit protection.
    requirement: PG-AGENT-01
    verification:
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile adapter features/mcp-server/agent-grants.feature features/mcp-server/verdict-markers.feature
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile builtin features/mcp-server/agent-grants.feature features/mcp-server/verdict-markers.feature
        status: pass
    human_judgment: false
duration: 31 min
completed: 2026-11-13
status: complete
---

# Phase 03 Plan 02: Stored MCP Warning Migration Summary

**Exact warning generation translation and implementation-less grant migration now retain provenance and user edits.**

## Performance

- Started: 2026-11-13T15:48:07Z
- Completed: 2026-11-13T16:18:54Z
- Tasks: 3
- Production and test files modified: 8
- Measured realized patch: 36,305 characters, or 9,076 estimate-scale tokens

## Accomplishments

- Exact historical and corrected warning strings translate between adapter and built-in MCP while the fresh emitter remains unchanged.
- Implementation-less records with exact adapter warnings become migration candidates; truncated, case-changed, prefixed, and suffixed warnings do not.
- Full file and index assertions cover round trips, repeated loads, edited files, and existing containment, lock, staging, and index recovery behavior.
- Both MCP profiles pass the new migration scenarios alongside foreground refusal and child load protections.

## Task Commits

1. **Task 1: Translate exact stored warning generations** - bd672aa215bca535209abd5427450b8691a4b981
2. **Task 2: Recognize implementation-less records and protect edits** - 5b4be3ba84ed0297a6fed8cd47b250a05c655a19
3. **Task 3: Cover both MCP profiles through the command surface** - 2caae2fab46b4835cc6e0853894c9aa4bb4aa86b

All commits used normal hooks. RED was proven locally before GREEN for task 1 and task 2. For task 3, a temporary implementation-scope mutation made both implementation-less behavioral rows fail on the intended complete file assertion; restoring the production code made them pass. No failing RED commit was made because the required hook rejects failing tests.

## Validation

All passing results below are on Node v26.13.1. The final committed task tree is 2caae2fab46b4835cc6e0853894c9aa4bb4aa86b.

| Scope | Command | Result |
|---|---|---|
| Task 1 owners | node --import test/platform/isolated-pi-home.ts --test test/bridges/agents/mcp-async-warning.test.ts test/bridges/agents/legacy-grant-form.test.ts | Exit 0; 20 tests passed |
| Task 1 direct pairs | npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts; npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts | Both exit 0; 100% direct coverage |
| Task 2 owners | node --import test/platform/isolated-pi-home.ts --test test/bridges/agents/mcp-async-warning.test.ts test/bridges/agents/grant-rewrite.test.ts | Exit 0; 56 tests passed |
| Task 2 direct pairs | npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts; npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts | Both exit 0; 100% direct coverage |
| Adapter behavior, committed tree | npm run test:cucumber:profile -- --profile adapter features/mcp-server/agent-grants.feature features/mcp-server/verdict-markers.feature | Exit 0; 33 scenarios, 511 steps passed |
| Built-in behavior, committed tree | npm run test:cucumber:profile -- --profile builtin features/mcp-server/agent-grants.feature features/mcp-server/verdict-markers.feature | Exit 0; 24 scenarios, 382 steps passed |
| Feature structure | npm run check:features | Exit 0 |
| Changed-file audit | npx --no fallow audit --base 12a49b23c7d85e0b2d137cadd9f8bd69e734bdd1 | Exit 0; no issues in 8 changed files |
| Task commits | git commit with normal hooks | Exit 0 for each task; check:commit passed |

The plan's full npm run check is a **combined-tree wave gate** owned by the orchestrator after this worktree merges with its wave sibling. It was not run in this worktree and is not claimed as passing here. No test was skipped or timed out.

## Decisions Made

- Kept the current emitter text unchanged as required by D-PG3-03; plan 03-04 owns its current-output change.
- Used literal warning and frontmatter fixtures for behavioral migration so converter output cannot supply its own expected values.

## Deviations from Plan

The near-match control has its own fifth scenario rather than sharing a migration scenario. This keeps its no-rewrite assertion independent. No additional files or production scope were added.

## Issues Encountered

- The first task commit hook found a blank-line lint error; a subsequent attempt found an overlong commit body. Both were corrected, and the commit passed normally.
- The behavioral restart fixture assumed removing the adapter always left MCP inactive. The profile sometimes already ran built-in MCP, so the step now reads the active implementation before turning built-in MCP on. Both full profile commands passed afterward.
- The task 3 commit hook found nested-conditional and spacing lint errors. They were corrected before the passing normal-hook commit.
- Fallow's temporary comparison worktree could not be created under the default sandbox; the approved local git escalation let the audit complete with exit 0.

## Threat Flags

None -- no security-relevant surface outside the plan's threat model was introduced.

## Self-Check: PASSED

- All eight changed files exist; no file outside the declared task scope changed.
- All three exact task commits descend from the plan base on this agent branch.
- The required owner, direct coverage, both-profile Cucumber, feature, and changed-file audit checks passed.
- STATE.md, ROADMAP.md, and shared VALIDATION.md were not edited.

## Next Phase Readiness

Ready for plan 03-04 to change the fresh emitter with its current-output consumers. The parent must merge wave 1 and run the combined-tree npm run check gate before treating the wave as verified.
