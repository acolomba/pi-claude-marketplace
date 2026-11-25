---
phase: 02-plugin-layers-names-and-list-fold
plan: "03"
subsystem: testing
tags: [cucumber, reserved-names, own-key, d-08-07, d-pl5-28, integration-rescope]
status: complete

requires:
  - phase: 01
    provides: the break-helper pattern and the red-proof record shape
provides:
  - features/plugin/reserved-names.feature (19 entries, 24 scenarios) for plugin names that are Object.prototype members
  - the deletion of test/integration/reserved-record-keys.test.ts
affects: [integration-rescope phase 8 (the integration files left), ITMIG-03]

actuals:
  tokens: 11880
  tasks: 3
  commits: 4
plan_head_before: 8cc0eee0711279faa80a36a577dcae7bde0a227d
plan_head_after: 16c9dc12d40da2155555aa18deef70ad17a22023

tech-stack:
  added: []
  patterns:
    - "A reserved-name scenario publishes its own marketplace (no Background), so the hello@constructor and __proto__ scenarios hold no step they do not need"

key-files:
  created:
    - features/plugin/reserved-names.feature
  modified: []
  deleted:
    - test/integration/reserved-record-keys.test.ts

key-decisions:
  - "N18 (uninstall, reinstall, update of an uninstalled constructor@mp) is one Outline; the enable case N19 stands alone because a skipped row has no leaks or rollback columns"

patterns-established: []

requirements-completed: [ITMIG-03]

coverage:
  - id: D1
    description: "A plugin named constructor installs, lists, shows in info, disables, enables, updates, keeps its version through a marketplace update, uninstalls, goes with its marketplace, imports with config write-back, and installs through apply"
    requirement: ITMIG-03
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter --parallel 1 features/plugin/reserved-names.feature"
        status: pass
  - id: D2
    description: "hello@constructor is refused and records nothing; __proto__ lists unavailable and its install is refused with no change; named commands on an absent constructor fail or skip as for any absent name"
    requirement: ITMIG-03
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter --parallel 1 features/plugin/reserved-names.feature"
        status: pass

duration: 30min
completed: 2026-11-21
---

# Phase 2 Plan 03: Plugin Reserved Names Summary

A new `features/plugin/reserved-names.feature` (24 scenarios) pins the own-key reads, the
D-PL5-28 marketplace-name refusal, the resolver's reserved record key, and the plugin id alphabet
for `constructor` and `__proto__`. Each of four deliberate breaks turned its scenarios red.
`test/integration/reserved-record-keys.test.ts` is deleted.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 | 36ebce2 | test(plugin): cover installing a plugin named constructor |
| 2 | c627aad | test(plugin): cover the lifecycle of a plugin named constructor |
| 3 | 5ae6d99 | test(plugin): cover __proto__ and an absent constructor name |
| 3 | 16c9dc1 | test(plugin): delete the reserved record key test that scenarios cover |

No commit changes a file under `extensions/`, a step module, a support module, or a library file.

## Red proofs

- Scratch folder: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase02-plan03` (`$D`). The helper is `$D/break.sh`; it roots itself at `git rev-parse --show-toplevel`.
- Checkout root, the `root=` line of every break log: `/home/user/pi-claude-marketplace/.claude/worktrees/agent-a7e11e9cc474f512f`.
- Green runs, adapter profile, `--parallel 1`, no break: `$D/green-1-adapter.log` `1 scenario (1 passed)`, `$D/green-13-adapter.log` `13 scenarios (13 passed)`, `$D/green-24-adapter.log` `24 scenarios (24 passed)`; each `exit=0`.
- Builtin run: `$D/builtin.log` `0 scenarios`, `exit=0` (DUAL-02: no scenario has an MCP surface or an implementation tag).
- Every break log ends with `exit=1` and `restored=clean`, holds no `function timed out`, and every failure is an `AssertionError [ERR_ASSERTION]` of a result or Given step. No break run was repeated: none had a step timeout. `git status --porcelain -- extensions/` printed nothing after each break.
- Each command was `bash "$D/break.sh" <id> adapter <file> "$D/<break>.old" "$D/<break>.new" features/plugin/reserved-names.feature`, which runs `npm run --silent test:cucumber:profile -- --profile adapter --parallel 1 features/plugin/reserved-names.feature` with the wrapper and heap prefix.

### B3, own-key reads (`extensions/pi-claude-marketplace/shared/own-key.ts:13`)

Change, from the log's diff:

```diff
-  return map !== undefined && Object.hasOwn(map, key) ? map[key] : undefined;
+  return map !== undefined && key in map ? map[key] : undefined;
```

- **B3-tracer** (`$D/B3-tracer-adapter.log`, Task 1, 1 scenario): `1 scenario (1 failed)`. N1 (`:7`) failed at `Then the result has these fields:`: severity `error`, needs reload `false`, summary `A plugin operation has failed.` instead of `info`/`true` (the cause was `Plugin "constructor" is already installed in marketplace "mp".`).
- **B3-lifecycle** (`$D/B3-lifecycle-adapter.log`, Task 2, 13 scenarios): `13 scenarios (13 failed)`.
  - N1 `:7`, at `Then the result has these fields:` (`error`, needs reload `false`).
  - N2 `:32`, N3 `:54`, N4 `:79`, N5 `:102`, N6 `:126`, N7 `:150`, N8 `:174`, N9 `:193`: each at `Given the user has run "/claude:plugin install constructor@mp --scope project"`, whose result was the `already installed` failure, which the setup step rejects.
  - N10 `:211` (import), at `Then the result has these fields:`: needs reload `false` instead of `true`.
  - N11 `:250` (disable after import), at `Then the result has these fields:`: needs reload `false` instead of `true`.
  - N12 `:283` (uninstall after import), at `Then the result has these fields:`: severity `error`, needs reload `false`, summary `A plugin operation has failed.`.
  - N13 `:315` (apply), at `Then the result has these fields:`: severity `error`, needs reload `false`, tally `1` failure and success count `1`, summary `A plugin operation has failed.`.
- **B3** (`$D/B3-adapter.log`, Task 3, 24 scenarios): `24 scenarios (2 passed, 22 failed)`.
  - N1 to N13 failed again at the same steps as in B3-lifecycle.
  - N14 `:343`, at `Then the result lists these plugins:`: marketplace reasons `source mismatch` instead of `invalid manifest`.
  - N17 rows: `:437` (`info x@constructor`) at `Then the result has these fields:`, kind `internal-error`, summary `Command failed unexpectedly.`, cause `Cannot read properties of undefined (reading 'autoupdate')`; `:438` (`reinstall x@constructor`) at the same step, kind `cascade`, summary `A plugin operation has failed.`; `:439` (`marketplace update constructor`) at the same step, kind `cascade`, summary `Some operations have failed.`; `:440` (`marketplace remove constructor`) at the same step, kind `internal-error`, cause `Cannot convert undefined or null to object`.
  - N18 rows: `:466` (`uninstall`) at `Then the result lists these plugins:`, status `failed`, reasons `unreadable`, cause `Cannot read properties of undefined (reading 'skills')`; `:467` (`reinstall`) at `Then the result has these fields:`, severity `info` and no summary; `:468` (`update`) at `Then the result has these fields:`, severity `warning`, summary `A plugin operation needs attention.`.
  - N19 `:470` (`enable`), at `Then the result lists these plugins:`: a `failed` row with cause, leaks, and rollback columns instead of the `skipped` row.
  - Passed: N15 `:369` (`__proto__` list) and N16 `:390` (`__proto__` install). Neither reads an absent `constructor`; B5 and B13 guard them.

### B4, the `Object.prototype` marketplace-name refusal (`extensions/pi-claude-marketplace/domain/name.ts:360`)

```diff
-  return !recorded && Object.hasOwn(Object.prototype, name)
+  return !recorded && Object.hasOwn(Object.prototype, name) && name === "never-a-name"
```

`$D/B4-adapter.log`: `24 scenarios (23 passed, 1 failed)`. N14 `:343` failed at `Then the result has these fields:`: needs reload `true`, severity `info`, no summary, tally failures `0` instead of `false`, `error`, `Some operations have failed.`, `2`. The marketplace `constructor` was added. The other 23 passed.

### B5, the resolver's reserved record key (`extensions/pi-claude-marketplace/domain/plugin-resolver.ts:620`)

```diff
-  if (isReservedRecordKey(entry.name)) {
+  if (isReservedRecordKey(entry.name) && entry.name === "never-a-name") {
```

`$D/B5-adapter.log`: `24 scenarios (23 passed, 1 failed)`. N15 `:369` failed at `Then the result lists these plugins:`: the `__proto__@hostile` row read `available` with no reasons instead of `unavailable` `unsupported source`. The other 23 passed.

### B13, the plugin id alphabet (`extensions/pi-claude-marketplace/domain/dependencies.ts:47`)

```diff
-const TOKEN_PATTERN = /^[A-Za-z0-9][-A-Za-z0-9._]{0,255}$/;
+const TOKEN_PATTERN = /^[A-Za-z0-9_][-A-Za-z0-9._]{0,255}$/;
```

`$D/B13-adapter.log`: `24 scenarios (23 passed, 1 failed)`. N16 `:390` failed at `Then the result lists these plugins:`: the row read `unavailable` `unsupported source` with no scope, cause, leaks, or rollback columns instead of `failed` `invalid manifest` with the invalid-id cause. The other 23 passed.

No targeted break of Task 3 step 4 was needed: B3 failed all 4 N17 rows, all 3 N18 rows, and N19.

## Case map

| Case of the deleted file | Scenarios that replace it | Break that failed them |
| --- | --- | --- |
| lifecycle: install, list, info, disable, enable, uninstall as an own record | N1 `:7`, N2 `:32`, N3 `:54`, N4 `:79`, N5 `:102`, N8 `:174` | B3 |
| reload declaring `constructor@mp` installs it | N13 `:315` | B3 |
| reload declaring `hello@constructor` records nothing (D-PL5-28) | N14 `:343` | B4 (and B3) |
| update, then `marketplace update mp`, then `marketplace remove mp` | N6 `:126`, N7 `:150`, N9 `:193` | B3 |
| import of `constructor@mp`, disable and uninstall write the config back | N10 `:211`, N11 `:250`, N12 `:283` | B3 |
| `__proto__` lists unavailable and its install is refused with no file change | N15 `:369`, N16 `:390` | B5 (N15), B13 (N16) |
| absent `info x@constructor` | N17 row `:437` | B3 |
| absent `reinstall x@constructor` | N17 row `:438` | B3 |
| absent `marketplace update constructor` | N17 row `:439` | B3 |
| absent `marketplace remove constructor` | N17 row `:440` | B3 |
| absent `uninstall constructor@mp` | N18 row `:466` | B3 |
| absent `reinstall constructor@mp` | N18 row `:467` | B3 |
| absent `update constructor@mp` | N18 row `:468` | B3 |
| absent `enable constructor@mp` (skipped) | N19 `:470` | B3 |

The integration file's `__proto__` case also installed `constructor@mp` and `hello@hostile` beside it, and compared every file under the sandbox root. N16 checks the config and record bytes, the absent local config, and the staged skills. The integration file's absent-name cases also ran each command on `absent`; each scenario instead checks the full result that an absent name gives.

## Checks

Node: `v24.22.3`. Every run used the wrapper `nondac-sh` and `NODE_OPTIONS=--max-old-space-size=6144`, and every lint, `check:static`, audit, and commit ran under `flock -w 3600 phase02-heavy.lock`.

| Command | Log | Exit | Tree |
| --- | --- | --- | --- |
| `npm run lint` (ESLint warm-up) | `$D/lint-warm.log` | 0 | 8cc0eee + N1 (uncommitted) |
| green, 1 scenario, adapter | `$D/green-1-adapter.log` | 0 | 8cc0eee + N1 |
| B3-tracer verify | `$D/B3-tracer-adapter.log` | 0 | 8cc0eee + N1 |
| `npm run check:static` | `$D/check-static-1.log` | 0 | 8cc0eee + N1 |
| task 1 scope verify | (stdout) | 0 | 36ebce2 |
| green, 13 scenarios, adapter | `$D/green-13-adapter.log` | 0 | 36ebce2 + N2..N13 |
| B3-lifecycle verify | `$D/B3-lifecycle-adapter.log` | 0 | 36ebce2 + N2..N13 |
| `npm run check:static` | `$D/check-static-2.log` | 0 | 36ebce2 + N2..N13 |
| green, 24 scenarios, adapter | `$D/green-24-adapter.log` | 0 | c627aad + N14..N19 |
| break verify (B3, B4, B5, B13), `$D/verify-breaks.sh` | the four break logs | 0 | c627aad + N14..N19 |
| `npm run check:static` | `$D/check-static-3.log` | 0 | c627aad + N14..N19 |
| `npm run check:static` (after `git rm`) | `$D/check-static-4.log` | 0 | 5ae6d99 + deletion staged |
| `npx --no fallow audit --base 8cc0eee`, `$D/verify-audit.sh` | `$D/audit.json` | 0 | 16c9dc1 |
| builtin, `features/plugin/reserved-names.feature` | `$D/builtin.log` | 0 | 16c9dc1 |
| final verify, `$D/verify-final.sh` | (stdout) | 0 | 16c9dc1 |

Each `SKIP=npm-check pre-commit run --files features/plugin/reserved-names.feature` passed with no fix. Inside the worktree each commit hook ran its fixers and gitlint and skipped `npm run check:commit` ("no files to check"). The wave's post-merge `npm run check` is the full verdict.

Acceptance counts: `(D-08-07)` 18, `(D-PL5-28)` 1, `Scenario Outline:` 2, tags 0, `Background:` 0; `git grep -l 'reserved-record-keys' -- . ':(exclude).planning'` exits 1 and prints nothing.

## Issues for the milestone

`fallow audit --base 8cc0eee`: `verdict=warn`, summary `{"dead_code_issues":0,"dead_code_has_errors":false,"complexity_findings":0,"max_cyclomatic":null,"duplication_clone_groups":0}`, and one diff-risk finding, `weakened-tests:test/integration/reserved-record-keys.test.ts`. That is the expected test-removal warning. Under the user decision of 2026-11-21, `.fallowrc.json` and the CI workflows are unchanged, and the milestone handles the finding.

## Deviations from Plan

- **Verify commands run as scripts.** The worktree's shell guard refused the plan's compound verify commands that call `git` in a substitution. The Task 1 and Task 2 break verifies ran with the checkout root written out, and `git status --porcelain -- extensions/` ran as its own command. The Task 3 break, audit, and final verifies ran unchanged from `$D/verify-breaks.sh`, `$D/verify-audit.sh`, and `$D/verify-final.sh`, as the execution rules allow.
- **The helper's trap.** `break.sh` sets its EXIT trap right after the replacement succeeds, in the plan's order (c) then (d). A refused replacement exits 3 before it, with nothing changed.
- **Under B3, N16 passed beside N15.** The plan named only N15 as the scenario B3 leaves passing. N16 reads no absent `constructor` either, and B13 fails it.
- **Under B3, N14 failed too** (`source mismatch` instead of `invalid manifest`), in addition to its B4 failure.
- No expected value differed from the plan, no scenario was strengthened, and no product bug was found (rule 4 not used).

## Parent lines

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: `features/plugin/reserved-names.feature`; `test/integration/reserved-record-keys.test.ts` is absent.
- FOUND on HEAD's history: 36ebce2, c627aad, 5ae6d99, 16c9dc1.
