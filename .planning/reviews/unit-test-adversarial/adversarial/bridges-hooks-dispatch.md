# Bridges — hooks dispatch and routing — adversarial re-review

**Scope:** the two production modules the first pass declared clean
(`bridges/hooks/dispatch.ts`, `bridges/hooks/dispatch-exec.ts`), mutation-tested
against `tests/bridges/hooks/dispatch.test.ts` and
`tests/bridges/hooks/dispatch-exec.test.ts`; plus an export/branch census of all
four production modules in the area and a re-attack on
`tests/bridges/hooks/event-router.test.ts`. The 10 payload translators under
`bridges/hooks/payloads/` were read in full to settle the `REQUIRED_EVENT_FIELDS`
lead.
**First-pass file:** `unit-test-findings/bridges-hooks-dispatch.md`
**Clean files attacked:** 2 (`dispatch.ts`, `dispatch-exec.ts` — the first pass's
test-side clean list was empty, so both clean entries are production modules)
**Existing findings graded:** 12

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 4 |
| New WARNING (missed by first pass) | 7 |
| Existing CONFIRMED | 8 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 2 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 1 |

The first pass's picture of this area is directionally right but incomplete in a
specific way: it graded the two dispatch production modules clean on *design*
(both use proper dependency injection, which is true and worth keeping) and
never ran a value-level mutation test against them. Four mutations survive the
whole suite, one of which is a live silent-degradation bug in the `pi` threading.

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`

- **[BLOCKER] `REQUIRED_EVENT_FIELDS` understates 6 of the 10 translators, so the
  WR-03 probe is silent for exactly the corruption it was built to surface** —
  `dispatch-exec.ts:228-239`, test `tests/bridges/hooks/dispatch-exec.test.ts:824-865`

  The table is supposed to name, per event, the fields the translator reads, so a
  wrong-shaped event landing on the wrong translator produces a `hookDebugLog`
  line instead of a silently-truncated envelope. Reading all ten translators, the
  table is wrong for six:

  | Event | Fields the translator actually reads | `REQUIRED_EVENT_FIELDS` |
  | --- | --- | --- |
  | `SessionStart` | `reason` (`payloads/session-start.ts:31`) | `[]` — **misses `reason`** |
  | `UserPromptSubmit` | `text` | `["text"]` — correct |
  | `PreToolUse` | `toolName`, `input` | `["toolName","input"]` — correct |
  | `PostToolUse` | `toolName`, `input`, `content` (`payloads/post-tool-use.ts:40`) | `["toolName","input"]` — **misses `content`** |
  | `PostToolUseFailure` | `toolName`, `input`, `content` (`payloads/post-tool-use-failure.ts:39`) | `["toolName","input"]` — **misses `content`** |
  | `PreCompact` | none (`_event`) | `[]` — correct |
  | `PostCompact` | none (`_event`) | `[]` — correct |
  | `SessionEnd` | `reason` (`payloads/session-end.ts:30`) | `[]` — **misses `reason`** |
  | `Stop` | `last_assistant_message`, `stop_hook_active` (`payloads/stop.ts:39-40`) | `[]` — **misses both** |
  | `StopFailure` | `error`, `last_assistant_message` (`payloads/stop-failure.ts:44,46`) | `[]` — **misses both** (`error_details` is correctly optional) |

  Concretely: dispatch a `SessionEnd` entry with an event that has no `reason`.
  `translate` emits `reason: undefined`, `JSON.stringify` elides the key, the
  child receives an envelope with no `reason`, and `buildPayload` logs nothing.
  That is verbatim the failure the docstring at `dispatch-exec.ts:220-226` claims
  the probe converts into "an observable `hookDebugLog` signal".

  The paired test cannot catch it because its `requiredFields` column is a
  **hand-copy of the production constant**, not a derivation from the translators
  — `dispatch-exec.test.ts:620` (`SessionStart: requiredFields: []`),
  `:656`/`:675` (`PostToolUse`/`PostToolUseFailure`: `["toolName","input"]`),
  `:747` (`SessionEnd: []`), `:757` (`Stop: []`), `:770` (`StopFailure: []`).
  The contradiction is visible inside the same table row: `SessionEnd` declares
  `requiredFields: []` on line 747 and `eventFields: { reason: "quit" }` on line
  753 — the second column proves the translator reads `event.reason` while the
  first column says nothing is required.

  Fix, both halves: (1) correct `REQUIRED_EVENT_FIELDS` to
  `SessionStart: ["reason"]`, `PostToolUse: ["toolName","input","content"]`,
  `PostToolUseFailure: ["toolName","input","content"]`,
  `SessionEnd: ["reason"]`, `Stop: ["last_assistant_message","stop_hook_active"]`,
  `StopFailure: ["error","last_assistant_message"]`. (2) In the test, delete the
  `requiredFields` column and derive it from `eventFields` instead — the row
  already states what the translator emits, so the required set is
  `Object.keys(createEvent())` intersected with the fields `eventFields` depends
  on; the simplest correct form is to assert one `missing required field` line
  per key of an independently hand-written per-event list that lives in the test
  file with a comment pointing at the translator source line it was read from,
  and never imports or mirrors the production constant.

- **[WARNING] `spawnAndCollect`'s `spawnImpl: typeof spawn = spawn` default is
  unreachable** — `dispatch-exec.ts:297`
  `spawnAndCollect` is module-private and has exactly one call site
  (`dispatch-exec.ts:206`), which always passes the resolved `spawnImpl` computed
  at line 153. The default initializer can never fire. Delete `= spawn` and make
  the parameter required; the `spawn` import stays live through line 153.

- **[WARNING] Two test-support seams weaken the spawn boundary's type contract** —
  `tests/bridges/hooks/dispatch-exec.test.ts:469-471`, `:502`
  `isSpawnOptions` is a type predicate that returns `candidate is SpawnOptions`
  for any non-null object, so the recorded `options` in `CapturedSpawnCall` is
  typed by an unsound guard rather than checked. Separately, `spawnImpl` at line
  502 wraps the Proxy in `t.mock.fn(...)` whose `.mock.calls` is never read — the
  `calls` array does all the work. Narrow `CapturedSpawnCall.options` to the
  fields the cases actually assert (`cwd`, `env`, `stdio`, `shell`) and drop the
  `t.mock.fn` wrapper, or read the mock's call log instead of the side array.

### `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`

- **[BLOCKER] The `pi` argument is never threaded non-`undefined` by any case, so
  dropping it from both executor call sites survives the whole suite** —
  `dispatch.ts:188` and `dispatch.ts:277`; every call site in
  `tests/bridges/hooks/dispatch.test.ts` (30 of them, lines 348, 606, 630, 681,
  734, 779, 824, 877, 900, 918, 983, 1048, 1080, 1098, 1137, 1180, 1210, 1252,
  1298, 1341, 1376, 1414, 1455, 1496, 1537, 1575, 1614, 1658, 1710, 1756) passes
  literal `undefined` for `pi`.

  Mutate `dispatch.ts:188` to `await executor(entry, event, ctx, undefined)` and
  `dispatch.ts:277` likewise: all 31 cases stay green. The mutation is not
  cosmetic — `dispatchHookExec` reads `pi` at `dispatch-exec.ts:169-175` and, when
  it is `undefined`, **skips the async-rewake spawn entirely** and returns
  `{ kind: "noop" }`. So this mutation silently disables every `asyncRewake: true`
  hook in the product, and the paired test proves nothing about it. The sibling
  file cannot cover for it either: all four `HookExecutor` doubles in
  `event-router.test.ts` (lines 267, 295, 1453, 1526) destructure only `(entry)`
  and discard `event`, `ctx`, and `pi`.

  Fix: give at least one `compositeHandlerFor` case and one
  `toolResultCompositeHandler` case a distinguishable `pi` sentinel and assert it
  arrives. The file already has the right recorder — `ExecutorCall`
  (`dispatch.test.ts:63-80`) and `recordExecutorCall` (`:129-158`) capture
  `context` and `pi`, and the case at `:229` compares the whole tuple with
  `deepStrictEqual` at `:442`. Promote that recorder to be the default for the
  file (replacing `RecordedCall`/`createRecordingExecutor`, which capture only
  `{ pluginId, event }`) and pass a real `pi` object in at least the PreToolUse
  and tool_result cases.

- **[BLOCKER] The three observation-event cases discard the handler's return
  value, so `adaptForEvent`'s "always `undefined`" contract is unasserted** —
  `tests/bridges/hooks/dispatch.test.ts:1667`, `:1716`, `:1762`
  `test('drops a SessionEnd block after observing it')`,
  `test('drops a PreCompact stop after observing it')`, and
  `test('passes a PostCompact noop through after observing it')` each call
  `await handler(event, context);` with no assignment, and their only assertion is
  `assert.deepStrictEqual(executorCalls, expectedCalls)`. Nothing checks the
  "drops" or "passes through" the titles name.

  Two mutations survive. (a) Change `dispatch.ts:421` from `return undefined;` to
  `return adaptToolCallResult(reduced.result, event as ToolCallEvent);` — the
  observation handlers now hand Pi a `{ block: true }` on a SessionEnd hook and
  no case fails. (b) Delete the `adaptObservationResultForEvent(...)` call at
  `dispatch.ts:420` for the three non-SessionStart events — no case fails (only
  the SessionStart provenance case at `:1592` pins that call, via
  `pendingSessionStartContextEntries()`).

  This is intra-file sibling drift with a known-good target six lines up: the six
  cases at `:1357`, `:1390`, `:1431`, `:1472`, `:1513`, `:1554` — same
  `describe("composite per-event adapters")` — all do
  `const output = await handler(event, context)` followed by
  `assert.deepStrictEqual(output, expectedOutput)`. Apply that exact form to the
  three observation cases with `const expectedOutput = undefined;`, and add an
  assertion on the debug seam so "after observing it" means something (see the
  next finding).

- **[WARNING] `dispatch.test.ts` never observes `hookDebugLog`, so
  `collectBucketOutcomes`'s async-rewake degradation log is unasserted** —
  `dispatch.ts:270-272`; `tests/bridges/hooks/dispatch.test.ts` contains zero
  references to `hookDebugLog`, `debug-log`, or any debug observer (grep-confirmed).
  Delete the `hookDebugLog(...)` call at `dispatch.ts:270` and the case at
  `dispatch.test.ts:477` (which does exercise the async-degraded entry) stays
  green — yet the module's own docstring at `dispatch.ts:245-247` says the log is
  what makes the dropped decision "observable". The sibling
  `dispatch-exec.test.ts` already has the harness: `observeDebug(t)` +
  `debugLines(...)`, used at `:833`, `:870`, `:909`. Lift that helper into a
  shared location beside the hooks tests and assert the degradation line in the
  `collectBucketOutcomes` case and the two observation block/stop cases above.

- **[WARNING] `collectBucketOutcomes`'s "mutations are NOT applied in place"
  promise has no case** — `dispatch.ts:245-247`, test
  `tests/bridges/hooks/dispatch.test.ts:541-549`
  The results map in the only populated case supplies `noop`, `block`, and `stop`
  only — no `mutate`. Insert
  `if (result.kind === "mutate") { applyMutationInPlace(event, result); }`
  before the `outcomes.push` at `dispatch.ts:278` and both cases stay green,
  even though that change is exactly the D-88-05 violation the docstring forbids.
  Add a sixth entry to the bucket returning
  `{ kind: "mutate", updatedInput: { injected: true } }` and assert with
  `assert.deepStrictEqual(event, expectedEvent)` that the event is byte-identical
  to its arranged value — `reduceBucket`'s own tests already use that form at
  `:440` and `:854`.

- **[WARNING] The `provenance` fallback at `adaptForEvent` is unobservable and its
  comment misstates when it fires** — `dispatch.ts:411-419`
  The comment says the placeholder "is only seen by the block/stop debug-log
  path's no-op semantics". That is false: `reduceBucket` sets
  `attributedTo = entry` on both terminal arms (`dispatch.ts:196`) and on the
  mutate arm (`:210`), so block/stop *always* carry provenance. The placeholder
  is reachable only on an all-`noop` bucket, and `adaptObservationResultForEvent`
  reads `provenance` only in its SessionStart-mutate arm
  (`event-adapters.ts:321-332`) — so the placeholder's field values can never be
  observed by anything. Mutating them to
  `{ scope: "project", marketplace: "zz", pluginId: "yy" }` survives every case.
  Fix at the production layer, not the test layer: make `ReducedBucket` carry
  `attributedTo` as required only where it is read — i.e. pass
  `reduced.attributedTo` through and let `adaptObservationResultForEvent` take
  `provenance?: {...}`, dropping the synthetic object and the misleading comment
  with it.

- **[WARNING] Three `switch` statements omit the `default` / `assertNever` arm the
  same file uses one function earlier** — `dispatch.ts:110-120`
  (`matcherFiresOnToolEvent`), `:395-423` (`adaptForEvent`), `:475-491`
  (`entryFires`); the correct form is at `:214-215` (`reduceBucket`'s
  `default: return assertNever(r);`).
  **Deliberately filed as WARNING, not BLOCKER**, and this is a calibration point
  for META-FINDINGS item 5: `tsconfig.json:11` sets `noImplicitReturns: true`, and
  this repo has already recorded that TS7030 fires on a missing switch arm even
  when the return type includes `undefined`. All three functions return a value on
  every arm, so adding a union member is a compile error today. The finding is
  consistency with the file's own idiom, not a silent-omission risk.

- **[WARNING] Two exported types have no owning case** —
  `dispatch.ts:226` (`BucketOutcome`) and `:437` (`CompositeEventFor`).
  Neither is imported by `dispatch.test.ts` (its type import block is lines
  26-30: `CompositeDispatchEvent`, `CompositeReturnFor`, `HookExecutor` only).
  The model treatment already exists in the same file:
  `dispatch.test.ts:46-61` gives `CompositeDispatchEvent` a `satisfies` positive
  plus four `@ts-expect-error` negatives. Give `CompositeEventFor` the same shape
  (`{...} satisfies CompositeEventFor<"PreToolUse">` plus a `@ts-expect-error`
  proving a `SessionStartEvent` is rejected there) and annotate the
  `expectedOutcomes` literal at `:550` as `BucketOutcome[]`.

### `tests/bridges/hooks/event-router.test.ts`

- **[BLOCKER] The reload case patches a Node builtin and forces the ESM binding to
  re-sync, which is the banned loader technique** — `lines 432-466`
  `t.mock.method(fs.promises, "readFile", ...)` replaces the process-wide
  `fs.promises.readFile`, and `syncBuiltinESMExports()` (imported from
  `node:module` at `line 6`) is then called so production modules that already
  hold the ESM binding pick up the replacement. The testing rules put this in the
  same class as `t.mock.module()`: "a custom loader is a finding — the dependency
  gets injected instead." Worse, the intercepted calls are what *build*
  `operationLog` (`lines 441-457`), so the ordered assertion at `:514-536` — the
  case's headline claim — is derived by spying on a global builtin rather than on
  the module's own port.

  The first pass filed the reload case as a BLOCKER for being a multi-module
  integration test, which is true, but it did not name the builtin patch, and the
  builtin patch does not go away when the case is split — it must be replaced.
  Fix: give `registerHooksBridge`/`hydrateCacheFromDisk` an injected reader port
  in `opts` alongside the `executor` seam it already has
  (`event-router.ts:705`, `:783`), default it to `fs.promises.readFile` in
  production, and have the case pass a recording reader. That deletes the
  `node:module` import, the `syncBuiltinESMExports()` pair, and the
  `readFile.mock.restore()` teardown at `:462-465` in one move.

- **[WARNING] The file-level docstring describes a suite that no longer exists** —
  `lines 70-85`
  It claims the scope is "parsedConfigCache mutator idempotency … rebuildRoutingTables …
  currentEpoch initial value and accessor shape" and that "this suite only pins
  the synchronous primitives", with composite dispatch handled elsewhere. The file
  now opens with a 500-line reload case that spawns real subprocesses, mutates
  `process.platform`, and drives `registerHooksBridge` end to end (`:91-590`),
  plus `hydrateProjectScopeForCwd`, `beforeAgentStartHandlerFor`, and
  `session_start` lazy-hydration cases. A reader trusting the header will not look
  for any of that here. Rewrite the header to describe the current case list, and
  drop "landed alongside that file" — narration of an authoring event, which
  `.claude/rules/typescript-comments.md` bans.

- **[WARNING] `routing-state.ts` is imported twice in adjacent statements** —
  `lines 34-41` and `lines 42-45`
  The second import brings in `currentEpoch` (a value) and `type RoutingEntry`
  from the identical specifier already used four lines above. Merge into the
  single value-import block and move `RoutingEntry` into the `import type` group
  at the bottom, which is where the file puts its other type-only imports
  (`lines 57-68`).

## Export ownership census

`dispatch.ts` (9 exports):

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `dispatch.ts` | `HookExecutor` (type) | `dispatch.test.ts:332`, `:875` (annotation sites) | owned |
| `dispatch.ts` | `matcherFiresOnClosedSetValue` | `dispatch.test.ts:446-473` (4 data rows) | owned |
| `dispatch.ts` | `BucketOutcome` (interface) | — | **NO CASE** (never imported; only structurally exercised through an untyped `expectedOutcomes` literal at `:550`) |
| `dispatch.ts` | `collectBucketOutcomes` | `dispatch.test.ts:477`, `:620` | owned — but the `mutate` arm and the debug log are unasserted (see findings) |
| `dispatch.ts` | `CompositeDispatchEvent` (type) | `dispatch.test.ts:46-61` (`satisfies` + 4 `@ts-expect-error`) | owned — model form for this repo |
| `dispatch.ts` | `compositeHandlerFor` | 20 cases across 4 `describe()` blocks | owned |
| `dispatch.ts` | `toolResultCompositeHandler` | `dispatch.test.ts:1065-1355` (9 cases) | owned |
| `dispatch.ts` | `CompositeEventFor` (type) | — | **NO CASE** (not imported by the paired test) |
| `dispatch.ts` | `CompositeReturnFor` (type) | `dispatch.test.ts:433`, `:902`, `:919`, `:984` | owned |

`dispatch-exec.ts` (1 export):

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `dispatch-exec.ts` | `dispatchHookExec` | 25 cases in `dispatch-exec.test.ts` | owned; the strongest pairing in the area |

`event-router.ts` — all 7 exports (`addPluginConfigToCache`,
`removePluginConfigFromCache`, `readAndCachePluginHooks`,
`beforeAgentStartHandlerFor`, `rebuildRoutingTables`, `hydrateProjectScopeForCwd`,
`registerHooksBridge`) are imported and named by `event-router.test.ts`. No
ownership gap.

`routing-state.ts` — 16 exports, all reached by `routing-state.test.ts` (not in
this area's assignment). `resetEpoch` and `resetRoutingState` have **only** test
callers plus one internal self-call at `routing-state.ts:321` — grep-confirmed
across `extensions/` and `tests/`.

## Branch census

`dispatch.ts`:

- `reduceBucket` `default: return assertNever(r)` (`:214`) — **reachable and
  tested**, planted at `dispatch.test.ts:860-884` via `Object.defineProperty` on a
  case-local result object. Legitimate use of the plant-a-violation pattern.
- `adaptForEvent` observation arm's `provenance` fallback (`:415-419`) —
  **reachable but structurally unobservable**. Taken on any all-`noop`
  observation bucket (e.g. `dispatch.test.ts:1722`), but the value it produces is
  read nowhere. Not compiler-forced; removable by making `provenance` optional
  downstream. Filed as a WARNING above.
- `matcherFiresOnToolEvent` `case "regex"` / `case "unmapped"` (`:117-119`) —
  documented as "unreachable at dispatch" because the parser filters them, but
  `dispatch.test.ts:960-971` plants both (`rawMatcher: "Bash.*"` and
  `"UnknownTool"`) and proves neither fires. **Reachable through the public
  routing-table setter and tested.** No finding.
- `compositeHandlerFor` stale-epoch return (`:326-328`) and empty-bucket return
  (`:331-333`) — both tested (`:886`, `:911`); same pair for
  `toolResultCompositeHandler` (`:1066`, `:1091`).
- `entryFires` / `adaptForEvent` missing `default` arms — **compiler-forced
  category**: `noImplicitReturns` (`tsconfig.json:11`) turns a new union member
  into TS7030 at these sites. Not a silent-omission risk; style-consistency only.

`dispatch-exec.ts`:

- `deps.spawnImpl ?? spawn` (`:153`) — the `spawn` default is exercised by the
  real-subprocess case at `dispatch-exec.test.ts:37`. Reachable and tested.
- async-rewake arm, `pi === undefined` branch (`:170-175`) — tested
  (`dispatch-exec.test.ts:1066`).
- async-rewake `catch` around `spawnAndRegister` (`:180-184`) — tested
  (`:1101`, `:1144`).
- `!isDispatchableEvent` defensive noop (`:194-199`) — tested (`:977`, planting
  `"SubagentStop"`).
- outer `try/catch` (`:207-210`) — tested (`:867`, `:939`).
- `buildPayload` non-object probe (`:260-263`) — tested (`:867`, `:904`).
- `buildPayload` missing-field probe (`:264-272`) — **reachable and exercised, but
  against a table that understates the contract for 6 of 10 events.** See the
  BLOCKER.
- `spawnAndCollect`'s `spawnImpl = spawn` default (`:297`) — **unreachable**: the
  single call site at `:206` always passes the argument. Production dead code.
- `settle` re-entry guard (`:325-327`) — tested (`:1409`).
- `handleOverflow` re-entry guard (`:344-346`) — tested (`:1719`).
- `handleOverflow` `if (!child.killed)` (`:362-364`) — tested both ways (`:1626`
  not-killed, `:1678` already-killed).
- `close` with `overflowed` (`:402-405`), `stderr.length > 0` sink (`:408-410`) —
  tested (`:1220-1275`).
- `accumulateStream` `stream === null` (`:450-452`) — **reachable only through the
  injected fake.** Production `spawn` with `stdio: ["pipe","pipe","pipe"]` returns
  `ChildProcessWithoutNullStreams`, so real input cannot produce a null stream;
  `dispatch-exec.test.ts:1449` reaches it by returning a `ChildProcess` whose
  `stdout`/`stderr` were `Object.defineProperties`-overwritten to `null`, which
  violates the `typeof spawn` return contract `observeSpawn` declares at `:479`.
  Classify as **defensive-against-a-type-forbidden-shape**, not compiler-forced —
  it belongs with META-FINDINGS "Decisions" item 1, though it is far milder than
  the global-prototype cases listed there (nothing outside the case is patched).
- `accumulateStream` decoder tail (`:466-471`) — tested (`:1302`).

## Grading of first-pass findings

### `tests/bridges/hooks/dispatch.test.ts`

- **CONFIRMED** — *Every case depends on the module-global routing-state singleton*
  — 62 `resetRoutingState()` sites grep-confirmed. One factual correction that
  makes it slightly worse, not better: the file has **31** cases, not 20, so it is
  31 cases × 2 calls, and every one of the 31 carries the boilerplate.
- **OVERSTATED** — *Hand-rolled call-recording doubles stand in for `HookExecutor`*
  — the recommendation is half wrong by the skill's own text. `createRecordingExecutor`
  (`:213-226`) rejects on any unplanned `pluginId`, which is the loud-failing-fake
  pattern META-FINDINGS names as a *pattern to propagate*; and because call order
  is the promise here, the skill explicitly prescribes "each promised method is
  replaced by a recorder pushing into one shared log", i.e. the current shape.
  Correct severity is WARNING for the *recorded tuple*, not the tool: the real
  defect is that `RecordedCall` (`:82-85`) captures only `{ pluginId, event }` and
  drops `ctx` and `pi` — which is what lets the new `pi` BLOCKER above through.
- **CONFIRMED** — *`compositeHandlerFor` coverage split across four `describe()` names*
  — `:228`, `:643`, `:859`, `:1356` all exercise `compositeHandlerFor` /
  `toolResultCompositeHandler` under scenario-category names.

### `tests/bridges/hooks/dispatch-exec.test.ts`

- **CONFIRMED** — *The portability case spawns a real subprocess and reimplements
  timer observation* — verified: the case at `:37-328` is the only one that omits
  `spawnImpl`, and it hand-wraps the global timers at `:90-123` while five sibling
  cases use `t.mock.timers`. The recommendation to document *why* the real child
  is used is the important half; the EXEC-04 shell-metacharacter proof
  (`literalArgument` at `:125`) genuinely cannot be faked.
- **OVERSTATED** — *`observeSpawn`'s Proxy-based call recorder could be a
  `strong-mock` mock* — the first pass itself concedes the assertions are already
  exact. The Proxy recorder plus per-case `deepStrictEqual` on
  `{ command, args, options }` discriminates every argument mutation I tried.
  Downgrade to a note; the actionable residue is the unsound `isSpawnOptions`
  predicate and the unread `t.mock.fn` wrapper, filed as a new WARNING above.

### `tests/bridges/hooks/event-router.test.ts`

- **CONFIRMED** — *File-level `beforeEach` resets a module-global singleton* —
  `beforeEach` at `:87-89` plus `ownRoutingState(t)` at 14 call sites, plus 5
  direct `resetRoutingState()` sites. The `{ concurrency: false }` at `:93` is the
  acknowledgment the first pass says it is.
- **UNDERSTATED** — *The reload test is a ~500-line multi-module integration test*
  — everything the first pass says is true, and it misses the sharpest part: the
  case does not merely *use* other modules, it **patches a Node builtin and
  re-syncs the ESM binding** (`:432-466`) to fabricate its `operationLog`. That
  is a banned technique that survives the split the first pass recommends, so the
  fix instruction is incomplete as written. Severity stays BLOCKER; the fix must
  add "replace the `fs.promises.readFile` interception with an injected reader
  port" as a precondition of the split. Filed in full as a new BLOCKER above.
- **CONFIRMED** — *`makeRecordingPi()` is a hand-rolled `ExtensionAPI` recorder
  hidden behind an `as` cast* — verified at `:706-713`; a two-method literal cast
  to the full interface.
- **CONFIRMED** — *`beforeAgentStartHandlerFor` tests seed through a sibling module* —
  `adaptObservationResultForEvent` is imported at `:23` and used for seeding, when
  `appendPendingSessionStartContext` exists in `routing-state.ts:210` for exactly
  that.

### `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts`

- **CONFIRMED** — *`resetEpoch()` / `resetRoutingState()` exist only to serve tests*
  — grep across `extensions/` and `tests/` finds no non-test caller of either
  beyond the internal `resetEpoch()` at `:321`. Two supporting details worth
  carrying into the fix ticket: the docstring at `:317-318` claims "the four
  clears it composes are each already public", which is **false** —
  `clearParsedConfigCache` (`:257`) and `clearRoutingTable` (`:296`) are
  module-private, so a caller genuinely cannot compose the reset itself; and 18
  test files call `resetRoutingState`, so this is the widest-blast-radius
  production change in the area.

### `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`

- **CONFIRMED** — *`homedir()` is called inline inside business logic* — verified
  at `:179`, `:446`, `:573`, and the test's `process.env.HOME` save/restore at
  `event-router.test.ts:99-117` is the direct consequence.
- **DUPLICATE-OF** — *`registerHooksBridge` takes the full `ExtensionAPI` but only
  calls `.on(...)`* — this is one instance of META-FINDINGS "Ranked by leverage"
  item 1 (over-wide context parameters). It should be owned by that consolidated
  ticket rather than as a standalone area finding, because the fix (declare a
  narrow consumer port) is the same production change being made for `notify()`,
  `if-field`, and a dozen other sites. Keep the local evidence — `pi.on` at
  `:784-821` is the entire direct use — but file it under the cluster.

## Still clean after attack

- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` — apart from
  the `REQUIRED_EVENT_FIELDS` defect, this is the strongest pairing in the area.
  Mutations the cases genuinely catch: swapping any two entries in `TRANSLATORS`
  (`:113-124`) — the per-event `hook_event_name` in the expected payload
  discriminates all 10; changing either byte cap by one
  (`dispatch-exec.test.ts:1596` asserts exactly-cap passes, `:1626`/`:1678` assert
  cap+1 overflows); dropping the `removeAllListeners` calls on overflow (`:352-355`,
  asserted via `listenerCount` at `:1646-1647`); reordering the stdin
  error-listener attachment after `end()` (`:419-424`, pinned by the
  `stdinOrder: ["error-listener","finish"]` assertion at `:818`); swallowing the
  spawn `error` event (`:394-399`, pinned at `:1338`); dropping the
  `StringDecoder` and calling `chunk.toString("utf8")` instead (`:457`, pinned by
  the split-UTF-8 case at `:1220`); flipping exec-form vs shell-form selection
  (`:1474`); and returning a stale `{kind:"noop"}` instead of the parsed stdout
  (whole-value `deepStrictEqual` on every outcome).
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` reducer core —
  mutations the cases catch: dropping the first-block short-circuit (`:197`,
  pinned at `:697`); dropping the stop short-circuit (pinned at `:749`);
  reordering `applyMutationInPlace` relative to the next executor call (pinned by
  the composed-mutation event snapshot at `:421-432`/`:440`); inverting
  `event.isError` in `toolResultCompositeHandler` (`:366`, pinned by the paired
  cases at `:1108`/`:1151`, each of which supplies executor results for only one
  bucket so a wrong route rejects); skipping the `ifFires` filter (`:184`, pinned
  at `:229`); and letting a non-firing matcher through (pinned at `:928`, where
  the results map deliberately omits the four miss entries so a wrong fire
  rejects).
- `matcherFiresOnClosedSetValue` — the four data rows at `:447-452` cover `""`,
  `"*"`, exact-hit, and exact-miss; inverting any clause of
  `raw === "" || raw === "*" || raw === value` fails at least one row.

## Not covered

- I did not run `node --test`, `npm run test:coverage:direct`, or `npm run check`,
  per the brief. Every coverage and mutation claim above is from reading source,
  not from executing a mutant.
- `tests/bridges/hooks/settle.test.ts`, `async-rewake/registry.test.ts`,
  `async-rewake/pid-table.test.ts`, and `routing-state.test.ts` were not reviewed;
  they own pairings outside this assignment. Where I claim a behavior is untested
  (notably the `pi` threading), the claim is scoped to the two paired test files
  in this area — a case in one of those four files could in principle cover it,
  but the guidelines put ownership on the pair regardless.
- `tests/bridges/hooks/event-router.test.ts` lines 120-410 and 590-690 were read
  only in the regions supporting the findings above; I did not mutation-test the
  reload case end to end, since the first pass already recommends deleting it in
  its current form.
- The integration suite (`tests/integration/hooks-*.test.ts`, four files that call
  `resetRoutingState`) is out of the sweep's glob and was not examined.

## Meta-findings impact

### New cross-cutting evidence

**1. Expected values copied from a production constant are a distinct, invisible
defect class — and this is the first confirmed instance.** META-FINDINGS lists
"expected values computed by production code" under the fragment-assertion and
weak-assertion headings, but the `REQUIRED_EVENT_FIELDS` case is a different
shape: the test does not *call* production code, it *transcribes a production
table into a test literal*. Every mutation to the table then fails the test, so
the test looks strong and the coverage tool sees the branch covered — while the
one thing that matters (does the table match what the translators read?) is never
checked. Other areas should be swept for the same shape: any test row whose
expected column is a verbatim copy of a `Record<Union, ...>` constant in the
module under test. Likely candidates given the repo's style are the
`domain/components/*` TypeBox schema tables, `shared/notify-reasons.ts`'s reason
catalogue, and `orchestrators/**/*.messaging.ts` token tables. The detection rule
is mechanical: grep for a test-file literal whose keys are the same closed union
as a production `Record<...>` in the paired module.

**2. Optional dependency parameters that every case passes as `undefined`.** The
`pi` BLOCKER above is an instance of a class that a partitioned pass structurally
cannot see: a parameter is threaded correctly through production, every test
passes `undefined` for it because it is optional, and the threading is therefore
unverified. This is the mirror image of the repo's own recorded
"optional-field silent-omission class". Any module with an `opts?`/`pi?`/`deps?`
tail parameter should be checked the same way — grep the paired test for the
parameter name and confirm at least one case passes a non-`undefined` sentinel
and asserts it arrives. `orchestrators/plugin/*` (which thread `pluginUpdate`,
`authMemo`, and `gitOps` seams) and `edge/handlers/**` are the places to look.

**3. `syncBuiltinESMExports` is a loader trick and should be swept for
repo-wide.** `tests/bridges/hooks/event-router.test.ts:6` is the instance I found.
It is functionally equivalent to the `t.mock.module()` the guidelines ban, and it
is invisible to a reviewer scanning for `mock.module`. Recommend a grep for
`syncBuiltinESMExports` and `t.mock.method(fs`/`t.mock.method(fs.promises` across
`tests/` as a follow-up to the "gates that do not gate" audit — an architecture
test forbidding both tokens in `tests/**` would be cheap and would plant a real
violation rather than read a config.

### Corrections to META-FINDINGS.md

**Correction 1 — the `routing-state.ts` doc comment does not lie.**
META-FINDINGS §"Replace test-only hooks over module-global state" states:
`bridges/hooks/routing-state.ts` — "`resetRoutingState`/`resetEpoch` — doc comment
**falsely claims** production-lifecycle status". Reading the source settles it the
other way: `routing-state.ts:316-318` says "Its only caller today is test setup,
which is what a reset is for". The comment *argues* the export is a legitimate
lifecycle operation, but it *states the true call graph*. The genuinely false
claim is one clause later — "the four clears it composes are each already public"
— which is contradicted by `clearParsedConfigCache` at `:257` and
`clearRoutingTable` at `:296`, both non-exported. That inversion matters for the
adjacent sentence in META-FINDINGS ("Note the doc comments cut both ways: one
module honestly admits its test-only export, another actively misdescribes it"):
`routing-state.ts` is the *honest* one on the call-graph question, and the false
clause is about reachability, not about who calls it. Suggested replacement text:
"doc comment admits the only caller is test setup, but falsely claims the clears
it composes are public — two of the four are module-private, so no caller can
compose the reset itself."

**Correction 2 — the exhaustiveness cluster (item 5) needs a compiler check
before severity is assigned.** META-FINDINGS item 5 treats a missing `default`
arm as the silent-omission class ("adding a member to a closed set compiles clean
at every derivation site"). That premise does not hold for a `switch` whose every
arm returns a value: `tsconfig.json:11` sets `noImplicitReturns: true`, and this
repo has already recorded that TS7030 fires at such a site even when the return
type includes `undefined`. `dispatch.ts` has three such switches (`:110`, `:395`,
`:475`) and adding a union member is a compile error at all three today. Before
`orchestrators/reconcile/plan.ts` and `apply.ts` are planned as BLOCKERs, check
whether their switches return on every arm or fall through to code after the
switch — only the latter is the silent-omission class. The distinction changes the
severity, not the desirability of the `assertNever` arm.

### Confirmations

- **"Clean verdicts are not reliable" (§Provenance).** Confirmed hard in this
  area. Both files on the first pass's clean list yielded surviving mutations,
  and one of them (`REQUIRED_EVENT_FIELDS`) is a shipping diagnostic defect, not a
  test gap. The two clean verdicts were correct about *design* (both modules do
  inject their side-effecting collaborators, which is genuinely the in-repo
  template) and that appears to be what stopped the first pass from doing a
  value-level pass on them.
- **"Sibling drift is the dominant shape" (§The dominant shape).** Confirmed
  three times here, and twice it is drift *within a single file*, which is a
  tighter form than the cross-file examples META-FINDINGS lists:
  `dispatch.test.ts`'s six adapter cases assert `output` while the three
  observation cases in the same `describe()` do not; `dispatch.ts`'s
  `reduceBucket` has the `assertNever` default that its three sibling switches
  omit; `dispatch.test.ts` has both a full-tuple recorder (`ExecutorCall`, used
  once) and a two-field recorder (`RecordedCall`, used 20+ times). Intra-file
  drift is worth adding to the detection heuristics — it is cheaper to fix than
  the cross-file kind because the target is already in the reviewer's viewport.
- **"Offline fake that fails loudly on unplanned input" (§Patterns to propagate).**
  Independently confirmed as already-adopted here: `createRecordingExecutor`
  (`dispatch.test.ts:213-226`) rejects on any `pluginId` not in its results map,
  and several cases (`:928`, `:1108`, `:1151`) rely on that rejection as the proof
  that a matcher or bucket did *not* fire. This is a second reference
  implementation alongside `tests/orchestrators/plugin/fetch.test.ts` and worth
  naming in the table, because it shows the pattern working for a non-git
  collaborator.
