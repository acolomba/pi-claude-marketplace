---
phase: quick-261123-qru
plan: 01
subsystem: edge/plugin + shared/notification
tags: [reload, rpc, one-shot, upstream-parity, RELOADCMD-D1]
status: complete
requires: []
provides:
  - "/claude:plugin reload: Pi's reload in the terminal and over RPC, refused in a one-shot run and while a run is active"
  - "acceptsLaterCommands(host) and reloadCommandFor(mode, host) in shared/session-host.ts"
  - "the reload-started payload kind (schemaVersion 1)"
  - "reload hints and refusals that name the host's reload command, and none in a one-shot run"
affects:
  - extensions/pi-claude-marketplace/edge (router, register, help, provider, flag catalog, reload handler)
  - extensions/pi-claude-marketplace/shared (session-host, notification types/resolve/grammar/json/wire/dispatch/mcp)
  - extensions/pi-claude-marketplace/orchestrators (skill and command invocation refusals, background pass)
  - schema/claude-plugin.schema.json
tech-stack:
  added: []
  patterns:
    - "request set (WeakSet of command contexts) drained after the foreground runner, so ctx.reload() runs after the command settled"
    - "one predicate per host fact (acceptsLaterCommands, hasNativeReload) and one picker (reloadCommandFor) for every reload instruction"
key-files:
  created:
    - extensions/pi-claude-marketplace/shared/session-host.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/reload.ts
    - test/shared/session-host.test.ts
    - test/edge/handlers/plugin/reload.test.ts
    - features/plugin/reload.feature
  modified:
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
    - extensions/pi-claude-marketplace/edge/completions/provider.ts
    - extensions/pi-claude-marketplace/edge/flag-catalog.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-mcp.ts
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
    - extensions/pi-claude-marketplace/orchestrators/command-invocation.ts
    - features/plugin/help.feature
    - features/step_definitions/command.steps.ts
    - docs/json-output.md
    - docs/output-catalog.md
    - README.md
    - README.es.md
    - .planning/PROJECT.md
decisions:
  - "RELOADCMD-D1: /claude:plugin reload, the sessionful predicate acceptsLaterCommands (Pi's hasUI), and every reload instruction worded through reloadCommandFor"
metrics:
  completed: 2026-11-23
  tasks: 3
  commits: 6
actuals:
  tokens: 61000
  tasks: 3
  commits: 6
commits: 6
plan_head_before: a19cd617b86e3717af4870292ce93b9eb88ec8d7
plan_head_after: 4079ad8fd0e77532f93c345e6a7e1d527711374e
---

# Quick 261123-qru Plan 01: `/claude:plugin reload`, the sessionful predicate, and the reload wording Summary

`/claude:plugin reload` runs Pi's reload in Pi's terminal and over RPC (where Pi has no `/reload`),
reports the new `reload-started` payload right before Pi reloads, and the registration calls
`ctx.reload()` only after the command settled, so Pi answers an RPC prompt after the reloaded
runtime's load; a one-shot run and a busy session refuse it. One predicate,
`acceptsLaterCommands` (Pi's `hasUI`), decides whether the host takes later commands, and every
reload hint and refusal names the command `reloadCommandFor` picks: `/reload` in the terminal,
`/claude:plugin reload` over RPC, none in a one-shot run (RELOADCMD-D1).

Worktree `/home/user/pi-claude-marketplace/.claude/worktrees/agent-aea1f6142d1371988`, branch
`worktree-agent-aea1f6142d1371988`, base `a19cd617b86e3717af4870292ce93b9eb88ec8d7`
(`$D/plan-base`). `$D` is
`/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/quick-261123-qru`.

## Commits

| Commit | SHA | Title |
| --- | --- | --- |
| C0 (T1.2) | `e4e4f67502bf16cab07135f15a403553db7847f1` | refactor(plugin): share the no-argument check of browse |
| C1 (T1.9) | `5ec2fdfb00158fef17ef7594e219ae7dac37aa51` | feat(plugin): add /claude:plugin reload |
| C2 (T2.3) | `9b7efc1913fb672e01cc161d16638808a6835c31` | fix(notify): word reload hints for the host that shows them |
| C3 (T2.6, bound) | `0fa3804ade19be1cd98a4082661274638c7306eb` | fix(plugin): name a reload command the host offers in refusals |
| C4 (T3.2) | `b85ed43255442f8b4c6b477c602aa581051196bc` | docs: document /claude:plugin reload and its wording |
| C5 (T3.3) | `4079ad8fd0e77532f93c345e6a7e1d527711374e` | docs(planning): record the reload command decision |

Measured: `git rev-list --count a19cd61..HEAD` = 6. Every commit ran the full pre-commit hook
(no `--no-verify`, `SKIP` left as the session exported it); the hook's `npm run check:commit`
passed for C0 to C4 (for C2 it ran every pair, because the commit staged the shared fixture
`test/orchestrators/plugin/install-flow-fixture.ts`).

## Red proofs

- **R0** (natural red, `extensions/` at C0 `e4e4f67`): `$D/R0-adapter.log`, `8 scenarios (1
  passed, 7 failed)`, `48 steps (39 passed, 2 skipped, 7 failed)`, `exit=1`, `restored=clean`.
  Every one of the seven fails in its `Then`: the terminal scenario `reload.feature:7` after
  waiting 20 s for Pi's status row (`the notice Reloaded keybindings, ... timed out after 20000
  ms`, because `reload` was an unknown subcommand), `:14`, `:33`, and `:42` on the kind and
  message (an `Unknown subcommand: "reload".` usage error), and the three help scenarios
  (`help.feature:7`, `:15`, `:32`) on the usage cell. The json help guard `help.feature:41`
  passed (the one survivor). `check-red.mjs ... r0-` (`$D/log/T1.4-check-red-r0.log`):
  `RED-PROOFS OK`, and the count line matched `^8 scenarios \(1 passed, 7 failed\)`.
- **R1** (natural red, `extensions/` at C1 `5ec2fdf`): `$D/R1-adapter.log`, `2 scenarios (2
  failed)`, `26 steps (24 passed, 2 failed)`, `exit=1`, `restored=clean`; both fail in their
  `Then` on the message cell (`Run /reload to load ...` where the scenario now wants `Run
  /claude:plugin reload to load ...`). `check-red.mjs ... r1-` (`$D/log/T2.1-check-red-r1.log`):
  `RED-PROOFS OK`.
- **Unit red captures** (each ends with node:test's summary and a failing count):
  `$D/red-unit-shared.log` (1 test, 1 fail: no `rejectArguments` export),
  `$D/red-unit-session-host.log` and `$D/red-unit-reload.log` (1 test, 1 fail each: the
  modules did not exist), `$D/red-unit-hint.log` (557 tests, 17 fail: the new trailer, background
  update, migration, left-row, and print-emission rows, plus the session-host file importing the
  missing `reloadCommandFor`), `$D/red-unit-refusals.log` (see T2.4 below).
- No scenario cell or doc string needed a correction: Pi's status row read exactly
  `Reloaded keybindings, extensions, skills, prompts, themes, and context files`, and the RPC
  step design needed no adjustment (T1.8).

- **Breaks** on the bound commit `0fa3804`, one at a time with `extensions/` clean, each
  restored with `git checkout -- extensions/` (`restored=clean` in every log):

  | Break | Edit | Log | Count | Failing step |
  | --- | --- | --- | --- | --- |
  | B1 | `await ctx.reload();` -> `await Promise.resolve();` (register) | `$D/B1-adapter.log` | `2 scenarios (2 failed)` | `reload.feature:7` Then (no status row), `:14` Then (only `reload-started`) |
  | B2 | `return host.hasUI;` -> `return true;` (session-host) | `$D/B2-adapter.log` | `2 scenarios (2 failed)` | `reload.feature:33` Then, `help.feature:41` Then (the json guard's only red) |
  | B3 | `if (!ctx.isIdle()) {` -> `if (false) {` (reload handler) | `$D/B3-adapter.log` | `1 scenario (1 failed)` | `reload.feature:42` When: Pi's `extension_error` `Wait for the current response to finish before reloading.` |
  | B4 | `return host.hasUI;` -> `return false;` (session-host) | `$D/B4-adapter.log` | `4 scenarios (4 failed)` | `help.feature:7`, `:15`, `:32` Then (usage without reload), `reload.feature:14` Then (one-shot refusal) |
  | B5 | `return mode === "tui";` -> `return true;` (session-host) | `$D/B5-adapter.log` | `2 scenarios (2 failed)` | `lifecycle.feature:50`, `invocation.feature:216` Then (`/reload` over RPC) |
  | B6 | `() => reloadWhenRequested(reloadRequests, ctx)` -> `() => { void reloadWhenRequested(reloadRequests, ctx); }` (register) | `$D/B6-adapter.log` | `1 scenario (1 failed)` | `reload.feature:14` Then: the exchange held only the `reload-started` row, no `cascade` row |

  B6 failing `:14` confirms that Pi's RPC answer waits for the awaited reload, so truth 2 holds;
  no stop-and-report condition arose. No break file was rewritten (every old text occurred once).
  `check-red.mjs ... fix-` (`$D/log/T2.7-check-red-fix.log`): `RED-PROOFS OK`;
  `git status --porcelain -- extensions/` printed nothing afterwards.

## Checks

Every gate ran through `$D/gate.sh`, whose log under `$D/log/` starts with the commit it ran on
and the Node version (`v24.22.3` throughout) and ends with `exit=<status>`; `mark.sh` refused a
ledger row unless each named gate log ended with `exit=0` and each named red capture ended with a
failing node:test summary.

| Gate | Commit | Result |
| --- | --- | --- |
| T1.2 `shared.test.ts`, `browse.test.ts` | `a19cd61` + C0 edits | 62/62, 24/24 pass |
| T1.2 direct coverage `shared.ts`, `browse.ts` | `a19cd61` + C0 edits | 100% (62/62 branches, 343/343 lines; 39/39, 227/227) |
| T1.2 `check:static` | `a19cd61` + C0 edits | all seven parts passed, exit 0 |
| T1.3 `check-features.mjs` | `e4e4f67` + T1 edits | exit 0 |
| T1.6a kind tests (9 files) | `e4e4f67` + T1 edits | 1055/1055 pass |
| T1.6b every Task 1 test file (19 files) | `e4e4f67` + T1 edits | 1923/1923 pass |
| T1.7 direct coverage, 13 pairs | `e4e4f67` + T1 edits | each 100% branches, functions, lines |
| T1.7 `test:unpaired` | `e4e4f67` + T1 edits | exit 0 (first run failed on the vocabulary and sink guards, see Deviations 2 and 3) |
| T1.7 `check:static` | `e4e4f67` + T1 edits | exit 0 (first run failed on one ESLint padding error, Deviation 4) |
| T1.8 cucumber adapter (6 files) | `e4e4f67` + T1 edits | `51 scenarios (51 passed)` |
| T1.8 cucumber builtin (same files) | `e4e4f67` + T1 edits | `8 scenarios (8 passed)` (the profile runs only `@mcp` scenarios) |
| T1.9 commit hook (`check:commit`) | C1 | Passed |
| T2.2 hint tests (4 files) | `5ec2fdf` + C2 edits | 563/563 pass |
| T2.2 `test:modules` | `5ec2fdf` + C2 edits | exit 0 (first run: 1 expected print-mode failure, fixed in the test) |
| T2.2 `test:unpaired` | `5ec2fdf` + C2 edits | exit 0 |
| T2.2 `test:integration` | `5ec2fdf` + C2 edits | exit 0 |
| T2.3 direct coverage, 33 pairs (the six C2 sources and each pair whose test changed) | `5ec2fdf` + C2 edits | each 100%; `session-host.ts` 8/8 branches, 3/3 functions, 54/54 lines |
| T2.3 `check:static` | `5ec2fdf` + C2 edits | all seven parts passed, exit 0 |

| T2.4 refusal tests (5 files) | `9b7efc1` + C3 edits | 181/181 pass (red capture: 42 of 181 failed) |
| T2.4 direct coverage, 5 pairs | `9b7efc1` + C3 edits | each 100% (e.g. `orchestrators/skill-invocation.ts` 71/71 branches, 437/437 lines) |
| T2.4 `check:static` | `9b7efc1` + C3 edits | exit 0 |
| T2.4 wording gates (verify blocks 2 and 3) | `9b7efc1` + C3 edits | 0 hits; only `shared/session-host.ts` holds a reload literal; no `.hasUI` read elsewhere |
| T2.5 cucumber adapter (7 files) | `9b7efc1` + C3 edits | `67 scenarios (67 passed)` |
| T2.5 cucumber builtin (same files) | `9b7efc1` + C3 edits | `0 scenarios` (none of the seven files carries an `@mcp` tag) |
| T2.6 commit hook (`check:commit`) | C3 | Passed |
| Task 2 verify 4: `test:integration` | `0fa3804` | exit 0 |
| Task 2 verify 5: cucumber adapter (7 files) | `0fa3804` | `67 scenarios (67 passed)` |
| Task 2 verify 1, 6, 7 (red proofs, commit order, ledger) | `0fa3804` | all pass |
| T3.1 `test:unpaired` | `0fa3804` + doc edits | exit 0 (the catalog contract and JSON guide tests read the edited docs) |
| T3.1 `check:static` | `0fa3804` + doc edits | exit 0 |
| T3.2 commit hook (mdformat, markdownlint, `check:commit`) | C4 | Passed, no fixer changes |
| Task 3 verify 1 and 3 (doc passages, decision row at line 2544, commit sets) | C5 | pass |
| Task 1 verify 1, 4, 5, 6 | C1 | pass (`GREP_GATES_OK`, `VERIFY5_OK`, `VERIFY6_OK`, R0 `RED-PROOFS OK`) |

## Decisions (for the maintainer's review)

Each of these is part of RELOADCMD-D1 (the new Key Decisions row of `.planning/PROJECT.md`).
Decisions 1 to 4 of `.planning/research/HEADLESS-RELOAD.md` are the maintainer's; D1 to D9 below
are the plan's choices inside them and are flagged for review.

- **RELOADCMD-D1** -- `acceptsLaterCommands(host)` returns Pi's `hasUI` and is the only check of
  whether this Pi process takes later commands; `/claude:plugin reload` runs `ctx.reload()` only
  where it holds; the reload hint follows the same predicate; every reload instruction takes its
  command from `reloadCommandFor(mode, host)`. **Review.**
- **D1 Mid-run reload: refuse, with Claude Code's busy words** (`The session is busy, so plugins
  were not reloaded. Ask again once it is idle.`). Pi gap: Pi cannot reload while a run streams or
  compacts; Claude Code's default serves the reload in the turn. The handler checks `ctx.isIdle()`
  in every host before it asks for the reload. **Review.**
- **D2 Success output: the new `reload-started` kind** (severity `info`, `needsReload` false, no
  other field), emitted right before the reload; no `Reloaded: <counts>` line, because no context
  survives the reload. The text strategy renders it as nothing (Pi's terminal shows its own
  reload status row, and its chat rebuild would erase an earlier notice). **Review.**
- **D3 One-shot refusal text**: `Reload is unavailable: this Pi run does not accept later
  commands, so the next run loads the changes.`, with an empty usage. **Review.**
- **D4 Arguments: none.** `--force` only skips Claude Code's prompt-cache warning, which Pi does
  not have. **Review.**
- **D5 Help line**: `  reload` padded to column 53, then `activate pending plugin changes in the
  current session` (Claude Code's description, lower-case first word). **Review.**
- **D6 Completions**: Pi gives the completion callback no context, so the registration records
  `acceptsLaterCommands(ctx)` at each `session_start`; it is false until a session starts (the
  safe direction). **Review.**
- **D7 `reloadCommandFor` checks Pi's own `/reload` first** (`hasNativeReload`, true only for
  `tui`), so the terminal path reads no host field. **Review.**
- **D8 One-shot wording of the other sites**: a sentence that only says to reload is left out, and
  `X, then run <command>` becomes `X.`. **Review.**
- **D9** The four `hookDebugLog` lines that name `/reload` are debug traces and stay; the migration
  notice's cost line ("Until you reload") names no command and stays. **Review.**

### Test files Task 2 touched for `hasUI`

`NotificationContext` gained `readonly hasUI: boolean`, so `npm run typecheck` named every test
literal that builds one. Each got Pi's value for its mode (`tui` and `rpc` true, `print` and `json`
false; a loop variable gets `mode === "tui" || mode === "rpc"`, narrowed to `mode === "rpc"` where
the loop holds only `json` and `rpc`; a context whose `mode` is a getter got a `hasUI` getter
that throws or answers as its `mode` getter does). Files (in the hint commit): the
`files_modified` set `test/architecture/{background-update-notice,catalog-uat/catalog-wire,cross-op-convergence,manifest-read-agreement,mcp-config-notices,mcp-migration-notice,no-credential-leak,notify-grammar-invariant,notify-will-reload-agreement}.test.ts`,
`test/edge/{command-run,register}.test.ts`, `test/shared/{notification-summary,notification-dispatch}.test.ts`,
`test/orchestrators/marketplace/{background-pass,update,update.messaging}.test.ts`, and
`test/orchestrators/plugin/{dependency-bindings,dependency-tag-probe,enable-disable,install-cascade,install-cascade.messaging,install-clone-probe,install-flow-fixture,install-flow-ledger,install-outcome,materialize-latest,operations,reinstall-flow,update-constraint-gate,update-flow,update-preflight}.test.ts`
(`install-flow-fixture.ts` is a fixture), plus these doubles outside `files_modified`, each named
by the type check: `test/architecture/config-state-consistency.test.ts`,
`test/architecture/presentation-sink.test.ts` (the sink pattern, Deviation 2),
`test/integration/auth-e2e.test.ts`, `test/orchestrators/auth-host.test.ts`,
`test/orchestrators/marketplace/background-update.test.ts`,
`test/orchestrators/plugin/{carried-marketplace-adds,dependency-move,staging-diagnostics,update-swap}.test.ts`,
`test/orchestrators/reconcile/{apply,load}.test.ts`, and `test/platform/pi-api.test.ts`.

The two expected failure kinds: one print-mode case lost its trailer
(`notification-dispatch.test.ts`, "notify renders installed plugin with agents dep + probe
unloaded"), now stating `hasUI = false` and the one-shot text; no strict print-mode double needed
a new host read beyond the literals above.

## Progress

The ledger `$D/progress.tsv`, rows T1.1 to T3.3 (T3.4 is written after this SUMMARY). No resume: one executor context ran every step, so no row was written on resume.

| Step | Commit | Logs | Gates | Time (UTC) |
| --- | --- | --- | --- | --- |
| T1.1 | - | - | setup | 2026-11-23T20:52:17Z |
| T1.2 | `e4e4f67502bf` | 8 logs (red-unit-shared.log, ..., log/T1.2-commit.log) | unit-shared,unit-browse,cov-shared,cov-browse,lint-warm,check-static,commit | 2026-11-23T20:59:10Z |
| T1.3 | - | log/T1.3-check-features.log | check-features | 2026-11-23T21:00:20Z |
| T1.4 | - | R0-adapter.log,log/T1.4-check-red-r0.log | r0-red,check-red-r0,guard-survived | 2026-11-23T21:01:47Z |
| T1.5 | - | red-unit-session-host.log,red-unit-reload.log | red-session-host,red-reload | 2026-11-23T21:07:16Z |
| T1.6a | - | log/T1.6a-unit-kind.log | unit-kind | 2026-11-23T21:08:40Z |
| T1.6b | - | log/T1.6b-unit-task1.log | unit-task1 | 2026-11-23T21:13:00Z |
| T1.7 | - | 15 logs (log/T1.7-check-static.log, ..., log/T1.7-test-unpaired.log) | cov-13-pairs,test-unpaired,check-static | 2026-11-23T21:17:14Z |
| T1.8 | - | log/T1.8-cucumber-adapter.log,log/T1.8-cucumber-builtin.log | cucumber-adapter,cucumber-builtin | 2026-11-23T21:18:14Z |
| T1.9 | `5ec2fdfb0015` | log/T1.9-commit.log | commit | 2026-11-23T21:19:44Z |
| T2.1 | - | R1-adapter.log,log/T2.1-check-red-r1.log | r1-red,check-red-r1 | 2026-11-23T21:20:39Z |
| T2.2 | - | 5 logs (red-unit-hint.log, ..., log/T2.2-test-integration.log) | red-hint,unit-hint,test-modules,test-unpaired,test-integration | 2026-11-23T21:31:30Z |
| T2.3 | `9b7efc1913fb` | 35 logs (log/T2.3-check-static.log, ..., log/T2.3-cov-shared_session-host.ts.log) | cov-33-pairs,check-static,commit | 2026-11-23T21:39:56Z |
| T2.4 | - | 8 logs (red-unit-refusals.log, ..., log/T2.4-unit-refusals.log) | red-refusals,unit-refusals,cov-5-pairs,check-static | 2026-11-23T21:42:27Z |
| T2.5 | - | log/T2.5-cucumber-adapter.log,log/T2.5-cucumber-builtin.log | cucumber-adapter,cucumber-builtin | 2026-11-23T21:44:30Z |
| T2.6 | `0fa3804ade19` | log/T2.6-commit.log | commit | 2026-11-23T21:45:17Z |
| T2.7-B1 | - | B1-adapter.log | restored=clean | 2026-11-23T21:45:49Z |
| T2.7-B2 | - | B2-adapter.log | restored=clean | 2026-11-23T21:46:01Z |
| T2.7-B3 | - | B3-adapter.log | restored=clean | 2026-11-23T21:46:13Z |
| T2.7-B4 | - | B4-adapter.log | restored=clean | 2026-11-23T21:46:19Z |
| T2.7-B5 | - | B5-adapter.log | restored=clean | 2026-11-23T21:46:33Z |
| T2.7-B6 | - | B6-adapter.log | restored=clean | 2026-11-23T21:46:39Z |
| T2.7 | - | log/T2.7-check-red-fix.log | check-red-fix,extensions-clean | 2026-11-23T21:46:57Z |
| T3.1 | - | log/T3.1-test-unpaired.log,log/T3.1-check-static.log | test-unpaired,check-static | 2026-11-23T21:50:56Z |
| T3.2 | `b85ed4325544` | log/T3.2-commit.log | commit | 2026-11-23T21:51:46Z |
| T3.3 | `4079ad8fd0e7` | log/T3.3-commit.log | commit | 2026-11-23T21:52:03Z |


## The RPC reload contract (for sibling 261123-qrv)

As run in `features/plugin/reload.feature:14` (adapter profile, T1.8 and the B6 break):

- Send the prompt `/claude:plugin reload` (RPC `{"type":"prompt","message":"/claude:plugin reload"}`).
- Pi appends the command's own payload first:
  `{ schemaVersion: 1, kind: "reload-started", origin: { kind: "command", commandId: "plugin reload", invocationId }, severity: "info", needsReload: false }`.
- Then Pi reloads (`session_shutdown` reason `reload`, a new extension runtime, `session_start`
  and `resources_discover` with reason `reload`), and the reloaded runtime's load appends its own
  payloads in session order (none when the load has nothing to report; in `:14` it is one
  `cascade` with `needsApply: true`, tally `Reconcile pending`, 1 success, listing
  `demo@fixtures` as `will install`).
- Only then does Pi answer the prompt, with `{ disposition: "handled" }`.
- On success there is no `extension_error` and no dialog in the exchange.
- While a run is active (a prompt's tool is working, or Pi compacts), the command answers with a
  `usage-error` payload, message `The session is busy, so plugins were not reloaded. Ask again
  once it is idle.` and usage `""`, starts no reload, and the prompt's run goes on to its end
  (`reload.feature:42`).
- A reload that fails after it started is reported by Pi as an `extension_error`; the extension
  does not catch it.
- A one-shot run (print or json) refuses with a `usage-error` whose message is the D3 text and
  whose usage is `""` (`reload.feature:33`).

How `:14` proves the order: its When is the plain RPC command step, whose driver
`runCommandPayloads` (`features/lib/pi-commands.ts`) requires Pi's answer `{ disposition:
"handled" }` and keeps only the payloads appended before that answer (`collect()` in
`features/lib/pi-process.ts` ends the exchange at the matching response). The Then's `cascade` row
comes only from the reloaded runtime's load, so the Then holds only when Pi answered after the
reload. Break B6, which stops awaiting the reload, fails that Then (see Red proofs).

Step design adjustments made in T1.8: none. The prescribed When and Then passed as written on the
first run; no change to `command.steps.ts` or `features/lib/pi-commands.ts` was needed for the
runtime swap.


## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] `test/edge/flag-catalog.test.ts` gained `reload` in its catalog inventory**
- **Found during:** T1.6b (typecheck)
- **Issue:** the owner test of `edge/flag-catalog.ts` (not in `files_modified`, which names only the
  drift guard) pins the catalog verbs with a compile-time `satisfies` check, so the new
  `reload` catalog verb failed typecheck.
- **Fix:** `"reload"` after `"browse"` in its `EXPECTED_CATALOG_VERBS`.
- **Commit:** C1 (`5ec2fdf`).

**2. [Rule 3 - Blocking] `test/architecture/presentation-sink.test.ts` pins the new text-branch shape**
- **Found during:** T1.7 (`test:unpaired`)
- **Issue:** the D-16 sink guard matched the old `const args = formatRawSurface(presentation)!;
  deliver(ctx, args);` text, which the prescribed `emitText` extraction replaces (no non-null
  assertion, a guarded `deliver`).
- **Fix:** the guard now matches `const args = formatRawSurface(presentation); if (args !==
  undefined) { deliver(ctx, args);` in C1, and the same with `, reload` in C2.
- **Commits:** C1 (`5ec2fdf`), C2.

**3. [Rule 1 - Bug in a new test] the reload handler test spelled `--force`**
- **Found during:** T1.7 (`test:unpaired`, the D-75-01 vocabulary guard bans the retired
  `--force` everywhere in tests). The unknown-flag case uses `--bogus` instead.

**4. [Rule 1 - Bug in a new test] register rows read the JSON capture's UI eagerly**, and one
  lacked a blank line before `return` (ESLint padding rule). Fixed in the test before C1.

**5. [Rule 1 - Bug in a new test] the json request rows passed `undefined` to a defaulted parameter**
- **Found during:** T2.4. `greetRequest("Ada", undefined)` took the default `/reload`, so the
  strict invocation mock did not match; the two rows now spread the request and set
  `reloadCommand` explicitly.

**6. [Style] `test/shared/session-host.test.ts` groups its cases per entrypoint**
- Once `reloadCommandFor` joined `acceptsLaterCommands`, the cases moved into one `describe()`
  per export, as the unit-test rules ask for a module with several entrypoints (C2).

**7. [Process] the two scratch-helper hardenings of the plan checker**
- `mark.sh` refuses a row unless each gate log it names (under `log/`) ends with `exit=0`.
- A red unit capture (`red-unit-*.log`) counts only when it ends with node:test's summary block
  (`tests`, `pass`, a non-zero `fail`, `duration_ms`), followed by nothing but the spec reporter's
  `failing tests:` recap, which that reporter always prints after the summary of a failing run.
  Neither change touches a tracked file.

No other deviation: every prescribed text, line number, break site, and commit title held as
written, and no `fallow-ignore`, `eslint-disable`, coverage exception, or `.fallowrc.json` entry
was added (C1 removed the one `eslint-disable` of the dispatch text branch, as prescribed).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## For the orchestrator

The executor edited none of these files.

- CHANGELOG parent line: "`/claude:plugin reload` now reloads Pi, also over RPC, where Pi has no
  `/reload`. Reload hints and refusals name the command your host offers, and a one-shot run
  shows none."
- STATE.md: record quick task 261123-qru and RELOADCMD-D1; the next item is 261123-qrv.
- Run `npm run check` in the main checkout after the merge (AGENTS.md, Build verification).
- Commit this SUMMARY (and STATE.md); the executor committed neither, nor PLAN.md.

## Self-Check: PASSED

- FOUND: `extensions/pi-claude-marketplace/shared/session-host.ts`,
  `extensions/pi-claude-marketplace/edge/handlers/plugin/reload.ts`,
  `test/shared/session-host.test.ts`, `test/edge/handlers/plugin/reload.test.ts`,
  `features/plugin/reload.feature`.
- FOUND on HEAD (the six commits after `a19cd61`): `e4e4f67`, `5ec2fdf`, `9b7efc1`, `0fa3804`,
  `b85ed43`, `4079ad8`.
- `extensions/` is clean.
