---
phase: 04-dependency-resolver-residue
plan: 03
subsystem: plugin-lifecycle
tags: [dependency-plan, redaction, apply, resolver-completeness]
status: complete

requires:
  - "04-01 (wave ordering only; no shared file)"
provides:
  - "unmovable reduces each absolute path in the judge's cause to its basename (D-PL4-07)"
  - "dependency-plan.ts header records D-PL4-02 (apply previews every fresh dependency) and D-PL4-03 (greedy, incomplete search)"
  - "dependency-plan.test.ts: judge `refusalCause` and keyed `contradiction` in the fake world"
affects: [cascade constraint rows for a dependency that cannot move]

actuals:
  tokens: 2279
  tasks: 2
  commits: 2
plan_head_before: 00bbd766ec122039c0e984fa1a42775ff35e07e5
plan_head_after: 0a2a3c684c6eed5654c924a0c6e711d9d11ef4df

tech-stack:
  added: []
  patterns:
    - "A user-visible move refusal passes through redactAbsolutePaths wherever it is built"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts
    - test/orchestrators/plugin/dependency-plan.test.ts

key-decisions:
  - "D-PL4-02: under apply the plan keeps previewing every fresh dependency, so one that only a move reaches refuses the root before any move lands (no behavior change; header + test)"
  - "D-PL4-03: the plan search stays greedy with permanent rule-outs; a graph only an untried pair of versions solves is refused, as Claude Code's one-pass resolver refuses it"
  - "D-PL4-07: unmovable redacts the judge's cause, matching the swap's failed-move row (T-55-02-02)"

patterns-established: []

requirements-completed: [RSV-02, RSV-03, RSV-04]

metrics:
  completed: 2026-10-26
---

# Phase 4 Plan 03: Dependency plan decisions Summary

The plan's move refusal now shows file names instead of absolute paths, as the swap's failed-move row does (D-PL4-07). The header of `dependency-plan.ts` records D-PL4-02 and D-PL4-03, and one test case pins each.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 (tracer) | b3522d7b | fix(plugin): show a dependency move refusal's paths as file names |
| 2 | 0a2a3c68 | test(plugin): pin the dependency plan's apply refusal and search limit |

## What changed

- `dependency-plan.ts`: `unmovable` sets `moveRefusal: redactAbsolutePaths(cause)`, imported from `shared/redact-absolute-paths.ts`, with a comment citing D-PL4-07 and T-55-02-02. Two header paragraphs follow the WR-1 paragraph: D-PL4-03 (the search is not complete) and D-PL4-02 (every fresh plugin is previewed under `deferMoveDependencies`). No other executable line changed.
- `dependency-plan.test.ts`:
  - The `ports` world takes an optional `refusalCause`. The judge falls back to the old fixed text, so existing cases keep their cause.
  - `contradiction` takes an optional failing key, which defaults to `"fff@mp"`.
  - New case "D-PL4-07: a move refusal reads with each absolute path reduced to its file name". The expected text is written as a literal.
  - New case "D-PL4-02: a deferring plan refuses a fresh dependency only a move reaches when its preview refuses". It uses the two MISS-01 walks, and `fff@mp`'s preview rejects. The expected result is a `member` refusal with `rollbackPartials: []`, and the previews are exactly `["fff@mp"]`.
  - New case "D-PL4-03: refuses a graph only an untried pair of versions solves...". It expects the four walk signatures and the six judge calls from the 04-RESEARCH trace, no previews, and round 4's conflict (`ccc@mp`) as the refusal. Rounds 2 and 3 fail on `eee@mp` and `ddd@mp`, so the case shows that the last conflict wins. The solvable walk `aaa@mp=3.0.0,bbb@mp=2.0.0` is scripted but never walked.

## Verification

- RED for Task 1: with only the test in place, the D-PL4-07 case failed because `moveRefusal` still held `/scope/.pi/agents/pi-claude-marketplace-lib-helper.md`. After the fix it passed.
- `node --test test/orchestrators/plugin/dependency-plan.test.ts`: 22/22 passed after Task 1 and 24/24 after Task 2. The measured D-PL4-03 trace matched the research trace on the first run.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts` exited 0 after each task.
- Both commits passed the commit hook (`npm run check:commit` Passed, gitlint, prettier, TruffleHog).
- Acceptance greps: `moveRefusal: redactAbsolutePaths(cause)` appears 1 time in the source. `D-PL4-07` appears 1 time in the test. `D-PL4-02` and `D-PL4-03` each appear 1 time in the source. The test names D-PL4-02 or D-PL4-03 on 2 lines.
- The full `npm run check` was not run, as the dispatch said. The phase gate runs in plan 04-06.

## Deviations from Plan

- **Style: a renamed local.** The plan names the D-PL4-03 requesters `R`. The typescript-style rules say a function-local is `lowerCamelCase` and short names are only for scopes of ten lines or fewer, so the local is `appAsksAtLeast2`. The values are the same.
- **Commit title length.** The plan's example title for Task 2 has 74 characters, and gitlint failed the first attempt (the limit is 72). The title was shortened to `test(plugin): pin the dependency plan's apply refusal and search limit`, and the commit was made again, with no `--amend` and no `--no-verify`.
- The D-PL4-07 comment in `unmovable` takes two lines, not one, to stay inside the print width.

No file outside the plan's `files_modified` was touched.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: b3522d7b, 0a2a3c68 (both ancestors of HEAD)
- FOUND: both modified files
