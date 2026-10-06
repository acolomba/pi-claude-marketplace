---
phase: 260924-bvi
plan: 01
subsystem: skills
tags: [typescript, skills, commands, agents, completion, release]
requires: []
provides:
  - Bare and plugin-qualified interactive aliases and completion for loaded marketplace skills.
  - One converter for installed skill and command references in plugin Markdown.
  - Version 0.19.2 release metadata and documentation.
affects: [skill-staging, command-staging, agent-conversion, install, update, reinstall]
actuals:
  tasks: 3
  commits: 4
plan_head_before: 7a270503
requirements-completed: [SK-6, SK-7]
status: complete
completed: 2026-09-24
---

# Interactive skill aliases and plugin reference conversion

Loaded marketplace skills now offer bare and `/plugin:skill` slash completion and invocation in interactive Pi sessions. Pi's `/skill:<name>` form remains available. Existing commands and prompt templates keep their names when an alias collides.

One converter rewrites known same-plugin skill and command references in staged skills, commands, agents, and copied skill Markdown. Skill references use `/skill:<generated name>`; command references use colon names on POSIX and dot names on Windows. Commands win ambiguous source names, while explicit `/skill:` selects a skill. The agent reference legend has been retired.

The English and Spanish READMEs, PRD, changelog, package versions, runtime version, and Sonar version describe 0.19.2. The feature branch starts from the 0.19.1 release commit, so unrelated workflow changes on main are absent.

## Verification

- `TEST_CONCURRENCY=4 npm run check` passed: 6,700 unit tests, 100% unit line, branch, and function coverage; integration tests and type member negative controls passed.
- `SKIP=trufflehog pre-commit run --all-files` passed. The TruffleHog exception is required for worktrees because it expects `.git/index` inside the worktree.
- Fallow's agent audit and release-base audit passed with a non-blocking duplication warning and no dead-code or complexity findings.
- PR #215 targets `releases/v0.19.2`. Its base and the feature branch both start at the 0.19.1 release commit.

## Threat Flags

None. The change rewrites copied Markdown inside the existing staging boundaries and adds interactive input handling for loaded marketplace skills.
