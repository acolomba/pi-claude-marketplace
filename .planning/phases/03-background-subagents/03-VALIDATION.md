---
phase: "03"
slug: background-subagents
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-13"
---

# Phase 3 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node test runner and Cucumber 13.3.0 |
| Config file | package.json, cucumber.json, existing direct coverage tooling |
| Quick run command | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/event-router.test.ts` |
| Full suite command | `npm run check` |
| Estimated runtime | Full suite roughly 15 minutes on this checkout; timeout 2400 seconds |

## Sampling Rate

- While editing: relevant owner tests, direct pair coverage, and discriminating scenarios.
- Per commit: normal repository hooks. Do not duplicate their checks immediately before committing.
- After each wave merge and at phase/merge/handoff gates: full `npm run check` on the combined tree.
- Before verification: all static, Fallow, unit, integration, both Cucumber profiles and 100% direct coverage gates pass.
- Unit feedback target: under 30 seconds. Process tests have explicit bounded timeouts; full gates use 2400 seconds. Reuse only identical build inputs and Node version per local-verification policy.

## Per-Task Verification Map

The planner replaces the provisional rows below with concrete task IDs, waves,
threat IDs, new test paths and exact commands before plan verification.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Identity (provisional) | TBD | TBD | PG-HOOK-07a | TBD | Session-bound identity; no task/display spoof or stale reuse | unit/integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/runtime.test.ts test/bridges/hooks/event-router.test.ts` | Existing owners; new fixture needed | pending |
| Routing (provisional) | TBD | TBD | PG-HOOK-07a | TBD | Child tool-only dispatch retains trust and hydration | unit/behavior | `npm run test:cucumber:profile -- --profile adapter features/plugin/subagent-child.feature` | Extend | pending |
| Persistence (provisional) | TBD | TBD | PG-HOOK-07a | TBD | Parent/sibling survive child reads, writes, exit and reload; dead owners recover safely | unit/process | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/async-rewake/registry.test.ts test/bridges/hooks/async-rewake/pid-table.test.ts` | Existing owners; new process fixture needed | pending |
| Payloads (provisional) | TBD | TBD | PG-HOOK-07a | TBD | All three tool events and sync/async paths receive the correct snapshot | unit/behavior | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/payloads/pre-tool-use.test.ts test/bridges/hooks/payloads/post-tool-use.test.ts test/bridges/hooks/payloads/post-tool-use-failure.test.ts` | Extend | pending |
| Launch/migration (provisional) | TBD | TBD | PG-AGENT-01 | TBD | Delegated default, forced true, exact old/new warning recognition, edited files preserved | unit/behavior | `npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature features/mcp-server/agent-grants.feature` | Extend; repeat relevant builtin profile | pending |
| Real child (provisional) | TBD | TBD | PG-AGENT-01, PG-HOOK-07a | TBD | Actual companion child completes despite blocking main Stop; distinct concurrent identities | integration | New maintained test path and exact command required in plan | Missing; foundation task required | pending |

## Wave 0 Requirements

- [ ] Permanent real-child fake-provider driver and concurrent-session assertions derived from research probes P1/P2; no dependence on temporary files.
- [ ] Stand-in structured child metadata and recording-hook fixtures.
- [ ] Parent/child/sibling process survival and malformed/dead-owner journal fixtures.
- [ ] Paired owner tests for every new production module; no unused scaffolding between plans.
- [ ] Planner replaces every provisional verification row with concrete executable tasks.

No framework installation is required.

## Manual-Only Verifications

None planned. All phase behaviors have automated verification, including actual
companion child execution through a local fake provider without real credentials.
Missing evidence must be automated before requesting user testing.

## Validation Sign-Off

- [ ] All tasks have automated verification or explicit foundation dependencies.
- [ ] No three consecutive tasks lack automated verification.
- [ ] Wave 0 covers all missing references.
- [ ] No watch-mode flags.
- [ ] Process waits, child launches and full gates are bounded.
- [ ] Both MCP implementation profiles pass.
- [ ] Real child and concurrency assertions pass; temporary research probes alone do not qualify.
- [ ] `nyquist_compliant: true` set after completed verification.

**Approval:** pending execution and validation
