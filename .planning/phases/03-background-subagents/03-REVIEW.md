---
phase: 03-background-subagents
reviewed: 2026-11-13T23:51:26Z
depth: standard
iteration: 1
reviewed_head: 09919bba
files_reviewed: 48
files_reviewed_list:
  - docs/hooks-compatibility.md
  - docs/mcp-compatibility.md
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts
  - extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts
  - extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts
  - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
  - extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts
  - features/agent/frontmatter.feature
  - features/agent/invocation.feature
  - features/lib/agent-files.ts
  - features/lib/real-subagent-child.ts
  - features/lib/subagent-hook-session.ts
  - features/mcp-server/agent-grants.feature
  - features/mcp-server/verdict-markers.feature
  - features/plugin/subagent-child.feature
  - features/step_definitions/agent/listing.steps.ts
  - features/step_definitions/mcp-server/agent-grants.steps.ts
  - features/step_definitions/plugin/subagent-hooks.steps.ts
  - features/support/pi-process.ts
  - test/bridges/agents/convert.test.ts
  - test/bridges/agents/grant-forms.test.ts
  - test/bridges/agents/grant-rewrite.test.ts
  - test/bridges/agents/legacy-grant-form.test.ts
  - test/bridges/agents/mcp-async-warning.test.ts
  - test/bridges/agents/stage.test.ts
  - test/bridges/hooks/async-rewake/registry.test.ts
  - test/bridges/hooks/dispatch-exec.test.ts
  - test/bridges/hooks/event-router.test.ts
  - test/bridges/hooks/payloads/post-tool-use-failure.test.ts
  - test/bridges/hooks/payloads/post-tool-use.test.ts
  - test/bridges/hooks/payloads/pre-tool-use.test.ts
  - test/bridges/hooks/runtime.test.ts
  - test/bridges/hooks/translation-context.test.ts
  - test/integration/hooks-dispatch-end-to-end.test.ts
  - test/integration/pi-subagents-child-identity.test.ts
  - test/integration/subagent-hook-ownership.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
  necessity: 1
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-11-13T23:51:26Z
**Depth:** standard
**Iteration:** 1
**Files Reviewed:** 48
**Status:** issues_found

## Summary

This review covers the 48 files that the phase changed between `cab4a540` and `09919bba`. I read the production diffs in full, with their callers: the hooks runtime, the event router, the async-rewake registry, dispatch-exec, the translation context, the three tool payload translators, and the agents bridge warning and launch-mode changes. I checked both docs against the code, and I checked that every scenario title the docs cite exists. I spot-checked the new test helpers and steps for reliability. I ran no `npm run check` and no test suite.

The child event policy, the identity capture and its session binding, the launch-mode change (`async` only for `true`), and the two-generation warning recognition match D-PG3-01..07 and the docs. The `<active_agent name="..."/>` format matches the installed companion's `child-launch.js:215` and its `escapeXmlAttr`.

Key concern: the shutdown drain added for child sessions also runs in the main session. On a quit, it SIGKILLs every async hook that is still running. This includes an `async` SessionEnd hook that the same callback has just started. That is a main-session regression, and the docs do not mention it. The child-journal cleanup at shutdown never removes the stopped rows. The known test-fixture advisory from 03-SECURITY.md is confirmed.

The necessity rubric was read. One necessity finding is recorded.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Main-session shutdown kills running async hooks, including a just-started async SessionEnd hook

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:929-956` (with `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:650-668`, `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts:464-477`)

**Issue:** `sessionShutdownCallback` now ends with an unconditional `finally { await shutdownInMemoryChildren(runtime); }`. `shutdownInMemoryChildren` calls `runtime.shutdownChildren()`, which sends SIGKILL to the process group of every registered async child. Nothing limits this to `isSubagentChild(process.env)`, so a main session runs it on every shutdown reason: quit (`prompt_input_exit`), RPC stop (`other`), clear, and resume.

Two consequences in the main session:

1. An `async: true` or `asyncRewake: true` SessionEnd hook is killed right after it starts. `sessionEndHandler` awaits `dispatchHookExec`, which awaits `spawnAndRegister`. That function calls `runtime.registerChild(asyncEntry)` before it returns (`registry.ts:355`). The `finally` block then kills the child. Before this phase, the detached child kept running after a quit. Today the hook gets almost no run time. `docs/hooks-compatibility.md:277` still says that "async hooks keep 600 s everywhere", SessionEnd included.
2. Any other async hook still running at quit (a slow PostToolUse `async` hook, for example) is now killed at quit. `docs/hooks-compatibility.md:428-429` says only `/reload`, a new session, and the next start after a crash stop these processes, and that "Claude Code leaves them running". Those rows were not updated. The project rules allow a divergence from upstream only with a recorded decision or a Pi capability gap. D-PG3-05 and the research (`03-RESEARCH.md:270`) asked for unconditional cleanup only for the child runtime ("independently of suppressed SessionEnd"). They did not ask for it in the main session. The new docs section says only "When a child stops or reloads, it stops its own hook processes."

No test covers this. The router test "child session shutdown cleans up on reload, quit, and rejected mode" sets the child marker, and `features/hook/async.feature` has no SessionEnd or quit case.

**Fix:** Run the drain at shutdown only in a child session. In the main session, keep the earlier behavior: the next load's reap (D-BG-207) stops what an earlier load left.

```ts
} finally {
  if (isSubagentChild(process.env)) {
    await shutdownInMemoryChildren(runtime);
  }
}
```

The registration-time `await shutdownInMemoryChildren(runtime)` can stay. Add a main-session regression: a unit case where an async SessionEnd hook survives a `quit` shutdown, and a cucumber scenario if the behavior is visible. If killing at quit is in fact wanted in the main session, record a decision and update `docs/hooks-compatibility.md:277` and `:428-429`.

## Warnings

### WR-01: Child shutdown never removes the rows it stopped, and its journal pass is effectively dead

**File:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:650-668` (with `:875-878`, `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts:464-477`)

**Issue:** After `runtime.shutdownChildren()` kills the children, `shutdownInMemoryChildren` reads each owner's journal and rewrites it only when `journal?.entries.length === 0`. `writeChildJournal` never writes a journal with no rows: for an empty list it removes the file (`:875-878`). So the reader gets either `undefined` (ENOENT) or a journal that still lists the rows that were just killed. The branch therefore never runs for a file this code wrote. The rows for the stopped hooks stay on disk.

Their only removal path is `finalizeChild` → `removeCapturedChildRow`, which runs on the killed child's `close` event. A pi-subagents runner whose session has ended often exits before those events arrive, so the journal outlives the runner. A main-session load later removes it, after the owner is dead and the row PIDs return ESRCH. `shutdownChildren` now returns the `stopped` list for this purpose, but `shutdownInMemoryChildren` drops it (`registry.ts:651`). No production caller reads it. The plan (`03-01-PLAN.md:125`: "signal this runtime's in-memory groups, drain queued writes, remove only its confirmed-empty journals") expected the journals to be empty at this point. They are not.

**Fix:** Use the stopped entries to rewrite each owner's journal under its operation queue before the owners are forgotten:

```ts
const stopped = runtime.shutdownChildren();
const stoppedIds = new Set(stopped.map((entry) => entry.dispatchId));
// per owner, inside runtime.runPidTableOperation(filePath, ...):
const journal = await readChildJournal(filePath, owner.loc);
if (journal !== undefined) {
  await writeChildJournal(owner, journal.entries.filter((row) => !stoppedIds.has(row.dispatchId)));
}
```

Add a unit case: after shutdown, with no `close` event delivered, the journal file is gone.

### WR-02: Concurrent-runner timeout path can SIGKILL the test runner's own process group (03-SECURITY advisory, confirmed)

**File:** `features/lib/real-subagent-child.ts:956`

**Issue:** `kill(-(runner.pid ?? 0))` calls `process.kill(-0, "SIGKILL")` when `runner.pid` is undefined, and that signals the caller's own process group. This path is reachable. When the spawn fails (EAGAIN, ENOMEM), Node emits `error`. `events.once(runner, "exit")` rejects on `error`, so `within(...)` throws, the catch runs, and the cucumber runner kills its own group, along with any parent shell in that group. Then `await exit` rethrows the spawn error, so the clearer "did not end" error is never thrown.

**Fix:**

```ts
} catch (error: unknown) {
  if (runner.pid !== undefined) {
    kill(-runner.pid);
    await exit.catch(() => undefined);
  }
  throw new Error(`the concurrent runner did not end: ${stderr}`, { cause: error });
}
```

## Info

### IN-01: Child-journal recovery docs say "every other case keeps the row", but exited hook processes are dropped

**File:** `docs/hooks-compatibility.md:73` (code: `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:1010-1017`)

**Issue:** The docs name only two outcomes: stop a process that has the marker, or keep the row. `recoverChildRow` has a third. When the recorded process is gone (`kill(pid, 0)` throws ESRCH) and the owner is dead, it returns `true`, and the row is removed without a signal. This happens on every platform, before the Linux check.

**Fix:** Add a sentence: "A row whose hook process has already exited is removed."

### IN-02: A main-session PID-table write failure now kills the hook and logs a "child journal" message

**File:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:418-423`

**Issue:** The new `try/catch` around `persistPidTableForLoc` applies to main sessions too, where `persistenceOwner` is undefined and the legacy PID table is written. Before this phase, a failed write left the hook running and logged `spawnAndRegister threw`. Now the hook is SIGKILLed, and the debug line says `child journal persistence failed`, which is wrong for a main session. Failing closed may be the right choice, but it is an undocumented main-session change, and the log text points the reader at the wrong file.

**Fix:** Choose the text by owner, for example `persistenceOwner === undefined ? "pid table" : "child journal"`. State the kill-on-unrecorded rule in the async section of the docs, or limit it to children.

### IN-03: Already-defended-elsewhere — repeated child-identity session checks, applied inconsistently across translators

**File:** `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts:67`, `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts:64`, `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts:74`
**Category:** necessity

**Issue:** `runtime.childIdentityFor(sessionId)` already returns an identity only for the session it was captured in (`runtime.ts:398-404`), and `childId` is always that session's id (`runtime.ts:392-395`). `buildTranslationContext`, the only production producer of `TranslationContext.childIdentity`, checks the session again and then sets `childIdentity.sessionId` to `ctx.sessionId` itself (`translation-context.ts:74-75`). So the third check, `ctx.childIdentity?.sessionId === ctx.sessionId`, in the two result translators cannot fail in production. `translatePreToolUse` (`pre-tool-use.ts:44`) does not repeat it, so the three translators read one invariant in two ways. The identity-to-context block is also copied in `dispatch-exec.ts:206-212` and `registry.ts:254-260`. This rests on judgment, because `TranslationContext` is an exported interface that tests build directly.

**Fix:** Keep the session binding in one place, the runtime or `buildTranslationContext`. Have all three translators use the same `ctx.childIdentity === undefined` test, and move the duplicated block into one helper, for example `translationContextFor(runtime, ctx)`.

---

_Reviewed: 2026-11-13T23:51:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
