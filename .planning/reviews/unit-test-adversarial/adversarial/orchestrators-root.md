# Orchestrators — auth host, edge deps, plugin path, scope fanout, discover — adversarial re-review

**Scope:** `extensions/pi-claude-marketplace/orchestrators/{auth-host,discover,edge-deps,plugin-path,scope-fanout,types}.ts` and `tests/orchestrators/{auth-host,discover,edge-deps,plugin-path,scope-fanout,types}.test.ts` — all 12 files read in full, plus the collaborators needed to settle a mutation (`persistence/locations.ts`, `persistence/state-io.ts::isRecordedButDisabled`, `shared/completion-cache.ts::ManifestSoftFailError`, `shared/errors.ts::AggregateResourcesDiscoverError`, `shared/debug-log.ts`, `orchestrators/plugin/git-source-probe.ts`, `edge/completions/data.ts`, `edge/register.ts`, `tests/architecture/no-orchestrator-network.test.ts`).
**First-pass file:** `unit-test-findings/orchestrators-root.md`
**Clean files attacked:** 6 (4 test, 2 production)
**Existing findings graded:** 9

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 5 |
| New WARNING (missed by first pass) | 11 |
| Existing CONFIRMED | 8 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's headline — "no BLOCKER findings surfaced anywhere in this area" — does not survive. Five mutations survive every case in files it declared clean, and one production doc comment claims a compile-time guarantee that the compiler demonstrably does not provide (proved below with a `tsc` run).

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts` + `tests/orchestrators/scope-fanout.test.ts`

- **[BLOCKER] An explicit `scope: "user"` request is never exercised — the module can ignore the caller's scope undetected** — `scope-fanout.ts:58`, all 9 cases in `tests/orchestrators/scope-fanout.test.ts`
  Mutating `const scopes = opts.scope === undefined ? ["project", "user"] : [opts.scope];` to `... : ["project"]` — i.e. discarding the caller's explicit scope entirely — leaves **every** case green. Of the nine cases, five pass `scope: "project"` (lines 117, 222/228, 286, 313, 355) and four pass `scope: undefined` (lines 100, 163, 396, 423). No case ever passes `scope: "user"`, so the explicit-scope arm is only ever observed returning the scope it would have returned anyway. `readScopeMarketplaceRecord`'s user-scope path *is* reached (via the `undefined` fan-out in `test("preserves same-name project-before-user rows…")`), which is what makes this look covered and is not.
  **Fix:** add one case — seed a marketplace record into `user` only and a *malformed* `state.json` into `project` (mirroring the inverted arrange already at line 112), call with `scope: "user"`, and `assert.deepStrictEqual` a one-row result whose `scope` is `"user"`. The malformed project file proves the project scope was not read, exactly as line 112 proves it for the mirror case.

### `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` + `tests/orchestrators/edge-deps.test.ts`

- **[BLOCKER] `loadStateForScope`'s documented TC-9 verbatim-throw contract has no case — swallow-and-return-default survives** — `edge-deps.ts:24-25, 157-175`; `tests/orchestrators/edge-deps.test.ts:309-355`
  The module header states the contract in two halves: "`loadStateForScope`: throws state-load errors verbatim. TC-9 surfaces these via the cache layer's `getMarketplaceNames` rebuild path" versus "`loadManifestForMarketplace`: catches anything … and re-throws as `ManifestSoftFailError`". Only the second half is tested (lines 551, 572). Wrapping the body of `loadStateForScope` in `try { … } catch { return { marketplaces: {} }; }` — the catalogue's "swallow the error and return a default" mutation — leaves both of its cases green, because the only other case (`"reports no marketplaces when the scope has no state file"`, line 342) already expects `{ marketplaces: {} }`. The distinction between the two halves is the whole reason the header carries an "Error contracts" block, and the completion cache branches on it.
  **Fix:** add a case that writes `{"schemaVersion": 99, "marketplaces": {}}` to the project `state.json` (the `seedUnsupportedState` shape already used in `tests/orchestrators/plugin-path.test.ts:72`) and asserts `await assert.rejects(resolver.loadStateForScope("project"), (error) => { assert.ok(!(error instanceof ManifestSoftFailError)); assert.strictEqual(error.message, \`state.json at ${...} has an unsupported schema version\`); return true; })`. The `!(instanceof ManifestSoftFailError)` half is the load-bearing assertion — it is what distinguishes TC-9 from TC-8.

- **[BLOCKER] The `LocationsResolverLike` ↔ `LocationsResolver` structural sync is claimed compile-enforced and is not** — `edge-deps.ts:45-55` (comment), `edge-deps.ts:57-69`, `edge/completions/data.ts:130-147`, `edge/register.ts:108`
  The comment asserts: "The fields MUST stay in sync with `edge/completions/data.ts`; a future rename would be caught by the edge-side TypeScript compile." It is false. Both `MarketplaceStateRecordLike` and `MarketplaceStateRecord` declare *every* field optional, so TypeScript's weak-type detection only fires when the two share **no** property. I ran the check with this repo's own `tsc` (`--strict --exactOptionalPropertyTypes --module NodeNext`): renaming `manifestPath` → `manifestFile` on the consumer side while keeping `plugins` **compiles clean** (no error at the `register.ts:108` assignment); only renaming *both* fields produces `TS2322 … has no properties in common`. So a single-field rename in `data.ts` silently makes the resolver return records the consumer reads as `undefined`. This is the repo's own recorded "optional-field silent-omission" class.
  **Fix:** two changes. (1) Correct the comment — say the shapes are pinned by a test, not by the edge-side compile. (2) Add the pin to `tests/orchestrators/edge-deps.test.ts` (tests are outside the BLOCK C import rule, so the test may import the edge type): `import type { LocationsResolver } from "…/edge/completions/data.ts";` then `void (makeLocationsResolver("/cwd") satisfies LocationsResolver);` plus a bidirectional key-set pin in the style of the existing `tests/architecture/compat-01-no-expansion.test.ts` (the in-repo precedent), so a rename or an added member on either side stops compiling.

- **[BLOCKER] An installed plugin whose manifest entry declares no version is never exercised — the upgradable guard can be loosened undetected** — `edge-deps.ts:86-87`; `bucketizerCases`, `tests/orchestrators/edge-deps.test.ts:357-531`
  Mutating `manifestEntry?.version !== undefined && manifestEntry.version !== installed.version` to `manifestEntry !== undefined && manifestEntry.version !== installed.version` still type-checks (the narrow to `probeUpgradeCandidate`'s non-optional `ManifestEntry` parameter survives) and leaves all 16 bucketizer cases green. Every installed fixture either sets `manifestVersion` (rows at 361, 367, 373, 386, 399, 411, 424, 437, 449, 522) or is absent from the manifest entirely (`inManifest: false`, row 461). No row has an installed record *and* a manifest entry with no `version`. Under the mutation such a plugin would be probed as an upgrade candidate and could classify `partially-upgradable`/`upgradable` instead of `installed`.
  **Fix:** add one row to `bucketizerCases`: `{ title: "keeps an installed record whose manifest entry declares no version installed", marketplace: "unversioned-install-mp", plugins: () => [{ name: "plug", installed: { version: "1.0.0" } }], rows: [{ name: "plug", status: "installed", version: "1.0.0" }] }` (omit `manifestVersion` so `inManifest` stays true and the entry carries no `version`).

- **[WARNING] `edge-deps.ts` claims NFR-5 but is not in the no-network gate's target list** — `edge-deps.ts:75-77`, `tests/architecture/no-orchestrator-network.test.ts:68-115`
  `edge-deps.ts` states "The upgrade-candidate resolve stays NO-NETWORK (`resolveStrict`, NFR-5)", `edge-deps.test.ts:7-9` says the suite "installs a fail-fast replacement for the process-wide transport that the no-network read surfaces (NFR-5) must never reach", and `orchestrators/plugin/git-source-probe.ts:13-15` says it carries no git seam "so `edge-deps.ts` can consume it while the no-orchestrator-network gate (NFR-5) stays green". Neither file appears in `FORBIDDEN_TARGETS`. Neither names any of the four forbidden patterns today, so adding them is a no-op that cannot break. The gate's own docstring supplies the argument: "The behavioral half can only show that no call happened on the paths a test exercises; it can never show the surface is absent." This is a fourth instance of META-FINDINGS' "gates that do not gate" item 3, which currently names only `marketplace/list.ts` and `remove.ts`.
  **Fix:** add `"extensions/pi-claude-marketplace/orchestrators/edge-deps.ts"` and `"extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts"` to `FORBIDDEN_TARGETS` with the rationale comment each entry carries. Note `auth-host.ts` must **not** be added — it legally does `import type … from "../platform/git.ts"` (line 37) and `export { DEFAULT_CREDENTIAL_OPS } from "../platform/git-credential.ts"` (line 47), both of which the `from ["'][^"']*platform/git` pattern matches.

- **[WARNING] `makeLocationsResolver` declares no collaborator seam, so 16 of its 18 cases assert another module's contract** — `edge-deps.ts:147-241`; `tests/orchestrators/edge-deps.test.ts:1-14, 357-549`
  The resolver closes over static imports (`loadState`, `loadMarketplaceManifest`, `probeManifestEntry`, `probeUpgradeCandidate`, `classifyInstalledRecord`), so the test cannot substitute them. Its own header admits it: "The resolver declares no collaborator parameter, so its contract is the value it reads back off a real tree." The consequence is that the 16 `bucketizerCases` re-derive the status vocabulary end-to-end against a real filesystem, and that vocabulary is owned by `tests/orchestrators/plugin/plugin-state-classifier.test.ts` and `tests/orchestrators/plugin/git-source-probe.test.ts` — both of which exist. This is the same root cause META-FINDINGS item 4 records for the 15 edge handlers; the cluster is larger than that file states.
  **Fix (sequence with item 4, do not do it alone):** give `makeLocationsResolver` an optional dependencies object defaulting to the real functions — the pattern `orchestrators/plugin/bootstrap.ts` and `edge/handlers/marketplace/shared.ts` already use. Then keep ~4 wiring cases here (installed-before-not-installed ordering, the version field, the two soft-fail arms) and let the classifier suites own the status matrix.

### `extensions/pi-claude-marketplace/orchestrators/discover.ts` + `tests/orchestrators/discover.test.ts`

- **[BLOCKER] No case mixes a successful read with a failed one — the throw threshold is an unguarded off-by-one** — `discover.ts:44-46`; `tests/orchestrators/discover.test.ts:80, 110, 154, 167, 180`
  All five cases sit at the extremes: four produce zero failures, one (line 180) produces all four. Mutating `if (failures.length > 0)` to `if (failures.length > 1)` — or to `>= 4` — leaves every case green. Nothing pins that a *single* hard read failure aborts the whole discover, nor that a partially-successful traversal discards its successes rather than returning them alongside. Both are the behavioral core of an "attempt every read, then throw" aggregator.
  **Fix:** add one case that stages a valid skill under `user` and gives `project` an invalid `skillsTargetDir` (reuse the `\0`-suffixed path trick and the `Object.freeze({...project, skillsTargetDir})` spread already at lines 183-198). Assert the rejection is an `AggregateResourcesDiscoverError` whose `failures` has exactly one entry, `{ scope: "project", kind: "skills", … }` — proving both that one failure is enough and that the user scope's successful skill path is not returned.

- **[WARNING] The sort contract cannot distinguish `localeCompare` from a codepoint sort** — `discover.ts:121`; `tests/orchestrators/discover.test.ts:80` (`test("aggregateDiscoveredResources keeps scope order and sorts within each resource directory")`)
  The only ordering fixture is `alpha`/`zulu`/`aardvark` — all lowercase ASCII, where `a.name.localeCompare(b.name)` and a plain codepoint comparison agree. Replacing `localeCompare` with `a.name < b.name ? -1 : 1` survives. The two disagree on mixed case (`"Zulu"` sorts before `"alpha"` by codepoint, after it by locale), which is exactly what a plugin-authored skill directory can produce.
  **Fix:** in the same case, stage `Alpha`, `beta`, and `Zulu` skills and prompts and assert the locale order (`Alpha`, `beta`, `Zulu`) rather than the codepoint order (`Alpha`, `Zulu`, `beta`).

- **[WARNING] Placeholder name `result` used four times, unlike every sibling in the directory** — `tests/orchestrators/discover.test.ts:91, 145, 159, 174`
  `result` is named explicitly in the unit-testing rules' Naming section as a finding. Every sibling in this directory names its act-phase value for its production role: `auth` (`auth-host.test.ts:81`), `cachePath` / `scopeState` / `indexRows` (`edge-deps.test.ts:235, 335, 543`), `binDirs` / `pathUpdate` (`plugin-path.test.ts:155, 250`), `records` (`scope-fanout.test.ts:98`). The first pass flagged this file's assertion-alias naming and missed the rule violation next to it.
  **Fix:** rename all four to `discovered`.

### `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` + `tests/orchestrators/auth-host.test.ts`

- **[WARNING] The `DEFAULT_CREDENTIAL_OPS` runtime re-export has no owning case** — `auth-host.ts:47`; `tests/orchestrators/auth-host.test.ts` (no reference)
  This is a value re-export, not a type one, and it is load-bearing: `install.ts:135`, `reinstall.ts:116`, `fetch.ts:46` and `info.ts:72` import it *from here* precisely because the no-network gate forbids them naming `platform/git-credential.ts` (the file's own lines 41-46 say so). Its existence is compile-guarded by those four importers, but its *identity* is not: re-pointing it at a different value, or wrapping it, breaks nothing in the suite. The unit-testing rules' Barrels pattern prescribes the check.
  **Fix:** one case — `import { DEFAULT_CREDENTIAL_OPS } from "…/orchestrators/auth-host.ts"` and `import { DEFAULT_CREDENTIAL_OPS as source } from "…/platform/git-credential.ts"`, then `assert.strictEqual(DEFAULT_CREDENTIAL_OPS, source)`.

- **[WARNING] `test("forwards a URL host while truly omitting optional collaborators")` asserts a property of its own fixture, not of the module** — `tests/orchestrators/auth-host.test.ts:712-729`, specifically line 727
  `assert.deepStrictEqual(Object.keys(authOptions), ["credentialOps", "ctx"])` inspects the literal the case built two lines earlier at 716. It can only fail if `buildCloneAuth` *mutates its argument*, which nothing suggests and no other case would tolerate. The behavior the title claims — that the optional-collaborator spreads at `auth-host.ts:147-148` omit rather than forward `undefined` — is not observable through the returned bundle at all, since `buildAuthForHost` re-spreads the same way and `authMemo?.get()` is undefined-safe.
  **Fix:** drop line 727 and retitle to `"forwards a URL host without either optional collaborator"`. The remaining `deepStrictEqual` on the bundle (722-726) plus `verify(ctx)` is the real content of the case, and it is sound.

- **[WARNING] The three-member git-source kind union is spelled inline twice instead of reusing the domain type** — `auth-host.ts:59` (`"github" | "url" | "git-subdir"`) and `auth-host.ts:134` (`"url" | "git-subdir" | "github"`)
  `domain/source.ts:79` already exports `GitBackedSource = UrlSource | GitSubdirSource | GitHubSource`, and this module already imports from `domain/`. Two hand-written copies in one file, in different member order, is how a fourth kind gets added to one and not the other.
  **Fix:** `import type { GitBackedSource } from "../domain/source.ts";` and use `GitBackedSource["kind"]` at both sites.

### `extensions/pi-claude-marketplace/orchestrators/plugin-path.ts` + `tests/orchestrators/plugin-path.test.ts`

- **[WARNING] The `homedir()` argument at `recomputePluginPath` is inert — any value survives** — `plugin-path.ts:11, 94-97`
  `locationsFor("user", cwd)` ignores `cwd` entirely for the user scope (`locations.ts:145`: `scope === "user" ? getAgentDir() : path.join(cwd, ".pi")`). Replacing `homedir()` with `""` — or with `cwd` — changes nothing, and no case can tell. The `node:os` import exists solely to feed a discarded parameter, and a reader reasonably concludes user scope is home-rooted *through this call*, which it is not (it is rooted through `getAgentDir()`, one layer down).
  **Fix:** pass `cwd` and delete the `homedir` import, keeping the existing comment reworded to say `locationsFor` ignores `cwd` for the user scope. This also removes one hidden dependency from the module.

- **[WARNING] `recomputePluginPath`'s hidden `process.env` / `homedir()` dependencies are why every case must mutate process globals** — `plugin-path.ts:90, 96, 111-113`; `tests/orchestrators/plugin-path.test.ts:81-121` and all seven `recomputePluginPath` cases
  The module reads `process.env[PATH_LEDGER_ENV]` and `process.env.PATH` and calls `homedir()` inline. Writing `process.env.PATH` is the module's *promise* (PENV-01), so that half is legitimate; *reading* the environment and the home directory is not, and it is what forces `snapshotPathEnvironment`/`restorePathEnvironment` and the `PI_CODING_AGENT_DIR` + `HOME` juggling into every case. This is the root cause behind the first pass's `t.after()` finding, which it recorded as a pure style preference.
  **Fix (one of the four sanctioned forms — "make the hidden dependency an explicit parameter"):** give `recomputePluginPath` a second parameter `env: Pick<NodeJS.ProcessEnv, …> = process.env` (or an `{ env }` options bag) and read/write the ledger and `PATH` through it. The cases then construct a plain object per case and drop the snapshot/restore machinery entirely.

### Cross-file, this directory

- **[WARNING] Four bespoke hermetic-temp-scope harnesses in one directory, and a fifth shape copied 13 times repo-wide** — `discover.test.ts:20-44` (`makeTestLocations`), `edge-deps.test.ts:81-114` (`createHermeticScope`), `scope-fanout.test.ts:27-50` (`makeTestScopes`), `plugin-path.test.ts:81-121` (`snapshotPathEnvironment`/`restorePathEnvironment`)
  All four do the same three things (own a `mkdtemp`, steer `PI_CODING_AGENT_DIR`/`HOME`, restore and remove) and each does them differently: `makeTestLocations` restores the agent dir in a `finally` immediately after calling `locationsFor` (safe only because `locationsFor` resolves eagerly — verified at `locations.ts:145-192`), `makeTestScopes` leaves it set for the whole case, `createHermeticScope` additionally steers `HOME` and installs a network refusal, and `plugin-path.test.ts` inlines the whole thing per case. Separately, `async function withHermeticHome` is **defined 13 times** across `tests/` — grep-verified, one local definition per file, in nine `tests/orchestrators/**` files plus `tests/architecture/cross-op-convergence.test.ts` and `tests/integration/`.
  **Fix:** one harness per concern, beside the tests that use it (`tests/orchestrators/hermetic-scope.ts`), taking `t` and returning `{ cwd, home, locations }` plus an opt-in network refusal. It must not land under a generic `tests/helpers/`. Note `createHermeticScope`'s network-refusal stub is the strongest of the four and is the shape to keep.

### `tests/orchestrators/types.test.ts`

- **[WARNING] Two of the three WR-01 `never` pins are unproven; the third is proven correctly** — `types.ts:218-220`; `tests/orchestrators/types.test.ts:404-406, 417-419`
  `unsupported?: never` **is** proven — line 405 plants `unsupported: ["hooks"]` under `@ts-expect-error`. `stagedAgents?: never` is only exercised at line 417 as `stagedAgents: undefined`, which errors under `exactOptionalPropertyTypes` regardless of the value type; relaxing the declaration to `stagedAgents?: boolean` leaves that `@ts-expect-error` satisfied. `stagedMcpServers?: never` has no negative at all. WR-01's stated purpose — "so a producer cannot populate a second spelling of a fact the outcome already carries" — is therefore unverified in exactly the direction it exists to block. Sibling drift inside one file.
  **Fix:** add two negatives in the shape of line 404: `// @ts-expect-error updated outcomes cannot duplicate declaresAgents through stagedAgents` / `stagedAgents: true`, and the same for `stagedMcpServers: true`.

- **[WARNING] `partialDegrade` atomicity is proven in one direction only, and `ReinstallSkippedOutcome.notes` is not proven required** — `tests/orchestrators/types.test.ts:380-393`, and no negative for `ReinstallSkippedOutcome`
  Line 385 plants `partialDegrade: { kinds: ["hooks"] }` with no `newlyDegraded`; the mirror (`{ newlyDegraded: true }` with no `kinds`) is missing, so the doc's "both fields travel together" claim is half-checked. Similarly, `PluginUpdateSkippedOutcome.reasons` gets a required-field negative at line 366 but `ReinstallSkippedOutcome.notes` gets none.
  **Fix:** two more `@ts-expect-error` blocks in the existing style.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `auth-host.ts` | `hostFromCloneUrl` | `auth-host.test.ts:19, 30, 41, 52` | owned |
| `auth-host.ts` | `NO_PROVIDER_CAUSE` | `auth-host.test.ts:62` | owned (exact string) |
| `auth-host.ts` | `buildAuthForHost` | `auth-host.test.ts:75, 93, 128, 157, 263, 312, 399, 533` | owned |
| `auth-host.ts` | `buildCloneAuth` | `auth-host.test.ts:628, 712, 731` | owned |
| `auth-host.ts` | `DEFAULT_CREDENTIAL_OPS` (value re-export) | — | **NO CASE** — existence compile-guarded by 4 importers, identity unowned |
| `auth-host.ts` | `AuthAttemptResult`/`CredentialOps`/`DeviceFlowHttp` (type re-exports) | used as annotations in `auth-host.test.ts:15, 279` | incidental — no runtime surface, acceptable |
| `discover.ts` | `DiscoveredResources` | `discover.test.ts:94` (key set pinned by `deepStrictEqual`) | owned |
| `discover.ts` | `aggregateDiscoveredResources` | `discover.test.ts:80, 110, 154, 167, 180` | owned (gaps above) |
| `edge-deps.ts` | `MarketplaceStateRecordLike` | `edge-deps.test.ts:332` (`satisfies`) | owned — but not pinned against `edge/completions/data.ts` (BLOCKER above) |
| `edge-deps.ts` | `LocationsResolverLike` | — | **NO CASE** — never named in the test; only its members are called |
| `edge-deps.ts` | `makeLocationsResolver` | `edge-deps.test.ts:222…592` | owned |
| `plugin-path.ts` | `collectBinDirs` | `plugin-path.test.ts:138, 165, 176` | owned |
| `plugin-path.ts` | `SkippedPathScope` | `plugin-path.test.ts:309, 359, 406` (via `deepStrictEqual` on `skipped`) | owned |
| `plugin-path.ts` | `recomputePluginPath` | `plugin-path.test.ts:218, 283, 333, 383, 431, 461, 491` | owned |
| `scope-fanout.ts` | `ScopedMarketplaceRecord` | `scope-fanout.test.ts:122, 169, 234, 319, 361` (key set pinned) | owned |
| `scope-fanout.ts` | `CollectMarketplaceRecordsOptions` | exercised at every call site; `pluginKey` omitted at 98/115, present at 165 | owned |
| `scope-fanout.ts` | `collectMarketplaceRecordsByScope` | 9 cases | owned (explicit-`user` gap above) |
| `types.ts` | all 15 exported types | `types.test.ts:20-578` — every one named in a `satisfies` and at least one `@ts-expect-error` | owned |

`types.test.ts` is the strongest export census in the area: all 15 type exports are individually named, positively pinned with `satisfies`, and negatively pinned with `@ts-expect-error`, and it correctly carries zero runtime cases. `UpdatePhaseBridge` is pinned bidirectionally by `satisfies Record<UpdatePhaseBridge, true>` on an object literal (a dropped union member trips excess-property checking; an added one trips the missing key).

## Branch census

**`discover.ts`**
- `collectForKind` `ENOENT` → covered (`test(…soft-skips missing resource directories)`). `ENOTDIR` → covered (`…below a regular file`). Hard failure → covered (line 180). *Reachable and covered.*
- `failures.length > 0` — covered at 0 and 4, **not at 1–3**. *Reachable and untested* (BLOCKER above).
- `stat.isSymbolicLink() || !stat.isDirectory()` (line 85), `!skillFile.isSymbolicLink() && skillFile.isFile()` (line 92), `!stat.isSymbolicLink() && stat.isFile()` (line 111) — three sub-conditions with **no independent effect**. I verified with a throwaway Node script that both `Dirent` (from `readdir({withFileTypes:true})`) and `Stats` (from `lstat`) report `isSymbolicLink() === true` together with `isFile() === false` and `isDirectory() === false`; the two halves can never disagree. Both arms of each condition *are* executed by the fixtures at lines 126 and 130-134, so this is not a coverage gap — it is **unreachable-by-real-input redundancy**. Not compiler-forced (D-116-01a does not apply; nothing here needs `!` or `as` to compile). Either simplify to `!stat.isDirectory()` / `skillFile.isFile()` / `stat.isFile()`, or add a one-line comment saying the symlink test is defence against a future non-`lstat` reader. Do not add tests for it.
- `readSkillPaths`'s `entry.name.startsWith(".")`, missing `SKILL.md`, `SKILL.md`-as-directory, symlinked `SKILL.md`; `readPromptPaths`'s hidden / non-`.md` / directory / symlink — all covered by the single filter case at line 110.

**`edge-deps.ts`**
- `mp === undefined` → covered (551). `err instanceof ManifestSoftFailError` re-throw → **covered**, and I checked the mutation: removing the guard double-wraps, and `ManifestSoftFailError`'s message is `` `Manifest load failure: ${errorMessage(cause)}` `` (`completion-cache.ts:157`), so the exact-message assertion at line 563-566 fails. Good.
- `manifestEntry?.version !== undefined` → the `manifestEntry` defined / `version` undefined combination is *reachable and untested* (BLOCKER above).
- `installedNames.has(entry.name)` skip → covered (row 518). `parsed.plugins.find(...) === undefined` → covered (row 458).
- `pluginCachePath`'s rejection on an unsafe marketplace name → *reachable but deliberately not owned here* — `pluginCacheFile`'s `assertSafeName`/`assertPathInside` contract belongs to `tests/persistence/locations.test.ts`. Correct delegation; do not duplicate.
- `loadStateForScope` error propagation → *reachable and untested* (BLOCKER above).

**`plugin-path.ts`**
- `isRecordedButDisabled` → covered. Its body is `!record.enabled` over a required `boolean` (`state-io.ts:252`), so the ENBL-05 indirection is behaviourally identical today; no test can distinguish it and none should try.
- `asAbsolutePluginRoot` catch → all three rejection reasons covered with exact diagnostics (176).
- `freshBinDirs.length === 0 && priorLedger === ""` early return → covered both ways (431, 461 vs 491).
- `process.env.PATH ?? ""` → the `??` arm is covered by `test("materializes absent PATH and ledger properties only when a bin must be applied")`.
- Per-scope isolation: user-fails, project-fails, both-fail all covered.
- No untested reachable branch remains in this module.

**`scope-fanout.ts`**
- `opts.scope === undefined` → the `undefined` arm is covered; the explicit arm is covered *only for `"project"`* — *reachable and untested for `"user"`* (BLOCKER above).
- `record === undefined` → covered (276), and that case additionally proves the merged-config load happens *after* the record check, which is an order-of-calls proof worth keeping.
- `merged.marketplaces[...]?.entry.autoupdate ?? false` → both arms covered (108 default, 144 true/false).
- `pluginKey === undefined` and `merged.plugins[key]?.entry.enabled` → all three outcomes covered (108, 144, 209).

**`auth-host.ts`**
- `provider === undefined` → covered (75, 731). `authMemo?.get(host)` hit and miss → covered (312, 157). `authMemo?.set` when memo omitted (`?.` no-op) → covered (157). `deviceFlowHttp !== undefined` spread, both arms → covered (263 vs 533). `kind === "github"` → covered (19 vs 30/41). `new URL()` throw → covered (52).
- No untested reachable branch.

**`types.ts`** — type-only; no runtime branches. The two `?: never` pins noted above are the only unproven declarations.

## Grading of first-pass findings

### `tests/orchestrators/discover.test.ts`
- **CONFIRMED** — *Non-strict assertion names used throughout, unlike every sibling file* — I verified at runtime that under `node:assert/strict`, `assert.deepEqual === assert.deepStrictEqual` and `assert.equal === assert.strictEqual` are the identical function objects, so the reasoning and the WARNING severity are both right. The same file's four `const result` placeholders (new WARNING above) sit two lines from these and were missed.

### `tests/orchestrators/plugin-path.test.ts`
- **UNDERSTATED** — *Environment restoration uses `try/finally` instead of `t.after()`* — real and correctly WARNING as written, but recorded as "purely a consistency/readability change". It is the visible symptom of a production design finding: `recomputePluginPath` reads `process.env` and `homedir()` inline, which is *why* seven cases must mutate and restore process globals. Fixing only the `t.after()` shape leaves the coupling. Raise it to a design finding on `plugin-path.ts` (new WARNING above) and fix the cases as a consequence, not as a standalone style edit.

### `extensions/pi-claude-marketplace/orchestrators/discover.ts`
- **CONFIRMED** — *Unguarded `as` cast on a caught value* (line 65) — WARNING is the right severity, but the stated blast radius is wrong. A non-`Error` throw would not "just read `.code` as `undefined`": `(null as NodeJS.ErrnoException).code` throws a `TypeError` out of the catch block. It is safe only because the two readers can throw nothing but `node:fs/promises` rejections. Use that as the comment, or narrow as the finding suggests.
- **CONFIRMED** — *Missing top-level documentation* — and worth restating as sibling drift: `discover.ts` is the **only** file at `orchestrators/` root with no file-level header. `auth-host.ts`, `edge-deps.ts`, `plugin-path.ts`, `scope-fanout.ts` and `types.ts` all open with one. The fix is to copy the neighbours' shape, not to invent a format.
- **CONFIRMED** — *`collectForKind` has 6 positional parameters, two of them out-parameters* — real, correctly WARNING, and the lowest-value item in the area. Neither ESLint nor `fallow health` flags it. Fix only if the file is opened for the BLOCKER above.

### `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts`
- **CONFIRMED** — *`classifyInstalledPluginRow` takes 5 required positional parameters* — real, WARNING, low value. If the injection seam lands (new WARNING above), this signature changes anyway.
- **CONFIRMED** — *Verbose inline indexed-access type instead of the existing named type* — verified: `PluginInstallRecord` is exported from `persistence/state-io.ts` and imported directly by `tests/orchestrators/plugin-path.test.ts:14`. `ExtensionState["marketplaces"][string]["plugins"][string]` resolves to the same type. Mechanical swap.

### `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`
- **CONFIRMED** — *Two method doc comments use imperative mood* (lines 51, 72) — real, WARNING. Likely a repo-wide drift rather than a local one; if a repo-wide sweep is planned, fold it in rather than fixing two lines here.

### `extensions/pi-claude-marketplace/orchestrators/types.ts`
- **CONFIRMED** — *`ReinstallOutcomeBase` has no doc comment* — real, WARNING. Every other interface in the file carries a rationale block.

## Still clean after attack

These are the mutations the cases genuinely kill. Do not spend fixing-pass time re-verifying them.

- **`tests/orchestrators/auth-host.test.ts`** — the strongest suite in the area. It kills: hardcoding `host: "github.com"` in the returned bundle (the GitLab case at 128 fails); substituting a different `credentialOps` object (`deepStrictEqual` compares the fake's methods by reference — verified); replacing `makeRawNotifyFn(ctx)` with a no-op (the `strong-mock` `ui.notify(exact string, "info")` expectation with `.once()`/`.twice()` plus `verify(ui)` fails); resolving the provider for the wrong host (the GitLab clientId `bb5b56…` at line 498 differs from GitHub's `Ov23li…`); dropping `authMemo?.set` (369 and 303 fail); keying the memo on anything but the host (399); running the flow twice when memoized, or once when not (the paired `.once()`/`.twice()` counts); forwarding no `deviceFlowHttp` from `buildCloneAuth` (628 would reach the real transport); and dropping `authMemo` forwarding from `buildCloneAuth` (683 fails). The three `verify(ctx)` calls on an expectation-free `ExtensionContext` mock are correct "silence proofs" that the module touches nothing else on the context.
- **`tests/orchestrators/edge-deps.test.ts`** — kills: returning `state.marketplaces` unprojected (the extra `name`/`scope`/`source`/`addedFromCwd`/`marketplaceRoot` keys fail the `deepStrictEqual` at 338 — I verified `deepStrictEqual` is key-set sensitive in both directions); dropping either projected field; swapping `manifestPath` for `marketplaceRoot`; removing the `instanceof ManifestSoftFailError` re-throw guard (double-wrapping changes `error.cause.message`); reordering installed rows after not-installed rows (row 518); emitting `version` on an entry that declares none (row 471); and any single status mis-bucketing across the 16-row matrix. The per-case `fetch` refusal plus `fetchCallCount() === 0` is a genuine behavioural NFR-5 proof.
- **`tests/orchestrators/plugin-path.test.ts`** — kills: reversing user/project scope order (both the bin order at 254 and the `skipped` order at 406); dropping the ledger write; dropping `reason` from a `SkippedPathScope`; letting one scope's failure zero the other's contribution (283, 333); materializing an absent `PATH` as `""` (431); joining `"bins"` instead of `"bin"`; and admitting an empty / relative / delimiter-bearing `resolvedSource` (176 asserts all three exact diagnostics *in order*). The `assert.rejects(() => access(userFirst + "/bin"), { code: "ENOENT" })` at 273 is a well-chosen negative: it proves PATH entries are composed from state without an existence check.
- **`tests/orchestrators/scope-fanout.test.ts`** — kills: reordering project-before-user; reading the merged config before the record check (276); defaulting `autoupdate` to anything but `false`; conflating "no `pluginKey` asked" with "`enabled` omitted" (209 asserts both are `undefined` and the key is present); and swallowing either scope's state-load error (383, 410 assert the exact message and which scope threw).
- **`tests/orchestrators/types.test.ts`** — kills: dropping any partition discriminant; leaking a field across partitions in either direction; widening `failureClass`, `DegradeKind`, `ContentReason`, or `UpdatePhaseBridge`; relaxing `landedDisabled` from `true` to `boolean`; relaxing any `readonly`; relaxing `PluginUpdateFn`'s parameter or return type; and re-admitting `stagedAgents` into `InstallPluginOutcome` (536). It also correctly relies on `exactOptionalPropertyTypes` for the present-`undefined` negatives.

## Not covered

- I did not open `tests/domain/device-flow-fake.ts` or `tests/platform/credential-ops-fake.ts` beyond their observable contract as used by `auth-host.test.ts` (`calls`, `storedCredential`, `http`, the `boundary: "memory"` / `network: "disabled"` options). Their internal quality is owned by the `tests/domain/` and `tests/platform/` areas. I did confirm from the call sites that they are seeded through their public options and expose recorded calls as plain data, which is the shape the rules want.
- I did not open `orchestrators/plugin/plugin-state-classifier.ts` / `.test.ts` or the full `git-source-probe.ts` / `.test.ts` beyond `probeUpgradeCandidate` and `probeManifestEntry`'s signatures and catch-folds. My claim that `edge-deps.test.ts`'s 16 bucketizer rows duplicate their ownership rests on both test modules existing and on `edge-deps.test.ts`'s own header naming `plugin-state-classifier.test.ts` as the owner — I did not diff the two status matrices row by row.
- Per the brief I ran no repo command that mutates or type-checks the tree. The one compiler run I did (the weak-type-detection proof for the `LocationsResolverLike` BLOCKER) was on a standalone file in the scratchpad, invoking the repo's `node_modules/.bin/tsc` with explicit flags on that file only. No coverage was measured; every coverage-shaped claim above is from reading plus targeted mutation reasoning.

## Meta-findings impact

### New cross-cutting evidence

1. **A fourth "gate that does not gate", and it is the one whose absence a sibling comment actively denies.** META-FINDINGS' item 3 lists `marketplace/list.ts` and `remove.ts` as missing from the NFR-5 `FORBIDDEN_TARGETS`. Add `orchestrators/edge-deps.ts` and `orchestrators/plugin/git-source-probe.ts`. What makes these worse than the two already recorded: `git-source-probe.ts:13-15` states its whole design rationale as "so `edge-deps.ts` can consume it while the no-orchestrator-network gate (NFR-5) stays green" — a claim about a gate that does not include either file. When the recommended "audit every architectural gate against what it actually scans" workstream runs, it should also grep for *files whose own comments claim gate membership* and diff that against each gate's target array; that is a cheap, mechanical check that would have caught all four instances. Also worth recording for that audit: `tests/architecture/no-orchestrator-network.test.ts:38-40` documents that the gate **skips ENOENT targets** with an informational marker, so a renamed or moved target silently stops being gated — the same failure mode as the `73d9c8b4` hooks-schema move.

2. **Optional-field structural contracts across an architectural boundary are not compile-enforced, and at least one comment says they are.** `edge-deps.ts:52-54` claims a rename in `edge/completions/data.ts` "would be caught by the edge-side TypeScript compile". I disproved it with `tsc`: because both `MarketplaceStateRecordLike` and `MarketplaceStateRecord` declare every member optional, weak-type detection only fires when the two share *no* property, so a single-field rename compiles clean. **Every re-declared structural alias in this repo that exists to dodge an import boundary is exposed to this.** Other areas should grep for the pattern — a comment saying "MUST stay in sync with", "structurally compatible with", or "the consumer asserts the structural shape" over an interface whose members are all optional — and check whether a test pins it. `tests/architecture/compat-01-no-expansion.test.ts` is the in-repo technique to propagate.

3. **The hermetic-temp-scope harness is the largest duplicated test helper in the repo.** `async function withHermeticHome` is defined **13 times**, once locally per file (grep-verified: 9 under `tests/orchestrators/**`, plus `tests/architecture/cross-op-convergence.test.ts` and `tests/integration/transaction-lifecycle-cascade.test.ts`), and this area adds 4 more bespoke variants of the same shape. That is ~17 copies, and they differ in ways that matter (which of `HOME` / `PI_CODING_AGENT_DIR` is steered, whether restoration is `t.after()` or `finally`, whether a network refusal is installed). This dwarfs the `source-scan.ts` duplication META-FINDINGS already records (5 hand-rolled walkers) and belongs in its "Cross-file duplicated helpers" picture. The best existing variant is `createHermeticScope` in `tests/orchestrators/edge-deps.test.ts:81-114` — it is the only one that also installs a fail-fast `fetch` and reports the call count, which doubles as an NFR-5 proof.

### Corrections to META-FINDINGS.md

- **"No BLOCKER findings surfaced anywhere in this area"** (the first-pass summary this file feeds) is wrong: five surviving mutations, all in files the first pass listed as clean. The pattern to draw from that: this area's *findings* were accurate and its *clean verdicts* were not — which is precisely the confidence split META-FINDINGS' Provenance section predicts. Treat that prediction as confirmed rather than hedged.
- **"Direct per-pair coverage was never measured … no reviewer ran `npm run test:coverage:direct`"** is accurate about the sweep, but understates what already exists. The repo ships `scripts/test-coverage-direct.mjs`, `scripts/test-coverage-direct.negative.mjs`, `scripts/test-coverage-direct.report.mjs`, `scripts/check-corresponding-tests.mjs` and its negative control, and `npm run check` already runs `test:corresponding`, `test:corresponding:negative` and `test:coverage:direct:negative`. What `check` does **not** run is `test:coverage:direct` itself — the negative control of the coverage gate is gated, the gate is not. That is a one-line observation the outstanding-tasks section should carry, because it changes the task from "build per-pair coverage measurement" to "put the existing script in the chain and triage the fallout".
- **Item 4, "Add injection seams to the edge handlers", is scoped one module too narrowly.** `orchestrators/edge-deps.ts` has the identical shape — no collaborator parameter, static imports of `loadState` / `loadMarketplaceManifest` / `probeManifestEntry` / `probeUpgradeCandidate`, and a test that consequently asserts a status vocabulary owned by `tests/orchestrators/plugin/plugin-state-classifier.test.ts`. Count it in that cluster (15 → 16) so it is sequenced with them rather than fixed twice.

### Confirmations

- **"`auth-host.ts` has no leaking module-level memo (the memo is a caller-owned parameter)"** — independently confirmed from the source: `authMemo` is a member of `buildAuthForHost`'s argument object (`auth-host.ts:83`) and is only ever read/written through `authMemo?.get(host)` / `authMemo?.set(host, result)` inside the returned closure (96, 108). There is no module-scope binding in the file. `tests/orchestrators/auth-host.test.ts:399` further proves per-host isolation *within* one caller-owned map. Falsified hypothesis stands falsified.
- **"Strict interaction mocking … reference implementation: `tests/orchestrators/**` top level"** — confirmed. Every `strong-mock` in `auth-host.test.ts` is created inside its case with `{ exactParams: true, name: … }`, states exact arguments with a definite count (`.once()` / `.twice()`), and ends with `verify()` after the result assertions. No `anyTimes()`, `It.isAny()`, `verifyAll()`, `resetAll()`, or `setDefaults()` appears anywhere in the six files.
- **"Silence proofs — a `strong-mock` with no expectations"** — confirmed as a second in-repo site beyond `reconcile/notify.test.ts`: `auth-host.test.ts:75, 712, 731` each `verify(ctx)` an expectation-free `ExtensionContext` mock, proving the no-provider and no-flow paths touch the context not at all.
- **"The dominant shape: sibling drift"** — confirmed with four fresh instances inside a single directory: `discover.test.ts` alone uses `const result` (four sites) while all five siblings use role names; `discover.ts` alone lacks a file header while all five siblings have one; `plugin-path.test.ts` alone uses `try/finally` while `edge-deps.test.ts` and `scope-fanout.test.ts` use `t.after()`; and within `types.test.ts`, `unsupported?: never` is proven while its two `stagedAgents`/`stagedMcpServers` siblings are not. In every case the correct form is one file away.
