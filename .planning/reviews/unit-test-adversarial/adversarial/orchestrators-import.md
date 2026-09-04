# Orchestrators — import cascade — adversarial re-review

**Scope:** `extensions/pi-claude-marketplace/orchestrators/import/**` (7 modules,
1,822 lines) and `tests/orchestrators/import/**` (7 modules, 4,617 lines), read in
full. Cross-checked against `tests/edge/notification-boundary.ts`,
`domain/source.ts::samePlannedSource`, and `shared/notify.ts`'s row primitives.
**First-pass file:** `unit-test-findings/orchestrators-import.md`
**Clean files attacked:** 7 (2 test modules, 5 production modules)
**Existing findings graded:** 12

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 1 |
| New WARNING (missed by first pass) | 15 |
| Existing CONFIRMED | 8 |
| Existing UNDERSTATED | 2 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 1 |
| Existing DUPLICATE-OF | 0 |

The first pass's headline — "one of the strongest areas in the sweep" — survives
attack on the test side and does **not** survive on the production side. The
assertions really are whole-value, hermeticity really is solid, and the area is
free of every dominant defect class in `META-FINDINGS.md` (zero `assert.ok`,
zero `.includes()` fragment assertions, zero `as never`, zero `any`, zero
committed `only`/`skip`). But "nothing found rises to a BLOCKER" is wrong:
`execute.ts` carries the exact silent-omission shape its own comment 40 lines
away documents as unsafe, and five of the seven files declared clean have
surviving mutations.

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`

- **[BLOCKER] `reconcileExistingMarketplace` is a `void` switch over a closed
  union with no `default` — a fourth `SamePlannedSourceResult` member silently
  drops a marketplace and every row under it** — `execute.ts:592–658`
  (switch at `:599`)
  `samePlannedSource` returns the closed union
  `"same" | "different" | "unknown-stored"` (`domain/source.ts:569`). The switch
  handles all three and returns `void`. Adding a fourth verdict compiles clean
  here, and the consequence is not a missing row — it is a **vanished
  marketplace**: the caller `continue`s past `addOnePlannedMarketplace`
  (`execute.ts:837–846`), the marketplace lands in none of the four buckets
  `buildImportNotificationMarketplaces` reads (`addedMarketplaces`,
  `skippedExistingMarketplaces`, `marketplaceFailures`, `sourceMismatches`), no
  `setMarketplaceStatus` call ever fires, and `blockedMarketplaces` stays empty
  so its plugins still install and push rows into `rowsByMp` under a key with no
  entry in `byMp`. Those rows are then never visited by the `[...byMp.values()]`
  map at `:509–515`. That is precisely the **headerless row** the
  `MarketplaceBlock` doc comment (`execute.ts:290–299`) asserts is unreachable —
  the doc's invariant argument covers key-set parity between `pluginsToInstall`
  and `marketplacesToEnsure`, not whether a marketplace acquires a *status*.
  The module already knows the fix and states it verbatim 40 lines further down:
  `installOnePlannedPlugin` (`execute.ts:669–683, 713–722`) invents
  `PlannedPluginBucket` for no reason other than to force a value-returning
  signature, because "TypeScript proves a switch exhaustive only when the return
  type forces a value on every path; a `void` function's switch with a missing
  arm compiles clean."
  **Fix:** mirror the sibling. Declare
  `type ReconciledMarketplaceBucket = "blocked-unknown-source" | "skipped" | "mismatched";`
  make `reconcileExistingMarketplace` return it, and `return` from each arm
  instead of `break`. No test change is required — `execute.test.ts:878`, `:754`,
  `:828` already cover all three arms; the point is that a fourth arm must become
  TS2366 rather than a green run. Do **not** add `default: assertNever(...)`
  here: with the return type in place the arm would be unreachable dead code,
  which is the reason the sibling avoided it.
  *(Secondary, same class, lower value: `addOnePlannedMarketplace:780` tests
  `outcome?.status === "added"` and treats every other arm of the two-arm
  `AddMarketplaceOutcome` union as a failure. A third arm would be silently
  mis-bucketed. "Not added → failed" is a defensible total policy, so this is a
  note, not a separate finding.)*

- **[WARNING] `ClaudeImportExecutionResult.changedResources` has no production
  reader, and its accumulation semantics are unproven** — `execute.ts:141`,
  `:155`, `:190`, `:742`
  `grep -rn changedResources extensions` returns only those four lines: the type
  declaration, the mutable mirror, the initializer, and the single write. No edge
  handler, orchestrator, or `index.ts` route reads it. Separately, mutating
  `result.changedResources ||= outcome.resourcesChanged` to a plain `=` survives
  every case: `execute.test.ts:1424` is the only case with a false
  `resourcesChanged`, and it installs exactly one plugin, so no case ever mixes a
  true and a false install in one run. Line/branch coverage does not catch this —
  both short-circuit arms are executed across the suite.
  **Fix:** decide first whether the field is a contract or residue. If it is
  residue, delete it from `ClaudeImportExecutionResult`, `MutableImportResult`,
  `emptyResult()`, `execute.ts:742`, and the `emptyImportResult()` fixture at
  `execute.test.ts:369` plus `tests/edge/types.test.ts:70`. If it is a contract,
  add a case installing two plugins whose outcomes carry
  `resourcesChanged: false` then `true` and assert `changedResources: true`.

- **[WARNING] The verbatim-`raw` contract that `refLabel` exists to carry is
  never proven end to end** — `execute.ts:194–196`, all `ref:` assertions in
  `execute.test.ts`
  `refs.ts` deliberately preserves the untrimmed spelling
  (`refs.ts:30`, proved by `refs.test.ts:27` "trims the ref parts without
  changing the raw input"), and `refLabel` returns `plugin.ref.raw` so the
  outcome's `ref` field surfaces it. Every `enabledPlugins` key in
  `execute.test.ts` is already canonical (`"plugin@mp"`), and the expected-value
  builders reconstruct `` ref: `${plugin}@${marketplace}` `` (`:282`, `:294`,
  `:312`, `:333`, `:350`). Mutating `refLabel` to
  `` `${plugin.ref.plugin}@${plugin.ref.marketplace}` `` leaves all 35 cases
  green.
  **Fix:** in `execute.test.ts:384` ("records a marketplace the state does not
  carry…"), change the enabled key to `"  plugin  @  mp  "` and set the expected
  `installedPlugins[0].ref` to that verbatim string while leaving `plugin` and
  `marketplace` trimmed. One case pins the whole chain.

- **[WARNING] The order of the two diagnostic sources on `result.diagnostics` is
  unproven** — `execute.ts:1175–1182`, `execute.test.ts:937` and `:984`
  `importClaudeSettings` pushes every scope's settings-loader diagnostics first,
  then the plan's. `:984` supplies only a settings diagnostic; `:937` produces
  only a plan diagnostic; no case supplies both, so swapping lines 1176–1177 with
  1182 survives. Every other diagnostic list in this suite is order-asserted, so
  this is the one gap in an otherwise strict discipline.
  **Fix:** extend `execute.test.ts:984` — keep the malformed-json settings
  diagnostic and add `enabledPlugins: { "plugin@unknown-mp": true }` so the plan
  also emits `unmappable-marketplace-source`; assert both in
  settings-then-plan order.

- **[WARNING] `pushPluginWarning`'s optional `cause` is unreachable-optional** —
  `execute.ts:237–252` (conditional spread at `:250`)
  All three call sites pass a cause: `recordMarketplaceAddFailure:580`,
  `executeScopedPlan:852–857` (passes `skipped.reason`), and
  `dispatchFailedOutcome:1143`/`:1147`. The `cause !== undefined` false arm is
  therefore unreachable by any input — a production dead branch, not a
  compiler-forced one (nothing about `noUncheckedIndexedAccess` or narrowing
  requires it).
  **Fix:** make the parameter required (`cause: string`), drop the conditional
  spread for a plain `cause`, and make `ImportWarningOutcome.cause` required
  (`execute.ts:99`). This also removes the only reason a reader must check
  whether an import warning can lack a cause.

### `extensions/pi-claude-marketplace/orchestrators/import/types.ts` + `tests/orchestrators/import/types.test.ts`

- **[WARNING] `ImportDiagnosticCode` carries a dead member, and the type test
  props it up** — `types.ts:4`, `types.test.ts:21` and `:128`
  `grep -rn '"malformed-enabled-plugin-ref"' extensions` matches exactly one
  line: the union declaration itself. Nothing produces it — `refs.ts:37` emits
  `"malformed-plugin-ref"` for the malformed case. The only other references in
  the repo are the two lines in `types.test.ts`, which assert it satisfies the
  union and then use it as a fixture code, so the type test is what keeps the
  dead vocabulary looking live. This is category (a) removable dead code, not
  the compiler-forced category the repo records as D-116-01a.
  **Fix:** delete `"malformed-enabled-plugin-ref"` from `types.ts:4`, delete
  `types.test.ts:21`, and change `types.test.ts:128` to
  `code: "malformed-plugin-ref"`.

- **[WARNING] `MarketplaceSourcePlanResult["diagnostics"]` is the one
  `diagnostics` field with no readonly-array negative** — `types.test.ts:343–364`
  The block proves eleven fields are readonly arrays, including
  `MarketplaceSourcePlanResult`'s other two members (`marketplacesToEnsure:350`,
  `unmappableMarketplaces:352`) and every other interface's `diagnostics`
  (`:344`, `:348`, `:360`, `:364`). Dropping `readonly` from `types.ts:79`
  compiles clean and no negative fires.
  **Fix:** add, next to line 352:
  ```ts
  // @ts-expect-error marketplace source plan diagnostics are a readonly array
  void (true satisfies IsMutableArray<MarketplaceSourcePlanResult["diagnostics"]>);
  ```

### `extensions/pi-claude-marketplace/orchestrators/import/refs.ts`

- **[WARNING] `malformedRefDiagnostic` can hard-code `scope: "user"` undetected**
  — `refs.ts:33–41`, `refs.test.ts:239`, `marketplaces.test.ts:9`
  Only two cases in the whole area produce a `malformed-plugin-ref` diagnostic
  (`refs.test.ts:257`, `marketplaces.test.ts:63`), and both run under scope
  `"user"`. `execute.test.ts` never supplies a malformed enabled key at all.
  Replacing the `scope` parameter with the literal `"user"` at `refs.ts:36`
  leaves the entire area green. The sibling `nonBooleanDiagnostic` *is* proven
  for both scopes (`refs.test.ts:189` uses `"project"`, `:254` uses `"user"`).
  **Fix:** change `refs.test.ts:189`'s settings to also carry one malformed key
  (e.g. `malformed: true`) and add the corresponding `malformed-plugin-ref`
  diagnostic with `scope: "project"` to the expected list — this reuses the case
  that already establishes project-scope diagnostics.

### `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts`

- **[WARNING] The official marketplace's hard-coded source precedence over a
  user-declared entry is unproven** — `marketplaces.ts:115–118`,
  `marketplaces.test.ts:518`
  The ternary makes `claude-plugins-official` always resolve to
  `"anthropics/claude-plugins-official"`, ignoring any
  `extraKnownMarketplaces["claude-plugins-official"]` the user's Claude settings
  declare. No case supplies that key, so inverting the ternary to
  `marketplaceSourceFromExtra(...) ?? OFFICIAL_CLAUDE_MARKETPLACE_SOURCE`
  survives every case in the area. This is a user-facing policy (a hand-declared
  override for the official marketplace is silently discarded) with no pin.
  **Fix:** extend `marketplaces.test.ts:518` ("maps the official source and skips
  its duplicate") to pass
  `{ "claude-plugins-official": { github: { repo: "forked/official" } } }` as the
  third argument and keep asserting
  `source: "anthropics/claude-plugins-official"`. Rename the case to say the
  built-in source wins.

- **[WARNING] `buildClaudeImportPlan`'s cross-scope diagnostic aggregation is
  unproven** — `marketplaces.ts:160–168` (`flatMap` at `:166`),
  `marketplaces.test.ts:178`
  Only one case builds a multi-scope plan (`:178`), and both its scopes produce
  empty diagnostics; the only case with non-empty diagnostics (`:9`) has a single
  scope. Mutating the aggregate to `diagnostics: scopes[0]?.diagnostics ?? []`
  survives both. That mutation would silently drop every project-scope
  diagnostic from the top-level list `execute.ts:1182` forwards to the user.
  **Fix:** in `marketplaces.test.ts:178`, give each of the two scope inputs one
  faulty key (`malformed: true` for user, `"not-boolean@x": "true"` for project)
  and assert the aggregate `diagnostics` holds both, user's first.

### `extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts`

- **[WARNING] The module's `@fileoverview` block sits after the imports** —
  `execute.messaging.ts:1–35` (imports `:1–16`, doc block `:18–35`)
  Google style orders a file as copyright JSDoc → `@fileoverview` JSDoc →
  imports → implementation. Two siblings already do it right and are the
  propagation target: `orchestrators/marketplace/add.messaging.ts:1–16` and
  `orchestrators/reconcile/notify.ts:1–25` both open with the header comment.
  **Fix:** move lines 18–35 above line 1 and convert to the sibling's `//` form;
  drop the redundant leading `import/execute.messaging.ts --` self-reference,
  which duplicates the filename.

### `tests/orchestrators/import/execute.messaging.test.ts`

- **[WARNING] The `skipped` render arm never proves it threads `p.scope` into
  the scope bracket** — `execute.messaging.test.ts:145–177`
  (`test('renders a skipped row with a compact hash version')`)
  The only `skipped` case passes `scope: "project"` with `mpScope` `"project"`,
  and `renderScopeBracket` suppresses the bracket whenever the two match
  (`notify.ts:2146–2152`). So rewriting `renderSkipped`
  (`execute.messaging.ts:78–79`) to drop scope — for example
  `pluginRow(ICON_UNINSTALLABLE, { name: p.name, version: p.version, reasons: p.reasons }, mpScope, "(skipped)", probe)`,
  which is a plausible copy from the sibling `unavailable` arm that passes
  `undefined` on purpose — leaves all 8 cases green. The `installed` arm
  (`:86`, `scope: "user"` vs `mpScope: "project"` → `[user]`) and the `failed`
  arm (`:179`, same) both prove it; only `skipped` does not. Import's own
  producer never sets a row `scope` today, so this is a contract-completeness
  gap in a D-11 byte-parity surface rather than a live rendering bug.
  **Fix:** change `execute.messaging.test.ts:150` to `scope: "user"`, update
  `expectedMessage` at `:159`, and change `expectedRow` at `:169` to
  `"⊘ delta-plugin [user] v#2ea95f8 (skipped) {already installed}"`.
  *(Minor, same file: three of the eight cases omit the
  `assert.deepStrictEqual(message, expectedMessage)` input-immutability echo the
  other five carry — `:123`, `:216` (keys only), `:145` has it. Add the echo to
  `:123` and `:216` for consistency, or drop it everywhere; the current split is
  arbitrary.)*

### `tests/orchestrators/import/settings.test.ts`

- **[WARNING] `test('ignores a relative config environment value when resolving
  user paths')` asserts against the developer's real home directory** —
  `settings.test.ts:140–163` (expectation built from `homedir()` at `:155–156`)
  The case does not set `process.env.HOME`, so `os.homedir()` resolves the real
  developer environment, and the expected value is computed by calling the very
  function production calls — the assertion cannot distinguish a correct
  implementation from itself. Its sibling three cases up
  (`settings.test.ts:54`, "resolves default user paths from the private home
  root") does it right: it points `HOME` at a case-owned `mkdtemp` root and
  asserts `path.join(root, ".claude", "settings.json")`.
  **Fix:** give `:140` a `makeTempRoot(t, "import-settings-relative-config-")`,
  set `process.env.HOME = root` alongside the `CLAUDE_CONFIG_DIR` mutation, and
  assert against `path.join(root, ".claude", ...)`. Drop the `homedir` import
  from `:3`.

- **[WARNING] Environment restoration uses `try/finally` where the in-directory
  reference implementation registers `t.after()` before acting** —
  `settings.test.ts:62–69`, `:94–99`, `:121–126`, `:146–151`, `:174–180`,
  `:487–494`, `:544–551`, `:585–590` (8 cases)
  The unit-testing rules name the form: a mutated `process.env` "saves the
  previous value and registers restoration with `t.after()` **before** acting."
  `execute.test.ts:85–111` in the same directory does exactly that for `HOME`
  and `PI_CODING_AGENT_DIR` — the hook is registered at `:92`, the mutation
  happens at `:108`. The `try/finally` form is behaviourally equivalent today
  only because every mutation sits inside the `try`; it stops being equivalent
  the moment a case mutates during arrange.
  **Fix:** extract one helper in `settings.test.ts` mirroring
  `createHermeticScopes`'s hook shape —
  `function setEnvironment(t: TestContext, name: string, value: string | undefined): void`
  that captures with the existing `captureEnvironmentProperty`, registers
  `t.after(() => { restoreEnvironmentProperty(name, captured); })`, then assigns
  — and replace all 8 `try/finally` blocks with calls to it. This also deletes
  the `let paths;` / `let result;` predeclarations the first pass flagged
  separately, because the act phase becomes a plain `const`.

### `extensions/pi-claude-marketplace/orchestrators/import/settings.ts`

- **[WARNING] The user-scope "no `CLAUDE_CONFIG_DIR` set, so no warning" negative
  is never exercised through `loadMergedClaudeSettingsForScope`** —
  `settings.ts:121–131`
  Every case that reaches the guard with `scope === "user"` and
  `options.claudeConfigDir === undefined` sets a *relative* `CLAUDE_CONFIG_DIR`
  (`settings.test.ts:488`), so the warning always fires. Every other user-scope
  case passes an explicit `claudeConfigDir`, short-circuiting at the second
  conjunct (`:261`, `:300`, `:335`, `:360`, `:387`, `:431`, `:546`). Rewriting
  `envDir !== undefined && !path.isAbsolute(envDir)` as
  `!path.isAbsolute(envDir ?? "")` — which emits a spurious
  `invalid-claude-config-dir` diagnostic naming `"undefined"` whenever the
  variable is unset, i.e. for most real users — survives the whole file.
  **Fix:** add one case: temp root, `delete process.env.CLAUDE_CONFIG_DIR`,
  `process.env.HOME = root`, `await loadMergedClaudeSettingsForScope("user", {})`,
  and assert the complete result with `diagnostics: []` and paths under
  `path.join(root, ".claude")`. Mirror the arrange of `:461` minus the relative
  env value.

### Undocumented exported functions (grouped, 4 modules)

- **[WARNING] Every exported *function* in this directory is undocumented while
  the module-private helpers beside them carry doc comments** —
  `refs.ts:10` (`parseEnabledPluginRef`), `refs.ts:53`
  (`extractEnabledPluginRefs`), `marketplaces.ts:98`
  (`planMarketplaceSourcesForRefs`), `marketplaces.ts:160`
  (`buildClaudeImportPlan`), `settings.ts:28` (`resolveClaudeSettingsPaths`),
  `settings.ts:98` (`mergeClaudeSettings`), `settings.ts:114`
  (`loadMergedClaudeSettingsForScope`), `execute.ts:1163`
  (`importClaudeSettings` — the directory's single public entry point)
  The inversion is stark inside one file: `marketplaces.ts` documents the private
  `nestedMarketplaceSource` (`:33–39`) and `marketplaceSourceFromExtra`
  (`:69–75`) with D-76-13 / MURL-07 anchors, then exports two undocumented
  functions. `execute.messaging.ts` is the counter-example to copy — it documents
  both of its exports and every render arm.
  **Fix:** add a one-line third-person JSDoc to each of the eight, starting with
  a verb phrase ("Parses…", "Plans…", "Resolves…", "Imports…"), and carry the
  relevant decision ID where one exists (D-76-13 on
  `planMarketplaceSourcesForRefs`; D-115-01 on `importClaudeSettings`). Do not
  restate parameter types.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `types.ts` | 16 exported types (`ImportDiagnosticCode` … `ClaudeImportPlan`) | `types.test.ts:20–364` | owned (all 16 have a `satisfies` positive and ≥1 `@ts-expect-error` negative) |
| `index.ts` | `importClaudeSettings` | `index.test.ts:63` | owned (same-binding `strictEqual` + closed-surface `Same<ImportRuntimeExport, "importClaudeSettings">`) |
| `index.ts` | `ClaudeImportExecutionResult`, `ImportClaudeSettingsOptions` (type re-exports) | `index.test.ts:19–20` | owned |
| `refs.ts` | `parseEnabledPluginRef` | `refs.test.ts:9–141` (9 cases) | owned |
| `refs.ts` | `extractEnabledPluginRefs` | `refs.test.ts:143–293` (3 cases) | owned |
| `marketplaces.ts` | `planMarketplaceSourcesForRefs` | `marketplaces.test.ts:263–548` (5 cases) | owned |
| `marketplaces.ts` | `buildClaudeImportPlan` | `marketplaces.test.ts:9–261` (4 cases) | owned |
| `settings.ts` | `resolveClaudeSettingsPaths` | `settings.test.ts:54–196` (5 cases) | owned |
| `settings.ts` | `mergeClaudeSettings` | `settings.test.ts:198–254` (2 cases) | owned |
| `settings.ts` | `loadMergedClaudeSettingsForScope` | `settings.test.ts:256–609` (9 cases) | owned |
| `execute.messaging.ts` | `ImportMsg` | `execute.messaging.test.ts:11–30` | owned |
| `execute.messaging.ts` | `IMPORT_CONTEXT` | `execute.messaging.test.ts:32–276` (8 cases) | owned |
| `execute.ts` | `importClaudeSettings` | `execute.test.ts` (35 cases) | owned |
| `execute.ts` | `ClaudeImportExecutionResult` | `execute.test.ts:43`, `edge/types.test.ts:33` | owned |
| `execute.ts` | `ImportClaudeSettingsOptions` | `execute.test.ts:45`, `edge/types.test.ts:34` | owned |
| `execute.ts` | `ImportDeps` | `execute.test.ts:46` | owned |
| `execute.ts` | `MarketplaceAddedOutcome` | — | **UNUSED EXPORT** |
| `execute.ts` | `MarketplaceSkipOutcome` | — | **UNUSED EXPORT** |
| `execute.ts` | `PluginInstalledOutcome` | — | **UNUSED EXPORT** |
| `execute.ts` | `PluginSkipOutcome` | — | **UNUSED EXPORT** |
| `execute.ts` | `ImportWarningOutcome` | — | **UNUSED EXPORT** |
| `execute.ts` | `MarketplaceFailureOutcome` | — | **UNUSED EXPORT** |
| `execute.ts` | `SourceMismatchOutcome` | — | **UNUSED EXPORT** |
| `execute.ts` | `UnexpectedPluginFailureOutcome` | — | **UNUSED EXPORT** |

Method for the eight unused rows: `grep -rn '\b<Name>\b' extensions tests` with
`orchestrators/import/execute.ts` excluded returns zero hits for six of them; the
hits for `PluginInstalledOutcome` and `SourceMismatchOutcome` all resolve to
`orchestrators/reconcile/apply-outcomes.ts`'s **same-named, different** types.
`execute.test.ts` reaches every one of them structurally, via indexed access on
`ClaudeImportExecutionResult` (`:248–255`), never by name. See the UNDERSTATED
grading of the first pass's doc-comment finding below.

## Branch census

**(a) Reachable and untested** — each already has a finding above:
`refs.ts:33` project-scope malformed diagnostic · `marketplaces.ts:116` official
source precedence · `marketplaces.ts:166` multi-scope aggregation ·
`settings.ts:123` env-absent negative · `execute.ts:742` `||=` accumulation ·
`execute.ts:1176/1182` diagnostic source order ·
`execute.messaging.ts:78` skipped-arm scope threading.

Two further reachable-untested branches judged too low-value for their own
finding, recorded so a fixing pass does not rediscover them:

- `execute.ts:1084` and `:1091` — the second conjunct of
  `mergeEnsureAndRepairs`'s guards (`marketplaces[name] === undefined` /
  `plugins[key] === undefined`). Reachable only when the same marketplace lands
  in both `ensure` and `repair` for one scope, which needs two same-scope plans
  where plan 1 adds and plan 2 skips. `execute.test.ts:2064` and `:2117` set up
  duplicate `["project", "project"]` plans but never that combination.
- `importClaudeSettings` with `selectedScopes: []` — no case; the `(no
  marketplaces)` render is proven instead through `:937` and `:984`, which have a
  scope but no marketplace.

**(b) Unreachable by real input — production dead code:**

- `execute.ts:250` — `pushPluginWarning`'s `cause !== undefined` false arm; all
  three call sites pass a cause. Finding filed above.
- `execute.messaging.ts:99` — `renderScopeBracket(undefined, mpScope)` in the
  `unavailable` arm is a constant `""`; removing the token from the `joinTokens`
  list is behaviour-preserving. This is **not** removable in practice: it is the
  SNM-11 carve-out marker that keeps the arm byte-shaped like the central
  `renderPluginRow` arm under D-11, and the impossibility is already proved at
  the type level by `execute.messaging.test.ts:25`
  (`@ts-expect-error unavailable import rows never carry a plugin scope`). Leave
  it.

**(c) Compiler-forced and not removable (D-116-01a):**

- `refs.ts:19–20` — `plugin === undefined || marketplace === undefined` after
  `const [plugin, marketplace] = parts` guarded by `parts.length !== 2`.
  `noUncheckedIndexedAccess` types the destructured elements as
  `string | undefined`, and neither `!` nor `as` is available in `extensions/`.
  Not a finding, not coverable.

**Untested but deliberate, not branches:** the three `Object.freeze` calls
(`execute.ts:372`, `:508`, `:536`) are labelled "defense-in-depth" and no case
asserts frozen-ness. Removing them survives the suite. Left alone — asserting
`Object.isFrozen` on a returned notification payload would be testing the
convention, not the behaviour.

## Grading of first-pass findings

### `tests/orchestrators/import/execute.test.ts`

- **CONFIRMED** — *Hand-rolled recorder arrays stand in for `strong-mock`* —
  real, WARNING is the right severity, and two corrections a fixing pass needs.
  (1) The unit-testing rules **sanction** a shared-log recorder when order is the
  promise ("each promised method is replaced by a recorder pushing into one
  shared log, the whole log is compared, and every mock is still verified"), so
  for the five order cases (`:699`, `:1060`, `:1145`, `:1234`, `:1636`) the
  missing piece is only the `mock<T>({ exactParams: true })` wrapper plus
  `verify()`, not the log. (2) The recorder assertions are **not weak** —
  `assert.deepStrictEqual` from `node:assert/strict` compares own-key sets and
  rejects an extra key holding `undefined` (verified on Node 26.8.1), so
  `:1558`'s comparison really does prove `applyDefaultEnabled` is absent and
  really does guard D-102-03. A conversion that loses that key-absence property
  would be a regression. The two option-shape cases (`:455`, `:1528`) are the
  clean violations: the same file already builds
  `mock<InstallPlugin>({ exactParams: true, name: "install plugin" })` at `:389`,
  so this is drift inside one file with the target 70 lines up.

### `tests/orchestrators/import/refs.test.ts`

- **REFUTED** — *`assert.deepEqual` used instead of `assert.deepStrictEqual`* —
  the stated rationale is factually wrong. The file imports
  `node:assert/strict` (`refs.test.ts:1`), where `deepEqual` **is**
  `deepStrictEqual`: `require("node:assert/strict").deepEqual === .deepStrictEqual`
  returns `true`, and `deepEqual({a:1},{a:"1"})` throws. There is no coercion to
  hide. The form is also the repo-wide majority — 490 `assert.deepEqual(` call
  sites across `tests/`, including `tests/architecture/**` and
  `tests/orchestrators/marketplace/*.messaging.test.ts`. Residual: an optional
  in-area consistency edit, worth nothing on its own. Do not spend a pass on it.
- **CONFIRMED** — *Placeholder variable name `result`* — the rules name `result`
  explicitly, and the in-area target already exists: `execute.test.ts` binds
  `importResult` (`:423`, `:570`, …). Rename to `parsed` / `extracted` as the
  first pass says.

### `tests/orchestrators/import/marketplaces.test.ts`

- **CONFIRMED** — *Placeholder variable name `result`* — 9 sites, same rule, same
  in-area target.

### `tests/orchestrators/import/settings.test.ts`

- **CONFIRMED** — *Placeholder variable name `result`* — 9 sites. Note the fix
  folds into the `t.after()` restructuring finding above: replacing `try/finally`
  with a hook removes the `let result;` predeclarations at `:484`, `:541`, `:582`
  as a side effect, so sequence that finding first.
- **OVERSTATED** — *An assertion runs inside the "arrange" phase* — real
  observation, wrong weight; this is a nit, not a WARNING. The inline
  `assert.deepStrictEqual({ code, syscall }, { code: "EISDIR", syscall: "read" })`
  at `:477–480` is a fixture-validity guard carrying a five-line comment
  (`:470–474`) that states exactly why it is there: without it a fixture that
  drifted to a missing file would report ENOENT on both sides and leave the case
  green against a different failure. The rules allow a setup comment when setup
  is not obvious, and the guard is doing the load-bearing work. The stronger
  objection I considered and rejected — that `readFailure` is an expected value
  asked of the same boundary production calls — is answered by that comment: the
  errno *wording* is runtime-owned and version-varying, and the failure's
  *identity* is pinned independently. Take the first pass's own second option (a
  one-line phase note) and stop.

### `tests/orchestrators/import/index.test.ts`

- **CONFIRMED** — *Unnecessary `describe()` nesting for a single runtime
  re-export* — the barrel's runtime surface is proved to be exactly one binding
  at `:21`, so the `describe()` groups nothing. Flatten as described.

### `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`

- **CONFIRMED** — *Needlessly long relative import paths* — `:2`, `:6`, `:36`,
  `:37` climb to the extension root and back into `orchestrators/`. Shorten to
  `../marketplace/add.ts`, `../plugin/install.ts`, `../types.ts`. Note for the
  executor: this moves the specifiers between `import-x/order` alphabetization
  positions, so the import block needs reordering in the same edit.
- **CONFIRMED** — *The deliberate omission of `applyDefaultEnabled` carries no
  traceability comment at its call site* — `:691–699`. The absence is
  load-bearing and the contrast is one file away: `orchestrators/reconcile/apply.ts:405`
  passes `applyDefaultEnabled: true` and `edge/handlers/plugin/install.ts:95`
  does too, each with a D-102-03 comment; import is the only caller that
  deliberately omits it and the only one with no comment saying so.
- **UNDERSTATED** — *Several exported outcome interfaces carry no doc comment* —
  the missing doc comment is the symptom; the defect is that **all eight**
  outcome interfaces are unused exports, which the Google-style rule "every
  export is used outside its module" makes a finding on its own. See the census
  above for the grep evidence. Adding doc comments would document a public
  surface that should not be public. Correct fix: drop `export` from
  `MarketplaceAddedOutcome`, `MarketplaceSkipOutcome`, `PluginInstalledOutcome`,
  `PluginSkipOutcome`, `ImportWarningOutcome`, `MarketplaceFailureOutcome`,
  `SourceMismatchOutcome`, and `UnexpectedPluginFailureOutcome` (`:50–128`) —
  they stay reachable structurally through the exported
  `ClaudeImportExecutionResult`, which is how `execute.test.ts:248–255` already
  reaches them — then document `ClaudeImportExecutionResult`'s buckets in one
  place. Severity stays WARNING but the instruction changes completely.

### `extensions/pi-claude-marketplace/orchestrators/import/settings.ts`

- **UNDERSTATED** — *`resolveClaudeSettingsPaths` reads `process.env.CLAUDE_CONFIG_DIR`
  and `os.homedir()` directly* — **propose BLOCKER.** The unit-testing rules
  classify a hidden dependency (a `process.env` read inside logic) as a design
  finding, and the cost here is measurable rather than theoretical: **8 of the 16
  cases** in `settings.test.ts` mutate the real `process.env`
  (`:62`, `:94`, `:121`, `:146`, `:174`, `:487`, `:544`, `:585`), and one
  (`:140`) reads the developer's real `os.homedir()` to build its expected value.
  That is shared-global-state mutation and developer-environment dependence in a
  module whose whole job is path resolution — the two branches that cannot be
  reached any other way are the *default* branches, i.e. the ones every real user
  takes. The first pass's "Consider making…" phrasing understates a change that
  removes a third of the file's hermeticity risk. Named sanctioned fix: make the
  lookup a dependencies-object member —
  `resolveClaudeSettingsPaths(scope, options, env: { get(name: string): string | undefined; homedir(): string } = SYSTEM_ENV)`
  with `SYSTEM_ENV` wired once at the composition root — then every branch is
  reachable with a literal and no case touches `process.env`. Sequence this with
  META-FINDINGS item 4 (edge-handler injection seams); it is the same class.
- **CONFIRMED** — *Unchecked type assertion on a caught value* — `:61`. Two
  smaller points to fold into the same edit: both catches read `catch (err)`
  rather than the guide's `catch (error: unknown)` form (`:60`, `:82`), and the
  binding is `err` rather than `error`. Narrow with
  `err instanceof Error && "code" in err && err.code === "ENOENT"` or add the
  one-line comment naming `fs/promises` as an API known to throw errno-shaped
  errors.

## Still clean after attack

- `tests/orchestrators/import/execute.test.ts` — the strongest test module I read
  in this area, and the mutations it genuinely catches are worth recording so
  nobody re-probes them. **Caught:** dropping the `.sort(compareByNameThenScope)`
  at `execute.ts:510` (`:1676` asserts project-before-user against insertion
  order user-then-project); any of the three `blockToMarketplaceMessage` status
  arms returning the wrong token (`added`/`updated`/`failed` all asserted as
  rendered header bytes); swapping `renderInstalled`'s soft-dep predicates (all
  four `declaresAgents`×`declaresMcp` combinations are separate cases at
  `:1295–1355` with distinct marker braces); a second `ctx.ui.notify` emission
  anywhere (`createNotificationBoundary(1, 2)` installs `times(1)` and fails at
  the call site, which is the IL-2 sizing proof); dropping the
  `blockedMarketplaces` gate (`:699` asserts the exact call log); returning early
  from `executeScopedPlan` before the batched post-pass (`:1717`, `:1754`,
  `:1795` assert the exact config bytes *and* the completed-rename count);
  per-entry config writes instead of one batched write (`countAtomicWrites` at
  `:1703` counts `fs.rename` into the target and `:1791` pins it to exactly 1 —
  an mtime comparison could not discriminate this); the `?? []` on
  `postCommitWarnings` becoming a throw; and any of the seven
  `dispatchFailedOutcome` routes landing in the wrong bucket. `createOfflineGitOps`
  (`:126`) is the "fail loudly on unplanned input" pattern META-FINDINGS asks to
  propagate, already adopted here with an empty allow-list. `countAtomicWrites`
  is a correctly-formed spy: `t.mock.method(obj, "name")` with no replacement,
  auto-restored, used only because the observation is the promise.
- `tests/orchestrators/import/index.test.ts` — beyond the `describe()` nit this
  is a model barrel test. **Caught:** re-exporting the binding by value instead
  of by reference (`assert.strictEqual` at `:71`); adding any runtime re-export
  (`Same<ImportRuntimeExport, "importClaudeSettings">` at `:21` is total over
  `keyof typeof importBarrel`); re-adding any of the seven forbidden runtime
  members or the `EnabledPluginRef` type (each `@ts-expect-error` becomes unused
  and breaks `npm run typecheck`, which the comment at `:39–41` states
  explicitly). The suppression-consumption argument is correct and is the
  strongest form of this gate I have seen in the repo.
- `tests/orchestrators/import/types.test.ts` — correct type-only pairing: zero
  runtime cases, `satisfies` positives for all 16 exported types,
  `@ts-expect-error` negatives for missing required fields, closed-vocabulary
  violations, the unsupported `local` scope, `exactOptionalPropertyTypes`
  explicit-`undefined` rejection, and discriminated-union cross-arm leakage in
  both directions (`:301–312`). The two findings above are additions to a sound
  file, not a rewrite.
- `extensions/pi-claude-marketplace/orchestrators/import/index.ts` — genuinely
  clean. Two named re-exports, correct `export type` discipline, a D-115-01
  comment that describes what the module does rather than what it replaced.
- `extensions/pi-claude-marketplace/orchestrators/import/refs.ts` and
  `marketplaces.ts` — apart from the two scope/precedence gaps above, these
  survive attack. **Caught:** swapping `plugin` and `marketplace` in the parsed
  ref; returning `trimmed` instead of `raw`; relaxing `parts.length !== 2` to
  `< 2` (`refs.test.ts:73`); every wrong `ImportDiagnosticCode` token, including
  the near-miss `"malformed-enabled-plugin-ref"`, and every wrong `severity`
  (whole-value comparison against hand-written literals throughout); swapping the
  `#ref` and `@ref` suffix separators between the `url` and `github` nested
  shapes (`marketplaces.test.ts:499` vs `:505`); dropping `directory`'s
  precedence over `github` (`:435–437` declares both and asserts `directory`
  wins); deduping on the wrong key (`:518`); and reordering
  `unmappableMarketplaces` (`:328`, `:416`). The diagnostic-vs-plan ordering
  within one scope is pinned at `marketplaces.test.ts:63–88`.
- `extensions/pi-claude-marketplace/orchestrators/import/types.ts` — apart from
  the one dead union member, clean: interfaces not type aliases, `readonly`
  throughout, optional fields as `name?:` rather than `| undefined`, no
  unlabeled index signatures.

## Not covered

- I did not execute anything against the repo tree: no `node --test`, no
  `npm run test:coverage:direct`, no `npm run check`, per the brief. The only
  code I ran was a throwaway `node -e` in `/tmp` to settle the
  `node:assert/strict` `deepEqual` question and the `deepStrictEqual`
  extra-`undefined`-key question. Every coverage and branch claim above is from
  reading, and the two "surviving mutation" claims that depend on execution
  order (`settingsSequence` / `stateSequence` positional answering under
  `Promise.all` at `execute.ts:1168`) I reasoned about rather than measured.
- I read `shared/notify.ts` only around the row primitives it exports to this
  area (`:1737–1739`, `:2043–2343`). The central `emitContextCascade` /
  `renderMpHeader` path that turns `IMPORT_CONTEXT` rows into the asserted
  notification strings is owned elsewhere and I took its behaviour from the
  strings `execute.test.ts` already pins.
- `tests/platform/git-ops-fake.ts` and `tests/edge/notification-boundary.ts` are
  consumed by this area but owned by other areas; I read them to judge the
  consumption, not to review them. `notification-boundary.ts` is materially
  relevant to META-FINDINGS item 1 — see below.
- The `no-orchestrator-network` architectural gate does not name
  `orchestrators/import/execute.ts`, which imports `orchestrators/marketplace/add.ts`
  and therefore has a git-reachable transitive closure. Whether import belongs
  under NFR-5 is a scope question for the architecture-gates area, not this one;
  I note it without filing it.

## Meta-findings impact

### New cross-cutting evidence

**1. The `void`-switch silent-omission class has a third instance, and it is not
in the two files META-FINDINGS names.** Item 5 lists
`orchestrators/reconcile/plan.ts` and `apply.ts` (BLOCKER) plus two `.messaging.ts`
files (WARNING). `orchestrators/import/execute.ts:592–658` is a fourth, and it is
the most instructive one because the same file, 40 lines later
(`:669–683`, `:713–722`), documents the exact hazard and applies the exact fix by
inventing a named return-bucket type. **The generalisable rule is sharper than
"add a `default` arm":** in this codebase a `default: assertNever(x)` on a
provably-closed union is itself dead code, so the house pattern is a
*value-returning signature* that makes a missing arm TS2366. Recommend the
consolidation restate item 5 in those terms and re-scan for the specific shape —
`function f(...): void { switch (x) { ... } }` with no `default` — rather than
for missing `default` arms generally. The two callers of
`SamePlannedSourceResult` are `import/execute.ts` and `reconcile/plan.ts`; both
now have a finding, from two independent reviewers, on the same union. That
union (`domain/source.ts:569`) is worth treating as one ticket.

**2. Unused exports are a defect class nobody is scanning for.** Eight of
`execute.ts`'s twelve exports have zero importers anywhere in `extensions/` or
`tests/` (census above). `fallow dead-code` does not flag them because each is
referenced *within* its own module by the exported `ClaudeImportExecutionResult`.
The Google-style rule "every export is used outside its module" is therefore
unenforced by any gate. Areas most likely to carry the same shape: any module
that exports a discriminated-union member type alongside the aggregate that
contains it — `orchestrators/reconcile/apply-outcomes.ts` (which exports
same-named `PluginInstalledOutcome` / `SourceMismatchOutcome` types) and
`orchestrators/types.ts` are the obvious first checks. A one-line grep per
exported name settles each.

**3. Dead vocabulary in a closed union, entrenched by its own type test.**
`ImportDiagnosticCode` carries `"malformed-enabled-plugin-ref"` with no producer,
and `types.test.ts` asserts it satisfies the union and uses it as a fixture — so
the type test makes the dead member *look* exercised. This is the mirror image of
the "doc comments that lie" shape META-FINDINGS already records. **Every
type-only pairing in the repo is a candidate**: a `satisfies` positive proves a
literal is assignable, never that production ever produces it. Recommend the
consolidation add a check to the type-only-module pattern — for each member of a
closed string union, grep `extensions/` for a producer; a member with only the
declaration and the type test is dead. `shared/notify-reasons.ts`'s `Reason` set
and `MarketplaceStatus` are the highest-value places to run it.

**4. Environment restoration: two forms in one directory, and the repo has not
picked one.** `execute.test.ts:85–111` registers `t.after()` before mutating —
the form the rules name. `settings.test.ts` uses `try/finally` in 8 cases. Both
are in `tests/orchestrators/import/`. Since `process.env` mutation appears
wherever a module reads the environment, the same split almost certainly exists
in the areas covering `persistence/locations.ts` (`PI_CODING_AGENT_DIR`) and
`platform/git-credential.ts` (`GIT_TERMINAL_PROMPT`, `GCM_INTERACTIVE`). Worth
one repo-wide sweep with `createHermeticScopes` as the named target.

### Corrections to META-FINDINGS.md

**Item 1, "Narrow the over-wide context parameters", states a cause that is
false.** The claim: *"Because no test can construct a full SDK object, every
caller fakes one and forces it past the compiler. 178 `as never` casts in
`tests/shared/notify.test.ts` alone."*

`tests/edge/notification-boundary.ts:96–98` constructs both offending types with
zero casts:

```ts
const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "extension context" });
const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
```

`tests/orchestrators/import/execute.test.ts` consumes that boundary across all 35
cases, passes the resulting `ctx`/`pi` straight into the orchestrator and on into
`installPlugin`/`addMarketplace` options, compares them with
`assert.deepStrictEqual`, and contains **zero** `as never`, `as any`, or
`as unknown as` (`grep -rn "as never\|as any\|as unknown as" tests/orchestrators/import/`
→ no matches across 4,617 lines). So a test *can* construct a full SDK object;
`strong-mock`'s `mock<T>()` does it.

What actually produces the 187 casts in `tests/shared/notify.test.ts` (my count,
`grep -c "as never"`, vs. the 178 recorded) is a **hand-rolled object literal**
where a `mock<T>()` belongs — the file builds `{ getAllTools: () => [...] }`
literals at `:64–87` and forces each past the compiler at every call site
(`:131`, `:165`, `:200`, …).

**Correction, and it changes the plan:** narrowing `notify()`'s parameters is
still worth doing on its own merits (a narrow parameter is a narrower promise),
but it is not the prerequisite for deleting the cast cluster and may not be the
cheapest route. Propagating `tests/edge/notification-boundary.ts` into
`tests/shared/notify.test.ts` could dissolve all 187 casts with **no production
change at all**, and would additionally give that file the `times()`-based
emission sizing it currently lacks. Recommend the consolidation split item 1 into
two tickets — (a) propagate the boundary factory, test-only, unblocked today;
(b) narrow the parameters, production, still worthwhile — and stop describing
(b) as the only thing that dissolves (a). This also affects the "Suggested
sequencing" list, where step 4 ("Narrow the context parameters… unblocks strict
mocking everywhere") is stated as a blocker for step 7; on this evidence it is
not.

**Item "Patterns to propagate", row "Strict interaction mocking".** The row
credits `tests/orchestrators/**` top level. Within this area that credit is only
partly earned: `execute.test.ts` builds one correct `strong-mock`
(`:389`) and then hand-rolls seven recorders for the same two collaborators. The
row should name `tests/edge/notification-boundary.ts` as the reference instead —
it is the file that actually demonstrates `exactParams: true`, exact `times()`
counts, the documented reason a zero is written as an *absent* expectation rather
than `times(0)`, and a single `verifyBoundary()` shared by four suites.

### Confirmations

- **"Clean verdicts are not reliable"** — independently confirmed at a rate worth
  recording. Five of the seven files the first pass declared clean in this area
  carry at least one surviving mutation, including the one BLOCKER, and two of
  the seven survive attack essentially intact (`index.ts`, and `execute.test.ts`
  which was not on the clean list but had only one grouped WARNING). The finding
  side held up much better: 8 of 12 CONFIRMED, only 1 REFUTED.
- **"The dominant shape: sibling drift"** — confirmed four more times, each with
  the correct sibling named and each *inside* the area rather than across areas:
  `settings.test.ts` `try/finally` vs `execute.test.ts:92`'s `t.after()`;
  `settings.test.ts:140`'s real `homedir()` vs `:54`'s controlled `HOME`;
  `execute.test.ts`'s seven recorders vs its own `mock<InstallPlugin>` at `:389`;
  `execute.messaging.ts`'s post-import header vs `add.messaging.ts:1`'s
  pre-import header. A partitioned pass could see three of these four and still
  miss them, which suggests the shape is under-reported rather than
  over-reported.
- **"Per-area severity is not globally calibrated"** — confirmed from the other
  direction. This area's first pass concluded "nothing found rises to a
  BLOCKER" while recording a real `void`-switch omission nowhere in its notes; a
  reviewer who had also seen `reconcile/plan.ts` would have recognised the shape
  immediately. Severity was not the problem here — *pattern recognition across
  the partition* was.
- **"Offline fake that fails loudly on unplanned input"** — confirmed as already
  propagated beyond `tests/orchestrators/plugin/fetch.test.ts`:
  `execute.test.ts:126` builds `createGitOpsFake({ allowedRemoteUrls: [], boundary: "memory" })`
  with a deliberately empty allow-list and a comment stating why, and the
  `collaborators()` factory at `:222–232` applies the same principle to the four
  injected dependencies (unpromised calls reject with a message naming the
  argument). Both are worth citing in the patterns table.
- **"Direct per-pair coverage was never measured"** — reconfirmed and sharpened.
  `execute.ts:742`'s `||=` is a case where V8 branch coverage would report both
  arms hit while the mutation survives, so a green direct-coverage run on this
  pair would *not* have found it. Coverage measurement is still outstanding and
  still worth doing, but it should not be treated as a substitute for the
  mutation questions.
