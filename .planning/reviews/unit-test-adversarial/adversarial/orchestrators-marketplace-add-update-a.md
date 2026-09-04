# Orchestrators — marketplace add and update (git-source paths), add side — adversarial re-review

**Scope:** the add side of the area: `tests/orchestrators/marketplace/add.test.ts` (2,529 lines),
`tests/orchestrators/marketplace/add.messaging.test.ts` (33 lines), and their paired production
modules `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` (875 lines) and
`add.messaging.ts` (50 lines). The update side is owned by sub-agent b.
**First-pass file:** `unit-test-findings/orchestrators-marketplace-add-update.md`
**Clean files attacked:** 2 (`add.messaging.test.ts`, the only add-side entry on the test clean
list; `add.messaging.ts`, the only add-side entry on the production clean list). `add.test.ts` and
`add.ts` additionally got a full export-ownership and branch census despite carrying findings.
**Existing findings graded:** 5 (3 test-side, 2 production-side), plus the first pass's standalone
"Note on `add.messaging.test.ts` size" claim.

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 5 |
| New WARNING (missed by first pass) | 17 |
| Existing CONFIRMED | 3 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

## New findings — from the clean lists

### `tests/orchestrators/marketplace/add.messaging.test.ts`

- **[WARNING] Bare `actual`, `deepEqual`, and a two-line `satisfies` idiom — all three drift from
  the two siblings in the same directory** — `lines 8-12, 26, 29-32`.
  `const actual = ADD_CONTEXT;` (line 26) is the placeholder name the testing rules name explicitly
  ("a bare `actual` is a finding"); `remove.messaging.test.ts:57` uses `contextKeys` and
  `update.messaging.test.ts:48` uses `context`. The four `assert.deepEqual` calls should be
  `assert.deepStrictEqual` (behaviourally identical under `node:assert/strict`, but both siblings
  use the strict spelling). And the type pins at lines 8-12 use
  `const duplicateNameReason = "duplicate name" satisfies AddPrivateReason; void duplicateNameReason;`
  where both siblings use the one-line form `void ("plugins remain" satisfies RemovePrivateReason);`
  (`remove.messaging.test.ts:12`) — and line 15's `const foreignReason: AddPrivateReason = ...`
  should likewise become `// @ts-expect-error …` + `void ("plugins remain" satisfies AddPrivateReason);`.
  Fix: rename `actual` → `context`, switch to `deepStrictEqual`, and collapse lines 8-16 into the
  three-line sibling form.
- **[WARNING] Widening `AddPrivateReason` survives every check in the file** — `lines 8-15`.
  Mutating `add.messaging.ts:36` to `_ReasonInSet<"duplicate name" | "stale clone" | "invalid manifest">`
  leaves all three pins green: the two `satisfies` positives still hold and the `@ts-expect-error`
  on `"plugins remain"` still errors. Only *narrowing* is caught. This is the closed-set
  silent-omission class (META-FINDINGS leverage item 5) applied to a type pin. Fix: add a
  bidirectional pin that fails on widening, e.g.
  `void (undefined as unknown as AddPrivateReason satisfies "duplicate name" | "stale clone");`
  — note the identical gap exists in `remove.messaging.test.ts:12-15`, so fix both.

### `extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts`

- **[WARNING] Two comments narrate a shape that no longer exists ("byte-identical to the legacy
  path")** — `line 12` and `line 42`.
  `.claude/rules/typescript-comments.md` bans exactly this form: "A claim of the form 'this is
  byte-identical to what came before' is not a fact about the current code at all — the gate that
  pins the bytes is, so name the gate or say nothing." Fix: replace both with the gate that
  actually pins the header bytes (the whole-message `assert.deepStrictEqual` cases in
  `add.test.ts`, e.g. lines 499-506 and 2192-2199), or delete the clause.

## New findings — missed by the first pass in files that had findings

### `tests/orchestrators/marketplace/add.test.ts`

- **[BLOCKER] The persisted marketplace record is never compared as a whole object, so six record
  fields are unpinned** — mutation targets `add.ts:693-702` (git-cloned branch) and `add.ts:856-865`
  (path branch).
  Every case reads the record field-by-field or not at all: `recorded.scope` (line 274),
  `recorded.marketplaceRoot` (806, 1129 — both path-source), `manifestPath` (987 — path-source),
  `(recorded.source as {kind}).kind` (2099). `grep` confirms **zero** occurrences of
  `addedFromCwd`, `lastUpdatedAt`, `plugins`, or a whole-record `deepStrictEqual` in the file.
  Surviving mutations: blank `addedFromCwd`; write `plugins: { junk: … }`; write a wrong `name`
  (the `"valid-marketplace" in persisted.marketplaces` checks pin only the *key*); and — on the
  github/url branch, which no case inspects at all — swap `manifestPath` and `marketplaceRoot`
  (lines 698-699).
  Fix: in the MA-5 github success case (line 243) and the NFR-5 path success case (line 607),
  replace the field-by-field checks with
  `assert.deepStrictEqual(persisted.marketplaces["valid-marketplace"], { name: "valid-marketplace",
  scope: "project", source: <hand-written ParsedSource literal>, addedFromCwd: cwd, manifestPath:
  path.join(finalDir, ".claude-plugin", "marketplace.json"), marketplaceRoot: finalDir, plugins: {},
  lastUpdatedAt: now.toISOString() })`, pinning the clock with
  `testContext.mock.timers.enable({ apis: ["Date"], now })`. The in-repo reference is
  `update.test.ts:2283` + `:2329-2345`, which does exactly this — but hand-write the `source`
  literal rather than copying that file's `pathSource(marketplaceRoot)` call, which builds an
  expected value with production code.
- **[BLOCKER] The config write-back never sees a pre-existing config, so a data-losing mutation
  survives** — mutation target `add.ts:411`.
  Replacing `const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };`
  with an unconditional `{ schemaVersion: 1 }` leaves every case green.
  `writeMarketplaceConfigEntry` spreads `current` into the written file
  (`persistence/config-write-back.ts:69-73`), so the mutant **deletes every other `marketplaces`
  and `plugins` entry** from the user's `claude-plugins.json` on each add — which the reconcile
  planner would then read as "uninstall everything". No case detects it: 1736 and 1777 start from
  an absent config; 1885 seeds a bare `{"schemaVersion":1}` and fails EACCES anyway; 1937's second
  add rewrites the only entry that exists.
  Fix: add a case that seeds `locations.configJsonPath` with a hand-written config carrying one
  other marketplace and one plugin entry, adds a second marketplace standalone, and asserts the
  whole file bytes with `assert.strictEqual(await readFile(locations.configJsonPath, "utf8"),
  "<hand-written JSON>")` — the byte-comparison form already used at line 1984.
- **[BLOCKER] `verify()` is hidden inside the notify callback, and six cases arrange strong-mock
  expectations that are never met and never checked** — `makeCtx`, lines 186-221.
  The rule is "`verify(mock)` for every mock, at the end of the case, after result and state
  assertions — never hidden in a hook or shared cleanup." Here `verify(ctx)/verify(pi)/verify(ui)`
  run *inside* the `ui.notify` stub (lines 208-210) — i.e. during the act phase — and **only when
  `notificationCalls === expectedNotifications`**. Any case whose production run emits fewer
  notifications than requested never verifies at all. Six cases request one notification and then
  assert zero: lines 1392, 1421, 1615 (second boundary), 1661, 1885, 2309 — three of them with
  "ZERO notify calls" in the title while their mock permits one. The file's own `makeCtx(0)` is the
  correct form and is already used at 566, 653, 679, 914, 960, 1454, 1507, 1551, 1940, 2242.
  In the `expectedNotifications === 0` branch, lines 215-217 call `verify()` before any act — a
  no-op, since no expectations were ever set (the real silence proof is strong-mock throwing on
  unexpected property access).
  Fix: (1) switch those six call sites to `makeCtx(0)`; (2) return the three mocks from `makeCtx`
  and call `verify(ctx); verify(pi); verify(ui);` as the last three lines of each case, after the
  result/state assertions; (3) delete the counter and the in-callback verify, and the dead
  `verify()` trio in the zero branch. While there, replace the fitted
  `times(expectedNotifications === 2 ? 2 : expectedNotifications * 2)` on `pi.getAllTools()`
  (line 202) — a special case that exists for exactly one test — with a per-case expectation
  derived from the contract.
- **[BLOCKER] WR-07 asserts a disjunction that accepts either of two incompatible behaviors** —
  `test('WR-07: config write failure after the clone rename cleans up the final clone …')`,
  lines 1921-1924.
  `assert.ok(threw || notifications.some((n) => n.severity === "error"))` passes whether the
  orchestrator rethrows or renders a failed row. Tracing settles which it is: `saveConfig` fails
  EACCES, `classifyGitSourceAccessFailure` returns `undefined` for a non-`HttpError` non-network
  errno (`shared/git-failure-classifiers.ts:100-113`), so `handleAddFailure` takes the
  `throw err` arm (`add.ts:472`) and `notifications` is empty — the second disjunct is dead.
  A mutation that swallows unclassified standalone errors into a generic error row (exactly the
  D-48-C behavior this branch exists to prevent) still passes.
  Fix: capture the throw and assert it — `const thrown = await addMarketplace(…).then(() => undefined,
  (e: unknown) => e); assert.strictEqual((thrown as NodeJS.ErrnoException).code, "EACCES");
  assert.deepStrictEqual(notifications, []);` — and switch the case to `makeCtx(0)`.
- **[BLOCKER] Six cases check the rendered message with `.includes()` where a sibling case in the
  same file proves the whole string** — lines 842, 1870, 2136, 2168, 2301, 2412.
  This is META-FINDINGS leverage item 3, recorded for `update.test.ts` but **not** for
  `add.test.ts`, which the first pass praised for whole-message checks. The counter-example is one
  file down: lines 2192-2199 and 2227-2234 compare the complete
  `"A marketplace operation has failed.\n\n⊘ <subject> [project] (failed) {<reason>}"` string for
  the 404 and 429/500 arms, while the 401 (2136), 403 (2168), `UserCanceledError` (2301), and
  no-provider-401 (2412) arms — identical shape, same subject, same summary prefix — check only
  `.includes("(failed) {authentication required}")`. Line 842 checks `.includes("[project]")` where
  the full string is `"● valid-marketplace [project] (added)"`; line 1870 checks
  `.includes("(failed) {invalid manifest}")` where it is
  `"A marketplace operation has failed.\n\n⊘ anthropics/claude-plugins-official [project] (failed) {invalid manifest}"`.
  A dropped summary line, a wrong glyph, a wrong scope bracket, or a scrambled row grammar passes
  all six.
  Fix: replace each with `assert.deepStrictEqual(notifications, [{ message: "<full string>",
  severity: "error" }])`, keeping the existing negative `.includes(…) === false` checks (2140-2141,
  2304-2305, 2416-2417) as extra guards rather than as the only content assertion.
- **[WARNING] Two post-commit side effects have no positive coverage — deleting either call
  survives every case** — mutation targets `add.ts:580-584` (`dropMarketplaceCache`) and
  `add.ts:599` (`seedSameRepoPluginMirrors`).
  The D-03-INV case (line 846) proves only `invalidateMarketplaceNames` fired, via a
  `getMarketplaceNames` rebuild counter. Nothing exercises `dropMarketplaceCache`, and no case
  asserts a seeded mirror: the `valid-marketplace` fixture's single plugin has
  `"source": "./plugins/hello"`, a path kind, so `seedSameRepoPluginMirrors`'s loop always
  `continue`s (`clone-cache.ts:469-477`). Case 945 covers only the swallow-on-failure arm.
  Deleting the whole seeding block, or passing a wrong `marketplaceName`, is undetectable here.
  Both effects are also untested in orchestrated mode, so hoisting the
  `if (orchestrated) return { status: "added", … }` above them — which `add.ts:596` explicitly
  forbids — survives too.
  Fix: extend case 846 with a `getPluginIndex` twin proving the per-marketplace cache was dropped;
  add a fixture whose manifest declares a same-repo git plugin and assert the plugin-clone mirror
  directory exists after a github add; add an orchestrated twin of 846.
- **[WARNING] The T-56-02-05 basename-only mitigation is never asserted against the error text** —
  `test('CFG-03 / T-56-02-05: --local path with an invalid config aborts the add …')`, line 1842.
  `ConfigInvalidError`'s message is not rendered on the add surface at all (D-79-03: no cause line),
  so line 1874's "must not leak the absolute path" check can only ever pass. The message *is*
  surfaced in orchestrated mode as `outcome.cause` (`add.ts:477`), and no case exercises CFG-03
  there. Fix: add an orchestrated-mode invalid-config case asserting
  `assert.deepStrictEqual(outcome, { status: "failed", reason: "invalid manifest", error:
  <expected>, cause: 'Config file "claude-plugins.local.json" failed schema validation.' })`, plus a
  base-file twin pinning `"claude-plugins.json"` — no case covers the non-`--local` invalid-config
  path at all.
- **[WARNING] One case exercises `domain/source.ts`, not `add.ts`** —
  `test('MA-4: tilde paths are preserved verbatim in stored source.raw')`, lines 752-764.
  It never calls `addMarketplace`; it dynamically imports `pathSource` and asserts `source.raw`.
  Its own comment concedes "the parser test in tests/domain/source.test.ts is the deeper coverage."
  Fix: delete it — `tests/domain/source.test.ts` owns `pathSource`, and the add-side contract it
  gestures at is already covered by the real case at line 766 (`src.raw` on the persisted record).
- **[WARNING] Five dynamic `await import()` calls, four of them redundant** — lines 759, 1755,
  1797, 1836, 1846.
  `loadConfig` is imported dynamically three separate times; `writeFile` at 1846 is *already* a
  static import at line 11. No case needs deferred loading. Fix: add
  `import { loadConfig } from ".../persistence/config-io.ts";` to the static block and delete all
  five dynamic imports (line 759 goes away with the case above).
- **[WARNING] Standalone-negative and single-field assertions where the value itself is the
  promise** — lines 1184, 1188, 1236, 1312, 1318, 1250, 1653.
  `assert.ok(projectState.marketplaces["valid-marketplace"] !== undefined)` (1184, 1188) and
  `assert.ok(state.cloneCalls[0]?.auth !== undefined)` (1236, 1312) are the exact
  `assert.ok(x !== undefined)` form the rules call out — they pass for any value. Line 1318 checks
  only `result.password` where line 1250's sibling deep-compares the whole `GitCredentials`.
  Line 1653 checks `outcome.error instanceof MarketplaceDuplicateNameError` without the structured
  `mpName`/`scope` fields. Fix: replace each with a `deepStrictEqual` against a hand-written value
  (the whole record for 1184/1188, the whole `{ host, credentialOps }` projection for 1236/1312,
  the whole credentials object for 1318, and `error.mpName`/`error.scope` for 1653).
- **[WARNING] `prototypeReads` counts couple two cases to the exact number of `instanceof` checks in
  production** — lines 1532 (`assert.strictEqual(prototypeReads, 5)`) and 1598 (`, 3`).
  These pin how many times `unwrapAddError` / `classifyAddError` / `addSubjectName` consult the
  prototype chain (`add.ts:207-290`). Adding one `instanceof` arm to `classifyAddError` — a routine
  change — breaks both cases without any behavior change. The outcome `deepStrictEqual` immediately
  above each is the real assertion. Fix: delete both counter assertions; keep the Proxy, which is
  legitimately planting a non-`Error` throw.
- **[WARNING] `makeMockGitOps`'s `cloneThrows` fires after the fixture has already been copied** —
  lines 140-151.
  The wrapper delegates to `git.gitOps.clone(...)` — which, with `cloneFixture` set, copies the
  whole fixture into the staging dir — and only then throws. Every `cloneThrows` case (2107, 2145,
  2172, 2207, 2239, 2271, 2309, 2380) therefore models "clone failed" with a fully populated
  staging directory, which the real `GitOps` would never produce. The shared fake already models
  this correctly via its own `cloneError` option (`git-ops-fake.ts:131-133`), which throws before
  the copy. Fix: pass `cloneError` through to `createGitOpsFake` instead of throwing in the wrapper,
  and drop `cloneThrows`.
- **[WARNING] A stale cross-reference and three banned "byte-identical to today" phrasings** —
  lines 1705 (title), 1714 (comment), 2340 (title).
  Line 1714's "matching the standalone test at line 60" points at the body of
  `makeMockCredentialOps`; the case it means is `MA-5: github source clones, validates, renames …`
  at line 243. And `.claude/rules/typescript-comments.md` bans "byte-identical to what came before"
  in comments and titles alike. Fix: cite the sibling case by its `test('…')` title, and reword the
  two titles to state the current contract ("omitting `notifications` returns void and emits one
  `(added)` row").
- **[WARNING] Test-support duplicated across siblings instead of extracted** — `fixtureMarketplaceDir`
  (lines 49-53) and inline HOME save/restore (lines 772-774 + 813-821, 1111-1113 + 1130-1138,
  1145-1147 + 1193-1201).
  `fixtureMarketplaceDir` is byte-comparable to `update.test.ts:55` and
  `tests/orchestrators/plugin/update.test.ts:76`. The HOME juggling is a hand-inlined, three-times
  repeated subset of `update.test.ts:192-215`'s `withHermeticHome`, and `withTmpScope` (line 230)
  deliberately does *not* provide it. Fix: extract one `create-marketplace-test-env.ts` beside the
  marketplace tests exporting `fixtureMarketplaceDir` and a `withHermeticHome` that composes with
  `withTmpScope`; the three inline blocks then collapse to one wrapper call each.

### `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`

- **[WARNING] `AddMarketplaceNotifications` is exported and imported by nothing** — `line 107`.
  `grep` over `extensions/` and `tests/` finds the identifier only inside `add.ts` itself and in
  four *comments* in sibling modules ("Mirrors `AddMarketplaceNotifications`"). Google style: "Every
  export is used outside its module." Fix: drop `export` (the type is still used at line 187), or —
  if the sibling modules genuinely want the same shape — hoist one shared
  `NotificationMode` into `orchestrators/types.ts` and have all five import it instead of
  re-declaring and cross-referencing it in prose.
- **[WARNING] The source-kind dispatch is an `if/else-if/else` chain with no exhaustiveness arm,
  and it duplicates a second closed-set enumeration ten lines above** — `lines 336-340` (the
  allow-check) and `lines 359-391` (the dispatch).
  After the guard at 336, `source.kind` is narrowed to `"github" | "path" | "url"`, but the
  dispatch's `else` catches `path` by elimination. Admitting a fourth kind at line 336 without
  touching 359 silently routes it into `addPathInGuard` — no compile error at either site. This is
  the same silent-omission class META-FINDINGS ranks item 5, and the codebase's own idiom
  (`assertNever` in `default`) already exists. Fix: convert 359-391 to
  `switch (source.kind) { case "github": … case "url": … case "path": … default: return assertNever(source); }`.
- **[WARNING] `ConfigInvalidError` carries the basename only in its message string** —
  `lines 298-303`.
  The repo's error convention (CONVENTIONS.md, "never encode structured data only in the message
  string") wants a `readonly configBasename: string` field. It is not cosmetic: because the add
  surface renders no cause line, the basename is unobservable today, which is why the T-56-02-05
  mitigation has no assertion (test finding above). A structured field makes it assertable through
  `outcome.error`.
- **[WARNING] Three comments narrate "byte-identical to today"** — `lines 99, 184, 539`.
  Same rule as `add.messaging.ts` above: name the gate that pins the bytes, or say nothing.
- **[WARNING] `gitOps` and `credentialOps` default to live boundaries** — `lines 534-535`,
  declared at 158 and 165.
  "No parameter defaults to a live boundary; real adapters wire up in one composition module" is a
  stated rule, and this default is the root cause of the first pass's three "falls through to
  `DEFAULT_GIT_OPS`" warnings across both test files. Nothing breaks today (every fall-through path
  is provably network-free), so this is a design finding, not a hermeticity break. Fix: make both
  required on `AddMarketplaceOptions` and move the defaults to the composition boundary —
  `edge/handlers/marketplace/add.ts:38` and `orchestrators/plugin/bootstrap.ts:103` (whose header
  comment at line 21 currently *relies* on the orchestrator's default) are the two call sites to
  update. See the OVERSTATED grading below for why the test-side remedy is the wrong place to fix
  this.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `add.ts` | `addMarketplace` | `add.test.ts:243` and ~45 further cases | owned |
| `add.ts` | `AddMarketplaceOptions` (interface) | structurally checked by every call literal; imported by `orchestrators/import/execute.ts:34` | owned |
| `add.ts` | `AddMarketplaceOutcome` (type) | `add.test.ts:585, 666, 929, 975, 1473, 1526, 1592, 2261`; imported by `import/execute.ts:35` | owned |
| `add.ts` | `AddMarketplaceNotifications` (type) | — | **NO CASE, and no production importer** — orphan export (finding above) |
| `add.messaging.ts` | `ADD_CONTEXT` | `add.messaging.test.ts:18` | owned as a data literal only — see note |
| `add.messaging.ts` | `AddPrivateReason` (type) | `add.messaging.test.ts:8-15` | owned (widening gap above); sanctioned compile-time pin per CONVENTIONS.md |

Note on `ADD_CONTEXT`: it is **behaviourally unobservable** for this command. `notifyWithContext`
reads `context.Messaging.label` only to stamp the cascade envelope's tally
(`shared/notify-context.ts:170`), and the tally renders **iff `cardinality === "plural"`**
(`notify-context.ts:163-166`); `add.ts:494` and `:621` never pass `cardinality`. `context.render` is
`{}` because `marketplace add` always emits `plugins: []`. So mutating the label, or swapping
`ADD_CONTEXT` for any other context object in `add.ts`, changes no byte of any add output and can
only be caught by `add.messaging.test.ts`'s literal-vs-literal comparison. This is not a defect —
it is the honest ceiling for this pair, and the fixing pass should not try to write a behavioral
test for it.

## Branch census

`add.ts`, by function. Paired cases named where covered.

- `unwrapAddError` (207-222): typed-error early return **covered** (326, 363, 407, 521);
  `err.cause` unwrap of an `appendLeakToError` wrapper **covered** — case 469 chmods the staging
  parent to `0o555` so `cleanupStaging` genuinely leaks and the typed error arrives wrapped;
  bare `return err` for a non-`Error` **covered** (1451).
- `classifyAddError` (231-269): all four `instanceof` arms **covered**; `ENOENT` **covered** (1036);
  `ENOTDIR` **covered** (997, a real Unix socket); the `classifyGitSourceAccessFailure` delegate
  **covered** for 401/403/404/410/429/500 and `UserCanceledError`; `undefined` fallthrough
  **covered** (1451, 1548). HTTP 408 shares the map arm with 429 — same-arm, not a gap.
- `addSubjectName` (279-290): duplicate-name arm **covered** (363); stale-clone-with-name arm
  **covered** (326); rawSource fallback **covered** (407, 521, 997, 1036).
  The `StaleSourceCloneError && mpName === undefined` fall-through to rawSource is **unreachable
  from this module** — `add.ts:682` is the only producer and always passes `derivedName`. Defensive
  code for an optional field on a shared error class, not a coverage gap; do not write a test that
  reaches it by construction.
- `ConfigInvalidError` / CFG-03 abort (354-357): `--local` arm **covered** (1842); base-file arm
  **reachable and untested**; the error's message content **unasserted on every arm** (finding above).
- `runAddInGuard` source-kind guards (328-340): S5a unknown-kind **covered** (521) but its message
  (`: ${source.reason}`) **unasserted anywhere**; S5b unsupported-kind **covered with the exact
  message** (563 data-driven loop).
- Target-config selection (344-345): both arms **covered** (1736 base, 1777 local).
- Dispatch (359-391): github **covered** (243), url **covered** (2008), path **covered** (607); no
  exhaustiveness arm (production finding above).
- Write-back gate (410-419): `!orchestrated` **covered** (1736), orchestrated-skip **covered** (1814);
  the `cfg.config` vs `{ schemaVersion: 1 }` selection at 411 is **reachable, executed, and its
  consequence unasserted** (BLOCKER above).
- Write-back catch (422-434): github clone cleanup **covered** (1885), url clone cleanup **covered**
  (1937), path no-cleanup **covered** (674); non-`Error` normalization **covered** (674, asserted as
  `new Error("config writer stopped")`).
- `handleAddFailure` (453-496): all four combinations of `reason === undefined` × `orchestrated`
  **covered** (1451/1548 orchestrated-unparseable, 674/1885 standalone-rethrow, 2239 orchestrated-classified,
  326 etc. standalone-classified).
- Post-commit cache try (578-590): failure/swallow **covered** (908); `invalidateMarketplaceNames`
  success **covered** (846); `dropMarketplaceCache` **reachable-untested** (finding above).
- Post-commit seeding try (598-602): failure/swallow **covered** (945); the seeding effect itself
  **reachable-untested** (finding above).
- `rethrowPreconditionErrors` (563-568): true arm **covered** (1661, orchestrated only); false/omitted
  **covered** throughout. Standalone + `rethrowPreconditionErrors` is the same code path — not a gap.
- `addGitClonedInGuard` (636-717): clone-throw cleanup **covered** (2107); manifest-invalid
  **covered** (407); MA-8 **covered** (363); MA-6 **covered** (326); rename + state mutation
  **covered**; `!stagedAtFinal` catch **covered** (407); `stagedAtFinal` catch **covered** (1548);
  `source.ref !== undefined` spread **covered both ways** (291, 2040); `auth !== undefined` spread
  **covered both ways** (1208 with, 2008 without). The `stagedAtFinal === true && finalDir === undefined`
  combination is **unreachable** — `stagedAtFinal` is only set after `finalDir` is assigned;
  the `else if` guard is compiler-forced narrowing (D-116-01a category), not dead code to delete.
- `addGithubInGuard` (719-756): the `auth === undefined` spread arm is **unreachable for github** —
  `github.com` is always provider-registered, so `buildAuthForHost` always returns a bundle. Shared
  code with `addUrlInGuard`, where both arms are covered; not a gap.
- `addPathInGuard` (800-867): `isDirectory` **covered** (607), `isFile` **covered** (723),
  neither-file-nor-directory **covered** (997), MA-8 **covered** (1061).
- `expandTildePath` (869-875): bare `~` **covered** (1107), `~/…` **covered** (766), passthrough
  **covered** (607 and most others).

`add.messaging.ts`: no branches — two type declarations and one frozen literal.

## Grading of first-pass findings

### `tests/orchestrators/marketplace/add.test.ts`

- **OVERSTATED** — "One case falls through to the real `DEFAULT_GIT_OPS`" (line 648). The fall-through
  is real, but the case is titled `accepts a path marketplace through the offline default Git port`
  and is the **only** owner of `add.ts:534`'s `opts.gitOps ?? DEFAULT_GIT_OPS` branch — injecting a
  fake there, as recorded, would leave that branch uncovered while fixing nothing (a path add
  provably reaches no `GitOps` method). Correct severity: no test-side finding; the actionable
  residue is the production default (WARNING, filed above against `add.ts:534`).
- **CONFIRMED** — "Weak error-identity assertion in the orchestrated-mode unsupported-source case"
  (1421-1449). Verified: `assert.ok(outcome.error instanceof Error)` plus a non-empty-string check,
  where the sibling at 563-590 builds the exact `UnsupportedSourceError` and deep-compares the whole
  outcome. Sharpen the fix: this is also the only case that could pin the S5a message
  (`add.ts:329-331`), which is asserted nowhere — the expected `cause` is
  `Cannot add marketplace from "git@github.com:foo/bar.git": <source.reason>`.
- **CONFIRMED** — "Narration comments mixed into the assert phase". Verified at 261, 268, 276, 286,
  426-428, 439, 450-453, 549, 624, 632. One citation is off: "lines 604-605" points at closing
  braces, not a comment. The recorded rule (keep the ones carrying rationale, delete the ones
  restating the next line) is right.

### `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`

- **UNDERSTATED** — "Hidden `randomUUID()`/`new Date()` dependencies". Two things the recorded
  version misses. First, there is a **second** `new Date().toISOString()` at line 863 (the path
  branch), not just line 700. Second, the consequence is not "design hygiene": the inline clock is
  what makes the whole-record `deepStrictEqual` above impossible to write without
  `t.mock.timers`, and `update.test.ts:2283` has already had to adopt exactly that workaround —
  "faking `Date` where an injected clock would do" is itself a named smell. Severity should stay
  WARNING but the finding must name both sites and the blocked assertion, so the fixing pass
  sequences the clock injection *before* the record-assertion work.
- **CONFIRMED** — "Undocumented `as { name: string }` casts" (670, 846). Correct the remedy, though:
  `loadMarketplaceManifest` already returns `MarketplaceManifest`, whose schema declares a required
  `name: Type.String()` (`domain/manifest.ts:26-37`), so `parsed.name` type-checks directly and both
  casts can simply be **deleted** — no comment and no return-type change needed. `clone-cache.ts:467`
  already accesses `manifest.plugins` uncast, which is the in-repo proof.

### First-pass claim: "Note on `add.messaging.test.ts` size (33 lines)"

**CONFIRMED with a qualification.** The claim that the pair is proportionate rather than a stub
holds — but the reason is stronger than recorded and cuts the other way for the fixing pass:
`ADD_CONTEXT` is not merely small, it is *unobservable* through `marketplace add`'s output (see the
census note). The first pass says the test gives "exhaustive coverage of everything the module
does"; more precisely, it is a data-pin with no behavioral consequence, and it still misses the
type-widening mutation (finding above).

## Still clean after attack

- **`tests/orchestrators/marketplace/add.messaging.test.ts`** — apart from the two findings above,
  it kills the mutations that matter for a frozen literal: label text change (line 29's whole-object
  `deepEqual`), adding or removing a `render` arm (29 and 32), key reordering (30 and 31, which
  compare `Object.keys` *in order*), and narrowing `AddPrivateReason` (11). Its whole-object compare
  is actually stronger than both siblings, which compare keys and label separately.
- **`tests/orchestrators/marketplace/add.test.ts`** — strengths worth protecting through the rewrite:
  - **The MA-8-before-MA-6 ordering is genuinely pinned.** On the second github add (case 363) both
    conditions hold — the name is a duplicate *and* `sources/valid-marketplace/` exists from the
    first add — and the case asserts `{duplicate name}`. Swapping steps 3 and 4 of
    `addGitClonedInGuard` (`add.ts:672-683`) fails it.
  - **Extra notifications cannot slip through.** `makeCtx`'s `when(() => ctx.ui).thenReturn(ui).times(n)`
    makes an (n+1)th `ctx.ui` access throw, so every `notifications.find(…)`/`some(…)` check is
    backed by a hard cap on the count. That is what makes the fragment-assertion cluster a
    content problem only, not a cardinality problem.
  - **The git fake fails loudly on unplanned remotes.** `ALLOWED_MARKETPLACE_REMOTES` (113-123) is
    passed as `allowedRemoteUrls`, and `createGitOpsFake` throws `blocked unplanned remote <url>` on
    anything else — the pattern META-FINDINGS says to propagate is **already adopted here**.
  - **Real rollback proofs against a real filesystem.** Case 469 produces a genuine `cleanupStaging`
    leak via `chmod 0o555` and asserts the leaked tree survives *and* that the wrapped error still
    classifies; case 1885 uses a read-only scope root; case 1937 makes `state.json` a directory to
    force EISDIR and then proves a second invocation converges, comparing the config file's exact
    bytes.
  - **Whole-value comparisons where they exist are strong**: the git-call recorder is compared as a
    whole empty-state object (592-598, 709-715, 931-937), and the persisted `state.json` is compared
    whole in the negative direction (`{ schemaVersion: 2, marketplaces: {} }`, at 514, 599, 716, 1487,
    1541, 1608).
  - **Reference identity is asserted where the contract is identity** — `credentialOps` compared with
    `assert.equal` against the injected object (1241-1245, 1375-1379), which a re-bundling mutation
    would fail.

## Not covered

- No test, coverage, or lint command was run, per the brief; every conclusion is from reading plus
  read-only `grep`. Direct per-pair coverage for `add.ts` ↔ `add.test.ts` is still unmeasured.
- The update side (`update.test.ts`, `update.messaging.test.ts`, `update.ts`, `update.messaging.ts`)
  — agent b's assignment. I read `update.test.ts:192-215` and `:2280-2345` only to name the
  `withHermeticHome` and whole-record-assertion references, and `remove.messaging.test.ts:1-60` /
  `update.messaging.test.ts:1-56` to establish the sibling idiom for the type pins.
- `orchestrators/marketplace/shared.ts`, `orchestrators/plugin/clone-cache.ts`,
  `persistence/config-write-back.ts`, `domain/manifest.ts`, and `shared/git-failure-classifiers.ts`
  were read only far enough to settle contracts the add-side files depend on; not scored here.
- The `_fixtures/` directories were opened only to confirm what the manifests declare. One incidental
  note: `_fixtures/valid-marketplace/.claude-plugin/marketplace.json` has
  `"owner": { "name": "Phase 4 Tests" }` — a GSD planning reference surviving in fixture data. It is
  data, not a comment or a title, so it is outside the letter of
  `.claude/rules/typescript-comments.md`; rename it to something durable (`"marketplace fixture"`)
  when the fixtures are next touched.

## Meta-findings impact

### New cross-cutting evidence

- **The fragment-assertion cluster reaches `add.test.ts`, which META-FINDINGS' leverage-item-3 table
  does not list.** Six sites (842, 1870, 2136, 2168, 2301, 2412) where the whole expected string is
  computable — and, unusually, where the *correct form is two cases away in the same file*
  (2192-2199, 2227-2234). Every other orchestrator test file praised for whole-message assertions
  should be re-checked for the same partial adoption rather than trusted from its summary; a file
  can be 90% correct and still carry the class.
- **`verify()` placement is a defect class, not a per-file slip.** `add.test.ts`'s `makeCtx` puts
  `verify()` inside the stub it installs, which silently disables it whenever the expected call
  count is not reached — six cases in this file arrange expectations that are never met and never
  reported. META-FINDINGS names `tests/orchestrators/**` as the *reference implementation* for strict
  interaction mocking; that endorsement should be re-verified. **Grep every file for `verify(` that
  is not a top-level statement in a `test()` body** — a `verify` inside a callback, a helper, or a
  `finally` is the same bug wherever it appears.
- **Defaulting a production parameter to a live boundary is the root cause behind a family of
  test-side findings.** `add.ts:534-535` (`?? DEFAULT_GIT_OPS`, `?? DEFAULT_CREDENTIAL_OPS`) is what
  makes "this test forgot to inject `gitOps`" possible at all, and the first pass logged three such
  warnings across this area alone. Every orchestrator entrypoint with a `?? DEFAULT_*` parameter
  default should be audited the same way; the fix belongs in the composition modules
  (`edge/handlers/**`, `orchestrators/plugin/bootstrap.ts`), not in the tests.
- **Closed-set type pins in `*.messaging.test.ts` catch narrowing but not widening.** Both
  `AddPrivateReason` (`add.messaging.test.ts:8-15`) and `RemovePrivateReason`
  (`remove.messaging.test.ts:12-15`) accept an added member silently. This is META-FINDINGS'
  silent-omission class showing up on the *type* side rather than the `switch` side; check every
  `*PrivateReason` / `*RowMsg` pin in the repo for a widening guard.
- **The `makeMock*` naming convention and the testing rules contradict each other, unresolved.**
  `CONVENTIONS.md` records "Mock factories use `makeMock*` prefix"; the unit-testing skill says a
  double is "named for its role only — no `mock`/`fake`/`stub` in the name". `add.test.ts`'s
  `makeMockGitOps` / `makeMockCredentialOps` / `makeMockDeviceFlowHttp` all return **fakes**, so the
  name is doubly wrong under the skill. This affects at least nine test files; it is an operator
  decision, not a per-file finding, and should be settled before any renaming pass.

### Corrections to META-FINDINGS.md

- **"Offline fake that fails loudly on unplanned input … `tests/orchestrators/plugin/fetch.test.ts`
  — **Adopt this in the other git fakes**."** The pattern is not confined to `fetch.test.ts`:
  `add.test.ts:113-128` already passes an `ALLOWED_MARKETPLACE_REMOTES` allow-list into
  `createGitOpsFake`, and the allow-list is a first-class option on the *shared* fake
  (`tests/platform/git-ops-fake.ts:10, 88, 117-121`), not a local invention. The correction: this is
  an under-used shared capability, not a pattern needing porting — the actionable item is "audit
  which `createGitOpsFake` call sites omit `allowedRemoteUrls`", which is a much smaller job than the
  entry implies.
- **The `add.test.ts` half of "sibling drift: `update.test.ts` vs `add.test.ts` (hand-rolled doubles
  vs `strong-mock`)" is only half true.** `add.test.ts` does use `strong-mock` — but its `verify()`
  is inert in six cases (above), so "`add.test.ts` is the known-good target to propagate" is unsafe
  as written. Fix `makeCtx` first, then propagate.
- The first pass's clean verdict on `add.messaging.ts` and `add.messaging.test.ts` holds in
  substance — two WARNING-level findings each, no BLOCKER — which is a genuine confirmation that
  small `*.messaging` pairs are the healthiest corner of this area.

### Confirmations

- **"Whole-message assertion against hand-written strings — any `*.messaging.test.ts`" as the
  reference implementation** — independently confirmed from the add side: `add.messaging.test.ts`
  survives every literal-mutation class I ran, and the strongest cases in `add.test.ts`
  (499-506, 2192-2199, 2227-2234) are precisely the ones that copied that form.
- **Leverage item 5, "restore exhaustiveness on closed-union switches"** — confirmed from a new
  angle: `add.ts:336-391` is the same class expressed as an `if/else` chain plus a duplicated
  allow-list, so an audit scoped to `switch` statements will miss it. Widen the audit to any
  closed-set enumeration that appears twice in one module.
- **"Direct per-pair coverage was never measured"** — confirmed and still true; several of my
  findings (the unowned `dropMarketplaceCache` and seeding call sites, the untested base-file
  CFG-03 arm) are exactly what a `--experimental-test-coverage` run on this pair alone would have
  surfaced mechanically.
