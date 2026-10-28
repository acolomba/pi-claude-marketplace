---
phase: 07-git-errors-and-lock-discipline
fixed_at: 2026-10-28T16:27:02-04:00
review_path: .planning/phases/07-git-errors-and-lock-discipline/07-REVIEW.md
iteration: 5
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
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

## Iteration 2

**Fixed at:** 2026-10-27T08:58:29Z
**Source review:** .planning/phases/07-git-errors-and-lock-discipline/07-REVIEW.md
(iteration 2, four Info findings)

**Summary:**

- Findings in scope: 4 (the dispatch named IN-01 and IN-03 to fix, and IN-02
  and IN-04 to record as skipped)
- Fixed: 2 (IN-01, IN-03)
- Skipped: 2 (IN-02, IN-04)

The frontmatter totals count this iteration only.

### Fixed Issues

#### IN-01: A lost lock after a marketplace sync reads `{unreadable manifest}` in `update`

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`,
`test/orchestrators/plugin/update-flow.test.ts`
**Commit:** 05614199
**Status:** fixed

**Applied fix:** `typedUpdateFailReason` maps `StateLockCompromisedError` to
`lock held`, beside `StateLockHeldError`. That is the shared ladder, so the
direct row and the cascade rows (autoupdate, apply's converge) both read
`lock held`. A typed reason drops the cascade row's cause unless
`cascadeFailureOutcome` names the error. So `StateLockCompromisedError` joins
the FLR-02 list there. Without it, the cascade row would have lost the cause
line that it carried as an untyped error.

**Tests:**

- `GLK-04: a scope lock lost during the marketplace sync fails the sync as
  lock held`: the sync's `gitOps.fetch` throws `StateLockCompromisedError`
  inside the lock body. The case pins the whole notification:
  `⊘ official (failed) {lock held}`, with the lock error and its cause on the
  cause line.
- `FLR-02: an autoupdate cascade fails a plugin whose state lock was lost as
  lock held with the lock cause`: the dependency resolver seam rejects with
  the error. The case pins the whole outcome and checks that the cause is the
  lock error.
- With `update-flow.ts` reverted to HEAD, both cases fail. The direct row
  reads `{unreadable manifest}`.
- Direct coverage of `update-flow.ts`: 100% (branches 204/204).
- No cucumber scenario: a lock lost in the middle of an operation is not
  deterministic from outside the process (07-CONTEXT Tests).

**Other sites checked (not changed, outside the dispatch):** no production
file except `transaction/with-state-guard.ts` names
`StateLockCompromisedError`. `fetch` covers a lost lock through `rowRead`.
Three more lock sites that this phase added map only `StateLockHeldError`:

- `orchestrators/plugin/update-preflight.ts:508-512`. The `probeUnpinned`
  mirror step (`:333`) and the GLK-04 tag copy (`:479`) run in
  `withExistingScopeLock` under the preflight's `try`. The catch rethrows
  only `StateLockHeldError`. So a lost lock there becomes a failed candidate
  with no reason and its cause, and it never reaches `typedUpdateFailReason`.
  So the review's claim that the ladder change covers every update lock site
  does not hold for the preflight. A one-line rethrow of
  `StateLockCompromisedError` there would close it.
- `orchestrators/plugin/info.ts:2260` and `:2630`. `info --fetch` runs its
  unpinned probe and row read in `withExistingScopeLock` (`runFetchLocked`).
  Both catches turn only `StateLockHeldError` into `lockHeldRow`. A lost lock
  falls to `foldFetchOrProbeError`, so it shows a fetch or probe reason.

A raw release failure (proper-lockfile's `ERELEASED`, not a compromise) still
reads `{unreadable manifest}` in `update`. `fetch` maps it through `rowRead`.
The dispatch scoped the fix to the compromise.

#### IN-03: Two comments no longer match the code

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`
**Commit:** d7301f35
**Status:** fixed

**Applied fix:** the `refreshFramed` comment now says that the direct update
syncs a marketplace only after the previous target's run has released every
lock it took. The `failedRow` comment limits "did not warm the cache" to a
throw before the row read. It also says that with `rowRead` true the fetch
warmed the cache, the lock failed, and the row still stamps `error`. Both
comments cite no phase or plan.

### Skipped Issues

#### IN-02: The sync reads the marketplace record before it takes the lock

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:228-261`
**Reason:** skipped by the dispatch scope. The window lasts milliseconds:
another process must remove and re-add the same marketplace name with a
different source between the record read and the lock. The record is read
before the lock, the same class as the unlocked-record items in
07-CONTEXT's Deferred list (the unlocked `sources/<name>` deletes and the
seed copy after the lock).
**Original issue:** `loadState` and the record lookup run before
`refreshFramed` takes the lock, so the locked refresh can act on a record
that it did not read under the lock.

#### IN-04: A body failure plus a release failure loses the git classification

**File:** `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:198-205`
**Reason:** skipped by the dispatch scope. It needs a work failure and a
release failure at the same time. The wrapper that drops the classification
is in `transaction/with-state-guard.ts`, which is not one of this phase's
files.
**Original issue:** `releaseStateLock` wraps the body error in a plain
`Error` with the release suffix. `classifyGitFailure` does not walk `cause`,
so a host 404/503 during the update sync reads `{unreadable manifest}`, and
the same failure in `fetch` reads `{source missing}`.

### Verification

All of these ran in the main checkout of the `features/plugin-lifecycle-p7`
worktree
(`/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-p7-gitlock-745e94`).
No nested review-fix worktree was made, for the reason that iteration 1
gives.

- Focused unit tests (`node --test --test-name-pattern` on the two new
  cases): pass. Against the unfixed `update-flow.ts`: both fail.
- Direct coverage (`node scripts/test-coverage-direct.mjs`) for
  `update-flow.ts`: 100%, exit 0. It runs the whole paired test file.
- The commit hook (`npm run check:commit`) passed on both fix commits.
- `npm run typecheck`: exit 0.
- `npm run fallow`: exit 0.
- The full `npm run check` was not run; the orchestrator runs it.

______________________________________________________________________

## Iteration 3

**Fixed at:** 2026-10-28T14:57:12-04:00
**Source review:** .planning/phases/07-git-errors-and-lock-discipline/07-REVIEW.md
**Iteration:** 3

**Summary:**

- Findings in scope: 1
- Fixed: 1
- Skipped: 0

### Fixed Issues

#### CR-01: A dependency sweep can delete a clone that a concurrent fetch just completed

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts`,
`test/orchestrators/plugin/clone-gc.test.ts`,
`test/orchestrators/plugin/dependency-bindings.test.ts`,
`test/orchestrators/plugin/dependency-move.test.ts`,
`test/orchestrators/plugin/dependency-plan.test.ts`,
`test/orchestrators/plugin/dependency-settle.test.ts`

**Commit:** d4436bd3
**Status:** fixed: requires human verification

**Applied fix:** Dependency move judgment now derives the exact cache keys of
the recorded clone and the prepared candidate from their contained plugin
roots. The accepted plan carries those keys on its move. Both install and
update settlement create the cleanup only after that plan is accepted. The
cleanup takes a fresh scope lock, derives the current live-key set, and deletes
only owned candidates that are still unreferenced. It never treats every name
absent from an earlier directory snapshot as owned. The old unreferenced-list
API and its misleading two-lock protocol were removed.

This keeps the lock non-reentrant: planning and materialization still acquire
their own locks, and cleanup acquires one fresh lock only after the steps end.
Containment is preserved because each candidate delete still routes through
`locations.pluginCloneDir(key)`. Cleanup failures are still traced and
swallowed for a later retry.

**Ownership proof:** A path contributes a candidate key only when
`path.relative(pluginClonesDir, root)` stays inside that cache. The move owns
the old record root and the prepared candidate root. The planner copies those
exact keys onto the corresponding move. At cleanup time, the candidate-only
collector also checks persisted state, so a key shared by any surviving record
stays. A distinct mirror created by a concurrent fetch is absent from the
candidate set and cannot become a delete target.

**RED/GREEN evidence:** The new deterministic unit case obtains the sweep,
makes the replaced clone unreferenced, creates a distinct fetched mirror under
the real `withExistingScopeLock`, then runs cleanup. Before the fix, the case
failed because the snapshot-based collector deleted the fetched mirror. After
the fix, the replaced clone is removed and the fetched mirror remains.

### Verification

All checks ran in the isolated owner worktree
`/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710`.
`workflow.use_worktrees=false`, so the fixer created no nested worktree.

- Focused owner tests: all 6 changed source/test modules passed.
- Direct coverage: all 6 changed source/test pairs passed at 100% line,
  function, and branch coverage.
- TypeScript: `npx tsc --noEmit --incremental false` passed. The normal npm
  script's first isolated-worktree attempt could not write its tsbuildinfo to
  the read-only dependency tree; it reported no source diagnostic.
- Fallow audit: PASS with no dead code, complexity, duplication, or diff-risk
  finding.
- Pre-commit fixers: passed.
- Normal commit hooks, including `npm run check:commit`: passed.
- Cucumber: not added. The Phase 7 context accepts this deterministic
  concurrency boundary as unit-only, and no reliable public interleaving
  fixture was introduced.
- Full combined `npm run check`: not run here; the phase orchestrator must run
  it on the combined tree before verification.

______________________________________________________________________

______________________________________________________________________

## Iteration 4

**Fixed at:** 2026-10-28T15:55:51-04:00
**Source review:** .planning/phases/07-git-errors-and-lock-discipline/07-REVIEW.md
**Iteration:** 4

**Summary:**

- Findings in scope: 1
- Fixed: 1
- Skipped: 0

### Fixed Issues

#### CR-01: Planning can leak clones that never become final move keys

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`,
and their 10 paired test modules under `test/orchestrators/plugin/`.

**Commit:** 967fdb8a
**Status:** fixed: requires human verification

**Applied fix:** Each dependency-planning attempt now creates one mutable set
of exact clone-cache keys before any root preview, member preview, or move
judgment. Clone materializers report a key only when their atomic promotion
returns `renamed`. A warm-cache hit and a promotion lost to another process do
not report ownership. Install and update thread this set through root, fresh
member, and move preflight materialization. A successful move judgment records
its keys before later exclusion and name checks can rule the candidate out.

Install and update also create the candidate-only sweep before planning and run
it from an outer `finally`. Cleanup therefore runs after success, refusal, or a
throw. Planning still takes its own short materialization locks. The sweep then
takes one fresh lock, re-reads live keys, and deletes only an attempt-owned key
that is still unreferenced. Deletes continue through `pluginCloneDir`, and a
cleanup failure is logged and swallowed for a later retry.

**Ownership proof:** The creation callback sits after the atomic rename in all
four cache writers: pinned clone, commit copy, unpinned mirror, and marketplace
tag clone. This makes ownership a positive event from the process that created
the cache entry; it is never inferred from a before-and-after directory diff.
The one attempt set collects root previews, fresh-member previews, and every
materializable move candidate, including candidates that resolver backtracking
later rejects. At cleanup time the existing locked collector still preserves
landed, shared, and otherwise live keys. A distinct mirror made by a concurrent
real scope-lock holder was never reported to this attempt and cannot be a
delete target.

**RED/GREEN evidence:**

- The refused-plan case seeds a warm key, lets a real git root preview create
  its mirror and commit keys, and creates a distinct mirror under a concurrent
  real scope-lock holder. Before the fix, the two preview keys leaked. After the
  fix, only those two keys are removed; the warm and concurrent keys remain.
- The backtracking case publishes two real tagged candidates. Resolution first
  materializes version 2.1, rejects it after a transitive range conflict, and
  lands version 2.0. Before the fix, both exact tag-clone keys remained. After
  the fix, the rejected 2.1 key is removed and the landed 2.0 key remains.
- Existing candidate-only negative controls still prove that shared and live
  keys remain.

### Verification

All checks ran in the isolated owner worktree
`/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710`.
`workflow.use_worktrees=false`, so the fixer created no nested worktree.

- Focused owner tests: 10 test modules passed, 10/10, including both new RED
  cases after the fix.
- Direct coverage: all 11 changed source/test pairs passed at 100% line,
  function, and branch coverage.
- TypeScript: `npm run typecheck -- --incremental false` passed, exit 0.
- Fallow audit: PASS, exit 0, with no dead-code, complexity, duplication, or
  diff-risk finding.
- Required pre-commit fixers: passed. The first normal commit attempt found
  three lint-only formatting/import-order errors. Those exact errors were
  corrected, and the second normal commit passed every hook, including
  `npm run check:commit` and gitlint.
- A separate full-tree no-cache ESLint invocation produced no diagnostic but
  did not terminate within its 300-second bound in this worktree. The normal
  commit hook's lint gate subsequently completed and passed.
- Cucumber: not added. This changes deterministic cache ownership during an
  internal planning interleaving and adds no new user-visible command behavior.
- Full combined `npm run check`: not run here; the phase orchestrator must run
  it on the combined tree before the final re-review and verifier.

______________________________________________________________________

_Fixed: 2026-10-28_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 4_

______________________________________________________________________

## Iteration 5

**Fixed at:** 2026-10-28T16:27:02-04:00
**Source review:** .planning/phases/07-git-errors-and-lock-discipline/07-REVIEW.md
**Iteration:** 5

**Summary:**

- Findings in scope: 1
- Fixed: 1
- Skipped: 0

### Fixed Issues

#### CR-01: Move judgment reclaims warm and race-lost candidate clones

**Files modified:**
`extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts`,
`test/orchestrators/plugin/dependency-move.test.ts`

**Commit:** 64fb10b1
**Status:** fixed: requires human verification

**Applied fix:** Move judgment now derives cleanup ownership only from the
current record's old clone root. A prepared candidate enters the operation's
candidate set only when a clone-cache writer reports a successful `renamed`
promotion through `onCloneCreated`. Warm hits and exact-key promotions lost to
another process no longer become cleanup targets. The existing live-state
recheck still preserves an old key while its record remains and removes it
after a successful replacement makes it unreferenced.

The dependency-move context also forwards the existing clone-cache and
constraint-gate ports. The regression cases use those production ports to run
the real pinned materializer and isolate the ownership rule without network
access.

**RED/GREEN evidence:**

- The warm case pre-creates the exact pinned candidate, passes the creation
  callback through the real materializer, rules the prepared version out, and
  runs the real locked candidate collector. Before the fix, the collector
  removed the warm key and the case failed with `ENOENT`.
- The race case creates the winner's exact key between checkout and atomic
  promotion. The real materializer returns the race winner without calling the
  callback. After the same ruled-out verdict and locked sweep, the winner must
  remain. Before the fix, the case failed with `ENOENT`.
- After the fix, both focused cases pass. The existing old-key ownership case
  still proves that a recorded clone remains eligible for cleanup.

### Verification

All checks ran in the isolated owner worktree
`/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710`.
`workflow.use_worktrees=false`, so the fixer created no nested worktree.

- Focused RED: 0/2 passed. Both cases failed because the collector deleted the
  unowned candidate.
- Focused GREEN: 2/2 passed.
- Complete owner module: 29/29 tests passed.
- Direct coverage: the changed source/test pair passed at 100% line, function,
  and branch coverage.
- TypeScript: `npx tsc --noEmit --incremental false` passed, exit 0.
- Fallow audit: PASS, exit 0, with no dead-code, complexity, duplication, or
  diff-risk finding.
- Required pre-commit fixers passed. The first normal commit attempt found one
  import-order error. After that import was reordered, the second normal commit
  passed every hook, including `npm run check:commit` and gitlint.
- Cucumber: not added. This is an internal clone-ownership interleaving with a
  deterministic unit seam and no new user-visible command behavior.
- Full combined `npm run check`: not run here. The phase orchestrator must run
  it on the combined tree before the final re-review and verifier.

______________________________________________________________________

_Fixed: 2026-10-28_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 5_
