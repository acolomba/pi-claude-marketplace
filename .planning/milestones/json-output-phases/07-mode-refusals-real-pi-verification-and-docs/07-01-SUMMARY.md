---
phase: 07-mode-refusals-real-pi-verification-and-docs
plan: "01"
subsystem: command-output
tags: [browse, mode-admission, notifications, json, rpc, print]
requires:
  - phase: 06-command-run-contract
    provides: Command identity, invocation IDs, and outcome finalization
provides:
  - Exact non-tui browse refusals through the existing dispatcher
  - JSON/RPC usage help and print refusal without trailing help or separators
  - Registered explicit, implicit, and repeated browse outcome coverage
affects: [07-04, 07-05, 07-06]
tech-stack:
  added: []
  patterns: [Existing usage-error payload and mode-selected transport]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - tests/edge/handlers/plugin/browse.test.ts
    - tests/edge/register.test.ts
    - tests/shared/notification-grammar.test.ts
key-decisions:
  - Retain the required usage string; print supplies an empty string.
  - Remove the unused list dependency from browse and its composition call.
requirements-completed: [MODE-03]
actuals:
  tokens: 3790
  tasks: 2
  commits: 2
plan_head_before: 763dc5b9a92c908c73bf2e9ce887160625e00907
plan_head_after: 27821c41c3ac0be1ef0e92dc8561a1801dbd60f6
coverage:
  - id: D1
    description: JSON/RPC browse refuses before state or picker access with one schema-valid outcome per invocation.
    requirement: MODE-03
    verification:
      - kind: unit
        ref: tests/edge/handlers/plugin/browse.test.ts
        status: pass
      - kind: unit
        ref: tests/edge/register.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Print refusal has no appended help; nonempty usage and frozen catalog bytes remain intact.
    requirement: MODE-03
    verification:
      - kind: unit
        ref: tests/shared/notification-grammar.test.ts
        status: pass
      - kind: unit
        ref: tests/edge/handlers/plugin/browse.test.ts
        status: pass
      - kind: other
        ref: tests/architecture/catalog-uat/catalog-contract.test.ts
        status: pass
    human_judgment: false
duration: 15min
completed: 2026-10-10
status: complete
---

# Phase 7 Plan 1: Browse Mode Refusals Summary

**Browse refuses json, rpc, and print with the exact mode and list remedy; machine outcomes retain usage help and distinct invocation IDs.**

## Performance

- Started: 2026-10-10T02:06:53Z
- Completed: 2026-10-10T02:21:00Z
- Tasks: 2
- Source/test files modified: 8
- Runtime: Node v26.11.1
- Actual tokens: ceiling of 15,157 characters / 4 in the realized task diff.
- Actual commits: measured from the persisted plan ledger before this metadata commit.

## Accomplishments

- All three non-tui modes return the exact approved refusal through `notifyUsageError`.
- JSON/RPC preserve `Usage: /claude:plugin browse`, error severity, `needsReload: false`, and `plugin browse` identity. Explicit, empty, and whitespace-only arguments each run twice with independently asserted invocation IDs and exactly one outcome per call.
- Strict owner mocks reject action, state, and picker access on refusal. Registered tests retain the throwing UI getter and call `capture.assertValid()` after awaiting both commands.
- Print emits only the error and remedy. Empty usage adds no separator; nonempty usage keeps its two-newline rendering. The wire schema still requires usage.
- Existing tui picker, invalid-argument, corrupt-state, list/ls, and strict unknown-mode cases pass. Existing text-emitting cases retain their file ownership.

## Task Commits

1. **Registered JSON/RPC refusal:** `5fbbd467` — `fix: refuse browse in machine modes`
2. **Print and implicit/repeated preservation:** `27821c41` — `fix: keep print browse refusal focused`

Both commits passed Fallow audit against HEAD, explicit-file fixers, and normal `npm run check:commit` hooks. Fixer changes were restaged before retry. No hooks were bypassed.

## Verification

All commands ran in the pinned executor worktree with Node v26.11.1. Node subprocesses and Git metadata access required sandbox escalation; no automatic approval rejection occurred.

| Command | Exit | Result | Head |
| --- | --- | --- | --- |
| `node --test tests/edge/handlers/plugin/browse.test.ts tests/edge/register.test.ts` | 0 | 274 passed, zero skips; committed tracer recheck | `5fbbd467` |
| `node --test tests/shared/notification-grammar.test.ts tests/edge/handlers/plugin/browse.test.ts tests/edge/register.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | 0 | 423 passed, zero skips; catalog 260 states / 39,143 output bytes | `27821c41` |
| `node --test tests/edge/register.test.ts tests/edge/command-run.test.ts tests/shared/notification-dispatch.test.ts` | 0 | 701 passed, zero skips | `27821c41` |
| `npm run check:commit` via each commit hook | 0 | Static checks, unpaired tests, and staged-pair direct coverage passed | Both task commits |
| `node_modules/.bin/fallow audit --base HEAD` before each commit | 0 | No issues in changed files | Pre-commit task trees |

Final clean-head logs: `/tmp/p07-01-final-task.log` and `/tmp/p07-01-final-regression.log`. Commit logs: `/tmp/p07-01-task1-commit.log` and `/tmp/p07-01-task2-commit.log`.

The parent owns `npm run check` on the combined wave/phase tree and the final strict corpus gate. These checks are not claimed here.

## RED Observations

- Task 1: the TAP run exited 1 with 266 passing and eight failing tests. The registered explicit JSON target failed its full payload assertion: list delegation read `cwd` and produced an internal error instead of the requested usage-error. Direct owner mocks also rejected the list call. The unchanged report passed `tdd-red-evidence` with `RED_EVIDENCE_OK`.
- Task 2: after correcting the print mock's mode-read count, the TAP run exited 1 with 420 passing and three failing tests. Print appended usage help, and the grammar appended two newlines to empty usage. The target `formatRawSurface emits only the refusal when usage is empty` failed on exactly those trailing bytes and passed the evidence classifier.
- Evidence records reside in ignored `node_modules/.cache/gsd/p07-01-red.json` and `p07-01-red2.json`; unchanged reports are `/tmp/p07-01-task1-red.tap` and `/tmp/p07-01-task2-red.tap`.
- As explicitly required by the plan, RED was observed locally and passing implementation plus owner tests were committed together. This is an execute plan with `tdd_mode: false`; no failing-test commit or separate refactor commit was made.

## Corpus Contribution for Closeout

Exactly one new text-emitting refusal case was added:

- File: `tests/edge/handlers/plugin/browse.test.ts`
- Test: `refuses browse in print with only the error and remedy before state or picker access`
- Expected new tuple multiplicity: 1 per unit-suite capture.

```json
{"file":"tests/edge/handlers/plugin/browse.test.ts","message":"Browse is unavailable in print mode. Use /claude:plugin list instead.","severity":"error","argc":2}
```

The grammar cases are pure and do not notify. Registered refusal cases use machine transport. No baseline, metadata, or catalog file was amended. Plan 07-06 must confirm actual captured multiplicity and preservation of all 3,149 prior tuples before writing its additions ledger.

## Deviations from Plan

**[Rule 2 - Missing Critical] Remove obsolete dependency and update affected contract comments.** Removing delegation left the browse `list` dependency unused. Its interface member, test setup, and composition argument in `edge/register.ts` were removed in `5fbbd467`. In `27821c41`, router comments now describe refusal, and the dispatch comment qualifies the separator rule for nonempty usage. These three additional source-file edits keep the changed behavior and its documented contract consistent. Their owner coverage passed through the staged hooks.

Implicit browse assertions moved with the machine table split in task 1; task 2 expanded those cases to repeated invocations. No behavior or preservation requirement was omitted.

## Issues Encountered

- Sandboxed Node runs initially failed before test execution; escalated runs provided real test evidence.
- The first task's initial commit attempt failed on one import-order lint error. The import was corrected, audited, and committed successfully on retry.
- One task-2 print mock initially allowed too few mode reads. It was corrected before the accepted RED run.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-07-01 is covered by strict no-state/no-action refusal tests and existing argument validation; T-07-02 by full schema-valid outcomes and repeated invocation IDs. No package acquisition occurred (T-07-SC).

## Known Stubs

None. No new skipped tests, TODOs, placeholder implementations, or unrun task verification commands remain.

## User Setup Required

None.

## Next Phase Readiness

Ready for the parent's combined-tree gate and the guide/closeout plans. Shared STATE, state.json, ROADMAP, config, and requirement tracking were left to the parent. The corpus addition above is supplied for 07-06; this plan does not claim final corpus reconciliation or real-Pi runtime verification.

## Self-Check: PASSED

The summary and changed deliverables exist. Both task commits are ancestors of HEAD. The final committed code passes both required verification commands, and the diff whitespace check is clean.
