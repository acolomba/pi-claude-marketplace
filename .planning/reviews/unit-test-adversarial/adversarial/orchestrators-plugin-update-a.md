# Orchestrators — plugin update (slice A) — adversarial re-review

**Scope:** `tests/orchestrators/plugin/update.test.ts` lines 1–4200 — the module
helpers/seeders (1–650) and the preflight/resolution/phase-3 case sections
(PUP-1..9, LIFE-05, UGRM-02, NFR-5, cascade classification, ATTR-02/SCOPE-01,
syncClone failure, prepare-handles, TR-04 matrix, WB-01) — 65 cases — plus the
production arms those cases reach in
`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
(`updatePlugins`, `makeSyncCloneOnce`, `buildDirectThreePhaseArgs`,
`handleEnumerateFailure`, `isPhase3aAggregateFailure`, `renderUpdateCascadeIfAny`,
`updateSinglePlugin`, `reasonsFromTypedError`, `enumerateTargets`,
`enumerateMarketplaceTarget`, `resolveUpdateMarketplaceScope`,
`triageUpdateMembership`, `staticPreflightRow`, `preflightUpdate`,
`resolveUpdateCandidate`, `prepareUpdateHandles`, `abortPartialHandles`,
`abortHandles`, `commitUpdatePhase3a`, `finalizeUpdateRecord`,
`applyPerBridgeResources`, `notifyDirectFailure`, `narrowDirectFailReason`,
`projectSkippedOutcome`, `outcomeToCascadePluginMessage`,
`renderUpdateCascadeAndNotify`). Lines 4200–8502 belong to slices B and C; I read
4507–4700, 5089–5200, 6341–6500 and 7081–7180 only to settle whether a sibling
case kills a mutation my range survives, and did not grade them.
**First-pass file:** `unit-test-findings/orchestrators-plugin-update.md`
**Clean files attacked:** 1 (the first pass declared everything outside its five
findings clean in one prose paragraph; this pass attacked the 65 cases and ~26
production functions in the assigned range)
**Existing findings graded:** 9

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 7 |
| New WARNING (missed by first pass) | 12 |
| Existing CONFIRMED | 6 |
| Existing UNDERSTATED | 2 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 1 |

## New findings — from the clean lists

### `tests/orchestrators/plugin/update.test.ts`

- **[BLOCKER] `swapState-version-advanced` asserts nothing: its fixture cannot
  produce an update at all** — `test('swapState-version-advanced: version advanced during fetch -> update runs against newer fromVersion', ...)`, lines 3556–3639
  The case's whole assertion set is `notifications.length >= 1` and
  `errs.length === 0` (3632–3634). Its comment claims "The update proceeds
  successfully." It does not. The seeded marketplace is a copy of
  `tests/orchestrators/marketplace/_fixtures/valid-marketplace/`, which ships
  **only** `.claude-plugin/marketplace.json` — no `plugins/hello` tree (the
  fixture README states the plugin sub-trees deliberately do not exist, and this
  same file's PUP-2 comment at 1175–1180 says the resolver "will later mark
  plugin entries as not-installable"). So `resolveUpdateCandidate`
  (`update.ts:1000`) throws `requireInstallable` before the version comparison is
  ever reached, the outcome is `(skipped) {no longer installable}`, and
  `cascadeSkipSeverity` maps that to **info** on the plural form
  (`update.ts:2495–2497`) — so `errs.length === 0` holds. Every mutation to the
  behaviour the title names survives: reading the pre-fetch (stale) state,
  skipping the plugin entirely, or deleting the fromVersion re-read.
  Fix: after `cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir)`, write a
  real plugin tree into the clone (`<cloneDir>/plugins/hello/.claude-plugin/plugin.json`
  with `{name:"hello"}` and `<cloneDir>/plugins/hello/skills/tool/SKILL.md`,
  mirroring `seedPathMarketplace`'s writer at 521–540), then replace both
  assertions with `assert.equal(notifications[0]?.message, "● official [project]\n  ● hello v0.0.10 → v1.0.0 (updated)\n\nPlugin update: 1 updated\n\n/reload to pick up changes")`
  and `assert.equal((await loadState(locations.extensionRoot)).marketplaces["official"]?.plugins["hello"]?.version, "1.0.0")`. The `v0.0.10` left side is the
  fromVersion the case exists to prove.

- **[BLOCKER] `swapState-mp-gone` cannot distinguish its named path from the same
  fixture's baseline skip** — `test('swapState-mp-gone: marketplace removed via gitOps.fetch side-effect -> graceful skipped outcome', ...)`, lines 3389–3464
  Same root cause. The assertions are `notifications.length >= 1`,
  `errs.length === 0`, and `assert.match(body, /skipped/)` (3455–3459). With the
  marketplace removed, `preflightUpdate`'s `mp === undefined` arm
  (`update.ts:1182–1189`) renders `⊘ hello (skipped) {not in manifest}`; **without**
  the removal the same fixture renders `⊘ hello v0.0.9 (skipped) {no longer installable}`.
  Both match `/skipped/` and both leave `errs` empty, so deleting the
  `mp === undefined` arm entirely (letting the flow fall through to the candidate
  decline) passes unchanged. Fix: byte-pin the body. Derive it from the PUP-5 pin
  at line 811 minus the `v<from>` token — the mp-undefined arm calls
  `staticPreflightRow` with **no** `fromVersion` (`update.ts:1183–1188`), so the
  absent `v0.0.9` and the `{not in manifest}` brace are together exactly what
  separates this arm from the baseline — and add
  `assert.equal(notifications[0]?.severity, "warning")`.

- **[BLOCKER] `prepare-handles-fail`'s reason assertion passes only because the
  fixture server is named `rollback-server`** — `test('prepare-handles-fail: MCP collision in prepareStageMcpServers -> abortPartialHandles fires, outcome=failed', ...)`, line 3175
  `assert.deepEqual(outcome.reasons, ["rollback partial"])` is satisfied by
  `reasonsFromTypedError` (`update.ts:675`, `note.includes("rollback")`) matching
  the substring inside `McpServerCollisionError`'s message
  (`errors-bridges.ts:83`: `Refusing to stage MCP server "rollback-server": already exists in …`).
  No rollback classification applies — the fixture name at 3146/3159 supplies the
  token. Rename the server to `dup-server` and the same production code returns
  `["not in manifest"]`, which is what a real MCP collision classifies as today
  (see the production BLOCKER below). Fix: rename the collided server to
  `dup-server` in both the plugin `.mcp.json` (3146) and the pre-populated scoped
  `mcp.json` (3159), then assert the reason the production code actually produces;
  if `["not in manifest"]` is judged wrong, that is a production fix to make
  first, not an expectation to re-pin.

- **[BLOCKER] `UpdatePluginsOptions.mapModel` has no owning case in the paired
  test module** — `update.ts:243` / `update.ts:328` / `update.ts:1351`
  `grep -c mapModel tests/orchestrators/plugin/update.test.ts` is **0** across all
  8,502 lines. Mutating `buildDirectThreePhaseArgs` (`update.ts:328`) from
  `mapModel: opts.mapModel ?? false` to the constant `false` — deleting the
  `--map-model` pass-through outright — leaves the whole file green. The only
  coverage in the repo is `tests/edge/handlers/plugin/update.test.ts`, which
  reaches it by running the real orchestrator end-to-end because the handler has
  no injection seam (its own header documents this as D-116-05 Group C). That is
  an ownership inversion under the pairing rule, and it is a **sequencing hazard**:
  adding the handler injection seam (META item 4) deletes the only case that
  exercises `mapModel` through `updatePlugins`. Fix: add one case to this file
  that seeds an agent whose source frontmatter carries `model: sonnet`, runs
  `updatePlugins({..., mapModel: true})`, and asserts the staged
  `<agentsDir>/<GENERATED_AGENT_PREFIX>hello-bot.md` contains `^model: ` — plus a
  sibling with the flag omitted asserting the line is **absent** (AG-7 is
  opt-in, so absence, not `false`, is the contract).

- **[BLOCKER] No case pins the subject name of either `notifyDirectFailure` row
  `updatePlugins` emits** — group of 13 cases: 2883, 2935, the 10-row loop at
  3024, 3325 (syncClone arm) and 3064 (phase-2 arm)
  The syncClone arm passes `pluginName: t.marketplace` (`update.ts:408`, an
  explicitly documented Option-B design choice); the phase-2-or-earlier arm passes
  `pluginName: t.plugin` (`update.ts:430`). **Swapping the two survives every one
  of the 13 cases**, because each asserts only a reason brace
  (`new RegExp("\\{" + reason + "\\}")`, 3050), a cause-text fragment (2928, 2965,
  3107), or a name that also appears in the marketplace header (3380 asserts
  `/zzz/`, which matches `● zzz [project]`). `grep '(failed)'` over the whole file
  confirms the only byte-pinned `(failed)` rows are the four
  `{marketplace not added}` ones and the triage `{not in manifest}` one — no case
  anywhere pins a `notifyDirectFailure` row. Fix: byte-pin one case per arm using
  the `assert.deepEqual(notifications, [{ message: … }])` form this file already
  uses at 1113–1118; for the syncClone arm pin `"A plugin operation has failed.\n\n● official [project]\n  ⊘ official (failed) {network unreachable}"` as the
  message *prefix* (`assert.ok(message.startsWith(…))`) and keep a regex only for
  the 4-space cause-chain tail; for the phase-2 arm (3064) pin
  `⊘ hello (failed) {invalid manifest}` the same way.

- **[WARNING] `WR-04` asserts existence and length where the whole value is the
  promise** — lines 2340–2346
  `assert.ok(outcome.stagedAgentNames !== undefined)` +
  `assert.ok(outcome.stagedAgentNames.length > 0)` (and the same pair for
  `stagedMcpServerNames`) pass for any non-empty array — returning the skill names
  in the agent slot, or swapping the two fields, survives. The case's own state
  assertions ten lines down already know the right literals (2366–2367). Replace
  the four `assert.ok`s with
  `assert.deepEqual([...outcome.stagedAgentNames], [`${GENERATED_AGENT_PREFIX}hello-bot`])`
  and `assert.deepEqual([...outcome.stagedMcpServerNames], ["server1"])`.

- **[WARNING] `PUP-8` asserts only a negative** — `test('PUP-8: no plugin updated -> no reload hint', ...)`, lines 1376–1407
  The single assertion is `body.includes("/reload to pick up changes") === false`,
  where `body` defaults to `""` if no notification was produced. Any mutation that
  makes the run fail, emit nothing, or emit an error passes. PUP-3 (713) already
  byte-pins the identical scenario, so the fix is cheap: assert the whole message
  (`"● mp [project]\n  ⊘ hello (skipped) {up-to-date}"`) and
  `notifications.length === 1`, keeping the reload-hint absence as a second,
  supporting assertion rather than the only one.

- **[WARNING] `PUP-9 cascade vs direct` uses `>= 1` and never reads the cascade
  outcome's `reasons`** — lines 1457–1474
  `assert.ok(errs.length >= 1)` admits a duplicate-emission regression the sibling
  at 2121 explicitly guards against, and `assert.ok((cascadeOutcome.notes ?? []).length > 0)`
  passes for any note text. This is also the **only** site that could own
  `reasonsFromTypedError`'s permissive `["not in manifest"]` fallback
  (`update.ts:687`) and it does not assert it. Change to
  `assert.equal(errs.length, 1)` and add
  `assert.deepEqual(cascadeOutcome.reasons, ["not in manifest"])` plus
  `assert.match(cascadeOutcome.notes?.[0] ?? "", /schema invalid|JSON/)`.

- **[WARNING] The two gitOps call-surface proofs check counts, not arguments, and
  the NFR-5 proof checks four of six recorded arrays** — lines 1221–1223 (PUP-2)
  and 1256–1259 (NFR-5)
  `makeMockGitOps` exposes six recorded call arrays and `createGitOpsFake`
  `structuredClone`s the full option object for each
  (`tests/platform/git-ops-fake.ts:129–203`), and the sibling at **1119–1124**
  already asserts all six with `assert.deepEqual(…, [])`. PUP-2 asserts only three
  lengths — passing the wrong `cloneDir` to `refreshGitHubClone`
  (`update.ts:298`) survives. NFR-5 omits `cloneCalls` and `resolveRemoteRefCalls`
  entirely, so a spurious `clone` on the path-source path survives the very case
  that exists to forbid it. Fix: in NFR-5 replace the four length checks with the
  six-array `assert.deepEqual(…, [])` block copied from 1119–1124; in PUP-2 keep
  the counts but add `assert.equal(state.fetchCalls[0]?.dir, await locations.sourceCloneDir("official"))`.
  (The fetch→forceUpdateRef→checkout *ordering* belongs to
  `refreshGitHubClone` in `orchestrators/marketplace/shared.ts`, not here.)

- **[WARNING] The bare-form project-before-user tie-break is unexercised** —
  `test('bare-form both-scopes: changed plugins render marketplace groups in presentation order', ...)`, lines 3259–3266, against `update.ts:3010–3013`
  `enumerateTargets` iterates `["project", "user"]` and its comment cites MSG-GR-3
  so that "same-name cross-scope stable-sort ties render project-before-user".
  The case seeds `mp-proj` and `mp-user`, and
  `renderUpdateCascadeAndNotify` sorts blocks with `compareByNameThenScope`
  (`update.ts:2726–2728`) — so `mp-proj` precedes `mp-user` alphabetically no
  matter which scope was enumerated first. Reversing the array to
  `["user", "project"]` survives. Fix: add a sibling case seeding the **same**
  marketplace name `mp` in both scopes (the catalog's `same-mp-both-scopes`
  fixture shape, cited at `update.ts:2753`) and assert
  `body.indexOf("● mp [project]") < body.indexOf("● mp [user]")`.

- **[WARNING] 13 comments cite production line numbers that no longer exist, and
  three name symbols that were never or are no longer in the file** — lines 2881,
  2911, 3060, 3067, 3114, 3119, 3121, 3186, 3246, 3273, 3280, 3466, 3641, 3647,
  3718, 3724
  Every `(lines NNN-MMM)` citation is stale against the current 3,156-line
  `update.ts` (e.g. "lines 690-696 notifyWarning" points into a doc comment on
  `ThreePhaseArgsBase`). Worse, three of the named symbols do not exist at all:
  `grep -c` in `update.ts` returns **0** for `swapStateRecord` (3323, 3466), `0`
  for `notifyWarning` (3273, 3280), and `0` for `PLUGIN_ENTRY_VALIDATOR` /
  `MARKETPLACE_VALIDATOR` (3060, 3068–3070) — so the 3060–3070 comment's entire
  "structurally unreachable" argument describes code that is not in this module.
  Fix rule: delete every `(lines N-M)` citation and replace it with the **function
  name** it means (`syncCloneOnce`'s catch in `updatePlugins`,
  `abortPartialHandles`, `dropPluginCompletionCache`, `commitUpdatePhase3a`'s
  commands/agents catch, `enumerateTargets`' bare-form loop); delete the
  `swapStateRecord` / `notifyWarning` / `PLUGIN_ENTRY_VALIDATOR` sentences
  outright. Names survive refactors; line numbers do not — this is the same
  comment-rot class the repo's `typescript-comments.md` bans for planning refs.

- **[WARNING] The two-notification ordering on the WR-01 abort path is unpinned** —
  lines 2296–2310
  `updatePlugins` emits the failure inline from `runThreePhaseUpdate` and only
  then calls `renderUpdateCascadeIfAny` (`update.ts:455–463`), so the order is
  promised. The case uses `notifications.find(...)` twice, which passes for either
  order. Change to index assertions:
  `assert.match(notifications[0]?.message ?? "", /plugin-uninstall \+ plugin-install for "zzz"\./)`
  and `assert.match(notifications[1]?.message ?? "", /● aaa v1\.0\.0 → v1\.0\.1 \(updated\)/)`.

- **[WARNING] The cascade's write-back suppression (`!args.cascade`) has no case** —
  `update.ts:1993`
  Dropping `!args.cascade` from that condition — letting the marketplace
  autoupdate cascade write `claude-plugins.json`, the WR-09 semantics the comment
  at 1986–1989 forbids — survives the whole file: no `updateSinglePlugin` case
  reads `locations.configJsonPath`. Fix: in the existing WR-04 cascade case
  (2319), seed the config through `saveConfig` before the call and assert
  `assert.deepEqual(await readFile(locations.configJsonPath), bytesBefore)` after,
  mirroring the direct-path byte-stability assertions at 4160–4161.

- **[WARNING] `finalizeUpdateRecord`'s `updatedAt` stamp is asserted by no case** —
  `update.ts:1983`
  Deleting `sRecord.updatedAt = new Date().toISOString()` from the finalize window
  leaves all 8,502 lines green: the only `updatedAt` reads in the file (5167,
  5195) belong to `refreshDisabledRecord`'s separate write site (`update.ts:1713`).
  The doc comment at 1936–1937 calls the both-branch stamp load-bearing ("even a
  failed finalize is a truthful 'we touched this record' stamp"). Fix: the seeded
  stamp is the fixed literal `"2026-01-01T00:00:00.000Z"` (428), so add
  `assert.notEqual(record.updatedAt, "2026-01-01T00:00:00.000Z")` to the PUP-6
  happy case (977) **and** to the skills-only-fail matrix case (3806) — the second
  is what pins the failure branch.

- **[WARNING] `assertNoCrossPluginConflicts` on the update path has no case** —
  `update.ts:2276`
  `grep -ci conflict tests/orchestrators/plugin/update.test.ts` is **0**. Deleting
  the call leaves the file green. (The narrower `removePluginRecord` self-exclusion
  at 2275 *is* killed, incidentally, by the out-of-range DFEN-08 case at 4616,
  which installs three plugins for real and then updates them — without the
  exclusion each would self-conflict on its own recorded skill name.) Fix: add one
  case seeding two plugins in the same marketplace where the update of `beta`
  would generate a skill name already recorded by `alpha`, and assert the
  resulting `(failed)` row names the conflict.

- **[WARNING] Two cases assert the agents bridge's rendered file body** — lines
  1111–1112 and 1164–1165
  `assert.match(agent, /^- \`hello:tool\` → skill \`hello-tool\` \(available on demand\)$/m)`
  pins the preload-bullet format, which is
  `bridges/agents/`'s contract and is owned by `tests/bridges/agents/convert.test.ts`.
  The update-specific fact is only that `prepareUpdateHandles` threads
  `knownSkills` from the freshly-staged skills (`update.ts:1347`). Keep
  `assert.match(agent, /^skills: hello-tool$/m)` — which does prove the threading —
  and drop the bullet-format regex.

## Export ownership census

Field-level census of `UpdatePluginsOptions` (the module's real parameter
surface; the five top-level exports were censused by slice C and all are owned).

| Module | Export / field | Owning case | Status |
| --- | --- | --- | --- |
| `update.ts` | `updatePlugins` | 653, 673, 728, … (≈50 in range) | owned |
| `update.ts` | `updateSinglePlugin` | 1133, 1411, 1435, 1483, 1518, 1555, 1591, 1642, 2319, 2378, 2419, 2505, 2542, 3116 | owned |
| `UpdatePluginsOptions` | `ctx` / `pi` | every direct case | owned |
| `UpdatePluginsOptions` | `scope` (explicit) | 2675, 2705, 2761, 2807 | owned |
| `UpdatePluginsOptions` | `scope` (omitted → both scopes) | 2733, 2844, 3188 | owned |
| `UpdatePluginsOptions` | `cwd` | every case | owned |
| `UpdatePluginsOptions` | `target.kind: "all"` | 653, 934, 3188, 3325 | owned |
| `UpdatePluginsOptions` | `target.kind: "marketplace"` | 885, 1171, 1232, 1268 | owned |
| `UpdatePluginsOptions` | `target.kind: "plugin"` | 673, 728, 780, … | owned |
| `UpdatePluginsOptions` | `gitOps` | 1171, 1232, 2883, 3024, 3325 | owned |
| `UpdatePluginsOptions` | `credentialOps` | 1067 (negative: zero calls), 7113 | owned |
| `UpdatePluginsOptions` | `deviceFlowHttp` | 1067 (negative), 7114 | owned |
| `UpdatePluginsOptions` | `cloneCacheSeam` | 6365 ff. (slice B) | owned |
| `UpdatePluginsOptions` | `authMemo` | 7102–7123 (slice B) | owned |
| `UpdatePluginsOptions` | `local` | 4250, 5470 (slice B) | owned |
| `UpdatePluginsOptions` | `partial` | 4376 ff. (slice B) | owned |
| `UpdatePluginsOptions` | **`mapModel`** | — | **NO CASE** (see BLOCKER) |

## Branch census

Branches in the production arms this range owns, classified:

- `makeSyncCloneOnce` memo key `${scope}/${mpName}` (`update.ts:282`) —
  **reachable, half-tested.** Dropping `mpName` is killed by 3325 (two
  marketplaces, the second must throw). Dropping `scope` survives: no case has the
  same marketplace name in both scopes. Same fixture gap as the tie-break WARNING
  above; one new case closes both.
- `makeSyncCloneOnce` path-source noop arm (`update.ts:300`) — covered by NFR-5
  (1232), though incompletely (see WARNING).
- `updatePlugins` empty-targets arm (`update.ts:371–376`) — covered byte-exactly
  by 653.
- `updatePlugins` syncClone catch + `return` (`update.ts:392–412`) — reachable and
  covered for the *reason* axis (13 cases) but not the *subject* axis (BLOCKER).
  The early `return` is killed by 3325's `notifications.length === 1`.
- `updatePlugins` phase-2 catch + `return` (`update.ts:417–434`) — covered by
  3064 and 1435; the `return`'s batch-abort promise is untested (no case has a
  second plugin after a phase-2 throw). Reachable-untested, low value.
- `isPhase3aAggregateFailure` (`update.ts:566–570`) — both conjuncts killed:
  dropping the `phaseFailures !== undefined` check makes the triage `(failed)` row
  at 2632 render nothing, failing its byte compare.
- `renderUpdateCascadeIfAny`'s `outcomes.length > 0` guard (`update.ts:586`) —
  killed by 2071 (`notifications.length === 1`).
- `cardinality` derivation (`update.ts:388`) — all three forms byte-pinned
  (780 single / 885 marketplace-bulk / 934 global-bulk).
- `triageUpdateMembership` — all three arms byte-pinned (2632 / 2588 / 780), plus
  the empty-`fromVersion` spread in `staticPreflightRow` (820).
- `preflightUpdate`'s `mp === undefined` arm (`update.ts:1182–1188`) —
  **reachable, non-discriminating** (see BLOCKER on 3389). Changing the reason to
  `"not found"`/`"not installed"` *is* caught (severity flips to error), but any
  other benign reason survives, and the row bytes are unpinned.
- `resolveUpdateCandidate` catch arms — network arm covered out of range (6762,
  7211); `isPartialableUpdateShapeError` arm byte-pinned in range (2463);
  structural fallback byte-pinned (728) and cascade-pinned (2419).
- `reasonsFromTypedError` (`update.ts:657–688`) — EACCES/EPERM (1555),
  ENOENT/ENOTDIR (1483, 1518), `concurrently uninstalled` (1591),
  `concurrently updated` (1642) all owned. The `rollback` arm's only case (3116)
  matches for the wrong reason (BLOCKER). The `["not in manifest"]` fallback is
  **reachable-untested** — 1435 is its only site and does not assert `reasons`.
- `abortPartialHandles` / `abortHandles` (`update.ts:1393–1416`) — reachable,
  state-only. First-pass BLOCKER stands and is understated: two of the three leak
  slots are structurally unobservable (production BLOCKER below).
- `commitUpdatePhase3a` — skills catch (2071, 3806), skills leak branch (1868),
  commands catch (3643, 3863 — **this closes slice C's open question**; it is
  covered), agents catch (3720, 3919), agents leak branch (1936), hooks catch
  (1693), mcp catch (2006). The **commands leak branch does not exist** — the
  return value is discarded (production BLOCKER below), so it is neither
  reachable-untested nor dead: it is unobservable by construction.
- `finalizeUpdateRecord` — `sMp === undefined` (1761), `sRecord === undefined`
  (1813), `allSucceeded` both directions (977 / 2071), `!args.cascade` gate
  **reachable-untested** on the cascade side (WARNING), `updatedAt` stamp
  **reachable-untested** on both sides (WARNING).
- `applyPerBridgeResources` — all four `!failedPhases.has(...)` gates covered in
  both directions by the TR-04 matrix (3806 / 3863 / 3919) plus WR-04 (2319); the
  mcp gate's blocked direction is documented as unreachable at 3975–3998 and that
  note is accurate (the only obstacle that forces an mcp commit failure also trips
  its prepare-time read) — this is a genuine **unreachable-by-real-input** entry,
  correctly documented rather than propped up.
- `outcomeToCascadePluginMessage`'s four-arm switch (`update.ts:2584–2627`) — has
  no `default`/`assertNever`, but it is **compiler-forced safe**, not a gap:
  `tsconfig.json` sets `noImplicitReturns: true`, so a fifth `partition` member
  raises TS7030 here. See the META correction below.
- `cascadeSkipSeverity` — error arm (2588, 2807, 2844, 3468), single→warning arm
  (728), `skipSeverity` fallback for `up-to-date` (673) and `not in manifest`
  (780). The plural→info arm for `no longer installable` is owned out of range
  (5956).
- No compiler-forced-unreachable (D-116-01a) branches were needed in this range
  beyond the switch noted above.

## Production code findings

### `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`

- **[BLOCKER] Three staging-cleanup leak descriptors are silently discarded; two
  named siblings already capture them** — lines 1400, 1404, 1413, 1414, 2100
  `abortPreparedCommands` and `abortPreparedSkills` both return
  `Promise<string | undefined>` (`bridges/commands/stage.ts:358–360`,
  `bridges/skills/stage.ts:377–379`) — a cleanup-leak descriptor. Both
  `abortPartialHandles` (1400, 1404) and `abortHandles` (1413, 1414) `await` them
  and throw the value away, pushing only the agents leak into `leaks`. So a leaked
  skills or commands staging tree on **either** abort path is never appended to the
  error and never reaches the user. Separately, `commitUpdatePhase3a` captures the
  skills leak (2088) and the agents leak (2107) but discards
  `commitPreparedCommands`'s (2100). The correct form exists twice in-repo:
  `orchestrators/plugin/reinstall.ts:1515,1519` wraps every abort in
  `pushLeak(leaks, "<phase>", await abortPrepared…(…))` (helper at 1581), and
  `orchestrators/plugin/install.ts:990` does `const leak = await commitPreparedCommands(prep)`.
  Fix: copy reinstall's `pushLeak` shape into both abort helpers and capture the
  commands commit leak in `commitUpdatePhase3a` the way skills and agents already
  are. This is also *why* the first pass's abort-path BLOCKER matters more than
  recorded — no test could have observed those leaks even had it looked.

- **[BLOCKER] `reasonsFromTypedError` and `narrowDirectFailReason` classify by
  substring over free-form error text, against this repo's own stated rule** —
  lines 675–687 and 2899–2924
  `CONVENTIONS.md` ("Discrimination") states callers narrow on `instanceof`,
  "never on message substring matching or `error.name` string comparison". Both
  functions do exactly that, over text that interpolates **user-controlled names**:
  plugin names, marketplace names, MCP server names, and filesystem paths all flow
  into the messages these ladders read. The concrete proof is in this file's own
  test fixture — an MCP server named `rollback-server` makes a collision classify
  as `{rollback partial}` (see the test BLOCKER above), and a normally-named
  server makes the same collision classify as the permissive `{not in manifest}`
  fallback (`update.ts:687`), which is wrong in the other direction. The same
  hazard sits in `narrowDirectFailReason`'s `text.includes("invalid")` arm
  (2920), which any marketplace or path containing "invalid" trips.
  Fix: add typed arms before the substring ladder — `err instanceof McpServerCollisionError`
  → the correct closed-set reason, `err instanceof PluginUpdatePhase3Error` →
  `"rollback partial"` — and reduce the substring ladder to a documented
  last-resort fallback with a comment saying so. The errno arms already ahead of it
  are the right shape.

- **[WARNING] The module header describes a phase-2 design the body explicitly
  disclaims, and omits `hooks` from the phase-3a order** — lines 17–24
  Header lines 17–20 say phase 2 is a "state-guard swap with old-resource
  snapshot" that "overwrite[s] resources + version + updatedAt in-memory". The
  actual body splits that into `markUpdateInProgress` — whose own comment at
  2289–2290 says "**No** version/resources/resolvedSource mutation in this
  window" — and the post-commit `finalizeUpdateRecord`. Header lines 22–24 say
  phase 3a commits "skills -> commands -> agents -> mcp"; `commitUpdatePhase3a`
  runs five commits including `hooks`, as its own docstring at 2071 correctly
  states. Fix: rewrite the header's phase 2 paragraph as the 2a/2b split the code
  implements, and add `hooks` to the phase-3a order line.

## Grading of first-pass findings

### `tests/orchestrators/plugin/update.test.ts`

- **CONFIRMED** — *`dropCache-fail` asserts nothing that discriminates the
  behavior it names* (BLOCKER) — verified independently at 3275–3320 against
  `dropPluginCompletionCache` (`update.ts:2448–2462`, empty catch per D-19-01) and
  its single call site (`update.ts:2385`). Deleting that call site leaves
  `errs.length === 0` and `assert.match(successes[0], /updated/)` green. The
  comment's `notifyWarning` and `(lines 690-696)` both refer to nothing.
- **UNDERSTATED** — *`abortHandles`/`abortPartialHandles` are proven only by their
  state-record consequence* (BLOCKER) — real, and worse than recorded: the
  missing filesystem assertion is not merely an untested consequence, it is an
  **unobservable** one for two of the three bridges, because both helpers discard
  `abortPreparedCommands`/`abortPreparedSkills`' leak descriptors while
  `reinstall.ts:1515,1519` captures them. Promote the production half to its own
  BLOCKER (above) and sequence it **before** the test fix, or the new
  staging-directory assertions will be written against code that cannot report.
- **DUPLICATE-OF** — *the warm sha-pinned-cache offline proof checks only
  `cloneCalls`* (WARNING) — the cited case (6449) is in slice B's range and
  should be owned there. One refinement for whichever slice takes it: the sibling
  the finding names as stricter (1232, four arrays) is **itself** incomplete — the
  genuinely strict form in this file is 1119–1124, which deep-equals all six
  recorded arrays. Point both fixes at 1119–1124.
- **UNDERSTATED** — *inconsistent AAA phase-comment discipline* (WARNING) — the
  severity fits but the recorded scope is inverted. Measured over lines 1–4200:
  65 `test(` sites, **19** carrying `// arrange` / `// act` / `// assert`, **46**
  with none. That is ~71% unlabeled, not "roughly a quarter", and the labeled
  cases are the *later* additions (1483–2006, 2419, 2935, 3024, 3325), not the
  `PUP-*` block the finding names. Combined with slice C's count for 7270–8502,
  the drift is file-wide; a fixer scoped to "the earlier PUP-* section" would
  leave most of it in place.
- **CONFIRMED** — *`makeCtx()`'s minimal doubles are cast via a double `as`*
  (WARNING) — verified at 225–241; all 65 in-range cases flow through it. The
  finding's own deferral to a repo-wide narrowing of `shared/notify.ts`'s `ctx`/`pi`
  parameters is correct and is META item 1's ticket.

### `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`

- **CONFIRMED** — *seven `as Error` casts on caught `unknown` values* (WARNING) —
  all seven verified (534, 2096, 2102, 2115, 2122, 2128, 2342). Worth noting the
  prescribed fix and the new substring-classifier BLOCKER above are the same
  ticket: both are error-typing discipline in this file, and `notifyDirectFailure`
  (2836) already models the safe `instanceof` narrowing.
- **CONFIRMED** — *`updateSinglePlugin` reads `process.cwd()` directly*
  (WARNING) — verified at 608; my range contributes 11 of the counted
  `process.chdir` dances (1137, 1419, 1453, 1502, 1539, 1571, 1620, 1671, 2333,
  2398, 2441, 2523, 2567, 3169). All are correctly paired, so the finding's
  "design debt, not a leak" framing is right.
- **CONFIRMED** — *two inline `new Date().toISOString()` calls* (WARNING) —
  verified at 1713 and 1983. Adds context: precisely because the seeded stamp is a
  fixed literal, the finalize stamp at 1983 is cheaply assertable today without a
  clock seam (see the new WARNING) — the hidden clock is not currently blocking a
  test, it is hiding a completely unasserted write.
- **CONFIRMED** — *`UpdatePluginsOptions` has no top-level doc comment*
  (WARNING) — verified at 225 against `UpdateCloneCacheSeam` at 213.

The first pass's module-split recommendation holds up from this angle too: every
one of my five new test BLOCKERs sits at a seam the proposed split names
(`update-preflight.ts` owns 3389/3556, `update-swap.ts` owns 3116 and the leak
discards, `update-cascade.ts` owns the unpinned failure-row subjects).

## Still clean after attack

Mutations these cases genuinely kill — do not spend fixing-pass time here:

- **`1113–1118`** (`updatePlugins preserves a generated skill preload`) — the
  strongest assertion form in the file: `assert.deepEqual(notifications, [{message}])`
  against a hand-written literal, plus all six gitOps arrays, plus the credential
  and device-flow call ledgers, all deep-equal to empty. A spurious notification,
  a wrong severity, any git or credential traffic, or a changed row byte all fail.
  **This is the in-file template the fragment-assertion fixes should copy.**
- **`673` (PUP-3)** — byte-compares `state.json` before/after *and* the whole
  rendered message. Rewriting the record on the unchanged path, emitting the
  reload hint, or flipping severity all fail.
- **`728` / `780` / `820` / `2588` / `2632` / `2675` / `2705` / `2733` / `2761` /
  `2807` / `2844` / `2463`** — twelve byte-exact single-row pins. Dropping the
  headline, changing a glyph, reordering
  `<glyph> <name> [scope] (status) {reason}`, dropping the `v<from>` token, or
  emitting the empty-version token all fail. 820 in particular pins the
  empty-string `fromVersion` omission (`update.ts:2521–2524`), which a naive
  `!== undefined` guard would break.
- **`885` / `934` (LIFE-05)** — the shared-constant trap is avoided deliberately
  (873–880) and 934 adds `assert.deepEqual(await readRecord(), before)` over the
  whole record, which kills any partial write on the skip path.
- **`977` (PUP-6 happy) / `2319` (WR-04) / `3806`, `3863`, `3919` (TR-04
  matrix)** — the per-bridge orthogonality gate
  (`applyPerBridgeResources`, `update.ts:1827–1841`) is genuinely pinned in both
  directions for all four bridges: each matrix case deep-equals all four
  `resources.*` arrays, and the failed bridge's expected value differs from its
  succeeded value in every case, so a gate inverted for any single bridge fails.
- **`1268` / `1327`** — UGRM-01 suppression and the UGRM-02 tally are byte-pinned;
  counting suppressed rows, adding a plural `s`, or dropping the reload trailer
  all fail.
- **`2071` / `2184` / `2253` (CR-01 / WR-01)** — the duplicate-emission
  regression, the spurious `nothing to update` headline, and the vanishing
  committed predecessor are each killed by an exact `notifications.length` plus a
  content check. Only the *order* of the two notifications in 2253 is loose.
- **`1693` / `1761` / `1813` / `1868` / `1936` / `2006`** — the `watchStateTransition`
  race harness is a genuinely good instrument: each case asserts
  `stateWatch.fired() === true` first, so a race that never triggered fails loudly
  instead of passing vacuously. Each then pins count, severity, a distinctive
  cause string, and the post-state record. This is the pattern the weaker
  `gitOps.fetch`-side-effect cases (3389, 3556) should have used.
- **`4086` / `4123` / `4177` (WB-01)** — byte-level `readFile` comparison of the
  config file plus a forward-compat unknown-key check; a write-back that
  normalized or re-ordered keys fails.
- **`makeMockGitOps`** already carries the URL allow-list META recommends
  propagating (`allowedRemoteUrls: UPDATE_REMOTE_URLS`, 145) — `createGitOpsFake`
  throws on any unplanned remote (`git-ops-fake.ts:118–119`). This file is a
  second reference implementation of that pattern, not a candidate for it.

## Not covered

- Lines 4200–8502 belong to slices B and C. I read 4507–4700, 5089–5200,
  6341–6500 and 7081–7180 only to settle whether sibling cases kill mutations my
  range survives (they do for `removePluginRecord`, `local`, `partial`,
  `cloneCacheSeam`, `authMemo`, and the plural→info decline severity), and did not
  grade them.
- No coverage tooling was run (diagnostic constraint); every branch and mutation
  claim is from reading plus targeted `grep`.
- `update-row.ts` (`updatedRowFromOutcome`) and `update.messaging.ts` are owned by
  other pairs; I read only their call signatures.
- I did not verify whether `orchestrators/plugin/reinstall.ts` or
  `orchestrators/marketplace/update.ts` carry the same substring-classifier hazard,
  though `narrowDirectFailReason`'s own comment (2896) says it mirrors
  `marketplace/update.ts:553-580` — see the meta section.

## Meta-findings impact

### New cross-cutting evidence

- **Substring classification over free-form error text is a repo-wide correctness
  hazard, not a style nit.** `update.ts`'s `reasonsFromTypedError` (675–687) and
  `narrowDirectFailReason` (2899–2924) both decide a *closed-set, user-visible*
  reason token by `String.includes` over messages that interpolate plugin,
  marketplace, server and path names. I have a working proof of poisoning in-repo:
  an MCP server named `rollback-server` makes a collision classify as
  `{rollback partial}`. `narrowDirectFailReason`'s own comment says it "mirrors
  `marketplace/update.ts:553-580` narrowFailReason", and `reinstall.ts` is
  documented as the precedent for the bare-form synthetic row — so **every
  `narrow*Reason` / `reasonsFrom*` function in `orchestrators/` should be checked
  for the same shape**, starting with `orchestrators/marketplace/update.ts` and
  `orchestrators/plugin/reinstall.ts`. This directly contradicts
  `CONVENTIONS.md`'s own "never narrow on message substring matching" rule, which
  makes it a gate-that-does-not-gate in the *conventions* rather than the tests.
- **Leak-descriptor drops: a silent-omission class the type system cannot catch.**
  `abortPrepared{Skills,Commands}` and `commitPreparedCommands` all return
  `Promise<string | undefined>`; `await`ing and discarding that value compiles
  clean and no lint rule fires. `update.ts` drops it in three places while
  `install.ts:990` and `reinstall.ts:1515,1519` capture it. This is the same
  "adding/ignoring a member of a closed set compiles clean everywhere" shape the
  repo has recorded shipping three times. **Every `abortPrepared*` /
  `commitPrepared*` call site across `orchestrators/` should be swept for a
  discarded return**, and `bridges/*` should be checked for whether more of these
  functions return leak descriptors that some caller ignores.
- **Fixture rot can make a "clean" case unfalsifiable, and greps for weak
  assertions will not find it.** The `valid-marketplace` fixture deliberately has
  no plugin sub-trees (its README says so), so every update case seeded from it
  can only ever produce `(skipped) {no longer installable}`. Two cases in this
  file (3389, 3556) assert only "some skip happened / no error happened" and
  therefore pass identically whether or not the mechanism they name ran. The
  detection rule that finds these is **not** "look for `assert.match`" — it is
  "compute the case's baseline outcome with the arranged mutation removed, and
  check the assertions distinguish it". Any area whose cases build on a shared
  fixture directory (`tests/orchestrators/marketplace/_fixtures/`,
  `tests/edge/handlers/marketplace-seed.ts`) should be swept this way.
- **Adding the edge-handler injection seams (META item 4) will delete coverage
  the orchestrator pairs never had.** `UpdatePluginsOptions.mapModel` has zero
  occurrences in `tests/orchestrators/plugin/update.test.ts`; its only exercise is
  `tests/edge/handlers/plugin/update.test.ts`, which runs the real orchestrator
  precisely because no seam exists (its header documents this as D-116-05 Group
  C). The same inversion is likely for every option field the handler threads
  (`partial`, `local`, `scope`). **Sequencing rule for the fixing pass: before
  adding a handler seam, census the option fields that handler currently proves
  end-to-end and add owning cases to the orchestrator's pair first.**

### Corrections to META-FINDINGS.md

- **"Ranked by leverage" item 5 ("Restore exhaustiveness on closed-union
  switches") states the mechanism as "adding a member to a closed set compiles
  clean at every derivation site". That mechanism does not hold for a switch whose
  arms `return`.** `tsconfig.json:11` sets `noImplicitReturns: true`, so a
  value-returning switch over a widened union raises TS7030 with or without an
  `assertNever` default. `outcomeToCascadePluginMessage` (`update.ts:2584–2627`)
  is exactly that shape and is compiler-safe despite having no default arm — I did
  not log it as a finding for that reason. The repo has already recorded this
  (`switch-exhaustiveness-ts7030`). The four modules META names should be
  re-checked one by one for whether their switches *return* (compiler-guarded, no
  finding) or *assign / fall through / are statement-position* (genuinely
  unguarded, finding stands). The item is probably still worth doing for
  consistency with the house `assertNever` idiom, but it should not be sold as a
  silent-omission risk until each case is classified.
- **"Patterns to propagate", the offline-fake row, credits
  `tests/orchestrators/plugin/fetch.test.ts` as the sole implementation of the
  fail-loudly-on-unplanned-input git fake and says "Adopt this in the other git
  fakes".** `tests/orchestrators/plugin/update.test.ts:145` already passes
  `allowedRemoteUrls: UPDATE_REMOTE_URLS` and `createGitOpsFake` throws
  `createGitOpsFake blocked unplanned remote <url>` (`tests/platform/git-ops-fake.ts:118–119`).
  The allow-list is a feature of the **shared fake**, not of `fetch.test.ts`, so
  the propagation task is narrower than stated: find the call sites that omit the
  option, not the fakes that lack the capability.
- **META item 3's fragment-assertion file list should gain
  `orchestrators/plugin/update.test.ts`** (slice C reached the same conclusion from
  7270–8502; this slice adds 13 more cases at 2883–3325 and 3389/3556). Two
  qualifiers for the fixer: (a) the correct form does **not** need importing from
  `*.messaging.test.ts` — line 1113 in this very file is a model
  `assert.deepEqual(notifications, [...])`; (b) in this file the fragment cases
  cluster in the *failure and race* sections while the happy/degraded sections are
  byte-exact, so the class is better hunted per-section than per-file.

### Confirmations

- **META item 1 (over-wide `ctx`/`pi` parameters force casts)** — confirmed from
  the parameter side rather than the cast side: `UpdatePluginsOptions.ctx`/`.pi`
  (`update.ts:226–228`) are typed to the full SDK `ExtensionContext`/`ExtensionAPI`
  while the module reads only `ctx.ui.notify` (via `shared/notify.ts`) and
  `pi.getAllTools` (via `softDepStatus`, `update.ts:2668`). `makeCtx` (225–241)
  double-casts two three-line literals to satisfy them, and all 65 in-range cases
  flow through it. Narrowing to `Pick<ExtensionContext, "ui">` /
  `Pick<ExtensionAPI, "getAllTools">` deletes both casts here.
- **META's "dominant shape: sibling drift"** — confirmed with a *production*
  instance rather than a test one, which strengthens the claim: `update.ts` drops
  three leak descriptors that `install.ts:990` and `reinstall.ts:1515,1519`
  capture, using a helper (`pushLeak`) that already exists next door. The fix is
  propagation with a known-good target, exactly as META predicts.
- **META's provenance caution ("clean verdicts are not reliable")** — confirmed in
  the small for a second slice of this file: the first pass's single-paragraph
  clean verdict for everything outside its five findings concealed 5 BLOCKERs and
  12 WARNINGs in the 4,200-line range I attacked, two of them cases that assert
  nothing capable of failing.
- **Slice C's open question is closed:** the `commitUpdatePhase3a` commands catch
  (`update.ts:2099–2103`) **is** covered, by `phase3a-commands-fail` (3643) and the
  `TR-04 matrix: commands-fails-others-succeed` case (3863). What is *not* covered
  — and cannot be — is the commands **leak** branch, because that return value is
  discarded (production BLOCKER above).
