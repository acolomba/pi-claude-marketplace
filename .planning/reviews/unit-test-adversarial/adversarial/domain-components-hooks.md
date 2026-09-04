# Domain — hooks component schema, matcher, partition — adversarial re-review

**Scope:** `extensions/pi-claude-marketplace/domain/components/hooks/{matcher,partition,schema}.ts`, their paired tests under `tests/domain/components/hooks/`, and the cross-check file `tests/architecture/no-hooks-strict-additional-properties.test.ts`
**First-pass file:** `unit-test-findings/domain-components-hooks.md`
**Clean files attacked:** 0 listed (both `### Clean files` sections say "None") — 7 files re-attacked instead, targeting the first pass's *inline* clean claims: "Otherwise this file is strong" (partition.test.ts) and "no behavioral defect was found in the production logic itself" (all three modules). Both claims are now falsified.
**Existing findings graded:** 17

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 2 |
| New WARNING (missed by first pass) | 9 |
| Existing CONFIRMED | 15 |
| Existing UNDERSTATED | 0 |
| Existing OVERSTATED | 2 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

Every mutation and every runtime claim below was executed, not reasoned about:
`node --input-type=module` against the real modules for behavior, one
`npx tsc --ignoreConfig --noEmit` probe on a scratch file for the type claim, and a
19,531-input brute force for the `isMcpLiteral` guard equivalences. No repo file was
modified and no gate was run.

## New findings — from attacking the "otherwise strong" claims

### `tests/domain/components/hooks/partition.test.ts`

- **[BLOCKER] Group-level and handler-level field passthrough is never asserted** — all 11 cases, representatively `lines 18–42`, `lines 201–234`, `lines 272–311`
  Every `config` in this file uses `{matcher?, hooks}` groups holding `{type, command}`
  handlers and nothing else. Two mutations therefore survive all 11 cases:
  1. `partition.ts:80` — replace `supportedHandlers.push(handler)` with
     `supportedHandlers.push({ type: handler.type, command: handler.command })`. Drops
     `if`, `timeout`, `asyncRewake`, `rewakeMessage`, `rewakeSummary`, `args`, `shell`
     and every unknown handler field.
  2. `partition.ts:86` — replace `{ ...group, hooks: supportedHandlers }` with a rebuild
     that copies only `matcher` (when defined) and `hooks`. Drops `statusMessage`,
     `once`, `async`, `shell`, `args` and every unknown group field. (Note the naive
     `{ matcher: group.matcher, hooks }` form is *caught*, because `deepStrictEqual`
     distinguishes an own `matcher: undefined` key from an absent one — verified. The
     conditional-copy form is not.)

  Both are load-bearing, not hypothetical. `partition.supported` is returned verbatim as
  `parseHooksConfig(...).value` (`domain/components/hooks.ts:288`) and written verbatim to
  `<hooksDir>/<plugin>/hooks.json` by `writeHookConfig({ hooksValue: parsed.value })`
  (`orchestrators/plugin/install.ts:1096`); the dispatcher then reads `args`/`shell` at
  `bridges/hooks/spawn-helpers.ts:36,45`, `timeout` at `dispatch-exec.ts:301`,
  `asyncRewake` at `dispatch-exec.ts:169`, and `rewakeMessage`/`rewakeSummary` at
  `async-rewake/registry.ts:310–311` — all off exactly the handler objects mutation 1
  would replace. Confirmed at runtime: `partitionHooks` today preserves
  `statusMessage`, `once`, `futureGroupField`, `if`, `timeout`, `asyncRewake`, and
  `futureHandlerField` verbatim, and no case in the entire unit suite pins the group half
  (grep for `statusMessage` across `tests/` returns only `schema.test.ts` and an unrelated
  `platform/git.test.ts`). The handler half is pinned only for `if`, and only by another
  module's test (`tests/domain/components/hooks.test.ts:146`).

  Fix: add one case, `"carries group-level and handler-level passthrough fields into the
  supported subset"`, with a single `PreToolUse` group carrying `matcher: "Edit"`,
  `statusMessage: "running"`, `once: true`, `async: false`, `shell: "/bin/bash"`,
  `args: ["-c", "true"]`, `futureGroupField: true`, and two handlers — one
  `{ type: "command", command: "keep", if: "tool == 'Edit'", timeout: 30,
  asyncRewake: true, rewakeMessage: 42, rewakeSummary: null, futureHandlerField: 1 }` and
  one `{ type: "http", command: "drop" }` — then `assert.deepStrictEqual` the whole
  partition against a literal repeating every one of those fields on the surviving group
  and handler, plus the single expected handler drop. This config cannot carry
  `satisfies HooksConfig` today; see the `schema.ts` production finding below.

- **[WARNING] The `group.matcher ?? ""` default is never pinned in a drop record** — `partition.ts:95`
  Mutating the default to `?? "*"` leaves all 11 cases green. The only matcher-less groups
  in the file (`line 24`, `line 117`) are ones that are *kept*, where the defaulted value
  never reaches the output; the only case in the suite that pins `matcher: ""` on a drop
  record is `tests/domain/components/hooks.test.ts:162` — again another module's test.
  Fix: in `"orders rejected events, handlers, and groups by their input positions"`
  (`line 272`), add a fourth `PreToolUse` entry `{ hooks: [{ type: "http", command: "x" }] }`
  and assert the drop record `{ kind: "handler", event: "PreToolUse", matcher: "",
  handlerType: "http" }`.

- **[WARNING] `PostToolUseFailure` — the third tool event — appears in no case**
  Not a distinct branch of `partition.ts` (it shares `TOOL_EVENT_MEMBERS.has`), so no
  mutation of `partition.ts` alone survives on account of it; recorded because removing it
  from the `TOOL_EVENTS` tuple in `hook-events.ts:75` makes `partitionHooks` throw a
  `TypeError` (`NON_TOOL_EVENT_CLOSED_SETS["PostToolUseFailure"]` is `undefined`, then
  `.has(...)`), and nothing in this pair notices. `tests/domain/components/hook-events.test.ts:56`
  does pin the tuple, so the gap is covered in-suite; adding one `PostToolUseFailure` row
  to the tool-matcher case would make the pair self-sufficient.

- **[WARNING] `DroppedHook` and `HooksPartition` have no compile-time case — sibling drift**
  `partition.test.ts` and `matcher.test.ts` carry zero `satisfies` / `@ts-expect-error`
  blocks, while the sibling in the same directory, `schema.test.ts:10–30`, models exactly
  the right pattern for its three type exports. Per the skill's type-only pattern, the
  paired test owns the type surface. Fix: copy the `schema.test.ts:10–30` block shape into
  both files — for `partition.test.ts`, `satisfies` positives for each of `DroppedHook`'s
  three arms and for `HooksPartition`, plus `@ts-expect-error` negatives for a `cond` value
  outside the four-member union and for a `kind: "group"` record missing `event`.

### `tests/domain/components/hooks/matcher.test.ts`

- **[BLOCKER] "first unmapped token" is never proven — a last-wins implementation passes every case** — `test("reports the first unmapped token after a mapped token")`, `lines 85–96`, and the loop at `lines 98–119`
  No input anywhere in the file carries *two* unmapped tokens. The case whose title names
  the property uses `"Edit|mcp__server__tool|Write"`, which has exactly one. So mutating
  `matcher.ts:52` to drop the early `return` — record the token and keep scanning, returning
  the *last* unmapped token after the loop — leaves all 33 cases green. Verified:
  `parseMatcher("Foo|Bar")` returns `{ kind: "unmapped", token: "Foo" }` and
  `parseMatcher("Edit|MultiEdit|WebFetch")` returns `token: "MultiEdit"` — neither shape is
  exercised. The same mutation also silently changes what `piTools` accumulates before the
  return, which no case observes either.
  Fix: add `test("reports the first of two unmapped tokens")` with input
  `"MultiEdit|WebFetch"` asserting `assert.deepStrictEqual(matcher, { kind: "unmapped",
  token: "MultiEdit" })`.

- **[WARNING] Two members of `SAFE_MATCHER_CHARS` never discriminate** — `matcher.ts:3`
  Deleting `-` or `0-9` from `/^[A-Za-z0-9_|-]+$/` leaves all 33 cases green. Every test
  input containing a hyphen or a digit is either caught by `isMcpLiteral` first
  (`"mcp__my-server-1__some_tool"`, `line 71`) or already fails the class on a different
  character (`"Write[0]"`, `line 125`). The mutation is observable in production:
  `parseMatcher("my-tool")` and `parseMatcher("Tool1")` return `{ kind: "unmapped" }` today
  and would return `{ kind: "regex" }` after it — which flips the `cond` a user sees on a
  dropped hook group from `unmapped-tool` to `regex` (`partition.ts:37,41`).
  Fix: add `"my-tool"` and `"Tool1"` rows to the unmapped-token loop at `line 98`.

- **[WARNING] The `lastIndexOf` separator choice is unobservable to every case** — `matcher.ts:19`
  Mutating `body.lastIndexOf("__")` to `body.indexOf("__")` leaves all 10 MCP-shaped
  inputs in the file green (checked one by one; all agree). A brute force over 19,531
  bodies found 174 inputs where the two disagree — the shortest realistic one is
  `"mcp__server___"`, which is `{ kind: "unmapped", token: "mcp__server___" }` today and
  becomes `{ kind: "mcp-literal" }` under `indexOf`.
  Fix: add `"mcp__server___"` to the unmapped-token loop at `line 98`. This is the case the
  first pass's "document the `lastIndexOf` choice" WARNING actually needs behind it.

- **[WARNING] `ParsedMatcher` has no compile-time case** — same sibling-drift finding as the
  `partition.test.ts` entry above; fix them together.

### `tests/domain/components/hooks/schema.test.ts`

- **[WARNING] Three schema constraints survive deletion or narrowing** — `lines 98–139`
  1. Deleting the *unconditional* `command: { type: "string" }` at `schema.ts:25` leaves all
     18 rows green: the `then` branch at `schema.ts:40` re-declares it, and the only row
     with a non-string `command` (`line 120`) uses `type: "command"`. The unconditional
     constraint is live today — `HOOKS_VALIDATOR.Check({PreToolUse:[{hooks:[{type:"future",
     command:1}]}]})` is `false` — and nothing pins it. Identically for the unconditional
     `if: { type: "string" }` at `schema.ts:26`: the only `if` reject row (`line 124`) also
     uses `type: "command"`, and `{type:"future", if:1}` is rejected today but untested.
  2. Narrowing `timeout: {}` (`schema.ts:28`) to `{ type: "string" }` survives — the
     kitchen sink's `timeout: "30"` (`line 75`) is the only `timeout` value in the suite,
     yet real configs carry numbers (`... timeout: 30` validates `true` today, and
     `dispatch-exec.ts:301` reads the raw field).
  3. Widening `hooks: Type.Array(HOOK_HANDLER_SCHEMA)` (`schema.ts:46`) to also accept a
     string survives — no row supplies `hooks: "nope"` (rejected today) or `hooks: [1]`
     (rejected today).
  Fix: add three reject rows — `"an unknown handler type with a non-string command"`,
  `"an unknown handler type with a non-string if condition"`, `"a group whose hooks field
  is not an array"` — and one accept row, `"a command handler with a numeric timeout"`.

- **[WARNING] `HOOKS_CONFIG_SCHEMA` has no owning case in its paired test** — `schema.ts:57`
  It is a runtime export of `schema.ts`, and its only assertions live in
  `tests/architecture/hooks-foundation.test.ts:143` (the `additionalProperties: false`
  structural walk) and `:152` (the HOOK-03 leniency `Check` block) — a different module's
  test, which also duplicates leniency coverage that `schema.test.ts`'s kitchen-sink row
  already provides at handler and top level. Per the pairing rule ("no source module tested
  from another module's test"), both cases belong in
  `tests/domain/components/hooks/schema.test.ts`; the architecture file should keep only
  what is genuinely architectural.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `matcher.ts` | `parseMatcher` | `matcher.test.ts:8–160` (33 cases) | owned — gaps in the three matcher findings above |
| `matcher.ts` | `ParsedMatcher` (type) | — | **NO CASE** |
| `partition.ts` | `partitionHooks` | `partition.test.ts:7–311` (11 cases) | owned — gaps in the passthrough and matcher-default findings |
| `partition.ts` | `DroppedHook` (type) | — | **NO CASE** in the pair; compile-time pins exist only in production (`domain/resolver.ts:123,157`) |
| `partition.ts` | `HooksPartition` (type) | — | **NO CASE**; single consumer is the annotation at `domain/components/hooks.ts:271` |
| `schema.ts` | `HOOKS_VALIDATOR` | `schema.test.ts:87,130` (18 rows) | owned, boolean-only (see the first pass's BLOCKER) |
| `schema.ts` | `HookHandlerEntry` (type) | `schema.test.ts:10,11,22,24,26` | owned |
| `schema.ts` | `HooksConfig` (type) | `schema.test.ts:12–19,28,30` | owned |
| `schema.ts` | `HOOKS_CONFIG_SCHEMA` | `tests/architecture/hooks-foundation.test.ts:143,152` | **OWNED BY ANOTHER MODULE'S TEST** |

There is no `index.ts` under `domain/components/hooks/`, so no barrel pairing is owed.
Each of the three test files imports exactly one production module and nothing else —
worth recording as a positive: no case in this area exercises a module other than its pair.

## Branch census

**`matcher.ts`** — every branch is reached by at least one case. Classifications for the
ones that do not *discriminate*:

- `raw === ""` / `raw === "*"` / `isMcpLiteral` true / `!SAFE_MATCHER_CHARS.test` /
  `token.length === 0` / `piTool === undefined` / loop-completes — **reachable and
  discriminating** (each has a mutation the cases catch; see "Still clean").
- `separatorIndex <= 0` (`matcher.ts:20`), the `=== 0` half — **reachable but
  non-discriminating (category b)**. Brute-forced 19,531 bodies over `{a,_,!,-,1}`:
  collapsing the whole guard to `separatorIndex < 0` produces **zero** behavior differences,
  because `MCP_SEGMENT`'s `+` quantifier already rejects the empty head. Same for the
  `separatorIndex >= body.length - 2` half, via the empty tail. Only the `-1` (no separator)
  case is load-bearing, and it *is* covered (`"mcp__server"`, `line 104`). If the first
  pass's requested comment is written, it must say this rather than invent a rationale.
- `body.lastIndexOf("__")` — **reachable, discriminating, untested** (see finding above).

**`partition.ts`** — every branch reached. Untested *contracts* rather than branches:

- Group and handler field passthrough (`lines 80, 86`) — **reachable and untested**; the
  BLOCKER above.
- `group.matcher ?? ""` reaching a drop record (`line 95`) — **reachable and untested**.
- The `event as keyof typeof NON_TOOL_EVENT_CLOSED_SETS` cast (`line 55`) — **compiler-forced
  and not removable (category c)**: the narrowing that makes it safe lives in
  `hook-events.ts:285`'s `satisfies Readonly<Record<Exclude<NonToolEvent,
  "UserPromptSubmit" | "Stop">, ReadonlySet<string>>>` pin, one file away. The first pass's
  read of this is accurate.
- Prototype-key events — **probed and safe, untested**: `partitionHooks(JSON.parse('{"__proto__":[…]}'))`
  drops it as `{ kind: "event", event: "__proto__" }` and never reaches
  `supported[event] = …`; `Object.prototype` stays clean. Recorded so nobody spends time
  re-deriving it.

**`schema.ts`** — no control flow; the branch surface is the validator's accept/reject
decision matrix. Untested constraints are enumerated in the schema finding above. The
`if`/`then` conditional (`schema.ts:32–41`) *is* discriminated, by the pairing of
`"an unknown handler type without a command"` (accept, `line 48`) against
`"a command handler without a command"` (reject, `line 116`) — the strongest pair in the
file.

## Grading of first-pass findings

### `tests/domain/components/hooks/matcher.test.ts`

- **OVERSTATED** — *Order claims are not verified — `assert.deepStrictEqual` ignores `Set` order*
  (recorded BLOCKER). The order-blindness is real and I reproduced it
  (`deepStrictEqual(new Set(["read","write","grep"]), new Set(["grep","write","read"]))`
  passes). But **production promises no order**: the sole consumer of `piTools` anywhere in
  the tree is `matcher.piTools.has(toolName as never)` at `bridges/hooks/dispatch.ts:114`, a
  membership test — grep for `piTools` returns only the declaration, the constructor, that
  one `.has`, and test fixtures. So an order-scrambling implementation is not a *wrong*
  implementation, and the skill's BLOCKER bar ("a case a wrong implementation would pass")
  is not met. **Correct severity: WARNING, and the prescribed fix is wrong** — adding
  `assert.deepStrictEqual([...piTools], ["write","read","grep"])` would pin a property the
  contract does not carry and would red-fail a legitimate refactor. Fix instead by making
  the titles honest: `"maps every tool token in a pipe-OR compound"` (`line 42`) and
  `"maps repeated tool tokens to a single set member"` (`line 55`). Note also that the
  dedup case is near-vacuous as written: `new Set` dedupes by construction, so the case can
  only fail if the return type stops being a `Set`.
- **CONFIRMED** — *Dead conditional inside a data-driven loop* (`line 116`). None of the
  seven rows contains `"|"`; the true branch never executes.
- **CONFIRMED** — *One test performs two independent act/assert pairs* (`lines 148–160`).
  Two `parseMatcher` calls with no dependency between them.

### `tests/domain/components/hooks/partition.test.ts`

- **CONFIRMED** — *`HooksConfig`-shaped literals are not `satisfies`-checked*. All 11
  literals in this file can take `satisfies HooksConfig` today (they use only `matcher`,
  `hooks`, `type`, `command`). Caveat for the fixing pass: the new passthrough case this
  review adds **cannot**, because of the `schema.ts` type divergence below — resolve that
  production finding first, or the two fixes collide.

### `tests/domain/components/hooks/schema.test.ts`

- **CONFIRMED** — *"rejects" loop only asserts the boolean, never the structured validator
  error* (BLOCKER). The severity fits. One thing the first pass understates in passing:
  five of the thirteen rows (`null`, `[]`, `"invalid"`, `1`, `true`) are top-level type
  rejections that collapse to the same root-level error, so asserting `instancePath` would
  also expose how much of the loop is duplicate coverage.
- **OVERSTATED** — *`HooksConfig`-shaped literals are not `satisfies`-checked* (`lines 33–96`
  and `98–139`). **The rejects-loop half is refuted outright**: those rows are deliberately
  invalid, so `config: null satisfies HooksConfig` is a compile error by design — that is
  the point of the rows, and they should instead be typed `{ role: string; config: unknown }`
  so the compiler does not widen them into a union. **The accepts-loop half is only partly
  executable**: the kitchen-sink row (`lines 53–85`) also fails, verified with
  `tsc --noEmit` — `error TS2353: Object literal may only specify known properties, and
  'futureGroupField' does not exist in type '{ statusMessage?: unknown; …; hooks:
  HookHandlerEntry[]; }'`. Only four of the five accept rows can take the annotation as the
  types stand.
- **CONFIRMED** — *"kitchen sink" accept case reduces failure diagnosis* (`lines 53–85`), and
  the first pass was right to mark it optional. Worth noting that splitting it also removes
  the `satisfies` blocker for the sub-rows that carry no group-level extras.

### `tests/architecture/no-hooks-strict-additional-properties.test.ts`

- **CONFIRMED** — *Textual defense-in-depth gate now scans a file that no longer holds the
  schema literals*. Independently verified: `grep -n "Type\.\|additionalProperties"` over
  `domain/components/hooks.ts` returns only two comment lines (`:10`, `:16`) and no schema
  literal at all, so the regex at `line 49` cannot fire on anything the gate exists to
  protect. Ownership note: this file is not part of this area's pairing, and
  `META-FINDINGS.md` already carries it under "Gates that do not gate" (#2) with an open
  operator decision on severity; the architecture area's file should own the fix. One detail
  to carry into that fix: `stripComments` (`line 37`) strips only *full-line* `//` comments,
  so if the gate is repointed at `schema.ts`, a future trailing comment there could
  false-positive.

### `extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts`

- **CONFIRMED** — *Exported type and JSDoc gaps* (`ParsedMatcher` undocumented; "Parse" →
  "Parses" at `line 30`).
- **CONFIRMED, with a substantive amendment** — *`isMcpLiteral`'s segment-boundary logic is
  undocumented*. The comment is owed, but the content the first pass implies is wrong in one
  direction and incomplete in the other: two thirds of the guard at `line 20` are subsumed by
  `MCP_SEGMENT` (0 differences across 19,531 brute-forced bodies when the guard is reduced to
  `separatorIndex < 0`), while the `lastIndexOf` choice *is* observable (174 differing inputs;
  `"mcp__server___"` is the shortest) and untested. Write the comment to say what the guard
  actually decides, and add the missing case (new WARNING above).
- **CONFIRMED** — *Unexplained `as` cast* (`line 50`).

### `extensions/pi-claude-marketplace/domain/components/hooks/partition.ts`

- **CONFIRMED** — *Exported types and JSDoc gaps* (`DroppedHook` at `line 14`,
  `HooksPartition` at `line 24`, "Separate" → "Separates" at `line 112`).
- **CONFIRMED** — *Unexplained `as` cast bypassing a cross-file completeness guarantee*
  (`line 55`). The first pass's account of the invariant is accurate; I verified the pin at
  `hook-events.ts:285–287`.
- **CONFIRMED, with corrected locations** — *Repeated inline type `HooksConfig[string][number]`*.
  The cited lines are partly wrong: `HooksConfig[string][number]` appears twice, at `lines 74`
  and `76`; the *other* repeated form is `HooksConfig[string]`, four times, at `lines 91, 93,
  94, 114`. Extract both — `type HookGroup = HooksConfig[string][number];` and
  `type HookGroups = HooksConfig[string];` — and use them at all six sites.

### `extensions/pi-claude-marketplace/domain/components/hooks/schema.ts`

- **CONFIRMED** — *`HookHandlerEntry` interface is undocumented, including an unexplained
  asymmetric `readonly`* (`lines 4–18`, `line 7`). Adding evidence for the fixing pass:
  nothing in the tree reassigns any field of a `HookHandlerEntry` — the bridge holds them
  as `readonly handlerDecl: HookHandlerEntry` (`bridges/hooks/routing-state.ts:78`) and only
  reads. The asymmetry is arbitrary; make every field `readonly` or none, and say which in
  the doc comment.
- **CONFIRMED** — *`Type.Unsafe` raw JSON-schema conditional is undocumented* (`lines 20–42`).
- **CONFIRMED** — *HOOK-03 lenient-stance rationale is documented only in the sibling
  `hooks.ts`* (`lines 20–57`). This is the same root cause as the inert architecture gate:
  the split moved the literals and left every guard and every word of rationale pointing at
  the old address.

## New production findings

### `extensions/pi-claude-marketplace/domain/components/hooks/schema.ts`

- **[WARNING] `HOOK_ENTRY_SCHEMA`'s static type contradicts HOOK-03 at the group level** — `lines 44–52`
  The runtime schema accepts unknown group fields (that is the whole HOOK-03 stance, and
  `tests/architecture/hooks-foundation.test.ts:169` proves it), but the *static* type does
  not. Verified with `tsc --noEmit` on a scratch file: `{FutureEvent:[{matcher:"Edit",
  futureGroupField:true, hooks:[…]}]} satisfies HooksConfig` fails with TS2353, while
  `HOOKS_VALIDATOR.Check` on the identical value returns `true`. The handler level does not
  have this problem — and the fix already exists in the same file: `HookHandlerEntry`
  (`lines 4–18`) is a hand-written interface with `[key: string]: unknown` fed through
  `Type.Unsafe<HookHandlerEntry>`. Fix: declare a `HookGroupEntry` interface with the same
  index signature and build `HOOK_ENTRY_SCHEMA` as `Type.Unsafe<HookGroupEntry>({...})`,
  mirroring `HOOK_HANDLER_SCHEMA`. This is a prerequisite for the `satisfies HooksConfig`
  work the first pass asked for, and for the new passthrough case.

### `extensions/pi-claude-marketplace/domain/components/hooks/partition.ts`

- **[WARNING] `partition.supported` aliases the caller's handler objects but clones the group
  objects — asymmetric, undocumented, unpinned** — `lines 80, 86`
  `supportedHandlers.push(handler)` stores the caller's object by reference, while
  `{ ...group, hooks: supportedHandlers }` builds a fresh group. So writing to
  `partition.supported.PreToolUse[0].hooks[0].command` writes through to the input config,
  but writing to `.matcher` does not. Nothing states this, and it matters: those exact
  handler objects are cached for the process lifetime in the routing table
  (`bridges/hooks/routing-state.ts:78`) after being written to disk. Fix: state the
  shallow-share contract in the `HooksPartition` doc comment the first pass already asks for,
  or clone handlers as well and say so.

## Still clean after attack

These are the mutations the existing cases genuinely catch. Do not spend fixing time here.

- `tests/domain/components/hooks/partition.test.ts` — **the ordering contract is properly
  proven.** `"orders rejected events, handlers, and groups by their input positions"`
  (`lines 272–311`) compares the whole five-element `dropped` array against a literal, so it
  catches: reversing `Object.entries` iteration; emitting group drops before handler drops;
  swapping the same-typed `event` and `matcher` fields on a group record; pinning
  `handlerType` to a constant (both `"http"` and `"prompt"` appear); and swapping
  `cond: "regex"` with `"unmapped-tool"` (caught separately at `lines 63–69`). Every case in
  the file compares the whole `HooksPartition` with `deepStrictEqual` against a hand-written
  literal — the correct form, and the reason the *only* surviving mutations are about fields
  no case supplies.
- `tests/domain/components/hooks/partition.test.ts` — the empty-vs-omitted distinction holds:
  mutating `if (supportedGroups.length > 0)` (`line 125`) to assign unconditionally produces
  `{ PreToolUse: [] }` where `{}` is expected, and `"drops a group when every handler is
  unsupported"` (`line 174`) fails.
- `tests/domain/components/hooks/matcher.test.ts` — the *check order* in `parseMatcher` is
  pinned: moving the `SAFE_MATCHER_CHARS` test ahead of `isMcpLiteral` red-fails
  `"keeps the MCP literal mcp__my-server-1__some_tool"` (`line 74`). Dropping `|` or `_` from
  the character class also fails (`line 46` and `line 103` respectively). The
  `token.length === 0` → `regex` arm is covered four independent ways (`"|"`, `"Edit|"`,
  `"|Edit"`, `"Edit||Write"`). `MCP_SEGMENT` is discriminated at both ends
  (`"mcp__bad!__tool"`, `"mcp__server__bad!"`).
- `tests/domain/components/hooks/schema.test.ts` — the conditional `command` requirement is
  genuinely proven, by the accept/reject pair at `line 48` and `line 116`; deleting the
  `if`/`then` block, or its `required`, red-fails immediately. Removing the `hooks` element
  schema (e.g. `Type.Unknown()`) red-fails `"rejects an empty handler object"` (`line 110`).
- `partitionHooks` survives a `__proto__` event key without polluting `Object.prototype`
  (probed directly); no test pins it, but the code is safe by construction because the key is
  rejected by `BUCKET_A_MEMBERS` before any assignment.

## Not covered

- Direct per-pair coverage was still not measured — `npm run test:coverage:direct` is a gate
  command and the brief forbids it. Every coverage statement above comes from executing the
  modules in isolation with throwaway snippets, not from an instrumented run.
- I did not re-review `tests/architecture/hooks-foundation.test.ts` as a test module (its own
  assertion style — `assert.equal`, no AAA markers — is the architecture area's to grade). I
  read it only to establish who owns `HOOKS_CONFIG_SCHEMA`.
- `hook-events.ts` and `hook-tool-names.ts` and their paired tests remain outside this area;
  I read them to settle the `NON_TOOL_EVENT_CLOSED_SETS` pin, the `TOOL_EVENTS` tuple
  coverage, and the `CLAUDE_TO_PI_TOOL_NAMES` lookup, and grepped
  `tests/domain/components/hook-events.test.ts` only for `TOOL_EVENTS`.
- The three bridge test files that build fixtures with `parseMatcher` (see below) were read
  only at the fixture-construction sites, not reviewed.

## Meta-findings impact

### New cross-cutting evidence

**1. Production-computed test data fanning out from one domain function.** Three test files
in another area build their `RoutingEntry.matcher` fixtures by calling the production
`parseMatcher`: `tests/bridges/hooks/dispatch.test.ts:176`, `tests/bridges/hooks/settle.test.ts:107`
(and `:91`), `tests/bridges/hooks/event-router.test.ts:361`, plus
`tests/orchestrators/plugin/uninstall.test.ts:2144`. The guidelines forbid test data computed
with production code, and the coupling is not theoretical: if `parseMatcher("Bash")` regressed
to `{kind:"unmapped"}`, `matcherFiresOnToolEvent` (`bridges/hooks/dispatch.ts:114`) would
return `false` and those suites would quietly start exercising a different arm rather than
failing. Fix: literal `{ kind: "tool-set", piTools: new Set(["bash"]) }` fixtures. **Check the
bridges/hooks and orchestrators areas for the same shape** — a single domain helper used as a
fixture factory is likely not unique to `parseMatcher`.

**2. A file split leaves guards and rationale pointing at the old address — plural, not
singular.** `META-FINDINGS.md` records one casualty of commit `73d9c8b4` (the inert
`additionalProperties` grep). This area shows the split produced at least three more of the
same shape, and they are not all gates: the HOOK-03 rationale still lives in `hooks.ts` and
not next to the literals it governs; `HOOKS_CONFIG_SCHEMA`'s only cases stayed in an
architecture test rather than moving to the new module's pair; and the `NON_TOOL_EVENT_CLOSED_SETS`
completeness invariant that makes `partition.ts:55`'s cast safe is now invisible from the file
that depends on it. **The generalizable check is: after any module split, re-point (a) every
source-scanning gate, (b) every doc comment that describes a literal, and (c) the test
ownership of every export that moved.** This connects the existing "Gates that do not gate"
and "Source-walk gates follow code" items into one post-split checklist worth applying to the
other splits `META-FINDINGS.md` proposes under "Module splits" — those six splits will
manufacture this defect class unless the checklist is applied as they land.

**3. A type/runtime leniency divergence that blocks a prescribed fix.** `HOOK_ENTRY_SCHEMA`'s
static type rejects the unknown group-level fields its runtime schema accepts (verified with
`tsc`). This is worth checking wherever else the repo pairs a `Type.Object` schema with a
`satisfies`-based test convention: the first pass prescribed `satisfies <Type>` annotations in
many areas, and anywhere a lenient runtime schema meets a closed static type, that instruction
is unexecutable. **Areas to check: any test file the sweep told to add `satisfies` against a
TypeBox-derived type** — `domain/components/{plugin,mcp}.ts` and `domain/resolver.ts` are the
obvious candidates.

### Corrections to META-FINDINGS.md

- **"Calibration: where reviewers disagreed" — the hooks-schema gate.** The claim is accurate
  as far as it goes ("the gate does scan the wrong file; the sibling structural-walk test does
  still fire"), and I confirm both halves independently. The correction is to the framing: it
  is presented as a standalone severity judgment for the operator, but this area shows it is
  one instance of a repeatable post-split failure mode with at least three siblings in the
  same commit (see cross-cutting item 2). **Resolve it as a checklist applied to the split,
  not as a one-off severity vote.**
- **"Ranked by leverage" is silent on a defect class this area proves exists: value
  passthrough that no case asserts.** Every case in `partition.test.ts` uses
  `assert.deepStrictEqual` on the whole result — the form the meta-findings correctly hold up
  as the target — and the file still misses a BLOCKER, because whole-value comparison only
  proves what the *input* carried. "Replace fragment assertions" (item 3) fixes the assertion
  form; it does not fix input poverty. **A pass that converts fragment assertions to whole-value
  assertions must also widen the arranged inputs, or it will produce more files that look
  exemplary and prove nothing about passthrough.** Worth adding as a named caveat to item 3.

### Confirmations

- **"Clean verdicts are not reliable"** — confirmed from a second angle. The first pass listed
  *zero* clean files here, yet its inline clean claims ("Otherwise this file is strong",
  "no behavioral defect was found in the production logic itself") hid a BLOCKER in each of the
  two files they covered. **The unfalsified negative is not only the `### Clean files` list; it
  is every sentence of the form "otherwise X is fine."** A consolidation pass should treat
  those inline reassurances with the same suspicion as the clean lists.
- **"The dominant shape: sibling drift"** — confirmed twice within a three-file directory,
  which is about as tight as the shape gets: `matcher.test.ts` and `partition.test.ts` carry no
  compile-time type block while `schema.test.ts:10–30` does it correctly; and inside
  `schema.ts` itself, `HookHandlerEntry` models HOOK-03 leniency with an index signature while
  its immediate neighbor `HOOK_ENTRY_SCHEMA` does not. Both fixes are propagation from a
  known-good target in the same directory or the same file.
- **Per-area severity is not globally calibrated** — confirmed with a concrete miscalibration in
  the opposite direction from the ones catalogued. This area's one recorded BLOCKER on
  `matcher.test.ts` should be a WARNING (production promises no `Set` order), while two real
  BLOCKERs went unrecorded. The bias is not uniformly toward under-rating; it tracks whether
  the reviewer checked the consumer.
