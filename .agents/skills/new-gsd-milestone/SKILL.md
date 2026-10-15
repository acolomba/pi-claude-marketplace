---
name: new-gsd-milestone
description: Start a new GSD milestone labeled with a kebab-case name instead of a version number, with phase numbering restarted at 1, via GSD's /gsd-new-milestone command. Use whenever the user asks to start, open, or begin a new milestone in this repo, asks to run /gsd-new-milestone, or invokes /new-gsd-milestone <name> -- even if they don't mention naming or phase numbers, because this project never uses versioned milestones or continued phase numbering.
---

# New GSD Milestone

This project labels milestones with names (`test-backlog`, `workflows-replay`) and starts each milestone's phases at 1. GSD's `/gsd-new-milestone` does the opposite by default: it suggests the next version (v1.19 -> v1.20) and continues phase numbers from the previous milestone. Its workflow has no capability hook point (those cover only discuss, plan, execute, verify, and ship), so this skill wraps the command and overrides those two choices. Do not reimplement the workflow -- run it and apply the procedure's overrides as you go.

Run gsd-tools as `node .claude/gsd-core/bin/gsd-tools.cjs` from the repo root (the workflow's `gsd_run` wraps the same file). Add `--ws <name>` to every query when a workstream is in use.

Follow `.agents/skills/new-gsd-milestone/rules/procedure.md` step by step.
