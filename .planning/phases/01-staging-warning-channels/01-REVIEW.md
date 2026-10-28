---
phase: 01-staging-warning-channels
reviewed: 2026-10-28T16:04:11Z
depth: standard
source_commit: 4bcdf9697b87ea97d21face0154933e6c7f625a5
review_head: 503343bcbcf979ac246bd34822ae89b94d32e088
review_fix_commits:
  - 15e12fdf24c5c0444d5707646983980dae58b438
  - da9756bdb4362e255c829bb263b594e6f37bf1f4
  - 4bcdf9697b87ea97d21face0154933e6c7f625a5
files_reviewed: 22
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts
  - extensions/pi-claude-marketplace/shared/compare-name-scope.ts
  - features/plugin/staging-warnings.feature
  - features/lib/npm-registry.ts
  - features/lib/layer-config.ts
  - features/step_definitions/config.steps.ts
  - features/support/world.ts
  - features/support/npm-registry.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-flow-results.test.ts
  - test/orchestrators/plugin/install-flow-fixture.ts
  - test/platform/hermetic-environment.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-28T16:04:11Z
**Depth:** standard
**Files reviewed:** 22
**Status:** issues_found

## Summary

CR-01 is closed by the iteration-2 finalizer, and CR-02 remains closed.
One new finding remains: five regression cases added by the iteration-1
fixes leave their temporary project trees behind. The two iteration-2
invalid-config cases correctly remove their trees.

This is a focused re-review of commits `15e12fdf`, `da9756bd`, and
`4bcdf969`, including their changed code, tests, feature scenarios and
relevant callers and fixture contracts. Large pre-existing test modules
were read at the changed cases and their supporting code. The earlier
Phase 1 review remains the baseline for unchanged phase implementations;
this report does not claim another full-file review of its entire scope.

## Narrative Findings (AI reviewer)

### CR-03: Five added regression cases leak their temporary project trees

**Classification:** BLOCKER
**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710/test/orchestrators/plugin/install-flow-planning.test.ts:401-488`
**Related file:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710/test/orchestrators/plugin/install-flow-ledger.test.ts:15639-15683`

**Issue:** Both parameterized MCP tests (four cases) and the row-order
test allocate a project through `seedCatalogScope` without registering
cleanup. That helper creates `install-upd-dep-*` directly under
`tmpdir()` (`install-flow-fixture.ts:283-285`).
`withHermeticHome` removes only its separately allocated `install-*`
environment, through `withHermeticEnvironment`; these project trees
are siblings of that environment, so its cleanup cannot remove them.
The tests leave plugin sources, generated artifacts, state and config
files on disk even after successful completion. The failed-move cases
also leave their deliberately chmod-000 skill file behind.

**Evidence:** Ran only the four MCP cases, the row-order case and the
two iteration-2 invalid-config cases in a fresh temporary directory,
using that directory as the child test process's `TMPDIR`. The command
exited 0. The parent then enumerated exactly five surviving
`install-upd-dep-*` directories. There is no matching cleanup in those
five cases or a module-level teardown. The two iteration-2 cases have a
`finally` at `install-flow-ledger.test.ts:206-208` and leave no tree.
The probe removed its complete temporary root in its own `finally`.

This classification follows the project's
`.agents/skills/typescript-unit-tests/rules/review.md`: leaked
filesystem writes are a BLOCKER hermeticity defect.

**Fix:** Give each of these five cases ownership of its project cleanup,
matching the iteration-2 cases. Immediately after successful allocation,
wrap the setup, action and assertions in `try/finally` and call
`await rm(cwd, { recursive: true, force: true })` in `finally`.
Alternatively register the same cleanup with the case's `t.after`.
Keep the fix local to these newly added cases; unrelated older tests
need not be changed. Repeat the selected cases under an isolated
`TMPDIR` and assert that it is empty afterward, on success and when a
case assertion fails.

## Fix Dispositions

| Finding | Verdict | Evidence |
| --- | --- | --- |
| CR-01 | Closed. | All terminal non-throwing transaction arms now reach the common notice boundary at `install-flow-ledger.ts:1282`. The caught-failure path still finalizes its merged notices independently. The dependency-planning arm delegates ownership without another emission. |
| CR-02 | Closed. | The shared row comparator orders root display names and qualified member keys in `cascadeStagingDiagnostics`; the exact root key is excluded from member diagnostics. Headers preserve plugin names. Runtime regression passes with the dependency diagnostic before the root diagnostic. |
| CR-03 | Open, BLOCKER. | The five iteration-1 regression cases leave temporary project trees behind, independently reproduced above. |

### CR-01 terminal-path audit

- `invalid-config`, `marketplace-absent`, `refused`, and `declared`
  assign their result and retain `priorNotices` before the common boundary.
  Their prior returns no longer bypass notice delivery.
- `promoted`, `disable-cascade-failed`, and `installed` append their
  own notices after prior dependency notices, then reach that same boundary.
  Rows and any discovery diagnostics are produced first.
- The `declared` arm is standalone-only:
  `declareInstalledPlugin` rejects orchestrated mode before returning it
  (`install-flow-results.ts:889-902`). Its row helper therefore cannot
  leak a notification from a reachable orchestrated declaration.
- `dependency-moves` returns the delegated result. Planning forwards
  `ran.mcpConfigNotices` to either the failed-move projection or the next
  install. The resumed run uses `runInstallCascade` with a planned closure,
  not another planning pass, so it does not consume the same notices twice.
- The catch merges prior notices with notices captured by the current
  transaction before producing the failure outcome. It returns through its
  own finalizer and cannot also reach the normal boundary.
- `withMcpConfigNotices` emits only in standalone mode and adds the
  outcome member only for a non-empty list. Orchestrated mode returns
  notices to its caller without direct emission.

## Verification Evidence and Limits

- Read project instructions, existing review and fix report, the three fix
  diffs, relevant Phase 1 requirements and notice/ordering plan records,
  changed cases and fixture contracts. Applied TypeScript, unit-test,
  Cucumber and local-verification review rules. The configured reviewer
  skill query returned no additional entries.
- Used CodeGraph before locating code, then read current source where its
  index identified changed files. No structural-findings payload or
  external-reviewer evidence was supplied.
- On Node `v26.12.1`, ran the selected regression cases with:
  `node --test --test-name-pattern 'keeps dependency-step MCP notices|keeps dependency MCP notices when the final config|reports install diagnostics in row order' test/orchestrators/plugin/install-flow-planning.test.ts test/orchestrators/plugin/install-flow-ledger.test.ts`.
  Exit 0. These exercise successful final roots, failed later moves,
  final invalid configuration in both modes, and diagnostic order.
  The isolated temporary-directory wrapper exposed CR-03.
- Ran two additional inline hermetic probes through the real
  `createInstallPlugin` entry point. A transaction wrapper threw before
  the final root lock after durable state recorded the dependency's move.
  Both modes returned the exact one-element `comments-dropped` notice
  array. Standalone mode emitted the failure cascade followed by exactly
  one MCP notice; orchestrated mode emitted nothing. Exit 0. Each probe
  removed its temporary project in `finally`.
- Checked the iteration-2 unit cases' full notification assertions,
  durable dependency versions and MCP file contents. Their setup uses
  the real transaction after an interleaved config edit, with no production
  test seam, and their project cleanup runs in `finally`.
- Checked the new behavioral fixture: the npm server belongs to one
  scenario, binds loopback, consumes its callback before awaiting it, and
  the world registers server closure. The callback writes only the sandbox
  local config through the existing layer writer. The scenario asserts
  every result, row, exact MCP notice, final config text and full request
  window. It uses no delay or network service outside the local stand-ins.
- The fix report records passing direct coverage of the changed ledger
  pair, the commit hook, and all 20 staging-warning scenarios (248 steps)
  at `4bcdf969`, plus regression failures with only the source fix removed.
  Those are the fixer's recorded results, not commands rerun by this reviewer.
- The owner is responsible for the full `npm run check` result on these
  inputs. It was not duplicated here; no unreported full-check pass is
  claimed by this report.
- At review HEAD `503343bc`, the build-input diff from `4bcdf969` was
  empty and the worktree had no untracked build inputs. Only this report
  was changed by the reviewer. No implementation or test edits and no
  commit were made.

---

_Reviewer: gsd-code-reviewer_
_Depth: standard_
