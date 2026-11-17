---
phase: 11-skills-commands-and-records
plan: "05"
subsystem: mentions
status: complete
tags: [mentions, skills, PG-SKILL-01, D-PG11-02, D-PG11-05, D-PG11-07, D-PG11-08, D-PG11-13]
requires:
  - 11-04 (orchestrators/mention-attachments.ts)
provides:
  - SkillInvocationDependencies.mentions (required member) and the attachment in fillSkill, inside the skill block
affects:
  - the PG-DOC-01 page of the last plan, which cites the two new skill scenarios
tech-stack:
  added: []
  patterns:
    - the second caller of appendMentionedFiles; no copy of its scan, reads, or append
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
    - test/orchestrators/skill-invocation.test.ts
    - features/skill/invocation.feature
decisions:
  - "The scan input is `substituteArguments({ body, args: undefined, argumentNames: [], variables })`, the same shape as `renderCommand`; `invocationVariables` is computed once and shared by both calls."
requirements-completed: []
metrics:
  duration: ~25m
  completed: 2026-11-15
actuals:
  tokens: 6500
  tasks: 2
  commits: 2
plan_head_before: 0731b8989a0cb2f0eeb23d89cddd7f43d14766c0
plan_head_after: da668f13a62feb97bf0d51bf4b1eb492dff1f381
---

# Phase 11 Plan 05: Attach the files a typed skill's body mentions Summary

A typed skill, by `/skill:<name>` or by an alias, now sends each qualifying file that its body
mentions inside Pi's skill block: after the rendered body and a blank line, and before the
closing `</skill>` line. The mentions come from the trimmed body with only its variables filled,
and the files are read through `appendMentionedFiles` after the `!` commands ran. `fillSkillRead`
and `skillBlock` are unchanged, so the model's own read of a staged `SKILL.md` attaches nothing.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 11-05-01 | 29ccd055 | feat(skills): attach the files a skill body mentions |
| 11-05-02 | da668f13 | test(skills): guard file mentions from typed arguments |

## Lines for later plans

`SkillInvocationDependencies.mentions`: `MentionFileReader`, required; `DEFAULT_DEPENDENCIES`
sets `NODE_MENTION_FILE_READER`. The edge callers (`edge/skill-aliases.ts`, `edge/skill-read.ts`)
pass no dependencies and are unchanged.

New scenarios in `features/skill/invocation.feature`:

| Line | Title |
| --- | --- |
| 350 | A skill attaches the file that its body mentions when the user types its alias (PG-SKILL-01) |
| 375 | A file that a typed argument mentions is not attached to a skill (PG-SKILL-01) |

## Red run (Task 1, before the change)

`npx cucumber-js --profile adapter --name "(PG-SKILL-01)" features/skill/invocation.feature` with
only the new scenario added: `1 scenario (1 failed)`, exit 1, at `Then the model receives these
calls:`. Actual: the skill block with `Follow @{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-review/role.md`
and then `\n</skill>`. Expected: the same body, then `\n\n<file name="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-review/role.md">\nReview as a careful editor.\n</file>\n</skill>`.
After the change: `1 scenario (1 passed)`.

## Guard proof (Task 2)

1. On the Task 1 code: `2 scenarios (2 passed)`.
2. Temporary edit in `orchestrators/skill-invocation.ts`: the `appendMentionedFiles` call took
   `{ authored: substituted, ... }` (the text with the arguments filled in as the scan input).
   Result `2 scenarios (1 passed, 1 failed)`, exit 1. "A file that a typed argument mentions is
   not attached to a skill" (line 375) failed at `Then the model receives these calls:`: the
   actual text held `<file name="{home}/marketplaces/fixtures/plugins/demo/templates/x.md">\nCheck the spelling.\n</file>`
   before `</skill>`. Restored with `git checkout -- extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts`.
3. After the restore: `git diff --quiet HEAD -- extensions` exit 0, and `2 scenarios (2 passed)`.

## Verification

- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/skill-invocation.test.ts test/orchestrators/mention-attachments.test.ts`: 79 tests, 79 pass.
- Callers outside the plan's files: `test/edge/skill-aliases.test.ts`, `test/edge/skill-read.test.ts` with the owner test, 107 tests, 107 pass.
- `npm run test:coverage:direct --` for `orchestrators/skill-invocation.ts` and `orchestrators/mention-attachments.ts`: exit 0 each.
- `npm run test:cucumber:profile -- --profile adapter features/skill/invocation.feature features/skill/model-reads.feature` (after Task 1): 25 scenarios (25 passed).
- `npm run test:cucumber:profile -- --profile adapter features/skill/invocation.feature` (after Task 2): 20 scenarios (20 passed).
- `npm run typecheck && npm run lint && npm run fallow && npm run check:features`: exit 0 (after the import-order fix below).
- `git diff --quiet 0731b898 -- orchestrators/mention-attachments.ts domain edge bridges`: exit 0.
- Both commits passed the hook (`npm run check:commit` Passed). `npm run check` was not run; the wave gate runs it. The builtin profile was not run for these two scenarios.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `import-x/order` on the new type import in the test**
- **Found during:** Task 1, `npm run lint`
- **Fix:** `eslint --fix` moved the `mention-attachments.ts` type import before the `skill-invocation.ts` one.
- **Files modified:** `test/orchestrators/skill-invocation.test.ts`
- **Commit:** 29ccd055

The trust case asserts `kind: "abort"` and an empty reader list rather than the whole text, as
the matching command case of plan 11-04 does; the abort message is already pinned by the
existing T-02-17 case.

## Maintainer review items

- D-PG11-02 stays pending maintainer review; no comment, test title, or scenario title calls it parity.
- The model's read of a staged `SKILL.md` attaches nothing (D-PG11-07); the Skill-tool path stays deferred.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
T-11-17 (the guard scenario, shown able to fail, and the `@$ARGUMENTS` owner case asking only for
`stat /work/$ARGUMENTS`), T-11-18 (the alias scenario and the first owner case assert the whole
text with `</skill>` last), T-11-19 (the untrusted-project case asks the reader for nothing), and
T-11-20 (the `fillSkillRead` case asks the reader for nothing) are mitigated as planned. T-11-SC:
no package installs.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts, test/orchestrators/skill-invocation.test.ts, features/skill/invocation.feature
- FOUND: 29ccd055, da668f13 (ancestors of HEAD)
