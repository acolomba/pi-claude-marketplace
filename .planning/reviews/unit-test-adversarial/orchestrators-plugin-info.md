# Orchestrators — plugin info

**Scope:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` (2378 lines) paired
with `tests/orchestrators/plugin/info.test.ts` (6980 lines). `info.messaging.ts` /
`info.messaging.test.ts` are excluded per assignment (owned by another reviewer).
**Test files reviewed:** 1 (129 `test()` cases, read in full)
**Production modules reviewed:** 1 (read in full)

## Summary

The suite is disciplined where it matters most: no `describe()`, no `before()`/shared fixtures, no
`.only`/`.skip`, real `strong-mock` doubles (`exactParams: true`) for `ctx`/`pi`/`ui`, real fakes
(`createGitOpsFake`/`createCredentialOpsFake`) for stateful boundaries, hermetic temp `HOME`/`cwd`,
and AAA comments on all 129 cases. About two-thirds of the cases pin the *entire* rendered
notification with `assert.equal`/`assert.deepEqual` against a hand-written literal — exactly the
pattern this review is supposed to reward. The two systemic problems are: (1) a substantial minority
of cases (33 of 129) abandon whole-value comparison for `assert.match`/`assert.doesNotMatch` on a
regex fragment, which measurably lets wrong renders through (concrete counter-example below), and
(2) `strong-mock` `verify()` calls are pushed into a module-scope array and fired from a shared
`finally` block rather than inline at the end of each case, which is the exact "verify() hidden in a
hook or shared cleanup" anti-pattern the skill calls out, with a real risk of masking the real
assertion failure. The production module is clean on architecture (no git-surface import, confirmed
by grep and by the architecture test) but carries a dangling comment from a since-removed test-only
export and a couple of avoidable `as` casts. Given the test file's own section comments already read
like a responsibility map, splitting `info.ts` along those lines (see the last section) would let the
test file split too, which is the more important payoff.

## Unit test findings

### `tests/orchestrators/plugin/info.test.ts`

- **[BLOCKER] 33 of 129 cases assert only a regex fragment, never the whole rendered message** —
  representative: `line 1212` (`WR-02: not-installed plugin with malformed plugin.json ...`),
  `line 4652` (`RSTA-01: uninstalled url-source plugin with a cold clone ...`), `line 4688`,
  `line 4721`, `line 4754`, `line 4899`, `line 4937`, `line 5045`, `line 5115`, `line 5163`,
  `line 5450`. Full list of first lines: 705, 1212, 1270, 1392, 1439, 1481, 1517, 1556, 3776, 3920,
  4345, 4399, 4465, 4508, 4557, 4609, 4652, 4688, 4721, 4754, 4803, 4855, 4899, 4937, 4984, 5045,
  5115, 5163, 5261, 5318, 5384, 5450, 5495.

  These are the *only* cases in the file that skip the whole-message `assert.equal`/`assert.deepEqual`
  pattern used everywhere else. Concretely, `line 4652` seeds a manifest entry with
  `description: "Git-source plugin; not installed."` and `dependencies: ["dep@mp"]`, but the
  assertions only check `/◌ gplug v1\.0\.0 \(remote\)/`, `/components: not resolved/`, and the
  absence of `(available)`/`(unavailable)`. A renderer that dropped the description line, rendered it
  in the wrong position, mis-rendered `dependencies`, printed the wrong marketplace header, or
  duplicated a line would still pass. Compare with `line 1652` (`NFR-5 end-to-end: github-source
  marketplace record ...`), which seeds an equally rich fixture and pins the *entire* three-line
  message with `assert.equal` — proving the tighter form is achievable for the same shape of case.
  `line 1212` is the sharpest instance: its own comment says "Either outcome of `resolveStrict` ...
  is acceptable," so the test deliberately does not pin which closed-set reason token renders, only
  that it isn't the literal string `unreadable`. A third, currently-unlisted reason token would also
  pass.

  Fix: for each of these, replace the `assert.match`/`assert.doesNotMatch` pair with a single
  `assert.equal(notifications[0]!.message, [...].join("\n"))` (or `assert.deepEqual(notifications,
  [...])`, the form used from `line 6120` onward) enumerating every line the fixture is known to
  produce, the same way the surrounding cases in the same section already do. Where a case
  legitimately cannot know the exact reason token (none currently do — even the D-81-04/FTCH-06
  fetch-failure cases know the exact classified reason), keep the loosened assertion but say so in
  the test's own comment, as `line 1212` already does, and treat that one as an accepted, named
  exception rather than the template for the other 32.

- **[BLOCKER] `verify()` for the `strong-mock` doubles is hidden in a shared `finally`, not inline in
  each case** — `line 238` (module-scope `pendingInteractionVerifications: Array<() => void> = []`),
  populated in `makeCtx` (`lines 260–264`: `pendingInteractionVerifications.push(() => { verify(ctx);
  verify(pi); verify(ui); })`), drained in `withHermeticHome`'s `finally` (`lines 282–284`). No test
  body ever calls `verify()` itself.

  This is the literal shape the skill forbids: "`verify(mock)` for every mock, at the end of the
  case, after result and state assertions — never hidden in a hook or shared cleanup ... no
  ... process-wide registry." Beyond the readability problem, it has a correctness risk: in an async
  function, if the `try` body throws (e.g. a failed `assert.equal` on the rendered message) and the
  `finally` block's `verifyInteractions()` call also throws (plausible, since a wrong message body
  often means `ui.notify`/`ctx.ui`/`pi.getAllTools` were not called the expected number of times
  either), the `finally`'s throw replaces the original one. The developer sees a `strong-mock`
  verification failure instead of the actual, more informative assertion failure that pinpoints what
  the renderer got wrong.

  Fix: drop the module-scope array and the `finally`-based flush. Have `makeCtx()` return the mocks
  plus nothing else, and add `verify(ctx); verify(pi); verify(ui);` as the last three lines of every
  test body, after the result assertions — mechanical but required in all 129 cases (or export a
  `verifyCtx({ctx, pi, ui})` helper called explicitly at the end of each case, still inline in the
  test body rather than via a lifecycle hook).

- **[WARNING] One assertion of a message *prefix* alone where a full-equality assertion was cheap and
  used one line below** — `test('plugin info manifest absent: D-96-04: with autoupdate OFF the
  skip-note header omits the marker the info block spells', ...)`, `lines 3557–3560`:
  `assert.ok(notifications[0]!.message.startsWith("● mp [user] <no autoupdate>\n"), ...)`. The very
  next assertion (`line 3561`) pins `notifications[1]!.message` exactly via `assert.equal`. The first
  block's remaining two lines (`"  ● alpha v1.0.0 (installed) {not in manifest}"`,
  `"    skills: alpha-skill"`) are already known from `STATE_ONLY_BLOCK` a few lines above (defined at
  `line 3085`) — reuse that constant here (`assert.equal(notifications[0]!.message,
  STATE_ONLY_BLOCK)`) instead of `startsWith`.

- **[WARNING] Lower-bound-only call-count assertions on the git-ops fake instead of an exact count** —
  `line 5105` (`assert.ok(gitState.cloneCalls.length >= 1, ...)`), `line 5374`, `line 5439`,
  `line 5440`. A call count "at least 1" is not a promise (per the skill's stub/spy table, a call
  observation should assert what actually happened, not merely that it happened at all); a
  regression that clones twice per render (e.g. a caching bug) would not be caught. Replace with
  `assert.equal(gitState.cloneCalls.length, 1, ...)` (or whatever the exact expected count is for
  each fixture) unless the case has a documented reason the count can legitimately vary.

### Clean files

- No other files in scope (only `info.test.ts` was assigned; `info.messaging.test.ts` is excluded).

## Production code findings

### `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`

- **[WARNING] Dangling comment describes a test-only export that no longer exists** — `lines
  2376–2378`. The trailing comment ("Test-only re-export of the shared classifier so callers
  exercising this orchestrator's behavior can verify the closed-set ladder without reaching into
  `shared/probe-classifiers.ts` directly.") originally sat above `export { narrowProbeError as
  __test_narrowProbeError };` (present as of commit `47a63f719`). That export line is gone — `grep -n
  "^export" info.ts` shows no such export, and `grep -rn __test_narrowProbeError` across the repo
  returns nothing — but the three-line comment was left behind, now describing code that is not
  there. This violates the project's own comment policy (no narration of code that no longer exists)
  and, more importantly, it is actively misleading: a reader would look for a re-export that isn't
  there. Delete the comment block. (Nothing left to fix on the export itself — its removal is a
  correct outcome, since a test-only re-export is exactly the kind of test-only production surface
  the skill flags.)

- **[WARNING] Redundant `as Record<string, unknown>` casts on `entry`** — `line 838`
  (`normalizeDependencies((entry as Record<string, unknown>).dependencies)`), `line 845`
  (`parsePluginSource((entry as Record<string, unknown>).source)`), `line 1319`
  (`asDeclaredList((entry as Record<string, unknown>)[kind])`). `entry` is typed
  `MarketplaceManifest["plugins"][number]` (`PluginEntry`, `domain/components/plugin.ts`), whose
  schema already declares `source: Type.Unknown()` (line 67), `dependencies:
  Type.Optional(Type.Unknown())` (line 83), and `skills`/`commands`/`agents`: all three
  `Type.Optional(Type.Unknown())` (lines 30–32). `entry.source`, `entry.dependencies`, and
  `entry[kind]` for `kind: "skills" | "commands" | "agents"` are therefore already typed
  `unknown`/`unknown | undefined` without any cast. Per the Google guide, `as` needs "an obvious or
  commented reason"; here there is none, and the cast can simply be deleted at all three sites
  (`entry.dependencies`, `entry.source`, `entry[kind]`).

- **[WARNING] Testability: two ambient global reads buried inside `parseHooksForInfo`, inconsistent
  with the sibling reader in the same file** — `line 397` (`homedir()` from `node:os`) and `line 437`
  (`process.cwd()`), both inside/around `parseHooksForInfo` (`lines 396–400`) and its manifest-backed
  caller `readHookSummaryEntries` (`lines 426–442`). Both reads are documented as currently inert
  (`skipIfMap: true` means `compileIf` is never invoked and `ifCtx` is never read — see the comment at
  `lines 431–436`), but they are still a hidden dependency on ambient process state read from inside
  logic rather than accepted as a parameter, and the file already has the fix pattern next to it: the
  sibling state-only reader `readStateOnlyHookEntries` (`line 476`) takes `cwd` as an explicit
  parameter and threads it into `parseHooksForInfo(raw, cwd)` (`line 499`), while
  `readHookSummaryEntries` hardcodes `process.cwd()` instead of accepting `cwd` from its own caller
  chain. If `skipIfMap` is ever dropped (the comment names this as the future trigger), this
  inconsistency becomes live behavior instead of a latent one. Fix: thread `cwd` from `buildBlock`
  (which already has it) through `composeResolvedComponents` into `readHookSummaryEntries`, the same
  way it already reaches `readStateOnlyHookEntries`, and drop the inline `process.cwd()` call.

- **[WARNING] Testability: no injectable I/O port for `readdir`/`readFile`, forcing the paired test to
  monkey-patch `fs.promises` globally** — `line 27`
  (`import { readdir, readFile } from "node:fs/promises";`), used directly throughout
  (`readEntriesOrEmpty`, `readHookSummaryEntries`, `readStateOnlyHookEntries`,
  `readLenientHooksFile`). Because there is no seam, `tests/orchestrators/plugin/info.test.ts`'s
  `withFsPromiseFault` helper (`lines 72–105`) simulates EACCES/EPERM failures by calling
  `Object.defineProperty(fs.promises, method, ...)` plus `syncBuiltinESMExports()` to monkey-patch the
  real global module — used 8 times in the test file (permission-denied and unreadable-file cases).
  This mirrors exactly the pattern this file already solved for git ops: `InfoCloneCacheSeam`
  (`lines 148–152`) injects `resolvePluginPin`/`materializePluginClone`/
  `materializeOrRefreshPluginMirror` as an optional dependency defaulting to the real imports
  (`buildInfoFetchContext`, `lines 161–177`). The same shape — an optional `fsOps?: { readdir,
  readFile }` parameter defaulting to the real `node:fs/promises` functions — would let the 8
  permission-failure cases inject a throwing stub instead of reaching into the global `fs.promises`
  object, which is more fragile (relies on `syncBuiltinESMExports` ESM internals) than a normal
  dependency injection.

### Clean files

- (n/a — single production module in scope; findings above are the complete list.)

## NFR-5 network-boundary check

`info.ts` imports no `platform/git.ts`, `gitOps`, or `DEFAULT_GIT_OPS` symbol (confirmed by grep: the
only textual hits are inside the file-header comment listing the forbidden names). The real gate for
this is `tests/architecture/no-orchestrator-network.test.ts`, whose `FORBIDDEN_TARGETS` array
explicitly includes `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` (confirmed by
grep) and source-greps it for the forbidden import surface — that test, not `info.test.ts`, is what
would fail if a future change added a direct git import to this file.

`info.test.ts` additionally proves the *behavioral* half of NFR-5 with real assertions, not just
comments: it constructs `makeMockGitOps`/`makeMockCredentialOps` fakes, injects them as
`cloneCacheSeam`/`credentialOps`, and asserts `gitState.cloneCalls.length === 0` /
`gitState.fetchCalls.length === 0` / all three credential-call counters `=== 0` for bare `info` (no
`--fetch`) across several fixture shapes, including a COLD git-source plugin (`line 5163`), a
state-only manifest-absent record (`lines 3091, 3145, 3188`), and a disabled record (`lines 3249,
3333`). A regression that made bare `info` call through the *existing* injected seam (e.g. by
threading `fetchCtx` into an arm that should stay fs-only) would fail these specific assertions. A
regression that instead added a brand-new, un-injected import of `platform/git.ts` would not be
caught by `info.test.ts` (nothing there can intercept an import), but would be caught by
`no-orchestrator-network.test.ts`'s grep gate. Between the two, NFR-5 is genuinely proven for this
pairing — neither test alone is sufficient, but together they cover both the "wrong import" and the
"right import, wrong control flow" regression shapes.

## Should `info.ts` be split?

Yes. 2378 production lines paired with 6980 test lines (a ~1:2.9 ratio, well above the rest of this
codebase's typical pairing density) is itself a signal, and the test file's own section-comment
banners already partition the cases along production responsibility lines that do not overlap much
in what they exercise:

- **Component/dependency discovery** — `discoverComponentNames`, `nameFromEntry`,
  `readEntriesOrEmpty`, `composeResolvedComponents`, `deriveLenientComponentPaths`,
  `asDeclaredList`, `sortComponentNames`, `normalizeDependencies` (`lines 264–344`, `649–702`,
  `1297–1344`). Tested by the PR-5 sort-precondition, `normalizeDependencies`, and dependency-render
  cases (roughly `lines 1476–1643`).
- **Hooks reading/projection** — `parseHooksForInfo`, `readHookSummaryEntries`,
  `readStateOnlyHookEntries`, `readLenientHookSummary`, `readLenientHooksFile`,
  `parseLenientHooksJson`, `projectDroppedHookEntries`, `StateOnlyHookRead` (`lines 357–632`). This is
  the single largest test cluster by far — the SURF-01/PHOOK-05/D-96-03/INFO-11-hooks sections
  (roughly `lines 1953–2789`, `3825–4640`) are almost entirely about this sub-concern and barely touch
  git sources or the disabled-row machinery.
- **Git-source fetch/probe** — `InfoFetchContext`, `InfoCloneCacheSeam`, `buildInfoFetchContext`,
  `GitProbe`, `makeFetchProbe`, `foldFetchOrProbeError`, `buildInstalledGitRow`,
  `buildGitNotInstalledRow`, `buildWarmGitNonInstallableRow` (`lines 148–177`, `1413–1925`). This is
  the RSTA-*/FTCH-*/D-78-04/D-81-*/D-80-04 section, `lines 4643–5924` — over 1200 test lines on its
  own, and it is the one cluster with a genuine, separate NFR-5 story (see above).
- **State-only (manifest-absent) row** — `buildStateOnlyInstalledRow`, `composeStateOnlyComponents`,
  `derivePersistedInstalledStatus` (`lines 1104–1237`). Tested by the "plugin info manifest absent:
  INFO-09/INFO-10/INFO-11/D-100-03" cluster, `lines 1793–2358`.
- **Disabled/install-disabled row shaping** — `InfoBlock`, `applyDisabledRowShape`,
  `DISABLED_ROW_REASONS`, `applyInstallDisabledRowShape`, `INSTALL_DISABLED_ROW_STATUSES`,
  `skipReasonFor`, `buildFetchSkipBlock`, `SkipSource`, `emitFetchSkip`, `autoupdateDetails`
  (`lines 728–1102`, `2105–2237`). Tested by the D-100-08/ENBL-*/D-96-04/OUT-03 clusters,
  `lines 1735–1792`, `2599–3774`, `5539–6119`.
- **Orchestration core** — `getPluginInfo`, `buildBlock`, `wrapBlock`, `derivePluginRootForInfo`,
  `isLocallyResolvable`, `isGitSource`, and the remaining path-source row builders
  (`buildInstalledRow`, `buildNotInstalledRow`, `buildAvailableRow`, `buildNonPathInstalledRow`,
  `buildNotInstallablePathRowFields`, `buildNonInstallableRowFields`, `buildNotInstalledPathRow`,
  `buildNotInstalledNonInstallableRow`) — the thinnest reasonable core, left in `info.ts` itself.

A split into `info.ts` (orchestration core), `info-components.ts`, `info-hooks.ts`, `info-git.ts`,
`info-state-only.ts`, and `info-row-shape.ts` — each with its own paired `*.test.ts` — would turn one
7000-line test file into six files in the 400–1300 line range that each exercise one coherent
production concern, without changing any public behavior. This is a design recommendation, not a
gate failure: nothing here indicates the current file fails fallow's per-function health thresholds
(the finding is about file-level navigability of a single 7000-line test file, not per-function
complexity).

## Not covered

- `info.messaging.ts` / `info.messaging.test.ts` — explicitly out of scope per assignment.
- `tests/platform/git-ops-fake.ts`, `tests/platform/credential-ops-fake.ts`, and
  `tests/edge/handlers/marketplace-seed.ts` — imported by `info.test.ts` as shared fakes/seed
  helpers, but not read in full since they are not the assigned pairing and are presumably shared
  across multiple orchestrator test files owned by other reviewers in this sweep.
- Toolchain commands (`npm run check`, `node --test`, coverage) were not run per the review brief's
  instruction to review by reading only.
