---
phase: 08-clear-milestone-debt
plan: 15
subsystem: plugin info, scope fan-out, marketplace and plugin target resolution, edge completions
tags: [d-08-07, d-08-08, ownkey-01, debt-04, debt-01, prototype-keys, fallow-audit]

requires:
  - "08-09: `shared/own-key.ts` (`ownValue`, `setOwn`)"
  - "08-01: fallow audit `pass` with 0 introduced groups"
provides:
  - "info, the scope fan-out, marketplace scope resolution, plugin and marketplace target resolution, the edge state projection and the completion plugin read all use own keys"
  - "`resolveExplicitScope` and `loadBothScopes`, module-private in `orchestrators/plugin/shared.ts`, shared by `resolveCrossScopePluginTarget` and `resolveInstalledMarketplaceTarget`"
  - "`hasPluginRecord(state, marketplace, plugin)`, module-private in `orchestrators/plugin/shared.ts`"
affects: [08-16, 08-17, 08-18 (remaining OWNKEY-01 sites), 08-19 (end-to-end proof), 08-21 (DEBT-04 / DEBT-01 ledger)]

actuals:
  tokens: 8267
  tasks: 2
  commits: 2
plan_head_before: 85b366248bec5e759c6da41a7567809f36febfdb
plan_head_after: 150dc7dfdb48a787f62f6b5ecf70e761aabd0738

tech-stack:
  added: []
  patterns:
    - "Own-key state access: `ownValue(map, name)` for name-indexed reads, `setOwn(map, name, record)` for keyed writes"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
    - extensions/pi-claude-marketplace/edge/completions/data.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/marketplace/shared.test.ts
    - tests/orchestrators/plugin/shared.test.ts

key-decisions:
  - "The explicit-scope arm of the two target resolvers is one helper, `resolveExplicitScope(cwd, marketplace, requestedScope, presentInOther)`. Each caller passes its own predicate: a plugin row for the plugin resolver, a container for the marketplace resolver. The two-scope load of the unqualified forms is a second helper, `loadBothScopes(cwd)`. Without it, the remaining lines formed a new introduced clone group. No fallow-ignore marker was needed (D-08-08)."
  - "`edge-deps.ts` builds its projected marketplace map with `setOwn`. This keyed write is outside the plan's grep pattern, but it is a write into a marketplace map, so the D-08-07 conversion rule covers it."

patterns-established:
  - "`hasPluginRecord(state, marketplace, plugin)` is the own-key test for whether a plugin row exists in plugin/shared.ts"

requirements-completed: []

coverage:
  - id: D1
    description: "info constructor@mp renders the not-in-manifest row any absent plugin gets"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-08-07: info of a plugin named constructor renders the row of any absent plugin"
        status: pass
    human_judgment: false
  - id: D2
    description: "info x@constructor reports the marketplace as not added, no TypeError"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-08-07: info in a marketplace named constructor reports the marketplace as not added"
        status: pass
    human_judgment: false
  - id: D3
    description: "marketplace scope resolution and autoupdate classification treat constructor and toString as not recorded"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/shared.test.ts (three D-08-07 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "the three target resolvers treat constructor, toString and __proto__ as absent in both scopes"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/shared.test.ts (six D-08-07 cases under the resolver describes)"
        status: pass
    human_judgment: false
  - id: D5
    description: "fallow audit reports no introduced clone group in plugin/shared.ts"
    requirement: "DEBT-01"
    verification:
      - kind: other
        ref: "npx fallow audit --base $(git merge-base origin/main HEAD) --format json"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 15: Own-key front-door reads Summary

**Every command now resolves its target through own-key reads. This covers info, the scope fan-out, marketplace scope resolution, the three plugin and marketplace target resolvers, the edge state projection and the install completion read. `info constructor@mp` now prints the `{not in manifest}` row that any absent plugin gets. `info x@constructor` prints `{marketplace not added}` and no longer throws a TypeError. The explicit-scope arm that the two resolvers duplicated is now one module-private helper. The audit stays `pass`, and its inherited clone groups drop from 10 to 8.**

## Performance

- **Duration:** about 9 min (2026-10-10T05:23Z to 05:32Z)
- **Tasks:** 2/2
- **Files:** 9 modified

## Findings advanced

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| OWNKEY-01 (D-08-07, DEBT-04) | the front-door reads are converted. 08-16, 08-17 and 08-18 own the remaining sites, and 08-19 proves the sweep end to end | b7ef10e7, 150dc7df |
| plugin/shared.ts clone groups r11 and r14 (D-08-08, DEBT-01) | removed by extraction, with no marker and no `ignoredClones` key | 150dc7df |

## Task Commits

1. **Task 1 (tracer): info of a reserved name reads as absent, from the scope fan-out to the rendered row.** Commit `b7ef10e7` (`fix(info): read plugin and marketplace records by own key`). RED: both new info cases failed. The strong-mock UI expectation went unmet because info threw before it notified. All three marketplace/shared cases also failed. Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed, and gitlint Passed. Tracer gate: the verify block is automated only, and `human_verify_mode` is the default `end-of-phase`. I re-ran the verify, it passed, and I went on to Task 2.
2. **Task 2: plugin target resolution and the edge reads use own keys, with the explicit-scope arm extracted.** Commit `150dc7df` (`fix(scope): resolve plugin targets by own key`). RED: all six new resolver cases failed before the change. Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed, and gitlint Passed.

## Verify results (final lines)

- Task 1: `node --test tests/orchestrators/plugin/info.test.ts tests/orchestrators/scope-fanout.test.ts tests/orchestrators/marketplace/shared.test.ts` gave `ℹ tests 302`, `ℹ pass 302`, `ℹ fail 0`, exit 0. `npm run test:coverage:direct -- …/plugin/info.ts …/scope-fanout.ts …/marketplace/shared.ts` exited 0 with no shortfall.
- Task 2: `node --test tests/orchestrators/plugin/shared.test.ts tests/orchestrators/edge-deps.test.ts tests/edge/completions/data.test.ts tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/plugin/enable-disable.test.ts` gave `ℹ tests 441`, `ℹ pass 441`, `ℹ fail 0`, exit 0. `npm run test:coverage:direct -- …/plugin/shared.ts …/edge-deps.ts …/edge/completions/data.ts` exited 0 with no shortfall.
- Audit check (Task 2 verify): `verdict pass introduced 0`, with 8 inherited groups (10 at the start). The only remaining group in a touched file is the info.ts 2180-2194 / 2290-2304 group, which is inherited and has no planned edit.
- Acceptance greps: the bracket-read grep over all six files prints nothing. The `in …marketplaces` grep over marketplace/shared.ts prints nothing, and an `in …(marketplaces|plugins)` grep over all six files prints nothing too.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## Clone-group outcome

- With only `resolveExplicitScope` extracted, the audit read `warn`. It found 1 introduced group, `dup:c77b3abb6f87acd9-r2`, at plugin/shared.ts 333-343 / 980-989. That group was the helper call followed by the two-scope `locationsFor` plus `Promise.all(loadState…)` block.
- Moving that block into `loadBothScopes(cwd)` cleared it: `verdict pass introduced 0`. No `fallow-ignore` marker was added. The reviewed marker in edge/completions/data.ts moved down one line, because of the new import, and it still sits above the `for (const scope of scopes)` loop it covers.

## Deviations from Plan

**1. [Rule 3 - Blocking] A second helper, `loadBothScopes`, for the audit**
- **Found during:** Task 2 audit verify
- **Issue:** After the planned extraction, the leftover lines of the two resolvers formed a new introduced clone group, so the audit read `warn`.
- **Fix:** Both unqualified forms load their two scopes through `loadBothScopes(cwd)`. Every resolver outcome and key order is unchanged, and the existing resolver cases pass unchanged.
- **Commit:** 150dc7df

**2. [Rule 2 - Correctness] `setOwn` for the edge-deps projected map**
- **Found during:** Task 2
- **Issue:** `projected[name] = { plugins }` in `loadStateForScope` is a keyed write into a marketplace map. The plan's interface grep does not match it.
- **Fix:** It uses `setOwn`, following the D-08-07 conversion rule.
- **Commit:** 150dc7df

**3. [Rule 2 - Edge] Extra reserved-name cases**
- I added cases beyond the plan's behavior list. The marketplace resolver gets an explicit-scope `__proto__` case. `resolveInstalledPluginTarget` gets a `toString` / `__proto__` case. The cross-scope resolver gets a case for a marketplace named `constructor`. `classifyAutoupdateFlip` gets a `constructor` case. Together they cover the must-have that names all three resolvers and all three names.
- The plan's first resolver behavior ("`constructor` with `mp` in project scope resolves the project container") also passes on the old code, because project is checked first. So that case records a plugin named `constructor` in the user scope, under a project container that does not hold it. It resolves to `user`, and the old code wrongly answered `project`.

**Total deviations:** 3. **Impact:** the behavior matches the plan, and the added coverage is a superset of the plan's cases.

## Issues Encountered

- `info.test.ts` prints `Legacy marketplace migration could not be persisted … ENOENT … chown` on stderr in two existing `D-96-04` cases. The new D-08-07 cases print nothing when run alone. The message comes from existing cases that this plan does not touch, and the run still passes.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigations applied:
- T-08-32: `ownValue` returns undefined for inherited names. A reserved marketplace name therefore reads as not added in info, in the scope fan-out, in marketplace scope resolution and in the target resolvers. It no longer causes a TypeError on a function's missing `plugins` or `entry`.
- T-08-33: an inherited member never reads as an install record in info or in plugin target resolution.

## Notes for later plans

- 08-16 to 08-18: `hasPluginRecord`, `resolveExplicitScope` and `loadBothScopes` are module-private to plugin/shared.ts. Do not export them. If another module needs one, raise it with the planner first.
- `removePluginRecord` now writes through `setOwn`. Its `delete newPlugins[plugin]` stays, as the conversion rule says.

## Self-Check: PASSED

- All nine modified files exist.
- Commits b7ef10e7 and 150dc7df are ancestors of HEAD.
