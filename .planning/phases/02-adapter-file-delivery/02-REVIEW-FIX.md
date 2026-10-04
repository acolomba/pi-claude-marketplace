---
phase: 02-adapter-file-delivery
fixed_at: 2026-10-04T00:35:51Z
review_path: .planning/phases/02-adapter-file-delivery/02-REVIEW.md
iteration: 3
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-10-04T00:35:51Z
**Source review:** .planning/phases/02-adapter-file-delivery/02-REVIEW.md
**Iteration:** 3

**Summary:**

- Findings in scope: 2 (WR-01 and WR-02 of the iteration-3 review). The seven
  Info findings are out of scope.
- Fixed: 2, both by one commit that follows operator decision D-02-20
- Skipped: 0

Both Warnings came from the rename-aside restore that `f692a2c7` added. D-02-20
removes that mechanism, so one restructure fixes both findings. I did not
apply either finding's suggested patch. Each patch kept the staging directory,
and D-02-20 forbids it.

## Fixed Issues

### WR-01: The kept `.prune-restore-*` directory sits outside NFR-10 containment, and nothing points the user to it

### WR-02: Any non-`EEXIST` failure after the rename leaves the live MCP config file deleted

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts`, `tests/orchestrators/plugin/prune-rollback.test.ts`
**Commit:** 4658eb59
**Status:** fixed: requires human verification (the restore condition and its ordering changed)
**Applied fix (D-02-20):**

- I removed `restoreOverOwnWrite`, `OwnWriteVerdict`, and the `rename` import.
  The metadata restore no longer creates a `.prune-restore-*` directory and
  never renames, unlinks, or moves the live file. This fixes WR-01, because
  there is no staging directory left to hide or keep. It also fixes WR-02,
  because no step removes the target.
- `publishBackupCopy` existed only so the metadata restore could share it.
  I inlined it back into `restoreArtifact`, which now has the same shape it
  had before `f692a2c7`. Artifact-restore behavior did not change.
- The verdict carries the recorded write and the backup bytes again
  (`{ kind: "own-write", ownWrite, original }`). The restore runs in this
  order:
  1. `metadataVerdict` reads the live bytes and compares them with the
     recorded write.
  2. The `afterMetadataRead` seam runs.
  3. `holdsBytes` checks the live file again. It must still exist, still be
     a regular file, and still hold the recorded bytes (a `Buffer.equals`
     check).
  4. `writeFileAtomic(target, original)` runs.

  If either compare fails, the restore gives the "Prune rollback found an
  occupied metadata path at …" refusal and keeps the backup. A file that is
  removed between the two compares gives the same refusal, not a raw
  `ENOENT`.
- A comment at the write names D-02-20 and the accepted window: an edit that
  lands between the last compare and the atomic rename is overwritten. The
  `state.json` restore has the same window.
- `PruneRestoreOps` gained an optional `writeMetadata?: (target, bytes) =>
  Promise<void>` fault seam. Production passes nothing, so it uses
  `writeFileAtomic`. The module had no existing seam that could make the
  metadata write fail. `npm run lint:type-members` passed, and no pin needed
  changes.

**Tests (`tests/orchestrators/plugin/prune-rollback.test.ts`):**

- Removed: "D-02-19: an edit that cannot be linked back stays in the restore
  staging directory". It tested the mechanism that this fix removes.
- Added: "D-02-20: a failed restore write leaves the adapter file in place and
  keeps its backup". The test makes both write primitives fail for the adapter
  path: `ops.link` and the new `ops.writeMetadata`. It checks four things:
  - The failure is the write error.
  - `mcp-adapter.json` still exists with the bytes the prune wrote.
  - The backup holds the original.
  - The scope root has no `.prune-restore-*` entry, both while the write runs
    and after it. The entries are recorded from inside the `writeMetadata`
    fault.
- Added: "D-02-20: an adapter removed after the rollback reads the recorded
  unstage write stays absent with its backup". It covers the `pathExists`
  branch of the second compare: the result is the refusal, no file is created,
  and the backup is kept.
- These cases still pass: "D-02-19: an adapter edit after the rollback reads
  the recorded unstage write stays current with its backup" (it still asserts
  that no `.prune-restore-*` entry exists) and "MCP edit during rollback
  observation remains current with recovery backup". The pinned `prune.test.ts`
  cases also pass: "an MCP edit after a cascade with no MCP resources survives
  failed persistence" and "D-02-19: a rolled-back prune restores its own
  mcp-adapter.json rewrite byte-for-byte". Results: `prune-rollback.test.ts`
  43/43, `prune.test.ts` 34/34.

**Negative control:** I copied `prune-rollback.ts` from `HEAD` (`d018b6a5`,
which has the `f692a2c7` code) over my version. Then I ran the two D-02-20
cases, and both failed (exit 1):

- The failed-write case gave the `adapter link refused` failure. This is the
  link fault, which reaches the restore only after `rename` has moved the live
  file aside. That is the WR-02 path, where the review found `ENOENT` on the
  live file.
- The removed-file case gave a raw `ENOENT … rename … .prune-restore-*/aside`.

I then restored my version, and `cmp` confirmed it matched. Note: the
`writeMetadata` seam does not exist in the old code. The old code fails this
test through the `link` fault, which is its write primitive.

## Verification

- Where it ran: directly in the main checkout on `features/mcp-4`, with no
  worktree (operator instruction). The results can be reproduced from this
  checkout.
- Focused checks before the hook run:
  - `tsc --noEmit`: exit 0.
  - ESLint on both files: 0 errors. The only warnings are the three
    `no-await-in-loop` directives that were already unused.
  - Prettier: ran.
  - `npx fallow health`: exit 0, 0 above threshold.
  - `npm run test:coverage:direct -- tests/orchestrators/plugin/prune-rollback.test.ts`:
    passed. Coverage of `prune-rollback.ts` was branches 119/119, functions
    21/21, lines 450/450.
  - `npm run lint:type-members`: passed.
- Hook run: `SKIP=trufflehog pre-commit run --files <2 changed paths>` gave
  `PRECOMMIT_EXIT=0` on the first run, including "npm changed checks". The
  hooks rewrote nothing: `git diff --stat` was the same before and after.
- `npx fallow audit --format json --quiet --explain --gate-marker agent`: verdict
  `warn`, not `fail`. The only "introduced" clone groups are in
  `tests/architecture/catalog-uat/fixtures/plugin-info.ts`, as in earlier
  iterations. This change does not touch that file.
- Node v26.10.0.
- Scope: focused task verification passed. Full phase and PR verification is
  still pending.

---

_Fixed: 2026-10-04T00:35:51Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_

## Post-cap test fix: WR-03 (narrow review)

The narrow review of `4658eb59` found that no test held the `isFile()` guard
in `holdsBytes` (`prune-rollback.ts`). The orchestrator added the review's
proposed case in `25ea04c6`: "D-02-20: a symlink swapped in after the rollback
reads the recorded unstage write is refused". It passes on the real module and
fails when `.isFile()` is removed (mutation run, module restored and clean).
Hooks: `PRECOMMIT_EXIT=0` (`tmp/wr03-precommit.log`). fallow audit: `warn`,
from clone groups that were already there, not `fail`. The final review status is `clean`.
