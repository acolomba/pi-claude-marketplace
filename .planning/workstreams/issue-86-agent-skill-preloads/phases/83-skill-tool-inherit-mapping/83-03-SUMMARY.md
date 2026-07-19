---
phase: 83-skill-tool-inherit-mapping
plan: 03
subsystem: agents-bridge
tags: [agents-bridge, inheritSkills, tool-mapping, provenance-warning]

# Dependency graph
requires:
  - phase: 83-skill-tool-inherit-mapping
    provides: "83-01 DISALLOWED_SKILL_EXPECTED byte pin (D-83-06 disallowed gate) and 83-02 emitter seam (GeneratedFrontmatterFields.inheritSkills?, renderSkillLegend third state)"
  - phase: 82-agent-skill-preload-fidelity
    provides: "D-82-09 warning wording, legend renderer, convertSpecTree* test drivers, byte-identity corpus"
provides:
  - "ToolMappingResult.inheritSkills computed once in mapTools from raw Claude-side tokens (D-83-01: Skill declared AND not disallowed)"
  - "D-83-04 warning branch: skill-discovery wording for allowed agents, D-82-09 wording byte-unchanged for declared-but-disallowed"
  - "convertAgent threads inheritSkills into emitGeneratedAgentFile, driving the frontmatter line and legend annotation state"
  - "SKILL_INHERIT_WARNING / SKILL_DROP_WARNING_NO_INHERIT pinned constants; D-83-01 matrix, D-83-05 e2e, D-83-07 duplication pins"
affects: [skill-tool-inherit-mapping]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-boolean threading: one flag computed in mapTools drives warning wording, frontmatter emission, and legend annotation"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - tests/bridges/agents/convert.test.ts

key-decisions:
  - "legendEntryLine third parameter refactored to the exact annotation text via a three-literal union type, so pins name the D-83-05 state directly"
  - "mapToolTokens dropped its now-unused warnings parameter after the Skill push moved to mapTools (pure mapping/dropping)"
  - "Duplicate Skill tokens in tools: now warn exactly once (plan-specified single push; previously one warning per occurrence, unpinned edge)"

patterns-established:
  - "Warning wording branched on a capability flag, both wordings byte-pinned with the unchanged direction guarded by a raw-literal whole-file pin"

requirements-completed: [AGSK-05]

# Metrics
duration: 33min
completed: 2026-07-19
---

# Phase 83 Plan 03: inheritSkills Mapping and Phase Close Summary

**Skill-declared-and-allowed agents now convert with inheritSkills: true, the
D-83-04 skill-discovery warning, and on-demand legend annotations -- computed
from one boolean in mapTools and threaded through the 83-02 emitter seam,
with every unchanged direction proven byte-identical**

## Performance

- **Duration:** 33 min
- **Started:** 2026-07-19T16:59:31Z
- **Completed:** 2026-07-19T17:32:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `ToolMappingResult` gains `readonly inheritSkills: boolean`, computed once
  in `mapTools` from RAW Claude-side tokens: `Skill` present in the
  post-default token list AND absent from `splitCsv(rawDisallowed)` (exact
  match, case-sensitive, consistent with TOOL_MAP lookups). The raw-token
  check closes the disallow-bypass hazard (T-83-08): Skill has no TOOL_MAP
  entry, so the Pi-name filter can never see it
- The Skill-drop warning moved out of the `mapToolTokens` loop into
  `mapTools` after the disallow computation; `mapToolTokens` is pure
  mapping/dropping again. One warning per declaration, chosen by the flag:
  the new D-83-04 discovery wording when allowed, the D-82-09 wording
  byte-unchanged when disallowed. The tools-slot position in the aggregate
  warnings order is preserved
- `convertAgent` step 8 passes `inheritSkills: toolsResult.inheritSkills`
  into the emitter frontmatter, activating both the `inheritSkills: true`
  line and the `(available on demand)` legend state that 83-02 staged
- `splitCsv(rawDisallowed)` is computed once and reused by the existing
  Pi-name disallow filter (compute-once/reuse per the plan)
- Full pin coverage added: D-83-01 matrix (declared+allowed,
  declared+disallowed, not declared, omitted default), D-83-02 drop record,
  D-83-04 exact wording both directions, D-83-05 on-demand e2e plus both
  opposite directions, D-83-07 duplication pin, and the #86 canonical
  whole-file pin flipped exactly two byte ranges (`inheritSkills: true` and
  the warning line) with the legend entry still `(preloaded in your context)`

## Task Commits

Each task was committed atomically:

1. **Task 1: Compute the inherit flag, branch the warning, thread to the
   emitter** - `4a62c64c` (feat; task-level TDD RED observed on 5 failing
   declared-and-allowed pins before implementation)
2. **Task 2: Legend on-demand e2e pins, D-83-07 duplication pin, and phase
   gate** - `bdf963fc` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/agents/convert.ts` -
  ToolMappingResult extension, mapToolTokens purification, mapTools flag
  computation + warning branch, convertAgent threading
- `tests/bridges/agents/convert.test.ts` - constant rename
  (SKILL_DROP_WARNING -> SKILL_DROP_WARNING_NO_INHERIT, bytes unchanged) +
  SKILL_INHERIT_WARNING, four sanctioned carve-outs updated, D-83 pin suite
  added, legendEntryLine annotation-text refactor, stale disallowed-only
  comment refreshed

## Decisions Made

- `legendEntryLine`'s third parameter is a union of the three exact
  annotation strings rather than a free string, so a typo in a pin fails
  typecheck instead of silently asserting nothing
- `mapToolTokens` lost its unused `warnings` parameter (orphan removal from
  this plan's own restructure; the plan called the function's return to
  pure mapping/dropping)
- Duplicate `Skill` tokens in `tools:` now produce exactly one warning
  (plan-specified single push keyed on `skillDeclared`; the previous
  per-occurrence behavior was unpinned and byte-irrelevant to all fixtures)

## Deviations from Plan

### Process deviations

- The plan's execution note said "Do NOT run git commit -- the orchestrator
  commits"; the orchestrator instead directed per-task commits, made with
  the mandated SKIP=trufflehog prefix (same deviation as 83-01/83-02)
- Task 1 (tdd="true") was executed RED-observe-then-GREEN but landed as a
  single commit containing test + implementation: committing the RED test
  alone would break the NFR-6 quality bar (`npm run check` green at every
  commit), which takes precedence (same rationale as 83-02)

No functional deviations - the mapping, wording literals, and pins were
implemented exactly as the plan specified.

## Issues Encountered

- `pre-commit run trufflehog` cannot scan inside the worktree (`.git` is a
  file pointer, not a directory). Known limitation; all other hooks ran and
  passed, commits used the sanctioned `SKIP=trufflehog` prefix only
- Prettier reflowed the added test code on first `npm run check`; re-ran
  `prettier --write` and verified the file stayed pure ASCII with `→`
  escapes intact (0 literal arrows, 0 em dashes)

## User Setup Required

None - no external service configuration required.

## Verification Results

- 98/98 tests green across convert.test.ts, frontmatter.test.ts, and
  convert-byte-identity.test.ts; `npm run check` exit 0 (NFR-6 phase gate)
- `git diff --exit-code tests/bridges/agents/convert-byte-identity.test.ts`
  exit 0 -- the seven-class corpus survived the phase untouched
- `DISALLOWED_SKILL_EXPECTED` constant and test untouched across both
  commits (0 diff hunks) and green -- the D-83-06 disallowed direction holds
- `mapped to Pi skill discovery` appears exactly once in convert.ts and
  once in convert.test.ts; `skills discovery disabled` exactly once in
  convert.ts; `splitCsv(rawDisallowed)` exactly once in mapTools
- ROADMAP SC-1..SC-4 all pinned: canonical true-path whole-file, disallowed
  + corpus byte-identity, on-demand/not-available legend both directions,
  eager+lazy duplication

## Next Phase Readiness

- AGSK-05 complete; phase 83 is the final phase of the milestone's mapping
  work. The #86 canonical agent now converts end to end with
  `inheritSkills: true`, the discovery warning, and the preloaded legend
  entry
- Deferred (per CONTEXT, do not implement without demand): install-time
  opt-out flag for skill inheritance

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/bridges/agents/convert.ts
  (inheritSkills in ToolMappingResult and convertAgent threading)
- FOUND: tests/bridges/agents/convert.test.ts (SKILL_INHERIT_WARNING,
  SKILL_DROP_WARNING_NO_INHERIT, D-83-01/05/07 pins)
- FOUND: commit 4a62c64c
- FOUND: commit bdf963fc
- FOUND: 83-03-SUMMARY.md

---

*Phase: 83-skill-tool-inherit-mapping*
*Completed: 2026-07-19*
