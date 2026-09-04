# Orchestrators — plugin enable/disable and fetch

**Scope:** `tests/orchestrators/plugin/enable-disable.test.ts`,
`tests/orchestrators/plugin/fetch.test.ts`, and their paired production modules
`extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` and
`extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`
(`enable-disable.messaging.test.ts` / `fetch.messaging.test.ts` excluded per
assignment — owned by another reviewer).
**Test files reviewed:** 2 (3764 + 2034 lines, read in full)
**Production modules reviewed:** 2

## Summary

Both files are real, hermetic, black-box orchestrator tests (temp HOME/cwd,
real filesystem, real `state.json`) that exercise `setPluginEnabled` and
`fetchPlugins` end to end and assert on rendered notification bytes, state
snapshots, and typed outcomes. `fetch.test.ts` is close to exemplary: it uses
`strong-mock` correctly for the `ExtensionContext`/`ExtensionAPI`/notify
boundary (`exactParams: true`, `.times()`, `verify()` per case), injects a
fully offline in-memory `GitOps` fake for every one of its 28 `fetchPlugins()`
calls (never the production `DEFAULT_GIT_OPS`), and asserts exact call
schedules and full notification byte-strings. `enable-disable.test.ts` is
equally thorough on behavior coverage — including a dedicated `CR-01` test
that pins the lock-reentrancy contract this area exists to protect — but it
diverges from the sibling file's tooling discipline (hand-rolled,
unsafely-cast `ExtensionContext`/`ExtensionAPI` doubles instead of
`strong-mock`) and has a recurring pattern of decomposing a small
discriminated-union outcome into piecewise `assert.equal(status)` checks
instead of one `assert.deepStrictEqual` of the whole value, which is the kind
of gap a wrong implementation can slip through. The two production modules
are clean on the specific architectural contracts this area is built around
(no re-entrant lock acquisition, no forbidden cross-ledger import, no direct
git surface in `fetch.ts`); the main production-code items are minor
testability/documentation notes.

## Unit test findings

### `tests/orchestrators/plugin/enable-disable.test.ts`

- **[BLOCKER] Discriminated-union outcomes asserted field-by-field instead of as a whole value** — `lines 2004-2009, 2037-2041, 2070-2074, 2102-2106, 2128-2133, 2570-2577, 2311-2320` (pattern repeats ~10 times; also `lines 2791-2798, 2921-2925, 3479-3484` for the `error`-bearing arms).
  Representative case (`lines 2003-2009`):
  ```ts
  assert.ok(outcome);
  assert.equal(outcome.status, "disabled");
  if (outcome.status === "disabled") {
    assert.equal(outcome.name, "foo");
    assert.equal(outcome.version, "1.2.3");
  }
  ```
  `EnableDisablePluginOutcome` is a small, fully-literal discriminated union.
  Per the skill, "asserting existence... or one property at a time when the
  whole value is the promise is a finding" — a wrong implementation that
  attaches an extra/wrong optional field to the `"disabled"`/`"skipped"` arm
  (e.g. a copy-paste bug that leaks `unsupported`/`stagedAgents` from the
  `"enabled"` arm's builder) passes every one of these cases undetected,
  because none of them checks the object has *only* the named fields. This is
  most severe at `lines 2570-2577` ("orchestrated enable returns... version
  pin preserved") which asserts only `status`/`name`/`version` even though the
  `"enabled"` arm carries five more optional degradation fields the module
  actively populates elsewhere (compare the fully-specified sibling case at
  `lines 2617-2626`, which is the correct pattern already used in this same
  file).
  Fix: replace every `assert.ok(outcome); assert.equal(outcome.status, X); if (outcome.status === X) {...}`
  block with one `assert.deepStrictEqual(outcome, { status: X, ...allExpectedFields })`,
  mirroring `lines 2617-2626` and `lines 3017-3028`/`3023-3028` (which already
  do this correctly for `error`-bearing arms by including `error:` in the
  compared literal). For the `error`-bearing arms that currently only check
  `reason` + `instanceof` (e.g. `lines 2130-2133`), also add the `cause`
  field to the comparison so the whole object is pinned.

### `tests/orchestrators/plugin/fetch.test.ts`

- **[WARNING] Vacuous negative assertion as a secondary check** — `line 1586`:
  `assert.notDeepStrictEqual(leakedTree, [])`. This passes for any non-empty
  array and adds nothing beyond the fully-specified regex assertion on the
  preceding notification message (`lines 1580-1585`), which already pins the
  exact rmdir-failure text. Either delete this line or replace it with a
  positive assertion of what `leakedTree` should contain (e.g. the specific
  staging-dir entry name).

### Clean files

No further findings in `tests/orchestrators/plugin/fetch.test.ts` beyond the
one line above — this file consistently uses `strong-mock` with
`exactParams: true`, precise `.times()` counts, and a `verify()` call per
case; every collaborator (`GitOps`, `CredentialOps`, `DeviceFlowHttp`,
`FetchCloneCacheSeam`) is an explicit fake/mock injected through
`FetchPluginsOptions`, never a production default; assertions are whole-value
`assert.deepStrictEqual` throughout, including full call-schedule logs for
ordering; naming is role-based with no `mock`/`fake`/`stub`-prefixed
identifiers; no `describe()`, no `it()`, no `test.only`/`.skip`, no data-loop
cases, no `any`.

## Other notable items in `enable-disable.test.ts` (not separately itemized as BLOCKER)

- **[WARNING] Hand-rolled, unsafely-cast `ExtensionContext`/`ExtensionAPI` doubles** — `lines 45-56` (`makeCtx`) and `lines 58-86` (`makePi`/`makePiWithSubagents`), used by all 61 `test()` cases in the file.
  ```ts
  const ctx = { cwd, ui: { notify(message, severity) { ... } } } as ExtensionContext;
  ...
  return { getAllTools: (...) => ... } as ExtensionAPI;
  ```
  `ExtensionContext` (from `@earendil-works/pi-coding-agent`) declares ~16
  members (`mode`, `hasUI`, `sessionManager`, `modelRegistry`, `model`,
  `scopedModels`, `isIdle()`, `isProjectTrusted()`, `signal`, `abort()`,
  `hasPendingMessages()`, `shutdown()`, `getContextUsage()`, `compact()`,
  `getSystemPrompt()`) and `ExtensionAPI` declares dozens more; the `as` casts
  force an object that implements only `cwd`/`ui` (resp. `getAllTools`) to
  satisfy the full interfaces, bypassing structural type-checking entirely.
  `notify` is exactly the kind of "public behavior" interaction the skill
  calls out as requiring `strong-mock`, and the sibling file in the very same
  directory (`fetch.test.ts`'s `notificationBoundary()`, `lines 101-118`)
  already does this correctly: `mock<ExtensionContext>({ exactParams: true, ... })`
  + `when(() => ctx.ui).thenReturn(ui).times(n)` + `verify(ctx)`. This is a
  repo-wide split (roughly half the test suite uses `as ExtensionContext`,
  half uses `mock<ExtensionContext>`; other `orchestrators/plugin/*.test.ts`
  files such as `install.test.ts`/`update.test.ts`/`shared.test.ts` share this
  file's pattern and are outside this assignment), so this is reported as a
  WARNING rather than a BLOCKER — it is not shown to cause any current test to
  pass on a wrong implementation — but it is a real type-safety hole
  (an untyped field access anywhere in the call graph would silently read
  `undefined` instead of failing to compile) and the fix is mechanical:
  replace both factories with `strong-mock`-based mocks mirroring
  `notificationBoundary()`.
- **[WARNING] `t.mock.method()` return values named with an embedded "Mock" suffix** — e.g. `readMock` (`lines 3143, 3216, 3255, 3375`), `rmMock` (`line 3376`), `mkdirMock` (`line 2934`), `parseMock` (`line 3093`). Per the skill, "a double is named for its role only... no `mock`/`fake`/`stub` in the name — how it is created shows the kind." Rename to the role being stubbed (e.g. `readFile`, `mkdir`, `parse`) or a variable describing what failure it injects (e.g. `deniedReadFile`).
- **[WARNING] Stub call-count assertion** — `line 3136`: `assert.equal(parseMock.mock.callCount(), 1);`. Per the skill, "a stub with call-count assertions has been turned into a mock." The preceding `assert.deepStrictEqual(outcome, {...})` (`lines 3129-3134`) already fully discriminates the behavior under test; this line is a superfluous interaction check on what should stay a stub. Remove it, or if the call count is genuinely load-bearing, express the constraint as a proper `strong-mock` expectation instead.
- **[WARNING] Weak secondary assertions on raw bytes** — `line 2629` (`assert.notStrictEqual(await readFile(statePath, "utf8"), beforeState)`), `line 2801` (same pattern), `line 3364` (`assert.notEqual(await readFile(statePath, "utf8"), "")`). Each follows a much stronger primary assertion (`assert.deepStrictEqual(outcome, {...})` or `assert.equal(...enabled, false)`) that already discriminates the behavior; these standalone negative checks pass for any change/any non-empty content and add no protection. Delete them, or replace with a positive assertion of the expected post-state.
- **[WARNING] `assert.rejects` matched by message-regex instead of the error's `.code`** — `lines 912-916` (`assert.rejects(() => stat(hooksJsonPath), /ENOENT/, ...)`), `line 3310` (same pattern). Node's `fs.stat` ENOENT rejection carries a structured `.code`; match on that instead of the message text: `await assert.rejects(() => stat(hooksJsonPath), (err) => { assert.equal((err as NodeJS.ErrnoException).code, "ENOENT"); return true; })`.

## Production code findings

### `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`

- **Lock re-entrancy contract: verified, no finding.** `runEnableBranch` (`lines 243-336`) calls the guard-free `runInstallLedger` from `install.ts` against the caller's own `state`/`locations`, never `installPlugin`. `tests/orchestrators/plugin/enable-disable.test.ts`'s `CR-01` test (`lines 924-1001`) proves this behaviorally: it drives a fresh enable end to end inside the single `withLockedStateTransaction` and asserts the exact success byte form; the test's own comment states a nested `withStateGuard` would instead surface a `(failed)` row with a `StateLockHeldError` cause, which is exactly what would happen if `installPlugin` (the guard-taking entry point) were substituted. A second test (`lines 2874-2929`, "a held project lock returns lock-held...") independently confirms the same lock file is honored when externally held. No BLOCKER here.
- **Cross-ledger import boundary: verified, no finding.** The module's only sibling-ledger import is `runInstallLedger` from `./install.ts` (`line 85`) and `cascadeUnstagePlugin` from `../marketplace/shared.ts` (`line 74`) — both are the documented, sanctioned seams (ARCHITECTURE.md: "enable-disable.ts reaches the same materialization logic indirectly, by calling the guard-free `runInstallLedger`..."; "A plugin ledger reaches marketplace code only through `orchestrators/marketplace/shared.ts`"). No import of `update.ts`, `uninstall.ts`, or `reinstall.ts`.
- **[WARNING] Inline `new Date()` — hidden clock dependency** — `line 365` (`installed.updatedAt = new Date().toISOString();`) and `line 400` (`toDisabledRecord(installed, new Date().toISOString())`). Per the testability checklist, an inline `Date.now()`/`new Date()` is a hidden dependency; the fix (of the four sanctioned options) is to make the timestamp an explicit parameter of `runDisableBranch`/the orchestrator entry, sourced from an injected clock at the composition root. Low priority: no test currently depends on a specific `updatedAt` value, so this is a design note rather than an active test gap.
- **[WARNING] Over-broad `try` block** — `lines 280-296` (`runEnableBranch`). The `try` wraps the `await runInstallLedger(...)` call *and* all of the subsequent pure data mapping (`assertRecordedStateLedgerInstalled`, `Array.from(new Set(...))`, the returned object literal), none of which can throw. Per the style guide, a `try` block should cover only the statements that can throw. Move the post-processing after the `try/catch` (capture `result` via a `let` outside, or restructure to return early inside the `try`).
- **[WARNING] Doc-comment mood** — several JSDoc-style comments use an imperative "Run X"/"Write Y"/"Drop Z" form rather than the third-person "Runs X"/"Writes Y"/"Drops Z" the style guide asks for, e.g. `line 243` ("Run the enable branch:..."), `line 350` ("Run the disable branch:..."), `line 452` ("Drop the parsed-config cache entry..."). This is pervasive through the file (and appears to be an established house convention, not unique to this module), so it is reported once rather than per-instance; not worth a dedicated pass unless the project decides to standardize doc-comment mood repo-wide.

### `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`

- **Network boundary: verified, no finding.** `fetch.ts` is a legitimate network-touching path (unlike `install.ts`/`list.ts`/`reinstall.ts`/`info.ts`, which the architecture explicitly forbids from importing git surfaces) — it materializes plugin clones through the injected `FetchCloneCacheSeam` (`lines 92-96`, defaulting to the real `resolvePluginPin`/`materializePluginClone`/`materializeOrRefreshPluginMirror` from `clone-cache.ts` only when a caller omits the seam) and never imports `platform/git.ts` or `DEFAULT_GIT_OPS` directly. Every one of the 28 `fetchPlugins()` calls in the test file supplies `cloneCacheSeam`, and the underlying `createGitOpsFake` (`tests/platform/git-ops-fake.ts`) is a fully in-memory, no-network fake that throws on any URL not in its explicit allow-list — a real network reach in a test would fail loudly, not silently pass. No BLOCKER here.
- **The `FetchCloneCacheSeam`/`credentialOps`/`deviceFlowHttp` options (`lines 92-111`) are the correct pattern, not a test-only export.** They are the sanctioned "inject a narrow consumer-declared port" fix for a side-effecting dependency, mirroring `install.ts`'s `InstallCloneCacheSeam`; production leaves them undefined and falls back to the real implementations. Noted as a positive, not a finding.
- **[WARNING] Unexplained dynamic `import()`** — `line 464` (`const { resolveStrict } = await import("../../domain/resolver.ts");` inside `reasonedRow`). `domain/resolver.ts` only imports from `shared/` and other `domain/` modules (no import back into `orchestrators/`), so there is no circular-import necessity forcing a deferred load, and no comment explains the choice. Either promote this to a top-level `import`, or add a comment stating the reason (e.g. deferring the cost of loading the 1500+-line resolver module until the reasoned-row branch is actually reached).

### Clean files

- No other findings in `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`.

## Not covered

- `enable-disable.messaging.ts`/`fetch.messaging.ts` and their `.messaging.test.ts` suites were explicitly out of scope per the assignment and were not read.
- The shared test fakes `tests/platform/git-ops-fake.ts` (spot-checked to confirm it is fully offline), `tests/platform/credential-ops-fake.ts`, and `tests/domain/device-flow-fake.ts` were used but not exhaustively reviewed for their own internal test-double discipline — they are shared infrastructure consumed by multiple orchestrator test files outside this assignment's scope.
