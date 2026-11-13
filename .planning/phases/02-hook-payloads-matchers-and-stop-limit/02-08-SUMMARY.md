---
phase: 02-hook-payloads-matchers-and-stop-limit
plan: "08"
subsystem: hooks
tags: [matchers, regex, routing, cucumber]
requires:
  - phase: 02-hook-payloads-matchers-and-stop-limit
    provides: Native built-in hook event view and tool-name recovery from plan 02-01
provides:
  - Exact comma and pipe matcher lists with deduplicated tool names
  - Compiled JavaScript regex matching against recovered Claude tool names
  - Matcher-independent UserPromptSubmit and Stop admission and routing
  - Installed-hook behavioral evidence across info, execution, and reload
affects: [hook-routing, plugin-info, PG-HOOK-03]
actuals:
  tokens: 15541
  tasks: 3
  commits: 4
commits: 4
plan_head_before: d97fb5eb9c9e76c2832064b681c91212f0b80bdd
plan_head_after: aea81984b158d00c9f4551220c7add6f27d3ecd9
tech-stack:
  added: []
  patterns:
    - Compile non-list matcher text once during routing construction with native RegExp.
    - Preserve raw matchers for plugin info while storing match-all routing for prompt and Stop.
key-files:
  created:
    - features/hook/matchers.feature
  modified:
    - extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
    - extensions/pi-claude-marketplace/domain/components/hooks/partition.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
key-decisions:
  - "Use one unanchored, case-sensitive native JavaScript RegExp for every non-list matcher."
  - "Ignore UserPromptSubmit and Stop matcher text before validation while preserving its raw info value."
patterns-established:
  - "Admission and runtime share parsed matcher states, including an explicit invalid-pattern state."
requirements-completed: [PG-HOOK-03]
coverage:
  - id: D1
    description: Exact comma and pipe lists select each named installed tool once.
    requirement: PG-HOOK-03
    verification:
      - kind: e2e
        ref: "features/hook/matchers.feature#A spaced comma or pipe matcher selects its exact tools"
        status: pass
      - kind: unit
        ref: "test/domain/components/hooks/matcher.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: Valid whole-pattern regexes execute on Claude tool names and invalid regexes drop only their groups.
    requirement: PG-HOOK-03
    verification:
      - kind: e2e
        ref: "features/hook/matchers.feature#A valid regex group installs as supported and selects Claude tool names"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/dispatch.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: Prompt and Stop hooks run with invalid matcher text without partial installation.
    requirement: PG-HOOK-03
    verification:
      - kind: e2e
        ref: "features/hook/matchers.feature#Prompt and Stop hooks ignore even invalid matchers"
        status: pass
      - kind: unit
        ref: "test/domain/components/hooks/partition.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: Reload activates an installed regex hook from persisted configuration.
    requirement: PG-HOOK-03
    verification:
      - kind: e2e
        ref: "features/hook/matchers.feature#An installed regex hook becomes active after reload"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/event-router.test.ts"
        status: pass
    human_judgment: false
duration: 41min
completed: 2026-11-13
status: complete
---

# Phase 02 Plan 08: Hook Matcher Semantics Summary

**Installed hooks now apply exact tool lists and whole-pattern JavaScript regexes consistently across plugin info, dispatch, and reload; prompt and Stop hooks ignore matcher text.**

## Performance

- **Duration:** 41 min
- **Started:** 2026-11-12T23:22:32Z
- **Completed:** 2026-11-13T00:03:13Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Exact comma and pipe lists trim surrounding ASCII spaces, discard empty alternatives, deduplicate names, and select all four named tools through installed command hooks.
- Non-list patterns compile once as unanchored, case-sensitive native JavaScript regexes; valid groups report supported and execute against recovered Claude-form names, while syntax failures drop only their own group.
- UserPromptSubmit and Stop ignore even malformed matcher text before admission and routing; a persisted regex hook becomes active after `/reload`.

## Task Commits

| Task ID | Work | Commit |
| --- | --- | --- |
| 02-08-01 | Parse and execute exact lists | `723b07b4c2bf1f9741f2c1e4bf21406e564776df` |
| 02-08-02 | Admit and execute whole-pattern regexes | `defaf7f8b6da0ab558f4f4cf1b0fb5a1af4785ed` |
| 02-08-03 | Ignore prompt and Stop matchers before admission and after reload | `34d04ed5deda2845b298440e9ec924c3427656c3` |
| 02-08-01 follow-up | Record Read, Write, Edit, and Bash stdin in the installed-hook scenario | `aea81984b158d00c9f4551220c7add6f27d3ecd9` |

## Files Created or Modified

- `extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts`, `partition.ts`: exact-list and compiled-regex states with event-aware admission.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`, `event-router.ts`: Claude-form regex dispatch and matcher-independent prompt/Stop routing.
- `features/hook/matchers.feature`: seven real install, info, execution, and reload scenarios.
- Paired owner tests for the four source modules and hooks facade, plus directly affected resolver and orchestrator tests and one fixture.

## Verification

- Focused owner suites passed for matcher, partition, dispatch, event router, hooks facade, hooks resolution, plugin resolver, plugin info, and install flow.
- Direct coverage passed for each changed source and each directly affected owner pair, including matcher, partition, dispatch, event router, and the resolver and orchestrator pairs.
- `npm run test:cucumber:profile -- --profile adapter features/hook/matchers.feature` passed: 7 scenarios, 99 steps, 32 real command-hook runs.
- Each task commit and the focused behavioral follow-up passed normal pre-commit hooks, including `npm run check:commit` when applicable. Fallow audits exited successfully with zero dead-code, complexity, or duplication findings.
- The combined-tree `npm run check` gate belongs to the parent after both Wave 2 plans merge, as the plan assigns.

## Decisions Made

- Native `RegExp` uses no added flags, anchors, normalization, engine, or timeout setting, matching D-PG2-10.
- Prompt and Stop retain their raw matcher for information display, but route as match-all because matcher text has no effect on those events.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Regression] Updated fixtures that treated valid regexes as unsupported**

- **Found during:** Task 02-08-02 normal commit hook.
- **Issue:** Existing resolution, plugin info, and install-flow fixtures used `.*` as an unsupported matcher; the newly accepted regex contract made their old expectations fail.
- **Fix:** Replaced those test-only unsupported examples with malformed regexes in the directly affected owners and fixture, preserving their unsupported-group assertions.
- **Files modified:** `test/domain/hooks-resolution.test.ts`, `test/domain/plugin-resolver.test.ts`, `test/fixtures/hooks-pretooluse-matcher-mix.json`, `test/orchestrators/plugin/info.test.ts`, `test/orchestrators/plugin/install-flow-ledger.test.ts`.
- **Verification:** Focused owner tests, direct coverage, and the retried normal commit hook passed.
- **Commit:** `defaf7f8b6da0ab558f4f4cf1b0fb5a1af4785ed`.

**2. [Rule 2 - Missing evidence] Exercised every named exact-list tool through installed hooks**

- **Found during:** Final review after Task 02-08-03.
- **Issue:** The initial exact-list scenario recorded only Bash, leaving Edit, Write, and Read without end-to-end stdin evidence.
- **Fix:** Extended the existing scenario with all four model tool calls and the full plugin info record.
- **Files modified:** `features/hook/matchers.feature`.
- **Verification:** The focused scenario and complete matcher feature passed with exact command-hook rows.
- **Commit:** `aea81984b158d00c9f4551220c7add6f27d3ecd9`.

**Total deviations:** 2 auto-fixed. **Impact:** Directly caused fixture repairs and complete behavioral evidence; no sibling-owned files changed.

## Issues Encountered

- The first Task 02-08-01 commit attempt failed gitlint on an overlong body line; the same verified change was committed with a concise subject and normal hooks.
- The first Task 02-08-02 commit attempt exposed stale unsupported-regex fixtures; the corrected commit passed normal hooks.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. Native JavaScript regexes can still be computationally expensive; this is the documented residual of D-PG2-10 after compile-once routing and syntax rejection.

## Self-Check: PASSED

All three task commits and the focused follow-up are ancestors of the current head; the key source and behavioral files exist, the worktree was clean before this summary, and the final matcher feature passed.

## Next Phase Readiness

Plan 02-08 is complete. The parent can merge both Wave 2 plans and run the assigned combined-tree `npm run check` gate. PG-HOOK-01 remains a separate phase requirement and was not marked complete here.

---
*Phase: 02-hook-payloads-matchers-and-stop-limit*
*Completed: 2026-11-13*
