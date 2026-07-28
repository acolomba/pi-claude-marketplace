---
phase: 86-skill-and-command-frontmatter-compliance
plan: 01
subsystem: bridges
tags: [frontmatter, parseFrontmatter, notify-catalog, yaml, skills, degrade]

# Dependency graph
requires: []
provides:
  - "parseFrontmatter re-exported through platform/pi-api.ts as the sole sanctioned import site, with pinned throw/return semantics"
  - "REASONS catalog amended to 37 entries: malformed skill + malformed command failure-class tokens"
  - "bridges/skills/frontmatter-degrade.ts pure-string helper module (synth block, first-paragraph, when_to_use fold, 1,536 truncation, block-scalar-safe description set)"
affects:
  - "86-02 (tracer: skills/commands staging gates consume parseFrontmatter + degrade helpers)"
  - "86-03 / 86-04 / 86-05 (expansion: reason-token wiring, command neutralize, gate-2 backstop)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only parse-to-validate (never eval) preserves T-03-17 injection safety"
    - "Surgical single-key YAML node-span replacement + safe double-quoted scalar emit (never whole-block re-emit)"
    - "Closed-set tail append + compile-time completeness proof (_ReasonsCoverageProof) as the lockstep guard"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts
    - tests/bridges/skills/frontmatter-degrade.test.ts
    - tests/bridges/_fixtures/skill-no-description/SKILL.md
    - tests/bridges/_fixtures/skill-block-scalar-description/SKILL.md
    - tests/bridges/_fixtures/skill-heading-codeblock-body/SKILL.md
  modified:
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - tests/platform/pi-api.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/shared/notify-v2.test.ts

key-decisions:
  - "parseFrontmatter re-export is the ONLY sanctioned import site for byte-identical accept/reject parity with Pi's loaders (PARSE-01)"
  - "Two dedicated per-kind tokens (malformed skill / malformed command) under FAILURE_REASONS, not a shared bucket (D-86-01 / CLASS-01)"
  - "setDescriptionScalar replaces the full description node span (incl. >- / | block scalars), never a lone description: line (SKILL-03 corruption class)"
  - "truncate1536 keeps the 1,536 UTF-16-code-unit cap (D-86-05), not Pi's 1,024 warning threshold"

patterns-established:
  - "Pure string-in/string-out degrade helpers, READ-ONLY toward author input"
  - "Safe double-quoted scalar emitter (escape backslash then quote, collapse newlines) blocks AG-8 provenance-injection"

requirements-completed: [CLASS-01, SKILL-02, WTU-01, WTU-02]

coverage:
  - id: D1
    description: "parseFrontmatter re-exported through platform/pi-api.ts with test-pinned throw/return semantics (valid closed block parses; missing/unclosed delimiter returns empty without throwing; malformed closed block throws)"
    requirement: "PARSE-01"
    verification:
      - kind: unit
        ref: "tests/platform/pi-api.test.ts#PARSE-01: parseFrontmatter THROWS on a closed block whose inner YAML is malformed"
        status: pass
    human_judgment: false
  - id: D2
    description: "REASONS catalog grows 35->37 with malformed skill + malformed command under FAILURE_REASONS; byte-stable tail append; _ReasonsCoverageProof compiles; installed row renders (installed) {malformed skill} at warning severity"
    requirement: "CLASS-01"
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: REASONS is the closed 37-entry reason set"
        status: pass
      - kind: unit
        ref: "tests/shared/notify-v2.test.ts#CLASS-01 / D-86-01: installed row renders `(installed) {malformed skill}` at warning severity"
        status: pass
    human_judgment: false
  - id: D3
    description: "firstBodyParagraph derives description from the first genuine body line, skipping blanks/ATX headings/fenced code blocks (D-86-06)"
    requirement: "SKILL-02"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/frontmatter-degrade.test.ts#SKILL-02 / D-86-06: firstBodyParagraph skips blank lines, ATX headings, and fenced code blocks, then returns the first prose paragraph"
        status: pass
    human_judgment: false
  - id: D4
    description: "foldWhenToUse joins description + when_to_use with a single \\n and adds no separator when when_to_use is empty/absent (WTU-01)"
    requirement: "WTU-01"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/frontmatter-degrade.test.ts#WTU-01: foldWhenToUse with an empty or absent when_to_use returns the description unchanged (no trailing separator)"
        status: pass
    human_judgment: false
  - id: D5
    description: "truncate1536 hard-cuts combined text at 1,536 UTF-16 code units (no ellipsis), leaves <=1536 unchanged, empty returns empty (WTU-02)"
    requirement: "WTU-02"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/frontmatter-degrade.test.ts#WTU-02: truncate1536 hard-cuts a 1537-char string to exactly 1536 code units (no ellipsis)"
        status: pass
    human_judgment: false
  - id: D6
    description: "setDescriptionScalar replaces the full description node span incl. >- block scalars with a safe double-quoted scalar, leaving siblings unchanged; author value cannot re-form a YAML key"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/frontmatter-degrade.test.ts#SKILL-03: setDescriptionScalar replaces a `>-` block-scalar description with a single safe scalar and leaves sibling keys unchanged"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-07-26
status: complete
---

# Phase 86 Plan 01: Pre-tracer foundations Summary

**parseFrontmatter surfaced through the Pi-API boundary, the closed REASONS catalog amended to 37 with per-kind `malformed skill`/`malformed command` tokens, and a pure-string skills degrade-helper module (synth block, first-paragraph, when_to_use fold, 1,536 truncation, block-scalar-safe description set) with full unit coverage.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-26
- **Completed:** 2026-07-26
- **Tasks:** 3
- **Files modified:** 11 (6 modified, 5 created)

## Accomplishments
- `parseFrontmatter` is now importable ONLY from `platform/pi-api.ts`, with a doc comment pinning the verified throw/return semantics (missing/unclosed delimiter -> empty without throwing; closed malformed block -> throws) the staging gates branch on.
- The closed `REASONS` tuple grew 35 -> 37 with `malformed skill` then `malformed command` appended after `malformed mcp` (existing 35 byte-identical); both filed under `FAILURE_REASONS`, the `_ReasonsCoverageProof` self-satisfies, and the `(installed) {malformed skill}` warning row is render-tested.
- New `bridges/skills/frontmatter-degrade.ts` concentrates the phase's central technical risk (NREG-safe single-key YAML set) into five pure, unit-tested helpers plus a safe double-quoted scalar emitter.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-export parseFrontmatter through the Pi-API boundary** - `ff4b6f88` (feat)
2. **Task 2: Amend the closed REASONS catalog with two per-kind failure-class tokens** - `e88cc445` (feat)
3. **Task 3: Create the pure-string skills degrade-helper module + Wave-0 tests** - `a2b0d00f` (feat)

_TDD note: the whole-project `tsc --noEmit` pre-commit hook rejects a RED commit whose test imports a not-yet-created module, so Task 3's test + implementation landed in one atomic commit (GREEN) rather than separate RED/GREEN commits. All behaviors were still written test-first and verified failing→passing locally before the commit._

## Files Created/Modified
- `extensions/pi-claude-marketplace/platform/pi-api.ts` - re-export `parseFrontmatter` + semantics doc comment (PARSE-01)
- `extensions/pi-claude-marketplace/shared/notify.ts` - append `malformed skill` / `malformed command` to REASONS; bump tuple-doc count to 37
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` - add both tokens to FAILURE_REASONS
- `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts` - NEW helper module (5 exports + safe scalar emitter)
- `tests/platform/pi-api.test.ts` - PARSE-01 throw/return cases
- `tests/architecture/notify-closed-set-locks.test.ts` - REASONS.length lock 35 -> 37
- `tests/shared/notify-v2.test.ts` - tail-order + `(installed) {malformed skill}` render tests
- `tests/bridges/skills/frontmatter-degrade.test.ts` - NEW helper unit test (14 cases)
- `tests/bridges/_fixtures/skill-no-description/SKILL.md`, `skill-block-scalar-description/SKILL.md`, `skill-heading-codeblock-body/SKILL.md` - NEW fixtures

## Decisions Made
None beyond the locked decisions (D-86-01..07) and research assumptions (A1/A2/A4) the plan already fixed. The placeholder description string was chosen within D-86-02's discretion as `Source frontmatter could not be parsed.`

## Deviations from Plan

None - plan executed exactly as written. One precision correction (not a code deviation): the `parseFrontmatter` doc comment and its test were tightened to reflect that the body is `.trim()`ed only on the frontmatter-present path (the no-delimiter path returns the body normalized-but-untrimmed) — the plan/research had stated an unconditional trim.

## Issues Encountered
- The whole-project `tsc --noEmit` pre-commit hook made a TDD RED-first commit (test importing a missing module) impossible; resolved by landing Task 3's test + module in one atomic GREEN commit (documented above).
- The `(installed)` warning row prepends an "A plugin operation needs attention." preamble at `warning` severity; the render test's expected value was set to match the actual byte form.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Leaf dependencies for the tracer (Plan 02) are in place: the parse boundary, the two catalog tokens, and the degrade helpers are all committed and unit-green.
- Plan 02 wires these into `bridges/skills/stage.ts` and `bridges/commands/stage.ts` (gate 1 + gate 2) and threads the degrade signal into the standalone + orchestrated reason-row composers.

## Self-Check: PASSED

- All created files exist on disk (degrade module, test, 3 fixtures).
- All three task commits present in git history (`ff4b6f88`, `e88cc445`, `a2b0d00f`).
- `npm run typecheck` green; `node --test` across all four plan test files: 178 pass / 0 fail.

---
*Phase: 86-skill-and-command-frontmatter-compliance*
*Completed: 2026-07-26*
