# Bridges — hooks event adapters, settle, stage, routing state — adversarial re-review

**Scope:** `tests/bridges/hooks/{event-adapters,settle,stage,routing-state}.test.ts` and
`extensions/pi-claude-marketplace/bridges/hooks/{event-adapters,settle,stage,routing-state}.ts`,
re-examined with the mutation catalogue. Collaborators (`dispatch.ts`, `exec-result.ts`,
`event-router.ts`, `path-safety.ts`, `debug-log.ts`, `orchestrators/plugin/info.ts`) were read
where they settle a question about this area.
**First-pass file:** `unit-test-findings/bridges-hooks-adapters-state.md`
**Clean files attacked:** 2 (`tests/bridges/hooks/routing-state.test.ts`,
`extensions/pi-claude-marketplace/bridges/hooks/settle.ts`) — plus the two files the first pass
recorded only minor findings against, re-attacked with the same catalogue
**Existing findings graded:** 13 findings + 2 "Not covered" claims

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 3 |
| New WARNING (missed by first pass) | 17 |
| Existing CONFIRMED | 9 |
| Existing UNDERSTATED | 3 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 1 |
| Existing DUPLICATE-OF | 0 |

The first pass's picture of this area is **directionally right but incomplete in the place it
declared safe**. Its one BLOCKER (the `routing-state.ts` reset hooks) is real and, if anything,
understated. But `routing-state.test.ts` — declared clean — carries two surviving mutations that
mean two of the module's twelve functions never have their key argument discriminated, and
`settle.ts` — declared clean — has a documented one-shot-latch re-arm that no case exercises,
under a test title that claims it does.

## New findings — from the clean lists

### `tests/bridges/hooks/routing-state.test.ts`

- **[BLOCKER] `getRoutingBucket` can ignore its `claudeEvent` argument undetected** — `lines 338,
  356, 423, 581`
  Mutating `routing-state.ts:275` to `return Array.from(routingTable.values())[0] ?? [];` — i.e.
  dropping the key lookup entirely — leaves **all 15 cases in the file green**. Every case that
  calls `getRoutingBucket` has at most one bucket populated: `338` reads an empty table, `356`
  populates only `PreToolUse`, `423` populates only `SessionEnd`, `581` populates only
  `PreToolUse`. The one case that populates two buckets (`479`, `"reads all routing buckets while
  preserving each bucket's order"`) never calls `getRoutingBucket` at all — it reads
  `routingTableEntries()` only. A misrouted bucket would fire the wrong plugins' hooks on the
  wrong Pi event, which is the whole point of the module.
  **Fix:** in the case at `line 479`, after `setRoutingBucket("SessionEnd", [...])` and
  `setRoutingBucket("PreToolUse", [...])`, add
  `const sessionEndBucket = getRoutingBucket("SessionEnd");` and
  `const preToolUseBucket = getRoutingBucket("PreToolUse");` to the act block and
  `assert.deepStrictEqual({ sessionEndBucket, preToolUseBucket }, { sessionEndBucket: [...], preToolUseBucket: [...] })`
  against the two literals already built for `expectedRoutingEntries`. Incidental coverage exists
  in a *different* pair (`tests/bridges/hooks/event-router.test.ts:492,497` reads two distinct
  buckets in one case) — that does not discharge the owning pair's obligation, and it is exactly
  the "coverage that is incidental to another module's setup" the census is meant to surface.

- **[BLOCKER] `deleteParsedConfig` can ignore its key and clear the whole cache undetected** —
  `line 300` (`"deletes a parsed config and keeps it absent after a repeated delete"`)
  Mutating `routing-state.ts:250` to `parsedConfigCache.clear()` leaves every case green: no case
  in the file ever holds two cache entries at once (`190` sets one, `240` overwrites one key,
  `300` sets one, `581` sets one). In production this mutation silently wipes every other
  plugin's parsed hooks config on a single plugin's uninstall — `event-router.ts:622` calls
  `deleteParsedConfig` inside the phantom-entry sweep, iterating keys.
  **Fix:** in the case at `line 300`, `setParsedConfig` two distinct keys (`plugin-gamma` and a
  second `plugin-delta` entry), delete only the first, and assert
  `Array.from(parsedConfigEntries())` deep-equals the single-element list holding the survivor.

- **[WARNING] `routingTableEntries` has no production caller — a test-only state reader whose doc
  comment implies otherwise** — `routing-state.ts:300–307`
  `grep -rn "\broutingTableEntries\b" extensions/` returns hits only inside `routing-state.ts`
  itself; `bridges/hooks/index.ts:1–13` deliberately does not re-export it, and
  `tests/bridges/hooks/index.test.ts:65` pins that with `@ts-expect-error the barrel keeps
  routingTableEntries internal`. Its doc comment ("Read-only view of the whole table, for callers
  that need the keyset rather than one bucket") describes consumers that do not exist. This is the
  same defect class as the first pass's `resetRoutingState` BLOCKER — a test-only export whose
  comment states a production role — and it was missed. **Fix:** either fold its two test uses
  into `getRoutingBucket` assertions (the case at `423` already asserts both) and make the
  function module-private, or, if it is kept, replace the comment with a plain statement that its
  only consumers are this module's tests. Do not leave a comment naming imaginary callers.

- **[WARNING] The two collection accessors' aliasing contract is unpinned in both directions** —
  `lines 104, 148`
  Mutating `clearPendingSessionStartContext` (`routing-state.ts:233`) from
  `pendingSessionStartContext = []` to `pendingSessionStartContext.length = 0` leaves every case
  green, and so does mutating `pendingSessionStartContextEntries` (`routing-state.ts:224`) to
  return `[...pendingSessionStartContext]`. The module's own comment at `lines 229–231` makes the
  reassignment load-bearing ("Reassignment rather than in-place truncation is why this is a named
  mutator"). It is currently benign — the only production reader,
  `event-router.ts:240–243`, materialises the joined string *before* calling clear — but nothing
  keeps it benign. **Fix:** add one case: append two entries, take a read, call
  `clearPendingSessionStartContext()`, then `assert.deepStrictEqual` that the *previously taken*
  read still holds both entries and a fresh read is `[]`. That pins the survives-a-clear contract
  the comment claims.

- **[WARNING] Off-by-one on the empty-context skip survives** — `line 83`
  (`"skips an empty pending SessionStart context"`)
  Mutating `routing-state.ts:211` from `entry.context.length === 0` to
  `entry.context.length <= 1` leaves every case in this file *and* in
  `event-adapters.test.ts` green — no case anywhere appends a one-character context. **Fix:** add
  a `context: "x"` row to the case at `line 83`'s shape as a sibling case asserting the entry *is*
  retained.

### `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`

- **[BLOCKER] The one-shot cap latch's re-arm is never exercised, and the case titled for it does
  not test it** — `tests/bridges/hooks/settle.test.ts:672`
  (`"a noop resets the cap and rearms its notification"`)
  Deleting `capNotifiedThisSession = false;` from `resetConsecutiveBlockState()`
  (`settle.ts:97`) leaves **every case in `settle.test.ts` green**. The reason is arithmetic: the
  case at `672` runs 7 blocks (counter 7, cap is 8, so the cap never trips and the latch is never
  set), then a noop, then 8 blocks. At the moment of the reset the latch is already `false`, so
  re-arming it is a no-op and its removal is unobservable. The same holds for `699` and `730`,
  which also reset before ever tripping the cap. STOP-07 / D-88-08 makes the re-arm a stated
  contract (`settle.ts:88–93`, "re-armed when the counter resets"), and the test title asserts it
  in words while the assertions do not.
  **Fix:** rewrite the case at `672` to trip the cap first: 8 blocks (expect exactly one
  notification, `sent.length === 7`), then a noop, then 8 more blocks, then
  `assert.deepStrictEqual(notified, [capWarning, capWarning])` against the hand-written literal
  already present at `line 628`. That single restructure discriminates the re-arm in both
  directions.

- **[WARNING] "first block wins" and "first mutate wins" are never exercised with two
  candidates** — `settle.ts:307, 316`
  Mutating either `outcomes.find(...)` to `outcomes.findLast(...)` leaves every case green: no
  case populates a Stop bucket with two blocking hooks or two context-bearing mutates. STOP-03's
  "first block wins" precedence (`settle.ts:305`) is therefore stated only in a comment. The
  aggregate `stop` precedence, by contrast, *is* proven from both orders (`483`, `507`) — the
  block/mutate arms just did not get the same treatment. **Fix:** add one case with
  `setRoutingBucket("Stop", [stopEntry("first"), stopEntry("second")])` where both return
  `{ kind: "block", reason: ... }` with distinct reasons, and deep-compare the whole `sent` array
  against the first hook's reason and `details: { pluginId: "first" }`.

- **[WARNING] A Stop `mutate` outcome without `additionalContext` has no case** — `settle.ts:316–322`
  `{ kind: "mutate" }` with every field absent is a legal `HookExecResult`
  (`exec-result.ts:42–49`, all fields optional), and the Stop path handles it with a two-stage
  filter: a `typeof … === "string"` predicate inside `find`, then a second `!== undefined` guard.
  Removing the predicate from the `find` leaves every case green, because no bucket ever contains
  a context-less mutate — yet with the mutation, a bucket of
  `[mutate-without-context, mutate-with-context]` silently loses the re-entry. The fall-through to
  the trailing `resetConsecutiveBlockState()` for a context-less mutate is likewise untested.
  **Fix:** add a case whose only Stop outcome is `{ kind: "mutate" }`, asserting `sent` is `[]`
  and that a following run of 8 blocks still needs all 8 to trip the cap (proving the counter was
  reset).

- **[WARNING] `settle.ts`'s debug diagnostics are executed but never asserted, unlike its
  sibling's** — `settle.ts:297–300, 216, 431`
  Three `hookDebugLog` call sites carry rendered content, including the
  `stop.result.stopReason ?? "<none>"` fallback. `settle.test.ts` never enables
  `PI_CLAUDE_MARKETPLACE_DEBUG`, so all three are line-covered and assertion-free: changing
  `<none>` to anything, or dropping the `pluginId` from the `sendMessage`-threw log, survives.
  The sibling in the same directory does this correctly —
  `event-adapters.test.ts:253–290` sets the env var under `t.after` restoration and compares
  `consoleErrorSpy.mock.calls` against a whole hand-written diagnostic string. **Fix:** propagate
  that idiom to the three settle cases at `507` (reasonless stop), `354` (unknown stopReason) and
  `807` (sendMessage threw).

- **[WARNING] `settleHandlerFor`'s `pi` and `ctx` parameters are over-wide, forcing 9
  `as unknown as` casts in the paired test** — `settle.ts:166–170`; casts at
  `settle.test.ts:32, 33, 69, 80, 124, 143, 245, 279, 315`
  `settle.ts` reads exactly `pi.sendMessage` and (through `notifyStopHookOverrideCap` and
  `collectBucketOutcomes`) `ctx`; the parameters are typed against the whole third-party
  `ExtensionAPI` / `ExtensionContext`, so no test can construct one and every double is forced
  past the compiler. This is META-FINDINGS item 1 appearing in a file the first pass did not file
  it against. Narrowing `pi` to `Pick<ExtensionAPI, "sendMessage">` deletes the cast at `line 69`
  **and dissolves the first pass's `isIdle` finding at its root** — the stub field only exists to
  satisfy a type nobody needs. **Fix:** narrow both parameters, then delete the casts and the
  `isIdle` field.

## New findings — files the first pass recorded only minor items against

### `tests/bridges/hooks/settle.test.ts`

- **[WARNING] Length-only and index-only assertions where a sibling case in the same file compares
  the whole value** — `lines 438–439, 625, 669, 695–696, 725–727, 754–755, 779, 804` (9 sites)
  `assert.strictEqual(sent.length, N)` and `assert.strictEqual(notified.length, 1)` are the sole
  content checks in six cases, and `flags[2]` / `flags.slice(0, 3)` replace a whole-array compare
  in two more. The correct form is already in this file: `605` deep-compares the entire `flags`
  array *and* the entire `notified` array including the exact warning text and severity; `634`
  deep-compares every re-entry's `content`. Under the length-only form, a mutation that sends the
  right *number* of re-entries with the wrong content or the wrong `pluginId` survives 6 of the 7
  cap cases. **Fix rule:** replace every `sent.length` / `notified.length` check with
  `assert.deepStrictEqual(sent.map((call) => call.message["content"]), [...])` (as at `657`) and
  a whole-array `notified` compare (as at `626`); replace `flags[2]` and `flags.slice(0, 3)` with
  a whole-array compare of `flags`.
- **[WARNING] Hand-rolled recorders where the interaction is the promise** — `lines 54–82`
  (`makePi`, `makeContext`)
  `pi.sendMessage` and `ctx.ui.notify` are the module's public interactions (re-entry and the
  cap warning), which the rules assign to `strong-mock` with `exactParams: true` and an explicit
  `verify()`. The single-call cases (`402`, `442`, `467`) are a straight swap. The multi-call cap
  cases (`605`, `634`, `672`) are the sanctioned shared-recorder-log exception and should stay as
  logs — but the log should then also carry the `notify` calls so the *ordering* between the last
  suppressed re-entry and the warning is provable, which today it is not.
- **[WARNING] Test data computed with production code** — `lines 91, 99, 106`
  `stopEntry`/`failureEntry` build `matcher` with `parseMatcher("")` / `parseMatcher(rawMatcher)`
  and `ifPredicate` with the imported `MATCH_ALL_IF` constant. The sibling in the same directory
  writes both as literals — `routing-state.test.ts:368, 372` uses `{ kind: "match-all" }` for
  each. **Fix:** replace both with the literal, so a regression in `parseMatcher` cannot move the
  test data and the production filter in the same direction.
- **[WARNING] Two cases assert a collaborator's contract owned by another pair** — `lines 529, 549`
  (`"an asynchronous Stop declaration degrades to noop"`, `"a false if predicate skips a Stop
  declaration"`)
  Both assert `fired` is empty, which is `collectBucketOutcomes`'s promise
  (`dispatch.ts:265–275`), already owned with a whole-value assertion by
  `tests/bridges/hooks/dispatch.test.ts:477` (`"preserves matching observation order while
  degrading async rewake to noop"`). **Fix:** keep the cases but drop the `fired` assertion and
  retitle to settle's own promise (`"an asyncRewake Stop declaration produces no re-entry"`),
  leaving `sent` as the assertion.

### `tests/bridges/hooks/event-adapters.test.ts`

- **[WARNING] `Reflect.apply` used to launder an invalid argument past the compiler** — `lines
  301, 716, 894, 1125` (4 sites)
  `Reflect.apply(adaptToolCallResult, undefined, [{ kind: "future" }, event])` exists only to
  defeat type-checking; it also discards arity and `this` checking, and it hides that the contract
  being proven (`assertNever`'s message) is already owned by
  `tests/bridges/hooks/exec-result.test.ts:39`. The in-repo correct form is in that same file:
  `const impossibleHookExecResult = { kind: "future" } as never;` followed by a direct call, with
  `@ts-expect-error` reserved for the type-level negatives (`exec-result.test.ts:28–37`).
  **Fix:** replace all four with the `as never` local plus a direct call, and consider deleting
  them outright — `exec-result.test.ts` owns the thrown-message contract, and these four re-prove
  it four times.
- **[WARNING] The documented cross-field ignore case is untested** — `event-adapters.ts:70–84`
  The doc comment names the example explicitly ("`updatedToolOutput` on a tool_call event") but no
  case constructs it. Mutating `applyMutationInPlace` (`event-adapters.ts:94`) to
  `result.updatedInput ?? result.updatedToolOutput` leaves every case green, and would let a
  tool-output patch be `Object.assign`ed into `event.input`. **Fix:** add two rows to the
  `applyMutationInPlace` describe block — a `tool_call` event with only `updatedToolOutput` set,
  and a `tool_result` event with only `updatedInput` set — each asserting the whole event is
  unchanged.
- **[WARNING] The block and stop arms assert one event property where the other arms compare the
  whole event** — `lines 367, 388, 700`
  `assert.strictEqual(event.isError, false)` is the only event-purity check in
  `adaptToolResultResult`'s block and stop cases, while every noop/mutate case in the same
  describe block compares the entire event with `deepStrictEqual`. A mutation that also wrote
  `event.content` on the block path (a plausible copy-paste from the mutate arm) survives all
  three. **Fix:** replace those three with the whole-event `deepStrictEqual` the sibling cases at
  `333`, `498` and `534` already use.

### `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`

- **[WARNING] `adaptInputResult`'s `_event` parameter is unread and documented as speculative** —
  `lines 242–245`
  "reserved for forward-compat (future per-event narrowing); the v1.13 adapter does not read from
  it". Every call site must supply it, and the paired test varies `source` across
  `interactive`/`rpc`/`extension` (`lines 733, 757, 779`) with no possible effect. **Fix:** drop
  the parameter and the varied fixtures, or state a concrete near-term consumer.
- **[WARNING] The CR-01 whitelist validates the container but not the elements** — `lines 132–134`
  `Array.isArray(patch.content)` admits any array, so a hook returning `content: [null]` or
  `content: [{ type: "tool_use" }]` writes it straight onto the Pi event. The surrounding comment
  claims the surface is "the Pi-side `(TextContent | ImageContent)[]` array". `isError` *is*
  type-checked (`typeof … === "boolean"`), so the asymmetry looks unintended. **Fix:** either
  validate each element carries a `type` of `"text"`/`"image"`, or amend the comment to say the
  check is field-level only; add the `[null]` row to the data-driven rejection loop at `line 510`
  once decided.

### `extensions/pi-claude-marketplace/bridges/hooks/stage.ts`

- **[WARNING] `hookConfigPathFor`'s doc comment states a single-source-of-truth role the codebase
  contradicts, and its only consumer outside its own module is the test** — `lines 29–36`
  The comment says it exists "so the same composition is never duplicated". In fact
  `path.join(<hooksDir>, <slug>, "hooks.json")` is composed inline in three places —
  `stage.ts:35`, `event-router.ts:508`, `orchestrators/plugin/info.ts:496` — and `info.ts:490–494`
  documents the duplication as *deliberate*, because `bridges/hooks/index.ts:22` calls
  `hookConfigPathFor` "a private helper the barrel deliberately does not re-export". So the export
  is public-to-tests only, and the comment defending it is false. **Fix, pick one:** (a) re-export
  it through the barrel and replace the two inline compositions, making the comment true; or
  (b) make it module-private, delete the case at `stage.test.ts:688`, and rely on the returned
  `write.path` already asserted byte-exactly in six write cases.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `routing-state.ts` | `RoutingEntry` (type) | `routing-state.test.ts:373` (`satisfies`) | owned |
| `routing-state.ts` | `CacheEntry` (type) | `routing-state.test.ts:211` (`satisfies`) | owned |
| `routing-state.ts` | `PendingSessionStartContext` (type) | `routing-state.test.ts:94` | owned |
| `routing-state.ts` | `currentEpoch` | `routing-state.test.ts:35` | owned |
| `routing-state.ts` | `bumpEpoch` | `routing-state.test.ts:35` | owned |
| `routing-state.ts` | `resetEpoch` | `routing-state.test.ts:49` | owned; **no production caller** |
| `routing-state.ts` | `appendPendingSessionStartContext` | `routing-state.test.ts:83, 104` | owned; empty-skip threshold not discriminated |
| `routing-state.ts` | `pendingSessionStartContextEntries` | `routing-state.test.ts:69` | owned; aliasing unpinned |
| `routing-state.ts` | `clearPendingSessionStartContext` | `routing-state.test.ts:148` | owned; reassign-vs-truncate unpinned |
| `routing-state.ts` | `setParsedConfig` | `routing-state.test.ts:190, 240` | owned |
| `routing-state.ts` | `deleteParsedConfig` | `routing-state.test.ts:300` | **key argument NOT discriminated** |
| `routing-state.ts` | `parsedConfigEntries` | `routing-state.test.ts:171, 190` | owned |
| `routing-state.ts` | `getRoutingBucket` | `routing-state.test.ts:338, 356` | **key argument NOT discriminated** |
| `routing-state.ts` | `setRoutingBucket` | `routing-state.test.ts:356, 423, 479` | owned |
| `routing-state.ts` | `routingTableEntries` | `routing-state.test.ts:338, 479` | owned by test; **no production caller** |
| `routing-state.ts` | `resetRoutingState` | `routing-state.test.ts:581` | owned by test; **no production caller**, 18 test files depend on it |
| `settle.ts` | `resetSettleState` | `settle.test.ts:782` | owned; production caller `event-router.ts:721` |
| `settle.ts` | `inputResetHandlerFor` | `settle.test.ts:730, 758` | owned; latch re-arm not discriminated |
| `settle.ts` | `agentEndCacheHandler` | `settle.test.ts:156, 206, 229, 258` | owned |
| `settle.ts` | `settleHandlerFor` | `settle.test.ts:156` and 25 further cases | owned |
| `event-adapters.ts` | `applyMutationInPlace` | `event-adapters.test.ts:28, 52` | **partial** — its own describe block covers only the two rejection paths; both positive paths are exercised only through the adapters |
| `event-adapters.ts` | `adaptToolCallResult` | `event-adapters.test.ts:83–309` | owned |
| `event-adapters.ts` | `adaptToolResultResult` | `event-adapters.test.ts:313–724` | owned |
| `event-adapters.ts` | `adaptInputResult` | `event-adapters.test.ts:728–902` | owned |
| `event-adapters.ts` | `adaptObservationResultForEvent` | `event-adapters.test.ts:906–1137` | owned |
| `stage.ts` | `hookConfigPathFor` | `stage.test.ts:688` | owned by test; **no production consumer outside `stage.ts`** |
| `stage.ts` | `writeHookConfig` | `stage.test.ts:72` and 10 further cases | owned |
| `stage.ts` | `removeHookConfig` | `stage.test.ts:644, 670, 736` | owned |
| `stage.ts` | `WriteHookConfigInput`/`Result`, `RemoveHookConfigInput`/`Result` | structural use at call sites | owned implicitly; no `satisfies` pin (minor, the rules ask type-only surfaces to carry one) |

## Branch census

**`routing-state.ts`** — every branch is executed by the owning file. The gaps are
discrimination, not execution: `getRoutingBucket`'s `?? []` fallback and its Map lookup are both
reached but the lookup key is never varied against a populated sibling bucket (reachable and
effectively untested); `deleteParsedConfig`'s single-key delete is reached but never separated
from a whole-cache clear (reachable and effectively untested);
`appendPendingSessionStartContext`'s `length === 0` guard is reached from both sides but its
threshold is not pinned (reachable, weakly tested).

**`settle.ts`**
- `resetConsecutiveBlockState`'s latch re-arm — **reachable and untested** (the BLOCKER above).
- `runStopBucket`'s mutate filter, second stage (`additionalContext !== undefined` false) —
  **reachable and untested**; `{ kind: "mutate" }` with no fields is legal per
  `exec-result.ts:42–49`.
- `findLastAssistant`'s `message?.role` optional chain (`settle.ts:127`) — **compiler-forced**
  under `noUncheckedIndexedAccess`; unreachable with a dense array (D-116-01a).
- The `default` arm's `const unknownStopReason: never` (`settle.ts:215`) — compiler-forced pin,
  and its runtime half *is* exercised by the case at `settle.test.ts:354` via
  `agentEnd("future" as never)`.
- `settleHandlerFor`'s optional `executor` defaulting to the live `dispatchHookExec`
  (`dispatch.ts:257`) — **reachable and untested from this pair**, and untestable here without
  spawning real subprocesses. The rule "no parameter defaults to a live boundary" is broken at
  `dispatch.ts:257`, not in `settle.ts`; that seam belongs to the dispatch area's file.

**`event-adapters.ts`**
- Every `switch` arm of all four adapters is covered, both `?? "<none>"` fallbacks included.
- The `default`/`assertNever` arms — compiler-forced; the runtime halves are covered (through the
  `Reflect.apply` laundering flagged above).
- `applyMutationInPlace`'s two cross-field ignores — **reachable and untested** (finding above).

**`stage.ts`**
- `assertSymlinkEntryContained`'s final `throw err` (`line 159`) — **covered**, contrary to the
  first pass's "Not covered" note; see the REFUTED verdict below.
- `writeHookConfig`'s and `removeHookConfig`'s `assertPathInside` calls (`lines 201, 229`) —
  **unreachable by real input**: `assertSafeName` already rejects every separator, `.` and `..`
  form that could move the joined path out of `hooksDir`. Deliberate NFR-10 defence in depth;
  keep, do not chase coverage.
- `readSymlinkTargetSafe`'s catch, `readEntriesOrSkip`'s ENOENT/ENOTDIR/other arms,
  `assertNoSymlinkEscapeInHooksSubtree`'s symlink/dir/file arms — all covered.

## Grading of first-pass findings

### `tests/bridges/hooks/event-adapters.test.ts`

- **CONFIRMED** — Duplicated debug-env-var-and-console-spy boilerplate — the block is byte-similar
  at `253–266`, `667–680`, `849–862`, `1077–1094`; a file-local helper is the right fix, and the
  first pass is right to keep it out of a shared helpers module.
- **UNDERSTATED** — Redundant assertion after a full-shape `deepStrictEqual` — the first pass
  found 1 site (`544`) and called it harmless. There are **5**: `143`, `387` and `544` are
  redundant (verified: `assert.deepStrictEqual({a:1,b:undefined},{a:1})` throws, so a
  `deepStrictEqual` already pins the key set), but `829` and `972`
  (`Object.hasOwn(hookOutcome, "additionalContext") === false`) are worse than redundant — they
  assert a property of the test's own arranged literal, which no production change can falsify.
  Those two are vacuous assertions, not tidiness; delete all five.

### `tests/bridges/hooks/settle.test.ts`

- **UNDERSTATED** — Dead `isIdle` stub field — real, but the first pass treats it as a local tidy
  and offers "delete it or make it throw". Neither addresses the cause: the field exists only
  because `settleHandlerFor` types `pi` as the whole `ExtensionAPI` while reading one method. Fix
  the parameter (new finding above) and the field, the `as unknown as` at `line 69`, and the
  question of which guard idiom to use all disappear together.
- **CONFIRMED** — One test case covers three distinct behaviors (`156–204`) — the split into three
  named cases is right, and the proposed titles match what the case actually walks.
- **OVERSTATED** — No `describe()` grouping despite four exported entry points — the rule permits
  `describe()` for a module with several entry points; it does not require it, and the first pass
  itself marks the item optional. It is also applied inconsistently: `routing-state.test.ts` has
  **twelve** exported entry points and no `describe()`, and was declared clean in the same file.
  Correct severity: drop, or raise it against both files with one rule.

### `tests/bridges/hooks/stage.test.ts`

- **CONFIRMED** — Error assertions match on message text because the production error has no
  dedicated class (`719–729`, `745–755`) — correctly diagnosed and correctly scoped to
  `domain/name.ts`'s bare `Error`; the same file's `SymlinkRefusedError` cases show the target
  form.

### `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts`

- **UNDERSTATED** — `resetRoutingState` / `resetEpoch` are test-only resets whose doc comment
  misstates their production status — the finding is right on every fact I could check
  (`resetRoutingState`, `resetEpoch` and, additionally, `routingTableEntries` all have zero
  production references outside `routing-state.ts`), but it understates the blast radius in two
  ways. First, it names two test-only exports; there are **three** — `routingTableEntries` has the
  same status and a comment that likewise implies production callers. Second, the reset is not a
  local hooks-bridge concern: `resetRoutingState` is imported by **18 test files**, including
  `tests/orchestrators/plugin/{install,uninstall,update,reinstall,enable-disable}.test.ts` and
  four integration suites. Any factory-owned-state refactor has to land in all of them, which
  makes the sequencing advice in META-FINDINGS ("`routing-state.ts` … should come last") more
  important than the first pass's own scoping suggests.
- **CONFIRMED** (sub-claim) — "`node --test` runs each matched test file in its own process, so
  the module singleton never leaks across files" — verified against `package.json:82`: the script
  globs whole files and `--test-concurrency` parallelises *files*, not the cases inside one. The
  within-file reset discipline the first pass praises does hold in all four files.

### `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`

- **CONFIRMED** — Module-level mutable state is a good candidate for factory-owned state, with no
  cross-module sharing constraint — accurate: `cachedLastAssistant`, `stopHookActive`,
  `consecutiveBlockCount` and `capNotifiedThisSession` are read and written only by this module's
  own closures, and `resetSettleState` does have a real production caller
  (`event-router.ts:721`). Worth adding: the refactor would also kill the BLOCKER above, because
  each case would construct its own `SettleState` and the latch's re-arm would be observable
  without a 17-run choreography.
- **CONFIRMED** — `catch (err)` at `line 430` should read `catch (error: unknown)` — house style,
  WARNING is the right severity.

### `extensions/pi-claude-marketplace/bridges/hooks/stage.ts`

- **CONFIRMED** — No injected filesystem port; four tests monkey-patch `node:fs/promises` — the
  four sites are as listed, and the suggested narrow `{ readdir, lstat, realpath, readlink }` port
  would remove all four `syncBuiltinESMExports()` calls. Note the case at `396` also *writes* the
  filesystem from inside its `realpath` replacement to stage a TOCTOU race; a port makes that case
  a plain stub sequence.
- **CONFIRMED** — Obscure stack-pop idiom (`72–73`) — `slice(-1).join("")` is a
  `noUncheckedIndexedAccess` dodge; readability WARNING.
- **CONFIRMED** — Bare/unlabeled catches (`112`, `143`, `166`) — house style plus the
  discard-without-comment rule at `166`.

### `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`

- **CONFIRMED** — Repeated readonly-bypass cast could be one named helper (`133`, `137`) — real
  but minor; WARNING is right.

### "Not covered" claims

- **REFUTED** — "one defensive branch in `assertSymlinkEntryContained` — the final `throw err` …
  has no obvious corresponding test case; constructing one would require mocking
  `shared/path-safety.ts` internals, which is out of scope."
  That branch **is** covered, by `stage.test.ts:527` (`"propagates an unexpected contained-target
  walk failure unchanged"`), and no internals mocking is involved. Trace: the mocked
  `fs.promises.lstat` throws `EACCES` for `normalizedContainedTarget`; that path is an
  *intermediate segment* of `assertPathInside`'s walk, so `assertNoSymlinkSegment`
  (`path-safety.ts:129–134`) re-throws the raw errno error; back in
  `assertSymlinkEntryContained` it is neither `SymlinkRefusedError` nor `PathContainmentError`, so
  `stage.ts:159` fires — and `assert.strictEqual(rejection, walkError)` at `line 573` proves the
  identity is preserved. The branch is covered *and* the coverage is strong.
- **CONFIRMED** — the note that the four sibling files sharing the singleton
  (`event-router.test.ts`, `dispatch.test.ts`, `async-rewake/registry.test.ts`) should be included
  in any `routing-state.ts` redesign. The real count is 18 test files, not three.

## Still clean after attack

- **`tests/bridges/hooks/routing-state.test.ts`** genuinely catches: `bumpEpoch` returning the
  pre-increment value or a constant (the exact `[0, 1, 1, 2, 2]` sequence at `line 46`);
  `resetRoutingState` skipping **any one** of its four clears (the five-projection before/after
  compare at `627–657`); `setParsedConfig` or `setRoutingBucket` writing under a wrong key (the
  whole-map compares at `237`, `476`, `577`); `appendPendingSessionStartContext` unshifting
  instead of pushing (`144`); `setRoutingBucket` appending instead of replacing (`475`). Its
  literals are hand-written throughout — no production formatter computes an expected value
  anywhere in the file.
- **`extensions/pi-claude-marketplace/bridges/hooks/settle.ts`** is well covered against: the cap
  boundary in both directions (`>= 8` → `> 8` or `>= 7` both fail the `sent.length === 7` /
  `flags` compare at `624–625`); the post-await epoch re-check (`573`, which drives a `/reload`
  from inside the executor); one-shot cache consumption (`156`); `renderAssistantText`'s join
  separator (`291` — `join(" ")` yields `"first  second"` and fails); the StopFailure
  classification arguments (`871`, `911`, `935` pin all three of `error`+text, `length`+text,
  `error`+absent); the SFAIL-01 discard-the-outcomes contract (`956`, which proves a `block` and a
  `stop` from the failure bucket produce neither re-entry nor counter movement); and the
  `agentEndCacheHandler` stale-epoch guard (`156`, where dropping the guard produces a third
  dispatched event).
- **`tests/bridges/hooks/stage.test.ts`** catches byte-level regressions in the written file
  (`EXPECTED_HOOKS_BYTES` at `67–70` is hand-typed, not `JSON.stringify`-derived), the walker
  descending through an in-tree symlink (the `unvisited-escape` planted beyond the contained link
  at `179–186`), diagnostic leakage of out-of-tree names into the error message (`318–320`), and
  error identity on both propagation paths (`520`, `573`). Every case allocates its own `mkdtemp`
  and removes it in `finally` — no shared directories, no writes into the repo.
- **`tests/bridges/hooks/event-adapters.test.ts`** catches the CR-01 whitelist escape in full: the
  case at `391` throws nine hostile fields at the patch, including `type`, `toolName` and `route`,
  and compares the entire post-mutation event. It also correctly pins reference identity
  (`event.input`, `event.content`, `event.details`) and proves the hook's own outcome object is
  not mutated by the adapter.

## Not covered

- No test, coverage, lint or build command was run (diagnostic constraint). Every coverage and
  mutation claim above is from reading the source and hand-tracing; the two `node -e` snippets I
  ran touched nothing in the repo (one confirmed `assert.deepStrictEqual` treats an
  explicit-`undefined` own property as unequal, which is what makes the `Object.hasOwn` follow-ups
  redundant; the other was a grep-shaped census of production references).
- I did not attack `event-router.test.ts`, `dispatch.test.ts` or `async-rewake/registry.test.ts`,
  which share the `routing-state.ts` singleton and belong to other assignments. Where I cite them
  it is to establish ownership of a contract, not to review them.
- `notifyStopHookOverrideCap`'s own rendering contract (`shared/notify.ts`) is out of scope; I
  checked only that `settle.test.ts:628` compares a hand-written literal rather than calling the
  renderer.
- I did not evaluate whether the `mutate`-without-`additionalContext` Stop outcome can actually be
  produced by the wire protocol in practice; I established only that the type permits it and that
  the code has a two-stage guard for it that no case exercises.

## Meta-findings impact

### New cross-cutting evidence

**1. `"production": false` in `.fallowrc.json` makes the dead-code gate structurally blind to
test-only exports — the exact class META-FINDINGS ranks #2.**
`.fallowrc.json:3` sets `"production": false`, so fallow counts a test file as a legitimate
consumer. An export whose only importer is a test therefore passes `fallow dead-code` clean. That
is why `resetRoutingState`, `resetEpoch`, `routingTableEntries` (routing-state.ts) and
`hookConfigPathFor` (stage.ts) all survive the gate. The setting is deliberate and recorded as
such, so this is not a request to flip it — it is the missing explanation for *why* item 2's
cluster exists and keeps growing, and it predicts more instances in every area nobody has
grepped. **Cheap repo-wide check any area can run:**
`for sym in <exports>; do grep -rn "\b$sym\b" extensions/ | grep -v <owning file>; done` — zero
hits means production has no caller. I would run this across `shared/`, `persistence/` and
`domain/` before planning item 2, because the module count is probably larger than four.

**2. A new sub-class of test-only export: the *state reader*, not just the reset hook.**
META-FINDINGS' table lists four modules, all under the heading "export a reset function". Two of
my three routing-state instances are readers, not resets (`routingTableEntries`), or path
composers (`hookConfigPathFor`). The rules ban both ("An export, reset hook, global mutator,
**state reader**, test mode … added for a test is a finding"), but a reviewer scanning for
`reset*` names will not find them. Worth re-scanning the other three modules in that table for
reader-shaped exports too.

**3. "The title claims a behavior the case does not discriminate" is a distinct, high-value defect
shape that the first pass's checklist does not name.**
`settle.test.ts:672` is titled `"a noop resets the cap and rearms its notification"` and cannot
fail if the re-arm is deleted. This is not a weak assertion in the usual sense — the case has
plenty of assertions and they are whole-value — it is a case whose *arrangement* never reaches the
state the title describes. Fragment-assertion hunting will not find it; only asking "what state
must exist before the act for this title to be meaningful?" will. Recommend adding that question
to the fixing pass's per-case checklist. Any area with counters, caps, latches, one-shot flags, or
"re-arm"/"reset" semantics should be re-read with it — `async-rewake/registry.ts`,
`shared/completion-cache.ts` and the orchestrators' retry/idempotency cases are the obvious
candidates.

**4. `Reflect.apply` as a type-laundering device is a new instance of the "hidden invalid double"
class.** META-FINDINGS tracks `as any`, double assertions and broad `Partial<T>` casts;
`Reflect.apply(fn, undefined, [invalidArg])` does the same job and is greppable
(`grep -rn "Reflect.apply" tests/`). Worth one sweep — the sanctioned form
(`{ … } as never` plus a direct call, or `@ts-expect-error` with a description) is already
in-repo at `tests/bridges/hooks/exec-result.test.ts:28–41`.

### Corrections to META-FINDINGS.md

- The claim in the item-2 table that `bridges/hooks/routing-state.ts`'s problem is
  "`resetRoutingState`/`resetEpoch`" understates it by one export and by an order of magnitude in
  blast radius. Correction: **three** exports have no production caller
  (`resetRoutingState`, `resetEpoch`, `routingTableEntries` — verified by grepping `extensions/`
  and by `bridges/hooks/index.ts:1–13` plus `tests/bridges/hooks/index.test.ts:65`), and
  `resetRoutingState` is imported by **18 test files** spanning `tests/bridges/hooks/`,
  `tests/architecture/`, `tests/orchestrators/plugin/` and `tests/integration/`. The sequencing
  advice ("`routing-state.ts` needs a wider change and should come last") is right and should be
  stated with that number attached.
- The item-2 note "Neither can be trusted as evidence without checking the call graph" is correct
  and generalises further than stated: in this area **three** doc comments assert a status the call
  graph contradicts — `resetRoutingState` ("a public lifecycle operation rather than a test hole"),
  `routingTableEntries` ("for callers that need the keyset"), and `stage.ts::hookConfigPathFor`
  ("Single source of truth … so the same composition is never duplicated", while three sites
  duplicate it and `orchestrators/plugin/info.ts:490–494` documents doing so on purpose).

### Confirmations

- **Item 1 (over-wide context parameters)** — independently confirmed in a file the sweep had not
  filed against it: `settle.ts:166–170` types `pi`/`ctx` against the full SDK surfaces while
  reading only `pi.sendMessage`, producing **9** `as unknown as` casts in `settle.test.ts`
  (`32, 33, 69, 80, 124, 143, 245, 279, 315`). It also *causes* a finding the first pass filed
  separately (the dead `isIdle` stub), which supports the meta-claim that one production change
  per function collapses several recorded findings.
- **Item 2's ordering recommendation ("start with `settle.ts` — no cross-module constraint")** —
  confirmed and strengthened. `settle.ts`'s four cells are private to the module's own closures,
  `resetSettleState` has exactly one production caller (`event-router.ts:721`), and the
  factory-owned refactor would additionally make the cap-latch re-arm observable, closing the
  BLOCKER above as a side effect. It really is the cheapest proof of the pattern.
- **"Sibling drift is the dominant shape"** — confirmed four times inside one 4-file area, each
  with the correct form sitting next door: whole-value vs length-only assertions *inside*
  `settle.test.ts` (`605` vs `672/699/730`); asserted vs unasserted debug diagnostics
  (`event-adapters.test.ts:253` vs `settle.test.ts`); literal vs production-computed test data
  (`routing-state.test.ts:368` vs `settle.test.ts:91`); `as never` vs `Reflect.apply` for the
  `assertNever` proof (`exec-result.test.ts:41` vs `event-adapters.test.ts:301`).
- **"Clean verdicts are not reliable"** — confirmed the hard way: both files on this area's clean
  lists yielded a BLOCKER apiece, while the files that already carried findings yielded mostly
  refinements. The adversarial pass's premise holds for this area.
