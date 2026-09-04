# Orchestrators — plugin shared helpers, clone cache, probes, classifiers — adversarial re-review

**Scope:** `extensions/pi-claude-marketplace/orchestrators/plugin/{shared,clone-cache,git-source-probe,bootstrap,clone-gc,update-row,plugin-state-classifier,discover-names}.ts` (2,918 lines) and their paired tests under `tests/orchestrators/plugin/` (5,749 lines), plus `tests/orchestrators/plugin/scope-tree-inventory.ts`. I read every one of these in full.
**First-pass file:** `unit-test-findings/orchestrators-plugin-support.md`
**Clean files attacked:** 12 (6 test/test-support + 7 production; `shared.test.ts` appears on both the clean list and a findings block, counted once)
**Existing findings graded:** 10

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 5 |
| New WARNING (missed by first pass) | 12 |
| Existing CONFIRMED | 6 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 2 |
| Existing REFUTED | 0 (1 partially refuted — see `assert.equal`) |
| Existing DUPLICATE-OF | 1 |

The first pass's headline claim — "this is the strongest area I have seen in this
sweep" — does not survive contact. It is true of `clone-gc.test.ts`,
`bootstrap.test.ts`, `plugin-state-classifier.test.ts`, `discover-names.test.ts`
and most of `shared.test.ts`. It is not true of `clone-cache.test.ts`, whose
first 1,200 lines have no AAA structure, whose re-export "identity" proof checks
a `.name` string, and which carries four fragment/negative assertions a wrong
implementation passes. And two files the first pass declared clean —
`update-row.test.ts` and `shared.test.ts` — carry defects of exactly the classes
the first pass recorded elsewhere.

## New findings — from the clean lists

### `tests/orchestrators/plugin/shared.test.ts`

- **[BLOCKER] `enableRowDependencies` cannot detect a swapped or dropped guard** — `lines 272–294`
  Only two cases exist: `{}` → `[]` (line 273) and `{stagedAgents: true, stagedMcpServers: true}` → `["agents","mcp"]` (line 284). Mutating `shared.ts:135` from `if (signals.stagedMcpServers === true)` to `if (signals.stagedAgents === true)` leaves both green. So does deleting the second `if` and pushing both members inside the first. Either mutation makes an agents-only plugin declare `mcp`, which drives a false `{requires pi-mcp}` marker and a false info→warning raise on every enable row and every reconcile enable projection (the two production call sites, `enable-disable.ts:1178` and `reconcile/notify.ts:567`). Add two sibling cases: `{stagedAgents: true}` → `["agents"]` and `{stagedMcpServers: true}` → `["mcp"]`. The sibling that already does this right is `update-row.test.ts`, which covers all four `declaresAgents`/`declaresMcp` combinations (lines 6, 36, 66, 96).

- **[WARNING] The `partition?: never` refusal — the only reason the parameter type exists — has no compile-time negative** — `shared.ts:127`, tests `lines 272–294`
  `enableRowDependencies`'s doc comment (shared.ts:116–124) says the `partition?: never` member exists specifically to refuse `PluginUpdateUpdatedOutcome`, which structurally satisfies the two optional picks and would silently return `[]` for every update. `PluginUpdateUpdatedOutcome` declares `partition: "updated"` as required (`orchestrators/types.ts:191`), so the refusal does hold — but nothing proves it. Add, at module scope in `shared.test.ts`, the negative the sibling `plugin-state-classifier.test.ts:18–33` already models:
  ```ts
  // @ts-expect-error an update outcome spells these facts as declaresAgents/declaresMcp
  const refusedUpdateOutcome = enableRowDependencies({ partition: "updated" as const });
  void refusedUpdateOutcome;
  ```
  This is the same defect class META-FINDINGS records as "the `ScopedLocations` brand is never proven": a compile-time guarantee with no `@ts-expect-error` witness.

- **[WARNING] `surfaceDiscoveryWarnings` never exercises the `"reinstalled"` verb** — `lines 1884–1950`, production `shared.ts:1411`
  The `verb` parameter is a closed three-member union interpolated straight into the rendered header (`shared.ts:1422–1423`). The three cases cover `"installed"` twice and `"updated"` once. Mutating `shared.ts:1422` to `const verb = args.verb === "reinstalled" ? "installed" : args.verb` survives. Add a fourth case for `verb: "reinstalled"`, or convert the three into a typed `for`-loop over `["installed","updated","reinstalled"]` rows in the data-driven form `absentTargetReasons` already uses at `lines 433–457`.

- **[WARNING] `emitMarketplaceNotAddedSignal`'s cross-scope-flag arm is untested** — `test("renders the marketplace row when the container is absent from every scope")`, `lines 1822–1852`
  The marketplace-row arm spreads `await crossScopeFlag({...})` into the notify payload (`shared.ts:1346–1350`). The one case runs inside an empty `withTempScopes`, so `crossScopeFlag` always resolves to the empty spread and the rendered bytes never carry the flag. Deleting the whole `...(await crossScopeFlag(...))` spread from `shared.ts:1346` leaves both cases green. Add a case that seeds the marketplace into the *other* scope (`saveScopedState(cwd, "project", { mp: {} })`, signal requesting `"user"`) and asserts the full notification string the flag produces.

- **[WARNING] `makeRecordingBoundary`'s double casts are an instance of the repo-wide over-wide-context cluster, not a local nit** — `lines 183–195`
  The first pass logged this as a local style fix. It is the same root cause META-FINDINGS ranks #1: `notify`/`notifyWithContext` type their `ctx`/`pi` against the full `ExtensionContext`/`ExtensionAPI`, so no test can build one. The `tests/edge/notification-boundary.ts` factory (used by the sibling `bootstrap.test.ts`) already solves this with `mock<ExtensionCommandContext>({exactParams: true})` + an explicit emission/probe budget. Fix by narrowing `notify`'s parameters once (the META-FINDINGS #1 ticket), then delete both casts here — do not hand-write a local narrow interface, which would fork a third spelling.

### `tests/orchestrators/plugin/update-row.test.ts`

- **[WARNING] Placeholder name `result` in all 10 cases** — `lines 21, 51, 81, 111, 143, 180, 218, 250, 281, 312`
  The identical defect the first pass recorded for `git-source-probe.test.ts` (27 sites) is present here, and this file was declared clean. Rename per role: `updatedRow` for the `status: "updated"` cases and `partialRow` for the `status: "partially-installed"` ones.

- **[WARNING] Outcome literals are not `satisfies`-checked against `PluginUpdateUpdatedOutcome`** — `lines 8, 38, 68, 98, 129, 161, 204, 236, 267, 298`
  Each `const outcome = { ... }` is an untyped literal whose fields are checked only structurally at the call site, so excess-property checking never runs and a stray field is silently ignored. Both siblings do this right: `plugin-state-classifier.test.ts:35–86` returns from typed factories (`installedRecord(...): InstalledRecordLike`), and `discover-names.test.ts:18–42` returns `resolvedPlugin(...): MaterializablePlugin`. Add `satisfies PluginUpdateUpdatedOutcome` to each literal (importing the type from `orchestrators/types.ts`), or extract one typed `updatedOutcome(overrides)` factory.

### `tests/orchestrators/plugin/clone-cache.test.ts`

(The first pass reviewed this file and recorded 5 findings; these are additional.)

- **[BLOCKER] The re-export "identity" test proves no identity** — `test("PURL-03/07: clone-cache re-exports preserve canonical and subdirectory helper identity")`, `lines 1569–1584`
  It asserts `exportedSubdirResolver.name === "resolveGitSubdirRoot"` and one `canonicalCloneUrl` return value. Replacing `clone-cache.ts:543`'s `export { resolveGitSubdirRoot } from "../../shared/fs-utils.ts"` with a locally declared `export async function resolveGitSubdirRoot(...)` that returns `{kind:"not-cached"}` for everything still passes the `.name` check; replacing `clone-cache.ts:550`'s `canonicalCloneUrl` re-export with a local `(s) => s.url` also passes. The whole promise of both re-exports (`clone-cache.ts:538–550`: "the git seam and the fs-only presence probe share ONE url reconstruction") is binding identity. Rewrite as the barrel rule states — import the sources under aliases and compare bindings:
  ```ts
  import { canonicalCloneUrl as sourceCanonicalCloneUrl } from ".../domain/clone-key.ts";
  import { resolveGitSubdirRoot as sourceResolveGitSubdirRoot } from ".../shared/fs-utils.ts";
  assert.strictEqual(canonicalCloneUrl, sourceCanonicalCloneUrl);
  assert.strictEqual(resolveGitSubdirRoot, sourceResolveGitSubdirRoot);
  ```

- **[BLOCKER] Two `assert.ok(path.includes(...))` fragment assertions where the exact path is computable — and computed correctly 650 lines away in the same file** — `line 237` (`materializePluginClone`) and `lines 925–930` (`materializeOrRefreshPluginMirror`)
  `assert.ok(cloneRoot.includes(`${path.sep}plugin-clones${path.sep}`))` passes for *any* key under `plugin-clones/`. Mutating `clone-cache.ts:167` to `pluginCloneKey(networkUrl, args.pin)` (keying off the `.git`-suffixed url instead of the canonical one) leaves line 237 green — a warm cache that never hits, i.e. a re-clone on every install. The correct form is already in this file at `lines 893–897` and `951–955`: `assert.equal(cloneRoot, await locations.pluginCloneDir(pluginCloneKey(<canonical url>, PIN_40)))`. Replace both `assert.ok(...includes...)` checks with that exact-equality form (line 925's companion `basename` + `/^[0-9a-f]{12}$/` checks then become redundant and should go).

- **[BLOCKER] Two standalone existence/negative assertions stand in for the exact call log** — `line 977` and `lines 933–936`
  `assert.ok(state.fetchCalls.length > fetchesAfterFirst, "warm mirror refreshes")` passes for one fetch or fifty; mutating `clone-cache.ts:276` to call `refreshGitHubClone` twice survives. `assert.ok(!state.checkoutCalls.some((c) => /^[a-f0-9]{40}$/i.test(c.ref)))` passes for any number of *non*-40-hex checkouts, so an extra spurious branch checkout on the mirror-create path survives. Replace both with whole-log comparisons: `assert.deepStrictEqual(state.fetchCalls.map(({dir, remote}) => ({dir, remote})), [...])` and `assert.deepStrictEqual(state.checkoutCalls.map(({ref}) => ref), [...])` against hand-written literals. `line 1401` in the same file already does exactly this and is the template.

- **[BLOCKER] `test("SEED-01/03: same-repository git source kinds seed once in manifest order...")` asserts neither "once" nor "order"** — `lines 1215–1247`
  The three same-repo entries (`url`, `subdir`, `github`) all canonicalize to one URL and therefore one mirror key, so the assertions (`mirrorRoot` exists, `otherRoot` does not, staging empty) hold under *any* iteration order and under a mutation that removes `seedOnePluginMirror`'s warm short-circuit at `clone-cache.ts:384` (the second `cp`'s rename would simply be handled as a race win). Give the case a `makeMockGitOps()` and assert the exact `state.cloneCalls`/`checkoutCalls` log, or split it into two cases: one asserting order via a recorded per-entry log, one asserting the warm short-circuit fires (mirror mtime or a sentinel written into the seeded mirror survives a second sweep).

- **[WARNING] 32 of 55 cases carry no `// arrange` / `// act` / `// assert` phase comments** — the whole block from `line 226` to `line 1136`; representative: `226, 246, 268, 293, 324, 646, 669, 881, 914, 958, 1086, 1117`
  Every other test file in this area is at 100% (`git-source-probe.test.ts` 32/32, `clone-gc.test.ts` 10/10, `bootstrap.test.ts` 6/6, `update-row.test.ts` 10/10). Even this file is at 100% from `line 1215` onward, so the drift is intra-file as well as sibling. Add the three phase comments to the 32 cases listed; the `arrange`/`act` boundary in every one of them is already the `await materialize*` / `await resolvePluginPin` line.

- **[WARNING] Three test titles carry the forbidden bare `Pitfall:` planning prefix** — `lines 293, 586, 733`
  `.claude/rules/typescript-comments.md` bans RESEARCH-hazard-list references in titles and comments; `grep -rn "Pitfall" tests/` returns these three lines and nothing else repo-wide, so this file is the sole survivor of the comment sweep in commit `58d34ebb`. Drop the prefix and keep the behavioral sentence: `test("sha wins over ref -- checkout pins the sha, clone singleBranch uses the ref")`, `test("an EEXIST/ENOTEMPTY rename is a warm-cache win (no rethrow)")`, `test("resolvePluginPin does NOT call resolveRemoteRef when a sha is set")`.

- **[WARNING] Two redundant dynamic `await import()` calls for a symbol already imported statically** — `lines 275–278` and `lines 588–589`
  Both pull `pluginCloneKey` from `domain/clone-key.ts` at runtime inside the case body; `line 11` already imports it statically. Line 275 also carries a self-contradicting narration comment ("Recompute the key the same way the seam does, via a first (throwing-free) materialize would -- but here we pre-seed the dir directly"). Delete both dynamic imports and the comment, and use the static binding.

- **[WARNING] Error assertions match message substrings instead of class and structured fields** — `line 642` (`assert.match(promotionError.message, /ENOENT/)`), `line 658` and `line 1128` (`assert.rejects(..., /clone boom/`, `/mirror clone boom/)`)
  The rule requires class + structured fields. For line 642, assert `(promotionError as NodeJS.ErrnoException).code === "ENOENT"`. For 658 and 1128, the arranged error object is in scope — capture it (`const cloneError = new Error("clone boom")`, pass it as `cloneThrows`) and assert `assert.strictEqual(caught, cloneError)`, which additionally proves the error is not re-wrapped when cleanup succeeds.

- **[WARNING] `test("MA-9: a clone failure cleans staging and rethrows with the leak suffix appended")` never produces a leak suffix** — `lines 646–667`
  `cleanupStaging` (`shared/fs-utils.ts:40–52`) returns `undefined` on success and on ENOENT, and `appendLeakToError` (`shared/errors.ts:151–158`) returns the base error unchanged when the leak is `undefined`. This case's cleanup succeeds, so no `(additionally: ...)` suffix is ever produced and nothing asserts one. Rename the title to what it verifies ("cleans staging and preserves the original clone error"), and record that the `(additionally: ...)` composition is owned by `tests/shared/errors.test.ts` — or add a case that makes `rm` fail with a non-ENOENT code.

### `tests/orchestrators/plugin/bootstrap.test.ts`

- **[WARNING] `new URL(import.meta.url).pathname` instead of the repo's `fileURLToPath` idiom** — `line 40`
  `fileURLToPath` is used at 16+ sites across `tests/architecture/`; `new URL(...).pathname` does not percent-decode and yields a leading-slash-prefixed drive path on Windows. Replace with `path.dirname(fileURLToPath(import.meta.url))`.

### `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`

- **[WARNING] `assertNoCrossPluginConflicts`'s first parameter is dead** — `line 1068`
  `_scope: Scope` is never read; the doc (`lines 1047–1052`) says it is "retained for diagnostic-message enrichment and symmetry with other orchestrator helpers", but no message reads it and cross-scope safety is enforced by construction (the caller passes one scope's state). Every call site must supply it and no test can discriminate it — `shared.test.ts:1405/1432/1468` pass `"user"`/`"project"` interchangeably with identical expectations. Drop the parameter and update the three production call sites, or make the conflict lines actually name the scope. Leaving a parameter no behavior depends on is what makes the `_` prefix necessary in the first place.

### `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts` + `clone-cache.ts`

- **[WARNING] `anchorSubdir` and `resolveGitPluginRootWithSubdir` are the same function in two files** — `git-source-probe.ts:125–140` and `clone-cache.ts:564–579`
  Identical logic: `kind === "git-subdir"` → `resolveGitSubdirRoot(cloneDir, path)`, propagate any non-`materialized` arm, else stamp `{kind:"materialized", pluginRoot, resolvedSha}`. Neither gate catches it — `fallow dupes` has `threshold: 3`, and `sonarjs/no-identical-functions` is defeated by the arrow-vs-declaration form and the `UrlSource | GitSubdirSource | GitHubSource` vs `GitBackedSource` parameter spelling. The probe cannot import from `clone-cache.ts` (that would give the network-free read path a git token, NFR-5), but both already import `resolveGitSubdirRoot` from `shared/fs-utils.ts` — move `resolveGitPluginRootWithSubdir` there, have `clone-cache.ts` re-export it as it already re-exports `resolveGitSubdirRoot`, and have `git-source-probe.ts` import it and delete `anchorSubdir`. Each copy is individually covered today (`clone-cache.test.ts:1491–1567`, `git-source-probe.test.ts:88–233`), so the exposure is silent drift, not a live gap.

### `extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts`

- **[WARNING] No injection seam for the two orchestrators it composes** — `lines 41–42`
  `addMarketplace` and `setMarketplaceAutoupdate` are static imports; the only injected dependency is `gitOps` (a platform surface, `BootstrapOptions.gitOps`, line 74). `bootstrap.test.ts` therefore drives both real orchestrators end-to-end and asserts *their* notification bytes (`lines 197–201, 241–248, 273–275, 296–298`) and *their* config write-back semantics (`lines 212–221, 299–308`), which `tests/orchestrators/marketplace/{add,autoupdate}.test.ts` own. That is a deliberate, documented choice (the file header cites D-115-03 and the per-case comments cite CMC-28/30/33, SNM-33, RECON-05, WR-05), and — like `reconcile/apply.test.ts` — it demonstrably catches real composition bugs, so **do not "fix" it into mock-based conformity**. The finding is narrower and factual: `orchestrators/plugin/bootstrap.ts` must be removed from META-FINDINGS' "injected orchestrator dependency" reference-implementation list, because it does not inject one. See "Corrections to META-FINDINGS.md".

## Export ownership census

Every export in the area is owned by a case. This is a real result — it is the check I expected to find gaps in, and it found one only in degree (single-case exports), not in kind.

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `discover-names.ts` | `discoverGeneratedNames` | `discover-names.test.ts:62,92,113,136,166` | owned (5 cases) |
| `discover-names.ts` | `DiscoveredGeneratedNames` (type) | asserted structurally by the 4 `deepStrictEqual`s | owned |
| `plugin-state-classifier.ts` | `classifyInstalledRecord` | `plugin-state-classifier.test.ts:188` (12 rows) | owned, exhaustive |
| `plugin-state-classifier.ts` | `classifyManifestEntry` | `plugin-state-classifier.test.ts:229` (3 rows) | owned, exhaustive |
| `plugin-state-classifier.ts` | `InstalledClassification`, `ManifestEntryClassification`, `UpgradeCandidate` (types) | `plugin-state-classifier.test.ts:15–33` (`satisfies` + 3 `@ts-expect-error`) | owned — model form |
| `plugin-state-classifier.ts` | `InstalledRecordLike` (type) | `plugin-state-classifier.test.ts:35` factory return type | owned |
| `update-row.ts` | `updatedRowFromOutcome` | `update-row.test.ts:6…296` (10 cases) | owned |
| `update-row.ts` | `UpdatedRowSeverity` (type) | inferred at 10 call sites, never `satisfies`-checked | weak — see WARNING above |
| `clone-gc.ts` | `garbageCollectPluginClones` | `clone-gc.test.ts:92…307` (10 cases) | owned |
| `bootstrap.ts` | `bootstrapClaudePlugin` | `bootstrap.test.ts:185…336` (6 cases) | owned |
| `bootstrap.ts` | `BOOTSTRAP_MARKETPLACE_NAME` | — | **incidental only** — `bootstrap.test.ts` never imports it; it hardcodes `"claude-plugins-official"` in 12 places. A wrong value fails the suite, but the constant's stated purpose (drift-prevention with `edge/handlers/plugin/bootstrap.ts`'s failed row) is proven nowhere. Import the constant and interpolate it, or add a drift case pairing it with the edge handler's use. |
| `bootstrap.ts` | `BootstrapOptions` (type) | 6 call sites | owned |
| `git-source-probe.ts` | `makePresenceProbe` | `git-source-probe.test.ts:87` (9 cases) | owned |
| `git-source-probe.ts` | `probeManifestEntry` | `git-source-probe.test.ts:293` (10 cases) | owned |
| `git-source-probe.ts` | `probeUpgradeCandidate` | `git-source-probe.test.ts:446` (5 cases) | owned |
| `git-source-probe.ts` | `readMirrorHeadSha` | `git-source-probe.test.ts:558` (8 cases) | owned |
| `git-source-probe.ts` | `ManifestEntry` (type) | used as the literal type in 15 arrangements | owned |
| `clone-cache.ts` | `materializePluginClone` | `clone-cache.test.ts:191…881` (15 cases) | owned |
| `clone-cache.ts` | `materializeOrRefreshPluginMirror` | `clone-cache.test.ts:914…1136` (9 cases) | owned |
| `clone-cache.ts` | `seedSameRepoPluginMirrors` | `clone-cache.test.ts:1215…1489` (12 cases) | owned |
| `clone-cache.ts` | `resolvePluginPin` | `clone-cache.test.ts:207…879` (11 cases) | owned |
| `clone-cache.ts` | `resolveGitPluginRootWithSubdir` | `clone-cache.test.ts:1491…1567` (4 cases) | owned |
| `clone-cache.ts` | `canonicalCloneUrl`, `resolveGitSubdirRoot` (re-exports) | `clone-cache.test.ts:1569` | **NOT owned as re-exports** — the case checks a `.name` string and one return value, not binding identity. See the BLOCKER above. |
| `shared.ts` | all 21 runtime exports | one `describe()` each, `shared.test.ts:272–1951` | owned — 1:1 describe-per-export mapping verified |
| `shared.ts` | `enableRowDependencies` | `shared.test.ts:272` (2 cases) | owned but non-discriminating — see BLOCKER |
| `shared.ts` | `applyPartialCascadeFold`, `cloneMarketplaceRecordForTargetScope`, `splitStagingWarnings` | one case each (`1609`, `707`, `1856`) | owned and, unusually for single-case coverage, genuinely discriminating — see "Still clean after attack" |
| `scope-tree-inventory.ts` | `retryTree` | consumed by `bootstrap.test.ts` ×8 | test support — no meta-test required |

## Branch census

**(a) Reachable and untested — findings**

| Location | Branch | Note |
| --- | --- | --- |
| `shared.ts:135` | `stagedMcpServers === true` in isolation (and `stagedAgents` in isolation) | BLOCKER above |
| `shared.ts:1422` | the `"reinstalled"` verb value | WARNING above |
| `shared.ts:1346` | `crossScopeFlag` returning a non-empty flag | WARNING above |
| `clone-cache.ts:192–193` / `263–264` | `cleanupStaging` returning a non-`undefined` leak, so `appendLeakToError` appends `(additionally: ...)` | Reachable only when `rm` fails with a non-ENOENT errno. Untested here; the composition primitive is owned by `tests/shared/errors.test.ts`. The mis-titled case at `line 646` claims to cover it. |
| `clone-cache.ts:419–421` | `seedOnePluginMirror`'s non-race rename rethrow | The case at `line 1460` arranges a rename failure but its assertions (`pinnedRoot` absent, next entry seeds) also hold if the throw were swallowed, because `seedSameRepoPluginMirrors:481` swallows it anyway. The rethrow-vs-swallow distinction is unobservable from outside; it is only visible as "the per-entry boundary, not the inner function, owns the swallow". Acceptable, but note the case proves the outer swallow, not the inner rethrow. |
| `bootstrap.ts:121–123` | a non-`MarketplaceDuplicateNameError` error propagating | Covered at `bootstrap.test.ts:336` via a clone failure. **Not** covered: a `MarketplaceDuplicateNameError` raised by a *path*-source add (no clone). Not reachable from `bootstrapClaudePlugin`, whose source is the hard-coded github shorthand. Not a finding. |

**(b) Unreachable by real input — not findings**

- `shared.ts:1323` — `err.notInstalledAt !== undefined && err.plugin !== undefined`. The `MarketplaceNotAddedSignal` constructor (`shared.ts:244–247`) sets both fields together or neither, so the mixed states are unconstructible. The two reachable states are both covered (`shared.test.ts:1780`, `1822`).
- `update-row.ts:102` and `shared.ts:131/135` — the `=== true` (rather than truthy) comparisons. I traced every producer: `install.ts:1783`, `update.ts:2408`, `enable-disable.ts:320/325/1005/1008`, `reconcile/apply.ts:475/535/537`, `reconcile/backfill.ts:413` all write via `...(x === true && { x: true })`, so an explicit `false` never reaches these functions. The `=== true` form is defensive against a shape nothing produces.
- `clone-gc.ts:47` — `seg !== ""`. `path.relative(a, a)` yields `""`, exercised by `clone-gc.test.ts:177` ("exactRoot"). Actually reachable and covered; listed here only because the `seg !== undefined` half is not.

**(c) Compiler-forced, not removable (D-116-01a)**

- `clone-gc.ts:47` — `seg !== undefined`. `String.prototype.split` always returns at least one element, so `[0]` is never `undefined` at runtime; the check exists solely to satisfy `noUncheckedIndexedAccess`.
- `git-source-probe.ts:83` — `sha !== undefined` in the packed-refs loop. Same cause: `line.split(/\s+/)[0]` is always defined (`"".split(/\s+/)` yields `[""]`).
- `plugin-state-classifier.ts:187–194` — `classifyManifestEntry`'s `switch` with no `default`. This is deliberate and documented (`lines 174–177`): under `noImplicitReturns` a fourth `ResolvedPlugin` arm becomes a typecheck failure. The first pass correctly declined to file this as a missing-`default` defect, and I agree — it is *not* an instance of META-FINDINGS' item 5, because the return type is non-`undefined` and the omission is load-bearing.

## Grading of first-pass findings

### `tests/orchestrators/plugin/clone-cache.test.ts`

- **CONFIRMED (magnitude understated)** — *Every temporary directory leaks; no cleanup is ever registered.* Verified: `grep -c "t.after" clone-cache.test.ts` = 0. The finding's *counts* are wrong in both directions and should be corrected before the fix is scoped: there are **6** `mkdtemp` call sites (185, 1145, 1285, 1512, 1531, 1551), not ~15; there are **55** tests, not ~76; and the directories leaked per run are **53** (38 `freshLocations()` calls + 11 `buildMarketplaceCheckout()` calls + 1 inline at 1285 + 3 inline at 1512/1531/1551), 11 of which hold a full git repository written by `isomorphic-git`. The prescribed fix (thread `TestContext` into `freshLocations`/`buildMarketplaceCheckout` and register `t.after(() => rm(dir, {recursive:true, force:true}))`, mirroring `clone-gc.test.ts:20–26` and `git-source-probe.test.ts:55–59`) is exactly right.
- **CONFIRMED** — *Every `test()` call is wrapped in a pointless `void`.* Verified: `grep -rc "^void test(" tests/` returns `clone-cache.test.ts:55` and nothing else repo-wide, so the sibling-drift framing is precise.
- **OVERSTATED (rationale partially REFUTED)** — *Loose `assert.equal`/`assert.deepEqual` used exclusively instead of the strict variants.* The stated blind spot does not exist: the file imports `assert from "node:assert/strict"` (`line 1`), under which `assert.equal === assert.strictEqual` and `assert.deepEqual === assert.deepStrictEqual` are the *same function objects* (verified: `node -e "const a=require('node:assert/strict'); a.equal===a.strictEqual"` → `true`; `a.equal(null, undefined)` throws `ERR_ASSERTION`). Every test file in `tests/` imports `node:assert/strict` — there are zero `from "node:assert"` imports repo-wide — so the `assert.equal(x, undefined)`/`x === null` hazard the finding cites is unreachable. The finding's supporting claim is also factually wrong: `shared.test.ts` uses `assert.equal` **73** times and `assert.strictEqual` 5, and `git-source-probe.test.ts` uses `assert.equal` **25** times and `assert.strictEqual` 0 — both were cited as counter-examples that "use the strict comparators". Correct verdict: a readability WARNING scoped to **three** files (211 sites), whose justification is "a reader cannot tell which assertion semantics apply without checking the import", not a correctness blind spot. Keep the mechanical fix; delete the false rationale so the fixing pass does not mis-prioritise it as a defect.
- **CONFIRMED** — *No `describe()` grouping despite covering five exported functions.* Correct in kind; the module has **seven** exports (five functions plus two runtime re-exports), and the file has 55 tests, not ~76.
- **UNDERSTATED** — *A real (non-fake) git surface is exercised without a comment explaining why it stays offline* (`line 1060`). The mechanism claim is right and I confirmed it: `pathExists(mirrorRoot)` is true (the case pre-creates the dir), so no clone runs, and `refreshGitHubClone` (`marketplace/shared.ts:197`) calls `gitOps.fetch({dir, remote:"origin"})` as its *first* statement against the real `DEFAULT_GIT_OPS`. But a comment is not a sufficient fix. The offline guarantee rests entirely on isomorphic-git's internal ordering — it happens to read `.git/HEAD` before opening a socket — which is a third-party implementation detail this suite has no contract over. A library change would turn this case into a live network call to `https://example.com/repo`. Raise to the hermeticity class and fix by construction: pass an explicit `gitOps` from `makeMockGitOps()` like the other 50 cases, and if the point is genuinely "the default surface fails locally", state that with a fake whose `fetch` throws loudly on any invocation. Note the sibling `bootstrap.test.ts:54–63` already models the right technique — a URL allow-list on the fake so an unplanned remote fails immediately, "that refusal, not the absence of a call, is what keeps these cases offline".

### `tests/orchestrators/plugin/git-source-probe.test.ts`

- **CONFIRMED** — *Placeholder variable name `result` used in all 27 test cases.* Verified at the 27 cited lines. The same defect exists unrecorded in `update-row.test.ts` (10 sites) — see the new WARNING.

### `tests/orchestrators/plugin/clone-gc.test.ts`

- **OVERSTATED** — *Custom `pluginCloneDir` override turns a stub into a mock via a call-order assertion* (`lines 319–330, 347`). The finding claims the recorded order is "already provable from the public result". It is not. `assert.deepStrictEqual(cloneKeys, ["alpha-stale","beta-stale","gamma-stale"])` proves that `omega-live` **never reaches the `pluginCloneDir` chokepoint** — that the `liveKeys.has(key)` guard (`clone-gc.ts:93`) short-circuits *before* the SC-7/NFR-10 path check. The public result (`leaks`, `cloneEntries`) is identical whether or not the live key is routed through the chokepoint and then skipped, so deleting `cloneKeys` as instructed would lose that coverage. Correct verdict: not a defect. If anything is owed here it is a one-line comment on `line 347` saying what the log proves, so a future reader does not delete it for the reason the first pass gave.
- **CONFIRMED (and under-counted)** — *A custom error class is discriminated by `.name` string instead of `instanceof`* (`lines 297–298`). `SymlinkRefusedError` is exported (`shared/path-safety.ts:30`, extending the also-exported `PathContainmentError`), so `assert.ok(caught instanceof SymlinkRefusedError)` is available. Two further `.name` comparisons exist in the same file — `line 226` and `line 264`, both `assert.strictEqual(caught.name, "Error")` — which are vacuous rather than wrong (both errors really are plain `Error`s, from `readdir` and from `assertSafeName` at `domain/name.ts:48`) and should simply be deleted; the adjacent `.code === "ENOTDIR"` and full-message checks carry the discrimination. Fix all three under one rule: assert the class with `instanceof` where a class exists, and drop `name` comparisons entirely where it does not.

### `tests/orchestrators/plugin/shared.test.ts`

- **CONFIRMED** — *`makeRecordingBoundary` hides an incomplete double behind a double `as unknown as` assertion.* Verified at `lines 183–195`, consumed at `1793` and `1832`. See the new WARNING above for the correct fix routing (this is META-FINDINGS #1, not a local narrow-interface job).

### `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`

- **CONFIRMED** — *Undocumented `as` assertion on a schema-typed-`unknown` field* (`line 501`). The cast is safe for the stated reason and the comment is the right fix.

### `unit-test-findings/orchestrators-plugin-support.md` — "Not covered" item 3

- **DUPLICATE-OF `platform.md`** — the first pass could not check whether `tests/platform/git-ops-fake.ts` already supports what `clone-cache.test.ts`'s `makeMockGitOps` re-implements. I checked: it does not, and the re-implementation is not local. `git-ops-fake.ts` calls `structuredClone()` on every recorded option bag (`lines 129, 146, 157, 162, 184, 198, 203`), which throws on the function-bearing `auth` bundle, so **every** consumer strips `auth` before delegating and reattaches it afterwards. See "New cross-cutting evidence" — this belongs to the `platform` area's fake, not here.

## Still clean after attack

These survived deliberate mutation. Naming what they catch is more useful to the fixing pass than another warning.

- **`tests/orchestrators/plugin/plugin-state-classifier.test.ts`** — the strongest file in the area. The 12 rows cover the classifier's decision table exhaustively: I enumerated all `{disabled, degraded, upgradable, candidate-state}` combinations and every one has a row. Mutations caught: moving the `isRecordedButDisabled` guard below the `unsupported.length` branch (caught by `line 104`, whose title names that precedence); changing `resolved?.state !== "unavailable"` to `=== "installable"` (caught by `line 164`, the partial-reapply row); treating an unprobeable `undefined` candidate as `unavailable` (caught by `lines 142` and `181`, which pin the two opposite answers); collapsing `partially-upgradable` into `upgradable` (caught by `line 124`). The `satisfies` + `@ts-expect-error` block at `lines 15–33` is the model form for type-only contracts — three negatives, each naming the confusion it forbids.
- **`tests/orchestrators/plugin/discover-names.test.ts`** — every case compares the whole `DiscoveredGeneratedNames` object with `deepStrictEqual` against a hand-written literal, and the three name-generator conventions are distinct enough (`acme-alpha` / `acme:alpha` / `pi-claude-marketplace-acme-alpha`) that swapping any two fields fails. Mutations caught: swapping `skills`↔`commands`; dropping `agentsSourceDir`; reordering either list (`alpha`/`zeta` fixtures are written in reverse); passing `pluginRoot` instead of the resolved agents dir to `discoverPluginAgents`; returning the bridges' D-07 warnings instead of dropping them. The `createPluginRoot(t, prefix)` helper registers `t.after` cleanup at `line 14` — the pattern `clone-cache.test.ts` is missing.
- **`tests/orchestrators/plugin/clone-gc.test.ts`** — 10 cases, all whole-value `deepStrictEqual`, all with `t.after` cleanup. Mutations caught: dropping the `resolvedSha === undefined` guard (`line 152`); taking the last path segment instead of the first (`line 102`'s nested `beta-live/packages/nested` record); treating a `..`-relative or empty segment as live (`line 172`); returning instead of rethrowing a non-ENOENT `readdir` failure (`line 210`); swallowing the chokepoint's refusal instead of letting it propagate (`lines 247`, `276` — and both assert the on-disk tree is untouched, so a "refuse *after* deleting" mutation fails too); returning early on the first rm leak instead of continuing (`line 307`).
- **`tests/orchestrators/plugin/bootstrap.test.ts`** — six cases, each asserting the complete notification list, the complete `state.json`, the complete config JSON, **and** the complete relative scope tree via `retryTree`. That combination is unusually hard to fool. Mutations caught: dropping the `MarketplaceDuplicateNameError` swallow (a second "added" row appears in `line 241`'s list); swallowing a *non*-duplicate error (`line 336` asserts the throw, zero notifications, empty state, and a one-entry tree); reaching the autoupdate step after a clone failure (same case); writing to project scope (`line 316` asserts the project tree is `[]`); re-writing a byte-stable config on the idempotent path (`lines 249–250, 276–278` compare file bytes, not parsed objects). `createHermeticUserScope` (`lines 80–112`) is the best environment-isolation helper I saw: it saves and restores both `HOME` and `PI_CODING_AGENT_DIR` through `t.after`, distinguishes "was unset" from "was set", and carries a comment (`lines 107–109`) explaining that `PI_CODING_AGENT_DIR` must be *deleted*, not just overridden, because `getAgentDir()` reads it ahead of `homedir()`.
- **`tests/orchestrators/plugin/git-source-probe.test.ts`** — despite the `result` naming, the assertions are strong: every `makePresenceProbe` and `probeUpgradeCandidate` case compares the whole `GitPluginRootResult`/`ResolvedPlugin` including the exact `detail` strings. Mutations caught: skipping `anchorSubdir` on the unpinned mirror arm (`line 186` expects `mirrorDir/plugins/canva`); using the pinned clone key for an unpinned source or vice versa (`lines 162`, `235`, `253`); returning `materialized` instead of propagating `escapes`/`missing-subdir` (`lines 88`, `212`); resolving a loose ref before checking for a detached HEAD (`line 615`); reading the loose ref *after* packed-refs (`lines 639`, `651`); failing to skip `#` and `^` lines in packed-refs (`line 651` plants both); swallowing a non-ENOENT loose-ref error instead of rethrowing (`line 596` plants EISDIR by making the ref path a directory).
- **`tests/orchestrators/plugin/update-row.test.ts`** — despite the naming and `satisfies` warnings, the 10 cases discriminate the composer's whole contract. Mutations caught: swapping `baseSeverity.updated` with `baseSeverity.partiallyInstalled` (caught in *both* directions by `lines 96` and `265`, which set the two members differently); emitting the reason tokens in any other order (`line 187` pins orphan → malformed-skill → malformed-command → unsupported-hooks → lsp → unsupported-component); letting the orphan-rewake axis move the severity channel (`line 296`); letting the malformed axis *not* move it (`lines 202`, `159`); rendering `reasons: undefined` instead of omitting the key (`lines 124`, `156` use `Object.hasOwn`); treating an empty `partialDegrade.kinds` as a partial row (`line 127`); swapping `from`/`to` or `toVersion`/`fromVersion` (all cases use distinct versions).
- **`tests/orchestrators/plugin/scope-tree-inventory.ts`** — I agree with the first pass. The module-scope `inventoryReaddir` binding (`lines 17–20`) is bound through `createRequire` specifically so a case that has armed a `readdir` mock still sees the real tree, and the header states that reason. It is a documented, load-bearing exception, not shared mutable state. `retryTree` returns a freshly built array on every call and excludes only `.state-lock`, with the reason given.
- **`shared.test.ts`'s `applyPartialCascadeFold` case (`line 1609`)** — one case, but genuinely discriminating: each of the five axes uses a distinct sentinel (`drop-skill` / `drop-command` / `drop-agent` / `drop-mcp` / `drop-hook`), so swapping any two filters, or wiring `dropped.commands` to anything but `resources.prompts` (the asymmetric TR-03 mapping), fails. It also plants a `missing-*` entry per axis to prove the filter tolerates a dropped name that was never installed, and re-asserts `dropped` unchanged to prove the fold does not mutate its input.
- **`shared.test.ts`'s `selectDeclaringConfigWriteTarget` block (`lines 734–880`)** — six cases, every one a whole-object `deepStrictEqual` against a hand-written `DeclaringConfigWriteTarget`. All four CFG-03 arms are separated: unreadable-local-as-determinant, unreadable-local-under-`--local`, unreadable-base-under-explicit-`false`, and the `sibling: undefined` uncertainty-preserving arm. Mutations caught: reading `invalid` as "not declared locally" (`line 735`); collapsing `sibling: undefined` into `{schemaVersion: 1}` (`line 837`); keying the parses off `targetIsLocal` instead of off the paths (`line 807` pairs a base target with a local sibling).
- **`shared.test.ts`'s `emitMarketplaceNotAdded` block (`lines 1651–1777`)** — the orchestrated arms `verify()` a `strong-mock` `ctx`/`pi` with *no* expectations, which is a silence proof that the orchestrated path never notifies; the standalone arms pin the exact rendered bytes including the `[user]` bracket and its absence. Mutations caught: notifying on the orchestrated path; returning a failure object on the standalone path; passing `["project","user"]` when a scope was requested (`line 1699`).

## Not covered

- I did not run any test, coverage, or gate command, per the brief. Every claim above is from reading source, plus two read-only `node -e` snippets that touched no repo file (the `node:assert/strict` identity check, reported inline).
- I did not read the ~5,700 lines of `clone-cache.test.ts` line by line; I read `lines 1–330`, `580–720`, `876–1260`, `1330–1584` in full and sampled the rest via targeted greps (assertion-form counts, `mkdtemp`/`t.after`/`void test`/`Pitfall`/AAA-comment censuses, which are exhaustive over the file). A line-by-line read could surface additional weak assertions in `lines 330–580` and `720–876`.
- `orchestrators/marketplace/{add,autoupdate}.ts` are exercised end-to-end by `bootstrap.test.ts` but are owned by another area; I graded only what that dependency implies for `bootstrap.ts`.
- Direct per-pair coverage (`npm run test:coverage:direct`) is still unmeasured for this area, as it is repo-wide.

## Meta-findings impact

### New cross-cutting evidence

1. **The `git-ops-fake.ts` `structuredClone` defect is at least 8× larger than recorded, and it is a *shared-fake* ticket, not a per-file one.** META-FINDINGS says "Already biting: `tests/orchestrators/marketplace/add.test.ts` carries a strip-and-reattach workaround instead of the shared fake handling it once." The workaround is in **at least 8 files and ~15 call sites**: `tests/orchestrators/plugin/clone-cache.test.ts:103,117,160` (three methods in one factory), `tests/orchestrators/plugin/bootstrap.test.ts:69`, `tests/orchestrators/plugin/info.test.ts:179,186,205`, `tests/orchestrators/plugin/fetch.test.ts:159,174,202`, `tests/orchestrators/plugin/install.test.ts:5714,5728`, `tests/orchestrators/marketplace/add.test.ts:141`, `tests/orchestrators/reconcile/apply.test.ts:122,136`, `tests/edge/handlers/plugin/bootstrap.test.ts:247`, `tests/architecture/config-state-consistency.test.ts:74`. Every one of them also *loses* the `auth` bundle from the recorded call unless it manually reattaches it (`clone-cache.test.ts:106–108` reattaches; `bootstrap.test.ts:69` does not, so that suite cannot assert auth threading at all). Fixing `git-ops-fake.ts` to clone options with a function-preserving shallow copy deletes ~15 workarounds across 8 files at once, which puts it in the same leverage tier as META-FINDINGS' items 1 and 4. **Areas to check for more:** every `tests/orchestrators/**` and `tests/edge/**` file that constructs `createGitOpsFake`.

2. **"A gate wants a test that plants the violation" applies to re-export identity too.** `clone-cache.test.ts:1569` is a sixth instance of the "gates that do not gate" class: a test named "...preserve canonical and subdirectory helper identity" that checks `fn.name === "resolveGitSubdirRoot"` — a string a locally-declared replacement also satisfies. The unit-testing rule for barrels already prescribes `assert.strictEqual(reExport, source)`. **Other areas should be swept for `.name` comparisons standing in for binding identity**, particularly the `bridges/*/index.ts` and `orchestrators/{import,marketplace,plugin}/` barrels that META-FINDINGS notes exist.

3. **The `ScopedLocations` brand is bypassable by object spread, which weakens META-FINDINGS' item 5 in a way worth recording.** `clone-gc.test.ts:320–330` builds a working `ScopedLocations` as `Object.freeze({ ...locations, async pluginCloneDir(key) {...} }) satisfies ScopedLocations`. The spread copies the unique-symbol brand along with everything else, so the brand's stated guarantee ("a hand-constructed object literal cannot type-check as `ScopedLocations`") holds only against literals built *from nothing*. That is a legitimate and useful test technique — but it means the `@ts-expect-error` negative META-FINDINGS asks for must plant a *bare* literal, not a spread, or it will not fail. Worth stating explicitly in that ticket so the fix is written correctly the first time.

4. **The "one file survived the comment sweep" shape is worth a repo-wide re-grep, not a per-file finding.** Commit `58d34ebb` ("refactor: finish the comment sweep across the tree") removed planning-artifact vocabulary; `grep -rn "Pitfall" tests/` still returns exactly three lines, all in `clone-cache.test.ts`. A sweep that is one grep short of complete is invisible until someone greps. **Recommend a single vocabulary re-grep across `tests/` and `extensions/` for `Pitfall`, `Pattern N`, `Phase`, `Plan NN`, `Wave`, and `milestone v` before the fixing pass closes** — this repo already has a `partial-vocabulary-guard.test.ts`, so the enforcement mechanism exists and just needs another term list.

### Corrections to META-FINDINGS.md

- **"Patterns to propagate" table, row "Injected orchestrator dependency: `orchestrators/plugin/bootstrap.ts`, `orchestrators/import/`, `edge/handlers/marketplace/shared.ts`"** — and the same claim in "Ranked by leverage" item 4 ("`bootstrap.ts`, `import.ts`, and `edge/handlers/marketplace/shared.ts` already inject and are the in-repo template"). **`orchestrators/plugin/bootstrap.ts` does not inject an orchestrator.** It statically imports both orchestrators it composes: `import { addMarketplace } from "../marketplace/add.ts"` (`bootstrap.ts:41`) and `import { setMarketplaceAutoupdate } from "../marketplace/autoupdate.ts"` (`bootstrap.ts:42`). Its `BootstrapOptions` carries `ctx`, `pi`, `cwd`, and `gitOps` (`lines 65–75`); `gitOps` is a *platform* seam (D-12), not an orchestrator seam, and its own comment (`lines 21–22`) says bootstrap applies no gitOps default because `addMarketplace` does. `edge/handlers/plugin/bootstrap.ts:24–27` likewise statically imports `bootstrapClaudePlugin`. The genuine template in that list is `orchestrators/import/execute.ts`, which declares `ImportDeps` with an optional `installPlugin` and resolves it through `installPluginFn(deps)` at `lines 158–227`. **Remove `orchestrators/plugin/bootstrap.ts` from both places**, or the fixing pass will copy a pattern that is not there.
- **"Ranked by leverage" item 3, the fragment-assertion table** lists five files and does not include `tests/orchestrators/plugin/clone-cache.test.ts`. It belongs there: `lines 237, 925, 933, 977` are four sites where a fragment, an inequality, or a negative-existence check stands in for a computable whole value, and the exact form is present in the same file at `lines 893–897`, `951–955`, and `1401`. Add it with a count of 4 and the note that the correct form is already in-file.
- **"The dominant shape: sibling drift" bullet "`clone-cache.test.ts` vs. its 4 siblings (loose `assert.equal`, and ~15 `mkdtemp` directories never cleaned up)"** — two corrections. (a) The loose-`assert.equal` half is not sibling drift: `shared.test.ts` (73 sites) and `git-source-probe.test.ts` (25 sites) use the same spelling, and under `node:assert/strict` it is behaviorally identical to the strict form anyway. (b) The temp-dir half is real but the number is wrong: **53** directories per run from **6** call sites, not ~15. The accurate sibling-drift claims for this file are: no AAA phase comments in 32 of 55 cases (siblings are at 100%), `void test(` at 55 sites (zero elsewhere repo-wide), `Pitfall:` titles at 3 sites (zero elsewhere repo-wide), and no `t.after` cleanup (all four siblings have it).

### Confirmations

- **"Clean verdicts are not reliable"** — confirmed hard. Two files the first pass placed on its clean list (`update-row.test.ts`, and `shared.test.ts` beyond its one recorded finding) each yielded findings of classes the same reviewer had already recorded elsewhere in the same area — the `result` placeholder and a non-discriminating case set. The attack that found them was mechanical (grep for the recorded defect's signature across the whole area, then mutate), which suggests the highest-yield adversarial move is *propagating each recorded finding across the area's clean list* before hunting for new classes.
- **Item 2, "test-only hooks over module-global state"** — independently confirmed absent from this area, which is a useful negative. None of the eight production modules exports a reset hook, holds module-level mutable state, or reads `process.env` inside logic. The one module-scope binding in the area's test support (`scope-tree-inventory.ts:20`'s `inventoryReaddir`) is a deliberately pre-bound *read* whose rationale is stated in the file header and which no test mutates.
- **Item 5, "restore exhaustiveness on closed-union switches"** — this area's one closed-union `switch` (`plugin-state-classifier.ts:187`) is a *correct* instance of the opposite pattern and should not be swept into that ticket. Its `default`-less form is load-bearing under `noImplicitReturns` (the function's return type excludes `undefined`), it is documented as such at `lines 174–177`, and the repo's own recorded note on `switch` exhaustiveness (TS7030) supports it. The first pass reached the same conclusion; I confirmed it against the compiler settings and the union definition.
- **"`apply.ts`'s deliberate deviation … do not fix this into conformity"** — the same judgment is needed for `tests/orchestrators/plugin/bootstrap.test.ts`, which cites the same D-115-03 in its header (`lines 1–9`) and drives the real `addMarketplace` + `setMarketplaceAutoupdate` against a case-owned temp tree with only the git remote faked. Its assertion strength (complete notification list + complete state + complete config bytes + complete scope tree, per case) is exactly what makes the deviation pay. **Add it to the "do not conform" list beside `apply.test.ts`.**
- **The `new Date()` hidden dependency** — `orchestrators/marketplace/add.ts:700` and `:863` call `new Date().toISOString()` inside the record write, which is why `bootstrap.test.ts:188` must reach for `t.mock.timers.enable({apis:["Date"]})` to pin `lastUpdatedAt`. That is the guidelines' named "inject a `Clock`" case, and the fix belongs to the marketplace-add area, not here. Recording it so the two areas' findings link up.
