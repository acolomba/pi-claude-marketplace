---
phase: 261003-w7b
plan: 01
subsystem: tooling/checks
tags: [pre-commit, check-changed, node-test, fallow, performance]
status: complete
requires: []
provides:
  - Per-file targeted selection in scripts/check-changed.mjs (DATA_READERS, rule union)
  - Cross-worktree full-run lock and JSONL run log (acquireFullLock, appendRunLog)
  - Failure-focused node:test reporter (scripts/test-reporter.mjs) and its control
  - Quiet fallow gates
affects: [pre-commit npm-check-changed hook, npm run check, CI check job output]
tech-stack:
  added: []
  patterns:
    - mkdir lock on node:fs with dead-pid and age recovery
    - custom node:test reporter that pipes selected events through node:test/reporters spec
key-files:
  created:
    - scripts/test-reporter.mjs
    - scripts/test-reporter.negative.mjs
  modified:
    - scripts/check-changed.mjs
    - scripts/check-changed.negative.mjs
    - scripts/test-coverage-direct.mjs
    - package.json
    - tests/architecture/import-boundaries.test.ts
    - AGENTS.md
    - CONTRIBUTING.md
    - skills/local-verification/SKILL.md
decisions:
  - "The whole-tree fallow cycle run carries --no-cache: the two dead-code runs share one graph cache and evict each other, which printed a cache WARN on every passing run."
metrics:
  duration: "about 1h55m (three ~23-minute full hook runs)"
  completed: 2026-10-04
actuals:
  tokens: 16000
  tasks: 3
  commits: 3
plan_head_before: 6fc114b4
plan_head_after: 8cff1fc4
---

# Quick Task 261003-w7b: Speed up commit-time checks Summary

Commit-time checks now classify every changed path by rule and union the selected checks. Only real config, removal, CI, e2e, and unknown inputs fall back to `npm run check`. Full runs serialize across worktrees through an mkdir lock, and every non-`--list` run appends a nine-key JSON line to `<git-common-dir>/check-changed.log`. A passing full hook run now prints 172 lines instead of 11,144.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 | 7714dd39 | perf(checks): select targeted checks for docs, tests, and data |
| 2 | e98527e7 | perf(checks): serialize full runs, log each run, guide hook use |
| 3 | 8cff1fc4 | perf(checks): quiet passing test and fallow output |

## Full-check evidence

Every task's `pre-commit run --files` passed. Each time, the changed-check hook selected full scope (`npm run check`) because executable tooling changed. Node v26.10.0 locally.

| Task | Command | Exit | Scope | Duration | Log |
| ---- | ------- | ---- | ----- | -------- | --- |
| 1 | `pre-commit run --files` (4 files) | 0 | full | (not verbose; ran before the log existed) | /tmp/w7b-precommit-task1.log |
| 2 | `pre-commit run --verbose --files` (5 files) | 0 | full | 1,364,635 ms, lockWaitMs 1 | /tmp/w7b-precommit-task2.log |
| 3 | `pre-commit run --verbose --files` (8 files), final tree before commit 8cff1fc4 | 0 | full | 1,378,808 ms, lockWaitMs 1 | /tmp/w7b-precommit-task3.log |

The Task 3 run is the plan's final full check over the finished tree. Its log record: `{"scope":"full","reason":"Full check required by package.json, scripts/check-changed.mjs, scripts/check-changed.negative.mjs, scripts/test-coverage-direct.mjs, scripts/test-reporter.mjs and 1 more","fileCount":9,"durationMs":1378808,"exitStatus":0,"lockWaitMs":1}`.

`fallow audit --format json --quiet --explain --gate-marker agent` returned `pass` before each commit.

## Probes and post-commit checks

- Task 1 real-tree probe (plan `<verify>`): `real-tree selection probe passed`. `tests/platform/hermetic-environment.ts` reaches 76 tests. `tests/pi-runtime.ts` is used only by e2e files, so the walk reaches no test and the file selects full.
- Task 1 `--list` smoke, with probes `docs/w7b-probe.md` and `.planning/quick/.../probe.json` plus the untracked PLAN.md: scope `focused`, reason `Documentation`, commands `[["npm","run","test:architecture"]]`. Both probe files were deleted.
- Task 2 verify: a `--list` run appended no log line and left no lock directory.
- Task 2 post-commit log check: `last run 1364635 ms, lock wait 1 ms`. The record had the nine keys in order, scope `full`, and exitStatus 0, and no lock directory was left behind.
- Task 3 verify: both controls passed. `npm run -s fallow` printed nothing and exited 0. `npm run -s test:integration` printed one line (`tests 22, ... duration_ms 100133.25`). The import-boundaries, glob-completeness, and type-member-gate tests passed (`tests 67, ... fail 0`). `package scripts ok`.
- Direct coverage with the new reporter: `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/shared/compare-name-scope.ts` printed one summary line plus `Direct coverage passed: ... (branches 8/8, functions 1/1, lines 22/22)`.

## Output measurement (changed-check section of the hook log)

| | Lines | Bytes |
| --- | --- | --- |
| Before (Task 2 log) | 11,144 | 896,127 |
| After (Task 3 log) | 172 | 10,351 |

Measurement command exit 0 (`before=11144 after=172`, `Checks passed.` present). Most of the remaining 172 lines are npm `> script` headers, the plan JSON, and 19 ESLint "Unused eslint-disable directive" warnings that already existed in production files (out of scope; warnings are meant to stay visible).

## Planted Fallow verification

Disposable copy: `git archive HEAD` at e98527e7 into `/tmp/w7b-fallow-copy-IZb8`, with `node_modules` symlinked, run with the final script flags.

- Clean copy: all four commands exited 0. The only output was the copy-only WARN `Skipped 1 package.json entry point outside project root ... tsconfig.tsbuildinfo` from the two dead-code runs.
- (a) Production cycle (`shared/w7b-cycle-a.ts` and `w7b-cycle-b.ts`, reached from `fs-utils.ts`): the production dead-code run exited 1 and printed `Circular dependencies (1)` naming `w7b-cycle-a.ts -> w7b-cycle-b.ts -> w7b-cycle-a.ts`.
- (b) tests/ cycle (`tests/shared/w7b-cycle-a.ts` and `-b.ts`): the cycle run, with `--quiet --no-cache`, exited 1 and printed `Circular dependencies (1)` naming both files.
- (c) Complexity (`w7bTangled` appended to `scripts/check-workflow-install-scripts.mjs`): `health ... --quiet --complexity` exited 1 and printed `High complexity functions (1)` with `:100 w7bTangled CRITICAL`.
- (d) Duplication (copy of `notification-grammar.ts` saved as `w7b-grammar-copy.ts`): the dupes pair exited 1 and printed `Duplication (4.4%) exceeds threshold (3.0%)`, then the clone list. Its first group names `notification-grammar.ts:48-1725` and `w7b-grammar-copy.ts:48-1725`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Quiet fallow still printed two cache WARN lines on every passing run**
- **Found during:** Task 3 verify (`test -z "$out"` failed)
- **Issue:** The production dead-code run and the `--no-production` cycle run share one graph cache. Each run evicts the other's entry and prints `WARN Graph cache decoded but not reused`. With the plan's exact script, `npm run fallow` printed 2 lines on every run, warm cache or not.
- **Fix:** Added `--no-cache` to the cycle run. The flag only disables caching (the cycle run costs about 1.7 s instead of 1.6 s). Added `"--no-cache"` to `ALLOWED_CYCLE_TOKENS`, with a comment explaining why. Planted cycle (b) was measured with the flag and still exited 1. The `fallow` script therefore differs from the plan's "exactly" text by that one token.
- **Files modified:** package.json, tests/architecture/import-boundaries.test.ts
- **Commit:** 8cff1fc4

**2. [Rule 2 - Test strength] Broad-fallback fixture files exist on disk**
- **Found during:** Task 1
- **Issue:** In the old fixture, `package.json`, `scripts/check-changed.mjs`, and similar inputs did not exist. They reached `full` through the missing-file rule, not the configuration rule.
- **Fix:** The fixture now writes those files, so the broad-fallback control exercises the unrecognized/config fallback. It also asserts that a full plan's reason lists the first five triggers and then "and N more".
- **Commit:** 7714dd39

No other deviations. The Task 1 pre-commit run was not `--verbose`; the plan only required verbose output for Tasks 2 and 3.

## Known Stubs

None.

## Verification scope

This was the plan's single required final full check: the Task 3 hook ran the full `npm run check` over the finished tree and passed. CI (`npm run check`, e2e, direct coverage) is unchanged.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: scripts/check-changed.mjs, scripts/check-changed.negative.mjs, scripts/test-reporter.mjs, scripts/test-reporter.negative.mjs
- FOUND commits: 7714dd39, e98527e7, 8cff1fc4 (`git rev-list --count 6fc114b4..HEAD` = 3)
