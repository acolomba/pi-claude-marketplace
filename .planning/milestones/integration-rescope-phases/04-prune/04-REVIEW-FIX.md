---
phase: 04-prune
fixed_at: 2026-11-22T00:00:00Z
review_path: .planning/phases/04-prune/04-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-11-22
**Source review:** .planning/phases/04-prune/04-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 5 (WR-01, WR-02, WR-03, plus IN-01 and IN-03, which the orchestrator added to the scope)
- Fixed: 5
- Skipped: 0
- Left open by decision: IN-02, IN-04

**Where the work ran:** in the main checkout on `claude/stoic-shannon-la9q7o`, as the orchestrator directed. No worktree, temporary branch, or recovery sentinel was created. Every check below ran in the main checkout, so it can be reproduced from this tree.

## Fixed Issues

### WR-01: A failure in the cleanup of a refused snapshot still replaces the original error

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts`, `test/orchestrators/plugin/prune-rollback.test.ts`
**Commit:** 6d229d1
**Applied fix:** The catch on the snapshot failure path in `preparePruneRollback` now wraps `removeBackupRoot` in its own `try`. A cleanup error goes to `hookDebugLog("prune: backup cleanup failed: ...")`, as `discard` does, and the snapshot error is rethrown. The `removeBackupRoot` doc comment now says that the snapshot path catches and logs a cleanup failure, which is why it rethrows its own error. New unit case: `NFR-3: a refused snapshot whose backup cleanup fails rethrows the refusal`. It uses a `removeBackup` that rejects and an agent target outside the scope, and checks that the rejection is a `PathContainmentError` whose `child` is the outside target.
**Red proof:** I put the pre-fix source back with the new test still in place. The pair run (`env -i ... npm run --silent test:coverage:direct -- .../prune-rollback.ts`) failed with exit 1: `✖ NFR-3: a refused snapshot whose backup cleanup fails rethrows the refusal`, `AssertionError [ERR_ASSERTION]: ... assert.ok(error instanceof PathContainmentError)`. Then I restored the fix.

### WR-02: No case proves that the permission walk does not follow symlinks or touch the live tree

**Files modified:** `test/orchestrators/plugin/prune-rollback.test.ts`
**Commit:** f513a93
**Applied fix:** New case `NFR-3: discard changes no mode behind a backup symlink or in the live tree`, placed beside the read-only cases. It seeds the skill and adds the 0o555 `read-only` directory. It creates an empty `outside-dir` in the case cwd with mode 0o555 and links it from the skill directory as `linked`. Then it prepares, calls `discard()`, and checks this whole value: `{ outside: 0o555, live: 0o555, backups: [] }`.
**Red proof:** Through a scratch edit, `grantBackupWrites` used `stat` in place of `lstat`. The pair run failed with exit 1, and only the new case failed: `actual: { outside: 493, live: 365, backups: [] }`, `expected: { outside: 365, live: 365, backups: [] }`. The walk followed the link and widened the outside directory to 0o755. The edit was reverted with `git checkout`. The diff is in `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/fix-04/wr02-break.diff`.

### WR-03: N02 now writes a project config first, so it no longer catches a preview that creates a missing config

**Files modified:** `features/plugin/prune.feature`, `features/step_definitions/plugin/prune.steps.ts`
**Commit:** 709a36b
**Applied fix:** N02 ("Previewing a prune of a project scope that holds no installation record changes no file of either scope") no longer writes a base config. It now starts with the new verb step `Given the project scope to prune exists and holds no files`. That step creates the scope root and asserts that `readdir` returns `[]`. The whole-scope remember and compare steps then fail on any file the preview creates, a `claude-plugins.json` included. The step text names its verb, per D-08, and the module's `@fileoverview` lists the new step.
**Red proof:** I ran `break.sh FIX04-W3 adapter` with an edit to `orchestrators/plugin/prune.ts`. Before the dry-run `loadState`, the edit writes `locations.baseConfigJsonPath` with `flag: "wx"`, so it creates a missing `claude-plugins.json` during the preview. The run failed with `1) Previewing a prune of a project scope that holds no installation record changes no file of either scope # features/plugin/prune.feature:521` at `Then the files of the project scope are unchanged` (`+ 'claude-plugins.json'`), then printed `exit=1` and `restored=clean`. The log is at `.../scratchpad/fix-04/FIX04-W3-adapter.log`.

### IN-01: The doc comment says a kept backup never has its modes changed, but two paths do keep one

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts`
**Commit:** 4e94d6f
**Applied fix:** This is a change to the `removeBackupRoot` doc comment only. It no longer says that "the permission walk never changes a kept backup". It now says that a rollback with restore failures never calls the walk. It also says that a removal that fails after the walk keeps the backup, with each directory the walk reached now writable by its owner. It names the paths: `rollback` reports a `backup cleanup` failure, and `discard` and the snapshot failure path log one. It also warns that a manual restore from such a backup gives writable directories, not the plugin's read-only modes. No behavior changed, so no red proof applies.

### IN-03: No remaining check confirms that a successful prune releases the state lock

**Files modified:** `features/plugin/prune.feature`
**Commit:** 640c9e1
**Applied fix:** The cheapest actual-prune scenario is the first prune at `prune.feature:15`: a dir source and one install and uninstall. Its new title is "Pruning a scope uninstalls a dependency that no installed plugin needs and releases the state lock". After its checks it runs `/claude:plugin prune --scope project` again and expects `prune-empty` / `info` / `needs reload false` / `scope project`. An actual prune takes the state lock even when nothing is left to remove, so a leaked lock turns the second result into the lock-held error.
**Red proof:** I ran `break.sh FIX04-I3 adapter` with an edit to `orchestrators/plugin/prune.ts`. After the transaction, the edit takes the state lock again with the same `proper-lockfile` options as `with-state-guard.ts` and never releases it. The run failed with `1) Pruning a scope uninstalls a dependency that no installed plugin needs and releases the state lock # features/plugin/prune.feature:15` at the second `Then the result has these fields:`. The result was `cascade` / `error` / summary `A plugin operation has failed.` in place of `prune-empty` / `info`. The log ended with `exit=1` and `restored=clean`, and is at `.../scratchpad/fix-04/FIX04-I3-adapter.log`.

## Left Open (out of scope by orchestrator decision)

- **IN-02** (an `lstat`/`chmod` race could follow a swapped-in symlink): optional hardening, not applied.
- **IN-04** (in U01, both scopes read the same broken manifest): the review requires no fix. P01 and the no-scope prune scenario cover scope isolation.

## Verification

All checks ran in the main checkout, with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`:

- `npm run check:static`: passed on the final tree (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- Unit pair, direct coverage: `env -i HOME=$HOME PATH=$PATH LANG=C.UTF-8 TMPDIR=/tmp ... npm run --silent test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts` exited 0 on the final tree, with 100% direct coverage of the pair.
- `features/plugin/prune.feature` under the adapter profile (`npm run test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/prune.feature`): 41 scenarios passed, 617 steps passed.
- Each commit's pre-commit hook passed, including `npm run check:commit`. No hook was skipped, and `--no-verify` was never used.
- `git status --porcelain -- extensions/` is empty. The only change under `extensions/` is the committed WR-01 change and its IN-01 comment correction, in `prune-rollback.ts`. Neither `break.sh` break was committed.
- `.fallowrc.json` and `.github/workflows/*` were not edited.

---

_Fixed: 2026-11-22_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
