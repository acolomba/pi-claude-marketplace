# Bridges — hooks payload translators — adversarial re-review

**Scope:** all 10 test modules under `tests/bridges/hooks/payloads/` and all 10
production modules under `extensions/pi-claude-marketplace/bridges/hooks/payloads/`,
read in full (2,199 lines total). Mutations were checked against the installed
peer-dep type declarations (`@earendil-works/pi-coding-agent` dev `^0.84.2`) and,
for the StopFailure classifier, executed as a standalone reproduction.
**First-pass file:** `unit-test-findings/bridges-hooks-payloads.md`
**Clean files attacked:** 14 (5 test modules, 9 production modules)
**Existing findings graded:** 9

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 2 |
| New WARNING (missed by first pass) | 7 |
| Existing CONFIRMED | 4 |
| Existing UNDERSTATED | 2 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 2 |
| Existing DUPLICATE-OF | 0 |

The first pass's headline claim — "There are no BLOCKER findings in this area" —
does not hold. Two of the three files it declared clean on **both** sides
(`pre-compact`, `post-compact`) carry a production defect whose doc comment
asserts a fact about the Pi peer dep that the peer dep's own `.d.ts` contradicts,
and whose paired tests pin the wrong behavior. Separately, the file the first
pass spent three findings on (`stop-failure.test.ts`) has 36% of the classifier
table it exists to protect unreachable by any of its 31 cases.

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts` and `pre-compact.ts`

- **[BLOCKER] Both compact translators hardcode `trigger: "auto"` on a doc
  comment that the installed peer dep disproves, and both paired tests pin the
  wrong value** — `post-compact.ts:8-10`, `post-compact.ts:29`;
  `pre-compact.ts:8-14`, `pre-compact.ts:36`; pinned at
  `tests/.../post-compact.test.ts:62,75` and `tests/.../pre-compact.test.ts:89,103`

  `post-compact.ts:8` states *"Pi does not expose a trigger source on the
  post-compaction event"*. `pre-compact.ts:9` states *"Pi's
  `SessionBeforeCompactEvent` does not expose a trigger source"* and adds *"a
  manual `/compact` shell-out is not yet wired through this seam"*. Both claims
  are false against the installed peer dep:

  ```
  node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:442
    export interface SessionBeforeCompactEvent {
      ...
      /** What triggered the compaction: manual /compact, the context threshold,
          or context overflow recovery */
      reason: "manual" | "threshold" | "overflow";

  types.d.ts:454
    export interface SessionCompactEvent {
      ...
      reason: "manual" | "threshold" | "overflow";   // same doc comment
  ```

  `reason` is a **required** field on both events and maps 1:1 onto Claude's
  documented `trigger: "manual" | "auto"` vocabulary. The belief was true when
  the bridge shipped — `.planning/milestones/force-install-STATE.md:276` records
  it as a v1.13 decision — and has since been falsified by upstream drift. The
  translators still emit a constant.

  **Surviving mutation, inverted:** the *correct* implementation
  (`trigger: event.reason === "manual" ? "manual" : "auto"`) makes both suites
  **red**, because `post-compact.test.ts:62` and `pre-compact.test.ts:89` each
  set `reason: "manual"` on the fixture and then assert `trigger: "auto"`. The
  test author had to type `reason: "manual"` to satisfy `satisfies
  SessionCompactEvent` and did not notice the contradiction. These are not weak
  cases — they are cases that actively defend a stale behavior, the Step-4
  "assertions that drifted from current production behavior" shape.

  Consequences: the `"manual"` arm of `PostCompactStdin.trigger` /
  `PreCompactStdin.trigger` (`post-compact.ts:20`, `pre-compact.ts:24`) is
  declared but unreachable; a Claude plugin hook matching `trigger == "manual"`
  can never fire; and `"overflow"` has no mapping decision at all.

  **Fix:** re-derive the contract before touching the tests. Decide the
  three-to-two mapping (`manual` → `"manual"`; `threshold`/`overflow` → `"auto"`
  is the obvious reading), implement it in both translators, replace the false
  "Pi does not expose" sentences with a present-tense statement of the mapping,
  and replace the two `reason: "manual"` fixtures with one case per Pi `reason`
  value in each file (3 each). Do **not** simply strengthen the existing
  assertions — they assert the wrong answer.

  Escalation: the same stale belief is baked into
  `domain/components/hook-events.ts` (`NON_TOOL_EVENT_CLOSED_SETS` gives
  `PreCompact`/`PostCompact` **empty** admissible-value sets, so a plugin
  declaring `PreCompact` `matcher: "manual"` is rejected as unsupportable via
  TOOL-02(c)). That half belongs to `domain-components-hooks.md` — see
  "Meta-findings impact".

### `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts`

- **[BLOCKER] 9 of the classifier table's 25 matchers are dead to all 31 cases —
  each can be deleted individually and the suite stays green** —
  `stop-failure.ts:68-99`, cases at `tests/.../stop-failure.test.ts:150-589`

  `CLASSIFIER_TABLE` *is* this module's contract (SFAIL-03 / D-88-02). I
  reproduced the table and all 31 case inputs standalone (baseline: 0
  mismatches, so the reproduction is faithful) and deleted each matcher in turn.
  Nine deletions leave every case passing:

  | Row | Dead matcher | Why no case reaches it |
  | --- | --- | --- |
  | `billing_error` | `"billing"` | every billing case uses `"OUT OF BUDGET"` |
  | `billing_error` | `"quota exceeded"` | never appears in any fixture |
  | `billing_error` | `"insufficient_quota"` | never appears |
  | `billing_error` | `"usage limit"` | never appears |
  | `billing_error` | `"available balance"` | never appears |
  | `rate_limit` | `"rate limit"` | appears only at `:153`, where `billing_error` wins on order; the rate-limit case at `:168` is decided by `"too many requests"` |
  | `server_error` | `"server error"` | appears only in fixtures an earlier row claims; the server case at `:213` is decided by `"service unavailable"` |
  | `server_error` | `"internal error"` | never appears |
  | `model_not_found` | `"model not found"` (space form) | the case at `:227` uses the underscore form `"MODEL_NOT_FOUND"` |

  A typo in any of those nine strings — `"insufficient_qouta"`, a dropped space
  in `"usage limit"` — ships green, and the failure mode is silent
  misclassification into `unknown`, which is in-vocabulary and therefore
  invisible downstream. The coverage is badly lopsided: 13 of the 31 cases are
  negative HTTP-status boundary probes (399/402/404/428/430/499/501/505/528/530
  plus two long-number cases) exercising the regex half exhaustively, while a
  third of the plain-substring half is untouched.

  **Fix:** add one case per currently-dead matcher, each with a message
  containing **only** that matcher's substring (e.g. `"Your account has
  insufficient_quota for this model."` → `billing_error`), so deleting the row
  makes exactly one case fail. Do this **before** the first pass's for-loop
  consolidation, and make the row table one row per matcher rather than one row
  per expected type — otherwise the loop makes the blind spot harder to see, not
  easier.

- **[WARNING] The `error_details` conditional spread survives a truthiness
  mutation because no case supplies an empty-string detail** — `stop-failure.ts:45`

  `...(event.error_details !== undefined ? { error_details: event.error_details } : {})`.
  Mutating `!== undefined` to a bare truthiness test (`event.error_details ? … : {}`)
  leaves all three `translate` cases green: `:60` supplies `"429 from provider"`,
  `:90` and `:118` omit the field entirely. `error_details?: string` admits `""`,
  and under the mutation an empty detail is silently dropped from the wire
  envelope. Add a fourth case with `error_details: ""` asserting the key is
  present with an empty value.

- **[WARNING] `FailureStopReason` is exported with no consumer and no negative
  proving the compile-time claim its doc makes** — `stop-failure.ts:101-106`

  `grep -rn FailureStopReason extensions/ tests/` returns exactly two hits, both
  inside `stop-failure.ts` itself (the declaration and its use at line 120). No
  other module and no test imports it. Its doc comment claims *"the narrowed
  parameter makes a non-failure `stopReason` a compile error rather than a
  spurious failure classification"* — nothing verifies that. The same test file
  already demonstrates the right technique four lines apart, at `:33-37` and
  `:38-47`, for `StopFailureEvent.error` and `error_details`. Either make the
  type module-private, or add
  `// @ts-expect-error a non-failure stop reason is not classifiable` +
  `void (classifyStopFailure("", "toolUse"));` to the module-scope block at
  `stop-failure.test.ts:19-47`. (`StopReason` resolves to
  `"pending" | "stop" | "length" | "toolUse" | "error" | "aborted" | "deferred"`
  in `pi-ai/dist/types.d.ts:277`, so `"toolUse"` is a live negative.)

### `tests/bridges/hooks/payloads/stop-failure.test.ts`

- **[WARNING] 34 vacuous assertions: 31 `CLOSED_VOCAB.has(...)` lines and 3
  `Object.hasOwn(...)` lines that no wrong implementation can fail** —
  `lines 87, 115, 143`, and every case's second assertion in `150-589`

  This is the same defect the first pass correctly flagged in `stop.test.ts`,
  eleven times over, in the file it reviewed immediately before. Two proofs:

  1. `assert.strictEqual(stopFailureError, expectedError)` on the preceding line
     already fixes the value to a hand-written literal, so
     `CLOSED_VOCAB.has(stopFailureError)` reduces to
     `CLOSED_VOCAB.has("<literal>")` — a statement about
     `NON_TOOL_EVENT_CLOSED_SETS.StopFailure`, not about `classifyStopFailure`.
     It belongs in `tests/domain/components/hook-events.test.ts`, and
     `hook-events.ts:195-198` says the link is already a **compile-time**
     guarantee ("classifier output and matcher vocabulary cannot drift apart
     without a compile error"), so the runtime copy tests a gate that already
     holds.
  2. `assert.deepStrictEqual` rejects an extra own key **including one whose
     value is `undefined`** (verified: both
     `deepStrictEqual({a:1,b:undefined},{a:1})` and its inverse throw). So the
     three `Object.hasOwn(stopFailurePayload, "error_details")` lines can never
     fail when the `deepStrictEqual` above them passes.

  Delete all 34. Keep the vocabulary-membership check as a single case in
  `hook-events.test.ts` if it is wanted at all.

### `tests/bridges/hooks/payloads/session-start.test.ts` and `user-prompt-submit.test.ts`

- **[WARNING] No case supplies the optional Pi-event fields the translators must
  not forward, so a conditional field leak survives** —
  `session-start.test.ts:11-162` (6 cases), `user-prompt-submit.test.ts:12-174` (4 cases)

  `SessionStartEvent.previousSessionFile?: string` (`types.d.ts:421`) is set by
  no session-start case; `InputEvent.images?` and `streamingBehavior?`
  (`types.d.ts:633,637`) are set by no user-prompt-submit case. Mutation: add
  `...(event.previousSessionFile !== undefined ? { previous_session_file: event.previousSessionFile } : {})`
  to `session-start.ts:30`. All six cases stay green — the spread never fires,
  because no fixture carries the field. A session-file path leaking into a hook
  subprocess's stdin is a real disclosure, not a shape nit.

  **The in-repo fix already exists three files away.** `session-end.test.ts`
  sets `targetSessionFile` on three fixtures (`:74`, `:100`, `:126`) precisely to
  prove the optional field is *not* emitted, and names it in the case titles
  ("…without emitting the target session file"). Copy that: add
  `previousSessionFile: "/sessions/previous.jsonl"` to the session-start `new`,
  `resume`, and `fork` cases (the three the peer dep documents it for), and
  `images: []` + `streamingBehavior: "steer"` to one user-prompt-submit case.
  `pre-compact.test.ts:42` already does the same for `customInstructions`.

### Repo-area sibling drift (grouped)

- **[WARNING] 7 of the 10 exported `*Stdin` envelope interfaces are never pinned
  by their paired test** — `post-compact.ts:15`, `pre-compact.ts:19`,
  `post-tool-use.ts:22`, `post-tool-use-failure.ts:18`, `pre-tool-use.ts:19`,
  `session-end.ts:16`, `session-start.ts:17`

  Only `stop.ts` (`StopStdin`, `StopEvent`), `user-prompt-submit.ts`
  (`UserPromptSubmitStdin`) and `stop-failure.ts` (`StopFailureStdin`,
  `StopFailureEvent`) have their envelope types imported and `satisfies`-pinned
  by the paired test. In the other seven files the `expectedPayload` literal
  carries no type at all (`post-compact.test.ts:33`, `pre-compact.test.ts:52`,
  `post-tool-use.test.ts:32`, …) or is inlined bare into the assert call
  (`session-end.test.ts:27`, `session-start.test.ts:27`). Consequence: adding a
  field to `PostToolUseStdin`, or widening `hook_event_name` from the literal
  `"PostToolUse"` to `string`, is invisible to the paired test — the
  `deepStrictEqual` pins what the function *emitted*, never what the exported
  type *declares*. Add `satisfies <Event>Stdin` to every `expectedPayload`,
  naming the inlined literals in `session-end`/`session-start` as
  `expectedPayload` first. `stop.test.ts:43-50` is the exemplar.

- **[WARNING] Key order is the wire contract but only 1 of 10 files asserts it** —
  `user-prompt-submit.test.ts:48, 89, 130, 171`

  The translator's return value is JSON-serialized straight onto the hook
  child's stdin (`bridges/hooks/spawn-helpers.ts:67`, `const raw =
  JSON.stringify(payload)`), so `JSON.stringify` insertion order is bytes a hook
  author observes. `assert.deepStrictEqual` does **not** compare key order
  (verified: `deepStrictEqual({a:1,b:2},{b:2,a:1})` passes), so the nine sibling
  files pin nothing about it — reordering `session_id` and `cwd` in any of nine
  translators is undetectable. `user-prompt-submit.test.ts` is the file that
  gets this right; propagate its
  `assert.deepStrictEqual(Object.keys(payload), expectedKeys)` line to the other
  nine. When consolidating that file (see the OVERSTATED grading below), make
  `expectedKeys` a function returning a fresh array rather than a module-scope
  `const` — a shared mutable array at module scope trades one finding for
  another.

- **[WARNING] `session-end.test.ts` and `session-start.test.ts` type their event
  fixtures by annotation where the other eight use `satisfies`** —
  `session-end.test.ts:18, 46, 71, 97, 123, 149`; `session-start.test.ts:18, 46, 71, 96, 121, 146`

  `const event: SessionShutdownEvent = { … }` widens the literal to the
  interface; the eight sibling files write `const event = { … } satisfies
  SessionShutdownEvent`, which keeps the literal types and still rejects excess
  properties. The guidelines call for the `satisfies` form. Mechanical: move the
  annotation to a trailing `satisfies` in all 12 sites.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `post-compact.ts` | `translate` | `post-compact.test.ts:11, :48` | owned (asserts a stale contract — see BLOCKER) |
| `post-compact.ts` | `PostCompactStdin` | — | **NO CASE** (never imported) |
| `pre-compact.ts` | `translate` | `pre-compact.test.ts:11, :67` | owned (asserts a stale contract) |
| `pre-compact.ts` | `PreCompactStdin` | — | **NO CASE** |
| `post-tool-use.ts` | `translate` | `post-tool-use.test.ts:11, :54` | owned |
| `post-tool-use.ts` | `PostToolUseStdin` | — | **NO CASE** |
| `post-tool-use-failure.ts` | `translate` | `post-tool-use-failure.test.ts:11, :50` | owned |
| `post-tool-use-failure.ts` | `PostToolUseFailureStdin` | — | **NO CASE** |
| `pre-tool-use.ts` | `translate` | `pre-tool-use.test.ts:11, :48` | owned |
| `pre-tool-use.ts` | `PreToolUseStdin` | — | **NO CASE** |
| `session-end.ts` | `translate` | `session-end.test.ts:11,39,64,90,116,142` | owned |
| `session-end.ts` | `SessionEndStdin` | — | **NO CASE** |
| `session-start.ts` | `translate` | `session-start.test.ts:11,39,64,89,114,139` | owned |
| `session-start.ts` | `SessionStartStdin` | — | **NO CASE** |
| `stop.ts` | `translate` | `stop.test.ts:32, :59, :99` | owned |
| `stop.ts` | `StopStdin` | `stop.test.ts:18, :43, :79, :119` | owned (`satisfies`) |
| `stop.ts` | `StopEvent` | `stop.test.ts:14, :26 (neg), :34` | owned (`satisfies` + `@ts-expect-error`) |
| `user-prompt-submit.ts` | `translate` | `user-prompt-submit.test.ts:12,53,94,135` | owned |
| `user-prompt-submit.ts` | `UserPromptSubmitStdin` | `user-prompt-submit.test.ts:34,75,116,157` | owned (`satisfies`) |
| `stop-failure.ts` | `translate` | `stop-failure.test.ts:60, :90, :118` | owned |
| `stop-failure.ts` | `classifyStopFailure` | `stop-failure.test.ts:150-589` (31 cases) | owned, **table 36% uncovered** |
| `stop-failure.ts` | `StopFailureStdin` | `stop-failure.test.ts:24, :38 (neg), :72, :101, :129` | owned |
| `stop-failure.ts` | `StopFailureEvent` | `stop-failure.test.ts:19, :33 (neg), :62, :92, :120` | owned |
| `stop-failure.ts` | `FailureStopReason` | — | **NO CASE**, and no production consumer either |

Pairing itself is exact (10 ↔ 10, no orphans either way) — the first pass was
right about that. Every `translate` function is owned. The gap is entirely on
the type exports: 8 of 24 exports have no owning case, and 7 of those 8 are the
envelope interfaces that *are* the wire contract.

## Branch census

Nine of the ten production modules are straight-line object literals with **zero
branches** — there is nothing to census and nothing untested in them. All
branching in the area lives in `stop-failure.ts`:

| Branch | Classification |
| --- | --- |
| `:45` conditional spread, present arm | covered (`:60`) |
| `:45` conditional spread, absent arm | covered (`:90`, `:118`) |
| `:45` `!== undefined` vs truthiness boundary (`error_details: ""`) | **reachable and untested** — see WARNING above |
| `:122` `stopReason === "length"` true arm | covered (`:253`) |
| `:122` false arm | covered (28 cases) |
| `:127` table loop, all 7 rows selected at least once | covered |
| `:127` table loop, 9 of 25 individual matchers | **reachable and untested** — see BLOCKER above |
| `:128` `typeof m === "string"` ternary, both arms | covered (string rows at `:184`, regex rows at `:341`) |
| `:133` `return "unknown"` fallback | covered (`:269`, `:283`, + 13 status-boundary cases) |

**No unreachable branches and no compiler-forced branches exist in this area.**
The D-116-01a category does not apply here — stated explicitly so the fixing
pass does not go looking. The one type-level dead value is
`PreCompactStdin.trigger`/`PostCompactStdin.trigger` `"manual"`, which is dead
only *because* of the drift BLOCKER, not by design; it becomes live when that is
fixed.

## Grading of first-pass findings

### `tests/bridges/hooks/payloads/stop-failure.test.ts`

- **UNDERSTATED** — *31 near-identical `classifyStopFailure` cases belong in one
  data-driven `for` loop*. The duplication claim is correct and WARNING fits it.
  What it misses is that the first pass held all 31 cases in view and asked only
  whether they were *shaped* right, never whether they *covered* the table — 9
  of 25 matchers are unreachable by any of them. Worse, the recorded fix
  instruction ("Each row's assertions stay exactly as they are") would carry the
  blind spot into a uniform row table, where a complete-looking grid hides an
  incomplete one. Raise to BLOCKER, and sequence the coverage fix first.

- **CONFIRMED** — *Box comments stand in for the `describe()` grouping this
  module needs*. `.agents/skills/typescript-google-style-review/SKILL.md:27`
  says "no boxes around comments" verbatim, and this is the only module in the
  area with two exported entrypoints. (Note for the fixer: the same `// ────`
  banner style is used in production at `bridges/hooks/dispatch-exec.ts:100,
  126, 278` — that file's own reviewer should own those.)

- **REFUTED** — *Compile-time-only type-shape assertions sit outside any
  `test()`*. The module-scope `void (… satisfies T)` form is the established
  in-repo convention for compile-time-only checks, used ~22 times in the same
  test directory at `tests/bridges/hooks/index.test.ts:29-72`, including the
  `@ts-expect-error` negatives. The unit-testing skill's own type-only-module
  pattern calls for bare `satisfies` checks and `@ts-expect-error` negatives with
  "zero runtime cases is correct". The proposed fix is actively worse: wrapping
  four `void (…)` statements in a `test()` produces a case whose body contains no
  runtime assertion, i.e. a case any wrong implementation passes — the exact
  BLOCKER shape the skill defines. Leave as is.

### `tests/bridges/hooks/payloads/stop.test.ts`

- **REFUTED** — *Compile-time-only type-shape assertions sit outside any
  `test()`*. Same evidence as above; `tests/bridges/hooks/index.test.ts:29-72`
  settles it.

- **UNDERSTATED** — *Redundant `Object.hasOwn` checks add nothing beyond the
  preceding `deepStrictEqual`*. The claim is right and I verified the mechanism
  the first pass asserted without testing: `assert.deepStrictEqual` rejects an
  extra own key even when its value is `undefined`, so both `Object.hasOwn(…) ===
  false` lines are unfailable. Understated in reach — the identical vacuous
  shape appears 3 more times in `stop-failure.test.ts:87,115,143` and, in the
  `CLOSED_VOCAB.has(…)` variant, 31 more times in the same file, none of which
  the first pass flagged. One defect class, 36 sites, one deletion rule.

### `tests/bridges/hooks/payloads/session-end.test.ts`

- **CONFIRMED** — *5 reason-enumeration cases belong in one data-driven `for`
  loop*. The five cases differ only in the `reason` literal, which is exactly the
  closed-vocabulary enumeration the rule targets, and the sub-instruction to drop
  the redundant `strictEqual(payload.session_id, context.sessionId)` lines at
  34-36 is correct (the `deepStrictEqual` above them already fixes those fields).
  Preserve the three `targetSessionFile` fixtures through the refactor — they are
  the area's only optional-field-suppression proof and the template for the
  session-start gap above.

### `tests/bridges/hooks/payloads/session-start.test.ts`

- **CONFIRMED** — *5 source-enumeration cases belong in one data-driven `for`
  loop*. Same shape, same fix.

### `tests/bridges/hooks/payloads/user-prompt-submit.test.ts`

- **OVERSTATED** — *4 near-identical cases are a lower-priority data-driven-loop
  candidate*. The data-driven rule targets rows enumerating a closed vocabulary
  where only a label changes; these four exercise four distinct string classes
  (ASCII, embedded newlines, empty, multi-byte/astral), which is a coverage
  argument for keeping them named and separate. The first pass itself concedes
  "the duplication is milder". More importantly this is the **strongest** file in
  the area — the only one pinning key order (see the drift WARNING) — so a
  refactor here has negative expected value. Downgrade to a note: if the
  `expectedKeys` repetition is consolidated at all, it must be a function
  returning a fresh array, not a module-scope `const`.

### `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts`

- **CONFIRMED** — *Method doc uses imperative mood instead of third-person verb
  phrase* (`:109`). `typescript-google-style-review/SKILL.md:128` requires it,
  and `classifyStopFailure` is the only function-level JSDoc in the area (the
  type-level docs at `stop.ts:23` and `stop-failure.ts:26` are noun phrases,
  which is correct for a type). One-word fix; fold into the repo-wide JSDoc
  verb-phrase item rather than tracking separately.

## Still clean after attack

These held up against named mutations. Do not spend fixing time here.

- **`extensions/.../post-tool-use.ts` + `tests/.../post-tool-use.test.ts`** —
  survives: swapping `tool_input` and `tool_response` (both typed `unknown`, so
  it compiles; case at `:11` has distinct values and fails); dropping
  `mapPiToClaudeToolName` (`"bash"` → `"Bash"` at `:37` fails); changing
  `hook_event_name`; substituting `ctx.cwd` for `ctx.transcriptPath`. The
  `assert.strictEqual(payload.tool_input, toolInput)` /
  `payload.tool_response, toolResponse)` pair at `:50-51` additionally pins
  **reference identity**, so a defensive `structuredClone` added to the
  translator fails the case — a genuinely strong assertion, and the right one
  given "propagated verbatim" is the documented contract. Same for
  `post-tool-use-failure.ts`/`.test.ts` (`:46-47`) and `pre-tool-use.ts`/`.test.ts`
  (`:45`, `:84`).

- **`stop-failure.ts` classifier row ordering** — fully pinned. I swapped every
  adjacent pair of the 7 `CLASSIFIER_TABLE` rows; **every** swap turns at least
  one case red. The seven "classifies X before every later error indicator"
  cases (`:150`, `:166`, `:182`, `:197`, `:211`, `:225`, `:239`) do real work and
  should survive any consolidation intact.

- **`stop-failure.ts` HTTP-status word boundaries** — the 13 negative cases at
  `:423-589` genuinely kill the mutation of dropping `\b` from any status regex:
  "retry after 5000ms"-style aliasing is covered from both directions
  (`:563` trailing, `:577` leading), and each in-range gap (402, 404, 428, 430,
  499, 501, 505, 528) has its own case. This half of the classifier is
  exemplary; the substring half is not.

- **`stop.ts`/`stop.test.ts` envelope** — survives dropping either
  `last_assistant_message` or `stop_hook_active`, inverting the boolean (`:32`
  true vs `:59` false), and substituting any context field for another. The
  `deepStrictEqual(event, expectedEvent)` / `(context, expectedContext)` pairs at
  `:95-96` and `:135-136` also prove non-mutation of the inputs.

- **`session-end.ts` optional-field suppression** — adding
  `target_session_file: event.targetSessionFile` to the translator fails three
  cases (`:64`, `:90`, `:116`). This is the one place in the area where the
  "must not forward" contract is actually proven.

- **`pre-compact.test.ts` `customInstructions` suppression** — the fixture at
  `:42` sets it and the expected payload at `:52` omits it, so a conditional
  forward of that field is caught. (The `trigger` defect above is orthogonal.)

- **Hermeticity, doubles, and testable design across all 10 pairs** — no
  filesystem, no network, no clock, no `process.env`, no globals, no doubles of
  any kind, no `t.mock`, no `as`/`!`, no `any`. All ten translators are pure
  `(event, ctx) => object`. The first pass's characterization of the production
  design as "about as testable as this codebase gets" is correct and I confirm
  it independently. Every case has correctly ordered `// arrange` / `// act` /
  `// assert` comments, `test()` not `it()`, no committed `only`/`skip`/`todo`,
  and no placeholder names — I checked all 47 cases.

## Not covered

- `bridges/hooks/dispatch-exec.ts` and `bridges/hooks/async-rewake/registry.ts`
  are outside my area; I read only their translator tables and
  `REQUIRED_EVENT_FIELDS`, and report the drift below rather than claiming it.
  Same for `domain/components/hook-events.ts` (read only lines 190-240) and
  `bridges/hooks/spawn-helpers.ts` (read only line 67).
- I did not run the suite or measure coverage — the brief forbids it. Every
  coverage statement above is either a source-reading claim or, for the
  classifier, the output of a standalone reproduction under `/tmp` that touched
  nothing in the repo.
- I did not verify whether `SessionCompactEvent.reason` existed at the peer-dep
  **floor** (`>=0.80.5`); I verified only that it exists in the installed
  `^0.84.2`, which is what the tests type-check against and what CI runs.

## Meta-findings impact

### New cross-cutting evidence

**1. Stale peer-dep beliefs frozen into doc comments AND into tests, at least
three layers deep.** The `PreCompact`/`PostCompact` `trigger` defect is not a
local bug; it is one belief ("Pi has no compaction trigger field") replicated
into (a) two production doc comments, (b) two production implementations, (c)
four test fixtures that pin the stale value, (d) `NON_TOOL_EVENT_CLOSED_SETS` in
`domain/components/hook-events.ts`, which gives `PreCompact`/`PostCompact`
**empty** admissible-matcher sets so a plugin's `trigger: "manual"` matcher is
refused as unsupportable (TOOL-02(c)), and (e) an architecture lock in
`tests/architecture/hooks-supportability.test.ts` that pins those empty sets.
The upstream `.d.ts` has said `reason: "manual" | "threshold" | "overflow"` with
an explanatory doc comment for some time.

This is a defect class no partitioned reviewer can see, because each layer looks
internally consistent and each cites the layer below it as authority. **Areas to
check for the same shape:** `domain-components-hooks.md` (the closed-set
tables), `architecture-hooks-gates.md` (the locks that ratify them),
`bridges-hooks-adapters-state.md` and `bridges-hooks-dispatch.md` (any comment
asserting a Pi event lacks a field). The general check is cheap and should be
run repo-wide: **grep production comments for "Pi does not expose", "no Pi
field", "has no", "not yet wired", and diff each claim against
`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`.**
The repo already has an `analyze-upstream-releases` skill for exactly this and it
evidently has not been run against the hooks bridge.

**2. A new "gate that does not gate", found only by reading all 10 translators
together.** `bridges/hooks/dispatch-exec.ts:228-239`'s `REQUIRED_EVENT_FIELDS`
is the WR-03 probe's record of which `event` fields each translator reads. Six of
its ten rows understate the truth:

| Event | translator actually reads | `REQUIRED_EVENT_FIELDS` |
| --- | --- | --- |
| `SessionStart` | `reason` | `[]` |
| `PostToolUse` | `toolName`, `input`, **`content`** | `["toolName","input"]` |
| `PostToolUseFailure` | `toolName`, `input`, **`content`** | `["toolName","input"]` |
| `SessionEnd` | `reason` | `[]` |
| `Stop` | `last_assistant_message`, `stop_hook_active` | `[]` |
| `StopFailure` | `error`, `error_details`, `last_assistant_message` | `[]` |

The probe exists to convert "wrong event shape reached the wrong translator" from
a silent partial envelope into a debug line; for six events it is blind to
exactly the fields that would go missing. And the paired test
(`tests/bridges/hooks/dispatch-exec.test.ts:824-860`) asserts
`missingFieldLines.length === translatorCase.requiredFields.length` against a
`TRANSLATOR_CASES` table that mirrors the production table — so it ratifies the
drift rather than catching it. This belongs to `bridges-hooks-dispatch.md`; the
authoritative source for each row is the ten translator bodies in my area. It is
a sixth instance for the "Gates that do not gate" section.

**3. The 10-entry translator dispatch table is duplicated verbatim in two
production modules** — `dispatch-exec.ts:113-123` and
`async-rewake/registry.ts:102-114`. A single mis-keyed entry in one (e.g.
`PostToolUse: translatePostToolUseFailure`) diverges the sync and async paths,
and the only observable difference is the `hook_event_name` literal. Neither
table is derived from the other. Owners: `bridges-hooks-dispatch.md` and
`bridges-hooks-async-rewake.md` — worth one cross-file test asserting the two
records are key-for-key identical, or one shared module.

**4. A propagatable technique the sweep should name.** For any module that owns a
lookup/classification **table**, the useful review question is not "are the cases
duplicated" but "delete each table row — does a case fail?" Executing that on
`stop-failure.ts` took one throwaway script and found 9 dead rows under 31 cases
that read as thorough. Candidate tables elsewhere: the
`CLAUDE_TO_PI_TOOL_NAMES` / `PI_TO_CLAUDE_TOOL_NAMES` maps in
`domain/components/hook-tool-names.ts`, `shared/git-failure-classifiers.ts`, and
`shared/probe-classifiers.ts` — all classifier tables, all likely reviewed for
case *shape* rather than row *coverage*.

### Corrections to META-FINDINGS.md

- **"Clean verdicts are not reliable" — confirmed, and stronger than stated for
  this area.** META-FINDINGS says a clean verdict is "an unfalsified negative".
  Here it was worse: two files clean on *both* sides
  (`post-compact.ts`/`.test.ts`, `pre-compact.ts`/`.test.ts`) hold the area's
  only BLOCKER, and the test cases that pin it are the ones that look most
  careful (an explicit empty-context edge case). Attention did not run out — it
  read the doc comment and believed it. **Reading the production comment is not
  reading the contract; the peer-dep `.d.ts` is.**

- **Master tally, "no BLOCKER" areas.** `bridges-hooks-payloads.md` is recorded
  with 0 BLOCKER. It should be 2 (or 3 if the two compact translators are
  counted separately). Any planning that treated this area as done should be
  reopened.

- **"Gates that do not gate: five independent instances."** Make it six — add
  `REQUIRED_EVENT_FIELDS` (evidence above). The section's recommendation ("audit
  every architectural gate against what it actually scans") should be widened
  slightly: this gate scans the right file, it just carries a stale table, and
  its test mirrors the table instead of deriving it. The failure mode is
  *duplicated knowledge*, not a wrong path.

### Confirmations

- **"Sibling drift is the dominant shape."** Confirmed from a second angle, and
  in this area it runs in *both* directions — the drifting file is sometimes the
  better one. `user-prompt-submit.test.ts` is the only file of ten pinning key
  order, which is a real wire contract (`spawn-helpers.ts:67`); the fix is to
  propagate the outlier to nine siblings, not to normalize it away. The first
  pass's instinct was the opposite (it filed the outlier as a refactor
  candidate). Worth adding to the section: **before normalizing a divergent file,
  check which side is right.**

- **"In almost every case the correct form already exists in-repo."** Confirmed
  three times over inside one 10-file directory: `session-end.test.ts:74` is the
  template for the missing optional-field-suppression proofs;
  `stop.test.ts:43-50` is the template for the missing `satisfies` envelope pins;
  `stop-failure.test.ts:33-47` is the template for the missing
  `@ts-expect-error` negative on `FailureStopReason`. All three fixes are
  copy-the-neighbour.

- **"Don't test what a gate already guards"** (the repo's own recorded lesson).
  Independently confirmed: the 31 `CLOSED_VOCAB.has(...)` runtime assertions
  duplicate a guarantee `hook-events.ts:195-198` states is already enforced at
  compile time by `classifyStopFailure`'s return type. 31 lines of maintenance,
  zero discrimination.
