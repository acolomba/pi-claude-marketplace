---
phase: 03-background-subagents
fixed_at: 2026-11-14T00:31:19Z
review_path: .planning/phases/03-background-subagents/03-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-11-14T00:31:19Z
**Source review:** `.planning/phases/03-background-subagents/03-REVIEW.md`
**Iteration:** 1

**Summary:** Six findings were in scope: CR-01, WR-01, WR-02, IN-01, IN-02 and IN-03. Five were fixed. IN-03 was skipped on purpose, because it is a refactor that changes no behavior. CR-01, WR-01 and IN-02 change decision logic. Each has a regression test that failed on the code before the fix and passes after it.

## Fixed Issues

### CR-01: Main-session shutdown kills running async hooks, including a just-started async SessionEnd hook

**Status:** fixed; verified by an automated regression that failed first
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`, `test/bridges/hooks/event-router.test.ts`
**Commit:** `0b49ad9e`
**Applied fix:** The shutdown callback now drains in-memory async hooks only when `isSubagentChild(process.env)` is true. This is the same check that `dispatchesInCurrentSession` uses. A main session leaves its async hooks running at quit, which matches cab4a540 and Claude Code. The next load's reap still stops what an earlier load left (D-BG-207). The registration-time drain is unchanged. Two router cases cover it. In a main session, a quit leaves a running async PostToolUse hook, an `async` SessionEnd hook and an `asyncRewake` SessionEnd hook unsignalled and registered. The SessionEnd hooks are registered by the dispatch, as `spawnAndRegister` does. In a child, a quit SIGKILLs the running hook. RED: the main case received three SIGKILLs (`/tmp/pg3-fix-cr01-red.log`). The docs already describe this behavior (`docs/hooks-compatibility.md`, async rows and "When a child stops or reloads"). No cucumber scenario was added: the fix restores behavior that is already on `main`, so nothing changes for a user.

### WR-01: Child shutdown never removes the rows it stopped, and its journal pass is effectively dead

**Status:** fixed; verified by an automated regression that failed first
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`, `test/bridges/hooks/async-rewake/registry.test.ts`
**Commit:** `98eee7da`
**Applied fix:** `shutdownInMemoryChildren` now uses the `stopped` list that `runtime.shutdownChildren()` returns. Under each owner's operation queue, it rewrites the owner's journal without the stopped rows. `writeChildJournal` deletes the file when no row is left. A row of a hook that this shutdown did not stop stays in the journal. Two new cases run with no `close` event. In the first, two stopped hooks leave no journal file. In the second, a row the runtime did not stop is the only row left. RED: the stopped rows stayed on disk (`/tmp/pg3-fix-wr01-red.log`). Three retired-child cases had relied on shutdown leaving the row behind. They now write the journal bytes back after shutdown, as when shutdown could not rewrite them, so they still cover the late-exit removal and its error handling (`a delayed exit after reload removes only its captured session row`, `contains a retired child journal cleanup error`). The case `a retired child's late exit tolerates an already removed journal` no longer deletes the journal by hand, because shutdown now removes it.

### WR-02: Concurrent-runner timeout path can SIGKILL the test runner's own process group

**Status:** fixed
**Files modified:** `features/lib/real-subagent-child.ts`
**Commit:** `24ce8a33`
**Applied fix:** The timeout path signals the runner's group and waits for its exit only when `runner.pid !== undefined`. It then always throws `the concurrent runner did not end`, with the original error as its cause. A failed exit wait no longer replaces that error.

### IN-01: Child-journal recovery docs say "every other case keeps the row", but exited hook processes are dropped

**Status:** fixed
**Files modified:** `docs/hooks-compatibility.md`
**Commit:** `576c6c24`
**Applied fix:** The recovery paragraph now says that the load removes the row of a hook process that has already exited, on every system, and sends no signal. The marker-checked stop on Linux and the kept-row cases are unchanged.

### IN-02: A main-session PID-table write failure now kills the hook and logs a "child journal" message

**Status:** fixed; verified by an automated regression that failed first
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`, `test/bridges/hooks/async-rewake/registry.test.ts`
**Commit:** `489e87e6`
**Applied fix:** At cab4a540, a failed main-session PID-table write left the hook running and logged `spawnAndRegister threw`. The kill-on-unrecorded rule comes from the plan, which applies it only to child journals ("failed initial journal write"). No decision covers a main session, so the kill was a regression. A new helper, `persistSpawnedChild`, restores the base behavior in a main session: the hook keeps running, and the debug line reads `async-rewake: pid table persistence failed (<plugin>/<event>): ...`. Its next table write records the hook again. A child still stops a hook that its journal could not record. The new main-session case failed first with `[ 'SIGKILL' ]` (`/tmp/pg3-fix-in02-red.log`). A second new case covers the child branch whose hook ended before its journal write failed. Before this fix, a main-session test covered that branch. The default `writePidTable` catches its own errors, so in production this main-session path is reachable only through a writer that rejects.

## Skipped Issues

### IN-03: Already-defended-elsewhere — repeated child-identity session checks, applied inconsistently across translators

**File:** `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts:67`
**Reason:** Skipped on purpose (the orchestrator set the scope). The finding is a refactor with no behavior change: the repeated check cannot fail in production, and the reviewer marks it as resting on judgment.
**Original issue:** `ctx.childIdentity?.sessionId === ctx.sessionId` in the two result translators repeats a binding that `runtime.childIdentityFor` and `buildTranslationContext` already enforce. `translatePreToolUse` does not repeat it, and the identity-to-context block is copied in `dispatch-exec.ts` and `registry.ts`.

## Outside-scope change

`aa2a26eb` (test only) fixes a cleanup race in the case `records main <lane> <event> stdin through a real background process`. The hook's exit queues a main-session PID-table write. That write's temporary file could land while the test removed its root, so the removal failed with `ENOTEMPTY`. The commit hook failed this way once. Under coverage, the file failed 3 times in about 20 runs before the fix and 0 times in 10 runs after it. Base 6804ebfe failed 0 times in 18 runs. The race is in the test's cleanup and exists at the base, but the test order changes and the added tests appear to have made it more frequent. The cleanup now drains the PID-table queue before it removes the root.

## Verification

All checks ran in the main checkout `/home/acolomba/src/pi-claude-marketplace-gaps` (branch `features/gaps`) on Node `v26.13.1`, not in an isolated worktree. The orchestrator's rules require the commit hook and the cucumber and integration suites, and they need `node_modules`. Every commit passed `npm run check:commit` in the pre-commit hook: typecheck, lint, fallow, format, pairing, feature dry-run, unpaired tests, and direct coverage for the staged pairs. The documentation commit passed its applicable hooks. Two hook runs failed before a commit was made. One failed on lint in the new WR-01 case, which was fixed. The other was the `ENOTEMPTY` race described above.

- Owner tests: `test/bridges/hooks/event-router.test.ts`, `test/bridges/hooks/async-rewake/registry.test.ts`, `test/bridges/hooks/runtime.test.ts` and `test/architecture/hooks-async-rewake.test.ts` ran 372 tests, 372 passed.
- Direct coverage at 100% for `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` and `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`.
- Integration: `test/integration/subagent-hook-ownership.test.ts` and `test/integration/pi-subagents-child-identity.test.ts` ran 8 tests, 8 passed, 0 skipped.
- Cucumber `features/plugin/subagent-child.feature`: adapter 19 scenarios and 259 steps passed; builtin 14 scenarios and 185 steps passed.
- Cucumber `features/hook/session-end.feature` and `features/hook/async.feature` (adapter): 37 scenarios and 501 steps passed.

The orchestrator will run the full combined-tree `npm run check` gate.

---

_Fixed: 2026-11-14T00:31:19Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
