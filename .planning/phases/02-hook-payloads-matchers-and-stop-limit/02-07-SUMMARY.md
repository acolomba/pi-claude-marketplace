---
phase: 02-hook-payloads-matchers-and-stop-limit
plan: "07"
subsystem: hooks
tags: [pi, claude-hooks, mcp, result-replacement, redaction]
requires:
  - phase: 01-companion-floors-and-mcp-defaults
    provides: MCP identity recovery and both Pi MCP implementations
  - phase: 02-hook-payloads-matchers-and-stop-limit
    provides: Hook routing, native result projectors, and the downstream observer
provides:
  - MCP-only legacy output alias with presence-based modern precedence
  - Native MCP and custom result envelopes with validated output-only replacement
  - Dual-profile evidence for redaction, images, empty output, and immutable failures
affects: [PG-HOOK-01, hook-result-docs, phase-02-verification]
actuals:
  tokens: 24788
  tasks: 3
  commits: 3
commits: 3
plan_head_before: 32d2f473eec3b1800ffd3a1228debb078f3c5418
plan_head_after: 1ebf8e800661d3749b34c9dde5ed935a39eb9da8
tech-stack:
  added: []
  patterns:
    - Preserve both hook output fields until recovered MCP identity is available.
    - Validate each output as result data against the original event before selecting the last effective replacement.
    - Retain only validated MCP server and tool routing details after replacing content.
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
    - test/bridges/hooks/wire-protocol.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
    - test/bridges/hooks/exec-result.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - test/bridges/hooks/dispatch.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
    - test/bridges/hooks/payloads/post-tool-use.test.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - test/bridges/hooks/event-adapters.test.ts
    - features/hook/tool-use.feature
    - features/hook/tool-failure.feature
    - features/hook/mcp-tool-names.feature
    - features/step_definitions/hook/tool-use.steps.ts
    - features/lib/hook-mcp-tool-server.ts
key-decisions:
  - "Modern presence means any value other than undefined, including null, false, zero, empty string, and empty array."
  - "The legacy alias is eligible only after actual MCP identity recovery; a modern value suppresses its sibling even when invalid."
  - "Keep PG-HOOK-01 open: this plan covers part of a phase-spanning requirement."
patterns-established:
  - "Per-outcome validation preserves an earlier effective replacement when a later candidate is malformed or unchanged."
requirements-completed: []
requirements-covered: [PG-HOOK-01]
coverage:
  - id: D1
    description: "MCP-only legacy alias and modern-first selection follow recovered identity and stable hook order."
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts"
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#An MCP result alias replaces the result"
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#The modern MCP output wins when both fields are supplied"
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#An empty modern MCP output does not use the legacy output"
        status: pass
    human_judgment: false
  - id: D2
    description: "Native MCP and custom results retain their schemas while accepted replacements remove stale content and preserve images."
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts"
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#An MCP redaction removes original structured data and details"
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#An MCP output replacement preserves supplied images"
        status: pass
    human_judgment: false
  - id: D3
    description: "A failed MCP result remains unchanged when both replacement fields are supplied."
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: "test/bridges/hooks/event-adapters.test.ts#ignores a replacement output on a failed result and reports it (D-BG-405)"
        status: pass
      - kind: e2e
        ref: "features/hook/tool-failure.feature#A failed MCP result ignores both replacement fields"
        status: pass
    human_judgment: false
duration: "at least 67 min from first task commit"
completed: 2026-11-13
status: complete
---

# Phase 02 Plan 07: MCP Result Alias and Replacement Summary

**MCP hooks now select the modern output field before the MCP-only legacy alias, preserve native result envelopes, and replace result data without leaking original content.**

## Performance

- **Duration:** At least 67 minutes from the first task commit; initial reads and RED checks began earlier.
- **First task commit:** 2026-11-13T08:25:16Z
- **Completed:** 2026-11-13T09:32:22Z
- **Tasks:** 3
- **Files modified:** 15, exactly the plan's declared files
- **Diff scale:** 99,152 characters / 4 = 24,788 estimate tokens

## Accomplishments

- The wire parser retains `updatedToolOutput` and `updatedMCPToolOutput` independently. Dispatch waits for recovered MCP identity, selects the modern field when present, and considers the legacy field only for an MCP result with no modern field. Candidate validation keeps the last effective output in pair-then-routing order; failed results and non-MCP aliases cannot replace output.
- PostToolUse projects actual MCP `content` and `structuredContent`, while custom non-MCP tools retain their supplied structured schema. The reverse adapter accepts text, images, envelopes, and scalar data, clears stale result carriers, ignores arbitrary event patch fields, and retains only validated MCP server/tool routing metadata. Block feedback retains original structured content.
- Shared `@mcp` scenarios verify complete hook stdin, downstream results, and model calls under pi-mcp-adapter and Pi's built-in MCP. They cover alias use, modern and empty precedence, distinct content/structured secrets, replacement images, and unchanged failures. Adapter nested and proxy results and built-in search results remain in the whole-record assertions.

## Task Commits

1. **Task 1: 02-07-01 Preserve both output fields and choose them with actual MCP identity**: `9f8751e1919c3b47146b1ed751178056023e8c8d`
2. **Task 2: 02-07-02 Preserve native MCP/custom result schemas and replace all payload copies**: `481cf540954b960e5f460954804371ece2401b22`
3. **Task 3: 02-07-03 Prove MCP failure, structured redaction and image behavior in both profiles**: `1ebf8e800661d3749b34c9dde5ed935a39eb9da8`

## Verification

- **RED:** Task 1's parser test failed because the legacy field was discarded. Task 2's projector test failed because a successful MCP response was still a raw content array. Task 3's real adapter redaction scenario failed on `echo:redact` before the rich fixture supplied distinct content and structured secrets. The malformed-name regression failed with `TypeError: Cannot read properties of undefined (reading 'startsWith')` before the guard; the full module suite also exposed a stale assertion that modern `false` should be ignored.
- **GREEN:** All three task commits passed normal hooks, including `npm run check:commit`; no hook was bypassed. The final direct coverage command passed for all five exact source-test pairs. `npm run test:modules` passed at the final head after the malformed-name guard and false-output assertion correction. `npm run check:features` passed. Fallow audit reported zero issues across all 15 changed files; Fallow review reported zero dead-code, complexity, and duplication findings.
- **Real adapter:** `npm run test:cucumber:profile -- --profile adapter features/hook/tool-use.feature features/hook/tool-failure.feature features/hook/mcp-tool-names.feature` passed **82 scenarios / 1,233 steps**, seed 367651, at the committed head. Log: `/tmp/p07-adapter-final-postcommit.log`.
- **Real built-in MCP:** The same command with `--profile builtin` passed **12 scenarios / 189 steps**, seed 585006, at the committed head. Log: `/tmp/p07-builtin-final-postcommit.log`.
- The parent owns Wave 8's combined-tree `npm run check` after merging this worktree; this isolated plan does not claim that gate.

## Decisions Made

The inspected Claude binary selector favors a present modern field, and this plan implements that rule even for falsy values. A legacy generator/falsy path differs. The selector and generator evidence therefore does not prove that every historical Claude runtime path behaves identically; the difference remains documented for phase review rather than silently choosing truthiness fallback.

PG-HOOK-01 remains open because other plans in this phase own the rest of its verification. No requirement status or shared orchestration artifact was changed here.

## Deviations from Plan

**[Rule 2 - Required evidence] Added a profile-aware whole-record step in Task 2.** The existing observer already recorded every result, but the two MCP implementations produce different complete records. The new step selects only the expected profile rows and compares every actual row, without filtering nested, proxy, or search events. This used the already declared `features/step_definitions/hook/tool-use.steps.ts` owner and passed both profile gates. Committed in `481cf540954b960e5f460954804371ece2401b22`.

**[Rule 1 - Bug] Guarded an omitted tool name in Task 3.** Task 2's native fallback called `startsWith` on an absent name, preventing a malformed-envelope dispatch from reaching its spawn boundary. A new paired test failed on that exact TypeError before the one-line guard; the dispatch-exec owner, direct coverage, and full module suite passed afterward. Committed in `1ebf8e800661d3749b34c9dde5ed935a39eb9da8`.

**[Rule 1 - Stale assertion] Migrated the modern-false expectation in Task 3.** The complete module suite found an old expectation of `undefined` for a modern `false` result. The plan requires `false` as present scalar data, and the corrected whole-result assertion expects text `false` with cleared details. Direct coverage and the full module suite passed. Committed in `1ebf8e800661d3749b34c9dde5ed935a39eb9da8`.

**Total deviations:** 3 directly caused corrections (one missing evidence step, two bugs/expectations). **Impact:** All changes stayed within the 15 declared files and preserved the existing observer and companion implementations.

## Issues Encountered

- The initial Task 2 commit hook caught TypeScript, lint, complexity, and duplication findings. They were fixed and the normal commit was retried; no failed commit was recorded as a task commit.
- The first module run stalled at the malformed-name dispatch test. Host-visible process inspection confirmed the exact owned test process was waiting; only that run was terminated. The paired assertion reproduced the thrown error, and the fixed dispatch-exec test completed before the full suite passed.
- Fallow audit and review initially could not create their temporary Git worktree inside the sandbox. Both passed with ordinary escalated local Git access.
- ASYNCLIFECYCLE-01 / WINDOWS #114 remains open. This plan did not change fixture teardown or claim that the separate historical exit-code mismatch is resolved.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

The 15-file plan is ready for the parent's Wave 8 merge and combined-tree `npm run check`. PG-HOOK-01 remains phase-spanning until all its requirements are verified.

## Self-Check: PASSED

All three exact task SHAs are ancestors of this worktree head. The persisted plan ledger measures three production commits from `32d2f473eec3b1800ffd3a1228debb078f3c5418` through `1ebf8e800661d3749b34c9dde5ed935a39eb9da8`; their union changes exactly the 15 declared files. All task acceptance criteria and the assigned owner, direct-coverage, adapter, and built-in MCP checks passed. The worktree was clean before this summary was written.

---
*Phase: 02-hook-payloads-matchers-and-stop-limit*
*Completed: 2026-11-13*
