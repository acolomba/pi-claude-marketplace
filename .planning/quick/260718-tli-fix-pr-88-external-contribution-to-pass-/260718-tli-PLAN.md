---
phase: quick-260718-tli
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/bridges/skills/discover.ts
  - tests/bridges/skills/discover.test.ts
  - CHANGELOG.md
autonomous: true
requirements: [SK-5, D-10, D-07]
must_haves:
  truths:
    - "Local branch features/self-skill-dir-discovery exists with main merged in (no rebase, contributor commit b1a87554 preserved)"
    - "discoverPluginSkills cognitive complexity is <= 15 (sonarjs/cognitive-complexity passes)"
    - "Prettier 3.9.5 format:check passes on both PR-touched files"
    - "npm run check is fully green (typecheck + lint + format:check + tests + integration tests)"
    - "CHANGELOG.md records the fix crediting PR #88 / @gabadi"
    - "A fix commit lands on features/self-skill-dir-discovery and is pushed to gabadi's fork"
  artifacts:
    - path: "extensions/pi-claude-marketplace/bridges/skills/discover.ts"
      provides: "Self-skill-dir handling extracted into a helper; header comment updated"
    - path: "CHANGELOG.md"
      provides: "Entry for the self-skill-dir discovery fix"
  key_links:
    - from: "discoverPluginSkills"
      to: "extracted self-skill-dir helper"
      via: "function call inside the componentPaths.skills loop"
      pattern: "self.?skill|selfSkill|isSelfSkillDir"
---

<objective>
Fix external PR #88 (gabadi, "fix: discover declared skill dirs") so it passes all
repo checks, update CHANGELOG.md, and push the fix to the contributor's fork branch.

The PR's fix logic is already correct and all tests pass when merged with main. Two
verified check failures remain after merging with current main (e30709e5):
1. ESLint `sonarjs/cognitive-complexity`: discoverPluginSkills hits 16 (limit 15) due
   to the new inline self-skill-dir block.
2. Prettier 3.9.5 (main bumped after the PR was authored): both PR-touched files need
   reformatting.

Purpose: land a supported community contribution without rewriting the contributor's
commit history.
Output: two commits on features/self-skill-dir-discovery (the main-merge commit plus a
fix commit), pushed to gabadi/pi-claude-marketplace.
</objective>

<execution_context>
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.claude/rules/typescript-comments.md
@extensions/pi-claude-marketplace/bridges/skills/discover.ts
@CHANGELOG.md

# This task IS branch surgery on a fork PR branch. All work happens in the MAIN repo
# tree (NOT a GSD worktree). Every commit lands on features/self-skill-dir-discovery
# -- NEVER on main (repo rule).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Checkout PR #88 and merge main into it</name>
  <files>(git branch state only -- no source edits in this task)</files>
  <action>
Run `gh pr checkout 88` from the repo root. This creates a local branch
`features/self-skill-dir-discovery` that tracks gabadi's fork and configures the push
remote to the fork (maintainerCanModify=true confirms push access).

Confirm the current branch is `features/self-skill-dir-discovery` (NOT main) before
proceeding. If it is not, stop.

Merge current main into the PR branch: `git merge main`. Use MERGE, never rebase -- the
contributor commit b1a87554 must not be rewritten. The merge is verified clean locally
(no conflicts). pre-commit hooks run on the merge commit; if the hooks leave the merge
commit uncommitted, complete it with `git commit --no-edit` after the hooks pass. Do NOT
use --no-verify. Do NOT touch main.
  </action>
  <verify>
    <automated>test "$(git branch --show-current)" = "features/self-skill-dir-discovery" &amp;&amp; git merge-base --is-ancestor main HEAD &amp;&amp; echo MERGED_OK</automated>
  </verify>
  <done>Local branch features/self-skill-dir-discovery is checked out with main merged in as an ancestor of HEAD; contributor commit b1a87554 is intact in history.</done>
</task>

<task type="auto">
  <name>Task 2: Refactor discover.ts, format both files, update CHANGELOG</name>
  <files>extensions/pi-claude-marketplace/bridges/skills/discover.ts, tests/bridges/skills/discover.test.ts, CHANGELOG.md</files>
  <action>
1. In `discover.ts`, extract the PR's new inline self-skill-dir handling block out of
   `discoverPluginSkills` into a small module-level helper function (behavior-preserving)
   so `discoverPluginSkills` cognitive complexity drops back to &lt;= 15. Preserve the
   existing first-wins dedup semantics: the helper must go through the SAME
   `seenByGenerated` Map and surface duplicates via the SAME `duplicateWarning` /
   `warnings[]` channel -- do not introduce a second dedup path or change any output.
   The self-skill-dir case is: a declared `componentPaths.skills` element whose path is
   itself a skill directory (contains SKILL.md directly) rather than a parent of skill
   subdirs; it is discovered as a single skill (per gabadi's `isSelfSkillDir` helper).

2. Extend the top-of-file header comment (the SK-5 / D-10 block) to note that a declared
   path that is itself a skill dir is discovered as a single skill. Follow
   .claude/rules/typescript-comments.md: NO GSD phase/plan/wave/task references; requirement
   and decision IDs (SK-5, SK-2, D-07, D-10) are allowed as traceability anchors. Do not
   mention PR numbers in source comments.

3. Run `npx prettier --write extensions/pi-claude-marketplace/bridges/skills/discover.ts
   tests/bridges/skills/discover.test.ts`. This fixes the Prettier 3.9.5 findings (the
   isSelfSkillDir return expression needs multi-line paren wrapping; one writeFile call in
   the test needs a multi-line wrap). Do NOT hand-edit test logic -- prettier only.

4. Update CHANGELOG.md: add an `## [Unreleased]` section at the TOP of the file (above
   `## [0.8.0]`) with a bullet, matching the existing bullet-prose style, describing the
   fix: plugins whose `skills` component path points directly at a skill directory
   containing SKILL.md are now discovered as a single skill (upstream Claude Code supports
   this shape, e.g. mattpocock/skills). Credit the contribution to PR #88 / @gabadi in the
   bullet. Rationale for Unreleased (not a versioned section): this task is scoped to a
   CHANGELOG entry only; a versioned entry would require a coordinated version bump across
   package.json / sonar-project.properties / package-lock.json / EXTENSION_VERSION (the
   BFILL-02 drift guard), which the maintainer performs at release/merge time. The
   maintainer promotes Unreleased to a version when finalizing the PR.
  </action>
  <verify>
    <automated>npx eslint extensions/pi-claude-marketplace/bridges/skills/discover.ts &amp;&amp; npx prettier --check extensions/pi-claude-marketplace/bridges/skills/discover.ts tests/bridges/skills/discover.test.ts</automated>
  </verify>
  <done>discoverPluginSkills passes sonarjs/cognitive-complexity (&lt;= 15) with dedup/warnings behavior unchanged; both PR-touched files pass prettier --check; CHANGELOG.md has an Unreleased entry crediting PR #88 / @gabadi.</done>
</task>

<task type="auto">
  <name>Task 3: Verify green, commit, and push to the contributor branch</name>
  <files>(commit + push of the three files from Task 2)</files>
  <action>
1. Run `npm run check` and confirm it exits 0 (typecheck + lint + format:check + tests +
   integration tests all green). Fix any remaining finding before committing.

2. Run `pre-commit run --files extensions/pi-claude-marketplace/bridges/skills/discover.ts
   tests/bridges/skills/discover.test.ts CHANGELOG.md`. Fix any failures and re-run until
   clean. NEVER use --no-verify.

3. Stage exactly the three changed files with `git add` (staged form). Do NOT use
   `git commit -- <path>` (the pathspec form fights pre-commit's stash). Do NOT stage
   `.claude/settings.json` -- it carries unrelated local modifications.

4. Commit with a Conventional Commits message, ASCII only (no em dashes -- the
   fix-unicode-dashes hook rejects them), title 5-72 chars. Suggested title:
   `fix: discover self-skill-dir declared paths (#88)`. Confirm the commit landed on
   features/self-skill-dir-discovery, NOT main.

5. Push to the contributor's fork: `git push` (gh pr checkout already configured the push
   remote to gabadi's fork).
  </action>
  <verify>
    <automated>npm run check &amp;&amp; git log --oneline -1 &amp;&amp; git status --short --branch | grep -q "ahead" || git rev-parse @{u} &gt;/dev/null 2>&amp;1</automated>
  </verify>
  <done>npm run check is green; a fix commit is on features/self-skill-dir-discovery and pushed to gabadi's fork; no commit on main; .claude/settings.json untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| external contributor PR -> maintained repo | gabadi's fork code is merged and pushed under maintainer authority |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-tli-01 | Tampering | PR #88 source (discover.ts, discover.test.ts) | mitigate | Orchestrator already reviewed the fix logic as correct; executor runs the full `npm run check` suite (2589 tests) and reviews the merge diff before pushing. No behavior beyond skill discovery is introduced. |
| T-tli-SC | Tampering | npm/pip/cargo installs | accept | This change adds NO package installs and no dependency edits; no supply-chain surface. |
</threat_model>

<verification>
- `git branch --show-current` == `features/self-skill-dir-discovery` (never main).
- `git merge-base --is-ancestor main HEAD` succeeds (main merged, not rebased).
- Contributor commit b1a87554 present in `git log`.
- `npm run check` exits 0.
- CHANGELOG.md Unreleased entry credits PR #88 / @gabadi.
- Fix commit pushed to gabadi's fork; `.claude/settings.json` not staged.
</verification>

<success_criteria>
- PR #88, merged with main, passes every repo check (`npm run check` green, including
  sonarjs/cognitive-complexity and Prettier 3.9.5 format:check).
- discoverPluginSkills refactor is behavior-preserving (dedup + warnings unchanged).
- CHANGELOG.md records the fix, crediting the contribution.
- Two commits on features/self-skill-dir-discovery (main-merge + fix), pushed to the fork.
- No commit on main; no --no-verify; ASCII-only commit message.
</success_criteria>

<output>
Create `.planning/quick/260718-tli-fix-pr-88-external-contribution-to-pass-/260718-tli-SUMMARY.md` when done.
</output>
