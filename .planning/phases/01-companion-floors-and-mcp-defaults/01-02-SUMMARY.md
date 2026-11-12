---
phase: 01-companion-floors-and-mcp-defaults
plan: 02
subsystem: companions
tags: [pi-subagents, pi-mcp-adapter, suite-versions, developer-tools]
requires:
  - phase: 01-companion-floors-and-mcp-defaults
    provides: "Plan 01-01 verified pi-subagents 0.88.0 and pi-mcp-adapter 7.0.1"
provides:
  - Developer launcher and live canary pinned to the verified suite versions
  - Contributor, CI, codebase, cucumber, and test-support records of the suite-version rule
affects: [companion compatibility docs, parity-gaps]
actuals:
  tokens: 2868
  tasks: 2
  commits: 2
plan_head_before: f8adca62bd90d8e5ac067d70746a0a88dbb921a2
plan_head_after: d503250938131738bbdd5c769804904a67825ccc
tech-stack:
  added: []
  patterns:
    - "Companion tool pins follow the versions the suites run; pi-subagents uses the suite-version file above its declared floor."
key-files:
  created:
    - .planning/phases/01-companion-floors-and-mcp-defaults/01-02-SUMMARY.md
  modified:
    - scripts/pi.sh
    - test/live-uat/mcp-adapter-canary.mjs
    - test/live-uat/README.md
    - CONTRIBUTING.md
    - .github/workflows/ci.yml
    - .planning/codebase/STACK.md
    - .agents/skills/cucumber/rules/world-and-stand-ins.md
    - test/integration/pi-subagents-peer.ts
    - test/integration/skill-path-resolution.test.ts
key-decisions:
  - "Applied D-PG1-02: pi-subagents has a declared floor of 0.87.0 while the suites run 0.88.0."
patterns-established:
  - "Records distinguish declared peer floors from installed suite versions."
requirements-completed: [PG-AGENT-02, PG-MCP-02]
coverage:
  - id: D1
    description: "The developer launcher and live canary instructions pin pi-mcp-adapter 7.0.1 and pi-subagents 0.88.0."
    requirement: PG-MCP-02
    verification:
      - kind: other
        ref: "bash -n scripts/pi.sh"
        status: pass
      - kind: other
        ref: "node --check test/live-uat/mcp-adapter-canary.mjs"
        status: pass
      - kind: other
        ref: "01-02 Task 1 exact-text and CI comment-only checks"
        status: pass
    human_judgment: false
  - id: D2
    description: "Contributor, CI, codebase, cucumber, and integration comments state the versions the suites exercise."
    requirement: PG-AGENT-02
    verification:
      - kind: integration
        ref: "node --import test/platform/isolated-pi-home.ts --test test/integration/skill-path-resolution.test.ts"
        status: pass
      - kind: other
        ref: "01-02 Task 2 exact-text and comment-only checks"
        status: pass
    human_judgment: false
duration: 19 min
completed: 2026-11-12
status: complete
---

# Phase 01 Plan 02: Companion Tool Pins and Suite Version Records Summary

**Pinned the developer launcher and MCP canary to the verified companions and corrected records to distinguish peer floors from suite versions.**

## Performance

- **Duration:** 19 min from the first recorded edit
- **Started:** 2026-11-12T03:00:09Z (first recorded edit)
- **Completed:** 2026-11-12T03:18:55Z
- **Tasks:** 2
- **Production files changed:** 9
- **Node:** v26.13.0

## Accomplishments

- `scripts/pi.sh` pins pi-mcp-adapter 7.0.1 and pi-subagents 0.88.0; the workflow engine pin remains 3.15.0.
- The live MCP canary requires adapter 7.0.1, and its instructions use `/var/tmp/mcp-adapter-701`.
- Contributor guidance, two CI comments, the codebase map, the cucumber rule, and two integration comments state that the suites run pi-subagents 0.88.0 above its declared 0.87.0 floor.

## Task Commits

1. **Developer tool pins and contributor wording:** `28a97feae87df4a4e66ce7aab0a17c485c52ba24` — `chore(peers): pin developer tools to suite versions` (hook passed).
2. **Records of what the suites prove:** `d503250938131738bbdd5c769804904a67825ccc` — `docs(peers): describe versions exercised by suites` (hook passed).

## Verification

- Task 1: `bash -n scripts/pi.sh` and `node --check test/live-uat/mcp-adapter-canary.mjs` exited 0. All exact-text counts passed; the CI diff changed comment lines only.
- Task 2: `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/skill-path-resolution.test.ts` passed 1/1. All exact-text counts passed; the integration diff changed comments only.
- `node scripts/install-test-peers.mjs` installed the verified suite versions into the ignored optional-peer cache before the integration check.
- The required pre-commit fixer pass and both commit hooks passed. Fallow audit found no issues in the nine changed files. `git diff --check` passed.
- The final `npm run check` belongs to the orchestrator's combined-tree wave gate; it was not run in this worktree.

## Decisions Made

Followed D-PG1-02 and the plan's nine-file scope. No new implementation choice was needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The optional-peer installer stalled while the restricted sandbox blocked `npm view`. The stalled attempt was stopped; the approved-network rerun installed the specified versions and exited 0.
- The first Task 2 pre-commit fixer could not open the changed `.agents` skill file for writing under sandbox permissions. The approved-file-access rerun passed. No check was skipped.

## User Setup Required

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

Both task commits are ancestors of HEAD, the nine intended files are the complete production diff, all task verification commands and acceptance counts passed, and this summary exists. STATE.md and ROADMAP.md remain under orchestrator ownership.

## Next Phase Readiness

Ready for the combined-tree wave gate and the remaining plans. The full suite result must come from the orchestrator.
