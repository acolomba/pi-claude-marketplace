---
phase: 260924-q0m
plan: 01
subsystem: skills
tags: [typescript, skills, completion, release]
requires: [260924-bvi]
provides:
  - Plugin-qualified interactive skill aliases without bare skill aliases.
affects: [skill-aliases, documentation]
actuals:
  tasks: 3
  commits: 1
plan_head_before: 1bae7cd6
requirements-completed: [SK-6]
status: complete
completed: 2026-09-24
---

# Qualified skill aliases only

Interactive completion and input handling now offer `/plugin:skill` aliases
without adding `/plugin-skill` aliases. Pi's native `/skill:plugin-skill`
invocation stays available. Existing commands keep a colliding qualified name.

The PRD, project decision, and release notes now describe the qualified-only
behavior. The English and Spanish READMEs already show only the qualified
alias.

## Verification

- `TEST_CONCURRENCY=4 npm run check` passed outside the sandbox: 6,699 unit
  tests at 100% line, branch, and function coverage, 32 integration tests,
  and all seven type-member negative controls.
- Direct coverage passed for `edge/skill-aliases.ts` at 100%.
- In an isolated Pi session with `plugin-dev` installed, `/plugin-dev:` offered
  `plugin-dev:agent-development`. The bare prefix offered only Pi's native
  `skill:` suggestions.

## Worktree setup

`scripts/init.sh` was not run when this worktree was created. Local GSD
agents and CodeGraph were absent. This follow-up used the installed GSD quick
runtime from the original checkout and ran inline. Dependencies and Git hooks
were already available; the full project check passed.
