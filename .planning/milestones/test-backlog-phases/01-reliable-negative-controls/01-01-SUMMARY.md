---
phase: 01-reliable-negative-controls
plan: 01
subsystem: testing
tags: [node-26, spawnSync, subprocess, negative-controls, coverage]
requires: []
provides:
  - File-backed child output observation for strict negative CLI controls
  - Separate launch, signal, exit status, stdout, and stderr checks
  - Sandbox-safe Git base selection without an unused stdin pipe
affects: [direct-coverage, final-quality-gates]
tech-stack:
  added: []
  patterns:
    - Capture synchronous child output through separate temporary files when sandbox pipes lose data
    - Check launch, signal, exact status, and exact streams as separate process facts
key-files:
  created:
    - .planning/phases/01-reliable-negative-controls/01-01-SUMMARY.md
  modified:
    - scripts/test-coverage-direct.negative.mjs
    - scripts/test-coverage-direct.mjs
    - .planning/phases/01-reliable-negative-controls/01-01-PLAN.md
key-decisions:
  - "Use ordinary file descriptors under the existing temporary root for negative-control output."
  - "Keep stdout and stderr separate and require the complete expected diagnostic."
  - "Ignore Git child stdin because gitLines never supplies input; retain its stdout and stderr pipes."
patterns-established:
  - "Child-result contract: launch error, signal, status, stdout, and stderr are independent facts."
requirements-completed: [NEG-01, NEG-02]
coverage:
  - id: D1
    description: Negative CLI controls observe each exact intended rejection on Node 26.
    requirement: NEG-01
    verification:
      - kind: other
        ref: npm run test:coverage:direct:negative (sandbox and normal execution)
        status: pass
    human_judgment: false
  - id: D2
    description: Launch failures, signals, wrong status, and missing diagnostics cannot satisfy a negative control.
    requirement: NEG-02
    verification:
      - kind: other
        ref: scripts/test-coverage-direct.negative.mjs process-result controls
        status: pass
    human_judgment: false
duration: 14min
completed: 2026-09-14
status: complete
---

# Phase 1 Plan 1: Reliable negative controls summary

**Direct-coverage CLI controls now capture complete child output on Node 26 and reject the wrong failure mode.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-14T14:20:52Z
- **Completed:** 2026-09-14T14:34:21Z
- **Tasks:** 2
- **Files changed:** 4

## Accomplishments

- Replaced the affected CLI pipe capture with separate stdout and stderr files under the existing temporary root.
- Added controls for benign success, deliberate failure, missing executable, signal termination, wrong status, and missing diagnostic text.
- Made both real mapping refusals require status 1, empty stdout, and their complete stderr text.
- Removed the unused stdin pipe from `gitLines` while retaining its launch-error refusal and separate output pipes.

## Measured cause

The failure was in parent-side child observation under the process sandbox. It was not in the mapping refusal. On Node v26.8.2, a pipe-backed `spawnSync` child could run and return its real exit status while the result also carried `error.code === "EPERM"`. A failing Node child also returned empty stdout and stderr through that path.

The same child used ordinary stdout and stderr file descriptors under `/tmp`. It then returned no spawn error, the exact status, and both complete streams. The unchanged pipe form also worked outside the sandbox. The evidence isolates the problem to the sandbox and pipe combination. It does not establish a general Node defect or one denied kernel call.

The negative harness now avoids that path for commands whose bytes are the assertion. Temporary output files stay under `fixtureRoot`, and the existing top-level `finally` removes them. There is no stdout and stderr union.

## Similar subprocess assumptions

`fixtureGit` used the same implicit three-pipe form. It now uses the file-backed observer and checks launch errors, signals, and status before it reads output. The shallow `HEAD~1` refusal also moved to the observer. It now requires no launch error, no signal, status 128, empty stdout, and nonempty stderr. The stderr text is not exact because Git can localize that diagnostic.

`gitLines` was the remaining sandbox failure. Its call never sends stdin. Setting stdin to `ignore` removes the sandbox `EPERM` while leaving stdout and stderr as pipes. Its existing `run.error` and nonzero-status refusals remain unchanged. No other direct-coverage subprocess assumption required a change from the measured evidence.

## Verification

- `npm run test:coverage:direct:negative` passed in the sandbox on Node v26.8.2.
- `npm run test:coverage:direct:negative` passed outside the sandbox on Node v26.8.2.
- `node_modules/.bin/eslint scripts/test-coverage-direct.negative.mjs scripts/test-coverage-direct.mjs` passed.
- `node_modules/.bin/prettier --check scripts/test-coverage-direct.negative.mjs scripts/test-coverage-direct.mjs .planning/phases/01-reliable-negative-controls/01-01-PLAN.md` passed.
- The parent executor reported 6,003 of 6,003 unit tests passing outside the sandbox during this work.

No threshold, coverage pin, assertion string, or production test seam changed.

## Task commits

The parent executor owns staging and commits after the shared pre-commit checks.

## Deviations from plan

### Auto-fixed issues

**1. [Rule 1 - Bug] Removed the unused stdin pipe from `gitLines`**

- **Found during:** Task 1, while reviewing analogous subprocess assumptions
- **Issue:** The full sandbox run reached the Git selection controls, then `gitLines` reported `EPERM` for successful Git children.
- **Fix:** Set only child stdin to `ignore`. Keep stdout and stderr as pipes and keep the existing error checks.
- **Files modified:** `scripts/test-coverage-direct.mjs`, `01-01-PLAN.md`
- **Evidence:** The full negative suite passed inside and outside the sandbox.
- **Commit:** Pending parent executor commit

**Total deviations:** 1 auto-fixed bug.

## Issues encountered

`strace` was not installed, so no syscall-level claim is made. Direct comparison of pipe, inherited, and file-descriptor forms was enough to isolate the failing observation path and select a narrow repair.

## User setup required

None.

## Next phase readiness

NEG-01 and NEG-02 have passing automated evidence. The final phase can reuse this negative-control pattern without changing the 100% unit coverage policy.

## Self-check: PASSED

- All created and modified files exist.
- Both required commands passed in the measured environments.
- No stub, skipped test, unrun check, or new threat surface remains.

---

_Phase: 01-reliable-negative-controls_
_Completed: 2026-09-14_
