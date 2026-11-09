# Phase 2: Async Hooks - Research

**Researched:** 2026-11-08
**Domain:** Pi extension hook bridge (background hook processes, Pi 1.5.0 message lanes, cucumber harness synchronization)
**Confidence:** HIGH (code paths read this session; two red-today claims measured with a probe run)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Upstream evidence (Claude Code 2.1.319)

Read from the binary `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude` on 2026-11-08 (`LC_ALL=C /usr/bin/grep -oa` and a Python byte search; the registry function is `Tlt`, the plain-async registry `cYt`/`Oqo`/`Iqo`, the notification queue `LTn`, the attachment builder `gqr`). High confidence: these are the code paths, not prose.

- **Background or not.** A command hook runs in the background when `async === true`, or when `asyncRewake === true` and the session is interactive or takes streaming input (`N0`: `e.async===!0||e.asyncRewake===!0&&(!ye()||eWt())`; `ye()` is "not interactive", `eWt()` is "has streaming input"). The schema says `asyncRewake` "implies async". Neither kind ever blocks or delays its event.
- **asyncRewake exit 2.** When the background process ends with code 2, Claude Code calls `LTn({summary, body, priority: "next", stopHookActive: true})`. It queues a `task-notification` with no `shouldQuery: false`, so an idle session wakes: the model gets a new turn with no user prompt. A running turn drains a `next` notification at its next tool boundary. The body is `${rewakeMessage ?? `Stop hook blocking error from command "${hookName}":`} ${stderr || stdout}`: one space between the prefix and the output, the whole stderr when it is not empty, else the whole stdout, and an empty output still wakes the model with the prefix alone. `hookName` is the hook's label as Claude Code names it (`UserPromptSubmit`, `PreToolUse:Bash`, `SessionStart:startup`, `Stop`), which this project already reproduces as the D-CF5-11/D-CF5-14 label (`bridges/hooks/hook-labels.ts`).
- **asyncRewake, what the user sees.** The user sees the notification's summary only on exit 2: `rewakeSummary`, else the literal `Stop hook feedback`. On any other exit, nothing reaches the model and nothing reaches the user (only a hook-response event that the terminal shows in verbose or transcript mode). A plugin from an official marketplace may override the summary with a `rewakeSummary` field of a JSON line on stdout (`Z2(pluginId)`).
- **Plain `async: true`.** The process runs in the background with no rewake. When it ends, Claude Code reads one JSON answer from its stdout (exit code aside) and holds it. The next model call, whenever a query runs, gets an `async_hook_response` attachment: its `systemMessage` and its `hookSpecificOutput.additionalContext` each reach the model as a hidden meta message, in that order. It never wakes the model. Plain stdout is context only for hooks marked `plainOutputIsContext` (a Symbol Claude Code sets on its own hooks), not for a plugin's declared async hook. The user sees the response only in verbose or transcript mode. Its exit code decides nothing.
- **Stop.** Nothing excludes Stop: the default texts (`Stop hook blocking error from command`, `Stop hook feedback`) show that a Stop hook is the main user of `asyncRewake`.
- **Process end.** Claude Code leaves a plain async process running when it exits (`atExit: "leave"`). It has no `/reload` and no orphan reap; this project's `/reload` kill and crash reap are its own decisions (D-62-05) and stay.

#### Exit-2 rewake (ASYNC-01) — D-BG-201, D-BG-202, D-BG-203

- **D-BG-201 — an exit 2 wakes the model.** When an `asyncRewake` hook exits 2 and Pi is idle, the bridge sends the rewake message with `triggerTurn: true`, so Pi starts a turn with it and no user prompt, as Claude Code wakes an idle session. When Pi is running a turn, the bridge sends it as a `steer`, which Pi reads at the next turn boundary, as Claude Code drains a `next`-priority notification at the next tool boundary. This replaces `nextTurn` (which waited for the user's next prompt) and `followUp`. The message stays model-only (`display: false`, custom type `claude-hook-rewake`). The seed "An async rewake hook that exits 2 puts its message into the model's next call" changes to the woken turn.
- **D-BG-202 — the rewake text is Claude Code's.** The message is `<prefix> <output>`: the prefix is `rewakeMessage`, else `Stop hook blocking error from command "<label>":`, where `<label>` is the hook's D-CF5-14 label; the output is the whole stderr when it is not empty, else the whole stdout; one space joins them; an exit 2 with no output still wakes the model with the prefix and the space. The label is derived from the Claude-shaped stdin payload the registry already builds (its event name, and its `tool_name`, `source`, `reason`, or `trigger` where the event's matcher selects on one), because `registry.ts` cannot import `dispatch.ts` without a cycle.
- **D-BG-203 — a woken turn is a Stop re-entry for `stop_hook_active`.** Claude Code queues the rewake with `stopHookActive: true`, so a Stop hook that ends the woken turn sees `stop_hook_active: true` and can let it end. The bridge marks the runtime's Stop flag when it wakes the model, through a new runtime function (an additive change to `runtime.ts`), and the flag clears on the user's next input, as a Stop re-entry's does. It does not count toward the STOP-07 re-entry cap.

#### What the user sees (ASYNC-02) — D-BG-204

- **D-BG-204 — the summary shows only on exit 2, and it has a default.** On exit 2 the user sees `rewakeSummary`, else `Stop hook feedback`, through the existing `async-rewake-summary` notification kind. On any other exit the user sees nothing and the model gets nothing. ASYNC-02 was drafted from the v1.13 HOOK-06 criterion 3 ("if `rewakeSummary` is set the bridge surfaces it at process exit"), which misread upstream; this phase rewords ASYNC-02 and its own success criterion 2 to Claude Code's behavior, under the milestone's upstream-parity rule. The shared release steps wait for a summary, so they now release only a hook that exits 2; a scenario that releases a hook ending any other way uses a step of `hook/async.steps.ts`.

#### Plain async and never blocking (ASYNC-03, ASYNC-05) — D-BG-205, D-BG-206

- **D-BG-205 — plain `async: true` runs in the background.** Today `dispatch-exec.ts` sends only `asyncRewake === true` to the registry, so a plain async hook runs synchronously and its exit 2 or decision blocks its event: a bug. A hook with `async === true` (and no `asyncRewake`) goes through the same registry (spawn, PID table, timeout ladder, `/reload` kill, crash reap), never blocks or delays its event, and its exit code and decision fields decide nothing. When it ends, the bridge reads one JSON answer from its stdout (the whole trimmed stdout when it is one object, else the first line that is a JSON object and not an `{"async": ...}` line); its non-empty string `systemMessage` and `hookSpecificOutput.additionalContext` each go to the model as a model-only custom message, `systemMessage` first, with `deliverAs: "nextTurn"`, so the model reads them on its next call and is never woken. Plain stdout is ignored. The user sees nothing, and no rewake summary shows.
- **D-BG-206 — Stop and StopFailure async hooks run in the background too.** `collectBucketOutcomes` (`dispatch.ts`) drops an `asyncRewake` hook on the settle path today, and runs a plain async one synchronously. Both now go to the executor, whose async branch spawns them in the background and folds `noop`, so an `asyncRewake` Stop hook that exits 2 wakes the model with the `Stop` label. The `docs/hooks-compatibility.md` "Silent drop" bullet for `asyncRewake` on `Stop`/`StopFailure` goes.
- ASYNC-03 is covered for a prompt (the Phase 1 seed) and for a `PreToolUse` tool call: the tool result and the reply arrive while the hook still runs.

#### Hook processes after a reload or a crash (ASYNC-04) — D-BG-207

- **D-BG-207 — the project scope's orphans are reaped at the project hydrate.** `index.ts` registers the hooks bridge with `{ cwd: homedir() }`, so the factory-time reap reads the home directory's project PID table, and the project hydrate does not reap: a dead Pi's project-scope hook processes survive the next start (P1-DC-40). The project hydrate (`hydrateProjectScopeForCwdWith` in `event-router.ts`, run at session start and at the load) reaps the project scope's PID table for the session's real `cwd`, after its trust check (a project Pi does not trust runs no hooks, D-LOC-01). Because that hydrate also runs on every new session of a live Pi, the reap (`reapOrphans` in `registry.ts`) skips the rows of children this Pi process still owns (its runtime's in-memory children) and writes their rows back instead of unlinking the table. `index.ts` (a load-path shared file) is not changed. `/reload` already kills every child of both scopes through the in-memory walk.
- The Phase 1 crash seed stays in the user scope; this phase adds the project-scope crash scenario, which is red today, and a project-scope reload scenario.

#### Scenarios and steps — D-BG-208

- **D-BG-208 — test design.** Every new scenario has no MCP surface, so it carries no implementation tag and runs once, under `adapter` (D-BG-04). Each fails without the behavior it names, with the red proof in its plan SUMMARY. The phase's own steps live in `features/step_definitions/hook/async.steps.ts`; it adds no file under `features/support/` or `features/lib/`, and edits no shared or topic step module. Its synchronization points are signals Pi or the harness gives, never a fixed sleep: the rewake summary record, the woken run's `agent_settled`, the hook's lifecycle `end` line, and, for an exit that shows nothing, the end line followed by Pi reaping the hook's process (`isRunning(pid)` false) and one RPC round trip. Each shared seed step stays in use; a seed whose expectation changes (the summary-and-wake seeds) is rewritten, and its script gets a reply for the woken turn.

#### Records — D-BG-209

- **D-BG-209 — documents and pinned tests follow the behavior.** `docs/hooks-compatibility.md` changes only its async rows: `async`, `asyncRewake`, the `timeout` note's async clause if it needs one, "Long-running handlers", "Restart-survival rewake" (which wrongly says surviving children are re-dispatched; they are reaped), and the "Silent drop" bullet. The unit pairs of every product file changed, and the unpaired tests that pin the changed async behavior (`test/architecture/hooks-async-rewake.test.ts`, the async cases of `test/integration/hooks-spawn-end-to-end.test.ts`), change with it.

### Claude's Discretion

- Step names and phrasing in `hook/async.steps.ts`, within the cucumber skill's rules.
- How the plans split across waves; plans in one wave own disjoint files, so plans that share `registry.ts`, `async.feature`, or `async.steps.ts` run in sequence.
- The custom type of the plain-async context message, and how the registry tells a plain-async child from a rewake child.

### Deferred Ideas (OUT OF SCOPE)

Each is a parent line for `.planning/BACKLOG.md` and a dubious choice:

- Claude Code runs an `asyncRewake` hook synchronously in a non-interactive session without streaming input (`claude -p`); Pi's print and json modes are its analog. No harness runs a prompt in those modes, and the frozen harness cannot gain one.
- The `rewakeSummary` override from a JSON line on stdout, which Claude Code honors only for a plugin of an official marketplace.
- Claude Code's special exit-2 message for a hook whose script cannot be opened, and its suppression of identical repeats.
- Two live Pi processes in one scope share its PID table: one's start reaps the other's live hook processes, and the last writer's rows win. It predates this phase in the user scope; D-BG-207 extends the same reap to the project scope.
- A plain async hook's context reaching the model at a tool boundary of a running turn: Pi has no lane that delivers to the next model call of the same run without continuing a turn that would otherwise end, so it waits for the next prompt.
- Claude Code's sanitizing of the summary and body (whitespace collapse and a length cap on the summary, redaction of some keys, escaping a trailing `<`).
- The `{"async": true}` first stdout line that turns a synchronous hook asynchronous at run time.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ASYNC-01 | An `asyncRewake` hook that exits 2 gets its `rewakeMessage` and output into the model's context, which the model sees on its next turn. | Pi 1.5.0 `sendCustomMessage` lane table (triggerTurn idle run, steer while streaming, settle deferral); the edit point in `finalizeChild`; label derivation from the stdin payload; scenarios S3, S4, S5, S13; steps (b), (c). |
| ASYNC-02 | An `asyncRewake` hook that exits with any code other than 2 adds nothing to the model's context and shows the user nothing; one that exits 2 shows the user its `rewakeSummary`, or `Stop hook feedback` when it declares none (D-BG-204). | `finalizeChild` today notifies on every exit (`registry.ts:431-438`); new step (a) and (d); scenarios S2, S4, S6. |
| ASYNC-03 | An `asyncRewake` hook never blocks or delays the event it fired on; a `PreToolUse` async hook does not block the tool. | The shared background-prompt step already waits for the settle and the start line in either order; scenarios S1 (seed), S7, S9. |
| ASYNC-04 | `/reload` stops the async hook processes still running, and the next load reaps the ones an earlier Pi process left behind. | Probe run (this session): both the project-scope reload and the project-scope crash are red today; the per-load `HooksRuntime` analysis; the reap edit points; scenarios S11, S12 plus seeds 4 and 5. |
| ASYNC-05 | A hook declaring plain `async: true` behaves as Claude Code does, or the divergence is recorded with its license. | `dispatch-exec.ts:178` branch; upstream `aYt` JSON-answer reader read from the binary; reuse of `parseHookStdout`; scenarios S7, S8; the P2-DC-05 divergence row in the docs. |
</phase_requirements>

## Summary

The phase changes one registry (`bridges/hooks/async-rewake/registry.ts`), one branch condition (`dispatch-exec.ts`), one degrade (`dispatch.ts` `collectBucketOutcomes`), one runtime member (`runtime.ts`), and one reap call site (`event-router.ts`). Pi 1.5.0 gives the exact lanes the decisions need: `sendCustomMessage(msg, { triggerTurn: true })` starts a custom-message run when idle, steers the running agent when streaming, and defers itself while `agent_settled` is being emitted. A custom-message run fires `before_agent_start` but never `input`, so no `UserPromptSubmit` hook runs on a woken turn, and the model's call log shows the rewake text as a `user` row.

Two CONTEXT statements are wrong, and the planner must design around the facts. First, `/reload` does not kill children "through the in-memory walk". Pi re-runs the extension factory on every `/reload` and on every new session, and the factory creates a fresh `HooksRuntime` (`index.ts:92`). So the in-memory walk always runs on an empty map. A user-scope child dies on reload only because the factory reaps the user PID table. A project-scope child survives `/reload` today. I measured this with a probe scenario this session (see Open Questions). D-BG-207's project-hydrate reap fixes the reload case too, because the reload's `session_start` runs the project hydrate with a runtime that does not own the old child. Second, `test/integration/hooks-spawn-end-to-end.test.ts` has no async cases (its two tests are HOOK-E2E-02 and HOOK-E2E-05), so D-BG-209's "async cases" there is an empty set.

The harness is the hardest part. After the fix, every exit 2 wakes the model. The frozen release steps (`the user releases the hook {string} with the hooks recording` and `the user has released the hook {string}`) return as soon as the summary record arrives. They do not wait for the woken turn. The world's `After` hook then fails on an unused script step or on a call past the script. So every scenario that uses a frozen release step needs a later step that waits for the `agent_settled` that follows the last summary record. `finalizeChild` and `spawnAndRegister` are already at cognitive complexity 14 of 15 (fallow, measured), so every new branch must go into extracted helpers.

**Primary recommendation:** Pass `{ triggerTurn: true, deliverAs: "steer" }` on exit 2 and drop the `ctx.isIdle()` read. Derive the label from the stdin payload with a per-event field table in a new async-rewake leaf. Read the plain-async answer with an upstream-ordered candidate scan, then reuse the exported `parseHookStdout`. Reap the project table from a new `event-router.ts` function that both project-hydrate callers run. Build `async.steps.ts` around four synchronization points: the summary record, the `agent_settled` after it, the lifecycle end line, and the end-line pid reaped followed by two `get_state` round trips.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Decide background vs synchronous lane | `bridges/hooks/dispatch-exec.ts` (async branch) | `dispatch.ts` `collectBucketOutcomes` (settle path) | The executor owns the lane choice; the settle path must stop pre-empting it (D-BG-206). |
| Spawn, track, time out, finalize a background hook | `bridges/hooks/async-rewake/registry.ts` | `runtime.ts` (children map, PID-table op queue) | The registry is the only sanctioned background `child_process` site (`no-shell-out.test.ts`). |
| Rewake text and label | new leaf under `async-rewake/` | `hook-labels.ts` (`hookMatchLabel`, read-only import) | `registry.ts` cannot import `dispatch.ts` (cycle); `hook-labels.ts` is a no-import leaf and not Phase 2's file. |
| Plain-async JSON answer | new leaf under `async-rewake/` | `wire-protocol.ts` `parseHookStdout` (exported, reuse) | Reuses the field rules without copying a private function (fallow dupes). |
| Wake the model / queue context | Pi `pi.sendMessage` | — | Pi chooses run vs steer vs deferral itself. |
| Stop flag for the woken turn | `runtime.ts` (new member) | `settle.ts` reads `isStopHookActive()` unchanged | D-BG-203. |
| Orphan reap (factory and project hydrate) | `registry.ts` `reapOrphans` | `event-router.ts` new call site | D-BG-207; `index.ts` stays unchanged. |
| User-visible summary | `shared/notification-dispatch.ts` `notifyAsyncRewakeSummary` (unchanged) | registry calls it | IL-2 chokepoint. |

## Standard Stack

No new package. Everything uses what is installed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@earendil-works/pi-coding-agent` | 1.5.0 | `pi.sendMessage`, `ctx.isIdle`, events | Peer dependency `[VERIFIED: node_modules/@earendil-works/pi-coding-agent/package.json "version": "1.5.0"]` |
| `node:child_process` (in `registry.ts` only) | Node 26.13.0 | spawn background hooks | Closed five-file whitelist `[VERIFIED: test/architecture/no-shell-out.test.ts:209-215]` |
| `node:test` + `strong-mock` | as installed | unit pairs | `.agents/skills/typescript-unit-tests/SKILL.md` |
| `@cucumber/cucumber` | as installed | `features/hook/async.feature` | cucumber skill |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `{ triggerTurn: true, deliverAs: "steer" }` always | read `ctx.isIdle()` and pick `triggerTurn` or `steer` | Two reads with a race in between; `isIdle()` is false during a compaction even when no run streams. Pi already branches on `isStreaming`. |
| new leaf for the JSON answer + `parseHookStdout` | export the private `hookOutputs` from `wire-protocol.ts` | Exporting reshapes a shared module's surface; a copy of `hookOutputs` would be a fallow clone group. |
| closure-carried lane and label | new fields on `HooksRuntimeChildEntry` | New required fields break every fixture that builds an entry (`runtime.test.ts`, `event-router.test.ts`, `registry.test.ts`). |

**Installation:** none.

## Package Legitimacy Audit

No external package is installed by this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Pi 1.5.0 semantics the fix relies on

All quotes are from `node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js` unless named otherwise.

### `pi.sendMessage` lanes `[VERIFIED: agent-session.js:1862-1902]`

```js
if (options?.deliverAs === "nextTurn") {
    this._pendingNextTurnMessages.push(appMessage);
}
else if (this.isStreaming && options?.triggerTurn !== false) {
    if (options?.deliverAs === "followUp") {
        this.agent.followUp(appMessage);
    }
    else {
        this.agent.steer(appMessage);
    }
}
else if (options?.triggerTurn) {
    if (this._isEmittingAgentSettled) {
        this._deferredSettledActions.push(async () => await this.sendCustomMessage(message, options));
        return;
    }
    await this._startRun({ messageType: "custom", message: appMessage });
}
```

- Idle, with `triggerTurn: true`, the call starts a run. `_startRun` sets `this._isAgentRunActive = true` synchronously, before its first `await` `[VERIFIED: agent-session.js:1441-1446]`. So one RPC round trip after the call sees `isStreaming: true` in `get_state`.
- Streaming, with `triggerTurn` not `false` and `deliverAs` not `"followUp"`, the message becomes a steer. The agent loop reads steering after every turn, also after a final text reply: `pendingMessages = (await config.getSteeringMessages?.()) || [];` then `if (hasMoreToolCalls || pendingMessages.length > 0)` `[VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js:191-192]`.
- `{ triggerTurn: true }` alone already steers while streaming. Passing `deliverAs: "steer"` as well states the intent and changes nothing in 1.5.0.
- The extension-facing `pi.sendMessage` does not await. A rejection becomes an RPC `extension_error` record: `this.sendCustomMessage(message, options).catch((err) => { runner.emitError({ ... event: "send_message" ...` `[VERIFIED: agent-session.js:2783-2790]`. Every harness step that checks `faultsOf` fails on it.

### `isIdle` and the settle deferral `[VERIFIED: agent-session.js:696-717, 1085-1087]`

```js
get isIdle() {
    return !this._isAgentRunActive && !this.isCompacting;
}
```

```js
async _emitAgentSettled() {
    this._cacheWarmer?.onAgentSettled();
    this._isAgentRunActive = false;
    this._isEmittingAgentSettled = true;
    try {
        const aborted = this._agentRunAbortRequested;
        await this._extensionRunner.emit({ type: "agent_settled", aborted });
        this._emit({ type: "agent_settled", aborted });
    }
    finally {
        this._isEmittingAgentSettled = false;
    }
    const deferred = this._deferredSettledActions.splice(0);
```

- At child exit, `ctx.isIdle()` is true unless a run is active or a compaction runs. During `agent_settled` emission `_isAgentRunActive` is already false, so `isIdle()` is true there too.
- A Stop hook spawned inside the settle handler may exit while extensions still run their `agent_settled` handlers. Its `triggerTurn` send is then deferred and runs after the RPC `agent_settled` record. The woken run's records always come after the first `agent_settled` record. The step design depends on this order.

### What a woken (custom-message) run emits and fires

- `_prepareRun` emits `before_agent_start` for both triggers (`await this._extensionRunner.emitBeforeAgentStart(trigger, ...)`), then pushes the custom message, then `messages.push(...this._pendingNextTurnMessages)` `[VERIFIED: agent-session.js:1497-1530]`. A woken run also consumes queued `nextTurn` messages, such as a plain async hook's answer.
- `input` is emitted only from `prompt()` (`_runInputHandlers` at `agent-session.js:1668`). A woken run fires no `input`, so it runs no `UserPromptSubmit` hook and does not clear the Stop flag (`inputResetHandlerFor`). `[VERIFIED: agent-session.js:1649-1668]`
- The agent loop emits `agent_start`, `turn_start`, and `message_start`/`message_end` for each starting message, then `turn_end` and `agent_end` `[VERIFIED: pi-agent-core/dist/agent-loop.js:55-58, 156-157]`. RPC mode forwards every session event as a record (`output(toJsonEvent(event))`) `[VERIFIED: modes/rpc/rpc-mode.js:265-269]`. Then `_emitAgentSettled` emits `agent_settled`.
- A custom message reaches the model as role `user`: `case "custom": ... return { role: "user", content, ... }` `[VERIFIED: core/messages.js:89-95]`. The scripted model's call log shows it as a `user` row, as the Phase 1 seed already shows for a `nextTurn` custom message.

### Stale context after reload or session replacement

- Every `ctx` getter calls `runner.assertActive()`: `isIdle: () => { runner.assertActive(); return runner.isIdleFn(); }` and `get mode() { runner.assertActive(); ...` `[VERIFIED: core/extensions/runner.js:620-623, 653-656]`. After `invalidate()` it throws "This extension ctx is stale after session replacement or reload..." `[VERIFIED: runner.js:482-490]`. The captured `pi` API has the same guard (`extensions/loader.js:116-150`).
- `finalizeChild` already calls `requireNotificationMode(ctx.mode)` inside `try` before it notifies, so a child that ends after a reload or a new session shows nothing and wakes nothing. Keep that check ahead of both the summary and the send.

### Pi re-runs the extension factory per reload and per session `[VERIFIED]`

- `reload()` calls `this._resourceLoader.reload()` and then `_buildRuntime(...)` (`agent-session.js:3016-3046`). `loadExtension` calls `initializeExtension(factory, ...)` on every load (`extensions/loader.js:528-537`).
- `newSession`, `switchSession`, and `fork` call `this.createRuntime(...)` (`agent-session-runtime.js:128-172`), which builds services with `await resourceLoader.reload(...)` (`agent-session-services.js:69`).
- The factory creates the runtime: `const hooksRuntime = createHooksRuntime();` `[VERIFIED: extensions/pi-claude-marketplace/index.ts:92]`.
- Consequences:
  1. `shutdownInMemoryChildren(runtime)` in `registerHooksBridgeWith` (`event-router.ts:1065`) always walks a new, empty map in production. The user-scope `/reload` kill comes from the factory reap of the user PID table.
  2. A new session in a live Pi also reaps the earlier session's user-scope children (factory reap). After D-BG-207 it reaps the project-scope ones too, at the new session's `session_start`. That matches today's user-scope behavior and diverges from upstream, which leaves processes running. Flag it (Dubious Choices).
  3. D-BG-207's "skip the children this runtime owns" matters within one load. `session_start` runs a SessionStart async hook (spawned and registered before the handler returns), then `resources_discover` runs the project hydrate again with the same runtime. Without the skip, the load would kill its own SessionStart hook. The project-scope reload scenario (S12) depends on it.

## Architecture Patterns

### System Architecture Diagram

```text
Pi event (input / tool_call / session_start / agent_settled ...)
   |
   v
compositeHandlerFor / toolResultCompositeHandler / settleHandlerFor
   |  matcher + if filter, dedupe
   v
collectBucketOutcomes (settle) | runAndFold (others)
   |  (D-BG-206: no asyncRewake degrade; every entry goes to the executor)
   v
dispatchHookExec ──(async===true or asyncRewake===true)──> spawnAndRegister ──> noop folded
   |  sync path                                              |  stdin = TRANSLATORS[event](...)
   v                                                         |  label = labelOf(event, stdin)   (NEW)
parseHookStdout -> fold -> adapters                          |  lane  = rewake | plain          (NEW)
                                                             v
                                          child runs in background; PID table row written
                                                             |
                                       exit + stdout/stderr end (or close / error)
                                                             v
                                                       finalizeChild
                             take row, persist table, generation check, ctx.mode check
                                  |                                         |
                        rewake lane                                   plain lane
                    code !== 2 -> nothing                 answer = asyncAnswer(stdout)  (NEW)
                    code === 2 ->                         parseHookStdout(0, answer, "", event)
                      notify summary ?? "Stop hook feedback"   systemMessage  -> sendMessage nextTurn
                      runtime.recordRewake()  (NEW, D-BG-203)  additionalContext -> sendMessage nextTurn
                      sendMessage({claude-hook-rewake, `${prefix} ${out}`},
                                  {triggerTurn:true, deliverAs:"steer"})
                                                             |
                     Pi: idle -> custom run (before_agent_start, no input) -> agent_settled
                         -> Stop bucket sees stop_hook_active: true
                         streaming -> steer read at next turn boundary
                         emitting agent_settled -> deferred until after the record

Load / reload / new session:
factory -> new HooksRuntime -> registerHooksBridgeWith -> reapOrphans(user), reapOrphans(project@homedir)
session_start / resources_discover -> hydrateProjectScopeForCwd(cwd, trusted)
                                   -> reapProjectOrphans(runtime, cwd, trusted)   (NEW, D-BG-207)
                                      skip own dispatchIds; kill marked orphans; write own rows back or unlink
```

### Recommended file layout

```text
extensions/pi-claude-marketplace/bridges/hooks/async-rewake/
├── registry.ts          # spawn/finalize/reap; finalize split into small helpers
├── pid-table.ts         # unchanged
├── rewake-text.ts       # NEW: labelOf(event, stdin) + rewakeBody(prefixField, label, stderr, stdout)
└── async-answer.ts      # NEW: asyncAnswerText(stdout) -> the JSON answer text or undefined
test/bridges/hooks/async-rewake/
├── registry.test.ts     # updated
├── rewake-text.test.ts  # NEW pair
└── async-answer.test.ts # NEW pair
features/hook/async.feature
features/step_definitions/hook/async.steps.ts   # NEW
```

The module names are suggestions. Any new source module needs exactly one paired test (`test:corresponding`). No new module may import `node:child_process`.

### Current code and the exact edit points

**`registry.ts` `finalizeChild` (lines 380-473)** `[VERIFIED: registry.ts:431-469]`

```ts
  if (entry.rewakeSummary !== undefined) {
    try {
      const run = openNotificationRun(pi, { kind: "hook" });
      notifyAsyncRewakeSummary(ctx, run, entry.rewakeSummary);
```

```ts
  if (code !== 2) {
```

```ts
  const stderrText = entry.stderr.text();
  const body = stderrText.length > 0 ? stderrText : entry.stdout.text();
  if (body.length === 0) {
    hookDebugLog(`async-rewake: exit 2 with empty body -- no injection (${entry.pluginId})`);
    return;
  }

  const content = buildInjectionContent(entry.rewakeMessage, body);
  try {
    const lane: "nextTurn" | "followUp" = ctx.isIdle() ? "nextTurn" : "followUp";
```

Constants `[VERIFIED: registry.ts:90-96]`: `const MARKER_ENV = "PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH" as const;`, `const BODY_SEPARATOR = "\n\n";`, `const REWAKE_CUSTOM_TYPE = "claude-hook-rewake" as const;`.

Edits:
- D-BG-204: move the summary inside the exit-2 arm, with text `entry.rewakeSummary ?? "Stop hook feedback"`. `notifyAsyncRewakeSummary` already drops an empty string (`if (summary.length === 0) { return; }`, `shared/notification-dispatch.ts:442-444`), so a declared `""` still shows nothing.
- D-BG-202: delete `BODY_SEPARATOR`, `buildInjectionContent`, and the empty-body return. Body = `` `${entry.rewakeMessage ?? `Stop hook blocking error from command "${label}":`} ${stderr.length > 0 ? stderr : stdout}` ``. Upstream uses `??`, so a declared empty `rewakeMessage` ("") stays empty and the body starts with a space. The current code treats `""` as absent. Follow upstream.
- D-BG-201: `pi.sendMessage({ customType: REWAKE_CUSTOM_TYPE, content, display: false, details: { pluginId, dispatchId } }, { triggerTurn: true, deliverAs: "steer" })`. Drop the `ctx.isIdle()` read.
- D-BG-203: call the new runtime member right before the send, only on exit 2 with a current generation and live mode.
- D-BG-205: plain lane, any exit code: `asyncAnswerText(stdout)` → `parseHookStdout(0, answer, "", entry.claudeEvent)` → for `systemMessage` then `additionalContext`, each non-empty: `pi.sendMessage({ customType: <plain type>, content, display: false, details }, { deliverAs: "nextTurn" })`. No notify, no wake, no flag.
- The `TRANSLATORS` comment at lines 111-112 ("Stop / StopFailure never take the async-rewake path") becomes false and must change. Keep the table.

**Complexity budget (measured).** `npx fallow health --complexity` on `bridges/hooks/` with thresholds lowered to 6 to list scores `[VERIFIED: fallow run this session]`:

| Function | cyclomatic | cognitive | Limit (fallow and sonar) |
|---|---|---|---|
| `registry.ts` `finalizeChild` | 14 | 14 | 20 / 15 |
| `registry.ts` `spawnAndRegister` | 13 | 14 | 20 / 15 |
| `registry.ts` `reapOrphans` inner arrow | 7 | 12 | 20 / 15 |
| `dispatch-exec.ts` `dispatchHookExec` | 7 | 8 | 20 / 15 |
| `event-router.ts` session_start arrow | 8 | 7 | 20 / 15 |

So:
- `finalizeChild` gets no new branch. Split it: keep take, persist, generation, and mode checks there, then call `finishRewake(...)` or `finishPlain(...)`, chosen by a lane value. Pick the function from a lookup, or put the single `if` in a new helper.
- `spawnAndRegister` gets no new branch. Compute `label` and `lane` with branch-free expressions (a table lookup and `entry.handlerDecl.asyncRewake === true`) and pass them to `finalizeOnce`. `finalizeChild` already takes 6 parameters, and `@typescript-eslint/max-params` is `{ max: 7 }` `[VERIFIED: eslint.config.js:663]`. Bundle `ctx`, `pi`, `label`, and `lane` into one object.
- `reapOrphans`: move the per-row probe-and-kill into a helper before adding the owned-row skip and the write-back branch.

**Label from the stdin payload.** The payload fields `[VERIFIED: payloads/*.ts]`: PreToolUse, PostToolUse, PostToolUseFailure carry `tool_name: mapPiToClaudeToolName(event.toolName)`. SessionStart carries `source`, SessionEnd `reason`, PreCompact/PostCompact `trigger: compactTrigger(event.reason)`, StopFailure `error`. Stop and UserPromptSubmit carry no matcher field. Upstream builds the name as `gt=h?`${Ze}:${h}`:Ze` with `h` the match query `[VERIFIED: claude 2.1.319 binary @295691672]`. StopFailure passes `matchQuery:h` with `h=e.error??"unknown"` `[VERIFIED: binary @295598194]`, and Stop passes none `[VERIFIED: binary wve]`. Recommended table:

```ts
// Proposal (async-rewake/rewake-text.ts). Field names are the payload keys above.
const MATCH_FIELD: Record<DispatchableEvent, string | undefined> = {
  SessionStart: "source",
  UserPromptSubmit: undefined,
  PreToolUse: "tool_name",
  PostToolUse: "tool_name",
  PostToolUseFailure: "tool_name",
  PreCompact: "trigger",
  PostCompact: "trigger",
  SessionEnd: "reason",
  Stop: undefined,
  StopFailure: "error",
};
```

`label = typeof value === "string" ? hookMatchLabel(event, value) : event`. `hookMatchLabel` is `` `${claudeEvent}:${matchValue}` `` `[VERIFIED: hook-labels.ts:42-44]`. This matches `dispatch.ts` `noticeLabel` for every composite event. `noticeLabel` uses `hookEventLabel(claudeEvent, value)` for PreToolUse, which maps the Pi name with `mapPiToClaudeToolName` (`hook-labels.ts:29-33`). The payload's `tool_name` is already that mapped name, and `mapPiToClaudeToolName` returns a name it does not know unchanged (`return PI_TO_CLAUDE_TOOL_NAME_LOOKUP.get(name) ?? name;`, `domain/components/hook-tool-names.ts:143-145`). It also matches `toolResultCompositeHandler`'s `hookEventLabel(claudeEvent, view.event.toolName)` (`dispatch.ts:807`). The dispatcher passes the view event (Claude-form MCP name) to the executor, so the payload has the same name the notice label uses.

**Plain-async JSON answer, upstream order** `[VERIFIED: binary aYt @292959952]`:

```js
function aYt(e,{objectIn:n}=Wwe()){let r=e.trim().split(`
`),[s=""]=r,h=n(s.trim()),y=[(h!==void 0&&"async"in h?r.slice(1):r).join(`
`).trim(),...r.map((S)=>S.trim())];for(let S of y){let w=n(S);if(w!==void 0&&!("async"in w))return w}return}
```

The candidates in order: the whole trimmed stdout, or the rest after a leading `{"async":...}` line, then each trimmed line. The first candidate that is an object without an `async` key wins. Pass the winning text to `parseHookStdout(0, text, "", claudeEvent)`. For a JSON object, its arm carries `systemMessage` and `additionalContext` whatever the decision (`wire-protocol.ts:34-37` header). Upstream renders `systemMessage` first, then `additionalContext`, each only when it is a non-empty string `[VERIFIED: binary case"async_hook_response" @297273461]`. `Wwe()`'s `objectIn` details were not read. Treat "parses as a non-null, non-array object" as the rule `[ASSUMED]`.

**`dispatch-exec.ts` branch** `[VERIFIED: dispatch-exec.ts:178, 187]`: `if (entry.handlerDecl.asyncRewake === true) {` becomes `if (entry.handlerDecl.asyncRewake === true || entry.handlerDecl.async === true) {`. `const loc = locationsFor(entry.scope, ctx.cwd);` already gives the real project location. `async` is readable through the handler index signature (`[fieldName: string]: unknown;`, `domain/components/hooks/schema.ts:20`). `on-failure.ts:91-92` already treats both fields as background lanes.

**`dispatch.ts` `collectBucketOutcomes`** `[VERIFIED: dispatch.ts:284-293]`:

```ts
  const outcomes = await runHooks(runtime, hooks, async (entry) => {
    if (entry.handlerDecl.asyncRewake !== true) {
      return executor(entry, event, ctx, pi, runtime);
    }

    hookDebugLog(
      `collectBucketOutcomes: asyncRewake entry cannot yield a synchronous decision (${entry.pluginId}/${entry.claudeEvent}); degrading to noop`,
    );
    return { kind: "noop" };
  });
```

Make it `runHooks(runtime, hooks, (entry) => executor(entry, event, ctx, pi, runtime))`, and rewrite the doc comment above it (lines 256-273). In `settle.ts`, only the `runStopBucket` doc comment (lines 296-299) mentions the degrade. Change the comment and nothing else.

**`runtime.ts`** `[VERIFIED: runtime.ts:256-277]`: `stopHookActive = true` is set only in `recordStopReentry` below the cap. `recordUserInput()` clears it, and `recordStopNonReentry` only resets the counter. Add a member such as `recordRewake(): void { stopHookActive = true; }` to `HooksRuntime` and to the factory. It must not touch `consecutiveBlockCount`. `prepareSettleForRegistration` already clears it per load.

**`reapOrphans`** `[VERIFIED: registry.ts:516-554]` ends with `await unlinkPidTable(loc);` inside `runtime.runPidTableOperation(pidTablePath(loc), ...)`. New behavior: read `own = runtime.pidTableEntries(loc)`, skip table rows whose `dispatchId` is in `own`, keep today's liveness, marker, and kill logic for the rest, then `own.length === 0 ? unlinkPidTable(loc) : writePidTable(loc, own)`. At factory time the runtime is new, so `own` is empty and today's behavior stays. Put the skip inside the same queued operation, so it serializes with this runtime's spawn and finalize writes.

**Project reap call site.** `hydrateProjectScopeForCwdWith(reader, cwd, projectTrusted, routingState, generationIsCurrent)` gets a `Pick` of `RoutingStateOperations` without the PID-table members (`event-router.ts:121-129`), and `routing-state.ts` is a shared type. Do not widen either. Add `async function reapProjectOrphans(runtime: HooksRuntime, cwd: string, projectTrusted: boolean): Promise<void>` to `event-router.ts`. It returns when the project is not trusted (D-LOC-01) and otherwise calls `reapOrphans(runtime, locationsFor("project", cwd))`. Call it from both callers right after their hydrate:
- the `session_start` wrapper inside `registerHooksBridgeWith` (after the `try { await hydrateProjectScopeForCwdWith(...) }` at `event-router.ts:1124-1135`, before `rebuildRoutingTablesWith` and the SessionStart dispatch, so the reap ends before this session spawns any SessionStart hook);
- `createHooksHydration().hydrateProjectScopeForCwd` (`event-router.ts:1256-1268`), which `index.ts:165` calls from `resources_discover`.

`reapOrphans` never throws, so the call adds no branch to the session_start arrow.

### Pattern: synchronization points in `async.steps.ts`

Library imports the module may use (no file is added under `features/lib` or `features/support`):
- `waitForHookLifecycle`, `HOOK_LIFECYCLE_LOG`, `HOOK_RUNS_LOG` (`features/lib/hook-recorder.ts`)
- `isRunning`, `readLogLengths`, `readLogLinesSince` (`features/lib/turn-records.ts`)
- `readHookScriptPids` (`features/lib/hook-files.ts`)
- `modelCallsOf`, `readModelCalls` (`features/lib/scripted-model/script.ts`)
- `claudePluginPayloads` (`features/lib/pi-commands.ts`, which validates a payload against the schema)
- `expandTokens` (`features/lib/run-tokens.ts`)
- `promptDisposition` (`test/e2e/_rpc.ts`, which the hook step modules already import)
- `ScenarioWorld`, `PROFILE_PI_START_TIMEOUT_MS` (`features/support/world.ts`)
- the world's `pi.request`, `pi.recordCount`, `pi.recordsSince`, `pi.waitForRecord`, `profileHarness()`, `recordTurn()`, `requireTurn()`, `markTurnCompared()`, `tokens`, `harnessLogLinesBeforeLastWhen()`.

A step module cannot import another step module. The private helpers of `hook/session.steps.ts` (`releaseHook`, `faultsOf`, `isRewakeSummary`, `waitForReleaseTaken`) are not reachable. **Do not copy them**: `fallow dupes` scans `features/` in non-production mode with its default 50 tokens / 5 lines `[VERIFIED: .fallowrc.json has no duplicates key; fallow dupes --help]`, and since fallow 3.32 every clone group fails. Write one compact release helper for all of the module's steps, and run `npx fallow dupes` on it.

The frozen release logic, for reference `[VERIFIED: features/step_definitions/hook/session.steps.ts:199-212]`: mark lengths and record count, create `$HOME/hook-releases/<hook>` with flag `wx`, wait until the script removes the marker, wait for an `end` lifecycle line after the lengths, `await world.pi.waitForRecord(from, isRewakeSummary, ...)`, then assert no faults.

The lifecycle script `[VERIFIED: features/lib/hook-files.ts:367-376, 393-397]`: it records the run, writes `hook-<name>-<pid>.pid`, logs `start`, and waits for the release when `waits` is set. Then `on reentry: allow` exits 0 when stdin holds `"stop_hook_active":true`. The EXIT trap logs `end <name> $$ $?`. So an end line implies its run line is already in `hook-runs.jsonl`.

Step designs (names are the planner's call, and must be lower case outside quoted values):

(a) **Release a hook whose exit shows nothing.** E.g. `When the user releases the hook {string} and pi handles its exit` (plus a `Given` form if used). Mark lengths and `from`, create the marker, and wait until it is taken. `const end = await waitForHookLifecycle(harness, hook, "end", lengths, ...)`. Poll until `!isRunning(end.pid)`. Then send `get_state` twice, each after the previous answer. Assert the second answer's `data.isStreaming === false`. Assert no `extension_error`, no dialog, and no `agent_start` record since `from`. Record the turn with records and logs since the marks.
- Why two round trips: once Pi reaped the pid, the pipes' EOFs were readable before the first request line was written. A pipe EOF and the first request can land in one epoll batch in either order, and `finalizeChild` runs from the stream `end` events (`registry.ts:324-346`). After the first answer, every earlier-readable fd has been handled. The second request lands in a later loop turn, after `finalizeChild`. If a wake happened, `_startRun` has already set `isStreaming` synchronously.
- `isRunning(pid)` false means the waitpid already happened only if the script is Pi's direct child. With `/bin/sh` as bash, `spawn(cmd, [], { shell: true })` execs a single command (`child.pid` equals the script's `$$`, measured this session). On CI's dash this is `[ASSUMED]`.

(b) **Release and wait for the woken turn.** E.g. `When the user releases the hook {string} and it wakes the model`. As in (a) up to the end line, then `const summary = await pi.waitForRecord(from, isSummary, ...)`. Take its index and `await pi.waitForRecord(summaryIndex, r => r.type === "agent_settled", ...)`, and assert `aborted === false`. Record the turn. This works for both lanes: idle (a new run) and streaming (the running turn's settle).

(c) **Prompt only after the woken turn settled.** Use a `Given` such as `the hook {string} has woken the model`: find the index of the last summary record in `pi.recordsSince(0)` and wait for an `agent_settled` after it. The shared `When the user prompts {string}` (`features/step_definitions/session.steps.ts:98`) then works unchanged. A `When` form (e.g. `the user prompts {string} after the woken turn ends`) is needed only where the woken turn follows a `When`. That is the scenario that keeps `the user releases the hook {string} with the hooks recording` in use, because no `Given` may follow a `When`. If you write that `When`, do not copy the shared prompt step's body (clone risk). Wait first, then call a prompt-and-record helper that the module's own steps share.

(d) **No rewake summaries.** E.g. `Then the hooks show the user no rewake summaries`. Filter `requireTurn().records` for `entry_appended` entries whose `customType === "claude-plugin"` and `data.kind === "async-rewake-summary"`, assert `[]`, then call `markTurnCompared()`. A header-only table cannot be compared (`.agents/skills/cucumber/rules/features.md`, "Data tables"), so this needs its own step.

(e) **`asyncRewake` Stop hook that wakes the model once.** E.g. `When the user prompts {string} and the hook {string} wakes the model once`. Start the prompt, then wait in order: (1) `agent_settled` after `from`; (2) the hook's first `end` line (code 2); (3) the summary record; (4) `agent_settled` after the summary index (the woken turn); (5) a second `end` line of the hook (the woken turn's Stop run, exit 0 through `on reentry: allow`); (6) `!isRunning(secondEnd.pid)`, then two `get_state` round trips, `isStreaming === false`, and no `agent_start` after record (4). Record the whole span as one turn. Read the lifecycle lines since the step's own `lengths` to count end lines. `waitForHookLifecycle` returns the first matching line, so after (2), wait for the second end with lengths re-read just after the first end. Budget it below the 30-second step timeout, or give the step its own timeout as `PROFILE_PI_START_TIMEOUT_MS` steps do.

(f) **`PreToolUse` async hook.** No new step. `When the user prompts {string} and the hook {string} goes on in the background` (`hook/prompt-and-stop.steps.ts:155-160`) waits for the settle and the start line in either order and asserts no end line. The script plays a bash call, then `Done.`.

(g) **Project-scope crash restart.** No new step. The seed steps work unchanged with `--scope project` and the hook's `CLAUDE_PLUGIN_DATA` column (probe below).

(h) **Project-scope `/reload` in the terminal.** No new step. `startTuiSession` spawns the bridge with `cwd: sandbox.cwd` `[VERIFIED: features/lib/pi-tui.ts:403-405]` and the same agent dir, where `usePiWithProfile` wrote the trust entry (`world.ts:690`, `trustSandboxProject`). So the terminal Pi trusts the sandbox project and loads its project-scope hooks. The seed's terminal Given waits for the `start` line and checks `isRunning(started.pid)` (`hook/session.steps.ts:298-318`). After D-BG-207, that check holds only because the `resources_discover` reap skips the load's own child.

### `check:features` and the world

- `scripts/check-features.mjs` fails on an unused step definition, an undefined step, an ambiguous step, step text that is not lower case outside quoted values, a keyword other than Given/When/Then, a `Given` after a `When` or `Then`, a regex step text, and layout breaks `[VERIFIED: scripts/check-features.mjs:9-16, 188-223, 455-475]`. A new expression must not match an existing text: `the user prompts {string}` is anchored, so `the user prompts "next" after ...` does not match it.
- `recordTurn` asserts that a step compared the previous turn (`assert.strictEqual(this.lastTurnCompared, true, "no step compared the previous model turn")`). `After` asserts the last turn was compared, that no script step is unused, and that no call went past the script (`unusedScriptSteps`, `callsPastScript`) `[VERIFIED: features/support/world.ts:797-801, 1153-1197]`. Any scenario whose last action woke the model must wait for that turn before it ends.
- The profile Pi's release (`pi.stop()`) closes stdin and then kills the process group (`features/lib/pi-process.ts:228-248`). A hook still waiting at scenario end dies with Pi, and its leftover pid file names a dead process. The stand-in check then passes, as seed 1 shows today.

### Anti-Patterns to Avoid
- **Deciding the lane from `ctx.isIdle()`:** two reads with a race between them, and it can pick wrongly during a compaction. Let Pi branch.
- **Reaping inside `hydrateProjectScopeForCwdWith` by widening its `Pick`:** this reshapes a shared signature and the shared `RoutingStateOperations`.
- **Copying a frozen step's helper into `async.steps.ts`:** a `fallow dupes` failure.
- **Adding branches to `finalizeChild` or `spawnAndRegister` in place:** both are at cognitive 14.
- **A release step for an exit-2 hook as a scenario's last action:** `After` races the woken model call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lane choice (run vs steer vs settle deferral) | own idle/streaming switch | `pi.sendMessage(msg, { triggerTurn: true, deliverAs: "steer" })` | Pi handles `_isEmittingAgentSettled` deferral and `isStreaming` atomically. |
| Reading `systemMessage`/`additionalContext` | a copy of `hookOutputs` | `parseHookStdout(0, answerText, "", event)` (exported) | Same field rules as the sync lane; no clone. |
| Notice label | string concatenation in the registry | `hookMatchLabel` from `hook-labels.ts` | One wording source (D-CF5-11/14). |
| Atomic PID-table writes and serialization | ad hoc fs writes | `writePidTable` / `unlinkPidTable` inside `runtime.runPidTableOperation` | NFR-1 and per-path ordering already exist. |
| Waiting in steps | `setTimeout` sleeps | `pi.waitForRecord`, `waitForHookLifecycle`, `isRunning` polling, `get_state` round trips | D-BG-208 forbids fixed sleeps. |
| Hook fixtures | new fixture writer | the hooks table columns `async`, `async rewake`, `waits`, `exit code`, `stderr`, `output`, `rewake message`, `rewake summary`, `on reentry` | Frozen harness; already supports all of them. |

**Key insight:** every timing guarantee the scenarios need already exists as an observable record or log line. A wait that is not tied to one of them is a flake.

## Runtime State Inventory

Not a rename phase. One persisted artifact changes meaning:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Per-scope `async-rewake-pids.json` at `<dataRoot>/_shared/` (`pid-table.ts:52-53, 98-100`: `const ASYNC_REWAKE_PIDS_FILENAME = "async-rewake-pids.json";`, `path.join(loc.dataRoot, "_shared", ASYNC_REWAKE_PIDS_FILENAME)`). Version-1 envelope, unchanged. | Code edit only. Plain-async children now write rows too, so a reap reads them the same way. No migration. |
| Live service config | None. Verified: no external service holds hook state. | none |
| OS-registered state | Orphaned hook processes carry `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH` in `/proc/<pid>/environ`. | Keep the marker name for both lanes: the reap matches it. |
| Secrets/env vars | None. | none |
| Build artifacts | None. | none |

## Common Pitfalls

### Pitfall 1: A frozen release step ends a scenario
**What goes wrong:** `After` reads `model-calls.jsonl` before the woken call lands. "No model call used these steps of the model script" fails intermittently.
**How to avoid:** follow each frozen release step with (b), (c), or (e) style waits.
**Warning signs:** a pass/fail flip under load.

### Pitfall 2: The project reap kills the load's own SessionStart hook
**What goes wrong:** `resources_discover` reaps right after `session_start` spawned a SessionStart async hook.
**How to avoid:** skip `runtime.pidTableEntries(loc)` dispatch ids and write them back. S12 is the regression scenario.

### Pitfall 3: Woken-turn loops
**What goes wrong:** an `asyncRewake` Stop hook that always exits 2 wakes the model forever. D-BG-203 deliberately does not count toward STOP-07.
**How to avoid:** test with `on reentry: allow`. The red proof for D-BG-203 relies on the scripted model failing at once past its script (auto retry off), which ends the run with stop reason `error`. That routes to StopFailure, not Stop, and the loop stops.

### Pitfall 4: Complexity ceilings
**What goes wrong:** fallow health or `sonarjs/cognitive-complexity` fails on `finalizeChild`, `spawnAndRegister`, or the `reapOrphans` arrow.
**How to avoid:** extract helpers first (see the table above). Check both gates: they score differently.

### Pitfall 5: Cross-runtime PID-table writes
**What goes wrong:** after a reload, the old runtime's `finalizeChild` for a killed child still runs `persistPidTableForLoc(oldRuntime, ...)`. It writes the old runtime's (empty) row set. Each runtime has its own `runPidTableOperation` queue, so this write is not ordered against the new runtime's writes, and it can drop a row the new runtime just added. This already happens in the user scope. The project scope gains it with D-BG-207.
**How to avoid:** out of scope (two-runtime table sharing is deferred). Name it in the plan's Threat Flags or as a dubious choice. Do not try to fix it inside this phase.

### Pitfall 6: Stale ctx or pi
**What goes wrong:** a hook that ends after a reload or a new session throws on `ctx.mode` or on `pi.sendMessage`.
**How to avoid:** keep `requireNotificationMode(ctx.mode)` first and the send inside `try`. Shows and wakes nothing (correct).

### Pitfall 7: The unit tests pin today's behavior heavily
`registry.test.ts` pins `options: { deliverAs: "nextTurn" }` and `"followUp"`, the `"\n\n"` separator, summary-on-any-exit, the "empty summary" and "stale idle getter" rows of the settle table, and the debug line `exit 2 with empty body -- no injection` (e.g. lines 237-241, 755-762, 922-929, 1802, 1851-1907, 1981). Budget a full pass over that 3,054-line file.

### Pitfall 8: Two live Pis in one project
The profile Pi and a terminal Pi share the project PID table. A new terminal Pi's `session_start` reap kills the profile Pi's live project-scope hooks. No planned scenario runs a project-scope hook in both Pis at once. Keep it that way.

## Code Examples

### Rewake send (proposal; Pi semantics verified above)
```ts
// registry.ts, exit-2 arm (proposal)
const content = `${entry.rewakeMessage ?? `Stop hook blocking error from command "${label}":`} ${
  stderrText.length > 0 ? stderrText : entry.stdout.text()
}`;
runtime.recordRewake(); // D-BG-203 (new member; name is the planner's call)
pi.sendMessage(
  { customType: REWAKE_CUSTOM_TYPE, content, display: false, details: { pluginId: entry.pluginId, dispatchId } },
  { triggerTurn: true, deliverAs: "steer" },
);
```
Every value in this skeleton is quoted above: `REWAKE_CUSTOM_TYPE` (`registry.ts:96`), the default prefix (binary), `details` keys (`registry.ts:463-466`).

### Plain answer (proposal)
```ts
// async-rewake/async-answer.ts (proposal): upstream aYt candidate order
function objectIn(text: string): Record<string, unknown> | undefined { /* JSON.parse in try; non-null, non-array object */ }
export function asyncAnswerText(stdout: string): string | undefined {
  const lines = stdout.trim().split("\n");
  const first = objectIn((lines[0] ?? "").trim());
  const body = (first !== undefined && "async" in first ? lines.slice(1) : lines).join("\n").trim();
  return [body, ...lines.map((line) => line.trim())].find((text) => {
    const value = objectIn(text);
    return value !== undefined && !("async" in value);
  });
}
```

### Scenario sketches (shapes, not final text)

The hooks table and script columns are the frozen ones. Each scenario starts with the seed's six `Given`s (scripted model, `fixtures` dir marketplace, `demo` plugin, hooks table, marketplace added, install, new session).

- **S1 (seed 1, keep):** asyncRewake prompt hook goes on after the prompt. ASYNC-03.
- **S2 (seed 2, rewrite), exit 2 shows its summary:** `Given ... prompted ... goes on`; `When the user releases the hook "wake" with the hooks recording` (frozen); `Then lifecycle: wake end 2`; `Then rewake summaries: wake finished`; `Then the hooks record no runs` (a woken run fires no `input`); a `When` from (c) that prompts after the woken turn; `Then the model receives these calls:` call 3 = `say done` / `Done.` / `The hook woke the model. woke up` / `Woke.` / `next`. Script: `Done.`, `Woke.`, `Noted.`.
- **S3 (seed 3, rewrite), exit 2 wakes the model with its message and output:** keeps the frozen `Given the user has released the hook "wake"`, then the (c) `Given ... has woken the model`, then the shared `When the user prompts "next"`, then the calls (same rows as S2).
- **S4, default texts:** no `rewake message`, no `rewake summary`, output on stdout only. `When ... releases ... and it wakes the model` (b). Calls: call 2 has `user | Stop hook blocking error from command "UserPromptSubmit": <stdout>`. Summary `Stop hook feedback`.
- **S6, a non-2 exit shows nothing and adds nothing:** `exit code 1`, `stderr`, `rewake summary` declared; (a); lifecycle `end 1`; (d); shared `When the user prompts "next"`; calls without rewake text.
- **S7, plain async never holds up its prompt:** `async true`, `waits`, `exit code 2`, `stderr`; the shared background `When`; call 1 only; lifecycle `start`.
- **S8, plain async answer reaches the next model call, not the user, and never wakes:** `async true`, `waits`, `exit code 2`, `output {"systemMessage":"<s>","hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"<c>"}}`; (a); `Then the hooks show the user no messages` (frozen, `hook-notice`) and (d); `When the user prompts "next"`; call 2 = `say done` / `Done.` / `next` / `<s>` / `<c>`. The hook runs again on `next` and waits. That run is not compared, and Pi's stop kills it.
- **S9, PreToolUse async hook does not block its tool:** `async rewake true`, matcher `Bash`, `waits`; script `bash {"command":"echo from-model"}` then `Done.`; shared background `When`; calls show the tool result; lifecycle `start`.
- **S10, an asyncRewake Stop hook wakes the model once:** `event Stop`, `async rewake true`, `exit code 2`, `stderr keep going`, `on reentry allow`; (e); runs: Stop `Done.`/`false`, Stop `Woke.`/`true`; calls: call 2 has `Stop hook blocking error from command "Stop": keep going`; summary `Stop hook feedback`; lifecycle start, end 2, start, end 0.
- **S11, project-scope crash restart:** the probe scenario below. Red today.
- **S12, project-scope reload:** the probe scenario below. Red today.
- **S13 (optional), a rewake while a tool runs reaches the same turn:** a race-free design exists. The script's bash call waits on a marker: `{"command": "until [ -e {home}/hook-releases/tool ]; do sleep 0.1; done; echo released"}` (tokens expand in the script table). A step waits for `tool_execution_start`, releases the hook, waits for its end line and the summary record (the steer is now queued), then creates `{home}/hook-releases/tool` and waits for `agent_settled`. Call 2 shows the tool result, then the rewake as `user`. Script: tool call, `Done.`. `followUp` would push it to a call 3 (overflow), and `nextTurn` would drop it from call 2. If the planner drops S13, say that unit tests cover the steer lane.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Exit-2 rewake queued `nextTurn` or `followUp` | Wake an idle Pi (`triggerTurn`), steer a running turn | this phase (D-BG-201) | The seed that pinned next-prompt delivery is rewritten. |
| Summary on every exit | Summary only on exit 2, default `Stop hook feedback` | this phase (D-BG-204) | The shared release steps release only exit-2 hooks. |
| Plain `async` ran synchronously | Background, JSON answer as `nextTurn` context | this phase (D-BG-205) | |
| asyncRewake on Stop dropped | Runs in the background | this phase (D-BG-206) | The "Silent drop" bullet goes. |

## `docs/hooks-compatibility.md` rows

Rows by line `[VERIFIED: docs/hooks-compatibility.md:204-206, 254, 354-355, 388]`. The file is formatted by mdformat (pre-commit), not Prettier.

| Line | Row | Proposed content |
|------|-----|------------------|
| 204 | `timeout` | Change only the clause `(\`asyncRewake\` keeps 600 s everywhere)` to `(\`async\` and \`asyncRewake\` keep 600 s everywhere)`. |
| 205 | `async` | Pi `⚠`. Runs in the background and never blocks or delays its event. Its exit code and decision fields decide nothing. When it ends, the bridge reads one JSON answer from stdout (the whole output, or its first JSON-object line). A non-empty `systemMessage` and `hookSpecificOutput.additionalContext` reach the model on its next call, in that order. It never wakes the model, plain stdout is ignored, and the user sees nothing. Divergence: Claude Code may attach the answer at a tool boundary of a running turn, while the bridge waits for the next prompt (no Pi lane, P2-DC-05). |
| 206 | `asyncRewake` | Pi `⚠`. Runs in the background as `async` does, on every event, Stop and StopFailure included. On exit 2 it wakes the model with `<rewakeMessage>` or `Stop hook blocking error from command "<label>":`, then a space and the whole stderr, else stdout. An idle Pi starts a turn, and a running turn reads it at its next turn boundary. The user sees `rewakeSummary`, else `Stop hook feedback`, and a Stop hook that ends the woken turn sees `stop_hook_active: true`. Any other exit adds nothing and shows nothing. Divergences: print and json modes still run it in the background; the official-marketplace stdout summary override and Claude Code's summary sanitizing are not done (deferred). |
| 254 | Large stdout or stderr | Optional precision: "An `asyncRewake` hook that exits 2 sends its whole stderr, else its whole stdout, to the model." |
| 354 | Long-running handlers | `/reload` stops every async hook process, and the next start after a crash stops the ones a dead Pi left, in both scopes (D-62-05, ASYNC-04). Claude Code leaves them running. Also true today and worth stating: a new session stops the earlier session's processes. |
| 355 | Restart-survival rewake | Pi `✗`: no hook process re-attaches after a restart. The bridge stops it at the next start (D-62-05). The Claude Code column: it leaves the process running, and no later session hears from it `[ASSUMED from CONTEXT's "no orphan reap"]`. |
| 388 | Silent drop bullet | Delete the `asyncRewake` on `Stop` / `StopFailure` bullet. |

Parent line (frozen file): `docs/json-output.md` describes `async-rewake-summary` `text` as "Author's summary text, kept verbatim" (lines 477-489). With the `Stop hook feedback` default, that is no longer always the author's text.

## Existing tests that pin changed behavior

| Test | Pins today | Needs |
|------|-----------|-------|
| `test/bridges/hooks/async-rewake/registry.test.ts` (3,054 lines) | `nextTurn`/`followUp` lanes, `\n\n` body, summary on any exit, empty-body no-inject debug line, `isIdle` stale row, reap always unlinks | Rewrite the lane, body, and summary assertions. Add: label per event (one case per table row, or a table-driven case), empty `rewakeMessage`, stdout fallback, empty output wakes, default summary, non-2 shows nothing, plain-lane answer (both fields, order, nothing on a missing answer, async-line skip), recordRewake call, reap owned-skip with write-back, unlink when nothing is owned. Direct coverage 100% (5.4 s today). |
| `test/bridges/hooks/runtime.test.ts` | Stop flag semantics | Case for the new member: sets the flag, leaves the counter, `recordUserInput` clears it. |
| `test/bridges/hooks/dispatch-exec.test.ts` | "delegates only literal async true", where `asyncRewake: true` delegates and the rest is sync (around line 1068) | Add `async: true` delegation, `async: "yes"` stays sync (strict `=== true`), and a sync-path case that still runs `async: false`. |
| `test/bridges/hooks/dispatch.test.ts` | "preserves matching observation order while degrading async rewake to noop" expects the executor not called for `async-degraded` | Expect the executor call. Rename the case. |
| `test/bridges/hooks/settle.test.ts` | "an asynchronous Stop declaration degrades to noop" (line 918): `fired` is `[]` | The executor now fires for it. Return `noop` as `dispatchHookExec` would, and assert `fired` and `sent` are `[]`. |
| `test/bridges/hooks/event-router.test.ts` | Reload ordering log; project hydrate cases | Cases: a trusted project hydrate reaps a marked orphan and keeps an owned row; an untrusted one reaps nothing; `session_start` reaps before the SessionStart dispatch. The ordering-log test (lines 141-640) uses `mode: "unknown"` for `session_start`, so the new call does not run there. |
| `test/architecture/hooks-async-rewake.test.ts` | Env parity across lanes; epoch isolation (`pi.messages` `[]` after a generation change) | Likely unchanged. Re-run it; adjust only if its harness assumes `isIdle` reads. |
| `test/integration/hooks-spawn-end-to-end.test.ts` | No async case | None. |
| `test/architecture/no-shell-out.test.ts` + `gate-targets.ts` | Exactly five `child_process` files, registry among them (`SHELL_OUT_EXEMPT_TARGETS`, lines 217-223) | Keep every spawn in `registry.ts`. A new leaf must not import `node:child_process`. |
| `rule-packs/architecture.json:118` | registry exemption for `child_process` (frozen) | No change needed. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | On CI's dash, `sh -c '<script>'` execs the script, so the lifecycle pid is Pi's direct child. | Step (a) | Step (a)/(e) could rarely read state before Pi reaps the shell, which is a rare flake. Hardening: read `/proc/<pid>/stat` ppid before release and also wait for that parent when it is not Pi. |
| A2 | Upstream `objectIn` means "parses as a non-null, non-array object". | Plain answer | An edge-case JSON (array or number line) might be selected differently from upstream. |
| A3 | Claude Code's column for "Restart-survival rewake" reads as "not re-attached". | Docs | Doc wording only. |
| A4 | Two `get_state` round trips after the reap are enough for `finalizeChild` to have run. | Steps (a)/(e) | A rare flake under extreme load; one rerun policy applies. |

## Open Questions

1. **Probe result (resolved this session).** A scratchpad feature (not in the repo) ran the seed reload and crash scenarios with `--scope project` against the current tree. Both failed at `Then no hook process is running` with "these hook processes are still running" (2 scenarios, 2 failed). So S11 and S12 are red today, and CONTEXT's sentence "`/reload` already kills every child of both scopes through the in-memory walk" is wrong. D-BG-207's reap at the project hydrate fixes both, because the reload's `session_start` runs it with a fresh runtime.
2. **Should a new session stop the earlier session's async hooks?** That is today's user-scope behavior (factory reap), and D-BG-207 extends it to the project scope. Upstream leaves them running. Recommendation: keep it (D-62-05 licenses the reap) and record it as a dubious choice.
3. **S13 (steer while a tool runs):** feasible and race-free as sketched. It costs one more step and about 25 s of scenario time. Recommendation: include it. It is the only behavioral proof of the steer lane.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v26.13.0 | — |
| npm | scripts | ✓ | 11.20.0 | — |
| python3 | `pi-tui-pty.py` (terminal scenarios) | ✓ | 3.15.2 | — |
| `/bin/sh` | shell-form hooks | ✓ | bash | CI uses dash (A1) |
| Claude Code binary | upstream checks | ✓ | 2.1.319 | — |
| `/tmp` inodes | tests | ✓ | 5% used | — |

The real `~/.pi/agent` was unchanged by every run this session (mtimes checked before and after).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit, architecture, integration), `@cucumber/cucumber` (behavior) |
| Config file | `cucumber.json` (profiles `adapter`, `builtin`); `.fallowrc.json`; `eslint.config.js` |
| Quick run (one unit pair) | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/async-rewake/registry.test.ts` |
| Pair coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` (5.4 s measured) |
| One feature file | `npm run test:cucumber:profile -- --profile adapter --parallel 3 features/hook/async.feature` (today: 5 scenarios, 61 s wall incl. peer install, 48 s cucumber, 2 m 05 s summed) |
| One scenario | `npx cucumber-js --profile adapter --name '<title>'` |
| Full suite | `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ASYNC-01 | exit 2 wakes (idle) with Claude Code text and label | unit | registry pair coverage | ✅ (update) |
| ASYNC-01 | woken turn shows message; history keeps it | cucumber S3, S4, S2 | async.feature | ✅ (rewrite) |
| ASYNC-01 | steer while streaming | unit + cucumber S13 | registry pair; async.feature | ❌ S13 new |
| ASYNC-01 | Stop flag on wake (D-BG-203) | unit + cucumber S10 | runtime pair; async.feature | ❌ new |
| ASYNC-02 | summary only on exit 2, default text | unit + cucumber S2, S4, S6 | registry pair; async.feature | ❌ S4/S6 new |
| ASYNC-03 | prompt not blocked | cucumber S1 | async.feature | ✅ seed |
| ASYNC-03 | PreToolUse tool not blocked | cucumber S9 | async.feature | ❌ new |
| ASYNC-03 | Stop async runs in background (D-BG-206) | unit (dispatch, settle) + cucumber S10 | dispatch/settle pairs | ✅ (update) |
| ASYNC-04 | reload stops hooks, user scope | cucumber seed 5 | async.feature | ✅ |
| ASYNC-04 | reload stops hooks, project scope | cucumber S12 | async.feature | ❌ new (red today) |
| ASYNC-04 | crash reap, user / project | cucumber seed 4 / S11 | async.feature | ✅ / ❌ new (red today) |
| ASYNC-04 | owned-row skip and write-back; trusted gate | unit | registry pair; event-router pair | ❌ new cases |
| ASYNC-05 | plain async in background | unit (dispatch-exec) + cucumber S7 | pair; async.feature | ❌ new |
| ASYNC-05 | plain answer as nextTurn context, no notice, no wake | unit (async-answer, registry) + cucumber S8 | pairs; async.feature | ❌ new |

### Red proofs (record each in the plan SUMMARY)

| Scenario | How to make it fail | Expected failure |
|----------|---------------------|------------------|
| S1, S9 | Temporarily route `asyncRewake` hooks to the sync path in `dispatchHookExec` | Background `When` times out (the hook waits up to 60 s; the deadline is 20 s). |
| S2, S3, S4 | Revert to the `nextTurn`/`followUp` lane | The woken-turn wait times out (no `agent_settled` after the summary). |
| S4 | Keep the wake, restore `"\n\n"` and no default prefix | Calls table mismatch. |
| S6 | Restore the summary on any exit | (d) fails: one `async-rewake-summary`. |
| S7 | Revert the `async === true` branch (today's tree) | Background `When` times out. |
| S8 | Skip the plain-lane delivery | Call 2 lacks the two rows. Notifying `systemMessage` instead fails "no messages". |
| S10 | Restore the `collectBucketOutcomes` degrade | The wait for the end line times out. Without the D-BG-203 flag: the second run exits 2, wakes again, and the call goes past the script (or the second end line has code 2). |
| S11, S12 | Remove the `reapProjectOrphans` call (today's tree) | `no hook process is running` lists a pid (measured). |
| S12 | Drop the owned-row skip | The terminal Given's `isRunning(started.pid)` fails, or the hook dies before the reload. |
| S13 | `followUp` lane / `nextTurn` lane | A call past the script / call 2 lacks the rewake row. |

A timeout failure under load gets one rerun before you call it red.

### Sampling Rate
- **Per task commit:** the hook runs `npm run check:commit` (staged pairs); plus the owner test and its pair coverage.
- **Per wave merge:** run the parts of `npm run check` in order in the background, each writing its exit code: `npm run check:static` → `npm run test:unpaired` → `npm run test:integration` → `npm run test:cucumber` → `npm run test:coverage:direct:all`. While iterating on behavior, use `npm run test:cucumber:profile -- --profile adapter --parallel 3 features/hook/async.feature`.
- **Phase gate:** the full `npm run check`, once, green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `test/bridges/hooks/async-rewake/<label/text leaf>.test.ts`, the pair of the new leaf
- [ ] `test/bridges/hooks/async-rewake/<answer leaf>.test.ts`, the pair of the new leaf
- [ ] `features/step_definitions/hook/async.steps.ts`, the new module
- The framework needs no install.

### Suggested wave split (files disjoint inside a wave)
- **Wave 1, plan A:** `async-rewake/registry.ts`, the new leaves, `runtime.ts` and their pairs, `test/architecture/hooks-async-rewake.test.ts` (D-BG-201..205, the reap owned-skip).
- **Wave 1, plan B:** `dispatch-exec.ts`, `dispatch.ts`, the `settle.ts` comment and their pairs (D-BG-205 branch, D-BG-206).
- **Wave 2, plan C:** `event-router.ts` + pair (D-BG-207 call site), `docs/hooks-compatibility.md` async rows.
- **Wave 2 or 3, plans D/E (sequential, shared files):** `features/hook/async.feature` and `async.steps.ts`: seed rewrites, then the new scenarios with red proofs.

Budget: about 8 new scenarios at about 25 s each add roughly 3-4 minutes summed to the adapter "components" CI leg, under 1 minute wall at parallel 8. Measure the leg once and compare with its 15-minute timeout (D-CF1-16: at least 1.5 times the run).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | D-LOC-01 trust gate: no project reap or hook run in an untrusted project |
| V5 Input Validation | yes | Hook stdout is untrusted. `JSON.parse` in `try`, object-shape checks, no eval. Strings go to the model as `display: false` custom messages (upstream parity). |
| V6 Cryptography | no | — |
| V12 Files / resources | yes | PID table through `atomicWriteJson` with `assertPathInside(loc.dataRoot, ...)` (NFR-1, NFR-10) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Killing a stranger process with a recycled pid | Tampering / DoS | `/proc/<pid>/environ` marker must equal the row's `dispatchId`; non-Linux soft-skips (`registry.ts:528-543`). Keep it unchanged. |
| A live Pi killing another live Pi's project hooks | DoS | Deferred (two Pis per scope). The owned-row skip protects only this runtime. |
| Prompt injection through rewake or async context | Elevation | Same exposure as upstream: plugin output reaches the model by design. Model-only, never shown as user text. |
| Unbounded stdout memory | DoS | Existing EXEC-02 choice (no cap, as upstream). Unchanged. |

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Upstream parity is the default. A divergence needs a recorded decision ID or a Pi capability gap.
- Every disk mutation is atomic (NFR-1). Writes stay under `<scopeRoot>/pi-claude-marketplace/` (NFR-10).
- User output goes only through `shared/notification-dispatch.ts` (IL-2). No `console.*` or stdio writes in the extension.
- `npm run check` stays green: typecheck, ESLint (`--max-warnings 0`), fallow (dead code, health 15/20, dupes, rule pack), Prettier, pairing, unit, integration, cucumber, 100% direct coverage per pair.
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario that fails without it.
- Comments cite decision or requirement IDs, never phases or plans, and only explain a non-obvious why.
- Inject dependencies (`SpawnDeps`, `OrphanProbes`); no test-only seams.
- Never commit to `main`; no `--no-verify`; no rebase; plain git commands. Every plan SUMMARY carries `## Threat Flags`.
- Run gates as `npm run check` parts in the background with exit-code files; never pipe a gate into `tail`/`head`/`grep`.

## Sources

### Primary (HIGH confidence)
- Codebase files read this session: `bridges/hooks/async-rewake/{registry,pid-table}.ts`, `dispatch-exec.ts`, `dispatch.ts`, `settle.ts`, `runtime.ts`, `event-router.ts`, `hook-labels.ts`, `wire-protocol.ts`, `on-failure.ts`, `payloads/*.ts`, `domain/components/hook-events.ts`, `domain/components/hooks/schema.ts`, `index.ts`, `shared/notification-dispatch.ts`.
- Pi 1.5.0 dist: `core/agent-session.js`, `core/agent-session-runtime.js`, `core/agent-session-services.js`, `core/extensions/{runner,loader}.js`, `core/messages.js`, `modes/rpc/rpc-mode.js`; `pi-agent-core/dist/agent-loop.js`.
- Claude Code 2.1.319 binary: `Tlt` rewake body, `N0`, `cYt`/`Oqo`/`aYt`, `async_hook_response` renderer, hook label `gt`, StopFailure `matchQuery`.
- Harness: `features/step_definitions/hook/*.steps.ts`, `session.steps.ts`, `model.steps.ts`, `features/lib/{hook-files,hook-recorder,turn-records,pi-process,pi-tui,pi-commands}.ts`, `features/support/world.ts`, `scripts/check-features.mjs`, `cucumber.json`.
- Measurements: async.feature run (exit 0, 61 s); probe run (2 of 2 red); fallow health scores; registry pair coverage (5.4 s).

### Secondary
- `.agents/skills/{cucumber,local-verification,typescript-unit-tests}` rules.

## Metadata

**Confidence breakdown:**
- Pi semantics: HIGH, read from dist this session.
- Edit points and complexity budget: HIGH, read and measured.
- Step designs: MEDIUM-HIGH. The signals are verified; the two-round-trip ordering argument and dash exec behavior are reasoned or assumed.
- Docs wording: MEDIUM.

**Research date:** 2026-11-08
**Valid until:** 2026-12-08 (or a Pi peer bump, whichever is first)
