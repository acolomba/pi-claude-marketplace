# Orchestrators — plugin enable/disable and fetch — adversarial re-review

**Scope:** `tests/orchestrators/plugin/fetch.test.ts` (2,035 lines, read in full),
`tests/orchestrators/plugin/enable-disable.test.ts` (3,765 lines, read in full),
`extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts` (553 lines),
`extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` (1,349 lines).
Supporting reads to settle claims: `orchestrators/plugin/fetch.messaging.ts`,
`orchestrators/plugin/git-source-probe.ts`, `orchestrators/plugin/clone-cache.ts`
(`resolvePluginPin`), `domain/clone-key.ts`, `shared/notify.ts` (row shapes +
`DESCRIPTION_BEARING_STATUS`), `shared/notify-context.ts`,
`tests/architecture/no-orchestrator-network.test.ts`, `tests/architecture/source-scan.ts`.
**First-pass file:** `unit-test-findings/orchestrators-plugin-enable-fetch.md`
**Clean files attacked:** 2 declared-clean files (`fetch.test.ts`, `fetch.ts`) plus the
3 "verified, no finding" production claims re-tested independently.
**Existing findings graded:** 15 (12 findings + 3 positive verifications)

## The dispatch lead — REFUTED, and replaced by a real one

The lead said `fetch.ts:464` may contain `await import(".../platform/git.ts")`.
It does not. Line 464 is:

```ts
const { resolveStrict } = await import("../../domain/resolver.ts");
```

`grep -n "import(" fetch.ts` returns exactly that one hit; `fetch.ts` names zero
git surface, and it **is** a member of the `FORBIDDEN_TARGETS` array
(`tests/architecture/no-orchestrator-network.test.ts:103`), so its own header
comment (`fetch.ts:9-14`) is accurate, not a misattribution.

The lead is nonetheless directionally right about the hazard class, and the real
finding is sharper — see **[BLOCKER] the NFR-5 gate cannot see a dynamic import**
below. `fetch.ts:464` is the live proof that the evading form is already idiomatic
inside a gated file.

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 4 |
| New WARNING (missed by first pass) | 13 |
| Existing CONFIRMED | 11 |
| Existing UNDERSTATED | 2 |
| Existing OVERSTATED | 2 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts` (declared clean)

- **[BLOCKER] The NFR-5 gate cannot see a dynamic import, and this file already uses one** — `fetch.ts:464`, gate at `tests/architecture/no-orchestrator-network.test.ts:115`
  The gate's only import clause is
  `{ name: "import from platform/git", pattern: /from\s+["'][^"']*platform\/git[^"']*["']/ }`.
  `await import("…/platform/git.ts")` has no `from` token, so it matches nothing.
  The three remaining patterns (`DEFAULT_GIT_OPS`, `gitOps`, `refreshGitHubClone`)
  are identifier greps, so a deliberately-or-accidentally written
  `const { clone } = await import("../../platform/git.ts"); await clone(...)`
  passes all four patterns on **all 12 gated targets**, including `install.ts`,
  `list.ts`, `info.ts`, `reinstall.ts` and `domain/resolver.ts`. This is not
  hypothetical for `fetch.ts`: it already carries a bare `await import()` at line
  464, so the form is established house style in a gated file and a future edit
  can reach git through it with the gate green.
  Fix: add a fifth pattern to `FORBIDDEN_PATTERNS`,
  `{ name: "dynamic import of platform/git", pattern: /import\s*\(\s*["'][^"']*platform\/git[^"']*["']\s*\)/ }`,
  and plant a violation to prove it fires (per the repo's own "a gate wants a test
  that plants the violation" rule in CONVENTIONS.md). `assertNoForbiddenSurface` is
  shared with `tests/architecture/compat-01-no-expansion.test.ts`, so audit that
  gate's pattern list for the same blind spot.

- **[WARNING] `skippedUpToDate` attaches a `description` the row type does not declare and the renderer never prints** — `fetch.ts:412-419` (via `entryMeta`, `fetch.ts:400-405`)
  `skippedUpToDate` spreads `...entryMeta(entry)`, whose declared return type is
  `{ version?: string; description?: string }`, into a value typed
  `PluginSkippedMessage`. `PluginSkippedMessage` (`shared/notify.ts:1069-1075`)
  declares `status | name | reasons | version? | scope?` — **no `description`** —
  and `DESCRIPTION_BEARING_STATUS.skipped === false`
  (`shared/notify.ts:4041`), so the field can never render. Spread properties
  bypass TypeScript's excess-property check, which is why this compiles. It is
  dead data riding on a shared helper, and it contradicts `entryMeta`'s own
  "PL-4" doc claim on this call path.
  Fix: give `skippedUpToDate` its own `...(entry.version !== undefined && { version: entry.version })`
  spread (the form `failedRow` at `fetch.ts:527` already uses), and keep
  `entryMeta` for the `freshRow` arms whose row types do declare `description`.

- **[WARNING] `reasonedRow`'s three returns carry `...meta` that no case exercises** — `fetch.ts:479-484`, `487-493`, `498`
  Deleting `...meta` from any one of the three `reasonedRow` returns leaves the
  whole suite green. The only cases that reach `reasonedRow` are
  `fetch.test.ts:1118` ("derives partially available and unavailable git rows
  exactly"), `:1245` (the concurrent-cache `available` fallback) and `:1984`
  ("narrows an unreadable warm mirror probe"), and **none of their manifest
  entries carries a `version` or a `description`**. The only case that pins
  `description` at all is `:1190`, which reaches the `remote` arm.
  Fix: add `version: "1.0.0", description: "Partial plugin"` to the `partial`
  entry at `fetch.test.ts:1130-1134` and to `missing-subdir` at `:1135-1143`, and
  extend the expected message at `:1171-1177` to
  `"  ⊖ partial v1.0.0 (partially-available) {lsp}"` + the 4-space description
  line, mirroring the `remote` expectation at `:1237`.

- **[WARNING] `narrowFetchFailure`'s `EPERM` arm is reachable and untested** — `fetch.ts:547`
  `code === "EACCES"` is covered by `fetch.test.ts:1361`; `code === "EPERM"` is
  covered by nothing, so narrowing the condition to `code === "EACCES"` alone
  survives. `EPERM` is what Windows and some container filesystems report for the
  same denial.
  Fix: in `fetch.test.ts:1354-1372`, make the second stubbed clone throw
  `Object.assign(new Error("perm denied"), { code: "EPERM" })` instead of the
  bare string, and add a third entry for the non-`Error` throw so all three arms
  keep a case.

- **[WARNING] The status probe is not an injectable seam, forcing a global `node:fs/promises` patch** — `fetch.ts:123-136` vs `fetch.test.ts:1261-1271`
  `FetchPluginsOptions` injects `cloneCacheSeam`, `credentialOps` and
  `deviceFlowHttp`, but `probeManifestEntry` / `makePresenceProbe` are reached by
  static import only. The one case that must control the probe *sequence* (the
  `installable`-slipped-past-the-classifier fallback at `fetch.ts:498`) therefore
  patches the process-wide `node:fs/promises` namespace with
  `testContext.mock.method(fs, "stat", …)` + `syncBuiltinESMExports()`. Per the
  guidelines this is the "inject a narrow consumer-declared port" case, not a
  loader case.
  Fix: add `readonly probeSeam?: { probeManifestEntry: typeof probeManifestEntry }`
  to `FetchPluginsOptions`, defaulted at use exactly like `cloneCacheSeam`
  (`fetch.ts:132-136`), and rewrite `fetch.test.ts:1245` to inject a probe that
  returns `"unavailable"` once then defers to the real one — deleting the
  `fs.stat` patch, the `syncBuiltinESMExports()` calls and the `hideDirectoryKindOnce`
  flag.

### `tests/orchestrators/plugin/fetch.test.ts` (declared clean)

- **[BLOCKER] "reuses a stored GitHub credential without Device Flow" proves nothing if the clone call is skipped** — `fetch.test.ts:688`, assertion at `:726`
  The case's whole promise — that the stored credential is threaded into the
  clone's auth bundle — lives in an assertion **inside** the seam stub:
  ```ts
  async materializePluginClone(args) {
    const callbacks = buildAuthCallbacks(requiredAuth(args.auth));
    assert.deepStrictEqual(await callbacks.onAuth(`${cloneUrl}.git`), storedCredential);
    return path.join(cwd, "not-written");
  },
  ```
  Mutating `materializeThroughSeam` (`fetch.ts:386-392`) to drop the
  `await deps.seam.materializePluginClone({...})` call while keeping
  `resolvePluginPin` + `buildCloneAuth` leaves every post-act assertion green:
  `credentials.calls` still shows `fill: [{ host: "github.com" }]` (built before
  the clone), the row still renders `◌ stored (remote)` (the stub returned an
  absent path anyway), `deviceFlow.calls` is still empty, and `verifyNotifications`
  still passes. The in-stub assertion simply never runs.
  The sibling case at `:760` shows the correct form: it pushes into
  `authResults` (`:791`, `:797`) and compares the whole array after the act
  (`:824-835`).
  Fix: in the case at `:688`, add `const cloneCalls: string[] = [];`, push
  `` `clone ${args.cloneUrl} pin=${args.pin}` `` inside `materializePluginClone`,
  and assert
  `assert.deepStrictEqual(cloneCalls, ["clone https://github.com/acme/plugin pin=5555555555555555555555555555555555555555"])`
  in the assert block. The cases at `:1190` and `:1984` have the same
  no-positive-call-proof shape (they survive the same mutation) but it is not
  their promise; the same one-line recorder closes both.

- **[WARNING] No `(no marketplaces)` empty-result case — five sibling orchestrator suites have one** — `fetch.test.ts` (whole file)
  `fetchPlugins` with a target matching nothing produces `blocks = []` and calls
  `notifyWithContext(ctx, pi, FETCH_CONTEXT, [], "cascade", cardinality)`, which
  emits the central `(no marketplaces)` sentinel (`shared/notify.ts:3720`,
  `:3861`). `fetch.ts:226-228`'s own doc comment states this behaviour ("A
  plugin/marketplace not present in state … simply contributes no target"), and
  nothing pins it. The named siblings that already have the case:
  `orchestrators/plugin/list.test.ts:299`, `plugin/reinstall.test.ts:1528`,
  `marketplace/update.test.ts:530`, `marketplace/list.test.ts:183`,
  `marketplace/autoupdate.test.ts:400`, `import/execute.test.ts:980`.
  Fix: add a case seeding an empty user+project state and calling
  `fetchPlugins({ target: { kind: "plugin", marketplace: "ghost", plugin: "x" }, … })`,
  asserting `assert.deepStrictEqual(boundary.notifications, [{ message: "(no marketplaces)" }])`
  with `notificationBoundary(name, 1)`.

- **[WARNING] Expected clone-cache paths are computed by the production hasher** — `fetch.test.ts:410`, `484`, `545`, `1257`, `1491`, `1847`, `1995`
  Seven cases call the production `pluginCloneKey` / `pluginMirrorKey`
  (`domain/clone-key.ts:35`, `:54`) to build both the arrange path and the
  expected assert path, so a mutation to the key derivation moves both sides in
  lockstep and the cases stay green (`:510-525` compares a tree whose every entry
  is `path.join(cloneKey, …)`).
  The same file already carries the independent form: `:1970`'s regex pins
  `plugin-clones\/[0-9a-f]{12}-567890abcdef` — 12 hex of the URL hash, a hyphen,
  and the literal first 12 of the pin, written out rather than asked for.
  Fix: for `:458` ("materializes a cold pinned URL clone at its recorded SHA"),
  which is the case that owns the on-disk layout, replace `cloneKey` in the
  expected tree at `:510-525` with the hand-written `<12hex>-2222222222222` form
  used at `:1970`. Leave the *arrange*-only uses (`:410`, `:545`, `:1847`,
  `:1995`) alone — seeding at the production location is legitimate; only the
  expected side must be independent.

- **[WARNING] The cleanup-leak case leaks a temp tree when it fails** — `fetch.test.ts:1546`, restored at `:1567`
  `await chmod(path.dirname(options.dir), 0o500)` makes `<scopeRoot>/sources-staging`
  unwritable, and only line `:1567` restores it. `withWorkspace`'s cleanup
  (`:353-354`) uses `rm(..., { force: true })`, which ignores ENOENT but not
  EACCES, so any failure between `:1546` and `:1567` leaves the whole `cwd`
  temp tree on disk.
  Fix: register the restoration up front —
  `t.after(() => chmod(stagingDir, 0o700).catch(() => {}))` — and take the test
  context in the case signature, the pattern `:1245` already uses.

## Export ownership census

### `orchestrators/plugin/fetch.ts`

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `fetch.ts` | `fetchPlugins` | `fetch.test.ts:358` … `:1984` (24 cases, 28 calls) | owned |
| `fetch.ts` | `FetchTarget` (`kind: "plugin"`) | `fetch.test.ts:382`, `:440`, `:494` … | owned |
| `fetch.ts` | `FetchTarget` (`kind: "marketplace"`) | `fetch.test.ts:820`, `:1088`, `:1165`, `:1382` | owned |
| `fetch.ts` | `FetchTarget` (`kind: "all"`) | `fetch.test.ts:908`, `:1015` | owned |
| `fetch.ts` | `FetchCloneCacheSeam` | injected in 23 of 24 cases | owned |
| `fetch.ts` | `FetchPluginsOptions.scope` = `"user"` | — | **NO CASE** (only `"project"` or omitted) |
| `fetch.ts` | `FetchPluginsOptions.credentialOps` default (`DEFAULT_CREDENTIAL_OPS`) | — | **construction only** — `:358` omits it but is a path source, so the default is never invoked (correct: invoking it would spawn `git credential`) |
| `fetch.ts` | `FetchPluginsOptions.cloneCacheSeam` default (real imports) | `fetch.test.ts:358` | **construction only** — same reason (correct) |

No unowned exports. `fetch.ts` has no test-only export: the seam options are the
sanctioned injection pattern (see grading below).

### `orchestrators/plugin/enable-disable.ts`

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `enable-disable.ts` | `setPluginEnabled` (standalone overload) | `enable-disable.test.ts:453` … (37 cases) | owned |
| `enable-disable.ts` | `setPluginEnabled` (orchestrated overload) | `:1980` … (24 cases) | owned |
| `enable-disable.ts` | `EnableDisablePluginOutcome` | `:2496`, `:2519` (typecheck pins) | owned |
| `enable-disable.ts` | `EnableDisablePluginNotifications` | `:1999` etc. | owned (incidental — never asserted as a shape) |
| `enable-disable.ts` | `EnableDisablePluginOptions` | every case | owned |
| `enable-disable.ts` | `EnableDegradationSignals` | — | **NO CASE** — a re-export alias of `LedgerDegradationSignals` consumed by `reconcile/apply-outcomes.ts`; the fields are exercised through `:2617-2626` but the type itself is never `satisfies`-checked here |

## Branch census

### `fetch.ts`

**Reachable and untested (findings):**
- `narrowFetchFailure` `code === "EPERM"` (`:547`) — see the WARNING above.
- `blocks = []` → `(no marketplaces)` (`:170-194`) — see the WARNING above.
- `...meta` on the three `reasonedRow` returns (`:479`, `:487`, `:498`) — see above.
- `enumerateFetchTargets` scope order `["project", "user"]` (`:237`): reversing it
  survives, because `:864` sorts the output with `compareByNameThenScope` and its
  `cache.calls` is `[]`. Not filed as a finding — emit order is the stated
  contract (`fetch.ts:139-141`) and it *is* pinned at `:912-931`; enumeration
  order is not promised.

**Compiler-forced / not removable (D-116-01a class):**
- The `npm` and `unknown` arms of `!isGitSource` (`fetch.ts:328-334`) have no
  case (only `path`, via `"./x"` sources). Narrowing the guard to
  `source.kind === "path"` does **not** compile: `const gitSource: GitBackedSource = source`
  at `:336` would then receive `NpmSource | UnknownSource`. The discrimination is
  compiler-enforced, so this is not a missing-case finding.
- `entryMeta`'s two `!== undefined` spreads (`:401-402`) both have cases in both
  directions (version: `:445` present / `:575` absent; description: `:1237`
  present / everywhere else absent).

**Fully covered branches (verified case-by-case):** the pinned-warm no-op gate
(`:342-347`, both arms), `materializeThroughSeam`'s pinned vs unpinned arms and
their `ref`/`auth` spreads (`:372-392`, all four arms), `freshRow`'s
`remote`/`available`/reasoned split (`:435-448`), `reasonedRow`'s four exits
(partially-available `:1118`, unavailable `:1118`, `available` fallback `:1245`,
`catch` `:1984`), `failedRow`'s `Error` / non-`Error` split (`:1071` / `:1364`),
the per-marketplace manifest-failure `catch` (`:256-258` via `:985`), and both
`cardinality` arms.

### `enable-disable.ts`

**Reachable and untested (findings):**
- `resolveIdempotentOutcome`'s `configEnabled === enable` arm (`:557`) — the case
  where the targeted config already **agrees** with the state side. `:1621` /
  `:1648` cover `configEnabled === undefined`; `:1753` / `:1801` cover the
  disagreeing (promotion) arm. Inverting `configEnabled === enable` to
  `configEnabled !== enable` survives the whole suite. Fix: add a case seeding
  `{ "foo@mp": { enabled: true } }` with an already-enabled record and
  `enable: true`, asserting `(skipped) {already enabled}` **and**
  `state.json` bytes unchanged **and** the config file bytes unchanged.
- `emitEnableDisableFailedRow`'s `enable === true` arm from the *transaction*
  catch (`:834` → `:948`). The pre-lock resolution path covers `enable: true`
  (`:2244`), and the transaction path covers `enable: false` (`:2931`, `:3047`).
  Low value — the two arms differ only in `Messaging.label`, which a single-row
  cascade never prints — but recording it rather than assuming clean.

**Unreachable by real input (production dead code, category b):**
- **Five `version !== undefined` guards over a required field** — `:994`
  (`freshOutcomeToTypedResult`), `:1194` and `:1205` (`freshEnableRow`), `:1241`
  (`enableFailedRow`), `:1344` (`composeOutcomeRow`'s fresh-disable arm).
  `SetEnabledOutcome`'s `fresh` arm declares `version?: string`, but all three
  producers set it from `installed.version` (`:250`, `:356`, `:562`), and the
  state schema declares `version: Type.String()` (`persistence/state-io.ts:82`) —
  required. The optional is unreachable.
  Fix: change `SetEnabledOutcome`'s `fresh` arm and `enable-failed`/`disable-failed`
  arms to `version: string` / `recordedVersion: string` and delete the five
  guards; the branch-coverage requirement then becomes satisfiable.

**Fully covered:** `dropCachedHooks`'s catch on both the `unexpected: true`
(`:3319`) and `unexpected: false` partial-cascade (`:3211`) paths;
`sanitizeStateLoadError`'s redact-hit (`:2244`) and redact-miss (`:3047`) arms;
`classifyTransactionThrow`'s `StateLockHeldError` (`:2874`) and errno-ladder
(`:2931`) arms; `enableFailedRow`'s `partials.length > 0` (`:3371`) and
`staleGate` (`:1460`) arms; every `outcomeToTypedResult` case.

**Compiler-protected switches (not the `assertNever` gap META item 5 describes):**
`outcomeToTypedResult` (`:1025-1075`) and `composeOutcomeRow` (`:1265-1348`) are
value-returning switches over closed unions with no `default`. Under this repo's
`noImplicitReturns`, adding a union member without an arm is a compile error
(TS7030/TS2366) — the behaviour the repo already recorded in
`switch-exhaustiveness-ts7030.md`. Recorded here as category (c), **not** filed
as a finding, and see the META correction below.

## New findings — `enable-disable.test.ts` (not on a clean list, but these classes were missed entirely)

- **[BLOCKER] Six cases patch builtin module namespaces through a `createRequire` + `syncBuiltinESMExports` loader trick** — `enable-disable.test.ts:37-38`, and cases at `:2931`, `:3084`, `:3140`, `:3211`, `:3371`
  ```ts
  const require = createRequire(import.meta.url);
  const filesystemPromises = require("node:fs/promises") as typeof import("node:fs/promises");
  …
  mkdirMock = t.mock.method(filesystemPromises, "mkdir", …);
  syncBuiltinESMExports();
  ```
  This grabs the CJS binding of `node:fs/promises`, replaces `mkdir` / `readFile`
  / `rm` on it, then forces every ESM importer in the process to re-read the
  mutated namespace. `:3093` does the same to `JSON.parse`. The skill's rule is
  explicit: "`t.mock.module()` or a custom loader is a finding — the dependency
  gets injected instead", and this is a hand-rolled equivalent that additionally
  mutates process-global state, so these cases can never run concurrently with
  any other case in the process. There are 11 `syncBuiltinESMExports()` call sites
  in this file (`:2957`, `:2995`, `:3042`, `:3164`, `:3181`, `:3206`, `:3266`,
  `:3313`, `:3420`, `:3448`, `:3504`).
  What makes it a defect rather than a necessary evil: every failure being
  injected is producible with real filesystem state. `fetch.test.ts:1546` produces
  its EACCES with `await chmod(dir, 0o500)` and no patching at all.
  Fix, in priority order: (1) rewrite `:2931` (mkdir EACCES on the scope root),
  `:3140` (manifest read failure) and `:3211` (mcp.json read failure) to use
  `chmod(dir, 0o500)` / `chmod(file, 0o000)` on the real temp tree, registering
  restoration with `t.after()`; (2) for `:3371`, which needs a *rollback* to fail
  after a *stage* succeeded, add an fs seam to the install ledger rather than
  patching — this is the same production change item 5 below asks for; (3) delete
  `:3084` (`JSON.parse` patched to install a throwing getter) — the non-`Error`
  containment it proves is already proven by `:2983` and `:3140` without a global
  patch. Note the `JSON.parse` case additionally asserts
  `parseMock.mock.callCount()` (see the graded WARNING), so both defects die together.

- **[BLOCKER] 17 fragment assertions where the whole message is computable, and the same file already writes the whole message 18 times** — `enable-disable.test.ts:724, 727, 1528, 1609, 1644, 1671, 1797, 1853, 1887, 1894, 1940, 1969, 2154, 2274, 2281, 2403, 2463` (plus 8 `assert.ok(!msg.includes(…))` negatives at `:732, 1125, 1359, 1529, 1941, 2277, 2317, 2464`)
  This is exactly the class META-FINDINGS §3 catalogues, and **`enable-disable.test.ts`
  is absent from its table**. The weakest four are load-bearing:
  - `:2274` `assert.match(notifications[0]!.message, /\(failed\)/)` — the C1
    corrupt-state case. Passes for any failed row, any reason, any glyph, any
    scope bracket. Its companion `:2281` only checks that `state.json` appears
    somewhere in the string.
  - `:2403` — same regex, in the I3 partial-cascade case.
  - `:1797` and `:1853` `assert.match(…, /\(installed\)/)` — the two WR-03
    config-truth promotion cases; the reload trailer, the marketplace header, the
    version slot and the severity are all unpinned.
  The correct form is next door in the same file: `:782`, `:880`, `:953`,
  `:1120`, `:1194`, `:1242`, `:1326`, `:1361`, `:1406`, `:1492`, `:1708`, `:1743`,
  `:2866`, `:3012`, `:3032`, `:3077`, `:3466`, `:3489` all build the expected
  string with `[…].join("\n")` and compare it whole.
  Fix: replace each `assert.equal(notifications.length, N)` +
  `assert.match(notifications[0]!.message, /…/)` pair with a single
  `assert.deepStrictEqual(notifications, [{ message: […].join("\n"), severity: "…" }])`.
  That also deletes every `notifications[0]!` non-null assertion and makes all
  eight `assert.ok(!…includes(…))` negatives redundant.

- **[WARNING] A case that tests `shared/notify.ts`, not `setPluginEnabled`** — `enable-disable.test.ts:1536` (`test("WR-02: a failed plugin row from another surface renders byte-identically …")`)
  The case never calls `setPluginEnabled`. It calls `notify(ctx, makePi(), {…})`
  directly with a hand-built `PluginFailedMessage` and asserts the rendered bytes.
  Its subject is the renderer's `partialHint` trailer gate.
  Fix: move it verbatim to `tests/shared/notify.test.ts`, which owns
  `shared/notify.ts`. Keep the `WR-02` anchor in the title.

- **[WARNING] Two cases drive three other orchestrators end to end** — `enable-disable.test.ts:3513` and `:3632` (the DFEN-07 pair)
  Both call `applyReconcile` (`orchestrators/reconcile/apply.ts`), `updatePlugins`
  (`plugin/update.ts`) and `reinstallPlugin` (`plugin/reinstall.ts`) alongside
  `setPluginEnabled`, and assert those modules' notification counts
  (`:3627-3628`, `:3761-3762`). `reconcile/apply.test.ts`'s deliberate
  real-orchestrator deviation is documented as D-115-03 and runs in the
  *reconcile* owner's file; this is the reverse direction, with no such record.
  Fix: move both to `tests/integration/` (outside the `npm test` glob), or reduce
  each to the enable-owned claim — that an explicit `enabled: true` write lands in
  the declaring file and the merged view moves — and let
  `reconcile/apply.test.ts` own the survives-a-reload half.

- **[WARNING] AAA phases out of order** — `enable-disable.test.ts:1014-1071` (`test("ENBL-19: an enable/disable/enable round trip succeeds …")`)
  `// act` is at `:1031`, `// assert` at `:1037`, and then `:1050-1058` arranges
  (`readSkills()`, the precondition `assert.ok`) and acts again
  (`await setPluginEnabled({ ...args, ctx, enable: true })`).
  Fix: move the `// assert` marker down to `:1060` and mark the third
  `setPluginEnabled` call as part of the act block; the intermediate
  `assert.ok(retained.length > 0)` is arrange-time precondition checking and
  should sit above the second `// act`.

- **[WARNING] The `error` field of the orchestrated resolution failure is never asserted, so its path sanitization is unproven** — `enable-disable.test.ts:2313-2321`
  `emitResolutionFailure` (`enable-disable.ts:898-906`) returns
  `error: sanitized`, where `sanitizeStateLoadError` redacts the absolute
  `state.json` path (T-53-02-02). The case asserts only `outcome.status` and a
  negative substring check on `outcome.cause` — a **different field**. Mutating
  `:903` to `error: cause` (the un-sanitized original, whose message embeds the
  absolute path) leaves it green, and the absolute path then reaches whatever
  `reconcile/apply.ts` does with `outcome.error`.
  Fix: assert the whole outcome —
  `assert.deepStrictEqual(outcome, { status: "failed", reason: "unreadable", error: new Error(<expected sanitized message>), cause: <same string> })` —
  the form `:2702-2707` and `:3129-3134` already use in this file.

- **[WARNING] `makeCtx` widens `severity` from the SDK union to `string`** — `enable-disable.test.ts:50`
  `notify(message: string, severity?: string)`. `NotificationSeverity` is a closed
  union; typing the recorder's parameter as `string` means a production mutation
  stamping an off-catalog severity is recorded and compared as an ordinary string
  instead of failing to compile.
  Fix: `fetch.test.ts:56-59` has the narrow form —
  `type NotificationSeverity = Parameters<ExtensionContext["ui"]["notify"]>[1];` —
  copy it.

## New findings — `enable-disable.ts` production (not on a clean list; missed classes)

- **[WARNING] Two empty `asserts` functions stand in for runtime checks** — `enable-disable.ts:128-132` (`assertRecordedStateLedgerInstalled`) and `:424-428` (`assertDisableFailureReasonsNonEmpty`)
  Both have an empty body and a comment saying the invariant is established
  elsewhere. They are `as` casts wearing a function's clothes: they narrow the
  compiler's view with no runtime consequence, but read at the call site as
  checks. `assertRecordedStateLedgerInstalled`'s failure mode is concrete — if
  `runInstallLedger` ever returns its marketplace-absent arm, `result.summary`
  at `:311` is `undefined`, `summary.resolved` at `:312` throws a `TypeError`,
  and the wide `try` converts it into a `(failed)` row whose cause reads
  `Cannot read properties of undefined`. No case would notice.
  Fix: replace the empty body with a real check that throws a typed error
  (`if (_result.kind !== "installed") throw new PluginShapeError(...)`), or narrow
  `runInstallLedger`'s return type on this call path so the assertion is
  unnecessary. Then narrow the `try` (see the graded OVERSTATED item).

- **[WARNING] `let resolution;` relies on evolving-`any` inference** — `enable-disable.ts:663`
  Declared with neither annotation nor initializer, then assigned inside a `try`
  and narrowed at `:692`. It works via TypeScript's evolving-let, but the
  variable's type is invisible at the declaration and a future `catch` that falls
  through instead of returning would silently widen it.
  Fix: `let resolution: CrossScopePluginResolution;` — the type is already
  imported at `:94`.

- **[WARNING] Two unchecked narrowing casts where a split would be free** — `enable-disable.ts:1120` (`row as EnableMsg`) and `:1128` (`row as DisableMsg`)
  `composeOutcomeRow` returns `EnableMsg | DisableMsg` and `dispatchOutcome` then
  asserts which one it got. The comments explain why the assertion holds, so this
  is not an undocumented cast — but the union is self-inflicted.
  Fix: split `composeOutcomeRow` into `composeEnableRow(): EnableMsg` and
  `composeDisableRow(): DisableMsg`, each keeping the shared `invalid-config` /
  `not-recorded` / `idempotent` / `*-failed` arms via a small shared helper
  returning `PluginFailedMessage | PluginSkippedMessage`. Both casts then delete.

## Grading of first-pass findings

### `tests/orchestrators/plugin/enable-disable.test.ts`

- **CONFIRMED** — *Discriminated-union outcomes asserted field-by-field* (BLOCKER)
  Every cited line checks out (`:2004-2009`, `:2037-2041`, `:2070-2074`,
  `:2102-2106`, `:2128-2133`, `:2311-2320`, `:2570-2577`, `:2791-2798`,
  `:2921-2925`, `:3479-3484`), and so do the two cited correct siblings
  (`:2617-2626`, `:3017-3028`). Two concrete surviving mutations the first pass
  did not name, which settle the severity:
  (a) mutating `outcomeToTypedResult`'s `idempotent` arm (`enable-disable.ts:1036-1040`)
  to `name: "wrong"` survives all three idempotent cases — none of `:2037-2041`,
  `:2070-2074`, `:2102-2106` asserts `name`;
  (b) the `error`-field sanitization gap at `:2313-2321` (filed as its own
  WARNING above). Fix as the first pass states.
- **UNDERSTATED** — *Hand-rolled, unsafely-cast `ExtensionContext`/`ExtensionAPI` doubles* (`:45-56`, `:58-86`)
  The first pass says it "is not shown to cause any current test to pass on a
  wrong implementation". It is one production edit away from exactly that, and
  the edit is plausible: the extension already reads `ctx.transcriptPath` (10
  sites), `ctx.sessionId` (10), `ctx.sessionManager` (8), `ctx.projectDir` (4)
  and `ctx.isIdle` (2). A change that made the enable path read any of them would
  get `undefined` from this double and pass; the sibling
  `notificationBoundary()` (`fetch.test.ts:101-118`) uses
  `mock<ExtensionContext>({ exactParams: true })`, which throws on an
  unexpected property access and fails loudly. Same file, same directory, opposite
  defect-detection power, across all 61 cases. Proposed severity: BLOCKER, or
  WARNING explicitly tagged as blocked behind META-FINDINGS item 1 (narrow the
  `ctx` parameter) — the mechanical `strong-mock` swap is cheap either way.
- **CONFIRMED** — *`t.mock.method()` results named `readMock` / `rmMock` / `mkdirMock` / `parseMock`* (`:3143`, `:3216`, `:3255`, `:3375`, `:3376`, `:2934`, `:3093`)
  One correction to the fix instruction: renaming to `readFile` / `mkdir` would
  shadow the `node:fs/promises` imports at `:12`. Rename for the injected failure
  instead — `deniedManifestRead`, `deniedScopeRootMkdir`, `deniedHookRollback`,
  `throwingSourceParse`.
- **CONFIRMED** — *Stub call-count assertion* (`:3136`)
  `parseMock` is a replacement stub; `assert.equal(parseMock.mock.callCount(), 1)`
  turns it into a mock, and the preceding `assert.deepStrictEqual(outcome, {…})`
  at `:3129-3134` already fully discriminates. It also makes the case brittle
  against any added `JSON.parse` anywhere in the call graph. Delete it — and note
  the whole case is scheduled for deletion under the builtin-patching BLOCKER above.
- **CONFIRMED** — *Weak secondary assertions on raw bytes* (`:2629`, `:2801`, `:3364`)
  `:3364` (`assert.notEqual(await readFile(statePath, "utf8"), "")`) is the truly
  vacuous one — `:3359-3363` already reads the record back through `loadState`
  and asserts `enabled === false`. `:2629` and `:2801` at least discriminate a
  no-save regression; the stronger replacement is to read the record and
  `deepStrictEqual` it, as `:3306-3309` does.
- **CONFIRMED** — *`assert.rejects` matched by message regex instead of `.code`* (`:912-916`, `:3310`)
  Both are correctly `await`ed, so this is a strength finding rather than a
  vacuity one. Fix as stated.

### `tests/orchestrators/plugin/fetch.test.ts`

- **CONFIRMED** — *Vacuous negative assertion as a secondary check* (`:1586`, `assert.notDeepStrictEqual(leakedTree, [])`)
  The preceding anchored regex (`:1581-1584`) already pins the rmdir-failure text
  including the staging path shape. `leakedTree` comes from `stagingEntries()`
  and its only assertion passes for any non-empty array. WARNING is the right
  severity. Better fix than deletion: `assert.strictEqual(leakedTree.length, 1)`
  plus `assert.strictEqual(leakedTree[0]?.type, "directory")` — the case's title
  claims a leak exists, so proving its shape is the point.

### `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`

- **CONFIRMED (positive)** — *Lock re-entrancy contract: verified, no finding.*
  Independently re-verified: `runEnableBranch` (`:281`) calls
  `runInstallLedger`, never `installPlugin`; `:2874` ("a held project lock returns
  lock-held …") proves the external-hold half. Matches META-FINDINGS'
  falsified-hypothesis note.
- **CONFIRMED (positive)** — *Cross-ledger import boundary: verified, no finding.*
  Re-verified: the only sibling-ledger import is `runInstallLedger` from
  `./install.ts` (`:85`); marketplace code is reached only through
  `../marketplace/shared.ts` (`:74`).
- **CONFIRMED** — *Inline `new Date()` — hidden clock dependency* (`:365`, `:400`)
  Both sites confirmed. Worth adding: the reason no case depends on `updatedAt`
  is that no case asserts it — so a mutation that stops bumping `updatedAt` on
  disable also survives. The clock parameter and an `updatedAt` assertion should
  land together.
- **OVERSTATED** — *Over-broad `try` block* (recorded as `:280-296`)
  Two corrections. The range is `:280-335`, not `:280-296`. More importantly the
  stated rationale — "none of which can throw" — is false: `result.summary` at
  `:311` is exactly the access that `assertRecordedStateLedgerInstalled`'s **empty
  body** fails to guarantee, so today the wide `try` is the only thing keeping a
  bad ledger arm from breaking the module's "never re-throws" contract. Correct
  severity: keep it as a note, but sequence it *after* the empty-`asserts` fix
  above — narrowing the `try` first would convert a misleading `(failed)` row into
  an escaping `TypeError`.
- **OVERSTATED** — *Doc-comment mood* (`:243`, `:350`, `:452`)
  The first pass itself calls this "an established house convention, not unique
  to this module". The adversarial brief asks not to re-log repo-wide JSDoc
  verb-phrase drift per file. Correct severity: drop from this area's list; it
  belongs in one repo-wide entry or nowhere.

### `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`

- **CONFIRMED (positive)** — *Network boundary: verified, no finding.*
  Independently re-verified and strengthened: `fetch.ts` is listed at
  `tests/architecture/no-orchestrator-network.test.ts:103`, so its header claim
  (`fetch.ts:9-14`) is accurate — unlike `marketplace/info.ts`, which
  META-FINDINGS §"Gates that do not gate" item 3 records as misattributing its
  gate. The `createGitOpsFake` allow-list does throw on unplanned URLs
  (`gitBoundary` at `:134-147` passes `allowedRemoteUrls`, and `:415` / `:896` /
  `:958` / `:1002` pass `[]` for the offline cases).
- **CONFIRMED (positive)** — *The seam options are the correct pattern, not a test-only export.*
  Re-verified against `FetchPluginsOptions:98-111`; `cloneCacheSeam`,
  `credentialOps` and `deviceFlowHttp` are all defaulted at use, and production
  passes none of them.
- **UNDERSTATED** — *Unexplained dynamic `import()`* (`:464`)
  The first pass frames this as a missing comment and offers "promote it to a
  top-level import" as an alternative. Both fixes are right, but the reason is
  much stronger than "unexplained": `fetch.ts` is a **gated** NFR-5 target and
  the gate's import clause only matches the static `from "…"` form, so this line
  is a working demonstration inside a guarded file that git can be reached
  invisibly. Proposed severity: BLOCKER, filed against the gate (see the first
  new finding above) with the top-level promotion as the companion cleanup.
  Also worth recording: the deferred-cost rationale the first pass hypothesises
  does not hold — `git-source-probe.ts:22` already imports `resolveStrict`
  statically and `fetch.ts` imports `git-source-probe.ts` statically at `:55`, so
  `domain/resolver.ts` is in the graph regardless. The dynamic form buys nothing.

## Still clean after attack

These are the mutations I planted and the cases genuinely caught them.

- **`fetch.ts` `authMemo` sharing (FTCH-06, `:131`)** — moving the `new Map()`
  inside `fetchOne` (per-plugin memo) fails `:760`, which asserts
  `deviceFlow.calls.requestCode` has exactly one entry and that only one
  device-flow prompt notification was emitted.
- **`fetch.ts` `pushRow` grouping key (`:143`)** — keying by marketplace alone
  instead of `${scope}:${marketplace}` fails `:864`, which deliberately seeds a
  marketplace named `same` in **both** scopes and asserts two separate blocks.
  That fixture is doing real work.
- **`fetch.ts` block ordering (`:189-191`)** — deleting the sort, or appending the
  manifest-failure blocks after it, fails `:912-931` (alpha[user] / same[project] /
  same[user] / Zulu[project]) and `:1019-1033` (broken before healthy).
- **`fetch.ts` `cardinality` (`:168`)** — inverting it fails `:386` (single, no
  tally) against `:836-845` and `:1092-1106` (plural, "Plugin fetch: 2 successes"
  / "1 failure, 1 success").
- **`fetch.ts` pinned/unpinned dispatch and its `ref` / `auth` spreads (`:372-392`)** —
  every arm is pinned by a whole-array `cache.calls` and `git.schedule`
  comparison (`:501-508`, `:577-584`, `:682`, `:1107-1111`, `:1180-1185`),
  including `auth=-` vs `auth=github.com` and `ref=-` vs `ref=v2` / `ref=main`.
- **`fetch.ts` no-op gate (`:342-347`)** — dropping the `sha !== undefined`
  condition (so unpinned warm mirrors also short-circuit) fails `:532`, which
  asserts a five-step `git.schedule` for a warm mirror.
- **`fetch.ts` `failedRow` non-`Error` handling (`:520`)** — returning a default
  instead of wrapping fails `:1386-1401` ("cause: disk exploded").
- **`fetch.test.ts` notification-count discipline** — `notificationBoundary`
  pins `ctx.ui` and `ui.notify` with `.times(expectedCalls)` and
  `pi.getAllTools()` with `.twice()`, and every case calls
  `verifyNotifications()`. An extra or missing notify, or an extra soft-dep probe,
  fails at `verify()`. This is genuinely strong and is why the file needs no
  "exactly one notification" assertions.
- **`enable-disable.ts` `severity` and reload-trailer stamping** — the 18
  whole-message cases (`:782`, `:880`, `:953`, `:1120`, `:1194`, `:1242`,
  `:1326`, `:1361`, `:1406`, `:1492`, `:1708`, `:1743`, `:2866`, `:3012`,
  `:3032`, `:3077`, `:3466`, `:3489`) catch a dropped `/reload to pick up changes`
  trailer, a swapped glyph, a changed token, a moved scope bracket and a flipped
  severity header. `:1289` ("both raises compose") catches replacing `max` with
  either individual rule.
- **`enable-disable.ts` I3 partial-cascade fold (`:364`)** — `:2329` asserts each
  of the four resource axes individually against the exact expected post-fold
  value (skills/prompts emptied, agents/mcp retained), so folding the wrong axes
  fails.
- **`enable-disable.ts` rollback-partial ordering (`:1247-1252`)** — `:3465-3477`
  compares the whole multi-line failure message including the `[hooks]` /
  `[skills]` child-row order, so reordering the partials fails.
- **`assert.equal` in both files is strict.** Both import
  `node:assert/strict` (`fetch.test.ts:1`, `enable-disable.test.ts:11`), so
  `assert.equal` / `assert.deepEqual` are `strictEqual` / `deepStrictEqual`. I
  planted the `"1" == 1` shape and it fails. No loose-comparison finding exists in
  either file.

## Not covered

- `enable-disable.messaging.ts` / `fetch.messaging.ts` and their
  `*.messaging.test.ts` suites — out of this area's scope, as in the first pass.
  I read `fetch.messaging.ts` only far enough to settle the `description`
  rendering question.
- I did not run any test, coverage, or typecheck command (the brief forbids it).
  The `skippedUpToDate` `description` finding rests on the *rendering* evidence
  (`DESCRIPTION_BEARING_STATUS.skipped === false`, `shared/notify.ts:4041`), which
  I verified directly; the accompanying claim that TypeScript's excess-property
  check does not reject the spread is from the language rule, not from a run.
  Either way the field is dead.
- The shared fakes (`tests/platform/git-ops-fake.ts`,
  `tests/platform/credential-ops-fake.ts`, `tests/domain/device-flow-fake.ts`)
  were read only for their allow-list / offline behaviour, not audited as
  test-double implementations — they are owned elsewhere.
- I did not verify whether the four modules META-FINDINGS item 5 names have
  value-returning or void switches; my correction below states only what I proved
  in `enable-disable.ts`.

## Meta-findings impact

### New cross-cutting evidence

1. **A sixth "gate that does not gate": `assertNoForbiddenSurface`'s import clause
   is blind to dynamic imports.** `tests/architecture/no-orchestrator-network.test.ts:115`
   matches only `/from\s+["'][^"']*platform\/git[^"']*["']/`. `await import("…/platform/git.ts")`
   evades it, and `fetch.ts:464` proves the form is already in use inside a gated
   file. This affects **all 12 `FORBIDDEN_TARGETS`**, including `install.ts`,
   `list.ts`, `info.ts`, `reinstall.ts` and `domain/resolver.ts`, and the shared
   helper is also used by `tests/architecture/compat-01-no-expansion.test.ts` —
   whose pattern list should be audited for the same shape. Add this to the
   "Gates that do not gate" section; it fits the repo's own "plant the violation"
   rule exactly.

2. **Builtin-module-namespace patching is a 13-file repo-wide pattern, not a
   4-file curiosity.** META-FINDINGS "Decisions" item 1 lists four files doing
   prototype surgery. `grep -rln syncBuiltinESMExports tests/` returns **13**:
   `bridges/commands/discover.test.ts`, `bridges/hooks/event-router.test.ts`,
   `bridges/hooks/stage.test.ts`, `bridges/skills/stage.test.ts`,
   `bridges/skills/unstage.test.ts`, `orchestrators/plugin/{enable-disable,fetch,info,install,reinstall,uninstall}.test.ts`,
   `orchestrators/reconcile/apply.test.ts`, `shared/path-safety.test.ts`.
   `enable-disable.test.ts` combines it with `createRequire("node:fs/promises")`
   (`:37-38`) to reach the CJS binding — a hand-rolled loader, which the skill
   forbids outright. This is a distinct workstream from the prototype-surgery
   decision and needs its own operator call: some uses are unavoidable races
   (`fetch.test.ts:1263`), most are EACCES failures reproducible with `chmod`
   (`fetch.test.ts:1546` is the in-repo reference for the honest form). The nine
   files I did not review should be checked for which category they fall into.

3. **`import assert from "node:assert/strict"` makes `assert.equal` strict — check
   every "loose `assert.equal`" finding before acting on it.** META-FINDINGS
   §"The dominant shape: sibling drift" names `clone-cache.test.ts` for "loose
   `assert.equal`". `head -3 tests/orchestrators/plugin/clone-cache.test.ts` shows
   `import assert from "node:assert/strict"`, under which `assert.equal` **is**
   `strictEqual`. That finding is very likely a false positive; the same check
   should be run against every file where a reviewer reported loose comparison.

4. **"An assertion inside a stub is not an assertion."** `fetch.test.ts:726` is a
   clean instance: the case's only proof lives in a collaborator stub that a
   plausible mutation stops calling. This shape is invisible to a reader scanning
   assert-block lines, so it will not have been caught systematically. Worth
   sweeping every file that puts `assert.*` inside a fake's method body, with the
   fix being a post-act call-log comparison (`fetch.test.ts:791/824` is the model).

### Corrections to META-FINDINGS.md

- **§"Ranked by leverage" item 5 (Restore exhaustiveness on closed-union switches).**
  The claim is "adding a member to a closed set compiles clean at every derivation
  site." That is **not** true of a *value-returning* switch under this repo's
  compiler settings. `enable-disable.ts` has two such switches with no `default`
  (`outcomeToTypedResult:1025-1075`, `composeOutcomeRow:1265-1348`) and both are
  compile-protected: an added `SetEnabledOutcome` member without an arm makes the
  function lack an ending return statement (TS7030/TS2366), which the repo already
  recorded in `switch-exhaustiveness-ts7030.md`. Before applying the
  "silent-omission" framing to `reconcile/plan.ts`, `reconcile/apply.ts`,
  `install.messaging.ts` and `reinstall.messaging.ts`, check whether each switch
  returns a value or is `void` — only the `void` ones are silently extensible.
  (I confirmed `plan.ts` and `apply.ts` carry no `assertNever` or `default:`, but
  did not check their return types.)

- **§"Ranked by leverage" item 3's table is missing `enable-disable.test.ts`.**
  17 fragment-assertion sites, 4 of them (`:1797`, `:1853`, `:2274`, `:2403`)
  matching nothing but `/\(installed\)/` or `/\(failed\)/`, with the correct
  whole-message form used 18 times in the same file. Add the row; the file is
  comparable in scale to `marketplace/update.test.ts` (~20 cases).

- **§"Patterns to propagate" — add a row for the `ctx` double.**
  `fetch.test.ts:101-118`'s `notificationBoundary()` is the in-repo reference
  implementation for item 1's fix: `mock<ExtensionContext>({ exactParams: true })`
  + a locally-declared narrow `NotificationUi` type + `verify()` per case, with
  **zero** `as never` casts. Any file being converted off `as ExtensionContext`
  should copy it. Its sibling `enable-disable.test.ts:45-56` is the counterexample
  in the same directory.

- **§"Notes on the method" — one more falsified suspicion.** The dispatch lead
  that `fetch.ts:464` hides `await import(".../platform/git.ts")` is refuted; the
  import is `domain/resolver.ts`. Recording it because the brief asks for clear
  refutations, and because the investigation it prompted produced item 1 above.

### Confirmations

- **§"Ranked by leverage" item 2, `bridges/hooks/routing-state.ts` row —
  independently confirmed from a fourth angle.** `enable-disable.test.ts` imports
  `resetRoutingState` and `setParsedConfig` at `:3212` and `:3320` and calls
  `resetRoutingState()` at `:3219`, `:3314`, `:3325` and `:3366`. It also uses the
  production mutator `setParsedConfig` (`:3253`, `:3341`) to plant a poison cache
  entry — a second production export serving as a test seam. Both cases are
  reachable only through that seam, which strengthens the case for factory-owned
  state over a reset hook.
- **§"Patterns to propagate", "Offline fake that fails loudly" — confirmed.**
  `createGitOpsFake({ boundary: "memory", allowedRemoteUrls })` is threaded
  through `gitBoundary()` (`fetch.test.ts:134-147`) in every case, and the offline
  cases pass `allowedRemoteUrls: []` (`:415`, `:896`, `:958`, `:1002`) so a
  network reach would throw rather than silently pass. Worth keeping at the top of
  the propagate list.
- **§"Gates that do not gate" item 3 — the *inverse* confirmed for `fetch.ts`.**
  Unlike `marketplace/info.ts`, `fetch.ts`'s header comment (`:9-14`) names its
  gate correctly and the file really is in `FORBIDDEN_TARGETS` (`:103`). The
  recommended "audit every architectural gate against what it actually scans"
  should therefore check both directions — misattributed location *and*
  under-matching pattern.
