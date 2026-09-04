---
phase: 115-composition-orchestrators
fixed_at: 2026-09-02T06:35:00Z
review_path: .planning/phases/115-composition-orchestrators/115-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 11
skipped: 1
status: partial
---

# Phase 115: Code Review Fix Report

**Fixed at:** 2026-09-02T06:35:00Z
**Source review:** `.planning/phases/115-composition-orchestrators/115-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 12 (1 critical, 11 warnings)
- Fixed: 11
- Skipped: 1 (WR-02 — both remedies are out of bounds; needs an operator decision)

Two of the eleven are partial by design: WR-01 and WR-04 got the accurate doc
comment plus a ledger entry, but not the structural enforcement the reviewer
preferred, because in both cases that enforcement collides with a stated bound.
Each is itemized below with the exact bound it hits.

## The mechanism this pass restored

The review's central claim is that a deleted defense was replaced by a claim of
compile-time enforcement TypeScript does not make. I verified both halves of that
claim against this repository's own compiler before fixing anything, and both
hold:

1. A `void`-returning switch with a missing arm compiles clean. Planting a third
   `InstallPluginOutcome` arm produced **zero** diagnostics in
   `import/execute.ts`, and planting a new `PerEntryOutcome` kind produced
   **zero** in `reconcile/notify.ts`.
2. An overload whose return type is narrower than the implementation's is
   accepted silently. Making `addMarketplace`'s orchestrated success arm return
   `undefined` — a direct violation of the D-115-10 narrow overload — left
   `tsc --noEmit` at **exit 0**.

Restoring a runtime `default: assertNever` arm was not available: it creates a
branch no input can reach, which breaks the 100 percent direct-branch-coverage
requirement (bound 4). The fix used instead is the reviewer's own stated
alternative — **give the switch a value-returning shape**, which restores the
real TS2366 check with no unreachable arm and no coverage cost. Four switches now
carry that check where none did before.

## Verification

All five gates were run separately, at final HEAD, and each reports exit 0:

| Gate | Command | Exit |
|---|---|---|
| typecheck | `npm run typecheck` | 0 |
| lint | `npm run lint` | 0 |
| fallow | `npm run fallow` | 0 |
| unit | `npm test` | 0 — 4832 tests, 0 fail |
| integration | `npm run test:integration` | 0 — 31 tests, 0 fail |

`npm run check` was deliberately not used: it short-circuits at `format:check` on
the operator's untracked `.mcp.json` and `.planning/research/.cache/*.json`,
which I did not touch.

Direct coverage of the two named modules, measured at final HEAD:

- `orchestrators/import/execute.ts` — branches 150/150, functions 35/35, lines 1207/1207
- `orchestrators/reconcile/apply.ts` — branches 117/117, functions 21/21, lines 918/918

Also confirmed 100 percent for `reconcile/notify.ts` (125/125, 21/21, 973/973),
`reconcile/pending.ts`, `plugin/bootstrap.ts`, `marketplace/remove.ts` (95/95,
down from 97 because WR-07 removed two branches), and `import/index.ts`.

The correspondence gate reports 14 violations — the pre-existing Phase 116/117
set. Phase 115 still owns none, and the new `tests/helpers/notification-boundary.ts`
adds none (the gate only inspects `.test.ts` files).

No Phase 114 owner suite was edited. `marketplace/add`, `marketplace/remove`,
`plugin/uninstall` and `plugin/enable-disable` pass unmodified (191 tests).

No `c8 ignore`, `fallow-ignore`, `eslint-disable`, coverage exception, or
production test seam was added anywhere.

## Fixed Issues

### CR-01: `installOnePlannedPlugin` lost its exhaustiveness gate

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`
**Commit:** `a9c922a6`
**Applied fix:** The function returned `Promise<void>`, so its switch over
`InstallPluginOutcome` was unchecked and the surviving comment promised the
opposite. It now declares a `PlannedPluginBucket` return naming the result bucket
each exit records into, which restores TS2366 at the switch itself — stronger
than the mapped-table test gate the brief suggested, because it fires at the edit
site rather than in another file. The comment now names the declared return type
as the mechanism and explains why the switch alone is not one.

**Plant:**
```
# added `| { readonly status: "planted-third-arm" }` to InstallPluginOutcome
$ npx tsc --noEmit
```
- Against the pre-fix `execute.ts`: **no diagnostic in `execute.ts`** (only an
  unrelated TS2339 in `reconcile/apply.ts`). The switch fell through silently.
- Against the fixed `execute.ts`:
  `execute.ts(657,4): error TS2366: Function lacks ending return statement and
  return type does not include 'undefined'.`

### WR-01: the D-115-10 overloads are unchecked assertions (partial)

**Files modified:** `orchestrators/marketplace/add.ts`,
`orchestrators/marketplace/remove.ts`, `orchestrators/plugin/uninstall.ts`,
`orchestrators/plugin/enable-disable.ts`, `.planning/WINDOWS.md`
**Commits:** `941d5d7e`, `dd493720`
**Applied fix:** The reviewer's structural remedy — split each entrypoint so the
narrow overload delegates to a helper whose *declared* return type is
`Promise<TOutcome>` — was **not** applied. It restructures the orchestrated and
standalone arms of three production modules whose Phase 114 owner suites are
complete and closed to edits (bound 5), and those arms are interleaved through
several hundred lines of each entrypoint. The reviewer's own stated fallback was
applied instead: all four doc comments (including `setPluginEnabled`, the
original, which had the same overstatement) now say what the overload does prove
— it removes the `undefined` arm at the call site, which is what made the
consumer's guard a compile error — and what it does not: nothing checks the body.
The exposure is recorded in `.planning/WINDOWS.md` as entry 13.

**Plant:**
```
# addMarketplace's orchestrated success arm changed to `return undefined;`
$ npx tsc --noEmit ; echo $?
TSC_EXIT=0
$ npx tsc --noEmit 2>&1 | grep -c "reconcile/apply"
0
```
An implementation that demonstrably violates the narrow overload typechecks
clean, and the consumer whose guard D-115-10 deleted reports nothing either. The
reviewer's claim is confirmed against this repository's compiler, which is what
the corrected doc comments now assert.

**Residual:** every orchestrated arm of all four producers returns a defined
outcome today, and `tests/orchestrators/reconcile/apply.test.ts` drives all four
in orchestrated mode across its outcome matrix and asserts the complete cascade,
so a regression on an exercised path fails there. An arm the matrix does not
reach is covered by neither the type nor a test.

### WR-03: three `default: assertNever` arms removed from `void` switches

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`
**Commit:** `8ee96d29`
**Applied fix:** `applyMarketplaceOutcomeToBlock`, `applyPluginOutcomeToBlock`
and `applyOutcomeToBlock` each now answer with the `MarketplaceBlock` they
mutated instead of `void`. That is a fluent-mutator return the caller discards;
it adds no branch, no runtime cost and no unreachable arm, and it restores the
TS2366 check the deleted `assertNever` provided. Each doc comment now states that
the return type — not the narrowed `Extract<>` parameter — is the mechanism.

**Plant:**
```
# added `| { readonly kind: "planted-new-kind"; ... }` to PerEntryOutcome
$ npx tsc --noEmit 2>&1 | grep "reconcile/notify.ts"
```
- Against the pre-fix `notify.ts`: **no diagnostic at all**. All three switches
  were unguarded.
- Against the fixed `notify.ts`: `notify.ts(869,4): error TS2366` at
  `applyOutcomeToBlock`. Routing the planted kind into the marketplace-subject
  `Extract<>` then raises `notify.ts(672,4): error TS2366` at
  `applyMarketplaceOutcomeToBlock`; routing it into the plugin-subject
  `Extract<>` raises `notify.ts(770,4): error TS2366` at
  `applyPluginOutcomeToBlock`. All three sites fire.

Direct coverage of `notify.ts` stayed at 125/125 branches, 21/21 functions,
973/973 lines.

### WR-04: plugin rows with no marketplace header are silently discarded (partial)

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`,
`.planning/WINDOWS.md`
**Commits:** `015cf527`, `dd493720`
**Applied fix:** The structural remedy was **not** applied. Both variants the
reviewer offered (a `throw` on an unrendered key, or an `pushDiagnostic` on a
size mismatch) introduce a branch that no input can reach — I confirmed the
invariant closure at `import/marketplaces.ts::scopedPlan`, which derives
`pluginsToInstall` and `marketplacesToEnsure` from the same `refs` set under one
scope — so either would drop `import/execute.ts` below 100 percent branch
coverage, which bound 4 forbids. What was applied is the reviewer's other
instruction: the `MarketplaceBlock` doc comment no longer implies the required
`status` prevents this. It now states precisely that a required status makes a
*statusless header* unconstructible and does nothing about a *headerless row*,
and names the four-function invariant that actually rules one out. A second
comment at the `?? []` site says that fallback is the no-rows case, not an
absorber. Recorded as `.planning/WINDOWS.md` entry 14.

**Note:** WR-06's fix closes the one concrete near-miss the reviewer named — the
`unknown-stored` branch now assigns a marketplace status instead of leaving the
key headerless.

### WR-05: "touches the config file once" asserted "at least once"

**Files modified:** `tests/orchestrators/import/execute.test.ts`
**Commit:** `c8704b29`
**Applied fix:** Added a `countAtomicWrites(t, path)` spy helper that counts the
`fs.rename` calls whose destination is the target — `write-file-atomic` finishes
every write with exactly one such rename. This is the sanctioned spy case in the
rules ("real behavior must run and the observation is the promise"), and it uses
the `createRequire` pattern the sibling `raceStateFromRead` helper already
established. The case now asserts `configWrites() === 1`. I also converted the
two sibling `assert.strictEqual(after.mtimeMs, before.mtimeMs)` "does not
rewrite" cases to `configWrites() === 0`, which removes the same
mtime-granularity weakness in its mirror form and lets `stat` drop out of the
suite entirely. The test was kept rather than deleted: its arrange differs from
the preceding case (a pre-existing config file), so with an exact count it now
proves a property nothing else proves.

**Plant A** — batching regressed into a repeated write:
```
# the single `await writeBatchedConfigEntries(...)` duplicated
$ node --test tests/orchestrators/import/execute.test.ts
✖ touches the config file once for a multi-entry batch
ℹ pass 47  ℹ fail 1
```
The old `after.mtimeMs > before.mtimeMs` assertion is satisfied by two writes, so
this regression was invisible to it.

**Plant B** — the nothing-to-declare short circuit removed:
```
✖ leaves an already-declared config byte-identical when every entry was a skip
ℹ pass 47  ℹ fail 1
```

### WR-06: an unrecognized stored source reported "(no marketplaces)" at info

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`,
`tests/orchestrators/import/execute.test.ts`
**Commit:** `f09695f2`
**Applied fix:** The `unknown-stored` arm now routes through the existing
`recordMarketplaceAddFailure` bookkeeping before pushing its diagnostic. That
reuses the established `marketplaceFailures -> setMarketplaceStatus("failed")`
path with no new reason vocabulary, and silences the dependent plugins' advisory
rows exactly as a genuine add failure does. The command now renders
`⊘ mp [user] (failed)` at `error` severity instead of `(no marketplaces)` with no
severity argument — which under the project's tri-state model was reporting "the
desired state was reached" over a marketplace and all its plugins being skipped.
The owner case was retitled and its expected result and cascade updated.

**Verification:** the replacement expectation was authored from the messaging
grammar and the neighbouring add-failure case, not pasted from output, and
matched byte-for-byte on the first run. Suite: 48 pass, 0 fail. Direct coverage
unchanged at 150/150 branches.

### WR-07: an `if` whose two branches return the same value

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`
**Commit:** `57e3a420`
**Applied fix:** Collapsed `resolveRemoveTargetOrSurface` to two direct returns
as the reviewer wrote it. The Phase 114 owner suite passes unmodified (20 tests),
and direct coverage stays at 100 percent with two fewer branches (95/95).

### WR-08: ~50 lines of notification-boundary scaffolding duplicated four ways

**Files modified:** `tests/helpers/notification-boundary.ts` (new),
`tests/orchestrators/import/execute.test.ts`,
`tests/orchestrators/reconcile/pending.test.ts`,
`tests/orchestrators/reconcile/apply.test.ts`,
`tests/orchestrators/plugin/bootstrap.test.ts`
**Commit:** `c2472de8`
**Applied fix:** Extracted one factory with the signature the reviewer specified,
`createNotificationBoundary(emissions, toolProbes = emissions * 2)`, which
already covered every call site (`apply.test.ts` passes both arguments; the other
three pass one). Net −150 lines. `bootstrap.test.ts`'s `if (expectedNotifications
> 0)` guard was dropped: `apply.test.ts` already called its copy with `0` and
`.times(0)` verifies correctly, so the guard was redundant. `NotificationUi` is
module-local rather than exported (fallow reports an unused type export
otherwise); the three types in the exported signature chain stay exported. The
now-dead `strong-mock` and `pi-api` imports were pruned from the three suites
that no longer need them.

**Plant:**
```
# toolProbes default changed from `emissions * 2` to `emissions * 3`
$ node --test <the four suites>
ℹ pass 11  ℹ fail 110      (restored: pass 121, fail 0)
```
The shared definition is load-bearing for all four suites, which is the point:
the probe contract belongs to `shared/notify.ts` and now breaks in one place.

### WR-09: cross-references this phase's own renames invalidated

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/README.md`
**Commit:** `5accf4eb`
**Applied fix:** Both `apply.ts` line cites became symbol references
(`import/execute.ts::installOnePlannedPlugin`,
`import/execute.ts::addOnePlannedMarketplace`). The README's `MarketplaceBlock` /
`ensureMarketplaceBlock` clause was dropped in favour of the structure that is
still genuinely shared.

**Verification:** `grep -rn "execute\.ts:[0-9]" extensions/` and
`grep -rn "ensureMarketplaceBlock" extensions/ | grep -v reconcile/notify.ts`
both return nothing — no line-number cite into a sibling module and no stale
reference to the deleted factory survive anywhere in the tree.

### WR-10: the import barrel was not the single entry it was made to be

**Files modified:** `extensions/pi-claude-marketplace/edge/types.ts`,
`extensions/pi-claude-marketplace/orchestrators/import/index.ts`
**Commit:** `23719c9d`
**Applied fix:** `edge/types.ts` now imports its two types from
`../orchestrators/import/index.ts`. The barrel already exported both, so no
symbol was added. A short header on the barrel records that it is the single
production door and why the barrel owner test's negatives depend on that.

**Plant:**
```
# ClaudeImportExecutionResult removed from the barrel's type export
$ npx tsc --noEmit
```
- Against the pre-fix `edge/types.ts`: **no diagnostic in `edge/types.ts`** — it
  reached the module by the other path.
- Against the fixed `edge/types.ts`:
  `edge/types.ts(18,3): error TS2305: Module '"../orchestrators/import/index.ts"'
  has no exported member 'ClaudeImportExecutionResult'.`

### WR-11(a): `chmod 0o555` cannot deny root

**Files modified:** `tests/orchestrators/reconcile/apply.test.ts`
**Commit:** `22d88345`
**Applied fix:** `denyWrites` now throws with a message naming the environment
when `process.getuid() === 0`, so a root container gets an immediate diagnosis
instead of six cases failing against the reconcile logic.

**Plant:** widening the guard condition to `typeof process.getuid === "function"`
(i.e. simulating root) fails exactly six cases, each with
`Error: denyWrites cannot deny root; run this suite as a non-root user`.
Restored: 49 pass, 0 fail.

### WR-11(b): the convergence proof never pinned its own input

**Files modified:** `tests/integration/reconcile-plan-convergence.test.ts`
**Commit:** `830603ed`
**Applied fix:** Added a sibling case, "migrates populated state to the declared
marketplace and plugin config", comparing `buildConfigFromState(state)` against
an authored literal returned by a fresh-value seed function. The two convergence
cases keep their end-to-end chain intact, so D-115-06's cross-layer fixed-point
identity is preserved; the new case is the independent anchor at the input end.

**Plant** — a *correlated* change, i.e. one the fixed-point property cannot see:
```
# migrate-config emits `autoupdate: false` on every marketplace entry;
# the planner does not read it
✖ migrates populated state to the declared marketplace and plugin config
ℹ pass 2  ℹ fail 1
```
Both convergence cases stayed green and only the new anchor failed — exactly the
blind spot the review described. A second, non-correlated plant (dropping the
`soft-degraded` plugin from the migration) fails all three, confirming the
convergence cases still catch what they always caught.

## Skipped Issues

### WR-02: three per-entry catch clauses removed from the load-time reconcile

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:282-320`,
`:377-491`, `:541-608`
**Status:** skipped — **requires an operator decision**
**Reason:** both remedies the reviewer offered are out of bounds for this pass.

1. *Restore the three catches.* Every restored `catch` is a block no input can
   reach — that unreachability is precisely why they were removed. Restoring them
   drops `orchestrators/reconcile/apply.ts` below its current 117/117 branches,
   and bound 4 requires it stay at 100 percent. Covering them would require a
   throwing collaborator, which brings us to (2).
2. *Add the three orchestrators to `ApplyReconcileOptions` as injected
   collaborators.* This is the injection seam that D-115-03 forbids by name
   ("Add no production seam to `bootstrap.ts`, `apply.ts`, `backfill.ts`, or
   `pending.ts` for test convenience") and that `CONVENTIONS.md` forbids
   generally. Bound 3 of this fix pass restates it.

There is no third option that both makes the loops provable and stays inside the
bounds, so the decision belongs to the operator: either D-115-03 is relaxed for
`apply.ts`, or the 100-percent-branch rule admits an exception for a fail-loud
isolation arm, or the exposure is accepted as recorded.

**Action taken instead:** `.planning/WINDOWS.md` entry 9 was rewritten. It
previously described the removal accurately but understated it as a per-entry
concern. It now records the real blast radius — an escape from any of the three
uncaught loops aborts the remaining entries in that bucket, skips backfill and
the routing-table rebuild for that scope, skips the sibling scope entirely
(project runs first, so a project-scope throw means user scope never reconciles),
and discards every accumulated outcome because
`notifyReconcileAppliedWithContext` is never reached, leaving the user with a raw
error out of `resources_discover` instead of a cascade. It also records that no
test can plant the throw, the contrast with the two loops that kept their catch
and are covered, the two narrow margins in `installPlugin` and
`handleInstallThrow` that the new header comment does not mention, and why
neither remedy is in bounds.

## Notes for the reviewer

- **Beyond the letter of WR-05.** The reviewer flagged one case; I converted all
  three `stat`-based assertions in that suite, because the two "does not rewrite"
  siblings carry the mirror weakness (a same-millisecond rewrite defeats an mtime
  equality check) and the helper was already there. Disclosed rather than
  buried.
- **CR-01 was fixed in production rather than with a test gate.** The brief
  suggested mirroring `notify.test.ts`'s mapped outcome table. I used the
  reviewer's alternative instead — a value-returning shape — because it fires at
  the edit site rather than in another file, and because the review's own
  argument is that a gate in a different file is the weaker form. The mapped
  table was not added on top; the compile error subsumes it.
- **`setPluginEnabled` was included in WR-01's doc correction** even though the
  review named only the three new overloads. It carries the same overstatement in
  the same words and is the pattern the other three were copied from, so leaving
  it would have left the misleading original in place.
- **`marketplace/remove.ts` branch count dropped 97 → 95** as a direct result of
  WR-07 removing a no-op branch. Still 100 percent.

---

_Fixed: 2026-09-02T06:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
