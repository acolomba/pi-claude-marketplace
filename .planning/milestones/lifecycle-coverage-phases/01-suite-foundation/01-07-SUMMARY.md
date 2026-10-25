---
phase: 01-suite-foundation
plan: 07
subsystem: testing
tags: [cucumber, state-lock, proper-lockfile, failure-injection, rollback, run-tokens, behavioral-tests]

requires:
  - phase: 01-suite-foundation
    provides: "01-03: `the user has run <command>, which failed`; 01-04/01-05: the session steps and the world's scopeRoot and onRelease; 01-06: `the user has run <command>` accepts any number of info results"
provides:
  - "Run tokens `{project dir}` (the sandbox project, Pi's cwd) and `{agent dir}` (the sandbox Pi agent directory); `RunTokens.projectDir` and `RunTokens.agentDir`"
  - "features/lib/state-lock-holder.ts: `holdStateLock(extensionRoot, lockFile)` and `isStateLockHeld(extensionRoot, lockFile)`; the module runs itself as the child"
  - "Step `Given another process holds the state lock of the {word} scope` (features/step_definitions/scope-state.steps.ts)"
  - "Steps `Given a directory blocks the mcp-adapter.json file of the {word} scope` and `Given the directory that blocks the mcp-adapter.json file of the {word} scope is removed`"
  - "Seeds: features/plugin/state-lock.feature (one per scope); features/plugin/install-rollback.feature (retry after the obstruction is removed)"
affects: [phase-5-install-update-rollback, phase-15-state-lock, 01-08, 01-09, 01-10]

actuals:
  tokens: 4915
  tasks: 2
  commits: 2

plan_head_before: 6d45c4dd266aed53d23a586f00edf734c639c407
plan_head_after: f907949aaa878130e2c38183b105b564d8bded27

tech-stack:
  added: []
  patterns:
    - "A features/lib stand-in that must run in its own process spawns `process.execPath` on its own file, so fallow sees one imported module"
    - "A child-process release ends stdin, requires exit code 0 within a named grace period, kills a hung child and fails, then asserts the resource is gone"
    - "An obstruction is a directory in place of a file the product writes (EISDIR), never a mode-bit change, so a run as root fails the same way"

key-files:
  created:
    - features/lib/state-lock-holder.ts
    - features/step_definitions/scope-state.steps.ts
    - features/plugin/state-lock.feature
    - features/plugin/install-rollback.feature
  modified:
    - features/lib/run-tokens.ts
    - features/support/world.ts
    - features/step_definitions/mcp-configuration.steps.ts
    - .agents/skills/cucumber/rules/features.md

key-decisions:
  - "The lock holder uses top-level await in its child branch; cucumber loads support and step modules through `import`, so the module stays loadable"
  - "On a failed ready line the holder kills the child and awaits its exit before failing, so a broken holder leaks no process"
  - "The three mcp-adapter.json steps share one private path helper, `mcpAdapterFile(world, scope)`, in their step module"

patterns-established:
  - "Lock held: `Given another process holds the state lock of the project scope`, then a `When` that changes the scope"
  - "Rollback retry: block, `Given the user has run \"...\", which failed`, unblock, then the same command as the `When`"

requirements-completed: [FND-01, FND-02]

coverage:
  - id: D1
    description: "Another process holds a scope's state lock with the product's options; uninstalling fails as lock held and leaves the installation record, in the project scope and in the user scope, with the cause chain stated through the new path tokens"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/plugin/state-lock.feature (2 scenarios)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A directory in place of mcp-adapter.json fails an install, and the retry after its removal installs the plugin and a new session offers its skill"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/plugin/install-rollback.feature#An install that failed while a directory blocked the mcp-adapter.json file succeeds once the directory is removed"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every new step and export is used, the feature gate passes, and the whole suite passes"
    requirement: FND-02
    verification:
      - kind: other
        ref: "npm run check:features"
        status: pass
      - kind: other
        ref: "npm run test:cucumber (448 scenarios)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 07: State lock holder, mcp-adapter.json obstruction, and sandbox path tokens Summary

**A child process now holds a scope's state lock with the product's own proper-lockfile options until the world releases it, a directory can block the mcp-adapter.json an install writes, and `{project dir}` and `{agent dir}` state the absolute sandbox paths in their cause chains. Three seeds prove each.**

## Performance

- **Duration:** about 9 min (start 2026-10-23T03:43:21Z, end 2026-10-23T03:51:58Z)
- **Tasks:** 2
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- `features/lib/run-tokens.ts`: `RunTokens` gains `projectDir` and `agentDir`. `expandTokens` and `projectTokens` replace `{project dir}` and `{agent dir}` like `{home}`. The fileoverview says the three sandbox directories do not nest, so replacement order does not matter. `features/support/world.ts` passes `run.sandbox.cwd` and `run.sandbox.agentDir`.
- `features/lib/state-lock-holder.ts` (new): `holdStateLock` spawns `process.execPath` on its own file. It waits up to `READY_TIMEOUT_MS` (10 s) for the line `locked`. It returns a release that ends stdin, waits up to `EXIT_GRACE_MS` (5 s) for the exit, requires `[0, null]`, and asserts that `stat(lockFile)` rejects with ENOENT. A hung child is killed with SIGKILL and awaited, and then the release fails. In child mode the module makes the extension root and takes `lockfile.lock(extensionRoot, { lockfilePath, realpath: false, retries: 0, stale: 10_000, update: 2_000 })` (D-06). It writes `locked`, keeps stdin flowing, and releases when stdin ends. `isStateLockHeld` calls `lockfile.check` with `stale: 10_000`.
- `features/step_definitions/scope-state.steps.ts` (new): the lock step. It registers the release before it asserts that the lock is held.
- `features/step_definitions/mcp-configuration.steps.ts`: the blocking and unblocking steps, with a comment that records why the obstruction is a directory.
- `.agents/skills/cucumber/rules/features.md`, "Run tokens": a bullet for each new token. The project scope root is `{project dir}/.pi`, and the user scope root is `{agent dir}`.

## Task Commits

1. **Task 1: Another process holds a scope's state lock, end to end, with the sandbox path tokens its cause chain needs** - `ce6fdbdc` (test), `test(features): hold a scope's state lock from another process`. Hook: every hook Passed on the first attempt, `npm run check:commit` (with fallow dead-code over `features/`) and gitlint included. Tracer gate: after the commit, the Task 1 verify passed again (2 scenarios, 22 steps; `check:features` exit 0) before Task 2 started.
2. **Task 2: Block and unblock the mcp-adapter.json an install writes, seeded by a retry that succeeds** - `f907949a` (test), `test(features): block the mcp-adapter.json an install writes`. Hook: every hook Passed on the first attempt, `npm run check:commit` and gitlint included.

## Final Text of New Steps

- `Given another process holds the state lock of the {word} scope` (features/step_definitions/scope-state.steps.ts)
- `Given a directory blocks the mcp-adapter.json file of the {word} scope` (features/step_definitions/mcp-configuration.steps.ts)
- `Given the directory that blocks the mcp-adapter.json file of the {word} scope is removed` (features/step_definitions/mcp-configuration.steps.ts)

New exports: `holdStateLock`, `isStateLockHeld` (both used by the lock step), and `RunTokens.projectDir` and `RunTokens.agentDir` (set by the world, read by both token functions).

## Seed Results

- **state-lock.feature, project scope:** `uninstall demo@fixtures --scope project` reports `cascade` / `error` / needs reload `false` / summary `A plugin operation has failed.`. It has one row: `fixtures` / `project` / `demo@fixtures` / `demo` / `failed` / reasons `lock held` / scope `project`. The cause chain is `Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held`, cause truncated is `false`, and leaks and rollback partial are empty. The row has no version. The installation record still holds `demo@fixtures | 1.0.0 | true`.
- **state-lock.feature, user scope:** the same, with scope `user` and the lock path `{agent dir}/pi-claude-marketplace/.state-lock`.
- **install-rollback.feature:** the blocked install fails (every result is an error). After the directory is removed, the retry reports `cascade` / `info` / needs reload `true` and one row `fixtures` / `project` / `demo@fixtures` / `demo` / `installed` / no reasons / `project` / `1.0.0`. A new session offers `/skill:demo-skill` (`A skill of demo 1.0.0.`).

## What the Failed Runs Reported (for Phases 5 and 15)

- **Install with the directory in place (Phase 5, INS-07).** I measured this with a temporary scenario, which I then removed. The result was `cascade` / `error` / needs reload `false` / `A plugin operation has failed.`. The row was `fixtures` / `project` / `demo@fixtures` / `demo` / `failed` / reasons **empty** / scope `project` / version `1.0.0`. The cause chain was `EISDIR: illegal operation on a directory, read '{project dir}/.pi/mcp-adapter.json'`, cause truncated `false`, and leaks and rollback partial were empty. The empty reasons are a bug candidate for Phase 5. The row now carries a version, which the research measurement did not show.
- **Uninstall with the lock held (Phase 15, FLR-01/02):** reasons `lock held`, as the seeds state. I ran no other verb with the lock held. The inconsistent rows that research recorded for install, enable, disable, update, and marketplace add and remove stay with Phase 15.

## Planted Checks

Each check was made by hand, run, and reverted from a backup. `cmp` or a grep confirmed each restore.

1. **`{project dir}` is not projected (Task 1).** I deleted the `.replaceAll(tokens.projectDir, PROJECT_DIR_TOKEN)` line and ran `npx cucumber-js features/plugin/state-lock.feature` (exit 1). The project seed failed on the raw path, and the user seed passed:

   ```
   +     'Another pi-claude-marketplace operation is in progress for project scope (/tmp/pi-cm-features-82xJ4x/project/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held',
   -     'Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held',
   2 scenarios (1 passed, 1 failed)
   22 steps (20 passed, 1 skipped, 1 failed)
   ```

2. **The release does not end stdin (Task 1).** I commented out `child.stdin.end()` in the release and ran the same command (exit 1, about 5 s slower). Both scenarios failed in the `After` hook, because the release killed the hung holder after the grace period:

   ```
   1) Uninstalling a plugin from the project scope while another process holds its state lock fails as lock held # features/plugin/state-lock.feature:7
        After # features/support/world.ts:283
            AggregateError: scenario releases failed
   2) Uninstalling a plugin from the user scope while another process holds its state lock fails as lock held # features/plugin/state-lock.feature:28
        After # features/support/world.ts:283
            AggregateError: scenario releases failed
   2 scenarios (2 failed)
   22 steps (20 passed, 2 failed)
   ```

   No holder process was left afterwards.

3. **The blocking step writes a regular file `{}` (Task 2).** I made two runs of `npx cucumber-js features/plugin/install-rollback.feature`, and each exited 1:
   - With the step's EISDIR assertion kept, the blocking step itself failed: `Given a directory blocks the mcp-adapter.json file of the project scope` / `AssertionError [ERR_ASSERTION]: Missing expected rejection.`
   - With that assertion also removed, the failing setup step failed because the install succeeded: `Given the user has run "/claude:plugin install demo@fixtures --scope project", which failed` / `AssertionError` with the actual result `cascade` / `info`, row `demo@fixtures` `installed` `1.0.0`, against the expected `[]`.

## Files Created/Modified

- `features/lib/run-tokens.ts` - `{project dir}` and `{agent dir}`
- `features/support/world.ts` - the tokens getter passes the sandbox project and agent directory
- `features/lib/state-lock-holder.ts` - the self-spawning lock holder
- `features/step_definitions/scope-state.steps.ts` - the lock step
- `features/step_definitions/mcp-configuration.steps.ts` - the blocking and unblocking steps
- `features/plugin/state-lock.feature` - `Feature: Plugin state lock`, two seeds (Phase 15 owns the file after this phase)
- `features/plugin/install-rollback.feature` - `Feature: Plugin install rollback`, one seed (Phase 5 owns the file after this phase)
- `.agents/skills/cucumber/rules/features.md` - the two tokens

## Decisions Made

- The child branch uses top-level await. Cucumber loads modules through `import` (`cucumber.json`), and when the module is imported the branch is skipped.
- When the ready line does not arrive, the holder kills the child and awaits its exit before it fails, so a broken holder leaks no process.
- The three mcp-adapter.json steps share one private helper, `mcpAdapterFile`. It replaces the path expression of the existing comment step with the same value.

## Deviations from Plan

None - plan executed exactly as written.

## Bug Candidates

I recorded these as observed and fixed none. Neither blocks a seed of this plan.

1. **An install that fails on EISDIR in its mcp phase reports no reason.** The row is `failed` with reasons `[]`. Only the cause chain names the problem. Owner: Phase 5 (INS-07), with a Claude Code parity check.
2. **The lock-held rows of the other verbs.** These are install, enable, and disable with empty reasons, update with `unreadable manifest`, and marketplace add and remove with `internal-error`. RESEARCH Pattern 4 measured them, and I did not re-run them. Owner: Phase 15.

## Issues Encountered

None.

## Plan-level Verification

- `npx cucumber-js features/plugin/state-lock.feature features/plugin/install-rollback.feature features/marketplace/update.feature`: 94 scenarios and 1154 steps passed. `npm run check:features` exited 0.
- Acceptance greps: `{project dir}` in run-tokens.ts 3; `{agent dir}` in run-tokens.ts 3; `stale: 10_000` in the holder 2; `update: 2_000` in the holder 1; the lock step text 1; `{project dir}` in features.md 1; the blocking step text 2; `is removed` 1; `EISDIR` 2. `ls features/lib/*.ts` lists `state-lock-holder.ts`. `features/step_definitions/plugin/` still holds only `installation.steps.ts` and `publishing.steps.ts`.
- Final `npm run test:cucumber` on `f907949a`: 448 scenarios and 4229 steps passed (exit 0, Node v26.12.1). `ps -eo args` shows no `state-lock-holder.ts` process.
- I did not run `npm run check`. It is the wave gate after wave 4.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The plan's mitigations hold. T-01-15: the step registers the release before its assertion. The release requires a clean exit within the grace period, kills and fails a hung holder, and asserts that the lock is gone, as planted check 2 shows. T-01-16: both paths come from `this.scopeRoot(scope)`, which resolves only inside the sandbox. T-01-17: the obstruction is a directory (EISDIR), and the step asserts that reading it fails, as planted check 3 shows. T-01-18: the blocking step registers a release that removes the directory, and the `Before()` reset empties the scope roots.

## Next Phase Readiness

- Phase 15 can hold the lock in either scope and state lock paths with `{project dir}` and `{agent dir}`.
- Phase 5 can block mcp-adapter.json for INS-07 and UPD-04, and can run the first attempt through `the user has run ..., which failed`.
- Wave 4 is complete (01-06 and 01-07). Next is the wave gate (`npm run check` on the combined tree), then 01-08.

## Self-Check: PASSED

- FOUND: features/lib/state-lock-holder.ts, features/step_definitions/scope-state.steps.ts, features/plugin/state-lock.feature, features/plugin/install-rollback.feature
- FOUND: commits ce6fdbdc, f907949a (ancestors of HEAD)

---
*Phase: 01-suite-foundation*
*Completed: 2026-10-23*
