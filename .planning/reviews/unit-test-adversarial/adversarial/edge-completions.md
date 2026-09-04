# Edge — tab completions — adversarial re-review

**Scope:** `extensions/pi-claude-marketplace/edge/completions/{data,normalize,provider}.ts`
and `tests/edge/completions/{data,normalize,provider}.test.ts`, all six read in full.
Also read for cross-checking: `shared/completion-cache.ts`, `edge/flag-catalog.ts`,
`edge/router.ts`, `shared/types.ts`, `orchestrators/edge-deps.ts` (resolver factory),
and the case inventories of `tests/shared/completion-cache.test.ts` and
`tests/architecture/flag-catalog-drift.test.ts` (the only other callers of the
surfaces under review).
**First-pass file:** `unit-test-findings/edge-completions.md`
**Clean files attacked:** 3 declared clean (`provider.test.ts`, `normalize.test.ts`,
`data.ts`), plus the 3 files that carried only documentation warnings
(`data.test.ts`, `normalize.ts`, `provider.ts`), re-attacked in full.
**Existing findings graded:** 10 (9 findings + 1 load-bearing summary claim)

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 3 |
| New WARNING (missed by first pass) | 10 |
| Existing CONFIRMED | 3 |
| Existing UNDERSTATED | 0 |
| Existing OVERSTATED | 4 |
| Existing REFUTED | 1 |
| Existing DUPLICATE-OF | 2 |

The first pass's characterisation ("one of the strongest-built areas in the sweep")
is broadly right about *authoring* — whole-value comparisons, awaited rejections,
error identity, per-case temp roots, no shared mutable setup. It is wrong about
*discrimination*: three separate wrong implementations survive every case in the
area, and all three sit inside the files it declared clean.

## New findings — from the clean lists

### `tests/edge/completions/data.test.ts`

- **[BLOCKER] No case can tell a prefix filter from a substring filter — 4 sites** —
  `lines 361, 375, 390` (`getMarketplaceCompletions`), `786`, `799`, `828`
  (plugin half), `845`, `861` (marketplace half), `887`, `903` (bare `@` form).
  Changing every `startsWith` in `data.ts` to `includes` — at `data.ts:247`
  (`getMarketplaceCompletions`), `data.ts:526` (`getPluginHalfCompletions`),
  `data.ts:559` (`getMarketplaceOnlyCompletions`) and `data.ts:607`
  (`getPluginRefCompletions`'s marketplace filter) — leaves **every case in this
  file green.** Measured over the exact seeded name sets: `["official","other",
  "internal"]`/`"o"`, `["Official"]`/`"o"` and `"O"`, `["solo","shared"]`/`"so"`,
  `"sh"`, `"SO"`, `["mp-a","mp-b"]`/`"mp-"` and `"mp-b"` — all ten produce
  identical output under both predicates. The case at line 361 is titled *"keeps
  only the prefix matches"*, which is precisely the claim the assertion does not
  make.
  **Fix (one rule for all four sites):** every seeded name list gets a decoy that
  contains the typed token without starting with it, and the expected list omits
  it. Concretely: line 363 `const names = ["official", "other", "internal",
  "unofficial"];` with the expectation unchanged; line 392
  `const names = ["Official", "unOfficial"];`; `twoMarketplaceSeed()` (line 773)
  gains a plugin `"not-solo"` in `mp-a` (status `installed`) so `"so"` still
  yields only `solo@mp-a`; the two-marketplace seed gains a third marketplace
  `"x-mp-a"` so the `"mp-"` and `"mp-b"` marketplace-half cases discriminate.
  The sibling that already does this right is
  `tests/edge/completions/provider.test.ts:246-253` — its `"ins"` and `"l"` rows
  are the only two cases in the whole area that a substring implementation fails.

- **[BLOCKER] The `scope` half of the plugin-index cache key is never
  discriminated** — `test('a marketplace named in both scopes is recorded once
  for the same plugin')`, `lines 721-736`. This is the only case anywhere in the
  unit suite where the same marketplace name exists in both scopes, and it seeds
  **identical** manifests for both (`user.official` and `project.official` both
  return `[{ name: "held", status: "installed" }]`). Consequences: mutating
  `data.ts:421` to `getPluginIndex(cachePath, "user", mp, …)` (a constant scope),
  or dropping `scope` from `completion-cache.ts:167`'s `pluginIndexKey`, makes the
  second scope's read return the **first scope's cached rows** — and no case
  fails. I checked every other candidate: `map-inventory-both`, `map-info`,
  `map-fetch-scoped` and `map-install-project` all pair *differently named*
  marketplaces across scopes, so no key collision is observable there either, and
  every case in `tests/shared/completion-cache.test.ts` uses a single scope with a
  unique marketplace name per case (verified across all 30 of its
  `const scope`/`const marketplace` pairs), so the owner of `pluginIndexKey` does
  not prove it either. Production impact is real, not theoretical: a marketplace
  registered in both scopes is the normal CMP-8 shadowing case, and a collision
  would offer the wrong scope's plugin list.
  **Fix:** in the case at line 721, give the two same-named marketplaces
  different rows — `user.official: [{name:"held",status:"installed"},
  {name:"user-only",status:"installed"}]`, `project.official:
  [{name:"held",status:"installed"}]` — and assert
  `[["held",["official"]],["user-only",["official"]]]`. That keeps the dedup claim
  the title makes *and* fails the moment the two scopes share a cache entry.
  Retitle to `'reads a same-named marketplace separately per scope and records the
  shared plugin once'`.

- **[WARNING] The install source-scope early return is not discriminated inside
  its owning pair** — `lines 467-521`. `sourceMarketplacesForInstall`
  (`data.ts:327-344`) returns *user marketplaces only* when the target scope is
  `user`; deleting that early return so a user-target install also sweeps project
  marketplaces leaves `map-install`, `map-install-partial` and
  `map-install-recorded` green, because none of them seeds a project marketplace.
  Only `provider.test.ts:570-577` catches it, incidentally — an ownership leak
  (`getPluginToMarketplacesMap` is owned here). **Fix:** add a project marketplace
  carrying an `available` plugin to the seed at line 469 and keep the expectation
  at line 478 unchanged; retitle to name the exclusion.

- **[WARNING] One expected value is another production call's output** —
  `line 651`, `assert.deepStrictEqual(Array.from(withPartial),
  Array.from(withoutPartial))`. The rule is that expected values are built
  independently. It is sound only transitively (the first list is pinned to a
  literal on line 645). **Fix:** compare `withPartial` to the same hand-written
  four-row literal rather than to the sibling result.

### `tests/edge/completions/provider.test.ts`

- **[BLOCKER] `MARKETPLACE_VERBS_WITH_NAME_ARG` is a 6-member closed set with one
  member exercised** — `provider.ts:62-69`; the only case that reaches it is
  `test('TC-2 promotes an exact marketplace subcommand token to the name
  argument')` (line 351) and the `"marketplace remove "` / `"marketplace remove h"`
  rows (lines 385-394). Deleting `"rm"`, `"info"`, `"update"`, `"autoupdate"` or
  `"noautoupdate"` from that set leaves the whole suite green — grep-confirmed
  that `getArgumentCompletions` is called from only three test files
  (`provider.test.ts`, `flag-catalog-drift.test.ts`, `register.test.ts`) and none
  drives those four heads. The set's *exclusions* are equally unproven: only
  `marketplace add ` is driven (line 413); `marketplace list ` — the other
  deliberate exclusion named in the doc comment at `provider.ts:57-60` — is never
  driven, so adding `"list"` to the set is also undetectable. This is the
  silent-omission class META-FINDINGS §5 names.
  **Fix:** turn the TC-5 row table at line 369 into a table covering all six
  members plus both exclusions — `marketplace rm `, `marketplace info `,
  `marketplace update `, `marketplace autoupdate `, `marketplace noautoupdate `
  each expecting `[{hub…},{lab…}]` with the head rebuilt, and `marketplace list `
  expecting `null` alongside the existing `marketplace add ` row.

- **[BLOCKER] No case can tell a prefix filter from a substring filter — 3 further
  sites** — same rule as the `data.test.ts` blocker above, applied to
  `provider.ts:129` (`marketplaceSubcommandCompletions`), `provider.ts:81`
  (`scopeValueCompletions`) and `provider.ts:116` (`flagCompletions`). Measured:
  `"marketplace r"` → `["remove","rm"]` under both predicates (no other
  marketplace subcommand contains an `r`); `"marketplace remov"`, `"install
  --scope u"`, `"install --m"` and `"install -"` likewise. Only
  `topLevelCompletions` is discriminated, by the `"ins"` and `"l"` rows.
  **Fix:** add rows whose typed token is a substring of a non-matching member —
  e.g. `"marketplace up"` expecting only `[{label:"update",…}]` while
  `noautoupdate`/`autoupdate` contain `up`; `"install --l"` expecting only
  `--local` while `--map-model` contains `l`. One discriminating row per filter
  function is enough.

- **[WARNING] Exact-token promotion is proven only through the `marketplace`
  head** — `test('TC-2 promotes an exact top-level token with no trailing space to
  the next argument')`, `line 286`. `promoteExactSubcommandToken`
  (`provider.ts:148`) promotes *any* member of `TOP_LEVEL_SUBCOMMANDS`; narrowing
  its first arm to `current === "marketplace"` leaves every case green, because no
  committed prefix is a bare exact top-level verb — every TC-6/TC-5 row carries a
  trailing space. **Fix:** add two cases — `getArgumentCompletions("install",
  resolver)` expecting the same two rows as `"install "`, and
  `getArgumentCompletions("list", resolver)` expecting the two marketplace names —
  next to the existing `"marketplac"` short-token partner at line 275.

- **[WARNING] `--partial` is never combined with the bare `@` form** —
  `lines 798-823` drive `--partial` only at a plain plugin cursor. Mutating
  `provider.ts:316` to pass `{...options, partial: false}` into the
  marketplace-only path leaves the suite green. **Fix:** add a row
  `"update --partial @"` expecting `[{label:"@hub", value:"update --partial @hub "}]`
  (the `lab` manifest carries no upgradable row, so it must be absent) — the same
  seed already makes this discriminating.

### `tests/edge/completions/normalize.test.ts`

- **[WARNING] No case has more than one space before the cursor, so the module's
  own documented behaviour is unproven** — `lines 17-36`. All three collapse rows
  fix `cursorCol: 5` against `"list…"`, i.e. exactly one space precedes the
  cursor. `normalize.ts:41` deletes only the spaces **at and after** the cursor
  and keeps everything before it, so with two preceding spaces the run collapses
  to two, not one — while the file header (`normalize.ts:5-9`) claims it
  collapses "a run of spaces at the cursor to a single space". An implementation
  matching the header (scanning backwards as well) passes every committed case.
  **Fix:** add one row `{ commandLine: "list   --installed", cursorCol: 6 }`
  expecting `{ lines: ["list  --installed"], cursorLine: 0, cursorCol: 6 }`, and
  correct the header to say the run is deleted from the cursor forward, leaving
  the text before the cursor untouched.
- **[WARNING] `\s` in the command regex is undiscriminated** — `line 190` rows.
  Replacing `(?:\s|$)` at `normalize.ts:23` with `(?: |$)` passes all eleven rows;
  no row separates the command from its arguments with a tab or newline.
  **Fix:** add `{ commandLine: "/claude:plugin\tinstall", recognized: true }` to
  the row table, or narrow the regex to a literal space and say so in the header.

### `tests/edge/completions/data.test.ts` + `tests/edge/completions/provider.test.ts`

- **[WARNING] `seedResolver` and `installNetworkTrap` are duplicated across the
  two files** — `data.test.ts:113-176` and `provider.test.ts:161-213`, roughly
  100 lines including near-identical 20-line doc comments that differ only in the
  throw message and the seeding strategy. **Fix:** extract
  `tests/edge/completions/completion-resolver.ts` exporting `installNetworkTrap(t)`
  and `createSeededResolver(t, label, seed)`, with `provider.test.ts`'s fixed
  hub/lab manifests expressed as a `ResolverSeed` literal passed into the same
  factory. The in-repo precedent for test support beside its concern is
  `tests/edge/handlers/marketplace-seed.ts`; do not move it to `tests/helpers/`.

## Production findings the first pass missed

### `extensions/pi-claude-marketplace/edge/completions/provider.ts`

- **[WARNING] The "unavoidable" uncovered branch at line 125 is removable** —
  `optionalDescription` (`lines 124-126`) exists only because the local `flags`
  array at `line 106` is typed `{ name: string; description?: string }[]`, and it
  is typed that way only because `completionFlagEntries` **declares** its return
  as `{ name: string; description?: string }[]` (`edge/flag-catalog.ts:174`) while
  building every element from a `FlagEntry` whose `description` is **required**
  (`flag-catalog.ts:41`) — a fact that file's own doc comment already states
  ("a completable entry without one cannot be constructed; `completionFlagEntries`
  therefore needs no presence test", `flag-catalog.ts:36-37`). **Fix:** narrow
  `completionFlagEntries`'s return type to `{ name: string; description: string }[]`,
  declare `flags` as `{ name: string; description: string }[]`, inline
  `description: f.description` at `provider.ts:120`, and delete
  `optionalDescription`. That removes the branch instead of documenting it, and
  restores this pair to complete branch coverage with no coverage exception. The
  one-line half of this fix lands in `edge/flag-catalog.ts`, owned by
  `unit-test-findings/edge-root.md`; sequence them together.

### `extensions/pi-claude-marketplace/edge/completions/data.ts`

- **[WARNING] `LocationsResolver.marketplaceNamesCachePath` has no consumer** —
  `line 132`. Nothing under `edge/completions/` calls it: `data.ts` imports only
  `getPluginIndex` and `ManifestSoftFailError` from the cache, and
  `getMarketplaceNamesAcrossScopes` deliberately reads state directly (its own doc
  comment at `lines 289-292` explains why). The member is nevertheless implemented
  three times in tests (`data.test.ts:145`, `provider.test.ts:188`,
  `flag-catalog-drift.test.ts:58`) and once in production
  (`orchestrators/edge-deps.ts:149`, which has its own paired cases at
  `tests/orchestrators/edge-deps.test.ts:221-256` testing a path nothing calls).
  Widen the check before fixing: `getMarketplaceNames`
  (`shared/completion-cache.ts:250`) has **zero production callers** repo-wide —
  grep across `extensions/` returns only its own definition and two comments — so
  the marketplace-names cache **file is never written in production**, and the two
  `invalidateMarketplaceNames` call sites (`marketplace/add.ts:579`,
  `marketplace/remove.ts:604`) unlink a file that never exists. The doc at
  `persistence/locations.ts:98-100` ("consumed by `getMarketplaceNames(scope)`")
  describes a consumer that only tests have. **Fix:** delete the member from the
  `LocationsResolver` contract here, then treat the rest of the tier as one
  removal ticket spanning `shared/completion-cache.ts`,
  `orchestrators/edge-deps.ts`, `persistence/locations.ts` and the two
  invalidation call sites — or, if the cache tier is meant to come back, record
  why it is dormant.

- **[WARNING] `marketplaceNamesForScope` is a one-line alias, and the section
  header above it is stale** — `lines 320-325` forward verbatim to
  `rebuildNamesForScope` (`lines 256-263`) with the same signature; and the
  section banner at `lines 251-254` ("Rebuild closures (private). Wrap manifest
  failures in ManifestSoftFailError for TC-8") no longer describes the names
  closure, which is not a cache-rebuild callback any more (see the finding above)
  and wraps nothing. **Fix:** delete `marketplaceNamesForScope`, call
  `rebuildNamesForScope` at its four call sites (`331`, `336`, `418`, `465`), and
  either rename it to `marketplaceNamesForScope` outright or restrict the banner's
  "rebuild closure" wording to `rebuildPluginIndex`, which is still one.

- **[WARNING] Dead parameter** — `line 386`,
  `getInstalledPluginToMarketplacesMap(_mode: Exclude<PluginRefCompletionMode,
  "install" | "info">, …)`. The parameter is never read; the `^_` ESLint escape
  hides it. It is also imprecise (`"fetch"` is routed away by the caller but is
  not excluded by the type). **Fix:** drop the parameter and the argument at
  `line 509`.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `data.ts` | `buildItem` | `data.test.ts:219` (4 rows) | owned |
| `data.ts` | `splitCompletionInput` | `data.test.ts:238` (6 rows) | owned |
| `data.ts` | `extractPositionals` | `data.test.ts:249-317` (8 cases) | owned |
| `data.ts` | `extractScope` | `data.test.ts:325-357` (6 cases) | owned |
| `data.ts` | `getMarketplaceCompletions` | `data.test.ts:361-401` (3 cases) | owned, filter not discriminated |
| `data.ts` | `getMarketplaceNamesAcrossScopes` | `data.test.ts:405-463` (5 cases) | owned |
| `data.ts` | `getPluginToMarketplacesMap` | `data.test.ts:467-769` (23 cases) | owned, scope-key not discriminated |
| `data.ts` | `getPluginRefCompletions` | `data.test.ts:786-956` (11 cases) | owned, filter not discriminated |
| `data.ts` | `type PluginRefCompletionMode` | `data.test.ts:74`, `194` | owned (type-level, correct) |
| `data.ts` | `interface LocationsResolver` | `data.test.ts:173` `satisfies` | owned (type-level, correct) |
| `data.ts` | `interface MarketplaceStateRecord` | `data.test.ts:81`, `153` | owned (type-level, correct) |
| `data.ts` | `interface PluginMapOptions` | `data.test.ts:486`, `525` `satisfies` | owned (type-level, correct) |
| `data.ts` | `LocationsResolver.marketplaceNamesCachePath` (member) | — | **NO CONSUMER** (production-dead; see finding) |
| `normalize.ts` | `normalizeCompletionWhitespace` | `normalize.test.ts:22-130` (11 cases) | owned |
| `normalize.ts` | `isClaudePluginCommandLine` | `normalize.test.ts:190` (11 rows) | owned |
| `provider.ts` | `getArgumentCompletions` | `provider.test.ts` (58 cases) | owned |

No export is unowned, and no coverage here is incidental — every runtime export is
asserted by a case whose title names its behaviour. Three of the four type-only
exports are checked with `satisfies` against a real double, which is the sanctioned
pattern for type-only surface.

## Branch census

**`data.ts` — no reachable-untested branch.**

- `splitCompletionInput:188` `allTokens.at(-1) ?? ""` — *compiler-forced*
  (D-116-01a). Unreachable: the function has already returned for `""` and for any
  input ending in whitespace, so the filtered list is non-empty. Removing it needs
  `!` or `as`, both barred in `extensions/`. Correctly documented at
  `data.test.ts:29-45`, and the header's "66 cases" is accurate — I counted 66.
- `extractPositionals:210,215` `t !== undefined` — *compiler-forced* by
  `noUncheckedIndexedAccess`; unreachable from the in-repo caller (a dense array
  from `splitCompletionInput`) but reachable through the export, which the case at
  `data.test.ts:307` exercises by planting a sparse array. Legitimate, and a
  strictly better technique than the global-prototype surgery META-FINDINGS
  escalates (see meta section).
- `getPluginHalfCompletions:530` `mps[0] !== undefined` — same category; the
  false arm is unreachable because `addMapping` only ever pushes.
- Everything else — the four mode arms of `getPluginToMarketplacesMap`, the three
  arms of `getPluginRefCompletions`, `allowMarketplaceOnly`, both `??` defaults,
  `installedNamesInTarget`'s `?? {}`, `addMapping`'s `?? []`, and
  `rebuildPluginIndex`'s catch — has both arms exercised.

**`provider.ts` — one uncovered branch, and it is removable, not forced.**

- `optionalDescription:125` empty-object arm — *reachable by no input today*, but
  see the production finding: it is an artefact of a widened return type in
  `flag-catalog.ts`, not a compiler constraint. Reclassify from "type-system-forced
  dead branch" to "removable dead code".
- `marketplaceNameWanted:165` `positionals[1] !== undefined` — *compiler-forced*
  by `noUncheckedIndexedAccess`; unreachable false arm (the array is built by
  `push`). V8 block coverage records the operand as covered, so it does not add to
  the shortfall.
- All eight `pluginRefBranchConfig` case arms, its `default`, all five dispatch
  branches of `getArgumentCompletions`, both `headPrefix` arms, the
  `install`/`update` boolean-flag arm, and all three arms of
  `promoteExactSubcommandToken` are exercised — the last one only through
  `marketplace` (see the WARNING above).

**`normalize.ts` — no untested branch.** The out-of-range `?? ""`, both operands of
the no-op guard (`cursorCol 4` makes the first true, `cursorCol 6` makes the first
false and the second true), and 1/2/3 iterations of the run loop are all reached.

## Grading of first-pass findings

### `tests/edge/completions/data.test.ts`

- **OVERSTATED** — *Two case-sensitivity claims fused into one `test()`*. The shape
  is a negative plus a positive control, and the phases stay in AAA order. The same
  file's `test('fetch offers the warm and warmable rows and ignores the partial
  option')` (`lines 633-652`) and `normalize.test.ts:114-130` use the identical
  two-act/two-assert shape and were not flagged, so flagging this one is
  inconsistent within the reviewer's own area. Downgrade to a nit; the split is
  optional, not required.

### `extensions/pi-claude-marketplace/shared/completion-cache.ts`

- **DUPLICATE-OF** `unit-test-findings/shared-core.md` — *`resetCompletionCache()`
  is a test-only hook over module-scope global state* (BLOCKER). Real and
  correctly severe, but `shared-core.md:98-110` owns it, owns the paired test file,
  and states the same fix. One owner. (I add causal evidence for it below.)
- **DUPLICATE-OF** `unit-test-findings/shared-core.md` — *Cache-file timestamp
  bypasses the injected clock seam*. Same defect as `shared-core.md:24-29,35-44`,
  which additionally traces it to the one regex assertion it forces. Note for the
  fixer: it is **two** write sites, `completion-cache.ts:343` (poison row) and
  `:358` (success row); `shared-core.md` names only the second.
- **OVERSTATED, and the prescribed fix is a regression** — *`ManifestSoftFailError`
  does not pass `cause` through `Error`'s options bag*. Two problems. (1) The
  stated rationale is false: `this.cause = cause` creates an own `cause` property
  that `util.inspect` prints (measured — it renders as `cause:` rather than
  `[cause]:`; the only real difference is enumerability). (2) The prescribed fix —
  "change the `super()` call … the `override readonly cause` field declaration can
  stay" — **silently drops the cause.** Measured under Node's own type stripping:
  `override readonly cause: unknown;` strips to a class field `cause;`, which
  ES2022 semantics initialise to `undefined` *after* `super()` returns, so
  `super(message, { cause })` plus that declaration yields `error.cause ===
  undefined`. `declare override` is rejected by Node's stripper
  (`ERR_INVALID_TYPESCRIPT_SYNTAX`: "'override' modifier cannot be used with
  'declare'"), and `declare readonly` without `override` fails
  `noImplicitOverride: true`. The only safe form is to **delete the field
  declaration entirely** and rely on the inherited `Error.cause`. Correct severity:
  style nit; do not apply the fix as written. The identical class shape exists at
  `orchestrators/reconcile/apply-outcomes.ts:405-410`.

### `extensions/pi-claude-marketplace/edge/completions/data.ts`

- **CONFIRMED** — *Three exports documented only implicitly*. The style skill's
  line 127 ("Every top-level export is documented") governs, and `extractScope`
  (`line 225`) carries no comment at all while having the least obvious behaviour
  in the file (it keeps scanning past an unrecognised value — a contract the case
  at `data.test.ts:348` pins but the source never states). Severity WARNING is
  right.

### `extensions/pi-claude-marketplace/edge/completions/normalize.ts`

- **OVERSTATED** — *Both exports rely solely on the file-header comment*. The
  header at `lines 1-22` documents both exports by name, in detail, including the
  collision-suffix rationale; `CONVENTIONS.md` explicitly sanctions file-level
  block comments carrying that rationale. Moving the text is churn. Downgrade to a
  nit — and if it is done, the header's "collapse … to a single space" wording must
  be corrected first (see my WARNING above), because it is currently wrong.
- **OVERSTATED** — *The cursor-position shape is hand-duplicated between parameter
  and return type*. The two shapes are not the same type: the parameter is
  `readonly` on all three members and on the array, the return is mutable — that
  asymmetry is the module's aliasing contract, which `normalize.test.ts:114-130`
  deliberately proves. Extracting "one interface" would need two, or a
  `Readonly<>` wrapper. The style skill has no rule requiring this. Style
  preference, not a defect.

### `extensions/pi-claude-marketplace/edge/completions/provider.ts`

- **CONFIRMED** — *`PluginRefMode` duplicates `data.ts`'s
  `PluginRefCompletionMode`*. `provider.ts:170-171` really is an independently
  maintained twin, and the switch it feeds is over an open `string` with a
  `default`, so nothing forces the two to stay in step. WARNING is the right
  severity; sequence it with my `MARKETPLACE_VERBS_WITH_NAME_ARG` blocker — both
  are "a verb set duplicated without a gate".
- **CONFIRMED** — *`getArgumentCompletions` has no JSDoc of its own*. `line 260`,
  the module's sole export. Style skill line 127. WARNING.

### Summary claims

- **REFUTED (half)** — *"The two branch-coverage shortfalls the test headers
  document (`data.ts:188`, `provider.ts:125`) are rigorously proven type-system-
  forced dead branches … and are not findings."* True for `data.ts:188`. False for
  `provider.ts:125`: it is unreachable but **not** forced — it exists because
  `flag-catalog.ts:174` widens a return type its own doc comment says is never
  wide. The reviewer accepted `provider.test.ts:56-71`'s claim that "the guard must
  exist" without checking the type it points at. See the production finding.

## Still clean after attack

These mutations were tried and the existing cases genuinely catch them. The fixing
pass should not spend time here.

- `tests/edge/completions/data.test.ts`
  - **Error mutations:** throwing a different class with the same message, or
    swallowing the error and returning `[]`, both fail — `lines 455-461` and
    `762-768` assert `assert.strictEqual(error, stateFailure)`, error *identity*,
    the strongest available form. Wrapping a state error in `ManifestSoftFailError`
    (i.e. confusing TC-8 with TC-9) also fails.
  - **Status-set mutations:** adding or removing any of the nine derived statuses
    from any of the five `ReadonlySet`s in `data.ts:51-110` fails, because
    `everyStatusManifest()` seeds all nine and eleven cases compare the whole
    resulting map against a hand-written literal.
  - **Ordering mutations:** reversing the `SCOPES` sweep, the `["project","user"]`
    sweep, or the install project-then-user precedence all fail (`lines 418`,
    `608-611`, `544-547`).
  - **Dedup mutations:** dropping the `existing.includes(marketplace)` guard in
    `addMapping`, or the `new Set(...)` in `getMarketplaceOnlyCompletions`, both
    fail (`lines 735`, `897-900`).
  - **Value mutations:** inverting `appendSpace`, swapping `label`/`value`, or
    emitting `name@mp` where `name@` is promised all fail — every expectation is a
    whole `AutocompleteItem` literal.
  - **Hermeticity:** per-case `mkdtemp`, `rm` in `t.after()`, a context-owned
    `https.request` trap, and `resetCompletionCache()` before *and* after each
    case. No shared directory, no fixed path, no `process.env`, no faked `Date`.
- `tests/edge/completions/provider.test.ts`
  - Reordering `TOP_LEVEL_SUBCOMMANDS` or `MARKETPLACE_SUBCOMMANDS`, returning `[]`
    where `null` is the Pi-tui contract, swapping `argumentTextPrefix` for
    `headPrefix` in any emitted value, rerouting any of the eight heads to a
    different completion mode, flipping any head's `allowMarketplaceOnly`, dropping
    the prepended global `--scope` entry or moving it after the catalog flags, and
    changing the install default target scope — all fail. The three-way drive of
    every head (plain cursor, `@` cursor, `--scope` cursor) is the reason, and it
    is the strongest structural idea in the area.
- `tests/edge/completions/normalize.test.ts`
  - Returning the caller's array instead of a copy fails (`lines 114-130`, an
    explicit aliasing proof most files in this sweep lack). Adding the `i` flag,
    dropping `^`, dropping the `(?:\s|$)` tail, or narrowing `\d+` to `\d` all
    fail. Rewriting a non-cursor line fails (`line 91`). Off-by-one on the
    space-run counter fails.

## Not covered

- No command was run against the repo: no `node --test`, no
  `npm run test:coverage:direct`, no lint. Both test headers claim complete function
  and line coverage with exactly one uncovered branch; I checked those claims by
  reading V8 block-coverage semantics against the source and they are internally
  consistent, but **they are not measured here**, and my `provider.ts:125` finding
  changes the expected branch identity once fixed.
- `tests/shared/completion-cache.test.ts` was inspected by structure (every
  `describe`/`test` title and every `const scope`/`const marketplace` binding), not
  read line by line — enough to establish that no case pairs two scopes under one
  marketplace name, which is what my second BLOCKER needed. Its own findings belong
  to `shared-core.md`.
- `orchestrators/edge-deps.ts` was read only around `makeLocationsResolver`
  (lines 40-200) to settle the dead-member question.
- `tests/integration/`, `tests/e2e/` and `tests/live-uat/` are out of the sweep, so
  "no other caller exists" statements above are scoped to the unit suite plus
  `extensions/`.

## Meta-findings impact

### New cross-cutting evidence

1. **The `{ cause }` options-bag fix is a silent regression wherever the class also
   declares `override readonly cause`.** Measured under Node's own type stripping
   (v26.8.1, same semantics as the CI Node 24): the stripped class field
   re-initialises `cause` to `undefined` after `super()` returns, so
   `super(message, { cause })` plus a kept field declaration loses the cause
   entirely; `declare override` is a Node syntax error, and dropping `override`
   fails `noImplicitOverride: true`. Two production classes carry that exact shape:
   `shared/completion-cache.ts:154-161` and
   `orchestrators/reconcile/apply-outcomes.ts:405-410`. **Any area file
   recommending the options-bag form must be read as "delete the field declaration
   first".** Only `edge-completions.md:55` prescribes it today, but
   `orchestrators-reconcile-apply.md:197` discusses `{ cause }` threading and owns
   the second class — check it, and check every other `extends Error` that
   redeclares a base member.
2. **Prefix filters that no case can distinguish from substring filters.** Seven of
   the eight `startsWith` filter sites in this area survive the mutation; only one
   is caught. The general rule is cheap and mechanical: *a case pinning a filtered
   list must seed a decoy the wrong predicate would admit.* Worth checking wherever
   a list is narrowed by user input — `orchestrators/plugin/list.ts`'s filters,
   `domain/manifest-lookup.ts`, and any `notify` row filter.
3. **`fallow dead-code` cannot see production code kept alive only by test
   imports.** With `production: false` (deliberate, FLOW-06 — not proposing a
   change), a test-only import counts as a use. Evidence: the entire
   marketplace-names cache tier — `getMarketplaceNames`
   (`shared/completion-cache.ts:250`), the `marketplaceNamesCachePath` member of
   `LocationsResolver` and of `LocationsResolverLike`, its implementation at
   `orchestrators/edge-deps.ts:149` with its own paired cases, and the file the two
   `invalidateMarketplaceNames` call sites unlink — has **zero production
   callers**, and the gate is green. A read-only `fallow dead-code --production`
   *probe* would enumerate this class repo-wide. This belongs in "Gates that do not
   gate" as a sixth item: it is a gate that is green because the tests hold the
   corpse up.
4. **A "type-system-forced, unavoidable" coverage shortfall that is actually
   removable.** `provider.test.ts:56-71` argues at length that the uncovered branch
   must exist; the argument proves *unreachability* and then assumes
   *irreducibility*. The branch exists only because a collaborator widens its own
   declared return type. Every other D-116-01a-style header in the repo deserves
   the same second question — "is the type that forces this guard *itself*
   necessary?" — before the shortfall is accepted.
5. **A third option for the "unreachable branches and prototype surgery"
   decision (META-FINDINGS "Decisions" item 1).** `data.test.ts:307` reaches a
   `noUncheckedIndexedAccess`-forced `t !== undefined` guard by planting a **sparse
   array through the public parameter** — no global prototype is touched, the
   production code is unchanged, and the input is legal for the declared
   `readonly string[]`. Where the four flagged files patch `String.prototype`,
   `RegExp.prototype`, `Symbol.hasInstance` or `Object.prototype`, check first
   whether a legal-but-degenerate argument reaches the same guard. This does not
   settle the operator decision, but it narrows what the decision is about.
6. **A well-calibrated hermeticity device worth propagating.**
   `data.test.ts:91-117` and `provider.test.ts:141-165` install a fail-fast
   `https.request` replacement and then state plainly that it is *not* an offline
   proof (the import closure holds no HTTP client), that no case asserts a count
   against it, and *why* `https.request` and not `globalThis.fetch` is the watched
   door — with the measurement that settled it. That is the correct shape for every
   "we do not touch the network" claim in the suite, and it is the opposite of the
   vacuous-green pattern the sweep found elsewhere.

### Corrections to META-FINDINGS.md

- **"Patterns to propagate" table** should gain two rows from this area: *"Legal
  degenerate input to reach a `noUncheckedIndexedAccess` guard"* →
  `tests/edge/completions/data.test.ts:307`; and *"Network trap declared as a
  hermeticity device, not an offline proof, with the watched door chosen by
  measurement"* → `tests/edge/completions/{data,provider}.test.ts` headers.
- **"Ranked by leverage" item 2** ("Replace test-only hooks over module-global
  state") is currently justified on hygiene grounds. This area supplies a
  correctness consequence that strengthens it — see Confirmations.
- **Provenance's "clean verdicts are not reliable"** is confirmed at full strength
  here, in the area the summary index labels "0 test blockers": three declared-clean
  files yielded three BLOCKERs. The area's *authoring* quality was accurately
  assessed; its *discriminating power* was never tested.

### Confirmations

- **Item 2, `shared/completion-cache.ts`'s test-only reset hook** — independently
  confirmed by grep (zero production callers) and by reading the two consumer test
  files. **New evidence that raises its priority:** the module-global maps do not
  merely force reset calls, they make a whole class of case *unwritable*. Because
  `memPluginIndex` is keyed `${scope}::${marketplace}` in process-global state,
  every case in `tests/shared/completion-cache.test.ts` has to pick a unique
  marketplace name to isolate itself — which is exactly why no case there, or
  anywhere else, ever exercises two same-named marketplaces in different scopes,
  and why the `scope` half of the cache key is unproven repo-wide (my second
  BLOCKER). With factory-owned state a single case could construct one cache, drive
  `(user,"official")` and `(project,"official")`, and prove they do not collide.
  The refactor buys a missing test, not just cleaner setup.
- **"The dominant shape: sibling drift"** — confirmed again, inside a single
  directory: `provider.test.ts` discriminates the prefix filter for the top-level
  vocabulary and `data.test.ts` discriminates it nowhere, for the same predicate in
  the same layer. Naming the sibling makes the fix propagation, exactly as the
  meta-file predicts.
- **§5 "silent-omission class"** — confirmed with a new instance:
  `MARKETPLACE_VERBS_WITH_NAME_ARG` (`provider.ts:62-69`), a six-member closed set
  with one member exercised and both of its documented exclusions unproven.
