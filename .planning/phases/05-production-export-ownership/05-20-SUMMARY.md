---
phase: 05-production-export-ownership
plan: "20"
subsystem: testing
tags: [composition, dependency-injection, orchestrators, reconcile, backfill, fallow]

requires:
  - phase: 05-production-export-ownership
    provides: "05-04 the reconcile apply owner and its selected-state reader contract"
  - phase: 05-production-export-ownership
    provides: "05-16 the enable and uninstall compositions reconcile's apply pass drives"
  - phase: 05-production-export-ownership
    provides: "05-17 the reinstall composition the backfill scan drives, and the untouched scan identity it left to this plan"
provides:
  - "The extension entry point composes the reconcile apply operation once per extension load and drives it from resources_discover"
  - "createApplyReconcile is now production-consumed, so it leaves the production finding census"
  - "scanForceInstalledBackfills is module-private, reached through applyBackfillForScopeIsolated"
  - "PENDING_STATUSES is retired for a private literal union, matching the applied status set beside it"
  - "A missing-export proof per retirement, each measured to yield TS2578 when the export returns"
affects: [05-21, 05-28]

actuals:
  tokens: 8805
  tasks: 2
  commits: 3
  plan_head_before: 2110ec4481ab60e433183c4b123ecd173a17b2c7

tech-stack:
  added: []
  patterns:
    - "A load-time operation with a single production consumer is composed in the entry point, beside the runtime and cache owners it already constructs, and the entry owner asserts that construction is stated exactly once"
    - "A boolean a private helper returns to its own wrapper is re-observed as the decision the wrapper makes from it, not restated as a returned value"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
    - tests/index.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/reconcile/backfill.test.ts
    - tests/orchestrators/reconcile/reconcile.messaging.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/integration/hooks-cross-scope-reconcile.test.ts
    - tests/integration/load-reconcile-race-child.ts

key-decisions:
  - "The plan's task order held: task 1 and task 2 touch disjoint modules, and each commit typechecks on its own. No reorder and no merge was needed."
  - "Four test files outside the declared owner set imported the retired concrete binding and had to move to the factory in the same commit, or the tree would not compile. Recorded as a deviation."
  - "The scan's SF-02 boolean is re-observed as the version-gate decision its wrapper makes from it: a clean scan closes the stamp to the running version, a failed scan leaves it at the seeded stale stamp. Every case already pinned that stamp inside a whole-state assertion."
  - "PENDING_STATUSES is retired rather than merely unexported, so the pending status set reads as the bare literal union the applied set beside it already uses."
  - "index.ts|default survives this plan, exactly as expected. It is the manifest-loaded default export, and 05-28 owns its adjacent annotation."

patterns-established:
  - "An entry-point composition is pinned by the same source-text construction census that already pins the runtime, cache, routing, update and hydration constructions."
  - "An owner whose convenience value is retired keeps both a `void ({} satisfies { readonly retired?: typeof Module.value })` proof and a runtime assertion on the module's complete export surface."

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "The extension entry point composes the reconcile apply operation once per load from the production state reader, and resources_discover drives that composition"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/index.test.ts#constructs one runtime, completion cache and reconcile operation per extension load"
        status: pass
      - kind: unit
        ref: "node --test tests/index.test.ts (18/18 pass, including the four NFR-2 refusal cases and the ordinal stage census)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/index.ts (branches 17/17, functions 3/3, lines 189/189)"
        status: pass
    human_judgment: false
  - id: D2
    description: "apply.ts publishes the factory and its reader contract only; the concrete binding is retired with a proof that discriminates its restoration"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#apply.ts exposes the reconcile factory and no composed value"
        status: pass
      - kind: other
        ref: "npm run typecheck exit 0 with the proof in place; restoring the export yields tests/orchestrators/reconcile/apply.test.ts(97,1): error TS2578"
        status: pass
      - kind: unit
        ref: "node --test tests/orchestrators/reconcile/apply.test.ts (51/51 pass)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts (branches 119/119, functions 23/23, lines 963/963)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The partially-installed backfill scan is private, and every promotion, skip, failure and isolation case is observed through applyBackfillForScopeIsolated"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/reconcile/backfill.test.ts (28/28 pass, all 17 migrated cases included)"
        status: pass
      - kind: other
        ref: "npm run typecheck exit 0 with the proof in place; restoring the export yields tests/orchestrators/reconcile/backfill.test.ts(67,1): error TS2578"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts (branches 63/63, functions 13/13, lines 469/469)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The pending status set is a private literal union, and the pending render map's arms and full message bytes are unchanged"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/reconcile/reconcile.messaging.test.ts (13/13 pass)"
        status: pass
      - kind: other
        ref: "npm run typecheck exit 0 with the proof in place; restoring the export yields tests/orchestrators/reconcile/reconcile.messaging.test.ts(19,1): error TS2578"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts (branches 12/12, functions 9/9, lines 227/227)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Reconcile gained no git surface and no nested state lock"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "node --test tests/architecture/no-orchestrator-network.test.ts (4/4 pass, planted-offender and benign controls included)"
        status: pass
      - kind: integration
        ref: "npm run test:integration (32/32 pass, exit 0, including the two-process RECON-06 race against real locks)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Three identities leave the production finding census with zero additions"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/architecture/unowned-exports-census.test.ts#The complete production finding census equals its committed identities (red by design: 3 removals from this plan, 0 additions, parent-owned pin)"
        status: fail
    human_judgment: true
    rationale: "The two census equality gates are red by design until the parent applies its single Wave 9 pin edit; every task in this plan forbids editing tests/architecture/gate-targets.ts. The parent must confirm the reviewed delta on the stable wave snapshot."

duration: 65 min
completed: 2026-09-15
status: complete
---

# Phase 5 Plan 20: Reconcile Composition and Backfill Ownership Summary

**The extension entry point now composes the reconcile apply operation from its factory and the production state reader, once per extension load; the partially-installed backfill scan and the pending status set are module-private behind TS2578-discriminating proofs, and all three identities leave the production finding census with zero additions.**

## Performance

- **Duration:** 65 min
- **Started:** 2026-09-15T01:35:00Z
- **Completed:** 2026-09-15T02:40:00Z
- **Tasks:** 2
- **Files modified:** 12 (0 created, 12 modified)

## Accomplishments

- `extensions/pi-claude-marketplace/index.ts` constructs `createApplyReconcile({ loadState })` once, beside the runtime, cache, routing, update and hydration constructions it already owned, and the `resources_discover` handler drives that composition.
- `apply.ts` publishes `createApplyReconcile` and `ReconcileStateReader` only. The `NODE_RECONCILE_STATE_READER` constant and the `applyReconcile` concrete binding are gone, and `loadState` became a type-only import because the module now names it in type position alone.
- `backfill.ts`'s `scanForceInstalledBackfills` is module-private. All 17 owner cases drive it through `applyBackfillForScopeIsolated`, which is its only caller.
- `reconcile.messaging.ts`'s `PENDING_STATUSES` tuple is retired for a private `PendingStatus` literal union, the same shape `ReconcileAppliedStatus` two sections below already uses.
- Three missing-export proofs added and each measured in both directions: absent, the tree typechecks; restored, the directive goes unused and `tsc` reports TS2578 at the exact proof line.
- `apply.test.ts` gained a runtime assertion on the module's complete export surface, so the retirement is proved at runtime as well as at compile time.

## Task Commits

1. **Task 1: Bind reconcile to the entry's real state reader** — `7c01a833` (refactor)
2. **Task 2: Observe backfill and pending statuses through actual reconcile** — `85505191` (refactor)
3. **Auto-fix: partial vocabulary in the backfill suite** — `258e0515` (fix)

**Plan metadata:** see the final `docs:` commit.

## Task Order: neither reordered nor merged

The plan's stated order is 1 → 2, and it held. The two tasks touch disjoint modules — task 1 owns `apply.ts` + `index.ts`, task 2 owns `backfill.ts` + `reconcile.messaging.ts` — and `apply.ts`'s import of `applyBackfillForScopeIsolated` is untouched by either, so there is no intermediate that fails to compile. `npm run typecheck` exits 0 at each of the three commits.

This differs from 05-18, which had to run 1 → 3 → 2 because its stated order deleted exports a still-unswitched consumer imported. That hazard does not arise here.

## Census Identity Delta (for the parent's Wave 9 reconciliation)

This is this plan's contribution only. It is measured, not narrated: the live production census was read before the first edit, after task 1 and after task 2, each time with `node node_modules/fallow/bin/fallow dead-code --production --no-cache --format json` in the foreground.

**Removed (3):**

| Census | Exact identity string |
| --- | --- |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts\|createApplyReconcile` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts\|scanForceInstalledBackfills` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts\|PENDING_STATUSES` |
| `UNOWNED_EXPORT_CENSUS` | key `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, member `createApplyReconcile` — the key's only member, so the whole key goes |
| `UNOWNED_EXPORT_CENSUS` | key `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts`, member `scanForceInstalledBackfills` — the key's only member, so the whole key goes |
| `UNOWNED_EXPORT_CENSUS` | key `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts`, member `PENDING_STATUSES` — the key's only member, so the whole key goes |

**Added (0):** none.

**Measured totals.** Live production census `total_issues` before the first edit: **10**. After task 1: **9**. After task 2: **7**. The parent's Wave 9 pin edit therefore removes five identities in total — two from 05-18 and three from this plan — and adds none.

The measured gate output on the final tree reads, verbatim:

```
now unowned but not pinned (0): none
pinned but no longer unowned (5): extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts#createFetchPlugins, extensions/pi-claude-marketplace/orchestrators/plugin/info.ts#createGetPluginInfo, extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts#createApplyReconcile, extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts#scanForceInstalledBackfills, extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts#PENDING_STATUSES
```

`tests/architecture/gate-targets.ts` was NOT edited by this plan.

### Evidence of each disposition

**`createApplyReconcile` — real production consumer.** `extensions/pi-claude-marketplace/index.ts` imports it and calls it at extension-factory time. It is no longer unowned because production, not a test, composes it. The value it produces is a module-local `const` inside the factory body, not an export, so it can add nothing to the census. The retired `applyReconcile` export was never in the census (it had a production caller through `index.ts`), so its retirement removes nothing from the census and, as a non-export, adds nothing either. `ReconcileStateReader` was already exported and already production-consumed; nothing about it moved.

**`scanForceInstalledBackfills` — privatized, same-file caller retained.** Its only caller was and is `applyBackfillForScope` in the same module, which `applyBackfillForScopeIsolated` wraps. Dropping the `export` keyword removes the identity without changing a single call. No transitive finding appeared: the function's parameter and return types (`ApplyReconcileOptions`, `Scope`, `ExtensionState`, `PerEntryOutcome`, `boolean`) are all owned elsewhere and all still consumed by the two exported wrappers' own signatures.

**`PENDING_STATUSES` — retired, not merely unexported.** Its only reader was the `PendingStatus` type alias it fed. Replacing the tuple with the bare literal union removes the declaration entirely, so there is nothing left to be unowned. This is the same shape `ReconcileAppliedStatus` already has in the same file, and it is the disposition 05-23 applied to the four notification vocabulary tuples. `PendingStatus` was already private and stays private; `PENDING_CONTEXT`, `PENDING_MSG` and every render arm are untouched.

**No transitive finding.** 05-19 hit a case where privatizing a function orphaned its type. Checked here explicitly: the live census after each task contains no identity that was absent before, and the totals fall by exactly one then exactly two.

### `index.ts|default`: NOT retired by this plan — it belongs to 05-28

**Measured answer: the identity is still live after this plan.** It appears in all three census readings (before, after task 1, after task 2), unchanged:

```
unused_exports|extensions/pi-claude-marketplace/index.ts|default
```

That is the expected outcome, and it is not a failure.

The reasoning behind the measurement. `index.ts`'s default export is the async extension factory Pi's own loader awaits. Its consumer is the `pi.extensions` manifest entry in `package.json`, which no static import graph can see, so no amount of composition *inside* the factory body can give it an in-repo caller. This plan added a caller to the factory body, not to the factory.

05-28 owns it on both of the axes that could move it. Its task 2 puts "the single adjacent unused-export annotation above the manifest-loaded default entry function with its concrete loader reason", and its task 2 is also the one that flips `.fallowrc.json` to `production: { deadCode: true, ... }` with `includeEntryExports: true` — the setting that governs whether an entry export is reported at all. 05-VALIDATION's per-identity table assigns the row `unused_exports: default | index.ts` to 05-28, and D-06 names it as one of exactly two permitted local annotations. This plan touched neither `.fallowrc.json` nor the annotation.

**No identity outside my owner set changed.** The four 05-21 identities (`platform/git-credential.ts|createCredentialOps`, and `platform/git.ts`'s `listBranches`, `listRemotes`, `buildAuthCallbacks`) and the two other 05-28 identities (`scripts/check-phase-06-hub-ledger.mjs` as an unused file, `RingBuffer.read` as an unused class member) read byte-identically before and after. Seven identities survive; six of them plus `index.ts|default` are exactly the pre-existing seven that were not mine.

## Network-Free Proof

`apply.ts` and `backfill.ts` are not themselves in `NETWORK_FREE_TARGETS`, but three of their siblings are — `orchestrators/reconcile/pending.ts`, `plan.ts` and `notify.ts` — and reconcile as a family must not gain git surface, so the obligation was proved rather than assumed.

1. **Nothing added names git surface.** `apply.ts` lost one import (`loadState` moved to type position) and gained none. `index.ts` gained `createApplyReconcile` from a sibling orchestrator; its pre-existing `DEFAULT_GIT_OPS` import is unchanged and is the legitimate entry-point wiring the network gate has never covered. `backfill.ts` and `reconcile.messaging.ts` gained no import at all — each lost exactly one `export` keyword or one declaration.
2. **The gate was run and fires.** `node --test tests/architecture/no-orchestrator-network.test.ts` passes 4/4, which includes the planted-offender control (a `gitOps = DEFAULT_GIT_OPS` mutation of a real target copy rejects), the unmutated-copies control and the comment-stripping control. The `visited` deep-compare means every declared target was actually opened.
3. **No test reached a remote.** Every migrated backfill case and every apply case runs under `createOfflineGitOps`, whose `allowedRemoteUrls` is empty, and each asserts `clonedUrls()` is `[]`. A clone attempt fails the case where it happens.

## Lock Re-entrancy Proof

`proper-lockfile` is `retries: 0` and not re-entrant, so the absence of nesting was proved rather than assumed.

**No guard was added, and the guard count is unchanged.** `withLockedStateTransaction` appears in `apply.ts` exactly three times, all pre-existing: one import, the read-pass acquisition in `readPassForScope`, and the routing-table rebuild in `rebuildScopeRoutingTable`. Composing the operation in the entry point moves no call site — `createApplyReconcile` only closes over the reader and delegates to `applyReconcileWithReader`, whose body is untouched.

The backfill migration is the case that could have introduced nesting, and does not. `applyBackfillForScopeIsolated` runs inside the per-scope apply region with **no** outer lock (CR-01, recorded in `backfill.ts`'s own header); the stamp write it now reaches takes its own `withStateGuard` lock afterwards, sequentially. That is the production call path: the 17 migrated cases now exercise exactly the acquisition production performs, where before they stopped short of it. All 28 backfill cases pass against real locks, as do the 51 apply cases and the 32-case integration suite — which includes the two-process `RECON-06` race that would surface an `ELOCKED` as a `StateLockHeldError`.

## Assertion Ledger

Every changed assertion is accounted for below.

### `tests/index.test.ts` (added: 1 assertion; changed: 1 title; removed: 0)

| Original | Replacement | Coverage |
| --- | --- | --- |
| — (new) | `assert.deepStrictEqual(reconcileConstructions, ["createApplyReconcile({ loadState })"])` in the construction census, so the entry's reconcile binding is stated exactly once, like the five constructions already pinned there | `tests/index.test.ts` 18/18; `index.ts` direct pair branches 17/17, functions 3/3, lines 189/189 |

The test's title changed from "constructs one runtime and completion cache for edge registration, hook hydration, and plugin update" to "constructs one runtime, completion cache and reconcile operation per extension load". A title is not an assertion; the five existing `deepStrictEqual` calls in the case are byte-identical.

**Nothing else in this file moved.** The plan asks the entry owner to prove hydration precedes reconcile and that resource aggregation still follows failures. Both were already proved and both still pass unchanged: `CWD_READ_DEFERRED_HYDRATE = 1` and `CWD_READ_RECONCILE = 2` pin the stage order through the working-directory read ordinals, `CWD_READS_PER_DISCOVER = 4` pins that the stage list itself has not moved, and the four NFR-2 refusal cases each assert that `discover` still answers after their own stage fails. The double try/catch around the reconcile call and its last-ditch `makeRawNotifyFn` is untouched — "still answers when the last-ditch reconcile notification is also refused (NFR-2)" is the case that would redden if the inner wrap were simplified, and it passes.

### `tests/orchestrators/reconcile/apply.test.ts` (added: 1 case, 1 compile proof; changed: 1 import site; removed: 0)

The 50 pre-existing cases are untouched — same call sites, same arguments, same assertions. `applyReconcileWithRouting` is now a module-scope `const` built from this module's own factory bound to `{ loadState }`, the same reader `index.ts` binds, so the local `applyReconcile` wrapper and every one of its ~90 call sites reads exactly as before.

| Original | Replacement | Coverage |
| --- | --- | --- |
| `import { applyReconcile as applyReconcileWithRouting }` | `const applyReconcileWithRouting = createApplyReconcile({ loadState })` — the same binding, stated at one site | 51/51 pass |
| — (new) | `void ({} satisfies { readonly retired?: typeof ApplyOrchestrator.applyReconcile })` under `@ts-expect-error`; measured: restoring the export yields `tests/orchestrators/reconcile/apply.test.ts(97,1): error TS2578` | `npm run typecheck` in both directions |
| — (new) | `assert.deepStrictEqual(Object.keys(applyModule), ["createApplyReconcile"])` — the module's complete runtime export surface | 51/51 pass |

The two `createApplyReconcile` call sites the file already had — `applyAfterSelectedStateRace` and the two-scope competing-reader case — are unchanged, including the `readerRoots` ordering assertion. The `behavioral-composition-exception: applyReconcile` marker census is unchanged and still passes: the function `createApplyReconcile` returns is still named `applyReconcile`, and neither marker comment was touched.

### `tests/orchestrators/reconcile/backfill.test.ts` (changed: 17 cases; added: 1 compile proof, 1 assertion; removed: 17 assertions, all mapped)

All 17 cases moved from the private scan to `applyBackfillForScopeIsolated`, its only caller. The state argument became `readResultFor(<same state>, true)`; every case already seeds a `STALE_STAMP` snapshot and a real `state.json`, so both the version gate and the WR-01 stamp-worth gate open and the scan runs exactly as before.

Each case's `assert.strictEqual(anyFailure, …)` is replaced by the decision the wrapper makes from that boolean. `applyBackfillForScope` stamps `EXTENSION_VERSION` **iff** the scan reported no failure, so the mapping is exact in both directions:

| Original | Replacement | Cases |
| --- | --- | --- |
| `assert.strictEqual(anyFailure, false)` | the whole-state assertion's `lastReconciledExtensionVersion` reads `EXTENSION_VERSION` — the gate closed | 13 |
| `assert.strictEqual(anyFailure, true)` | the whole-state assertion's `lastReconciledExtensionVersion` still reads `STALE_STAMP` — the gate stayed open for the next load | 4 |

Twelve of the thirteen closed-gate cases already carried a whole-state `deepStrictEqual(await loadState(...), …)` that pinned the stamp, so the replacement is a value change inside an assertion that already existed. The thirteenth — `RECON-04: appends the promotion after the rows the caller already accumulated` — asserted only outcomes, the scope tree and the clone list, so it gained one assertion:

```ts
assert.strictEqual(
  (await loadState(locations.extensionRoot)).lastReconciledExtensionVersion,
  EXTENSION_VERSION,
);
```

**No other assertion moved.** Every case keeps its outcome-array whole-value comparison (the promotion rows, the `plugin-install-failed` rows with their exact `reason`, the empty arrays for the skips), its `retryTree` scope inventory, its `clonedUrls()` emptiness and its `verifyBoundary()` strict-mock verification. The four SF-01/SF-02 failure cases keep their reason bytes verbatim (`"source missing"`, `"unreadable"`, `"unparseable"`), and the per-plugin isolation case keeps both its rows in order and its two-marketplace state literal.

The migration is a strict strengthening in one respect: these cases now run the stamp write, which is the production continuation they previously stopped short of. It costs nothing in isolation — `runScopeIsolated`'s coercion arm is still covered by the two `runScopeIsolated` cases, and the direct pair still reads 13/13 functions.

| Original | Replacement | Coverage |
| --- | --- | --- |
| — (new) | `void ({} satisfies { readonly retired?: typeof BackfillOrchestrator.scanForceInstalledBackfills })` under `@ts-expect-error`; measured: restoring the export yields `tests/orchestrators/reconcile/backfill.test.ts(67,1): error TS2578` | `npm run typecheck` in both directions |

The describe title moved from `scanForceInstalledBackfills` to `applyBackfillForScopeIsolated: the partially-installed scan`, naming the operation the cases now drive.

### `tests/orchestrators/reconcile/reconcile.messaging.test.ts` (added: 1 compile proof; removed: 1 assertion, mapped)

| Original | Replacement | Coverage |
| --- | --- | --- |
| `assert.deepEqual(pendingStatuses, expectedPendingStatuses)` over `[...PENDING_STATUSES]` | `assert.deepEqual(pendingRenderArms, expectedPendingStatuses)` over `Object.keys(PENDING_CONTEXT.render)` — already in the same case, against the same expected literal | 13/13 pass |
| — (new) | `void ({} satisfies { readonly retired?: typeof ReconcileMessaging.PENDING_STATUSES })` under `@ts-expect-error`; measured: restoring the export yields `tests/orchestrators/reconcile/reconcile.messaging.test.ts(19,1): error TS2578` | `npm run typecheck` in both directions |

**Why the surviving assertion subsumes the removed one.** `PENDING_CONTEXT` is pinned `as const satisfies CommandContext<PendingStatus, PendingMsg>`, whose `render` member is the mapped type `{ [K in Status]: RenderFn<…> }`. A status with no arm is a TS2741 error at the `satisfies` site, and an arm naming a status outside the union is an excess-property error on the object literal — so the render map's key set **is** the status union, enforced by the compiler rather than by the deleted runtime copy. The removed assertion also pinned the tuple's element *order*; that order had no other reader, and the key order the surviving assertion pins is the order the arms are authored in. This is the same shape `ReconcileAppliedStatus` has had all along, whose only runtime proof is the identical `appliedRenderArms` assertion in the same case.

The eleven type-level proofs at the top of the file — five `satisfies PendingMsg` positives, five `satisfies ReconcileAppliedMsg` positives and three `@ts-expect-error` negatives — are untouched and still pin the status vocabulary at the public message types.

### The four outside consumers (changed: 1 import site each; removed: 0)

| File | Change |
| --- | --- |
| `tests/orchestrators/plugin/enable-disable.test.ts` | module-scope `const applyReconcile = createApplyReconcile({ loadState })`; four call sites unchanged; 66/66 pass |
| `tests/orchestrators/plugin/install-flow.test.ts` | both dynamic-import sites destructure `createApplyReconcile` and compose it; two call sites unchanged; 133/133 pass |
| `tests/integration/hooks-cross-scope-reconcile.test.ts` | module-scope composition; one call site unchanged |
| `tests/integration/load-reconcile-race-child.ts` | module-scope composition, plus a `loadState` import the file did not previously need; one call site unchanged |

No assertion in any of the four changed. Each now builds the same composition the entry point builds.

## Verification Commands and Results

All runs were in the foreground. None was piped into a filter that could mask its exit status, and none was backgrounded.

| Command | Result |
| --- | --- |
| `node --test tests/index.test.ts tests/orchestrators/reconcile/apply.test.ts` (task 1 verify) | 69 tests, 69 pass, 0 fail |
| `node --test tests/index.test.ts` | 18 tests, 18 pass, 0 fail |
| `node --test tests/orchestrators/reconcile/apply.test.ts` | 51 tests, 51 pass, 0 fail |
| `node --test tests/orchestrators/reconcile/backfill.test.ts tests/orchestrators/reconcile/reconcile.messaging.test.ts` (task 2 verify) | 41 tests, 41 pass, 0 fail |
| `node --test tests/orchestrators/plugin/enable-disable.test.ts` | 66 tests, 66 pass, 0 fail |
| `node --test tests/orchestrators/plugin/install-flow.test.ts` | 133 tests, 133 pass, 0 fail |
| `node --test tests/architecture/no-orchestrator-network.test.ts` | 4 tests, 4 pass, 0 fail |
| `node --test tests/architecture/no-test-only-production-surface.test.ts` | part of a 14/14 pass run with the network gate |
| `node --test tests/architecture/partial-vocabulary-guard.test.ts` | 58 tests, 58 pass, 0 fail |
| `npm run typecheck` | exit 0 (and exit 1 with the expected TS2578 at each of the three proofs when its export is restored) |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run fallow` | exit 0 (dead-code: no issues; health: 0 above threshold, maintainability 91.8; dupes 1,093 lines across 44 files — unchanged) |
| `npm run test:corresponding` / `:negative` | exit 0 / exit 0 |
| `npm run test:coverage:direct:negative` | exit 0 |
| `npm run test:coverage:direct -- .../reconcile/apply.ts` | passed: branches 119/119, functions 23/23, lines 963/963 |
| `npm run test:coverage:direct -- .../index.ts` | passed: branches 17/17, functions 3/3, lines 189/189 |
| `npm run test:coverage:direct -- .../reconcile/backfill.ts` | passed: branches 63/63, functions 13/13, lines 469/469 |
| `npm run test:coverage:direct -- .../reconcile/reconcile.messaging.ts` | passed: branches 12/12, functions 9/9, lines 227/227 |
| `SKIP=trufflehog pre-commit run --files …` (three times, once per commit) | all hooks passed before each commit |
| `npm test` (full unit) | **6267 tests, 6265 pass, 2 fail** |
| `npm run test:integration` | **32 tests, 32 pass, 0 fail**, exit 0 |

**Unit count against the baseline.** The wave baseline after 05-18 is 6266 with 2 failures. This plan adds exactly one case — `apply.ts exposes the reconcile factory and no composed value` — giving 6267. Backfill's 17 migrated cases and messaging's 13 cases are the same cases, so neither count moved. The two failures are the two `tests/architecture/unowned-exports-census.test.ts` pin-equality gates, red by design until the parent's single pin edit; no other test failed, and no test was removed or skipped.

**No aggregate coverage was measured.** 05-VALIDATION assigns that to the parent on the stable wave snapshot.

## Decisions Made

See `key-decisions` in the frontmatter. The two that need stating in prose:

**Where the reconcile composition lives.** 05-CONTEXT's agent-discretion note says "Existing entry, bridge barrels, and auth-host compose reconcile, bridge, and credential capabilities" — so the entry point, not `operations.ts`. That is also where the reader it needs already exists: `index.ts` imports `loadState` to build `createHooksHydration`, so the binding costs no new import. It is composed as an exported-free local `const` rather than a factory because, once the reader is bound, `createApplyReconcile` takes nothing else.

**Why `PENDING_STATUSES` was retired rather than unexported.** Dropping the `export` keyword would have satisfied the census with a private tuple whose only reader is a `(typeof …)[number]` indexed access. The file already contains the answer to what that should look like: `ReconcileAppliedStatus`, twenty lines below, is a bare literal union with no tuple at all, and 05-23 applied exactly this disposition to the four notification vocabulary tuples. Retiring the tuple makes the two status sets in one file read the same way, and the render map's `satisfies` pin — not the tuple — is what enforces totality either way.

## Deviations from Plan

### 1. [Rule 3 - Blocking] Four test files outside the declared owner set were migrated with task 1

- **Found during:** Task 1
- **Issue:** `files_modified` names `apply.test.ts` and `index.test.ts` as the consumers of `apply.ts`, but four further test files import the concrete `applyReconcile` binding the task retires: `tests/orchestrators/plugin/enable-disable.test.ts`, `tests/orchestrators/plugin/install-flow.test.ts`, `tests/integration/hooks-cross-scope-reconcile.test.ts` and `tests/integration/load-reconcile-race-child.ts`. Leaving any of them alone makes the tree fail to compile with TS2305, so task 1 could not be an atomic commit without them.
- **Fix:** each builds the same composition the entry point builds — `createApplyReconcile({ loadState })` at module scope, or destructured from the dynamic import in `install-flow.test.ts`'s two sites. No call site's arguments and no assertion changed.
- **Files modified:** the four named above. All four are tests; no production owner outside the declared set was touched.
- **Verification:** `npm run typecheck` exit 0; `enable-disable.test.ts` 66/66, `install-flow.test.ts` 133/133, `npm run test:integration` 32/32.
- **Committed in:** `7c01a833` (Task 1 commit).

### 2. [Rule 1 - Vocabulary guard] The new backfill prose used retired force-family wording

- **Found during:** the full unit run after Task 2
- **Issue:** the comments and describe title added in task 2 said "force-installed scan", echoing the symbol name `scanForceInstalledBackfills`. `tests/architecture/partial-vocabulary-guard.test.ts` gates the prose form `/force[- ]install/` repository-wide under D-75-01, and it correctly reddened. The symbol's own camel-case spelling does not match the pattern and is untouched.
- **Fix:** the four occurrences say "partially-installed", which is the term `backfill.ts` already uses for the records the scan walks (`compatibility.installable === false`).
- **Files modified:** `tests/orchestrators/reconcile/backfill.test.ts`
- **Verification:** `node --test tests/architecture/partial-vocabulary-guard.test.ts` 58/58 pass; full unit run back to exactly the two tolerated census failures.
- **Committed in:** `258e0515`.

### 3. [Rule 1 - Consistency] `loadState` became a type-only import in `apply.ts`

- **Found during:** Task 1
- **Issue:** with the concrete binding retired, `apply.ts` names `loadState` only inside `typeof loadState` on the `ReconcileStateReader` member. A value import used solely in type position misstates the module's runtime dependencies.
- **Fix:** moved to `import type { loadState }` in the file's type-import block, matching the shape 05-18 established at `fetch.ts:58` for `makePresenceProbe` / `probeManifestEntry`.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`
- **Verification:** `npm run typecheck` and `npm run lint` exit 0, including `import-x/order`.
- **Committed in:** `7c01a833`.

---

**Total deviations:** 3 (1 Rule 3 blocking, 2 Rule 1 auto-fixes)
**Impact on plan:** no scope creep. The only files touched beyond `files_modified` are the four test consumers in deviation 1, each of which had to move for the commit to compile. Both Rule 1 fixes were required for the plan's own gates to pass honestly.

## Issues Encountered

**`import-x/order` rejected the namespace type import before `git commit` ran.** The first `pre-commit run --files` for task 2 failed on `npm lint`: the new `import type * as BackfillOrchestrator` sat above its alphabetical position. It was moved, lint re-run to exit 0, and the hooks re-run clean before committing. No commit was created and none was amended — this is the intended behavior of running `pre-commit run --files` before `git commit`.

**A guard found what the focused runs could not.** The vocabulary guard in deviation 2 lives in `tests/architecture/`, which neither task's `<verify>` command covers, so it only surfaced in the full unit run. That is the argument for running the full suite in the foreground at the end of a plan rather than trusting the two focused commands.

## Known Stubs

None. No stub, placeholder, skipped test or unrun `<verify>` was introduced. Both task `<verify>` commands were run, in the foreground, and both passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Parent action required:** apply the single Wave 9 pin edit to `tests/architecture/gate-targets.ts`. The wave's combined contribution is five identity removals and zero additions — two from 05-18 and the three listed verbatim above — taking the live production census from 12 to 7.
- **Wave 9 is complete.** 05-18 and 05-20 are the wave's only plans and both have landed. The tree is frozen for the reconciliation as far as this plan is concerned.
- **Wave 10 (05-21) is unaffected.** Its four `platform/` identities read byte-identically before and after this plan, and none of its files was touched.
- **Wave 11 (05-28) still owns three identities:** `index.ts|default`, `RingBuffer.read` and `scripts/check-phase-06-hub-ledger.mjs`. `index.ts|default` remains live after this plan, which is the expected outcome — see the measured section above. 05-28 also edits `index.ts` and `tests/index.test.ts`; this plan's changes there are one construction line plus its comment and one assertion, none of which collides with the adjacent annotation 05-28 places above the default export.

---
*Phase: 05-production-export-ownership*
*Completed: 2026-09-15*

## Self-Check: PASSED

- All twelve `key-files.modified` entries and this summary exist on disk.
- All three task commits resolve: `7c01a833`, `85505191`, `258e0515`.
- `commits: 3` is measured, not narrated: `git rev-list --count 2110ec4481ab60e433183c4b123ecd173a17b2c7..HEAD` returned 3 before this summary's own commit.
- `tests/architecture/gate-targets.ts` is NOT among this plan's changed files.
