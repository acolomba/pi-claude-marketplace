---
phase: 01-pi-1-0-floor-and-adapter-only-detection
plan: 02
subsystem: testing
tags: [tests, strict-mocks, soft-dep-probe, strong-mock]

requires:
  - phase: 01-pi-1-0-floor-and-adapter-only-detection
    provides: "Pi 1.0 installed and the shared Pi ToolInfo seed (plan 01-01)"
provides:
  - "expectSoftDepProbes(pi, probes, tools = []) in tests/edge/notification-boundary.ts, the one statement of how many Pi reads one softDepStatus(pi) snapshot makes"
  - "createNotificationBoundary(emissions, probes, cwd?) and tests/index.test.ts loadExtension(emissions, probes, cwd?) sized in snapshots"
  - "The catalog double and the 21 direct strict Pi expectations in 17 suites routed through the helper"
affects: [01-05, 01-06, 01-08, notification-boundary, catalog-uat]

actuals:
  tokens: 14520
  tasks: 2
  commits: 1
plan_head_before: b2964dd6702bd845310420069585224bf4a58f87
plan_head_after: 76e622e311227ac46aa16fa9938a4a8a8b2faaae

tech-stack:
  added: []
  patterns:
    - "Strict Pi doubles state soft-dependency snapshots (probes), never raw getAllTools() reads"
    - "A probe count of 0 states no expectation, because strong-mock times(0) is no limit"

key-files:
  created: []
  modified:
    - tests/edge/notification-boundary.ts
    - tests/architecture/catalog-uat/mock-pi.ts
    - tests/index.test.ts
    - tests/edge/handlers/plugin/install.test.ts
    - tests/edge/handlers/marketplace/update.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/import/execute.test.ts

key-decisions:
  - "Non-literal probe expressions keep their shape divided by three (expectedNotifications, expectations.length, expectedNotifications === 2 ? 1 : expectedNotifications), as the specification commit did"
  - "register.test.ts keeps its expectedNotifications > 0 guard around the helper call, so the change stays surgical"

patterns-established:
  - "Plan 01-05 adds the getCommands() read by editing expectSoftDepProbes alone"

# ADET-02 is shared with plans 01-05, 01-06 and 01-08, which deliver the detection
# change itself. This plan is preparation only, so it completes no requirement.
requirements-completed: []

coverage:
  - id: D1
    description: "expectSoftDepProbes states getAllTools() .times(probes * 3) for probes > 0 and nothing at 0; it is the only getAllTools() expectation left in tests/"
    requirement: ADET-02
    verification:
      - kind: other
        ref: "rg -n 'when\\(\\(\\) => [A-Za-z.]*getAllTools\\(\\)\\)' tests --glob '!tests/live-uat/**' (one line, inside expectSoftDepProbes)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The catalog double and the 21 direct expectations in 17 suites state probes through the helper; the 18 suites pass"
    requirement: ADET-02
    verification:
      - kind: unit
        ref: "npm run typecheck && node --test <the 18 Task 1 suites> (tmp/p02-t1-verify.log, 899/899 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "createNotificationBoundary and loadExtension take probes; the 255 non-zero literal arguments divide by three; toolProbes is gone from tests/"
    requirement: ADET-02
    verification:
      - kind: unit
        ref: "npm run test:modules, npm run test:architecture, node --test tests/integration/marketplace-add-seed-mirrors.test.ts (pass counts equal to baseline)"
        status: pass
    human_judgment: false

duration: 37min
completed: 2026-10-02
status: complete
---

# Phase 1 Plan 02: Soft-dependency probes in one helper Summary

**Every strict Pi double in `tests/` now states `softDepStatus(pi)` snapshots through one
helper, `expectSoftDepProbes(pi, probes, tools)`. That helper is the only place that turns a
snapshot into `getAllTools()` reads (three per snapshot). The adapter-detection change can add
its `getCommands()` read by editing one function. Test behavior is unchanged: the three suites
report the same pass counts before and after.**

## Performance

- **Duration:** about 37 min, including the full pre-commit run (about 20 min)
- **Started:** 2026-10-02T17:04:54Z
- **Completed:** 2026-10-02T17:41:22Z
- **Tasks:** 2
- **Files modified:** 46 (all under `tests/`; no production code)
- **Node:** v26.10.0

## Accomplishments

- `tests/edge/notification-boundary.ts` exports `expectSoftDepProbes`. For `probes > 0` it
  states `when(() => pi.getAllTools()).thenReturn(tools).times(probes * 3)`. At 0 it states
  nothing, because strong-mock's `times(0)` is no limit.
- `createNotificationBoundary(emissions, probes, cwd?)` routes its Pi expectation through the
  helper. The file header and the function JSDoc are restated in snapshot units. The D-116-06
  `cwd` paragraph is kept.
- The catalog double (`makePi`) states one probe. The 21 direct expectations in the 17 suites
  of the specification set state probes. Each count is the old read count divided by three.
- The 436 `createNotificationBoundary` / `loadExtension` call sites were converted by a
  one-off script. It changed 255 non-zero integer literals and failed on any literal that is
  not a multiple of three; none was found. Three non-literal sites were edited by hand:
  `loadExtension`'s pass-through in `tests/index.test.ts`, the `toolProbes` rows in
  `tests/edge/handlers/plugin/install.test.ts` (renamed `probes`; 3, 3, 6, 6 became 1, 1, 2,
  2), and the `probes` rows in `tests/edge/handlers/marketplace/update.test.ts` (3, 6 became
  1, 2).
- Suite prose that counted tool-list reads now counts probes. This covers comment blocks in
  12 edge handler suites, `operations.test.ts`, `execute.test.ts`, and the catalog
  `verifyPi` doc.

## Task Commits

The plan makes one code commit (Tasks 1 and 2 together, as the plan specifies):

1. **Tasks 1-2: state soft-dependency probes in one helper** - `76e622e3` (test:
   `test: state soft-dependency probes in one helper`)

**Plan metadata:** the docs commit that follows it (SUMMARY, STATE, ROADMAP, state.json).

## Verification Evidence

Focused task verification passed. The full phase and PR verification are still pending. The
pre-commit run selected full scope, because shared test support changed.

### Before/after pass counts

| Suite | Baseline (`tmp/p02-before-*.log`) | After (`tmp/p02-after-*.log`) |
| --- | --- | --- |
| `npm run test:modules` | pass 7788, fail 0, skipped 0, EXIT=0 | pass 7788, fail 0, skipped 0, EXIT=0 |
| `npm run test:architecture` | pass 460, fail 0, skipped 0, EXIT=0 | pass 460, fail 0, skipped 0, EXIT=0 |
| `node --test tests/integration/marketplace-add-seed-mirrors.test.ts` | pass 6, fail 0, skipped 0, EXIT=0 | pass 6, fail 0, skipped 0, EXIT=0 |

- Task 1 verify (`npm run typecheck && node --test` over the 18 suites): `T1_EXIT=0`, 899/899
  pass (`tmp/p02-t1-verify.log`). The tracer gate re-ran this verify before Task 2 started.
- Task 2 verify: `npm run typecheck` (`TC_EXIT=0`) plus the three after-logs above.
- `npm run format`: `FORMAT_EXIT=0`. It changed no file outside the plan's `files_modified`
  list. The changed set equals that list exactly (46 paths).
- Pre-commit (`TMPDIR=/var/tmp/mcp4-exec SKIP=trufflehog pre-commit run --files <46 test
  paths + tracking files>`, log `tmp/p02-precommit.log`): `PRECOMMIT_EXIT=0`. The
  `npm changed checks` hook ran full scope (`npm run check:changed -- --list` reports
  `"scope": "full"`, reason: shared inputs). `fallow audit --gate-marker agent`: verdict
  `pass`.

### Acceptance checks

- `rg -n "toolProbes" tests`: no output.
- `rg -n "when\(\(\) => [A-Za-z.]*getAllTools\(\)\)" tests --glob '!tests/live-uat/**'`: one
  line, `tests/edge/notification-boundary.ts:66`, inside `expectSoftDepProbes`.
- `rg -n "expectSoftDepProbes\(pi, 1" tests/architecture/catalog-uat/mock-pi.ts`: the `makePi`
  line (60).
- `rg -n "anyTimes|It\.isAny" tests/edge/notification-boundary.ts
  tests/architecture/catalog-uat/mock-pi.ts`: no output.

### Call-site census (measured before conversion)

The count includes `loadExtension` calls in `tests/index.test.ts`. The plan's census counted
`createNotificationBoundary` calls only (416).

| Second argument | Calls |
| --- | --- |
| `0` (unchanged) | 178 |
| `3` -> `1` | 205 |
| `6` -> `2` | 47 |
| `9` -> `3` | 2 |
| `12` -> `4` | 1 |
| non-literal (hand-edited) | 3 |

## Files Created/Modified

- `tests/edge/notification-boundary.ts` - `expectSoftDepProbes`; `createNotificationBoundary`
  takes `probes`; header and JSDoc restated in snapshots (WR-08)
- `tests/architecture/catalog-uat/mock-pi.ts` - `makePi` states one probe; `verifyPi` doc
- 17 suites of the direct-expectation set (`tests/shared/notify-context.test.ts`,
  `tests/edge/register.test.ts`, `tests/integration/marketplace-add-seed-mirrors.test.ts`,
  `tests/edge/handlers/plugin/browse.test.ts`,
  `tests/architecture/notify-producer-wire-coverage.test.ts`, six
  `tests/orchestrators/marketplace/*` suites and six `tests/orchestrators/plugin/*` suites) -
  direct expectations replaced by the helper
- `tests/index.test.ts` and 26 boundary-calling suites - probe arguments divided by three,
  prose restated

## Decisions Made

- Non-literal expectations keep their expression form divided by three, as the specification
  commit `20e2bb16` did. Examples: `expectedNotifications`, `expectations.length`, and
  `expectedNotifications === 2 ? 1 : expectedNotifications` in
  `tests/orchestrators/marketplace/add.test.ts`. A literal was not possible there.
- `tests/edge/register.test.ts` keeps its `if (expectedNotifications > 0)` guard around the
  helper call. The helper's own zero check makes it redundant, but removing it was not needed.
- The install-handler comment on the opt-out case (RESV-06) no longer states "the boundary
  expects 6". It now says the boundary states two probes and the helper states their reads.
- Several stale comments said "reads the tool list twice", left over from the two-target probe.
  They are now restated in probes, so they no longer state any read count.

## Deviations from Plan

None - plan executed exactly as written.

The plan text calls the `tests/edge/handlers/marketplace/update.test.ts` site "the loose
`(1, 4)` cap that becomes `(1, 2)`". In this tree the site is a row table with `probes: 3`
and `probes: 6`. These became 1 and 2, which matches the specification diff for the same
lines. This is a wording difference in the plan, not a code deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-05 can add the `pi.getCommands()` read to every snapshot by editing
  `expectSoftDepProbes` alone.
- ADET-02 stays pending in REQUIREMENTS.md. Plans 01-05, 01-06 and 01-08 deliver it.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-03 (strict doubles loosened): the helper states exact `times()`, the `anyTimes` /
`It.isAny` grep is empty, and the before/after pass counts are equal.

## Self-Check: PASSED

- `tests/edge/notification-boundary.ts` exports `expectSoftDepProbes` (FOUND).
- Code commit `76e622e3` exists, and it is HEAD~1 of the docs commit.
