---
id: SEED-261107-kax
status: dormant
planted: 2026-11-07
planted_during: between milestones (after mcp-builtin, PR #303)
trigger_when: open-gsd/gsd-core#4649 (bounded project-skills discovery) is closed, or a milestone touches GSD tooling, skills, or agent configuration
scope: medium
---

# SEED-261107-kax: Review the structure of skills, injected skills (agent_skills), and GSD capabilities once open-gsd/gsd-core#4649 is closed

## Why This Matters

GSD's project-skills discovery tells 21 GSD agents to list `.claude/skills/` and
`.agents/skills/` and read every `SKILL.md` on every spawn. In this repository
that is about 91 KB. The vendored and operator skills alone (humanizer 32 KB,
herdr 12.6 KB, simple-english 7.7 KB, show-me 3.3 KB) are about 56 KB of it, and
none of them helps a planner, executor, or reviewer. No GSD config key turns the
read off, and a capability cannot remove it, because capabilities only add text
to prompts.

The layout has drifted from its intent. #195 kept the rules out of the
discovered directories and handed each agent type its skills through
`agent_skills`, to avoid this read. #261 (the blueprint-typescript
`copier update`) moved the skills into `.agents/skills/` with links in
`.claude/skills/` and dropped most per-role `agent_skills` entries without a
recorded reason. Today Claude Code loads the skills natively (name and
description in context, body on a `Skill` call; GSD agents have `Skill` in their
tools), GSD's walk reads them all again, and `agent_skills` would add a third
copy.

Upstream #4649 asks GSD to bound that read (relevance filter and/or a
`SKILL.md` size budget). Its mechanism is not settled, and its first PR (#5079)
closed without merging. Once it lands, the cost model changes, and this setup
should be reviewed against it.

## When to Surface

**Trigger:** open-gsd/gsd-core#4649 is closed (watch the issue on GitHub; GSD
does not watch external events), or any milestone that touches GSD tooling,
skills, or agent configuration.

Also check the related upstream issues: #5248 (the same read in the
execute-phase, plan-phase, and quick spawn prompts), #5249 (a `/gsd-health`
warning for oversized skills), and #4948 (let runtimes with native skill loading
own discovery; it records a Claude Code probe where `gsd-code-reviewer` invoked a
matching skill natively in 3 of 3 runs).

## Scope Estimate

**Medium** -- one or two quick tasks, depending on what #4649 ships.

Questions to answer:

1. What does the shipped #4649 fix read per spawn, and does it still reach the
   vendored skills?
2. Which skills stay in the project (pinned by `skills-lock.json`, installed by
   `scripts/init.sh`) and which move to global scope? herdr is installed by hand
   and gitignored, so it can move without cost.
3. Should one project capability route skills to roles by naming them ("load
   skill X with the Skill tool") instead of pasting bodies through
   `agent_skills`? Candidate contributions: `discuss:pre` -> orchestrator
   (replaces `discuss-agent-skills`), `plan:pre` -> planner, `execute:pre` ->
   executor, `execute:post` -> code-reviewer. Only the `code-reviewer` delivery
   (gsd-core #5353, in 1.20.1) is verified; check the others first.
4. Which `agent_skills` entries remain? The `gsd-discuss-phase` mapping is
   deliberate: `discuss-phase.md` never queries it, so the capability forces the
   compat research. The advisor and assumptions-analyzer mappings to
   `typescript-unit-tests` and `cucumber` have no recorded reason. The code-fixer
   has no contribution role, so it can only use native loading or
   `agent_skills`.
5. Should the GSD-only AGENTS.md rules (`## Threat Flags` in SUMMARY.md, the
   windows `--description` prefix) move into executor contributions?
6. Should babysit-pr run as a `ship:post` step? It must be a `ref.skill` step
   (it runs in the main session and can start subagents), not `ref.agent`
   (nested subagents cannot start). It is staged as `gsd-<stem>`, needs
   babysit-pr's `allowed-tools`, should not set `model:`, and makes
   `/gsd-ship` block until it converges. Check that a project capability's skill
   is staged into `.claude/skills/` when `init.sh` installs through `.codex`.

## Breadcrumbs

- `.planning/config.json` -- `agent_skills` (discuss, advisor, assumptions only)
- `gsd-capabilities/discuss-agent-skills/` -- the one project capability
- `scripts/init.sh` -- vendored skill installs and the capability install
- `skills-lock.json` -- pins for humanizer, show-me, simple-english
- `.agents/skills/`, `.claude/skills/` (links) -- the skill layout from #261
- `.claude/agents/gsd-*.md` -- the "Project skills" discovery block (21 files)
- `.claude/gsd-core/workflows/code-review.md:69`, `:804-850` -- reviewer
  `agent_skills` and capability contributions
- `.claude/gsd-core/workflows/ship.md:545-590` -- `ship:post` step dispatch
- `.planning/milestones/any-git-host-quick/260922-ckn-implement-upstream-informed-discuss-phas/`
  -- why `discuss-agent-skills` exists
- PRs #195, #210, #234, #261 -- the history of the layout

## Notes

Planted from a design discussion on 2026-11-07. Measurements are from GSD
1.20.1.
