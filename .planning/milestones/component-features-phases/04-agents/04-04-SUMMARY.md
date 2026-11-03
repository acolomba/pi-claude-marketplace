---
phase: 04-agents
plan: 04
subsystem: agents-bridge
tags: [agents, pi-subagents, cucumber, lifecycle]
status: complete

requires:
  - phase: 04-agents
    provides: "plan 04-01's shared agent Givens (seed agent, `has these agents:`, hidden builtins) in features/step_definitions/agent/listing.steps.ts"
  - phase: 01-harness
    provides: profile Pi, scripted model, call log, frozen command and model steps
provides:
  - "features/agent/lifecycle.feature: AGT-07 scenarios (A)-(E) for disable, enable, uninstall, update, and a disable negative control"
affects: [04-05, 04-06]

actuals:
  tokens: 2000
  tasks: 2
  commits: 2
plan_head_before: 51ad1d7cf709171670f07c8fa02ff7f7d6ce8241
plan_head_after: 40644687766e011a14aaf68433f259fe06b78f70

tech-stack:
  added: []
  patterns:
    - "A lifecycle feature whose Background starts the profile Pi with pi-subagents before the install, so every verb runs through a Pi that has the companion"

key-files:
  created:
    - features/agent/lifecycle.feature
  modified: []

key-decisions:
  - "The Background starts the profile Pi with pi-subagents and hides the builtins before the install. Through the shared Pi, the install reports `requires pi-subagents` at warning severity, and `the user has run` accepts only info"

requirements-completed: [AGT-07]

coverage:
  - id: D1
    description: "Disable removes a bridged agent from pi-subagents' list in a new session, and enable restores it"
    requirement: AGT-07
    verification:
      - kind: e2e
        ref: "features/agent/lifecycle.feature#Disabling a plugin removes its agent from pi-subagents' list"
        status: pass
      - kind: e2e
        ref: "features/agent/lifecycle.feature#Enabling a disabled plugin lists its agent again"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uninstall removes the agent, update lists its new description, and disabling one plugin keeps another plugin's agent"
    requirement: AGT-07
    verification:
      - kind: e2e
        ref: "features/agent/lifecycle.feature#Uninstalling a plugin removes its agent from the list"
        status: pass
      - kind: e2e
        ref: "features/agent/lifecycle.feature#Updating a plugin lists the new description of its agent"
        status: pass
      - kind: e2e
        ref: "features/agent/lifecycle.feature#Disabling one plugin keeps another plugin's agent in the list"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-11-01
---

# Phase 4 Plan 04: Agent lifecycle Summary

**`features/agent/lifecycle.feature` checks that every lifecycle verb changes what pi-subagents lists for a bridged agent in a new session. After disable or uninstall, the list reads `Executable agents:\n- (none)`. Enable lists `demo:reviewer` again. Update lists its 1.1.0 description. Disabling `demo` keeps `tools:auditor` listed.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-11-01T16:17:23Z
- **Completed:** 2026-11-01T16:32:06Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- (A) "Disabling a plugin removes its agent from pi-subagents' list" and (B) "Enabling a disabled plugin lists its agent again" (Task 1, tracer).
- (C) "Uninstalling a plugin removes its agent from the list", (D) "Updating a plugin lists the new description of its agent", and (E) "Disabling one plugin keeps another plugin's agent in the list", the negative control (Task 2).
- No product file changed. No scenario found a lifecycle defect.

## Task Commits

1. **Task 1: Disable and enable a plugin and see pi-subagents' list follow** - `93bbf91` (test)
2. **Task 2: Uninstall and update a plugin, and keep another plugin's agent when one is disabled** - `4064468` (test)

## Discrimination runs

Each pin ran once with its verb step removed, then the file was restored. The restored copy is byte-identical to the backup (`cmp`). The actual list text is pi-subagents' own text, taken from the call log.

- **(A) without `disable`:** failed. The list read `Executable agents:\nUser agents\n- demo:reviewer (user, aliases: pi-claude-marketplace-demo-reviewer): Reviews the files it is given.`
- **(B) without `enable`:** failed. The list read `Executable agents:\n- (none)`.
- **(C) without `uninstall`:** failed. The list read `...- demo:reviewer (...): Reviews the files it is given.`
- **(D) without `update`:** failed. The list still read the 1.0.0 description `Reviews the files it is given.`, not `Reviews every changed file.`
- **(E)** is the negative control. It passes, and only `tools:auditor` is listed. So the empty list in (A) comes from disabling `demo`, not from a list that drops every agent.

The empty list text `Executable agents:\n- (none)` was measured: (A) and (C) pass with it.

## Verification

- `npx cucumber-js features/agent/lifecycle.feature` passed 5 scenarios and 76 steps, under the nondac wrapper.
- `npm run check:static` passed before each commit: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features.
- `SKIP=npm-check,trufflehog pre-commit run --files features/agent/lifecycle.feature` passed before each commit. Inside the worktree, prettier and `check:commit` print "(no files to check)", as expected.
- Acceptance greps: `^Feature: Agent lifecycle$` gives 1 and `Background:` gives 1. Each of the three Task 2 scenario titles matches exactly one line (54, 69, 90).

## Decisions Made

- The Background holds the profile Pi with pi-subagents and `pi-subagents hides its builtin agents`. Every scenario needs both, so the Background rule holds. See Deviation 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The Background install cannot run through the shared Pi**
- **Found during:** Task 1
- **Issue:** The plan installs `demo` through the shared Pi and starts the profile Pi in each scenario. The shared Pi does not load pi-subagents, so the install reports `requires pi-subagents` at `warning` severity. `Given the user has run` requires every payload to be info, so both scenarios failed in the Background.
- **Fix:** The profile Pi Given (with `pi-subagents`) and the hidden-builtins Given moved to the top of the Background, before the install. `features/agent/listing.feature` uses the same order. Each verb now runs through the profile Pi. The new session after the verb still rebuilds pi-subagents' list and the parent's catalog.
- **Files modified:** features/agent/lifecycle.feature
- **Verification:** All five scenarios pass, and each pin fails without its verb.
- **Committed in:** 93bbf91

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Steps only moved into the Background, and every scenario still proves what its title says. Scenario (E) installs `tools` through the profile Pi as well.

## Issues Encountered

None beyond Deviation 1.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-11 is covered: (A) and (C) prove that a disabled or uninstalled plugin's agent leaves pi-subagents' list in a new session. T-04-SC is accepted: this plan installs no package.

## User Setup Required

None - no external service configuration required.

## Parent lines

- None for CHANGELOG or README. This plan adds only a behavioral feature and changes no user-visible behavior.
- Planning note: the `<interfaces>` block of `04-04-PLAN.md` says the Background install runs through the shared Pi. That does not hold for agents: without pi-subagents, an install warns. Later agent features should start the profile Pi before installing.

## Next Phase Readiness

AGT-07 is pinned for disable, enable, uninstall, and update, with a negative control. The scenarios check only what pi-subagents lists, never the bytes of the generated agent file. So plan 04-02's converter changes, such as the `async` line, do not affect them.

## Self-Check: PASSED

- FOUND: features/agent/lifecycle.feature
- FOUND commits: 93bbf91, 4064468 (both ancestors of HEAD; `git rev-list --count 51ad1d7..HEAD` = 2 before this SUMMARY commit)
- No commit deleted a file.

## Dubious Choices

- **The profile Pi and hidden builtins moved into the Background** (Deviation 1), against the plan's "install through the shared Pi" Background. Every verb therefore runs through a Pi that has pi-subagents loaded. The plan wanted that Pi only for the list.
- **The update scenario replaces `reviewer.md` with the `has these agents:` table** (`name`, `description`, `body` columns), not the seed Given. The plan asks for this. The new body is `Review every changed file and report every problem you find.`, and no scenario observes it.
- **The scripted model's closing replies** ("No agent is listed.", "One agent is listed.") are free text. The call-log comparison does not check them, because the last model call is not compared beyond call 2.
- **The table aligner is a scratch script**, not a repo tool. No Gherkin formatter exists in the repo, and prettier does not cover `.feature` files.
