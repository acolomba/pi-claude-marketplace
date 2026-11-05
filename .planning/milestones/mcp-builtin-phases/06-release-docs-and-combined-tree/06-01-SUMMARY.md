---
phase: 06-release-docs-and-combined-tree
plan: "01"
subsystem: testing
tags: [cucumber, mcp, dual-04, pi-mcp-adapter, builtin-mcp]

requires:
  - phase: 02-built-in-materialization
    provides: the switch scenario and Pi's built-in MCP registration
  - phase: 03-read-time-verdicts
    provides: the D-MB-07 `requires mcp` marker for a plugin whose servers either implementation runs
provides:
  - "DUAL-04 row: the switch scenario's one read-only `/claude:plugin list` read shows `requires mcp` while no MCP implementation runs"
  - "Red proof at d1711fd: the same read fails with `requires pi-mcp-adapter`"
affects: [release docs, combined-tree gate, DUAL-04 traceability]

actuals:
  tokens: 509
  tasks: 2
  commits: 1

plan_head_before: 37f1cfdb09cf4cd77d4b1a8f6ff7de6358b8480f
plan_head_after: 58ab86302354673f9289d0aa7fb710d8689ff820

tech-stack:
  added: []
  patterns:
    - "A read-only `/claude:plugin list` read between restarts, with a comment citing NFR-5 and D-P6-18, does not count as a plugin command"

key-files:
  created: []
  modified:
    - features/mcp-server/implementation-switch.feature

key-decisions:
  - "The list result field rows match the precedent exactly (research assumption A1 confirmed by the run); no field row was adjusted"
  - "The red run used the plan's `npm run test:cucumber:profile` command in a red worktree with its own `npm ci` node_modules, so `install-test-peers.mjs` wrote only that worktree's cache"

patterns-established:
  - "DUAL-04 read: one `When the user runs \"/claude:plugin list\"` after `the user restarts pi without pi-mcp-adapter`, before `... with pi's built-in mcp turned on`"

requirements-completed: [DUAL-04]

coverage:
  - id: D1
    description: "The switch scenario shows `requires mcp` on the installed demo row while no MCP implementation runs, through one read-only list read, and still reaches the stub server under the adapter, built-in, and the adapter again"
    requirement: DUAL-04
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter --name \"moves from pi-mcp-adapter to pi's built-in mcp\" features/mcp-server/implementation-switch.feature (seeds 323157, 391967)"
        status: pass
      - kind: other
        ref: "npm run check:features"
        status: pass
      - kind: other
        ref: "grep: exactly one `/claude:plugin list` step and no other plugin-command step in implementation-switch.feature"
        status: pass
    human_judgment: false
  - id: D2
    description: "Red proof: on d1711fd (no read-time verdicts) the same scenario fails at the list read with `requires pi-mcp-adapter` where `requires mcp` is expected"
    requirement: DUAL-04
    verification:
      - kind: e2e
        ref: "red worktree at d1711fd, same command, log dual04-red-run.log (seed 57929): 1 scenario (1 failed)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-11-04
status: complete
---

# Phase 6 Plan 01: DUAL-04 switch-scenario read Summary

**The implementation-switch scenario now reads `/claude:plugin list` once while no MCP implementation runs and sees `demo@fixtures` `installed` with the single reason `requires mcp`; on d1711fd the same read fails with `requires pi-mcp-adapter`.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-11-04T23:32:17Z
- **Completed:** 2026-11-04T23:44:37Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Retitled the scenario to `A plugin's server moves from pi-mcp-adapter to pi's built-in mcp and back with no plugin command (MSEL-02, MSEL-03, D-MB-01, DUAL-04)`. It keeps `@own-implementation`, and the `--name` selector substring still matches.
- Added the DUAL-04 read after `Then pi reports no extension error` (after `the user restarts pi without pi-mcp-adapter`, before `... with pi's built-in mcp turned on`): the NFR-5 / D-P6-18 comment, `When the user runs "/claude:plugin list"`, the seven precedent field rows, and the one-row plugin table with `requires mcp`.
- No `call` cell changed: 1, 2, 2, 2 / 3, 4, 4, 4, 5, 5, 5, 5, 5 / 6, 7, 7, 7.
- Proved the read discriminates: on d1711fd it fails at `Then the result lists these plugins:` with `requires pi-mcp-adapter`.

## Task Commits

1. **Task 1: The switch scenario shows {requires mcp} while no MCP implementation runs** - `58ab863` (test)
2. **Task 2: Prove the DUAL-04 read fails on the tree that lacks the read-time verdicts** - no commit (its files are `none`; the proof is recorded here)

**Plan metadata:** this SUMMARY commit.

## Files Created/Modified

- `features/mcp-server/implementation-switch.feature` - the DUAL-04 title, comment, list read, and `requires mcp` row in the switch scenario.

## Red proofs

| Tree | Profile | Result | First failing step | Expected reasons | Actual reasons | Seed |
|------|---------|--------|--------------------|------------------|----------------|------|
| d1711fd (before `a25cd35` merged the read-time verdicts) | adapter | FAIL (1 scenario failed; 18 steps passed, 1 failed, 15 skipped) | `Then the result lists these plugins:` (features/step_definitions/command.steps.ts:102), right after `When the user runs "/claude:plugin list"` | `requires mcp` | `requires pi-mcp-adapter` | 57929 |

The red worktree had its own `npm ci --ignore-scripts` `node_modules`. Only the committed `implementation-switch.feature` (from 58ab863) was copied over its copy. The failing assertion, from `dual04-red-run.log`:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+ actual - expected
      'installed',
+     'requires pi-mcp-adapter',
-     'requires mcp',
      'user',
      '1.0.0'
```

The `Then the result has these fields:` step passed on d1711fd too. Only the reasons cell tells the two trees apart. The worktree was removed with `git worktree remove --force`, and `git worktree list` no longer lists it.

Green runs on this plan's tree (adapter profile): seed 323157 (1 scenario passed, 34 steps passed, 69 s), and the tracer-gate re-run on the commit, seed 391967 (1 scenario passed, 30 s).

## Owned parent lines

| Parent line | Outcome | Commit |
|-------------|---------|--------|
| 02-08 item 9, the switch part: every restart result of `implementation-switch.feature` | Verified on the combined tree. The switch scenario's three `Then the session reports no results` rows (after each restart) pass unchanged. The new read adds the `requires mcp` marker that the combined tree emits while no implementation runs. No restart row needed a change. | 58ab863 |
| D-P6-05 / D-P6-18: the DUAL-04 read | Done: one read-only `/claude:plugin list` read, with the NFR-5 / D-P6-18 comment, and the d1711fd red proof above | 58ab863 |

## Decisions Made

- The field rows are the precedent's seven rows. The run confirmed research assumption A1 (severity `info`, 0 warnings, `Plugin list`, success count 1), so no field row deviates.
- The red proof used the plan's `npm run test:cucumber:profile` command, not the `npx cucumber-js` call in the research. The research avoided the npm script only because its procedure symlinked `node_modules`, and this plan installs real `node_modules` in the red worktree.

## Deviations from Plan

None - plan executed exactly as written.

One process note, not a plan deviation: the harness refused shell commands that wrote into the git directory, so the commit-ledger file under `.git/worktrees/...` was not written. The commit count is measured from the dispatch base `37f1cfd` instead (`git rev-list --count 37f1cfd..HEAD` = 1 before this SUMMARY commit).

## Issues Encountered

None. No flake reruns were needed.

## Checks

| Command | Exit | Duration | Tree | Result |
|---------|------|----------|------|--------|
| switch scenario, adapter profile (Task 1 verify 1) | 0 | 69 s | working tree = 58ab863 content | 1 scenario (1 passed), 34 steps, seed 323157 |
| `npm run check:features` (Task 1 verify 2) | 0 | 5 s | same | no finding |
| grep: one list read, no other plugin command (Task 1 verify 3) | 0 | <1 s | same | pass |
| `npm run lint` (warm-up) | 0 | 209 s | same | pass |
| `npm run check:static` | 0 | 119 s | same | typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features all passed |
| `pre-commit run --files` (SKIP=npm-check,trufflehog) | 0 | seconds | same | all hooks passed or skipped |
| commit hook (`npm run check:commit`) | 0 | n/a | 58ab863 | Passed |
| switch scenario, adapter profile (tracer re-run) | 0 | 30 s | 58ab863 | 1 scenario (1 passed), seed 391967 |
| switch scenario, adapter profile (red proof) | 1 | 53 s | d1711fd + committed feature | 1 scenario (1 failed), seed 57929 |
| red log grep (Task 2 verify 1) | 0 | <1 s | n/a | `requires pi-mcp-adapter` present, no pass line |
| `git worktree list` has no `dual04-red` (Task 2 verify 2) | 0 | <1 s | n/a | pass |

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Window records

None.

## Dubious Choices

1. **P6-DC-0101** - What: I kept the D-P6-18 comment as one line of about 160 characters, exactly as the plan wrote it. Alternatives: wrap it over two `#` lines. Why: the plan gave the exact text; no formatter or check reads `.feature` comment length (`check:features` and pre-commit passed); and a grep for the full sentence keeps working. Severity: Low.
2. **P6-DC-0102** - What: the red run used `npm run test:cucumber:profile` (the plan's Task 2 command) in a red worktree with its own `npm ci` `node_modules`, not the `npx cucumber-js` call in the research procedure. Alternatives: call `npx cucumber-js` directly as the research suggested. Why: the research avoided the npm script only to keep `install-test-peers.mjs` from writing the shared peer cache through a symlinked `node_modules`. With a real `node_modules` the script writes only the red worktree's own cache, and the red run uses the same command as the green run. Severity: Low.
3. **P6-DC-0103** - What: the SUMMARY reports seed 323157 (first green run) as the Task 1 seed, and lists the tracer re-run's seed 391967 beside it. Alternatives: report only one of them. Why: both runs passed at the same content, and recording both shows the pass does not depend on the order. Severity: Low.
4. **P6-DC-0104** - What: I report the 02-08 item 9 switch-part parent line as "verified, no change". The scenario's three `the session reports no results` restart rows pass on the combined tree as they stand. Alternatives: add more per-restart reads (for example a list read after each restart) to record "every restart result" more fully. Why: the plan allows exactly one list read and forbids reads before the adapter is removed and after built-in is turned on (D-P6-18). The load result after each restart is already asserted. Severity: Low.
5. **P6-DC-0105** - What: the commit ledger file (`.git/worktrees/<id>/gsd-plan-head-before-06-01`) was not written, because the worktree isolation guard refused the shell write into the git directory. I measured commits from the dispatch base 37f1cfd instead. Alternatives: write the ledger through another tool, outside the worktree. Why: the base is fixed and known from the dispatch, so the measurement is the same, and writing into the shared git directory from an isolated agent is the kind of action the guard blocks. Severity: Low.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DUAL-04 passes on the combined tree under the adapter profile. The builtin profile does not run this `@own-implementation` scenario (research Pitfall 3).
- The parent's wave gate still runs `npm run check` with both profiles on the merged wave.

## Self-Check: PASSED

- FOUND: features/mcp-server/implementation-switch.feature (with `| requires mcp |` at line 94, between the restart lines 79 and 100)
- FOUND: 58ab863 is an ancestor of HEAD
- FOUND: the red log names `requires pi-mcp-adapter` and has no pass line; the red worktree is not registered

---
*Phase: 06-release-docs-and-combined-tree*
*Completed: 2026-11-04*
