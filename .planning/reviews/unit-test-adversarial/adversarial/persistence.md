# Persistence — state, config, agents index, migrations — adversarial re-review

**Scope:** all 9 production modules under `extensions/pi-claude-marketplace/persistence/`
and all 9 test modules under `tests/persistence/` (plus `fixtures/`), read in full.
Cross-checked against `tests/architecture/{compat-01-no-expansion,hooks-foundation,config-state-write-seams}.test.ts`,
`shared/atomic-json.ts`, `domain/name.ts`.
**First-pass file:** `unit-test-findings/persistence.md`
**Clean files attacked:** 12 (4 test modules + 8 production modules)
**Existing findings graded:** 8

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 7 |
| New WARNING (missed by first pass) | 14 |
| Existing CONFIRMED | 7 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's picture of this area is directionally right — the files are
genuinely strong on byte-exact assertions, per-case `mkdtemp` + `t.after()`,
one-`test()`-per-row loops, and prototype-key hardening. But its `### Clean files`
list did not hold: **all four "clean" test modules and two "clean" production
modules carry surviving mutations**, and three of them are on documented,
spec-ID-bearing contracts (D-11, ST-4, NFR-10) that no case pins.

## New findings — from the clean lists

### `tests/persistence/config-write-back.test.ts`

- **[BLOCKER] The D-11 `schemaVersion: 1` write-time pin is unproven for all five
  helpers** — `lines 33, 85, 118, 154, 176, 208, 256, 318, 360, 395, 500, 547, 593, 638`
  Deleting the `schemaVersion: 1,` line from every `patched` literal in
  `config-write-back.ts` (lines 70, 104, 129, 153, 204) leaves **all 13 cases in
  this file green.** Every `current` input in the file already carries
  `schemaVersion: 1`, so `{ ...current }` reproduces it and the pin never does any
  work in any case. The module header calls this out as a load-bearing contract
  ("schemaVersion is pinned to `1` on every write (D-11)"), and the real-world
  input is a user-hand-edited `claude-plugins.json` that may legitimately omit the
  optional field (`CONFIG_SCHEMA` declares it `Type.Optional`, `config-io.ts:72`;
  `loadConfig` accepts `{}` — proven at `config-io.test.ts:172`).
  Fix: add one case per helper (or minimally for `writeMarketplaceConfigEntry` and
  `writeBatchedConfigEntries`) whose `current` is `{}` or
  `{ marketplaces: { tools: { source: "acme/tools" } } }` with **no**
  `schemaVersion`, and assert the full expected bytes — which must contain
  `"schemaVersion": 1` after the spread keys.
- **[WARNING] No case asserts the input `ScopeConfig` is left unmodified** —
  `lines 72, 163, 347, 422, 532` (every `// act`)
  All five helpers promise entry-level *patching* over a caller-owned config, and
  all five are non-mutating today. Mutating one — e.g. `current.marketplaces[marketplace] = merged`
  before building `patched` in `config-write-back.ts:67` — leaves every case green,
  because no case reads `current` after the act. `tests/persistence/migrate.test.ts`
  is the in-repo reference that gets this right: it asserts the post-call state of
  the input object at lines 101, 192, 276, 363, 452, 489, 537, 586.
  Fix: after each act, add `assert.deepStrictEqual(current, currentLiteral)`
  (the `currentLiteral` bindings at lines 32/317/499/546 already exist for exactly
  this shape; the cases that only have `current` need the literal split out).
- **[WARNING] `deletePluginConfigEntry` lacks the absent-map case its cascade
  sibling has** — `test('deletes exactly one flat plugin key')`, `line 389`
  `deleteMarketplaceConfigEntryWithCascade` has
  `test('writes empty maps when both persisted maps are absent')` (`line 149`)
  covering `current.plugins === undefined`. `deletePluginConfigEntry` has one case
  only, with `plugins` populated, so the `{ ...current.plugins }` spread-of-
  `undefined` path (`config-write-back.ts:147`) is never run.
  Fix: add a sibling case with `current = { schemaVersion: 1, marketplaces: { tools: { source: "acme/tools" } } }`
  asserting the written bytes carry `"plugins": {}`.

### `tests/persistence/migrate-config.test.ts`

- **[BLOCKER] `entryCount`'s plugin term is never exercised** — `line 293`
  (`test('writes exact first-run bytes and replays as a byte-identical no-op')`)
  Mutating `migrate-config.ts:197` from
  `Object.keys(config.marketplaces).length + Object.keys(config.plugins).length`
  to `Object.keys(config.marketplaces).length` leaves every case green: this is the
  **only** `migrated: true` case in the file and its `populatedState()` fixture
  (`line 45`) has `plugins: {}`. `entryCount` is a returned contract field
  consumers narrow on, and the file already owns a state with two plugins
  (`pathMarketplace`, `line 127`) that is never fed through `migrateFirstRunConfig`.
  Fix: add a `migrated: true` case whose state is one marketplace with two plugins
  and assert `{ migrated: true, entryCount: 3, filePath: locations.configJsonPath }`
  plus the exact bytes.
- **[WARNING] `{ ...locations, configJsonPath: escapedConfigPath }` proves the
  `ScopedLocations` brand does not do what its doc comment claims** — `line 325`
  `persistence/locations.ts:29-31` states a "hand-crafted object literal that mixes
  scopes … cannot type-check." This line spreads a real bundle, overrides one
  derived path, and type-checks cleanly — because the spread carries the brand
  symbol forward. The brand stops a *from-scratch* literal only. This is not a
  defect in this case (the escape it builds is the point), but it qualifies the
  first-pass BLOCKER on `locations.test.ts`: the `@ts-expect-error` negative that
  finding asks for is still correct and still worth adding, and a second negative
  should pin the spread hole or the doc comment should be narrowed to
  "an object literal built without a `locationsFor` result".

### `tests/persistence/migrate.test.ts`

- **[BLOCKER] `manifestPath` and `marketplaceRoot` are never filled independently** —
  no case; `ensureMarketplacePaths` at `migrate.ts:47-70`
  Every case in the file supplies **both** legacy path fields or **neither**:
  neither at `line 20`, both at `lines 112, 201, 427, 461, 498, 546, 373`. Merging
  the two `if` blocks in `ensureMarketplacePaths` — filling `marketplaceRoot` only
  when `manifestPath` is also absent, or swapping which field each block writes —
  survives all 14 cases. A v1 record with `marketplaceRoot` present and
  `manifestPath` missing would then load unfilled and be rejected by
  `STATE_VALIDATOR` with a confusing message. `tests/persistence/fixtures/legacy/v1-missing-manifestpath.json`
  is *exactly* this shape and is unreferenced (see the fixtures finding below).
  Fix: add two sibling cases — one marketplace with `manifestPath` present and
  `marketplaceRoot` absent, one the reverse — each asserting the whole
  `MigrationResult` with `mutated: true`.
- **[BLOCKER] Cross-marketplace `mutated` accumulation is never exercised** —
  no case; `migrate.ts:234-254`
  `mutated` is a loop-level accumulator across marketplaces, but no case has two
  marketplaces where one mutates and the other does not (the only multi-marketplace
  case, `line 369`, has three already-normalized rows). Moving
  `let mutated = false` inside the `for` loop survives every case, and the
  real-world effect is that a state file whose *last* marketplace is already
  normalized never gets persisted — the migration silently re-runs on every load.
  Fix: add one case with two marketplaces, the first legacy (no `manifestPath`) and
  the second normalized, asserting `mutated: true` and both rows in the result.
- **[WARNING] The three-arm object guard is covered only on its `typeof` arm in 3
  of its 4 instances** — `migrate.ts:102, 108, 163, 169, 238`
  `typeof X !== "object" || X === null || Array.isArray(X)` appears for the
  marketplace row (`:238`), the plugins map (`:102`, `:163`), and the plugin row
  (`:108`, `:169`). Only the marketplace row's `typeof` arm (`"not-a-marketplace"`,
  `line 351`), the plugins-map `typeof` arm (`"not-a-plugin-map"`, `line 468`), and
  the plugin-row `typeof` arm (`"not-a-plugin"`, `line 431`) are covered. Deleting
  `|| mpRaw === null` from `:238` makes `{ broken: null }` reach
  `ensureMarketplacePaths(mpName, null, …)` and throw a `TypeError` out of a
  function documented as never throwing — undetected. `plugins: null` and
  `plugins: []` are likewise untested. All are reachable: `state.json` is a
  hand-editable file and this function's own contract is to normalize arbitrary
  parsed JSON.
  Fix: extend the two existing data-driven loops (`lines 283`, `312`) with rows for
  `marketplaces: { broken: null }`, `marketplaces: { broken: [] }`,
  `plugins: null`, `plugins: []`, and `plugins: { broken: null }`, each asserting
  the whole `MigrationResult`.

### `tests/persistence/agents-index-schema.test.ts`

- **[BLOCKER] Required-vs-optional is proven for only 1 of 7 required string
  fields, and the string arrays' element type is never proven** —
  `lines 99-276` (the 11-row rejection loop)
  Ten of the eleven rows swap a *type* (`42` for a string, a string for an array);
  only one row (`line 146`) omits a field. Changing `plugin`, `marketplace`,
  `sourceAgent`, `sourcePath`, `targetPath`, or `sourceHash` to
  `Type.Optional(Type.String())` in `agents-index-schema.ts:27-33` leaves all cases
  green — a corrupt row missing any of those six would then be *accepted* by
  `loadAgentsIndex`'s per-row gate and flow into the agents bridge. Separately, no
  row puts a non-string *inside* `droppedFields` / `droppedTools` / `warnings`, so
  relaxing `Type.Array(Type.String())` to `Type.Array(Type.Unknown())` also
  survives.
  Fix: add six absence rows (one per remaining required field, mirroring the
  `line 146` row) and three element-type rows (`droppedFields: [42]`,
  `droppedTools: [42]`, `warnings: [42]`) to the same loop.
- **[WARNING] The envelope's required-ness is never proven** — `lines 279-407`
  No case omits `schemaVersion` or omits `agents`. Making either
  `Type.Optional(...)` in `AGENTS_INDEX_SCHEMA` (`agents-index-schema.ts:48-51`)
  survives every case. Note `tests/persistence/fixtures/agents-index/file-level-corruption.json`
  is literally `{"agents": []}` — the missing case, sitting unused on disk.
  Fix: add `test('rejects an envelope without a schema version')` with
  `{ agents: [] }` and `test('rejects an envelope without the agents field')` with
  `{ schemaVersion: 1 }`.
- **[WARNING] Pointless rename aliases in `// arrange`** — `lines 268, 362`
  (`const rejectedEntry = invalidEntry;`, `const rejectedIndex = malformedIndex;`);
  same shape at `state-io.test.ts:224` (`const storedState = state;`). These add a
  binding with no production role. Fix: delete the alias and pass the loop variable
  directly.

### `tests/persistence/state-io.test.ts` *(first pass listed one WARNING; these are additional)*

- **[BLOCKER] `clonePluginRecord`'s non-aliasing is proven for only 3 of 9 nested
  containers** — `lines 131-137`
  The case asserts `notStrictEqual` for `hookEntries`, `hookEntries[0]`,
  `compatibility`, `compatibility.notes`, `resources`, `resources.skills` — and
  nothing else. Replacing any of `compatibility.supported`,
  `compatibility.unsupported`, `resources.prompts`, `resources.agents`,
  `resources.mcpServers`, `resources.hooks` in `state-io.ts:161-174` with a bare
  reference (`prompts: record.resources.prompts`) survives. The module's own doc
  comment (`state-io.ts:143-145`) names this as the exact hazard the enumeration
  exists to prevent, and `reinstall.ts:923` is the live consumer that depends on it.
  Fix: replace the six `notStrictEqual` lines with a mutate-and-recheck: after
  cloning, push a sentinel into every array on `record`
  (`record.resources.prompts.push("mutated")`, … for all eight arrays, plus
  `record.hookEntries[0].event = "mutated"`), then
  `assert.deepStrictEqual(clonedRecord, expectedRecord)` again. One assertion
  covers every container and cannot drift as fields are added.
- **[WARNING] No deterministic proof that a non-mutating load performs no write** —
  `test('normalizes a complete version-2 document and preserves its stamp')`,
  `line 375`
  `loadState` fires `persistMigratedState` forget-fully (`state-io.ts:473`), so the
  byte comparison at `line 375` runs before any write could land. Flipping
  `if (mutated)` to an unconditional persist would leave this case green (or
  flakily green), even though it would rewrite every `state.json` on every load.
  The two positive proofs in this file use an `fs.watch` handshake (`lines 487-503`,
  `1041-1057`); the negative has no equivalent. Fix (production): make the persist
  an injected collaborator on `loadState` — an optional
  `persist: (path, state) => Promise<void>` dependency defaulting to
  `persistMigratedState` at the composition site — so a case can assert it is
  called exactly once on the mutating load and zero times on the fixed-point load.
  This is the "make the hidden dependency an explicit parameter" fix from the
  guidelines, and it also removes the two 5-second-timeout watcher harnesses.

### `extensions/pi-claude-marketplace/persistence/locations.ts`

- **[BLOCKER] `pluginDataDir`'s marketplace-name `assertSafeName` is never
  exercised** — `locations.ts:223`; `tests/persistence/locations.test.ts:255, 308`
  Both `pluginDataDir` rows in the boundary loop pass a *safe* marketplace
  (`"market-one"`, `"market-two"`) and vary only the plugin argument. Deleting
  `assertSafeName(mp, …)` from `locations.ts:223` survives every case in the file.
  It is load-bearing: `install.ts:891`, `uninstall.ts:426`, `update.ts:1313`,
  `reinstall.ts:943/1602` and `remove.ts:611` all pass a marketplace name that
  originates in user-supplied state, and the function's own comment
  (`locations.ts:218-222`) explains why `assertPathInside` alone is insufficient —
  `pluginDataDir("a/b", "p")` stays *inside* `dataRoot` and would silently nest.
  Fix: add a row to the `lines 245-333` loop with
  `invoke: (locations, name) => locations.pluginDataDir(name, "plugin-one")`,
  `unsafeName: ["a", "b"].join(path.sep)`, expecting
  `pluginDataDir marketplace name "a/b" "a/b" must not contain path separators.`
- **[WARNING] `locationsFor` reads `process.env` through a hidden dependency** —
  `locations.ts:145` → `platform/pi-api.ts::getAgentDir()`
  Because the user-scope root comes from a `process.env.PI_CODING_AGENT_DIR` read
  buried inside the call, `locations.test.ts` has to save/mutate/restore a process
  global in two cases (`lines 77-83, 111, 167-177`) and hand-roll
  `restoreAgentDirectory` (`line 67`). Thirteen other test modules hand-roll a
  `withHermeticHome` for the same reason (see Meta-findings). Sanctioned fix per
  the guidelines: make the agent directory an explicit optional parameter of
  `locationsFor` (or a member of a small dependencies object), resolved once at the
  composition site. Owned jointly with `platform/` — see the grading note.
- **[WARNING] The `SCOPED_LOCATIONS_BRAND` doc comment overclaims** —
  `locations.ts:29-31`
  See the `migrate-config.test.ts:325` finding above: a spread of a real bundle
  with overridden path fields type-checks and mixes scopes freely. Fix: narrow the
  sentence to what is true ("an object literal built without a `locationsFor`
  result cannot type-check") rather than "a hand-crafted object literal that mixes
  scopes … cannot type-check."

### `extensions/pi-claude-marketplace/persistence/migrate.ts`

- **[WARNING] `ensureOneRecordResources` treats an array `resources` as a Record** —
  `migrate.ts:128-135`
  `typeof [] === "object"` and `[] !== null`, so a legacy record with
  `resources: []` takes the "already an object" branch, `pl.resources !== resources`
  is false (no mutated flag), and `agents`/`mcpServers`/`hooks` are set as *named
  properties on an array*. `JSON.stringify` drops them, so the persisted file is
  `"resources": []`, `STATE_VALIDATOR` rejects it, and `loadState` throws — with a
  message pointing at the missing sub-fields rather than the array. The sibling
  guards at `:102`, `:108`, `:163`, `:169` all include `Array.isArray(...)`; this
  one does not. Fix: change the condition to
  `typeof pl.resources === "object" && pl.resources !== null && !Array.isArray(pl.resources)`,
  and add a `resources: []` row to `migrate.test.ts` alongside the existing
  `resources: null` case (`line 557`).

### Cross-file, this area

- **[WARNING] `firstValidationErrorDetail` is triplicated** —
  `state-io.ts:316-324`, `config-io.ts:96-104`, `agents-index-io.ts:56-64`
  All three bodies are identical modulo the validator constant. Fix: extract one
  `firstValidationErrorDetail(validator: { Errors(v: unknown): Iterable<{ instancePath: string; message: string }> }, value: unknown): string`
  into `shared/` (beside `atomic-json.ts`, which the same three modules already
  share) and give it one owning case. Doing this also collapses the three separate
  `(no detail available)` tests below into one.
- **[WARNING] Three test modules monkeypatch a production JIT-compiled validator to
  reach an unreachable defensive branch** —
  `config-io.test.ts:269`, `state-io.test.ts:856-857` and `:884`,
  `agents-index-io.test.ts:437`
  Each does `t.mock.method(<VALIDATOR>, "Errors", () => [])` (state-io also stubs
  `Check`) purely to make `errors[0]` undefined and hit the
  `"(no detail available)"` fallback. `Compile(...).Errors(v)` cannot return an
  empty iterable for a value `Check(v)` just rejected, so the branch is unreachable
  by real input; the tests exist to close a coverage hole, not to pin behavior. This
  is the same class META-FINDINGS records as "unreachable branches and prototype
  surgery" (Decisions §1) — here the surgery is on a production module singleton
  rather than a global prototype, which is arguably worse because it mutates shared
  state another concurrent case in the same file could observe.
  `state-io.test.ts:851` is the sharpest instance: it stubs **both** `Check` and
  `Errors` to synthesize a root-level failure `loadState` structurally cannot
  produce (it always builds `normalized` as an object literal).
  **Operator decision, not a mechanical fix:** either delete the three
  `(no detail available)` fallbacks as dead code and drop the four cases, or keep
  them and accept the coverage gap. Bundle this with the shared-helper extraction
  above so it is decided once instead of three times.
- **[WARNING] ~38 inline `mkdtemp` + `locationsFor` arrangements where three
  siblings in the same directory already extracted a helper** —
  `agents-index-io.test.ts` (13 cases, e.g. `lines 24-26, 44-46, 67-69`),
  `config-write-back.test.ts` (13 cases, e.g. `lines 29-31, 151-153`),
  `config-io.test.ts` (12 cases, e.g. `lines 79-81, 92-94`)
  `state-io.test.ts:43` (`createExtensionRoot`), `migrate-config.test.ts:37`
  (`createCaseLocations`) and `config-merge.test.ts:422`
  (`createConfigMergeLocations`) each own a private version of the same three lines.
  Fix: put one `createScopeRoot(t): Promise<ScopedLocations>` beside the tests of
  this concern (`tests/persistence/create-scope-root.ts` — *not* `tests/helpers/`,
  which the guidelines forbid), have all nine modules call it, and delete the three
  private copies.

### `tests/persistence/locations.test.ts`

- **[WARNING] A rejected promise floats across an intervening assertion** —
  `lines 344-348`
  `const unsafePath = invoke(locations, unsafeName);` creates a rejected promise at
  `line 344`; `assert.strictEqual` runs at `line 347` before
  `await assert.rejects(unsafePath, …)` at `line 348`. If `line 347` fails, the
  rejection is unhandled. Fix: move `line 344` to immediately before `line 348`, or
  pass a thunk — `await assert.rejects(() => invoke(locations, unsafeName), …)` —
  matching the `() => loadState(extensionRoot)` form used throughout
  `state-io.test.ts`.

### `tests/persistence/config-merge.test.ts`

- **[WARNING] The `invalid` arm is only ever reached through JSON-parse failure** —
  `lines 34, 238, 253, 327, 370, 403-404`
  Every invalid row writes `""`, so `error` is always
  `"JSON parse failed: Unexpected end of JSON input"`. The D-18 fallback is
  documented for *any* invalid arm, and `loadConfig` produces two other invalid
  shapes (`read failed: …`, `schema validation failed: …`). Fix: change one of the
  nine rows to write `'{"schemaVersion":2}'` and expect
  `error: "schema validation failed: /schemaVersion: must be equal to constant"`,
  so the merged view's empty-contribution policy is pinned for a schema failure too.

### `tests/persistence/agents-index-io.test.ts`

- **[WARNING] Module-scope shared fixture constants** — `lines 17-19`
  `ADJACENT_VERSION_INDEX` / `INVALID_AGENTS_INDEX` are module-scope values used by
  exactly one case (`line 519`). The guidelines allow only a stateless stub at
  module scope; cross-case data belongs in a function returning a fresh value. Fix:
  inline both into `test('rejects an invalid document without changing stored bytes')`,
  keeping the `@ts-expect-error` on the local binding.

## Export ownership census

Every export in this area has an owning case; two are owned by architecture gates
rather than by the paired module, which is legitimate but worth recording.

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `locations.ts` | `locationsFor` | `locations.test.ts:75, 124, 165, 189, 334` | owned |
| `locations.ts` | `ScopedLocations` (type) | `locations.test.ts:41` (annotation only) | **partial** — no `@ts-expect-error` brand negative (first-pass BLOCKER) |
| `state-io.ts` | `loadState` | `state-io.test.ts:242, 269, 325, 371, 506, 577, 658, 716, …` | owned |
| `state-io.ts` | `saveState` | `state-io.test.ts:575, 590, 888, 919, 1202` | owned |
| `state-io.ts` | `STATE_VALIDATOR` | `state-io.test.ts:227, 313, 1126` | owned |
| `state-io.ts` | `DEFAULT_STATE` | `state-io.test.ts:56, 329` | owned |
| `state-io.ts` | `clonePluginRecord` | `state-io.test.ts:127, 153` | **partial** — 6 of 9 nested containers unproven (new BLOCKER) |
| `state-io.ts` | `toDisabledRecord` | `state-io.test.ts:202` | owned |
| `state-io.ts` | `isRecordedButDisabled` | `state-io.test.ts:72` (2 rows) | owned |
| `state-io.ts` | `STATE_SCHEMA` | `tests/architecture/hooks-foundation.test.ts:38` | owned by gate, not by the pair |
| `state-io.ts` | `PLUGIN_INSTALL_RECORD_SCHEMA` | `tests/architecture/compat-01-no-expansion.test.ts:407, 471`; `hooks-foundation.test.ts:63` | owned by gate, not by the pair |
| `state-io.ts` | `PluginInstallRecord` / `EnabledPluginRecord` / `DisabledPluginRecord` / `ExtensionState` | `state-io.test.ts:30-41, 81, 189, 322` | owned (`satisfies` + `@ts-expect-error`) |
| `config-io.ts` | `loadConfig` | `config-io.test.ts:84, 119, 162, 180, 198, 216, 235, 253, 272, 304` | owned |
| `config-io.ts` | `saveConfig` | `config-io.test.ts:348, 369, 409` | owned |
| `config-io.ts` | `isDeclaredEnabled` | `config-io.test.ts:30, 41, 52` | owned |
| `config-io.ts` | `CONFIG_VALIDATOR` | `config-io.test.ts:69` | **thin** — one positive case; every negative is exercised through `loadConfig` |
| `config-io.ts` | `ScopeConfig` (type) | `config-io.test.ts:16-22` | owned |
| `config-io.ts` | `MarketplaceConfigEntry` / `PluginConfigEntry` / `ConfigLoadResult` (types) | `config-io.test.ts:27` (`PluginConfigEntry` only) | **partial** — `MarketplaceConfigEntry` has no `satisfies` pin |
| `config-merge.ts` | `mergeScopeConfigs` | `config-merge.test.ts:465, 491, 514` | owned |
| `config-merge.ts` | `loadMergedScopeConfig` | `config-merge.test.ts:535` (9 rows) | owned |
| `config-merge.ts` | `MergedConfig` / `ScopeLoadOutcome` (types) | `config-merge.test.ts:26, 31, 462` | owned |
| `config-merge.ts` | `MergedConfigEntry` (type) | — | **incidental** — only structurally, via `MergedConfig` |
| `config-write-back.ts` | `writeMarketplaceConfigEntry` | `config-write-back.test.ts:72, 106, 123` | owned |
| `config-write-back.ts` | `deleteMarketplaceConfigEntryWithCascade` | `:163, 195, 243, 300` | owned |
| `config-write-back.ts` | `writePluginConfigEntry` | `:347, 380` | owned |
| `config-write-back.ts` | `deletePluginConfigEntry` | `:422` | **thin** — one case, no absent-map case |
| `config-write-back.ts` | `writeBatchedConfigEntries` | `:532, 578, 624, 682` | owned |
| `config-write-back.ts` | `BatchedConfigPatch` (type) | `:508, 555, 597, 650` | owned |
| `migrate.ts` | `migrateLegacyMarketplaceRecords` | `migrate.test.ts:97, 188, 272, 305, 339, 359, 410, 448, 485, 533, 582` | owned |
| `migrate.ts` | `persistMigratedState` | `migrate.test.ts:624, 671` | owned |
| `migrate.ts` | `MigrationResult` (type) | `migrate.test.ts:13-15` | owned |
| `migrate-config.ts` | `buildConfigFromState` | `migrate-config.test.ts:72, 185, 207` | owned |
| `migrate-config.ts` | `migrateFirstRunConfig` | `migrate-config.test.ts:226, 246, 265, 285, 331` | owned |
| `migrate-config.ts` | `MigrateFirstRunResult` (type) | `migrate-config.test.ts:29-35` | owned |
| `agents-index-schema.ts` | `AGENTS_INDEX_VALIDATOR` | `agents-index-schema.test.ts:285, 325, 336, 347, 365, 377, 403` | owned |
| `agents-index-schema.ts` | `AGENTS_INDEX_ENTRY_VALIDATOR` | `agents-index-schema.test.ts:71, 93, 271` | owned |
| `agents-index-schema.ts` | `AgentsIndex` / `AgentsIndexEntry` (types) | `agents-index-schema.test.ts:14-51` | owned |
| `agents-index-io.ts` | `loadAgentsIndex` | `agents-index-io.test.ts:34, 57, 115, 195, 214, 238, 264, 290, 315, 416, 442` | owned |
| `agents-index-io.ts` | `saveAgentsIndex` | `agents-index-io.test.ts:497, 519` | owned |
| `agents-index-io.ts` | `LoadedAgentsIndex` (type) | `agents-index-io.test.ts:27` | owned |

## Branch census

**(a) Reachable and untested — findings above:**

| Site | Branch |
| --- | --- |
| `migrate.ts:102, 108, 163, 169, 238` | `=== null` and `Array.isArray(...)` arms of the four object guards (only `typeof` arms covered) |
| `migrate.ts:53 / :64` | the two path fills, never separated (no one-present-one-absent input) |
| `migrate.ts:128-135` | `resources` as an array (mis-handled; production finding) |
| `migrate.ts:234` | multi-marketplace `mutated` accumulation |
| `migrate-config.ts:197` | the `+ plugins.length` term of `entryCount` |
| `config-write-back.ts:70, 104, 129, 153, 204` | `schemaVersion: 1` doing real work (input lacking the field) |
| `config-write-back.ts:147` | `{ ...current.plugins }` where `plugins` is absent |
| `locations.ts:223` | `assertSafeName(mp, …)` inside `pluginDataDir` |
| `agents-index-schema.ts:27-33, 48-51` | required-ness of 6 row fields and both envelope fields; element type of 3 string arrays |
| `state-io.ts:472` | the `if (mutated)` false arm, provable only non-deterministically today |
| `state-io.ts:406-413` | `Object.hasOwn(parsedRecord, "schemaVersion")` false arm — covered only *incidentally*, by `state-io.test.ts:858` writing `"{}"` for a different purpose |
| `config-io.ts:96-104` reached via `loadConfig` | schema-failure `invalid` arm never reached from `loadMergedScopeConfig` |

**(b) Unreachable by real input — production dead code, operator decision:**

| Site | Why |
| --- | --- |
| `state-io.ts:319-321`, `config-io.ts:99-101`, `agents-index-io.ts:59-61` | `if (!first) return "(no detail available)"` — `Compile(...).Errors(v)` always yields ≥1 entry for a value `Check(v)` rejected. Reached in tests only by stubbing the validator singleton. |
| `state-io.ts:323` `first.instancePath \|\| "<root>"` | unreachable **in `state-io`** — `loadState` always validates an object literal it built, so no root-level error exists. Reached only via the double stub at `state-io.test.ts:856-857`. It *is* reachable in `config-io` (`config-io.test.ts:227`, real `null` input), which is another reason the helper should be shared and owned once. |

**(c) Compiler-forced / defense-in-depth, keep as-is (D-116-01a class):**

| Site | Why |
| --- | --- |
| `locations.ts:226, 235, 244, 257, 275` | five `assertPathInside` calls that `assertSafeName` has already made unreachable on POSIX (a name with no `/` or `\` cannot escape a `path.join`). They are documented NFR-10/D-15 defense-in-depth and remain reachable on win32 via a drive-relative name such as `"C:"`. **Do not delete, and do not add prototype-surgery tests to reach them.** |
| `locations.ts:264` (`sourcesStagingDir`) | the only chokepoint whose `assertPathInside` *is* reachable, because it has no `assertSafeName`. Its four production callers all pass `randomUUID()` (`marketplace/add.ts:646`, `plugin/clone-cache.ts:179, 253, 388`), so the escape the test at `locations.test.ts:320` plants cannot occur today. Keeping the case is correct as a contract pin; adding `assertSafeName` for symmetry with its five siblings is optional and would make the case a pure `assertSafeName` test. |

## Grading of first-pass findings

### `tests/persistence/config-io.test.ts`
- **CONFIRMED** — *PathContainmentError asserted by name string, not by class* —
  `line 417` is `assert.ok(containmentError instanceof Error)` and the module never
  imports `PathContainmentError`; `migrate-config.test.ts:13, 340` is the correct
  form. BLOCKER severity fits: the "throw a different error class carrying the same
  message" mutation survives verbatim.

### `tests/persistence/locations.test.ts`
- **CONFIRMED** — *PathContainmentError asserted by name string, without structured
  fields* — `line 350` compares `error.name` to a string and no row asserts
  `.parent`/`.child`. The suggested per-row `expectedErrorClass` field is the right
  shape; note the six `assertSafeName` rows should expect `Error` and the
  `sourcesStagingDir` row `PathContainmentError`.
- **CONFIRMED** — *The brand's compile-time guarantee is never exercised* — every
  brand assertion (`lines 112-119`, `155-162`) is a runtime symbol check. The
  proposed `@ts-expect-error` pin does work, because `SCOPED_LOCATIONS_BRAND` is
  not exported (`locations.ts:25`), so no test can mint one.
  **Qualification (new):** the pin covers only the from-scratch literal.
  `migrate-config.test.ts:325` shows a spread-with-override defeats the brand and
  type-checks, so the doc comment at `locations.ts:29-31` is broader than the
  guarantee. Fix both together.

### `tests/persistence/state-io.test.ts`
- **CONFIRMED** — *Two expected-byte values reuse the production serializer's
  formula* — `line 557` and `line 1199` reproduce `atomic-json.ts:26`
  (`JSON.stringify(value, null, 2) + "\n"`) character for character, while
  `lines 442-485` and `1020-1038` in the same file use hand-written literals.
  WARNING is the right severity; `line 557` is the worse of the two because it
  stringifies the *live input* `state`, so a hypothetical in-place mutation inside
  `saveState` would move the expectation with it.

### `tests/persistence/agents-index-io.test.ts`
- **CONFIRMED** — *No drift guard ties the hardcoded index path to
  `ScopedLocations.agentsIndexPath`* — 13 cases hand-join
  `path.join(locations.extensionRoot, "agents-index.json")`, mirroring the
  production module's own derivation, so both sides would move together and no case
  would fail. `state-io.test.ts:1211` is the right pattern to copy. Checked and
  cleared one hazard the fix might have hit: the literal
  `"await atomicWriteJson(agentsIndexPathFor(loc), index);"` at
  `tests/architecture/config-state-write-seams.test.ts:206` is a hand-written
  negative-control **string**, not a scan of the real file, so changing the call
  site does not break that gate.

### `tests/persistence/config-write-back.test.ts`
- **UNDERSTATED** — *One case asserts an implementation detail via source-AST
  parsing* — the first pass concluded "No change required". The technique is
  justified for the reason given, but the **case is in the wrong module**: it uses
  none of `config-write-back.ts`'s exports and is a source-walk gate, which this
  repo houses in `tests/architecture/` — where
  `config-state-write-seams.test.ts` already owns SPLIT-02 source-walk gates over
  this exact module family. Leaving it in the pairing file also means
  `npm run test:coverage:direct` for this source–test pair counts a case that
  exercises no production line. Proposed severity stays WARNING, but the
  instruction changes from "add a comment" to: move
  `test('contains one awaited saveConfig call after both patch loops')`
  (`lines 431-492`) and `CONFIG_WRITE_BACK_SOURCE_PATH` (`lines 21-24`) into
  `tests/architecture/config-state-write-seams.test.ts`, keeping the `typescript`
  import there, and delete the now-unused `fileURLToPath`/`ts` imports from the
  pairing file.

### `tests/persistence/fixtures/`
- **CONFIRMED** — *Nine fixture JSON files unreferenced by any test* —
  re-verified: a repo-wide grep for all nine basenames and for
  `persistence/fixtures` returns zero hits across `tests/` and `extensions/`. They
  were last touched by the ENBL-02 commit (`222a7344`), so they have been
  *maintained* through a schema change without ever being *used*. Note they are
  invisible to `fallow dead-code`, which walks the TypeScript import graph only.
  **Sharper instruction than "wire in or delete":** wire in at least
  `legacy/v1-missing-manifestpath.json` and `agents-index/file-level-corruption.json`
  — each names exactly one of the missing cases found above
  (`ensureMarketplacePaths` independent fills; envelope without `schemaVersion`) —
  and delete the rest, whose scenarios are already covered by inline literals.

### `extensions/pi-claude-marketplace/persistence/agents-index-io.ts`
- **CONFIRMED** — *`agentsIndexPathFor` duplicates a path `ScopedLocations` already
  exposes* — `agents-index-io.ts:51-53` re-derives what `locations.ts:152` already
  computed. One correction of detail: the header comment (`lines 17-18`) now reads
  as a neutral "IMPLEMENTATION NOTE", not as a flag; the first pass's "flags this"
  is a slight overstatement, but the defect stands. The proposed fix
  (`return loc.agentsIndexPath;`, keeping the call sites) is safe — see the
  architecture-gate check above. `path` stays imported? No: it becomes unused, so
  delete the `node:path` import too.

## Still clean after attack

- **`tests/persistence/config-merge.test.ts`** — the only file in the area that
  survived everything I threw at it. It catches: base/local precedence inversion
  (`test('replaces complete base entries with local entries')`, where the base
  entry's `autoupdate: true` would leak through under any deep-merge); key-order
  reordering (`Object.keys` compared explicitly at `lines 495-504, 518-519, 539-543`);
  provenance-field corruption (`source: "base"` vs `"local"` inside the whole-object
  `deepStrictEqual`); collapsing the per-file `ConfigLoadResult`s into the merged
  view; swapping `configJsonPath` for `configLocalJsonPath` in
  `loadMergedScopeConfig`; and dropping any of the four `?? {}` fallbacks. Only the
  one WARNING above (invalid-arm variety).
- **`tests/persistence/locations.test.ts` — field-drift protection.**
  `fixedLocationBundle` (`line 41`) enumerates fields by hand, which would normally
  be a silent-omission hazard, but `assert.deepStrictEqual(Object.keys(locations), LOCATION_KEYS)`
  (`lines 116, 159`) closes it: a field added to `locationsFor` without being added
  to `LOCATION_KEYS` fails immediately. This is the pattern the same file's
  `clonePluginRecord` sibling in `state-io.test.ts` is missing.
- **`tests/persistence/migrate.test.ts` — in-place-mutation contract.** It is the
  only module in the area that asserts the *input* object's post-call state
  (`lines 101-106, 192, 276-280, 363, 452, 489, 537, 586`), including identity
  assertions (`assert.strictEqual(migration.marketplaces.alpha, legacyMarketplace)`)
  that catch a clone-instead-of-mutate rewrite. It also catches: `scrubAutoupdate`
  inversion (`lines 97` vs `188`), a wrong default-fill value for `enabled`, a
  dropped `hooks`/`mcpServers`/`agents` field, and `mutated` flipped on a fixed-point
  replay.
- **`tests/persistence/migrate-config.test.ts`** — catches the flat-key form
  reversal (`${plugin}@${mp}`), skipping soft-degraded plugins in the projection,
  `String()` in place of `JSON.stringify` for a raw-less source (`undefined` and the
  unknown-kind object both discriminate), `autoupdate` dropped when `false`,
  swapped `existing-valid`/`existing-invalid` arms, a write on the `invalid` arm,
  and `extensionRoot` passed to `saveConfig` in place of `scopeRoot`. Its
  inode/size/mtime/ctime fixed-point assertion (`lines 305-318`) genuinely proves
  the replay performs no write — the technique
  `state-io.test.ts` should adopt for its own non-mutating-load case.
- **`tests/persistence/state-io.test.ts` — error identity and structure.** Every
  `loadState`/`saveState` failure is asserted as
  `{ name, message, cause }` compared whole, including `cause instanceof SyntaxError`
  and the errno triple `{ code: "EISDIR", errno: -21, syscall: "read" }`. Dropping
  `{ cause: err }` from either wrap, or changing one word of a message, fails.
- **`extensions/pi-claude-marketplace/persistence/config-merge.ts`** — genuinely
  clean; pure, no I/O, no hidden dependency, no unreachable branch.
- **`extensions/pi-claude-marketplace/persistence/agents-index-schema.ts`** —
  genuinely clean as production code; the gaps are all on the test side.

## Not covered

- No command was run against the suite (per the brief): every claim here is from
  reading plus read-only `grep`. **In particular, "leaves all N cases green" claims
  are derived by tracing, not by applying the mutation and running the suite.** They
  are stated where the trace is unambiguous (an input value that is present in every
  case, an assertion that never reads the field); the fixing pass should still
  confirm the highest-value ones — the D-11 `schemaVersion` pin and the
  `clonePluginRecord` aliasing — by actually planting the mutation.
- Direct per-pair coverage (`npm run test:coverage:direct`) was not measured, so the
  branch census above is a reading of reachability, not a measured branch report.
  The `(b)` unreachable rows imply the pair currently reaches 100% branch coverage
  only *because* of the validator-stubbing cases; removing those cases without
  removing the fallbacks would drop it.
- `platform/pi-api.ts::getAgentDir`, `domain/name.ts::assertSafeName`,
  `shared/path-safety.ts`, and `shared/atomic-json.ts` were read as supporting
  context only. Findings that land on them are marked as jointly owned; their own
  test quality belongs to the `platform`, `domain`, and `shared` areas.
- `tests/integration/load-reconcile-race.test.ts` references `STATE_SCHEMA` and
  exercises `loadState`/`saveState` concurrency, but the integration suite is out of
  scope for this sweep; I did not evaluate whether it duplicates or contradicts
  anything here.

## Meta-findings impact

### New cross-cutting evidence

1. **`withHermeticHome` is hand-rolled 13 times.** Definitions at
   `tests/architecture/cross-op-convergence.test.ts:89`,
   `tests/integration/transaction-lifecycle-cascade.test.ts:45`,
   `tests/orchestrators/marketplace/{list:139,autoupdate:135,info:179,update:192}.test.ts`,
   `tests/orchestrators/plugin/{list:104,enable-disable:88,info:272,install:306,reinstall:85,uninstall:135,update:320}.test.ts`,
   plus a fourteenth ad-hoc variant in `tests/persistence/locations.test.ts:67`
   (`restoreAgentDirectory`). META-FINDINGS' "Patterns to propagate" table names
   `tests/architecture/source-scan.ts` with **5** hand-rolled walkers as the
   duplication headline; this one is nearly three times larger and spans four
   directories. **Add it to that table.** It has the same root cause as the
   persistence finding above: `platform/pi-api.ts::getAgentDir()` reads
   `process.env.PI_CODING_AGENT_DIR` inside logic, so every test touching a
   user-scope path must mutate a process global. Narrowing that one read into an
   explicit parameter is a single production change that dissolves 14 helpers — the
   same shape as, and comparable leverage to, the "narrow the over-wide context
   parameters" item ranked #1. **Other areas to check: `orchestrators/**` (11 of the
   13), `architecture/`, `integration/`.**
2. **Monkeypatching a production module singleton to reach an unreachable
   defensive branch is a distinct sub-class of Decisions §1.** Three instances in
   this area alone (`config-io.test.ts:269`, `state-io.test.ts:856-857/884`,
   `agents-index-io.test.ts:437`), all `t.mock.method(<TypeBox JIT validator>, "Errors", () => [])`.
   META-FINDINGS §Decisions 1 lists only *global prototype* surgery
   (`String.prototype`, `RegExp.prototype`, `Symbol.hasInstance`, `Object.prototype`)
   in four bridge/orchestrator files. The singleton variant is the same decision
   with different blast radius (shared module state, not a language global).
   **Every module that does `export const X_VALIDATOR = Compile(X_SCHEMA)` plus a
   private `first…ErrorDetail` fallback is a candidate — check `domain/components/*.ts`
   and `domain/manifest.ts`, which follow the same TypeBox+Compile house pattern.**
3. **`fallow dead-code` cannot see dead *fixtures*.** The nine unreferenced JSON
   files under `tests/persistence/fixtures/` survived a schema-change commit
   (`222a7344`) while being referenced by nothing, because fallow walks the
   TypeScript import graph. This belongs under "Gates that do not gate" as a sixth
   instance — not a broken gate, but a category no gate covers. **Other areas to
   check: any `tests/**/fixtures/` directory.**
4. **A byte-identical private helper triplicated across three sibling modules in
   one directory passes `fallow dupes` (threshold 3).** `firstValidationErrorDetail`
   / `firstConfigValidationErrorDetail` / `firstEntryErrorDetail` differ only in the
   validator identifier, which is apparently enough to defeat the clone
   fingerprint. Worth one line under "Gates that do not gate": the duplication gate
   is identifier-sensitive, so parallel-structure helpers that differ by one
   constant name slip through.

### Corrections to META-FINDINGS.md

1. **"The `ScopedLocations` brand is never proven … A compile-time guarantee nothing
   verifies"** (Gates that do not gate, item 5). Correct as far as it goes, but
   incomplete in a way that matters for the fix: the guarantee is *also weaker than
   the doc comment claims*. `tests/persistence/migrate-config.test.ts:325`
   (`{ ...locations, configJsonPath: escapedConfigPath }`) type-checks and produces a
   scope-mixing `ScopedLocations`, because a spread carries the brand symbol
   forward. Adding only the `@ts-expect-error` negative would leave that hole open
   and would make the doc comment look verified when it is not. The item should read:
   "never proven, **and partly false** — narrow the claim at `locations.ts:29-31` to
   the from-scratch literal, then pin that with `@ts-expect-error`."
2. **"Patterns to propagate → Shared source-scanning helper … 5 architecture files
   hand-roll their own `.ts` walker"** — this is no longer the largest instance of
   the pattern. `withHermeticHome` is hand-rolled 13 times (list above). The table
   row should be joined by a `withHermeticHome` row, and the leverage ranking should
   note that the hermetic-home duplication has a *production* root cause
   (`getAgentDir`'s `process.env` read) whereas the source-scan duplication does not
   — so the two fixes are not the same kind of work.

### Confirmations

1. **"Clean verdicts are not reliable"** (Provenance) — independently confirmed and
   quantified for this area. All 4 "clean" test modules and 2 of 8 "clean"
   production modules carried surviving mutations; 7 new BLOCKERs came from the
   clean lists, versus 3 BLOCKERs the first pass recorded for the whole area. The
   adversarial pass more than doubled the BLOCKER count here **entirely from files
   marked clean.**
2. **"The dominant shape: sibling drift"** — confirmed with five fresh instances
   inside a single 9-file directory: `deletePluginConfigEntry` missing the
   absent-map case its cascade sibling has; `migrate.ts:128` missing the
   `Array.isArray` guard its four siblings have; three test modules inlining an
   arrangement three siblings extracted; `locations.ts:261` missing the
   `assertSafeName` its five siblings have; `config-io.test.ts` / `locations.test.ts`
   asserting `error.name` where `migrate-config.test.ts:340` uses `instanceof`.
   In every case the correct form is next door, so these are propagation, not design.
3. **"Reviewing production alongside tests was worth it"** — confirmed. Three of the
   seven new BLOCKERs (`schemaVersion` pin, `pluginDataDir` marketplace guard,
   `ensureMarketplacePaths` independent fills) are only visible by reading the
   production branch structure against the test inputs; none is visible from the
   test file alone.
4. **"Decisions §1 — unreachable branches … Patching global prototypes is the wrong
   tool either way"** — confirmed from a second angle. The three
   `(no detail available)` fallbacks in this area are demonstrably unreachable
   (`Compile(...).Errors(v)` cannot be empty when `Check(v)` failed), and the four
   cases that reach them all stub production state. The operator decision should
   cover both sub-classes at once.
