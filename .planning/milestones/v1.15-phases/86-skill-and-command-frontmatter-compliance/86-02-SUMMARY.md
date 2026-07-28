---
phase: 86-skill-and-command-frontmatter-compliance
plan: 02
subsystem: bridges
tags: [frontmatter, parseFrontmatter, skills, degrade, install-orchestrator, notify]

# Dependency graph
requires:
  - phase: 86-01
    provides: "parseFrontmatter re-export through platform/pi-api.ts, malformed skill/command reason tokens, synthesizeUnparseableSkill degrade helper"
provides:
  - "Two read-only parseFrontmatter gates in bridges/skills/stage.ts (gate 1 on SOURCE before rewrite/substitution, gate 2 on STAGED bytes after write)"
  - "Unparseable-source skills synthesize a disable-model-invocation block (body verbatim) and install without hard-failing (SKILL-01)"
  - "Per-component degrade record threaded bridge -> install orchestrator -> standalone (installed) {malformed skill} row at warning severity (WARN-01)"
  - "degraded field on StageSkillsCommitResult + StageCommandsCommitResult (commands inert until neutralize arm lands)"
  - "InstallPluginOutcome.degradedKinds inert seam for the orchestrated reconcile row"
affects:
  - "86-03 (skills augment arm builds on the gate-1 RETURN branch)"
  - "86-04 (commands neutralize populates StageCommandsCommitResult.degraded)"
  - "86-05 (orchestrated reconcile row consumes InstallPluginOutcome.degradedKinds)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two read-only parse gates around a staging seam: gate 1 = attribution ground truth + degrade trigger; gate 2 = Pi-acceptability backstop (self-defect throws loudly, never author-attributed)"
    - "One-token-per-plugin reason on the (installed) row (mirrors orphan rewake), with per-component free-text detail on the orchestrated postCommitWarnings channel"

key-files:
  created:
    - tests/bridges/_fixtures/unparseable-skill-plugin/skills/bad-skill/SKILL.md
  modified:
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - extensions/pi-claude-marketplace/bridges/skills/types.ts
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - extensions/pi-claude-marketplace/bridges/commands/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts
    - tests/bridges/skills/stage.test.ts
    - tests/bridges/skills/frontmatter-degrade.test.ts
    - tests/orchestrators/plugin/install.test.ts

key-decisions:
  - "Gate-1 throw arm skips rewriteFrontmatterName (synthesize already emits the generated name); RETURN arm is byte-identical passthrough today (NREG-01)"
  - "extractBodyAfterFrontmatter reproduces parseFrontmatter's CRLF->LF + trim body normalization on the throw path so the synthesized body matches the return-path body byte-for-byte"
  - "A degraded-but-installed component keeps the (installed) row (NOT partially-installed) at warning severity (D-86-03)"
  - "degradedKinds set derived from frontmatterDegradations (skill before command by collection order), omitted when empty"

patterns-established:
  - "parse gate 1 (source) / gate 2 (staged) discipline around a bridge write seam"
  - "degrade-record collection -> installCtx.frontmatterDegradations -> reasons[] (standalone) + postCommitWarnings (orchestrated detail) + InstallPluginOutcome.degradedKinds (orchestrated seam)"

requirements-completed: [PARSE-01, PARSE-02, SKILL-01, WARN-01, NREG-01]

coverage:
  - id: D1
    description: "Gate 1 parses SOURCE before rewrite/substitution; a throw synthesizes a disable-model-invocation block with body verbatim and records a degrade entry; install does not hard-fail"
    requirement: "SKILL-01"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/stage.test.ts#SKILL-01 / PARSE-01 unparseable source frontmatter -> synthesized disable-model-invocation block, body verbatim, degrade record"
        status: pass
    human_judgment: false
  - id: D2
    description: "Gate 2 re-parses staged bytes as a Pi-acceptability backstop; the synthesized output re-parses (does not throw); a happy-arm throw is our defect and rides the cleanup catch"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/stage.test.ts#SKILL-01 / PARSE-01 unparseable source frontmatter -> synthesized disable-model-invocation block, body verbatim, degrade record"
        status: pass
    human_judgment: false
  - id: D3
    description: "Standalone install of a one-bad-skill plugin renders (installed) {malformed skill} at warning severity, returns an installed outcome (no hard-fail), and carries degradedKinds=[skill]"
    requirement: "WARN-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#SKILL-01 / WARN-01: standalone install of a plugin with one unparseable skill -> (installed) {malformed skill} at warning severity, no hard-fail"
        status: pass
    human_judgment: false
  - id: D4
    description: "A valid skill is staged byte-for-byte identical to a name-rewrite + var-substitution of the source; the read-only gates mutate nothing on the happy path and the degrade list is empty"
    requirement: "NREG-01"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/stage.test.ts#NREG-01 valid skill is staged byte-for-byte identical to a name-rewrite + var-substitution of the source (gates mutate nothing)"
        status: pass
    human_judgment: false
  - id: D5
    description: "After /reload, a degraded skill's /skill:<generated-name> resolves and the model never auto-invokes it (disable-model-invocation)"
    requirement: "SKILL-01"
    verification: []
    human_judgment: true
    rationale: "Runtime Pi-loader + /reload behavior is a backstop truth in the plan; not exercisable in unit tests (needs a live Pi session)."

# Metrics
duration: 36min
completed: 2026-07-26
status: complete
---

# Phase 86 Plan 02: Unparseable-skill degrade tracer Summary

**Two read-only parseFrontmatter gates now wrap the skills staging seam end-to-end: an unparseable SOURCE frontmatter synthesizes a `disable-model-invocation` block (body verbatim) and still installs, surfacing `(installed) {malformed skill}` at warning severity, while a valid skill is proven byte-for-byte unchanged.**

## Performance

- **Duration:** ~36 min
- **Started:** 2026-07-26
- **Completed:** 2026-07-26
- **Tasks:** 2
- **Files modified:** 10 (9 modified, 1 fixture created)

## Accomplishments
- Gate 1 parses the SOURCE `SKILL.md` before `rewriteFrontmatterName`/`substituteClaudeVars`. A throw (closed `---` block, malformed inner YAML) routes to `synthesizeUnparseableSkill`; a return (including absent/empty frontmatter) keeps today's byte-identical passthrough. A new `extractBodyAfterFrontmatter` reproduces `parseFrontmatter`'s CRLF->LF + trim body normalization so the synthesized body matches the return-path body exactly.
- Gate 2 re-parses the STAGED bytes after write as a Pi-acceptability backstop. A throw here (our own rewrite/substitution producing bytes Pi rejects) propagates to the existing `appendLeakToError`/`cleanupStaging` catch — never masked as author degradation (PARSE-02 / D-86-04).
- The skills bridge returns a `degraded: { generatedName, parseError }[]` list; the install orchestrator collects it into `installCtx.frontmatterDegradations` (mapping skill/command kinds), pushes one `{malformed skill}` / `{malformed command}` token per plugin onto the standalone `(installed)` row, raises that row to `warning` severity, and emits per-component `<plugin>/<component>: <parseError>` detail on the orchestrated `postCommitWarnings` channel. `InstallPluginOutcome.degradedKinds` is the inert seam the orchestrated reconcile row will consume.
- The commands bridge/type carry an inert `degraded` field (empty) so the command neutralize arm can populate it without a later type change.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end unparseable-skill degrade (source gate to standalone row)** - `47353c3f` (feat)
2. **Task 2: NREG-01 byte-equality regression for the valid-skill happy path** - `4cd11d2c` (test)

## Files Created/Modified
- `extensions/pi-claude-marketplace/bridges/skills/stage.ts` - two parse gates + `extractBodyAfterFrontmatter` + degrade collection/return
- `extensions/pi-claude-marketplace/bridges/skills/types.ts` - `degraded` field on `StageSkillsCommitResult`
- `extensions/pi-claude-marketplace/bridges/commands/types.ts` - `degraded` field on `StageCommandsCommitResult` (inert)
- `extensions/pi-claude-marketplace/bridges/commands/stage.ts` - empty `degraded` at both result sites (inert)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - `frontmatterDegradations` installCtx list, standalone reason tokens, warning severity, per-component detail, `degradedKinds` outcome seam
- `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts` - eslint remediation (see Deviations)
- `tests/bridges/skills/stage.test.ts` - unparseable-skill degrade case + NREG-01 byte-equality case
- `tests/bridges/skills/frontmatter-degrade.test.ts` - drop redundant explicit type argument (eslint)
- `tests/orchestrators/plugin/install.test.ts` - standalone `(installed) {malformed skill}` warning-row case
- `tests/bridges/_fixtures/unparseable-skill-plugin/skills/bad-skill/SKILL.md` - NEW malformed-frontmatter fixture (`name: [unterminated`)

## Decisions Made
None beyond the locked decisions (D-86-01..07) the plan already fixed. Body extraction on the throw path was implemented as a small local helper (`extractBodyAfterFrontmatter`) rather than an exported degrade-module function, keeping the change localized to the staging seam.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Remediated pre-existing eslint debt in `frontmatter-degrade.ts` (and its test)**
- **Found during:** Task 1 pre-commit (the `npm-lint` hook runs `eslint .` over the whole repo).
- **Issue:** `bridges/skills/frontmatter-degrade.ts` and `tests/bridges/skills/frontmatter-degrade.test.ts` (both from Plan 01, unchanged at HEAD) failed `eslint .` — `no-non-null-assertion`, `sonarjs/cognitive-complexity` (17 > 15) on `firstBodyParagraph`/`setDescriptionScalar`, `prefer-string-starts-ends-with`, and an unnecessary type argument. Plan 01's code was committed via a `--no-verify` path and never run through `eslint .`, leaving the repo lint-red at HEAD. This blocked any hook-respecting commit (CLAUDE.md forbids `--no-verify`).
- **Fix:** Extracted `skipFencedBlock` / `collectParagraph` from `firstBodyParagraph` and `frontmatterBlockEnd` / `descriptionValueEnd` from `setDescriptionScalar` to drop cognitive complexity under 15; replaced `arr[i]!` non-null assertions with `arr[i] ?? ""` guarded reads; replaced `/^description:/.test(...)` with `startsWith`; dropped the redundant `parseFrontmatter<Record<string, unknown>>` type argument in the test. Behavior is identical — verified by the 14 pre-existing `frontmatter-degrade.test.ts` unit cases (all pass).
- **Files modified:** `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts`, `tests/bridges/skills/frontmatter-degrade.test.ts`
- **Commit:** `47353c3f` (bundled into Task 1, as it blocked that commit)

## Issues Encountered
- The `npm-lint` pre-commit hook lints the whole repo (`eslint .`), so Plan 01's un-linted debt surfaced as a hard commit blocker; resolved via the Rule 3 fix above. Prettier reformatted one multi-line signature in `frontmatter-degrade.ts` during the hook run; re-staged and re-ran clean.

## User Setup Required
None.

## Next Phase Readiness
- The gate-1 RETURN branch is a byte-identical passthrough today; Plan 03 (skills augment) hangs the description/`when_to_use` fill on that branch.
- `StageCommandsCommitResult.degraded` and the `kind: "command"` collection in the commands phase are wired but inert; Plan 04 (command neutralize) populates them with no further orchestrator change.
- `InstallPluginOutcome.degradedKinds` is the seam Plan 05 (orchestrated reconcile row) reads to push the token onto the reconcile `plugin-installed` arm.

## Self-Check: PASSED

- Fixture `tests/bridges/_fixtures/unparseable-skill-plugin/skills/bad-skill/SKILL.md` exists on disk.
- Both task commits present in git history (`47353c3f`, `4cd11d2c`).
- `npm run typecheck` green; `eslint` clean on all touched files; `node --test` across the skills degrade + stage + commands stage + install suites: 150 pass / 0 fail; full `npm test`: 3036 pass / 0 fail / 1 pre-existing platform skip.

---
*Phase: 86-skill-and-command-frontmatter-compliance*
*Completed: 2026-07-26*
