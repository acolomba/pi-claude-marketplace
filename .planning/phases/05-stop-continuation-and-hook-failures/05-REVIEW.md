---
phase: 05-stop-continuation-and-hook-failures
reviewed: 2026-11-14T16:54:35Z
depth: deep
iteration: 2
reviewed_range: 69643d4f..c5e56134
files_reviewed: 22
files_reviewed_list:
  - .agents/skills/cucumber/rules/layout.md
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
  - docs/hooks-compatibility.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts
  - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts
  - features/hook/messages.feature
  - features/hook/prompt-and-stop.feature
  - features/lib/boundary-continuer.ts
  - features/step_definitions/hook/prompt-and-stop.steps.ts
  - features/support/world.ts
  - test/bridges/hooks/async-rewake/registry.test.ts
  - test/bridges/hooks/dispatch.test.ts
  - test/bridges/hooks/hook-output-files.test.ts
  - test/bridges/hooks/runtime.test.ts
  - test/bridges/hooks/settle.test.ts
  - test/bridges/hooks/stream-text.test.ts
  - test/e2e/_rpc.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
  necessity: 1
status: issues_found
---

# Phase 5: Code Review Report

## Iteration 2

**Reviewed:** 2026-11-14T16:54:35Z
**Depth:** deep
**Iteration:** 2
**Range:** `69643d4f..c5e56134`, the iteration-1 review-fix commits. `05-REVIEW-FIX.md` is a planning artifact and is not in the list.
**Files Reviewed:** 22
**Findings:** critical 0, warning 3, info 5, total 8, necessity 1
**Status:** issues_found

### Summary

I read the whole diff of every changed file. I also read these callees and contracts in full: `async-answer.ts`, `timeout.ts`, `notification-run.ts`, `notifyHookNotice`, the `finalizeChild` lane table in `registry.ts`, and in Pi 1.5.0 `emitBoundary` (`runner.js:759-806`), `_runBeforeSettleBoundary` (`agent-session.js:1584-1605`), and the run loop and `_emitAgentSettled` (`agent-session.js:1467-1490`, `:695-703`).

I ran these checks. None touched the real `~/.pi/agent`.

- The owner tests of `stream-text`, `settle`, `hook-output-files`, `runtime`, `dispatch`, and `async-rewake/registry`, under `test/platform/isolated-pi-home.ts`: 561 tests, 561 pass.
- The new scenario "A stop hook's stop reason is not shown when another extension already continued the run", under the `adapter` profile, in the cucumber sandbox: it passes.
- A `node` probe of `collectStreamText` with `limit: 3` on `"ab😀c"`. It returns `"ab\ud83d"`, a lone high surrogate, and `onLimit` runs once.

How each iteration-1 finding was resolved:

| Finding | Verdict |
| --- | --- |
| WR-01 (plain async output unbounded) | Fixed for the plain lane. The boundary is correct: a stream that ends at exactly `limit` drops nothing, and `onLimit` runs once per stream, because `full` gates both the `data` and the `end` arm. Later chunks are still read, so the pipe drains and `end` fires. A cut can split a surrogate pair (IN2-02). The same crash path is still open on the other lanes (WR2-02), and the plain lane keeps stderr that nothing reads (WR2-03). |
| IN-01 | Skipped as instructed (BACKLOG HOOKTIMEDOUTEXIT2-01). Not raised again. |
| IN-02 (stop line when another extension continued) | Fixed for the case it names. But `event.continue` is only the value of the handlers that ran before the bridge, not the outcome of the boundary, so one path now loses a needed notice (WR2-01). |
| IN-03 (settlements column) | Fixed. The column and the `strictEqual(..., 1)` are gone, and the header's argument holds. A run that settled after each model call would end the turn at its first settle, and the run-start and model-call counts would then differ from the table. |
| IN-04 (start failure claimed before shown) | Fixed, with no race. `showHookNotice` checks the key, calls `show`, and records the key in one synchronous span. `notifyHookNotice` returns `void` and does not await. So two events that fail at the same time cannot interleave between the check and the record, because JavaScript runs one task at a time. Two hooks with the same key in one list still show once. A notice whose `show` throws is not recorded, in both `showHookNotices` and `showStopNotices`. |
| IN-05 (leaf link case) | Fixed. The case plants the link, expects `SymlinkRefusedError`, and checks that the target is unchanged. |
| IN-06 (sweep limits and per-file errors) | Fixed. `sweepFile` catches its own `lstat` and `unlink` errors, and the folder-level arm stays as before. `path.basename` in the log line can only be a `SAVED_NAME` match, so no control text reaches the log. The page lists the limits. The defaulted `ops` parameter has a style issue (IN2-04). |
| IN-07 (comment) | Fixed. The new comment matches the code: the `try` around `sendMessage` catches the throw from the stale `pi`. |

On `leadingExtensions` and scenario isolation: the option is set only by the new `Given`. It is per launch, and `restartedLaunch` carries it through `{ ...launch }`. `piArguments` adds nothing when it is absent. So no other scenario's load order changes. Each profile Pi is its own process, so the continuer's `continued` flag cannot leak to another scenario. Two small gaps are left: a stale doc comment, and a TUI session that would not get the option (IN2-05).

### Narrative Findings (AI reviewer)

### Warnings

#### WR2-01: The Stop line is now left out whenever an earlier handler set `continue`, even when the boundary still ends the run

**File:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:201` (`runContinues: event.continue`) and `:519-525`; `docs/hooks-compatibility.md:431`
**Issue:** `event.continue` is the value that the handlers before the bridge's left (`runner.js:767-778`). It is not the outcome of the boundary. Pi decides that later:

- A later handler can return `continue: false`, and Pi takes the last value (`runner.js:777-778`).
- A later handler can return invalid entries. Then `emitBoundary` returns `continue: false` (`runner.js:803-805`).
- An Escape during the Stop hook sets `_abortDuringBeforeSettle`, and `_runBeforeSettleBoundary` returns `false` (`agent-session.js:1594-1595`). The page already says that Escape "drops the continuation" there.
- `!finalContext.canContinue` also returns `false` (`agent-session.js:1597-1600`).

In each of these cases an earlier handler, such as pi-subagents, set `continue: true`. The bridge's `Stop` hook then returned `continue: false` with a reason, the bridge left out the line, and the run still stopped. So the user never sees `Stop hook stopped continuation: <reason>` for a stop that did happen. Claude Code always shows that line for a Stop `continue: false`. The page says the line is left out "because the run does not stop" (`hooks-compatibility.md:431`). That is not true on these paths.

The opposite case is still open too: Pi also continues when `agent.hasQueuedMessages()` is true (`agent-session.js:1596`). Examples are input that the user typed during the Stop hook, and an `asyncRewake` wake sent while the Stop hooks run (D-BG-210). In both cases `event.continue` is `false`, so the bridge shows "stopped continuation" and the run goes on. This case is older than the fix, but it has the same root cause. At its own turn, the bridge cannot know whether the boundary will continue.

**Fix:** Decide the line from the outcome, not from the input. At the boundary, keep the stop reason in the runtime (for example `runtime.setPendingStopReason(reason)`) and show nothing. In `settleHandlerFor` (`agent_settled`), which Pi emits only when the run loop has ended (`agent-session.js:1489`), show the pending reason and clear it. Clear it also at the next `agent_before_settle` or `agent_start`, because the run then continued. This shows the line exactly when the run stopped, whatever the load order, and it also covers the queued-message case. If the maintainer keeps the current design, at least reword `hooks-compatibility.md:431` so that it names the later-handler, invalid-entry, and Escape cases, in which the run stops with no line. Add a settle case: the event has `continue: true`, a later handler refuses, and the line shows once at `agent_settled`.

#### WR2-02: The `RangeError` path that WR-01 closed for the plain lane is still open on the `asyncRewake` and blocking lanes, whose "timer" is the hook's own declared `timeout`

**File:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:200-201` (the comment "the other lanes have a timer, so they keep every byte"), `:387-409`; `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts:46-53`; `extensions/pi-claude-marketplace/bridges/hooks/timeout.ts:126-139`
**Issue:**

- `resolveTimeoutSeconds` returns any positive finite declared value as it is (`timeout.ts:137-139`).
- The only general ceiling is `installTimerLadder`'s clamp to what `setTimeout` can hold, about 24.8 days (`timeout.ts:126-127`).
- So an `asyncRewake` hook that declares `timeout: 86400` runs in the background for a day, with an unbounded collector on both streams (`streamBoundFor` returns `undefined` for every lane except `plain`).
- At 1 MB/s it reaches V8's maximum string length in about nine minutes. Then `text += piece` throws `RangeError: Invalid string length` inside the `data` listener, which nothing catches. That is an uncaught exception in Pi, which NFR-2 forbids. It is the WR-01 root cause.
- A blocking hook with a long declared timeout can reach it the same way, though the user sees its event wait.

So the new comment's claim that the timer bounds these lanes holds only for the 600-second default. This path is older than the phase, but the fix's comment now states that these lanes are safe.

**Fix:** Give every collector a safety ceiling well below V8's limit, for example `2 ** 28` characters, with one debug line. Keep `PLAIN_ASYNC_STREAM_LIMIT` as the lower bound of the plain lane. This keeps EXEC-02's "every byte" for any output that a real hook prints, and removes the crash. A smaller alternative is to catch the `RangeError` in `append`, stop collecting, and debug-log it. Reword the comment at `registry.ts:200-201` either way. Add a `stream-text` case with a small injected ceiling and no `bound`, so the test proves the ceiling without 256 MB of input.

#### WR2-03: Phantom requirement: a plain `async` hook keeps up to 8,388,608 characters of stderr that no code reads

**File:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:392-400` (stderr collector with the plain bound); readers at `:749` and `:598-600`
**Category:** necessity
**Issue:** `entry.stderr.text()` has one reader, `wakeOnExitTwo` (`registry.ts:749`). The lane table calls it only for the `rewake` lane (`:587-597`). The `plain` arm calls only `sendAsyncAnswer` (`:598-600`), which reads `entry.stdout.text()`. `rg "\.stderr\.text\(\)" extensions` finds only `:749`. So on the plain lane, the collector must drain stderr so that the child does not block on a full pipe, but it has no reason to keep any of the text. Today each plain hook keeps up to 8,388,608 UTF-16 units (16 MB) of stderr for as long as it runs. A watcher hook that runs all session is exactly the hook that WR-01 described. The only reason given is "so the two streams behave alike" (05-REVIEW-FIX, decision 2), which no requirement asks for.
**Fix:** For the plain lane's stderr, pass `{ limit: 0, onLimit }`. `append` then cuts to `""` at the first character and drops the rest, and the stream still drains and ends. Or attach only the error listener and a no-op `data` listener. Change the debug line to say that a plain hook's stderr is not kept, and update the compatibility page's `async` row and large-output row (`hooks-compatibility.md:293`, `:344`).

### Info

#### IN2-01: The new `streamBoundFor` sits between `ladderFor`'s doc comment and `ladderFor`

**File:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:193-221`
**Issue:** The JSDoc block "Chooses the timer of a background child before it spawns..." (`:193-199`) is now followed by the `//` comment and the body of `streamBoundFor` (`:200-220`). `ladderFor` starts at `:222`. TypeScript and editors attach a JSDoc block to the next declaration, so the timer text now documents `streamBoundFor`, and `ladderFor` has no doc comment.
**Fix:** Move `streamBoundFor` and its comment above the `/**` block at `:193`, or below `ladderFor`.

#### IN2-02: The bound counts UTF-16 code units, and the cut can split a surrogate pair. The page and the debug line say "characters"

**File:** `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts:46-53`; `registry.ts:216`; `docs/hooks-compatibility.md:293`, `:344`
**Issue:** `text.slice(0, bound.limit)` counts UTF-16 code units. I measured `"ab😀c"` with `limit: 3` as `"ab\ud83d"`. The lone surrogate ends the last, cut line, which `asyncAnswerTexts` can never parse as an answer, so no answer changes. But the page and the debug line promise "8,388,608 characters", and an astral character counts as two. The file header still says that it "Collects the whole text of one output stream", and it names only two lanes (`stream-text.ts:3-5`).
**Fix:** Back off one unit when the cut lands after a high surrogate (`0xD800-0xDBFF` at `limit - 1`). Or say "UTF-16 code units" on the page. Update the header to name the plain lane and its bound.

#### IN2-03: The bound keeps the head of stdout, which drops the answer that a progress-printing hook writes last

**File:** `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts:46-53`; `async-rewake/async-answer.ts:30-36`
**Issue:** `answerCandidates` tries the whole stdout and then every line, so a hook can print progress lines and put its JSON answer on the last line. Upstream reads that answer at any size. WR-01 named this kind of hook (one that "prints progress lines") as the reason for the bound. Once its progress passes 8,388,608 units, the bound drops exactly that last line, and the model gets no answer, with only a debug line. This is the maintainer's open decision 1 in 05-REVIEW-FIX. It is listed here because head-only is not the only bounded choice.
**Fix:** Keep the head and also a small tail ring, for example the last 64 KiB. Join them with `"\n"` at the cut, so a last-line answer still parses. Or record on the page that an answer after the first 8,388,608 characters is lost.

#### IN2-04: `sweepHookOutput` defaults a parameter to the live file system, and `typeof DEFAULT_SWEEP_FILE_OPS` hides a private type from fallow

**File:** `extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts:53-60`, `:83-87`
**Issue:** `.agents/skills/typescript-unit-tests/rules/pairing-and-design.md` says: "Do not default a parameter to a live boundary." `ops = DEFAULT_SWEEP_FILE_OPS` defaults to the real `lstat` and `unlink`. The hooks bridge has a precedent that CONVENTIONS endorses (`tools: HookToolView = createHookToolView(pi)`, P5-DC-19), so this is a judgment call. Separately, `typeof DEFAULT_SWEEP_FILE_OPS` resolves to the unexported `SweepFileOps`. So the exported signature still exposes a private type, and fallow's `private-type-leak` misses it only because the name is not written there. 05-REVIEW-FIX says that this spelling was chosen after the hook failed on that rule.
**Fix:** Export `SweepFileOps` and write `ops: SweepFileOps = DEFAULT_SWEEP_FILE_OPS`, which states the port openly. Or pass the ops from the two `event-router.ts` callers (`:1145`, `:1373`) so that no default is needed.

#### IN2-05: Harness documents are stale after `leadingExtensions` and the new harness extension

**File:** `features/support/world.ts:668-684`, `:1015-1025`; `test/e2e/_rpc.ts:277-283`; `.planning/codebase/CONVENTIONS.md` (Suppressions bullet)
**Issue:**

- The `usePiWithProfile` doc comment still lists the load order as "the real extension, the scripted model, the registry probe ... and then `profile.extraExtensions`" and does not name `leadingExtensions`. The `PiProfile` comment was updated.
- `keepTerminalSessionLocal` copies only `extraExtensions` into `tuiExtensions`, so a later TUI session of a profile that has both `withoutGitHubBaseOverride` and `leadingExtensions` would drop the leading extensions. No scenario combines them today.
- The `piArguments` comment has a 128-character line (`_rpc.ts:279`).
- CONVENTIONS.md still counts "exactly 50" `fallow-ignore` markers and "nine harness Pi extensions". `features/lib/boundary-continuer.ts:15` makes it 51 and ten (`rg -c fallow-ignore extensions features test scripts` sums to 51).

**Fix:** Add `leadingExtensions` to the `usePiWithProfile` comment. Carry it in `keepTerminalSessionLocal`, or refuse a profile that sets both. Rewrap the `_rpc.ts` comment. Update the CONVENTIONS inventory in the planning-doc pass.

---

_Reviewed: 2026-11-14T16:54:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
