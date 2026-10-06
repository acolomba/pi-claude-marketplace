---
phase: 261005-hpr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/test-coverage-direct.mjs
  - scripts/run-parallel.mjs
  - package.json
  - .pre-commit-config.yaml
  - .github/workflows/ci.yml
  - .github/workflows/lint.yml
  - .github/workflows/sonarcloud.yml
  - sonar-project.properties
  - AGENTS.md
  - skills/local-verification/SKILL.md
  - skills/typescript-unit-testing/SKILL.md
  - skills/typescript-unit-testing-review/SKILL.md
  - CONTRIBUTING.md
  - docs/guidelines/typescript-unit-testing-guidelines.md
  - CHANGELOG.md
  - .planning/codebase/CONVENTIONS.md
  - .planning/codebase/STACK.md
  - .planning/codebase/TESTING.md
autonomous: true
requirements: [HPR-01, HPR-02, HPR-03, HPR-04, HPR-05, HPR-06, HPR-07]

estimate:
  tokens: 170000
  raw_tokens: 170000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "D-02/D-03: with one production source staged, npm run check:commit runs the six static steps, the unpaired unit tests, and direct coverage for that one pair only; unstaged edits and untracked files never select a pair and never stop the run."
    - "D-03: a staged test-support file (a fake), a pair-tooling script, or a dependency file makes the staged run measure all 268 pairs."
    - "D-05: check:static runs typecheck, lint, lint:workflows, fallow, format:check, and test:corresponding at once, fails if any fails, and prints the output of each failing step; the npm-check hook runs npm run check:commit with its files pattern unchanged."
    - "D-01: direct coverage starts one worker per available CPU unless TEST_CONCURRENCY is set."
    - "D-04: npm run test:coverage:direct:all writes coverage/direct.lcov with one record per non-type-only source (258), each at 100%, and none outside extensions/pi-claude-marketplace/; the CI artifact, sonarcloud.yml, and sonar-project.properties all name that report."
    - "D-05: npm run check runs check:static, test:unpaired, test:integration, and test:coverage:direct:all, runs no whole-suite unit coverage, and passes on the final tree."
    - "D-06/D-07: CI has the jobs static, integration, direct-coverage (all pairs on every event), e2e-tests, sonarcloud (after direct-coverage), and package (after the four test jobs); the Lint workflow also runs on pushes to main and the Fallow audit runs only for pull requests."
    - "D-08: AGENTS.md, the local-verification skill, the two unit-testing skills, CONTRIBUTING.md, the unit-testing guidelines, the CHANGELOG #236 entry, and the codebase map describe the new scopes; a hook pass is not a full verdict; no live document asks for a manual all-pair run after a shared change; the generated Fallow block in AGENTS.md is untouched."
    - "D-09: REVIEW.md marks F2 and F4 decided and is never committed."
  artifacts:
    - path: "scripts/run-parallel.mjs"
      provides: "the parallel runner behind check:static"
      contains: "--silent"
    - path: "scripts/test-coverage-direct.mjs"
      provides: "the staged selection with escalation, the per-pair include, and the merged LCOV"
      contains: "--staged"
    - path: "package.json"
      provides: "check:static, check:commit, test:unpaired, and the new check chain"
      contains: "check:commit"
    - path: ".pre-commit-config.yaml"
      provides: "the npm-check hook running check:commit"
      contains: "entry: npm run check:commit"
    - path: ".github/workflows/ci.yml"
      provides: "the split CI jobs and the direct coverage artifact"
      contains: "direct-coverage-lcov"
    - path: "sonar-project.properties"
      provides: "the Sonar coverage input"
      contains: "sonar.javascript.lcov.reportPaths=coverage/direct.lcov"
    - path: "skills/local-verification/SKILL.md"
      provides: "the check scopes and the commit procedure"
      contains: "check:commit"
  key_links:
    - from: ".pre-commit-config.yaml npm-check entry"
      to: "package.json check:commit"
      via: "the hook runs the npm script by name"
      pattern: "npm run check:commit"
    - from: "package.json test:coverage:direct:all"
      to: "scripts/test-coverage-direct.mjs --lcov"
      via: "the script writes the merged report at the path the npm script names"
      pattern: "--lcov coverage/direct.lcov"
    - from: ".github/workflows/ci.yml direct-coverage upload"
      to: ".github/workflows/sonarcloud.yml download"
      via: "the artifact name"
      pattern: "direct-coverage-lcov"
    - from: ".github/workflows/sonarcloud.yml report check"
      to: "sonar-project.properties reportPaths"
      via: "the same report path"
      pattern: "coverage/direct.lcov"
    - from: "AGENTS.md Build verification"
      to: "skills/local-verification/SKILL.md"
      via: "AGENTS.md defers the details and the reuse rules to the skill"
      pattern: "skills/local-verification/SKILL.md"
---

# Run each verification check at the scope its moment needs

<objective>
Per D-01 to D-10 (operator decisions, 2026-10-05, locked): run each check at the right scope. A commit checks the files it stages, fast. A GSD gate, a phase, a handoff, or the end of a quick task checks the whole tree on this machine with `npm run check`. Pull request CI checks the whole tree on a clean machine with network. CI on `main` repeats the pull request checks. The nightly run watches for upstream drift. This closes REVIEW.md F2 (no all-pair direct coverage before merge) and F4 (hooks ran twice per commit).

Purpose: today the commit hook runs the whole `npm run check` (about 90 s warm) and agents run it a second time by hand. Pull requests measure only the changed pairs, so a shared test-support change can lower another pair's direct coverage and turn `main` red after merge. Sonar reads whole-suite unit coverage, which the new chain no longer produces.

Output: Task 1 (tracer) builds the commit path: a staged-only selection with escalation, parallel static checks, `check:commit`, and the hook, proven by probes and a real commit. Task 2 builds the whole-tree path: the per-pair LCOV for Sonar, the new `check` chain, the split CI jobs, and the Lint triggers. Task 3 rewrites the instructions and docs, marks F2 and F4 decided in REVIEW.md, and runs `npm run check` on the final tree.
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@skills/local-verification/SKILL.md
@scripts/test-coverage-direct.mjs
@package.json
@.github/workflows/ci.yml
</context>

## Requirement map

HPR IDs and D-01 to D-10 are plan-local labels. Never cite them in files, comments, or commit messages.

| ID | Outcome | Task |
| --- | --- | --- |
| HPR-01 | Direct coverage defaults to one worker per available CPU, and `TEST_CONCURRENCY` still overrides it (D-01) | 1 |
| HPR-02 | A staged-only selection with escalation, `check:commit`, and the hook running it (D-02, D-03, D-05) | 1 |
| HPR-03 | `check:static` runs six steps in parallel through a dependency-free wrapper, and `test:unpaired` runs the unit tests that have no pair (D-05) | 1 |
| HPR-04 | Each pair records only its own source, `--all --lcov` writes the merged report, and Sonar reads it through the CI artifact (D-04) | 2 |
| HPR-05 | `npm run check` is the new chain, and whole-suite unit coverage leaves it (D-05) | 2 |
| HPR-06 | CI runs separate static, integration, and direct-coverage jobs, and the Lint workflow runs on pushes to `main` (D-06, D-07) | 2 |
| HPR-07 | Instructions and docs match, the Fallow block is untouched, and REVIEW.md records F2 and F4 (D-08, D-09) | 3 |

## Decisions (operator, 2026-10-05, locked)

- D-01: In `scripts/test-coverage-direct.mjs`, the default concurrency becomes `availableParallelism()` instead of a cap of four. `TEST_CONCURRENCY` still overrides it. Measured: all 268 pairs 142 s to 45 s, 35 changed pairs 36 s to 17 s.
- D-02: Add a staged-only selection mode for the hook. It reads `git diff --cached --name-only --diff-filter=ACMR` only: no untracked files, no unstaged edits, no base.
- D-03: Escalation. In staged mode, a staged path under `tests/` that cannot be paired (fakes, fixtures, harness, `tests/pi-runtime.ts`), or `scripts/test-reporter.mjs`, or a dependency or configuration build input (`package.json`, `package-lock.json`, `tsconfig.json`, and similar) runs all pairs instead.
- D-04: Sonar reads a merged per-pair LCOV written by the all-pair run. Each pair passes `--test-coverage-include=<source>`, or keeps only its own record as raw text. No record under `tests/` may leak. CI uploads it from the direct-coverage job, and `sonarcloud.yml` and `sonar.javascript.lcov.reportPaths` read it. Refresh the stale comments in `sonar-project.properties`. The operator finds out in the pull request whether Sonar is happy.
- D-05: package.json scripts. `check:static` runs typecheck, lint, lint:workflows, fallow, format:check, and test:corresponding in parallel through a small wrapper script with no new dependency. It fails if any step fails and prints the output of each failing step. `check:commit` is `check:static`, the non-pair unit tests, and the staged pairs with escalation. `check` is `check:static`, the non-pair unit tests, `test:integration`, and `test:coverage:direct:all`, without whole-suite unit coverage. Decide whether `test:coverage:unit` and `test:coverage` stay. `workflow.test_command` stays `npm run check`. The `npm-check` hook runs `npm run check:commit` and keeps its `files` pattern, which matches both ci.yml `paths` lists.
- D-06: ci.yml. Jobs: `static` (`check:static` and the non-pair unit tests, owns the ESLint cache step), `integration`, `direct-coverage` (`test:coverage:direct:all` on every event, the three pull-request-only steps and the full-history checkout removed, a rewritten header comment, about a 10-minute timeout, uploads the Sonar report), `e2e-tests` (unchanged), `sonarcloud` (needs `direct-coverage`, keeps the tag skip), and `package` (needs all new test jobs). Keep the `paths` filters and concurrency groups. `publish.yml` stays unchanged.
- D-07: lint.yml gains `push: branches: [main]`. The pre-commit job runs on it. `fallow-audit` gets `if: github.event_name == 'pull_request'`.
- D-08: Instructions and docs: AGENTS.md (the Git bullets, the Build verification paragraph, and the Quality bar line), the local-verification skill, the two unit-testing skills, CONTRIBUTING.md, and the codebase map. New rules: run the fixers and linters with `npm-check` skipped, restage fixer changes until clean, then `git commit` in the foreground with a long timeout. A failed hook means no commit: fix, restage, commit again, never `--amend`. A hook pass is not a full verdict and cannot satisfy a GSD gate. GSD gates run `npm run check`, which is the pull request checks in spirit, with e2e and empty-cache ESLint left to CI. A quick task that commits a build input runs `npm run check` in the main checkout after its worktree merges. Remove the manual instruction to run all pairs after a shared change. Drop the manual Fallow audit before commit and push, but if `fallow agent install` cannot stop generating it, leave the generated block untouched and record that in the summary. Keep the plain style.
- D-09: Mark F2 and F4 decided in the "Decisions and status" section of REVIEW.md, citing this quick task. Never commit REVIEW.md.
- D-10: Not in scope: a pre-push hook, skipping `npm-check` when a fixer changed files, deleting the base fallback chain of the direct-coverage script (S1(e)). The explicit `--base <ref>` path keeps working.

## Facts measured during planning

2026-10-05, branch `features/faster-precommit`, main checkout, HEAD `6a358a30`, Node v26.10.0, pre-commit 4.5.1, git 2.55.0, fallow 3.27.0. The only untracked paths were `REVIEW.md`, the uqn plan directory, and this quick directory. Nothing was staged. Anchor edits on content, never on line numbers.

1. Pairs. There are 268 production `.ts` modules and 268 pairs. Ten pairs are type-only (`bridges/{agents,commands,mcp,skills,workflows}/types.ts`, `bridges/hooks/exec-result.ts`, `domain/resolver-types.ts`, `edge/types.ts`, `orchestrators/import/types.ts`, `orchestrators/types.ts`). There are 321 unit test files: 268 pair tests, 49 under `tests/architecture/`, and 4 structural supplements.
2. Unpaired globs. `fs.globSync` over `tests/architecture/**/*.test.ts` and `tests/{domain,platform}/**/*-fake.test.ts` returns 53 files: the 49 architecture tests and the four supplements (`device-flow`, `credential-ops`, `git-ops`, `removal-ops`), each with its `-fake.ts` and `-contract.ts`. No production `*-fake.ts` exists. `node --test` over the two globs passed 368 tests in 6.8 s. Both scripts limit the supplement rule to `domain` and `platform`, and `check-corresponding-tests.mjs` reports any other `*-fake.test.ts` as an unexpected test. So the globs and the pairing gate agree, and no shared classification module is needed (D-05).
3. Include flag. With `--test-coverage-include=<source>`, a normal pair's LCOV held exactly one record, with a relative `SF:` path on Node 26. A type-only pair (`bridges/skills/types.ts`) wrote an LCOV file that holds only `TN:` and no record. Today `coverage/unit.lcov` holds 258 records, all under `extensions/`. The last all-pair report has 268 rows, ten of them type-only. `recordProjectPath` already accepts relative and absolute `SF:` paths. Node 24 on CI has never run the per-pair include.
4. Test support crosses roots. `tests/orchestrators/plugin/prune.test.ts` imports `tests/e2e/_helpers.ts`. So any file under `tests/` that is not a `.test.ts` file can change a pair, whatever its root. 147 such files are tracked (26 fixtures, 26 architecture support files, and others). Escalation covers all of them (D-03).
5. Temp-index probe. Copying the index file, then running `git update-index --cacheinfo` on the copy under `GIT_INDEX_FILE`, makes `git diff --cached` list the path while the real index and the working tree stay unchanged. The direct-coverage script calls git through `spawnSync`, which inherits `GIT_INDEX_FILE`. This is how Task 1 stages probes without touching operator files.
6. Fallow guide. `fallow agent install --help` offers `--without guide|skill|mcp|hooks`, and `scripts/init.sh` already passes `--without hooks`. A scratch `fallow agent install --without hooks --without skill --without mcp` still wrote the "Fallow local gate" paragraph with its commit and push audit step. The config schema has no agent or guide key. No option drops only that step. `--without guide` drops the whole block, including the task map. So the block stays untouched (D-08).
7. Callers. Only `check` and `test:coverage` call the whole-suite unit coverage script, and only comments in `sonar-project.properties` and `.planning/codebase/` name it. No CI step or doc calls `test:coverage`. Nothing calls `test:coverage:direct:commit`. No test parses the package.json scripts. The script keys are in alphabetical order.
8. Live stale statements. `git grep` outside `.planning/` history finds the unit coverage artifact in ci.yml and sonarcloud.yml, the Sonar report path and comments, `skills/local-verification/SKILL.md` (changed pairs on pull requests), `skills/typescript-unit-testing/SKILL.md` (the bullet that starts with `node --test`), `docs/guidelines/typescript-unit-testing-guidelines.md` (the bullet that asks for `test:coverage:direct:all` after shared changes), `.planning/codebase/CONVENTIONS.md` (the check chain), `STACK.md` (the coverage, pre-commit, ci.yml, lint.yml, and sonarcloud.yml lines), and `TESTING.md` (the check chain, the coverage requirement, and the report list). History under `.planning/`, `BACKLOG.md`, `WINDOWS.md`, and the #234 changelog entry stay.
9. CI. `uses: $/.github/workflows/sonarcloud.yml` is the existing reusable-workflow syntax, also on `main` and in `publish.yml`. Keep it byte-identical. `npm run lint:workflows` refuses any workflow line, comments included, that contains an npm install call without `--ignore-scripts`. zizmor requires `persist-credentials: false` and hash pins outside `actions/*`. `main` has no required status checks, so renamed jobs break no branch rule. In lint.yml, `workflow_dispatch` has no value and PyYAML reads `on:` as `True`.
10. Rehearsal. Planning applied W5 to W8 and W9 to W15 to a scratch `git clone --shared` of `6a358a30`. `pre-commit run` (yamllint, yamlfmt, zizmor, check-yaml, mdformat, markdownlint, texthooks) passed with no rewrite, `check-workflow-install-scripts.mjs` passed, the Task 3 doc checks and the Task 2 workflow checks passed, and the stale-reference sweep found nothing. The code changes of W3 and W4 were not rehearsed.
11. Changelog. The #236 top line says that commits that add or edit a build input run `npm run check`. After this task that is false, and AGENTS.md asks for a concise CHANGELOG record. The operator's list does not name CHANGELOG.md, so the summary flags the edit.
12. Tools and places. `/usr/bin/python3` 3.14.6 has PyYAML 6.0.3. `tmp/` and `coverage/` are gitignored. The git hooks live in the common `.git/hooks`, so executor worktrees run them. `scripts/init-worktree.sh` installs `node_modules` in a new worktree, and the ESLint and Prettier caches start cold there (the first lint takes minutes). `REVIEW.md` and the uqn plan directory are untracked files of the main checkout only. From any checkout, REVIEW.md is at `"$(git rev-parse --path-format=absolute --git-common-dir)/../REVIEW.md"`.

## Choices within the decisions

1. The unpaired script is `test:unpaired` with the two globs of fact 2 (D-05).
2. `test:coverage:direct:commit` becomes the staged mode, because nothing calls it (fact 7) and its name fits. The no-argument changed-pair mode, its base chain, `--base <ref>`, and `--report` stay (D-10).
3. Escalation set (D-03): any staged path under `tests/` that does not end in `.test.ts`, plus `package.json`, `package-lock.json`, `tsconfig.json`, `scripts/test-coverage-direct.mjs`, and `scripts/test-reporter.mjs`. A staged `.test.ts` under a root with no pairs (architecture, integration, e2e) or a supplement suite selects no pair and does not escalate, because `test:unpaired` runs the architecture tests and the supplements on every commit and no pair run loads them. Staged deletions do not escalate, because D-02 reads ACMR only. The summary flags that gap.
4. Delete the whole-suite unit coverage script. `test:coverage` runs `test:coverage:direct:all` in its place and still writes the integration and e2e reports (D-05, fact 7).
5. The hook id stays `npm-check` (lint.yml SKIP and the docs use it). Its name becomes `npm run check:commit`, so a passing line cannot pass for the full check (D-05).
6. `check:commit` and `check` run `check:static` first, then the test steps in sequence. A static failure stops before the tests, and the test steps each use every CPU.
7. LCOV (D-04): the include flag per pair, plus a refusal of any record for another file, so a leak fails the run instead of reaching Sonar. `--all --lcov <path>` writes the merged report after the verdict. The CI artifact is `direct-coverage-lcov`.
8. CI timeouts: `static` 15 minutes (a cold ESLint run), `integration` 10, `direct-coverage` 10 (about two minutes on a hosted runner).
9. The CHANGELOG #236 entry, `TESTING.md`, and the unit-testing guidelines change too, because they carry the same stale statements (facts 8 and 11).
10. The generated Fallow block stays untouched (fact 6). The summary records the finding and the `--without guide` alternative for the operator.
11. `check:static` prints one status line per passing step and hides that step's output, ESLint warnings included. A failing step prints its whole output.
12. This plan applies the new commit procedure of D-08 from Task 1 on.

## Interfaces (scripts/test-coverage-direct.mjs, current)

- `gitLines(args, root)` returns `{ ok: true, lines }` or `{ ok: false, reason }`. Every git call goes through it.
- `pairabilityRefusal(path, root)` returns a reason or `undefined`. `isPairablePath(path, root)` wraps it. `pairForPath(path, root)` returns `{ sourcePath, testPath }` and throws when a member is missing.
- `pairsForChangedPaths(root, explicitBase)` and `runChangedPairs(explicitBase)` serve the no-argument and `--base` arms. `skippedReport(skipped)` prints the zero-pair report.
- `runPair({ sourcePath, testPath })` spawns `node --test` with the custom reporter and an LCOV reporter into a temporary directory, which its `finally` block deletes. It returns `{ sourcePath, testPath, coverage, typeOnly, runtime, elapsedMs }`.
- `assertCompleteCoverage(sourcePath, lcovText, root)` returns a summary or `"type-only"`, and throws `Incomplete direct coverage for ...` (a shortfall) or another error.
- `runPairs(pairs, run, options)` is the bounded pool. `measurePair` records shortfalls. `enforcePairs(pairs, run, hooks)` is the verdict.
- `runAllPairs(reportPath)` enumerates every production module, writes the JSONL report row by row, and checks completeness through `assertReportComplete`.
- `main()` parses `--all`, `--all --report <path>`, `--base <ref>`, explicit paths, or no arguments.

## Execution rules

- Run in the main checkout or in an executor worktree. Every command here is relative to the checkout root. In a fresh worktree the first lint runs from an empty cache and can take about five minutes.
- Stage explicit paths only. Never `git add -A` or `git add .`, never `--amend`, never `--no-verify`. Stage `.planning/` paths only for the three `.planning/codebase/` files of Task 3. Never stage the plan, the summary, STATE.md, `REVIEW.md`, or the uqn plan. The operator edits files concurrently: leave any other modified file unstaged.
- Write every log under `tmp/hpr/` and record the exit code as its last line, never through a pipe. Example: `npm run check > tmp/hpr/check-final.log 2>&1; echo "CHECK_EXIT=$?" >> tmp/hpr/check-final.log`.
- Run long commands in the foreground with a 600000 ms timeout. If a run can outlast the limit, background it once and wait for the completion notification. Never poll with sleep.
- Commit procedure (D-08): run `SKIP=npm-check pre-commit run --files <the task's paths>` into `tmp/hpr/precommit-N.log` with `PRECOMMIT_EXIT`. Pass only paths that exist. If a fixer rewrites a file, inspect the diff and run again until the log ends with exit 0. Write the message to `tmp/hpr/commit-N.txt` (W16) and check it with `pre-commit run gitlint --hook-stage commit-msg --commit-msg-filename tmp/hpr/commit-N.txt`. Stage the task's paths by name and confirm `git diff --cached --name-status` lists exactly them. Then run `git commit -F tmp/hpr/commit-N.txt > tmp/hpr/commit-N.log 2>&1; echo "COMMIT_EXIT=$?" >> tmp/hpr/commit-N.log` in the foreground. If `COMMIT_EXIT` is not 0, the commit did not happen: read the log, fix, restage, and commit again. After a success, run `git rev-parse HEAD > tmp/hpr/commit-N.sha`.
- Do not run `npm run check`, `npm test`, ESLint, or type checking by hand, except where a step says so. The commit hook runs `check:commit`.

<tasks>

<task type="tracer">
  <name>Task 1: Commit path: staged pairs with escalation, parallel static checks, and the check:commit hook</name>
  <files>scripts/test-coverage-direct.mjs, scripts/run-parallel.mjs, package.json, .pre-commit-config.yaml</files>
  <precondition>The checkout descends from the planning HEAD, is not `main`, has `node_modules` and the git hooks, has nothing staged, and this plan's paths are clean: `test "$(git rev-parse --abbrev-ref HEAD)" != main && git merge-base --is-ancestor 6a358a30c66ae4edf3b5a79b32b8ca2ae6c632af HEAD && test -x node_modules/.bin/tsc && test -x "$(git rev-parse --git-path hooks)/pre-commit" && git diff --cached --quiet && test -z "$(git status --porcelain -- scripts package.json .pre-commit-config.yaml .github sonar-project.properties AGENTS.md CONTRIBUTING.md CHANGELOG.md skills docs/guidelines .planning/codebase)" && test -z "$(git ls-files --others --exclude-standard -- extensions tests scripts demos docs/output-catalog.md .github)"` succeeds (it did at planning time). Otherwise halt and report.</precondition>
  <read_first>
    - scripts/test-coverage-direct.mjs (whole file, once)
    - scripts/check-corresponding-tests.mjs: `nonCorrespondingRoots` and `isStructuralSupplement`, only to confirm fact 2
    - scripts/test-reporter.mjs: the summary line it prints
    - package.json: the `scripts` block
    - .pre-commit-config.yaml: the `- repo: local` block
    - eslint.config.js: the block for `scripts/**/*.mjs` (cognitive complexity 15, `no-console` warns, stdout writes allowed)
    - the W1, W2a, W3a, W4, and W16 sections of this plan
  </read_first>
  <action>
1. Run `mkdir -p tmp/hpr` and `git rev-parse HEAD > tmp/hpr/start-1.txt`.
2. Per D-01, change the default worker count in `runPairs` to one worker per available CPU (W3a item 1). Keep `TEST_CONCURRENCY` first and keep its validation.
3. Per D-02 and D-03, add the `--staged` arm exactly as W3a items 2 to 7 describe: the index-only git call, the escalation set of choice 3 with its exact message, the `Staged pairs: <n>` line, and the reuse of the changed-pair pairing and zero-pair report. Do not copy the changed-pair arm: share its pairing and reporting, because `fallow dupes` scans `scripts/`. Keep every function within cognitive complexity 15 for both ESLint and `fallow health`, and move option parsing out of `main` if it grows. Add the one short comment of W3a item 5 and no other.
4. Per D-05, create `scripts/run-parallel.mjs` to the W4 contract. It imports only `node:` built-ins and writes through `process.stdout` and `process.stderr`.
5. Per D-05 and choices 1 and 2, apply W2a to `package.json`: add `check:commit`, `check:static`, and `test:unpaired`, and point `test:coverage:direct:commit` at `--staged`. Keep the keys in alphabetical order. Change nothing else in the file.
6. Per D-05 and choice 5, apply W1 to `.pre-commit-config.yaml`: only the `name` and `entry` of the `npm-check` hook change. Its id, `language`, `pass_filenames`, and `files` stay byte-identical, and so does every other hook.
7. Run the commit procedure's pre-commit step on `scripts/test-coverage-direct.mjs scripts/run-parallel.mjs package.json .pre-commit-config.yaml` into `tmp/hpr/precommit-1.log`. The `npm run check:commit` line must end `Skipped`, and the log must end `PRECOMMIT_EXIT=0`.
8. Probe P3, untracked files are ignored: create `tests/shared/zz-hpr-untracked-probe.test.ts` containing one line, `import test from "node:test";`. Then run `node scripts/test-coverage-direct.mjs --staged > tmp/hpr/p3.log 2>&1; echo "P3_EXIT=$?" >> tmp/hpr/p3.log; rm -f tests/shared/zz-hpr-untracked-probe.test.ts`. The log must show `Staged pairs: 0` and the empty zero-pair report, and it must not mention the probe file.
9. Probe P4, the explicit base still works (D-10): `node scripts/test-coverage-direct.mjs --base HEAD > tmp/hpr/p4.log 2>&1; echo "P4_EXIT=$?" >> tmp/hpr/p4.log`. Its first line must be `Changed-pair base: HEAD`. If it throws on an operator's untracked file, stop and report.
10. Probe P1, one staged pair through the whole `check:commit` (fact 5): `cp "$(git rev-parse --git-path index)" tmp/hpr/p1.index && B="$( { cat extensions/pi-claude-marketplace/shared/compare-name-scope.ts; echo; } | git hash-object -w --stdin)" && GIT_INDEX_FILE="$PWD/tmp/hpr/p1.index" git update-index --cacheinfo "100644,$B,extensions/pi-claude-marketplace/shared/compare-name-scope.ts" && GIT_INDEX_FILE="$PWD/tmp/hpr/p1.index" git diff --cached --name-only > tmp/hpr/p1-staged.txt; GIT_INDEX_FILE="$PWD/tmp/hpr/p1.index" npm run check:commit > tmp/hpr/p1.log 2>&1; echo "P1_EXIT=$?" >> tmp/hpr/p1.log`. The log must show a `passed` line for each of the six static steps, `Staged pairs: 1`, and exactly one `Direct coverage passed:` line, for `compare-name-scope.ts`. It must not show an all-pair run. If a static step fails in a file this task did not touch, stop and report.
11. Probe P2, a staged fake escalates (D-03): the same three commands with `tmp/hpr/p2.index`, `tests/platform/git-ops-fake.ts`, and `tmp/hpr/p2-staged.txt`, then `GIT_INDEX_FILE="$PWD/tmp/hpr/p2.index" node scripts/test-coverage-direct.mjs --staged > tmp/hpr/p2.log 2>&1; echo "P2_EXIT=$?" >> tmp/hpr/p2.log`. The log must show `Staged tests/platform/git-ops-fake.ts affects every pair. Running all pairs.`, 268 `Direct coverage passed:` lines, and `All-pair run complete: 268 pairs in`. Then run `rm -f tmp/hpr/p1.index tmp/hpr/p2.index`.
12. `git diff --cached --name-only` must still print nothing: the probes used copies of the index.
13. Commit per the execution rules with the W16 commit-1 message, staging `scripts/test-coverage-direct.mjs scripts/run-parallel.mjs package.json .pre-commit-config.yaml`. The staged `package.json` makes the hook run all pairs, so expect about a minute after the static steps. The log must show `npm run check:commit` ending `Passed` and end `COMMIT_EXIT=0`. Record the six static step times from `tmp/hpr/p1.log` for the summary.
  </action>
  <verify>
    <automated>S="$(cat tmp/hpr/start-1.txt)" && C="$(cat tmp/hpr/commit-1.sha)" && test "$(git rev-list --count "$S".."$C")" -eq 1 && git merge-base --is-ancestor "$C" HEAD && D="$(git diff --name-status "$S" "$C")" && test "$(printf '%s\n' "$D" | LC_ALL=C sort | tr '\t\n' '  ')" = "A scripts/run-parallel.mjs M .pre-commit-config.yaml M package.json M scripts/test-coverage-direct.mjs " && test ! -e tests/shared/zz-hpr-untracked-probe.test.ts && /usr/bin/python3 -c 'import json, re, subprocess, sys, yaml
S, C = sys.argv[1], sys.argv[2]
at = lambda rev, p: subprocess.run(["git", "show", rev + ":" + p], capture_output=True, text=True, check=True).stdout
old, new = json.loads(at(S, "package.json")), json.loads(at(C, "package.json"))
assert {k: v for k, v in old.items() if k != "scripts"} == {k: v for k, v in new.items() if k != "scripts"}, "package.json changed outside scripts"
want = {
    "check:commit": "npm run check:static && npm run test:unpaired && npm run test:coverage:direct:commit",
    "check:static": "node scripts/run-parallel.mjs typecheck lint lint:workflows fallow format:check test:corresponding",
    "test:coverage:direct:commit": "node scripts/test-coverage-direct.mjs --staged",
    "test:unpaired": "node --test --test-reporter=./scripts/test-reporter.mjs ${TEST_CONCURRENCY:+--test-concurrency=$TEST_CONCURRENCY} \"tests/architecture/**/*.test.ts\" \"tests/{domain,platform}/**/*-fake.test.ts\"",
}
o, n = old["scripts"], new["scripts"]
for key, value in want.items():
    assert n.get(key) == value, (key, n.get(key))
assert {k: v for k, v in o.items() if k not in want} == {k: v for k, v in n.items() if k not in want}, "another script changed"
assert list(n) == sorted(n), "scripts are not sorted"
oc, nc = yaml.safe_load(at(S, ".pre-commit-config.yaml")), yaml.safe_load(at(C, ".pre-commit-config.yaml"))
assert {k: v for k, v in oc.items() if k != "repos"} == {k: v for k, v in nc.items() if k != "repos"}, "top-level keys changed"
assert [r for r in oc["repos"] if r["repo"] != "local"] == [r for r in nc["repos"] if r["repo"] != "local"], "a non-local hook changed"
(ol,) = [r["hooks"] for r in oc["repos"] if r["repo"] == "local"]
(nl,) = [r["hooks"] for r in nc["repos"] if r["repo"] == "local"]
assert len(nl) == 2 and nl[0] == ol[0], "prettier hook changed"
assert nl[1] == dict(ol[1], name="npm run check:commit", entry="npm run check:commit"), nl[1]
src = at(C, "scripts/test-coverage-direct.mjs")
assert "Math.min(4" not in src and "availableParallelism()" in src, "concurrency default"
assert "\"--staged\"" in src, "staged arm"
wrapper = at(C, "scripts/run-parallel.mjs")
assert "require(" not in wrapper and not re.search(r"from \"(?!node:)", wrapper), "wrapper imports only node: built-ins"
log = lambda name: open("tmp/hpr/" + name, encoding="utf8").read().splitlines()
assert log("p1-staged.txt") == ["extensions/pi-claude-marketplace/shared/compare-name-scope.ts"], log("p1-staged.txt")
assert log("p2-staged.txt") == ["tests/platform/git-ops-fake.ts"], log("p2-staged.txt")
p1 = log("p1.log")
assert p1[-1] == "P1_EXIT=0", p1[-1]
for step in ["typecheck", "lint", "lint:workflows", "fallow", "format:check", "test:corresponding"]:
    assert any(re.fullmatch(r"passed " + re.escape(step) + r" \(\d+\.\d s\)", l) for l in p1), ("p1 step", step)
assert "Staged pairs: 1" in p1, "p1 staged pairs"
done = [l for l in p1 if l.startswith("Direct coverage passed: ")]
assert len(done) == 1 and done[0].startswith("Direct coverage passed: extensions/pi-claude-marketplace/shared/compare-name-scope.ts ("), done
assert not any(l.startswith("All-pair run complete") for l in p1), "p1 ran all pairs"
p2 = log("p2.log")
assert p2[-1] == "P2_EXIT=0", p2[-1]
assert "Staged tests/platform/git-ops-fake.ts affects every pair. Running all pairs." in p2, "p2 escalation line"
assert any(l.startswith("All-pair run complete: 268 pairs in ") for l in p2), "p2 all pairs"
assert sum(l.startswith("Direct coverage passed: ") for l in p2) == 268, "p2 pair count"
p3 = log("p3.log")
assert p3[-1] == "P3_EXIT=0" and "Staged pairs: 0" in p3 and "No changed source-test pairs. No changed path was passed over." in p3, p3
assert not any("zz-hpr" in l for l in p3), "p3 selected the untracked probe"
p4 = log("p4.log")
assert p4[0] == "Changed-pair base: HEAD" and p4[-1] == "P4_EXIT=0", (p4[0], p4[-1])
pc = log("precommit-1.log")
assert pc[-1] == "PRECOMMIT_EXIT=0" and any(re.fullmatch(r"npm run check:commit\.+Skipped", l) for l in pc), "precommit-1"
c1 = log("commit-1.log")
assert c1[-1] == "COMMIT_EXIT=0" and any(re.fullmatch(r"npm run check:commit\.+Passed", l) for l in c1), "commit-1"
print("task 1 ok")' "$S" "$C"</automated>
  </verify>
  <done>The commit in `tmp/hpr/commit-1.sha` adds `scripts/run-parallel.mjs` and modifies exactly `scripts/test-coverage-direct.mjs`, `package.json`, and `.pre-commit-config.yaml` (D-01 to D-05). The `npm-check` hook runs `npm run check:commit` with its pattern unchanged, and its own commit run passed. With one source staged, `check:commit` ran the six static steps, the unpaired tests, and that one pair only. A staged fake ran all 268 pairs. An untracked pairable file was ignored, and `--base HEAD` still works. Direct coverage defaults to one worker per CPU.</done>
</task>

<task type="auto">
  <name>Task 2: Whole-tree path: per-pair LCOV for Sonar, the new check chain, split CI jobs, and Lint on main</name>
  <files>scripts/test-coverage-direct.mjs, package.json, .github/workflows/ci.yml, .github/workflows/lint.yml, .github/workflows/sonarcloud.yml, sonar-project.properties</files>
  <read_first>
    - scripts/test-coverage-direct.mjs: `runPair`, `assertCompleteCoverage`, `runAllPairs`, and `main` (already read in Task 1, so reread only these with a targeted range)
    - .github/workflows/ci.yml (whole file), .github/workflows/lint.yml, .github/workflows/sonarcloud.yml
    - sonar-project.properties: from `# Coverage settings.` through the `reportPaths` line
    - scripts/check-workflow-install-scripts.mjs: the install-call pattern (fact 9)
    - zizmor.yml
    - the W2b, W3b, W5, W6, W7, W8, and W16 sections of this plan
  </read_first>
  <action>
1. Run `git rev-parse HEAD > tmp/hpr/start-2.txt`.
2. Per D-04 and choice 7, apply W3b to `scripts/test-coverage-direct.mjs`: the per-pair include flag, the refusal of a record for any other file, the LCOV text kept before the temporary directory goes, and the `--all` options `--report <path>` and `--lcov <path>` with the merged write after the verdict. The JSONL report rows keep exactly their current fields. Keep each function within cognitive complexity 15.
3. Per D-05 and choice 4, apply W2b to `package.json`: the new `check` chain, `test:coverage` running `test:coverage:direct:all`, the `--lcov coverage/direct.lcov` option on `test:coverage:direct:all`, and the deletion of the whole-suite unit coverage script. Change nothing else.
4. Per D-06 and choice 8, replace the `jobs:` block of `.github/workflows/ci.yml` as W5 describes: `static` and `integration` from W5, the `sonarcloud` job with only its `needs` changed, `e2e-tests` byte-identical, `direct-coverage` from W5, and `package` with only its `needs` changed. Everything above `jobs:` stays byte-identical, including the `paths` lists, the concurrency group, and the D-01 comment. Keep the reusable-workflow `uses:` line as it is (fact 9). Write no comment that contains an npm install call.
5. Per D-07, make `.github/workflows/lint.yml` equal W6: the `push` trigger on `main`, the new SKIP comment, and the pull-request condition on `fallow-audit` with its comment. The SKIP value stays `prettier,npm-check`.
6. Per D-04, apply W7 to `.github/workflows/sonarcloud.yml`: the download step and the report check name the new artifact and report. Nothing else changes.
7. Per D-04, replace the coverage comment block and the `reportPaths` line of `sonar-project.properties` with W8. Every other line stays byte-identical.
8. Run the commit procedure's pre-commit step on the six paths into `tmp/hpr/precommit-2.log`. yamllint, yamlfmt, zizmor, and check-yaml run on the workflows. The log must end `PRECOMMIT_EXIT=0`.
9. Per D-04, run `npm run test:coverage:direct:all > tmp/hpr/direct-all.log 2>&1; echo "DIRECT_ALL_EXIT=$?" >> tmp/hpr/direct-all.log` in the foreground (about a minute). The log must show `All-pair run complete: 268 pairs in` and `Merged LCOV: coverage/direct.lcov (258 records)`, and end `DIRECT_ALL_EXIT=0`. `coverage/direct.lcov` must hold one record per non-type-only source and none for a file outside `extensions/pi-claude-marketplace/`. The verify checks this against `coverage/all-pairs.jsonl`.
10. Commit per the execution rules with the W16 commit-2 message, staging the six paths. The staged `package.json` makes the hook run all pairs again, now with the include flag. The log must show `npm run check:commit` ending `Passed` and end `COMMIT_EXIT=0`.
  </action>
  <verify>
    <automated>S="$(cat tmp/hpr/start-2.txt)" && C="$(cat tmp/hpr/commit-2.sha)" && test "$(git rev-list --count "$S".."$C")" -eq 1 && git merge-base --is-ancestor "$C" HEAD && D="$(git diff --name-status "$S" "$C")" && test "$(printf '%s\n' "$D" | LC_ALL=C sort | tr '\t\n' '  ')" = "M .github/workflows/ci.yml M .github/workflows/lint.yml M .github/workflows/sonarcloud.yml M package.json M scripts/test-coverage-direct.mjs M sonar-project.properties " && /usr/bin/python3 -c 'import json, os, re, subprocess, sys, yaml
S, C = sys.argv[1], sys.argv[2]
at = lambda rev, p: subprocess.run(["git", "show", rev + ":" + p], capture_output=True, text=True, check=True).stdout
load = lambda rev, p: yaml.safe_load(at(rev, p))
on = lambda w: w.get("on", w.get(True))
old, new = json.loads(at(S, "package.json")), json.loads(at(C, "package.json"))
assert {k: v for k, v in old.items() if k != "scripts"} == {k: v for k, v in new.items() if k != "scripts"}, "package.json changed outside scripts"
o, n = old["scripts"], new["scripts"]
want = {
    "check": "npm run check:static && npm run test:unpaired && npm run test:integration && npm run test:coverage:direct:all",
    "test:coverage": "rm -rf coverage && mkdir -p coverage && npm run test:coverage:direct:all && npm run test:coverage:integration && npm run test:coverage:e2e",
    "test:coverage:direct:all": "mkdir -p coverage && node scripts/test-coverage-direct.mjs --all --report coverage/all-pairs.jsonl --lcov coverage/direct.lcov",
}
for key, value in want.items():
    assert n.get(key) == value, (key, n.get(key))
gone = "test:coverage:" + "unit"
assert gone in o and gone not in n, "whole-suite unit coverage script"
assert {k: v for k, v in o.items() if k not in want and k != gone} == {k: v for k, v in n.items() if k not in want}, "another script changed"
src = at(C, "scripts/test-coverage-direct.mjs")
assert "--test-coverage-include=" in src and "\"--lcov\"" in src and "\"--staged\"" in src, "direct coverage script"
ci_o, ci = load(S, ".github/workflows/ci.yml"), load(C, ".github/workflows/ci.yml")
assert on(ci_o) == on(ci) and ci_o["concurrency"] == ci["concurrency"] and ci_o["permissions"] == ci["permissions"], "ci.yml triggers, concurrency, or permissions changed"
jobs, jobs_o = ci["jobs"], ci_o["jobs"]
assert set(jobs) == {"static", "integration", "direct-coverage", "e2e-tests", "sonarcloud", "package"}, sorted(jobs)
assert jobs["e2e-tests"] == jobs_o["e2e-tests"], "e2e job changed"
runs = lambda job: [s["run"] for s in jobs[job]["steps"] if "run" in s]
assert runs("static") == ["npm ci --ignore-scripts", "rm -rf node_modules/.cache/eslint", "npm run check:static", "npm run test:unpaired"], runs("static")
assert runs("integration") == ["npm ci --ignore-scripts", "npm run test:integration"], runs("integration")
dc = jobs["direct-coverage"]
assert runs("direct-coverage") == ["npm ci --ignore-scripts", "npm run test:coverage:direct:all"], runs("direct-coverage")
assert "if" not in dc and not any("if" in s for s in dc["steps"]), "direct coverage depends on the event"
assert dc["timeout-minutes"] in range(1, 16) and "needs" not in dc, dc
(up,) = [s for s in dc["steps"] if str(s.get("uses", "")).startswith("actions/upload-artifact@")]
assert up["with"]["name"] == "direct-coverage-lcov" and up["with"]["path"] == "coverage/direct.lcov" and up["with"]["if-no-files-found"] == "error", up
for job in ["static", "integration", "direct-coverage"]:
    (co,) = [s for s in jobs[job]["steps"] if str(s.get("uses", "")).startswith("actions/checkout@")]
    assert co.get("with") == {"persist-credentials": False}, (job, co)
sonar_o = dict(jobs_o["sonarcloud"])
sonar_o["needs"] = ["direct-coverage"]
assert jobs["sonarcloud"] == sonar_o, jobs["sonarcloud"]
assert set(jobs["package"]["needs"]) == {"static", "integration", "e2e-tests", "direct-coverage"}, jobs["package"]["needs"]
assert {k: v for k, v in jobs["package"].items() if k != "needs"} == {k: v for k, v in jobs_o["package"].items() if k != "needs"}, "package job changed"
ci_text = at(C, ".github/workflows/ci.yml")
for stale in ["unit.lcov", "unit-coverage", "fetch-depth", "Changed-pair base", "232 pairs", "eight minutes"]:
    assert stale not in ci_text, ("ci.yml", stale)
lo, ln = load(S, ".github/workflows/lint.yml"), load(C, ".github/workflows/lint.yml")
assert on(ln)["push"] == {"branches": ["main"]} and on(ln)["pull_request"] == on(lo)["pull_request"] and "workflow_dispatch" in on(ln), on(ln)
q = chr(39)
assert ln["jobs"]["fallow-audit"].get("if") == "github.event_name == " + q + "pull_request" + q, ln["jobs"]["fallow-audit"]
assert {k: v for k, v in ln["jobs"]["fallow-audit"].items() if k != "if"} == lo["jobs"]["fallow-audit"], "fallow-audit job changed"
assert ln["jobs"]["pre-commit"] == lo["jobs"]["pre-commit"], "pre-commit job changed"
assert ln["concurrency"] == lo["concurrency"] and ln["permissions"] == lo["permissions"], "lint.yml concurrency or permissions changed"
sc_o, sc = load(S, ".github/workflows/sonarcloud.yml"), load(C, ".github/workflows/sonarcloud.yml")
steps = sc["jobs"]["sonarcloud"]["steps"]
(dl,) = [s for s in steps if str(s.get("uses", "")).startswith("actions/download-artifact@")]
assert dl["with"] == {"name": "direct-coverage-lcov", "path": "coverage"}, dl
assert "test -s coverage/direct.lcov" in [s.get("run") for s in steps], "sonar requires the report"
assert on(sc) == on(sc_o) and len(steps) == len(sc_o["jobs"]["sonarcloud"]["steps"]), "sonarcloud.yml shape changed"
for stale in ["unit-coverage", "unit.lcov", "unit coverage"]:
    assert stale not in at(C, ".github/workflows/sonarcloud.yml"), ("sonarcloud.yml", stale)
sp_o, sp = at(S, "sonar-project.properties"), at(C, "sonar-project.properties")
keys = lambda t: [l for l in t.splitlines() if l and not l.startswith("#") and not l.startswith("sonar.javascript.lcov.reportPaths=")]
assert "sonar.javascript.lcov.reportPaths=coverage/direct.lcov" in sp.splitlines() and keys(sp_o) == keys(sp), "Sonar keys"
for stale in ["unit.lcov", "227 of the 234", "seven absentees", gone]:
    assert stale not in sp, ("sonar-project.properties", stale)
lcov = open("coverage/direct.lcov", encoding="utf8").read()
rows = [json.loads(l) for l in open("coverage/all-pairs.jsonl", encoding="utf8").read().splitlines() if l]
assert len(rows) == 268 and sum(r["typeOnly"] for r in rows) == 10 and not any("lcov" in r for r in rows), "report rows"
records = [r for r in lcov.split("end_of_record") if "SF:" in r]
assert lcov.count("end_of_record") == len(records) == 258, (lcov.count("end_of_record"), len(records))
seen = []
for rec in records:
    f = dict(l.split(":", 1) for l in rec.splitlines() if l.split(":", 1)[0] in ("SF", "LF", "LH", "FNF", "FNH", "BRF", "BRH"))
    sf = os.path.relpath(os.path.abspath(f["SF"])).replace(os.sep, "/")
    assert sf.startswith("extensions/pi-claude-marketplace/"), sf
    assert f["LF"] == f["LH"] and f["FNF"] == f["FNH"] and f["BRF"] == f["BRH"], (sf, f)
    seen.append(sf)
assert sorted(seen) == sorted(r["sourcePath"] for r in rows if not r["typeOnly"]), "records differ from the non-type-only pairs"
log = lambda name: open("tmp/hpr/" + name, encoding="utf8").read().splitlines()
d = log("direct-all.log")
assert d[-1] == "DIRECT_ALL_EXIT=0" and any(l.startswith("All-pair run complete: 268 pairs in ") for l in d) and "Merged LCOV: coverage/direct.lcov (258 records)" in d, d[-3:]
pc = log("precommit-2.log")
assert pc[-1] == "PRECOMMIT_EXIT=0" and any(re.fullmatch(r"npm run check:commit\.+Skipped", l) for l in pc), "precommit-2"
c2 = log("commit-2.log")
assert c2[-1] == "COMMIT_EXIT=0" and any(re.fullmatch(r"npm run check:commit\.+Passed", l) for l in c2), "commit-2"
print("task 2 ok")' "$S" "$C"</automated>
  </verify>
  <done>The commit in `tmp/hpr/commit-2.sha` modifies exactly the six paths (D-04 to D-07). `npm run check` is `check:static`, `test:unpaired`, `test:integration`, and `test:coverage:direct:all`, and the whole-suite unit coverage script is gone. Each pair runs with the include flag, and `coverage/direct.lcov` holds 258 complete records, all for production sources. CI runs `static`, `integration`, `direct-coverage` (every event, no base steps, 10-minute limit, uploads `direct-coverage-lcov`), unchanged `e2e-tests`, `sonarcloud` after `direct-coverage`, and `package` after the four test jobs. Lint runs on pushes to `main`, and the Fallow audit only for pull requests. Sonar reads `coverage/direct.lcov`, and its comment block states the new source and counts.</done>
</task>

<task type="auto">
  <name>Task 3: Describe the scopes in AGENTS.md, the skills, and the docs; record F2 and F4; run the full check</name>
  <files>AGENTS.md, skills/local-verification/SKILL.md, skills/typescript-unit-testing/SKILL.md, skills/typescript-unit-testing-review/SKILL.md, CONTRIBUTING.md, docs/guidelines/typescript-unit-testing-guidelines.md, CHANGELOG.md, .planning/codebase/CONVENTIONS.md, .planning/codebase/STACK.md, .planning/codebase/TESTING.md</files>
  <read_first>
    - AGENTS.md: the `### Git` section, the `### Build verification` section, and the Quality bar line
    - skills/local-verification/SKILL.md (whole file)
    - skills/typescript-unit-testing/SKILL.md: the bullet that starts "- Run `node --test"
    - skills/typescript-unit-testing-review/SKILL.md: the "Verify with the toolchain" section
    - CONTRIBUTING.md: from `## Checks` to the end
    - docs/guidelines/typescript-unit-testing-guidelines.md: the direct-coverage command list
    - CHANGELOG.md: the #236 entry; .claude/rules/changelog.md
    - .planning/codebase/CONVENTIONS.md, STACK.md, TESTING.md: the lines that W15 names
    - .agents/skills/simple-english/SKILL.md and .agents/skills/humanizer/SKILL.md
    - the W9 to W16 sections of this plan
  </read_first>
  <action>
1. Run `git rev-parse HEAD > tmp/hpr/start-3.txt`. Per D-08, load the `simple-english` skill in Plain mode and the `humanizer` skill.
2. Per D-08, in `AGENTS.md` replace the two bullets between the commit-message bullet and the `--no-verify` bullet of `### Git` with W9a, replace the paragraph under `### Build verification` with W9b, and replace the Quality bar line with W9c. Every other line stays byte-identical, including the generated Fallow block between its markers (fact 6, choice 10).
3. Per D-08, replace the body of `skills/local-verification/SKILL.md` with W10 and keep its frontmatter.
4. Per D-08, replace the bullet of `skills/typescript-unit-testing/SKILL.md` that starts "- Run `node --test" with W11a, and the paragraph of `skills/typescript-unit-testing-review/SKILL.md` that starts "Use the same project" with W11b. Each stays one line, and nothing else in either file changes.
5. Per D-08, replace everything from `## Checks` to the end of `CONTRIBUTING.md` with W12.
6. Per D-08 and choice 9, replace the third bullet under the direct-coverage commands of `docs/guidelines/typescript-unit-testing-guidelines.md` (the one that names `npm run test:coverage:direct:all`) with W13.
7. Per D-08 and choice 9, follow `.claude/rules/changelog.md`: replace the #236 top line of `CHANGELOG.md` with the W14 top line, and insert the two W14 sub-bullets as the first sub-bullets under it. Every other line stays byte-identical.
8. Per D-08, replace the `.planning/codebase/` lines that W15 names with the W15 text, one line each.
9. Run the self-checks of both writing skills on every sentence you wrote. Change wording only where a self-check rejects it, keep every statement, and add no semicolon to the skill.
10. Run the commit procedure's pre-commit step on the ten paths into `tmp/hpr/precommit-3.log` and rerun until it ends `PRECOMMIT_EXIT=0`. Commit with the W16 commit-3 message, staging the ten paths by name. No build input is staged, so the log must show `npm run check:commit` ending `(no files to check)Skipped` and end `COMMIT_EXIT=0`.
11. Per D-05, run the full gate once on the final tree: `git rev-parse HEAD > tmp/hpr/check-final.sha`, then `npm run check > tmp/hpr/check-final.log 2>&1; echo "CHECK_EXIT=$?" >> tmp/hpr/check-final.log` in the foreground. It must end `CHECK_EXIT=0` and show the six `passed` lines, the all-pair run, and the merged LCOV line. If it fails in a file this plan did not touch, stop and report.
12. Per D-09, edit the main checkout's REVIEW.md at `"$(git rev-parse --path-format=absolute --git-common-dir)/../REVIEW.md"` as W16 says, with the three commit SHAs. Never stage it. If a guard blocks the write from a worktree, write the W16 lines with the SHAs to `tmp/hpr/review-pending.md`, copy them into the summary under "REVIEW.md update pending", and continue.
  </action>
  <verify>
    <automated>S="$(cat tmp/hpr/start-3.txt)" && C="$(cat tmp/hpr/commit-3.sha)" && test "$(git rev-list --count "$S".."$C")" -eq 1 && git merge-base --is-ancestor "$C" HEAD && D="$(git diff --name-status "$S" "$C")" && test "$(printf '%s\n' "$D" | LC_ALL=C sort | tr '\t\n' '  ')" = "M .planning/codebase/CONVENTIONS.md M .planning/codebase/STACK.md M .planning/codebase/TESTING.md M AGENTS.md M CHANGELOG.md M CONTRIBUTING.md M docs/guidelines/typescript-unit-testing-guidelines.md M skills/local-verification/SKILL.md M skills/typescript-unit-testing-review/SKILL.md M skills/typescript-unit-testing/SKILL.md " && /usr/bin/python3 -c 'import re, subprocess, sys
S, C = sys.argv[1], sys.argv[2]
at = lambda rev, p: subprocess.run(["git", "show", rev + ":" + p], capture_output=True, text=True, check=True).stdout
git_re = r"(?ms)^(- Git commit messages and PR titles:[^\n]*\n)(.*?)(?=^- NEVER use `--no-verify`)"
bv_re = r"(?ms)^(### Build verification\n)(.*?)(?=^### Versioning\n)"
qb_re = r"(?m)^- \*\*Quality bar:\*\*.*\n"
strip = lambda t: re.sub(qb_re, "", re.sub(bv_re, r"\1", re.sub(git_re, r"\1", t)))
ao, an = at(S, "AGENTS.md"), at(C, "AGENTS.md")
assert strip(ao) == strip(an), "AGENTS.md changed outside the Git bullets, Build verification, and Quality bar"
gitreg = re.search(git_re, an).group(2)
for need in ["SKIP=npm-check pre-commit run --files", "SKIP=npm-check pre-commit run --all-files", "npm run check:commit", "--amend", "foreground", "NOT happen"]:
    assert need in gitreg, ("AGENTS.md Git", need)
bv = re.search(bv_re, an).group(2)
for need in ["skills/local-verification/SKILL.md", "npm run check:commit", "not a full verdict", "npm run check", "post-merge", "e2e", "empty cache", "main checkout"]:
    assert need in bv, ("AGENTS.md Build verification", need)
assert "direct coverage" in re.search(qb_re, an).group(0), "Quality bar"
so, sn = at(S, "skills/local-verification/SKILL.md"), at(C, "skills/local-verification/SKILL.md")
assert so.split("\n---\n", 1)[0] == sn.split("\n---\n", 1)[0], "skill frontmatter"
for need in ["check:static", "check:commit", "SKIP=npm-check pre-commit run --files", "not a full verdict", "workflow.test_command", "main checkout", "hash-stability", "scripts/test-reporter.mjs", "tsconfig.json", "e2e", "Reuse a passing result only from this session"]:
    assert need in sn, ("skill", need)
for stale in ["changed pairs on pull requests", "is the full verdict", ";"]:
    assert stale not in sn, ("skill", stale)
def changed(path):
    a, b = at(S, path).splitlines(), at(C, path).splitlines()
    assert len(a) == len(b), (path, "line count changed")
    return [(x, y) for x, y in zip(a, b) if x != y]
(w,) = changed("skills/typescript-unit-testing/SKILL.md")
assert w[0].startswith("- Run `node --test ") and w[1].startswith("- Run `node --test "), w
assert "whole unit suite under 100% coverage thresholds" not in w[1] and "test:coverage:direct:all` for them" not in w[1], w[1]
assert "staged" in w[1] and "npm run check" in w[1] and "all pairs" in w[1], w[1]
(r,) = changed("skills/typescript-unit-testing-review/SKILL.md")
assert r[0].startswith("Use the same project") and r[1].startswith("Use the same project"), r
assert "whole unit suite under 100% coverage thresholds" not in r[1] and "staged" in r[1] and "all pairs" in r[1], r[1]
co, cn = at(S, "CONTRIBUTING.md"), at(C, "CONTRIBUTING.md")
assert co.split("## Checks")[0] == cn.split("## Checks")[0], "CONTRIBUTING.md changed before Checks"
for need in ["npm run check:commit", "npm run check:static", "SKIP=npm-check pre-commit run --all-files", "merge"]:
    assert need in cn, ("CONTRIBUTING.md", need)
(g,) = changed("docs/guidelines/typescript-unit-testing-guidelines.md")
assert g[0].startswith("- Use `npm run test:coverage:direct:all`") and "after shared contract" not in g[1] and "npm run check" in g[1], g
lo, ln = at(S, "CHANGELOG.md"), at(C, "CHANGELOG.md")
old_top = next(l for l in lo.splitlines() if l.endswith("(#236)"))
top = next(l for l in ln.splitlines() if l.endswith("(#236)"))
assert ln.count("(#236)") == 1 and top.startswith("- Internal: ") and "staged files" in top and "run `npm run check`" not in top, top
assert lo.split(old_top)[0] == ln.split(top)[0], "CHANGELOG head changed"
bo, bn = lo.split(old_top, 1)[1].split("\n- ", 1), ln.split(top, 1)[1].split("\n- ", 1)
assert bo[1] == bn[1], "entries after #236 changed"
for keep in [l for l in bo[0].splitlines() if l.strip()]:
    assert keep in bn[0].splitlines(), ("CHANGELOG kept line", keep)
subs = [l for l in bn[0].splitlines() if l.startswith("  - ")]
assert "SonarCloud" in subs[0] and "`check:commit`" in subs[1], subs[:2]
gone = "test:coverage:" + "unit"
cv, st, te = (at(C, ".planning/codebase/" + name) for name in ["CONVENTIONS.md", "STACK.md", "TESTING.md"])
for name, text in [("CONVENTIONS", cv), ("STACK", st), ("TESTING", te)]:
    assert gone not in text and "unit.lcov" not in text, name
assert "check:static" in cv and "check:static" in te and "direct.lcov" in st and "direct.lcov" in te and "direct-coverage" in st and "npm-lint" not in st, "codebase map"
log = lambda name: open("tmp/hpr/" + name, encoding="utf8").read().splitlines()
pc = log("precommit-3.log")
assert pc[-1] == "PRECOMMIT_EXIT=0", "precommit-3"
c3 = log("commit-3.log")
assert c3[-1] == "COMMIT_EXIT=0" and any(re.fullmatch(r"npm run check:commit\.+\(no files to check\)Skipped", l) for l in c3), "commit-3"
fin = log("check-final.log")
assert fin[-1] == "CHECK_EXIT=0", fin[-1]
for step in ["typecheck", "lint", "lint:workflows", "fallow", "format:check", "test:corresponding"]:
    assert any(re.fullmatch(r"passed " + re.escape(step) + r" \(\d+\.\d s\)", l) for l in fin), ("final step", step)
assert any(l.startswith("All-pair run complete: 268 pairs in ") for l in fin) and "Merged LCOV: coverage/direct.lcov (258 records)" in fin, "final check"
assert log("check-final.sha") == [C], "the final check ran on another commit"
print("task 3 ok")' "$S" "$C" && { git grep -q -e "test:coverage:unit" -e "unit\.lcov" -e "unit-coverage" -e "changed pairs on pull requests" -e "coverage-infrastructure changes" "$C" -- . ":!.planning" ":!CHANGELOG.md"; test $? -eq 1; } && { git grep -q -e "test:coverage:unit" -e "unit\.lcov" "$C" -- .planning/codebase; test $? -eq 1; } && R="$(git rev-parse --path-format=absolute --git-common-dir)/../REVIEW.md" && { { grep -q "^- F2: decided" "$R" && grep -q "^- F4: decided" "$R" && grep -q "261005-hpr" "$R"; } || test -s tmp/hpr/review-pending.md; } && test -z "$(git ls-files -- REVIEW.md)"</automated>
  </verify>
  <done>The commit in `tmp/hpr/commit-3.sha` modifies exactly the ten doc paths (D-08). AGENTS.md changed only its two Git bullets, its Build verification paragraph, and its Quality bar line, and the Fallow block is byte-identical. The skill, the unit-testing skills, CONTRIBUTING.md, the guidelines, the #236 entry, and the codebase map state the commit, gate, and CI scopes. No live file asks for a manual all-pair run, names the unit coverage script, or names the unit report. The docs commit skipped `npm-check`. `npm run check` exited 0 on that commit. REVIEW.md records F2 and F4 as decided and stays untracked, or the pending lines are in the summary (D-09).</done>
</task>

</tasks>

## Suggested wording and contracts

Planning rehearsed W5 to W15 (fact 10). Use them as written. Change a sentence only where a simple-english or humanizer self-check rejects it, and keep every statement and every string that a verify checks.

### W1: the `npm-check` hook (Task 1)

Only `name` and `entry` change. The `files` line stays exactly as it is.

```yaml
      - id: npm-check
        name: npm run check:commit
        entry: npm run check:commit
        language: system
        pass_filenames: false
        files: '<unchanged>'
```

### W2a: package.json scripts (Task 1)

Add or set these four keys, in alphabetical position:

```json
"check:commit": "npm run check:static && npm run test:unpaired && npm run test:coverage:direct:commit",
"check:static": "node scripts/run-parallel.mjs typecheck lint lint:workflows fallow format:check test:corresponding",
"test:coverage:direct:commit": "node scripts/test-coverage-direct.mjs --staged",
"test:unpaired": "node --test --test-reporter=./scripts/test-reporter.mjs ${TEST_CONCURRENCY:+--test-concurrency=$TEST_CONCURRENCY} \"tests/architecture/**/*.test.ts\" \"tests/{domain,platform}/**/*-fake.test.ts\"",
```

### W2b: package.json scripts (Task 2)

Set these three keys and delete `test:coverage:unit`:

```json
"check": "npm run check:static && npm run test:unpaired && npm run test:integration && npm run test:coverage:direct:all",
"test:coverage": "rm -rf coverage && mkdir -p coverage && npm run test:coverage:direct:all && npm run test:coverage:integration && npm run test:coverage:e2e",
"test:coverage:direct:all": "mkdir -p coverage && node scripts/test-coverage-direct.mjs --all --report coverage/all-pairs.jsonl --lcov coverage/direct.lcov",
```

### W3a: `scripts/test-coverage-direct.mjs`, staged mode (Task 1)

1. Concurrency. The default worker count in `runPairs` is `TEST_CONCURRENCY` when set, else `availableParallelism()`. The validation and its message stay.
2. Arm. `--staged` as the only argument runs the staged selection. It reads paths only through `gitLines(["diff", "--cached", "--name-only", "--diff-filter=ACMR"])`. On a failed git call it writes `Staged-pair selection failed: <reason>` to stderr and sets exit code 1, like the changed-pair arm. It never calls `changedPaths`, `selectBase`, `git ls-files`, or `git diff HEAD`.
3. Escalation. Take the first staged path, in sorted order, that is under `tests/` and does not end with `.test.ts`, or that equals `package.json`, `package-lock.json`, `tsconfig.json`, `scripts/test-coverage-direct.mjs`, or `scripts/test-reporter.mjs`. If one exists, print `Staged <path> affects every pair. Running all pairs.` and run the all-pair arm with no report and no merged LCOV, so the same enumeration, completeness check, and verdict apply.
4. Pairing. Otherwise pair the staged paths as the changed-pair arm does (`isPairablePath`, `pairForPath`, `pairabilityRefusal`, one pair per source). Print `Staged pairs: <n>`. When n is 0, print `skippedReport` over the staged paths that were passed over. Then call `enforcePairs`.
5. Comment. One short comment above the escalation set says why it exists: a pair test can import support files from any `tests/` root, the two scripts run every pair, and the three files decide the dependencies and compiler settings. No other new comment.
6. Usage message. Add `--staged` to the list of accepted arguments.
7. Unchanged. The no-argument changed-pair arm with its base chain, `--base <ref>`, explicit paths, `--all`, and `--all --report <path>`.

### W3b: `scripts/test-coverage-direct.mjs`, per-pair LCOV (Task 2)

1. `runPair` adds `--test-coverage-include=<sourcePath>` to its `node --test` arguments. A type-only source then yields an LCOV with no record (fact 3).
2. `assertCompleteCoverage` throws `Unexpected LCOV record for <path> in the run for <sourcePath>` when the LCOV holds a record for any other file. This is not a shortfall, so `measurePair` rethrows it. The exactly-one and type-only rules stay.
3. `runPair` reads the LCOV text once, before its `finally` block deletes the temporary directory, and returns it with the record. The rows that `--report` writes keep exactly their current fields.
4. `--all` accepts `--report <path>` and `--lcov <path>`, each optional, each at most once, in either order. Anything else after `--all` is a usage error. With `--lcov`, after `enforcePairs` returns, write the LCOV text of every pair that is not type-only, in enumeration order, to the path, then print `Merged LCOV: <path> (<n> records)`.
5. Usage message: `--all [--report <path>] [--lcov <path>]`.

### W4: `scripts/run-parallel.mjs` (Task 1)

- `node scripts/run-parallel.mjs <npm-script>...` starts `npm run --silent <npm-script>` for every argument at once. Stdin is ignored. Stdout and stderr of each script go into one buffer for that script.
- When all have exited, it prints one line per script in argument order: `passed <script> (<seconds> s)` or `failed <script> (<seconds> s)`, with one decimal. After a `failed` line it prints that script's whole buffer.
- It exits 1 if any script exited non-zero or by a signal, else 0. With no arguments it writes `Pass one or more npm script names.` to stderr and exits 1.
- It imports only `node:` built-ins and writes with `process.stdout.write` and `process.stderr.write`. One short header comment says why it exists: the static checks are independent, so running them at once takes about as long as the slowest one.

### W5: `.github/workflows/ci.yml` jobs (Task 2)

The new `jobs:` block, in this order: `static`, `integration`, `sonarcloud` (only `needs: [check]` becomes `needs: [direct-coverage]`), `e2e-tests` (unchanged), `direct-coverage`, and `package` (only its `needs` changes, to `[static, integration, e2e-tests, direct-coverage]`).

```yaml
  static:
    name: static checks (Node 24)
    runs-on: ubuntu-latest
    # A cold ESLint cache makes the lint the slowest step. The ceiling is sized
    # for a slower runner, not for the measured time.
    timeout-minutes: 15
    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          persist-credentials: false

      - name: Setup Node 24
        uses: actions/setup-node@v7
        with:
          node-version: "24"
          cache: "npm"

      - name: Install dependencies
        run: npm ci --ignore-scripts

      # Typed ESLint rules read other files' types, but the ESLint cache keys
      # each result to the file's own content and the configuration, so a
      # cached pass can be stale. The clean install already starts without
      # node_modules. Removing the cache directory keeps the lint in
      # `check:static` fresh even if node_modules is ever cached. CI is the
      # backstop for cached local lint runs.
      - name: Clear the ESLint cache
        run: rm -rf node_modules/.cache/eslint

      - name: Run the static checks
        # NFR-6: type checking, ESLint, the workflow install-script check,
        # Fallow, Prettier, and source/test pairing, in parallel.
        run: npm run check:static

      - name: Run the unit tests that have no source pair
        run: npm run test:unpaired

  integration:
    name: integration tests (Node 24)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          persist-credentials: false

      - name: Setup Node 24
        uses: actions/setup-node@v7
        with:
          node-version: "24"
          cache: "npm"

      - name: Install dependencies
        run: npm ci --ignore-scripts

      - name: Run the integration tests
        run: npm run test:integration

  # RCOV-03 asks for a dedicated authoritative job rather than a step folded
  # into another job (D-08-16), so a coverage shortfall shows as its own red
  # signal. Every event measures every source-test pair over the whole tree,
  # one focused test run per pair. A change to shared test support can lower
  # the direct coverage of a pair that it never names, and only a whole-tree
  # run sees that before merge. The run takes about two minutes on a hosted
  # runner. The ceiling is sized for a slower runner.
  #
  # The run also writes coverage/direct.lcov, which merges the record of each
  # pair for its own source. The sonarcloud job reads it.
  direct-coverage:
    name: direct coverage (Node 24)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          persist-credentials: false

      - name: Setup Node 24
        uses: actions/setup-node@v7
        with:
          node-version: "24"
          cache: "npm"

      - name: Install dependencies
        run: npm ci --ignore-scripts

      - name: Run direct coverage for every pair
        run: npm run test:coverage:direct:all

      - name: Save the direct coverage report
        uses: actions/upload-artifact@v7
        with:
          name: direct-coverage-lcov
          path: coverage/direct.lcov
          if-no-files-found: error
          overwrite: true
          retention-days: 7
```

### W6: `.github/workflows/lint.yml` (Task 2)

The whole file. Against the current file: the `push` trigger, the SKIP comment, and the `fallow-audit` condition with its comment.

```yaml
name: Lint

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  pre-commit:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          lfs: true
          persist-credentials: false

      - name: Set up Python
        uses: actions/setup-python@v7
        with:
          python-version: "3.12"

      - name: Set up Node.js
        uses: actions/setup-node@v7
        with:
          node-version: "24"
          cache: "npm"

      - name: Run pre-commit
        uses: pre-commit/action@2c7b3805fd2a0fd8c1884dcaebf91fc102a13ecd # v3.0.1
        env:
          # The CI workflow's static, integration, and direct-coverage jobs run
          # the npm checks. These hooks remain enabled for local commits.
          SKIP: prettier,npm-check

  fallow-audit:
    # The audit reports only the findings that a change adds against main, so
    # a push to main has nothing to compare.
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          fetch-depth: 0
          persist-credentials: false

      - name: Run fallow audit
        uses: fallow-rs/fallow@bd8fca5af5df4ccfd94c7a835d17bd93c31a7cef # v3.28.0
        with:
          command: audit
          format: github-annotations
```

### W7: `.github/workflows/sonarcloud.yml` (Task 2)

These two steps replace the download step and the report check. The comment above them stays.

```yaml
      - name: Download the direct coverage report
        uses: actions/download-artifact@v8
        with:
          name: direct-coverage-lcov
          path: coverage

      - name: Require the coverage report
        run: test -s coverage/direct.lcov
```

### W8: `sonar-project.properties` coverage block (Task 2)

This replaces everything from `# Coverage settings.` through the `reportPaths` line.

```properties
# Coverage settings.
# Sonar reads one report, `coverage/direct.lcov`. `npm run test:coverage:direct:all`
# runs the test of each source-test pair alone, requires 100% lines, functions,
# and branches of the source of the pair, and writes the report only after every
# pair passes. So the report Sonar reads is the one the gate accepted (D-01).
#
# Each pair adds only the record for its own source. The run passes
# `--test-coverage-include=<source>` to the test of the pair and refuses a
# report that holds any other file. Without that filter, the run of one pair
# also records the test support and the production modules that it loads, most
# of them partially.
#
# Partial records must not reach Sonar. Node's `--experimental-test-coverage`
# lcov reporter emits one BRDA record per *uncovered V8 block range*, keyed by
# the line its start offset maps to. When a run loads a module but never calls a
# given function, V8 reports that whole function as a single uncovered range
# whose start offset lands on the preceding doc comment, blank line, or `import`
# statement -- so the report grows BRDA records at lines that hold no branch at
# all. Sonar merges lcov reports per (file, line), so it sees a line only one
# report mentions with zero covered conditions and has nothing to max it
# against: the phantom condition survives the merge and no test can ever close
# it. `coverage/integration.lcov` and `coverage/e2e.lcov` load most of the tree
# but execute a fraction of it, so `npm run test:coverage` still writes them,
# and they stay out of Sonar.
#
# The report carries 258 of the 268 `.ts` files under `extensions/`. The ten
# absentees are type-only modules that emit no JS and therefore appear in no
# coverage report of any suite. This is not a coverage exclusion --
# `sonar.sources` is untouched and every source file is still measured.
sonar.javascript.lcov.reportPaths=coverage/direct.lcov
```

### W9: AGENTS.md (Task 3)

W9a, the two bullets that replace the two current `pre-commit run` bullets of `### Git`:

```markdown
- Before `git commit`, run `SKIP=npm-check pre-commit run --files <changed files>`. It runs only the fixers and linters and takes seconds. If a fixer changes a file, restage the file and run the command again until it is clean. To run them on every file, as the CI Lint workflow does, use `SKIP=npm-check pre-commit run --all-files`.
- Then run `git commit` in the foreground with the longest tool timeout available. Its hook runs `npm run check:commit` when a staged file is a build input. Never background it and poll with sleep/grep loops. If a run can outlast the tool's foreground limit, background it once and wait for the completion notification. If a hook fails during `git commit`, the commit did NOT happen: fix the cause, restage, and commit again. Never use `--amend` for this, because it would alter the previous commit. Do not run ESLint, type checking, or tests just before committing: the hook runs the checks for the staged files.
```

W9b, the paragraph under `### Build verification`:

```markdown
Read `skills/local-verification/SKILL.md` when planning or running checks. A build input is a file that a build or a CI job reads. When a staged file is a build input, the pre-commit hook runs `npm run check:commit`. It runs the static checks, the unit tests that have no source pair, and direct coverage for the staged source-test pairs. It runs all pairs when the commit stages shared test support, the test tooling, or a dependency file. A passing hook is not a full verdict, and it cannot satisfy a GSD gate. GSD gates run `npm run check` on the combined tree: the post-merge gate of each wave, the phase gate, the merge gate, and the final PR or release handoff. `npm run check` runs what pull request CI runs, except the e2e tests and ESLint with an empty cache. A merge does not run the hook. So a quick task that commits a build input runs `npm run check` in the main checkout after its worktree is merged, before the task finishes. A gate can reuse a passing result for the same inputs, as the skill defines. This project policy governs the TypeScript and GSD skill instructions.
```

W9c, the Quality bar line:

```markdown
- **Quality bar:** `npm run check` must stay green -- typecheck + ESLint + `fallow` (dead code, health, duplication) + Prettier + source/test pairing + unit tests + integration tests + 100% direct coverage for every source-test pair (NFR-6)
```

### W10: `skills/local-verification/SKILL.md` (Task 3)

The whole file. The frontmatter is the current one. The last two paragraphs are the current ones, verbatim.

```markdown
---
name: local-verification
description: Select and schedule this repository's build checks when planning, implementing, debugging, or verifying changes through GSD.
---

# Local verification

Each check runs at the scope that its moment needs:

- A commit checks the files that it stages. The pre-commit hook `npm-check` runs `npm run check:commit` when a staged file is a build input.
- A GSD gate or a handoff checks the whole tree on this machine with `npm run check`.
- Pull request CI checks the whole tree on a clean machine with network access. It also runs the e2e tests and lints from an empty ESLint cache, which `npm run check` does not.
- CI on `main` repeats the pull request checks, in case a pull request merged without them.
- The nightly e2e run tests against the newest upstream `main` to catch upstream drift.

A build input is a file that a build or a CI job reads. The build inputs are the files that the hook's `files` pattern in `.pre-commit-config.yaml` matches. Both `paths` lists in `.github/workflows/ci.yml` name the same files. Change the three lists together.

## What the commands run

`npm run check:static` runs type checking, ESLint, the workflow install-script check, Fallow, the Prettier check, and source/test pairing at the same time. It prints one line for each passing step and the full output of each failing step.

`npm run check:commit` runs `check:static`, then the unit tests that have no source pair (`tests/architecture/` and the four fake contract suites), then direct coverage for the staged source-test pairs. It reads only the staged files. Unstaged edits and untracked files do not count. It runs all pairs when a staged file can change the coverage of any pair: a file under `tests/` that is not a `.test.ts` file (a fake, contract, fixture, or harness), `scripts/test-coverage-direct.mjs`, `scripts/test-reporter.mjs`, `package.json`, `package-lock.json`, or `tsconfig.json`.

`npm run check` runs `check:static`, the unit tests that have no source pair, the integration suite, and direct coverage for all pairs. Direct coverage runs the test of each pair alone and requires 100% line, function, and branch coverage of its source. Every source has exactly one paired test, so this also covers the whole unit suite.

## Committing

Run `SKIP=npm-check pre-commit run --files <changed files>` first. It runs only the fixers and linters and takes seconds. If a fixer changes a file, restage the file and run the command again until it is clean.

Then run `git commit` in the foreground with the longest tool timeout available. Never background it and poll with sleep/grep loops. If a run can outlast the tool's foreground limit, background it once and wait for the completion notification. If a hook fails, the commit did not happen. Fix the cause, restage, and commit again. Never use `--amend` for this.

During `git commit`, pre-commit stashes unstaged edits. It does not move untracked files, so stage or remove untracked build inputs before you commit. The pre-commit tool passes no deleted file to a hook, and it applies its top-level `exclude` first. So the hook skips a commit that only deletes build inputs or only changes files under `tests/domain/fixtures/hash-stability/`. Run `npm run check` yourself before such a commit.

Use the owner test (`node --test <test-path>`) or a named suite (`test:modules`, `test:architecture`, `test:integration`, `test:e2e`) for feedback while you edit. Do not run ESLint, type checking, or tests just before a commit. The hook runs them.

ESLint keeps a cache in `node_modules/.cache/eslint/`. The cache keys each result to the file's content and the configuration. Typed rules also read other files' types, so a cached pass can be stale after another file changes. CI lints from an empty cache and is the backstop. To lint fresh locally, delete that directory first.

## Planning and GSD gates

A passing hook is not a full verdict, and it cannot satisfy a GSD gate. Give each task a concrete `<verify>` command, and record the hook result of each commit in the summary.

Keep `workflow.test_command` set to `npm run check`. A merge does not run the hook. So GSD's post-merge gate for each wave, the phase gate, the merge gate, and the final PR or release handoff run `npm run check` on the combined tree. A quick task that commits a build input runs `npm run check` in the main checkout after its executor worktree is merged, before the task finishes. The 2,400-second GSD timeout is a limit, not a passing result.

Reuse a passing result only from this session and only for unchanged inputs. Record the command, exit status, commit, and Node version in the summary. Use a clean verified commit as the reference. If verification ran on a dirty tree, retain its exact diff and untracked file contents for comparison. A list of changed paths is not enough. Planning-only Markdown commits can reuse a result if `git diff <verified-commit> -- . ':(exclude,glob).planning/**/*.md'` is empty and no new untracked executable inputs exist. Never reuse a result after changes to source, test support, dependencies, configuration, runtime, or installed tools. If the prior state or result is uncertain, rerun. No persistent success marker or custom cache replaces this comparison.

This project policy takes precedence over generic skill instructions to run the full suite after every task or review fix. It does not permit skipping a required combined-tree or handoff gate, or accepting a failed or timed-out run.
```

### W11: the unit-testing skills (Task 3)

W11a, the writer skill bullet:

```markdown
- Run `node --test <test-path>` while developing. Follow `skills/local-verification/SKILL.md` for task and full-project gates. Use `npm run test:coverage:direct -- <path>` for a pair's direct coverage. The pre-commit hook measures direct coverage for the staged pairs, and for all pairs when a commit stages shared test support such as a contract, fake, fixture, or harness. `npm run check` and CI measure all pairs. Combined GSD merge/phase and final PR/release gates need the full check.
```

W11b, the review skill paragraph:

```markdown
Use the same project's scheduling policy for full verification: the pre-commit hook measures direct coverage for the staged pairs, or for all pairs after a shared contract, fake, or harness change, and `npm run check` and CI measure all pairs. Combined GSD merge/phase or final PR/release gates require a full result. Do not repeat a full check when valid unchanged-input evidence already supplies it.
```

### W12: `CONTRIBUTING.md`, from `## Checks` to the end (Task 3)

````markdown
## Checks

```bash
npm run check          # full local gate: static checks, unit tests, direct coverage for every pair, integration tests
npm run check:static   # typecheck, lint, fallow, format check, and gate scripts, in parallel
npm run lint:fix       # ESLint with autofixes
npm run format         # Prettier autoformat
SKIP=npm-check pre-commit run --all-files
```

When a commit stages a file that the build or CI reads, the pre-commit hook runs `npm run check:commit`. It runs the static checks, the unit tests that have no source pair, and direct coverage for the staged source-test pairs only, so it is not a full check. Run `npm run check` before you open a pull request and after a merge, because a merge does not run the hook.
````

### W13: `docs/guidelines/typescript-unit-testing-guidelines.md` (Task 3)

```markdown
- Use `npm run test:coverage:direct:all` to measure every pair. `npm run check` runs it, and the pre-commit hook runs all pairs when a commit stages shared test support or the coverage tooling.
```

### W14: `CHANGELOG.md`, the #236 entry (Task 3)

The new top line and the two new first sub-bullets. The blank line after the top line and the existing sub-bullets stay.

```markdown
- Internal: commits run quick checks on their staged files, CI runs only on build-input changes, and ESLint alone bans stdio calls. (#236)

  - Pull requests, pushes to `main`, and `npm run check` measure direct coverage for every source-test pair, and SonarCloud reads that per-pair coverage.
  - The `check:static` and `check:commit` scripts are new, and the `test:coverage:unit` script no longer exists.
```

### W15: `.planning/codebase/` lines (Task 3)

Each item replaces the one line that starts as named.

- CONVENTIONS.md, the line that starts "- `npm run check` is":

  ```markdown
  - `npm run check` is `check:static` (`typecheck`, `lint`, `lint:workflows`, `fallow`, `format:check`, and `test:corresponding`, run in parallel by `scripts/run-parallel.mjs`), then `test:unpaired`, `test:integration`, and `test:coverage:direct:all` — **fallow is a mandatory member of the check chain, not an optional extra.** Always mention it when describing "the gate." The pre-commit hook runs `check:commit`: `check:static`, `test:unpaired`, and direct coverage for the staged pairs only.
  ```

- STACK.md, the line that starts "- Coverage via":

  ```markdown
  - Coverage via `node --test --experimental-test-coverage` with `lcov` reporters. `npm run test:coverage:direct:all` runs each source-test pair alone and merges each pair's record for its own source into `coverage/direct.lcov`, the only report SonarCloud reads (`sonar.javascript.lcov.reportPaths=coverage/direct.lcov` in `sonar-project.properties`). `npm run test:coverage` also writes the partial-surface `coverage/integration.lcov` and `coverage/e2e.lcov`, which stay out of Sonar
  ```

- STACK.md, the line that starts "- `pre-commit` framework":

  ```markdown
  - `pre-commit` framework (`.pre-commit-config.yaml`) runs trufflehog, gitlint, yamllint, yamlfmt, mdformat, markdownlint-cli2, zizmor, texthooks (smartquotes/dashes/ligatures/bidi-control fixers), plus two local hooks: `prettier` (formats staged files) and `npm-check` (`pass_filenames: false`), which runs `npm run check:commit` when a staged file is a build input. Its `files:` pattern names the same build inputs as both `paths` lists in `ci.yml`, so a docs-only commit skips it
  ```

- STACK.md, the line that starts "- `ci.yml` -":

  ```markdown
  - `ci.yml` - `workflow_call` (invoked by `publish.yml`), plus `push`/`pull_request` on `main` (a `paths` allowlist of build inputs), plus `workflow_dispatch`. Jobs: `static` (`npm run check:static`, then `npm run test:unpaired`), `integration` (`npm run test:integration`), `direct-coverage` (`npm run test:coverage:direct:all` on every event, uploads `coverage/direct.lcov`), `e2e-tests` (pinned ref), `sonarcloud` (calls `sonarcloud.yml` after `direct-coverage`), and `package` (`npm pack --dry-run`, after the four test jobs). All run on Node 24. There is deliberately no `push` trigger on `features/**` branches
  ```

- STACK.md, the line that starts "- `lint.yml` -":

  ```markdown
  - `lint.yml` - `push` and `pull_request` on `main` + `workflow_dispatch`. Two jobs: `pre-commit` (runs the full `.pre-commit-config.yaml` pipeline via `pre-commit/action@v3.0.1`, skipping `prettier` and `npm-check`) and `fallow-audit` (pull requests only; the vendor `fallow-rs/fallow@v3` action, `command: audit`, `format: github-annotations`, `fetch-depth: 0`) -- separate from and additional to the `npm run fallow` gate embedded in `npm run check`
  ```

- STACK.md, the line that starts "- `sonarcloud.yml` -":

  ```markdown
  - `sonarcloud.yml` - reusable workflow that `ci.yml` calls after `direct-coverage`; skipped for release tags, Dependabot, and fork PRs (no secrets access); downloads `coverage/direct.lcov` from the same run, then runs `SonarSource/sonarqube-scan-action@v8`
  ```

- TESTING.md, the line that starts "npm run test:coverage " inside the Run Commands block:

  ```text
  npm run test:coverage    # direct coverage for every pair, then integration and e2e under --experimental-test-coverage, emits coverage/{direct,integration,e2e}.lcov
  ```

- TESTING.md, the line that starts "npm run check " inside the Run Commands block:

  ```text
  npm run check            # check:static (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, in parallel) && test:unpaired && test:integration && test:coverage:direct:all (no e2e)
  ```

- TESTING.md, the line that starts "**Requirements:**" under `## Coverage`:

  ```markdown
  **Requirements:** Gated in `npm run check` by `test:coverage:direct:all`: each source-test pair runs alone and must reach 100% lines, functions, and branches of its own source. The pre-commit hook measures only the staged pairs. The merged per-pair report `coverage/direct.lcov` feeds SonarCloud (`sonar-project.properties`).
  ```

- TESTING.md, the line that starts "# emits coverage/" under View Coverage:

  ```text
  # emits coverage/direct.lcov, coverage/integration.lcov, coverage/e2e.lcov
  ```

### W16: commit messages and REVIEW.md

Each message ends with these two lines after a blank line:

```text
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y17L76i3FvJ4cRAFfmHL5W
```

commit-1:

```text
perf(checks): run staged pairs and parallel static checks on commit

The pre-commit hook now runs npm run check:commit when a staged file is
a build input. It runs the static checks in parallel, the unit tests
that have no source pair, and direct coverage for the staged
source-test pairs only. A staged test-support file, a pair-tooling
script, or a dependency file runs all pairs instead.

The staged selection reads only the index, so unstaged edits and
untracked files no longer select pairs or stop the run. Direct coverage
now starts one worker per available CPU unless TEST_CONCURRENCY is set.
```

commit-2:

```text
ci: run each check in its own job and feed Sonar per-pair coverage

npm run check now runs the static checks, the unpaired unit tests, the
integration suite, and direct coverage for every pair. It no longer
runs whole-suite unit coverage, because 100% direct coverage for every
pair already implies it.

CI splits the gate into static, integration, and direct-coverage jobs.
Direct coverage measures every pair on every event, so a change to
shared test support cannot lower another pair's coverage unseen before
merge. Each pair records only its own source, and SonarCloud reads the
merged report. The Lint workflow also runs on pushes to main, and the
Fallow audit runs only for pull requests.
```

commit-3:

```text
docs: describe the commit, gate, and CI check scopes

Agents now run the fixers and linters with npm-check skipped, then
commit and let the hook run npm run check:commit. A passing hook is not
a full verdict: GSD gates and the final handoff run npm run check, and
a quick task runs it after its worktree is merged. The docs drop the
manual all-pair run after shared test changes, because npm run check
and CI now measure every pair.
```

REVIEW.md, "Decisions and status" section: insert the F2 line right before the F4 line, replace the F4 line, and delete `F2, ` from the line that starts `- Open:`. Change nothing else.

```markdown
- F2: decided in quick task `261005-hpr` (`<commit-1>`, `<commit-2>`, `<commit-3>`). `npm run check`, pull request CI, and CI on `main` measure direct coverage for all pairs. The commit hook measures the staged pairs, and all pairs when shared test support, the pair tooling, or a dependency file is staged. `npm run check` no longer runs whole-suite unit coverage, and Sonar reads the merged per-pair report `coverage/direct.lcov`. The two skill sentences are fixed.
- F4: decided in quick task `261005-hpr`. Agents run `SKIP=npm-check pre-commit run --files <changed files>` (fixers and linters, seconds), then `git commit`, whose hook runs `npm run check:commit`. A hook pass is not a full verdict, and GSD gates run `npm run check`. `fallow agent install` regenerates the Fallow block in `AGENTS.md` with its commit and push audit step and has no option that drops only that step, so the block stays.
```

<threat_model>
## Trust Boundaries

| Boundary | Description |
| --- | --- |
| index -> commit | The `npm-check` hook decides, from the staged paths only, which checks gate a commit. |
| pull request or push -> CI | ci.yml `needs` decide what gates `package` and Sonar. lint.yml triggers decide when the hooks run in CI. |
| CI artifact -> SonarCloud | The merged LCOV decides what coverage Sonar reports. |
| operator edits -> this plan's commits | The operator edits files in the main checkout at the same time. |

## STRIDE Threat Register

ASVS level 1. Blocking threshold `high`. No threat below is high.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
| --- | --- | --- | --- | --- | --- |
| T-hpr-01 | Tampering | staged selection in `scripts/test-coverage-direct.mjs` | medium | mitigate | By design a commit measures only its staged pairs, so a change can lower another pair's coverage at commit time. Any staged test support, pair tooling, or dependency file runs all pairs (probe P2). `npm run check`, every pull request, and every push to `main` measure all pairs (the Task 2 verify pins `direct-coverage` with no event condition). Staged deletions do not escalate (choice 3); the summary flags it. |
| T-hpr-02 | Tampering | merged LCOV read by SonarCloud | medium | mitigate | Each pair passes the include flag, and the run refuses a record for any other file, so test-support or partial records cannot reach Sonar. The Task 2 verify proves 258 records, all for production sources, each at 100%. |
| T-hpr-03 | Denial of service | ci.yml job wiring | medium | mitigate | A wrong `needs` could let `package` pass without a gate or keep Sonar from running. The Task 2 verify pins the job set, the `needs` of `package` and `sonarcloud`, and the unchanged triggers, concurrency, and permissions. |
| T-hpr-04 | Elevation of privilege | lint.yml `push` trigger | low | accept | The push run is the existing pre-commit job with `contents: read`, no secrets, and `persist-credentials: false`. zizmor checked the file in the rehearsal and checks it again in Task 2. |
| T-hpr-05 | Repudiation | concurrent operator edits | low | mitigate | Explicit-path staging. Each verify pins the exact name-status set of its commit. REVIEW.md and the uqn plan stay untracked. |
| T-hpr-06 | Information disclosure | temp-index probes | low | accept | The probe blobs and copied index files stay local. The index copies are deleted in Task 1, and `tmp/hpr/` after the summary. |
| T-hpr-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no package. The new wrapper uses only Node built-ins. |
</threat_model>

<verification>
Run each task's verify right after its commit and before `tmp/hpr/` is removed. Each verify reads the recorded start and commit SHAs, so all three still pass after Task 3.

- Commit-time evidence: Task 1 and Task 2 commits ran `npm run check:commit` through the hook, escalated to all pairs by the staged `package.json`. The Task 3 commit skipped it, as a docs-only commit must. Per D-08 these are not a full verdict.
- Full verdict: Task 3 step 11 runs `npm run check` on the final commit (`tmp/hpr/check-final.sha`). Record the command, exit status, commit, and Node version in the summary.
- Post-merge gate (D-08, the rule this plan writes): after the executor worktree is merged, the main session runs `npm run check` in the main checkout before the quick task finishes. It may reuse the Task 3 result only under the skill's reuse rule, that is, when `git diff <check-final sha> -- . ':(exclude,glob).planning/**/*.md'` is empty in the main checkout.
- CI runs on the pull request: the first real run of the split jobs, the per-pair include on Node 24, and the Sonar input (D-04: the operator checks the Sonar result there).
</verification>

<success_criteria>
- A commit that stages a build input runs `npm run check:commit`: six static steps in parallel, the unpaired unit tests, and direct coverage for the staged pairs only, or for all pairs after a staged support, tooling, or dependency change.
- `npm run check` runs `check:static`, `test:unpaired`, `test:integration`, and `test:coverage:direct:all`, and passes on the final tree.
- `coverage/direct.lcov` holds exactly the 258 non-type-only sources at 100%, and CI hands it to Sonar.
- CI runs static, integration, direct-coverage (all pairs, every event), e2e, sonarcloud, and package, and the Lint workflow runs on pushes to `main`.
- The instructions say that a hook pass is not a full verdict, that GSD gates and quick tasks run `npm run check`, and how to commit. No live doc asks for a manual all-pair run.
- Three commits, every log ends with its expected exit code, REVIEW.md records F2 and F4, and REVIEW.md and the uqn plan stay untracked.
</success_criteria>

## Source audit

| Source | Item | Plan coverage | Status |
| --- | --- | --- | --- |
| GOAL | Restructure verification checks by granularity (REVIEW.md F2, F4) | Tasks 1-3 | COVERED |
| CONTEXT | D-01: concurrency default, `TEST_CONCURRENCY` override | Task 1 step 2; W3a item 1 | COVERED |
| CONTEXT | D-02: staged-only ACMR selection, no untracked, no unstaged | Task 1 step 3; W3a item 2; probes P1, P3 | COVERED |
| CONTEXT | D-03: escalation for test support, `scripts/test-reporter.mjs`, dependency and configuration inputs | Task 1 step 3; W3a item 3; choice 3; probe P2 | COVERED |
| CONTEXT | D-04: per-pair include or raw own record, merged LCOV from the all-pair run, no `tests/` records, captured before the temp directory goes | Task 2 steps 2, 9; W3b | COVERED |
| CONTEXT | D-04: Sonar reads it: ci.yml upload, sonarcloud.yml download and check, `reportPaths`, refreshed comments | Task 2 steps 4, 6, 7; W5, W7, W8 | COVERED |
| CONTEXT | D-05: `check:static` parallel wrapper, no dependency, fails on any, prints failing output | Task 1 steps 4-5; W2a, W4 | COVERED |
| CONTEXT | D-05: `check:commit`; pair and non-pair classification verified (globs) | Task 1 step 5; fact 2; choice 1 | COVERED |
| CONTEXT | D-05: `check` chain without whole-suite unit coverage; decide on `test:coverage:unit` and `test:coverage` | Task 2 step 3; W2b; choice 4; fact 7 | COVERED |
| CONTEXT | D-05: `workflow.test_command` stays; hook runs `check:commit` with its `files` pattern | Task 1 step 6; W1; W10 | COVERED |
| CONTEXT | D-06: ci.yml jobs, steps removed, header rewritten, timeouts, artifact, `needs`, filters and concurrency kept, tag skip kept, publish.yml unchanged | Task 2 step 4; W5; choice 8 | COVERED |
| CONTEXT | D-07: lint.yml `push` on `main`, `fallow-audit` pull requests only | Task 2 step 5; W6 | COVERED |
| CONTEXT | D-08: AGENTS.md Git bullets incl. `--all-files`, Build verification, Quality bar | Task 3 step 2; W9 | COVERED |
| CONTEXT | D-08: local-verification skill, unit-testing skills, CONTRIBUTING.md, codebase map | Task 3 steps 3-5, 8; W10-W12, W15 | COVERED |
| CONTEXT | D-08: new rules (commit procedure, hook not a full verdict, GSD gates, quick-task post-merge check, no manual all-pair run, plain style) | W9, W10, W11, W13; Task 3 step 9 | COVERED |
| CONTEXT | D-08: Fallow audit step: search for an option, else leave the block and record it | Fact 6; choice 10; Task 3 step 2; output | COVERED |
| CONTEXT | D-09: REVIEW.md F2 and F4 decided, never committed | Task 3 step 12; W16 | COVERED |
| CONTEXT | D-10: no pre-push hook, no fixer-based skip, base chain and `--base` kept | Choice 2; W3a item 7; probe P4 | COVERED |
| CONTEXT | Verification: full `npm run check`; staged run shows only the staged pair; escalation runs all pairs; merged LCOV per-source and nothing under `tests/` | Task 3 step 11; probes P1, P2; Task 2 verify | COVERED |
| CONTEXT | Repo rules: Conventional Commits, branch, no `--no-verify`, no amend or rebase, explicit staging, fish-safe instructions | Execution rules; W16; W9-W12 avoid `$VAR` splitting | COVERED |
| REQ | HPR-01 to HPR-07 | Requirement map | COVERED |
| RESEARCH | None: the orchestrator asked for no research | - | N/A |

<output>
Create `.planning/quick/261005-hpr-restructure-verification-checks-by-granu/261005-hpr-SUMMARY.md` with `status: complete` in its frontmatter. Record:

- the three commit SHAs
- the last line of every `tmp/hpr/*.log`, and the `npm run check:commit` line of each `commit-N.log` (`Passed`, `Passed`, `(no files to check)Skipped`)
- the six static step times from `tmp/hpr/p1.log`, and the all-pair times from `p2.log`, `direct-all.log`, and `check-final.log`
- the output of `node --version`
- the line "Full verification passed: `npm run check` exited 0 on `<check-final sha>`."
- flags for the operator:
  1. The Fallow block in AGENTS.md still tells agents to run `fallow audit` before each commit and push. `fallow agent install` 3.27.0 has no option that drops only that step. `--without guide` in `scripts/init.sh` would drop the whole block, task map included (fact 6).
  2. A staged deletion of test support does not escalate (ACMR, choice 3). A commit that only deletes build inputs, or only changes hash-stability fixtures, still skips the hook.
  3. The per-pair include flag and the Sonar input run on CI (Node 24) for the first time in the pull request (D-04).
  4. The untracked uqn plan names files that this task changed (package.json, ci.yml, CONTRIBUTING.md, the local-verification skill). It needs a new plan.
  5. CHANGELOG.md #236, TESTING.md, and the unit-testing guidelines changed although the operator's list did not name them (choice 9).
  6. The main session runs `npm run check` in the main checkout after the merge, or reuses the Task 3 result under the skill's rule (verification).
  7. REVIEW.md: applied, or the pending lines under "REVIEW.md update pending".
  8. `check:static` hides the output of a passing step, ESLint warnings included (choice 11).

Include:

```markdown
## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
```

Replace "None" with specifics if execution finds otherwise. Remove `tmp/hpr/` after the summary is written.
</output>
