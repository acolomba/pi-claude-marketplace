---
phase: 260924-bvi
plan: 01
subsystem: skills
tags: [typescript, skills, commands, agents, completion, release]
requires: []
provides:
  - Bare interactive aliases and completion for loaded marketplace skills.
  - One converter for installed skill and command references in plugin Markdown.
  - Version 0.19.2 release metadata and documentation.
affects: [skill-staging, command-staging, agent-conversion, install, update, reinstall]
actuals:
  tasks: 3
  commits: 1
plan_head_before: 7a270503
requirements-completed: [SK-6, SK-7]
status: in_progress
completed: 2026-09-24
---

# Interactive skill aliases and plugin reference conversion

Loaded marketplace skills now offer bare slash completion and invocation in interactive Pi sessions. Pi's `/skill:<name>` form remains available, and existing commands and prompt templates keep their bare names.

One converter rewrites known same-plugin skill and command references in staged skills, commands, agents, and copied skill Markdown. Skill references use `/skill:<generated name>`; command references use colon names on POSIX and dot names on Windows. Commands win ambiguous source names, while explicit `/skill:` selects a skill. The agent reference legend has been retired.

The English and Spanish READMEs, PRD, changelog, package versions, runtime version, and Sonar version describe 0.19.2. The feature branch starts from the 0.19.1 release commit, so unrelated workflow changes on main are absent.

## Verification

Pending full repository check, pre-commit hooks, and Fallow audits.

## Threat Flags

None. The change rewrites copied Markdown inside the existing staging boundaries and adds interactive input handling for loaded marketplace skills.
