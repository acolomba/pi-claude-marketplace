# Bridges — hooks exec, env, timers and wire protocol

**Scope:** `tests/bridges/hooks/{wire-protocol,exec-timer,spawn-helpers,timeout,hook-env,translation-context,index,exec-result}.test.ts` and their paired production modules under `extensions/pi-claude-marketplace/bridges/hooks/`.
**Test files reviewed:** 8
**Production modules reviewed:** 8

## Summary

This corner of the hooks bridge is the strongest-tested area encountered in this pass: `exec-timer.test.ts` drives the SIGTERM/SIGKILL ladder correctly with `t.mock.timers` and never touches real time or a faked `Date`; `wire-protocol.test.ts` asserts complete `HookExecResult` objects for every branch of the parser; `timeout.test.ts`, `translation-context.test.ts`, `exec-result.test.ts`, and `index.test.ts` are essentially clean. All 15 `.ts` files directly under `bridges/hooks/` have a paired test module in `tests/bridges/hooks/` — no pairing-gap BLOCKER to report. Two real defects stand out and should be the first fixes: (1) `spawn-helpers.test.ts`'s truncation-boundary tests never prove the algorithm used the available byte budget, so a drastically over-truncating implementation (e.g. always emitting an empty string) would pass six cases undetected; (2) `hook-env.test.ts` calls its own environment-restore helper *before* the assertion that is supposed to prove `prepareHookEnv` did not mutate the live `process.env`, making that assertion pass regardless of what the function actually does — across all three of its cases. That second defect traces to a real production design issue: `prepareHookEnv` reads `process.env` directly inside its body instead of taking it as a parameter, which is also why the test needs the env-mutation machinery in the first place.

## Unit test findings

### `tests/bridges/hooks/hook-env.test.ts`

- **[BLOCKER] Env-mutation assertion is tautological because the test restores `process.env` before checking it** — `test('applies every SessionStart environment precedence layer', ...)` lines 108–121; `test('omits event-specific keys while preserving a user-scope inherited key', ...)` lines 200–215; `test('restores exact process properties after containment failure', ...)` lines 274–306.
  In all three cases the sequence is: call `prepareHookEnv(...)` (line 108 / 200 / within the try at 274), immediately call the test's own `restoreEnvironment()` (line 109 / 201 / 281), and only *then* assert that `mutatedKeys.map(...)` equals `priorEnvironment` (lines 114–121 / 208–215 / 299–306). Because `restoreEnvironment()` unconditionally writes each key back to its pre-mutation value before the comparison runs, the comparison will pass even if `prepareHookEnv` mutated the live `process.env` in place — which is exactly the bug this assertion is meant to catch (the module's whole contract, per its own HENV-01/HENV-02 comment, is to build a *copy* via `{...process.env, ...}` and never touch the global). A `prepareHookEnv` that assigned `process.env.CLAUDE_PROJECT_DIR = transCtx.cwd` directly would still pass all three tests.
  Fix: capture the `mutatedKeys` snapshot for comparison *immediately* after the `await prepareHookEnv(...)` call (before calling `restoreEnvironment()`), compare that snapshot against `priorEnvironment` there, and only call `restoreEnvironment()` afterward (or drop the manual call entirely and let the already-registered `t.after(restoreEnvironment)` handle cleanup). This makes the assertion actually observe whatever `prepareHookEnv` did to the live environment before the test erases the evidence.

### `tests/bridges/hooks/spawn-helpers.test.ts`

- **[BLOCKER] Truncation tests never prove the output is (near-)maximal, so an overly aggressive truncator would pass** — `test('bounds and marks an object serialized one byte over the stdin cap', ...)` lines 231–247; `test('bounds substantially oversized multibyte text by UTF-8 bytes', ...)` lines 249–265; `test('overwrites a conflicting truncation marker without mutating the source', ...)` lines 267–290; `test('retains complete object fields before filling the remaining bounded space', ...)` lines 292–320; `test('bounds an oversized primitive under a marked payload envelope', ...)` lines 351–367; `test('bounds an oversized array prefix under a marked payload envelope', ...)` lines 369–389.
  Each of these six cases only checks: `Buffer.byteLength(serialized) <= stdinCapBytes`, `_truncated === true`, `decoded.<field>.length < original.length`, and `original.startsWith(decoded.<field>)`. None of them checks that the retained content is close to the cap. `serializeWithTruncation`'s whole job (per its own header comment, "retain as much top-level data as fits") is a binary search for the largest string that fits; a broken implementation that always truncates to, say, the empty string (or one character) satisfies every assertion in all six cases.
  Fix: after decoding, hand-build (do not call `serializeWithTruncation` again) a candidate one character longer than what was returned — e.g. for the object cases, `` `{"text":"${payload.text.slice(0, decoded.text.length + 1)}"}` `` (adjust the envelope shape per case: `{"payload":[...],"_truncated":true}` for the array case, `{"payload":"...","_truncated":true}` for the primitive case) — and assert `Buffer.byteLength(candidate, "utf8") > stdinCapBytes`. That proves the returned string is the true maximum the cap allows, not merely *a* value that happens to fit.

### `tests/bridges/hooks/timeout.test.ts`

- **[WARNING] Deterministic debug-log line asserted by four partial regexes instead of one exact string** — `test('defaults a declared zero timeout and reports the unusable value', ...)` lines 149–152, and the same pattern at lines 184–187, 219–222, 254–257, 289–292, 324–327 (six tests total).
  Each case knows every input to `resolveTimeoutSeconds` (the exact `raw`, `pluginId`, `event`, `lane`, and expected `fallback`), so the emitted line is fully computable in advance. Splitting the check into four separate `assert.match(..., /fragment/)` calls is weaker than one full-string comparison: it does not pin the connective text between fragments (word choice, punctuation, ordering), so a message that scrambled the connective wording around the four values would still pass.
  Fix: build the exact expected string from the test's own literals (e.g. `` `[hooks] resolveTimeoutSeconds: unusable timeout 0 on zero-plugin/PreToolUse (blocking); using the 600s default` `` for the first case) and replace the four `assert.match` calls with one `assert.strictEqual(diagnosticLines[0], expectedLine)`.

### `tests/bridges/hooks/translation-context.test.ts`

- **[WARNING] Hand-rolled poison-pill `ExtensionContext` double should be a `strong-mock` mock** — lines 80–118 and lines 142–180.
  Both runtime cases build a full `ExtensionContext` object literal by hand, wiring every unused getter/method to `throw new Error("buildTranslationContext must not call ...")`. The intent — proving `buildTranslationContext` reads only `sessionManager` and `cwd` and touches nothing else — is exactly the "mock with no expectations" pattern from the project's testing guidelines (a `strong-mock` mock throws on any unstubbed access by default). This is the sanctioned interaction-mock library for this project; the interaction being verified here ("this dependency's other members are never touched") is public behavior, which is the mock's role. The current object also duplicates ~40 nearly-identical lines across the two cases.
  Fix: replace `extensionContext` in both cases with `mock<ExtensionContext>({ exactParams: true, name: "extension context" })`, stub only `cwd` and `sessionManager` via `when(() => extensionContext.cwd).thenReturn(cwd)` / `when(() => extensionContext.sessionManager).thenReturn(sessionManager)`, and call `verify(extensionContext)` at the end of each case (proving no other member was touched, and centralizing the two near-duplicate builds into a small shared factory that takes `{ cwd, sessionManager }`).

### Clean files

- `tests/bridges/hooks/wire-protocol.test.ts` — every case asserts the complete `HookExecResult` object; `assert.deepEqual`/`assert.equal` used in the earlier cases are the strict variants because the file imports from `node:assert/strict` (verified: that module aliases the legacy names to their strict counterparts), so there is no weakening there. Env-var save/restore around the debug-log cases correctly registers `t.after()` before mutating.
- `tests/bridges/hooks/exec-timer.test.ts` — drives the SIGTERM→SIGKILL ladder exclusively with `t.mock.timers.enable({ apis: ["setTimeout"] })` + `tick()`; never fakes `Date` or waits in real time, matching the required pattern for scheduling behavior exactly.
- `tests/bridges/hooks/exec-result.test.ts` — type-only `satisfies`/`@ts-expect-error` coverage of the discriminated union plus one precise runtime case asserting `assertNever`'s thrown `Error` by class and structured fields.
- `tests/bridges/hooks/index.test.ts` — a correct same-binding barrel test: every re-export is compared with `assert.strictEqual()` against its defining-module binding, and the negative `@ts-expect-error` block proves the barrel's internal names stay unexported.

## Production code findings

### `extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts`

- **[WARNING] `prepareHookEnv` reads the global `process.env` inside its body instead of taking it as a parameter** — `line 62` (`...process.env,` inside the object literal built in `prepareHookEnv`).
  This is a hidden dependency on ambient global state, and it is the direct reason `hook-env.test.ts` has to mutate and restore `process.env` around every case (with the tautological-assertion risk documented above). Per the project's testability guidance, this should become an explicit collaborator: add a `baseEnv: NodeJS.ProcessEnv` parameter (the two dispatch-lane call sites would pass `process.env` explicitly), so `prepareHookEnv` itself never touches the ambient global and every test can pass a small literal object instead of mutating the real process environment.

### Clean files

- `extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/timeout.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/index.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts`

## Not covered

- Pairing enumeration was scoped to files directly under `bridges/hooks/` (per the assignment); the `async-rewake/`, `if-field/`, and `payloads/` subdirectories were not enumerated here (`bridges-hooks-payloads.md` already exists as a separate assignment covering at least the `payloads/` subtree).
- No toolchain commands (`npm run check`, `node --test`, coverage) were run, per the diagnostic-review constraint; all findings are from static reading only.
