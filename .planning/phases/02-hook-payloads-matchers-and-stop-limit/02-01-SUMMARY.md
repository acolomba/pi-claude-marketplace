---
phase: 02-hook-payloads-matchers-and-stop-limit
plan: "01"
subsystem: hooks
tags: [claude-hooks, tool-input, pi-tools, cucumber, privacy]
requires:
  - phase: 01-companion-floors-and-mcp-defaults
    provides: Hook dispatch, matcher identity, and mode-selected notification transport
provides:
  - Claude-shaped PreToolUse input for native Read, Write, Bash, and PowerShell calls
  - Validated whole-call reverse rewrites with untouched fallback and private notices
  - Real installed-hook Read, Write, Bash, predicate, and privacy scenarios
affects: [hook-payloads, hook-matchers, stop-limit]
actuals:
  tokens: 14215
  tasks: 3
  commits: 4
commits: 4
plan_head_before: d3c4e602b5a44201dcc29490d515f8b1ea7044d5
plan_head_after: 9fba4472dc6dbcbc9906ce2254e0e23af80bfd5b
tech-stack:
  added: []
  patterns:
    - Validate the complete Claude rewrite before replacing Pi input own keys.
    - Match native tool predicates on native fields, then translate hook stdin.
key-files:
  created: [extensions/pi-claude-marketplace/bridges/hooks/tool-input.ts]
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - features/hook/tool-use.feature
    - features/step_definitions/hook/tool-use.steps.ts
    - test/bridges/hooks/tool-input.test.ts
    - test/bridges/hooks/payloads/pre-tool-use.test.ts
    - test/bridges/hooks/event-adapters.test.ts
    - test/bridges/hooks/dispatch.test.ts
key-decisions:
  - PG-HOOK-01 remains open because this plan delivers only its first hook-input slice.
  - Rejected rewrites use the project's allowed ignored outcome vocabulary and retain the original call.
patterns-established:
  - Hook input validation finishes before any native input object property changes.
requirements-completed: []
requirements-covered: [PG-HOOK-01]
coverage:
  - id: D1
    description: A real Read hook receives Claude file_path and can redirect the native read with line options.
    requirement: PG-HOOK-01
    verification:
      - kind: e2e
        ref: "features/hook/tool-use.feature#A Read hook receives and rewrites a Claude file input"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/tool-input.test.ts#toHookToolInput and decodeHookToolInput"
        status: pass
    human_judgment: false
  - id: D2
    description: Real Write and Bash hooks change the bytes or command, while rejected options run the original call.
    requirement: PG-HOOK-01
    verification:
      - kind: e2e
        ref: "features/hook/tool-use.feature#A Write hook changes the bytes written to disk"
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#A Bash hook receives milliseconds and changes the command"
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#An unsupported rewrite runs the original whole call and shows a notice"
        status: pass
    human_judgment: false
  - id: D3
    description: PowerShell input and timeout translation pass pure codec tests.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: "test/bridges/hooks/tool-input.test.ts#powershell replacement"
        status: pass
    human_judgment: true
    rationale: PowerShell is unavailable here, so no real executable hook run was observed.
  - id: D4
    description: Native path conditions still select translated hooks; hostile or unrepresentable rewrites leave the call intact and notices hide values.
    requirement: PG-HOOK-01
    verification:
      - kind: e2e
        ref: "features/hook/tool-use.feature#A native path condition still selects a translated Read hook"
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#An unsupported rewrite notice hides argument values"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/event-adapters.test.ts#sends one private ignored-rewrite notice"
        status: pass
    human_judgment: false
duration: 85 min
completed: 2026-11-12
status: complete
---

# Phase 02 Plan 01: Hook Input Round Trip Summary

**Installed command hooks now receive Claude-shaped native tool inputs and can safely replace one Pi Read, Write, or shell call; unsupported rewrites retain the complete original call.**

## Performance

- **Duration:** 85 min, measured from worktree initialization to summary creation
- **Started:** 2026-11-12T21:34:44Z (worktree reflog)
- **Completed:** 2026-11-12T22:59:36Z
- **Tasks:** 3
- **Files modified:** 10, plus this summary
- **Node:** v26.13.0

## Accomplishments

- Mapped native Read and Write paths to normalized absolute `file_path`, and shell timeouts from Pi seconds to Claude milliseconds; validated reverse rewrites before replacing the native call.
- Proved real installed hooks redirect a Read, change Write bytes, change a Bash command, and preserve the whole original call when a rewrite cannot be represented.
- Kept native `if` matching and canonical MCP identity intact; notices expose only the tool and rejection category in exactly one mode-selected transport.
- Passed PowerShell forward and reverse codec cases, including timeout boundaries; the executable was unavailable for a live PowerShell run.

## Task Commits

| Task ID | Outcome | Commit |
| --- | --- | --- |
| 02-01-01 | Read tracer, codec consumers, real hook proof | `97b54f08166214d3ff452efb1eec08488d269292` |
| 02-01-02 | Write and shell codec with live scenarios | `a3ee93a2cfd320f8116b593dbc5c8eef26fa7972` |
| 02-01-03 | Native predicate, privacy, and hostile-input cases | `a937b4cb3595fd0930838edf81a34e896ea64b1b` |
| 02-01-03 corrective | Preserve malformed input diagnostics found by the full gate | `9fba4472dc6dbcbc9906ce2254e0e23af80bfd5b` |

## Verification

- Task 1's four owner modules and real Read scenario passed. The new codec and adapter had 100% direct coverage.
- Task 2's codec direct coverage passed; the adapter hook feature passed 26 scenarios and 370 steps, including real Write, Bash, and whole-call fallback.
- Task 3's three owner modules passed; its two named live scenarios passed 33 steps in 20.337 seconds. Direct coverage passed for the codec, adapter, and dispatch owners.
- After the corrective commit, `test/bridges/hooks/dispatch-exec.test.ts` and direct coverage for `dispatch-exec.ts`, `pre-tool-use.ts`, and `tool-input.ts` passed. The previously waiting malformed-envelope case passed by name.
- **Required gate:** `npm run check` at `9fba4472dc6dbcbc9906ce2254e0e23af80bfd5b` exited 0 on Node v26.13.0. Static, unpaired unit, integration, adapter Cucumber (1,818 scenarios, 22,018 steps), builtin Cucumber (155 scenarios, 2,091 steps), and all-pair direct coverage (355 LCOV records) passed. The two complete Cucumber profiles took 5m 38.351s and 59.801s respectively.
- `npx --no fallow audit --base d3c4e602b5a44201dcc29490d515f8b1ea7044d5` exited 0 with no issues in the 10 changed files. Each of the four commits ran normal hooks; none skipped verification.

## Decisions Made

- PG-HOOK-01 is **not marked complete**. This plan covers its first input and rewrite slice; later phase plans own the remaining hook payload, matcher, and stop-limit work.
- The architecture guard forbids an `unsupported` status literal in source and tests. The decoder uses `ignored` for that rejection while preserving the plan's no-partial-mutation behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a real project-file fixture step**
- **Found during:** Task 02-01-01
- **Issue:** The scripted model needed actual files to prove the translated Read affected Pi's result.
- **Fix:** Added one project-file Given step in `features/step_definitions/hook/tool-use.steps.ts` and used it in the live scenarios.
- **Verification:** Named Read scenario and full adapter profile passed.
- **Committed in:** `97b54f08166214d3ff452efb1eec08488d269292`

**2. [Rule 1 - Bug] Retained malformed input diagnostics**
- **Found during:** Full `npm run check` after Task 02-01-03
- **Issue:** An omitted `PreToolUse.input` made the new forward translator throw before the hook process spawned, leaving an existing dispatch-exec test waiting.
- **Fix:** Passed non-record runtime inputs through the codec to the existing required-field diagnostic; added malformed-input owner cases.
- **Files modified:** `tool-input.ts`, its owner test, and the `pre-tool-use.ts` explanation.
- **Verification:** Named malformed-envelope test, full dispatch-exec owner, its direct coverage, and the final `npm run check` passed.
- **Committed in:** `9fba4472dc6dbcbc9906ce2254e0e23af80bfd5b`

**Total deviations:** 2 auto-fixed (1 blocking fixture, 1 bug). **Impact:** Both were needed to prove or preserve the requested behavior; no extra feature surface was added.

## Issues Encountered

- The first full gate was interrupted after the `dispatch-exec` direct coverage pair waited indefinitely. The focused test showed the omitted-input case was the cause; the corrective commit resolved it, and the complete rerun exited 0.
- Initial task-commit hook attempts surfaced style, type, and architecture vocabulary errors. They were fixed and all four final commits passed normal hooks.
- The optional-peer cache used by Cucumber was copied from the parent checkout into the ignored local cache. No package upgrade or repository dependency change was made.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Ready for plan 02-02 and the parent's combined-tree post-merge gate. PG-HOOK-01 remains open.

## Self-Check: PASSED

All 10 changed files and this summary exist. All four production commits are ancestors of HEAD; the task acceptance checks, named scenarios, and final full gate passed. No shared orchestration artifact was modified.
