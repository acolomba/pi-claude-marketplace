# Phase 39: Cascade Ghost Record - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

When `cascadeUnstagePlugin` partially succeeds (e.g. skills and commands unstaged but
agents throws), the orchestrators filter `sRecord.resources.*` by `outcome.dropped.*`
rather than leaving the full record pointing at files no longer on disk (ghost record)
or dropping the entire record (data loss).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- discuss phase was skipped
per user setting. Use ROADMAP phase goal, success criteria, RESEARCH.md, and the
v1.7 research synthesis to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

Confirmed touched paths include `orchestrators/plugin/uninstall.ts`,
`orchestrators/marketplace/remove.ts`, and the cascade primitive
`cascadeUnstagePlugin` (location TBD by RESEARCH). The AG-5 foreign-content
error envelope (`AgentsUnstageFailureError`) is the discriminator that distinguishes
preserve-row vs. filter-row policy.

</code_context>

<specifics>
## Specific Ideas

Requirements: TR-03 (Cascade ghost-record correctness).

Success Criteria (must be TRUE):

1. In `orchestrators/plugin/uninstall.ts`, on `outcome.ok === false`, the code filters
   `sRecord.resources.skills`, `.prompts`, `.agents`, `.mcpServers` by removing names
   present in `outcome.dropped.*`; the cascade primitive itself (`cascadeUnstagePlugin`)
   makes no state mutation.
2. `orchestrators/marketplace/remove.ts` applies the same filter in its per-plugin loop.
3. When `outcome.ok === false` and `cause instanceof AgentsUnstageFailureError` (AG-5
   foreign-content), the state row is preserved intact (not filtered) -- foreign content
   owned by another process must not cause data loss.
4. A regression test drives cascade-failure-after-partial-success and asserts
   `sRecord.resources.*` reflects only the artifacts still on disk; a second test drives
   the AG-5 cause and asserts the full row is preserved.
5. `npm run check` GREEN; no regression from Phase 38 baseline (1358 tests).

</specifics>

<deferred>
## Deferred Ideas

None -- discuss phase skipped.

</deferred>
