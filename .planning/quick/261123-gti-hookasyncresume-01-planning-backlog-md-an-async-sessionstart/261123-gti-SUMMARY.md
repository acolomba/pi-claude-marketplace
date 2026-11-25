---
phase: quick-261123-gti
plan: 01
quick_id: 261123-gti
status: complete
subsystem: hooks-bridge
tags: [hooks, async, session-start, resume, upstream-parity]
requirements: [HOOKASYNCRESUME-01]
requires: []
provides:
  - "bridges/hooks/session-start-context.ts: HOOK_CONTEXT_MESSAGE_TYPE, ASYNC_RESPONSE_CUSTOM_TYPE, SessionStartContextDetails, AsyncAnswerHook, AsyncSessionStartDetails, sessionStartValues, asyncAnswerHeld"
affects:
  - bridges/hooks/async-rewake/registry.ts
  - bridges/hooks/event-adapters.ts
  - bridges/hooks/event-router.ts
tech-stack:
  added: []
  patterns: ["read-back of session details before send (upstream o0o port)"]
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts
    - test/bridges/hooks/session-start-context.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - test/bridges/hooks/async-rewake/registry.test.ts
    - features/hook/async.feature
    - features/step_definitions/hook/async.steps.ts
    - docs/hooks-compatibility.md
decisions:
  - "Compare the hook's raw uncapped texts, kept whole in details.values, not capped texts or contextKey keys"
  - "Hook identity is plugin, marketplace, and declared command"
  - "No source gate: the check runs for every SessionStart source"
  - "No separate guard scenario; unit rows pin the identity rule and the resume-only hook fresh pins over-removal"
  - "Reader and both custom types live in the leaf session-start-context.ts; contextKey stays in event-adapters.ts"
metrics:
  duration: "about 75 minutes"
  completed: 2026-11-23
actuals:
  tokens: 9000
  tasks: 3
  commits: 2
plan_head_before: 005f921275216162b1147985491e3b87a5c31d90
plan_head_after: 146a28b21fe22847e45908d228afef05df752a7f
---

# Quick 261123-gti Plan 01: unchanged async SessionStart answer is not added again on resume Summary

A plain `async` SessionStart hook's answer now keeps its hook (plugin, marketplace, declared command) and every uncapped text in the message details. When the hook ends, the bridge skips the answer if the nearest SessionStart context of the conversation already holds every text. This is Claude Code 2.1.295's `o0o` rule, ported into the new leaf `session-start-context.ts`.

Worktree: `/home/user/pi-claude-marketplace/.claude/worktrees/agent-ac2528f7c3b750ffc`, branch `worktree-agent-ac2528f7c3b750ffc`, base `005f921275216162b1147985491e3b87a5c31d90`.
Scratch folder `$D` = `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/quick-261123-gti`.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 1 | `c099652a9c737e6e6d3de227b49b063920e85689` | fix(hooks): stop repeating an unchanged async session start answer (8 files, +826 / -80) |
| 2 | none | breaks only; no tracked file changed |
| 3 | `146a28b21fe22847e45908d228afef05df752a7f` | docs(hooks): describe the async session start answer check (1 file, +6 / -0) |

## Red proofs

- **R0 (natural red, code without the fix, `extensions/` clean, plan base 005f921)**: `$D/R0-adapter.log`: `1 scenario (1 failed)`, `18 steps (17 passed, 1 failed)`, `exit=1`, `restored=clean`. The failing step is `Then the model receives these calls: # features/step_definitions/model.steps.ts:137`. Call 2 had one more `| 2 | user | async-ctx |` row between `second prompt` and `fresh-ctx`, as the plan measured. The log is older than the fix commit.
- `check-red.mjs ... red-` (`$D/red-check.log`): `R0-adapter: 1 scenario (1 failed) exit=1`, `failed features/hook/async.feature:261 [Then] ...`, **`RED-PROOFS OK`**, `exit=0`.
- **Leaf unit red** (`$D/red-unit-leaf.log`, test file written, module absent): `ERR_MODULE_NOT_FOUND`, ` tests 1`, ` pass 0`, ` fail 1`.
- **Registry unit red** (`$D/red-unit-registry.log`, nine `HOOKASYNCRESUME-01` cases on the old registry, `--test-timeout=20000`): ` tests 9`, ` pass 0`, ` fail 6`, ` cancelled 3`.
- **B1** (`asyncAnswerHeld` returns `false`), `$D/B1-adapter.log`: diff of `session-start-context.ts` shown; `1 scenario (1 failed)`, `18 steps (17 passed, 1 failed)`, fails at `Then the model receives these calls: # features/step_definitions/model.steps.ts:137`; `restored=clean`.
- **B2** (the reader's async-type test never matches), `$D/B2-adapter.log`: same counts, same failing `Then`; `restored=clean`.
- **B3** (the registry drops every async SessionStart answer), `$D/B3-adapter.log`: same counts, same failing `Then`; `restored=clean`.
- `check-red.mjs ... fix-` (`$D/red-fix.log`): B1, B2, B3 each `1 scenario (1 failed) exit=1`, `failed features/hook/async.feature:261 [Then] ...`, **`RED-PROOFS OK`**, `exit=0`.
- No break file was rewritten: the planner's B1, B2, and B3 old texts each occurred exactly once in the fixed tree.

## Checks

All runs on Node v24.22.3, in the worktree above. Verify scripts kept under `$D` (`verify-t1-greps.sh`, `verify-t1-cucumber.sh`, `verify-t1-commit.sh`, `run-breaks.sh`, `verify-t3.sh`).

| Check | Tree | Result |
| --- | --- | --- |
| `node scripts/check-features.mjs` | scenario added, extensions clean | exit 0 |
| Four unit files (`$D/green-unit.log`) | fix tree, before commit c099652 (same content) | exit 0; ` tests 616`, ` pass 616`, ` fail 0` |
| Direct coverage, four pairs (`$D/coverage.log`) | same | exit 0; leaf branches 48/48, functions 10/10, lines 175/175; registry 251/251, 69/69, 1340/1340; event-adapters 181/181, 39/39, 936/936; event-router 276/276, 96/96, 1872/1872 |
| Grep gates of Task 1 (`verify-t1-greps.sh`) | same | all 7 exit 0 |
| `tsc --noEmit` | same | exit 0 |
| ESLint warm-up `npm run lint` (`$D/lint-warm.log`) | same | exit 0 |
| `check:static` (`$D/check-static.log`) | same | exit 0: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features all passed |
| Scenario, adapter profile (`$D/green-adapter.log`) | same | exit 0; `1 scenario (1 passed)`, `18 steps (18 passed)`, 14.5 s |
| `features/hook/async.feature`, builtin profile (`$D/builtin-async.log`) | same | exit 0; `0 scenarios` |
| `features/hook`, adapter profile (`$D/hook-adapter.log`) | same | exit 0; `315 scenarios (315 passed)`, `4396 steps (4396 passed)`, no step timeout, 5 m 47 s |
| Commit hook for c099652 (`$D/commit-fix.log`) | c099652 | `npm run check:commit` passed; every other hook passed or skipped |
| Fix commit gate (`verify-t1-commit.sh`) | c099652 | exit 0: eight files, the title, red logs older than the commit |
| Break gate (`run-breaks.sh`) | c099652 | exit 0; `extensions/` clean afterward |
| Docs gates (`verify-t3.sh`) | 146a28b | text exit 0; paragraph at line 464 exactly once; docs commit only touched `docs/hooks-compatibility.md`, numstat `6 0` |

## Decisions

- **Raw comparison of uncapped texts.** Upstream (`O$r`, `CFi`/`hwn`, `o0o` in Claude Code 2.1.330) compares the hook's own uncapped response, which contains no saved-file path. If the bridge compared Pi's capped content raw, a long unchanged answer would be added again on every resume, because its saved file `hook-<dispatchId>-<source>.txt` changes with each dispatch. If it keyed capped content with `contextKey`, two different long texts with the same 2 KB preview and size label would count as one (research A3). Neither divergence has a license. Pi can keep the uncapped texts in `details.values`, so there is no capability gap and no path is normalized.
- **Hook identity** is plugin, marketplace, and declared command. Upstream's `pluginId` is `<plugin>@<marketplace>`, while the bridge's `pluginId` is the bare plugin name. A hook with no declared command stores no command, and the reader never takes it as an entry.
- **No source gate.** The check runs for `startup`, `resume`, `compact`, and every other source, as upstream does.
- **No separate guard scenario.** Unit rows pin the identity rule (answers from another command, another marketplace, or another plugin are skipped). A guard scenario could not pin that rule, because no answer of `fresh` is nearer than its own. The resume-only hook `fresh` in the scenario catches over-removal (break B3).
- **The reader and the custom types live in their own leaf** (`session-start-context.ts`, fallow zone `bridges-hooks`). `contextKey` and the saved-output prefix stay in `event-adapters.ts` because only the synchronous HKRL-02 check uses them. That check still reads only `claude-hook-additional-context`.

## Deviations from Plan

None. The plan was executed as written. The direct-coverage run kept the plan's `env -i` prefix as a precaution, which the plan allows.

## Known Stubs

None.

## For the orchestrator

These lines are for files the executor must not edit:

- CHANGELOG parent line: "An `async` `SessionStart` hook's unchanged answer no longer reaches the model again each time you resume or fork the session."
- BACKLOG closure: "HOOKASYNCRESUME-01: closed 2026-11-23 by commit c099652a9c737e6e6d3de227b49b063920e85689; an async SessionStart answer that the conversation already holds is not added again, as in Claude Code 2.1.295 (raw uncapped texts, nearest SessionStart context, same hook or a synchronous one). The three known gaps are in `docs/hooks-compatibility.md`."
- STATE.md: drop HOOKASYNCRESUME-01 from the integration-rescope "Still open" list.
- `npm run check` in the main checkout after the merge.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: `extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts`, `test/bridges/hooks/session-start-context.test.ts`
- FOUND: c099652 and 146a28b are ancestors of HEAD; `git rev-list --count 005f921..HEAD` = 2
