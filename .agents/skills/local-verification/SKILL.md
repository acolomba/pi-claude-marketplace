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

A build input is a file that a build or a CI job reads. The build inputs are the files that the hook's `files` pattern in `.pre-commit-config.yaml` matches. The `paths` list of the `push` trigger in `.github/workflows/ci.yml` names the same files, and the `pull_request` trigger reuses it through a YAML anchor. Change the two lists together.

This scheduling policy takes precedence over generic instructions to run the whole suite after every task. It does not permit skipping a required combined-tree or handoff gate or accepting a failed or timed-out check.

## Read before you act

| When you                                                             | Read                                                  |
| -------------------------------------------------------------------- | ----------------------------------------------------- |
| run a check, one test module, one pair's coverage, or one named test | `.agents/skills/local-verification/rules/commands.md` |
| finish a task, pass a gate, or reuse a passing result                | `.agents/skills/local-verification/rules/gates.md`    |
| commit                                                               | `.agents/skills/committing/SKILL.md`                  |
