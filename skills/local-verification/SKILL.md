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
