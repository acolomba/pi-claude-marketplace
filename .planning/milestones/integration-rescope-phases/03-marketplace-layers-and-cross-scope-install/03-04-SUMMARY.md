---
phase: 03-marketplace-layers-and-cross-scope-install
plan: "04"
subsystem: testing
tags: [cucumber, cross-scope-install, integration-migration, red-proof]
status: complete
requires: []
provides:
  - "five url scenarios in features/plugin/cross-scope-install.feature for a project install that adds a user marketplace (WR-05/WR-07, MA-12, MA-13, D-MF-04, LAYER-07 dependency marketplace)"
  - "three marketplace checkout steps: the leftover-checkout Given (MA-12), the user-directory Given (MA-13), and the checkout-files Then"
  - "the deletion of test/integration/project-install-adds-user-marketplace.test.ts after breaks C1, C2, C3, C4, C6, and C8 failed its replacing scenarios"
affects: [features/plugin/cross-scope-install.feature, features/step_definitions/marketplace/checkout.steps.ts]
actuals:
  tokens: 8246
  tasks: 3
  commits: 3
plan_head_before: 792d2effb5602573522ac56ba22a60d430b0129a
plan_head_after: 1f2262a52df872f6d9a208e526605712bc5c0180
tech-stack:
  added: []
  patterns:
    - "a leftover-checkout Given that clones the run's bare repository, points origin at the url a user types, and writes the Q-01 ownership marker"
key-files:
  created:
    - .planning/phases/03-marketplace-layers-and-cross-scope-install/03-04-SUMMARY.md
  modified:
    - features/plugin/cross-scope-install.feature
    - features/step_definitions/marketplace/checkout.steps.ts
  deleted:
    - test/integration/project-install-adds-user-marketplace.test.ts
key-decisions:
  - "The D-MF-04 stale user clone is set up through the existing publishing steps (add to the user scope, then offer with dependencies, which pushes a new revision), with no new step"
requirements-completed: [ITMIG-06]
duration: 27min
completed: 2026-11-21
---

# Phase 3 Plan 04: Cross-scope install cases moved to cucumber Summary

Five url scenarios in `plugin/cross-scope-install.feature` now guard a project install that adds a user-scope marketplace to the project (WR-05/WR-07 no clone for an unlisted plugin, MA-12 leftover replaced, MA-13 user directory refused and kept, D-MF-04 dependencies from the fresh project checkout, LAYER-07 a dependency's url marketplace with a checkout in each scope). Six deliberate breaks failed them, and the existing LAYER-07 rows of `marketplace/remove.feature`. Then `project-install-adds-user-marketplace.test.ts` was deleted.

## Commits

| Task | Commit | Title |
|------|--------|-------|
| 1 | 8dc9463 | test(plugin): cover a project install over a leftover checkout |
| 2 | e2f596a | test(plugin): cover project installs that add a user marketplace |
| 3 | 1f2262a | test(plugin): delete the project-install test that scenarios cover |

The intentional deletion in 1f2262a is `test/integration/project-install-adds-user-marketplace.test.ts` (509 lines). No commit changes a file under `extensions/`.

## Red proofs

- Scratch folder: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase03-plan04` (`$D`). The helper `$D/break.sh` is a copy of `phase02-plan02/break.sh`. It takes its root from `git rev-parse --show-toplevel` (1 occurrence) and names no fixed checkout (0 occurrences of `/home/user/pi-claude-marketplace`). It refuses a dirty `extensions/` (exit 4), restores the file in an EXIT trap, and replaces the old text only when it occurs exactly once (exit 3 otherwise).
- Checkout root, the `root=` line of every break log: `/home/user/pi-claude-marketplace/.claude/worktrees/agent-aa2682f40a8ad2601`.
- Plan base (`$D/plan-base`): `792d2effb5602573522ac56ba22a60d430b0129a`. The plan's line numbers were read at 43b7a14. Every old text still occurred exactly once at the base, at the same lines: `install-outcome.ts:723`, `:727`, `:665-668`; `add.ts:1707`, `:1713`; `install-flow-cascade-context.ts:442`.
- Green, Task 1 (`$D/green-cross-1.log`): `6 scenarios (6 passed)`, `72 steps (72 passed)`, exit 0. The run was repeated after Prettier reformatted one line of the step module, with the same result.
- Green, Task 2 (`$D/green-cross-2.log`): `10 scenarios (10 passed)`, exit 0.
- Builtin (`$D/builtin.log`): `0 scenarios`, exit 0. No new scenario has an implementation tag (DUAL-02).
- No break run had a step timeout (`function timed out` appears in no log), and no break was rerun. After every break, `restored=clean` was logged and `git status --porcelain -- extensions/` printed nothing.

Each break was run with `bash "$D/break.sh" <id> adapter <file> "$D/<id>.old" "$D/<id>.new" features/plugin/cross-scope-install.feature`, plus `features/marketplace/remove.feature` for C8. Paths are under `extensions/pi-claude-marketplace/`. The old and new texts were copied from `research-03/brk/` and matched `<context>` byte for byte (`cat -A`).

- **C2, Task 1** (`$D/C2-tracer-adapter.log`): `orchestrators/marketplace/add.ts:1707`, `return cleanupStaging(removalOps, finalDir, "marketplace leftover clone");` became `throw new StaleSourceCloneError(finalDir, derivedName);`. Result: `6 scenarios (5 passed, 1 failed)`, exit 1. Failed: `cross-scope-install.feature:71`, the MA-12 scenario, at `Then the result has these fields:`: `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` (severity `error` instead of `info`, needs reload `false`, and an added `summary A plugin operation has failed.`). Passed: line 6 and the Outline rows 58, 59, 64, 69.
- **C1** (`$D/C1-adapter.log`): `orchestrators/plugin/install-outcome.ts:723`, `if (plugin !== undefined) {` became `if (plugin !== undefined && process.env.NEVER_SET === "x") {`. Result: `10 scenarios (9 passed, 1 failed)`, exit 1. Failed: `:99`, WR-05/WR-07, at `Then the git host receives no request`: `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`. The log held the GET `info/refs` and POST `git-upload-pack` requests, so the project cloned the marketplace before refusing. Passed: the other 9.
- **C2, Task 2** (`$D/C2-adapter.log`): the same change as above. Result: `10 scenarios (9 passed, 1 failed)`, exit 1. Failed: `:71`, MA-12, at `Then the result has these fields:`, with the same assertion error. Passed: the other 9.
- **C3** (`$D/C3-adapter.log`): `add.ts:1713-1717`, the `throw new StaleSourceCloneError(finalDir, derivedName);` inside `if (await pathExists(finalDir)) {` became `return cleanupStaging(removalOps, finalDir, "foreign tree");`. Result: `10 scenarios (9 passed, 1 failed)`, exit 1. Failed: `:121`, MA-13, at `Then the result has these fields:`: `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`. The install succeeded (`info`, `true`, no summary). Passed: the other 9.
- **C4** (`$D/C4-adapter.log`): `orchestrators/plugin/install-flow-cascade-context.ts:442`. The return became the seven-line `userFirst` wrapper, which returns the user scope's record when it has one, then `return { recordFor, lookup: catalogLookup(userFirst, locations, sink, resolvedKeys) };`. Result: `10 scenarios (9 passed, 1 failed)`, exit 1. Failed: `:145`, D-MF-04, at `Then the result lists these plugins:`: `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`. The `lib@tools` row was missing, because the walk read the user's older checkout. Passed: the other 9.
- **C6** (`$D/C6-adapter.log`): `install-outcome.ts:727`. Before `return addTargetScopeMarketplace(` it inserted `if (process.env.NEVER_SET === undefined) {`, `return source.sourceRecord;`, `}`, and an empty line. Result: `10 scenarios (1 passed, 9 failed)`, exit 1. Failed, each with `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`:
  - `:169`, LAYER-07/D-MF-04 dependency marketplace, at `Then the result has these fields:`
  - `:145`, D-MF-04, at `Then the result has these fields:`
  - `:121`, MA-13, at `Then the result lists these plugins:`
  - `:71`, MA-12, at `Then the result has these fields:`
  - `:6`, the dir dependency scenario, at `Then the result has these fields:`
  - the Outline rows `:58`, `:59`, `:64`, `:69`, at `Then the result has these fields:`

  Passed: only `:99`, WR-05/WR-07, which fails before the add.
- **C8** (`$D/C8-adapter.log`): `install-outcome.ts:665-668`. Before `  return targetRecord;` it inserted `  Object.assign(targetRecord, { marketplaceRoot: sourceRecord.marketplaceRoot, manifestPath: sourceRecord.manifestPath });`. The run covered `cross-scope-install.feature` (10 scenarios) and `remove.feature`, which this worktree held at 52 scenarios. Result: `62 scenarios (55 passed, 7 failed)`, exit 1. Failed, each with `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`:
  - `cross-scope-install.feature:145`, D-MF-04, at `Then the result lists these plugins:`
  - `remove.feature:724` and `:729`, "Removing a marketplace from the user scope keeps the plugins the project installed from it" (url, github), at `Then the result has these fields:`
  - `remove.feature:764` and `:769`, "... keeps the info of a plugin the project installed from it" (url, github), at `Then the result has these fields:`
  - `remove.feature:796` and `:801`, "... keeps the marketplace updatable in the project scope" (url, github), at `Then the result has these fields:`

  Passed: the other 55, the dir and file rows of those Outlines included.

## Case map

Lines refer to the integration file at the plan base, 792d2ef. They are the same as at 43b7a14.

| Case | Replaced by | Break |
|------|-------------|-------|
| `:214` "LAYER-07: a project keeps the marketplace its install added after a user-scope remove" | `marketplace/remove.feature` LAYER-07 Outlines at 695, 731, 771: rows 724/729, 764/769, 796/801 (url and github) | C8 |
| `:330` "LAYER-07 / WR-07: an install of a plugin the manifest does not list fails before the project clones the marketplace" | `cross-scope-install.feature:99` (WR-05, WR-07) | C1 |
| `:355` "MA-12: a project install replaces the extension's own leftover clone of the marketplace" | `cross-scope-install.feature:71` (MA-12) | C2 |
| `:386` "MA-13: a project install refuses a foreign tree where the marketplace clone goes and keeps it" | `cross-scope-install.feature:121` (MA-13) | C3 |
| `:416` "LAYER-07 / D-MF-04: a project install reads the dependencies of the plugin from the clone it installs from" | `cross-scope-install.feature:145` (D-MF-04) | C4, C8 |
| `:446` "LAYER-07: a project install adds the user-scope git marketplace of its dependency to the project" | `cross-scope-install.feature:169` (LAYER-07, D-MF-04); the dir version is `:6` | C6 |

## Checks

`node --version`: `v24.22.3`. Every check ran in this worktree, with the scripts under `$D` (the shell guard refuses the one-line forms).

| Check | Script | Exit | Commit it ran on |
|-------|--------|------|------------------|
| Task 1 green, adapter, 6 passed | `verify-t1-1.sh` | 0 | working tree over 792d2ef (run again after Prettier, then committed as 8dc9463) |
| C2 tracer detection | `verify-t1-2.sh` | 0 | working tree over 792d2ef |
| `npm run lint` warm-up | `lint-warm.sh` | 0 | working tree over 792d2ef |
| `check:static` (1) | `verify-t1-3.sh` | 1, then 0 | the first run failed `format:check` on one line of the step module; after `prettier --write`, the second run passed, on the tree committed as 8dc9463 |
| Task 1 diff scope | `verify-t1-4.sh` | 0 | 8dc9463 |
| Task 2 green, adapter, 10 passed | `verify-t2-1.sh` | 0 | working tree over 8dc9463 (committed as e2f596a) |
| C1, C2, C3, C4, C6 detections | `verify-t2-2.sh` | 0 | working tree over 8dc9463 |
| `check:static` (2) | `verify-t2-3.sh` | 0 | tree committed as e2f596a |
| Task 2 diff scope | `verify-t2-4.sh` | 0 | e2f596a |
| C8 detections | `verify-t3-1.sh` | 0 | e2f596a |
| `check:static` (3), without the file | `verify-t3-2.sh` | 0 | tree committed as 1f2262a |
| `fallow audit --base 792d2ef` | `verify-t3-3.sh` | 0 | 1f2262a |
| builtin, 0 scenarios | `verify-t3-4.sh` | 0 | 1f2262a |
| final (file gone, no references, no `extensions/` or `features/marketplace/` change, clean tree) | `verify-t3-5.sh` | 0 | 1f2262a |
| acceptance greps | `acceptance.sh` | all as expected | 1f2262a |

The acceptance greps printed: `(MA-12)$` 1, `(MA-13)$` 1, `(WR-05, WR-07)$` 1, `D-MF-04)$` 2. Each new step text appears once. The feature file has 0 removed lines since the base. The `extensions/` diff and status are empty. The three titles are 62, 64, and 66 characters long. `git grep -l 'project-install-adds-user-marketplace' -- . ':(exclude).planning'` listed only the file itself before the deletion and exits 1 after it. `pre-commit run --files` (with `SKIP=npm-check`) passed for both feature-file commits. Each commit ran under `flock` on `phase03-heavy.lock`.

## Issues for the milestone

- `fallow audit --base 792d2ef`: `verdict=warn`, `dead_code_issues 0`, `complexity_findings 0`, `duplication_clone_groups 0`. Its only diff-risk finding is `weakened-tests` on `test/integration/project-install-adds-user-marketplace.test.ts`, the deleted file. The user decided on 2026-11-21 to leave this to the milestone: no `.fallowrc.json` or CI change.

## Deviations from Plan

- **`check:static` (1) failed once on formatting.** The first `prettier --write` went through `npx --no prettier`. It printed the file to stdout and did not write it, so `format:check` failed on one long `.map(...)` line in the new Then. `node_modules/.bin/prettier --write` wrapped the line. `check:static` and the green run then both passed. The step's behavior did not change.
- **D-MF-04 setup (CONTEXT [Harness]).** The stale user clone comes from the existing publishing steps, as planned. The scenario adds `tools` to the user scope and then runs `the marketplace "tools" offers these plugins with dependencies:`, which pushes a new revision. No step was added for it.
- No expected value differed from the plan or the probe, and no scenario needed strengthening. Rule 4 was not triggered.
- The Then step also asserts that the checkout is a directory (`stat`), so a missing checkout fails the step, as `<context>` asks.
- The C04 dependency row is aligned (the probe had one misaligned cell). The values are the same.

## Parent lines

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- `features/plugin/cross-scope-install.feature`: FOUND (10 scenarios)
- `features/step_definitions/marketplace/checkout.steps.ts`: FOUND (three new steps)
- `test/integration/project-install-adds-user-marketplace.test.ts`: absent, as intended
- Commits 8dc9463, e2f596a, 1f2262a: FOUND in HEAD's history
