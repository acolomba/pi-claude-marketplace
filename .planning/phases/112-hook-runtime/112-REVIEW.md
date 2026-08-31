---
phase: 112-hook-runtime
reviewed: 2026-08-31T13:44:34Z
depth: standard
files_reviewed: 40
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/bridges/hooks/stage.ts
  - tests/architecture/hooks-async-rewake.test.ts
  - tests/architecture/hooks-dispatch.test.ts
  - tests/architecture/hooks-if-field.test.ts
  - tests/architecture/hooks-translators.test.ts
  - tests/bridges/hooks/async-rewake/pid-table.test.ts
  - tests/bridges/hooks/async-rewake/registry.test.ts
  - tests/bridges/hooks/async-rewake/ring-buffer.test.ts
  - tests/bridges/hooks/dispatch-exec.test.ts
  - tests/bridges/hooks/dispatch.test.ts
  - tests/bridges/hooks/event-adapters.test.ts
  - tests/bridges/hooks/event-router.test.ts
  - tests/bridges/hooks/exec-result.test.ts
  - tests/bridges/hooks/exec-timer.test.ts
  - tests/bridges/hooks/hook-env.test.ts
  - tests/bridges/hooks/if-field/bash.test.ts
  - tests/bridges/hooks/if-field/glob.test.ts
  - tests/bridges/hooks/if-field/index.test.ts
  - tests/bridges/hooks/index.test.ts
  - tests/bridges/hooks/payloads/post-compact.test.ts
  - tests/bridges/hooks/payloads/post-tool-use-failure.test.ts
  - tests/bridges/hooks/payloads/post-tool-use.test.ts
  - tests/bridges/hooks/payloads/pre-compact.test.ts
  - tests/bridges/hooks/payloads/pre-tool-use.test.ts
  - tests/bridges/hooks/payloads/session-end.test.ts
  - tests/bridges/hooks/payloads/session-start.test.ts
  - tests/bridges/hooks/payloads/stop-failure.test.ts
  - tests/bridges/hooks/payloads/stop.test.ts
  - tests/bridges/hooks/payloads/user-prompt-submit.test.ts
  - tests/bridges/hooks/routing-state.test.ts
  - tests/bridges/hooks/settle.test.ts
  - tests/bridges/hooks/spawn-helpers.test.ts
  - tests/bridges/hooks/stage.test.ts
  - tests/bridges/hooks/timeout.test.ts
  - tests/bridges/hooks/translation-context.test.ts
  - tests/bridges/hooks/wire-protocol.test.ts
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 112: Code Review Report

**Reviewed:** 2026-08-31T13:44:34Z
**Depth:** standard
**Files Reviewed:** 40
**Status:** issues_found

## Summary

The review found two correctness defects in the async-rewake lifecycle and one reliability defect in its replacement tests. The production cleanups themselves have a clean live-call-site blast radius: CodeGraph found no remaining callers of `asyncRewakeEntries`, `awaitPidTablePersist`, `adaptObservationResult`, `settleCacheSnapshot`, or `loopProtectionState`. Lowercase AAA comments are consistent across the reviewed runtime cases, and the hook-barrel public/internal inventories are alphabetized while event and routing assertions retain their contractual runtime order.

The async stream defect was reproduced through the public registry with a real Node child: the child exited with code 2, a descendant wrote `late-body` to the inherited stdout pipe after that exit, and `pi.sendMessage` received zero calls. The four focused async-rewake test files still pass, demonstrating that the current synthetic event ordering masks the defect.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Async rewake finalizes on process exit before its output streams close

**Classification:** BLOCKER
**File:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:313-315`
**Related evidence:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:396-405`; `tests/bridges/hooks/async-rewake/registry.test.ts:1131-1138`

**Issue:** `spawnAndRegister` finalizes the entry from the child's `exit` event, and `onChildExit` immediately reads the ring buffers. Node does not guarantee that child stdout/stderr have closed when `exit` fires; `close` is the event emitted after the stdio streams close. A child can therefore exit with code 2 while a descendant still owns an inherited pipe, or while buffered data is still being delivered. The registry sees an empty or partial body, removes the entry, and permanently drops the later hook output instead of injecting the required rewake message. The owner tests write/end each stream and await its `end` before synthetically emitting `exit`, so they enforce the favorable order rather than the real process contract.

**Fix:** Separate process termination from output finalization. Record the exit code/signal on `exit`, cancel the timer there, but do not read or discard the buffers until both owned streams have ended or the child's `close` event has fired. Use a once-only finalizer shared by `close` and `error`, and add a real or faithful test that emits `exit`, then stream data/end, then `close`, asserting the complete late body is injected exactly once.

### CR-02: PID-table snapshots can be committed out of lifecycle order

**Classification:** BLOCKER
**File:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:360-362`
**Related evidence:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:433-435`; `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:577-592`; `tests/bridges/hooks/async-rewake/registry.test.ts:1553-1562`

**Issue:** Exit and error handlers launch PID-table persistence without awaiting or serializing it, while a new spawn independently persists another snapshot. Each call captures current registry state before asynchronous containment and file I/O. Although `write-file-atomic` queues writes once they reach the same pathname, the preceding async containment work means calls can reach that queue in a different order. An older empty snapshot can overwrite a newer snapshot containing a live child. If the parent then crashes, that child's PID and dispatch marker are absent from the only recovery table, so the next process cannot reap it. The same-root test is strictly sequential: it waits for the first filesystem notification before firing the second terminal event, so it cannot detect overlapping persistence.

**Fix:** Maintain a per-table persistence chain or monotonic revision inside the registry. Enqueue snapshot creation and write as one ordered operation, make registration await its queued write, and make reload/orphan cleanup drain the same queue before unlinking. Add a deterministic overlap test that holds the first persist, registers or removes another child, releases both operations in reverse completion order, and verifies that the final table represents the newest registry state.

## Warnings

### WR-01: Filesystem watchers can hang the async-rewake tests indefinitely

**Classification:** WARNING
**File:** `tests/bridges/hooks/async-rewake/registry.test.ts:311-325`
**Related evidence:** `tests/architecture/hooks-async-rewake.test.ts:254-268`; `tests/bridges/hooks/async-rewake/registry.test.ts:430-434`

**Issue:** `observeTableRewrite` resolves only when `fs.watch` reports the exact target filename and has no timeout or state-based fallback. `fs.watch` delivery and filename reporting vary by platform and filesystem; a missed, coalesced, or filename-less event leaves `await tableRewrite.completion` pending forever. This makes the new tests capable of hanging a worker instead of producing a bounded failure, and the watcher observes notification delivery rather than proving that the expected snapshot is durable.

**Fix:** Wait on a deterministic lifecycle completion primitive from the serialized persistence fix. If the test must observe the filesystem, use a bounded state-based helper that reads until the exact expected table is present and rejects after a short explicit deadline; always close the watcher/timer in `finally`.

---

_Reviewed: 2026-08-31T13:44:34Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
