# Domain — resolver

**Scope:** `extensions/pi-claude-marketplace/domain/resolver.ts` (1757 lines) and its sole paired
test module `tests/domain/resolver.test.ts` (3949 lines, 136 `test()` cases)
**Test files reviewed:** 1
**Production modules reviewed:** 1

## Summary

Structurally the suite is sound: no `describe`, no `before`/`beforeEach`, no shared mutable
state, no `test.only`/`.skip`/`.todo`, no process-wide `mock`, no hand-rolled doubles standing in
for `strong-mock`, and every `mkdtemp` case cleans up via `finally` or `t.after()`. Titles carry
durable IDs (`PR-2`, `DFEN-02`, `HOOK-01`, ...) with no GSD-process references. The production
module is genuinely pure and network-free, and its fs/context injection points
(`ctx.statKind`/`ctx.readFileText`) are exactly the sanctioned "inject a narrow consumer-declared
port" pattern.

The two things a fixing pass should attack first: (1) the overwhelming majority of the 136 cases
assert a handful of fields (`state`, one or two `notes.some(...)` substrings) instead of the whole
`ResolvedPlugin` verdict via `assert.deepStrictEqual`, even though ~11 exemplary tests near the end
of the file (`resolveStrict returns the complete installable true arm` and siblings) already prove
the right pattern and should be the template; and (2) five `requireInstallable`/
`requirePartialInstallable` throw-tests assert only `error.message.includes(...)`, duplicating
coverage that stronger sibling tests already provide correctly via `instanceof PluginShapeError` +
`error.shape`. A third, smaller theme: one real hidden-environment read in production
(`homedir()`/`process.cwd()` inlined into `readStandaloneHooks`) and one hermeticity wrinkle (a
test that stats the real `/dev/null`). Given the module's size and the number of independently
testable sub-responsibilities it bundles, a file split (detailed below) would make both problems
much easier to fix, because each extracted concern would get its own small, fully-asserted test
file instead of being exercised only indirectly through `resolveStrict`/`resolveLoose`.

## Unit test findings

### `tests/domain/resolver.test.ts`

- **[BLOCKER] Pervasive partial-field assertions instead of whole-object `deepStrictEqual`** —
  representative: `test('PR-2(2) source path escape -> notInstallable')` line 146,
  `test('HOOK-01: hooks/hooks.json present + parseable -> installable WITH hooks in supported')`
  line 229, `test('PR-3 multiple unsupported components both surface as notes')` line 1671,
  `test('COMP-01 (c) BOTH manifest [...] AND default skills/ -> UNION [...]')` line 2542, and
  roughly 100 more across the file (106 lines read `resolvedPlugin.state,` off an
  `assert.strictEqual`, 53 use `notes.some(...)`). Every one of these checks `state` plus one or
  two note substrings or one array's `.includes(...)`, but never the complete verdict object. A
  wrong implementation that gets the field under test right while corrupting an untouched sibling
  field (e.g. leaving a stray entry in `unsupported`, dropping an item from `componentPaths`,
  mis-populating `mcpServers`, or flipping `defaultEnabled`) passes every one of these tests. The
  file already contains the fix pattern, applied correctly 11 times starting at line 3329
  (`resolveStrict returns the complete installable true arm`), 3352, 3378, 3394, 3413 (via
  `assert.deepStrictEqual(resolvedPlugin, {...literal...})`), and again for error shapes at 3489,
  3515, 3541 (`assert.deepStrictEqual(error.shape, {...})`). One test even states the rationale
  directly (line ~1148: "the only arm whose carried value nothing else asserts, so hardcoding the
  argument ... would otherwise go unnoticed"). Rewrite the weak cases to build the complete
  expected `ResolvedPlugin` literal (or, where only one arm's extra fields are relevant, narrow
  with `requireInstallable`/`requirePartialInstallable`/a `state ===` guard and then
  `assert.deepStrictEqual` the narrowed value) instead of `assert.ok(...notes.some(...))` /
  `assert.strictEqual(resolvedPlugin.state, ...)` pairs. Do this file-wide; do not leave the two
  styles mixed once the fixing pass starts.
- **[BLOCKER] `requireInstallable`/`requirePartialInstallable` throw-assertions keyed on
  `error.message.includes(...)`** — `test("PR-6 requireInstallable on not-installable throws with
  'is not installable' + notes")` line 1790, `test("PR-6 requireInstallable(resolvedPlugin,
  'update') throws with 'is no longer installable'")` line 1809, `test("RSTATE-04
  requirePartialInstallable throws on unavailable with 'is not installable'")` line 1927,
  `test("RSTATE-04 requirePartialInstallable(resolvedPlugin, 'update') throws with 'is no longer
  installable'")` line 1947, `test("RSTATE-04 loose: requirePartialInstallable throws on
  unavailable")` line 3307. Each narrows only on `error instanceof Error` and a message substring
  — a wrong implementation that throws a plain `Error("...is not installable...")` instead of
  `PluginShapeError` with the correct structured `.shape` passes all five. The file already has the
  correct pattern for the exact same throw paths: line 1975 (`SEV-02 / IN-02: requireInstallable on
  unsupported throws partialable with the typed unsupportedKinds`), line 3475
  (`requirePartialInstallable rejects the false arm with the exact shape`), line 3500
  (`requireInstallable rejects the partial true arm with secondary detail`), line 3527
  (`requireInstallable rejects the false arm before secondary state detail`), line 3808
  (`requireInstallable classifies an update of the partial true arm`), all asserting
  `error instanceof PluginShapeError` plus `assert.deepStrictEqual(error.shape, {...})` or
  `assert.strictEqual(error.shape.kind, ...)`. Rewrite the five weak tests the same way (or delete
  them if the corresponding case in the strong set already covers the same `op`/arm combination —
  check before deleting: `PR-6`'s two cases and `RSTATE-04`'s three cases are not fully duplicated
  by the strong set, so upgrade rather than delete).
- **[WARNING] Real `/dev/null` read instead of a case-owned temp fixture** — `test("resolveStrict
  classifies an existing special-file source through the default stat reader")` line 3574. This
  test passes `{ marketplaceRoot: "/" }` and stats the real, fixed, host `/dev/null` to exercise
  `defaultStatKind`'s "exists but is neither a directory nor a regular file" branch. It is the only
  case in the file that reaches outside a `mkdtemp`-owned directory. The adjacent test three cases
  earlier (line 3553, `resolveStrict classifies a real file source through the default stat
  reader`) already covers the observable behavior (a non-directory source resolves `unavailable`)
  via a `mkdtemp` fixture; the `/dev/null` case only adds internal-branch coverage
  (`isFile() === false && isDirectory() === false`) at the cost of depending on a fixed OS path that
  is not guaranteed to exist or behave identically on every platform this suite might run on. If
  that specific branch is worth pinning, create the special file inside a `mkdtemp`-owned directory
  (e.g. a FIFO via a `mkfifo` helper) instead of reading `/dev/null`; otherwise drop the case, since
  the adjacent mkdtemp-based test already exercises the user-visible outcome.
- **[WARNING] Hooks fixtures live in the repo-wide `tests/fixtures/` directory rather than beside
  their concern** — `fixture("hookify-hooks")` line 362, `fixture("ralph-wiggum-hooks")` line 404,
  `fixture("hooks-posttooluse-and-notification")` line 491, `fixture("hooks-pretooluse-matcher-mix")`
  line 528, `fixture("hooks-notification-only")` line 568. These five JSON payloads exist solely for
  this file's hooks-admission tests, but `tests/fixtures/` is a shared, multi-concern directory used
  by other test suites too. This is a pre-existing repo-wide convention rather than something this
  file introduced, so it is not worth an isolated fix here, but if a resolver split (see below)
  happens, move these five files under the new `hooks`-concern test directory rather than carrying
  them forward into the shared top-level folder.

### Clean files

- (none beyond the findings above — no other file was in scope)

## Production code findings

### `extensions/pi-claude-marketplace/domain/resolver.ts`

- **[WARNING] Hidden environment read inside `readStandaloneHooks`** — line 1226:
  `const ifCtx = { homedir: homedir(), cwd: process.cwd(), projectRoot: process.cwd() };`. This
  calls the real `os.homedir()` and `process.cwd()` unconditionally on every hooks-config probe,
  even though the resolver's `ResolveContext` already has an established injection point for every
  other environment-facing read (`ctx.statKind`, `ctx.readFileText`). Today the call site always
  passes `{ skipIfMap: true }` to `parseHooksConfig` (line 1228), so `ifCtx` is computed but never
  consumed — but the values are real host state with no override point, so the moment a future
  caller drops `skipIfMap`, the resolver silently starts depending on the real host filesystem
  layout inside what the module header advertises as a pure, "network-free" resolver, and no test
  in the paired suite can exercise that path deterministically. Apply the sanctioned fix: add
  `homedir`/`cwd`/`projectRoot` (or a single `ifCtxOf(ctx)`-style bundle) as optional fields on
  `ResolveContext` with the current calls as their defaults, mirroring `statKindOf`/
  `readFileTextOf`. If the value is genuinely dead while `skipIfMap` stays hardcoded `true`, drop
  the computation entirely instead and construct `ifCtx` only if/when `skipIfMap` is lifted.
- **[WARNING] `.bind` used where a plain arrow expresses the same intent** — line 1227:
  `const noopCompileIf = JSON.parse.bind(JSON, "null") as () => null;`. This is a `Function.bind`
  used to build a niladic function that always returns `null`, which the style guide calls a
  finding on its own ("no `bind`/`call`/`apply` where an arrow ... works"), and is also
  meaningfully harder to read than the direct expression of the same value. Replace with
  `const noopCompileIf = (): null => null;` — same runtime behavior, no `bind`, no cast.

### Clean files

- (none — the single production module in scope has the two findings above)

## Split assessment

Yes — the 1757-line production module and its 3949-line paired test bundle several
independently-testable responsibilities that today can only be exercised indirectly through
`resolveStrict`/`resolveLoose`, which is a large part of why the test file is so large and why so
many cases fall back to "call the whole resolver, then grep the `notes` array" instead of asserting
a small function's direct return value. The natural seams, by production responsibility, each with
its own would-be paired test file:

1. **Schema/type module** (today's lines ~58–337: `ComponentPathsSchema`, `McpServersFieldSchema`,
   `DroppedHookSchema` + its two drift-guard types, `MATERIALIZABLE_FIELDS`, the three
   `ResolvedPlugin*Schema` arms, `ResolvedPluginSchema`, every exported `ResolvedPlugin*`/
   `MaterializablePlugin`/`GitPluginRootResult`/`StatKind*` type, `ResolveContext`). This is pure
   type/schema definition with a natural home either as its own file or folded into
   `domain/components/`, which already holds the sibling `hooks.ts`/`mcp.ts`/`plugin.ts` schemas.
2. **Unsupported-kind detection** (`SUPPORTED_COMPONENT_KINDS`, `UNSUPPORTED_COMPONENT_KINDS`,
   `UNSUPPORTED_COMPONENT_CONVENTIONS`, `nestedExperimentalValue`, `declaresUnsupportedKind`,
   `hasUnsupportedConvention`, `collectUnsupportedKinds`, `addUnsupportedKindNotes`) — one cohesive
   concern (~150 lines) that today is reachable only through a full `resolveStrict`/`resolveLoose`
   call per test; the `unsupportedConventionScenarios` loop tests (lines 855, 3100) and the
   `PR-3`/`RSTATE-02` tests would move here and could assert the collector's return value directly.
3. **Component-path validation** (`readPathOrArray`, `validateComponentPath`, `addComponentPath`,
   `addValidatedComponentPath`, `collectStrictComponentKind`, `collectLooseComponentKind`) — the
   `PR-2(7)/(8)/(9)`, `COMP-01`, and `D-07` tests would move here.
4. **MCP resolution** (`readStandaloneMcp`, `validateReferencePath`, `readReferencedMcp`,
   `applyMcpValue`, `applyStrictMcp`, `applyLooseMcp`) — the whole `MCPR-*` block (roughly lines
   1209–1589 and 2908–3008 of the current test file) would move here as a focused, directly-tested
   module instead of routing every case through the full resolver.
5. **Hooks resolution** (`readStandaloneHooks`, `detectOrphanRewake`, `applyHooksConfig`) — the
   `HOOK-01`, `ADMIT-*`, `D-57-04`, `D-71-*`, `PHOOK-*`, and `SURF-05` blocks would move here; this
   is also where the `homedir()`/`process.cwd()` finding above should be fixed, since it is entirely
   local to this concern.
6. **Orchestration core** (kept in `resolver.ts`): `PartialResolution` + its constructors
   (`emptyResolution`, `unavailable`, `materializableFields`, `installable`, `partiallyAvailable`),
   source classification and pluginRoot derivation (`classifySourceSupport`, `sourceEscapeReason`,
   `readManifest`, `deriveSourcePluginRoot`, `preflightStages`), the enablement precedence rule
   (`entryDeclaresInstallDisabled`, `rowClaimsInstallDisabled`, `resolveDefaultEnabled`), the
   mode-driver (`ResolveMode`, `resolveWithMode`, `runStructuralStages`, `noteDeclaredDependencies`,
   `decideResolution`), and the public API (`resolveStrict`, `resolveLoose`, `requireInstallable`,
   `requirePartialInstallable`). This is what should stay under `tests/domain/resolver.test.ts`,
   shrunk to the `PR-2` preflight cases, `DFEN-02` precedence table, `MM-5`/`MM-6`/`MM-7` happy
   paths, `PURL-01`/`PURL-03` git-source cases, the `RES-01` exact-shape cases, and the
   `requireInstallable`/`requirePartialInstallable` gate cases — the genuinely cross-cutting,
   whole-pipeline behavior that has to be tested end-to-end.

Splitting this way would cut the paired test file from ~3949 lines to roughly a third of that for
the orchestration core, with the remaining ~2500 lines redistributed into four or five small,
single-responsibility test files that can assert each helper's direct return value with
`assert.deepStrictEqual` instead of reaching for `resolveStrict`'s full output and grepping
`notes`.

## Not covered

- No coverage-tool run (`npm run test:coverage:direct`) was performed, per this review's
  diagnostic-only constraint (no build/test commands). Branch/line coverage completeness for
  `resolver.ts` was assessed by reading, not measured.
- `npx tsc --noEmit` / `npx eslint` were not run, per the same constraint; findings above that
  overlap the toolchain (e.g. `.bind` usage) are flagged because they are readability/design
  judgments the linter does not gate, not because the toolchain was confirmed green.
