---
phase: 05-mcp-install-legacy-move-and-overrides
plan: "02"
subsystem: testing
tags: [cucumber, mcp, legacy-move, ITMIG-10, ITSCOPE-01, AMIG-01, AMIG-02, AMIG-03, AMIG-04, MREC-02, MREC-03, D-P3-16, D-CF6-02, ANAME-07]
status: complete

requires:
  - phase: 04-prune
    provides: the break helper pattern and the red-proof SUMMARY record
provides:
  - sixteen new @mcp scenarios of the install-time sweep and the load move in features/mcp-server/legacy-move.feature (LM1 to LM16), with the MCPMIG-01 comment above LM13
  - three new scenarios in features/mcp-server/verdict-list.feature (the MREC-03 @adapter-only/@builtin-only pair VL1/VL2 and the @mcp MREC-02 row VL3)
  - the Given "the mcp.json file of the {word} scope holds this text, as release 0.19.2 wrote it:" with the module-private helper mcpJsonText
  - the shared Given "the user has started a new pi session, which warned"
  - test/integration/mcp-legacy-sweep.test.ts deleted; mcp-migration, mcp-verdict-migration, and mcp-verdict-list trimmed to their internal cases under ITSCOPE-01 headers
affects: [phase-08-internal-cases]

actuals:
  tokens: 23887
  tasks: 3
  commits: 3
plan_head_before: 356f8bb7a96be0cf594cf37f9e98751914f09d5d
plan_head_after: 4628d2181c065a9d285b9f26e564f4466fa4b9c8

tech-stack:
  added: []
  patterns:
    - "A release 0.19.2 mcp.json Given that creates the scope root before writeScenarioFile, so it works in a scope with no .pi yet"
    - "A setup session Given that asserts every payload warns, for a setup load whose move warns"

key-files:
  created: []
  modified:
    - features/mcp-server/legacy-move.feature
    - features/mcp-server/verdict-list.feature
    - features/step_definitions/mcp-server/legacy-move.steps.ts
    - features/step_definitions/session.steps.ts
    - test/integration/mcp-migration.test.ts
    - test/integration/mcp-verdict-migration.test.ts
    - test/integration/mcp-verdict-list.test.ts
  deleted:
    - test/integration/mcp-legacy-sweep.test.ts

key-decisions:
  - "V2 under the adapter profile is the one recorded survivor: pi-mcp-adapter runs an sse server, so re-reading the plugin also lists VL3 as installed; V2 fails VL3 under the builtin profile"
  - "mcp-migration keeps only the refused write between the two writes of the move (fault injection, ITSCOPE-01); mcp-verdict-migration keeps its three released-build record cases; mcp-verdict-list keeps its stored-verdict and no-write cases for Phase 8"

patterns-established:
  - "The legacy move and the install sweep carry @mcp: they write mcp-adapter.json and mcp.json the same way under either implementation"

requirements-completed: [ITMIG-10]
---

# Phase 5 Plan 02: Legacy mcp.json Move and Sweep Scenarios Summary

Nineteen cucumber scenarios now cover the install-time sweep of a release 0.19.2 `mcp.json` (AMIG-02), the load move with its notices and AMIG-04 warnings, and the list rows of moved and trace-less legacy records (MREC-02, MREC-03). Each failed under a deliberate break under every profile its tags select, except the one recorded survivor. After that, `mcp-legacy-sweep.test.ts` was deleted and three other integration files were trimmed to their internal cases.

## Commits

| Task | Commit | Title | Files |
| --- | --- | --- | --- |
| 1 (tracer) | `3094a98` | test(mcp): cover an install that sweeps a legacy mcp.json entry | `legacy-move.steps.ts`, `legacy-move.feature`, `mcp-legacy-sweep.test.ts` |
| 2 | `a829ce4` | test(mcp): cover the legacy mcp.json move and its list rows | `legacy-move.feature`, `verdict-list.feature`, `session.steps.ts` |
| 3 | `4628d21` | test(mcp): keep only the internal move cases in integration | `mcp-legacy-sweep.test.ts` (deleted), `mcp-migration.test.ts`, `mcp-verdict-migration.test.ts`, `mcp-verdict-list.test.ts` |

## Red proofs

- Scratch folder: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase05-plan02` (`$D`). Every log and command script named below is kept there.
- Checkout root, the first line of every break log: `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-a927d7afbe8373d83`.
- Plan base (`$D/plan-base`): `356f8bb7a96be0cf594cf37f9e98751914f09d5d`. The precondition's `git diff --quiet 55cd91f HEAD -- <the eight files>` exited 0. I also confirmed every break site line below in `git show 55cd91f:<file>`.
- Inputs: `sha256sum -c --quiet SHA256SUMS` in `$I` exited 0. `sha256sum "$I/SHA256SUMS"` printed `a339ce02f316604955809d00c366680629b977fdbb06fc29ab2a7bc5ec058ba6`. I copied every `$I` file and checked it with `cmp`. I wrote nothing to `$I` and ran no file of `research-05/`, `planner-05/`, or `plan-05/work/`.
- Helper: `$D/break.sh`, copied from `$I/break.sh`. It is Phase 4's helper with two changes: the cucumber run passes `--parallel 1` instead of `--parallel 2`, and it runs under `flock -E 75 -w 3600 "$S/phase05-heavy.lock"`, so the three executors of the wave run one cucumber run at a time. These parts are the same as Phase 4: the `<id> <profile> <edits file> <cucumber args...>` arguments, the `[file, old, new]` triples (each old text must occur exactly once), the root from `git rev-parse --show-toplevel`, the refusal of a dirty `extensions/`, the `git checkout -- extensions/` EXIT trap, and the logged `root=`, diff, `exit=`, and `restored=` lines. `bash -n` and `node --check "$D/check-red.mjs"` passed. The driver for Task 3 is `$D/run-breaks.sh`, and its progress is in `$D/break-runs.txt`.
- Green runs: `green-1-adapter.log` `15 scenarios (15 passed)` and `green-1-builtin.log` `13 scenarios (13 passed)` (Task 1). `green-2-adapter.log` `32 scenarios (32 passed)` and `green-2-builtin.log` `30 scenarios (30 passed)` (Task 2). Every run exited 0.
- Every break command was `bash "$D/break.sh" <id> <profile> "$D/brk/<id>.json" features/mcp-server/legacy-move.feature features/mcp-server/verdict-list.feature`. Every log ends with `restored=clean` and holds no `function timed out`. `git status --porcelain -- extensions/` printed nothing after each run. No run needed a rerun. Task 3's runs used the committed tree of `a829ce4`. Unless a bullet says otherwise, a failure in a `the mcp configuration file ... holds this text:` step has the first error line `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`, and every other failure has `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`.
- `check-red.mjs` printed `RED-PROOFS OK` for the tracer tables (`red-tracer.log`) and for the main tables (`red.log`), both with `exit=0`.
- The research's L6 (`orchestrators/reconcile/load.ts:103`, the scope order) and L12 (`bridges/mcp/legacy.ts:351`) changed nothing that a scenario sees. L6b and L12b replace them (RESEARCH Pitfall 4). The research's L1 made installs throw during setup, so L1b and L1c replace it.

Scenario lines (final files): `legacy-move.feature` LM1 `:305`, LM2 `:372`, LM3 `:439`, LM4 `:504`, LM5 `:565`, LM6 `:583`, LM7 `:622`, LM8 `:642`, LM9 `:663`, LM10 `:721`, LM11 `:757`, LM12 `:820`, LM13 `:861`, LM14 `:918`, LM15 `:965`, LM16 `:999`; existing `:12` "A load moves a plugin's servers out of a release 0.19.2 mcp.json and keeps the user's own server", `:66` "A load moves only the plugin's marked servers ...", `:140` "A second load after the move reports nothing ...", `:193` "After the move, the next session offers the plugin's server tools under its new name", `:251` "A load moves a plugin's servers out of the project's mcp.json into the project's mcp-adapter.json". `verdict-list.feature` VL1 `:304`, VL2 `:333`, VL3 `:362`; existing `:43` and `:205`.

- **L2, tracer** (`L2-tracer-adapter.log`, `L2-tracer-builtin.log`, Task 1 tree with LM1 at `:301`): `bridges/mcp/legacy.ts:158`, `-  return !isFullDefinition(entry) || (panelCopies && Object.hasOwn(entry, "directTools"));` / `+  return false;`. Adapter `15 scenarios (14 passed, 1 failed)` and builtin `13 scenarios (12 passed, 1 failed)`, both `exit=1`. Each failed LM1 `:301` at `Then the command reports these results:`, because the `mcp-config-notices` row with `leftover-removed` was missing. No existing scenario failed.
- **L1b** (`bridges/mcp/stage.ts:863`, `-    legacy = await removeLegacy(prepared, written);` / `+    legacy = { removedNames: [], notices: [], written: [] };`). Adapter `32 scenarios (27 passed, 5 failed)` and builtin `30 scenarios (25 passed, 5 failed)`, both `exit=1`. Under both profiles: LM1, LM2, LM3, and LM9 failed at `Then the mcp configuration file "mcp.json" of the project scope holds this text:`, and LM4 at the same step for the user scope.
- **L1c** (`bridges/mcp/legacy.ts:379`, `+  return NOTHING_REMOVED;` as the first statement of `removeLegacyMcpEntries`). Adapter `32 scenarios (13 passed, 19 failed)` and builtin `30 scenarios (11 passed, 19 failed)`, both `exit=1`. Under both profiles:
  - LM1, LM2, LM3, LM9, and LM10 failed at `Then the mcp configuration file "mcp.json" of the project scope holds this text:`, and LM4 at the same step for the user scope.
  - LM5, LM6, LM11, LM12, LM13, LM14, and LM15 failed at `Then the session reports these results:`.
  - Existing `:12`, `:66`, and `:251` failed at `Then the session reports these results:`, and `:140` and `:193` at `Then the mcp configuration file "mcp.json" of the user scope holds this text:`. These are the three already-covered scenarios of the `must-fail` table, plus `:66` and `:193`.
  - VL1 (adapter) and VL2 (builtin) failed in their setup at `Given the user has started a new pi session, which warned`, with the first error line `AssertionError [ERR_ASSERTION]: Expected "actual" not to be strictly deep-equal to: []`. That failure is in a Given and is not a must-fail row.
- **L2** (the tracer edit). Adapter `32 scenarios (28 passed, 4 failed)` and builtin `30 scenarios (26 passed, 4 failed)`, both `exit=1`. Under both profiles: LM1 and LM2 failed at `Then the command reports these results:`, and LM14 and LM15 at `Then the session reports these results:`.
- **L3** (`legacy.ts:158`, the same line, now `+  return !isFullDefinition(entry);`). Adapter `32 scenarios (31 passed, 1 failed)` and builtin `30 scenarios (29 passed, 1 failed)`. Under both profiles, LM2 failed at `Then the command reports these results:`.
- **L4** (`legacy.ts:158`, `+  return true;`). Adapter `31 passed, 1 failed` and builtin `29 passed, 1 failed`. Under both profiles, LM3 failed at `Then the command reports these results:`.
- **L6b** (`shared/notification-resolve.ts:1043`, `-  const moved = rows.filter(isMovedRow).sort(compareMovedRows);` / `+  const moved = rows.filter(isMovedRow).sort((a, b) => -compareMovedRows(a, b));`). Adapter `31 passed, 1 failed` and builtin `29 passed, 1 failed`. Under both profiles, LM5 failed at `Then the session reports these results:`.
- **L7a** (`orchestrators/reconcile/mcp-migration.ts:262`, `+  if (!plannedInstall(input, owner) && process.env.NEVER_SET === "x") {`). Adapter `30 passed, 2 failed` and builtin `28 passed, 2 failed`. Under both profiles, LM7 and LM8 failed at `Then the session reports these results:`.
- **L7b** (`mcp-migration.ts:262`, `+  if (true) {`). Adapter `31 passed, 1 failed` and builtin `29 passed, 1 failed`. Under both profiles, LM9 failed at `Then the command reports these results:`.
- **L8** (`mcp-migration.ts:324`, `+  if (clone.cloneUnread() && process.env.NEVER_SET === "x") {`). Adapter `31 passed, 1 failed` and builtin `29 passed, 1 failed`. Under both profiles, LM16 failed at `Then the session reports these results:`.
- **L9** (`mcp-migration.ts:675`, `+  return dropped === undefined || true`). Adapter `30 passed, 2 failed` and builtin `28 passed, 2 failed`. Under both profiles, LM11 failed at `Then the session reports these results:`. VL1 (adapter) and VL2 (builtin) also failed in their setup at `Given the user has started a new pi session, which warned`. That failure is in a Given and is not a must-fail row.
- **L10** (`mcp-migration.ts:411-412`, `return { arm: "malformed", owner, record };` / `return { arm: "disabled", owner, record };`). Adapter `31 passed, 1 failed` and builtin `29 passed, 1 failed`. Under both profiles, LM12 failed at `Then the session reports these results:`.
- **L12b** (`notification-resolve.ts:1004`, `-    notice.kind === "leftover-removed" ||` removed). Adapter `30 passed, 2 failed` and builtin `28 passed, 2 failed`. Under both profiles, LM14 and LM15 failed at `Then the session reports these results:`.
- **L13** (`legacy.ts:299`, `-  return config === undefined ? [] : projectStubNames(cwd, config, owner);` / `+  return [];`). Adapter `31 passed, 1 failed` and builtin `29 passed, 1 failed`. Under both profiles, LM15 failed at `Then the session reports these results:`.
- **L14** (`domain/mcp-resolution.ts:140`, the line ``addDefect(merge, `malformed mcp server "${server}": ${detail}`);`` removed). Adapter `31 passed, 1 failed` and builtin `29 passed, 1 failed`. Under both profiles, LM12 failed at `Then the session reports these results:`.
- **L15** (`bridges/mcp/stage.ts:76`, `removeProjectDisableStubs` added to the `./legacy.ts` import; `stage.ts:804`, `removeLegacyMcpEntries` result kept, then `if (prepared.locations.scope === "user") { await removeProjectDisableStubs(process.cwd(), [prepared._legacy]); }`). Adapter `31 passed, 1 failed` and builtin `29 passed, 1 failed`. Under both profiles, LM4 failed at `Then the files of the project scope are unchanged`.
- **M2** (`domain/mcp-server-features.ts:443`, `+  if (Object.keys(server.toolPermissions ?? {}).length > 0 && process.env.NEVER_SET === "x") {`). Adapter `31 passed, 1 failed` and builtin `29 passed, 1 failed`. Under both profiles, LM6 failed at `Then the session reports these results:`.
- **V1** (adapter only; `mcp-migration.ts:569-570`, the first test of `applyNeutralVerdict` becomes `if (true) {`). `32 scenarios (31 passed, 1 failed)`, `exit=1`. VL1 failed at `Then the result lists these plugins:`.
- **V2, adapter: the recorded survivor** (`V2-adapter.log`; `orchestrators/plugin/mcp-verdict-read.ts:47`, `+  return process.env.NEVER_SET === "x" && record.compatibilityBasis === undefined &&`). `32 scenarios (32 passed)`, `exit=0`. pi-mcp-adapter runs an sse server, so re-reading the plugin also lists VL3 as installed. V2 fails VL3 under the builtin profile (next bullet). The `survivors` table records this row.
- **V2, builtin** (the same edit). `30 scenarios (29 passed, 1 failed)`, `exit=1`. VL3 failed at `Then the result lists these plugins:`.
- **V3b** (builtin only; `mcp-verdict-read.ts:69`, `effectiveMcpCompatibility(source.record, recorded, active)` / `effectiveMcpCompatibility(source.record, recorded, "adapter")`). `30 scenarios (27 passed, 3 failed)`, `exit=1`. VL2 failed at `Then the result lists these plugins:`. Two existing MREC-03 scenarios also failed: `verdict-list.feature:43` at `Then the result lists these plugins:` and `:205` at `Then the plugin completion set for "update --partial --scope project " contains these suggestions:`.

Unions: every new scenario has a must-fail proof under each profile its tags select, with one exception, VL3 under adapter, which is the survivor. LM1: L1b, L1c, L2. LM2: L1b, L1c, L2, L3. LM3: L1b, L1c, L4. LM4: L1b, L1c, L15. LM5: L6b, L1c. LM6: M2, L1c. LM7 and LM8: L7a. LM9: L7b, L1b, L1c. LM10: L1c. LM11: L9, L1c. LM12: L10, L14, L1c. LM13: L1c. LM14: L2, L12b, L1c. LM15: L2, L12b, L13, L1c. LM16: L8. VL1: V1. VL2: V3b. VL3: V2 (builtin).

## Case map

Lines at 55cd91f. The four files hold 25 `test(` cases at 55cd91f. The plan's count of 23 leaves out the two `mcp-verdict-list` cases that this plan never touches (`:57`, `:97`).

| Case at 55cd91f | Replaced by, or why it stays | Breaks | Commit |
| --- | --- | --- | --- |
| `mcp-legacy-sweep.test.ts:87` "AMIG-02: installing a plugin whose old entry is in mcp.json writes the new entry and removes the old entry and its leftovers" | LM1 (`legacy-move.feature:305`) | L1b, L1c, L2 | deleted in `3094a98` |
| `mcp-legacy-sweep.test.ts:116` "AMIG-01: a direct-tools copy under the old name is removed, and an unrelated marker-less server stays" | LM2 (`:372`) | L1b, L1c, L2, L3 | deleted in `4628d21` (file deleted) |
| `mcp-legacy-sweep.test.ts:143` "AMIG-01: a user's own full server under the old name stays and is not reported" | LM3 (`:439`) | L1b, L1c, L4 | deleted in `4628d21` |
| `mcp-legacy-sweep.test.ts:171` "AMIG-01: a user-scope install holds only the user-scope lock, so it leaves the project mcp-adapter.json unchanged" | LM4 (`:504`) | L1b, L1c, L15 | deleted in `4628d21` |
| `mcp-migration.test.ts:151` "AMIG-01: /reload moves an installed plugin's mcp.json entry into mcp-adapter.json under its Claude Code key" | already covered: `legacy-move.feature:12` and `:251` | L1c | deleted in `4628d21` |
| `mcp-migration.test.ts:185` "AMIG-01: after the move another /reload changes no bytes and sends no migration notice" | already covered: `legacy-move.feature:140` | L1c | deleted in `4628d21` |
| `mcp-migration.test.ts:201` "AMIG-03: one notice covers both scopes, project rows first" | LM5 (`:565`) | L6b, L1c | deleted in `4628d21` |
| `mcp-migration.test.ts:229` "AMIG-01: a migrated plugin whose server declares tool permission rules matches a fresh install and its notice warns that the rules are not enforced" | LM6 (`:583`) | M2, L1c | deleted in `4628d21` |
| `mcp-migration.test.ts:297` "AMIG-04: an mcp.json entry with no owning install record stays and the user is warned" | LM7 (`:622`) | L7a | deleted in `4628d21` |
| `mcp-migration.test.ts:314` "AMIG-04: a record in the user scope does not own a project mcp.json entry" | LM8 (`:642`) | L7a | deleted in `4628d21` |
| `mcp-migration.test.ts:337` "AMIG-04: when claude-plugins.json declares the owner, the reload installs it and sweeps the old entry without an unowned warning" | LM9 (`:663`) | L7b, L1b, L1c | deleted in `4628d21` |
| `mcp-migration.test.ts:448` "AMIG-01: a git plugin left in place on a cold clone cache moves once its recorded clone exists" | LM16 (`:999`, the cold half) and the warm-clone load scenario added in review (`bae58b4`, `legacy-move.feature:897` after the review fixes); LM10 (`:721`) covers the reinstall the notice names | L8, L1c; review C2a, C2b, C2c (05-REVIEW-FIX.md) | deleted in `4628d21` |
| `mcp-migration.test.ts:509` "AMIG-01: /reload removes an undeclared server, drops an unsupported one and moves the rest" | LM11 (`:757`) | L9, L1c | deleted in `4628d21` |
| `mcp-migration.test.ts:580` "AMIG-01: a plugin whose MCP config is malformed has all its old entries removed and none written" | LM12 (`:820`); its fresh-install refusal is `invalid-configs.feature:69` | L10, L14, L1c | deleted in `4628d21` |
| `mcp-migration.test.ts:640` "AMIG-01: /reload skips a malformed server in .mcp.json, moves its valid sibling, and removes the skipped one's old entry (D-CF6-02)" | LM13 (`:861`), under the MCPMIG-01 comment | L1c | deleted in `4628d21` |
| `mcp-migration.test.ts:682` "AMIG-03: an old-name disable stub removed during the move is listed and makes the notice a warning" | LM14 (`:918`) | L2, L12b, L1c | deleted in `4628d21` |
| `mcp-migration.test.ts:713` "AMIG-01: the reload move of a user-scope plugin removes its old-name disable stub from the project mcp-adapter.json" | LM15 (`:965`) | L2, L12b, L13, L1c | deleted in `4628d21` |
| `mcp-migration.test.ts:749` "AMIG-02: a filesystem refusal between the two writes loses no server and the next reload finishes the move" | kept, internal (ITSCOPE-01): fault injection; the harness cannot refuse that one write | - | kept in `4628d21` |
| `mcp-verdict-migration.test.ts:117` "D-P3-16: a load leaves a server only Pi's built-in MCP runs out of mcp-adapter.json and keeps the record installable with the neutral basis" | kept, internal (ITSCOPE-01): record fields the move writes | - | kept in `4628d21` |
| `mcp-verdict-migration.test.ts:149` "D-P3-16: a load writes a record whose ws server no implementation runs as partially installed with the neutral basis" | kept, internal (ITSCOPE-01) | - | kept in `4628d21` |
| `mcp-verdict-migration.test.ts:210` "MREC-03 / D-P3-16: a moved legacy plugin whose only server pi-mcp-adapter blocks lists as partially installed under the adapter" | VL1 (`verdict-list.feature:304`, adapter) and VL2 (`:333`, built-in) | V1, V3b | deleted in `4628d21` |
| `mcp-verdict-migration.test.ts:250` "MREC-02 / D-P3-16: a legacy plugin whose catalog moved before the load keeps its stored verdict and lists no newer server's verdict" | kept, internal (ITSCOPE-01) | - | kept in `4628d21` |
| `mcp-verdict-list.test.ts:57` "D-P3-01 / D-P3-02: an install stores the neutral verdict and its basis" | kept for Phase 8: the stored verdict | - | kept in `4628d21` |
| `mcp-verdict-list.test.ts:97` "MREC-03 / D-P3-04: list shows one sse install per implementation and writes nothing" | kept for Phase 8: the list that writes nothing | - | kept in `4628d21` |
| `mcp-verdict-list.test.ts:139` "MREC-02: a legacy record with no MCP trace reads as no servers and re-resolves nothing" | VL3 (`:362`) | V2 (builtin; the adapter run is the survivor) | deleted in `4628d21` |

25 cases: 19 deleted, 6 kept.

## Checks

`node --version`: `v24.22.3`. Every npm script ran with the prefix `npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. Every cucumber run, the lint warm-up, every `check:static`, the audit, and every commit ran under `flock -w 3600 "$S/phase05-heavy.lock"`. The worktree's shell guard refused each command that runs `git` inside `$(...)` or a compound `git` line. Those commands ran unchanged as scripts under `$D`: `verify-t1-red.sh`, `verify-t3-red.sh`, `verify-t3-audit.sh`, `verify-files.sh` (with the expected file list as its argument), and `commit.sh`.

| Command (log or script) | Tree | Exit | Result |
| --- | --- | --- | --- |
| precondition (`nondac-sh` executable, `SHA256SUMS`, its hash, `node_modules/.package-lock.json`, `git diff --quiet 55cd91f HEAD -- <8 files>`) | `356f8bb` | 0 | all met |
| tracer `cmp` of the three files | Task 1 working tree | 0 | |
| green adapter (`green-1-adapter.log`) | Task 1 working tree | 0 | `15 scenarios (15 passed)` |
| green builtin (`green-1-builtin.log`) | Task 1 working tree | 0 | `13 scenarios (13 passed)` |
| tracer red check (`verify-t1-red.sh`, `red-tracer.log`) | Task 1 working tree | 0 | `RED-PROOFS OK` |
| integration sweep (`int-1.log`) | Task 1 working tree | 0 | `tests 3`, `pass 3`, `fail 0` |
| `npm run lint` warm-up (`lint-warm.log`) | Task 1 working tree | 0 | |
| `check:static` (`check-static-1.log`) | Task 1 working tree | 0 | all seven steps passed |
| changed files (`verify-files.sh`) | `3094a98` | 0 | the three files; no `-` line in `legacy-move.feature` |
| final `cmp` of the four files | Task 2 working tree | 0 | |
| green adapter (`green-2-adapter.log`) | Task 2 working tree | 0 | `32 scenarios (32 passed)` |
| green builtin (`green-2-builtin.log`) | Task 2 working tree | 0 | `30 scenarios (30 passed)` |
| `check:static` (`check-static-2.log`) | Task 2 working tree | 0 | all seven steps passed |
| acceptance counts | `a829ce4` | 0 | `legacy-move.feature` 22 scenarios, 22 `@mcp`, 1 MCPMIG-01 comment; `verdict-list.feature` 15 scenarios, 5 `@adapter-only`, 5 `@builtin-only`; S2 1; `example.test` 0 in each file |
| changed files (`verify-files.sh`) | `a829ce4` | 0 | the five files |
| 36 break runs (`run-breaks.sh`, `break-runs.txt`) | `a829ce4` | 0 | every `restored=clean`, `extensions-after=[]` |
| red check (`verify-t3-red.sh`, `red.log`) | `a829ce4` logs | 0 | `RED-PROOFS OK` |
| deletion and trim `cmp` | Task 3 working tree | 0 | |
| `mcp-migration` through `nondac-sh` (`int-migration.log`) | Task 3 working tree | 0 | `tests 1`, `pass 1`, `fail 0` |
| `mcp-verdict-migration` (`int-verdict-migration.log`) | Task 3 working tree | 0 | `tests 3`, `pass 3`, `fail 0` |
| `mcp-verdict-list` (`int-verdict-list.log`) | Task 3 working tree | 0 | `tests 2`, `pass 2`, `fail 0` |
| `check:static` (`check-static-3.log`) | Task 3 working tree | 0 | all seven steps passed |
| acceptance counts | `4628d21` | 0 | `^test(` 1, 3, 2; the fault-injection title 1; `ITSCOPE-01` at least 1 in each file; the three dropped helpers 0; `adapterProxyTool` 0; `saveState` 0 |
| `fallow audit --base <plan base>` (`verify-t3-audit.sh`, `audit.json`) | `4628d21` | 0 | `verdict=warn`; `dead_code_issues` 0, `complexity_findings` 0, `duplication_clone_groups` 0; risks only `weakened-tests` on the four integration files |
| final changed files (`verify-files.sh`) | `4628d21` | 0 | the seven files of `files_modified` and the one of `files_deleted`; nothing under `extensions/`; `extensions/ features/ test/` clean |

The commit hook ran all three times. It ran `npm run check:commit` and it passed, then the second hook stage skipped it, and gitlint and every fixer passed. No fixer changed a file. The wave's post-merge `npm run check` is the full verdict.

## Issues for the milestone

- `fallow audit --base 356f8bb` gives `verdict=warn` with four `weakened-tests` findings: `test/integration/mcp-legacy-sweep.test.ts` (deleted), `test/integration/mcp-migration.test.ts`, `test/integration/mcp-verdict-list.test.ts`, and `test/integration/mcp-verdict-migration.test.ts` (trimmed). It finds nothing else. User decision 2026-11-21: no `.fallowrc.json` or CI change, so this is left to the milestone.
- The V2 adapter survivor: under pi-mcp-adapter an sse server runs, so a record re-read from its plugin also lists VL3 as `installed`. Only the builtin profile proves the MREC-02 row (V2 fails VL3 there).

## Deviations from Plan

None to the plan's tasks: every copy matched its frozen input, every run passed or failed as the tables expect, and no scenario needed strengthening.

Process notes:

- The shell guard refused to write the per-plan commit ledger under `.git/worktrees/...` (protocol 0c), so `plan_head_before` comes from `$D/plan-base`, which holds the same base (`356f8bb`). `commits: 3` is measured with `git log --oneline 356f8bb..HEAD`.
- L1c and L9 also failed VL1 and VL2 in their setup Given `the user has started a new pi session, which warned`. Both breaks change what the setup load reports. These are extra failures outside the must-fail tables, and the checker accepted them.
- V3b also failed two existing MREC-03 scenarios, `verdict-list.feature:43` and `:205`.

## Parent lines

- `.planning/BACKLOG.md`, MCPMIG-01: replace the clause "also changes `test/integration/mcp-migration.test.ts` (the commented expected line)" with "also changes the LM13 scenario of `features/mcp-server/legacy-move.feature` ("A load skips a malformed server, moves its valid sibling, and removes the skipped server's old entry"), whose comment names MCPMIG-01".
- `CHANGELOG.md`: None.
- Key Decisions table: None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

All seven modified files and this SUMMARY exist, `test/integration/mcp-legacy-sweep.test.ts` is gone, and `3094a98`, `a829ce4`, and `4628d21` are ancestors of HEAD.
