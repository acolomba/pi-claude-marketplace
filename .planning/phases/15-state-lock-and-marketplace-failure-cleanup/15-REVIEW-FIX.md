---
phase: 15-state-lock-and-marketplace-failure-cleanup
fixed_at: 2026-10-23T00:00:00Z
review_path: .planning/phases/15-state-lock-and-marketplace-failure-cleanup/15-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 15: Code Review Fix Report

**Fixed at:** 2026-10-23T00:00:00Z
**Source review:** .planning/phases/15-state-lock-and-marketplace-failure-cleanup/15-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (WR-01 to WR-05, plus IN-02 and IN-04 if cheap)
- Fixed: 6
- Skipped: 1 (IN-04)

**Verification:** `npm run check` ran in the main checkout of this worktree
(`lc-p15-state-lock-6e5436`), no separate review-fix worktree, at HEAD
4468fe5f. Exit code 0: static checks, unpaired tests, integration, 493
cucumber scenarios, and direct coverage of all pairs passed. Each commit's
`npm run check:commit` hook also passed.

## Fixed Issues

### WR-01: The lock-held `marketplace add` child row breaks the add command's own id rule (D-19) and does not meet D-04's naming

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`, `test/orchestrators/marketplace/add.test.ts`, `features/marketplace/state-lock.feature`, `.planning/phases/15-state-lock-and-marketplace-failure-cleanup/15-CONTEXT.md`
**Commit:** e5d3dc5b
**Applied fix:** `surfaceLockHeldAdd` now marks the child row of `marketplaceFailureRows` with `marketplaceSubject: true`. Its JSON id is now the bare typed source (ADD-10), not `<source>@<source>`. The add-under-lock Outline's `id` cell is now `<source>`. A new unit case pins the JSON payload, with `id: "owner/repo"`. 15-CONTEXT.md has a `D-04 (amended)` line: the add row is named by the typed source because the add takes the lock before it reads a manifest (ATTR-07 A2), and its id is the bare source (ADD-10).

### WR-02: A held lock during the `marketplace update` autoupdate cascade still reads `{not in manifest}` with no cause

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`, `test/orchestrators/plugin/update-flow.test.ts`
**Commit:** 1cc5ae8a
**Applied fix:** `reasonsFromTypedError` maps a `StateLockHeldError` to `["lock held"]` before its other arms. The `updateSinglePluginWith` catch now spreads `cause: err` for a `StateLockHeldError`. No helper extraction was needed: fallow and the direct coverage stayed green. A new unit case holds the real lock (hermetic home) and calls the `PluginUpdateFn`. It asserts the whole failed outcome (reasons `lock held`, notes), that the cause is a `StateLockHeldError` with the right scope and lock path, and that `state.json` did not change. The case fails without the fix (checked by restoring the old source).

### WR-05: `failed-add.steps.ts` is named after a feature file, not a verb or a shared topic

**Files modified:** `features/step_definitions/marketplace/failed-add.steps.ts` (deleted), `features/step_definitions/marketplace/checkout.steps.ts` (new, by `git mv`)
**Commit:** 541f7d1d
**Applied fix:** Moved the step `the {word} scope holds no marketplace checkout` to the non-verb topic module `marketplace/checkout.steps.ts`, in its own commit. The step body is unchanged. The only other change is the `@fileoverview` first line, which now names the module's topic ("the marketplace checkouts a scope holds") and not the failed-add feature.

### WR-04: The add-under-lock Outline does not check for a staged checkout, the gap D-10 was created to close

**Files modified:** `features/marketplace/state-lock.feature`
**Commit:** 596ef045
**Applied fix:** Added `Then the <scope> scope holds no marketplace checkout` to the add-under-lock Outline. It is the step D-10 added, and WR-05 moved it to the topic module.

### WR-03: The three FLR-03 "leaves no marketplace behind" scenarios do not show that the add failed for the reason in their titles

**Files modified:** `features/marketplace/failed-add.feature`
**Commit:** 25411da2
**Applied fix:** In each of the three scenarios the failing add is now the only `When`. Each scenario asserts the result fields (error, `A marketplace operation has failed.`), the failed marketplace row and its reason, and the git host request log. The reasons and requests are: 404 gives `source missing` and a `GET info/refs 404`. A dropped connection gives `network unreachable` and a `GET info/refs dropped`. Invalid JSON gives `invalid manifest` and `GET info/refs 200` plus `POST git-upload-pack 200`. Then come the leftover checks: no marketplace checkout, no git clones, and no `claude-plugins.json`. The `marketplace list` step was dropped to keep one `When` per scenario. The retry scenarios still cover "no record left" for 404 and dropped connection: a leftover record would make the retried add fail.

### IN-02: The `surfaceRemoveStop` doc comment leaves out the CFG-03 arm

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`
**Commit:** 4468fe5f
**Applied fix:** The comment now lists the lock body stops, the CFG-03 sentinel, and a held state lock (FLR-02) as rows. Any other throw leaves through `rethrowWithMcpConfigNotices`.

## Skipped Issues

### IN-04: The exotic-throw add case pins the number of `instanceof` checks

**File:** `test/orchestrators/marketplace/add.test.ts:2959-2996` (now about line 3027)
**Reason:** Not cheap. The `getPrototypeOf` trap cannot tell which `instanceof` is reading. `handleAddFailure` has no observable call between `classifyAddError` and the `err instanceof Error` wrap that could flip a flag. So a test double that classifies as a duplicate but wraps as a non-Error needs one of two things. One is a read count, which is the current design. The other is to patch `MarketplaceDuplicateNameError[Symbol.hasInstance]` for the case, which changes a production class at runtime. Both need a design choice, so the case was left as it is.
**Original issue:** The case changed from `prototypeReads <= 2` to `<= 3`, and from 5 to 6 reads, only because a new `instanceof` arm was added. It pins how many `instanceof` checks the add makes, not its behavior.

## For the orchestrator

Not done in this run, by instruction:

- **IN-01:** `whileLockHeld` and `lockHeldCause` are duplicated in `test/orchestrators/marketplace/add.test.ts` and `test/orchestrators/marketplace/remove.test.ts`. `update-flow.test.ts` and `enable-disable.test.ts` inline the same `lockfile.lock` and `try`/`finally` block. WR-02 adds one more inline copy in `update-flow.test.ts`. `test/orchestrators/reconcile/mcp-migration.test.ts` has `holdStateLock`. Suggested: one shared `holdStateLock(locations, act)` helper and one `lockHeldMessage(scope, lockPath)` helper, for example in `test/transaction/state-lock-holder.ts`.
- **IN-03:** The deferred lock gaps exist only in 15-CONTEXT.md and have no `.planning/BACKLOG.md` entries. The CONTEXT's premise about import is wrong: an orchestrated import install returns from `classifyInstallFailure`, and `dispatchFailedOutcome` (`orchestrators/import/execute.ts`) has no `StateLockHeldError` arm, so a lock-held import install reads `unexpected-failure`. Entries needed: the import lock-held row, and the prune `(.state-lock)` cause redaction (D-06). WR-02 (the cascade lock reason) is fixed and needs no entry.
- **IN-04:** Skipped (see above). It needs a decision between a count-free double that patches `Symbol.hasInstance` and keeping the count pin.
- The WR-05 commit message says "move it unchanged". The step body is unchanged, but the `@fileoverview` first line was reworded to fit the new topic module.

---

_Fixed: 2026-10-23T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
