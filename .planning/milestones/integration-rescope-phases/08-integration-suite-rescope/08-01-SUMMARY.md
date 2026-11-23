---
phase: 08-integration-suite-rescope
plan: "01"
subsystem: testing
tags: [node-test, reconcile, unit-tests, integration-rescope]
status: complete

requires: []
provides:
  - "eight planner fixed points as unit cases of test/orchestrators/reconcile/plan.test.ts (71 tests), inside describe(\"planReconcile\")"
  - "the deletion of test/integration/reconcile-plan-convergence.test.ts (ITSCOPE-01)"
affects: [integration-rescope Phase 8 (08-05 final gate on the combined tree)]

actuals:
  tokens: 6600
  tasks: 2
  commits: 1
plan_head_before: 17fca7ad0a642c66fd01799d08ee233390cc7449
plan_head_after: 771c4ec68fe1c0111fda035ace641bb7043fc974

tech-stack:
  added: []
  patterns:
    - "A planner fixed point authors its merged config with the pair's mergedConfig helper instead of running the config migration as an arrange step"

key-files:
  created: []
  modified:
    - test/orchestrators/reconcile/plan.test.ts
  deleted:
    - test/integration/reconcile-plan-convergence.test.ts

key-decisions:
  - "The migration case and the D-09-16 case of the convergence file were deleted as covered, after breaks B1 to B3 turned their covering unit cases red"

requirements-completed: [ITSCOPE-01]

duration: 15min
completed: 2026-11-23
---

# Phase 8 Plan 01: Reconcile Planner Fixed Points Summary

**The eight in-memory fixed points of `reconcile-plan-convergence` now run as unit cases of the planner's pair (`plan.test.ts` 63 -> 71 tests, `plan.ts` at 100% direct coverage); the migration and D-09-16 cases were deleted as covered after breaks B1 to B3 turned their covering unit cases red, and the integration file is gone.**

## Performance

- **Started:** 2026-11-23T04:20Z
- **Completed:** 2026-11-23T04:35Z
- **Tasks:** 2
- **Files modified:** 2 (one changed, one deleted)

## Task Commits

1. **Task 1 (tracer): move the eight fixed points, prove the two covered cases, delete the file** - `771c4ec` (test)
2. **Task 2: integration suite and audit on the moved tree** - checks only, no commit

## Case map

All rows landed in `771c4ec` (`test(reconcile): move the convergence fixed points to the planner pair`).

| Integration case (line at 9aa92a1) | Action | Destination or cover | Break | Commit |
| --- | --- | --- | --- | --- |
| `:139` migrates populated state to the declared config | delete as covered | `test/persistence/migrate-config.test.ts` "projects complete marketplaces, plugins, legacy flags, and nullish sources" | B1 | `771c4ec` |
| `:151`, `:175` converge populated state, project and user scope | move (one `for` over the two scopes, two sibling cases) | "plans nothing in the ${scope} scope for a config that declares every recorded marketplace and plugin, a non-installable record included" | - | `771c4ec` |
| `:199` a declared alias resolves to the canonical recorded marketplace | move | "plans nothing for a declared alias whose plugin the canonical recorded marketplace holds" | - | `771c4ec` |
| `:324` D-09-16 missing key plans the bucket; recorded dependency plans nothing | delete as covered | unsatisfied arm: "MISS-01: buckets a missing declared dependency once, with its declarer's ranges"; satisfied arm: "D-04-05: keeps an undeclared record whose provenance is dependency" | B3, B2 | `771c4ec` |
| `:385` D-09-14 an unsatisfied declaration re-plans the same bucket entry | move | "D-09-14: the same unsatisfied declaration plans the same dependency install again" | B3 (also fails the moved case) | `771c4ec` |
| `:468` FIX-02 migration leaves out local declarations; merged view converges | move the plan half; the projection half is `migrate-config.test.ts`'s two `FIX-02:` cases | "FIX-02: a base layer without the local declarations and the local layer plan nothing for their records" | B2 (also fails the moved case) | `771c4ec` |
| `:490` LAYER-01 both layers declare a marketplace with its recorded source | move | "LAYER-01: a marketplace both layers declare with its recorded source plans nothing" | - | `771c4ec` |
| `:562` LAYER-09 disabled record, base `false`, local without `enabled` | move | "LAYER-09: a disabled record under a base enabled false and a local entry without enabled plans nothing" | - | `771c4ec` |
| `:573` LAYER-09 enabled record plans a disable | move | "LAYER-09: an enabled record under a base enabled false and a local entry without enabled plans a disable" | - | `771c4ec` |

## Red proofs

- Scratch folder: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase08-plan01` (`$D`).
- Checkout root (each log's `root=` line): `/home/user/pi-claude-marketplace/.claude/worktrees/agent-a5135c9969593cbae`.
- Plan base (`$D/plan-base`): `17fca7ad0a642c66fd01799d08ee233390cc7449`. The frozen edit and the three break files applied cleanly there (`EDITS DRY OK`, `BREAKS DRY OK`, then `EDITS CHECK OK` against this base).
- Inputs: `sha256sum -c --quiet SHA256SUMS` in `plan-08/inputs` exited 0, and `SHA256SUMS` hashes to `9ad855343cdbf5b04dbaff9df15f70f367082a31a171b980cebd5616d1541746`.
- `break-unit.sh` (copied unchanged into `$D`): applies one break file to `extensions/`, refuses a dirty `extensions/`, runs the named test files with `node --test --test-reporter=spec`, and restores `extensions/` with `git checkout -- extensions/` in an EXIT trap, logging `root=`, the diff, the run, `exit=`, and `restored=`. It differs from Phase 7's `break-int.sh` in one way: the run goes through `<scratchpad>/nondac-sh` with a minimal environment (`HOME`, `PATH`, `LANG=C.UTF-8`, `TMPDIR=/tmp`), the form the unit verify commands use.
- Green runs: `$D/convergence-base.log` (the convergence file at the plan base) `ℹ tests 10`, `ℹ pass 10`, `ℹ fail 0`, `exit=0`; `$D/plan-test.log` (`plan.test.ts` with the moved cases) `ℹ tests 71`, `ℹ pass 71`, `ℹ fail 0`, `exit=0`.
- **B1** `extensions/pi-claude-marketplace/persistence/migrate-config.ts:208` (`basePluginEntries`). Change: inserted before `const entry = declaredEntry(record);`
  ```
  +      if (!record.compatibility.installable) {
  +        return [];
  +      }
  ```
  Command: `bash "$D/break-unit.sh" B1 "$D/brk/B1.json" test/persistence/migrate-config.test.ts`. Counts: `ℹ tests 18`, `ℹ pass 17`, `ℹ fail 1`, `exit=1`, `restored=clean`. Failed: `✖ projects complete marketplaces, plugins, legacy flags, and nullish sources`. `git status --porcelain -- extensions/` printed nothing afterwards.
- **B2** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:602` (`buildUninstallBucket`). Change: `-      if (record.provenance === "dependency") {` / `+      if (record.provenance === "never") {`. Command: `bash "$D/break-unit.sh" B2 "$D/brk/B2.json" test/orchestrators/reconcile/plan.test.ts`. Counts: `ℹ tests 71`, `ℹ pass 65`, `ℹ fail 6`, `exit=1`, `restored=clean`. Failed (plus the `✖ planReconcile` suite line): `FIX-02: a base layer without the local declarations and the local layer plan nothing for their records`; `D-04-05: keeps an undeclared record whose provenance is dependency`; `D-04-05: retains an undeclared marketplace while a record under it is a dependency`; `D-04-05: still sweeps a direct-install orphan under a marketplace retained for its dependency`; `D-09-02: a marker-held dependent brings its missing dependency in`; `D-09-08: a marker-held dependency-provenance record is lifted without a config entry`. `git status --porcelain -- extensions/` printed nothing afterwards.
- **B3** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:1070` (`planReconcile`). Change: `-    pluginsToDependencyInstall: pluginDiff.dependencyInstall,` / `+    pluginsToDependencyInstall: [],`. Command: `bash "$D/break-unit.sh" B3 "$D/brk/B3.json" test/orchestrators/reconcile/plan.test.ts`. Counts: `ℹ tests 71`, `ℹ pass 61`, `ℹ fail 10`, `exit=1`, `restored=clean`. Failed (plus the `✖ planReconcile` suite line): `D-09-14: the same unsatisfied declaration plans the same dependency install again`; `buckets a held-down declarer and plans no enable for it`; `MISS-01: buckets a missing declared dependency once, with its declarer's ranges`; `MISS-01: two declarers of one missing key fold into one bucket entry`; `XMKT-01 retains each eligible original declarer once without dropping ranges`; `MISS-01: a second declarer with no constraint contributes nothing to the fold`; `GV-01: only a declarer that carries a range is a requirer, in verdict order`; `MISS-01: bucket entries sort by dependency key`; `D-09-02: a marker-held dependent brings its missing dependency in`; `LOAD-02: plans neither the enable nor the disable bucket for a marked record whose dependency is still unsatisfied`. `git status --porcelain -- extensions/` printed nothing afterwards.
- The red verify command (`$D/verify-t1-3.sh`, the plan's command verbatim, run as a script because the worktree shell guard refused it inline) exited 0 before the deletion.

## Checks

`node --version`: `v24.22.3`. Every npm script ran with `npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`; the ESLint warm-up, `check:static`, the integration suite, the audit, and the commit ran under `flock -w 3600 "$S/phase07-heavy.lock"`.

| Check | Tree | Exit |
| --- | --- | --- |
| Precondition: `nondac-sh` executable, `flock` on PATH, `SHA256SUMS` and its hash, `node_modules/.package-lock.json`, `EDITS DRY OK`, `BREAKS DRY OK`, convergence file present | `17fca7a` | 0 |
| `bash -n break-unit.sh`, `node --check apply-edits.mjs` | - | 0 |
| Convergence file baseline (`convergence-base.log`, 10/10) | `17fca7a` | 0 |
| Edits check (`edits-check-t1.log`, `EDITS CHECK OK`) | working tree on `17fca7a` | 0 |
| `plan.test.ts` (`plan-test.log`, 71/71) | working tree on `17fca7a` | 0 |
| Breaks B1, B2, B3 (`B1-unit.log` to `B3-unit.log`) | working tree on `17fca7a` | each `exit=1`, `restored=clean` |
| Red verify (`verify-t1-3.sh`) | working tree on `17fca7a` | 0 |
| `git grep reconcile-plan-convergence` outside `.planning/` after `git rm` | working tree on `17fca7a` | 1 (no match) |
| Direct coverage of `plan.ts` (`cov-plan.log`: branches 180/180, functions 31/31, lines 1073/1073) | working tree on `17fca7a` | 0 |
| `npm run lint` warm-up (`lint-warm.log`) | working tree on `17fca7a` | 0 |
| `check:static` (`check-static-1.log`: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features) | working tree on `17fca7a` | 0 |
| Commit hook (`npm run check:commit` passed, gitlint passed) | `771c4ec` | 0 |
| Task 1 file set and clean tree (`verify-t1-6.sh`) | `771c4ec` | 0 |
| Acceptance greps: D-09-14 and LAYER-09 disable titles once each, `buildConfigFromState` 0, the file absent | `771c4ec` | as expected |
| Task 2 `test:integration` (`integration.log`: `ℹ tests 269`, `ℹ pass 269`, `ℹ fail 0`; the deleted file is not named) | `771c4ec` | 0 |
| Task 2 `fallow audit --base 17fca7a` (`verify-t2-audit.sh`, `audit.json`) | `771c4ec` | 0 |
| Task 2 final file set, no `extensions/` change, clean `extensions/` and `test/` (`verify-t2-files.sh`) | `771c4ec` | 0 |

The wave's post-merge `npm run check` on the combined tree is the full verdict of this plan.

## Issues for the milestone

- `fallow audit --base 17fca7a` on `771c4ec`: `verdict=warn`, `dead_code_issues: 0`, `complexity_findings: 0`, `duplication_clone_groups: 0`, and one diff-risk finding: `weakened-tests` (`removed-tests`, `warn`) on `test/integration/reconcile-plan-convergence.test.ts`, "The change removes test cases (test cases: 10 -> 0)". Left to the milestone, as the user decided on 2026-11-21: no `.fallowrc.json` or CI change.

## Deviations from Plan

None - plan executed exactly as written. The plan's counts were measured at 9aa92a1; this plan's base is `17fca7a`, where the precondition dry runs, the edit check, and every count matched the planner's measurements. Two verify commands were run as scripts under `$D` (`verify-t1-3.sh`, `verify-t1-6.sh`) because the worktree's shell guard refused them inline, as the execution rules allow.

## Known Stubs

None.

## Parent lines

- `CHANGELOG.md`: None (the change is test-only).
- `.planning/BACKLOG.md`: None.
- Key Decisions table: None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: `test/orchestrators/reconcile/plan.test.ts`; ABSENT (deleted as planned): `test/integration/reconcile-plan-convergence.test.ts`
- FOUND: commit `771c4ec` in HEAD's history
