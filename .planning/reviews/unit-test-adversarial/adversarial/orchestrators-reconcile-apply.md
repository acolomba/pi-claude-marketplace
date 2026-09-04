# Orchestrators — reconcile apply, outcomes, plan — adversarial re-review

**Scope:** `tests/orchestrators/reconcile/{apply,apply-outcomes,plan}.test.ts` (4,127 lines,
read in full) and `extensions/pi-claude-marketplace/orchestrators/reconcile/{apply,apply-outcomes,plan}.ts`
(1,817 lines, read in full). Supporting reads: `tests/edge/notification-boundary.ts`,
`tests/architecture/reconcile-planner-purity.test.ts`, `domain/source.ts`,
`persistence/{state-io,config-merge}.ts`, `shared/probe-classifiers.ts`,
`orchestrators/plugin/shared.ts`, `orchestrators/marketplace/add.ts`,
`orchestrators/import/execute.ts` (duplication check only).
**First-pass file:** `unit-test-findings/orchestrators-reconcile-apply.md`
**Clean files attacked:** 2 (`tests/orchestrators/reconcile/apply-outcomes.test.ts`, plus the
blanket production clean claim covering all three production modules)
**Existing findings graded:** 8

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 5 |
| New WARNING (missed by first pass) | 12 |
| Existing CONFIRMED | 5 |
| Existing UNDERSTATED | 3 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's headline — "this is the strongest area reviewed so far" — is **broadly right
about assertion style and wrong about coverage**. Every assertion in all three files is a
whole-value comparison; there is not one `.includes()`, `assert.ok`, unawaited `rejects`, or
message-substring error match in 4,127 lines. But the first pass declared "each one would fail
against a plausible wrong implementation" for `plan.test.ts` and traced only two of the
parameter-threading mutations for `apply.test.ts`. Six mutations survive, and they cluster on
one contract: **CR-01 marketplace name aliasing (declared config key ≠ manifest-derived name) is
untested end-to-end, and reading the code through that hole surfaces what looks like a shipping
bug** (finding P-1 below).

## New findings — from the clean lists

### `tests/orchestrators/reconcile/apply-outcomes.test.ts` (declared clean)

The runtime half of this file survives every mutation I could construct (see "Still clean after
attack"). The type half has two gaps.

- **[WARNING] Widening the two-signal `Pick` on the ledger arms is undetected** — `apply-outcomes.ts:97`
  and `apply-outcomes.ts:136`; test file `lines 57-79` (positives) and `lines 208-241` (negatives).
  `PluginInstalledOutcome` and `PluginBackfilledOutcome` each inherit
  `Pick<EnableDegradationSignals, "orphanRewake" | "degradedKinds">` — deliberately 2 of the 5
  signals, per their own WR-04 doc comments. Every member of `LedgerDegradationSignals`
  (`orchestrators/plugin/shared.ts:70`) is optional, so mutating either `Pick` to the full
  `EnableDegradationSignals`, or to any wider member list, leaves both positive literals
  compiling and no `@ts-expect-error` failing. Narrowing is caught (an excess property in the
  positive fires); widening is not. Add two negatives beside the existing ones at lines 208 and
  224:
  ```ts
  void ({
    kind: "plugin-installed", scope: "project", marketplace: "official", plugin: "formatter",
    dependencies: [],
    // @ts-expect-error installed outcomes inherit only the orphan-rewake and degraded-kind signals
    stagedAgents: true,
  } satisfies PluginInstalledOutcome);
  ```
  and the same shape for `PluginBackfilledOutcome` (which additionally needs `installable` and
  `unsupported` to keep compiling). The `plugin-enabled` arm already has the mirror-image
  negative at line 269, so this is propagation, not invention.

- **[WARNING] `PerEntryOutcome` membership is unpinned in both directions** — `lines 169` and
  `339-344`. The union has 16 `kind` members; exactly one positive (`mp-added`, line 169) and one
  negative (an unknown discriminant, line 339) touch `PerEntryOutcome`. Deleting a member from the
  union at `apply-outcomes.ts:333` leaves this file green (the per-variant `satisfies` checks name
  the individual interfaces, never the union), and *adding* one is likewise invisible here. This is
  the closed-set silent-omission class this repo has shipped repeatedly. One line pins both
  directions — a `Record` literal fails to compile on a missing key (member added) and on an
  excess key (member removed):
  ```ts
  void ({
    "mp-added": true, "mp-add-failed": true, "mp-removed": true, "mp-remove-failed": true,
    "mp-remove-partial": true, "plugin-installed": true, "plugin-backfilled": true,
    "plugin-install-failed": true, "plugin-uninstalled": true, "plugin-uninstall-failed": true,
    "plugin-enabled": true, "plugin-enable-failed": true, "plugin-disabled": true,
    "plugin-disable-failed": true, "source-mismatch": true, "invalid-block": true,
  } satisfies Record<PerEntryOutcome["kind"], true>);
  ```

### `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` (covered by the blanket production clean claim)

- **[BLOCKER] P-1: plugins declared under a source-claimed marketplace can never be installed, and
  re-fail on every reload** — `lines 118-135` (`findRecordedBySource`), `line 289`
  (`classifyDeclaredPlugin`'s dangling check), `line 360` (`buildUninstallBucket`'s skip).
  CR-01 exists because `addMarketplace` records under the **manifest-derived** name while the user
  declares an arbitrary config key (`apply.ts:308-313` states this explicitly). The marketplace tier
  converges: `findRecordedBySource` claims the recorded name and no add/remove is planned. The
  plugin tier does not, and both spellings dead-end:
  - `"fmt@my-alias"` — `declaredMarketplaces["my-alias"]` exists, so it is not dangling;
    `recordedKeys` holds `"fmt@tools"` (built from state at `line 240`), so `recorded` is false and
    the entry lands in `pluginsToInstall` with `marketplace: "my-alias"`. `installPlugin` then looks
    up `state.marketplaces["my-alias"]`, which does not exist → a `marketplace not added` failure row,
    forever, on every reload.
  - `"fmt@tools"` — `declaredMarketplaces["tools"]` is undefined (only the alias is declared), so
    `line 289` routes it to `dangling-reference` → a `(failed)` row, forever.
  Separately, `buildUninstallBucket` skips the claimed record entirely (`line 360`: the record is
  neither in `merged.marketplaces` nor in `declaredAndRecorded`), so plugins recorded under it are
  invisible to the uninstall bucket too.
  **This is a behavior decision, not a mechanical fix** — either the planner must resolve plugin
  keys through the same source-claim map (`sourceClaimed`), or `addMarketplace` must record under
  the declared key, or the alias must be rejected at add time. Escalate. What is not in doubt is
  that nothing in the unit suite would notice any of the three: see T-1 and T-5 for the two cases
  that make the gap observable.

- **[WARNING] Dead conjunct in `buildUninstallBucket`'s skip condition** — `line 360`:
  `if (!merged.marketplaces[mpName] && !marketplaceDiff.declaredAndRecorded.has(mpName))`.
  Every member of `declaredAndRecorded` is added at `line 182` inside the loop over
  `Object.entries(merged.marketplaces)`, so membership implies `merged.marketplaces[mpName]` is
  defined; when the first conjunct is true the second is *always* true. Delete the second conjunct
  (the parameter `marketplaceDiff` then becomes unused and the call at `line 388` simplifies), or —
  if the intent was to include source-claimed names — fix it as part of the P-1 decision. While
  editing, note the same line tests an object for truthiness where the file's sibling checks use
  `=== undefined` (`line 215`, `line 289`, `line 366`).

### `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (covered by the blanket production clean claim)

- **[WARNING] `surfacePostCommitWarnings` is exported with no production importer, and is the one
  undocumented export in the file** — `line 879`. Its only production call site is `line 834`, in
  the same module; `grep -rn surfacePostCommitWarnings extensions tests` shows the only other
  importer is `apply.test.ts:62`. Under the guidelines an export widened for a test is a production-
  design finding: its behavior is already covered end-to-end by the cascade cases (`apply.test.ts:1288`,
  `:1445`, `:2415`). Either drop the `export` and let those cases own it, or — if the direct cases
  are worth keeping — say in a doc comment why the seam is public. Either way it needs the JSDoc
  every other export in these three files carries. **Note for the sweep: `.fallowrc.json` sets
  `production: false`, so the dead-code gate counts test files as consumers and can never flag a
  test-only export.** That makes this class invisible repo-wide, not just here.

### `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` (covered by the blanket production clean claim)

- **[WARNING] Two undocumented top-level exports** — `line 36` (`OutcomeBase`) and `line 41`
  (`PluginOutcomeBase`). Every other export in the file carries a doc comment, which is what makes
  these two conspicuous. This falsifies the first pass's clean claim "every exported symbol is
  documented" (with `apply.ts:879` it is wrong three times). One line each; describe what the base
  contributes (`the scope + marketplace subject every outcome row renders`).

## New findings — files the first pass cleared with one WARNING

### `tests/orchestrators/reconcile/plan.test.ts`

- **[BLOCKER] T-1: the `findRecordedBySource` declared-name guard is undiscriminated, and the case
  title claims it is** — `test("claims an alternate recorded name after skipping declared and
  different-source records")`, `line 99`; production `plan.ts:125`.
  Deleting `declared[name] !== undefined ||` from the `continue` condition leaves all 13 cases
  green. In this case's fixture the record named `declared` carries source `acme/declared` while
  the claiming key `alias` declares `acme/actual`, so the record is skipped by the *source*
  comparison whether or not the name guard exists — the two skip reasons are never separated. The
  title's "skipping declared … records" is therefore an unbacked claim.
  Fix — add one case whose declared source **matches** an already-declared record:
  ```ts
  const merged = mergedConfig({ alias: { source: "acme/tools" }, tools: { source: "acme/tools" } });
  const state = stateWith({ tools: marketplaceRecord("tools", githubSource("acme/tools")) });
  // expect marketplacesToAdd: [{ scope, marketplace: "alias", source: "acme/tools", configSource: "base" }]
  // and every other bucket empty
  ```
  With the guard, `alias` cannot claim `tools` (the name diff owns it) and an add is planned;
  without it, `alias` claims `tools` and `marketplacesToAdd` is empty. This is also the fixture
  the P-1 decision needs.

- **[BLOCKER] T-2: no case isolates the disable bucket, so one conjunct of the empty-plan fast path
  is deletable** — production `plan.ts:432` (`totalDisables === 0 &&`).
  The fast path at `plan.ts:426-436` returns `emptyReconcilePlan(scope)` when all seven totals are
  zero. Six of the seven conjuncts are pinned by a case that isolates that bucket — adds `line 187`,
  removes `line 99`, installs `line 442`, uninstalls `line 612`, enables `line 309`, mismatches
  `line 243`. Disables are not: the only two cases producing a disable (`line 406`, `line 528`) also
  produce an enable, so `totalDisables === 0` can be deleted and every case stays green. The wrong
  behavior it hides is real and total: a config whose only divergence is one plugin flipped to
  `enabled: false` would return the **empty** plan and the plugin would never be disabled, on any
  reload. Add a case mirroring `line 612`'s shape — one declared+recorded marketplace, one
  `"disable@marketplace": { enabled: false }` over an `enabled: true` record, nothing else — and
  assert the complete plan with the single `pluginsToDisable` entry.

- **[WARNING] T-3: the diagnostics concatenation order is unpinned** — production `plan.ts:446`
  (`sourceMismatches: [...marketplaceDiff.mismatches, ...pluginDiff.dangling]`).
  No case produces both a marketplace-level mismatch and a plugin-level dangling/malformed
  diagnostic: `line 243` and `line 528` are mp-only, `line 352` is dangling-only, `line 486` is
  malformed-only. Swapping the two spreads survives every case. (`apply.test.ts:2016` has all four
  causes but the cascade sorts by name, so it does not pin the plan's array order either.) Extend
  the `line 528` omnibus case with one malformed key (`"nokey": {}`) and one dangling entry, and
  assert the mp mismatches precede the plugin diagnostics in `sourceMismatches`.

- **[WARNING] T-4: no user-scope case reaches six of the seven buckets** — `plan.ts:173, 221, 328,
  367, 321, 338, 274/290` push sites. Only `marketplacesToAdd` is asserted under `scope: "user"`
  (`line 187`); `line 288` is the empty plan. Hardcoding `scope: "project"` in the other six push
  sites survives all 13 cases, and `scope` is what routes the apply pass to a scope root. Cheapest
  fix: change the omnibus case at `line 528` from `"project"` to `"user"` and update its expected
  literal — that pins `scope` on adds, removes, installs, uninstalls, enables, disables and
  mismatches in one case.

- **[WARNING] T-5: the test's inputs are computed by production code** — `line 14` and `lines 42-59`
  (`mergedConfig()` returns `mergeScopeConfigs(base, local)`). The guidelines are explicit: no test
  data computed with production code. `planReconcile` takes a `MergedConfig`; build it as a literal.
  The in-repo target already exists — `tests/persistence/config-merge.test.ts:462` writes
  `{ marketplaces: { x: { entry: {...}, source: "base" } }, ... } satisfies MergedConfig`. Today a
  change to `config-merge.ts`'s provenance rules silently changes what the planner's owner suite is
  testing, and `plan.test.ts` is the only owner `planReconcile` has.

### `tests/orchestrators/reconcile/apply.test.ts`

- **[BLOCKER] T-6: the WR-06 case's "marketplace stays recorded" promise is vacuous** — `line 1119`,
  in `test("WR-06: a plugin whose declaration is deleted is uninstalled while its marketplace stays
  recorded, and the next pass is silent")`.
  ```ts
  assert.deepStrictEqual(Object.keys(afterFirst.marketplaces["mp"]?.plugins ?? {}), []);
  ```
  The `?? {}` makes this pass when the marketplace record is *gone*: `Object.keys({})` is `[]`
  either way. Nothing else in the case pins the record — the cascade's `● mp [project]` header is
  rendered from the outcome's `marketplace` field, not from state; `line 1120` compares state to
  itself; `line 1122` lists file names. So mutating `uninstallPlugin` to drop the whole marketplace
  record on its last plugin passes this case, which is the one case that exists to forbid it.
  Replace `line 1119` with two assertions that fail on a missing record:
  ```ts
  assert.deepStrictEqual(Object.keys(afterFirst.marketplaces), ["mp"]);
  assert.deepStrictEqual(afterFirst.marketplaces["mp"]?.plugins, {});
  ```
  The sibling `?? {}` sites (`lines 995, 1218, 1684`) all assert a **non-empty** key list, so they
  are not vacuous — this is the only one where the fallback is load-bearing.

- **[BLOCKER] T-7: no case distinguishes the manifest-derived name from the declared config key, so
  the CR-01 row is unpinned** — production `apply.ts:313`
  (`outcomes.push({ kind: "mp-added", scope: op.scope, marketplace: result.name })`).
  `AddMarketplaceOutcome.name` (`marketplace/add.ts:137`) is the manifest-derived name and is the
  key the record is written under; `op.marketplace` is the user's config key. Every add case in this
  file constructs the fixture so the two are equal — `writeMarketplaceSource(cwd, "zulu-src",
  "zulu-mp", …)` declared as `"zulu-mp"` (`line 766`), `"local-mp"` (`line 824`), `"remote-mp"`
  (`line 2136`), `"p-mp"`/`"u-mp"` (`line 2091`). Mutating `result.name` to `op.marketplace` leaves
  all of them green, and the comment at `apply.ts:308-312` says in so many words that this is the
  one place the distinction matters.
  Add one case: declare `{ alias: { source: <dir whose manifest names it "actual"> } }`, run
  `applyReconcile` twice, and assert (a) the first cascade row reads `● actual [project] (added)`,
  (b) `Object.keys(state.marketplaces)` is `["actual"]`, (c) the second run emits nothing
  (`createNotificationBoundary(1, 2)` then a second boundary sized `(0, 0)`, or one run per case).
  Part (c) is the CR-01 convergence proof — the perpetual re-add/re-remove churn the guard exists to
  prevent — and it is currently proved nowhere at the apply tier. Pair it with T-1 and the
  no-plugins restriction in P-1 becomes visible as soon as anyone adds a plugin to that fixture.

- **[WARNING] T-8: the toggle loop's `skipped` arm has no case** — production `apply.ts:596-607`.
  `setPluginEnabled` returning `{ status: "skipped" }` (a competitor flipped the flag between the
  planner's read and the toggle's locked re-read) is dropped without a row. Reachable and untested.
  The technique is already in the file: mirror `test("WR-06: a plugin another process uninstalled
  first renders no row at all")` (`line 2578`) with `raceStateFromRead(t, project, 3, <state whose
  record is already enabled>)` and a `createNotificationBoundary(0, 0)`, asserting the silence.

- **[WARNING] T-9: `raceStateFromRead` patches the `node:fs/promises` module namespace** —
  `lines 433-464`, used by four cases (`2493`, `2550`, `2615`, `2650`). `createRequire(...)("node:fs/promises")`
  + `t.mock.method(fsModule, "readFile", …)` + `syncBuiltinESMExports()` rewrites the live ESM
  binding every module in the process reads. It is `t.mock.module()` in all but name, which the
  guidelines call a finding whose fix is injection. The helper is careful (restores in `t.after`,
  states the read index per case so a read-order change fails loudly) and there is no other way to
  provoke a deterministic mid-reconcile race today, so this is a **production design** finding, not
  a test rewrite: the state reader is a hidden `node:fs/promises` dependency of
  `persistence/state-io.ts`. The sanctioned fix is a narrow consumer-declared read port threaded the
  way `gitOps` already is through `ApplyReconcileOptions`. Record it; do not "fix" the test in place.

- **[WARNING] T-10: `dependenciesFromInstall` is duplicated in the import orchestrator** —
  `apply-outcomes.ts:436` vs `orchestrators/import/execute.ts:360` (`dependenciesFromInstalled`).
  Same closed set, same push order, same guards; the only difference is that the import copy wraps
  the result in `Object.freeze` and the reconcile copy does not, so the two disagree about whether
  the returned array is mutable. `dependenciesFromInstall` takes a structural
  `{ declaresAgents, declaresMcp }`, so the import call site already type-matches. Delete
  `dependenciesFromInstalled`, import the shared one, and decide freeze-or-not once. (Owned jointly
  with the import area; recorded here because the duplication is only visible from both sides.)

- **[WARNING] T-11: shared test support lives in three other concerns' directories** — `lines 70-72`:
  `../../edge/notification-boundary.ts`, `../../platform/git-ops-fake.ts`,
  `../plugin/scope-tree-inventory.ts`. The guidelines put fakes and harnesses beside the tests of
  their concern. `notification-boundary.ts` is genuinely cross-cutting (its own header documents the
  four-suite de-duplication that produced it) and is well built; the finding is that it now sits
  under `tests/edge/` while its consumers are mostly orchestrator suites. Low priority, repo-wide,
  and it should be settled once for the whole sweep rather than per file.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `apply-outcomes.ts` | `sourceMismatchOutcomeSubject` | `apply-outcomes.test.ts:346-411` (4 cases, all 4 causes) | owned |
| `apply-outcomes.ts` | `classifyOrchestratorThrow` | `apply-outcomes.test.ts:413-548` (12 cases) | owned |
| `apply-outcomes.ts` | `MigrateConfigSaveError` | `apply-outcomes.test.ts:551` | owned |
| `apply-outcomes.ts` | `classifyReadPassThrow` | `apply-outcomes.test.ts:583-667` (10 cases) | owned |
| `apply-outcomes.ts` | `dependenciesFromInstall` | `apply-outcomes.test.ts:669-713` (4 cases, all 4 combinations) | owned |
| `apply-outcomes.ts` | 19 type exports (`OutcomeBase` … `PerEntryOutcome`) | `apply-outcomes.test.ts:36-344` | owned; positives complete, negatives incomplete (see the two WARNINGs above) |
| `plan.ts` | `planReconcile` | `plan.test.ts:98-640` (13 cases) | owned |
| `apply.ts` | `applyReconcile` | `apply.test.ts:475-2672` (46 cases) | owned |
| `apply.ts` | `surfacePostCommitWarnings` | `apply.test.ts:2674-2774` (3 cases) | owned by a case, but the export has **no production importer** — see the WARNING above |

No pairing gaps: all three production modules have their mirrored `.test.ts`, and every runtime
export has at least one case that asserts its result (none is covered only incidentally).

## Branch census

**Reachable and untested (findings):**
- `plan.ts:432` — the `totalDisables === 0` conjunct of the empty-plan fast path. T-2.
- `plan.ts:125` — the `declared[name] !== undefined` disjunct: condition-covered (it evaluates true
  in `plan.test.ts:99`) but never *effect*-discriminated. T-1.
- `apply.ts:596-607` — the toggle loop's `skipped` drop arm. T-8.
- `apply.ts:109-110` — the right-hand `pathExists(loc.configLocalJsonPath)` of the pristine gate is
  never true on its own (no case has a local config file without a base one). Low value; one line
  in an existing arrange would close it.
- `plan.ts` CR-01 × plugin tier — no case combines a source-claimed marketplace with any plugin
  entry, which is how P-1 stayed invisible.

**Unreachable by real input (production, not test gaps):**
- `apply.ts:354` and `apply.ts:445` — the `result.version === undefined` arms of the two conditional
  spreads. `version` is required by `PLUGIN_INSTALL_RECORD_SCHEMA` (`state-io.ts`), so the
  orchestrators never omit it.
- `apply.ts:712` — `buildSuccess: ({ degradation: _degradation, ...info })` on the disable axis.
  `degradation` is only ever non-empty when `result.status === "enabled"` (`apply.ts:585-586`), and
  the disable axis' `successStatus` is `"disabled"`, so the discard never discards anything. The
  comment explains it as an excess-property guard, which is accurate — it is defensive typing, not a
  branch wanting a case.
- `apply-outcomes.ts:383-391` — the implicit fall-out of `switch (err.shape.kind)`.
  `PluginShapeErrorShape` (`shared/errors.ts:510-540`) has exactly the four kinds the switch handles
  and all four have cases, so the fall-through to `narrowProbeError` is unreachable today. It becomes
  reachable the moment a fifth kind is added — which is precisely the first pass's WARNING, and it
  is correctly rated.

**Compiler-forced (D-116-01a class, not removable):**
- `plan.ts:318` and `plan.ts:337` — `record !== undefined` after
  `state.marketplaces[marketplace]?.plugins[plugin]`. Under `noUncheckedIndexedAccess` the value is
  `PluginRecord | undefined` and cannot be used without the guard. (It is also *nearly* reachable:
  `recordedKeys` is built with `${plugin}@${mp}` while `parsePluginKey` splits on the last `@`, so a
  marketplace name containing `@` would desynchronize the two — the safe-name rules make that
  unreachable in practice.)

**Order contracts that are equivalent mutants, not gaps** (recorded so the fixing pass does not
chase them): reordering `applyPluginUninstalls` with `applyMarketplaceRemoves`, or the enable loop
with the disable loop, or moving `applySourceMismatches` earlier in `applyPlan` (`apply.ts:691-718`)
changes nothing observable — the buckets are disjoint by construction (`plan.ts:352-357` excludes
removed-marketplace plugins) and the cascade is sorted by name before rendering. The two order
promises that *are* observable are both proved: add-before-install by
`apply.test.ts:2191`, project-before-user by the `clonedUrls()` sequence at `apply.test.ts:2178`.

## Grading of first-pass findings

### `tests/orchestrators/reconcile/plan.test.ts`
- **CONFIRMED** — *Placeholder variable name `result`* — 12 of the 13 cases do use `const result`;
  the sibling files in the same directory name values by role (`apply.test.ts` uses `record`,
  `afterFirst`, `notifications`; `apply-outcomes.test.ts` uses `reason`, `dependencies`), so this is
  sibling drift with a target next door. Rename to `plan`. Two corrections to the entry's
  reasoning, neither changing the verdict: (a) the justification offered for the `describe` block —
  "correctly groups all cases under one `describe` … since the module has exactly one export" —
  inverts the rule, which asks for `describe()` *only when the module has several* entrypoints;
  a single wrapper is harmless but is not evidence of correctness. (b) "No other findings" is
  falsified five times (T-1 … T-5).

### `tests/orchestrators/reconcile/apply.test.ts`
- **UNDERSTATED** — *The five driven orchestrators are exercised for real, never as `strong-mock`
  interaction mocks*. The design decision is right and META-FINDINGS is right to protect it
  (item 3 under "Decisions"), so the severity should stay WARNING — but the entry's supporting
  claim, "the current design does clear the 'would a wrong implementation still pass' bar for the
  cases in this file", is falsified by T-7: a wrong `marketplace` argument on the `mp-added` outcome
  passes every case, precisely because no fixture separates the manifest name from the config key.
  The gap is a **fixture** gap, not a mocking gap — adding the injection seam would not have caught
  it either, since a mock would have been written against the same equal-names fixture. Re-file the
  entry as "the behavioral-proof design is correct; the fixtures do not exercise the one argument
  whose value is not the caller's own input."
- **CONFIRMED** — *No case pins the documented config-to-record reconciliation limit*. The proposed
  case (delete a materialized artifact under an intact record, expect silence and byte-identical
  state) is distinct from the RECON-05 converged case at `line 2277`, which has no materialized
  plugin at all. Keep the version stamp equal to `EXTENSION_VERSION` in the fixture or the BFILL
  gate opens and the case stops testing what it names.

### `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`
- **UNDERSTATED** — *`switch (match)` has no `default` arm* (`lines 184-208`). The diagnosis is
  right — `SamePlannedSourceResult` (`domain/source.ts:569`) is a closed 3-member union, the switch
  is used for side effects so TypeScript demands nothing, and its own doc comment's claim that "the
  compiler forces every caller to switch on the discriminant explicitly" is false at this site. But
  **the proposed fix preserves the defect it names**: `default: { const _exhaustive: never = match;
  continue; }` still drops the entry silently at runtime, which is exactly the "config↔state
  divergence silently dropped" harm the finding cites. Use the house idiom at
  `bridges/hooks/settle.ts:211-217` instead — pin exhaustiveness at compile time *and* give the new
  member a truthful runtime landing:
  ```ts
  default: {
    const unknownMatch: never = match;
    mismatches.push({
      scope, cause: "unknown-stored", marketplace: mpName,
      declaredSource: declaredEntry.entry.source, recordedSource: String(unknownMatch),
    });
    continue;
  }
  ```
  This also sidesteps `noUnusedLocals: true` (`tsconfig.json:13`), which the bare `_exhaustive`
  form may trip — TypeScript's underscore exemption is documented for parameters, not locals.
  `assertNever` (`shared/errors.ts:26`) is importable without breaking the DIFF-01 purity gate
  (its forbidden list is fs / platform-git / gitOps / notify / save* / lock*), but it **throws**,
  and this code runs inside `resources_discover` where NFR-2 forbids a throw escaping — so the
  settle.ts pin-and-land form is the right one here, not `assertNever`.

### `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`
- **UNDERSTATED** — *`switch (m.cause)` in `applySourceMismatches` has no `default` arm*
  (`lines 625-659`). Same correction: `default: { const _exhaustive: never = m.cause; break; }`
  leaves the fifth cause dropped from the cascade, which is the harm the finding names. The default
  must push a row. Hoist the renderable subject before the switch so the default arm has something
  to push after `m` narrows to `never`:
  ```ts
  const subject = "marketplace" in m ? m.marketplace : m.rawKey;
  switch (m.cause) { /* … */ default: {
    const unknownCause: never = m.cause;
    void unknownCause;
    outcomes.push({ kind: "source-mismatch", cause: "source-mismatch", scope: m.scope, marketplace: subject });
  } }
  ```
- **CONFIRMED** — *The five driven orchestrators are hardcoded static imports*. Accurate, and the
  `gitOps` precedent named in the entry is real (`opts.gitOps` is threaded at `apply.ts:305` and is
  what makes the offline proof possible at all). Keep it as a WARNING and keep it decoupled from the
  test-style question — per T-7, the seam is not what the missing verification needs.

### `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`
- **CONFIRMED** — *`switch (err.shape.kind)` has no `default` arm* (`line 383`). Verified against
  `shared/errors.ts:510-540`: exactly four kinds, all four handled, and the post-switch
  `return narrowProbeError(err)` at `line 394` really is the load-bearing fallback. Writing it as
  `default: return narrowProbeError(err);` is the right fix and, unlike the two BLOCKER instances,
  changes no runtime behavior.
- **CONFIRMED** — *Misleading JSDoc on `classifyOrchestratorThrow`* (`lines 372-373`). Verified:
  `apply.ts:66` and `backfill.ts:26` both import it; `backfill.ts` calls it at lines 299 and 387.
  The export is required regardless of testing. Drop the sentence.

## Still clean after attack

- **`tests/orchestrators/reconcile/apply-outcomes.test.ts` (runtime half)** — survives every
  mutation I could construct. `classifyOrchestratorThrow`: reordering the `StateLockHeldError` and
  `PluginShapeError` ladders, deleting the `PluginShapeError` block, collapsing any one of the four
  kind arms into another, and dropping the `narrowProbeError` fallback are all caught, arm by arm.
  `classifyReadPassThrow`: deleting the `err.cause instanceof SyntaxError` unwrap is caught by
  `line 584` — I checked `narrowProbeError` (`shared/probe-classifiers.ts:38-66`) and it does *not*
  unwrap causes for a plain `Error`, so the branch is genuinely load-bearing and the case genuinely
  discriminates it. `dependenciesFromInstall`: all four input combinations are separate cases and
  the array is compared whole, so a swapped push order, a dropped guard, or an inverted boolean all
  fail. `MigrateConfigSaveError`: the single case compares `instanceof`, `name`, `message`,
  `configFilePath`, `cause` and the cause's `code` as one object, so dropping `this.name`, using the
  full path instead of `path.basename`, or losing the cause each fail. `sourceMismatchOutcomeSubject`:
  both ternary branches have two cases each, so inverting it fails twice.
- **`tests/orchestrators/reconcile/apply.test.ts` — parameter threading.** I re-traced the first
  pass's two claims and both hold. Dropping `applyDefaultEnabled: true` (`apply.ts:405`) fails
  `line 1544` (`enabled === false`) and the `(disabled)` row at `line 1538`. Dropping or inverting
  the `local: true` conditional spread (`apply.ts:413`) fails `line 1605`/`line 1606` (base file
  byte-identical, local file stamped). I add three more that hold: dropping the `gitOps` forward at
  `apply.ts:305` fails `line 870`'s `clonedUrls()`; reversing the scope order at `apply.ts:732`
  fails `line 2178`'s clone sequence; and each of the five `degradationFromEnable` spreads
  (`apply.ts:534-538`) is separately pinned — `unsupported` by `line 1876`, `degradedKinds` and
  `orphanRewake` by the `enableSignalRows` rows at `lines 1752` and `1760`, `stagedAgents` and
  `stagedMcpServers` by `line 1747`.
- **`tests/orchestrators/reconcile/apply.test.ts` — the notification boundary.** The IL-2 sizing is
  a real proof, not a formality: `createNotificationBoundary` states `times(emissions)` exactly and
  deliberately installs *no* expectation for a zero (its header explains that `strong-mock` treats
  `times(0)` as unlimited), so the five zero-emission cases (`lines 479, 2290, 2400, 2616, 2682`)
  fail at the call site on the first unwanted notification. `verifyBoundary()` is the last statement of all
  43 case bodies (49 executed cases, counting the four data-driven loops), never hidden in a hook. Every message is a whole-string `deepStrictEqual` against a hand-written
  literal including severity; there is no `.includes()`, `assert.ok`, `assert.match`, unawaited
  `rejects`, or message-substring error match anywhere in the three files.
- **Hermeticity of `apply.test.ts`.** Each case takes two fresh `mkdtemp` roots, registers teardown
  *before* acting (`lines 171-190`), restores `HOME` and `PI_CODING_AGENT_DIR` including the
  "was-unset" case, chmods denied directories back before removal, and refuses to run `denyWrites`
  as root with a message naming the environment rather than failing against the logic. The git edge
  defaults to an allow-nothing fake, so an unplanned clone fails loudly — the technique
  META-FINDINGS recommends propagating from `fetch.test.ts` is already in force here.

## Not covered

- I did not run `node --test`, `npm run test:coverage:direct`, or `npm run check` — the brief
  forbids it. Every mutation verdict above is from reading; the P-1 production defect in particular
  is a code-trace conclusion and should be confirmed with a throwaway fixture before any fix is
  designed.
- `backfill.ts` / `notify.ts` / `pending.ts` / `types.ts` / `reconcile.messaging.ts` and their tests
  belong to other areas. I read `backfill.ts:87` only far enough to confirm what `stateExisted`
  feeds, and `notify.ts` not at all — so I take no position on whether the cascade projection this
  suite asserts against is itself correct. `apply.test.ts` treats it as an oracle it re-derives by
  hand, which is the right relationship.
- `tests/edge/notification-boundary.ts`, `tests/platform/git-ops-fake.ts` and
  `tests/orchestrators/plugin/scope-tree-inventory.ts` were read as background only.

## Meta-findings impact

### New cross-cutting evidence

1. **`production: false` in `.fallowrc.json` makes test-only exports structurally invisible.**
   `apply.ts:879`'s `surfacePostCommitWarnings` is exported, has one production call site inside its
   own module, and no production importer — the dead-code gate cannot flag it because test files
   count as consumers. META-FINDINGS item 2 ("Replace test-only hooks over module-global state")
   found four *reset hooks*; this is the quieter sibling — an ordinary function widened to `export`
   for a test — and no gate in the repo can find it. **Recommended sweep-wide check:** for every
   export in `extensions/`, `grep -rn <name> extensions | grep -v <own file>`; anything with zero
   hits outside its own module and ≥1 hit in `tests/` is this class. Cheap, mechanical, and it
   should run before the fixing pass decides which exports are contract.

2. **A whole contract can be untested because every fixture makes two distinct values equal.**
   CR-01 (declared config key vs manifest-derived marketplace name) is documented in four separate
   comment blocks across `plan.ts` and `apply.ts`, has a dedicated planner guard, and has *no*
   fixture anywhere in which the two names differ. The result is one surviving mutation
   (`apply.ts:313`), one undiscriminated guard (`plan.ts:125`), and one apparent shipping bug
   (P-1). The generalizable check: **whenever production code goes out of its way to distinguish
   two same-typed values, grep the fixtures for a case where they actually differ.** Other areas
   where this shape is likely: the scope pairs (`opts.scope` vs `op.scope`), plugin name vs
   generated resource name (`domain/name.ts` consumers), and `configJsonPath` vs
   `configLocalJsonPath` in the write-back paths.

3. **`?? {}` / `?? []` in an assertion that expects the empty value is a vacuity pattern.**
   `apply.test.ts:1119` is one instance; three sibling sites in the same file are safe only because
   they expect non-empty lists. Worth a repo-wide grep of
   `assert.*Object.keys(.*\?\? \{\}).*\[\]` and its array variants — the fallback silently converts
   "the container is gone" into "the container is empty", which is often the exact fact the case
   promises.

4. **Duplicated helper across orchestrator families:** `dependenciesFromInstall`
   (`reconcile/apply-outcomes.ts:436`) and `dependenciesFromInstalled`
   (`import/execute.ts:360`) — same closed-set derivation, diverging only on `Object.freeze`.
   fallow's `dupes` gate did not catch it. Adds one row to META-FINDINGS' sibling-drift list, and
   suggests the dupes threshold is not covering small closed-set mappers.

### Corrections to META-FINDINGS.md

- **"`plan.ts` purity is genuine" (falsified-hypothesis list, last section).** Qualify it. The
  purity claim holds — plan.ts imports only leaf-pure helpers and the DIFF-01 gate
  (`tests/architecture/reconcile-planner-purity.test.ts`) checks a comment-stripped blacklist of ten
  patterns. But purity was the *only* thing verified about the planner; the module's actual diff
  logic has a deletable fast-path conjunct (T-2), an undiscriminated CR-01 guard (T-1), an unpinned
  output order (T-3), a dead conjunct (`plan.ts:360`), and a plugin-tier hole that looks like a
  shipping bug (P-1). "Purity is genuine" should not be read as "the planner is well covered."
- **"Ranked by leverage" item 5 (restore exhaustiveness on closed-union switches).** The two
  reconcile BLOCKERs are real, but the fix as recorded in the area file — a bare `never` pin plus
  `continue`/`break` — **preserves the silent drop that makes them BLOCKERs**. Whoever executes item
  5 must use the pin-and-land form (`bridges/hooks/settle.ts:211-217`), not `assertNever` and not a
  bare pin: this code runs inside `resources_discover`, where NFR-2 forbids a throw escaping and
  where a dropped row is the failure mode being guarded against.
- **"Decisions the fixing pass cannot make" needs a fifth item.** P-1 (plugins under a
  source-claimed marketplace) is a behavior decision with three viable answers — resolve plugin keys
  through the claim map, record marketplaces under the declared key, or reject the alias at add
  time. It is not a test finding and cannot be settled by the fixing pass.

### Confirmations

- **Item 3 under "Decisions" — `apply.ts`'s deliberate deviation is the rare correct one.**
  Independently confirmed from a second angle. The `createNotificationBoundary` sizing means a
  dropped `notifications: { mode: "orchestrated" }` on any of the five orchestrator calls makes that
  orchestrator emit its own notification, which throws at the call site rather than being counted
  afterwards; and the DFEN-04/DFEN-05 pair really does catch the two option-threading bugs a
  strong-mock would have been written for. Do not convert this suite. My one qualification (T-7) is
  about fixtures, not about mocking.
- **"Patterns to propagate" — the offline fake that fails loudly.** `createOfflineGitOps`
  (`apply.test.ts:93-99`) already carries the empty allow-list that META-FINDINGS recommends
  adopting from `fetch.test.ts`, and `clonedUrls()` is asserted in all 46 `applyReconcile` cases. This area is a
  second reference implementation for that row of the table.
- **"Whole-message assertion against hand-written strings" (the `*.messaging.test.ts` row).**
  `apply.test.ts` meets that bar without being a messaging test: 49 cases, every one comparing the
  complete cascade string and severity against an authored literal, with the file header stating
  that no expectation calls the projection. It belongs in that row as evidence the convention
  scales to a full orchestrator suite.
