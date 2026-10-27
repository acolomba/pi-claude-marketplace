---
quick_id: 261027-9oo
phase: quick-261027-9oo
plan: 01
status: complete
subsystem: reconcile (pending and apply row contract)
tags: [apply, pending, load, MISS-01, convergence, D-PL2-18, D-PL2-25, WR-02, WR-B, WR-C]
requirements: [RCN-01, RCN-02, RCN-07]
requires:
  - D-PL2-16 (enables that wait on a missing-dependency install run after it)
  - D-PL2-25 (convergence fails closed on a refused installed copy, 261027-a3r)
provides:
  - CascadeStep.waiting and the stepsAfterInstalls rule that plans a waiting record's move whether or not its enable comes
  - apply's (skipped) {dependency failed} row for a waiting move whose install failed or was refused
  - pending's and the load's REC-05 row for an enabled record whose installed copy cannot be used
affects:
  - /claude:plugin pending, /claude:plugin apply, the load's pending block
tech-stack:
  added: []
  patterns:
    - one cascade step per key, turned into two rows by each consumer
    - pending runs apply's final judgement over the scope as it stands to preview apply's REC-05 rows
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
    - test/orchestrators/reconcile/convergence.test.ts
    - test/orchestrators/reconcile/notify.test.ts
    - test/orchestrators/reconcile/pending.test.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/orchestrators/reconcile/load.test.ts
    - features/plugin/apply.feature
    - .planning/phases/02-apply-ordering-and-installed-declarations/02-CONTEXT.md
    - .planning/phases/02-apply-ordering-and-installed-declarations/02-03-SUMMARY.md
    - .planning/phases/02-apply-ordering-and-installed-declarations/02-01-SUMMARY.md
decisions:
  - "D-PL2-18 (user decision 2.12, 2026-10-27): a waiting record's catalog move is its own step and its own row in pending and apply; on a failed or refused install apply reports it as (skipped) {dependency failed}"
  - "D-PL2-25 amended (orchestrator decision): pending and the load list the REC-05 row apply reports for an enabled record whose installed copy cannot be used"
  - "Orchestrator decision 1: move and enable stay one CascadeStep internally, two rows in both commands"
  - "Orchestrator decision 2: a dependent of a refused waiting record takes the cascade's {dependency failed} remedy"
  - "Orchestrator decision 3: growth-only waiting moves follow the two-row rule"
metrics:
  completed: 2026-10-27
  tasks: 4
  files: 14
actuals:
  tokens: 31000
  tasks: 4
  commits: 4
plan_head_before: 8d3fe2711e6f354ee32bc2e6e268301674be2f07
plan_head_after: 05a15c749fd4c52b38ca5e3fcd6d6b3e6d256417
---

# Quick 261027-9oo: A waiting record's move as its own step Summary

A held-down plugin whose enable waits on a missing-dependency install, and that also has a catalog move, now gets that move planned and reported as its own row in both `pending` and `apply`. On success both commands list the install, the move and then the enable, in that order. When the install fails or is refused, `apply` reports the move as `(skipped) {dependency failed}` after the install's `(failed)` row and leaves the record as it was. As an extra task, `pending` and the load now list the D-PL2-25 `(failed) {unreadable manifest}` row that `apply` reports for an enabled plugin whose installed copy cannot be used.

BASE (HEAD before any edit): `8d3fe2711e6f354ee32bc2e6e268301674be2f07`.

## Commits

| Task | Commit | Subject |
| --- | --- | --- |
| 1 (tracer) | `ca8ab849` | fix(plugin): report a waiting plugin's move as its own row |
| 2 | `efbca492` | test(plugin): cover the move rows of a plugin waiting on an install |
| extra (D-PL2-25) | `7505e43b` | fix(plugin): list an unusable installed copy in pending and the load |
| 3 (docs) | `05a15c74` | docs(plugin): record the waiting move as its own step |

All four landed through the commit hook on the first attempt. `npm run check:commit` ran and passed for each. No `--amend`, no `--no-verify`, no `git add -A`, no stash.

## Row contract, confirmed against real runs

| Shape | `pending` lists | `apply` reports |
| --- | --- | --- |
| The install, the move and the enable land (S1, A1) | `cdep (will install)`, `alib 1.0.0 → 2.0.0 (will update)`, `alib (will enable)` | `cdep 1.0.0 (installed) {dependency installed}`, `alib 1.0.0 → 2.0.0 (updated)`, `alib 2.0.0 (installed)` |
| The install fails or is refused (S2, A2, A6, A7) | the same three rows | `cdep (failed) {…}` with its cause, then `alib 1.0.0 (skipped) {dependency failed}`; no enable row; record untouched; `needs reload false` when nothing else changed |
| A move that declares the waiting record (WR-06, A1/A4) | its `will update` row after the waiting record's two rows | `(updated)` on success; on a refused install the judgement disables it with the cascade remedy `"alib@mp" did not update; run apply again once it can, or uninstall "bapp@mp"` (A2) |
| A growth-only waiting move (D-09-07, D-09-08) | `will update` with equal versions and `{components now supported}`, then `will enable` | `X v1.0.0 → v1.0.0 (updated) {components now supported}`, then `X v1.0.0 (installed)` |
| A deferred record in the cascade (WR-02) | one `will update` row | one net `(updated)` row (unchanged) |
| An enabled record whose installed copy cannot be used (D-PL2-25) | `widget (failed) {unreadable manifest}` with the walk's cause, at warning, no apply trailer | the same row (unchanged) |

## RED evidence

**Task 1.** The four source files were overwritten with BASE's copies and the four owner suites run: `pass 433, fail 13`. Failing cases:

- convergence C1 "WR-07 / D-PL2-18: the steps after the installs pair each waiting enable with its move, mark it waiting, ..." (no `waiting: true`); C2 "D-PL2-18: a waiting record's move whose enable did not come is still a step ..." (BASE gives only `bapp@tools`; the `alib@tools` step with `waiting: true` is missing).
- notify N1 "D-PL2-18: lists a waiting record's move and its enable as two rows ..." (no `alib (will enable)` row).
- pending P1 and P2 (no `will enable` row after the move).
- apply A1, A2, A3, A4, A5 (D-09-08), A6 (D-06-02), A7, and D-09-07. A7 on BASE: `cdep (failed) {dependency failed}` with the RESV-05 cause and no alib row, `Reconcile: 1 failure` (the silent failure the plan describes). So the primary fixture was used, not the GV-01 fallback.

**Task 2.** Same overwrite, then `npx cucumber-js --name …` for the four scenarios: `4 scenarios (4 failed)`. Each fails at its first `Then the result has these fields`:

- S1 (`apply.feature:1432`), S2 (`:1486`) and WR-06 (`:1323`) fail on `pending`'s tally: success count `2` vs `3` (S1, S2) and `3` vs `4` (WR-06), so the `alib (will enable)` row is missing.
- WR-08 (`:1384`) fails on `apply`'s success count: `2` vs `3`.

I restored with `git checkout HEAD -- <four paths>`. `git status --short -- extensions/` was empty after.

**Extra task (D-PL2-25).** The cases were written against `efbca492` before any source change:

- pending.test.ts "D-PL2-25: pending lists an enabled record whose installed copy cannot be used as the row apply reports" and "… that ends the catalog moves once, with no move": both printed `Pending: /claude:plugin apply has nothing to change.`
- load.test.ts "D-PL2-25: an enabled record whose installed copy cannot be used is listed in pending's block, as apply reports it": the load printed nothing (`+ []`). The load's warnings cascade does not report this record either, so the new row creates no duplicate.
- notify.test.ts "D-PL2-25: lists a record whose installed copy cannot be used as its failed row, after the plan's rows and before the catalog moves": the row was missing.

## Existing cases and scenarios whose rows changed

Unit cases (`apply.test.ts`), by the plan's (i)-(iii) rule:

- A1 "D-26 / D-PL2-18: the move of a plugin that declares a record waiting … runs after that record's move and enable": (i). Tally 3 → 4.
- A2 "D-26 / D-PL2-18: a record whose missing dependency fails to install reports its move as skipped, and the move that declares it does not run": (ii) and (iii). Tally `1 failure, 2 warnings`. Records unchanged.
- A3 WR-08: (i). Tally `1 failure, 1 warning, 3 successes`.
- A4 "D-26: a held-down plugin whose move declares a record waiting …": (i). **bapp is in `deferredEnables`**: it keeps one `(updated)` row (WR-02), and the tally is 4 successes.
- A5 D-09-08: (i) (growth moves now come before their enable rows). Tally 5.
- A6 D-06-02 (retitled "D-06-02 / D-PL2-18: a record disabled before the pass is held down without being stamped, and its move reports why it did not run"): (ii). It has a new inline literal, and `SECRETS_VAULT_NOT_IN_MANIFEST` stays for D-09-14. The state bytes, mtime and marker assertions are kept and pass.
- **D-09-07 "a marker-held dependent comes back up in the same apply"**: (i). The plan did not list this case. `deploy-kit` waits on `secrets-vault` and has a growth move, so its `(updated) {components now supported}` row now comes before its `(installed)` row. Tally 2 → 3.

Scenarios (`apply.feature`):

- WR-06 "Apply moves a plugin after the held-down dependency it needs, …": `pending` gains `alib will enable` and `apply` gains `alib installed 2.0.0`. Both tallies go from 3 to 4. alib waits on cdep's install and moves.
- WR-08 "Apply reports a plugin it moves after a missing dependency's install as skipped …": `apply` gains `alib installed 2.0.0`. Success goes from 2 to 3.
- MISSORDER-01 and PENDMOVE-01 passed with no change, on both BASE and the final tree. Every dependent in these shapes is enabled, so its move runs in the cascade before the install, and no enable waits on it.
- `npm run test:cucumber` changed no other scenario.

## Proof scope (extra task)

There is no scenario for the D-PL2-25 row in `pending` or the load. To get an enabled record whose installed copy is refused, someone must hand-edit `state.json`: install refuses such a copy (D-PL2-24), and the cucumber harness has no step that writes installation records (the 261027-a3r proof scope). Unit cases cover it in `pending.test.ts` (two cases), `notify.test.ts` and `load.test.ts`. Each one failed before the change.

## Final check

- Command: `npm run check > /var/tmp/261027-9oo-check.log 2>&1; echo "exit=$?"`. I ran it from the checkout root, with no `cd` and no pipe.
- Exit status: `exit=0`
- HEAD: `05a15c749fd4c52b38ca5e3fcd6d6b3e6d256417`
- `node --version`: v26.12.1
- Log tail: `passed typecheck`, `lint`, `lint:workflows`, `fallow`, `format:check`, `test:corresponding`, `check:features`; `919 scenarios (919 passed)`, `9294 steps (9294 passed)`; `Merged LCOV: coverage/direct.lcov (292 records)`.

## Deviations from Plan

The plan was written at `586b0c93`. Two quick tasks landed after it: 261027-a3r and 261027-cyg. I found every edit point by function name. The plan's line numbers had shifted, but every assumption still held: `stepsAfterInstalls` dropped a waiting move that had no enable, `runAfterInstallSteps` used `notLanded`, and `dependencyFailedRows` already returned the skipped row for a move with no enable. `CascadeMove.installed` (now required) and the `plugin` parameter of `InstalledDeclarationsReader` touch none of the changed code.

1. **[Plan gap] D-09-07 changed too.** It is a growth-only waiting move, item (i). See the list above.
2. **[Extra task, orchestrator] D-PL2-25 row in `pending` and the load.**
   - `pending.ts::refusedCopyRows` takes the cascade's `installedCopyFailure`. It then runs `judgeFinalScope` over the scope as it stands, with `installedCopyReader`, which is the reader `apply` uses.
   - It turns each failure into one row through `reportDeclarerFailure`, so a record that both the cascade and the judgement refuse gets one row.
   - `buildReconcilePendingNotification` gains an optional sixth parameter, `refusedCopies`. It lists those rows after the plan's rows and before the catalog moves, which is where `apply` puts them.
   - The empty check counts these rows. `needsApply` does not count them, because a failure row is not a change (D-14).
3. **[Rule 2 - reuse] One builder for the REC-05 row.** `notify.ts::declarerUnreadableRow` builds the row. The applied cascade and the pending projection both use it, so the two commands cannot drift apart.
4. **`landedStepRows` helper.** `runStep`'s landed branch picks its rows in a module-private helper that uses if-returns, as the plan asks. This keeps `runStep`'s complexity within both gates.
5. The plan's README sentence edits went into the README's MISS-01 paragraph and its pending-path paragraph. The pending paragraph also names D-PL2-25.

## New uncertain choices

1. **WR-B (out of scope, as decided):** a held-down record whose waited-on catalog move fails still reports nothing for itself. This is the same silent pattern that D-PL2-18 removes for waiting records.
2. **What `pending` judges for the D-PL2-25 row:** `pending` judges the scope as it stands now. `apply` judges the scope as its earlier steps leave it. `judgeFinalScope` stops at the first failure, so when `apply` installs, moves or toggles records before the judgement, it can stop at a different record than `pending` predicted. In the steady case (nothing else changes), both commands judge the same scope.
3. **No apply trailer for the D-PL2-25 row:** a `pending` list that holds only this row ends without the `/claude:plugin apply` hint, because `apply` cannot fix it. The user may want a different remedy line.
4. **Cost:** `pending` and every load now run one more declaration walk per scope (`judgeFinalScope`). It runs offline and takes no lock.
5. **Untested residual:** when the read after the install fails, the fresh plan has no enables. So every waiting move reports `(skipped) {dependency failed}` beside the `state.json` row. No unit case or scenario covers this path.

## Notes for the user

- A growth-only waiting move lists an `(updated)` row with equal versions, then its enable row (D-09-07, D-09-08).
- A dependent of a refused waiting record now takes the cascade's `{dependency failed}` remedy, not the LOAD-01 "Enable …" remedy (A2).
- If a waiting step lands and the judgement then disables that record again, the step keeps its `(updated)` row, while WR-B drops its enable and disable rows. This is untested: it needs two waiting records and a failed step after the install.
- A deferred record in the cascade whose move did not run still reports nothing (WR-B). The scenario "Apply reports only the failing move once the plugins that wait on it are held down" pins this. It is the same pattern that D-PL2-18 removes for waiting records.
- The rewritten `runAfterInstallSteps` doc fixes IN-06's overstatement.
- Two more scenarios bring the suite to 919.

## Threat Flags

None. This task added no security-relevant surface outside the plan's `<threat_model>`. T-9oo-01..04 are mitigated as planned. The D-PL2-25 row reuses the existing REC-05 row with its fixed-phrase cause and adds no path or error text (T-55-02-02). `pending`'s extra judgement reads only offline and writes nothing.

## Self-Check: PASSED

- All 14 modified files exist.
- Commits `ca8ab849`, `efbca492`, `7505e43b` and `05a15c74` are ancestors of HEAD.
- `git rev-list --count 8d3fe271..HEAD` = 4.
- No commit deletes a file.
