---
status: complete
phase: 83-skill-tool-inherit-mapping
source: [83-VERIFICATION.md]
started: 2026-07-19T18:25:00Z
updated: 2026-07-19T18:20:00-04:00
---

## Current Test

(none — testing complete)

## Tests

### 1. Live inheritSkills round-trip through pi-subagents

expected: Install a plugin containing a Skill-declaring agent (e.g. the issue #86 canonical spec-tree changes-reviewer) via `/claude:plugin install`, run `/reload`, invoke the generated agent, and ask the child session to list and load an installed Pi skill; repeat with a non-Skill agent. The Skill-declaring agent's child receives the lazy skill catalog (name + description, readable on demand) and can load a skill under its Pi name; the non-Skill agent's child runs with skills discovery disabled (pi-subagents passes `--no-skills` for `inheritSkills: false`).
result: passed with finding. Executed 2026-07-19 in three parts:
(a) Real install through the extension code path (fixture spec-tree plugin,
temp `PI_CODING_AGENT_DIR` scope): block-list `skills:` folded, qualified
name mapped, `inheritSkills: true`/`false` emitted per declaration, legend
with both states — all correct.
(b) pi-subagents 0.28.0's own `discoverAgents` + `buildPiArgs` consumed the
generated files: Skill agent → spawn args WITHOUT `--no-skills`; plain
agent → WITH `--no-skills`. Correct both directions.
(c) Live `pi -p` child (real model): confirmed `spec-tree-style-guide` in
`<available_skills>` per the legend and loaded its SKILL.md on demand,
quoting its heading verbatim.
FINDING: pi's `--no-skills` suppresses only natively discovered skills
(`resource-loader.js:277`); explicit `--skill` flags and
extension-contributed paths survive it. A `--no-skills` child in the real
environment still listed every marketplace-converted skill (re-injected by
the pi-claude-marketplace extension's `resources_discover`). Therefore
`inheritSkills` gates only native Pi skills; converted skills are in every
child's catalog. The phase 82/83 warning and the legend's "(not available
in this session)" state overclaim isolation.
disposition: Phase 83.1 (Silent Skill Mapping) inserted — Skill converts
silently (no warning, no droppedTools entry; user confirmed disallowed-wins
matches Claude Code), legend non-preloaded state unified to "(available on
demand)". AGSK-03/04/05 amended accordingly.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None open — the single finding is dispositioned to Phase 83.1.
