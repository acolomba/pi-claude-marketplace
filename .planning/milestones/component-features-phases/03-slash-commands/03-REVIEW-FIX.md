---
phase: 03-slash-commands
fixed_at: 2026-11-01T23:30:00Z
review_path: /home/user/pi-claude-marketplace/.planning/phases/03-slash-commands/03-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-11-01T23:30:00Z
**Source review:** /home/user/pi-claude-marketplace/.planning/phases/03-slash-commands/03-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 2 (WR-01, WR-02; fix scope critical_warning, so IN-01..IN-05 are out of scope)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: A ledger write that fails after the commit has landed leaves an update's record out of step with the files on disk

**Files modified:** `extensions/pi-claude-marketplace/bridges/commands/stage.ts`, `test/bridges/commands/stage.test.ts`, `features/slash-command/project-provenance.feature`
**Commit:** 00714ec
**Applied fix:** `commitPreparedCommands` now catches a failed `recordCommittedCommands` and calls the new `removeUnrecordedCommands`. That function unlinks every renamed target in `_renamePairs` before the error is rethrown. A target that is already gone (ENOENT) needs no removal. Any other unlink failure becomes a leak message `failed to remove unrecorded command <path>: <reason>`. The leak is appended after the staging-cleanup leak through `appendLeaks`, so the existing cleanup-leak message stays the same. A throw again means that no new command was committed. This holds for the install ledger, whose undo stays ENOENT-tolerant, and for the update runner, which has no undo. The finding's `update-swap.ts` was not changed.

**Red proof:**

- Unit, `test/bridges/commands/stage.test.ts`: the source change was reverted and the 3 new cases were run.
  - "WR-01 a failed project ledger write removes the renamed commands and the replaced ones" fails. Both new prompts stay on disk.
  - "... tolerates a renamed command that is already gone" fails.
  - "... carries a renamed command it cannot remove" fails. Here the update replaces a target with a directory, so the unlink fails with EISDIR.
  - With the fix, all 3 pass.
- Behavioral, `features/slash-command/project-provenance.feature`, the new scenario "Updating a project command's plugin while the user's record of project installs holds content pi cannot update leaves no command that record does not list". Without the fix, `Then pi offers no slash commands from prompt templates` fails with `['solo:check', 'solo:status']`: the unrecorded new files are listed after the reload. With the fix it passes.

### WR-02: A file that loses a name collision still claims its path, so a later map key that names it is dropped with a false reason

**Files modified:** `extensions/pi-claude-marketplace/bridges/commands/discover.ts`, `test/bridges/commands/discover.test.ts`, `features/slash-command/manifest-forms.feature`
**Commit:** 0822dc3
**Applied fix:** `repeatsLoadedFile` is now a read-only check. `admitCommand` records `state.byFile` only after the command wins its generated name, and only for `kind: "file"`. The `byFile` and `admitCommand` doc comments were updated. A side effect follows from the same change. A file reached again through an overlapping `componentPaths.commands` entry, after its name lost at the first depth, now loads under its second-depth name. Before, it was dropped silently. A unit case pins this.

**Red proof:**

- Unit, `test/bridges/commands/discover.test.ts`: the source change was reverted and both new cases fail.
  - "WR-02 names a command map key after a folder file whose elided name lost to another file" is the review's elided-collision plus entry-map shape.
  - "WR-02 loads a file under an overlapping command root after its name at the first root lost".
  - With the fix, both pass.
- Behavioral, `features/slash-command/manifest-forms.feature`, the new scenario "A marketplace entry's command map key names a folder file whose own command name another file took". Without the fix, `Then the command reports these results` fails. The header reads "2 declared components have notes", and the lines include the false `command map entry "check" names "commands/lint.md", already loaded as command source "lint"; skipping entry.` With the fix, the install reports only the elision warning, and Pi lists `/demo:check` and `/demo:lint`.

## Verification

All checks ran in the main checkout `/home/user/pi-claude-marketplace`, on branch `features/component-features-phase-3`. No worktree was used, as the orchestrator instructed.

- `node --test test/bridges/commands/*.test.ts`: 143 passed, 0 failed.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/stage.ts`: exit 0 (100% direct coverage).
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/discover.ts`: exit 0 (100% direct coverage).
- `npx fallow dupes --fail-on-issues`: exit 0 after each fix.
- `npm run check:static`: passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- `npx cucumber-js features/slash-command/project-provenance.feature`: 12 of 12 scenarios passed.
- `npx cucumber-js features/slash-command/manifest-forms.feature`: 28 of 28 scenarios passed.
- The pre-commit hook (`npm run check:commit`) passed on both commits.
- The full `npm run check` was not run. The orchestrator runs it.

---

_Fixed: 2026-11-01T23:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
