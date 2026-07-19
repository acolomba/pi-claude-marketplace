---
gsd_state_version: 1.0
milestone: agent-skill-preloads
milestone_name: milestone
current_phase: 83.1
current_plan: 1
status: milestone_complete
last_updated: 2026-07-19T23:28:29.422Z
last_activity: 2026-07-19
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 9
  completed_plans: 9
  percent: 67
stopped_at: Milestone complete (Phase 83.1 was final phase)
---

# Project State

## Current Position

Phase: 83.1 (silent-skill-mapping) — EXECUTING
Plan: 1 of 2
**Status:** Milestone complete
**Current Phase:** 83.1
**Last Activity:** 2026-07-19
**Last Activity Description:** Phase 83.1 execution started

## Progress

**Phases Complete:** 0 of 1
**Current Plan:** Not started

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-19)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact — atomically, recoverably, and with soft-dependency degradation that never blocks the install.
**Current focus:** Milestone complete

## Working Context

- Branch: `features/issue-86-agent-skill-preloads`, worktree `.worktrees/issue-86-agent-skill-preloads/`
- Milestone artifacts live in `.planning/workstreams/issue-86-agent-skill-preloads/` (real files in the worktree; the main checkout holds a symlink at the same path so gsd-sdk root-resolution keeps working)
- Phase numbering continues at **Phase 82** (fetch-plugin used 80-81; its planning artifacts were developed out-of-repo)

## Accumulated Context

### Roadmap Evolution

- Phase 83 added: AGSK-05: map source Skill tool to inheritSkills: true; out-of-scope rationale found overstated after pi-subagents/pi source review
- Phase 83.1 inserted after Phase 83: UAT finding: --no-skills does not gate extension-contributed skills; Skill warnings dropped as Claude-faithful, droppedTools excludes Skill, legend state unified

### Decisions

- Advisory note lives in the generated agent **body** (visible prose), not the skill md and not frontmatter — pi-subagents passes the body verbatim as the child's `--system-prompt`; unknown frontmatter keys go to `extraFields` and never reach the LLM
- Generated frontmatter keeps emitting CSV `skills:` — compatibility floor is pi-subagents 0.28.x (comma-split only); upstream 0.35.x also accepts block lists
- Cross-plugin qualified skill references (`other-plugin:skill`) warn-and-drop; installability of the other plugin is unknown at convert time
- Note emission is reference-gated: only when the body literally contains `<plugin>:<source-skill>` tokens; otherwise generated output stays byte-identical
- [Phase 82]: Cross-plugin skill warning wording locked: skill reference "<token>" is qualified with a different plugin -- dropped (only this plugin's skills can be preloaded) — SC-3 requires naming the token; matches existing lowercase ' -- ' warning convention
- [Phase 82]: Unknown-skill warnings name the full original token (qualifier included), never the stripped remainder — Users can grep the warning text verbatim in source frontmatter
- [Phase 82]: No dedupe in mapSkills emit list — Byte-identity for duplicate-bearing bare-form agents; pi-subagents dedupes downstream
- [Phase 82]: Skill legend annotations locked as ASCII parenthesized forms with the U+2192 arrow on both entry kinds, first-occurrence dedupe by token — AGSK-04 satisfied verbatim while surviving the fix-unicode-dashes hook; arrow written as an escape in all .ts literals
- [Phase 82]: Legend scanner skips the plugin-prefix-only candidate that elides to an empty skill name — A body scan must never throw; assertSafeName throws on the empty elision remainder (T-82-12 completeness)
- [Phase 83]: D-83-05 legend annotation locked as 'available on demand' — Legend entry line already renders the Pi name after the arrow; parallel to the two locked D-82-05 annotations

### Blockers

None.

## Session Continuity

**Stopped At:** Completed 83-03-PLAN.md
**Resume File:** None

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 82 P01 | 7 min | 2 tasks | 1 files |
| Phase 82 P02 | 8 min | 2 tasks | 2 files |
| Phase 82 P03 | 7 min | 2 tasks | 2 files |
| Phase 82 P04 | 14 min | 3 tasks | 4 files |
| Phase 83 P01 | 6 min | 2 tasks | 1 files |
| Phase 83 P02 | 11 min | 2 tasks | 2 files |
| Phase 83 P03 | 33min | 2 tasks | 2 files |
