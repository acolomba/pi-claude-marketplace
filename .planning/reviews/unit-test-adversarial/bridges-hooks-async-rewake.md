# Bridges — hooks async-rewake

**Scope:** `tests/bridges/hooks/async-rewake/{pid-table,registry,ring-buffer}.test.ts` and their
paired production modules
`extensions/pi-claude-marketplace/bridges/hooks/async-rewake/{pid-table,registry,ring-buffer}.ts`.
**Test files reviewed:** 3 (3,235 lines)
**Production modules reviewed:** 3

## Summary

Pairing is complete and the suite is, case by case, unusually disciplined: full-value
`deepStrictEqual` assertions throughout, real `mkdtemp` roots with `t.after()` cleanup, correct
`t.mock.timers.enable({ apis: [...] })` + `tick()` for the timer ladder, and — in the
concurrent-persistence tests (`registry.test.ts` lines 1639-1904) — a genuinely well-built
`createControlledPidTableWriter` harness that proves queue ordering without a single real sleep.
Dependency injection is also mostly exemplary: `SpawnDeps.dispatchId`/`pidTableWriter` and
`OrphanProbes` are textbook consumer-declared ports, and `DEFAULT_ORPHAN_PROBES` is the correct
place for the one unavoidable `process.kill`/`/proc` read. Three themes should lead the fixing
pass: (1) `registry.ts` keeps its per-child registry in a module-level `Map`, so all 34 test
cases in `registry.test.ts` call the production `shutdownInMemoryChildren()` before *and* after
every case (62 call sites) purely to avoid leaking live/stale entries into their neighbours —
the same hermeticity liability already flagged for `routing-state.ts` in
`unit-test-findings/bridges-hooks-dispatch.md`, and this file also calls that module's
`resetRoutingState()`/`bumpEpoch()`, so the two fixes should land together. (2) A 2-second
real-clock polling helper (`waitForPidTable`, `registry.test.ts` lines 400-417) is used in 15
tests to observe a fire-and-forget disk write, even though the file already has the right tool
(`SpawnDeps.pidTableWriter` injection) sitting unused two hundred lines away. (3) `registry.ts`'s
`ExtensionAPI`/`ExtensionContext` and `child_process.spawn` collaborators are hand-rolled
call-recorders (`createPi`, `createContext`, `createSpawn`) instead of the sibling
`dispatch-exec.test.ts`'s `strong-mock`/`t.mock.fn()` pattern for the exact same ports.

## Unit test findings

### `tests/bridges/hooks/async-rewake/pid-table.test.ts`

- **[BLOCKER] The "without aliasing" claim in the lifecycle test is never actually exercised** —
  `test('writes, reads, and unlinks one scoped PID table without aliasing the caller array', ...)`
  (lines 84-146). The mutation that is supposed to prove non-aliasing happens at lines 124-131
  (`entries.push({...})`), but it runs *after* `await observeCompletion(writePidTable(...))` has
  already resolved (line 122-123). By the time `writePidTable` returns, `atomicWriteJson` has
  already serialized and flushed the file to disk — a later push to the caller's array cannot
  retroactively change bytes already on disk regardless of whether `writePidTable` internally
  aliased or copied (`entries: [...entries]`, `pid-table.ts` line 151). Delete
  `entries: entries` from `pid-table.ts` (removing the defensive copy) and this exact test still
  passes. Fix: either drop the "without aliasing" claim from the title and the
  `entries.push(...)`/`expectedEntries` split (keep the round-trip assertions, which are sound),
  or make the mutation actually land inside the write's critical section — e.g. inject a
  `pidTableWriter` wrapper (the same seam `registry.test.ts`'s `createControlledPidTableWriter`
  already builds) that snapshots `entries` synchronously on entry and lets the test push to the
  original array from a callback fired at that exact point, then assert the snapshot excludes
  the pushed row.

- **[WARNING] `filesystemErrorCode` is duplicated verbatim across two sibling test files** —
  `pid-table.test.ts` lines 44-55 and `registry.test.ts` lines 419-430 define the identical
  helper. Extract it once into a small colocated module for this concern (e.g.
  `tests/bridges/hooks/async-rewake/fs-error-code.ts`), not `tests/helpers/`, and import it from
  both.

### `tests/bridges/hooks/async-rewake/registry.test.ts`

- **[BLOCKER] Every case that registers a child depends on the module-global registry singleton**
  — `resetRoutingState()`/`shutdownInMemoryChildren()` appear at the top of a case and again in
  its `finally`/cleanup in effectively every one of the 34 top-level tests; `shutdownInMemoryChildren()`
  alone is called 62 times. This is not "fresh state constructed per case" — `registry.ts`'s
  `asyncRewakeRegistry`/`pidTableOperations` are one process-wide `Map` pair that every case must
  scrub clean on both sides to avoid leaking a live/stale `ChildProcess` entry (with destroyed
  streams) into a neighbouring case. A single forgotten reset silently pollutes every test that
  runs after it, and the file cannot be given per-case concurrency. This mirrors the
  `routing-state.ts` finding already filed in `unit-test-findings/bridges-hooks-dispatch.md`
  (whose `resetRoutingState()`/`bumpEpoch()` this same file also calls, e.g. lines 440, 599,
  1616) — see the matching production finding below for the fix, and coordinate the two changes
  since they touch the same call sites.

- **[BLOCKER] `waitForPidTable` polls on the real clock instead of synchronizing on the injected
  write** — `registry.test.ts` lines 400-417 define a helper that loops up to 1,000 times over a
  real 2-second `process.hrtime.bigint()` deadline, `await`-ing a real `setImmediate` each
  iteration, to detect when a fire-and-forget `finalizeChild` → `persistPidTableForLoc` write has
  landed. It is used 15 times (lines 517, 1034, 1095, 1142, 1186, 1232, 1286, 1340, 1393, 1463,
  1522, 1577, 1621, 1950, 1953). This is real-clock polling, the exact anti-pattern the "Time"
  pattern section calls out ("awaiting a real timer, or polling is a finding") — it makes every
  one of these 15 cases slower than necessary and a source of CI flakiness under load, and
  `t.mock.timers` cannot help because the wait is on real filesystem I/O, not a timer. The file
  already has the correct tool: `SpawnDeps.pidTableWriter` (used by
  `createControlledPidTableWriter`, lines 300-367, in the two ordering tests at lines 1639-1904).
  Fix: inject a `pidTableWriter` wrapper around the real `writePidTable` that resolves a
  per-call signal promise, and `await` that promise directly instead of polling — the same
  seam already proven correct two hundred lines away in this very file.

- **[WARNING] `createPi()` and `createContext()`'s `ui.notify` are hand-rolled recorders for a
  public-behavior interaction that this codebase's own convention puts through `strong-mock`** —
  `createPi()` (lines 238-258) implements `ExtensionAPI.sendMessage` as
  `messages.push({ message, options })`, and `createContext()` (lines 179-236) implements
  `ExtensionContext.ui.notify` as `notifications.push({ text, severity })`; both are then
  asserted with `assert.deepStrictEqual(pi.messages, [...])` /
  `assert.deepStrictEqual(context.notifications, [...])` throughout the file (e.g. lines 561-575,
  658-659). Sending a message and notifying the user are exactly the "notifying / commands"
  interactions the testing rules require `strong-mock` for, and the sibling file in the very
  same directory tree, `tests/bridges/hooks/dispatch-exec.test.ts` (lines 1017, 1063, 1105,
  1141, 1166, 1217), already does this correctly for the identical `ExtensionAPI` port:
  `const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension api" }); ...
  verify(pi);`. Rebuild both fakes the same way: `mock<ExtensionAPI>({ exactParams: true, name:
  "pi" })` with `when(pi.sendMessage(exactMessage, exactOptions)).thenReturn(undefined)` per
  expected call (a mock with no expectations proves "never called" for the many cases that
  assert `[]` today), `verify(pi)` at the end; likewise `mock<Pick<ExtensionContext, "ui">>`'s
  `ui.notify`, or narrow `ExtensionContext` to the port `spawnAndRegister` actually needs first.

- **[WARNING] `createSpawn()` hand-rolls a call recorder instead of using the test context's
  `t.mock.fn()`** — `createSpawn` (lines 293-298) pushes into a plain `SpawnCall[]` array; the
  sibling `dispatch-exec.test.ts` gets the same recording for free via `t.mock.fn(spawnPort)`
  (its lines 502, 1111, 1172) and reads `spawnImpl.mock.calls`. Beyond the tool mismatch, at
  least one call site has already slid from spy to mock without the guardrail: line 642
  (`assert.strictEqual(spawnCalls.length, 1)`) is a call-count assertion on what is nominally a
  stub — "a stub with call-count assertions has been turned into a mock" is a named finding in
  the testing rules. Replace `createSpawn`'s hand-rolled array with `t.mock.fn(...)`, or fold the
  call-shape assertion into a `strong-mock` mock for `spawn` alongside the `ChildProcess` fake.

- **[WARNING] Several `reapOrphans` cases turn the `OrphanProbes` stub into an ordered-call mock
  without `t.mock.fn()` or `strong-mock`** — `deadOrphanProbes()` (lines 1002-1013) is a
  legitimate plain-object Stub (one canned throw, no call assertions). But
  `"kills a Linux orphan only after liveness and exact marker proof"` (lines 2182-2232),
  `"soft-skips Linux orphans with mismatched and absent markers"` (lines 2234-2287),
  `"skips dead and unprobeable orphan PIDs"` (lines 2381-2433), and
  `"contains an owned orphan kill failure and still unlinks the table"` (lines 2477-2523) each
  build a fresh probes literal that pushes into a local `calls` array and then asserts the full
  ordered sequence with `assert.deepStrictEqual(calls, [...])` — the exact "recorder pushing
  into a shared log" pattern the rules describe, minus the `strong-mock` mock object and the
  `verify()` call that pattern requires. Replace each `killProbe`/`environReader` with
  `t.mock.fn()` (or a shared-log `strong-mock` mock per the rules' ordering-across-collaborators
  guidance) so the recording comes from a sanctioned primitive.

### `tests/bridges/hooks/async-rewake/ring-buffer.test.ts`

Clean. AAA structure, naming, and assertions are all correct; the constructor/write/read branch
matrix (zero capacity, exact fill, overflow-by-one, gross overflow, multi-write wrap, latched
truncation, UTF-8 split-sequence tail) reads as a complete discrimination of `ring-buffer.ts`'s
logic with no weak assertions.

### Clean files

- `tests/bridges/hooks/async-rewake/ring-buffer.test.ts`

## Production code findings

### `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`

- **[BLOCKER] `asyncRewakeRegistry`/`pidTableOperations` are module-level mutable state that the
  entire test file must reset by hand** — lines 156-157. The file's own header (lines 148-154)
  explains that `spawn`/`dispatchId` were deliberately made explicit parameters (`SpawnDeps`)
  "rather than test-only module-global setters," but the registry `Map` itself stayed a module
  singleton, so `shutdownInMemoryChildren()` (line 523, itself a legitimate production API used
  by `event-router.ts`'s `/reload` handler — this is not a test-only hook) has to be called
  before and after every one of the 34 cases in `registry.test.ts` to keep tests from leaking
  live/stale entries into each other. Fix per the sanctioned pattern already used for
  `routing-state.ts`'s upcoming `createRoutingState()` factory (see
  `unit-test-findings/bridges-hooks-dispatch.md`): extract a `createAsyncRewakeRegistry()`
  factory closing over a private `Map` pair and returning `{ spawnAndRegister, reapOrphans,
  shutdownInMemoryChildren }`; production constructs one instance at extension-load time
  (`index.ts`/`event-router.ts`), and each test constructs its own fresh instance inline. This
  removes all 62 `shutdownInMemoryChildren()` call sites from the test file. Since this module
  also reads `routing-state.ts`'s `currentEpoch()` (line 237), coordinate the two refactors.

- **[WARNING] The child-exit outcome shape is repeated as an inline object type three times** —
  `{ readonly code: number | null; readonly signal: NodeJS.Signals | null }` appears verbatim at
  lines 333, 339, and 406. Extract a named `interface ChildExitOutcome { readonly code: number |
  null; readonly signal: NodeJS.Signals | null }` and use it at all three sites (object types are
  supposed to be declared with `interface`, and a value threaded through two function signatures
  is exactly the case that should not stay anonymous).

- **[WARNING] Three nested closures that don't need `this` are `const` arrows instead of nested
  function declarations** — `onSpawnError` (lines 270-274), `finalizeOnce` (lines 338-347), and
  `finalizeAfterOwnedStreams` (lines 349-353) are all `const name = (...) => {...}` inside
  `spawnAndRegister`, none of them binding an explicit function type or needing the outer `this`.
  Prefer nested function declarations per the style guide's "a named function is a function
  declaration" rule.

- **[WARNING] `spawnedAt: new Date().toISOString()` (line 319) is an inline clock read** — this
  is the named "hidden dependency" pattern (inline `new Date()`), though the impact here is low:
  every test that needs a deterministic `spawnedAt` already controls it correctly via
  `t.mock.timers.enable({ apis: ["Date", "setTimeout"], now })` (`observeTimers`, lines 369-398),
  which the file needs anyway for the timeout ladder. No action required unless a future change
  wants `spawnAndRegister` to take an injected clock for a reason unrelated to timers.

### `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts`

- **[WARNING] `readPidTable` validates the envelope but not each entry's shape** — lines 115-122
  check `parsed.version === ASYNC_REWAKE_PID_TABLE_VERSION` and `Array.isArray(parsed.entries)`,
  then return `(parsed as PidTableFile).entries` (line 121) with no per-entry field check. A file
  with a well-formed envelope but a malformed row (e.g. `{"pid":"not-a-number"}`) passes straight
  through as a typed `PidTableEntry[]`. Downstream `reapOrphans` happens to fail closed on a bad
  `pid` (its `try/catch` returns `false`/skip), so this is not currently a crash path, but the
  cast is unchecked and untested at the row level — no test in `pid-table.test.ts` exercises a
  well-formed envelope with a malformed inner entry. Either validate each entry's shape before
  returning (a `typebox` schema, consistent with `domain/components/*.ts`'s pattern) or add a
  comment on the cast explaining that the fail-closed downstream consumer is why row-level
  validation is intentionally skipped.

### `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts`

Clean. Pure, well-documented, no hidden dependencies, no module-level state beyond the two
exported constants.

### Clean files

- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts`

## Not covered

- No coverage tooling was run (`node --test --experimental-test-coverage`,
  `npm run test:coverage:direct`) per the diagnostic-review constraint against running build/test
  commands; the coverage claims above (e.g. ring-buffer's branch matrix) are from manually
  tracing production branches against test scenarios, not from an instrumented run.
- `routing-state.ts` is imported by `registry.test.ts` (`resetRoutingState`, `bumpEpoch`,
  `currentEpoch`) but is not one of this assignment's paired production files; its BLOCKER
  finding (test-only `resetEpoch`/`resetRoutingState` exports) is filed in
  `unit-test-findings/bridges-hooks-dispatch.md` and not repeated here.
- Did not independently verify `spawnAndRegister`/`finalizeChild`'s cyclomatic/cognitive
  complexity against the `fallow`/`sonarjs` gates (both functions are long); the review brief
  scopes toolchain-gated checks out, and this file is already shipped/committed rather than new
  code under review.
