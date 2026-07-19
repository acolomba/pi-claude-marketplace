---
workstream: issue-86-agent-skill-preloads
created: 2026-07-19
milestone: agent-skill-preloads
milestone_version: 0.10.0
status: planning
---

# Project State

## Current Position

**Status:** Roadmap created — ready to plan Phase 82
**Current Phase:** 82 (Agent Skill Preload Fidelity) — not started
**Last Activity:** 2026-07-19
**Last Activity Description:** Roadmap created — single Phase 82 covering AGSK-01..04; all 4 requirements mapped

## Progress

**Phases Complete:** 0 of 1
**Current Plan:** N/A

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-19)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact — atomically, recoverably, and with soft-dependency degradation that never blocks the install.
**Current focus:** agent-skill-preloads — fix GitHub issue #86 (generated Pi agents drop required Claude skill preloads)

## Working Context

- Branch: `features/issue-86-agent-skill-preloads`, worktree `.worktrees/issue-86-agent-skill-preloads/`
- Milestone artifacts live in `.planning/workstreams/issue-86-agent-skill-preloads/` (real files in the worktree; the main checkout holds a symlink at the same path so gsd-sdk root-resolution keeps working)
- Phase numbering continues at **Phase 82** (fetch-plugin used 80-81; its planning artifacts were developed out-of-repo)

## Accumulated Context

### Decisions

- Advisory note lives in the generated agent **body** (visible prose), not the skill md and not frontmatter — pi-subagents passes the body verbatim as the child's `--system-prompt`; unknown frontmatter keys go to `extraFields` and never reach the LLM
- Generated frontmatter keeps emitting CSV `skills:` — compatibility floor is pi-subagents 0.28.x (comma-split only); upstream 0.35.x also accepts block lists
- Cross-plugin qualified skill references (`other-plugin:skill`) warn-and-drop; installability of the other plugin is unknown at convert time
- Note emission is reference-gated: only when the body literally contains `<plugin>:<source-skill>` tokens; otherwise generated output stays byte-identical

### Blockers

None.

## Session Continuity

**Stopped At:** Roadmap created (Phase 82 planning next)
**Resume File:** None
