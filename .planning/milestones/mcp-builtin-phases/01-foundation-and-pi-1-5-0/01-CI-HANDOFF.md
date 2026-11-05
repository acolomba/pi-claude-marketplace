# Phase 1: CI measurement handoff (DUAL-03, D-CF1-16)

The plan 01-14 executor wrote this file. It has no GitHub tools, so it did not
push or dispatch CI. The parent session does the steps below after it merges
the executor's worktree. DUAL-03 stays unverified until the parent records a
successful run at the merged gate commit.

## What the local gate proved

- **Gate commit:** `f3ab832f52a3c98c43b56c5e3def436aba24f556`. On this commit,
  `npm run check` (run in its parts), `npm run test:modules`, and
  `npm run test:e2e` exited 0 on Node v24.22.1. The plan 01-14 SUMMARY has the
  table.
- **Later commits:** plan 01-14 then committed only planning Markdown
  (`.planning/**/*.md`). So the merged head has the same build inputs as the
  gate commit. Before you push, check this with
  `git diff f3ab832f52a3c98c43b56c5e3def436aba24f556 <merged head> -- . ':(exclude,glob).planning/**/*.md'`.
  This command must print nothing. If it prints a diff, run `npm run check`
  again on the merged head first (local-verification gates rule).
- **Local cucumber times** (4 CPUs, `parallel: 8`, one profile per call, the
  same paths as each CI leg):

| CI leg                 | Scenarios | Cucumber wall time | Seed   |
| ---------------------- | --------- | ------------------ | ------ |
| adapter lifecycle      | 1168      | 2 min 46 s         | 807146 |
| adapter components     | 390       | 4 min 25 s         | 816480 |
| builtin all            | 39        | 24 s               | 261084 |

## The three behavioral legs as ci.yml builds them

The `behavioral` job in `.github/workflows/ci.yml` has a matrix of three
`include` entries. Its name template is
`behavioral tests, ${{ matrix.profile }} ${{ matrix.shard }} (Node 24)`:

1. `behavioral tests, adapter lifecycle (Node 24)`: profile `adapter`, paths
   `features/marketplace features/plugin`.
2. `behavioral tests, adapter components (Node 24)`: profile `adapter`, paths
   `features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow`.
3. `behavioral tests, builtin all (Node 24)`: profile `builtin`, paths
   `features`.

Each leg runs
`npm run test:cucumber:profile -- --profile "$PROFILE" $SHARD_PATHS`, with
`fail-fast: false`.

**Current timeout:** `timeout-minutes: 15` for the whole `behavioral` job,
which applies to each matrix leg.

Plan 01-13 renamed these checks. If a branch protection rule names the old
check names (`behavioral tests, lifecycle (Node 24)` and
`behavioral tests, components (Node 24)`), it waits forever (P1-DC-36). Check
the required status checks before the pull request merges.

## Checklist for the parent session

1. Merge the plan 01-14 worktree into `features/mcp-builtin`. Run the
   build-input check above.
2. Push `features/mcp-builtin` (and its mirror branch, if you use one). Never
   force-push. Never push `main`.
3. Dispatch `ci.yml` on `features/mcp-builtin` through `workflow_dispatch`.
   CI has no `push` trigger for `features/**` branches.
4. Wait for the run to finish. Confirm that the run's head sha is the merged
   head, and that each of the three legs above concludes `success`.
   A leg that times out or fails does not count. If a leg flakes, rerun that
   job once and record both attempts.
5. For each leg, record two times from the job view (for example
   `gh run view <id> --json jobs`): the job's whole duration, and the
   duration of the step `Run the behavioral tests`.
6. Apply the timeout rule (D-CF1-16) to the slowest leg's whole job duration:
   - The slowest leg takes 10 minutes or less: keep `timeout-minutes: 15`.
   - The slowest leg takes more than 10 minutes: set `timeout-minutes` to
     the smallest whole minute that is at least 1.5 times that duration. The
     value is never below 15. For example, a leg of 10 min 40 s needs
     `ceil(1.5 * 10.67) = 16`.
   - `ci.yml` is frozen after Phase 1. If the timeout must go up, the parent
     makes that change on the milestone branch, as a parent line, before the
     child sessions start. Then it dispatches and measures again.
7. Amend the D-CF1-16 row in `.planning/PROJECT.md` Key Decisions (line
   1893 at the gate commit). The text to use is in the next section.
8. Fill the `## CI timings` section of `01-FROZEN.md` (this directory) with
   the run id, the date, the head sha, each leg's job and step durations, and
   the timeout you kept or raised.
9. Mark DUAL-03 verified only after steps 4 to 8 are done.

## The D-CF1-16 row to amend in PROJECT.md

The row starts with `| **D-CF1-16 (component-features, Phase 1, settled autonomously, DUBIOUS-CHOICES DC-01): the \`behavioral\` CI job installs the companions and runs as two path shards**.`

**Decision cell.** Replace the text through `fail-fast` with this text, which
adds the profile axis (DUAL-03). Keep the last sentence about serialization
(CI-01) as it is.

> **D-CF1-16 (component-features, Phase 1, settled autonomously,
> DUBIOUS-CHOICES DC-01; amended by mcp-builtin DUAL-03): the `behavioral` CI
> job installs the companions and runs three legs, one cucumber profile and
> one path shard per leg**. The adapter profile runs as two shards: the
> lifecycle shard runs `features/marketplace/**` and `features/plugin/**`, and
> the components shard runs the six function directories. The builtin profile
> runs as one shard of every feature file (`all`). Each leg's timeout is at
> least 1.5 times its measured run and never below 15 minutes. Each leg runs
> `npm run test:cucumber:profile` with its profile and paths, which installs
> the companions first. The profile and the paths reach the shell through
> `env:`, and `fail-fast` is off.

**Rationale cell.** Keep the 2026-11-01 sentence (CI run 41283935457). Add
after it one sentence in this form, with the measured values:

> Measured `<YYYY-MM-DD>` on a hosted runner after the mcp-builtin profile
> axis (CI run `<run id>`, head `<sha>`): adapter lifecycle job `<m min s s>`
> (cucumber `<m min s s>`, 1168 scenarios), adapter components job
> `<m min s s>` (cucumber `<m min s s>`, 390 scenarios), and builtin all job
> `<m min s s>` (cucumber `<m min s s>`, 39 scenarios), so `timeout-minutes`
> `<stays at 15 | is raised to N>`.

Also change the sentence "The parent re-measures after each component merge"
to "The parent re-measures after each phase merge, and Phase 6 re-measures
the combined tree", so it fits this milestone's merge procedure.

## Expected values (estimates, not measurements)

`01-RESEARCH.md` "CI (DUAL-03)" estimates the hosted times after Phase 1:
adapter lifecycle about 5.5 to 6 minutes, adapter components about 6 to 6.5
minutes, and builtin all about 1.5 to 2 minutes including setup. If the
estimates hold, every leg stays under 10 minutes and the timeout stays at 15.
Phases 2 to 5 add 60 to 100 MCP scenarios, so Phase 6 measures again.
