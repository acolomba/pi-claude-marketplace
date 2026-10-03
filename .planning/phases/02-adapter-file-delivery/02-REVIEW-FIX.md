---
phase: 02-adapter-file-delivery
fixed_at: 2026-10-03T17:10:00Z
review_path: .planning/phases/02-adapter-file-delivery/02-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 6
skipped: 2
status: partial
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-10-03T17:10:00Z
**Source review:** .planning/phases/02-adapter-file-delivery/02-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 8 (CR-01, WR-01..WR-07; Info excluded by `critical_warning` scope)
- Fixed: 6 (CR-01, WR-01, WR-02, WR-03, WR-05, WR-07)
- Skipped: 2 (WR-04, WR-06), each needing an operator decision

Every fix ships with a test that fails without it. I confirmed each one by
reverting the production change and re-running the new cases. `rg "D-02-" extensions tests` stays at 11 lines.

## Merge status (action needed)

The five fix commits are on the branch `gsd-reviewfix/02-1834034`
(`e6cd1997..b494a389`), and that branch sits directly on top of `574f4afe`. They are
**not yet on `features/mcp-4`**. The permission classifier denied the cleanup's
fast-forward (`git merge --ff-only gsd-reviewfix/02-1834034` in this checkout), so I
kept the branch for a manual merge. The worktree is removed and the recovery sentinel
is deleted. To land the fixes, run `git merge --ff-only gsd-reviewfix/02-1834034` on
`features/mcp-4`, then `git branch -D gsd-reviewfix/02-1834034`.

## Verification

- Where the gates ran: an isolated worktree (`.claude/worktrees/rf-02-*`, branch
  `gsd-reviewfix/02-1834034`). Its `node_modules` was a `cp -a --reflink` copy of the
  main checkout's, because `lint:type-members` rejects a symlinked `node_modules`.
  The worktree was removed afterwards. To reproduce, run the gates in the main
  checkout at `b494a389`.
- Command: `TMPDIR=/var/tmp/mcp4-p2-fix SKIP=trufflehog pre-commit run --files <17 changed paths>`
  gave `PRECOMMIT_EXIT=0`. Because the contracts file changed, `check:changed` ran at
  `scope: full`: `npm run check` and `npm run test:coverage:direct:all`.
- Node v26.10.0. The tree that ran was byte-identical to commit `b494a389`. The
  contracts file was re-split per commit afterwards, and the final file is identical.
- Before that run, focused checks also passed: `tsc --noEmit`, ESLint on the changed
  files (only warnings that were already there), `fallow health` and `fallow dupes`
  (exit 0), `lint:type-members`, and `test:coverage:direct` on all 8 changed production
  modules (100% branches, functions and lines each).
- Scope: the full check passed on the combined tree, so this is not only a focused
  result.

## Fixed Issues

### CR-01: The self-replace exemption overwrites a user's full server definition when the plugin's old entry sits under the shadowed key

**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`, `tests/bridges/mcp/stage.test.ts`, `scripts/check-unused-type-members.contracts.json` (line re-pins only)
**Commit:** e6cd1997 (shared with WR-07: same file)
**Status:** fixed: requires human verification (logic condition change)
**Applied fix:** `assertNoMcpCollisions` now skips a name only when the plugin owns it
**and** no foreign entry under the loaded key holds it
(`ours && !theirs`). Otherwise the target file counts as a declarer, and staging
refuses with `McpServerCollisionError` naming the target. The new case uses the
reviewer's exact input: the user's `server` (with an `env` token) under
`mcpServers`, and the plugin's marked `server` under `mcp-servers`. It asserts the
refusal fields and unchanged file bytes.

### WR-07: The "exact prior bytes" restore decodes as UTF-8, so it is not byte-exact

**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`, `tests/bridges/mcp/stage.test.ts`
**Commit:** e6cd1997 (shared with CR-01)
**Applied fix:** `replacePreparedMcp` now captures the prior file as a `Buffer`
(`readOptionalBytes`), and `rollbackMcpReplacement` writes that `Buffer` back. A new
case puts bytes `0xff 0xfe` inside a JSONC comment and compares the restored file as
a whole `Buffer`.

### WR-05: An unstage that fails on the legacy write loses the adapter file's notice and reports no dropped MCP servers

**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts`, `extensions/pi-claude-marketplace/shared/errors-bridges.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`, `tests/bridges/mcp/unstage.test.ts`, `tests/shared/errors-bridges.test.ts`, `tests/orchestrators/marketplace/shared.test.ts`
**Commit:** 883ddd21
**Applied fix:** I added a new typed error, `McpUnstagePartialError { removedNames, notices }`, with the
write failure on `cause`. `unstageMcpServers` writes each target in order. If a write
fails after an earlier write succeeded, it throws this error. It describes only the
files already rewritten. A failure on the first write is rethrown unchanged.
`cascadeUnstagePlugin` puts the carried names into `dropped.mcpServers` and the
notices into `mcpConfigNotices`. It reports the underlying write failure as the
plugin's cause, so the text the user sees does not change. The tests cause a real
EACCES: they point the file at a symlink into a 0o555 directory, so the read succeeds
and the atomic write fails.

### WR-03: removeMarketplace loses collected MCP notices when its state transaction throws

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `tests/orchestrators/marketplace/remove.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`, `scripts/check-unused-type-members.contracts.json` (line re-pins only)
**Commit:** 13958368
**Applied fix:** The catch in `runRemoveOutcome` now calls
`rethrowWithMcpConfigNotices`, which handles three cases:

- No notices: the error is rethrown as before.
- Standalone: the notices are shown, then the original error is rethrown.
- Orchestrated: it throws the new `MarketplaceRemoveFailureError { mcpConfigNotices }`,
  with the original error as its cause.

`applyMarketplaceRemoves` unwraps that error. It classifies and logs the original
cause, so the reason stays the same. It also adds the notices to the
`mp-remove-failed` row. The remove tests inject a failing `saveState`. The apply test
gets a real save refusal: `state.json` is a symlink into a read-only directory, so
reads and the scope lock still work.

### WR-02: A bulk update that aborts on a thrown plugin or sync failure drops the notices of plugins it already updated

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`, `tests/orchestrators/plugin/update-flow.test.ts`, `scripts/check-unused-type-members.contracts.json` (line re-pins only)
**Commit:** c889c87a
**Applied fix:** Both early-return arms (the `syncCloneOnce` failure and the
`runPluginUpdate` throw) now call `surfaceUpdateMcpConfigNotices(ctx, outcomes)`
after `notifyDirectFailure`. I did not add the "also render the accumulated cascade"
extension. Those rows were already missing before this phase, and adding them would
change existing output. Two new cases check the exact notifications:

- A later plugin fails because a locked state load throws once `hello` is saved at
  1.0.1.
- A later GitHub marketplace sync fails.

### WR-01: Install drops the comments-dropped notice when the config write-back or the save throws after a successful cascade

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`, `tests/orchestrators/plugin/install-flow.test.ts`, `scripts/check-unused-type-members.contracts.json` (line re-pins only)
**Commit:** b494a389
**Applied fix:** `cascadeFailure.mcpConfigNotices` is now set as soon as each
rewrite returns:

- after a successful cascade;
- after the landed-disabled disable cascade, with the merged list;
- inside `promoteDependencyRecord`, right after the re-materialization and before
  `declarePromotedPlugin`, through a new `sink` field on `PromotionArgs`;
- in `installMissingDependencyWithTransaction`, before `tx.save()`.

The existing catch arms already render the sink after the failed row. Four new cases
use a transaction whose `save` rejects:

- plain install;
- landed-disabled install with a commented legacy `mcp.json` (both notices);
- promotion of a disabled dependency;
- reload missing-dependency install (notice on the failed outcome).

## Skipped Issues

### WR-04: A rolled-back prune never restores mcp-adapter.json, leaving state and the adapter file out of step

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:220-230`
**Reason:** A correct fix needs a design choice that no locked decision settles, so I
skipped it. I tried the suggested direction: record the metadata bytes after each
member's unstage, by wrapping the injected cascade, and restore when the live file
still matches. That breaks the pinned test `an MCP edit after a cascade with no MCP
resources survives failed persistence` (`tests/orchestrators/plugin/prune.test.ts:1015`).
That test puts a third-party edit inside the cascade call. Re-reading the file from
disk cannot tell that edit apart from the prune's own rewrite. That re-read is
"assume", not "compare". I reverted the attempt; nothing was committed.

**Proposed approach (operator to choose):**

1. Exact: `unstageMcpServers` returns the serialized bytes it wrote for each file.
   `McpUnstagePartialError` carries the bytes for the file it already rewrote. These
   go through `UnstageOutcome` (for example as `writtenMcpFiles`). Prune records them
   for each member, and the last write wins for each path. `restoreMetadata` writes
   the backup back only when the live bytes equal the recorded bytes, and keeps the
   "occupied" refusal otherwise. `agents-index.json` keeps today's behavior unless the
   agents bridge gets the same contract.
2. Cheaper: re-read after the cascade, but only for members whose outcome dropped MCP
   servers. This passes the pinned test. A concurrent edit that lands in the
   milliseconds between the bridge's write and the re-read would be treated as the
   prune's own and overwritten.
3. At minimum: reword the comment near the refusal so it no longer blames an outside
   writer.

**Original issue:** `restoreMetadata` refuses whenever the target differs from its
backup. The prune's own unstage always rewrites `mcp-adapter.json` for a member that
has MCP servers. So every rollback reports `occupied metadata path` and leaves state
and the adapter file out of step.

### WR-06: A failed multi-member install or enable cascade does not restore mcp-adapter.json bytes, which departs from D-02-11's wording

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:1007-1070`, `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:830-857`
**Reason:** This needs an operator decision. Implementing it reverses the
single-plugin narrowing that existing tests pin on purpose. For example,
`install-flow.test.ts` "AFILE-04: a failed dependency cascade still reports the
removed comments after its failed row" asserts the reformatted file and the notice.
D-02-11 also leaves these choices open:

- whether enable cascades are covered (D-02-11 names install only);
- what happens when the outer undo itself records rollback partials;
- whether the legacy `mcp.json` is snapshotted too (the outer undo's
  `cascadeUnstagePlugin` rewrites it, per D-02-12);
- whether the members' comments-dropped notices are dropped after a restore.

The reviewer offers both a fix and an amendment to D-02-11, and the fix guidance names
this finding as one to send to the operator.

**Proposed approach:**

- Option A (honor D-02-11 for cascades): before the first member phase in
  `runInstallCascade`, and in `runEnableCascade*` if the operator extends D-02-11,
  snapshot the raw bytes of `mcp-adapter.json` and probably `mcp.json`, as a `Buffer`
  (see WR-07). On `member-failed` with zero rollback partials, write the snapshots back
  with `writeFileAtomic` and drop the members' comments-dropped notices. Update the
  pinned AFILE-04 cascade tests.
- Option B: amend D-02-11 to record the single-plugin narrowing, and record it as a
  deviation in the phase summary.

**Original issue:** When member B of a dependency cascade fails, the outer undo
unstages the already-materialized member A from the rewritten file. The user's file
comes back reformatted and without its comments. D-02-11 rules out that pattern.

## Deviations from the fixer protocol

- I anchored the worktree on this checkout (`features/mcp-4`, a linked worktree), not on
  the first `git worktree list` entry. That entry is the main repo on `main`, and a
  fast-forward there would have merged into the wrong branch.
- I split the line re-pins in `scripts/check-unused-type-members.contracts.json` by
  source file across the per-finding commits. Each commit's pins match that commit's
  sources, and the final file is byte-identical to the one the full check validated.
  Without the split, every finding that touched a pinned file would collapse into one
  commit.
- Commit subjects use `fix(mcp): ...` with the finding IDs in the body. The project's
  commit rules forbid phase numbers in commit messages, so I did not use
  `fix(02): <ID> ...`.

---

_Fixed: 2026-10-03T17:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
