---
phase: 03-marketplace-layers-and-cross-scope-install
fixed_at: 2026-11-21T23:40:00Z
review_path: .planning/phases/03-marketplace-layers-and-cross-scope-install/03-REVIEW.md
iteration: 2
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-11-21T23:40:00Z
**Source review:** .planning/phases/03-marketplace-layers-and-cross-scope-install/03-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 1 (WR-01; scope `critical_warning`)
- Fixed: 1
- Skipped: 0
- Out of scope, left in REVIEW.md: IN-01 to IN-06

## Fixed Issues

### WR-01: The MA-13 replacement still does not check the content of the user's file, which the deleted case asserted

**Files modified:** `features/plugin/cross-scope-install.feature`, `features/step_definitions/marketplace/checkout.steps.ts`
**Commit:** 717dbda
**Applied fix:** I took the reviewer's main option. The step `the checkout of the marketplace {string} in the {word} scope holds exactly these entries:` now compares a two-column table, `| entry | content |`. A file row holds the file's UTF-8 text. A directory row holds its path with a trailing `/` and an empty cell. The step text stays the same, so the step still has one definition, and `cross-scope-install.feature` is the only file that uses it. The MA-13 scenario now states `| notes.txt | the user's notes |`, so a reader can see the protected text in the scenario. `checkoutEntries` also returns each entry's absolute path, so the step reads the file without building the path again. The `@fileoverview` and the step comment now say that the step checks file text too.

**Red proof (not committed):** I put `await writeFile(path.join(finalDir, "notes.txt"), "")` at the start of `recognizeLeftover` in `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`. With that change, the refused add truncates the user's file and then throws `StaleSourceCloneError` as before. Under the adapter profile the MA-13 scenario failed, and only on the new assertion: `AssertionError` at `checkout.steps.ts:179`, actual `['notes.txt', '']`, expected `['notes.txt', "the user's notes"]`. The entry names still matched, so the old one-column table would have passed. The other 9 scenarios passed. I reverted the change with `git checkout --`. Afterwards, `git status --porcelain -- extensions/` printed nothing.

## Verification

All gates ran in the main checkout on branch `claude/stoic-shannon-la9q7o`, not in an isolated worktree. The orchestrator asked for the main checkout, and a hand-made worktree has no `node_modules`. You can repeat every result below from the current tree.

- `npm run check:static`: passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- `npm run test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/cross-scope-install.feature`: 10 scenarios passed, 132 steps passed.
- No other feature file uses the changed step (`grep` for `holds exactly these entries` finds only `cross-scope-install.feature:138`). The scenario has no MCP implementation tag, so the builtin profile does not run it.
- `pre-commit run --files` on the two changed files: clean. The commit hook's `npm run check:commit` skipped, because the staged files are not build inputs. The `check:static` run above covers them.

---

_Fixed: 2026-11-21T23:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
