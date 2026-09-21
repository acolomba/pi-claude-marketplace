---
phase: 08-final-verification-and-reconciliation
plan: "01"
subsystem: testing
tags: [coverage, lcov, istanbul, fallow, pre-commit, trufflehog, node-test, measurement]

# Dependency graph
requires:
  - phase: 07-reliable-coverage-metrics
    provides: the verified unit coverage bundle, `coverage:risk` policy 30 and 07-MEASUREMENT.md as the shape to copy
provides:
  - 08-MEASUREMENT.md sections 1 to 7: every gate run fresh at the phase HEAD with its exit captured directly
  - The fresh certified bundle `20260919T002923698Z-2c0f1c43` recounted independently at 100% native lines, functions and branches
  - The one red (TruffleHog under `pre-commit run --all-files`) classified as environment with the `SKIP=trufflehog` control
  - The diff-backed statement that no code, test, script or gate configuration changed since `0844c2a7`
affects: [08-02 item reconciliation, phase 8 verification, milestone close]

# Actuals (#2632) -- same estimateTokens scale as the plan's estimate (chars/4 over the realized diff)
actuals:
  tokens: 4931
  tasks: 3
  commits: 3
plan_head_before: 1e25b80bf474ceea0adebd307e901400c572eee1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One process per gate member with `rc=$?` on the command itself and output redirected to a log, never a pipe"
    - "Detached sequential runner (`setsid nohup`) plus a polling loop for gates that exceed the 10-minute tool ceiling"
    - "Independent recount of the published bundle (LCOV sums and map counters) compared with `acceptance.denominators`"

key-files:
  created:
    - .planning/phases/08-final-verification-and-reconciliation/08-MEASUREMENT.md
  modified: []

key-decisions:
  - "The per-task pre-commit gate is `SKIP=trufflehog pre-commit run --files <path>` exit 0, because TruffleHog cannot open a worktree's `.git` file and CLAUDE.md already prescribes the skip for worktree commits"
  - "The orchestrator's uncommitted STATE.md tracking write and its `.planning/milestone.lock` are recorded in section 1 as present and left unstaged, alongside the four per-machine edits"
  - "The prior research session's logs in the same scratchpad were moved to `gates/prior-research/` before the sweep so every quoted figure comes from this run's logs"

patterns-established:
  - "Measurement record shape: preconditions table, per-member exit rows, additional-gate rows with a classification cell, denominators kept apart by model, comparison table with a verdict per row, one classified row per red, nothing-loosened statement with its diff"

requirements-completed: [FINAL-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "All sixteen `npm run check` members ran as their own process at the phase HEAD, each exit 0, recorded in 08-MEASUREMENT.md section 2 in `check` order"
    requirement: FINAL-01
    verification:
      - kind: other
        ref: "scratchpad gates/SUMMARY.txt: sixteen `cmd='npm run <member>' exit=0 seconds=<s>` lines"
        status: pass
      - kind: other
        ref: "grep -cE '^\\| ([1-9]|1[0-6]) \\| `npm run [a-z:-]+` \\| 0 \\| [0-9]+ \\|' 08-MEASUREMENT.md == 16"
        status: pass
    human_judgment: false
  - id: D2
    description: "The three additional gates (`test:e2e` 14/14, `test:coverage:direct:all` 239 pairs with the two pinned shortfalls matched exactly, `pre-commit run --all-files`) recorded with exits and classifications in section 3"
    requirement: FINAL-01
    verification:
      - kind: e2e
        ref: "npm run test:e2e -> tests 14 / pass 14 / fail 0, exit 0"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct:all -> exit 0, `2 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly.`"
        status: pass
      - kind: other
        ref: "pre-commit run --all-files -> exit 1 (TruffleHog only, environment); SKIP=trufflehog pre-commit run trufflehog --all-files -> Skipped, exit 0; status diff exit=0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Aggregate unit production coverage is 100% native lines, functions and branches on the run's own validated bundle, recounted independently and equal to the manifest and to Phase 7"
    requirement: FINAL-01
    verification:
      - kind: other
        ref: "npm run coverage:validate -> exit 0, `Coverage bundle verified: 20260919T002923698Z-2c0f1c43`"
        status: pass
      - kind: other
        ref: "LCOV recount -> {rec:230, LF:63825, LH:63825, FNF:1890, FNH:1890, BRF:9234, BRH:9234, zeroEntries:0} RECOUNT PASS"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nothing was loosened: the code tree and every gate configuration are byte-identical to `0844c2a7`, the direct pin holds its two rows, `maxCrap: 0` and policy 30 unchanged"
    requirement: FINAL-01
    verification:
      - kind: other
        ref: "git diff --quiet 0844c2a7 HEAD -- extensions tests scripts package.json package-lock.json .fallowrc.json eslint.config.js sonar-project.properties .pre-commit-config.yaml -> exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: 56 min
completed: 2026-09-19
status: complete
---

# Phase 8 Plan 01: Final gate measurement at the phase HEAD Summary

**Every required gate re-run at HEAD `1e25b80b` as its own process: sixteen chain members exit 0 (1290 s), e2e 14/14, direct all-pairs 239 pairs with the pin matched, and the fresh bundle `20260919T002923698Z-2c0f1c43` recounted at native 63825/63825, 1890/1890, 9234/9234; the one red is TruffleHog in a worktree, classified environment.**

## Performance

- **Duration:** 56 min
- **Started:** 2026-09-19T00:18:33Z (dispatch)
- **Completed:** 2026-09-19T01:14:43Z
- **Tasks:** 3
- **Files modified:** 1 (created)

## Accomplishments

- Sixteen `check` members ran as separate `npm run <member>` processes through a sequential runner with `rc=$?` on the command; all exit 0; chain total 1290 s (Phase 7: 1287 s).
- The three additional gates ran with exits captured directly: `test:e2e` exit 0 (14/14, network reachable), `test:coverage:direct:all` exit 0 (239 pairs, two pinned shortfalls matched exactly), `pre-commit run --all-files` exit 1 with TruffleHog the only failed hook and no file rewritten.
- The published bundle (`runId` `20260919T002923698Z-2c0f1c43`, manifest digest `e4324bf7acb84520`) was recounted independently from `coverage/unit.lcov` and `coverage/unit.istanbul.json`: equal to `acceptance.denominators` and equal to every Phase 7 certified denominator (six `equal` verdicts, zero `differs`).
- The 21 syntax deficits and the CRAP histogram (1394 / 377 / 88 / 6 / 0, max 20.00 at `plugin-browser.ts:108 statusTag`, one partial function at 16/17) are identical to Phase 7.
- Section 7 proves nothing was loosened: `git diff --quiet 0844c2a7 HEAD -- <code and gate configuration>` exits 0; only `.planning/**` changed since the last code commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: One gate member end to end (`npm run typecheck`), sections 1 and 2 row 1** - `595de7fe` (docs)
2. **Task 2: Members 2 to 16 and the three additional gates, sections 2 and 3** - `3f5bea97` (docs)
3. **Task 3: Independent recount and sections 4 to 7** - `11af41d7` (docs)

## Files Created/Modified

- `.planning/phases/08-final-verification-and-reconciliation/08-MEASUREMENT.md` - the phase-8 measurement record, sections 1 to 7 (section 8 is written by plan 08-02)

## Gate evidence (verbatim runner summaries)

`gates/SUMMARY.txt`:

```text
cmd='npm run typecheck' exit=0 seconds=38
cmd='npm run lint' exit=0 seconds=163
cmd='npm run lint:workflows' exit=0 seconds=1
cmd='npm run lint:workflows:negative' exit=0 seconds=0
cmd='npm run fallow' exit=0 seconds=5
cmd='npm run format:check' exit=0 seconds=48
cmd='npm run test:corresponding' exit=0 seconds=2
cmd='npm run test:corresponding:negative' exit=0 seconds=1
cmd='npm run test:coverage:direct:negative' exit=0 seconds=4
cmd='npm run test:coverage:unit' exit=0 seconds=443
cmd='npm run coverage:unit:negative' exit=0 seconds=18
cmd='npm run coverage:risk' exit=0 seconds=12
cmd='npm run coverage:risk:negative' exit=0 seconds=35
cmd='npm run test:integration' exit=0 seconds=14
cmd='npm run lint:type-members' exit=0 seconds=85
cmd='npm run lint:type-members:negative' exit=0 seconds=421
```

`gates/EXTRA-SUMMARY.txt`:

```text
cmd='npm run test:e2e' exit=0 seconds=8
cmd='npm run test:coverage:direct:all' exit=0 seconds=490
cmd='pre-commit run --all-files' exit=1 seconds=840
```

Fresh `runId`: `20260919T002923698Z-2c0f1c43` (research run was `20260918T225947291Z-f055e502`; manifest digest `e4324bf7acb84520` against the research `39a577cc3a087653`).

Recount output: `{"rec":230,"LF":63825,"LH":63825,"FNF":1890,"FNH":1890,"BRF":9234,"BRH":9234,"zeroEntries":0}` `RECOUNT PASS`. Map recount: 239 files, functions 1865/1865, statements 10392/10393, arms 6633/6653.

Red: `pre-commit run --all-files` exit 1, TruffleHog `failed to read index file: open .../.git/index: not a directory`, classified **environment** (worktree `.git` file). Control `SKIP=trufflehog pre-commit run trufflehog --all-files` printed `Skipped`, exit 0. Zero regressions.

## Decisions Made

- The per-task pre-commit gate runs as `SKIP=trufflehog pre-commit run --files <path>`. A bare `pre-commit run --files` exits 1 in this worktree on TruffleHog alone, the same environment failure section 6 classifies, and CLAUDE.md line 17 already prescribes the skip for worktree commits. Every other hook passed and no hook rewrote the file (digest identical before and after).
- Section 1 records six `git status --short` lines, not four: the four per-machine edits the plan names plus ` M .planning/STATE.md` (the orchestrator's execution-start tracking write) and `?? .planning/milestone.lock` (the orchestrator's advisory phase claim). None was staged by the task commits.
- The scratchpad `gates/` directory already held the research session's logs; they were moved to `gates/prior-research/` before the sweep so the live directory holds only this run's evidence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-commit gate form in a worktree**
- **Found during:** Task 1 (first commit)
- **Issue:** The plan's `pre-commit run --files <path>; echo "exit=$?"` cannot print `exit=0` here: TruffleHog fails on the worktree `.git` file regardless of the files passed.
- **Fix:** Ran the gate as `SKIP=trufflehog pre-commit run --files <path>` (exit 0, all other hooks Passed, file digest unchanged), which is the form CLAUDE.md prescribes for worktree commits. No hook configuration changed.
- **Files modified:** none
- **Verification:** `exit=0` and identical sha256 before/after on each of the three commits
- **Committed in:** n/a (process, not content)

**2. [Rule 3 - Blocking] Two extra `git status --short` lines**
- **Found during:** Task 1 (precondition inventory)
- **Issue:** The acceptance criterion expects exactly four status lines; the tree also shows ` M .planning/STATE.md` (orchestrator tracking write) and `?? .planning/milestone.lock` (orchestrator lock).
- **Fix:** Recorded both in section 1 as present and unstaged. Neither was staged, stashed or reverted. STATE.md is folded into the plan metadata commit per the sequential-mode protocol; the lock is never touched.
- **Files modified:** none by the task commits
- **Verification:** `git status --short` after each task commit shows the same six lines and nothing else
- **Committed in:** n/a

---

**Total deviations:** 2 auto-fixed (2 blocking, both process-level)
**Impact on plan:** No content deviation. Every figure comes from this run; no gate, threshold, pin or hook configuration was changed.

## Issues Encountered

- The `fallow-ignore` marker count is 10 textual matches (7 live markers, 3 string literals in planted test fixtures) against the 11 recorded in `.planning/codebase/CONVENTIONS.md` on 2026-08-18. The difference predates this phase (the code tree is byte-identical to `0844c2a7`) and is recorded in section 7, not changed.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 08-02: the measurement record's sections 1 to 7 are committed; section 8 (item reconciliation) is 08-02's to write.
- The certified bundle and `coverage/` artifacts remain on disk (gitignored) for 08-02's `coverage:validate` sampling.

---
*Phase: 08-final-verification-and-reconciliation*
*Completed: 2026-09-19*

## Self-Check: PASSED
