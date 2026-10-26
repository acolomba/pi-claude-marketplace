---
phase: 01-suite-foundation
plan: 05
subsystem: testing
tags: [cucumber, pi-rpc, behavioral-tests, sessions, partial-install, dependencies]

requires:
  - phase: 01-suite-foundation
    provides: "01-02: startSession reading get_entries, recordResults/resultsOf on the world, SessionReport"
provides:
  - "readSession(pi): the skills and payloads of a Pi's current session, without starting a new one"
  - "ScenarioWorld.startSessionInAnotherProject(): a second, short-lived Pi with the run's HOME and agent dir in a fresh project directory, released by the world"
  - "Step: When the user starts a new pi session in another project"
  - "writePublishedPluginFile creates parent directories and returns the written path"
  - "publishOutputStyle(published, plugin): a published plugin with an output style, which makes it partially available, on every source kind"
  - "Topic module features/step_definitions/plugin/publishing.steps.ts with the output style step"
  - "Seeds in plugin/install.feature, plugin/partial-install.feature, plugin/install-dependencies.feature"
affects: [phase-3-install, phase-7-update, phase-9, phase-10-info, phase-13-import]

actuals:
  tokens: 3845
  tasks: 2
  commits: 2

plan_head_before: 109c0b1626d6ab0ad98d9284ed80024f02182aa7
plan_head_after: eab07a5121a21afa87b21a6edf4cf05e9728d7d7

tech-stack:
  added: []
  patterns:
    - "A scenario that needs another working directory starts a second PiProcess through a world method; the world registers one release that removes the directory and one that stops the Pi, both before the session is read"
    - "Plugin publishing steps live in the plugin/publishing topic module, never in a verb module"

key-files:
  created:
    - features/step_definitions/plugin/publishing.steps.ts
    - features/plugin/partial-install.feature
    - features/plugin/install-dependencies.feature
  modified:
    - features/lib/pi-commands.ts
    - features/support/world.ts
    - features/step_definitions/session.steps.ts
    - features/plugin/install.feature
    - features/lib/published-marketplace.ts

key-decisions:
  - "The second Pi reads its first session with readSession and is stopped right after; it never sends new_session, so its startup entries are the session's payloads"
  - "writePublishedPluginFile returns the path it wrote, so publishOutputStyle does not rebuild it"
  - "Seeds state the rows as observed: the partially-available row has no scope or version, and the dependency row's name is lib@tools; both are recorded as Phase 3 bug candidates, not fixed"

patterns-established:
  - "Other-project session: world.startSessionInAnotherProject() + When the user starts a new pi session in another project"
  - "Partial plugin: Given the published plugin X of the marketplace Y has an output style"

requirements-completed: [FND-01, FND-02]

coverage:
  - id: D1
    description: "A session in another project offers a user-scope plugin's skills and no project-scope plugin's skills"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/plugin/install.feature#A session in another project offers the skills of a plugin installed into the user scope and none of a project-scope plugin"
        status: pass
    human_judgment: false
  - id: D2
    description: "Installing a partially available plugin without --partial fails as partially available and installs nothing"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/plugin/partial-install.feature#Installing a partially available plugin without --partial fails as partially available"
        status: pass
    human_judgment: false
  - id: D3
    description: "A dependency with a version constraint is installed with its plugin and reports dependency current copy"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/plugin/install-dependencies.feature#Installing a plugin whose dependency carries a version constraint installs the dependency too"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every new step and export is used; the feature gate and the commit hook (fallow, lint, typecheck) pass"
    requirement: FND-02
    verification:
      - kind: other
        ref: "npm run check:features"
        status: pass
      - kind: other
        ref: "npm run test:cucumber (443 scenarios)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 05: Other-project sessions, partial plugins, and constrained dependencies Summary

**A second short-lived Pi in a fresh project directory proves user-scope plugins reach other projects, an output-style fixture makes a published plugin partially available, and a `lib@^1.0.0` dependency seeds the constrained-dependency install, each with a Phase 3 seed.**

## Performance

- **Duration:** about 8 min of execution (start 2026-10-23T03:18:03Z, end 2026-10-23T03:25:37Z)
- **Tasks:** 2
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- `features/lib/pi-commands.ts`: `readSession(pi)` sends `get_commands` and `get_entries` and returns the session's skills and validated payloads (DRV-01). `startSession` now sends `new_session`, asserts it, and calls `readSession`.
- `features/support/world.ts`: `startSessionInAnotherProject()` makes `other-project-*` with `mkdtemp` under the run root, registers a release that removes it, starts `PiProcess.start({ home, agentDir, cwd }, run.piEnvironment)`, registers a release that stops it, reads the session, stops the Pi, and returns the report.
- `features/step_definitions/session.steps.ts`: the new `When` step and the existing one share a private `keepSession` helper, which records the payloads as session results and keeps the skills.
- `features/lib/published-marketplace.ts`: `writePublishedPluginFile` creates the target's parent directories inside the change it hands to `changePublication`, so a git publication commits the nested file. It returns the path. `publishOutputStyle` writes `output-styles/<plugin>-style.md` with `name` and `description` frontmatter.
- `features/step_definitions/plugin/publishing.steps.ts` (new topic module): the output style step.
- Three seeds, all passing.

## Task Commits

1. **Task 1: A new session in another project, seeded by a user-scope plugin it offers** - `58a3606a` (test), `test(features): start a session in another project`. Hook: `npm run check:commit` Passed, gitlint Passed. Tracer gate: after the commit I re-ran `npx cucumber-js features/plugin/install.feature` (12 scenarios passed) and `npm run check:features` (exit 0), then started Task 2.
2. **Task 2: A partially available plugin and a constrained dependency, seeded by their installs** - `eab07a51` (test), `test(features): publish a partially available plugin`. Hook: `npm run check:commit` Passed, gitlint Passed.

Both hooks passed on the first attempt. `SKIP=npm-check pre-commit run --files ...` passed before each commit with no fixer writes.

## Final Text of New Steps

- `When the user starts a new pi session in another project` (in `features/step_definitions/session.steps.ts`)
- `Given the published plugin {string} of the marketplace {string} has an output style` (in `features/step_definitions/plugin/publishing.steps.ts`)

New exports and members: `readSession` (`features/lib/pi-commands.ts`), `publishOutputStyle` (`features/lib/published-marketplace.ts`), and `ScenarioWorld.startSessionInAnotherProject()`.

## Seed Results

- **install.feature, "A session in another project offers the skills of a plugin installed into the user scope and none of a project-scope plugin":** `fixtures` offers `demo 1.0.0` and `pp 1.0.0`. It is added to the user scope as well as the Background's project scope, and `demo` is installed `--scope user` and `pp` `--scope project`. The other-project session offers only `/skill:demo-skill` / `A skill of demo 1.0.0.`. Measured: that session reported no payload (`PAYLOADS []`, from a temporary log line that I removed).
- **partial-install.feature:** `cascade`, `error`, needs reload `false`, summary `A plugin operation has failed.`. One row: `fixtures` / `project` / `demo@fixtures` / `demo` / `partially-available` / `unsupported component` / hint `partial-install`. The row has no `scope` and no `version` field. The project scope has no installed plugins.
- **install-dependencies.feature:** `cascade`, `info`, needs reload `true`. Rows: `app@tools` / name `app` / `installed` / no reasons / `project` / `1.0.0`, and `lib@tools` / name `lib@tools` / `installed` / `dependency current copy` / `project` / `1.2.0`. A new session offers `/skill:app-skill` (`A skill of app 1.0.0.`) and `/skill:lib-skill` (`A skill of lib 1.2.0.`).
- I also ran the partial seed once each with the `file`, `url`, and `github` kinds by editing the kind in place. Each passed, and the file was restored (`cmp`). So the output style step works on every source kind. Only the `dir` row is committed, as planned.

## Planted Checks

Each check was made by hand, run, and reverted from a backup (`cmp` confirmed each restore).

1. **The second Pi runs in the run's own project (Task 1).** I changed the start call to `cwd: run.sandbox.cwd` and ran `npx cucumber-js features/plugin/install.feature --name "another project"` (exit 1):

   ```
               +   [
               +     '/skill:pp-skill',
               +     'A skill of pp 1.0.0.'
               +   ]
   1 scenario (1 failed)
   11 steps (10 passed, 1 failed)
   ```

2. **The output style goes to `output-style/` (Task 2).** I made `publishOutputStyle` write `output-style/<plugin>-style.md` and ran `npx cucumber-js features/plugin/partial-install.feature` (exit 1). The install succeeded:

   ```
   Then the result has these fields:
       AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
                 'severity',
           +     'info'
           -     'error'
                 'needs reload',
           +     'true'
           -     'false'
           -   [ 'summary', 'A plugin operation has failed.' ]
   ```

3. **The dependency has no constraint (Task 2).** I declared `app`'s dependency as `lib` and ran `npx cucumber-js features/plugin/install-dependencies.feature` (exit 1). The reason was gone:

   ```
                    "lib@tools"
                    "lib@tools"
                    "installed"
               -    ""
               +    "dependency current copy"
   1 scenario (1 failed)
   10 steps (7 passed, 2 skipped, 1 failed)
   ```

## Files Created/Modified

- `features/lib/pi-commands.ts` - `readSession`; `startSession` uses it
- `features/support/world.ts` - `startSessionInAnotherProject`
- `features/step_definitions/session.steps.ts` - the other-project `When` step and the shared `keepSession` helper
- `features/plugin/install.feature` - the other-project seed (Phase 3 owns the file after this phase)
- `features/lib/published-marketplace.ts` - nested plugin files and `publishOutputStyle`
- `features/step_definitions/plugin/publishing.steps.ts` - new plugin publishing topic module
- `features/plugin/partial-install.feature` - `Feature: Plugin partial install` and its seed (Phase 3)
- `features/plugin/install-dependencies.feature` - `Feature: Plugin install dependencies` and its seed (Phase 3)

## Decisions Made

- The second Pi never sends `new_session`. Its first session is a new session, and `readSession` returns the startup entries.
- `writePublishedPluginFile` returns its path, so `publishOutputStyle` does not build it a second time. The other caller (`declarePublishedMcpServer`) ignores the value.
- The output style step checks the file with `assert.strictEqual(isFile(), true, ...)`. This compares a whole value, as the step rules require.

## Deviations from Plan

None - plan executed exactly as written. One change goes past the plan's wording: `writePublishedPluginFile` now returns `Promise<string>` instead of `Promise<void>`. It is a supporting change inside a file the plan names.

## Bug Candidates

I stated each of these as observed and did not fix it. None of them blocks a seed of this plan. Each needs a Claude Code parity check by its owning phase.

1. **The dependency row's `name` is the qualified id** (`install-dependencies.feature`). The `lib` row reports `name` `lib@tools`, while the root plugin row reports `name` `app`. The planted check without a constraint shows the same `lib@tools` name, so the constraint does not cause it. Owner: Phase 3 (install dependencies).
2. **The partially-available row has no `scope` and no `version`** (`partial-install.feature`). Failed install rows carry `scope` (for example `not in manifest` in `install.feature`), but this refusal row has neither field. Owner: Phase 3 (partial install).

## Issues Encountered

None.

## Plan-level Verification

- `npx cucumber-js features/plugin/install.feature`: 12 scenarios passed (Task 1, and the tracer re-run).
- `npx cucumber-js features/plugin/partial-install.feature features/plugin/install-dependencies.feature features/marketplace/update.feature`: 93 scenarios passed, 1139 steps (Task 2).
- `npm run check:features`: exit 0 after each task.
- `npm run test:cucumber`: 443 scenarios passed, 4176 steps passed (exit 0, final tree `eab07a51`, Node v26.12.1). No `--mode rpc` Pi process was left running afterwards.
- Acceptance greps: `readSession` 1, `other-project-` 1, the new session step 1, `this.onRelease(` 2, `has an output style` 1, `publishOutputStyle` 1.
- I did not run `npm run check`. That is the wave gate after wave 3.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The plan's mitigations hold. T-01-09: the second Pi reuses the run's sandbox HOME and agent directory and the run's `piEnvironment`, and its cwd comes from `mkdtemp` under `currentRun().root`. `PiProcess.start` passes every location through `resolveSandbox`. T-01-10: the world registers both releases (remove the directory, stop the Pi) before the session is read, and the method stops the Pi once it has read the session. T-01-11: `publishOutputStyle` writes through `writePublishedPluginFile`, which uses `ownedTarget` and flag `wx`. The new `mkdir` runs on the already-checked target's parent.

## Next Phase Readiness

- Phase 3 can use the three seeds and the two new steps. Phase 13 can use the other-project session.
- Ready for the next wave-3 sibling or the wave gate (`npm run check` on the combined tree).

## Self-Check: PASSED

- FOUND: features/plugin/partial-install.feature, features/plugin/install-dependencies.feature, features/step_definitions/plugin/publishing.steps.ts
- FOUND: commits 58a3606a, eab07a51 (ancestors of HEAD)

---
*Phase: 01-suite-foundation*
*Completed: 2026-10-23*
