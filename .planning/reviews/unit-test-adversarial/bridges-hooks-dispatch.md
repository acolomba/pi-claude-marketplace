# Bridges — hooks dispatch and routing

**Scope:** `tests/bridges/hooks/dispatch.test.ts`, `tests/bridges/hooks/dispatch-exec.test.ts`,
`tests/bridges/hooks/event-router.test.ts`, and their paired production modules
`extensions/pi-claude-marketplace/bridges/hooks/{dispatch.ts,dispatch-exec.ts,event-router.ts,routing-state.ts}`.
**Test files reviewed:** 3 (5,076 lines)
**Production modules reviewed:** 4

## Summary

`dispatch-exec.test.ts` is the strongest file of the three: fully injected
spawn boundary, correct `t.mock.timers` usage, `strong-mock` used correctly
for the `ExtensionAPI` non-interaction proof, careful `process.env`
save/restore, and full-value `deepStrictEqual` assertions throughout.
`dispatch.test.ts` has the same assertion discipline but is built entirely on
top of `routing-state.ts`'s module-global singleton, requiring
`resetRoutingState()` before *and* after every single case (62 call sites).
`event-router.test.ts` has the same global-state dependency (a file-level
`beforeEach` plus a per-test `ownRoutingState()` helper) and additionally
contains one ~500-line test that spawns a real long-lived orphan process,
mutates `process.platform`, and exercises three other modules'
(`async-rewake/registry.ts`, `async-rewake/pid-table.ts`, `settle.ts`)
behavior that does not belong to `event-router.ts`. The three themes a
fixing pass should attack first: (1) retire `routing-state.ts`'s
test-only `resetEpoch`/`resetRoutingState` hooks in favor of factory-owned
state injected into `dispatch.ts`/`dispatch-exec.ts`/`event-router.ts`, the
same way this codebase already injects `HookExecutor`/`SpawnDeps`; (2) split
the mega reload test in `event-router.test.ts` into focused, hermetic cases
and relocate the async-rewake/settle assertions to their own paired test
files; (3) replace the hand-rolled call-recording doubles
(`createRecordingExecutor`, inline `HookExecutor` closures, `makeRecordingPi`)
with `strong-mock` where the interaction itself is the behavior under test.

## Unit test findings

### `tests/bridges/hooks/dispatch.test.ts`

- **[BLOCKER] Every case depends on the module-global routing-state singleton** —
  `resetRoutingState()` is called at the top of all 20 test cases and again in
  a `t.after()` in all of them (representative sites: `lines 231-234`,
  `455-458`, `620-625`, `699-702`, `863-865`, `1069-1071`, `1359-1362`; 62
  occurrences total in this file). This is not "fresh state constructed per
  case" — it is one process-wide `Map`/counter (`routing-state.ts`) that every
  case must scrub clean on both sides to avoid leaking into its neighbours.
  A wrong reset (or a case that forgets one) silently pollutes a sibling
  test, and the file cannot be run with per-case concurrency. Do not fix
  this by touching the test file alone: the production fix belongs in
  `routing-state.ts` (see Production code findings below) — once
  `dispatch.ts`'s `compositeHandlerFor`/`toolResultCompositeHandler` accept an
  injected state handle the same way they already accept an injected
  `HookExecutor`, each test constructs its own fresh handle inline and the
  `resetRoutingState()`/`t.after` boilerplate disappears entirely.

- **[WARNING] Hand-rolled call-recording doubles stand in for `HookExecutor`** —
  `recordExecutorCall` (`lines 129-158`), `createRecordingExecutor`
  (`lines 213-226`), and several inline `executor: HookExecutor = (entry, ...) => {...}`
  closures (e.g. `lines 332-345`, `541-549`, `725-732`) are plain functions
  that push into an array and return a canned result keyed by `pluginId`.
  The exact call sequence, arguments, and short-circuit point are the
  behavior under test (D-60-02 first-block-wins / mutate-compose / stop
  semantics), which per the testing guidelines is a **mock** role, not a
  stub-with-recording. Replace with `strong-mock`:
  `const executor = mock<HookExecutor>({ exactParams: true, name: "executor" })`,
  one `when(executor(expectedEntry, expectedEvent, context, undefined)).thenResolve(result)`
  per expected call (in the order they're expected — `strong-mock` does not
  enforce cross-call order itself, so where order is the promise, keep using
  a shared log the mocked calls push into, then `verify(executor)` at the
  end alongside the log comparison). This removes the informal
  `results[entry.pluginId]` lookup table and the `Promise.reject` "unexpected
  call" fallback, both of which are `strong-mock`'s job.

- **[WARNING] `compositeHandlerFor` coverage is split across four unrelated `describe()` names** —
  `describe("compositeHandlerFor", ...)` (`line 228`) holds one case, but
  three more `describe()` blocks — `"composite dispatch reduction"`
  (`line 643`), `"composite dispatch closure partitions"` (`line 859`), and
  `"composite per-event adapters"` (`line 1356`) — also exercise
  `compositeHandlerFor`/`toolResultCompositeHandler`, naming the scenario
  category instead of the exported entry point. Consolidate: one
  `describe("compositeHandlerFor", ...)` and one
  `describe("toolResultCompositeHandler", ...)`, per the "one describe per
  exported entrypoint" rule.

### `tests/bridges/hooks/dispatch-exec.test.ts`

- **[WARNING] The portability case spawns a real subprocess and reimplements timer observation instead of `t.mock.timers`** —
  `"executes a blocking hook through the portable process boundary"`
  (`lines 37-328`) is the only case in this file that does not inject
  `spawnImpl`: it spawns a real `node -e ...` child (`lines 150-181`,
  `265`) and hand-rolls `observedSetTimeout`/`observedClearTimeout`
  (`lines 90-123`) by wrapping the real global timer functions, rather than
  using `t.mock.timers.enable({ apis: ["setTimeout", "clearTimeout"] })` the
  way every other timer-sensitive case in this same file does (`lines 1342`,
  `1557`, `1629`, `1681`, `1722`). The real-process exercise itself is
  arguably justified — it is the only way to prove EXEC-04's exec-form vs.
  shell-form choice actually stops shell-metacharacter interpretation
  (`literalArgument` at `line 125` contains `$(echo unsafe)` and is asserted
  to survive unevaluated) — but that rationale is not stated anywhere in the
  test, so a future reader may "fix" it into the fake-spawn pattern and
  silently lose the coverage. Add a comment stating why this one case uses a
  real child process, and replace the hand-rolled timer wrappers with the
  standard `t.mock.timers` API (the test never needs the real timers to
  fire — `ladder.cancel()` always wins the race — so faking them removes the
  bespoke instrumentation without weakening the assertions on
  `timerDelays`/`timerUnrefHandles`/`timerClearHandles`).

- **[WARNING] `observeSpawn`'s Proxy-based call recorder could be a `strong-mock` mock** —
  `observeSpawn` (`lines 473-505`) wraps `spawn` in a `Proxy` that records
  each call into `calls` and always returns the injected fake `ChildProcess`.
  Every case in the file asserts the captured `{command, args, options}`
  tuple via `deepStrictEqual`, so the interaction is already fully verified
  — this is not a weak test — but the tool is a hand-rolled recorder for a
  collaborator whose invocation is the exact contract under test (EXEC-04
  argument/env/shell construction). `strong-mock` can express the same
  check as `mock<typeof spawn>({ exactParams: true })` with
  `when(spawnMock(expectedCommand, expectedArgs, expectedOptions)).thenReturn(fakeChild)`
  plus `verify(spawnMock)`, keeping `makeInjectedChild`'s stateful fake
  `ChildProcess` unchanged as the return value. Given the current version's
  assertions are already exact, treat this as a tool-choice/consistency
  finding rather than a correctness one.

### `tests/bridges/hooks/event-router.test.ts`

- **[BLOCKER] File-level `beforeEach` resets a module-global singleton, and most cases reset it again** —
  `beforeEach(() => { resetRoutingState(); })` (`lines 87-89`) runs before
  every case in the file; the `ownRoutingState(t)` helper (`lines 731-738`)
  calls `resetRoutingState()` a second time and schedules
  `shutdownInMemoryChildren()` / `resetSettleState()` / `resetRoutingState()`
  again in `t.after`. This is the same root cause as the finding in
  `dispatch.test.ts`: production state that lives at module scope instead of
  being constructed per case. The BLOCKER in this file is sharper because
  the module-level `beforeEach` also forces `{ concurrency: false }` on the
  heaviest case (`line 93`) — an explicit acknowledgment that the shared
  state is not safe to run concurrently with siblings. Fix at the
  production layer (see `routing-state.ts` below); once state is
  factory-owned and injected, delete `beforeEach` and `ownRoutingState`.

- **[BLOCKER] The reload test is a ~500-line multi-module integration test smuggled into this pairing** —
  `"reload resets lifecycle state before hydrating routes, reaping orphans,
  and registering handlers"` (`lines 91-590`) does all of the following in
  one case:
  - spawns a real, long-running orphan child process with
    `spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], ...)`
    (`lines 378-384`) and awaits its real `exit` event after a real SIGKILL
    (`line 476`);
  - mutates the read-only `process.platform` global via
    `Object.defineProperty` (`lines 423-431`) to force the Linux orphan-probe
    branch;
  - directly drives `spawnAndRegister`/`shutdownInMemoryChildren` from
    `async-rewake/registry.ts`, `readPidTable`/`writePidTable`/`unlinkPidTable`/`pidTablePath`
    from `async-rewake/pid-table.ts`, and `agentEndCacheHandler`/`resetSettleState`/`settleHandlerFor`
    from `settle.ts` (imports at `lines 14-23`, `47-51`) — none of which is
    `event-router.ts`, so this test does not belong to the pairing it is
    filed under;
  - embeds live `assert.strictEqual`/`assert.deepStrictEqual` calls inside
    the hand-rolled `ChildProcess.kill()` fake body (`lines 319-336`),
    executed during the act phase, whose content is then re-asserted
    verbatim via the final `assert.deepStrictEqual(operationLog, [...])`
    (`lines 514-536`) — the embedded assertions are redundant with the
    ordered `operationLog` check and only make a failure harder to localize
    (it surfaces from inside a fake's method, not from the assert block).

  Split this into focused, hermetic cases: (a) an `event-router.ts`-only
  case asserting hydrate order, cache contents, and route contents after
  `registerHooksBridge`, using a fake `executor` and no real subprocess; (b)
  move the orphan-reap-on-reload assertions (real spawn, `process.platform`
  mutation, PID table) into `async-rewake/registry.test.ts` or a dedicated
  pid-table integration test, whichever already owns that pairing; (c) move
  the settle-state-reset-on-reload assertion into `settle.test.ts`. In
  whichever case keeps the `operationLog` ordering check, replace the
  embedded asserts in the `kill()` fake with plain
  `operationLog.push("child:shutdown")`-style markers and do all comparison
  once in `// assert`.

- **[WARNING] `makeRecordingPi()` is a hand-rolled `ExtensionAPI` recorder hidden behind an `as` cast** —
  `makeRecordingPi` (`lines 699-715`) returns `{ on(...), sendMessage(...) } as ExtensionAPI`
  (`line 713`) — a two-method object literal cast to the full `ExtensionAPI`
  interface, bypassing the type checker's structural check on an
  intentionally-incomplete double. The `pi.on(...)` call sequence and count
  are exactly the public behavior asserted in every `registerHooksBridge`
  case (e.g. `lines 1350-1365`, `1408`, `1550`). Once `event-router.ts`'s
  actual dependency on `ExtensionAPI` is narrowed to the port it really uses
  (see the matching production finding), this fake can implement that
  smaller interface directly with no cast, and can move to
  `mock<HooksBridgePi>({ exactParams: true })` + `verify()` for the call
  count/order check (accepting `It.isAny()` only for the opaque handler
  function argument, which cannot be compared structurally).

- **[WARNING] `beforeAgentStartHandlerFor` tests seed state through a sibling module instead of the direct setter** —
  `lines 899-963` call `event-adapters.ts::adaptObservationResultForEvent`
  to populate the pending-context buffer, when `routing-state.ts` already
  exports `appendPendingSessionStartContext` directly for this purpose.
  Seeding through the sibling module's business logic means a bug in
  `event-adapters.ts` can produce a spurious failure here. Call
  `appendPendingSessionStartContext` directly to keep this test's
  dependency surface limited to `event-router.ts` + `routing-state.ts`.

### Clean files

- None — all three reviewed test files (`dispatch.test.ts`,
  `dispatch-exec.test.ts`, `event-router.test.ts`) carry at least one
  finding above.

## Production code findings

### `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts`

- **[BLOCKER] `resetEpoch()` and `resetRoutingState()` are production exports that exist only to serve tests** —
  Both functions say so in their own doc comments (`line 189`: "the test
  reset seam is its only caller"; `line 313`: "Its only caller today is test
  setup"), and a repo-wide grep confirms zero non-test, non-self callers.
  `resetRoutingState()`'s docstring argues it is "a public lifecycle
  operation rather than a test hole" because it composes already-public
  mutators, but two of the four clears it composes
  (`clearParsedConfigCache`, `clearRoutingTable`, `lines 257-259`,
  `296-298`) are themselves module-private, so the only way to reach a full
  reset is through this admittedly test-only function. This is the textbook
  "no production reset function added to clean up after a test" violation,
  and it is the root cause of every `resetRoutingState()` call site flagged
  above in `dispatch.test.ts` and `event-router.test.ts` (62 and 5 call
  sites respectively) plus dozens more across the wider test suite (a
  repo-wide grep turns up 18 files calling `resetRoutingState()`).

  Fix: replace the four module-scope cells (`parsedConfigCache`,
  `routingTable`, `liveEpoch`, `pendingSessionStartContext`) with
  factory-owned state — e.g. `createRoutingState()` returning a
  `RoutingState` handle exposing the same read/write surface this file
  already names (`currentEpoch`, `bumpEpoch`, `getRoutingBucket`,
  `setRoutingBucket`, `parsedConfigEntries`, `setParsedConfig`,
  `deleteParsedConfig`, `pendingSessionStartContextEntries`,
  `appendPendingSessionStartContext`, `clearPendingSessionStartContext`).
  Thread that handle into `event-router.ts`, `dispatch.ts`, and
  `dispatch-exec.ts` as an explicit parameter, the same way this codebase
  already injects `HookExecutor` (`dispatch.ts`) and `SpawnDeps`
  (`dispatch-exec.ts`) instead of reaching into module globals — production
  call sites default to one process-lifetime instance constructed at
  extension-load time (in `index.ts` or `event-router.ts`'s factory), and
  each test constructs its own fresh instance inline. This removes
  `resetEpoch`/`resetRoutingState` entirely rather than tolerating them.

  This module's own header comment explains why the *state shape and pure
  logic* live in a leaf module (to break an `event-router.ts` /
  `dispatch.ts` / `dispatch-exec.ts` import cycle) — that reasoning is sound
  and independent of the singleton-lifetime question; a `createRoutingState()`
  factory can live in this same leaf file and keep the import graph
  unchanged. Because `settle.ts`, `async-rewake/registry.ts`, and
  `event-adapters.ts` (outside this review's assignment) also read this
  module's cells, treat this as a cross-cutting recommendation to coordinate
  with whoever reviews those files rather than a change scoped to this file
  alone.

### `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`

- **[WARNING] `homedir()` is called inline inside business logic instead of being injected** —
  `hydrateCacheFromDisk` (`line 446`), `readAndCachePluginHooks`
  (`line 179`), and `tryHydrateOnePlugin` (`line 573`) all call
  `os.homedir()` directly to build the `if`-field compile context and to
  choose the user-scope root. This is exactly the "hidden dependency"
  pattern the testability guidelines flag (inline read of a live
  environment boundary instead of an explicit parameter) — and it is
  directly evidenced by the test suite: the only way `event-router.test.ts`
  can control `~`-relative `if`-glob behavior or the user-scope root is by
  mutating the real `process.env.HOME` for the duration of a case (`lines
  99-117`). Thread `homedir` as an explicit parameter (or part of an
  options bag passed to `hydrateCacheFromDisk`/`registerHooksBridge`),
  defaulting to the real `os.homedir` in production — the same
  inject-with-a-real-default shape this codebase already uses for
  `dispatchHookExec`'s `spawnImpl` and `dispatch.ts`'s `executor`. This
  removes the need for tests to touch `process.env.HOME` at all.

- **[WARNING] `registerHooksBridge` takes the full `ExtensionAPI` but only ever calls `.on(...)`** —
  `registerHooksBridge(pi: ExtensionAPI, ...)` (`line 705`) and the eleven
  `pi.on(...)` registrations that follow (`lines 784-821`) are this
  function's entire direct use of `pi`; the rest is forwarded opaquely into
  `compositeHandlerFor`/`toolResultCompositeHandler`/`settleHandlerFor`/`beforeAgentStartHandlerFor`.
  Declaring a narrow, consumer-declared port (e.g. a `HooksBridgePi`
  interface exposing only `on` and whatever subset `sendMessage`-dependent
  downstream call sites actually need) instead of the full `ExtensionAPI`
  would make the function's true dependency explicit and let test doubles
  (see `makeRecordingPi` above) satisfy it structurally without an `as`
  cast.

### Clean files

- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` — the
  injected-`HookExecutor`-with-production-default pattern is a genuine
  strength (this is the shape the `routing-state.ts` fix above should
  follow); no style or testability findings beyond what is already
  documented in its own header comment.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` — same
  DI strength (`SpawnDeps` with `spawnImpl`/`dispatchId`); no findings.

## Not covered

- `tests/bridges/hooks/routing-state.test.ts` exists (19 `resetRoutingState()`
  call sites) but was not in this assignment's test-file list, so it was not
  reviewed here even though `routing-state.ts`'s production code was
  reviewed per the assignment's "paired production code" instruction. The
  BLOCKER finding above about `resetEpoch`/`resetRoutingState` applies
  regardless of which test file exercises them.
- `settle.ts`, `async-rewake/registry.ts`, and `async-rewake/pid-table.ts`
  are exercised directly by `event-router.test.ts`'s reload case but are
  outside this assignment's paired-production-code list; their own test
  files (if any) were not reviewed here.
- Did not run `node --test`, `npm run test:coverage:direct`, or `npm run
  check` per the diagnostic-review brief's instruction not to execute
  build/test commands during this sweep.
