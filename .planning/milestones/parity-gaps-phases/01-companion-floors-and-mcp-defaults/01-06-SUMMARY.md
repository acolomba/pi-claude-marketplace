---
phase: 01-companion-floors-and-mcp-defaults
plan: 06
subsystem: mcp
tags: [mcp, adapter, timeout, ownership-marker, cucumber]
requires:
  - phase: 01-companion-floors-and-mcp-defaults
    provides: "Plan 01-04's defaultRequestTimeoutMs server-type table"
provides:
  - "Stdio and remote MCP adapter entries receive 1800000 ms and 300000 ms defaults when no plugin or user timeout exists"
  - "The marker records extension-owned defaults so restaging can recompute them without replacing user values"
  - "Unit, integration, and behavioral expectations cover the new staged entry shape"
affects: [01-09, 01-10, mcp-adapter, project-approval]
actuals:
  tokens: 7919
  tasks: 3
  commits: 3
plan_head_before: a2c659a60aaa0ff540632f78360dee9fef0d1352
plan_head_after: d701446378ee7a9d181549af2163f3f165da9e7a
tech-stack:
  added: []
  patterns:
    - "Record a written default's value in marker.defaultFields and carry only a differing user value"
key-files:
  created:
    - .planning/phases/01-companion-floors-and-mcp-defaults/01-06-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - features/mcp-server/configuration.feature
    - features/mcp-server/legacy-move.feature
    - features/plugin/subagent-child.feature
key-decisions:
  - "A recorded default is identified by its value, leaving a different value in the entry to the user."
  - "A project server definition change requires a new pi-mcp-adapter approval because the full entry is hashed."
patterns-established:
  - "Apply the adapter timeout after plugin and carried user fields, before the marker."
requirements-completed: [PG-MCP-01]
coverage:
  - id: D1
    description: "Fresh stdio and remote plugin servers get the matching timeout and marker default in mcp-adapter.json."
    requirement: PG-MCP-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A server that declares no timeout is written to mcp-adapter.json with the idle window of Claude Code"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Restaging distinguishes an extension default from a user timeout and keeps the user's value."
    requirement: PG-MCP-01
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/marker.ts"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts"
        status: pass
      - kind: unit
        ref: "npm run test"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unit, integration, and Cucumber expectations match the staged entry at install and legacy move."
    requirement: PG-MCP-01
    verification:
      - kind: integration
        ref: "npm run test:integration"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin features"
        status: pass
    human_judgment: false
  - id: D4
    description: "The project approval effect is recorded for the CHANGELOG and compatibility page."
    verification: []
    human_judgment: true
    rationale: "The current harness does not exercise an approved project server before and after a definition change; the answer follows pi-mcp-adapter 7.0.1 source."
duration: 50 min
completed: 2026-11-12
status: complete
---

# Phase 01 Plan 06: MCP Adapter Defaults Summary

**Staged MCP adapter entries now receive Claude Code's idle windows while a value the user wrote survives every restage.**

## Performance

- **Duration:** 50 min
- **Started:** 2026-11-12T03:53:22Z
- **Completed:** 2026-11-12T04:43:12Z
- **Tasks:** 3
- **Files modified:** 19 code, test, and feature files; this summary is the twentieth file
- **Actual estimate tokens:** 7,919, measured as changed-line characters divided by four

## Accomplishments

- Stdio entries without a declared or user timeout receive `requestTimeoutMs: 1800000`; remote entries receive `300000`. A plugin timeout remains first in precedence, followed by a user value, then the default.
- `defaultFields` records the value this extension wrote. A matching value is recomputed on restage, including a stdio-to-remote change; a differing or unmarked value is carried as the user's. The choice store does not save a recorded default.
- The written-file scenario, unit and integration expectations, and both complete Cucumber profiles cover the new entry shape. Legacy moves at load keep their established restaging behavior.

## Task Commits

1. **Task 1 — default and ownership:** `cdf92a0fcf14aac6024f3d7c295c256dde373cc6` (`feat(mcp): default adapter timeout and track ownership`)
2. **Task 2 — unit expectations:** `5d11a7b7738c3d650516ed025549724ab3dd6836` (`test(mcp): expect default timeout in staged adapter entries`)
3. **Task 3 — integration and scenario expectations:** `d701446378ee7a9d181549af2163f3f165da9e7a` (`test(mcp): expect default timeout in adapter flows`)

Each commit passed its enabled hooks, including `npm run check:commit` for staged build inputs. The metadata commit follows this summary.

## Verification

- **Behavioral red/green:** The new `@mcp` scenario first failed at the step comparing the complete `mcp-adapter.json` text: 1 scenario failed, 8 of 9 steps passed. After implementation it passed: 1 scenario and 9 steps passed. `@mcp` is used because both adapter and builtin profiles write this file during install.
- **Task 1:** Direct coverage for `marker.ts` and `adapter-entry.ts`, the architecture materialization test, and `npm run check:features` exited 0. The tracer reran all five commands successfully.
- **Task 2:** `npm test` and direct coverage for `stage.ts` exited 0. The earlier full unit run exposed 63 expected entry-shape failures; the final run had none.
- **Task 3:** `npm run test:integration` exited 0 after 16 expected baseline failures across five files. The complete adapter profile passed 1,801 scenarios; the complete builtin profile passed 155. The focused adapter and builtin commands passed 24 and 19 scenarios, respectively.
- **Acceptance checks:** The marker and entry symbol counts, scenario literals, and legacy-move literals met the plan's thresholds. `git diff` showed only `marker.ts` and `adapter-entry.ts` under `extensions/`; `domain/`, `project-scope.feature`, and `builtin-values.feature` had no changes. No test case was removed, skipped, or weakened. Fallow audit reported no issues in the 19 changed files.
- The orchestrator owns the combined-tree `npm run check` wave gate; this worktree did not run that full gate.

## Files Created/Modified

- Product: `extensions/pi-claude-marketplace/bridges/mcp/marker.ts` and `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts`.
- New behavioral assertion: `features/mcp-server/configuration.feature`; architecture byte expectation: `test/architecture/integration-materialization-gate.test.ts`.
- Product unit cases: `test/bridges/mcp/marker.test.ts` and `test/bridges/mcp/adapter-entry.test.ts`.
- Existing unit expectations changed: `test/bridges/mcp/stage.test.ts`, `test/orchestrators/plugin/install-flow-ledger.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`, `test/orchestrators/plugin/update-flow.test.ts`, `test/orchestrators/plugin/update-swap.test.ts`, and `test/orchestrators/reconcile/mcp-migration.test.ts`. `adapter-doc.test.ts` needed no change because it had no failing staged-entry expectation.
- Integration expectations changed: `test/integration/mcp-home-path-partial.test.ts`, `test/integration/mcp-legacy-sweep.test.ts`, `test/integration/mcp-override-lifecycle.test.ts`, `test/integration/mcp-tool-rules.test.ts`, and `test/integration/mcp-variable-expansion.test.ts`.
- Scenario expectations changed: `features/mcp-server/legacy-move.feature` (three adapter texts) and `features/plugin/subagent-child.feature` (one moved entry). The initial adapter profile failed only those four scenarios; the initial builtin profile failed only the three legacy-move scenarios.

## Project approval

**The harness cannot show an approved-then-updated project server, and pi-mcp-adapter 7.0.1 source says its changed entry needs approval again.** `project-server-trust.ts` canonicalizes and hashes the entire server definition, including the marker (`hashProjectServerDefinition`, lines 101-103), and `isApproved` requires the saved hash to match exactly (lines 213-217). Adding `requestTimeoutMs` and `defaultFields` changes that hash. In a trusted interactive session, `applyProjectServerTrust` prompts again and saves the new approval; in a headless session it blocks as approval required unless the user's allow policy applies (lines 265-299). `keepProjectServerApprovals` carries approval only for a `directTools`-only adapter panel edit (lines 227-253), so it does not cover this change. `project-scope.feature` shows allowed, headless pending-approval, and untrusted paths but no approved-then-updated scenario. Its scenarios were left unchanged.

## Lines for later plans

- **CHANGELOG and compatibility page:** Existing project-scope server approval becomes stale when a staged entry gains the timeout and ownership marker. In a trusted interactive session, pi-mcp-adapter asks once again for that new definition; headless use requires approval in a trusted interactive session or the user-global allow setting. This follows adapter source; the harness does not directly exercise the transition.
- **D-PG1-12 compatibility wording:** An installed entry gets the default at its next restage: install, update, reinstall, enable, apply, or import. The AMIG-01 legacy move at load also restages and therefore gains the default; an ordinary load does not write one.

## Decisions Made

- Kept `defaultFields` optional and value based, so older markers remain readable and a user edit is distinguishable from the extension's own default.
- Changed only expectations for entries this extension stages. Earlier-release entries, user stubs, built-in registrations, and project-approval scenarios retain their input text and assertions.

## Deviations from Plan

None - plan executed exactly as written. The expected `adapter-doc.test.ts` file required no edit because its tests passed without one.

## Issues Encountered

- The first red scenario run used an incorrect expected fixture key and args. I corrected the scenario fixture and reran red before editing product code; the final red run failed only at the intended file-text comparison.
- Gitlint rejected an overlong commit body on Task 1 and Task 3's first attempts. Shorter messages passed the hooks; no failed attempt created a commit.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The marker validation, user timeout precedence, load-time write boundary, and project approval consequence were checked as T-01-14 through T-01-17 require.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 01-09's user-timeout update scenario and plan 01-10's CHANGELOG and compatibility wording. The combined-tree `npm run check` remains the orchestrator's wave gate.

## Self-Check: PASSED

The key files exist, all three task commits are ancestors of this branch's HEAD, the task and plan verifications above passed, and the worktree was clean before this summary was written.

---

*Phase: 01-companion-floors-and-mcp-defaults*
*Completed: 2026-11-12*
