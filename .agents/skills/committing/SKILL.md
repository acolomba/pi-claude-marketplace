---
name: committing
description: How to commit in this repository -- message format, focused checks while editing, pre-commit fixers, the commit hook's npm checks, and what to do when the hook fails. Apply before every commit.
---

# Committing

Which checks a task or gate needs is in `.agents/skills/local-verification/SKILL.md`.

## Messages

Commit messages and PR titles follow the [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/#specification). Titles have 5 to 72 characters; body lines have at most 80. Messages name no GSD milestone, phase, plan, or wave, including in the scope: write `test(orders): ...`, not `test(03-01): ...`, whatever a GSD template suggests.

## Procedure

While editing, run owner tests or one pair's direct coverage. Before committing, run `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files <changed files>` to apply fixers and linters. It takes seconds. The `${SKIP:+,$SKIP}` part keeps the `SKIP=trufflehog` that a Claude Code cloud session exports. Its network policy blocks the Go toolchain that the trufflehog hook needs. A linter warning fails it too, because yamllint runs with `--strict`. Restage fixes and repeat until clean. To run them on every file, as the CI Lint workflow does, use `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --all-files`.

Then run `git commit` in the foreground with the longest tool timeout available. Never background it and poll with sleep/grep loops. If a run can outlast the tool's foreground limit, background it once and wait for the completion notification. The commit hook runs the npm checks; do not run ESLint, type checking, or tests immediately beforehand. A failed hook means no commit happened: fix, restage, and commit again, without `--amend` (it would alter the previous commit) or `--no-verify`.

During `git commit`, pre-commit stashes unstaged edits. It does not move untracked files, so stage or remove untracked build inputs before you commit. The pre-commit tool passes no deleted file to a hook, and it applies its top-level `exclude` first. So the hook skips a commit that only deletes build inputs or only changes files under `test/domain/fixtures/hash-stability/`. Run `npm run check` yourself before such a commit.
