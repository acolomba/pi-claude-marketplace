# Phase 6: CI measurement handoff (DUAL-03, D-CF1-16, D-P6-16, D-P6-25)

The plan 06-12 executor wrote this file. It has no GitHub tools, so it did not
push or dispatch CI. The parent session does the steps below after it merges
the executor's worktree. The CI part of ROADMAP Phase 6 criterion 3 and the
DUAL-03 re-measure on the combined tree stay unverified until the parent
records a successful run.

## What the local gate proved

- **Gate commit:** `a7f73bf828f3fef77c55eaf4743e1ae220d0e291` (the wave 4
  base; the gate needed no fix, so no product commit sits on top of it). On
  this commit, every part of `npm run check` (run in its CI parts, in check's
  order, with the ESLint cache deleted first) and `npm run test:modules`
  exited 0 on Node v24.22.1, after `npm ci --ignore-scripts`. The plan 06-12
  SUMMARY has the table (`## Gate record`).
- **e2e:** both recorded parts of CI's `e2e-tests` job passed here:
  `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts` (exit 0) and
  `npm run test:e2e` (exit 0, installed runtime and peer floor both Pi
  1.5.0). No e2e part is deferred as network-unavailable. Still confirm that
  the CI run's `pinned e2e tests (Node 24)` job concludes `success`.
- **Later commits:** plan 06-12 then committed only planning Markdown (this
  file and its SUMMARY). Plan 06-13 commits the root dubious-choices log, its
  archive move, `01-FROZEN.md`, and `06-PARENT-LINES.md`, all
  `.planning/**/*.md`. So the head you push has the same build inputs as the
  gate commit. Before you push, check this with
  `git diff a7f73bf828f3fef77c55eaf4743e1ae220d0e291 <head> -- . ':(exclude,glob).planning/**/*.md'`.
  This command must print nothing. If it prints a diff, run `npm run check`
  again on the head first (local-verification gates rule).
- **Local cucumber times** (4 CPUs, `parallel: 8`, one profile per call, the
  same paths as each CI leg, on the gate commit):

| CI leg             | Scenarios | Steps | Cucumber wall time | Part wall time | Seed   |
| ------------------ | --------- | ----- | ------------------ | -------------- | ------ |
| adapter lifecycle  | 1168      | 12026 | 2 min 24 s         | 146 s          | 639458 |
| adapter components | 435       | 5371  | 4 min 14 s         | 256 s          | 958366 |
| builtin all        | 133       | 1681  | 1 min 6 s          | 69 s           | 68105  |

The adapter profile ran 1168 + 435 = 1603 scenarios and the builtin profile
133, the same totals as the parent's post-merge `npm run check` on 715e869
(adapter 1603/1603, builtin 133/133). Since the 2026-11-04 CI measurement
(head 8d03f4e), the components leg gained 45 scenarios (390 to 435) and the
builtin leg 94 (39 to 133).

## The three behavioral legs as ci.yml builds them

The `behavioral` job in `.github/workflows/ci.yml` (line 130) has a matrix of
three `include` entries. Its name template is
`behavioral tests, ${{ matrix.profile }} ${{ matrix.shard }} (Node 24)`:

1. `behavioral tests, adapter lifecycle (Node 24)`: profile `adapter`, paths
   `features/marketplace features/plugin`.
2. `behavioral tests, adapter components (Node 24)`: profile `adapter`, paths
   `features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow`.
3. `behavioral tests, builtin all (Node 24)`: profile `builtin`, paths
   `features`.

Each leg runs
`npm run test:cucumber:profile -- --profile "$PROFILE" $SHARD_PATHS` in the
step `Run the behavioral tests`, with `fail-fast: false`.

**Current timeout:** `timeout-minutes: 15` (ci.yml line 133) for the whole
`behavioral` job, which applies to each matrix leg.

## Checklist for the parent session

1. Merge the plan 06-12 worktree (and, after it, plan 06-13's) into
   `features/mcp-builtin`. Run the build-input check above.
2. Push `features/mcp-builtin`. Never force-push. Never push `main`.
3. Dispatch `ci.yml` on `features/mcp-builtin` through `workflow_dispatch`.
   CI has no `push` trigger for `features/**` branches.
4. Wait for the run to finish. Confirm that the run's head sha is the pushed
   head, and that each of the three legs above and `pinned e2e tests (Node 24)`
   conclude `success`. A leg that times out or fails does not count. If a job
   flakes, rerun that job once and record both attempts.
5. For each leg, record two times from the job view
   (`gh run view <id> --json jobs`): the job's whole duration, and the
   duration of the step `Run the behavioral tests`.
6. Apply the timeout rule below to each leg's whole job duration.
7. Amend the D-CF1-16 row in `.planning/PROJECT.md` Key Decisions (line 1936
   at the gate commit) with the sentence in the next section.
8. Fill the `## CI timings` section at the end of this file with the run id,
   the date, the head sha, each leg's job and step durations, and the timeout
   you kept or raised.
9. Mark the CI part of criterion 3 and the DUAL-03 re-measure verified only
   after steps 4 to 8 are done.

## The timeout rule (D-CF1-16, applied by D-P6-25)

Each behavioral leg's timeout stays at least 1.5 times its measured job
duration. This is D-CF1-16's recorded rule, which D-P6-25 applies in place of
D-P6-16's 80% rule. The floor is the 15 minutes that ci.yml's
`timeout-minutes: 15` sets today: the parent raises it when the 1.5-times rule
needs more and never lowers it.

- Every leg takes 10 minutes or less: keep `timeout-minutes: 15`.
- A leg takes more than 10 minutes: set `timeout-minutes` to the smallest
  whole minute at or above 1.5 times the slowest leg's job duration. For
  example, a leg of 10 min 40 s needs `ceil(1.5 * 10.67) = 16`.

The local times above suggest every leg stays well under 10 minutes on a
hosted runner (the 2026-11-04 run took 3 min 24 s, 4 min 8 s, and 1 min 19 s
per job, with the local components leg at a similar wall time then), but only
the CI run decides.

## The D-CF1-16 sentence to add in PROJECT.md

The row starts with
`| **D-CF1-16 (component-features, Phase 1, settled autonomously, DUBIOUS-CHOICES DC-01; amended by mcp-builtin DUAL-03)`.
The decision cell stays as it is. In the rationale cell, keep the 2026-11-01
and 2026-11-04 sentences, and add this sentence after the 2026-11-04 one, with
the measured values:

> Measured `<YYYY-MM-DD>` on a hosted runner on the combined mcp-builtin tree
> (CI run `<run id>`, head `<sha>`): adapter lifecycle job `<m min s s>`
> (cucumber step `<m min s s>`, 1168 scenarios), adapter components job
> `<m min s s>` (cucumber step `<m min s s>`, 435 scenarios), and builtin all
> job `<m min s s>` (cucumber step `<m min s s>`, 133 scenarios), so
> `timeout-minutes` `<stays at 15 | is raised to N>`.

Then the sentence "The parent re-measures after each phase merge, and Phase 6
re-measures the combined tree" can read "The parent re-measures after each
milestone that adds behavioral scenarios", since this run is Phase 6's
measurement. That wording change is optional.

## Known flakes

Rerun a failing job once and record both attempts. Any other failure is real.

- `features/mcp-server/lifecycle.feature` "A new session offers the plugin's
  tool again (BLT-01)" failed once under the adapter profile under load (seed
  115524, P3-DC-111). Plan 06-05 lifted it to `@mcp`, so it now runs in the
  adapter components leg and in the builtin all leg. It did not fail in this
  gate.
- A TUI readiness timeout when `/tmp/jiti` is cold (P6-PRE-02), seen at
  `features/marketplace/background-update.feature:192` "A readable config
  layer lets the TUI update an official marketplace", in the adapter
  lifecycle leg. It did not fail in this gate.

## Required status checks (P1-DC-36)

Plan 01-13 renamed the behavioral checks to the three names above. If a branch
protection rule still names the old checks (`behavioral tests, lifecycle (Node 24)`
and `behavioral tests, components (Node 24)`), the pull request waits on them
forever. Check the required status checks before the pull request merges.

## Status

Criterion 3's CI part and DUAL-03's re-measure on the combined tree stay
unverified until the parent records a successful run in `## CI timings`.

## CI timings

- **Run:** CI run 41960058038 (`workflow_dispatch` on `features/mcp-builtin`), 2026-11-05, head `1bec91e2120360b1d8a4c3d10e11fd0012ffa7f3`. Its build inputs are those of the gate commit `a7f73bf` (the diff outside `.planning/**/*.md` is empty). Conclusion: `success`, run attempt 1, all 9 jobs `success`, no rerun.

| Job | Job duration | Step `Run the behavioral tests` | Scenarios |
| --- | --- | --- | --- |
| behavioral tests, adapter lifecycle (Node 24) | 3 min 17 s | 2 min 19 s | 1168 |
| behavioral tests, adapter components (Node 24) | 4 min 35 s | 3 min 52 s | 435 |
| behavioral tests, builtin all (Node 24) | 2 min 56 s | 1 min 54 s | 133 |
| pinned e2e tests (Node 24) | 57 s | (Run pinned e2e tests: 12 s) | - |

- **Timeout:** every leg takes 10 minutes or less (slowest 4 min 35 s; 1.5 times is 6 min 53 s), so `timeout-minutes: 15` stays (D-CF1-16 as applied by D-P6-25).
- **D-CF1-16:** the PROJECT.md row gains the 2026-11-05 measurement sentence.
- **Status:** criterion 3's CI part and DUAL-03's re-measure on the combined tree are verified.

- **Re-run after the code-review fixes:** CI run 41967152313 (`workflow_dispatch`, 2026-11-05, head `2b6f2f4c42a46eca539c4451a60cc66f661a2d2b`, build inputs of `71a37c4`). Attempt 1: 8 of 9 jobs `success`; `behavioral tests, adapter components (Node 24)` failed one scenario of 435, "A new session offers the plugin's tool again (BLT-01)" (`features/mcp-server/lifecycle.feature:392`, seed 944382), where pi-mcp-adapter had not listed the stub's tool yet: the known adapter flake P3-DC-111. Attempt 2 re-ran only that job: `success`. Conclusion: `success`.

| Job | Attempt | Job duration | Step `Run the behavioral tests` |
| --- | --- | --- | --- |
| behavioral tests, adapter lifecycle (Node 24) | 1 | 3 min 36 s | 2 min 35 s |
| behavioral tests, adapter components (Node 24) | 1 (failed, flake) | 4 min 33 s | 3 min 49 s |
| behavioral tests, adapter components (Node 24) | 2 | 4 min 30 s | 3 min 46 s |
| behavioral tests, builtin all (Node 24) | 1 | 2 min 23 s | 1 min 28 s |

- **Timeout:** every leg is still under 10 minutes, so `timeout-minutes: 15` stays.
