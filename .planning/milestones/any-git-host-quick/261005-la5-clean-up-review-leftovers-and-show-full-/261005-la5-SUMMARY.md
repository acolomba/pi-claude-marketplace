---
phase: 261005-la5
plan: 01
subsystem: tooling
tags: [ci, checks, coverage, fallow, prettier, yaml, backlog]
status: complete
requires: []
provides:
  - "One CI switch (the CI variable) that prints every check at info level, including Fallow"
  - "Direct coverage without the removed tooling-test scaffolding"
  - "One anchored build-input list in ci.yml"
affects: [package.json, scripts, ci.yml, .prettierignore, .fallowrc.json, docs]
tech-stack:
  added: []
  patterns:
    - "process.env.CI in Node scripts and ${CI:+...} / [ -n \"$CI\" ] in npm scripts as the one output switch"
key-files:
  created: []
  modified:
    - package.json
    - scripts/test-reporter.mjs
    - scripts/run-parallel.mjs
    - scripts/check-corresponding-tests.mjs
    - scripts/check-workflow-install-scripts.mjs
    - scripts/test-coverage-direct.mjs
    - skills/local-verification/SKILL.md
    - CONTRIBUTING.md
    - docs/guidelines/typescript-unit-testing-guidelines.md
    - .github/workflows/ci.yml
    - .prettierignore
    - .fallowrc.json
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - scripts/init.sh
    - .planning/codebase/TESTING.md
    - .planning/codebase/STACK.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/STRUCTURE.md
    - .planning/BACKLOG.md
decisions:
  - "CI set and not empty means full output; Fallow joins the switch per the orchestrator amendment (drop --quiet, print the dupes report once)"
  - "The fallow npm script picks its flags with a POSIX if, because sh has no inverse of ${CI:+...} and fallow has no env var for --quiet"
  - "ci.yml keeps one paths list behind &build_inputs; every hook accepted it, zizmor logs a beta-support WARN"
metrics:
  duration: "about 75 min"
  completed: 2026-10-05
actuals:
  tokens: 15150
  tasks: 3
  commits: 8
plan_head_before: 634027bc9d939e1c1f2d26f37e2619e66f9f135d
plan_head_after: 7073c2592d81fa3ceccb153092b58dd6911c577c
requirements: [LA5-01, LA5-02, LA5-03, LA5-04, LA5-05, LA5-06, LA5-07]
---

# Phase 261005-la5 Plan 01: Clean up review leftovers and print full check output in CI Summary

When `CI` is set and not empty, as on GitHub Actions, every check now prints at info level: the test reporter, `check:static`, Prettier, Fallow (including the full duplication report), the gate scripts, and direct coverage. Local runs print the same short output as before. The direct-coverage scaffolding, the duplicated CI paths list, the stale `.prettierignore` entries, and `maxUnitSize` are gone. FLOW-10 is closed again.

## Commits

All eight hooks passed (`PRECOMMIT_EXIT=0`, gitlint passed, `COMMIT_EXIT=0` for each).

| # | SHA | Title | npm-check hook |
| --- | --- | --- | --- |
| 1 | `de64a12e` | build(checks): print full check output in CI | ran `check:commit` (all pairs), passed |
| 2 | `9cf925fc` | refactor(coverage): remove unused direct-coverage scaffolding | ran, passed |
| 3 | `16e6bc0f` | ci: share one build-input list between both CI triggers | ran, passed |
| 4 | `5b7553b1` | chore(format): ignore only the unparseable fixture in Prettier | ran, passed |
| 5 | `8d0b9627` | chore(fallow): drop the maxUnitSize setting that gates nothing | ran, passed |
| 6 | `38eb7e41` | docs(clone-cache): name update-flow.ts in the git-ops comment | ran, passed |
| 7 | `628ce76a` | fix(init): stop hiding a failed pre-commit install | skipped (not a build input) |
| 8 | `7073c259` | docs(backlog): close the duplication-gate entry again | skipped (not a build input) |

## Orchestrator amendment (Fallow in CI)

Task 1 extends the switch to Fallow. The `fallow` npm script now starts with `q=--quiet; if [ -n "$CI" ]; then q=; fi;` and passes `$q` to the two dead-code runs and to health. For dupes, CI runs `fallow dupes --fail-on-issues --format human` once, without `--quiet` and without the `/dev/null` rerun. Locally, the old quiet rerun stays. Exit codes do not change: each command still carries `--fail-on-issues`, and the `&&` chain still stops on the first failure. `static-ci-1.log` shows the result: `loaded config`, the entry-point counts, `✓ No issues found`, the health line `16242 functions analyzed`, and the 42-group clone report.

**Expected in CI logs:** the dupes report ends with a red `✗ 1,365 lines (1.4%) duplicated across 45 files` line even though the run passes (exit 0, below the 3% threshold). The glyph does not mean failure.

## CI output by step

| Step | Local output (CI unset) | CI output (CI=true) | Quieted by | Evidence |
| --- | --- | --- | --- | --- |
| Test reporter | nothing on a pass | every test, `# SKIP` lines, counts, coverage tables | 261005-jdx | `reporter-local-1.log`, `reporter-ci-1.log`, `reporter-ci-fail-1.log` (exit 1 kept) |
| `check:static` runner | six status lines | status lines plus each passing step's output | 261005-hpr | `static-ci-1.log` |
| `format:check` (Prettier) | nothing | `Checking formatting...`, `All matched files use Prettier code style!` | 261005-jdx | `static-ci-1.log`, `fmt-local-1.log` |
| Fallow | nothing | config, entry points, `✓ No issues found`, health summary, full clone report | 261003-w7b | `static-ci-1.log`, `fallow-local-1.log` |
| `lint:workflows` gate | nothing | `Workflow install-scripts gate passed.` | 261005-jdx | `static-ci-1.log` |
| `test:corresponding` gate | nothing | `Corresponding-test gate passed.` | 261005-jdx | `static-ci-1.log` |
| Direct coverage, one pair | nothing | spec output plus `Direct coverage passed: <source> (<counts>)` | 261005-jdx | `direct-local-1.log`, `direct-ci-1.log` |
| Direct coverage, all pairs | `Merged LCOV` line | 268 per-pair lines, `All-pair run complete: 268 pairs in 43.2s (43226ms) on v26.10.0`, `Merged LCOV` | 261005-jdx | `direct-all-ci-1.log`, `direct-all-ci-2.log` |
| typecheck, ESLint | nothing | nothing (the tools print nothing on a pass) | n/a | `static-ci-1.log` |

These still print nothing in either mode (choice 8): the changed-pair base line, the staged escalation and count lines, and the zero-pair report. Those arms run only locally.

## Log results (last line of every `tmp/la5/*.log`)

```text
check-final.log: exit=0
commit-1.log .. commit-8.log: COMMIT_EXIT=0
direct-all-ci-1.log: DIRECT_ALL_CI_EXIT=0
direct-all-ci-2.log: DIRECT_ALL_CI_EXIT=0
direct-badbase-2.log: DIRECT_BADBASE_EXIT=1
direct-base-2.log: DIRECT_BASE_EXIT=0
direct-ci-1.log: DIRECT_CI_EXIT=0
direct-local-1.log: DIRECT_LOCAL_EXIT=0
direct-noargs-2.log: DIRECT_NOARGS_EXIT=1
direct-pair-2.log: DIRECT_PAIR_EXIT=0
direct-plant-2.log: DIRECT_PLANT_EXIT=1
direct-plant-base-2.log: DIRECT_PLANT_BASE_EXIT=1
direct-staged-2.log: DIRECT_STAGED_EXIT=0
fallow-3.log: FALLOW_EXIT=0
fallow-local-1.log: FALLOW_LOCAL_EXIT=0
fmt-3.log: FMT_EXIT=0
fmt-local-1.log: FMT_LOCAL_EXIT=0
gitlint-1.log .. gitlint-8.log: gitlint ... Passed
precommit-1.log .. precommit-8.log: PRECOMMIT_EXIT=0
reporter-ci-1.log: REPORTER_CI_EXIT=0
reporter-ci-fail-1.log: REPORTER_CI_FAIL_EXIT=1
reporter-local-1.log: REPORTER_LOCAL_EXIT=0
static-ci-1.log: STATIC_CI_EXIT=0
zizmor-3.log: ZIZMOR_EXIT=0
```

The non-zero exits are the expected refusals: a bad `--base`, a run without arguments, the planted shortfall (path and `--base HEAD` forms, the second also printing `Changed-pair base: HEAD`), and the planted failing test in CI mode. The plant was restored right away, and `git diff --quiet HEAD -- compare-name-scope.ts` passed.

## Direct-coverage refactor (OD-1)

The caller trace (`callers-2.txt`) found only the script itself. No test or script imports it, passes a project root, or overrides the runner, so every parameter was dead. Removed: the `selectedProjectRoot` parameter from all 15 functions, the runner parameter of `enforcePairs` and `measurePair`, the options object of `runPairs`, `--report` and the JSONL file, `selectBase` and `upstreamCandidate`, the `attempted` field, and the reason strings (`pairabilityRefusal` folded into a boolean `isPairablePath` with the same branch order). `assertReportComplete` now reads the in-memory records. The usage is `Pass source or test paths, --all [--lcov <path>], --base <ref>, or --staged`. `test:coverage:direct` stays, because the docs call it with paths.

## Anchor decision (OD-2)

Adopted. `ci.yml` has `paths: &build_inputs` under `push`, with a comment that names the npm-check hook, and `paths: *build_inputs` under `pull_request`. The `yaml` package parses both triggers to the same 17 entries. check-yaml, yamllint (`--strict`), yamlfmt (no rewrite: `git diff -- .github/workflows/ci.yml` was empty after the hooks), and zizmor all passed. zizmor logs one beta-support line, which counts as tool output, not a finding:

```text
 WARN audit: zizmor: one or more inputs contains YAML anchors; see https://docs.zizmor.sh/usage/#yaml-anchors for details
No findings to report. Good job! (1 suppressed)
```

## .prettierignore result

The file is now a comment and the invalid-manifest fixture path. `npm run --silent format:check` printed nothing and exited 0 (`fmt-3.log`). The `*.md` and `.claude/` lines mattered only to editor integrations and ad hoc `prettier .` runs, not to any script.

## maxUnitSize (OD-4)

The key is gone from `.fallowrc.json`. `npm run fallow` exits 0. The living mentions in CONVENTIONS.md (two), STACK.md, STRUCTURE.md, TESTING.md, and the `collectUpdateWarnings` comment in `update-swap.ts` no longer name it. These dated history records still mention it and stay as written: `.planning/milestones/`, `.planning/quick/`, `.planning/reviews/unit-test-adversarial/` (two files), and `.planning/spikes/014-fallow-complexity-health/README.md`.

## PR-time audit

`npx fallow audit --base origin/main` (`origin/main` = `6fc114b4`) returned verdict `pass` with 0 introduced findings and 9 inherited clone groups. No diagnostic degrades the analysis.

## Final check

- Command: `npm run check > tmp/la5/check-final.log 2>&1; echo "exit=$?" >> tmp/la5/check-final.log`
- Commit: `7073c2592d81fa3ceccb153092b58dd6911c577c` (worktree branch `worktree-agent-a5b3c0b7a5ae02e8d`, clean tree)
- Node: v26.10.0
- Result: `exit=0`. Output shape: npm's two-line banner, six `passed <step>` lines (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding), and `Merged LCOV: coverage/direct.lcov (258 records)`. Nothing else printed.

All three task `<verify>` blocks print `task N ok` on the final commit.

## REVIEW.md edits for the orchestrator

Per the orchestrator amendment, REVIEW.md was not edited or created in the worktree. I checked the anchors read-only against `/home/acolomba/pi-claude-marketplace/REVIEW.md`, and each one occurs exactly once. The full edit list is at `tmp/la5/review-edits.md` in the worktree:

- **E1** (Decisions, line 42): replace `- F8: deferred with F4; see the follow-up under F8. F9 lowers it further.` with `` - F8: fixed in quick task `261005-la5` (`628ce76a`). `init.sh` no longer hides a failed `pre-commit install`, so the script stops there. ``
- **E2** (F9 bullet): after `Still open: Codex has no matching hook.` append ` F9 is a note only: nothing is left to do on this branch.`
- **E3** (insert directly before the `- Check scopes now` bullet):
  - `- F7: no action. CI lints from an empty ESLint cache and is the backstop.`
  - `` - Done in quick task `261005-la5`: S1 (a), (b), (c), and (e) (`9cf925fc`), while (d) no longer applies because `check:commit` calls `test:coverage:direct:commit`. S3 (`16e6bc0f`, `5b7553b1`). The `clone-cache.ts` row of F5 (`38eb7e41`). S5: the `maxUnitSize` key is deleted (`8d0b9627`). S4 is resolved: every test script uses the quiet reporter, and in CI it prints every test (`de64a12e`). ``
- **E4** (line 46): replace `- Open: F1, F5 (rest), F6, F7, S1, S3, S5, S6. S4 and the uqn plan are superseded by the next steps below.` with `- Open: F1, F5 (rest), F6, S6. The uqn plan is superseded by the next steps below.`
- **E5** (Next steps item 1): after `Also open: e2e runs where every test skips print nothing, the same as a pass.` append `` In CI, those runs now print every test and the skip count (quick task `261005-la5`, `de64a12e`). ``
- **E6** (item 3): after `CI catches both. Decide whether that is acceptable.` append ` Accepted 2026-10-05: pull request CI catches both cases.`
- **E7** (item 4): after ``The explicit `--base` path stays.`` append `` Done in quick task `261005-la5` (`9cf925fc`). ``

## Deviations from Plan

### Orchestrator amendment

**1. Fallow joins the CI switch.** The plan (choice 8) left Fallow's `--quiet` and the dupes rerun alone. The orchestrator amendment, which follows the operator's stated intent, extends the switch to Fallow (see above). It changes `package.json` only, inside commit 1. The new skill sentence "Fallow prints its progress lines and the full duplication report." is added to the CI paragraph of `skills/local-verification/SKILL.md`, and commit 1's body names it. Exit codes and gating do not change.

**2. REVIEW.md was not edited.** Per the amendment, the edits go to `tmp/la5/review-edits.md` and the section above, for the orchestrator to apply in the main checkout.

### Sandbox / isolation deviations

- The worktree isolation guard refused compound shell lines that name git (including `bash -c`, heredocs, multi-command `git` pipelines, and a `sed` program with `||`). As the execution rules allow, I wrote those steps to `tmp/la5/*.sh` / `tmp/la5/*.cjs` and ran them with `bash` / `node`: `precond.sh`, `stage.sh`, `commit.sh`, `evidence-2.sh`, `refactor-2a.cjs`, `refactor-2b.cjs`, `anchor-3.cjs`, `unitsize-3.cjs`, and `verify-1.sh` / `verify-2.sh` / `verify-3.sh`, which hold the plan's verify commands verbatim. The `sed -i` edits to `clone-cache.ts` and `init.sh` were done with the Edit tool instead.
- The `clone-cache.ts` comment line became 83 characters after the rename, so its tail (`surface`) moved to the next comment line. The phrase `(the same re-export update-flow.ts uses)` stays on one line, as the plan asked.

### Auto-fixed issues

None.

## Flags for the operator

- The YAML anchor and the CI-mode output first run on GitHub at the next push. This task pushed nothing.
- CI logs grow: every test, a coverage table per pair in the direct-coverage job, and Fallow's full clone report (42 groups) in the static job.
- In CI, the Fallow dupes report shows a red `✗` summary line on a passing run (exit 0). This is expected.
- The `*.md` and `.claude/` lines of `.prettierignore` mattered only to editor integrations and ad hoc `prettier .` runs.
- Noticed and not changed: the `invokedPath` guard in `scripts/test-coverage-direct.mjs` (and in the two gate scripts) no longer serves an importer.
- A merge does not run the hook, so after merging, run `npm run check` in the main checkout, or reuse this result under the local-verification rule (clean commit `7073c259`, Node v26.10.0, `exit=0`).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-la5-04 (CI logs print every test name and output) now also covers Fallow's file paths and clone report in the static job log. These are repository paths only, with no credentials.

## Self-Check: PASSED

- The eight commits `de64a12e`, `9cf925fc`, `16e6bc0f`, `5b7553b1`, `8d0b9627`, `38eb7e41`, `628ce76a`, and `7073c259` are on HEAD (`git rev-list --count 634027bc..HEAD` = 8).
- All 20 modified files exist. `tmp/la5/review-edits.md` exists.
- Task verifies 1, 2, and 3 each printed `task N ok`.
