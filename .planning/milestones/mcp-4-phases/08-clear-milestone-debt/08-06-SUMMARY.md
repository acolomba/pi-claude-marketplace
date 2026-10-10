---
phase: 08-clear-milestone-debt
plan: 06
subsystem: fallow, live-uat
tags: [fallow, clone-markers, live-uat, d-08-08, adet-02]

requires: []
provides:
  - "One reviewed `fallow-ignore-next-line code-duplication` marker hides the live-UAT canary spawn-and-timeout clone group, and both drivers carry a written justification (D-08-08, P1 IN-06)"
  - "One reviewed marker in `bridges/agents/stage.ts` hides the agents and skills TR-06 rename-loop clone group (D-08-08)"
  - "CONVENTIONS.md and STACK.md record no `ignoredClones` entry and 22 `fallow-ignore` markers, 10 of them `code-duplication`"
  - "The stop, manifest-absence and workflow-storage canary Pi mocks define `getCommands` (P1 IN-02, ADET-02)"
  - "The OpenAI stub server exits 1 on a server error and destroys the response on a request stream error (P1 IN-07)"
affects: [08-21 ledger plan (P1 IN-02, IN-06, IN-07 closed here; r3 and r6 now marked)]

actuals:
  tokens: 3200
  tasks: 2
  commits: 2
plan_head_before: 858f1171d164afb2ba7846120cc0dba8a868c12a
plan_head_after: eda89fc059637d5bfe5ca9cdf6212999e0d1e3a0

tech-stack:
  added: []
  patterns:
    - "When the first line of a clone span carries an `eslint-disable-next-line` directive, put the fallow marker above a later line inside the span. A marker above the directive does not hide the group."

key-files:
  created: []
  modified:
    - tests/live-uat/stop-canary.mjs
    - tests/live-uat/manifest-absence-canary.mjs
    - tests/live-uat/workflow-storage-canary.mjs
    - tests/live-uat/openai-stub-server.mjs
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/STACK.md

key-decisions:
  - "The agents and skills rollback marker sits above the `throw` in the else-if arm (stage.ts:517), not above the first span line. That line has an `eslint-disable-next-line no-await-in-loop` directive directly above it. A fallow marker above the directive did not hide the group in the audit (measured on fallow 3.31.0), and a marker between the directive and its line would break the directive."

patterns-established: []

requirements-completed: []

duration: 7min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 06: Reviewed clone markers and live-UAT driver fixes Summary

**Two reviewed `fallow-ignore-next-line code-duplication` markers hide the inherited canary spawn-and-timeout clone and the agents and skills TR-06 rename-loop clone. The audit now reports 10 inherited groups, down from 12, with verdict `pass` and 0 introduced. CONVENTIONS.md and STACK.md describe the real suppression set: no `ignoredClones` entry, and 22 markers. Three canary Pi mocks now define `getCommands`, and the OpenAI stub fails loudly on its own errors.**

## Performance

- **Duration:** about 7 min (2026-10-10T03:55Z to 04:02Z)
- **Tasks:** 2/2
- **Files modified:** 7

## Findings closed

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| P1 IN-06 | fixed: both canary drivers justify the spawn-and-timeout block, and one reviewed marker hides the group. CONVENTIONS.md no longer claims `ignoredClones` holds `dup:cc950b18:2`, and STACK.md no longer claims a pre-approved ID | 5d8d0c8f |
| P1 IN-02 | fixed: `getCommands: () => []` beside `getAllTools` in the stop, manifest-absence and workflow-storage canary mocks | eda89fc0 |
| P1 IN-07 | fixed: `server.on("error", …)` prints `openai-stub: <message>` and exits 1. `req.on("error", …)` destroys the response | eda89fc0 |

## Markers (D-08-08)

| Audit group at the start | Span at the start | Marker |
| ------------------------- | ----------------- | ------ |
| canary spawn-and-timeout (`-r2` in this audit, r3 in RESEARCH) | `manifest-absence-canary.mjs:631-648` / `stop-canary.mjs:485-506` | `tests/live-uat/manifest-absence-canary.mjs:636`, directly above `const run = await new Promise(` |
| agents and skills TR-06 rename loop (`-r5` in this audit, r6 in RESEARCH) | `bridges/agents/stage.ts:514-523` / `bridges/skills/stage.ts:563-572` | `extensions/pi-claude-marketplace/bridges/agents/stage.ts:517`, above the `throw` inside the span |

`rg -n "fallow-ignore" extensions tests scripts` prints 22 lines, and 10 of them are `code-duplication`. `.fallowrc.json` has no `duplicates.ignoredClones` key.

## Task Commits

1. **Task 1: Mark the two reviewed inherited clone groups and make the suppression record true.** Commit `5d8d0c8f` (chore). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed.
2. **Task 2: The canary mocks list commands, and the OpenAI stub reports its own errors.** Commit `eda89fc0` (test). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed.

## Verify results (final lines)

- Task 1, audit check: `verdict pass groups-here 0 total 10 introduced 0`, exit 0. At the start: verdict `pass`, 12 groups, 0 introduced.
- Task 1, marker count: `rg` gives 22 lines, CONVENTIONS.md states `exactly **22**`, and both drivers pass `node --check`. Exit 0.
- Task 1 acceptance: one `code-duplication` marker across the two canary files. `grep ignoredClones .planning/codebase/STACK.md` prints only line 51, which says there is no entry. The `.fallowrc.json` `Object.hasOwn` check exits 0.
- Task 2: all four drivers pass `node --check`, and the five required lines are present. Exit 0. After Task 2 the audit check still gives `verdict pass groups-here 0 total 10 introduced 0`.
- Smoke test: the stub, started on a port that was already bound, exited `status 1` with stderr `openai-stub: listen EADDRINUSE: address already in use 127.0.0.1:<port>`.
- `npx fallow dupes`: 31 groups, down from 32. The canary group is gone. Run without the marker, `fallow dupes` did not report the agents and skills group (it numbers and hashes groups differently from the audit), so the audit is the measure for that group.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## Deviations from Plan

**1. [Rule 3 - Blocking] The agents marker cannot sit directly above the first span line**
- **Found during:** Task 1
- **Issue:** The plan puts the marker on the line directly above the first line inside the span (`stage.ts:514`). That line already has `// eslint-disable-next-line no-await-in-loop` directly above it. A marker between the two would break the eslint directive. I tested a marker above the directive: the audit still listed the group, with its span shifted to 515-524.
- **Fix:** The marker sits above the `throw new Error(...)` in the else-if arm. That line is inside the span, and the audit then dropped the group (11 groups during the test, 10 with both markers). The marker's reason says why it sits there, and CONVENTIONS.md records the placement.
- **Files modified:** extensions/pi-claude-marketplace/bridges/agents/stage.ts, .planning/codebase/CONVENTIONS.md
- **Commit:** 5d8d0c8f

**2. Out of scope, not fixed: three commands/skills groups in `fallow dupes`**
- Plan step 5 expects no group with an instance in `bridges/skills/stage.ts`. The audit meets this. The whole-tree `fallow dupes` report still lists three commands-and-skills stage groups (`commands/stage.ts:179-205` / `skills/stage.ts:251-272`, `468-485` / `574-591`, `294-307` / `408-418`). They were in the control run before any edit, the audit does not list them, and they are not r3 or r6.

**3. Requirements not marked complete**
- DEBT-01 and DEBT-02 cover the whole phase. Plan 08-21 owns the phase-wide verdicts.

**Total deviations:** 1 auto-fixed (Rule 3). **Impact:** one marker sits at a different line of the same group. The suppressed set is the same.

## Known Stubs

None. The `getCommands: () => []` entries are test doubles in operator-run drivers, not production stubs.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigations:
- T-08-15: each new marker carries a reviewed reason and sits inside one reviewed group. The audit drops exactly those two groups (12 to 10), and the CONVENTIONS count matches `rg` (22).
- T-08-16 (accepted): the stub's server error handler prints only `error.message`.

## Next

Ready for 08-07.

## Self-Check: PASSED

- All seven modified files exist.
- Commits 5d8d0c8f and eda89fc0 are ancestors of HEAD.
