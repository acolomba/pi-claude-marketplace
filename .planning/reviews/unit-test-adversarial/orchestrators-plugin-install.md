# Orchestrators — plugin install

**Scope:** `tests/orchestrators/plugin/install.test.ts` paired with
`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
(`install.messaging.test.ts` excluded — owned by another reviewer)
**Test files reviewed:** 1 (9,431 lines, read in full)
**Production modules reviewed:** 1 (2,460 lines, read in full)

## Summary

This is one of the strongest-engineered files in the sweep. Nearly every case
follows the discriminating-assertion discipline to the letter: whole-message
byte-exact equality on notifications, `assert.deepStrictEqual` on the full
`InstallPluginOutcome`/`InstallLedgerResult` shape, errors asserted by
`instanceof` plus structured fields, real-filesystem fixtures with a fresh
`mkdtemp` per case, and an unusually thorough "retry proof" family that
fails every one of the five bridge phases in turn, asserts the exact undo
schedule, walks the entire on-disk tree before and after, and proves the
retry is idempotent. `strong-mock` is absent from the file, but every
collaborator that would otherwise need it is instead a real Fake
(`createGitOpsFake`/`createCredentialOpsFake`/`createDeviceFlowFake`) whose
recorded call state is asserted via `deepStrictEqual`, which satisfies the
same substance the rule is protecting. The three defects worth a fixing pass
are: (1) one genuine phase-rollback coverage hole — the mcp phase's real
`unstageMcpServers` removal branch is never exercised against actual staged
servers, only its early-return no-op; (2) four to six scattered weak
assertions (`notifications.length >= 1`, `outcome.status === "failed"` with
no cause check) that a wrong implementation could satisfy for the wrong
reason, all of which have a byte-exact sibling test elsewhere in the same
file to copy from; and (3) a duplicated architectural git-surface check that
belongs solely in `tests/architecture/no-orchestrator-network.test.ts`. The
production module is clean on style but carries three inline `new Date()`
calls and one `homedir()` call that force several tests into weaker
"not-equal-to-a-fixed-past-value" assertions instead of exact ones, plus one
stale doc comment describing a re-export that no longer exists.

## Unit test findings

### `tests/orchestrators/plugin/install.test.ts`

- **[BLOCKER] No case proves the mcp phase's real `unstageMcpServers` removal on rollback** — `runInstallLedger unwinds the completed phases when a plugin appears at state commit` (`line 7385`) and `runInstallLedger unwinds when its marketplace disappears before state commit` (`line 7445`)
  Both tests force the **state** phase (the phase immediately after mcp) to
  throw, which is the only place in the phase order where `mcpPhase.undo`'s
  real removal branch (`mcpPrep !== undefined`, real `unstageMcpServers` call)
  can be reached — every other "retry proof" test fails *at or before* the
  mcp phase, so mcp's undo there only ever hits the harmless
  `if (c.mcpPrep === undefined) return;` early return. Both existing tests
  use the `"empty"` fixture (`seedPathMarketplaceWithPlugin({ pluginName:
  "empty" })`, no `mcpServers`), so `resolved.mcpServers` is `{}` and there is
  nothing on disk for `unstageMcpServers` to remove — neither test reads
  `mcp.json` before or after. This means a wrong implementation that skips
  calling `unstageMcpServers` entirely, or calls it with the wrong plugin/
  marketplace key, would pass every existing case. Add a case that reuses the
  same `Proxy`-on-`state.marketplaces.mp.plugins` race technique (as at
  `line 7410` or `line 7461`) against a plugin seeded with real `mcpServers`,
  and assert `mcp.json` no longer contains the plugin's server entries after
  `runInstallLedger` rejects (mirror the disk assertions already used for
  skills/commands/agents/hooks at `lines 3372-3382`, `3428-3438`, `3487-3497`,
  `6637-6641`).

- **[BLOCKER] Weak "at least one notification" assertions instead of content checks** — `lines 5539, 5652, 6063, 6110`
  `test("FORCE-03: without force an unsupported plugin still blocks and
  writes no state record", ...)`, `test("FORCE-05: force cannot bypass a
  missing marketplace", ...)`, and both `test("PURL-03: a git-subdir path
  escaping the clone root fails the install", ...)` /
  `test("PURL-03: a missing git-subdir path fails the install", ...)` each
  assert only `assert.ok(notifications.length >= 1, "...")`. A wrong
  implementation that blocks for an unrelated reason, or that emits any
  stray notification at all while a bug lets the escape/missing-subdir
  install through some other guard, satisfies this. Every one of these four
  tests has a byte-identical sibling in the same file that already does this
  correctly and can be copied: `FORCE-05: force cannot bypass an unavailable
  (structural) plugin` (`line 5590`, asserts
  `message.includes("(unavailable)")` plus zero warnings), and the `PI-4`
  test at `line 805` (exact byte message). Replace each `notifications.length
  >= 1` assertion with a check on the actual failure classification (e.g.
  `message.includes("(unavailable)")` for FORCE-03, the exact
  `{marketplace not added}` byte form used at `lines 758-761` for FORCE-05's
  missing-marketplace case, and a distinguishing token for each PURL-03 case
  so "escapes" cannot be silently reclassified as "missing-subdir" or vice
  versa).

- **[BLOCKER] Orchestrated failure-classification tests skip the outcome's cause/error** — `test("Orchestrated-PI-4: non-installable plugin -> outcome.status 'uninstallable', no notification", ...)` (`line 3549`) and `test("Orchestrated-PI-5: already installed -> outcome.status 'already-installed', no notification", ...)` (`line 3581`)
  Both assert only `assert.equal(outcome.status, "failed")`. The immediately
  preceding sibling, `Orchestrated-PI-3` (`line 3512`), does it right:
  `assert.match((outcome as { cause: string }).cause, /not found in
  marketplace/)`. Without an equivalent check here, a `classifyInstallFailure`
  regression that always reports the same generic failure — collapsing PI-3,
  PI-4 and PI-5 onto one indistinguishable outcome — passes both tests
  despite the titles claiming to test the *specific* branch. Add
  `assert.match((outcome as { cause: string }).cause, /is not installable/)`
  to the PI-4 case and `/is already installed/` to the PI-5 case (or assert
  `outcome.error instanceof PluginShapeError` plus its `.kind` field, which
  is the structured-field form the skill prefers over message matching).

- **[WARNING] Stub given a call-count assertion instead of relying on the outcome** — `line 7670` (`validation.mock.callCount()`), with weaker instances at `line 8108` (`parse.mock.callCount() >= 1`) and `line 8334` (`mkdirMock.mock.callCount(), 1`)
  `test("install rejects the selected entry when its defense-in-depth
  validator fails", ...)` stubs `PLUGIN_ENTRY_VALIDATOR.Check` to return
  `false` (a stub driving one path) and then asserts
  `assert.strictEqual(validation.mock.callCount(), 1)`. The test's
  `assert.deepStrictEqual(outcome, {...})` already fully discriminates the
  behavior under test; the call-count assertion adds only implementation
  coupling ("how many times is `Check` invoked") that a correct
  re-implementation calling it zero or two times would fail for a reason
  unrelated to the test's title. Drop the `callCount()` assertion, or if the
  exactly-once-call contract really is the promise being tested, restate it
  through `strong-mock` with `exactParams: true` and `verify()`. The two
  filesystem-mock instances at 8108/8334 are lower-priority — they piggyback
  on an `fs` fault-injection double, and the `mkdir` one (`line 8334`) does
  encode a real "no retry" claim — but consider whether the surrounding
  outcome/state assertions in those same tests already make the count
  redundant before keeping it.

- **[WARNING] Redundant architectural git-surface check duplicated from the dedicated architecture suite** — `test("PI-2 / NFR-5: install.ts has zero git surface (no platform-git import, no DEFAULT_GIT_OPS, no gitOps field)", ...)` (`lines 3219-3230`)
  `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` is
  already one of the explicit `FORBIDDEN_TARGETS` in
  `tests/architecture/no-orchestrator-network.test.ts`, which checks the
  identical three patterns (`platform/git`, `DEFAULT_GIT_OPS`, `gitOps`) via
  the shared `assertNoForbiddenSurface` helper (`tests/architecture/
  source-scan.ts`) — plus a fourth pattern, `refreshGitHubClone`, that this
  file's ad hoc copy omits. This local copy re-implements comment-stripping
  by hand (`src.replace(/\/\*[\s\S]*?\*\//g, "")...`) instead of reusing the
  canonical helper, so the two copies can silently drift (as they already
  have, missing one pattern). Delete this test from `install.test.ts`; the
  architectural invariant is exhaustively owned and documented at the
  dedicated location, and `install.test.ts`'s job is `installPlugin`'s
  runtime behavior, not a static source-text scan.

- **[WARNING] `in`-check plus unnecessary `as` cast instead of the narrowing idiom used elsewhere** — `lines 3640-3641`, and the same shape at `lines 793, 3541-3542, 3924-3925`
  `assert.ok("resourcesChanged" in outcome); assert.equal((outcome as {
  resourcesChanged: boolean }).resourcesChanged, true);` — the `in` check is
  redundant with the following line, and the `as` cast bypasses the
  discriminated-union narrowing this same file uses correctly elsewhere
  (`assert.ok(outcome.status === "installed")` then reading the field
  directly with no cast, e.g. `lines 2719, 2762, 5390, 5406`). Replace with
  `assert.ok(outcome.status === "installed"); assert.equal(outcome
  .resourcesChanged, true);` and apply the same fix at the other three
  locations (`"cause" in outcome && typeof outcome.cause === "string"` then
  a follow-up `as`-cast `.cause` read).

- **[WARNING] Four different idioms for "does this path exist" scattered through the file** — `lines 3374-3382, 3430-3438, 3489-3497` (manual `try/stat/catch` with a local `exists` flag), `lines 6632-6636` (inline `survives` helper using `.then(() => true, () => false)`), many places using `await assert.rejects(stat(...))`, and a single use of the already-imported `pathExists` helper at `line 8419`
  Purely a readability nit — pick one idiom (the file already imports
  `pathExists` from `shared/fs-utils.ts` at `line 41` but uses it exactly
  once) and use it for every "assert this path is gone" / "assert this path
  survives" check, including the three `Rollback-*-undo` tests at
  `lines 3335, 3393, 3449` which currently hand-roll the try/catch.

- **[WARNING] `ctx.ui.notify` recorder is a hand-rolled sink, not `strong-mock`** — `makeCtx()`, `lines 282-299`
  This matches the anti-pattern description literally
  (`{ notify: (...) => calls.push(...) }`), and `notify` is exactly the kind
  of "public behavior" collaborator the rule reserves for `strong-mock`.
  However, every case in this file asserts the recorded array via whole-value
  equality on the message text (`assert.equal(notifications[0].message,
  "...")` / `assert.deepStrictEqual(notifications, [...])`), never via call
  count or argument-matcher laxity — i.e. it is used as a **Fake** (a
  simplified stateful implementation, asserted on its resulting state), not
  as a **Mock** with a weakened interaction contract. Leaving it is
  defensible on that basis; flagging it here so the fixing pass makes that
  call deliberately rather than by omission, since this project's own
  architecture treats `notify()` output as the single documented
  return-adjacent channel of `installPlugin` in standalone mode, not an
  incidental interaction.

### Clean files

- No other test-support files are owned by this assignment
  (`createGitOpsFake`/`createCredentialOpsFake`/`createDeviceFlowFake` and
  `scope-tree-inventory.ts::retryTree` are used correctly from this file —
  hermetic, `boundary: "memory"`/`"local"` only, no live network or git
  reached anywhere in the suite — but each lives beside its own concern with
  its own paired test file and is out of this assignment's scope to grade in
  full).

## Production code findings

### `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`

- **[WARNING] Stale doc comment describes a re-export that no longer exists** — `lines 2456-2460` (end of file)
  ```
  /**
   * Test seam for the catch-site dispatch helpers. Helpers stay private to
   * the orchestrator; tests exercise the `instanceof PluginShapeError` +
   * `.kind` dispatch branches directly via this re-export.
   */
  ```
  This is the last thing in the file — there is no export, statement, or
  re-export following it. `grep -n "^export"` over the whole file lists only
  `InstallPluginNotifications`, `InstallPluginOptions`,
  `InstallCloneCacheSeam`, `InstallLedgerOptions`, `InstallFailureCapture`,
  `InstallLedgerSummary`, `InstallLedgerResult`, `runInstallLedger`, and
  `installPlugin`; none of them is a "test seam for the catch-site dispatch
  helpers." No test file in `tests/` imports any such thing from
  `install.ts` either. Delete the orphaned comment (it documents code that
  was apparently removed at some point and the trailing doc comment was
  never cleaned up with it) — this violates the project's own comment policy
  against narrating code that no longer exists.

- **[WARNING] Three inline `new Date()` calls and one `homedir()` call are hidden dependencies** — `lines 1088, 1180, 1389, 1437`
  `homedir()` (line 1088, hooks-phase `if:` predicate context) and
  `new Date().toISOString()` (lines 1180, 1389, 1437: state-phase
  `installedAt`/`updatedAt`, and the two disable-cascade timestamp writes)
  are all called directly rather than injected. The symptom is visible in
  the test file: several tests can only assert `assert.notEqual(...
  updatedAt, "2026-01-01T00:00:00.000Z")` (e.g. `tests/orchestrators/plugin/
  install.test.ts:8157-8160`) instead of an exact expected timestamp, because
  there is no way to pin the clock. Apply the sanctioned fix: add a `Clock`
  member (e.g. `{ nowIso: () => string }`) to `InstallLedgerOptions`,
  defaulting to a real clock at the real call sites in `installPlugin`
  (composition boundary), so a test can inject a fixed clock and assert the
  exact recorded timestamp rather than only its inequality with a stale
  literal. `homedir()` is lower priority (nothing currently asserts on it)
  but the same fix — thread it through `InstallLedgerOptions` — would remove
  the last untestable OS read from the ledger body.

- **[WARNING] `credentialOps` parameter defaults to the live boundary inside the module, not at a composition root** — `line 747` (`opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS`)
  The style guide's rule is that a parameter should not default to a live
  boundary — real adapters should wire up once, in a composition module —
  so that every caller of `preflightInstallResolve` is forced to state its
  credential source explicitly rather than silently inheriting the real one.
  This is a narrower, already-documented exception (`PROV-03 / D-79-05`) than
  the general case the rule targets, and every test in this file does inject
  `credentialOps` explicitly, so there is no live coverage gap today —
  flagging it only so a future non-test caller that forgets to pass
  `credentialOps` doesn't silently get the real git-credential store instead
  of a compile error.

- **[note, not a finding] `installPlugin` itself is ~490 lines** (`lines 1922-2416`) with deep, well-commented conditional logic (config write-target selection, DFEN-04 disable-on-install, hooks cache/routing). This is very likely already gated (or exempted) by `fallow`'s per-function `maxUnitSize`/`maxCyclomatic`/`maxCognitive` thresholds referenced in this project's own conventions, so it is not raised as a style finding here — see the "split" recommendation below instead, which is about test-surface reduction, not the toolchain gate.

### Should the module be split? (assignment item 7)

Given 9,431 test lines against one 2,460-line module, yes — two coherent,
independently-testable concerns are currently bundled into `install.ts` and
can only be exercised through full, disk-backed `installPlugin()` runs
(seeded marketplaces, real fixtures, injected filesystem faults), which is a
large part of why the test file is as large as it is:

1. **DFEN-05 declared-enabled precedence reader** — `declaringPluginMaps`,
   `entryFor`, `readDeclaredEnabled` and the `PluginConfigMap`/
   `PluginConfigEntry` type aliases (`lines 1477-1512`). This is a pure
   function of two parsed `ScopeConfig` objects and a key string. Today the
   ~10-row `DFEN_PRECEDENCE_CASES` matrix (`lines 1454-1769`) and the
   DFEN-08 parity test (`line 1794`) each have to seed a full marketplace on
   disk, run a real install, and read `state.json`/`claude-plugins.json`
   back to prove one precedence decision. Extracting this into a leaf module
   (e.g. `orchestrators/plugin/declared-enabled.ts`) would let most of that
   matrix become fast, literal-object unit tests, with `install.test.ts`
   keeping only one or two true end-to-end wiring proofs.

2. **DFEN-04 "install lands disabled" cascade composition** —
   `disableFreshlyInstalledPlugin`, `foldFailedDisableCascade`,
   `locateFreshlyInstalledRecord`, `dropInstallDisabledHooks`, and the
   `MarketplaceStateRecord`/`InstalledPluginRecord` type aliases
   (`lines 1330-1446`). This composes `cascadeUnstagePlugin` +
   `applyPartialCascadeFold` + `toDisabledRecord` — the same primitives the
   `disable` verb composes — and today it can only be exercised by running a
   full install with a filesystem fault injected mid-cascade (the D-102-02
   test at `line 2298`, and the "retry proof: install: disabled cascade
   failure..." test at `line 7872`, each ~130 lines of fixture setup).
   Extracting it into its own sibling module (e.g.
   `orchestrators/plugin/install-disable-cascade.ts`) would let its fold
   logic be unit-tested against a fake `UnstageOutcome` directly.

3. Lower priority: the post-commit row/outcome composers
   (`composeDisabledRow`, `composeInstalledRow`, `malformedRowReasons`,
   `droppedKindRowReasons`, `buildInstalledOutcome`, `failedRowOutcome`,
   `handleInstallThrow`) sit awkwardly split from the sibling
   `install.messaging.ts`, which already owns the closely related
   `classifyEntityShapeError`/`composeInstallFailureMessage`/
   `classifyInstallFailure`. Folding these into `install.messaging.ts` (or a
   new `install-outcome.ts`) would leave `install.ts` itself holding only
   the ledger construction (`runInstallLedgerBody`, the six `Phase<InstallCtx>`
   definitions) and the `installPlugin` entrypoint's wiring — the two things
   that actually need the full lock + disk-backed integration test style
   this file already does so well.

### Clean files

- None — the one production module in scope, `install.ts`, carries findings above.

## Not covered

- The three test-support fakes (`tests/platform/git-ops-fake.ts`,
  `tests/platform/credential-ops-fake.ts`, `tests/domain/device-flow-fake.ts`)
  and their own paired test files were not reviewed in depth — they belong
  to other areas of the sweep and are only checked here for correct usage
  from `install.test.ts`'s call sites.
- `install.messaging.ts` and `install.messaging.test.ts` were excluded per
  the assignment and not reviewed.
