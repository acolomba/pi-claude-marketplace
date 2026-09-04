# Orchestrators — plugin reinstall (slice A) — adversarial re-review

**Scope:** `tests/orchestrators/plugin/reinstall.test.ts` lines 1–3649 — the
helper/setup block (1–528), the pre-banner `PRL-*`/`ATTR-03`/`SCOPE-01` chapter
(529–1509), the `GAP-01…GAP-19` "Additional coverage" block behind the banner at
1511, the `WB-01`/`WR-03` block (2300–2522), the `LIFE-01` 5th-cascade-slot pair
(2525–2644), the `BFILL-01` block (2646–2762), the `PURL-07 / D-78-02` git-source
chapter (2764–3409), and the `MIRR-06 / D-79.1-04 / PRL-07` mirror chapter
(3411–3646) — paired against
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` (1613 lines),
read in full. Lines 3649–7628 belong to slice B; I read into that range only to
settle whether a sibling case kills a mutation, and every such check is named.
**First-pass file:** `unit-test-findings/orchestrators-plugin-reinstall.md`
**Clean files attacked:** 2 (the first pass declared "no other correctness
concerns … across the remaining ~7000 lines" for the test file, and listed the
production module as carrying findings but with three explicit
"Confirmed clean" claims; both were attacked)
**Existing findings graded:** 13 findings + 3 "Confirmed clean" claims

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 6 |
| New WARNING (missed by first pass) | 18 |
| Existing CONFIRMED | 7 |
| Existing UNDERSTATED | 5 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |
| "Confirmed clean" claims refuted (counted separately) | 1 of 3 |

## New findings — from the clean lists

### `tests/orchestrators/plugin/reinstall.test.ts`

- **[BLOCKER] The `MIRR-06` "resolvedSha = mirror HEAD" assertion proves nothing
  about the mirror-HEAD read** — `line 3541` (assertion), `lines 3533–3540`
  (the comment that states the claim).
  `updateStateRecord` writes the record's `resolvedSha` from
  `oldRecord.resolvedSha` (`reinstall.ts:1390`), never from the probe result.
  `resolvedSha` exists only on `GitPluginRootResult` (`domain/resolver.ts:285`);
  `MaterializablePlugin` does not carry it, and reinstall reads only
  `pluginRoot`, `hooksConfigPath`, `state`, `notes`, `supported`, `unsupported`,
  `mcpServers` off the resolved plugin (verified by grepping `installable.` over
  the whole module). Mutating `reinstall.ts:1095` to
  `const mirrorSha = recordedSha;` — or deleting the `readMirrorHeadSha` call and
  returning any 40-hex string — leaves **all four** mirror cases green (3494,
  3548, 5337, 5397), because `seedUnpinnedGitRecord` seeds
  `resolvedSha: MIRROR_HEAD_SHA` and the assertion only re-proves the
  carry-forward that the sibling at 3300 already owns.
  Fix: make the case discriminating — seed the record with a `resolvedSha`
  **different** from the sha `writeMirrorTree` stamps into `.git/HEAD`, then
  assert which of the two the post-reinstall record names. That assertion will
  fail today; see the paired production finding below, which is the real defect
  and needs an operator decision before the test is written.

- **[BLOCKER] Nothing asserts the single-target tally suppression, so
  `cardinality` can be hard-coded `"plural"` and the suite stays green** —
  `test('GAP-14: reinstallPlugins batch with only skipped outcomes emits skipped
  cascade', …)` (1931–1984), sole content assertion at `line 1979`.
  `reinstall.ts:543` derives
  `cardinality = opts.target.kind === "plugin" ? "single" : "plural"`, and
  `composeTally` (`shared/notify.ts:3141`) renders the trailing
  `Plugin reinstall: …` line **iff** cardinality is `"plural"` (OUT-04 / D-04).
  GAP-14 is the only `kind: "plugin"` call in the whole file that reaches
  `renderReinstallPartitionAndNotify` with a body worth checking — the other four
  (`1113`, `2125`, `2165`, and the enumeration misses) return `[]` before the
  cascade, and the three in slice B (`4549`, `4775`, `5337`) assert only
  fragments or counts. Mutating line 543 to always return `"plural"` therefore
  survives every case in the pair.
  Fix: replace `assert.match(body, /skipped/)` with a whole-record
  `assert.deepStrictEqual(notifications, [{ message: …, severity: "error" }])` in
  the form already used at `2170–2178`; the expected body is the same string
  `PRL-06` pins at `line 550`, and the **absence** of a trailing
  `\n\nPlugin reinstall: 1 failure` line is what proves the D-04 rule. Deriving
  the exact string the way `line 7563` does is the model.

- **[BLOCKER] `resourcesChanged()` can be replaced by `return true` and the whole
  pair stays green** — production `reinstall.ts:1476–1490`; the only owning
  assertions are `line 589` (`true`), `5643` (`true`), `5797` (`true`),
  `6274` (`true`).
  Every one of the eight OR terms is asserted only in its true direction. The
  `false` case is trivially reachable — a plugin with no skills, prompts, agents
  or MCP servers on both the old record and the new handles — and the file
  already builds exactly that fixture at `line 833` (`resources: {}`) for
  `PRL-12/RH-5`, where the outcome is bound to `noResource` at `line 837` and
  never inspected beyond the reload hint. `reinstall.messaging.test.ts:110` does
  carry `resourcesChanged: false`, but it hand-writes the outcome literal and
  never calls this function, so it kills nothing.
  Fix: add `assert.equal(noResource.resourcesChanged, false);` immediately after
  `line 838` in `PRL-12/RH-5`.

- **[BLOCKER] `GAP-06` asserts one field of a three-claim title** —
  `test('GAP-06: prepareAllHandles catch: MCP collision aborts partial handles
  and wraps error', …)` (1641–1696), sole assertion `assert.equal(outcome.partition,
  "failed")` at `line 1691`.
  Neither "aborts partial handles" nor "wraps error" is checked. Mutations that
  survive: (a) delete the `abortPartialHandles(handles)` call at
  `reinstall.ts:1248` and rethrow `err` bare — the skills/commands/agents staging
  directories leak and the case still passes; (b) replace
  `errorWithManualRecovery(err, …)` with a plain rethrow — `failureClass` and the
  `{rollback partial}` reason vanish and the case still passes; (c) throw any
  other error class carrying any message. The `McpServerCollisionError`
  (`shared/errors-bridges.ts:79`) identity is never asserted either.
  Fix: use the whole-outcome form the same file already uses at `2987–2993` —
  `assert.deepStrictEqual(outcome, { partition: "failed", name: "hello",
  marketplace: "mp", scope: "project", failureClass: "manual-recovery",
  reasons: ["rollback partial"], notes: [ … ] })` — and add a tree assertion via
  `retryTree(locations.scopeRoot)` (already the house tool, `scope-tree-inventory.ts`)
  proving no staging subdirectory survived the abort. Also assert the pre-existing
  foreign `server1` entry in `mcp.json` is byte-unchanged.

- **[BLOCKER] The `LIFE-01` drop case proves a file is unreadable, not that the
  subtree is gone** — `test('LIFE-01 (reinstall): a plugin without hooks removes
  any stale <hooksDir>/<plugin>/ subtree', …)` (2588–2644), assertion at
  `2628–2639`.
  The case reads only `<hooksDir>/hello/hooks.json` inside a `try`/`catch` and
  sets a boolean. Mutating `removeHookConfig` (`bridges/hooks/stage.ts:229`) from
  `rm(dir, { recursive: true, force: true })` to an unlink of `hooks.json` alone
  leaves the stale `<hooksDir>/hello/` directory behind and the case still
  passes, contradicting its own title and the production doc comment
  (`reinstall.ts:1326–1332`, "remove any stale subtree"). No retry-proof
  `retryTree` case in slice B seeds a stale hooks dir, so nothing else covers it.
  Fix: replace the try/catch/boolean with
  `assert.equal(await pathExists(path.join(locations.hooksDir, "hello")), false)`
  — `pathExists` is already imported at `line 39`.

- **[BLOCKER] The cold-cache auth case never exercises the bundle, so dropping
  the injected credential seams survives — and the un-injected default reaches a
  real subprocess** — `test('plugin reinstall authentication: a cold GitHub cache
  threads one provider bundle', …)` (3001–3056), assertions `3046–3051`.
  The case asserts `captured.auth?.host === "github.com"` and that the
  credential/device-flow fakes recorded nothing. Both survive a mutation of
  `reinstall.ts:932` from `opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS` to
  `DEFAULT_CREDENTIAL_OPS`, and of `933` dropping the `deviceFlowHttp` spread:
  `buildCloneAuth` still produces a `github.com`-hosted bundle, the fakes are
  still silent because nothing ever calls `onAuthRequired`, and the fake gitOps
  never invokes it either (`makeMockGitOps`'s `clone` wrapper at `2818–2821`
  strips `auth` before handing the options to the fake). `DEFAULT_CREDENTIAL_OPS`
  re-exports `platform/git-credential.ts`, which spawns a real `git credential`
  subprocess — so the mutation is both undetected and a hermeticity break.
  Fix: adopt the sibling technique the bulk case already uses at `3209–3221` —
  seed `pollResponses` on the device-flow fake, `await captured.auth.onAuthRequired()`
  after the outcome assertions, then assert
  `deviceFlow.calls.requestCode.length === 1` and the recorded `credentialCalls`.
  Keep the silence proof; add the wiring proof beside it.

- **[WARNING] Standalone negative notification assertions pass when nothing is
  emitted at all** — `669`, `1864`, `1924`
  (`assert.equal(errorNotifications(notifications).length, 0)` as the *only*
  notification check) and `2495–2498`, `2574`, `2625`
  (`assert.ok(!summary.includes("(failed)"), …)`). Six sites.
  IL-2 makes "exactly one notification per orchestration arm" a contract, and
  every one of these six survives a mutation that emits no notification at all,
  or emits a `warning`-severity notification, or emits three. The correct form
  already lives in the same file at `546–551`, `1119–1123`, `2130–2136` and
  `2170–2178`.
  Fix rule: at each of the six sites, replace the negative check with
  `assert.equal(notifications.length, 1)` plus an
  `assert.equal(notifications[0]?.message, "<hand-written body>")` (or the
  whole-array `assert.deepStrictEqual` used at 2130).

- **[WARNING] Fragment assertions on the `notes` array where the whole array is
  computable** — `937–948`, `1630`, `1793–1794`, `2064`, `2104`, `2286`. Six sites.
  `notes` is `[...discoveryWarnings, ...bridgeWarnings, ...maintenanceWarnings]
  .map(w => "warning: " + w)` (`reinstall.ts:363–367`); the order is a promise
  and no case in my range pins it. At `937–948` in particular, mutations that
  emit the cache warning twice, reorder the two, insert a spurious third, or drop
  the ` at ${dataDir}` clause from `reinstall.ts:1608` all survive, because the
  `.some(n => n.includes(…))` probes stop before that clause.
  Fix rule: `assert.deepStrictEqual(outcome.notes, [ …two hand-written strings…
  ])`, interpolating `await locations.pluginDataDir("mp", "hello")` for the
  second — the arrange block already has `locations` in scope.

- **[WARNING] Partial regexes on rendered cascade bodies where the whole body is
  computable** — `996–1000`, `1037`, `1254–1259`, `1340–1345`, `1453–1454`,
  `1499–1504`, `1557`, `1890`, `1979`. Nine sites (this is the
  META-FINDINGS item-3 class landing in this file).
  Representative surviving mutations: `996` stops at `● pplug v\d`, so the status
  token and the whole rest of the row can be garbled; none of the nine asserts
  the `Plugin reinstall: N success(es)` tally line or the `/reload to pick up
  changes` trailer that `line 7563` proves belongs there; `1258`/`1259`/`1346`
  are absence checks for strings (`Reinstalled plugin "good".`, `Failed:`) that
  no longer exist anywhere in `extensions/`, so they can never fail.
  Fix rule: one whole-body `assert.equal(body, "<hand-written string>")` per
  case, built the way `line 7563` and `line 7570` already build theirs; delete
  the absence checks for strings the module cannot produce.

- **[WARNING] Real 50 ms sleep used to make an mtime comparison meaningful** —
  `line 2318`, inside `test('WB-01 / A7: reinstall with EQUAL existing entry
  leaves config byte- and mtime-unchanged (RECON-05)', …)`.
  `await new Promise((r) => setTimeout(r, 50))` is a real timer, which the
  guidelines forbid, and it silently weakens the case on any filesystem whose
  mtime granularity exceeds 50 ms (the assertion then cannot detect a write at
  all). The byte comparison at `2333` already carries most of the promise.
  Fix: drop the sleep and prove the write did not happen directly — observe
  `saveConfig` through the same seam style the file uses elsewhere, or `utimes`
  the config file to a known past timestamp during arrange so any write produces
  a deterministic change.

- **[WARNING] Dynamic `await import()` of production modules inside case bodies**
  — `2315`, `2332`, `2357–2358`, `2436–2437`, `2457–2460`, `2532–2533`,
  `2589–2590`. Eight sites; `2457–2460` imports the same
  `bridges/hooks/routing-state.ts` module twice in two consecutive statements to
  get two named exports.
  Every other production dependency in this file is a static top-of-file import
  with an explicit `.ts` extension, matching the repo import-order convention.
  Fix: hoist all seven modules to static imports (`stat` joins the existing
  `node:fs/promises` named import at `line 4`; `saveConfig`/`loadConfig`,
  `resetRoutingState`/`getRoutingBucket` become ordinary top-level imports), and
  collapse the doubled routing-state import into one.

- **[WARNING] `observeReinstallSchedule` patches the built-in `node:fs/promises`
  module object and re-publishes it process-wide** — helper at `337–346`,
  `437–513`, `syncBuiltinESMExports()` at `505` and `511`; the same trick again
  at `7186–7190`.
  `createRequire(import.meta.url)("node:fs/promises")` plus
  `t.mock.method(retryFs, …)` plus `syncBuiltinESMExports()` is functionally
  `t.mock.module()` — it rewrites what every already-loaded ESM importer sees,
  including production modules the case is not testing. The guidelines name
  `t.mock.module()` or a custom loader a finding and name the fix: inject the
  dependency. The restore discipline here is correct (`restoreSchedule?.()` in a
  `finally` at every one of the 13 call sites, verified), so this is not a leak
  today — it is a design finding, and it is the reason the retry chapter can only
  observe `mkdir`/`rename`/`rm` and has to document (`5568–5571`) that the mcp
  and hooks bridges are invisible to it.
  Fix: give the bridges a narrow injected fs port (`{ mkdir, rename, rm }`)
  threaded through `ReinstallPluginDeps`, and let the observer be a plain
  recording implementation of that port. That also removes the
  `retryRepairRm` escape hatch at `346`.

- **[WARNING] Hand-rolled boolean spy where the promise is a silence proof, and
  only half the collaborator is covered** — `GAP-07`, `1706` / `1717–1720` /
  `1725`.
  `let maintenanceCalled = false` is the pattern META-FINDINGS names as replaced
  by a `strong-mock` with no expectations (reference:
  `tests/orchestrators/reconcile/notify.test.ts`), and this directory is one of
  the files META-FINDINGS lists as the strict-mocking reference. Separately, the
  case injects only `dropMarketplaceCache`, so a mutation that calls
  `removeDataDir` on the skipped path (`reinstall.ts:1602–1605`) survives.
  Fix: inject both `__deps.dropMarketplaceCache` and `__deps.removeDataDir` as
  `strong-mock` ports with zero expectations and `verify()` both after the
  outcome assertion.

- **[WARNING] Cross-file duplicated helpers: `makeMockGitOps` and
  `seedMarketplace`** — `makeMockGitOps` at `2789–2845`.
  `makeMockGitOps` is defined **nine** times across the suite
  (`architecture/cross-op-convergence.test.ts:71`,
  `architecture/config-state-consistency.test.ts:62`,
  `orchestrators/marketplace/add.test.ts:125`,
  `orchestrators/marketplace/update.test.ts:61`,
  `orchestrators/plugin/clone-cache.test.ts:64`,
  `orchestrators/plugin/info.test.ts:144`,
  `orchestrators/plugin/install.test.ts:5679`,
  `orchestrators/plugin/update.test.ts:109`, and here). The
  `clone` / `resolveRef` / `resolveRemoteRef` wrapper block and the
  `{ gitOps, state: { cloneCalls, checkoutCalls, resolveRemoteRefCalls } }`
  return shape are byte-identical across install / update / reinstall.
  `seedMarketplace` is defined in ten files.
  Fix: fold the wrapper into `tests/platform/git-ops-fake.ts` itself (the strip
  of `auth` before `structuredClone` belongs in the fake, not in nine copies —
  see the meta-findings section below), and give the plugin-orchestrator
  concern one `tests/orchestrators/plugin/marketplace-seed.ts` beside
  `scope-tree-inventory.ts`, which is already the colocated-support precedent
  in this directory.

- **[WARNING] `260525-cjr C9` is a dated review-ticket handle in a test title** —
  `line 1353`.
  `.claude/rules/typescript-comments.md` permits `D-NN`, `NFR-N`, `PRL-NN`,
  `ATTR-NN`, `WR-NN`, `CR-NN`, `MSG-GR-N` and friends as durable anchors and
  forbids "any other phrasing whose only purpose is to record which planning
  artifact authored the line." `260525-cjr` is a date-stamped session handle, not
  a specification row; the title already carries `MSG-GR-3`, which is the durable
  anchor. Six sites repo-wide — see the meta-findings section.
  Fix: drop the `260525-cjr C9: ` prefix; the rest of the title already states
  the behavior.

- **[WARNING] Three `GAP-*` comments cite line numbers that no longer hold the
  code they name** — `1701` ("the code at line 184-186 returns the skipped
  outcome" — actually `reinstall.ts:339–358`), `2075` ("the catch-block at lines
  175-182 in reinstallPlugin" — actually `335–337`), `2230`
  ("updateStateRecord's check (line 646)" — actually `1374`).
  Line-number references rot on the first edit and all three already have.
  Fix: replace each with the symbol name only (`reinstallPlugin`'s skipped
  early-return, `reinstallPlugin`'s catch, `updateStateRecord`'s
  concurrent-removal guard).

- **[WARNING] Two `GAP-*` rationale comments describe a function that does not
  exist** — `1872–1873` and `1933–1935`.
  `reinstallSummary` appears **nowhere** under `extensions/` (grep-verified);
  neither does `'Plugin reinstall complete.'` nor `'Reinstalled plugin "<name>".'`.
  The comment policy explicitly forbids narrating code that no longer exists,
  and here it does active harm: it points the reader at a non-existent
  singular/plural branch, which is why both cases settled for a regex that checks
  nothing. The real tally vocabulary is `composeTally` (`shared/notify.ts:3135`)
  producing `Plugin reinstall: N success(es)`.
  Fix: delete both comments and re-anchor the cases on OUT-04 / D-04 (see the two
  BLOCKERs above).

- **[WARNING] A temp directory is created inside a case and removed outside the
  `finally`** — `cwd2` created at `848`, removed at `872`, while the `finally` at
  `873–875` only removes `cwd`.
  Any failure of the four assertions at `863–871` leaks `cwd2` under `tmpdir()`.
  Fix: give `cwd2` its own `try`/`finally`, or split `PRL-12/RH-5` into the two
  independent cases it already is (the two halves share nothing but the `ctx`).

- **[WARNING] `NotifyRecord.severity` is typed `string` rather than the
  production severity union** — `lines 57–60`.
  A typo'd expected severity (`"eror"`, `"warn"`) type-checks, and the whole file
  compares against it by hand. Every notification assertion in this file rides
  this type.
  Fix: type the field as the production severity union imported from
  `shared/notify.ts` and drop the `?` in favour of the union's own optionality.

- **[WARNING] `GAP-19` reaches its branch through a `Proxy`, a readonly-stripping
  cast, and a message substring** — `2263–2277` (Proxy + `firstAccess` closure
  flag), `2277` (`(state.marketplaces as Record<string, unknown>)["mp"] = …`),
  `2286` (`note.includes("concurrently removed")`).
  The cast defeats the `ExtensionState` readonly contract, and the substring
  match is forced by a production defect (see the bare-`Error` production finding
  below), not by the test. The `firstAccess` flag also makes the case
  order-dependent on how many times production reads `plugins["hello"]` — a
  refactor adding one read silently inverts the fixture.
  Fix: after the production module throws a typed error, assert it by class and
  structured fields. In the meantime, replace the Proxy with a
  `__deps.stateTransaction.loadState` that returns a plain object whose `plugins`
  map genuinely lacks `hello` on the second call, driven by a call counter rather
  than a property-access counter.

### `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`

- **[WARNING] `readMirrorHeadSha`'s result is read and thrown away on the
  reinstall path — operator decision** — `1093–1109`.
  The mirror arm reads `<mirrorDir>/.git/HEAD` and stamps it onto
  `GitPluginRootResult.resolvedSha`, but `MaterializablePlugin` does not carry
  that field and `updateStateRecord` (`1390`) carries `oldRecord.resolvedSha`
  forward instead. Consequences: (a) the record's `resolvedSource` becomes the
  refreshed bare-mirror root while its `resolvedSha` names whatever commit was
  recorded earlier — an internally inconsistent pair after any mirror refresh;
  (b) `readMirrorHeadSha` throws on an unreadable or ref-less `.git/HEAD`
  (`git-source-probe.ts:57–88`), so a partially-materialized mirror fails an
  otherwise-repairable reinstall for a value nobody uses. Either stamp the mirror
  HEAD into the record (making the D-79.1-04 comment at `reinstall.test.ts:3533`
  true) or drop the read and pass `recordedSha`. This gates the test BLOCKER
  above; do not write that test until the contract is decided.

- **[WARNING] The `__deps` option is the only `__`-prefixed test-seam in the
  repository, and its two sibling verbs expose the same seam publicly** —
  `210–211` and `259–260`.
  `grep -rn "__deps?:" extensions/` returns exactly these two lines.
  `install.ts:293–296` and `update.ts:235` expose `cloneCacheSeam` as a
  first-class public option, and `reinstall.ts` itself already exposes
  `credentialOps`, `deviceFlowHttp` and `authMemo` as first-class options — so
  the module is inconsistent with its siblings *and with itself*. `__deps` also
  violates the naming rule against `_` prefixes, and its own doc comment
  (`"@internal Test-only seams; production callers omit this"`) is the
  definition of a test mode.
  Fix: promote `stateTransaction`, `dropMarketplaceCache`, `removeDataDir` and
  `cloneCacheSeam` to optional top-level fields of `ReinstallPluginOptions` /
  `ReinstallPluginsOptions`, mirroring `install.ts`. Rated WARNING rather than
  BLOCKER because it is a parameter, not a module-global mutator — the suite does
  not lie because of it. It does, however, refute the first pass's
  "Confirmed clean — no test-only production surface".

- **[WARNING] Two discriminable failure modes throw bare `Error`** — `1051–1053`
  (`Plugin "…" not found in cached manifest for marketplace "…"`) and
  `1375–1377` (`Plugin "…" was concurrently removed from marketplace "…"`).
  Both contradict the module's own convention — `reasonsFromTypedError`
  (`854–877`) exists precisely to dispatch on typed error classes, and
  `shared/errors.ts` defines one class per failure mode with readonly structured
  fields. Because there is no class, every test that reaches these paths is
  forced into substring matching: `reinstall.test.ts:633`
  (`/not found in cached manifest/`) and `2286` (`"concurrently removed"`).
  Fix: add `CachedManifestEntryMissingError { marketplace, plugin }` and
  `PluginConcurrentlyRemovedError { marketplace, plugin }` to
  `shared/errors.ts`, add the arms to `reasonsFromTypedError`, and convert both
  test assertions to `instanceof` + field checks.

- **[WARNING] Three fields of `ReinstallReinstalledOutcome` have no production
  consumer** — `resourcesChanged` (`1471`), `stagedAgentNames` and
  `stagedMcpServerNames` (`1467–1468`).
  `reinstall.messaging.ts` consumes `declaresAgents`/`declaresMcp` (`358`, `362`)
  and `version`; `reconcile/backfill.ts` consumes `partition`, `version`,
  `reasons`, `notes`, `degradedKinds` (`359–415`); `import/execute.ts:738` reads
  the *install* outcome's `resourcesChanged`, not reinstall's. Nothing reads the
  three named here. `fallow dead-code` cannot see this because they are object
  properties on a used type.
  Fix: either delete them (and the assertions at `589`, `590`, `591`) or, if they
  are kept for install-parity, say so in a doc comment and prove
  `resourcesChanged`'s `false` arm (see the BLOCKER above).

## Export ownership census

`reinstall.ts` has exactly two runtime exports. The remainder are types; a type
with no external consumer is still legitimately exported here when it is
structurally reachable from a public interface (the repo's
`private-type-leak` rule makes that the lesser evil), so those rows are marked
*structural* rather than *NO CASE*.

| Module | Export | Kind | Owning case | Status |
| --- | --- | --- | --- | --- |
| `reinstall.ts` | `reinstallPlugin` | runtime | `reinstall.test.ts:529`, `558`, and ~90 more | owned |
| `reinstall.ts` | `reinstallPlugins` | runtime | `reinstall.test.ts:955`, `1007`, `1044`, `1108`, … | owned |
| `reinstall.ts` | `ReinstallPluginOptions` | type | implicit at every `reinstallPlugin` call | owned (structural) |
| `reinstall.ts` | `ReinstallPluginsOptions` | type | implicit at every `reinstallPlugins` call | owned (structural) |
| `reinstall.ts` | `ReinstallPluginsTarget` | type | `edge/handlers/plugin/reinstall.ts:22` (production consumer) | owned |
| `reinstall.ts` | `ReinstallCloneCacheSeam` | type | `reinstall.test.ts:2858`, `2872`, `3175` | owned |
| `reinstall.ts` | `ReinstallPluginDeps` | type | `reinstall.test.ts:5501`, `7517` | owned |
| `reinstall.ts` | `RemoveDataDirFn` | type | — | no consumer anywhere (structural only) |
| `reinstall.ts` | `DropMarketplaceCacheFn` | type | — | no consumer anywhere (structural only) |
| `reinstall.ts` | `ReinstallPluginOutcome` (re-export of `../types.ts`) | type | `reinstall.test.ts` uses the inferred return type | owned (structural) |
| `tests/orchestrators/plugin/scope-tree-inventory.ts` | `retryTree` | runtime | `reinstall.test.ts:5605` and the install/uninstall/bootstrap retry proofs | owned, correctly colocated |

No runtime export is unowned. The two `no consumer anywhere` rows are the honest
answer to "is every export used outside its module" — they are not, and the
reason is the `ReinstallPluginDeps` field types. Folding them inline into
`ReinstallPluginDeps` (`(path: string, options: { recursive: true; force: true })
=> Promise<void>`) removes both exports without creating a private-type leak.

## Branch census

Classification per the brief: **(a)** reachable and untested — a finding;
**(b)** unreachable by real input; **(c)** compiler-forced and not removable.

Untested and reachable — **(a)**:

- `commitHooks`'s `!parsed.ok` throw (`reinstall.ts:1349–1351`,
  `hooks.json re-parse failed: …`). Reachable: a `hooks.json` that passes the
  resolver's advertisement check and then fails `parseHooksConfig` on re-read.
  The sibling verbs both cover it (`install.test.ts:7727`, `update.test.ts:1748`);
  reinstall does not. The `LIFE-01` block (2525–2644) is the natural owner.
- `makeReinstallCloneProbe`'s clone-arm `subdirResult.kind !== "materialized"`
  early return (`1122–1126`). Reachable: a **pinned** `git-subdir` source whose
  declared path is absent under the freshly-materialized clone root. The mirror
  arm's equivalent (`1096–1100`) *is* covered, at `reinstall.test.ts:5397`; the
  pinned arm is not. The `PURL-07` block's git-subdir case at `3361` is the
  natural owner — clone the fixture without `packages/gp`.
- `resourcesChanged()`'s `false` result (`1476–1490`). See the BLOCKER above.
- The single-target `cardinality` suppression (`543`). See the BLOCKER above.

Covered, verified by reading outside my range (recorded so the fixing pass does
not chase them):

- `reinstallPlugins`'s non-signal enumeration-failure arm and its synthetic
  `(reinstall)` row (`624–650`) — `reinstall.test.ts:4794` and `4827`. My first
  grep for the literal `(reinstall)` missed these because both spell it as the
  regex `/\(reinstall\).*failed/s`.
- `resolveMarketplaceReinstallScope`'s "any other error propagates unchanged"
  (`810`) — `reinstall.test.ts:4827`.
- `enumerateMarketplaceReinstallTargets`'s defensive `mp === undefined`
  (`707–713`) — `reinstall.test.ts:4855` (the child-process race case).
- `invalidConfigWriteBack` (S5) for both the base and `--local` config targets
  (`420–441`) — `reinstall.test.ts:7074` and `5292–5309`.
- `isRecordedButDisabled` skip and the `skipSeverity` (non-`not installed`) arm
  (`909–921`, `350`) — `reinstall.test.ts:4197`, `4239`.
- All four `reasonsFromTypedError` arms (`855–874`) — `4101`, `5023`, `5028`,
  `5628`, `5932`.
- The mirror arm's `git-subdir` sub-branches (`1096–1106`) —
  `reinstall.test.ts:5337` and `5397`.
- `updateStateRecord`'s `hookEntries` spread (`1406`) — `reinstall.test.ts:7231`.
- `resourcesFromHandles`'s `hooks: [plugin]` arm (`1432`) — indirectly but
  decisively by `WR-03` (`2456`), whose post-reinstall routing-bucket assertion
  fails if the slug is dropped, because `rebuildRoutingTables` gates its state
  walk on `resources.hooks.length > 0` (`bridges/hooks/event-router.ts:499`).

Unreachable by real input — **(b)**: none found. Compiler-forced — **(c)**: the
`default`-less `switch` statements at `1542–1553` and `1568–1579` are exhaustive
under `noImplicitReturns` (see the grading of that finding below); they are a
style gap, not a silent-omission risk.

Not asserted anywhere, low severity, recorded once rather than as six findings:
the `Object.freeze` on the six returned collections (`569`, `820`, `1311`,
`1522`, `1539`, `1565`, `1612`) — removing every one of them survives the whole
pair, since no case mutates a returned array to prove the guarantee.

## Grading of first-pass findings

### `tests/orchestrators/plugin/reinstall.test.ts`

- **UNDERSTATED** — *`GAP-15` asserts a claim its own module already disproves*.
  The diagnosis is right and the severity is right, but the recorded version
  understates the scope: this is not a one-off. `GAP-12` and `GAP-14` are anchored
  the same way, on `reinstallSummary`, which does not exist under `extensions/`
  at all (grep-verified). All three belong to one class — *the `GAP-*` block
  documents contracts the module does not have* — and the fix rule is one rule:
  re-derive each case's contract from the current module before touching its
  assertion. `GAP-15`'s own recommended fix ("`assert.equal(notifications.length, 1)`
  and no trace of `cache-drop-warn`") is exactly right and is a strict subset of
  what `PRL-12` at `767` already proves, so deleting it is the better half of the
  recommendation.

- **UNDERSTATED** — *Weak regex lets a broken summary tally pass (`GAP-14`)*.
  Real and correctly rated BLOCKER, but the recorded diagnosis picks the wrong
  missing assertion. The tally is not "very likely `Plugin reinstall: 1 failure`" —
  it is *structurally absent*, because `GAP-14` is a `kind: "plugin"` target and
  `reinstall.ts:543` maps that to `cardinality: "single"`, which
  `composeTally` (`shared/notify.ts:3141`) suppresses. That absence is the D-04
  contract, it is proved nowhere in the pair, and it is the finding — see the
  corresponding new BLOCKER above. Tightening the regex "on the tally line" as
  recommended would assert a line that must not be there.

- **CONFIRMED** — *Weak regex lets a broken singular/plural branch pass
  (`GAP-12`)*. `/hello.*reinstalled/` at `1890` is satisfied by the row alone.
  One correction to the recommendation: `GAP-12` uses `target: { kind: "all" }`
  (`1885`), so it *is* the plural arm, and the tally it should pin is
  `Plugin reinstall: 1 success`, not `Reinstalled plugin "hello".`. Note that
  `line 7563` already pins the singular category word (`1 failure, 1 success`),
  so once `GAP-12` is fixed to a whole-body assertion it adds little; deleting it
  is defensible.

- **OVERSTATED (in part)** — *Three duplicate test pairs add no discriminating
  power*. Two of the three pairs hold; the third names the wrong survivor.
  - Pair 1 (`643` vs `1834`): **confirmed**, `GAP-11` is a strict subset.
  - Pair 2 (`1086` vs `2143`): the duplication is real, but the recommendation to
    delete the case at `2143` is backwards. `2143` asserts
    `assert.deepEqual(notifications, [{ message, severity }])` — the whole array,
    proving exactly one emission — while `1086` asserts only `.at(-1)`. `2143` is
    the stronger case; delete `1086` (or fold `1086`'s stronger *title* onto
    `2143`).
  - Pair 3 (`1130` vs `2185`): **confirmed**, identical in assertion strength;
    either may go.
  Also worth recording: the first pass did **not** claim `1171` and `2113` are
  duplicates, and they are not — they render the same message through different
  resolver arms (`resolveScopeFromState` vs `resolveCrossScopePluginTarget`).
  Keep both.

- **UNDERSTATED** — *A fourth, lower-confidence near-duplicate (`GAP-04` /
  `GAP-17`)*. Settled: they are the same branch. `replaceAll` pushes a
  `ReplacementEntry` for all four bridges unconditionally on success
  (`reinstall.ts:1269–1305`), so `replacements` is length-4 in both cases and
  both reach `errorWithManualRecovery(err, [])` through a clean
  `rollbackReplacements`. `GAP-04`'s rationale comment (`1599–1602`,
  "rollbackReplacements([]) returns []") is factually wrong about the module.
  Widen the finding: **five** cases in my range drive a `saveState` rejection —
  `679`, `728`, `1598`, `2024`, `2072` — and only `2024` (`GAP-16`, chmod-forced
  leak) reaches a distinct branch. Keep `679` (rollback + data preservation),
  `728` (foreign-bytes restore) and `2024`; fold `1598` and `2072` into one.

- **UNDERSTATED** — *Real-race test is unusually heavy and timing-sensitive*
  (`4855–5017`, slice B). Confirmed as described, but the recommendation is too
  weak. A case that `spawn`s a real child process with a 5–6 s wall-clock bound
  is an integration test, and this repo already has the home for it:
  `tests/integration/load-reconcile-race.test.ts` and
  `tests/integration/concurrent-install.test.ts` do exactly this and sit outside
  the `npm test` glob. `tests/orchestrators/plugin/uninstall.test.ts` carries a
  second `node:child_process` harness. Recommend moving both to
  `tests/integration/` rather than extracting a shared unit-suite helper — that
  removes the flake surface from the unit gate instead of centralising it.
  (Line range belongs to slice B; graded here only.)

- **CONFIRMED** — *File-wide: split along the production module's own leaf-module
  seams*. Sound, and consistent with META-FINDINGS item 2 (module splits), which
  already lists `orchestrators/plugin/reinstall.ts`. This is an operator decision
  and should be sequenced before the assertion work, or the assertion work gets
  redone.

- **CONFIRMED** — *`GAP-01…GAP-19` numbering is not a durable spec anchor*.
  Correct as recorded, and my pass adds two harder instances of the same class in
  the same block: the stale line-number citations (`1701`, `2075`, `2230`) and
  the `reinstallSummary` comments (`1872`, `1933`), both of which are outright
  policy violations rather than borderline ones. It also missed
  `260525-cjr C9` at `1353`, which is a clearer violation than `GAP-N` — a dated
  session handle, not an ad-hoc but internally consistent numbering.

### `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`

- **CONFIRMED (WARNING is the right severity)** — *Two `switch` statements omit
  the required `default` group* (`1542–1553`, `1568–1579`). The style rule does
  apply. But it should **not** be filed under META-FINDINGS item 5's
  "silent-omission class": `tsconfig.json` sets `noImplicitReturns: true`
  (line 11), `ReplacementEntry` is a closed union declared in the same file
  (`277–281`), and both functions have non-`void` return types — so adding a
  fifth `BridgePhase` member produces a TS7030 compile error at both sites today,
  with or without `assertNever`. Add the arms for consistency; do not budget them
  as risk reduction.

- **CONFIRMED** — *Unexplained cast from a partial to a fully-populated type*
  (`1251`, `return handles as PreparedHandles`). The invariant is real (the
  `catch` at `1247` re-throws on any partial failure) and invisible at the
  assertion site. One-line comment is the right fix.

- **CONFIRMED, with a wider blast radius** — *Hidden dependency: `homedir()` read
  inline inside business logic* (`1347`). Real, and systemic: the identical
  `const ifCtx = { homedir: homedir(), cwd, projectRoot: cwd }` line appears at
  `install.ts:1088`, `update.ts:2048`, `info.ts:397`, and
  `bridges/hooks/event-router.ts:177` and `:573`. Six sites. Fixing
  `reinstall.ts` alone would make the verbs disagree about how the hooks `if:`
  predicate resolves `~`. Treat as one ticket across all six.

- **UNDERSTATED** — *Hidden dependency: `new Date()` read inline inside business
  logic* (`1409`). The recorded version says "no test currently pins the literal
  timestamp, so this has not yet forced a test-side workaround." The stronger
  fact is that `updatedAt` is not merely un-pinned, it is **unverified in either
  direction**: `grep -n updatedAt tests/orchestrators/plugin/reinstall.test.ts`
  returns only two hits (`3142`, `3486`), both fixture seeds. Mutating `1409` to
  `updatedAt: oldRecord.updatedAt` — i.e. never stamping the reinstall at all —
  survives the entire pair, and D-68-02's whole point is that `installedAt`
  is preserved *while* `updatedAt` moves. Raise to a finding with a test
  obligation attached: inject `now: () => string`, then assert in the
  `PRL-08/11` happy case (`558`) that `record.installedAt === beforeRecord.installedAt`
  **and** `record.updatedAt === "<injected literal>"`.

- **CONFIRMED** — *The two primary exports lack their own doc comments*
  (`321`, `516`). Correct; note that `handleSinglePluginFailure`'s own comment
  (`446–457`) starts with the lowercase, non-third-person "handle the
  single-plugin reinstall failure path", which is the same rule
  ("Method descriptions begin with a third-person verb phrase") and is the only
  other instance in the file.

### The first pass's three "Confirmed clean" claims

- **CONFIRMED** — *NFR-5: no import of `platform/git.ts` / `gitOps` /
  `DEFAULT_GIT_OPS`*. Verified against the import block (`49–167`): the only git
  surface is `materializePluginClone` / `canonicalCloneUrl` /
  `resolveGitSubdirRoot` from `./clone-cache.ts` and `readMirrorHeadSha` from
  `./git-source-probe.ts`, all named entrypoints. The tests back it with real
  behavioral proof rather than a grep — `3258–3259`, `3354`, `3529–3530` assert
  `resolveRemoteRefCalls.length === 0` and `cloneCalls.length === 0` on warm
  caches against a fake whose `clone` and `resolveRemoteRef` both throw.

- **CONFIRMED** — *Force semantics: "reinstall always wins" is structural*.
  `replacePreparedAgents(handles.agents, { force: true })` (`1278`) is
  unconditional and `requirePartialInstallable` (`1187`) is the gate; the
  `BFILL-01` trio (`2667`, `2692`, `2728`) proves the observable half, including
  that the recorded compatibility stays truthful at the same version.

- **REFUTED** — *No test-only production surface*. `__deps` is exactly that: an
  `@internal Test-only` option with a `__` prefix, the only such surface in the
  repository (`grep -rn "__deps?:" extensions/` returns two lines, both in this
  file), while `install.ts:296` and `update.ts:235` expose the identically shaped
  `cloneCacheSeam` as a public option and this same module exposes
  `credentialOps` / `deviceFlowHttp` / `authMemo` publicly. The claim that it
  "matches the project's own documented dependency-injection-over-test-only-seams
  convention" is the reverse of what the two siblings do. See the production
  WARNING above.

## Still clean after attack

Mutations I ran that the cases genuinely catch — do not spend fixing-pass time
here:

- **`tests/orchestrators/plugin/reinstall.test.ts:2951` (clone-cache non-`Error`
  rejection)** — a full `assert.deepStrictEqual` on the outcome object including
  `notes`. Catches: changing any field to a wrong same-typed value, dropping
  `notes`, swallowing the rejection, adding a spurious field, and emitting a
  notification (`assert.deepEqual(notifications, [])`). This is the model form
  for the rest of the file.
- **The `PURL-07` warm/cold pair (`3228`, `3309`)** — catches an added network
  touch in either direction: `cloneCalls.length` and `resolveRemoteRefCalls.length`
  are asserted on both a warm cache (both zero) and a cold one (clone exactly
  once, ref-resolution still zero), and `checkoutCalls[0]?.ref` pins the recorded
  sha, so swapping the recorded pin for a re-resolved ref fails.
- **`createGitOpsFake`'s `allowedRemoteUrls` (`2807`, `REINSTALL_REMOTE_URLS` at
  `2780`)** — the fail-loudly git fake META-FINDINGS asks other files to adopt
  is already adopted here. Mutating a clone URL in production makes the fake
  throw rather than silently succeed.
- **`WR-03` (`2456`)** — catches a dropped `resources.hooks` slug, a missing
  `removePluginConfigFromCache`/`readAndCachePluginHooks` pair, a skipped
  `rebuildRoutingTables`, and a `resolvedSource` that fails to mirror
  `state.json` (`2513–2517`).
- **`LIFE-01` rewrite (`2531`)** — `assert.deepEqual(JSON.parse(written), hooksJson)`
  on a deliberately corrupted pre-state; catches a skipped hooks write, a
  passive no-op, and any content mutation.
- **`readSkill` / `readCommand` (`314–322`)** — the hardcoded target paths
  (`hello-tool/SKILL.md`, `hello:deploy.md`) mean a mutated generated-name
  derivation fails with ENOENT even though the content checks are only
  fragment matches. The staged-byte contract itself is correctly owned by
  `tests/bridges/skills/stage.test.ts`, so the fragment matches here are the
  right altitude — no finding.
- **`PRL-13` deterministic sort (`1269`) and the same-name cross-scope case
  (`1353`)** — the `deepEqual` on the projected outcome tuples pins order,
  scope, marketplace and name together; reordering `sortReinstallTargets`'
  primary/secondary keys or inverting the project-before-user tie-break fails
  both.
- **`ATTR-03` / `SCOPE-01` exact-body cases (`1119–1123`, `1160–1163`,
  `1200–1203`, `2130–2136`, `2170–2178`, `2215–2218`)** — whole-string
  comparisons including the header, the glyph, the bracket, the status token and
  the brace reason. Reordering the row grammar, dropping the `[project]` bracket,
  or changing one reason word fails all six.
- **`BFILL-01` partial (`2692`)** — `deepEqual` on `compatibility.unsupported`
  and `.supported` plus `installable: false` plus the same version; catches the
  hardcoded-`installable: true` regression D-68-02 exists to prevent.
- **`GAP-01` (`1515`)** — `notifications.length === 1` plus the exact
  `"(no marketplaces)"` string; catches a dropped sentinel and an extra
  emission. (It does not pin severity; `2130` shows the whole-record form that
  would.)

## Not covered

- **Lines 3649–7628** (slice B) were not reviewed for new findings. I read
  selected passages there — `4197–4300`, `4530–4575`, `4760–4860`, `5290–5420`,
  `5540–5660`, `7150–7200`, `7550–7580` — solely to settle whether a sibling case
  kills a mutation found in my range, and every such determination is cited above
  with its line number.
- **`tests/orchestrators/plugin/reinstall.messaging.test.ts`** was read only for
  the `resourcesChanged` and tally questions; it was out of scope for the first
  pass and remains unreviewed.
- **Direct per-pair coverage was not measured.** Per the brief no command was
  run, so every coverage and reachability claim above comes from reading the
  source and the call graph, not from `npm run test:coverage:direct`.
- **`readMirrorHeadSha`'s symbolic-ref and packed-refs arms**
  (`git-source-probe.ts:66–88`) are unreachable from any reinstall fixture —
  `writeMirrorTree` (`3427`) always writes a detached HEAD. Those arms belong to
  `tests/orchestrators/plugin/git-source-probe.test.ts`; I did not check whether
  that file covers them.
- **Whether the mirror can actually move under a warm unpinned record** (the
  premise that makes the `readMirrorHeadSha` production finding a data-integrity
  bug rather than merely dead work) requires tracing
  `materializeOrRefreshPluginMirror`'s callers in `update.ts` and
  `marketplace/update.ts`, which I did not do. The finding is stated as an
  operator decision for that reason.

## Meta-findings impact

### New cross-cutting evidence

1. **`assert.equal` / `assert.deepEqual` are strict everywhere in this suite —
   any "loose equality" finding is a false positive.** All 261 test files import
   `node:assert/strict`; **zero** import plain `node:assert`
   (`grep -rl 'from "node:assert/strict"' tests/ | wc -l` → 261;
   `grep -rl 'from "node:assert"' tests/ | wc -l` → 0). Under `assert/strict`,
   `equal` *is* `strictEqual` and `deepEqual` *is* `deepStrictEqual`. Every area
   file that filed a finding of the shape "uses loose `assert.equal`" needs
   re-checking. See the correction below for the specific META-FINDINGS row.

2. **The `structuredClone`-on-`auth` workaround is replicated in nine files, and
   eight of them lose the bundle instead of reattaching it.** META-FINDINGS
   records it as "already biting" in `tests/orchestrators/marketplace/add.test.ts`.
   `grep -rn "auth: _auth" tests/` returns **14 sites across 8 files** —
   `architecture/config-state-consistency.test.ts:74`,
   `edge/handlers/plugin/bootstrap.test.ts:247`,
   `orchestrators/plugin/bootstrap.test.ts:69`,
   `orchestrators/plugin/fetch.test.ts:159,174,202`,
   `orchestrators/plugin/install.test.ts:5714`,
   `orchestrators/plugin/reinstall.test.ts:2819,2833`,
   `orchestrators/plugin/update.test.ts:165`,
   `orchestrators/reconcile/apply.test.ts:122,136` — plus `add.test.ts:141–149`,
   which is the **only** one that reattaches the stripped bundle onto the
   recorded call (`Object.assign(git.state.calls.clone.at(-1) ?? {}, { auth })`)
   and is therefore the only file that can assert what auth reached the clone
   boundary (`add.test.ts:1236–1247`). The other eight discard it, which is the
   direct root cause of the auth BLOCKER in this area: the reinstall auth cases
   cannot observe the bundle at the fake and fall back to a host-name check that
   any implementation satisfies. Fixing `tests/platform/git-ops-fake.ts` to
   handle a function-bearing `auth` deletes 14 strip sites and restores the
   observation in eight files. **Raise this item's priority — it is not a
   one-file annoyance, it is a suite-wide blind spot over credential wiring.**

3. **`makeMockGitOps` is defined nine times repo-wide with a shared body.**
   `architecture/cross-op-convergence.test.ts:71`,
   `architecture/config-state-consistency.test.ts:62`,
   `orchestrators/marketplace/add.test.ts:125`,
   `orchestrators/marketplace/update.test.ts:61`,
   `orchestrators/plugin/clone-cache.test.ts:64`,
   `orchestrators/plugin/info.test.ts:144`,
   `orchestrators/plugin/install.test.ts:5679`,
   `orchestrators/plugin/update.test.ts:109`,
   `orchestrators/plugin/reinstall.test.ts:2789`. `seedMarketplace` is defined in
   ten files. Add both to the cross-file-duplicated-helper workstream; the
   `makeMockGitOps` wrapper belongs in `git-ops-fake.ts` and dissolves with
   item 2.

4. **A dated review-session handle is used as a test-title anchor in three
   areas.** `260525-cjr` appears in six titles:
   `tests/architecture/scope-order-drift.test.ts:95` and `:132` (B3),
   `tests/orchestrators/marketplace/update.test.ts:2042`, `:2093`, `:2131` (B2),
   `tests/orchestrators/plugin/reinstall.test.ts:1353` (C9). It is not a durable
   ID family under `.claude/rules/typescript-comments.md`; every one of the six
   titles already carries a real anchor beside it. One mechanical sweep. Check
   the architecture and marketplace-update area files — neither appears to have
   flagged it.

5. **The `homedir()`-inside-business-logic pattern is a six-site cluster, not a
   reinstall quirk.** `orchestrators/plugin/{install.ts:1088, update.ts:2048,
   reinstall.ts:1347, info.ts:397}` and `bridges/hooks/event-router.ts:{177,573}`
   all build `{ homedir: homedir(), cwd, projectRoot: cwd }` inline. Fixing one
   verb makes the verbs disagree about how the hooks `if:` predicate resolves
   `~`. Belongs in the same ticket as the sweep's other hidden-dependency work
   (META-FINDINGS "Ranked by leverage" has no row for this; it should).

6. **A new defect shape worth naming: *an assertion that reads a field the module
   copies from the fixture*.** `reinstall.test.ts:3541` asserts
   `record.resolvedSha === MIRROR_HEAD_SHA` and reads as a proof that
   `readMirrorHeadSha` worked; the module writes that field from
   `oldRecord.resolvedSha`, which the fixture seeded to the same constant. The
   assertion is green for any implementation. This is distinct from a weak
   assertion — the assertion is strict and specific, it is just wired to the
   wrong source. Any area whose fixtures seed a value the module also carries
   forward (state records, config entries, install records) should be checked for
   it. `install.test.ts` and `update.test.ts` carry the same
   `resolvedSha`-carry-forward contract and are the first places to look.

### Corrections to META-FINDINGS.md

- **"The dominant shape: sibling drift" bullet:
  `clone-cache.test.ts` vs. its 4 siblings (loose `assert.equal`, …)".**
  The "loose `assert.equal`" half is wrong. `tests/orchestrators/plugin/clone-cache.test.ts:1`
  imports `node:assert/strict`, under which `assert.equal` is `strictEqual`. The
  file has no loose equality. I did **not** check the `~15 mkdtemp directories
  never cleaned up` half of that bullet, which may still hold. Correct the row
  to name only the cleanup issue, and re-check any other area file that filed a
  "loose equality" finding (see cross-cutting item 1 — zero files in the suite
  import non-strict `assert`).

- **"Ranked by leverage" §5, "Restore exhaustiveness on closed-union switches",
  framed as "the silent-omission class: adding a member to a closed set compiles
  clean at every derivation site".** That framing does not hold for the two
  `switch` statements in `orchestrators/plugin/reinstall.ts` (`1542–1553`,
  `1568–1579`), which the first pass added to the cluster. `tsconfig.json:11`
  sets `noImplicitReturns: true`; both functions return a non-`void` type over a
  closed union declared in the same file, so a new member is a TS7030 compile
  error today. They are a style gap. Whether the four modules originally listed
  (`reconcile/plan.ts`, `reconcile/apply.ts`, `install.messaging.ts`,
  `reinstall.messaging.ts`) genuinely fail open depends on each one's return
  type — the cluster should be re-triaged per site rather than treated
  uniformly, and the count should be stated as six sites with mixed risk.

- **`_AUDIT.md` / master tally.** This pass adds 6 BLOCKER + 18 WARNING to
  `orchestrators-plugin-reinstall` from one half of one file, and refutes one of
  that file's three "Confirmed clean" production claims. The refreshed audit
  should not treat first-pass per-area totals as ceilings.

### Confirmations

- **"Clean verdicts are not reliable" (Provenance).** Confirmed hard. Every one
  of the six new BLOCKERs sits inside the ~7000 lines the first pass summarised
  as "no other correctness concerns", and three of them (`resourcesChanged`,
  `cardinality`, the mirror-HEAD assertion) are cases where a wrong production
  implementation passes the entire suite.

- **Item 3, "Replace fragment assertions on rendered messages."** Independently
  confirmed in this file: nine `assert.match`/`.includes` sites on cascade bodies
  (`996–1000`, `1037`, `1254–1259`, `1340–1345`, `1453–1454`, `1499–1504`,
  `1557`, `1890`, `1979`) where the whole body is computable, and the correct
  form is demonstrably reachable — `line 7563` in the same file already writes
  the whole string. Also confirmed that three of those "absence" checks
  (`1258`, `1259`, `1346`) assert the absence of strings that no longer exist
  anywhere under `extensions/`, so they can never fail.

- **Item 2, "Replace test-only hooks over module-global state"
  (`shared/completion-cache.ts::resetCompletionCache`).** Confirmed from a second
  angle: `reinstall.test.ts:89` and `:91` call it twice per case inside
  `withHermeticHome`, in ~100 cases. Converting the cache to factory-owned state
  changes this file's helper, so sequence it before the reinstall test work.

- **"Offline fake that fails loudly on unplanned input" (patterns to
  propagate).** Confirmed already adopted here — `createGitOpsFake({ boundary:
  "memory", allowedRemoteUrls: REINSTALL_REMOTE_URLS })` at `2805–2807`. This
  file can be cited as a second reference implementation alongside
  `fetch.test.ts`.

- **Item 4 / the calibration note on injection seams.** Confirmed from the
  production side: `orchestrators/plugin/reinstall.ts` is the repo's only
  `__`-prefixed test-seam, and its two sibling verbs already expose the same seam
  publicly. The "the correct form already exists in-repo — the fixing pass is
  propagation, not invention" conclusion holds here exactly.
