---
status: partial
phase: 83-skill-tool-inherit-mapping
source: [83-VERIFICATION.md]
started: 2026-07-19T18:25:00Z
updated: 2026-07-19T18:25:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live inheritSkills round-trip through pi-subagents

expected: Install a plugin containing a Skill-declaring agent (e.g. the issue #86 canonical spec-tree changes-reviewer) via `/claude:plugin install`, run `/reload`, invoke the generated agent, and ask the child session to list and load an installed Pi skill; repeat with a non-Skill agent. The Skill-declaring agent's child receives the lazy skill catalog (name + description, readable on demand) and can load a skill under its Pi name; the non-Skill agent's child runs with skills discovery disabled (pi-subagents passes `--no-skills` for `inheritSkills: false`).
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
