---
phase: 01-suite-foundation
plan: 01
subsystem: testing
tags: [cucumber, step-definitions, layout, features]

requires: []
provides:
  - "Plugin topic module features/step_definitions/plugin/installation.steps.ts (step: the {word} scope has no installed plugins)"
  - "Top-level git host step module features/step_definitions/git-host.steps.ts (six git host steps, unchanged)"
  - "Cucumber skill layout rule '## Parallel work': file ownership for parallel streams and reserved verb module names"
affects: [01-suite-foundation, plugin-enable-disable, install, git-source, rollback, uninstall, update, reinstall, list, info, pending, reconcile, fetch, prune, import, bootstrap, state-lock]

actuals:
  tokens: 3183
  tasks: 3
  commits: 3
plan_head_before: 537454bd6ae9faa58a62e46ca055b4309eab952a
plan_head_after: e41ee9e4e2f8546224555fc458b4990da738923d

tech-stack:
  added: []
  patterns:
    - "Plugin topic modules live under features/step_definitions/plugin/ and never take a verb name"
    - "Steps about a shared stand-in (the git host) sit at the top level of step_definitions, not under one function"

key-files:
  created:
    - features/step_definitions/plugin/installation.steps.ts
    - features/step_definitions/git-host.steps.ts
  modified:
    - .agents/skills/cucumber/rules/layout.md

key-decisions:
  - "The plugin topic module is named installation: its step reads a plugin's installation, and the name is not a reserved verb"
  - "Step module moves are rename-only commits (only the import paths the new depth forces change), so git log --follow keeps history (D-08)"

patterns-established:
  - "Parallel work: foundation owns shared files and topic modules; each stream adds only its own feature files and verb modules; a step a second stream needs moves to a topic module in a follow-up commit"

requirements-completed: [FND-01, FND-02]

coverage:
  - id: D1
    description: "Plugin steps moved to features/step_definitions/plugin/installation.steps.ts; plugin.steps.ts removed; install.feature still passes"
    requirement: FND-01
    verification:
      - kind: other
        ref: "npm run check:features"
        status: pass
      - kind: integration
        ref: "npx cucumber-js features/plugin/install.feature (11 scenarios passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Git host steps moved to features/step_definitions/git-host.steps.ts; only one module registers their text; the five git-source marketplace features still pass"
    requirement: FND-01
    verification:
      - kind: other
        ref: "npm run check:features"
        status: pass
      - kind: integration
        ref: "npx cucumber-js features/marketplace/{git-source,github-source,url-source,url-source-update,unsupported-source}.feature (60 scenarios passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cucumber skill layout.md gains a '## Parallel work' section with the ownership rule and reserved verb module names"
    requirement: FND-01
    verification:
      - kind: other
        ref: "SKIP=npm-check pre-commit run --files .agents/skills/cucumber/rules/layout.md && grep -c '^## Parallel work$' .agents/skills/cucumber/rules/layout.md"
        status: pass
    human_judgment: true
    rationale: "Whether the rule text reads clearly and matches the intended ownership model is a wording judgment no check asserts"
  - id: D4
    description: "The usage gate stays green after each commit"
    requirement: FND-02
    verification:
      - kind: other
        ref: "npm run check:features after each task; commit hook npm run check:commit passed on both build-input commits"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 01: Step Module Moves and Parallel-Work Ownership Rule Summary

**Plugin steps moved to the `plugin/installation.steps.ts` topic module, git host steps lifted to `step_definitions/git-host.steps.ts`, both as rename-only commits, and the cucumber layout rules now say who owns each file when streams run in parallel.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-23T02:24:40Z
- **Completed:** 2026-10-23T02:33:34Z
- **Tasks:** 3
- **Files modified:** 3 (two renames, one doc edit)

## Accomplishments

- `features/step_definitions/plugin.steps.ts` is now `features/step_definitions/plugin/installation.steps.ts`, so plugin verb modules can sit beside it without tripping the "module beside its own directory" layout finding.
- `features/step_definitions/marketplace/git-host.steps.ts` is now `features/step_definitions/git-host.steps.ts`, ready to serve plugin repositories as well as marketplaces; exactly one module registers each git host step.
- `.agents/skills/cucumber/rules/layout.md` has a `## Parallel work` section: foundation ownership of shared files, streams add only their own feature files and verb modules, the follow-up-commit rule for a step a second stream needs, and the reserved verb module names (`install` ... `state-lock` under `plugin/`, `remove` under `marketplace/`).

## Task Commits

1. **Task 1: Move the plugin steps into the plugin topic module installation.steps.ts** - `2d79b1b6` (test) -- hook: `npm run check:commit` Passed, gitlint Passed
2. **Task 2: Move the git host steps to the top level of step_definitions** - `3aee072d` (test) -- hook: `npm run check:commit` Passed, gitlint Passed
3. **Task 3: State in the cucumber skill who owns each file when streams run in parallel** - `e41ee9e4` (docs) -- hook: `npm run check:commit` Skipped (layout.md is not a build input), mdformat/markdownlint/gitlint Passed

Each git commit hook (`git show -M --name-status`) shows a single `R` entry for Tasks 1 and 2 (R095 and R096: the rename plus the two import-path lines).

## Files Created/Modified

- `features/step_definitions/plugin/installation.steps.ts` - plugin installation topic module (moved; imports now `../../lib/field-rows.ts`, `../../support/world.ts`)
- `features/step_definitions/git-host.steps.ts` - git host steps (moved; imports now `../lib/https-git-host/server.ts`, `../support/world.ts`)
- `.agents/skills/cucumber/rules/layout.md` - new `## Parallel work` section between "Vertical functions" and "Boundaries"

## Decisions Made

- Named the topic module `installation` (what the step reads), not a reserved verb name.
- Kept every step text, body, and `@fileoverview` unchanged in both moves; the git host plan rewrites them later.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Tracer gate after Task 1: re-ran `npm run check:features` and `npx cucumber-js features/plugin/install.feature` after the commit (11/11 scenarios passed) before expanding.

## Plan-level Verification

- `npm run check:features` exits 0 on the final tree.
- `npx cucumber-js` over `features/plugin/install.feature` and the five git-source marketplace features: 71 scenarios passed, 654 steps passed.
- `git log --oneline -3` shows two move-only commits and one docs commit.

## Bug Candidates

None found.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- Later Phase 1 plans can add plugin topic modules under `features/step_definitions/plugin/` and extend `features/step_definitions/git-host.steps.ts` for plugin repositories.
- `npm run check` (the phase gate) was not run here; the per-commit hook and `check:features` were.

## Self-Check: PASSED

- FOUND: features/step_definitions/plugin/installation.steps.ts
- FOUND: features/step_definitions/git-host.steps.ts
- FOUND: .agents/skills/cucumber/rules/layout.md
- FOUND: 2d79b1b6, 3aee072d, e41ee9e4 (ancestors of HEAD)

---
*Phase: 01-suite-foundation*
*Completed: 2026-10-23*
