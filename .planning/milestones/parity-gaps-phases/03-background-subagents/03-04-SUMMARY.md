---
phase: 03-background-subagents
plan: "04"
subsystem: agents
tags: [mcp, warnings, grants, cucumber]
requires:
  - phase: 03-background-subagents
    provides: Exact historical and corrected stored-warning recognition from plan 03-02
provides:
  - Corrected background warning for freshly converted adapter and builtin MCP agents
  - Complete staged grant, install diagnostic, and public result expectations
affects: [03-07, 03-08]
actuals:
  tokens: 5268
  tasks: 2
  commits: 2
plan_head_before: ea93edcbe2b13faa661cf502674035005cf5b8cf
plan_head_after: 795a41279a412d74c142e0a263564a03c2017d4b
tech-stack:
  added: []
  patterns:
    - Fresh warning assertions use independent corrected literals; stored migration keeps finite historical literals.
key-files:
  created:
    - .planning/phases/03-background-subagents/03-04-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts
    - test/bridges/agents/mcp-async-warning.test.ts
    - test/bridges/agents/convert.test.ts
    - test/bridges/agents/stage.test.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/bridges/agents/grant-forms.test.ts
    - features/mcp-server/verdict-markers.feature
    - features/mcp-server/agent-grants.feature
key-decisions:
  - Retain historical warning values solely for exact stored-warning recognition and migration.
  - Keep the agent-grants migration fixtures historical while correcting its fresh-install assertion.
patterns-established:
  - Current generated-output owners assert the complete corrected warning without calling the emitter for expected text.
requirements-completed: [PG-AGENT-01]
coverage:
  - id: D1
    description: Fresh adapter and builtin conversion, staging, and install emit the corrected complete warning once.
    requirement: PG-AGENT-01
    verification:
      - kind: unit
        ref: node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/mcp-async-warning.test.ts test/bridges/agents/convert.test.ts test/bridges/agents/stage.test.ts test/orchestrators/plugin/install-outcome.test.ts
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Complete grant forms and public diagnostics contain corrected wording while stored migration and user edits remain protected.
    requirement: PG-AGENT-01
    verification:
      - kind: unit
        ref: node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/grant-forms.test.ts
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile adapter features/mcp-server/agent-grants.feature features/mcp-server/verdict-markers.feature
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile builtin features/mcp-server/agent-grants.feature features/mcp-server/verdict-markers.feature
        status: pass
    human_judgment: false
duration: "under 22 min from the base commit; start was not instrumented"
completed: 2026-11-13
status: complete
---

# Phase 03 Plan 04: Fresh MCP Background Warning Summary

**Fresh MCP agents now explain that their tools require a pi-subagents background child while retaining each implementation's exact readiness warning.**

## Performance

- Started: After base commit at 2026-11-13T17:09:19Z; execution start was not captured.
- Completed: 2026-11-13T17:30:28Z.
- Tasks: 2.
- Production and test files modified: 8.
- Measured patch: 21,071 characters / 4 = 5,268 estimate-scale tokens.

## Accomplishments

- Fresh adapter and builtin conversion emits the corrected lead with the original implementation-specific readiness suffix.
- Staged agent files, stored grant forms, install warnings, and public diagnostics assert the complete current wording and retain unrelated messages and warning counts.
- Historical and corrected stored warnings still translate by exact generation; both MCP profiles pass migration and user-edit protection scenarios.

## Task Commits

1. **Task 1: Emit the corrected warning through fresh conversion, staging and install** - 5df645cbbcf690f1808d14286d0476d7bdc6cb84
2. **Task 2: Update grant-form and public diagnostic contracts** - 795a41279a412d74c142e0a263564a03c2017d4b

The two task commits descend from `ea93edcbe2b13faa661cf502674035005cf5b8cf`; `git rev-list --count ea93edcbe2b13faa661cf502674035005cf5b8cf..795a41279a412d74c142e0a263564a03c2017d4b` returned 2. Normal commit hooks passed on both commits.

## Validation

| Scope | Command | Result |
|---|---|---|
| Task 1 RED | Direct execution of `test/bridges/agents/convert.test.ts` with its corrected expected literal before the producer changed | Exit 1; complete generated-file assertion showed old actual versus corrected expected. No failing commit was made because normal hooks are mandatory. |
| Task 1 owners | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/mcp-async-warning.test.ts test/bridges/agents/convert.test.ts test/bridges/agents/stage.test.ts test/orchestrators/plugin/install-outcome.test.ts` | Exit 0; 4 modules passed. |
| Stored migration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/legacy-grant-form.test.ts test/bridges/agents/grant-rewrite.test.ts` | Exit 0; 2 modules passed. |
| Task 2 RED | `node --import "$PWD/test/platform/isolated-pi-home.ts" test/bridges/agents/grant-forms.test.ts` before updating expectations | Exit 1; generated grant assertions failed on old expected text; complete output saved at `/tmp/pg3-04-task2-red.log`. |
| Task 2 owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/agents/grant-forms.test.ts` | Exit 0; owner passed. |
| Adapter behavior | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/agent-grants.feature features/mcp-server/verdict-markers.feature` | Exit 0; 33 scenarios, 511 steps passed. |
| Builtin behavior | `npm run test:cucumber:profile -- --profile builtin features/mcp-server/agent-grants.feature features/mcp-server/verdict-markers.feature` | Exit 0; 24 scenarios, 382 steps passed. |
| Direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts` | Exit 0; direct pair coverage gate passed. |
| Audit | `npx --no fallow audit --base ea93edcbe2b13faa661cf502674035005cf5b8cf` | Exit 0; no issues in 8 changed files. |

All passing commands above ran on Node v26.13.1 in this plan worktree; the final task tree is `795a41279a412d74c142e0a263564a03c2017d4b`. The first adapter run exited 1 on the omitted fresh-output row in `agent-grants.feature`; the corrected rerun exited 0. The full `npm run check` combined-tree wave gate is **pending** after the orchestrator merges this worktree with its wave sibling. It was not run or claimed here.

## Deviations from Plan

**[Rule 1 - Missing current expectation] Updated the fresh-install assertion in `features/mcp-server/agent-grants.feature`.** Found during Task 2's adapter-profile run. The plan listed `verdict-markers.feature` but the existing agent-grants scenario also asserted the historical wording for a newly installed agent. Changed that one current-emission line; preserved the historical and corrected stored-warning switch fixtures and edited-file scenarios. Both profile commands passed after the correction. Committed in `795a41279a412d74c142e0a263564a03c2017d4b`.

**Total deviations:** 1 auto-fixed missing current-output expectation. **Impact:** One additional feature file changed; no behavior or migration fixture was weakened.

## Issues Encountered

- The sandbox could not write Git's worktree metadata or create Fallow's temporary audit worktree. Approved escalation was used for those Git operations; commits and audit then passed.
- `gsd_run` is not installed as a shell command in this executor environment. Commit and self-check evidence were obtained directly from Git.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

The source, test, and feature files exist; both task SHAs are ancestors of HEAD; the required owner and both-profile commands passed. The combined-tree wave gate remains with the orchestrator.

## Next Phase Readiness

Ready for the orchestrator to merge wave 2 and run `npm run check` on the combined tree. No manual verification or external setup is needed.
