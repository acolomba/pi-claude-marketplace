---
phase: 02-skills
plan: 02
subsystem: skills-bridge
tags: [skills, cucumber, frontmatter, dropped-fields, system-prompt]

requires:
  - phase: 02-skills
    provides: "02-01: the skill-file Given, the stageSkill helper, and the stored skill record"
provides:
  - "features/skill/frontmatter.feature: the SKL-02 scenarios (dropped fields, disable-model-invocation, user-invocable false, frontmatter name)"
  - "features/step_definitions/skill/frontmatter.steps.ts: Then the model call {int} lists these skills in its system prompt:"
  - "bridges/skills/stage.ts: one D-CF2-08 discovery warning per parsed or repaired skill that sets a D-CF1-05 field"
affects: [02-07]

actuals:
  tokens: 7500
  tasks: 3
  commits: 4
plan_head_before: bdf71986c61d5d8b26aa9ef9505595fecc4f6677
plan_head_after: e67406c7f29c4c901a72fa680b2138e3e18c35f7

tech-stack:
  added: []
  patterns:
    - "A skill-owned Then parses only the <available_skills> block of a model call's system prompt, unescaping Pi's XML escaping, and fails on a missing or malformed block"

key-files:
  created:
    - features/skill/frontmatter.feature
    - features/step_definitions/skill/frontmatter.steps.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - test/bridges/skills/stage.test.ts

key-decisions:
  - "The dropped-fields line is read from the parse that the PARSE-01 gate returned (source bytes, or the SKFM-01 repaired bytes), before the SK-3 name rewrite, and is tagged discoveryWarning so a standalone install shows it."
  - "The staged result's warnings are the discovery warnings first, then the dropped-fields lines in discovery (skill) order."
  - "The system-prompt skills step lives in a new skill/frontmatter.steps.ts module with a module-private parser, since only this feature uses it."

patterns-established:
  - "stagedSkillWarnings(t, sources) test helper stages several skill directories of one plugin and returns the whole warnings array with the skills directory"

requirements-completed: [SKL-02]

coverage:
  - id: D1
    description: "A standalone install of a skill that sets fields Pi cannot honor names those fields in one diagnostic line per skill, in frontmatter key order"
    requirement: SKL-02
    verification:
      - kind: e2e
        ref: "features/skill/frontmatter.feature#Installing a skill that sets fields pi cannot honor reports them"
        status: pass
      - kind: e2e
        ref: "features/skill/frontmatter.feature#A skill that sets every field pi cannot honor reports them in its frontmatter order"
        status: pass
      - kind: unit
        ref: "test/bridges/skills/stage.test.ts#D-CF2-08: follows the discovery warnings with each skill's dropped fields in skill order"
        status: pass
      - kind: unit
        ref: "test/bridges/skills/stage.test.ts#D-CF2-08: reports the dropped fields of a skill whose frontmatter was repaired"
        status: pass
    human_judgment: false
  - id: D2
    description: "No dropped-fields line for a skill that sets none of the eight fields, for allowed-tools/arguments/shell/user-invocable, or for a degraded (unparseable) skill"
    requirement: SKL-02
    verification:
      - kind: e2e
        ref: "features/skill/frontmatter.feature#A skill that sets only fields pi honors or that have their own decision reports no dropped field"
        status: pass
      - kind: unit
        ref: "test/bridges/skills/stage.test.ts#D-CF2-08: reports no dropped fields for a skill whose frontmatter does not parse"
        status: pass
      - kind: unit
        ref: "test/bridges/skills/stage.test.ts#D-CF2-08: reports nothing for a skill that sets none of the dropped fields"
        status: pass
    human_judgment: false
  - id: D3
    description: "A disable-model-invocation skill stays listed, runs on /skill:, and is absent from the model's <available_skills> list while its sibling is present"
    requirement: SKL-02
    verification:
      - kind: e2e
        ref: "features/skill/frontmatter.feature#A skill that disables model invocation stays listed"
        status: pass
      - kind: e2e
        ref: "features/skill/frontmatter.feature#A skill that disables model invocation runs on its slash command and is left out of the model's skill list"
        status: pass
    human_judgment: false
  - id: D4
    description: "A user-invocable false skill stays listed and runs on /skill: (D-CF1-09 divergence); a skill whose frontmatter name differs is listed under its directory name"
    requirement: SKL-02
    verification:
      - kind: e2e
        ref: "features/skill/frontmatter.feature#A skill that is not user-invocable stays listed, because pi cannot hide a skill's slash command"
        status: pass
      - kind: e2e
        ref: "features/skill/frontmatter.feature#A skill that is not user-invocable runs on its slash command, because pi cannot hide a skill's slash command"
        status: pass
      - kind: e2e
        ref: "features/skill/frontmatter.feature#A skill is listed under its directory name when its frontmatter names it otherwise"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-11-01
status: complete
---

# Phase 2 Plan 02: Skill frontmatter Summary

**A standalone install now names, per skill, every D-CF1-05 frontmatter field Pi cannot honor (`[review] dropped fields: model, effort`) as a discovery diagnostic, and eight cucumber scenarios pin `disable-model-invocation`, `user-invocable: false`, and frontmatter `name` through Pi's listing, the install result, and the model's system-prompt skill list.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-11-01T10:07:19Z
- **Completed:** 2026-11-01T10:33:11Z
- **Tasks:** 3
- **Files modified:** 4 (2 created)

## Accomplishments

- `stage.ts`: `stageSkill` calls `droppedInvocationFieldsWarning(skill.sourceName, parsed.frontmatter)` on the parsed and repaired arms; `prepareStageSkills` returns `[...discoverWarnings, ...droppedFieldLines].map(discoveryWarning)`. The noop arm is unchanged (no skill is staged there).
- `features/skill/frontmatter.feature` (`Feature: Skill frontmatter`): 8 scenarios, every expected value a whole literal, every listing table stating every row (default `demo-skill` included).
- New step: `Then the model call {int} lists these skills in its system prompt:` (columns `name`, `description`, `location`).
- Four D-CF2-08 unit cases in `test/bridges/skills/stage.test.ts`, each asserting the whole `warnings` array (or the whole result for the degraded arm).

## Task Commits

1. **Task 1 (tracer): report the fields Pi cannot honor on install**
   - `f33fca0` test(skills): expect install to report skill fields pi cannot honor (RED)
   - `f1faa60` feat(skills): report skill frontmatter fields pi cannot honor (GREEN)
2. **Task 2: pin the full field list, order, and the never-reported fields** - `8d72619` (test)
3. **Task 3: pin disable-model-invocation, user-invocable false, and frontmatter name** - `e67406c` (test)

Tracer gate: after `f1faa60`, the Task 1 `<verify>` (unit cases, direct coverage of `stage.ts`, the feature, `fallow dupes`) re-ran green before Task 2 started.

## Red proof (Task 1)

`npx cucumber-js features/skill/frontmatter.feature` with the corrected expected table, against `stage.ts` without the fix, exit 1:

```text
Failed scenarios:
  1) Installing a skill that sets fields pi cannot honor reports them # features/skill/frontmatter.feature:6
       Then the command reports these results: # features/step_definitions/command.steps.ts:124
           AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
           + actual - expected
             [
               [
                 'kind',
                 'severity',
                 'needs reload',
           -     'header',
           -     'lines'
               ],
               [
                 'cascade',
                 'info',
                 'true',
           -     '',
           -     ''
               ],
           -   [
           -     'diagnostic',
           -     'warning',
           -     'false',
           -     'Plugin "demo" [project] installed; 1 declared component has a note.',
           -     '[review] dropped fields: model, effort'
           -   ]
             ]
1 scenario (1 failed)
9 steps (7 passed, 1 skipped, 1 failed)
```

Semantic assessment: every Given and the install ran; the scenario failed only on the planned assertion, the missing diagnostic row. After `f1faa60` it passes. The RED commit `f33fca0` carried a first guess for the cascade row (`warning`, with a summary); that run failed on the same missing diagnostic plus the wrong guess, and `f1faa60` corrected the cascade row to `info` (the install outcome is a success; only the diagnostic carries `warning`). The red run above repeats the proof with the corrected table. The `check tdd-red-evidence` classifier has no cucumber adapter, so it was not run.

Unit red: the hook rejects a commit with failing staged-pair tests, so the unit cases landed with the fix. Reverting `stage.ts` alone made 2 of the 3 Task 1 cases fail (`follows the discovery warnings ...`, `... frontmatter was repaired`); the `reports nothing` case passes on both trees by design.

Task 2 and Task 3 pin behavior Task 1 shipped or Pi already has, so their scenarios passed on first run. Negative-edit proof for the new step: flipping the second scenario's `disable-model-invocation` to `false` made `the model call 1 lists these skills in its system prompt:` fail with an extra `demo-hidden` row.

## Step text added

- `Then the model call {int} lists these skills in its system prompt:` — finds call `<n>` of the last turn via `modelCallsOf(this.requireTurn().logs)` (fails when absent), parses the `<available_skills>` block of its `systemPrompt` with a module-private sticky-regex parser that unescapes `&lt; &gt; &quot; &apos; &amp;` and fails on a missing, unterminated, or malformed block, projects each location with `projectTokens("text", ...)`, compares `table.raw()` whole, and calls `this.markTurnCompared()`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/skills/stage.ts` - D-CF2-08 dropped-fields discovery warning.
- `test/bridges/skills/stage.test.ts` - `stagedSkillWarnings` helper and four D-CF2-08 cases.
- `features/skill/frontmatter.feature` - new, 8 scenarios.
- `features/step_definitions/skill/frontmatter.steps.ts` - new, the system-prompt skills Then.

## Decisions Made

- The warning is computed from the PARSE-01 gate's parse, before the SK-3 name rewrite; for a repaired skill that parse is of the SKFM-01 repaired bytes, whose keys equal the source's.
- Discovery warnings come first, then dropped-fields lines in skill order, matching the plan's behavior row.
- The unit cases spell the expected entries as `{ kind: "discovery", message: ... }` literals (equal to `discoveryWarning(...)`), because the unit-test rules forbid computing expected values with production code.

## Deviations from Plan

None in scope or files: every edit is in the plan's `files_modified`. Two execution notes:

- The first RED commit's expected cascade row was wrong (see Red proof); fixed in the GREEN commit.
- The first `git commit` attempt was killed by the OOM killer inside the hook's parallel `lint` (4 GB free, other worktree agents running); running `npm run lint` alone warmed the ESLint cache and the retried commit passed the hook. No check was skipped.

**Total deviations:** 0 auto-fixed. **Impact on plan:** none.

## Issues Encountered

- Memory pressure from parallel agents (see above).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Parent lines

- The dropped-fields line is a discovery warning on every staging verb, so `update`, `reinstall`, `enable`, `apply`, and the marketplace cascades also show it; only `install` is scenario-proven.
- Plan 02-03 (parallel): the invocation scenarios here type no arguments, so their expected `<skill>` blocks end at `</skill>`; if 02-03's substitution appends anything for an argument-less invocation, these two rows change.
- Gate plan: the full `npm run check` was not run in this worktree (wave gate owns it); `check:commit` passed on every commit, and `features/skill/` plus `features/plugin/staging-warnings.feature` (39 scenarios) pass.

## Dubious Choices

1. **RED commit with a wrong cascade guess:** `f33fca0` expected a `warning` cascade with a summary; the real cascade is `info`. Corrected in `f1faa60`; the red proof was re-run against the unfixed code with the corrected table.
2. **No TAP RED for unit cases:** they were committed with the fix (the hook blocks failing pair tests); discrimination was shown by reverting `stage.ts` locally.
3. **D-CF1-09 named in scenario titles, not by ID:** the two `user-invocable: false` titles end "because pi cannot hide a skill's slash command"; feature files carry no decision IDs.
4. **Case-sensitive field names** (the plan's flagged assumption): `Model:` is not reported; not probed upstream.
5. **The system-prompt step fails when Pi writes no `<available_skills>` block** (every skill hidden); a scenario needing that state would need its own step.
6. **Non-install verbs unproven:** the line rides every staging verb's discovery channel (Parent lines), proven only for `install`.
7. **Fixture value choices:** `hooks: {}`, `paths: src/**`, `context: fork`, and the like in the all-eight scenario are arbitrary valid YAML; the core reads keys only, so values do not matter (empty/null values are pinned by `test/domain/invocation-frontmatter.test.ts`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SKL-02 is covered end to end; ready for the gate plan.

## Self-Check: PASSED

- Files exist: `features/skill/frontmatter.feature`, `features/step_definitions/skill/frontmatter.steps.ts`, `extensions/pi-claude-marketplace/bridges/skills/stage.ts`, `test/bridges/skills/stage.test.ts`.
- Commits `f33fca0`, `f1faa60`, `8d72619`, `e67406c` are on this branch (`git rev-list --count bdf7198..HEAD` = 4).
- Acceptance greps: `droppedInvocationFieldsWarning(` in stage.ts 1; `[review] dropped fields: model, effort` 1; `[audit] dropped fields: paths, hooks, background, context, agent, effort, model, disallowed-tools` 1; `lists these skills in its system prompt:` in the step module 1; `disable-model-invocation: true` 2; `/skill:demo-fancy` 0; `/skill:demo-review` 1.
- Plan verification: `npx cucumber-js features/skill/frontmatter.feature` 8/8 passed; `node --test test/bridges/skills/stage.test.ts` passed; `npm run test:coverage:direct -- .../skills/stage.ts` exit 0; `npm run check:features` exit 0; `npx fallow dupes --fail-on-issues --format human --quiet` exit 0; `npx eslint features/step_definitions/skill/frontmatter.steps.ts --max-warnings 0` exit 0.

---
*Phase: 02-skills*
*Completed: 2026-11-01*
