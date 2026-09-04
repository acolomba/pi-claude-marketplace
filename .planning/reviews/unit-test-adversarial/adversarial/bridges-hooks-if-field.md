# Bridges — hooks `if:` predicate compiler — adversarial re-review

**Scope:** `extensions/pi-claude-marketplace/bridges/hooks/if-field/{bash,glob,index}.ts` and `tests/bridges/hooks/if-field/{bash,glob,index}.test.ts`. Also read, as context the first pass never opened: `tests/architecture/hooks-if-field.test.ts`, `extensions/pi-claude-marketplace/shared/debug-log.ts`, and the `CompileIfPredicateContext` twin in `domain/components/hooks.ts`.
**First-pass file:** `unit-test-findings/bridges-hooks-if-field.md`
**Clean files attacked:** 0 listed — the first pass declared *no* clean files in either section. I therefore ran the full mutation test, export census, and branch census against all 6 files rather than a subset.
**Existing findings graded:** 14

Verification method: read all 3,254 lines; ran two throwaway `node` probes against the real modules (scratchpad only, no repo file touched, no test runner, no `npm run check`) to settle eleven behavioural hypotheses. Every "survives" claim below was executed, not inferred.

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 5 |
| New WARNING (missed by first pass) | 10 |
| Existing CONFIRMED | 13 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

## New findings — from the mutation test

### `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts`

- **[BLOCKER] `compileIfPredicate` compiles an empty-inner rule to a fail-CLOSED predicate, contradicting D-61-02 and its own doc comment** — `index.ts:149–150`, `index.ts:272–305`
  The JSDoc on `IF_PREFIX_REGEX` states: *"Inner may be empty -- `compileIfPredicate` rejects empty-inner forms via the per-prefix compile attempt."* No such rejection exists. Executed against the real module:

  | declaration | actual result |
  | --- | --- |
  | `Bash()` | `{ kind: "bash", bashGlob.raw: "", isCommandNameOnly: false }` — **not** `MATCH_ALL_IF` |
  | `Bash( )` | `{ kind: "bash", bashGlob.raw: " " }` |
  | `Read()` / `Write()` | `{ kind: "path-tool", pathGlob.raw: "", anchor: "gitignore-bare" }` |
  | `Read(a)(b)` | `{ kind: "path-tool", pathGlob.raw: "a)(b" }` (greedy `.*`) |

  Consequences, all executed: `ifFires(compileIfPredicate("Bash()", …), { input: { command: "rm -rf /" } })` → **`false`**. `parseBashSubcommands` filters zero-length subcommands, so an empty Bash glob can match *nothing, ever* — the hook is silently and permanently disabled. Worse, because `isCommandNameOnly` is `false` for the empty pattern, the same predicate returns **`true`** for `rm -rf $HOME`: the specificity-override fires on any interpolated command. So `Bash()` is fail-closed for plain commands and fail-open for interpolated ones — the exact opposite of D-61-02's "every `if`-layer failure mode falls open to `MATCH_ALL_IF`". `Read()` likewise fires only when the resolved target equals `cwd` exactly.
  **Fix:** in `compileIfPrefixForm`, guard `if (inner.trim().length === 0) { hookDebugLog(...); return MATCH_ALL_IF; }` before each compile arm, then delete the false claim from the `IF_PREFIX_REGEX` doc comment. **Test:** add rows to `index.test.ts`'s `partitions empty, non-tool, unknown-prefix, and MCP boundary declarations` case for `"Bash()"`, `"Bash( )"`, `"Read()"`, `"Bash("` (the exact malformed example D-61-02 names, and currently untested), each expecting `MATCH_ALL_IF` by identity.

### `tests/bridges/hooks/if-field/bash.test.ts`

- **[BLOCKER] The compound split *inside* a `$()` body is never exercised — `emitInner`'s split can be deleted with all 23 cases green** — `bash.ts:253`, tests at `bash.test.ts:96, 118, 238, 254`
  Mutating `emitInner` from `splitOnCompoundSeparators(inner)` to `[inner.trim()]` survives every case in the file, because every tested substitution body (`printf \`date\``, `printf ')'`, `echo`, ``) is a single piece. Executed: the real module returns `["echo \"$(git status && npm test)\"", "git status", "npm test"]` for `echo "$(git status && npm test)"`; the mutant returns `[…, "git status && npm test"]`. This is the load-bearing half of the D-61-04 promise at `bash.ts:20–22` ("each inner subcommand is checked independently").
  **Fix:** add `test('splits compound separators inside a quoted command substitution')` asserting `assert.deepStrictEqual(parseBashSubcommands('echo "$(git status && npm test)"'), { ok: true, subcommands: ['echo "$(git status && npm test)"', "git status", "npm test"], hasInterpolation: true })`.

- **[BLOCKER] The WR-04 "backslash is literal inside single quotes" rule is never exercised** — `bash.ts:219`, no case in `bash.test.ts`
  Deleting `!qc.inSingle &&` from the backslash-escape guard survives all 23 cases. No case in the file puts a backslash inside single quotes: line 61 uses unquoted `\;` / `\|` / `\&`, line 40 has quotes without backslashes, line 200 has a terminal backslash. Executed: real module returns `["printf 'a\\'", "npm test"]` for `printf 'a\' && npm test`; with the guard removed the backslash swallows the closing quote, `inSingle` never clears, and the result collapses to one piece `["printf 'a\\' && npm test"]`. The comment at `bash.ts:209–210` explicitly promises this behaviour.
  **Fix:** add `test('treats a backslash inside single quotes as literal')` asserting `parseBashSubcommands("printf 'a\\' && npm test")` deep-equals `{ ok: true, subcommands: ["printf 'a\\'", "npm test"], hasInterpolation: false }`.

- **[BLOCKER] `$()` bodies containing a compound separator are silently mangled, and nothing asserts it either way** — `bash.ts:211–242` vs. `bash.ts:271–306`
  `splitOnCompoundSeparators` tracks quotes but **not** parentheses, so an *unquoted* substitution is cut in half before `pushRecursed` ever sees it. Executed: `parseBashSubcommands("echo $(git status && npm test)")` → `["echo $(git status", "npm test)"]`, and the backtick form → `["echo \`git status", "npm test\`"]`. Neither `git status` nor `npm test` is ever emitted as a subcommand, so a `Bash(git *)` predicate (command-name-only ⇒ no specificity override) does **not** fire on `echo $(git status && rm -rf /)`. Whether that divergence from the `bash.ts:20–22` contract is intended is an operator call, but there is currently no case pinning it in *either* direction — which means a future paren-aware splitter would flip the behaviour with the suite green.
  **Fix:** add one case pinning today's output for `echo $(git status && npm test)` with a comment stating whether the mangling is the accepted upstream-faithful behaviour or a known divergence; escalate the semantics question with the operator alongside META-FINDINGS decision item 1.

### `tests/bridges/hooks/if-field/index.test.ts`

- **[BLOCKER] The `mcp-literal` arm's exact equality is not discriminated from prefix matching** — `index.ts:437`, `index.test.ts:585–616`
  Mutating `case "mcp-literal": return extractToolName(event) === predicate.toolName` to `.startsWith(predicate.toolName)` survives both literal rows: the only negative row uses `"mcp__files__write"` against `"mcp__files__read"`, and `"mcp__files__write".startsWith("mcp__files__read")` is already `false`. The mutation is highly plausible — the very next arm (`index.ts:440`) *is* a `startsWith`, three lines away. Executed: the real module returns `false` for tool name `"mcp__files__readmore"`; the mutant returns `true`, so an `mcp__files__read` rule would start firing on every tool whose name merely begins with it.
  **Fix:** add a row `{ name: "literal prefix extension", predicate: literalPredicate, toolName: "mcp__files__readmore" }` with `fires: false` to the `evaluates MCP literal equality, server membership, and wrong servers` case.

### `extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts`

- **[BLOCKER] The documented DoS mitigation rests on a regression gate that does not exist** — `glob.ts:15–17` and `glob.ts:42–44`
  Both header passages justify the hand-authored engine and its accepted `O(text.length ** N)` multi-globstar worst case by pointing at "the architecture test pinning every truth-table row directly against the implementation" / "the architecture test pins the truth-table rows and is the regression gate". `grep -n "compileBashGlob\|testAbsolute\|globstar" tests/architecture/*.ts` returns **nothing**. The only architecture test that touches this area, `tests/architecture/hooks-if-field.test.ts` (135 lines), asserts routing-entry wiring and predicate `kind`s — it never calls `compileBashGlob`, `compilePathGlob`, `test()`, or `testAbsolute()`. The truth-table rows live in `tests/bridges/hooks/if-field/glob.test.ts`, an ordinary unit test. Separately, **no test anywhere bounds pattern complexity** — the largest multi-globstar case in the suite is `./**/**` against a 5-character tail.
  This is the same shape META-FINDINGS records for `orchestrators/marketplace/info.ts` ("its header comment *misattributes where its gate lives*, which is how this stayed invisible") and belongs in the "Gates that do not gate" workstream as a sixth instance.
  **Fix:** rewrite both passages to name `tests/bridges/hooks/if-field/glob.test.ts` as the pin, and either add a bounded-input complexity case (a 3-globstar pattern against a ~200-char path, asserting completion and result) or delete the DoS-mitigation risk-acceptance sentence that the missing gate was supposed to back.

## New findings — WARNING

### `tests/bridges/hooks/if-field/bash.test.ts`

- **[WARNING] The one `bashSubcommandFires` row that proves the direct match wins is missing** — `bash.test.ts:406–450`
  Four of the function's input combinations are exercised; the fifth — direct match **and** `hasInterpolation` **and** `isCommandNameOnly` — is not. Mutating `if (glob.test(subcommand))` to `if (glob.test(subcommand) && !hasInterpolation)` survives all three cases. Executed: the real module returns `true` for `bashSubcommandFires(compileBashGlob("git *"), "git push $BRANCH", true)`; the mutant returns `false`.
  **Fix:** add `test('fires on a direct match even when the command interpolates and the pattern is command-name-only')` with exactly that call, asserting `true`.

- **[WARNING] `bashSubcommandFires` cases build their input with the production compiler; the hand-built stub already exists next door** — `bash.test.ts:409, 421–422, 437`
  Each case calls `compileBashGlob(...)` from `glob.ts` to produce the `CompiledBashGlob` argument, coupling `bash.test.ts` to another module's behaviour and hiding which module a failure belongs to. `index.test.ts:64–70` already demonstrates the correct form — a plain literal `{ raw, tokens: [], trailingWordBoundary, isCommandNameOnly, test: (_s) => true } satisfies CompiledBashGlob`. With that stub, all five input combinations become one-line rows.
  A second, related gap: `isCommandNameOnly` is derived from `BASH_COMMAND_NAME_ONLY = /^[A-Za-z0-9_./-]+(\s+\*)?$/` (`glob.ts:281`), yet the only characters any case pins are letters and `/`. Executed: `docker-compose *`, `node.js *`, `npm_run *`, and `7z *` all yield `true`, and dropping `-`, `.`, `_`, or `0-9` from the class survives every case — a mutation that silently *widens* the fail-open specificity override for hyphenated command names.
  **Fix:** replace the real-compiler inputs with typed stubs, and add cases to `glob.test.ts` pinning `isCommandNameOnly` for `docker-compose *`, `node.js *`, and `7z *`.

### `tests/bridges/hooks/if-field/glob.test.ts`

- **[WARNING] Zero compile-time type proofs for the five types `glob.ts` exports; the proofs live in the wrong file** — `glob.test.ts` (whole file), vs. `index.test.ts:35–104`
  `glob.ts` exports `GlobToken`, `PathAnchor`, `PathAnchorContext`, `CompiledBashGlob`, and `CompiledPathGlob`. Its paired test contains no `satisfies` and no `@ts-expect-error` — every token literal is an untyped object literal compared at runtime only. Meanwhile `index.test.ts` holds `satisfies DefiningCompiledBashGlob` / `DefiningCompiledPathGlob` proofs (lines 64–77) and a full `@ts-expect-error` negative battery for `IfPredicate` (lines 89–104). That battery is the in-repo template and it sits in the barrel's test rather than the defining module's.
  Concretely missing: nothing anywhere proves `{ kind: "unknown" }` is rejected by `GlobToken` or `PathAnchor` at compile time, even though both runtime `assertNever` arms have cases (`glob.test.ts:264, 704`).
  **Fix:** move the `CompiledBashGlob`/`CompiledPathGlob` `satisfies` literals into `glob.test.ts`, annotate each `expectedMetadata.tokens` as `satisfies GlobToken[]` and each `anchor` as `satisfies PathAnchor`, and add `// @ts-expect-error the token vocabulary has exactly four discriminants` / `… the anchor vocabulary has exactly five discriminants` negatives modelled on `index.test.ts:103–104`. Leave only the re-export identity proofs in `index.test.ts`.

- **[WARNING] The `trailingWordBoundary` guard has no discriminating case** — `glob.ts:305`, `glob.test.ts:51–84, 121–150`
  Deleting `trailingWordBoundary &&` from the second `matchBashGlob` branch survives every case in both test files: for every tested pattern the `subcommand + " "` retry either already matched or still fails. The discriminating input is a pattern ending in a literal space. Executed: `compileBashGlob("ls ")` has `trailingWordBoundary === false` and `.test("ls") === false`; without the guard it would return `true`.
  **Fix:** add `test('does not append a word boundary for a pattern that only ends in a space')` asserting `compileBashGlob("ls ").test("ls") === false` alongside `trailingWordBoundary === false`.

- **[WARNING] Dead arrange-phase aliasing inside the data-driven loop** — `glob.test.ts:463–464`
  `const expectedCompiledMetadata = expectedMetadata; const expectedPathMatches = expectedMatches;` renames two already-named destructured row fields so the `// arrange` phase has a body. Delete both lines and assert against `expectedMetadata` / `expectedMatches` directly.

### `tests/bridges/hooks/if-field/index.test.ts`

- **[WARNING] Bare `actual` used as the subject name in 7 cases** — `index.test.ts:214, 327, 361, 474, 576, 609, 672`
  The unit-testing skill lists a bare `actual` as a finding by name. Rename each to its production role: `compiledPredicates` (214, 361), `partitionedPredicates` (327), `bashDecisions` (474), `pathDecisions` (576), `mcpDecisions` (609), `dispatchDecisions` (672). The `actual[N]?.predicate` identity assertions at 336–343 follow the rename.

- **[WARNING] No `describe()` despite two exported entrypoints, unlike both siblings** — `index.test.ts` (whole file)
  `bash.test.ts` and `glob.test.ts` each wrap their cases in one `describe()` per exported entrypoint. `index.test.ts` exercises `compileIfPredicate` (cases at 162–447) and `ifFires` (cases at 449–693) with no grouping at all, plus one integration case at 106 that spans both. Wrap them as `describe("compileIfPredicate", …)` and `describe("ifFires", …)`, one level deep, matching the siblings.

### `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts`

- **[WARNING] `_claudeEvent` is a fully dead parameter that every caller and every test must supply** — `index.ts:399`
  Confirmed unread across the whole `ifFires` body. The doc at `index.ts:389–393` admits it is "accepted for symmetry" and "reserved for forward-compat". Both production call sites (`bridges/hooks/dispatch.ts:184, 265`) pass `entry.claudeEvent`, and `index.test.ts` threads an `eventName` per row (line 657–662) that no assertion can ever observe — deleting the parameter breaks nothing. Per the repo's own "no speculative flexibility" guideline, drop the parameter and update the two dispatch call sites; the same edit belongs in the META-FINDINGS item-1 context-narrowing ticket that already targets this signature.

- **[WARNING] Doc comment describes a `reason` field that no code ever writes or reads** — `index.ts:75–77`, `index.ts:91`
  The `IfPredicate` JSDoc says of the `match-all` arm: *"The `reason` field captures fall-open context for `hookDebugLog`."* `MATCH_ALL_IF` (`index.ts:112`) is the sole `match-all` value produced anywhere, and it carries no `reason`; every fall-open site instead calls `hookDebugLog` directly with an inline message. Repo-wide grep finds no producer and no consumer of `reason` on this arm. Either populate it at the five fall-open sites and have dispatch read it, or delete the optional field and the sentence.

### `extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts`

- **[WARNING] `separatorAt`'s two-character branch is behaviourally unobservable** — `bash.ts:136–139`
  Every two-character separator (`&&`, `||`, `|&`) decomposes into single-character separators that `bash.ts:141–144` already recognises, and `splitOnCompoundSeparators` drops the resulting empty piece at `bash.ts:241`. Returning `null` from the two-char branch therefore produces byte-identical output for every possible input — no test can distinguish it, and none does. This is not reachable-untested and not compiler-forced; it is production code with no observable contract, despite the header at `bash.ts:17–19` calling the ordering "longest first to honor precedence". Either delete the branch (single-char handling is sufficient) or replace the "precedence" comment with the accurate reason it is kept (one fewer loop iteration per separator).

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `bash.ts` | `parseBashSubcommands` | `bash.test.ts:10–404` (23 cases) | owned |
| `bash.ts` | `bashSubcommandFires` | `bash.test.ts:406–450` (3 cases) | owned — 4 of 5 input combinations |
| `bash.ts` | `ParseResult` (type) | `bash.test.ts` `expectedParse` literals | runtime-only; **no compile-time pin** (first-pass WARNING) |
| `glob.ts` | `compileBashGlob` | `glob.test.ts:9–276` (9 cases) | owned |
| `glob.ts` | `compilePathGlob` | `glob.test.ts:278–720` (14 cases) | owned |
| `glob.ts` | `GlobToken` (type) | — | **NO TYPE PROOF** — literals untyped; no `@ts-expect-error` negative |
| `glob.ts` | `PathAnchor` (type) | — | **NO TYPE PROOF** — same |
| `glob.ts` | `PathAnchorContext` (interface) | — | **NO TYPE PROOF** — passed as inline untyped literals |
| `glob.ts` | `CompiledBashGlob` (interface) | `index.test.ts:64–70` | owned by the **wrong** module's test |
| `glob.ts` | `CompiledPathGlob` (interface) | `index.test.ts:71–77` | owned by the **wrong** module's test |
| `index.ts` | `compileIfPredicate` | `index.test.ts:106–447` (7 cases) | owned |
| `index.ts` | `ifFires` | `index.test.ts:106, 449–693` (7 cases) | owned |
| `index.ts` | `MATCH_ALL_IF` | `index.test.ts:336–343` (identity), `397, 414, 446` | owned |
| `index.ts` | `IfPredicate` (type) | `index.test.ts:53, 79–104` | owned (best-in-area) |
| `index.ts` | `CompileIfPredicateContext` (interface) | `index.test.ts:52` | owned |
| `index.ts` | `CompiledBashGlob` / `CompiledPathGlob` re-exports | `index.test.ts:54–55` | owned (type identity) |
| `index.ts` | `compileBashGlob` re-export | `index.test.ts:56` — **type position only** | **NO RUNTIME CASE** |
| `index.ts` | `compilePathGlob` re-export | `index.test.ts:57` — type position only | **NO RUNTIME CASE** |
| `index.ts` | `parseBashSubcommands` re-export | `index.test.ts:58–61` — type position only | **NO RUNTIME CASE** |
| `index.ts` | `bashSubcommandFires` re-export | `index.test.ts:62` — type position only | **NO RUNTIME CASE** |

The four `NO RUNTIME CASE` rows are the substance behind the first pass's barrel BLOCKER: those bindings are imported and then used exclusively inside `Same<typeof …>` type expressions, so the barrel's runtime re-export surface is never touched by its own paired test. One `assert.strictEqual` per row closes all four.

Incidental cross-module coverage (exercised elsewhere, never *asserted* as this area's contract): `compileIfPredicate` runs inside `tests/bridges/hooks/dispatch.test.ts:254–497`, `tests/architecture/hooks-if-field.test.ts:101`, `tests/orchestrators/plugin/{update,uninstall}.test.ts`. `ifFires` runs inside `dispatch.ts:184, 265` under `dispatch.test.ts`. None of that belongs to this area's pair and none should be counted toward its coverage.

## Branch census

**Reachable and untested (findings above):**
- `bash.ts:219` — `!qc.inSingle` on the backslash-escape guard. New BLOCKER.
- `bash.ts:253` — multi-piece body inside `emitInner`. New BLOCKER.
- `bash.ts:449/453` — the `test()==true ∧ interpolation ∧ command-name-only` combination. New WARNING.
- `glob.ts:305` — the `trailingWordBoundary` short-circuit's discriminating input. New WARNING.
- `glob.ts:281` — `_`, `.`, `-`, and digit members of the command-name char class. New WARNING.
- `index.ts:437` — `===` not discriminated from `startsWith`. New BLOCKER.
- `index.ts:290–294` — empty / degenerate `inner` for `Read`/`Edit`/`Write`. New BLOCKER (contract violation).

**Unreachable by real input (production dead-code decision, not a test gap):**
- `index.ts:282–287` — the `catch` around `compileBashGlob`. `compileBashGlob(raw: string)` executes only `String.endsWith`, `String.slice`, `RegExp.test`, and `tokenize`; none can throw for a `string`. The only "coverage" is the `String.prototype.endsWith` patch at `index.test.ts:376–391`.
- `index.ts:295–300` — the `catch` around `compilePathGlob`. Reachable only through a context object whose `cwd` getter throws (`index.test.ts:404–406`), which no production caller can produce (`CompileIfPredicateContext.cwd` is `readonly string`, built as a plain literal at all four production call sites).

**Compiler-forced and not removable (D-116-01a):**
- `glob.ts:256–258` — `if (tok === undefined) return false;`. Forced by `noUncheckedIndexedAccess`; `ti < tokens.length` is guaranteed at line 251. Exercised only by `Reflect.deleteProperty` on a case-owned array (`glob.test.ts:251–262`).
- `glob.ts:272–273` and `glob.ts:463–464` — the two `assertNever` default arms. Exercised only by `Reflect.set` corruption (`glob.test.ts:264, 704`).
- `index.ts:442–443` — the `ifFires` `assertNever` arm. Exercised by an `as unknown as IfPredicate` literal.
- `index.ts:250` — `prefixMatch[1] ?? ""` / `prefixMatch[2] ?? ""`. A successful `exec` of a two-group regex always populates both; the `??` fallbacks exist only for `noUncheckedIndexedAccess`. Exercised only by the `RegExp.prototype.exec` patch at `index.test.ts:417–447`.
- `bash.ts:370` — `head === undefined`. `String.split` on a non-empty string always yields index 0.

**Executed but with no discriminating assertion possible:**
- `bash.ts:136–139` — `separatorAt`'s two-char arm (new WARNING above; equivalent mutant).
- `bash.ts:219` — the `i + 1 < command.length` half of the backslash guard. Both outcomes produce identical output for the terminal-backslash case at `bash.test.ts:198`; no input distinguishes them.

**Unobservable by design (correctly not asserted):**
- The six `hookDebugLog` call sites (`index.ts:237, 242, 262, 283, 296, 303`) and the one in `ifFires` (`index.ts:413`). `shared/debug-log.ts:23` gates output on `process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1"`, so it is silent in tests, and the unit-testing skill's logging rule ("log calls are asserted only in a module whose job is logging") sanctions leaving them unasserted. Deleting all seven would leave the suite green, but that is the correct trade here — noted for completeness, not filed as a finding. The `bash.ts:45–48` header does over-promise by calling this "the fall-open warning seam", which the first pass already flags as stale.

## Grading of first-pass findings

### `tests/bridges/hooks/if-field/bash.test.ts`

- **CONFIRMED** — *Bundled sub-scenarios in `bashSubcommandFires` tests* — lines 426–432 and 442–448 do pack two independent facts into one object; WARNING is the right severity since `deepStrictEqual` still reports both.
- **CONFIRMED** — *`expectedParse` literals never `satisfies`-checked* — verified: 23 literals, zero `satisfies`. `ParseResult` has no compile-time pin anywhere in the repo, so this is its only possible one.

### `tests/bridges/hooks/if-field/glob.test.ts`

- **CONFIRMED** — *Bundling 2–4 match scenarios per case* — accurate, including the self-aware caveat that discrimination is unaffected. I add one supporting detail the first pass did not: the `Object.fromEntries(Object.entries(paths).map(…))` shape at lines 478–483 means a dropped `paths` key surfaces as a key-set mismatch in `deepStrictEqual`, so the bundling is not silently lossy — WARNING, not BLOCKER, is right.

### `tests/bridges/hooks/if-field/index.test.ts`

- **CONFIRMED** — *Barrel re-exports proven by type only* — no `assert.strictEqual` exists; the four value bindings appear exclusively in type position (lines 56–62), so they have zero runtime exercise in their owning test. The four one-line identity assertions the first pass prescribes are the complete fix.
- **CONFIRMED (with a correction to the prescribed remedy)** — *Global built-in prototypes monkey-patched* — real: `String.prototype.endsWith` at 376–391, `RegExp.prototype.exec` at 424–440, both BLOCKER by the style skill's "modifying built-ins or globals" clause. **But the finding's second remedy — "give `compileBashGlob`/`compilePathGlob` an injectable failure seam scoped to the test" — is itself prohibited** by the unit-testing skill ("An export, reset hook, global mutator, state reader, test mode … added for a test is a finding"). The remaining correct options are the two the branch census supports: delete the two unreachable `catch` blocks (`index.ts:278–301`) together with the tests that prop them up, or keep the defensive `catch`es, delete the tests, and record the uncovered lines. This is exactly META-FINDINGS decision item 1; do not let the fixing pass adopt the seam suggestion.
- **CONFIRMED** — *Error asserted by message regex instead of the exact message* — line 691 uses `{ name: "Error", message: /unreachable HookExecResult arm/ }` while `glob.test.ts:271–275` and `715–718` use the exact-message form. The prescribed replacement is correct.
- **CONFIRMED** — *Row arrays reduced with `.map()` inside one case* — 7 cases, accurate line list, WARNING is right per the data-driven-cases rule.
- **CONFIRMED** — *7 `as ExtensionContext` casts* — lines 137, 456, 490, 513, 592, 625, 685 verified. Matches META-FINDINGS ranked item 1 exactly; the cast does not hide a defect (a widened read would crash the case), so WARNING is the correct severity here even though the same root cause is BLOCKER elsewhere.
- **CONFIRMED** — *`assert.equal` at line 503* — one occurrence, verified by grep; trivial WARNING.

### `extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts`

- **CONFIRMED** — *Stale "follow-up plan" documentation* — lines 37 and 47 describe `ifFires` as future work; it is implemented at `index.ts:395`. Also covered by the repo's own comment policy (narration of code that no longer reflects reality).

### `extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts`

- **CONFIRMED** — *Stale "future plan" documentation for the `projectRoot` fallback* — line 49; `compileIfPredicate` is implemented at `index.ts:230`. Note this file carries a *second*, more serious documentation defect the first pass missed — the nonexistent architecture gate, filed as a new BLOCKER above.

### `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts`

- **CONFIRMED** — *File header claims its own implemented functions are future work* — lines 6–8 vs. implementations at 230 and 395.
- **CONFIRMED** — *`ifFires`/`resolveTarget` take the full `ExtensionContext` but read only `.cwd`* — verified by reading both bodies; `resolveTarget` (357–363) touches only `ctx.cwd`, and `ifFires` touches `ctx` only at line 432 and via `resolveTarget`. The prescribed `Pick<ExtensionContext, "cwd">` narrowing is correct and deletes all 7 test casts. Bundle the dead `_claudeEvent` parameter (new WARNING above) into the same edit.
- **CONFIRMED** — *`toolName as PiToolName` cast has no inline justification* — line 428. Beyond the comment the first pass asks for, the cleaner fix is to widen at the call rather than narrow the value: `(predicate.piEvents as ReadonlySet<string>).has(toolName)` states the intent ("membership probe with an arbitrary string") without claiming `toolName` is a `PiToolName`.
- **UNDERSTATED** — *`try`/`catch` around callees documented as "never throws"* — recorded as a documentation-or-delete WARNING. It is stronger than that: the Bash arm's `catch` (`index.ts:282–287`) is **provably unreachable by well-typed input** — `compileBashGlob` executes only `endsWith`/`slice`/`RegExp.test`/`tokenize` on a `string`, none of which can throw — so it is dead code whose sole coverage is a hermeticity break that is itself a BLOCKER. The two findings are one item, and it is the decision-gating item META-FINDINGS already escalates. **Proposed severity: BLOCKER**, resolved together with the prototype-patch finding, not separately.

## Still clean after attack

These modules genuinely resist a wide range of mutations. Named attacks the cases **do** catch:

- **`bash.ts` recursion cap** — `MAX_RECURSION_DEPTH` off-by-one in *either* direction dies. `bash.test.ts:254` pins 7 nested levels succeeding and `:279` pins 8 failing with the exact `{ ok: false, reason: "max recursion depth exceeded" }` object. Textbook boundary pinning.
- **`bash.ts` wrapper vocabulary** — adding `nohup` or `time` to `WRAPPERS_WITH_ARG`, removing `timeout` from it, removing any member of `WRAPPER_STRIP`, or dropping the `xargs`-with-flag exception all fail `bash.test.ts:291, 307, 330, 342`. The "do NOT strip" list (`env`, `sudo`, `npx`, `docker exec`, `find -exec`, …) is pinned member-by-member at `:359`.
- **`bash.ts` dedup and ordering** — removing `new Set(...)` fails `:80`; reordering `recursed.push(piece)` after `pushRecursed` fails `:96`.
- **`bash.ts` interpolation classification** — widening `INTERPOLATION_RE` to catch `$1` fails `:150`; narrowing it to drop `${VAR}` or backticks fails `:134`.
- **`bash.ts` process substitution** — dropping the `$` requirement so `<(...)`/`>(...)` recurse fails `:389`.
- **`glob.ts` segment semantics** — flipping `crossSegment` in either direction dies: path mode at `glob.test.ts:374–397` (`nestedChild: false`), Bash mode at `:51–84` (`pathArgument: true`). Restricting `matchGlobstar` to segment boundaries fails `:627`.
- **`glob.ts` anchor precedence** — reordering any pair of the six `resolveAnchor` arms fails the 6-row loop at `:322–489`; the sibling-prefix trap (`/workspace/project` vs. `/workspace/project-copy`) is pinned at `:390` and `:451`, so removing `stripBase`'s separator check dies.
- **`glob.ts` base normalization** — deleting `path.normalize` fails the loop rows (which feed `"/workspace/project/../project"`); deleting the `absoluteBase === "" ? ""` ternary fails `:551`.
- **`glob.ts` colon sugar** — applying `:*` normalization mid-pattern fails `:86`; not applying it at the tail fails `:51`.
- **`index.ts` MCP shape validation** — every rejection boundary in `matchMcpLiteral`/`matchMcpServerPrefix` (`sepIdx <= 0`, `sepIdx >= body.length - 2`, both segment-regex halves, empty server) has a dedicated row at `index.test.ts:252–344`, and the fall-open results are checked by **identity** (`strictEqual(…, MATCH_ALL_IF)`) not just by shape — stronger than the area's average.
- **`index.ts` substitute-cwd (D-61-03)** — replacing `extractPath(event) ?? ctx.cwd` with a literal `"/"` fails the `missing path at cwd` row; replacing `resolveTarget`'s relative branch with `path.normalize` fails the `relative member` row (`:506–583`).
- **`index.ts` `piEvents` cross-tool sets** — the exact per-prefix membership *and order* (`read/grep/find/ls`, `edit/write`, `write`) is pinned at `:162–243`, so any edit to `IF_PREFIX_TARGETS` dies.
- **Hermeticity** — no filesystem, no network, no timers, no `Date`, no `process.env` reads in any of the three test files. `glob.test.ts`'s corruption tests (`Reflect.deleteProperty` / `Reflect.set` on a *case-owned* compiled object, lines 254/267/711) are a genuinely hermetic way to reach compiler-forced arms and are worth propagating as the alternative to the prototype patching in `index.test.ts`.

## Not covered

- Did not run `node --test`, `npm run test:coverage:direct`, or `npm run check` — the brief forbids it while other agents run. Every coverage and branch claim here comes from reading plus two read-only `node` probes against the real modules; direct per-pair coverage percentages remain unmeasured for this area, consistent with the sweep-wide gap META-FINDINGS records.
- Did not review `bridges/hooks/exec-result.ts` (`assertNever`), `domain/components/hook-if-targets.ts`, `hook-events.ts`, or `hook-tool-names.ts`. They are collaborators of this area but belong to `bridges-hooks-exec-protocol.md` and `domain-components-hooks.md`.
- Did not grade `tests/architecture/hooks-if-field.test.ts` as a test artifact — it belongs to `architecture-hooks-gates.md`. I read it only to settle whether the truth-table gate `glob.ts` claims exists; the finding I filed is against `glob.ts`'s comment, not against that test.
- Whether the unquoted-`$()`-splitting behaviour (new BLOCKER 3) matches upstream Claude Code is an upstream-parity question I could not settle offline; I filed it as a missing pin plus an operator escalation, not as a behavioural bug.

## Meta-findings impact

### New cross-cutting evidence

**1. A sixth "gate that does not gate", and this one backs a risk acceptance.** `glob.ts:15–17` and `glob.ts:42–44` twice name "the architecture test" as the regression gate pinning its truth table, and use that claim to justify accepting a documented `O(text.length ** N)` multi-globstar worst case. No architecture test touches the glob engine (`grep -n "compileBashGlob\|testAbsolute\|globstar" tests/architecture/*.ts` → empty), and no test anywhere bounds pattern complexity. This is the same misattribution shape META-FINDINGS records for `orchestrators/marketplace/info.ts`. **Recommended sweep for other areas:** grep every `extensions/**/*.ts` header for the strings `architecture test`, `is the regression gate`, `the gate`, and `pinned by`, and verify each claim against `tests/architecture/`. Two of two instances found so far were false, which makes this a class rather than a coincidence.

**2. "Documented rejection that does not exist" — check every parse-time fail-open surface.** `compileIfPredicate`'s doc claims it "rejects empty-inner forms"; it does not, and the resulting predicate is fail-**closed** on a surface whose whole contract (D-61-02) is fail-open. Areas to check for the same shape: `domain/components/hooks.ts` (matcher parsing), `bridges/hooks/event-router.ts` (matcher compile), `domain/source.ts` (URL parsing), and any other module whose doc says it "rejects", "validates", or "normalizes away" a degenerate input. The tell is a doc verb with no corresponding guard statement.

**3. "Documented-but-never-populated optional field."** `IfPredicate`'s `match-all` arm carries `reason?: string`, documented as carrying fall-open context; nothing in the repo writes or reads it. This is the mirror image of the silent-omission class the repo already records (adding a member to a closed set compiles clean everywhere) — here a *never-added* member also compiles clean everywhere. **Recommended sweep:** for every optional field on a discriminated-union arm under `extensions/`, grep for a write site; a field with zero producers is either a missing feature or dead surface.

**4. A hermetic replacement for prototype patching, ready to propagate.** `glob.test.ts:251–275, 704–719` reaches `noUncheckedIndexedAccess`- and `assertNever`-forced arms by `Reflect.deleteProperty` / `Reflect.set` on the *object the case itself just built*. No global is touched, nothing leaks past the case. This is directly applicable to the other three files META-FINDINGS lists under decision item 1 (`bridges/commands/{stage,discover}.test.ts`, `orchestrators/marketplace/remove.test.ts`) wherever the forced arm sits behind a value the case owns. Suggest adding it to the "Patterns to propagate" table.

### Corrections to META-FINDINGS.md

- **"Decisions the fixing pass cannot make", item 1** currently reads: *"Four test files monkeypatch global prototypes (`String.prototype`, `RegExp.prototype`, `Symbol.hasInstance`, `Object.prototype`) … `bridges/commands/{stage,discover}.test.ts`, `bridges/hooks/if-field/{bash,glob}.test.ts`, `orchestrators/marketplace/remove.test.ts`."* **Both if-field entries are wrong.** `tests/bridges/hooks/if-field/bash.test.ts` contains no `prototype`, no `t.mock`, and no `Reflect` at all (grep-verified across all three files). `tests/bridges/hooks/if-field/glob.test.ts` uses `Reflect` only on case-owned compiled objects (lines 254, 267, 711) — hermetic, and the good pattern described above. The file that actually patches global prototypes in this area is **`tests/bridges/hooks/if-field/index.test.ts`** (`String.prototype.endsWith` at 376–391, `RegExp.prototype.exec` at 424–440). Replace `{bash,glob}` with `index` in that list.
- **Same item, the framing "the branches are dead defensive code to delete, or they are deliberate and the propping-up tests are the problem"** understates what is now settled for this area: the Bash-arm `catch` at `index.ts:282–287` is *provably* unreachable by well-typed input (`compileBashGlob` executes only `endsWith`/`slice`/`RegExp.test`/`tokenize` on a `string`), so it is not a two-reading judgment call here — it is dead code plus a hermeticity break. The path-arm `catch` at 295–300 is the same, reachable only via a throwing `cwd` getter no production caller can build. The operator decision for if-field is narrower than the general one: delete both `catch`es and both tests, or keep both `catch`es and accept two uncovered lines.

### Confirmations

- **Ranked item 1, "Narrow the over-wide context parameters"** — independently confirmed. `ifFires` (`index.ts:395–400`) and `resolveTarget` (`index.ts:357–363`) read only `ctx.cwd`; the 7 `as ExtensionContext` casts at `index.test.ts:137, 456, 490, 513, 592, 625, 685` are verbatim as recorded. One addition for the ticket: the same signature also carries a **fully dead** `_claudeEvent` parameter (`index.ts:399`, unread across the whole body, supplied by both `dispatch.ts:184, 265` call sites and threaded through 5 test rows that can never observe it). Narrow the context and drop the parameter in one edit.
- **"Clean verdicts are not reliable"** — confirmed from the opposite direction than expected. This area's first pass recorded *zero* clean files, yet the mutation test still found 5 BLOCKERs and 10 WARNINGs it missed, all in files it had already opened and written findings against. The unreliable output is not only the clean list: a file with findings recorded is not thereby a file whose *behaviour* was probed. The first pass's findings here are almost entirely structural (bundling, naming, doc staleness); not one of its 14 findings names a surviving mutation. Recommend adding that qualification to the Provenance section.
- **"Sibling drift is the dominant shape"** — confirmed twice within this three-file area: `glob.test.ts` holds no type proofs while `index.test.ts` holds a complete `satisfies` + `@ts-expect-error` battery, and `index.test.ts` uses no `describe()` while both siblings group by exported entrypoint. In both cases the correct form is 200 lines away in the same directory.
