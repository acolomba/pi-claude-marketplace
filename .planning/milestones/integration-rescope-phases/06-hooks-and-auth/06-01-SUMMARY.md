---
phase: 06-hooks-and-auth
plan: "01"
subsystem: testing
tags: [cucumber, hooks, harness, integration-rescope, red-proofs]

requires:
  - phase: 05-mcp-install-legacy-move-and-overrides
    provides: the break helper and the red-proof checker, in their Phase 6 form
provides:
  - "F1: the profile Pi's release reads an unreaped (zombie) hook process as gone (ESRCH)"
  - "F2: the stand-in log reader keeps only complete lines"
  - "the step `the project directory is empty` (whole-directory check)"
  - "four untagged hook scenarios: SS1 (WR-05, HOOK-E2E-01), LC1 and LC2 (DISP-02), AC1 (HOOK-E2E-04)"
  - "hooks-cross-scope-reconcile and hooks-additionalcontext-end-to-end deleted; hooks-dispatch-end-to-end trimmed to its ITSCOPE-01 case"
affects: [06-02, phase-08-internal-cases, milestone-audit]

actuals:
  tokens: 12569
  tasks: 3
  commits: 5
plan_head_before: 4a01e6dc393269cabcf12a304221ec1da1dc430a
plan_head_after: d0d3b189eb69d165cce4ba93919909bf96beb60e

tech-stack:
  added: []
  patterns:
    - "A stand-in log reader drops a trailing partial line, so a count and a later slice agree"
    - "A whole-directory emptiness step instead of a single-entry absence check"

key-files:
  created: []
  modified:
    - features/lib/hook-files.ts
    - features/lib/turn-records.ts
    - features/step_definitions/project.steps.ts
    - features/hook/session.feature
    - features/hook/lifecycle.feature
    - features/hook/additional-context.feature
    - test/integration/hooks-dispatch-end-to-end.test.ts
  deleted:
    - test/integration/hooks-cross-scope-reconcile.test.ts
    - test/integration/hooks-additionalcontext-end-to-end.test.ts

key-decisions:
  - "AC1 pins the documented /reload drop of buffered SessionStart context with a neutral title that cites docs/hooks-compatibility.md and names no decision ID; the parity question goes to the milestone's end"

patterns-established:
  - "Harness race fixes land as their own first commits, each shown by a frozen reproduction before and after"

requirements-completed: [ITMIG-12]

coverage:
  - id: D1
    description: "F1: an exited but unreaped hook process no longer fails the profile Pi's release"
    requirement: ITMIG-12
    verification:
      - kind: other
        ref: "node zombie-repro.ts <root>: ESRCH throw before, `stopHookScripts: ok` after; two full adapter runs"
        status: pass
    human_judgment: false
  - id: D2
    description: "F2: a half-written stand-in log line no longer fails a step"
    requirement: ITMIG-12
    verification:
      - kind: other
        ref: "node partial-line-repro.ts <root>: JSON throw before, ok line after; two full adapter runs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hooks of both scopes keep running after a load and after an apply (LC1, LC2)"
    requirement: ITMIG-12
    verification:
      - kind: e2e
        ref: "features/hook/lifecycle.feature:70, :91 (adapter); breaks X1, X2"
        status: pass
    human_judgment: false
  - id: D4
    description: "A user plugin's SessionStart hook runs and leaves a project with no .pi directory empty (SS1)"
    requirement: ITMIG-12
    verification:
      - kind: e2e
        ref: "features/hook/session.feature:567 (adapter); breaks W1, U1"
        status: pass
    human_judgment: false
  - id: D5
    description: "A /reload before the first prompt drops the buffered SessionStart context (AC1)"
    requirement: ITMIG-12
    verification:
      - kind: e2e
        ref: "features/hook/additional-context.feature:230 (adapter); breaks H4, H4b"
        status: pass
    human_judgment: false

duration: 58min
completed: 2026-11-22
status: complete
---

# Phase 6 Plan 01: Hooks integration cases into cucumber Summary

**The profile Pi's release now treats an ESRCH zombie as a stopped hook, and the stand-in log reader drops a half-written line. Four untagged hook scenarios (SS1, LC1, LC2, AC1) replace the user-visible integration cases. Every replaced case failed its scenario under a deliberate break first. Two of the three integration files are deleted, and the third keeps only its ITSCOPE-01 case.**

## Performance

- **Duration:** about 58 min (11:30Z to 12:28Z)
- **Started:** 2026-11-22T11:30Z (plan base recorded)
- **Completed:** 2026-11-22T12:28Z
- **Tasks:** 3 of 3
- **Files:** 7 modified, 2 deleted

## Task Commits

| Task | Commit | Title | Files |
| --- | --- | --- | --- |
| 1 (F1) | `2963239` | test(hooks): treat an unreaped hook process as stopped | `features/lib/hook-files.ts` |
| 1 (F2) | `b054c45` | test(hooks): leave a half-written stand-in log line for the next read | `features/lib/turn-records.ts` |
| 1 (tracer) | `95e41f8` | test(hooks): cover a user session hook that leaves the project empty | `project.steps.ts`, `session.feature`, `hooks-dispatch-end-to-end.test.ts` |
| 2 | `7b7182d` | test(hooks): cover hooks of both scopes after a load and an apply | `lifecycle.feature`, `additional-context.feature` |
| 3 | `d0d3b18` | test(hooks): keep only the throwing-hydrate case in integration | `hooks-cross-scope-reconcile.test.ts` (deleted), `hooks-additionalcontext-end-to-end.test.ts` (deleted), `hooks-dispatch-end-to-end.test.ts` |

## Harness fixes

- **F1** (`2963239`, `features/lib/hook-files.ts` `isRegisteredHookProcess`): the catch returns `false` for `ESRCH` as for `ENOENT`, under the two-line comment of commit 2c7d42d. The file was copied from `$I/06-01/t1/` and matched with `cmp`.
  - `repro-f1-before.log` (unchanged tree): `zombie 3419 Z`, then `stopHookScripts threw: ESRCH: no such process, open '/proc/3419/environ'`.
  - `repro-f1-after.log`: `zombie 3687 Z`, then `stopHookScripts: ok`. A rerun on the final tree (`repro-f1-final.log`) also printed `stopHookScripts: ok`.
- **F2** (`b054c45`, `features/lib/turn-records.ts` `logLines`): it keeps the text up to the last newline before it splits, under the reworded comment. It was copied from `$I/06-01/t1/` and matched with `cmp`.
  - `repro-f2-before.log`: `readLogLinesSince threw: Unterminated string in JSON at position 15 (line 1 column 16)`.
  - `repro-f2-after.log` and `repro-f2-final.log`: `readLogLinesSince: ok [["hook-runs.jsonl",[{"a":1}]]]`.
- `async.feature` with both fixes (`async-1-adapter.log`): `22 scenarios (22 passed)`, `exit=0`, 1m 28s.
- `check:static` passed before each fix commit (`check-static-f1.log`, `check-static-f2.log`, both `exit=0`), after a lone lint warm-up (`lint-warm.log`).

## Red proofs

- Scratch folder `$D`: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase06-plan01`. Every log and script named here is kept there. The loop driver is `run-breaks.sh`, its progress is in `break-runs.txt`, the extractor is `extract.mjs`, and the verify scripts are `verify-t1.sh`, `verify-t2.sh`, `verify-t3.sh`, `verify-red.sh`, `verify-audit.sh`, and `full-run.sh`. The worktree's shell guard refused the one-line forms, so I ran these scripts in their place. Commits went through `commit.sh`.
- Checkout root, the first line of every break log: `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-a69ed2a184b8f653c`.
- Plan base (`$D/plan-base`): `4a01e6dc393269cabcf12a304221ec1da1dc430a`. The precondition `git diff --quiet 547ca25 HEAD -- extensions/ features/ test/` exited 0, so the break sites of 547ca25 hold.
- Inputs: `sha256sum -c --quiet SHA256SUMS` exited 0 in `$I`, and `sha256sum "$I/SHA256SUMS"` printed `4fe7d227afb3a1e5ee871637a51ece50841c291428d7c68063f5049b0a2f3490`. I copied every `$I` file and checked each copy with `cmp`. I wrote nothing to `$I` and ran no file of `research-06/`, `plan-06/work/`, `plan-06/wt-*`, or `plan-06-vt0*`.
- Helper: `$D/break.sh`, copied from `$I/break.sh`. It is Phase 5's helper with one change: the shared lock is `<scratchpad>/phase06-heavy.lock` (`flock -E 75 -w 3600`). Each run passes `--parallel 1`, and a cucumber argument may be `file:line`. These parts are unchanged: the `[file, old, new]` triples (each old text exactly once), the root from `git rev-parse --show-toplevel`, the refusal of a dirty `extensions/`, the `git checkout -- extensions/` EXIT trap, and the logged `root=`, diff, `exit=`, and `restored=` lines. `bash -n` and `node --check check-red.mjs` passed.
- Green runs: `green-1-adapter.log` `29 scenarios (29 passed)` and `green-1-builtin.log` `0 scenarios` (Task 1), then `green-2-adapter.log` `45 scenarios (45 passed)` and `green-2-builtin.log` `0 scenarios` (Task 2). Every run exited 0.
- Every log below ends with `restored=clean` and contains no `function timed out`. `git status --porcelain -- extensions/` printed nothing after each run (`break-runs.txt` records `ext-status=[]` for each). No run needed a rerun. Task 3's runs used the committed tree of `7b7182d`. Every failure below is in a `Then`, with the first error line `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`. For a table step, the expected table that cucumber prints comes before that line.
- `check-red.mjs` printed `RED-PROOFS OK` with `exit=0` for the tracer tables (`red-tracer.log`) and for the main tables (`red.log`).

Each break command was `bash "$D/break.sh" <id> <profile> "$D/brk/<id>.json" <files cell>`.

- **W1-tracer** (Task 1 tree, `W1-tracer-adapter.log`, files `features/hook/session.feature:567`): `bridges/hooks/event-router.ts:1187` in `prepareSessionStartDataDirs`, `-    if (entries.some((entry) => entry.scope === scope)) {` / `+    if (true) {`. `1 scenario (1 failed)`, `exit=1`. SS1 failed at `Then the project directory is empty`: the actual listing was `['.pi']`, the expected `[]`.
- **X1** (`features/hook/lifecycle.feature`): `orchestrators/reconcile/read-pass.ts:526` in `rebuildScopeRoutingTable` gains `+  (globalThis as any).__pcmScope = scope;`. `bridges/hooks/event-router.ts:502` changes `-  const collected = Array.from(routingState.parsedConfigEntries().values());` to `+  ... .filter((e) => (globalThis as any).__pcmScope === undefined || e.scope === (globalThis as any).__pcmScope);`. `6 scenarios (4 passed, 2 failed)`, `exit=1`. LC1 `:70` and LC2 `:91` both failed at `Then the hooks record these runs in any order:`, because the project hook's `guard` row was missing.
- **X2** (`features/hook/lifecycle.feature`): the same `event-router.ts:502` filter, with `+      (globalThis as any).__pcmScope = scope;` at `orchestrators/reconcile/apply.ts:2395` in `applyScopes`. `6 scenarios (5 passed, 1 failed)`, `exit=1`. LC2 `:91` failed at `Then the hooks record these runs in any order:` (the `guard` row was missing).
- **H4** (`features/hook/additional-context.feature`): `bridges/hooks/runtime.ts:326`, `-  const pendingSessionStartContext = createContextBuffer<PendingSessionStartContext>();` / `+  const pendingSessionStartContext = ((globalThis as any).__pcmBuf ??= createContextBuffer<PendingSessionStartContext>());`, and `runtime.ts:433` `-      pendingSessionStartContext.drain();` removed. `10 scenarios (9 passed, 1 failed)`, `exit=1`. AC1 `:230` failed at `Then the model receives these calls:`: call 1 also held `SessionStart hook additional context: ss-ctx`.
- **H4b** (`features/hook/additional-context.feature`): `bridges/hooks/event-router.ts:1499`, `-          if (event.reason === "reload") {` / `+          if (event.reason === ("never" as string)) {`. `10 scenarios (9 passed, 1 failed)`, `exit=1`. AC1 `:230` failed at `Then the model receives these calls:`.
- **C1** (`features/hook/additional-context.feature`): `bridges/hooks/event-adapters.ts:801`, `-    context.runtime.appendPendingSessionStartContext(` / `+    ((_entry: unknown) => {})(`. `10 scenarios (6 passed, 4 failed)`, `exit=1`. These failed at `Then the model receives these calls:`: `:140` "A session start hook's additional context reaches the model on the first turn", `:161` "... when another session start hook exits 2", `:183` "Session start and prompt hook contexts reach the model in one message, session start first", and `:205` "... stays in the history of the next turn". `:140` is the must-fail row. The other three also cover the buffer.
- **C2** (`features/hook/additional-context.feature`): `bridges/hooks/event-router.ts:390`, `-  const sessionStart = runtime.drainPendingSessionStartContext().map((entry) => entry.context);` / `+  const sessionStart = runtime.pendingSessionStartContextEntries().map((entry) => entry.context);`. `10 scenarios (9 passed, 1 failed)`, `exit=1`. `:205` failed at `Then the model receives these calls:`.
- **W1** (`features/hook/session.feature:567`): the same change as W1-tracer. `1 scenario (1 failed)`, `exit=1`. SS1 failed at `Then the project directory is empty`.
- **U1** (`features/hook/session.feature:567`): `bridges/hooks/event-router.ts:839` in `hydrateTargets`, `-      .filter(([, plugin]) => !isRecordedButDisabled(plugin))` / `+      .filter(([, plugin]) => !isRecordedButDisabled(plugin) && loc.scope !== "user")`. `1 scenario (1 failed)`, `exit=1`. SS1 failed at `Then the hooks record these runs:` (actual `[]`: no SessionStart run).
- **P1** (`features/hook/session.feature:7 features/plugin/session-start-hooks.feature`): `bridges/hooks/event-router.ts:1473`, `-            await hydrateProjectScopeForCwdWith(` / `+            if (process.env.NEVER_SET === "x") await hydrateProjectScopeForCwdWith(`. `3 scenarios (3 failed)`, `exit=1`. `session.feature:7` failed at `Then the hooks record these runs:`. `session-start-hooks.feature:6` and `:19` failed at `Then the project file "session-starts.log" records these session start hook runs:`.
- **O1** (`features/hook/process.feature:110`): `bridges/hooks/event-router.ts:849`, `-          options: recordedOptionsOf(pluginRecord),` / `+          options: recordedOptionsOf({}),`. `1 scenario (1 failed)`, `exit=1`. It failed at `Then the hooks record these runs:`.
- **O2** (`features/hook/failures.feature:211`): `bridges/hooks/event-router.ts:839`, `+      .filter(([, plugin]) => !isRecordedButDisabled(plugin) && recordedOptionsOf(plugin).unreadable !== true)`. `1 scenario (1 failed)`, `exit=1`. It failed at `Then the hooks record these runs:`.
- **CH1 adapter / builtin** (`features/plugin/subagent-child.feature:406`): `bridges/hooks/payloads/post-tool-use-failure.ts:80`, `-      : { agent_type: ctx.childIdentity.agentType, agent_id: ctx.childIdentity.sessionId }),` / `+      : {}),`. Each profile gave `4 scenarios (4 failed)`, `exit=1`. Examples rows `:442`, `:443`, `:444`, and `:445` failed at `Then the hooks record these runs:` under each profile.
- **CH2 adapter / builtin** (`features/plugin/subagent-child.feature:406`): `bridges/hooks/payloads/post-tool-use.ts:84`, the same change. Each profile gave `4 scenarios (4 failed)`, `exit=1`. Rows `:442` to `:445` failed at `Then the hooks record these runs:` under each profile.

### Survivors

- **H4a** (control, `H4a-adapter.log`): the `runtime.ts:326` `globalThis` buffer alone. `10 scenarios (10 passed)`, `exit=0`, `restored=clean`. AC1 passes. Reason: Pi builds a new extension runtime on `/reload`, so the registration clear still empties a buffer shared across loads. H4 also removes the clear, and it fails AC1.
- **X2 on LC1** (`X2-adapter.log`): LC1 `:70` passed under X2. Reason: X2 breaks only apply's per-scope close, so a load still rebuilds both scopes. X1 fails LC1.

## Full runs

Both runs used the final tree `d0d3b18`, at the default parallelism, with `fd` on `PATH` (`$D/bin/fd` -> `/usr/bin/fdfind`) and under the shared lock.

| Run | Log | Count line | Wall time | Exit |
| --- | --- | --- | --- | --- |
| 1 | `full-1-adapter.log` | `2263 scenarios (2263 passed)`, `28328 steps (28328 passed)`, `16 hooks (16 passed)` | 10m 27.9s (12:06:26Z to 12:16:57Z) | 0 |
| 2 | `full-2-adapter.log` | `2263 scenarios (2263 passed)`, `28328 steps (28328 passed)`, `16 hooks (16 passed)` | 9m 59.1s (12:17:08Z to 12:27:10Z) | 0 |

`features/hook/async.feature:261` passed in both runs, release included, and no step met a JSON parse error from `features/lib/turn-records.ts`. No run failed.

## Case map

| Case at 547ca25 | Replaced by | Breaks | Commit |
| --- | --- | --- | --- |
| `hooks-cross-scope-reconcile.test.ts:101` "RECON / cross-scope: applyReconcile's per-scope rebuild loop preserves hooks-plugin entries in BOTH scopes" | LC2 `lifecycle.feature:91`, LC1 `:70` | X1, X2 | deleted in `d0d3b18` |
| `hooks-additionalcontext-end-to-end.test.ts:196` "HOOK-E2E-03: SessionStart hook stdout additionalContext reaches the before_agent_start message end-to-end" | already covered: `additional-context.feature:140`, `:205` | C1, C2 | deleted in `d0d3b18` |
| `hooks-additionalcontext-end-to-end.test.ts:272` "HOOK-E2E-04: registerHooksBridge clears the pending buffer on /reload (re-entry)" | AC1 `additional-context.feature:230` | H4, H4b (H4a the control) | deleted in `d0d3b18` |
| `hooks-dispatch-end-to-end.test.ts:186` "HOOK-E2E-01: registerHooksBridge boots a user-scope hooks-only plugin and dispatches SessionStart end-to-end" | SS1 `session.feature:567` | U1 | deleted in `d0d3b18` |
| `hooks-dispatch-end-to-end.test.ts:280` "D-PG10-23 a booted hook entry holds the options its record holds" | already covered: `process.feature:110` | O1 | deleted in `d0d3b18` |
| `hooks-dispatch-end-to-end.test.ts:293` "D-PG10-25 a record whose userConfig is a string boots with declared options and no values, and dispatches" | already covered: `failures.feature:211` | O2 | deleted in `d0d3b18` |
| `hooks-dispatch-end-to-end.test.ts:304` "HOOK-E2E-02: project-scope SessionStart plugin dispatches via the session_start lazy project hydrate" | already covered: `session.feature:7`, `session-start-hooks.feature:6`, `:19` | P1 | deleted in `d0d3b18` |
| `hooks-dispatch-end-to-end.test.ts:355` "HOOK-E2E-03: WR-05 -- session_start lazy hydrate writes nothing under a pristine project cwd" | SS1 `session.feature:567` | W1 (W1-tracer) | deleted in `95e41f8` |
| `hooks-dispatch-end-to-end.test.ts:403` "HOOK-E2E-04: a throwing lazy project hydrate never blocks SessionStart dispatch" | kept, internal (ITSCOPE-01): a host context with no `cwd` makes the lazy hydrate throw. No Pi that a scenario starts leaves `cwd` out | - | kept byte for byte in `d0d3b18` (the 46-line test block is the same as at 547ca25) |
| `hooks-dispatch-end-to-end.test.ts:450` "a registered child records complete successful and failed tool result payloads" | already covered: `subagent-child.feature:406`, rows 442 to 445 | CH1, CH2 (adapter and builtin) | deleted in `d0d3b18` |

## Checks

`node --version`: `v24.22.3`.

| Check | Log | Exit | Tree |
| --- | --- | --- | --- |
| zombie / partial-line reproductions, before | `repro-f1-before.log`, `repro-f2-before.log` | throw lines | `4a01e6d` |
| zombie reproduction, after F1 | `repro-f1-after.log` | `ok` | F1 working tree, committed as `2963239` |
| partial-line reproduction, after F2 | `repro-f2-after.log` | `ok` | F2 working tree, committed as `b054c45` |
| `npm run lint` warm-up | `lint-warm.log` | 0 | F1 working tree |
| `check:static` | `check-static-f1.log` | 0 | committed as `2963239` |
| `check:static` | `check-static-f2.log` | 0 | committed as `b054c45` |
| `async.feature` adapter | `async-1-adapter.log` | 0, 22 passed | `b054c45` |
| `session.feature` adapter / builtin | `green-1-adapter.log` / `green-1-builtin.log` | 0, 29 passed / 0 scenarios | tracer working tree, committed as `95e41f8` |
| W1-tracer break | `W1-tracer-adapter.log` | helper 0, run `exit=1`, `restored=clean` | the same |
| tracer red check | `red-tracer.log` | 0, `RED-PROOFS OK` | the same |
| integration (6 tests) | `int-1.log` | 0, `tests 6`, `pass 6`, `fail 0` | the same |
| `check:static` | `check-static-1.log` | 0 | the same |
| Task 1 verify script (cmp, repro final, commit shape, file set) | `verify-t1.sh` output | `v1=0 v2=0 v3=0 v9=0` | `95e41f8` |
| three hook files, adapter / builtin | `green-2-adapter.log` / `green-2-builtin.log` | 0, 45 passed / 0 scenarios | Task 2 working tree, committed as `7b7182d` |
| `check:static` | `check-static-2.log` | 0 | the same |
| Task 2 verify script | `verify-t2.sh` output | `v1=0 v5=0` | `7b7182d` |
| 16 break runs | `<id>-<profile>.log`, `break-runs.txt` | all `restored=clean`, 0 timeouts | `7b7182d` |
| main red check | `red.log` | 0, `RED-PROOFS OK` | `7b7182d` |
| integration (1 test) | `int-3.log` | 0, `tests 1`, `pass 1`, `fail 0` | trim working tree, committed as `d0d3b18` |
| `check:static` | `check-static-3.log` | 0 | the same |
| `fallow audit --base 4a01e6d` | `audit.json`, `audit-line.log` | verify 0 (verdict `warn`) | `d0d3b18` |
| full adapter runs | `full-1-adapter.log`, `full-2-adapter.log` | 0, 2263 passed each | `d0d3b18` |
| Task 3 final verify script | `verify-t3.sh` output | `v2=0 v-final=0` | `d0d3b18` |

Each commit's pre-commit hook passed and ran in full, with no `SKIP` and no `--no-verify` (`commit-f1.log`, `commit-f2.log`, `commit-t1.log`, `commit-t2.log`, `commit-t3.log`).

## Issues for the milestone

- **fallow audit**: verdict `warn`, summary `{"dead_code_issues":0,"dead_code_has_errors":false,"complexity_findings":0,"max_cyclomatic":null,"duplication_clone_groups":0}`. It has three `weakened-tests` findings: `test/integration/hooks-additionalcontext-end-to-end.test.ts`, `test/integration/hooks-cross-scope-reconcile.test.ts`, and `test/integration/hooks-dispatch-end-to-end.test.ts`. Under the user decision of 2026-11-21, these stay for the milestone, with no `.fallowrc.json` or CI change.
- **HOOK-E2E-04 parity**: AC1 pins the documented behavior, "Each bridge load, `/reload` included, empties the context that waits for the next prompt" (`docs/hooks-compatibility.md`, "Additional context"). No decision ID licenses this divergence. Question for the user at the end of the milestone: does Claude Code keep SessionStart additional context across its `/reload-plugins`? If it does, this is a parity gap (D-CF5-03/D-CF5-13 suggest it may), and a BACKLOG entry can follow if the user wants it researched.
- **Flakes**: none. Both full runs passed on their first attempt.

## Deviations from Plan

None. I executed the plan as written. Every file equals its frozen copy (`cmp`), and I strengthened no scenario.

Procedure notes, not deviations:

- The worktree's shell guard refused several one-line commands that call `git` inside `$(...)` or inside a compound command. As the execution rules allow, I ran them from scripts under `$D`, unchanged.
- The C1 run also failed `:161` and `:183`. They are not rows of the `must-fail` table, but they also depend on the SessionStart buffer. The checker accepts extra failures.

## Parent lines

- `CHANGELOG.md`: None (the change is test-only).
- `.planning/BACKLOG.md`: None.
- Key Decisions table: None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- The wave's post-merge `npm run check` on the combined tree with 06-02 is the full verdict.
- Phase 8 takes the kept ITSCOPE-01 case of `hooks-dispatch-end-to-end.test.ts`.

## Self-Check: PASSED

- The files exist: the seven files of `files_modified`. The two deleted files are absent.
- The commits exist on HEAD: `2963239`, `b054c45`, `95e41f8`, `7b7182d`, `d0d3b18`.
- `git diff 4a01e6d HEAD -- extensions/` is empty, and `git status --porcelain -- extensions/ features/ test/` printed nothing.
