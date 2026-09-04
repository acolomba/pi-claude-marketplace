# Orchestrators — plugin update (slice B) — adversarial re-review

**Scope:** `tests/orchestrators/plugin/update.test.ts` lines 4200–7270 — the
`--local` write-back case, the WR-02/WR-08/D-UPD/DFEN/ENBL-09/D-99-05a
disabled-record refresh block, the S5 invalid-config write-back loop, WR-03 +
the LIFE-01 5th cascade slot (5613), the D-65-04 `update --force`
resolved-candidate gating (5821), the UGRM-02 tally pair, and the whole
PURL-06 / D-78-05 / D-78-01 / MIRR-01 / PURL-03 git-source section (6212) up to
but not including SUB-02 at 7270 — **47 cases**. Production arms those cases
reach in
`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`:
`makeUpdateCloneProbe` (both probe arms), `deriveUpdateToVersion`,
`resolveUpdateCandidate`, `widensPartialGate`, `disabledPinProjection`,
`nextDisabledPin`, `disabledRefreshWouldWrite`, `refreshDisabledRecord`,
`runDisabledRecordRefresh`, `applyPerBridgeResources`,
`applyAllSuccessRecordFields`, `refreshHooksCacheAfterUpdate`,
`finalizeUpdateRecord`, `commitUpdateHooks`, `notifyInvalidConfigWriteBack`, the
`runThreePhaseUpdate` GC-after-swap arm, plus
`orchestrators/plugin/shared.ts::maybeWritePluginConfigBack` and
`orchestrators/plugin/clone-cache.ts::{resolvePluginPin, materializePluginClone}`.
Sections outside the range (651–4199, 7270–8502) were read only to settle
whether a sibling case already kills a mutation this range's cases survive.
**First-pass file:** `unit-test-findings/orchestrators-plugin-update.md`
**Clean files attacked:** 1 (the first pass's "Clean files" entry for this area
is a prose blanket over the remainder of both files; this pass attacked the
assigned slice of it — 47 cases and the ~18 production functions they reach)
**Existing findings graded:** 9

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 3 |
| New WARNING (missed by first pass) | 9 |
| Existing CONFIRMED | 6 |
| Existing UNDERSTATED | 3 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

## New findings — from the clean lists

### `tests/orchestrators/plugin/update.test.ts`

- **[BLOCKER] The `--local` write-back case proves nothing about `--local`, and its own comment states the opposite of what production does** — `test('WB-01: --local update targets the local file; base file untouched', ...)`, lines 4219–4260
  The case's only assertion is `assert.deepEqual(baseBytesAfter, baseBytesBefore)`
  (4254–4255). The local file is never read. Trace: with `local: true`,
  `finalizeUpdateRecord` (`update.ts:1993–1999`) calls
  `maybeWritePluginConfigBack({ …, local: true })`, which selects
  `configLocalJsonPath` (`shared.ts:1152–1154`); `loadConfig` on the absent file
  returns `{ status: "absent" }` (`config-io.ts:134–136`), so `current` becomes
  `{ schemaVersion: 1 }`, `existingEntry` is `undefined`, and
  `writePluginConfigEntry` **creates** `claude-plugins.local.json` carrying
  `{"hello@mp": {}}`. The comment at 4232–4233 ("Local file starts absent; the
  no-op patch keeps it absent") is therefore false. Two mutations survive:
  (a) hardcoding `local: false` at `update.ts:1998` — the base file already
  carries the `hello@mp` key, so `existingEntry !== undefined` short-circuits,
  nothing is written, and the base bytes stay identical; (b) deleting the
  `maybeWritePluginConfigBack` call entirely on the `--local` path. Fix: after
  the act, add
  `assert.deepEqual(JSON.parse(await readFile(locations.configLocalJsonPath, "utf8")), { schemaVersion: 1, plugins: { "hello@mp": {} } })`
  and correct the 4232–4233 comment to say the local file is CREATED with the
  implicit declaration while the base file keeps its `futureKey`.

- **[BLOCKER] Both clone-GC "swallow" cases pass unchanged if the swallow is deleted** — `test('a post-commit clone cleanup failure preserves the successful update', ...)` lines 6394–6447, and `test('a disabled pin refresh swallows post-commit clone cleanup failure', ...)` lines 6576–6632
  These two cases exist to prove the D-19-01 swallow around
  `garbageCollectPluginClones` (`update.ts:2360–2366` for the swap arm,
  `update.ts:1750–1756` for the disabled-refresh arm). Remove either `catch` and
  the throw escapes `runThreePhaseUpdate` into `updatePlugins`' catch at
  `update.ts:417–433`, which fires `notifyDirectFailure` — **exactly one**
  notification — while the record was already committed by `finalizeUpdateRecord`
  / `refreshDisabledRecord` before the GC ran. Every assertion still holds:
  `stateWatch.fired()` true (6434 / 6618), `record.resolvedSha === SHA_NEW`
  (6437 / 6621), `record.enabled === false` (6622), `notifications.length === 1`
  (6438 / 6623), `pathExists(oldCloneRoot) === true` (6439 / 6624 — the GC failed
  either way). The one fact that distinguishes swallow from throw is the
  notification's severity and body, which neither case reads. Fix: in 6394 add
  `assert.equal(notifications[0]?.severity, undefined)` plus
  `assert.equal(notifications[0]?.message, "● mp [project]\n  ● gp vsha-111111111111 → vsha-222222222222 (updated)\n\n/reload to pick up changes")`;
  in 6576 add `assert.equal(notifications[0]?.severity, undefined)` plus
  `assert.equal(notifications[0]?.message, "● mp [project]\n  ⊘ gp (skipped) {already disabled}")`
  (the byte form the siblings at 4821 and 5072 already use). This is also the
  only place in the range where the git-source `(updated)` row would get pinned
  at all — see the branch census.

- **[BLOCKER] The LIFE-01 trio asserts the hooks FILE and never the record the file's disappearance is supposed to move** — `test('LIFE-01 (update): version A->B (both ship hooks) …')` 5617, `test('LIFE-01 (update): version A (with hooks) -> version B (no hooks) removes the stale hooks file')` 5687, `test('LIFE-01 (update): version A (no hooks) -> version B (with hooks) …')` 5766
  All three assert only `!summary.includes("(failed)")` plus the on-disk
  `<hooksDir>/hello/hooks.json` bytes. None re-reads `state.json`.
  `applyPerBridgeResources`'s hooks arm (`update.ts:1843–1850`) writes
  `sRecord.resources.hooks = installable.hooksConfigPath === undefined ? [] : [plugin]`
  and either `delete sRecord.hookEntries` or `sRecord.hookEntries = [...hookEntries]`.
  Mutating line 1844 to `[plugin]` unconditionally, or deleting lines 1845–1849
  outright, leaves all three green — and `hookEntries` is what `info` and `list`
  render (`tests/orchestrators/plugin/info.test.ts:2062`), so the record would
  keep naming hooks version B no longer declares. Repo-wide grep confirms
  `hookEntries` is asserted after `install` (`install.test.ts:5003`, `:8872`) and
  never after `update`; `resources.hooks` is asserted in this file only inside
  `assertResourcesEmpty` (4783) and on a hooks **failure** (7926). Fix: in 5687
  add `assert.deepEqual([...rec.resources.hooks], [])` and
  `assert.equal(Object.hasOwn(rec, "hookEntries"), false)`; in 5617 and 5766 add
  `assert.deepEqual([...rec.resources.hooks], ["hello"])` and
  `assert.deepEqual(rec.hookEntries, [{ event: "PreToolUse", matcher: "" }])`.
  Second half of the same gap: 5687 also never checks that the routing table
  emptied. `refreshHooksCacheAfterUpdate` (`update.ts:1889–1908`) calls
  `removePluginConfigFromCache` unconditionally; guarding it with
  `if (installable.hooksConfigPath !== undefined)` leaves version A's handler
  routed after version B dropped hooks, and no case anywhere catches it. Fix:
  copy WR-03's seeding (5548–5562 — `parseHooksConfig` + `addPluginConfigToCache`)
  into 5687 and assert `assert.deepEqual(getRoutingBucket("PreToolUse"), [])`
  afterwards; without the seeding the assertion is vacuous.

- **[WARNING] The S5 pair never pins the emission ORDER or the severity, and production contradicts its own stated ordering contract** — `test('S5: update success + invalid ${title} write-back names only its basename', ...)`, lines 5445–5489
  The case collapses everything into
  `const allText = notifications.map(n => n.message).join("\n")` (5480) after a
  lower-bound `notifications.length >= 2` (5474). Three mutations survive:
  emitting a third notification; flipping the S5 row's `severity: "error"`
  (`update.ts:2224`) to `"warning"` or dropping it; and swapping the two
  notifications' order. The order one matters because
  `notifyInvalidConfigWriteBack`'s own doc comment (`update.ts:2202–2207`) states
  "Direct-path callers surface the abort as a separate warning **AFTER** the
  success row, so the user knows the on-disk artifacts were updated but the
  config entry was not written" — while the call site at `update.ts:2386–2388`
  fires it *inside* `runThreePhaseUpdate`, i.e. before `updatePlugins` reaches
  `renderUpdateCascadeAndNotify` at `update.ts:469`. The warning is emitted
  **first**. Fix the test to `assert.equal(notifications.length, 2)`,
  `assert.equal(notifications[1]?.severity, "error")` (or `[0]` — whichever the
  operator rules correct) and to assert each message individually instead of the
  join; and escalate the comment/behaviour mismatch as a production question (see
  the production section).

- **[WARNING] FORCE-04 passes vacuously against an implementation that emits no notification at all** — `test('FORCE-04: the force-degrade update path emits no warning severity and no `Warning:` summary', ...)`, lines 6006–6045
  Every assertion is negative: `warnings.length === 0` over a filtered array
  (6030), a `for` loop over `notifications` that never executes when the array is
  empty (6031–6037), and `assert.equal(notifications[0]?.severity, undefined)`
  (6040), which the optional chain makes true for an empty array. Skipping the
  notify entirely is green. The scenario is byte-pinned 150 lines up by FORCE-02
  (5892–5900), so the suite as a whole does not lie today — but this case is one
  deletion away from proving nothing. Fix: add
  `assert.equal(notifications.length, 1)` as the first assertion.

- **[WARNING] WR-08 drops the positive row assertion its WR-02 sibling carries** — `test('WR-08 / NFR-3: the lock-free skip survives multi-element compatibility lists', ...)`, line 4413–4418
  WR-02 (4317–4319) asserts `notifications.length === 1`,
  `match(/\(skipped\) \{up-to-date\}/)` **and** `doesNotMatch(/lock held|\(failed\)/)`.
  WR-08 keeps only the count and the negative. A run that emitted an entirely
  different row — `(updated)`, or `(skipped) {already disabled}` — is green here
  and red in WR-02. Add the sibling's
  `assert.match(notifications[0]!.message, /\(skipped\) \{up-to-date\}/)` between
  4413 and 4414.

- **[WARNING] `resolvedSource` refresh checked by `.includes("hello")` where the exact path is computable, in 2 of 3 siblings** — lines 4470–4473 (`D-UPD`) and 5088–5091 (`ENBL-09 --partial short-circuit`)
  `assert.ok(rec.resolvedSource.includes("hello"), …)` passes for any path
  containing the plugin name — including the *stale* seeded one if the fixture
  ever seeded a "hello"-bearing placeholder, and including a path under the wrong
  marketplace root. The correct form is already in this file at 5254–5258:
  `assert.equal(rec.resolvedSource, path.join(seeded.marketplaceRoot, "plugins", "hello"), …)`.
  Both cases already hold `seeded` (4433 returns it; 5044 binds it), so the fix is
  mechanical: replace both `assert.ok(...includes...)` with the `assert.equal`
  against `path.join(seeded.marketplaceRoot, "plugins", "hello")`.

- **[WARNING] The degraded arm of every compatibility assertion is length-only while its counter-case deep-equals** — 4 sites: 4833–4836, 4936, 4984–4987, 5378–5381
  Each writes `assert.ok(rec.compatibility.unsupported.length > 0, …)`, while the
  paired promotion cases assert `assert.deepEqual([...rec.compatibility.unsupported], [])`
  (5030, 5430, 4895). So `nextDisabledPin`'s
  `unsupported: [...installable.unsupported]` (`update.ts:1586`) can be mutated to
  copy `supported` instead, or to append a bogus kind, and every degraded case
  stays green — nothing in the file states what the list *is* on a disabled
  refresh. Replace all four with
  `assert.deepEqual([...rec.compatibility.unsupported], ["themes", "monitors"])`
  (the two kinds `makeCandidateUnsupported` at 5834–5848 declares; confirm the
  resolver's emit order once and hard-code it — WR-08 at 4389–4392 already
  depends on that order being stable, so pinning it here strengthens both).

- **[WARNING] Six git-source and force cases assert rendered rows by unanchored fragments where byte-exact siblings exist in the same file** — 5907 (`assert.match(body, /\(partially-upgradable\)/)` + two more fragments), 6124 (three `assert.match`, no count), 6166 (one `assert.match`, one `doesNotMatch`, no count, no severity), 6762, 6938, 7032 (single `assert.match(body, /\{…\}/)` over a joined message, no count, no severity)
  The byte-exact form for the identical row shapes is at 4880–4884 (the
  `(partially-upgradable)` decline with its trailer), 5989–5996 (the bulk
  `(partially-upgradable)` body with headline and tally) and 4713–4723 (a
  multi-row body with tally and trailer). A garbled message with the header and
  row swapped, a dropped headline, or a second spurious notification passes each
  of the six. Rule for fixing all of them: replace
  `notifications.map(n => n.message).join("\n")` / `notifications[0]?.message ?? ""`
  + `assert.match` with `assert.equal(notifications.length, 1)`,
  `assert.equal(notifications[0]?.severity, <expected>)` and one
  `assert.equal(notifications[0]?.message, <hand-written literal>)` built from the
  arranged input the way 5989 does. Note 6762's title claims "existing REASONS
  token, **no new token**" but carries no negative assertion at all; its sibling
  at 7211 has one (`assert.doesNotMatch(body, /\{no longer installable\}/)`) —
  propagate it.

- **[WARNING] The vacuous direction of the `?? ""` clone-GC guard is unguarded in one of four sites** — line 6383–6387
  `assert.equal(await pathExists(seeded.oldCloneRoot ?? ""), false, "old clone GC'd")`.
  `pathExists("")` lstats `""`, gets ENOENT, and returns `false`
  (`shared/fs-utils.ts:61–73`), so if `seedGitPluginMarketplace` ever stopped
  returning `oldCloneRoot` this assertion passes having checked nothing. The
  siblings at 6410–6411 and 6593–6594 guard with
  `assert.ok(oldCloneRoot !== undefined)` first; 6708 and 6762 assert `=== true`,
  which fails safe. 6634's copy of the same expression (6690) is rescued by the
  `readdir` deep-equal at 6696–6701. Add
  `assert.ok(seeded.oldCloneRoot !== undefined)` before line 6383.

- **[WARNING] `updateSinglePlugin`'s "offline" case runs against the REAL git backend and never asserts offline-ness** — `test('updateSinglePlugin keeps a recorded provider SHA offline without an auth context', ...)`, lines 7178–7209
  Every other git-source case in the range injects
  `cloneCacheSeam: seamWith(makeMockGitOps(...))`. This one cannot:
  `updateSinglePlugin`'s `PluginUpdateFn` signature carries no seam, so
  `preflightUpdate` falls back to the real `resolvePluginPin` /
  `materializePluginClone` (`update.ts:1214–1218`), which default to
  `DEFAULT_GIT_OPS`. The case stays offline only because the pinned sha
  short-circuits `resolvePluginPin` (`clone-cache.ts:520–521`) and the warm dir
  short-circuits `materializePluginClone` (`clone-cache.ts:175–177`). Remove
  either short-circuit and this case attempts a live clone of
  `https://github.com/org/repo.git`. The `assert.deepEqual(outcome, {...})` at
  7200–7207 is otherwise a model whole-value assertion. The fix is the production
  one — thread a clone-cache seam through `PluginUpdateFn` alongside the `cwd`
  the first pass already flagged — after which this case injects like its
  siblings and can assert `gitState.cloneCalls.length === 0`.

- **[WARNING] The pinned-auth case asserts only half the contract its production comment states** — `test('plugin update authentication: a pinned provider update threads auth to the clone', ...)`, lines 7118–7124
  `update.ts:895` says "The bundle threads into **BOTH** the pin resolution AND
  the re-clone", and `capturingUpdateSeam` (289–318) records both halves — but
  7081 asserts only `captured.cloneAuth`, while the unpinned sibling at 7170 does
  assert `captured.pinAuth === undefined`. Deleting
  `...(authBundle !== undefined && { auth: authBundle })` from the
  `seam.resolvePluginPin` call at `update.ts:898` survives. Honest caveat: on this
  branch the deletion is behaviourally inert (see the production finding below),
  so the value of the assertion is contract-pinning, not bug-catching. Add
  `assert.equal(captured.pinAuth?.host, "github.com")` and
  `assert.equal(captured.pinAuth?.credentialOps, credentialOps)`.

- **[WARNING] Seven in-case dynamic `await import()` calls of production modules, one shadowing a top-level import** — lines 4234–4235, 5500–5509 (five in a row, two of them importing `routing-state.ts` twice in adjacent statements), 5618–5619, 5688–5689, 5767–5768, 6695
  The file has a conventional top-level import block (20–57). ESM modules are
  singletons, so a dynamic import buys no isolation from
  `routing-state.ts`'s module-global state — it just hides the dependency from the
  import block and from `import-x/order`. 6695's
  `const { readdir } = await import("node:fs/promises")` shadows the `readdir`
  already imported at line 8 and used at 6564. Fix: hoist all seven into the
  top-level import block (merging 5503 and 5505 into one
  `import { getRoutingBucket, resetRoutingState } from ".../routing-state.ts"`)
  and delete 6695.

### `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`

- **[WARNING] `notifyInvalidConfigWriteBack`'s doc comment states an ordering the code contradicts** — comment at lines 2201–2207, call site at 2386–2388
  The comment's rationale ("AFTER the success row, so the user knows the on-disk
  artifacts were updated but the config entry was not written") depends on the
  success cascade being emitted first. The call is made inside
  `runThreePhaseUpdate` before the outcome is returned, so `updatePlugins`
  renders the cascade afterwards at line 469 — the S5 warning lands at
  `notifications[0]` and the success row at `notifications[1]`. Either the
  emission moves to the caller (after `renderUpdateCascadeAndNotify`) or the
  comment is rewritten to describe the current order. This is an operator
  decision, not a mechanical fix: it changes user-visible ordering. The comment
  also calls the row a "warning" while the stamp is `severity: "error"` (2224);
  reword to match.

- **[WARNING] The auth bundle threaded into `seam.resolvePluginPin` is dead on every reachable call** — `update.ts:896–899`
  `probePinned` is invoked only when `gitSource.sha !== undefined` (dispatch at
  `update.ts:925`), and `resolvePluginPin` consumes `auth` only on the
  `source.sha === undefined` branches (`clone-cache.ts:520–533`). So the
  conditional spread at 898 can never reach a code path that reads it. This is
  not compiler-forced (removing it type-checks) and not unreachable defensive
  code in the D-116-01a sense — it is a genuinely inert argument whose presence
  is what makes the comment at 895 ("threads into BOTH") read as a live contract.
  Either drop the spread and reword 895, or keep it and add a one-line comment
  saying it is future-proofing for a ref-pinned `probePinned` arm that does not
  exist today.

## Export ownership census

Slice C tabled `update.ts`'s five module exports. The more useful census for this
range is the **option-field** surface of `UpdatePluginsOptions` (`update.ts:225–270`),
since that is what the 47 cases actually drive.

| Module | Export / field | Owning case(s) in range | Status |
| --- | --- | --- | --- |
| `update.ts` | `updatePlugins` | 46 of the 47 cases | owned |
| `update.ts` | `updateSinglePlugin` | 7178 | owned (whole-value `deepEqual`) |
| `update.ts` | `UpdateCloneCacheSeam` | `seamWith` 6234; `capturingUpdateSeam` 289 | owned |
| `UpdatePluginsOptions` | `ctx` / `pi` | every case via `makeCtx()` 225 | owned |
| `UpdatePluginsOptions` | `scope` | every case (`"project"`) | owned (one value only — no `"user"` case in range) |
| `UpdatePluginsOptions` | `cwd` | every case | owned |
| `UpdatePluginsOptions` | `target` (`plugin` / `marketplace` kinds) | 4219 etc. / 4616, 5499, 5956, 6124, 6166 | owned; `{kind:"all"}` is out of range |
| `UpdatePluginsOptions` | `local` | 4219 (write-back), 5445 loop (basename only) | **incidental** — the local file is never read (BLOCKER above) |
| `UpdatePluginsOptions` | `partial` | 4904, 4945, 5039, 5100, 5331, 5850, 6006, 6047, 6166 | owned, both directions (4845 is the no-flag control) |
| `UpdatePluginsOptions` | `cloneCacheSeam` | every git case 6341–7211 | owned |
| `UpdatePluginsOptions` | `credentialOps` | 7081, 7131 | owned |
| `UpdatePluginsOptions` | `deviceFlowHttp` | 7081, 7131 | owned (passed, never observed — the fakes are inert on the warm/pinned paths) |
| `UpdatePluginsOptions` | `authMemo` | 7081 (`authMemo.size === 1`, memoized decline round-tripped) | owned |
| `UpdatePluginsOptions` | `gitOps` | — (in range) | out of range: 1101, 3374 |
| `UpdatePluginsOptions` | **`mapModel`** | — | **NO CASE, file-wide** |

`mapModel` is the census's real result: grep confirms the string `mapModel`
appears **zero** times in all 8,502 lines of `tests/orchestrators/plugin/update.test.ts`.
`buildDirectThreePhaseArgs` threads it as `opts.mapModel ?? false` (`update.ts:328`)
and `prepareUpdateHandles` re-defaults it at `update.ts:1351`; mutating either to
`?? true` leaves the whole paired test module green. The AG-7 behaviour *is*
proven — in `tests/edge/handlers/plugin/update.test.ts` (matrix row
`"matrix-map-model"`, line 771, observed as the agent's `model:` line), whose own
header at lines 26–58 records that it must observe the orchestrator's footprint
because `updatePlugins` is reached by direct import with no injection point. Under
the pairing rule that behaviour is owned by *this* file. Fix: add one
`--map-model`-equivalent case here — seed a plugin with `hasAgent: true` whose
source agent carries `model: sonnet`, run `updatePlugins({…, mapModel: true})`,
and assert the staged `<agentsDir>/<generated>.md` frontmatter contains the
mapped `model:` line, plus a sibling with `mapModel` omitted asserting the field
is **absent** (not present-and-false), mirroring the edge file's stated contract.

## Branch census

Production branches this range owns, classified:

- `widensPartialGate` (`update.ts:1078–1082`) — **fully covered, both conjuncts.**
  True: 4786 (disabled + already-degraded, no flag). False via the availability
  conjunct: 4845 (disabled but CLEAN keeps the decline row). False via the
  disabled conjunct: every enabled case. This is a genuinely well-built pair.
- `resolveUpdateCandidate` catch fan-out (`update.ts:1004–1058`) — all three arms
  reachable and covered: transport (6762 ENOTFOUND, 7211 UserCanceledError),
  partialable (4845, 5907, 5956), structural fallthrough (6047, 6938, 7032).
- `makeUpdateCloneProbe` — `buildBundle`'s `auth.ctx === undefined` arm covered by
  the cascade (7178); defined arm by 7081/7131. `probeUnpinned` /`probePinned`
  × (`git-subdir` / plain) is a full 2×2: 6634, 6885, 6984, 6341; and each
  subdir arm's `kind !== "materialized"` early return is covered (6938, 7032).
- `deriveUpdateToVersion` (`update.ts:936–948`) — git+sha covered (6341 etc.),
  non-git covered (all path cases). The `isGitSource && resolvedSha === undefined`
  combination is **unreachable by real input**: `captured` is assigned only after
  a successful materialize, and a failed materialize returns a skipped outcome
  before this call. Not a finding; not compiler-forced either — it falls out of
  the `??`-free shape and needs no change.
- `nextDisabledPin`'s `resolvedSha ?? shaFallback` (`update.ts:1596`) —
  **reachable-untested.** The fallback only differs from `resolvedSha` when the
  live record carries a `resolvedSha` and the current resolution does not, i.e. a
  manifest entry that moved from a git source to a path source under a disabled
  record. `makeDisabledPluginRecord` never sets `resolvedSha`, and 6501 (the only
  disabled git case) has both halves defined, so mutating line 1596 to bare
  `resolvedSha` survives the whole file. Low priority — exotic input, and the
  failure mode is a spurious rewrite, not corruption. One case would close it:
  seed `makeDisabledPluginRecord` with `resolvedSha: SHA_OLD` over a **path**
  entry and assert `state.json`'s mtime does not move.
- `runDisabledRecordRefresh`'s GC arm (`update.ts:1750–1756`) — **covered, and
  this settles slice C's open question.** 6501 asserts
  `readdir(pluginClonesDir)` deep-equals `[pluginCloneKey(cloneUrl, SHA_NEW)]`
  after the refresh, which is exactly the `wrote === true && resolvedSha !== undefined`
  sweep. The guard's `wrote === false` side is unproven but benign (a no-write
  refresh un-references nothing, so a sweep would delete nothing observable).
- `applyPerBridgeResources`'s hooks arm (`update.ts:1843–1850`) —
  **reachable-untested on the update success path** (new BLOCKER above). Both the
  `hooksConfigPath === undefined` and defined branches run in this range (5687 vs
  5617/5766) and neither is observed.
- `refreshHooksCacheAfterUpdate` (`update.ts:1889–1908`) — the
  `hooksConfigPath !== undefined` arm is proven end-to-end by WR-03 (5592–5605).
  The `undefined` arm's cache-removal effect is **reachable-untested** (folded
  into the LIFE-01 BLOCKER's fix).
- `finalizeUpdateRecord`'s `!args.cascade && allSucceeded` write-back
  (`update.ts:1993–2003`) — the base-file arm is owned out of range (4086, 4123,
  4177); the `local` arm is nominally covered by 4219 but proves nothing (BLOCKER);
  the `invalidConfig` return is covered by the 5445 loop, both file kinds.
- `notifyInvalidConfigWriteBack`'s `args.local === true` basename selection
  (`update.ts:2210–2212`) — covered by the 5445 loop's two rows (the only
  data-driven pair in the range, and correctly written as one sibling `test()`
  per row).
- `commitUpdateHooks` (`update.ts:2034–2062`) — the no-hooks removal arm (5687)
  and the write arm (5617, 5766) both run; the `!parsed.ok` throw is owned out of
  range (1693).
- `garbageCollectPluginClones` gating on `preflight.resolvedSha !== undefined`
  (`update.ts:2360`) — positive covered (6341, 6634 with a `readdir` deep-equal);
  negative (path sources) implicitly covered everywhere. The surrounding
  `catch` is **covered but undiscriminated** (BLOCKER above).
- No compiler-forced (D-116-01a) branches were needed anywhere in this range.

**AAA labelling, measured:** 8 of the 47 cases in this range carry
`// arrange` / `// act` / `// assert` (the 5445 loop's two rows, 6047, 6394,
6576, 7081, 7131, 7178). 39 do not. See the grading of the first pass's finding.

## Grading of first-pass findings

### `tests/orchestrators/plugin/update.test.ts`

- **CONFIRMED** — *`dropCache-fail` asserts nothing that discriminates the behavior it names* (BLOCKER) — out of range (3275), but I independently verified the production half: `dropPluginCompletionCache` (`update.ts:2448–2462`) has an empty catch per D-19-01 and no `notifyWarning` anywhere in the file. Same conclusion as slice C.
- **CONFIRMED** — *`abortHandles`/`abortPartialHandles` proven only by their state-record consequence* (BLOCKER) — out of range, and consistent with what I see here: the only `readdir` calls in my 3,070 lines are on `pluginClonesDir` (6564, 6696); no staging directory is listed anywhere.
- **UNDERSTATED** — *the warm sha-pinned-cache offline proof checks only `cloneCalls`* (WARNING) — the git-call gap is real (6483 asserts one array where the sibling at 1232 asserts four), but the same case is weak on a second axis the first pass did not record: its row check is a **disjunctive** regex, `assert.match(body, /\(skipped\) \{up-to-date\}|nothing to update/)` (6490–6494), with no `notifications.length` pin and no severity. Two byte-exact siblings render this exact row form (5249, 5324). Severity should stay WARNING but the fix must cover both halves: add the four zero-call assertions **and** replace 6489–6494 with `assert.equal(notifications.length, 1)` + `assert.equal(notifications[0]?.message, "● mp [project]\n  ⊘ gp (skipped) {up-to-date}")`.
- **UNDERSTATED** — *inconsistent AAA phase-comment discipline* (WARNING) — real, severity fits, but the recorded scope ("roughly a quarter of the cases, concentrated in the earlier `PUP-*`-numbered section") is wrong in the other direction from what a fixer would guess. In this range **39 of 47** cases are unlabelled, and the labelled ones are scattered (S5, FORCE-05, the two clone-GC cases, the two auth cases, the cascade case) rather than clustered at the end. Combined with slice C's 16-of-22 count, the honest scope is *file-wide, ~85% of cases*, and the fix should be stated as "label every case" rather than "label the PUP section".
- **CONFIRMED** — *`makeCtx()`'s minimal doubles are cast to the full host interfaces via a double `as`* (WARNING) — verified at 225–241; all 47 cases in this range flow through it. Correctly deferred to the repo-wide notify-parameter narrowing (META item 1), which owns the production fix. One local addition in the same class: line 4238 casts a forward-compat config fixture with `{ futureKey: "x" } as never` — same shape, same owner.

### `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`

- **CONFIRMED** — *seven `as Error` casts on caught `unknown`* (WARNING) — verified at 534, 2096, 2102, 2115, 2122, 2128, 2342. None of the five `commitUpdatePhase3a` sites is reached by a non-`Error` throw in my range, so this stays a consistency finding rather than a live defect here.
- **UNDERSTATED** — *`updateSinglePlugin` reads `process.cwd()` directly* (WARNING) — the `process.cwd()` half is exactly as recorded (line 608; 7178 adds another `process.chdir` dance at 7182–7194, correctly paired via `t.after`). What the first pass missed is that the **same** signature gap costs a second thing: `PluginUpdateFn` carries no `cloneCacheSeam` either, so 7178 is the one git-source case in this file that runs against `DEFAULT_GIT_OPS` and stays offline only by warm-cache accident (`clone-cache.ts:175–177`). That turns a "discipline burden" into a latent hermeticity exposure, which the skill classes as BLOCKER territory. The fix is the same one change — widen `PluginUpdateFn` to carry `cwd` **and** the seam — so treating it as one ticket at the higher severity is the right call.
- **CONFIRMED** — *two inline `new Date().toISOString()` calls* (WARNING) — verified at 1713 (`refreshDisabledRecord`) and 1983 (`finalizeUpdateRecord`). Worth noting the flip side my range exploits: because the seeded `updatedAt` is a fixed literal, the 5100 idempotence case pins the no-write property via `updatedAt` + mtime (5188–5198) without needing a clock seam. A clock injection would make that case simpler but is not blocking it.
- **CONFIRMED** — *`UpdatePluginsOptions` has no top-level doc comment* (WARNING) — verified at 225; `UpdateCloneCacheSeam` at 204–212 has a full one.

The first pass's module-split recommendation is corroborated from this angle too:
the disabled-record refresh block (4264–5437, 14 cases) and the git-source block
(6212–7267, 16 cases) are two disjoint concerns sharing one 8,502-line file, and
each maps cleanly onto the proposed `update-preflight.ts` / `update-swap.ts`
seams.

## Still clean after attack

Mutations this range's cases genuinely kill — do not spend fixing-pass time here:

- **`4616` (DFEN-08)** is the strongest case in the range and should be the
  template the fragment cases above are converted to. It kills: dropping any of
  the three rows, reordering them, changing the tally (`2 updated` vs `3`),
  dropping the `/reload` trailer, and — via the `betaRow.replaceAll(...)` identity
  assertion at 4740–4744 — a drift that moves *both* the declared-true and silent
  rows in the same wrong direction, which two independently-correct literals
  would both stay green through. Its `entryDefaultEnabled` flip plus the
  same-rewrite version bump is a real fixture-rot control: a stale
  `(mtimeMs, size)` manifest cache fails the version assertions before the
  enablement assertions can pass for the wrong reason.
- **`4507` (DFEN-07)** kills the "re-read `defaultEnabled` on update" mutation in
  both directions, with the same version-moved control, and compares
  `after.resources.*` against the **pre-update** record rather than an assumed
  empty shape — so a DFEN-04 record's inventory cannot be silently cleared.
- **`4329` (WR-08)** kills the projection-order regression it was written for, and
  its three fixture-rot guards (4385–4396) genuinely prevent the case degrading
  into a duplicate of WR-02. The comment at 4344–4347 explaining why sorting
  inside `disabledPinProjection` would hide rather than fix the dependency is a
  model of a test that states its own contingency.
- **`5100` (ENBL-09 idempotence)** and **`5268` (D-99-05a no-write)** kill the
  RECON-05 mutation from both sides: 5268 compares the whole `state.json` bytes
  *and* the mtime, so a rewrite landing identical values is caught; 5100 pins the
  mtime, `updatedAt`, and the two differing rows (`{already disabled}` then
  `{up-to-date}`) that prove the two calls took different arms of the same guard.
  Deleting the `next.projection === current → return false` guard
  (`update.ts:1695–1697`) fails both.
- **`4945` + `4996`** (and **`5331` + `5390`**) are correct counter-case pairs:
  each degraded case is satisfiable by a hard-coded `false` and each promotion
  case by a hard-coded `true`, so only the pair proves
  `installable: installable.state === "installable"` (`update.ts:1583`) is
  derived. Pinning `installable` to either constant fails one of each pair.
- **`4786` vs `4845`** kills both directions of `widensPartialGate`'s conjunction:
  removing `isRecordedButDisabled` or removing `!record.compatibility.installable`
  flips one of the two rows.
- **`5039`** asserts the *absence* of the staged skill on disk
  (`pathExists(<skillsTargetDir>/hello-tool") === false`, 5078–5082) rather than
  inferring it from the record — the right shape for a "stages nothing" claim.
- **`6501` (ENBL-09 / PURL-09)** is the range's best git case: it kills the
  version-without-sha mutation (the silent-revert bug it names), the
  resurrection mutations, *and* the orphan-accumulation mutation, the last via a
  `readdir` deep-equal on `plugin-clones/` rather than a single `pathExists`.
- **`6634` (MIRR-01/MIRR-03)** kills the re-clone-instead-of-refresh mutation
  (`resolveRemoteRefCalls.length === 0`), the wrong-key mutation (bare 12-hex
  regex on the basename), and the persisted-migration-artifact mutation (the
  `readdir` deep-equal names the mirror key exactly).
- **`6708` (D-78-01 shared clone)** kills an over-eager GC: dropping the
  live-key derivation and deleting the old clone unconditionally fails the
  survival assertion while the sibling's pin stays put.
- **`6885` (PURL-03 pinned subdir)** kills both the "anchor to the monorepo root"
  mutation (`path.join(newCloneRoot, "plugins", "p")` compared exactly) and the
  "drop the ref hint" mutation (`gitState.cloneCalls[0]?.ref === "main"`).
- **`7211`** kills the misclassification it names, in both directions
  (`match(/\{authentication required\}/)` plus
  `doesNotMatch(/\{no longer installable\}/)`).
- **`5850` (FORCE-02)** and **`5956` (SEV-04 bulk)** are byte-exact whole-body
  compares including glyph, tally and trailer; they kill the
  `(updated)`-vs-`(partially-installed)` status mutation, the
  `nothing to update` headline mutation, and the SEV-04 severity split.
- **Hermeticity across all 47 cases** holds: every case is `withHermeticHome` +
  `mkdtemp` + `finally { rm }`; the two chmod cases restore permissions in
  `finally` with a `.catch`; the `watch()` handles are closed. No shared temp
  directory, no repo write, no fixed path, no sleep or poll. (One environment
  caveat, not a defect: 6394/6576 use `chmod 0o000` to force the GC failure and
  will fail loudly — not silently pass — if the suite is run as root.)

## Not covered

- Lines 651–4199 belong to the A slice and 7270–8502 to the C slice. I read
  1232, 2378–2560, 4086–4199, 7926 and 8217–8290 only to settle whether sibling
  cases kill mutations my range survives, and did not grade those sections.
- I did not re-audit `update-row.ts` / `update.messaging.ts` or their paired
  tests; they are owned elsewhere and were consulted only for the row literals I
  cite as expected values.
- The `commitUpdatePhase3a` **commands** catch (`update.ts:2099–2103`) that slice
  C flagged as possibly untested file-wide: my range does not reach it either.
  The authoritative check belongs to slice A, which owns
  `phase3a-commands-fail` at 3643 — that case is in slice A's range and looks
  like the intended owner, so slice C's flag is probably resolved there.
- No coverage tooling was run (diagnostic constraint); every branch claim above
  is from reading the source, not from measurement.

## Meta-findings impact

### New cross-cutting evidence

- **"Swallow" / "swallows" / "never fails the X" test titles are a systematic
  vacuity trap.** Both cases in this range whose title names a swallowed error
  (6394, 6576) prove the *state* consequence and the *count* of notifications,
  neither of which differs between swallowing the error and letting it propagate
  — because the propagated throw is itself caught one frame up and rendered as
  exactly one notification. Any orchestrator with a `catch { /* D-19-01 */ }`
  around post-commit hygiene has the same shape. **Check for this specific
  pattern in:** `orchestrators/plugin/install.ts` and `reinstall.ts` (their own
  GC-after-swap and completion-cache drops), `orchestrators/marketplace/update.ts`
  and `autoupdate.ts`, and `orchestrators/plugin/clone-gc.ts`. The
  discriminating assertion is always the notification *severity*, never its
  count.
- **A named injection seam that stops at the module boundary leaves exactly one
  case running against the live backend.** `updatePlugins` takes
  `cloneCacheSeam`; `updateSinglePlugin` (the `PluginUpdateFn` cascade
  entrypoint) does not, so `update.test.ts:7178` is the single git-source case in
  8,502 lines that reaches `DEFAULT_GIT_OPS`. Any file where a verb has both a
  direct and a cascade entrypoint should be grepped for the cascade-side cases
  and checked for the same one-case leak — `reinstall.ts`, `install.ts`'s
  reconcile entrypoint, and the `orchestrators/import/` cascade are the
  candidates. This is the same root cause as the first pass's `process.cwd()`
  finding: `PluginUpdateFn`'s signature is the shared constraint.
- **A production doc comment can state an emission ORDER the code does not
  honour, and no test will notice, because the standard `notifications.map(...).join("\n")`
  idiom destroys order.** `update.ts:2202–2207` says the S5 warning is emitted
  after the success row; it is emitted before. The join-then-match idiom appears
  in this file at 5480, 5582, 5672, 5744, 5808, 6811, 6972, 7069 and is common
  repo-wide. **Any area whose findings mention `notifications.map(n => n.message).join(...)`
  should be re-checked for an order contract stated in a comment.**
- **The `structuredClone`-on-auth defect in `tests/platform/git-ops-fake.ts` has a
  SECOND in-repo workaround, and it costs assertion power.**
  META records the workaround in `tests/orchestrators/marketplace/add.test.ts`.
  `tests/orchestrators/plugin/update.test.ts:164–181` carries the same
  strip-before-delegate wrapper for both `clone` and `resolveRemoteRef`. The
  consequence is not just duplication: because the wrapper strips `auth` before
  the fake records the call, **no test using `makeMockGitOps` can assert what
  auth reached `gitOps.clone`** — which is why the two auth cases (7081, 7131)
  had to introduce a separate seam-level capture (`capturingUpdateSeam`, 289–318)
  instead. Fixing the fake once (clone the non-function fields, keep the `auth`
  reference) deletes both workarounds and re-enables direct call-site auth
  assertions.

### Corrections to META-FINDINGS.md

- META item 3's file table ("Replace fragment assertions on rendered messages")
  still does not list `orchestrators/plugin/update.test.ts`. Slice C asked for it
  to be added for lines 7778–8215; this pass adds a **second, disjoint** cluster
  in the same file at 5907, 6124, 6166, 6449, 6762, 6938 and 7032 — the force-
  decline and git-source sections. Two independent slices finding disjoint
  clusters in a file the first pass described as "overwhelmingly whole-value"
  means the entry should be added with a scale of *~15 sites across three
  sections*, not as a footnote.
- No other META claim is contradicted. Its central caution — "clean verdicts are
  not reliable" — is again validated in the small: the first pass's blanket
  "none of the remaining structure in this file has findings" concealed three
  BLOCKERs and nine WARNINGs in this 3,070-line slice, on top of the one BLOCKER
  and four WARNINGs slice C found in its 1,232.

### Confirmations

- **META item 2 (test-only reset hooks over module-global state)** — independently
  confirmed from a fourth angle: `resetRoutingState()` is dynamically imported
  and called at the top of four cases in *this* range alone (5514, 5623, 5693,
  5772) purely because `rebuildRoutingTables()` leaks routing state across cases.
  The factory-owned-state fix META prescribes would delete all four calls and the
  four dynamic imports that carry them.
- **META item 1 (over-wide `ctx`/`pi` parameters force casts)** — confirmed:
  every one of this range's 47 cases flows through `makeCtx()`'s
  `as ExtensionContext` / `as ExtensionAPI` double cast (225–241).
- **META "Patterns to propagate" — whole-message assertion against hand-written
  strings** — confirmed and extended beyond `*.messaging.test.ts`: `4616`
  (DFEN-08) is the best in-orchestrator instance I saw in either slice, because
  it pairs a byte-exact whole-body literal with a *row-against-row* identity
  assertion (4740–4744) that catches drift moving two rows in the same wrong
  direction — a failure mode two independently-correct literals both stay green
  through. Worth promoting to the reference-implementation table alongside
  `tests/domain/device-flow-contract.ts`.
- **META "Offline fake that fails loudly on unplanned input"** — confirmed as
  already adopted here: `makeMockGitOps` passes
  `allowedRemoteUrls: UPDATE_REMOTE_URLS` (59–66, 145) into `createGitOpsFake`,
  so this file already follows the pattern META asks the other git fakes to
  adopt. The one case that escapes it (7178) escapes because it cannot inject the
  fake at all, not because the fake is weak.
