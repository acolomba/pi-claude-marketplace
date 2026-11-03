---
phase: 05-hooks
plan: 05
subsystem: testing
tags: [hooks, cucumber, lifecycle, disable, enable, uninstall, update]

requires:
  - phase: 05-hooks
    provides: "05-01 `the hooks record no runs` step; 05-02 hooks table writer that replaces hooks/hooks.json when it runs again"
provides:
  - "features/hook/lifecycle.feature: HOOK-09 lifecycle pins for disable, enable, uninstall, and update, observed through the hook recorder in a new session"
affects: [05-09 (HOOK-09 docs half), 05-hooks verification]

actuals:
  tokens: 1075
  tasks: 2
  commits: 2
plan_head_before: efad8ab51170082b3fa022b3846e808996bc1810
plan_head_after: a1bde2045b5bf4eee7bb5eab07f0388f19ecc549

tech-stack:
  added: []
  patterns:
    - "Lifecycle hook scenarios keep the hooks Given in the Background; the update scenario republishes a second table after offering the new version"

key-files:
  created:
    - features/hook/lifecycle.feature
  modified: []

key-decisions:
  - "The hooks Given stays in the Background: a second run of it in the update scenario replaces the 1.0.0 hooks file, so no scenario needs its own copy"
  - "The enable and update runs tables state every recorded column, as the seed in tool-use.feature does, so a stray or missing run fails the whole-table compare"

patterns-established:
  - "Lifecycle pins remove the verb under test as the negative edit, so the red run shows the hook routing the verb changes"

requirements-completed: [HOOK-09]

coverage:
  - id: D1
    description: "After disable and a new session, a scripted bash call runs none of the plugin's hooks"
    requirement: HOOK-09
    verification:
      - kind: e2e
        ref: "features/hook/lifecycle.feature#Disabling a plugin stops its hooks"
        status: pass
    human_judgment: false
  - id: D2
    description: "After disable, enable, and a new session, the plugin's PreToolUse hook runs again"
    requirement: HOOK-09
    verification:
      - kind: e2e
        ref: "features/hook/lifecycle.feature#Enabling a disabled plugin runs its hooks again"
        status: pass
    human_judgment: false
  - id: D3
    description: "After uninstall and a new session, no hook of the plugin runs"
    requirement: HOOK-09
    verification:
      - kind: e2e
        ref: "features/hook/lifecycle.feature#Uninstalling a plugin stops its hooks"
        status: pass
    human_judgment: false
  - id: D4
    description: "After update to a version that declares a different hook and a new session, only the new hook runs"
    requirement: HOOK-09
    verification:
      - kind: e2e
        ref: "features/hook/lifecycle.feature#Updating a plugin replaces its hooks"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-11-01
status: complete
---

# Phase 5 Plan 05: Hook lifecycle Summary

**`features/hook/lifecycle.feature` pins HOOK-09's lifecycle half. In a new session after each verb, the hook recorder shows that disable and uninstall stop a project-scope plugin's PreToolUse hook, enable runs it again, and update runs only the new version's `fresh-guard` hook. No product change was needed.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-11-01T16:11:07Z
- **Completed:** 2026-11-01T16:25:34Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- `Feature: Hook lifecycle`, 4 scenarios. The Background starts a profile Pi with the scripted model, publishes the dir marketplace `fixtures` with `demo` 1.0.0 and the hook `guard | PreToolUse | Bash`, adds the marketplace to the project scope, and installs the plugin there. Every scenario then runs its verb, starts a new session, scripts one `bash` call (`{"command": "echo from-model"}`) and a reply, and has one `When the user prompts "run the echo"`.
- Disable and uninstall end in `Then the hooks record no runs`. Enable states the full `guard` row. Update offers `demo` 1.1.0, publishes the hooks table again with `fresh-guard | PreToolUse | Bash`, runs `update`, and states only the `fresh-guard` row.

## Task Commits

1. **Task 1: A disabled plugin's hook does not run in a new session** - `ac8a257` (test)
2. **Task 2: Enable restores, uninstall stops, and update replaces a plugin's hooks** - `a1bde20` (test)

Tracer gate after Task 1: auto mode was off, `human_verify_mode` was end-of-phase, and the `<verify>` was automated only. I re-ran it after the revert (cucumber 1/1 passed, `npm run check:features` passed), so Task 2 went ahead without a checkpoint.

## Negative-edit evidence

Each edit was made on the working copy, run, and then undone by copying back a saved good copy. `git status --short` showed only the intended file each time.

1. **Disable pin, edit A (drop the disable step).** I removed `Given the user has run "/claude:plugin disable demo@fixtures --scope project"`. `npx cucumber-js features/hook/lifecycle.feature`: 1 scenario failed, 12 steps (11 passed, 1 failed). `Then the hooks record no runs` (`runs.steps.ts:146`) expected `[]`, but got one run: `arguments: ["guard"]`, `event: PreToolUse`, `tool_name: Bash`, `tool_input: {command: "echo from-model"}`, with `CLAUDE_PLUGIN_ROOT` `.../home/marketplaces/fixtures/plugins/demo`.
2. **Disable pin, edit B (expect a `guard` row).** I swapped the Then for `Then the hooks record these runs:` with the full `guard` row. 1 scenario failed, 13 steps (12 passed, 1 failed). The actual table was the header only. The stated `guard` body row was missing (`runs.steps.ts:134`).
3. **Task 2 pins (drop the enable, uninstall, and update steps, run together, seed 291913).** 4 scenarios (1 passed, 3 failed), 52 steps (49 passed, 3 failed):
   - "Enabling a disabled plugin runs its hooks again": got no body rows where the `guard` row was expected. The plugin stayed disabled.
   - "Uninstalling a plugin stops its hooks": got one `guard` run where `[]` was expected.
   - "Updating a plugin replaces its hooks": the arguments cell was `guard` where `fresh-guard` was expected. Without `update`, the installed 1.0.0 hook still runs, even though the marketplace now publishes the new hooks file. So the scenario tells the update apart from a re-read of the marketplace.

After the restore, `git diff --quiet HEAD -- features/hook/lifecycle.feature` exited 0 at each commit (the file was staged whole from the restored copy).

## Verification

- `npx cucumber-js features/hook/lifecycle.feature`: 4 scenarios, 55 steps, all passed on three random-order runs (seed 172476, then two more).
- `npx cucumber-js features/hook`: 24 scenarios, 300 steps passed (seed 213699), so the new file does not leak into its neighbours.
- `npm run check:features`: passed. `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features): passed before each commit.
- Acceptance greps: `^Feature: Hook lifecycle$` 1; `Then the hooks record no runs` 2; `/claude:plugin enable demo@fixtures --scope project` 1, `uninstall` 1, `update` 1; `fresh-guard` 2.

## Decisions Made

- The hooks Given stays in the Background. The writer replaces `hooks/hooks.json` when it runs again, so the update scenario's second table works after it. The plan's fallback, moving the Given into each scenario, was not needed.
- The two runs tables state every column the recorder reports, copied in shape from `features/hook/tool-use.feature`. The table compare is whole, so a run of both `guard` and `fresh-guard` after update would fail.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The worktree had no cucumber peer cache. `node scripts/install-test-peers.mjs` installed it into the worktree's own `node_modules/.cache/optional-peers`, which is not tracked.
- The worktree isolation guard refused compound shell commands that named git, and one heredoc. I split those commands up and used the Edit tool for the negative edits.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-17 is mitigated as planned: the disable and uninstall scenarios prove that no hook of the plugin runs, and the update scenario proves that only the new hook runs.

## Parent lines

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05-09 (the HOOK-09 docs half) can cite these four scenarios. No lifecycle bug showed up, so no fix needs routing to a later wave.
- The HOOK-09 idempotency and concurrency edges stay backstopped by `features/plugin/{disable,enable,state-lock,install-rollback,update-rollback}.feature`, as the plan states.

## Self-Check: PASSED

- FOUND: features/hook/lifecycle.feature
- FOUND commits: ac8a257, a1bde20 (ancestors of HEAD; `git rev-list --count efad8ab..HEAD` = 2 before this SUMMARY commit)

---
*Phase: 05-hooks*
*Completed: 2026-11-01*
