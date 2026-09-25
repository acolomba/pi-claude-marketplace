---
phase: 260923-vk3
plan: 01
subsystem: skills
tags: [typescript, skills, naming, release]
requires: []
provides:
  - Pi-valid skill names on POSIX and Windows.
  - One resolver for Claude skill references in skill text and agents.
  - Correct name mapping documentation and version 0.19.1 metadata.
affects: [skill-discovery, skill-staging, agent-conversion, update, reinstall]
actuals:
  tasks: 3
  commits: 1
plan_head_before: cbb8b318
requirements-completed: [SK-2, RN-1, RN-6, AGSK-02, SKTK-01]
status: complete
completed: 2026-09-23
---

# Pi-valid plugin skill names

Plugin skills now install with hyphenated names that Pi accepts. Discovery, staged skill text, agent preloads, and agent reference legends use the same generated-name mapping. Existing 0.19.0 colon-named skill directories are replaced through the normal update and reinstall path.

The English and Spanish READMEs now show `/foo:bar` for commands and `/skill:foo-bar` for skills. Package, lockfile, runtime, and Sonar versions are 0.19.1. The release branch starts at `v0.19.0`, so unrelated workflow commits from main are absent. That tag already contains the corrected Claude `settings.json` content.

## Verification

- `npm run check` passed: 100% unit line, function, and branch coverage; 32 integration tests; all seven type-member negative controls.
- Pre-commit passed on all changed code and documentation after its Markdown formatter adjusted the PRD table.
- Fallow base and agent audits reported no new issues.
- Skill staging test proved a 0.19.0 colon-named directory is removed when its hyphenated replacement installs.

## Commit

- `4a710359` — `fix(skills): restore Pi-valid skill names`

## Threat Flags

None -- the change affects generated names and references within the existing install boundaries.
