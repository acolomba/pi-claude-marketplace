---
phase: 03-background-subagents
reviewed: 2026-11-14T00:37:04Z
depth: standard
iteration: 2
reviewed_head: b0246dfa
files_reviewed: 6
files_reviewed_list:
  - docs/hooks-compatibility.md
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - features/lib/real-subagent-child.ts
  - test/bridges/hooks/async-rewake/registry.test.ts
  - test/bridges/hooks/event-router.test.ts
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
  necessity: 0
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-11-14T00:37:04Z
**Depth:** standard
**Iteration:** 2
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This re-review covers the fix commits `6804ebfe..b0246dfa` (`0b49ad9e`, `98eee7da`, `24ce8a33`, `576c6c24`, `aa2a26eb`, `489e87e6`). I read each diff and the current text of the changed functions and their callers: `sessionShutdownCallback`, `shutdownInMemoryChildren`, `persistSpawnedChild`, `finalizeChild`, `removeCapturedChildRow`, `persistPidTableForLoc`, `writeChildJournal`, `readChildJournal`, `reapOrphans`, `reapChildJournal`/`recoverChildRow`, and the runtime's `shutdownChildren`/`registerChild`/`runPidTableOperation`. I ran no `npm run check` and no tests.

All five fixes in scope are correct and complete. Each regression test fails without its fix (traced below). IN-03 is a recorded skip and is not raised again.

One new finding comes from the main-versus-child shutdown seam. The CR-01 fix correctly restores the base behavior at `cab4a540`. In doing so, it brings back a race that exists on `main`: after a main-session `/reload`, the old runtime's late child exits rewrite the PID table and erase the rows of the new load. The iteration-1 drain had hidden this race as a side effect.

The necessity rubric was not re-applied: no new necessity findings in the fix diff.

## Iteration 1 resolution

| Finding | Verdict | Fix commit | Verification |
| --- | --- | --- | --- |
| CR-01 main-session shutdown kills async hooks | resolved | `0b49ad9e` | `event-router.ts:953-957` now drains only when `isSubagentChild(process.env)`. This is the same predicate that `dispatchesInCurrentSession` uses, and it matches `cab4a540`, which had no drain at shutdown. The registration-time drain (`:1124`) is unchanged. Test: without the guard, the main case's `finally` runs `shutdownChildren()`, so the three fake children get `SIGKILL` and the registry empties. Both `signals` and `pidTableEntries` assertions then fail. The SessionEnd hooks are registered by the executor before the `finally`, so the async SessionEnd case is really exercised. The child case guards the other branch. |
| WR-01 child journal keeps stopped rows | resolved | `98eee7da` | `shutdownInMemoryChildren` filters the stopped `dispatchId`s under the owner's queue. `writeChildJournal` removes the file when no rows remain. The snapshot is a subset of rows that were already validated, so the shape and capacity checks cannot newly throw. Test: the fake child does not emit `close` on kill. At the iteration-1 code, the journal held two (or three) rows, so the `length === 0` branch was skipped and the file kept every row. The `ENOENT` and `["foreign-dispatch"]` assertions both fail there. The three adjusted retired-child cases restore the journal bytes after shutdown, so they still reach the late-exit removal path. |
| WR-02 runner kills own process group | resolved | `24ce8a33` | `real-subagent-child.ts:956-962` signals only when `runner.pid !== undefined`. It swallows the exit rejection and always throws `the concurrent runner did not end` with the cause. The rejected `exit` promise already had a handler attached through `within`, so no unhandled rejection is left behind. |
| IN-01 recovery docs omit exited rows | resolved | `576c6c24` | `docs/hooks-compatibility.md:73` now matches `recoverChildRow` (`registry.ts:1043-1047`): ESRCH with a dead owner removes the row on every platform, before the Linux check, and sends no signal. |
| IN-02 main-session PID-table failure kills hook | resolved | `489e87e6` | `persistSpawnedChild` (`registry.ts:432-453`) logs `pid table persistence failed (<plugin>/<event>)` and returns for a main session. A child session still calls `stopUnrecordedChild`. This matches `cab4a540` apart from the log text, which is now accurate. Test: at the iteration-1 code, the catch called `stopUnrecordedChild`, so `child.signals` was `['SIGKILL']` and the registry was empty. Both assertions fail there. |
| IN-03 repeated child-identity checks | skipped (recorded) | — | Not re-raised. |
| `aa2a26eb` test cleanup (outside scope) | sound | `aa2a26eb` | The test's `closed = once(child, "close")` listener is attached in `spawnImpl`, before the registry's own `close` listener. By the time `await closed` resumes, the registry's synchronous `finalizeChild` has already queued the terminal write through `runPidTableOperation`. The no-op operation on `pidTablePath(loc)` therefore waits for it. In the child role, the terminal write is an `rm` of the child journal, which creates no temporary file, so not draining that key cannot cause `ENOTEMPTY`. |

## Narrative Findings (AI reviewer)

## Warnings

### WR-03: After a main-session `/reload`, the old runtime's late hook exits overwrite the new load's PID table

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:953-957` (with `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:523-547`, `:726-744`, `:833-850`)

**Issue:** `index.ts:92` builds a new `HooksRuntime` for every load. Each runtime has its own `runPidTableOperation` queue, but all runtimes share one file, `pidTablePath(loc)`. Since `0b49ad9e`, a main-session shutdown with reason `reload` (and `new`/`resume`) no longer clears the old runtime's in-memory registry. This is correct for CR-01, and it matches `cab4a540`. The sequence below then runs:

1. The new load's `reapOrphans` runs on the new runtime's queue (`:726`). It SIGKILLs the old load's hooks on Linux, then writes back only the new runtime's rows or unlinks the table (`:737-742`).
2. Each old hook then reaches `close`. The old runtime's `finalizeChild` still finds its entry (`takeChild`, `:531`). It calls `persistPidTableForLoc(oldRuntime, loc)` (`:542`) before any generation check. That writes the old runtime's remaining snapshot (finally `[]`) to the shared table through `writePidTable` (`pid-table.ts:142-157`, a full overwrite) on the old queue. Nothing orders this write against the new runtime's writes.
3. A hook that the new load started before the old exits land loses its row. If Pi then crashes, the next load's reap has no record of that hook, so its process is orphaned. That breaks D-BG-207's recovery promise.

The window is short when SIGKILL closes the old pipes at once. It grows without bound when a grandchild outside the group holds the hook's stdout or stderr open, because `close` and the stream-gated finalize then wait on it. On non-Linux, the reap soft-skips every live PID (`:753`). The old hooks then run to their 600 s timeout, and each exit rewrites the table, so the window is minutes long.

The race already exists at `cab4a540`. It is not a regression against `main`. The iteration-1 unconditional drain hid it, because `shutdownChildren()` emptied the old map and later `close` events found no entry. The CR-01 fix brings it back, so this report records it now at the seam the fix touched.

**Fix:** In a main session, detach the old runtime's entries at shutdown without signalling them. The hooks keep running, as CR-01 requires, and a late exit no longer writes the shared table. For example, add a runtime method that removes the entries but leaves each timer ladder armed:

```ts
// runtime.ts
detachChildren(): void {
  children.clear();
}

// event-router.ts, sessionShutdownCallback
} finally {
  if (isSubagentChild(process.env)) {
    await shutdownInMemoryChildren(runtime);
  } else {
    runtime.detachChildren();
  }
}
```

With no entry and no `persistenceOwner`, `finalizeChild` returns at `:531-539` and writes nothing. The rows stay in the table that the old runtime last wrote, and the next load's reap handles them as it does after a crash. Add a router case: in a main session, register a fake child, shut down with `reload`, then emit its `close` with a recording `pidTableWriter`. Assert that the writer was not called and that the child was not signalled. If the intent is to keep the race as base behavior, record that and close this finding.

---

_Reviewed: 2026-11-14T00:37:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Disposition

WR-03 is deferred, not fixed in this phase: the race exists at the phase base `cab4a540`, and the CR-01 fix restores that base main-session behavior. It is tracked as BACKLOG ASYNCRELOADTABLE-01 with the suggested fix. IN-03 remains a recorded skip (refactor, no behavior change).
