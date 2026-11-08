# Phase 2: Async Hooks - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning
**Mode:** autonomous smart discuss in a child session; the user's standing instruction is to take the recommended answer at every question, so each decision below is the recommendation, auto-accepted. Every choice that a reviewer may reverse is logged in `DUBIOUS-CHOICES.md` beside this file.

<domain>
## Phase Boundary

Phase 2 makes a plugin's `async` and `asyncRewake` hooks behave as Claude Code 2.1.319 runs them, and covers that behavior with cucumber scenarios in `features/hook/async.feature` (with steps in the new `features/step_definitions/hook/async.steps.ts`). It owns `bridges/hooks/async-rewake/**` and the `async` and `asyncRewake` branches of the shared hook modules (`bridges/hooks/{dispatch,dispatch-exec,event-router,event-adapters,routing-state,runtime,settle,wire-protocol,index}.ts`, `domain/components/hook-events.ts`, `domain/components/hooks/**`), the `async` and `asyncRewake` rows of `docs/hooks-compatibility.md`, and the unit pairs of those files. It fixes the product bugs its scenarios expose (ASYNC-01 to ASYNC-05), and it adds no feature beyond them.

The five Phase 1 seeds in `features/hook/async.feature` pass to this phase. It may rewrite them, but it keeps every shared step they use in use (`.agents/skills/cucumber/rules/layout.md`, "Seeds").

</domain>

<decisions>
## Implementation Decisions

### Upstream evidence (Claude Code 2.1.319)

Read from the binary `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude` on 2026-11-08 (`LC_ALL=C /usr/bin/grep -oa` and a Python byte search; the registry function is `Tlt`, the plain-async registry `cYt`/`Oqo`/`Iqo`, the notification queue `LTn`, the attachment builder `gqr`). High confidence: these are the code paths, not prose.

- **Background or not.** A command hook runs in the background when `async === true`, or when `asyncRewake === true` and the session is interactive or takes streaming input (`N0`: `e.async===!0||e.asyncRewake===!0&&(!ye()||eWt())`; `ye()` is "not interactive", `eWt()` is "has streaming input"). The schema says `asyncRewake` "implies async". Neither kind ever blocks or delays its event.
- **asyncRewake exit 2.** When the background process ends with code 2, Claude Code calls `LTn({summary, body, priority: "next", stopHookActive: true})`. It queues a `task-notification` with no `shouldQuery: false`, so an idle session wakes: the model gets a new turn with no user prompt. A running turn drains a `next` notification at its next tool boundary. The body is `${rewakeMessage ?? `Stop hook blocking error from command "${hookName}":`} ${stderr || stdout}`: one space between the prefix and the output, the whole stderr when it is not empty, else the whole stdout, and an empty output still wakes the model with the prefix alone. `hookName` is the hook's label as Claude Code names it (`UserPromptSubmit`, `PreToolUse:Bash`, `SessionStart:startup`, `Stop`), which this project already reproduces as the D-CF5-11/D-CF5-14 label (`bridges/hooks/hook-labels.ts`).
- **asyncRewake, what the user sees.** The user sees the notification's summary only on exit 2: `rewakeSummary`, else the literal `Stop hook feedback`. On any other exit, nothing reaches the model and nothing reaches the user (only a hook-response event that the terminal shows in verbose or transcript mode). A plugin from an official marketplace may override the summary with a `rewakeSummary` field of a JSON line on stdout (`Z2(pluginId)`).
- **Plain `async: true`.** The process runs in the background with no rewake. When it ends, Claude Code reads one JSON answer from its stdout (exit code aside) and holds it. The next model call, whenever a query runs, gets an `async_hook_response` attachment: its `systemMessage` and its `hookSpecificOutput.additionalContext` each reach the model as a hidden meta message, in that order. It never wakes the model. Plain stdout is context only for hooks marked `plainOutputIsContext` (a Symbol Claude Code sets on its own hooks), not for a plugin's declared async hook. The user sees the response only in verbose or transcript mode. Its exit code decides nothing.
- **Stop.** Nothing excludes Stop: the default texts (`Stop hook blocking error from command`, `Stop hook feedback`) show that a Stop hook is the main user of `asyncRewake`.
- **Process end.** Claude Code leaves a plain async process running when it exits (`atExit: "leave"`). It has no `/reload` and no orphan reap; this project's `/reload` kill and crash reap are its own decisions (D-62-05) and stay.

### Exit-2 rewake (ASYNC-01) — D-BG-201, D-BG-202, D-BG-203

- **D-BG-201 — an exit 2 wakes the model.** When an `asyncRewake` hook exits 2 and Pi is idle, the bridge sends the rewake message with `triggerTurn: true`, so Pi starts a turn with it and no user prompt, as Claude Code wakes an idle session. When Pi is running a turn, the bridge sends it as a `steer`, which Pi reads at the next turn boundary, as Claude Code drains a `next`-priority notification at the next tool boundary. This replaces `nextTurn` (which waited for the user's next prompt) and `followUp`. The message stays model-only (`display: false`, custom type `claude-hook-rewake`). The seed "An async rewake hook that exits 2 puts its message into the model's next call" changes to the woken turn.
- **D-BG-202 — the rewake text is Claude Code's.** The message is `<prefix> <output>`: the prefix is `rewakeMessage`, else `Stop hook blocking error from command "<label>":`, where `<label>` is the hook's D-CF5-14 label; the output is the whole stderr when it is not empty, else the whole stdout; one space joins them; an exit 2 with no output still wakes the model with the prefix and the space. The label is derived from the Claude-shaped stdin payload the registry already builds (its event name, and its `tool_name`, `source`, `reason`, or `trigger` where the event's matcher selects on one), because `registry.ts` cannot import `dispatch.ts` without a cycle.
- **D-BG-203 — a woken turn is a Stop re-entry for `stop_hook_active`.** Claude Code queues the rewake with `stopHookActive: true`, so a Stop hook that ends the woken turn sees `stop_hook_active: true` and can let it end. The bridge marks the runtime's Stop flag when it wakes the model, through a new runtime function (an additive change to `runtime.ts`), and the flag clears on the user's next input, as a Stop re-entry's does. It does not count toward the STOP-07 re-entry cap.

### What the user sees (ASYNC-02) — D-BG-204

- **D-BG-204 — the summary shows only on exit 2, and it has a default.** On exit 2 the user sees `rewakeSummary`, else `Stop hook feedback`, through the existing `async-rewake-summary` notification kind. On any other exit the user sees nothing and the model gets nothing. ASYNC-02 was drafted from the v1.13 HOOK-06 criterion 3 ("if `rewakeSummary` is set the bridge surfaces it at process exit"), which misread upstream; this phase rewords ASYNC-02 and its own success criterion 2 to Claude Code's behavior, under the milestone's upstream-parity rule. The shared release steps wait for a summary, so they now release only a hook that exits 2; a scenario that releases a hook ending any other way uses a step of `hook/async.steps.ts`.

### Plain async and never blocking (ASYNC-03, ASYNC-05) — D-BG-205, D-BG-206

- **D-BG-205 — plain `async: true` runs in the background.** Today `dispatch-exec.ts` sends only `asyncRewake === true` to the registry, so a plain async hook runs synchronously and its exit 2 or decision blocks its event: a bug. A hook with `async === true` (and no `asyncRewake`) goes through the same registry (spawn, PID table, timeout ladder, `/reload` kill, crash reap), never blocks or delays its event, and its exit code and decision fields decide nothing. When it ends, the bridge reads one JSON answer from its stdout (the whole trimmed stdout when it is one object, else the first line that is a JSON object and not an `{"async": ...}` line); its non-empty string `systemMessage` and `hookSpecificOutput.additionalContext` each go to the model as a model-only custom message, `systemMessage` first, with `deliverAs: "nextTurn"`, so the model reads them on its next call and is never woken. Plain stdout is ignored. The user sees nothing, and no rewake summary shows.
- **D-BG-206 — Stop and StopFailure async hooks run in the background too.** `collectBucketOutcomes` (`dispatch.ts`) drops an `asyncRewake` hook on the settle path today, and runs a plain async one synchronously. Both now go to the executor, whose async branch spawns them in the background and folds `noop`, so an `asyncRewake` Stop hook that exits 2 wakes the model with the `Stop` label. The `docs/hooks-compatibility.md` "Silent drop" bullet for `asyncRewake` on `Stop`/`StopFailure` goes.
- ASYNC-03 is covered for a prompt (the Phase 1 seed) and for a `PreToolUse` tool call: the tool result and the reply arrive while the hook still runs.

### Hook processes after a reload or a crash (ASYNC-04) — D-BG-207

- **D-BG-207 — the project scope's orphans are reaped at the project hydrate.** `index.ts` registers the hooks bridge with `{ cwd: homedir() }`, so the factory-time reap reads the home directory's project PID table, and the project hydrate does not reap: a dead Pi's project-scope hook processes survive the next start (P1-DC-40). The project hydrate (`hydrateProjectScopeForCwdWith` in `event-router.ts`, run at session start and at the load) reaps the project scope's PID table for the session's real `cwd`, after its trust check (a project Pi does not trust runs no hooks, D-LOC-01). Because the hydrate runs twice in one load (at `session_start` and again at `resources_discover`), the reap (`reapOrphans` in `registry.ts`) skips the rows of children this runtime still owns and writes their rows back instead of unlinking the table, so the load's second hydrate does not kill the SessionStart async hook its first one started. `index.ts` (a load-path shared file) is not changed. Research corrected the discuss step here: Pi runs the extension factory again on every `/reload` and every new session, with a fresh `HooksRuntime`, so the in-memory walk never finds the earlier load's children; user-scope children die only through the factory's user-scope reap, and project-scope children survive `/reload` today (a probe scenario was red). The project-hydrate reap fixes the reload and the crash alike. As the user-scope reap already does, it also stops an earlier session's project-scope async hooks when a live Pi starts a new session; upstream leaves them running (a dubious choice).
- The Phase 1 crash seed stays in the user scope; this phase adds a project-scope crash scenario and a project-scope reload scenario, both red today.

### Scenarios and steps — D-BG-208

- **D-BG-208 — test design.** Every new scenario has no MCP surface, so it carries no implementation tag and runs once, under `adapter` (D-BG-04). Each fails without the behavior it names, with the red proof in its plan SUMMARY. The phase's own steps live in `features/step_definitions/hook/async.steps.ts`; it adds no file under `features/support/` or `features/lib/`, and edits no shared or topic step module. Its synchronization points are signals Pi or the harness gives, never a fixed sleep: the rewake summary record, the woken run's `agent_settled`, the hook's lifecycle `end` line, and, for an exit that shows nothing, the end line followed by Pi reaping the hook's process (`isRunning(pid)` false) and one RPC round trip. Each shared seed step stays in use; a seed whose expectation changes (the summary-and-wake seeds) is rewritten, and its script gets a reply for the woken turn.

### Records — D-BG-209

- **D-BG-209 — documents and pinned tests follow the behavior.** `docs/hooks-compatibility.md` changes only its async rows: `async`, `asyncRewake`, the `timeout` note's async clause if it needs one, "Long-running handlers", "Restart-survival rewake" (which wrongly says surviving children are re-dispatched; they are reaped), and the "Silent drop" bullet. The unit pairs of every product file changed, and the unpaired tests that pin the changed async behavior (`test/architecture/hooks-async-rewake.test.ts`, and any other test research names), change with it. (`test/integration/hooks-spawn-end-to-end.test.ts` has no async case.)

### Claude's Discretion

- Step names and phrasing in `hook/async.steps.ts`, within the cucumber skill's rules.
- How the plans split across waves; plans in one wave own disjoint files, so plans that share `registry.ts`, `async.feature`, or `async.steps.ts` run in sequence.
- The custom type of the plain-async context message, and how the registry tells a plain-async child from a rewake child.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `bridges/hooks/async-rewake/registry.ts`: `spawnAndRegister` (spawn, register, timeout ladder, stream collection, PID-table write), `finalizeChild` (the exit handler: generation guard, summary notify, exit-2 injection), `reapOrphans` (PID-table reap with the `/proc/<pid>/environ` marker check), `shutdownInMemoryChildren`. `pid-table.ts` reads and writes the per-scope table atomically.
- `bridges/hooks/hook-labels.ts`: `hookEventLabel`, `hookMatchLabel` (the D-CF5-11/14 labels).
- `bridges/hooks/wire-protocol.ts`: `hookOutputs` reads `systemMessage` and `hookSpecificOutput.additionalContext` from a parsed object (private; the plain-async reader may share the field rules).
- `shared/notification-dispatch.ts`: `notifyAsyncRewakeSummary` (the sanctioned summary notify).
- `bridges/hooks/runtime.ts`: `isStopHookActive`, `recordStopReentry`, `recordUserInput`, `pidTableEntries(loc)` (this runtime's own rows for a scope).
- Harness (frozen): the hooks table columns `async`, `async rewake`, `waits`, `exit code`, `stderr`, `output`, `rewake message`, `rewake summary`, `on reentry`; the lifecycle log and pid files of a lifecycle hook (`features/lib/hook-files.ts`, `hook-recorder.ts`); `waitForHookLifecycle`; `readHookScriptPids`; `isRunning`; the world's `crashPi`, `restartPi("after-crash")`, `startTuiSession`, `pi.waitForRecord`, `pi.recordsSince`.

### Established Patterns

- Pi's `sendMessage(message, { triggerTurn, deliverAs })` (Pi 1.5.0 `AgentSession.sendCustomMessage`): `nextTurn` queues for the next prompt; while streaming, `steer` or `followUp`; while idle with `triggerTurn: true`, a new run starts. UserPromptSubmit maps to Pi's `input` event, which a custom-message run does not fire.
- The bridge's generation guard (`capturedGeneration`) drops an exit from before a `/reload`.
- Spawn dependencies are injected (`SpawnDeps`, `OrphanProbes`), never patched with a test seam (CONVENTIONS.md).

### Integration Points

- `dispatch-exec.ts` `dispatchHookExec`: the async branch (today `asyncRewake === true` only).
- `dispatch.ts` `collectBucketOutcomes`: the settle path's asyncRewake degrade.
- `event-router.ts` `registerHooksBridgeWith` (factory reap) and `hydrateProjectScopeForCwdWith` (project hydrate).
- Shared release steps (frozen) in `hook/session.steps.ts` wait for an `async-rewake-summary` record after the hook's end line.

</code_context>

<specifics>
## Specific Ideas

- A Stop scenario: an `asyncRewake` Stop hook with `on reentry: allow` exits 2 after the first reply; the model wakes with `Stop hook blocking error from command "Stop": <stderr>`, the user sees `Stop hook feedback`, and the Stop hook's run after the woken turn sees `stop_hook_active: true` and exits 0, so the model wakes once.
- An exit-2 rewake while a slow tool runs reaches the model at the next turn boundary of the same run (steer), if the planner finds a race-free way to time the exit inside the tool's run; otherwise the lane is covered by unit tests only, and the plan says so.

</specifics>

<deferred>
## Deferred Ideas

Each is a parent line for `.planning/BACKLOG.md` and a dubious choice:

- Claude Code runs an `asyncRewake` hook synchronously in a non-interactive session without streaming input (`claude -p`); Pi's print and json modes are its analog. No harness runs a prompt in those modes, and the frozen harness cannot gain one.
- The `rewakeSummary` override from a JSON line on stdout, which Claude Code honors only for a plugin of an official marketplace.
- Claude Code's special exit-2 message for a hook whose script cannot be opened, and its suppression of identical repeats.
- Two live Pi processes in one scope share its PID table: one's start reaps the other's live hook processes, and the last writer's rows win. It predates this phase in the user scope; D-BG-207 extends the same reap to the project scope.
- A plain async hook's context reaching the model at a tool boundary of a running turn: Pi has no lane that delivers to the next model call of the same run without continuing a turn that would otherwise end, so it waits for the next prompt.
- Claude Code's sanitizing of the summary and body (whitespace collapse and a length cap on the summary, redaction of some keys, escaping a trailing `<`).
- The `{"async": true}` first stdout line that turns a synchronous hook asynchronous at run time.

</deferred>
