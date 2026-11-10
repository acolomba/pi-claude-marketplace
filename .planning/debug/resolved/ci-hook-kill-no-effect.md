---
status: resolved
trigger: "CI-only failures on PR #310: 8 adapter-components hook scenarios fail deterministically on GitHub's ubuntu-latest runner and pass locally"
created: 2026-11-09
updated: 2026-11-10
---

# Debug: CI-only hook kill has no effect

## Symptoms

DATA_START
- **Expected:** On CI, as locally, the 1.5 s SessionEnd budget ends a slow `SessionEnd` hook (SIGTERM) so the next session starts and a json-mode Pi exits; and the async-hook reap (on `/reload`, or on a new Pi after one died) SIGKILLs the recorded hook process so `Then no hook process is running` passes.
- **Actual (CI only, deterministic across 3 full runs, 8 and 4 workers):**
  - `features/hook/async.feature:247, :269, :288, :310`: `Then no hook process is running` -> `AssertionError: these hook processes are still running [<pid>]` after its 10 s poll (`features/step_definitions/hook/runs.steps.ts:181`, liveness by `process.kill(pid, 0)` in `features/lib/turn-records.ts:70`).
  - `features/hook/session-end.feature:152, :153, :197, :198`: only the Examples rows with `sleep 30` / `timeout 60, sleep 60`; the `exit code 1/2` rows pass. The next session start times out (30 s step timeout) or `/claude:plugin list in json mode failed or did not exit within 25000 ms`.
- **Errors:** see above; CI run 42682487664 (head 20a5f8ee) and 42672697299 attempt 4 (head 8478bac9), job "behavioral tests, adapter components (Node 24)": `533 scenarios (525 passed, 8 failed)`.
- **Timeline:** these scenarios never ran on CI before PR #310 (CI does not run on `features/*` pushes). They pass locally in every `npm run check` (Fedora 44, Node 26.13.0, /bin/sh = bash).
- **Repro:** CI only: `npm run test:cucumber:profile -- --profile adapter features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow` on ubuntu-latest (Node 24; the annotation says ubuntu-latest is migrating to Ubuntu 26).
DATA_END

## Already eliminated (by the orchestrator, 2026-11-09)

- **dash vs bash.** Fedora's dash 0.5.13 (extracted, scratchpad `dash/`) execs a lone `-c` command like bash (spawned pid == script `$$`), and a SIGTERM at 1.5 s closes a hook-shaped script's pipe at 1.5-1.6 s under both shells, for the fixture's `sleep N </dev/null >/dev/null 2>&1` line, with and without the lifecycle `EXIT` trap, and for the `sleep 0.1` polling loop. Caveat: Ubuntu's dash version was not tested.
- **CPU contention.** The full adapter-components shard pinned to 4 cores (`taskset -c 0-3`, 8 workers) passed 533/533 locally (8m42s, slower than CI's 4m55s). CI with 4 workers (`scripts/cucumber.mjs`, commit 6be7cb0c) failed the same 8.
- **Fixture holding the pipe.** The fixture's sleep redirects all fds (`features/lib/hook-files.ts:408`).

## Relevant code

- Hook spawn and the SIGTERM -> 5 s -> SIGKILL ladder: `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`, `bridges/hooks/timeout.ts` (SessionEnd 1.5 s budget, D-BG-604).
- Async hooks, PID table, orphan reap (SIGKILL after `/proc/<pid>/environ` marker check `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH`): `bridges/hooks/async-rewake/registry.ts`, `async-rewake/pid-table.ts`.
- Debug log: `extensions/pi-claude-marketplace/shared/debug-log.ts` (env-gated `console.error`, OBS-01).
- Harness: `features/lib/hook-files.ts` (script bodies, pid files), `features/step_definitions/hook/runs.steps.ts`, `features/step_definitions/hook/session-end.steps.ts`, `features/support/pi-process.ts`.
- CI: `.github/workflows/ci.yml` (job `behavioral`, matrix shards; `workflow_dispatch` exists).

## Plan agreed with the user

1. A diagnostic CI run on `features/behavioral-gaps` (push allowed for this branch only; or a `workflow_dispatch` of ci.yml on it) that runs only `features/hook/async.feature` and `features/hook/session-end.feature` with the hook debug log on, and on failure dumps `/proc/<pid>/status` (State, PPid, and `/proc/<pid>/cmdline`) of each leftover pid plus the bridge's timeout-ladder and reap log lines. Remove every diagnostic before the fix lands; never leave a temporary CI change on the branch.
2. Decide from the evidence whether Pi never sends the signal or the process survives it (zombie under a non-reaping parent, a different pid, a different process tree), then fix the root cause in product or harness code, with a scenario or unit test that fails without the fix, following Claude Code parity rules in AGENTS.md.
3. `npm run check` on the final tree; the PR's CI must pass.

Constraints: hermetic homes only (never the real ~/.pi/agent); no --no-verify, no `git add -A`, no rebase, no amend; push only `features/behavioral-gaps`; commits per `.agents/skills/committing/SKILL.md`.

## Current Focus

- bug_class: Bohrbug (deterministic on CI, 3/3 runs; environment-dependent)
- hypothesis (leading, from code reading): every failing scenario uses `form: script`, a shell-form command `${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh` that Pi spawns as `/bin/sh -c '<command>'`. If the runner's `/bin/sh` forks for the `-c` command instead of exec'ing it, `child.pid` is the `sh -c` wrapper and the script (whose `$$` the pid file holds) is its child. SIGTERM / SIGKILL then end only the wrapper: the script lives on, holds the stdout/stderr pipes (so the blocking lane's `close` never fires, and `hasExited(child)` makes the SIGKILL leg a no-op), and the reap kills only the wrapper. Competing: (a) zombies under a non-reaping parent, (b) Pi never sends the kill on CI.
- test: diagnostic CI run that logs `child.pid` at spawn and, on failure, the leftover pid's /proc status (PPid, State) and cmdline; locally, run Ubuntu's dash in docker against the `sh -c '${VAR}/script'` shape.
- expecting: leftover PPid == the recorded/killed `child.pid` (or 1 after the wrapper died), State S (not Z), cmdline `/bin/sh <script>`; debug log shows SIGTERM/SIGKILL to a pid != the script pid.
- user response (2026-11-10, relayed): (1) record a D-BG decision superseding EXEC-05; (2) fix the HKDR-01 SIGKILL gap in this PR (a group member that ignores SIGTERM gets no SIGKILL once the shell exited), keep the 5 s grace, cover both ladders, ship a scenario that fails without it; narrow HKDR-01; then treat the session as confirmed fixed and archive it.
- next_action: none; resolved. The user confirmed the first fix by asking for the follow-up and the archive (2026-11-10).
- earlier: diagnostic run 42685822042 confirmed the leading hypothesis; see Evidence. Docker was unavailable (no daemon), so the probe ran on the runner.

reasoning_checkpoint:
  hypothesis: "The 8 CI failures happen because both hook lanes signal only child.pid; on Ubuntu 26.04 `/bin/sh -c '<script>'` forks, so child.pid is the shell, and the script (the pid file's process, holding the pipes) survives every SIGTERM/SIGKILL Pi sends."
  confirming_evidence:
    - "Runner probe: child.pid=2413 is `/bin/sh -c`, the script is 2414 with ppid 2413; after SIGTERM the wrapper exits by SIGTERM, close never fires within 3 s, and 2414 lives on with ppid 1."
    - "All 8 failing scenarios use the shell-form script command; every passing row with the same hooks exits on its own (exit code 1/2) and needs no kill."
    - "dash on the runner is 0.5.12-12ubuntu3; locally Fedora's sh is bash and the orchestrator measured exec behavior there, which is why local runs pass."
  falsification_test: "After spawning hooks as group leaders and signalling the group, the 8 scenarios still fail on ubuntu-latest; or a local scenario whose command forks under any shell (`<script> || true`) passes without the fix."
  fix_rationale: "Spawn hooks `detached` off Windows (each leads its own process group, as Claude Code 2.1.319 and the house prompt-shell/package-manager runners do) and send every hook signal (ladder legs, /reload shutdown, orphan reap) to the group, falling back to the pid alone. The signal then reaches the script and its sleep whether or not the shell forked, which is the mechanism that fails."
  blind_spots: "Not covered: a hook descendant that leaves the group (setsid) escapes, where upstream also walks `ps` descendants; a group member that ignores SIGTERM after the shell exits gets no SIGKILL, because the SIGKILL leg guards on the leader's exit (HKDR-01 residual). `detached` also gives the hook a new session, so it loses the controlling terminal and terminal SIGHUP/SIGINT, as upstream."
  candidate_causes:
    - "environment: Ubuntu 26.04 dash forks for `sh -c <one command>` (confirmed)"
    - "code: the lanes signal child.pid instead of the process group (confirmed; the fix site)"
    - "environment: zombies under a non-reaping parent (eliminated, state S under systemd)"
    - "code/config: a CI-only path that skips the kill (eliminated, the wrapper does receive SIGTERM)"
  and_gate: "yes: the failure needs both the forking shell (environment) and the single-pid kill (code). The code side is the root cause to fix, because any forking command (`a || b`, pipelines) hits it on every OS; the scenario added for the fix uses such a command so it fails without the fix on Fedora too."

## Evidence

- timestamp: 2026-11-09T19:30Z
  checked: job list and logs of CI run 42682487664 (head 20a5f8ee).
  found: both behavioral jobs ran on `Image: ubuntu-26.04` (20261101.186.1). The builtin leg (153 scenarios, all green) runs only `@mcp`/`@builtin-only` scenarios, so it never ran the failing hook scenarios.
  implication: no green control on the same image; the failing set is profile-independent.

- timestamp: 2026-11-09T19:40Z
  checked: code of every failing scenario (`features/hook/async.feature:247,269,288,310`, `features/hook/session-end.feature:152,153,197,198`) and `features/lib/hook-files.ts`.
  found: all use `form: script`, i.e. the shell-form command `${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh`, which both lanes spawn as `/bin/sh -c '<command>'` (`spawn-helpers.ts` planSpawn, `shell: true`). The pid file holds the script's `$$`. The ladder (`exec-timer.ts`), `/reload` (`runtime.ts` shutdownChildren) and the reap (`registry.ts` reapOrphan) each signal `child.pid` alone; `detached` is false (async) or unset (blocking).
  implication: if `/bin/sh -c` forks, every kill reaches only the `sh -c` wrapper.

- timestamp: 2026-11-09T19:42Z
  checked: diagnostic run 42685822042 (commit f365f985, workflow `diag-hook-kill.yml`), step "Describe the shell and the tools".
  found: Ubuntu 26.04.1 LTS; `/bin/sh -> dash`, dash `0.5.12-12ubuntu3`; `sleep` is uutils 0.10.0 (rust-coreutils); PID 1 is systemd.
  implication: the runner's /bin/sh is a dash build the orchestrator did not test (Fedora's was 0.5.13).

- timestamp: 2026-11-09T19:42Z
  checked: same run, step "Probe how sh -c runs a script": Node `spawn(cmd, [], {shell: true})` of a `#!/bin/sh` script that reads stdin and runs `sleep 30 </dev/null >/dev/null 2>&1`, for `cmd` = `${PROBE_ROOT}/probe-hook.sh` and the literal path, then `child.kill("SIGTERM")` after 1 s.
  found: both shapes: `child.pid=2413; script pid=2414 ppid=2413` (`/bin/sh -c ...` is pid 2413, `/bin/sh <script>` pid 2414 is its child). SIGTERM: `exit code=null signal=SIGTERM at 1014 ms`, then `no close within 3 s of the SIGTERM`, and the script lives on as `2414 1 S /bin/sh .../probe-hook.sh` (reparented to PID 1, state S, not a zombie).
  implication: CONFIRMED. Ubuntu 26.04's dash forks for a lone `-c` command. Pi signals the wrapper, the wrapper dies, the script survives holding the stdout/stderr pipes, so the blocking lane's `close` never fires, and the ladder's SIGKILL leg skips because `hasExited(child)` is true. The same mechanism explains the reload and reap failures (the pid file names the surviving script, not the killed wrapper). Not zombies; Pi does send the signal.

- timestamp: 2026-11-09T19:46Z
  checked: same run, cucumber on `features/hook/async.feature` + `features/hook/session-end.feature` only.
  found: the same 8 scenarios fail (4 x `these hook processes are still running`, 2 x json mode did not exit within 25000 ms, 2 x next session start timeout); the rest pass. The ps sampler died after one sample (`set -e` in the subshell and an empty grep), so no per-scenario tree was captured; the probe already shows the tree.
  implication: the 8 failures reproduce in isolation; no other contributing cause is visible.

- timestamp: 2026-11-09T20:00Z
  checked: Claude Code 2.1.319 binary (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude`), the command-hook spawn and its shell-command wrapper.
  found: shell-form hooks spawn with `shell: true` and `detached: fs` where `fs = !<windows bash>` (detached on every POSIX platform), exec form the same. The kill (`#R` of the `ahe` wrapper) calls `mE(pid,"SIGTERM")`, which is `process.kill(-pid, sig)` (the process group) with a `process.kill(pid, sig)` fallback, plus every descendant from `ps -A -o pid=,ppid=,pgid=`; 1500 ms later (`bFt=1500`) it sends `process.kill(-pid,"SIGKILL")` and `mE(pid,"SIGKILL")`.
  implication: upstream signals the hook's whole process group. Pi's single-pid kill is a parity gap, and BACKLOG HKDR-01 already names "a `detached: true` spawn plus a process-group kill" as the proper fix for the grandchild case. House precedent: `platform/prompt-shell.ts` and `platform/package-manager.ts` spawn `detached: platform !== "win32"` and signal `-pid` with a `child.kill` fallback.

- timestamp: 2026-11-09T20:20Z
  checked: new scenarios whose script hook's command is `<script> || true` (a command every shell forks for), run locally on Fedora before the fix: `features/hook/async.feature:269` (dead Pi + reap), `:310` (reload), `features/hook/session-end.feature:154` (next session) and `:200` (json mode), adapter profile.
  found: 4 scenarios (4 failed): two `these hook processes are still running`, `json mode failed or did not exit within 25000 ms`, and `function timed out ... 30000 milliseconds` -- the four CI failure modes, reproduced off CI.
  implication: the failure is the single-pid kill, not Ubuntu; the scenarios are the RED tests for the fix.

- timestamp: 2026-11-09T20:40Z
  checked: first full run of both hook features with the product fix only (adapter profile, 6 workers).
  found: 25/33 passed. The 4 new and 8 original kill scenarios passed, but 8 other async scenarios failed in their release (`assertStandInsStopped` on the lifecycle pid files), and two of them timed out waiting for a rewake.
  implication: the harness's `PiProcess.stop()` kills Pi's process group, which used to contain the hook children; detached hooks survive it, keep waiting 60 s on `$HOME/hook-releases/<name>`, and take the next scenario's release marker in the reused sandbox. The harness needs to stop the scenario's hook scripts itself.

- timestamp: 2026-11-09T20:45Z
  checked: both hook features again after `stopHookScripts(harness)` (features/lib/hook-files.ts) runs in the profile Pi's release and before the restart check (features/support/world.ts).
  found: 33 scenarios (33 passed), 445 steps passed.
  implication: GREEN for the behavioral tests.

- timestamp: 2026-11-09T20:55Z
  checked: unit tests of `test/bridges/hooks/**` (958 pass), direct coverage of process-group.ts, dispatch-exec.ts, registry.ts (100% each), fallow (green), and 10 mutants of the fix (bare child to either ladder, bare child in the runtime entry, `detached: false` in either lane, pid-only reap, no `pid < 2` guard, no Node default, no negation, no fallback).
  found: every mutant fails at least one new or updated test (the first `pid < 2` mutant survived until the guard test recorded group signals instead of asserting inside the swallowed catch).
  implication: the tests pin each part of the fix.

- timestamp: 2026-11-09T21:20Z
  checked: `npm run check` on the final tree (diagnostic workflow deleted, fix applied), then the commits a284b715 (diagnostic removed) and ab30ad88 (fix; `check:commit` hook passed), pushed to features/behavioral-gaps.
  found: `npm run check` exit 0: static checks, unpaired and integration tests, cucumber adapter 1796/1796 and builtin 153/153 scenarios, direct coverage of every pair. `git diff 20a5f8ee HEAD -- .github/` is empty.
  implication: local gate green; no temporary CI change remains on the branch.

- timestamp: 2026-11-09T20:45Z
  checked: PR #310 CI run 42694741792 (pull_request, head ab30ad88) and `gh pr checks 310`.
  found: all jobs green on `Image: ubuntu-26.04`; adapter components `537 scenarios (537 passed)`; lint (pre-commit, fallow-audit) and SonarCloud pass; SonarCloud API reports 0 open issues on the PR.
  implication: the 8 CI-only failures are fixed on the runner that produced them.

- timestamp: 2026-11-10T08:00Z
  checked: the ladder after the first fix (`exec-timer.ts`): the SIGKILL leg guards on `!hasExited(child)`, and the async lane cancels the ladder on the child's `exit`.
  found: when the group SIGTERM ends the shell but a member ignores SIGTERM, the blocking lane's SIGKILL leg finds the shell exited and skips, and the async lane's `exit` handler cancels the leg outright. Either way the member runs on (the HKDR-01 residual the user asked to fix).
  implication: the leg must also fire for a live group member, but only after the ladder's own SIGTERM, and must survive `cancel()` for a group leader once SIGTERM fired.

- timestamp: 2026-11-10T08:40Z
  checked: fix: `ChildLike.groupAlive` (probe `signalGroup(pid, 0)` in `asGroupLeader`); `needsSigkill` = `!hasExited(child) || (sigtermFired && groupAlive())`; `cancel()` keeps the SIGKILL timer when `sigtermFired && child.groupAlive !== undefined`. Grace stays 5 s (D-BG-605). New harness column `sigterm: ignore` (`trap '' TERM` as the script's first line). New scenarios: SessionEnd rows `["||","true"]` + `sleep 30` + `sigterm ignore` in both outlines (session-end.feature:155, :202) and async.feature:329 (background hook, `timeout 1`).
  found: with `exec-timer.ts` reverted to HEAD: 3 scenarios (3 failed): `these hook processes are still running`, json mode did not exit within 25000 ms, `function timed out ... 30000 milliseconds`. With the fix: both hook features 36/36. Unit: 968/968 hook tests; 8 new mutants (no group clause, no sigtermFired guard in the leg or in cancel, cancel always clears, failed probe reads alive, probe without signal 0, and the two lane-level variants) all killed; direct coverage 100% for exec-timer.ts, process-group.ts, dispatch-exec.ts, registry.ts.
  implication: the follow-up SIGKILL is fixed in both ladders. The registry test harness's `createChild` copied its exit-state getters as fixed `null` values (`Object.assign`), which hid the exit from the ladder; it now defines them as live accessors (57/57 registry tests pass).

- timestamp: 2026-11-10T11:50Z
  checked: commits 1ca1478c (follow-up SIGKILL; `check:commit` hook passed) and 2c55019f (D-BG-211, HKDR-01), `npm run check` on the final tree, PR #310 CI run 42809161455 (pull_request, head 2c55019f), SonarCloud API.
  found: `npm run check` exit 0 (cucumber adapter 1799/1799, builtin 153/153). Every PR check green; adapter components on `Image: ubuntu-26.04`: `540 scenarios (540 passed)`. SonarCloud: 0 open issues on the PR, quality gate OK, new coverage 100.0, new duplication 0.0.
  implication: the follow-up is verified on the runner that produced the original failures.

## Eliminated

- hypothesis: (a) zombies under a non-reaping parent keep `kill(pid, 0)` succeeding.
  evidence: the surviving script is in state S with PPid 1 (systemd reaps); it is alive, not a zombie.
  timestamp: 2026-11-09T19:42Z

- hypothesis: (b) Pi never sends the kill on CI.
  evidence: in the probe the SIGTERM reaches and ends the spawned pid (`exit ... signal=SIGTERM`); the process that survives is a different pid, the wrapper's child.
  timestamp: 2026-11-09T19:42Z

## Resolution

fix: Both hook lanes spawn a hook with `detached: process.platform !== "win32"`, so it leads its own process group, and wrap the child in `asGroupLeader(child, deps)` (new `bridges/hooks/process-group.ts`), whose `kill` signals `-pid` and falls back to the child alone (no pid, pid < 2, group signal throws, or a caller's own `spawnImpl` without `signalGroup`). The wrapper goes to both timer ladders and into the async runtime entry, so the SessionEnd budget, `/reload` and the background timeout signal the group; the orphan reap SIGKILLs `-pid`, then `pid`. `SpawnDeps` gains `signalGroup` for tests. Harness: the profile Pi's release (and the non-crash restart) SIGKILL the scenario's lifecycle hook scripts by their pid files, because stopping Pi's group no longer reaches them. Matches Claude Code 2.1.319 (detached hooks, group kill) and the house prompt-shell / package-manager runners.
follow_up_fix (user-requested, 2026-11-10): once the ladder's SIGTERM has fired, its SIGKILL follows after the 5 s grace whenever the hook's group still has a member, even after the shell exited (`ChildLike.groupAlive`, `needsSigkill`, and `cancel()` keeping the SIGKILL leg of a group leader); both ladders. Decision D-BG-211 in `.planning/PROJECT.md` (supersedes EXEC-05's `detached: false`, amends D-BG-605); BACKLOG HKDR-01 narrowed to a descendant that leaves the group and a member left holding stdout after the shell's own exit.
files_changed:
  - extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts (follow-up)
  - test/bridges/hooks/exec-timer.test.ts (follow-up)
  - .planning/PROJECT.md (D-BG-211), .planning/BACKLOG.md (HKDR-01) (follow-up)
  - extensions/pi-claude-marketplace/bridges/hooks/process-group.ts (new)
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - test/bridges/hooks/process-group.test.ts (new)
  - test/bridges/hooks/dispatch-exec.test.ts
  - test/bridges/hooks/async-rewake/registry.test.ts
  - features/hook/async.feature (2 scenarios)
  - features/hook/session-end.feature (2 Examples rows, `arguments` column)
  - features/lib/hook-files.ts, features/support/world.ts, features/lib/pi-process.ts (harness)
  - CHANGELOG.md
  - .github/workflows/diag-hook-kill.yml (temporary diagnostic, removed)
verification:
  target_test: { result: pass, detail: "features/hook/async.feature:269,:310 and session-end.feature:154,:200 (new) plus the 8 CI-failing scenarios: 33/33 locally; CI run 42694741792 (head ab30ad88, ubuntu-26.04) adapter components 537/537" }
  mutation_check: { result: pass, reason_if_skipped: "Stryker not configured; 10 hand-seeded mutants at the fix sites instead", mutant_killed: "10/10 (bare child to the sync or async ladder, bare child in the runtime entry, detached false in either lane, pid-only reap, no pid<2 guard, no Node default, no negation, no fallback)" }
  no_op_deletion: { result: pass, deletion_justified_by_rca: true, detail: "the diff adds the group signal; the only removals are the `detached: false` literal and the pid-only kill it replaces" }
  adjacent_tests: { result: pass, detail: "npm run check exit 0 on the final tree (unit, integration, cucumber adapter 1796 + builtin 153, direct coverage); every PR #310 check green, SonarCloud 0 open issues" }
  revert_and_reconfirm: { result: pass, detail: "before the product fix the 4 new scenarios failed locally with the 4 CI failure modes and the 8 failed on CI (runs 42682487664, 42685822042); with it all pass locally and on CI. The unit mutants revert each part singly and fail." }
  guardrail_verdict: accepted
oracle_type: specified (the scenarios state that no hook process runs and that the next session starts / json mode exits; unit tests state the exact signals and spawn options)
root_cause: Both hook lanes signal only the pid they spawned. A shell-form hook runs as `/bin/sh -c '<command>'`, and Ubuntu 26.04's dash 0.5.12 forks for that command instead of exec'ing it (as any shell does for `a || b`, `a; b`, or a pipe), so the spawned pid is the shell and the hook script is its child. The SessionEnd ladder's SIGTERM, the `/reload` SIGKILL, and the orphan reap's SIGKILL end the shell; the script survives, keeps the stdout/stderr pipes open (the blocking lane waits for `close`, and the SIGKILL leg skips because the shell has exited), and keeps running. Claude Code 2.1.319 instead spawns hooks as process-group leaders (`detached` off Windows) and signals the group.

## Prevention

### Branching 5-Whys (blameless)

- **Environment branch.** Why did 8 scenarios fail only on CI? The runner image moved to Ubuntu 26.04, whose dash 0.5.12 forks for `sh -c '<one command>'`. Why did that matter? Pi spawned the shell and signalled only its pid. Why was a forking shell never seen before? The scenarios had never run on CI (no CI on `features/*` pushes), and every local run used a shell that execs a lone command.
- **Code branch.** Why did the kill reach only the shell? Both hook lanes signalled `child.pid`, and the async lane spawned `detached: false` on the belief (EXEC-05) that sharing Pi's process group made the SIGKILL "/reload-safe". Why was that belief not checked? The kill targeted a pid, not a group, so the group membership never helped, and Claude Code's own detached-plus-group kill was not compared. Why did the SIGKILL leg not rescue it? It guarded on the leader's exit only, and the async lane cancelled it on `exit`.
- **Harness branch.** Why did the harness hide the leak? `PiProcess.stop()` killed Pi's process group, which held the hook children, so the release cleaned them up as a side effect.
- AND-gate: the forking shell (environment) and the single-pid kill (code) together produce the failure; the code side is the root cause, because `a || b`, `a; b`, and pipes fork under every shell.

### Why wasn't this caught?

- The behavioral suite ran only on Fedora, where `sh -c '<script>'` execs, so no scenario ever had a hook script that was not the spawned pid. No scenario used a command that forks under every shell.
- The unit tests used injected children whose `kill` was the only signal path, and the registry harness reported a fixed exit state, so no unit test could see a signal miss the hook's real process.
- BACKLOG HKDR-01 named the gap and the fix shape in 2026-08, but no gate tracked it.

### Recurrence guard

- Scenarios whose hook command is `<script> || true` (forks under every shell): `features/hook/async.feature` "A hook process that its command's shell started and a dead Pi left stops when Pi starts again", "Reloading Pi stops a waiting hook process that its command's shell started", "A background hook process that ignores SIGTERM stops at its timeout", and the `["||","true"]` rows (plain, and `sigterm ignore`) of both SessionEnd outlines in `features/hook/session-end.feature`. Each fails without its part of the fix on any OS.
- Unit pins: `test/bridges/hooks/process-group.test.ts`, the group cases in `test/bridges/hooks/exec-timer.test.ts`, `dispatch-exec.test.ts` ("starts a blocking hook as a process group leader ..." and "sends SIGKILL to the group of a blocking hook whose shell its SIGTERM ended ..."), and `async-rewake/registry.test.ts` (group stops, group SIGKILL after the shell's exit, group reap and its no-group fallback).
- Decision D-BG-211 in `.planning/PROJECT.md`; BACKLOG HKDR-01 keeps the two cases the group kill does not reach.
