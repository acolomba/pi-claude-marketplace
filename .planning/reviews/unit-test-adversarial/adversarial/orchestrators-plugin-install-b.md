# Orchestrators — plugin install (slice B) — adversarial re-review

**Scope:** `tests/orchestrators/plugin/install.test.ts` lines 3300–5660 (44 `installPlugin`
calls across 39 cases: rollback-undo bodies, orchestrated classification, PHOOK-04
partial-hook staging, SEV-01/SEV-02/D-71-06, the WB-01/WB-02 / `--local` / WR-09 /
CFG-03 / UAT-05 write-back block, WR-03 routing rebuild, LIFE-01/SURF-05 hooks slot,
FORCE-01/03/04/05 gate selection) paired against
`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` lines 1477–1830 and
1922–2460. Read outside the range where it settled whether a sibling case kills a
mutation (lines 1086–2400, 7385–7470, 8006–8051).
**First-pass file:** `unit-test-findings/orchestrators-plugin-install.md`
**Clean files attacked:** 1 test file + 1 production module (see note below — the first
pass's `### Clean files` lists were empty by construction, so the attack surface is the
~2,360 unflagged lines of `install.test.ts` in my range plus the unflagged half of
`install.ts`)
**Existing findings graded:** 10

> **Note on the clean lists.** This area's first-pass file has no populated
> `### Clean files` list — it recorded "No other test-support files are owned by this
> assignment" and "None — the one production module in scope carries findings." The
> unfalsified negative here is therefore *the unflagged 97% of a 9,431-line file*: seven
> findings were recorded against it and everything else was implicitly passed. That is
> what I attacked.

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 6 |
| New WARNING (missed by first pass) | 11 |
| Existing CONFIRMED | 5 |
| Existing UNDERSTATED | 3 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 2 |

## New findings — from the clean lists

### `tests/orchestrators/plugin/install.test.ts`

- **[BLOCKER] `buildInstalledOutcome`'s `orphanRewake`, `landedDisabled` and the
  `!landedDisabled` half of `resourcesChanged` are derived by production code no case
  ever reads** — `line 4443` (`WB-01 / UAT-05 / D-103-16: the orchestrated stamp targets
  the ${arm.configSource} file, unchanged`), `line 5084`, `line 5141`

  Three separate surviving mutations on `install.ts:1768–1783`:

  1. Delete `...(installCtx.resolved.orphanRewake === true && { orphanRewake: true })`
     (`install.ts:1783`). **Green everywhere.** `grep -rn orphanRewake tests/` returns hits
     only in `tests/domain/resolver.test.ts` (the resolver-side flag, 8 cases),
     `tests/architecture/compat-01-no-expansion.test.ts:434` (a type-inventory literal),
     and one *comment* at `install.test.ts:5095`. The two SURF-05 cases at 5084 and 5141
     seed the exact fixture that produces the flag, but both run **standalone** mode and
     assert only the rendered string. `orchestrators/import/execute.ts` and
     `orchestrators/reconcile/apply-outcomes.ts` read this field off the outcome, and
     their own tests stub `installPlugin` — so nothing in the suite proves the
     orchestrator propagates it.
  2. Change `resourcesChanged: !landedDisabled && stagedAny` to `resourcesChanged:
     stagedAny` (`install.ts:1768`). **Green everywhere.** `install.test.ts` asserts
     `resourcesChanged === true` exactly once (line 3641) and `false` never; the only
     `resourcesChanged: false` literals in the suite are in `tests/orchestrators/types.test.ts`
     (a type-only module) and stubs in `import/execute.test.ts:1440`.
  3. Delete `...(landedDisabled && { landedDisabled: true as const })` (`install.ts:1771`).
     **Green everywhere** — same evidence.

  Case 4443 is the one case in the file that reaches all three: `entryDefaultEnabled: false`
  + `applyDefaultEnabled: true` + a declaring entry with no `enabled` key makes
  `disabledInstall.landed` true (proved by its own `{ enabled: false }` assertion at 4499),
  and it runs orchestrated mode where the outcome *is* the contract. It asserts
  `outcome.status === "installed"` and nothing else.

  **Fix:** in case 4443 replace `assert.equal(outcome.status, "installed")` with a
  whole-outcome comparison in the form the file already uses at lines 3726–3735 and
  3833–3842:
  `assert.deepStrictEqual(outcome, { declaresAgents: false, declaresMcp: false,
  landedDisabled: true, resourcesChanged: false, status: "installed", version: "0.0.1" })`.
  Then add one orchestrated SURF-05 case beside 5084 (same fixture, `notifications: { mode:
  "orchestrated" }`) asserting the whole outcome with `orphanRewake: true`, and give its
  negative twin at 5141 the matching whole-outcome assertion with `orphanRewake` absent
  (`assert.equal(Object.hasOwn(outcome, "orphanRewake"), false)`, the NREG-01 form already
  used at line 5408).

- **[BLOCKER] The PHOOK-04 containment invariant is asserted by key presence only —
  nothing reads a handler** — `lines 4044–4049`, `lines 4097–4098`

  The block header at 3993–3999 states the promise: "the staged file can never carry a
  dropped handler (PHOOK-04 containment invariant)." Neither case reads a `command`. All
  of these mutations to the bridge's staged subset survive:

  - stage `{ PostToolUse: [] }` — `assert.ok("PostToolUse" in staged)` passes;
  - stage the kept `Edit` group carrying the dropped `.*` group's handlers
    (`command: "echo regex"`) — `staged.PreToolUse.length === 1` and
    `staged.PreToolUse[0]?.matcher === "Edit"` both pass. **This is exactly the invariant
    the header names, inverted, and the suite is green;**
  - stage `{ PreToolUse: [{ matcher: "Edit", hooks: [] }] }` — passes;
  - stage a wrong `type` on the surviving handler — passes.

  **Fix:** replace both with whole-value comparisons, the form the same file already uses
  for the fully-supported case at line 5077 (`assert.deepEqual(JSON.parse(written),
  hooksJson)`):
  `assert.deepStrictEqual(staged, { PostToolUse: [{ matcher: "Edit", hooks: [{ type:
  "command", command: "echo posttooluse" }] }] })` at 4044, and
  `assert.deepStrictEqual(staged, { PreToolUse: [{ matcher: "Edit", hooks: [{ type:
  "command", command: "echo edit" }] }] })` at 4097. Line 5077 proves the staged file
  round-trips the source events map with no normalization, so both literals are exact.

- **[BLOCKER] Both standalone CFG-03 aborts assert one regex fragment and discard the
  outcome; the file's own model form sits 3,400 lines away** — `lines 4569–4584`
  (`CFG-03 / T-56-03-04`), `lines 4635–4658` (`CFG-03 / D-103-16`)

  Surviving mutations against `install.ts:2310–2321` / `failedRowOutcome` (1796–1828):

  - change `severity: "error" as const` (`install.ts:1819`) to `"warning"` or drop it —
    **green**; neither case asserts severity, and `grep "invalid manifest" tests/orchestrators/plugin/install*.test.ts`
    returns only lines 4571 and 4637;
  - return `{ status: "installed", … }` from the CFG-03 arm instead of the failed outcome
    — **green**; both cases discard `installPlugin`'s return value entirely;
  - drop the `cause:` trailer line from the rendered message — **green**;
  - change the reason token's neighbours, the glyph, the `[project]` bracket, or the
    `Error:` summary line — **green**.

  The correct form is in the same file at **lines 8037–8042** (`orchestrated install
  returns the invalid-config outcome without emitting`), which pins the whole outcome and
  `assert.deepStrictEqual(notifications, [])`. The whole-message byte form for this row is
  already pinned by two sibling suites:
  `tests/edge/handlers/plugin/uninstall.test.ts:102` and
  `tests/orchestrators/marketplace/autoupdate.test.ts:691,733,771`
  (`'A plugin operation has failed.\n\n● alpha [project]\n  ⊘ demo (failed) {invalid
  manifest}\n    cause: Config file "claude-plugins.local.json" failed schema
  validation.'`).

  **Fix:** capture the outcome in both cases, `assert.deepStrictEqual(outcome, { cause:
  'Config file "<basename>" failed schema validation.', error: new Error(same), status:
  "failed" })` copying line 8037's shape, and replace the `assert.match(note.message,
  /\{invalid manifest\}/)` pair with
  `assert.deepStrictEqual(notifications, [{ message: "<full expected bytes>", severity:
  "error" }])`. The absolute-path-leak checks at 4573 and 4645 become redundant and should
  be deleted — a whole-message equality subsumes them.

- **[BLOCKER] SEV-01/SEV-02 asserts severity with two standalone negatives and the
  messages with five regex fragments** — `lines 4146–4204`

  `assert.notEqual(forced.notifications[0]?.severity, "error")` +
  `assert.notEqual(…, "warning")` (4192–4193) is the standalone-negative assertion the
  rule names explicitly: it passes for a third value, for `null`, for a typo'd stamp. The
  same file does it right 1,140 lines later at **5336**:
  `assert.equal(notifications[0]?.severity, undefined, "force-installed is info, not
  error")`. Surviving mutations on the forced half: the row loses its version, loses the
  `◉` glyph, loses the `/reload to pick up changes` trailer, renders the wrong scope
  bracket, or renders a second row — `assert.match(forcedMsg, /\(partially-installed\)/)`
  + `/\{unsupported hooks\}/` + `startsWith("●")` catch none of them. On the no-force half:
  the `⊘` glyph, the version segment, the `Error:` summary line and the cause trailer are
  all unasserted.

  **Fix:** add `pluginVersion: "1.0.0"` to the fixture (line 4118, the knob case 5303
  already uses to make the row deterministic), then replace 4146/4158–4165 and
  4190–4199 with two `assert.deepStrictEqual(notifications, [{ message: "…", severity: … }])`
  calls in the byte-exact form the file uses at 5337–5343, 5457–5465 and 5502–5505.

- **[BLOCKER] The WR-03 routing-entry proof checks 4 of 10 fields, and its load-bearing
  assertion compares two production outputs to each other** — `lines 5010–5024`

  `assert.equal(bucket[0]?.resolvedSource, afterState.marketplaces["mp"]?.plugins["p1"]?.resolvedSource)`
  is production-output-vs-production-output. The comment at 5015–5019 claims it catches "a
  regression that drops the pluginRoot argument from `addPluginConfigToCache(...)`" — but
  both sides trace to the same resolver field, so a single-source regression that feeds the
  marketplace root (or any other same-shaped path) to *both* leaves it green. The
  independently-known value is already in hand: `seedPathMarketplaceWithPlugin` **returns**
  `{ pluginRoot }` (helper at line 605, `pluginRoot = <marketplaceRoot>/plugins/<name>`),
  and line 4954 throws it away.

  Separately, `RoutingEntry` has ten fields
  (`extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:55–90`); the case reads
  four. Mutations to `rawMatcher` (`""` → `"*"`), `matcher`, `claudeEvent`,
  `declarationIndex` (off-by-one) and the MATCH-03 `if` sentinel all survive.

  **Fix:** capture `const { pluginRoot } = await seedPathMarketplaceWithPlugin({…})` at
  4954 and replace lines 5010–5024 with
  `assert.deepStrictEqual(getRoutingBucket("PreToolUse"), [<hand-written RoutingEntry
  literal with resolvedSource: pluginRoot>])`. The `hookEntries` assertion at 5003–5005
  already demonstrates the whole-value form in this very case.

- **[BLOCKER] The D-75-01 vocabulary guard cannot see `tests/**` outside
  `tests/architecture/`, and the rename is verifiably incomplete in 9 unit-test files** —
  `tests/architecture/partial-vocabulary-guard.test.ts:83–103`

  `collectGuardedSources()` scans `extensions/pi-claude-marketplace/**/*.ts`, two docs, and
  `tests/architecture/*.ts`. Nothing else under `tests/`. Its own `ABSENT_FORCE_PROSE`
  regexes (`/force[- ]install/i`, `/force[- ]upgrad/i`, `/force[- ]degrad/i`,
  `/force[ -](state|path|modifier)/i`) and its `ABSENT_FLAGS` (`--force`) match **127 lines
  across 9 unit-test files** that the gate never reads:

  | File | Hits |
  | --- | --- |
  | `tests/orchestrators/plugin/install.test.ts` | 36 |
  | `tests/orchestrators/plugin/update.test.ts` | 35 |
  | `tests/orchestrators/plugin/list.test.ts` | 25 |
  | `tests/shared/notify.test.ts` | 9 |
  | `tests/orchestrators/plugin/info.test.ts` | 7 |
  | `tests/domain/resolver.test.ts` | 6 |
  | `tests/orchestrators/marketplace/update.test.ts` | 3 |
  | `tests/orchestrators/plugin/reinstall.test.ts` | 3 |
  | `tests/edge/handlers/plugin/reinstall.test.ts` | 3 |

  These are not cosmetic. `grep -rn -- '--force' extensions/` returns **nothing** — the flag
  does not exist. `force-installed` and `(unsupported)` are not row tokens anywhere in
  `shared/notify.ts`. So in my range alone the prose asserts a contract the production code
  does not have: `install.test.ts:4108–4110` says "WITHOUT `--force` it blocks … WITH
  `--force` it degrades to an info `force-installed` row" (the flag is `--partial`, the row
  is `(partially-installed)`); `4149–4151` says the row renders "`(unsupported)`" while the
  assertion four lines down matches `(partially-available)`; `4179` says "the row reads
  `force-installed`" while the byte-exact sibling at 5340 shows `(partially-installed)`.
  `FORCE-01/03/04/05` and `FSTAT-07` in test *titles* are durable requirement IDs and are
  fine (the guard's own PRD allowlist at line 362 says so); the surrounding prose is not.

  **Fix:** extend `collectGuardedSources()` to walk `tests/` recursively (excluding `SELF`)
  with the same reader it already uses for `ARCH_DIR`, then repair the 127 sites. The
  guard's docstring at lines 10–22 must be updated to name the widened surface.

- **[WARNING] `Orchestrated-agent-foreign` uses `length >= 1` + `.some(includes())` where
  its two immediate siblings pin the whole outcome** — `lines 3923–3929`

  `assert.ok(warnings !== undefined && warnings.length >= 1)` then
  `warnings?.some((w) => w.includes("pre-existing agent file"))`. The AS-7 message's other
  bytes (which file was preserved, which agent name) are unasserted, and a second spurious
  warning is undetectable. The two cases directly above it (3726–3735, 3833–3842) already
  `assert.deepStrictEqual(first, { …, postCommitWarnings: [<exact string>], … })`.
  **Fix:** copy that form — compare the whole outcome including the full
  `postCommitWarnings` array against a hand-written literal.

- **[WARNING] Two case titles name outcome statuses that `InstallPluginOutcome` does not
  have** — `line 3549`, `line 3581`

  `Orchestrated-PI-4: non-installable plugin -> outcome.status 'uninstallable'` and
  `Orchestrated-PI-5: already installed -> outcome.status 'already-installed'`. Both assert
  `outcome.status === "failed"`; neither status exists in the union. This is distinct from
  the first pass's finding on the same two cases (which noted the missing `cause` check) —
  the titles state a contract that was never true, so a reader repairing these cases would
  strengthen them toward the wrong shape. **Fix:** retitle to
  `… -> outcome.status 'failed' with an is-not-installable cause, no notification` and
  `… -> outcome.status 'failed' with an already-installed cause, no notification` while
  adding the cause assertions the first pass asks for.

- **[WARNING] Eight cases join every notification into one string without pinning the
  count, while fourteen siblings in the same range pin it** — `lines 4980, 5069, 5128,
  5183, 5230, 5284/5295, 5576, 5619`

  `install.ts:2394` states the contract: "Exactly ONE notification per install (IL-2)." The
  join idiom cannot see a second notification, and `notifications.filter(…).length === 0`
  (5230, 5284, 5576, 5621) cannot see extra info-severity rows. Siblings that do it right:
  3369, 3425, 3484, 4146, 4190, 5335, 5452, 5500, plus the whole-array form at 3737, 3844,
  4494. **Fix:** add `assert.equal(notifications.length, 1)` before every join in that list;
  in the six cases where the message is deterministic (5069, 5128, 5183, 5295, 5619 and the
  FORCE-01 pair once `pluginVersion` is pinned) replace the join + `.includes()` with
  `assert.deepStrictEqual(notifications, [{ message: "…" }])`.

- **[WARNING] `!summary.includes("(failed)") && !summary.includes("(unavailable)")` as the
  install-success proof** — `lines 4981–4984`, `lines 5070–5073`

  A conjunction of two negatives passes for the empty string, for a `(partially-installed)`
  row, for a `(disabled)` row, and for two notifications. In both cases the real success
  proof arrives later (the hooks resource at 4989, the staged file at 5076), so the check
  adds nothing but a misleading failure message. **Fix:** delete both and assert the whole
  notification instead (see the previous finding).

- **[WARNING] The orchestrated stamp arm cannot detect `writePluginConfigEntry` being
  handed `sibling` instead of `current`** — `line 4443`, `install.ts:2199–2206`

  The declaring file is seeded with exactly one key (`{"hello@mp": {}}`, line 4477), so
  passing the wrong parsed config as the merge base produces a byte-identical result and
  the case stays green. `install.ts:2188–2191` explicitly claims "the one field carried here
  disturbs no forward-compat key (D-09) and no sibling entry" — untested at this seam.
  **Fix:** seed the declaring file with a second unrelated entry
  (`{"hello@mp": {}, "other@mp": { enabled: true }}`) and assert the whole map after:
  `assert.deepStrictEqual(declaringCfg.config.plugins, { "hello@mp": { enabled: false },
  "other@mp": { enabled: true } })`.

- **[WARNING] Two cases compute their expected values with production code and assert
  contracts owned by other modules** — `lines 4800–4807`, `lines 4860–4869`

  4802 calls `mergeScopeConfigs(...)` (owned by `tests/persistence/config-merge.test.ts`)
  and asserts a merged-view property already fully determined by the assertion at 4787.
  4868 calls `planReconcile(...)` and compares it against `emptyReconcilePlan("project")` —
  *the expected value is produced by production code*, which the rule forbids outright, and
  the reconcile-convergence contract is owned by
  `tests/orchestrators/reconcile/plan.test.ts`. **Fix:** delete 4800–4807 (redundant with
  4787) and delete 4858–4869, moving the convergence claim into the reconcile suite as a
  case seeded from the same on-disk shape; keep 4852–4853, which is the install-side
  promise.

- **[WARNING] Module-global resets without cleanup, diverging from the sibling in the same
  file** — `line 3948` (`resetCompletionCache()`), `lines 4950, 5044, 5090, 5147`
  (`resetRoutingState()`)

  Each resets at entry and leaves the global dirty on exit. The sibling at 3663–3666 does it
  correctly: `resetCompletionCache(); t.after(() => { resetCompletionCache(); });`. Case
  3936 takes no `t` parameter at all, so it *cannot* register cleanup as written. **Fix:**
  give all five cases the `async (t) =>` signature and add
  `t.after(() => { reset…(); });` immediately after each reset call. (The deeper fix —
  factory-owned state instead of a reset hook — is META-FINDINGS item 2; see Confirmations.)

- **[WARNING] 26 runtime `await import(…)` of production modules inside case bodies** —
  representative: `4237, 4277, 4317, 4365, 4401, 4469, 4527, 4652, 4682, 4777, 4800, 4841,
  4860–4864, 4888, 4909, 4942, 4944, 5039, 5085, 5142`

  The file's convention is a static import block (lines 1–56) with explicit `.ts`
  extensions; nothing about these modules requires deferred loading. Lines 4942 and 4944
  import **the same module twice, back to back**, to destructure one symbol each.
  **Fix:** hoist all of them into the top-level import block —
  `loadConfig`/`saveConfig` from `persistence/config-io.ts`, `mergeScopeConfigs` from
  `persistence/config-merge.ts`, `resetRoutingState` + `getRoutingBucket` from
  `bridges/hooks/routing-state.ts` (one statement) — and delete the `planReconcile` /
  `emptyReconcilePlan` imports along with the case that uses them.

- **[WARNING] `assert.equal(cfg.status, "valid")` + a re-testing `if` where the file's own
  narrowing form exists** — 11 sites: `4241, 4281, 4369, 4423, 4430, 4498` (`if (… === …)
  { … }`) and `4708, 4781, 4796, 4848, 4913` (`if (… !== …) return;`)

  `assert.equal` from `node:assert/strict` does not narrow, so the `if` is load-bearing for
  the compiler — but the early-`return` variant means a future edit that removes or
  reorders the preceding `assert.equal` turns the case into a silent no-op. The file uses
  the narrowing-and-asserting form at 5390 and 5406: `assert.ok(cfg.status === "valid")`
  (`assert.ok` is typed `asserts value`). **Fix:** replace all 11 with
  `assert.ok(cfg.status === "valid")` and drop the `if` block, dedenting the body.

- **[WARNING] Existence- and membership-only checks where the whole value is the promise**
  — `line 5236` (`(await readFile(skillTarget,"utf8")).length > 0`), `lines 5246–5253`
  (`unsupported.includes("themes")` ×2), `lines 5391–5394`
  (`(degraded.unsupported ?? []).length > 0`)

  All three have a correct sibling within 200 lines: 5245 already
  `deepEqual`s `record.resources.skills`, 5292 `deepEqual`s an empty `unsupported`, and
  5407–5408 does the NREG-01 negative properly with `Object.hasOwn`. **Fix:** replace 5246–5253
  with `assert.deepStrictEqual([...record.compatibility.unsupported], [<the two kinds in
  their production order>])`; replace 5391–5394 with a whole-outcome
  `assert.deepStrictEqual(degraded, { … unsupported: […] })` in the form of 3726; and at
  5236 compare the staged `SKILL.md` bytes against the seeded body.

- **[WARNING] `assert.rejects(readFile(path))` as a "file must not exist" check** —
  `line 4167`

  Any rejection satisfies it — EACCES, EISDIR, a path that became a directory. (The second
  argument being a string is fine: Node reads a string second argument as `message`, and the
  call is awaited.) The file imports `pathExists` at line 41 and uses it once at 8419.
  **Fix:** `assert.equal(await pathExists(stagedPath), false)`. This is the same idiom-drift
  the first pass logged for the three `Rollback-*-undo` cases; treat it as one rule.

### `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`

- **[WARNING] The file ends with 44 lines of orphaned documentation, not 5** —
  `lines 2417–2460`

  The first pass flagged only the last block. There are four consecutive orphans after the
  final `}` at line 2416: a D-19-03/CMC-17/MSG-RP-1 note (2417–2422), a 26-line JSDoc
  describing a four-way failure router that no longer follows it (2424–2449), a WR-04 note
  about a `marketplace` argument (2450–2454), and the "Test seam for the catch-site dispatch
  helpers … via this re-export" JSDoc (2456–2460). The last one is a doc comment that
  *asserts an export exists*: `grep -n "^export"` lists nine symbols, none of them a test
  seam, and no test imports one. **Fix:** delete 2417–2460 in one edit. Where the D-19-03
  routing narrative is still wanted, it belongs above `handleInstallThrow`, which carries
  its own copy at 1830–1848.

## Export ownership census

Scoped to `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`, its only
paired test module, with the owning case identified per export. Slice ownership noted
because A (1–3300) and C (5660–9431) hold the rest.

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `install.ts` | `installPlugin` | 44 call sites in slice B; whole-outcome assertions only at 3726, 3833 | **owned, but see Branch census** |
| `install.ts` | `runInstallLedger` | `install.test.ts:7385`, `:7445` (slice C); `enable-disable.test.ts` | owned (slice C) |
| `install.ts` | `InstallCloneCacheSeam` | `install.test.ts:5679+` (slice C), `reinstall.test.ts` | owned (slice C) |
| `install.ts` | `InstallPluginOptions` | consumed by `orchestrators/import/execute.ts`; every option field exercised via `installPlugin` — `local` (4254), `partial` (4034), `applyDefaultEnabled` (4362), `notifications.mode` (3533) | owned |
| `install.ts` | `InstallPluginNotifications` | consumed by `orchestrators/marketplace/add.ts`; no direct case | incidental — type-only, exercised through `InstallPluginOptions` |
| `install.ts` | `InstallLedgerResult` | consumed by `orchestrators/plugin/enable-disable.ts`; discriminated at `install.test.ts:7385` | owned (slice C) |
| `install.ts` | `InstallFailureCapture` | consumed by `enable-disable.ts`; `tests/orchestrators/plugin/enable-disable.test.ts` | owned by the sibling pair |
| `install.ts` | `InstallLedgerOptions` | no consumer outside `install.ts` | **compiler-forced** — it is the parameter type of the exported `runInstallLedger` (line 805); not removable, not a finding (D-116-01a category) |
| `install.ts` | `InstallLedgerSummary` | no consumer outside `install.ts` | **compiler-forced** — referenced by the exported `InstallLedgerResult` union (line 518); same category |

No export is unowned. The gap is not *which* exports are covered but *how much of
`installPlugin`'s returned object* is: of the nine fields `buildInstalledOutcome` can emit
(1759–1785), only `status`, `version`, `resourcesChanged: true`, `postCommitWarnings`,
`unsupported` (presence only) and `degradedKinds` are ever asserted. `landedDisabled`,
`orphanRewake`, and `resourcesChanged: false` are not — see the first BLOCKER.

## Branch census

Branches in `installPlugin` (`install.ts:1922–2416`) and `buildInstalledOutcome`
(1742–1786), the production surface slice B pairs with.

**Reachable and untested — findings:**

- `install.ts:1783` `orphanRewake === true` → outcome field. Reachable (the SURF-05
  fixture at 5097 produces it), zero assertions repo-wide. BLOCKER above.
- `install.ts:1771` `landedDisabled` → outcome field, and `1768`'s `!landedDisabled` guard on
  `resourcesChanged`. Reachable at case 4443, unasserted. BLOCKER above.
- `install.ts:1819` `severity: "error" as const` on the CFG-03 / marketplace-absent failed
  row. Reachable at 4537, 4591, 4512; severity asserted at none of them. BLOCKER above.
- `install.ts:2199` `writePluginConfigEntry(current, …)` — the `current`-vs-`sibling`
  argument choice. Reachable at 4443, undetectable there. WARNING above.

**Reachable and covered — by a sibling slice, recorded so the fixing pass does not
re-derive:**

- `!disableResult.ok` (D-102-02 cascade failure, 2103–2119) — slice A, case at line 2298.
- `disabledInstall.landed && hooksConfigPath !== undefined` (the DFEN-04 skip of the
  post-save cache/routing block, 2252) — slice A, cases at 2178 and 2232 seed `hooksJson`
  together with `applyDefaultEnabled`.
- `catch (cacheErr)` → `hookDebugLog` (2268–2272) — slice C, case at 7872 (`cacheError =
  new Error("routing rebuild denied")`, line 7895).
- `composeDisabledRow` vs `composeInstalledRow` (2402–2404) — slice A pins the disabled row
  byte-exactly at 1187 and 1850.
- `configInvalid` in **orchestrated** mode (2310, `failedRowOutcome`'s early return at
  1808–1810) — slice C, case at 8006, which is the model form.
- `marketplaceAbsent` in both modes (2324–2343) — standalone at 4512 and 5632 (both weak,
  see grading), orchestrated at `import/execute.test.ts`.

**Unreachable by real input:** none found in this surface. Every branch in
`installPlugin`'s post-lock composition is driven by a value the ledger or the selector
produces.

**Compiler-forced and not removable:** the two `eslint-disable-next-line
@typescript-eslint/no-unnecessary-condition` guards at 2309 and 2323. TypeScript's flow
analysis cannot prove the `withLockedStateTransaction` closure ran, so it types
`configInvalid` / `marketplaceAbsent` as still `false`; both disables carry a `--` reason
that holds. Not a finding, and the branches themselves *are* covered (above).

## Grading of first-pass findings

### `tests/orchestrators/plugin/install.test.ts`

- **CONFIRMED** — *No case proves the mcp phase's real `unstageMcpServers` removal on
  rollback*. Verified: `install.test.ts:7394` and `:7454` both seed `pluginName: "empty"`
  with no `mcpServers`, and neither reads `mcp.json`. The mutation the finding names
  survives. (Cases live in slice C's range; the claim is correct as written.)

- **UNDERSTATED** — *Weak "at least one notification" assertions instead of content checks*
  (5539, 5652 in my range). Two corrections. **(a) The prescribed fix propagates the
  defect.** The finding says to copy `FORCE-05` at line 5590, "asserts
  `message.includes("(unavailable)")` plus zero warnings" — but that sibling is itself a
  fragment assertion with no notification count and no severity check; copying it converts a
  vacuous check into a weak one. The right target is the byte-exact form already in the file
  at 5337–5343, 5457–5465 and 5502–5505. **(b) The finding misses that both cases discard
  the outcome**, so `installPlugin` returning `{ status: "installed" }` on a blocked install
  is green at 5512 and 5632 too. Severity stays BLOCKER; the fix instruction needs replacing.

- **UNDERSTATED** — *Orchestrated failure-classification tests skip the outcome's
  cause/error* (3549, 3581). The finding is right about the missing cause. It misses that
  **both titles assert statuses the union does not contain** (`'uninstallable'`,
  `'already-installed'`), so a fixer following the titles would write assertions that cannot
  pass. See the new WARNING above; the two should be fixed as one edit.

- **DUPLICATE-OF** — *Stub given a call-count assertion instead of relying on the outcome*
  (7670, 8108, 8334). Entirely inside slice C's range; that file should own the grade.

- **DUPLICATE-OF** — *Redundant architectural git-surface check duplicated from the
  dedicated architecture suite* (3219–3230). Sits below my range start; slice A owns it.
  Noting for the consolidator that the finding's factual core checks out —
  `tests/architecture/no-orchestrator-network.test.ts` does list `install.ts` in
  `FORBIDDEN_TARGETS` and does scan a fourth pattern the local copy omits.

- **CONFIRMED** — *`in`-check plus unnecessary `as` cast instead of the narrowing idiom used
  elsewhere* (3640–3641, 3541–3542, 3924–3925 in my range). All three verified. Worth
  noting for the fixer that at 3640 the `in` check is not merely redundant: it is the only
  thing asserted about the field's presence, and the following `as` cast means a mutation
  renaming the field would produce `undefined !== true` and fail — so the *combination*
  happens to work, which is why it survived review. The narrowing form
  (`assert.ok(outcome.status === "installed")`, lines 2719, 5390) is still the correct fix.

- **CONFIRMED** — *Four different idioms for "does this path exist"* (3374–3382, 3430–3438,
  3489–3497 in my range). Verified. Add `assert.rejects(readFile(…))` at 4167 as a fifth
  idiom in the same rule (new WARNING above).

- **CONFIRMED (as a deliberate note, correctly reasoned)** — *`ctx.ui.notify` recorder is a
  hand-rolled sink, not `strong-mock`* (`makeCtx`, 282–299). The first pass's argument —
  that it functions as a Fake because every case asserts the recorded array's *state* — is
  sound for 14 of the 22 assertion sites in my range. It breaks for the other 8 (4980, 5069,
  5128, 5183, 5230, 5284, 5576, 5619), which never assert the array's shape at all. Keeping
  the Fake is defensible; the fix is to make every case actually assert its state, which is
  the new WARNING on notification counts.

### `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`

- **UNDERSTATED** — *Stale doc comment describes a re-export that no longer exists*
  (2456–2460). The orphan is 44 lines (2417–2460), not 5, and includes a full 26-line JSDoc
  for a removed function. See the production finding above.

- **CONFIRMED** — *Three inline `new Date()` calls and one `homedir()` call are hidden
  dependencies* (1088, 1180, 1389, 1437). Verified present; the prescribed fix (a `Clock`
  member on `InstallLedgerOptions`) is the sanctioned one.

- **CONFIRMED, lowest priority** — *`credentialOps` parameter defaults to the live boundary*
  (747). Real per the style rule, and the first pass already self-qualifies it as a
  documented `PROV-03 / D-79-05` exception with no live coverage gap. Correct at WARNING;
  sequence it last.

## Still clean after attack

- **`tests/orchestrators/plugin/install.test.ts:3652–3764` and `:3766–3864`** (the two
  orchestrated retry proofs). These are the strongest cases in my range and they resist
  every mutation I tried: whole-outcome `deepStrictEqual` including `postCommitWarnings`
  bytes; `assert.deepStrictEqual(notifications, [])` (a genuine silence proof); the
  manifest compared byte-for-byte before and after; a hand-written 10-entry scope-tree
  literal at 3740 that catches a stray directory, a missing `SKILL.md`, or a leaked staging
  dir; `firstStateBytes` re-read to prove the retry is a true no-op; and an ordered
  `firstSchedule` log proving the faulted call happened exactly once. Mutations that fail:
  dropping the deferral message, changing its wording, emitting a notification, leaving the
  staging dir behind, saving state on the already-installed retry, calling `unlink` twice.
  **These two cases are the reference implementation the rest of this file should be
  measured against — including the `retryTree` whole-tree inventory, which no other case in
  my range uses.**

- **`tests/orchestrators/plugin/install.test.ts:5303–5348` (`FSTAT-07 / D-66-04`) and
  `:5416–5470` (`WR-03` soft-dep) and `:5474–5510` (`SEV-01` companion loaded`)**. All three
  pin `notifications.length === 1`, the exact severity (including `undefined` for info), and
  the complete multi-line message including the `Error:`/`needs attention` summary line, the
  `● mp [project]` header, the glyph, the version, the status token, the full brace
  contents in order, and the `/reload to pick up changes` trailer. Mutations that fail:
  reordering `{unsupported component, requires pi-subagents}`, dropping the reload trailer,
  swapping `◉` for `●`, dropping the summary line, changing severity in either direction.
  **This is the byte-exact form every weak case in the file should be converted to; it is
  already here, 3 cases out of 39.**

- **`tests/orchestrators/plugin/install.test.ts:4665–4732` (`UAT-05 / CR-02` unreadable
  sibling)**. The load-bearing assertion at 4721 is a positive statement of what the value
  *is* (`marketplaces["mp"] === undefined`) with a comment explaining the failure mode it
  guards, plus a byte-for-byte re-read of the untouched base file against a test-authored
  literal at 4727. Mutations that fail: coercing the unreadable sibling to an empty config,
  writing to the unreadable file, skipping the plugin-entry write.

- **`tests/orchestrators/plugin/install.test.ts:4293–4325` (`WR-09`)**. Proves absence on
  *both* files, which is the whole contract; a mutation writing to either one fails.

- **`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1477–1512`
  (`declaringPluginMaps` / `entryFor` / `readDeclaredEnabled`)**. I attacked the identity
  rule directly: swapping `local` and `base` in the ternary at 1495–1496 is caught by slice
  A's cases at 1940 and 2015 (`D-103-16 / DFEN-06 / CFG-02`); dropping the `?? entryFor(base, …)`
  fallback at 1511 is caught by 4333. The first pass's recommendation to extract this into a
  leaf module remains right on test-cost grounds, but the logic itself is not
  under-tested.

- **Assertion strictness across the whole file.** I checked the hypothesis that
  `assert.deepEqual` / `assert.equal` here are the loose variants. They are not:
  `install.test.ts:1` imports `node:assert/strict`, where `assert.equal === assert.strictEqual`
  and `assert.deepEqual === assert.deepStrictEqual` (verified by running the identity check
  in a throwaway Node process). **No file under `tests/` imports the loose `node:assert`** —
  `grep -rn 'from "node:assert"' tests` returns nothing. There is no loose-equality defect
  in this repo's test tree.

## Not covered

- Lines 1–3300 and 5660–9431 of `install.test.ts` were read only where a specific mutation
  needed settling (the `(disabled)` row bytes, the post-save cache-failure case, the two
  `runInstallLedger` race cases, and case 8006). Slices A and C own them.
- `install.messaging.ts` / `install.messaging.test.ts` remain out of scope, as in the first
  pass.
- The three injected fakes (`tests/platform/git-ops-fake.ts`,
  `tests/platform/credential-ops-fake.ts`, `tests/domain/device-flow-fake.ts`) are not
  reached by any case in my range — every case in 3300–5660 is a path-source install.
- **Per-pair coverage was not measured.** Per the brief, no test command was run. Every
  coverage claim here is from reading plus targeted `grep` over the whole `tests/` tree, not
  from `npm run test:coverage:direct`.
- The exact production ordering of `compatibility.unsupported` (`["themes","monitors"]` vs
  `["monitors","themes"]`) was not determined; the fix instruction for case 5202 says to pin
  the observed order rather than guess it.

## Meta-findings impact

### New cross-cutting evidence

1. **A sixth "gate that does not gate", and it is a vocabulary gate.**
   `tests/architecture/partial-vocabulary-guard.test.ts` scans `extensions/**`, two docs,
   `tests/architecture/*.ts`, and the PRD — and nothing else under `tests/`. Its own
   forbidden patterns match **127 lines across 9 unit-test files** (table in the BLOCKER
   above). Because `--force` exists nowhere in production and `force-installed` /
   `(unsupported)` are not row tokens, this is not stale prose: it is documentation
   asserting a contract the code does not have, sitting directly above the assertions that
   contradict it (`install.test.ts:4149` says the row renders `(unsupported)`; the assertion
   four lines down matches `(partially-available)`). **Areas to check: `orchestrators/plugin/update`
   (35 hits), `orchestrators/plugin/list` (25), `shared/notify` (9),
   `orchestrators/plugin/info` (7), `domain/resolver` (6),
   `orchestrators/marketplace/update` (3), `orchestrators/plugin/reinstall` (3),
   `edge/handlers/plugin/reinstall` (3).** This belongs in the "Gates that do not gate"
   section and in the "audit every architectural gate against what it actually scans"
   recommendation.

2. **A defect class the sweep has not named: production fields whose *derivation* is
   untested because a type-only test and a stubbing consumer test between them look like
   coverage.** `InstallPluginOutcome.orphanRewake`, `.landedDisabled`, and the
   `!landedDisabled` guard on `.resourcesChanged` are each written in exactly one place
   (`install.ts:1768–1783`) and read in exactly two consumers. `grep` finds them
   "covered" — but every hit is either a literal in `tests/orchestrators/types.test.ts` (a
   type-only module whose cases are `satisfies` checks) or a stubbed return value in
   `tests/orchestrators/import/execute.test.ts`, which mocks `installPlugin` outright.
   Deleting the production line leaves the suite green. **Every orchestrator that returns a
   discriminated outcome consumed by a mocking caller has this exposure: check
   `uninstall`, `update`, `reinstall`, `enable-disable`, and `marketplace/*` for outcome
   fields whose only test hits are in `types.test.ts` or in a caller's stub factory.** The
   detection recipe is cheap: for each optional field on an outcome type, grep `tests/` and
   check whether any hit is an *assertion against a value the real orchestrator produced*.

3. **The "sibling drift" shape has an intra-file variant worth calling out separately.**
   META-FINDINGS frames sibling drift as file-vs-file. In this 9,431-line file the drift is
   *within one file*: the byte-exact whole-message form exists at 3 cases (5303, 5416, 5474)
   and the whole-outcome form at 3 more (3652, 3766, 8006), while 20+ cases a few hundred
   lines away use fragments. Splitting the module (Decisions item 2) will not fix this and
   may hide it, since the strong and weak cases would land in different files. **Recommend
   the fixing pass treat "convert weak cases to the strongest form already in the same
   file" as a step that runs *before* any module split, not after.**

### Corrections to META-FINDINGS.md

1. **"`clone-cache.test.ts` vs. its 4 siblings (loose `assert.equal` …)"** — the phrase
   "loose" is wrong and would send the fixing pass on a false errand.
   `tests/orchestrators/plugin/clone-cache.test.ts:1` imports `node:assert/strict`, where
   `assert.equal` **is** `assert.strictEqual`; every one of the 24 test files under
   `tests/orchestrators/plugin/` imports the strict entry point, and
   `grep -rn 'from "node:assert"' tests` returns nothing repo-wide. The underlying critique
   is probably valid in a different form — using `assert.equal` on one property where the
   whole value is the promise — but the correction matters: **there is no loose-equality
   defect anywhere in this test tree**, and no work should be scheduled to fix one.

2. **"`bridges/hooks/routing-state.ts` | `resetRoutingState`/`resetEpoch` — doc comment
   **falsely claims** production-lifecycle status"** — the doc comments do not lie.
   `routing-state.ts:316–318` reads "Its only caller today is test setup, which is what a
   reset is for", and `:188–190` reads "the test reset seam is its only caller." Both are
   factually accurate (`grep -rn resetRoutingState extensions/` returns the declaration and
   nothing else; same for `resetEpoch` apart from its call inside `resetRoutingState`). What
   the comment at 313–315 does is make an *argument* — "A public lifecycle operation rather
   than a test hole … this module is the one place that knows the full cell inventory."
   The finding stands (it is still a test-only hook over module-global state), but the
   fixing pass is arguing with a stated design rationale, not correcting a false claim, and
   the two need different handling. The `bridges/hooks/routing-state.ts` row of the item-2
   table should say "doc comment honestly admits test-only callers but argues the reset is a
   lifecycle operation."

### Confirmations

- **Item 2 (test-only reset hooks), confirmed from a second angle.** Independent grep:
  `resetCompletionCache` and `resetRoutingState` each have **zero** production call sites
  (`completion-cache.ts:436` and `routing-state.ts:320` are the declarations; the only other
  hit is a doc comment at `completion-cache.ts:40`). In slice B alone the hooks reset is
  called from 4 cases and the cache reset from 2, and 5 of those 6 register no cleanup — so
  the hook is not merely unused-in-production, it is used *incorrectly* in tests.

- **Item 3 (fragment assertions), confirmed and quantified for this file.** The first pass
  characterised `install.test.ts` as having "scattered 'at least one notification' checks."
  In slice B alone the count is 8 cases with no notification-count assertion, 5 with regex
  fragments where the bytes are computable, and 2 with `>= 1`. The correct form is not only
  "next door in `*.messaging.test.ts`" — it is **in this same file**, at lines 5337–5343,
  5457–5465, 5502–5505 and 8037–8042. That strengthens the item's cost argument: the fix is
  copy-within-file, not cross-file translation.

- **Decisions item 2 (module splits), qualified support with a sequencing constraint.** The
  first pass's split recommendation for `install.ts` is sound, but see cross-cutting point 3:
  the strong and weak cases for the *same* contract currently sit in one file and would be
  separated by the split. Do the assertion conversion first.

- **"Patterns to propagate" table, one addition.** `tests/orchestrators/plugin/install.test.ts:3652`
  and `:3766` combine four techniques the table lists separately — whole-outcome equality, a
  silence proof (`deepStrictEqual(notifications, [])`), an ordered shared-log call schedule,
  and a hand-written whole-tree filesystem inventory (`retryTree`, from
  `tests/orchestrators/plugin/scope-tree-inventory.ts`) — plus a fifth the table does not
  list: **proving idempotence by re-running the operation and comparing state bytes to the
  first run.** The `retryTree` whole-directory inventory in particular is the only mechanism
  in this area that catches a leaked staging directory, and it is used by 2 cases out of 39
  in my range.
