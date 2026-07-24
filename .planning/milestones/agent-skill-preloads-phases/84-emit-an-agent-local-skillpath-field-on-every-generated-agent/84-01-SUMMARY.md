---
phase: 84-emit-an-agent-local-skillpath-field-on-every-generated-agent
plan: 01
subsystem: agents-bridge
tags: [pi-subagents, frontmatter-emitter, skill-legend, typescript]

requires:
  - phase: 83.1-silent-skill-mapping
    provides: unified `available on demand` legend annotation groundwork (D-83.1-03) and inheritSkills emission
provides:
  - "emitGeneratedAgentFile emits `skillPath: ../pi-claude-marketplace/resources/skills` whenever frontmatter.skills is non-empty"
  - "single-state skill legend: every entry renders `(available on demand)`; SkillLegendEntry.preloaded and detectSkillTokens' emittedSkills plumbing are deleted"
affects: [84-02-pi-subagents-floor, 84-03, 84-04-live-verification]

tech-stack:
  added: []
  patterns:
    - "Fixed-constant frontmatter field gated on an existing non-emptiness check (skillPath rides the same `frontmatter.skills.length > 0` gate as `skills:`, not a new field threaded through convertAgent/GeneratedFrontmatterFields)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - tests/bridges/agents/frontmatter.test.ts
    - tests/bridges/agents/convert.test.ts
    - tests/bridges/agents/convert-byte-identity.test.ts

key-decisions:
  - "D-84-04: skillPath is a hardcoded relative-path constant pushed inside the existing skills-non-empty block, never computed from plugin/skill/marketplace names and never threaded as a new GeneratedFrontmatterFields member"
  - "D-84-01 / D-84-02: the skill legend collapses to one fixed annotation, 'available on demand', for every entry (preloaded and cross-plugin/unknown-dropped references alike)"

patterns-established:
  - "Byte-identity test corpora that pin whole generated-file output must be re-verified against `npm run check` (not just the two files named in a plan's files_modified) whenever a frontmatter-emission change lands -- a third pinned corpus (convert-byte-identity.test.ts) existed outside this plan's declared scope and needed the same skillPath insertion"

requirements-completed: [AGSK-06, AGSK-04]

coverage:
  - id: D1
    description: "Generated agents with a non-empty skills list emit skillPath: ../pi-claude-marketplace/resources/skills directly after skills: and before systemPromptMode:"
    requirement: AGSK-06
    verification:
      - kind: unit
        ref: "tests/bridges/agents/frontmatter.test.ts#AGSK-04 emitGeneratedAgentFile without legend keeps today's exact bytes (NO_LEGEND_EXPECTED pin)"
        status: pass
      - kind: unit
        ref: "tests/bridges/agents/convert.test.ts#AGSK-04 token-free body emits no legend and stays byte-identical to the pre-legend output (preLegendExpected pin)"
        status: pass
      - kind: unit
        ref: "tests/bridges/agents/convert-byte-identity.test.ts#AGSK-01 byte-identity: CSV tools + bare skills fileContent is pinned at pre-fix bytes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Skill-less agents (skills: []) stay byte-identical -- no skillPath line, no skills: line"
    requirement: AGSK-06
    verification:
      - kind: unit
        ref: "tests/bridges/agents/frontmatter.test.ts#AG-8 emitGeneratedAgentFile omits skills line when skills array is empty"
        status: pass
    human_judgment: false
  - id: D3
    description: "Skill legend collapses to a single 'available on demand' annotation for every entry; SkillLegendEntry.preloaded and detectSkillTokens' emittedSkills argument are deleted"
    requirement: AGSK-04
    verification:
      - kind: unit
        ref: "tests/bridges/agents/frontmatter.test.ts#D-82-04 / D-82-05 emitGeneratedAgentFile renders the legend block between provenance comment and body"
        status: pass
      - kind: unit
        ref: "tests/bridges/agents/convert.test.ts (full suite, 41 legend-adjacent tests)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (detectSkillTokens three-parameter signature, no dangling `preloaded` references)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Retired annotation string 'preloaded in your context' no longer appears anywhere in tests/ or extensions/ except the unrelated cross-plugin drop warning's own use of the word 'preloaded'"
    verification:
      - kind: other
        ref: "grep -rn \"preloaded in your context\" tests/ extensions/ -> zero matches"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-20
status: complete
---

# Phase 84 Plan 01: Emit agent-local skillPath and collapse the skill legend Summary

**Generated agents now emit a fixed `skillPath: ../pi-claude-marketplace/resources/skills` line whenever `skills:` is non-empty, and the body skill legend collapses from a two-state to a single `(available on demand)` annotation across both the emitter and its convert.ts producer.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-20
- **Tasks:** 2 (source emitter/producer change, byte-identity fixture corpus update)
- **Files modified:** 5 (2 source, 3 test)

## Accomplishments
- `emitGeneratedAgentFile` pushes `skillPath: ../pi-claude-marketplace/resources/skills` immediately after `skills:` inside the existing `frontmatter.skills.length > 0` gate -- no new field threaded through `GeneratedFrontmatterFields` or `convertAgent`, and skill-less agents stay byte-identical.
- `renderSkillLegend` now emits one fixed annotation, `(available on demand)`, for every legend entry; `SkillLegendEntry.preloaded` is deleted from the interface.
- `detectSkillTokens` in `convert.ts` no longer accepts an `emittedSkills` parameter; its sole call site in `convertAgent` drops the 4th argument (`skillsResult.emit` is still used at the `skills:` emission point, just no longer passed into legend detection).
- Three byte-identity unit-test corpora (`frontmatter.test.ts`, `convert.test.ts`, and `convert-byte-identity.test.ts`, the last one discovered outside the plan's declared file scope) are re-pinned: skill-bearing fixtures gained the `skillPath:` line and the single-state annotation; skill-less fixtures are untouched.
- Full `npm run check` (typecheck, lint, format, unit + integration tests -- 2978 tests) is green.

## Task Commits

Both tasks landed in one commit rather than the plan's declared two-task split -- see Deviations below for why.

1. **Task 1: Emit skillPath and collapse the legend to a single state (source)** -- combined with Task 2, see below
2. **Task 2: Update the byte-identity unit-fixture corpus** -- combined with Task 1, see below

**Combined commit:** `df4ba01c` (feat: emit skillPath and collapse skill legend to one state)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` - pushes the `skillPath:` constant inside the skills-non-empty block; deletes `SkillLegendEntry.preloaded`; `renderSkillLegend` renders one fixed annotation
- `extensions/pi-claude-marketplace/bridges/agents/convert.ts` - `detectSkillTokens` drops the `emittedSkills` parameter and the per-entry `preloaded` flag it computed; call site in `convertAgent` drops the 4th argument
- `tests/bridges/agents/frontmatter.test.ts` - 4 whole-file-pin fixtures (`NO_LEGEND_EXPECTED`, the D-82-04/D-82-05 legend pin, `INHERIT_TRUE_EXPECTED`, the D-83.1-03 legend pin) gain the `skillPath:` line and the collapsed annotation; `preloaded: true/false` removed from 2 legend-input test fixtures (4 field occurrences)
- `tests/bridges/agents/convert.test.ts` - `LegendAnnotation` type alias and its two-state values deleted; `legendEntryLine` collapses to a 2-arg helper; 2 whole-file-pin fixtures (`preLegendExpected`, `canonicalExpected`) gain the `skillPath:` line and the collapsed annotation; one test title renamed from "gets a preloaded legend entry" to "gets a legend entry" to stop describing retired two-state behavior
- `tests/bridges/agents/convert-byte-identity.test.ts` - 2 whole-file-pin fixtures (`EXPECTED_1`, `EXPECTED_7`) gain the `skillPath:` line; not in the plan's declared `files_modified` list, found via `npm run check` (see Deviations)

## Decisions Made
- No new decisions beyond what the plan already locked (D-84-01, D-84-02, D-84-04, D-84-05 as specified). Implementation followed the plan's exact gating and deletion instructions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Combined Task 1 and Task 2 into a single commit**
- **Found during:** Attempting to commit Task 1 (source-only) per the plan's stated two-task/two-commit structure
- **Issue:** `SkillLegendEntry.preloaded` deletion and `detectSkillTokens`' signature change are structurally coupled to their test-file usages across the same `tsconfig.json` compile unit (`include: ["extensions/**/*.ts", "tests/**/*.ts"]`). The repo's `npm-typecheck` pre-commit hook runs `tsc --noEmit` across the whole project; when Task 1's source files were staged alone (Task 2's test edits present but unstaged), the actual `git commit` invocation triggered pre-commit's standard stash-unstaged-changes behavior, which reverted the test files to their pre-Task-2 (still using `preloaded`) state and failed the hook with `TS2353: Object literal may only specify known properties, and 'preloaded' does not exist`.
- **Fix:** Completed both tasks' edits, then staged and committed all 5 files (2 source + 3 test) together in one commit. Verified via a live `git commit` dry-run that a source-only staging genuinely fails pre-commit's stash-based hook (confirmed empirically, no commit created, working tree fully restored), then re-staged everything and committed successfully.
- **Files modified:** All 5 files in this plan's scope, in one commit.
- **Verification:** `npm run check` green (2978 tests passing) prior to commit; `pre-commit run --files <all 5 files>` green; commit succeeded with hooks enabled (no `--no-verify`).
- **Committed in:** `df4ba01c`

**2. [Rule 1 - Bug] Fixed convert-byte-identity.test.ts, a third byte-identity corpus outside the plan's declared file scope**
- **Found during:** Task 2's final `npm run check` verification pass (the plan's Task 2 verify step only ran the two named test files; the full check surfaced a third)
- **Issue:** `tests/bridges/agents/convert-byte-identity.test.ts` (not listed in the plan's `files_modified` frontmatter or Task 2's action) pins two whole-file outputs (`EXPECTED_1`, `EXPECTED_7`) for skill-bearing agents. After the skillPath emission change, both failed with the new `skillPath:` line appearing as an unexpected diff.
- **Fix:** Inserted the `skillPath: ../pi-claude-marketplace/resources/skills` line into both `EXPECTED_1` and `EXPECTED_7`, immediately after their `skills: acme-knowledge` line, matching the same insertion pattern applied to the plan's two named test files. No other fixture in this file (`EXPECTED_2` through `EXPECTED_6`, all skill-less) needed changes.
- **Files modified:** `tests/bridges/agents/convert-byte-identity.test.ts`
- **Verification:** `npm run check` (full suite, 2978 tests) green.
- **Committed in:** `df4ba01c` (part of the combined commit)

---

**Total deviations:** 2 auto-fixed (1 blocking commit-structure adjustment, 1 bug fix in an out-of-scope byte-identity corpus)
**Impact on plan:** Both deviations were necessary to keep `npm run check` green per CLAUDE.md's NFR-6 quality bar and the project's mandatory pre-commit gate. No scope creep beyond the plan's stated SC-1/D-84-04/D-84-01/D-84-02/D-84-05 truths -- the byte-identity corpus fix applies the exact same skillPath insertion pattern the plan specified for the two named test files.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 84-02 (raise pi-subagents floor to >=0.35.0) and Plan 84-03/84-04 (live end-to-end verification) can proceed: the emitted `skillPath` line is now present in every skill-bearing generated agent, matching the mechanism pi-subagents 0.35.0 (PR #428) resolves against.
- No blockers. `npm run check` is fully green on top of this commit.

---
*Phase: 84-emit-an-agent-local-skillpath-field-on-every-generated-agent*
*Completed: 2026-07-20*

## Self-Check: PASSED

All 5 modified files and the combined commit (`df4ba01c`) were verified present on disk / in git history.
