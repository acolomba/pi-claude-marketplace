---
name: local-verification
description: Select and schedule this repository's build checks when planning, implementing, debugging, or verifying changes through GSD.
---

# Local verification

Use owner tests while editing and the prescribed pre-commit hooks as the normal task gate. Those hooks already run `npm run check:changed`; do not routinely run that command separately just before the hooks.

Run `pre-commit run --files <changed files>` in the foreground with the longest tool timeout available; a full-scope run can take many minutes. Never background it and poll with sleep/grep loops. If a run can outlast the tool's foreground limit, background it once and wait for the completion notification. Do not run ESLint, type checking, or tests just before committing; the hook runs the checks the change needs, and `npm run check:changed -- --list` previews them.

## Planning and implementation

Give each task a concrete `<verify>` command and retain its starting commit. Named suite commands are `test:modules`, `test:architecture`, `test:analyzers`, `test:integration`, and `test:e2e`. Use an owner test or the relevant suite for feedback before committing.

An ordinary quick task, individual plan task, or review fix may complete with passing focused checks covering its entire change. For a single-commit task, the successful pre-commit run supplies that evidence. Do not append `npm run check` merely to mark the task complete. Record `focused task verification passed; full phase/PR verification pending` in its summary.

`check:changed` compares HEAD with the index, worktree, and untracked files. After committing, its default comparison no longer covers that commit: use `npm run check:changed -- --base <start-commit>` when fresh task-wide verification is needed. `--list` previews selection. An empty selection does not verify committed code. For multi-commit tasks, reuse the per-commit results only when they cover the whole task and later changes have not invalidated earlier evidence; otherwise run against the task base. Also run any acceptance checks the selector does not cover.

The selector follows production imports, re-exports, and type references. An unpaired test runs itself. Test support runs the tests that import it or name its file, or its suite when none do. A test fixture runs its suite and `test:architecture`. Documentation, the READMEs, and CHANGELOG.md run `test:architecture`. An analyzer script with a matching `tests/scripts` test runs `test:analyzers` and its negative control. Type-member contract data runs `lint:type-members`. Files under `.planning/` and Markdown under `skills/`, plus AGENTS.md, CLAUDE.md, and CONTRIBUTING.md, need the document hooks only, except the few files a test reads, which run that test. Removals, package, tool, configuration, and CI changes, end-to-end and live-UAT files, and unrecognized or uncertain inputs run the full `npm run check`. CI runs direct coverage for changed pairs on pull requests and for all pairs on main. Full runs take a lock in the git common directory, so worktrees run them one at a time, and each run that executes checks appends one JSON line to `check-changed.log` in that directory.

Pre-commit remains mandatory before each commit, even if checks were run manually earlier. A successful hook can satisfy a requested focused or full command only when it actually ran that command over the required inputs. This is a scheduling policy, not an automatic hook-result cache.

## Completion and GSD gates

Keep `workflow.test_command` set to `npm run check`. Full verification is required for GSD's combined post-merge/phase gates and final PR or release handoff, and CI continues to run it. The selector's full-completion reminder refers to these boundaries. It covers architecture, integration, full typed lint, and member analysis. After combining plans, check the combined tree; separate task passes cannot prove it. The 2,400-second GSD timeout is a limit, not a passing result.

When GSD's post-merge, regression, or verifier step repeats a full check, reuse passing evidence only from this session and only for unchanged inputs. Record the command, exit status, commit, Node version, and scope in the summary. Use a clean verified commit as the reference. If verification ran on a dirty tree, retain its exact diff and untracked file contents for comparison; a list of changed paths is not enough. Planning-only Markdown commits can reuse evidence if `git diff <verified-commit> -- . ':(exclude,glob).planning/**/*.md'` is empty and no new untracked executable inputs exist. Never reuse after changes to source, test support, dependencies, configuration, runtime, or installed tools. If the prior state or result is uncertain, rerun. No persistent success marker or custom cache replaces this comparison.

This project policy takes precedence over generic skill instructions to run the full suite after every task or review fix. It permits focused task completion and reuse at the appropriate scope. It does not permit calling a focused result full-project verification, skipping a required combined-tree or handoff gate, or accepting a failed or timed-out run.
