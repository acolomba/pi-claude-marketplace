# Orchestrators — plugin install (slice A) — adversarial re-review

**Scope:** `tests/orchestrators/plugin/install.test.ts` lines 1–3300 (39 `test(`
sites, 45 runtime cases: helpers/setup, PI-3..PI-17, DFEN-04/05/08, OUT-04,
D-103-16, D-102-02/03, T-102-01, PI-9/PI-10 substitution, PI-11/12/SKILL-01/CMD-01
degrade, PI-14, PI-15, AS-6/AS-7, CMP-3/4, the PI-2/NFR-5 gate) paired with
`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (read in full).
**First-pass file:** `unit-test-findings/orchestrators-plugin-install.md`
**Clean files attacked:** 2 — the first pass's `### Clean files` lists are empty
by construction ("No other test-support files are owned by this assignment";
"None"), so the real unfalsified negative is the *unflagged 95%* of
`install.test.ts` itself, which the first pass called "one of the
strongest-engineered files in the sweep". That claim, over lines 1–3300, is what
I attacked, plus the unflagged surface of `install.ts`.
**Existing findings graded:** 11 (8 test, 3 production)

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 4 |
| New WARNING (missed by first pass) | 10 |
| Existing CONFIRMED | 10 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's characterisation of this area held up for the *notification*
surface — the whole-message byte assertions are genuinely strong and I could not
break them. It did not hold for hermeticity, for fixture-firing verification, or
for the error-class contract, where four surviving mutations remain.

## New findings — from the clean lists

### `tests/orchestrators/plugin/install.test.ts`

- **[BLOCKER] `withHermeticHome` neutralises `HOME` but not `PI_CODING_AGENT_DIR`, so every user-scope case writes the developer's real agent directory** — `line 306` (helper), biting `line 3079` (`CMP-3 / PI-16`), `line 3124` (`CMP-4 / PI-16`), `line 3171` (`PI-17`)
  `locationsFor("user", cwd)` resolves its `scopeRoot` through
  `getAgentDir()` (`extensions/pi-claude-marketplace/persistence/locations.ts:145`),
  and the SDK implementation returns `process.env.PI_CODING_AGENT_DIR` verbatim
  *before* it ever consults `homedir()`
  (`node_modules/@earendil-works/pi-coding-agent/dist/config.js:411-417`).
  `withHermeticHome` sets only `process.env.HOME`. With `PI_CODING_AGENT_DIR`
  exported — the normal state for anyone who runs Pi from a non-default agent
  dir — `seedPathMarketplaceWithPlugin({ scope: "user" })` calls
  `saveState(locations.extensionRoot, …)` (`line 676`) against the developer's
  **real** `state.json` and overwrites it, and the install then writes real
  `agents/`, `mcp.json` and `claude-plugins.json`. `CMP-4`'s
  `assert.equal(userAfter.marketplaces["mp"], undefined)` (`line 3163`) also
  becomes a read of the developer's real state. This is the skill's
  "hermeticity break … leaked filesystem writes" BLOCKER, and it is silent in
  CI because `npm test` (`package.json:82`) never sets the variable.
  **Sibling that already does it right:** `tests/orchestrators/marketplace/list.test.ts:139-160`
  saves `process.env.PI_CODING_AGENT_DIR`, `delete`s it before acting, and
  restores it in `finally`. Copy that shape into `install.test.ts`'s
  `withHermeticHome` verbatim. 55 test files handle the variable; the seven
  `tests/orchestrators/plugin/*.test.ts` files that hand-roll their own
  `withHermeticHome` (`install`, `reinstall`, `uninstall`, `update`,
  `enable-disable`, `info`, `list`) are the entire set that does not — see
  "Meta-findings impact".

- **[BLOCKER] No case asserts the per-plugin data directory is created, so dropping `{ recursive: true }` from the AS-6 mkdir survives the whole file** — `line 2438` (`PI-9`) and `line 2924` (`AS-6`)
  `collectPostCommitWarnings` creates the plugin data dir at
  `install.ts:1556` (`await mkdir(installCtx.pluginDataDir, { recursive: true })`)
  inside a `try` whose `catch` is dropped entirely in standalone mode (D-19-01).
  Mutating that line to `await mkdir(installCtx.pluginDataDir)` makes the call
  throw `ENOENT` on every fresh scope (the `<dataRoot>/<mp>/` parent does not
  exist), the failure is swallowed, and **no plugin ever gets a data dir** —
  yet every case in the file stays green. `grep -n "dataRoot\|pluginDataDir"`
  over the test file returns only comments, the `${CLAUDE_PLUGIN_DATA}`
  *substitution-string* check at `line 2567`, and AS-6's own chmod fixture; not
  one `stat()` of the directory. The retry-proof at `line 3766` mocks `mkdir`
  for that path and so cannot see the flag either.
  Compounding this, **AS-6's fault is never proven to fire**: its three
  assertions (record persisted, one notification, severity `undefined`, no
  "data dir creation deferred" text) are *all* satisfied by a completely
  successful install, so deleting the `chmod 0o555` at `line 2947` leaves the
  case green and it proves nothing about post-commit ordering.
  Fix both with two lines: in `PI-9` add
  `assert.ok((await stat(path.join(locations.dataRoot, "mp", "hello"))).isDirectory(), "the plugin data dir must be created")`;
  in `AS-6` add
  `await assert.rejects(stat(path.join(locations.dataRoot, "mp", "hello")), "the mkdir fault must actually have fired")`
  before the notification assertions.

- **[BLOCKER] `PI-6` asserts neither the error class its own title names nor that the guard fired before any write** — `line 908`, `test("PI-6: generated skill name collides with another plugin's existing skill -> CrossPluginConflictError")`
  The case's only content checks are
  `assert.match(notifications[0]?.message ?? "", /Cross-plugin name conflict/)`
  (`line 941`) and `/hello-shared-tool/` (`line 942`). Replacing the typed
  throw in `assertNoCrossPluginConflicts` with
  `throw new Error("Cross-plugin name conflict: hello-shared-tool …")` — the
  catalogue's "throw a different error class carrying the same message"
  mutation — leaves it green, even though the title promises
  `CrossPluginConflictError`. `installPlugin`'s return value is discarded, so
  the class is reachable and simply unasserted; the in-file sibling at
  `line 9236` does it right (`assert.ok(first.error instanceof SymlinkRefusedError)`
  plus `assert.strictEqual(first.error.name, …)`), and
  `tests/orchestrators/plugin/shared.test.ts:1435` asserts the class directly.
  Second surviving mutation: PI-6 asserts nothing about state or disk, so
  moving `assertNoCrossPluginConflicts` (`install.ts:867`) to *after* the
  skills phase — leaving a staged `hello-shared-tool` on disk and a rollback
  behind — also passes. **Fix:** capture the outcome, assert
  `outcome.error instanceof CrossPluginConflictError` plus its structured
  fields, assert the whole notification body byte-for-byte as `PI-3`/`PI-5` do
  (`lines 715-721`, `891-897`), and add the `PI-3`-style state check
  (`assert.equal("hello" in mp.plugins, false)`) plus
  `await assert.rejects(stat(path.join(locations.skillsTargetDir, "hello-shared-tool")))`.

- **[BLOCKER] `observeRetryBridgeSchedule` monkeypatches the `node:fs/promises` builtin for the whole process** — `lines 58-59`, `100-176`, `183`
  `const require = createRequire(import.meta.url); const filesystemPromises = require("node:fs/promises")` followed by four
  `t.mock.method(filesystemPromises, …)` calls and `syncBuiltinESMExports()`
  rewrites the ESM namespace of a Node builtin so that *every* module in the
  process — production and test alike — sees the doubles. The unit-testing
  skill names this class explicitly ("`t.mock.module()` or a custom loader is a
  finding — the dependency gets injected instead"), and the Google-style quick
  scan flags "prototype or global modification". The sanctioned fix is the one
  the conventions already state: make the filesystem an explicit collaborator
  of the bridge `prepareStage*`/`commit*`/`unstage*` entry points rather than
  reaching into the module registry. This helper is defined here and consumed
  by eight retry-proof cases in slice C (`lines 8366, 8499, 8608, 8773, 8935,
  9064, 9199, 9326`); restoration is correctly `finally`-scoped at each site,
  so the leak is bounded within a file, but the technique is repo-wide (13
  files) and is an operator/META decision, not a per-file fix. Recorded here
  because the definition lives in this slice and **the first pass did not flag
  it at all**.

- **[WARNING] Ten fragment assertions where whole-message equality is this file's own convention** — `lines 794, 941-946, 2367, 2377, 2624-2628, 2667-2671, 2715-2716, 2760-2761, 2913, 3107-3111, 3200-3203`
  Each of these checks one or two substrings of a rendered notification whose
  complete text is computable from the arranged fixture. Representative
  surviving mutations: at `line 3107` (`CMP-3`) the two `assert.match` calls
  admit any version slot and any whitespace between the row and the
  `/reload` trailer, so emitting `"● mp [project]\n  ● hello vBOGUS (installed)/reload to pick up changes"`
  passes; at `line 2624` (`PI-11`) and `line 2667` (`PI-12`) the marketplace
  header, version slot and reload trailer are all unpinned; at `lines 2715-2716`
  and `2760-2761` (`SKILL-01` / `CMD-01`) two independent `assert.match` calls
  cannot detect a row-grammar scramble such as
  `hello (installed) v1.0.0 {malformed skill}` — the exact defect the
  subject-first row contract exists to stop.
  **The correct form is in the same file, six times over:** `PI-3`
  (`lines 715-721`), `ATTR-01` (`758-761`), `PI-4` (`844-847`), `PI-5`
  (`891-897`), `PI-9` (`2505-2513`), `CMP-4` (`3156-3159`) and `PI-9 corollary`
  (`3281-3284`) all compare the whole body against a hand-written literal. Where
  a path or hash makes that impossible, use the single anchored ordered regex
  the file already uses at `line 1259` and `line 1412`
  (`/^ {2}◍ p1 v1\.0\.0 \(disabled\) \{installs disabled, malformed skill, unsupported component\}$/m`),
  never a set of independent substring checks.

- **[WARNING] `PI-11` and `PI-12` titles name a byte form the renderer no longer emits** — `line 2594`, `line 2639`
  The titles promise `"success message includes 'pi-subagents is not loaded'"`
  and `"'pi-mcp-adapter is not loaded'"`; the bodies assert
  `/\{requires pi-subagents\}/` and `/\{requires pi-mcp\}/`. The quoted strings
  appear nowhere in the message any more. This is an assertion that drifted
  from production behaviour and left the title behind — a reader grepping for
  the old wording finds a green test that does not check it. Retitle to name
  the marker tokens that are actually asserted, and take the whole-message fix
  above at the same time.

- **[WARNING] `PI-9`'s title claims phase ordering that the case does not check** — `line 2438`, `test("PI-9: happy-path install lands skills + commands + agents + mcp + state in order")`
  Nothing in the body observes order; the case asserts four end-state files
  exist and one notification body. The taxonomy comment at `line 250` repeats
  the claim ("PI-9: 5-phase ordering"). Real order proof lives in slice C via
  `observeRetryBridgeSchedule` (e.g. `line 8366`, asserting
  `["prepare:skills", "commit:skills", …]`). Either drop "in order" from the
  title and the taxonomy line, or install the schedule observer here for the
  happy path.

- **[WARNING] `PI-9` uses `length > 0` existence checks and a key-presence check where the staged bytes are the contract** — `lines 2472, 2475, 2478, 2483-2484`
  `assert.ok((await readFile(skillTarget, "utf8")).length > 0)` passes for any
  non-empty content, so committing the *source* file unsubstituted, or the
  wrong plugin's file, is undetected; `assert.ok("server1" in (mcp.mcpServers ?? {}))`
  passes for `{ server1: {} }`, so an mcp commit that drops `command`/`args`
  is undetected. Replace the three `length > 0` checks with
  `(await stat(target)).isFile()` plus a content assertion where content is the
  promise (the skill body is already covered by `PI-10`; the command and agent
  bodies are not), and replace the `in` check with
  `assert.deepStrictEqual(mcp.mcpServers, { server1: { command: "node", args: ["server.js"] } })`.

- **[WARNING] `PI-15 layer (a)` is a weaker duplicate of `PI-5`** — `line 2887` vs `line 858`
  Identical fixture (`seedPathMarketplaceWithPlugin({ …, preInstall: true })`),
  identical call, identical code path — the file's own taxonomy comment says so
  (`lines 256-259`: "the early-sanity check collapses with PI-5 on the same
  surface text"). `PI-5` asserts the whole message; `PI-15` asserts
  `/is already installed/`. The duplicate adds maintenance and no discrimination.
  Delete `PI-15 layer (a)` and note the collapse in `PI-5`'s title, or make it
  earn its place by exercising the *layer (b)* state-phase
  `ConcurrentInstallError` — which is already owned at `line 7385` in slice C.

- **[WARNING] `AS-7`'s fixture is never proven to have fired** — `line 2993`
  Its three assertions are: record persisted, one notification at `warning`
  severity, message lacks `"pre-existing agent file"`. The case's own comment
  (`lines 3058-3061`) concedes the warning severity comes from the soft-dep
  companion ladder, not from the AS-7 fault. Deleting the seeded foreign agent
  file and `agents-index.json` (`lines 3012-3039`) therefore leaves the case
  green. It does discriminate the useful production mutation (ungating the
  foreign-file warning would make `surfaceDiscoveryWarnings`
  (`orchestrators/plugin/shared.ts:1407`) emit a second notification and trip
  `notifications.length === 1`), so this is fixture rot risk rather than a
  live lie — but the fault is only proven to fire by the orchestrated sibling
  at `line 3866`. Add `assert.ok((await stat(foreignAgentPath)).isFile())` plus
  a byte comparison of the untouched foreign file, which is what AS-7's own
  contract ("pre-existing agent file(s) **preserved on disk**") actually promises.

- **[WARNING] `PI-14` matches an alternation across two distinct failure modes and never asserts the error class** — `line 2872`
  `assert.match(msg, /contains symlink|escapes/)` accepts either token, so a
  regression that reclassifies a refused symlink as a path escape (or the
  reverse) passes. The case also discards the outcome, though
  `SymlinkRefusedError` is already imported at `line 42` and the sibling at
  `lines 9236-9237` asserts it correctly. Capture the outcome and assert
  `outcome.error instanceof SymlinkRefusedError` plus its structured fields,
  and narrow the regex to the single expected token.

- **[WARNING] `T-102-01` (enabled arm) checks a length and one field of a nine-field `RoutingEntry`** — `lines 2270-2272`
  `assert.equal(bucket.length, 1); assert.equal(bucket[0]?.pluginId, "hooky")`
  leaves `scope`, `marketplace`, `resolvedSource`, `claudeEvent`, `rawMatcher`,
  `handlerDecl` and `declarationIndex`
  (`extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:55-80`)
  unchecked, so registering the entry under the wrong scope or the wrong
  matcher passes. `assert.ok((await stat(hooksJsonPath)).isFile())` likewise
  never reads the staged bytes. Replace with one `deepStrictEqual` over a
  projection:
  `assert.deepStrictEqual(bucket.map((e) => ({ scope: e.scope, marketplace: e.marketplace, pluginId: e.pluginId, claudeEvent: e.claudeEvent, rawMatcher: e.rawMatcher, resolvedSource: e.resolvedSource })), [{ scope: "project", marketplace: "mp", pluginId: "hooky", claudeEvent: "PreToolUse", rawMatcher: "", resolvedSource: path.join(cwd, "mp-src", "plugins", "hooky") }])`.

- **[WARNING] No `// arrange` / `// act` / `// assert` phase comments anywhere before line 3300, while 33 later cases carry them** — `lines 684–3300` (all 39 `test(` sites)
  The first `// arrange` in the file is at `line 3662`; the file has exactly 33
  of each marker, all in the retry-proof/orchestrated family that starts there.
  This is intra-file sibling drift that maps exactly to the slice boundary, and
  it is a mechanical fix. One rule: give every case in `684–3300` the three
  lowercase markers in order, separated by blank lines, following the shape at
  `lines 7885/7936` — `// act & assert` where a case is a single
  `await assert.rejects(...)` expression.

- **[WARNING] `withHermeticHome` is copy-pasted into 13 test files and has already drifted** — `line 306`
  `grep -rln "function withHermeticHome" tests/` returns 13 files. Three
  variants already exist:
  `install.test.ts:306` (HOME only),
  `reinstall.test.ts:85-102` (HOME **plus** `resetCompletionCache()` on entry and
  exit), and `marketplace/list.test.ts:139-160` (HOME **plus**
  `PI_CODING_AGENT_DIR`, and it yields the temp cwd/home to the callback). The
  drift is load-bearing in both directions: the missing `PI_CODING_AGENT_DIR`
  is the BLOCKER above, and the missing `resetCompletionCache()` matters because
  `dropMarketplaceCache`/`getPluginIndex` key on `(scope, marketplace)` —
  `("project", "mp")` for nearly every case in this file — so the process-lifetime
  cache is shared across cases. `install.test.ts` compensates ad hoc with three
  scattered `resetCompletionCache()` calls (`lines 3663, 3665, 3948`) instead of
  the helper. Consolidate into one helper beside the concern that takes and
  restores both variables and resets the cache, then delete the 13 copies.

## Export ownership census

`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`, all nine
exports. "Slice" names which third of `install.test.ts` owns the case.

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `install.ts` | `installPlugin` | `install.test.ts:684` and 122 more (A/B/C) | owned |
| `install.ts` | `runInstallLedger` | `install.test.ts:7314, 7348, 7425, 7476, 7717, 8137` (C) | owned |
| `install.ts` | `InstallPluginOptions` | every `installPlugin(...)` call site | owned (structurally, via the argument literal) |
| `install.ts` | `InstallCloneCacheSeam` | imported at `install.test.ts:29`, consumed by `seamWith` at `5746` (B) | owned |
| `install.ts` | `InstallLedgerResult` | `install.test.ts:7304` — asserts the `marketplace-absent` discriminant (C) | owned |
| `install.ts` | `InstallLedgerSummary` | `install.test.ts:7331` — "projects a complete empty-plugin summary" (C) | owned |
| `install.ts` | `InstallLedgerOptions` | never imported by the test; only exercised through inline object literals at the six `runInstallLedger` call sites | incidental — a widening of the interface is unchecked |
| `install.ts` | `InstallFailureCapture` | never imported by the test; the `capture` argument is a locally-typed literal (`install.test.ts:7438, 7489`) | incidental — the exported shape itself is unasserted; the only case that *names* the type is `tests/orchestrators/plugin/enable-disable.test.ts:2435`, i.e. in the wrong pairing |
| `install.ts` | `InstallPluginNotifications` | never imported; exercised only as `notifications: { mode: "orchestrated" }` literals (`install.test.ts:785, 3521, …`) | incidental — the `"standalone"` arm of the union is never written explicitly by any case |

Two ownership violations fall out of this table:

- **`InstallFailureCapture`'s only by-name case lives in `enable-disable.test.ts:2435`.** Per the pairing rule that case belongs in `install.test.ts`, or the
  contract needs a case here that constructs the exported type (`const capture: InstallFailureCapture = { rollbackPartials: [], version: undefined }`)
  rather than an inferred literal.
- **`InstallPluginNotifications`'s `"standalone"` arm is never written.** Every
  standalone case relies on the `notifications` field being omitted, so removing
  the `"standalone"` member from the union would not fail a single test. Add one
  case passing `notifications: { mode: "standalone" }` explicitly and asserting
  it is byte-identical to the omitted form.

## Branch census

Branches in `install.ts` reachable from the cases in lines 1–3300, classified.

**Reachable and covered (in this slice):**
- `preflightInstallResolve` `source === undefined` → `marketplace-absent` (`install.ts:685`) — `install.test.ts:734`, `3124`.
- `targetMp === undefined` → `cloneMarketplaceRecordForTargetScope` (`install.ts:694`) — `install.test.ts:3079` (CMP-3), asserted via `projectAfter.marketplaces["mp"]?.scope === "project"`.
- PI-15 early-sanity `already-installed` throw (`install.ts:705-710`) — `install.test.ts:858`, `2887`.
- `entryRaw === undefined` → `not-in-manifest` (`install.ts:717`) — `install.test.ts:684`.
- `opts.partial === true` vs `else` gate (`install.ts:764-768`) — the `else` arm here; the `true` arm at `install.test.ts:5202` (slice B).
- `hooksPhase.do` early return on `hooksConfigPath === undefined` (`install.ts:1079`) — every non-hooks case.
- `disabledInstall.landed` true and false arms (`install.ts:2086-2120`) — `install.test.ts:1113` loop and `2106`.
- `disableResult.ok === false` fold (`install.ts:2103-2119`) — `install.test.ts:2298`.
- `readDeclaredEnabled` three-valued read, all three values (`install.ts:1503-1512`) — the six-row `DFEN_PRECEDENCE_CASES` matrix at `install.test.ts:1490`.
- `declaringPluginMaps` `targetIsLocal` both arms (`install.ts:1494-1496`) — `install.test.ts:1608` (both files declare) and `1573` (local only).
- `composeDisabledRow` severity ternary, both arms (`install.ts:1671`) — `install.test.ts:1213` (info) and `1372` (warning).
- `composeInstalledRow` degrade-vs-companion severity (`install.ts:1706-1709`) — `install.test.ts:2682` (degrade wins) and `2438` (companion ladder).
- `writeAdoptingConfigEntries` vs `writePluginConfigEntry` orchestrated arm (`install.ts:2154-2207`) — standalone arm here; orchestrated arm at `install.test.ts:4293` (slice B).
- `readAndCachePluginHooks` post-save block skipped when landed disabled (`install.ts:2252`) — `install.test.ts:2178` / `2232` pair.

**Reachable and untested — findings:**
- `collectPostCommitWarnings`'s *success* path for `mkdir(pluginDataDir)` (`install.ts:1556`). No case asserts the directory exists. See BLOCKER 2.
- `foldFailedDisableCascade`'s `cascade.dropped.hooks.length > 0` arm (`install.ts:1438-1440`) is **not** reached from this slice — `install.test.ts:2298` seeds no hooks. It *is* covered at `install.test.ts:7872` (slice C, poisoned `CacheEntry`), so this is an ownership note, not an uncovered branch.

**Compiler-forced / defensive, not removable (D-116-01a class):**
- `statePhase`'s `mpInner === undefined` throw (`install.ts:1171-1178`). Unreachable through `installPlugin` — the preflight guarantees the record — and reachable only by mutating the snapshot mid-flight. Covered by a planted `Proxy` at `install.test.ts:7445` (slice C). Correctly kept.
- `locateFreshlyInstalledRecord` returning `undefined` (`install.ts:1416`) and its "internal error — the state phase left no record" message. Same class; planted at `install.test.ts:8086` (slice B).
- `isFailedRunPhasesResult` / `isFailedUnstageOutcome` narrowing predicates (`install.ts:1286`, `1400`). Type-level only; no runtime branch a test can distinguish.

**Unreachable by real input — none found.** Every defensive branch I traced has
a planted case somewhere in the file.

## Grading of first-pass findings

### `tests/orchestrators/plugin/install.test.ts`

- **CONFIRMED** — *No case proves the mcp phase's real `unstageMcpServers` removal on rollback* — the substance holds: no case reads `mcp.json` before and after a rollback that reached the mcp phase, so skipping the `unstageMcpServers` call or passing it the wrong key is undetected. **Correct the stated mechanism, though:** the first pass says mcp's undo "only ever hits the harmless `if (c.mcpPrep === undefined) return;` early return". That is wrong. `mcpPhase.do` calls `prepareStageMcpServers` unconditionally (`install.ts:1118`, no guard on `resolved.mcpServers`), so `c.mcpPrep` is *always* set once the phase runs and `unstageMcpServers` *is* called at `install.ts:1141` — it simply has nothing to remove because the `"empty"` fixture declares no servers. The early return is instead the branch taken by the three `Rollback-*-undo` cases (`lines 3335, 3393, 3449`) where mcp never ran. The fix instruction the first pass gives is still the right one.
- **UNDERSTATED** — *Orchestrated failure-classification tests skip the outcome's cause/error* (`lines 3549`, `3581`). The recorded severity is right for `Orchestrated-PI-5`, but `Orchestrated-PI-4` is materially worse than a weak assertion and the proposed fix would not repair it. Its fixture is `rawSourceOverride: "github:anthropics/some-repo"` (`line 3559`). `parsePluginSource` routes that through `parseShorthandSourceForm` → `parseOwnerRepo` (`domain/source.ts:363-365, 391-403`) and yields `{ kind: "github", owner: "github:anthropics", repo: "some-repo" }` — a **git source, which PR-2/PURL-01 made installable**. `resolveStrict` therefore invokes the injected probe (`domain/resolver.ts:815`), the case passes no `cloneCacheSeam`, and `makeInstallCloneProbe` falls through to the real `materializeOrRefreshPluginMirror` / `resolvePluginPin`, whose `DEFAULT_GIT_OPS` calls `gitOps.resolveRemoteRef` (`clone-cache.ts:507, 529`) against `https://github.com/github:anthropics/some-repo.git`. So: (a) a **unit test makes a live network call** — a hermeticity BLOCKER in its own right; (b) `outcome.status === "failed"` passes because of a 404 or an offline error, not because "the plugin is not installable"; (c) the case's own comment ("Gap: classifyInstallFailure path for 'is not installable' branch") describes a branch it no longer reaches. **Raise to BLOCKER and change the fix:** swap the fixture to the npm form the real `PI-4` uses (`line 817`, `rawSourceOverride: { source: "npm", package: "some-pkg" }`) *and then* add the cause/class assertion. This is the only such fixture in the file (`grep -n "rawSourceOverride:"` → `817`, `3559`, `5604`). It sits at line 3549, inside slice B's range — flagging it here because the first pass already owned it and mis-diagnosed it.
- **CONFIRMED** — *Weak "at least one notification" assertions* (`lines 5539, 5652, 6063, 6110`). Same class as my ten-site fragment finding above; the two should be fixed as one sweep with the same rule.
- **CONFIRMED** — *Stub given a call-count assertion* (`line 7670`, with `8108`, `8334`). WARNING is the right level. The first pass's own internal split is correct: the `8334` `mkdir` count does encode a real "no retry" claim and should survive; the `7670` `validation.mock.callCount()` is pure implementation coupling on top of a `deepStrictEqual` that already discriminates.
- **CONFIRMED** — *Redundant architectural git-surface check* (`lines 3219-3230`). Verified: `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` is the first entry of `FORBIDDEN_TARGETS` in `tests/architecture/no-orchestrator-network.test.ts:76`, and that gate's header (`lines 9-11`) covers a fourth pattern, `refreshGitHubClone`, which the local copy omits. One addition to the first pass's case for deletion: the local copy reads `"extensions/pi-claude-marketplace/orchestrators/plugin/install.ts"` as a **process-cwd-relative** path (`line 3221`) — the only cwd-relative path in a file that otherwise works exclusively in `mkdtemp` absolutes — so it silently depends on the runner being invoked from the repo root. Deleting the test fixes both.
- **CONFIRMED** — *`in`-check plus unnecessary `as` cast* (`lines 3640-3641`, `793`, `3541-3542`, `3924-3925`). WARNING is right. Note that at `line 793` the cast is the lesser problem: the following `assert.match(cause, /not added in the project scope/)` is a fragment where the whole cause is computable (`install.ts:2325` composes `Marketplace "ghost-mp" is not added in the project scope.`), so fix both in one edit.
- **CONFIRMED** — *Four different idioms for "does this path exist"* (`lines 3374-3382, 3430-3438, 3489-3497, 6632-6636, 8419`). WARNING; purely mechanical.
- **CONFIRMED** — *`ctx.ui.notify` recorder is a hand-rolled sink* (`lines 282-299`). The first pass's reasoning is sound — every case asserts the recorded array by whole-value equality on message text, so it functions as a Fake, not as a weakened Mock — and WARNING is the right level. One addition it missed, which raises the *production* stake rather than the test one: `makeCtx` reaches its 1-field object past the compiler with `as ExtensionContext` (`line 294`) and `as ExtensionAPI` (`line 297`), and has to build a full `ToolInfo` including a TypeBox `Type.Object({})` schema (`lines 268-280`) purely to satisfy the SDK type. That is direct, independent evidence for META-FINDINGS item 1 (over-wide context parameters) at a file the first pass did not count in that cluster.

### `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`

- **CONFIRMED** — *Stale doc comment describes a re-export that no longer exists* (`lines 2456-2460`). Verified: the file ends at line 2461 with nothing after the comment, and `grep -n "^export"` lists nine exports, none of which is a "test seam for the catch-site dispatch helpers". Directly violates `.claude/rules/typescript-comments.md`'s ban on narrating code that no longer exists. Delete it.
- **CONFIRMED** — *Three inline `new Date()` calls and one `homedir()` are hidden dependencies* (`lines 1088, 1180, 1389, 1437`). WARNING is right, and the symptom shows in my slice too: `install.test.ts:2409` can only write `assert.notEqual(record.updatedAt, record.installedAt, "updatedAt must have moved")` where an injected clock would let it assert the exact stamp — and that weaker form also passes if `updatedAt` is set to any wrong-but-different value. The proposed fix (a `nowIso: () => string` member on `InstallLedgerOptions`, defaulted at the `installPlugin` composition boundary) is the right one.
- **CONFIRMED** — *`credentialOps` defaults to the live boundary inside the module* (`line 747`). WARNING, and the first pass correctly de-fanged it. Narrowing it further: the default is *inert* for every case in slice A, because `makeInstallCloneProbe`'s `buildCloneAuth` is only reached from the git-source arms and every fixture here is a path source. The residual risk is exactly what the first pass stated — a future non-test caller inheriting the real credential store silently instead of getting a compile error.

**On the split recommendation** (three seams: `declared-enabled.ts`, `install-disable-cascade.ts`, folding the row composers into `install.messaging.ts`): I read all three named regions and the recommendation holds. `declaringPluginMaps` / `entryFor` / `readDeclaredEnabled` (`install.ts:1487-1512`) are a pure function of two `ScopeConfig` values and a key; the six-row `DFEN_PRECEDENCE_CASES` matrix (`install.test.ts:1490-1769`) currently seeds a marketplace on disk, runs a full install, and reads back `state.json` plus two config files to prove one three-valued read. Extracting it would turn six ~145-line disk-backed cases into six literal-object cases and leave one end-to-end wiring proof. That said, the DFEN-05 matrix is one of the strongest constructs in the file (see below) — extract the *unit* without deleting the wiring proof.

## Still clean after attack

These survived deliberate mutation. Do not spend fixing-pass time here.

- **`install.test.ts:684` (`PI-3`)** — catches: changing the reason token to `{marketplace not added}`, dropping the `"A plugin operation has failed."` summary line, changing severity from `error`, dropping the `cause:` trailer, and writing a state record anyway (`line 727`). Whole-message equality plus a state check.
- **`install.test.ts:734` + `3124` (`ATTR-01` / `CMP-4`)** — catches swapping the two not-added byte forms in either direction, because both `"{marketplace not added}"` and `"{marketplace not added to user scope}"` are pinned as full bodies in sibling cases. The `crossScopeFlag` probe at `install.ts:2341` is genuinely discriminated.
- **`install.test.ts:1113` (the `DFEN-04` two-site loop)** — catches: flipping `record.enabled`, emptying the record's `resources` (ENBL-18), leaving the staged skill or command on disk, skipping the `claude-plugins.json` write-through, changing severity from info, adding a soft-dep marker to the disabled row, and leaking an absolute path into the message. Six distinct mutations, all caught. Sharing one body between the two declaration sites is the right construction.
- **`install.test.ts:1490` (the six-row `DFEN_PRECEDENCE_CASES` matrix)** — catches: reading the write target instead of the declaring file, inverting the three-valued `enabled` read, adding or removing *any* key in the user's entry (whole-object `deepEqual` on both physical files), and stamping the base file under a local declaration (`expectSiblingKeyAbsent`). The `{}`-vs-`{enabled:true}` pair at `lines 1540-1566` genuinely separates `entry.enabled !== undefined` from `isDeclaredEnabled(entry)`. This is the strongest construct in my range.
- **`install.test.ts:1794` (`DFEN-08`)** — catches a declared-`true` entry rendering differently from a silent one, via the plugin-name-normalised row comparison at `lines 1884-1888`, *and* has a real control (`alpha`, declared false) proving the declaration was read at all. This is the correct answer to "how do you assert two things are identical without two independently-drifting literals".
- **`install.test.ts:2015` (`D-103-16` reload)** — catches a stamp that lands in the right file but stays invisible to the planner: the merged-view read (`lines 2003-2008` in its sibling) and `assert.deepEqual(planReconcile(merged, after, "project"), emptyReconcilePlan("project"))` (`line 2072`) are the only assertions that could distinguish it, and both are present.
- **`install.test.ts:1286` (`OUT-04` enable hint)** — catches interpolating the plugin, marketplace or version into the frozen trailer, and catches moving the trailer off the line directly below the row. The deliberately-distinctive fixture names (`acme-registry`/`widget`, chosen because `mp` is a substring of the trailer prose) show the author already thought about the false-negative.
- **`install.test.ts:2298` (`D-102-02`)** — catches throwing instead of folding, retaining the skills/prompts inventory the cascade removed, dropping the mcp inventory the cascade never reached, and omitting the `enabled: false` config stamp on the failure path. The NFR-3 record-vs-disk pairing (`lines 2390-2407`) is exactly right.
- **`install.test.ts:2178` (`T-102-01` disabled arm)** — catches registering a routing entry for an install-disabled plugin and catches leaving the staged `hooks.json` on disk; the enabled contrast case at `2232` closes the "the cache was never populated for anything" false negative.
- **`install.test.ts:3236` (`PI-9 corollary`)** — catches dropping the reload trailer, changing the version slot, dropping the marketplace header, and populating any resource array on an empty plugin.
- **`withHermeticHome` / per-case `mkdtemp` cleanup discipline** — every one of the 39 cases in my range wraps its temp cwd in `try/finally` with `rm(cwd, { recursive: true, force: true })`, and `HOME` is restored in a `finally` (stronger than `t.after()` for a single call). No leaked directories, no shared fixtures, no `before()` hooks, no `describe()` nesting, no committed `only`/`skip`/`todo`.
- **`assert.deepEqual` / `assert.equal` usage** is not a finding: `assert` is imported from `node:assert/strict` (`line 1`), under which `deepEqual` *is* `deepStrictEqual` and `equal` *is* `strictEqual`.

## Not covered

- I read lines 1–3300 in full. Outside my range I read only the spans needed to settle whether a sibling case kills a mutation: `3316-3360`, `3512-3615`, `3866-3936`, `6500-6545`, `7304-7500`, `7872-8010`, plus the `runInstallLedger` and `observeRetryBridgeSchedule` call-site lists. Slices B and C own the rest.
- No test, coverage, lint, or build command was run (forbidden by the brief). Every claim above is from reading source, plus one read of the installed SDK's `getAgentDir` implementation.
- `install.messaging.ts` / `install.messaging.test.ts` remain out of scope, as in the first pass.
- The three shared fakes (`tests/platform/git-ops-fake.ts`, `tests/platform/credential-ops-fake.ts`, `tests/domain/device-flow-fake.ts`) are not exercised by any case in lines 1–3300 and were not reviewed.
- I did not verify the `PI_CODING_AGENT_DIR` breakage empirically (that would require running the suite with the variable set, which would write to a real directory). The chain is established by source: `locations.ts:145` → `pi-api.ts:15` → `config.js:411-417`.

## Meta-findings impact

### New cross-cutting evidence

**1. A hermeticity break the sweep missed entirely: seven plugin-orchestrator
test files neutralise `HOME` but not `PI_CODING_AGENT_DIR`.** The SDK's
`getAgentDir()` returns that variable *before* consulting `homedir()`
(`node_modules/@earendil-works/pi-coding-agent/dist/config.js:411-417`), so a
`withHermeticHome` that only overrides `HOME` does not isolate user scope at
all. `grep -rln "PI_CODING_AGENT_DIR" tests/` returns 55 files; cross-referencing
against `grep -rln "function withHermeticHome" tests/` shows the split is clean
and systematic:

| Handles `PI_CODING_AGENT_DIR` | Does not |
| --- | --- |
| `orchestrators/marketplace/{list,info,update,autoupdate}.test.ts`, `orchestrators/plugin/{bootstrap,fetch,shared}.test.ts`, all of `edge/handlers/**`, `tests/index.test.ts` | `orchestrators/plugin/{install,reinstall,uninstall,update,enable-disable,info,list}.test.ts`, `architecture/cross-op-convergence.test.ts` |

Every file in the right column that exercises `scope: "user"` writes the
developer's real agent directory when the variable is set — including
`saveState` overwriting a real `state.json`. **Other areas to check:** the six
sibling plugin-orchestrator files and `tests/architecture/cross-op-convergence.test.ts`.
The reference implementation to propagate is
`tests/orchestrators/marketplace/list.test.ts:139-160`. This belongs in
META-FINDINGS' "Gates that do not gate" neighbourhood as a sixth item, or as its
own hermeticity row; it is not currently represented anywhere in the document.

**2. Monkeypatching Node builtins via `createRequire` + `syncBuiltinESMExports`
is a repo-wide idiom (13 files) that both loaded skills forbid.** Files:
`tests/orchestrators/plugin/{install,fetch,enable-disable,uninstall,info,reinstall}.test.ts`,
`tests/orchestrators/reconcile/apply.test.ts`,
`tests/bridges/{hooks/event-router,hooks/stage,skills/unstage,skills/stage,commands/discover}.test.ts`,
`tests/shared/path-safety.test.ts`, plus
`tests/orchestrators/plugin/scope-tree-inventory.ts`. The unit-testing skill
names it ("`t.mock.module()` or a custom loader is a finding — the dependency
gets injected instead") and the Google-style quick scan lists "prototype or
global modification". The sanctioned fix — inject the filesystem as an explicit
collaborator of the bridge stage/commit/unstage entry points — is a large
production change and belongs on the operator's decision list next to
"Unreachable branches and prototype surgery", which currently names only four
files monkeypatching *prototypes* and misses this larger, structurally identical
cluster.

**3. "The fixture is never proven to have fired" is a distinct defect class from
weak assertions, and the sweep has no name for it.** Three instances in this
slice alone: AS-6 (`2924`, deleting the `chmod` leaves it green), AS-7 (`2993`,
deleting the seeded foreign agent leaves it green), and `Orchestrated-PI-4`
(`3549`, the fixture stopped reaching the branch its comment names when github
sources became installable). These are not weak-assertion findings — the
assertions discriminate the production mutation fine. They are cases whose
*arrangement* has silently stopped creating the precondition. **Every
fault-injection case in the repo should be checked for a positive assertion that
the fault fired.** The candidate population is large: the `chmod`, `Proxy`, and
`t.mock.method`-throws fixtures across the orchestrator and bridge suites.

### Corrections to META-FINDINGS.md

- **"weak assertions inside `install.test.ts` vs. the rest of `install.test.ts`"** (under "The dominant shape: sibling drift") is accurate but understates the scale and mis-locates the boundary. The split is not scattered — it is *positional*: the 39 cases before line 3300 have zero AAA phase comments, use fragment assertions at ten sites, and never assert an error class; the 33 cases after line 3662 have full AAA markers, `assert.deepStrictEqual` on whole outcomes, `instanceof` error assertions (`9236`), and shared-log order proofs. The file is two test suites of different vintages under one filename. Anyone planning the fix should treat "lines 1–3300 of `install.test.ts`" as the unit of work, not "scattered weak assertions".
- **"`orchestrators/plugin/install.test.ts` — scattered 'at least one notification' checks"** (under "Replace fragment assertions", item 3) undercounts. Adding the ten sites in slice A (`794, 941, 2367, 2377, 2624, 2667, 2715, 2760, 2913, 3107, 3200`) to the four the first pass found (`5539, 5652, 6063, 6110`) puts this file at ~14 sites, comparable to `marketplace/update.test.ts`'s ~20 rather than an afterthought.
- **"Direct per-pair coverage was never measured"** (Known gaps) stands, and my branch census supports it from the other direction: reading alone found no *uncovered* defensive branch in `install.ts` — every one has a planted case — so the outstanding coverage question for this pair is line/branch percentage, not missing branches. The two genuine holes I found (the `pluginDataDir` mkdir success path, the mcp-rollback removal) are both cases where a branch *executes* under coverage but nothing asserts its effect, which a coverage run would not surface. Worth stating explicitly in that section: **100% branch coverage would not have caught either of this area's BLOCKERs.**

### Confirmations

- **Item 1 (over-wide context parameters) — confirmed from a new angle.** `install.test.ts:294` and `:297` force a 1-field object and a 1-method object past the compiler with `as ExtensionContext` / `as ExtensionAPI`, and `toolInfo` (`lines 268-280`) has to construct a full SDK `ToolInfo` with a TypeBox schema purely to satisfy the type. Narrowing `installPlugin`'s `ctx` to `Pick<ExtensionContext, "ui">` and `pi` to `Pick<ExtensionAPI, "getAllTools">` would delete both casts and the entire `toolInfo` helper from this file. This file was not counted in the cluster.
- **Item 2 (test-only hooks over module-global state) — confirmed for `routing-state.ts`.** `install.test.ts:2179-2187` and `:2233-2241` import `resetRoutingState` and call it as the first statement of each `T-102-01` case, and `:3663, 3665, 3948` do the same with `resetCompletionCache`. Both are production exports whose only callers are tests, exactly as recorded. New detail: the `resetCompletionCache` calls here are *ad hoc* — `install.test.ts`'s `withHermeticHome` omits the reset that `reinstall.test.ts:85-102`'s copy performs on every case — so the module-global fix would also close a drift the duplicated helper created.
- **Item 3's reference implementation claim — confirmed.** The whole-message form the `*.messaging.test.ts` files use is already present *inside* `install.test.ts` at seven sites (`715, 758, 844, 891, 2505, 3156, 3281`), so for this file the fix is not even cross-file propagation — it is copying a form from six lines away.
- **"Patterns to propagate" — one addition.** `install.test.ts:1794` (`DFEN-08`) is a clean reference implementation of a pattern the table does not list: **proving two rendered outputs coincide without two independently-drifting literals**, by normalising the varying token out (`betaRow.replaceAll("beta", "<plugin>")`) *and* carrying a third arm (`alpha`) as a control that the fixture reached the code path at all. Worth adding beside the "cross-collaborator order proof via one shared log" row; it answers a question that recurs wherever a parity requirement exists.
