---
phase: 02-hook-payloads-matchers-and-stop-limit
plan: "05"
subsystem: hooks
tags: [pi, claude-hooks, file-results, redaction, cucumber]
requires:
  - phase: 02-hook-payloads-matchers-and-stop-limit
    provides: Hook event routing, indexed Edit views, and result dispatch
provides:
  - Available-fact Read, Edit, and Write responses for PostToolUse hooks
  - Validated file-result replacements with complete Pi output redaction
  - Real downstream Pi handler and model evidence for text and image results
affects: [hook-result-docs, PG-HOOK-01, HOOKRESULT-01]
actuals:
  tokens: 22399
  tasks: 3
  commits: 5
commits: 5
plan_head_before: 44fce3f3ecfbf82d3eca896853b06aa1fe44b8e6
plan_head_after: f8fce88299a00d9e4b8776b54ce8cb71631bf990
tech-stack:
  added: []
  patterns:
    - Project only observed file-result facts without reading the file again
    - Return content plus explicit null details for accepted redaction
    - Verify result patch ordering with the installed Pi runner and a later handler
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/tool-result-files.ts
    - extensions/pi-claude-marketplace/bridges/hooks/tool-output-files.ts
    - features/lib/hook-result-observer.ts
    - test/integration/hooks-result-boundary.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - features/hook/tool-use.feature
    - features/hook/async.feature
    - features/skill/model-reads.feature
    - features/step_definitions/hook/tool-use.steps.ts
key-decisions:
  - Keep unknown Claude result metadata absent; never reconstruct original file content.
  - Clear output-derived details and structuredContent on an accepted replacement.
  - Keep PG-HOOK-01 open because this plan covers only its file-result portion.
patterns-established:
  - File-result codecs are consumed by the existing payload and adapter boundaries.
requirements-completed: []
requirements-covered: [PG-HOOK-01]
coverage:
  - id: D1
    description: Read, Edit, and Write hooks receive Claude-shaped available facts.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/tool-result-files.ts
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#File result hooks receive the facts Pi supplies"
        status: pass
    human_judgment: false
  - id: D2
    description: Valid file-result replacements reach the model and clear stale output.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/tool-output-files.ts
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#A file result replacement changes what the model reads"
        status: pass
    human_judgment: false
  - id: D3
    description: A later Pi handler sees only the accepted text or image result.
    requirement: PG-HOOK-01
    verification:
      - kind: integration
        ref: test/integration/hooks-result-boundary.test.ts
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#A redacted result leaves no original data for another Pi handler"
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#An image result replacement preserves only the supplied image"
        status: pass
    human_judgment: false
duration: 53 min
completed: 2026-11-13
status: complete
---

# Phase 02 Plan 05: File Result Translation Summary

**Read, Edit, and Write hook results now expose available Claude fields, and accepted replacements clear the model and downstream Pi result carriers.**

## Performance

- **Duration:** 53 min, measured from the first task commit
- **Started:** 2026-11-13T04:15:35Z (first task commit)
- **Completed:** 2026-11-13T05:08:04Z
- **Tasks:** 3
- **Files modified:** 16
- **Diff scale:** 89,596 characters / 4 = 22,399 estimate tokens

## Accomplishments

- Successful file hooks receive actual Read text or image data, indexed Edit pairs with a validated shared patch, and executed Write input.
- Valid Read, Edit, and Write replacements render model-visible content; intentional empty text works, and invalid or echoed results leave the complete original event untouched.
- Accepted redaction clears stale details and structuredContent. A handler loaded after the production bridge and the model both see the replacement; completed file effects stay unchanged.

## Task Commits

| Task ID | Work | Commit |
| --- | --- | --- |
| 02-05-01 | Project file result facts and owner tests | `aa0906b088f1d5cecda8c7b030ac868f8810a377` |
| 02-05-02 | Render replacements and clear stale output | `c8e4433cebd61fac480ee9b20576ad579d4b4408` |
| 02-05-03 | Observe real downstream results and update affected fixtures | `876dbfab8797fe3997340eecbf46bb89bb0c0545` |
| 02-05-03 follow-up | Correct the remaining skill Read replacement fixture | `f8fce88299a00d9e4b8776b54ce8cb71631bf990` |

The frontmatter commit count measures `plan_head_before..plan_head_after`: four task commits plus the first committed summary. This final evidence correction is committed separately without rewriting history.

## Verification

- **RED evidence:** Task 1's new successful Write assertion failed against the old raw content array. Task 2's new Read replacement assertion failed when the adapter returned `undefined` instead of safe content and `details: null`. Task 3's real observer scenario failed with no downstream record before the observer fixture was loaded. Each failed on the intended behavior before the corresponding implementation.
- **GREEN evidence:** The exact owner direct-coverage commands passed for `tool-result-files.ts`, `post-tool-use.ts`, `tool-output-files.ts`, `event-adapters.ts`, and `pi-api.ts`; the new source owners reached 100% direct coverage. The installed Pi runner integration test passed all five cases, and the architecture translator test passed.
- Real Pi Cucumber runs passed 6 projection scenarios (91 steps), 2 replacement scenarios (30 steps), 3 downstream/Edit scenarios (47 steps), the affected async Edit scenario (18 steps), the skill Read payload scenario (15 steps), and the corrected skill Read replacement scenario. The full tool-use feature ran 49 of 50 scenarios green before the remaining legacy Edit fixture was corrected; its corrected scenario then passed in the 3-scenario run.
- The broad affected run after the first corrections passed 72 of 74 scenarios. Its two remaining failures were the known ASYNCLIFECYCLE-01 reload cleanup issue and the skill replacement fixture corrected and passed afterward. The broad suite was not rerun after that correction.
- `npm run typecheck`, `npm run check:features`, ESLint on changed TypeScript, `fallow audit --base aa0906b0^`, and all three normal commit hooks passed. The parent owns the Wave 6 combined-tree `npm run check` after merge; it was not run in this isolated worktree.

## Available-Fact Boundary

- Read totals appear only for unambiguous whole-file text. Offset, limit, truncation, and notice-like displayed content do not authorize invented whole-file counts; actual raw truncation content wins when Pi supplies it.
- Edit `structuredPatch` appears only when the supplied unified patch has valid headers, body lines, and matching old/new counts. Each pair retains its own old/new strings and the actual batch patch.
- Pi supplies no reliable original file content, Write create/update type, user modification flag, patch, execution duration, image dimensions/original size, or PDF/notebook arm at this boundary. These fields remain absent. The later HOOKRESULT-01 plan owns execution wrappers.

## Decisions Made

- Render a supplied Edit replacement as `filePath: newString` with any valid supplied patch below it, so the replacement is readable and testable as a real model result.
- Preserve the original event for exact projected echoes, including native indexed Edit and Write echoes, even when the original Pi success text differs from Claude's projection.
- Keep `requirements-completed` empty: PG-HOOK-01 spans more than this file-result plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated directly invalidated behavioral assertions**

- **Found during:** Task 3 broad affected Cucumber run
- **Issue:** Async Edit and skill Read scenarios still expected raw Pi result arrays; Edit and skill Read replacement fixtures used the retired raw array shape.
- **Fix:** Updated the affected assertions and used Claude-shaped Edit and Read replacements. No unrelated scenario expectation was weakened.
- **Files modified:** `features/hook/async.feature`, `features/skill/model-reads.feature`, `features/hook/tool-use.feature`
- **Verification:** The affected real Pi scenarios passed, including the later hook's unchanged input and both model replacement texts.
- **Committed in:** `876dbfab8797fe3997340eecbf46bb89bb0c0545`, `f8fce88299a00d9e4b8776b54ce8cb71631bf990`

**2. [Rule 1 - Bug] Closed reverse-renderer count and echo gaps**

- **Found during:** Task 3 review of Task 2 acceptance criteria
- **Issue:** A supplied patch hunk could carry mismatched counts, and an unchanged Edit or Write projection could replace the original Pi event.
- **Fix:** Validate hunk line counts and no-newline markers; return no patch for projected echoes. Added owner cases and retained 100% direct coverage.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/tool-output-files.ts`, `test/bridges/hooks/tool-output-files.test.ts`
- **Verification:** Direct owner coverage, ESLint, Fallow audit, and the normal commit hook passed.
- **Committed in:** `876dbfab8797fe3997340eecbf46bb89bb0c0545`

**Total deviations:** 2 auto-fixed bugs. **Impact:** Both changes enforce this plan's stated result contract; no new package or wrapper was added.

## Issues Encountered

- The broad affected Cucumber run passed 72 of 74 scenarios after the first corrections. One failure was the remaining skill replacement fixture, now corrected and passing in its targeted real Pi run. The other was the existing ASYNCLIFECYCLE-01 / WINDOWS #114 reload cleanup issue; a passing async rerun does not resolve it.
- Fallow audit initially identified reverse-renderer complexity. Extracting text and image validation brought the audit to zero issues without changing behavior.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

The file-result portion of PG-HOOK-01 is ready for the parent Wave 6 combined-tree gate and the later documentation and HOOKRESULT-01 work. PG-HOOK-01 remains open.

## Self-Check: PASSED

All four created deliverables exist, all four exact task commits are ancestors of this evidence correction, the task acceptance checks and assigned focused verification passed, and the worktree had no outstanding code changes before this summary correction. The broad suite still has the pre-existing async cleanup failure; the combined-tree gate remains assigned to the parent after merge.
