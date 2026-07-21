---
phase: 82-agent-skill-preload-fidelity
plan: 02
subsystem: agents-bridge
tags: [frontmatter-parser, dash-list-folding, agents-bridge, node-test]

# Dependency graph
requires:
  - phase: 82-01
    provides: "Byte-identity corpus gating the SC-5 invariant via git diff --exit-code"
provides:
  - "Dash-list folding in parseFrontmatter: empty-value key + `- item` lines fold into a comma-joined CSV value for ANY key (D-82-01)"
  - "Verbatim dash items: `- spec-tree:review-changes` never colon-split (#86 root mechanism fixed at the parser)"
  - "Mixed-form rule pinned: inline value wins, dash items ignored (D-82-03)"
  - "Parser comments describe the folding contract; stale no-list claim removed"
affects: [82-03, 82-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-line frontmatter parsing extracted to applyFrontmatterLine with explicit FoldState, keeping parseFrontmatter under the cognitive-complexity lint budget"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - tests/bridges/agents/frontmatter.test.ts

key-decisions:
  - "D-82-03 discretion locked as inline-value-wins: dash items under a non-empty inline value are ignored, documented in the parser comment and pinned by a test"
  - "Mixed-form pin includes a colon-bearing dash item (- Write:x) so the test is RED against the unmodified parser (a colon-free dash line alone was already skipped pre-fix)"
  - "Fold state extracted into applyFrontmatterLine helper to satisfy sonarjs/cognitive-complexity (22 -> under 15)"

patterns-established:
  - "Dash-folded values are comma-joined strings consumed by splitCsv downstream with zero splitCsv changes; quotes stay intact for splitCsv to strip per item"

requirements-completed: [AGSK-01]

# Metrics
duration: 8min
completed: 2026-07-19
---

# Phase 82 Plan 02: Parser Dash-List Folding Summary

**parseFrontmatter now folds block-list `- item` lines into comma-joined CSV
values for any empty-value key, taking items verbatim so
`- spec-tree:review-changes` is never colon-split (AGSK-01, #86)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-19T14:43:22Z
- **Completed:** 2026-07-19T14:51:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Dash-list folding implemented per D-82-01: a key with an empty inline value
  followed by `- item` continuation lines folds the items comma-joined into
  that key's value, for ANY key; unsupported list keys now land in
  droppedFields as one clean name with no bogus `- token` keys
- The issue #86 root mechanism is fixed at the parser: dash lines are handled
  BEFORE the first-colon split, so `- spec-tree:review-changes` folds
  verbatim into `raw.skills` instead of producing a bogus `- spec-tree` key
- D-82-03 mixed-form rule locked and pinned: inline value wins, dash items
  beneath it are ignored
- Seven new parser pins (colon-bearing fold, multi-item fold, clean
  unsupported-key raw, mixed form, orphan/bare dash, CRLF twin,
  unchanged CSV/inline-array/empty-value forms); all 17 pre-existing
  frontmatter tests still green, AG-6 colon tolerance included
- Lenient line-based parser kept, no YAML dependency added (D-82-02)
- Byte-identity corpus from 82-01 untouched and 7/7 green

## Task Commits

Task 1 was TDD (RED -> GREEN); Task 2 was a comment/gate task:

1. **Task 1 RED: failing dash-list folding parser pins** - `3d6bde04` (test)
2. **Task 1 GREEN: fold dash-list frontmatter values into CSV** - `30050975` (feat)
3. **Task 2: describe dash-list folding in parser comments** - `5bab7f7a` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` -
  dash-list folding via FoldState + applyFrontmatterLine; module header and
  parseFrontmatter doc comment rewritten to describe the folding contract,
  the D-82-03 inline-wins rule, and the comma-in-item limitation
- `tests/bridges/agents/frontmatter.test.ts` - seven new parser pins
  anchored AGSK-01 / D-82-01 / D-82-03 / #86

## Decisions Made

- D-82-03 (Claude's discretion per 82-CONTEXT.md): inline value wins and
  dash items beneath a non-empty value are ignored - matches the stated
  inclination, documented in the parser comment, pinned by a test
- The mixed-form pin uses dash items `- Edit` AND `- Write:x` under
  `tools: Read`: the colon-bearing item makes the test RED against the
  unmodified parser (which created a bogus `- Write` key), while the
  plan's literal `- Edit`-only shape already passed pre-fix
- Per-task commits were made by this executor per the execution prompt,
  which overrides the plan objective's "orchestrator commits" note (same
  precedent as 82-01)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] parseFrontmatter exceeded cognitive-complexity lint budget**

- **Found during:** Task 1 (GREEN implementation)
- **Issue:** Adding the fold branch inline pushed `parseFrontmatter` to
  sonarjs cognitive complexity 22 (limit 15); `eslint` failed, blocking the
  NFR-6 quality gate
- **Fix:** Extracted the per-line logic into a private
  `applyFrontmatterLine(raw, state, rawLine)` helper with an explicit
  `FoldState` interface; parseFrontmatter keeps the delimiter handling and a
  simple loop. Behavior unchanged (all 24 frontmatter tests green before and
  after the extraction)
- **Files modified:** extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
- **Verification:** `npx eslint` clean; 122/122 agents-bridge tests green
- **Committed in:** `30050975` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Structural extraction only; no behavior or scope change.

## Issues Encountered

None beyond the known worktree trufflehog limitation: commits used
`SKIP=trufflehog` per project policy (hook auto-updater cannot spawn in the
worktree sandbox); the scan was confirmed clean earlier this session in
filesystem mode. All other hooks ran and passed on every commit.

## Known Stubs

None - the folding implementation is complete and wired; no placeholder
values or dead branches.

## TDD Gate Compliance

- RED: `3d6bde04` test(82-02) - 6 new pins failing against the unmodified
  parser exactly as specified; Test 7 (unchanged forms) already passing
- GREEN: `30050975` feat(82-02) - all 24 frontmatter tests green
- REFACTOR: folded into the GREEN commit (helper extraction was required to
  pass the lint gate before the commit could land)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Parser half of phase SC-1 is done: issue #86 frontmatter parses to
  `raw.skills === "spec-tree:review-changes"`
- Folded values flow to convert.ts `splitCsv` unchanged - plan 82-03
  (mapSkills qualifier handling, same wave) and 82-04 (legend) can build on
  `raw` values without parser concerns
- Byte-identity corpus remains the SC-5 gate for 82-03/82-04:
  `git diff --exit-code tests/bridges/agents/convert-byte-identity.test.ts`

## Self-Check: PASSED

- `tests/bridges/agents/frontmatter.test.ts`: 24 pass / 0 fail
- `tests/bridges/agents/convert-byte-identity.test.ts`: 7 pass / 0 fail,
  `git diff --exit-code` clean (corpus untouched)
- Commits `3d6bde04`, `30050975`, `5bab7f7a` present in git log
- `npm run check` exit 0 (typecheck + ESLint + Prettier + unit + integration)
- Footprint `git diff --name-only 3d6bde04^..HEAD` is exactly the two owned
  files
- No YAML import in frontmatter.ts; stale "no list-of-dash arrays" phrase
  removed; `D-82-03` present in parser comments

---

*Phase: 82-agent-skill-preload-fidelity*
*Completed: 2026-07-19*
