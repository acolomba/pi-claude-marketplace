---
phase: quick-261123-jdc
plan: 01
type: execute
wave: 1
quick_id: 261123-jdc
depends_on: []
files_modified:
  - features/hook/session.feature
  - extensions/pi-claude-marketplace/bridges/hooks/late-session-start.ts
  - test/bridges/hooks/late-session-start.test.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - test/bridges/hooks/dispatch.test.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - test/bridges/hooks/event-router.test.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - test/bridges/hooks/event-adapters.test.ts
  - docs/hooks-compatibility.md
  - .planning/PROJECT.md
  - .planning/quick/261123-jdc-hooklatess-01-late-sessionstart-for-plug/261123-jdc-SUMMARY.md
autonomous: true
requirements:
  - HOOKLATESS-01
must_haves:
  truths:
    - "In json mode, a plugin that the load's autoapply installs runs its SessionStart hooks in the same session with source startup, after the session's own SessionStart, and the plugin installed before Pi started does not run its SessionStart hook a second time (scenario at `features/hook/session.feature:584`, HOOKLATESS-D1)."
    - "The late run sends the source of the session's own SessionStart dispatch (`startup`, `resume`, or `fork`) and runs only the plugins, keyed `<plugin>@<marketplace>` in either scope, that hold a SessionStart route after the load and held none at that dispatch; matchers still select on the source (leaf, dispatch, and router rows)."
    - "No late SessionStart runs in tui mode, on a reload, at a second load, after a new session (source `clear`), or in a pi-subagents child, and a `/claude:plugin` command never starts one, because only the extension's `resources_discover` handler calls it (router rows)."
    - "Nothing throws past `resources_discover`: a late run that fails before its hooks start writes `[hooks] late SessionStart skipped: <error>`, a run whose hooks fail writes `[hooks] late SessionStart failed: <error>`, and the load goes on (NFR-2 router rows); the bridge still registers exactly 15 `pi.on` call sites."
    - "The load waits at most 10 seconds for the late run, as Claude Code 2.1.330's `S5()`: a run that ends sooner delivers its context at once; a run that passes 10 seconds lets Pi go on to the first prompt and keeps running, and when it ends its context waits for the next prompt (`deliverAs: \"nextTurn\"`), as Claude Code holds a late hook's rows until the next turn's input (router and adapter rows, fake timers)."
    - "The scenario failed in its `Then` on the code without the fix (R0, logged before the first commit), and breaks B1, B2, and B3 on the bound commit each fail the same `Then`, with `extensions/` restored clean; `check-red.mjs` prints `RED-PROOFS OK` for the `red-` and the `fix-` tables."
    - "The six changed source pairs keep 100% direct coverage, `check:static` passes, and every scenario of `features/hook`, `features/plugin/autoapply.feature`, and `features/plugin/subagent-child.feature` passes under the adapter profile on the bound commit."
    - "`docs/hooks-compatibility.md` and the `.planning/PROJECT.md` row HOOKLATESS-D1 state the rule, the reading of the `/clear` question, the tui parity, the 10-second wait with next-prompt delivery, and the one Pi gap (a context held for the next prompt lives in Pi's memory only), and record no open divergence."
  artifacts:
    - path: extensions/pi-claude-marketplace/bridges/hooks/late-session-start.ts
      provides: "the late SessionStart ledger (what the session's SessionStart saw, taken once by a load) and the dispatch filter for the plugins a late run names"
      exports: ["LateSessionStart", "LateSessionStartLedger", "createLateSessionStartLedger", "sessionStartRunsPlugin"]
    - path: test/bridges/hooks/late-session-start.test.ts
      provides: "the leaf's own 14 cases, 100% direct coverage alone"
    - path: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
      provides: "`HooksBridge`, the ledger record in the session_start callback, and the late run that `registerHooksBridge` returns, raced against the 10-second wait"
      contains: "const LATE_SESSION_START_WAIT_MS = 10_000;"
    - path: extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
      provides: "the next-prompt delivery of a SessionStart context whose late run passed the wait"
      contains: "{ deliverAs: \"nextTurn\" }"
    - path: features/hook/session.feature
      provides: "the json-mode scenario at line 584"
      contains: "Scenario: A plugin that autoapply installs as pi starts in json mode runs its session start hooks without running the others twice"
    - path: docs/hooks-compatibility.md
      provides: "the late SessionStart rules, the cases with no late run, and the one difference"
      contains: "### Plugins that a load activates"
    - path: .planning/PROJECT.md
      provides: "the Key Decisions row HOOKLATESS-D1"
      contains: "HOOKLATESS-D1"
  key_links:
    - from: extensions/pi-claude-marketplace/index.ts
      to: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
      via: "`registerHooksBridge` resolves to the `HooksBridge`; `prepareResources` calls `hooksBridge.runLateSessionStart(event.reason, ctx)` as its last statement, after the load reconcile, the PATH recompute, and the option variables"
      pattern: "await hooksBridge\\.runLateSessionStart\\(event\\.reason, ctx\\);"
    - from: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
      to: extensions/pi-claude-marketplace/bridges/hooks/late-session-start.ts
      via: "the session_start callback records its source and the SessionStart bucket right before it dispatches; the late run takes the owed plugins once"
      pattern: "lateSessionStart\\.recordDispatch\\(source, routingState\\.getRoutingBucket\\(\"SessionStart\"\\)\\);"
    - from: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
      to: extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
      via: "the late run dispatches the SessionStart composite handler with `newPluginsOnly`, which `entryFires` reads through `sessionStartRunsPlugin`, and races it against `LATE_SESSION_START_WAIT_MS` through `settlesWithin`"
      pattern: "const run = sessionStartHandler\\(event, ctx\\)\\.catch\\(\\(err: unknown\\) => \\{"
    - from: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
      to: extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
      via: "the late event's `heldForNextPrompt` hint, read when the hooks end, turns the context send into `deliverAs: \"nextTurn\"` once the wait has passed"
      pattern: "nextTurn: start\\.event\\.heldForNextPrompt\\?\\.\\(\\) === true,"
    - from: features/hook/session.feature
      to: extensions/pi-claude-marketplace/index.ts
      via: "the one-shot Pi's load autoapplies `late`, then `prepareResources` runs the late SessionStart, which records `late-start` with source startup"
---

# Quick 261123-jdc: a plugin that a load's autoapply activates runs its SessionStart hooks

<objective>
Close HOOKLATESS-01 (`.planning/BACKLOG.md:5530`) with option A of
`.planning/research/HOOKLATESS-01-UPSTREAM.md`, the orchestrator's binding choice: match Claude
Code 2.1.330's late SessionStart. Today a plugin that the load's autoapply installs or enables in
`resources_discover`, which Pi emits after the awaited `session_start`, gets no SessionStart run in
that session. After this plan, in print, json, and rpc mode only, a load with Pi's `startup`
resources reason runs SessionStart once for the plugins that gained a SessionStart route since the
session's own SessionStart dispatch, with that dispatch's source, and with no other plugin's hooks.
The load waits at most 10 seconds for that run, as Claude Code does; a run that takes longer goes
on while Pi takes the first prompt, and its context waits for the next prompt.
Decision ID: HOOKLATESS-D1 (new; D-CF5-03 stays as it is).

Test first: the scenario fails in its `Then` on today's code (R0, logged, never committed). Then
the leaf, the dispatch filter, the router's ledger and late run, and the entry wiring go in with
their unit rows, all nine files in one commit. The 10-second wait and the next-prompt delivery go
in a second commit of five files, with their own red unit rows under fake timers. Breaks B1, B2,
and B3 on that second commit fail the same `Then`. The docs and the decision row follow in two
commits of their own.

Purpose: the AGENTS.md upstream-parity constraint, and its rule that a user-visible change ships
with a scenario that fails without it.

Output: four commits (the late run; its wait; the hooks docs; the decision row) and
`261123-jdc-SUMMARY.md` with the red proofs, the checks, the decisions, and the lines for the
orchestrator.
</objective>

<execution_context>
@/home/user/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/user/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@.planning/research/HOOKLATESS-01-UPSTREAM.md
@.agents/skills/cucumber/rules/features.md
@.agents/skills/cucumber/rules/steps.md
@.agents/skills/typescript-unit-tests/rules/cases.md
@.agents/skills/typescript-unit-tests/rules/test-doubles.md
@.agents/skills/typescript-style/rules/comments.md
@.agents/skills/local-verification/rules/commands.md
@.agents/skills/committing/SKILL.md

The research is the evidence for this plan. Read its "Answer in brief", sections 1 and 2, and
"Confidence and open points". Where this plan and the research differ, this plan wins. All line
numbers below were read at b59921f; its `extensions/`, `features/`, `test/`, and `docs/` equal
those of 1c9ae0b.

**Orchestrator decisions (binding).** (1) Upstream parity needs no license, so option A is
planned; option B (a run after a command install) is out of scope. (2) The `/clear` question is
settled from the binary when it can be, else the narrowest reading. (3) The terminal runs none,
because upstream runs the late SessionStart only in its headless runner.

**The `/clear` question, settled from the binary.** Read on `/opt/claude-code/bin/claude`
(`claude --version` prints 2.1.330), byte offsets from `grep -boa`:

- `bge(){return tgs.of(N())}` @323940303 is the only use of the store `tgs` (@323940316, no
  `drop`), and its `nVn` record holds `startSource` and `pluginsCovered`. `ze.of(e)` keys a
  WeakMap by `e.root` (@310507188), `N()` returns the current session object (`n(){return
  C()?.session??y}`, @310610632), and a root session's `root` is itself (`get
  root(){return e.kind==="fork"?e.root:p}`, @~310581000).
- `/clear`'s `regenerateSessionId` (`noa`, @310611421) calls `t.update({id:i,...})` on the same
  session object `n()`. So `/clear` replaces neither the record nor its start source.
- `tAe` sets `startSource` on every `startup`, `resume`, or `fork` dispatch and never on `clear`
  or `compact` (@323943667); `onMatched` returns at once for `compact`.
- The launch trigger T1 is consumed once (`takeNewPluginsSessionStart:()=>{if(!Gy)return;return
  Gy=!1,ib(zf)}`, research section 1), and `ib` (@351776042) drops the late rows when a `/clear`
  came between (`let{clears:D}=e ... if(e.clears===D)_U(e,G)`), the 2.1.296 fix.

So upstream runs the late hooks at most once per launch, before its first command, and a `/clear`
starts no new late run. Pi rebuilds the extension runtime for every session replacement
(`core/agent-session-runtime.js:146-175`, `newSession` -> `createRuntime`), so the bridge's state
is per Pi session. The reading that follows, which is also the narrowest one: a Pi new session
(`/new`, RPC `new_session`; its SessionStart sends `clear`) records no start source, so its load
runs no late SessionStart, and a session runs at most one late SessionStart, at its first load.

**Which plugins are owed.** Upstream owes each plugin with a SessionStart hook that no earlier
non-compact dispatch matched (`Abt` @323940328). The bridge keys a plugin as
`<pluginId>@<marketplace>`, scope-less, as upstream's plugin id, and owes the plugins that hold a
SessionStart route after the load and held none at the session's SessionStart dispatch. That is the
narrowest reading of "the plugins the load's autoapply activated": a load changes installation
state only through autoapply (APL-D1, AAP-D1), and a plugin that held a route at the dispatch but
did not match it cannot match a late run either, because the late run sends the same source to the
same matchers. Record the residual in the decision row: a project scope whose hook read failed at
the session's start and succeeds at the load counts as activated.

**The 10-second wait, and what upstream does after it (read 2026-11-23 on the same binary).**
Pi 1.5.1 awaits every `resources_discover` handler before the first prompt
(`core/agent-session.js:2776-2778`), so an unbounded await would hold the first prompt for as long
as the hooks run. Pi does not stop an extension from bounding its own wait, so this is no Pi
capability gap, and the bridge matches upstream:

- The wait. `S5(){return 1e4}` @351774140. `ib` (@351776042) starts the dispatch as `K`, keeps
  `{clears:D}`, and returns `me(K,S5()).then(()=>{I=!R})`, a race of the run against 10 s; `I`
  ("turn went ahead") is set when the run had not ended. T1 (@351596409) yields that race before
  the first message runs, so the first turn starts when the run ends or after 10 s, whichever
  comes first, and the run goes on; a failure after the race is caught (`.catch(pU)`).
- The output of a run that ends. `_U({conversation,append,waiting},rows)` (@351775390) first drops
  the rows the conversation already holds (`W6e`). If the conversation ends with an open tool call
  (`vQ` @321449261: an assistant `tool_use` with no `tool_result` yet), every row waits.
  Otherwise it appends the rows at once, with each context row (`hook_success` with content,
  `hook_additional_context`) emptied and its content kept as `heldContent` (`w5` @351774165), and
  queues the full context rows. `wU` flushes the queue into the conversation in `beforeTurnInput`
  (@~352053500), before the next turn's input, and skips while a tool call is open. So the model
  reads a late hook's context with the next user input after the hooks end, also within 10 s (the
  first turn's `beforeTurnInput` comes after T1's race). A `hook_system_message` row (the
  executor's `systemMessage` row, @326982719) is appended at once, unless a tool call is open.
- The mapping. A run that ends within 10 s keeps today's delivery: the context goes into the
  session at once (`triggerTurn: false` while Pi is idle), so the first prompt's model call reads
  it, as upstream's first `beforeTurnInput` does. A run that ends after the first prompt went
  ahead sends its context with `deliverAs: "nextTurn"`, which Pi holds for the next prompt
  (`sendCustomMessage`, `core/agent-session.js:1956-1958`), the counterpart of `wU` in
  `beforeTurnInput`, whatever the run is doing then. Its notices show when the hooks end, through
  the existing notice path: the bridge shows a `systemMessage` as a notice outside the
  conversation (D-CF5-14), so it has no tool call to wait behind.
- The one Pi gap, recorded with this evidence. Pi keeps a `nextTurn` message in memory only
  (`this._pendingNextTurnMessages.push(appMessage)`, `core/agent-session.js:1957`), and its
  `sendCustomMessage` has no form that stores a message and holds it from the model until the
  next prompt. So a late context that waits for the next prompt is lost when Pi ends first, where
  Claude Code's held rows stay in its transcript and a later process restores them (`v5`/`hU`,
  "SessionStart hook output an earlier worker set aside"). A resumed Pi session runs the plugin's
  SessionStart with source `resume` anyway, because the plugin is installed by then.

**The defect at b59921f.** `bridges/hooks/event-router.ts:1574-1653` dispatches SessionStart only
in the `session_start` callback (with the SSDEDUP-01 guard, the lazy project hydrate, the
`prepareSessionStartDataDirs` call at `:1622`, the reload return at `:1629-1631`, and the dispatch
at `:1633-1643`). `extensions/pi-claude-marketplace/index.ts:192-261` (`prepareResources`) runs the
load reconcile, whose autoapply installs plugins and rebuilds the routes, and nothing runs their
SessionStart afterwards.

**The fix.** Code with no branch the rows below do not cover. Comments follow the comments rule:
simple English, durable IDs (HOOKLATESS-D1, NFR-2, D-CF5-03), no planning reference.

1. New leaf `extensions/pi-claude-marketplace/bridges/hooks/late-session-start.ts` (fallow zone
   `bridges-hooks`). Its only imports are type imports of `SessionStartSource`
   (`../../domain/components/hook-events.ts`), `ClaudeSessionStartEvent`
   (`./payloads/session-start.ts`), and `RoutingEntry` (`./routing-state.ts`). A file header in
   the style of its siblings (`// bridges/hooks/late-session-start.ts` then `//` lines) says: the
   SessionStart that Claude Code runs for a plugin that loads after the session started
   (HOOKLATESS-D1); Claude Code 2.1.330 runs it in its headless runner once, at its first command,
   for each plugin with a SessionStart hook that no earlier SessionStart of the session matched,
   with the session's start source; the ledger keeps what the session's own dispatch saw, its
   source when that is `startup`, `resume`, or `fork` and the plugins that held a SessionStart
   route then, and a load takes it once; a `clear` dispatch records nothing, because Claude Code
   keeps the start source of its launch across `/clear` and runs the late hooks once. Contents:
   - Every route parameter of the leaf is typed `Pick<RoutingEntry, "pluginId" | "marketplace">`
     (a bucket is `readonly Pick<RoutingEntry, "pluginId" | "marketplace">[]`), written inline in
     each signature: the leaf reads only those two fields, the router and dispatch pass whole
     routes, and no local type alias leaks from an exported signature (fallow
     `private-type-leaks`).
   - Module-private `sessionStartPlugin(entry)`, returning
     `` `${entry.pluginId}@${entry.marketplace}` ``, with a comment: a plugin as Claude Code names
     it, the same in either scope.
   - Module-private `pluginsOf(bucket): Set<string>`, the set of `sessionStartPlugin` over the
     bucket, and the module-private constant `START_SOURCES: ReadonlySet<SessionStartSource>` of
     `"startup"`, `"resume"`, and `"fork"`.
   - `export interface LateSessionStart` with readonly `source: SessionStartSource` and readonly
     `plugins: ReadonlySet<string>`; JSDoc: the late SessionStart a load owes.
   - `export interface LateSessionStartLedger` with readonly `recordDispatch: (source:
     SessionStartSource, bucket) => void` and readonly `takeLateRun: (bucket) =>
     LateSessionStart | undefined`, each with a JSDoc line.
   - `export function createLateSessionStartLedger(): LateSessionStartLedger`, whose closure holds
     `let recorded: { readonly source: SessionStartSource; readonly seen: ReadonlySet<string> } |
     undefined`. `recordDispatch` sets `recorded = { source, seen: pluginsOf(bucket) }` only when
     `START_SOURCES` has the source. `takeLateRun` reads `recorded` into `taken`, sets `recorded`
     to undefined, returns undefined when `taken` is undefined, and otherwise builds `plugins` from
     the bucket's plugins less `taken.seen` and returns undefined when it is empty, else
     `{ source: taken.source, plugins }`. Its filter line is prescribed below (the old text of B3).
   - `export function sessionStartRunsPlugin(event: ClaudeSessionStartEvent, entry): boolean`,
     JSDoc: whether a SessionStart dispatch runs the hooks of `entry`, every plugin's,
     or only those of the plugins that a late run names (HOOKLATESS-D1). Body: `const plugins =
     event.newPluginsOnly;` then the prescribed return line (the old text of B2). Prettier puts the
     two parameters on lines of their own.

2. `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts`: `ClaudeSessionStartEvent`
   (`:26-35`) gains, after `nextCallReadsSteer`, the field `readonly newPluginsOnly?:
   ReadonlySet<string>;` with a JSDoc in the style of `nextCallReadsSteer`'s: set by the late run
   of a load (HOOKLATESS-D1), the plugins, as `<plugin>@<marketplace>`, whose hooks the dispatch
   runs, as Claude Code's `newPluginsOnly`; dispatch selects on it, and `translateSessionStart`
   never writes it to stdin. No other change in the file.

3. `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`: add
   `import { sessionStartRunsPlugin } from "./late-session-start.ts";` between the
   `./if-field/index.ts` import (`:92`) and the `./mcp-tool-view.ts` import (`:93`). In
   `entryFires` (`:1656-1674`), right before the `const value = matchValue(...)` line, add an `if`
   whose condition is `claudeEvent === "SessionStart" && !sessionStartRunsPlugin(view.event as
   ClaudeSessionStartEvent, entry)` and whose body returns false, with a one-line comment: a late
   SessionStart runs only the hooks of the plugins that it names (HOOKLATESS-D1). Prettier breaks
   the condition over three lines. Nothing else in the file changes.

4. `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`:
   - Import `createLateSessionStartLedger` and `type LateSessionStartLedger` from
     `./late-session-start.ts` in one value import placed after the `./if-field/index.ts` import
     (`:94`) and before `./mcp-server-table.ts` (`:95`). Add `ResourcesDiscoverEvent` to the type
     import from `../../platform/pi-api.ts` (`:122-134`) in its sorted place.
   - Add `export interface HooksBridge` after `HooksHydration` (`:818-833`), with readonly
     `runLateSessionStart: (reason: ResourcesDiscoverEvent["reason"], ctx: ExtensionContext) =>
     Promise<void>` and a JSDoc: what a registered bridge gives the extension's load
     (HOOKLATESS-D1); after a load with Pi's `startup` resources reason, in print, json, or rpc
     mode, it runs SessionStart once for the plugins that gained a SessionStart route since the
     session's own SessionStart, with that run's source, as Claude Code's headless runner does for
     a plugin that loads after the session started; it never throws (NFR-2). Change
     `HooksHydration.registerHooksBridge` to resolve to `Promise<HooksBridge>` and say so in a
     JSDoc line.
   - Near `NO_LAUNCH_FACTS` (`:201`), add the prescribed constant line
     `LATE_SESSION_START_MODES` (the modes of Claude Code's headless runner, HOOKLATESS-D1).
   - Add the module-private factory `lateSessionStartRun(ledger: LateSessionStartLedger,
     sessionStartHandler: CompositeHandler<"SessionStart">, routingState: EventRouterRoutingState,
     generationIsCurrent: GenerationGuard): HooksBridge["runLateSessionStart"]`, placed right
     after `prepareSessionStartDataDirs` (`:1295-1313`), with a JSDoc that states the order and the
     reasons. It returns an async arrow `(reason, ctx)` whose whole body is one `try`: first `const
     late = ledger.takeLateRun(routingState.getRoutingBucket("SessionStart"));`, so the ledger is
     taken by the first load whatever follows; then one `if` that returns when `late === undefined
     || reason !== "startup" || !LATE_SESSION_START_MODES.has(requireNotificationMode(ctx.mode))`
     (one `||` chain, mode read last, so a load with nothing owed reads nothing of `ctx`); then
     `await prepareSessionStartDataDirs(routingState, ctx, generationIsCurrent);` with its result
     not read and a comment that the handler checks the generation itself; then the prescribed
     dispatch line (item 6 replaces it with the tail that bounds the wait). Its `catch (err:
     unknown)` writes
     `` hookDebugLog(`late SessionStart skipped: ${errorMessage(err)}`) ``.
   - In `registerHooksBridgeWith` (`:1484`): after the `generationIsCurrent` line (`:1492`), add
     `const lateSessionStart = createLateSessionStartLedger();` with a comment: what this
     generation's SessionStart dispatch saw, for the load after it (HOOKLATESS-D1). In the
     `session_start` callback's dispatch block (`:1634-1643`), keep `launch`, then compute `const
     source = claudeSessionStartSource(event.reason, launch);`, then the prescribed record line,
     then `await sessionStartHandler({ source }, ctx);`. After the last `pi.on` (`:1809-1818`),
     return `{ runLateSessionStart: lateSessionStartRun(lateSessionStart, compositeHandlerFor(runtime,
     "SessionStart", capturedGeneration, pi, opts.executor), routingState, generationIsCurrent) }`.
     The function now resolves to `Promise<HooksBridge>`; extend its JSDoc step list with a step 7:
     return the late SessionStart run of this generation (HOOKLATESS-D1). Register no new `pi.on`.
   - In `createHooksHydration` (`:1842-1872`), `registerHooksBridge` returns
     `registerHooksBridgeWith(runtime, reader, pi, opts)` with the return type
     `Promise<HooksBridge>`.

5. `extensions/pi-claude-marketplace/index.ts`: `:187` becomes `const hooksBridge = await
   hooksHydration.registerHooksBridge(pi, {` with the same options. Add one sentence to the comment
   above it (`:163-186`): the registration returns the late SessionStart run that the load calls
   (HOOKLATESS-D1). As the last statement of `prepareResources`, after the
   `applyOptionVariablesWith` line (`:260`), add the prescribed call line, behind a comment: the
   plugins that this load's autoapply activated run their SessionStart hooks in print, json, and
   rpc mode, as Claude Code's headless runner runs a plugin that loads after the session started
   (HOOKLATESS-D1); it comes last, so the hooks see this load's plugin PATH and option variables,
   and it catches its own failure (NFR-2). Add no `try` in `index.ts`: the run cannot throw, and
   the handler's own `try` (`:276-280`) stays the last guard. `test/index.test.ts` needs no change:
   none of its cases records a session SessionStart and then adds a route before a load, so the
   new call reads nothing of `ctx` there.

6. The 10-second wait (Task 2, its own commit; items 1 to 5 stay as they are):
   - `bridges/hooks/payloads/session-start.ts`: `ClaudeSessionStartEvent` gains, after
     `newPluginsOnly`, `readonly heldForNextPrompt?: () => boolean;` with a JSDoc: set by the late
     run of a load (HOOKLATESS-D1); called when the hooks end, it says whether Pi already went on
     to the first prompt after the 10-second wait, so the context waits for the next prompt, as
     Claude Code holds a late hook's rows until the next turn's input; dispatch never matches on
     it, and `translateSessionStart` never writes it to stdin.
   - `bridges/hooks/event-adapters.ts`: `HookContextSend` (`:580-583`) gains `readonly nextTurn?:
     boolean;`. `sendSessionStartContext` (`:847-867`) passes `nextTurn:
     start.event.heldForNextPrompt?.() === true,` right after its `steer:` line (`:864`). In
     `sendHookContextMessage` (`:599-624`), the second argument of `pi.sendMessage` (`:619`)
     becomes `contextDelivery(send)`, a new module-private function placed right before
     `sendHookContextMessage`: it returns `{ deliverAs: "steer" }` when `send.steer === true`,
     else `{ deliverAs: "nextTurn" }` when `send.nextTurn === true`, else `{ triggerTurn: false }`
     (an `if`, then one conditional expression, never a nested one, for
     `sonarjs/no-nested-conditional`). Extend the JSDoc of `sendHookContextMessage`: with
     `send.nextTurn`, a late SessionStart context whose run passed the wait is held for the next
     prompt (`deliverAs: "nextTurn"`), as Claude Code flushes held late rows before the next
     turn's input (HOOKLATESS-D1).
   - `bridges/hooks/event-router.ts`: add `type ClaudeSessionStartEvent` to the existing type
     import from `./payloads/session-start.ts` (`:144`). Add the prescribed constant
     `LATE_SESSION_START_WAIT_MS` beside `LATE_SESSION_START_MODES`, with a comment: how long
     Claude Code waits for the late hooks before its turn goes ahead (`S5()`, HOOKLATESS-D1). Add
     the module-private `async function settlesWithin(promise: Promise<unknown>, ms: number):
     Promise<boolean>` right before `lateSessionStartRun`, with a comment: whether `promise`
     settles within `ms`; the timer never outlives the race. Its body declares `let timer:
     ReturnType<typeof setTimeout> | undefined;`, builds `elapsed` as a `Promise<boolean>` whose
     executor sets `timer = setTimeout(() => { resolve(false); }, ms);`, and returns `await
     Promise.race([promise.then(() => true), elapsed])` inside a `try` whose `finally` calls
     `clearTimeout(timer)`. In `lateSessionStartRun`, the prescribed dispatch line of item 4 is
     replaced by the prescribed tail below: `let wentAhead = false;`, the event with
     `heldForNextPrompt: () => wentAhead`, the run with its own `.catch` that writes
     `` hookDebugLog(`late SessionStart failed: ${errorMessage(err)}`) ``, and the race. Extend
     the JSDoc of `lateSessionStartRun` and of `HooksBridge.runLateSessionStart`: the load waits
     at most 10 seconds; a run that takes longer goes on, and its context waits for the next
     prompt.

The prescribed lines, as Prettier formats them. Items 1 to 5 write the first six; Task 2 replaces
the first one with the tail that follows them. B1, B2, and B3 replace the tail's `run` line and
the second and third lines:

```ts
      await sessionStartHandler({ source: late.source, newPluginsOnly: late.plugins }, ctx);
```

```ts
  return plugins === undefined || plugins.has(sessionStartPlugin(entry));
```

```ts
      const plugins = new Set([...pluginsOf(bucket)].filter((plugin) => !taken.seen.has(plugin)));
```

```ts
const LATE_SESSION_START_MODES: ReadonlySet<ExtensionMode> = new Set(["print", "json", "rpc"]);
```

```ts
            lateSessionStart.recordDispatch(source, routingState.getRoutingBucket("SessionStart"));
```

```ts
    await hooksBridge.runLateSessionStart(event.reason, ctx);
```

The tail of `lateSessionStartRun` after Task 2, and its constant:

```ts
      let wentAhead = false;
      const event: ClaudeSessionStartEvent = {
        source: late.source,
        newPluginsOnly: late.plugins,
        heldForNextPrompt: () => wentAhead,
      };
      const run = sessionStartHandler(event, ctx).catch((err: unknown) => {
        hookDebugLog(`late SessionStart failed: ${errorMessage(err)}`);
      });
      wentAhead = !(await settlesWithin(run, LATE_SESSION_START_WAIT_MS));
```

```ts
const LATE_SESSION_START_WAIT_MS = 10_000;
```

The `wentAhead` flag is set after the race, so a run that ends within the wait reads `false` when
its hooks end and sends its context at once, and a run that is still going when the wait passes
reads `true` when its hooks end later.

**The break files.** Each is a JSON array of `[file, old, new]` triples, `file` relative to
`extensions/pi-claude-marketplace/`, written by Task 1, step 1. They run on the Task 2 commit:

- `R0.json`: `[]` (the natural red runs on the code without the fix).
- `B1.json`: `[["bridges/hooks/event-router.ts", "const run = sessionStartHandler(event, ctx).catch((err: unknown) => {", "const run = Promise.resolve().catch((err: unknown) => {"]]` (the late run dispatches nothing).
- `B2.json`: `[["bridges/hooks/late-session-start.ts", "return plugins === undefined || plugins.has(sessionStartPlugin(entry));", "return true;"]]` (the late dispatch runs every plugin's hooks).
- `B3.json`: `[["bridges/hooks/late-session-start.ts", ".filter((plugin) => !taken.seen.has(plugin))", ".filter(() => true)"]]` (the ledger owes every plugin, the ones the session's SessionStart saw too).

**The scenario.** Task 1 appends it to `features/hook/session.feature`, after its last line (582),
with one blank line before it, so its `Scenario:` line is 584. It uses only existing steps, names
no MCP step, table cell, or doc string, and so carries no implementation tag (DUAL-02): the adapter
profile runs it and the builtin profile selects no scenario of the file. Align every column as
`features/hook/session-end.feature:39-42` aligns its runs table.

```gherkin
  Scenario: A plugin that autoapply installs as pi starts in json mode runs its session start hooks without running the others twice
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | early | 1.0.0   |
      | late  | 1.0.0   |
    Given the published plugin "early" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name        | event        | matcher |
      | early-start | SessionStart | *       |
    Given the published plugin "late" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name       | event        | matcher |
      | late-start | SessionStart | *       |
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install early@fixtures --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | early  |         |
      | fixtures    | late   |         |
    When the user runs "/claude:plugin list" in pi's json mode with the hooks recording
    Then the hooks record these runs:
      | event        | session | source  | model  | cwd           | transcript path | arguments   | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                         | CLAUDE_PLUGIN_DATA                                          | CLAUDE_ENV_FILE                                                           | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionStart | first   | startup | faux-1 | {project dir} |                 | early-start | {project dir}      | {home}/marketplaces/fixtures/plugins/early | {project dir}/.pi/pi-claude-marketplace/data/fixtures/early | {project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-first.env | first                  | first             | 1          |
      | SessionStart | first   | startup | faux-1 | {project dir} |                 | late-start  | {project dir}      | {home}/marketplaces/fixtures/plugins/late  | {project dir}/.pi/pi-claude-marketplace/data/fixtures/late  | {project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-first.env | first                  | first             | 1          |
```

Why each step is there: the profile Pi starts first, so its own load ran before the config turned
autoapply on; `early` is installed before the one-shot Pi starts, so the session's SessionStart
runs it; the plugins table declares `late`, so only the one-shot Pi's load installs it (the
`with this text` step comes first because it replaces the whole file, and the two later writers
keep the other members, as `features/plugin/autoapply.feature:7-21` does). On the code without the
fix the runs hold the `early-start` row only, so the `Then` at
`features/step_definitions/hook/runs.steps.ts:164` fails: `11 steps (10 passed, 1 failed)`. A
plausible wrong fix that runs every plugin's SessionStart again shows a second `early-start` row
(B2, B3), and one that runs none shows no `late-start` row (B1).

**The docs section.** Task 3 inserts it into `docs/hooks-compatibility.md` at line 145, right
before `### Compaction`, followed by one blank line, so the heading is at line 145 and
`### Compaction` moves to the line after the section. No table changes. Plain ASCII only (the
dash and smart-quote fixers rewrite other characters):

```markdown
### Plugins that a load activates

A load with `autoapply` on can install or enable a plugin after the session's `SessionStart` hooks ran, because Pi runs the load after `session_start` (AAP-01). In print, JSON, and RPC mode, the bridge then runs `SessionStart` for those plugins, as Claude Code 2.1.330 does in its headless mode for a plugin that its settings install adds at launch (HOOKLATESS-D1). This late run follows these rules:

- It runs the hooks of each plugin that has a `SessionStart` hook after the load and had none when the session's `SessionStart` ran. A plugin is its name and its marketplace, in either scope. No other plugin's hooks run again.
- It sends the `source` of the session's own `SessionStart` run, `startup`, `resume`, or `fork`, and each matcher selects on that value. Its context and its notices take the path of every `SessionStart` run.
- It runs at most once in a session, after the first load. A later load runs none.
- It has no `initialUserMessage` and no `sessionTitle`. Claude Code ignores both fields from such a plugin, and the bridge supports neither.

The bridge runs no late `SessionStart` in these cases:

- In the terminal (`tui` mode), because Claude Code runs the late hooks only in its headless mode.
- On a `/reload`, as Claude Code's `/reload-plugins` runs none (D-CF5-03).
- After a command such as `/claude:plugin install` or `/claude:plugin enable`, which makes the plugin's hooks run at once. Claude Code's SDK `reload_plugins` request, which can add plugins, runs no `SessionStart` either.
- After a new session (`/new`, RPC `new_session`), whose `SessionStart` sends `clear`. Claude Code keeps the start source of its launch across `/clear` and runs the late hooks once, before its first command.
- In a pi-subagents child, which runs no `SessionStart` (see [Hooks in pi-subagents children](#hooks-in-pi-subagents-children)).

The bridge waits at most 10 seconds for the late hooks before Pi takes your first prompt, as Claude Code does. When the hooks take longer, they go on while Pi works on that prompt. When they end, their context waits for your next prompt, as Claude Code holds it until your next turn, and their notices show at once, as every hook notice does (D-CF5-14). Pi keeps a context that waits for the next prompt in memory only, so the context is lost when Pi ends before that prompt. Claude Code saves it with the session, so a resumed session still gets it (a Pi gap).
```

**The decision row.** Task 3 inserts it into `.planning/PROJECT.md` as a new line 2543, right after
the last Key Decisions row (`D-PG11-03`, line 2542) and before the blank line that precedes
`## Evolution`. One line, in the table's three-column form:

```markdown
| **HOOKLATESS-D1 (quick task 261123-jdc, orchestrator decision 2026-11-23, option A of `research/HOOKLATESS-01-UPSTREAM.md`; upstream parity, D-CF5-03 stays): a plugin that a load activates runs its SessionStart hooks in print, json, and rpc mode**: After a load with Pi's `startup` resources reason, the bridge runs SessionStart once for the plugins that hold a SessionStart route after the load and held none at the session's own SessionStart dispatch, keyed `<plugin>@<marketplace>` in either scope, with that dispatch's source (`startup`, `resume`, or `fork`) and with no other plugin's hooks. A load changes installation state only through autoapply (APL-D1, AAP-D1), so these are the plugins its autoapply installed or enabled. No late run in tui mode, on a reload (D-CF5-03), after a `/claude:plugin` command, at a second load, after a new session (source `clear`), or in a pi-subagents child. The `/clear` question is settled from the binary: Claude Code keys its start source and its covered plugins by the root session, which `/clear` keeps (`noa` @310611421 updates the id of the same object, `tgs.of(N())` @323940316 is the store's only use), and its launch trigger runs once (`Gy`), so a new session runs none. The load waits at most 10 s for the late run, as Claude Code races it before its first turn (`S5(){return 1e4}` @351774140, `me(K,S5())` in `ib`). A run that ends later goes on, and its context reaches the model with the next prompt (`deliverAs: "nextTurn"`), as Claude Code holds a late hook's context rows (`w5` @351774165, `_U` @351775390) and flushes them in `beforeTurnInput` (`wU`); its notices show when the hooks end, because the bridge shows a `systemMessage` as a notice outside the conversation (D-CF5-14). Pi gap: Pi keeps a next-turn message in memory only (`core/agent-session.js:1956-1958`) and has no form that stores a message and holds it from the model until the next prompt, so a held context is lost when Pi ends before that prompt, where Claude Code's held rows stay in its transcript (`v5`/`hU`). Residual: a project scope whose hook read failed at the session's start and succeeds at the load counts as activated. | Claude Code 2.1.330 headless runner (`ib` @351776042, `xqa`/`Abt` @323940328, `_U` @351775390, `wU` in `beforeTurnInput`), binary read 2026-11-23; Pi 1.5.1 `core/agent-session.js:1946-1984`; see `research/HOOKLATESS-01-UPSTREAM.md` and `quick/261123-jdc-hooklatess-01-late-sessionstart-for-plug/`. | -- Locked |
```
</context>

## Scope note

One plan, three tasks. Task 1 is the tracer: the whole user-visible slice, test first. Its commit
holds nine files because no smaller commit passes the commit hook and the rules: no commit may hold
a red scenario (the natural red is logged, never committed); `test:corresponding` rejects the leaf
without its test; fallow's dead-code run rejects a ledger or a filter that no production module
calls; and direct coverage rejects `dispatch.ts` or `event-router.ts` without their new rows. Each
added file stays small: the leaf is about 70 lines, and each other source gains under 70. Task 1
keeps the size it had before the wait was added, and it runs only the one scenario and the builtin
check; the long cucumber runs move to Task 2. Task 2 adds the 10-second wait in a commit of its
own, five files (three sources, two tests) that pass the hook alone, then proves the scenario with
three breaks on that commit, which change no tracked file. Task 3 commits the docs and the
decision row, two files that are not build inputs, so the hook runs no npm check for them.

## Execution rules

- `$S` is `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad`.
  This plan's own folder is `$D` = `$S/quick-261123-jdc`, a direct child of `$S`, so `break.sh`,
  copied into it, finds `$S/nondac-sh` and `$S/phase07-heavy.lock` in its parent. Never write to
  another folder of `$S`, and never run a file there.
- Run every command from the root of this plan's own checkout (`git rev-parse --show-toplevel`).
  Every repository path in this plan is relative to that root. Never read, write, or run tests in
  another checkout.
- Put this prefix before every npm script: `npm_config_script_shell=$S/nondac-sh
  NODE_OPTIONS=--max-old-space-size=6144`. Run unit files with a minimal environment, in the form
  of the verify commands: `env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp
  "$S/nondac-sh" -c "node --import \"$PWD/scripts/isolated-pi-home.mjs\" --test
  --test-reporter=spec <files>"`. Run direct coverage with `env -i HOME="$HOME" PATH="$PATH"
  LANG=C.UTF-8 TMPDIR=/tmp CI=1` before the prefix.
- Cucumber needs `fd`: put `$S/gate-bin` first on `PATH` for every cucumber run, a `break.sh` run
  included. Run every cucumber run, the ESLint warm-up, every `check:static`, and every commit
  under `flock -w 3600 "$S/phase07-heavy.lock"`, and pass `--parallel 2` right after
  `--profile <name>` in every cucumber run. `break.sh` takes the lock and `--parallel 2` itself.
- Pass a tool's own flags through `npx` only after `--` (`npx --no -- fallow dupes ...`).
- A cucumber run whose only failures are cucumber step timeouts is evidence of nothing: rerun it
  and keep the rerun's log. Decide a run by its exit status and the log it wrote; never pipe a
  check into `tail`, `head`, or `grep` to judge it. The summary reporter prints a failed scenario
  as `  N) <title> # <file>:<line>` under `Failed scenarios:`, then its failing step, indented
  seven spaces. A `node --test` log is read by its ` tests `, ` pass `, and ` fail ` lines.
- A command that can outlast the tool's foreground limit (the `features/hook` run, about 7
  minutes, `check:static`, about 5 minutes, or any run that waits for the lock) runs with the
  tool's background option; wait for its completion notification and never poll with `sleep`.
- Warm ESLint with one lone `npm run lint` under the lock before the first `check:static`.
- The shell guard may refuse one-line commands that call `git` inside `$(...)`. When it refuses a
  command of this plan, write the command verbatim into a script under `$D` (for example
  `$D/verify-t1-11.sh`), run it with `bash`, and keep the script for the SUMMARY.
- Stage by explicit path only; never `git add -A`, `git add .`, or `git commit -a`. Commit with
  `flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh
  NODE_OPTIONS=--max-old-space-size=6144 git commit -F <message file>` and let the whole hook run
  (`npm run check:commit` for the two code commits). Run it in the foreground with the longest tool
  timeout; when it can outlast the tool's foreground limit, as a code commit can, run it once
  with the tool's background option and wait for its completion notification. Do not run the
  pre-commit tool by hand with a skip list, and never set `SKIP` for a hook: the session's
  exported `SKIP=trufflehog` stays as it is. When a fixer hook changes a file, the commit fails:
  restage that file and commit again. Never `--no-verify`, `--amend`, a rebase, `git stash`, a
  push, or a commit on `main`. Inside a worktree the hook may check nothing, so each code commit
  is preceded by its own `check:static` run and its pairs' direct coverage; the orchestrator's
  post-merge `npm run check` is the full verdict.
- Commit messages follow `.agents/skills/committing/SKILL.md`: a Conventional Commits title of 5
  to 72 characters with no quick id, batch id, backlog id, decision id, milestone, phase, plan,
  wave, or task in the title or scope; body lines of at most 80 characters; the attribution lines
  of your session's instructions at the end. Right after each commit, write `git rev-parse HEAD`
  to `$D/fix-commit`, `$D/bound-commit`, `$D/docs-commit`, or `$D/decision-commit`.
- `break.sh` refuses to run while `extensions/` is dirty; every break runs on a tree whose
  `extensions/` is clean and whose HEAD is the commit that its table set names.
- Edit only the files in `files_modified`. Do not edit `CHANGELOG.md`, `.planning/STATE.md`,
  `.planning/ROADMAP.md`, `.planning/BACKLOG.md`, `cucumber.json`, `.fallowrc.json`, `scripts/**`,
  a CI workflow, a skill rule, `features/support/**`, `features/lib/**`, a step module, or
  `test/index.test.ts`. In `.planning/PROJECT.md`, add only the decision row. A line meant for
  another file goes under "For the orchestrator" in the SUMMARY.
- Add no suppression marker (`fallow-ignore`, `eslint-disable`), no coverage exception, and no
  `.fallowrc.json` entry. Do not copy a row array or a helper body from another case: `fallow
  dupes` fails on every clone group, so shared arrange code goes into the helpers that Task 1
  names. If fallow reports an export or a type of the leaf as unused or leaked, change the export
  set, never the config, and record it in the SUMMARY.
- Rule 4. If a scenario or a unit case outside this plan's own fails on a tree of this plan, stop
  and report it with the log, so the orchestrator can route it.

## Red proofs

`check-red.mjs` reads these tables. The `red-` set is the natural red on the code without the fix
(Task 1, step 3); the `fix-` set is the breaks on the bound commit (Task 2). Each run names the
scenario by its line, 584.

<!-- red-break-runs:begin -->
| break | profile | scenarios | files |
| --- | --- | --- | --- |
| R0 | adapter | 1 | features/hook/session.feature:584 |
<!-- red-break-runs:end -->

<!-- red-must-fail:begin -->
| break | profile | file | title | row |
| --- | --- | --- | --- | --- |
| R0 | adapter | features/hook/session.feature | A plugin that autoapply installs as pi starts in json mode runs its session start hooks without running the others twice | |
<!-- red-must-fail:end -->

<!-- fix-break-runs:begin -->
| break | profile | scenarios | files |
| --- | --- | --- | --- |
| B1 | adapter | 1 | features/hook/session.feature:584 |
| B2 | adapter | 1 | features/hook/session.feature:584 |
| B3 | adapter | 1 | features/hook/session.feature:584 |
<!-- fix-break-runs:end -->

<!-- fix-must-fail:begin -->
| break | profile | file | title | row |
| --- | --- | --- | --- | --- |
| B1 | adapter | features/hook/session.feature | A plugin that autoapply installs as pi starts in json mode runs its session start hooks without running the others twice | |
| B2 | adapter | features/hook/session.feature | A plugin that autoapply installs as pi starts in json mode runs its session start hooks without running the others twice | |
| B3 | adapter | features/hook/session.feature | A plugin that autoapply installs as pi starts in json mode runs its session start hooks without running the others twice | |
<!-- fix-must-fail:end -->

What each break proves (each fails the same `Then`):

- B1 (the late run dispatches nothing): no `late-start` row, which is today's behavior.
- B2 (the dispatch ignores the plugins a late run names): `early-start` runs a second time.
- B3 (the ledger owes the plugins the session's SessionStart saw): `early-start` runs a second
  time through the owed set, not through the filter.

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Run SessionStart for the plugins that a load activates, end to end, test first, in one commit</name>
  <precondition>The file $S/nondac-sh is executable, $S/gate-bin/fd exists, `flock` is on PATH, $S/fix-07b/break.sh and $S/fix-07b/check-red.mjs exist, node_modules/.package-lock.json exists in this checkout, and `git diff --quiet b59921f HEAD -- extensions/ features/ test/ docs/hooks-compatibility.md` exits 0, so the line numbers, the insertion points, and the break sites of this plan apply to this tree.</precondition>
  <reversibility rating="reversible">The change adds a run of hooks that already run at session start and an optional event field that only dispatch reads; reverting the commit restores the old load, and no stored format changes.</reversibility>
  <files>features/hook/session.feature, test/bridges/hooks/late-session-start.test.ts, extensions/pi-claude-marketplace/bridges/hooks/late-session-start.ts, extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts, test/bridges/hooks/dispatch.test.ts, extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts, test/bridges/hooks/event-router.test.ts, extensions/pi-claude-marketplace/bridges/hooks/event-router.ts, extensions/pi-claude-marketplace/index.ts</files>
  <behavior>
    - Scenario `features/hook/session.feature:584`: the runs are `early-start` then `late-start`, both SessionStart with source startup in the first session (fails before the fix: no `late-start` row)
    - Leaf, `sessionStartRunsPlugin` (4 cases): runs the hooks of every plugin when the event names no plugins; runs the hooks of a plugin that the event names; does not run the hooks of a plugin that the event does not name; does not run the hooks of a plugin of the same name from another marketplace
    - Leaf, `createLateSessionStartLedger` (10 cases): owes no late run when no SessionStart dispatch was recorded; owes the plugins that gained a SessionStart route since a `startup`, a `resume`, and a `fork` dispatch, with that source (three rows); records nothing for a `clear` and for a `compact` dispatch (two rows); owes no late run when no plugin gained a route; does not owe a plugin that held a route in the other scope; names a plugin with two new routes once; owes a late run once
    - Dispatch (1 case): runs only the SessionStart hooks of the plugins that a late SessionStart names
    - Router (10 cases, each title ends with `(HOOKLATESS-D1)`, the last with `(HOOKLATESS-D1, NFR-2)`): a print, a json, and an rpc load each runs SessionStart for the plugin that gained a route after the session's SessionStart, with its source (three rows); a load after a resumed launch sends source resume; a tui load runs none; a reload runs none; a second load runs none; a load after a new session runs none; a load in a pi-subagents child runs none; a load whose mode is not a notification mode debug-logs and runs none
  </behavior>
  <action>
    Follow "The fix", "The scenario", the prescribed lines, and the execution rules. The order
    matters: the natural red runs while `extensions/` is still clean.

    1. Create `$D` and `$D/brk`; write `git rev-parse HEAD` to `$D/plan-base`; copy
       `$S/fix-07b/break.sh` and `$S/fix-07b/check-red.mjs` into `$D` unchanged; write
       `$D/brk/R0.json`, `B1.json`, `B2.json`, and `B3.json` as "The break files" gives them.

    2. Append "The scenario" to `features/hook/session.feature` as its context paragraph says.
       Change nothing else in the file. Run `node scripts/check-features.mjs` (exit 0).

    3. The natural red, with `extensions/` clean: `PATH="$S/gate-bin:$PATH" bash "$D/break.sh" R0
       adapter "$D/brk/R0.json" features/hook/session.feature:584`, then `node "$D/check-red.mjs"
       <this plan> "$D" <checkout root> <plan base> red-`, which must print `RED-PROOFS OK`. Read
       `$D/R0-adapter.log`: the `Then` at `features/step_definitions/hook/runs.steps.ts:164` must
       fail with a difference of exactly the missing `late-start` row. If another cell of the
       `early-start` row differs, that cell of the scenario is wrong: set it to the recorded value
       (today's code records that row), rerun R0, and record the change in the SUMMARY. If the run
       fails anywhere else, stop and report it.

    4. Leaf, test first. Write `test/bridges/hooks/late-session-start.test.ts` with the 14 leaf
       cases of the behavior list, one top-level `describe` per export
       (`sessionStartRunsPlugin`, `createLateSessionStartLedger`), each title ending with
       `(HOOKLATESS-D1)`, arrange/act/assert comments, and whole-value assertions (the `source`
       and the `plugins` set together with `assert.deepStrictEqual`). Build each route as a small
       named constant with only `pluginId`, `marketplace`, and `scope` (for example `const
       userDemo = { pluginId: "demo", marketplace: "fixtures", scope: "user" } as const;`), passed
       by name so the excess `scope` field type-checks, and never a whole `RoutingEntry` literal,
       which would clone `createRoutingEntry` of `dispatch.test.ts` for `fallow dupes`; data rows
       are typed and run one `test()` each, with no conditional in the loop body. Run it
       once before the module exists and keep that failing log as `$D/red-unit-leaf.log`. Then
       write the leaf by "The fix", item 1, until all 14 cases pass.

    5. Dispatch, test first. In `test/bridges/hooks/dispatch.test.ts`, add the dispatch case right
       after the `filters SessionStart matchers on the Claude-side source` loop (`:1594-...`),
       titled `runs only the SessionStart hooks of the plugins that a late SessionStart names
       (HOOKLATESS-D1)`, in the form of `:1532-1592`: two SessionStart entries (`session-seen`
       and `session-added`, raw matcher `*`, the default marketplace `dispatch-catalog`), the
       event `{ source: "startup", newPluginsOnly: new Set(["session-added@dispatch-catalog"]) }`
       checked with `satisfies ClaudeSessionStartEvent`, and the expected calls holding only
       `session-added` with that event. Run it with `--test-name-pattern 'HOOKLATESS-D1'` before
       changing `dispatch.ts` and keep that failing log as `$D/red-unit-dispatch.log` (` tests 1`,
       ` pass 0`). Then make "The fix", items 2 and 3.

    6. Router, test first. In `test/bridges/hooks/event-router.test.ts`:
       - Extend `launchRouter` (`:4047-4077`): create the runtime first, keep the resolved value
         of `registerHooksBridge` as `bridge`, and also return `runtime` and `bridge`; the
         `dispatched` records and every existing case stay as they are.
       - Move the object literal of `preToolUseEntry` (`:5445-5459`) into `routeEntry(claudeEvent:
         BucketAEvent, rawMatcher: string, pluginId: string, cwd: string): RoutingEntry`, and make
         `preToolUseEntry` return `routeEntry("PreToolUse", "Bash", pluginId, cwd)`, so a
         SessionStart route reuses the literal instead of cloning it.
       - Add one helper, `sessionWithAddedPlugin(t, options)`, whose `options` hold `mode`,
         `reason`, and an optional `prepare(context)`, with a comment: it registers the bridge,
         runs the session's SessionStart for Pi's `reason` in `mode`, then gives the plugin
         `added` a project-scope SessionStart route (`routeEntry("SessionStart", "*", "added",
         projectRoot)`, appended to `runtime.getRoutingBucket("SessionStart")` through
         `runtime.setRoutingBucket`), as a load's autoapply does, and returns `bridge`, `root`,
         `projectRoot`, `context`, and `dispatched`. Its context is `makeContext(projectRoot,
         root)` behind a `Proxy` that answers `mode` with the given mode, in the form of
         `:3742-3753`. The resumed-launch case passes that context through `withSessionManager`
         with `launchSession(root, { timestamp: LAUNCH_HEADER_TIME }, true)` in `prepare`, before
         the session starts. Task 2 adds one option to the helper, so keep `options` an object.
       - Add one projection, `dispatchSummary(dispatch)`, with a comment: what one dispatch
         received, its scope, its source, and the plugins a late run names. It maps a
         `dispatched` record to `{ scope, source, plugins: [...(event.newPluginsOnly ?? [])] }`,
         reading the event as a `ClaudeSessionStartEvent`; type `launchRouter`'s `dispatched`
         records as `{ readonly scope: string; readonly event: unknown }` for it. The projection
         names every field these cases state and leaves out the delivery hint that Task 2 adds to
         the late event, so no case of this task changes in Task 2.
       - Add the 10 router cases of the behavior list in one block after the D-PG6-14/15 loop
         (`:4079-4133`). Each one asserts the whole `dispatched.map(dispatchSummary)` array: the
         session's two dispatches (`{ scope: "project", source, plugins: [] }` then `{ scope:
         "user", source, plugins: [] }`, with source `clear` for a new session and none at all in
         a child), then, for the four runs, `{ scope: "project", source, plugins: ["added@catalog"]
         }`. The reload
         case calls `runLateSessionStart("reload", context)`. The second-load case calls it, adds a
         second route (`later`), and calls it again. The new-session case starts the session with
         reason `new`. The child case calls `enterChild(t, undefined)` (`:1479`) first. The NFR-2
         case runs the load with a second context whose `mode` answers `web`, and asserts with
         `observeRouterDebug(t)` (`:5284`) the line `[hooks] late SessionStart skipped:
         Unsupported notification mode: web`. Run the 10 with `--test-name-pattern
         'HOOKLATESS-D1'` before changing `event-router.ts`, and keep that failing log as
         `$D/red-unit-router.log` (` tests 10`, ` pass 0`: the old registration resolves to no
         bridge).
       Then make "The fix", items 4 and 5.

    7. Checks, each with its log under `$D`, in the order of the verify block: the five unit
       files; direct coverage of the five pairs; the ESLint warm-up, then `check:static`; the
       scenario under the adapter profile; and `features/hook/session.feature` under the builtin
       profile, which selects no scenario. The autoapply, child, and whole `features/hook` runs
       wait for the final code, in Task 2.

    8. Commit the nine files by path, with a message file `$D/fix-message.txt` whose title is
       `feat(hooks): run session start for plugins that autoapply adds` and whose body says, in
       lines of at most 80 characters, that a plugin that a load's autoapply installed or enabled
       got no SessionStart run in that session; that the bridge now runs SessionStart once after
       the load, in print, json, and rpc mode, for the plugins that gained a SessionStart route
       since the session's own SessionStart, with that run's source, as Claude Code's headless
       runner does; and that the terminal, a reload, a later load, and a new session run none.
       Write the commit to `$D/fix-commit`.
  </action>
  <verify>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; R=$(git rev-parse --show-toplevel); B=$(cat "$D/plan-base"); node "$D/check-red.mjs" .planning/quick/261123-jdc-hooklatess-01-late-sessionstart-for-plug/261123-jdc-PLAN.md "$D" "$R" "$B" red- > "$D/red-check.log" 2>&1; s=$?; echo "exit=$s" >> "$D/red-check.log"; test "$s" -eq 0 && grep -qx 'RED-PROOFS OK' "$D/red-check.log" && grep -qx '11 steps (10 passed, 1 failed)' "$D/R0-adapter.log" && grep -qF '       Then the hooks record these runs: # features/step_definitions/hook/runs.steps.ts:164' "$D/R0-adapter.log" # [HEAD=absent EXPECT==present @b59921f]</automated>
    <fails_when>non-zero exit: the checker printed a `PROBLEM` line (the R0 log is missing, names another checkout root, lacks `restored=clean`, holds a step timeout, lacks `1 scenario (`, ends with `exit=0`, or the scenario failed outside a `When` or a `Then`), or the R0 log lacks the step count or the failing `Then` line</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; grep -q 'ERR_MODULE_NOT_FOUND' "$D/red-unit-leaf.log" && grep -Eq ' fail [1-9][0-9]*$' "$D/red-unit-leaf.log" && grep -Eq ' tests 1$' "$D/red-unit-dispatch.log" && grep -Eq ' pass 0$' "$D/red-unit-dispatch.log" && grep -Eq ' tests 10$' "$D/red-unit-router.log" && grep -Eq ' pass 0$' "$D/red-unit-router.log" # [HEAD=absent EXPECT==present @b59921f]</automated>
    <fails_when>non-zero exit: the leaf's first run did not fail on the missing module, or a new dispatch or router case passed (or was missing) before its source changed</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp "$S/nondac-sh" -c "node --import \"$PWD/scripts/isolated-pi-home.mjs\" --test --test-reporter=spec test/bridges/hooks/late-session-start.test.ts test/bridges/hooks/dispatch.test.ts test/bridges/hooks/event-router.test.ts test/bridges/hooks/payloads/session-start.test.ts test/index.test.ts" > "$D/green-unit.log" 2>&1; s=$?; echo "exit=$s" >> "$D/green-unit.log"; test "$s" -eq 0 && grep -Eq ' tests 699$' "$D/green-unit.log" && grep -Eq ' fail 0$' "$D/green-unit.log" # [HEAD=error:1 EXPECT==699 @b59921f]</automated>
    <fails_when>non-zero exit: a case of the five files fails or does not load, or the log lacks ` tests 699` and ` fail 0` (a case missing, added, or deleted against the behavior list; measured at b59921f: `dispatch.test.ts` 303, `event-router.test.ts` 288, `payloads/session-start.test.ts` 26, `test/index.test.ts` 57, and the leaf file absent; expected: 14 + 304 + 298 + 26 + 57)</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp CI=1 npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/late-session-start.ts extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts extensions/pi-claude-marketplace/bridges/hooks/event-router.ts extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts extensions/pi-claude-marketplace/index.ts > "$D/coverage.log" 2>&1; s=$?; echo "exit=$s" >> "$D/coverage.log"; test "$s" -eq 0 && for f in bridges/hooks/late-session-start.ts bridges/hooks/dispatch.ts bridges/hooks/event-router.ts bridges/hooks/payloads/session-start.ts index.ts; do grep -qF "Direct coverage passed: extensions/pi-claude-marketplace/$f (" "$D/coverage.log" || exit 1; done # [HEAD=absent EXPECT==present @b59921f]</automated>
    <fails_when>non-zero exit: a case of the five pairs fails, or line, function, or branch coverage of one of the five sources is below 100% (the log names it)</fails_when>
    <automated>L=extensions/pi-claude-marketplace/bridges/hooks/late-session-start.ts; grep -q '^export function createLateSessionStartLedger(): LateSessionStartLedger {$' "$L" && grep -q '^export function sessionStartRunsPlugin($' "$L" && grep -qF '  return plugins === undefined || plugins.has(sessionStartPlugin(entry));' "$L" && grep -qF '.filter((plugin) => !taken.seen.has(plugin))' "$L" # [HEAD=error:2 EXPECT==present @b59921f]</automated>
    <fails_when>non-zero exit: the leaf does not exist, or its two exported functions or the B2 and B3 lines differ from the prescribed text</fails_when>
    <automated>ER=extensions/pi-claude-marketplace/bridges/hooks/event-router.ts; test "$(grep -cF 'await sessionStartHandler({ source: late.source, newPluginsOnly: late.plugins }, ctx);' "$ER")" -ge 1 && test "$(grep -cF 'const LATE_SESSION_START_MODES: ReadonlySet<ExtensionMode> = new Set(["print", "json", "rpc"]);' "$ER")" -ge 1 && test "$(grep -cF 'lateSessionStart.recordDispatch(source, routingState.getRoutingBucket("SessionStart"));' "$ER")" -ge 1 && r=$(grep -n '^  pi\.on($' "$ER" | wc -l) && test "$r" -eq 15 # [HEAD=0,0,0,15 EXPECT>=1,>=1,>=1,==15 @b59921f; the last count is of `grep -n` lines, one call site per line]</automated>
    <fails_when>non-zero exit: the router lacks the prescribed dispatch, mode, or record line, or it registers another number of `pi.on` call sites than the 15 of today (each call site opens with a line that is exactly `  pi.on(`)</fails_when>
    <automated>test "$(grep -cF 'await hooksBridge.runLateSessionStart(event.reason, ctx);' extensions/pi-claude-marketplace/index.ts)" -ge 1 && test "$(grep -cF 'const hooksBridge = await hooksHydration.registerHooksBridge(pi, {' extensions/pi-claude-marketplace/index.ts)" -ge 1 && test "$(grep -c 'readonly newPluginsOnly?: ReadonlySet<string>;' extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts)" -ge 1 && test "$(grep -c 'sessionStartRunsPlugin' extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts)" -ge 2 # [HEAD=0,0,0,0 EXPECT>=1,>=1,>=1,>=2 @b59921f]</automated>
    <fails_when>non-zero exit: the entry does not keep the bridge handle or does not call the late run, the event lacks the field, or dispatch does not import and call the filter</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; n=$(grep -n '^  Scenario: A plugin that autoapply installs as pi starts in json mode runs its session start hooks without running the others twice$' features/hook/session.feature) && test "$n" = "584:  Scenario: A plugin that autoapply installs as pi starts in json mode runs its session start hooks without running the others twice" # [HEAD=absent EXPECT==present @b59921f]</automated>
    <fails_when>non-zero exit: the scenario is missing, appears twice, or does not start at line 584</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent check:static > "$D/check-static.log" 2>&1; s=$?; echo "exit=$s" >> "$D/check-static.log"; test "$s" -eq 0</automated>
    <fails_when>non-zero exit: the typecheck, ESLint (cognitive complexity and import order included), fallow (dead code, private type leaks, cycles, health, duplication, boundary zones), Prettier, the pairing, or `check:features` failed; `$D/check-static.log` names the step</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; PATH="$S/gate-bin:$PATH" flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile adapter --parallel 2 features/hook/session.feature:584 > "$D/green-adapter.log" 2>&1; s=$?; echo "exit=$s" >> "$D/green-adapter.log"; test "$s" -eq 0 && grep -qx '1 scenario (1 passed)' "$D/green-adapter.log" && grep -qx '11 steps (11 passed)' "$D/green-adapter.log" # [HEAD=absent EXPECT==present @b59921f]</automated>
    <fails_when>non-zero exit: cucumber exited non-zero, or the log lacks `1 scenario (1 passed)` and `11 steps (11 passed)`</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; PATH="$S/gate-bin:$PATH" flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile builtin --parallel 2 features/hook/session.feature > "$D/builtin-session.log" 2>&1; s=$?; echo "exit=$s" >> "$D/builtin-session.log"; test "$s" -eq 0 && grep -qx '0 scenarios' "$D/builtin-session.log" # [HEAD=present EXPECT==present @b59921f GUARD MUTATION: an MCP implementation tag on the new scenario]</automated>
    <fails_when>non-zero exit: the builtin run failed, or the log lacks the line `0 scenarios` (the new scenario gained an implementation tag)</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; A=$(cat "$D/fix-commit") && test -n "$A" && c=$(git show -s --format=%ct "$A") && g=$(git show --name-only --format= "$A") && f=$(printf '%s\n' "$g" | LC_ALL=C sort | tr '\n' ' ') && test "$f" = "extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts extensions/pi-claude-marketplace/bridges/hooks/event-router.ts extensions/pi-claude-marketplace/bridges/hooks/late-session-start.ts extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts extensions/pi-claude-marketplace/index.ts features/hook/session.feature test/bridges/hooks/dispatch.test.ts test/bridges/hooks/event-router.test.ts test/bridges/hooks/late-session-start.test.ts " && for n in R0-adapter red-unit-leaf red-unit-dispatch red-unit-router; do m=$(stat -c %Y "$D/$n.log") && test "$m" -lt "$c" || exit 1; done && t=$(git show -s --format=%s "$A") && test "$t" = "feat(hooks): run session start for plugins that autoapply adds" # [HEAD=absent EXPECT==present @b59921f]</automated>
    <fails_when>non-zero exit: `$D/fix-commit` is missing, the commit changed another file set than the nine, a red log is missing or not older than the commit, or the commit title differs</fails_when>
  </verify>
  <done>The scenario failed in its `Then` on the old code (R0, `RED-PROOFS OK` for `red-`) and passes with the fix; the three unit red logs predate the commit; the 699 cases of the five unit files pass; the five pairs have 100% direct coverage; `check:static` passes; the builtin profile selects no scenario of `session.feature`; one commit holds the nine files.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Bound the late run at 10 seconds, as Claude Code does, then prove the scenario with breaks B1, B2, and B3</name>
  <precondition>`$D/fix-commit` names HEAD, and `git status --porcelain -- extensions/ test/` prints nothing.</precondition>
  <reversibility rating="reversible">The wait only lets the load go on earlier, and the hint only picks Pi's next-turn delivery for a late context; reverting the commit restores the unbounded wait of Task 1, and no stored format changes.</reversibility>
  <files>test/bridges/hooks/event-adapters.test.ts, extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts, test/bridges/hooks/event-router.test.ts, extensions/pi-claude-marketplace/bridges/hooks/event-router.ts, extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts; scratch files under $D only for the rest: the red logs, the break logs B1-adapter.log, B2-adapter.log, and B3-adapter.log, red-fix.log, and a rewritten break file only if one is needed</files>
  <behavior>
    - Adapter (1 case, title ends with `(HOOKLATESS-D1)`): the context of a late SessionStart whose hint reads true is sent with `{ deliverAs: "nextTurn" }`
    - Router (3 cases, each title starts with `a late SessionStart that` or `a late SessionStart whose` and ends with `(HOOKLATESS-D1)`, the last with `(HOOKLATESS-D1, NFR-2)`): a run that ends within 10 seconds holds the load until it ends, and its hint reads false (the load ends with no timer tick); a run that passes 10 seconds lets the load end after `t.mock.timers.tick(10_000)` while its hook still runs, and its hint then reads true; a run whose hooks fail writes `[hooks] late SessionStart failed: hook runner lost` and the load ends
    - Scenario `features/hook/session.feature:584` still passes, and B1, B2, and B3 each fail its `Then`
  </behavior>
  <action>
    Follow "The fix", item 6, the tail and the constant of the prescribed lines, and the
    execution rules.

    1. Adapter, test first. In `test/bridges/hooks/event-adapters.test.ts`, right after the case
       `holds a compaction's SessionStart context when no model call of the run follows (HKRL-03)`
       (`:2080-2096`), add the case titled `holds the context of a late SessionStart that ended
       after Pi went on to the first prompt for the next prompt (HOOKLATESS-D1)`, in the form of
       `:2064-2079`: the result `{ kind: "mutate", additionalContext: "late context" }`, the
       dispatch `{ event: { source: "startup", heldForNextPrompt: () => true }, values: ["late
       context"] }` checked with `satisfies SessionStartDispatch`, and the expected
       `sessionStartContextMessage(["late context"], { deliverAs: "nextTurn" })`. Run it with
       `--test-name-pattern 'HOOKLATESS-D1'` before changing `event-adapters.ts`, and keep that
       failing log as `$D/red-unit-adapter.log` (` tests 1`, ` pass 0`). Then make the payload
       and adapter changes of item 6.

    2. Router, test first. In `test/bridges/hooks/event-router.test.ts`:
       - Give `launchRouter` an answer that a case can change: its executor records the dispatch,
         then returns `answer(entry)`, where `answer` starts as a function that resolves `{ kind:
         "noop" }`, and `launchRouter` also returns `answerWith(next)`, which replaces it.
         `sessionWithAddedPlugin` passes `answerWith` through. No existing case changes.
       - Add the 3 router cases of the behavior list right after the 10 cases of Task 1. Each
         calls `t.mock.timers.enable({ apis: ["setTimeout"] })` after `sessionWithAddedPlugin`
         returns and before the load, so the session's own start runs on real timers, and reads
         the hint from the `event` of the last `dispatched` record. The past-wait case uses
         `createDeferred` (`:780`) twice: `answerWith` gets a function that resolves the first
         deferred (the hook started) and returns the second one's promise. The case starts the
         load, awaits the first deferred, calls `t.mock.timers.tick(10_000)`, awaits the load,
         asserts that the second deferred is still unresolved (a flag that its `then` sets), that
         `dispatched.map(dispatchSummary)` ends with the late run, and that the hint reads true,
         then resolves the second deferred with `{ kind: "noop" }`. The within-wait case awaits
         the load with no tick and asserts that the hint reads false. The failure case answers with
         a promise rejected with `new Error("hook runner lost")` and asserts the debug line with
         `observeRouterDebug(t)` (`:5284`). Run the 3 with `--test-name-pattern 'late SessionStart
         (that|whose) ' --test-timeout=20000` before changing `event-router.ts`, and keep that
         failing log as `$D/red-unit-wait.log` (` tests 3`, ` pass 0`: on the Task 1 code the hint
         is missing, the past-wait case waits for its hook until the test timeout, and the failure
         is logged as skipped). If that run does not end within 60 seconds, stop it, keep its log,
         and record that in the SUMMARY.
       Then make the router change of item 6.

    3. Checks, each with its log under `$D`, in the order of the verify block: the six unit
       files; direct coverage of the six pairs; `check:static`; the scenario under the adapter
       profile; `features/plugin/autoapply.feature` and `features/plugin/subagent-child.feature`
       under the adapter profile; and the whole of `features/hook` under the adapter profile, in
       the background.

    4. Commit the five files by path, with a message file `$D/bound-message.txt` whose title is
       `feat(hooks): bound the wait for late session start hooks` and whose body says, in lines of
       at most 80 characters, that a load now waits at most 10 seconds for a late SessionStart, as
       Claude Code does before its first turn; that a run that takes longer goes on while Pi takes
       the first prompt; and that its context then waits for the next prompt, as Claude Code holds
       it until the next turn. Write the commit to `$D/bound-commit`.

    5. Breaks, on the bound commit, one at a time, each through `break.sh`, which applies the
       break, runs the scenario, and restores `extensions/`: `PATH="$S/gate-bin:$PATH" bash
       "$D/break.sh" B1 adapter "$D/brk/B1.json" features/hook/session.feature:584`, then the
       same for B2 and B3 with their own edits files. If a log says `refusing: an old text does
       not occur exactly once`, the code differs from a prescribed line: rename the file to
       `$D/brk/<id>.planner.json`, write `$D/brk/<id>.json` with the same break for the code as
       written (B1: the late run dispatches nothing; B2: `sessionStartRunsPlugin` always says
       yes; B3: the ledger owes every plugin of the bucket), run the break again, and record it
       under "Red proofs" in the SUMMARY with the words "rewrote a break", the old and the new
       text, and the reason. Then run `check-red.mjs` with the prefix `fix-`; it must print
       `RED-PROOFS OK`. Each log must show its diff and the same failing `Then` as R0: B1 without
       the `late-start` row, B2 and B3 with a second `early-start` row. Finish with `extensions/`
       clean.
  </action>
  <verify>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; grep -Eq ' tests 1$' "$D/red-unit-adapter.log" && grep -Eq ' pass 0$' "$D/red-unit-adapter.log" && grep -Eq ' tests 3$' "$D/red-unit-wait.log" && grep -Eq ' pass 0$' "$D/red-unit-wait.log" # [HEAD=absent EXPECT==present @b59921f]</automated>
    <fails_when>non-zero exit: the new adapter case or one of the three wait cases passed (or was missing) before its source changed</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp "$S/nondac-sh" -c "node --import \"$PWD/scripts/isolated-pi-home.mjs\" --test --test-reporter=spec test/bridges/hooks/late-session-start.test.ts test/bridges/hooks/dispatch.test.ts test/bridges/hooks/event-router.test.ts test/bridges/hooks/payloads/session-start.test.ts test/index.test.ts test/bridges/hooks/event-adapters.test.ts" > "$D/bound-unit.log" 2>&1; s=$?; echo "exit=$s" >> "$D/bound-unit.log"; test "$s" -eq 0 && grep -Eq ' tests 858$' "$D/bound-unit.log" && grep -Eq ' fail 0$' "$D/bound-unit.log" # [HEAD=error:1 EXPECT==858 @b59921f]</automated>
    <fails_when>non-zero exit: a case of the six files fails or does not load, or the log lacks ` tests 858` and ` fail 0` (expected: 14 + 304 + 301 + 26 + 57 + 156; `event-adapters.test.ts` holds 155 at b59921f)</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 TMPDIR=/tmp CI=1 npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/late-session-start.ts extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts extensions/pi-claude-marketplace/bridges/hooks/event-router.ts extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts extensions/pi-claude-marketplace/index.ts extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts > "$D/bound-coverage.log" 2>&1; s=$?; echo "exit=$s" >> "$D/bound-coverage.log"; test "$s" -eq 0 && for f in bridges/hooks/late-session-start.ts bridges/hooks/dispatch.ts bridges/hooks/event-router.ts bridges/hooks/payloads/session-start.ts index.ts bridges/hooks/event-adapters.ts; do grep -qF "Direct coverage passed: extensions/pi-claude-marketplace/$f (" "$D/bound-coverage.log" || exit 1; done # [HEAD=absent EXPECT==present @b59921f]</automated>
    <fails_when>non-zero exit: a case of the six pairs fails, or line, function, or branch coverage of one of the six sources is below 100% (the timer callback, the `then` arrow, the `.catch` arrow, and the hint arrow each need their case)</fails_when>
    <automated>ER=extensions/pi-claude-marketplace/bridges/hooks/event-router.ts; test "$(grep -cF 'const LATE_SESSION_START_WAIT_MS = 10_000;' "$ER")" -ge 1 && test "$(grep -cF 'const run = sessionStartHandler(event, ctx).catch((err: unknown) => {' "$ER")" -ge 1 && test "$(grep -cF 'wentAhead = !(await settlesWithin(run, LATE_SESSION_START_WAIT_MS));' "$ER")" -ge 1 && test "$(grep -c '^async function settlesWithin(' "$ER")" -ge 1 && c=$(grep -v -e '^\s*//' -e '^\s*\*' "$ER" | grep -cF 'newPluginsOnly: late.plugins }, ctx);'); test "$c" -eq 0 && r=$(grep -n '^  pi\.on($' "$ER" | wc -l) && test "$r" -eq 15 # [HEAD=0,0,0,0,0,15 @b59921f; the fifth is 1 at the fix commit; EXPECT>=1,>=1,>=1,>=1,==0,==15]</automated>
    <fails_when>non-zero exit: the router lacks the wait constant, the bounded run, the race, or `settlesWithin`, the code (comment lines left out) still awaits the unbounded dispatch of Task 1, or the router registers another number of `pi.on` call sites than 15</fails_when>
    <automated>test "$(grep -cF '{ deliverAs: "nextTurn" }' extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts)" -ge 1 && test "$(grep -cF 'nextTurn: start.event.heldForNextPrompt?.() === true,' extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts)" -ge 1 && test "$(grep -cF 'readonly heldForNextPrompt?: () => boolean;' extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts)" -ge 1 # [HEAD=0,0,0 EXPECT>=1,>=1,>=1 @b59921f]</automated>
    <fails_when>non-zero exit: the adapter does not deliver with `nextTurn`, does not read the hint, or the event lacks the hint field</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent check:static > "$D/bound-check-static.log" 2>&1; s=$?; echo "exit=$s" >> "$D/bound-check-static.log"; test "$s" -eq 0</automated>
    <fails_when>non-zero exit: the typecheck, ESLint (nested conditionals and cognitive complexity included), fallow (dead code, private type leaks, cycles, health, duplication, boundary zones), Prettier, the pairing, or `check:features` failed; `$D/bound-check-static.log` names the step</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; PATH="$S/gate-bin:$PATH" flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile adapter --parallel 2 features/hook/session.feature:584 > "$D/bound-adapter.log" 2>&1; s=$?; echo "exit=$s" >> "$D/bound-adapter.log"; test "$s" -eq 0 && grep -qx '1 scenario (1 passed)' "$D/bound-adapter.log" && grep -qx '11 steps (11 passed)' "$D/bound-adapter.log" # [HEAD=absent EXPECT==present @b59921f]</automated>
    <fails_when>non-zero exit: the scenario no longer passes with the wait in place</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; PATH="$S/gate-bin:$PATH" flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/autoapply.feature features/plugin/subagent-child.feature > "$D/autoapply-adapter.log" 2>&1; echo "exit=$?" >> "$D/autoapply-adapter.log"; grep -qx 'exit=0' "$D/autoapply-adapter.log" && grep -Eqx '([0-9]+) scenarios \(\1 passed\)' "$D/autoapply-adapter.log" && ! grep -q 'function timed out' "$D/autoapply-adapter.log" # [HEAD=present EXPECT==present @b59921f GUARD MUTATION: a late run that throws past the load]</automated>
    <fails_when>non-zero exit: an autoapply or pi-subagents child scenario failed or timed out under the adapter profile; Rule 4 applies</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; PATH="$S/gate-bin:$PATH" flock -w 3600 "$S/phase07-heavy.lock" env npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run --silent test:cucumber:profile -- --profile adapter --parallel 2 features/hook > "$D/hook-adapter.log" 2>&1; echo "exit=$?" >> "$D/hook-adapter.log"; grep -qx 'exit=0' "$D/hook-adapter.log" && grep -Eqx '([0-9]+) scenarios \(\1 passed\)' "$D/hook-adapter.log" && ! grep -q 'function timed out' "$D/hook-adapter.log" # [HEAD=present EXPECT==present @b59921f GUARD MUTATION: break B2 on the fixed tree]</automated>
    <fails_when>non-zero exit: a hook scenario failed or timed out under the adapter profile; Rule 4 applies to a failure outside the new scenario. Expected `316 scenarios (316 passed)`: 315 at b59921f, the count that 261123-gti measured with its scenario, plus this one</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; A=$(cat "$D/bound-commit") && test -n "$A" && c=$(git show -s --format=%ct "$A") && g=$(git show --name-only --format= "$A") && f=$(printf '%s\n' "$g" | LC_ALL=C sort | tr '\n' ' ') && test "$f" = "extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts extensions/pi-claude-marketplace/bridges/hooks/event-router.ts extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts test/bridges/hooks/event-adapters.test.ts test/bridges/hooks/event-router.test.ts " && for n in red-unit-adapter red-unit-wait; do m=$(stat -c %Y "$D/$n.log") && test "$m" -lt "$c" || exit 1; done && t=$(git show -s --format=%s "$A") && test "$t" = "feat(hooks): bound the wait for late session start hooks" # [HEAD=absent EXPECT==present @b59921f]</automated>
    <fails_when>non-zero exit: `$D/bound-commit` is missing, the commit changed another file set than the five, a red log is missing or not older than the commit, or the commit title differs</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; R=$(git rev-parse --show-toplevel); B=$(cat "$D/plan-base"); node "$D/check-red.mjs" .planning/quick/261123-jdc-hooklatess-01-late-sessionstart-for-plug/261123-jdc-PLAN.md "$D" "$R" "$B" fix- > "$D/red-fix.log" 2>&1; s=$?; echo "exit=$s" >> "$D/red-fix.log"; test "$s" -eq 0 && grep -qx 'RED-PROOFS OK' "$D/red-fix.log" && for b in B1 B2 B3; do grep -qF '       Then the hooks record these runs: # features/step_definitions/hook/runs.steps.ts:164' "$D/$b-adapter.log" && grep -q '^diff --git a/extensions/pi-claude-marketplace/bridges/hooks/' "$D/$b-adapter.log" || exit 1; done && y=$(git status --porcelain -- extensions/) && test -z "$y" # [HEAD=absent EXPECT==present @b59921f]</automated>
    <fails_when>non-zero exit: the checker printed a `PROBLEM` line (a log is missing, names another checkout root, lacks `restored=clean`, holds a step timeout, lacks `1 scenario (`, ends with `exit=0`, or the scenario failed outside a `When` or a `Then`), a log does not fail at the runs `Then` or holds no diff of a hooks-bridge file, or `extensions/` is dirty</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; { [ ! -e "$D/brk/B1.planner.json" ] && [ ! -e "$D/brk/B2.planner.json" ] && [ ! -e "$D/brk/B3.planner.json" ]; } || grep -q 'rewrote a break' .planning/quick/261123-jdc-hooklatess-01-late-sessionstart-for-plug/261123-jdc-SUMMARY.md # [HEAD=present EXPECT==present @b59921f GUARD MUTATION: a rewritten break file that the SUMMARY does not record]</automated>
    <fails_when>non-zero exit: Task 2 rewrote a break file because the code differs from a prescribed line, and the SUMMARY does not say so with the words "rewrote a break" and the reason (run this check after the SUMMARY exists)</fails_when>
  </verify>
  <done>The adapter case and the three wait cases failed before their sources changed and pass after; the 858 cases of the six unit files pass; the six pairs have 100% direct coverage; `check:static` passes; the scenario, the autoapply and child features, and every scenario of `features/hook` pass under the adapter profile; one commit holds the five files; B1, B2, and B3 each fail the scenario at `Then the hooks record these runs:`; `check-red.mjs` prints `RED-PROOFS OK` for `fix-`; `extensions/` is clean at the bound commit.</done>
</task>

<task type="auto">
  <name>Task 3: Document the late SessionStart and record decision HOOKLATESS-D1</name>
  <precondition>Task 2's `$D/red-fix.log` holds the line `RED-PROOFS OK`, and `grep -n '^### Compaction$' docs/hooks-compatibility.md` prints `145:### Compaction`.</precondition>
  <files>docs/hooks-compatibility.md, .planning/PROJECT.md</files>
  <action>
    1. Insert "The docs section" into `docs/hooks-compatibility.md` at line 145, as its context
       paragraph says: the heading, a blank line, the paragraph, the rule list, the second
       paragraph, its list, and the last paragraph, with a blank line between blocks and one
       blank line before `### Compaction`. Change no table and no other line. Commit the file
       alone, with a message file `$D/docs-message.txt` whose title is
       `docs(hooks): describe the late session start run` and whose body says that the hooks
       guide now states when a plugin that a load activates runs its SessionStart hooks, the
       cases with no late run, the 10-second wait, and where the context of a longer run goes, as
       in Claude Code, with the one Pi gap. When mdformat or markdownlint changes or rejects the
       file, restage it and commit again. Write the commit to `$D/docs-commit`.

    2. Insert "The decision row" into `.planning/PROJECT.md` as its context paragraph says, as one
       line, and change nothing else in the file (no footer, no other row). Commit the file alone,
       with a message file `$D/decision-message.txt` whose title is
       `docs(planning): record the late session start decision` and whose body names the reading
       of the `/clear` question, the 10-second wait with its next-prompt delivery, and the one Pi
       gap. Write the commit to `$D/decision-commit`.
  </action>
  <verify>
    <automated>f=docs/hooks-compatibility.md; n=$(grep -n '^### Plugins that a load activates$' "$f") && test "$n" = "145:### Plugins that a load activates" && test "$(grep -c 'adds at launch (HOOKLATESS-D1)\. This late run follows these rules:$' "$f")" -ge 1 && test "$(grep -c '^- After a new session (`/new`, RPC `new_session`), whose `SessionStart` sends `clear`\.' "$f")" -ge 1 && test "$(grep -c '^The bridge waits at most 10 seconds for the late hooks before Pi takes your first prompt, as Claude Code does\.' "$f")" -ge 1 && test "$(grep -c 'saves it with the session, so a resumed session still gets it (a Pi gap)\.$' "$f")" -ge 1 # [HEAD=absent,0,0,0,0 EXPECT==present,>=1,>=1,>=1,>=1 @b59921f]</automated>
    <fails_when>non-zero exit: the section heading is missing, appears twice, or is not at line 145, or its upstream sentence, its new-session case, its wait paragraph, or its Pi gap sentence is missing</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; A=$(cat "$D/docs-commit") && test -n "$A" && g=$(git show --name-only --format= "$A") && test "$g" = "docs/hooks-compatibility.md" && t=$(git show -s --format=%s "$A") && test "$t" = "docs(hooks): describe the late session start run" && ns=$(git diff --numstat "$A~1" "$A" -- docs/hooks-compatibility.md) && d=$(printf '%s\n' "$ns" | cut -f2) && test "$d" -eq 0 # [HEAD=absent EXPECT==present @b59921f]</automated>
    <fails_when>non-zero exit: `$D/docs-commit` is missing, the docs commit changed another file, its title differs, or it removed or rewrote a line of the file (the commit only adds lines)</fails_when>
    <automated>S=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad; D=$S/quick-261123-jdc; n=$(grep -n '^| \*\*HOOKLATESS-D1 (quick task 261123-jdc' .planning/PROJECT.md) && test "${n%%:*}" = 2543 && test "$(printf '%s\n' "$n" | wc -l)" -eq 1 && A=$(cat "$D/decision-commit") && test -n "$A" && g=$(git show --name-only --format= "$A") && test "$g" = ".planning/PROJECT.md" && t=$(git show -s --format=%s "$A") && test "$t" = "docs(planning): record the late session start decision" && ns=$(git diff --numstat "$A~1" "$A" -- .planning/PROJECT.md) && test "$(printf '%s\n' "$ns" | cut -f1)" -eq 1 && test "$(printf '%s\n' "$ns" | cut -f2)" -eq 0 # [HEAD=absent EXPECT==present @b59921f]</automated>
    <fails_when>non-zero exit: the decision row is missing, appears twice, or is not line 2543, or `$D/decision-commit` is missing, changed another file, has another title, or changed more than the one added line</fails_when>
  </verify>
  <done>The hooks guide states the late SessionStart rules, the cases with no late run, the 10-second wait with its next-prompt delivery, and the one Pi gap; `.planning/PROJECT.md` holds HOOKLATESS-D1 as one new row with no open divergence; each commit adds only its lines.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| config files -> load | a project's `claude-plugins.json` turns `autoapply` on and declares the plugins the load installs, and so the plugins whose SessionStart hooks now run at that load |
| plugin hook process -> bridge | the late SessionStart hooks of an installed plugin run with the session's environment, and their output becomes context and notices |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-jdc-01 | Elevation of privilege | late run after a project's autoapply | medium | mitigate | D-LOC-01 holds: the load applies the project scope and routes its hooks only when Pi trusts the project, so a late run reaches only plugins whose hooks would run at the next event anyway; the late run reads routes, never configs. |
| T-jdc-02 | Tampering | a second run of a plugin's SessionStart | low | mitigate | The ledger is taken once per session and owes only plugins the session's SessionStart did not see; leaf rows "owes a late run once" and "does not owe a plugin that held a route in the other scope", router row "a second load runs none", and breaks B2 and B3. |
| T-jdc-03 | Denial of service | a late run that throws inside `resources_discover`, or whose hooks fail after the load went on | medium | mitigate | The run's own `try` debug-logs `late SessionStart skipped: <error>` and returns; the detached run's own `.catch` debug-logs `late SessionStart failed: <error>`; the handler's `try` in `index.ts` stays the last guard (the two NFR-2 router rows). |
| T-jdc-04 | Denial of service | a slow late SessionStart hook | low | mitigate | The load waits at most 10 s (`LATE_SESSION_START_WAIT_MS`), as Claude Code's `S5()`; the run goes on detached, its context waits for the next prompt, and the race clears its timer, so a finished run keeps no timer alive (the within-wait and past-wait router rows, fake timers). |
| T-jdc-05 | Repudiation | a late run the user does not see | low | accept | Its context and notices take the path of every SessionStart run, and a skipped run writes a debug line (OBS-01). |
| T-jdc-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no package and has no install task, so the package-legitimacy gate has nothing to check. |
</threat_model>

<verification>
- Task 1: the natural red (`RED-PROOFS OK` for `red-`), the three unit red logs, the 699 unit cases,
  direct coverage of the five pairs, the grep gates (15 `pi.on` call sites kept), `check:static`,
  the scenario green under the adapter profile, `0 scenarios` under the builtin profile, and the
  fix commit's file set, title, and order.
- Task 2: the adapter and wait red logs, the 858 unit cases, direct coverage of the six pairs, the
  grep gates (the wait, the race, no unbounded dispatch, 15 `pi.on` call sites), `check:static`,
  the scenario, the autoapply and child features, and every scenario of `features/hook` under the
  adapter profile, the bound commit's file set, title, and order, then `RED-PROOFS OK` for `fix-`,
  each break's diff and failing `Then`, and `extensions/` clean.
- Task 3: the docs and decision grep gates and both commits' file sets, titles, and added-only
  diffs.
- For the orchestrator, not the executor: `npm run check` in the main checkout after the merge
  (AGENTS.md, Build verification), the CHANGELOG parent line, the BACKLOG closure, and the STATE
  update.
</verification>

<success_criteria>
- In print, json, and rpc mode, a plugin that the load's autoapply installs or enables runs its
  SessionStart hooks in the same session, with the session's start source, and no other plugin's
  SessionStart runs again (the scenario at `features/hook/session.feature:584`).
- No late SessionStart in tui mode, on a reload, at a later load, after a new session, in a
  pi-subagents child, or after a `/claude:plugin` command; nothing throws past the load.
- The load waits at most 10 seconds for the late run, as Claude Code; a longer run goes on and its
  context waits for the next prompt, as Claude Code holds it until the next turn.
- The six pairs keep 100% direct coverage; `check:static` passes; the hook, autoapply, and child
  scenarios pass under the adapter profile; the bridge keeps its 15 `pi.on` call sites.
- Breaks B1 to B3 each fail the scenario's `Then`; `extensions/` ends clean.
- `docs/hooks-compatibility.md` and `.planning/PROJECT.md` (HOOKLATESS-D1) state the rule, the
  `/clear` reading, the tui parity, the 10-second wait, and the one Pi gap, with no open
  divergence.
</success_criteria>

## Source audit

| Source | ID | Item | Plan | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GOAL | 261123-jdc | a plugin that loads after the session starts gets SessionStart, as Claude Code 2.1.330 | Task 1 | COVERED | scenario at `session.feature:584` |
| REQ | HOOKLATESS-01 | add the late run (option A) | Task 1 | COVERED | `HooksBridge.runLateSessionStart`, called last in `prepareResources` |
| REQ | HOOKLATESS-01 | interactive sessions: decide | Task 1, Task 3 | COVERED | tui runs none (orchestrator decision 3); router row; docs |
| CONTEXT | orchestrator | only print, json, rpc; never tui, reload, or after a command install | Task 1 | COVERED | mode gate, reason gate, call site only in the load; router rows |
| CONTEXT | orchestrator | trigger: a startup load whose autoapply activated plugins with an unrun SessionStart hook; run exactly those | Task 1 | COVERED | ledger seen set and `newPluginsOnly` filter; breaks B2, B3 |
| CONTEXT | orchestrator | the session's first start source, no `initialUserMessage` | Task 1, Task 3 | COVERED | ledger keeps `startup`/`resume`/`fork`; the bridge supports no `initialUserMessage` (docs) |
| CONTEXT | orchestrator | settle the `/clear` question from the binary, else the narrowest reading, and record it | context, Task 3 | COVERED | settled (`noa`, `tgs.of(N())`, `Gy`); also the narrowest reading; docs and decision row |
| CONTEXT | orchestrator | new decision ID in PROJECT.md, D-CF5-03 stays | Task 3 | COVERED | HOOKLATESS-D1 |
| CONTEXT | orchestrator | update `docs/hooks-compatibility.md` | Task 3 | COVERED | new section at line 145 |
| CONTEXT | orchestrator | unit tests at 100% direct coverage | Tasks 1, 2 | COVERED | five pairs, then six |
| CONTEXT | orchestrator | json or rpc scenario, natural red in a When or Then logged before the fix, deliberate break reverted clean | Tasks 1, 2 | COVERED | R0, B1 to B3, `break.sh` and `check-red.mjs` in `$D` |
| CONTEXT | checker issue 1 | the late run does not hold the first prompt past Claude Code's 10 s bound, matched upstream after the bound, no open divergence | context, Tasks 2, 3 | COVERED | `settlesWithin` race at `LATE_SESSION_START_WAIT_MS`; `deliverAs: "nextTurn"` as `_U`/`wU`; notices per D-CF5-14; the in-memory next-turn queue recorded as the one Pi gap with evidence |
| CONTEXT | checker issue 1 | unit rows for a run under and over 10 s with fake timers; a docs line; HOOKLATESS-D1 without an open divergence | Tasks 2, 3 | COVERED | three router rows and one adapter row; docs wait paragraph; decision row `-- Locked` |
| CONTEXT | checker issue 2 | Task 1 fits the per-task budget | Tasks 1, 2 | COVERED | the wait is its own five-file commit in Task 2; Task 1 keeps its size and drops the long cucumber runs |
| CONTEXT | orchestrator | pin tui, a second load, and a reload by a scenario or a unit row | Task 1 | COVERED | router rows |
| CONTEXT | orchestrator | NFR-2, APL-D1/AAP-D1, run inside the hooks bridge's existing event handling | Task 1 | COVERED | no new `pi.on`; called from the existing `resources_discover` handler; own `try` |
| CONTEXT | orchestrator | complexity gates, fallow zones, `pi.on` counts | Task 1 | COVERED | `check:static`; leaf in `bridges/hooks`; count gate at 15 |
| CONTEXT | orchestrator | verification prefixes, `fd`, heavy-run lock, no `--no-verify`, no SKIP | rules, Tasks 1 to 3 | COVERED | |
| CONTEXT | orchestrator | CHANGELOG parent line in the SUMMARY; never edit STATE, ROADMAP, BACKLOG, CHANGELOG | rules, output | COVERED | "For the orchestrator" |
| CONTEXT | orchestrator | commit titles: Conventional Commits, no quick or backlog ids | rules, Tasks 1, 3 | COVERED | |
| RESEARCH | section 3, option A | remember the source and the covered plugins; run after a startup resources_discover in print/json/rpc; skip reload, tui, child; deliver through the SessionStart context path | Task 1 | COVERED | the composite handler's context path is unchanged |
| RESEARCH | section 4 | no D-CF5-03 amendment; the reload scenarios stay valid; a new json or rpc scenario | Tasks 1, 3 | COVERED | `features/hook` run under the adapter profile |
| RESEARCH | open points | `/clear` reset; interactive late settings install not probed | context | COVERED | `/clear` settled; interactive runs none by decision 3 |
| RESEARCH | side observation | the reload hint in rpc/json points at `/reload` | -- | EXCLUDED | outside this question (research says so); listed for the orchestrator |

<output>
Create `.planning/quick/261123-jdc-hooklatess-01-late-sessionstart-for-plug/261123-jdc-SUMMARY.md`
with `status: complete` in its frontmatter, and these sections:

- "Red proofs": the R0, B1, B2, and B3 logs under `$D`, each one's count line and failing step,
  the two `check-red.mjs` outputs (`RED-PROOFS OK`), the five unit red logs (leaf, dispatch,
  router, adapter, wait), any scenario cell that step 3 of Task 1 corrected, and any break file
  that Task 2 had to rewrite, with the words "rewrote a break" and the reason.
- "Checks": each command of the verify blocks with its exit status, the commit it ran on, the
  Node version, and the counts it printed (699 and then 858 unit cases, the coverage lines, the
  `features/hook` scenario count).
- "Decisions": HOOKLATESS-D1; the `/clear` reading and its binary evidence; the owed plugins as
  the plugins that gained a SessionStart route since the session's dispatch, keyed
  `<plugin>@<marketplace>` in either scope; one late run per session; the bridge handle returned by
  `registerHooksBridge` instead of a new `pi.on`; the 10-second wait and the next-prompt delivery
  of a longer run, with their binary evidence; notices at hook end under D-CF5-14; the one Pi gap
  (the in-memory next-turn queue).
- "For the orchestrator" (the executor edits none of these files):
  - CHANGELOG parent line: "In print, JSON, and RPC mode, a plugin that `autoapply` installs or
    enables as Pi starts now runs its `SessionStart` hooks in that session."
  - BACKLOG closure: "HOOKLATESS-01: closed 2026-11-23 by commits <fix commit> and <bound commit>
    (HOOKLATESS-D1): in print, json, and rpc mode a plugin that a load's autoapply activates runs
    SessionStart with the session's start source, and no other plugin's hooks run again; the load
    waits at most 10 seconds for it, and a longer run's context waits for the next prompt, as in
    Claude Code; none in the terminal, on a reload, after a command, at a later load, or after a
    new session. The rules are in `docs/hooks-compatibility.md`."
  - STATE.md: drop HOOKLATESS-01 from the integration-rescope "Still open" list.
  - Outside this task, from the research: in rpc and json mode the install's reload hint names
    `/reload`, which those modes do not offer.
  - `npm run check` in the main checkout after the merge.
- `## Threat Flags`, even when the answer is "None" (AGENTS.md, GSD records), as this line:
  None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
</output>
