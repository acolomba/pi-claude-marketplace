---
phase: 05-mcp-install-legacy-move-and-overrides
plan: "03"
subsystem: behavioral-tests
tags: [cucumber, mcp, mcp-adapter-json, overrides, red-proofs, integration-rescope]
status: complete
requires: []
provides:
  - "twenty-five @mcp override and choice scenarios in features/mcp-server/lifecycle.feature, run under both profiles"
  - "the Givens `the user has enabled the mcp server {string} in the mcp-adapter.json file of the {word} scope` and `the user has written the mcp-adapter.json file of the {word} scope with this text:`"
  - "the deletion of test/integration/mcp-override-lifecycle.test.ts"
affects:
  - features/mcp-server/lifecycle.feature
  - features/step_definitions/mcp-server/lifecycle.steps.ts
  - test/integration/mcp-override-lifecycle.test.ts
tech-stack:
  added: []
  patterns:
    - "whole-file mcp-adapter.json checks with an absent-command plugin server, so the text holds no machine-specific path"
    - "a Given that reproduces pi-mcp-adapter 7.0.1's /mcp-adapter enable JSON rewrite"
key-files:
  created: []
  modified:
    - features/mcp-server/lifecycle.feature
    - features/step_definitions/mcp-server/lifecycle.steps.ts
  deleted:
    - test/integration/mcp-override-lifecycle.test.ts
decisions:
  - "The override and choice scenarios carry @mcp and run under both profiles, as CONTEXT [Tags, after research] says; no new scenario is adapter-only."
metrics:
  duration: "72 min"
  completed: 2026-11-22
estimate:
  tokens: 140000
  tasks: 3
actuals:
  tokens: 23900
  tasks: 3
  commits: 3
plan_head_before: 356f8bb7a96be0cf594cf37f9e98751914f09d5d
plan_head_after: 5e7cb8f84f99812131edd5d0bea92ae9e41dcf2b
requirements: ["ITMIG-11"]
---

# Phase 5 Plan 03: MCP Override Lifecycle Scenarios Summary

Twenty-five `@mcp` cucumber scenarios now check the whole `mcp-adapter.json` text. They show
that the user's overrides, stubs, enables, and `serverChoices` survive every plugin verb under
both MCP implementations. Two new Givens support them. Each of the eleven breaks O1 to O10 made
these scenarios fail under both profiles, and `test/integration/mcp-override-lifecycle.test.ts`
is deleted.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 1 (tracer) | `26e7ec6` | `test(mcp): cover a user's enable that survives the plugin verbs` |
| 2 | `fe0b9ac` | `test(mcp): cover the user's overrides and choices across plugin verbs` |
| 3 | `5e7cb8f` | `test(mcp): drop the override cases the lifecycle scenarios replace` |

## Red proofs

- Scratch folder (`$D`): `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase05-plan03`. Every log, script, and break file named below is kept there.
- Checkout root, the first line (`root=`) of every break log: `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-a891ad8a4b8007c51`.
- Plan base (`$D/plan-base`): `356f8bb7a96be0cf594cf37f9e98751914f09d5d`. The precondition `git diff --quiet 55cd91f HEAD -- <the three files>` exited 0, so the break sites and the copies of the inputs apply to this tree.
- Inputs: `sha256sum -c --quiet SHA256SUMS` in `plan-05/inputs/` exited 0. `sha256sum SHA256SUMS` printed `a339ce02f316604955809d00c366680629b977fdbb06fc29ab2a7bc5ec058ba6`. Each copy was checked with `cmp` against its `05-03/t1/` or `05-03/ref/` source.
- Helper: `$D/break.sh`, copied from `plan-05/inputs/break.sh`. It is Phase 4's helper (`phase04-plan01/break.sh`) with two changes. The cucumber run passes `--parallel 1` instead of `--parallel 2`. The run also waits on the shared lock `<scratchpad>/phase05-heavy.lock` (`flock -E 75 -w 3600`). Everything else is unchanged. It roots at `git rev-parse --show-toplevel` and logs `root=`. It refuses a dirty `extensions/`, applies the `[file, old, new]` triples only when each old text occurs exactly once, and logs `git diff -- extensions/`. It restores with `git checkout -- extensions/` in an EXIT trap and logs `exit=` and `restored=`. `bash -n break.sh` and `node --check check-red.mjs` passed.
- Break files: `O1`, `O2b`, `O3`, `O4`, `O5`, `O6`, `O7b`, `O8a`, `O8b`, `O9`, and `O10.json`, copied from `plan-05/inputs/brk/` into `$D/brk/`.
- Green runs on clean trees:
  - Task 1: `green-1-adapter.log` `27 scenarios (27 passed)`, `exit=0`; `green-1-builtin.log` `12 scenarios (12 passed)`, `exit=0`.
  - Task 2: `green-2-adapter.log` `49 scenarios (49 passed)`, `exit=0`; `green-2-builtin.log` `34 scenarios (34 passed)`, `exit=0`.
- Each break ran with `bash "$D/break.sh" <id> <profile> "$D/brk/<id>.json" features/mcp-server/lifecycle.feature`. The Task 3 runs used the driver `$D/break-all.sh`, which wrote each row's `git status --porcelain -- extensions/` to `$D/break-all.log`. That output was empty after every run. Every log ends with `restored=clean` and holds no `function timed out`. No run needed a rerun. Unless a bullet says otherwise, a failure happened at `Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:`, with the first error line `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`. A step at `Then the model receives these calls:` or `Then the command reports these results:` failed with `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`.
- Research breaks replaced: the research's O2 (`adapter-entry.ts:479`, the kept value in place of the live one) and O7 (`adapter-doc.ts:630`) changed nothing for these inputs. O2b and O7b replace them (RESEARCH Pitfall 4). O10 is the planner's addition.
- `check-red.mjs`: `red-tracer.log` (prefix `tracer-`) and `red.log` (main tables) each end with `RED-PROOFS OK` and `exit=0`.

Scenario lines in the final file: LC1 `:1149`, LC2 `:1211`, LC3 `:1252`, LC4 `:1310`, LC5 `:1371`, LC6 `:1429`, LC7 `:1466`, LC8 `:1500`, LC9 `:1556`, LC10 `:1590`, LC11 `:1642`, LC12 `:1673`, LC13 `:1719`, LC14 `:1751`, LC15 `:1790`, LC16 `:1841`, LC17 `:1880`, LC18 `:1920`, LC19 `:1971`, LC20 `:2016`, LC21 `:2082`, LC22 `:2132`, LC23 `:2190`, LC24 `:2248`, LC25 `:2284`. On the tracer tree: LC7 `:1143`, LC8 `:1177`, LC9 `:1233`.

- **O2b-tracer, adapter** (`O2b-tracer-adapter.log`, Task 1 tree): `bridges/mcp/adapter-entry.ts:478`. After `restored[field] = liveCarried[field];` the break adds `+    } else {` and `+      restored[field] = value;`. `27 scenarios (24 passed, 3 failed)`, `exit=1`. Failed: LC7 `:1143`, LC8 `:1177`, and LC9 `:1233`. LC7 and LC9 show the written-back entry with `+   '      "disabled": true,\n'`. No existing scenario failed.
- **O2b-tracer, builtin** (`O2b-tracer-builtin.log`): the same change. `12 scenarios (9 passed, 3 failed)`, `exit=1`. Failed: LC7 `:1143`, LC8 `:1177`, and LC9 `:1233`.
- **O1, adapter** (`O1-adapter.log`): `bridges/mcp/adapter-doc.ts:349`, `-  const emptied = Object.keys(restored).length === 0 && Object.keys(kept).length > 0;` / `+  const emptied = false;`. `49 scenarios (48 passed, 1 failed)`, `exit=1`. Failed: LC24 `:2248`.
- **O1, builtin** (`O1-builtin.log`): the same change. `34 scenarios (33 passed, 1 failed)`, `exit=1`. Failed: LC24 `:2248`.
- **O2b, adapter** (`O2b-adapter.log`): the tracer's change at `adapter-entry.ts:478`. `49 scenarios (44 passed, 5 failed)`, `exit=1`. Failed: LC7 `:1466`, LC8 `:1500`, LC9 `:1556`, LC13 `:1719`, and LC24 `:2248`.
- **O2b, builtin** (`O2b-builtin.log`): the same change. `34 scenarios (29 passed, 5 failed)`, `exit=1`. Failed: LC7 `:1466`, LC8 `:1500`, LC9 `:1556`, LC13 `:1719`, and LC24 `:2248`.
- **O3, adapter** (`O3-adapter.log`): `bridges/mcp/adapter-entry.ts:476`, `-    if (!CARRIED_FIELD_SET.has(field) || livePluginSet.includes(field)) {` / `+    if (!CARRIED_FIELD_SET.has(field)) {`. `49 scenarios (48 passed, 1 failed)`, `exit=1`. Failed: LC13 `:1719`.
- **O3, builtin** (`O3-builtin.log`): the same change. `34 scenarios (33 passed, 1 failed)`, `exit=1`. Failed: LC13 `:1719`.
- **O4, adapter** (`O4-adapter.log`): `bridges/mcp/adapter-doc.ts:564`, `-    if (Object.keys(fields).length > 0) {` / `+    if (Object.keys(fields).length > 0 && process.env.NEVER_SET === "x") {`. `49 scenarios (40 passed, 9 failed)`, `exit=1`. Failed: LC14 `:1751`, LC15 `:1790`, LC16 `:1841`, LC17 `:1880`, LC18 `:1920`, LC19 `:1971`, and LC20 `:2016`. The existing adapter-only `:352` "A user's disabled choice for a plugin server survives a disable and enable" and `:380` "... survives an uninstall and install" also failed, at `Then the model receives these calls:`.
- **O4, builtin** (`O4-builtin.log`): the same change. `34 scenarios (27 passed, 7 failed)`, `exit=1`. Failed: LC14 `:1751`, LC15 `:1790`, LC16 `:1841`, LC17 `:1880`, LC18 `:1920`, LC19 `:1971`, and LC20 `:2016`.
- **O5, adapter** (`O5-adapter.log`): `bridges/mcp/adapter-doc.ts:522`, `-    const choice = ownedChoiceOf(store.choices, key, pluginName, marketplaceName);` / `+    const choice = process.env.NEVER_SET === "x" ? ownedChoiceOf(store.choices, key, pluginName, marketplaceName) : undefined;`. `49 scenarios (44 passed, 5 failed)`, `exit=1`. Failed: LC15 `:1790`, LC18 `:1920`, and LC20 `:2016`. The existing `:352` and `:380` also failed, at `Then the model receives these calls:`.
- **O5, builtin** (`O5-builtin.log`): the same change. `34 scenarios (31 passed, 3 failed)`, `exit=1`. Failed: LC15 `:1790`, LC18 `:1920`, and LC20 `:2016`.
- **O6, adapter** (`O6-adapter.log`): `bridges/mcp/adapter-doc.ts:497`, `-  return choice?.plugin === pluginName && choice.marketplace === marketplaceName` / `+  return choice !== undefined`. `49 scenarios (47 passed, 2 failed)`, `exit=1`. Failed: LC22 `:2132` and LC23 `:2190`.
- **O6, builtin** (`O6-builtin.log`): the same change. `34 scenarios (32 passed, 2 failed)`, `exit=1`. Failed: LC22 `:2132` and LC23 `:2190`.
- **O7b, adapter** (`O7b-adapter.log`): `bridges/mcp/adapter-doc.ts:672`, `-    (name) => ownedChoiceOf(store.choices, name, pluginName, marketplaceName) !== undefined,` / `+    (name) => storedChoiceOf(store.choices, name) !== undefined,`. `49 scenarios (47 passed, 2 failed)`, `exit=1`. Failed: LC22 `:2132` and LC23 `:2190`.
- **O7b, builtin** (`O7b-builtin.log`): the same change. `34 scenarios (32 passed, 2 failed)`, `exit=1`. Failed: LC22 `:2132` and LC23 `:2190`.
- **O8a, adapter** (`O8a-adapter.log`): `bridges/mcp/stage.ts:651`, `-    keptOverrides: { ...keptOverrides, ...overlays },` / `+    keptOverrides: { ...keptOverrides },`. `49 scenarios (36 passed, 13 failed)`, `exit=1`. Failed: LC1 `:1149`, LC2 `:1211`, LC3 `:1252`, LC4 `:1310`, LC5 `:1371`, LC6 `:1429`, LC7 `:1466`, LC9 `:1556`, LC10 `:1590`, LC11 `:1642`, LC12 `:1673`, and LC13 `:1719`. LC8 `:1500` failed at `Then the command reports these results:`, the first error being `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`.
- **O8a, builtin** (`O8a-builtin.log`): the same change. `34 scenarios (21 passed, 13 failed)`, `exit=1`. The failures match the adapter run: LC1 to LC7 and LC9 to LC13 at the file step, and LC8 `:1500` at `Then the command reports these results:`.
- **O8b, adapter** (`O8b-adapter.log`): `bridges/mcp/adapter-doc.ts:304`, `-    keptOverrides: keptOverridesOf(selected, pluginName, marketplaceName),` / `+    keptOverrides: {},`. `49 scenarios (47 passed, 2 failed)`, `exit=1`. Failed: LC4 `:1310` and LC5 `:1371`.
- **O8b, builtin** (`O8b-builtin.log`): the same change. `34 scenarios (32 passed, 2 failed)`, `exit=1`. Failed: LC4 `:1310` and LC5 `:1371`.
- **O9, adapter** (`O9-adapter.log`): `bridges/mcp/stage.ts:650`, `-    previous: { ...stored, ...ours, ...overStoredChoices(overlays, stored) },` / `+    previous: { ...stored, ...overStoredChoices(overlays, stored) },`. `49 scenarios (37 passed, 12 failed)`, `exit=1`. Failed: LC4 `:1310`, LC5 `:1371`, and LC21 `:2082`. Nine existing adapter-only scenarios also failed. `:408`, `:644`, `:689`, `:727`, `:939`, `:1011`, and `:1082` failed at the user-scope file step. `:318` failed at `Then the model receives these calls:`, and `:884` at `Then the command reports these results:`.
- **O9, builtin** (`O9-builtin.log`): the same change. `34 scenarios (31 passed, 3 failed)`, `exit=1`. Failed: LC4 `:1310`, LC5 `:1371`, and LC21 `:2082`.
- **O10, adapter** (`O10-adapter.log`): `bridges/mcp/adapter-doc.ts:343`, `-  const kept = restorableOverride(entry);` `-  if (kept === undefined) {` `-    return undefined;` `-  }` / `+  const kept = restorableOverride(entry) ?? {};`. `49 scenarios (37 passed, 12 failed)`, `exit=1`. Failed: LC14 `:1751`, LC15 `:1790`, LC16 `:1841`, LC17 `:1880`, LC18 `:1920`, LC19 `:1971`, and LC20 `:2016`. LC25 `:2284` failed at `Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:`. Four existing adapter-only scenarios also failed. `:45` and `:95` failed at `Then the model receives these calls:`, and `:570` and `:822` at the user-scope file step.
- **O10, builtin** (`O10-builtin.log`): the same change. `34 scenarios (26 passed, 8 failed)`, `exit=1`. Failed: LC14 to LC20 at the project file step, and LC25 `:2284` at the user-scope file step.

Every new scenario has a must-fail row under each profile, and none is a survivor.

## Case map

Lines at 55cd91f.

| Case at 55cd91f | Replaced by | Breaks | Deleted in |
| --- | --- | --- | --- |
| `:46` "AFILE-06: a project install keeps the user's override in its entry and uninstall writes it back" | LC1, LC2 | O8a | `5e7cb8f` |
| `:117` "AFILE-06: a user-scope plugin disabled in the project keeps that disable through a project install, update, reinstall and uninstall" | LC3, LC4, LC5, LC6, LC25 | O8a, O8b, O9, O10 (LC25) | `5e7cb8f` |
| `:329` "AFILE-06: a /mcp-adapter enable made while the plugin is installed survives plugin disable, enable and uninstall" | LC7, LC8, LC9 | O2b, O8a | `26e7ec6` |
| `:412` "AFILE-06: uninstall writes back no carried field the plugin's entry declares and the user's override lacks" | LC10, LC11 | O8a | `5e7cb8f` |
| `:458` "ANAME-07: a project install over a stub keeps the user's timeout for write-back while the plugin's timeout applies" | LC12, LC13 | O3, O2b, O8a | `5e7cb8f` |
| `:555` "D-08-02: a project user's disabled and openUi choices survive uninstall then reinstall" | LC14, LC15 | O4, O5, O10 | `5e7cb8f` |
| `:671` "D-08-02: a project user's disabled and trace choices survive plugin disable then enable" | LC16, LC17, LC18 | O4, O5, O10 | `5e7cb8f` |
| `:727` "D-08-02: an update that drops the server stores its choice and one that restores the server restores it" | LC19, LC20 | O4, O5, O10 | `5e7cb8f` |
| `:786` "D-08-01: a reinstall keeps the user's openUi and trace on the entry" | LC21 | O9 | `5e7cb8f` |
| `:823` loop, "D-08-02: a choice another plugin stored under the key is neither applied nor removed by an install" | LC22 | O6, O7b | `5e7cb8f` |
| `:823` loop, "D-08-02: a choice the same-named plugin of another marketplace stored under the key is neither applied nor removed by an install" | LC23 | O6, O7b | `5e7cb8f` |
| `:864` "AFILE-06: uninstall removes an absorbed disable stub that the user's later enable emptied" | LC24 | O1, O2b | `5e7cb8f` |

All twelve cases are replaced, so the file is deleted whole. Its helper
`test/integration/mcp-plugin-seed.ts` stays, because other integration files import it.

The `:117` case also checked that no `mcp.json` file is created. That check is left out. No
step fits it, and the whole-scope steps and the `mcp-adapter.json` texts already cover the
user's files (CONTEXT [Optional cases]).

## Checks

`node --version`: `v24.22.3`. Every npm command had the prefix
`npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144` and ran under
`flock -w 3600 "$S/phase05-heavy.lock"`. The worktree's shell guard refuses `git` inside
`$(...)` in a one-line command, so those verify commands ran unchanged as scripts under `$D`.

| Command (script or log) | Tree | Exit | Result |
| --- | --- | --- | --- |
| precondition: inputs `SHA256SUMS`, its hash, `node_modules/.package-lock.json`, `git diff --quiet 55cd91f HEAD` | `356f8bb` | 0 | all met |
| `cmp` of the three tracer copies | Task 1 working tree | 0 | identical |
| green adapter (`green-1-adapter.log`) | Task 1 working tree | 0 | `27 scenarios (27 passed)` |
| green builtin (`green-1-builtin.log`) | Task 1 working tree | 0 | `12 scenarios (12 passed)` |
| tracer red check (`verify-t1-red.sh`, `red-tracer.log`) | Task 1 working tree | 0 | `RED-PROOFS OK`; `extensions/` clean |
| integration (`int-1.log`) | Task 1 working tree | 0 | `tests 11`, `pass 11`, `fail 0` |
| `npm run lint` warm-up (`lint-warm.log`) | Task 1 working tree | 0 | |
| `check:static` (`check-static-1.log`) | Task 1 working tree | 0 | all seven steps passed |
| changed files (`verify-scope.sh`) | `26e7ec6` | 0 | only the three planned files; clean `features/ extensions/ test/` |
| Task 1 acceptance greps (`accept-t1.sh`) | `26e7ec6` | 0 | `1`, `1`, `5`, `10`, `1` (only the import line removed) |
| `cmp` of the two final copies | Task 2 working tree | 0 | identical |
| green adapter (`green-2-adapter.log`) | Task 2 working tree | 0 | `49 scenarios (49 passed)` |
| green builtin (`green-2-builtin.log`) | Task 2 working tree | 0 | `34 scenarios (34 passed)` |
| `check:static` (`check-static-2.log`) | Task 2 working tree | 0 | all seven steps passed |
| Task 2 acceptance greps | Task 2 working tree | 0 | `56` scenarios, `27` `@mcp`, `22` `@adapter-only`, `7` `@builtin-only`, `0` "exist only for pi-mcp-adapter", S5 `1`, `6` Givens |
| changed files (`verify-scope.sh`) | `fe0b9ac` | 0 | only the three planned files |
| 22 break runs (`break-all.sh`, `break-all.log`) | `fe0b9ac` | 0 | every run `restored=clean`, empty porcelain |
| main red check (`verify-t3-red.sh`, `red.log`) | `fe0b9ac` logs | 0 | `RED-PROOFS OK`; `extensions/` clean |
| `check:static` (`check-static-3.log`) | Task 3 working tree (deletion staged) | 0 | all seven steps passed |
| `test ! -e test/integration/mcp-override-lifecycle.test.ts` | `5e7cb8f` | 0 | absent |
| `git grep -c 'mcp-override-lifecycle' -- test` | `5e7cb8f` | 1 | no match |
| `test -e test/integration/mcp-plugin-seed.ts` | `5e7cb8f` | 0 | present |
| `fallow audit --base <plan base>` (`verify-t3-audit.sh`, `audit.json`) | `5e7cb8f` | 0 | `verdict=warn`, 0 dead code, 0 complexity, 0 clone groups, `risks=weakened-tests:test/integration/mcp-override-lifecycle.test.ts` |
| final changed files (`verify-final.sh`) | `5e7cb8f` | 0 | only the planned files; nothing under `extensions/`; clean `extensions/ features/ test/` |

Every commit ran the whole hook (`commit-t1.log`, `commit-t2.log`, `commit-t3.log`), and
gitlint passed each time. On the first two commits, `npm run check:commit` ran and passed. On the
deletion commit it skipped, as the plan expected, so `check-static-3.log` is that commit's
check. No fixer changed a file. The wave's post-merge `npm run check` gives the full verdict.

## Issues for the milestone

- `fallow audit --base 356f8bb` returned `verdict=warn` with one diff-risk finding:
  `weakened-tests` on `test/integration/mcp-override-lifecycle.test.ts`, the deleted file. Phases
  1 to 4 recorded the same finding for each deleted or trimmed test file. Per the user decision of
  2026-11-21, `.fallowrc.json` and CI stay unchanged, and the milestone handles the finding.

## Deviations from Plan

None. The plan ran exactly as written. No scenario needed strengthening, and no break run
needed a rerun.

The worktree's shell guard refused several one-line commands that called `git` inside `$(...)`.
As the execution rules allow, those commands ran unchanged as scripts under `$D`:
`verify-t1-red.sh`, `verify-scope.sh`, `accept-t1.sh`, `verify-t3-red.sh`, `verify-t3-audit.sh`,
`verify-final.sh`, and the commit wrapper `commit.sh`. The plan base was first written to
`$S/phase05-plan03-base.tmp`, because the guard also refused the combined set-up command. It
was then moved to `$D/plan-base` with the same content, `356f8bb7...`.

## Parent lines

- `CHANGELOG.md`: None.
- `.planning/BACKLOG.md`: None.
- Key Decisions table: None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: `features/mcp-server/lifecycle.feature`, `features/step_definitions/mcp-server/lifecycle.steps.ts`
- ABSENT as planned: `test/integration/mcp-override-lifecycle.test.ts`
- FOUND commits: `26e7ec6`, `fe0b9ac`, `5e7cb8f`
