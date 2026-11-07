---
quick_id: 261106-u9c
slug: mcp-implementation-test-gaps-reviewsugg-01-tests-part-see-pl
status: complete
date: 2026-11-07
commits: [8853247, be57188, bf2ec30]
plan_head_before: fb7ee1dc4bd09ba99f72ca3cc7aa3dd9775bd5ee
plan_head_after: bf2ec301a07089d620cfacb5dbdff8277c37e99f
---

# Quick 261106-u9c: MCP implementation test gaps (REVIEWSUGG-01, tests part)

## What changed

Three commits on `worktree-agent-a77ae4f9639fa1b67`, based on `fb7ee1d` (the batch base with
261106-u95 to 261106-u9b merged). Together they change the 13 planned files and nothing else.

- `8853247` `test(mcp): cover split servers and no MCP implementation` (4 files).
  `test/orchestrators/reconcile/convergence.test.ts` gets the `none` row of the D-P3-13 sse loop,
  a table of four candidate rows (split servers under `none`, adapter and builtin; a ws server under
  `none`), two unreadable-legacy rows under `none`, and three `settleMoveCascade` rows (`settle()`
  takes an optional implementation, default `adapter`). `test/orchestrators/reconcile/apply.test.ts`
  gets `seedSplitDependencyScope()` and six table rows: the deferred-enable site and the D-09-07
  toggle site, each under `none`, adapter and builtin. `features/mcp-server/verdict-markers.feature`
  gets the split-marker trio, and `features/mcp-server/verdict-update.feature` gets `none` update and
  reinstall.
- `be57188` `fix(apply): show a held-down plugin's markers on its move row` (5 files). The defect
  fix in `notify.ts` (`enabledMoveOutcome(move, enable?)`) and `apply.ts` (`landedStepRows` passes
  `enables[0]` in the deferred revision-move branch), the new apply and notify unit cases, the one
  updated apply expectation, and the `verdict-apply.feature` scenario.
- `bf2ec30` `test(completion): classify for the MCP implementation pi runs` (5 files). The world's
  `runningMcpImplementation()`, which `startProfilePi` now also uses; the completion step passes it
  to `pluginCompletions()`; JSDoc in `features/lib/plugin-completions.ts`; the completion bullet in
  `.agents/skills/cucumber/rules/world-and-stand-ins.md`; the `none` completion scenario in
  `verdict-list.feature`.

## Backlog dispositions

- REVIEWSUGG-01, apply's toggle site lacks a `none` case: fixed (the D-09-07 rows; the mutation at
  `refreshTogglePlan` fails the `none` row).
- REVIEWSUGG-01, apply's deferred-enable site lacks a `none` case: fixed (the APPLY1-01 rows; the
  mutations at `convergeScope`, `runStep` and the round-1 read in `applyScopes` fail them).
- REVIEWSUGG-01, convergence lacks a `none` case: fixed (rows 1 to 9 and the sse row).
- REVIEWSUGG-01, no scenario shows the split `runEvery` marker: fixed (the verdict-markers trio).
- REVIEWSUGG-01, no scenario shows `none` for update: fixed.
- REVIEWSUGG-01, no scenario shows `none` for reinstall: fixed.
- REVIEWSUGG-01, no scenario shows `none` for completion: fixed, with the harness change.
- A defect the deferred-enable `none` case exposed, with no backlog ID: fixed in the second commit
  (`be57188`).
- The other parts of REVIEWSUGG-01 (types, error handling, performance): left, because sibling
  items 261106-u95 to 261106-u9b own them, and the tab completion snapshot per lookup is accepted as
  AR-06-02.

## Defect found and fixed

**What.** With no MCP implementation, a held-down plugin with an MCP server that `apply` moves and
then enables in one cascade reported `● widget v1.0.0 → v1.1.0 (updated)` with no soft-dependency
marker. The deferred step reports one net row (WR-02). For a revision move, `landedStepRows`
returned `enabledMoveOutcome(move)`, which built the row with `dependencies: []`, so every marker the
enable staged was lost.

**Why it is a defect.** D-MB-07 says the marker shows when no implementation is active. D-P3-06 to
D-P3-08 say that with no active implementation every row with markers shows it.
`RECONCILE_APPLIED_CONTEXT` gives `updated` rows `markers: true`. The same plugin shows the marker on
a plain move (`convergedMoveOutcomes`) and on a toggle-step enable (`(installed) {requires mcp}`,
AFILE-04 case). No decision records dropping it.

**RED (unchanged product code, after the Task 1 commit):**

- `$X/task2-red-unit.tap`: `# pass 0`, `# fail 2`. The apply case's actual widget line is
  `'  ● widget v1.0.0 → v1.1.0 (updated)\n'` against the expected `... (updated) {requires mcp}\n`;
  the notify case's actual `dependencies` is `[]` against `['agents', 'workflows']`.
- `$X/task2-red-cucumber.log` (adapter, `verdict-apply.feature`): `5 scenarios (4 passed, 1 failed)`.
  The new scenario failed at `Then the result lists these plugins:` on the widget row's missing
  `requires mcp`.

**GREEN.** `enabledMoveOutcome` takes an optional `enable?: PluginEnabledOutcome` and sets
`dependencies` to `enableRowDependencies(enable)` when it is given. `landedStepRows` passes
`enables[0]` in the deferred revision-move branch only; a waiting record's move row (D-PL2-18) keeps
the one-argument call, because the enable row that follows carries the markers.
`$X/task2-green-unit.tap`: `# pass 2`. Direct coverage of `notify.ts` and `apply.ts` passes at 100%
with every case of both owner tests. The scenario passes.

**Existing expectation changed.** Exactly one, as planning predicted: "a deferred move and enable
retains its package warning and MCP notice on one transition" in `apply.test.ts`. Its widget line
became `  ● widget v1.0.0 → v1.1.0 (updated) {requires mcp}\n`. No other unit case or scenario
changed.

## Evidence

`X` = `/tmp/claude-0/-home-user/bd012ee2-49d5-5eae-bcde-ad28ca160602/scratchpad/u9c-exec`. Every npm
command ran with `npm_config_script_shell=<nondac-sh>` and `NODE_OPTIONS=--max-old-space-size=6144`.
Cucumber runs and coverage runs ran one at a time.

| Command | Result |
| --- | --- |
| `npm ci` (worktree had no `node_modules`) | exit 0, 395 packages |
| `CI=1 npm run check:features` before Task 1 | `Feature gate passed: 1702 scenarios, 294 step definitions.` |
| `npm run typecheck` (after each task) | exit 0 |
| `npx eslint --max-warnings 0` on the changed test and harness files | exit 0 |
| convergence `with no MCP implementation\|partial false under none` | `# pass 6`, `# fail 0` |
| convergence `each implementation runs only some of\|neither implementation runs` | `# pass 8`, `# fail 0` |
| apply `with no MCP implementation` | 2 after Task 1, `# pass 3` after Task 2 |
| apply `each implementation runs only some of\|re-plan after a config install` | `# pass 6`, `# fail 0` |
| `test:coverage:direct -- .../reconcile/convergence.ts` (Task 1) | exit 0 |
| `test:coverage:direct -- .../reconcile/apply.ts` (Task 1, Task 2) | exit 0, exit 0 |
| `test:coverage:direct -- .../reconcile/notify.ts` (Task 2) | exit 0 |
| cucumber adapter: verdict-markers, verdict-update | 18 scenarios (18 passed), exit 0 |
| cucumber builtin: verdict-markers, verdict-update | 16 scenarios (16 passed), exit 0 |
| cucumber adapter: verdict-apply (RED) | 5 scenarios (4 passed, 1 failed), exit 1 |
| cucumber adapter: verdict-apply, plugin/{apply,pending,reconcile,autoapply} (GREEN) | 119 scenarios (119 passed), exit 0 |
| cucumber builtin: verdict-apply | 2 scenarios (2 passed), exit 0 |
| cucumber adapter: `verdict-list.feature:281` (RED, old step) | 1 scenario (1 failed), exit 1; `demo@fixtures` missing from the actual set |
| cucumber adapter: verdict-list, plugin/list, marketplace/market-alias (GREEN) | 27 scenarios (27 passed), exit 0 |
| cucumber builtin: verdict-list | 6 scenarios (6 passed), exit 0 |
| `CI=1 npm run check:features` after Task 3 | `Feature gate passed: 1709 scenarios, 294 step definitions.` (+7 scenarios, same step definitions) |
| commit hook, Task 1 (`$X/task1-hook.txt`) | `npm run check:commit` Passed, gitlint Passed, exit 0 |
| commit hook, Task 2 (`$X/task2-hook.txt`) | `npm run check:commit` Passed, gitlint Passed, exit 0 |
| commit hook, Task 3 (`$X/task3-hook.txt`) | `npm run check:commit` Passed, mdformat and markdownlint Passed, exit 0 |

**Mutation matrix** (`$X/mutation-matrix.txt`, scratch copy `$X/tree` from `git archive` of
`fb7ee1d` plus the Task 1 test files; the four reads were still at lines 934, 1376, 1828 and 2374,
inside `refreshTogglePlan`, `convergeScope`, `runStep` and `applyScopes`). The control run on the
unmutated copy passed both rows (`$X/mutation-control.log`). The per-site diffs and TAP lines are in
`$X/mutation-runs.log`.

```text
refreshTogglePlan deferred=pass toggle=fail
convergeScope deferred=fail toggle=fail
runStep deferred=fail toggle=fail
applyScopes deferred=fail toggle=pass
```

It equals the expected four lines. The worktree's `apply.ts` was never mutated.

**Adaptations to the current tree.** The plan's baselines were measured at `19f3630`. At `fb7ee1d`
the feature gate read 1702 scenarios and 294 step definitions (siblings added scenarios and steps);
the plan's delta (+7, +0) holds. `apply.ts`'s four reads sat at the same line numbers. The planner's
draft patches applied cleanly to the four feature files and the two harness files. The draft
reinstall scenario cited `(D-MB-06, D-P3-12)`; the scenario cites `(D-MB-06, D-MB-07)` as the plan
says. Sibling changes (u9b's `runEvery` string union, u96's verdict-list scenario and list-row
options, u97's rules edit and harness extension, u95's grant forms) needed no change in these
tests: no new case names `runEvery`, the u96 UF-1 scenarios stay before the new completion scenario,
and the u97 bullets are unchanged.

## Questionable choices

| Choice | Alternatives | Why questionable | Severity |
| --- | --- | --- | --- |
| The completion step reads the implementation from the Pi instead of the profile. | A separate step for no implementation. | It adds one `get_commands` RPC per completion request. Not taken: a separate step repeats the action and skips the live read that D-P6-22 makes. | low |
| The fix instead of a pinned marker-less row and a BACKLOG entry. | Pin today's row and file the defect. | It changes user-visible output in a tests item. Not taken: D-MB-07, D-P3-08 and the `updated` row policy all say the marker shows, and the item says to fix a defect a test exposes. | medium |
| The fix carries all three soft dependencies, not only MCP. | Carry only the MCP marker. | Wider than the case that exposed it. Not taken: one row policy governs all three. | low |
| The waiting record's move row stays without markers. | Pass the enable there too. | Two rows of one plugin differ in markers. Not taken: the enable row that follows carries them, and a second copy would repeat the marker. | low |
| The split marker is shown on list rows after an install with `--partial`, not on install rows. | Assert the install rows. | Install's own row under each implementation stays unpinned by these scenarios. Not taken: list reads the record under the active implementation (MREC-03), so the three scenarios differ only in the implementation. | low |
| The `none` scenarios turn built-in MCP off in the user's settings, not `restarts pi with no mcp`. | `--no-mcp` launch. | The `--no-mcp` path to `none` is not covered here. Not taken: settings are the state a user reaches after removing pi-mcp-adapter (D-MB-01), and companion-missing.feature uses it. | low |
| The unit tables carry adapter and builtin rows beside each `none` row. | `none` rows only. | More rows to maintain. Not taken: `none` rows only would not show the contrast, and would leave the other two implementations unpinned at the same sites. | low |
| The `settleMoveCascade` rows assert one whole object `{ cascadeMoves, deferredEnables, heldDown }`, with `cascadeMoves: undefined` for the held rows. | The plan's separate `assert.equal(settled.cascade, undefined)` and per-field asserts. | It reads `settled.cascade?.plan.moves` instead of asserting `cascade` itself is undefined; a cascade with an empty move list would also need `cascadeMoves: []` to pass, so the two shapes stay distinct. Taken because the unit-test rules forbid a conditional in a table loop body. | low |
| `seedSplitDependencyScope()` always calls `withoutRecords(project, extra)`, with an empty list when there is no config install. | Call it only under `configInstall`. | It loads and saves state once for nothing in the deferred rows. Taken to keep the seed straight-line. | low |
| The new apply table rows sit after "APPLY1-01: a dependent held down by an earlier pass is enabled after the move it waits on lands", and the convergence `settleMoveCascade` rows after the APPLY1-01 deferred case, not right after the D-P3-14 case. | Put every new convergence case after D-P3-14 as the plan says for Step 1. | Slightly different placement from the plan's text. Taken because `settle`, `CO_SHIPPED` and `StagedPlugin` are declared later in the file; placing the rows beside their helpers avoids use-before-define. | low |

## Notes for the coordinator

- Run `npm run check` in the main checkout after the merge. The hook runs were incremental only.
  `be57188` changes `extensions/`, so the full cucumber suite under both profiles is the real
  verdict for the row change (planning ran 151 other apply-using adapter scenarios and the builtin
  `features` set green with the draft fix).
- Overlap with 261106-u97 on `.agents/skills/cucumber/rules/world-and-stand-ins.md`: this item
  rewrote only the completion bullet of "MCP implementations"; u97's bullets are untouched.
- `.planning/BACKLOG.md`, `STATE.md`, `ROADMAP.md`, `PROJECT.md` and `CHANGELOG.md` are untouched.

## Parent lines

Proposed CHANGELOG line (Fixed):

- With no MCP implementation, `apply` now names the missing implementation (`{requires mcp}`) on a
  plugin it moves and then enables, as that plugin's other rows do.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- All 13 planned files changed, and only them (`git diff --name-only fb7ee1d bf2ec30`).
- Commits `8853247`, `be57188` and `bf2ec30` are ancestors of HEAD.
- `git status --porcelain -- extensions features test .agents` is empty.
