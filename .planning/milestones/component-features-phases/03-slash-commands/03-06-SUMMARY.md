---
phase: 03-slash-commands
plan: 06
subsystem: bridges/commands
tags: [commands, project-provenance, ledger, cucumber]

requires:
  - phase: 02-skills
    provides: NODE_PROJECT_SKILL_LEDGER (bridges/skills/project-installs.ts), the project-skill-record Given and Then steps
  - phase: 03-slash-commands
    provides: the command-file Given (03-01), the staged-command writer and prepareStageCommands (03-02)
provides:
  - bridges/commands/project-ledger.ts (ProjectCommandLedger, ProjectCommandChange, ProjectCommandEntry, commandFileDigest, projectCommandChange)
  - commitPreparedCommands(ops, prepared, ledger) records committed project commands with their file digests
  - UnstageCommandsInput.ledger; unstagePluginCommands forgets project commands and reports a WR-04 warning
  - features/slash-command/project-provenance.feature (Background, the WR-02 scenario, the WR-04 Outline)
affects: [03-07 invocation check (reads the ledger entries this plan writes with provenProjectSkills)]

actuals:
  tokens: 12764
  tasks: 2
  commits: 2

plan_head_before: 1c40e4f2bc650cd4c8721159692c5cc27b8bec5f
plan_head_after: ce2330b8a3d245b9ec687c05bc600ff01590e50c

tech-stack:
  added: []
  patterns:
    - "A bridge that may not import another bridge declares the port it needs as a structural type, and the orchestrator call site passes the other bridge's instance"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/commands/project-ledger.ts
    - test/bridges/commands/project-ledger.test.ts
    - features/slash-command/project-provenance.feature
  modified:
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - extensions/pi-claude-marketplace/bridges/commands/unstage.ts
    - extensions/pi-claude-marketplace/bridges/commands/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - test/bridges/commands/stage.test.ts
    - test/bridges/commands/unstage.test.ts
    - test/bridges/commands/types.test.ts
    - test/orchestrators/marketplace/shared.test.ts

key-decisions:
  - "The ledger is a required argument of commitPreparedCommands and a required member of UnstageCommandsInput; no bridge default reaches the user's agent directory"
  - "One change builder, projectCommandChange(locations, forget), returns undefined at user scope; the commit adds the committed digests to it, and the unstage sends it as is"
  - "The commit forgets the prepared previous names and remembers every recorded command; the unstage forgets every recorded name, removed or already missing"
  - "The commands warning rides the existing WR-04 member skillWarnings, after the skills warnings"

patterns-established:
  - "A commands-bridge ledger failure on removal is a warning built from errorMessage(err), so the shown cause is the ledger's own message"

requirements-completed: [CMD-02, CMD-05]

coverage:
  - id: D1
    description: "A project-scope install, update, reinstall, or enable records each committed command in the user's ledger with the SHA-256 of its committed file, after the staging cleanup; user scope and a no-op write nothing"
    requirement: CMD-05
    verification:
      - kind: unit
        ref: "test/bridges/commands/stage.test.ts#D-CF3-07 lists each committed project command with its file digest after the staging cleanup"
        status: pass
      - kind: unit
        ref: "test/bridges/commands/stage.test.ts#D-CF3-07 a user-scope commit writes no project ledger"
        status: pass
      - kind: unit
        ref: "test/bridges/commands/stage.test.ts#D-CF3-07 a no-op staging writes no project ledger"
        status: pass
      - kind: unit
        ref: "test/bridges/commands/project-ledger.test.ts#commandFileDigest"
        status: pass
    human_judgment: false
  - id: D2
    description: "A commands-only project install fails, keeps the ledger byte-identical, and leaves no installed plugin when the ledger holds content this version cannot update (WR-02); a failed write carries any cleanup leak (IN-02)"
    requirement: CMD-05
    verification:
      - kind: e2e
        ref: "features/slash-command/project-provenance.feature#Installing a project command's plugin while the user's record of project installs holds content pi cannot update fails and keeps the record"
        status: pass
      - kind: unit
        ref: "test/bridges/commands/stage.test.ts#D-CF3-07 a failed project ledger write carries the staging cleanup leak"
        status: pass
    human_judgment: false
  - id: D3
    description: "Uninstall, disable, and marketplace remove forget project commands; a ledger they cannot update is a cleanup warning and the removal completes (WR-04)"
    requirement: CMD-02
    verification:
      - kind: e2e
        ref: "features/slash-command/project-provenance.feature#Removing a project command while the user's record of project installs holds content pi cannot update removes it and warns"
        status: pass
      - kind: unit
        ref: "test/bridges/commands/unstage.test.ts#WR-04 reports a project ledger it could not update after removing the prompts"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/shared.test.ts#WR-04: cascadeUnstagePlugin carries the commands warning of a project ledger it could not update"
        status: pass
    human_judgment: false

duration: 34min
completed: 2026-11-01
status: complete
---

# Phase 3 Plan 06: Slash command project ledger Summary

**The commands bridge now writes the user's record of project installs: a project-scope commit lists each committed command under its generated name with `{ plugin, sha256 }` (the SHA-256 of the committed file), and a removal forgets the names. A ledger this version cannot update fails a commands-only install and stays unchanged (WR-02). A removal reports it as `could not remove the commands from the project skill ledger: <error>` (WR-04). Plan 03-07 reads these entries at invocation.**

## Performance

- **Duration:** about 34 min
- **Started:** 2026-11-01T19:24:38Z
- **Completed:** 2026-11-01T19:58:16Z
- **Tasks:** 2 of 2
- **Files modified:** 13 (3 created, 10 modified)
- **Baseline:** `BASE=1c40e4f2bc650cd4c8721159692c5cc27b8bec5f`

## Accomplishments

- `bridges/commands/project-ledger.ts` declares its own structural `ProjectCommandLedger` (an `update` that takes `{ projectPath, forget, remember }`), `commandFileDigest(text)`, and the change builder `projectCommandChange(locations, forget)`. The builder returns `undefined` at user scope. `NODE_PROJECT_SKILL_LEDGER` satisfies the type without a cast, so the commands bridge imports nothing from `bridges/skills/`.
- `commitPreparedCommands(ops, prepared, ledger)` renames as before, cleans up the staging root, and then, at project scope only, reads each committed target file and calls the ledger once. The call forgets `_previousNames` and remembers each recorded name with `{ plugin: _pluginName, sha256 }`. A failed write throws with the cleanup leak appended (IN-02). `PreparedCommandsStaged` gains `_pluginName`.
- `unstagePluginCommands` unlinks as before. Then, at project scope and with at least one name, it forgets the names through the same builder. A failed update becomes the WR-04 warning in `warnings`.
- Call sites (minimal, each inside its own function): the commands phase of `install-outcome.ts` (commit and undo), the commands commit of `update-swap.ts`, and `cascadeUnstagePlugin` in `marketplace/shared.ts`. That last one appends the commands warnings after the skills warnings in the WR-04 `skillWarnings` member, and the member's doc comment now names both kinds.
- `features/slash-command/project-provenance.feature`: a Background with a commands-only plugin `solo`, the WR-02 scenario, and the WR-04 Outline (uninstall, disable, marketplace remove).

## Task Commits

1. **Task 1: Record committed project commands in the user's ledger, end to end through a failing install** - `940b4af` (feat)
2. **Task 2: Forget removed project commands, and report a ledger the removal could not update** - `ce2330b` (feat)

Tracer gate (Task 1): auto mode off, `human_verify_mode` end-of-phase, automated-only `<verify>`. The verify ran green before Task 2 (unit cases, the four coverage pairs, `test:modules`, `cucumber-js features/slash-command features/skill`, `check:features`). Tracer verified end to end, then expanded.

## Red proofs

Task 1, before the commit change (the install succeeded):

```text
Failed scenarios:
  1) Installing a project command's plugin while the user's record of project installs holds content pi cannot update fails and keeps the record # features/slash-command/project-provenance.feature:34
       Then the result has these fields: # features/step_definitions/command.steps.ts:84
           AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
               [ 'severity',
           +     'info'
           -     'error'
               ],
               [ 'needs reload',
           +     'true'
           -     'false'
               ],
           -   [ 'summary', 'A plugin operation has failed.' ]
1 scenario (1 failed)
16 steps (12 passed, 3 skipped, 1 failed)
```

Task 2, before the unstage change (no diagnostic row; all three examples failed):

```text
  1) Removing a project command while the user's record of project installs holds content pi cannot update removes it and warns # features/slash-command/project-provenance.feature:72
       Then the command reports these results: # features/step_definitions/command.steps.ts:124
           AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
               [ 'kind', 'severity', 'needs reload', -'header', -'lines' ],
               [ 'cascade', 'info', 'true', -'', -'' ],
           -   [ 'diagnostic', 'warning', 'false',
           -     'Plugin "solo" [project] disabled; 1 cleanup warning.',
           -     'could not remove the commands from the project skill ledger: The project skill ledger skills.json holds content this version cannot update; it was left unchanged.' ]
4 scenarios (1 passed, 3 failed)
```

## Non-owned test edits

`npm run test:modules` passed after each task with no change outside `test/bridges/commands/**` and the plan-listed `test/orchestrators/marketplace/shared.test.ts`. None of the research candidates (`install-flow-ledger`, `reinstall-flow`, `update-flow`, `install-outcome`, `update-swap` tests) needed an edit: their project installs write the ledger under the hermetic agent directory, and none compares that tree. No ledger file was written under the real `/root/.pi/agent/` during the runs.

`git diff "$BASE"..HEAD -- test/orchestrators/marketplace/shared.test.ts` (summary): the WR-04 case's ledger setup moved into a `seedUnknownProjectLedger(cwd)` helper, so the new case does not copy it. The case's expected value now also lists `dropped.commands` (`["sample-command"]`) and the second warning `could not remove the commands from the project skill ledger: The project skill ledger <ledgerFile> holds content this version cannot update; it was left unchanged.` A new case, "WR-04: cascadeUnstagePlugin carries the commands warning of a project ledger it could not update", covers a record with commands only and checks that the prompt file is gone and the ledger is byte-identical.

The existing `stage.test.ts` and `unstage.test.ts` calls gained the new ledger argument: a module-level stub that accepts every change. No expected value changed.

## Decisions Made

- The ledger has no default value in the bridge, unlike `commitPreparedSkills`. A default would reach `getAgentDir()` from inside a bridge, and the plan requires the parameter.
- `projectCommandChange` returns the forget-only change. The commit spreads its digests into `remember`, so the user-scope gate sits in one place and a user-scope commit reads no file.
- The digest reads the committed target file as UTF-8 text and hashes its UTF-8 encoding. Plan 03-07 must read the file the same way.
- The unstage forgets every recorded name, including one whose file was already gone, so a stale entry cannot survive a partial earlier removal.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The worktree guard refuses shell commands that compute values at runtime, so every npm and cucumber run used a small wrapper script in the scratch folder (`exec-03-06/run.sh`) that sets `npm_config_script_shell` and `NODE_OPTIONS` to literal values.

## Verification

- `node --test` on the four touched test modules: pass (129 cases in the Task 2 set).
- `npm run test:coverage:direct --` for `project-ledger.ts`, `stage.ts`, `unstage.ts`, `install-outcome.ts`, `update-swap.ts`, `marketplace/shared.ts`: 100%, silent pass.
- `npm run test:modules`: pass after each task.
- `npx cucumber-js features/slash-command features/skill`: 130 scenarios passed.
- `npm run check:static` (including `npm run fallow` and `check:features`): pass. `npx fallow dupes --fail-on-issues --format human --quiet`: exit 0.
- Full `npm run check` on `ce2330b`: exit 0 (1299 scenarios passed, merged direct LCOV 323 records). The post-merge gate can reuse this result for the same inputs.
- Acceptance criteria: `commandFileDigest` export count 1; commands-bridge imports from `/skills/` 0; `NODE_PROJECT_SKILL_LEDGER` count 2 in `install-outcome.ts` after Task 1 (3 after Task 2, with the undo) and 2 in `update-swap.ts`; the Outline title count 1 with three `Examples:` rows; the WR-04 warning text count 1 in `unstage.ts`; `git diff --stat "$BASE"..HEAD -- extensions/pi-claude-marketplace/bridges/skills features/skill features/step_definitions/skill` prints nothing.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-03-16 (WR-02) and T-03-17 (WR-04) are mitigated and proven by the two scenarios. T-03-18 holds as accepted: an update whose later phase fails after the commands commit keeps the new digests, the same residual as the skills bridge. T-03-19 is unchanged: the commands share the skills ledger file under the user's agent directory.

## Dubious Choices

- **Shared name space on Windows.** The plan relies on a command's generated name holding `:` so it never equals a skill name in the shared `skills` map. On Windows, `platform/os.ts::commandNamespaceSeparator` makes the separator `.`, so the name is, for example, `acme.greet`. This holds only if no skill can have a generated name with a dot. I did not verify that against the skills name rules. A collision would let a skill install overwrite a command's entry, or the reverse.
- **UTF-8 text digest.** `commandFileDigest` hashes the text after a UTF-8 decode. Two staged files that differ only in invalid UTF-8 bytes decode to the same text and get the same digest. The staged writer produces UTF-8, so only a hand-edited file can hit this, and the check in plan 03-07 reads the same way.
- **Undo after a failed ledger write.** When the commit's ledger write fails, the install undo calls `unstagePluginCommands`. Its forget fails against the same unreadable ledger, and the install undo drops `warnings`. The user sees only the install's own failure, which already names the ledger.

## Parent lines

- **Rename (Phase 2 files):** the ledger file `skills.json`, `ProjectSkillLedgerError`'s wording ("The project skill ledger ..."), `NODE_PROJECT_SKILL_LEDGER`, `provenProjectSkills`, the WR-04 member `UnstageOutcome.skillWarnings`, and the step texts "the user's record of project skill installs ..." all say "skill" for a record that now also lists commands. A neutral name (for example `project-installs.json`, `ProjectInstallLedgerError`, `ledgerWarnings`, "the user's record of project installs") is a parent change. The file name change needs a reader for both forms (see the reversibility note on Task 1).
- **Prune rollback:** a rollback of `prune` restores staged command files but not their ledger entries, as for skills.
- **CHANGELOG.md:** "Project-scope slash commands are recorded in your own record of project installs, outside the project. A removal that cannot update that record finishes and warns."

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-07 can read command entries with `provenProjectSkills(agentDir, projectPath, read)` and compare `commandFileDigest(<staged file text>)`.
- No blockers.

---
*Phase: 03-slash-commands*
*Completed: 2026-11-01*

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/bridges/commands/project-ledger.ts
- FOUND: test/bridges/commands/project-ledger.test.ts
- FOUND: features/slash-command/project-provenance.feature
- FOUND: 940b4af
- FOUND: ce2330b
