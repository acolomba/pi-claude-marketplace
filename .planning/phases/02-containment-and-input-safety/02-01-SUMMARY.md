---
phase: 02-containment-and-input-safety
plan: "01"
subsystem: mcp-bridge
tags: [typescript, input-validation, filesystem-safety, node-test]

requires:
  - phase: 01-evidence-and-contract-lock
    provides: Terminal PDEF-03 evidence and the locked malformed-input contract
provides:
  - Truthful unknown typing at the raw scoped MCP document boundary
  - One shared total classifier and typed malformed-field error for stage and unstage
  - Exact hermetic no-write evidence for every JSON-realizable malformed field shape
affects: [02-02, 02-03, mcp-bridge, plugin-lifecycle]

actuals:
  tokens: 3737
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - Own-property trichotomy for absent, valid record, and malformed JSON fields
    - Typed fail-closed rejection before enumeration or filesystem mutation

key-files:
  created:
    - .planning/phases/02-containment-and-input-safety/02-01-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
    - tests/bridges/mcp/types.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/bridges/mcp/unstage.test.ts

key-decisions:
  - "Stage owns the shared classifier and typed error so unstage can reuse the policy without creating an import cycle."
  - "Existing callers continue to propagate the typed preparation failure; no lifecycle result arms or caller translations were added."
  - "Own-property absence remains a clean no-op, while every present non-record JSON value fails closed."

patterns-established:
  - "Boundary classification: keep parsed fields unknown until one total classifier narrows them."
  - "No-write proof: assert complete structured errors before exact bytes and bigint inode/size/time metadata."

requirements-completed: [PDEF-03]

coverage:
  - id: D1
    description: "Raw scoped MCP documents keep mcpServers unknown while validated stage input remains a server record."
    requirement: PDEF-03
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/types.test.ts#raw and validated boundary contracts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/types.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Stage and unstage share one typed absent/object/malformed classifier and reject null, string, array, boolean, and number before mutation."
    requirement: PDEF-03
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#malformed scoped MCP field matrix"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/unstage.test.ts#malformed scoped MCP field matrix"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/stage.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/unstage.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Malformed-field refusal preserves exact configuration bytes and bigint inode, size, mtime, and ctime metadata in both flows."
    requirement: PDEF-03
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#case-owned no-write evidence"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/unstage.test.ts#case-owned no-write evidence"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-05
status: complete
---

# Phase 02 Plan 01: Malformed MCP Boundary Summary

**A truthful raw MCP boundary with one shared typed classifier now makes stage and unstage reject malformed scoped fields before enumeration or mutation.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-05T21:51:11Z
- **Completed:** 2026-09-05T22:09:37Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Changed `RawMcpDoc.mcpServers` from a trusted record to `unknown` without weakening the validated `StageMcpInput.servers` contract.
- Added one total own-property classifier and `MalformedMcpServersError`, then routed both stage and unstage through it before collision work, enumeration, or writes.
- Replaced permissive malformed-field no-ops with paired, hermetic null/string/array/boolean/number cases that prove the complete typed error and exact filesystem preservation.

## Task Commits

Each TDD task was committed atomically:

1. **Task 1 RED: Add failing malformed MCP stage contract** - `94a9e22c` (test)
2. **Task 1 GREEN: Reject malformed scoped MCP fields** - `d190b27b` (fix)
3. **Task 2 RED: Add failing malformed MCP unstage matrix** - `d62a9722` (test)
4. **Task 2 GREEN: Share malformed MCP policy with unstage** - `227aadd1` (fix)
5. **Task 2 verification fix: Keep classifier signature self-contained** - `16c21638` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/mcp/types.ts` - Makes the raw `mcpServers` field truthful as `unknown`.
- `extensions/pi-claude-marketplace/bridges/mcp/stage.ts` - Owns the shared total classifier and typed malformed-field error; classifies before stage work.
- `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts` - Reuses the stage-owned classifier before enumeration or removal.
- `tests/bridges/mcp/types.test.ts` - Pins the raw and validated compile-time boundaries.
- `tests/bridges/mcp/stage.test.ts` - Covers the complete malformed value matrix with exact errors and no-write evidence.
- `tests/bridges/mcp/unstage.test.ts` - Replaces legacy malformed no-ops with the paired fail-closed matrix.

## Decisions Made

- Kept the classifier in the stage runtime owner and imported it into unstage, avoiding a new runtime utility or import cycle.
- Preserved every existing malformed-JSON and malformed-top-level-document policy; only the scoped `mcpServers` field policy changed.
- Let the typed error propagate through existing bridge and orchestrator paths because caller inspection showed no translation or new public result arm was required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept the exported classifier signature self-contained**

- **Found during:** Task 2 repository verification
- **Issue:** The first implementation exposed a non-exported `McpServersClassification` alias through the exported classifier, which the repository's public-API fallow check rejected.
- **Fix:** Inlined the discriminated return type on `classifyMcpServers` without adding another public symbol or changing runtime behavior.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`
- **Verification:** Focused tests, direct stage and unstage coverage, typecheck, ESLint, and `npm run fallow` all passed.
- **Committed in:** `16c21638`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** The fix preserved the intended API surface and introduced no scope expansion.

## Issues Encountered

- Subprocess-heavy negative and architecture tests returned empty child output inside the restricted execution sandbox. Rerunning them with normal process permissions passed, followed by a green full unit suite (5,231/5,231) and integration suite (31/31).
- The aggregate `npm run check` wrapper stops at formatting because it scans the user-owned untracked `.mcp.json`. That file is explicitly outside this plan and was neither changed nor staged. All plan verification commands and the remaining repository gates passed independently.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PDEF-03 is closed with direct owner coverage and stable typed propagation.
- Plans 02-02 and 02-03 can proceed without MCP caller changes or new dependencies.

## Self-Check: PASSED

- All six plan-owned source and test files plus this summary exist.
- All five task and deviation commits are present in git history.

---

_Phase: 02-containment-and-input-safety_
_Completed: 2026-09-05_
