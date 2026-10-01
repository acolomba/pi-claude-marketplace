---
name: local-verification
description: Select and schedule this repository's build checks when planning, implementing, debugging, or verifying changes through GSD.
---

# Local verification

Use `npm run check:changed` for feedback during work. It compares HEAD with the index, worktree, and untracked files. After committing, use an explicit task base: `npm run check:changed -- --base <start-commit>`. `--list` previews the selection without running checks. A focused pass is not completion evidence.

## Planning and implementation

Give each task a concrete `<verify>` command. Use an owner test while editing, then changed checks across the task's entire diff. Named suite commands are `test:modules`, `test:architecture`, `test:analyzers`, `test:integration`, and `test:e2e`. Use them when the work specifically concerns that suite.

The selector follows production imports, re-exports, and type references. Shared test support, removals, tool/config changes, or uncertain selection run the full check and all-pair coverage. Markdown under `.planning/` and `skills/`, plus AGENTS.md, CLAUDE.md, and CONTRIBUTING.md, needs the document hooks only.

Run the prescribed pre-commit checks before committing. They perform the same changed checks. Do not rerun a separate full command merely because a hook already ran that exact command successfully over the final inputs.

## Completion and GSD gates

Keep `workflow.test_command` set to `npm run check`. Full typed lint and member analysis belong at completion and CI. The 2,400-second GSD timeout is a limit, not a passing result. After merging work from multiple plans, verify the combined tree before marking it complete.

When GSD's post-merge, regression, or verifier step repeats a full check, reuse passing evidence only from this session and only for unchanged inputs. Record the command, exit status, commit, Node version, and scope in the summary. Use a clean verified commit as the reference. If verification ran on a dirty tree, retain its exact diff and untracked file contents for comparison; a list of changed paths is not enough. Planning-only Markdown commits can reuse evidence if `git diff <verified-commit> -- . ':!.planning/**/*.md'` is empty and no new untracked executable inputs exist. Never reuse after changes to source, test support, dependencies, configuration, runtime, or installed tools. If the prior state or result is uncertain, rerun. No persistent success marker or custom cache replaces this comparison.

The project permits this evidence reuse instead of repeating the same command in multiple GSD gate steps. It does not permit replacing a full result with a focused one, skipping an unrun check, or accepting a failed or timed-out run.
