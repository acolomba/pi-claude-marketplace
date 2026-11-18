# Phase 05: Stop Continuation and Hook Failures - Pattern Map

**Mapped:** 2026-11-14
**Scope:** D-PG5-01..20 (PG-HOOK-02, PG-HOOK-23, PG-HOOK-14, PG-HOOK-21); current tracked source on `features/gaps`, not the saved codebase maps.
**Files classified:** 57 distinct candidate files (a file that two groups touch is counted once; several are conditional). Names marked "(proposed)" do not exist yet and are the planner's to rename. Final plans must count every file.
**Analogs found:** 57 / 57. Most changes land in an existing owner, which is its own analog. Four behaviors have no code to copy (see "No Analog Found").

## File Classification

Paths abbreviated: `S` = `extensions/pi-claude-marketplace`, `H` = `S/bridges/hooks`. A paired owner test replaces `S/` with `test/` and `.ts` with `.test.ts`; every source row below implies its owner test, listed once per group.

### Group 1: `Stop` on `agent_before_settle` (PG-HOOK-02)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `H/settle.ts` | handler factory (Pi event) | event-driven | existing owner: `settleHandlerFor` (`:138-204`), `runStopBucket`, `reenterBounded`, `reenter` | exact |
| `H/event-router.ts` | route (registration) | event-driven | existing owner: the `agent_settled` registration (`:1311-1324`) and `createBeforeAgentStartHandler` (`:270-292`) for a handler that returns a result | exact |
| `H/runtime.ts` | store (per-load state) | event-driven | existing owner: `takeLastAssistant`, `recordRunStart`, `recordStopReentry` (`:329-366`) | exact |
| `S/platform/pi-api.ts` | config (peer type re-export) | transform | existing owner: the `export type { ... }` list (`:55-75`) | exact |
| `H/async-rewake/registry.ts` (`wakeOnExitTwo`) | service | event-driven | existing owner (`:636-661`) | exact |
| `test/bridges/hooks/{settle,event-router,runtime}.test.ts`, `test/bridges/hooks/async-rewake/registry.test.ts` | test | event-driven | existing owners | exact |
| `test/architecture/hooks-lifecycle.test.ts` | test (gate) | event-driven | existing gate (`:385-400`) | exact |

### Group 2: missing script and failure notices (PG-HOOK-23, PG-HOOK-14)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `H/wire-protocol.ts` | utility (pure parser) | transform | existing owner: `exitTwoBlock` (`:122-134`), `plainStdoutResult` (`:95-102`, the per-event rule precedent) | exact |
| `H/on-failure.ts` | utility (predicate) | transform | existing owner: `HookExitFacts`, `isFailure` (`:31-40,73-83`) | exact |
| `H/exec-result.ts` | model (result union) | transform | existing owner: `PostCompactRun` carrier (`:52-55`, `:68`) | exact |
| `H/dispatch-exec.ts` | service (spawn) | request-response | existing owner: outer `catch` (`:219-232`), `endedResult` (`:241-253`), `error` and `close` handlers (`:375-413`) | exact |
| `H/hook-labels.ts` | utility (pure text) | transform | existing owner: `hookErrorText` (`:130-137`), `promptBlockedText` (`:105-111`), `hookSaysText` (`:95-97`) | exact |
| `H/dispatch.ts` | service (fold and notices) | event-driven | existing owner: `hookNotices` (`:640-645`), `showHookNotices` (`:654-676`) | exact |
| `H/settle.ts` (`showStopNotices`) | service | event-driven | existing owner (`:262-279`) | exact |
| `H/event-adapters.ts` | service (adapter) | request-response | existing owner: `notifyIgnoredToolInputRewrite` (`:338-357`), the two `case "stop"` arms (`:388-389`, `:665-667`) | exact |
| `H/tool-batch.ts` (only if the per-pair dedupe lands there) | utility | transform | existing owner; the dedupe call sites are `runEditPreflight` / `runEditResultPairs` in `dispatch.ts` | role-match |
| `H/runtime.ts` (once-only start-failure set) | store | event-driven | `capNotifiedThisSession` latch and `prepareSettleForRegistration` (`:245-263`) | role-match (no once-per-load `Set` exists) |
| `test/bridges/hooks/{wire-protocol,on-failure,exec-result,dispatch-exec,hook-labels,dispatch,event-adapters,tool-batch,runtime,settle}.test.ts` | test | transform | existing owners | exact |

### Group 3: the 10,000-character cap (PG-HOOK-14)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `H/context-cap.ts` (proposed) | utility (pure, injected writer) | transform | `H/async-rewake/async-answer.ts` (pure leaf header) + `H/timeout.ts` (documented pure rule) | role-match; the wrapper text is new |
| `test/bridges/hooks/context-cap.test.ts` (proposed) | test | transform | `test/bridges/hooks/hook-labels.test.ts` (table-driven pure cases) | role-match |
| `H/hook-output-files.ts` (proposed; writer and sweep) | service | file-I/O | `H/async-rewake/pid-table.ts` (`pidTablePath`, `writePidTable`, `unlinkPidTable`) and `reapChildJournals` (`registry.ts:1066-1095`) | role-match |
| `test/bridges/hooks/hook-output-files.test.ts` (proposed) | test | file-I/O | `test/bridges/hooks/async-rewake/pid-table.test.ts` (`:1-67`) | role-match |
| `S/shared/atomic-json.ts` (atomic text write) | utility | file-I/O | existing owner: `atomicWriteJson` (`:27-34`) | exact |
| `test/shared/atomic-json.test.ts` | test | file-I/O | existing owner (`:9-54`) | exact |
| `H/dispatch-exec.ts` (sync call site) | service | request-response | existing owner: `close` handler (`:394-413`), `loc` at `:215` | exact |
| `H/async-rewake/registry.ts` (`sendAsyncAnswer`) | service | event-driven | existing owner (`:602-623`) | exact |
| `H/event-router.ts` (sweep at load) | route | batch | existing owner: the `reapOrphans` loop (`:1126-1137`), `reapProjectOrphans` (`:1193`), `ensureSharedDataDir` (`:876-886`) | exact |

### Group 4: plain `async` with no timer (PG-HOOK-21)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `H/async-rewake/registry.ts` (`spawnAndRegister`) | service | event-driven | existing owner: `laneOf` (`:169-171`), `EXIT_HANDLERS` (`:503-521`), the ladder install (`:327-332`) | exact |
| `H/exec-timer.ts` (only if the inert ladder is exported from it) | utility | event-driven | existing owner: `TimerLadder` (`:108-111`) | exact |
| `H/timeout.ts` (header comment only) | utility | transform | existing owner (`:102-128`) | exact |
| `test/bridges/hooks/{exec-timer,timeout}.test.ts`, `async-rewake/registry.test.ts`, `runtime.test.ts` | test | event-driven | existing owners | exact |

### Group 5: cucumber

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/hook/prompt-and-stop.feature` | test | event-driven | existing feature | exact |
| `features/hook/failures.feature` | test | request-response | its own scenario at `:33-55` | exact |
| `features/hook/messages.feature` | test | request-response | existing feature | exact |
| `features/hook/additional-context.feature` | test | request-response | existing feature | exact |
| `features/hook/async.feature` | test | event-driven | existing feature (`:206`, `:261`, `:342`) | exact |
| `features/plugin/subagent-child.feature` (`:326`) | test | event-driven | existing scenario | exact |
| `features/step_definitions/hook/prompt-and-stop.steps.ts` | test (step module) | event-driven | its own `settledAfter`, `startPrompt`, `recordRun` (`:74-128`, `:192-218`) | exact |
| `features/step_definitions/hook/async.steps.ts` | test (step module) | event-driven | its own polling `When` (`:124-145`) and `waitForHookLifecycle` | exact |
| `features/step_definitions/hook/messages.steps.ts` (only if a new notice `Then` is needed) | test (step module) | request-response | `the hooks show the user these messages:` (`:81-97`) | exact |
| `features/step_definitions/hook/runs.steps.ts` or `prompt-and-stop.steps.ts` (saved-output `Then`) | test (step module) | file-I/O | `features/step_definitions/plugin/installation.steps.ts` staged-files `Then` | role-match |
| `features/step_definitions/plugin/subagent-hooks.steps.ts` | test (step module) | event-driven | its own `promptInStartupSession` (`:191-209`, `:341-346`) | exact |
| `features/lib/run-start-probe.ts` (proposed harness Pi extension) | utility (harness extension) | event-driven | `features/lib/pi-launch-environment.ts` (extension that appends a harness log) and `features/lib/pi-registry-probe/extension.ts` | role-match |
| `features/support/world.ts` | provider (world) | request-response | its own extension list in `startProfilePi` (`:1092-1098`) | exact |
| `features/lib/pi-process.ts` (only if a record helper is added; `trackTurn` itself stays) | utility (driver) | streaming | existing owner (`:348-354`) | exact |
| `features/lib/hook-recorder.ts` (reuse; edit only if a new log constant is exported) | utility | file-I/O | `waitForHookLifecycle` (`:176-198`) | exact |

### Group 6: records

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `docs/hooks-compatibility.md` | documentation | transform | existing rows (`:89`, `:144-150`, `:279-281`, `:328-331`, `:356`, `:363`) | exact |
| `docs/output-catalog.md` (prose at `:5423` only) | documentation | transform | existing `hook-notice` section (`:5415-5423`) | exact |
| `docs/research/issue-103-stop-stopfailure-promotion.md` (dated note) | documentation | transform | existing file (`:11`) | exact |
| `CHANGELOG.md` | documentation | transform | `## [Unreleased]` at `:3`; `.agents/skills/changelog/` | exact |
| `test/live-uat/stop-canary.mjs` | test (operator-run) | event-driven | existing file (header `:1-30`) | exact |
| `test/architecture/hooks-notice-notify.test.ts` (read-only gate; edit only if the catalog block changes, which it must not) | test (gate) | transform | existing gate | exact |

Not edited: `S/shared/notification-dispatch.ts` and `S/shared/notification-resolve.ts` (`notifyHookNotice` and the 2,000-character bound serve every new notice as they are), `rule-packs/architecture.json`, `.fallowrc.json` (unless the proposed harness extension needs nothing there; see the harness section), `S/persistence/locations.ts` (the writer builds its path from `loc.dataRoot`, as every other `_shared/` file does; no new path getter).

## Pattern Assignments

### PG-HOOK-02: the boundary handler in `H/settle.ts`

**Analog:** `settleHandlerFor` in the same file. Copy its three opening guards exactly: generation, mode, cache.

**Imports** (`:23-47`). The new handler adds two type names to the existing `platform/pi-api.ts` type import and nothing else:

```typescript
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { notifyHookNotice, notifyStopHookOverrideCap } from "../../shared/notification-dispatch.ts";
import { openNotificationRun, requireNotificationMode } from "../../shared/notification-run.ts";

import { collectBucketOutcomes, matcherFiresOnClosedSetValue } from "./dispatch.ts";
import { hookSaysText } from "./hook-labels.ts";
import { classifyStopFailure } from "./payloads/stop-failure.ts";
import { STOP_OVERRIDE_CAP, type HooksRuntime } from "./runtime.ts";
```

**Factory signature, generation guard, mode guard, cache read** (`:138-170`):

```typescript
export function settleHandlerFor(
  runtime: HooksRuntime,
  capturedGeneration: number,
  pi: ExtensionAPI,
  executor?: HookExecutor,
): (event: AgentSettledEvent, ctx: ExtensionContext) => Promise<void> {
  return async (_event, ctx) => {
    if (capturedGeneration !== runtime.currentGeneration()) {
      return;
    }

    try {
      requireNotificationMode(ctx.mode);
    } catch (error: unknown) {
      hookDebugLog(`settle: context unavailable: ${errorMessage(error)}`);
      return;
    }

    // One-shot consumption: clear the cache so a spurious second `agent_settled`
    // without an intervening `agent_end` no-ops instead of reprocessing the same
    // (stale) message. ...
    const last = runtime.takeLastAssistant();
    if (last === undefined) {
      return;
    }

    switch (last.stopReason) {
      case "stop": {
        const run = openNotificationRun(pi, { kind: "hook" });
        await runStopBucket(runtime, last, capturedGeneration, ctx, pi, run, executor);
        return;
      }
```

The new factory keeps the four parameters in this order (`executor` last and optional, so the one production call forwards `opts.executor`). Its `case "stop"` arm in `settleHandlerFor` becomes "nothing to do" (RESEARCH Pitfall 2); the exhaustive switch with no `default` arm and the trailing NFR-7 comment (`:186-202`) stay.

**Post-await generation re-check** (`runStopBucket`, `:340-346`). Keep it before any counter change or draft:

```typescript
  // A /reload while the bucket's hooks were running advanced the generation and reset
  // the settle state; bail before any loop-state mutation or re-entry.
  if (capturedGeneration !== runtime.currentGeneration()) {
    return;
  }

  showStopNotices(ctx, run, outcomes);
```

**Decision order to preserve** (`:348-373`): `continue: false` first (`recordStopNonReentry`), then `stopFeedback` through the bounded lane, then the quiet arm (`recordStopNonReentry`). `runStopBucket` returns `Promise<void>` today; it must return the decision (parts and plugin, or nothing) to the boundary handler. It sits near both complexity ceilings: return a value, do not add a branch.

**The bounded lane** (`:456-478`). `reenterBounded` keeps the counter and the cap notice and returns whether to continue; `reenter` (`:486-500`) is deleted, and its literal becomes the draft:

```typescript
function reenterBounded(
  runtime: HooksRuntime,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  run: NotificationRun,
  content: PiTextContentBlock[],
  pluginId: string,
): void {
  const transition = runtime.recordStopReentry();
  if (transition.notifyCap) {
    try {
      notifyStopHookOverrideCap(ctx, run, pluginId, STOP_OVERRIDE_CAP);
    } catch (err: unknown) {
      hookDebugLog(`settle: cap notification failed (${pluginId}): ${errorMessage(err)}`);
    }
  }

  if (!transition.reenter) {
    return;
  }

  reenter(pi, content, pluginId);
}
```

```typescript
      {
        customType: STOP_BLOCK_CUSTOM_TYPE,
        content,
        display: false,
        details: { pluginId },
      },
      { deliverAs: "followUp", triggerTurn: true },
```

The draft adds `type: "custom_message"` and is appended after `event.entries`; the handler returns `{ entries: [...event.entries, draft], continue: true }` or `undefined`, never `continue: false` (RESEARCH "Code Examples: The boundary handler", Anti-Patterns). `stopFeedback` (`:241-254`) is reused unchanged. The file header (`:1-21`) and the `STOP_BLOCK_CUSTOM_TYPE` doc comment (`:49-54`) describe re-entry by follow-up; rewrite both with D-PG5-01.

**Never-throw wrapper.** Two shapes exist; use the first inside the handler and the second around each notice:

```typescript
// event-router.ts:1222-1224 (whole handler body in try/catch)
        } catch (err) {
          hookDebugLog(`session_start skipped: ${errorMessage(err)}`);
        }
```

```typescript
// settle.ts:273-277 (one notice)
    try {
      notifyHookNotice(ctx, run, hookSaysText("Stop", message));
    } catch (error: unknown) {
      hookDebugLog(`settle: Stop notice failed: ${errorMessage(error)}`);
    }
```

Pi also catches a throw from a boundary handler, but scenarios fail on the `extension_error` record (`prompt-and-stop.steps.ts:60-63`, `isFault`).

**Owner test analog:** `test/bridges/hooks/settle.test.ts:1-116`. Hand-built `pi` and `ctx` doubles, a real `createHooksRuntime()`, an injected `HookExecutor`:

```typescript
const settledEvent = { type: "agent_settled" } as unknown as AgentSettledEvent;
const emptyContext = { mode: "print" } as unknown as ExtensionContext;

function makePi(sendError?: Error): { pi: ExtensionAPI; sent: SendCall[] } {
  const sent: SendCall[] = [];
  const pi = {
    getAllTools: () => [],
    getCommands: () => [],
    sendMessage: (message: unknown, options?: unknown): void => {
      if (sendError !== undefined) {
        throw sendError;
      }

      sent.push({
        message: message as Record<string, unknown>,
        options: options as Record<string, unknown> | undefined,
      });
    },
    isIdle: (): boolean => true,
  };
  return { pi: pi as unknown as ExtensionAPI, sent };
}
```

Four cases pin `options: { deliverAs: "followUp", triggerTurn: true }` (`:236`, `:678`, `:738`, `:849`). They become whole-value `deepStrictEqual` on the handler's returned `{ entries, continue }`, with `sent` asserted empty. Add a boundary-event double next to `settledEvent` with a non-empty `entries` array, so "appended after `event.entries`" is a real assertion.

---

### PG-HOOK-02: `H/event-router.ts` registration

**Analog:** the `agent_settled` registration (`:1311-1324`): `bind`, the factory called once per generation, and the child gate in the returned closure.

```typescript
  pi.on(
    "agent_settled",
    bind((generation) => {
      const handler = settleHandlerFor(runtime, generation, pi, opts.executor);
      return (event, ctx) => {
        if (!dispatchesInCurrentSession("Stop") && !dispatchesInCurrentSession("StopFailure")) {
          runtime.takeLastAssistant();
          return Promise.resolve();
        }

        return handler(event, ctx);
      };
    }),
  );
```

The new registration gates on `dispatchesInCurrentSession("Stop")` alone and returns `Promise.resolve(undefined)` in a child. `CHILD_EVENT_POLICY` (`:138-149`) is not edited: `Stop: "SubagentStop"` already keeps `Stop` out of a child (D-PG3-04).

```typescript
function dispatchesInCurrentSession(event: BucketAEvent): boolean {
  return !isSubagentChild(process.env) || CHILD_EVENT_POLICY[event] === "dispatch";
}
```

**Analog for a handler that returns a result to Pi:** `createBeforeAgentStartHandler` (`:270-292`), typed as `(event, ctx) => Promise<Result | undefined>` and returning `Promise.resolve(undefined)` on the empty path.

**Registration order and count.** Place the new `pi.on` between `agent_end` and `agent_settled`. The header comment (`:1044-1057`) says "exactly 12 pi.on call sites" and "11 names ... so 12 calls"; both numbers move. The gate pins the count and the order (`test/architecture/hooks-lifecycle.test.ts:385-400`):

```typescript
  const staleRegistrations = registrations.slice(0, 12);
  const liveRegistrations = registrations.slice(12);
  const registrationOrder = [
    "session_start",
    "session_shutdown",
    "session_before_compact",
    "session_compact",
    "input",
    "tool_call",
    "tool_result",
    "before_agent_start",
    "turn_end",
    "agent_end",
    "agent_settled",
    "input",
  ];
```

`test/bridges/hooks/event-router.test.ts` (`:635`, `:3235`) lists `{ event: "agent_settled", handlerType: "function" }` among the registrations; those lists gain one row. This gate file runs under `npm run test:unpaired`, not under a pair's direct coverage.

---

### PG-HOOK-02: `H/runtime.ts` (cache read and the rewake mark)

**Analog:** the existing operations. Each new operation is one interface member with a doc comment (`:142-150`) and one method on the returned object (`:329-366`):

```typescript
    recordLastAssistant(message: AssistantMessage | undefined): void {
      lastAssistant = message;
    },

    takeLastAssistant(): AssistantMessage | undefined {
      const message = lastAssistant;
      lastAssistant = undefined;
      return message;
    },

    isStopHookActive(): boolean {
      return stopHookActive || runStartedByRewake;
    },
```

```typescript
    recordRunStart(startedByRewake: boolean): void {
      runStartedByRewake = startedByRewake;
    },
```

Two additions: a take that returns the cached message only when its `stopReason` is `"stop"` and leaves any other message for `agent_settled` (RESEARCH Open Question 2), and one operation that sets the D-BG-210 mark when a wake is sent while the `Stop` boundary handler is open (finding F3). Every new cell must be cleared in `prepareSettleForRegistration` (`:258-263`), or a `/reload` leaks it:

```typescript
  function prepareSettleForRegistration(): void {
    lastAssistant = undefined;
    stopHookActive = false;
    runStartedByRewake = false;
    finishStopSequence();
  }
```

The counters (`recordStopReentry`, `recordStopNonReentry`, `recordToolCall`, `recordUserInput`, `STOP_OVERRIDE_CAP`) are not edited (D-PG5-04).

**`wakeOnExitTwo`** (`registry.ts:636-661`) takes `(entry, { ctx, pi, label })` and has no runtime today. Its caller `EXIT_HANDLERS.rewake` (`:507-517`) is reached from `finalizeChild(runtime, ...)`, which has the runtime; thread it through the handler signature rather than reading a module global.

---

### PG-HOOK-02: `S/platform/pi-api.ts`

**Analog:** the type re-export list (`:55-75`), alphabetized, and the local `import type` list below it (`:78-`). Add `AgentBeforeSettleEvent` and `AgentBeforeSettleEventResult` in order:

```typescript
export type {
  AgentEndEvent,
  AgentSettledEvent,
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionAPI,
```

This is the only file that may import the peer (`pi-peer-chokepoint`); `settle.ts` imports the two names from here.

---

### PG-HOOK-23: `H/wire-protocol.ts` and `H/on-failure.ts`

**Analog:** `plainStdoutResult` for a rule that depends on the event, and `exitTwoBlock` for the arm.

```typescript
export function parseHookStdout(
  exitCode: number | null,
  stdout: string,
  stderr: string,
  claudeEvent: BucketAEvent,
): HookExecResult {
  if (exitCode === 2) {
    return exitTwoBlock(stdout, stderr);
  }

  if (exitCode !== 0) {
    return nonZeroExitResult(exitCode, stdout);
  }
```

```typescript
// D-CF5-13: the events on which Claude Code adds plain stdout as context.
const PLAIN_CONTEXT_EVENTS: ReadonlySet<BucketAEvent> = new Set([
  "SessionStart",
  "UserPromptSubmit",
]);
```

Copy the closed-set constant form for the two missing-script events and the D-ID plus version comment form (`D-PG5-08`, `Claude Code 2.1.323`). The predicate is one small function (RESEARCH "Code Examples: The missing-script predicate"); the exit-2 arm calls it before `exitTwoBlock`. `parseHookStdout` is pure and never throws; keep both.

**Second caller.** `async-rewake/async-answer.ts:52` calls `parseHookStdout(0, answer, "", event)`, so the rule cannot reach the background lane (D-PG5-09).

**`isFailure`** (`on-failure.ts:73-83`) returns false for exit 2 today:

```typescript
function isFailure(facts: HookExitFacts): boolean {
  if (facts.startFailed || facts.timedOut) {
    return true;
  }

  if (facts.exitCode !== 0) {
    return facts.exitCode !== 2;
  }

  return isBrokenJson(facts.stdout);
}
```

It takes `HookExitFacts` only, which holds no event. The missing-script arm needs the event: either pass `entry.claudeEvent` (the one caller, `onFailureBlock`, has `entry`) or export one predicate from `wire-protocol.ts` and call it from both modules. One definition only (`fallow dupes`; RESEARCH "Don't Hand-Roll"). `ignoredLane` (`:86-93`) already returns `"Stop"`, so `onFailure` stays ignored there without an edit.

---

### PG-HOOK-14: the failure carrier (`H/exec-result.ts`, `H/dispatch-exec.ts`)

**Analog:** `PostCompactRun` (`exec-result.ts:47-55`): a small readonly interface with a decision-ID doc comment, attached as an optional readonly member on all four arms and set only by the exec layer.

```typescript
export interface PostCompactRun {
  readonly succeeded: boolean;
  readonly output: string;
}
```

```typescript
  | {
      kind: "noop";
      suppressOutput?: boolean;
      additionalContext?: string;
      systemMessage?: string;
      readonly postCompactRun?: PostCompactRun;
    }
```

`exactOptionalPropertyTypes` is on: spread the member conditionally, never assign `undefined`. The file header says the union is "a pure leaf -- no imports"; keep it so.

**Where it is attached** (`dispatch-exec.ts:241-253`). `endedResult` is the one place every sync result passes through, and it already adds a per-event carrier:

```typescript
function endedResult(
  entry: RoutingEntry,
  facts: HookExitFacts,
  answer: HookExecResult,
  failure: HookExecResult | undefined,
): HookExecResult {
  const result = failure ?? answer;
  if (entry.claudeEvent !== "PostCompact") {
    return result;
  }

  return { ...result, postCompactRun: postCompactRunOf(facts, answer, failure !== undefined) };
}
```

`failure !== undefined` is the "an `onFailure` block replaced the answer" signal that D-PG5-10 excludes from the notice. The three fact builders are the outer `catch` (`:219-232`, text `Failed to run: <error>`), the child `error` handler (`:375-392`, the spawn failure text of finding F9), and `close` (`:394-413`). Both start-failure sites already redact:

```typescript
      stderr: redactAbsolutePaths(errorMessage(err)),
```

The comment at `:396` ("EXEC-03: stderr sole-sink through hookDebugLog. NO ctx.ui.notify.") goes stale; rewrite it. `ladder.fired()` (`:407`) is the timeout fact that excludes a timeout from the notice. `spawnAndCollect` is near the complexity ceilings: build the failure in a helper, not inline.

**Read failures from each hook's own result**, never from the folded result (RESEARCH Pitfall 5): `withContext` (`dispatch.ts:332-334`) and the folds rebuild results and drop optional members.

---

### PG-HOOK-14: notice texts in `H/hook-labels.ts`

**Analog:** `hookErrorText` and `promptBlockedText`: a pure exported function, a `/** D-ID: ... */` comment that quotes the exact text, constants for upstream's default strings at the top.

```typescript
// Claude Code's reason for a block that names none: an exit 2 with no stderr,
// and a block or deny decision with no reason.
const NO_STDERR_REASON = "No stderr output";
const NO_DECISION_REASON = "Blocked by hook";
```

```typescript
/**
 * D-CF5-11: the text of a hook error, `<label> hook error: <message>`. The
 * message is `[<command>]: <reason>` for a reason `fromStderr` marks as exit-2
 * stderr, else the reason. A missing reason reads as Claude Code's default.
 */
export function hookErrorText(
  label: string,
  reason: string | undefined,
  command: string,
  fromStderr: boolean,
): string {
  return `${label} hook error: ${blockMessage(reason, command, fromStderr)}`;
}
```

`NO_STDERR_REASON` already holds `No stderr output`; reuse it for the failed-exit text. The file is a leaf ("no Pi and no runtime imports"); the new functions take plain strings. The header (`:1-16`) lists every text the module writes and names `Claude Code 2.1.316`; extend the list and cite `2.1.323` for the new texts. Wording: D-PG5-11 and D-PG5-13, with findings F9 (two start-failure texts, the 200-character cut covers the whole first line, prefix included) and F10 (`Execution stopped by hook`).

**Owner test analog:** `test/bridges/hooks/hook-labels.test.ts:17-45`: one `describe` per export, a table of `{ name, ...inputs, expected }`, a title that cites the decision ID, whole-string `strictEqual`:

```typescript
describe("hookEventLabel", () => {
  for (const { name, claudeEvent, piToolName, label } of [
    {
      name: "an event without a tool by its name",
      claudeEvent: "SessionStart",
      label: "SessionStart",
    },
    ...
  ]) {
    test(`labels ${name} (D-CF5-11)`, () => {
      // act
      const text = hookEventLabel(claudeEvent, piToolName);

      // assert
      assert.strictEqual(text, label);
    });
  }
});
```

---

### PG-HOOK-14: showing notices (`H/dispatch.ts`, `H/settle.ts`, `H/event-adapters.ts`)

**Composite events** (`dispatch.ts:640-676`). Failure notices join `hookNotices` as a third spread, in routing order, built from `folded.outcomes`:

```typescript
function hookNotices(claudeEvent: NoticeEvent, label: string, folded: FoldedBucket): string[] {
  return [
    ...systemMessageNotices(claudeEvent, label, folded.outcomes),
    ...blockNotices(claudeEvent, label, folded),
  ];
}
```

```typescript
function showHookNotices(
  ctx: ExtensionContext,
  pi: ExtensionAPI | undefined,
  notices: readonly string[],
): void {
  if (notices.length === 0) {
    return;
  }

  if (pi === undefined) {
    hookDebugLog(`dispatch: no Pi API to show ${notices.length} hook notice(s)`);
    return;
  }

  try {
    const run = openNotificationRun(pi, { kind: "hook" });
    for (const notice of notices) {
      notifyHookNotice(ctx, run, notice);
    }
  } catch (error: unknown) {
    hookDebugLog(`dispatch: hook notice failed: ${errorMessage(error)}`);
  }
}
```

`NoticeEvent` (`:484`) is `CompositeDispatchEvent | "PostToolUse" | "PostToolUseFailure"`; `SessionEnd` and `PostCompact` must yield no failure notice (D-PG5-10), so the new builder filters by event as `systemMessageNotices` and `blockNotices` do. The label comes from `noticeLabel` (`:1378-1387`); do not concatenate labels at a new site. The per-pair dedupe (D-PG5-12) belongs where the pair runs are folded (`runEditPreflight`, `runEditResultPairs`); `tool-batch.ts` is a pure pair model with no notice code today.

**`Stop`** (`settle.ts:262-279`). `showStopNotices` iterates `outcomes` and shows one notice each inside its own try/catch; add the failure notice and the `Stop hook stopped continuation: <stopReason>` line in the same loop shape. The `continue: false` arm (`:351-359`) only debug-logs the reason today.

**Adapters** (`event-adapters.ts`). The precedent for a notice sent from an adapter:

```typescript
export function notifyIgnoredToolInputRewrite(
  event: ToolCallEvent,
  context: HookAdapterContext,
  category: "shape" | "field" | "value",
): void {
  if (context.pi === undefined) {
    return;
  }

  try {
    const run = openNotificationRun(context.pi, { kind: "hook" });
    notifyHookNotice(
      context.ctx,
      run,
      `PreToolUse:${mapPiToClaudeToolName(event.toolName)} ignored input rewrite (${category})`,
    );
  } catch (error: unknown) {
    hookDebugLog(`adaptToolCall: ignored rewrite notice failed: ${errorMessage(error)}`);
  }
}
```

The two arms that gain a notice:

```typescript
    case "stop":
      return { block: true, reason: result.stopReason ?? DEFAULT_STOP_REASON, terminate: true };
```

```typescript
    case "stop":
      // D-CF5-11: a UserPromptSubmit `continue: false` stops the prompt.
      return { action: "handled" };
```

`DEFAULT_STOP_REASON` (`:279`) is the model-facing block reason and stays (RESEARCH Open Question 5); the notice uses upstream's `Execution stopped by hook`.

---

### PG-HOOK-14: the once-only set (`H/runtime.ts`)

**Analog:** no once-per-load `Set` exists in the hooks bridge. The nearest pieces are the one-shot latch and the per-runtime collections, all closure state of `createHooksRuntime` and none module-global:

```typescript
  let consecutiveBlockCount = 0;
  let capNotifiedThisSession = false;
```

```typescript
    recordStopReentry(): StopReentryTransition {
      if (consecutiveBlockCount === STOP_OVERRIDE_CAP) {
        const notifyCap = !capNotifiedThisSession;
        capNotifiedThisSession = true;
        return { reenter: false, notifyCap };
      }
```

Copy the "test and set in one operation, return whether to show" shape: one runtime operation that takes the key and returns `true` the first time. The key is `` `${event}:${command}` `` (finding F8). Pi builds a new runtime for every load (`event-router.ts:1119-1123`), so the set starts empty per load; also clear it in the registration reset, as the latch is cleared through `finishStopSequence`. The interface doc (`runtime.ts:106-112`) says operations expose values, not containers: do not return the set.

---

### PG-HOOK-14: the cap function (proposed `H/context-cap.ts`)

**Analog:** `H/async-rewake/async-answer.ts` for a pure leaf over untrusted hook output: a header that states the upstream version, the decision ID, and "a pure leaf"; small private helpers; one exported function with a doc comment.

```typescript
// bridges/hooks/async-rewake/async-answer.ts
//
// The answer of a plain `async: true` hook, read as Claude Code 2.1.319 reads
// it when the background process ends: one JSON object from stdout, whose
// `systemMessage` and `hookSpecificOutput.additionalContext` reach the model
// on its next call (D-BG-205). Plain text is never an answer, and the exit
// code and any decision field decide nothing. A pure leaf over untrusted
// hook output.
```

**Injected dependency.** The writer is a required parameter, never a module global (CONVENTIONS "Dependency injection over test-only seams"). The house shapes are the optional `executor?: HookExecutor` last parameter (`settle.ts:142`) and the `pidTableWriter` argument (`registry.ts:418`). Here the writer is required: `(text, source, write) => Promise<string>`. Rule, cut, size label, and failure marker: RESEARCH "Code Examples: The cap" and findings F11 and U6. The function never throws; a rejected `write` yields the truncated head and the marker line.

**Owner test:** table-driven as `hook-labels.test.ts`, with a writer double that records its argument and one that rejects. Cases D-PG5-20 names: exactly 10,000, 10,001, the preview cut at a line break past character 1,000, `11.7KB` for 12,000, the write failure with the whole result at most 10,000.

**Call sites.** Sync: in the `close` handler of `dispatch-exec.ts` (`:401-412`), on the parsed result's `additionalContext`, before `endedResult` and so before any join (`joinedContext`, `dispatch.ts:323-330`; `feedbackTexts`, `settle.ts:228-232`). `loc` is in scope at `:215` and must be passed into `spawnAndCollect`. The `close` callback is synchronous today; the cap is async, so `settle(...)` moves behind an awaited step that must not reject. Background: `sendAsyncAnswer` (`registry.ts:602-623`) loops over `asyncAnswerTexts(...)` and sends each text; it is synchronous and called from `finalizeChild`, and `entry.loc` is on the child entry (`runtime.ts:86`).

---

### PG-HOOK-14: the overflow writer and the sweep (proposed `H/hook-output-files.ts`)

**Analog:** `H/async-rewake/pid-table.ts`: a pure path composer with a hard-coded suffix on `dataRoot`, then `assertPathInside` before each I/O call, then the atomic write.

```typescript
export function pidTablePath(loc: ScopedLocations): string {
  return path.join(loc.dataRoot, "_shared", ASYNC_REWAKE_PIDS_FILENAME);
}
```

```typescript
  const filePath = pidTablePath(loc);
  try {
    await assertPathInside(loc.dataRoot, filePath, "async-rewake-pids.json write");
    const payload: PidTableFile = {
      version: ASYNC_REWAKE_PID_TABLE_VERSION,
      entries: [...entries],
    };
    await atomicWriteJson(filePath, payload);
  } catch (err) {
    hookDebugLog(`async-rewake: pid-table write failed: ${errorMessage(err)}`);
  }
```

Difference to keep in mind: `writePidTable` swallows its error, but the overflow writer must reject, because the cap function turns a rejection into the marker line. The file name holds no plugin-controlled text and needs a unique part (`randomUUID`; hooks of one event run at once). The writer creates its own folder: `ensureSharedDataDir` (`event-router.ts:876-886`) creates `_shared/` only for scopes with `SessionStart` hooks.

**Atomic text write** (`S/shared/atomic-json.ts:27-34`). Add a sibling export in this file; it is already exempt from `write-file-atomic-chokepoint`, so the rule pack is not edited:

```typescript
export async function atomicWriteJson(filePath: string, value: unknown): Promise<Buffer> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8");
  // fsync defaults to true (NFR-1 durability) -- not specified to keep the
  // intent self-evident at the call site.
  await writeFileAtomic(filePath, bytes);
  return bytes;
}
```

The doc comment says "Used ONLY for JSON files that participate in `withStateGuard`"; the text form needs its own comment and the existing one a correction. Test analog (`test/shared/atomic-json.test.ts:9-22`): real temp dir, `t.after` cleanup, whole-bytes comparison:

```typescript
test("writes two-space JSON with one trailing newline", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(os.tmpdir(), "atomic-json-shape-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "out.json");
```

**Sweep analog:** `reapChildJournals` (`registry.ts:1066-1095`): containment check on the folder, `opendir`, regular files with a strict name pattern only, ENOENT silent, any other error one debug line, never throws.

```typescript
  const dirPath = path.join(loc.dataRoot, "_shared", "async-rewake-children");
  try {
    await assertPathInside(loc.dataRoot, dirPath, "child journal scan");
    const dir = await opendir(dirPath);
    let scanned = 0;
    for await (const entry of dir) {
      if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/.test(entry.name)) {
        continue;
      }
```

```typescript
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      hookDebugLog("async-rewake: child journal scan unavailable");
    }
  }
```

The 30-day age test has no analog (see "No Analog Found"). Use `lstat` and never follow a link (RESEARCH Security Domain). Removal analog: `unlinkPidTable` (`pid-table.ts:163-175`).

**Sweep call sites** (`event-router.ts`). Once per hydrated scope beside the reap, and once for the project scope after the lazy hydrate:

```typescript
  for (const { loc } of hydrated) {
    rebuildRoutingTablesWith(routingState);
    ...
    // eslint-disable-next-line no-await-in-loop -- at most two scopes, one PID-table reap each
    await reapOrphans(runtime, loc);
  }
```

```typescript
            // D-BG-207: inside the try, so a context the hydrate could not
            // read skips the reap too and never blocks SessionStart.
            await reapProjectOrphans(runtime, ctx.cwd);
```

A second `await` in that loop needs its own reasoned `no-await-in-loop` disable.

**Writer test analog:** `test/bridges/hooks/async-rewake/pid-table.test.ts:16-27,59-67`: `locationsFor("project", root)` over a temp root, and debug lines captured by turning the debug variable on and mocking `console.error`:

```typescript
async function allocateProjectScope(t: TestContext, prefix: string) {
  const root = await allocateRoot(t, prefix);

  return { root, locations: locationsFor("project", root) };
}
```

```typescript
function recordHookDiagnostics(t: TestContext): string[] {
  setCaseEnvironment(t, "PI_CLAUDE_MARKETPLACE_DEBUG", "1");
  const diagnostics: string[] = [];
  t.mock.method(console, "error", (...parts: unknown[]): void => {
    diagnostics.push(parts.map(String).join(" "));
  });

  return diagnostics;
}
```

Use the project scope with a temp root. A user-scope `locationsFor` resolves the agent dir, so it needs the hermetic home; never the real `~/.pi/agent`.

---

### PG-HOOK-21: `H/async-rewake/registry.ts`

**Analog:** the lane model already in the file. `laneOf` (`:169-171`) decides, `exit.lane` carries it (`:265-270`), and `EXIT_HANDLERS` (`:503-521`) is a `Record<BackgroundLane, ...>`:

```typescript
type BackgroundLane = "rewake" | "plain";

function laneOf(entry: RoutingEntry): BackgroundLane {
  return entry.handlerDecl.asyncRewake === true ? "rewake" : "plain";
}
```

**The one ladder install** (`:274-281`, `:327-332`):

```typescript
    const timeoutSeconds = resolveTimeoutSeconds({
      raw: entry.handlerDecl.timeout,
      event: entry.claudeEvent,
      pluginId: entry.pluginId,
      // This lane returns as soon as the child is registered, so upstream's
      // turn-blocking reductions do not apply -- see ../timeout.ts.
      lane: "background",
    });
```

```typescript
    const hookProcess = asGroupLeader(child, deps);
    const ladder = installTimerLadder(
      hookProcess,
      timeoutSeconds,
      `${entry.pluginId}/${entry.claudeEvent}`,
    );
```

The plain lane gets an inert ladder that satisfies the type, so `HooksRuntimeChildEntry.ladder` (`runtime.ts:82`) and both `cancel()` sites (`runtime.ts:467`, `registry.ts:485`) stay as they are:

```typescript
export interface TimerLadder {
  cancel(): void;
  fired(): boolean;
}
```

`spawnAndRegister` (`:238-425`) is near both complexity ceilings; move the lane choice into a small function. `resolveTimeoutSeconds` logs a debug line only for an unusable declared value (`timeout.ts:145-150`); the "declared `timeout` is ignored" line of D-PG5-17 is a new `hookDebugLog` in the plain branch, in the file's message style:

```typescript
      hookDebugLog(
        `async-rewake: spawn threw (${entry.pluginId}/${entry.claudeEvent}): ${errorMessage(err)}`,
      );
```

Line `:400` carries a reviewed `fallow-ignore-next-line code-duplication` marker. If an edit moves or changes the marked span: delete the marker, run `npx fallow dupes`, check `$?`, and restore it only above a line the reviewed group still spans. `finalizeChild` (`:523-`) and the PID-table code are not edited (ASYNCRELOADTABLE-01).

**`H/timeout.ts`:** comment only. The paragraph at `:110-116` says a `background` handler "keeps the 600 s `command` default on every event"; that holds for `asyncRewake` only after D-PG5-17.

---

### Cucumber: features, steps, harness

Read `.agents/skills/cucumber/rules/{layout,features,steps,world-and-stand-ins}.md` before writing. `layout.md` gives each file under `features/lib/`, `features/support/`, and each topic step module one owner, so the plans that touch them run in sequence.

**Step module conventions** (`.agents/skills/cucumber/rules/steps.md`), each of which a new step must meet:

- The module starts with an `@fileoverview` that says what its steps own, and exports nothing.
- Registrations are ordered `Given`, `When`, `Then`.
- A step that touches the world is an anonymous `function (this: ScenarioWorld, ...)`; one that does not is an arrow.
- Step text is a string literal Cucumber expression (`{string}`, `{int}`, `{word}`), never a regular expression, and never holds a run token.
- A `Then` compares whole values: project the actual value to rows of strings, header included, and `deepStrictEqual` against `table.raw()`. No `assert.ok(x.includes(...))`.
- A `Then` that compares the whole of what a turn reports calls `this.markTurnCompared()`.
- A step never sleeps for a fixed time; it waits on a record or a file until a named deadline.
- Every step text matches exactly one definition and every definition is used (`npm run check:features`).
- A new step names its topic in its text. No exception is caught to be logged.
- These scenarios have no MCP surface: no implementation tag, adapter profile only.

**The settle waits to replace** (`prompt-and-stop.steps.ts:192-218`). Both encode one `agent_settled` per block:

```typescript
When(
  "the user prompts {string} and the stop hooks send the turn back",
  async function (this: ScenarioWorld, text: string) {
    const deadline = Date.now() + REENTERED_TURNS_DEADLINE_MS;
    const prompt = expandTokens(text, this.tokens);
    const { lengths, from } = await startPrompt(this, prompt);
    await settledAfter(this, await settledAfter(this, from, deadline), deadline);
    await recordRun(this, prompt, lengths, from);
  },
);
```

Keep the helpers and change the count: `startPrompt` (`:86-95`), `settledAfter` (`:77-81`), `checkedRun` and `recordRun` (`:107-128`) already give "send, wait for one settle before a deadline, assert no fault and no call past the script, keep the turn":

```typescript
async function settledAfter(world: ScenarioWorld, from: number, deadline: number): Promise<number> {
  const settled = await world.pi.waitForRecord(from, isSettled, deadline - Date.now());
  assert.strictEqual(settled.aborted, false, JSON.stringify(settled));
  return from + world.pi.recordsSince(from).indexOf(settled) + 1;
}
```

The `@fileoverview` (`:6-11`) explains the second-settle wait and must be rewritten. The same change in `subagent-hooks.steps.ts`: `promptInStartupSession(this, text, 2)` (`:341-346`) and its comment (`:339-340`); the helper loops `settlements` times (`:201-209`). The handler move and these step changes land in one plan (RESEARCH Pitfall 4); the commit hook runs no cucumber.

**Counting settles and run starts.** The settle count reads the turn's records (`records.filter(isSettled)`). Run starts must come from `before_agent_start`, never from `agent_start` records (finding F1). `features/lib/pi-process.ts:348-354` (`trackTurn`) uses `agent_start` only for idleness and stays as it is.

**The harness Pi extension (proposed `features/lib/run-start-probe.ts`).** Analog: `features/lib/pi-launch-environment.ts`, the one harness extension that appends to a harness log. Copy four things: the exported path constant, the log-file constant, the reader, and the default export with its marker.

```typescript
/** The absolute path of this file, which a profile Pi loads as an extension. */
export const PI_LAUNCH_ENVIRONMENT_EXTENSION = fileURLToPath(import.meta.url);
```

```typescript
// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function launchEnvironment(): void {
  const home = process.env.HOME;
  if (home === undefined || home === "") {
    throw new Error("the launch environment needs HOME to find its file");
  }

  const variables = parseVariables(readFileSync(path.join(home, VARIABLES_FILE), "utf8"));
  Object.assign(process.env, variables);
  appendFileSync(path.join(harnessDirectory(home), LOG_FILE), `${JSON.stringify(variables)}\n`);
}
```

The second analog, `features/lib/pi-registry-probe/extension.ts:13-45`, shows a default export that takes `pi: ExtensionAPI` (imported as a type from `@earendil-works/pi-coding-agent`; harness code under `features/` is outside the extension's `pi-peer-chokepoint` rule) with the same marker line. The new extension registers `pi.on("before_agent_start", ...)` and appends one JSON line per event with `appendFileSync` to `<harness dir>/<name>.jsonl`, where `harnessDirectory(home)` comes from `features/lib/turn-records.ts:28`.

**How the world loads it** (`features/support/world.ts:1092-1098`). Two routes exist; pick one:

```typescript
    const pi = await PiProcess.start(sandbox, profileGitEnvironment(launch), {
      extensions: [
        SCRIPTED_MODEL_EXTENSION,
        REGISTRY_PROBE_EXTENSION,
        ...companions.map((companion) => companion.entry),
        ...(launch.extraExtensions ?? []),
      ],
```

Route A: add the constant to this fixed list, so every profile Pi loads it and every turn's logs gain the lines. Route B: a `Given` passes it through `extraExtensions`, as `features/step_definitions/hook/tool-use.steps.ts:96` does with `HOOK_RESULT_OBSERVER_EXTENSION`; only the scenarios that count run starts load it. Route B changes no other scenario's logs; route A needs no new `Given`.

**How a harness log is read.** A `.jsonl` file in the harness directory is picked up by name, with no registration: `startPrompt` snapshots `readLogLengths(world.profileHarness())`, and `checkedRun` reads `readLogLinesSince(...)` into `turn.logs`, a map keyed by file name. A step then reads its own file:

```typescript
function stopRunRows(turn: ModelTurn): (readonly [string, unknown, unknown])[] {
  const runs = (turn.logs.get(HOOK_RUNS_LOG) ?? []) as readonly HookRun[];
```

Export the log name as a constant from the new lib file, as `HOOK_RUNS_LOG` is exported from `hook-recorder.ts:35`.

**Gates on the new harness file.** It adds one `fallow-ignore-next-line unused-export` marker, so the count of markers in `.planning/codebase/CONVENTIONS.md` (49) goes stale; every marker carries a `--` justification. Do not add a planted-violation test for it.

**Waiting for a background hook's end** (PG-HOOK-21). Reuse `waitForHookLifecycle(harness, hook, "end", lengths, timeoutMs)` (`features/lib/hook-recorder.ts:176-198`); the `end` line carries the exit code. Shape analog for the `When` (`async.steps.ts:124-145`): prompt to settle, then poll the logs to a named deadline, then keep the turn. No `delay(` with a fixed wait in a new step.

**Notice assertions.** Existing steps cover every notice scenario; a new notice needs no new step:

```typescript
Then("the hooks show the user these messages:", function (this: ScenarioWorld, table: DataTable) {
  const [header = [], ...rows] = table.raw();
  assert.deepStrictEqual(header, NOTICE_COLUMNS);
  assert.deepStrictEqual(
    turnPayloads(this, "hook-notice"),
    rows.map((row) => statedNotice(row)),
  );
  this.markTurnCompared();
});
```

A start-failure text differs by Node version (RESEARCH Pitfall 6); the scenarios of D-PG5-20 avoid it by using an exit code and a fixed stderr.

**`features/hook/failures.feature:33-55`.** The scenario ends with `Then the hooks show the user no messages`; it becomes the criterion-3 scenario with the notice table. Its hooks table is the fixture pattern for every new failure scenario:

```gherkin
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event            | matcher | form   | exit code | stderr |
      | guard | UserPromptSubmit |         | script | 1         | boom   |
```

Fixture rows for each criterion: RESEARCH "Scenario seeds". Use a script hook with `exit code` 2 and an interpreter's stderr line for the missing script; never `sh <missing file>` (Pitfall 7).

**Saved-output `Then`** (criterion 4). No step reads a path out of a model message today. Compose from the token projection of `messages.steps.ts:69-78` and a whole-value comparison; state in the step text that it checks the file's length and the length of the text the model received.

---

### Records

**`docs/hooks-compatibility.md`.** Rows are four-column tables with `✓` / `⚠` / `✗` and notes that end with the decision ID. The rows to change, as they read now:

```markdown
| `Stop`                                  | ✓           | ✓   | full decision control; see the turn-boundary timing shift below |
| `timeout`                                  | ✓           | ⚠   | value in **seconds**; per-handler override; default 600 s, ... (async hooks keep 600 s everywhere); ... |
| `async`                                    | ✓           | ⚠   | runs in the background and never blocks its event; ... (D-BG-205) |
| Other exit -> non-blocking, stderr to user | ✓           | ⚠   | ... The bridge does not show the stderr to the user |
| Large stdout or stderr                     | ✓           | ✓   | no size limit, as upstream: ... |
| `Stop`                                     | as a `Stop hook feedback:\n<text>` part of the Stop re-entry message (D-CF5-25) |
```

Anchors on this tree: `:89`, `:144` ("Turn-boundary timing shift"), `:279-281`, `:328-331`, `:356`, `:363` ("Messages to the user"). Find each by heading or row text, not by number. Markdown is formatted by mdformat, which re-pads table columns.

**`docs/output-catalog.md`.** Only the prose paragraph at `:5423` changes. The fenced block is byte-locked:

```markdown
### Hook notice (HOOK-05 / D-CF5-14 / D-CF5-24)

<!-- catalog-state: hook-notice -->

```text
UserPromptSubmit says: remember the tests
```
```

`test/architecture/hooks-notice-notify.test.ts:41-55` reads that block with `readCatalogBlock("hook-notice")` and compares one `notifyHookNotice` call to it. Do not add a second `<!-- catalog-state: ... -->` block: it moves `EXPECTED_STATE_COUNT` and `EXPECTED_UTF8_BYTES` in `test/architecture/catalog-uat/catalog-contract.test.ts:21-22`.

**`CHANGELOG.md`.** `## [Unreleased]` at `:3` holds one aggregate bullet with indented sub-bullets; add reader-facing lines there per `.agents/skills/changelog/`.

**`test/live-uat/stop-canary.mjs`.** Header claim 2 (`:21-24`) asserts a second `turn_start` from `sendMessage(followUp + triggerTurn)`. Update its expectations or delete the file and name the cucumber scenario as the replacement (RESEARCH Open Question 6). The file carries a `fallow-ignore-file unused-file` marker (`:6`) and shares a reviewed clone with `manifest-absence-canary.mjs`; deleting it changes the marker count and may leave the sibling's `code-duplication` marker with nothing to span.

## Shared Patterns

### A Pi event handler never throws (NFR-2)

**Sources:** `H/settle.ts:149-154`, `:273-277`; `H/event-router.ts:1222-1224`; `H/dispatch.ts:668-675`.
**Apply to:** the boundary handler, every new notice site, the cap call sites, the sweep.

```typescript
    try {
      requireNotificationMode(ctx.mode);
    } catch (error: unknown) {
      hookDebugLog(`settle: context unavailable: ${errorMessage(error)}`);
      return;
    }
```

Failures go to `hookDebugLog(message)` with a `<module>: <what> (<plugin>/<event>): <error>` text and `errorMessage(err)` from `shared/errors.ts`.

### Generation guard

**Sources:** `H/settle.ts:115-117`, `:145-147`, `:342-344`; `bind` / `bindWithMode` at the registrations.
**Apply to:** the boundary handler, at entry and again after the bucket's `await`.

```typescript
    if (capturedGeneration !== runtime.currentGeneration()) {
      return;
    }
```

### One output channel (IL-2)

**Source:** `shared/notification-dispatch.ts` `notifyHookNotice`, reached through `openNotificationRun(pi, { kind: "hook" })`.
**Apply to:** every new notice. No `ctx.ui.notify` (`notify-chokepoint`), no `console.*` (`no-console`), no stdio (`no-stdio`). The 2,000-character bound and the escape filter of `terminalSafeHookNotice` apply without a call from the bridge.

### Containment before I/O (NFR-10) and atomic writes (NFR-1)

**Sources:** `H/async-rewake/pid-table.ts:98-100,146-153`; `H/hook-env.ts:98-99`; `H/event-router.ts:876-880`.
**Apply to:** the overflow writer and the sweep.

```typescript
    const envFile = path.join(loc.dataRoot, "_shared", `claude-env-${transCtx.sessionId}.env`);
    await assertPathInside(loc.dataRoot, envFile, "CLAUDE_ENV_FILE");
```

`assertPathInside(root, candidate, label)` from `shared/path-safety.ts`; the write goes through `shared/atomic-json.ts`.

### State lives in the runtime, dependencies are parameters

**Sources:** `H/runtime.ts:106-112` (interface contract), `:245-263` (closure cells and the registration reset); `settle.ts:142` (`executor?`).
**Apply to:** the cache read, the rewake mark, the once-only set, the overflow writer. No module-level mutable state and no `_setXForTest` seam.

### Gates that constrain every new or changed file

| Gate | What it requires here |
|---|---|
| Source-test pairing (`npm run test:corresponding`) | Each new source under `S/` ships its owner test at the mirrored path in the same commit: `H/context-cap.ts` with `test/bridges/hooks/context-cap.test.ts`, and so on. |
| Direct coverage (`npm run test:coverage:direct -- <path>`) | 100% for each pair, the new arms included. A branch the compiler forces but no input reaches is not removable with `!` or `as`. |
| Boundary zones (`.fallowrc.json`) | `bridges-hooks` may import `domain`, `persistence`, `shared`, `platform` only. No import from another bridge kind, from `orchestrators`, or from `edge`. `shared/atomic-json.ts` imports nothing internal. |
| `write-file-atomic-chokepoint` | Exempt files are `shared/atomic-json.ts`, `bridges/mcp/stage.ts`, `orchestrators/plugin/prune-rollback.ts` (`rule-packs/architecture.json:133-143`). The text write lands in `shared/atomic-json.ts`; no bridge file imports `write-file-atomic`. The saved codebase maps also name `bridges/agents/stage.ts`; the rule pack does not. |
| `child-process-chokepoint` | `dispatch-exec.ts` and `async-rewake/registry.ts` are two of the five exempt spawn sites; no new file spawns. |
| `notify-chokepoint`, `no-console`, `no-stdio`, `pi-peer-chokepoint` | As under "One output channel"; the peer types come from `platform/pi-api.ts`. |
| ESLint BLOCK C and BLOCK F | Both cover `orchestrators/` and `domain/` ledgers and network seams; no file of this phase is in their scope. `no-await-in-loop` applies to all of `S/` and needs a reasoned disable. |
| Complexity (ESLint 15; fallow 15 / 20, computed separately) | `spawnAndCollect`, `spawnAndRegister`, `runStopBucket`, and the `dispatch.ts` folds are near the ceilings: each new rule is its own small function. |
| `fallow dupes` | One definition of the missing-script predicate, the cap, and each notice text. Check `$?`, not the glyph. |
| `fallow-ignore` markers | `registry.ts:400` (reviewed clone) and `stop-canary.mjs:6` are in touched files; the harness extension adds one `unused-export` marker with a `--` reason. No marker in a file to silence a new clone without review. |
| Gate tests under `test/architecture/` | `hooks-lifecycle.test.ts` (registration count and order), `hooks-notice-notify.test.ts` and `catalog-uat/catalog-contract.test.ts` (catalog bytes). A gate file may not name an unregistered production path. |

### Imports, comments, tests

- Import order (`import-x/order`): `node:` builtins, externals, internal values, then `import type` last; groups separated by a blank line and alphabetized. Tests import production modules by relative path with the `.ts` extension (`test/bridges/hooks/settle.test.ts:1-27`).
- Comments and test titles cite `D-PG5-NN`, `PG-HOOK-NN`, and the Claude Code version read (`2.1.323`); never a phase, plan, or wave number. No comment on trivial code.
- `node:test` with `node:assert/strict`; `// arrange`, `// act`, `// assert`; whole-value `deepStrictEqual` or whole-string `strictEqual`.
- Filesystem cases use real temp dirs with `t.after` cleanup, or `locationsFor("project", <temp root>)`. Never the real `~/.pi/agent`.
- Owner test command: `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test-path>`.

## No Analog Found

| Behavior / proposed file | Role | Data Flow | Reason |
|---|---|---|---|
| A boundary result with `entries` and `continue` | handler | event-driven | No handler in the bridge returns a `custom_message` draft or asks Pi to continue; `createBeforeAgentStartHandler` only shows a handler that returns a result. Use RESEARCH "Code Examples: The boundary handler" and the Pi types at `dist/core/extensions/types.d.ts:771-822`. |
| The `<persisted-output>` wrapper, the preview cut, the size label | utility | transform | No code caps a model-bound string. Use RESEARCH "Code Examples: The cap" and record U6. |
| An age-based sweep (30 days) | service | batch | Every existing reap is keyed by PID or journal row, not by file age. `reapChildJournals` supplies the scan shape only. |
| A once-per-load keyed set | store | event-driven | Only a boolean latch exists (`capNotifiedThisSession`). Compose from the latch shape and the runtime's closure collections. |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{bridges/hooks,bridges/hooks/async-rewake,shared,platform,persistence}`, their `test/` pairs, `test/architecture/`, `features/{hook,plugin}`, `features/step_definitions/{hook,plugin}`, `features/lib/`, `features/support/world.ts`, `.agents/skills/cucumber/`, `rule-packs/architecture.json`, `.fallowrc.json`, `docs/`.
**Files scanned:** 34 (targeted line ranges; `settle.ts`, `hook-labels.ts`, `async-answer.ts`, and `atomic-json.ts` were read whole or nearly so).
**Tracked-source gate:** `features/lib/pi-launch-environment.ts`, `features/lib/pi-registry-probe/extension.ts`, `test/live-uat/stop-canary.mjs`, and `bridges/hooks/async-rewake/pid-table.ts` were checked with `git ls-files` and are tracked. The other analogs are files RESEARCH cites from the same tree and were read from the working tree, which was clean; they were not each passed through `git ls-files`. The Pi sources under `node_modules/` are evidence only and never an analog or an edit target.
**Line numbers:** read from the working tree on 2026-11-14 at commit `50caa4ab`. `event-router.ts`, `dispatch.ts`, and `registry.ts` are large; re-locate by symbol before editing.
**Not verified here:** whether `npm run test:corresponding` also pairs files under `features/lib/` (the proposed harness extension may need a test under `test/architecture/`, as `terminalScreen` has); the bodies of `runEditPreflight` and `runEditResultPairs` in `dispatch.ts`, where the per-pair dedupe lands, were not read; `test/bridges/hooks/event-router.test.ts`, `dispatch.test.ts`, `runtime.test.ts`, and `async-rewake/registry.test.ts` were located through RESEARCH, not opened; the feature files other than `failures.feature:33-55` were not opened. No check was run and no source was changed.
**Pattern extraction date:** 2026-11-14
