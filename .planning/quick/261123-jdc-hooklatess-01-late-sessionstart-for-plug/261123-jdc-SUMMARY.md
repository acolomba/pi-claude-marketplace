---
phase: quick-261123-jdc
plan: 01
subsystem: bridges/hooks
tags: [hooks, session-start, autoapply, upstream-parity, HOOKLATESS-01]
status: complete
requires: []
provides:
  - "late SessionStart for plugins that a load's autoapply activates (print, json, rpc)"
affects:
  - extensions/pi-claude-marketplace/index.ts (prepareResources)
  - extensions/pi-claude-marketplace/bridges/hooks (router, dispatch, adapters)
tech-stack:
  added: []
  patterns:
    - "bridge handle returned by registerHooksBridge instead of a new pi.on"
    - "bounded wait: Promise.race against a cleared setTimeout (settlesWithin)"
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/late-session-start.ts
    - test/bridges/hooks/late-session-start.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts
    - extensions/pi-claude-marketplace/index.ts
    - test/bridges/hooks/event-router.test.ts
    - test/bridges/hooks/dispatch.test.ts
    - test/bridges/hooks/event-adapters.test.ts
    - features/hook/session.feature
    - docs/hooks-compatibility.md
    - .planning/PROJECT.md
decisions:
  - "HOOKLATESS-D1: after a startup load in print/json/rpc, SessionStart runs once for the plugins that gained a SessionStart route since the session's own dispatch, keyed <plugin>@<marketplace> in either scope, with that dispatch's source; no other plugin's hooks run"
  - "The load waits at most 10 s (LATE_SESSION_START_WAIT_MS, Claude Code S5()); a longer run goes on and its context is sent with deliverAs nextTurn"
metrics:
  completed: 2026-11-23
  tasks: 3
  commits: 4
commits: 4
plan_head_before: ebf7145681c52df5de5bc081c2e05f6a58293b84
plan_head_after: 312434e2fd2fef6d5a90f50ee3ffbcd9fd9fe04b
---

# Quick 261123-jdc Plan 01: late SessionStart for plugins that a load activates Summary

In print, json, and rpc mode, a plugin that the load's autoapply installs or enables as Pi starts
now runs its SessionStart hooks in that session, with the session's start source, once, with no
other plugin's hooks run again; the load waits at most 10 seconds and a longer run's context waits
for the next prompt, as in Claude Code 2.1.330 (HOOKLATESS-D1).

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 1 | `962e8a5483aad94134c4faa1990f28aea8046a01` | feat(hooks): run session start for plugins that autoapply adds |
| 2 | `efeb21e5c9259b435b9b149b609ad64e4baf5c5e` | feat(hooks): bound the wait for late session start hooks |
| 3a | `1b14b50` | docs(hooks): describe the late session start run |
| 3b | `312434e2fd2fef6d5a90f50ee3ffbcd9fd9fe04b` | docs(planning): record the late session start decision |

Base: `ebf7145681c52df5de5bc081c2e05f6a58293b84` (`$D/plan-base`). Worktree
`/home/user/pi-claude-marketplace/.claude/worktrees/agent-af9bc1597fe9d876a`, branch
`worktree-agent-af9bc1597fe9d876a`. `$D` is
`/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/quick-261123-jdc`.

## Red proofs

- R0 (natural red, `extensions/` clean at ebf7145, before the first commit): `$D/R0-adapter.log`,
  `1 scenario (1 failed)`, `14 steps (13 passed, 1 failed)`, failed at
  `Then the hooks record these runs: # features/step_definitions/hook/runs.steps.ts:164`; the diff
  is exactly the missing `late-start` row; the `early-start` row matched as written, so no cell of
  the scenario was changed. `restored=clean`.
- `check-red.mjs ... red-` (`$D/red-check.log`): `RED-PROOFS OK`, exit 0.
- B1 (`$D/B1-adapter.log`, the late run dispatches nothing): `14 steps (13 passed, 1 failed)`,
  same `Then`, no `late-start` row. `restored=clean`.
- B2 (`$D/B2-adapter.log`, `sessionStartRunsPlugin` returns true): same `Then`, a second
  `early-start` row. `restored=clean`.
- B3 (`$D/B3-adapter.log`, the ledger owes every plugin): same `Then`, a second `early-start`
  row. `restored=clean`.
- `check-red.mjs ... fix-` (`$D/red-fix.log`): `RED-PROOFS OK`, exit 0. `extensions/` clean at the
  bound commit afterwards.
- Every break file applied as the planner wrote it; no break was rewritten (no `*.planner.json`).
- Unit red logs, each written before its source changed and before its commit:
  - `$D/red-unit-leaf.log`: `ERR_MODULE_NOT_FOUND`, ` tests 1`, ` fail 1`.
  - `$D/red-unit-dispatch.log`: ` tests 1`, ` pass 0`.
  - `$D/red-unit-router.log`: ` tests 10`, ` pass 0` (TypeError: the registration resolved to no
    bridge).
  - `$D/red-unit-adapter.log`: ` tests 1`, ` pass 0` (`triggerTurn: false` instead of
    `deliverAs: "nextTurn"`).
  - `$D/red-unit-wait.log`: ` tests 3`, ` pass 0` (2 failed: hint missing, failure logged as
    `skipped`; 1 cancelled at the 20 s test timeout, the past-wait case). It ended in about 22 s.

## Checks

Node v24.22.3. All on this worktree.

| Check | Tree | Result |
| --- | --- | --- |
| `node scripts/check-features.mjs` | Task 1 working tree | exit 0 |
| five unit files (`$D/green-unit.log`) | Task 1 tree (= 962e8a5) | exit 0, ` tests 699`, ` fail 0` |
| direct coverage, five pairs (`$D/coverage.log`) | Task 1 tree | exit 0; late-session-start 14/14 branches, 7/7 functions, 82/82 lines; session-start 15/15, 3/3, 107/107; dispatch 423/423, 106/106, 1709/1709; index 46/46, 12/12, 407/407; event-router 282/282, 98/98, 1944/1944 |
| ESLint warm-up (`$D/lint-warm.log`) | Task 1 tree | exit 0 |
| `check:static` first run (`$D/check-static-1-typecheck-fail.log`) | Task 1 tree | exit 1: typecheck only (see Deviations 2) |
| `check:static` (`$D/check-static.log`) | Task 1 tree after the fix | exit 0, every step passed |
| scenario :584, adapter (`$D/green-adapter.log`) | Task 1 tree | exit 0, `1 scenario (1 passed)`, `14 steps (14 passed)` |
| `session.feature`, builtin (`$D/builtin-session.log`) | Task 1 tree | exit 0, `0 scenarios` |
| commit hook, fix commit (`$D/commit-fix.log`) | 962e8a5 | `npm run check:commit` Passed |
| six unit files (`$D/bound-unit.log`) | Task 2 tree (= efeb21e) | exit 0, ` tests 858`, ` fail 0` |
| direct coverage, six pairs (`$D/bound-coverage.log`) | Task 2 tree | exit 0; event-adapters 185/185, 40/40, 953/953; event-router 289/289, 104/104, 1977/1977; session-start 15/15, 3/3, 115/115; the other three as above |
| `check:static` (`$D/bound-check-static.log`) | Task 2 tree | exit 0 |
| scenario :584, adapter (`$D/bound-adapter.log`) | Task 2 tree | exit 0, `1 scenario (1 passed)`, `14 steps (14 passed)` |
| autoapply + subagent-child, adapter (`$D/autoapply-adapter.log`) | Task 2 tree | exit 0, `56 scenarios (56 passed)`, no step timeout |
| `features/hook`, adapter (`$D/hook-adapter.log`) | Task 2 tree | exit 0, `316 scenarios (316 passed)`, `4410 steps (4410 passed)`, no step timeout |
| commit hook, bound commit (`$D/commit-bound.log`) | efeb21e | `npm run check:commit` Passed |
| grep gates of Tasks 1, 2, 3 (leaf lines, router lines, 15 `pi.on`, entry lines, wait lines, adapter lines, docs lines, row at line 2543) | final tree | all exit 0 |
| commit-shape verifies (`$D/verify-commits.sh`) | 312434e | fix commit 9 files and title, bound commit 5 files and title, red logs older than their commits, docs and decision commits add-only (19/0 and 1/0) |

## Decisions

- HOOKLATESS-D1, recorded in `.planning/PROJECT.md` line 2543 (`-- Locked`).
- The `/clear` question, settled from the binary (Claude Code 2.1.330): the start source and the
  covered plugins are keyed by the root session, which `/clear` keeps (`noa` @310611421,
  `tgs.of(N())` @323940316), and the launch trigger runs once (`Gy`). A Pi new session sends
  `clear`, records nothing, and its load runs no late SessionStart; a session runs at most one.
- Owed plugins: those that hold a SessionStart route after the load and held none at the session's
  own SessionStart dispatch, keyed `<plugin>@<marketplace>`, scope-less. Residual: a project scope
  whose hook read failed at the session's start and succeeds at the load counts as activated.
- The late run reaches the extension through the `HooksBridge` handle that `registerHooksBridge`
  now resolves to; `prepareResources` calls it last. No new `pi.on`; 15 call sites stay.
- The 10-second wait matches `S5(){return 1e4}` @351774140 raced in `ib` @351776042; a run that
  passes it goes on, and its context is sent with `deliverAs: "nextTurn"` (the counterpart of
  `_U` @351775390 and `wU` in `beforeTurnInput`). Notices show when the hooks end (D-CF5-14).
- Pi gap: Pi keeps a `nextTurn` message in memory only (`core/agent-session.js:1956-1958`), so a
  held late context is lost when Pi ends before the next prompt.

## Deviations from Plan

1. **[Plan count] The scenario has 14 cucumber steps, not 11.** The plan's verifies grep
   `11 steps (10 passed, 1 failed)` (R0) and `11 steps (11 passed)` (green). Cucumber counts 14
   for this scenario as written (the harness adds three; the sibling plan 261123-gti saw the same
   kind of offset). R0 printed `14 steps (13 passed, 1 failed)`, and the green runs print
   `14 steps (14 passed)`. Every other condition of those verifies holds (`RED-PROOFS OK`, the
   failing `Then` at `runs.steps.ts:164`, `1 scenario (1 passed)`). No file changed for this.
2. **[Rule 3 - Blocking] Two existing test helpers in `event-router.test.ts` annotated
   `registerHooksBridge`'s result as `Promise<void>`** (`hookOutputAfterLoad`'s `load` parameter
   and its caller, and the expansion fixture's `register`). Once the registration resolves to
   `Promise<HooksBridge>`, typecheck failed there. Their four annotations became
   `Promise<unknown>`; no case and no assertion changed. Found by the first `check:static` run.
3. **[Helper set] `event-router.test.ts` gained small helpers beyond the plan's one helper and one
   projection:** `withMode` (the mode Proxy, used by the helper and by the NFR-2 case's `web`
   context), `addSessionStartRoute` (shared by the helper and the second-load case),
   `sessionRuns(source)` (the session's two expected dispatches, to avoid repeated expected arrays
   for `fallow dupes`), `lateHint` (reads the last dispatch's hint), and the `DispatchAnswer` type.
   `sessionWithAddedPlugin` also returns `runtime` and `answerWith`, and its `prepare` receives
   `root` as a second argument for `launchSession(root, ...)`.
4. **[Order] The docs section was written into the working tree while the B1-B3 runs were in
   flight** (docs only, outside `extensions/`; `break.sh` restores only `extensions/`). It was
   committed after `red-fix.log` printed `RED-PROOFS OK`, as Task 3's precondition asks.
5. The committing skill's manual `pre-commit run` with a SKIP list was not run, as the plan
   forbids it; each commit ran the full hook under the lock with the session's own `SKIP`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## For the orchestrator

The executor edited none of these files.

- CHANGELOG parent line: "In print, JSON, and RPC mode, a plugin that `autoapply` installs or
  enables as Pi starts now runs its `SessionStart` hooks in that session."
- BACKLOG closure: "HOOKLATESS-01: closed 2026-11-23 by commits 962e8a5 and efeb21e
  (HOOKLATESS-D1): in print, json, and rpc mode a plugin that a load's autoapply activates runs
  SessionStart with the session's start source, and no other plugin's hooks run again; the load
  waits at most 10 seconds for it, and a longer run's context waits for the next prompt, as in
  Claude Code; none in the terminal, on a reload, after a command, at a later load, or after a
  new session. The rules are in `docs/hooks-compatibility.md`."
- STATE.md: drop HOOKLATESS-01 from the integration-rescope "Still open" list.
- Outside this task, from the research: in rpc and json mode the install's reload hint names
  `/reload`, which those modes do not offer.
- The plan's step-count greps (`11 steps ...`) do not match this scenario's 14 steps; see
  Deviations 1 if the plan is re-verified mechanically.
- `npm run check` in the main checkout after the merge.

## Self-Check: PASSED

- Files exist: `late-session-start.ts`, `late-session-start.test.ts`, the scenario at
  `features/hook/session.feature:584`, the docs heading at line 145, the decision row at line 2543.
- Commits on HEAD: 962e8a5, efeb21e, 1b14b50, 312434e.
