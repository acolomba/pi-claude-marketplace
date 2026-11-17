---
phase: 05-stop-continuation-and-hook-failures
reviewed: 2026-11-14T18:02:44Z
depth: deep
iteration: 3
reviewed_range: f319b4e4..0e40989c
files_reviewed: 21
files_reviewed_list:
  - .agents/skills/cucumber/rules/layout.md
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
  - docs/hooks-compatibility.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts
  - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts
  - features/hook/messages.feature
  - features/lib/boundary-refuser.ts
  - features/step_definitions/hook/prompt-and-stop.steps.ts
  - features/support/world.ts
  - test/bridges/hooks/async-rewake/registry.test.ts
  - test/bridges/hooks/hook-output-files.test.ts
  - test/bridges/hooks/runtime.test.ts
  - test/bridges/hooks/settle.test.ts
  - test/bridges/hooks/stream-text.test.ts
  - test/e2e/_rpc.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
  necessity: 0
status: issues_found
---

# Phase 5: Code Review Report

## Iteration 3

**Reviewed:** 2026-11-14T18:02:44Z
**Depth:** deep
**Iteration:** 3
**Range:** `f319b4e4..0e40989c`, the iteration-2 review-fix commits. The `.planning/` files in the range (`05-REVIEW-FIX.md`, `CONCERNS.md`, `CONVENTIONS.md`) are planning artifacts and are not in the list.
**Files Reviewed:** 21
**Findings:** critical 0, warning 1, info 4, total 5, necessity 0
**Status:** issues_found

### Summary

I read the whole diff of every changed file. I also read these callees and contracts in full: `async-answer.ts` (`answerCandidates`, `asyncAnswerTexts`), `runHooks` in `dispatch.ts`, and the lane table in `registry.ts`. In Pi 1.5.0 I read `_startRun` (`agent-session.js:1441-1491`), `_runBeforeSettleBoundary` (`:1584-1605`), `_emitAgentSettled` (`:696-720`), `abort()` (`:1989-2000`), `_emitExtensionEvent` (`:911-918`), and `emitBoundary` (`runner.js:759-806`). In `pi-agent-core` I read `continue()` and `runWithLifecycle` / `handleRunFailure` (`agent.js:254-392`).

I ran these checks. None touched the real `~/.pi/agent`.

- The owner tests of `stream-text`, `settle`, `runtime`, and `hook-output-files`, under `test/platform/isolated-pi-home.ts`: all pass.
- A `node` probe in the session scratchpad that feeds `collectStreamText` with a plain-lane-shaped bound (head plus tail) into `asyncAnswerTexts`. Its results are in WR3-01.

How each iteration-2 finding was resolved:

| Finding | Verdict |
| --- | --- |
| WR2-01 (Stop line decided from `event.continue`) | Fixed. I traced every ordering. In `_startRun`, the boundary runs only after `agent.prompt()` or `agent.continue()` returns, and both emit `agent_end` inside `runWithLifecycle` before they return, also on failure (`handleRunFailure`, `agent.js:383`). So the drop at `agent_end` always comes after the hold and before the next boundary. `agent_settled` comes only from the `finally` of `_startRun`, after the loop ends. (1) Boundary holds, then Pi stops: the loop breaks, `agent_settled` shows the line once. (2) Boundary holds, then Pi continues for another extension, queued input, or a rewake wake (`hasQueuedMessages`): `agent.continue()` emits `agent_end`, which drops the reason. (3) Boundary holds, then Escape: `_abortDuringBeforeSettle` returns `false`, the loop breaks, and the line shows. The page now says so. (4) Boundary returns `true`, but `_agentRunAbortRequested` breaks at `:1477`: the run stops, and the line shows. That is correct. (5) `agent.continue()` throws before `runWithLifecycle`, for example "Cannot continue from message role: assistant": no `agent_end`, then `finally` raises `agent_settled`, and the line shows. The run did stop, so that is correct too. (6) A `/reload` between hold and settle: `prepareSettleForRegistration` clears the held reason, and the old generation's handlers return at their guard. A reload during the Stop hooks: the re-check at `settle.ts:513` returns before `holdStopReason`. (7) A stale reason in a later run: every run emits `agent_end` before its own boundary or settle, so a reason that a settle failed to take (the `requireNotificationMode` arm) is dropped there and never shown for another run. The take-once runtime cells and the two new settle cases cover this. |
| WR2-02 (`RangeError` on the other lanes) | Fixed on 64-bit hosts. `bound` is required, so the compiler rejects a collector with no ceiling. Every call site passes one: `dispatch-exec.ts:427-440` and `streamBoundFor`. `head += piece` is checked after each piece, so the string stays below `2 ** 28` plus one pipe chunk (64 KiB), which is well below `2 ** 29 - 24`. Two residual gaps: the ceiling is above V8's limit on 32-bit hosts (IN3-01), and it bounds string length, not heap (IN3-02). |
| WR2-03 (plain stderr kept) | Fixed. `{ limit: 0 }` with no tail: `cutIndex(head, 0)` reads `charCodeAt(-1)`, which is `NaN`, so the cut is 0. `full` is then set at the first non-empty piece, and later chunks are not decoded. The `data` and `end` listeners stay attached, so the pipe drains and `end` fires. The one stderr reader, `wakeOnExitTwo`, is on the `rewake` lane only, and that lane gets `ceilingBound`. |
| IN2-01 (doc comment order) | Fixed. `streamBoundFor` now sits above the `ladderFor` JSDoc. The wrap of its new `//` comment is ragged (IN3-03). |
| IN2-02 (surrogate cut) | Fixed. `cutIndex` backs off at a high surrogate, and `lastUnits` steps past a low surrogate. `StringDecoder` never yields a lone surrogate, so only the cut and the tail start can split a pair, and both are handled. |
| IN2-03 (head-only drops a last-line answer) | Fixed for the case it names, but the join added a new defect (WR3-01). |
| IN2-04 (live-boundary default) | Fixed. `ops: SweepFileOps` is required, and both `event-router.ts` callers (`:1145`, `:1373`) pass `FILE_SYSTEM_SWEEP_OPS`. The real-file-system cases pass it explicitly. |
| IN2-05 (stale harness docs) | Fixed. `keepTerminalSessionLocal` throws before any directory or process is created (`world.ts:694-695` runs before `mkdir` and `startProfilePi`). `boundary-refuser.ts` returns `{ continue: false }` with no `entries`, so `emitBoundary` keeps the earlier entries and takes `false` as the last value (`runner.js:775-778`), as the scenario needs. The continuer's hidden `go on` entry is still committed by `_commitBoundaryDrafts`, but the run stops and the scenario checks only one model call, so the scenario is still sound. |

### Narrative Findings (AI reviewer)

### Warnings

#### WR3-01: The plain lane's head-and-tail join adds a line break that the hook never printed. This loses an answer that was kept whole, and lets a line fragment be taken as the answer

**File:** `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts:117-122`, `:141`; `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/async-answer.ts:31-52`; `test/bridges/hooks/stream-text.test.ts:135-150`
**Issue:** `text()` returns `` `${head}\n${tail}` `` whenever the cut has happened. Two cases break `asyncAnswerTexts`, which takes the **first** candidate that parses as a JSON object: the whole stdout, then each line in order.

1. **Nothing was dropped, but the text is still changed.** When stdout passes `PLAIN_ASYNC_STREAM_LIMIT` by no more than `PLAIN_ASYNC_STREAM_TAIL` units, the head and the tail hold every unit. But the join still puts `"\n"` at the cut position, which can be anywhere in a line. If the answer line straddles that position, it splits into two fragments, and neither one parses. Probe: `limit: 19, tail: 1000` on `"progress line\n{\"systemMessage\":\"the real answer\"}\n"` gives `"progress line\n{\"sys\ntemMessage\"…"`, and `asyncAnswerTexts` returns `[]`. The same stdout, unjoined, gives `[{source: "systemMessage", text: "the real answer"}]`. Upstream reads that answer, and so did the bridge, because every byte was kept. The `onLimit` debug line also says that units were "dropped" when none were. The new test `"keeps the whole end of a stream that passes its cut by less than its tail"` asserts `"abc\ndef"` for `"abcdef"`, which locks this behavior in.
2. **Units were dropped, and the tail's first line is a fragment that can win.** `lastUnits` starts the tail at `length - 65536`, which is any position in a line. If that position is the `{` of a JSON object that ends its line, the fragment is a valid object. It is also earlier in the candidate list than the real last-line answer, so it wins. Probe: 50 lines of `step {"n":1}`, then the answer line. With the tail start on a `{`, the result is `[]`: the fragment `{"n":1}` became the answer and has no fields. The full stdout gives the real answer. A progress line such as `note {"systemMessage":"step 3 done"}` would send the model a wrong text, attributed to the hook's answer. Upstream reads the whole stdout, so no line parses except the real answer. For lines that end in a flat JSON object, the chance is about one in the line length, so this case is not rare.

The head's own last line is cut mid-line too, but a fragment there can parse only when a complete object is a prefix of the line. That case is older than this change.
**Fix:** Keep the join exact when nothing was dropped, and keep only whole lines in the tail when something was:

```ts
let dropped = false; // set when lastUnits() actually discards units of tail + piece, or of head.slice(cut)
// ...
text: () => {
  if (!full || !keepsTail) return head;
  if (!dropped) return head + tail;           // every unit kept: the exact stdout
  const lineStart = tail.indexOf("\n");       // the tail's first line is a fragment
  return `${head}\n${lineStart === -1 ? "" : tail.slice(lineStart + 1)}`;
},
```

Call `onLimit` only once units are really dropped, or reword its line. Replace the `"abc\ndef"` case with one that expects `"abcdef"`. Add a case whose tail starts at the `{` of `x {"a":1}` and expect that fragment to be gone. Add a registry or `async-answer` case: an answer line that straddles the cut, inside the tail window, reaches the model.

### Info

#### IN3-01: The `2 ** 28` ceiling is above V8's longest string on 32-bit hosts, so the `RangeError` path stays open there

**File:** `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts:49-54`; `test/bridges/hooks/stream-text.test.ts:261-267`
**Issue:** V8's `String::kMaxLength` is `2 ** 29 - 24` with 8-byte pointers and `(1 << 28) - 16` with 4-byte pointers. On a 32-bit Node build, such as Node 22's `linux-armv7l`, which `engines` does not exclude, `head += piece` throws `RangeError: Invalid string length` in the `data` listener before `head.length` can pass `2 ** 28`. That is the uncaught exception that WR2-02 closed on 64-bit hosts. The comment "V8's longest string is almost twice as long" is true on 64-bit hosts only. The test reads `constants.MAX_STRING_LENGTH` and would fail on such a host, but CI runs only x64.
**Fix:** Derive the ceiling from the runtime: `const STREAM_TEXT_CEILING = Math.min(2 ** 28, Math.floor(constants.MAX_STRING_LENGTH / 2));`, with `constants` from `node:buffer`. Reword the comment.

#### IN3-02: The ceiling bounds one string's length, not the heap: one hook can hold about 1 GiB, and a bucket runs its hooks in parallel

**File:** `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts:48-67`, `:117-122`; `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:260-262`
**Issue:** `2 ** 28` code units is 256 MiB as a one-byte string and 512 MiB as a two-byte string. A single non-Latin-1 character makes the whole string two-byte. Each blocking or `asyncRewake` hook has two collectors. `runHooks` runs a bucket's hooks with `Promise.all`. At the cut, `head.slice(0, cut)` flattens the cons string, so for a moment there are two copies. A few hooks that each print a lot of non-ASCII text within a long declared `timeout` can pass Node's default heap limit. That is a fatal out-of-memory error, which no `try` catches. This is the same NFR-2 crash in another form. It is unlikely, and Claude Code keeps every byte too, so this is Info only.
**Fix:** Record the per-stream bound in bytes, not only in code units, on the compatibility page. Or lower the ceiling, for example to `2 ** 26` (64 Mi units, at most 128 MiB per stream), which is still far past any real hook output and past the 10,000-character cap that the context then passes.

#### IN3-03: Comment upkeep in the new bound code

**File:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:200-207`; `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts:3-7`
**Issue:** The `streamBoundFor` comment is wrapped unevenly. `:205` ends at "which nothing reads. The", and the sentence goes on at `:206`. The `stream-text.ts` header writes `registry.ts`'s values in full ("the first 8,388,608 UTF-16 code units of its stdout and the last 65,536"). A change to `PLAIN_ASYNC_STREAM_LIMIT` or `PLAIN_ASYNC_STREAM_TAIL` would leave this leaf module's header stale, and no check would report it.
**Fix:** Rewrap `:200-207`. In the header, name the bound by role ("a lower bound with a kept tail, set in `./async-rewake/registry.ts`"), not by value.

#### IN3-04: The scenario "A stop hook's stop reason is not shown when another extension already continued the run" checks that the line **is** shown

**File:** `features/hook/messages.feature:188-217`
**Issue:** After WR2-01, the first boundary's reason is held and then dropped at `agent_end`. The second boundary's reason is held and shown at `agent_settled`, and the `Then` expects exactly that line once. The title says the reason "is not shown". A reader, or a later fixer, cannot tell from the title that the scenario proves "dropped at the continued end, shown at the end that stops". The two notices have the same text, so the table cannot show which boundary produced the line either. The step-module header (`prompt-and-stop.steps.ts:14-19`) describes it correctly.
**Fix:** Rename it, for example to "A stop hook's stop reason shows once, at the run end that stops, when another extension continued an earlier end". Or make the two runs differ: a script that prints a different `stopReason` on its second run, so the table shows that only the second reason was shown.

---

_Reviewed: 2026-11-14T18:02:44Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
