---
phase: 01-companion-floors-and-mcp-defaults
plan: 03
subsystem: mcp
tags: [pi-mcp-adapter, tool-names, cucumber, conformance]
requires:
  - phase: 01-companion-floors-and-mcp-defaults
    provides: pi-mcp-adapter 7.0.1 in the optional peer cache from plan 01-01
provides:
  - Adapter tool names follow the 64-character fit rule of pi-mcp-adapter 7.0.1
  - Long server namespaces promise a prefix only when the cut name retains it
  - A listing scenario and an 11-case installed-adapter conformance test
affects: [agent grants, hook tool matching, MCP compatibility]
actuals:
  tokens: 4554
  tasks: 2
  commits: 3
plan_head_before: f8adca62bd90d8e5ac067d70746a0a88dbb921a2
plan_head_after: 53beb2c4ef84270759cd36be066330c194b91f57
tech-stack:
  added: []
  patterns:
    - Compute the adapter's joined name once and fit it before exposing it to callers
    - Check a predicted tool name against the installed adapter and Pi's registry
key-files:
  created:
    - test/integration/adapter-tool-name-conformance.test.ts
    - .planning/phases/01-companion-floors-and-mcp-defaults/01-03-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/domain/mcp-implementation.ts
    - test/domain/mcp-implementation.test.ts
    - features/mcp-server/listing.feature
    - features/step_definitions/mcp-server/listing.steps.ts
    - test/integration/pi-mcp-adapter-peer.ts
key-decisions:
  - "D-PG1-07: Keep the adapter fit rule private in its profile and return no prefix when the cut loses it."
  - "D-PG1-09: Compare the profile with the cached adapter's formatToolName at the suite version."
patterns-established:
  - A listing assertion compares Pi's offered name with the profile's predicted name.
requirements-completed: [PG-MCP-02]
coverage:
  - id: D1
    description: Adapter names and prefix promises follow pi-mcp-adapter 7.0.1's 64-character rule
    requirement: PG-MCP-02
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/mcp-implementation.ts
        status: pass
      - kind: integration
        ref: test/integration/adapter-tool-name-conformance.test.ts#D-PG1-09 cases
        status: pass
    human_judgment: false
  - id: D2
    description: Pi lists the long server's tool under the cut adapter name
    requirement: PG-MCP-02
    verification:
      - kind: e2e
        ref: features/mcp-server/listing.feature#cut tool names of pi-mcp-adapter
        status: pass
    human_judgment: false
  - id: D3
    description: Eleven cases compare project names with the installed adapter, including empty and UTF-16 edges
    requirement: PG-MCP-02
    verification:
      - kind: integration
        ref: NODE_OPTIONS=--test-isolation=none node --import test/platform/isolated-pi-home.ts --test test/integration/adapter-tool-name-conformance.test.ts
        status: pass
    human_judgment: false
duration: 32 min
completed: 2026-11-12
status: complete
---

# Phase 01 Plan 03: Companion Floors and MCP Defaults Summary

**Adapter tool names now use pi-mcp-adapter 7.0.1's 64-character fit rule, with a listing proof and an 11-case conformance test against the installed adapter.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-11-12T03:00:19Z
- **Completed:** 2026-11-12T03:32:00Z
- **Tasks:** 2
- **Files changed:** 6 production and test files
- **Node:** v26.13.0

## Accomplishments

- The adapter profile keeps names through 64 UTF-16 code units and cuts longer joined names to 55 units, an underscore, and eight SHA-256 hex digits. It promises a server prefix only when all of that prefix survives the cut.
- The adapter listing scenario checks Pi's offered name and the extension's predicted name for a long server. A replay with the pre-change profile failed on the name comparison; the current profile passes.
- Eleven integration cases compare the profile with pi-mcp-adapter 7.0.1's compiled `formatToolName`, including the empty tool, dotted names, a cut inside the server, non-ASCII text, and a surrogate pair.

## Task Commits

1. **Adapter fit rule, unit rows, and listing scenario:** `69457e7b24207b0fec596e8938fad4d89e98718b` — `feat(mcp): cut long tool names as pi-mcp-adapter does` (hook passed).
2. **Installed-adapter conformance:** `774de45f9a86e41717fda56372a8192c5ee296a8` — `test(mcp): compare tool names with pi-mcp-adapter` (hook passed).
3. **Listing regression proof:** `53beb2c4ef84270759cd36be066330c194b91f57` — `test(mcp): check predicted adapter name in listing` (hook passed).

## Verification

- The first listing run, before the product edit, exited 0 with `1 scenario (1 passed)`: the existing table step inspected Pi's registry but did not check the extension's prediction.
- With the added prediction step and the pre-change profile temporarily restored, the listing run exited 1 with `1 scenario (1 failed)`. The failing step was `Then pi offers the tool "echo" of the plugin "demo" server "a-server-whose-name-runs-well-past-the-limit" under its adapter name "mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c"`; the profile predicted the uncut `...limit__echo` while Pi offered the cut name. The current profile then passed `1 scenario (1 passed)`, all 13 steps.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/mcp-implementation.ts`, `npm run typecheck`, `npm run check:features`, and `npm run fallow` exited 0. Fallow audit reported no issues in the changed files.
- The exact `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/adapter-tool-name-conformance.test.ts` command exited 0. Node 26's default isolation reports one passing file; `NODE_OPTIONS='--test-isolation=none'` on the same command reported 11 passed tests and pi-mcp-adapter 7.0.1 in every case diagnostic.
- All three production and test commits passed their hooks. The orchestrator owns the combined-tree `npm run check` wave gate.

## Decisions Made

The rule remains module-private; the adapter's full join prefix is separate from the public prefix promise. No dependency or lockfile changed.

## Deviations from Plan

**[Rule 2 - Missing critical verification] The listing scenario needed to check the extension's prediction.** Found during Task 1: the new scenario passed before the product edit because pi-mcp-adapter already registered the cut name and the existing table step only checked Pi's registry. Added a focused step that checks the predicted name and offered registry entry, then replayed the scenario with the pre-change profile to obtain the required red result. Files: `features/mcp-server/listing.feature`, `features/step_definitions/mcp-server/listing.steps.ts`. Verification: 1 failed against the pre-change profile, 1 passed against the current profile, `npm run check:features` passed. Commit: `53beb2c4ef84270759cd36be066330c194b91f57`.

**Total deviations:** 1 auto-fixed (Rule 2). **Impact:** The scenario now detects the profile naming regression it was intended to cover.

## Issues Encountered

- The restricted sandbox blocked the first peer-cache attempt and the Cucumber fixture's loopback socket. Approved escalation let both run; the cache installed pi-mcp-adapter 7.0.1.
- The first regression-proof commit attempt failed its hook on an import-group blank line. The line was removed and the retry passed with hooks enabled.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Ready for the agent-grant and hook plans that consume the profile's fitted tool names. The combined-tree wave gate remains with the orchestrator.

## Self-Check: PASSED

All six changed code and test files exist; the three listed commits are ancestors of HEAD; the task verification commands passed, with the red replay and Node test-isolation report explained above.

---
*Phase: 01-companion-floors-and-mcp-defaults*
*Completed: 2026-11-12*
