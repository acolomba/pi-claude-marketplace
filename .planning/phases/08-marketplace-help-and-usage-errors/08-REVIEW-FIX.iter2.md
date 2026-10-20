---
phase: 08-marketplace-help-and-usage-errors
fixed_at: 2026-10-20T00:00:00Z
review_path: .planning/phases/08-marketplace-help-and-usage-errors/08-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-10-20T00:00:00Z
**Source review:** .planning/phases/08-marketplace-help-and-usage-errors/08-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 2 (fix scope critical_warning; IN-01 and IN-02 are out of scope)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: The marketplace verb inventory is still hand-copied, and the open-closed doc now says one row is enough

**Files modified:** `extensions/pi-claude-marketplace/edge/router.ts`, `tests/edge/router.test.ts`, `docs/open-closed-proof.md`
**Commit:** f16b6be4 (`refactor(router): derive marketplace verb list from signature rows`)
**Applied fix:**

- `MARKETPLACE_VERB_SIGNATURES` is now `as const satisfies Record<string, MarketplaceVerbSignature>`. `MarketplaceVerb` is `keyof typeof MARKETPLACE_VERB_SIGNATURES`.
- A `MARKETPLACE_SPELLINGS` list (each verb followed by its alias) comes from the rows. Both the marketplace help header and the `marketplace <...>` line of `TOP_LEVEL_USAGE` use it. The rendered text is the same, byte for byte. The pinned `EXPECTED_TOP_LEVEL_USAGE` and `EXPECTED_MARKETPLACE_USAGE` router tests and the marketplace help scenarios pass without changes.
- A new router test ties the spelling list in both headers to `MARKETPLACE_SUBCOMMANDS` minus `help`. A new row that has no subcommand token now fails a test.
- `docs/open-closed-proof.md` now lists what the row covers and what a new marketplace verb still needs: the `SubcommandHandlers` field, its `MARKETPLACE_SUBCOMMANDS` tokens, and its switch `case`.
- Verified with `npx tsc --noEmit -p .` (exit 0), `node --test tests/edge/router.test.ts` (exit 0), `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/router.ts` (exit 0), `npm run test:cucumber -- features/marketplace/help.feature --parallel 1` (exit 0, 5/5 scenarios), and the commit hook (`npm run check:commit` passed).

### WR-02: A blank half of a plugin reference passes edge validation and gets neither the empty-field message nor the invalid-ref message

**Files modified:** `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts`, `tests/edge/handlers/plugin/shared.test.ts`, `features/plugin/usage-errors.feature`
**Commit:** c4367e9a (`fix(plugin): reject a blank half of a plugin reference`)
**Status:** fixed: requires human verification (the user-visible behavior changes)
**Applied fix:**

- `splitPluginMarketplaceRef` now returns `undefined` when either half is blank after trimming. A blank half now gets the same `Invalid <plugin>@<marketplace> ref: "...".` usage error as its empty twin, as D-06 asks.
- Test-first:
  - New `parsePluginRef` rows: `" @official"` and `"alpha@  "`.
  - New `parsePluginTarget` rows: `"alpha@  "` and `" @official"`.
  - New Outline rows: `install ' @official'` and `update 'foo@  '`, both compared through the whole-payload `the result has these fields:` table.
- RED on unchanged code:
  - `node --test tests/edge/handlers/plugin/shared.test.ts` exited 1, with exactly the 4 new cases failing.
  - `npm run test:cucumber -- features/plugin/usage-errors.feature --parallel 1` exited 1, with exactly the 2 new rows failing.
- GREEN after the fix:
  - The unit test exited 0 (50/50).
  - The feature exited 0 (23/23 scenarios).
  - `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` exited 0.
  - `node --test tests/edge/handlers/plugin/*.test.ts tests/edge/register.test.ts` exited 0 (696/696).
  - The commit hook passed.
- CHANGELOG: not changed. The Unreleased bullet describes only a reference that is empty as a whole and an `@` with no marketplace name. Neither behavior changed, so the bullet is still accurate.

## Verification location

All edits, tests, and commits ran in the checkout of the git worktree `/home/acolomba/src/pi-claude-marketplace-cucumber-behavioral-tests` on branch `features/cucumber-behavioral-tests`. This is the checkout the caller named. No nested review-fix worktree was created: a new worktree has no `node_modules`, so the required pre-commit hook (`npm run check:commit`) could not run there. Every result above can be reproduced from this tree. The full `npm run check` was not run, as the caller asked. The orchestrator runs that regression gate.

---

_Fixed: 2026-10-20T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
