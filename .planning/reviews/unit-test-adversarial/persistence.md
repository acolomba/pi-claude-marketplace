# Persistence — state, config, agents index, migrations

**Scope:** `extensions/pi-claude-marketplace/persistence/**` (9 modules) and
`tests/persistence/**` (9 test modules + `fixtures/{agents-index,legacy}/`)
**Test files reviewed:** 9
**Production modules reviewed:** 9

## Summary

This is the strongest area swept so far: every test file uses one `mkdtemp` per
case cleaned via `t.after()`, every atomic write is checked against a
hand-written expected byte string (not a substring or single field), row-based
cases are always one sibling `test()` per row, there is no `.only`/`.skip`,
no `it()`, no process-wide `mock` import, no module-loader trick, no `before()`
hook, and no message-substring error matching anywhere in the nine files. Idempotency of the legacy migration is proven with real fixed-point replays
(`state-io.test.ts`, `migrate.test.ts`, `migrate-config.test.ts`, the last one
down to unchanged inode/size/mtime/ctime), and prototype-pollution-shaped keys
(`__proto__`, `constructor`, `toString`) are exercised as own JSON-derived
properties in three different files. The sole sanctioned `console.warn`
(IL-3) lives exactly where the project constraints say it should
(`persistence/migrate.ts:281`) and its test asserts the warning as the
module's actual job, not as incidental noise.

The one recurring real gap is `PathContainmentError` handling: two of the
three places that provoke it verify only `error.name === "PathContainmentError"`
instead of `instanceof PathContainmentError`, even though a third file
(`migrate-config.test.ts`) in this same area shows the correct pattern. The
second theme is that the `ScopedLocations` brand's actual purpose — making a
hand-built object fail to type-check — is never exercised by a
`@ts-expect-error` negative; every brand assertion is a runtime check on the
factory's own output. A fixing pass should attack, in order: (1) the
`instanceof PathContainmentError` gap in `config-io.test.ts` and
`locations.test.ts`, (2) the missing brand-rejection negative in
`locations.test.ts`, and (3) the two `JSON.stringify`-derived expected-byte
shortcuts in `state-io.test.ts` that duplicate the production serializer's
exact formula instead of a hand-written literal.

## Unit test findings

### `tests/persistence/config-io.test.ts`

- **[BLOCKER] PathContainmentError asserted by name string, not by class** —
  `lines 389-430`, specifically `line 417`. The test "rejects an escaping
  path before replacement and preserves existing bytes" throws via
  `assertPathInside` (a real `PathContainmentError`), but the assertion is
  `assert.ok(containmentError instanceof Error)` followed by a
  `deepStrictEqual` that compares `containmentError.name` to the string
  `"PathContainmentError"`. The module never imports the class. A
  implementation that threw a plain `Error` with `.name`, `.message`,
  `.parent`, `.child` hand-set to match would pass this test without ever
  going through the real containment chokepoint. Fix: `import {
  PathContainmentError } from
  "../../extensions/pi-claude-marketplace/shared/path-safety.ts";` and change
  `assert.ok(containmentError instanceof Error)` to `assert.ok(containmentError
  instanceof PathContainmentError)`. Keep the existing structured-field
  `deepStrictEqual` (name/message/parent/child) — it is otherwise correct.
  `tests/persistence/migrate-config.test.ts:340` shows the wanted pattern
  verbatim.

### `tests/persistence/locations.test.ts`

- **[BLOCKER] PathContainmentError asserted by name string, not by class, and
  without its structured fields** — `lines 245-355`, specifically the shared
  per-row assertion at `lines 346-353` and the one row that actually throws
  `PathContainmentError` (title "rejects an escaping staging path beside an
  adjacent safe staging path", `lines 319-332`). Every row in this
  data-driven test — including the `sourcesStagingDir` row, the only one of
  the six chokepoint methods whose escape reaches `assertPathInside` rather
  than being intercepted earlier by `assertSafeName` — is checked with
  `assert.ok(error instanceof Error); assert.strictEqual(error.name,
  expectedErrorName); assert.strictEqual(error.message, expectedMessage);`.
  `PathContainmentError` is never imported and its `.parent`/`.child` fields
  are never asserted for this row, even though the class carries them
  specifically so callers can act on them structurally. Fix: import
  `PathContainmentError`, add a per-row `expectedErrorClass` field (`Error`
  for the `assertSafeName` rows, `PathContainmentError` for the
  `sourcesStagingDir` row), assert `error instanceof expectedErrorClass`, and
  for the `PathContainmentError` row additionally assert `error.parent` and
  `error.child` via `deepStrictEqual` against the expected `stagingRoot` /
  `escapedPath` values already computed in that row's `expectedErrorMessage`
  closure.
- **[BLOCKER] The brand's compile-time guarantee is never exercised** — no
  location in this file (the whole file, `lines 1-356`). Every brand-related
  assertion (`lines 112-119`, `155-162`) is a *runtime* check that the object
  `locationsFor` produces carries exactly one symbol key with value `true`.
  None of them prove the actual design contract stated in
  `persistence/locations.ts`'s own doc comment: "a hand-crafted object
  literal that mixes scopes ... cannot type-check." If the brand property on
  the `ScopedLocations` interface were weakened from required to optional
  (`[SCOPED_LOCATIONS_BRAND]?: true`) — silently defeating the entire
  point of SC-3 — every test in this file would stay green, because none of
  them attempt to assign a hand-built, unbranded object literal to a
  `ScopedLocations`-typed binding. Fix: add a module-level (or in-test)
  negative pin, matching the `@ts-expect-error` convention already used in
  `state-io.test.ts`, `config-io.test.ts`, `agents-index-schema.test.ts`, and
  `migrate-config.test.ts`, e.g.:
  ```ts
  // @ts-expect-error a hand-built object literal without the brand symbol cannot satisfy ScopedLocations
  const handBuilt: ScopedLocations = {
    scope: "user",
    scopeRoot: "/x",
    extensionRoot: "/x/pi-claude-marketplace",
    // ...remaining fields...
  };
  ```
  (only the fields needed to make the omission of the brand the sole type
  error are required — TypeScript will report the missing computed member).

### `tests/persistence/state-io.test.ts`

- **[WARNING] Two expected-byte values reuse the production serializer's
  exact formula instead of a hand-written literal** — `line 557` (test
  "saves exact version-2 bytes and loads the complete state") and `line 1199`
  (test "round-trips resolved sha and hook entries through exact state
  bytes"). Both compute `expectedBytes` as `` `${JSON.stringify(state, null,
  2)}\n` `` / `` `${JSON.stringify(expectedState, null, 2)}\n` ``, which is
  character-for-character the formula `shared/atomic-json.ts:26` uses
  (`JSON.stringify(value, null, 2) + "\n"`). A regression to that formula
  (wrong indent, dropped trailing newline) could in principle be introduced
  in both places identically and this pair of tests would not notice, unlike
  the fully hand-written literals the same file already uses correctly at
  `lines 442-485` and `1020-1038` for the equivalent legacy-migration and
  autoupdate-scrub cases. Fix: replace both `expectedBytes` computations with
  a fully hand-written template literal of the exact expected JSON text, the
  same way the two migration tests in this file already do.

### `tests/persistence/agents-index-io.test.ts`

- **[WARNING] No drift-guard test ties the hardcoded index path to
  `ScopedLocations.agentsIndexPath`** — every test in the file (e.g. `lines
  47, 70, 128, 208, 232, 258, 284, 310, 336, 429, 457, 511`) builds `indexPath
  = path.join(locations.extensionRoot, "agents-index.json")` by hand instead
  of reading `locations.agentsIndexPath`, mirroring the production module's
  own duplicate derivation (see the paired production finding below). Nothing
  in this file would notice if `agentsIndexPathFor` and
  `ScopedLocations.agentsIndexPath` ever diverged. `state-io.test.ts:1211`
  ("derives the config migration gate path from the public locations
  contract") is the pattern to copy for a similar divergence risk. Fix:
  once `agentsIndexPathFor` is changed to return `loc.agentsIndexPath`
  directly (see production finding), update every `indexPath` construction
  in this file to read `locations.agentsIndexPath` instead of recomputing the
  join — this makes the coupling self-verifying rather than adding a
  separate guard test.

### `tests/persistence/config-write-back.test.ts`

- **[WARNING] One case asserts an implementation detail via source-AST
  parsing rather than observable behavior** — `lines 430-492` ("contains one
  awaited saveConfig call after both patch loops"). The test parses
  `config-write-back.ts` with the TypeScript compiler API and walks the AST
  to prove `writeBatchedConfigEntries` contains exactly one awaited
  `saveConfig(...)` call positioned after both patch loops. This is
  justified — the production docstring (`config-write-back.ts:174-178`)
  documents the single-write invariant explicitly, and no purely
  behavior-based assertion can distinguish "one batched write" from "N
  sequential writes that happen to leave the same final bytes on disk," and
  `t.mock.module()`/loader-based interception of a named export is itself
  forbidden by the project's testing rules. Still, this is a materially
  different technique from every other case in this file and is easy to miss
  when scanning for behavior coverage. No change required; consider a
  one-line comment on the test itself pointing back to the docstring's
  "Structural single-write guarantee" so a future reader does not mistake it
  for accidental architecture-test leakage into a unit-test file.

### Clean files

- `tests/persistence/config-merge.test.ts`
- `tests/persistence/migrate.test.ts`
- `tests/persistence/agents-index-schema.test.ts`
- `tests/persistence/migrate-config.test.ts` — the strongest file in the set;
  its containment-failure test (`lines 321-357`) is the reference
  implementation for `instanceof PathContainmentError` plus structured-field
  assertions that the two BLOCKER findings above ask the other files to
  match.

### `tests/persistence/fixtures/`

- **[WARNING] Nine fixture JSON files are unreferenced by any test** —
  `tests/persistence/fixtures/agents-index/{empty,file-level-corruption,
  per-row-corruption,single-row}.json` and
  `tests/persistence/fixtures/legacy/{state-populated-mixed,
  state-with-autoupdate,v0-no-schemaversion,v1-missing-manifestpath,
  v1-missing-resources}.json`. A repo-wide grep for every one of these nine
  filenames, and for the literal string `fixtures` inside
  `tests/persistence/*.test.ts`, returns zero hits — none of the nine test
  files in this area load them, and no file elsewhere in `tests/` references
  the `tests/persistence/fixtures/` path either. Every scenario these files
  represent (empty agents-index, file-level and per-row corruption, a
  single-row index, and each of the five legacy `state.json` shapes) is
  instead reconstructed as an inline JSON literal inside the corresponding
  `.test.ts` file. This is dead test support. Fix: either wire these files
  into the corresponding cases (replacing the inline literals with
  `readFile`/`writeFile` against the fixture, which would also shrink several
  of the larger inline literals in `agents-index-io.test.ts` and
  `migrate.test.ts`) or delete the fixture directory.

## Production code findings

### `extensions/pi-claude-marketplace/persistence/agents-index-io.ts`

- **[WARNING] `agentsIndexPathFor` duplicates a path `ScopedLocations`
  already exposes** — `lines 51-53`. The module's own header comment
  (`lines 17-18`) flags this: `agentsIndexPathFor(loc)` returns
  `path.join(loc.extensionRoot, "agents-index.json")` instead of the
  pre-computed `loc.agentsIndexPath` field that `persistence/locations.ts`
  already derives with the identical join (`locations.ts:152`). The two
  are byte-identical today only because nobody has changed either side; there
  is no test tying them together (see the paired test finding above), so a
  future edit to either formula would silently desynchronize
  `agents-index.json`'s actual on-disk location from what
  `ScopedLocations.agentsIndexPath` reports to every other consumer. Fix:
  replace the function body with `return loc.agentsIndexPath;`, deleting the
  now-redundant `path` import if it becomes otherwise unused.

### Clean files

- `extensions/pi-claude-marketplace/persistence/locations.ts`
- `extensions/pi-claude-marketplace/persistence/state-io.ts`
- `extensions/pi-claude-marketplace/persistence/config-io.ts`
- `extensions/pi-claude-marketplace/persistence/config-merge.ts`
- `extensions/pi-claude-marketplace/persistence/config-write-back.ts`
- `extensions/pi-claude-marketplace/persistence/migrate.ts` — including the
  sole sanctioned `console.warn` callsite (`line 281`), correctly scoped and
  correctly tested as the module's actual job rather than incidental log
  noise.
- `extensions/pi-claude-marketplace/persistence/migrate-config.ts`
- `extensions/pi-claude-marketplace/persistence/agents-index-schema.ts`

## Not covered

- The test suite was not executed (per the diagnostic-review instructions);
  all findings are from static reading.
- `domain/name.ts`, `shared/types.ts`, `platform/pi-api.ts`, and
  `shared/atomic-json.ts` / `shared/path-safety.ts` were read only as
  supporting context for the persistence modules that import them; they are
  owned by other areas and are not reviewed here for their own style or test
  quality (e.g. `assertSafeName`'s slightly awkward doubled-name error text
  for two of its four failure branches, which `locations.test.ts` correctly
  pins as current behavior, is a `domain/` concern, not a `persistence/`
  one).
