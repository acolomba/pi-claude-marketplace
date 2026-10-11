---
phase: 08-clear-milestone-debt
plan: 04
subsystem: orchestrators
tags: [reinstall, migration, git-source, d-08-05, amig-01, nfr-3, nfr-5]

requires: []
provides:
  - "`probeReinstallClone` treats a mirror whose HEAD cannot be read as unusable and materializes the recorded-sha clone through the clone-cache seam (D-08-05, NFR-3)"
  - "`makeRecordedShaPresenceProbe` makes the same source choice with file reads only: `materialized` from a warm recorded-sha clone, `not-cached` from a cold one (AMIG-01, NFR-5)"
  - "`makePresenceProbe` (list, info, completion) is unchanged"
affects: [08-21 ledger plan (P5 IN-08 closed here)]

actuals:
  tokens: 3106
  tasks: 2
  commits: 2
plan_head_before: 221f7f103670cc95835424292a6f5b77f3990347
plan_head_after: 5ba2752c24e70c417098df50c893703807dfd08f

tech-stack:
  added: []
  patterns:
    - "An unreadable mirror counts as a cache miss for the source choice. Reinstall and the offline migration probe both fall through to the recorded-sha clone."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
    - tests/orchestrators/plugin/reinstall-clone-probe.test.ts
    - tests/orchestrators/plugin/git-source-probe.test.ts
    - tests/orchestrators/reconcile/mcp-migration.test.ts

key-decisions:
  - "Reinstall wraps only the mirror HEAD read (`readUsableMirrorSha`). Subdirectory and clone failures keep their classification."
  - "The migration probe catches a throw from the whole mirror probe and falls through to `probeShaClone`. `probeMirror` and `makePresenceProbe` are unchanged."

patterns-established: []

requirements-completed: []

duration: 10min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 04: Reinstall falls back from a headless mirror Summary

**An unpinned git plugin whose mirror HEAD cannot be read now reinstalls from the recorded-sha clone. That clone comes from the clone-cache seam: offline when it is warm, fetched on a cache miss. Before this change, reinstall threw on every retry. The reload migration's offline presence probe makes the same choice with file reads only. So the `reinstall` remedy on a `source-unreadable` row now clears its cause (D-08-05, NFR-3, NFR-5).**

## Performance

- **Duration:** about 10 min (2026-10-10T03:37Z to 03:46Z)
- **Tasks:** 2/2
- **Files modified:** 5

## Findings closed

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| P5 IN-08 | fixed: reinstall falls back to the recorded-sha clone when the mirror HEAD cannot be read, and the migration probe makes the same source choice | 32bf8982, 5ba2752c |

## Task Commits

1. **Task 1: Reinstall of a headless mirror clones the recorded sha and succeeds.** Commit `32bf8982` (fix). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed.
2. **Task 2: The reload's offline presence probe makes the same source choice.** Commit `5ba2752c` (fix). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: the first attempt failed with no commit, because `mcp-migration.ts` was at 173/174 branches (see Deviations). After the fix, `npm run check:commit` Passed.

## Verify results (final lines)

- Task 1: `node --test` over reinstall-clone-probe and reinstall-flow: `ℹ pass 155 / ℹ fail 0`. `npm run test:coverage:direct -- …/reinstall-clone-probe.ts` exited 0. The tracer gate re-ran the same verify after the commit and got the same result.
- Task 2: `node --test` over git-source-probe and mcp-migration: `ℹ pass 106 / ℹ fail 0` (108 after the added migration case). `npm run test:coverage:direct -- …/git-source-probe.ts …/mcp-migration.ts` exited 0.
- The direct coverage of the consumers `reinstall-flow.ts` and `domain/plugin-resolver.ts` exited 0.
- BLOCK F grep on both modules (comment lines excluded) printed nothing.
- `npx fallow audit --base "$(git merge-base origin/main HEAD)" --format json` after Task 2: verdict `pass`, 12 inherited clone groups, 0 introduced. No group touches the changed files.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## TDD evidence

The hook measures direct coverage for the staged pairs, so a RED-only commit cannot pass it. I observed RED locally, and each task has one commit.

- Task 1 RED: both new cases failed with `ENOENT … .git/packed-refs` thrown from `readMirrorHeadSha`.
- Task 2 RED: `ℹ pass 43 / ℹ fail 2`. The two new `makeRecordedShaPresenceProbe` cases failed.

## New cases

- `D-08-05: falls back from a headless unpinned mirror to the recorded sha` (reinstall-clone-probe)
- `D-08-05: resolves a git-subdir under the recorded-sha clone behind a headless mirror` (reinstall-clone-probe)
- `D-08-05: an unpinned source behind a headless mirror reads the warm recorded-sha clone` (git-source-probe)
- `D-08-05: an unpinned source behind a headless mirror with no recorded-sha clone is not-cached` (git-source-probe)
- `AMIG-01 / NFR-10: a recorded-sha clone path the cache refuses to read gives one source-unreadable row and no write` (mcp-migration, see Deviations)

## Deviations from Plan

**1. [Rule 1 - Bug] Migration test title no longer matched the behavior**
- **Found during:** Task 2
- **Issue:** The `headless-mirror` row in the `source-unreadable` loop said "a mirror whose HEAD cannot be read, so the resolve throws". After this change the probe no longer throws. It returns `not-cached`, because the row seeds no recorded-sha clone. The row still gives `source-unreadable`, and the remedy text is unchanged.
- **Fix:** The title now reads "a mirror whose HEAD cannot be read and no recorded-sha clone".
- **Files modified:** tests/orchestrators/reconcile/mcp-migration.test.ts
- **Commit:** 5ba2752c

**2. [Rule 3 - Blocking] Coverage of `mcp-migration.ts` lost the probe-failure branch**
- **Found during:** Task 2 commit (the hook failed with `branches 173/174`, so nothing was committed)
- **Issue:** `resolveOffline`'s catch returns `clone.cloneUnread() ? "source-unreadable" : …`. The headless mirror was the only case that reached its true arm. The arm is still live: `pathExists` and `pluginCloneDir`'s containment check can still throw.
- **Fix:** I added one migration case that symlinks the recorded-sha clone path. `pluginCloneDir` refuses the symlink (`SymlinkRefusedError`), so the probe throws, and the row is `source-unreadable` with no write. A symlink trigger works on any platform and also as root, where a chmod trigger would not. The production code did not change.
- **Files modified:** tests/orchestrators/reconcile/mcp-migration.test.ts (outside the plan's `files_modified`)
- **Commit:** 5ba2752c

**3. Requirements not marked complete**
- DEBT-02 and DEBT-04 cover the whole phase. Plan 08-21 owns the phase-wide verdicts.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigations:
- T-08-11: a headless mirror falls back to the recorded-sha clone, so a retry converges. The two reinstall-clone-probe cases pin this.
- T-08-12: the migration fall-through calls only `probeShaClone`, which is a path check. The BLOCK F grep is empty, and the migration suite still passes.

## Self-Check: PASSED

- All five modified files exist.
- Commits 32bf8982 and 5ba2752c are ancestors of HEAD.
