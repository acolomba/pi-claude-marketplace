# Architecture — state, config and drift gates — adversarial re-review

**Scope:** the ten gate files named in the first-pass file, the eleven production
modules it declared clean, and the shared scanner (`tests/architecture/source-scan.ts`)
plus the one gate this area delegates to (`no-orchestrator-network.test.ts`).
**First-pass file:** `unit-test-findings/architecture-state-drift-gates.md`
**Clean files attacked:** 11 (1 test file + 10 production modules)
**Existing findings graded:** 18

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 6 |
| New WARNING (missed by first pass) | 21 |
| Existing CONFIRMED | 15 |
| Existing UNDERSTATED | 3 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's central claim about this area — "the best of these gates are model
examples… demonstrably not inert" — is **half right and half wrong**. The three gates
it praised for embedding planted twins (`manifest-lookup-drift`,
`disabled-state-classification`, `config-state-write-seams`) really do fire on the
spellings they plant. But **four of the ten gates cannot fire on the spelling the
production code itself uses**, and the first pass classified only one of them
(`manifest-read-seam`) as even a WARNING. Planting proves a pattern catches the
spellings the author thought of; it does not prove coverage.

## New findings — the inert-gate cluster

These are the assignment's primary question: *if the rule were silently removed or
the forbidden pattern introduced, would this test fail?* For four gates the answer
is no. Each was verified with a throwaway `node -e` run of the gate's own regex
against the production spelling.

### `tests/architecture/manifest-read-seam.test.ts`

- **[BLOCKER] The NFR-8 read-seam regex is directionally backwards and cannot match the repo's own read** — `line 32`
  `hasMarketplaceManifestRead` is
  `/(?:\breadFile\b|\bfs\.readFile\b)\s*\([\s\S]{0,400}?marketplace\.json/g` — it
  requires the filename to appear **after** `readFile(`. The canonical seam it
  exists to protect,
  `extensions/pi-claude-marketplace/domain/manifest.ts:52-53`, is written the other
  way round (`loadMarketplaceManifestUncached(manifestPath)` then
  `await readFile(manifestPath, "utf8")`), and so is every real path construction
  in the repo (`orchestrators/marketplace/add.ts:667`,
  `orchestrators/marketplace/update.ts:856`). Verified by running the regex:

  | planted violation | matches? |
  | --- | --- |
  | `const manifestPath = path.join(root, ".claude-plugin", "marketplace.json"); const raw = await readFile(manifestPath, "utf8");` | **false** |
  | `const raw = await readFile(path.join(root, "marketplace.json"), "utf8");` | true |
  | `const raw = readFileSync(path.join(root, "marketplace.json"), "utf8");` | **false** |
  | `const raw = await readFile(path.join(root, MANIFEST_FILENAME), "utf8");` | **false** |
  | `const fh = await open(path.join(root, "marketplace.json")); await fh.readFile("utf8");` | **false** |

  The one spelling that matches is the one nobody writes. **Fix:** invert the
  anchor — scan for the filename token and then look backwards/forwards for a read
  API in the same statement, e.g. detect any file whose stripped source contains
  `marketplace.json` AND one of `readFile` / `readFileSync` / `open(` / `createReadStream`,
  with `domain/manifest.ts` allow-listed. Then add the self-test the first pass
  asked for, but plant **the `manifest.ts` spelling** as one of its positives —
  a gate that cannot flag its own subject's shape is the proof of inertness.

### `tests/architecture/scope-order-drift.test.ts`

- **[BLOCKER] The scope-rank clause cannot see the comparator spelling the codebase actually uses** — `line 58`
  `USER_FIRST_RANK_RE = /===\s*"user"\s*\?\s*\d+\s*:\s*\d+/` requires *digits* on
  both arms. The canonical comparator, `shared/notify.ts:4196`, is
  `return a.scope === "project" ? -1 : 1;` — the `-1` idiom. Verified:
  `=== "user" ? 0 : 1` matches; `=== "user" ? -1 : 1` and
  `a.scope === "user" ? -1 : 1` **do not**. So the drift this gate exists to
  prevent — a sort site re-deriving the rank inline in the house idiom — is
  invisible to it. **Fix:** change the arms to `-?\d+` and add a self-test block
  (mirroring `config-state-write-seams.test.ts:176`) planting
  `a.scope === "user" ? -1 : 1`, `=== "user" ? 0 : 1`, and a benign
  `entry.scope === "user" ? label : other`.
- **[BLOCKER] The allowlist comment states the opposite of what the regex does** — `lines 50-53`
  The comment says `notify.ts` is allow-listed because "a future refactor that
  flipped the comparator to `=== "user" ? <low> : <high>` would otherwise trip the
  guard." With `<low>` spelled `-1` it would **not** trip it. Delete or correct the
  claim in the same change as the regex fix; a reader currently takes this comment
  as evidence of coverage that does not exist.
- **[WARNING] Line-by-line scanning misses a wrapped array literal** — `lines 109-121, 143-153`
  `USER_FIRST_LITERAL_RE` is tested against one line at a time, so
  `const order = [\n  "user",\n  "project",\n];` matches nothing. Read the file
  once, run the regex over the whole (comment-stripped) source, and derive the
  line number from the match index if the offender report still needs one.

### `tests/architecture/config-state-write-seams.test.ts`

- **[BLOCKER] The SPLIT-02 seam-ownership lock only sees one write API** — `lines 102-104`
  All three patterns are anchored on `atomicWriteJson(`. A new writer spelled
  `await writeFile(locations.stateJsonPath, JSON.stringify(state))` — or
  `writeFileSync`, or `rename` onto the path — evades the gate entirely, and it is
  the *worse* violation (it also breaks NFR-1 atomicity). I confirmed no other
  mechanism covers it: no other file under `tests/architecture/` references
  `stateJsonPath`/`configJsonPath` in a gate, `eslint.config.js`'s only
  `no-restricted-imports` entry is the Pi SDK (line 284), and
  `.fallowrc.json`'s `calls.forbidden` block lists only
  `process.stdout.*` / `process.stderr.*`. The file's docstring (lines 23-29)
  nonetheless claims the seams "cannot be bypassed as new code paths are added."
  **Fix:** widen each pattern to
  `/(?:atomicWriteJson|writeFile|writeFileSync|appendFile|rename)\(\s*(?:\w+\.)?stateJsonPath\b/`
  (and the two config variants), then add each new spelling to the existing
  synthetic-offender self-test at line 176 so the widening is itself proven.
- **[WARNING] This gate is the only sibling in the family that does not strip comments** — `line 114`
  `source-scan.ts:34-46` calls `stripComments` "mandatory for every scanning
  clause." Here the raw source is matched, so a docstring quoting
  `atomicWriteJson(loc.stateJsonPath, …)` false-positives the gate. Import
  `stripComments` from `./source-scan.ts` and wrap the read.

### `tests/architecture/scope-fences-63.test.ts`

- **[BLOCKER] SURF-04 greens over zero inspected directories when its targets move** — `lines 120-131`
  `dirEntries()` returns `null` on ENOENT and the loop `continue`s. Both target
  directories are candidates: `edge/handlers/plugin` exists,
  `commands/plugin` never has. Rename or relocate the edge-handler directory and
  **both** lookups return `null`, the offender list stays empty, and the
  "perma-forbidden" gate passes having read nothing. This is exactly the failure
  mode `source-scan.ts:56-64` (WR-06) documents and refuses — the shared helper
  *asserts* on a missing target unless it is explicitly in `allowMissing`. The same
  shape applies to `readIfExists` in the hook-count clause (`lines 144-148`).
  **Fix:** assert that at least one directory resolved
  (`assert.ok(inspected > 0, "SURF-04 inspected no directory — a rename uncovered this gate")`),
  and likewise that at least one of `LIST_ORCH_REL` / `LIST_EDGE_REL` was read.
- **[WARNING] HOOK-04's presence clause is a raw substring check on unstripped source** — `lines 166-172`
  `source.includes('"unsupported hooks"')` runs against the full 4,039-line
  `notify.ts` **without** comment stripping, so any comment mentioning the token
  satisfies it even if the `REASONS` member were deleted. Today the token appears
  exactly once (`notify.ts:109`, in the tuple), so the gate is accidentally honest.
  It is also fully subsumed by `compat-01-no-expansion.test.ts:127`'s `deepEqual`
  pin of `REASONS`. **Fix:** either delete this clause as redundant, or import
  `REASONS` and assert `REASONS.includes("unsupported hooks")` — a runtime check
  no comment can satisfy.

### `tests/architecture/cross-op-convergence.test.ts`

- **[BLOCKER] The injected git fake's recorded calls are never asserted, and a comment claims they are** — `lines 201-215, 205-215`
  The comment says "A mock gitOps is injected so a (regression) stray network call
  would be recorded." It *is* recorded — `tests/platform/git-ops-fake.ts` pushes
  every call into `state.calls` — but nothing reads it. Mutate
  `updateMarketplace` to clone before the not-added pre-guard and the test stays
  green as long as the fake's clone succeeds. **Fix:** in the
  `"marketplace update"` invoker, keep the fake (`const git = makeMockGitOps()`)
  and after the `await updateMarketplace(...)` assert
  `assert.deepEqual(git.state.calls, { clone: [], fetch: [], forceUpdateRef: [], checkout: [], resolveRef: [], currentBranch: [], resolveRemoteRef: [] })`.
  That is the NFR-5 "silence proof" this file's header claims to carry.

## New findings — from the clean lists

### `tests/architecture/compat-01-no-expansion.test.ts` (first pass: "No findings — a model for the rest of the area")

The four closed-set pins, the glyph code points, the record key set, and the
schema-version clauses all survive the value mutations (see *Still clean after
attack*). Four things the first pass missed:

- **[WARNING] The file's own header contradicts its pin** — `lines 30-31` vs `lines 394-404`
  The header says the record's key set "is exactly the **eight** fields it already
  had." The pinned literal has **nine** (`compatibility`, `enabled`, `hookEntries`,
  `installedAt`, `resolvedSha`, `resolvedSource`, `resources`, `updatedAt`,
  `version`). A doc comment that miscounts the thing it documents. Change "eight"
  to "nine", or drop the number and say "the field set enumerated below."
- **[WARNING] The glyph-count clause scans one file and one declaration form** — `lines 110-112, 345-368`
  `GLYPH_DECLARATION_SOURCE` is `\bexport const ICON_[A-Z_]+\b` and is applied only
  to `shared/notify.ts`. An eighth glyph declared in a sibling module and
  re-exported (`export { ICON_EIGHTH } from "./glyphs.ts";`) satisfies the
  seven-declaration count. The clause is described in the header as "the one clause
  here that scans source" and "load-bearing". **Fix:** add the re-export spelling to
  the pattern alternation (`export (?:const|\{[^}]*)\s*ICON_`) and add it to the
  spellings list at line 375 so the widening is proven; or scan every file under
  `extensions/pi-claude-marketplace/shared/`.
- **[WARNING] The network-delegation clause is a bare substring check on the whole gate file** — `lines 512-535`
  `src.includes(`"${rel}"`)` over the comment-stripped source of
  `no-orchestrator-network.test.ts` proves the path *appears somewhere in code*,
  not that it appears in `FORBIDDEN_TARGETS`. Moving `orchestrators/plugin/info.ts`
  out of `FORBIDDEN_TARGETS` into any new code-level array (an `EXEMPT` list, an
  `allowMissing` argument) keeps this clause green while silently uncovering the
  COMPAT-01 network promise. **Fix:** slice the array literal first —
  `const targetsBlock = src.slice(src.indexOf("FORBIDDEN_TARGETS"), src.indexOf("];", src.indexOf("FORBIDDEN_TARGETS")))`
  — and run the `includes` against that slice, failing loudly if the anchor is not
  found.
- **[WARNING] `const actual` × 8** — `lines 177, 217, 252, 275, 300, 407, 487, 502`
  The skill names a bare `actual` as a finding. Rename to the production role:
  `reasons`, `statusTokens`, `pluginStatuses`, `marketplaceStatuses`, `glyphs`,
  `recordKeys`, `schemaVersions`, `defaultSchemaVersion`.

### `extensions/pi-claude-marketplace/persistence/config-write-back.ts` (first pass: "the one `as MarketplaceConfigEntry` cast … carries an inline comment. No findings.")

- **[WARNING] A second, uncommented `as MarketplaceConfigEntry`** — `line 189`
  `marketplaceEntries.set(name, { ...existing, ...patch } as MarketplaceConfigEntry)`
  inside `writeBatchedConfigEntries` carries no justification. The first pass counted
  one cast; there are two. Style rule: `as` needs an obvious or commented reason.
  **Fix:** hoist the shared merge into a module-local
  `function mergeMarketplaceEntry(existing: Partial<MarketplaceConfigEntry>, patch: Partial<MarketplaceConfigEntry>): MarketplaceConfigEntry`
  carrying the line 58-66 comment once, and call it from both sites.
- **[WARNING] Three helpers collapse the documented absent-vs-empty distinction** — `lines 102-107, 150-154, 201-206`
  `config-io.ts:60-64` states that an absent `marketplaces`/`plugins` key "is legal
  (means 'no declarations'), **distinct from** present-but-empty" (D-05).
  `deleteMarketplaceConfigEntryWithCascade`, `deletePluginConfigEntry`, and
  `writeBatchedConfigEntries` unconditionally emit both keys, so a config the user
  wrote as `{"schemaVersion":1}` comes back as
  `{"schemaVersion":1,"marketplaces":{},"plugins":{}}`. No case in
  `tests/persistence/config-write-back.test.ts` pins the emitted object as a whole,
  so mutating any of the three either way survives. **Fix:** decide the contract
  (either preserve absence, or document the normalization at the module header),
  then add one `assert.deepStrictEqual` on the whole saved config to the paired
  test rather than the current field checks.

The other nine production modules survived the attack — see *Still clean after attack*.

## New findings — `tests/architecture/config-state-consistency.test.ts`

The first pass filed one BLOCKER here. The same defect class runs through five more
tests, plus four independent problems it did not reach.

- **[BLOCKER] A standalone negative assertion on the CR-02 regression's own subject** — `line 570`
  `assert.ok(cfg.config.plugins?.["tool@mp"] !== undefined)`. The skill: "a
  standalone negative assertion passes for any value; the test must assert what the
  value *is*." The whole point of this case is that the cross-scope install writes a
  *well-formed* plugin declaration; a write-back that produced `{}` passes this
  assertion and still yields the empty plan at line 577 (the planner reads an absent
  `enabled` as declared-enabled). **Fix:**
  `assert.deepStrictEqual(cfg.config.plugins, { "tool@mp": {} })` — or whatever the
  intended entry shape is, written by hand, not read off the production result.
- **[WARNING] Seven dead early returns** — `lines 129-131, 196-198, 276-278, 352-354, 405-407, 469-471, 563-565`
  Every `assert.equal(cfg.status, "valid")` is followed by
  `if (cfg.status !== "valid") { return; }`. The `assert.equal` already failed the
  case, so the body is unreachable; it exists only because `assert.equal` is not a
  TypeScript assertion signature. `assert.ok(cfg.status === "valid", …)` **is**
  (`asserts value`), so it narrows and asserts in one statement. **Fix:** replace
  all seven `assert.equal` + `if`-return pairs with a single
  `assert.ok(cfg.status === "valid", \`config at ${...} did not load valid\`);`.
  A silent `return` in a test is how a case stops testing without going red.
- **[WARNING] A vacuous "sanity check"** — `line 153`
  `assert.notDeepEqual(plan, emptyReconcilePlan("user"))` is already implied by
  `assert.equal(plan.marketplacesToAdd.length, 1)` eight lines above, and a negative
  deep-equality passes for every wrong plan. Delete it; the finding it was reaching
  for is covered by the whole-value `deepEqual` the first pass's BLOCKER asks for.
- **[WARNING] `as never` applied to *data* literals, not just context doubles** — `lines 456, 544`
  `await saveState(locations.extensionRoot, { schemaVersion: 1, marketplaces: {…} } as never)`
  strips all structural checking from the state fixture the case's premise depends
  on — a different and worse thing than the `ctx`/`pi` `as never` the first pass
  grouped it with (that one is forced by an over-wide third-party parameter type;
  this one is not). **Fix:** type these two literals as `ExtensionState` and let the
  compiler check them; if they will not type-check, that is the finding.
- **[WARNING] The temp-dir cleanup polls with a retry loop** — `lines 89-103`
  Ten attempts with a 25 ms `setTimeout` on `ENOTEMPTY`. Polling in a test is a
  finding by itself, but the more useful reading is that it documents a real race:
  something is still writing under the temp root after the awaited orchestrator call
  returned. `dropMarketplaceCache` is awaited (`add.ts:580`, `remove.ts:605`), so the
  writer is something else — most plausibly `proper-lockfile`'s background mtime
  refresh. **Fix:** find and await the straggler (or release the lock
  deterministically), then delete the retry loop. Do not propagate this helper.
- **[WARNING] Existence-only check where the record is the promise** — `line 202`
  `assert.ok("valid-marketplace" in state.marketplaces)` says nothing about the
  recorded source, scope, manifestPath, or root. Assert the record.

## New findings — `tests/architecture/cross-op-convergence.test.ts`

- **[WARNING] A tautology over two local constants** — `lines 321-325`
  `assert.notEqual(CANONICAL_EXPLICIT, CANONICAL_BARE)` compares two string literals
  declared at lines 109-112 of this same file. No production change can make it
  fail. Delete it — the asymmetry it claims to guard is already proven by the two
  matrices asserting each op against its own canonical row.
- **[WARNING] The third test is fully subsumed by the first and uses fragment assertions** — `lines 328-347`
  It re-invokes all eight real orchestrators (eight more `mkdtemp` pairs, eight more
  full hermetic runs) only to `assert.doesNotMatch(/\{network unreachable\}/)` and
  `assert.match(/\{marketplace not added\}/)` on the same emission the first test
  already pinned byte-for-byte against `CANONICAL_EXPLICIT`. It can only fail when
  the first test also fails. **Fix:** delete it and move the CR-01 rationale into the
  first test's failure message; the byte-exact comparison *is* the stronger form of
  both regex checks. This is META-FINDINGS item 3's defect class appearing where a
  whole-string assertion already exists next door in the same file.
- **[WARNING] `INVOKERS` is keyed by `string`, forcing a runtime existence guard** — `lines 133, 221-222`
  `Record<string, Invoker>` means a typo in `OPS_EXPLICIT_SCOPE` compiles and the
  case reports "no invoker registered". **Fix:** declare
  `type ConvergedOp = (typeof OPS_EXPLICIT_SCOPE)[number] | (typeof OPS_BARE)[number];`
  and type `INVOKERS` as `Record<ConvergedOp, Invoker>`; the `assert.ok` at line 222
  then deletes itself.

## New findings — `tests/architecture/disabled-state-classification.test.ts`

- **[WARNING] Six behavioral cases test another module's export from this file** — `lines 104-166`
  The four truth-table rows plus the two inventory cases exercise
  `persistence/state-io.ts::isRecordedButDisabled` directly. The pairing rule is
  "no source module tested from another module's test," and the owner exists:
  `tests/persistence/state-io.test.ts:16,72` already imports and calls it.
  **Fix:** move the six cases to `tests/persistence/state-io.test.ts` and leave this
  file holding only the whole-tree twin-detection and import-collapse clauses, which
  are genuinely architectural. That also dissolves the first pass's `describe()`
  finding: with the behavioral half gone, the wrapper has nothing left to group.
- **[WARNING] `const result` × 6** — `lines 119, 141, 162, 216, 258, 275`
  Skill-named placeholder. Rename to the production role (`disabled`,
  `patternMatches`, `overReachMatches`, `walkWiring`).
- **[WARNING] `// act` labels object construction, not the action** — `lines 202-216, 255-261, 272-280`
  In all three self-test cases the real work (`pattern.test(...)`) happens under
  `// arrange` and the `// act` block only assembles the literal that gets compared.
  Move the `.test()` calls under `// act`.
- **[WARNING] `FORMER_DEFINITION_SITES` and "every former definition site" narrate code that no longer exists** — `line 19, line 289`
  `.claude/rules/typescript-comments.md` forbids exactly this in comments **and test
  titles** ("drop `the former X`"). **Fix:** rename to `PREDICATE_CONSUMERS` and
  retitle to `"every consumer imports the single predicate"` — the present-tense
  fact, which is also the thing the case actually asserts.

## New findings — `tests/architecture/manifest-lookup-drift.test.ts`

- **[WARNING] Three plausible copier spellings are absent from `PLANTED_TWINS`** — `lines 93-117, 136-171`
  All three patterns anchor on the literal `.plugins` `.find` adjacency. These
  evade all three:
  1. `manifest.plugins?.find((p) => p.name === wanted)` — optional chaining breaks
     the `\.plugins\s*\.find` adjacency;
  2. `const { plugins } = manifest; plugins.find((p) => p.name === wanted)` — no
     `.plugins` token at the call;
  3. `for (const p of manifest.plugins) { if (p.name === wanted) … }` — no `.find`.
  The file's own header calls the walk "not an allowlist … structurally blind to the
  next copy", so the coverage claim is strong enough to be worth closing.
  **Fix:** change the adjacency to `\.plugins\s*\??\.\s*find` (covers 1), add a
  fourth pattern for the bound-collection form, and add all three lines to
  `PLANTED_TWINS` — the file's existing "every proven pattern reaches the source
  walk" case (line 277) then enforces that they are actually wired in.

## New findings — `tests/architecture/flag-catalog-drift.test.ts`

- **[WARNING] The case mutates a value returned by production code** — `line 107`
  `const catalogListParse = parseFlagNames("list"); catalogListParse.delete("--local");`
  works only because `parseFlagNames` builds a fresh `Set` per call
  (`edge/flag-catalog.ts:185`). Memoize that function — an obvious future
  optimisation — and this line silently mutates the catalog for the later
  `HANDLER_ACCEPTED_PARSE_SETS` loop at line 149 in the same process.
  **Fix:** `const catalogListParse = new Set(parseFlagNames("list")); catalogListParse.delete("--local");`
  or compare against a hand-written expected set.
- **[WARNING] Uses the test-only production reset hook** — `line 49, 87`
  `resetCompletionCache()` is imported from
  `shared/completion-cache.ts` and called per loop iteration. This is a second,
  independent caller of the reset-hook class META-FINDINGS ranks at leverage item 2
  (its own doc comment admits zero production callers). Record this file as a
  dependent of that fix: when the cache becomes factory-owned, this gate must inject
  a fresh cache instead of resetting a module global.

## Area-wide new findings

- **[WARNING] Eight of ten files carry zero `// arrange` / `// act` / `// assert` phase comments**
  Counted across the area: `compat-01-no-expansion` (14 of 14 cases) and
  `disabled-state-classification` (8 of 8) mark phases; `config-state-consistency`,
  `cross-op-convergence`, `manifest-lookup-drift`, `config-state-write-seams`,
  `scope-fences-63`, `scope-order-drift`, `flag-catalog-drift`, and
  `manifest-read-seam` mark none. This is sibling drift with two in-directory
  templates, not a repo-wide gap. Propagate the `compat-01` shape.
- **[WARNING] The hermetic-HOME harness never neutralizes `PI_CODING_AGENT_DIR`** — `cross-op-convergence.test.ts:89-106`, `config-state-consistency.test.ts:502-504`
  Both set `process.env.HOME` and restore it, but user-scope roots resolve through
  `getAgentDir`, re-exported from the Pi SDK
  (`platform/pi-api.ts:15`), and that SDK honors `PI_CODING_AGENT_DIR`
  (`node_modules/@earendil-works/pi-coding-agent/dist/config.js`). A developer with
  that variable exported — it is a documented, supported variable — runs these
  user-scope-touching cases against their real agent directory. This is **not local
  to this area**: `withHermeticHome` is hand-rolled in 13 unit-test files and none
  of them clears it. **Fix:** one shared helper that saves and deletes both `HOME`
  and `PI_CODING_AGENT_DIR` and restores both in `t.after()`.

## Hand-off (a defect in a file this area delegates to)

- **`tests/architecture/no-orchestrator-network.test.ts:38-41` — the "Skip-path rationale" docstring lies.**
  It says "The test skips ENOENT targets with an informational marker so this gate
  can land before implementation." Since WR-06, `assertNoForbiddenSurface`
  (`source-scan.ts:78-89`) **asserts** on ENOENT unless the target is in
  `opts.allowMissing`, and this gate passes only three arguments — no `allowMissing`.
  The comment describes the behavior the shared helper was deliberately changed away
  from. Owner: `unit-test-findings/architecture-boundary-gates.md`. Flagged here
  because `compat-01-no-expansion.test.ts:516-519` cites that same WR-06 property as
  load-bearing for its delegation.

## Export ownership census

The ten production modules the first pass reviewed are not paired with any file in
`tests/architecture/` — architecture gates own invariants, not exports. The census
below therefore maps each export to its **paired** owner elsewhere in the suite, to
answer the only question that matters here: does any export this area's gates touch
have no owning case at all? **Answer: no. Every export is owned.**

| Module | Export | Owning test module | Status |
| --- | --- | --- | --- |
| `persistence/config-io.ts` | `loadConfig` | `tests/persistence/config-io.test.ts` (12 refs) | owned |
| `persistence/config-io.ts` | `saveConfig` | `tests/persistence/config-io.test.ts` (7) | owned |
| `persistence/config-io.ts` | `isDeclaredEnabled` | `tests/persistence/config-io.test.ts` (5) | owned |
| `persistence/config-io.ts` | `CONFIG_VALIDATOR` | `tests/persistence/config-io.test.ts` (4) | owned |
| `persistence/config-write-back.ts` | `writeMarketplaceConfigEntry` | `tests/persistence/config-write-back.test.ts` (5) | owned |
| `persistence/config-write-back.ts` | `deleteMarketplaceConfigEntryWithCascade` | same (6) | owned |
| `persistence/config-write-back.ts` | `writePluginConfigEntry` | same (4) | owned |
| `persistence/config-write-back.ts` | `deletePluginConfigEntry` | same (3) | owned |
| `persistence/config-write-back.ts` | `writeBatchedConfigEntries` | same (8) | owned |
| `persistence/config-merge.ts` | `mergeScopeConfigs` | `tests/persistence/config-merge.test.ts` (5) | owned |
| `persistence/config-merge.ts` | `loadMergedScopeConfig` | same (3) | owned |
| `persistence/state-io.ts` | `isRecordedButDisabled` | `tests/persistence/state-io.test.ts:72` **and** `tests/architecture/disabled-state-classification.test.ts:119` | **owned twice** — see ownership finding above |
| `domain/manifest.ts` | `loadMarketplaceManifest` | `tests/domain/manifest.test.ts` (9) | owned |
| `domain/manifest.ts` | `MARKETPLACE_VALIDATOR` | same (6) | owned |
| `domain/manifest-lookup.ts` | `lookupDeclaredPlugin` | `tests/domain/manifest-lookup.test.ts` (8) | owned |
| `edge/flag-catalog.ts` | `CATALOG_VERBS` | `tests/edge/flag-catalog.test.ts` (4) | owned |
| `edge/flag-catalog.ts` | `isCatalogVerb` | same (6) | owned |
| `edge/flag-catalog.ts` | `SCOPE_TARGET_FLAG` | same (7) | owned |
| `edge/flag-catalog.ts` | `completionFlagEntries` | same (8) | owned |
| `edge/flag-catalog.ts` | `parseFlagNames` | same (8) | owned |
| `edge/flag-catalog.ts` | `passThroughFlagNames` | same (7) | owned |
| `orchestrators/reconcile/types.ts` | `emptyReconcilePlan` | `tests/orchestrators/reconcile/types.test.ts` (7) | owned |
| `orchestrators/reconcile/types.ts` | `plannedSourceMismatchSubject` | same (4) | owned |
| `orchestrators/reconcile/plan.ts` | `planReconcile` | `tests/orchestrators/reconcile/plan.test.ts` | owned |
| `shared/types.ts` | `SCOPES` | `tests/shared/types.test.ts` (2) | owned |

I did not grade the *strength* of the owning cases — those files belong to
`persistence.md`, `domain-core.md`, `edge-completions.md`, and
`orchestrators-reconcile-*.md`.

## Branch census

Untested branches reachable from this area's own code:

**Reachable and untested (findings):**
- `source-scan.ts:80-86` — the ENOENT/`allowMissing` arm. `tests/architecture/source-scan.test.ts`
  exists; no case in this area's gates ever exercises a missing target, and the
  behavior is what `compat-01`'s delegation clause depends on. Belongs to the
  `source-scan.test.ts` owner, but named here because two gates in this area cite it.
- `config-state-consistency.test.ts:95-98` — the `ENOTEMPTY` retry arm of
  `tmpScopeRoot`'s cleanup fires nondeterministically and asserts nothing; the
  10th-attempt rethrow is untested.
- `scope-fences-63.test.ts:78-81` and `93-96` — the non-ENOENT rethrow arms of
  `readIfExists`/`dirEntries` are unreachable in the current tree and untested.

**Compiler-forced and not removable (D-116-01a category):**
- The seven `if (cfg.status !== "valid") { return; }` blocks in
  `config-state-consistency.test.ts` are *nearly* this category — they exist for
  narrowing — but they are **not** genuinely forced: `assert.ok` carries an
  `asserts value` signature and removes the need. Filed as a WARNING above rather
  than accepted as compiler-forced.

**Unreachable by real input (production dead code):** none found in this area's
eleven production modules. `config-io.ts:99-101`'s "(no detail available)" fallback
is reachable in principle (a validator that fails `Check` but yields no `Errors`
entry) but not by any input this suite can construct; it is one line, and I do not
recommend a test for it.

## Grading of first-pass findings

### `tests/architecture/config-state-consistency.test.ts`
- **UNDERSTATED** — *Incomplete object assertion hides an untested field* (BLOCKER).
  The finding is right and its suggested `deepEqual` literal is correct —
  `PlannedMarketplaceAdd` (`orchestrators/reconcile/types.ts:50-65`) does carry
  `scope`, `marketplace`, `source`, `configSource`. What it misses is that this is a
  **file-wide pattern, not one test**: the config-side read-back is asserted
  field-by-field in five further cases (`lines 282-285`, `356`, `410`, `475-478`,
  `569-570`), and one of those (`570`) is a bare negative assertion. Only the
  *plan*-side assertions use whole-value `deepEqual`. Raise to one grouped BLOCKER
  covering all six.
- **CONFIRMED** — *Dead statement with an inaccurate comment* (`void saveConfig`,
  lines 43-47). `saveConfig` is called directly at line 236; the comment's claim of
  transitive-only use is false.
- **CONFIRMED** — *Narrative numbered comments instead of arrange/act/assert*.
  Verified: 0 `// arrange` markers in the file.
- **CONFIRMED** — *Dynamic `await import(...)` for statically-imported modules*.
  Note additionally that lines 498 and 593 dynamically import `node:fs/promises`,
  which line 21 already imports statically in the same file.
- **UNDERSTATED** — *`as never` casts hide the ctx/pi doubles' shape*. Correct for
  the `ctx`/`pi` sites, and the "repo-wide, not a one-file fix" reading is right.
  But the file also applies `as never` to two **state data literals** (lines 456,
  544), which no over-wide third-party type forces and which strips checking from
  the fixtures the cases depend on. Split that out and raise it.

### `tests/architecture/compat-01-no-expansion.test.ts`
- The "no findings — a model for the rest of the area" verdict is **correct on the
  value pins and wrong on the two source-scanning clauses**. Four new WARNINGs above
  (stale header count, single-file glyph scan, substring-only delegation check,
  `const actual` ×8). The praise for the closed-set pins is deserved and I confirmed
  it by mutation.

### `tests/architecture/cross-op-convergence.test.ts`
- **CONFIRMED** — *Data-driven rows looped inside one `test()`*. Also correct that
  the manual `canonicalBody` bookkeeping becomes unnecessary once each op is its own
  sibling case.
- **CONFIRMED** — *Double assertion through `unknown` hides the doubles' shape*.

### `tests/architecture/manifest-lookup-drift.test.ts`
- **CONFIRMED** — *`extensionSourceFiles` duplicate walker*. The "otherwise the file
  is clean and exemplary" verdict holds for everything except the three uncovered
  copier spellings filed above.

### `tests/architecture/disabled-state-classification.test.ts`
- **CONFIRMED** — *`describe()` groups two unrelated concerns*. Note the better fix
  is the ownership move (relocate the behavioral half to
  `tests/persistence/state-io.test.ts`), which removes the wrapper as a side effect.
- **CONFIRMED** — *Mock records carry a mis-shaped `resources` field*. Verified:
  `isRecordedButDisabled`'s parameter is `{ readonly enabled: boolean }`
  (`state-io.ts:252`), so `compatibility` and `resources` are both unread. Worth
  adding that the same file's *later* two cases (lines 128-138, 149-159) use the
  correct five-array shape, so the file is internally inconsistent as well as wrong.
- **CONFIRMED** — *Duplicated `stripComments`/`REPO_ROOT`*.

### `tests/architecture/config-state-write-seams.test.ts`
- **CONFIRMED** — *`walkTsFiles` duplicate walker*. The gate verdict "proven against
  five synthetic offender strings and three benign callsites… Not inert" is true
  **for the `atomicWriteJson` spelling only** — see the new BLOCKER above. This is
  the clearest case in the area of a planted-violation self-test creating false
  confidence about coverage.

### `tests/architecture/scope-fences-63.test.ts`
- **CONFIRMED** — *File name doesn't describe its contents*. The proposed rename is
  reasonable.
- The gate verdict's closing sentence — "an accepted, if here undocumented, residual
  risk shared with the file's neighbors" — understates it: the SURF-04 directory
  clause does not merely miss differently-spelled violations, it greens over zero
  inspected directories (new BLOCKER above).

### `tests/architecture/scope-order-drift.test.ts`
- **CONFIRMED** — *Planning-artifact-style tag `260525-cjr B3:` in both titles*.
- **CONFIRMED** — *`walkTsFiles` duplicate walker*.
- The gate verdict "would fail against a new `["user", "project"]` literal or
  `=== "user" ? x : y` ternary planted anywhere" is **false for the ternary** — see
  the new BLOCKER. The first pass's own observation that this file lacks a self-test
  is exactly what let the wrong claim stand.

### `tests/architecture/flag-catalog-drift.test.ts`
- **CONFIRMED** — *Data-driven rows looped inside one `test()`* (13 rows at 86-100,
  12 at 149-155).
- The gate verdict's analysis of tests (a) and (b) being mutually-derived, rescued by
  the independently-written `HANDLER_ACCEPTED_PARSE_SETS` pin, is accurate and I
  confirmed it: the `Record<CatalogVerb, …>` shape makes a new verb a compile error
  and the per-verb `deepEqual` catches a flag added on either side.

### `tests/architecture/manifest-read-seam.test.ts`
- **UNDERSTATED** — *No planted-violation self-test for the regex* (WARNING → **BLOCKER**).
  The missing self-test is the symptom; the disease is that the regex cannot match
  the read spelling the repo's own seam uses. Adding the requested self-test with the
  obvious positive (`readFile(path.join(root, "marketplace.json"))`) would pass and
  leave the gate just as inert. The fix must invert the anchor, and the self-test
  must plant `domain/manifest.ts`'s actual shape.
- **CONFIRMED** — *Duplicated `stripComments`/`collectTypeScriptFiles` walker*.

### Production "Clean files" list
- **REFUTED in part** for `persistence/config-write-back.ts` — the claim "the one
  `as MarketplaceConfigEntry` cast (line 67) carries an inline comment" is wrong;
  there are two, and the second (line 189) is bare. Two WARNINGs filed above.
- **CONFIRMED** for the other nine. I additionally checked one thing the first pass
  did not: `config-io.ts:188`'s bare `new Error("saveConfig refused: …")` looks like
  a deviation from the repo's typed-error convention, but its sibling
  `state-io.ts:488` throws the identically-shaped bare `Error` for `saveState`.
  **Not a finding** — it is a consistent pair, and the message format is explicitly
  cross-referenced in `config-io.ts:173`.

## Still clean after attack

These survived named mutations. Do not spend fixing-pass time here.

- **`compat-01-no-expansion.test.ts`, the closed-set and persistence clauses.**
  I tried: renaming a `REASONS` member (caught — enumeration `deepEqual`);
  reordering two members (caught — the pins are order-sensitive and the failure
  message says so); adding a 45th reason (caught); swapping `ICON_REMOTE` and
  `ICON_DISABLED` (caught — the glyph object is compared whole); adding an optional
  key to `PLUGIN_INSTALL_RECORD_SCHEMA` (caught by the key-set pin *and* separately
  by the manifest/orphan shape filter); adding schema version 3 (caught); bumping
  `DEFAULT_STATE.schemaVersion` (caught); narrowing `GLYPH_DECLARATION_SOURCE` to
  require `= ` after the name (caught by the three-spelling self-test at line 375);
  making `GLYPH_DECLARATIONS` non-global so `.match` returns one hit (caught —
  `declarations?.length` becomes 1). The `Record<InstallSignalKey, true>` clause at
  line 432 is a *typecheck* gate rather than a runtime one, which the file states
  honestly at line 440; it fires under `npm run check`, not under `node --test`.
- **`manifest-lookup-drift.test.ts`, the pattern-wiring proofs.** I tried: deleting
  `RAW_LOOKUP_DESTRUCTURED` from `RAW_MEMBERSHIP_LOOKUPS` while leaving it in
  `PLANTED_TWINS` (caught by the "every proven pattern reaches the source walk" case
  at line 277); adding `/g` to a pattern (caught by the `re.global` assertion at
  288); removing an entry from `NON_ABSENCE_LOOKUPS` that still matches (caught by
  the walk); leaving a stale allowlist entry that no longer matches (caught by the
  staleness clause at 250). This is the strongest gate in the area and the one the
  others should copy.
- **`disabled-state-classification.test.ts`, the twin-detection half.** I tried:
  inverting `isRecordedButDisabled` (caught by the truth table); dropping
  `BOOLEAN_ENABLED_COERCION` from `INLINE_REDERIVATIONS` (caught by
  `allEscapingPatternsIncluded` at line 276); making a pattern global (caught by
  `globalFlags`); removing an import from one of the four consumer files (caught at
  line 289).
- **`config-state-write-seams.test.ts`, within its chosen API.** I tried: narrowing
  `FORBIDDEN_STATE_JSON_PATTERN` to require the `loc.` prefix (caught by the
  bare-form positive at line 188); silently adding a file to
  `ALLOWED_CONFIG_JSON_WRITERS` (caught by the exactly-N pin at line 163);
  broadening a pattern so it matches `mcpJsonPath` (caught by the benign-callsite
  negatives at line 208).
- **`config-state-consistency.test.ts`, the plan-side half.** I tried: making
  `addMarketplace` skip its config write-back (caught — the plan gains a
  `marketplacesToRemove` entry and the `deepEqual` against `emptyReconcilePlan`
  fails); making orchestrated mode write anyway (caught by the bytes+`mtimeMs`
  assertions at 628-629); making the bare-form autoupdate flip clobber all but the
  last entry (caught at 475-478 — the CR-01 regression it was written for). The
  terminal `assert.deepEqual(plan, emptyReconcilePlan(scope))` in five of seven
  cases is genuinely strong and should be the model for the config-side assertions.
- **`cross-op-convergence.test.ts`, the byte matrices.** I tried: giving one
  orchestrator a divergent row (caught byte-exactly); emitting twice (caught by
  `callCount`); downgrading severity to `warning` (caught); dropping the
  `[project]` bracket (caught by the explicit/bare split).
- **`edge/flag-catalog.ts`.** `parseFlagNames` returns a fresh `Set` per call
  (line 185), so the test-side `.delete("--local")` cannot corrupt the catalog
  today; `CATALOG_VERBS` is derived from `Object.keys(CATALOG)` with no hand-copied
  list; `SCOPE_TARGET_FLAG` reads off the shared entry rather than duplicating
  `"--local"`. Adding a verb is a compile error at
  `HANDLER_ACCEPTED_PARSE_SETS`.
- **`domain/manifest.ts`, `domain/manifest-lookup.ts`, `persistence/config-merge.ts`,
  `orchestrators/reconcile/{plan,types}.ts`, `shared/types.ts`.** Read in full or in
  the reviewed sections; no testability seam, hidden dependency, module-level mutable
  state, or uncommented assertion found. `manifest.ts`'s module-level
  `manifestCache` (line 86) is a genuine process-lifetime singleton, but it is
  keyed per-path by `(mtimeMs, size)`, carries no reset hook, and its doc comment
  (D-01) states the design honestly — it is **not** an instance of the reset-hook
  class in META-FINDINGS item 2.

## Not covered

- I ran no test command. Every claim above is from reading the source plus
  throwaway `node -e` evaluations of the gates' own regexes against string literals
  — nothing in the repo was touched.
- The orchestrators `config-state-consistency.test.ts` and
  `cross-op-convergence.test.ts` drive as collaborators
  (`orchestrators/plugin/{install,uninstall,reinstall,update,info}.ts`,
  `orchestrators/marketplace/{add,remove,update,autoupdate}.ts`) were not reviewed;
  they are owned by their own area files.
- `shared/notify.ts` was read only at the lines these gates scan or import
  (the closed-set tuples at 100-115, the glyph exports, `compareByNameThenScope` at
  4185-4197).
- The export census establishes that every export has a named owning test module. It
  does **not** grade the strength of those owning cases — that is the job of
  `persistence.md`, `domain-core.md`, `edge-completions.md`, and
  `orchestrators-reconcile-*.md`.
- I did not measure direct per-pair coverage (`npm run test:coverage:direct`), which
  META-FINDINGS correctly lists as an outstanding task.

## Meta-findings impact

### New cross-cutting evidence

**1. The "gates that do not gate" list should grow from five instances to nine, and
the root cause is now nameable.** META-FINDINGS §"Gates that do not gate" lists five.
Add four from this area alone:

| Gate | Why it cannot fire |
| --- | --- |
| `manifest-read-seam.test.ts:32` | regex requires the filename *after* `readFile(`; the repo's own seam (`domain/manifest.ts:53`) is written path-first |
| `scope-order-drift.test.ts:58` | rank regex requires `\d+ : \d+`; the house comparator idiom is `? -1 : 1` (`notify.ts:4196`) |
| `config-state-write-seams.test.ts:102-104` | gates only the `atomicWriteJson` spelling; `writeFile(loc.stateJsonPath, …)` evades it and nothing else in eslint or fallow covers it |
| `scope-fences-63.test.ts:120-131` | skips missing directories, so a rename greens the gate over zero inspected targets |

The shared root cause: **each pattern was written against the one spelling that
existed at authoring time and never proven against the spelling the production code
itself uses.** That is a sharper rule than "plant a violation" — three of these four
gates *do* plant violations, or would still pass a planted-violation test written
the obvious way. The rule to add: *the planted positive must include the spelling
the guarded production code is written in.*

**2. Hermeticity: `PI_CODING_AGENT_DIR` is never neutralized, in any of 13
hand-rolled `withHermeticHome` helpers.** User-scope roots resolve through
`getAgentDir`, re-exported from the Pi SDK at `platform/pi-api.ts:15`; the SDK honors
`PI_CODING_AGENT_DIR` (`node_modules/@earendil-works/pi-coding-agent/dist/config.js`),
and STACK.md documents it as a supported variable. Every copy of the helper
(`tests/architecture/cross-op-convergence.test.ts:89`,
`tests/orchestrators/plugin/{install,update,list,info,uninstall,reinstall,enable-disable}.test.ts`,
`tests/orchestrators/marketplace/{info,list,update,autoupdate}.test.ts`,
`tests/integration/transaction-lifecycle-cascade.test.ts`) saves and restores `HOME`
only. Result: user-scope isolation is conditional on the developer's environment, and
a developer with the variable exported can have these cases write into their real
agent directory. **Areas to check:** every `orchestrators-*` area file and
`edge-handlers-*`. **Fix:** one shared helper clearing both variables — this is the
same "five files hand-roll their own walker" shape META-FINDINGS already names, but
with a correctness consequence rather than a duplication one.

**3. A test that silently `return`s is a case that stopped testing.**
`config-state-consistency.test.ts` has seven `if (x !== "valid") { return; }` blocks
written purely for TypeScript narrowing, immediately after an `assert.equal` that
would already have failed. The idiom is harmless there but is one edit away from
becoming a self-skipping case, and `assert.ok(cond)` (which carries
`asserts value`) removes the need entirely. Worth a grep across all 285 test files
for `) {\n    return;\n  }` inside a `test(` body — other areas plausibly carry the
same idiom in places where the preceding assertion is *not* fatal.

### Corrections to META-FINDINGS.md

- **"The repo's own rule — *a gate wants a test that plants the violation, not one
  that reads the config* — is well applied in the drift gates and violated in these
  five."** Qualify this. `config-state-write-seams.test.ts` plants five synthetic
  offenders and three benign controls — textbook application of the rule — and is
  still bypassable by an entire write API it never considered.
  `manifest-lookup-drift.test.ts` plants six twins and still misses `?.find` and the
  destructured-collection spelling. **Planting proves the pattern fires on the
  spellings the author imagined; it says nothing about the spellings they did not.**
  The rule needs the second clause proposed above.
- **"`tests/architecture/source-scan.ts` — 5 architecture files hand-roll their own
  `.ts` walker instead of using it."** In my ten-file area alone I count five
  (`manifest-lookup-drift`, `disabled-state-classification`,
  `config-state-write-seams`, `scope-order-drift`, `manifest-read-seam`), so the
  repo-wide figure is ≥5 and likely higher. More importantly, the table lists only
  the duplication cost. `source-scan.ts` carries a **second** property the copies
  lack: WR-06 fail-on-missing-target (`source-scan.ts:78-89`). `scope-fences-63.test.ts`
  silently skips missing targets and is a live BLOCKER because of it. Migrating the
  hand-rolled walkers is a correctness fix, not only a DRY fix.
- **`_ADVERSARIAL-BRIEF` framing that "the untrustworthy output is the `### Clean
  files` list"** held only partially here. The single test file on this area's clean
  list yielded four real WARNINGs, and one of ten production modules yielded two. But
  the *six highest-severity findings in this area came from files the first pass had
  already flagged* — it recorded the right files and the wrong severity. For gate
  files specifically, the more productive attack is re-grading the "gate verdict"
  paragraphs, not the clean list.

### Confirmations

- **META-FINDINGS item 2 (test-only reset hooks over module-global state) —
  confirmed from a second angle.** `resetCompletionCache()` is imported and called at
  `tests/architecture/flag-catalog-drift.test.ts:49,87`, a caller outside
  `tests/shared/`. That is independent evidence for the "zero production callers"
  claim and adds a second file to the blast radius of the factory-owned-state fix.
- **META-FINDINGS item 3 (fragment assertions where the whole string is computable) —
  confirmed inside the architecture suite, which the item's table does not list.**
  `cross-op-convergence.test.ts:336-345` uses `assert.match` / `assert.doesNotMatch`
  on an emission the *same file* already pinned byte-for-byte thirty lines earlier
  (line 272). The correct form is not merely next door — it is in the same file.
- **META-FINDINGS §"Real defects found outside the test layer" — the method is
  vindicated again here.** Reading `domain/manifest.ts` alongside
  `manifest-read-seam.test.ts` is what exposed the inert gate; the gate's regex looks
  entirely plausible until you put it next to the code it guards. Recommend the
  gate-audit workstream (sequencing step 8) be run as *gate + guarded source read
  together*, never gate-only.
