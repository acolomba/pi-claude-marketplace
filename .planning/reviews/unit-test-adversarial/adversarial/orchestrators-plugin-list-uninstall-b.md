# Orchestrators — plugin uninstall — adversarial re-review

**Scope:** `tests/orchestrators/plugin/uninstall.test.ts` (all 4,401 lines, 57 cases) and its paired production module `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` (773 lines). The list side is agent A's.
**First-pass file:** `unit-test-findings/orchestrators-plugin-list-uninstall.md`
**Clean files attacked:** 2 — the first pass declared no test file clean, but it made two unfalsified clean claims covering this section: that "the bulk of `uninstall.test.ts`'s ~56 cases … are exemplary" (its `### Clean files` note) and that "Both production modules are otherwise clean against the style-review checklist" (its production `### Clean files` list). Both were attacked with the mutation catalogue.
**Existing findings graded:** 7 (6 uninstall-side test findings + 1 uninstall-side production finding)

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 5 |
| New WARNING (missed by first pass) | 10 |
| Existing CONFIRMED | 5 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's picture of this area is directionally right — the retry-proof matrix really is the strongest test asset I found in this slice — but its clean claims do not hold. Five distinct mutations to `uninstall.ts` leave all 57 cases green, one of them (`--local` target selection) on a documented WB-02 contract, and the module ships a user-visible reason-token lie on the lock-contention path that no case reaches.

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`

- **[BLOCKER] A lock-held uninstall renders the untruthful `{unreadable}` token; the sibling verb already has the correct arm** — `line 168` (`narrowCascadeFailure`), reached from `line 676`
  `withLockedStateTransaction` maps `ELOCKED` → `StateLockHeldError` with `retries: 0` (`transaction/with-state-guard.ts:119,162`). That error is thrown from inside `uninstallPlugin`'s `try`, so it lands in the catch at line 673 and is narrowed by `narrowCascadeFailure`. `StateLockHeldError` is not an `AgentsUnstageFailureError` and carries no `.code` (`shared/errors.ts:334-346`), so `isErrnoException` is false and the function falls through to `return "unreadable"` — a reason whose own comment (lines 189-191) claims it means "we could not read/remove on-disk state". The truthful member `"lock held"` already exists in the closed set (`shared/notify.ts:123`) and the sibling verb uses it: `enable-disable.ts:872` reads `return cause instanceof StateLockHeldError ? "lock held" : primaryDisableFailureReason(cause);` under a comment stating "Only a genuine StateLockHeldError may render `{lock held}`". Add the same first arm to `narrowCascadeFailure`, above the `AgentsUnstageFailureError` check, and import `StateLockHeldError` from `../../shared/errors.ts` (the module already imports `errorMessage`/`isErrnoException` from that file).
- **[WARNING] `UninstallPluginOptions.local`'s doc comment states the opposite of what this module does** — `lines 151-157`
  The comment says "The base file is NEVER touched on the --local path." `sweepPluginFromConfigLayers` (lines 373-385) unconditionally sweeps `configJsonPath` first and `configLocalJsonPath` second, regardless of `opts.local`, and its own header (lines 362-371) correctly documents that cross-layer sweep. The module's own test proves the comment false: `uninstall.test.ts:1841-1892` calls with `local: true` and asserts `hello@mp` is deleted from the **base** file. Rewrite the field comment to say what `local` actually selects here — which single layer is CFG-03-validated inside the guard, and which basename appears in the invalid-config cause — and drop the "never touched" sentence, which is install-side semantics.
- **[WARNING] `UninstallPluginNotifications` is exported with no consumer outside its own module, and the identical union is copy-declared six times** — `line 92`
  Its only reference is `UninstallPluginOptions.notifications` at line 150 in the same file; nothing in `extensions/` or `tests/` imports it. The style rule is "every export is used outside its module." The same two-member union `{ readonly mode: "standalone" } | { readonly mode: "orchestrated" }` is declared verbatim in six modules: `plugin/uninstall.ts:93`, `plugin/install.ts:206`, `plugin/enable-disable.ts:118`, `marketplace/add.ts:108`, `marketplace/remove.ts:97`, `marketplace/autoupdate.ts:94`. Either un-export it, or — better — hoist one `NotificationMode` type into `orchestrators/types.ts` and have all six alias it. See the meta section.

### `tests/orchestrators/plugin/uninstall.test.ts`

- **[BLOCKER] Nothing discriminates the `--local` config-target selection** — `line 1871` (`test('cross-layer: standalone uninstall deletes the plugin key from BOTH the base and local files')`)
  This is the file's only `local: true` call, and in it both layers are valid and both declare `hello@mp`. Mutating `uninstall.ts:571-572` to `const targetConfigPath = locations.configJsonPath;` (deleting the ternary outright) leaves every one of the 57 cases green: `loadConfig` still returns `valid`, no CFG-03 abort fires, and `sweepPluginFromConfigLayers` clears both layers either way. The WB-02 contract that `--local` retargets validation is therefore unproven. Add one case mirroring `CFG-03 / T-56-03-04` (line 1982): write a **valid** `claude-plugins.json` and an **invalid** `claude-plugins.local.json`, call with `local: true`, and assert `assert.deepStrictEqual(notifications, [{ message: 'A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (failed) {invalid manifest}\n    cause: Config file "claude-plugins.local.json" failed schema validation.', severity: "error" }])` plus state bytes unchanged. The basename in that string is what pins the branch.
- **[BLOCKER] No case uninstalls anything at user scope** — whole file
  Every `uninstallPlugin` call in the file targets project scope: `scope: "project"` or (line 1704) omitted, and the resolver picks project. `scope: "user"` appears exactly once (line 636) and only as a *seeded record* in SCOPE-01's arrangement, never as the target. There is no `[user]` bracket in any expected message in the file. Consequence: mutating line 567 to `const { locations } = resolution; const scope = "project";` leaves the suite green, even though `scope` threads into four places — the marketplace-header bracket, `commitPluginRemoval`'s `removePluginConfigFromCache(scope, …)` cache key (line 357), `dropMarketplaceCache(…, scope, marketplace)` (line 416), and every `notifyWithContext` row. Add a user-scope twin of `PU-1` (line 262): seed under `locationsFor("user", cwd)`, call with `scope: "user"`, and assert `"● mp [user]\n  ○ hello v0.0.1 (uninstalled)\n\n/reload to pick up changes"` plus the user-scope record removal. One case closes all four threading sites.
- **[BLOCKER] The lock-contention path through the catch has no case, and it is the only route to `emitCascadeFailure`'s no-version arm** — no case exists; nearest sibling is `enable-disable.test.ts:948`
  `grep -n "ELOCKED\|StateLockHeldError\|ConcurrentInstall" tests/orchestrators/plugin/uninstall.test.ts` returns nothing. Both `enable-disable.test.ts` (lines 948, 1604) and `update.test.ts` carry `StateLockHeldError` cases; uninstall does not. Two branches ride on this: the catch at line 673 reached by the guard itself throwing, and the `removedVersion !== undefined` **false** arm at line 224 — every existing cascade-failure case seeds `version: "0.0.1"` and asserts `v0.0.1` in the row, so the version-less failure row is never rendered. `loadConfig` cannot produce this state (it returns `{status:"invalid"}` rather than throwing on a read error — `persistence/config-io.ts:129-143`), so lock contention is the reachable route. Add a case that acquires the scope lock out-of-band (`proper-lockfile.lock(locations.stateJsonPath, { lockfilePath: locations.stateLockFile, realpath: false })`) before calling `uninstallPlugin`, then assert the whole notification array — with the fix above this is `⊘ hello (failed) {lock held}` and no `v` token, which pins both branches and the production fix in one case.
- **[BLOCKER] The orchestrated-mode overload has no owning case; deleting it leaves the suite green** — `uninstall.ts:512-514`, `uninstall.test.ts` has zero compile-time pins
  `grep -n "@ts-expect-error\|satisfies" tests/orchestrators/plugin/uninstall.test.ts` returns nothing. The narrow overload exists solely to make a consumer's `if (result === undefined) continue` guard a compile error, and the production doc (lines 498-510, "WR-01") explicitly names it an *assertion relocated to the producer's signature*. Every orchestrated case in this file (`assert.deepStrictEqual(first, {…})`, `assert.ok(outcome)` + field checks) type-checks identically against the wide overload, so removing lines 512-514 breaks nothing here. Its pair-partner already demonstrates the technique — `list.test.ts:60-63` carries `@ts-expect-error` type pins at module scope. Add the mirror at the top of `uninstall.test.ts`:
  ```ts
  // WR-01: the orchestrated overload must not admit `undefined`.
  void (async (
    opts: Omit<UninstallPluginOptions, "notifications">,
  ): Promise<UninstallPluginOutcome> =>
    uninstallPlugin({ ...opts, notifications: { mode: "orchestrated" } }));
  // @ts-expect-error the wide overload keeps its `undefined` arm
  void (async (opts: UninstallPluginOptions): Promise<UninstallPluginOutcome> =>
    uninstallPlugin(opts));
  ```
  (import `UninstallPluginOptions` — the test file currently imports only `UninstallPluginOutcome`, line 37).
- **[WARNING] `case "EPERM"` in `narrowCascadeFailure` is never exercised** — `uninstall.ts:180`; the data-driven loop is `uninstall.test.ts:1258-1301`
  `grep -c EPERM tests/orchestrators/plugin/uninstall.test.ts` is 0. The loop covers `EIO`→`unreadable` and `ENOENT`→`source missing`; `EACCES` is covered at lines 1440 and 1074. `EPERM` shares its body with the covered `EACCES` arm, so no *behavior* is unverified — only the `case` label, which is why this is a WARNING and not a coverage BLOCKER. Fix by adding `{ code: "EPERM", reason: "permission denied" }` and `{ code: "EACCES", reason: "permission denied" }` to the row array at line 1258, which also consolidates the ad-hoc EACCES coverage into the table.
- **[WARNING] The documented "an invalid sibling layer is NOT a CFG-03 abort" behavior has no case** — `uninstall.ts:288-290`, `deletePluginFromLayer` line 299
  No test ever writes an invalid `claude-plugins.local.json`: `configLocalJsonPath` appears at test lines 1858 and 2430, both written through `saveConfig` and therefore valid. Mutating `deletePluginFromLayer` to throw on `cfg.status === "invalid"` — the exact behavior the comment promises does *not* happen — breaks nothing. Fold this into the `--local` fix above: the same fixture (valid base, invalid local) run **without** `local: true` must complete the uninstall and leave the invalid local file byte-unchanged.
- **[WARNING] 23 cases assert `notifications.length` plus one field instead of comparing the whole array** — representative: `lines 294-299`, `361-366`, `515-526`, `781-785`, `832-841`, `996-1011`, `2260-2267`, `2350-2353`, `2500-2505`, and all six LIFE-04 cases (`2547-2548`, `2569-2570`, `2596-2597`, `2622-2623`, `2662-2663`, `2702-2703`)
  `assert.equal(notifications.length, 1)` followed by separate `notifications[0]?.message` / `notifications[0]?.severity` checks is the "asserting existence, length, or one property at a time when the whole value is the promise" pattern. The six LIFE-04 cases omit `severity` entirely, so a `severity: "info" → "warning"` mutation on `uninstalledRow` (`uninstall.ts:762`) survives all six (PU-1 catches it globally, which is the only reason it is not a BLOCKER). The correct form is used 94 times in this same file — e.g. `lines 1285-1293`, `1370-1378`, `3120-3128`. Replace each site with one `assert.deepStrictEqual(notifications, [{ message: … }])` (add `, severity: "error"` where the row is a failure). For LIFE-04 the whole-value literal is already extracted as `LIFE_04_UNINSTALLED_ROW` (line 2525), so the change is `assert.deepStrictEqual(notifications, [{ message: LIFE_04_UNINSTALLED_ROW }])`.
- **[WARNING] AAA phase comments are present in 20 of 57 cases** — present: `lines 1266-1283`, `2034-2054`, `2945-2989`, and the rest of the retry matrix; absent: `PU-1` (262), `PU-2` (311), `NFR-10` (384), `PU-3+PU-7` (436), `PU-5` (546), `ATTR-04` (592), `SCOPE-01` (625), `PU-6` (678), `PU-8 a/b` (743, 792), `MSG-SD-3` (853), `D-03-INV` (895), `cache-EISDIR` (951), `TR-03` ×2 (1039, 1150), the RECON-03 block (1471, 1506, 1736, 1764), the WB/CFG block (1796, 1841, 1894, 1930, 1982), `WR-03` (2078), the GC block (2240, 2274, 2321, 2360, 2399, 2474), and all six LIFE-04 cases
  This is drift inside one file: the retry matrix and the cascade-failure loop follow the convention and the older blocks do not. Add `// arrange`, `// act`, `// assert` at the three boundaries of each unmarked case, matching the retry matrix's placement (blank line before each).
- **[WARNING] `resetCompletionCache()` mutates process-global state in two cases with no `t.after()` restoration, unlike the third** — `line 907` (`D-03-INV`) and `line 955` (`cache-drop EISDIR`) versus `lines 3728-3731` (`retry proof: a refused cache drop`), which correctly does `resetCompletionCache(); t.after(() => { resetCompletionCache(); });`
  Both offending cases also call `getPluginIndex` (lines 914, 934), populating the module-global memory map keyed `("project","mp")` with a path under a per-case tmpdir that is deleted in `finally`. Nothing clears it afterwards. Give both cases the `async (t) =>` signature and the same `t.after` registration the third case uses. (The reset hook itself is META item 2's problem — see the confirmations section.)
- **[WARNING] The retry matrix patches the `node:fs/promises` builtin instead of injecting an fs seam** — `lines 2740-2741`, `2821-2905` (`observeUninstallSchedule`), and `tests/orchestrators/plugin/scope-tree-inventory.ts:15-19`
  `createRequire(import.meta.url)("node:fs/promises")` grabs the CJS module object, `t.mock.method` replaces `mkdir`/`readdir`/`rm`/`unlink` on it, and `syncBuiltinESMExports()` republishes the mutated bindings to every ESM importer in the process — including production code. That is a loader trick over a global built-in: the unit-testing rules forbid `t.mock.module()`/custom loaders and require injection, and the style rules' quick scan flags global modification outright. It is also fragile in a documented way — `scope-tree-inventory.ts`'s own header explains it must bind `readdir` before any case installs a mock so the inventory walk does not record itself into the schedule. **Do not fix this file-locally**: 13 test files do the same thing (see the meta section). The right sequence is to give `runPostUninstallCleanup` and the cascade an injected fs-operations parameter (the module already has the `cascade` DI seam as precedent, `uninstall.ts:145`) and then retire the patching everywhere at once.
- **[WARNING] `MSG-SD-3`'s distinguishing arrangement is a no-op** — `line 867`
  The case passes `makeCtx({ getAllTools: () => [] })` and comments that this leaves both companion deps unloaded, but `makeCtx`'s default is already `((): unknown[] => [])` (line 91). Every other case in the file therefore runs under the identical soft-dep state, so nothing about this case is distinguishing. Either give it a `getAllTools` that reports the subagent/mcp tools present — which is the arrangement that would actually prove markers cannot appear — or delete the override and the comment.
- **[WARNING] `PU-1`'s comment claims four resources and asserts three** — `line 279` versus `lines 280-282`
  `seedFullPlugin` returns five handles (`skillDir`, `commandFile`, `agentFile`, `hooksFile`, `mcpJson`); PU-1 checks the first three. Hooks and mcp removal are independently proven at lines 2604-2628 and 2630-2668, so this is a comment defect, not a coverage gap. Either extend PU-1 to `seeded.hooksFile` and the mcp key, or reword the comment to "the three artifacts this case owns".
- **[WARNING] `retryOutcomeShape` casts the outcome's error to reach `.code`** — `line 2920` (`(outcome.error as NodeJS.ErrnoException).code`)
  The repo already exports the narrowing predicate this wants: `isErrnoException` from `shared/errors.ts:15`. Replace with `code: isErrnoException(outcome.error) ? outcome.error.code : undefined`, which is what the assertions at lines 2992 and 3258 already expect (`"EACCES"` / `undefined`).

## Export ownership census

`extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`

| Export | Owning case | Status |
| --- | --- | --- |
| `uninstallPlugin` (implementation) | ~57 cases | owned |
| `uninstallPlugin` overload 1 — orchestrated-narrow (`:512-514`) | — | **NO CASE** — deleting it leaves the suite green |
| `uninstallPlugin` overload 2 — wide (`:515-517`) | `uninstall.test.ts:1284`, `:1780` (`assert.equal(outcome, undefined)`) | owned incidentally; never pinned as a type |
| `UninstallPluginOutcome` | `retryOutcomeShape` (`:2913`) + every orchestrated `deepStrictEqual` | owned |
| ↳ `uninstalled` arm | `:1456`, `:2999`, `:3863` | owned |
| ↳ `uninstalled` arm **without** `version` | — | **NO CASE** (every record seeds `version: "0.0.1"`) |
| ↳ `converged` arm | `:1549`, `:3864`, `:4164`, `:4352` | owned |
| ↳ `failed` arm | `:1456`, `:2990`, `:3256`, `:4064` | owned — `keys: Object.keys(outcome).sort()` pins the exact key set |
| `UninstallPluginNotifications` | — | **NO CASE**; also no consumer outside `uninstall.ts` |
| ↳ `{ mode: "standalone" }` arm | — | **NO CASE anywhere in the repo** — no file constructs it; standalone is always expressed by omission |
| `UninstallPluginOptions` | — | **NO CASE** — never imported by the test; no `satisfies` pin |
| ↳ `.ctx` / `.pi` | every case | owned |
| ↳ `.cwd` | every case | owned |
| ↳ `.marketplace` / `.plugin` | every case | owned |
| ↳ `.scope` | present (`:275`) and omitted (`:1704`) | owned — but only ever the literal `"project"` |
| ↳ `.cascade` | `:815`, `:1073`, `:1184`, `:1280`, `:3209` | owned |
| ↳ `.notifications` | `:1452` etc. (orchestrated), omission (standalone) | owned |
| ↳ `.local` | `:1871` only | **incidental** — exercised, never discriminated |

Module-private functions (`narrowCascadeFailure`, `emitCascadeFailure`, `emitConfigInvalid`, `deletePluginFromLayer`, `foldPartialCascadeFailure`, `commitPluginRemoval`, `sweepPluginFromConfigLayers`, `runPostUninstallCleanup`, `emitAlreadyGone`) are all reached through `uninstallPlugin` — correct per the rules; no test-only export exists in this module. The first pass's "no test-only exports" claim holds.

## Branch census

**(a) Reachable and untested — findings, filed above**

| Branch | Line | Route |
| --- | --- | --- |
| `case "EPERM"` in `narrowCascadeFailure` | `:180` | any `EPERM` from the cascade |
| catch reached by the guard itself throwing | `:673` | `StateLockHeldError` from `withLockedStateTransaction` (`retries: 0`) |
| `removedVersion !== undefined` **false** arm in `emitCascadeFailure` | `:224` | same route — the only throw that precedes `removedVersion = installed.version` (`:630`) |
| `opts.local === true` target selection | `:571-572` | exercised but not discriminated |
| `scope === "user"` threading (header bracket, `:357`, `:416`, notify rows) | `:567` | never exercised |
| sibling config layer with `cfg.status === "invalid"` | `:299` | documented at `:288-290`, never seeded |

**(b) Unreachable by real input — keep, do not delete**

- `foldPartialCascadeFailure`'s `localOutcome.cause ?? new Error(\`Cascade unstage failed for plugin "${plugin}".\`)` (`:325`). The module states the D-03 contract makes `cause` non-undefined when `ok === false` (`:323-324`). The case at `uninstall.test.ts:1343` reaches it only by injecting a stub that violates that contract. This is a legitimate type-honesty fallback proved by a planted input — record it so a fixing pass does not read the stub as evidence the real cascade can produce this shape.

**(c) Compiler-forced, both arms covered — not a D-116-01a case**

- `if (configInvalid)` (`:692`) and `if (alreadyGone)` (`:705`), each carrying an `@typescript-eslint/no-unnecessary-condition` disable because TS flow analysis cannot see the closure mutation. Both arms have real cases (CFG-03 at `:1982`/`:2030`/`:3317`; PU-5 at `:546`/`:1506`/`:1930`). The disables' stated reasons hold. No action.

## Grading of first-pass findings

### `tests/orchestrators/plugin/uninstall.test.ts`

- **CONFIRMED** — *Hand-rolled `ctx`/`pi` doubles cast with `as`, instead of `strong-mock`* (BLOCKER). Verified: `uninstall.test.ts` contains no `strong-mock` import at all, while its pair-partner `list.test.ts:35` imports `{ mock, verify, when }`, builds `mock<ExtensionContext>({ exactParams: true })` at `:82-96` with counted expectations (`.once()`, `.twice()`), and calls `verify(ctx); verify(pi); verify(ui);` 286 times. The recommended fix instruction is accurate. One scope correction the first pass could not see from its slice: the identical `} as ExtensionContext` shape appears in six more orchestrator test files (`plugin/{install,update,reinstall,enable-disable,shared}.test.ts`, `marketplace/update.test.ts`), so the fix is one shared factory, not a per-file port — and its root cause is META item 1 (the over-wide `ctx`/`pi` parameter types that make a narrow double impossible to build without a cast).
- **CONFIRMED** — *Prefix/regex-fragment assertions where a whole-value comparison would be stronger* (WARNING). Line references check out: `:520-537` (three partial checks on one message), `:581-585`, `:1131-1143`. The first pass is right that the exact `AgentsUnstageFailureError` text is already asserted verbatim at `:3125`, so the replacement string exists in-file.
- **CONFIRMED** — *Property-by-property outcome checks instead of one `assert.deepStrictEqual`* (WARNING). Verified at `:1490-1495`, `:1543-1551`, `:1752-1757`. Executable as written — for `:1752-1757` the whole-value form compares against `new MarketplaceNotFoundError("absent-mp", ["project"])`, which `deepStrictEqual` handles (Error name, message, and own enumerable fields).
- **CONFIRMED** — *Misleading test title: "the exported fallback error"* (WARNING). The fallback is built inline at `uninstall.ts:325` inside the module-private `foldPartialCascadeFailure`; nothing is exported. The suggested retitle is right.
- **UNDERSTATED** — *Real subprocess + polling + wall-clock timeouts to force a filesystem race* (recorded WARNING; should be **BLOCKER**, and the case should move to `tests/integration/`). The first pass named the `spawn`, the 1 ms `setInterval`, and the 5 s/6 s timeouts. It missed the two facts that settle the severity: the case writes a **16 MB** `state.json` into the hermetic user scope purely to widen the race window (`:1589`, `padding: "x".repeat(16 * 1024 * 1024)`), and that number carries no comment, no assertion, and no proof the window actually opened. This is the only case in the file that can fail for reasons unrelated to `uninstall.ts` — a loaded CI box that reorders the watcher against the atomic rename makes it flake, and a faster `loadState` makes the padding silently insufficient. "Cases run offline, in any order, with no developer setup" plus the no-real-sleeps rule both apply. The behavior it proves (`mp === undefined` inside the guard is a concurrent-removal converge, `uninstall.ts:606-619`) is worth proving — but at the `withLockedStateTransaction` seam, or in the integration tier where a wall-clock race belongs.
- **OVERSTATED** — *No test-file-level NFR-5 gate, matching production's self-declared exemption* (recorded WARNING; should be a note, not a finding). Duplicating an architecture gate inside a unit test file is the pattern the repo's own conventions warn against; `uninstall.ts:28-30` and `tests/architecture/no-orchestrator-network.test.ts`'s header both document the exemption deliberately. If the exemption is wrong, the finding belongs to the architecture-gate audit (META "Gates that do not gate", item 3), not to this pair. The first pass hedged it correctly in prose but still filed it as a finding, which will cost the fixing pass a lookup.

### `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`

- **CONFIRMED** — *`err as Error` cast relies on an invariant from another module, undocumented at the cast site* (WARNING), `:676`. The traced invariant is right: `with-state-guard.ts:168-170`'s `toError` normalizes every thrown value. One strengthening detail the first pass missed, which favours the cheaper of its two proposed fixes: the invariant is not merely asserted, it has an owning case — `test('cascade string rejection is normalized before rendering')` at `:1387` rejects with a bare string and asserts the rendered `cause: string cascade rejection`, proving the normalization end-to-end. So add the one-line comment naming `toError`; rewriting to `list.ts`'s defensive form would add an unreachable branch that no case can cover.

## Still clean after attack

`uninstall.ts` survived thirteen named mutations. Each is caught by a specific assertion — this is where the fixing pass should not spend time.

1. **Skip `removePluginConfigFromCache` in `commitPluginRemoval`** (`:357`) → `WR-03` fails at `:2181`. `rebuildRoutingTables` rebuilds from `parsedConfigCache` (`bridges/hooks/event-router.ts:291,318`), so leaving the cache entry re-materialises the `PreToolUse` bucket.
2. **Skip `rebuildRoutingTables`** (`:358`) → same assertion fails; the explicitly injected bucket at `:2137` survives.
3. **Reorder `runPostUninstallCleanup`** (GC before data-rm, or cache-drop after data-rm) → the shared schedule ledgers fail at `:3008`, `:3787`, `:3868`, `:3967`, `:4262`, `:4357`. This is a genuine cross-collaborator order proof, not a coincidence.
4. **Move `const dataDir = await locations.pluginDataDir(...)` inside the D-19-01 `try`** (`:426`) → `NFR-10` fails at `:413` and the escape retry fails at `:4239-4245` with the full `SymlinkRefusedError` field set (`parent`, `child`, `linkPath`, `linkTarget`, `message`).
5. **Drop `recursive: true` from the data-dir `rm`** (`:429`) → `:4356` (`pathExists(targets.dataDir) === false`) fails; that case pre-creates the dir with a `guard.txt` inside.
6. **Drop the WR-02 no-op guard in `deletePluginFromLayer`** (`:299`, the `plugins?.[key] === undefined` half) → the state-save retry fails at `:3679`, which pins the config file's **mtime** across a second sweep that must find nothing to delete. RECON-05 byte/mtime stability is genuinely proved.
7. **Fold instead of rethrow on the AG-5 carve-out** (`:326-328`) → `:1220-1239` fail; all four `resources.*` axes are asserted unchanged against a stub that reported drops.
8. **Wire `dropped.commands → resources.commands`** instead of `resources.prompts` → `:1111` fails. The asymmetric mapping the module warns about at `:648-652` is covered.
9. **Pass the wrong `scope` to `dropMarketplaceCache`** (`:416`) → `D-03-INV` fails at `:938`; the memory key would survive and the rebuild callback would not re-fire.
10. **Flip `needsReload` on either row** (`:763`, `:228`, `:273`, `:478`) → the `/reload to pick up changes` assertions at `:298`, `:534`, `:1140` fail. Verified this is live: `needsReload` is the RLD-02 OR-reduce input at `shared/notify.ts:3276-3281`, not a decorative field.
11. **Sweep config layers in orchestrated mode** (remove the `if (!orchestrated)` at `:663`) → `WR-09` fails at `:1923` on byte equality.
12. **Save state on the CFG-03 abort** → `:2022-2023` fail on both bytes and mtime.
13. **Add or drop any field on the orchestrated `failed` outcome** → `retryOutcomeShape`'s `keys: Object.keys(outcome).sort()` (`:2921`) fails at `:2993`, `:3259`, `:4067`. This is a deliberate guard against the silent-omission class and it works.

The whole NFR-3 retry matrix (`:2940-4401`, 13 cases) is the strongest asset in this slice: it proves collaborator **order** through one shared log, complete filesystem **residue** through `retryTree`, and **convergence** through a second real call — all three at once, per failure-injection point. The first pass's judgment on it is correct.

## Not covered

- I did not run any test, coverage, or lint command (diagnostic-only instruction). Every branch and mutation verdict above is from reading source plus one throwaway `node -e` check of `node:assert/strict` aliasing.
- `tests/orchestrators/plugin/uninstall.messaging.test.ts` (2.6 KB) exists and pairs with `uninstall.messaging.ts` — I confirmed the pairing but did not review its content; it is outside this section.
- `tests/orchestrators/plugin/scope-tree-inventory.ts` was read in full because `uninstall.test.ts` depends on it, but its other six consumers were not reviewed.
- `orchestrators/plugin/shared.ts` helpers (`resolveCrossScopePluginTarget`, `missIsNotInstalled`, `absentTargetReasons`, `applyPartialCascadeFold`, `emitMarketplaceNotAdded`) were read to trace uninstall's branches. Two of their branches have no case in *this* file — `absentTargetReasons`' `"marketplace in project scope"` arm (`shared.ts:399`) and `missIsNotInstalled`'s `marketplace-absent` + `marketplaceInOtherScope === true` arm (`shared.ts:362-367`) — but both are owned by `tests/orchestrators/plugin/shared.test.ts`, which I did not review. Flagged here only so the shared.ts reviewer can check them.

## Meta-findings impact

### New cross-cutting evidence

**1. The repo's best test technique rests on its most systematic guideline violation.** `uninstall.test.ts`'s retry matrix — the pattern META rightly praises — works by grabbing `node:fs/promises` through `createRequire`, replacing four methods on the CJS module object with `t.mock.method`, and calling `syncBuiltinESMExports()` so production ESM importers pick up the patched bindings. That is a loader trick over a global built-in, forbidden by both skills. **It is not local to my area: 13 files do it** — `tests/orchestrators/plugin/{uninstall,install,reinstall,fetch,info,enable-disable}.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`, `tests/bridges/skills/{stage,unstage}.test.ts`, `tests/bridges/hooks/{stage,event-router}.test.ts`, `tests/bridges/commands/discover.test.ts`, `tests/shared/path-safety.test.ts` — plus the shared helper `tests/orchestrators/plugin/scope-tree-inventory.ts`, whose header documents having to bind `readdir` early to dodge its own mocks. META-FINDINGS does not mention this anywhere. It belongs in "Ranked by leverage": the fix is one injected fs-operations seam per orchestrator/bridge (the `cascade` DI seam at `uninstall.ts:145` is the in-repo template), and it must land *before* the retry-proof pattern is propagated anywhere else, or the propagation multiplies the violation. **Areas to check:** every file in that list, and any other test asserting a filesystem call schedule.

**2. Six modules copy-declare the same notification-mode union.** `{ readonly mode: "standalone" } | { readonly mode: "orchestrated" }` appears verbatim in `plugin/{uninstall,install,enable-disable}.ts` and `marketplace/{add,remove,autoupdate}.ts`, each exported under a different name (`UninstallPluginNotifications`, etc.), and in every case the exported alias has **no consumer outside its own module** — standalone mode is always expressed by omitting the option, so `{ mode: "standalone" }` is constructed nowhere in `extensions/` or `tests/`. One `NotificationMode` in `orchestrators/types.ts` collapses six exports and six duplicate declarations. **Areas to check:** `orchestrators-marketplace-*` and `orchestrators-plugin-install/enable-disable` files, which will each have logged this (or missed it) separately.

**3. Sibling-verb drift on error narrowing is a class, not an instance.** `enable-disable.ts:872` narrows `StateLockHeldError` to the truthful `{lock held}`; `marketplace/autoupdate.ts:177` does the same; `reconcile/apply-outcomes.ts:378,424` does it twice. `uninstall.ts:168` does not, and renders `{unreadable}` instead. Worth a sweep: **every orchestrator that wraps `withLockedStateTransaction` and narrows a caught cause to a `Reason` should be checked for a `StateLockHeldError` arm.** `install.ts`, `update.ts`, `reinstall.ts`, and `marketplace/{add,remove,update}.ts` are the candidates.

### Corrections to META-FINDINGS.md

**"`clone-cache.test.ts` vs. its 4 siblings (loose `assert.equal`, …)"** — under "The dominant shape: sibling drift". The premise is wrong. `tests/orchestrators/plugin/clone-cache.test.ts:1` imports `assert from "node:assert/strict"`, and under that entry point `assert.equal === assert.strictEqual` and `assert.deepEqual === assert.deepStrictEqual` (verified: `node -e 'const a=require("node:assert/strict"); a.equal===a.strictEqual'` → `true`). There is no loose comparison in that file, and the same applies to `uninstall.test.ts`'s 179 `assert.equal` and 24 `assert.deepEqual` sites. **Correction:** drop the loose-equality half of that bullet (the `mkdtemp` cleanup half is untouched by this), and drop "loose `assert.equal`" from the finding vocabulary repo-wide — under `node:assert/strict` it is a style preference about spelling, not a defect. A fixing pass told to hunt loose equality will waste its budget.

**"Ranked by leverage" is missing the builtin-module-patching item.** See cross-cutting evidence 1. On findings-resolved-per-change it sits alongside item 4 (handler injection seams): one production seam per module retires the patching in 13 test files and unblocks the retry-proof pattern's propagation.

### Confirmations

- **META item 2, `shared/completion-cache.ts::resetCompletionCache` is test-only.** Independently verified from a third angle: `grep -rn resetCompletionCache extensions/` returns exactly two hits, both inside `completion-cache.ts` itself (its own doc comment at `:40` and the definition at `:436`). Nine test files call it; `uninstall.test.ts` is one of them, at `:907`, `:955`, `:3728`, `:3730`. Confirmed.
- **META item 1, over-wide `ctx`/`pi` parameters force casts.** Confirmed from the uninstall side: `makeCtx` (`uninstall.test.ts:83-92`) builds `{ ui: { notify } } as ExtensionContext` and `{ getAllTools } as ExtensionAPI` precisely because `UninstallPluginOptions.ctx`/`.pi` are typed against the full SDK surface (`uninstall.ts:131,133`) while the module only ever forwards them to `notifyWithContext`. Narrowing those two fields to the surface actually used deletes both casts here and in six sibling orchestrator test files.
- **"Cross-collaborator order proof via one shared log" belongs in the reference-implementation table — with a stronger entry.** META cites `tests/transaction/phase-ledger.test.ts` and `tests/index.test.ts`. The uninstall retry matrix does more in one case: order (`firstSchedule` / `secondSchedule`), complete filesystem residue (`retryTree`), and retry convergence, at 13 injection points. Add it as the reference for *retry/idempotence* proofs specifically — with cross-cutting evidence 1 attached as its precondition.
- **"Silence proofs" pattern.** Confirmed in a second location: every orchestrated-mode case here asserts `assert.deepStrictEqual(notifications, [])` (`:1462`, `:2061`, `:3000`, `:3266`, `:3865`, `:4074`, `:4165`, `:4353`), proving the IL-2 suppression contract by absence. That is the same idea as `tests/orchestrators/reconcile/notify.test.ts`'s expectation-free `strong-mock`, reached without `strong-mock`.
