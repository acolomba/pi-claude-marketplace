# Edge — args, router, register, flag catalog — adversarial re-review

**Scope:** `extensions/pi-claude-marketplace/edge/{args.ts,args-schema.ts,flag-catalog.ts,register.ts,router.ts,types.ts}`, their six paired suites under `tests/edge/`, and `tests/edge/notification-boundary.ts`. I also read the repo's own retained direct-coverage artifact (`coverage/all-pairs-report.ndjson`), the D-116-01a shortfall ledger (`.planning/WINDOWS.md`), and commit `50296404`, none of which the first pass consulted.
**First-pass file:** `unit-test-findings/edge-root.md`
**Clean files attacked:** 8 (5 test, 3 production)
**Existing findings graded:** 7

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 3 |
| New WARNING (missed by first pass) | 7 |
| Existing CONFIRMED | 5 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 1 |
| Existing DUPLICATE-OF | 0 |

The first pass's headline — "the healthiest area reviewed so far" — is directionally right and badly incomplete. These suites are the *output* of a finished refactor milestone (v1.19 phases 116/117; see `git log -- tests/edge/`), so the assertion quality is genuinely high and most mutations do die. But three contract-level holes survive every case, and the one measurable defect in the area was sitting in a committed artifact the first pass never opened: `edge/args.ts` is the single pair here that **fails** `npm run test:coverage:direct` (exit 1), and the first pass listed both halves of that pair as clean.

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/edge/register.ts` (first pass: clean) + `tests/edge/register.test.ts`

- **[BLOCKER] The `SubcommandHandlers` record's 19 key→factory bindings are verified by nothing** — `register.ts:79–99`, `tests/edge/register.test.ts:303–545`
  Eleven of the nineteen values are produced by single-argument factories with the *identical* type `(pi: ExtensionAPI) => (args, ctx) => Promise<void>` (`install`, `uninstall`, `update`, `fetch`, `reinstall`, `list`, `pluginInfo`, `pending`, `marketplaceRemove`, `marketplaceList`, `marketplaceInfo`), so swapping any two of them compiles clean. Two more pairs are parameterized only by a boolean: `enable: makeEnableDisableHandler(pi, true)` / `disable: (pi, false)` (lines 89–90) and `marketplaceAutoupdate: makeAutoupdateHandler(pi, true)` / `marketplaceNoautoupdate: (pi, false)` (lines 97–98). **Every one of these mutations survives the whole suite**: the only case that drives `registration.handler` is line 327, and it sends `"frobnicate"`, which reaches the router's `default` arm and never touches the record. `tests/index.test.ts:555` gets no further — it asserts `typeof command.handler === "function"`. No architecture gate covers it either (`grep -rl SubcommandHandlers tests/` returns only `register.test.ts` and `router.test.ts`).
  The suite header at `register.test.ts:26–28` states the rationale that leaves the hole: *"The handler record it builds is compile-enforced by `SubcommandHandlers`, so a case asserting that record has every key would restate a compiler guarantee and is deliberately absent."* That is true of **key presence** and false of **key→factory binding**, because all nineteen values share one type. Direct coverage reads `branches 15/15, functions 9/9, lines 143/143` for this pair — a clean demonstration that 100% coverage proves nothing about wiring.
  **Fix:** add one data-driven table of 19 rows `{ subcommand, args, expectedUsage }` driving `registration.handler(\`${subcommand} ${args}\`, ctx)` against `createNotificationBoundary(1, 0)` and comparing the whole notification with `assert.deepStrictEqual`. The discriminator already exists and is unique per handler: all 19 handlers emit a distinct `Usage: /claude:plugin …` string (verify with `grep -rn 'Usage: /claude:plugin' extensions/pi-claude-marketplace/edge/handlers/ | sort -u` — 19 distinct lines, including `enable` vs `disable` and `autoupdate` vs `noautoupdate`). Pick per-row arguments that fail parsing for that verb (an unknown long flag such as `--nope` works for the verbs that accept empty args). Do **not** try to discriminate via `Function.prototype.name` — the boolean-parameterized pairs return identically-named closures.

- **[WARNING] Two doc comments claim the completion cwd is captured at registration time; the code and the paired test both say otherwise** — `register.ts:19–20` and `register.ts:104–106`
  Line 19–20 of the header reads *"The cwd captured here is per-command-registration."* and lines 105–106 read *"Captured at registration time; threads through every keystroke's completion lookup via the closed-over resolver."* Neither is true: `process.cwd()` sits **inside** the arrow at line 107–108, so it is read once per completion lookup and `makeLocationsResolver` is constructed fresh each time — nothing is closed over. `tests/edge/register.test.ts:335` (`"resolves argument completions against the working directory the callback runs in"`) exists specifically to prove the per-invocation semantics: it `chdir`s to `laterRoot` *after* registration and expects `invocation-mp`. The comment therefore describes behavior its own pair refutes. Rewrite both to say the working directory is read at each completion lookup, so a later reader does not "restore" the registration-time capture the comment asks for.

### `extensions/pi-claude-marketplace/edge/router.ts` (first pass: clean) + `tests/edge/router.test.ts` (first pass: clean)

- **[BLOCKER] No case proves the router returns the handler's promise** — `router.ts:148–221`, `tests/edge/router.test.ts:114–344`
  Mutate any dispatch arm from `return handlers.install(rest, ctx);` to `void handlers.install(rest, ctx); return;` (the `void` keeps `no-floating-promises` green, so the mutation is lint-clean). All 30 cases stay green: `strong-mock` records the call synchronously, `verify(handlers)` is satisfied, and `notifications` is still `[]`. The same mutation on `case "marketplace": return routeMarketplace(rest, handlers, ctx);` (line 175) is equally invisible. This matters — `register.ts:103` hands the router's promise straight to Pi as the command handler, so fire-and-forget dispatch turns every handler failure into an unhandled rejection and lets Pi report the command finished before it did.
  **Fix:** add two cases, one top-level and one behind `marketplace`, of this shape:
  ```ts
  test("propagates the install handler's failure to its caller (AP-3)", async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
    const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
    const failure = new Error("install failed");
    when(() => handlers.install("alpha@official", ctx)).thenReject(failure);

    // act & assert
    await assert.rejects(
      () => routeClaudePlugin("install alpha@official", handlers, ctx),
      (error: unknown) => error === failure,
    );
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(handlers);
  });
  ```

- **[WARNING] `peelToken` promises whitespace delimiting but no case uses anything but a space** — `router.ts:122–134`, `tests/edge/router.test.ts:254–344`
  `peelToken` uses `trimStart()` and `/\s+/`. Mutating both to space-only (`replace(/^ +/, "")` and `/ +/`) survives every case: `"install   alpha"`, `"   install alpha"` and `"bootstrap   "` are the only separator shapes exercised. The doc comment at line 119 says *"first whitespace-delimited token"*, so the tab case is part of the stated contract.
  **Fix:** turn lines 254–267 into a two-row table adding `{ separator: "a tab", input: "install\talpha@official", expected: "alpha@official" }`, and add one `"\tinstall alpha@official"` row beside line 269.

### `extensions/pi-claude-marketplace/edge/args.ts` + `tests/edge/args.test.ts` (first pass: clean)

- **[BLOCKER] The pair fails the direct-coverage gate today, and the ratified "COMPILER-FORCED" argument that accepts it is wrong** — `args.ts:34–37`, `tests/edge/args.test.ts` (whole file)
  Measured, not inferred: `coverage/all-pairs-report.ndjson` records
  `{"sourcePath":"…/edge/args.ts","testPath":"tests/edge/args.test.ts","verdict":"accepted-shortfall","coverage":"branches 28/29, lines 86/89","exitCode":1}`.
  It is one of exactly 7 non-complete rows out of 204 (190 complete, 7 type-only), and the report artifact post-dates both files (report `2026-09-04 00:38`; `args.ts` `09-03 00:39`, `args.test.ts` `09-02 12:02`), so the reading is current. The uncovered branch and the three uncovered lines are the `if (token === undefined) { i++; continue; }` guard at lines 34–37, which is unreachable: `tokenize` returns a densely-`push`ed `string[]` and the loop condition is `i < tokens.length`, so `tokens[i]` is always a string.
  `.planning/WINDOWS.md` ledger entry 21 accepts this as `COMPILER-FORCED`, arguing *"Removing it needs a non-null assertion, which is an error throughout extensions under strictTypeChecked."* **That argument only holds for the index-loop shape, and the loop does not need to be an index loop.** A `for…of` with one pending-value flag deletes the index read entirely — no assertion, no `as`, and every currently-tested behavior preserved (both diagnostics, `--scope` position independence, and last-wins on a repeated pair):
  ```ts
  const positional: string[] = [];
  let scope: Scope | undefined;
  let awaitingScopeValue = false;

  for (const token of tokenize(args)) {
    if (awaitingScopeValue) {
      awaitingScopeValue = false;
      if (token !== "user" && token !== "project") {
        throw new Error(`Invalid --scope value: "${token}". Must be "user" or "project".`);
      }
      scope = token;
    } else if (token === "--scope") {
      awaitingScopeValue = true;
    } else {
      positional.push(token);
    }
  }

  if (awaitingScopeValue) {
    throw new Error(`--scope requires a value: "user" or "project".`);
  }
  ```
  I filed this as BLOCKER because the skill classifies direct pair coverage below 100% as one, and because the acceptance rests on a premise this rewrite disproves. It is an operator call, not a fixing-pass call — see "Meta-findings impact", where the same disproof extends to ledger entry 22.

- **[WARNING] `args.test.ts` is the only one of the seven shortfall-carrying suites that does not record its own accepted shortfall, and the only `tests/edge/*.test.ts` besides `args-schema.test.ts` with no owner header** — `tests/edge/args.test.ts:1`
  `grep -rln 'D-116-01a' tests/` returns six suites — `completions/data.test.ts`, `completions/provider.test.ts`, `handlers/shared.test.ts`, `handlers/marketplace/update.test.ts`, `handlers/plugin/pending.test.ts`, `handlers/plugin/import.test.ts` — each documenting its shortfall in a header. `tests/edge/args.test.ts`, the **original claimant**, has no comment at all. The ledger says the shortfall is "Pinned by identity in the 116-02 pair"; nothing in the pair pins it — the pinning lived in an archived plan's verify command. Meanwhile `router.test.ts`, `types.test.ts`, `flag-catalog.test.ts` and `register.test.ts` all open with an owner header stating scope, what is delegated to a neighbour, and whether an exhaustiveness claim applies. Add the same header to `args.test.ts` (recording the 34–37 shortfall and its argument) and to `args-schema.test.ts`.

- **[WARNING] Both diagnostics are bare `Error`s, against the repo's typed-error convention** — `args.ts:45`, `args.ts:47`
  `CONVENTIONS.md` states the rule ("typed error classes, one per failure mode … all domain errors live in `shared/errors.ts`"), and callers are told to narrow on `instanceof`, "never on message substring matching". Here the message *is* the contract: `args-schema.ts:29–31` catches everything and renders `errorMessage(err)` straight to the user, so `args.test.ts:176–222` and every downstream handler suite are coupled to two literal strings. This is a design observation, not a coverage lever — `useUnknownInCatchVariables` keeps the catch's residual arm regardless of the thrown class.

### `tests/edge/args-schema.test.ts` (first pass: clean)

- **[WARNING] The `onError` port is a hand-rolled recorder in all 12 cases** — lines 22, 51, 77, 103, 124, 145, 166, 189, 213, 232, 250, 274
  Every case passes `(message) => { usageErrors.push(message); }` and compares the array with `deepStrictEqual`. This is the identical shape the first pass flagged in `register.test.ts` (3 cases) — a callback port whose emissions are the module's public behavior, recorded by hand rather than mocked. See the UNDERSTATED grade below: this file quadruples the finding's scope, and whichever way the operator rules, the two files must move together. Note there is **no in-repo precedent** for a `strong-mock` function mock (`grep -rn 'mock<(' tests/` returns nothing), so this is invention rather than propagation — which is an argument for lowering its priority, not for pretending the two files differ.

- **[WARNING] The module's subtlest export, the `ParsedCommandArgs` conditional mapped type, has no assertion of any kind** — `args-schema.ts:59–63`, `tests/edge/args-schema.test.ts` (whole file)
  Mutating `Entry extends { required: false } ? string | undefined : string` so an optional entry resolves to `string` changes **no runtime behavior at all** and leaves all 12 cases green; the two real consumers (`edge/handlers/marketplace/{update,autoupdate}.ts`, both `{ name: "name", required: false }`) keep compiling — their `parsed.name === undefined` guards simply become statically dead. The pair therefore owns none of the type contract. The in-repo template is one directory over: `tests/edge/types.test.ts` is a pure type owner built from `satisfies` bindings and `@ts-expect-error` negatives. Add the same, e.g.
  ```ts
  const optionalTail = parseCommandArgs("official", {
    positional: [{ name: "marketplace" }, { name: "plugin", required: false }] as const,
    usage: "…",
  }, () => undefined);
  if (optionalTail !== undefined) {
    // @ts-expect-error an optional positional resolves to string | undefined
    const plugin: string = optionalTail.plugin;
    void plugin;
    const marketplace: string = optionalTail.marketplace;
    void marketplace;
  }
  ```

### `extensions/pi-claude-marketplace/edge/flag-catalog.ts` + `tests/edge/flag-catalog.test.ts` (first pass: clean)

- **[WARNING] The `parse`/`complete` visibility split is unexercisable through the module's exports** — `flag-catalog.ts:39–44`, `73–151`, `174–195`
  `grep -rn 'complete: false\|parse: false' extensions/ tests/` returns nothing: every one of the 14 catalog entries sets both bits `true`. So the drop arms of `completionFlagEntries` (`.filter((f) => f.complete)`) and `parseFlagNames` (`.filter((f) => f.parse)`) have no reachable input, `CATALOG` is module-private, and there is no seam to supply one. The module header at lines 30–31 defends it — *"The bits stay separate because a flag MAY legitimately be parse-only, not because one is today"* — which is exactly the speculative configurability `CLAUDE.md` §2 bars. `flag-catalog.test.ts:11–15` honestly records the same fact.
  Worth flagging because V8 does **not** surface it: a `filter` predicate is an expression, not a block, so no branch counter is emitted and the pair reads a clean `branches 11/11, functions 10/10, lines 190/190`. This is a second instance in one area of full coverage over an unverified distinction. Either collapse the two bits into one field until a parse-only flag exists, or record it as an accepted, argued exception the way the D-116-01a shortfalls are recorded.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `edge/args.ts` | `ParsedArgs` | `args.test.ts` — `satisfies` target in all 17 cases | owned |
| `edge/args.ts` | `parseArgs` | `args.test.ts:6`–`:224` | owned (one unreachable branch) |
| `edge/args-schema.ts` | `PositionalSpec` | `args-schema.test.ts` — `satisfies readonly PositionalSpec[]` in all 12 cases | owned structurally; the `required` field's type effect is unasserted |
| `edge/args-schema.ts` | `ParsedCommandArgs` | — | **NO CASE** — compile-time-only contract, never asserted (see WARNING above) |
| `edge/args-schema.ts` | `parseCommandArgs` | `args-schema.test.ts:9`–`:264` | owned |
| `edge/flag-catalog.ts` | `CatalogVerb` | — | incidental — reached only as the argument type of the four function cases |
| `edge/flag-catalog.ts` | `CATALOG_VERBS` | `flag-catalog.test.ts:196` | owned |
| `edge/flag-catalog.ts` | `isCatalogVerb` | `flag-catalog.test.ts:167`, `:184` | owned |
| `edge/flag-catalog.ts` | `SCOPE_TARGET_FLAG` | `flag-catalog.test.ts:95`, `:142` (relation only); literal `"--local"` pinned at `tests/architecture/flag-catalog-drift.test.ts:128–136` | owned — the deliberate circularity at `flag-catalog.test.ts:17–21` is genuinely covered elsewhere |
| `edge/flag-catalog.ts` | `completionFlagEntries` | `flag-catalog.test.ts:65`, `:82`, `:95`, `:114` | owned; drop arm unreachable |
| `edge/flag-catalog.ts` | `parseFlagNames` | `flag-catalog.test.ts:95`, `:114`, `:129`, `:142` | owned; drop arm unreachable |
| `edge/flag-catalog.ts` | `passThroughFlagNames` | `flag-catalog.test.ts:114`, `:142`, `:155` | owned |
| `edge/router.ts` | `SubcommandHandlers` | `router.test.ts` — the `mock<…>` target of 30 cases | owned |
| `edge/router.ts` | `TOP_LEVEL_SUBCOMMANDS` | `router.test.ts:148` | owned |
| `edge/router.ts` | `MARKETPLACE_SUBCOMMANDS` | `router.test.ts:159` | owned |
| `edge/router.ts` | `TOP_LEVEL_USAGE` | `router.test.ts:429` | owned |
| `edge/router.ts` | `MARKETPLACE_USAGE` | `router.test.ts:440` | owned |
| `edge/router.ts` | `routeClaudePlugin` | `router.test.ts:114`–`:427` (30 cases) | owned for dispatch and usage; **promise propagation unowned** |
| `edge/register.ts` | `registerClaudePluginCommand` | `register.test.ts:304`–`:544` | owned for registration, cwd resolution and the TC-7 wrapper; **the handler record unowned** |
| `edge/register.ts` | `registerClaudeMarketplaceTools` | `register.test.ts:548` | owned |
| `edge/types.ts` | `EdgeDeps` | `types.test.ts:77`–`:122` | owned (type-only, correctly) |

## Branch census

**`edge/args.ts`** — measured 28/29.
- `:34` `token === undefined` — **unreachable by real input**, and *not* compiler-forced: the for-of rewrite above removes it without an assertion. This is the one uncovered branch and the three uncovered lines. See the BLOCKER.
- Every other branch is exercised, including both `current.length > 0` flushes (`:75` by `"  install   official  "`, `:84` by `"install 'alpha beta"`) and all three `--scope` value arms.

**`edge/args-schema.ts`** — measured 17/17, 96/96. No untested branch.
- One untested *class*, not a branch: the `catch` at `:29` is maximally broad by design, so any non-diagnostic throw from `parseArgs` would render as a user-facing usage message. Unreachable today (both `parseArgs` throw sites construct `Error`), latent if `parseArgs` grows.
- `out.scope` at `:92` would silently overwrite a positional literally named `scope`. Reachable only by a caller declaring `{ name: "scope" }`; no such caller exists. Reachable-but-unexercised, low value; note it if the schema surface ever widens.

**`edge/flag-catalog.ts`** — measured 11/11. No branch counters exist for the two filter predicates, so the unreachable `complete: false` / `parse: false` data states are invisible to the gate. Classified **unreachable by real data**, not compiler-forced — the fix is deleting a bit or seeding an entry, not an assertion.

**`edge/router.ts`** — measured 37/37. Every arm of both switches, both empty-head guards and both `peelToken` returns are exercised. The gaps here are contract-level, not branch-level: promise propagation and the non-space whitespace class.

**`edge/register.ts`** — measured 15/15, 143/143, 9/9 functions. Both `applyCompletion` guard arms (`isClaudePluginCommandLine` true/false, and the `?? ""` absent-line fallback at `:122`) and both `shouldTriggerFileCompletion` arms are covered. The blind spot is not a branch at all: the 19 straight-line record assignments at `:80–98`.

**`edge/types.ts`** — type-only; emits no JavaScript, verdict `type-only`. Correct.

## Grading of first-pass findings

### `tests/edge/register.test.ts`
- **UNDERSTATED** — *Hand-rolled recorder used for a prescribed collaborator call* — real, and WARNING is the right severity, but the scope is four times what is recorded. The identical shape — a callback port whose emissions are the module's public behavior, recorded into a local array and compared with `deepStrictEqual` — covers all 12 cases of `tests/edge/args-schema.test.ts` (lines 22, 51, 77, …, 274), a file the first pass declared clean. Two corrections to the fix instruction: (a) the repo has **no** existing `mock<(…) => …>` function mock, so converting `args-schema.test.ts`'s bare `onError` callback is invention, not propagation — the operator should rule once, for both files; (b) the first pass's claim that the other three `current`-based cases (lines 436–463, 465–492, 523–544) need no change is correct and I verified it.

### `tests/edge/notification-boundary.ts`
- **REFUTED** — *Cross-layer utility misplaced at the edge layer root* — the placement is a recorded decision, not an accident. Commit `50296404` ("refactor(117-03): move the Pi notification boundary into tests/edge") moved this file *out of* `tests/helpers/` and *into* `tests/edge/` on purpose: *"SUITE-02 bars a generic test-support directory. 22 of this module's 26 consumers are edge suites, so D-117-04 sends it beside them,"* and the four orchestrator suites' cross-tier imports are explicitly sanctioned by D-117-05 in the same message. The proposed destination is worse than the status quo on the review's own rules — `.agents/skills/typescript-unit-testing-review/SKILL.md:95` names `test/shared/` as a finding in the same breath as `test/helpers/`. The header comment the first pass cites says whose *contract* the file encodes, which is not a claim about where it should live.

### `extensions/pi-claude-marketplace/edge/args.ts`
- **CONFIRMED** — *`ParsedArgs` fields are not `readonly`* — `PositionalSpec` (`args-schema.ts:54,56`), `FlagEntry` (`flag-catalog.ts:40–43`) and `EdgeDeps` (`types.ts:24–28`) all declare theirs `readonly`; `ParsedArgs:22–23` is the lone holdout in the layer.
- **CONFIRMED** — *`parseArgs` and `ParsedArgs` carry no JSDoc* — `args.ts` is the only edge-root module whose exports are documented solely by a `//` file header; `args-schema.ts`, `flag-catalog.ts`, `router.ts`, `register.ts` and `types.ts` all carry per-export `/** */` blocks.

### `extensions/pi-claude-marketplace/edge/args-schema.ts`
- **CONFIRMED** — *JSDoc block anchored to the wrong declaration* — the block at lines 35–52 ends with an `Example:` that calls `parseCommandArgs` by name, and sits above `export interface PositionalSpec` at line 53; `parseCommandArgs` at line 65 has no attached doc.
- **CONFIRMED** — *Uncommented type assertion* — `return out as ParsedCommandArgs<Spec>;` at line 95. The reason (a `Record<string, string | undefined>` accumulator standing in for a mapped conditional type TypeScript cannot verify key-by-key) is real but not readable from the line, which is exactly the Google-style test.

### `extensions/pi-claude-marketplace/edge/flag-catalog.ts`
- **CONFIRMED**, with one addition to the fix — *Inline anonymous return type instead of a named interface* — `completionFlagEntries` at line 174 returns `{ name: string; description?: string }[]`. Beyond the naming point, that anonymous shape declares `description` **optional** while `FlagEntry.description` (line 41) is **required**, so the published return type is weaker than anything the function can produce, and it silently contradicts the module's own claim at lines 36–37 and 172–173 that no presence test is needed. Extract `interface CompletionFlagEntry { readonly name: string; readonly description: string; }` — required, not optional — and note that this alone would have made `edge/completions/provider.ts:125` (ledger entry 17, an accepted shortfall whose "empty-object arm" exists precisely because the element type keeps `description` optional) closable.

## Still clean after attack

- `tests/edge/router.test.ts` — the strongest suite in the area. Mutations it catches: misrouting any arm (`case "info": return handlers.list(…)`) fails on the unexpected member; handing the un-peeled `args` instead of `rest` fails on `exactParams`; changing the usage-error severity from `"error"`, or dropping a single line from either usage block, fails the two hand-written `EXPECTED_*` constants; a handler firing on a usage-error path fails because those cases state no expectation at all (the D-116-06 reasoning at lines 8–11 is correct — `times(0)` would not prove it); collapsing `ls` into `marketplaceList` fails the four shadow-token rows at lines 226–252.
- `tests/edge/flag-catalog.test.ts` — catches: reordering any `CATALOG` entry (declaration-order `deepStrictEqual` at lines 65 and 196); returning a cached rather than a fresh `Set` (the aliasing case at line 129 — a genuinely good check the first pass did not credit); dropping `description` from a completion entry; implementing `isCatalogVerb` with `in` instead of `Object.hasOwn` (the `toString`/`constructor` rows at line 179); failing to drop the scope-target flag in `passThroughFlagNames`.
- `tests/edge/types.test.ts` — correctly type-only and genuinely load-bearing: making `importClaudeSettings` required breaks the positive `satisfies` at line 77; dropping any `readonly` turns the three `@ts-expect-error`s at lines 114–119 into unused-directive errors; widening either the import hook's parameter or its return breaks the negatives at lines 99 and 109.
- `tests/edge/args.test.ts` — catches every tokenizer mutation I could construct: quote-state swaps (lines 92, 104), the space flush (line 128), the trailing flush (line 164), backslash non-escaping (line 116), emitting `scope: undefined` instead of omitting the key (whole-value `deepStrictEqual` throughout), first-wins instead of last-wins on a repeated `--scope` (line 224), and both diagnostics by exact message. Its only defect is the unreachable guard it cannot reach.
- `tests/edge/args-schema.test.ts` — catches: reading `entry.required === true` instead of `!== false` (line 153); dropping the trim check on either the required or the optional arm (lines 132, 176); emitting more than one usage error or the wrong one (whole-array compare, and the cases use distinct usage strings); reaching positional validation after a tokenizer throw (line 240); returning `{}` instead of `undefined` on failure.
- `tests/edge/register.test.ts` — for everything except the handler record, this is a model suite. Catches: capturing cwd at registration time (line 335 — a case built specifically to kill that mutation); dropping the `isClaudePluginCommandLine` guard so foreign lines get normalized (line 436); `?? false` instead of `?? true` on the trigger fallback (line 523); registering under a different command or event name (strict `It.willCapture` beside hand-stated names); reversing the two tool registrations (line 548). Hermeticity is well handled — `t.after` is registered before every global mutation, `HOME` and `PI_CODING_AGENT_DIR` are both saved-and-restored, and the `https.request` trap at line 144 is honestly labelled a device rather than an offline proof.

## Not covered

- No test, lint, typecheck, or coverage command was run — the tree had to stay untouched. Every measurement quoted comes from the repo's own retained artifact `coverage/all-pairs-report.ndjson` (gitignored, generated `2026-09-04 00:38`), from static reading, or from git history.
- One freshness caveat on that artifact: `tests/edge/flag-catalog.test.ts` was modified at `2026-09-04 01:45`, **after** the report was generated, so its `complete` verdict is one revision stale. The other five edge-root pairs all predate the report and their readings are current.
- `tests/edge/completions/` and `tests/edge/handlers/` remain out of scope. I opened `edge/handlers/shared.ts:42–89` only far enough to test whether the D-116-01a "compiler-forced" argument generalizes (it does not); the owning area should confirm the rewrite before acting.
- I did not attempt to compile the proposed `parseArgs` rewrite. It is argued from the typing rules (`for…of` yields `T`, not `T | undefined`, so `noUncheckedIndexedAccess` never applies), not from a run.

## Meta-findings impact

### New cross-cutting evidence

**1. The direct-coverage gate has already been run and its results are committed to the working tree — META-FINDINGS.md says otherwise.** `coverage/all-pairs-report.ndjson` holds 204 measured rows: 190 `complete`, 7 `type-only`, 7 `accepted-shortfall` with `exitCode: 1`. **All seven shortfalls are in `edge/`:** `edge/args.ts`, `edge/completions/data.ts`, `edge/completions/provider.ts`, `edge/handlers/marketplace/update.ts`, `edge/handlers/plugin/import.ts`, `edge/handlers/plugin/pending.ts`, `edge/handlers/shared.ts`. Regenerate with `npm run test:coverage:direct:report`. **Every area file's coverage claims can now be checked against measurement instead of reading**, and the four other `edge/*` area reviewers should be told their area owns 100% of the repo's coverage debt.

**2. Two of the seven accepted D-116-01a shortfalls are misclassified as COMPILER-FORCED and are closable without an assertion.** `.planning/WINDOWS.md` ledger entries 21 (`edge/args.ts:34`) and 22 (`edge/handlers/shared.ts:53`) both argue *"Removing it needs a non-null assertion, which is an error throughout extensions under strictTypeChecked."* Both are `while (i < tokens.length) { const t = tokens[i]; if (t === undefined) …}` index loops over a densely-built `string[]`. `for…of` types the element as `T`, not `T | undefined`, so a for-of loop plus one small state flag (a pending `--scope` value in `args.ts`, a `skipNext` in `extractLocalFlag`) removes the guard with no assertion and no behavior change — `extractLocalFlag` is a pure scanner whose `residualArgs` is recomputed from `tokens` at line 88, independent of the loop. The remaining five entries look genuinely forced (`Array.prototype.at()` typing, `useUnknownInCatchVariables`, a single indexed read that has no iteration to convert), so this is a two-of-seven correction, not a wholesale one. This lands squarely on META-FINDINGS.md's "Decisions the fixing pass cannot make" item 1 and should reach the operator with the ledger, not the test backlog.

**3. A defect class the coverage gate is structurally blind to, found twice in one small area: same-typed straight-line wiring.** `register.ts:79–98` maps 19 keys to 19 values that share one type; `flag-catalog.ts` carries a two-bit visibility split no datum distinguishes. Both read 100% on every counter. Wherever a module builds a record of same-typed collaborators or a table of same-shaped config, coverage proves nothing and only a behavioral discriminator does. **Check for it in:** `edge/handlers/tools.ts` (two tool registrations), `orchestrators/reconcile/apply.ts` (action-bucket → operation dispatch), `transaction/phase-ledger.ts`'s five-element phase array in `orchestrators/plugin/install.ts:1260` (five `Phase<C>` objects of one type, where a reordering or a `do`/`undo` swap would be invisible to coverage), and every `bridges/*/index.ts` barrel.

**4. Doc comments in this repo lie in a third direction META-FINDINGS.md has not catalogued: a *rationale* that is true of a narrower claim than the one it licenses.** `register.test.ts:26–28` correctly says key presence is compile-enforced, and uses that to justify omitting a case — but the hole it leaves is key→value binding, which is not compile-enforced. Same shape at `register.ts:105` (a factual claim about `process.cwd()` that its own paired test refutes). Reviewers should read every "deliberately absent" / "restates a compiler guarantee" justification against what the compiler actually enforces; these suites carry many of them and they are load-bearing.

### Corrections to META-FINDINGS.md

- **"Direct per-pair coverage was never measured. … no reviewer ran `npm run test:coverage:direct` … Every coverage claim here is from reading, not measurement. Running the direct-coverage gate is a distinct, still-outstanding task."** — Contradicted. `coverage/all-pairs-report.ndjson` (204 rows, generated `2026-09-04 00:38`) is in the tree with per-pair function/line/branch counts and exit codes. The task is not outstanding; the artifact just was not opened. Replace that bullet with the 190/7/7 breakdown and the seven named modules.

- **"Decisions the fixing pass cannot make → 1. Unreachable branches and prototype surgery"** — Incomplete. The section lists four test files that monkeypatch global prototypes. It does not mention that the repo already has a **formal, ratified, seven-entry ledger** of unreachable branches (`.planning/WINDOWS.md` entries 15–19, 21, 22, under D-116-01a, which bans coverage-exception pragmas outright), each with a written argument. That ledger is the existing decision framework for exactly this class, and two of its entries are wrong on the facts (above). Any operator decision on unreachable branches should start from it.

- **"Test support organization"-driven finding in `edge-root.md`** — the recommendation to move `tests/edge/notification-boundary.ts` to `tests/shared/` should be struck from any consolidated backlog: it reverses commit `50296404`/D-117-04 and targets a directory the review skill itself bans.

### Confirmations

- **"Clean verdicts are not [reliable]"** — confirmed hard. Of the 8 files the first pass declared clean here, 6 yielded new findings, including all 3 new BLOCKERs and the one measurable, currently-failing gate in the area. The 2 that survived (`types.test.ts`, `flag-catalog.test.ts`'s test half) survived named attacks, which is a different and much stronger kind of clean.
- **"The dominant shape: sibling drift"** — confirmed from a second angle, and it is finer-grained than "one file vs. its siblings". Within `tests/edge/`, `args.test.ts` and `args-schema.test.ts` are the only two suites with no owner header; `args.test.ts` is the only one of seven shortfall-carrying suites that does not record its own shortfall; `args-schema.test.ts` is the only edge-root suite with no type-level assertion where its module's subtlest export is a type. All three drifts land on the same two files, and those are also the two oldest rewrites in the directory (`c32f8c41`, `7d1a065b`) — drift here correlates with rewrite order, so the *earliest* files of a refactor wave are where to look.
- **"Strict interaction mocking … reference implementation: `tests/orchestrators/**`, `tests/edge/handlers/plugin/**`, `tests/index.test.ts`"** — `tests/edge/router.test.ts` belongs in that table. It is a cleaner exemplar than any listed, because it also demonstrates the *silence proof* the table credits only to `reconcile/notify.test.ts` (a strict mock with **no** expectation, at `router.test.ts:353`, plus the explicit written argument at lines 8–11 for why `times(0)` would not do). Add it as the reference for "proving a collaborator was not called".
- **"`tests/edge/handlers/marketplace-seed.ts` — a double cast strips structural type checking"** — indirectly reinforced: `tests/edge/types.test.ts` shows the opposite technique done right (typed `satisfies` stubs imported from the same modules production imports them from, so a seam change is a compile error rather than a stale hand-copy). It is the in-repo answer to that finding and should be named as its reference implementation.
