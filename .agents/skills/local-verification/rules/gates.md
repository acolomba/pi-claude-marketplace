# Completion and GSD gates

Part of the `local-verification` skill: `.agents/skills/local-verification/SKILL.md`.

A passing commit hook is incremental evidence, not full verification. Give each task a concrete `<verify>` command and record each commit hook result. Keep `workflow.test_command` set to `npm run check`. GSD's post-merge wave, phase, and merge gates run it on the combined tree. A quick task that commits a build input also runs it in the main checkout after merging its executor worktree, before completion. The 2,400-second timeout is a limit, not a passing result. Final PR/release handoff requires the full check.

Reuse passing evidence only from this session and for unchanged inputs. Record the command, exit status, commit, Node version, and scope. Use a clean verified commit as the reference; for a dirty tree, retain its exact diff and untracked contents for comparison. A path list is insufficient. Planning-only Markdown commits may reuse evidence if `git diff <verified-commit> -- . ':(exclude,glob).planning/**/*.md'` is empty and no new untracked executable inputs exist. Never reuse after source, test support, dependency, configuration, runtime, or tool changes. Rerun when uncertain. No persistent success marker replaces this comparison.
