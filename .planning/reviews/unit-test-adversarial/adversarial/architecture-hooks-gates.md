# Architecture — hooks gates — adversarial re-review

**Scope:** the 8 assigned `tests/architecture/hooks-*.test.ts` + `no-hooks-strict-additional-properties.test.ts` gates, the 7 production modules the first pass listed as **Clean files**, and — because a production module can only be mutation-tested against the cases that actually cover it — the paired test modules those 7 exports live in (`tests/bridges/hooks/{dispatch-exec,translation-context}.test.ts`, `tests/bridges/hooks/async-rewake/pid-table.test.ts`, `tests/bridges/hooks/if-field/index.test.ts`, `tests/domain/components/{hooks,hook-events}.test.ts`, `tests/domain/components/hooks/schema.test.ts`), plus targeted reads of `tests/domain/resolver.test.ts`, `tests/persistence/{state-io,migrate}.test.ts`, `tests/shared/notify.test.ts`, `tests/bridges/hooks/{event-router,async-rewake/registry}.test.ts` and `eslint.config.js` to settle duplication claims.
**First-pass file:** `unit-test-findings/architecture-hooks-gates.md`
**Clean files attacked:** 7 (the entire production clean list; the test clean list was empty)
**Existing findings graded:** 18

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 4 |
| New WARNING (missed by first pass) | 13 |
| Existing CONFIRMED | 9 |
| Existing UNDERSTATED | 2 |
| Existing OVERSTATED | 3 |
| Existing REFUTED | 1 |
| Existing DUPLICATE-OF | 3 |

**Headline:** the production clean list did not survive. Of 7 files declared clean, **3 already carry recorded findings in other areas' files** (`if-field/index.ts` — 4 findings incl. the META-FINDINGS §1 cluster; `hooks/schema.ts` — 3 findings; `hooks.ts` — 1), **2 more** (`translation-context.ts`, `dispatch-exec.ts`) carry a fresh instance of that same §1 cluster that *two* independent reviewers each declared clean, and mutation testing found undetected behavior changes in `dispatch-exec.ts`, `domain/components/hooks.ts`, and `hooks/schema.ts`. Only `hook-events.ts` and `pid-table.ts` came close to holding up.

---

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`

- **[BLOCKER] An overflowing child's parseable stdout is honored undetected** — `dispatch-exec.ts:402`, cases at `tests/bridges/hooks/dispatch-exec.test.ts:1626`, `:1678`, `:1719`
  Deleting the `if (overflowed) { settle({ kind: "noop" }); return; }` short-circuit from the `close` handler leaves all three overflow cases green. All three close the child with `code = null`, and `parseHookStdout` (`wire-protocol.ts:42`) returns `{ kind: "noop" }` for any non-zero/null exit before it ever looks at stdout — so the guard is never the reason those cases pass. The guard's real promise ("a child that misbehaved does not get to steer the turn") is untested: a child that writes a valid decision envelope, *then* overflows, *then* exits 0 would be obeyed.
  Fix: add one case to `dispatch-exec.test.ts` that writes `'{"decision":"block","reason":"partial"}'` to `child.stdout`, then writes `Buffer.alloc(1024 * 1024 + 1)` to `child.stderr`, then `await processChild.close(0)`, and asserts `assert.deepStrictEqual(hookOutcome, { kind: "noop" })`. Without the guard that case yields `{ kind: "block", reason: "partial" }`.

- **[BLOCKER] The `asyncRewake === true` strict discriminator is never exercised, and the case title over-claims it** — `dispatch-exec.ts:169`, `test('delegates only literal async true and preserves absent async stdin')` at `tests/bridges/hooks/dispatch-exec.test.ts:1012`
  The module header (`dispatch-exec.ts:156-158`) states the contract explicitly: "any non-`true` value -- including a string `"yes"` -- flows to the sync EXEC-01..04 path". Every `asyncRewake` value in the file is `true` (lines 1023, 1074, 1114, 1175) or `false` (line 171); `makeEntry`'s parameter is typed `asyncRewake?: boolean` (line 515), which structurally prevents the case the title claims. Mutating `=== true` to `Boolean(entry.handlerDecl.asyncRewake)` leaves the whole file green.
  Fix: widen `makeEntry`'s input to `asyncRewake?: unknown` (the field is `unknown` on `HookHandlerEntry` anyway), then add sibling rows for `"yes"` and `1` asserting the **sync** path ran — `processBoundary.calls[0].options.stdio` present and `processChild.stdinChunks` non-empty — which the async lane never produces.

- **[WARNING] The `lane: "blocking"` argument is unverified, and so is its mirror `lane: "background"`** — `dispatch-exec.ts:305` and `async-rewake/registry.ts:249`
  `resolveTimeoutSeconds` (`timeout.ts:111-114`) only consults `lane` when `raw` is unusable, and only `UserPromptSubmit` (30 s) and `SessionEnd` (1.5 s) differ from the 600 s default (HKTO-01). No case in `dispatch-exec.test.ts` combines an omitted `timeout` with one of those two events *and* a timer assertion — the only exact `timerDelays` assertion (`:293`, `[37_000, 42_000]`) uses an explicit `timeout: 37`. `registry.test.ts` has no `timerDelays` assertion at all. Swapping the two literals across the two files changes no test.
  Fix: in `dispatch-exec.test.ts` add a case with `makeEntry(caseRoot, { claudeEvent: "SessionEnd" })` (no `timeout`), `t.mock.timers.enable({ apis: ["setTimeout"] })`, and assert SIGTERM at `tick(1_500)` and SIGKILL at `tick(6_500)`. In `registry.test.ts` add the mirror asserting the same entry gets 600 s on the background lane.

- **[WARNING] `dispatchHookExec` takes the full `ExtensionContext` and reads only `cwd` + `sessionManager`** — signature at `dispatch-exec.ts:146-152`
  Tracing the body: `ctx` reaches `buildTranslationContext(ctx)` (reads `sessionManager`, `cwd`), `locationsFor(entry.scope, ctx.cwd)`, and `spawnAndRegister(..., ctx, ...)`. Nothing else. The cost is visible: `makeContext` (`dispatch-exec.test.ts:541-582`) is 42 lines of throwing-getter boilerplate, and the first case repeats the same shape inline at `:183-221`. Narrow to `Pick<ExtensionContext, "cwd" | "sessionManager">` (threading the same narrowing into `spawnAndRegister`) and both harnesses collapse to `{ cwd, sessionManager }`. This is a fresh instance of META-FINDINGS §1, in a module **two** reviewers declared clean.

- **[WARNING] The overflow diagnostic and the unreachable `spawnImpl` default are unexercised** — `dispatch-exec.ts:349` and `:297`
  (a) `hookDebugLog("exec: <which> overflow ...")` can be deleted with no case failing — none of the three overflow cases calls `observeDebug`. (b) `spawnAndCollect(..., spawnImpl: typeof spawn = spawn)` declares a default that the sole call site (`:206`) always overrides; the default is dead. Fix (a): add the diagnostic assertion to `test('removes listeners and immediately escalates one-byte stdout overflow')` using the existing `observeDebug`/`debugLines` helpers. Fix (b): drop `= spawn`.

### `extensions/pi-claude-marketplace/domain/components/hooks.ts`

- **[BLOCKER] `ifPredicateMapKey` can swap group and handler indices undetected by either paired test** — `hooks.ts:173-179`
  Mutating the key to `` `${claudeEvent}|${handlerIndex}|${groupIndex}` `` leaves `tests/domain/components/hooks.test.ts` green (its only `if`-bearing survivor is at group 0 / handler 0 — `:167`) **and** leaves `tests/bridges/hooks/event-router.test.ts` green (`predicateKeys: ["PreToolUse|0|0"]`, `:839`). The consequence is silent mis-routing: at dispatch a handler gets another handler's `if` predicate, so a hook fires (or fails to fire) on the wrong condition. The **only** case in the repo that kills this mutation is `tests/architecture/hooks-if-field.test.ts:131-134`, which asserts keys `PreToolUse|0|0`, `PreToolUse|1|0`, `PreToolUse|1|1`. Relocating that test as the first pass advises, without preserving the multi-index keys, deletes the only coverage.
  Fix: add a case to `tests/domain/components/hooks.test.ts` whose config has **two groups**, the second with **two `if`-bearing handlers**, and `assert.deepStrictEqual` the whole `ifPredicates` Map against a hand-written `new Map([["E|0|0", …], ["E|1|0", …], ["E|1|1", …]])`.

- **[WARNING] `isPluginWrapper`'s array guard on the inner value has no case** — `hooks.ts:134`
  Removing `&& !Array.isArray(inner)` changes `parseHooksConfig('{"hooks": []}')` from `{ ok: true, value: {}, dropped: [{kind:"event", event:"hooks"}] … }` (bare-shape arm: `"hooks"` read as an unsupported event key) to `{ ok: false, reason: "hooks.json failed schema validation: <root>: must be object" }`. No case covers a `hooks` key whose value is an array. Fix: add a row to the existing rejects/accepts tables in `tests/domain/components/hooks.test.ts` for `'{"hooks":[]}'` asserting the whole discriminated result.

- **[WARNING] Four exported types and four runtime re-exports have zero coverage in the paired test — sibling drift** — `hooks.ts:52-59`, `:81`, `:100`, `:167`, `:193`
  `tests/domain/components/hooks.test.ts` (383 lines) contains no `satisfies` check, no `@ts-expect-error`, and no re-export identity assertion. Its three sibling modules all do the opposite: `tests/domain/components/hook-events.test.ts:16-27` (8 `satisfies`/`@ts-expect-error` pairs), `tests/domain/components/hooks/schema.test.ts:10-30` (9), `tests/bridges/hooks/if-field/index.test.ts:52-104` (type identity + 6 negatives). And the barrel-identity convention already exists in-repo at `tests/bridges/hooks/index.test.ts:83-161` (`assert.strictEqual(reExport, source)` per symbol).
  Fix: add `satisfies`/`@ts-expect-error` blocks for `CompileIfPredicateContext`, `CompileIfCallback`, `CompiledIfPredicateMap`, and both arms of `HookConfigParseResult`; add `assert.strictEqual` binding-identity assertions for `parseMatcher`, `HOOKS_CONFIG_SCHEMA`, `HOOKS_VALIDATOR`, copying the shape at `tests/bridges/hooks/index.test.ts:83`.

- **[WARNING] `CompileIfPredicateContext` is a deliberate structural duplicate with no compile-time pin** — `hooks.ts:81-85` vs `bridges/hooks/if-field/index.ts:135-139`
  The header (`hooks.ts:75-80`) says the duplication is intentional (D-11 import direction) but nothing pins the two shapes together, unlike the sibling case in `hook-events.ts:51`, which uses `as const satisfies readonly ClaudeHookEvent[]` for exactly this problem (SURF-02 / D-63-06). Only a *widening* of the bridge-side type is caught (contravariantly, at the `compileIfPredicate` call site); a widening of the domain-side type is silent. Fix: add a `Same<>`-style type-identity assertion in `tests/domain/components/hooks.test.ts` against the bridge type, mirroring `tests/bridges/hooks/if-field/index.test.ts:52`.

### `extensions/pi-claude-marketplace/domain/components/hooks/schema.ts`

- **[WARNING] `HOOKS_CONFIG_SCHEMA` is exported with zero production consumers — the export exists only for a test** — `schema.ts:57`, re-export at `hooks.ts:55`
  Repo-wide grep for the identifier returns: the declaration; two same-file uses (`Type.Static`, `Compile`); a pass-through re-export in `hooks.ts`; and `tests/architecture/hooks-foundation.test.ts:19,144`. No production module outside `schema.ts` reads it. That is the Google-style "every export is used outside its module" rule and the unit-testing rule "an export added for a test is a finding", both violated at once, plus a redundant second hop in `hooks.ts`. `fallow dead-code` will not report it (`.fallowrc.json` sets `production: false`, so a test-only consumer counts as a consumer).
  Fix: either de-export it from `schema.ts` and `hooks.ts` and rewrite the HOOK-03 structural walk in terms of `HOOKS_VALIDATOR`, or accept the export and document it as the introspection surface the HOOK-03 gate requires.

- **[WARNING] The handler schema's unconditional `command: { type: "string" }` constraint has no case** — `schema.ts:25`
  Removing that one property (leaving the conditional `then` branch at `:37-41` intact) leaves every row of `tests/domain/components/hooks/schema.test.ts` green: the `then` branch still rejects `{ type: "command", command: 1 }`, and no row ever pairs a non-`command` handler type with a non-string `command`. Fix: add a reject row `{ role: "a non-command handler with a non-string command", config: { PreToolUse: [{ hooks: [{ type: "future-handler", command: 1 }] }] } }`.

### `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts`

- **[WARNING] `buildTranslationContext` takes the full `ExtensionContext` and reads three fields off two of them** — `translation-context.ts:54-60`
  It reads `ctx.sessionManager.getSessionId()`, `ctx.sessionManager.getSessionFile()`, `ctx.cwd`. Nothing else. The cost is the whole test file: `tests/bridges/hooks/translation-context.test.ts` builds the full 16-member `ExtensionContext` with throwing getters **twice** (`:80-118` and `:142-180`), ~78 lines of boilerplate for a 6-line function. Narrowing to `Pick<ExtensionContext, "cwd" | "sessionManager">` collapses both harnesses to a two-field literal.
  This module was declared clean by **two** independent reviewers (this area and `bridges-hooks-exec-protocol.md:57`), and it is a textbook instance of META-FINDINGS' single highest-leverage cluster. It is the clearest evidence in this pass that the §1 cluster is under-counted.

### `extensions/pi-claude-marketplace/domain/components/hook-events.ts`

- **[WARNING] A doc comment claims an observable ordering contract for a module-private tuple** — `hook-events.ts:100-102`
  "Order matches `BUCKET_A_EVENTS` as a deterministic registration order for downstream consumers." `DISPATCHABLE_EVENTS` (`:104`) is not exported, and its only reader is `new Set(...)` at `:133`, which discards order. No downstream consumer can observe it. Contrast `BUCKET_A_EVENTS` (`:40`), whose order genuinely is observable and *is* pinned (`tests/domain/components/hook-events.test.ts:30`). Fix: either export the tuple (which would also fix the finding below) or delete the ordering claim.

### `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts`

- No new *defect*. See "Branch census" for the three `assertPathInside` calls, which are classified unreachable-by-real-input rather than untested. The two recorded findings against this module both belong to `bridges-hooks-async-rewake.md`.

### `tests/architecture/hooks-dispatch.test.ts` (gate holes — inert-gate cluster)

- **[BLOCKER] The OBS-01 no-console-override gate has two bypasses, and nothing else in the suite covers `console.log`/`console.warn`/`console.debug`** — `test('OBS-01 limits extension no-console overrides to the documented files')`, lines 42–75
  (a) The scan only collects a config block when its `files:` array source literally contains `extensions/pi-claude-marketplace` (`:56`). A block written `{ files: ["**/*.ts"], rules: { "no-console": "off" } }` grants a blanket override across the whole extension tree and is skipped by `continue` — the gate stays green. (b) The `no-console` probe reads only `source.slice(match.index, match.index + 600)` (`:60`). `eslint.config.js`'s BLOCK A rules span ~1,700 characters before its `no-console` key; any new extension-scoped block that lists a long `no-restricted-syntax` array before `"no-console": "off"` is likewise skipped silently.
  Neither hole is covered elsewhere: the sibling test at `:22` scans only for `console.error`, and a repo-wide grep of `tests/architecture/` finds **no** gate scanning the extension tree for `console.log`, `console.warn`, `console.debug`, or `console.trace`.
  Fix: replace the regex scrape with a programmatic load of the flat config (the technique `tests/architecture/import-boundaries.test.ts` already uses for zones): import `eslint.config.js`, filter to entries whose `rules["no-console"] === "off"`, and `assert.deepStrictEqual` the sorted union of their `files` globs against an expected literal — which catches `**/*.ts` and is immune to key ordering. Additionally extend the `:22` source scan to `console\.(log|warn|debug|trace|error)` with an exact expected offender list (`shared/debug-log.ts`, `persistence/migrate.ts`, `shared/notify.ts`).

- **[WARNING] Test 3's `callSites.length > 0` is an existence assertion that a real regression passes** — line 95
  `parseHooksConfig` has two `hookDebugLog` call sites (`hooks.ts:246` invalid JSON, `hooks.ts:260` schema failure). Deleting either leaves a silent failure path, keeps `callSites.length > 0` true, and is not caught by `tests/domain/components/hooks.test.ts` either — that file never sets `PI_CLAUDE_MARKETPLACE_DEBUG` and only asserts the returned `reason`. Fix: assert the behavior, not the source text — add debug-diagnostic assertions to the two `parseHooksConfig` reject cases in `tests/domain/components/hooks.test.ts` using the `recordHookDiagnostics` pattern already established at `tests/bridges/hooks/async-rewake/pid-table.test.ts:61-69`, and reduce this gate to the two source-text claims at `:93-94`.

- **[WARNING] `collectTypeScriptFiles` hand-rolls a walker instead of using the shared scanner** — lines 6–20. `tests/architecture/source-scan.ts` exists for exactly this. See "Meta-findings impact" for the corrected repo-wide count.

### `tests/architecture/no-hooks-strict-additional-properties.test.ts`

- **[WARNING] `stripComments` and `REPO_ROOT` are byte-duplicates of the shared scanner, and the whole gate should be one `assertNoForbiddenSurface` call** — lines 26–41
  `stripComments` (`:37-41`) is character-identical to `tests/architecture/source-scan.ts:42-46` (same two regexes, same order, same trailing comments); `REPO_ROOT` (`:26`) is identical to `source-scan.ts:29-32`. More importantly, `assertNoForbiddenSurface` carries a WR-06 guarantee this hand-rolled gate lacks: a target that does not exist **fails** rather than greening over zero inspected bytes — the same failure family as the wrong-file BLOCKER below.
  Fix (folds in the BLOCKER's fix): replace lines 26–57 with
  `await assertNoForbiddenSurface(["extensions/pi-claude-marketplace/domain/components/hooks/schema.ts", "extensions/pi-claude-marketplace/domain/components/hooks.ts"], [{ name: "strict additionalProperties", pattern: /additionalProperties\s*:\s*false/ }], (offenders) => \`HOOK-03 …\`)` and delete the two local helpers.

### `tests/architecture/hooks-lifecycle.test.ts`

- **[WARNING] `assertMutatorFollowedByRebuilder` checks only the FIRST call site, then returns** — lines 89–118, specifically the `return` at `:114`
  Blocks A–D pin one call site per file. `install.ts` already has two mutation sites (`removePluginConfigFromCache(` at `:1332`, `readAndCachePluginHooks(` at `:2254`) and Block A pins only the second (its `HELPER_FORMS.find` picks `readAndCachePluginHooks(` first). The moment any file gains a second `removePluginConfigFromCache(` site without an adjacent rebuild, Blocks B/C/D pass and Block F's per-file co-occurrence check passes too. Fix: drop the `return`, accumulate one offender string per unpaired call site, and make a single `assert.deepStrictEqual(offenders, [])` at the end — the same accumulate-then-one-assert shape `source-scan.ts:99` uses.

- **[WARNING] The header claims a lock-scope guarantee the technique cannot provide** — lines 10–14
  "The bounded window forces the call-site to live INSIDE the same per-plugin lock body rather than in an entirely different code path." A 20-line textual window proves textual proximity, not block membership: a `rebuildRoutingTables()` fifteen lines later can sit after the lock closes and the gate is satisfied. Fix: restate the comment as what the check is ("asserts the rebuild follows within N non-comment lines, which keeps the two edits adjacent in review") and drop the lock-scope claim.

- **[WARNING] Block E's ordering assertions are vacuous if the named callees are renamed** — lines 280–284
  `assert.ok(loadIdx < 0 || deleteIdx < loadIdx)` and its `hydrateIdx` twin pass trivially when the token is absent. Renaming `loadState` disables half the WR-01 ordering gate silently, with no failure to signal it. Fix: assert both tokens are present (`assert.ok(loadIdx >= 0)`) before comparing, so a rename red-fails rather than greening.

### `tests/architecture/hooks-async-rewake.test.ts`

- **[WARNING] `waitForPidTable` is a byte-identical duplicate of `registry.test.ts:400-417`, and it polls real time** — lines 261–278
  Same 2-second `process.hrtime.bigint()` deadline, same 1,000-iteration `setImmediate` loop, same trailing `assert.deepStrictEqual`. Two problems: (a) cross-file duplicated helper — same class as the `filesystemErrorCode` duplication already recorded in `bridges-hooks-async-rewake.md`; (b) the unit-testing rules name polling and real-timer waits as findings. Fix: extract once into `tests/bridges/hooks/async-rewake/wait-for-pid-table.ts` (beside its concern, not `tests/helpers/`) and, if the wait is genuinely needed, drive it from the registry's own persistence-completion seam (`createControlledPidTableWriter`, already built in `registry.test.ts`) instead of a wall-clock deadline.

- **[WARNING] Hand-rolled recorders where the repo's silence-proof idiom is `strong-mock`** — `createContext` (lines 142–193) and `createPi` (lines 195–207)
  The third case's promise is a pair of *silence* proofs: `assert.deepStrictEqual(pi.messages, [])` and `assert.deepStrictEqual(context.notifications, [])` (`:407-408`). META-FINDINGS names "a `strong-mock` with no expectations" as the in-repo pattern for exactly this, and the sibling `tests/bridges/hooks/dispatch-exec.test.ts:1017` already does it (`mock<ExtensionAPI>({ exactParams: true, name: "extension api" })` … `verify(pi)`). Fix: replace `createPi` with that mock and `verify(pi)` at the end of each case; keep `createContext`'s notify collector only if the two env-parity cases need the `ExtensionContext` shape for other reasons.

### `tests/architecture/hooks-cap-notify.test.ts`

- **[WARNING] `readCatalogBlock` re-implements `catalog-uat.test.ts`'s fence parser** — lines 40–73
  `tests/architecture/catalog-uat.test.ts` already owns the `<!-- catalog-state: STATE -->` fence-walk (`CATALOG_STATE_RE` at `:99`, parser at `:158-170`). The file's own header (`:39`) admits the copy ("Mirrors the catalog-uat parser's fence-walk"). Fix: extract the parser into `tests/architecture/catalog-block.ts` — a non-`.test.ts` support module beside `source-scan.ts`, which exists precisely because importing a `*.test.ts` re-registers its cases (D-98-09) — and import it from both.

### `tests/architecture/hooks-translators.test.ts`

- **[WARNING] `LOCAL_DISPATCHABLE` hardcodes the dispatchable domain instead of deriving it, and breaks in the scenario the design supports** — lines 12–23
  `hook-events.ts:88-96` documents that an event may be admitted before its translator exists (D-87-04). In that state, `BUCKET_A_EVENTS` gains a member; the maintainer must then extend `expectedAdmission` (`:85-96`) **and** `LOCAL_DISPATCHABLE`, at which point `loadTranslator` throws on a module that legitimately does not exist. The gate would red-fail on a supported design state. Fix: `const LOCAL_DISPATCHABLE = BUCKET_A_EVENTS.filter(isDispatchableEvent);` — `isDispatchableEvent` is already exported, this is the input domain rather than the expected value, and the completeness claim in the title then holds by construction.

- **[WARNING] `assert.deepStrictEqual(BUCKET_A_EVENTS, expectedAdmission)` duplicates the paired module's own case** — line 107
  Byte-for-byte the same 10-element expectation as `tests/domain/components/hook-events.test.ts:30` (`'publishes every admitted event in registration order'`). Delete it here; the translator inventory is this gate's promise, the admission tuple is not.

---

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `hooks/schema.ts` | `HOOKS_VALIDATOR` | `schema.test.ts:87`, `:130` (18 rows) | owned |
| `hooks/schema.ts` | `HookHandlerEntry` | `schema.test.ts:10-26` | owned (type-level) |
| `hooks/schema.ts` | `HooksConfig` | `schema.test.ts:12-30` | owned (type-level) |
| `hooks/schema.ts` | `HOOKS_CONFIG_SCHEMA` | `tests/architecture/hooks-foundation.test.ts:144` | **NO PAIRED CASE — and no production consumer** |
| `hook-events.ts` | `BUCKET_A_EVENTS` | `hook-events.test.ts:30` | owned |
| `hook-events.ts` | `TOOL_EVENTS` | `hook-events.test.ts:54`, `:65` | owned |
| `hook-events.ts` | `isDispatchableEvent` | `hook-events.test.ts:91`, `:108` (13 rows) | owned |
| `hook-events.ts` | `NON_TOOL_EVENT_FIELDS` | `hook-events.test.ts:122` | owned |
| `hook-events.ts` | `NON_TOOL_EVENT_CLOSED_SETS` | `hook-events.test.ts:143` | owned |
| `hook-events.ts` | `BucketAEvent` / `ToolEvent` / `DispatchableEvent` / `StopFailureErrorType` | `hook-events.test.ts:16-27` | owned (type-level) |
| `translation-context.ts` | `buildTranslationContext` | `translation-context.test.ts:62`, `:138` | owned |
| `translation-context.ts` | `TranslationContext` | `translation-context.test.ts:25-56` | owned (type-level) |
| `pid-table.ts` | `pidTablePath` | `pid-table.test.ts:140`, `:290` | owned |
| `pid-table.ts` | `readPidTable` | `pid-table.test.ts:142` + 8 degrade rows | owned |
| `pid-table.ts` | `writePidTable` | `pid-table.test.ts:143`, `:374` | owned |
| `pid-table.ts` | `unlinkPidTable` | `pid-table.test.ts:145`, `:347`, `:412` | owned |
| `pid-table.ts` | `ASYNC_REWAKE_PIDS_FILENAME` / `_VERSION` | `pid-table.test.ts:138-139` | owned |
| `pid-table.ts` | `PidTableEntry` | — | incidental only (used as a fixture annotation; never `satisfies`-checked, no negative) |
| `dispatch-exec.ts` | `dispatchHookExec` | `dispatch-exec.test.ts` (25 cases) | owned |
| `hooks.ts` | `parseHooksConfig` | `hooks.test.ts:21`–`:383` (13 cases) | owned |
| `hooks.ts` | `projectHookSummaryEntries` | `hooks.test.ts:210` | owned |
| `hooks.ts` | `hookSummaryEntriesFromPersisted` | `hooks.test.ts:231` | owned |
| `hooks.ts` | `CompileIfPredicateContext` | — | **NO CASE** (type; used only as an argument annotation) |
| `hooks.ts` | `CompileIfCallback` | — | **NO CASE** |
| `hooks.ts` | `CompiledIfPredicateMap` | — | **NO CASE** |
| `hooks.ts` | `HookConfigParseResult` | — | **NO CASE** (exercised structurally, never `satisfies`-pinned) |
| `hooks.ts` | re-exports `parseMatcher`, `ParsedMatcher`, `DroppedHook`, `HOOKS_CONFIG_SCHEMA`, `HOOKS_VALIDATOR`, `HookHandlerEntry`, `HooksConfig` | — | **NO BINDING-IDENTITY CASE** (reference form: `tests/bridges/hooks/index.test.ts:83-161`) |
| `if-field/index.ts` | `compileIfPredicate`, `ifFires`, `MATCH_ALL_IF`, `IfPredicate`, `CompileIfPredicateContext` | `if-field/index.test.ts` (12 cases) | owned |
| `if-field/index.ts` | re-exports `compileBashGlob`, `compilePathGlob`, `parseBashSubcommands`, `bashSubcommandFires` | `if-field/index.test.ts:56-62` | **type identity only** — no `assert.strictEqual` binding check, contra the barrel rule and `tests/bridges/hooks/index.test.ts` |

## Branch census

**Reachable and untested (findings, detailed above):**
- `dispatch-exec.ts:402` `if (overflowed)` in the `close` handler — reachable, no discriminating case.
- `dispatch-exec.ts:169` the non-`true`-truthy arm of `asyncRewake === true` — reachable via `HookHandlerEntry.asyncRewake: unknown`, no case.
- `dispatch-exec.ts:349` overflow `hookDebugLog` — reachable, no assertion.
- `hooks.ts:134` `!Array.isArray(inner)` in `isPluginWrapper` — reachable via `{"hooks": []}`, no case.
- `schema.ts:25` the unconditional `command: { type: "string" }` — reachable via a non-`command` handler type, no case.
- `hook-events.ts:135` `isDispatchableEvent` — fully covered (13 rows), listed here only to record that it *is* covered.

**Unreachable by real input (not defects; do not "cover" these):**
- `pid-table.ts:111`, `:148`, `:166` — the three `assertPathInside` calls. `pidTablePath` is `path.join(loc.dataRoot, "_shared", <const>)` with no untrusted component, so the guard can never reject; deleting all three leaves the whole test file green. The module header (`:29-34`) already declares this ("this guard is defense-in-depth"). Correct disposition: leave as-is, do not add a prop-up test.
- `if-field/index.ts:282`, `:296` — the `catch` arms around `compileBashGlob`/`compilePathGlob`, whose callees are contractually total. Already recorded in `bridges-hooks-if-field.md`; the two cases that reach them (`index.test.ts:369`, `:400`) do so by monkeypatching `String.prototype.endsWith` and by a throwing `cwd` getter. This is one of the four instances META-FINDINGS escalates as an operator decision.
- `if-field/index.ts:417-421` reached with `parsed.subcommands` empty — not separately reachable.

**Compiler-forced (D-116-01a category):**
- `if-field/index.ts:442-443` `default: return assertNever(predicate)` — covered by `index.test.ts:682` via a deliberate `as unknown as IfPredicate`, which is the sanctioned form.
- `hooks.ts:387`, `:419` `as Exclude<ClaudeHookEvent, ToolEvent>` — narrowing casts whose safety is upheld by the upstream supportability gate; no runtime branch to test.

---

## Grading of first-pass findings

### `tests/architecture/hooks-async-rewake.test.ts`
- **OVERSTATED** — *Third test duplicates existing coverage in the paired module*. Real overlap, but not total: the architecture case calls `shutdownInMemoryChildren()` **before** asserting `child.signals === []` (`:404` then `:409`), proving the stale child was *deregistered*. `registry.test.ts`'s version (`:1595-1637`) never calls shutdown before its assertions, and its own `signals === []` sites (`:582`, `:694`, `:1048`) also assert before shutting down. Correct action: migrate that one assertion into `registry.test.ts`'s stale-epoch case, then delete the architecture copy — not a bare delete.

### `tests/architecture/hooks-lifecycle.test.ts`
- **CONFIRMED** — *No AAA phase comments anywhere*. Verified across all six cases (lines 124–332). WARNING is right.

### `tests/architecture/hooks-foundation.test.ts`
- **CONFIRMED** — *Block 1 duplicates `state-io.test.ts`*. `tests/persistence/state-io.test.ts:213-215` carries the `schema version 1 / 2 / 3` accepted/rejected rows through the real validator, plus `:234` for the on-disk path.
- **CONFIRMED** — *Block 2 duplicates `state-io.test.ts`*. `tests/persistence/state-io.test.ts:1071-1108` has `rejects a plugin without hooks at the published validator` and `rejects a plugin with non-array hooks at the published validator`.
- **OVERSTATED** — *Block 3 belongs in `schema.test.ts`*. Half of it is already there and should be **deleted**, not moved: `tests/domain/components/hooks/schema.test.ts:53-85` (`accepts a command handler with extra properties`) drives `HOOKS_VALIDATOR.Check` with an unknown top-level event key (`FutureEvent`), an unknown entry field (`futureGroupField`), and an unknown handler field (`futureHandlerField`) — i.e. exactly the three levels `hooks-foundation.test.ts:152-193` re-tests. The first pass grepped for `additionalProperties`/`futureField`/`lenient` and missed those identifiers. Only the *structural walk* (`:143-150`) is unique, because it is `HOOKS_CONFIG_SCHEMA`'s sole consumer anywhere; that one should move to `schema.test.ts`.
- **REFUTED** — *Block 5 is single-module resolver behavior with no coverage in its paired test*. All three parts are already in `tests/domain/resolver.test.ts`: the strict arm at `:229` (`HOOK-01: hooks/hooks.json present + parseable -> installable WITH hooks in supported`), the loose arm at `:3034`, and a **character-identical** `// @ts-expect-error -- NFR-7: pluginRoot must NOT be accessible on the unavailable variant.` at `:3870`. The first pass grepped for `hookOnly`/`hookplug`/`SUPPORTED_COMPONENT_KINDS` — none of which the real cases use. Correct action: delete Block 5 outright.
- **CONFIRMED** — *Missing AAA phase comments*. Verified; WARNING.

### `tests/architecture/hooks-translators.test.ts`
- **CONFIRMED** — *Second test duplicates per-module payload coverage*. `tests/bridges/hooks/payloads/pre-tool-use.test.ts:20/33` (bash → `Bash`) and `:58/71` (`mcp__catalog__lookup` passthrough); mirrored in the two sibling payload test files.
- **CONFIRMED** — *Dynamic import via string concatenation*. `:46-48`; WARNING, mechanical fix.

### `tests/architecture/hooks-if-field.test.ts`
- **UNDERSTATED** — *This test's real home is `event-router.test.ts`*. The relocation is right but the finding misses why the test matters and names only one of two homes. It is the sole case in the repo that kills the `ifPredicateMapKey` group/handler index swap (see the new BLOCKER above): `event-router.test.ts:839` and `hooks.test.ts:167` both only ever produce the key `…|0|0`. The move must split: multi-index **key derivation** to `tests/domain/components/hooks.test.ts`, **predicate identity threading** (`rows[n].ifPredicate === parsed.ifPredicates.get(key)`) to `tests/bridges/hooks/event-router.test.ts`. Severity should rise to BLOCKER, because executing the finding as written removes coverage of a silent dispatch mis-routing.

### `tests/architecture/hooks-dispatch.test.ts`
- **CONFIRMED** — *Misleading filename*. None of the three cases touches `dispatch.ts`/`dispatch-exec.ts`; WARNING, rename as proposed.
- **OVERSTATED** — the accompanying note *"Tests themselves are sound. … No behavior findings."* Two of the three are not sound: test 2 has two config-scrape bypasses and test 3 collapses to an existence check (both filed as new findings above). This is the finding the "inert-gate cluster" framing was supposed to surface and it was recorded as a clean bill.

### `tests/architecture/hooks-cap-notify.test.ts`
- **CONFIRMED** — *Imports the process-wide `mock` from `node:test`*. `:20`, `:81`; explicit rule violation, mechanical fix.
- **CONFIRMED (with a refinement)** — *Tests 1 and 2 duplicate `tests/shared/notify.test.ts:5430`*. Verified: that case asserts the complete message string **and** `"warning"` in one `assert.deepStrictEqual` on `ctx.ui.notify.mock.calls[0]!.arguments`. It does **not** assert `calls.length === 1`, so the exactly-once half of test 1 is not subsumed. Fold `assert.strictEqual(ctx.ui.notify.mock.calls.length, 1)` into `notify.test.ts:5430` first, then delete tests 1–2 here.

### `tests/architecture/no-hooks-strict-additional-properties.test.ts`
- **CONFIRMED** — *[BLOCKER] The defense-in-depth gate scans the wrong file*. Independently verified: `grep -n additionalProperties extensions/…/domain/components/hooks.ts` returns nothing and the file contains no `Type.Object`/`Type.Record`/`Type.Unsafe` call; all three literals live in `hooks/schema.ts:20`, `:44`, `:57`. BLOCKER is the defensible severity (the audit reached the same conclusion). The fix should be the shared `assertNoForbiddenSurface` rewrite described above, not a `HOOKS_TS_PATH` edit — the shared helper additionally supplies the WR-06 missing-target guarantee this gate lacks.
- **CONFIRMED** — *The idempotency test is stranded outside `migrate.test.ts`*. Verified: `grep -c "idempoten\|second pass\|twice\|reparsed" tests/persistence/migrate.test.ts` → **0**. Move it.

### `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts`
- **UNDERSTATED / DUPLICATE-OF `bridges-hooks-dispatch.md`** — *`resetEpoch`/`resetRoutingState` are test-only exports*. Same defect, but that file rates it BLOCKER and prescribes the concrete fix (`createRoutingState()` factory returning a handle, threaded into `event-router.ts`/`dispatch.ts`/`dispatch-exec.ts`), whereas this area's version concludes "No fix is strictly required." The stronger reading should win. Ownership: `bridges-hooks-dispatch.md`.

### `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`
- **OVERSTATED / DUPLICATE-OF `bridges-hooks-async-rewake.md`** — *Inline `Date` read forces global time-faking*. The sibling file records the same line with better reasoning: `registry.test.ts` must enable `t.mock.timers` regardless, for the SIGTERM/SIGKILL ladder, so adding `Date` to the same `apis` array costs nothing and is not the "faking `Date` where an injected clock would do" anti-pattern. Its disposition ("No action required") is the correct one. Ownership: `bridges-hooks-async-rewake.md`.

### `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`
- **DUPLICATE-OF `bridges-hooks-dispatch.md`** — *Inline `os.homedir()` at three sites*. Identical finding, identical lines (179, 446, 573), identical fix, same WARNING severity. Real defect; keep one copy.

---

## Still clean after attack

- **`extensions/pi-claude-marketplace/domain/components/hook-events.ts`** — the strongest module in the set. Mutations the cases **do** catch: reordering `BUCKET_A_EVENTS`; dropping or adding any member; `isDispatchableEvent` returning a constant (killed by both the 10 accept rows and the 3 reject rows, which include the case-changed and one-character-longer lookalikes); dropping `StopFailure` from `DISPATCHABLE_EVENTS`; changing any `NON_TOOL_EVENT_FIELDS` value or `null` sentinel; adding `clear` to the `SessionStart` closed set; emptying the `StopFailure` vocabulary. Only the private-tuple doc claim above is wrong.
- **`extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts`** — behaviorally airtight. Mutations caught: dropping or renaming any of the three fields; adding a fourth; changing the `?? ""` fallback to `undefined`; swapping `sessionId` and `cwd`. Both cases compare the whole object with `deepStrictEqual`, and the throwing getters on every other `ExtensionContext` member are a genuine negative proof that nothing else is read. The only finding is the over-wide parameter — a design cost, not a coverage gap.
- **`extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts`** — mutations caught: changing `"_shared"` or the filename constant; bumping the on-disk `version`; loosening the `version ===` check (the `stale version` row's diagnostic count drops to 0); loosening `Array.isArray(entries)`; deleting either ENOENT arm (both "diagnostic-free" cases assert `diagnostics` deepStrictEqual `[]`); deleting the shape-mismatch or any failure `hookDebugLog` (all five shape rows and the three boundary-failure cases assert `count: 1`). The byte-level `expectedBytes` assertion at `:115-119` is the right form. Surviving: only the defensive-copy mutation (already owned by `bridges-hooks-async-rewake.md`) and the unreachable containment guards.
- **`extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`, partially** — `dispatch-exec.test.ts` is one of the strongest test modules encountered. Mutations it **does** catch: any swap in the `TRANSLATORS` table (each translator emits its own `hook_event_name`, pinned by the exact-stdin-bytes assertion per event); any change to `REQUIRED_EVENT_FIELDS` (the count assertion at `:851` is exact in both directions); removing the `isDispatchableEvent` guard (`:977`); either byte cap, in either direction, at exactly `cap` and `cap + 1` (`:1596`, `:1626`, `:1678`); the stdin error-listener-before-`end()` ordering (`stdinOrder` deepStrictEqual `["error-listener", "finish"]`, asserted in six cases); `settle`'s idempotence (`:1409`); `handleOverflow`'s re-entry guard (`:1719`); the fresh 0-second ladder after overflow (the four-phase signal snapshot at `:1670-1674`); exec-form vs shell-form (`:1474`); the `StringDecoder` boundary reassembly and tail flush (`:1220`, `:1302`); `cwd: env.CLAUDE_PROJECT_DIR` (`:1509`); and the whole env/argv/stdin envelope against a real spawned child (`:278-327`).
- **`tests/architecture/hooks-lifecycle.test.ts` Blocks A–D and F, as gates** — these genuinely plant against real source: moving `rebuildRoutingTables()` out of any of the four orchestrators' mutation neighborhoods red-fails, and Block F's `scanned >= 4` floor prevents the gate greening over an emptied directory. The three holes filed above are latent, not currently live.
- **`tests/architecture/hooks-dispatch.test.ts` test 1** — the `console.error` scan is exact (`assert.deepStrictEqual(offenders.sort(), ["shared/debug-log.ts"])`), not a `.includes()` check, and it walks the real tree. Adding a `console.error` anywhere in `extensions/` red-fails it.
- **`tests/architecture/hooks-cap-notify.test.ts` test 3** — the byte-equality check against `docs/output-catalog.md` is the one thing here no paired test does, and it fires on any drift in either direction.

---

## Not covered

- I did not run any test, coverage, or lint command (diagnostic constraint). Every claim above is from reading source; where I assert a mutation survives, I traced the specific assertion that would or would not fail and named it.
- `tests/architecture/catalog-uat.test.ts` (5,442 lines) was read only around its fence parser (`:99`, `:158-170`) to establish the `readCatalogBlock` duplication. It is owned by `architecture-catalog-uat.md`.
- `tests/bridges/hooks/event-router.test.ts` (read at `:790-870`, `:1029-1085`) and `tests/bridges/hooks/async-rewake/registry.test.ts` (read at `:395-430`, `:560-600`, `:1590-1640`) were sampled only where needed to settle duplication and mutation-survival claims; neither got a full pass. Both are owned by other areas.
- `tests/domain/resolver.test.ts` (3,949 lines), `tests/persistence/state-io.test.ts`, `tests/persistence/migrate.test.ts`, and `tests/shared/notify.test.ts` were read only at the specific line ranges that settle the first pass's duplication claims.
- The ten `bridges/hooks/payloads/*.ts` translator modules: I read `pre-compact.ts` and `post-compact.ts` in full (to test the TRANSLATORS-swap mutation) and sampled `tests/bridges/hooks/payloads/pre-tool-use.test.ts`. The other eight were not reviewed; `bridges-hooks-payloads.md` owns them.
- I did not attempt to measure direct per-pair coverage, which remains the outstanding gap META-FINDINGS names.

---

## Meta-findings impact

### New cross-cutting evidence

**1. The §1 over-wide-context cluster is materially under-counted, and "clean" verdicts are where it hides.** `translation-context.ts` was declared clean by **two** independent reviewers (this area and `bridges-hooks-exec-protocol.md:57`) while `buildTranslationContext` reads exactly `ctx.cwd` and `ctx.sessionManager` off a 16-member `ExtensionContext` — costing ~78 lines of throwing-getter boilerplate in its own paired test. `dispatchHookExec` is the same shape, also declared clean by two reviewers, costing another ~42 lines (`dispatch-exec.test.ts:541-582`) plus an inline repeat. Both are in the *same directory* as the `if-field` instance META-FINDINGS already names. **Recommended check: grep every function whose signature names `ExtensionContext`, `ExtensionAPI`, or `SessionManager` and trace which members it actually reads.** The tell in the test layer is a harness that builds a full SDK object with throwing getters — that pattern is a reliable index of the cluster and appears in at least four hooks-bridge test files.

**2. A new gate-hole shape: a config-scraping gate whose *selector* is bypassable, not just its assertion.** META-FINDINGS' "Gates that do not gate" list captures gates that scan the wrong file or read config instead of planting a violation. `tests/architecture/hooks-dispatch.test.ts:42` adds a third shape: the gate iterates config blocks but *filters* them by a substring of the block's own `files` glob, so the single most dangerous configuration — a blanket `files: ["**/*.ts"]` override — is the one it cannot see. **Any gate that enumerates config entries by a filter derived from those entries should be checked for the same inversion.** Candidates named elsewhere in the sweep: `import-boundaries.test.ts` (zone matrix), and any gate reading `eslint.config.js` or `.fallowrc.json`.

**3. Coverage gaps hide at index (0, 0).** Three independent test modules (`tests/domain/components/hooks.test.ts:167`, `tests/bridges/hooks/event-router.test.ts:839`, and the paired resolver fixtures) all exercise the `if`-predicate side-map at exactly one key, `…|0|0`, which cannot distinguish a group index from a handler index. The single case anywhere in the repo that uses multi-index keys is an architecture test the first pass proposed relocating. **Worth checking repo-wide: any composite key built from two same-typed indices where every fixture uses `0` for both** — the `bridges/agents`, `bridges/commands`, and `bridges/skills` discover/stage triplets build similar per-artifact keys.

**4. `tests/architecture/source-scan.ts` is under-adopted by more than the recorded count, and in more than one dimension.** META-FINDINGS records "5 architecture files hand-roll their own `.ts` walker." In this area alone I found three distinct re-implementations of its *other* two exports: `no-hooks-strict-additional-properties.test.ts:37-41` duplicates `stripComments` character-for-character and `:26` duplicates `REPO_ROOT`; `hooks-lifecycle.test.ts:57-74` is a third comment-stripper variant. A loose grep for a directory walker across `tests/architecture/` returns **9** files, not 5. The adoption gap is helper-wide, not walker-only — and `assertNoForbiddenSurface` carries a WR-06 guarantee (a missing target *fails*) that every hand-rolled copy lacks, which is the same failure family as the inert HOOK-03 gate.

**5. Untested collaborator arguments are invisible to both the caller's and the callee's paired tests.** `resolveTimeoutSeconds`'s `lane` argument is passed as a literal from two call sites (`dispatch-exec.ts:305`, `registry.ts:249`); `timeout.test.ts` proves the function honors both lanes, and neither caller's test proves it passes the right one. Swapping the two literals is green everywhere. **This is a general blind spot of the pairing rule** — a constant argument threaded from caller to callee belongs to neither module's test unless someone writes an end-to-end case. Worth scanning for other literal-valued mode/lane/scope arguments passed at exactly one or two call sites.

### Corrections to META-FINDINGS.md

**Correction 1 — the routing-state doc comment does not lie.** META-FINDINGS §"Replace test-only hooks" states: *"`bridges/hooks/routing-state.ts` | `resetRoutingState`/`resetEpoch` — doc comment **falsely claims** production-lifecycle status"*, and the section closes with *"one module honestly admits its test-only export, another actively misdescribes it."* The actual comment (`routing-state.ts:314-320`) reads: *"A public lifecycle operation rather than a test hole. … **Its only caller today is test setup, which is what a reset is for**; the four clears it composes are each already public."* And `resetEpoch`'s comment (`:188-190`) says *"the test reset seam is its only caller."* Both disclose the test-only reality explicitly; the "public lifecycle operation" phrase is a *design argument* for keeping one composed reset rather than four, not a false factual claim. The defect (a test-only export) is real and the fix is unchanged; the "actively misdescribes it" characterization should be struck, and with it the inference that "doc comments cut both ways" in this instance.

**Correction 2 — the shared-scanner adoption count is low and mis-scoped.** The "Patterns to propagate" table says *"`tests/architecture/source-scan.ts` — 5 architecture files hand-roll their own `.ts` walker instead of using it."* Verified: a walker/`readdir`-recursion grep across `tests/architecture/` returns 9 files (`no-shell-out`, `no-split-01-cast-reads`, `import-boundaries`, `manifest-lookup-drift`, `manifest-read-seam`, `config-state-write-seams`, `hooks-dispatch`, `scope-order-drift`, `scope-fences-63`). Separately, at least two files duplicate `stripComments`/`REPO_ROOT` rather than a walker. Restate the row as "9 architecture files re-implement one or more of `source-scan.ts`'s three exports."

**Correction 3 — the "hooks-schema gate" severity disagreement is settled in favor of BLOCKER, and the recorded fix is the weaker of two.** META-FINDINGS lists it under "Decisions the fixing pass cannot make" as an open operator call. Both reviewers' facts hold, but the sibling structural walk that "still fires" (`hooks-foundation.test.ts:143-150`) is itself scheduled for relocation by this same area's findings, and it is the *only* consumer of `HOOKS_CONFIG_SCHEMA` anywhere. If that relocation happens without care, the primary protection moves at the same moment the backstop is blind. That coupling makes BLOCKER the right call, and it makes the fix a single rewrite through `assertNoForbiddenSurface` over **both** files, not a `HOOKS_TS_PATH` string edit. Recommend removing this from "Decisions" and adding it to the sequencing list.

### Confirmations

- **"Clean verdicts are not reliable" — confirmed emphatically, with a measurable rate.** 7 production files were declared clean in this area. 3 already had recorded findings in other areas' files at the time the clean list was written (`if-field/index.ts`, `hooks/schema.ts`, `hooks.ts`), 2 more carry a fresh instance of the sweep's top-ranked cluster, and mutation testing found undetected behavior changes in 3. Two files (`hook-events.ts`, `translation-context.ts`) held up behaviorally. **The clean-list false-negative rate in this area is roughly 5 of 7.**
- **"Gates that do not gate" item 2 — confirmed independently.** `domain/components/hooks.ts` contains no `additionalProperties` string and no schema-literal constructor at all; every literal is in `hooks/schema.ts:20/44/57`. The grep in `no-hooks-strict-additional-properties.test.ts:49` cannot fire.
- **"The dominant shape: sibling drift" — confirmed with three fresh instances, each with a named in-repo target.** (a) `tests/domain/components/hooks.test.ts` has no type-level coverage while all three of its sibling `domain/components` test modules do; (b) `tests/bridges/hooks/if-field/index.test.ts` proves its 4 runtime re-exports by *type* identity while `tests/bridges/hooks/index.test.ts:83-161` proves its 7 by *binding* identity; (c) `tests/architecture/hooks-async-rewake.test.ts` hand-rolls recorder objects for two silence proofs while `tests/bridges/hooks/dispatch-exec.test.ts:1017` uses `mock<ExtensionAPI>({ exactParams: true })` + `verify(pi)` for the same purpose.
- **"Reviewing production alongside tests was worth it" — confirmed.** The two BLOCKERs in `dispatch-exec.ts` (overflow short-circuit, `asyncRewake === true`) are only visible by reading the production branch *and* the case list together; neither is discoverable from either side alone.
- **Minor, unrelated: `eslint.config.js:297` carries `// the canary test (Plan 05) spawns eslint manually on them`** — a `Plan NN` reference forbidden by `.claude/rules/typescript-comments.md`. Not a test finding; noted because no area owns `eslint.config.js`.
