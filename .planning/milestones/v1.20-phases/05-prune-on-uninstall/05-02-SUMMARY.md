---
phase: 05-prune-on-uninstall
plan: 02
subsystem: orchestrators
tags: [uninstall, prune, dependencies, flag-catalog, closed-set, catalog, prune-05]

# Dependency graph
requires:
  - phase: 05-prune-on-uninstall
    provides: "05-01: findDependents, buildScopeDeclarationIndex, the UninstallRefusedError guard inside the lock, the dependents-remain amendment procedure"
  - phase: 04-install-provenance
    provides: provenance field on records; the ten-surface closed-set amendment procedure (04-06)
  - phase: 02-uninstall-data-disposition-and-the-uninstall-option-seam
    provides: UninstallPluginOptions seam, catalog-owned flag names (WR-01), KEEP_DATA_FLAG mapping
provides:
  - "`PRUNE_FLAG` on the catalog-owned uninstall flag surface, mapped onto `UninstallPluginOptions.prune` (FLAG-01 / D-05-10)"
  - "`OrphanCandidate` + `pruneOrphans` fixpoint in `domain/dependency-orphans.ts` (PRUNE-01..03, D-05-01/02)"
  - "`IndexedRecord` candidates on `buildScopeDeclarationIndex`'s success arm"
  - "the whole-scope sweep inside uninstall's one locked transaction: `removeDependencyMember`, `sweepOrphans`, `finalizePrunedMembers`"
  - "`composePrunedRow` / `composeRemovalBlocks` in `uninstall.messaging.ts` (PRUNE-04)"
  - "`dependency pruned` closed-set member with all ten pinning surfaces; catalog states `success-prune`, `success-prune-keep-data`, `prune-partial-failure`"
affects: [05-03 (docs name --prune and its rules)]

# Actuals (#2632) -- estimateTokens scale (chars/4 over the realized diff), not a harness count.
actuals:
  tokens: 27095
  tasks: 3
  commits: 3
plan_head_before: cc8e0d6cb7c6c2e4bb4d377e37c7429901304c59

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Total member body inside a locked transaction: a per-member removal that runs between the primary's commit and the single save never throws and never saves -- every failure becomes a warning row -- so a member fault cannot ghost the primary's record (NFR-3)"
    - "Snapshot-carrying candidates: the index leaf hands the orchestrator the SAME marketplace/record objects the locked snapshot holds, so the sweep never re-walks state and never looks a key back up (no unreachable `undefined` arm for the direct-coverage gate)"
    - "Key-to-record without a lookup miss: `order.flatMap((key) => candidates.filter(...))` yields exactly one record per pruned key with no conditional, because every key `pruneOrphans` returns came from the candidates"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/flag-catalog.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/domain/dependency-orphans.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - docs/output-catalog.md
    - tests/architecture/flag-catalog-drift.test.ts
    - tests/edge/flag-catalog.test.ts
    - tests/edge/handlers/plugin/uninstall.test.ts
    - tests/edge/router.test.ts
    - tests/domain/dependency-orphans.test.ts
    - tests/orchestrators/plugin/dependency-index.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/uninstall.messaging.test.ts
    - tests/shared/notification-types.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts

key-decisions:
  - "`buildScopeDeclarationIndex`'s `candidates` are `IndexedRecord`s (key, provenance, plus the snapshot's own marketplace and record objects), not bare `OrphanCandidate`s: the member body then needs no state lookup, so there is no unreachable `record === undefined` arm for the 100%-direct-coverage gate to reject"
  - "`composePrunedRow` takes `version: string`, not `string | undefined`: `PluginInstallRecord.version` is a required string, and an `undefined` arm would be unreachable"
  - "The AG-5 member arm leaves the record untouched (the primary's TR-03 shape) while the non-AG-5 arm folds the dropped artifacts out in place; the cause fallback moved into `cascadeFailureCause` so both the primary's fold and the member body share the one `??`"
  - "`pruneOrphans` sorts each batch with `localeCompare` (the house comparator; `sonarjs/no-alphabetical-sort` forbids the bare default sort) -- same observable order as the plan's 'default string sort' on `[A-Za-z0-9._-]@` keys"
  - "`sweepOrphans` returns the member list and the closure spreads it into the `prune.members` escape object; `finalizePrunedMembers` owns the per-member loop so the outer function gains no condition (fallow 15/14 before and after)"

patterns-established:
  - "Two-marketplace prune fixtures: `seedDeclaringScope` seeds N marketplaces, one staged skill per plugin (`<mp>-<plugin>-skill`) and cross-marketplace declarations (`d2@mp2`), so a sweep case asserts records, skill dirs and data dirs per key"
  - "A cascade double keyed on the plugin name (`cascadeFailingFor`) fails one member and runs the real cascade for every other, so a member-failure case exercises real removals around the injected fault"

requirements-completed: [PRUNE-01, PRUNE-02, PRUNE-03, PRUNE-04, FLAG-01]

coverage:
  - id: D1
    description: "`--prune` is accepted on the catalog-owned flag surface in any position, repeated, and beside `--keep-data`; the rejected set (`-y`, `--yes`, `--delete-data`, `--keep-data=false`, unknown) is intact; the drift guard pins parse and documented sets at three flags (FLAG-01 / D-05-10)"
    requirement: FLAG-01
    verification:
      - kind: unit
        ref: "tests/edge/handlers/plugin/uninstall.test.ts#FLAG-01: accepts the prune flag ahead of the reference and removes the record and its data"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/uninstall.test.ts#FLAG-01: keeps the seeded data bytes when the prune flag rides beside the preservation flag, prune first"
        status: pass
      - kind: unit
        ref: "tests/architecture/flag-catalog-drift.test.ts#catalog vs handlers: every verb's parse-set matches the ordered handler-accepted pin"
        status: pass
      - kind: unit
        ref: "tests/edge/flag-catalog.test.ts#WR-01 / D-05-10: PRUNE_FLAG is the very name uninstall passes through to its handler"
        status: pass
    human_judgment: false
  - id: D2
    description: "`uninstall X --prune` removes X, then every dependency-provenance record nothing remaining declares, iterated to a fixpoint across marketplaces, including a pre-existing orphan, in one save (PRUNE-01 / D-05-01 / D-05-02)"
    requirement: PRUNE-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-05-01 / D-05-02: uninstall --prune removes the named plugin, its orphaned chain and a pre-existing orphan in one save"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-orphans.test.ts#D-05-02: a transitive chain is pruned dependents before dependencies"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-orphans.test.ts#D-05-01: a pre-existing orphan the removed set does not name is pruned (whole-scope sweep)"
        status: pass
    human_judgment: false
  - id: D3
    description: "an explicit-provenance record is never pruned, whether or not anything declares it (PRUNE-02)"
    requirement: PRUNE-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#PRUNE-02: an explicit record declared only by the named plugin is never pruned"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-orphans.test.ts#PRUNE-02: an explicit record declared only by the removed plugin survives"
        status: pass
    human_judgment: false
  - id: D4
    description: "a dependency any remaining installed record (disabled included) still declares survives, and with nothing to prune the report is byte-identical to the plain uninstall's (PRUNE-03 / D-05-04 / D-05-12); nothing is pruned unless the named plugin was actually removed (D-05-03); the reconcile default never prunes (D-05-08)"
    requirement: PRUNE-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#PRUNE-03 / D-05-12: a dependency another installed plugin still declares survives, and the report is the plain uninstall's"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#PRUNE-03 / D-05-04: a DISABLED installed plugin still holds the dependency against the sweep"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-05-03: a refused uninstall with --prune prunes nothing, even with an orphan in the scope"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-05-08: without the option an orphan survives the uninstall of an unrelated plugin"
        status: pass
    human_judgment: false
  - id: D5
    description: "each pruned plugin renders an ordinary `uninstalled` row under its own marketplace with `{dependency pruned}` (`{dependency pruned, data kept}` under `--keep-data`) at info with the reload hint, blocks in first-appearance order; a failed member renders a warning row beside the removals that stood, with one save and its record intact (PRUNE-04 / D-05-09 / D-05-11 / D-05-13)"
    requirement: PRUNE-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-05-09: --keep-data covers every plugin --prune removes, and each pruned row says so after the prune reason"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-05-13: a pruned member whose agents refuse to unstage renders a warning row, keeps its whole record, and rolls nothing back"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.messaging.test.ts#PRUNE-04: composeRemovalBlocks groups members under their marketplaces in first-appearance order, rows in removal order"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 20 fixture modules to 212 exact documented states"
        status: pass
    human_judgment: false

# Metrics
duration: 54min
completed: 2026-09-16
status: complete
---

# Phase 05 Plan 02: `uninstall --prune` Summary

**`uninstall X --prune` removes X and then, inside the same locked transaction with one save, every dependency-installed record in the scope that nothing remaining declares -- transitively, across marketplaces, never an explicit record, never a held one -- and reports each one on its own `{dependency pruned}` row; the member landed with all ten pinning surfaces and three catalog states.**

## Performance

- **Duration:** 54 min
- **Started:** 2026-09-16T22:51:16Z
- **Completed:** 2026-09-16T23:45:28Z
- **Tasks:** 3
- **Files modified:** 24

## Accomplishments

- The flag surface closes at `--keep-data` + `--prune` on every pinned side: the catalog row, `PRUNE_FLAG`'s WR-01 identity, the handler's omission-discipline mapping, both usage lines, and the drift guard's parse/documented pins.
- `pruneOrphans` is a tested pure fixpoint (12 cases: empty, single, transitive chain, diamond, explicit-never, cyclic island residue, pre-existing orphan, batch order, transitive hold, non-mutation) with a documented bound and ordering.
- The sweep runs on the success arm only, between the primary's commit and the one `tx.save()`; the member body is total (AG-5 and every other failure become a warning row), post-commit cleanup runs per removed member with the same `keepData`, and the report groups rows by marketplace in first-appearance order with cardinality `single`.
- Every gate is green: typecheck, ESLint, fallow (dead-code / health / dupes), Prettier, corresponding-tests, direct coverage (100% on every changed production file), 6459 unit tests, 32 integration tests.

## Task Commits

1. **Task 1: `--prune` on the catalog-owned flag surface** - `1f49ee5f` (feat)
2. **Task 2: the `pruneOrphans` fixpoint** - `fdff3d36` (feat)
3. **Task 3: the sweep, the report, the `dependency pruned` amendment in full** - `c026bc04` (feat)

## Files Created/Modified

- `edge/flag-catalog.ts` - `PRUNE_FLAG_ENTRY` between `--keep-data` and `--local`; `PRUNE_FLAG` exported (WR-01 rationale).
- `edge/handlers/plugin/uninstall.ts` / `edge/router.ts` - `[--prune]` in both usage lines; `...(consumedFlags.has(PRUNE_FLAG) && { prune: true })`.
- `domain/dependency-orphans.ts` - `OrphanCandidate`, `isHeldBy`, `pruneOrphans`; still import-free.
- `orchestrators/plugin/dependency-index.ts` - `IndexedRecord`; the success arm carries `candidates` (walk order, every record but the excluded one, enabled or disabled, whatever its provenance).
- `orchestrators/plugin/uninstall.ts` - `prune?: boolean` on the seam; `DeclarationSnapshot`; `assertNoDependents` returns the walk; `cascadeFailureCause` extracted from `foldPartialCascadeFailure`; `PrunedMember`, `buildMemberFailedRow`, `removeDependencyMember`, `sweepOrphans`, `finalizePrunedMembers`; the `prune` escape object; one `if (opts.prune === true)` in the lock closure; the emit goes through `composeRemovalBlocks`; header sketch and save comment amended.
- `orchestrators/plugin/uninstall.messaging.ts` - `UninstallPrivateReason` widened; `PRUNED_ROW_REASONS` / `PRUNED_ROW_REASONS_DATA_KEPT` pins; `composePrunedRow`; `composeRemovalBlocks`.
- `shared/notification-types.ts` / `shared/notify-reasons.ts` - tail member, `56-entry` twice, `55 to 56` ledger sentence, the `CommandPrivateReason` arm.
- `docs/output-catalog.md` - intro sentence (`[--prune]` and the rule), `success-prune`, `success-prune-keep-data`, `prune-partial-failure`.
- Tests: the eight suites named in the plan plus the three catalog gates; `seedDeclaringScope` generalizes Plan 01's seed helper to N marketplaces with one staged skill per plugin.

## Measured gate

**Complexity (fallow cyclomatic/cognitive), before -> after:**

| Function | Before | After |
|---|---|---|
| `uninstallPluginWithTransaction` | 15/14 (ESLint 12) | 15/14 (ESLint 12) |
| its lock closure | 6/5 | 7/6 |
| `assertNoDependents` | 3/2 | 3/2 |
| `foldPartialCascadeFailure` | 3/2 | 2/1 |
| `cascadeFailureCause` (new) | - | 2/1 |
| `removeDependencyMember` (new) | - | 3/2 |
| `sweepOrphans` (new) | - | 2/1 |
| `finalizePrunedMembers` (new) | - | 4/5 |
| `buildMemberFailedRow` (new) | - | 1/0 |
| `composePrunedRow` (new) | - | 2/1 |
| `composeRemovalBlocks` (new) | - | 3/4 |
| `buildScopeDeclarationIndex` | 5/9 | 5/9 |
| `pruneOrphans` (new) | - | 4/5 |
| `isHeldBy` (new) | - | 4/4 |

**Catalog constants:** `EXPECTED_STATE_COUNT` 209 -> 212; `EXPECTED_UTF8_BYTES` 27_873 -> 28_548 (measured after `SKIP=trufflehog pre-commit run --files docs/output-catalog.md`; mdformat rewrote nothing); parser tuple count 209 -> 212; `catalog-state:` anchors 214 -> 217; `REASONS.length` 55 -> 56. All three fenced blocks were produced by driving `notify()` over the fixture through the contract test's `makeCtx` boundary and pasting the captured output.

**The omission plant:** removing the `success-prune` fixture made the contract test fail with `211 !== 212`; the fixture was restored byte-identical (sha256 prefix `7102b88c52214b3f` before and after).

**Acceptance counts:** `grep -c "tx.save()" uninstall.ts` = 4 (two calls, two comment mentions); `opts.prune === true` occurs once, in the lock closure after `commitPluginRemoval`; the member body contains no `throw`; `grep -c '"--prune"' edge/handlers/plugin/uninstall.ts` = 0; `tests/edge/handlers/shared.test.ts` untouched.

**Report order (A-8, measured):** with `x` declaring `d1`, `d1` declaring `d2@mp2`, and `o@mp2` orphaned, the fixpoint's first pass is `[d1@mp, o@mp2]` (sorted) and the second `[d2@mp2]`, so the `mp2` block reads `o` then `d2` -- removal order, dependents before their own dependencies. The plan's behavior sketch listed `d2` before `o`; the byte assertion pins what the documented algorithm produces.

## TDD Gate Compliance

`workflow.tdd_mode` is `false` for this project; the RED/GREEN discipline was applied per task and the evidence recorded rather than committed as separate `test(05-02)` commits, because this repo's pre-commit `npm-typecheck` hook rejects a RED commit that does not type-check (the plan states this procedure).

- **RED 1 (flag surface):** with the pins moved and the accepted cases added, `node --test --test-reporter=tap tests/edge/handlers/plugin/uninstall.test.ts` exited 1 with 22/37 failing; the target `FLAG-01: accepts the prune flag ahead of the reference ...` failed on `Unknown flag: "--prune".` with `BOTH_RECORDS_INTACT`. The drift guard's parse-set and help-text pins and the router usage pin were red in the same run. `gsd_run check tdd-red-evidence` -> `RED_EVIDENCE_OK` (`target_test_failed`).
- **RED 2 (fixpoint):** against the module as Plan 01 left it, `node --test tests/domain/dependency-orphans.test.ts` exited 1 at link time: `SyntaxError: The requested module '.../dependency-orphans.ts' does not provide an export named 'pruneOrphans'`. With a shape-correct stub returning `[]`, the same command exited 1 with 5/18 failing (single orphan, transitive chain, pre-existing orphan, batch order, transitive hold); target `D-05-02: a transitive chain is pruned dependents before dependencies` expected `["d1@mp", "d2@mp"]`, got `[]`. `tdd-red-evidence` -> `RED_EVIDENCE_OK`. The stub was discarded before the implementation.
- **RED 3 (sweep):** with the vocabulary, messaging and index changes in place but `uninstall.ts` at `HEAD`, `node --test --test-name-pattern "D-05-01|...|PRUNE-03" tests/orchestrators/plugin/uninstall.test.ts` exited 1 with 5/11 failing (the four positive cases and the fallback-cause case); the six "nothing pruned" cases passed as expected. Target `D-05-01 / D-05-02: uninstall --prune removes ...` rendered the single `x` row. `tdd-red-evidence` -> `RED_EVIDENCE_OK`.
- **GREEN:** `1f49ee5f`, `fdff3d36`, `c026bc04` (all `feat(05-02)`); every named suite passes after each.
- **REFACTOR:** none as a separate commit; the `cascadeFailureCause` extraction and the `composeRemovalBlocks` return-type inlining happened before Task 3's commit.

## Decisions Made

- `IndexedRecord` candidates carry the snapshot's own objects (see key-decisions); the domain function still takes `readonly OrphanCandidate[]` and is unaffected.
- `composePrunedRow` takes `version: string` (the record's field is required).
- `sweepConfigLayers` is not called for a member (A-9 as planned); documented in the member body's comment.
- `garbageCollectPluginClones` runs once per removed member through `runPostCommitCleanup` (A-12 as planned).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `candidates` typed richer than `OrphanCandidate`**
- **Found during:** Task 3 (designing `removeDependencyMember`)
- **Issue:** with bare `{ key, provenance }` candidates the member body must split the key and look up `state.marketplaces[mp]?.plugins[name]`, whose `undefined` arms are unreachable (the keys came from the same snapshot) and the direct-coverage gate requires 100% branches.
- **Fix:** `IndexedRecord extends OrphanCandidate` adds `marketplace`, `plugin`, `record` (the snapshot's own objects); the leaf's paired test asserts identity with `state.marketplaces.mp.plugins.helper`.
- **Files modified:** `dependency-index.ts`, `dependency-index.test.ts`
- **Committed in:** `c026bc04`

**2. [Rule 1 - Bug] `composeRemovalBlocks` leaked the private `UninstallMsg` alias**
- **Found during:** Task 3 verify (`fallow dead-code`: "references private type UninstallMsg")
- **Fix:** the exported return type is spelled `MarketplaceRows<PluginUninstalledMessage | PluginFailedMessage>[]`.
- **Committed in:** `c026bc04`

**3. [Rule 1 - Bug] `composePrunedRow` version arm**
- **Found during:** Task 3 (reading `PLUGIN_INSTALL_RECORD_SCHEMA`)
- **Issue:** the plan's `version: string | undefined` with a conditional spread is an unreachable branch: `version` is a required string on every record.
- **Fix:** `version: string`, always set.
- **Committed in:** `c026bc04`

**4. [Rule 1 - Bug] `tx.save()` mention count**
- **Found during:** Task 3 acceptance (`grep -c "tx.save()"` printed 5)
- **Fix:** the member body's doc comment says "never saves the transaction" instead of naming the call; count back to 4.
- **Committed in:** `c026bc04`

---

**Total deviations:** 4 auto-fixed (1 Rule 3, 3 Rule 1)
**Impact on plan:** All four are gate-driven corrections inside the plan's scope; no behavior differs from the plan's `<behavior>` lists except the measured `mp2` row order noted above.

## Issues Encountered

- The "saved exactly once" assertion needs no counting double: `LockedStateTransaction.save()` throws on its second call, so a sweep that saved per member would surface as a failure row instead of the asserted success report. The D-05-01 case states this in a comment.
- `sonarjs/no-alphabetical-sort` rejects the bare `.sort()` the research sketch used; `pruneOrphans` sorts with `localeCompare` like `findDependents`.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-05-07: the provenance filter runs before `isHeldBy` is consulted (pinned by the PRUNE-02 domain and owner cases). T-05-09: the D-05-13 cases inject AG-5 and a partial failure on the second-marketplace member and assert `x` and `d1` gone, `o` gone, `d2` intact or shrunk, one saved state. T-05-10: every member path comes from `ScopedLocations` getters through `runPostCommitCleanup`; `uninstall.ts` contains no `path.join` of its own beyond the pre-existing `path.basename`. T-05-12: `apply.ts` passes no `prune` (the D-05-08 case and the reconcile suite's D-04-05 control both pass unchanged).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05-03 can document `--prune` from the catalog chapter's new intro sentence and the three states; the A-2 scenario (two records absent from their manifests refusing each other) and the dev-tree provenance residue (D-04-03 back-fill) remain for the UAT notes.
- The `UninstallPrivateReason` pin is `_ReasonInSet<"dependency pruned" | "dependents remain">`.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/domain/dependency-orphans.ts` FOUND
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` FOUND
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts` FOUND
- `docs/output-catalog.md` FOUND
- commit `1f49ee5f` FOUND
- commit `fdff3d36` FOUND
- commit `c026bc04` FOUND

---
*Phase: 05-prune-on-uninstall*
*Completed: 2026-09-16*
