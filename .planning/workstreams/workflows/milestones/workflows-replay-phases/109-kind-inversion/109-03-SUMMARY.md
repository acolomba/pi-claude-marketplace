---
phase: 109-kind-inversion
plan: 03
subsystem: test fixture widening for the compile-forced componentPaths sites
tags: [inversion, fixtures, typecheck, tests]
status: complete

requires:
  - "109-02 (`componentPaths.workflows` as a required member on all three of its spellings)"
provides:
  - "every compile-forced `componentPaths` construction site under `tests/bridges/` and `tests/orchestrators/` carries the fourth key"
  - "a `npm run typecheck` whose only remaining errors are the 4 sites plan 109-04 owns"
  - "the widened `resolvedPlugin` helper signature in `tests/orchestrators/plugin/discover-names.test.ts`, and its five widened call arguments"
affects:
  - "109-04 (the 3 `catalog-uat` fixture payloads, `probe-classifiers.test.ts:269`, and the 8 compiler-invisible `deepStrictEqual` whole-arm payloads)"

tech-stack:
  added: []
  patterns:
    - "the compiler is the work list: widening a required field enumerates its own construction sites, exactly and exhaustively"
    - "widening a helper's PARAMETER type is a second-order edit — `tsc` reports the signature first and its call sites only after the signature is fixed"
    - "a fixture literal widens by gaining a key; the assertion form above it never changes"

key-files:
  created:
    - .planning/workstreams/workflows/phases/109-kind-inversion/109-03-SUMMARY.md
  modified:
    - tests/bridges/agents/stage.test.ts
    - tests/bridges/skills/stage.test.ts
    - tests/bridges/commands/stage.test.ts
    - tests/bridges/commands/discover.test.ts
    - tests/bridges/skills/discover.test.ts
    - tests/orchestrators/plugin/plugin-state-classifier.test.ts
    - tests/orchestrators/plugin/discover-names.test.ts
    - tests/orchestrators/plugin/shared.test.ts

key-decisions:
  - "The five `resolvedPlugin` call arguments in `discover-names.test.ts` were widened rather than the new parameter member being made optional. An optional member would have satisfied `tsc` while letting a call site keep constructing a plugin whose widened field is absent — a weakening, which the plan's prohibition forbids."
  - "Every widened site takes the empty array, including the two files whose sibling keys are non-empty (`agents: [\"agents\"]`, `skills: [skillsDirectory]`). No fixture starts claiming a workflows path it does not have."
  - "The whole-tree `npm run typecheck` is knowingly left red at 4 errors, all in the two files 109-04 owns. Closing them here would absorb another plan's scope."

requirements-completed: [WINV-01]

coverage:
  - deliverable: "All 68 compile-forced `componentPaths` sites carry the fourth key with an empty array"
    verification:
      - kind: command
        ref: "npm run typecheck 2>&1 | grep -E '\\): error TS' | grep -vE '^tests/(architecture/catalog-uat|shared/probe-classifiers)\\.test\\.ts' | wc -l -> 0"
        status: pass
      - kind: command
        ref: "grep -c 'workflows: \\[\\]' tests/bridges/agents/stage.test.ts -> 31; same for skills/stage.test.ts -> 29"
        status: pass
    human_judgment: false
  - deliverable: "`discover-names.test.ts` widened BOTH its readonly parameter type and its spread construction"
    verification:
      - kind: command
        ref: "grep -c 'readonly workflows' tests/orchestrators/plugin/discover-names.test.ts -> 1; grep -n 'workflows' -> lines 24, 32 plus the five call sites"
        status: pass
      - kind: test
        ref: "tests/orchestrators/plugin/discover-names.test.ts"
        status: pass
    human_judgment: false
  - deliverable: "All eight touched test files run green"
    verification:
      - kind: test
        ref: "node --test over all 8 files -> tests 210 / pass 210 / fail 0, exit 0"
        status: pass
    human_judgment: false
  - deliverable: "No assertion was loosened, no fixture literal merged or extracted, no test title changed"
    verification:
      - kind: command
        ref: "grep -c 'componentPaths: {' still 31 and 29 in the bulk files; git diff --stat shows 60 insertions / 60 deletions across them (no net line change)"
        status: pass
      - kind: command
        ref: "git diff --name-only b2e2d712~1..HEAD | grep -c '^extensions/' -> 0; grep -cE 'catalog-uat|probe-classifiers' -> 0"
        status: pass
    human_judgment: false

duration: 12 min
completed: 2026-09-04

actuals:
  tokens: 7200
  tasks: 2
  commits: 2
---

# Phase 109 Plan 03: Compile-forced componentPaths widening Summary

Every `componentPaths` object literal `tsc` could see gained the fourth key, holding an
empty array. The typecheck went from 131 errors to 4 — exactly the three `catalog-uat`
fixture payloads and `probe-classifiers.test.ts:269` that plan `109-04` owns.

**Duration:** 12 min (2026-09-04T23:35Z -> 2026-09-04T23:47Z)
**Tasks:** 2 of 2
**Files:** 8 modified, all under `tests/`
**Commits:** `b2e2d712`, `b09c647a`

## Accomplishments

- **The compiler was the work list, and it closed cleanly.** The baseline
  `npm run typecheck` reproduced `109-02-SUMMARY.md`'s enumeration byte for byte: 131
  errors over 10 files, 62 in `tests/bridges/agents/stage.test.ts` and 58 in
  `tests/bridges/skills/stage.test.ts`. After Task 1 those two files reported zero. After
  Task 2 the whole list was down to the 4 errors `109-04` owns.
- **The measured edit counts confirmed `109-PATTERNS.md` drift item D-2 a second time.**
  31 literal sites in the agents file and 29 in the skills file — not the 62 and 58 the
  error counts suggest, and not the "62 / 58" RESEARCH reports. Each literal produced one
  TS2741 and one TS2322.
- **Every widened site takes the empty array.** That holds even where a sibling key is
  non-empty for a stated reason (`agents: ["agents"]` throughout the agents file,
  `skills: [skillsDirectory]` throughout the skills file). No fixture silently began
  claiming a workflow path.
- **Key order follows each file's existing convention.** The two bulk files and the four
  other single-line literals order `skills, commands, agents`, so the new key lands last.
  `discover-names.test.ts` orders alphabetically, so it also lands last, in all seven of
  its positions.
- **No assertion form, key value, test title or comment changed.** `git diff --stat` on
  the two bulk files shows 60 insertions against 60 deletions with no net line change —
  each changed line is one widened literal. Neither file contains a `deepEqual` call, so
  the "no assertion loosened" criterion holds at 0 both before and after.
- **Nothing outside this plan's eight files moved.** `git diff --name-only` across both
  commits names zero paths under `extensions/` and neither of the two files `109-04` owns.

## Per-file site counts against the `<site_inventory>` table

| File | Inventory | Edited | Divergence |
|------|-----------|--------|-----------|
| `tests/bridges/agents/stage.test.ts` | 31 | 31 | — |
| `tests/bridges/skills/stage.test.ts` | 29 | 29 | — |
| `tests/orchestrators/plugin/plugin-state-classifier.test.ts` | 2 | 2 | — |
| `tests/orchestrators/plugin/discover-names.test.ts` | 2 | **7** | **+5 cascade — see below** |
| `tests/orchestrators/plugin/shared.test.ts` | 1 | 1 | — |
| `tests/bridges/skills/discover.test.ts` | 1 | 1 | — |
| `tests/bridges/commands/stage.test.ts` | 1 | 1 | — |
| `tests/bridges/commands/discover.test.ts` | 1 | 1 | — |
| **total** | **68** | **73** | **+5** |

The inventory was not stale and no literal was pre-widened by another plan. The single
divergence is a second-order effect the inventory could not have carried, recorded as a
deviation below.

## `npm run typecheck` progression

| Point | Errors | Files |
|-------|--------|-------|
| baseline (`109-02` HEAD) | 131 | 10 |
| after Task 1 | 11 | 8 |
| after the Task 2 widening, before the cascade | 9 | 3 |
| final | **4** | **2** — both owned by `109-04` |

The final four, verbatim:

```text
tests/architecture/catalog-uat.test.ts(919,27): error TS2322: Type '"workflows"' is not assignable to type 'ContentReason'.
tests/architecture/catalog-uat.test.ts(1227,27): error TS2322: Type '"workflows"' is not assignable to type 'ContentReason'.
tests/architecture/catalog-uat.test.ts(1331,27): error TS2322: Type '"workflows"' is not assignable to type 'ContentReason'.
tests/shared/probe-classifiers.test.ts(269,30): error TS2322: Type '"workflows"' is not assignable to type 'UnsupportedReason'.
```

## What a green typecheck here does NOT mean

The plan's own warning, restated so a later reader does not misread this SUMMARY as
closing the phase's widening: **eight further `componentPaths` payloads are invisible to
`tsc`.** They sit as the second argument to `assert.deepStrictEqual`, which the compiler
types as `unknown` (5 in `tests/domain/resolver.test.ts`, 1 in
`tests/orchestrators/plugin/install.test.ts`, 2 in
`tests/orchestrators/plugin/git-source-probe.test.ts`). They compile clean and fail only
under `npm test`, each reporting a diff whose sole content is the added empty key. They
belong to `109-04` and were deliberately not touched here. `npm test` over the whole tree
is still red.

## Deviations from Plan

### 1. [Rule 3 - Blocker] The widened parameter type in `discover-names.test.ts` cascaded to five call sites

- **Found during:** Task 2
- **Issue:** the plan and `109-PATTERNS.md` D-3 both name `discover-names.test.ts` as a
  TWO-site file: the `readonly` parameter type at lines 20-24 and the spread construction
  at 27-31. Both are correct, and both were widened. What neither could carry is that
  widening the parameter type makes the helper's own callers red — `tsc` cannot report a
  call-site mismatch against a signature that does not yet demand the key. Fixing the two
  named sites produced five NEW `TS2345` errors at lines 76, 97, 120, 150 and 177, each
  reading `Argument of type '{ agents: ...; commands: ...; skills: ...; }' is not
  assignable`.
- **Fix:** widened all five `resolvedPlugin(pluginRoot, { ... })` call arguments with
  `workflows: []`, alphabetically last, matching the file's convention. The alternative —
  declaring the new parameter member optional — was rejected: it would satisfy `tsc` while
  letting a call site construct a plugin whose widened field is absent, which is the
  weakening the plan's prohibition forbids.
- **Files modified:** `tests/orchestrators/plugin/discover-names.test.ts`
- **Verification:** `npm run typecheck` errors outside the two `109-04` files -> `0`;
  `node --test tests/orchestrators/plugin/discover-names.test.ts` green
- **Commit:** `b09c647a`

### 2. [Rule 1 - Bug] Task 2 acceptance criterion `grep -c 'workflows' discover-names.test.ts` cannot print 2

- **Found during:** Task 2 acceptance verification
- **Issue:** the criterion expects exactly `2` occurrences, "the readonly parameter member
  and the spread line". Closing the five cascade sites above makes it `7`. The criterion
  and the plan's own `<success_criteria>` line ("`npm run typecheck` reports errors only in
  the two files plan `109-04` owns") are in direct conflict; only one can hold.
- **Fix:** the typecheck criterion wins — it is the plan's primary gate, it is what
  `<verification>` runs, and satisfying the grep instead would mean leaving five compile
  errors in a file this plan owns. The narrower criterion that isolates the two NAMED sites
  is satisfied exactly: `grep -c 'readonly workflows'` prints `1`, and
  `grep -n 'workflows'` reports line 24 (the parameter member) and line 32 (the spread)
  ahead of the five call sites.
- **Files modified:** none beyond deviation 1
- **Verification:** `grep -c 'readonly workflows'` -> `1`; `grep -n 'workflows'` -> lines
  24, 32, 80, 102, 126, 157, 185
- **Commit:** `b09c647a`

### 3. [Rule 3 - Blocker] The whole-tree `npm run typecheck` is left red at 4 errors

- **Found during:** both tasks
- **Issue:** `.pre-commit-config.yaml` runs `npm-typecheck` over the whole project and
  `npm-fallow` with `always_run: true`. Task 1's commit necessarily lands while Task 2's
  files are still red, and the final tree still carries the 4 errors the plan assigns to
  `109-04` and forbids fixing here.
- **Fix:** the commits were made with the red whole-tree typecheck recorded rather than by
  absorbing another plan's scope or suppressing a hook. `--no-verify` was never used and
  `SKIP=` was never extended past `trufflehog`. The `trufflehog` skip is the structural
  worktree case CLAUDE.md §Git prescribes, and it was taken only after a
  `trufflehog filesystem` scan over the changed paths came back clean
  (`verified_secrets: 0, unverified_secrets: 0`, exit 0) on both commits. Every other gate
  was run per-commit and is green: `npx prettier --check` (clean) and
  `npx eslint --max-warnings=0` (exit 0) over the changed files. No `pre-commit` hook is
  installed in the shared git dir, so no commit was made by bypassing a failing hook.
- **Files modified:** none
- **Verification:** errors outside the two `109-04` files -> `0`; the remaining 4 are
  enumerated above
- **Commit:** n/a

**Total deviations:** 3 (2 x Rule 3 blockers, 1 x Rule 1 conflicting acceptance command).
**Impact:** none on the deliverable. No gate was weakened, no assertion loosened, and no
scope was absorbed from `109-04`.

## Authentication Gates

None.

## Known Stubs

None. No placeholder, no `TODO`, and no hardcoded value that flows to a rendered surface.
The empty arrays are the correct fixture value: these plugins genuinely carry no workflows
directory.

## Threat Flags

None. T-109-08 is satisfied as written — all 73 widened sites take the empty array, so no
fixture began claiming a component path it does not have, and no red assertion was repaired
by weakening it. This plan changed no production byte, so T-109-01 cannot be reopened here.

## Issues Encountered

The whole-tree `npm run typecheck` (4 errors) and `npm test` (the 8 invisible
`deepStrictEqual` payloads) stay red until `109-04` lands. That is by plan design, is
enumerated above, and is not a defect. Nothing else.

## Next Phase Readiness

Ready for `109-04`, which owns the 3 `catalog-uat` fixture `message` payloads,
`probe-classifiers.test.ts:269`, and the 8 compiler-invisible `deepStrictEqual` whole-arm
payloads across `tests/domain/resolver.test.ts` (5),
`tests/orchestrators/plugin/install.test.ts` (1) and
`tests/orchestrators/plugin/git-source-probe.test.ts` (2). After it lands, both
`npm run typecheck` and `npm test` should be green for the first time since `109-01`.

## Self-Check: PASSED

- `.planning/workstreams/workflows/phases/109-kind-inversion/109-03-SUMMARY.md` -- FOUND
- All 8 modified files present -- FOUND
- `b2e2d712 test(109-03): widen componentPaths fixtures in the two bulk stage tests` -- FOUND
- `b09c647a test(109-03): widen the six single-site componentPaths fixtures` -- FOUND
- `npm run typecheck` errors outside the two `109-04` files: `0` -- PASS
- `node --test` over all 8 files: `tests 210 / pass 210 / fail 0`, exit 0 -- PASS
- Files touched under `extensions/`: `0` -- PASS
- `tests/architecture/catalog-uat.test.ts` and `tests/shared/probe-classifiers.test.ts` unchanged -- PASS
- `grep -c 'componentPaths: {'` still `31` / `29` in the bulk files -- PASS
