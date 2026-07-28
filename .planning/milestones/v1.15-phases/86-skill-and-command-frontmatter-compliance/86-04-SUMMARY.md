---
phase: 86-skill-and-command-frontmatter-compliance
plan: 04
subsystem: bridges
tags: [frontmatter, parseFrontmatter, commands, neutralize, degrade]

# Dependency graph
requires:
  - phase: 86-01
    provides: "parseFrontmatter re-export through platform/pi-api.ts; malformed command reason token"
  - phase: 86-02
    provides: "degraded field on StageCommandsCommitResult (inert); install orchestrator maps command-kind degrade records to the {malformed command} token + per-component detail"
provides:
  - "Two read-only parseFrontmatter gates in bridges/commands/stage.ts (gate 1 on SOURCE before substitution, gate 2 on STAGED bytes after write)"
  - "Unparseable-source commands neutralized by stripping the entire malformed frontmatter block, so Pi loads name-from-filename + description-from-first-body-line (CMD-01 / D-86-07)"
  - "StageCommandsCommitResult.degraded now populated on the neutralize arm (was inert)"
affects:
  - "86-05 (orchestrated reconcile row consumes InstallPluginOutcome.degradedKinds, which now includes command)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two read-only parse gates around the commands staging seam, mirroring the skills bridge: gate 1 = attribution ground truth + degrade trigger; gate 2 = Pi-acceptability backstop (self-defect throws loudly)"
    - "Neutralize = strip the whole `---`...`---` block by delimiter index (line-ending agnostic, no re-encoding), leaving body bytes untouched -- distinct from the skills synthesize path"

key-files:
  created:
    - tests/bridges/_fixtures/unparseable-command-plugin/commands/bad-command.md
  modified:
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - tests/bridges/commands/stage.test.ts

key-decisions:
  - "Neutralize strips by the same `\\n---` delimiter search parseFrontmatter uses (indexOf on the source as-is), never a fixed byte offset -- surviving body bytes are byte-preserved (no CRLF normalization on the command path)"
  - "Commands get NO synthesized description and NO disable-model-invocation flag (that is the skills degrade shape); Pi's command loader has no non-empty-description gate, so the stripped body is sufficient"
  - "Gate-1 RETURN arm (including absent/empty frontmatter) is a byte-identical passthrough -- only ${CLAUDE_PLUGIN_ROOT}/${CLAUDE_PLUGIN_DATA} substitution changes bytes (NREG-01)"

patterns-established:
  - "parse gate 1 (source) / gate 2 (staged) discipline reused verbatim on the second bridge seam"

requirements-completed: [CMD-01, PARSE-01, PARSE-02, NREG-01]

coverage:
  - id: D1
    description: "Gate 1 parses the SOURCE command before substitution; a throw neutralizes by stripping the entire malformed frontmatter block, leaving the real body, and records a degrade entry"
    requirement: "CMD-01"
    verification:
      - kind: unit
        ref: "tests/bridges/commands/stage.test.ts#CMD-01 / PARSE-01 unparseable command source -> neutralized (whole frontmatter block stripped), degrade record"
        status: pass
    human_judgment: false
  - id: D2
    description: "Gate 2 re-parses the staged bytes as a Pi-acceptability backstop; the neutralized output re-parses (does not throw) and returns empty frontmatter"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "tests/bridges/commands/stage.test.ts#CMD-01 / PARSE-01 unparseable command source -> neutralized (whole frontmatter block stripped), degrade record"
        status: pass
    human_judgment: false
  - id: D3
    description: "The neutralized output carries no synthesized description and no disable-model-invocation flag; the degrade record carries the generated name + a non-empty parse error"
    requirement: "CMD-01"
    verification:
      - kind: unit
        ref: "tests/bridges/commands/stage.test.ts#CMD-01 / PARSE-01 unparseable command source -> neutralized (whole frontmatter block stripped), degrade record"
        status: pass
    human_judgment: false
  - id: D4
    description: "A valid command is staged byte-for-byte identical except variable substitution; the read-only gates mutate nothing on the happy path and the degrade list is empty"
    requirement: "NREG-01"
    verification:
      - kind: unit
        ref: "tests/bridges/commands/stage.test.ts#NREG-01 valid command is staged byte-for-byte identical except variable substitution (gates mutate nothing)"
        status: pass
    human_judgment: false
  - id: D5
    description: "After /reload, an unparseable command's /<generated-name> resolves with name-from-filename and a first-body-line description"
    requirement: "CMD-01"
    verification: []
    human_judgment: true
    rationale: "Runtime Pi command-loader + /reload behavior is a backstop truth; not exercisable in unit tests (needs a live Pi session)."

# Metrics
duration: 22min
completed: 2026-07-26
status: complete
---

# Phase 86 Plan 04: Command neutralize Summary

**The commands bridge now has the same two read-only parseFrontmatter gates as the skills bridge: an unparseable SOURCE command has its entire malformed `---`...`---` block stripped so Pi loads it with name-from-filename + description-from-first-body-line, surfacing a `malformed command` degrade record, while valid commands are proven byte-for-byte unchanged.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-07-26
- **Completed:** 2026-07-26
- **Tasks:** 1 (tracer)
- **Files modified:** 3 (2 modified, 1 fixture created)

## Accomplishments

- Gate 1 parses the SOURCE `.md` frontmatter before `substituteClaudeVars`. A throw routes to `neutralizeCommandFrontmatter`, which strips the entire malformed block; a return (including absent/empty frontmatter) keeps today's byte-identical passthrough.
- `neutralizeCommandFrontmatter` locates the closing delimiter via the same `\n---` search `parseFrontmatter` itself uses (from index 3), then slices everything after the closing delimiter line on the source as-is -- no fixed byte offset, no CRLF re-encoding, so the surviving body bytes are untouched (D-86-07 encoding-probe truth).
- Gate 2 re-parses the STAGED bytes after write as a Pi-acceptability backstop. The neutralized output is designed to RETURN empty; a throw there is our own substitution defect and propagates to the existing `appendLeakToError`/`cleanupStaging` catch, never masked as author degradation (PARSE-02 / D-86-04).
- `prepareStageCommands` now returns a populated `degraded: { generatedName, parseError }[]` list on the staged result (the field was added inert by the tracer). No install-orchestrator change was needed -- it already collects command-kind degrade records and emits `malformed command`.
- Commands get NO synthesized placeholder description and NO `disable-model-invocation` flag: that is the skills degrade shape. Pi's command loader has no non-empty-description gate, so the stripped body alone reproduces Claude Code's "body loads, metadata empty" behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Commands parse gates + neutralize arm, end-to-end to the degrade record** - `b3a39784` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/commands/stage.ts` - `parseFrontmatter` import, `neutralizeCommandFrontmatter` helper, gate 1 + gate 2 + degrade collection, populated `degraded` on the staged result
- `tests/bridges/commands/stage.test.ts` - unparseable-command neutralize case (CMD-01 / PARSE-01 / PARSE-02) + NREG-01 byte-equality case
- `tests/bridges/_fixtures/unparseable-command-plugin/commands/bad-command.md` - NEW malformed-frontmatter fixture (`title: Deploy: the whole thing` -- an unquoted `: ` mid-scalar that the `yaml` parser rejects)

## Decisions Made

None beyond the locked decisions (D-86-01..07) the plan already fixed. The neutralize transform was implemented as a small local helper (`neutralizeCommandFrontmatter`), symmetric with the skills bridge's local `extractBodyAfterFrontmatter`, keeping the change localized to the staging seam.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first `pre-commit run --files` invocation timed out at the 2-minute harness ceiling because the `npm-lint` / `npm-typecheck` hooks run repo-wide; re-running with a longer timeout completed clean (all hooks Passed). No code change was involved.

## User Setup Required

None.

## Next Phase Readiness

- Both bridge seams (skills, commands) now populate `degraded`; `InstallPluginOutcome.degradedKinds` includes `command` when a command neutralizes. Plan 05 (orchestrated reconcile row) reads that seam to push the token onto the reconcile `plugin-installed` arm.

## Self-Check: PASSED

- Fixture `tests/bridges/_fixtures/unparseable-command-plugin/commands/bad-command.md` exists on disk.
- Task commit `b3a39784` present in git history.
- `npm run typecheck` green; `eslint` + `prettier` clean on both touched source files; `node --test` across the commands stage + skills stage + install suites: 143 pass / 0 fail.

---
*Phase: 86-skill-and-command-frontmatter-compliance*
*Completed: 2026-07-26*
