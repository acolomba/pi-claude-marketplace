---
phase: 03-slash-commands
plan: 07
subsystem: orchestrators/command-invocation
tags: [commands, project-provenance, ledger, invocation, cucumber]
requires:
  - phase: 02-skills
    provides: provenProjectSkills (bridges/skills/project-installs.ts), the "records no plugin install for the project" Given
  - phase: 03-slash-commands
    provides: invokeStagedCommand (03-03), commandFileDigest and the project-scope ledger writer (03-06)
provides:
  - "invokeStagedCommand refuses a project command that the user's ledger does not list with the SHA-256 of the file as read (D-CF3-07)"
  - "CommandInvocationDependencies.loadState and the exported CommandOwnerState type"
  - "The Given `the line {string} was appended to the staged project command {string}`"
  - "Seven invocation scenarios in features/slash-command/project-provenance.feature"
affects: [03-08, 03-09, phase verification of CMD-02]
actuals:
  tokens: 5035
  tasks: 2
  commits: 2
plan_head_before: f7fcf84bde8abb17f6f642480ca9836e2327dce5
plan_head_after: c1b90cecd2c8540969b95c6847be93e0a6efab98
tech-stack:
  added: []
  patterns:
    - "One read of the staged file feeds both the provenance digest and the fill, so the check and the run see the same text"
key-files:
  created:
    - features/step_definitions/slash-command/project-provenance.steps.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/command-invocation.ts
    - test/orchestrators/command-invocation.test.ts
    - features/slash-command/project-provenance.feature
key-decisions:
  - "The check runs in the order find, trust, read and parse, ledger, fill. A file that cannot be read or parsed gets the existing `Cannot read` refusal, not the ledger message"
  - "The state is read only to word the refusal, never on the path that runs the command. The default reader is loadState(root, { persistMigration: false })"
  - "The abort names `reinstall`, following D-CF2-13's current shape, because `install` refuses a plugin the project state already records (plan's flagged assumption)"
requirements-completed: [CMD-02]
coverage:
  - id: D1
    description: "A project command whose name the user's ledger does not list, or lists with another digest, refuses with the D-CF3-07 message and runs no context command; the reinstall names the owning plugin, or every project plugin when no record lists it or the state cannot be read"
    requirement: CMD-02
    verification:
      - kind: e2e
        ref: "features/slash-command/project-provenance.feature#A project command whose install the user's pi directory does not record runs no context command"
        status: pass
      - kind: e2e
        ref: "features/slash-command/project-provenance.feature#A project command whose staged file changed after the install runs no context command"
        status: pass
      - kind: unit
        ref: "test/orchestrators/command-invocation.test.ts#D-CF3-07: refuses a project command without running its context command when ..."
        status: pass
      - kind: unit
        ref: "test/orchestrators/command-invocation.test.ts#D-CF3-07: names every project plugin in the reinstall when ..."
        status: pass
    human_judgment: false
  - id: D2
    description: "The digest and the fill use the same text, read once (T-03-22)"
    requirement: CMD-02
    verification:
      - kind: unit
        ref: "test/orchestrators/command-invocation.test.ts#T-03-22: fills the very text whose digest the ledger lists, read once"
        status: pass
    human_judgment: false
  - id: D3
    description: "A project command runs after an install, after the reinstall the abort names, after an update that changes its body, and after a disable and an enable; a user-scope command needs no record"
    requirement: CMD-02
    verification:
      - kind: e2e
        ref: "features/slash-command/project-provenance.feature#A project command the user installed into the project runs its context command"
        status: pass
      - kind: e2e
        ref: "features/slash-command/project-provenance.feature#A project command whose install the user's pi directory does not record runs its context command after the reinstall the abort names"
        status: pass
      - kind: e2e
        ref: "features/slash-command/project-provenance.feature#A project command runs its new context command after its plugin is updated"
        status: pass
      - kind: e2e
        ref: "features/slash-command/project-provenance.feature#A project command runs its context command after its plugin is disabled and enabled"
        status: pass
      - kind: e2e
        ref: "features/slash-command/project-provenance.feature#A user-scope command runs its context command with no record of project installs"
        status: pass
      - kind: unit
        ref: "test/orchestrators/command-invocation.test.ts#D-CF3-07: runs a user command without reading the user's ledger or the state"
        status: pass
    human_judgment: false
duration: 17min
completed: 2026-11-01
status: complete
---

# Phase 3 Plan 07: Slash command project provenance check Summary

**`invokeStagedCommand` now runs a project-scope command only when Pi trusts the project and the user's ledger of project installs lists the command's generated name with `commandFileDigest` of the text it just read. Otherwise it refuses with `The command <typed> was not installed into the project <cwd> on this machine, or its file changed after the install. Reinstall its plugin into this project with <command>, then run /reload to use it.` The `<command>` is `/claude:plugin reinstall <plugin>@<marketplace> --scope project` for the plugin whose project record lists the command in `resources.prompts`. When no record lists it, or the state cannot be read, it is `/claude:plugin reinstall --scope project`.**

## Performance

- **Duration:** about 17 min
- **Started:** 2026-11-01T20:07:03Z
- **Completed:** 2026-11-01T20:24:00Z
- **Tasks:** 2 of 2
- **Files modified:** 4 (1 created, 3 modified)
- **Baseline:** `BASE=f7fcf84bde8abb17f6f642480ca9836e2327dce5`

## Accomplishments

- `orchestrators/command-invocation.ts`: the one read now keeps the text next to the parsed file (`ReadCommand`). The new `unprovenRefusal` returns early for a user command. For a project command, it compares `provenProjectSkills(agentDir, cwd, readFile).get(name)` with `commandFileDigest(text)`. `projectReinstallCommand` walks the project state with nested loops to find the plugin that owns the command. Both have their own names and structure, not the skills module's `isInstalledHere`, `reinstallCommand`, or `notInstalledHereMessage`. `npx fallow dupes` reports no clone.
- `CommandInvocationDependencies` gains `loadState` (default `loadState(root, { persistMigration: false })`), typed by the new exported structural `CommandOwnerState`.
- Unit cases: five ledger shapes that refuse (missing, another project, name not listed, another digest, not JSON), each checking the state read path. There are also two generic-reinstall cases, a trust-before-ledger case, a user command that reads only its own file, the T-03-22 single-read case, and the default dependencies refusing a project command in a hermetic project. Direct coverage of the pair is 100%.
- The feature has seven new scenarios: the unrecorded abort, the changed-file abort, and five runnable pins (install, reinstall, update, disable plus enable, user scope).

## Task Commits

1. **Task 1: Abort a project command the user's ledger does not list, end to end** - `fb21ef2` (feat)
2. **Task 2: Abort a changed staged command, and pin the paths that keep a project command runnable** - `c1b90ce` (test)

Tracer gate (Task 1): automated-only `<verify>`, `human_verify_mode` end-of-phase. The verify ran green before Task 2: the unit file (38 pass), direct coverage of the pair, `cucumber-js features/slash-command/project-provenance.feature` (6 scenarios), and `check:features`, plus `check:static`. The tracer was verified end to end, then expanded.

## Red proofs

Task 1, scenario "A project command whose install the user's pi directory does not record runs no context command", before the product change (the command was sent to the model):

```text
Failed scenarios:
  1) A project command whose install the user's pi directory does not record runs no context command # features/slash-command/project-provenance.feature:34
       When the user runs "/solo:status" # features/step_definitions/command.steps.ts:77
           AssertionError [ERR_ASSERTION]: /solo:status
           + actual - expected
             {
           +   disposition: 'started'
           -   disposition: 'handled'
             }
2 scenarios (1 passed, 1 failed)
```

Task 2, scenario "A project command whose staged file changed after the install runs no context command". The scenario was added after Task 1's check was committed, so the red run used a temporary edit that checks only the name (`recorded.has(request.name) || ...`). That edit stands for "no digest check". It was reverted with `git checkout -- <file>`:

```text
  1) A project command whose staged file changed after the install runs no context command # features/slash-command/project-provenance.feature:55
       When the user runs "/solo:status" # features/step_definitions/command.steps.ts:77
           AssertionError [ERR_ASSERTION]: /solo:status
           +   disposition: 'started'
           -   disposition: 'handled'
1 scenario (1 failed)
```

## Negative edits (pins of existing behavior), each reverted

1. **Recorded install runs** (Task 1 pin, line 45). Edit: the check always refuses (`=== \`never${commandFileDigest(text)}\``). Output: `Then the model receives these calls` failed; expected row `1 | user | Status: ran`, actual no call; `1 scenario (1 failed)`.
2. **Reinstall and update** (lines 66 and 78). Edit: the commands commit in `orchestrators/plugin/update-swap.ts` (the call site that `reinstall` and `update` share through the update runner) passed a no-op ledger `{ update: async () => {} }`. Output: both failed at `Then the model receives these calls`, with expected `Status: updated` and `Status: ran`, and no call; `2 scenarios (2 failed)`.
3. **Disable and enable** (line 109). Edit: the commands commit in `orchestrators/plugin/install-outcome.ts` forwarded only its first ledger call, so the Background install was still recorded and the enable was not. Output: `Then the model receives these calls` failed, expected `Status: ran`, no call; `1 scenario (1 failed)`. A control run of the line-45 pin under the same edit passed, which shows that the edit hit the enable only.
4. **User scope** (line 121). Edit: `unprovenRefusal` applied the check at user scope (`command.scope === "never"`). Output: `Then the model receives these calls` failed, expected `Status: ran`, no call; `1 scenario (1 failed)`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/command-invocation.ts` - the D-CF3-07 ledger check, the `loadState` dependency, and the reinstall command of the abort
- `test/orchestrators/command-invocation.test.ts` - ledger and state fakes (`WORK_LEDGER`, `projectLedger`, `installedLedger`, `ownerState`, `recordingReads`); the existing project cases now get, by default, the ledger the install of their file would write
- `features/slash-command/project-provenance.feature` - seven invocation scenarios
- `features/step_definitions/slash-command/project-provenance.steps.ts` - the append Given

## Non-owned test edits

None. The only test edits are in the plan-listed `test/orchestrators/command-invocation.test.ts`. `git diff "$BASE"..HEAD --stat` lists only the four plan files.

## Decisions Made

See `key-decisions`. In short: the check order matches the skills side's contract (find, trust, read and parse, ledger, fill). The state is read only when a refusal is worded. The message uses `reinstall`, as D-CF2-13's current shape does.

## Deviations from Plan

None. The plan was executed as written. Task 2 step 3 added no unit cases, because direct coverage was already 100% after Task 1.

## Issues Encountered

- In a JavaScript default parameter, an explicit `undefined` argument still gets the default. So the unit fake's "no ledger" sentinel is `null`, not `undefined`. This was caught on the first run, before the commit.
- The worktree sandbox refuses a shell command when it cannot prove the command is not git. All npm and npx runs went through a scratch wrapper (`exec-03-07/run.sh`), and the commits ran as plain `git commit` with literal environment prefixes.

## Verification

- `node --test test/orchestrators/command-invocation.test.ts`: 38 pass, 0 fail
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/command-invocation.ts`: exit 0
- `npx cucumber-js features/slash-command features/skill`: 137 scenarios passed
- `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features): all passed
- `npx fallow dupes --fail-on-issues --format human --quiet`: exit 0
- Acceptance greps: `provenProjectSkills(` 1, `commandFileDigest(` 1, `skillTreeDigest` 0, `persistMigration: false` 1, the append step text 1, `Status: updated` 1

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- The enable negative edit counts calls on `globalThis` so that the Background install is still recorded. This is a temporary edit only, but it depends on running one scenario per cucumber process.
- The unit fake writes the ledger layout (`{ version: 1, project, skills }`) and the key (`sha256` of `/work`) as literals. It also relies on `/work` not existing on the test machine, so `realpath` falls back to the resolved path. If Phase 2's ledger layout changes, this file must change too.
- A file that cannot be parsed refuses with `Cannot read the command ...` before the ledger is read, even for an unrecorded project command. The plan's order (read and parse, then ledger) asks for this.

## Parent lines

- Digest scope residual (T-03-23, accepted): the digest covers only the staged command file. A script under the plugin root that a `!` command runs is outside it. The skills digest covers the whole staged skill directory. This goes on the phase gap list.
- REQUIREMENTS.md: CMD-02 is declared by this plan. Plan 03-06 declared it too, so the orchestrator marks it after the wave merges. This executor did not edit STATE.md, ROADMAP.md, or REQUIREMENTS.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The check half of D-CF3-07 is in place and proven through Pi's results and the scripted model's call log. Plan 03-08 runs in parallel on disjoint files.

## Self-Check: PASSED

- FOUND: features/step_definitions/slash-command/project-provenance.steps.ts
- FOUND: extensions/pi-claude-marketplace/orchestrators/command-invocation.ts
- FOUND: fb21ef2 (ancestor of HEAD)
- FOUND: c1b90ce (ancestor of HEAD)

---
*Phase: 03-slash-commands*
*Completed: 2026-11-01*
