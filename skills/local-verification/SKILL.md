---
name: local-verification
description: Select and schedule this repository's build checks when planning, implementing, debugging, or verifying changes through GSD.
---

# Local verification

A build input is a file that a build or a CI job reads. The pre-commit hook `npm-check` runs `npm run check` when a staged file is a build input, and skips otherwise. `npm run check` is the whole gate. It runs type checking, ESLint, the workflow install-script check, Fallow, the Prettier check, and source/test pairing. Then it runs the unit suite at 100% coverage and the integration suite. A passing hook is the full verdict for its commit.

The build inputs are the files that the hook's `files` pattern in `.pre-commit-config.yaml` matches. Both `paths` lists in `.github/workflows/ci.yml` name the same files. Change the three lists together. The pre-commit tool passes no deleted file to a hook, and it applies its top-level `exclude` first. So the hook skips a commit that only deletes build inputs or only changes files under `tests/domain/fixtures/hash-stability/`. Run `npm run check` yourself before such a commit. CI runs direct coverage for changed pairs on pull requests and for all pairs on main.

## Running checks

Use the owner test (`node --test <test-path>`) or a named suite (`test:modules`, `test:architecture`, `test:integration`, `test:e2e`) for feedback while you edit. Do not run `npm run check`, ESLint, type checking, or tests just before a commit. The hook runs the gate.

Run `pre-commit run --files <changed files>` in the foreground with the longest tool timeout available. A warm `npm run check` takes about 90 seconds. With a cold ESLint cache, it takes about five minutes. Never background it and poll with sleep/grep loops. If a run can outlast the tool's foreground limit, background it once and wait for the completion notification. During `git commit`, pre-commit stashes unstaged edits, but `pre-commit run --files` does not. Neither moves untracked files, so stage or remove untracked build inputs before you commit.

ESLint keeps a cache in `node_modules/.cache/eslint/`. The cache keys each result to the file's content and the configuration. Typed rules also read other files' types, so a cached pass can be stale after another file changes. CI lints from an empty cache and is the backstop. To lint fresh locally, delete that directory first.

## Planning and GSD gates

Give each task a concrete `<verify>` command. When a task commits a build input, the hook gives the full verdict. Record its `npm run check` result in the summary, and do not run the gate again to mark the task complete.

Keep `workflow.test_command` set to `npm run check`. A merge does not run the hook. So GSD's post-merge and phase gates run `npm run check` on the combined tree, and the final PR or release handoff needs a passing run on the final tree. CI runs it on pull requests that change a build input. The 2,400-second GSD timeout is a limit, not a passing result.

Reuse a passing result only from this session and only for unchanged inputs. Record the command, exit status, commit, and Node version in the summary. Use a clean verified commit as the reference. If verification ran on a dirty tree, retain its exact diff and untracked file contents for comparison. A list of changed paths is not enough. Planning-only Markdown commits can reuse a result if `git diff <verified-commit> -- . ':(exclude,glob).planning/**/*.md'` is empty and no new untracked executable inputs exist. Never reuse a result after changes to source, test support, dependencies, configuration, runtime, or installed tools. If the prior state or result is uncertain, rerun. No persistent success marker or custom cache replaces this comparison.

This project policy takes precedence over generic skill instructions to run the full suite after every task or review fix. It does not permit skipping a required combined-tree or handoff gate, or accepting a failed or timed-out run.
