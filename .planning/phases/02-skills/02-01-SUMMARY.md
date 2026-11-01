---
phase: 02-skills
plan: 01
subsystem: skills-bridge
tags: [skills, cucumber, frontmatter, description-fallback, aliases]

requires:
  - phase: 01-harness-and-version-raise
    provides: descriptionFallback core (D-CF1-04), profile Pi harness, the skill fixture writer and seed step
provides:
  - "features/skill/listing.feature: SKL-01 listing, the A2e fallback Outline, and the when_to_use fold"
  - "features/step_definitions/skill/listing.steps.ts: the two shared skill Givens"
  - "features/lib/skill-files.ts::publishSkillFile"
  - "bridges/skills/skill-names.ts: upstream names, alias claims, command names, and the stored-record writer"
  - "a pi-claude-marketplace record line on every staged SKILL.md (names, pluginRoot, pluginData)"
affects: [02-03, 02-04, 02-06, 02-07]

actuals:
  tokens: 17200
  tasks: 3
  commits: 6
plan_head_before: 5fff9c4ad14ef2c7687ecd0efbf1dc423fbb58ea
plan_head_after: 424d7d0c4506c38b23733971e96f45cda2c55790

tech-stack:
  added: []
  patterns:
    - "One JSON-valued frontmatter line carries install-time facts to session-time loaders; it is written after every rewrite and verified by a read-back"
    - "Per-skill staging extracted into a module-private stageSkill helper with a SkillStagingContext"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/skills/skill-names.ts
    - test/bridges/skills/skill-names.test.ts
    - features/skill/listing.feature
    - features/step_definitions/skill/listing.steps.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts
    - features/lib/skill-files.ts
    - test/bridges/skills/stage.test.ts
    - test/bridges/skills/frontmatter-degrade.test.ts
    - test/edge/register.test.ts
    - test/orchestrators/plugin/materialize-latest.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - features/plugin/install-dependencies.feature
    - features/plugin/update-dependencies.feature
    - features/step_definitions/plugin/installation.steps.ts
  deleted:
    - features/step_definitions/skill/invocation.steps.ts

key-decisions:
  - "readSkillRecord stays module-private: fallow fails on an export with no consumer, and a fallow-ignore marker would go stale the moment 02-03 imports it. 02-03/02-06 add `export` when they consume it."
  - "A frontmatter name that is a list adds no alias (upstream joins it with commas); a mapping adds none, which matches upstream because '[object Object]' holds whitespace."
  - "commandUpstreamNames treats a command file it cannot lstat as no command (the commands bridge skips it with its own warning), so the name walk never fails an install the commands bridge would complete."

patterns-established:
  - "Staged-skill byte assertions build the record line from the case's own plugin root and data directory"

requirements-completed: [SKL-01]

coverage:
  - id: D1
    description: "A new session lists a bridged skill under /skill:<plugin>-<dir> with its description, every row compared"
    requirement: SKL-01
    verification:
      - kind: e2e
        ref: "features/skill/listing.feature#A new session lists a bridged skill under its generated name with its description"
        status: pass
    human_judgment: false
  - id: D2
    description: "A description-less skill is listed with Claude Code's A2e fallback: first line, heading text, 100/101-character boundary, empty body as Plugin skill, and the when_to_use fold"
    requirement: SKL-01
    verification:
      - kind: e2e
        ref: "features/skill/listing.feature#A skill without a description is listed with the first line of its body"
        status: pass
      - kind: e2e
        ref: "features/skill/listing.feature#A skill without a description is listed with Claude Code's fallback for its body"
        status: pass
      - kind: e2e
        ref: "features/skill/listing.feature#A skill's when_to_use follows its fallback description in the listing"
        status: pass
      - kind: unit
        ref: "test/bridges/skills/stage.test.ts#D-CF2-07: fills a missing description with ..."
        status: pass
    human_judgment: false
  - id: D3
    description: "Every staged SKILL.md carries one verified pi-claude-marketplace record (upstream names, pluginRoot, pluginData) that no reference rewrite touches"
    requirement: SKL-01
    verification:
      - kind: unit
        ref: "test/bridges/skills/skill-names.test.ts"
        status: pass
      - kind: unit
        ref: "test/bridges/skills/stage.test.ts#D-CF2-02: stores each skill's names, a shared alias going to the first claimant"
        status: pass
      - kind: unit
        ref: "test/bridges/skills/stage.test.ts#D-CF2-03: stores no qualified alias that a command of the plugin is named"
        status: pass
      - kind: other
        ref: "npm run check (full gate, combined tree of this worktree)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-11-01
status: complete
---

# Phase 2 Plan 01: Skill listing and the stored skill record Summary

**Description-less skills are listed with Claude Code 2.1.316's `A2e` fallback, and every staged `SKILL.md` now ends its frontmatter with a verified `pi-claude-marketplace` JSON line holding the skill's upstream names and its install-time plugin root and data directory.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-11-01T09:20:51Z
- **Completed:** 2026-11-01T09:55:48Z
- **Tasks:** 3
- **Files modified:** 15 (plus 1 deleted)

## Accomplishments

- `features/skill/listing.feature` (`Feature: Skill listing`): 4 scenarios plus a 4-row Outline that observe Pi's `get_commands` listing (SKL-01, D-CF2-07, D-CF1-04, WTU-01).
- `augmentSkillDescription` computes the base with `descriptionFallback(body, "Plugin skill")`; `firstBodyParagraph`, its helpers, and the `No description provided.` placeholder are gone.
- `bridges/skills/skill-names.ts`: `skillIdentityName`, `frontmatterNameAliases` (port of `Qqn`/`SAt`, 256 limit), `createSkillNameClaims` (identities first, first claimant wins, command names excluded), `commandUpstreamNames`, `writeSkillRecord` (replace-or-insert as last frontmatter line, re-parse and throw on mismatch), `StoredSkillRecord`; `readSkillRecord` is module-private (see Decisions).
- `stage.ts` writes the record after `substituteClaudeVars`; the supporting-Markdown pass skips the skill's own `SKILL.md`; the per-skill body moved into `stageSkill` and `parseSkillSource`.
- The full `npm run check` gate passes on this worktree (static, unpaired, integration, all 1176 cucumber scenarios, and direct coverage for all pairs).

## Task Commits

1. **Task 1: List a description-less skill with Claude Code's fallback** (tracer)
   - `60f7fcb` test(skills): move the shared skill step to the listing module (D-08, its own commit)
   - `9cc4f72` test(skills): list a description-less skill with Claude Code's fallback (RED)
   - `49a3f7c` feat(skills): describe a description-less skill as Claude Code does (GREEN)
2. **Task 2: Pin every fallback rule Pi lists** - `b42c03d` (test)
3. **Task 3: Store each skill's upstream names and install-time values** - `4fedc06` (feat), plus `424d7d0` test(plugin): expect the skill record in staged skill files (deviation fix, see below)

## Red proof (Task 1)

`npx cucumber-js features/skill/listing.feature --name "A skill without a description is listed with the first line of its body"` before the product fix, exit 1:

```text
Failed scenarios:
  1) A skill without a description is listed with the first line of its body # features/skill/listing.feature:23
       Then the session offers these skills: # features/step_definitions/session.steps.ts:142
           AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
           + actual - expected
               [
                 '/skill:demo-brief',
           +     'First line of the brief. Second line of the same paragraph.'
           -     'First line of the brief.'
               ],
1 scenario (1 failed)
9 steps (8 passed, 1 failed)
```

Semantic assessment: the target scenario ran, every Given passed, and it failed only on the planned listing assertion: the old first-paragraph fallback joined both body lines. After `49a3f7c` the scenario passes. The RED evidence classifier (`check tdd-red-evidence`) has no cucumber adapter, so it was not run; the plan names this cucumber run as the red proof.

Task 2 pins behavior Task 1 already shipped, so its scenarios passed on first run (the plan asks for the run only as a check of row text). Task 3's unit cases were written with the product change: the commit hook runs direct coverage for staged pairs, so a failing unit test cannot be committed on its own.

## Step texts added

- `Given the published plugin {string} of the marketplace {string} has the skill {string} with this skill file:` (new; writes the doc string verbatim to `skills/<dir>/SKILL.md`, replacing an existing file, and asserts the read-back).
- `Given the published plugin {string} of the marketplace {string} has the skill {string} described as {string} with this body:` (moved unchanged from `skill/invocation.steps.ts`).

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/skills/skill-names.ts` - upstream names, claims, command names, record writer.
- `extensions/pi-claude-marketplace/bridges/skills/stage.ts` - fallback base, record write, `stageSkill`/`parseSkillSource` helpers, supporting pass skips the skill's own file.
- `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts` - `firstBodyParagraph` and helpers removed.
- `features/lib/skill-files.ts` - `publishSkillFile`.
- `features/skill/listing.feature`, `features/step_definitions/skill/listing.steps.ts` - new; `features/step_definitions/skill/invocation.steps.ts` deleted (declared in `files_deleted`).
- `test/bridges/skills/{stage,skill-names,frontmatter-degrade}.test.ts` - owner tests.
- Expected-value-only edits outside Phase 2 ownership (each changed line is a staged-bytes literal or the variables that build it): `test/edge/register.test.ts`, `test/orchestrators/plugin/materialize-latest.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`.
- Deviation edits outside the plan's file list: `features/plugin/install-dependencies.feature`, `features/plugin/update-dependencies.feature`, `features/step_definitions/plugin/installation.steps.ts`.

## Decisions Made

- `readSkillRecord` is not exported (fallow `unused-export` fails without a consumer; a suppression marker would go stale when 02-03 imports it and would change the documented marker count). Plans 02-03 and 02-06 add `export` to it in `skill-names.ts` when they import it; its shape and behavior are as the plan specifies.
- A list-valued frontmatter `name` adds no alias (upstream `String()` joins it with commas); numbers and booleans go through `String()` as upstream does. This keeps ESLint `no-base-to-string` clean without a disable.
- `commandUpstreamNames` uses `readDirEntriesTolerant` (missing directory names none; any other directory error propagates and fails the install, as the commands bridge would) and treats a file whose `lstat` fails as no command.
- The invalid-output cleanup case in `stage.test.ts` now passes `pluginRoot: "/plugin"` so the YAML error excerpt, which now shows the record line, does not depend on the temp directory.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two lifecycle scenarios compare whole staged SKILL.md bytes**
- **Found during:** Task 3 (full cucumber run)
- **Issue:** `features/plugin/install-dependencies.feature:1256` and `features/plugin/update-dependencies.feature:67` assert the full text of every staged `SKILL.md`; the record line (with absolute sandbox paths) broke both. The research's blast-radius measurement covered unit and integration suites only.
- **Fix:** `the staged skills directory of the {word} scope holds these files:` now projects run tokens over the rows (`projectTokens`), and the two tables expect the record line with `{home}` and `{project dir}`. No other step or assertion changed.
- **Files modified:** `features/step_definitions/plugin/installation.steps.ts`, `features/plugin/install-dependencies.feature`, `features/plugin/update-dependencies.feature`
- **Verification:** both scenarios pass; `npm run check` (all 1176 scenarios) passes.
- **Committed in:** `424d7d0`

**2. [Rule 3 - Blocking] `readSkillRecord` not exported**
- **Found during:** Task 3 (`npm run fallow`)
- **Issue:** fallow production dead-code reports an export with no consumer.
- **Fix:** module-private; its malformed/absent branch is covered through `writeSkillRecord`'s read-back test.
- **Files modified:** `bridges/skills/skill-names.ts`, `test/bridges/skills/skill-names.test.ts`
- **Committed in:** `4fedc06`

---

**Total deviations:** 2 auto-fixed (2 blocking). **Impact on plan:** both were needed for a green gate; the first edits three files outside the plan's list and outside Phase 2's ownership (expected values and one token projection only).

## Issues Encountered

- Root sandbox: the `commandUpstreamNames` unreadable-file case uses `chmod 0o444` and only fails as designed without DAC override; it passes under the session's `nondac-sh` wrapper, as the project's other permission tests do.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Parent lines

- `.agents/skills/cucumber/rules/layout.md` (frozen) still names `features/step_definitions/skill/invocation.steps.ts` as the Skills seed step module; it is now `features/step_definitions/skill/listing.steps.ts` (DC-26 item 5).
- Phase 3 / lifecycle owners: `features/step_definitions/plugin/installation.steps.ts`'s staged-skills step now projects run tokens; `features/plugin/{install,update}-dependencies.feature` expect the record line.
- Plans 02-03 and 02-06: export `readSkillRecord` from `bridges/skills/skill-names.ts` when importing it.

## Dubious Choices

1. **Out-of-ownership edits to three lifecycle files** (`features/plugin/install-dependencies.feature`, `features/plugin/update-dependencies.feature`, `features/step_definitions/plugin/installation.steps.ts`), forced by the record line; expected values plus one run-token projection.
2. **`readSkillRecord` kept private** instead of exported as the plan's artifact list says; downstream plans must add `export`.
3. **List-valued frontmatter `name` stores no alias** (upstream would register the comma-joined string). Mapping values match upstream in effect. Not probed upstream.
4. **Whitespace names store no alias** (plan residual of D-CF2-02, as planned).
5. **`commandUpstreamNames` swallows per-file `lstat` failures** (returns no name), matching the commands bridge's skip; a directory-level error other than ENOENT/ENOTDIR still fails the install, now in the skills phase instead of the commands phase.
6. **No TAP RED evidence for Task 3's unit cases**: the hook rejects a commit with failing staged-pair tests, so tests and code landed together; the cucumber red proof covers Task 1 only.
7. **Scenario ordering assumption**: the listing tables assume Pi lists `/skill:demo-<dir>` rows alphabetically before `/skill:demo-skill`, as every existing multi-skill listing does; it held in every run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 02-03 (variables) and 02-06 (aliases) can read the stored record; they need to export `readSkillRecord`.
- 02-04 can reuse `commandUpstreamNames` for the D-CF2-03 shadow check.

## Self-Check: PASSED

- Files: `skill-names.ts`, `skill-names.test.ts`, `listing.feature`, `listing.steps.ts` exist; `invocation.steps.ts` is gone.
- Commits `60f7fcb`, `9cc4f72`, `49a3f7c`, `b42c03d`, `4fedc06`, `424d7d0` are on this branch.
- Acceptance greps: `Feature: Skill listing` 1; `with this skill file:` 1; `firstBodyParagraph` (code) 0; `MISSING_DESCRIPTION_PLACEHOLDER` (code) 0; `descriptionFallback(body, "Plugin skill")` 1; Outline title 1; `writeSkillRecord(` in stage.ts 1; `from "../commands/` in skill-names.ts 0.
- `npm run check` exit 0.

---
*Phase: 02-skills*
*Completed: 2026-11-01*
