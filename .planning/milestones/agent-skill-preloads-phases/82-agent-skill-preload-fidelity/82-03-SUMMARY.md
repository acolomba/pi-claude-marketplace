---
phase: 82-agent-skill-preload-fidelity
plan: 03
subsystem: agents-bridge
tags: [skill-mapping, qualified-names, provenance-warnings, agents-bridge, node-test]

# Dependency graph
requires:
  - phase: 82-01
    provides: "Byte-identity corpus gating the SC-5 invariant via git diff --exit-code"
  - phase: 82-02
    provides: "Dash-list folding so block-list skills:/tools: reach convert.ts as CSV in raw values"
provides:
  - "mapSkills qualifier handling: same-plugin `<plugin>:<skill>` tokens strip and delegate to generatedSkillName, converging with bare forms (AGSK-02, #86 mapping half)"
  - "Cross-plugin qualified skills warn-and-drop with an exact pinned sentence naming the full token"
  - "Stripped-remainder guards: `plugin:`, `plugin:.`, `plugin:..` warn-drop instead of throwing (T-82-06 mitigated)"
  - "mapTools pushes the exact D-82-09 warning when the dropped token is exactly `Skill`; all other drops stay silent (D-82-08, AGSK-03)"
  - "Aggregate warnings order pinned by deepEqual: tools slot strictly before skills slot"
affects: [82-04, 83]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token-mapping loop extracted to mapToolTokens helper to stay under the sonarjs cognitive-complexity budget (mirrors 82-02's applyFrontmatterLine extraction)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - tests/bridges/agents/convert.test.ts

key-decisions:
  - "Cross-plugin warning wording locked as the research-recommended sentence: skill reference \"<token>\" is qualified with a different plugin -- dropped (only this plugin's skills can be preloaded)"
  - "Unknown-skill warnings always name the FULL original token (qualifier included) so users can find it verbatim in source frontmatter"
  - "No dedupe added to the mapSkills emit list (byte-identity for duplicate-bearing bare-form agents; pi-subagents dedupes downstream)"

patterns-established:
  - "Warn-drop must never become a throw: guard stripped remainders before assertSafeName-backed name generation"
  - "Slot-scoped warnings: push warnings inside the mapper that owns the aggregate slot so convertAgent's assembly order never changes"

requirements-completed: [AGSK-02, AGSK-03]

# Metrics
duration: 7min
completed: 2026-07-19
---

# Phase 82 Plan 03: Qualified Skill Mapping and Skill-Drop Warning Summary

**mapSkills now maps same-plugin qualified tokens (`spec-tree:review-changes`)
identically to their bare forms and warn-drops cross-plugin qualifiers naming
the token; mapTools explains the dropped `Skill` tool with the exact D-82-09
provenance warning**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-19T14:55:09Z
- **Completed:** 2026-07-19T15:02:11Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- AGSK-02 (#86 mapping half): `skills: spec-tree:review-changes` from plugin
  `spec-tree` now emits `skills: spec-tree-review-changes`, byte-identical to
  the bare `review-changes` form; the redundant-prefix spelling
  `spec-tree:spec-tree-review-changes` converges on the same name through
  generatedSkillName's prefix elision
- Cross-plugin qualified tokens (`other-plugin:some-skill`) warn-and-drop
  with an exact pinned sentence naming the full token, never double-warning
  through the unknown-skill path and never reaching the emit list
- No new throw paths: `spec-tree:`, `spec-tree:.`, `spec-tree:..` warn-drop
  (assertSafeName would have thrown on the stripped remainders); pinned with
  assert.doesNotThrow
- AGSK-03: dropping the exact token `Skill` pushes the D-82-09 warning into
  mapTools' own warnings array (tools slot); wording byte-identical between
  convert.ts and the test pin (verified by raw-literal comparison, 165 chars);
  all other dropped tools keep today's silent droppedTools behavior (D-82-08)
- Aggregate warnings order pinned with assert.deepEqual on the full array:
  Skill-drop (tools slot) strictly before cross-plugin drop (skills slot)
- Provenance comment-breakout guard verified: a crafted `evil-->qual:skill`
  token leaves exactly one `-->` in the generated file (the comment
  terminator) via the inherited sanitizeProvenance path

## Task Commits

Both tasks were TDD (RED -> GREEN):

1. **Task 1 RED: failing pins for qualified skill mapping** - `66182191` (test)
2. **Task 1 GREEN: map plugin-qualified skill references in mapSkills** - `b9fbf4d2` (feat)
3. **Task 2 RED: failing pins for the Skill-drop warning** - `1b1b0747` (test)
4. **Task 2 GREEN: warn when the Skill tool is dropped** - `60a909bf` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/agents/convert.ts` - mapSkills
  qualifier split/strip/guard logic; mapToolTokens helper carrying the
  D-82-09 Skill-drop warning; mapTools delegates its drop loop to the helper
- `tests/bridges/agents/convert.test.ts` - twelve new pins: qualified/bare
  convergence, redundant-prefix convergence, cross-plugin exact-sentence
  drop, three no-throw guards, unchanged bare behavior (including duplicate
  emission), comment-breakout sanitization, exact D-82-09 wording, silent
  non-Skill drops, omitted-tools interaction, disallowedTools interaction,
  full warnings-order deepEqual

## Decisions Made

- Cross-plugin warning wording locked as the 82-RESEARCH.md recommended
  sentence (within Claude's-discretion polish): lowercase sentence, ASCII
  ` -- ` separator, quoted full token, rationale parenthetical
- Unknown-skill warnings name the FULL original token (e.g. `spec-tree:.`),
  not the stripped remainder, so the warning text is greppable in the source
- Per-task commits were made by this executor per the execution prompt,
  which overrides the plan objective's "orchestrator commits" note (same
  precedent as 82-01/82-02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] mapTools exceeded cognitive-complexity lint budget**

- **Found during:** Task 2 (GREEN implementation)
- **Issue:** Adding the Skill-warning branch inside the drop loop pushed
  `mapTools` to sonarjs cognitive complexity 16 (limit 15); `eslint` failed,
  blocking the NFR-6 quality gate
- **Fix:** Extracted the token-mapping loop into a private
  `mapToolTokens(tokens, warnings)` helper (same pattern as 82-02's
  `applyFrontmatterLine` extraction). Behavior unchanged: all 44 convert +
  byte-identity tests green before and after
- **Files modified:** extensions/pi-claude-marketplace/bridges/agents/convert.ts
- **Verification:** `npx eslint` clean; 44/44 tests green; corpus untouched
- **Committed in:** `60a909bf` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Structural extraction only; no behavior or scope change.

## Issues Encountered

- The plan predicted Task 1 Tests 4-5 (no-throw guards) would fail against
  the unmodified converter; they pass pre-fix, exactly as 82-RESEARCH.md's
  own analysis states (the full colon-bearing token smuggles past
  assertSafeName today and warn-drops via the knownSkills miss). They are
  guards against a naive qualifier-stripping implementation, not RED pins.
  Actual RED set for Task 1 was Tests 1-3 and 7; Task 2's RED set (Tests 1
  and 5) matched the plan exactly.
- Known worktree trufflehog limitation: commits used `SKIP=trufflehog` per
  project policy; the scan was confirmed clean earlier this session in
  filesystem mode. All other hooks ran and passed on every commit.

## Known Stubs

None - both mappings are complete and wired; no placeholder values.

## TDD Gate Compliance

- Task 1 RED: `66182191` test(82-03) - qualified mapping, cross-plugin
  wording, and comment-breakout pins failing as required
- Task 1 GREEN: `b9fbf4d2` feat(82-03) - 39/39 green
- Task 2 RED: `1b1b0747` test(82-03) - exact-wording and warnings-order pins
  failing as required
- Task 2 GREEN: `60a909bf` feat(82-03) - 44/44 green
- REFACTOR: folded into the Task 2 GREEN commit (helper extraction was
  required to pass the lint gate before the commit could land)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase SC-2 satisfied: `droppedTools: Skill` conversions carry the exact
  D-82-09 warning
- Phase SC-3 satisfied: cross-plugin qualified entries warn-and-drop naming
  the token; bare names map exactly as today (duplicates included)
- SC-1 mapping half satisfied: combined with 82-02's parser fix, the issue
  #86 fixture now parses AND maps to `skills: spec-tree-review-changes`
- Plan 82-04 (legend) can rely on mapSkills' emit list and the warnings
  wording pinned here; Phase 83 (AGSK-05) will branch the D-82-09 wording
  for Skill-declaring agents as designed
- Byte-identity corpus remains untouched and green for 82-04:
  `git diff --exit-code tests/bridges/agents/convert-byte-identity.test.ts`

## Self-Check: PASSED

- `tests/bridges/agents/convert.test.ts`: 37 pass / 0 fail;
  `tests/bridges/agents/convert-byte-identity.test.ts`: 7 pass / 0 fail
- Commits `66182191`, `b9fbf4d2`, `1b1b0747`, `60a909bf` present in git log
- `npm run check` exit 0 (typecheck + ESLint + Prettier + unit + integration)
- D-82-09 literal byte-identical between convert.ts and the test pin
  (raw-bytes comparison, 165 chars, 1 occurrence each)
- Footprint `git diff --name-only 66182191^..HEAD` is exactly the two owned
  files; `domain/name.ts` and `frontmatter.ts` have no diff

---

*Phase: 82-agent-skill-preload-fidelity*
*Completed: 2026-07-19*
