---
phase: 04-agents
fixed_at: 2026-11-01T18:32:57Z
review_path: .planning/phases/04-agents/04-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-11-01T18:32:57Z
**Source review:** .planning/phases/04-agents/04-REVIEW.md (iteration-1 review)
**Iteration:** 1

**Summary:**

- Findings in scope: 1 (WR-01, under the default Critical + Warning scope).
  IN-01..IN-03 were left alone; they stay recorded in REVIEW.md.
- Fixed: 1
- Skipped: 0
- The iteration-2 re-review found no Critical or Warning finding, so the
  `--auto` loop stopped after one fix round (2 of the 3 allowed review rounds
  used).

**Where verification ran:** in the main checkout
`/home/user/pi-claude-marketplace` (branch `features/component-features-phase-4`),
not in a worktree, with the root-sandbox wrapper
(`npm_config_script_shell=.../nondac-sh`, `NODE_OPTIONS=--max-old-space-size=6144`).
The fixer role ran inline: this session cannot spawn subagents. The commit
went through the normal pre-commit hook, which ran `npm run check:commit` and
passed.

## Fixed Issues

### WR-01: A `Skill(spec)` entry is not resolved to the Skill tool

**Files modified:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts`,
`test/bridges/agents/convert.test.ts`, `features/agent/frontmatter.feature`
**Commit:** ee1b1da
**Applied fix:** a new `isSkillToken(token)` (`toolNameOf(token) === "Skill"`)
replaces the five raw `"Skill"` comparisons: the skip in `mapToolTokens`, both
sides of `inheritSkills` in `mapTools`, the skip and `inheritSkills` in
`omittedToolMapping`, and the AG-11 Skill note. This applies D-CF4-08 as
amended (a `Tool(spec)` entry maps by its tool name) to the Skill tool as
well.

**Behavioral proof (user-visible change):** new scenario `A Skill entry with
a pattern grants or disallows the skills as the Skill tool does` in
`features/agent/frontmatter.feature`. It reads pi-subagents' `get` result for
an agent with `tools: Read, Skill(helper)` and one with
`disallowedTools: Skill(helper)`.

- Red, before the fix (`npx cucumber-js features/agent/frontmatter.feature
  --name "A Skill entry with a pattern"`): exit 1, `AssertionError`; the
  granted agent showed `Inherit skills: false` and the denied agent showed
  `Inherit skills: true`, where the scenario expects the opposite.
- Green, after the fix: the scenario passes, and the whole `features/agent/`
  folder passes (40 scenarios, 523 steps).

**Unit proof:** three cases in `test/bridges/agents/convert.test.ts`: the
pattern grant gives `inheritSkills: true` with nothing dropped, the pattern
disallow beside an omitted list gives `inheritSkills: false` with no warning,
and a pattern-only list refuses with the Skill note. `convert.test.ts` passes
(141 tests). ESLint (`--max-warnings 0`), `fallow health`, and `fallow dupes`
are clean; the `stage.ts` clone markers are untouched.

## Not in scope

- IN-01 (`[1m]` on a full `claude-` ID), IN-02 (fallback warning quotes the
  raw effort), IN-03 (`agents/.md` or an unsafe folder name fails the
  install): Info findings, outside the default fix scope. Each is recorded in
  REVIEW.md with a proposed fix.

---

_Fixed: 2026-11-01T18:32:57Z_
_Fixer: Claude (gsd-code-fixer role, run inline)_
_Iteration: 1_
