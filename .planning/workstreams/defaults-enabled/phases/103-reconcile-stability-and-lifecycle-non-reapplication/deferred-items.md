# Deferred items

Out-of-scope discoveries logged during execution. Not fixed here.

## Pre-existing comment-policy violation in `tests/orchestrators/plugin/install.test.ts`

- **Found during:** plan `103-06`, Task 1 self-check
- **Location:** `tests/orchestrators/plugin/install.test.ts`, the
  `// ... so it flows through the Phase 65/69 gates` comment
- **Issue:** `.claude/rules/typescript-comments.md` forbids `Phase NN` planning
  references in comments. This line predates this phase (introduced in
  `c695bdab`) and is untouched by `103-06`'s diff.
- **Why deferred:** outside this plan's scope boundary — the change would touch
  a comment no task in this plan authored or moved.
