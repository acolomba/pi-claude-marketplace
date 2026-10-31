---
phase: 08-clear-milestone-debt
plan: 18
subsystem: reconcile, import, config write-back and marketplace lifecycle
tags: [d-08-07, ownkey-01, debt-04, debt-02, prototype-keys, fallow-audit]

requires:
  - "08-02: `readLegacyMcpOwners` on `McpMigrationOperations`"
  - "08-09: `shared/own-key.ts` (`ownValue`, `setOwn`)"
  - "08-12: `env` threading in mcp-migration.ts"
  - "08-15: own-key front-door resolution"
provides:
  - "The reconcile planner, the dependency-disabled stamp and the MCP migration read records by own key; mcp-migration.ts imports the shared `ownValue`"
  - "Import reads records and config by own key and writes every config patch entry with `setOwn`; the config write-back reads existing entries by own key"
  - "Marketplace autoupdate, remove, update and list read by own key; the autoupdate write-back uses `setOwn`; remove's two `in` tests are own-key checks"
  - "The soft-dependency probe comments in marketplace remove and update and the uninstall edge test name both `getAllTools()` and `getCommands()` (P1 IN-01)"
affects: [08-19 (end-to-end proof), 08-21 (DEBT-04 / DEBT-02 ledger)]

actuals:
  tokens: 7307
  tasks: 3
  commits: 3
plan_head_before: 480a4b565405ebe5cd25237246a613c06412e85a
plan_head_after: 5ab12f701b9dd22d308556cacd236edf81cfe0bf

tech-stack:
  added: []
  patterns:
    - "Own-key state and config access: `ownValue(map, name)` for name-indexed reads, `setOwn(map, name, value)` for keyed writes, `ownValue(...) !== undefined` for `name in map`"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/persistence/config-write-back.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
    - tests/orchestrators/reconcile/plan.test.ts
    - tests/edge/handlers/plugin/uninstall.test.ts

key-decisions:
  - "plan.ts's declared and recorded marketplace-map reads (`declared[name]`, `recorded[...]`, `declaredMarketplaces[...]`) also use `ownValue`. The plan's site list named only the plugin-record reads, but the must-have covers every name-indexed read in the file, and these reads are where a reserved name actually changed the plan."
  - "The two plan-named behavior cases (`constructor@mp` with no record, and a recorded `constructor`) pass on the old code, because `recordedKeys` is a Set built from own keys. They stay as regression guards. Four more D-08-07 cases reach the converted sites and were RED on the old code."
  - "mcp-migration.ts keeps `marketplace && ownValue(marketplace.plugins, owner.plugin)` unchanged; only the helper source moved to `shared/own-key.ts`."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "a /reload declaring constructor@mp with no record plans its install; a recorded enabled constructor plans nothing"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts (two D-08-07 regression guards)"
        status: pass
    human_judgment: false
  - id: D2
    description: "a declared marketplace named constructor with no record plans an add; a recorded marketplace named toString can be claimed by a declared alias; a plugin under an undeclared toString marketplace is dangling; a verdict naming a constructor dependent with no record plans nothing"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts (four D-08-07 cases, RED on the old code)"
        status: pass
    human_judgment: false
  - id: D3
    description: "no name-indexed marketplaces or plugins read remains in marketplace/, import/, reconcile/ or persistence/"
    requirement: "DEBT-04"
    verification:
      - kind: other
        ref: "Task 3 sweep grep (tmp/p8-18-sites.txt empty)"
        status: pass
    human_judgment: false
  - id: D4
    description: "fallow audit reports no introduced group"
    requirement: "DEBT-01"
    verification:
      - kind: other
        ref: "npx fallow audit --base $(git merge-base origin/main HEAD) --format json"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 18: Own-key reconcile, import, persistence and marketplace Summary

**The reconcile planner, import, the config write-back and the marketplace lifecycle modules now read marketplace and plugin entries only by own key, and they write config maps with `setOwn`. Before, a declared marketplace named `constructor` read the inherited `Object` function as its record, so `/reload` reported a source mismatch instead of planning the add. A plugin under an undeclared `toString` marketplace was planned for install instead of reported as dangling. A recorded `toString` marketplace could not be claimed by a declared alias. A dependency verdict naming an unrecorded `constructor` dependent planned a dependency disable and a dependency install. mcp-migration.ts now imports the shared `ownValue`. The last three P1 IN-01 comments name both `getAllTools()` and `getCommands()`. The audit stays `pass` with 0 introduced groups and 8 inherited.**

## Performance

- **Duration:** about 11 min (2026-10-10T06:33Z to 06:44Z)
- **Tasks:** 3/3
- **Files:** 11 modified (9 sources, 2 tests)

## Findings advanced

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| OWNKEY-01 (D-08-07, DEBT-04) | reconcile, import, persistence and marketplace sites converted; the sweep grep over the four directories is empty. 08-19 proves the sweep end to end | 954da5a4, ac4aceb5, 5ab12f70 |
| P1 IN-01 (DEBT-02) | marketplace/remove.ts, marketplace/update.ts and the uninstall edge test header now name `getAllTools()` and `getCommands()`. With 08-16's install-flow.ts comment, IN-01 is complete | 5ab12f70 |

## Task Commits

1. **Task 1 (tracer): a reload plans an install of a declared plugin named constructor.** Commit `954da5a4` (`fix(reconcile): plan declared plugins by own key`). RED against the HEAD sources: 4 of the 6 new D-08-07 cases failed (the constructor marketplace add, the toString alias claim, the toString dangling reference, and the constructor verdict dependent). The two plan-named cases passed on the old code and stay as regression guards. Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed and gitlint Passed. Tracer gate: the verify block is automated only and `human_verify_mode` is `end-of-phase`. I re-ran the owner suites after the commit (230/230 pass) and went on.
2. **Task 2: import and config write-back read and write config maps by own key.** Commit `ac4aceb5` (`fix(import): write config maps by own key`). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed and gitlint Passed.
3. **Task 3: the marketplace modules use own keys, and the probe comments name both reads.** Commit `5ab12f70` (`fix(marketplace): read and write records by own key`). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed and gitlint Passed.

## Verify results (final lines)

- Task 1: `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/reconcile/mcp-migration.test.ts` gave `ℹ tests 230`, `ℹ pass 230`, `ℹ fail 0`. `npm run test:coverage:direct -- …/plan.ts …/apply.ts …/mcp-migration.ts` exited 0 with no shortfall.
- Task 2: `node --test tests/orchestrators/import/execute.test.ts tests/persistence/config-write-back.test.ts` gave `ℹ tests 78`, `ℹ pass 78`, `ℹ fail 0`. `npm run test:coverage:direct -- …/execute.ts …/config-write-back.ts` exited 0 with no shortfall.
- Task 3: the five owner suites gave `ℹ tests 171`, `ℹ pass 171`, `ℹ fail 0`. `npm run test:coverage:direct -- …/autoupdate.ts …/remove.ts …/update.ts …/list.ts` exited 0 with no shortfall. The sweep grep exited 0 with `tmp/p8-18-sites.txt` empty.
- Acceptance greps: no `^function ownValue` in mcp-migration.ts, and its import of `shared/own-key.ts` is at line 83. The bracket-read grep prints nothing for the Task 1 and Task 2 file sets. No `in …marketplaces` in remove.ts. `getCommands()` appears in remove.ts:170, update.ts:173 and uninstall.test.ts:25.
- Audit before each commit: `verdict pass`, `duplication_introduced 0`, `duplication_inherited 8`, `complexity_introduced 0`, `dead_code_introduced 0`.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## Deviations from Plan

**1. [Rule 2 - Correctness] Marketplace-map reads in reconcile/plan.ts outside the site list**
- **Found during:** Task 1
- **Issue:** `recordedSourceCandidates` (`declared[name]`), `collectMarketplaceClaim` (`recorded[declaredMarketplace]`), `diffMarketplaces` (`recorded[mpName]`) and `classifyDeclaredPlugin` (`declaredMarketplaces[declaredMarketplace]`) index name-keyed maps. The plan's grep does not match them, but the must-have names every name-indexed read in plan.ts.
- **Fix:** all four use `ownValue`.
- **Commit:** 954da5a4

**2. [Rule 2 - Edge] Four extra D-08-07 planner cases**
- The plan's two behavior cases pass on the old code, because `recordedKeys` is a Set of own keys. Four added cases each reach a converted site and were RED on the old code: the constructor marketplace add, the toString alias claim, the toString dangling reference, and the constructor verdict dependent (the last one covers both the dependency-disable and dependency-install reads).

**3. [Rule 2 - Correctness] Template-keyed write in import/execute.ts**
- `plugins[\`${skipped.plugin}@${skipped.marketplace}\`] = {}` in `buildRepairPatchForScope` uses `setOwn`, following the conversion rule. The plan's site list did not name it.

**4. Comment kept accurate in marketplace/list.ts**
- The comment that quoted `merged.marketplaces[name]?.entry.autoupdate` now quotes the `ownValue` form.

**Total deviations:** 4. **Impact:** behavior is unchanged for valid names. Every converted site follows D-08-07.

No test Proxy needed adapting: the reconcile, import, persistence and marketplace suites pass unchanged. The mcp-migration symlink case that reaches `resolveOffline`'s probe-throw branch is untouched. stampDependencyDisabled in apply.ts has no reserved-name case. Its conversion is mechanical, and the existing apply cases keep it at 100% direct coverage.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigation applied:
- T-08-36: import and autoupdate config writes use `setOwn`, and the reconcile, import, write-back and marketplace reads use `ownValue`. A reload or import can no longer skip or misclassify a reserved-name entry by reading an inherited member.

## Notes for later plans

- 08-19: the reconcile planner has six D-08-07 unit cases. The import, write-back and marketplace sites are converted with no reserved-name case of their own; their end-to-end proof is yours.
- `delete` statements stay at marketplace/remove.ts (record plugins and the state marketplace) and persistence/config-write-back.ts (`deletePluginConfigEntry`).

## Self-Check: PASSED

- All eleven modified files exist.
- Commits 954da5a4, ac4aceb5 and 5ab12f70 are ancestors of HEAD.
