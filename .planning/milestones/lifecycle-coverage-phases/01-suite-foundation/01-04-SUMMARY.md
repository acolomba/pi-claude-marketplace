---
phase: 01-suite-foundation
plan: 04
subsystem: testing
tags: [cucumber, installation-record, plugin-data-dir, installed-skills, keep-data, reinstall, enable]

requires:
  - phase: 01-suite-foundation
    provides: "Plan 01: features/step_definitions/plugin/installation.steps.ts (the plugin topic module, recordedPlugins, the no-installed-plugins step)"
  - phase: 01-suite-foundation
    provides: "Plan 02: session results and the row steps the seeds compare"
provides:
  - "Step: Then the installation record of the {word} scope holds these plugins: (columns id, version, enabled)"
  - "Step: Given the data directory of {string} in the {word} scope holds the file {string} with the text {string}"
  - "Step: Then the data directory of {string} in the {word} scope holds these files: (columns file, text)"
  - "Step: Given the user has deleted the installed skills of {string} in the {word} scope"
  - "Seed: features/plugin/enable.feature 'Enabling a disabled plugin offers its skills again and keeps one installation record'"
  - "Seed: features/plugin/uninstall.feature 'Uninstalling with --keep-data keeps the plugin's data directory and the file in it'"
  - "Seed: features/plugin/reinstall.feature 'Reinstalling a plugin whose installed skills were deleted restores them'"
affects: [enable, uninstall, reinstall, update, rollback, reconcile]

actuals:
  tokens: 3424
  tasks: 2
  commits: 2
plan_head_before: 157f4b43347a509d8fe6d60f6643018d9d196f2b
plan_head_after: 016bbbd982751145653615ee20ca7e33685cca22

tech-stack:
  added: []
  patterns:
    - "The installation record reader projects each plugin to id, version, enabled, and resources.skills, and fails with the file content on a wrong type"
    - "A setup step that changes an installed plugin's files first asserts what the install left (the data directory exists; each recorded skill directory removes without force)"

key-files:
  created: []
  modified:
    - features/step_definitions/plugin/installation.steps.ts
    - features/plugin/enable.feature
    - features/plugin/uninstall.feature
    - features/plugin/reinstall.feature

key-decisions:
  - "The deletion step removes each recorded skill directory without force, so a skill the install did not stage fails the setup instead of passing silently"
  - "Plugin and marketplace names in an id, the planted file name, and each recorded skill name must be a single directory entry (no separator, not . or ..), so no step writes or deletes outside the scope's extension root (T-01-07)"
  - "The enable seed states the row status as observed, installed: enable-disable.messaging.ts types EnableStatus as installed | partially-installed | skipped | failed"

patterns-established:
  - "Leftover checks: Given an install -> Given a user change to its files -> When the verb -> Then the result -> Then the record or data directory, or a new session's skills"

requirements-completed: [FND-01, FND-02]

coverage:
  - id: D1
    description: "A scenario states the plugins a scope's installation record holds as a whole id/version/enabled table; enabling a disabled plugin keeps one record, enabled"
    requirement: FND-01
    verification:
      - kind: integration
        ref: "npx cucumber-js features/plugin/enable.feature features/plugin/install.feature (14 scenarios passed)"
        status: pass
      - kind: other
        ref: "planted check: the step reporting every record as enabled false fails the enable seed"
        status: pass
    human_judgment: false
  - id: D2
    description: "A scenario plants a file in a plugin's data directory and lists the directory's files; uninstall --keep-data keeps the planted file"
    requirement: FND-01
    verification:
      - kind: integration
        ref: "npx cucumber-js features/plugin/uninstall.feature (keep-data seed passed)"
        status: pass
      - kind: other
        ref: "planted check: the plant step writing next to the data directory fails the keep-data seed"
        status: pass
    human_judgment: false
  - id: D3
    description: "A scenario deletes an installed plugin's skill directories named by the record; reinstall restores them"
    requirement: FND-01
    verification:
      - kind: integration
        ref: "npx cucumber-js features/plugin/reinstall.feature (reinstall seed passed)"
        status: pass
      - kind: other
        ref: "planted check: skipping the removal fails the deletion step with 'Missing expected rejection: ... still exists'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every new step is used, the feature gate stays green, and the whole suite passes"
    requirement: FND-02
    verification:
      - kind: other
        ref: "npm run check:features; commit hooks npm run check:commit on e79c8eea and 016bbbd9"
        status: pass
      - kind: integration
        ref: "npm run test:cucumber (440 scenarios passed)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 04: Installation Record, Data Directory, and Installed Skills Summary

**Four new steps in the plugin topic module `installation.steps.ts` read a scope's installation record as an id/version/enabled table, plant and list a plugin's data files, and delete its installed skills; three seeds prove enable keeps one record, `uninstall --keep-data` keeps a planted file, and reinstall restores deleted skills.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-23T03:06:14Z
- **Completed:** 2026-10-23T03:14:04Z
- **Tasks:** 2
- **Files modified:** 4 (0 created, 4 modified)

## Accomplishments

- `features/step_definitions/plugin/installation.steps.ts`: the private record reader now returns `{ id, version, enabled, skills }` per plugin through a `recordedPlugin` helper. It fails with the file content when `version` is not a string, `enabled` is not a boolean, or `resources.skills` is not a list of strings. `the {word} scope has no installed plugins` compares the ids, as before.
- A private `pluginDataDirectory` resolves `plugin@marketplace` and a scope to `<scopeRoot>/pi-claude-marketplace/data/<marketplace>/<plugin>`. It fails on any other id shape.
- The plant step asserts that the data directory exists and is a directory, refuses a file name that is not one directory entry, writes with flag `wx`, registers a release that removes the file, and reads the text back.
- The listing step fails on a missing directory, lists every file recursively as `[relative path with /, text]` sorted by path, and compares the whole table.
- The deletion step reads `resources.skills` from the scope's record (it fails when the plugin has no record or no skill), removes each `resources/skills/<name>` directory without force, and asserts `ENOENT` for each.
- The `@fileoverview` says the module reads the record, the data directory, and the staged skills, and that two setup steps change an installed plugin's files as a user can.

## Task Commits

1. **Task 1: State the plugins a scope's installation record holds, seeded by enable keeping one record** - `e79c8eea` (test), `test(features): state the plugins an installation record holds`. Hook: `npm run check:commit` Passed, gitlint Passed. The pre-commit dry run first reported that prettier rewrote `installation.steps.ts` (a long `assert.fail` line), which is a fixer write; the rerun passed. Tracer gate: after the commit I re-ran `npx cucumber-js features/plugin/enable.feature features/plugin/install.feature` (exit 0) and `npm run check:features` (exit 0).
2. **Task 2: Plant and list a plugin's data files and delete its installed skills, seeded by keep-data and reinstall** - `016bbbd9` (test), `test(features): plant plugin data files and delete installed skills`. Hook: `npm run check:commit` Passed, gitlint Passed.

## Final Text of New Steps

All four are in `features/step_definitions/plugin/installation.steps.ts`:

- `Then the installation record of the {word} scope holds these plugins:` (columns `id`, `version`, `enabled`; rows sorted by id)
- `Given the data directory of {string} in the {word} scope holds the file {string} with the text {string}`
- `Then the data directory of {string} in the {word} scope holds these files:` (columns `file`, `text`; rows sorted by file)
- `Given the user has deleted the installed skills of {string} in the {word} scope`

## Seed Results

- **enable:** after install and disable of `demo@fixtures --scope project`, enable reports `cascade`, info, needs reload `true`, and the row `fixtures` / `project` / `demo@fixtures` / `demo` / `installed` / no reasons / `project` / `1.0.0`. The record holds one row, `demo@fixtures | 1.0.0 | true`, and a new session offers `/skill:demo-skill`.
- **uninstall --keep-data:** `cascade`, info, needs reload `true`, the row `uninstalled` with the reason `data kept` and version `1.0.0`. The data directory holds `notes.txt` with `Kept by the user.` and nothing else.
- **reinstall:** after the skills are deleted, reinstall reports `cascade`, info, needs reload `true`, the row `reinstalled`, no reasons, version `1.0.0`, and a new session offers `/skill:demo-skill` again.

## Planted Checks

Each was done by hand on a copy of the step module, run, and restored from a backup (`cmp` confirmed the restore).

1. **Every record reads as disabled (Task 1).** I changed the projection to `String(false)` and ran `npx cucumber-js features/plugin/enable.feature --name "keeps one installation record"` (exit 1):

   ```
   Then the installation record of the project scope holds these plugins:
       AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
           +     'false'
           -     'true'
   1 scenario (1 failed)
   13 steps (10 passed, 2 skipped, 1 failed)
   ```

2. **The deletion step skips the removal (Task 2).** I replaced the `rm` calls with no-ops and ran `npx cucumber-js features/plugin/reinstall.feature --name "installed skills were deleted"` (exit 1). The first run showed only `Missing expected rejection.`, so I added a message to the assertion. The run after that change:

   ```
   Given the user has deleted the installed skills of "demo@fixtures" in the project scope
       AssertionError [ERR_ASSERTION]: Missing expected rejection: /tmp/pi-cm-features-OlmzUG/project/.pi/pi-claude-marketplace/resources/skills/demo-skill still exists
   1 scenario (1 failed)
   12 steps (6 passed, 5 skipped, 1 failed)
   ```

3. **The plant step writes next to the data directory (Task 2).** I changed the target to `path.join(path.dirname(directory), name)` and ran `npx cucumber-js features/plugin/uninstall.feature --name "keep-data"` (exit 1). The kept data directory was empty:

   ```
   Then the data directory of "demo@fixtures" in the project scope holds these files:
       AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
           -   [
           -     'notes.txt',
           -     'Kept by the user.'
           -   ]
   1 scenario (1 failed)
   11 steps (10 passed, 1 failed)
   ```

## Files Created/Modified

- `features/step_definitions/plugin/installation.steps.ts` - the record reader with skills, the data directory resolver, and the four new steps
- `features/plugin/enable.feature` - the enable seed (Phase 2 owns the file after this phase)
- `features/plugin/uninstall.feature` - the keep-data seed (Phase 6)
- `features/plugin/reinstall.feature` - the reinstall seed (Phase 8)

## Decisions Made

- The record reader validates `resources.skills` for every plugin, not only for the deletion step. Every real record has it, and one reader keeps the failure message in one place.
- The fileoverview changes in both commits: the first commit describes the record read, and the second adds the data directory and the two setup steps. Each commit's overview describes the steps that commit has.
- The deletion step registers no release: the files it deletes are in the sandbox, and the `Before()` reset empties the scope roots.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The deletion step's ENOENT assertion failed without saying which directory**

- **Found during:** Task 2 (planted check 2)
- **Issue:** `assert.rejects(stat(directory), { code: "ENOENT" })` failed with only `Missing expected rejection.`
- **Fix:** passed the message `${directory} still exists` as the third argument.
- **Files modified:** features/step_definitions/plugin/installation.steps.ts
- **Verification:** the planted check ran again and named the directory; both seeds passed.
- **Committed in:** 016bbbd9

---

**Total deviations:** 1 auto-fixed (1 bug in my own step, found before commit)
**Impact on plan:** None. The step texts are the ones the plan proposed.

## Issues Encountered

- My first enable seed stated the status `enabled`. The product reports `installed`, which `EnableStatus` in `orchestrators/plugin/enable-disable.messaging.ts` defines on purpose. I stated the observed value.

## Bug Candidates

None found. One point for Phase 2 (enable) to check against Claude Code: enable reports the row status `installed`, while upstream `/plugin enable` reports that it enabled the plugin. The status is a deliberate type here, so it is not a bug unless the upstream research says the user-visible wording must differ.

## Plan-level Verification

- `npx cucumber-js features/plugin/enable.feature features/plugin/install.feature`: 14 scenarios passed (Task 1).
- `npx cucumber-js features/plugin/uninstall.feature features/plugin/reinstall.feature`: 20 scenarios passed, 256 steps (Task 2).
- `npm run check:features`: exit 0 after each task.
- `npm run test:cucumber`: 440 scenarios passed, 4145 steps passed (exit 0, final tree).
- Acceptance greps: each of the four step texts appears once in `installation.steps.ts`.
- I did not run `npm run check`. That is the wave gate after wave 3.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-07 is mitigated as planned: every path comes from `this.scopeRoot(scope)`, the id parts, the planted file name, and each recorded skill name must be a single directory entry, and the deletion step removes only names the scope's own record lists. T-01-08: the plant step registers a release that removes its file.

## Next Phase Readiness

- Phases 2, 5, 6, and 15 can state an installation record with `the installation record of the {word} scope holds these plugins:`.
- Phases 6 and 12 can plant and list data files; Phase 8 can delete installed skills before a reinstall.
- Ready for the next wave 3 plan (01-05).

## Self-Check: PASSED

- FOUND: features/step_definitions/plugin/installation.steps.ts, features/plugin/enable.feature, features/plugin/uninstall.feature, features/plugin/reinstall.feature
- FOUND: e79c8eea, 016bbbd9 (ancestors of HEAD)

---
*Phase: 01-suite-foundation*
*Completed: 2026-10-23*
