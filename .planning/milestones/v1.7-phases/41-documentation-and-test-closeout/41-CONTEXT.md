# Phase 41: Documentation and Test Closeout - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

The two LOW-priority patterns -- agents step-1 parallel `rm` self-healing and the
D-19-01 post-state-commit cache-drop swallow -- are documented with inline comments
explaining the WHY, and each has a behavior-asserting regression test.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- discuss phase was skipped.
Use ROADMAP phase goal, success criteria, RESEARCH.md, and the v1.7 research
synthesis to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

Confirmed touched paths include `bridges/agents/stage.ts` (`commitPreparedAgents`
step-1 `rm` loop) and `orchestrators/plugin/list.ts` (post-state-commit cache-drop
swallow). Existing test suites cover the surrounding code; this phase adds inline
comments + behavior-asserting tests.

</code_context>

<specifics>
## Specific Ideas

Requirements: TR-07 (agents step-1 documentation + test), TR-08 (list.ts D-19-01
documentation + test).

Success Criteria (must be TRUE):

1. The `commitPreparedAgents` step-1 `rm` loop carries an inline comment explaining
   ENOENT-tolerant idempotency: "pre-rm old targets; ENOENT = already gone
   (retry-safe)".
2. A behavior-asserting regression test (TR-07) drives `prepareStagePluginAgents` +
   partial-commit-injection + re-prepare + full commit and asserts clean final disk
   state; the test does NOT assert intermediate function call counts.
3. The post-state-commit cache-drop swallow in `list.ts` carries an inline comment
   referencing D-19-01: "best-effort cache invalidation; per D-19-01, probe failures
   during list are diagnostic noise, not actionable errors".
4. A regression test (TR-08) asserts no module-level `PROBE_FAILURES`-style state
   accumulation in `list.ts` after a failed cache-drop.
5. `npm run check` GREEN; no regression from Phase 40 baseline (1366 tests).

</specifics>

<deferred>
## Deferred Ideas

None -- discuss phase skipped.

</deferred>
