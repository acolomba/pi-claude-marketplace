---
phase: 05-hooks
fixed_at: 2026-11-01T23:59:00Z
review_path: /home/user/pi-claude-marketplace/.planning/phases/05-hooks/05-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-11-01T23:59:00Z
**Source review:** /home/user/pi-claude-marketplace/.planning/phases/05-hooks/05-REVIEW.md
**Iteration:** 2

**Summary:**

- Findings in scope: 3 (CR-01, WR-01, WR-02; scope `critical_warning`)
- Fixed: 3
- Skipped: 0

**Where verification ran:** in the main checkout `/home/user/pi-claude-marketplace`, on branch `features/component-features-phase-5`. No worktree was used, as the caller's binding run rules require. The numbers below come from that tree.

Each fix followed the same steps. I wrote a red unit test in the paired `test/**` file, then the fix, then checked 100% direct coverage (`npm run test:coverage:direct -- <source>`). Each fix also got a cucumber scenario that I recorded failing with the source fix reverted. Then I ran `npx cucumber-js features/hook` (all passed) and `npm run check:static` (all passed). Each commit's hook ran `npm run check:commit` and passed. After the last fix I also ran the whole cucumber suite (`npx cucumber-js`: 1292 scenarios passed), the hook architecture and integration suites, and `test/index.test.ts` (78 passed). I did not run the full `npm run check`. The GSD gate still has to run it.

## Fixed Issues

### CR-01: An output overflow still turns an exit-2 deny into an allow

**Status:** fixed: requires human verification (logic: the exit code now decides after an overflow)
**Upstream evidence (Claude Code 2.1.316, `/opt/claude-code/bin/claude`):** The command-hook runner `MU` adds every stdout and stderr chunk with no limit (`zo+=Vs`, `Io+=Vs`). It never stops a hook for its output. It resolves with the exit status (`status:_i??1`), so an exit 2 blocks whatever the output size.
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`, `test/bridges/hooks/dispatch-exec.test.ts`, `features/hook/tool-use.feature`, `docs/hooks-compatibility.md`
**Commit:** 8da30e5
**Applied fix:** The bridge keeps its EXEC-02 memory limits (1 MB stdout, 64 KB stderr) but no longer kills a hook that passes them. `accumulateStream` drops the chunk that crosses a limit and every later chunk. It keeps its `data` listener, so the pipe drains and the hook runs to its exit. The timeout ladder still stops a hook that never exits. It returns a `cut()` flag. On `close`, stdout that was cut is not read (a cut JSON answer cannot parse). The exit code goes through the normal `onFailureBlock`, then `parseHookStdout`, path. So an exit 2 blocks with the stderr the bridge kept, and an exit 0 stays a noop. When only stderr overflows, the full stdout JSON still applies (a `deny` on exit 0 blocks). The unit cases that pinned the overflow kill (the SIGTERM, the 0-second ladder, the `kill()`-returned-false log, the already-killed child) were replaced by cases for "exit 2 after a stderr overflow", "exit 2 after a stdout overflow", "stdout deny with only stderr overflowing", "both streams overflow", and "the hook runs on until its timeout". The `fallow-ignore-next-line code-duplication` marker above the `settle` call was removed: `npx fallow dupes` finds no clone without it.
**Scenario:** `features/hook/tool-use.feature`, "A PreToolUse hook that exits 2 after overflowing its output blocks the tool call with its stderr". It has no `onFailure`. The iteration-1 scenario depended on the kill, so its hook now exits 1 ("A PreToolUse hook with onFailure block that fails after overflowing its output blocks the tool call"). The new row in `docs/hooks-compatibility.md` describes the limits.
**Red (fix reverted):**

```
+     'bash returned: from-model\n'
-     'bash failed: PreToolUse:Bash hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: blocked by policy'
2 scenarios (1 passed, 1 failed)
```

### WR-01: A `continue:false` from one PreCompact hook cancels another hook's block

**Status:** fixed
**Upstream evidence:** The PreCompact runner `q0e` builds `blockedBy` from `w.filter((Se)=>Se.blocked)`, that is, from every blocked hook, whatever the other hooks return.
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`, `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`, `test/bridges/hooks/dispatch.test.ts`, `test/bridges/hooks/event-adapters.test.ts`, `features/hook/session.feature`, `docs/hooks-compatibility.md`
**Commit:** c1fe1e2
**Applied fix:** `adaptPreCompactResult` now takes every hook's own result, not the folded one. Any `block` returns `{ cancel: true }`, and each `stop` is still debug-logged. `adaptForEvent` receives the whole `FoldedBucket` and passes the outcomes' results to the PreCompact adapter. `blockNotices` shows the compaction-blocked notice whenever `blocks(folded.outcomes)` is not empty. The dispatch case that pinned "no notice when one hook stops and another blocks" now expects the notice, and a new case keeps "no notice for a stop alone".
**Scenario:** `features/hook/session.feature`, "A PreCompact hook that exits 2 blocks the compaction when another PreCompact hook stops".
**Red (fix reverted):**

```
+   error: 'Turn prefix summarization failed: scripted model: call 2 has no step; the script has 1',
-   error: 'Compaction cancelled',
1 scenario (1 failed)
```

### WR-02: A follow-up prompt's context reaches the model on the running prompt's turn

**Status:** fixed: requires human verification (state handling across Pi's turn and queue lifecycle). The reviewer's suggested carrier was not used. See below.
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`, `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`, `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`, `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts`, `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts`, `test/bridges/hooks/event-adapters.test.ts`, `test/bridges/hooks/event-router.test.ts`, `test/bridges/hooks/dispatch.test.ts`, `test/bridges/hooks/runtime.test.ts`, `test/architecture/hooks-lifecycle.test.ts`, `test/index.test.ts`, `features/step_definitions/hook/prompt-and-stop.steps.ts`, `features/hook/additional-context.feature`, `docs/hooks-compatibility.md`
**Commit:** a17639b
**Why not `{ deliverAs: event.streamingBehavior }`:** In Pi 1.4, `sendCustomMessage` with `deliverAs` and no `triggerTurn: false` calls `agent.steer`/`agent.followUp` while streaming. That puts the context in the same queue as the prompt, as a separate item. But Pi's default `steeringMode` and `followUpMode` are both `"one-at-a-time"` (`settings-defaults.js`), and `PendingMessageQueue.drain()` hands out one item per delivery point. So the context gets a model call of its own before the prompt. I confirmed this in the harness with a temporary patch, not committed. The existing steer scenario and the new follow-up scenario both failed with "the model was called past its script" (`call 3` and `call 5`).
**Applied fix:**

- A steer's context still goes out at once with `triggerTurn: false`. Pi reads a steer on the next model call, so it is correct already.
- A follow-up's context is queued in a new runtime buffer (`PendingFollowUpContext`, with the follow-up's text).
- A new `turn_end` subscription calls `sendDueFollowUpContext`. When the turn ended with no tool call, error, or abort, Pi reads its next queued message. `context.pendingMessages[0]` is that message (Pi's `peekQueuedMessages` returns the steering head, else the follow-up head). When it is a user message whose text matches a queued follow-up context, the bridge sends that context with `triggerTurn: false`. Pi appends it at this turn end, just before it reads the follow-up. The match uses text, as Pi does for its own queues (`_followUpMessages.indexOf(messageText)`). Contexts queued before the matched one are dropped, because Pi reads follow-ups in order.
- A prompt that Pi does not queue (`streamingBehavior` undefined) drops any follow-up context still waiting, with a debug line. A bridge load empties the buffer too.
- The `turn_end` registration adds one entry to the registration lists in `event-router.test.ts`, `hooks-lifecycle.test.ts`, and the strict mock in `test/index.test.ts`. That file imports `TurnEndEvent` from the Pi peer, because the frozen `platform/pi-api.ts` does not re-export it.
- `docs/hooks-compatibility.md` (the paragraph at former line 279) now says what is true: a steer's context goes out at once, a follow-up's waits for the turn before Pi reads it, and a follow-up whose text Pi expands (a skill command or prompt template) is not found, so its context is dropped at the next idle prompt.

**Scenario:** `features/hook/additional-context.feature`, "A prompt hook's additional context for a follow-up reaches the model on the turn that reads the follow-up". The new step `the user prompts {string} and follows up with {string} while the tool runs` shares a helper with the steer step. The script runs two tool calls and a reply before Pi reads the follow-up.
**Red (fix reverted):** the follow-up's context appeared on calls 2 and 3, after the first tool result, and not before `also say hi` on call 4 (`2 scenarios (1 passed, 1 failed)`; the steer scenario passed).

## Iteration 1 (summary)

Iteration 1 (commits `0d877aa..40367d9`) fixed 6 of 7 findings: CR-01 (an `onFailure: "block"` guard failed open on output overflow), CR-02 (a blocking SessionStart hook dropped the others' context), WR-02 (prompt context on the wrong turn, for a stale buffer and a steer), WR-03 (hook notices shown verbatim and unbounded), WR-04 (a PreCompact block did nothing), and WR-05 (the reload scenario depended on a quiet window). It skipped WR-01 (the input rewrite of the winning decision) because the fix would have diverged from upstream's `jFt` fold. D-CF5-09 was later amended to match upstream (P5-DC-22).

---

_Fixed: 2026-11-01T23:59:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
