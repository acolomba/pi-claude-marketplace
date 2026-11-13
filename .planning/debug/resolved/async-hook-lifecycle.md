---
status: resolved
trigger: "Repeated ASYNCLIFECYCLE-01 failures during parity-gaps Phase 2 full gates"
created: 2026-11-13T05:54:00Z
updated: 2026-11-13T06:43:05Z
---

## Symptoms

expected: Background hooks report their actual exit code, wake the model on exit 2, and stop on reload/restart. Existing real-Pi tests pass without relaxing their checks.
actual: Intermittent exit-code mismatch, still-running hook processes after reload, and missing rewake events. The latest gate failed the rewake-during-tool scenario after 20 seconds.
errors: features/hook/async.feature:478, async.steps.ts:217, no matching record within 20000 ms (PiProcess.waitForRecord). Earlier cleanup failures named PIDs 1667244, 1667363, 1685320 and 2258111; an earlier exit assertion observed 0 instead of 1.
timeline: First observed during Phase 2 wave 4. Cleanup also failed on the pre-wave commit 309a45559e9f086d76198acae906b038a4c9e1bc. Other symptoms are not yet proven to share its cause. Current HEAD 963f3459aa810fe6a9d04cc04ed6b0bbe7f27a0e, Node v26.13.0.
reproduction: npm run check (normal eight-worker adapter profile), latest seed 530253. 1853/1854 scenarios passed. Earlier whole async feature and broad hook/skill runs reproduced cleanup. Preserve process identity, lifecycle and RPC evidence at the failure before teardown erases it.

## Current Focus

hypothesis: Confirmed fixture leak: a registered async child can outlive teardown before writing its script PID file, then contaminate the next scenario's lifecycle wait.
test: Full combined-tree `npm run check` at a01d79d6 on Node v26.13.0.
expecting: Adapter and builtin real-Pi scenarios, static checks, and direct coverage pass.
next_action: None; fixture cause fixed and full gate passed. The historical exit-code mismatch remains unproven as a separate cause.

reasoning_checkpoint:
  hypothesis: "The test fixture leaks a registered background hook because stopHookScripts sees only script PID files; a child scheduled after that one scan survives scenario teardown and writes into the reused sandbox."
  confirming_evidence:
    - "A failure snapshot showed a live sleeping wake.sh orphan (PPid 1205) while the current profile Pi was active."
    - "The next scenario's harness contained a wake run from prompt next with a different session ID before its own run the tool prompt."
    - "A deterministic regression with a table-owned child and no script PID file failed on the current helper: the child remained alive until the test's timeout."
  falsification_test: "If the same table-owned child still survives after cleanup signals its recorded process group, or if the saved Cucumber order still shows a prior-session hook in the next harness, the hypothesis or fix is incomplete."
  fix_rationale: "The registry records the child's PID before the script starts. Reading that table lets fixture teardown signal the detached child group before a late script can write its PID file."
  blind_spots: "The prior scenario's PID table was not captured before reset. A leader that exits before table cleanup while an unrecorded descendant has not written a script PID file could remain. The separate exit-code mismatch has not been reproduced with a full snapshot."
  candidate_causes:
    - "code: stopHookScripts reads only script PID files once and misses registered children that have not started their script"
    - "environment: eight Cucumber workers can delay child scheduling across scenario teardown and sandbox reset"
    - "data: name-only lifecycle waits accept an earlier run's end when the reused harness contains two runs of wake"
  and_gate: "Yes: the fixture's incomplete cleanup and delayed child start must coincide for the cross-scenario leak; name-only waits turn the leak into a false completion and missing summary."

## Evidence

- Latest failure: /tmp/pg2-wave6-check-corrected.log, seed 530253, async.feature:478. Gate exited 1, no active gate process remains.
- Prior cleanup baseline: /tmp/pg2-wave4-async-baseline.log, seed 853766, 17/18 passed on pre-wave 309a4555. Temporary baseline snapshot /tmp/pg2-wave4-baseline-snp68n2l.
- Other earlier logs: /tmp/pg2-wave4-async-feature.log, /tmp/pg2-wave4-async-feature-isolated.log, /tmp/pg2-wave4-async-repro.log.
- Executor broad run: /tmp/pg205-broad-final.log, seed 367329, 72/74 passed; async.feature:342 cleanup PID 2258111. The other failure was a stale skill Read fixture, already corrected.
- Two recent full adapter passes at earlier gate attempts do not resolve this issue. Their later unit expectation failures were separately fixed in 78a9502c and 963f3459; the entire unit suite then passed.
- BACKLOG ASYNCLIFECYCLE-01 and WINDOWS #114 remain open. Do not conflate historical resolved async-rewake-lane-inert with this recurrence without evidence.
- 2026-11-13: Knowledge-base candidate ci-hook-kill-no-effect describes prior shell-child survivor; the current registry already spawns detached and uses asGroupLeader, so this is only a candidate for a residual gap.
- 2026-11-13: async.steps.ts:217 wraps the whole step; its four record waits are tool_execution_start, async-rewake-summary, and agent_settled after summary. The historic stack alone does not identify which wait timed out.
- 2026-11-13: PiProcess.waitForRecord timeout includes only stderr, not records or wait predicate. The fixture's After release stops Pi and kills hook scripts, erasing process identity before diagnosis.
- 2026-11-13: Failure class is intermittent/concurrent; a single successful retry cannot prove repair. SBFL skipped because no stable failing per-test spectrum exists.
- 2026-11-13: Exact rewake-during-tool scenario passed in isolation under adapter profile, seed 130097, 13/13 steps, 16.8 s. This refutes a deterministic failure of its basic code path but does not explain the full-gate failure.
- 2026-11-13: Entire async.feature passed with eight workers, seed 705330, 19/19 scenarios and 294/294 steps. Failure-only rewake diagnostics produced no output because the scenario passed.
- 2026-11-13: Historic cleanup PIDs 1667244, 1667363, 1685320, 2258111 are no longer present on the host; historical logs lack /proc state, so they do not show whether the processes were live or zombies.
- 2026-11-13: Exact prior failing order seed 793972 reproduced 2/19 failures. Timeout scenario async.feature:380: /proc/2874924/status showed `wake.sh`, State S (sleeping), PPid 1205, process group 2874924. Lifecycle log had starts for 2874924 and 2875258, no end for either. Project PID table was empty. This refutes zombie/recycled-PID explanations for 2874924; it was a live script. Rewake scenario async.feature:503 stalled at `rewake summary`; a hook PID remained running. The original full output was truncated by the command output budget, so the next run will preserve it to /tmp.
- 2026-11-13: Second seed-793972 run preserved at /tmp/async-lifecycle-diagnostic.log. Rewake scenario alone failed: RPC reached tool_execution_start, no rewake-summary. Since the step began, lifecycle gained `wake` PID 2878056 end code 0, then PID 2878481 start; the one current hook-run had UserPromptSubmit, and PID 2878481 remained running. releaseWaitingHook waits for any end of the same hook after its timestamp, so it accepted PID 2878056 although the current script had not ended. This is an observed fixture wait error; the origin of PID 2878056 remains unproven.
- 2026-11-13: Both suspect scenarios passed alone (timeout 16/16 steps; rewake-with-Stop 13/13), supporting an order/concurrency trigger rather than deterministic per-scenario failure.
- 2026-11-13: Third seed-793972 run preserved at /tmp/async-lifecycle-diagnostic-2.log. A different scenario, async.feature:86, failed waiting for the rewake summary after release; current releaseHook has no pre-teardown diagnostics, so the hook's exit code is unknown. 18/19 scenarios passed.
- 2026-11-13: Fourth seed-793972 run preserved at /tmp/async-lifecycle-diagnostic-3.log. Rewake-with-Stop failed again. Its all-logs snapshot held a prior `UserPromptSubmit` run with prompt `next`, session `01a1d387-1604-71ab-a35f-53ff8ca195d4`, and PID 2883513 start before this step. Current prompt `run the tool` had session `01a1d387-22da-7385-b702-70721b404dec` and PID 2883916. During the current step the old PID logged end code 0; the current PID stayed sleeping. The preceding worker reset deletes all sandbox files, so the prior run's reappearance in the new harness proves the old process was alive or started late across the scenario boundary. `releaseWaitingHook` matched the old end because it filters only hook name and phase. This directly explains the missing summary for this run.
- 2026-11-13: Cleanup failure PID 2874924 had PPid 1205, the host user systemd PID, while the current profile Pi was still active. This proves the sleeping script was orphaned from an earlier Pi, not the current dispatch. `stopHookScripts` reads only existing `hook-*.pid` files once after Pi exits; it cannot see a detached child that has not written that file yet.
- 2026-11-13: A reload-generation race is possible in `spawnAndRegister` because it awaits prepareAsyncEnv before registering the child. The reproduced timeout and rewake scenarios did not reload after dispatch, so that race does not explain the observed cross-scenario failures.
- 2026-11-13: New regression `test/architecture/hook-script-cleanup.test.ts` starts a detached child with the registry marker and persisted table entry but no script PID file. Before any fix, stopHookScripts returned without signalling it; the child's exit wait aborted after 1.5 seconds. Test exited 1 and cleaned up the child.
- 2026-11-13: After fixture cleanup reads the PID table and signals the registered process group, the focused regression passed in 23.6 ms. The same async.feature order seed 793972 passed 19/19 scenarios and 294/294 steps (log /tmp/async-lifecycle-after-fix-seed793972.log). One passing concurrent run does not yet prove stability.
- 2026-11-13: Temporary failure diagnostics were removed after their outputs were saved in /tmp. Fixed async.feature passed three eight-worker random orders: seeds 793972, 853766 and 367329, each 19/19 scenarios and 294/294 steps. Logs: /tmp/async-lifecycle-after-fix-seed793972.log, /tmp/async-lifecycle-after-fix-seed853766.log, /tmp/async-lifecycle-after-fix-seed367329.log.
- 2026-11-13: `npm run check:static`, Fallow guard and `fallow audit --base HEAD` all passed. The repository has no Stryker dependency or configuration; mutation testing is unavailable. `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files` passed on the four touched files, with the normal commit gate reserved for `git commit`.
- 2026-11-13: First revert-and-reconfirm attempt showed a regression-test flaw: with the old helper, its stdin-driven child sometimes exited code 0 before the 1.5-second oracle, so the assertion failed for the wrong reason. Changed the test child to keep an interval alive independently of stdin before repeating this guardrail signal.
- 2026-11-13: Bounded revert-and-reconfirm with the hardened child succeeded: pre-fix helper produced `AbortError` caused by `TimeoutError` at 1.5 seconds (log /tmp/async-lifecycle-revert-red.log); restoring the fixed helper yielded 1/1 passing test in 347 ms. `git diff --check` passed.
- 2026-11-13: Final Fallow audit reported no issues in four changed files. Final pre-commit fixer pass succeeded. Commit a01d79d6026c543efe1f2abfe82d92f99ca38f19 passed the normal hooks, including `npm run check:commit` and gitlint. An initial commit attempt failed gitlint on an overlong message body; no commit was created, and the successful retry retained all hooks.
- 2026-11-13: Full combined-tree gate `node .codex/gsd-core/bin/gsd-tools.cjs run-with-timeout 2400 -- npm run check` exited 0 at a01d79d6026c543efe1f2abfe82d92f99ca38f19 on Node v26.13.0, with no uncommitted build inputs. Log: /tmp/pg2-wave6-check-lifecycle-fixed.log. Seven static checks passed; adapter seed 682091 passed 1854/1854 scenarios and 22567/22567 steps; builtin seed 425195 passed 155/155 scenarios and 2091/2091 steps; direct coverage merged 359 LCOV records.

## Constraints

- This debug session is part of the authorized autonomous Phase 2 execution. Fix and automate verification before interrupting the user. No approval is needed for an ordinary diagnosed fix and tests.
- Do not relax assertions, raise timeouts, skip scenarios, bypass hooks, or upgrade companions.
- Keep all source edits within the proven cause and its regression checks; all repository skills apply. Parent owns STATE, ROADMAP and the next full combined-tree gate.
- Host test processes live outside the sandbox PID namespace. Use require_escalated for host ps/liveness checks and real-Pi tests. A sandbox ps returning no PID is not evidence of exit.
- No other executor is active. The root is features/gaps; never commit to main, amend or rebase. Commit hooks and Fallow audit are mandatory.

## Eliminated

None yet.

## Resolution

root_cause: The Cucumber fixture's stopHookScripts cleanup scans only script PID files once. A registered async child can start its script after the scan and survive the scenario; the next scenario reuses the sandbox and its release marker. The name-only lifecycle wait can then accept the old child's end as the new hook's end. High worker load exposes this scheduling window.
fix: Fixture cleanup now reads each scope's persisted async-hook PID table, checks the registry marker on Linux, signals recorded child groups, and then stops scripts named by PID files. ScenarioWorld passes both scope roots to this cleanup. A regression starts a registered child before its script PID file exists.
verification:
  oracle_type: derived (HAR-05 fixture contract and persisted PID-table ownership)
  target_test: { result: pass }
  mutation_check: { result: skipped, reason_if_skipped: "Stryker is not configured or installed" }
  no_op_deletion: { result: pass, deletion_justified_by_rca: false }
  adjacent_tests: { result: pass, suites_run: ["async.feature adapter seeds 793972, 853766, 367329", "npm run check:static"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  guardrail_verdict: accepted
  commit: a01d79d6026c543efe1f2abfe82d92f99ca38f19
  full_combined_tree_check: { result: pass, commit: a01d79d6026c543efe1f2abfe82d92f99ca38f19, node: v26.13.0, log: /tmp/pg2-wave6-check-lifecycle-fixed.log }
files_changed: [features/lib/hook-files.ts, features/support/world.ts, test/architecture/hook-script-cleanup.test.ts]

## Prevention

- **Why it happened:** The fixture scanned script PID files once after Pi exited, while a detached child could be registered before its shell wrote that file. Eight-worker scheduling exposed the gap, and the reused harness let a late hook end match the next scenario by name and phase.
- **Why not caught:** No existing regression covered a registered child whose script PID file had not yet appeared. The broad Cucumber gate exposed the race only when timing and scenario order aligned.
- **Recurrence guard:** `test/architecture/hook-script-cleanup.test.ts` holds a registered child with no script PID file and requires fixture cleanup to stop it; the full real-Pi adapter and builtin gate passed after the fix.
- **Unresolved evidence:** The older exit-code mismatch (0 instead of 1) was not captured with a complete process snapshot and is not attributed to this fixture leak. The possible `spawnAndRegister` generation window was not exercised by the reproduced scenarios. Treat either recurrence as a separate investigation.
