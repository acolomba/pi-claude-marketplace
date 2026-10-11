---
phase: 08-clear-milestone-debt
plan: 17
subsystem: reinstall, update and list
tags: [d-08-07, ownkey-01, debt-04, prototype-keys, fallow-audit]

requires:
  - "08-09: `shared/own-key.ts` (`ownValue`, `setOwn`)"
  - "08-12: `env` threading in update-flow (`UpdateBindings`) and reinstall-flow"
  - "08-15: own-key front-door resolution"
provides:
  - "Reinstall target selection, the locked reinstall read and the reinstalled record write use `ownValue` and `setOwn`"
  - "The update preflight, the in-progress and finalize state guards, the update marketplace sync and target reads, and the list blocks read records through `ownValue`"
affects: [08-18 (remaining OWNKEY-01 sites), 08-19 (end-to-end proof for update and list), 08-21 (DEBT-04 ledger)]

actuals:
  tokens: 5485
  tasks: 2
  commits: 2
plan_head_before: be289c1b199852f093dc0a180ce54af9054fb4b6
plan_head_after: 57a41582280cb3ef7cebd5a131b6aec2f1cf86cb

tech-stack:
  added: []
  patterns:
    - "Own-key state access: `ownValue(map, name)` for name-indexed reads, `setOwn(map, name, record)` for keyed writes"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-targets.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
    - tests/orchestrators/plugin/reinstall-targets.test.ts
    - tests/orchestrators/plugin/reinstall-record.test.ts

key-decisions:
  - "The reinstalled-record guard in reinstall-record.ts reads `marketplace === undefined || ownValue(marketplace.plugins, name) === undefined`. A function call does not narrow `marketplace`, so the explicit test replaces the optional chain. The two paths are the same ones the optional chain had, and direct coverage stays at 100%."
  - "list-flow.ts's template-keyed config read (`${plugin}@${marketplace}`) also uses `ownValue`, as the conversion rule requires, though the plan's grep does not match it."
  - "No test Proxy needed adapting: the update, list and reinstall suites pass unchanged."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "reinstall constructor@mp with mp in both scopes selects the project container, as an absent name does"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall-targets.test.ts#D-08-07: a bare plugin named constructor stays in the project container as an absent name does"
        status: pass
    human_judgment: false
  - id: D2
    description: "reinstall constructor@mp picks the user record when the project container lacks it"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall-targets.test.ts#D-08-07: a bare plugin named constructor selects its user record over a project container that lacks it"
        status: pass
    human_judgment: false
  - id: D3
    description: "reinstall x@constructor reports the marketplace as not added with no scope, --scope project and --scope user; reinstall of the toString marketplace does too"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall-targets.test.ts (three data rows and one marketplace case, all D-08-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "the reinstall record write keeps a __proto__ record as an own key and rejects a __proto__ name with no own record"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall-record.test.ts (two D-08-07 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "fallow audit reports no introduced group"
    requirement: "DEBT-01"
    verification:
      - kind: other
        ref: "npx fallow audit --base $(git merge-base origin/main HEAD) --format json"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 17: Own-key reinstall, update and list Summary

**Reinstall, update and list now read plugin and marketplace records only by own key, and reinstall writes its record with `setOwn`. Before, `reinstall x@constructor` threw a TypeError on the inherited `Object` function, and with `--scope` it selected a target in a marketplace that does not exist. Now it reports `{marketplace not added}`, as any unknown marketplace does. `reinstall constructor@mp` no longer matches the inherited member in a project container that lacks the plugin, so it picks the user record. A reinstall of a `__proto__` name with no own record is now reported as concurrently removed, where the old write reparented the plugin map. The audit stays `pass` with 0 introduced groups and 8 inherited.**

## Performance

- **Duration:** about 12 min (2026-10-10T06:18Z to 06:30Z)
- **Tasks:** 2/2
- **Files:** 9 modified (7 sources, 2 tests)

## Findings advanced

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| OWNKEY-01 (D-08-07, DEBT-04) | reinstall, update and list sites converted. 08-18 owns the remaining sites, and 08-19 proves update and list end to end | 1c9f5b44, 57a41582 |

## Task Commits

1. **Task 1 (tracer): reinstall of a reserved name selects no target, through target selection and the record write.** Commit `1c9f5b44` (`fix(reinstall): select and record plugins by own key`). RED against the HEAD sources: 5 of the 6 new reinstall-targets cases failed. The three `x@constructor` rows threw a TypeError (no scope) or selected a target (`--scope project`, `--scope user`). The `toString` marketplace case threw a TypeError. The constructor-in-user-only case resolved to `project`. The first behavior case (`constructor@mp` with `mp` in both scopes) passed on the old code, because the inherited member and an absent name both resolve to the project container. It stays as a regression guard. In reinstall-record.test.ts, the `__proto__`-without-own-record case failed on the old code (no throw). The own `__proto__` write case passed on the old code, because assignment to an existing own data property updates it, so it is a regression guard. Pre-commit log: `PRECOMMIT_EXIT=0` on the second run, after the prettier hook reformatted a type cast in the record test. Hook: the first `git commit` failed in `npm run check:commit` lint (an `import-x/order` error in reinstall-flow.ts and a `no-unsafe-assignment` on `Object.getPrototypeOf` in the record test). No commit was made. I fixed both, restaged, reran pre-commit (`PRECOMMIT_EXIT=0`) and committed. `npm run check:commit` Passed and gitlint Passed. Tracer gate: the verify block is automated only and `human_verify_mode` is `end-of-phase`. I re-ran the verify after the commit (182/182 pass, coverage exit 0) and went on.
2. **Task 2: the update family and list read records by own key.** Commit `57a41582` (`fix(update): read plugin records by own key`). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed and gitlint Passed.

## Verify results (final lines)

- Task 1: `node --test tests/orchestrators/plugin/reinstall-targets.test.ts tests/orchestrators/plugin/reinstall-record.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts` gave `ℹ tests 182`, `ℹ pass 182`, `ℹ fail 0`, exit 0. `npm run test:coverage:direct -- …/reinstall-targets.ts …/reinstall-record.ts …/reinstall-flow.ts` exited 0 with no shortfall.
- Task 2: `node --test tests/orchestrators/plugin/update-swap.test.ts tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/plugin/list-flow.test.ts` gave `ℹ tests 529`, `ℹ pass 529`, `ℹ fail 0`, exit 0. `npm run test:coverage:direct -- …/update-swap.ts …/update-preflight.ts …/update-flow.ts …/list-flow.ts` exited 0 with no shortfall. Its stderr carries the known `Legacy marketplace migration could not be persisted … chown` lines from existing list cases.
- Audit before each commit: `verdict pass`, `duplication_introduced 0`, `duplication_inherited 8`, `complexity_introduced 0`, `dead_code_introduced 0`.
- Acceptance greps: the bracket-read grep prints nothing for both file sets.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## Deviations from Plan

**1. [Rule 2 - Correctness] Two reinstall-record cases outside the Task 1 file list**
- **Found during:** Task 1
- **Issue:** The must-have names the reinstall-record write. No reinstall-targets case reaches it.
- **Fix:** tests/orchestrators/plugin/reinstall-record.test.ts gets a RED case (a `__proto__` name with no own record must throw `concurrently removed`) and a regression guard (an own `__proto__` record is rewritten as an own key, and the map keeps `Object.prototype`).
- **Commit:** 1c9f5b44

**2. [Rule 2 - Edge] Extra reinstall-targets cases**
- The `x@constructor` behavior runs as three data rows (no scope, `--scope project`, `--scope user`), which covers "in both scopes". A `toString` marketplace-form case and the constructor-in-user-only RED case are added, because the plan's first behavior case passes on the old code.

**3. [Rule 2 - Correctness] Template-keyed config read in list-flow.ts**
- `pluginScopeConfig.plugins[\`${name}@${mpName}\`]` uses `ownValue`, following the conversion rule. The plan's grep does not match it.

**Total deviations:** 3. **Impact:** behavior is unchanged for valid names, and the added cases are a superset of the plan's.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigation applied:
- T-08-35: reinstall and update selection never pick an inherited member as a target or a record. The reinstalled record write uses `setOwn`, so a `__proto__` key stays its own record across the save.

## Notes for later plans

- 08-18: no test Proxy in the reinstall, update or list suites needed adapting.
- 08-19: the update and list sites are converted but carry no reserved-name case of their own here. Their end-to-end proof is yours.

## Self-Check: PASSED

- All nine modified files exist.
- Commits 1c9f5b44 and 57a41582 are ancestors of HEAD.
