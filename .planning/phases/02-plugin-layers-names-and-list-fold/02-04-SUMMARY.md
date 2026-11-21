---
phase: 02-plugin-layers-names-and-list-fold
plan: "04"
subsystem: testing
tags: [cucumber, list, orphan-fold, CMC-21, D-13-17, integration-rescope]

requires: []
provides:
  - "Two unfiltered list fold scenarios in features/plugin/list.feature (F01 fold, F03 same-name independent marketplace)"
  - "Deletion of test/integration/fold-adoption.test.ts, with its three citing comments pointed at the scenarios"
affects: [integration-rescope milestone audit, fallow audit weakened-tests]

actuals:
  tokens: 4956
  tasks: 3
  commits: 3
plan_head_before: 8cc0eee0711279faa80a36a577dcae7bde0a227d
plan_head_after: 5019c44fe2aa9fb4fae0f59e8d9e2d1e5ca2e52c

tech-stack:
  added: []
  patterns:
    - "Break helper takes its root from git rev-parse --show-toplevel, checks the old text occurs once before it sets the restore trap"

key-files:
  created: []
  modified:
    - features/plugin/list.feature
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
    - test/orchestrators/plugin/list-flow.test.ts
  deleted:
    - test/integration/fold-adoption.test.ts

key-decisions:
  - "F02 (two different marketplace names) not added: B6 and B7 fail it exactly as they fail F01, and B6b fails only F03"

patterns-established: []

requirements-completed: [ITMIG-04]

coverage:
  - id: D1
    description: "The unfiltered list shows a project install from a user-only marketplace as a project row under the user header (F01)"
    requirement: ITMIG-04
    verification:
      - kind: e2e
        ref: "features/plugin/list.feature:207 (adapter profile)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An independently added same-name project marketplace lists under its own header with no duplicate row (F03)"
    requirement: ITMIG-04
    verification:
      - kind: e2e
        ref: "features/plugin/list.feature:229 (adapter profile)"
        status: pass
    human_judgment: false
  - id: D3
    description: "test/integration/fold-adoption.test.ts deleted; no file outside .planning names it"
    requirement: ITMIG-04
    verification:
      - kind: other
        ref: "git grep -l 'fold-adoption' -- . ':(exclude).planning' exits 1"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-11-21
status: complete
---

# Phase 2 Plan 04: Unfiltered List Fold Scenarios Summary

**Two cucumber scenarios in `features/plugin/list.feature` now guard the CMC-21 / D-13-17 orphan fold of the unfiltered list. Breaks B6, B6b, and B7 fail them on assertions, and `test/integration/fold-adoption.test.ts` is deleted.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-11-21T18:16:59Z
- **Completed:** 2026-11-21T18:43:37Z
- **Tasks:** 3
- **Files modified:** 4 (one deleted)

## Accomplishments

- F01, "The unfiltered list shows a plugin the project installed from a user marketplace under that marketplace (CMC-21, D-13-17)", checks the whole envelope and both rows.
- F03, "The unfiltered list shows a project marketplace that shares a user marketplace's name but not its source under its own header with no duplicate row (CMC-21, D-13-17)", checks the whole envelope and both rows.
- The `computeOrphanFold` JSDoc and two comments of `test/orchestrators/plugin/list-flow.test.ts` cite the fold scenarios. The integration file is deleted in the same commit.

## Task Commits

1. **Task 1: Prove the fold loop end to end on the project install under a user marketplace** - `4c0db65` (test)
2. **Task 2: Add the same-name independent marketplace scenario and record breaks B6b, B7, and B6** - `b1e14ff` (test)
3. **Task 3: Point the fold comments at the scenarios, delete the integration file, and check the tree** - `5019c44` (test)

## Red proofs

- Scratch folder: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase02-plan04` (helper `break.sh`, verify scripts, and every log named below).
- Checkout root, the `root=` line of every break log: `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-adace63c3ac522cb7`.
- Green runs, adapter profile, `--parallel 1`:
  - `green-14-adapter.log`: `14 scenarios (14 passed)`, `159 steps (159 passed)`, `exit=0`. It ran once before the Task 1 commit and once more on `4c0db65` as the tracer gate. Both runs passed.
  - `green-15-adapter.log`: `15 scenarios (15 passed)`, `173 steps (173 passed)`, `exit=0`.
- Builtin run (`builtin.log`): `0 scenarios`, `0 steps`, `exit=0`. The builtin profile selects none of the scenarios of `list.feature` (DUAL-02).
- B6, Task 1 (`B6-tracer-adapter.log`), against 14 scenarios:
  - File and line: `extensions/pi-claude-marketplace/orchestrators/plugin/list-orphan-fold.ts:26`, in `isOrphanMarketplaceClone`.
  - Change: `-  return projectMarketplace.marketplaceRoot === userMarketplace.marketplaceRoot;` became `+  return projectMarketplace.marketplaceRoot === "never-a-root";`.
  - Command: `bash "$D/break.sh" B6-tracer adapter extensions/pi-claude-marketplace/orchestrators/plugin/list-orphan-fold.ts "$D/B6.old" "$D/B6.new" features/plugin/list.feature`.
  - Failed: F01 (`features/plugin/list.feature:207`). The failing step was `Then the result has these fields:` (`command.steps.ts:158`), with the error `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`. `tally success count` was `4`, but `2` was expected: the project install listed under its own `official [project]` block, with a second `beta` row. The rows step was skipped.
  - Passed: the 13 other scenarios of the file. Totals: `14 scenarios (13 passed, 1 failed)`, `exit=1`, `restored=clean`.
- B6b, Task 2 (`B6b-adapter.log`), against 15 scenarios:
  - File and line: same file and line as B6.
  - Change: `-  return projectMarketplace.marketplaceRoot === userMarketplace.marketplaceRoot;` became `+  return true;`.
  - Command: `bash $D/break.sh B6b adapter extensions/pi-claude-marketplace/orchestrators/plugin/list-orphan-fold.ts $D/B6b.old $D/B6b.new features/plugin/list.feature`.
  - Failed: F03 (`features/plugin/list.feature:229`). The failing step was `Then the result has these fields:`, with the error `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`. `tally success count` was `1`, but `2` was expected: the independent project record folded under the user header and replaced the user's available row.
  - Passed: F01 and the 13 existing scenarios. Totals: `15 scenarios (14 passed, 1 failed)`, `exit=1`, `restored=clean`.
- B7, Task 2 (`B7-adapter.log`), against 15 scenarios:
  - File and line: `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:756`.
  - Change: `-      excludeFromAvailable: foldedNames,` became `+      excludeFromAvailable: new Set<string>(),`.
  - Command: `bash $D/break.sh B7 adapter extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts $D/B7.old $D/B7.new features/plugin/list.feature`.
  - Failed: F01. The failing step was `Then the result has these fields:`, with the error `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`. `tally success count` was `3`, but `2` was expected: a duplicate `available` row of `alpha` appeared under the user header.
  - Passed: F03 and the 13 existing scenarios. Totals: `15 scenarios (14 passed, 1 failed)`, `exit=1`, `restored=clean`.
- B6, Task 2 (`B6-adapter.log`), against 15 scenarios:
  - Change and command: the same change as the Task 1 run, through `bash $D/break.sh B6 adapter ...`.
  - Failed: F01, at the same step, with the same error (`4` actual, `2` expected).
  - Passed: F03 and the 13 existing scenarios. Totals: `15 scenarios (14 passed, 1 failed)`, `exit=1`, `restored=clean`.
- No break log holds `function timed out`, and no run needed a rerun. After each break, `git status --porcelain -- extensions/` printed nothing: each log ends with `restored=clean`, and `verify-t1-b6.sh` and `verify-t2-breaks.sh` exited 0.

## Case map

| Integration case | Replaced by | Breaks that fail it |
| --- | --- | --- |
| Step 1: a project install from a user-only `official` folds under the user header with a `[project]` row | F01 (`list.feature:207`) | B6 (both runs), B7 |
| Step 2: an independent project marketplace lists under its own header with no duplicate row (two different names in the integration file) | F03 (`list.feature:229`), which uses the same name with a different source | B6b |

F02 has the integration step 2 shape, with two different names. It was not added. Research (`research-02/break-B6.log`, `break-B6b.log`, `break-B7.log`) showed that B6 and B7 fail it exactly as they fail F01, and that B6b fails only F03. So F02 catches no break that F01 and F03 miss (CONTEXT [List fold]).

## Checks

Node `v24.22.3` ran every check in this checkout.

| Check | Exit | Commit |
| --- | --- | --- |
| Green adapter run, 14 scenarios (`green-14-adapter.log`) | 0 | working tree on `8cc0eee`, then `4c0db65` (tracer rerun) |
| B6 tracer verify (`verify-t1-b6.sh`) | 0 | working tree on `8cc0eee` |
| Lone `npm run lint` warm-up (`lint-warm.log`) | 0 | working tree on `8cc0eee` |
| `check:static` (`check-static-1.log`) | 0 | working tree on `8cc0eee` (F01 added) |
| Task 1 tree verify (`verify-t1-tree.sh`) | 0 | `4c0db65` |
| Green adapter run, 15 scenarios (`green-15-adapter.log`) | 0 | working tree on `4c0db65` (F03 added) |
| Break verify for B6b, B7, B6 (`verify-t2-breaks.sh`) | 0 | working tree on `4c0db65` |
| `check:static` (`check-static-2.log`) | 0 | working tree on `4c0db65` |
| Direct coverage of the list-flow pair (`coverage-list-flow.log`) | 0 | working tree on `b1e14ff` (comments edited, file deleted) |
| `check:static` (`check-static-3.log`) | 0 | the same working tree |
| `fallow audit --base 8cc0eee` (`audit.json`, `audit-verify.log`) | 0 | `5019c44` |
| Builtin run (`builtin.log`) | 0 | `5019c44` |
| Final tree verify (`verify-t3-final.sh`) | 0 | `5019c44` |

Each commit ran pre-commit with `SKIP=npm-check` first, and each run exited 0. Each commit ran under `flock` with the hooks on. The commit hook skipped `npm run check:commit` with "no files to check" in this worktree, so the checks above ran by hand. The full verdict is the wave's post-merge `npm run check`.

## Issues for the milestone

`npx --no fallow audit --base 8cc0eee0711279faa80a36a577dcae7bde0a227d` gave the verdict `warn`. Its summary was `{"dead_code_issues":0,"dead_code_has_errors":false,"complexity_findings":0,"max_cyclomatic":null,"duplication_clone_groups":0}`, and it had one diff-risk finding, `weakened-tests:test/integration/fold-adoption.test.ts`, caused by the deleted test file. This finding is left to the milestone (user decision 2026-11-21). `.fallowrc.json` and the CI workflows are unchanged.

## Decisions Made

- F02 was not added (see Case map).
- The helper first checks that the old text occurs exactly once (step c) and only then sets the EXIT trap (step d) and writes the break. So a refused break exits 3 and changes nothing.

## Deviations from Plan

The observed values matched the plan. No scenario needed strengthening.

- The worktree sandbox refused compound shell commands that name `git`. So the verify commands with `git` ran as scripts under `$D` (`verify-t1-b6.sh`, `verify-t1-tree.sh`, `verify-t2-breaks.sh`, `verify-t3-audit.sh`, `verify-t3-final.sh`), and the commits ran through `$D/commit.sh`, which uses the same `flock ... git commit -F` line. The execution rules allow this. The commands inside the scripts are the plan's own text.

## Parent lines

- CHANGELOG.md: None. The change is test-only and has no user-visible effect.
- `.planning/BACKLOG.md`: None.
- Key Decisions: None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- `features/plugin/list.feature` holds both titles (`grep -c '(CMC-21, D-13-17)'` prints 2).
- `test/integration/fold-adoption.test.ts` does not exist.
- The commits `4c0db65`, `b1e14ff`, and `5019c44` are ancestors of HEAD.
- `git diff --name-only 8cc0eee b1e14ff -- extensions/` prints nothing, so no break reached a commit.
