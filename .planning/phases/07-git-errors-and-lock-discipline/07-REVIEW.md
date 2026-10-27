---
phase: 07-git-errors-and-lock-discipline
reviewed: 2026-10-27T08:47:22Z
depth: standard
iteration: 2
diff_base: 4cd057ce
files_reviewed: 4
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - features/plugin/url-marketplace-update.feature
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
status: issues_found
---

# Phase 7: Code Review Report (iteration 2)

**Reviewed:** 2026-10-27T08:47:22Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found (Info only)

The iteration-1 report is kept at `07-REVIEW.iter1.md`.

## Summary

This pass covers only `git diff 4cd057ce..HEAD` in the four listed files: the
WR-01 scope lock around the plugin-update marketplace refresh (96103d64), the
IN-01 stamp fallback (e8ce1713), and the IN-04 (a) fetch lock-lost reason
(11b2c5fd).

**WR-01 lock nesting: no self-deadlock.** I traced every caller.
`makeSyncCloneOnce` is built and called only in `updatePluginsWith`
(`update-flow.ts:388,408`). `updatePluginsWith` is reached only through
`createPluginUpdateOperations().updatePlugins` (`update-flow.ts:1395`). That is
wired through `index.ts:220` -> `edge/register.ts:126` ->
`edge/handlers/plugin/update.ts:57`, and no lock is held on that path. The
autoupdate cascade (`beginPluginUpdateRun`), apply's converge
(`convergePlugin`), reinstall, bootstrap, and import never reach
`syncCloneOnce`. Inside the loop, each sync runs after the previous target's
`runPluginUpdate` has resolved. Every lock that run takes is awaited before it
returns: the guards, `cleanupClones: collectPluginClonesLocked`
(`update-swap.ts:1526`, `update-preflight.ts:835`), and `settleDependencies`.
So no lock of our own is still held, and no detached GC is still running, when
the next marketplace's sync takes its lock. The lock is on the target's scope,
which is the scope `loadState` just read the marketplace record from. So
`extensionRoot` exists, and `withExistingScopeLock`'s no-mkdir rule cannot
reject. A held lock reaches `typedUpdateFailReason` unframed, because
`classifyGitFailure` returns no frame for `StateLockHeldError`. It reads
`lock held`, as the unit case and the new cucumber scenario both pin. The
Device Flow can now run under the lock. That matches `marketplace update`, and
proper-lockfile's 2 s `update` timer keeps the lock fresh while the flow waits.

**IN-01 stamp fallback: correct.** `Math.max(now, NaN)` is NaN, and
`prior + 1 > 8.64e15` gives an invalid Date. Both fall back to `now`, which
differs from the replaced stamp, so ST-9 still refuses a rival. A valid
far-future stamp stays monotonic, as before.

**IN-04 (a) fetch: correct for the code as written.** `rowRead` is set as the
last statement of `fetchAndRead`. On the locked arm, a throw after that point
can only come from `releaseStateLock`. The pinned arm takes no lock and returns
right after the read.

**Cucumber scenario: sound.** `the git host receives no request` checks only
the last command's requests and connections (`git-host.steps.ts:148`). So the
url clone that the earlier install makes cannot break the check. The lock
holder is a separate process, which makes the refusal deterministic.

I found no Critical or Warning issues. The four Info items are below. Two are
edges of the new lock site that the fix left inconsistent with the fetch
change. Two are comment and record-read nits.

## Narrative Findings (AI reviewer)

## Info

### IN-01: A lost lock after a successful marketplace sync reads `{unreadable manifest}` in `update`, while `fetch` now reads `{lock held}` for the same event

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:185,856-860,898-901`
**Issue:** The sync now runs in `withExistingScopeLock`. Suppose the refresh
succeeds but the lock was compromised (a stale takeover) or could not be
released. Then the body's success becomes a `StateLockCompromisedError` or a
raw release error. `typedUpdateFailReason` names only `StateLockHeldError`, so
the error falls to `untypedUpdateFailReason`. `classifyGitFailure` returns
`undefined` and the errno is `undefined`, so the row reads
`official (failed) {unreadable manifest}`. That blames the manifest for a lock
event. Iteration 2 fixed exactly this class for `fetch` (`{lock held}`), so
the two commands now disagree on the same event. Every other lock site in
`update` has had this mapping already, but this fix adds a new site that
reaches it.
**Fix:** Map the compromise in the shared ladder. This one change covers the
sync and every other update lock site:
```ts
if (primary instanceof StateLockHeldError || primary instanceof StateLockCompromisedError) {
  return "lock held";
}
```

### IN-02: The sync reads the marketplace record before it takes the lock

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:228-261`
**Issue:** `loadState`, the `ownValue(state.marketplaces, mpName)` lookup, and
`source` are all read before `refreshFramed` takes the lock. The locked refresh
then acts on a record that it did not read under the lock. Suppose another
process runs `marketplace remove` and then `marketplace add` for the same name
with a different source, between that read and the lock. The refresh then
fetches the old URL into the new `sources/<name>/.git`. `marketplace update`
reads its record inside `withLockedStateTransaction`, so the two writers of
that `.git` are not at parity. The window is milliseconds wide, so this is
Info.
**Fix:** Take the lock around the read and the refresh together, and keep the
`MarketplaceNotFoundError` and path-noop arms inside it. The path arm must
still do no lock work (NFR-5 / WR-02), so check `source.kind` after a
lock-free read, then re-read the record under the lock before the refresh:
```ts
await withExistingScopeLock(locations, async () => {
  const fresh = ownValue((await loadState(locations.extensionRoot)).marketplaces, mpName);
  if (fresh === undefined) throw new MarketplaceNotFoundError(mpName, [scope]);
  // refresh from fresh.source
});
```

### IN-03: Two comments no longer match the code

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:175-176`; `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts:558-564`
**Issue:**
- `refreshFramed` says "The direct update syncs each marketplace before it
  runs any target". The loop interleaves: it syncs marketplace B only after
  the targets of marketplace A have run (`update-flow.ts:405-450`). The
  no-nesting claim still holds, because each run is awaited and releases its
  locks first. But the stated reason is wrong, and the next editor may rely
  on it.
- The `failedRow` doc still says "a fetch that threw did not warm the cache".
  With `rowRead` true, the fetch did warm the cache, and the row fails only
  because the lock was lost.

**Fix:** Change the first comment to say that the sync for a marketplace
runs after the previous target's run has released every lock it took. Limit
the second comment to the `rowRead === false` case.

### IN-04: A body failure plus a release failure loses the git classification at both new lock sites

**File:** `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:198-205` (consumed at `update-flow.ts:187` and `fetch.ts:599`)
**Issue:** When the body throws and the release also fails,
`releaseStateLock` wraps the body error in a plain
`new Error("... (lock release also failed: ...)", { cause })`.
`classifyGitFailure` reads `code` and `data.statusCode` only on the outer
error and never walks `cause`. So the error loses its classification at both
sites:
- A host 404/503 during the update sync loses its `{status} on {url}` frame
  and reads `{unreadable manifest}`.
- The same failure in `fetch` reads `{source missing}`, because `rowRead` is
  false there.

`refreshFramed` now sits outside the lock wrapper, so this wrap happens before
the framing. Both failures must happen at once, so the risk is low.
**Fix:** Do the framing and classification inside the lock body, by moving the
`try/catch` of `refreshFramed` into the callback. Or have the two classifiers
unwrap an error whose message carries the release suffix. A typed
`LockReleaseAlsoFailedError { primary }` would let both sites narrow on
`instanceof`, as `CleanupContextError` already does.

## Carried, accepted (iteration 1, skipped with a recorded reason)

- **WR-02** (autoupdate cascade rows print raw absolute paths): deferred. The
  direct row prints the same cause, and D-PL7-12 keeps the cascade at parity.
  It is recorded in 07-CONTEXT's Deferred list (a66a932f) and in
  `deferred-items.md` ("From 07-06").
- **IN-02** (the D-PL7-08 monotonic stamp is local to `update-swap.ts`): out
  of dispatch scope. The fix touches `updatedAt` writers in files that other
  phases own.
- **IN-03** (rule constants are duplicated, not exported with the classifier):
  out of dispatch scope. It is a refactor across several files, with no
  change in behavior.
- **IN-04 (b)** (the `cascadeAutoupdates` catch uses the marketplace-refresh
  rule): unreachable in production, because `runCascadeTarget` catches every
  throw except an invalid GitHub base URL.

---

_Reviewed: 2026-10-27T08:47:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
