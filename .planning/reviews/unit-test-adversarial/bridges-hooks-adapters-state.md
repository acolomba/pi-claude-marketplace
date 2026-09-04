# Bridges — hooks event adapters, settle, stage, routing state

**Scope:** `tests/bridges/hooks/{event-adapters,settle,stage,routing-state}.test.ts` paired
with `extensions/pi-claude-marketplace/bridges/hooks/{event-adapters,settle,stage,routing-state}.ts`
**Test files reviewed:** 4
**Production modules reviewed:** 4

## Summary

All four pairs are in good shape: assertions are whole-value (`deepStrictEqual` on complete
objects, not property-by-property probes), errors are checked by `instanceof` plus structured
fields where a typed error class exists, doubles are context-scoped (`t.mock.method`, no
process-wide `mock`, no `t.mock.module()`), and every test file resets the shared module state
it touches both before and after each case. `stage.test.ts` does real filesystem work with one
`mkdtemp` per case and a `finally`-block cleanup, and its byte-exact JSON assertions are
hand-typed literals rather than values computed by re-running `JSON.stringify` — no tautological
checks. `settle.test.ts` has no timers, sleeps, or polling to worry about; the `agent_settled`
path is driven entirely by directly-resolved promises. The one real design tension is
`routing-state.ts`'s process-lifetime singleton: its own doc comment defends `resetRoutingState`
as "a public lifecycle operation," but the actual call graph shows `registerHooksBridge` never
calls it — production only performs incremental per-key updates plus three separately-public
targeted resets. `resetRoutingState` (and `resetEpoch`, reachable only through it or through
tests) is a reset hook that exists for tests, contradicting its own justification; this is called
out below with a concrete, scoped recommendation rather than a blanket "remove all state" verdict.
A second, more actionable design finding: `settle.ts`'s four module-level cells could be turned
into factory-owned state today, without touching any of the cross-module sharing that makes
`routing-state.ts` harder to fix. Everything else is polish-level: some duplicated
debug-env-var boilerplate, an unused stub field, a couple of tests that could split into more
targeted cases, and a few unlabeled `catch (err)` blocks.

## Unit test findings

### `tests/bridges/hooks/event-adapters.test.ts`

- **[WARNING] Duplicated debug-env-var-and-console-spy boilerplate** — `lines 253–266`,
  `667–680`, `849–862`, `1077–1094`. The same 12-line block (save `process.env.PI_CLAUDE_MARKETPLACE_DEBUG`,
  register `t.after` restoration, set the var, spy on `console.error`) is retyped four times
  across the file's four "reports a stopped/blocked …" test groups. Extract one local helper in
  this file, e.g. `function withDebugLogging(t: TestContext) { ...; return consoleErrorSpy; }`,
  and call it from each of the four sites. Keep it in this file (not a shared `tests/helpers/`
  module) since it is specific to this file's diagnostic-logging assertions.
- **[WARNING] Redundant assertion after a full-shape `deepStrictEqual`** — `line 544`
  (`drops a ${name} updated output`). `assert.strictEqual(Object.hasOwn(event, "0"), false)`
  adds nothing: the `assert.deepStrictEqual(event, {...})` immediately above it already pins the
  exact key set, so no implementation could pass the `deepStrictEqual` while also adding a `"0"`
  key. Delete the redundant line, or if the intent is to specifically document defence against an
  array-spread bug, fold it into a one-line comment instead of a second assertion.

### `tests/bridges/hooks/settle.test.ts`

- **[WARNING] Dead `isIdle` stub field** — `line 67` (`makePi`). `isIdle: (): boolean => true` is
  never read by anything reachable from these tests (`settle.ts` never calls `pi.isIdle()`, and
  the custom `executor` passed to every case bypasses `dispatchHookExec`, the only place that
  might). This codebase already has an established idiom for exactly this situation —
  `tests/bridges/hooks/dispatch.test.ts:101`, `dispatch-exec.test.ts:196,556`, and
  `translation-context.test.ts:93,155` all define `isIdle(): never { throw new Error("... must
  not call isIdle"); }` to prove a boundary method is genuinely never invoked. Either delete the
  field (nothing here needs it) or convert it to the same throw-if-called guard so it does
  something.
- **[WARNING] One test case covers three distinct behaviors** — `lines 156–204`
  (`"cache miss, one-shot hit, and stale epoch are visible at public boundaries"`). The case
  walks: a settle call with no prior `agent_end` (cache-miss no-op), a settle call consuming a
  cached ending exactly once, a second immediate settle call finding the cache already drained,
  and finally a stale-epoch `agentEndCacheHandler`/`settleHandlerFor` pair. Each of these is a
  separately-nameable behavior and a failure in the first scenario can obscure whether the later
  ones still hold. Split into three cases: `"settle no-ops when no agent_end was cached"`,
  `"settle consumes the cached ending exactly once"`, and `"settle and agent_end both no-op on a
  stale epoch"`.
- **[WARNING] No `describe()` grouping despite four exported entry points** — file-level. The
  module exports `agentEndCacheHandler`, `inputResetHandlerFor`, `resetSettleState`, and
  `settleHandlerFor`; `event-adapters.test.ts` in this same directory groups its cases with one
  `describe()` per exported function. Consider the same grouping here for consistency (optional —
  titles are already descriptive enough that this is not blocking).

### `tests/bridges/hooks/stage.test.ts`

- **[WARNING] Error assertions match on message text because the production error has no
  dedicated class** — `lines 719–729`, `745–755` (`"rejects an unsafe plugin name before
  writing/removal"`). Both tests do `assert.ok(error instanceof Error)` then compare
  `{ name: "Error", message: '...must not contain path separators.' }` — a full-string match,
  not a substring, but still text-based rather than `instanceof`+structured-field. This is driven
  by `domain/name.ts`'s `assertSafeName` throwing a bare `Error` with no subclass (out of scope
  for this review's paired modules) — contrast with the same file's symlink-escape tests, which
  correctly assert `instanceof SymlinkRefusedError` plus its typed `.parent`/`.child`/`.linkPath`/
  `.linkTarget` fields. If `assertSafeName` ever gains a dedicated error class, update these two
  tests to assert on it instead of the message.

### Clean files

- `tests/bridges/hooks/routing-state.test.ts` — every exported function has a dedicated,
  behavior-discriminating case; every case resets exactly the state cell(s) it touches both
  before (arrange) and after (`t.after`); no placeholder names, no weak assertions, no
  cross-module test creep. See the Summary and the `routing-state.ts` production finding below
  for the one real issue in this pair, which lives in the production module, not the test.

## Production code findings

### `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts`

- **[BLOCKER] `resetRoutingState` / `resetEpoch` are test-only resets whose own doc comment
  misstates their production status** — `lines 182–194` (`resetEpoch`), `257–259`
  (`clearParsedConfigCache`), `296–298` (`clearRoutingTable`), `309–325` (`resetRoutingState`).
  The comment on `resetRoutingState` (lines 310–319) argues it is "a public lifecycle operation
  rather than a test hole" because "the four clears it composes are each already public." That
  premise does not hold for all four: `clearParsedConfigCache` and `clearRoutingTable` are
  module-private (`function`, not exported) and have exactly one caller — `resetRoutingState`
  itself. And `resetRoutingState` itself has **no production caller**: `registerHooksBridge`
  (`event-router.ts`, the actual `/reload`-hygiene entry point) never calls it — it instead
  performs incremental per-plugin `setParsedConfig`/`deleteParsedConfig`/`setRoutingBucket` calls
  plus three independently-legitimate targeted resets (`bumpEpoch`, `clearPendingSessionStartContext`,
  and `settle.ts`'s `resetSettleState`). `resetEpoch` is reachable only through `resetRoutingState`
  or directly from tests — it, too, has no production caller. Per the project's own rule ("no
  production reset function added to clean up after a test"), this is a reset hook that exists to
  serve tests, and the module's comment defending it is inaccurate to the real call graph.
  **What to do:** at minimum, correct the doc comment on `resetRoutingState` (lines 310–319) to
  state plainly that it is test-only tooling, not a production lifecycle operation — do not leave
  a comment that argues the opposite of what the code does. As the deeper fix: the "factory-owned
  state" option from the four sanctioned fixes is architecturally available here — `dispatch.ts`,
  `event-adapters.ts`, `settle.ts`, and `async-rewake/registry.ts` could take a `RoutingState`
  object as an explicit parameter (mirroring the `capturedEpoch` parameter already threaded
  through `settle.ts`'s handler factories) instead of importing these module-level accessors
  directly, letting each test construct a fresh instance instead of sharing and resetting a
  singleton. That refactor spans five-plus production files and six-plus test files and is well
  outside a test-hygiene pass — it should be scoped as its own follow-up, not attempted inline
  here. The module's role (breaking the `event-router.ts`/`dispatch.ts`/`async-rewake/registry.ts`
  import cycle documented at the top of the file) genuinely requires *some* form of shared,
  leaf-ward state; what it does not require is a whole-state test-only reset function pretending
  to be a production operation.

  Given the constraint as it stands today, the tests themselves ARE hermetic and
  order-independent in practice: `node --test` runs each matched test *file* in its own process
  (confirmed via `package.json`'s `test` script, which globs whole files), so the module
  singleton never leaks across files; within a file, every case in all four test files reviewed
  here resets the specific cell(s) it uses at both arrange-time and via `t.after()`, and no case
  relies on a `before()`/shared fixture or the previous case's cleanup alone. That discipline is
  the right mitigation for the current architecture — the finding above is about the reset
  function's inaccurate self-justification and the unexercised production-lifecycle claim, not
  about the tests failing to cope with the design.

### `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`

- **[WARNING] Module-level mutable state is a good candidate for factory-owned state, and unlike
  `routing-state.ts` this one has no cross-module sharing constraint** — `lines 56–73`
  (`cachedLastAssistant`, `stopHookActive`, `consecutiveBlockCount`, `capNotifiedThisSession`) and
  `resetSettleState` at `line 80`. These four cells are read and written only by this module's own
  exported closures (`agentEndCacheHandler`, `settleHandlerFor`, `inputResetHandlerFor`), which
  already take `capturedEpoch` as an explicit factory parameter. Bundle the four cells into one
  object (e.g. `interface SettleState { cachedLastAssistant, stopHookActive,
  consecutiveBlockCount, capNotifiedThisSession }`) constructed once per `registerHooksBridge`
  call (or by a new exported `createSettleState()`) and close over it in the three handler
  factories, the same way `capturedEpoch` is already closed over. This removes the need for
  `resetSettleState`'s reset-and-hope pattern — each test could construct its own `SettleState`
  instead of sharing and resetting the module singleton — without any of the cross-module
  cycle-breaking constraints that make the equivalent change harder in `routing-state.ts`.
  `resetSettleState` remains legitimately dual-purpose today (it does have a real production
  caller, `registerHooksBridge`, for `/reload` hygiene), so this is a design-improvement
  opportunity rather than a defect.
- **[WARNING] `catch (err)` without the project's `catch (error: unknown)` convention** —
  `line 430` (`reenter`). CONVENTIONS.md documents `catch (error: unknown)` as house style. Not a
  functional issue (TypeScript already infers `unknown` here), but rename for consistency with
  the rest of the codebase.

### `extensions/pi-claude-marketplace/bridges/hooks/stage.ts`

- **[WARNING] No injected filesystem port; symlink-escape and I/O-error tests must monkey-patch
  `node:fs/promises`** — `line 15` (the `lstat, readdir, readlink, realpath, rm` import) and the
  functions that use them: `assertNoSymlinkEscapeInHooksSubtree` (`line 67`),
  `readEntriesOrSkip` (`line 109`), `assertSymlinkEntryContained` (`line 135`),
  `readSymlinkTargetSafe` (`line 163`). Four separate tests in `stage.test.ts` (`lines 342–349`,
  `418–437`, `494–500`, `543–550`) reach for `t.mock.method(fs.promises, "<fn>", ...)` plus
  `syncBuiltinESMExports()` to inject I/O errors (`EACCES`, `EIO`) and a TOCTOU race that are
  otherwise impractical to construct portably on a real filesystem. This is the accepted
  "replace a global for adapter-boundary testing" pattern (the same shape as the `fetch`
  replacement idiom), so it is not wrong, but it is a signal of a hidden dependency: none of
  these four filesystem calls are parameterized. Consider injecting a narrow port —
  `{ readdir, lstat, realpath, readlink }` — as an optional parameter to
  `assertNoSymlinkEscapeInHooksSubtree` (and its two helpers) defaulting to the real
  `node:fs/promises` functions. That would let the four tests above pass a plain stub object
  instead of patching and restoring global builtins, and would remove the `syncBuiltinESMExports()`
  calls entirely.
- **[WARNING] Obscure stack-pop idiom** — `lines 72–73` in `assertNoSymlinkEscapeInHooksSubtree`:
  `const dir = stack.slice(-1).join(""); stack.pop();`. This is a roundabout way to read-then-remove
  the last stack element, apparently to dodge `noUncheckedIndexedAccess` typing `Array.prototype.pop()`
  as `T | undefined`. `const dir = stack.pop()!;` (justified by the immediately-preceding
  `while (stack.length > 0)` check, with a one-line comment saying so) is simpler and does not
  require a reader to work out why `slice`+`join` is being used to read one array element.
- **[WARNING] Bare/unlabeled catches** — `line 112` (`readEntriesOrSkip`, `catch (err)`),
  `line 143` (`assertSymlinkEntryContained`, `catch (err)`), `line 166`
  (`readSymlinkTargetSafe`, `catch { return "<unreadable>"; }`). The first two should read
  `catch (error: unknown)` per house style. The third has no explicit annotation to fix (it takes
  no binding at all) but silently converts any `readlink` failure into the `"<unreadable>"`
  sentinel with no comment identifying which failures are expected here or why swallowing all of
  them is safe; add a one-line comment (the function name already signals intent, but the
  typescript-google-style-review rule wants the reason stated inline for a catch that discards
  its error).

### `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`

- **[WARNING] Repeated readonly-bypass cast could be one named helper** — `lines 133` and `137`
  in `applyToolResultPatch`: `(event as { content: unknown }).content = ...` and
  `(event as { isError: boolean }).isError = ...`. Both exist to write through `ToolResultEvent`'s
  presumably-`readonly` fields, and the surrounding doc comments already explain why this
  in-place mutation is intentional (CR-01). Consider one small local helper, e.g.
  `asWritable<T>(value: T): { -readonly [K in keyof T]: T[K] }`, to express the readonly-bypass
  once instead of twice with two different inline anonymous types. Not a correctness issue —
  purely a duplication/readability nit.

### Clean files

- `extensions/pi-claude-marketplace/bridges/hooks/settle.ts` — aside from the two items above,
  well-structured: exhaustive `switch` on `StopReason` with a compile-time-pinned `never` default,
  epoch re-checked after every `await` boundary, and the `reenter`/`reenterBounded` split keeps
  the loop-protection bookkeeping isolated from the `sendMessage` try/catch.

## Not covered

- No test/build/lint/coverage command was run for this review (per the diagnostic-review
  constraint); all coverage judgments above are from manual branch-by-branch reading, not
  `--experimental-test-coverage` output. For `stage.ts` specifically, one defensive branch in
  `assertSymlinkEntryContained` — the final `throw err;` for an error that is neither
  `SymlinkRefusedError` nor `PathContainmentError` — has no obvious corresponding test case in
  `stage.test.ts`; constructing one would require mocking `shared/path-safety.ts` internals,
  which is out of this review's scope.
- Collaborator modules referenced by the four files under review but owned by other reviewers'
  assignments were read only for context, not reviewed for their own findings:
  `bridges/hooks/exec-result.ts`, `bridges/hooks/dispatch.ts`, `bridges/hooks/if-field/index.ts`,
  `bridges/hooks/payloads/stop.ts` and `stop-failure.ts`, `domain/components/hook-events.ts` and
  `hooks.ts`, `domain/plugin-root.ts`, `domain/name.ts`, `shared/debug-log.ts`, `shared/notify.ts`,
  `shared/path-safety.ts`, `shared/atomic-json.ts`, and `persistence/locations.ts`.
- Did not verify whether `event-router.test.ts`, `dispatch.test.ts`, or `async-rewake/registry.test.ts`
  (which also import `resetRoutingState` heavily) show the same hermeticity discipline seen in the
  four files reviewed here — they are out of this assignment's scope, but since they share the
  same singleton, a follow-up on `routing-state.ts`'s design should account for all of its
  consumers, not only the four reviewed here.
