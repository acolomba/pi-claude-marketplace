# Bridges — hooks payload translators

**Scope:** `tests/bridges/hooks/payloads/**/*.test.ts` (10 files) and
`extensions/pi-claude-marketplace/bridges/hooks/payloads/**/*.ts` (10 files)
**Test files reviewed:** 10
**Production modules reviewed:** 10

## Summary

Pairing is exact — 10 test files, 10 production modules, each named identically
1:1, with no orphans in either direction. On the single highest-priority check
for this area (does every case compare the whole emitted payload with
`assert.deepStrictEqual()` against a hand-written literal, never field-by-field
and never against a value the translator itself produced), the suite is
uniformly compliant: every case builds `expectedPayload` as an independent
literal and asserts it whole. Production code is equally clean: all ten
translators are pure, deterministic functions of `(event, context)` with no
hidden dependencies, no `Date.now()`/`randomUUID()`/`process.env`, and no `as`/`!`
assertions — this is about as testable a production design as this codebase
gets. There are no BLOCKER findings in this area.

The theme that does need attention is structure, exactly where the brief
predicted it: several files enumerate a small closed vocabulary (a `reason`,
a `source`, an HTTP status range) as 4–31 hand-copied sibling `test()` blocks
that differ only in one or two literal values, where the guidelines call for
a `for` loop over typed rows. `stop-failure.test.ts` is the standout case at
31 near-identical `classifyStopFailure` tests. `stop-failure.test.ts` also has
two ASCII-box comment banners standing in for the `describe()` grouping its
two exported entry points call for, and two test files carry stray
compile-time-only `void(... satisfies T)` type-shape blocks sitting outside
any `test()` case. A fixing pass should tackle, in order: (1) the
`stop-failure.test.ts` classifier table, (2) the `session-end`/`session-start`
reason/source enumerations, (3) the box comments and stray `void` blocks.

## Unit test findings

### `tests/bridges/hooks/payloads/stop-failure.test.ts`

- **[WARNING] 31 near-identical `classifyStopFailure` cases belong in one data-driven `for` loop** — `lines 150–589`
  Every case from `"classifies billing before every later error indicator"`
  (line 150) through `"does not match recognized statuses at the start of
  longer numbers"` (line 577) has the identical three-line shape: arrange
  `errorMessage`/`stopReason`/`expectedError`, act `classifyStopFailure(...)`,
  assert `strictEqual` twice. This is exactly the "one sibling `test()` per
  row via a `for` loop over typed rows" case the data-driven-cases rule
  targets. Replace the 31 blocks with one `const rows = [...] as const;` of
  `{ title, errorMessage, stopReason, expectedError }` rows followed by
  `for (const row of rows) { test(row.title, () => { ... }); }` — this keeps
  one sibling `test()` per row (so a single bad row still fails on its own)
  while removing the duplication. Each row's assertions stay exactly as they
  are (`strictEqual(stopFailureError, row.expectedError)` +
  `strictEqual(CLOSED_VOCAB.has(stopFailureError), true)`).

- **[WARNING] Box comments stand in for the `describe()` grouping this module needs** — `lines 56–58, 146–148`
  The two `// ---...---` banner blocks (`SFAIL-02: envelope shape` and
  `SFAIL-03: errorMessage-only classifier...`) are literal comment boxes,
  which the style guide forbids outright ("no boxes around comments"). They
  also paper over a real structural gap: this module has two exported entry
  points (`translate`, `classifyStopFailure`), and the case-structure rule
  wants one `describe()` per exported entrypoint when a module has several.
  Replace both banners with `describe("translate", () => { ... })` and
  `describe("classifyStopFailure", () => { ... })` wrapping the respective
  test blocks (one level deep, no further nesting) — this satisfies both the
  box-comment rule and the missing-`describe()` structure rule in one edit.

- **[WARNING] Compile-time-only type-shape assertions sit outside any `test()`** — `lines 19–47`
  The four module-scope `void ({...} satisfies StopFailureEvent)` /
  `void ({...} satisfies StopFailureStdin)` statements (two positive, two
  negative with `@ts-expect-error`) run no assertion at runtime — they exist
  purely so `tsc` rejects an invalid shape. This module is not a type-only
  module (it exports runtime `translate`/`classifyStopFailure`), so the
  "type-only modules hold bare `satisfies` checks with zero runtime cases"
  pattern doesn't apply here as written: these blocks are dead weight in the
  `node --test` run and won't show up as a named case if someone deletes one
  by accident. Wrap them in a single `test("StopFailureEvent/StopFailureStdin
  reject invalid shapes at compile time", () => { ... })` (the body can stay
  four `void (...)` statements) so the check is named and appears in test
  output.

### `tests/bridges/hooks/payloads/stop.test.ts`

- **[WARNING] Compile-time-only type-shape assertions sit outside any `test()`** — `lines 14–30`
  Same defect as `stop-failure.test.ts` above: three module-scope
  `void ({...} satisfies StopEvent / StopStdin)` statements, one with
  `@ts-expect-error`, run at import time with no test-runner visibility. Fold
  them into a named `test("StopEvent/StopStdin reject an invalid stop_hook_active
  type", () => { ... })`.

- **[WARNING] Redundant `Object.hasOwn` checks add nothing beyond the preceding `deepStrictEqual`** — `lines 93–94, 133–134`
  `StopStdin` (`stop.ts`) has no `background_tasks`/`session_crons` fields at
  all — they're not optional members being toggled, they don't exist in the
  type. Since `assert.deepStrictEqual(stopPayload, expectedPayload)` on the
  line above already fails if `translate()` ever added an extra key, the two
  `assert.strictEqual(Object.hasOwn(stopPayload, "background_tasks"), false)`
  /`"session_crons"` lines in both the inactive-Stop and empty-text cases are
  vacuous — a wrong implementation that adds either field would already be
  caught, and a correct one can never make these lines fail differently.
  Delete both pairs; if the intent is to pin the "Pi has no task registry"
  contract documented in `stop.ts`'s header, the full-object comparison
  already does that.

### `tests/bridges/hooks/payloads/session-end.test.ts`

- **[WARNING] 5 reason-enumeration cases belong in one data-driven `for` loop** — `lines 11–140`
  `"emits the complete SessionEnd envelope with the quit reason"` (11),
  `"...reload reason..."` (39), `"...new reason..."` (64), `"...resume
  reason..."` (90), and `"...fork reason..."` (116) differ only in the
  `reason` string threaded through `event`/`context`/`expectedPayload` (three
  of the five also carry an unused `targetSessionFile` on the event that
  `translate()` never reads). Collapse these five into
  `const rows = [{ reason: "quit" }, { reason: "reload" }, ...] as const;`
  with `for (const row of rows) { test(\`propagates the ${row.reason} reason
  ...\`, () => { ... }); }`. While consolidating, drop the three
  `assert.strictEqual(payload.session_id, context.sessionId)`-style lines at
  34–36 in the "quit" case — they're redundant with the `deepStrictEqual`
  immediately above and don't need to survive into the loop body. The
  standalone `"preserves accepted empty context values..."` case (line 142)
  tests a genuinely different edge case (empty strings) and should stay a
  separate `test()`.

### `tests/bridges/hooks/payloads/session-start.test.ts`

- **[WARNING] 5 source-enumeration cases belong in one data-driven `for` loop** — `lines 11–137`
  Same defect and same fix as `session-end.test.ts` above, over `source`
  values `startup`/`resume`/`reload`/`new`/`fork` (lines 11, 39, 64, 89, 114).
  Drop the redundant `assert.strictEqual(payload.session_id, ...)` lines
  34–36 in the "startup" case when consolidating. `"accepts empty session,
  transcript, and working-directory values"` (line 139) is a distinct edge
  case and should remain standalone.

### `tests/bridges/hooks/payloads/user-prompt-submit.test.ts`

- **[WARNING] 4 near-identical cases are a lower-priority data-driven-loop candidate** — `lines 12–174`
  All four cases (`"hello world"`, multi-line, empty, multi-byte prompt) share
  the identical arrange/act/assert shape and even repeat an identical
  `expectedKeys` array literal four times. Unlike the enumeration cases above,
  these genuinely exercise different string content (not just a label), so
  the duplication is milder, but a `for` loop over
  `{ title, text, prompt }` rows would still remove the four-times-repeated
  boilerplate. Lower priority than the `stop-failure`/`session-*` cases.

### Clean files

- `tests/bridges/hooks/payloads/post-compact.test.ts`
- `tests/bridges/hooks/payloads/post-tool-use-failure.test.ts`
- `tests/bridges/hooks/payloads/post-tool-use.test.ts`
- `tests/bridges/hooks/payloads/pre-compact.test.ts`
- `tests/bridges/hooks/payloads/pre-tool-use.test.ts`

## Production code findings

### `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts`

- **[WARNING] Method doc uses imperative mood instead of third-person verb phrase** — `line 109`
  The JSDoc above `classifyStopFailure` reads `"Classify a StopFailure ending
  into the closed 10-value error-type vocabulary..."`. The style guide
  requires third-person (`"Registers the plugin..."`), not imperative.
  Change `"Classify a StopFailure ending..."` to `"Classifies a StopFailure
  ending..."`.

### Clean files

- `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts`

## Not covered

Dependencies referenced by these translators for type context —
`bridges/hooks/translation-context.ts`, `platform/pi-api.ts`,
`domain/components/hook-events.ts`, `domain/components/hook-tool-names.ts` —
fall outside `bridges/hooks/payloads/` and were not independently reviewed;
they belong to other reviewers' assignments. No test or production file
within the assigned scope was skipped or partially read.
