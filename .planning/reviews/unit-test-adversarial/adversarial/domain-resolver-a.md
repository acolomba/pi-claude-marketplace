# Domain — resolver (slice A) — adversarial re-review

**Scope:** `tests/domain/resolver.test.ts` lines 1–2000 (69 `test()` declarations,
74 executed cases after the 6-row `unsupportedConventionScenarios` loop) and the
arms of `extensions/pi-claude-marketplace/domain/resolver.ts` (1757 lines, read in
full) that those cases exercise. Slice B (2000–3949) ran concurrently; I read
outside my range only to settle whether a sibling case kills a mutation, and every
such excursion is cited.
**First-pass file:** `unit-test-findings/domain-resolver.md`
**Clean files attacked:** 0 listed — both `### Clean files` lists in the first-pass
file read `(none)`. Its unfalsified negatives are therefore its **Summary's health
claims** ("Structurally the suite is sound: no `describe`, no `before`/`beforeEach`,
no shared mutable state … The production module is genuinely pure and network-free").
I attacked those instead, plus the whole export/branch surface of the one
production module. 2 files effectively attacked (`resolver.ts`, `resolver.test.ts`).
**Existing findings graded:** 6 (4 test, 2 production).

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 6 |
| New WARNING (missed by first pass) | 12 |
| Existing CONFIRMED | 2 |
| Existing UNDERSTATED | 2 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 1 |
| Existing DUPLICATE-OF | 0 |

The first pass's central claim held and is worse than recorded. Its two BLOCKERs
are real. But it framed the defect as "assert the whole object instead of a field",
which reads as a thoroughness nit. The mutation test says otherwise: **six distinct
wrong implementations survive all 136 cases**, including a hardcoded plugin name, a
deleted supported component kind, and two deleted members of a closed set the
production comment itself marks security-relevant.

## New findings — from the clean lists

### `tests/domain/resolver.test.ts`

- **[BLOCKER] `ResolvedPlugin.name` can be hardcoded and every one of the 136 cases
  stays green** — no line; the defect is a file-wide absence.
  `grep -n '\.name' tests/domain/resolver.test.ts` returns **zero matches**: the
  `name` field is never read off a resolved plugin anywhere in 3949 lines. Every
  entry that reaches `resolveStrict`/`resolveLoose` is named `"p1"` (the
  `pluginEntry()` default, line 88). The only non-`p1` entries — `name: "alpha"` at
  lines 2621, 2636, 2653, 2666 — are fed to `rowClaimsInstallDisabled`, which never
  touches `name`. Even the 11 whole-object exemplars the first pass praises
  (`resolver.test.ts:3338, 3364, 3386, 3413, 3443, 3566, 3582, 3609, 3729, 3754,
  3800`) write `name: "p1"` in the expected literal against an entry named `"p1"`,
  so they do not kill it either. Mutating `resolver.ts:446` to
  `unavailable(_name: string, notes)` → `{ …, name: "p1", … }` and `resolver.ts:468`
  to `name: "p1"` leaves the entire suite green, while every user-facing row, every
  `PluginShapeError.plugin`, and every install record would carry the wrong plugin
  name. **Fix:** change the five whole-object exemplars at 3338/3364/3386/3413/3443
  to use distinct entry names (`pluginEntry({ name: "alpha", … })`, `"beta"`, …)
  and keep the expected literal's `name` in sync; that alone kills the mutation.

- **[BLOCKER] `agents` — one of the three `SUPPORTED_COMPONENT_PATH_KINDS` — has
  zero positive coverage** — no line; file-wide absence.
  `grep -n '"agents"' tests/domain/resolver.test.ts` returns **zero matches**. No
  entry or manifest in the file declares `agents`, and no `resolveContext` file map
  registers `<pluginRoot>/agents` as a `"dir"`. Mutating `resolver.ts:360` to
  `const SUPPORTED_COMPONENT_PATH_KINDS = ["skills", "commands"] as const;` compiles
  clean (`SupportedPathKind` narrows, and `componentPaths.agents` keeps the `[]`
  that `emptyResolution()` at `resolver.ts:438` puts there) and leaves all 136 cases
  green. A plugin shipping an `agents/` directory would then resolve with `agents`
  absent from `supported` and `componentPaths.agents: []`, so the agents bridge
  stages nothing and the plugin installs looking healthy. **Fix:** mirror the
  `commands` case at `resolver.test.ts:3172–3199` for `agents` — register
  `[path.join(localRoot, "agents")]: "dir"`, declare `agents: "agents"` on the
  entry, and assert `componentPaths.agents` and `supported` with
  `deepStrictEqual`. `commands` itself has exactly one positive case; `skills` has
  many. This is three-way sibling drift inside one kind loop.

- **[BLOCKER] `channels` and `userConfig` — 2 of the 8 `UNSUPPORTED_COMPONENT_KINDS`
  — are unpinned in this file and in the whole repo** — no line; file-wide absence.
  `grep -n 'channels\|userConfig' tests/domain/resolver.test.ts` returns **zero
  matches**. The `unsupportedConventionScenarios` loop (line 91) covers the six
  kinds that have a convention file and skips the two declaration-only kinds. The
  only other owner of the constant, `tests/architecture/hooks-foundation.test.ts:207`,
  asserts *only* that the tuple does **not** contain `"hooks"` — a negative that
  passes for any 8-, 6-, or 0-member array. Mutating `resolver.ts:380` to delete
  `"channels"` and `"userConfig"` leaves both files green; a plugin declaring
  `channels` then resolves `installable` instead of `partially-available` and
  installs silently with an unsupported component. The array's own doc comment
  (`resolver.ts:369–372`) calls this closed set security-relevant (T-02-25) and says
  a kind in neither list "would be silently ignored". **Fix (two parts, both cheap):**
  (1) in `hooks-foundation.test.ts:207`, replace the negative with
  `assert.deepStrictEqual([...UNSUPPORTED_COMPONENT_KINDS], ["lspServers","monitors","themes","outputStyles","channels","userConfig","settings","workflows"])`
  — copying the sibling **eight lines above it** at line 199, which already pins
  `SUPPORTED_COMPONENT_KINDS` as a closed tuple; (2) add two resolver cases
  declaring `channels: {}` / `userConfig: {}` on the entry and asserting the
  `partially-available` arm's `unsupported` and `notes`.

- **[BLOCKER] Three cases whose only assertion is `typeof pluginRoot === "string"`**
  — `lines 1787, 1907, 1924` (plus 3288, 3304 in slice B — five in total).
  `test('PR-6 requireInstallable on installable narrows to installable variant')`,
  `test('RSTATE-04 requirePartialInstallable admits installable and exposes pluginRoot')`,
  and `test('RSTATE-04 requirePartialInstallable admits unsupported and exposes pluginRoot')`
  each end on `assert.strictEqual(typeof resolvedPlugin.pluginRoot, "string")`. That
  passes for `""` and for any wrong path. Mutating `resolver.ts:791` to
  `const pluginRoot = path.resolve(ctx.marketplaceRoot, "wrong");` leaves all five
  green. The correct form already sits 60 lines away in the same file:
  `resolver.test.ts:1851` writes `assert.strictEqual(resolvedPlugin.pluginRoot, localRoot)`.
  **Fix:** replace each `typeof` check with
  `assert.strictEqual(resolvedPlugin.pluginRoot, pathUnderMarketplace("./local"))`.

- **[BLOCKER] `notes[]` and `unsupported[]` ordering is unpinned — including by the
  whole-object exemplars** — representative: `line 1683` (`PR-3 multiple unsupported
  components both surface as notes`), `line 908` (`PR-3 experimental
  themes/monitors declarations are unsupported`), `line 1878` (`RSTATE-02`).
  Every multi-element case asserts membership only (`notes.includes("contains themes")`
  and `notes.includes("contains monitors")` as two separate `assert.ok`s). The 11
  whole-object exemplars at 3338+ cannot close this either: all of them carry
  single-element arrays (e.g. `resolver.test.ts:3370–3371`,
  `unsupported: ["themes"], notes: ["contains themes"]`), so ordering is invisible
  to them by construction. Mutating `resolver.ts:565` to iterate
  `[...UNSUPPORTED_COMPONENT_KINDS].reverse()` yields
  `notes: ["contains monitors", "contains themes"]` and leaves every case green.
  Order is a real contract here — the install/list/info row composers enumerate
  `notes` and `unsupported` in array order into the `{reason}` slot of the row
  grammar. **Fix:** at 1683–1691 replace the two `assert.ok(...includes(...))` with
  `assert.deepStrictEqual(resolvedPlugin.notes, ["contains themes", "contains monitors"])`
  and `assert.deepStrictEqual(resolvedPlugin.unsupported, ["themes", "monitors"])`;
  same treatment at 908–916 and 1878–1886.

- **[BLOCKER] Zero whole-object assertions exist in lines 1–2000 — 69 of 69
  declarations assert a projection** — file-wide in my range.
  `grep -n 'deepStrictEqual' | awk -F: '$1<=2000'` returns 12 hits, and **not one**
  is `deepStrictEqual(resolvedPlugin, {…})`; all 12 are sub-field comparisons
  (`droppedHooks` at 515/552/592, `mcpServers` at 1236/1237/1262/1554/1587,
  `componentPaths.skills` at 1718/1744/1855, `error.shape.unsupportedKinds` at 1996).
  The 11 whole-object cases the first pass points at as the template all live at
  3338 and later. This *quantifies* the first-pass BLOCKER for the assignment's
  ratio question: in the first half of the file the under-assertion rate is not
  "roughly 100 of 136" — it is **100%**. **Fix:** the first pass's instruction is
  right; my addition is the ordering, which is that the fixing pass should start at
  line 111 and work forward, because there is no locally-correct case in the first
  2000 lines to imitate — the template must be imported from 3338.

- **[WARNING] `declaresUnsupportedKind`'s manifest half is untested** — the
  `manifest?.[kind] !== undefined` disjunct at `resolver.ts:525`. No test in the
  file puts a top-level unsupported kind in a `plugin.json`; the manifest-side case
  at line 889 uses `experimental.*` instead, which routes through
  `nestedExperimentalValue`. Deleting `|| manifest?.[kind] !== undefined` leaves all
  136 green. **Fix:** add one case whose `plugin.json` contents are
  `JSON.stringify({ name: "p1", lspServers: {} })` and assert
  `partially-available` + `notes: ["contains lspServers"]`.

- **[WARNING] `nestedExperimentalValue(entry, kind)` — the entry half — is untested**
  — `resolver.ts:533`. `test('PR-3 experimental themes/monitors declarations are
  unsupported')` at line 889 places `experimental` in the *manifest* only. Deleting
  the entry disjunct leaves all 136 green, so a marketplace entry carrying
  `experimental: { themes: … }` would install silently. **Fix:** duplicate the case
  at 889 with `pluginEntry({ source: "./local", experimental: { themes: "./themes" } })`
  and no manifest.

- **[WARNING] `hasUnsupportedConvention`'s kind match is never tested for a
  mismatch** — `resolver.ts:548`. All six rows of `unsupportedConventionScenarios`
  (line 91) register the convention path with its *matching* kind, so
  `statKind(...) === convention.kind` is never observed being false-on-an-existing-
  path. Mutating it to `!== null` leaves all 136 green, and a plugin shipping
  `themes` as a regular file or `settings.json` as a directory gets misclassified as
  partially-available. **Fix:** add a seventh row to the scenarios array shaped
  `{ kind: "themes", relativePath: "themes", stat: { contents: "{}" }, expected: "installable" }`
  — or, to keep the loop single-branch per the data-driven rule, write it as a
  separate named case `test("PR-4 a themes FILE does not match the themes dir convention")`.

- **[WARNING] `resolveDefaultEnabled`'s two `typeof` degrade-to-default narrows are
  untested** — `resolver.ts:755` and `759`. The doc comment at `resolver.ts:741–749`
  documents this behavior explicitly ("A non-boolean smuggled past a validator
  degrades to the default; there is deliberately no error path here") and nothing
  pins it. No case in the DFEN block (937–1196) puts a non-boolean `defaultEnabled`
  on the **entry** — line 1178 puts one in the *manifest*, where
  `PLUGIN_MANIFEST_VALIDATOR` catches it first and precedence is never reached.
  Mutating line 755 to `if (entry.defaultEnabled !== undefined)` makes an entry
  declaring `defaultEnabled: "yes"` produce `defaultEnabled: "yes"` on the
  materializable arm — a non-boolean in a field the schema types
  `Type.Boolean()` — and all 136 cases stay green. **Fix:** the in-file technique
  already exists at `resolver.test.ts:2634`
  (`test('rowClaimsInstallDisabled treats an invalid entry default as silent')`),
  which plants the invalid value with
  `Object.defineProperty(entry, "defaultEnabled", { value: "false" })`. Copy it into
  a new DFEN case and assert `defaultEnabled === true`.

- **[WARNING] The DFEN "precedence truth table" comment claims a completeness it
  does not have** — `lines 937–943`. The block header states "The whole table lives
  here so a reader meets every cell at once rather than inferring the unstated
  ones." The table has 12 cells (entry ∈ {true, false, silent} × manifest ∈ {true,
  false, present-but-silent, absent}); 8 are present (945, 972, 1000, 1029, 1058,
  1084, 1108, 1128) and **4 are absent**: (entry `true`, manifest present-silent),
  (entry `true`, manifest absent), (entry `false`, manifest present-silent), (entry
  `silent`, manifest `true`). No mutation survives *because of* the gaps — the
  present cells are sufficient to kill every swap/drop/hardcode mutation of
  `resolveDefaultEnabled` — so this is a doc-comment-lies finding, not a coverage
  hole. **Fix:** add the four cells (they are four-line copies of their neighbours),
  or reword the header to say which cells are load-bearing and why the rest are
  implied. Do not leave the current wording.

- **[WARNING] `resolver.test.ts:128` and `:2298` are the same case** —
  `test('PR-2(1) url source with no clone resolver -> unavailable (requires clone
  resolver)')` at 128 and `test('PURL-01: url source with NO resolveGitPluginRoot
  injected -> unavailable (path-only back-compat)')` at 2298 have identical arrange
  (`resolveContext(marketplaceRoot, {})`), identical act (an object-form `url`
  source differing only in the host path — `gitlab.com/obra/superpowers.git` vs
  `gitlab.com/o/p.git`, behaviorally indistinguishable), and identical assert
  (`state === "unavailable"` plus `notes.some(n => n.includes("clone"))`).
  **Fix:** delete the one at 128 and keep 2298 — it sits with the other PURL-01
  git-arm cases (2195–2390) and its comment is the accurate description of what is
  being pinned. Renumber nothing; `PR-2(1)`'s github-source sibling at line 111
  stays.

- **[WARNING] The resolver's `assertSafeName` throw contract is owned by another
  module's test** — `resolver.ts:860` is the **only** safe-name gate for a
  marketplace entry: `PLUGIN_ENTRY_SCHEMA.name` is a bare `Type.String()`
  (`domain/components/plugin.ts:66`), and its own comment at line 57 defers safe-name
  validation to the resolver. A hostile `name` therefore makes `resolveStrict`
  **throw** rather than resolve `unavailable`. That behavior is asserted only from
  `tests/orchestrators/plugin/list.test.ts:2903–2930` ("`/` in name passes TypeBox
  String() but assertSafeName throws"). `tests/domain/name.test.ts` correctly owns
  `assertSafeName` itself, but nobody's paired test owns the resolver's
  *propagation*. **Fix:** add
  `await assert.rejects(() => resolveStrict(pluginEntry({ name: "a/b" }), context), <the class domain/name.ts throws>)`
  to `resolver.test.ts`, asserted by class and structured fields, not message.

- **[WARNING] `readPathOrArray`'s `null` arm is untested** — `resolver.ts:931`.
  `"skills": null` is legal JSON in a third-party marketplace entry and reaches this
  function. No case supplies it. Deleting `|| value === null` turns it into
  `[null]`, which `validateComponentPath` rejects with `component path for "skills"
  is not a string (got object)` → `unavailable` instead of a clean installable —
  and all 136 cases stay green. **Fix:** add
  `test("D-07 a null component-path declaration is treated as undeclared")` asserting
  the installable arm with `componentPaths.skills: []`.

- **[WARNING] Cross-kind `seenPaths` isolation is untested** — `resolver.ts:1043`.
  `seenPaths` is constructed inside `collectStrictComponentKind`, so it is fresh per
  kind. Hoisting it to a set shared across the three kinds compiles and passes: the
  only case that declares two kinds (`resolver.test.ts:3183`) uses distinct paths
  (`skills: "skills", commands: "commands"`). **Fix:** in that case, change both
  declarations to the same relative path (`skills: "shared", commands: "shared"`,
  with `[path.join(localRoot, "shared")]: "dir"`) and assert both
  `componentPaths.skills` and `componentPaths.commands` contain `"shared"`.

- **[WARNING] 22 `if (resolvedPlugin.state === …)` narrowing guards where the file's
  own imported assertion functions narrow without a branch** — representative:
  `lines 217, 251, 340, 418, 505, 850, 880, 1717, 1850`; 22 in my range, 39 in the
  file. None is vacuous *today* — each is preceded by an
  `assert.strictEqual(resolvedPlugin.state, …)` that fails first — but the
  assertions inside them are structurally skippable, so deleting the preceding
  `strictEqual` in a future edit silently empties the case. The file already uses
  the branch-free form 24 times: `requireInstallable(resolvedPlugin)` at line 966
  and `requirePartialInstallable(resolvedPlugin)` at line 1170 narrow via
  `asserts r is …` and throw on the wrong arm. **Fix:** replace every
  `assert.strictEqual(state, X); if (state === X) { … }` pair with the single
  narrowing call, leaving the assertions at case top level. This also removes the
  data-loop conditional at line 880, which currently sits awkwardly against the
  "no conditional in a data-driven loop body" rule even though all six rows take
  the same branch.

- **[WARNING] `test('MCPR-01 marketplace-entry string mcpServers reference resolves
  at inline parity')` compares two production outputs to each other** — `line 1236`.
  `assert.deepStrictEqual(referenced.mcpServers, inline.mcpServers)` is a
  production-vs-production comparison; a mutation corrupting `applyMcpValue`
  identically on both paths passes it. It is saved only by the independent literal
  on the next line (1237). **Fix:** keep 1237, delete 1236 — or, if the *parity*
  itself is the promise, assert both against the same hand-written literal
  (`assert.deepStrictEqual(inline.mcpServers, { srv: { command: "node" } })`) so
  neither side is defined by the other.

## Production code findings — new

### `extensions/pi-claude-marketplace/domain/resolver.ts`

- **[WARNING] `addUnsupportedKindNotes` returns a value nobody reads** — `lines
  1484–1491`. The `dirty` accumulator is write-only: the sole call site
  (`resolver.ts:1568`) discards the result, deliberately, per the D-64-07 comment
  three lines above it. **Fix:** change the return type to `Promise<void>` and
  delete `let dirty` / `dirty = true` / `return dirty`. Note this is a genuine dead
  computation, not the compiler-forced category (D-116-01a) — nothing forces it.

- **[WARNING] Five `[...partial.notes, reason]` spreads that are provably `[]`** —
  `lines 796, 808, 823, 828` (inside `deriveSourcePluginRoot`) and `871, 892, 904`
  (inside `preflightStages`). `partial` is `emptyResolution()` (line 858) and
  nothing between its construction and any of these short-circuits pushes to
  `partial.notes` — `assertSafeName` throws rather than pushing,
  `parsePluginSource` and `classifySourceSupport` are pure. Every one of these
  spreads is invariantly an empty prefix. It reads as if earlier structural notes
  could accumulate; they cannot. **Fix:** either simplify to `[reason]`, or keep the
  spread and add one comment at `preflightStages` stating that the spread is
  defensive against a future stage being inserted above the short-circuits.

- **[WARNING] `readManifest` and `readStandaloneMcp` read inside the `try`,
  diverging from the WR-02/WR-03 pattern their two siblings follow** — `lines 634`
  and `1072`, against `readReferencedMcp` at `line 1148` and `readStandaloneHooks`
  at `line 1213`. The latter two deliberately hoist the `readFileTextOf(ctx)(…)`
  call **out** of the try so an EACCES/EPERM propagates to `narrowProbeError` and
  renders the truthful `{permission denied}` / `{unreadable}` reason; their comments
  (1141–1147, 1209–1212) say the wrapper "silently lumped I/O failures" into the
  wrong bucket and that this is the "house pattern". `readManifest` and
  `readStandaloneMcp` still wrap, so an unreadable `plugin.json` surfaces as
  `malformed plugin.json: EACCES` — exactly the mislabeling WR-02 exists to prevent.
  **This is an operator decision, not a mechanical fix:**
  `resolver.test.ts:3767` (`resolveStrict reports a non-Error standalone mcp read
  rejection`) currently *pins* the wrapping behavior for `readStandaloneMcp`, so
  changing it invalidates a deliberate case. `readManifest`'s wrapping is unpinned
  in either direction and is the cheaper half to decide.

- **[WARNING] `deriveSourcePluginRoot` silently discards `resolvedSha`** — `line
  818`. The `materialized` arm returns only `{ kind: "ok", pluginRoot }`, dropping
  the `resolvedSha` that the `GitPluginRootResult` doc comment (`lines 273–275`)
  says is "carried for version recording". The resolver is not the recorder, so this
  is correct — but the type comment reads as if the resolver threads it. **Fix:**
  amend the comment at 273–275 to say the sha is for the *callback's own caller*,
  not for the resolver.

## Export ownership census

`extensions/pi-claude-marketplace/domain/resolver.ts` — every export:

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `resolver.ts` | `resolveStrict` | `resolver.test.ts:111` and ~110 others | owned |
| `resolver.ts` | `resolveLoose` | `resolver.test.ts:2676`+ (slice B) | owned |
| `resolver.ts` | `requireInstallable` | `resolver.test.ts:1774, 1790, 1809, 1975` | owned, but 1774's only assertion is the `typeof` check (BLOCKER above) |
| `resolver.ts` | `requirePartialInstallable` | `resolver.test.ts:1893, 1910, 1927, 1947` | owned, but 1893/1910's only assertion is the `typeof` check |
| `resolver.ts` | `rowClaimsInstallDisabled` | `resolver.test.ts:2613–2674` (10 cases, data-driven, correct form) | owned |
| `resolver.ts` | `SUPPORTED_COMPONENT_KINDS` | `tests/architecture/hooks-foundation.test.ts:199` | **WRONG OWNER** — no case in the pairing file. The assertion itself is sound (full closed-tuple `deepEqual`), but it uses loose `deepEqual`; should be `deepStrictEqual` |
| `resolver.ts` | `UNSUPPORTED_COMPONENT_KINDS` | `hooks-foundation.test.ts:207` | **WRONG OWNER + NEGATIVE-ONLY** — asserts only "does not contain hooks"; passes for any content. See BLOCKER above |
| `resolver.ts` | `ResolvedPluginSchema` | — | **NO CASE**, and zero consumers repo-wide (`grep -rn ResolvedPluginSchema extensions tests` matches only its own file). Its `fallow-ignore` comment at 244 honestly admits it exists only because both lint gates reject the alternatives. Its runtime `Check`/`Errors` surface is never executed by any test |
| `resolver.ts` | `_DroppedHookDriftCheck` | the compiler | owned correctly — compile-time drift guard, zero runtime cases is right |
| `resolver.ts` | `_DroppedHookArmKeysCheck` | the compiler | owned correctly |
| `resolver.ts` | `ResolvedPluginInstallable` (type) | `resolver.test.ts:3836–3841` (`satisfies`), `3866–3930` (`@ts-expect-error`) | owned — see "Still clean" |
| `resolver.ts` | `ResolvedPluginPartiallyAvailable` (type) | same | owned |
| `resolver.ts` | `ResolvedPluginUnavailable` (type) | same | owned |
| `resolver.ts` | `ResolvedPlugin` (type) | annotations at `resolver.test.ts:1779, 1898, 1915` | owned |
| `resolver.ts` | `MaterializablePlugin` (type) | `resolver.test.ts:3918` (`@ts-expect-error` negative) | owned |
| `resolver.ts` | `StatKind` (type) | used inside `resolveContext` (line 44) | incidental — never the subject of an assertion |
| `resolver.ts` | `StatKindReader` (type) | — | **NO CASE** — imported nowhere in the test file; no `satisfies` check |
| `resolver.ts` | `GitPluginRootResult` (type) | `resolver.test.ts:2184` (`gitCtx` parameter) | owned via slice B |
| `resolver.ts` | `ResolveContext` (interface) | `resolver.test.ts:41, 608, 1339, 1411, 1442` | owned |

## Branch census

Branches with no case, classified.

**(a) Reachable and untested — findings:**

| Location | Branch | Why reachable |
| --- | --- | --- |
| `resolver.ts:525` | `manifest?.[kind] !== undefined` | a `plugin.json` may declare a top-level unsupported kind |
| `resolver.ts:533` | `nestedExperimentalValue(entry, kind)` | a marketplace entry may carry `experimental.themes` |
| `resolver.ts:548` | `statKind(...) === convention.kind` false-on-an-existing-path | a `themes` file / `settings.json` directory |
| `resolver.ts:755, 759` | the `typeof … === "boolean"` degrade arms | documented at 741–749 as reachable by design |
| `resolver.ts:860` | `assertSafeName` throw | `PLUGIN_ENTRY_SCHEMA.name` is an unvalidated `Type.String()`; owned only from `list.test.ts` |
| `resolver.ts:931` | `value === null` | `"skills": null` is legal JSON |
| `resolver.ts:1345–1348` | `applyMcpValue(mcp === undefined)` early return with `detail = false` | loose mode only — slice B territory, flagged for that slice |
| `resolver.ts:598` | `case "npm"` | covered at `resolver.test.ts:2276` (slice B) — **not** a gap; listed to close the enumeration |

**(b) Unreachable by real input — production dead code, not test gaps:**

| Location | Why |
| --- | --- |
| `resolver.ts:1484–1491` | `addUnsupportedKindNotes`'s `dirty` return; sole caller discards it |
| `resolver.ts:796, 808, 823, 828, 871, 892, 904` | the `...partial.notes` spread is invariantly `[]` at every preflight short-circuit |
| `resolver.ts:1227` | `noopCompileIf` is never invoked — `skipIfMap: true` is hardcoded at 1228 and short-circuits the handler walk |
| `resolver.ts:1226` | `ifCtx` is computed and never consumed for the same reason (this sharpens the first pass's finding — see grading) |

**(c) Compiler-forced and not removable (D-116-01a):**

| Location | Why |
| --- | --- |
| `resolver.ts:590–604` `classifySourceSupport` exhaustive switch | removing an arm fails the compile under `noImplicitReturns`; the switch is the NFR-12 forward-compat gate |
| `resolver.ts:816–830` `deriveSourcePluginRoot` result switch | same; all four arms are covered (`materialized` 2195, `escapes` 2341, `missing-subdir` 2359, `not-cached` 2376 — slice B) |
| `resolver.ts:309–329` `defaultStatKind` third return `null` | reachable only through a special file; covered at `resolver.test.ts:3574` via `/dev/null` (slice B) |

**Unreachable-branch note:** none of the four (b) entries needs prototype surgery to
reach, so this area does **not** join the four files META-FINDINGS lists under
"Decisions the fixing pass cannot make → Unreachable branches and prototype
surgery". These are ordinary deletions.

## Grading of first-pass findings

### `tests/domain/resolver.test.ts`

- **UNDERSTATED** — *Pervasive partial-field assertions instead of whole-object
  `deepStrictEqual`* (BLOCKER). The severity is right; the framing is not. Recorded
  as a thoroughness problem ("a wrong implementation that gets the field under test
  right while corrupting an untouched sibling field"), which reads as hypothetical.
  It is not hypothetical: six named wrong implementations survive all 136 cases
  (this file's six new BLOCKERs). Two of them — the hardcoded `name` and the
  unpinned `notes`/`unsupported` ordering — **also survive the 11 whole-object
  exemplars the first pass proposes as the fix**, because those exemplars all use
  the default entry name and single-element arrays. The instruction "rewrite the
  weak cases to build the complete expected `ResolvedPlugin` literal" is necessary
  but insufficient; the fixing pass must additionally vary the entry name and use
  multi-element `notes`/`unsupported` in at least one exemplar. Proposed severity
  stays BLOCKER, with the scope note attached.

- **CONFIRMED** — *`requireInstallable`/`requirePartialInstallable` throw-assertions
  keyed on `error.message.includes(...)`* (BLOCKER). Verified at 1790, 1809, 1927,
  1947 (1975 is the correct sibling in the same file). All four narrow only on
  `error instanceof Error` plus a message substring; a plain
  `Error('Plugin "p1" is not installable')` passes all four. Severity fits, and the
  first pass's advice to upgrade rather than delete is correct — I checked the
  strong set and it does not cover `requirePartialInstallable`'s
  `partialable: false` shape for the `op: "update"` arm.

- **REFUTED** — *Hooks fixtures live in the repo-wide `tests/fixtures/` directory
  rather than beside their concern* (WARNING). The premise is wrong. The finding
  states "These five JSON payloads exist solely for this file's hooks-admission
  tests". Four of the five have other consumers:
  `tests/domain/components/hooks.test.ts:253, 317, 336, 362` reads `hookify-hooks`,
  `hooks-notification-only`, `hooks-posttooluse-and-notification`, and
  `hooks-pretooluse-matcher-mix`; `tests/orchestrators/plugin/info.test.ts:4078, 4120`
  reads `ralph-wiggum-hooks` and `hookify-hooks`. They are genuinely multi-concern
  shared fixtures and the shared `tests/fixtures/` directory is where the skill's
  own rule puts them. The follow-on advice ("if a resolver split happens, move these
  five under the new hooks-concern test directory") would actively break two other
  test files and should not be carried forward.

- **OVERSTATED** — *Real `/dev/null` read instead of a case-owned temp fixture*
  (WARNING). Out of my range (line 3574) but I read it to grade. The concern is
  legitimate in principle, but the recommended remedy — "create the special file
  inside a `mkdtemp`-owned directory (e.g. a FIFO via a `mkfifo` helper)" — trades a
  read-only stat of a POSIX-guaranteed device node for spawning `mkfifo`, which is
  strictly *less* portable and adds a subprocess to a pure-domain test. The
  alternative offered ("otherwise drop the case") loses the only coverage of
  `defaultStatKind`'s third `return null` (`resolver.ts:321`) — a real branch. Correct
  severity is **INFO / accept as-is**: `/dev/null` is stable on every platform this
  suite runs on, and the case is the cheapest proof of a branch that otherwise has
  none. If it must move, the portable form is a Unix domain socket created in the
  case's own `mkdtemp` via `node:net`, not a `mkfifo` shell-out.

### `extensions/pi-claude-marketplace/domain/resolver.ts`

- **UNDERSTATED** — *Hidden environment read inside `readStandaloneHooks`*
  (WARNING). The read is real and the analysis is right as far as it goes, but the
  finding hedges: "Today the call site always passes `{ skipIfMap: true }` … so
  `ifCtx` is computed but never consumed". That is not a "today" contingency —
  `skipIfMap: true` is a **hardcoded object literal** at `resolver.ts:1228` with no
  parameter, no config, and no other call site (`readStandaloneHooks` has exactly
  one caller, `applyHooksConfig` at 1304). The value is unconditionally dead on
  every path, which means the current code calls `os.homedir()` and
  `process.cwd()` twice **per hooks-config probe** for a value that is provably
  discarded — a purity violation in a module whose header advertises it as pure,
  on every list/info/install probe of every hooks-shipping plugin. The first pass's
  *second* option ("If the value is genuinely dead … drop the computation entirely")
  is the only correct one; the first option (add `homedir`/`cwd` to `ResolveContext`)
  should be dropped, because it adds injection surface for a value nothing reads.
  Proposed severity: **BLOCKER** for the purity claim, with the fix being deletion
  of lines 1226–1227 and passing `parseHooksConfig` a null ifCtx (or whatever its
  `skipIfMap` path permits).

- **CONFIRMED** — *`.bind` used where a plain arrow expresses the same intent*
  (WARNING). `resolver.ts:1227`, verified. `JSON.parse.bind(JSON, "null") as () => null`
  is a `bind` plus a cast where `(): null => null` is both. Severity fits — and note
  it collapses into the finding above, since the line is deleted outright once
  `ifCtx` goes.

## Still clean after attack

- **`tests/domain/resolver.test.ts` — structural claims all verified.** The first
  pass's summary is accurate on every structural point and I could not falsify one:
  no `describe`, no `before`/`beforeEach`, no `test.only`/`.skip`/`.todo`, no
  process-wide `mock` from `node:test`, no `t.mock.module()`, no hand-rolled double
  standing in for `strong-mock` (none is *needed* — the resolver takes its
  filesystem and git ports as injected function parameters, which is the sanctioned
  design and should be cited as a reference implementation). The three module-scope
  values (`marketplaceRoot` at 69, `unsupportedConventionScenarios` at 91 with
  `as const`, `WRAPPED_MCP` at 1209) are all stateless constants, which the rules
  permit; `resolveContext` at 38 is a factory returning a fresh object per call.
  AAA phase comments are present and correctly ordered throughout my range.

- **No vacuous narrowing guard in my range.** I checked all 22
  `if (resolvedPlugin.state === …)` blocks in lines 1–2000 (217, 251, 340, 376, 418,
  505, 542, 582, 674, 715, 749, 801, 831, 850, 880, 1234, 1261, 1553, 1585, 1717,
  1742, 1850). Every one is preceded by an `assert.strictEqual(resolvedPlugin.state, …)`
  that fails first, so a state-flipping mutation cannot slip through an empty
  branch. The WARNING above is about future fragility, not present vacuity.

- **Every async assertion is awaited.** `assert.rejects` at 631, 1362, 1445 all
  carry `await`. No unawaited promise anywhere in my range.

- **Hermeticity holds in my range.** Two real-filesystem cases (1401, 1433); both
  `mkdtemp` under `os.tmpdir()` and both clean up in `finally` with
  `rm(..., { recursive: true, force: true })`. No writes into the repo, no fixed
  paths, no HOME read, no network, no sleeps.

- **Mutations the cases genuinely kill.** I tried these and they all die:
  (1) swapping `supported` ↔ `unsupported` in `materializableFields`
  (`resolver.ts:470–471`) — dies at 882 and at the exemplars;
  (2) flipping the `"mcpServers" in parsed` ternary in `readStandaloneMcp`
  (`resolver.ts:1074`) — dies at 1554 (bare form) **and** at 3737 (wrapped form,
  slice B, whole-object `deepStrictEqual`);
  (3) inverting the structural-precedence order in `decideResolution`
  (`resolver.ts:1635–1643`) — dies at 1878;
  (4) dropping `partialable: true` or `unsupportedKinds: r.unsupported` from
  `requireInstallable`'s partial throw (`resolver.ts:1717, 1723`) — dies at
  1995–1996;
  (5) dropping the `detectOrphanRewake` filtered-subset restriction so a dropped
  group's orphan raises the flag — dies at 2042;
  (6) wrapping the hooks EACCES in `malformed hooks.json:` — dies at 602;
  (7) wrapping the referenced-mcp EACCES — dies at 1331;
  (8) skipping the `hooksResult.value` non-empty guard in `applyHooksConfig`
  (`resolver.ts:1326`) — dies at 588/591.

- **The NFR-7 compile-time guarantee IS proven, and well.**
  `resolver.test.ts:3836–3841` holds `satisfies` checks on both discriminants
  (`installable satisfies true/false`, `state satisfies "installable"|…`) and
  3866–3930 holds five `@ts-expect-error` negatives — `pluginRoot` off the
  `unavailable` arm (3870, 3876), the gate failing to narrow (3893),
  `unavailable` not assignable to `MaterializablePlugin` (3918), and
  `defaultEnabled` absent from the false arm (3930). This is the exact
  pattern META-FINDINGS says is *missing* for `ScopedLocations`. It is a reference
  implementation and should be added to the propagation table. (`hooks-foundation.test.ts:293`
  duplicates one of these negatives; minor, worth deduping to the pairing file.)

- **`rowClaimsInstallDisabled` is correctly tested** (2613–2674, slice B): three
  data-driven loops with one sibling `test()` per row, titles interpolating the row,
  a fresh entry literal per case, plus a planted-invalid-value case at 2634 that
  proves the strict `=== false` comparison rather than assuming it. This is the one
  export in the module whose coverage I could not weaken.

## Not covered

- **No commands were run against the suite.** Per the brief, I did not run
  `node --test`, `npm run check`, or `npm run test:coverage:direct`. Every surviving
  mutation above is derived by reading the production arm and grepping the test file
  for any assertion that would observe it; each names the exact grep or line set
  that settles it, so each is checkable in one command. I did not *execute* any
  mutation.
- **Slice B (lines 2000–3949) was read only where it settles a slice-A question** —
  specifically 2160–2400 (git arms), 2605–2700 (`rowClaimsInstallDisabled`),
  3170–3200 (`commands`), 3330–3450 and 3560–3620 and 3729–3800 (whole-object
  exemplars), 3836–3930 (compile-time negatives). I did not review slice B's cases
  on their own terms and I record no findings against them.
- **`resolveLoose`'s mode-specific arms** (`collectLooseComponentKind`,
  `applyLooseMcp`, `applyMcpValue`'s `detail = false` path) are exercised entirely
  by slice B and are out of my range. The one branch-census entry I list for them
  (`resolver.ts:1345`) is flagged for that slice, not claimed as my finding.
- **The first pass's "Split assessment" section was not graded.** It is an
  architecture proposal, not a finding, and grading it needs the whole-file view
  slice B holds. I note only that its seam #5 (hooks resolution) is where my
  upgraded `ifCtx` BLOCKER lives, and its seam #2 (unsupported-kind detection) is
  where three of my new WARNINGs cluster — so those two seams have the strongest
  independent support.

## Meta-findings impact

### New cross-cutting evidence

**1. "Whole-object `deepStrictEqual`" is necessary but not sufficient, and
META-FINDINGS' leverage item 3 will under-deliver if the fixing pass treats it as
sufficient.** Two of my six BLOCKERs survive *the very exemplars the first pass
nominates as the fix*: a hardcoded `name` survives because every fixture entry uses
the same name on both sides of the comparison, and `notes`/`unsupported` ordering
survives because every exemplar's arrays are single-element. **The rule to add to
the fixing guidance: a whole-value comparison only discriminates the fields where
the arranged input and the expected literal actually differ.** An exemplar built
from the default fixture proves less than it looks like it proves. Every area with a
"compare the whole object" remediation should be re-checked for (a) fixture values
that are identical across all cases, and (b) single-element collections standing in
for ordered ones. I would expect this in `orchestrators/plugin/{list,info}.test.ts`
and every `*.messaging.test.ts`, since those are exactly the files META-FINDINGS
holds up as the reference for whole-string assertions.

**2. Closed sets are pinned negatively across the repo, and a negative pin is not a
pin.** `tests/architecture/hooks-foundation.test.ts` pins `SUPPORTED_COMPONENT_KINDS`
with a full closed-tuple comparison (line 199) and, **eight lines later**, pins
`UNSUPPORTED_COMPONENT_KINDS` with `!includes("hooks")` (line 207) — which passes for
any content, and which is why two of its eight members are unpinned repo-wide. This
is META-FINDINGS' silent-omission class (leverage item 5) appearing in a *test*
rather than in a `switch`: adding or removing a member of a closed set passes every
gate. **Recommend a repo-wide sweep for closed-set constants asserted with
`includes`/`!includes` instead of `deepStrictEqual` against the full tuple.** The
`UNSUPPORTED_COMPONENT_KINDS` case is security-relevant by its own doc comment
(T-02-25). Also note line 200 uses loose `assert.deepEqual`, not
`deepStrictEqual` — worth grepping for repo-wide.

**3. A new "gate that does not gate" for the section of that name.** The
`UNSUPPORTED_COMPONENT_KINDS` negative pin belongs in the "Gates that do not gate"
list as instance #6 — it has the same shape as the four already there (a gate whose
assertion cannot fail for the failure it exists to catch), and the fix follows the
repo's own rule that a gate wants a test that plants the violation.

**4. The WR-02/WR-03 "propagate I/O errors, wrap only parse errors" convention is
half-applied.** Two of `resolver.ts`'s four file readers follow it and two do not
(`readManifest`, `readStandaloneMcp`). Both non-conforming readers produce a *user-
visible lie*: an unreadable file renders as `malformed`. This is the same
truthfulness class as the `notify` severity work. **Check every other module with
more than one file reader** — `persistence/state-io.ts`, `persistence/config-io.ts`,
`domain/manifest.ts` — for the same split.

**5. Cross-module export ownership: three resolver exports are owned by
`tests/architecture/`, not by their pairing file.** `SUPPORTED_COMPONENT_KINDS`,
`UNSUPPORTED_COMPONENT_KINDS`, and (via `list.test.ts`) the `assertSafeName`
propagation contract. The architecture suite is acting as a pairing file for domain
exports. **Recommend the consolidation add an "exports owned outside their pairing
file" census across all 45 areas** — it is cheap to run (`grep` the export name,
subtract the pairing file) and it is the check most likely to find what a
directory-partitioned pass structurally cannot.

### Corrections to META-FINDINGS.md

- **"The `ScopedLocations` brand is never proven … A compile-time guarantee nothing
  verifies."** — the claim stands for `ScopedLocations`, but the implied absence of
  a house pattern does not. `tests/domain/resolver.test.ts:3836–3841` and
  `3866–3930` prove the NFR-7 discriminated-union guarantee with `satisfies` checks
  on both discriminants plus **five** `@ts-expect-error` negatives, including the
  narrowing-gate negative and the union-assignability negative. **Correction:** add
  a row to the "Patterns to propagate" table —
  *Proving a compile-time type guarantee* → `tests/domain/resolver.test.ts:3836–3930`.
  The `ScopedLocations` fix is then propagation, not invention, consistent with the
  document's own thesis.

- **"Decisions the fixing pass cannot make → 1. Unreachable branches and prototype
  surgery," listing four files.** `domain/resolver.ts` has four unreachable/dead
  regions (`addUnsupportedKindNotes`'s `dirty` return, five `...partial.notes`
  spreads, `ifCtx`, `noopCompileIf`) and **none of them requires prototype surgery
  or an operator decision** — no test props them up, and all four are ordinary
  deletions. **Correction:** the "unreachable branch" category should be split in
  the document between *propped up by prototype-patching tests* (the four files
  listed, genuinely an operator decision) and *plain dead code* (this module, and
  probably others), which the fixing pass can delete without escalation.

- **"Module splits … `domain/resolver.ts` (6 responsibilities)."** Confirmed as a
  reasonable proposal, with one addition the first-pass split assessment missed: the
  split should be **sequenced after** the `name`/`agents`/closed-set BLOCKERs above
  are fixed, not before. Those three are one-line-each test additions to the current
  file; moving 2500 lines first makes them three separate merges into three new
  files.

### Confirmations

- **"Clean verdicts are not reliable" (Provenance).** Confirmed from a second angle,
  and more sharply than expected: this area's first-pass file recorded **no** clean
  files at all — its `### Clean files` lists both read `(none)` — and it still
  produced six surviving mutations, all in territory it had already looked at and
  described as sound. The unfalsified negative here was not a *file* declared clean
  but a *summary sentence* ("Structurally the suite is sound"), which is a category
  the adversarial brief does not currently name. **Suggest the consolidation treat
  first-pass Summary prose as a third class of unfalsified negative**, alongside
  clean lists and unrecorded files.

- **"Sibling drift is the dominant shape."** Independently confirmed four times in
  one module: `hooks-foundation.test.ts:199` vs `:207` (closed-tuple pin vs
  negative pin, eight lines apart); `resolver.ts:1148/1213` vs `634/1072`
  (read-outside-try vs read-inside-try); `resolver.test.ts:1851` vs `1787/1907/1924`
  (exact `pluginRoot` vs `typeof`); `resolver.test.ts:966/1170` vs the 22
  `if (state === …)` guards (assertion-function narrowing vs branch narrowing). In
  every case the correct form is in the same file or the file next door, so the fix
  is propagation. This is the strongest support I can give for the document's
  cost claim.

- **"Direct per-pair coverage was never measured."** Confirmed for this area and
  worth flagging as a false-comfort risk: `domain/resolver.ts` would likely report
  high line coverage from `resolver.test.ts` alone while carrying all six of the
  surviving mutations above — `agents` is *executed* on every resolve (the
  `SUPPORTED_COMPONENT_PATH_KINDS` loop runs it), `name` is *assigned* on every
  path, and the `notes` array is *built* every time. **Line coverage would not
  reveal a single one of them.** When the direct-coverage gate is finally run, the
  numbers should not be read as evidence about assertion strength.
