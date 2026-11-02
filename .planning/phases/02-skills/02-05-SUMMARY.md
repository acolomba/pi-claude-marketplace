---
phase: 02-skills
plan: 05
subsystem: skills-bridge
tags: [skills, cucumber, lifecycle, disable, enable, uninstall, update, scripted-model]

requires:
  - phase: 02-skills
    provides: "02-01's shared skill Givens (`... has the skill ... described as ... with this body:` and `... has the skill ... with this skill file:`)"
provides:
  - "features/skill/lifecycle.feature: six SKL-06 scenarios for disable, enable, uninstall, and update of a bridged skill, observed in a new session and in what the scripted model receives"
affects: [02-06, 02-07]

actuals:
  tokens: 1100
  tasks: 2
  commits: 2
plan_head_before: bdf71986c61d5d8b26aa9ef9505595fecc4f6677
plan_head_after: 0610b958fcf4f37d970a1407825272ced3403b06

tech-stack:
  added: []
  patterns:
    - "A Background install through the run's Pi, then `pi runs with the scripted model` in the scenario: the profile Pi shares the sandbox and sees the install"

key-files:
  created:
    - features/skill/lifecycle.feature
  modified: []

key-decisions:
  - "The Background holds the install for every scenario, including the two scripted-model ones; the profile Pi started after it sees the install, so the plan's fallback (install Givens per scenario) was not needed."
  - "The update scenarios re-offer `demo` 1.1.0 and replace `skills/greet/SKILL.md` before the update; the default skill row then reads `A skill of demo 1.1.0.`."

patterns-established:
  - "Lifecycle pins get a temporary negative edit per scenario, recorded with its failing output, then reverted"

requirements-completed: [SKL-06]

coverage:
  - id: D1
    description: "After disable, a new session offers none of the plugin's skills, and /skill:demo-greet reaches the model as the typed text"
    requirement: SKL-06
    verification:
      - kind: e2e
        ref: "features/skill/lifecycle.feature#Disabling a plugin removes its skills from a new session"
        status: pass
      - kind: e2e
        ref: "features/skill/lifecycle.feature#A disabled plugin's skill reaches the model as the typed text"
        status: pass
    human_judgment: false
  - id: D2
    description: "After enable on a disabled plugin, a new session offers its skills again with their descriptions"
    requirement: SKL-06
    verification:
      - kind: e2e
        ref: "features/skill/lifecycle.feature#Enabling a disabled plugin offers its skills again"
        status: pass
    human_judgment: false
  - id: D3
    description: "After uninstall, a new session offers no skill of the plugin"
    requirement: SKL-06
    verification:
      - kind: e2e
        ref: "features/skill/lifecycle.feature#Uninstalling a plugin removes its skills from a new session"
        status: pass
    human_judgment: false
  - id: D4
    description: "After update, a new session lists the skill's new description and /skill:demo-greet sends the model the new body in Pi's skill block"
    requirement: SKL-06
    verification:
      - kind: e2e
        ref: "features/skill/lifecycle.feature#Updating a plugin lists the new description of its skill"
        status: pass
      - kind: e2e
        ref: "features/skill/lifecycle.feature#Updating a plugin sends the model the new body of its skill"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-11-01
status: complete
---

# Phase 2 Plan 05: Skill lifecycle Summary

**`features/skill/lifecycle.feature` pins SKL-06 for a skill with its own description and body: disable and uninstall remove it from a new session (and after disable `/skill:demo-greet` reaches the model as plain text), enable restores it, and update replaces both the listed description and the body the model receives.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-11-01T10:07:50Z
- **Completed:** 2026-11-01T10:20:30Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- `Feature: Skill lifecycle`, with a Background that publishes `demo` 1.0.0 with the skill `greet` (`Greets a person by name.`), adds the marketplace to the project scope, and installs with `--scope project`.
- Six scenarios, one `When` each:
  1. Disabling a plugin removes its skills from a new session.
  2. A disabled plugin's skill reaches the model as the typed text.
  3. Enabling a disabled plugin offers its skills again.
  4. Uninstalling a plugin removes its skills from a new session.
  5. Updating a plugin lists the new description of its skill.
  6. Updating a plugin sends the model the new body of its skill.
- The feature description states that changes apply at a new session, as Pi's `/reload` does (D-CF2-11, NFR-2 as amended by APL-D2).
- Every invocation types no arguments, so the expected text holds with or without 02-03's substitution.
- No product change was needed. All scenarios pass at HEAD.

## Task Commits

1. **Task 1: A disabled plugin's skill is gone from a new session and from what the model receives** (tracer) - `3dec4fa` (test)
2. **Task 2: Enable restores, uninstall removes, and update replaces a skill's description and body** - `0610b95` (test)

Tracer gate (Task 1): auto-continue path; the `<verify>` re-ran green (`npx cucumber-js features/skill/lifecycle.feature`: 2 scenarios passed; `npm run check:features`: exit 0) before Task 2 began.

## Negative-edit evidence

Each scenario pins existing behavior, so each was proven by a temporary edit to its expected outcome. The file was restored from a saved copy after each round. After the restore, `npx cucumber-js features/skill/lifecycle.feature` passed every scenario, and the committed file matches the saved good copy (`git diff --quiet HEAD -- features/skill/lifecycle.feature` exits 0 after each commit).

**Task 1 round** (scenario 1 expects `/skill:demo-greet` and `/skill:demo-skill` listed after disable; scenario 2 expects Pi's skill block): 2 scenarios failed.

```text
1) Disabling a plugin removes its skills from a new session # features/skill/lifecycle.feature:19
     Then the session offers these skills: # features/step_definitions/session.steps.ts:142
       AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
       + actual - expected
         [
           [ 'command', 'description' ],
       -   [ '/skill:demo-greet', 'Greets a person by name.' ],
       -   [ '/skill:demo-skill', 'A skill of demo 1.0.0.' ]
         ]
2) A disabled plugin's skill reaches the model as the typed text # features/skill/lifecycle.feature:27
     Then the model receives these calls: # features/step_definitions/model.steps.ts:68
       AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
       +     '/skill:demo-greet'
       -     '<skill name="demo-greet" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-greet/SKILL.md">\n' +
       -       'References are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-greet.\n' +
       -       '\n' +
       -       'Greet the person named in the arguments.\n' +
```

**Task 2 round** (enable expects no skills; uninstall expects `/skill:demo-greet` listed; update listing expects the old description; update body expects the old body): `6 scenarios (2 passed, 4 failed)`.

```text
1) Enabling a disabled plugin offers its skills again # features/skill/lifecycle.feature:36
     AssertionError: + [ { command: '/skill:demo-greet', description: 'Greets a person by name.' },
                         { command: '/skill:demo-skill', description: 'A skill of demo 1.0.0.' } ]
                     - []
2) Uninstalling a plugin removes its skills from a new session # features/skill/lifecycle.feature:42
     AssertionError: -   [ '/skill:demo-greet', 'Greets a person by name.' ]
3) Updating a plugin lists the new description of its skill # features/skill/lifecycle.feature:49
     AssertionError: +     'Greets someone warmly.'
                     -     'Greets a person by name.'
4) Updating a plugin sends the model the new body of its skill # features/skill/lifecycle.feature:69
     AssertionError: +       'Greet the person warmly.\n' +
                     -       'Greet the person named in the arguments.\n' +
```

## Files Created/Modified

- `features/skill/lifecycle.feature` - `Feature: Skill lifecycle`, the six SKL-06 scenarios.

## Decisions Made

- The Background holds the install for all six scenarios. The two scripted-model scenarios start the profile Pi after it. The profile Pi runs in the same sandbox and loads the recorded install, so the plan's fallback (install Givens in each scenario, no Background) was not needed.
- The disabled-skill call table lists only the text `/skill:demo-greet`. Pi passes a `/skill:` name it has not loaded to the model unchanged.
- The update body scenario expects Pi's whole block with no trailing argument text, because nothing was typed after the name.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The worktree guard refused compound shell commands that name `git rev-parse --git-dir`. So the plan commit ledger (protocol 0c) was kept as a file in this agent's scratch folder rather than under the git directory. `commits:` was measured with `git rev-list --count bdf7198..HEAD` (2).
- `prettier` infers no parser for `.feature` files. The pre-commit `prettier` hook skips them. Table alignment was done by hand, and `npm run check:features` passed.
- Gherkin `.feature` files are not build inputs for the `npm-check` hook, so `npm run check:commit` was skipped on both commits. `npm run check:features` and the feature run were done by hand before each commit.

## Requirements

SKL-06 is listed in `requirements-completed`. `REQUIREMENTS.md` was not changed: 02-07 (the gate plan) also declares SKL-06 and has no SUMMARY yet, so the shared-ID gate keeps SKL-06 open. The alias half of D-CF2-11 (an alias after disable and enable) belongs to 02-06.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-02-15 (mitigate): disable and uninstall scenarios prove that the skill is unlisted and that `/skill:demo-greet` reaches the model as text after disable.

## Dubious Choices

1. **Idempotency and concurrency edges not re-proved here.** As the plan's must-haves direct, they are left to `features/plugin/{disable,enable}.feature`, `features/plugin/state-lock.feature`, the rollback features, and `test/integration/concurrent-install.test.ts`.
2. **Uninstall's model-side effect is not checked.** Only the listing is checked after uninstall. The disable scenario covers the "typed text reaches the model" path for an unloaded skill. The plan lists no uninstall model scenario.
3. **The update scenarios re-offer the whole plugin at 1.1.0.** The fixture writer rewrites the default skill, so the default row changes to `A skill of demo 1.1.0.` as well. Both rows are compared.
4. **The Task 1 tracer gate ran on the auto path.** The verify re-ran green, and no checkpoint was raised. This is an unattended run, and the task carries no `gate` attribute.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 02-06 can add the alias-after-disable/enable scenarios next to this feature, and can reuse its Background.
- 02-07 (gate) can count SKL-06's listing and model-side evidence from this feature.

## Self-Check: PASSED

- `features/skill/lifecycle.feature` exists.
- Commits `3dec4fa` and `0610b95` are on this branch.
- Acceptance greps: `^Feature: Skill lifecycle$` 1; `Then the session offers no skills` 2; `Greets someone warmly.` 3; `Greet the person warmly.` 3; `enable demo@fixtures --scope project` 1; `uninstall demo@fixtures --scope project` 1.
- `npx cucumber-js features/skill/lifecycle.feature`: 6 scenarios (6 passed); `npm run check:features`: exit 0.

---
*Phase: 02-skills*
*Completed: 2026-11-01*
