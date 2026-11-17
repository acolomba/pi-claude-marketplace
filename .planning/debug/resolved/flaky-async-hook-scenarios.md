---
status: resolved
trigger: "Flaky async-hook cucumber scenarios in features/hook/async.feature fail the CI job \"behavioral tests, adapter components (Node 24)\" intermittently; re-runs pass. Fix the race (no timeout bumps, no retries, no skipping), then open a PR."
created: 2026-11-17
updated: 2026-11-17
---

# Debug: flaky async-hook scenarios

## Symptoms

- **Expected behavior:** Every scenario in `features/hook/async.feature` passes on every run of the CI job "behavioral tests, adapter components (Node 24)" (`npm run test:cucumber:profile -- --profile adapter features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow`, random order, Node 24 on `ubuntu-latest`).
- **Actual behavior:** About one run in three on 2026-11-17 failed one async-hook scenario, a different one each time. A re-run of only the failed job passed every time. The PRs involved could not change hook behavior: a workflow-only Action pin, a typebox devDependency bump, and a reorder of `import type` lines, which Node strips at runtime.
- **Error messages:**
  1. `features/hook/async.feature:427` "An async rewake hook that exits 2 while a tool runs reaches the model in the same turn". Step `When the user prompts "run the tool" and the hook "wake" wakes the model while the tool runs` (`features/step_definitions/hook/async.steps.ts:190`): `Error: the hook wake logged no end within 19897 ms` at `waitForHookLifecycle` (`features/lib/hook-recorder.ts:180`) via `releaseWaitingHook` (`async.steps.ts:138`), called from `async.steps.ts:200`.
  2. `features/hook/async.feature:99` "An async rewake hook with no message or summary wakes the model with the default texts". Step `When the user releases the hook "wake" and it wakes the model` (`async.steps.ts:161`): `Error: the hook wake logged no end within 19900 ms`, same stack, called from `async.steps.ts:166`.
  3. `features/hook/async.feature:378` "Reloading Pi stops the waiting hook processes of a project plugin". Step `Then no hook process is running` (`features/step_definitions/hook/runs.steps.ts:181`): `AssertionError [ERR_ASSERTION]: these hook processes are still running`.
  In cases 1 and 2 the release marker under `<home>/hook-releases/<hook>` was taken (the `existsSync(marker)` loop in `releaseWaitingHook` ended), so some hook run saw the release. The `end` line for that hook never reached `<harness>/hook-lifecycle.jsonl` within `ASYNC_STEP_DEADLINE_MS` (20 s).
- **Timeline:** Seen on CI on 2026-11-17 in 3 of about 9 runs of the adapter-components leg. Re-runs of the same commits passed. It is not known when it started.
- **Reproduction:** Intermittent on CI. The scenarios run under `node scripts/cucumber.mjs --profile adapter features/hook` after `node scripts/install-test-peers.mjs`. Repeated runs, or runs under CPU load, are the way to reproduce it locally.

## Constraints

- Fix the race itself. No timeout increases, no retries, no skipped or quarantined scenarios.
- Follow `.agents/skills/cucumber/SKILL.md` for harness rules and `.agents/skills/committing/SKILL.md` for commits. Never `--no-verify`.
- A Claude Code cloud session exports `SKIP=trufflehog`. The zizmor hook also cannot reach GitHub here; it only runs on workflow files.
- Before the final commit: `npm run check` must pass.
- Do not push. The orchestrator opens the PR.

## Current Focus

- hypothesis: CONFIRMED (see Resolution).
- next_action: none. The fix is committed on `claude/fervent-babbage-go9rvv` as 3095b58. The orchestrator pushes and opens the PR.

## Evidence

- timestamp: 2026-11-17 — Lifecycle script order (`features/lib/hook-files.ts` `scriptText`): `stdin=$(cat)`, then a Node recorder run (~200-500 ms), and only then the pid file and the `start` line. `stopHookScripts()` (profile Pi release, `features/support/world.ts`) SIGKILLs only the pids that pid files name, right after `pi.stop()`.
- timestamp: 2026-11-17 — Every scenario of a worker uses the same sandbox HOME (`features/support/pi-process.ts` `BeforeAll`, the `Before()` only empties it). The release marker is `$HOME/hook-releases/<name>`, so a script left over from scenario N polls the same marker path as scenario N+1's script.
- timestamp: 2026-11-17 — Pi spawns async hooks `detached` (own session and process group, `bridges/hooks/async-rewake/registry.ts`), so stopping Pi and killing its process group leaves them running.
- timestamp: 2026-11-17 — Reproduced locally (4 CPUs): `node scripts/cucumber.mjs --profile adapter features/hook/async.feature` failed 2 scenarios on run 1 (`...dead Pi left stops when Pi starts again` "these hook processes are still running", and `...exits with another code...` "logged no end").
- timestamp: 2026-11-17 — Temporary instrumentation (script `begin`/`took` lines plus scenario start/end, worker 2): scenario "exits 2 wakes the model with its message and its stderr" spawned a second `wake` run (pid 20258, from its last prompt "next") at 457.962 and ended at 457.977, 15 ms later, before that run wrote its pid file. The next scenario on the worker ("exits 2 while a tool runs...") spawned its own `wake` (pid 20339) at 459.317, and at 459.789 the leftover pid 20258 took the release marker. Pid 20339 kept waiting, the leftover died on SIGPIPE writing stderr to the dead Pi's pipe (no EXIT trap on signal death), and no `end` line came: "the hook wake logged no end within 19947 ms". Same as CI cases 1 and 2.
- timestamp: 2026-11-17 — Same run, worker 1: scenario "exits 2 shows the user its summary" spawned `wake` pid 19660 (from "next") at 448.936 and ended at 448.951. The next scenario "Reloading Pi stops its waiting hook processes" failed with "these hook processes are still running [19660]": the leftover wrote its pid file into the new harness. Same as CI case 3.

- timestamp: 2026-11-17 — Fix, first cut: the profile Pi's start opens a hook gate (`<harness>/hook-gate-<uuid>`, id in `PI_CM_HOOK_GATE` of the Pi's env, inherited by every hook at spawn). A lifecycle script writes its pid file first and exits 0 when the gate is closed, checking before and after the write. The release closes the gate before it reads the pid files. A scratch check of the generated script confirmed: an open gate runs normally (start, wait, end 2), a closed gate and a missing variable exit 0 with no file or line, and a registered waiting script is SIGKILLed by `stopHookScripts`.
- timestamp: 2026-11-17 — The first cut failed 15 of 18 scenarios on every run: `rpcChildEnvironment()` (`test/e2e/_rpc.ts`) copies only allowlisted variables, so the gate never reached the profile Pi, and every script exited at its gate check. A spread into the typed `environment` literal skips TypeScript's excess-property check. Fixed by adding `PI_CM_HOOK_GATE` to `RpcProfileEnvironment` and its copy, with a case in `test/architecture/hermetic-git-environment.test.ts`. `HookGate.environment` is now typed with the exact key.

- timestamp: 2026-11-17 — fallow dupes flagged the new `readTextIfPresent` in `features/lib/turn-records.ts` as a clone of `readOptional` in `features/lib/scripted-model/script.ts`. It is now one exported helper in `turn-records.ts`, which the scripted model already imports.
- timestamp: 2026-11-17 — Verification, fixed tree: 10 of 10 sequential runs of `node scripts/cucumber.mjs --profile adapter features/hook/async.feature` passed (18/18 each). Under load, 5 rounds of two concurrent runs (8 workers on 4 CPUs): 10 of 10 passed.
- timestamp: 2026-11-17 — Verification, unfixed tree (fix stashed), same load test: 5 of 10 runs failed, 6 scenario failures: "these hook processes are still running" ×3, "the hook wake logged no end" ×2, and one release `AggregateError` in the scenario whose last prompt spawns a late `wake` run. Earlier unfixed sequential runs: 2 of 4 passed.

## Eliminated

- Product (extension) defect: the failing hook runs belong to an earlier scenario's stopped Pi. The extension's own reap and spawn paths behaved as designed.
- Partial-line read in `readLogLengths`: the missing line is an `end` line that was never written, not a miscounted one.

## Resolution

- root_cause: The cucumber harness left behind lifecycle hook scripts that Pi had started just before a scenario ended. Such a script writes its pid file only after it reads stdin and runs the Node recorder, several hundred ms after spawn. The profile Pi's release (`stopHookScripts()`) kills only the pids that pid files name, so it missed the script. Pi starts async hooks in their own process group, so stopping Pi leaves them running. The script then lived on for up to 60 s in the next scenario of the same worker, which uses the same sandbox HOME and harness directory. There it wrote its pid file ("these hook processes are still running") or took that scenario's release marker. It then died on SIGPIPE without an `end` line ("the hook wake logged no end"). The trigger is a scenario whose last step causes another run of a waiting hook, such as `the user prompts "next" after the woken turn ends`. Random order decides which scenario runs next on the worker, so a different scenario failed each time.
- fix: Each profile Pi gets a hook gate: `openHookGate()` creates `<harness>/hook-gate-<uuid>`, and the id goes into the Pi's environment as `PI_CM_HOOK_GATE`. Every hook inherits it at spawn, and a terminal Pi started beside the profile Pi gets the same id. A lifecycle script now writes its pid file first, and checks the gate before and after the write. It exits 0 when the gate is closed. `stopHookScripts(harness, gate)` closes the gate before it reads the pid files. So every script of a stopped Pi was either listed and SIGKILLed, or sees the closed gate and exits, because the release closes, then reads, and the script writes, then checks. The pid-file readers (`readPidFiles()` in `turn-records.ts`) skip a file that vanishes between the listing and the read. `rpcChildEnvironment()` now passes `PI_CM_HOOK_GATE` through its allowlist.
- verification: before the fix 5 of 10 loaded runs failed (2 of 4 sequential runs too). After the fix 10 of 10 sequential and 10 of 10 loaded runs passed. `npm run check` on the fixed tree (Node v24.22.1, base 3f8882f): exit 0, cucumber adapter 1799/1799 and builtin 153/153. The commit hook's `npm run check:commit` passed. Commit 3095b58.
- files_changed: features/lib/hook-files.ts, features/lib/turn-records.ts, features/lib/scripted-model/script.ts, features/support/world.ts, test/e2e/_rpc.ts, test/architecture/hermetic-git-environment.test.ts, .agents/skills/cucumber/rules/world-and-stand-ins.md

## Specialist Review

- The Skill tool was not available in this session, so no `typescript-expert` review ran. Self-review against the repo's TypeScript and cucumber rules: one typed `HookGate` (its environment key is typed exactly, so a misspelled variable fails to compile), no module state, no caught-and-logged errors (`readTextIfPresent` turns only `ENOENT` into `undefined`), and fallow dupes is clean after the helper was merged.

## Prevention

- why not caught: no gate existed for this class. The release's "every stand-in stopped" check reads only the pid files that exist, so a hook script that had not yet written one was invisible to it.
- guard: the hook gate makes the release close, and then read, the set of a Pi's lifecycle scripts. A Pi without a gate runs no lifecycle script. The `rpcChildEnvironment` architecture test pins that the profile's gate, and never the shell's, reaches Pi.
