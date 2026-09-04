# Orchestrators — plugin shared helpers, clone cache, probes, classifiers

**Scope:** `extensions/pi-claude-marketplace/orchestrators/plugin/{shared,clone-cache,git-source-probe,bootstrap,clone-gc,update-row,plugin-state-classifier,discover-names}.ts` and their paired tests under `tests/orchestrators/plugin/`.
**Test files reviewed:** 9 (8 `*.test.ts` + `scope-tree-inventory.ts` test support)
**Production modules reviewed:** 8

## Summary

This is the strongest area I have seen in this sweep. Every production module in the assignment has exactly one paired test module, every test uses `describe()`/`test()` from `node:test` correctly, AAA comments are present and in order almost everywhere, doubles are role-named, and error assertions overwhelmingly check `instanceof` plus structured fields rather than message substrings. `git-ops-fake.ts` is used correctly as the sanctioned git seam fake — no test in this area imports `DEFAULT_GIT_OPS` or touches the real network, and the warm sha-pinned cache-hit path has a dedicated test proving zero git calls (`clone-cache.test.ts:191`). The one genuine BLOCKER is systemic rather than scattered: `clone-cache.test.ts` never registers cleanup for any of its ~15 `mkdtemp` call sites, leaking a temp directory (sometimes containing a full git repo) into the OS tmp dir on every test run — every sibling file in this assignment (`clone-gc.test.ts`, `bootstrap.test.ts`, `git-source-probe.test.ts`, `shared.test.ts`) gets this right. The remaining findings are consistency and rigor nits: `clone-cache.test.ts` diverges from its four siblings by using loose `assert.equal`/`assert.deepEqual` throughout instead of the strict variants, wrapping every `test()` call in a now-pointless `void`, and skipping the `describe()`-per-export grouping its own sibling (`git-source-probe.test.ts`) demonstrates. A fixing pass should prioritize, in order: (1) the leaked temp directories in `clone-cache.test.ts`, (2) the strict-vs-loose assertion inconsistency in the same file, (3) the handful of naming/double-role nits below.

## Unit test findings

### `tests/orchestrators/plugin/clone-cache.test.ts`

- **[BLOCKER] Every temporary directory leaks; no cleanup is ever registered** — `lines 184-189` (`freshLocations`), `lines 1141-1172` (`buildMarketplaceCheckout`), `lines 1512, 1531, 1551` (inline `mkdtemp` calls in the `resolveGitPluginRootWithSubdir` tests).
  None of the ~15 `mkdtemp` call sites in this file is paired with `rm(..., { recursive: true, force: true })` or a `t.after(...)` registration — grep confirms zero `t.after` calls in the whole file. Every one of the ~76 tests therefore leaks a directory (several containing a full git repo written via `buildMarketplaceCheckout`) into `os.tmpdir()` permanently. This is the exact "leaked filesystem writes" hermeticity break the review rules call out as a BLOCKER, and every sibling file in this same directory (`clone-gc.test.ts`'s `freshLocations`, `git-source-probe.test.ts`'s `freshDirectory`/`freshLocations`, `bootstrap.test.ts`'s `createHermeticUserScope`) gets this right by taking a `TestContext` and calling `t.after(() => rm(dir, { recursive: true, force: true }))`.
  Fix: give `freshLocations()` a `TestContext` parameter (as `clone-gc.test.ts` and `git-source-probe.test.ts` already do) and register `t.after(() => rm(cwd, { recursive: true, force: true }))` inside it; do the same for `buildMarketplaceCheckout` (register cleanup on the `marketplaceRoot` it returns) and for the three standalone `mkdtemp` calls at lines 1512/1531/1551. Every one of the ~76 `test(...)` callbacks will need a `t`/`TestContext` parameter threaded through to call the updated helpers.

- **[WARNING] Every `test()` call is wrapped in a pointless `void`** — `line 191` and 54 further occurrences (grep `^void test(`).
  `@typescript-eslint/no-floating-promises` is turned `off` for all of `tests/**/*.ts` (`eslint.config.js:311`), so the `void` prefix is not required here and is not used by any other file in this assignment (`discover-names.test.ts`, `bootstrap.test.ts`, `clone-gc.test.ts`, `git-source-probe.test.ts`, `shared.test.ts`, `update-row.test.ts`, `plugin-state-classifier.test.ts` all call bare `test(...)`). Remove the `void ` prefix from all 55 call sites so this file matches its siblings.

- **[WARNING] Loose `assert.equal`/`assert.deepEqual` used exclusively instead of the strict variants** — pervasive (86 `assert.equal` + 19 `assert.deepEqual`, zero `assert.strictEqual`/`assert.deepStrictEqual`); representative lines `200, 203-204, 217, 220-223, 241-243, 730, 767-769`.
  Every sibling test file in this same directory (`clone-gc.test.ts`, `bootstrap.test.ts`, `update-row.test.ts`, `plugin-state-classifier.test.ts`) and the two large files reviewed alongside this one (`shared.test.ts`, `git-source-probe.test.ts`, both of which lean on `assert.deepStrictEqual` for whole-object comparisons) use the strict comparators. Loose `==`-based comparison has a real, if narrow, blind spot here: e.g. a future `assert.equal(x, undefined)` pattern (not currently present, but the style invites it) would also pass for `x === null`, which `assert.strictEqual` would correctly reject. Fix: mechanically replace `assert.equal` → `assert.strictEqual` and `assert.deepEqual` → `assert.deepStrictEqual` throughout the file.

- **[WARNING] No `describe()` grouping despite covering five exported functions across ~76 tests** — whole file.
  `clone-cache.ts` exports `materializePluginClone`, `materializeOrRefreshPluginMirror`, `seedSameRepoPluginMirrors`, `resolvePluginPin`, and `resolveGitPluginRootWithSubdir` (plus two re-exports), and this file's sibling `git-source-probe.test.ts` demonstrates the sanctioned pattern of one `describe()` block per exported entrypoint for a module with several exports. Group this file's tests the same way (`describe("materializePluginClone", ...)`, `describe("resolvePluginPin", ...)`, `describe("materializeOrRefreshPluginMirror", ...)`, `describe("seedSameRepoPluginMirrors", ...)`, `describe("resolveGitPluginRootWithSubdir", ...)`) so the ~76 tests are navigable.

- **[WARNING] A real (non-fake) git surface is exercised without a comment explaining why it stays offline** — `test("MIRR-02: the default git surface fails locally on an invalid warm mirror", ...)`, `line 1060`.
  Unlike the two other "default git surface" tests in this file (`line 191`, `line 207`), which prove the warm/pinned short-circuits return *before* any `gitOps` method is ever invoked, this test's target function (`materializeOrRefreshPluginMirror`) DOES reach `refreshGitHubClone`'s real `gitOps.fetch(...)` call (confirmed against `marketplace/shared.ts:197`) because the pre-created `mirrorRoot` has no `.git` at all, so no warm short-circuit applies. The test passes today because isomorphic-git fails locally reading missing repo metadata before any socket is opened, but nothing in the test states that invariant. Add a one-line comment (matching the rationale style used elsewhere in this file, e.g. the `PURL-02` comments) noting that the empty `mirrorRoot` makes `fetch` fail on local metadata before any network dispatch, so a future reader does not mistake this for an accidental live-network test.

### `tests/orchestrators/plugin/git-source-probe.test.ts`

- **[WARNING] Placeholder variable name `result` used in all 27 test cases** — `lines 102, 126, 152, 176, 202, 226, 247, 264, 300, 315, 330, 342, 355, 368, 383, 400, 421, 439, 457, 481, 510, 536, 551, 621, 633, 645, 669`.
  Every single test in the file names the awaited call's return value `result`, the exact placeholder the naming rule forbids. Rename per call site to the role the value plays: `presence` for the `makePresenceProbe` describe block, `classification` for `probeManifestEntry`, `candidate` for `probeUpgradeCandidate`, `headSha` for `readMirrorHeadSha`.

### `tests/orchestrators/plugin/clone-gc.test.ts`

- **[WARNING] Custom `pluginCloneDir` override turns a stub into a mock via a call-order assertion** — `test("records removal leaks in cache order and continues deleting later clones", ...)`, `lines 319-330` (the `cloneKeys` array and `failureLocations` object) and the assertion at `line 347`.
  `failureLocations` is a hand-built `ScopedLocations` clone whose `pluginCloneDir` pushes every invoked key into `cloneKeys`, and the case asserts `assert.deepStrictEqual(cloneKeys, ["alpha-stale", "beta-stale", "gamma-stale"])`. This is a stub (used to inject controlled path failures for two of the three keys) whose *call order* is then verified — the double-role pattern the review rules flag. The same fact (the function visited and processed all three entries despite two failures) is already provable from the public result: `leaks` names exactly `alpha-stale`/`gamma-stale`, and `cloneEntries(locations)` shows `beta-stale` removed while the other two remain. Drop the `cloneKeys` tracking array and its assertion; keep `failureLocations` only to inject the two path failures.

- **[WARNING] A custom error class is discriminated by `.name` string instead of `instanceof`** — `test("rejects a symlinked clone entry before touching its external target", ...)`, `lines 297-298`.
  `assert.strictEqual(caught.name, "SymlinkRefusedError")` checks the error's `name` field rather than its type. `SymlinkRefusedError` is an exported class (`extensions/pi-claude-marketplace/shared/path-safety.ts:30`); import it and assert `assert.ok(caught instanceof SymlinkRefusedError)` before checking the message, matching the project's own documented discrimination rule ("callers narrow on `instanceof`, never on ... `error.name` string comparison") and the pattern `bootstrap.ts` uses for `MarketplaceDuplicateNameError`.

### Clean files

- `tests/orchestrators/plugin/discover-names.test.ts`
- `tests/orchestrators/plugin/plugin-state-classifier.test.ts`
- `tests/orchestrators/plugin/update-row.test.ts`
- `tests/orchestrators/plugin/bootstrap.test.ts`
- `tests/orchestrators/plugin/scope-tree-inventory.ts` — correctly located beside the concern it serves (used by install/reinstall/uninstall/bootstrap tests in the same directory), exports a pure function that computes a fresh array on every call, and its module-scope `inventoryReaddir` binding is a documented, justified exception (captured before any test can install a mock, so a directory walk always sees the real tree) rather than shared mutable state.
- `tests/orchestrators/plugin/shared.test.ts` — see the one WARNING below; otherwise exemplary (see Summary).

### `tests/orchestrators/plugin/shared.test.ts` (one finding)

- **[WARNING] `makeRecordingBoundary` hides an incomplete double behind a double `as unknown as` assertion, inconsistent with the strong-mock pattern used 40 lines later in the same file** — `lines 183-195`, consumed at `lines 1793, 1832`.
  `{ notify(message, severity) { notifications.push(...) } } as unknown as ExtensionContext["ui"]` and `{ getAllTools: () => [] } as unknown as ExtensionAPI` force a two-member object through casts into interfaces that almost certainly declare far more members. The file's own `describe("emitMarketplaceNotAdded", ...)` block (`lines 1651-1777`), testing a sibling function that shares the same `ctx`/`pi` collaborators, correctly uses `mock<ExtensionContext>({ exactParams: true, ... })` / `mock<ExtensionAPI>(...)` with `when()`/`verify()`. The header comment on `makeRecordingBoundary` gives a real reason to prefer a recorded transcript over per-call `when()` expectations here (the two `emitMarketplaceNotAddedSignal` arms produce a variable-length, discriminated notification sequence), so the recording *strategy* is defensible — but the double should not be built by casting an incomplete literal through `unknown`. Replace the two `as unknown as X` casts with a narrow, consumer-declared local interface (e.g. `interface RecordingUi { notify(message: string, severity?: string): void }` and `interface RecordingApi { getAllTools(): unknown[] }`) that the recording object satisfies structurally via `satisfies`, and change `emitMarketplaceNotAddedSignal`'s test call sites to pass values of that narrower type instead of the full `ExtensionContext`/`ExtensionAPI` — or, if the full types are required by the production signature, keep the cast but add a comment stating exactly why (only `ui.notify`/`getAllTools` are ever read on this path).

## Production code findings

### `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`

- **[WARNING] Undocumented `as` assertion on a schema-typed-`unknown` field** — `line 501` (`synthesizeUndeclaredMarketplaceSource`).
  `(state.marketplaces[marketplace]?.source as { raw?: unknown } | undefined)?.raw` casts a value whose real type is `Type.Unknown()` in the `state.json` typebox schema (`persistence/state-io.ts:269`) — a legitimate reason for the assertion, but nothing at the cast site says so. A reader unfamiliar with the state schema has no way to tell this `as` is safe. Add a short comment at the cast (e.g. `// state.json types "source" as unknown (persistence/state-io.ts); narrow defensively.`).

### Clean files

- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` — the `DEFAULT_GIT_OPS ?? args.gitOps` defaulting in four exported functions is the documented, sanctioned seam pattern (this file is explicitly the one place in the install path allowed the git surface), and it is proven safe by the two "default git surface" tests noted above; not a finding.
- `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts` (the exhaustive `switch` in `classifyManifestEntry` with no runtime `default` is a deliberate, documented use of `noImplicitReturns` exhaustiveness checking, not a missing-default defect — see the function's own doc comment)
- `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts`

## Not covered

- I did not run `node --test`, `npm run test:coverage:direct`, or `npm run check`, per the diagnostic-review instructions (read-only sweep; other reviewers are running concurrently). Findings above are from static reading only.
- I did not review `install.ts`, `update.ts`, `uninstall.ts`, `reinstall.ts`, `enable-disable.ts`, `list.ts`, `info.ts`, `fetch.ts`, or any `*.messaging.ts`/`*.messaging.test.ts` pair — these are explicitly out of scope (owned by other reviewers), including their use of `discover-names.ts`, `plugin-state-classifier.ts`, `update-row.ts`, and `clone-cache.ts` as consumers.
- I did not open `tests/platform/git-ops-fake.ts` itself (out of scope, owned by the "platform" area) to confirm whether it already supports the ref-fallback/auth-capture behavior that `clone-cache.test.ts`'s `makeMockGitOps` re-implements locally; if it does, that duplication is worth folding back into the shared fake, but I could not verify this without reading a file outside my assignment.
