---
phase: 02-apply-ordering-and-installed-declarations
fixed_at: 2026-10-28T14:41:51Z
review_path: .planning/phases/02-apply-ordering-and-installed-declarations/02-REVIEW.md
iteration: 3
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-10-28T14:41:51Z
**Source review:** .planning/phases/02-apply-ordering-and-installed-declarations/02-REVIEW.md
**Iteration:** 3

**Summary:**

- Findings in scope: 2 (CR-01 and CR-02; critical_warning)
- Fixed: 2
- Skipped: 0

## Fixed Issues (round 3)

### CR-01: Pending and load still reject source changes that apply repairs

**Status:** fixed: requires human verification
**Commit:** d0b7e21e — `fix(reconcile): preview marketplace source replacements`
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`, `test/orchestrators/reconcile/pending.test.ts`, `test/orchestrators/reconcile/notify.test.ts`, `features/plugin/apply.feature`.

**Applied fix:** Pending calls the same source-repair normalization as apply for its first plan and every replan. Apply retains its source-mismatch marker to select replacement. The pending renderer excludes that marker when the same scope and marketplace has a planned add. Other mismatch causes retain their failure rows. The official fallback declaration is current when that marketplace is recorded, as D-PL10-24 requires.

**Regression evidence:** Three unit cases failed before production edits: pending's changed-source row and apply trailer, the official fallback's empty report, and the replacement marker's rendered row. The two behavioral scenarios also failed on the old code. They now compare pending, a new session without autoapply, and apply for ordinary replacement and the official fallback. Both pass: 2 scenarios, 35 steps.

### CR-02: Replacing an existing hosted marketplace fails with a stale clone

**Status:** fixed: requires human verification
**Commit:** 7938b740 — `fix(marketplace): restore hosted sources when replacement fails`
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`, `test/orchestrators/marketplace/add.test.ts`, `features/plugin/apply.feature`, `features/plugin/import.feature`.

**Applied fix:** Hosted sources join github and url sources in the existing reversible managed-directory swap. Replacement puts the old hosted directory into staging, restores it on failure, and discards it after a successful save. User-owned path directories retain the existing behavior. The change is one source-kind condition and its documentation.

**Regression evidence:** Hosted-to-hosted and hosted-to-git replacements failed with `stale clone` before the fix. A third regression forces a save failure after placement; it now reaches `EISDIR` and verifies the original state, installed records, catalog bytes, ownership marker, and empty staging directory. The replacement catalog has different bytes, so leaving it behind cannot pass. Two new behavioral scenarios reproduce the hosted URL change through apply and import. Both failed before the fix and pass afterward: 2 scenarios, 26 steps. The apply scenario also verifies a second apply has nothing to change.

## Verification (round 3)

All checks ran in the existing isolated worktree `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-b-258`, branch `agent-reverify-b`, Node `v26.12.1`. No nested worktree was created or removed. The checks requiring local loopback servers ran outside the sandbox after the sandbox refused `listen` with `EPERM`.

- Re-read every changed production section and inspected the diff; `git diff --check` passed.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts` exited 0. Each source-test pair reached 100% direct coverage. The commit hook verified the final extracted notification helper as well.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` exited 0: all 198 owner tests passed and the source-test pair reached 100% direct coverage.
- `npx cucumber-js --parallel 1 --name 'Apply replaces a marketplace whose declared source changed|The official fallback source is already up to date'` exited 0: 2 scenarios, 35 steps.
- `npx cucumber-js --parallel 1 --name 'replaces an existing hosted marketplace'` exited 0: 2 scenarios, 26 steps.
- `fallow audit --base HEAD --format human` passed before each commit. CR-01's initial inline filter exceeded the notification function's complexity threshold; extracting the filter removed the finding.
- Both commits passed the normal hooks, including `npm run check:commit` (project typecheck, lint, static gates, unpaired tests, and staged-pair direct coverage). No hook was bypassed. CR-01's first commit attempt caught an unresolved helper return type; the corrected retry passed.
- The first combined-tree `npm run check` exposed one stale load expectation for the former source-mismatch error. Commit `69e804cf` updates it to the actionable replacement preview; its 21-test owner suite and direct coverage pass.
- The final combined-tree `npm run check` exited 0 at `69e804cf` with Node `v26.12.1`: static, integration, and unpaired checks passed; Cucumber passed 1,122 scenarios and 11,447 steps; direct coverage merged 309 LCOV records.

This report records completed fixes, not a clean re-review. `02-REVIEW.md` remains unchanged by the fixer and retains `issues_found`. The orchestrator must re-review before closing the findings. No source or test changes remain uncommitted; this report is intentionally left for the orchestrator to commit.

## Previous review rounds

The following records retain the dispositions and evidence from iterations 1 and 2. Their observations describe those revisions; later recorded decisions and review findings take precedence.

**Round 2 verification:** all of it ran in the main checkout
(`/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-p2-apply-954f68`, branch
`features/plugin-lifecycle-p2`). No worktree was used. Each fix shipped a unit test, and
each test was shown to fail with the source change reverted. WR-07 and WR-08 also have a
cucumber scenario that fails on the old source. Each touched source-test pair has 100%
direct coverage. The pre-commit hook (`check:commit`) passed on every commit. The final
`npm run check` over the whole tree exited 0: 913 cucumber scenarios passed, and the
direct-coverage merge covered 291 records.

## Round 1 (iteration 1, commits 3368082e..9dfddcd0)

| ID | Commit | Result |
|----|--------|--------|
| WR-01 | 3368082e | Fixed. The judgement reads the scope again once an install or enable after the moves was tried. |
| WR-02 | 97eb8db4 | Partly fixed. Autoupdate ran after a post-commit throw, but the handler still printed a reasonless `(failed)` row. Finished in round 2. |
| WR-03 | afc03209 | Fixed. The candidate containment check refuses only path-containment errors and fails closed on other faults. |
| WR-04 | 03b1de7e | Fixed. One command-wide set reports a shared missing dependency once per `marketplace update`. |
| WR-05 | 3a02f5a1 | Fixed. A failed read after the moves installs nothing. IN-04 records a small residual. |
| WR-06 | 9dfddcd0 | Fixed, with two regressions (WR-07, WR-08), both fixed in round 2. |

## Fixed Issues (round 2)

### WR-07: `pending` lists a dependent's move before the missing-dependency install, but `apply` makes it after the install

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/README.md`, `test/orchestrators/reconcile/convergence.test.ts`, `test/orchestrators/reconcile/notify.test.ts`, `test/orchestrators/reconcile/pending.test.ts`, `features/plugin/apply.feature`
**Commit:** e852f3d7
**Applied fix:** The deferral rule now lives in one place. `pending` and `apply` both call it.

- `convergence.ts` now exports the rule that was private to `apply.ts`:
  - `CascadeStep` is the step type.
  - `movesAfterInstalls` finds the moves that wait on the install. It was `stepsAfterInstalls` in `apply.ts`.
  - `stepsAfterInstalls` builds the steps after the install and orders them dependencies first. It was `afterInstallSteps` plus the `dependenciesFirst` call in `runAfterInstallSteps`.
- `apply.ts` imports all three and runs the steps in the order it gets them.
- `composePendingReport` computes the same set from its cascade and the waiting enables. It leaves those moves out of the convergence moves and passes the ordered steps to `buildReconcilePendingNotification`. That function now takes `afterInstalls: CascadeStep[]` in place of `enablesAfterInstalls`. A step with a move lists one `will update` row, which also covers the record's enable. An enable alone lists `will enable`. These rows come after the `will install` rows, in `apply`'s order.
- `planConvergence` had no production caller left, so fallow flagged it as an unused export. It was removed. Its tests use a local `plannedMoves` helper over `planConvergenceCascade`, and the README names `planConvergenceCascade`.

**Parity:** The waiting record's own move and enable now list as one row after the install, as `apply` reports them. So for the shapes below, `pending` and `apply` list the same rows in the same order:

- The WR-06 scenario: `cdep will install`, `alib will update`, `bapp will update`. `apply` reports `cdep installed`, `alib updated`, `bapp updated`.
- A record that a config enables and that waits on the install: `vault will install`, `app will update`. `apply` reports `vault installed`, `app updated`. I checked this with a cucumber probe that I did not commit.

So 02-01 Uncertain choice 5 and 02-03 Uncertain choice 3 no longer hold: `pending` no longer lists a waiting record twice or before the install.

**What still differs:**

- On the failure path, `pending` lists every deferred move as `will update`. If the install then fails, `apply` reports the following:
  - A non-waiting move it does not run gets `(skipped) {dependency failed}` (WR-08), or the judgement's `(disabled)` row in its place.
  - A waiting record's own move reports nothing, because the record stays disabled as it was (WR-B).
  - This only happens when a step fails.
- Not part of WR-07, and not changed: a deferred enable with no move of its own (an "alone" step) still runs in the cascade, even when it declares a move that waits until after the install. Neither `pending` nor `apply` moves it after the install, so the two still agree. It may deserve its own look.

**Tests:**

- `convergence.test.ts`:
  - The fixed point of `movesAfterInstalls`, including a transitive declarer that a single pass would miss.
  - The order of `stepsAfterInstalls` and how it pairs enables with moves.
- `notify.test.ts`: a move step lists `will update` after the dependency install, and an enable step lists `will enable`.
- `pending.test.ts`: the held-down shape and the config-enable shape. Both fail on the old `pending.ts`.
- `features/plugin/apply.feature`: the WR-06 scenario is retitled "..., as pending lists it". It now checks `pending`'s fields and rows before `apply`, using the steps the D-PL2-03 scenarios use. With the old `pending.ts` and `notify.ts`, it fails on 4 rows where 3 are expected.

Status: fixed, requires human verification (ordering logic change).

### WR-08: a deferred move that `runAfterInstallSteps` blocks reports nothing and is not marked failed

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `test/orchestrators/reconcile/apply.test.ts`, `features/plugin/apply.feature`
**Commit:** 2a3fbc1b
**Applied fix:**

- A blocked step after the install now runs through the cascade's own code. `runCascade` and `runAfterInstallSteps` both call one new `runSteps(opts, steps, run, blocked)`. It holds the old cascade loop: a blocked step is added to `failed.all`, and it pushes the replaceable `dependencyFailedRows` report. Sharing the loop also removed a clone group that `fallow dupes` reported.
- So that the judgement's `(disabled)` row can replace that row in place, as in the cascade:
  - `AfterMoves` now keeps the step reports after the install in a separate `steps` list. They are no longer flattened into `rows`.
  - `cascadeRows` runs the replacement loop, now `reportRows`, over the cascade reports and then over these reports. Their rows still come right after the MISS-01 rows.
  - `withoutUndoneStepEnables` first applies WR-B to these reports: an enable that the judgement undid reports neither row, as before.

**Tests:**

- New unit case: `xapp` declares `alib` (waiting, with a move) and `ycore`. The move of `ycore` fails. `apply` now reports `xapp v1.0.0 (skipped) {dependency failed}` after `alib (updated)`, and `xapp` stays enabled at 1.0.0. On the old source, `xapp` had no row.
- The existing D-26 case "does not run" pins the in-place replacement. There, `bapp`'s `(disabled)` row replaces its skipped row. Without the `cascadeRows` change, both rows would show.
- New scenario: "Apply reports a plugin it moves after a missing dependency's install as skipped when its other dependency's move fails". It uses the existing unreadable-skill-file step. It fails on the old `apply.ts`.
- Same-seam re-check: the WR-06 unit cases, the MISSORDER-01 and PENDMOVE-01 scenarios, and every `apply.feature` scenario pass.

Status: fixed, requires human verification (reporting and failure-set change).

### WR-02 (carried over): bootstrap still reports a committed add as `(failed)` when the missing-dependency step throws

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts`, `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts`, `test/orchestrators/plugin/bootstrap.test.ts`, `test/edge/handlers/plugin/bootstrap.test.ts`
**Commit:** 6dc34113
**Applied fix:** This is the smaller of the review's two options.

- After autoupdate, `bootstrapClaudePlugin` now throws a new `BootstrapStepError` (in `orchestrators/plugin/bootstrap.ts`). It carries the step's error as `cause`.
- The handler runs `rethrowInvalidGitHubBaseUrl` first, as before. Then it rethrows `err.cause` for a `BootstrapStepError`. So the original error reaches the command with its cause chain. In `json`/`rpc` mode it becomes `internal-error`; in `tui`/`print` mode it is rethrown. `marketplace add` surfaces the same step's throw the same way.
- The bare failed row stays for any other error.

**Tests:**

- The orchestrator case now asserts `BootstrapStepError`, its `name`, and `cause === stepError`.
- New handler case: a step that rejects with an `ENOENT` error after the add. The test asserts that the handler rejects with that same error and that only the `(added)` and `<autoupdate>` rows were sent, with no `(failed)` row. It fails on the old handler.

**No cucumber scenario:** the reason is the one round 1 gave. In a real run, the throw comes from `settleAddedMarketplaces` or `collectPostCommitWarnings` in the extension-managed tree. A step could make that happen only by naming an internal path, which the cucumber layout rules forbid.

**Limit:** the rows of dependencies that the step installed before it threw are still lost. `notifyAdded`'s `finally` renders `NO_DEPENDENCY_INSTALLS`. `marketplace add` has the same gap. The review's second option fixes both: make `createScopeDependencyInstall` turn a post-commit hygiene throw into a debug line or a failed child row. That change is in `install-flow.ts`, which both commands share, so it was left out of this smallest fix.

Status: fixed.

---

_Fixed: 2026-10-27T09:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
