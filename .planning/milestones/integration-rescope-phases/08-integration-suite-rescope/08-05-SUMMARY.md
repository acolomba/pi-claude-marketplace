---
phase: 08-integration-suite-rescope
plan: "05"
subsystem: testing
tags: [docs, hooks, integration-tests, gate]
status: complete

requires:
  - phase: 08-integration-suite-rescope
    provides: "Plans 08-01 to 08-04, the 08 review fixes, and the completed Phase 6.1 on the combined tree"
provides:
  - "The read-in-source wording of the fork boundary claim in docs/hooks-compatibility.md"
  - "The ITSCOPE-04 gate record: npm run check on the combined tree at b9c0a04"
affects: [integration-rescope, milestone-audit]

actuals:
  tokens: 1331
  tasks: 2
  commits: 1
plan_head_before: a7b9febf0e14c5464a2f3e332714ad8a0bcd95b2
plan_head_after: b9c0a041164d69e04c94f7478c7202844879b63a

tech-stack:
  added: []
  patterns:
    - "A doc claim taken from a peer's source says so and names the function it was read in"

key-files:
  created:
    - .planning/phases/08-integration-suite-rescope/08-05-SUMMARY.md
  modified:
    - docs/hooks-compatibility.md

key-decisions:
  - "Orchestrator decision: the combined-tree counts are those of the review-fixed tree, 236 integration cases and 10 charter items, not the planner's 265 and 9"

patterns-established: []

requirements-completed: [ITSCOPE-01, ITSCOPE-02, ITSCOPE-03, ITSCOPE-04]

duration: 24min
completed: 2026-11-23
---

# Phase 8 Plan 05: Fork Boundary Claim and Final Gate Summary

**The hooks doc now says that pi-subagents 0.88.1 puts a fork's boundary in its task message, that this was read in its source (`registerSubagentPromptBoundary`), and that no step reads the prompt. `npm run check` passed on the combined tree at `b9c0a04`: both cucumber profiles were green and every pair had 100% direct coverage.**

All logs and scripts named below are in
`/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase08-plan05/` (`$D`).

## Gate

- Tree: `b9c0a041164d69e04c94f7478c7202844879b63a`, the committed combined tree. `git status --porcelain` printed nothing (`gate-pre.log`).
- Node: `v24.22.3`.
- Lock: both commands ran under `flock -w 3600 "$S/phase07-heavy.lock"`, with `npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144` and the default cucumber workers.
- Each command ran with the tool's background option. I waited for its completion notification.

The five steps of `npm run check` ran in order as two commands:

1. **Main gate** (`gate-main.sh`, log `check-main.log`): `check:static && test:unpaired && test:integration && test:cucumber`, with `$D/bin` (`fd` -> `/usr/bin/fdfind`) first on `PATH`.
   - Exit line: `main_exit=0`. The verify returned 0.
   - `check:static` passed lines:
     - `passed typecheck (38.6 s)`
     - `passed lint (168.1 s)`
     - `passed lint:workflows (0.4 s)`
     - `passed fallow (9.4 s)`
     - `passed format:check (53.6 s)`
     - `passed test:corresponding (3.5 s)`
     - `passed check:features (10.4 s)`
   - `test:unpaired` and `test:integration` print nothing on a local pass (quiet reporter). The chain continued, so both exited 0.
   - Cucumber, adapter profile: `2285 scenarios (2285 passed)`, `28676 steps (28676 passed)`, `16 hooks (16 passed)`.
   - Cucumber, builtin profile: `260 scenarios (260 passed)`, `3576 steps (3576 passed)`, `16 hooks (16 passed)`.
   - No count line has failed, undefined, ambiguous, or pending scenarios. No failure line was printed.
2. **Coverage gate** (`gate-cov.sh`, log `check-cov.log`): `test:coverage:direct:all` under `env -i HOME PATH LANG=C.UTF-8 TMPDIR=/tmp`, the minimal environment that STATE.md's container facts require.
   - Exit line: `cov_exit=0`. The verify returned 0.
   - `Merged LCOV: coverage/direct.lcov (376 records)`.
   - The log's only other line is the IL-3 `console.warn` for a legacy-migration save failure, which a unit case triggers on purpose.

There was no rerun: no step failed, and no step timed out.

## ITSCOPE checks

| Check | Script / log | Result |
| --- | --- | --- |
| Doc edits check against the plan base `a7b9feb` | `verify-t1-1.sh`, `edits-check.log` | exit 0: `ok docs/hooks-compatibility.md`, `EDITS CHECK OK`; `docs/` clean |
| 28 files, path line, and `(ITSCOPE-01)` in the first 20 lines; the convergence, cascade, and SessionStart buffer files absent | `verify-t1-2.sh` | exit 0, no `BAD` line |
| Helper importers | `verify-t1-3.sh` | exit 0, no `orphan:` line; `optional-peer.ts` reads `optional-peer-suite-versions.json`; `expansion-cases.ts"` is imported under `test/integration` |
| Integration suite (`CI=1`) | `verify-t1-4.sh`, `integration.log` | `ℹ tests 236`, `ℹ pass 236`, `ℹ fail 0`, `exit=0`. The verify's literal 265 failed; see Deviations |
| Charter in three places | `verify-t1-5.sh`, then `charter-diag.sh`, `charter-equality.log` | The verify printed `rules=10 same=false` only because it requires 9 items. The diagnostic printed `rules=10 same-text=true`: the three copies are word for word the same |
| Planner pair `test/orchestrators/reconcile/plan.test.ts` | `charter-diag.sh`, `plan-test.log` | `ℹ tests 71`, `ℹ pass 71`, `ℹ fail 0`, `plan_exit=0` |
| Task 2 file set: only `docs/hooks-compatibility.md` changed since the plan base outside `.planning/`; no tracked change left | `verify-t2-files.sh` | exit 0 |

- Doc commit: `b9c0a04` `docs(hooks): mark the fork boundary claim as read in source` (59 characters).
- The full pre-commit hook ran on the commit. mdformat, markdownlint-cli2, texthooks, and gitlint passed. No fixer changed the file, and `check:commit` was skipped because no build input was staged.
- Acceptance greps:
  - The old sentence: count 0.
  - The new sentence: count 1.
- I read the cited source in pi-subagents 0.88.1, `src/runs/shared/subagent-prompt-runtime.js`. `registerSubagentPromptBoundary` returns on `config.forkCacheKey` before it hooks `before_agent_start`, and its comment says that a fork's boundary "goes in its task message instead".

## Phase audit

This plan's own audit, `fallow audit --base a7b9feb` (`audit-plan.sh`, `audit.json`):

- `verdict=pass`, 1 changed file.
- `dead_code_issues` 0, `complexity_findings` 0, `duplication_clone_groups` 0, no diff-risk finding.
- The verify returned 0.

The phase-wide audit, `fallow audit --base 9aa92a1` (`audit-phase.sh`, `audit-phase.json`):

- `audit_phase_exit=0`, `verdict=warn`.
- 88 changed files, head `b9c0a04`, fallow 3.44.0.
- Dead code 0, complexity 0 (2,105 functions analyzed), clone groups 0, `diff_risk_introduced` 1.
- Every finding:

| Rule | Kind | Path | Evidence | Belongs to |
| --- | --- | --- | --- | --- |
| `weakened-tests` | `assertion-drop` | `test/integration/standalone-prune.test.ts` | assertions: 16 -> 14 | Phase 8 (08-03 whole-object prune assertion) |

The plan expected six `weakened-tests` findings from Phase 8, and the audit reported only one:

- `reconcile-plan-convergence` and `transaction-lifecycle-cascade` are deleted files, and fallow reported no finding for them.
- `load-reconcile-race`, `subagent-hook-ownership`, and `workflow-kind-inversion` are not flagged on the review-fixed tree.

No finding comes from Phase 6.1's commits. The `standalone-prune` finding stays for the milestone PR review, as the user decided on 2026-11-21. Neither `.fallowrc.json` nor CI changes.

## Deviations from Plan

1. **Orchestrator decision: the counts of the review-fixed tree.**
   - **Integration count.** The planner measured 265 integration cases and 9 charter items before the phase's review fixes. The combined tree has 236 cases. The integration verify and the charter verify therefore failed on their literal counts while every case passed.
   - **I stopped and reported.** As the plan's count rule says, I reported `git diff --stat 9aa92a1 HEAD -- test/integration/` (`integration-diffstat.log`: 25 files, 262 insertions, 1399 deletions).
   - **The cause, confirmed by the orchestrator.**
     - `7d76c64` "test(mcp): move written-as-is builtin rows to the unit pair" (review fix WR-01) moved 28 table-driven rows of `mcp-builtin-encoding-conformance.test.ts` to `test/bridges/mcp/builtin-entry.test.ts`.
     - `f63bc50` "test(mcp): show the adapter's overridden user row in a scenario" replaced one case of `mcp-status-conformance.test.ts` with an `@adapter-only` scenario.
     - 265 - 28 - 1 = 236. `case-diff.sh`, `case-diff.log`: after the Wave 1 merge `e7fadc4`, only those two files change their count of test calls. The other commits change headers and titles.
   - **Charter count.** `9403a1c` added a tenth charter bullet, the `test/architecture/` place, to all three copies. `dc8aa81` and `b90ca44` reworded items in all three.
   - **The decision.** The orchestrator took option 1: expect `ℹ tests 236`, `ℹ pass 236`, `ℹ fail 0`, and `rules=10` with three identical copies. The existing `integration.log` and the `charter-diag.sh` result satisfy these, so neither ran again. Then run Task 2 as written.
2. **[Rule 3 - Blocking] Verify commands ran from scripts.**
   - The worktree's shell guard refused the inline forms. They call `git` inside `$(...)`, or chain `git` with other commands.
   - As the execution rules allow, each such command ran verbatim from a script in `$D`: `setup.sh`, `verify-t1-1.sh` to `verify-t1-5.sh`, `gate-pre.sh`, `gate-main.sh`, `gate-cov.sh`, `audit-plan.sh`, `audit-phase.sh`, and `verify-t2-files.sh`.
   - For the same reason, I did not write the GSD per-plan ledger file under the git dir. `$D/plan-base` holds the base. `commits: 1` is `git rev-list --count a7b9feb..HEAD`, taken before the SUMMARY commit.
3. **Worktree setup.** `node_modules` is a real directory in this worktree, not a symlink, so no link was made. `git status --porcelain` was empty for every clean-tree check.
4. **Peer cache.** The `node_modules/.cache/optional-peers` cache of this worktree was empty at the start. I read the pi-subagents source from the main checkout's cache, which holds the same pinned 0.88.1. `test:integration` then installed the pinned suite versions into this worktree's cache: pi-mcp-adapter 7.0.1, pi-subagents 0.88.1, and @quintinshaw/pi-dynamic-workflows 3.15.0.

**Total deviations:** 4. One is an orchestrator decision on stale expected counts; three are environment or tool workarounds. **Impact:** none on the result. Every gate step exited 0.

## Parent lines

- `CHANGELOG.md`: None. The phase changes tests and doc wording, with no user-visible behavior.
- `.planning/BACKLOG.md`: None.
- The Key Decisions table: None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- `docs/hooks-compatibility.md` holds the new sentence once and the old sentence zero times.
- Commit `b9c0a04` is an ancestor of HEAD.
- `check-main.log` ends with `main_exit=0`, and `check-cov.log` ends with `cov_exit=0`.
