---
phase: 08-integration-suite-rescope
plan: "02"
subsystem: testing
tags: [integration-tests, cucumber, node-test, red-proof, itscope]
requires:
  - phase: 07-path-source-dependency-tags
    provides: the red-proof helpers break.sh and check-red.mjs, frozen unchanged in plan-08/inputs
provides:
  - load-reconcile-race with its two multi-process cases under an ITSCOPE-01 header
  - subagent-hook-ownership with its dead-child hand-off case under an ITSCOPE-01 header
  - workflow-kind-inversion with its three internal cases under an ITSCOPE-01 header
  - the deletion of transaction-lifecycle-cascade.test.ts
  - the docs/output-catalog.md workflow sentence that names the storage scenario
affects: [08-05 ITSCOPE-04 gate, milestone audit]
actuals:
  tokens: 7050
  tasks: 3
  commits: 4
plan_head_before: 17fca7ad0a642c66fd01799d08ee233390cc7449
plan_head_after: 1c1790054f83d5f670e1a298029306f44842f038
tech-stack:
  added: []
  patterns:
    - "Delete an integration case only after a reverted break fails its cucumber or unit cover"
key-files:
  created: []
  modified:
    - test/integration/load-reconcile-race.test.ts
    - test/integration/subagent-hook-ownership.test.ts
    - test/integration/workflow-kind-inversion.test.ts
    - docs/output-catalog.md
  deleted:
    - test/integration/transaction-lifecycle-cascade.test.ts
key-decisions:
  - "B7c (uninstall leaves the hooks config on disk) fails no scenario, as the survivor row says; its unit cover, LIFE-04 of uninstall.test.ts, is the deletion's proof for the uninstall step"
patterns-established:
  - "Trimmed integration files open with `// <path>` and a class sentence that carries `(ITSCOPE-01)` and names where cucumber holds the rest"
requirements-completed: ["ITSCOPE-01", "ITSCOPE-02"]
coverage:
  - id: D1
    description: "The single-process D-13 case of load-reconcile-race goes after break B4 failed the 0.4.3 project scenario on a Then; the two multi-process cases pass under their header"
    requirement: ITSCOPE-01
    verification:
      - kind: other
        ref: "check-red.mjs tracer- tables (red-tracer.log): RED-PROOFS OK"
        status: pass
      - kind: integration
        ref: "test/integration/load-reconcile-race.test.ts (int-t1.log: tests 2, fail 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Test 1 of subagent-hook-ownership and test 1 of workflow-kind-inversion go after B5, B6a, B6b, and B6c failed their scenarios; the kept cases pass; the catalog points at the storage scenario"
    requirement: ITSCOPE-01
    verification:
      - kind: other
        ref: "check-red.mjs t2- tables (red-t2.log): RED-PROOFS OK"
        status: pass
      - kind: integration
        ref: "subagent-hook-ownership (int-t2a.log: tests 1) and workflow-kind-inversion (int-t2b.log: tests 3)"
        status: pass
      - kind: unit
        ref: "npm run test:unpaired (unpaired-t2.log, exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "transaction-lifecycle-cascade.test.ts goes after B7, B7i, and B7c failed the unit cases of each hooks step, and B7 and B7i their lifecycle scenarios"
    requirement: ITSCOPE-01
    verification:
      - kind: other
        ref: "check-red.mjs t3- tables (red-t3.log): RED-PROOFS OK; verify-t3-unit-red.sh exit 0"
        status: pass
      - kind: integration
        ref: "npm run test:integration (integration.log: tests 275, fail 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The three files that keep cases open with their path line and an ITSCOPE-01 class sentence that names where cucumber holds the rest"
    requirement: ITSCOPE-02
    verification:
      - kind: other
        ref: "apply-edits.mjs check against the plan base for 08-02-t1, t2a, t2b: EDITS CHECK OK; acceptance greps"
        status: pass
    human_judgment: false
duration: 23min
completed: 2026-11-23
status: complete
---

# Phase 8 Plan 02: Integration case deletions with red proofs Summary

**Four integration cases that a scenario or a unit case already covers are gone, each after a reverted break failed its cover: the single-process D-13 first load, the child-stage ownership case, the workflow install case, and the whole lifecycle cascade file; three trimmed files carry ITSCOPE-01 headers and the output catalog names the storage scenario.**

## Performance

- **Duration:** 23 min of wall clock between the first and last timestamps (most of it waiting on the shared heavy-run lock)
- **Started:** 2026-11-23T04:22:21Z
- **Completed:** 2026-11-23T04:45Z
- **Tasks:** 3
- **Files modified:** 5 (4 changed, 1 deleted)

## Accomplishments

- `test/integration/load-reconcile-race.test.ts`: the D-13 single-process case and its Scenario C divider are gone; the header names two multi-process cases (ITSCOPE-01) and points at `features/plugin/config-migration.feature`.
- `test/integration/subagent-hook-ownership.test.ts`: test 1, its `STAGES` constant, and its scripted parent reply are gone; the header names one multi-process case (ITSCOPE-01, D-PG3-09) and the scenario that covers the child stages.
- `test/integration/workflow-kind-inversion.test.ts`: test 1 and the comment block that described it are gone; a new header names three internal cases (ITSCOPE-01).
- `test/integration/transaction-lifecycle-cascade.test.ts` is deleted; no file outside `.planning/` names it.
- `docs/output-catalog.md`: the workflow sentence names "Installing a plugin into the project saves its workflow in the project and nothing in the user's workflow directory" in `features/workflow/storage.feature`.

## Task Commits

1. **Task 1 (tracer): prove the delete-after-break loop on the D-13 case** - `046f916` (test)
2. **Task 2: trim subagent-hook-ownership and workflow-kind-inversion, fix the catalog pointer** - `d47d394` (test), `8997f0a` (test)
3. **Task 3: delete transaction-lifecycle-cascade** - `1c17900` (test)

**Plan metadata:** this SUMMARY's commit (docs).

## Red proofs

- Scratch folder `$D`: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase08-plan02`. Every log and script named below is kept there. The worktree's shell guard refused one-line commands that call `git` inside `$(...)` or name a `.git` path, so these verify commands ran verbatim from scripts: `verify-t1-red.sh`, `run-t1-checks.sh`, `verify-t1-files.sh`, `run-t2-breaks.sh`, `verify-t2-red.sh`, `run-t2a-checks.sh`, `run-t2b-checks.sh`, `verify-t2-files.sh`, `run-t3-breaks.sh`, `verify-t3-red.sh`, `verify-t3-unit-red.sh`, `run-t3-checks.sh`, `verify-t3-audit.sh`, `verify-t3-files.sh`, and `commit.sh` (each commit under the lock, hooks on).
- Checkout root, the first line of every break log: `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-ad7b0c9c2e59885b1`.
- Plan base (`$D/plan-base`): `17fca7ad0a642c66fd01799d08ee233390cc7449`. `git diff --stat 9aa92a1 HEAD -- . ':(exclude).planning'` printed nothing at the start, so the tree outside `.planning/` equals the planner's measured 9aa92a1.
- Inputs: `sha256sum -c --quiet SHA256SUMS` in `$I` exited 0, and `sha256sum "$I/SHA256SUMS"` printed `9ad855343cdbf5b04dbaff9df15f70f367082a31a171b980cebd5616d1541746`. Nothing was written to `$I`; no file of `planner-08/` or `research-08/` ran.
- Helpers: `break.sh` and `check-red.mjs` are Phase 7's, unchanged. `break-unit.sh` is Phase 7's `break-int.sh` with one change: the run goes through `<scratchpad>/nondac-sh` with a minimal environment (`HOME`, `PATH`, `LANG=C.UTF-8`, `TMPDIR=/tmp`), and the log is `<id>-unit.log`. `bash -n` passed on both shell helpers, and `node --check` on `check-red.mjs` and `apply-edits.mjs`. Every cucumber run chose its scenario with `--name` and an anchored title.
- Green runs, each `exit=0`: `green-t1.log` `1 scenario (1 passed)`; `green-t2.log` `4 scenarios (4 passed)`; `green-t3.log` `3 scenarios (3 passed)`; `green-units-t3.log` on the four unit files `tests 704`, `pass 704`, `fail 0` (274 + 170 + 113 + 147), with the four covering cases `✔`.
- Every break log ends with `restored=clean` and holds no step timeout, and `git status --porcelain -- extensions/` printed nothing after each run. No run needed a rerun.

- **B4** (`B4-adapter.log`, Task 1): `persistence/migrate-config.ts:178`, the lines `-    } else if (legacyAutoupdate === false) {` and `-      entry.autoupdate = false;` removed. Command: `bash "$D/break.sh" B4 adapter "$D/brk/B4.json" --name '^The first load after an upgrade from release 0\.4\.3 writes the project config with autoupdate off$' features/plugin/config-migration.feature`. `1 scenario (1 failed)`, `exit=1`. `config-migration.feature:248` failed at `Then the "claude-plugins.json" file of the project scope declares these marketplaces:` with `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` (the written config had no `autoupdate` column in place of `false`).
- **B5** (`B5-adapter.log`): `bridges/hooks/async-rewake/registry.ts:855` (in `reapOrphans`), the lines `-  if (isSubagentChild(process.env)) {`, `-    return;`, `-  }` removed. Command: the B5 row of the plan's table. `1 scenario (1 failed)`, `exit=1`. `subagent-child.feature:364` failed at `When a pi-subagents background child loads, runs the hook "child-wait" for "read the notes" until the hook ends, starts a new session, and stops` with `AssertionError [ERR_ASSERTION]: the hook parent-wait (pid 23982) no longer runs, and it logged no end`. The assertion that fired is the When step's first check of the waiting hooks (`subagent-hooks.steps.ts:513`, `session.waitingHooks()`): the sibling child's own load, in the Given before it, had already reaped the parent's hook.
- **B6a** (`B6a-adapter.log`): `domain/component-paths.ts:263` (in `markSupportedWhenCollected`), `-    resolution.supported.push(kind);` / `+    (kind === "workflows" ? (resolution as unknown as { unsupported: string[] }).unsupported : resolution.supported).push(kind);`. `1 scenario (1 failed)`, `exit=1`. `storage.feature:18` failed at `Then the command reports these results:` with `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` (`error`, `false`, `A plugin operation has failed.` in place of `info`, `true`).
- **B6b** (`B6b-adapter.log`): `bridges/workflows/stage.ts:109` (in `buildEnvelope`), `-    script: admitted.source,` / `+    script: admitted.source.replace("Hello", "Jello"),`. `1 scenario (1 failed)`, `exit=1`. `storage.feature:31` failed at `Then the workflow run ends with the status "completed" and the result "Hello from demo."` with `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` (result `Jello from demo.`).
- **B6c** (`B6c-adapter.log`): `orchestrators/plugin/install-outcome.ts:1717`, `-          workflows: [...installCtx.stagedWorkflowNames],` / `+          workflows: [],`. `1 scenario (1 failed)`, `exit=1`. `lifecycle.feature:27` (workflow) failed at `Then the command reports these results:` with `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` (severity `info` and no summary in place of `warning` and `A plugin operation needs attention.`: no stale workflow warning).
- `check-red.mjs` printed `RED-PROOFS OK` with `exit=0` for the `tracer-` tables (`red-tracer.log`) and the `t2-` tables (`red-t2.log`, B5 on a `When`, B6a to B6c on a `Then`).

- **B7** on units (`B7-unit.log`): `orchestrators/plugin/update-swap.ts:1191` (in `commitUpdateHooks`), the six-line `await writeHookConfig({ ... });` call replaced by `+  void writeHookConfig;`. Command: `bash "$D/break-unit.sh" B7 "$D/brk/B7.json" test/orchestrators/plugin/update-flow.test.ts test/orchestrators/plugin/reinstall-flow.test.ts`. `tests 444`, `pass 440`, `fail 4`, `exit=1`. Failed: `LIFE-01 (update): version A->B (both ship hooks) overwrites <hooksDir>/<plugin>/hooks.json atomically with version B's content` (`Error: ENOENT: no such file or directory, open '.../hooks/hello/hooks.json'`), `LIFE-01 (update): version A (no hooks) -> version B (with hooks) writes the new hooks.json`, `LIFE-01 (reinstall): a plugin with hooks rewrites <hooksDir>/<plugin>/hooks.json from the resolved manifest` (`AssertionError [ERR_ASSERTION]: reinstall cascade slot must rewrite hooks.json from the resolved manifest`), and `D-03 fail-continue: a hooks write that cannot land is aggregated, not thrown past the other bridges` (`AssertionError [ERR_ASSERTION]: the failing bridge must be named in:`).
- **B7i** on units (`B7i-unit.log`): `orchestrators/plugin/install-outcome.ts:1459` (the install ledger's hooks phase), the six-line `await writeHookConfig({ ... });` call replaced by `+      void writeHookConfig;`. Command: `bash "$D/break-unit.sh" B7i "$D/brk/B7i.json" test/orchestrators/plugin/install-outcome.test.ts`. `tests 113`, `pass 112`, `fail 1`, `exit=1`. Failed: `writes the hooks config and records the plugin's hooks slug on the state row` (`Error: ENOENT: no such file or directory, open '.../hooks/empty/hooks.json'`).
- **B7c** on units (`B7c-unit.log`): `orchestrators/marketplace/shared.ts:636` (in `cascadeUnstagePlugin`), `-    const hooksResult = await removeHookConfig({ locations, pluginName: plugin });` and `-    dropped.hooks = [hooksResult.removed];` replaced by `+    void removeHookConfig;` and `+    dropped.hooks = [plugin];`. Command: `bash "$D/break-unit.sh" B7c "$D/brk/B7c.json" test/orchestrators/plugin/uninstall.test.ts`. `tests 147`, `pass 127`, `fail 20`, `exit=1`. Among them `LIFE-04: manifest-absent uninstall removes the staged hooks config` (`AssertionError [ERR_ASSERTION]: staged hooks config removed`); the other 19 are the 13 `retry proof: uninstall: ...` cases and the 6 `uninstall preserves nested data only when keepData is true (...)` rows.
- **B7** on its scenario (`B7-adapter.log`): command `bash "$D/break.sh" B7 adapter "$D/brk/B7.json" --name '^Updating a plugin replaces its hooks$' features/hook/lifecycle.feature`. `1 scenario (1 failed)`, `exit=1`. `hook/lifecycle.feature:52` failed at `Then the hooks record these runs:` with `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`.
- **B7i** on its scenario (`B7i-adapter.log`): command with `--name '^A load keeps the hooks of the plugins in both scopes running \(DISP-02\)$'`. `1 scenario (1 failed)`, `exit=1`. `hook/lifecycle.feature:70` failed at `Then the hooks record these runs in any order:` with `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`.
- **B7c** on its scenario (`B7c-adapter.log`, the survivor): command with `--name '^Uninstalling a plugin stops its hooks$'`. `1 scenario (1 passed)`, `exit=0`, as the survivor row expects: the hook routing follows the record, so the hooks stop although the hooks config stays on disk. Its unit cover above is the proof for the uninstall step.
- `check-red.mjs` printed `RED-PROOFS OK` with `exit=0` for the `t3-` tables (`red-t3.log`), and `verify-t3-unit-red.sh` (the unit red verify) exited 0.

## Case map

| Integration case at 9aa92a1 | Class | Action | Cover | Breaks | Commit |
| --- | --- | --- | --- | --- | --- |
| `load-reconcile-race:276` RECON-06 two-process race | multi-process | keep (now `:277`) | - | - | kept in `046f916` |
| `load-reconcile-race:411` concurrent first-load migration | multi-process | keep (now `:412`) | - | - | kept in `046f916` |
| `load-reconcile-race:494` D-13 single-process first load | none | deleted as covered | `features/plugin/config-migration.feature:248`, the 0.4.3 project scenario (its user-scope twin at `:10`) | B4 | deleted in `046f916` |
| `subagent-hook-ownership:175` a child's stages leave parent and sibling hooks running | none | deleted as covered | `features/plugin/subagent-child.feature:364`, whose `When` asserts the same per-stage observations; the parent journal's final `{ version: 1, entries: [] }` check is owned by `test/bridges/hooks/async-rewake/registry.test.ts` | B5 | deleted in `d47d394` |
| `subagent-hook-ownership:232` a main load stops a dead child's hook and keeps a live sibling's | multi-process | keep (now `:173`) | - | - | kept in `d47d394` |
| `workflow-kind-inversion:172` WINV-02 / WBRG-01 install | none | deleted as covered | `features/workflow/storage.feature:18`, `:31`; `features/workflow/lifecycle.feature:27` | B6a, B6b, B6c | deleted in `8997f0a` |
| `workflow-kind-inversion:289`, `:349`, `:424` | internal (writes that must not happen; earlier-release records) | keep (now `:220`, `:280`, `:355`) | - | - | kept in `8997f0a` |
| `transaction-lifecycle-cascade:134` LIFE-01 / LIFE-02 cascade | none | deleted; the file goes | install: `install-outcome.test.ts` hooks case and the DISP-02 load scenario; update: the `update-flow.test.ts` `LIFE-01` cases and "Updating a plugin replaces its hooks"; reinstall: "LIFE-01 (reinstall): a plugin with hooks rewrites <hooksDir>/<plugin>/hooks.json from the resolved manifest"; uninstall: "LIFE-04: manifest-absent uninstall removes the staged hooks config"; LIFE-02 rows: every install and uninstall scenario's results | B7i, B7, B7c | deleted in `1c17900` |

## Checks

`node --version`: `v24.22.3`. Each command is the plan's verify command, run verbatim (from a script where the shell guard required it).

| Check | Log | Exit | Tree |
| --- | --- | --- | --- |
| Task 1 green cover | `green-t1.log` | 0 (`1 scenario (1 passed)`) | plan base `17fca7a` |
| Task 1 tracer red verify | `red-tracer.log` | 0 (`RED-PROOFS OK`) | plan base |
| Task 1 edits check | `edits-check-t1.log` | 0 (`EDITS CHECK OK`) | plan base + trim |
| Task 1 kept cases | `int-t1.log` | 0 (`tests 2`, `fail 0`) | plan base + trim |
| ESLint warm-up (`npm run lint`) | `lint-warm.log` | 0 | plan base + trim |
| `check:static` (1) | `check-static-1.log` | 0 | plan base + trim |
| Task 1 files verify | `verify-t1-files.sh` | 0 | `046f916` |
| Task 2 green covers | `green-t2.log` | 0 (`4 scenarios (4 passed)`) | `046f916` |
| Task 2 red verify | `red-t2.log` | 0 (`RED-PROOFS OK`) | `046f916` |
| Task 2 edits checks | `edits-check-t2a.log`, `edits-check-t2b.log` | 0 | `d47d394` + t2b |
| Task 2 kept case (subagent) | `int-t2a.log` | 0 (`tests 1`, `fail 0`) | `046f916` + t2a |
| `check:static` (2) | `check-static-2.log` | 0 | `046f916` + t2a |
| Task 2 kept cases (workflow) | `int-t2b.log` | 0 (`tests 3`, `fail 0`) | `d47d394` + t2b |
| `test:unpaired` | `unpaired-t2.log` | 0 | `d47d394` + t2b |
| `check:static` (3) | `check-static-3.log` | 0 | `d47d394` + t2b |
| Task 2 files verify | `verify-t2-files.sh` | 0 | `8997f0a` |
| Task 3 green covers | `green-t3.log` | 0 (`3 scenarios (3 passed)`) | `8997f0a` |
| Task 3 unit greens | `green-units-t3.log` | 0 (`tests 704`, `fail 0`) | plan base (same `extensions/` and unit files as `8997f0a`) |
| Task 3 red verify | `red-t3.log` | 0 (`RED-PROOFS OK`) | `8997f0a` |
| Task 3 unit red verify | `verify-t3-unit-red.sh` | 0 | `8997f0a` |
| Integration suite (`CI=1`) | `integration.log` | 0 (`tests 275`, `pass 275`, `fail 0`) | `8997f0a` minus the cascade file |
| `check:static` (4) | `check-static-4.log` | 0 | `8997f0a` minus the cascade file |
| `fallow audit --base 17fca7a` | `audit.json`, `audit-line.log` | 0 (verdict `warn`, see below) | `1c17900` |
| Final files verify | `verify-t3-files.sh` | 0 | `1c17900` |

The integration count is 275, not the planner's 265, because the planner measured with every Phase 8 edit applied; the 10 cases of `reconcile-plan-convergence`, which plan 08-01 moves, are still in this worktree. Every commit ran the full pre-commit hook; `check:commit` passed on the three commits that stage a build input and was skipped on the delete-only commit, which is why `check:static` ran by hand before each. The wave's post-merge `npm run check` is the full verdict.

## Issues for the milestone

`fallow audit --base 17fca7ad0a642c66fd01799d08ee233390cc7449` on `1c17900`: verdict `warn`, `dead_code_issues` 0, `complexity_findings` 0, `duplication_clone_groups` 0, and four `weakened-tests` (`warn`) findings, one per file of this plan: `load-reconcile-race.test.ts` (test cases `3 -> 2`), `subagent-hook-ownership.test.ts` (`2 -> 1`), `workflow-kind-inversion.test.ts` (`4 -> 3`), and `transaction-lifecycle-cascade.test.ts` (`1 -> 0`). These are the expected findings; per the user decision of 2026-11-21 there is no `.fallowrc.json` or CI change, and they are left to the milestone.

## Decisions Made

None beyond the plan: every trim is the frozen edit list, every break is the frozen break file.

## Deviations from Plan

1. **[Rule 3 - Blocking] Verify commands ran from scripts.** The worktree's shell guard refused one-line commands that call `git` inside `$(...)`, write a heredoc that names `git`, or name a path under `.git/`. As the execution rules allow, each such command ran verbatim from a script in `$D` (listed under Red proofs). For the same reason, the GSD per-plan ledger file under the worktree's git dir was not written; `$D/plan-base` holds the same base, and `commits: 4` is `git rev-list --count 17fca7a..HEAD`.
2. **Order: the Task 3 unit greens ran first.** `green-units-t3.log` ran at the plan base, before Task 1, while the first green cover waited on the lock. Plan 08-02 changes no file under `extensions/` and none of the four unit files, so the run applies unchanged to the Task 3 tree.

**Total deviations:** 2 (1 blocking-tool workaround, 1 ordering). **Impact on plan:** none on the result; every verify command and acceptance criterion passed as written.

## Issues Encountered

None. Every cover passed with no break, and every break failed exactly the rows the tables name.

## Known Stubs

None.

## Parent lines

- `CHANGELOG.md`: None.
- `.planning/BACKLOG.md`: None.
- Key Decisions table: None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

The four deletions and the three headers of this plan are on the branch. The post-merge `npm run check` of the wave and the ITSCOPE-04 gate of 08-05 are the remaining verdicts.

## Self-Check: PASSED

- Files: the three trimmed files and `docs/output-catalog.md` exist; `test/integration/transaction-lifecycle-cascade.test.ts` does not.
- Commits `046f916`, `d47d394`, `8997f0a`, `1c17900` are ancestors of HEAD.
- `git status --porcelain -- extensions/ features/ test/ docs/` printed nothing, and `git diff 17fca7a HEAD -- extensions/` is empty.

---
*Phase: 08-integration-suite-rescope*
*Completed: 2026-11-23*
