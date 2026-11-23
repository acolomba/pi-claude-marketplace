---
phase: 05-mcp-install-legacy-move-and-overrides
plan: "01"
subsystem: testing
tags: [cucumber, mcp, ITMIG-09, AVAR-02, AVAR-03, AVAR-04, AVAR-05, ANAME-07, D-PG10-11, D-PG10-20, BLT-02]

requires:
  - phase: 04-prune
    provides: the break helper pattern and the red-proof SUMMARY record
provides:
  - eight new `@mcp` scenarios in features/mcp-server/configuration.feature (C1 to C8) and three new Outline rows (R1, R2, R3)
  - one new `@mcp` scenario in features/mcp-server/options.feature (P1)
  - the Given "pi runs with the scripted model, the mcp implementation, and the environment variable {string} set to {string}" in features/step_definitions/mcp-implementation.steps.ts
  - the deletion of test/integration/mcp-home-path-partial.test.ts, mcp-tool-rules.test.ts, and mcp-variable-expansion.test.ts
affects: [phase-08-internal-cases]

actuals:
  tokens: 14047
  tasks: 3
  commits: 3
plan_head_before: 356f8bb7a96be0cf594cf37f9e98751914f09d5d
plan_head_after: 7066d09670888c1e5db9f9515fa45dbc94f819c2

tech-stack:
  added: []
  patterns:
    - "A profile Pi started with one environment variable set through the launch-environment harness, so a scenario never sets a variable in the cucumber worker"

key-files:
  created: []
  modified:
    - features/mcp-server/configuration.feature
    - features/mcp-server/options.feature
    - features/step_definitions/mcp-implementation.steps.ts
  deleted:
    - test/integration/mcp-home-path-partial.test.ts
    - test/integration/mcp-tool-rules.test.ts
    - test/integration/mcp-variable-expansion.test.ts

key-decisions:
  - "All nine integration cases of the three files are replaced by user-visible scenarios, so the three files are deleted whole; test/integration/mcp-plugin-seed.ts stays because other integration files import it"

patterns-established:
  - "An install that reads a variable at install time runs in a profile Pi that the new Given starts with that variable set"

requirements-completed: [ITMIG-09]

coverage:
  - id: D1
    description: "A normal install of a plugin whose stdio server argument starts with ~/ refuses with partially-available {unsupported mcp} and the partial-install hint and changes no file of the project scope; --partial installs the plugin without that server (AVAR-03)"
    requirement: ITMIG-09
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A normal install of a plugin whose stdio server argument starts with a home path refuses with the --partial hint and writes nothing (AVAR-03)"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#An install with --partial leaves out the stdio server whose argument starts with a home path (AVAR-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An install of a remote server with tool permission rules writes it without them and reports tool-rules-unenforced naming both fields (ANAME-07)"
    requirement: ITMIG-09
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#An install of a remote server with tool permission rules writes it without them and warns that they are not enforced (ANAME-07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A project install writes the plugin and project directories, !! for a leading !, the user's variables as references, and reports variables-missing; ${CLAUDE_PROJECT_DIR} and !echo pwned reach the server as Claude Code expands them (AVAR-02, AVAR-04, BLT-02)"
    requirement: ITMIG-09
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A project install writes the plugin and project directories, escapes a leading !, and keeps the user's variables as references, warning about the unset one (AVAR-02, AVAR-04)"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A server's env value reaches it as Claude Code expands it (rows ${CLAUDE_PROJECT_DIR}, !echo pwned)"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A server's env value reaches it as Claude Code expands it, with nothing Pi reinterprets (BLT-02) (row ${CLAUDE_PROJECT_DIR})"
        status: pass
    human_judgment: false
  - id: D4
    description: "A deny-listed credential is written as an empty value with the credentials-blanked notice (AVAR-05); update, reinstall, and enable report the unset variable and the withheld credential after their rows (AVAR-04)"
    requirement: ITMIG-09
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A remote server's headers never hold a set credential that Claude Code keeps from remote servers, and the install says so (AVAR-05)"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#An update reports the unset variable and the withheld credential after its rows (AVAR-04)"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A reinstall reports the unset variable and the withheld credential after its rows (AVAR-04)"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#Enabling a disabled plugin reports the unset variable and the withheld credential after its rows (AVAR-04)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A project install writes a reference to each option's variable, and no option value, in all five fields of an entry (D-PG10-11, D-PG10-20)"
    requirement: ITMIG-09
    verification:
      - kind: e2e
        ref: "features/mcp-server/options.feature#A project install writes a reference to each option's variable in all five fields and no option value (D-PG10-11, D-PG10-20)"
        status: pass
    human_judgment: false

duration: 71min
completed: 2026-11-22
status: complete
---

# Phase 5 Plan 01: MCP Install Refusals and Variable Handling Summary

**Nine `@mcp` scenarios and three Outline rows now cover the home-path refusal, the tool-rule warning, the variable and credential handling, and the option references under both MCP profiles. Each one failed under its deliberate breaks (M1 to M10). The three integration files they replace are deleted.**

## Performance

- **Duration:** 71 min
- **Started:** 2026-11-22T05:57:16Z
- **Completed:** 2026-11-22T07:08:40Z
- **Tasks:** 3
- **Files modified:** 6 (3 changed, 3 deleted)

## Accomplishments

- C1 to C8 in `configuration.feature`, R1 and R2 in the `@adapter-only` env value Outline, R3 in the `@builtin-only` one, and P1 in `options.feature`. Every file check reads the whole `mcp-adapter.json` text, and C1 uses the whole-scope remembered and unchanged steps.
- The Given S1 starts the profile Pi with one variable set through `features/lib/pi-launch-environment.ts`. C4, C5, C6, C7, and C8 use it.
- Red proofs for M1 to M10 (with M3b and M3c, and M9b in place of M9) under every profile the scenarios' tags select. `check-red.mjs` printed `RED-PROOFS OK` for the tracer tables and the main tables.
- The three integration files are deleted, and `check:static` passes.

## Task Commits

1. **Task 1: Prove the environment-variable profile Pi end to end on the AVAR-05 scenario, and delete the case it replaces** - `1c726a2` (test)
2. **Task 2: Add the AVAR-03, ANAME-07, AVAR-02, AVAR-04, and D-PG10-11 scenarios and the three Outline rows** - `7467586` (test)
3. **Task 3: Break every ITMIG-09 behavior under both profiles, check the red proofs, and delete the three integration files** - `7066d09` (test)

## Files Created/Modified

- `features/mcp-server/configuration.feature`: the description clause (AVAR-03, ANAME-07, AVAR-05, AVAR-04), C1 to C8, and R1 to R3
- `features/mcp-server/options.feature`: one description sentence (D-PG10-11, D-PG10-20) and P1
- `features/step_definitions/mcp-implementation.steps.ts`: the Given S1, its imports, and one `@fileoverview` clause
- `test/integration/mcp-home-path-partial.test.ts`, `test/integration/mcp-tool-rules.test.ts`, `test/integration/mcp-variable-expansion.test.ts`: deleted

## Red proofs

- Scratch folder: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase05-plan01` (`$D`). Every script named below is kept there.
- Checkout root, the first line of every break log: `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-a1041c0489d90062b`.
- Plan base (`$D/plan-base`): `356f8bb7a96be0cf594cf37f9e98751914f09d5d`. `git diff --quiet 55cd91f HEAD` over the six plan files exited 0, so the copies of `$I` apply and every site line of the plan holds (each break site was found at the plan's line; `enable-disable.ts:2691` is the comment line above the call at `:2692`).
- Inputs: `sha256sum -c --quiet SHA256SUMS` in `$I` exited 0, and `sha256sum "$I/SHA256SUMS"` printed `a339ce02f316604955809d00c366680629b977fdbb06fc29ab2a7bc5ec058ba6`. Every copy was checked with `cmp` (Task 1: the three tracer files; Task 2: the three final files).
- Helper: `$D/break.sh`, copied from `$I/break.sh`. It is Phase 4's helper with two changes: every cucumber run passes `--parallel 1` (Phase 4: `--parallel 2`) and waits for `$S/phase05-heavy.lock` through `flock -E 75 -w 3600`. `bash -n` and `node --check "$D/check-red.mjs"` passed.
- Green runs (both files together): Task 1 `green-1-adapter.log` `24 scenarios (24 passed)` and `green-1-builtin.log` `22 scenarios (22 passed)`; Task 2 `green-2-adapter.log` `34 scenarios (34 passed)` and `green-2-builtin.log` `31 scenarios (31 passed)`; all exit 0.
- Every Task 3 run used `bash "$D/break.sh" <id> <profile> "$D/brk/<id>.json" features/mcp-server/configuration.feature features/mcp-server/options.feature` on the committed tree of `7467586` (driver `$D/run-breaks.sh`, progress in `$D/breaks-progress.txt`). Every log ends with `restored=clean` and holds no `function timed out`. `git status --porcelain -- extensions/` printed nothing after each run. No run needed a rerun. Unless a bullet says otherwise, the first error line is `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`. A scenario's failing step is the one the summary reporter printed under it (`$D/failures.txt`, from `$D/extract-failures.mjs`).
- The research's M9 (`reinstall-flow.ts:360`, the single-target arm) failed nothing in research, because `reinstall demo@fixtures` reaches `surfaceReinstallMcpConfigNotices` instead (RESEARCH Pitfall 4). This plan ran M9b at `reinstall-flow.ts:619` in its place. M9 was not rerun.

Scenario lines in the final files: C1 `configuration.feature:678`, C2 `:699`, C3 `:748`, C4 `:789`, C5 `:848` (`:671` in the Task 1 tree), C6 `:894`, C7 `:920`, C8 `:943`, R1 `:448`, R2 `:449`, R3 `:491`, P1 `options.feature:621`.

- **M6-tracer, adapter** (`M6-tracer-adapter.log`, Task 1 tree): `domain/claude-mcp-variables.ts:195`, `-  if (isDenied(state.fieldClass, upper, value)) {` / `+  if (isDenied(state.fieldClass, upper, value) && process.env.NEVER_SET === "x") {`. Command: `bash "$D/break.sh" M6-tracer adapter "$D/brk/M6.json" features/mcp-server/configuration.feature features/mcp-server/options.feature`. `24 scenarios (23 passed, 1 failed)`, `exit=1`. Failed: C5 `:671` at `Then the command reports these results:`. Nothing else failed.
- **M6-tracer, builtin** (`M6-tracer-builtin.log`): the same change and command with `builtin`. `22 scenarios (21 passed, 1 failed)`, `exit=1`. Failed: C5 `:671` at `Then the command reports these results:`.
- **M1, adapter** (`M1-adapter.log`): `domain/mcp-server-features.ts:475`, `-  return (server.args ?? []).some((arg) => startsWithHomeMarker(arg)) ? "args ~" : undefined;` / `+  return undefined;`. `34 scenarios (32 passed, 2 failed)`, `exit=1`. Failed: C1 `:678` at `Then the command reports these results:`; C2 `:699` at `Then the results list these marketplaces and plugins:`.
- **M1, builtin** (`M1-builtin.log`): the same change. `31 scenarios (29 passed, 2 failed)`, `exit=1`. Failed: C1 `:678` at `Then the command reports these results:`; C2 `:699` at `Then the results list these marketplaces and plugins:`.
- **M2, adapter** (`M2-adapter.log`): `domain/mcp-server-features.ts:443`, `-  if (Object.keys(server.toolPermissions ?? {}).length > 0) {` / `+  if (Object.keys(server.toolPermissions ?? {}).length > 0 && process.env.NEVER_SET === "x") {`. `34 scenarios (33 passed, 1 failed)`, `exit=1`. Failed: C3 `:748` at `Then the command reports these results:`.
- **M2, builtin** (`M2-builtin.log`): the same change. `31 scenarios (30 passed, 1 failed)`, `exit=1`. Failed: C3 `:748` at `Then the command reports these results:`.
- **M3, adapter** (`M3-adapter.log`): `domain/claude-mcp-variables.ts:105`, `-      : withRoot.replaceAll("${CLAUDE_PROJECT_DIR}", () => projectDir);` / `+      : withRoot;`. `34 scenarios (33 passed, 1 failed)`, `exit=1`. Failed: C4 `:789` at `Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:`, first error `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`.
- **M3, builtin** (`M3-builtin.log`): the same change. `31 scenarios (30 passed, 1 failed)`, `exit=1`. Failed: C4 `:789` at the same step, with the same first error line.
- **M3b, adapter only** (`M3b-adapter.log`): `shared/session-env.ts:137`, `-  process.env.CLAUDE_PROJECT_DIR = cwd;` / `+  process.env.CLAUDE_PROJECT_DIR = "/nowhere";`. `34 scenarios (33 passed, 1 failed)`, `exit=1`. Failed: R1 `:448` at `Then the model receives these calls:`.
- **M3c, builtin only** (`M3c-builtin.log`): `orchestrators/mcp/builtin-registration-step.ts:262`, `-    projectDir: session.cwd,` / `+    projectDir: "/nowhere",`. `31 scenarios (30 passed, 1 failed)`, `exit=1`. Failed: R3 `:491` at `Then the model receives these calls, with each tool search reduced to the tools it loads:`.
- **M4, adapter** (`M4-adapter.log`): `bridges/mcp/adapter-escape.ts:120`, ``-  return secret && written.startsWith("!") ? `!${written}` : written;`` / `+  return written;`. `34 scenarios (32 passed, 2 failed)`, `exit=1`. Failed: C4 `:789` at the `mcp-adapter.json` text step (first error `... strictly equal:`); R2 `:449` at `Then the model receives these calls:`.
- **M4, builtin** (`M4-builtin.log`): the same change. `31 scenarios (30 passed, 1 failed)`, `exit=1`. Failed: C4 `:789` at the `mcp-adapter.json` text step (first error `... strictly equal:`).
- **M5, adapter** (`M5-adapter.log`): `domain/claude-mcp-variables.ts:211`, `-  state.missing.push(name);` deleted. `34 scenarios (27 passed, 7 failed)`, `exit=1`. Failed: C4 `:789`, C6 `:894`, C7 `:920`, C8 `:943`, each at `Then the command reports these results:`. The other three are existing `@adapter-only` scenarios that failed at their setup `Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned that the mcp server ... reads the unset variable ...`: `:173` "A loopback remote server receives the plugin's headers, a variable among them expanded when it connects", `:333` "A header whose variable is unset when the server connects reaches it empty, a documented Pi gap where Claude Code keeps the literal", and `:494` "A variable reference in env reaches the server with the value Pi starts with".
- **M5, builtin** (`M5-builtin.log`): the same change. `31 scenarios (27 passed, 4 failed)`, `exit=1`. Failed: C4 `:789`, C6 `:894`, C7 `:920`, C8 `:943`, each at `Then the command reports these results:`.
- **M6, adapter** (`M6-adapter.log`): the M6-tracer change. `34 scenarios (30 passed, 4 failed)`, `exit=1`. Failed: C5 `:848`, C6 `:894`, C7 `:920`, C8 `:943`, each at `Then the command reports these results:`.
- **M6, builtin** (`M6-builtin.log`): the same change. `31 scenarios (27 passed, 4 failed)`, `exit=1`. Failed: C5 `:848`, C6 `:894`, C7 `:920`, C8 `:943`, each at `Then the command reports these results:`.
- **M7, adapter** (`M7-adapter.log`): `bridges/mcp/substitute.ts:69`, `-    optionForm: { kind: "reference", names },` / `+    optionForm: { kind: "text" },`. `34 scenarios (29 passed, 5 failed)`, `exit=1`. Failed: P1 `options.feature:621` at `Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:` (first error `... strictly equal:`). The existing scenarios that also failed: `options.feature:222` "The entry of a server that names a plugin option holds a reference and no option value (PG-CORE-03, D-PG10-11)", `:500` "A new session disables in mcp-adapter.json a server that names a plugin option of a record whose options do not parse (D-PG10-25)", and `:562` "A reinstall enables again in mcp-adapter.json a server the load held back (D-PG10-25)", each at the user-scope `mcp-adapter.json` text step (`... strictly equal:`); `:470` "A new session starts no server that names a plugin option of a record whose options do not parse (D-PG10-25)" at `Then the model receives these calls:`.
- **M7, builtin** (`M7-builtin.log`): the same change. `31 scenarios (30 passed, 1 failed)`, `exit=1`. Failed: P1 `options.feature:621` at the project-scope `mcp-adapter.json` text step (`... strictly equal:`).
- **M8, adapter** (`M8-adapter.log`): `orchestrators/plugin/update-flow.ts:645`, `-  notifyMcpConfigNotices(ctx, run, [...notices, ...(failed?.mcpConfigNotices ?? [])]);` / `+  notifyMcpConfigNotices(ctx, run, [...(failed?.mcpConfigNotices ?? [])]);`. `34 scenarios (33 passed, 1 failed)`, `exit=1`. Failed: C6 `:894` at `Then the command reports these results:`.
- **M8, builtin** (`M8-builtin.log`): the same change. `31 scenarios (30 passed, 1 failed)`, `exit=1`. Failed: C6 `:894` at `Then the command reports these results:`.
- **M9b, adapter** (`M9b-adapter.log`): `orchestrators/plugin/reinstall-flow.ts:619`, `-      outcome.partition === "skipped" ? [] : (outcome.mcpConfigNotices ?? []),` / `+      outcome.partition === "skipped" ? [] : [],`. `34 scenarios (33 passed, 1 failed)`, `exit=1`. Failed: C7 `:920` at `Then the command reports these results:`.
- **M9b, builtin** (`M9b-builtin.log`): the same change. `31 scenarios (30 passed, 1 failed)`, `exit=1`. Failed: C7 `:920` at `Then the command reports these results:`.
- **M10, adapter** (`M10-adapter.log`): `orchestrators/plugin/enable-disable.ts:2691-2692`, `-    // AFILE-04: the notices follow the rows, on success and on failure.` `-    notifyMcpConfigNotices(ctx, run, sink.mcpConfigNotices);` / `+    notifyMcpConfigNotices(ctx, run, []);`. `34 scenarios (33 passed, 1 failed)`, `exit=1`. Failed: C8 `:943` at `Then the command reports these results:`.
- **M10, builtin** (`M10-builtin.log`): the same change. `31 scenarios (30 passed, 1 failed)`, `exit=1`. Failed: C8 `:943` at `Then the command reports these results:`.

`$D/red-tracer.log` and `$D/red.log` each end with `RED-PROOFS OK` and `exit=0`. Every new scenario and row has a must-fail row under each profile its tags select, and there is no survivor.

## Case map

Lines at 55cd91f.

| Case at 55cd91f | Replaced by | Breaks | Deleted in |
| --- | --- | --- | --- |
| `mcp-home-path-partial.test.ts:40` "AVAR-03: a normal install of a plugin whose stdio args start with ~/ refuses with {unsupported mcp} and the --partial hint" | C1 (`configuration.feature:678`) | M1 | `7066d09` |
| `mcp-home-path-partial.test.ts:69` "AVAR-03: --partial installs the plugin without the server whose args start with ~/" | C2 (`:699`); its record fields are internal and are dropped | M1 | `7066d09` |
| `mcp-tool-rules.test.ts:23` "ANAME-07: a plugin whose http server declares tool permission rules installs and warns that they are not enforced" | C3 (`:748`) | M2 | `7066d09` |
| `mcp-variable-expansion.test.ts:42` "AVAR-02: a project install writes Claude's variable rule for the adapter and warns about the unset variable" | C4 (`:789`), R1 (`:448`), R2 (`:449`), R3 (`:491`) | M3, M4, M5, M3b, M3c | `7066d09` |
| `mcp-variable-expansion.test.ts:124` "AVAR-05: a remote server's header never receives a set deny-listed credential, and the user is told" | C5 (`:848`) | M6 (tracer and main) | `1c726a2` |
| `mcp-variable-expansion.test.ts:186` "D-PG10-11: a project install writes a reference to each option's process variable in the five fields, and no option value" | P1 (`options.feature:621`) | M7 | `7066d09` |
| `mcp-variable-expansion.test.ts:317` "AVAR-04: an update reports the unset variable and the withheld credential after its rows" | C6 (`:894`) | M8, M5, M6 | `7066d09` |
| `mcp-variable-expansion.test.ts:365` "AVAR-04: a reinstall reports the unset variable and the withheld credential after its rows" | C7 (`:920`) | M9b, M5, M6 | `7066d09` |
| `mcp-variable-expansion.test.ts:403` "AVAR-04: enabling a disabled plugin reports the unset variable and the withheld credential after its rows" | C8 (`:943`) | M10, M5, M6 | `7066d09` |

Nine cases: nine deleted, none kept. `test/integration/mcp-plugin-seed.ts` stays, because other integration files import it.

## Checks

`node --version`: `v24.22.3`. Every npm script and commit carried the prefix `npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. Every cucumber run, the ESLint warm-up, every `check:static`, the audit, and every commit ran under `flock -w 3600 "$S/phase05-heavy.lock"`. Verify commands that call `git` inside `$(...)` ran unchanged as scripts under `$D`, because the worktree's shell guard refuses them on one line.

| Command (script or log) | Tree | Exit | Result |
| --- | --- | --- | --- |
| precondition: `test -x $S/nondac-sh`, `sha256sum -c --quiet SHA256SUMS`, the SHA256SUMS hash, `node_modules/.package-lock.json`, `git diff --quiet 55cd91f HEAD -- <six files>` | `356f8bb` | 0 | all met |
| `cmp` of the three tracer copies | Task 1 working tree | 0 | equal |
| green, adapter (`green-1-adapter.log`) | Task 1 working tree | 0 | `24 scenarios (24 passed)` |
| green, builtin (`green-1-builtin.log`) | Task 1 working tree | 0 | `22 scenarios (22 passed)` |
| tracer red check (`verify-t1-4.sh`, `red-tracer.log`) | Task 1 working tree | 0 | `RED-PROOFS OK`, `extensions/` clean |
| integration (`int-1.log`) | Task 1 working tree | 0 | `tests 5`, `pass 5`, `fail 0` |
| `npm run lint` warm-up (`lint-warm.log`) | Task 1 working tree | 0 | |
| `check:static` (`check-static-1.log`) | Task 1 working tree | 0 | all seven steps passed |
| commit hook (`commit-1.log`) | `1c726a2` | 0 | `npm run check:commit` Passed, gitlint Passed |
| file set and criteria (`verify-t1-files.sh`) | `1c726a2` | 0 | three planned files; S1 1, C5 1, `test(` 5, sentinel 0, no `-` line in `configuration.feature`; title 59 characters |
| `cmp` of the three final copies | Task 2 working tree | 0 | equal |
| green, adapter (`green-2-adapter.log`) | Task 2 working tree | 0 | `34 scenarios (34 passed)` |
| green, builtin (`green-2-builtin.log`) | Task 2 working tree | 0 | `31 scenarios (31 passed)` |
| `check:static` (`check-static-2.log`) | Task 2 working tree | 0 | all seven steps passed |
| commit hook (`commit-2.log`) | `7467586` | 0 | `npm run check:commit` Passed, gitlint Passed (second attempt, see Issues Encountered) |
| file set and criteria (`verify-t2-files.sh`) | `7467586` | 0 | four files so far; `Scenario` 25, `@mcp` 9, `@adapter-only` 8, `@builtin-only` 8, `${CLAUDE_PROJECT_DIR}` rows 2, P1 1, `example.test` 0 and 0; title 70 characters |
| 22 break runs (`run-breaks.sh`, `breaks-progress.txt`) | `7467586` plus each break | 0 each | see Red proofs |
| red check (`verify-t3-1.sh`, `red.log`) | `7467586` logs | 0 | `RED-PROOFS OK`, `extensions/` clean |
| `check:static` (`check-static-3.log`) | Task 3 working tree, deletions staged | 0 | all seven steps passed |
| commit hook (`commit-3.log`) | `7066d09` | 0 | gitlint Passed; `npm run check:commit` skipped (deletions only), so `check-static-3.log` is this commit's check |
| `fallow audit --base <plan base>` (`verify-t3-audit.sh`, `audit.json`) | `7066d09` | 0 | `verdict=warn`, 0 dead code, 0 complexity, 0 clone groups, `risks=` only the three `weakened-tests` below |
| absence, file set, criteria (`verify-t3-audit.sh`) | `7066d09` | 0 | the three files absent; only the six planned files changed; nothing under `extensions/`; clean `extensions/ features/ test/`; 20 `M*-{adapter,builtin}.log` files with `M3b-adapter.log` and `M3c-builtin.log`; `git grep -c 'mcp-variable-expansion' -- test` empty; `mcp-plugin-seed.ts` present; title 67 characters |

Inside the worktree, the commit hook ran `check:commit` for the first two commits and skipped it for the deletion-only commit. The wave's post-merge `npm run check` is the full verdict.

## Issues for the milestone

`fallow audit --base 356f8bb7a96be0cf594cf37f9e98751914f09d5d` returned `verdict=warn` with `dead_code_issues: 0`, `complexity_findings: 0`, and `duplication_clone_groups: 0`. It reported three diff-risk findings and nothing else:

- `weakened-tests`: `test/integration/mcp-home-path-partial.test.ts`
- `weakened-tests`: `test/integration/mcp-tool-rules.test.ts`
- `weakened-tests`: `test/integration/mcp-variable-expansion.test.ts`

These are left to the milestone, with no `.fallowrc.json` or CI change (user decision 2026-11-21).

## Decisions Made

None beyond the plan. The three files are deleted whole because all nine of their cases are replaced (CONTEXT [Deletion]).

## Deviations from Plan

None. The plan ran as written. No scenario was strengthened, no table was edited, and no break needed a rerun.

## Issues Encountered

- The first Task 2 commit failed gitlint, because the plan's example title `test(mcp): cover the install refusals, rule warning, and variable notices` has 73 characters (limit 72). The title became `test(mcp): cover install refusals, rule warnings, and variable notices` (70 characters), and the second commit attempt passed. Nothing was amended.
- The shell guard refused one-line commands that call `git` inside `$(...)`. Those verify commands ran unchanged as scripts under `$D`: `verify-t1-4.sh`, `verify-t1-files.sh`, `verify-t2-files.sh`, `verify-t3-1.sh`, `verify-t3-audit.sh`, `commit-guard.sh`, `actuals.sh`, and `case-titles.sh`.

## Parent lines

- `CHANGELOG.md`: None
- `.planning/BACKLOG.md`: None
- Key Decisions table: None

## User Setup Required

None. No external service needs configuration.

## Next Phase Readiness

The wave's post-merge `npm run check` on the combined tree is the full verdict of this plan. Phase 8 takes no case from these three files, because none remains.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- Files: `features/mcp-server/configuration.feature`, `features/mcp-server/options.feature`, and `features/step_definitions/mcp-implementation.steps.ts` exist; the three deleted integration files do not.
- Commits: `1c726a2`, `7467586`, and `7066d09` are ancestors of HEAD; `git rev-list --count 356f8bb..HEAD` is 3 before this SUMMARY's commit.

---
*Phase: 05-mcp-install-legacy-move-and-overrides*
*Completed: 2026-11-22*
