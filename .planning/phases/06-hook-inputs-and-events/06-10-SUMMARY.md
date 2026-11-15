---
phase: 06-hook-inputs-and-events
plan: "10"
subsystem: hooks
tags: [hooks, user-prompt-expansion, dispatch, input, prompt-context]
status: complete
requires: ["06-07", "06-08"]
provides:
  - "`PROMPT_CONTEXT_EVENTS = [\"UserPromptSubmit\", \"UserPromptExpansion\"]`, `PromptContextEvent`, and `PendingPromptContext.event` (bridges/hooks/routing-state.ts)"
  - "`hookContextPart(claudeEvent: \"SessionStart\" | PromptContextEvent, values: readonly string[])` (bridges/hooks/event-adapters.ts), the one builder of `<Event> hook additional context: <values>` for prompt and session context"
  - "`adaptInputResult(result, event, context, claudeEvent: PromptContextEvent)` (bridges/hooks/event-adapters.ts)"
  - "`promptBlockedText(claudeEvent: \"UserPromptSubmit\" | \"UserPromptExpansion\", reason, command, fromStderr)` (bridges/hooks/hook-labels.ts)"
  - "`UserPromptExpansion` in `CompositeDispatchEvent` (bridges/hooks/dispatch.ts)"
  - "`TypedExpansion`, `TypedExpansionResolver`, and `RegisterHooksBridgeOptions.resolveTypedExpansion` (bridges/hooks/event-router.ts)"
affects: ["06-12 (resolver, its barrel export, the dispatch scenarios)", "06-13 (compatibility page)"]
tech-stack:
  added: []
  patterns:
    - "a buffered prompt context carries its event; the drain groups by event in tuple order"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts
    - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
    - test/bridges/hooks/routing-state.test.ts
    - test/bridges/hooks/event-adapters.test.ts
    - test/bridges/hooks/event-router.test.ts
    - test/bridges/hooks/dispatch.test.ts
    - test/bridges/hooks/hook-labels.test.ts
    - test/bridges/hooks/wire-protocol.test.ts
    - test/bridges/hooks/runtime.test.ts
    - test/architecture/hooks-lifecycle.test.ts
    - test/index.test.ts
decisions:
  - "D-PG6-18 as built: a second `input` registration, directly after the UserPromptSubmit one, runs the event for non-`extension` input that the injected resolver names, with a routed hook, in a main session only."
  - "D-PG6-19 as built: an expansion hook runs when its parsed name matcher selects `command_name` (`matcherFiresOnCommandName`)."
  - "D-PG6-20 as built: a block or a stop answers `handled`; the block notice is `UserPromptExpansion operation blocked by hook:\\n<reason>`; a context is buffered under its own event and reaches the model as `UserPromptExpansion hook additional context: <values>`, after the UserPromptSubmit part."
metrics:
  duration: "about 75 min"
  completed: 2026-11-14
actuals:
  tokens: 30000
  tasks: 3
  commits: 3
plan_head_before: 06fc65a00577bbf52c5cfeca0b5d61080aeda3ca
plan_head_after: 30855b3f299345ecd801475d549413c71e2e05bd
---

# Phase 6 Plan 10: Dispatch UserPromptExpansion Summary

The bridge can now run `UserPromptExpansion` hooks. A buffered prompt context carries the event of the hook that gave it, so an expansion hook's context reaches the model as `UserPromptExpansion hook additional context: ...`, after the prompt's own part. The composite handler serves the event: a routed hook runs when its matcher selects the command name, a block or a `continue: false` answers `handled` with its notice, and a failure or a system message shows under the label `UserPromptExpansion`. A second `input` registration, directly after the `UserPromptSubmit` one, builds the synthetic event from an injected resolver and calls that handler. No resolver is injected in production yet, so no typed line runs the event until plan 06-12.

## Commits

| Task | Commit | Title | Files |
|---|---|---|---|
| 06-10-01 | `ad3db01c` | `refactor(hooks): carry the event with a buffered prompt context` | 9 (routing-state, event-adapters, event-router, dispatch, and the five tests; runtime.ts not in it) |
| 06-10-02 | `eb2907d4` | `feat(hooks): serve UserPromptExpansion from the composite handler` | 8 (dispatch, hook-labels, routing-state, wire-protocol, and their tests; event-router.ts and event-adapters.ts not in it) |
| 06-10-03 | `30855b3f` | `feat(hooks): register the UserPromptExpansion input handler` | 4 (event-router.ts, event-router.test.ts, hooks-lifecycle.test.ts, test/index.test.ts) |

Before each commit I ran `SKIP=npm-check pre-commit run --files <the task's files>`. Every hook passed and no fixer changed a file. Then `git add -- <paths>` and `git commit -F - -- <paths>`. Each commit's hook log shows `npm run check:commit ... Passed` and `gitlint ... Passed`. No commit deletes a file. `git diff 06fc65a0..HEAD | grep -cE '^\+.*(fallow-ignore|eslint-disable|thresholdOverrides)'` = 0. No file under features/ is in any commit. No `--amend`, `--no-verify`, `git stash`, or `git add -A`.

## Task 06-10-01: the buffered context carries its event

- routing-state.ts: `PROMPT_CONTEXT_EVENTS` (then `["UserPromptSubmit"]`), `PromptContextEvent`, and the required member `event` of `PendingPromptContext` (and so of `PendingFollowUpContext`).
- event-adapters.ts: `hookContextPart(claudeEvent, values)` is the one place that writes `<Event> hook additional context:` for prompt and session context. It drops empty and blank values and gives `undefined` when none is left. `sendQueuedPromptContext(pi, claudeEvent, text)` (a steer, and a follow-up at its turn end through `sendDueFollowUpContext`, which reads `entry.event`) builds its part through it. `bufferedContext` now returns `PendingSessionStartContext`, and the new `bufferedPromptContext(text, claudeEvent, context)` adds the event. `adaptInputResult` takes the event as its fourth parameter and passes it to `queuePromptContext`.
- event-router.ts: the private `contextPart` is gone. `startRun` writes the SessionStart part through `hookContextPart`, then `promptContextParts(entries)`, which groups the drained entries by event in a `Map` and writes one part for each event of the tuple, in tuple order. A filter `entry.event === claudeEvent` was my first form; with one tuple member `@typescript-eslint/no-unnecessary-condition` rejects it, so the grouping is a `Map`, which needs no change for a second member.
- dispatch.ts: the `adaptForEvent` arm passes `"UserPromptSubmit"` (task 06-10-02 changed it to `claudeEvent`).
- The only other writer of the label is `sendToolContext` in dispatch.ts, which takes a computed tool label (`PreToolUse:Bash`), not a literal event name.
- Tests: every buffered entry the five owner tests build or expect carries `event: "UserPromptSubmit"` (runtime.test.ts shares one entry between the two buffers, so its prompt append spreads the event in). New cases: `hookContextPart` (labels and joins, drops blank values, gives no part), and the tuple pin in routing-state.test.ts.
- Commands: `npx tsc --noEmit -p .` exit 0. The plan's owner-test command (5 files): exit 0, 732 tests, 732 pass. `CI=1 npm run test:coverage:direct -- <4 sources>`: exit 0; routing-state.ts 2/2 branches, 1/1 functions, 225/225 lines; event-adapters.ts 156/156, 30/30, 827/827; dispatch.ts 396/396, 103/103, 1607/1607; event-router.ts (after the `Map` rewrite) 212/212, 73/73, 1522/1522. `npm run test:cucumber:profile -- --profile adapter features/hook/additional-context.feature features/hook/prompt-commands.feature`: exit 0, `15 scenarios (15 passed)`, `214 steps (214 passed)`. `git diff --quiet HEAD -- features`: exit 0. ESLint on the 9 files: exit 0.

## Task 06-10-02: the composite handler serves the event

### Red (Step 1, before any production change)

Test edits only: the event moved into the `satisfies readonly CompositeDispatchEvent[]` list and its `@ts-expect-error` pin was deleted; the new dispatch, hook-labels, routing-state, and wire-protocol cases.

- `npx tsc --noEmit -p .`: 17 lines of errors, among them `test/bridges/hooks/dispatch.test.ts(57,3): error TS2322: Type '"UserPromptExpansion"' is not assignable to type 'CompositeDispatchEvent'.`, the same error at each new `compositeHandlerFor(..., "UserPromptExpansion", ...)` call, and `test/bridges/hooks/hook-labels.test.ts(215,76): error TS2554: Expected 3 arguments, but got 4.`
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/{dispatch,hook-labels,routing-state,wire-protocol}.test.ts`: exit 1, 456 tests, 435 pass, 21 fail. The failures: the three matcher cases, the nine notice rows, the two context cases, the tuple pin, the plain-stdout case of the event, and every `promptBlockedText` row (the new parameter shifted the arguments).

### Green

- `npx tsc --noEmit -p .`: exit 0.
- The plan's owner-test command (9 files, settle.test.ts and the two architecture gates included): exit 0, 922 tests, 922 pass.
- `CI=1 npm run test:coverage:direct -- <4 sources>`: exit 0; dispatch.ts 410/410 branches, 104/104 functions, 1652/1652 lines; hook-labels.ts 44/44, 16/16, 253/253; routing-state.ts 2/2, 1/1, 226/226; wire-protocol.ts 96/96, 12/12, 331/331.
- `npm run test:cucumber:profile -- --profile adapter features/hook/prompt-commands.feature features/hook/additional-context.feature features/hook/messages.feature`: exit 0, `27 scenarios (27 passed)`, `383 steps (383 passed)`. `git diff --quiet HEAD -- features`: exit 0.
- ESLint on the 8 files, `npx fallow health --fail-on-issues`, and `npx fallow dupes --fail-on-issues`: all exit 0.

### Switches and conditional types the event forced, with the answer

| Site | Answer |
|---|---|
| `CompositeDispatchEvent` | the `Exclude` names `PostToolUse`, `PostToolUseFailure`, `Stop`, `StopFailure` again; doc comment back to those four |
| `showsSystemMessages` | `true` (shows `UserPromptExpansion says: <text>`) |
| `blockNotices` | shares the `UserPromptSubmit` arm: the first block in routing order, `promptBlockedText(claudeEvent, ...)` |
| `showsFailures` | `true` (D-PG5-10) |
| `adaptForEvent` | `adaptInputResult(result, (event as UserPromptExpansionEvent).input, context, claudeEvent)` |
| `CompositeEventFor` | `UserPromptExpansionEvent` |
| `CompositeReturnFor` | `InputEventResult \| undefined`, beside `UserPromptSubmit` |
| `matchValue` | `undefined` beside `UserPromptSubmit`, so `noticeLabel` gives `UserPromptExpansion` alone |
| `entryFires` (not compile-forced) | a branch before the closed-set path calls the new `matcherFiresOnCommandName(entry.matcher, command_name)`: `match-all` true, `name-set` `names.has`, `regex` `pattern.test`, `tool-set`/`invalid-pattern`/`unmapped` false |
| `dropStalePromptContext` | not called for the event, so the context `UserPromptSubmit` buffered for the line stays |

Sets: `UserPromptExpansion` joined `PROMPT_CONTEXT_EVENTS` (routing-state.ts) and `PLAIN_CONTEXT_EVENTS` (wire-protocol.ts). `MISSING_SCRIPT_EVENTS` is unchanged; the existing wire-protocol walk "keeps the exit-2 block of a missing script on <event>" covers every admitted event outside `Stop` and `UserPromptSubmit`, so it already asserts the event's block.

### Cases added (dispatch.test.ts, `describe("UserPromptExpansion dispatch (D-PG6-19 / D-PG6-20)")`)

- A bucket of four hooks, `deploy, ship` (name set), `^demo:` (regex), `*`, and `build`: `demo:deploy` runs the regex and `*` hooks, `ship` runs the set and `*` hooks, `Demo:Deploy` runs only `*` (case-sensitive). Each executor call receives the whole synthetic event.
- A tool matcher (`Bash`, kind `tool-set`) runs for no command.
- An empty bucket and a stale generation answer `undefined` and call no executor.
- Notice rows, each comparing the answer and the notice entries: a decision block, an exit-2 block (`[printf guard]: denied`), a block without reason (`Blocked by hook`), an exit 2 without stderr (`[printf guard]: No stderr output`), two blocks (the first only), a stop with and without reason, a system message, and a failed exit (`UserPromptExpansion hook error: Failed with non-blocking status code: boom`, answer `undefined`).
- A context, and an empty one: the buffer keeps the `UserPromptSubmit` entry of the line, then holds the expansion entry with `event: "UserPromptExpansion"` (none for the empty context).
- hook-labels.test.ts: two `UserPromptExpansion` rows; the three old rows pass `"UserPromptSubmit"` and expect the old text. wire-protocol.test.ts: plain stdout at exit 0 is context on the event. routing-state.test.ts: the tuple is `["UserPromptSubmit", "UserPromptExpansion"]`.

## Task 06-10-03: the second `input` registration

### Red (Step 1, before any production change)

Test edits only: hooks-lifecycle.test.ts slices 14 registrations and lists a second `input`; test/index.test.ts expects `pi.on("input", ...("input expansion"))` after the dispatch registration; the two registration lists and the reload order list of event-router.test.ts hold a second `input`; the loop-reset case picks `input` occurrence 2; the policy walk passes a resolver and drives occurrence 1, and `policyRuns` expects the event in a main session; the twelve new router cases.

- `npx tsc --noEmit -p .`: `TS2305: Module '".../event-router.ts"' has no exported member 'TypedExpansionResolver'.`, `TS2353: ... 'resolveTypedExpansion' does not exist in type 'RegisterHooksBridgeOptions'.`, and one `TS7006`.
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/event-router.test.ts test/index.test.ts test/architecture/hooks-lifecycle.test.ts`: exit 1, 312 tests, 241 pass, 71 fail: 1 in hooks-lifecycle.test.ts (`same-runtime reload makes every retained registration inert before argument access`), 45 in test/index.test.ts (the strict mock), and 25 in event-router.test.ts (the new cases, the registration lists, and `main routes UserPromptExpansion by the eleven-event policy`).

The first green run then showed nine more router cases that pinned the count (`registrations.length` 13 and 26, and the reload order list); they now read 14, 28, and two `register:input` lines.

### Green

- `npx tsc --noEmit -p .`: exit 0.
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/event-router.test.ts test/bridges/hooks/dispatch.test.ts test/bridges/hooks/index.test.ts test/index.test.ts`: exit 0, 610 tests, 610 pass.
- `node --import ... --test test/architecture/hooks-lifecycle.test.ts test/architecture/hooks-foundation.test.ts test/architecture/hooks-dispatch.test.ts`: exit 0, 12 tests, 12 pass.
- `CI=1 npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`: exit 0, 228/228 branches, 77/77 functions, 1609/1609 lines.
- ESLint on the 4 files (after `--fix` of one import order), `npx fallow health`, `npx fallow dupes`, and `npx fallow dead-code`, each with `--fail-on-issues`: all exit 0.
- `npm run test:cucumber:profile -- --profile adapter features/hook features/skill features/slash-command`: exit 0, `447 scenarios (447 passed)`, `5911 steps (5911 passed)`. This holds the four features of the plan's verify list (prompt-commands, additional-context, skill/aliases, slash-command/invocation) and every hook, skill, and slash-command feature.
- The same with `--profile builtin`: exit 0, `15 scenarios (15 passed)`, `237 steps (237 passed)`.
- `git diff --quiet HEAD -- features`: exit 0.
- Before the last commit: `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/hooks-*.test.ts`: exit 0, 16 tests, 16 pass. `npm run test:unpaired` (all of test/architecture/** and the fakes): exit 0.
- Acceptance greps: `resolveTypedExpansion` in event-router.ts 3; `registrations.slice(0, 14)` in hooks-lifecycle.test.ts 1; `"input",` in hooks-lifecycle.test.ts 3; `TypedExpansion` in bridges/hooks/index.ts 0.

### As built

```typescript
export interface TypedExpansion {
  readonly commandName: string;
  readonly commandArgs: string;
  readonly commandSource?: string;
}
export type TypedExpansionResolver = (
  text: string,
  ctx: ExtensionContext,
) => Promise<TypedExpansion | undefined>;
export interface RegisterHooksBridgeOptions {
  readonly cwd: string;
  readonly executor?: HookExecutor;
  readonly resolveTypedExpansion?: TypedExpansionResolver;
  readonly processStartedAt?: number;
}
```

The registration, directly after the `UserPromptSubmit` one, is `bindWithMode((generation) => expansionInputHandler(runtime, compositeHandlerFor(runtime, "UserPromptExpansion", generation, pi, opts.executor), opts.resolveTypedExpansion))`. `expansionInputHandler` answers `undefined` when the event is not dispatched in this session, for `source === "extension"`, with no resolver, and for an empty bucket; otherwise `runTypedExpansion` awaits `resolve(event.text, ctx)` in a `try`, writes `[hooks] input: typed expansion not resolved: <error>` and answers `undefined` on a rejection, answers `undefined` for no answer, and otherwise calls the handler with `{ command_name, command_args, command_source? (spread only when given), input: event }`. The header comment of `registerHooksBridgeWith` says 14 call sites, `input` three times. The bridge's barrel does not export the two types.

Router cases added (event-router.test.ts): a resolved line gives the executor the whole synthetic event and a blocking hook answers `{ action: "handled" }`; a resolver answer without a source leaves `command_source` out; no hook for `extension` input (resolver not called), a line the resolver does not name (resolver called once), no resolver, an empty bucket (resolver not called), a child (resolver not called), a stale registration after a reload (resolver not called), and a rejecting resolver (one debug line); a `UserPromptSubmit` block, walked as Pi walks the handlers, answers `handled` and the expansion resolver is never called; without a block the prompt hook runs before the expansion hook; and `before_agent_start` writes the `UserPromptSubmit` part, then `UserPromptExpansion hook additional context: expansion context`.

## Upstream facts

Taken from the plan's interfaces block (Claude Code 2.1.323, read in the binary on 2026-11-14). I did not read the binary again, so I record no offsets: the event's runner passes no match query, so its hooks are named `UserPromptExpansion` alone; its context attachment reads `UserPromptExpansion hook additional context: <values>`; the missing-script rule does not cover the event; the block text adds `Original prompt:`, which the bridge leaves out (F11, D-CF5-24).

## Deviations from Plan

### Auto-fixed Issues

None.

### Interpretations recorded

- **No explicit generation check after the resolver's await.** The plan's Step 2 says the closure "checks the generation again". `compositeHandlerFor`'s handler compares its captured generation with the runtime's as its first statement, and the expansion handler calls it after the await, so a second check in the router would duplicate it. The case "runs no expansion hook through a registration a reload replaced" covers the stale path at call time.
- **One context-text builder in event-adapters.ts.** To meet "no text of the form `<Event> hook additional context:` is written from a literal event name outside the one function that builds it", I moved the router's private `contextPart` into event-adapters.ts as `hookContextPart`, so the drain and the queued sends share it. It is exported because event-router.ts uses it.
- **`bufferedContext` returns `PendingSessionStartContext`.** It also feeds the SessionStart buffer, whose entries must not carry an `event`; `bufferedPromptContext` adds it for the prompt buffer.
- **A test helper keeps an entry for both buffers.** runtime.test.ts and one reload case in event-router.test.ts append one entry to both buffers; the runtime case spreads the event into the prompt append, and the reload case keeps an `as const` entry that has the event, which the SessionStart buffer accepts.
- **The `UserPromptExpansion` feature runs.** Task 06-10-03 names `features/slash-command/invocation.feature`; the dispatch asked for `features/hook`, `features/command`, and `features/skill` under both profiles. There is no `features/command`; I ran `features/hook`, `features/skill`, and `features/slash-command` under both profiles.

## Flagged assumptions (from the plan, unchanged)

- **No scenario in this plan.** None of the three commits changes what a user sees: the first is a refactoring, the second adds a handler nothing registers, and the third registers a handler that answers nothing until a resolver is injected. The failing-first proofs are the owner cases and the two gates, each run red before its change (above). The scenarios of the block, the stop, the context, and the order land in plan 06-12.
- **The context label is the event's own** (planner's finding, pending maintainer review). Read in the binary, not seen in a run.
- **The notice label is `UserPromptExpansion` alone** (planner's finding). Read in the binary, not seen in a run.
- **A `systemMessage` of an expansion hook is shown,** as on `UserPromptSubmit`. Medium confidence.
- **Between this plan and plan 06-12** the handler is registered and nothing dispatches the event. Nothing ships between them.
- **A resolver that fails runs no hook,** and the line goes on.
- **Platform:** Linux only (Node v26.13.1).

## Records for the orchestrator (parent-owned lines, not applied)

- PROJECT.md Key Decisions: "D-PG6-18 (pending maintainer review): `UserPromptExpansion` runs in a second `input` handler of the hooks bridge, registered directly after the `UserPromptSubmit` handler, for input whose source is not `extension`, for a line the injected typed-line resolver names, only when a hook is routed, and never in a pi-subagents child; a blocked prompt runs no expansion hook, and the hooks see the line before any alias rewrite." "D-PG6-20 (pending maintainer review): an expansion block or `continue: false` answers `handled`; the block notice is `UserPromptExpansion operation blocked by hook:` and the reason on the next line, without Claude Code's `Original prompt:` part; the stop shows `Operation stopped by hook[: <stopReason>]`; a context, plain stdout included, reaches the model after the prompt's part as `UserPromptExpansion hook additional context: <values>`." Planner's findings (Claude Code 2.1.323, read in the binary): the event's context attachment is labeled `UserPromptExpansion`, and its runner passes the hook runner no match query, so its notices name the event alone.
- `.planning/codebase/ARCHITECTURE.md`: "`registerHooksBridgeWith` (`bridges/hooks/event-router.ts`) has 14 `pi.on` call sites: `input` three times, the `UserPromptSubmit` dispatch, then the `UserPromptExpansion` dispatch for a line that `RegisterHooksBridgeOptions.resolveTypedExpansion` names, and last the STOP-07 reset." "A buffered prompt context (`PendingPromptContext`) carries its event (`PromptContextEvent`, from `PROMPT_CONTEXT_EVENTS` in `routing-state.ts`), and `hookContextPart` (`event-adapters.ts`) labels its text with that event."

## Known Stubs

None. The handler answers nothing until a resolver is injected; plan 06-12 injects it (recorded in the plan, not a stub).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-23 holds: a block or a stop answers `handled`, and the lifecycle gate and test/index.test.ts pin the new handler directly after the `UserPromptSubmit` one. T-06-25 holds: the adapter adds no path around the exec layer's 10,000-character cap.

## Self-Check: PASSED

The three commits (`ad3db01c`, `eb2907d4`, `30855b3f`) are ancestors of HEAD, and every modified file listed above exists. `git rev-list --count 06fc65a0..HEAD` = 3. This SUMMARY is left uncommitted, as the dispatch asks.
