# Phase 40: Update State-Before-Commit Reorder - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

`runThreePhaseUpdate` in `orchestrators/plugin/update.ts` writes state AFTER physical
commits, not before: an intent-mark (`installable: false`) brackets phase-3a commits,
and a `finalizeUpdateRecord` call after all commits writes per-bridge resource
updates (regardless of other bridges' outcomes) plus an all-or-nothing version bump.
D-03 continue-on-failure semantics are preserved. A retry on partial-success state
reaches the correct final state.

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

Confirmed touched paths include `orchestrators/plugin/update.ts` (specifically
`runThreePhaseUpdate`) and `tests/orchestrators/plugin/update.test.ts` (PUP-6 at
line 744 must remain GREEN). The two new functions are `markUpdateInProgress`
(pre-commit intent mark) and `finalizeUpdateRecord` (post-commit per-bridge update +
all-or-nothing version bump).

</code_context>

<specifics>
## Specific Ideas

Requirement: TR-04 (State-write reorder).

Success Criteria (must be TRUE):

1. `markUpdateInProgress` sets `sRecord.compatibility = { installable: false,
   notes: ["update-in-progress"] }` before phase-3a commits; this is the only
   state write before commits begin.
2. `finalizeUpdateRecord` applies per-bridge resource updates for every bridge
   that succeeded (independent of other bridges' outcomes); version bump
   (`sRecord.version`) occurs only when all four bridges succeed.
3. D-03 continue-on-failure contract is preserved: all four bridge commits attempt
   regardless of individual failures; `phase3aFailures[]` accumulates them; the
   existing recovery-hint emission at line ~928 fires on any failure.
4. A 4-bridge x 2-outcome failure matrix: for each bridge individually throwing
   while the other three succeed, the post-run `state.json` reflects the correct
   per-bridge resources update (committed bridges updated, failing bridge resources
   unchanged) and version unchanged.
5. A retry test seeds partial-success state (`version=OLD, resources.skills=NEW,
   disk skills=NEW`) and runs update again; the second run reaches `version=NEW`
   without unexpected notifications.
6. `npm run check` GREEN; `update.test.ts` test count change accounted for
   (~10-15 test rewrites expected).

</specifics>

<deferred>
## Deferred Ideas

None -- discuss phase skipped.

</deferred>
