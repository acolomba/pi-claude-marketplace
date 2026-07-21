---
phase: 82-agent-skill-preload-fidelity
plan: 04
subsystem: agents-bridge
tags: [skill-legend, body-scan, agents-bridge, node-test, issue-86]

# Dependency graph
requires:
  - phase: 82-01
    provides: "Byte-identity corpus gating the SC-5 invariant via git diff --exit-code"
  - phase: 82-02
    provides: "Dash-list folding so the #86 block-list skills: reaches convert.ts as CSV"
  - phase: 82-03
    provides: "Qualified skill mapping and the exact D-82-09 Skill-drop warning"
provides:
  - "SkillLegendEntry type and optional legend field on emitGeneratedAgentFile; locked D-82-05 block rendered between provenance comment and body (D-82-04)"
  - "detectSkillTokens body scanner: lookbehind boundary, dot-free candidate class, knownSkills gating (D-82-06), whole-body scan including fences (D-82-07), first-occurrence dedupe"
  - "Reference-gated byte identity: undefined/empty legend keeps the pre-legend layout exactly; token-free bodies pinned against a pre-wiring constant"
  - "Issue #86 canonical end-to-end pin: full parse -> convert with whole-file assert.equal plus per-SC-facet assertions"
affects: [83]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Legend byte assembly stays behind the frontmatter.ts single seam; convert.ts only builds SkillLegendEntry[] data"
    - "Unicode output bytes written as escape sequences in .ts literals (arrow as backslash-u2192) so source stays ASCII and hook-stable"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - tests/bridges/agents/frontmatter.test.ts
    - tests/bridges/agents/convert.test.ts

key-decisions:
  - "Annotations locked as ASCII parenthesized forms (preloaded in your context) / (not available in this session) with the U+2192 arrow on both entry kinds, per the plan's resolved discretion choices"
  - "Scanner guards the plugin-prefix-only candidate (elides to empty in generatedSkillName) so a body scan can never throw"

patterns-established:
  - "Legend data/rendering split: detection returns plain data; every byte-layout decision lives in emitGeneratedAgentFile"

requirements-completed: [AGSK-04]

# Metrics
duration: 14min
completed: 2026-07-19
---

# Phase 82 Plan 04: Skill Legend and Issue #86 End-to-End Summary

**Generated agents whose body references `<plugin>:<skill>` tokens now carry
the converter-authored skill legend right after the provenance comment, with
preloaded/not-available annotations gated on knownSkills; the issue #86
canonical agent is pinned end to end byte for byte**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-19T15:07:31Z
- **Completed:** 2026-07-19T15:21:40Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- D-82-04/D-82-05: `emitGeneratedAgentFile` accepts an optional
  `legend?: readonly SkillLegendEntry[]` and renders the locked
  `## Pi coding agent skill legend` block between the provenance comment and
  the body; undefined/empty legend keeps the pre-legend byte layout exactly
  (pinned against a constant captured from the pre-change emitter)
- D-82-06: `detectSkillTokens` scans the substituted body with
  `(?<![A-Za-z0-9_:-])<plugin>:([A-Za-z0-9_-]+)`; only same-plugin tokens
  resolving into knownSkills get an entry, annotated
  `(preloaded in your context)` when the generated name is in the emitted
  `skills:` list, `(not available in this session)` otherwise; cross-plugin,
  unknown-skill, embedded-word, and punctuation edges all test-pinned
- D-82-07: the whole body is scanned verbatim -- a token appearing only
  inside a fenced code block still yields a legend entry (pinned)
- AGSK-04 reference-gating: a token-free body converts byte-identical to the
  pre-wiring output (exact pin) and the 82-01 seven-class corpus survived the
  entire phase unmodified
- Issue #86 canonical agent (`tools: Bash, Read, Skill` + block-list
  `skills: - spec-tree:review-changes`) converts end to end through
  parseFrontmatter -> convertAgent with `tools: bash,read`,
  `skills: spec-tree-review-changes`, clean droppedFields,
  `droppedTools: Skill` + the exact D-82-09 warning, and the preloaded legend
  entry -- each SC facet asserted individually plus one whole-file
  assert.equal; the reference-gated twin (no body token) pins legend absence
- Phase gate green: `npm run check` exit 0 (2958/2958 unit, 16/16
  integration)

## Task Commits

Tasks 1-2 were TDD (RED -> GREEN); Task 3 was the e2e pin and phase gate:

1. **Task 1 RED: failing pins for skill legend rendering** - `bc073e71` (test)
2. **Task 1 GREEN: render skill legend in emitGeneratedAgentFile** - `1d638c22` (feat)
3. **Task 2 RED: failing pins for body skill-token detection** - `cf6d9df2` (test)
4. **Task 2 GREEN: detect body skill tokens and wire the legend** - `ea68bedd` (feat)
5. **Task 3: pin the issue #86 canonical end-to-end conversion** - `6e69802e` (test)
6. **Deviation pin: plugin-prefix-only scanner guard** - `abb5c45c` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` -
  SkillLegendEntry interface, optional legend emit field, private
  renderSkillLegend with the locked block bytes (arrow as an escape)
- `extensions/pi-claude-marketplace/bridges/agents/convert.ts` - private
  escapeRegExp + detectSkillTokens helpers; convertAgent wires the detected
  legend into the emitter between steps 7 and 8
- `tests/bridges/agents/frontmatter.test.ts` - three legend byte-layout pins
  (undefined / empty / two-entry full-output constants)
- `tests/bridges/agents/convert.test.ts` - ten detection-edge pins plus the
  #86 canonical end-to-end whole-file pin and its reference-gated twin

## Decisions Made

- Encoded the plan's resolved discretion choices exactly: ASCII parenthesized
  annotations, Pi-name mapping with the U+2192 arrow on BOTH entry kinds,
  first-occurrence dedupe by token, arrow written as an escape in every .ts
  literal
- The canonical whole-file pin interpolates the SKILL_DROP_WARNING constant
  (plan-sanctioned reuse of the 82-03 pinned literal) while the legend entry
  line is raw literal bytes
- Per-task commits were made by this executor per the execution prompt,
  which overrides the plan objective's "orchestrator commits" note (same
  precedent as 82-01..82-03)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Guarded the plugin-prefix-only scanner candidate that would throw**

- **Found during:** Task 2 (detectSkillTokens implementation)
- **Issue:** The plan (and threat register row T-82-12) asserted the
  candidate class `[A-Za-z0-9_-]+` structurally excludes every
  assertSafeName throw path. Confirming against name.ts per the read_first
  instruction showed one remaining path: a body candidate of exactly
  `<plugin>-` (e.g. `spec-tree:spec-tree-`) elides to an empty skill name
  inside generatedSkillName, which throws -- turning a body scan into a
  failed conversion for an input that converts fine today
- **Fix:** detectSkillTokens skips the `<plugin>-` candidate before
  delegation (matching the "warn-drop must never become a throw" pattern
  from mapSkills); pinned with an assert.doesNotThrow test
- **Files modified:** extensions/pi-claude-marketplace/bridges/agents/convert.ts,
  tests/bridges/agents/convert.test.ts
- **Verification:** 49/49 convert tests green; corpus untouched
- **Committed in:** `ea68bedd` (guard) and `abb5c45c` (test pin)

---

**Total deviations:** 1 auto-fixed (1 bug/threat-mitigation completeness)
**Impact on plan:** One extra skip branch and one test; no scope creep.

## Issues Encountered

- The plan predicted Task 2 Tests 1-8 would fail RED with Test 9 passing;
  actual RED set was Tests 1, 2, 6, 7, 8 -- Tests 3, 4, 5 assert legend
  ABSENCE and pass trivially against the unwired converter. They are guards
  against a naive scanner, not RED pins (same situation 82-03 documented for
  its no-throw guards)
- Known worktree trufflehog limitation: commits used `SKIP=trufflehog` per
  project policy; the scan was confirmed clean earlier this session in
  filesystem mode. All other hooks ran and passed on every commit

## Known Stubs

None - detection and rendering are complete and wired end to end.

## TDD Gate Compliance

- Task 1 RED: `bc073e71` test(82-04) - legend-rendering pin failing as
  required (Test 3); Tests 1-2 are byte-layout pins that pass pre-change by
  design
- Task 1 GREEN: `1d638c22` feat(82-04) - 27/27 frontmatter tests green
- Task 2 RED: `cf6d9df2` test(82-04) - five detection pins failing as
  required
- Task 2 GREEN: `ea68bedd` feat(82-04) - 46/46 convert tests green
- REFACTOR: not needed; no post-GREEN cleanup commits

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 82 is complete: all four plans have summaries; SC-1..SC-5 are
  test-pinned (parser folding, qualified mapping, Skill-drop warning,
  legend, byte identity)
- Phase 83 (AGSK-05, `Skill` tool -> `inheritSkills: true`) can branch the
  D-82-09 warning wording and extend the legend with an
  available-on-demand state; the legend seam (SkillLegendEntry +
  renderSkillLegend) is the extension point
- The byte-identity corpus remains authoritative for any Phase 83
  byte-identical carve-outs

## Self-Check: PASSED

- Commits `bc073e71`, `1d638c22`, `cf6d9df2`, `ea68bedd`, `6e69802e`,
  `abb5c45c` present in git log
- All four files_modified exist on disk; footprint
  `git diff --name-only bc073e71^..HEAD` is exactly those four files
- `tests/bridges/agents/frontmatter.test.ts`: 27 pass / 0 fail;
  `tests/bridges/agents/convert.test.ts`: 49 pass / 0 fail;
  `tests/bridges/agents/convert-byte-identity.test.ts`: 7 pass / 0 fail with
  `git diff --exit-code` clean
- `npm run check` exit 0 (typecheck + ESLint + Prettier + unit + integration)
- No literal U+2192/U+2014 in any .ts source; arrow escapes present
  (`grep -c 'u2192'` = 2 in frontmatter.ts)
- `git status --porcelain` clean after final task commit

---

*Phase: 82-agent-skill-preload-fidelity*
*Completed: 2026-07-19*
