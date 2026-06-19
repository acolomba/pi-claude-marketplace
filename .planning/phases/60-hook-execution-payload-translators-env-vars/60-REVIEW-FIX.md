---
phase: 60-hook-execution-payload-translators-env-vars
fixed_at: 2026-06-15T07:30:00Z
review_path: .planning/phases/60-hook-execution-payload-translators-env-vars/60-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 60: Code Review Fix Report

**Fixed at:** 2026-06-15
**Source review:** `.planning/phases/60-hook-execution-payload-translators-env-vars/60-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 9 (2 BLOCKER + 7 WARNING; Info findings out of scope)
- Fixed: 9
- Skipped: 0

All seven `--fix` commits were produced inside the isolated worktree
`/tmp/sv-60-reviewfix-MYaApP` on branch `gsd-reviewfix/60-293650`; the
orchestrator's cleanup tail fast-forwards `features/v1.13-hook-bridge`
to capture them.

## Fixed Issues

### CR-01: `applyMutationInPlace` for `tool_result` spreads arbitrary hook JSON over the whole Pi event

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`,
`tests/architecture/hooks-adapters.test.ts`

**Commit:** `29905de`

**Applied fix:** Replaced `Object.assign(target, patch)` for both
`tool_result` and `tool_call` arms with a field-by-field whitelist.

- `tool_result`: only `content` (array) and `isError` (boolean) may
  mutate the event. Non-array `content` is silently dropped; non-boolean
  `isError` is silently dropped; null / primitive patches are rejected
  early.
- `tool_call`: rejects null / non-object / array `updatedInput`
  patches before `Object.assign`-ing into `event.input`, defusing a
  prototype-pollution / surprising-shape footgun.

Added five whitelist-regression tests pinning that the discriminator
(`type`), `toolName`, and arbitrary fields cannot be rewritten through
the mutation surface.

### CR-02: Stream cap measured in UTF-16 code units (`text.length`) but named `_BYTES`

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`,
`tests/architecture/hooks-exec.test.ts`

**Commits:** `8fdc032` (stdin truncation arm), `7495c78` (stream
accumulator arm)

**Applied fix:** Replaced `raw.length` / `text.length` (UTF-16 code
units) with `Buffer.byteLength(raw, "utf8")` at all three sites: stdin
truncation cap, stdout overflow cap, stderr overflow cap. Added a CJK
regression test (120 K code units of `"中"` = 360 K UTF-8 bytes) that
exercises the byte-vs-code-unit boundary. The previous ASCII fixture
passed under both implementations and would not have caught the
regression.

### WR-01: Stream `data` listeners stay attached after overflow → unbounded memory growth

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`

**Commit:** `bdd529c`

**Applied fix:** Consolidated the two duplicate overflow callbacks into a
single `handleOverflow` helper that calls `removeAllListeners("data" |
"end")` on both stdout and stderr the moment overflow fires. The
accumulator stops growing immediately even if the child keeps writing.

### WR-02: `_truncated: true` marker can be silently overridden when payload contains a `_truncated` key

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`

**Commit:** `8fdc032` (bundled with CR-02 stdin arm)

**Applied fix:** Replaced `{ _truncated: true, ...payload }` spread
(spread-wins-last) with explicit field assignment: spread the payload
first, then assign `_truncated` last so a payload-supplied `_truncated`
key cannot win. Also reordered the non-object defensive arm to put the
marker last. No v1.13 translator emits this key today; this is
defense-in-depth.

### WR-03: `buildPayload` casts the runtime `event` to `never`; mismatched event shape silently emits incomplete envelopes

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`

**Commit:** `cec9bfc`

**Applied fix:** Added a `REQUIRED_EVENT_FIELDS` table and an
`!(field in obj)` probe that runs before the `as never` cast. Misses
route through `hookDebugLog` so a future routing bug or Pi peer-dep
shape change becomes observable under `PI_CLAUDE_MARKETPLACE_DEBUG=1`
rather than silently emitting partial envelopes. The translator still
runs after a probe miss to preserve the never-throws contract.

### WR-04: `Map.delete` during forward iteration in `hydrateProjectScopeForCwd`

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`

**Commit:** `4370921`

**Applied fix:** Snapshot the key set via `Array.from(...)` before
iterating + deleting. The original code is correct per ECMAScript spec
(deleted entries are skipped during iteration) but the snapshot makes
the intent explicit and removes the cognitive friction for the next
contributor.

### WR-05: `chunk.toString("utf8")` on chunk boundaries can produce replacement characters

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`

**Commit:** `7495c78` (bundled with CR-02 stream arm)

**Applied fix:** Use `node:string_decoder.StringDecoder("utf8")` to
decode `data` chunks. `decoder.write(chunk)` buffers partial UTF-8
sequences across chunk boundaries; `decoder.end()` flushes any final
partial sequence on stream `end`. The wire-protocol `JSON.parse` could
previously propagate `U+FFFD` replacement chars into string values
without failing, silently corrupting `block.reason` / `mutate.additionalContext`.

### WR-06: Install closure can leak a cache entry on a throw between `addInstalledPluginHooksToCache` and `tx.save()`

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`

**Commit:** `4232be5`

**Applied fix:**

- **install.ts** (explicit `tx.save`): moved the cache mutation +
  `rebuildRoutingTables` block to AFTER `tx.save()`. A write-back throw
  or tx.save throw aborts BEFORE the cache mutates. Post-save semantics
  are safe: state.json is the source of truth the next `/reload`
  rehydrates from.
- **reinstall.ts** (explicit `tx.save`): same move; cache mutation now
  follows `maybeWritePluginConfigBack` + `tx.save()`.
- **update.ts** (`withStateGuard` auto-save tail): cannot move past the
  auto-save without exposing `tx.save()` from the helper, which is a
  broader refactor. Moved cache mutation past
  `maybeWritePluginConfigBack` so a write-back throw at least no longer
  strands the cache; the residual tx.save-throw window is documented
  inline.

**Note:** This is a semantic reorder that touches three orchestrators'
commit flow. Marked `requires human verification` -- the existing 165
plugin-orchestrator tests pass, but failure-arm reordering should be
spot-checked by a human against the WR-04 / PI-14 catch-block routing.

### WR-07: `tryKill` only sends SIGTERM; overflowed children that ignore SIGTERM block on the original timeout ladder

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`

**Commit:** `bdd529c` (bundled with WR-01 -- same overflow handler)

**Applied fix:** On overflow, cancel the original `installTimerLadder`
and arm a fresh `installTimerLadder(child, 0)` so SIGKILL fires 5 s
after SIGTERM rather than `timeoutMs + 5s` (default 605 s) after the
original timeout. SIGTERM is sent synchronously so observers (and the
architecture-test spawn-spy assertion) see the kill request even when
the child exits before the next macrotask tick.

## Skipped Issues

_None._

## Verification

- `npx tsc --noEmit` -- clean at HEAD.
- `node --test "tests/architecture/**/*.test.ts" "tests/bridges/**/*.test.ts"`
  -- 476 tests pass, 0 fail.
- `node --test tests/orchestrators/plugin/*.test.ts` -- 165 tests pass,
  0 fail.
- Pre-commit (`SKIP=trufflehog pre-commit run --files <changed>`)
  passed on every commit; TruffleHog ran separately at `--all-files`
  outside the worktree and reported clean.

## Coverage Additions

- **CR-01:** five new whitelist-regression tests in
  `tests/architecture/hooks-adapters.test.ts` pinning that arbitrary
  patch fields (`type`, `toolName`, `bogusField`), non-array `content`,
  non-object `updatedInput`, and null / primitive patches cannot mutate
  the event surface.
- **CR-02 / IN-05:** new CJK fixture in
  `tests/architecture/hooks-exec.test.ts` (`120 * 1024` repetitions of
  `"中"` = 360 K UTF-8 bytes) pinning that the `_truncated:true` marker
  fires under byte-accurate measurement. The previous ASCII fixture
  passed under both the buggy and correct implementations.

## Out-of-Scope Info Findings

Not addressed in this iteration (fix_scope = `critical_warning`):

- **IN-01:** stderr ledger formatting (debug log truncation suggestion).
- **IN-02:** `compositeHandlerFor` early-exit `as CompositeReturnFor<E>`
  cast documentation polish.
- **IN-03:** magic-string `"tool_call"` / `"tool_result"` literals in
  event-adapters.
- **IN-04:** `serializeWithTruncation` re-check-against-cap doc note.
  (Marker overshoot comment was added as part of CR-02; the bullet
  point is informally covered.)
- **IN-05:** architecture-test stdin truncation ASCII-only assertion.
  The CJK regression test added under CR-02 closes the test-coverage
  half of this finding. The IN-05 doc-note half is still informational.

---

_Fixed: 2026-06-15_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
