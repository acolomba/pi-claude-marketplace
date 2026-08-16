# Deferred items

Out-of-scope discoveries logged during execution. Not fixed here.

## ✅ RESOLVED at milestone close — pre-existing comment-policy violation in `tests/orchestrators/plugin/install.test.ts`

- **Found during:** plan `103-06`, Task 1 self-check
- **Location:** `tests/orchestrators/plugin/install.test.ts`, the
  `// ... so it flows through the Phase 65/69 gates` comment
- **Issue:** `.claude/rules/typescript-comments.md` forbids `Phase NN` planning
  references in comments. This line predates this phase (introduced in
  `c695bdab`) and is untouched by `103-06`'s diff.
- **Why deferred at the time:** outside that plan's scope boundary — the change
  would touch a comment no task in the plan authored or moved.
- **Resolution (2026-08-15):** fixed at the milestone-close artifact audit, where
  it is in scope. The reference now names the behavior — "the force-degradation
  gates" — instead of the release cycle that built them, which is what the rule
  asks for and what survives archiving. `install.test.ts` stays at 125/125.
