# Phase 6: Load-time dependency check and allowed uninstall - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-18
**Phase:** 06-Load-time dependency check and allowed uninstall
**Areas discussed:** None — user deferred to Claude's discretion

---

## Discuss

| Option | Description | Selected |
|--------|-------------|----------|
| Consequence-disable marker | How a record says "disabled because a dependency broke" vs plain `enabled: false` | |
| User-disable vs auto-disable interaction | Whether fixing a dependency can silently re-enable something the user disabled by hand | |
| Chain propagation | Whether a broken dependency cascades through a multi-level chain in one reconcile pass | |
| Everything is already decided — skip to context | | ✓ |

**User's choice:** "Everything is already decided — skip to context"
**Notes:** ROADMAP.md's own Phase 6 notes, REQUIREMENTS LOAD-01..03, and
HANDOFF-upstream-dependency-parity.md already pin the remedy wording, error
codes, and check predicate; the user asked Claude to make the persistence-
mechanism call directly rather than walk through the three sub-questions.

---

## Claude's Discretion

All three named gray areas were resolved by Claude and recorded as decisions
in CONTEXT.md rather than left open:
- D-06-01/02/03: the `dependencyDisabled` marker shape, when it is stamped,
  and how `plan.ts`'s enable bucket reads it.
- D-06-04: the purity-boundary consequence (verified against
  `reconcile-planner-purity.test.ts` directly) — not really a discretionary
  call, a structural constraint.
- D-06-05: fixpoint chain propagation, mirroring D-05-02.
- D-06-06/07: the allowed-uninstall reporting shape and the formal retirement
  of PRUNE-05's refusal.

Exact reason-token wording, and the precise function that clears
`dependencyDisabled` on lift, are left to the planner (see CONTEXT.md
"Claude's Discretion").

## Deferred Ideas

- `enable-disable.ts` learning about `dependencyDisabled` — Phase 8.
- A `list`/`info` marker for a consequence-disabled plugin — not requested,
  out of scope.
