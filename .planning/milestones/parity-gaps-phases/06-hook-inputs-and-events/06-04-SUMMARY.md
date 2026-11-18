---
phase: 06-hook-inputs-and-events
plan: "04"
subsystem: hooks
status: complete
tags: [hooks, duration_ms, cucumber, placeholders]
requires: ["06-02"]
provides:
  - "`duration_ms` on the PostToolUse and PostToolUseFailure stdin"
  - "Three HooksRuntime operations: `recordToolCallPrepared`, `takeToolDuration`, `clearToolCallMarks`"
  - "bridges/hooks/payloads/tool-event-facts.ts: `HookToolFacts`, `withToolFacts`, `toolFactFields`"
  - "The `{milliseconds}` token in features/lib/hook-run-tokens.ts"
affects: [06-05, 06-13]
tech-stack:
  added: []
  patterns:
    - "A fact the dispatcher measures rides on the event copy the hooks read and reaches stdin through `toolFactFields`"
    - "A defaulted clock `now` as the last parameter of the two tool handlers"
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/tool-event-facts.ts
    - test/bridges/hooks/payloads/tool-event-facts.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
    - features/lib/hook-run-tokens.ts
    - 6 feature files (see the sweep section)
decisions:
  - "The bridge times a call from the end of its tool_call handler to the start of its tool_result handler (D-PG6-06)"
  - "A call counts from the later of its own mark and the last top-level mark (D-PG6-06)"
metrics:
  duration: "~75 min"
  completed: 2026-11-14
estimate:
  tokens: 92000
actuals:
  tokens: 61063
  tasks: 2
  commits: 2
plan_head_before: ffd0c8798dca80966fb9029a6aa1916684c162af
plan_head_after: bf50bee8bf1264164e0f19fc37e504e9c208dca4
---

# Phase 6 Plan 04: duration_ms on PostToolUse and PostToolUseFailure Summary

The `PostToolUse` and `PostToolUseFailure` hooks now get `duration_ms`. The value is the whole milliseconds from the end of the bridge's `tool_call` handler to the start of its `tool_result` handler. So the `PreToolUse` hooks are not in it, and in a parallel batch the `PreToolUse` hooks of the later calls are not in it either. A result with no mark sends no field. The scenarios state the value through a `{milliseconds}` token.

## Commits

| Task | Commit | Title |
|---|---|---|
| 06-04-01 | `74a884f0` | feat(hooks): send duration_ms to the tool result hooks (19 files, +815/-188) |
| 06-04-02 | `bf50bee8` | fix(hooks): keep a batch's PreToolUse hooks out of duration_ms (5 files, +119/-24) |

`git rev-list --count ffd0c879..HEAD` = 2. Both commits passed the commit hook on the first try (`npm run check:commit ... Passed`). The hook's static check includes ESLint's and fallow's complexity limits, so the diff of dispatch.ts does not push `compositeHandlerFor` or `toolResultCompositeHandler` over them, and I added no suppression. Before each commit I ran `SKIP=npm-check pre-commit run --files <task files>` (exit 0, no fixer changes). I did not use `--amend`, `--no-verify`, `git stash`, or `git add -A`.

The plan commit ledger was not written under the git dir. I recorded the base `ffd0c879` in `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-gaps/46275468-1855-49b4-a234-f937cd40117e/scratchpad/p0604-head-before.txt` and measured the commits from it.

## Task 06-04-01: duration_ms on the result hooks

- **Runtime (runtime.ts).** A `Map<string, number>` of marks lives in the runtime's closure, behind three operations. `prepareSettleForRegistration` clears it, so a `/reload` keeps no mark.
- **Facts module (payloads/tool-event-facts.ts).** A new module with its paired test.
- **PreToolUse handler (dispatch.ts).** `compositeHandlerFor` builds its handler as before. For `PreToolUse` it returns that handler wrapped by `markedOnExit`, a small function that records the mark in a `finally` when the generation is still current. So the mark is set on every exit path: with an empty bucket, for a proxy call, for a blocked call, and when the executor rejects. A handler of a stale generation records none. The clock is read once, when the handler ends.
- **Result handler (dispatch.ts).** Right after the generation check, `toolResultCompositeHandler` calls `takeToolFacts`, which takes the duration and builds the facts. This happens before the bucket is read, so the mark is removed whatever follows: an empty bucket, a cancelled failure, or a proxy call. After `toolEventView` builds the event, `withToolFacts` adds the facts to it. The pair copies of `runEditResultPairs` spread that event, so each pair carries the call's `hookDurationMs`.
- **Clock.** The new last parameter `now: () => number = monotonicNow` sits on both handlers. `monotonicNow` reads `performance.now()`. Production passes none, and event-router.ts is unchanged. Every owner case passes its own `now` or calls the runtime with numbers, and none sleeps.
- **Agent end (settle.ts).** `agentEndCacheHandler` calls `runtime.clearToolCallMarks()` after its generation check.
- **Translators.** `readonly duration_ms?: number` follows `tool_response` on `PostToolUseStdin` and `is_interrupt` on `PostToolUseFailureStdin`. `...toolFactFields(event)` is spread at the same place. Each translator's event parameter is now `ToolResultEvent & HookToolFacts`, and each keeps two parameters. The failure header now says: "`tool_use_id` is the call's own id, as on PreToolUse and PostToolUse. `duration_ms` is the time the failed tool ran, which the dispatcher measured, and is left out when it has none (D-PG6-04, D-PG6-06)." The post-tool-use.ts header gained a matching sentence that cites D-PG6-06. No translator comment says that the duration is not sent (`grep "not sent"` finds nothing).
- **Token.** `hookRunTokens` maps the key `duration_ms` to `{milliseconds}` when the value is a number, a safe integer, and not negative. Any other value gets no token, so the step prints it as JSON and the table fails.

### Owner cases

- runtime.test.ts: take after record gives 150, a second take and an unmarked take give `undefined`; 100.4 to 250.9 gives 151, and a take before the mark gives 0; `clearToolCallMarks()` and `prepareSettleForRegistration()` each drop every mark.
- tool-event-facts.test.ts: `toolFactFields({ hookDurationMs: 12 })` is `{ duration_ms: 12 }` and `toolFactFields({})` is `{}`. `withToolFacts` with a fact returns a new object that shares `input` and `content` and leaves the event unchanged. With `{}`, it returns the event itself.
- dispatch.test.ts, `describe("duration marks (D-PG6-06)")`: there is a mark at clock 100 after an empty bucket, a blocked call, a rejecting executor, and a call with hooks. The executor saw zero clock reads, the clock was read once, and `takeToolDuration(…, 175)` is 75. A stale handler records none and reads no clock. Every result hook's event is `{ ...event, hookDurationMs: 75 }`. Both pairs of a two-pair edit carry 75 (`dispatch-call#1`, `dispatch-call#2`). An empty result bucket still removes the mark. A cancelled failure runs no hook and removes the mark. A result with no mark hands the hooks the event itself.
- settle.test.ts: an agent end drops every mark. A stale agent end drops none.
- post-tool-use(-failure).test.ts: with `hookDurationMs: 75`, `Object.entries(payload)` shows `["duration_ms", 75]` after `tool_response` (after `is_interrupt` on the failure), before `agent_type` and `agent_id`. The existing tool_use_id cases still check `Object.hasOwn(payload, "duration_ms") === false` without the fact.

### Red and green of the criterion scenario

Red, on the unchanged production tree (token and the column on "A hook sees one tool use id before and after a call, and another on the next call" only):

```
npm run test:cucumber:profile -- --profile adapter features/hook/tool-use.feature --name 'A hook sees one tool use id'
       + actual - expected
                 'tool use id',
           -     'duration ms',
                 'tool input',
           ...
                 '{tool use 1}',
           -     '{milliseconds}',
                 '{"command":"echo one"}',
           ...
                 '{tool use 2}',
           -     '{milliseconds}',
1 scenario (1 failed)
14 steps (12 passed, 1 skipped, 1 failed)
```

The actual table had no `duration ms` column. Green: the same scenario passed in the full adapter run below (131 passed).

### The sweep

The sweep script `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-gaps/46275468-1855-49b4-a234-f937cd40117e/scratchpad/p0604-sweep.py` is not committed. It adds `duration ms` directly after `tool use id` in each runs table that holds a `PostToolUse` or `PostToolUseFailure` row. It puts `{milliseconds}` in each result row and an empty cell in every other row, and it pads only the new column. A scan of every feature file found such tables in the six files only.

| File | Tables changed |
|---|---|
| features/hook/tool-use.feature | 25 (24 swept + the criterion scenario) |
| features/hook/tool-failure.feature | 12 |
| features/hook/mcp-tool-names.feature | 6 |
| features/hook/async.feature | 1 |
| features/plugin/subagent-child.feature | 6 |
| features/skill/model-reads.feature | 1 |

Total: 51. Planning counted 50 at `cff84369`, before plan 06-02 added the criterion scenario. The three complete-inputs tables (tool-use.feature:112 and :155, tool-failure.feature:399) gained `,"duration_ms":"{milliseconds}"` as the last stdin member, after `tool_response` or `is_interrupt`. That is six profile records (4 in tool-use, 2 in tool-failure).

**Result rows without a duration: none.** All 51 tables passed on the first run with `{milliseconds}` in every result row. So every result call of the suite passed the bridge's `tool_call` handler, and every `PreToolUse` row has no `duration_ms`.

Column-removal check (`/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-gaps/46275468-1855-49b4-a234-f937cd40117e/scratchpad/p0604-check.sh`, base `HEAD` = `ffd0c879` before the commit). It removes the `duration ms` column and the complete-inputs member, unpads every runs-table cell, and compares the result with the same projection of the base:

```
EQUAL  features/hook/tool-use.feature
EQUAL  features/hook/tool-failure.feature
EQUAL  features/hook/mcp-tool-names.feature
EQUAL  features/hook/async.feature
EQUAL  features/plugin/subagent-child.feature
EQUAL  features/skill/model-reads.feature
```

### Verification (task 1)

| Command | Result |
|---|---|
| `node --import "$PWD/test/platform/isolated-pi-home.ts" --test` runtime, dispatch, settle, tool-event-facts, post-tool-use, post-tool-use-failure, event-router, architecture/hooks-lifecycle, architecture/hooks-translators | 703 pass, 0 fail, 0 cancelled |
| `npm run test:coverage:direct --` the six sources | exit 0 (100%) |
| `node scripts/install-test-peers.mjs && node --import ... --test test/integration/hooks-dispatch-end-to-end.test.ts test/integration/hooks-spawn-end-to-end.test.ts` | exit 1: 7 tests, 2 pass, 5 fail. **Pre-existing at ffd0c879**, see Deferred Issues |
| adapter profile, the six features | 131 scenarios (131 passed), 1943 steps passed |
| builtin profile, tool-use, tool-failure, mcp-tool-names, subagent-child | 27 scenarios (27 passed), 391 steps passed |
| `npm run check:features` | exit 0 |

Acceptance greps: `takeToolDuration` 2 and `recordToolCallPrepared` 2 in runtime.ts. `duration_ms` 2 in post-tool-use.ts. `duration ms` 25 and `{milliseconds}` 34 in tool-use.feature. No file under features/step_definitions/ and not event-router.ts is in either commit (`git diff --name-only ffd0c879..HEAD`).

## Task 06-04-02: a parallel batch

**Rule.** A call's duration starts at the later of its own mark and the last mark of a top-level call. This rests on `executeToolCallsParallel` in `node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js` (line 417). It prepares every call through `prepareToolCall`, which runs the extension `tool_call` handlers, before it runs any of them with `Promise.all`.

- `recordToolCallPrepared(toolCallId, parentToolCallId, now)`: a call with no parent also sets `lastTopLevelMark` (initially `Number.NEGATIVE_INFINITY`).
- `takeToolDuration` returns `Math.max(0, Math.round(now - Math.max(mark, lastTopLevelMark)))`.
- `clearToolCallMarks` is now one closure function that `prepareSettleForRegistration` also calls. It clears the map and resets the last top-level mark.
- `markedOnExit` passes `call.parentToolCallId`.
- The doc comments of the two operations state the rule.

Owner cases: in a batch, `a`@100 and `b`@160 are taken at 300 and 310, which gives `[140, 150]`. For a nested call, `a`@100 and `a/1`@200 with parent `a`, taken at 230 and 400, give `[30, 300]`. A later `c`@500 taken at 520 gives `20`. Both clears drop the last top-level mark: after the clear, a nested `a/1`@50 taken at 80 gives `30`. In dispatch, the handler for `{ toolCallId: "a/1", parentToolCallId: "a" }` at clock 200, after a top-level `a`@100, leaves `[30, 300]`. Without the parent it would be `[30, 200]`. One call alone gives the same value as before (the task-1 cases are unchanged).

Red: I copied the task-1 tree (`git archive HEAD`) to the scratchpad with the new runtime.test.ts and dispatch.test.ts. There, the batch case, the nested case, the parent dispatch case, and the last-top-level clear cases fail (19 tests, 10 pass). Some task-1 cases also fail there only because the test calls the new three-argument form.

### Verification (task 2)

| Command | Result |
|---|---|
| `node --import ... --test` runtime, dispatch, settle, event-router, architecture/hooks-lifecycle | 666 pass, 0 fail |
| `npm run test:coverage:direct --` runtime.ts dispatch.ts | exit 0 (100%) |
| adapter profile, tool-failure, mcp-tool-names | 20 scenarios (20 passed), 292 steps passed |

The commit changes no file under features/. Node v26.13.1. I did not run `npm run check`, because the orchestrator owns the wave gate.

## Exported names and signatures (for plan 06-05)

bridges/hooks/payloads/tool-event-facts.ts:

```ts
export interface HookToolFacts {
  readonly hookDurationMs?: number;
}
export function withToolFacts<T extends object>(event: T, facts: HookToolFacts): T;
// Returns `event` itself when `Object.keys(facts).length === 0`, else `{ ...event, ...facts }`.
export function toolFactFields(event: HookToolFacts): { readonly duration_ms?: number };
```

The stdin member type is inline, not exported, so fallow sees no unused export. Plan 06-05 widens `HookToolFacts`, the return type of `toolFactFields`, and `takeToolFacts` in dispatch.ts.

HooksRuntime (bridges/hooks/runtime.ts):

```ts
readonly recordToolCallPrepared: (
  toolCallId: string,
  parentToolCallId: string | undefined,
  now: number,
) => void;
readonly takeToolDuration: (toolCallId: string, now: number) => number | undefined;
readonly clearToolCallMarks: () => void;
```

dispatch.ts: `compositeHandlerFor(runtime, claudeEvent, capturedGeneration, pi?, executor?, tools?, now?)` and `toolResultCompositeHandler(runtime, capturedGeneration, pi?, executor?, tools?, now?)`, with `now: () => number = monotonicNow`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] settle.test.ts changed in task 2**
- **Found during:** Task 2. The new `parentToolCallId` parameter changes the call form of `recordToolCallPrepared`, and the two settle cases of task 1 call it.
- **Fix:** Updated the three call sites to `("a", undefined, 100)` form. This changes no case.
- **Files:** test/bridges/hooks/settle.test.ts. **Commit:** bf50bee8.

### Other notes

- TDD order in task 1: the criterion scenario was seen red first. I wrote the owner cases after the implementation, so they were not seen red on their own.
- The plan's interfaces said the translators would take the duration from the event. I widened each translator's event type to `ToolResultEvent & HookToolFacts` rather than add a parameter. The architecture gate's `translate(event, context)` form still holds.
- `withToolFacts` returns `T` rather than `T & HookToolFacts`. The identity path cannot type as the intersection without a cast, and the translators read the fact through their own parameter type.
- No `gsd-tools windows append` was made: no stub, skipped test, or unrun verify remains from this plan.

## Deferred Issues

**The two hook integration tests fail on the tree before this plan.** `test/integration/hooks-dispatch-end-to-end.test.ts` and `test/integration/hooks-spawn-end-to-end.test.ts` give 7 tests, 2 pass, 5 fail. The failures are HOOK-E2E-01, -02, and -04 (the executor is never called for a SessionStart entry) and spawn HOOK-E2E-02 and -05 (the sentinel is not written). They all involve `SessionStart`, which this plan does not touch. I ran the same command on a `git archive ffd0c879` copy in the scratchpad (`p0604-head`, node_modules linked) and got the same 5 failures, so they came before this plan. The likely source is `4a92c7b2` (feat(hooks): send resume and fork to SessionStart at a pi launch), which changed the `session_start` handler of event-router.ts. That file belongs to plan 06-03 in this wave. I did not investigate further or fix it, because the file is outside this plan's scope. The orchestrator's wave gate (`npm run check`, which runs `test:integration`) will report it.

## Flagged assumptions (repeated from the plan)

- **What the value holds.** The duration runs from the end of this extension's `tool_call` handler to the start of its `tool_result` handler. It leaves out the plugin's `PreToolUse` hooks, as Claude Code's field does. But it holds the time of other extensions' `tool_call` handlers that run after this one, of a prompt Pi shows between the two events, and of other extensions' `tool_result` handlers that run before this one. Plan 06-13 states this on the compatibility page. Pi gives no start mark that excludes them (06-RESEARCH.md finding F5).
- **One runtime, one session at a time.** The last top-level mark is one cell, like the runtime's other per-run cells. If two sessions ran tool batches at once on one runtime, they would shorten each other's values. Planning read that each Pi session gets its own load of the extension, so its own runtime. This was not run.
- **A result row with no duration.** A call that did not pass the bridge's `tool_call` handler has no mark and sends no field. The sweep found none in the suite.
- **The complexity limits.** The mark and the read live in `markedOnExit` and `takeToolFacts`. The commit hook's static check passed on both commits.
- **Wave 2 file split.** The mark lives in dispatch.ts and not in the router's registration wrapper, so this plan and plan 06-03 share no file.
- **Platform:** the scenarios run on Linux only.

## Records for the orchestrator (parent-owned lines, not applied)

- `.agents/skills/cucumber/rules/features.md`, section "Run tokens". Add after the `{tool use <n>}` bullet:
  `- In the hooks runs step and the complete mcp inputs step, a duration_ms that is a non-negative integer reads as {milliseconds}; it states no value, so no scenario asserts a timing. Any other value prints as its JSON text and fails the table (D-PG6-06, D-PG6-12). A command never expands it.`
- PROJECT.md Key Decisions: add D-PG6-06 (the bridge times the call itself, from the end of its tool_call handler to the start of its tool_result handler, counting a top-level call from the last top-level mark of its batch; Pi 1.5.0 gives no start mark that excludes hook time), pending maintainer review.
- BACKLOG.md HOOKRESULT-01: "execution timing" is no longer missing from the result hooks' stdin (`duration_ms`, D-PG6-06). The item's other facts stay open.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-06-09 (mitigate): `takeToolDuration` removes a mark before the bucket is read, `agentEndCacheHandler` clears every mark, and the registration reset clears them at a load. Owner cases cover all three, including the cancelled failure and the empty bucket. T-06-11 (mitigate): there is no field without a mark, the value is never negative, it is a whole number, and a batch counts from the last top-level mark. Owner cases compare exact numbers with an injected clock.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/bridges/hooks/payloads/tool-event-facts.ts
- FOUND: test/bridges/hooks/payloads/tool-event-facts.test.ts
- FOUND: 74a884f0 (ancestor of HEAD)
- FOUND: bf50bee8 (HEAD)
- Working tree: only this SUMMARY, uncommitted.
