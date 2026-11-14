---
phase: 05-stop-continuation-and-hook-failures
reviewed: 2026-11-14T15:47:11Z
depth: deep
iteration: 1
reviewed_range: 434c7da4^..0313bb61
files_reviewed: 60
files_reviewed_list:
  - docs/hooks-compatibility.md
  - docs/output-catalog.md
  - docs/research/claude-hooks-vs-pi-events.md
  - docs/research/issue-103-stop-stopfailure-promotion.md
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/async-answer.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/context-cap.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
  - extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts
  - extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts
  - extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts
  - extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts
  - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/bridges/hooks/timeout.ts
  - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
  - extensions/pi-claude-marketplace/domain/components/hook-events.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/atomic-json.ts
  - features/hook/additional-context.feature
  - features/hook/async.feature
  - features/hook/failures.feature
  - features/hook/messages.feature
  - features/hook/prompt-and-stop.feature
  - features/lib/run-start-probe.ts
  - features/plugin/subagent-child.feature
  - features/step_definitions/hook/additional-context.steps.ts
  - features/step_definitions/hook/async.steps.ts
  - features/step_definitions/hook/messages.steps.ts
  - features/step_definitions/hook/prompt-and-stop.steps.ts
  - features/step_definitions/plugin/subagent-hooks.steps.ts
  - test/architecture/closed-set-enrollment.test.ts
  - test/architecture/hooks-lifecycle.test.ts
  - test/bridges/hooks/async-rewake/async-answer.test.ts
  - test/bridges/hooks/async-rewake/registry.test.ts
  - test/bridges/hooks/context-cap.test.ts
  - test/bridges/hooks/dispatch-exec.test.ts
  - test/bridges/hooks/dispatch.test.ts
  - test/bridges/hooks/event-adapters.test.ts
  - test/bridges/hooks/event-router.test.ts
  - test/bridges/hooks/exec-result.test.ts
  - test/bridges/hooks/exec-timer.test.ts
  - test/bridges/hooks/hook-labels.test.ts
  - test/bridges/hooks/hook-output-files.test.ts
  - test/bridges/hooks/on-failure.test.ts
  - test/bridges/hooks/runtime.test.ts
  - test/bridges/hooks/settle.test.ts
  - test/bridges/hooks/wire-protocol.test.ts
  - test/index.test.ts
  - test/live-uat/README.md
  - test/live-uat/manifest-absence-canary.mjs
  - test/live-uat/openai-stub-server.mjs
  - test/pi-runtime.ts
  - test/platform/pi-api.test.ts
  - test/shared/atomic-json.test.ts
findings:
  critical: 0
  warning: 1
  info: 7
  total: 8
  necessity: 1
status: issues_found
---

# Phase 5: Code Review Report

## Iteration 1

**Reviewed:** 2026-11-14T15:47:11Z
**Depth:** deep
**Iteration:** 1
**Range:** `434c7da4^..0313bb61`. The code commits start at `434c7da4`. The commits after `a3fb0669` change only `.planning/` and skill documents, so they add no file to the scope.
**Files Reviewed:** 60. The deleted `test/live-uat/stop-canary.mjs` is not listed.
**Findings:** critical 0, warning 1, info 7, total 8, necessity 1
**Status:** issues_found

### Summary

I read every changed production module in full or across its whole diff: `settle.ts`, `runtime.ts`, `dispatch.ts` (failure notices, once-only claim, edit preflight), `dispatch-exec.ts` (claim, cap, timeout strip), `wire-protocol.ts`, `on-failure.ts`, `hook-labels.ts`, `exec-result.ts`, `context-cap.ts`, `hook-output-files.ts`, `atomic-json.ts`, `event-adapters.ts`, `event-router.ts`, `async-rewake/registry.ts`, `async-rewake/async-answer.ts`, `exec-timer.ts`, and `timeout.ts`. I also read the callees and the Pi contract they depend on:

- `shared/path-containment.ts`, the lstat walk with its leaf check.
- `stream-text.ts`, the unbounded collector.
- `process-group.ts`.
- `notification-run.ts`.
- In Pi 1.5.0: `_startRun`, `_handlePostAgentRun`, `_runBeforeSettleBoundary`, `_buildBoundaryContext`, `abort()`, and `emitBoundary` (`dist/core/extensions/runner.js:759-806`).
- `createContext` and its stale guards (`runner.js:613-690`).
- The `agent_before_settle` handler of pi-subagents 0.88.1 (`src/runs/background/notify.js:841-871`).

I checked the BACKLOG items that this phase already opened (HOOKTIMEDOUTEXIT2-01, HOOKOUTLEAFLINK-01, HOOKOUTSWEEPDOC-01, STOPFOLLOWUPCTX-01, STOPASYNCANSWER-01, ASYNCRELOADTABLE-01) so that I do not report a known item as new.

I ran these checks in a sandbox. None of them touched the real `~/.pi/agent`.

- The owner tests of `settle`, `context-cap`, `hook-output-files`, `wire-protocol`, and `hook-labels`, under `test/platform/isolated-pi-home.ts`: 253 tests, 253 pass.
- A `node` probe of `capHookContext`. 700 wrapper tags give one opener and one closer. A 20,000-character error text gives exactly 10,000 characters. A preview of astral characters splits no surrogate pair.
- A `node` probe of `saveHookOutput` with a link planted at the leaf in an `mkdtemp` root. It throws `SymlinkRefusedError`, and the link target is unchanged.
- A `node` probe of Node's event order for a spawn `ENOENT`: `error` comes first, then `close -2`.

I did not run `npm run check`, did not edit source, and did not commit. I read the necessity rubric.

I found no Critical defect. Containment, the boundary merge, the missing-script rule, and the claim ordering hold. The one Warning (WR-01) is a robustness loss that D-PG5-17 causes: the plain `async` lane still collects all of a hook's output, but the hook now has no time limit.

Answers to the focus questions:

1. **The `agent_before_settle` Stop handler and other extensions: correct.** Pi gives each handler the accumulated `entries` and `continue` (`runner.js:767-778`). The handler returns `[...event.entries, draft]` with `continue: true`, or it returns `undefined` (`settle.ts:202-204`). So it never drops an entry, and it never cancels a continuation that another handler asked for (D-PG5-05). pi-subagents 0.88.1 returns early when `event.continue` is already true and appends to `event.entries`, so the two handlers work together in either order. If a later handler returns `continue: false`, the bridge's draft is still committed and its re-entry is still counted. The compatibility page states this case (`docs/hooks-compatibility.md:154`). The handler reads its last message from the `agent_end` cache. `takeStopEnding` takes only a `stop` ending (`runtime.ts:369-377`). The `length` and `error` endings stay for `agent_settled`, which returns on `stop` (`settle.ts:285-286`), so one ending runs `Stop` at most once. In a pi-subagents child, the boundary handler does not take the cache (`event-router.ts:1325-1327`), and `agent_settled` empties it.
2. **Stale generations: holds in production. The check after the await mostly matters in tests.** `index.ts:92` builds a new `HooksRuntime` for each factory call, so an old load's closure keeps its own runtime. Pi then marks the old `pi` and `ctx` as stale. Every `ctx` getter calls `assertActive()`, which throws (`runner.js:613-690`). So a late result from an old load cannot reach the new session. The checks after the await in `runStopBucket` (`settle.ts:481`) and `sendAsyncAnswer` (`registry.ts:659`) trip only when one runtime is registered twice, which happens in tests. IN-07 covers the one comment that claims more than this.
3. **The once-only failure notices: correct for the stated scope.** An `exit` failure and a `missing-script` failure show on every run, and a `spawn` failure or a `run` failure shows once for each event and resolved command in a load (`dispatch.ts:663-685`). The set empties at each bridge load (`runtime.ts:291`). The claim happens while the notices are built, before they are shown. IN-04 covers that ordering.
4. **The missing-script exit-2 rule: correct.** The rule needs `Stop` or `UserPromptSubmit`, a blank stdout, and stderr that matches `/no such file|can't open/i` (`wire-protocol.ts:57-66`). These are Claude Code 2.1.323's `wvr` conditions for plugin hooks. `isFailure` reads the marker for `onFailure` (`on-failure.ts:81-83`), and `Stop` ignores `onFailure` (`on-failure.ts:94`). **The timed-out SIGTERM-trap edge (HOOKTIMEDOUTEXIT2-01) should not keep its block.** Upstream reports a timed-out hook as `hook_cancelled` and never as a block (05-RESEARCH U4), so the new noop is closer to upstream than the old block was. The divergence that remains is older than this phase: a hook that traps SIGTERM at its own timeout and exits 2 with any other stderr still blocks on every event. See IN-01.
5. **Context cap, saved files, and the sweep: contained.**
   - The file name is `hook-<uuid|dispatchId>-<closed source>.txt` (`hook-output-files.ts:47`). `assertPathInside` lstats every segment, the leaf included. This matters because `write-file-atomic` resolves the target with `realpath` before it writes, so a link at the leaf would be followed. I measured that the leaf link is refused.
   - The sweep follows no link. It removes only regular files with a saved name and never enters a sub-folder (`hook-output-files.ts:63-73`).
   - The cap keeps the whole replacement text within 10,000 characters in every arm (`context-cap.ts:66-73`, measured).
   - The two advisories from the security audit stand as IN-05 and IN-06.
6. **The claim ordering in `dispatch-exec`, when `close` follows `error`: correct.** For a spawn `ENOENT`, Node emits `error` and then `close -2` (measured). The `error` arm builds its result and then claims (`dispatch-exec.ts:453-455`). The `close` arm reads `ladder.fired()` before it claims, so the ladder is cancelled only after its fired state has been read (`dispatch-exec.ts:467-483`). A `close` after a claimed `error` returns before the cap. The cap never rejects, so the deferred `resolve` always runs.
7. **The inert timer ladder for plain `async` hooks: correct. A side effect follows from it (WR-01).** `ladderFor` (`registry.ts:193-215`) gives a plain hook `INERT_TIMER_LADDER`, logs a declared timeout once per spawn, and keeps the rewake ladder unchanged. A hook with both flags uses the rewake lane (`laneOf`). Reload and the reap still stop a plain hook through the process group, because neither depends on the ladder. The stale-load path does not get wider. An old load's `finalizeChild` throws at `exit.ctx.mode` on the stale `ctx` and returns before `sendAsyncAnswer`, so a late exit writes no saved file. Only a reload during an in-flight save leaves a file, which the 30-day sweep removes.

### Narrative Findings (AI reviewer)

### Warnings

#### WR-01: A plain `async` hook now runs with no time limit, but its stdout and stderr are still collected with no size limit

**File:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:193-204` (the inert ladder) and `:361-370` (the collectors); root cause `extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts:33-45`
**Issue:**

- `collectStreamText` appends every `data` chunk to one string (`text += …`) for the whole life of the child. It has no limit.
- Before D-PG5-17, the 600-second ladder also bounded how much a plain `async` hook could print. Now `ladderFor` gives the hook `INERT_TIMER_LADDER`, so a hook that keeps printing is limited only by its own end, a reload, or the next start. On macOS and Windows, a reload does not stop such a hook either (D-PG5-18).
- Examples are a watcher that tails a log, or a hook that prints progress lines. A hook like this keeps growing a string in Pi's process for as long as Pi runs.
- When the string reaches V8's maximum length (about 2^29 UTF-16 units on 64-bit), `text += chunk` throws `RangeError: Invalid string length` inside a stream `data` listener. Nothing catches the throw there, so it becomes an uncaught exception in Pi. This breaks NFR-2, which says that a hook must never throw past a Pi event.
- At 1 MB/s, the old timer stopped such a hook before about 600 MB. Now it reaches the limit in roughly nine minutes and continues.
- The plain lane needs only the first JSON object on stdout (`asyncAnswerTexts`). Stderr is read only by the rewake lane (`rewakeBody`, `registry.ts:707`).

**Fix:** Bound the collector for the plain lane. Keep the first N bytes, for example 8 MiB, which is enough for any answer that the 10,000-character cap and its saved file then handle. After that, drop the rest and write one debug line. Do not grow the string. For example, give `collectStreamText` a `limit` parameter:

```ts
export function collectStreamText(stream, onError, limit = Number.POSITIVE_INFINITY): StreamText {
  let text = "";
  let truncated = false;
  // ...
  stream.on("data", (chunk: Buffer | string) => {
    if (truncated) return;
    text += typeof chunk === "string" ? chunk : decoder.write(chunk);
    if (text.length > limit) { text = text.slice(0, limit); truncated = true; }
  });
```

Pass the limit from `spawnAndRegister` only when `exit.lane === "plain"`. Add a registry owner case in which a child prints past the limit and its answer is still parsed. Record the bound on the compatibility page next to D-PG5-18, because it is a bridge limit that upstream does not document.

### Info

#### IN-01: Only the missing-file case of HOOKTIMEDOUTEXIT2-01 moved toward upstream. A timed-out hook that exits 2 still blocks on every other path

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:303-309` (`withoutTimeoutFailure`) and `:467-472`; `extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts:80-82`
**Issue:** 05-03-SUMMARY asks whether the timed-out SIGTERM-trap run should keep its block. It should not. Claude Code 2.1.323 cancels a hook at its timeout and reports `hook_cancelled` (05-RESEARCH U4). It does not read a later exit code as a decision. So the phase's noop for that one case matches upstream. But `withoutTimeoutFailure` strips only a noop's failure. A hook that traps SIGTERM after its timeout and then exits 2 with any other stderr still goes through `exitTwoResult` and blocks. On `Stop`, it even continues the run with its stderr as feedback. This divergence is older than Phase 5. The phase only made it visible: the same timed-out exit 2 now blocks or passes depending on what its stderr says.
**Fix:** Close HOOKTIMEDOUTEXIT2-01 as "keeps no block", and reword it, or add a new item, so that it covers the general case: when `ladder.fired()` is true, map any parsed result except an `onFailure` block to a plain noop. Check this against upstream first, with the `claude-code-compat-research` skill.

#### IN-02: A `Stop` hook's `continue: false` shows "stopped continuation" even when another extension has already continued the run

**File:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:490-498` and `:409-418`
**Issue:** D-PG5-13 shows a `stopReason` "where the bridge honors the stop", and it leaves out `PostToolUse` because "a notice would claim a stop that did not happen". At the boundary, the handler gets `event.continue`. When an earlier handler set it to `true`, for example pi-subagents reminding about an unanswered result, the bridge does not veto (D-PG5-05). The run continues, but the user still sees `Stop hook stopped continuation: <reason>`.
**Fix:** Pass `event.continue` into `runStopBucket`. When it is already `true`, debug-log the reason and do not show it. A later handler can still continue the run, and that case stays on the compatibility page.

#### IN-03: The "agent settlements" column of the new counts step cannot read anything but 1

**File:** `features/step_definitions/hook/prompt-and-stop.steps.ts:214-224` and `:257-271`; also `:315`
**Issue:** The `When` step waits for the first `agent_settled` after the prompt and then records the turn. So `turn.records.filter(isSettled).length` counts at most the one settlement that ended the wait, unless a second settlement arrives in the few milliseconds before `recordRun`. The scenarios still fail without D-PG5-01, through the model-call count and the hook runs. But the column that is meant to prove "one `agent_settled`" (D-PG5-20, item 1) proves nothing by itself. The same is true of the `strictEqual(..., 1)` in "ten stop blocks separated by tool calls continue".
**Fix:** After the settlement, wait a short quiet period, or wait for a later record such as the next prompt's `agent_start`, before the step counts settlements. Or drop the column and say in the step comment that the model-call and run-start counts carry the proof.

#### IN-04: A start-failure notice is claimed before it is shown, so a notice that fails to show is lost for the rest of the load

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:674-685` and `:694-720` (claim while building) and `:759-781` (`showHookNotices`)
**Issue:** `failureNotices` calls `runtime.claimStartFailureNotice` while it builds the list. `showHookNotices` shows the list in one `try`, so a throw on an earlier notice, or `pi === undefined`, skips the rest. The key is already recorded, so the once-only start failure never shows again in that load. The notice path rarely throws, so the effect is small.
**Fix:** Claim the key after `notifyHookNotice` returns, for example by returning `{ text, claimKey }` and claiming in the show loop. Or record in a comment that the notice is "claimed when built" on purpose.

#### IN-05: `saveHookOutput` has no owner case for a link at the file itself (security audit advisory, HOOKOUTLEAFLINK-01)

**File:** `test/bridges/hooks/hook-output-files.test.ts:62-76`; production `extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts:136-146`
**Issue:** In the background lane, the hook can predict the file name, because its id is the dispatch id in `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH`. The leaf lstat in `assertPathInside` is the only thing between a planted link and the write. `write-file-atomic` resolves the target with `realpath`, so it would write through the link. The guard works (I measured `SymlinkRefusedError` and an unchanged target), but only the generic `path-safety` final-segment case proves it.
**Fix:** Add the case: plant `hook-<id>-additionalContext.txt` as a link to a file outside the root, call `saveHookOutput`, and assert that it rejects with `SymlinkRefusedError` and that the target still holds its old bytes.

#### IN-06: The compatibility page does not state the limits of the sweep (security audit advisory, HOOKOUTSWEEPDOC-01)

**File:** `docs/hooks-compatibility.md:400`; behavior at `extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts:155-176` and `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:1366-1374`
**Issue:**

- The page says, "Each bridge load removes the files in the folder that are older than 30 days."
- The sweep removes only regular files named `hook-<id>-<source>.txt`. It keeps links and sub-folders.
- It skips a project that Pi does not trust.
- It also stops at the first `lstat` or `unlink` error. One file that a parallel Pi process removed while this sweep ran (`ENOENT`) leaves the remaining files in place until the next load, with no debug line, because `ENOENT` is silent.

**Fix:** Name the three limits on the page. In code, catch each file's error inside the loop: skip an `ENOENT` and debug-log other errors. Then one bad entry does not end the sweep.

#### IN-07: Already defended elsewhere: the generation check after the save in `sendAsyncAnswer`, and its "a reload during a save drops the answer" comment

**File:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:638-666`
**Category:** necessity
**Issue:** The comment says that a reload during the save drops the answer through the generation check. In production that check cannot trip. `index.ts:92` builds a new `HooksRuntime` for each factory call, and the comment at `event-router.ts:1126-1128` says that Pi builds a new runtime for every load. So an old load's `entry.capturedGeneration` always equals its own runtime's generation. The answer is in fact dropped because Pi made the old `pi` stale. `sendMessage` then throws through `assertActive()` (`runner.js:488-492`), and the `try` at `:670-681` catches it. The check is a test seam: tests register one runtime twice. It follows the codebase's zombie-defense pattern, so this finding rests on judgment.
**Fix:** Keep the check, but reword the comment: "In production a reload makes the old `pi` stale, so its `sendMessage` throws and the answer is dropped; the generation check covers a runtime that is registered twice." A saved file of such an answer stays until the 30-day sweep removes it.

---

_Reviewed: 2026-11-14T15:47:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
