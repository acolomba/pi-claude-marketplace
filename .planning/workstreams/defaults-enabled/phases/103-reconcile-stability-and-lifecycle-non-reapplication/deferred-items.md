# Deferred items

Out-of-scope discoveries logged during execution.

## ✅ All items resolved — nothing open

### Pre-existing comment-policy violation in `install.test.ts` (RESOLVED 2026-08-15)

Found during plan `103-06`'s Task 1 self-check. A comment in
`tests/orchestrators/plugin/install.test.ts` read "so it flows through the
Phase 65/69 gates", and `.claude/rules/typescript-comments.md` forbids naming a
release cycle in a source comment — those references stop resolving once the
planning documents are archived. The line predated that phase (introduced in
`c695bdab`) and no task in the plan authored or moved it, so fixing it there
would have crossed the plan's scope boundary.

Resolved at the milestone-close artifact audit, where it IS in scope. The comment
now names the behavior — "the force-degradation gates" — instead of the release
cycle that built them. `install.test.ts` stays at 125/125.
