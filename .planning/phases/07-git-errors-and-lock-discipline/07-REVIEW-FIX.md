---
phase: 07-git-errors-and-lock-discipline
fixed_at: 2026-10-27T00:00:00Z
review_path: .planning/phases/07-git-errors-and-lock-discipline/07-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 3
skipped: 3
status: partial
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-10-27
**Source review:** .planning/phases/07-git-errors-and-lock-discipline/07-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 6 (the dispatch named WR-01, WR-02, IN-01, and the
  `fetch` half of IN-04 to fix, and IN-02, IN-03, and the
  `marketplace/update.ts` half of IN-04 to record as skipped)
- Fixed: 3 (WR-01, IN-01, IN-04 (a))
- Skipped: 3 (WR-02, IN-02, IN-03; IN-04 (b) is recorded under IN-04)

## Fixed Issues

### WR-01: Plugin update refreshes the marketplace clone with no scope lock

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`,
`test/orchestrators/plugin/update-flow.test.ts`, `features/plugin/url-marketplace-update.feature`
**Commit:** 96103d64
**Status:** fixed

**Caller trace (no nesting):** `makeSyncCloneOnce` has one caller,
`updatePluginsWith`. That function is reached only through
`createPluginUpdateOperations().updatePlugins`, which only the
`/claude:plugin update` edge handler calls
(`edge/handlers/plugin/update.ts` through `index.ts` and `edge/register.ts`).
That path holds no lock. Inside `updatePluginsWith`, `syncCloneOnce` runs
before `runPluginUpdate`, which takes each target's own locks. The other
update paths never call `syncCloneOnce`:

- the autoupdate cascade (`beginPluginUpdateRun` -> `updateSinglePluginWith`)
- apply's converge (`convergePlugin` -> `convergePluginWith`)
- reinstall (`reinstall-flow.ts`)
- dependency moves and settles (`settleDependencies`, `dependency-move.ts`)

**Lock scope:** `syncCloneOnce` gets the target's `locations`. That scope
records the marketplace (D-MF-04) and owns `sourceCloneDir(mpName)`. This is
the same lock that `marketplace update` takes around its refresh
(`withLockedStateTransaction(locations, ...)`) and that the preflight's tag
copy takes (`withExistingScopeLock(options.locations, ...)`).

**Applied fix:** `refreshFramed` now takes `locations` and runs the refresh
in `withExistingScopeLock`. Only the github and url arms take the lock. The
path arm stays a no-op, so it does no lock work, keeping NFR-5 and WR-02 / NFR-3.
Like `marketplace update`, the refresh's credential and Device Flow handling
runs under the lock. A held lock throws `StateLockHeldError`, which
`typedUpdateFailReason` maps to `lock held`. The row is named after the
marketplace, as every other sync failure is.

**Tests:**

- New unit case `GLK-04: a held scope lock refuses the marketplace sync as
  lock held before any git write`. It pins the whole notification and
  asserts that no fetch or forceUpdateRef call was made. With the lock
  wrapper reverted, the case fails.
- The change made one branch unreachable from the sync path:
  `notifyDirectFailure`'s non-Error normalization, because the lock wrapper
  already turns a non-Error into an Error. A new case, `a non-Error rejection
  from a target's run is normalized at the direct boundary`, covers that
  branch through the dependency resolver seam. Direct coverage of
  `update-flow.ts` is back to 100%.
- **Cucumber:** a held lock now changes what the user sees for a github or
  url marketplace. The row is `<marketplace> (failed) {lock held}` and no
  request reaches the host. Before, the refresh ran and the update went on.
  The behavior is deterministic with a helper process that holds the lock.
  So, per AGENTS.md, it ships a scenario in
  `features/plugin/url-marketplace-update.feature`: `Updating a plugin while
  another process holds the state lock fails as lock held and does not
  refresh its url marketplace`. It fails with the lock wrapper reverted and
  passes with it. 07-CONTEXT's "lock behavior is unit-tested only" rule is
  about the GC, tag copy, and same-millisecond races, which cucumber cannot
  make deterministic. This refusal is deterministic.

**Trade-off to note:** under contention, a bare `plugin update` over a git
marketplace now aborts its batch at that marketplace's sync, as any sync
failure does. Before, it went on. The path-marketplace lock-free skip
(WR-02 / NFR-3) is unchanged.

### IN-01: `nextUpdateStamp` throws a `RangeError` on a maximum-date stamp

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`,
`test/orchestrators/plugin/update-swap.test.ts`
**Commit:** e8ce1713
**Status:** fixed

**Applied fix:** `nextUpdateStamp` builds `new Date(max(now, prior + 1))`.
When that date is invalid, it falls back to `new Date(now)`. A date is
invalid when the stamp does not parse (NaN) or when `prior + 1` is past the
largest Date. The current time still differs from the replaced stamp, so the
ST-9 check holds.

**Tests:** the new case `GLK-06: an intent mark replaces an updatedAt at the
largest date with the current time` seeds `+275760-09-13T00:00:00.000Z`.
With the old function, the case fails. The three existing GLK-06 cases still
pass. Direct coverage of `update-swap.ts` is 100%.

### IN-04: Two fallback paths name the wrong reason (part (a), `fetch`)

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`,
`test/orchestrators/plugin/fetch.test.ts`
**Commit:** 11b2c5fd
**Status:** fixed (part (a)); part (b) skipped, see below

**Applied fix:** `fetchOne` records `rowRead` once the locked body has built
its row. A throw after that point can only come from the lock wrapper: the
lock was lost (`StateLockCompromisedError`) or could not be released.
`narrowFetchFailure(err, remoteUrl, rowRead)` maps that case to `lock held`,
the reason `fetch` already gives a held lock. The cause line still shows the
lock error. The pinned arm takes no lock and returns right after the row
read, so its reasons do not change.

**Tests:** the new case `GLK-05: a lock lost after the locked fetch read its
row fails the row as lock held`. The `resolveListCandidate` seam unlocks the
scope lock, so the release rejects with `ERELEASED`. The case pins the whole
notification:
`⊘ lost-lock (failed) {lock held}` / `cause: Lock is already released`.
It also asserts that the lock is free afterwards. Without the fix, the row
reads `{source missing}` and the case fails. Direct coverage of `fetch.ts`
is 100%. No cucumber scenario: a lock lost in the middle of an operation is
not deterministic from outside the process (07-CONTEXT Tests).

**Part (b), skipped:** the `cascadeAutoupdates` catch in
`orchestrators/marketplace/update.ts` classifies with the
marketplace-refresh rule. `runCascadeTarget` catches every throw except an
invalid GitHub base URL, so in production nothing reaches this catch (the
reviewer says the same). Per the dispatch, it is not changed.

## Skipped Issues

### WR-02: Autoupdate cascade rows print raw absolute local paths

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:795`
**Reason:** parity with the direct path, a pre-existing path-in-cause class.
For the same failure, the direct `plugin update` row prints the same raw
cause. `notifyDirectFailure` puts `cause: err` on the row with no path
redaction, and the row renderer (`notification-resolve.ts`) redacts only
credentials. `deferred-items.md` ("From 07-06") also records that both the
direct and the cascade row print the `skills-staging/<uuid>` path. D-PL7-12
chose cascade parity on purpose, so the code is not changed. One line was
added to the Deferred section of `07-CONTEXT.md` (commit a66a932f).
**Original issue:** D-PL7-12 attaches `cause: err` on untyped cascade arms,
so an autoupdate row shows raw `cp`/`open` error text with absolute local
paths.

### IN-02: The D-PL7-08 monotonic-stamp guarantee is local to `update-swap.ts`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:810`
**Reason:** skipped by the dispatch scope. The fix would add a shared stamp
helper and edit `updatedAt` writers in files that other phases own
(`enable-disable.ts`, `install-disable-cascade.ts`,
`reconcile/mcp-migration.ts`).
**Original issue:** other `updatedAt` writers still write `new Date()`. Within
a sub-millisecond window, one of them can write a stamp equal to one a rival
update's preflight already read.

### IN-03: Rule constants are duplicated instead of exported with the classifier

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:161,839` (and five more sites)
**Reason:** skipped by the dispatch scope. It is a refactor across several
files, with no change in behavior.
**Original issue:** `MARKETPLACE_REFRESH_RULE` and inline
`{ notFound: "source missing" }` literals are copied at several sites, so a
later change to one rule can miss some copies.

## Verification

All of these ran in the main checkout of the
`features/plugin-lifecycle-p7` worktree
(`/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-p7-gitlock-745e94`).
No nested review-fix worktree was made. The dispatch's commit rules require
pathspec commits in this checkout, and a nested worktree would have no
`node_modules` for the commit hook. So the results below come from this
tree.

- Focused unit tests (`node --test` on the touched test files): pass.
- Direct coverage (`node scripts/test-coverage-direct.mjs <source>`) for
  `update-flow.ts`, `update-swap.ts`, and `fetch.ts`: 100%, exit 0.
- The commit hook (`npm run check:commit`) passed on each fix commit.
- Cucumber: `features/plugin/git-source-update.feature`,
  `features/plugin/url-marketplace-update.feature`,
  `features/plugin/fetch.feature`, and `features/plugin/update.feature`: 51
  scenarios passed.
- `npm run check:features`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run fallow`: exit 0.
- The full `npm run check` was not run; the orchestrator runs it.

______________________________________________________________________

_Fixed: 2026-10-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
