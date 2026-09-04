# Bridges — hooks exec, env, timers and wire protocol — adversarial re-review

**Scope:** `tests/bridges/hooks/{wire-protocol,exec-timer,spawn-helpers,timeout,hook-env,translation-context,index,exec-result}.test.ts` and the eight paired modules under `extensions/pi-claude-marketplace/bridges/hooks/`. Read in full; every clean-list entry mutation-tested.
**First-pass file:** `unit-test-findings/bridges-hooks-exec-protocol.md`
**Clean files attacked:** 11 (4 test modules, 7 production modules)
**Existing findings graded:** 5

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 7 |
| New WARNING (missed by first pass) | 11 |
| Existing CONFIRMED | 3 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's picture of this area does not hold. Three of the four test files
it declared clean carry BLOCKER-class surviving mutations, and the one production
module it left unflagged that matters most (`spawn-helpers.ts`) carries a doc
comment prescribing a discriminator the code does not implement — a mutation that
implements the comment literally passes all six `planSpawn` cases.

## New findings — from the clean lists

### `tests/bridges/hooks/spawn-helpers.test.ts`

*(This file was not on the clean list — the first pass logged one BLOCKER on it —
but the three findings below are new and share one root cause with it: every
truncating case calls `JSON.parse(serialized)` before asserting, so the bytes the
child actually receives on stdin are never compared. `spawn-helpers.ts:66` returns
**the stdin bytes**; the skill's rule "when bytes are the contract … the complete
bytes are compared, with no decoding" applies directly.)*

- **[BLOCKER] The WR-02 single-marker contract is unproven — a duplicate `_truncated` key survives** — `test('overwrites a conflicting truncation marker without mutating the source', ...)` lines 267–290
  Deleting `.filter(([key]) => key !== "_truncated")` at `spawn-helpers.ts:126` leaves every assertion in this case green. **Verified by execution**, not by reading: with the filter removed the function emits
  `{"text":"mmm…","_truncated":false,"_truncated":true}` — a duplicate key — and because JSON's last-key-wins rule applies, `JSON.parse(serialized)._truncated` is still `true`, `bytes <= cap` still holds, `decoded.text.length < payload.text.length` still holds, and `payload.text.startsWith(decoded.text)` still holds. The case's title names WR-02; its assertions prove only what `JSON.parse` would have given anyway.
  Fix: assert on the serialized string, not the decode. Add
  `assert.strictEqual(serialized.split('"_truncated"').length - 1, 1)` and
  `assert.ok(serialized.endsWith('","_truncated":true}'))` to this case.

- **[BLOCKER] Emitted key order is never compared, so a field-order mutation survives all eight truncating cases** — lines 231–247, 249–265, 267–290, 292–320, 351–367, 369–389, 391–406
  Reversing the `entries` array built at `spawn-helpers.ts:125–130` reverses the emitted key order; every truncating case decodes with `JSON.parse` first and `assert.deepStrictEqual` on the decoded object ignores key order, so all eight stay green. Key order is load-bearing twice over here: it is the byte order of the child's stdin, and `serializeBoundedObject` walks `entries` in that order both when selecting whole fields that fit and when picking *which* oversized string field to bound.
  Fix: in at least the two multi-field cases (292–320 and 369–389), replace the `JSON.parse` + per-field checks with one `assert.strictEqual(serialized, expectedSerialized)` against a hand-built literal (build the retained prefix from `payload.message.slice(0, N)` where `N` is derived from the cap arithmetic, not from the returned value). The two non-truncating cases at lines 193–210 and 212–229 already do exactly this and are the in-file template.

- **[BLOCKER] No case pins the exec-form/shell-form discriminator against a non-array `args` or a non-string `shell`** — `describe('planSpawn')` lines 12–190
  `HookHandlerEntry.args` and `.shell` are declared `unknown` (`domain/components/hooks/schema.ts:11–12`) and the TypeBox schema admits any JSON value, so `"args": "--flag"` and `"shell": false` are reachable from a real `hooks.json`. Mutating `spawn-helpers.ts:38` from `Array.isArray(argsField)` to `argsField !== undefined` — which is *literally what the function's own doc comment at line 29 prescribes* — leaves all six cases green and hands a bare string to `spawn`'s `args` parameter. Mutating line 46 from `typeof shellField === "string" ? shellField : true` to `(shellField ?? true)` — again what the comment prescribes — also leaves all six green while changing `"shell": false` from shell-form to exec-form.
  Fix: add two sibling cases to the `planSpawn` describe — one entry with `handlerDecl: { type: "command", command: "run", args: "--flag" }` asserting `{ command: "run", args: [], shell: true }`, one with `handlerDecl: { type: "command", command: "run", shell: false }` asserting `{ command: "run", args: [], shell: true }`. Then fix the two doc comments (see the production findings below).

- **[WARNING] No case for a second oversized string field** — `test('retains complete object fields before filling the remaining bounded space', ...)` lines 292–320
  `serializeBoundedObject` returns on the **first** oversized string field it can bound (`spawn-helpers.ts:164–166`); every later oversized string field is silently dropped. Only one such field exists in any case, so removing the early `return` (or changing which field is chosen) survives.
  Fix: add a case with `{ first: "a".repeat(cap * 2), second: "b".repeat(cap * 2) }` asserting the exact serialized string — `first` bounded, `second` absent, marker last.

### `tests/bridges/hooks/exec-timer.test.ts` *(clean-listed by the first pass)*

- **[BLOCKER] Three of the five `hookDebugLog` lines this module emits have zero coverage, including the one the source calls a hazard fingerprint** — no `test('…')` covers them; grep-verified: `nothing to signal`, `unusable ladder timeout`, and `clamping` appear nowhere under `tests/`
  Deleting the `hookDebugLog` call at `exec-timer.ts:149–152` leaves all 16 cases green. That line's own comment says *"That is HKDR-01, and this line is its fingerprint"* — it is the sole runtime signal that a hook's budget elapsed against an already-exited child, which is how a grandchild holding the stdout pipe is diagnosed. The same is true of the two `normalizeSeconds` degrade lines at `exec-timer.ts:98–102` and `106–109`: the four `fails open at the ceiling` rows and the `above-maximum timeout` row exercise the *value* they return but never the diagnostic they emit.
  Fix: extend `test('reports the label and elapsed budget for each escalation')` into four sibling cases — one per emitted line — each enabling `PI_CLAUDE_MARKETPLACE_DEBUG`, capturing `console.error`, and asserting the whole line with `assert.deepStrictEqual(lines, [expected])`. For the HKDR-01 case: install the ladder, set `child.exitCode = 0`, `tick(1_000)`, and expect exactly `"[hooks] exec-timer: budget of 1s elapsed after the child had exited (acme/PreToolUse); nothing to signal"`.

- **[BLOCKER] `hasExited`'s documented "absent fields read as still alive" behavior is never exercised** — `makeSpyChild` lines 99–116
  Every case constructs a child with `exitCode: null, signalCode: null`, so both `??` operands at `exec-timer.ts:70` produce identical results. Mutating that line to `child.exitCode !== null || child.signalCode !== null` — dropping the nullish coalescing — makes a structural caller that supplies neither field read as *exited*, suppressing both signals entirely; all 16 cases stay green. The docstring at `exec-timer.ts:66–68` states this exact contract ("Absent fields read as 'still alive' so a structural caller that supplies neither still gets both legs"), and `ChildLike` declares both fields optional, so it is reachable through the public interface.
  Fix: add one case building `const child: ChildLike = { killCalls: [], kill(signal) { … } }` with **neither** `exitCode` nor `signalCode` set, and assert `["SIGTERM", "SIGKILL"]` after ticking past both deadlines.

- **[WARNING] The two escalation diagnostics are matched by partial regex, and the line count stands in for the lines** — `test('reports the label and elapsed budget for each escalation')` lines 437–439
  `assert.equal(lines.length, 2)` plus two `assert.match(…, /SIGTERM after 2s \(acme\/SessionEnd\)/)` pin neither the `[hooks]` destination, nor the `exec-timer:` category, nor the SIGKILL line's `; the child ignored SIGTERM` tail. Changing the tag to `"env"` or dropping the tail survives. Both lines are fully computable from the case's own literals.
  Fix: `assert.deepStrictEqual(lines, ["[hooks] exec-timer: SIGTERM after 2s (acme/SessionEnd)", "[hooks] exec-timer: SIGKILL after 7s (acme/SessionEnd); the child ignored SIGTERM"])`. This is the same defect the first pass raised against `timeout.test.ts`; propagate the fix, do not re-derive it.

### `tests/bridges/hooks/wire-protocol.test.ts` *(clean-listed by the first pass)*

- **[WARNING] Four debug-line assertions are `.includes()` fragments disguised as a whole-value `deepStrictEqual`** — lines 64–80, 113–131, 177–193, 239–257
  Each case builds `{ hookDestination: diagnostic.startsWith("[hooks] "), category: diagnostic.includes("non-zero exit (7)"), outcome: diagnostic.includes("defaulting to noop") }` and compares it to `{ …: true }`. The `deepStrictEqual` compares booleans, not the message — none of the connective text, punctuation, or fragment ordering is pinned. A line reading `[hooks] defaulting to noop — garbage — non-zero exit (7)` passes all four cases. Every input is a literal in the case, so the whole line is computable.
  Fix: replace each boolean bundle with `assert.deepStrictEqual(consoleErrorSpy.mock.calls.map((call) => call.arguments), [["[hooks] wire-protocol: non-zero exit (7); defaulting to noop"]])` (and the signal-kill / `JSON.parse failed (…)` / `parser unavailable` equivalents). That single assertion also subsumes the separate `callCount` and `argumentCount` fields.

- **[WARNING] No case supplies a top-level `decision` other than `"block"`** — `parseHookStdout` branch at `wire-protocol.ts:110`
  Mutating `obj.decision === "block"` to `typeof obj.decision === "string"` survives all 24 cases: no case ever sets `decision` to a non-`"block"` string. Since stdout is untrusted child output and the contract reference (`docs/research/claude-hook-config-syntax.md:170`) admits `"block"` only, a stray value must fall through to `noop`.
  Fix: add one case with `stdout = '{"decision":"allow","reason":"not a blocker"}'` asserting `{ kind: "noop" }`.

### `tests/bridges/hooks/index.test.ts` *(clean-listed by the first pass)*

- **[WARNING] The barrel's export surface is not pinned — adding an eighth re-export passes** — lines 27–72
  The 22 `@ts-expect-error` lines are a hand-maintained deny-list of internal names; they prove those names are absent, not that the surface is exactly the seven documented verbs. Re-exporting `dispatchHookExec` or `currentEpoch` from `bridges/hooks/index.ts` — which the barrel's own header at `index.ts:1–11` says must never happen (D-01 opaque-handle discipline) — adds no compile error and fails no case, because the deny-list is checked name by name.
  Fix: add a runtime namespace import (`import * as hooksBarrel from "…/bridges/hooks/index.ts"`) and one case asserting `assert.deepStrictEqual(Object.keys(hooksBarrel).sort(), ["hydrateProjectScopeForCwd", "readAndCachePluginHooks", "rebuildRoutingTables", "registerHooksBridge", "removeHookConfig", "removePluginConfigFromCache", "writeHookConfig"])`. The deny-list then becomes redundant belt-and-braces rather than the only gate.

### `tests/bridges/hooks/timeout.test.ts`

- **[BLOCKER] Six of the ten rows of `BLOCKING_EVENT_DEFAULT_SECONDS` have no case** — `timeout.ts:61–72`
  Only `UserPromptSubmit` (30), `SessionEnd` (1.5), `PostToolUse` (undefined) and `PreToolUse` (undefined) are exercised. Changing `SessionStart`, `PostToolUseFailure`, `PreCompact`, `PostCompact`, `Stop`, or `StopFailure` from `undefined` to any number survives the whole file — a `Stop` hook silently budgeted at 30 s instead of 600 s, with no test failing. This table is the module's entire content and it is a closed, total `Record<BucketAEvent, …>` deliberately written so that adding an event is a compile error; nothing makes changing an existing row a test failure.
  Fix: convert the six default cases into one typed data-driven loop — `for (const { event, expectedSeconds } of [{ event: "SessionStart", expectedSeconds: 600 }, … ] as const)` — with one sibling `test()` per row covering all ten events, in both lanes.

### `tests/bridges/hooks/hook-env.test.ts`

- **[BLOCKER] The `CLAUDE_ENV_FILE` containment check has no case** — `hook-env.ts:73–75`
  Deleting `await assertPathInside(loc.dataRoot, envFile, "CLAUDE_ENV_FILE")` leaves all three cases green. Only the `CLAUDE_PLUGIN_DATA` containment check is exercised (via `pluginId: "../escape"` at line 243), and that check throws before the SessionStart branch is ever reached. The `CLAUDE_ENV_FILE` path interpolates `transCtx.sessionId` verbatim into a filename, and a session id such as `../../../../etc/x` escapes `dataRoot` after `path.join` normalization — this is exactly the NFR-10 chokepoint the line exists for.
  Fix: add a fourth case with `claudeEvent: "SessionStart"`, a well-formed `pluginId`, and `sessionId: "../../../../etc/x"`, asserting a `PathContainmentError` whose `name`/`message`/`parent`/`child` match the `CLAUDE_ENV_FILE` label — mirroring the structured-field assertion already at lines 285–298.

### Production modules

#### `extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts` *(clean-listed)*

- **[WARNING] The EXEC-04 doc comment states a discriminator the code does not implement, and the same wrong text is duplicated in a sibling** — `lines 10–12`, `lines 29–30`, mirrored at `dispatch-exec.ts:19–23`
  The comment says the discriminator is `entry.handlerDecl.args !== undefined`; the code is `Array.isArray(argsField)` (line 38). The comment says shell-form uses `{ shell: entry.handlerDecl.shell ?? true }`; the code is `typeof shellField === "string" ? shellField : true` (line 46). The code matches the contract reference (`docs/research/claude-hook-config-syntax.md:69` — `args` is "array of strings"; line 74 — `shell` is a string selector), so the **comments** are the defect, not the behavior. Both files must be fixed together or the wrong text survives in the other.
  Fix: restate both as present-tense facts — "an `args` field that is an array selects exec form; any other value (including a non-array) falls to shell form" and "a string `shell` selects the shell binary; every other value falls to `true`" — in `spawn-helpers.ts:29–30` and `dispatch-exec.ts:19–23`.
  Related, lower confidence: the contract reference's TOLERATE clause for `shell` says "Debug-log if non-`bash`"; `planSpawn` emits no `hookDebugLog` for a non-bash selector. Verify against the surviving requirement row before treating it as a gap.

- **[WARNING] `SpawnPlan` is exported but referenced nowhere outside its own module** — `line 21`
  Grep-verified: the only uses are the interface declaration and `planSpawn`'s return annotation on line 34. Same shape as `HookEnvContext` below. Either drop `export` (the return type is still structurally usable by callers) or keep it and let a consumer name it.

#### `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts` *(clean-listed)*

- **[WARNING] `buildTranslationContext` takes the whole `ExtensionContext` and reads exactly two fields** — `line 54`
  This is a member of META-FINDINGS' number-one leverage cluster ("narrow the over-wide context parameters") that its own list does not name. The cost is directly visible next door: `translation-context.test.ts` builds a 39-line poison-pill `ExtensionContext` literal **twice** (lines 80–118 and 142–180), wiring eleven unused members to throwing getters and methods purely to prove they are not touched.
  Fix: change the signature to `buildTranslationContext(ctx: Pick<ExtensionContext, "cwd" | "sessionManager">): TranslationContext`. Both test literals collapse to `{ cwd, sessionManager }`, the untouched-member proof becomes a compile-time guarantee, and the duplication disappears without a shared factory.

#### `extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts`

- **[WARNING] `HookEnvContext` is exported but used nowhere outside its own module — and not even by its test** — `line 21`
  Grep-verified: the only two references are the declaration and `prepareHookEnv`'s parameter annotation on line 54. `hook-env.test.ts` types its argument as `TranslationContext` instead (line 11), so the named parameter type is never pinned in any direction.
  Fix: either unexport it, or have `hook-env.test.ts` build its `transCtx` as `satisfies HookEnvContext` so the two-field contract is exercised.

#### `extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts` *(clean-listed)*

Attacked and no production finding beyond the test gaps above. The `.unref()` calls, the `hasExited`-not-`killed` guard, the `MAX_TIMEOUT_SECONDS` derivation, and the fail-open-to-ceiling stance are all correct and all documented accurately. Note for the record: this file's header correctly says `dispatch-exec.ts` cancels from `close` — it is `dispatch-exec.ts`'s **own** header that is wrong (see Meta-findings).

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `wire-protocol.ts` | `parseHookStdout` | `wire-protocol.test.ts:8` +23 more | owned |
| `exec-timer.ts` | `installTimerLadder` | `exec-timer.test.ts:150` +15 more | owned |
| `exec-timer.ts` | `ChildLike` | `exec-timer.test.ts:24` (`SpyChild extends ChildLike`) | incidental — used as a base type, never `satisfies`-checked, no `@ts-expect-error` negative, and the optional-field arm is never populated (see BLOCKER above) |
| `exec-timer.ts` | `TimerLadder` | — | NO CASE — inferred through destructuring; never named in the test. Used in production by `async-rewake/registry.ts:48` |
| `spawn-helpers.ts` | `planSpawn` | `spawn-helpers.test.ts:13` +5 | owned |
| `spawn-helpers.ts` | `serializeWithTruncation` | `spawn-helpers.test.ts:193` +10 | owned |
| `spawn-helpers.ts` | `SpawnPlan` | — | NO CASE — no `satisfies` check pins the `readonly` modifiers; no production consumer either |
| `timeout.ts` | `resolveTimeoutSeconds` | `timeout.test.ts:24` +10 | owned (4 of 10 default rows) |
| `hook-env.ts` | `prepareHookEnv` | `hook-env.test.ts:13,124,218` | owned |
| `hook-env.ts` | `HookEnvContext` | — | NO CASE — the test types the argument as `TranslationContext` instead |
| `translation-context.ts` | `buildTranslationContext` | `translation-context.test.ts:62,138` | owned |
| `translation-context.ts` | `TranslationContext` | `translation-context.test.ts:25–56` | owned — `satisfies` + three readonly and three type `@ts-expect-error` negatives |
| `index.ts` | 7 re-exports | `index.test.ts:74–163` | owned individually; the **surface** is not (see WARNING above) |
| `exec-result.ts` | `HookExecResult` | `exec-result.test.ts:8–37` | owned — 9 positive `satisfies`, 5 `@ts-expect-error` negatives |
| `exec-result.ts` | `assertNever` | `exec-result.test.ts:39` | owned — class, `name`, exact `message`, and `cause` all asserted |

## Branch census

**Reachable and untested (findings):**

- `hook-env.ts:74` — the `CLAUDE_ENV_FILE` `assertPathInside` throw arm. Reachable through an adversarial `sessionId`. BLOCKER above.
- `exec-timer.ts:70` — both `?? null` fallbacks in `hasExited`. Reachable through `ChildLike`'s optional fields, and the docstring names the behavior. BLOCKER above.
- `exec-timer.ts:149–152, 98–102, 106–109` — three `hookDebugLog` statements, never reached with `PI_CLAUDE_MARKETPLACE_DEBUG` set. BLOCKER above.
- `spawn-helpers.ts:38` false arm with a non-array, non-`undefined` `args`; `spawn-helpers.ts:46` false arm with a boolean `shell`. Both reachable from a real `hooks.json` because the schema types them `unknown`. BLOCKER above.
- `spawn-helpers.ts:113` — `bounded === undefined` in the **array** path, falling through to `break`. Reachable only when the already-accepted parts land within ~3 bytes of the 256 KB cap, so the empty-string candidate does not fit. Narrow but real; low priority. (The equivalent branch in the **object** path *is* covered, by `test('emits only the marker when an oversized object field cannot fit')` at line 336 — an oversized key.)

**Unreachable by real input (production dead-code candidates, not test gaps):**

- `spawn-helpers.ts:77` — the `parsed !== null` guard. `JSON.stringify(null)` is 4 bytes, so a `null` payload always returns at the early cap check on line 68 and can never reach line 77. The guard exists only because `typeof null === "object"`.
- `spawn-helpers.ts:173–178` — `serializeBoundedPrimitive`'s `emptyEnvelope` being *returned unchanged*. `{"payload":"","_truncated":true}` is 34 bytes, so the binary search always finds something larger. It is not removable: the three-argument `largestFittingString` overload's `string` (not `string | undefined`) return depends on it. Classify with D-116-01a.
- `exec-result.ts:59` — `assertNever` reached with a value `JSON.stringify` cannot serialize (BigInt, circular). Not worth a case.

**Fully covered (verified by walking each branch):** `wire-protocol.ts` (every decision point has both outcomes exercised — the `hso !== null && typeof hso === "object"` conjunction gets its false arms from `hookSpecificOutput: null` at line 513 and from an absent field at line 540); `timeout.ts` (all four conditions, both lanes, both `??` arms — the gap there is table *data*, not branches); `translation-context.ts` (both `?? ""` arms); `exec-timer.ts` apart from the `??` operands above.

## Grading of first-pass findings

### `tests/bridges/hooks/hook-env.test.ts`

- **CONFIRMED** — *Env-mutation assertion is tautological because the test restores `process.env` before checking it* — `restoreEnvironment()` writes every `mutatedKeys` entry back to its `priorEnvironment` value, and the assertion at lines 114–121 then re-reads those same keys and compares them to `priorEnvironment`; the comparison cannot fail for any implementation. The diagnosis, the three locations, and the reordering fix are all correct.
  Two additions the recorded version misses, worth carrying into the fix: (a) the snapshot only covers the ten listed keys, so a mutation to any *other* `process.env` key is invisible even after the reorder — compare `{ ...process.env }` wholesale instead; (b) `test('restores exact process properties after containment failure')` (line 218) has **no other purpose** than this vacuous half — its only surviving assertion is the `PathContainmentError` shape — so its title should become `leaves process properties untouched after a containment failure` once the assertion is made real.

### `tests/bridges/hooks/spawn-helpers.test.ts`

- **UNDERSTATED** — *Truncation tests never prove the output is (near-)maximal* — the surviving mutation is real (an always-empty-string truncator passes all six cited cases; `"".length < N` and `startsWith("")` both hold). But maximality is only **one of three** contracts the cases lose, and the recorded fix — hand-building a one-character-longer candidate and asserting it exceeds the cap — restores only that one. The root cause is `JSON.parse(serialized)` before asserting; it also hides the WR-02 single-marker contract (verified by execution) and the emitted key order, both filed as new BLOCKERs above. Sequence the fix as "compare the whole serialized string", and the maximality probe becomes one extra line on top rather than the whole remedy.

### `tests/bridges/hooks/timeout.test.ts`

- **CONFIRMED** — *Deterministic debug-log line asserted by four partial regexes instead of one exact string* — correct diagnosis, correct fix, correct severity. What the first pass missed is that the **same defect sits in two files it declared clean** in this very area: `wire-protocol.test.ts` (four cases, boolean-bundle form) and `exec-timer.test.ts` (one case, `assert.match` form). Fix all three under one rule.

### `tests/bridges/hooks/translation-context.test.ts`

- **OVERSTATED** — *Hand-rolled poison-pill `ExtensionContext` double should be a `strong-mock` mock* — the duplication is real, but `strong-mock` is not the better tool here. The current literal is `satisfies ExtensionContext`, so it is compile-checked against the real interface and breaks loudly when the SDK adds a member; a `mock<ExtensionContext>()` proxy is not. Reading `ctx.cwd` is a data read, not one of the interaction categories the skill reserves `strong-mock` for (charging, publishing, notifying, transaction control, callbacks, commands). Correct severity is WARNING for the duplication only — and the duplication is a *symptom*: narrowing the production parameter to `Pick<ExtensionContext, "cwd" | "sessionManager">` (production WARNING above) deletes both literals outright and makes the untouched-member proof a compile-time guarantee. Fix the parameter, not the double.

### `extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts`

- **CONFIRMED** — *`prepareHookEnv` reads the global `process.env` inside its body* — line 62, correctly identified as the reason the test carries ~90 lines of env save/mutate/restore machinery, and `baseEnv: NodeJS.ProcessEnv` is the right one of the four sanctioned fixes. One more consequence to record: `hook-env.test.ts` computes `expectedEnvironment` from a live `{ ...process.env }` snapshot taken 54 lines before the call, so anything that mutates the real environment in between would flake the case. The parameter fix removes that hazard too.

## Still clean after attack

- **`tests/bridges/hooks/exec-result.test.ts`** — survives every mutation I could construct. `assert.throws` with a predicate asserting `error.constructor === Error` (not merely `instanceof`), plus `name`/`message`/`cause` compared as one whole object, catches: throwing a subclass carrying the same message, dropping the `JSON.stringify(x)` interpolation, adding a `cause`, and changing the prefix. The type block covers all four arms positively and rejects a missing discriminant, an out-of-set `kind`, a cross-arm field (`suppressOutput` on `block`), and an out-of-set `permissionDecision`. The skill's "zero runtime cases is correct for a type-only module" is respected — the one runtime case exists because `assertNever` is real code.
- **`tests/bridges/hooks/exec-timer.test.ts`, timer mechanics** — genuinely strong where it is strong, and the first pass's praise is deserved on this axis. Mutations it *does* catch: removing either `.unref()` (`unrefHandles` is `deepStrictEqual`'d against `handles`, so order and count both matter); guarding on `child.killed` instead of exit state (the SIGKILL leg would be suppressed because the SIGTERM leg sets `killed` first — `test('sends each escalation signal exactly at its deadline')` fails); dropping `signalCode` from `hasExited` (the `exit signal` row fails); off-by-one on `MAX_TIMEOUT_SECONDS` in **either** direction (the paired `2_147_478` / `2_147_479` rows pin it exactly); swapping SIGTERM/SIGKILL; leaking a timer past `cancel()` (`clearHandles` must equal `handles` and `pendingHandles` must be empty); and non-idempotent `cancel()` (three calls, two `clearTimeout`s).
- **`tests/bridges/hooks/wire-protocol.test.ts`, parser branches** — the 24 cases assert complete `HookExecResult` objects, which catches: swapping `updatedInput`/`updatedToolOutput`; dropping `suppressOutput` from the noop arm; removing the `stderr.trim()`; reordering the exit-2 check after the stdout parse; loosening `obj.continue === false` to `!== true`; returning a `mutate` arm with no fields set; and coercing a wrong-typed optional instead of omitting it. `assert.deepEqual` here is not a weakening — `node:assert/strict` aliases it to `deepStrictEqual` (**verified by execution**, as the first pass claimed). The only holes are the debug-line fragments and the `decision`-not-`"block"` class, both filed above.
- **`tests/bridges/hooks/index.test.ts`, per-binding identity** — `assert.strictEqual` against the defining module's binding catches a re-export rewired to a wrapper, to a different function, or to a re-declared copy. Only the surface-exactness gap remains.
- **`extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts`, `wire-protocol.ts`, `timeout.ts`, `index.ts`** — no production finding. `wire-protocol.ts`'s never-throws contract holds on every path I traced (the non-`Error` `JSON.parse` failure is handled by the `err instanceof Error ? … : String(err)` fork, and the test plants exactly that). `timeout.ts`'s total-`Record` argument for compile-time safety is sound and its header accurately describes the two upstream deviations as HKTO-01.

## Not covered

- `bridges/hooks/{dispatch-exec,dispatch,event-router,event-adapters,settle,stage,routing-state}.ts` and the `async-rewake/`, `if-field/`, `payloads/` subtrees are other areas' assignments. I read `dispatch-exec.ts:14–53` and `290–426` only far enough to settle the exec-timer cancellation contract and the `planSpawn` doc duplication; findings that land there are flagged for their owners under Meta-findings, not filed here.
- Direct per-pair coverage was not measured — no toolchain command was run, per the brief. All branch-census claims are from reading plus two standalone `node` snippets that copied production logic into the scratchpad; nothing in the repo was executed or modified.
- I did not attempt to construct the tight-cap payload that reaches `spawn-helpers.ts:113`'s `bounded === undefined` arm; I classified it as reachable-in-principle by arithmetic, not by demonstration.

## Meta-findings impact

### New cross-cutting evidence

**1. "Decode before asserting" is a distinct defect class from fragment assertions, and META-FINDINGS does not name it.** Item 3 covers cases that assert *part* of a rendered string. This is the opposite failure: the case never sees the string at all, because it parses the production output back into an object first. In `spawn-helpers.test.ts` that one choice hides three unrelated contracts (maximality, the WR-02 single marker, key order), and I confirmed two of them survive by execution. The skill already has the rule — *"when bytes are the contract (file, packet, archive, encoded value), the complete bytes are compared, with no decoding or normalizing consumers do not perform"* — it simply was not applied. **Check every test that calls `JSON.parse`, `yaml`-parses, or otherwise decodes a value the module under test produced:** `bridges/mcp/{stage,unstage}` (`mcp.json` bytes), `bridges/agents/frontmatter.ts` and `bridges/skills/frontmatter-degrade.ts` (line-based YAML emission — decoding there also loses key order), `shared/atomic-json.ts`, `persistence/agents-index-io.ts`, and all of `bridges/hooks/payloads/` (the child's stdin bytes).

**2. The `spawn-helpers.ts:66` key-order lead is confirmed as a genuine contract, for a reason stronger than byte-identity.** `serializeWithTruncation` emits `JSON.stringify(payload)`, so payload insertion order *is* stdin byte order. More importantly, under truncation `serializeBoundedObject` walks `Object.entries` in that same order both when keeping whole fields that fit and when choosing which oversized string field to bound — and it bounds only the **first** one, dropping every later one. So reordering a payload translator's object literal changes *which fields a hook handler receives* on an oversized payload. `user-prompt-submit.test.ts` pinning the order is therefore load-bearing, and the payloads area should extend that pin to every translator rather than treat it as one file's quirk. `spawn-helpers.test.ts` itself pins order in neither direction (new BLOCKER above).

**3. Fragment assertions can hide inside `assert.deepStrictEqual`.** `wire-protocol.test.ts` and `async-rewake/pid-table.test.ts` build `{ label: text.includes(x), other: text.startsWith(y) }` and compare it to `{ label: true, other: true }`. Any census keyed on `assert.ok(` / `assert.match(` / a bare `.includes()` **misses this shape** — it looks like a whole-value comparison. Grep for `\.includes\(.*\)[,}]` inside an object literal, or for `deepStrictEqual` whose expected literal is all-boolean. Only two files use it repo-wide, but item 3's ~100+ count was derived by the pattern this shape evades, so the count is a floor.

**4. `hookDebugLog` output is a systematically untested surface.** In this area, 3 of 5 emitted lines have **zero** coverage and the other 2 are fragment-matched. One of the uncovered lines carries a source comment saying *"That is HKDR-01, and this line is its fingerprint"* — an observability contract with no test, in a module the first pass called clean. Worth a repo-wide pass: enumerate every `hookDebugLog(` call site and map it to a case. Likely also affected: `bridges/hooks/dispatch-exec.ts` (5 lines), `async-rewake/registry.ts`, `orchestrators/plugin-path.ts`, `platform/git.ts`.

**5. The debug-capture arrange block is copy-pasted 18 times across 11 test files** (13 of them in `tests/bridges/hooks/`: `wire-protocol` ×4, `timeout` ×8, `exec-timer` ×1, plus `dispatch-exec`, `event-adapters`, `async-rewake/{registry,pid-table}`). Each copy is ~13 lines of `Object.hasOwn` / save / `t.after` restore / `t.mock.method(console, "error", …)`. One `captureDebugLines(t): string[]` module beside the hooks tests (`tests/bridges/hooks/capture-debug-lines.ts`) removes ~230 lines **and** makes the missing exact-line assertions cheap enough that finding 4 gets fixed as a side effect. This is the same "cross-file duplicated helper" shape as the `backfill.test.ts` / `pending.test.ts` pair META-FINDINGS already names.

**6. A doc comment that lies, duplicated across two files.** `spawn-helpers.ts:29–30` and `dispatch-exec.ts:19–23` both state the EXEC-04 discriminator as `args !== undefined` / `shell ?? true`; the code implements `Array.isArray(args)` / `typeof shell === "string" ? shell : true`. Separately, `dispatch-exec.ts:24–27` claims `child.once("exit", ladder.cancel)` while the code (line 401) uses `child.once("close", …)` routed through `settle()` — and `exec-timer.ts:13–14` correctly describes the `close` behavior, so the two headers contradict each other. **`dispatch-exec.ts` is another area's file** (`bridges-hooks-dispatch*`); that area should own the header fix. The general lesson: a duplicated doc comment drifts in one copy first, and the surviving copy is what a reader trusts.

### Corrections to META-FINDINGS.md

- **"Ranked by leverage" item 1 misses a member and, more importantly, misstates the detection signal.** The section says the symptom is that "every caller fakes one and forces it past the compiler — 178 `as never` casts". `bridges/hooks/translation-context.ts:54` is the same defect (takes `ExtensionContext`, reads `cwd` and `sessionManager`) with **zero casts**: the test pays for it with two 39-line, fully `satisfies`-checked poison-pill literals instead (`translation-context.test.ts:80–118` and `142–180`). A cluster inventory built by grepping `as never` / `as unknown as` will therefore under-count. Add `translation-context.ts` to the list, and search for the second signal too — a hand-built object literal `satisfies` a third-party context type.
- **The "Patterns to propagate" table should gain a row for whole-bytes comparison**, with `tests/bridges/hooks/spawn-helpers.test.ts:193–229` as the in-repo reference implementation. Those two non-truncating cases build the expected serialization as a hand-written template literal and compare with `assert.strictEqual`, including a byte-length assertion pinning the cap boundary at cap-1 and cap exactly. The other eight cases in the same file do the opposite. Sibling drift *within one file* — a shape the table does not currently show.
- **Minor, but it will bite the fixing pass:** `tests/helpers/` does not exist in this tree (`ls` fails), yet `.planning/codebase/CONVENTIONS.md` — which CLAUDE.md loads on every session — still cites `tests/helpers/credential-mock.ts` and `tests/helpers/source-scan.ts` as live examples. The real paths are `tests/architecture/source-scan.ts` and `tests/platform/*`. Any instruction derived from CONVENTIONS.md about test-support location should be re-checked against the tree.

### Confirmations

- **"Clean verdicts are not reliable."** Confirmed hard, with numbers: 3 of the 4 test files this area declared clean, and 2 of the 7 production files, carry findings — 4 of them BLOCKER-class by the skill's own definition (a plausible wrong implementation passes). The findings/clean asymmetry in "Provenance and confidence" is, if anything, understated for this area: the first pass's summary called it "the strongest-tested area encountered in this pass", which is how it earned the thinnest attack.
- **"The dominant shape: sibling drift."** Confirmed at a tighter radius than the section describes. The drift here is not just file-vs-sibling-file but *within a single first-pass area and within a single file*: the same partial-match-on-a-computable-string defect was written up for `timeout.test.ts` and missed in `wire-protocol.test.ts` and `exec-timer.test.ts`; and `spawn-helpers.test.ts` compares whole bytes in two cases and decodes in eight.
- **"Reviewing production alongside tests was worth it."** Confirmed independently. Both of this pass's highest-value findings came from reading production, not tests: the untested `CLAUDE_ENV_FILE` containment check (visible only from `hook-env.ts:74`) and the EXEC-04 doc/code divergence (visible only by reading the comment against the code it describes). Neither is derivable from the test file.
- **"Doc comments cut both ways and cannot be trusted without checking the call graph."** Confirmed with two fresh instances in the same subtree — `spawn-helpers.ts`'s discriminator and `dispatch-exec.ts`'s cancellation event — and one counter-instance: `exec-timer.ts`'s header claim about the three sanctioned `node:child_process` sites checks out exactly against `tests/architecture/no-shell-out.test.ts:125`.
