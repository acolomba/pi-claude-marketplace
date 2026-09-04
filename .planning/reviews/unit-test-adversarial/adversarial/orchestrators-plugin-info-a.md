# Orchestrators — plugin info (slice A) — adversarial re-review

**Scope:** `tests/orchestrators/plugin/info.test.ts` lines 1–2279 — the file
helpers (`withFsPromiseFault`, `makeMockCredentialOps`, `makeMockGitOps`,
`makeCtx`, `withHermeticHome`, `seedPathMarketplace`, `seedMaterializedHooks`,
`seedWarmMirror`, `seedWarmSubdirMirror`) and the 36 cases in the (a)–(k)
section banners plus the INFO-09/10/11 and D-100-03 manifest-absent clusters —
together with the arms of
`extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` those cases
exercise: `isLocallyResolvable`, `isGitSource`, `derivePluginRootForInfo`,
`nameFromEntry`, `readEntriesOrEmpty`, `discoverComponentNames`,
`normalizeDependencies`, `readHookSummaryEntries`, `readLenientHookSummary`,
`readLenientHooksFile`, `parseLenientHooksJson`, `composeResolvedComponents`,
`buildBlock` arms (a)–(e), `wrapBlock`, `buildStateOnlyInstalledRow`,
`composeStateOnlyComponents`, `derivePersistedInstalledStatus`,
`sortComponentNames`, `buildNotInstallablePathRowFields`,
`deriveLenientComponentPaths`, `asDeclaredList`, `buildNonInstallableRowFields`,
`buildNonPathInstalledRow`, `buildInstalledRow`, `buildNotInstalledRow`,
`buildNotInstalledNonInstallableRow`, `buildNotInstalledPathRow`,
`buildAvailableRow`, `applyDisabledRowShape`, and `getPluginInfo`'s
zero/one/two-scope dispatch.
Supporting source read to settle mutations: `domain/resolver.ts`
(`readManifest`, `validateComponentPath`, `defaultStatKind`, `decideResolution`),
`shared/probe-classifiers.ts` in full, `domain/manifest.ts` error shapes,
`domain/components/plugin.ts` schema, `domain/components/hooks.ts`
`HookConfigParseResult`, `persistence/state-io.ts::isRecordedButDisabled`,
`tests/edge/handlers/marketplace-seed.ts`, and out-of-range cases 6300–6455,
6457–6531 (to check whether siblings kill a candidate mutation — two did).
**First-pass file:** `unit-test-findings/orchestrators-plugin-info.md`
**Clean files attacked:** 0 declared. The first pass's `### Clean files` section
for this area says "No other files in scope", so there is no unfalsified-negative
list to attack. In its place I ran the mutation catalogue directly against every
production arm the slice exercises, and against the slice's own cases.
**Existing findings graded:** 8 (4 test + 4 production)

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 3 |
| New WARNING (missed by first pass) | 7 |
| Existing CONFIRMED | 7 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

## New findings — from the mutation attack

### `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`

- **[BLOCKER] The D-64-05 lenient component-path re-derivation reads
  author-declared paths with NO containment check — an absolute or
  `..`-escaping declared path is `readdir`-ed verbatim and its directory names
  are rendered to the user** — `info.ts:1308–1327` (`deriveLenientComponentPaths`),
  `info.ts:310` (`discoverComponentNames`'s `path.isAbsolute(rel) ? rel : …`).

  The resolver refuses these paths on purpose:
  `domain/resolver.ts:978–984` rejects an absolute component path
  (`component path for "<kind>" must be relative`) and `:986–997` rejects one
  that escapes the plugin root, each pushing a note that sets `structuralDirty`
  (`resolver.ts:1030, 1048`) so `decideResolution` (`resolver.ts:1635`) returns
  `unavailable`. `info.ts` then routes that verdict to
  `buildNonInstallableRowFields`' `unavailable` arm (`info.ts:1369–1378`), which
  calls `deriveLenientComponentPaths(entry)` — and that function re-reads the
  SAME raw entry field with only a `typeof d === "string"` guard, re-admitting
  exactly the path the resolver just refused. `discoverComponentNames` then
  honours `path.isAbsolute` and calls `readEntriesOrEmpty(abs)` with no
  `assertPathInside`. This is the one read path in the file that skips the
  chokepoint the file otherwise applies religiously —
  `derivePluginRootForInfo` (`:241`) and `readStateOnlyHookEntries` (`:497`)
  both assert containment before touching disk.

  The file's own test proves the mechanism: `info.test.ts:6402`
  (`component discovery ignores wrong entry kinds and accepts an absolute
  in-root directory`) seeds `skills: ["skills", absoluteSkills]`, the row
  renders `(unavailable) {unsupported source}` — i.e. the resolver DID refuse
  the absolute path — and the very next line pins `skills: bravo`, read from
  that absolute path anyway. Point `absoluteSkills` outside the marketplace
  root (`/etc`, or `skills: ["../../../.."]`) and `plugin info` enumerates that
  directory into the notification. `list.ts` has no equivalent hole (grep: it
  never calls `discoverComponentNames` and declares no `componentPaths`), and
  `bridges/{skills,commands}/discover.ts` use the same `isAbsolute` shape but
  consume resolver-VALIDATED `componentPaths`, so info is the only surface that
  re-derives unvalidated ones.

  Fix: add the chokepoint at the read site, which also covers the
  `installable`/`partially-available` arms for free — in
  `discoverComponentNames`, before `readEntriesOrEmpty(abs)`, call
  `await assertPathInside(pluginRoot, abs, \`component path "${kind}"\`)`. The
  `PathContainmentError` then folds through
  `buildNotInstallablePathRowFields`'s existing catch (`info.ts:1289`) into the
  closed-set `{unreadable}` reason, exactly as `derivePluginRootForInfo`'s
  containment throw already does. With the guard in place the
  `path.isAbsolute(rel)` branch at `:310` has no remaining producer and can be
  deleted. **Operator decision required:** `info.test.ts:6402` currently PINS
  the absolute-in-root behaviour as intended, so the fix changes that case's
  expected bytes; decide whether an author-declared absolute path the resolver
  refuses should be enumerated at all. Paired test: add a sibling to case 705
  seeding `skills: ["/etc"]` (or `["../.."]`) and pin the full message with no
  `skills:` line.

- **[WARNING] `readHookSummaryEntries`' defensive `Object.assign` default is
  unreachable, and its doc comment narrates code that no longer exists** —
  `info.ts:402–409` (comment), `:437` (the `Object.assign`).
  `parseHooksForInfo` returns `HookConfigParseResult<null>`
  (`domain/components/hooks.ts:193–200`), whose `{ok:false}` arm carries no
  `value`/`dropped`, which is what the `Object.assign({value:{},dropped:[]}, …)`
  fallback exists for. That arm cannot be reached here: this reader runs only
  when the resolver recorded `hooksConfigPath`, which it does only after its own
  successful `parseHooksConfig` of the same file, and info re-parses with
  `skipIfMap: true` (strictly more permissive). Classify as a defensive branch,
  not a test gap. Separately, the comment's "just as it did before this private
  coverage simplification" is narration of a removed shape, forbidden by
  `.claude/rules/typescript-comments.md`; restate the rationale in the present
  tense or drop the clause.

- **[WARNING] `buildNotInstalledRow`'s `resolveStrict`-throw catch is reachable
  but has no case** — `info.ts:1970–1987`. `defaultStatKind`
  (`resolver.ts:310–328`) rethrows every errno except `ENOENT`, so an `EACCES`
  on a plugin source directory makes `resolveStrict` throw and this arm produce
  a bare `(unavailable) {permission denied}` row with
  `componentsResolved: false`. No case renders that shape: `info.test.ts:4393`
  is the inner `buildNotInstallablePathRowFields` catch
  (`{unsupported hooks, permission denied}`), `:6579` is
  `buildNotInstalledPathRow`'s containment catch (`{unreadable}`), and `:1472`
  is `buildAvailableRow`'s catch. The test helper `withFsPromiseFault` only
  faults `readFile`/`readdir`, so covering it needs a third faultable method
  (`stat`) or the `fsOps` seam the first pass already recommends.

### `tests/orchestrators/plugin/info.test.ts`

- **[BLOCKER] `WR-02: not-installed plugin with malformed plugin.json surfaces
  `{unparseable}` …` asserts a reason token production never emits, and locks
  nothing about the invariant it names** — `line 1212` (title), `lines
  1243–1259` (comment + assertions).

  Traced end to end: `resolveStrict` does not throw for a malformed
  `plugin.json`. `readManifest` (`resolver.ts:633–651`) catches the
  `SyntaxError` and returns
  `{ok:false, reason: "malformed plugin.json: …"}`; `resolver.ts:900–906` turns
  that into `unavailable(entry.name, [...notes, reason])`. `info.ts` then calls
  `narrowResolverNotes`, and `classifyResolverNote`
  (`shared/probe-classifiers.ts:126–152`) matches none of the hooks prefixes,
  not `malformed mcp reference`, and does not contain `lspServers`, so it falls
  to the catch-all `"unsupported source"`. The rendered row is
  `⊘ broken v1.0.0 (unavailable) {unsupported source}` — `narrowProbeError` is
  never reached on this path, so the case cannot prove anything about the
  `unreadable`-vs-`unparseable` classification it claims to lock. The
  `assert.doesNotMatch(msg, /\(unavailable\) \{unreadable\}/)` at 1255 passes
  vacuously. Corroborated independently by `info.test.ts:6449`, which pins
  `{unsupported source}` for a structurally-refused component path through the
  same arm.

  Fix: replace the whole assertion block with
  `assert.equal(notifications[0]!.message, ["● mp [user] <no autoupdate>", "  ⊘ broken v1.0.0 (unavailable) {unsupported source}"].join("\n"))`
  plus `assert.equal(notifications[0]!.severity, undefined)`, retitle to
  `"a not-installed plugin with a malformed plugin.json renders (unavailable) {unsupported source}"`,
  and delete the 1243–1252 comment (its "either outcome is acceptable" hedge is
  false — the outcome is deterministic). The WR-02 invariant the old title
  claimed is then genuinely unowned; give it a real owner by adding a case that
  makes `resolveStrict` THROW (see the `buildNotInstalledRow` catch finding
  above), which is the only path on which `narrowProbeError` decides the
  not-installed row's reason.

- **[BLOCKER] `buildBlock` arm (a) classifies the manifest-read failure through
  `narrowProbeError`, but only the ENOENT cell has a case — hardcoding
  `"source missing"` survives all 129 cases** — `info.ts:786–797`; covering
  cases `info.test.ts:1270` (`WR-03`) and `:1319` (`BOUND-01`), both ENOENT.

  Mutating `info.ts:793` from `reasons: [narrowProbeError(err)]` to
  `reasons: ["source missing"]` leaves the entire file green. Two of the
  ladder's cells are reachable from ordinary on-disk state and untested:
  `loadMarketplaceManifest` throws `InvalidMarketplaceManifestError` with a
  `SyntaxError` cause for a malformed `marketplace.json`
  (`domain/manifest.ts:55–65`) → `{unparseable}`, and the SAME typed error with
  no cause for a schema-invalid one (`manifest.ts:76`) → `{invalid manifest}`.
  Grep confirms neither `(failed) {unparseable}` nor `{invalid manifest}` appears
  anywhere in `info.test.ts`. This is exactly the cross-surface-parity claim the
  file's own banner at `lines 1018–1035` and `1263–1268` says it is enforcing.

  Fix: add two sibling cases beside `line 1270`, seeded the way
  `info.test.ts:6422` already does it (write the fixture, then overwrite
  `<mpRoot>/.claude-plugin/marketplace.json`): one with `"{ not json"` pinning
  `["A plugin operation has failed.", "", "● mp [user] <no autoupdate>", "  ⊘ x (failed) {unparseable}"].join("\n")`
  and severity `"error"`; one with a schema-valid-JSON-but-invalid-manifest
  payload (e.g. `{"name":"mp","plugins":"not-an-array"}`) pinning the same
  literal with `{invalid manifest}`.

- **[WARNING] The case-insensitive component-name ordering is never
  discriminated — `sortComponentNames`/`discoverComponentNames` degraded to a
  plain code-unit `.sort()` passes every case** — fixture `line 1883`, expected
  `line 1907`.
  `INFO-11` is the only case in the file that seeds a mixed-case name list
  (`skills: ["alpha-skill", "Alpha-other"]`) and pins
  `skills: Alpha-other, alpha-skill`. Verified with a throwaway node run: plain
  `.sort()` and `localeCompare(…, {sensitivity:"base"})` return the SAME order
  for that pair, so the comparator at `info.ts:320, 1236` is unproven. Every
  other component fixture in the file is single-case.
  Fix: change the fixture to `skills: ["alpha-skill", "Beta-other"]` and the
  expectation to `"    skills: alpha-skill, Beta-other"` — plain `.sort()` yields
  `Beta-other, alpha-skill` there, so both the locale comparator and the
  `sensitivity: "base"` option become load-bearing.

- **[WARNING] `normalizeDependencies`' non-string filter has no case** —
  `info.ts:338`; cases at `lines 1481, 1517, 1601`.
  Every `dependencies` fixture in the file is either a homogeneous string array,
  `[]`, or an object. Deleting `raw.filter((d): d is string => typeof d === "string")`
  survives all of them. `dependencies` is `Type.Optional(Type.Unknown())`
  (`domain/components/plugin.ts:83`), so `["helper@utils-mp", 42]` is real
  untrusted input.
  Fix: add one case beside `line 1601` seeding
  `dependencies: ["helper@utils-mp", 42, null]` and pinning
  `"    dependencies: helper@utils-mp"` as the only dependencies line.

- **[WARNING] `discoverComponentNames`' cross-directory de-duplication has no
  case** — `info.ts:308–320`; nearest case `line 705`.
  Case 705 walks two search paths (`skills` — absent — and `extra`) but they
  cannot collide, so replacing the `Set<string>` with a pushed array survives.
  A plugin declaring `skills: ["skills", "extra"]` with `skills/foo` and
  `extra/foo` on disk is ordinary input and would render `skills: foo, foo`.
  Fix: extend case 705's `componentDirs` to
  `{ legacy: ["extra/es1", "skills/es1"] }` and keep the expected line at a
  single `skills: es1`.

- **[WARNING] Four doc comments in the test file state facts its own fixtures
  contradict** — `lines 302–312`, `1029–1034`, `1956–1957`, `10–28`.
  1. `SeedPathMarketplaceOpts.installed`'s comment (302–312) says
     `disabled: true` "seeds the ENBL-02 empty-resources marker" and that "the
     empty-resources + installable:true intersection IS the disabled marker".
     Both are false: the seeder at `lines 365–373` never branches on `disabled`
     (a disabled record still gets `skills: ["<name>-skill"]`), and
     `isRecordedButDisabled` is literally `!record.enabled`
     (`persistence/state-io.ts:252–254`). `tests/edge/handlers/marketplace-seed.ts:8–11`
     repeats the same false claim about this file and should be corrected with
     it. This matters because a reader acting on the comment would "restore"
     empty resources and silently change every disabled-row case.
  2. The WR-01 banner (1029–1034) says an end-to-end test of the throw branch
     "requires an FS-level fault injection that is not portable across CI
     sandboxes" — the file's own `withFsPromiseFault` (72–105) is exactly that,
     used at 1425, 1465, 2495, 4384, 4442, 6725, 6778. Delete the excuse and
     replace it with the real gap (the `stat` path, see above).
  3. `line 1956–1957` claims the hooks block "lands between the `commands` and
     `mcp` lines"; that case's fixture declares neither, so it proves only
     `hooks:` before `skills:`. Either add `prompts` and `mcpServers` to the
     fixture or drop the claim (the ordering is pinned at `line 3840`).
  4. The file header's `Coverage:` list (10–28) enumerates letters (a)–(k) and
     stops there, while the file now holds 129 cases across the INFO-09/10/11,
     D-96-03, D-100-03/07/08, ENBL-*, RSTA-*, FTCH-*, OUT-03 and ADMIT-02
     clusters. Replace the letter list with a pointer to the section banners,
     which are accurate.

- **[WARNING] 10 of the 36 slice-A cases omit the severity assertion the other
  26 make** — `lines 1044, 1212, 1392, 1439, 1481, 1517, 1556, 1601, 1652, 2009`.
  Severity is a promise of this surface (info for a record, `error` for a
  `(failed)` row), and the majority convention in this very file asserts it.
  Fix: add `assert.equal(notifications[0]!.severity, undefined);` to each of the
  ten, immediately before the message assertion, matching `line 564`.

## Export ownership census

`info.ts` has exactly three exports (`grep -n "^export"` → 102, 148, 2239):

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `info.ts` | `getPluginInfo` (`:2239`) | 36 cases in slice A; 129 file-wide | owned |
| `info.ts` | `GetPluginInfoOptions` (`:102`) | every call site (compile-time); `fetch` / `cloneCacheSeam` / `credentialOps` / `deviceFlowHttp` / `authMemo` are exercised only in slices B/C | owned — no runtime case is possible or needed for an options interface |
| `info.ts` | `InfoCloneCacheSeam` (`:148`) | imported at `info.test.ts:53`, used as the `fetchSeamWith` return type (slice C) | owned outside this slice |

No orphaned exports; nothing exported solely for a test. The former
`__test_narrowProbeError` re-export is gone (its orphaned comment is the first
pass's finding, confirmed below). Every other symbol in the file is
module-private, which is why the mutation attack had to go through
`getPluginInfo` end to end.

## Branch census

Classified for the arms slice A exercises.

**Reachable and untested (findings above):**
- `buildBlock` arm (a) `narrowProbeError` cells `unparseable` and
  `invalid manifest` (`info.ts:793`).
- `buildNotInstalledRow`'s `resolveStrict`-throw catch (`info.ts:1970–1987`).
- `deriveLenientComponentPaths` admitting an absolute / escaping declared path
  (`info.ts:1318–1323`) and `discoverComponentNames` reading it (`:310`) — the
  containment BLOCKER; behaviour untested in either direction outside the
  in-root case at `info.test.ts:6402`.
- `normalizeDependencies`' non-string filter (`info.ts:338`).
- `discoverComponentNames`' `Set` de-duplication (`info.ts:308, 315`).
- The `sensitivity: "base"` comparator in `discoverComponentNames` (`:320`) and
  `sortComponentNames` (`:1236`).

**Unreachable by real input (production defensive code, not test gaps):**
- `readHookSummaryEntries`' `Object.assign({value:{},dropped:[]}, …)` fallback
  (`info.ts:437`) — the `{ok:false}` arm cannot occur after the resolver
  recorded `hooksConfigPath`; see the finding above.
- `readEntriesOrEmpty`'s `err instanceof Error` guard (`info.ts:292`) — Node's
  `fs` never rejects with a non-`Error`, so the `throw err` fall-through for a
  non-`Error` carrying `code: "ENOENT"` is unreachable.
- `readLenientHookSummary`'s `data === null` arm (`info.ts:573`) is folded into
  the same `typeof data !== "object"` condition and is dead only in the sense
  that `JSON.parse("null")` reaches it — that one IS reachable (a `hooks.json`
  containing the literal `null`); covered in slice C's SURF-01 block.

**Compiler-forced and not removable (D-116-01a category):**
- `isLocallyResolvable`'s exhaustive `switch (src.kind)` with no `default`
  (`info.ts:189–198`) and `buildNonInstallableRowFields`' exhaustive
  `switch (resolved.state)` (`:1361–1379`). Both are the repo's deliberate
  no-default exhaustiveness idiom under `noImplicitReturns`; adding a `default`
  would remove the compile-time guarantee. Not findings.

**Well covered (verified, see Still clean):** `buildBlock` arms (b)–(e), the
installed/partially-installed status ternaries at `:1668` and `:1730`,
`derivePersistedInstalledStatus`' `.length > 0`, `applyDisabledRowShape`'s
status override, `composeStateOnlyComponents`' record/file/empty-key ladder,
`readStateOnlyHookEntries`' `slugs.length === 0` arm, `getPluginInfo`'s
zero-scope / one-scope / two-scope-all-failed dispatch, and the project-first
scope order.

## Grading of first-pass findings

### `tests/orchestrators/plugin/info.test.ts`

- **UNDERSTATED** — *33 of 129 cases assert only a regex fragment* — the eight
  in-slice members (705, 1212, 1270, 1392, 1439, 1481, 1517, 1556) are all real;
  an independent `awk` scan of lines 1–2279 for
  `assert.(match|doesNotMatch|ok|notStrictEqual)` returns exactly those eight
  plus the harmless supplementary negative at 912. It is worse than recorded on
  two counts. (i) One member (1212) is not merely weak — its title and comment
  assert a token production never emits, so strengthening the assertion is not
  enough; the case has to be re-derived (separate BLOCKER above). (ii) The
  recorded fix says "enumerate every line the fixture is known to produce"
  without saying what those are; every in-slice member's full expected message
  is computable now, so the fixing pass need not re-derive them:
  - 705 → `["● mp [user] <no autoupdate>", "  ⊘ legacy v0.1.0 (unavailable) {unsupported hooks}", "    skills: es1"]`
  - 1212 → `["● mp [user] <no autoupdate>", "  ⊘ broken v1.0.0 (unavailable) {unsupported source}"]`
  - 1270 → the four-line literal already written verbatim 50 lines below at
    `lines 1371–1376`, with `x` for `alpha`
  - 1392 → `["● mp [user] <no autoupdate>", "  ● p v1.0.0 (installed) {permission denied}", "    Installed unreadable plugin.", "    components: not resolved"]`
  - 1439 → `["● mp [user] <no autoupdate>", "  ○ p v1.0.0 (available) {permission denied}", "    components: not resolved"]`
  - 1481 / 1517 → `["● mp [user] <no autoupdate>", "  ● p v1.0.0 (installed)", "    skills: s1"]`
  - 1556 → the same with `"    skills: alpha, zeta"`
  Proposed severity stays BLOCKER for the group; 1212 should be split out as its
  own BLOCKER.
- **CONFIRMED** — *`verify()` for the `strong-mock` doubles is hidden in a shared
  `finally`* — verified at `line 238` (module-scope
  `pendingInteractionVerifications`), `260–264` (push inside `makeCtx`),
  `282–284` (`splice(0)` drain in `withHermeticHome`'s `finally`). The
  error-masking risk is real for every slice-A case, since all 36 call
  `makeCtx()` inside the `try`. One aggravating detail to add to the fix ticket:
  because the array is module-scope and drained by `splice(0)`, a `makeCtx()`
  call that ever lands OUTSIDE a `withHermeticHome` body would have its
  verification executed in the NEXT case's `finally` and reported as that case's
  failure. No such call exists today (checked all 131 `makeCtx(` sites), but
  nothing prevents one.
- **CONFIRMED** — *`startsWith` where full equality was cheap* (`3557–3560`) —
  outside my range; verified by reading and independently confirmed by slice B.
- **CONFIRMED** — *lower-bound-only call-count assertions* (`5105`, `5374`,
  `5439–5440`) — outside my range; verified by reading those lines.

### `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`

- **CONFIRMED** — *dangling comment for the removed `__test_narrowProbeError`
  export* (`2376–2378`) — the file ends at 2378; `grep -n "^export"` returns only
  102, 148, 2239.
- **CONFIRMED** — *redundant `as Record<string, unknown>` casts* (`838`, `845`,
  `1319`) — `domain/components/plugin.ts` declares `skills`/`commands`/`agents`
  at lines 30–32, `source` at 67 and `dependencies` at 83 all as
  `Type.Unknown()`, so the casts add nothing. Note for the fixing pass: the cast
  at 1319 sits inside `deriveLenientComponentPaths`, which is also the subject of
  the containment BLOCKER above — fix them together.
- **CONFIRMED** — *`homedir()` / `process.cwd()` hidden reads* (`397`, `437`) —
  verified, including the sibling contrast (`readStateOnlyHookEntries` threads
  `cwd` at `:499` while `readHookSummaryEntries` hardcodes `process.cwd()` at
  `:437`).
- **CONFIRMED** — *no injectable fs port forces `withFsPromiseFault` global
  monkey-patching* — verified: direct `readdir`/`readFile` imports at `info.ts:27`;
  the helper rewires `fs.promises` via `Object.defineProperty` +
  `syncBuiltinESMExports` (`info.test.ts:78–104`), which is prototype/global
  modification on the google-style quick-scan list. Strengthening note: the
  proposed `fsOps` seam should carry `stat` as well as `readdir`/`readFile`, or
  the `buildNotInstalledRow` catch arm stays uncoverable (see branch census).

### First-pass "Should `info.ts` be split?" section

Not a finding, but its inventory holds up against my read: the
component-discovery, hooks-reading, state-only and row-shape clusters it names
are genuinely disjoint in what they exercise. One correction — the section
attributes `derivePluginRootForInfo`, `isLocallyResolvable` and `isGitSource` to
the "orchestration core", but `derivePluginRootForInfo` is only ever called from
`buildNotInstallablePathRowFields`, so it belongs with `info-components.ts`
alongside the containment fix.

## Still clean after attack

Named mutations the slice's cases genuinely kill:

- **Whole-message pinning works.** 26 of 36 slice-A cases pin the complete
  rendered string against a hand-written literal, so every "message and
  rendering mutation" in the catalogue dies at once: dropping any line, changing
  one word, swapping a glyph (`●`/`○`/`⊘`/`◉`/`◍`/`⊖`), reordering the fixed
  kind order (`agents, commands, hooks, mcp, skills`), changing the indent, or
  altering the `<glyph> <name> [scope] (status) {reason}` grammar. Case 554's
  `EXPECTED_FOO_INSTALLED_INFO` and case 1601 pin three and four component
  lines respectively.
- **`nameFromEntry`'s entry-kind filters are NOT a gap.** I raised the mutation
  (drop `entry.isDirectory()` for skills, drop `isFile() && endsWith(".md")` for
  commands/agents) and then killed it by reading outside my range:
  `info.test.ts:6402` plants `skills/not-a-skill.md`, `commands/not-a-command/`,
  `commands/not-markdown.txt`, `agents/not-an-agent/` and
  `agents/not-markdown.txt` and pins a message with no commands or agents line.
  Reporting it would have been a false positive.
- **The `.md` suffix strip is exact.** `.slice(0, -3)` off-by-one in either
  direction fails case 554 (`commands: c1`, `agents: a1`).
- **Autoupdate marker inversion** dies at case 805, which pins
  `<autoupdate>` for project and `<no autoupdate>` for user in one message.
- **Scope-order reversal** dies at 805 and 963 (both pin project block first).
- **Cross-scope flag mutations** die at 863
  (`{marketplace not added to user scope}`) vs 899 (bare
  `{marketplace not added}` with no bracket).
- **Notify-count mutations** die twice over: `assert.equal(notifications.length, N)`
  and strong-mock's `.times(expectedNotifications)` on `ctx.ui`, `ui.notify` and
  `pi.getAllTools()` — an extra call throws at call time, a missing one at
  `verify`.
- **Silencing the failed-scope loop** dies at 963, which pins two `error`
  notifications with two full summary-bearing messages and proves the
  `infoBlocks`-empty branch of `getPluginInfo:2353–2361`.
- **BOUND-01 arm ordering** — moving the record lookup above the manifest-read
  catch dies at 1319, which seeds a fully populated installed record behind an
  unreadable manifest and pins the failure row.
- **Hook read-ladder source swaps** die at 2062 / 2113 / 2159, which seed
  DIVERGENT record and file content so "the wrong source won" produces different
  bytes; the present-but-empty key case kills the
  `undefined || length === 0` collapse.
- **Hook declaration-order sorting** dies at 1960 vs 2009 (same two events, both
  orders pinned).
- **`derivePersistedInstalledStatus` inversion** dies at 1793 vs 1830, and its
  non-path twin at 760 vs 1159.
- **`applyDisabledRowShape` status override removal** dies at 1743 (`◍ … (disabled)`
  on a record whose arm derived `installed`).
- **`withFsPromiseFault` is not a silent no-op.** `assert.equal(faultRaised, true, …)`
  at `line 99` fails loudly if the patched method is never called with the target
  path — so a refactor that stopped reading the faulted directory could not pass
  as a green EACCES test. This is the right shape and worth copying.
- **The git fake carries an allow-list.** `makeMockGitOps` passes
  `allowedRemoteUrls: ALLOWED_INFO_REMOTES` (`lines 133–161`), i.e. the
  fail-loudly-on-unplanned-input pattern META-FINDINGS recommends adopting from
  `fetch.test.ts` is already adopted here.
- **`makeMockGitOps` / `makeMockCredentialOps` naming** is sanctioned by this
  repo's `CONVENTIONS.md` (`makeMock*` factory prefix), not a finding despite the
  generic skill rule against kind-named doubles.

## Not covered

- Lines 2280–6980 of `info.test.ts` belong to slices B and C. I read
  6300–6455 and 6457–6531 to settle two candidate mutations, and spot-checked
  2291–2560 and 4330–4460 for reason-token coverage, but did not review those
  ranges case by case.
- `info.messaging.ts` / `info.messaging.test.ts` — out of scope for this area.
- `tests/platform/git-ops-fake.ts` and `tests/platform/credential-ops-fake.ts` —
  read only at the surface `makeMockGitOps` / `makeMockCredentialOps` depend on.
  `tests/edge/handlers/marketplace-seed.ts` was read in the parts slice A uses
  (`buildInstalledPluginRecord`, `materializeMarketplaceTree`,
  `mergeMarketplaceIntoState`, `seedAutoupdateConfig`); its
  `as unknown as Parameters<typeof saveState>[1]` double assertion is already
  owned by the edge-handlers area and by META-FINDINGS.
- The containment BLOCKER was traced by reading, not executed — I did not run
  `info --fetch`-free repro against a real `/etc`, per the no-mutation rule. The
  three facts it rests on are each independently verifiable from source:
  `resolver.ts:978–984` refuses absolute paths, `info.ts:1318–1323` re-admits
  them, `info.ts:310` reads them.
- No toolchain command was run (per brief); every claim is from reading, from
  read-only greps, and from one throwaway `node -e` comparing two sort
  comparators on a literal array.

## Meta-findings impact

### New cross-cutting evidence

- **A read-site containment chokepoint that one arm bypasses.** The
  `deriveLenientComponentPaths` → `discoverComponentNames` path is a real
  NFR-10-shaped hole in a file that applies `assertPathInside` at two other read
  sites. The generative pattern is: *a surface that re-derives untrusted input
  the validator already refused, in order to render more*. Other surfaces that
  re-derive from raw manifest entries after a resolver rejection should be
  audited the same way — grep for consumers of raw `entry[kind]` /
  `asDeclaredList`-shaped normalizers outside `domain/resolver.ts`. META-FINDINGS
  lists "NFR-10 path containment is thoroughly tested against real filesystems
  including symlink escapes" among its **falsified hypotheses / confirmations**;
  that claim is true for the `assertPathInside` chokepoint itself and false for
  the paths that never reach it. Recommend adding a repo-wide check: every
  `readdir`/`readFile` whose path derives from marketplace-manifest or
  `state.json` data must pass through `assertPathInside` first.
- **Classifier ladders with one exercised cell.** `narrowProbeError` has five
  outputs; `info.ts` arm (a) reaches it on every manifest-read failure but only
  the `source missing` cell has a case, so a hardcode survives. The same
  ladder is called from `list.ts`, `marketplace/info.ts` and four more sites in
  `info.ts` itself. Worth a cheap sweep: for each `narrowProbeError` /
  `classifyGitTransportFailure` call site, count how many of the ladder's cells
  any test actually pins. This is the classifier cousin of the
  reason-set-membership gap slice B found in `DISABLED_ROW_REASONS`, and of the
  "restore exhaustiveness on closed-union switches" item already in
  META-FINDINGS.
- **Test titles as unverified claims.** `info.test.ts:1212`'s title names a
  reason token the code cannot produce, and it survived a first pass that read
  the file in full — because the assertions are loose enough that nothing
  contradicts the title. Wherever a case's title names a specific closed-set
  token but the assertions are `match`/`doesNotMatch`, the title should be
  treated as unverified. That is a mechanical grep across the whole sweep:
  titles containing a `{token}` in backticks whose case body has no
  `assert.equal` on the message.
- **Comment drift about test infrastructure.** Three separate comments in this
  pairing describe fixtures or capabilities that do not match the code
  (`info.test.ts:302–312` on the disabled marker, `1029–1034` on FS fault
  injection being impossible, and the phantom
  `tests/orchestrators/plugin/info-manifest-absent.test.ts` slice B found at
  `info.ts:1124`, `catalog-uat.test.ts:3532`, `marketplace-seed.ts:10`). Two of
  those live in files owned by OTHER areas. A repo-wide grep for comments naming
  `*.test.ts` files that do not exist, and for helper doc comments that describe
  a branch the helper does not have, is cheap and has already returned four hits
  across three areas.

### Corrections to META-FINDINGS.md

- **"Ranked by leverage" item 3, row `orchestrators/plugin/info.test.ts` — "33 of
  129 cases".** Slice B already raised this to at least 34. My scan adds
  precision rather than count: the eight in-slice members are exactly the ones
  the first pass listed, so the ENUMERATION is sound; what is wrong is the
  implied fix. One member (line 1212) cannot be fixed by tightening the
  assertion, because the token its title names is not the token production
  emits. Treat the cluster as "32 mechanical tightenings + 2 contract
  re-derivations", not 34 mechanical ones.
- **"Patterns to propagate", row "Offline fake that fails loudly on unplanned
  input — `tests/orchestrators/plugin/fetch.test.ts` … **Adopt this in the other
  git fakes**".** Qualify it: `info.test.ts` has ALREADY adopted it
  (`ALLOWED_INFO_REMOTES` at `lines 133–142`, passed as `allowedRemoteUrls` at
  `line 161`). The propagation target list should exclude this file.
- **"Notes on the method" — the falsified-hypothesis list says "NFR-10 path
  containment is thoroughly tested against real filesystems including symlink
  escapes".** Qualify with the finding above: containment is thoroughly tested
  where `assertPathInside` is called; `info.ts:310` reads a manifest-derived path
  without calling it, and the file's own case at `info.test.ts:6402` pins the
  unguarded behaviour as intended. "Thoroughly tested" is true of the chokepoint
  and not of the surface.

### Confirmations

- **Leverage item 3 (fragment assertions) confirmed from a second angle.** For
  every one of the eight in-slice members I derived the full expected message
  from the fixture and the production path, and in each case the whole-string
  form is achievable — which is the strongest possible evidence that the
  loosened form was a choice, not a necessity. For 1270 the correct literal is
  already written verbatim 50 lines below in a sibling case.
- **Leverage item 3's fix target confirmed.** Slice B's claim that this file's
  fix is intra-file propagation, not importing the `*.messaging.test.ts`
  convention, holds for slice A too: 26 of 36 cases already use the whole-string
  form, and the newest cases in the file (from ~6120) use the strictest form of
  all, `assert.deepEqual(notifications, [...])`, which pins message, severity
  and count in one comparison. That is the form to propagate.
- **The `verify()`-in-a-shared-`finally` BLOCKER confirmed independently**, with
  a second failure mode added (module-scope array + `splice(0)` can attribute one
  case's verification failure to the next case).
- **META's core claim that clean verdicts are unreliable is confirmed in the
  variant slice B also saw.** This area declared no clean files, yet a
  case-by-case first-pass read still missed a production containment bypass, a
  test whose title contradicts the code, and an entire classifier ladder with one
  exercised cell. Attention exhaustion is a property of large files, not only of
  large partitions — and the two mutations I raised and then KILLED by reading
  outside my slice (the `nameFromEntry` filters) show the converse: a partition
  boundary also manufactures false positives if the reviewer does not cross it.
