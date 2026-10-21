---
phase: 01-suite-foundation
plan: 05
subsystem: testing
tags: [cucumber, gherkin, behavioral-tests, skills, documentation, verification]

requires:
  - phase: 01-suite-foundation (01-01)
    provides: "runCommandPayloads (every payload, schema-checked), {home} and {scenario time} run tokens"
  - phase: 01-suite-foundation (01-02)
    provides: "scripts/check-features.mjs in check:static (unused/undefined/ambiguous steps over every row, layout and Gherkin rules)"
  - phase: 01-suite-foundation (01-03)
    provides: "publishing.steps.ts shared topic module, source kind parameter type, the ADD-01 multi-kind Outline"
  - phase: 01-suite-foundation (01-04)
    provides: "the two D-02 multi-payload steps and the empty-result step"
provides:
  - "cucumber SKILL.md review step that names `npm run check:features` and says why the CLI usage report is no substitute (D-09)"
  - "features.md sections `Source kinds` (multi-kind Outline, Examples-only tags, the `not @url and not @github` exclusion, tag owners by kind) and `Run tokens` ({home}, {scenario time}, {git host})"
  - "features.md rules: variant counting over every Examples block; an empty result has its own step"
  - "steps.md rules: export-free step modules, literal step text, token expansion and projection, the gate over every row"
  - "layout.md rule: shared topic module beside verb modules, verb-named step text, promotion in its own commit (D-08)"
  - "world-and-stand-ins.md rules: the payload driver (DRV-01, D-02) and kind-dispatching fixtures"
  - "local-verification commands.md lists the feature-file check in check:static"
  - "Phase gate: npm run check exit 0 on the combined tree"
affects: [marketplace verb phases, kind phases, reviewers of features/]

actuals:
  tokens: 3403
  tasks: 2
  commits: 2
plan_head_before: 130d861334d13a47898515f1f10d798634716ed3
plan_head_after: 64d6b78e66d6e41930b312313b2b72d2a90b28a0

tech-stack:
  added: []
  patterns:
    - "Skill rules name source kinds and decision IDs (D-NN), never phase or plan numbers"
    - "Reviewers gate on npm run check:features, not on the CLI's dry-run usage report"

key-files:
  created: []
  modified:
    - .agents/skills/cucumber/SKILL.md
    - .agents/skills/cucumber/rules/features.md
    - .agents/skills/cucumber/rules/steps.md
    - .agents/skills/cucumber/rules/layout.md
    - .agents/skills/cucumber/rules/world-and-stand-ins.md
    - .agents/skills/local-verification/rules/commands.md

key-decisions:
  - "The Source kinds example in features.md copies the whole ADD-01 Outline, its fields table included, so the example does not model a scenario that checks part of a result"
  - "The Run tokens section names {git host} as the worked example of a stand-in token, because the excluded @url rows of add.feature already write it"
  - "The world-and-stand-ins D-02 rule names the two real step texts, so a verb phase finds them without reading command.steps.ts"

patterns-established:
  - "A new source kind's work removes its own tag from cucumber.json; no feature file changes"
  - "A step a second verb needs moves to the shared topic module in a commit of its own (D-08)"

requirements-completed: [DRV-01, DRV-02, DRV-04]

coverage:
  - id: D1
    description: "The cucumber skill documents the multi-kind Outline, the Examples-only tags, the `not @url and not @github` exclusion, and which source kind's work removes each tag (ROADMAP success criterion 4)"
    verification:
      - kind: other
        ref: "grep -c 'not @url and not @github' .agents/skills/cucumber/rules/features.md -> 1"
        status: pass
      - kind: other
        ref: "grep -nE '[Pp]hase [0-9]+' .agents/skills/cucumber/SKILL.md .agents/skills/cucumber/rules/*.md -> no match"
        status: pass
    human_judgment: true
    rationale: "Whether the prose is clear enough for a parallel verb-phase agent to follow is a reading judgment; the greps only prove the content is present"
  - id: D2
    description: "Reviewers are sent to npm run check:features, which counts excluded rows (D-09, DRV-04)"
    requirement: DRV-04
    verification:
      - kind: other
        ref: "grep -c 'npm run check:features' .agents/skills/cucumber/SKILL.md .agents/skills/cucumber/rules/steps.md -> 1 and 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Run tokens, the payload driver, and the shared-topic step-module rule are documented (D-03, D-05, D-08, DRV-01, DRV-02)"
    requirement: DRV-01
    verification:
      - kind: other
        ref: "grep -c '{scenario time}' / '{home}' features.md -> 1 / 4; grep -c publishing.steps.ts layout.md -> 1; grep -ci 'every payload' world-and-stand-ins.md -> 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "local-verification lists the feature-file check in check:static"
    verification:
      - kind: other
        ref: "grep -c check:features .agents/skills/local-verification/rules/commands.md -> 1"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase gate: npm run check passes on the combined tree of the phase"
    requirement: DRV-04
    verification:
      - kind: other
        ref: "npm run check (exit 0 at 64d6b78e, Node v26.11.1)"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-10-15
status: complete
---

# Phase 1 Plan 5: Skill conventions and phase gate Summary

**The cucumber skill now teaches the multi-kind Outline and its tag owners, the `{home}`/`{scenario time}` run tokens, the every-payload driver, and the shared-topic step-module rule. It sends reviewers to `npm run check:features` instead of the CLI usage report. The local-verification skill lists the feature-file check. `npm run check` passes on the phase's combined tree.**

## Performance

- **Duration:** about 4 min
- **Started:** 2026-10-15T20:33:16Z
- **Completed:** 2026-10-15T20:36:58Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `SKILL.md` Review: run `npm run check:features` (part of `check:static`); it dry-runs every scenario, excluded rows included. The CLI usage report honors the exclusion and so lists a step only excluded rows use as `UNUSED` (D-09). The BLOCKER and WARNING classification is unchanged.
- `rules/features.md`: variant counting over every Examples block; an empty result has its own step; new sections "Source kinds" (with the ADD-01 Outline as the example) and "Run tokens".
- `rules/steps.md`: lint rejects exports from step modules and non-literal step text; commands expand tokens and results project them back, and step text never holds a token; `test:cucumber` checks the rows it runs and `check:features` checks every row.
- `rules/layout.md`: shared topic module beside verb modules, verb-named step text, promotion in its own commit (D-08), and the gate checks the file families.
- `rules/world-and-stand-ins.md`: every payload in emission order, schema-validated; exactly one for a single-result step; two steps for several (D-02), with the info fan-out case; fixtures under the sandbox home; kind dispatch in library code.
- `local-verification/rules/commands.md`: the feature-file check is part of `check:static`.

## Task Commits

1. **Task 1: Document source kinds, run tokens, the payload driver, the step-module split, and the gate in the cucumber skill** - `44b06d6c` (docs). Hook result: pre-commit passed (mdformat, markdownlint-cli2, gitlint passed; `npm run check:commit` skipped because no staged file is a build input).
2. **Task 2: List the feature-file check in local verification** - `64d6b78e` (docs). Hook result: pre-commit passed (gitlint passed; `npm run check:commit` skipped, no build input).

**Plan metadata:** this SUMMARY's docs commit.

## Phase gate record

- **Command:** `npm run check` (foreground, output to a log file, exit status captured directly)
- **Exit status:** 0
- **Commit:** `64d6b78e66d6e41930b312313b2b72d2a90b28a0` (clean tree)
- **Node version:** v26.11.1
- **Scope:** the combined tree of the phase (plans 01-01 through 01-05) on `features/cucumber-behavioral-tests`
- **Result lines:** typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features passed; the integration suite passed; cucumber ran 26 scenarios (26 passed, 189 steps); direct coverage merged `coverage/direct.lcov` (279 records). Wall time about 102 s.

## Files Created/Modified

- `.agents/skills/cucumber/SKILL.md` - review step names the feature gate
- `.agents/skills/cucumber/rules/features.md` - variant counting, empty-result step, Source kinds, Run tokens
- `.agents/skills/cucumber/rules/steps.md` - lint rules for step modules, token handling, the gate over every row
- `.agents/skills/cucumber/rules/layout.md` - shared topic and verb modules (D-08)
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` - the payload driver and kind-dispatching fixtures
- `.agents/skills/local-verification/rules/commands.md` - check:static member list

## Decisions Made

- The Source kinds example copies the whole ADD-01 Outline, its fields table included, so it does not model a scenario that checks part of a result.
- The Run tokens section uses `{git host}` as the example of a stand-in token, because the excluded `@url` rows of `add.feature` already write it.
- The D-02 rule names the two real step texts (`the command reports these results:`, `the results list these marketplaces and plugins:`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-14 (mitigate) holds: `SKILL.md` and `steps.md` both name `npm run check:features`, and `SKILL.md` tells reviewers not to use the CLI usage report in its place.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase complete. Verb phases can learn the source-kind Outline, the run tokens, the driver contract, and the step-module split from the skill. The url and github kind work each remove one tag from `cucumber.json`.

## Self-Check: PASSED

- All six modified files exist; commits `44b06d6c` and `64d6b78e` are ancestors of HEAD.
- Task 1 and Task 2 acceptance greps pass; the phase-number grep finds nothing.
- `npm run check` exited 0 at `64d6b78e`; `git status --short` was clean after the run.
