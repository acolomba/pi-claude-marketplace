---
phase: 83-skill-tool-inherit-mapping
plan: 01
subsystem: testing
tags: [agents-bridge, byte-identity, node-test, inheritSkills]

# Dependency graph
requires:
  - phase: 82-agent-skill-preload-fidelity
    provides: "D-82-09 Skill-drop warning wording and the convertSpecTree / makeDiscovered test helpers the pin replays"
provides:
  - "DISALLOWED_SKILL_EXPECTED raw-literal whole-file constant in tests/bridges/agents/convert.test.ts"
  - "AGSK-05 / D-83-06 disallowed-direction pin test: exact-equality gate proving Skill-declared-but-disallowed agents keep pre-AGSK-05 bytes"
affects: [83-02, 83-03, skill-tool-inherit-mapping]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-change whole-file byte capture: pin expected output from unmodified HEAD before touching the converter"

key-files:
  created: []
  modified:
    - tests/bridges/agents/convert.test.ts

key-decisions:
  - "Pin constant holds raw literal bytes (no interpolated test constants) so later constant renames cannot silently loosen the gate"
  - "REQUIREMENTS.md AGSK-05 left Pending: this plan is the guard pin only; 83-02/83-03 deliver the mapping"

patterns-established:
  - "Disallowed-direction gate: D-83-01 branch coverage keyed on declared-AND-allowed, guarded by an exact-equality pin on the declared-but-disallowed class"

requirements-completed: [AGSK-05]

# Metrics
duration: 6min
completed: 2026-07-19
---

# Phase 83 Plan 01: Disallowed-Skill Byte Pin Summary

**Whole-file byte pin of the Skill-declared-but-disallowed converter output,
captured from unmodified pre-AGSK-05 HEAD as the D-83-06 gate for the rest of
the phase**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-19T16:36:28Z
- **Completed:** 2026-07-19T16:42:35Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Captured the exact `fileContent` bytes the converter emits at current HEAD
  for an agent declaring `Skill` in `tools:` AND listing it in
  `disallowedTools` (scratch script, no repo files touched)
- Pinned those bytes as the raw-literal `DISALLOWED_SKILL_EXPECTED`
  module-level constant plus an exact-equality test in
  `tests/bridges/agents/convert.test.ts`, green against unmodified source
- The pin asserts all three facets: `droppedTools` is exactly `["Skill"]`
  (drop record independent of the disallow), frontmatter carries
  `inheritSkills: false`, and the ENTIRE generated file equals the captured
  bytes

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture the HEAD fileContent for the declared-but-disallowed
   input** - no commit (scratch-only capture, no repo files modified by
   design)
2. **Task 2: Pin the disallowed-direction bytes in convert.test.ts** -
   `73b92f15` (test)

## Files Created/Modified

- `tests/bridges/agents/convert.test.ts` - adds `DISALLOWED_SKILL_EXPECTED`
  (raw template literal, zero `${` interpolations, pure ASCII) and the test
  "AGSK-05 / D-83-06 Skill declared but disallowed is pinned at pre-AGSK-05
  bytes" immediately after the AGSK-03 disallowed-only test

## Decisions Made

- The pin's expected constant holds literal bytes rather than interpolating
  `SKILL_DROP_WARNING`, so a later rename or rewording of that constant
  cannot touch the gate (plan-specified; verified with a `${`-count of 0)
- `requirements.mark-complete AGSK-05` deliberately NOT run: AGSK-05 is
  delivered by plans 83-02/83-03; this plan only erects the byte-identity
  guard. REQUIREMENTS.md keeps AGSK-05 as Pending.

## Deviations from Plan

None - plan executed exactly as written. (The plan's execution note said the
orchestrator commits; the orchestrator instead directed per-task commits,
which were made with the mandated SKIP=trufflehog prefix.)

## Issues Encountered

- `pre-commit run trufflehog --all-files` cannot run inside the worktree
  (trufflehog fails to read `.git/index` because `.git` is a file pointer,
  not a directory). This is the known worktree limitation; all other hooks
  ran and passed, and the commit used the sanctioned `SKIP=trufflehog`
  prefix only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The D-83-06 disallowed-direction gate is in place: plans 83-02 and 83-03
  can now key the D-83-04 warning branch and the `inheritSkills` flag on the
  declared-AND-allowed boolean, with this pin failing loudly if the
  disallowed class picks up the new wording (83-RESEARCH Pitfall 1 guard)
- `npm run check` green at HEAD with the pin included; byte-identity corpus
  test untouched and green

## Self-Check: PASSED

- FOUND: tests/bridges/agents/convert.test.ts (DISALLOWED_SKILL_EXPECTED
  present, zero interpolations)
- FOUND: commit 73b92f15
- FOUND: 83-01-SUMMARY.md

---

*Phase: 83-skill-tool-inherit-mapping*
*Completed: 2026-07-19*
