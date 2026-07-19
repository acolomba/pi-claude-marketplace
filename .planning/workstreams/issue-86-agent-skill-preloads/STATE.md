---
gsd_state_version: 1.0
milestone: agent-skill-preloads
milestone_name: milestone
current_phase: 82
current_plan: 1
status: ready_to_plan
last_updated: 2026-07-19T15:54:59.356Z
last_activity: 2026-07-19
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 50
stopped_at: Phase 82 complete (4/4) — ready to discuss Phase 83
---

# Project State

## Current Position

Phase: 82 (agent-skill-preload-fidelity) — EXECUTING
Plan: 4 of 4
**Status:** Ready to plan
**Current Phase:** 83
**Last Activity:** 2026-07-19
**Last Activity Description:** Phase 82 execution started

## Progress

**Phases Complete:** 0 of 1
**Current Plan:** Not started

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-19)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact — atomically, recoverably, and with soft-dependency degradation that never blocks the install.
**Current focus:** Phase 83 — skill tool inherit mapping

## Working Context

- Branch: `features/issue-86-agent-skill-preloads`, worktree `.worktrees/issue-86-agent-skill-preloads/`
- Milestone artifacts live in `.planning/workstreams/issue-86-agent-skill-preloads/` (real files in the worktree; the main checkout holds a symlink at the same path so gsd-sdk root-resolution keeps working)
- Phase numbering continues at **Phase 82** (fetch-plugin used 80-81; its planning artifacts were developed out-of-repo)

## Accumulated Context

### Roadmap Evolution

- Phase 83 added: AGSK-05: map source Skill tool to inheritSkills: true; out-of-scope rationale found overstated after pi-subagents/pi source review

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

### Blockers

None.

## Session Continuity

**Stopped At:** Completed 82-04-PLAN.md
**Resume File:** None

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 82 P01 | 7 min | 2 tasks | 1 files |
| Phase 82 P02 | 8 min | 2 tasks | 2 files |
| Phase 82 P03 | 7 min | 2 tasks | 2 files |
| Phase 82 P04 | 14 min | 3 tasks | 4 files |
