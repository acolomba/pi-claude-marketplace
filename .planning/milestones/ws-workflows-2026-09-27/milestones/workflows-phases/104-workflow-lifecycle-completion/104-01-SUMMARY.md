---
phase: 104-workflow-lifecycle-completion
plan: 01
subsystem: testing
tags: [node-test, test-fixtures, workflows, sonarjs, eslint]

# Dependency graph
requires:
  - phase: 103-workflow-install
    provides: install-workflows.test.ts and its withHermeticHome double, setWorkflowHomeDirForTesting seam
provides:
  - tests/helpers/workflow-home.ts — a shared hermetic-workflow-home helper any suite can import
  - update.test.ts seedPathMarketplace accepting an array of named workflow scripts with distinct bodies
  - update.test.ts makePluginRecord honoring a caller-supplied workflows override
affects: [104-02, 104-03, 104-04, 104-05, 104-06]

actuals:
  tokens: 3260
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Shared test doubles live in tests/helpers/ as kebab-case modules with a block header
    - Fixture builders take an array of named artifacts, not a boolean writing one fixed file

key-files:
  created:
    - tests/helpers/workflow-home.ts
  modified:
    - tests/orchestrators/plugin/install-workflows.test.ts
    - tests/orchestrators/plugin/update.test.ts

key-decisions:
  - "withHermeticWorkflowHome takes the mkdtemp prefix as its first parameter so each suite keeps naming its own temp directories; install-workflows.test.ts passes install-wf-home- and its directory names are unchanged."
  - "update.test.ts keeps its own local withHermeticHome (no workflow-home seam, no ctx argument). It is a different double, so folding it into the extracted helper was out of scope for this plan."
  - "The two existing hasWorkflows: true call sites migrated to a one-element array carrying the same body, so their assertions keep their prior meaning."

patterns-established:
  - "Hermetic workflow home: relocate both process.env.HOME and the engine storage seam, restore both in a finally, take the temp prefix from the caller."
  - "Workflow fixture option shape { fileName, source }[] is now the same in install-workflows.test.ts and update.test.ts."

requirements-completed: [WLIF-02, WLIF-03]

coverage:
  - id: D1
    description: "A suite other than install-workflows.test.ts can obtain a hermetic HOME plus a relocated workflow storage root from one import, without redeclaring the save/restore body."
    requirement: "WLIF-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-workflows.test.ts (all 10 tests, now driving the extracted helper at every call site)"
        status: pass
      - kind: other
        ref: "npx eslint tests/helpers/workflow-home.ts tests/orchestrators/plugin/install-workflows.test.ts — zero errors, no sonarjs/no-identical-functions, no no-unused-vars"
        status: pass
    human_judgment: false
  - id: D2
    description: "update.test.ts's marketplace fixture builder can seed a plugin carrying two or more named workflow scripts with distinct bodies, addressed by file name."
    requirement: "WLIF-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts (101 tests, including the two WFLW-04 / D-99-05a cases migrated to the array option)"
        status: pass
      - kind: other
        ref: "grep -c 'hasWorkflows' tests/orchestrators/plugin/update.test.ts returns 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "makePluginRecord seeds resources.workflows from its caller's override instead of always writing an empty array."
    requirement: "WLIF-02"
    verification:
      - kind: other
        ref: "throwaway node --experimental-strip-types check: makePluginRecord('1.0.0', { workflows: ['acme:ship'] }).resources.workflows deep-equals ['acme:ship']"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts (101 tests, unchanged count — the default path still yields [])"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-15
status: complete
---

# Phase 104 Plan 01: Wave 0 test-fixture enablement Summary

**Extracted the hermetic workflow-home double into `tests/helpers/workflow-home.ts` and taught `update.test.ts`'s fixture builders to name individual workflow scripts, so the rest of the phase can write its assertions without duplicating a function ESLint forbids duplicating.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-15T19:16Z
- **Completed:** 2026-08-15T19:28Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `withHermeticWorkflowHome(prefix, fn)` now lives in `tests/helpers/workflow-home.ts`. The body is the proven original, lifted unchanged, with the `mkdtemp` prefix promoted to a parameter. Four later suites can import it instead of copying it — which matters because `sonarjs/no-identical-functions` is an ESLint **error** here, so the copies would have failed the build outright.
- `install-workflows.test.ts` consumes the helper at all 10 call sites and no longer declares a local copy or imports `setWorkflowHomeDirForTesting`. Its temp-directory names are byte-identical to before.
- `seedPathMarketplace`'s `hasWorkflows?: boolean` became `workflows?: { fileName: string; source: string }[]` — the same option shape `seedWorkflowPlugin` already uses. A case can now seed two envelopes with distinct `meta.name` bodies, which is what the update triad reads.
- `makePluginRecord`'s hard-coded `workflows: []` became `workflows: resources.workflows ?? []`, matching the four sibling fields, so a record can name a prior version's workflows.
- No production source changed: `git diff --name-only` lists nothing under `extensions/`.

## Task Commits

1. **Task 1: Extract the hermetic workflow-home helper to tests/helpers/** — `286fb71f` (test)
2. **Task 2: Teach update.test.ts's fixtures to express the workflow triad** — `8303b531` (test)

## Files Created/Modified

- `tests/helpers/workflow-home.ts` (created) — exported `withHermeticWorkflowHome`; relocates `process.env.HOME` and the workflow storage seam, restores both in a `finally`, removes the temp directory.
- `tests/orchestrators/plugin/install-workflows.test.ts` — local double deleted, helper imported, `"install-wf-home-"` passed at each of 10 call sites.
- `tests/orchestrators/plugin/update.test.ts` — array-shaped `workflows` fixture option replacing the boolean; two call sites migrated; `makePluginRecord` honors the override.

## Decisions Made

- **The prefix is a parameter, not a constant.** A leftover temp directory is otherwise untraceable to the suite that leaked it, and every suite's directories would collide in `ls`.
- **`update.test.ts`'s own `withHermeticHome` stays.** It sets no workflow-home seam and passes no context object, so it is a genuinely different double — not a fourth copy. Folding it in would change behavior in 90-odd tests for no gain in this plan.
- **The migrated call sites keep the old fixed body** (`export const meta = {};\n` in `release.js`) rather than upgrading to a named script. Those two cases assert on the *supported set*, not on envelope names; changing the body would have changed what they prove.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The one skipped test in the full-suite run (`# skipped 1`) is the known pi-subagents global-peer environment skip and is unrelated to this plan.

## Verification

- `npm run check` exits 0: 3621 tests, 3620 pass, 0 fail, 1 skipped (pre-existing environment skip).
- `node --test tests/orchestrators/plugin/install-workflows.test.ts` — 10/10, same count as before.
- `node --test tests/orchestrators/plugin/update.test.ts` — 101/101, same count as before.
- `npx eslint` on all three files — zero errors.
- `git diff --name-only` lists no file under `extensions/`.
- `grep -c 'async function withHermeticHome' tests/orchestrators/plugin/install-workflows.test.ts` → 0.
- `grep -c 'hasWorkflows' tests/orchestrators/plugin/update.test.ts` → 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 104-02 (the tracer) can now write real automated assertions. Its suites import `withHermeticWorkflowHome` from `tests/helpers/workflow-home.ts` with their own prefix, and 104-04's update-triad case can seed named envelopes through `seedPathMarketplace({ workflows: [...] })` and a prior-version record through `makePluginRecord(v, { workflows: [...] })`.

No blockers.

## Self-Check: PASSED

All 3 changed source files, both task commits (`286fb71f`, `8303b531`), and this SUMMARY verified present on disk / in git. All 10 `install-workflows.test.ts` call sites confirmed pointing at the extracted helper.

---
*Phase: 104-workflow-lifecycle-completion*
*Completed: 2026-08-15*
