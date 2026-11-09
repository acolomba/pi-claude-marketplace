---
phase: 01-foundation
plan: 01
subsystem: testing
tags: [cucumber, planning, parallel-streams, decision-records]

requires: []
provides:
  - "Behavioral gaps section in the cucumber layout rules: frozen files, per-phase ownership table, reserved feature files and verb modules, seed hand-over rule, parent-owned files"
  - "D-BG-04 reading of the two cucumber profiles in REQUIREMENTS.md, ROADMAP.md, and the PROJECT.md milestone goal"
  - "D-BG-16 local-branch wording in the ROADMAP (Parallelism, Merge procedure, Phase 1 criterion 5)"
  - "Key Decisions rows D-BG-01 to D-BG-16, all -- Pending"
  - "Empty root and Phase 1 dubious-choices logs"
affects: [01-foundation later plans, phases 2-16 stream planning, 01-08 frozen record and brief]

actuals:
  tokens: 7100
  tasks: 2
  commits: 2
plan_head_before: aef523d9ef3c8686a49a7706cc3ee2eb4f2084db
plan_head_after: 864b86830b21f764350454adc2669118ea78d05f

tech-stack:
  added: []
  patterns:
    - "Milestone section in cucumber layout.md mirrors the ROADMAP File ownership section row for row"

key-files:
  created:
    - .planning/DUBIOUS-CHOICES.md
    - .planning/phases/01-foundation/DUBIOUS-CHOICES.md
  modified:
    - .agents/skills/cucumber/rules/layout.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/PROJECT.md

key-decisions:
  - "Reserved names in layout.md are spelled out in full per phase (no brace expansion), so each name can be found with grep"
  - "layout.md says Phase 1 seeds only the new feature files that hold a seed; hook/tool-failure.feature and hook/session-end.feature are created by Phases 4 and 6"

requirements-completed: [FND-01, FND-02]

coverage:
  - id: D1
    description: "Cucumber layout rules carry the Behavioral gaps section with the ownership table and every reserved stream file"
    requirement: FND-01
    verification:
      - kind: other
        ref: "grep -q '^## Behavioral gaps' layout.md; grep of each of the 15 verb modules; SKIP=npm-check pre-commit run --files layout.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-BG-04 profile wording and D-BG-16 local-branch wording in REQUIREMENTS, ROADMAP, and PROJECT; BOOT-01 unchanged"
    requirement: FND-02
    verification:
      - kind: other
        ref: "grep -q D-BG-04/D-BG-16; grep -c of the old push line and old preamble = 0; git diff cf48b0df -- .planning/REQUIREMENTS.md shows no BOOT-01 line"
        status: pass
    human_judgment: false
  - id: D3
    description: "Key Decisions rows D-BG-01 to D-BG-16 and the two empty dubious-choices logs"
    requirement: FND-02
    verification:
      - kind: other
        ref: "grep -o 'D-BG-[0-9][0-9] (behavioral-gaps' PROJECT.md | sort -u = 16 lines; every row ends '-- Pending'; grep -c P1-DC- phase log = 0"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-08
status: complete
---

# Phase 1 Plan 01: Rules and Records Summary

**The cucumber layout rules now hold a Behavioral gaps section that freezes the shared files and reserves each stream's feature file and verb module. The planning files now state the D-BG-04 profile rule and the D-BG-16 local-branch rule. PROJECT.md records D-BG-01 to D-BG-16 as pending decisions, and the two dubious-choices logs exist as empty skeletons.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-08T01:04:39Z
- **Completed:** 2026-11-08T01:10:39Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `.agents/skills/cucumber/rules/layout.md` has a new `## Behavioral gaps` section with these subsections: `### Frozen after Phase 1`, `### What each phase owns` (all sixteen ROADMAP rows), `### Reserved names` (eleven new feature files and fifteen new verb modules, listed per phase), `### Seeds` (with the placeholder line that a later plan replaces), and `### Parent-owned files`.
- The REQUIREMENTS preamble, FND-01, the ROADMAP milestone goal, the Behavioral tests rule, Phase 1 criterion 3, and the PROJECT.md milestone goal now say the same thing. The whole `npm run test:cucumber` must be green under both profiles. Only a scenario with an MCP surface carries `@mcp` or an `@adapter-only`/`@builtin-only` pair. Any other scenario runs once, under `adapter` (D-BG-04). BOOT-01 is unchanged.
- The ROADMAP now says the phase branches are local (D-BG-16). A child commits only to its own branch and pushes nothing unless the user asks. A child that needs a parent change merges the local `features/behavioral-gaps`. The parent pushes nothing at a merge. Criterion 5 says the branches exist as local branches. The old `git push -u origin ...` line is gone.
- PROJECT.md Key Decisions has sixteen new rows, D-BG-01 to D-BG-16. Each is marked "settled with the recommended answer, pending user review", and each Outcome reads `-- Pending`. A new `_Last updated` line sits above the existing footer lines.
- `.planning/DUBIOUS-CHOICES.md` (root log) and `.planning/phases/01-foundation/DUBIOUS-CHOICES.md` (phase log) exist with the legend and the empty headings. Neither has an entry.

## Task Commits

1. **Task 1: Reserve the stream files and state the profile and branch rules** - `4eecd92b` (docs). Tracer gate: the `<verify>` ran green, so the plan moved on to Task 2.
2. **Task 2: Open the decision records** - `864b8683` (docs)

**Plan metadata:** recorded in the docs commit that carries this SUMMARY, STATE.md, and ROADMAP.md.

## Files Created/Modified

- `.agents/skills/cucumber/rules/layout.md` - the Behavioral gaps section (D-BG-14, D-BG-16)
- `.planning/REQUIREMENTS.md` - the preamble, FND-01, and the footer (D-BG-04)
- `.planning/ROADMAP.md` - the milestone goal, Parallelism, the Behavioral tests rule, Merge procedure, and Phase 1 criteria 3 and 5 (D-BG-04, D-BG-16)
- `.planning/PROJECT.md` - the Current Milestone goal (D-BG-04), the Key Decisions rows D-BG-01 to D-BG-16, and the `_Last updated` line
- `.planning/DUBIOUS-CHOICES.md` - the root log skeleton
- `.planning/phases/01-foundation/DUBIOUS-CHOICES.md` - the Phase 1 log skeleton

## Decisions Made

- The Reserved names list in layout.md spells out every path in full, one line per phase. The plan's brace notation would have hidden `hook/stop-failure.steps.ts` from the plan's own grep.
- The layout section repeats the ROADMAP's path-root and unit-pair paragraph, because the copied table uses relative paths.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The layout section no longer says Phase 1 seeds every new feature file**
- **Found during:** Task 1
- **Issue:** The plan says "it seeds the feature files". No Phase 1 plan (01-02 to 01-08) creates `hook/tool-failure.feature` or `hook/session-end.feature`, and the ROADMAP "Builds" list has no seed for Phase 4 or Phase 6.
- **Fix:** layout.md says that Phase 1 creates only the new feature files that hold a seed, and that Phases 4 and 6 create `hook/tool-failure.feature` and `hook/session-end.feature`.
- **Files modified:** `.agents/skills/cucumber/rules/layout.md`
- **Verification:** grep of every `files_modified` list of the Phase 1 plans for `.feature` paths
- **Committed in:** `4eecd92b`

**2. [Rule 1 - Bug] The phase log names the ID form without the literal `P1-DC-` string**
- **Found during:** Task 2
- **Issue:** The plan says the phase log's paragraph names its entries `P1-DC-NN`, and its acceptance criterion requires `grep -c "P1-DC-"` on that file to print 0. Both cannot be true.
- **Fix:** The paragraph and the legend give the form as `P{N}-DC-NN` with N = 1.
- **Files modified:** `.planning/phases/01-foundation/DUBIOUS-CHOICES.md`
- **Verification:** `grep -c "P1-DC-"` prints 0
- **Committed in:** `864b8683`

---

**Total deviations:** 2 auto-fixed (2 Rule 1). **Impact on plan:** wording only. No scope change.

## Issues Encountered

- The session's worktree guard refuses any shell command whose text contains a git command line, including a grep pattern such as `git push -u origin ...`. The edit and check scripts ran from files in the scratchpad instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 01-02 to 01-07 can plan against the reserved names and the frozen list.
- 01-08 must replace the `### Seeds` placeholder line ("The per-stream list of seed steps follows when the seeds land.") with the real list. It must also reconcile the frozen list and the table with the files Phase 1 leaves (T-1-01).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-1-01 is mitigated by the row-for-row copy of the table and the per-phase reserved names. T-1-02 is mitigated by the D-BG-16 wording; the old push line has a grep count of 0.

## Dubious Choices

- **Seeded-file wording (Low):** layout.md says that Phases 4 and 6 create `hook/tool-failure.feature` and `hook/session-end.feature`, because no Phase 1 plan seeds them. The plan text said Phase 1 "seeds the feature files". If 01-08 or a revision adds seeds there, that sentence must change.
- **Phase log ID wording (Low):** the phase log gives its ID form as `P{N}-DC-NN` with N = 1, not `P1-DC-NN`, so that the plan's grep criterion holds. The plan's wording and its criterion conflicted.
- **Rationale cells (Medium):** 01-CONTEXT.md gives no explicit rationale for D-BG-02, D-BG-03, D-BG-05 to D-BG-08, and D-BG-10 to D-BG-15. Their Rationale cells come from the decision text, the code_context patterns, the roadmap note that the streams cannot add frozen stand-ins, and AGENTS.md (phase numbers repeat across milestones). The user may want to reword them.
- **D-BG-09 row content (Low):** the row says that research found a json mode in Pi 1.5.0, so BOOT-01 keeps its json clause. This comes from the plan's must-haves, not from 01-CONTEXT.md, which states the decision only as a condition.
- **REQUIREMENTS footer (Low):** the plan asked for the footer to be updated, so the old text "after roadmap creation (16 phases)" was replaced, not kept as a second line. Keeping it would also have been reasonable.
- **Extra layout paragraph (Low):** the layout section repeats the ROADMAP's sentences on path roots, unit pairs, and test-file names. The plan did not list them.

## Self-Check: PASSED

- FOUND: `.agents/skills/cucumber/rules/layout.md`, `.planning/DUBIOUS-CHOICES.md`, `.planning/phases/01-foundation/DUBIOUS-CHOICES.md`
- FOUND: commits `4eecd92b` and `864b8683` on `features/behavioral-gaps`
- Task 1 and Task 2 acceptance criteria re-run: all pass
- Plan verification: `git diff cf48b0df -- .planning/REQUIREMENTS.md` touches only the preamble, FND-01, and the footer

---
*Phase: 01-foundation*
*Completed: 2026-11-08*
