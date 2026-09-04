# Bridges — hooks async-rewake — adversarial re-review

**Scope:** `tests/bridges/hooks/async-rewake/{pid-table,registry,ring-buffer}.test.ts` (3,235 lines)
and `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/{pid-table,registry,ring-buffer}.ts`
(1,055 lines). Read in full. Cross-checked against
`extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`,
`extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`,
`tests/bridges/hooks/dispatch-exec.test.ts`, and
`extensions/pi-claude-marketplace/shared/{atomic-json,path-safety}.ts`.
**First-pass file:** `unit-test-findings/bridges-hooks-async-rewake.md`
**Clean files attacked:** 2 (`ring-buffer.test.ts`, `ring-buffer.ts`)
**Existing findings graded:** 12

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 4 |
| New WARNING (missed by first pass) | 6 |
| Existing CONFIRMED | 10 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's picture of this area held up on everything it looked at, and its
clean verdict on `ring-buffer` survives a full mutation sweep. What it missed is
entirely in the file it praised: `registry.test.ts` is disciplined *about what it
covers*, and what it covers is one hook event out of ten, one of two truncation
arms, and none of the `/reload`-race paths. All four new BLOCKERs are missing
cases in that file, not weak assertions.

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts`

- **[WARNING] The file header states the wrong truncation marker** — `line 24`
  The header says the exit handler "prepends the `[…truncated]\n\n` marker on the
  inject payload". The actual constant is `TRUNCATED_PREFIX = "[…truncated]\n"`
  (`registry.ts:93`), a single newline, pinned by
  `registry.test.ts:1401` (`` `Review finding:\n\n[…truncated]\n${survivingTail}` `` —
  the `\n\n` there is `BODY_SEPARATOR` after the rewake message, not part of the
  marker). This is a doc comment that lies about a sibling module's behavior in the
  one file that documents the truncation contract end to end. Fix: change line 24 to
  `` `[…truncated]\n` `` , or drop the byte-level claim and say "prepends the
  `[…truncated]` marker (`registry.ts:TRUNCATED_PREFIX`)" so the two cannot drift again.

### `tests/bridges/hooks/async-rewake/ring-buffer.test.ts`

No findings. See **Still clean after attack** for the twelve mutations it catches.

## New findings — outside the clean lists (Step 4)

All in `tests/bridges/hooks/async-rewake/registry.test.ts` and its paired module.
Each is a *missing case*, not a weak assertion — the existing assertions are
whole-value `deepStrictEqual` and would catch these mutations if a case reached them.

### `tests/bridges/hooks/async-rewake/registry.test.ts`

- **[BLOCKER] The `/reload` race that `finalizeChild`'s missing-entry guard exists for
  has no case** — `registry.ts:411-416`, no owning case in the test file
  `event-router.ts:727` calls `shutdownInMemoryChildren()` on every `/reload`, which
  clears `asyncRewakeRegistry` and SIGKILLs each child **without removing its
  listeners**. Each killed child then emits `exit` → `end` → `close`, reaching
  `finalizeChild` with the entry already gone. Deleting the
  `if (entry === undefined) { return; }` guard makes `entry.loc` (line 419) throw a
  `TypeError` inside an `EventEmitter` listener — an uncaught exception on the
  `/reload` path, an NFR-2 break. No case emits a terminal child event after
  `shutdownInMemoryChildren()`: every case's `finally` calls `destroyChild(...)`
  → `removeAllListeners()` immediately after the shutdown, which is exactly what
  closes the window. The only coverage is **incidental and race-dependent** —
  `test('uses the real spawn and generated dispatch ID at the default boundary')`
  (line 2114) kills a real child at line 2136 and may or may not receive its `exit`
  before the case ends; nothing asserts it. Fix: add a case that spawns with the
  `createChild` harness, calls `shutdownInMemoryChildren()`, *then* emits
  `exit(2)` + stream `end` + `close` with a non-empty stderr body, and asserts
  `pi.messages === []`, `context.notifications === []`, and no `uncaughtException`
  (the harness for that already exists at lines 807-815).

- **[BLOCKER] Nine of the ten `TRANSLATORS` rows are never indexed** —
  `registry.ts:102-115`; `createEntry` (`registry.test.ts:274`) hardcodes
  `claudeEvent: "PreToolUse"` and no case overrides it
  Swapping two entries in the table — e.g. `PreCompact: translatePostCompact` and
  `PostCompact: translatePreCompact` — leaves all 34 cases green, because only
  `PreToolUse` ever reaches `TRANSLATORS[entry.claudeEvent]` (line 239). Seven live
  rows (`SessionStart`, `UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure`,
  `PreCompact`, `PostCompact`, `SessionEnd`) are unverified; the remaining two
  (`Stop`, `StopFailure`) are inert by design per the comment at lines 111-113.
  **The sibling already does this right:** `tests/bridges/hooks/dispatch-exec.test.ts`
  drives the byte-for-byte parallel table in `dispatch-exec.ts:113` across every event
  (`claudeEvent: "SessionStart"` :619, `"UserPromptSubmit"` :629, `"PostToolUse"` :655,
  `"PostToolUseFailure"` :674, `"PreCompact"` :693, `"PostCompact"` :725,
  `"SessionEnd"` :746, `"Stop"` :756, `"StopFailure"` :769). Fix: add a `for` loop
  over typed rows `{ claudeEvent, event, expectedStdin }` producing one sibling
  `test()` per dispatchable event, each asserting
  `Buffer.concat(stdinChunks).toString("utf8")` against a hand-written JSON string —
  the shape the lifecycle case already uses at lines 479-486 and 551.

- **[BLOCKER] The stdout arm of the truncation ternary is never exercised truthy** —
  `registry.ts:471`, `const truncated = stderrText.length > 0 ? stderrTrunc : stdoutTrunc;`
  Mutating it to `const truncated = stderrTrunc;` leaves all 34 cases green. The only
  truncation case, `test('frames truncated stderr before the surviving tail and rewake
  message')` (line 1367), truncates **stderr**; the two stdout-body cases (line 1251
  `'injects ordered stdout on the busy follow-up lane'`, line 1420 `'waits for late
  stdio after exit before settling exactly once'`) write a few bytes, so both
  `stderrTrunc` and `stdoutTrunc` are `false` and the arms are indistinguishable.
  Consequence of the mutation in production: an over-cap stdout payload is injected
  with no `[…truncated]` marker, so the model is told nothing was lost. Fix: clone
  the case at line 1367 with an empty stderr, ending stdout with exactly one byte more
  than `STDOUT_CAP_BYTES` (1,048,576 — `ring-buffer.ts:45`), and assert a `content` of
  the `[…truncated]` marker, a newline, and the surviving 1,048,576-byte tail.

- **[BLOCKER] No case injects with an absent `rewakeMessage`** —
  `registry.ts:505`, `if (rewakeMessage !== undefined && rewakeMessage.length > 0)`
  Dropping the `rewakeMessage !== undefined &&` conjunct leaves all 34 cases green,
  and crashes production with `TypeError: Cannot read properties of undefined
  (reading 'length')` inside the `exit` listener for the perfectly ordinary
  `hooks.json` handler that sets `asyncRewake: true` and omits `rewakeMessage`. Every
  case that reaches the injection either sets a non-empty message (lines 286, 1562)
  or the empty string (lines 1269, 1441); the two cases whose `handlerDecl` omits
  `rewakeMessage` (line 1075 `'ignores a late child error…'`, line 1174
  `'records a signalled exit as silent completion'`) both exit non-2 and never
  inject. Fix: add a case with
  `handlerDecl: { type: "command", command: "/opt/hooks/bare", timeout: 600 }`,
  stderr body `"raw finding"`, exit 2, asserting `content: "raw finding"` with no
  separator.

- **[WARNING] 16 of the module's 17 `hookDebugLog` sites are unasserted, while the
  sibling in the same directory asserts every one of its own** — one diagnostic
  capture point exists in the whole file (`registry.test.ts:721`, inside
  `test('contains a synchronous spawn failure with semantic diagnostics')`, line 708)
  and it covers only `registry.ts:262`. `pid-table.test.ts` has a
  `recordHookDiagnostics(t)` helper (lines 61-69) and asserts the message category on
  every degrade path (lines 187-194, 223-229, 321-329, 383-391, 415-423). The
  OBS-01 debug log is the *only* observable for containment on the outer-catch path:
  `test('contains a synchronous stdin end failure and cleans the registered child')`
  (line 954) drives `registry.ts:393-397` and asserts nothing about the diagnostic, so
  deleting that `hookDebugLog` call leaves the suite green. Fix: lift
  `recordHookDiagnostics` into a colocated module shared by both files (see the next
  finding) and add a `{ count, category }` assertion to the cases that drive
  lines 271, 280, 374, 383, 394, 420, 435, 456, 467, 489, 564, 571, 580, 728.

- **[WARNING] `recordHookDiagnostics` is duplicated inline** — `registry.test.ts:711-723`
  reimplements `pid-table.test.ts:61-69` (env stamp + `t.mock.method(console, "error")`
  + push), and the `filesystemErrorCode` duplication the first pass already recorded
  sits directly beside it. Fix both with one move: create
  `tests/bridges/hooks/async-rewake/hook-diagnostics.ts` exporting
  `recordHookDiagnostics(t)` and `filesystemErrorCode(error)` and import it from both
  files. Colocated with the concern, not `tests/helpers/`.

- **[WARNING] The EPIPE listener-before-write ordering promise is not proven** —
  `registry.ts:378-386`; `test('contains stdin errors after registering the listener
  before delivery')` (line 906) asserts only
  `assert.strictEqual(child.stdin?.listenerCount("error"), 1)` at line 928, then emits
  the error by hand at line 923 *after* `spawnAndRegister` has returned. Moving
  `child.stdin?.on("error", …)` to *after* `child.stdin?.end(stdinJson)` keeps the
  listener count at 1, so the case passes and the promise its own title names is not
  tested. Fix: replace `child.stdin.end` with a `t.mock.method` that synchronously
  emits `'error'` on the stream and then returns, and assert no `uncaughtException`
  plus the `stdin error` diagnostic — the same shape line 964 already uses to make
  `end` throw.

- **[WARNING] `AsyncRewakeEntry` is exported with no consumer outside its module** —
  `registry.ts:128`. `grep -rn AsyncRewakeEntry extensions tests` returns three hits,
  all inside `registry.ts` (128, 156, 312). The `fallow-ignore-next-line unused-type`
  at line 127 keeps the dead-export gate quiet with a justification that concedes the
  point — "it remains internally consumed" — while calling the type "published".
  Google style: every export is used outside its module. Fix: drop the `export`
  keyword and the `fallow-ignore` line together; nothing imports it.

### `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`

- **[WARNING] `exitOutcome ?? { code, signal }` is an unreachable defensive fallback** —
  `line 370`. Mutating it to plain `exitOutcome` leaves all 34 cases green: no case
  reaches `close` with `exitOutcome === undefined` *and* `finalized === false`. Tracing
  a real `ChildProcess`: a child that spawned always emits `exit` before `close`, and a
  child that failed to spawn emits `error` first (finalizing with `undefined`) — and
  the `pid === undefined` arm at line 269 returns before any of these listeners are
  installed. So this is category (b), unreachable by real input, not category (a).
  Decide one way: delete the `??` fallback and add a one-line comment that `exit`
  always precedes `close` for a spawned child, **or** keep it and plant the case (the
  `createChild` harness can emit `close` alone — `emitClose` at line 165 is
  independent of `emitExit`). Do not leave it as an untested branch that blocks the
  100%-branch-coverage rule.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `ring-buffer.ts` | `STDERR_CAP_BYTES` | `ring-buffer.test.ts:11` | owned |
| `ring-buffer.ts` | `STDOUT_CAP_BYTES` | `ring-buffer.test.ts:24` | owned |
| `ring-buffer.ts` | `RingBuffer` (constructor) | `ring-buffer.test.ts:37,65,…` | owned |
| `ring-buffer.ts` | `RingBuffer.write` | `ring-buffer.test.ts:49-248` (13 cases) | owned |
| `ring-buffer.ts` | `RingBuffer.read` | `ring-buffer.test.ts:37-248` (14 cases) | owned |
| `pid-table.ts` | `ASYNC_REWAKE_PIDS_FILENAME` | `pid-table.test.ts:138` | owned |
| `pid-table.ts` | `ASYNC_REWAKE_PID_TABLE_VERSION` | `pid-table.test.ts:139` | owned |
| `pid-table.ts` | `PidTableEntry` | `pid-table.test.ts:87,244,362` (typed literals) | owned |
| `pid-table.ts` | `pidTablePath` | `pid-table.test.ts:140,289-296` | owned |
| `pid-table.ts` | `readPidTable` | `pid-table.test.ts:162,185,221,318` | owned |
| `pid-table.ts` | `writePidTable` | `pid-table.test.ts:141,281-296,380` | owned |
| `pid-table.ts` | `unlinkPidTable` | `pid-table.test.ts:144,347,412` | owned |
| `registry.ts` | `MARKER_ENV` | `registry.test.ts:550` (value pinned once, inside the lifecycle case) | owned |
| `registry.ts` | `AsyncRewakeEntry` | — | **NO CASE — and no consumer outside `registry.ts`** |
| `registry.ts` | `OrphanProbes` | `registry.test.ts:2204,2261,…` (`satisfies` literals) | owned |
| `registry.ts` | `SpawnDeps` | `registry.test.ts:293-298,307,732` | owned |
| `registry.ts` | `spawnAndRegister` | 21 cases | owned, but only for `claudeEvent: "PreToolUse"` |
| `registry.ts` | `shutdownInMemoryChildren` | `registry.test.ts:2004` (`'reload shutdown clears cross-scope children despite one kill failure'`) | owned |
| `registry.ts` | `reapOrphans` | `registry.test.ts:2182-2561` (7 cases) | owned |

`MARKER_ENV`'s only value pin is line 550. The expectation that consumes it —
`expectedEnvironment` at line 474 — uses `[MARKER_ENV]: "dispatch-lifecycle"` as a
**computed key from the production constant**, so it is self-consistent under a wrong
constant value. The pairing is sound only because line 550 exists; do not delete it
when that case is split.

## Branch census

### `ring-buffer.ts` — 100%, no gaps

Every branch has an owning case: empty write (`test:49`), `capacity === 0` with an
empty chunk (`:65`) and with a byte (`:79`), `chunk.length > capacity` true (`:173`)
and false (`:127`), `effective.length > room` true (`:141`) and false (`:109`),
`tailLen > 0` true (`:157`) and false (`:127`), `read` with `filled === 0` (`:37`),
`filled < capacity` (`:93`), and `filled === capacity` wrapped (`:141`) and
unwrapped (`:127`).

One **equivalent mutant**, recorded so nobody hunts for a case that cannot exist:
`this.filled = Math.min(this.filled + effective.length, this.capacity)` (line 119) can
drop its clamp with no observable difference — `filled` is read only as
`filled === 0` and `filled < capacity`, and an over-capacity value takes the same
wrapped branch as an exactly-capacity one. Not a coverage gap.

### `pid-table.ts`

- `readPidTable` shape arms (null / primitive / no version / non-array entries /
  stale version), ENOENT, non-ENOENT read failure, malformed JSON — all covered
  (`pid-table.test.ts:198-232, 149, 301, 168`). **Reachable and covered.**
- `writePidTable` / `unlinkPidTable` failure arms and the ENOENT no-op — covered
  (`:353, 395, 333`). **Reachable and covered.**
- The three `assertPathInside` calls (lines 111, 148, 166) — **unreachable by real
  input**, category (b), and the file says so itself at lines 29-34 ("the composed
  path is hard-coded — no untrusted name component participates — so this guard is
  defense-in-depth"). Deleting all three leaves the suite green. Not a finding, but
  worth knowing: the NFR-10 chokepoint uniformity here is held by review, not by test.
- Row-level entry validation — no branch exists; see the graded first-pass WARNING.

### `registry.ts`

Reachable and untested (findings above): the `finalizeChild` missing-entry guard
(411-416); the `rewakeMessage === undefined` injection arm (505); the `stdoutTrunc`
arm (471); nine `TRANSLATORS` rows (102-115).

Unreachable by real input: `exitOutcome ?? { code, signal }` (370) — see the finding.

Reachable and covered: non-dispatchable event (228), synchronous spawn throw (261),
`pid === undefined` including the async `error` and listener-removal arms (269-288),
absent stdout/stderr (297-302, case at 1203), `finalizeOnce` re-entry (341, cases at
1015 and 1058), `finalizeAfterOwnedStreams` all three conditions (350, case at 1420),
stale epoch (434, case at 1595), `rewakeSummary` present/absent and non-string (447 /
320, cases at 432 and 1251), `code !== 2` (455), empty body (466), notify throw (448,
case at 1494), `sendMessage` throw (488, case at 1540), `isPidAlive`'s ESRCH / EPERM /
other-code / success arms (689-697, cases at 2381 / 2331 / 2381 / 2182),
`readProcEnvironMarker`'s no-`=` skip, exact-name match against a
`MARKER_ENV_SUFFIX` decoy, absent marker and read failure (715-729, cases at 2234 /
2182 / 2234 / 2289), the Linux and non-Linux reap arms (561-575, cases at 2182 /
2435), orphan kill failure (579, case at 2477), `shutdownInMemoryChildren`'s kill
throw and idempotent second call (526-533, case at 2004), and the
`deps = {}` production defaults (220-222, case at 2114).

## Grading of first-pass findings

### `tests/bridges/hooks/async-rewake/pid-table.test.ts`

- **UNDERSTATED** — *"The 'without aliasing' claim in the lifecycle test is never
  actually exercised"* (BLOCKER). The diagnosis is right and the mutation survives, but
  the first pass filed it as a test defect with an injection-seam fix that does not
  apply to this leaf. **The production copy protects nothing that any caller can
  observe.** `writePidTable` (`pid-table.ts:142-153`) suspends at
  `await assertPathInside(...)` on line 148 *before* building
  `entries: [...entries]` on line 151. An async function body runs synchronously only
  up to its first `await`, so the realistic caller pattern —
  `const p = writePidTable(loc, entries); entries.push(row); await p;` — lands the
  push **before** the copy is taken and writes the pushed row to disk with the
  defensive copy fully intact. The only window the copy closes is between line 151 and
  `JSON.stringify` inside `atomicWriteJson` (`shared/atomic-json.ts:26`, after
  `await mkdir`), reachable only from a microtask scheduled inside `mkdir`. So the
  doc comment at `pid-table.ts:138-140` ("Defensive-copies the caller's array so the
  envelope is not aliased") over-claims. Fix, in this order: (1) move the `payload`
  construction above `await assertPathInside(...)` so the snapshot is taken
  synchronously at call time; (2) then the test becomes deterministic and trivial —
  call `writePidTable`, `entries.push(...)` synchronously, `await` the promise, and
  assert `storedBytes` still holds only the original row. Raise to BLOCKER on the
  production module, not only on the test.

- **CONFIRMED** — *"`filesystemErrorCode` is duplicated verbatim across two sibling
  test files"* (WARNING). Verified byte-identical at `pid-table.test.ts:44-55` and
  `registry.test.ts:419-430`. The first pass's target directory
  (`tests/bridges/hooks/async-rewake/`, not `tests/helpers/`) is the right one. Fold
  the `recordHookDiagnostics` duplicate into the same move — see the new WARNING above.

### `tests/bridges/hooks/async-rewake/registry.test.ts`

- **CONFIRMED** — *"Every case that registers a child depends on the module-global
  registry singleton"* (BLOCKER). Counts verified: 34 top-level `test()`, 62
  `shutdownInMemoryChildren()` calls, 52 `resetRoutingState()` calls. Note for the
  fixing pass: `shutdownInMemoryChildren` is **not** a test-only hook —
  `event-router.ts:727` is a real production caller — so the fix is factory-owned
  state, not deletion of the export.

- **CONFIRMED** — *"`waitForPidTable` polls on the real clock"* (BLOCKER), with one
  correction to the reasoning. It is not a sleep: the loop yields with `setImmediate`
  and typically settles in one or two turns, so "makes every one of these 15 cases
  slower than necessary" overstates the latency cost. The real defect is the one the
  first pass names second — a real `process.hrtime.bigint()` deadline
  (`registry.test.ts:404`) that `t.mock.timers.enable({ apis: ["Date", "setTimeout"] })`
  does not fake, i.e. nondeterminism under CI load. Two aggravations it did not record:
  the helper ends in its own `assert.deepStrictEqual` (line 416), so a genuine failure
  reports from inside a helper rather than the case; and `readPidTable` returns `[]`
  for an **absent** file as well as an empty one, so `waitForPidTable(loc, [])` cannot
  distinguish "the removal write landed" from "no write ever happened" — the cases
  that need that distinction get it only from a separate
  `stat(...).catch(filesystemErrorCode)` check. The prescribed fix (a signalling
  `pidTableWriter`, modelled on `createControlledPidTableWriter` at lines 300-367) is
  correct and fixes all three.

- **CONFIRMED** — *"`createPi()` and `createContext()`'s `ui.notify` are hand-rolled
  recorders"* (WARNING). Sibling verified: `tests/bridges/hooks/dispatch-exec.test.ts`
  uses `mock<ExtensionAPI>({ exactParams: true, name: "extension api" })` at lines
  1017, 1105, 1166 with `verify(pi)` at 1063, 1141, 1217, for the identical port.

- **CONFIRMED** — *"`createSpawn()` hand-rolls a call recorder"* (WARNING). The
  stub-turned-mock instances are wider than the single line cited: bare call-count
  assertions on `spawnCalls` appear at lines 642, 746, 778 and 853, alongside the
  correct whole-value `deepStrictEqual(spawnCalls, [...])` at 537 and 692. Fix all
  five together.

- **CONFIRMED** — *"Several `reapOrphans` cases turn the `OrphanProbes` stub into an
  ordered-call mock"* (WARNING). The shared-log-and-compare shape these cases use is
  the form the rules prescribe for cross-method ordering; what is missing is that the
  recorders are not sanctioned doubles and no `verify()` closes them. The first pass's
  read of `deadOrphanProbes()` (lines 1002-1013) as a legitimate plain Stub is right.

### `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`

- **CONFIRMED** — *"`asyncRewakeRegistry`/`pidTableOperations` are module-level mutable
  state"* (BLOCKER). Additional evidence the first pass did not have: this same
  module-global is what makes the `/reload` missing-entry race (new BLOCKER above)
  awkward to test — a factory instance per case would let the case hold the registry
  and the child at once. The two findings share a fix.

- **CONFIRMED** — *"The child-exit outcome shape is repeated as an inline object type
  three times"* (WARNING). Verified at lines 332-333, 339 and 406.

- **CONFIRMED** — *"Three nested closures … are `const` arrows"* (WARNING). Verified:
  `onSpawnError` (270), `finalizeOnce` (338), `finalizeAfterOwnedStreams` (349); none
  carries an explicit function-type annotation and none needs the outer `this`.

- **OVERSTATED** — *"`spawnedAt: new Date().toISOString()` is an inline clock read"*
  (WARNING). The finding's own text ends "No action required unless a future change
  wants …", which is not a WARNING. Downgrade to an informational note. The one real
  consequence worth keeping: because the clock is not injectable, the single case that
  exercises the production default (`registry.test.ts:2114`) can only regex-match
  `spawnedAt` (line 2155-2158) instead of comparing it; every other case controls it
  through `t.mock.timers` and asserts the exact ISO string.

### `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts`

- **CONFIRMED** — *"`readPidTable` validates the envelope but not each entry's shape"*
  (WARNING). The fail-closed claim checks out by tracing: a non-numeric `pid` reaches
  `probes.killProbe(pid, 0)` → `process.kill` throws `ERR_INVALID_ARG_TYPE`, which is
  neither `ESRCH` nor `EPERM`, so `isPidAlive` (`registry.ts:697`) returns `false` and
  the row is skipped. Not a crash path. Keep the WARNING and prefer the second half of
  the first pass's remedy (a comment on the cast at line 121 naming the fail-closed
  consumer) over a TypeBox schema, since no consumer reads any field but `pid` and
  `dispatchId`.

## Still clean after attack

- `tests/bridges/hooks/async-rewake/ring-buffer.test.ts` — the strongest file in this
  area, and the clean verdict is earned. Twelve mutations of `ring-buffer.ts` that it
  **does** catch:
  1. `chunk.length > this.capacity` → `>=` — fails `'retains every byte when one chunk
     exactly fills the buffer'` (line 127), which pins `truncated: false` on exact fill.
  2. `chunk.subarray(chunk.length - this.capacity)` → `chunk.subarray(0, this.capacity)`
     (keep the head instead of the tail) — fails line 173 (`"BCDE"` vs `"ABCD"`).
  3. `effective.length > room` → `>=` — fails lines 109 and 127.
  4. Delete the `effective.length > room` latch entirely — fails line 141, which is the
     only case where overwrite-truncation fires without chunk-truncation.
  5. Delete the `chunk.length > capacity` latch — fails lines 173 and 187, the only
     cases where chunk-truncation fires without overwrite-truncation. (4 and 5 are
     independently covered; neither latch can hide behind the other.)
  6. `firstLen = Math.min(effective.length, this.capacity - this.writeIndex)` →
     `Math.min(effective.length, this.capacity)` — fails line 157 (`"CDEFAB"` vs
     `"CDEFGH"`).
  7. Swap the two wrap segments in `read` (`Buffer.concat([tail, head])`) — fails line
     157 (`"GHCDEF"`).
  8. Drop the `% this.capacity` on `writeIndex` — fails line 201 (`"FCDE"` vs `"CDEF"`).
  9. `read`'s `this.filled < this.capacity` → `<=` (return physical rather than
     chronological order when full) — fails line 141 (`"5234"` vs `"2345"`).
  10. `read` returning `subarray(0, this.capacity)` instead of `subarray(0, this.filled)`
      (leak `allocUnsafe` bytes) — fails line 93.
  11. Reset `truncated` in `read()` — fails line 201, which reads twice.
  12. Set `truncated` on a zero-length write — fails line 65 (`RingBuffer(0)` + empty
      chunk stays untruncated), which is the only case separating an empty write from
      a zero-capacity sink.
- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts` — clean
  apart from the header's marker mismatch. Two claims I checked and found **true**, not
  lies: "the uninitialized regions are never observable" (whenever `filled < capacity`,
  `writeIndex === filled`, so `[0, filled)` is exactly the written region), and the
  never-reset truncation latch. `capacity` being assigned in the constructor body
  rather than as a parameter property is a style deviation I am deliberately **not**
  filing — `buf` derives from it and the file is not new code.
- `tests/bridges/hooks/async-rewake/pid-table.test.ts` beyond the graded aliasing
  finding — its degrade matrix genuinely discriminates: swapping the `shape mismatch`
  and `read failed` diagnostic strings fails lines 190 and 224; dropping the
  `version === ASYNC_REWAKE_PID_TABLE_VERSION` check fails the `stale version` row
  (line 203); returning `[]` on the happy path fails line 142; and every degrade case
  re-reads the file to prove `readPidTable` did not rewrite it (lines 186, 222, 319).

## Not covered

- No test or coverage command was run, per the brief. Every branch and mutation
  verdict above comes from reading the production source against the cases, not from
  an instrumented run. The direct-pair coverage gate remains unmeasured for all three
  pairs.
- I did not audit `exec-timer.ts`, `hook-env.ts`, `spawn-helpers.ts`, `timeout.ts`,
  `translation-context.ts`, `routing-state.ts`, or the ten `payloads/*.ts` translators
  that `registry.ts` composes. Those are other areas' files; where `registry.test.ts`
  asserts their output (the stdin JSON at lines 479-486, the timer-handle counts at
  577 and 1988), I treated the assertion as registry's own integration check and did
  not evaluate whether the owning module also covers it.
- `tests/bridges/hooks/dispatch-exec.test.ts` was read only for the two comparisons it
  is cited for (strong-mock usage, translator-table event coverage). I did not review
  it.
- I did not evaluate whether `createControlledPidTableWriter`'s queue harness
  (lines 300-367) itself has an ordering bug; I took its two cases' passing status on
  trust and only used it as the template for the `waitForPidTable` fix.

## Meta-findings impact

### New cross-cutting evidence

**1. "Disciplined assertions" and "covers the behavior" are independent axes, and the
first pass conflated them.** Every one of my four new BLOCKERs is in the file the first
pass opened by calling "unusually disciplined: full-value `deepStrictEqual` assertions
throughout". That praise is accurate — and irrelevant to whether a mutation survives,
because the surviving mutations are on branches **no case reaches**. META-FINDINGS.md's
"Ranked by leverage" is built almost entirely from assertion-strength clusters
(fragment assertions, weak doubles, wide context parameters). There is no entry for
*branch reachability*, and this area suggests one is missing. **Other areas to check
with the same lens: any test file the first pass praised for whole-value assertions —
the `*.messaging.test.ts` family named as the reference implementation for pattern 3 is
the obvious candidate, since a message catalogue with one unexercised arm looks exactly
like a fully-asserted file.**

**2. Parallel production tables are covered by one sibling and not the other.**
`registry.ts:102-115` and `dispatch-exec.ts:113` are the same ten-row translator table;
`dispatch-exec.test.ts` drives all ten, `registry.test.ts` drives one. This is
sibling drift in the *coverage* dimension rather than the convention dimension, and a
partitioned pass cannot see it because the two files sit in different review slices.
`sonar-project.properties` documents a `sonar.cpd.exclusions` list of
"deliberately-parallel-structure files" (agents/commands bridge `stage.ts`,
`orchestrators/plugin/shared.ts`, several `*.messaging.ts`). **Every entry on that
exclusion list is a candidate for the same defect: two parallel tables, one covered.**
That list is a ready-made worklist and nothing in the sweep has used it.

**3. A cleanup API that clears shared state while listeners stay attached is a
repeatable defect shape.** `shutdownInMemoryChildren()` clears the registry `Map` but
leaves each child's `exit`/`close`/`error` listeners installed, so every terminal event
after a `/reload` lands on a missing entry. The guard that catches it is untested
because every case's `finally` calls `removeAllListeners()` immediately after the
shutdown — **the cleanup code in the test closes the very window the production guard
exists for.** Any module with a `reset*`/`shutdown*`/`clear*` function over module-global
state has the same shape: check `bridges/hooks/routing-state.ts`
(`resetRoutingState`/`resetEpoch`), `bridges/hooks/settle.ts`, and
`shared/completion-cache.ts` — the three other modules META-FINDINGS.md item 2 already
names — for callbacks that outlive the reset.

### Corrections to META-FINDINGS.md

- **"Ranked by leverage" item 2, the `bridges/hooks/async-rewake/registry.ts` row:**
  the table says "module-singleton child registry forces **62 manual reset calls** in
  one test file". The count is right (verified: 62 `shutdownInMemoryChildren()`, plus
  52 `resetRoutingState()`), but the row belongs under a different heading. Item 2 is
  titled *"Replace **test-only hooks** over module-global state"* and its lead sentence
  reads "Four modules export a reset function whose only callers are tests."
  **`shutdownInMemoryChildren` is not a test-only hook** — `event-router.ts:727` calls
  it on every `/reload`, and `registry.ts:517-522` documents that contract. Filing it
  beside `resetCompletionCache` (genuinely test-only) and `resetRoutingState`
  (falsely documented as production) risks a fixing pass deleting a production API.
  Correction: keep the row, but split the heading into "test-only reset hooks to
  delete" and "legitimate production APIs whose module-global state should become
  factory-owned"; `registry.ts` is in the second group.
- **"Known gaps in this sweep", the clean-verdict caveat:** for this area the caveat is
  the wrong way round. The clean verdicts held (`ring-buffer` survived twelve named
  mutations); the *non-clean* file is where the misses were. Worth saying in the
  consolidated version that attacking clean lists is necessary but not where the yield
  necessarily is.

### Confirmations

- **Sibling drift is the dominant shape** — confirmed from three independent angles in
  this one area: hand-rolled recorders in `registry.test.ts` vs. `strong-mock` in
  `dispatch-exec.test.ts` (verified at lines 1017/1063 etc.); diagnostic assertions in
  `pid-table.test.ts` vs. one capture point in `registry.test.ts`; and full-event
  translator coverage in `dispatch-exec.test.ts` vs. one event in `registry.test.ts`.
  In all three the correct form already exists in a file in the same directory tree.
- **"The production half of the sweep paid for itself"** — confirmed. The single most
  consequential thing in this re-review is a production ordering defect, not a test
  defect: `writePidTable`'s defensive copy is taken after the function's first `await`,
  so it cannot protect against the only caller-mutation pattern a caller can express.
  Reading the tests alone produced "the aliasing assertion is misplaced"; reading the
  production module produced "the aliasing guarantee does not exist".
- **Compiler-forced / unreachable branches are a real category here (D-116-01a)** —
  confirmed with two more instances that are *not* compiler-forced but are genuinely
  unreachable-by-real-input: `registry.ts:370`'s `exitOutcome ?? { code, signal }`, and
  `pid-table.ts`'s three `assertPathInside` calls, the latter documented as
  defense-in-depth in the file's own header (lines 29-34). Both leave the suite green
  when deleted. The operator decision META-FINDINGS.md item 1 asks for should cover
  these too — but note neither needs prototype surgery to reach, which is what makes
  them a cleaner test of the same question.
