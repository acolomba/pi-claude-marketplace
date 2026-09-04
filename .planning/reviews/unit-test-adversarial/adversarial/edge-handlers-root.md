# Edge — handler shared helpers and MCP tools — adversarial re-review

**Scope:** `tests/edge/handlers/shared.test.ts`, `tests/edge/handlers/tools.test.ts`,
`tests/edge/handlers/marketplace-seed.ts`, and the two paired production modules
`extensions/pi-claude-marketplace/edge/handlers/{shared,tools}.ts`. Also read as
supporting evidence: `tests/edge/notification-boundary.ts`,
`extensions/pi-claude-marketplace/edge/flag-catalog.ts`,
`extensions/pi-claude-marketplace/persistence/state-io.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` (`shouldShow` /
`filtersPassive`), `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`
(`loadVisibleMarketplaces`), `extensions/pi-claude-marketplace/domain/source.ts`
(`sourceLogical`).
**First-pass file:** `unit-test-findings/edge-handlers-root.md`
**Clean files attacked:** 3 (`tests/edge/handlers/shared.test.ts` — the only entry on the
test `### Clean files` list; plus the two production modules, which the first pass
declared "otherwise sound" under its production `### Clean files` note, and which I
treated as clean claims to falsify)
**Existing findings graded:** 10

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 2 |
| New WARNING (missed by first pass) | 9 |
| Existing CONFIRMED | 7 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 2 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

## New findings — from the clean lists

### `tests/edge/handlers/tools.test.ts`

- **[BLOCKER] `ToolFilterBuckets.narrowed` — the only reason that interface exists — is
  never discriminated; never forwarding a filter to the orchestrator passes all 53
  cases** — `filterCases` (lines 820–861) and every case that supplies a bucket filter
  (lines 997, 1189).
  Mutate `applyFilter` (`tools.ts:278–283`) to return `narrowed: false` on the narrowed
  branch — equivalently, delete the `...(buckets.narrowed && { ... })` spread at
  `tools.ts:344–348` so the tool never forwards `installed`/`available`/`remote`/
  `unavailable`/`partial` to `loadPluginListPayload` and relies on its own tool-side
  `buckets[statusKey(status)]` filter alone. **Every case still passes.** I walked all
  seven filter-bearing cases: for `mixed-mp` the orchestrator-filtered and
  tool-filtered row sets are identical in both content and order, and the
  `filtered-empty` case (line 1189) produces "header alone" either way. The production
  doc comments at `tools.ts:249–258` and `tools.ts:336–348` assert this flag "is not a
  convenience" — nothing proves it.
  The discriminating input is a marketplace whose only plugin is a **disabled**
  installed record, executed with `{ unavailable: true }`. Traced through
  `orchestrators/plugin/list.ts:218–268`: a `disabled` row carries bucket
  `installed-inventory` and status `disabled`, so with `unavailable: true, partial: true`
  forwarded it matches no `shouldShow` arm and the orchestrator empties
  `mp.plugins` → the tool takes the `mp.plugins.length === 0` branch and renders
  `Marketplace <mp> (project)\n  (no plugins)` with `details.plugins: []`. Without the
  forwarding it renders `  [unavailable] alpha  1.0.0` instead. **Add that case**
  (clone the `filtered-empty` fixture at lines 1200–1212, change the params to
  `{ unavailable: true }`, expect the `(no plugins)` body). It is the exact mirror of
  the existing WR-05 case and closes the last untested half of the two-layer filter
  contract.

- **[BLOCKER] `registerListMarketplacesTool` never renders a non-`path` marketplace
  source, so `sourceLogical(source)` is indistinguishable from `source.raw`** —
  `tools.ts:108` and `tools.ts:112`; the only rendering case is
  `test("renders one line per marketplace with its scope, plugin count and source")`
  (lines 500–551).
  `layoutMarketplace` (line 284) hard-codes `source: { kind: "path", raw: marketplaceRoot }`
  for every seeded marketplace in the file, and for a `path` source
  `sourceLogical` returns `source.logical`, which the ST-6 load funnel
  (`state-io.ts:346`, `pathSource(obj.raw)`) sets equal to `raw` for an absolute path —
  the expected literal at line 532 states `{ kind: "path", raw: projectRoot, logical: projectRoot }`,
  the two fields equal. Mutating `tools.ts:108` to `const logical = source.raw;` leaves
  every case green, yet for a `github` marketplace the rendered line would read
  `owner/repo` instead of `https://github.com/owner/repo` (`domain/source.ts:622–625`).
  D-02 names the line's last field `<source.logical>`; nothing pins it.
  Fix: give `SeededMarketplace` an optional `source` member, thread it into
  `layoutMarketplace`'s returned record (`state-io.ts:347` normalizes
  `{ kind: "github", raw: "owner/repo" }` through `githubSource` at load, so the fixture
  survives the funnel), and add one `registerListMarketplacesTool` case asserting the
  line `[project] gh-mp -- 0 plugin(s) -- https://github.com/owner/repo` together with
  the full normalized `source` object in `details.marketplaces`.

- **[WARNING] An explicitly-`false` filter flag is never exercised, so
  `applyFilter`'s `=== true` comparisons are undiscriminated** — `filterCases`
  (lines 820–861); no case anywhere passes `installed: false` / `available: false` /
  `unavailable: false`.
  The tool's TypeBox schema (`tools.ts:59–71`) declares all three as optional
  *booleans*, so an agent can legitimately send `{ installed: false }`. Mutating
  `tools.ts:272–273` from `params.installed === true` to `params.installed !== undefined`
  makes `{ installed: false }` narrow to `i:false, a:false, u:false`, which renders every
  marketplace header with no rows at all — and no case catches it. Add one `filterCases`
  row `{ title: "…", params: { installed: false, available: false, unavailable: false },
  lines: [all five], rows: [all five] }` asserting the same output as the no-filter row.

- **[WARNING] `pluginScopeOrFallback`'s non-scope-bearing fallback is only ever
  exercised in `project` scope** — `tools.ts:371`; the fallback arm is reached by every
  `available` / `unavailable` row, and every such fixture in the file seeds
  `seedScope(scope.cwd, "project", …)`.
  Mutating the false arm to a literal `"project"` (`return isScopeBearingListRow(p) ? (p.scope ?? marketplaceScope) : "project"`)
  survives every case: the only `user`-scope rows in the suite are *installed* rows
  (line 1329 `scope-narrowing`, line 1441 `orphan-fold`), which take the scope-bearing
  arm. Add a case seeding a `user`-scope marketplace whose plugin is manifest-declared
  but not installed, and assert `scope: "user"` on the `details.plugins` row.

- **[WARNING] `installedRecord` duplicates `buildInstalledPluginRecord` from the
  sibling seed module** — `tools.test.ts:218–234` vs
  `tests/edge/handlers/marketplace-seed.ts:50–72`. Same record shape, same five fields,
  same `compatibility.installable = unsupported.length === 0` rule; they differ only in
  the frozen timestamp (`2026-06-17…` vs `2026-01-01…`) and in that the `tools.test.ts`
  copy is correctly typed `PluginRecord` while the seed copy returns
  `Record<string, unknown>` and needs the double cast the first pass flagged. This is
  the *same* defect from the other end and makes the seed fix propagation rather than
  invention: move `installedRecord`'s typed body into the seed module as
  `buildInstalledPluginRecord`, take `installedAt`/`updatedAt` as parameters (or one
  shared constant), delete `tools.test.ts:218–234`, and the `as unknown as` at
  `marketplace-seed.ts:95` disappears with it.

- **[WARNING] `createToolBoundary` re-implements the `ctx`/`cwd` half of the shared
  `createNotificationBoundary`** — `tools.test.ts:326–353` vs
  `tests/edge/notification-boundary.ts:90–120`. Both declare
  `mock<Extension…Context>({ exactParams: true, name: "extension context" })` and the
  identical `cwd?: { readonly value: string; readonly reads: number }` stanza with
  `.thenReturn(cwd.value).times(cwd.reads)`. `tests/edge/notification-boundary.ts:1–9`
  records that four suites already drifted this way once (WR-08) and were consolidated.
  Rebuild `createToolBoundary` on top of `createNotificationBoundary(0, 0, cwd)`,
  adding only the `ToolRegistrar` narrowing and the `registrations` recorder that the
  notification boundary genuinely does not provide.

### `tests/edge/handlers/shared.test.ts` *(the first pass's only clean file)*

- **[WARNING] The empty default for `passThroughLongFlags` is never proven** —
  `shared.ts:46` (`passThroughLongFlags: readonly string[] = []`); no case in
  `shared.test.ts` calls the three-argument form with a flag that some *other* verb
  allows.
  Mutating the default to `["--map-model"]` survives all 14 cases. The only rejection
  case that omits the fourth argument (line 188) uses `--bogus`, which appears in no
  verb's catalog, so it cannot distinguish an empty default from a populated one. This
  matters because four production call sites rely on the default or on `[]`
  (`plugin/enable-disable.ts:38`, `plugin/uninstall.ts:22`, `marketplace/shared.ts:108`,
  `marketplace/autoupdate.ts:32`, `plugin/reinstall.ts:35`), and a non-empty default
  reintroduces exactly the WR-02 failure class the module's own header describes: the
  flag survives into `residualArgs` and the downstream ref parser reports a misleading
  `Invalid <plugin>@<marketplace> ref` instead of `Unknown flag`.
  Add one case: `extractLocalFlag("alpha@official --map-model", ctx, ENABLE_USAGE)` with
  `createNotificationBoundary(1, 0)`, asserting `scanned === undefined` and the single
  notification `{ message: 'Unknown flag: "--map-model".\n\nUsage: …enable…', severity: "error" }`.

- **[WARNING] Test input computed by production code** — `line 149` and `line 171`
  (`const passThroughFlags = passThroughFlagNames("install")`).
  The skill's test-data rule is explicit: "No test data computed with production code."
  `passThroughFlagNames` (`edge/flag-catalog.ts:193`) is production, and it supplies the
  argument whose handling both cases are about, so the case's meaning is contingent on
  catalog content that the file's own header (lines 27–28) says it deliberately does not
  re-pin. Replace both with the literal `["--map-model", "--partial"]` and drop the
  `passThroughFlagNames` import; `tests/edge/flag-catalog.test.ts` keeps owning the
  catalog's contents.

### `extensions/pi-claude-marketplace/edge/handlers/tools.ts` *(declared "otherwise sound")*

- **[WARNING] `projectRowStatus` is exported and typed wider than its single production
  call site, and the widening is what manufactures nine unreachable throw arms** —
  `line 175` (signature), `lines 208–220` (the arms), `line 478` (the only production
  caller).
  Grep-verified: no module other than `tools.ts` itself imports `projectRowStatus` or
  `ToolPluginStatus` — the sole external consumer of both is `tools.test.ts`. That is the
  "export added for a test" shape the unit-testing skill names under *Production design
  for tests*. Worse, the parameter is `PluginNotificationMessage["status"]` (19 members)
  while the only call site passes `p.status` where `p: ToolPluginRow`, whose status union
  is the 10 members `pluginVersion` (line 443) enumerates. The nine non-list statuses
  (`updated`, `reinstalled`, `uninstalled`, `skipped`, `manual recovery`, and the four
  `will *` rows) are **type-unreachable at the call site** and only compile as arms
  because the signature was widened — and the widening is what lets
  `tools.test.ts:421–437` call them directly.
  Fix: narrow the parameter to `ToolPluginRow["status"]` (the alias already exists at
  `line 423`; type hoisting makes the forward reference legal), delete the nine arms,
  keep the `failed` arm — it *is* in the derived union and its throw is the real guard —
  and stop exporting the function. The nine `refusedStatuses` rows at
  `tools.test.ts:387–398` then become a compile error rather than nine runtime cases,
  and the remaining `failed` refusal keeps its case. All nine *projected* statuses are
  already driven end-to-end through `execute` by `versionCases` (lines 563–733), so the
  direct-call `describe` block loses nothing real.

- **[WARNING] `renderPluginRow`'s `row.reasons.length > 0` guard cannot be false** —
  `line 242`. `PluginRow.reasons` has exactly one writer, `line 491`
  (`...(reasons !== undefined && { reasons })`), fed by `pluginReasons` (line 394),
  which returns `undefined` rather than an empty array on both arm groups. So when
  `row.reasons` is defined it is non-empty by construction. Simplify to
  `if (row.reasons !== undefined)`. Classified below as unreachable-by-real-input, not
  compiler-forced — no assertion is needed to remove it.

- **[WARNING] No injection seam for the two orchestrator loaders** — `line 39`
  (`loadVisibleMarketplaces`), `line 40` (`loadPluginListPayload`), consumed at
  `lines 89, 302, 330`.
  Both are direct static imports, so all 28 payload-bearing cases in `tools.test.ts`
  must seed a real filesystem tree and run `orchestrators/plugin/list.ts`
  end-to-end — which is why the two error paths the first pass flagged are awkward to
  reach and why the `narrowed` contract above went unproven. This is META-FINDINGS
  item 4's class; `tools.ts` is not among the 15 modules that item counts.
  `orchestrators/plugin/bootstrap.ts` and `edge/handlers/marketplace/shared.ts` are the
  in-repo templates. Adding a `deps?: { loadVisibleMarketplaces, loadPluginListPayload }`
  parameter to both `register*Tool` functions makes the corrupt-`state.json` cases a
  two-line stub throw instead of a filesystem fixture.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `edge/handlers/shared.ts` | `extractLocalFlag` | `shared.test.ts:44` +13 siblings | owned |
| `edge/handlers/tools.ts` | `registerListMarketplacesTool` | `tools.test.ts:441, 476, 500` | owned |
| `edge/handlers/tools.ts` | `registerListPluginsTool` | `tools.test.ts:891` +30 | owned |
| `edge/handlers/tools.ts` | `projectRowStatus` | `tools.test.ts:409, 422` | owned, **but the export exists only for these cases** — no production module outside `tools.ts` imports it (grep-verified) |
| `edge/handlers/tools.ts` | `ToolPluginStatus` (type) | `tools.test.ts:137, 385` | same — type-only, no external production consumer |
| `tests/edge/handlers/marketplace-seed.ts` | `SeededResources` | 15 importers | owned (test support, no meta-test required) |
| `tests/edge/handlers/marketplace-seed.ts` | `SeededRecordInput` | 15 importers | owned |
| `tests/edge/handlers/marketplace-seed.ts` | `buildInstalledPluginRecord` | 15 importers | owned; **duplicated** by `tools.test.ts:218` |
| `tests/edge/handlers/marketplace-seed.ts` | `mergeMarketplaceIntoState` | 15 importers | owned |
| `tests/edge/handlers/marketplace-seed.ts` | `seedAutoupdateConfig` | marketplace suites | owned |
| `tests/edge/handlers/marketplace-seed.ts` | `materializeMarketplaceTree` | plugin/orchestrator suites | owned |

No export in the area is unowned. The two findings the census produces are the
*test-only* export pair (`projectRowStatus` / `ToolPluginStatus`) and the duplicated
record builder.

## Branch census

`edge/handlers/shared.ts` — every branch has a case except one:

- `tok === undefined` guard, `lines 53–55` — **(c) compiler-forced.** The loop indexes a
  dense array in range; the guard exists only because `noUncheckedIndexedAccess`
  (`tsconfig.json:12`) types the read as possibly undefined, and `!`/`as` are barred in
  `extensions/`. `shared.test.ts:18–23` already records this as D-116-01a. Correct as
  recorded; do not add a test and do not add a coverage exception.
- Optional-parameter default `passThroughLongFlags = []`, `line 46` — **(a) reachable
  and untested** as a *value*: the branch executes, but no case discriminates an empty
  default from a populated one. New WARNING above.

`edge/handlers/tools.ts`:

- `registerListMarketplacesTool`'s `loadVisibleMarketplaces` rejection, `line 89` —
  **(a) reachable and untested.** `loadState` carries eight distinct throws
  (`state-io.ts:332, 342, 356, 361, 390, 397, 412, 465`), every one reachable from a
  hand-edited `state.json` or an I/O failure; the plugin tool's one case uses 412. No
  guard, no case here. (First pass's BLOCKER; confirmed.)
- `registerListPluginsTool`'s `marketplaceExists` rejection, `line 521` — **(a)
  reachable and untested**; it runs *before* the `try` at line 540. (First pass's
  BLOCKER; confirmed.)
- `applyFilter` narrowed-vs-passive forwarding, `lines 344–348` — **(a) reachable and
  untested as a discriminated contract.** New BLOCKER above.
- `applyFilter`'s `=== true` comparisons against an explicit `false`, `lines 272–273` —
  **(a) reachable and untested.** New WARNING above.
- `pluginScopeOrFallback` false arm under `user` scope, `line 371` — **(a) reachable and
  untested.** New WARNING above.
- `sourceLogical` for a non-`path` marketplace source, `line 108` — **(a) reachable and
  untested.** New BLOCKER above.
- `renderPluginRow`'s `row.reasons.length > 0`, `line 242` — **(b) unreachable by real
  input**, and removable without any assertion, because the field's only producer never
  emits `[]`. Production simplification, not a missing test.
- `projectRowStatus`'s nine non-list arms, `lines 208–217` — **(b) unreachable by real
  input**, made reachable *only* by the widened exported signature. Deleting them
  requires narrowing the parameter, not an assertion. New WARNING above.
- `projectRowStatus`'s `failed` arm, `line 211` — **(c) compiler-forced.** `failed` *is*
  a member of `ToolPluginRow["status"]` (see `pluginVersion`, `line 449`), so the switch
  cannot be total without it; `noImplicitReturns` is what makes the arm mandatory. Keep
  it and keep its one test case.
- `pluginReasons`'s optional-group `p.reasons.length > 0` half, `line 403` — **not
  determined.** Reachability depends on whether `orchestrators/plugin/list.ts`'s row
  builders can emit a present-but-empty `reasons` on an `installed`/`disabled`/
  `available`/`remote` row. The required-group counterpart (`line 412`) *is* covered —
  the `upgradable-mp` case (line 577) expects a row with no `reasons`, which can only
  come from `p.reasons.length === 0`. Recorded under "Not covered".

## Grading of first-pass findings

### `tests/edge/handlers/tools.test.ts`

- **CONFIRMED** — *No case exercises a corrupt/unreadable `state.json` for
  `registerListMarketplacesTool`, nor for `registerListPluginsTool` with a `marketplace`
  filter* — verified: the single corrupt-state fixture is at line 1483, inside the
  plugin-tool `describe`, executed with `{}` params, so both named paths are untouched;
  `tools.ts:89` has no enclosing `try` and `tools.ts:521` runs before the one at line 540.
- **OVERSTATED** — *`ctx.cwd` exact read-count turns a stub into a mock* — should be an
  informational note, not a WARNING. The count is a documented contract, not incidental
  brittleness: `tests/edge/notification-boundary.ts:14–16` records D-116-06 as wanting
  the *absence* of a `cwd` read provable, and the counts genuinely vary and genuinely
  discriminate — `reads: 2` at line 1295 proves `marketplaceExists` ran and the payload
  load followed, while `reads: 1` at line 1387 proves the not-found branch
  short-circuited. Uniformly stating the count on the 26 cases where it is always 1 is
  over-specification, but the mechanism is correct and load-bearing.

### `tests/edge/handlers/marketplace-seed.ts`

- **OVERSTATED** — *`mergeMarketplaceIntoState` erases structural type-checking via a
  double-cast* — real, but WARNING, not BLOCKER. The stated consequence does not hold:
  `saveState` runtime-validates against `STATE_VALIDATOR` and throws
  `saveState refused: in-memory state failed schema validation: …` **before writing**
  (`persistence/state-io.ts:486–491`), and `compatibility` is a required member of
  `PLUGIN_INSTALL_RECORD_SCHEMA` (`state-io.ts:81`, field at `state-io.ts:110`), which
  `MARKETPLACE_RECORD_SCHEMA` (`state-io.ts:262`) requires per plugin. The first pass's
  own example — "a renamed `compatibility`
  key" — therefore fails loudly at the seed's own call site in all 15 consumers, not
  silently. What remains is a genuine uncommented double assertion (Google style) and
  lost compile-time checking. The proposed fix is correct and is strengthened by the
  duplication finding above: `tools.test.ts:218` already holds the typed version.
- **CONFIRMED** — *Cross-cutting seed misplaced and misnamed* — verified exactly:
  16 files reference the module, i.e. 15 importers, spanning
  `tests/edge/handlers/marketplace/` (5), `tests/edge/handlers/plugin/` (8), and
  `tests/orchestrators/plugin/{list,info}.test.ts` (2 — the cross-layer pair). The
  load-bearing half is the cross-layer import; the proposed destination
  (`tests/persistence/`) is a judgment call the operator should confirm.
- **CONFIRMED** — *`SeededRecordInput` has no top-level doc comment* — `line 32` carries
  none while every sibling export does. Trivial, mechanical.

### `extensions/pi-claude-marketplace/edge/handlers/tools.ts`

- **UNDERSTATED** — *Inconsistent, partly-absent error handling for `state.json` read
  failures* — recorded as a WARNING framed around message consistency; it should carry
  at least the same weight as its paired test finding (BLOCKER). `registerListMarketplacesTool`
  has no guard at all on a path with eight distinct reachable throws
  (`state-io.ts:332, 342, 356, 361, 390, 397, 412, 465`), most producible by a
  hand-edited but JSON-parseable `state.json` — the recovery scenario NFR-2 exists
  for — and both tools
  are registered into a live session by `edge/register.ts:141–142`. The sibling tool
  proves the graceful `isError: true` contract already exists in the module, so the fix
  is widening, not designing. (Caveat below: I could not determine whether the Pi host
  converts a rejected `execute()` into a tool-error surface. If it does, the severity
  falls back to the recorded WARNING — but that fact is exactly what no test pins.)
- **CONFIRMED** — *`ToolFilterBuckets`'s single-letter fields are opaque* —
  `lines 260–265`; the mapping to installed/available/unavailable appears nowhere in
  the interface's own doc comment. Mechanical rename, behavior-preserving.
- **CONFIRMED** — *JSDoc opens with an imperative verb* — `lines 149, 353, 376, 426`.
  This is an instance of the repo-wide JSDoc verb-phrase drift already logged once at
  the meta level; do not re-derive it per file.
- **CONFIRMED** — *Uncommented `record.source as ParsedSource`* — `line 106`. Worth
  adding: the cast is *sound*, and naming why is the whole fix. `loadState`'s ST-6
  funnel (`state-io.ts:440–447`, `normalizeStoredSource`) guarantees every stored
  `source` is either a re-validated `ParsedSource` or a forward-compat `kind: "unknown"`
  object, and `sourceLogical` has an `unknown` arm (`domain/source.ts:642`). The comment
  should name that invariant. The first pass is right that the four sibling sites make
  this cross-cutting.

### `extensions/pi-claude-marketplace/edge/handlers/shared.ts`

- **CONFIRMED** — *JSDoc opens with a noun phrase* — `line 28`. Same repo-wide class as
  above; batch it.

## Still clean after attack

- **`tests/edge/handlers/shared.test.ts`** — survives a deliberate 15-mutation sweep of
  `extractLocalFlag`, and the two findings I did record are both about *absent* inputs,
  not weak assertions. Mutations the cases DO catch: `while (i < tokens.length - 1)`
  (line 65 row 3, flag last); `args.split(" ")` instead of `/\s+/` (line 225 tab row);
  dropping the `.filter((t) => t.length > 0)` (line 226 leading-whitespace row);
  `i += 1` instead of `i += 2` on `--scope` (line 130); `startsWith("-")` instead of
  `startsWith("--")` (line 207); removing `--scope` from the residual (line 98);
  filtering only the *first* scope-target token (line 82); reordering the
  `startsWith("--")` test before either the `--scope` or the scope-target arm (lines 98
  and 65); setting `local = true` on a pass-through flag (line 146); returning the scan
  instead of `undefined` after the usage error (lines 168, 188); hard-coding either
  usage string (lines 168 and 188 use different ones, so both directions fail);
  inverting `local`; and reordering or corrupting any word of the rendered usage error
  (whole-message `deepStrictEqual` at lines 178 and 197). Every case asserts the whole
  return value with `satisfies Scan`, sizes the notification boundary at zero for the
  accepting paths — which is a real silence proof, since
  `createNotificationBoundary(0, 0)` states no `ctx.ui` expectation at all and
  `strong-mock` fails on the first unwanted access — and calls `verifyBoundary()` last.
  Zero casts in the file.
- **`tests/edge/handlers/tools.test.ts` — hermeticity and instrument validation.**
  `createHermeticScope` (lines 177–204) registers both `process.env` restores and both
  `rm` calls with `t.after()` *before* mutating, clears `PI_CODING_AGENT_DIR` because
  `getAgentDir()` reads it ahead of `homedir()`, and gives every case its own `mkdtemp`
  pair — the pattern the skill prescribes and the one `clone-cache.test.ts` was faulted
  for missing. The `installNetworkCounter` docstring's claim that a planted
  `https.request` in `loadToolPluginPayload` reddens "28 of this suite's 53 cases" is
  **arithmetically verifiable and correct**: I counted 53 cases (19 + 3 + 31) and 28 that
  reach the plugin-tool body (31 minus the registration case and the two
  marketplace-not-found short-circuits). A doc comment in this sweep that states a
  falsifiable number and survives the check is worth naming.
- **`tools.test.ts` — tool-side bucket filtering.** Deleting
  `if (!buckets[statusKey(status)]) { continue; }` (`tools.ts:479–481`) fails both the
  `skip-bucket` case (line 997) and the WR-05 `filtered-empty` case (line 1189).
  Dropping `remote: true` from the available fold or `partial: true` from the
  unavailable fold (`tools.ts:346–347`) fails the corresponding `filterCases` rows.
  Reordering `loadVisibleMarketplaces`' scope iteration fails line 519. Every case
  compares the whole `AgentToolResult` with `deepStrictEqual` against a hand-written
  literal — no fragment assertions anywhere in the file, which puts it on the right side
  of META-FINDINGS item 3.
- **`describe()` shape and double discipline** across both test files: three top-level
  `describe()`s, one per exported entrypoint, none nested, none holding mutable setup;
  `test()` not `it()`; no `only`/`skip`/`todo`; every mock created inside the case with
  `exactParams: true` and verified at the end; no `t.mock.module()`; no `any`, no
  `Partial<T>` cast, no double assertion in either file.

## Not covered

- I did not run `node --test`, `npm run test:coverage:direct`, or `npm run check` — the
  tree had to stay untouched. Every claim above is from reading source plus arithmetic;
  the surviving mutations were traced by hand through
  `orchestrators/plugin/list.ts::shouldShow` and `persistence/state-io.ts`, not executed.
- I could not determine whether the Pi host wraps a rejected `execute()` promise into a
  tool-error surface. `@earendil-works/pi-coding-agent`'s `dist/core/agent-session.js`
  passes an `isError` flag through its `afterToolCall` hook, but the tool-invocation
  site itself is not in that package's `dist/core`. This is the same gap the first pass
  recorded, and it is what makes the production severity of the unguarded
  `loadVisibleMarketplaces` call a judgment rather than a fact.
- `pluginReasons`'s optional-group `p.reasons.length > 0` half (`tools.ts:403`): I did
  not trace `orchestrators/plugin/list.ts`'s row builders far enough to say whether an
  `installed`/`disabled`/`available`/`remote` row can carry a present-but-empty
  `reasons` array. If it cannot, that half is a second unreachable sub-branch alongside
  `renderPluginRow:242`. `tests/orchestrators/plugin/list.test.ts`'s owner is better
  placed to settle it.
- `tests/edge/notification-boundary.ts` is not on this area's file list and has no
  owning findings file that I could find; I read it in full as evidence but did not
  review it as a first-class target. It appears sound (no casts, counts stated not
  derived, `verify()` on all three mocks including the un-returned `ui`), and 26 test
  files depend on it, so somebody should own it explicitly.

## Meta-findings impact

### New cross-cutting evidence

**1. The `as never` cluster is a test-side choice, not a forced consequence of the wide
parameter — and the repo already has the fix, used by 26 files.**
META-FINDINGS item 1 states: "Because no test can construct a full SDK object, every
caller fakes one and forces it past the compiler." My area falsifies the causal claim.
`extractLocalFlag` (`edge/handlers/shared.ts:44`) takes the **full**
`ExtensionCommandContext`, and `tests/edge/handlers/shared.test.ts` contains **zero**
casts — it constructs the context with `strong-mock` via
`createNotificationBoundary`. `tests/edge/handlers/tools.test.ts` does the same against
the full `ExtensionContext` and `ExtensionAPI`, also with zero casts, across 53 cases.
`grep -rln notification-boundary tests/` returns **26 consumers**. So the wide parameter
does not force a cast; `mock<ExtensionContext>({ exactParams: true })` satisfies it
directly and *additionally* gives the silence proofs (`ctx.ui` unstated ⇒ any notify
attempt fails where it happens) that a hand-forged `as never` object cannot.
Consequence for planning: narrowing the parameters is still worth doing on its own
merits, but it should not be sequenced as the *unblocker* for the 187 casts in
`tests/shared/notify.test.ts` (measured; META-FINDINGS says 178). Those can be removed
today by adopting the boundary factory's technique, independently and in parallel.
**Areas to check for the same shape:** every file META-FINDINGS lists under rows 2/2b of
`_AUDIT.md` — for each, ask whether it hand-forges a context or mocks it, because the two
groups need different fixes.

**2. `edge/handlers/tools.ts` is a 16th member of the "no injection seam" class (item 4),
and no area file counts it.** It calls `loadVisibleMarketplaces` and
`loadPluginListPayload` by direct static import, so its owner suite runs the real list
orchestrator end-to-end over a seeded filesystem in 28 of 53 cases. That is the direct
cause of this area's two untested error paths and of the unproven `narrowed` contract.
Whoever sequences item 4 should include it.

**3. A production export can survive `fallow dead-code` purely because a test consumes
it.** `projectRowStatus` and `ToolPluginStatus` (`edge/handlers/tools.ts:137, 175`) have
no production consumer outside their own module; grep-verified. They stay green because
`.fallowrc.json` sets `production: false`, which counts test imports as real consumers —
a deliberate setting the operator owns. The consequence is systemic and worth a sweep:
**"unused outside its own module except by its test" is a defect class no gate in this
repo can see.** A cheap detector exists — for every `export` under `extensions/`, check
whether any importer outside `extensions/` is the *only* importer. I would expect other
areas to have members.

**4. A widened parameter can manufacture "unreachable defensive branches" that then get
propped up by tests.** `projectRowStatus` declares 19 status arms; its only call site can
pass 10. The nine surplus arms are not defensive code and not compiler-forced — they
exist because the exported signature is wider than the call site, and nine `test()` cases
exist to exercise them. This is a **third** reading for META-FINDINGS "Decisions" item 1,
distinct from both "dead defensive code to delete" and "deliberate, and the tests are the
problem": *the branch is an artifact of an over-wide signature, and narrowing the
signature deletes branch and test together with no judgment call needed.* Worth checking
the four prototype-surgery files against this reading before treating them as a
policy decision — some may just be over-wide signatures.

### Corrections to META-FINDINGS.md

- **Item 1's causal claim.** Quoted: "Because no test can construct a full SDK object,
  every caller fakes one and forces it past the compiler." Settled by
  `tests/edge/notification-boundary.ts:96–98` plus its 26 importers, and by the zero-cast
  state of `tests/edge/handlers/{shared,tools}.test.ts`. Correction: tests *can*
  construct one, with `strong-mock`, against the un-narrowed type; the casts are a
  convention gap, not a compiler constraint. The narrowing ticket and the
  de-casting ticket are independent and can run in parallel.
- **Item 1's count.** "178 `as never` casts in `tests/shared/notify.test.ts`" —
  `grep -c "as never"` returns **187**.
- **Item 4's count.** "15 handler modules call their orchestrator by direct static
  import" — `edge/handlers/tools.ts` is a 16th and is not attributed to any area file
  (`grep -rn "handlers/tools" unit-test-findings/*.md` returns only this area's file and
  an incidental mention in `orchestrators-plugin-list-uninstall.md`).
- **"Real defects found outside the test layer", `edge/handlers/tools.ts` row.** The
  recorded phrasing — "both MCP tools handle a corrupt `state.json` inconsistently, with
  no test on the unguarded paths" — is accurate, but the *severity* in the area file is
  WARNING while the paired test finding is BLOCKER. Graded UNDERSTATED above. This is
  another instance of the calibration split the meta file already describes, and it sits
  inside a single area file rather than across two.
- **Not a correction, a qualification.** `_AUDIT.md`'s BLOCKER count includes the
  `marketplace-seed.ts` double-cast finding, which I grade OVERSTATED on evidence
  (`persistence/state-io.ts:486–491`). One BLOCKER should move to WARNING when the audit
  is refreshed.

### Confirmations

- **Item 3 (fragment assertions) — confirmed by absence.** Both test files in this area
  compare whole `AgentToolResult`/`Scan` values with `deepStrictEqual` against
  hand-written literals; there is not one `.includes()`, `.startsWith()`, or partial
  regex content check in 1,764 lines. The convention META-FINDINGS says to propagate is
  already what this corner does.
- **"Patterns to propagate" — the shared-boundary row is stronger than recorded.**
  `tests/edge/notification-boundary.ts:1–9` documents WR-08: four suites carried
  byte-identical copies of this factory and were consolidated. It now has 26 consumers.
  That is the repo's own worked precedent for the sweep's dominant "sibling drift"
  shape, and it should be named in the reference-implementation table alongside
  `tests/architecture/source-scan.ts`. My area also shows the drift is not finished:
  `tools.test.ts:326–353` still hand-rolls the same `ctx`/`cwd` stanza.
- **"Silence proofs" — confirmed from a second angle.** `createNotificationBoundary`'s
  header (lines 17–23) independently derives why `times(0)` is worthless in
  `strong-mock` (it installs the stub and serves every call) and why an unstated member
  is the real zero. `tools.test.ts` uses that to prove both tools never notify and never
  probe for a companion extension. Same technique as
  `tests/orchestrators/reconcile/notify.test.ts`, reached independently.
- **D-116-01a (compiler-forced unreachable branches) — confirmed as a real, correctly
  applied category.** `edge/handlers/shared.ts:53–55` is genuinely unreachable and
  genuinely unremovable (`!` and `as` are barred in `extensions/`), and
  `tests/edge/handlers/shared.test.ts:18–23` records it honestly without adding a
  coverage exception or a propping-up test. This is the right handling of the class, and
  it contrasts usefully with the prototype-surgery files under "Decisions" item 1.
