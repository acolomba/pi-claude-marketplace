---
phase: 08-clear-milestone-debt
plan: 16
subsystem: uninstall, enable/disable, install ledger and cascades, clone mirror seed
tags: [d-08-07, ownkey-01, debt-04, debt-02, prototype-keys, fallow-audit]

requires:
  - "08-09: `shared/own-key.ts` (`ownValue`, `setOwn`)"
  - "08-11: env carried on the module-private `SetEnabledRunOptions` in enable-disable.ts"
  - "08-15: own-key front-door resolution (`resolveCrossScopePluginTarget` and the marketplace resolvers)"
provides:
  - "uninstall, enable, disable and the whole install family read state records through `ownValue` and write them through `setOwn`"
  - "The `InstallPluginOptions.pi` comment names both `getAllTools()` and `getCommands()` (P1 IN-01)"
affects: [08-17, 08-18 (remaining OWNKEY-01 sites), 08-19 (end-to-end proof), 08-21 (DEBT-04 / DEBT-02 ledger)]

actuals:
  tokens: 7925
  tasks: 2
  commits: 2
plan_head_before: f0522d7c968d1a454b7f101eeb0f37ca8b42d9e5
plan_head_after: 309f84e4fd012128650dd4613660741bc2b6a08e

tech-stack:
  added: []
  patterns:
    - "Own-key state access: `ownValue(map, name)` for name-indexed reads, `setOwn(map, name, record)` for keyed writes"
    - "A test Proxy that fakes a concurrent record must answer `getOwnPropertyDescriptor`; one that drops a write must trap `defineProperty`"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-declared-enabled.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/install-outcome.test.ts

key-decisions:
  - "Five fault-injection Proxies in install-flow.test.ts and install-outcome.test.ts were adapted, not the production reads. The race Proxies now count `getOwnPropertyDescriptor` requests, which every own-key read makes first. The dropped-write Proxies now trap `defineProperty`, which `setOwn` uses. Every assertion, read count and expected failure is unchanged."
  - "The template-keyed config reads in uninstall.ts (`deletePluginFromLayer`) and enable-disable.ts (`resolveIdempotentOutcome`) also use `ownValue`, following the conversion rule for `${plugin}@${marketplace}` keys."
  - "install-outcome.ts's container write `state.marketplaces[marketplace] = targetMp` (the CMP-3 project clone) also uses `setOwn`. The plan's site list named only the read beside it."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "uninstall constructor@mp renders the not-installed row of any absent plugin and changes no file"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-08-07: uninstall of a plugin named constructor reports it as not installed and changes no file"
        status: pass
    human_judgment: false
  - id: D2
    description: "enable constructor@mp renders the not-installed row and changes no file"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#D-08-07: enable of a plugin named constructor reports it as not installed and changes no file"
        status: pass
    human_judgment: false
  - id: D3
    description: "disable x@toString reports the marketplace as not added"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#D-08-07: disable in a marketplace named toString reports the marketplace as not added"
        status: pass
    human_judgment: false
  - id: D4
    description: "a plugin named constructor enables, disables and enables, and its record stays an own key after each save"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#D-08-07: a plugin named constructor enables, disables and enables through its own record"
        status: pass
    human_judgment: false
  - id: D5
    description: "fallow audit reports no introduced clone group"
    requirement: "DEBT-01"
    verification:
      - kind: other
        ref: "npx fallow audit --base $(git merge-base origin/main HEAD) --format json"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 16: Own-key install, enable, disable and uninstall Summary

**Uninstall, enable, disable and the install family now read plugin and marketplace records only by own key, and they store records with `setOwn`. Before, `uninstall constructor@mp` and `enable constructor@mp` read the inherited `constructor` function as an install record. Now they print the same `{not installed}` row as any absent name. Writes keyed by `__proto__` no longer reparent the map and lose the record at save. The install-flow comment now names both `getAllTools()` and `getCommands()`. The audit stays `pass` with 0 introduced groups and 8 inherited.**

## Performance

- **Duration:** about 16 min (2026-10-10T06:01Z to 06:17Z)
- **Tasks:** 2/2
- **Files:** 12 modified (8 sources, 4 tests)

## Findings advanced

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| OWNKEY-01 (D-08-07, DEBT-04) | install, enable, disable and uninstall sites converted. 08-17 and 08-18 own the remaining sites, and 08-19 proves the sweep end to end | 841b15fc, 309f84e4 |
| P1 IN-01 (DEBT-02) | the `InstallPluginOptions.pi` comment names `getAllTools()` and `getCommands()` for the soft-dependency probes (RH-3, ADET-02, WDEP-01) | 309f84e4 |

## Task Commits

1. **Task 1 (tracer): uninstall, enable and disable of a reserved name read as absent, and a plugin named constructor toggles.** Commit `841b15fc` (`fix(enable): read and write plugin records by own key`). RED: I ran the four new cases against the HEAD sources. The `uninstall constructor@mp` and `enable constructor@mp` cases failed. `disable x@toString` and the constructor round trip passed on the old code. The front-door resolver from 08-15 already refuses the toString marketplace. A `constructor` assignment already creates an own property. Those two cases guard the new reads and writes. Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed and gitlint Passed. Tracer gate: the verify block is automated only, and `human_verify_mode` is `end-of-phase`. I re-ran the verify after the commit (249/249 pass) and went on.
2. **Task 2: the install family reads and writes by own key, and the probe comment names both reads.** Commit `309f84e4` (`fix(install): record plugins by own key`). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed and gitlint Passed.

## Verify results (final lines)

- Task 1: `node --test tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/plugin/enable-disable.test.ts` gave `ℹ tests 249`, `ℹ pass 249`, `ℹ fail 0`. `npm run test:coverage:direct -- …/uninstall.ts …/enable-disable.ts` exited 0 with no shortfall, before the commit and again after the Task 2 config-read change.
- Task 2: the six owner suites gave `ℹ tests 461`, `ℹ pass 461`, `ℹ fail 0`. `npm run test:coverage:direct --` over the six sources exited 0 with no shortfall. `npm run test:integration` exited 0. `npm run test:modules` exited 0. Its stderr carries the known `Legacy marketplace migration could not be persisted … chown` lines from the existing info and list cases. `npx tsc --noEmit -p .` exited 0.
- Audit check (Task 2 verify): `verdict pass introduced-here 0 introduced-all 0 total 8`. The reviewed hooks-hydration marker in enable-disable.ts still sits above the `for (const { member, hooksJsonPath } of withHooks)` loop it covers.
- Acceptance greps: the bracket-read grep prints nothing for both file sets. `grep -n "getCommands()" …/install-flow.ts` prints line 119, the reworded comment.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## Deviations from Plan

**1. [Rule 3 - Blocking] Five fault-injection Proxies in the install tests**
- **Found during:** Task 2 owner suites (8 failures)
- **Issue:** The race tests revealed a concurrent record through a Proxy `get` trap on a key the target lacks. `ownValue` asks `Object.hasOwn` first, so it never reached the trap. The dropped-write tests trapped `set`, and `setOwn` defines the property instead. The conversion rule expects existing tests to pass unchanged. These tests are coupled to the bracket-read mechanism, not to the behavior.
- **Fix:** `raceRecordAtStateCommit` in install-flow.test.ts and the two race Proxies in install-outcome.test.ts count `getOwnPropertyDescriptor` requests and report the raced record as an own property from the third read. The two fresh-record Proxies in install-flow.test.ts trap `defineProperty`. Every assertion is unchanged, including `pluginReads === 3`.
- **Files modified:** tests/orchestrators/plugin/install-flow.test.ts, tests/orchestrators/plugin/install-outcome.test.ts (outside the Task 2 file list)
- **Commit:** 309f84e4

**2. [Rule 2 - Correctness] Template-keyed config reads in uninstall.ts and enable-disable.ts**
- **Found during:** Task 2 sweep grep
- **Issue:** `cfg.config.plugins?.[\`${plugin}@${marketplace}\`]` (uninstall.ts `deletePluginFromLayer`) and `selection.current.plugins?.[…]` (enable-disable.ts `resolveIdempotentOutcome`) were not in the plan's site list. The plan's grep does not match a template key. The conversion rule says to convert such keys too.
- **Fix:** both use `ownValue`. They landed in the Task 2 commit because Task 1 was already committed.
- **Commit:** 309f84e4

**3. [Rule 2 - Correctness] The CMP-3 container write in install-outcome.ts**
- `state.marketplaces[marketplace] = targetMp` uses `setOwn`. The plan's site list named only the read before it.

**Total deviations:** 3. **Impact:** behavior is unchanged for valid names. Every converted site follows D-08-07.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigation applied:
- T-08-34: the state phase, the CMP-3 container clone and the three disable writes use `setOwn`. A `__proto__` or `constructor` key is now saved as its own record, so it no longer reparents the map and loses the record at `saveState`.

## Notes for later plans

- 08-17 to 08-19: a test Proxy that fakes a state record must answer `getOwnPropertyDescriptor`, not only `get`, because own-key reads ask for the own property first. A Proxy that drops a write must trap `defineProperty`, because `setOwn` does not run `set`.
- `delete` statements stay at uninstall.ts:781 and install-cascade.ts:1016.

## Self-Check: PASSED

- All twelve modified files exist.
- Commits 841b15fc and 309f84e4 are ancestors of HEAD.
