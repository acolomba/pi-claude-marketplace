# Deferred / Out-of-Scope Items — Phase 86

## Pre-existing integration test failures (NOT introduced by Plan 03)

Two `tests/integration/*` cases fail on the current branch. They fail
IDENTICALLY when the Plan 03 source changes are reverted to the pre-plan
commit (verified 2026-07-26 by checking out the three bridge sources at
`HEAD~2` and re-running only these two tests: 0 pass / 2 fail), so they are
pre-existing and outside this plan's scope (they exercise the pi-subagents
agent/skill resolution surface, not the skills-bridge augment arm):

- `tests/integration/provenance-invisibility.test.ts` —
  `T-d8i-01: provenance stays invisible to pi-subagents' own frontmatter parser`
  (asserts `frontmatter.provenance` carries the generated marker).
- `tests/integration/skill-path-resolution.test.ts` —
  `SC-2 / AGSK-06: emitted skillPath resolves the staged skill via
  pi-subagents' resolveSkillsWithFallback and stays out of the global catalog`.

Both assert against `@earendil-works/pi-coding-agent` / pi-subagents runtime
resolution and write their own `SKILL.md` fixtures inline (they do not call
`prepareStageSkills`). Likely tied to the peer-dep migration to
`@earendil-works/pi-coding-agent ^0.79.x`. Left for a dedicated fix.
