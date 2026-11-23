---
phase: 06-hooks-and-auth
plan: "02"
subsystem: testing
tags: [cucumber, print-mode, device-flow, auth, integration-rescope]

requires: []
provides:
  - "features/lib/pi-one-shot.ts: a one-shot Pi runner for json and print mode, shared by the json driver"
  - "a routed one-shot launch: the git environment and the GitHub redirect travel together"
  - "print-mode steps S1, S2, S3 in features/step_definitions/command.steps.ts"
  - "four untagged scenarios in features/marketplace/device-flow.feature (AUTH-07 x2, MODE-04, MODE-04/JDOC-02)"
  - "test/integration/auth-e2e.test.ts trimmed to its staging-cleanup fault-injection case (ITSCOPE-01)"
affects: [integration-rescope Phase 8 (the kept internal case)]

actuals:
  tokens: 9600
  tasks: 3
  commits: 3
plan_head_before: 4a01e6dc393269cabcf12a304221ec1da1dc430a
plan_head_after: c5f196c9b63e844caeb46e4364fcd053e7893741

tech-stack:
  added: []
  patterns:
    - "One runner for every one-shot Pi mode; a mode-specific driver wraps it and never starts a process itself (D-BG-601)"

key-files:
  created:
    - features/lib/pi-one-shot.ts
  modified:
    - features/lib/pi-json-mode.ts
    - features/support/world.ts
    - features/step_definitions/command.steps.ts
    - features/marketplace/device-flow.feature
    - test/integration/auth-e2e.test.ts

key-decisions:
  - "The one-shot launch takes git: this.tuiEnvironment ?? piEnvironment and extensions: this.tuiExtensions together, so a routed one-shot Pi always carries the GitHub redirect (D-BG-01)"

patterns-established:
  - "Print-mode scenarios compare the whole stdout and stderr and the exit code in one deep-equal"

requirements-completed: [ITMIG-13]

duration: ~95min
completed: 2026-11-22
status: complete
---

# Phase 6 Plan 02: Print-mode and credential sign-in cases Summary

**A one-shot print-mode Pi driver that shares its runner with the json driver, four routed Device Flow scenarios (rejected-credential eviction, the new sign-in, the print-mode add refusal, the silent print-mode apply), red-proofed under seven breaks, and `auth-e2e` cut from 7 cases to its one fault-injection case.**

## Performance

| Task | Commit | Title | Files |
| --- | --- | --- | --- |
| 1 (tracer) | `1fbb71b` | test(marketplace): run a sign-in command in pi's print mode | `pi-one-shot.ts` (new), `pi-json-mode.ts`, `world.ts`, `command.steps.ts`, `device-flow.feature` |
| 2 | `d5e7849` | test(marketplace): cover a rejected credential and a silent print apply | `command.steps.ts`, `device-flow.feature` |
| 3 | `c5f196c` | test(marketplace): keep only the cleanup-failure sign-in case | `auth-e2e.test.ts` |

## Red proofs

- Scratch folder: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase06-plan02` (`$D`). Every log and command script named below is kept there (`green-1.sh`, `red-tracer.sh`, `static-1.sh`, `verify-t1-final.sh`, `green-2.sh`, `verify-t2-final.sh`, `run-breaks.sh`, `verify-t3-a.sh`, `verify-t3-b.sh`, `extract.mjs`). The shell guard refused one-line commands that call `git` inside `$(...)`, so each verify command ran verbatim from one of these scripts.
- Checkout root, the first line of every break log: `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-aed6bf1eea7d25897`.
- Plan base (`$D/plan-base`): `4a01e6dc393269cabcf12a304221ec1da1dc430a`. The precondition's `git diff --quiet 547ca25 HEAD -- extensions/ features/ test/` exited 0, so every break site and copy applies to this tree.
- Inputs: `sha256sum -c --quiet SHA256SUMS` in `$I` exited 0, and `sha256sum "$I/SHA256SUMS"` printed `4fe7d227afb3a1e5ee871637a51ece50841c291428d7c68063f5049b0a2f3490`. Every copied file was checked with `cmp`. I wrote nothing to `$I` and ran no file of `research-06/`, `plan-06/work/`, `plan-06/wt-*`, or `plan-06-vt0*`.
- Helper: `$D/break.sh`, copied from `$I/break.sh`. It is Phase 5's helper with one change: the lock is `<scratchpad>/phase06-heavy.lock` (`flock -E 75 -w 3600`), with `--parallel 1`, and a cucumber argument may be a `file:line`. The arguments, the `[file, old, new]` triples (each old text exactly once), the root from `git rev-parse --show-toplevel`, the refusal of a dirty `extensions/`, the `git checkout -- extensions/` EXIT trap, and the logged `root=`, diff, `exit=`, and `restored=` lines are as in Phase 5. `bash -n "$D/break.sh"` and `node --check "$D/check-red.mjs"` passed.
- Green runs: `green-1-adapter.log` `10 scenarios (10 passed)`, `green-1-builtin.log` `0 scenarios`, `json-1-adapter.log` `38 scenarios (38 passed)` (Task 1). `green-2-adapter.log` `13 scenarios (13 passed)`, `green-2-builtin.log` `0 scenarios` (Task 2). Every run exited 0.
- Every break command was `bash "$D/break.sh" <id> adapter "$D/brk/<id>.json" features/marketplace/device-flow.feature`. Every log ends with `restored=clean` and holds no `function timed out`. `git status --porcelain -- extensions/` printed nothing after each run (`$D/break-runs.txt`). No run needed a rerun. Task 3's runs used the committed Task 2 tree `d5e7849`. Unless a bullet says otherwise, every failure's first error line is `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`.
- `check-red.mjs` printed `RED-PROOFS OK` for the tracer tables (`red-tracer.log`) and for the main tables (`red.log`), both with `exit=0`.

Scenario lines (final file): `:10` "Adding a private GitHub marketplace signs in through Device Flow and clones it", `:49` "Updating a marketplace after a Device Flow sign-in uses the stored token without signing in again", `:79` Outline "A sign-in that GitHub answers with <outcome> fails ..." (rows `:118` access_denied, `:119` expired_token), `:121` "Installing a plugin from a private GitHub source with no cached clone signs in through Device Flow", `:163` "Installing a pinned GitHub plugin whose clone is already cached ...", `:190`, `:211`, `:231` "The background update of a private GitHub marketplace fetches with the stored GitHub credential", DF1 `:256`, DF2 `:287`, DF3 `:327`, DF4 `:351`.

- **R1-tracer** (`R1-tracer-adapter.log`, the Task 1 tree with DF3 at `:256`): `orchestrators/auth-host.ts:197`, `-    if (ctx.mode === "print") {` / `+    if (ctx.mode === ("never" as string)) {`. `10 scenarios (9 passed, 1 failed)`, `exit=1`. DF3 `:256` failed at `Then pi's print mode exits with code 0 and prints this error:`: stderr was `''` instead of the remedy. No other scenario failed.
- **E1** (`platform/git-auth-callbacks.ts:251`, `-      await opts.credentialOps.reject(opts.host, cred);` / `+      void cred;`): `13 scenarios (11 passed, 2 failed)`. DF1 `:256` failed at `Then the user's git credential store holds no credentials`. DF2 `:287` failed at `Then the command reports these results:`.
- **E2** (`platform/git-auth-callbacks.ts:209`, `-      const result = await opts.onAuthRequired();` / `+      const result = { ok: false as const, reason: "broken" };`): `13 scenarios (5 passed, 8 failed)`. At `Then the command reports these results:`: DF2 `:287`, `:10`, `:118`, `:119`, `:121`. DF3 `:327` failed at `Then pi's print mode exits with code 0 and prints this error:`. This is RESEARCH Pitfall 2: the print refusal is thrown inside the Device Flow callback that E2 skips. `:49` (at `Given the user has run "/claude:plugin marketplace add acme/tools --scope user"`) and `:163` (at `Given the user has run "/claude:plugin fetch ghp@gits --scope project"`) failed in a `Given`, which is not a must-fail row.
- **E3** (`platform/git-auth-callbacks.ts:199`, `-      if (filled !== null) {` / `+      if (filled !== null && process.env.NEVER_SET === "x") {`): `13 scenarios (9 passed, 4 failed)`. `:49` and DF1 `:256` failed at `Then the result has these fields:` with `AssertionError [ERR_ASSERTION]: expected exactly one result, got [...]`, because a `device-flow-prompt` result appeared. `:231` failed at `Then the git host receives these requests:`. DF2 `:287` failed in its `Given ..., which failed`, as the plan expects; the table leaves it out.
- **E4** (`domain/github-auth.ts:362`, `-        await opts.credentialOps.approve(opts.host, cred);` / `+        void cred;`): `13 scenarios (10 passed, 3 failed)`. `:10` and DF2 `:287` failed at `Then the user's git credential store holds these credentials:`. `:49` failed at `Then the result has these fields:` with `expected exactly one result, got [...]`.
- **R1** (`orchestrators/auth-host.ts:197`, the tracer edit): `13 scenarios (11 passed, 2 failed)`. DF3 `:327` failed at `Then pi's print mode exits with code 0 and prints this error:`. DF4 `:351` failed at `Then github's sign-in receives no request`: with the refusal gone, the sign-in requests reached the stand-in, not the network.
- **R2** (`orchestrators/marketplace/add.ts:1813`, `-    if (!stagedAtFinal) {` / `+    if (!stagedAtFinal && process.env.NEVER_SET === "x") {`): `13 scenarios (8 passed, 5 failed)`. DF3 `:327` failed at `Then the files of the project scope are unchanged`. DF4 `:351` failed at `Then the project scope holds no marketplace checkout`. DF1 `:256`, `:118`, and `:119` failed at `Then the user scope holds no marketplace checkout`.
- **R3** (`platform/git-auth-callbacks.ts:220`, `-      if (err instanceof DeviceFlowUnavailableError) {` / `+      if (err instanceof DeviceFlowUnavailableError && process.env.NEVER_SET === "x") {`): `13 scenarios (12 passed, 1 failed)`. DF3 `:327` failed at `Then pi's print mode exits with code 0 and prints this error:`.

## Case map

| Case at 547ca25 | Replaced by | Breaks | Commit |
| --- | --- | --- | --- |
| `:169` "print marketplace add rejects with its remedy after removing the real staged clone" | DF3 `:327` | R1, R2, R3, E2 | deleted in `c5f196c` |
| `:179` "orchestrated print marketplace add retains the typed refusal and cleans staging" | DF4 `:351` (the outcome fields are internal; a user sees the silence and the scope) | R1, R2 | deleted in `c5f196c` |
| `:204` "a staging cleanup failure retains the print refusal as the primary cause" | kept, internal: `fs.rm` refusing the staged clone is fault injection (ITSCOPE-01); now `:148` under the new header | - | kept in `c5f196c` |
| `:232` "real Git clone preserves a device-flow refusal from its auth callback" | DF3 `:327` (the remedy reaches stderr only if the clone rethrows it) | R3 | deleted in `c5f196c` |
| `:332` "AUTH-01 add path E2E: fill-miss triggers Device Flow, token stored via approve" | already covered: `:10`; DF2 `:287` | E4 | deleted in `c5f196c` |
| `:373` "AUTH-02 / AUTH-08 silent reuse: fill-hit returns stored cred, no Device Flow" | already covered: `:49`, `:231` | E3 | deleted in `c5f196c` |
| `:412` "AUTH-07 reject-evict-reflow: onAuthFailure evicts cred, next fill-miss re-triggers Device Flow" | DF1 `:256`, DF2 `:287` | E1, E2 | deleted in `c5f196c` |

The kept case's body is byte-identical to `:204-230` at 547ca25. The only difference is the blank line that used to separate it from `:232`.

## Checks

`node --version`: `v24.22.3`.

| Command | Exit | Commit |
| --- | --- | --- |
| Task 1 `cmp` of five files against `$I/06-02/t1/` | 0 | working tree over `4a01e6d` |
| `test:cucumber:profile --profile adapter device-flow.feature` (`green-1-adapter.log`, 10 passed) | 0 | working tree over `4a01e6d` |
| `--profile builtin device-flow.feature` (`green-1-builtin.log`, 0 scenarios) | 0 | same |
| json-mode set (`json-1-adapter.log`, 38 passed) | 0 | same |
| R1-tracer + `check-red.mjs ... tracer-` (`red-tracer.log`, `RED-PROOFS OK`) | 0 | same |
| lone `npm run lint` warm-up (`lint-warm.log`) | 0 | same |
| `check:static` (`check-static-1.log`) | 0 | same, then committed as `1fbb71b` |
| Task 1 scope verify (five files, clean tree) | 0 | `1fbb71b` |
| Task 2 `cmp` of five files against `$I/06-02/ref/` | 0 | working tree over `1fbb71b` |
| adapter `device-flow.feature` (`green-2-adapter.log`, 13 passed) | 0 | same |
| builtin `device-flow.feature` (`green-2-builtin.log`, 0 scenarios) | 0 | same |
| `check:static` (`check-static-2.log`) | 0 | same, then committed as `d5e7849` |
| Task 2 scope verify | 0 | `d5e7849` |
| seven break runs (`run-breaks.sh`), then `check-red.mjs` (`red.log`, `RED-PROOFS OK`) | 0 | `d5e7849` |
| `cmp` of the trimmed file against `$I/06-02/ref/` | 0 | working tree over `d5e7849` |
| `node --test test/integration/auth-e2e.test.ts` (`int-3.log`: tests 1, pass 1, fail 0) | 0 | same |
| `check:static` (`check-static-3.log`) | 0 | same, then committed as `c5f196c` |
| `fallow audit --base 4a01e6d` (`audit.json`) plus its node filter | 0 | `c5f196c` |
| final verify (six files, no `extensions/` change, clean tree) | 0 | `c5f196c` |

Every acceptance grep of the three tasks printed its expected value. The commit hook ran on each of the three commits, `npm run check:commit` included, and passed.

## Issues for the milestone

- `fallow audit --base 4a01e6d`: `verdict=warn`, `dead_code_issues: 0`, `complexity_findings: 0`, `duplication_clone_groups: 0`. The one diff-risk finding is `weakened-tests:test/integration/auth-e2e.test.ts` (7 cases to 1). Per the user decision of 2026-11-21, there is no `.fallowrc.json` or CI change. The finding is left to the milestone.

## Deviations from Plan

**1. [Rule 3 - Blocking] Task 2 commit title shortened**
- **Found during:** Task 2 commit
- **Issue:** gitlint refused the plan's example title `test(marketplace): cover the rejected credential and a silent print apply` (73 > 72 characters). No commit was made.
- **Fix:** I changed the title to `test(marketplace): cover a rejected credential and a silent print apply` (71 characters) and committed again without `--amend`.
- **Commit:** `d5e7849`

No scenario was strengthened, and no break was rerun. I did not add this deviation to `.planning/WINDOWS.md`: it is a wording change and leaves no defect.

## Parent lines

- `CHANGELOG.md`: None (the change is test-only).
- `.planning/BACKLOG.md`: None.
- Key Decisions table: None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: `features/lib/pi-one-shot.ts`, `.planning/phases/06-hooks-and-auth/06-02-SUMMARY.md`
- FOUND commits: `1fbb71b`, `d5e7849`, `c5f196c` (ancestors of HEAD; `git rev-list --count 4a01e6d..HEAD` = 3)
