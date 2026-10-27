---
phase: 02-apply-ordering-and-installed-declarations
plan: 02
subsystem: plugin
tags: [enable, update, dependencies, installed-copy, git-source, ENDEPS-01, UPDDEP-01]

requires: []
provides:
  - "readInstalledRecordDeclarations(options, marketplace, name) in plugin/dependency-index.ts"
  - "buildInstalledScopeDeclarationDetail(options) in plugin/dependency-index.ts, sharing one private walk with buildScopeDeclarationDetail"
  - "enableCascadeLookup reads installed copies first"
  - "REAL_UPDATE_CONSTRAINT_SEAM.buildScopeDeclarationDetail is buildInstalledScopeDeclarationDetail"
affects: [02-03, 02-04, enable, update, autoupdate, reinstall]

actuals:
  tokens: 10146
  tasks: 2
  commits: 2
plan_head_before: 75a7a635498e9a4c201c7132ac2ae96530936790
plan_head_after: fd4cf96fc60bb23981f581597d90fd350c730d8f

tech-stack:
  added: []
  patterns:
    - "Two declaration readers over one manifest load and one catalog branch: catalog-first (load verdict, plan, guards) and installed-copy-first (enable closure, update preflight)"
    - "One private scope walk parameterized by the per-record reader"

key-files:
  created:
    - .planning/phases/02-apply-ordering-and-installed-declarations/deferred-items.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
    - test/orchestrators/plugin/dependency-index.test.ts
    - test/orchestrators/plugin/enable-disable.test.ts
    - test/orchestrators/plugin/update-constraint-gate.test.ts
    - features/plugin/enable.feature
    - features/plugin/update-dependencies.feature

key-decisions:
  - "D-PL2-05: every declaration walk keeps the whole-scope fail-closed unit; comments at the index walk's and the shared detail walk's early return, one unit pin per walk"
  - "D-PL2-06: the enable closure and the update preflight's holder walk read a record with resolvedSha from its per-commit clone under plugin-clones/; an absent copy falls back to the catalog read, an unusable one fails closed"
  - "D-PL2-07: a record without resolvedSha (a path source) keeps the catalog read; DECLREC-01 deferred"

patterns-established:
  - "A test that needs a pinned record's enable to materialize without a git checkout wraps the real ledger and drops sourcePinOverride; the closure is decided before any ledger runs"

requirements-completed: [RCN-05, RCN-04]

coverage:
  - id: D1
    description: "Enabling a disabled git-source plugin enables the dependency its installed copy declares, though its catalog entry declares none"
    requirement: RCN-05
    verification:
      - kind: e2e
        ref: "features/plugin/enable.feature#Enabling a git-source plugin enables the dependency its installed copy declares, not the one its marketplace now lists"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.test.ts#D-PL2-06: enabling a root pinned to a commit turns on the dependency its installed copy declares, though its catalog entry declares none"
        status: pass
    human_judgment: false
  - id: D2
    description: "readInstalledRecordDeclarations: copy found, copy unusable, copy without a manifest, copy gone, no resolvedSha, delisted, manifest load failure, idempotent"
    requirement: RCN-05
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/dependency-index.test.ts#D-PL2-06 / D-PL2-07 / RCN-05 cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "update of a dependency is held (skipped) {dependents constrain} by the range an installed git-source holder's copy declares"
    requirement: RCN-05
    verification:
      - kind: e2e
        ref: "features/plugin/update-dependencies.feature#Updating a dependency is held by the range a git-source plugin's installed copy declares"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-constraint-gate.test.ts#D-PL2-06: a holder's installed copy constrains the target though its catalog entry declares nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-PL2-05 recorded at every walk's first-unreadable-record return and pinned per walk"
    requirement: RCN-04
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/dependency-index.test.ts#D-PL2-05 / D-05-07 (index walk, detail walk, installed detail walk)"
        status: pass
    human_judgment: false
  - id: D5
    description: "RCN-05 concurrency: installed copies are read inside the operation that holds the scope's state lock"
    requirement: RCN-05
    human_judgment: true
    rationale: "Backstop truth by construction: both readers run inside setPluginEnabled's and preparePluginUpdate's locked transactions, which this plan does not change; no test races an uninstall against them"

duration: 29min
completed: 2026-10-27
status: complete
---

# Phase 2 Plan 02: Installed-copy declarations Summary

**`enable` and `update` now read a git-source plugin's dependencies from the `plugin.json` of the commit it installed (its per-commit clone), as Claude Code reads the installed manifest, with the catalog read as the fallback for a copy that is gone or has no manifest.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-10-27T03:44:00Z
- **Completed:** 2026-10-27T04:12:37Z
- **Tasks:** 2
- **Files modified:** 8 (plus `deferred-items.md` created)

## Accomplishments

- `readInstalledRecordDeclarations`: a record with `resolvedSha` reads `resolvedSource` through `readInstalledCopyDeclaration`, admitted only inside `plugin-clones/` (NFR-10). `found` answers the copy's declarations (with `delisted: true` when the manifest no longer lists the record). `unusable` fails closed. `absent` falls back to the catalog read. A record without `resolvedSha` reads the catalog unchanged.
- `readRecordDeclarations` and the new reader share `loadDeclarerManifest`, `readCatalogDeclarations`, `unusableDeclaration` and `addressedDeclarations`, so the manifest loads once and the catalog branch has one copy. `npm run fallow` is green, with no clone group.
- `enableCascadeLookup` reads through the new reader. The DLS-01 root exemption (`isDelistedRead`) and the `EnableRefusedError("unreadable", ...)` throw are unchanged.
- `buildScopeDeclarationDetail` and the new `buildInstalledScopeDeclarationDetail` share one private walk, `walkScopeDeclarationDetail`. `REAL_UPDATE_CONSTRAINT_SEAM` uses the installed walk and forwards it into `evaluateCatalogConstraint`. `constraint-fold.ts` is not edited.
- D-PL2-05 comments sit at the first-unreadable-record return of `buildScopeDeclarationIndex` and of the shared walk. The two existing early-return cases are retitled to cite D-PL2-05, and a third pins the installed walk.
- Two D-PL2-08 scenarios. `npm run test:cucumber`: 903 scenarios passed (901 before, plus 2).

## Task Commits

1. **Task 1: Enabling a git-source plugin follows the dependencies its installed copy declares** - `60773ccf` (fix)
2. **Task 2: The update preflight reads holders' installed copies, and every walk's fail-closed unit is pinned** - `fd4cf96f` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts`: the two new exports, the shared private helpers and walk, the D-PL2-05/06/07 comments.
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`: the `enableCascadeLookup` reader swap. The `resolveEnableCascade` doc comment now names the new reader.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts`: the real seam uses the installed walk, plus the D-PL2-06 comment.
- The three owner test files and the two feature files.

## Pre-change failures (RED)

Task 1 scenario on HEAD `75a7a635` (the `lib` row is missing; `lib` stays disabled):

```text
1) Enabling a git-source plugin enables the dependency its installed copy declares, not the one its marketplace now lists # features/plugin/enable.feature:202
     Then the result lists these plugins:
       AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
       -   [ 'tools', 'project', 'lib@tools', 'lib@tools', 'installed', 'dependency enabled', 'project', '1.2.0' ]
1 scenario (1 failed)
20 steps (18 passed, 1 skipped, 1 failed)
```

Task 1 unit case (enable-disable.test.ts) before the reader swap:

```text
✖ D-PL2-06: enabling a root pinned to a commit turns on the dependency its installed copy declares, though its catalog entry declares none
    actual: [ '● official [user]\n  ● helper v1.0.0 (installed)\n\n/reload to pick up changes' ]
  expected: [ '● official [user]\n  ● formatter@tools v2.1.0 (installed) {dependency enabled}\n  ● helper v1.0.0 (installed)\n\n/reload to pick up changes' ]
```

Task 2 scenario on `60773ccf` (`lib` moved to 2.0.0 instead of being held):

```text
1) Updating a dependency is held by the range a git-source plugin's installed copy declares
     Then the result has these fields:
       'severity',     + 'info'   - 'warning'
       'needs reload', + 'true'   - 'false'
       -   [ 'summary', 'A plugin operation needs attention.' ]
1 scenario (1 failed)
16 steps (13 passed, 2 skipped, 1 failed)
```

Task 2 unit case (update-constraint-gate.test.ts) before the seam swap: `{ kind: 'admits', range: '>=2.0.0 <3.0.0-0', holders: [ { key: 'kit@mp', range: '^2.0.0', disabled: false } ], ... }` (the `app@mp` copy's `^1.0.0` was not read); after: `held` with `the declared ranges admit no version in common (^1.0.0, ^2.0.0) -- required by "app@mp", "kit@mp"`.

The new dependency-index.test.ts cases failed to load (missing export) before each implementation step.

## Decisions Made

See `## Decision rows` and `## Uncertain choices (for user review)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Both scenarios install the dependency explicitly before the git-source plugin**
- **Found during:** Task 1 (first scenario run)
- **Issue:** the plan's fixture expects `install app@tools` to install `lib` as a dependency. It does not: the install cascade reads a git root from the warm clone cache only, the root is not cloned yet when the walk runs, and the entry declares nothing. So `disable lib@tools` answered `(skipped) {not installed}`.
- **Fix:** each scenario runs `install lib@tools` before `install app@tools`. Both scenarios still fail on the pre-change code for the intended reason, and `lib@tools` still gets the `dependency enabled` row (enable) and the `dependents constrain` hold (update). The gap is logged in `deferred-items.md` as backlog candidate GITROOTDEPS-01.
- **Files modified:** features/plugin/enable.feature, features/plugin/update-dependencies.feature
- **Commits:** `60773ccf`, `fd4cf96f`

**2. [Rule 3 - Blocking] The enable unit case wraps the real ledger to drop the recorded commit**
- **Found during:** Task 1
- **Issue:** the enable ledger re-materializes a record with `resolvedSha` at that commit (`sourcePinOverride`). The unit fixture's catalog tree is not a git checkout, so the root failed `{source missing}` (`lstat .../official-src/.git`) before the closure could be observed.
- **Fix:** the case injects `REAL_ENABLE_DISABLE_TRANSACTION` with a `runInstallLedger` that drops `sourcePinOverride` and calls the real ledger. The closure is decided before any ledger runs, so the case still proves the reader swap (RED above). The scenario covers a real git-source enable end to end.
- **Files modified:** test/orchestrators/plugin/enable-disable.test.ts
- **Commit:** `60773ccf`

**3. [Plan wording] The gate unit case proves a hold through two disagreeing holders**
- **Found during:** Task 2
- **Issue:** `evaluateUpdateConstraint` never sees the target's catalog version. A single `^1.0.0` holder yields `admits` and a stage-one probe, and the out-of-range hold happens at stage two inside `preparePluginUpdate` (the scenario proves that).
- **Fix:** the unit case adds a path holder `kit` whose catalog entry declares `target@^2.0.0`. With the installed copy read, `app@mp`'s `^1.0.0` joins the fold and the gate answers `held` before any tag probe. Before the change, the gate answered `admits ^2.0.0`.
- **Commit:** `fd4cf96f`

**4. [Minor] `UpdateConstraintSeam.buildScopeDeclarationDetail` is typed `typeof buildInstalledScopeDeclarationDetail`**
- The two signatures are identical. The gate no longer imports `buildScopeDeclarationDetail` as a value, so the type names the function it now composes.

**Total deviations:** 2 blocking fixtures, 1 plan-wording adjustment, 1 minor type naming. **Impact:** none on the delivered behavior. They also expose one out-of-scope parity gap (GITROOTDEPS-01).

## Issues Encountered

- The out-of-scope gap above (GITROOTDEPS-01). It is not fixed here.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-02-03 is applied: the copy is read only through `readInstalledCopyDeclaration` with `ownerRoots: [pluginClonesDir]`, and an unusable copy fails the walk closed. T-02-04 is applied: failures reuse `unreadableDeclarer` with fixed phrases.

## CHANGELOG line

- `enable` and `update` now read an installed git plugin's dependencies from the copy that is installed, as Claude Code does. A marketplace that later lists different dependencies no longer changes what `enable` turns on or which ranges hold an update.

## Decision rows

| ID | Decision | Rationale |
|----|----------|-----------|
| D-PL2-05 | `buildScopeDeclarationIndex`, `buildScopeDeclarationDetail` and `buildInstalledScopeDeclarationDetail` (and `judgeFinalScope`, 02-01) end on the first unreadable record: the whole scope fails closed | Licensed by D-05-07 (Locked) and the project rule to fail closed on corrupt data. Claude Code itself aborts prune and the post-uninstall orphan scan for the whole scope (E6), and these walks feed those removal guards |
| D-PL2-06 | The enable closure (`enableCascadeLookup`) and the update preflight's holder walk (`REAL_UPDATE_CONSTRAINT_SEAM`) read a record with `resolvedSha` from its per-commit clone under `plugin-clones/`. A copy that is gone or has no manifest falls back to the catalog read; an unusable copy fails closed. The load verdict, the convergence and pending plan, the uninstall guard, prune and `marketplace remove` keep the catalog-first reader | Upstream parity (E2): Claude Code reads the installed `plugin.json` for enable and for update's dependents scan. RCN-05 names only these two callers, and moving the load verdict would change locked APPLY1-D1 behavior |
| D-PL2-07 | A record without `resolvedSha` (a path source) keeps the catalog read | Capability gap: a path source's installed copy is the marketplace tree, and this extension keeps no copy of its old `plugin.json`. DECLREC-01 (record declarations in `state.json`) is deferred |

## Backlog dispositions

- **ENDEPS-01:** fixed (`60773ccf`). The enable closure follows the installed copy, and the enable.feature scenario proves it.
- **UPDDEP-01 b3:** fixed (`fd4cf96f`). The update preflight's holder walk reads installed copies, and the update-dependencies.feature scenario proves it.
- **STALE-DECLARER-01:** closed by decision D-PL2-05 (whole-scope fail-closed kept). Every walk is pinned by a unit case (index side here, `judgeFinalScope` in 02-01).
- **New candidate DECLREC-01:** record each install's dependency declarations in `state.json`, so that path-source records keep theirs. Then move the load verdict and the uninstall guard to installed declarations for full E2 parity.
- **New candidate GITROOTDEPS-01:** installing a git-source plugin on a cold clone cache ignores the dependencies its own `plugin.json` declares, because the install cascade reads the root from the warm cache only, before the root is cloned. Claude Code reads the installed manifest. Details are in `deferred-items.md`.

## Uncertain choices (for user review)

1. **`update` and `apply` can judge one holder differently (RESEARCH A4).** Only the callers whose policy has `searchReleaseTags: true` reach `evaluateUpdateConstraint`: `update`, autoupdate, reinstall, and an install's dependency moves. `apply`'s converge path judges through `evaluateCatalogConstraint` with the catalog-first walk. So when a holder's installed copy and its catalog disagree, `update lib` can hold where `apply` would move, or the reverse. The alternative is to pass the installed walk into the converge path too, which changes the convergence and pending plan that D-PL2-06 keeps catalog-first.
2. **The `absent` fallback is the whole catalog read, slightly broader than E2's "the entry stands in".** When the copy is gone or has no manifest, the reader runs `readRecordDeclarations`' branch: the catalog copy's own manifest first (the warm clone of the catalog's commit, for a git source), then the entry. Upstream uses the entry only. The alternative is to answer the entry alone, which would need a third read branch.
3. **A delisted pinned record whose copy is absent** still ends as `not in manifest`. The fallback catalog read tries the copy again under both owner roots and finds nothing. That keeps the DLS-01 root exemption and the D-05-07 refusal as they were.
4. **Tag-pinned path-source dependencies also carry `resolvedSha`**, so they are read from their `resolvedSource` too. If that root is the marketplace clone rather than `plugin-clones/`, the NFR-10 check refuses it as `absent` and the catalog read answers, which is today's behavior. 02-04 (`installedCopyOwnerRoot`) owns widening the owner root.
5. **Both scenarios install the dependency explicitly** (deviation 1), so the dependency's provenance is `explicit`, not `dependency`. Neither assertion depends on provenance.

## Requirements status

RCN-05 is declared only by this plan. RCN-04 is shared with 02-01, which has landed. Both are marked through `requirements.ready-ids`.

## Next Phase Readiness

02-04 can widen `readInstalledCopyDeclaration`'s owner root (`installedCopyOwnerRoot`) under the new reader. The wave gate runs `npm run check` on the combined tree.

## Self-Check: PASSED

- FOUND: all 8 modified files and `deferred-items.md`
- FOUND: `60773ccf`, `fd4cf96f` (ancestors of HEAD)
- Commits measured: `git rev-list --count 75a7a635..HEAD` = 2
- Acceptance greps: readInstalledRecordDeclarations export 1, enable-disable uses 3, enable scenario 1, seam line 1, D-PL2-05 2, D-PL2-06 in gate 1, update scenario 1
- `node --test` on the three owner files: 238 pass. Direct coverage exit 0 for dependency-index.ts, enable-disable.ts and update-constraint-gate.ts. `npm run fallow`, `npm run check:features` and `npm run test:cucumber` (903 passed) exit 0
