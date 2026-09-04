# Orchestrators — import cascade

**Scope:** `extensions/pi-claude-marketplace/orchestrators/import/**` and
`tests/orchestrators/import/**`
**Test files reviewed:** 7
**Production modules reviewed:** 7

## Summary

This is one of the strongest areas in the sweep. Every production module is
paired 1:1 with a test module, `execute.messaging.test.ts` compares whole
rendered strings against hand-written literals with no production-builder
leakage, `types.test.ts` is a correct type-only pairing, and `index.test.ts`
proves the barrel's closed re-export surface with `@ts-expect-error` negatives
plus a same-binding `assert.strictEqual()`. The durable project decision that
import never opts a plugin into `applyDefaultEnabled` (D-102-03, the "import
always carries an explicit `enabled: true`, reconcile may carry none"
distinction) IS covered and would fail under a regression — see the finding
below for the exact case and line. The three themes a fixing pass should
attack, in order: (1) a handful of tests where the interaction with
`installPlugin`/`addMarketplace` — not the returned result — is the behavior
under test use hand-rolled recorder arrays instead of `strong-mock`, including
the one test that guards D-102-03; (2) a systemic `result` placeholder-name
habit in `refs.test.ts`, `marketplaces.test.ts`, and `settings.test.ts`; (3) a
couple of small production-code testability/traceability gaps in `settings.ts`
and `execute.ts`. Nothing found rises to a BLOCKER: assertions throughout are
whole-value, hermeticity is solid (case-owned `mkdtemp` roots, `t.after`
cleanup, HOME/PI_CODING_AGENT_DIR restoration), and no case would pass a
plausible wrong implementation as far as I could determine.

## Unit test findings

### `tests/orchestrators/import/execute.test.ts`

- **[WARNING] Hand-rolled recorder arrays stand in for `strong-mock` on the
  cases where the interaction itself is the behavior under test** —
  `test('passes the marketplace add an options object that carries the git
  port only when the caller supplied one')` (lines 455–520, recorder
  `requested: AddOptions[]` at line 464/467), `test('installs every plugin in
  orchestrated mode and never opts in to the default-enabled policy')` (lines
  1528–1579, recorder `requested: InstallOptions[]` at line 1532/1541 — **this
  is the D-102-03 case**), `test('ensures every marketplace before installing
  any plugin and never installs under a blocked one')` (lines 699–739, order
  log `calls: string[]` at 703/711/717), `test('keeps each selected scope's
  marketplaces and plugins independent and renders both blocks')` (lines
  1636–1692, order log `calls` at 1640/1654/1658), and the four
  continuation-order cases using `attempted: string[]` (lines 1060–1120,
  1145–1202, 1234–1290, 1467–1526, pushes at 1080, 1166, 1255, 1486). In every
  one of these, `installPlugin`/`addMarketplace` is replaced by a plain arrow
  function that pushes into a local array, and the array is compared with
  `assert.deepStrictEqual()` — there is no `mock<InstallPlugin>()` /
  `mock<AddMarketplace>()`, no `exactParams: true`, and no `verify()`. Per the
  project's test-double rules, calling the plugin/marketplace orchestrators is
  public behavior, and where the *interaction itself* (exact options object,
  or call order across the two collaborators) is what a case is proving —
  which is exactly what these seven cases do — `strong-mock` is the required
  tool, with the shared-log escape hatch for order used only through mocks
  that are still verified. Convert each of these seven collaborators to
  `mock<InstallPlugin>({ exactParams: true, name: "install plugin" })` /
  `mock<AddMarketplace>({ exactParams: true, name: "add marketplace" })`
  (mirroring the correctly-built exemplar at line 389), express each expected
  call with `when(() => fn({...exact args})).thenResolve(...)` (or
  `.thenCall(() => { log.push(...); return ...; })` for the four order cases,
  still pushing into one shared log), and call `verify(fn)` for every mock
  created, at the end of the case, after the existing result/notification
  assertions. Everywhere else in this file `installPlugin`/`addMarketplace`
  are legitimate **stubs** driving a canned response with no call-shape
  assertion — those are correct as written and do not need to change; the
  file's actual public contract (`ClaudeImportExecutionResult` plus the
  rendered notification) is asserted by whole-value `deepStrictEqual` in
  essentially every case, which is the right primary assertion.

### `tests/orchestrators/import/refs.test.ts`

- **[WARNING] `assert.deepEqual` used instead of `assert.deepStrictEqual`** —
  every case in the file (e.g. lines 17, 35, 53, 158, 192, 257) uses the
  loose, legacy `assert.deepEqual`, which coerces primitives (`==` semantics)
  rather than the whole-value strict comparison the project's own testing
  rules require. None of the current fixtures happen to exercise a type
  coercion this would hide, but the convention (and every sibling file in
  this area) is `deepStrictEqual`. Replace `assert.deepEqual` with
  `assert.deepStrictEqual` throughout the file.
- **[WARNING] Placeholder variable name `result`** — all 12 cases bind the
  function's return value to `const result` (lines 14, 32, 50, 64, 78, 92,
  106, 120, 134, 155, 189, 254). Rename to a role-based name per case, e.g.
  `parsed` for `parseEnabledPluginRef` results and `extracted` for
  `extractEnabledPluginRefs` results.

### `tests/orchestrators/import/marketplaces.test.ts`

- **[WARNING] Placeholder variable name `result`** — all 9 cases bind the
  return value to `const result` (lines 28, 138, 198, 257, 281, 353, 443, 486,
  534). Rename to `plan` for `buildClaudeImportPlan` results and
  `sourcePlan`/`planned` for `planMarketplaceSourcesForRefs` results.

### `tests/orchestrators/import/settings.test.ts`

- **[WARNING] Placeholder variable name `result`** — 6 cases bind to `const
  result` (lines 261, 300, 335, 360, 387, 431) and 3 more predeclare `let
  result;` (lines 484, 541, 582). Rename to `loaded` (matching
  `loadMergedClaudeSettingsForScope`'s own return-type naming elsewhere in the
  suite, e.g. `ClaudeSettings`/`loaded` used in `execute.test.ts`).
- **[WARNING] An assertion runs inside the "arrange" phase** —
  `test('reports invalid environment, malformed base, and unreadable local
  diagnostics in order')`, lines 461–535: the `.catch()` callback that probes
  the real `EISDIR` errno text (lines 475–482) contains its own
  `assert.deepStrictEqual({ code: errno.code, syscall: errno.syscall }, {
  code: "EISDIR", syscall: "read" })` before the `// act` comment. Move this
  probe-validation assertion so it reads as part of arranging the expected
  value (e.g. extract it into a small helper called from arrange that throws
  descriptively on an unexpected errno, rather than asserting inline), or add
  a short comment noting it is a fixture-validity guard distinct from the
  case's own assertions, so the phase markers are not misleading about what
  the "assert" section actually covers.

### `tests/orchestrators/import/index.test.ts`

- **[WARNING] Unnecessary `describe()` nesting for a single runtime
  re-export** — `describe("importClaudeSettings", () => { test(...) })` (lines
  62–73) wraps exactly one `test()`. The barrel currently re-exports exactly
  one runtime binding (proved by the `Same<ImportRuntimeExport,
  "importClaudeSettings">` check at line 21), so the `describe()` groups
  nothing. Flatten to a top-level `test("importClaudeSettings re-exports the
  defining binding", () => {...})`.

### Clean files

- `tests/orchestrators/import/types.test.ts` — type-only pairing done
  correctly: `satisfies` positives, `@ts-expect-error` negatives, and
  `IsMutableArray` readonly-array checks; zero runtime cases, which is
  correct for this module.
- `tests/orchestrators/import/execute.messaging.test.ts` — every rendered row
  is compared against a hand-written literal string built independently of
  the production render map; `Object.keys(message)`/`Object.hasOwn` checks
  confirm optional-field omission; no findings.

## Production code findings

### `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`

- **[WARNING] Needlessly long relative import paths for sibling
  orchestrators** — lines 2, 6, 36, and 37 import `orchestrators/marketplace/
  add.ts`, `orchestrators/plugin/install.ts`, and `orchestrators/types.ts` via
  `../../orchestrators/...`, climbing two directories to the extension root
  and back down through `orchestrators/` again, when the correct sibling-
  relative path from `orchestrators/import/` is one level up:
  `../marketplace/add.ts`, `../plugin/install.ts`, `../types.ts`. This is the
  established convention elsewhere in the same directory tree (e.g.
  `orchestrators/plugin/reinstall.ts:117` imports `../marketplace/shared.ts`).
  Shorten all four import specifiers to the one-level-up form.
- **[WARNING] The deliberate omission of `applyDefaultEnabled` carries no
  traceability comment at its call site** — `installOnePlannedPlugin`'s call
  to `installPlugin` (lines 691–699) never sets `applyDefaultEnabled`, which
  is exactly the D-102-03 decision ("import never applies `defaultEnabled`")
  and is what the test at `execute.test.ts:1528` guards. `install.ts`
  documents the flag's semantics and its D-102-03/D-102-04 callers at its own
  declaration, but the far more consequential *absence* of the field here
  carries no comment. Add a short comment at the call site (e.g. "D-102-03:
  import never opts in to `applyDefaultEnabled` — every ref reaching this
  point arrived because Claude Code's `enabledPlugins` said `true`
  (`refs.ts`), so there is no absent-enabled case to resolve here") so a
  future edit that "helpfully" adds the field back is caught by a reviewer
  reading the comment, not only by the test.
- **[WARNING] Several exported outcome interfaces carry no doc comment** —
  `MarketplaceAddedOutcome`, `MarketplaceSkipOutcome`, `PluginSkipOutcome`,
  `MarketplaceFailureOutcome`, `SourceMismatchOutcome`, and
  `UnexpectedPluginFailureOutcome` (lines 50–128) have no top-of-interface
  comment describing when each is produced, unlike `PluginInstalledOutcome`
  a few lines above them whose fields are documented. A one-line comment per
  interface (mirroring the pattern already used for `PluginInstalledOutcome`)
  would help a reader map the discriminated `kind` values back to the code
  paths that produce them.

### `extensions/pi-claude-marketplace/orchestrators/import/settings.ts`

- **[WARNING] `resolveClaudeSettingsPaths` reads `process.env.CLAUDE_CONFIG_DIR`
  and `os.homedir()` directly (lines 33–38)** — this is a live-environment
  read buried inside resolution logic rather than an injected dependency. The
  function already accepts `options.claudeConfigDir` as an override, so tests
  can bypass it for the explicit-path case, but the two "default" branches
  (env-var present/absent) can only be exercised today by mutating the real
  `process.env` (see `settings.test.ts` lines 54–83, 140–163). Consider making
  the environment/home lookup an explicit collaborator (e.g. a small `{
  getEnv, homedir }` ports object defaulted to `process.env`/`os.homedir` at
  the composition root) so the default-path branches can be tested without
  touching the real process environment.
- **[WARNING] Unchecked type assertion on a caught value** — line 61,
  `(err as NodeJS.ErrnoException).code === "ENOENT"`, casts the `catch`
  block's `unknown` value without a runtime check or a comment establishing
  why it is safe. `fs/promises` read failures are reliably errno-shaped, but
  say so with a short comment (mirroring the Google-style guidance that a
  defensive non-`Error` assumption needs a stated reason), or narrow with
  `err instanceof Error && "code" in err` first.

### Clean files

- `extensions/pi-claude-marketplace/orchestrators/import/types.ts`
- `extensions/pi-claude-marketplace/orchestrators/import/index.ts`
- `extensions/pi-claude-marketplace/orchestrators/import/refs.ts`
- `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts`
- `extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts`

## Not covered

- I did not run `node --test`, `npm run test:coverage:direct`, or `npm run
  check` per the diagnostic-review instruction to review by reading only; all
  findings above are from static reading, not toolchain output.
- I did not review `orchestrators/plugin/install.ts`'s own test suite (which
  independently proves D-102-03/D-102-04's `applyDefaultEnabled` semantics)
  in depth — it is out of this area's assignment, and I relied on a targeted
  research pass over its source to confirm the mechanism `execute.ts` relies
  on.
