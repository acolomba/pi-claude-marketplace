---
phase: 02-hook-payloads-matchers-and-stop-limit
plan: "06"
subsystem: hooks
tags: [pi, claude-hooks, search-results, shell-results, redaction]
requires:
  - phase: 02-hook-payloads-matchers-and-stop-limit
    provides: File-result projection, reverse rendering, and downstream observer
provides:
  - Available-fact Glob, Grep, Bash, and PowerShell PostToolUse responses
  - Validated search and shell output replacements with stale-carrier cleanup
  - Real model and downstream-handler evidence for search and shell results
affects: [PG-HOOK-01, HOOKRESULT-01, hook-result-docs]
actuals:
  tokens: 13236
  tasks: 3
  commits: 3
commits: 3
plan_head_before: c907849feaf3f2b57f0ba4a378e24fccad2e84f1
plan_head_after: 730882c3d76157574973b5f352d1186626c293e5
tech-stack:
  added: []
  patterns:
    - Project only observed search and shell facts; omit ambiguous display-derived fields
    - Validate replacement fields before returning content with null details
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/tool-result-search-shell.ts
    - extensions/pi-claude-marketplace/bridges/hooks/tool-output-search-shell.ts
    - test/bridges/hooks/tool-result-search-shell.test.ts
    - test/bridges/hooks/tool-output-search-shell.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - features/hook/tool-use.feature
    - features/hook/tool-failure.feature
key-decisions:
  - Omit Glob filenames and counts from a multiline display because a filename may contain a newline.
  - Keep result-supplied output paths as metadata and never read them.
  - Leave PG-HOOK-01 open because later plans own remaining hook result work.
patterns-established:
  - Search and shell result codecs are selected at the existing payload and adapter boundaries.
requirements-completed: []
requirements-covered: [PG-HOOK-01]
coverage:
  - id: D1
    description: Search and shell hooks receive only available Claude result facts.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/tool-result-search-shell.ts
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#Search result hooks receive emitted facts and truncation"
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#A Bash result hook receives combined output without invented streams"
        status: pass
    human_judgment: false
  - id: D2
    description: Valid search and shell replacements reach the model and remove stale result carriers.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/tool-output-search-shell.ts
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#A search result replacement changes what the model receives"
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#A shell result replacement preserves supplied images"
        status: pass
    human_judgment: false
  - id: D3
    description: Ambiguous search displays, notice-like source lines, and output paths preserve honest result semantics.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: test/bridges/hooks/tool-result-search-shell.test.ts#newline-bearing glob display does not invent two filenames
        status: pass
      - kind: unit
        ref: test/bridges/hooks/tool-output-search-shell.test.ts#a supplied output path remains metadata and never supplies replacement bytes
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#Search output resembling a notice remains actual tool content"
        status: pass
    human_judgment: false
duration: "at least 19 min from first task commit"
completed: 2026-11-13
status: complete
---

# Phase 02 Plan 06: Search and Shell Result Translation Summary

**Glob, Grep, Bash, and PowerShell hooks now receive available result facts, and validated search and shell replacements reach Pi without stale output.**

## Performance

- **Duration:** At least 19 minutes from the first task commit; editing began earlier.
- **First task commit:** 2026-11-13T07:08:52Z
- **Completed:** 2026-11-13T07:27:53Z
- **Tasks:** 3
- **Files modified:** 13
- **Diff scale:** 52,942 characters / 4 = 13,236 estimate tokens

## Accomplishments

- Glob projects a single unambiguous path and native truncation facts. Grep preserves actual content and counts only an unambiguous rendered line. Multiline path displays do not become invented filename lists or counts.
- Bash exposes its actual text/image blocks in Claude's array-typed `structuredContent`, with `interrupted: false` and an actual persisted path when supplied. PowerShell exposes only known metadata through pure contract tests. LS retains its native result.
- Valid Glob, Grep, Bash, and PowerShell replacements render supplied text/images or intentional empties. Accepted patches clear old details and structured content; malformed values and unchanged echoes preserve the event. Output paths and URLs are never followed.

## Task Commits

- **Task 1: 02-06-01 Forward projections, exact dispatch expectations, real result hooks**: `85cb3b065ee35d610e63e484f2d0379df42c6836`
- **Task 2: 02-06-02 Reverse renderer, adapter integration, model and downstream evidence**: `814fe7c64d70cbd3f7b39d1cee4407437e03d778`
- **Task 3: 02-06-03 Ambiguous display, notice, path counterexamples and transitive fixtures**: `730882c3d76157574973b5f352d1186626c293e5`

- **Task 3: Parent correction: omit ambiguous empty search claims**: `9d0631ad3133369398ca313eb0df5295a77a61f9`
- **Task 3: Parent correction: align shell result fixtures and empty-result spacing**: `ca9148d488c966d0f70f4e8fc28ef2dc661ae8be`

## Verification

- **RED:** Task 1's owner assertions failed against the placeholder projector because Glob, Bash, and PowerShell returned `undefined`. Task 2's empty Glob and Bash image assertions failed against the placeholder renderer for the expected safe content and null details. Task 3's newline-bearing Glob assertion failed when the projector invented two filenames. All were intended behavioral assertion failures before the corresponding implementation.
- **GREEN:** All three normal commit hooks passed, including `npm run check:commit`. Focused owner tests and 100% direct coverage passed for both new codecs and the changed `post-tool-use.ts` and `event-adapters.ts` owners. `fallow audit --base HEAD` reported no issues before each task commit.
- Real Pi checks passed: named search/Bash result scenarios **3 scenarios, 45 steps**; the full Bash success/failure feature **12 scenarios, 175 steps**; search/shell replacement scenarios **4 scenarios, 59 steps**; and the notice-like Grep source scenario **1 scenario, 16 steps**. The full `npm run test:modules` suite passed with ordinary local socket/process permissions after the directly affected dispatch fixtures were migrated. `npm run check:features` passed.
- The first sandboxed `test:modules` attempt reported socket/process permission errors in five unrelated owners and three stale Bash dispatch expectations. A direct owner run identified the expectations; after migration, the elevated full module suite exited 0. The sandboxed attempt is not counted as passing evidence.
- The parent owns the Wave 7 combined-tree `npm run check` after this worktree is merged. It was not run here.

## Available-Field Inventory

- **Glob:** No observed duration, totalMatches, countIsComplete, or timedOut. Native result-limit or byte-truncation details supply `truncated` when present. A newline-bearing or byte-truncated display does not prove filenames or numFiles; the final partial path is never emitted as a filename.
- **Grep:** The native search supplies rendered content, not reliable distinct filenames, numFiles, numMatches, totalFiles, totalLines, appliedLimit, appliedOffset, or timedOut. One unambiguous formatted line can supply numLines; multiple displayed lines are ambiguous when paths contain newlines or context repeats.
- **Bash:** Pi merges stdout and stderr; neither separate stream is projected. Native `exit_code` and `wall_time_seconds` do not map to verified Claude result slots. Pi's differently shaped structured object is not copied into Claude's content-block array.
- **PowerShell:** The same combined-stream limitation applies. Its Claude schema has no Bash `structuredContent` array slot. No live PowerShell executable was available; forward and reverse behavior was verified with pure event fixtures only.
- **LS:** Native content remains the recorded exception. No result-supplied full-output path or URL is opened by either codec.

## Decisions Made

- Omit ambiguous multiline filenames and counts even when the native result-limit flag proves truncation. This is the only way to avoid claiming that a newline within a filename is a record separator.
- Treat output paths strictly as supplied metadata. Replacement content must come from validated fields already present in the hook response.
- Keep `requirements-completed` empty: PG-HOOK-01 spans more than this plan.

## Deviations from Plan

**[Rule 1 - Bug] Migrate directly invalidated dispatch fixtures.** The first full module run exposed three Bash `updatedToolOutput.content` fixtures in `test/bridges/hooks/dispatch.test.ts` that predated the shell result contract. They now supply Claude `stdout`; complete output and original-event equality assertions remain. The direct owner and elevated full module suite passed. Committed in `730882c3d76157574973b5f352d1186626c293e5`.

**[Rule 3 - Blocking] Reuse the downstream observer for search tools.** The real search scenarios needed the observer loaded after the hook bridge. The existing search-tool Cucumber setup now loads that already available extension, and the empty-result assertion uses a general tool step. Four replacement scenarios and the notice scenario passed. Committed in `814fe7c64d70cbd3f7b39d1cee4407437e03d778`.

**[Rule 1 - Bug] Restrict ambiguous Glob and Grep counts.** A counterexample showed that splitting newline-delimited Glob display text could invent two paths from one filename. The projector now omits multiline path lists and uncertain Grep line counts; the new regression, focused direct coverage, and real single-path search scenarios passed. Committed in `730882c3d76157574973b5f352d1186626c293e5`.

**Total deviations:** 3 directly caused corrections. **Impact:** The result contract and directly affected fixtures are complete without wrappers, dependency changes, or unrelated code edits.

## Issues Encountered

- Initial normal commit hooks caught lint and type errors in new code and tests. Each was fixed before a fresh normal commit; no hook was bypassed.
- The test sandbox denied local sockets. Real Cucumber and the full module suite passed with ordinary elevated local-process permissions. The pinned ignored optional-peer cache was copied from the parent checkout without dependency changes.
- ASYNCLIFECYCLE-01 / WINDOWS #114 remains open. This plan neither changes its cleanup logic nor claims the earlier exit-code symptom is resolved.

## Parent Combined-Tree Verification

`npm run check` exited 0 at `ca9148d488c966d0f70f4e8fc28ef2dc661ae8be`, Node v26.13.0: 1860 adapter scenarios / 22658 steps and 155 built-in scenarios / 2091 steps. Merged LCOV: coverage/direct.lcov (361 records). Log: `/tmp/pg2-wave7-check-final.log`.

The parent proved a sentinel collision in Pi's native find result: no matches
and a file literally named `No files found matching pattern` have identical
content and details. Commit `9d0631ad` omits filenames/numFiles for that display
while retaining supplied truncation metadata. The owner regression and a real
file scenario both failed on the false zero count before the correction. They
pass after it, with complete hook, downstream-handler and model assertions.
Direct owner coverage is 100%; six focused scenarios passed all 91 steps.
The first focused rerun caught two JSON newline escapes lost while expanding
small example tables. Both escapes were restored before the successful run.
Five existing file/search/Bash examples now use concrete scenarios because the
cucumber skill requires three or more variants in an Outline. No case was lost.
Fallow audit and review passed, and the normal commit hook passed.

The first full gate at `9d0631ad` passed 1,854/1,860 adapter scenarios, then
failed on four stale Bash result assertions and two empty-result helper checks.
The old Bash replacement fixture also needed the Claude stdout field. Commit
`ca9148d4` migrates those exact fixtures and preserves the separator space in
the empty-result helper. The full tool-use feature then passed 56 scenarios /
840 steps (seed 891435, `/tmp/pg2-wave7-tool-use-fixed.log`). The normal commit
hook and Fallow audit/review passed. The successful full gate above includes
both parent corrections. Two additional empty-output examples became concrete
scenarios without changing their cases. The first failed gate is retained in
`/tmp/pg2-wave7-check.log` and the GSD failure ledger.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Plan 02-06 is ready for the parent's Wave 7 merge and combined-tree gate. PG-HOOK-01 remains partial; HOOKRESULT-01 owns later execution wrappers.

## Self-Check: PASSED

Both new codecs and their paired tests exist. All three exact task commits are ancestors of the worktree HEAD; `git rev-list --count c907849f..HEAD` measured three production/test commits before this summary. Task acceptance checks, direct coverage, real Cucumber evidence, and the elevated full module suite passed. The worktree was clean before this summary was written.

---
*Phase: 02-hook-payloads-matchers-and-stop-limit*
*Completed: 2026-11-13*
