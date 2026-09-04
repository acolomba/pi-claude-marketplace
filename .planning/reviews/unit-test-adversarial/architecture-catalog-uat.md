# Architecture — catalog UAT gate

**Scope:** `tests/architecture/catalog-uat.test.ts` (5442 lines) and the production
modules it imports: `extensions/pi-claude-marketplace/shared/notify.ts`,
`extensions/pi-claude-marketplace/shared/notify-context.ts`,
`extensions/pi-claude-marketplace/shared/probe-classifiers.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts`.
**Test files reviewed:** 1
**Production modules reviewed:** 5

## Summary

The gate itself is well engineered: it drives the real `notify()`/`notifyWithContext()`
renderers (never a hand-computed expected value), reads its expected bytes from an
independently hand-maintained doc (`docs/output-catalog.md`), pins the parsed-example
count at an exact 182 (not a floor) so a parser regression can't silently under-scan the
corpus, and gates both directions (catalog→fixture and fixture→catalog) so neither side
can drift unnoticed — this is exactly the "plants the violation" shape the project's own
convention doc asks for, not a "reads the config" gate. The five production modules it
touches are unusually clean: zero `as`/`!`/`catch`/`console`/module-level mutable state
found across `notify.ts` (4217 lines) by targeted grep, and the two messaging modules and
`probe-classifiers.ts` are small, well-documented, and free of testability smells.

The test file itself has three real problems, all structural rather than
correctness-threatening: (1) it imports the process-wide `mock` from `node:test` instead
of using each case's own `t.mock`; (2) every call into `notify()`/`notifyWithContext()`
passes its mock `ctx`/`pi` through `as never`, a cast that defeats type-checking entirely
because the production signatures take the full external SDK's `ExtensionContext`/
`ExtensionAPI` rather than a narrow consumer-declared port — this is the one production
testability finding worth carrying into the fixing pass; and (3) at 5442 lines the file
mixes three unrelated responsibilities (a markdown parser, a ~4750-line fixture data
table, and the byte-equality driver) that have an obvious, mechanical three-way split.
None of these make the suite lie today, but the file-size and cast issues will make the
next change to this gate materially harder to review and land.

## Unit test findings

### `tests/architecture/catalog-uat.test.ts`

- **[WARNING] `as never` casts hide the mock ctx/pi doubles from the type checker** —
  `lines 828-829, 900, 2125, 2452, 5174, 5268, 5280, 5325` (9 call sites total). Every
  invocation of `notify()`/`notifyWithContext()`/`notifyUpdateNoOpWithContext()` casts its
  `MockCtx`/`MockPi` argument `as never`. `never` is a subtype of every type, so `x as
  never` type-checks regardless of `x`'s shape — this is strictly worse than `as unknown as
  T`, because it gives up the "double checked with `satisfies`" narrowing the skill asks
  for entirely. If the real `ExtensionContext`/`ExtensionAPI` (from
  `@earendil-works/pi-coding-agent`, re-exported verbatim by `platform/pi-api.ts`) drops or
  renames a member `MockCtx`/`MockPi` doesn't use, or `notify()`'s signature otherwise
  drifts, the compiler will not catch it here. Fix on the test side is mechanical once the
  production fix below lands: drop the casts and let `MockCtx`/`MockPi` satisfy the
  narrower port type directly (`satisfies NotifyCtx` / `satisfies NotifyPiProbe` or
  equivalent).
- **[WARNING] Process-wide `mock` imported from `node:test` instead of the case's own
  `t.mock`** — `line 39` (`import test, { mock } from "node:test";`), used at `line 199`
  inside `makeCtx()`. None of the six `test()` bodies take a `t: TestContext` parameter, so
  `makeCtx()` has no per-case context to draw from. Give each `test()` a `t` parameter, pass
  it through to `makeCtx(t)`, and replace `mock.fn()` with `t.mock.fn()` there.
- **[WARNING] Bare `actual` local variable** — `line 5185` in `checkCatalogExample`
  (`const actual = callArgs[0];`). This is exactly the placeholder name the skill calls out
  by name. Rename to something naming its production role, e.g. `renderedBody`.
- **[WARNING] All six `test()` bodies omit `// arrange` / `// act` / `// assert` phase
  comments** — `lines 5228, 5261, 5318, 5374, 5412, 5419`. None of the real test cases (the
  catalog-parity gate, the inverse-walk gate, `XSURF-03`, `UGRM-02`, and the two
  `loadCatalogExamples` unit tests) mark their phases. Add the three lowercase comments to
  each, separated by blank lines (`// act & assert` where one expression does both, as in
  the two `loadCatalogExamples` cases).
- **[WARNING] The 182-example catalog walk is one `test()` looping over all rows instead
  of one sibling `test()` per row** — `test("catalog UAT: every <!-- catalog-state: -->
  annotation pairs byte-equal with notify()", ...)`, `lines 5228-5252`. The loop does not
  stop at the first failure (failures are collected and reported together via
  `formatCatalogFailure`), which avoids the worst version of this anti-pattern, but the
  suite still reports one lump pass/fail for 182 distinct documented behaviors instead of
  182 independently-selectable results. Since `examples` is knowable at module load time
  (top-level `await readFile(...)` is legal in this ESM-native test tree), this can be
  restructured into one `test(`${section} :: ${state}`, ...)` per parsed example, generated
  in a top-level loop, while keeping the separate inverse-walk test as the "no orphan
  fixture" direction. Lower priority than the two casts/mock findings above given the
  mitigations already in place, but worth doing in the same pass as the file split below
  since the fixture data would move together anyway.
- **[WARNING] `FIXTURES` scope-gate comment is violated by two entries that synthesize
  `reasons` from a domain helper** — `lines 4301, 4509` (`reasons:
  narrowUnsupportedKinds(["lspServers"])`, inside the `enable-partial` and one
  `marketplace enable`-adjacent failed-row fixture). The file's own header states (`lines
  12-14`): "Fixtures are pure `NotificationMessage` data -- they are not synthesized from
  domain helpers." These two entries call the real `narrowUnsupportedKinds` (imported from
  `shared/probe-classifiers.ts`) to build part of a fixture's input. This does not weaken
  the gate — the byte comparison is still against the independently-authored catalog text —
  but it contradicts the stated invariant and is inconsistent with every other fixture in
  the file, which spells reasons as literal strings (e.g. `reasons: ["lsp"]` elsewhere for
  the same reason). Either hardcode the literal (`reasons: ["lsp"]`) to make the stated
  invariant true again, or replace the header comment's blanket claim with a documented,
  narrow exception the way `XSURF-03` documents its own reuse of the same helper.
- **[WARNING] Dead `sourceInfo` field on the test-local `MockTool` type** — `line 204`
  (`sourceInfo?: { source?: string };`). `platform/pi-api.ts`'s real
  `hasLoadedPiMcpAdapter` has an OR-branch keyed on `tool.sourceInfo?.source` (a substring
  match for `"pi-mcp-adapter"`), but none of the three `piWith*` factories in this file ever
  set `sourceInfo` — every fixture only exercises the `name === "mcp"` branch. Either drop
  the unused field from `MockTool`, or add a fourth factory that exercises the
  `sourceInfo`-only detection path if a catalog state needs it (that branch's coverage
  belongs primarily to `platform/pi-api.ts`'s own paired test, not here — this is a small
  local-cleanup note, not a pairing gap).

### Clean files

None beyond the above — this is the only test file in the assignment. All six real test
cases use `assert.equal`/`assert.deepStrictEqual`-shaped comparisons of the whole rendered
string (or an explicitly-scoped substring/regex where the test's own stated purpose is
narrower than full byte parity, e.g. `UGRM-02`'s cross-verb leak check), await every
async assertion, and use fresh per-example `MockCtx` objects with no case-to-case aliasing.
No `describe()`, no committed `only`/`skip`/`todo`, no `it()`, no shared mutable module
state, no real network or filesystem writes (the one real filesystem read,
`docs/output-catalog.md`, is the behavior under test, read fresh per test), no
`Date.now()`/`Math.random()`/`process.env`, and no Plan/Phase/Wave references anywhere in
5442 lines.

## Does the file need to split? (explicit assessment)

Yes. The file mixes three unrelated production responsibilities that a fixing pass should
separate:

1. **A markdown parser** (`resolveSectionName`, `CatalogScanState`, `scanInsideFence`,
   `scanOutsideFence`, `loadCatalogExamples`, `CATALOG_SECTION_RE`, `CATALOG_STATE_RE` —
   `lines 61-188`), which is real, non-trivial parsing logic (a two-state scanner over
   fenced/unfenced lines) with its own two dedicated unit tests currently living at the
   very bottom of the same file (`lines 5412-5442`). This belongs in its own module,
   e.g. `tests/architecture/catalog-uat/catalog-parser.ts` + a co-located
   `catalog-parser.test.ts`, so the parser's correctness is reviewable independently of the
   4750-line fixture table sitting between its implementation and its tests today.
2. **The fixture data table** (`FIXTURES`, `lines 356-5101`, ~4750 lines), which is already
   internally organized into 18 top-level command-surface sections (`/claude:plugin list`,
   `install`, `uninstall`, `reinstall`, `update`, `fetch`, `import`, `bootstrap`,
   `marketplace list/add/info/remove/update/autoupdate`, `info`, `enable`, `disable`,
   `pending`). Each section is already a self-contained slice of `FixtureMap`. Splitting
   this into one file per section under e.g. `tests/architecture/catalog-uat/fixtures/`
   (`list.ts`, `install.ts`, `update.ts`, …, each exporting its slice, merged into one
   `FIXTURES` object either by spreading in the main file or via a small
   `fixtures/index.ts`) turns one 4750-line blob into ~18 files of roughly 100-500 lines
   each, each traceable to the one command surface it documents. `CatalogFixture` /
   `FixtureMap` / `MockPi` / `piWith*` would move to a shared `fixtures/types.ts` +
   `fixtures/mock-pi.ts` alongside them.
3. **The gate driver and the four real behavioral tests** (`Failure`, `checkSeverityArg`,
   `checkCatalogExample`, `formatCatalogFailure`, and the `catalog UAT`, inverse-walk,
   `XSURF-03`, and `UGRM-02` tests — `lines 5109-5372`), which is the part that actually
   changes when the *gate's own logic* changes, as opposed to when a new catalog example is
   added. This stays in `tests/architecture/catalog-uat.test.ts`, shrinking it to
   roughly 300-400 lines.

This split follows the file's own existing internal structure (the banner comments already
delimit exactly these three concerns and the 18 sections) rather than inventing a new one,
and it means a reviewer checking "did the new fixture for `marketplace update` match its
catalog entry" no longer has to load a 5442-line file to do it.

## Production code findings

### `extensions/pi-claude-marketplace/shared/notify.ts`

- **[WARNING] `notify()` takes the full external SDK types instead of a narrow
  consumer-declared port** — `lines 3813-3817`
  (`export function notify(ctx: ExtensionContext, pi: ExtensionAPI, message:
  NotificationMessage): void`). `ExtensionContext`/`ExtensionAPI` are re-exported verbatim
  from `@earendil-works/pi-coding-agent` by `platform/pi-api.ts` (large SDK interfaces
  covering session lifecycle, event registration, tool calls, etc.), but `notify()` only
  ever calls `ctx.ui.notify(...)` and threads `pi` straight into `softDepStatus(pi)`, which
  itself only calls `pi.getAllTools()`. Because the real parameter type is this wide, the
  test file's minimal doubles (`{ ui: { notify } }`, `{ getAllTools }`) cannot satisfy it
  structurally and the test resorts to `as never` at every call site (see the test finding
  above) — that is the direct cause of that test-side BLOCKER-adjacent smell. The sanctioned
  fix is the third of the four listed in the testing skill: inject the side-effecting
  dependency through a narrow, consumer-declared port, e.g.
  `interface NotifyUi { ui: { notify(message: string, severity?: Severity): void } }` and
  a `ToolProbeSource { getAllTools(): ReadonlyArray<{ name?: string; sourceInfo?: {
  source?: string } }> }`, declared in this file (or `platform/pi-api.ts`) and used in
  place of `ExtensionContext`/`ExtensionAPI` on `notify()` and the `notify-context.ts`
  entry points. Real call sites are unaffected (a full `ExtensionContext`/`ExtensionAPI`
  structurally satisfies the narrower port); the test doubles satisfy it directly with no
  cast.

No other findings — the file's error handling, types, and export surface are clean by
inspection of the sampled sections (header/type-model, the `notify()`/`dispatchInfoMessage`
region, and the full-file grep below), consistent with the "Not covered" note.

### `extensions/pi-claude-marketplace/shared/notify-context.ts`

- **[WARNING] Single-letter parameter `p` used across multi-line functions** —
  e.g. `dispatchRow` (`lines 311-338`, ~25 lines) and the callback params on
  `notifyWithContext`/`notifyUpdateWithContext`/etc. The style guide allows short names only
  in scopes of ten lines or fewer; `dispatchRow`'s body exceeds that. This is an existing,
  consistent convention across the whole `notify`/`notify-context` subsystem (mirrored in
  `list.messaging.ts` and `update.messaging.ts`'s render maps) rather than something
  introduced here, so treat as low-priority — flagging for awareness, not requesting a
  drive-by rename of unrelated call sites.

No other findings. The unsafe write at `line 327`
(`(p as { severity?: "error" }).severity = "error";`) is inside a `try` that covers only
that one statement, and the `catch` (`lines 328-332`) carries a comment explaining exactly
why the write can fail and why the failure is swallowed — this satisfies the "empty catch
needs a comment" rule (the catch isn't empty and the comment states why it's not rethrown).

### Clean files

- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts`

## Not covered

- `shared/notify.ts` is 4217 lines; I read its header/type-model section, the `notify()`
  entry point and its immediate dispatch region, and ran targeted whole-file greps for the
  patterns the linter cannot catch (`as` assertions outside comments, `!` non-null
  assertions, `catch` blocks, `console.*`, `class`, module-level `let`, `new Date`/
  `Date.now`/`randomUUID`/`process.env`, `export default`, `{}`-as-type, index signatures) —
  all came back empty except where noted above. I did not read the full file line-by-line
  (the ~3700 lines of renderer/composer logic between the type model and `notify()`
  itself), so a subtler issue inside an individual render arm (e.g. a JSDoc that doesn't
  start with a verb phrase, or a `Record` that should be a `Map`) could exist unflagged.
- The `FIXTURES` table (`lines 356-5101`) was sampled across roughly 10 of its 18 sections
  (list, install-disabled variants, update no-op/bulk, info, marketplace add, enable) plus
  whole-file greps for the specific defect classes named in the review brief (credentials,
  Phase/Plan/Wave references, TODO/FIXME, `Date`/`random`/`env`, `as never`,
  `narrowUnsupportedKinds` reuse). The remaining ~8 sections (uninstall, reinstall, fetch,
  import, bootstrap, marketplace list/info/remove/update/autoupdate, disable, pending) were
  not individually read; given the mechanical uniformity of every section sampled and the
  clean whole-file greps, I have moderate-to-high confidence they follow the same pattern,
  but this is not a line-by-line guarantee.
- `platform/pi-api.ts` (home of `ExtensionContext`/`ExtensionAPI`/`softDepStatus`) is not
  directly imported by this test file, so it was read only far enough to confirm the
  testability finding above (the wide re-exported SDK types); it was not independently
  reviewed against the style skill as its own pairing.
