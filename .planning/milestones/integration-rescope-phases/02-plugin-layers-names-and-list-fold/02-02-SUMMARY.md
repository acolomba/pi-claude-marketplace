---
phase: 02-plugin-layers-names-and-list-fold
plan: "02"
subsystem: testing
tags: [cucumber, behavioral-tests, plugin-layers, reconcile, apply, pending, integration-migration]

requires:
  - phase: 01
    provides: the break-helper pattern and the red-proof record format
provides:
  - six apply scenarios of the plugin-layer consistency cases in features/plugin/configuration.feature
  - the pending and apply scenarios before the first-run migration in features/plugin/config-migration.feature
  - the deletion of test/integration/plugin-layer-consistency.test.ts
affects: [integration-rescope, phase-08]

actuals:
  tokens: 9205
  tasks: 3
  commits: 3
plan_head_before: 8cc0eee0711279faa80a36a577dcae7bde0a227d
plan_head_after: 25954ec305ac938a301fd53025ba7efd43087227

tech-stack:
  added: []
  patterns:
    - "Break helper that roots itself at git rev-parse --show-toplevel, refuses a dirty extensions/ tree, and restores in an EXIT trap set before the replacement"

key-files:
  created: []
  modified:
    - features/plugin/configuration.feature
    - features/plugin/config-migration.feature
  deleted:
    - test/integration/plugin-layer-consistency.test.ts

key-decisions:
  - "No pending twin of C08 was added: B14 failed the existing pending scenario at configuration.feature:61, so RESEARCH assumption A2 held"

patterns-established:
  - "A layer-gap scenario pairs the remembered-bytes check (base config and state.json only) with a local-layer check (declares these plugins / holds this text) and the staged-skills table"

requirements-completed: [ITMIG-02]

coverage:
  - id: D1
    description: "Apply stops on a project local gap, a base gap, a user-scope local gap, and a legacy local layer, each as one invalid-config row that changes no file"
    requirement: ITMIG-02
    verification:
      - kind: other
        ref: "npm run test:cucumber:profile -- --profile adapter --parallel 1 features/plugin/configuration.feature features/plugin/config-migration.feature (27 passed; B8 fails the four)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Apply reports demo@ as a source mismatch and ghost@nowhere as a dangling reference while the base layer's plugin installs"
    requirement: ITMIG-02
    verification:
      - kind: other
        ref: "same run; B10 and B11 fail the two scenarios"
        status: pass
    human_judgment: false
  - id: D3
    description: "Before the first-run migration, pending reports the local gap and writes no project config, and apply stops on it and keeps the plugin"
    requirement: ITMIG-02
    verification:
      - kind: other
        ref: "same run; B9 and B14 fail the pending scenario, B8 the apply scenario"
        status: pass
    human_judgment: false
  - id: D4
    description: "test/integration/plugin-layer-consistency.test.ts is deleted and check:static passes without it"
    requirement: ITMIG-02
    verification:
      - kind: other
        ref: "npm run check:static (exit 0 at the deletion commit)"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-11-21
status: complete
---

# Phase 2 Plan 02: Plugin-Layer Consistency Scenarios Summary

**Eight cucumber scenarios replace the seven cases of `plugin-layer-consistency.test.ts`: apply's layer gaps (project local, base, user local, legacy `--local` layer), the `demo@` source mismatch, the dangling reference beside an installing plugin, and pending/apply before the first-run migration. Each one failed under a deliberate break, and then the integration file was deleted.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-11-21T18:16:57Z
- **Completed:** 2026-11-21T18:44:56Z
- **Tasks:** 3
- **Files modified:** 3 (2 feature files changed, 1 integration file deleted)

## Accomplishments

- Six new `apply` scenarios in `features/plugin/configuration.feature` (lines 117, 148, 182, 213, 245, 275).
- Two new scenarios in `features/plugin/config-migration.feature` (lines 191 and 218) for the time before the first-run migration.
- Breaks B8, B9, B14, B10, and B11 each failed their expected scenarios on an assertion. No run hit a step timeout, and every file was restored clean.
- `test/integration/plugin-layer-consistency.test.ts` is deleted. `check:static` passes, and the audit shows only the expected `weakened-tests` warning.

## Task Commits

1. **Task 1: Prove the layer-gap loop end to end on the local-gap apply scenario**: `28fdb5c` (test)
2. **Task 2: Add the other seven consistency scenarios and record breaks B8, B9, B14, B10, B11**: `f6e94f0` (test)
3. **Task 3: Delete the plugin-layer consistency integration file**: `25954ec` (test)

## Red proofs

- **Scratch folder:** `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase02-plan02` (`$D`). Helper: `$D/break.sh`. Failure extractor: `$D/failures.py`. Shell-guard wrappers: `$D/commit.sh`, `$D/verify-t1.sh`, `$D/verify-t2.sh`, `$D/verify-t2-breaks.sh`, `$D/verify-t3.sh`.
- **Checkout root:** every break log's first line is `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-a35bc76c223879a0c`, which is this plan's worktree.
- **Plan base:** `8cc0eee0711279faa80a36a577dcae7bde0a227d`. The break sites matched the plan's line numbers (read at a9bbcf10) at this base.
- **Green runs:**
  - `$D/green-configuration-adapter.log`: `7 scenarios (7 passed)`, `exit=0` (after C08).
  - `$D/green-both-adapter.log`: `27 scenarios (27 passed)`, `exit=0` (both files, after all eight scenarios).
- **Builtin run:** `$D/builtin.log`: `0 scenarios`, `exit=0`. No scenario here has an MCP surface, so the builtin profile selects none of them (DUAL-02).
- Every break run was `bash "$D/break.sh" <id> adapter <file> "$D/<id>.old" "$D/<id>.new" <features...>`, which runs `npm run --silent test:cucumber:profile -- --profile adapter --parallel 1 <features...>` with the nondac-sh shell prefix. Each log ends with `restored=clean`, and `git status --porcelain -- extensions/` printed nothing after each break. No log contains `function timed out`, so no run was repeated.

- **B8, tracer (Task 1):** `extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts:357`. The change, `-      invalidOutcomes.push(...layerMarketplaceGapOutcomes(outcome, loc, scope));`, became `+      invalidOutcomes.push(...layerMarketplaceGapOutcomes(outcome, loc, scope).slice(1));`. The run covered `features/plugin/configuration.feature`. Log `$D/B8-tracer-adapter.log`: `7 scenarios (6 passed, 1 failed)`, `exit=1`.
  - Failed: "Applying a local layer that declares a plugin whose marketplace only the base layer declares fails as an invalid config and changes nothing (LAYER-06, CFG-03)" (`configuration.feature:117`). The failing step was `Then the result has these fields:`, with `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`. The result had `needs reload` `true` (expected `false`), `severity` `info` (expected `error`), no `summary`, and `tally failures` `0` (expected `1`).
  - Passed: the six existing scenarios at lines 13, 27, 44, 61, 79, and 99. The pending and load paths do not go through the read pass's gap push.
- **B8 (Task 2):** same file, line, and change. The run covered both feature files. Log `$D/B8-adapter.log`: `27 scenarios (22 passed, 5 failed)`, `exit=1`. All five failed at `Then the result has these fields:` with the same AssertionError and the same envelope difference:
  - C02, `configuration.feature:182`, "Applying the user scope while its local layer declares ...".
  - C03, `configuration.feature:148`, "Applying a base layer that declares a plugin whose marketplace only the local layer declares ...".
  - C08, `configuration.feature:117`.
  - C04, `configuration.feature:213`, "Applying reports a local layer that an earlier --local install wrote ...".
  - C05b, `config-migration.feature:218`, "Applying before the first-run migration stops on the local config's missing marketplace and keeps the plugin installed (MIG-01, LAYER-06)".
  - Passed: the other 22, among them C05, C06, and C07, as the research predicted.
- **B9:** `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:231`. The change, `-    outcome.base.status === "valid" ? outcome.base.config : buildConfigFromState(state, local);`, became `+    outcome.base.status === "valid" ? outcome.base.config : {};`. Log `$D/B9-adapter.log`: `27 scenarios (26 passed, 1 failed)`, `exit=1`.
  - Failed: C05, `config-migration.feature:191`, "Pending before the first-run migration reports the local config's missing marketplace and writes no project config (MIG-01, LAYER-06)". The failing step was `Then the result has these fields:` with the AssertionError. The kind was `reconcile-pending-empty` (expected `cascade`), the severity `info` (expected `error`), and the summary and failure tally were missing.
  - Passed: the other 26.
- **B14:** `pending.ts:232`. The change, `-  return findLayerMarketplaceGaps(base, local).map((gap) =>`, became `+  return findLayerMarketplaceGaps(base, local).slice(0, 0).map((gap) =>`. Log `$D/B14-adapter.log`: `27 scenarios (23 passed, 4 failed)`, `exit=1`. Each failure was an AssertionError, with `reconcile-pending-empty` in place of the `cascade` error:
  - C05, `config-migration.feature:191`, at `Then the result has these fields:`.
  - "A base layer that declares a plugin without its marketplace is reported as an invalid config", `configuration.feature:99`, at `Then the result has these fields:`.
  - "A local layer that declares a plugin without its marketplace is reported as an invalid config", `configuration.feature:61`, at `Then the result has these fields:`.
  - "A new session does not install a plugin whose local layer lacks its marketplace", `configuration.feature:79`, at `Then the session reports these results:`.
  - Passed: the other 23.
  - **RESEARCH assumption A2 holds.** B14 fails the line-61 pending scenario, so that scenario proves the pending half of integration case `:146`. No pending twin of C08 was needed. B14 also failed line 79, the load preview, which the plan did not list as expected.
- **B10:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:471-473`. The break inserted `+    acc.dangling.pop();` as the new line 474, after the `cause: "malformed-plugin-key",` / `rawKey: key,` / `});` push. Log `$D/B10-adapter.log`: `27 scenarios (26 passed, 1 failed)`, `exit=1`.
  - Failed: C06, `configuration.feature:245`, "Applying a local layer that declares a plugin key without a marketplace reports a source mismatch and still installs the base layer's plugin". The failing step was `Then the result has these fields:` with the AssertionError. The severity was `info` (expected `error`), the summary `A marketplace operation has failed.` was missing, and `tally failures` was `0` (expected `1`).
  - Passed: the other 26.
- **B11:** `plan.ts:487-490`. The break inserted `+    acc.dangling.pop();` as the new line 491, after the `cause: "dangling-reference",` / `marketplace: declaredMarketplace,` / `plugin,` / `});` push. Log `$D/B11-adapter.log`: `27 scenarios (25 passed, 2 failed)`, `exit=1`. Both failed at `Then the result has these fields:` with the AssertionError:
  - C07, `configuration.feature:275`, "Applying a local layer that declares a plugin of a marketplace no layer declares reports a dangling reference and still installs the base layer's plugin". The severity was `info` (expected `error`), the summary `Some operations have failed.` was missing, and `tally failures` was `0` (expected `2`).
  - The existing "A plugin whose marketplace no layer declares keeps its dangling reference row", `configuration.feature:44`, where the kind was `reconcile-pending-empty` (expected `cascade`).
  - Passed: the other 25.

## Case map

| Integration case (`plugin-layer-consistency.test.ts`) | Replacing scenario(s) | Break that failed it |
| --- | --- | --- |
| `:146` "a local layer that declares a plugin whose marketplace only the base layer declares stops the reload and changes no file" | C08 `configuration.feature:117` (apply half); existing `configuration.feature:61` (pending half) | B8 (C08); B14 (line 61) |
| `:184` "a base layer that declares a plugin whose marketplace only the local layer declares stops the reload and changes no file" | C03 `configuration.feature:148` | B8 |
| `:209` "a local layer of the user scope that declares a plugin without its marketplace stops the user reload" | C02 `configuration.feature:182` | B8 |
| `:228` "the local layer an earlier --local install wrote keeps its bytes and its plugin stays recorded" | C04 `configuration.feature:213` | B8 |
| `:260` "before the first-run migration, pending reports the layer error the reload stops on" | C05 `config-migration.feature:191` (pending); C05b `config-migration.feature:218` (apply) | B9 and B14 (C05); B8 (C05b) |
| `:297` "a plugin whose marketplace no layer declares keeps its dangling reference row while a declared plugin installs" | C07 `configuration.feature:275` | B11 |
| `:330` "a malformed plugin key reaches the planner's diagnostic and no layer error" | C06 `configuration.feature:245` | B10 |

## Checks

Node `v24.22.3` ran every check. Each check ran in this worktree with the nondac-sh prefix.

| Command | Exit | Commit / tree |
| --- | --- | --- |
| Green `configuration.feature` adapter (`$D/green-configuration-adapter.log`) | 0, `7 scenarios (7 passed)` | `8cc0eee` + C08, uncommitted |
| B8 tracer verify (`$D/verify-t1.sh`, `verify-b8-tracer`) | 0 | `28fdb5c` |
| `npm run lint` warm-up under the lock (`$D/lint-warm.log`) | 0 | `8cc0eee` + C08 |
| `npm run check:static` (`$D/check-static-1.log`) | 0 | `8cc0eee` + C08, uncommitted (committed unchanged as `28fdb5c`) |
| Task 1 diff verify (`$D/verify-t1.sh`, `verify-diff`) | 0 | `28fdb5c` |
| Green both files adapter (`$D/green-both-adapter.log`) | 0, `27 scenarios (27 passed)` | `28fdb5c` + Task 2 edits, uncommitted |
| Break detection verify (`$D/verify-t2-breaks.sh`) | 0 | same tree |
| `npm run check:static` (`$D/check-static-2.log`) | 0 | same tree (committed unchanged as `f6e94f0`) |
| Task 2 diff verify (`$D/verify-t2.sh`) | 0 | `f6e94f0` |
| `npm run check:static` (`$D/check-static-3.log`) | 0 | `f6e94f0` + staged deletion (committed unchanged as `25954ec`) |
| `npx --no fallow audit --base 8cc0eee... --format json` (`$D/audit.json`) | 0 (filter), verdict `warn` | `25954ec` |
| Builtin profile over both files (`$D/builtin.log`) | 0, `0 scenarios` | `25954ec` |
| Final verify (`$D/verify-t3.sh`, `verify-final`) | 0 | `25954ec` |

The commit hook ran on all three commits. Its `npm run check:commit` step printed `(no files to check) Skipped` each time, so each task's hand-run `check:static` is that commit's static check. The full verdict is the wave's post-merge `npm run check`.

## Issues for the milestone

- `fallow audit --base 8cc0eee0711279faa80a36a577dcae7bde0a227d` gives verdict `warn` with summary `{"dead_code_issues":0,"dead_code_has_errors":false,"complexity_findings":0,"max_cyclomatic":null,"duplication_clone_groups":0}`. It has one diff-risk finding, `weakened-tests:test/integration/plugin-layer-consistency.test.ts`. That finding is the expected test-removal warning. It stays with the milestone, with no `.fallowrc.json` or CI change (user decision 2026-11-21).

## Decisions Made

- No pending twin of C08 was added, because B14 failed the existing line-61 pending scenario (A2 held).

## Deviations from Plan

1. **[Rule 3 - Blocking] Wrapper scripts for git-bearing commands.** The worktree's shell guard refused the plan's one-line verify commands and the `flock ... env ... git commit` command, because they name git in a compound form. As the execution rules allow, I copied those commands verbatim into scripts under `$D` (`commit.sh`, `verify-t1.sh`, `verify-t2.sh`, `verify-t2-breaks.sh`, `verify-t3.sh`) and ran the scripts. The commands themselves are unchanged.
2. **Helper step order.** `break.sh` sets its EXIT trap (d) before the replacement (c), as Phase 1's helper did, so a crash during the write still restores the file. When the old text does not occur exactly once, the helper still exits 3, and the restore it then runs changes nothing.
3. **Extra checks beyond the plan's tables.** C03, C02, and C04 also check the staged skills, and C05b checks the record and staged skills. All of these come from the `<context>` table. C06 and C07 also check the installation record (`other@fixtures 1.0.0 true`), which the `<context>` table names for both.
4. **An extra failure under B14.** B14 also failed "A new session does not install a plugin whose local layer lacks its marketplace" (`configuration.feature:79`), which the plan did not list. That scenario's load preview goes through `pending.ts`, so the failure is expected. It does not change the plan's result.

Every expected value matched the observed value. No scenario needed strengthening, and Rule 4 never applied.

**Total deviations:** 1 auto-fixed (Rule 3) and 3 notes. **Impact:** none on scope or results.

## Issues Encountered

None.

## Known Stubs

None.

## Parent lines

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- ITMIG-02 is covered. The wave's post-merge `npm run check` on the combined tree is the full verdict.

## Self-Check: PASSED

- FOUND: features/plugin/configuration.feature (6 new scenarios, 4 `(LAYER-06, CFG-03)` titles)
- FOUND: features/plugin/config-migration.feature (2 `(MIG-01, LAYER-06)` titles)
- ABSENT (as intended): test/integration/plugin-layer-consistency.test.ts
- FOUND commits: 28fdb5c, f6e94f0, 25954ec (ancestors of HEAD)

---
*Phase: 02-plugin-layers-names-and-list-fold*
*Completed: 2026-11-21*
