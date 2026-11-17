---
phase: 01-companion-floors-and-mcp-defaults
plan: 05
subsystem: agents
tags: [pi-subagents, pi-mcp-adapter, mcp, grants, tool-names]
requires:
  - phase: 01-companion-floors-and-mcp-defaults
    provides: pi-mcp-adapter 7.0.1 naming profile and optional peer cache from plans 01-01 and 01-03
provides:
  - Per-tool adapter disallows use the registered tool name in excludeTools
  - A Cucumber regression proves the staged name of a long disallowed tool
  - A conformance test measures pi-subagents 0.88.0's uncut long grant name
  - BACKLOG, PRD, and unfiled upstream issue records for the companion gap
affects: [MCP compatibility, agent grants, phase verification]
actuals:
  tokens: 6676
  tasks: 2
  commits: 2
plan_head_before: a2c659a60aaa0ff540632f78360dee9fef0d1352
plan_head_after: 9e061d43948392b09c985ac8bf39f5936e3b954e
tech-stack:
  added: []
  patterns:
    - Use the active MCP profile's registered tool name for per-tool excludes
    - Compare bridge selectors with the installed companion's resolver in a hermetic environment
key-files:
  created:
    - test/integration/agents-adapter-grant-conformance.test.ts
    - .planning/upstream/pi-subagents-long-tool-names.md
    - .planning/phases/01-companion-floors-and-mcp-defaults/01-05-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - test/bridges/agents/convert.test.ts
    - features/mcp-server/agent-grants.feature
    - test/integration/agents-builtin-grant-conformance.test.ts
    - .planning/BACKLOG.md
    - docs/prd/parity-gaps-prd.md
key-decisions:
  - "D-PG1-10: Use the MCP implementation profile's registered name for every per-tool exclude; grants remain selectors."
  - "AGTLONGNAME-01: Record the measured name mismatch in pi-subagents 0.88.0 as a companion gap; do not patch it here."
patterns-established:
  - An agent exclusion scenario checks the whole pi-subagents detail result against Pi's adapter name.
requirements-completed: [PG-MCP-02, PG-AGENT-02]
coverage:
  - id: D1
    description: Adapter per-tool disallows stage dotted and long tools under the registered names
    requirement: PG-MCP-02
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/convert.ts
        status: pass
      - kind: e2e
        ref: features/mcp-server/agent-grants.feature#An agent that disallows a plugin tool with a long name
        status: pass
    human_judgment: false
  - id: D2
    description: A live background child omits the disallowed long adapter tool
    requirement: PG-MCP-02
    verification: []
    human_judgment: true
    rationale: The Cucumber run proves staging, but the harness cannot start a real detached pi-subagents child; the plan's live human check remains for phase verification.
  - id: D3
    description: pi-subagents 0.88.0 resolves the long grant to an uncut name while the adapter registers a cut name
    requirement: PG-MCP-02
    verification:
      - kind: integration
        ref: test/integration/agents-adapter-grant-conformance.test.ts#PG-MCP-02
        status: pass
    human_judgment: false
  - id: D4
    description: The built-in grant test identifies the suite version, and the measured companion gap has BACKLOG, PRD, and upstream draft records
    requirement: PG-AGENT-02
    verification:
      - kind: integration
        ref: node --import "$PWD/test/platform/isolated-pi-home.ts" --test "test/integration/agents-*-grant-conformance.test.ts"
        status: pass
    human_judgment: true
    rationale: The test proves the version and mismatch, while the adequacy of the maintainer-facing issue draft needs review.
duration: 25 min
completed: 2026-11-12
status: complete
---

# Phase 01 Plan 05: Companion Floors and MCP Defaults Summary

**Agent per-tool excludes now use the adapter's registered name; a hermetic conformance test measures pi-subagents 0.88.0's separate long-grant name gap.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-11-12, before the red scenario at 03:56:03 UTC
- **Completed:** 2026-11-12T04:12:25Z
- **Tasks:** 2
- **Files changed:** 8 production, test, and record files
- **Node:** v26.13.0

## Accomplishments

- The agents bridge writes `excludeTools` with the active MCP profile's registered name. Unit cases pin both `a.b` becoming `a_b` and a name cut to 64 characters. The existing short and built-in cases still pass.
- The adapter scenario stages an agent with no `tools:` and checks that pi-subagents shows `excluded tools mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c` in the complete detail result.
- A hermetic integration case feeds the bridge's selector and adapter config/cache fixtures to pi-subagents 0.88.0. It measures the uncut 77-character grant name against the adapter's cut name. BACKLOG AGTLONGNAME-01, PRD section 8.3, and an unfiled upstream issue draft record the gap.
- The existing built-in conformance test's header now describes the suite version it runs, rather than the declared floor.

## Task Commits

1. **Task 1, registered per-tool excludes:** `13a1ab9e488c5924397ce1a66232031dc58cf53c` (`fix(agents): exclude disallowed MCP tools by registered name`). Hook passed.
2. **Task 2, companion measurement and records:** `9e061d43948392b09c985ac8bf39f5936e3b954e` (`test(agents): measure pi-subagents long MCP grant names`). Hook passed after the import-order correction.

## Verification

- **Red proof:** before the product edit, the named Cucumber run exited 1 with `1 scenario (1 failed)`. It failed at `Then the model receives these calls`: the detail showed `excluded tools mcp__plugin_demo_a-server-whose-name-runs-well-past-the-limit__echo`, while the scenario expected the cut name ending `_a4df039c`.
- **Green proof:** the same run exited 0 with `1 scenario (1 passed)`, 13 steps passed. It passed again after the Task 1 commit at the tracer gate.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/convert.ts` and `npm run check:features` exited 0 before and after the Task 1 commit. The agents bridge test set passed 15/15 modules.
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test "test/integration/agents-*-grant-conformance.test.ts"` exited 0 with both file suites passing. With `NODE_OPTIONS=--test-isolation=none`, all three cases passed and diagnostics named pi-subagents 0.88.0.
- The Task 1 and Task 2 commits passed their hooks, including `npm run check:commit`. `node_modules/.bin/fallow audit --base a2c659a60aaa0ff540632f78360dee9fef0d1352` reported no issues in eight changed files. The orchestrator owns the combined-tree `npm run check` wave gate.
- Acceptance checks found the required names and records exactly once, no changes to `legacy-grant-form.ts`, `domain/mcp-implementation.ts`, `package.json`, or `package-lock.json`, and only a header-comment diff in the built-in conformance test.

## Decisions Made

The grant path remains a raw `mcp:` selector. Only the per-tool exclusion uses the registered tool name. The pi-subagents launch consequence is derived from its required-child-tools source; this plan measured the name mismatch, not a live background launch.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The restricted sandbox denied the optional-peer installer and the Cucumber stand-in's loopback listener. Approved escalation let the pinned install and both red and green runs complete.
- The first Task 2 commit hook rejected an import-order error. The import was moved, the focused pre-commit checks passed, and the retry committed with hooks enabled.

## Lines for later plans

Measured against pi-subagents 0.88.0: a grant covering an adapter tool whose joined name exceeds 64 characters requires the uncut name in the child, while pi-mcp-adapter 7.0.1 registers a cut name, so that agent cannot launch until pi-subagents matches the adapter's rule.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Ready for 01-10's compatibility page and the orchestrator's combined-tree wave gate. The live background-child exclusion check remains with phase verification.

## Self-Check: PASSED

Both created artifacts exist; both task commits are ancestors of HEAD; the task verification commands and acceptance checks passed. No task file deletion or untracked generated file remains.

---
*Phase: 01-companion-floors-and-mcp-defaults*
*Completed: 2026-11-12*
