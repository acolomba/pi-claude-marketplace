# Phase 37: Phase-Ledger Undo Gap - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

`runPhases` in `transaction/phase-ledger.ts` correctly invokes the failing phase's
own `undo` before walking `executed[]` in reverse, so every phase whose `do` throws
gets exactly one compensation call -- not zero (current bug) and not two
(over-correction pitfall).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- discuss phase was skipped
per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions
to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

Requirement: TR-02 (Phase-ledger compensation gap).

Success Criteria (must be TRUE):

1. In `runPhases`, when `phase.do(ctx)` throws, the failing phase's `undo(ctx)` is
   called exactly once from the catch block BEFORE `rollbackExecuted(executed, ctx)`;
   `executed[]` does NOT contain the failing phase (prevents double-rollback by the
   reverse walk).
2. `Phase<C>.undo` JSDoc documents that undo must tolerate being called after a
   partial-do throw (ENOENT-tolerant, no-op if nothing to clean up).
3. `PathContainmentError` from the failing phase's `undo` re-throws immediately,
   matching the existing discipline at `phase-ledger.ts:84-86`.
4. A regression test asserts the exact undo-call sequence for a 3-phase ledger where
   phase 2 throws: `phase2.undo`, then `phase1.undo` (reverse walk), `phase0.undo`
   (reverse walk) -- each invoked exactly once.
5. `npm run check` GREEN; existing install/uninstall/reinstall tests unchanged.

</specifics>

<deferred>
## Deferred Ideas

None -- discuss phase skipped.

</deferred>
