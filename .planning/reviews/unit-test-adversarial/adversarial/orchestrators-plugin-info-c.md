# Orchestrators — plugin info (slice C) — adversarial re-review

**Scope:** `tests/orchestrators/plugin/info.test.ts` lines 4197–6980 (56 cases: the
INFO-05 path-source not-installable enumeration block, the lenient/strict hooks
readers, the RSTA-*/PURL-08/NFR-5 git-source cluster, the FTCH-03/FTCH-06/D-81-04
`--fetch` block, the OUT-03 `installs disabled` admission matrix, and the
whole-message tail block from 6120 to end), plus the arms of
`extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` those cases
exercise (`isGitSource`, `buildGitNotInstalledRow`, `buildRemoteNotInstalledRow`,
`buildWarmGitNonInstallableRow`, `buildInstalledGitRow`, `buildInfoFetchContext`,
`makeFetchProbe`, `foldFetchOrProbeError`, `buildAvailableRow`,
`buildNotInstalledPathRow`, `buildNotInstalledNonInstallableRow`,
`buildNotInstallablePathRowFields`, `buildNonPathInstalledRow`,
`composeResolvedComponents`, `discoverComponentNames`, `nameFromEntry`,
`readEntriesOrEmpty`, `readLenientHookSummary`, `readLenientHooksFile`,
`parseLenientHooksJson`, `readHookSummaryEntries`, `projectDroppedHookEntries`,
`deriveLenientComponentPaths`, `asDeclaredList`, `normalizeDependencies`,
`applyInstallDisabledRowShape`, `INSTALL_DISABLED_ROW_STATUSES`, and the
`getPluginInfo` two-scope tail).
Supporting context read outside the range: the test-file preamble and helpers
(1–700), the dependency-render case (1601–1643), `shared/probe-classifiers.ts` in
full, `edge/handlers/plugin/info.ts` (the sole production caller), and the
in-range cross-checks the slice-B file flagged.
**First-pass file:** `unit-test-findings/orchestrators-plugin-info.md`
**Clean files attacked:** 0 declared — the first pass listed no clean files for
this area, so every production arm the slice reaches was attacked with the
mutation catalogue directly (see Branch census).
**Existing findings graded:** 8 (4 test + 4 production)

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 3 |
| New WARNING (missed by first pass) | 9 |
| Existing CONFIRMED | 4 |
| Existing UNDERSTATED | 3 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 1 |

## New findings — from the mutation attack

### `tests/orchestrators/plugin/info.test.ts`

- **[BLOCKER] The NFR-5 "no `plugin-clones/` was created" proof is vacuous — the
  assertion cannot fail for any implementation** — `lines 5001–5026`, in
  `test('NFR-5: info renders an uninstalled git plugin `(remote)` with no
  plugin-clones dir on disk (no clone, no network)')`.

  The case probes directory existence with `await readFile(clonesDir)` inside a
  `try`, setting the flag to `false` in the `catch`. `readFile` on an **existing
  directory** throws `EISDIR`, so the catch fires and the flag reads `false`
  exactly as it does for a missing path. Verified with a standalone Node check:
  an existing directory yields `EISDIR` and a missing path yields `ENOENT`, and
  both drive the identical branch. Therefore `assert.equal(clonesAfter, false,
  "info must not create plugin-clones/ (NFR-5)")` at `line 5026` passes whether
  or not the render created the directory, and the pre-condition
  `assert.equal(clonesExisted, false)` at `line 5009` is equally inert. The one
  assertion this case exists for is unfalsifiable; the only live check left is
  the `(remote)` regex at `line 5016`, which the sibling at `line 5163` already
  makes.

  Fix: replace both probe blocks with a real existence check that discriminates.
  Import `stat` from `node:fs/promises` and write
  `await assert.rejects(stat(clonesDir), (err: NodeJS.ErrnoException) => err.code
  === "ENOENT")` before and after the act, deleting the `clonesExisted` /
  `clonesAfter` booleans. (`stat` on an existing directory resolves, so the
  assertion goes red the moment the directory is created.) While there, add the
  missing `assert.equal(notifications.length, 1)` before the `notifications[0]!`
  read at `line 5014`, and move the `// assert` marker above that read.

- **[BLOCKER] The `dependencies:` line is never asserted on either git-source row
  — two production spreads have no case anywhere in the repo** —
  `info.ts:1771` (`buildRemoteNotInstalledRow`) and `info.ts:1553`
  (`buildInstalledGitRow`'s installable arm); the fixtures that should own them
  are `info.test.ts:4669` (RSTA-01 cold `(remote)`) and `info.test.ts:4955`
  (RSTA-04 warm `(installed)`).

  A repo-wide grep for a pinned `dependencies:` output line returns exactly two
  sites — `info.test.ts:1639` (path-source `(installed)`, which owns
  `info.ts:1645`) and `info.test.ts:6976` (path-source `(available)`, which owns
  `info.ts:2090`). Three cases deliberately seed `dependencies: ["dep@mp"]`
  (`4669`, `4772`, `4955`) and **none** of the three asserts the resulting line;
  `4772` at least shares a covered code site with `6976`, but `4669` and `4955`
  do not. Deleting `...(dependencies !== undefined && { dependencies })` from
  `info.ts:1771` and from `info.ts:1553` leaves the whole suite green while a
  user loses the dependency list on every remote and every warm-installed git
  plugin. The seeded-but-unasserted fixture field is the tell: the cases were
  written to exercise this and the assertion never landed.

  Fix: convert `4652` and `4937` to the whole-message form the tail block uses,
  enumerating the `dependencies: dep@mp` line. For `4652` the full expected body
  is `["● mp [user] <no autoupdate>", "  ◌ gplug v1.0.0 (remote)", "    Git-source
  plugin; not installed.", "    components: not resolved", "    dependencies:
  dep@mp"].join("\n")`; for `4937` it is the `(installed)` header plus
  `"    Installed warm plugin."`, `"    agents: inst-agent"`,
  `"    skills: inst-skill"`, `"    dependencies: dep@mp"`. Either that, or
  delete the unused `dependencies` field from those two fixtures — but do not
  leave a seeded field with no assertion.

- **[BLOCKER] A `--fetch` failure on a *partially-installed* git plugin silently
  drops the persisted `{lsp}` marker; the reason-composition spread has no
  case** — `info.ts:1567`
  (`reasons: [...(base.reasons ?? []), foldFetchOrProbeError(err)]`); the nearest
  covering case is `info.test.ts:5261`, whose record carries no `unsupported`
  list, so `base.reasons` is `undefined` in every case that reaches this line.

  `grep -n 'unsupported: \[' info.test.ts` shows seven seeds, none of them on a
  git-source record combined with `fetch: true` and a throwing clone. Mutating
  `info.ts:1567` to `reasons: [foldFetchOrProbeError(err)]` leaves all 129 cases
  green, yet a real user with a git plugin whose install dropped `lspServers`
  would see `(partially-installed) {network unreachable}` instead of
  `(partially-installed) {lsp, network unreachable}` — the durable install fact
  is replaced by the transient one. The ordering promise (`base.reasons` first,
  fetch reason appended) is likewise unpinned.

  Fix: add one case modelled on `5261`, changing its seed to
  `installed: { gplug: { version: "1.0.0", unsupported: ["lspServers"] } }` and
  pinning the whole message with `assert.equal`:
  `["● mp [user] <no autoupdate>", "  ◉ gplug v1.0.0 (partially-installed) {lsp,
  network unreachable}", "    components: not resolved"].join("\n")`.

- **[WARNING] Two of the three `readLenientHookSummary` root-shape guards have no
  case** — `info.ts:573` (`typeof data !== "object" || data === null || !("hooks"
  in data)`). Only the third disjunct is exercised, by
  `test('lenient hook inventory ignores a nonobject root exactly')` at
  `line 6120`, whose payload is `"[]"` — an object, non-null, without a `hooks`
  key. No case writes a scalar or `null` JSON root, and `hooks/hooks.json` is
  arbitrary external content, so both are reachable. Deleting `typeof data !==
  "object" || data === null` from the guard is observable: `"hooks" in 5` and
  `"hooks" in null` both throw `TypeError`, which propagates out of
  `composeResolvedComponents` into `buildNotInstallablePathRowFields`' catch and
  renders `{unsupported hooks, unreadable}` + `components: not resolved` instead
  of the clean two-line row — and every case stays green. The case's own title
  ("nonobject root") describes an input it does not actually use.

  Fix: add two siblings copied verbatim from `6120`, writing `"null"` and `"5"`
  as the hooks payload, each pinning the same two-line
  `assert.deepEqual(notifications, [...])` body that `6120` pins. Rename `6120`
  to name what it really covers (a rootless-`hooks` object).

- **[WARNING] Four of the eight `INSTALL_DISABLED_ROW_STATUSES` keys are
  unreachable, and the three cases whose titles claim to prove them cannot
  fail** — `info.ts:1029–1032` (`installed`, `partially-installed`, `disabled`,
  `failed`); cases at `info.test.ts:5979`, `6030`, `6069`.

  `applyInstallDisabledRowShape` has exactly one call site
  (`grep -rn applyInstallDisabledRowShape extensions/` → `info.ts:895`), on the
  `buildNotInstalledRow` result. Enumerating that subtree's return sites, the
  only statuses it can produce are `available`, `remote`, `partially-available`
  and `unavailable`. Flipping `installed`, `partially-installed`, `disabled` or
  `failed` from `false` to `true` in the map therefore leaves all three cases
  green — they route through arm (c) / `applyDisabledRowShape`, never through the
  map at all. The cases' own comments say so honestly ("clean STRUCTURALLY, not
  by a runtime guard"); the **titles** ("never acquires `installs disabled`,
  however the entry declares") overclaim. The map's totality is deliberate and
  correctly documented at `info.ts:998–1007` as a compile-time guard — do not
  delete the dead keys.

  Fix: retitle the three cases to name what they do prove — e.g.
  `'OUT-03: the install-time claim is applied at the not-installed consumer only,
  so an (installed) row cannot carry it'` — and add one sentence to the map's doc
  comment recording that four keys are unreachable through the sole consumer and
  exist for the compile-time guarantee alone. The four reachable keys are each
  proven (`5554`, `5718`, `5826`, `5933`); say so there.

- **[WARNING] The clone-cache seam double is hand-rolled with a manual call
  counter where `strong-mock` is the sanctioned tool** —
  `lines 6823–6841, 6857`, in `test('an explicit fetch whose second
  materialization fails folds the warm resolver error')`. The literal implements
  `InfoCloneCacheSeam` with a `materializations` counter and drives the failure
  off `if (materializations === 2)`; `assert.equal(materializations, 2)` at
  `6857` then asserts the call count, which is the mock role, not the stub role
  the literal occupies. The two unused members reject with
  `"pinned materialization was not expected"` — a good fail-loud choice, but
  spelled by hand.

  Fix: build the seam with `mock<InfoCloneCacheSeam>({ exactParams: true, name:
  "clone cache" })` inside the case, state the two mirror calls explicitly —
  `when(() => seam.materializeOrRefreshPluginMirror(It.containsObject({ cloneUrl
  }))).thenResolve({ pluginRoot: mirrorDir, resolvedSha: "a".repeat(40)
  }).once()` followed by a second `when(...).thenReject(Object.assign(new
  Error("mirror became unreadable"), { code: "EACCES" })).once()` — leave
  `resolvePluginPin` / `materializePluginClone` with no expectations as the
  silence proof, and end the case with `verify(seam)` after the
  `assert.deepEqual` on `notifications`. That deletes the counter and the
  `assert.equal(materializations, 2)` line, because `verify` now carries the
  count.

- **[WARNING] `fetch: true` runs that inject no seams fall back to the real
  clone-cache and credential ports** — `line 6377`, in
  `test('state-only fetch safely constructs default ports without invoking
  them')`; the same shape recurs at `2865`, `2935`, `3020`, `3459`, `3503`,
  `3552`, `3620`, `3656`, `3695`, `3737` (slice B's range). These cases exercise
  `buildInfoFetchContext`'s production default arm (`opts.cloneCacheSeam ?? {
  real imports }`, `opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS`) — genuinely
  useful coverage no other case has — but assert nothing about non-invocation.
  Construction is safe today only because the state-only / disabled arms never
  call the ports; the moment a regression does, the case attempts a real network
  clone and a real `git credential` subprocess instead of failing red. The
  sibling form that gets this right is `3091` / `3145` / `3188`, which inject
  `fetchSeamWith(gitOps)` + `makeMockCredentialOps()` and pin all five counters
  at zero.

  Fix: keep exactly one case on the production defaults (this one, since it owns
  `buildInfoFetchContext`'s `??` arms) and state that ownership in a comment;
  convert the other ten to the `3091` form. On the retained case, add a
  `t.after()`-registered guard or leave a comment naming the production property
  it depends on, so the live-boundary risk is recorded rather than implicit.

- **[WARNING] AAA marker drift inside one file: 19 tail cases place `// arrange`
  outside the `withHermeticHome` callback, and two cases have no top-level
  markers at all** — outside-the-callback: `6121`, `6154`, `6191`, `6228`,
  `6272`, `6313`, `6357`, `6403`, `6458`, `6506`, `6550`, `6589`, `6640`, `6690`,
  `6743`, `6796`, `6871`, `6909`, `6945`. No top-level markers: `5650`
  (`DFEN-04 / DFEN-05`, whose only AAA comments live inside the `rowFor`
  closure). Second act/assert pair unmarked: `5611–5646` inside `5554`. The
  file's own majority form — `await withHermeticHome(async ({ home, cwd }) => {
  // arrange` — is at `4203`, `4258`, `4306` and ~40 other cases.

  Fix: move the `// arrange` marker inside the callback in all 19 tail cases, add
  `// arrange` / `// act` / `// assert` to `5650`'s body, and mark `5554`'s
  second render.

- **[WARNING] Two cases run several independent renders sequentially in one
  case** — `5554` (two renders: `dis`, then `ena`) and `5650` (three renders via
  `rowFor`: `yes`, `no`, `mute`). Each render is an independent behavior with its
  own expected bytes, so a failure on the first hides the rest, and each call to
  `makeCtx()` pushes another closure onto the module-scope verification array
  (see the confirmed first-pass `verify()` finding). `5554`'s cross-render
  line-by-line diff at `5636–5646` is a genuine third assertion and should stay
  in one case; `5650`'s three rows are pure siblings.

  Fix: split `5650` into three `test()` cases over a typed row list
  (`{ plugin: "yes", expectedRow: "  ○ yes v1.0.0 (available)" }`, …) with one
  sibling `test()` per row, hoisting the shared seed into a local `seed(cwd)`
  helper called inside each case. Leave `5554` as one case but mark its second
  render's phases.

- **[WARNING] Redundant fragment assertion immediately preceding the full
  equality it duplicates** — `line 5249`
  (`assert.ok(msg.includes("(remote) {installs disabled}"), msg)`), superseded
  one line later by the `assert.equal(msg, [...].join("\n"))` at `5250–5257`.
  Delete `5249`; the equality already proves the substring, and leaving both
  teaches the fragment form the surrounding block is trying to retire.

### `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`

- **[WARNING] The `return await` rationale at `lines 1839–1840` is factually
  wrong, and the test that proves it wrong carries the same error in its title**
  — `info.ts:1839–1840, 1849`; `info.test.ts:6742`.

  The comment says: "`return await` so a `composeResolvedComponents` throw inside
  the helper is caught by THIS try/catch and folds to the unreadable arm below."
  Neither helper can propagate such a throw. `buildWarmGitNonInstallableRow`
  catches its own `composeResolvedComponents` failure at `1915–1924` and returns
  a row; `buildAvailableRow` catches its own at `2092–2102` and returns a row.
  Two cases in this slice prove it: `6689` renders `⊖ alpha v1.0.0
  (partially-available) {lsp, permission denied}` and `6742` renders `○ alpha
  v1.0.0 (available) {permission denied}` — neither reaches the `(remote)` arm at
  `1861`. What *does* reach `1861` is a `resolveStrict` throw, which is what
  `6795` actually exercises. The `(remote)`-for-a-compose-throw path the comment
  describes is unreachable.

  Fix: rewrite `1839–1840` to state the true contract — the outer catch handles a
  `resolveStrict` throw (the probe is injected as `resolveGitPluginRoot`, so a
  materialize failure during resolution lands here); the two helpers own their
  own component-read failures and return rows rather than throwing. Keep the
  `return await` (it is correct defensively) but stop justifying it with an
  example that does not occur. Retitle `info.test.ts:6742` from "folds a
  component read failure to remote exactly" to "keeps the `(available)` row and
  names the component read failure" — the current title contradicts the bytes it
  asserts, and a reader comparing it with `6795` is actively misled.

- **[WARNING] `GetPluginInfoOptions.authMemo` has no caller in production or in
  any test — dead option surface** — `info.ts:136–137`, read at `info.ts:175`
  (`opts.authMemo ?? new Map<string, AuthAttemptResult>()`).

  The sole production caller, `edge/handlers/plugin/info.ts:69–77`, passes only
  `ctx`, `pi`, `marketplace`, `plugin`, `cwd`, `fetch` and `scope`. `grep -rn
  authMemo tests/` returns hits in `auth-host.test.ts` and `install.test.ts`
  only — never `info.test.ts`. The field's stated purpose (D-79-02, cap a Device
  Flow at once per host) is already satisfied by the Map `buildInfoFetchContext`
  creates at `175`, which is built once per `getPluginInfo` invocation and shared
  across both scope blocks. A caller-supplied memo would matter only for a
  cascade, and `info` has none — `install.ts` legitimately takes one because the
  import cascade shares it across many installs; `info` is a leaf command.

  Fix: delete the `authMemo` field from `GetPluginInfoOptions` and replace
  `opts.authMemo ?? new Map<...>()` at `175` with `new Map<string,
  AuthAttemptResult>()`. If the field is being held for a future cascade, say so
  in its doc comment and add a case that passes one and asserts it is reused —
  an unexercised option is the "flexibility that wasn't requested" the project
  guidelines forbid.

## Export ownership census

`info.ts` exports three symbols (`grep -n "^export"`), matching slice B. Because
all three are owned, the informative census is per **option field** of
`GetPluginInfoOptions` — that is the module's real consumer surface, and it is
where the gaps are.

| Module | Export / field | Owning case | Status |
| --- | --- | --- | --- |
| `info.ts` | `getPluginInfo` | 56 cases in slice C (129 file-wide) | owned |
| `info.ts` | `InfoCloneCacheSeam` | `info.test.ts:5036` (`fetchSeamWith`), `6824` (hand-rolled literal) | owned |
| `info.ts` | `GetPluginInfoOptions` | every call site (compile-time) | owned |
| ↳ field | `ctx` / `pi` / `marketplace` / `plugin` / `cwd` | every case | owned |
| ↳ field | `scope` (set) | `4202` and ~50 more | owned |
| ↳ field | `scope` (omitted → both-scope fan-out) | `6312` | owned |
| ↳ field | `fetch` | `5045`, `5115`, `5384`, … (26 sites) | owned |
| ↳ field | `cloneCacheSeam` | `5045`, `6795`, … (16 sites) | owned |
| ↳ field | `credentialOps` | passed at 15 in-slice sites, **never asserted on** (`makeMockCredentialOps()`'s `state` getters are discarded in every slice-C case) | incidental — asserted only by slice B's `3091`/`3145`/`3188` |
| ↳ field | `deviceFlowHttp` | `info.test.ts:2866` (slice B) | owned once; out of slice |
| ↳ field | `authMemo` | — | **NO CASE** (and no production caller — see production finding above) |

## Branch census

Classified per the brief's three categories, for the arms this slice reaches.

**(a) Reachable by real input, untested — findings:**

- `readLenientHookSummary`'s `typeof data !== "object"` and `data === null`
  disjuncts (`info.ts:573`). Two of a three-arm guard; only the third has a case.
  New WARNING above.
- `buildInstalledGitRow`'s `base.reasons` spread on the fetch-failure arm
  (`info.ts:1567`). Never non-empty in any case. New BLOCKER above.
- `buildRemoteNotInstalledRow`'s `dependencies` spread (`info.ts:1771`) and
  `buildInstalledGitRow`'s installable-arm `dependencies` spread
  (`info.ts:1553`). New BLOCKER above.
- `isLocallyResolvable` / `isGitSource`'s `"unknown"` source arm
  (`info.ts:196–197`, `212`). Every other `ParsedSource` kind has a case in this
  slice — `path` (`4202`), `github` (`4688`), `url` (`4652`), `git-subdir`
  (`4721`), `npm` (`4305`) — but no manifest entry in the file seeds a source
  value that `parsePluginSource` classifies `unknown` (a non-string, non-object
  value such as `source: 42`). Mutating `isLocallyResolvable` to return `true`
  for `unknown` is observable (the entry would take the path arm and
  `derivePluginRootForInfo` would throw on an absent `raw`, rendering
  `{unreadable}` instead of `{unsupported source}`), and every case stays green.
  Cheap fix: one case copied from `4305` with `source: 42`, pinning
  `⊘ … (unavailable) {unsupported source}` + `components: not resolved`.
- `discoverComponentNames`' cross-directory name de-duplication (the `Set` at
  `info.ts:308`). `6402` declares two skills directories but with distinct entry
  names, so replacing the `Set` with an array survives. Low value; note only.

**(b) Unreachable by real input:**

- `INSTALL_DISABLED_ROW_STATUSES` keys `installed`, `partially-installed`,
  `disabled`, `failed` (`info.ts:1029–1032`). Unreachable through the map's sole
  consumer at `895`. **Deliberate and correctly justified** by the map's own doc
  comment (`998–1007`) as a compile-time guard — the fix is a comment, not a
  deletion. New WARNING above.
- `buildGitNotInstalledRow`'s outer `catch` (`info.ts:1857–1868`) *as a handler
  for a `composeResolvedComponents` throw*. Unreachable for that cause; reachable
  and covered (`6795`) for a `resolveStrict` throw. This is the doc-comment lie
  filed above — the arm is live, only the documented reason for it is false.
- `projectDroppedHookEntries`' ` ` key-separator collision guard
  (`info.ts:367`). No `(event, matcher)` pair can collide because neither may
  contain a NUL byte, which the comment itself states. Not a gap.

**(c) Compiler-forced, not removable (D-116-01a category):**

- `isLocallyResolvable`'s default-less exhaustive `switch (src.kind)`
  (`188–199`) and `buildNonInstallableRowFields`' `switch (resolved.state)`
  (`1361–1379`). The repo's deliberate no-default exhaustiveness idiom; both
  reachable arms of the latter are covered (`6689` partially-available, `6639`
  unavailable).
- `buildWarmGitNonInstallableRow`'s `forComponents` ternary (`1897–1903`). The
  `unavailable` branch cannot read `resolved.componentPaths` — that field does
  not exist on `ResolvedPluginUnavailable`, so swapping the two arms is a
  compile error, not a survivable mutation.

## Grading of first-pass findings

### `tests/orchestrators/plugin/info.test.ts`

- **UNDERSTATED** — *33 of 129 cases assert only a regex fragment* — all 23
  listed members inside my range (`4345`, `4399`, `4465`, `4508`, `4557`, `4609`,
  `4652`, `4688`, `4721`, `4754`, `4803`, `4855`, `4899`, `4937`, `4984`, `5045`,
  `5115`, `5163`, `5261`, `5318`, `5384`, `5450`, `5495`) verified as
  match/doesNotMatch-only; the list is accurate for this range and slice B
  already added a 34th at `3635`. The understatement is in the **fix
  instruction**, not the count: the recorded remedy is "enumerate every line the
  fixture is known to produce", which reads as a tightening exercise. It is not.
  Two of these cases are the *only* coverage two production spreads have, so the
  omission is a repo-wide zero-coverage hole rather than a weak assertion (see
  the `dependencies` BLOCKER above), and one of them (`4984`) has an assertion
  that is not merely loose but unfalsifiable. Severity should stay BLOCKER, and
  the fixing pass should be told to re-derive each expected body from the
  production row builders rather than transcribing the fragments it already has.

- **CONFIRMED** — *`verify()` for the `strong-mock` doubles is hidden in a shared
  `finally`* — verified at `238`, `260–264`, `282–284`; no test body in this
  slice calls `verify()`. Aggravating detail this slice adds to slice B's: cases
  `5554` and `5650` call `makeCtx()` two and three times respectively, so the
  module-scope array holds several closures per case, and the drain at `282` does
  `.splice(0)` *before* iterating — so the first `verify` throw discards every
  remaining un-run verification silently. The proposed fix (inline
  `verify(ctx); verify(pi); verify(ui);` per case) must therefore be applied
  per-`makeCtx()`-call, not once per case.

- **DUPLICATE-OF** `unit-test-findings/adversarial/orchestrators-plugin-info-b.md`
  — *`startsWith` where full equality was cheap* (`3557–3560`). Outside my range;
  slice B verified the fixture is byte-identical to `STATE_ONLY_BLOCK` and
  confirmed the proposed fix. No independent verdict added here.

- **UNDERSTATED** — *lower-bound-only call-count assertions on the git-ops fake*
  (`5105`, `5374`, `5439`, `5440`) — all four confirmed in place in my range. The
  first pass records the exact count as something the fixing pass must derive
  ("or whatever the exact expected count is for each fixture"). It does not need
  to: **`info.test.ts:6857` in the same file already pins the probe invocation
  count at exactly 2** (`assert.equal(materializations, 2)`), which is the number
  these four sites are refusing to state. That also makes the double-materialize
  regression concrete rather than hypothetical — the MIRR-02 refresh-on-warm
  design means the probe *is* invoked twice per `--fetch` render, so "clones once,
  fetches twice" versus "clones twice, fetches twice" is exactly the distinction
  `>= 1` erases. Raise to BLOCKER-adjacent priority and give the fixing pass
  `6795` as the reference for the expected counts.

### `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`

- **CONFIRMED** — *dangling comment for a removed test-only export*
  (`2376–2378`) — the comment is the file's last content; `wc -l` puts the file
  at 2378 lines, so nothing follows it. Delete the block.

- **CONFIRMED** — *redundant `as Record<string, unknown>` casts* (`838`, `845`,
  `1319`) — schema verified independently by slice B against
  `domain/components/plugin.ts`; `entry.dependencies`, `entry.source` and
  `entry[kind]` are already `unknown` without the cast.

- **UNDERSTATED** — *`homedir()` / `process.cwd()` hidden reads in the hooks
  readers* (`397`, `437`) — real, and worse than "a latent inconsistency". The
  first pass frames both reads as currently inert and the risk as future-tense.
  The `process.cwd()` reader is `readHookSummaryEntries`, which is the **strict**
  reader on the live, heavily-tested manifest-backed path — `4508`, `4557` and
  `6457` all run through it. Under `node --test` the process cwd is the repo
  root, not the case's `mkdtemp` cwd, so the day `skipIfMap` is dropped these
  cases would silently compile `if:` predicates against the **repository**, and
  the suite would still be green because nothing asserts the context. That is a
  hermeticity hazard sitting one flag-flip away on a covered path, not a dormant
  style nit. Raise to BLOCKER-priority for the production fix (thread `cwd` from
  `buildBlock` → `composeResolvedComponents` → `readHookSummaryEntries`, exactly
  as `readStateOnlyHookEntries` already receives it at `499`).

- **CONFIRMED** — *no injectable fs port forces `withFsPromiseFault` global
  monkey-patching* — verified: `readdir` / `readFile` imported directly at
  `info.ts:27`; the helper at `info.test.ts:72–105` rewires `fs.promises` via
  `Object.defineProperty` + `syncBuiltinESMExports`. Four of the seven uses are
  in this slice (`4384`, `4442`, `6725`, `6778`). The `InfoCloneCacheSeam`
  precedent (`148–152`) is the right in-file template for an `fsOps` seam.

## Still clean after attack

Mutations this slice's cases genuinely catch, each verified against a specific
pin. This is where the fixing pass should **not** spend time.

- **The whole-message tail block (`6120`–`6980`, 19 cases) is the strongest
  material in the file** and is the in-file template the fragment cases should
  copy. Every one uses `assert.deepEqual(notifications, [...])` against a
  hand-written literal, so it kills the whole value-mutation family at once:
  a dropped line, a reordered line, a changed glyph, a wrong status token, a
  wrong reason ordering, a spurious severity, and an extra notification all go
  red. Nothing in this block needs strengthening.
- Component-kind discrimination — `6402` seeds a file inside `skills/`, a
  directory inside `commands/`, a directory inside `agents/` and two
  non-`.md` files, then pins `skills: bravo` alone. Inverting `nameFromEntry`'s
  `isDirectory()` / `isFile()` tests, or dropping the `.md` suffix filter, goes
  red.
- Absolute-vs-relative component path resolution — the same case declares
  `skills: ["skills", <absolute path>]`; removing `path.isAbsolute(rel) ? rel :
  …` at `info.ts:310` loses `bravo` and goes red.
- Sorting — `6271` pins `mcp: alpha, zeta` from a `{zeta, alpha}` literal, and
  `6944` pins `dependencies: bravo@mp, zulu@mp` from `["zulu@mp", "bravo@mp"]`.
  Both kill a removed or reversed comparator.
- The lenient-hooks guard family — `6153` (array `hooks` value), `6190` (blank
  event key), `6227` (empty event group), `6505` (non-array event group) each pin
  the exact rendered bytes, so removing any one guard changes the message.
- Strict-reader dropped-group de-duplication — `6457` seeds two identical `.*`
  matcher groups and pins one `PreToolUse(.*) (unsupported)` line; deleting the
  `seen` set in `projectDroppedHookEntries` goes red.
- `buildWarmGitNonInstallableRow`'s two arms — `6639` (unavailable, conventional
  `skills/` fallback enumerated) and `6689` (partially-available, `{lsp,
  permission denied}` in that order) pin both the status ternary and the
  `narrowUnsupportedKinds` / `narrowResolverNotes` fork.
- The outer-catch reason *discard* on a containment escape — `6549` pins
  `{unreadable}` alone on a `../outside` source, so a change that preserved the
  resolver's `{unsupported source}` note alongside it goes red.
- `foldFetchOrProbeError`'s ladder, both sides — `5450` (HttpError 401), `5495`
  (`UserCanceledError`), `5115` / `5871` (ENOTFOUND → `network unreachable`), and
  `6588` (a bare `Error` → `{unreadable}` via `narrowProbeError`). Reordering the
  `??` goes red, because `narrowProbeError` classifies ENOTFOUND as `unreadable`,
  not `network unreachable`.
- The pinned/unpinned probe fork — `5045` (sha present → clone only) versus
  `5384` (no sha → clone **and** fetch). Inverting the ternary at `info.ts:1476`
  drops the fetch and goes red.
- `--fetch` never fails info — `5115`, `5261`, `5450`, `5495`, `6588` and `6795`
  all await `getPluginInfo` without `assert.rejects`, so any throw escaping
  `getPluginInfo` fails the case directly.
- The OUT-03 admission matrix's four *reachable* statuses — `5554`
  (`available`), `5718` / `5203` (`remote`), `5826` (`partially-available`,
  tail-appended after `{lsp}`), `5933` (`unavailable`, excluded). `5871`
  additionally pins the tail position against a second reason
  (`{network unreachable, installs disabled}`), killing a head-insert mutation.
- The config-versus-entry precedence — `5650`'s three renders pin the whole row
  line for `enabled: true`, `enabled: false` and no-opinion, so weakening
  `rowClaimsInstallDisabled` in either direction goes red.
- The warm-clone declaration is *not* read — `5761` pins the bare row for a
  mirror whose own `plugin.json` says `defaultEnabled: false`, with the whole
  body asserted so the absence of the brace is proven alongside everything else.
- Two-scope ordering and separation — `6312` pins info-block-then-failed-block
  with severities, killing a reordered failed loop and a failed block folded into
  the cascade.
- The git-ops fake's URL allow-list (`ALLOWED_INFO_REMOTES`, `133–142`) is the
  fail-loud form META-FINDINGS names as a pattern to propagate, and this file
  already has it — every remote a `makeMockGitOps` case touches is on the list.
- `makeMockGitOps` / `makeMockCredentialOps` naming is sanctioned by this repo's
  `CONVENTIONS.md` `makeMock*` factory prefix, not a violation of the skill's
  "no `mock` in a double's name" rule.

## Not covered

- Lines 1–4196 of `info.test.ts` belong to slices A and B. I read the preamble
  and helpers (1–700) and the dependency-render case (1601–1643) as supporting
  context, plus targeted spot checks, but did not review those ranges case by
  case.
- `info.messaging.ts` / `info.messaging.test.ts` — out of scope per the area
  definition.
- `orchestrators/plugin/git-source-probe.ts` (`makePresenceProbe`),
  `clone-cache.ts` (`canonicalCloneUrl`, `resolveGitPluginRootWithSubdir`,
  `materializeOrRefreshPluginMirror`), `orchestrators/auth-host.ts`
  (`buildCloneAuth`) and `domain/resolver.ts` (`resolveStrict`,
  `rowClaimsInstallDisabled`) are collaborators this slice exercises end-to-end
  but does not own; their own pairings were not reviewed.
- `tests/platform/git-ops-fake.ts`, `tests/platform/credential-ops-fake.ts`,
  `tests/edge/handlers/marketplace-seed.ts` — read only at the surface this slice
  depends on; owned by other areas.
- No toolchain command was run, per the brief. Every claim is from reading plus
  read-only greps, except the `readFile`-on-a-directory behavior behind the
  `4984` BLOCKER, which was verified with a standalone `node -e` snippet outside
  the repo.

## Meta-findings impact

### New cross-cutting evidence

- **Existence probes written with `readFile` are unfalsifiable.** `info.test.ts`
  `5001–5026` proves "the directory was not created" with a `readFile` in a
  `try`/`catch` — but `readFile` on an existing directory throws `EISDIR`, so the
  catch fires either way and the assertion cannot fail. This belongs in
  META-FINDINGS' existing **"Green runs that checked nothing"** family and is a
  cheap repo-wide sweep: grep for `readFile` (or `readdir`) inside a `try` whose
  `catch` sets a boolean, and for any `assert.equal(<flag>, false)` derived that
  way. Other NFR-5 / NFR-10 "nothing was written" proofs are the likely carriers
  — check `orchestrators/plugin/{list,fetch,reinstall}.test.ts`,
  `orchestrators/marketplace/*.test.ts`, and the containment suites. The correct
  primitive is `assert.rejects(stat(p), (e) => e.code === "ENOENT")`.

- **Seeded-but-unasserted fixture fields mark zero-coverage production lines.**
  Three cases here seed `dependencies: ["dep@mp"]` and none asserts the resulting
  output line; two of the three are the only cases that reach their production
  spread, so the field is uncovered repo-wide. This is a mechanically detectable
  signal that generalises: for any fixture field a case sets deliberately, check
  that the case (or some case) asserts its rendered effect. Worth running across
  the other large orchestrator suites (`install`, `update`, `list`, `reinstall`),
  where the same fixture-builder style is used.

- **Runtime membership sets and total maps both need a reachability census, and
  they fail in opposite directions.** Slice B found `DISABLED_ROW_REASONS` (a
  `ReadonlySet`) has 2 tested / 2 reachable-untested / 2 unreachable members.
  This slice found the sibling `INSTALL_DISABLED_ROW_STATUSES` (a total
  `as const satisfies Record<...>` map — the idiom the repo prefers, and
  correctly so) has 4 of 8 keys unreachable through its sole consumer, with three
  test titles claiming to prove entries no test can fail. The general rule for
  the fixing pass: for every closed-set table, enumerate the call sites, derive
  the reachable key subset, and require a case per reachable key **and** a
  comment naming the unreachable ones. `list.ts::disabledReasonsField` and any
  other `ReadonlySet<ContentReason>` / total-status map deserve the same pass.

- **A test that injects no seam because "the arm cannot reach the boundary" turns
  a regression into a live-network attempt.** Eleven cases in this file pass
  `fetch: true` with production default clone-cache and credential ports. That is
  legitimate coverage of the defaulting code, but exactly one case should own it;
  the other ten should inject. Any orchestrator whose options carry `?? DEFAULT_*`
  seams (`install.ts`, `update.ts`, `marketplace/add.ts`) should be checked for
  the same shape — grep each suite for the seam option name and compare against
  its count of network-capable invocations.

### Corrections to META-FINDINGS.md

- **"Ranked by leverage" item 3, `orchestrators/plugin/info.test.ts` — "33 of 129
  cases".** Slice B already corrected the count to ≥34. The more consequential
  correction from this slice is the *characterisation*: the entry treats the
  cluster as uniformly "fragment where the full string is computable". One member
  (`4984`) is worse than that — its central assertion is vacuous, not merely
  loose — and two members (`4652`, `4937`) are the sole coverage of production
  lines that consequently have none. Planning this cluster as bulk assertion
  tightening will under-scope it; at least three members need re-derivation from
  the production row builders, not transcription.

- **"Patterns to propagate" — "Strict interaction mocking … `tests/orchestrators/**`
  top level" as a reference implementation.** Qualify further than slice B did.
  Beyond the hidden `verify()`, this file also contains a hand-rolled
  `InfoCloneCacheSeam` literal with a manual call counter (`6823–6841`, `6857`)
  standing in for a `strong-mock` — so `tests/orchestrators/plugin/info.test.ts`
  should be named explicitly as a **non**-reference for interaction mocking, in
  both the verify-placement and the double-construction halves.

- **"Known gaps" — "Some first-pass files had incomplete `### Clean files`
  lists".** For this area the clean list was empty by construction (one file,
  one module), so the adversarial pass had nothing to attack in that section — and
  it still produced 3 BLOCKER + 9 WARNING new findings from mutation testing
  alone. The lesson generalises past clean lists: **within a single 7,000-line
  file, a case-by-case first-pass read produces the same unfalsified-negative
  problem as a clean-file list does across files.** META's provenance note should
  say so, because it changes how the remaining large single-file areas
  (`list.test.ts`, `install.test.ts`, `catalog-uat.test.ts`) should be treated.

### Confirmations

- **The `mcp.json`-style "production half paid for itself" claim holds here
  too.** Reading `info.ts` alongside the tests produced two production findings
  no test-only read would reach: a doc comment whose stated control flow is
  contradicted by a passing test in the same file (`1839–1840` versus `6742`),
  and a dead option field with no caller anywhere (`authMemo`).

- **"Doc comments cut both ways" (leverage item 2's closing note) is independently
  confirmed on a third axis.** META recorded one comment that falsely claims
  production use and one that honestly admits test-only status. This slice adds a
  comment that is honest about its *purpose* but wrong about the *mechanism*
  (`info.ts:1839–1840`), and a test title that inherited the error
  (`info.test.ts:6742`). Slice B independently found a comment naming a test file
  that does not exist (`info.ts:1124`). Three distinct failure modes in one
  module: comments in this repo are not verifiable evidence and should be checked
  against the call graph and against the tests that pin the behavior.

- **The repo memory "Notification severity tri-state model" and "Output row
  grammar subject-first" are borne out.** Every whole-message pin in the tail
  block renders `<glyph> <name> [scope] (status) {reason}` in that order, and the
  `info`/`warning`/`error` split follows desired-reached / carried-out-but-short /
  not-carried-out exactly (`6312` error on `(failed)`, `6356` warning on
  `(skipped)`, everything else absent-severity). No drift found.

- **The "offline fake that fails loudly on unplanned input" pattern is already
  adopted here.** `ALLOWED_INFO_REMOTES` (`info.test.ts:133–142`) is the
  `fetch.test.ts` allow-list form META recommends propagating, and `6795`'s
  rejecting seam members are the same idea applied to the clone-cache seam. This
  file can be cited as a second in-repo example when propagating that pattern.
