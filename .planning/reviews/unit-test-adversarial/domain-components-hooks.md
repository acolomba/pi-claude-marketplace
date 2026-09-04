# Domain — hooks component schema, matcher, partition

**Scope:** `extensions/pi-claude-marketplace/domain/components/hooks/{matcher,partition,schema}.ts` and their paired tests under `tests/domain/components/hooks/`
**Test files reviewed:** 3
**Production modules reviewed:** 3

## Summary

All three production modules have exactly one paired test module — no pairing gap. `partition.ts` and its test are close to clean: every case compares the whole `HooksPartition` result with `assert.deepStrictEqual`, and the case set walks every branch (tool vs. non-tool events, closed sets, no-matcher-support, handler-level drops, ordering). Two real defects need attention before anything else: `matcher.test.ts` has two tests that claim to verify token *order* inside a `Set` but use `assert.deepStrictEqual`, which Node documents (and this review confirmed by running it) as order-insensitive for `Set`/`Map` — a scrambled-order implementation would still pass both tests. `schema.test.ts`'s 13-row "rejects" loop only asserts the boolean `false`, never the validator's structured `.Errors()` output, so it cannot tell a rejection for the *named* reason apart from a rejection for any other reason (confirmed: `HOOKS_VALIDATOR.Errors()` already returns distinguishing `instancePath`s for every row in that loop). A third, cross-cutting theme: the `73d9c8b4` split of `hooks.ts` into `hooks/{matcher,partition,schema}.ts` left one architecture defense-in-depth test scanning the wrong file, and left the HOOK-03 lenient-stance rationale documented only in the sibling `hooks.ts`, not in `schema.ts` where the schema literals it protects now actually live. Documentation gaps (undocumented exported types, non-third-person JSDoc verbs, unexplained `as` casts) round out the rest — all WARNING-level.

## Unit test findings

### `tests/domain/components/hooks/matcher.test.ts`

- **[BLOCKER] Order claims are not verified — `assert.deepStrictEqual` ignores `Set`/`Map` iteration order** — `lines 42–53` (`"maps multiple tool tokens in source order"`) and `lines 55–66` (`"deduplicates repeated tool tokens without changing first-occurrence order"`)
  Both titles claim to pin first-occurrence/source order, but both assert `assert.deepStrictEqual(matcher, { kind: "tool-set", piTools: new Set([...]) })`. Node's `assert.deepStrictEqual` compares `Set` contents unordered (verified directly: `deepStrictEqual(new Set(["read","write","grep"]), new Set(["grep","write","read"]))` passes). A `parseMatcher` that built `piTools` in reverse order, sorted order, or any other permutation of the same three members would still pass both cases — the very property named in the titles is unchecked.
  Fix: keep the `deepStrictEqual` check for `kind` and set membership, then add a second, order-sensitive assertion by spreading the Set into an array in the exact order under test, e.g. `assert.deepStrictEqual([...(matcher as Extract<ParsedMatcher, { kind: "tool-set" }>).piTools], ["write", "read", "grep"])` for the first case and `["read", "write", "grep"]` for the second (narrow `matcher.kind` first, e.g. with `assert.equal(matcher.kind, "tool-set")`, before reading `.piTools`).

- **[WARNING] Dead conditional inside a data-driven loop** — `test(`reports the first unmapped token in ${token}`)`, `lines 98–119`, ternary at `line 116`
  The loop's expected value is `token: token.includes("|") ? "mcp__server__tool" : token`, but none of the seven rows (`"edit"`, `"MultiEdit"`, `"WebFetch"`, `"Task"`, `"mcp____tool"`, `"mcp__server"`, `"mcp__server__"`) contains `"|"`, so the true branch never executes — it is dead code, and a conditional inside a data loop is itself a documented finding ("different branches ... deserve separate named cases"). This looks like a leftover from before the compound-token case was split out into its own test (`"reports the first unmapped token after a mapped token"`, line 85).
  Fix: replace the ternary with the plain `token` (drop the dead branch). If a compound-token variant of this loop is wanted, add it as its own row set with its own conditional-free expected-value expression, not a branch in this loop.

- **[WARNING] One test performs two independent act/assert pairs** — `test("rejects an MCP matcher that differs from a valid literal by one unsafe character")`, `lines 148–160`
  The case calls `parseMatcher` twice (once on a valid literal, once on the same literal plus one unsafe character) and asserts both results. Neither act depends on the other's outcome, so this is two behaviors in one case rather than a boundary demonstrated through a single act.
  Fix: split into `"keeps a safe MCP literal"` (asserting `validMatcher`) and `"rejects an MCP literal with one unsafe trailing character"` (asserting `unsafeMatcher`).

### `tests/domain/components/hooks/partition.test.ts`

- **[WARNING] `HooksConfig`-shaped literals are not `satisfies`-checked** — representative: `line 9`, `lines 20–26`, `lines 46–52`, `lines 92–93`, `lines 176–186`
  Every `config` literal in this file (11 total) stands in for the production `HooksConfig` type but carries no `satisfies HooksConfig` annotation, so a typo in a field name would surface only as a TypeScript error at the `partitionHooks(config)` call site rather than at the literal's own definition, and would report against the wrong location.
  Fix: append `satisfies HooksConfig` to each `config` literal declaration.

Otherwise this file is strong: every case uses whole-object `assert.deepStrictEqual(partition, {...})` against the full `HooksPartition`, cases are independent and freshly constructed, titles name the discriminated behavior, and the branch set (tool vs. non-tool events, closed-set membership, no-matcher-support, per-handler drops, dedup-vs-preserve, and cross-event ordering) is exercised without gaps.

### `tests/domain/components/hooks/schema.test.ts`

- **[BLOCKER] "rejects" loop only asserts the boolean, never the structured validator error** — `lines 98–139` (13 rows)
  Every row asserts `assert.strictEqual(HOOKS_VALIDATOR.Check(config), false)`. This proves *something* about `config` was rejected, but not that it was rejected *for the reason the row's title names*. Confirmed by invoking `HOOKS_VALIDATOR.Errors()` directly on three of these rows: `"a group without handlers"` reports `instancePath: "/PreToolUse/0"`, `"a group with a non-string matcher"` reports `instancePath: "/PreToolUse/0/matcher"`, and `"a handler with a non-string if condition"` reports `instancePath: "/PreToolUse/0/hooks/0/if"` — fully distinguishable per row. Without asserting on this, a schema regression that rejects for the *wrong* reason (e.g. an accidental new requirement on an unrelated field that happens to make every one of these already-broken configs still fail) would pass every row unnoticed.
  Fix: for each row (or at minimum the rows whose defect is field-localized: non-array event, non-string matcher, non-string type, command-without-command, non-string command, non-string if), also assert the first error's `instancePath` (via `[...HOOKS_VALIDATOR.Errors(config)][0].instancePath`, the same accessor `firstHookValidationDetail` in `domain/components/hooks.ts` already uses) equals the path the row's title implies.

- **[WARNING] `HooksConfig`-shaped literals are not `satisfies`-checked** — `lines 33–96` (accepts loop) and `lines 98–139` (rejects loop)
  Same gap as `partition.test.ts`: none of the `config` rows carry `satisfies HooksConfig`.
  Fix: append `satisfies HooksConfig` to each row's `config` literal (the compile-time block at the top of the file, lines 10–30, already models the right pattern for `HookHandlerEntry`/`HooksConfig` — extend it to the runtime rows).

- **[WARNING] "kitchen sink" accept case reduces failure diagnosis** — `test("accepts a command handler with extra properties")`, `lines 53–85`
  This single row simultaneously exercises unknown top-level event keys, unknown group-level fields, unknown handler-level fields, and every documented optional field, all in one config. It correctly demonstrates HOOK-03 leniency, but if a future change makes exactly one of these fields strict, the failure only says "accepts a command handler with extra properties" failed — not which field regressed.
  Fix: not required to change immediately, but consider splitting into 2–3 targeted rows (e.g. "accepts an unknown group-level field", "accepts an unknown handler-level field") so a regression's failure names the offending level.

### `tests/architecture/no-hooks-strict-additional-properties.test.ts` (cross-check requested by the assignment brief)

- **[WARNING] Textual defense-in-depth gate now scans a file that no longer holds the schema literals** — `lines 27–30, 43–57`
  This test reads `extensions/pi-claude-marketplace/domain/components/hooks.ts` and greps it for the literal string `additionalProperties: false`, documented as a defense-in-depth backstop to the structural walk in `tests/architecture/hooks-foundation.test.ts`. Since commit `73d9c8b4` ("refactor(domain): split hook configuration concerns"), `hooks.ts` only imports and re-exports from `domain/components/hooks/schema.ts` and `.../partition.ts` — it contains **zero** JSON-schema object literals. The actual `HOOK_HANDLER_SCHEMA` / `HOOK_ENTRY_SCHEMA` / `HOOKS_CONFIG_SCHEMA` literals this test claims to protect now live entirely in `domain/components/hooks/schema.ts`, a file this test never reads. The grep can therefore never fire again regardless of what `schema.ts` contains — the gate is inert, not merely redundant (the sibling structural-walk test in `hooks-foundation.test.ts` still works correctly because it introspects the compiled schema object at runtime rather than scanning source text, so the primary protection is intact; only the stated "defense-in-depth against a hidden cast" backstop has silently gone blind).
  Fix: point `HOOKS_TS_PATH` at `extensions/pi-claude-marketplace/domain/components/hooks/schema.ts` (the file that now declares the literals), or grep both `hooks.ts` and `hooks/schema.ts`.

### Clean files

- None — all three reviewed test files (`matcher.test.ts`, `partition.test.ts`, `schema.test.ts`) carry at least one finding above; the cross-check file `tests/architecture/no-hooks-strict-additional-properties.test.ts` also carries a finding.

## Production code findings

### `extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts`

- **[WARNING] Exported type and JSDoc gaps** — `line 6` (`ParsedMatcher` undocumented), `line 30` (doc comment uses base-form "Parse" instead of third-person "Parses")
  `ParsedMatcher` is a top-level export with no doc comment describing the five discriminant arms. The one doc comment present on `parseMatcher` ("Parse a Claude hook matcher...") should read "Parses a Claude hook matcher..." per the third-person-verb-phrase rule for method/function descriptions.
  Fix: add a short doc comment above `ParsedMatcher` naming its five kinds; reword line 30 to "Parses ...".

- **[WARNING] `isMcpLiteral`'s segment-boundary logic is undocumented** — `lines 13–28`
  The function's `lastIndexOf("__")` choice and the `separatorIndex <= 0 || separatorIndex >= body.length - 2` guard encode non-obvious boundary reasoning (rejecting a separator flush against either end of the body) that a reader cannot recover from the name and signature alone.
  Fix: add a `//` comment above the function or above the guard explaining why the last `__` is the separator and why near-the-edge positions are rejected.

- **[WARNING] Unexplained `as` cast** — `line 50`
  `(CLAUDE_TO_PI_TOOL_NAMES as Record<string, PiToolName | undefined>)[token]` widens a closed-key lookup table to an arbitrary-string index without a comment. The immediately following `undefined` check makes the intent recoverable, but the style guide requires an obvious-or-commented reason for every `as`.
  Fix: add a one-line comment, e.g. `// widen to look up an arbitrary token; undefined means "not a Claude tool name"`.

### `extensions/pi-claude-marketplace/domain/components/hooks/partition.ts`

- **[WARNING] Exported types and JSDoc gaps** — `line 14` (`DroppedHook` undocumented), `line 24` (`HooksPartition` undocumented), `line 112` (doc comment uses base-form "Separate" instead of third-person "Separates")
  Fix: add doc comments to `DroppedHook` and `HooksPartition` describing their arms/fields; reword line 112 to "Separates ...".

- **[WARNING] Unexplained `as` cast bypassing a cross-file completeness guarantee** — `line 55`
  `const closedSetEvent = event as keyof typeof NON_TOOL_EVENT_CLOSED_SETS;` has no comment. The cast is safe today only because `nonToolMatcherCondition` already filtered out `UserPromptSubmit`/`Stop` (both map to `null` in `NON_TOOL_EVENT_FIELDS`) one line above, and because `hook-events.ts`'s `NON_TOOL_EVENT_CLOSED_SETS` is pinned with `satisfies Readonly<Record<Exclude<NonToolEvent, "UserPromptSubmit" | "Stop">, ReadonlySet<string>>>`, which forces that object to carry every remaining key — so a future non-tool event added to `BUCKET_A_EVENTS` without a closed-set entry would fail to compile *in `hook-events.ts`*, not silently produce an `undefined` `.has()` crash here. That safety net is invisible from this file.
  Fix: add a comment at line 55 stating the invariant it relies on, e.g. `// safe: UserPromptSubmit/Stop already returned above; hook-events.ts's "satisfies Record<...>" pin guarantees every remaining non-tool event has a closed-set entry`.

- **[WARNING] Repeated inline type `HooksConfig[string][number]`** — `lines 74, 76, 93, 109`
  The same indexed-access type is written out four times.
  Fix: extract `type HookEntry = HooksConfig[string][number];` once near the top of the file and use it at all four sites.

### `extensions/pi-claude-marketplace/domain/components/hooks/schema.ts`

- **[WARNING] `HookHandlerEntry` interface is undocumented, including an unexplained asymmetric `readonly`** — `lines 4–18`, esp. `line 7` (`readonly if?: string;`)
  The interface is a top-level export with zero doc comment. `if` is the only field marked `readonly` among a dozen otherwise-mutable optional fields, which reads like it could be a typo; nothing states why.
  Fix: add a doc comment to the interface, and a one-line comment on `if` stating why it alone is read-only (e.g. "compiled once into the if-predicate side-map; never reassigned after parse").

- **[WARNING] `Type.Unsafe` raw JSON-schema conditional is undocumented** — `lines 20–42` (`HOOK_HANDLER_SCHEMA`)
  Dropping to `Type.Unsafe<HookHandlerEntry>({...})` with a raw `if`/`then` object bypasses TypeBox's normal builder and its static-shape checking, functioning like an `as` assertion at the schema level. No comment explains why (TypeBox's fluent API has no first-class if/then combinator for "require `command` only when `type === "command"`").
  Fix: add a comment above `HOOK_HANDLER_SCHEMA` stating that reason.

- **[WARNING] HOOK-03 lenient-stance rationale is documented only in the sibling `hooks.ts`, not here where the literals live** — `lines 20–57`
  Since the `73d9c8b4` split, the "additionalProperties: true at every nesting level" rationale (and the fact that this file is exactly what the architecture-gate scan above needs to cover) is written only in `domain/components/hooks.ts`'s header comment, one file removed from the object literals it actually governs.
  Fix: move (or duplicate in short form) that rationale to a comment directly above `HOOK_HANDLER_SCHEMA` / `HOOK_ENTRY_SCHEMA` / `HOOKS_CONFIG_SCHEMA` in this file, so an editor changing these literals sees the constraint locally.

### Clean files

- None of the three modules are fully free of findings, but all findings against them are WARNING-level documentation/hygiene items — no behavioral defect was found in the production logic itself.

## Not covered

- Did not run `node --test`, `npm run test:coverage`, or `npm run check` (prohibited by the diagnostic-review brief); coverage percentages are inferred from manual branch tracing, not measured.
- `extensions/pi-claude-marketplace/domain/components/{hooks.ts, hook-events.ts, hook-tool-names.ts}` and their test files were read only for context (to verify pairing and the architecture-gate cross-check requested by the brief); they are outside this assignment's paired-production scope and were not reviewed against the style skill.
- Did not review `tests/architecture/hooks-foundation.test.ts` beyond confirming its structural-walk test still functions as the primary HOOK-03 guard (it is outside this assignment's file list).
