# Phase 97: Disabled-state classification repair - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-09
**Phase:** 97-disabled-state-classification-repair
**Areas discussed:** Gray-area selection only (both surfaced areas declined)

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled-partial row reasons | Does the (disabled) partial row show unsupported-kind reasons or render bare? | |
| Enable on manifest-absent partial | Expected outcome when re-materialization can't resolve a manifest entry | |
| Neither — requirements suffice | Both edges to Claude's discretion anchored on "keep existing semantics" | ✓ |

**User's choice:** Neither — requirements suffice
**Notes:** ENBL-05..09 and the six success criteria are the spec. Both edge
questions go to Claude's discretion with the "keep existing semantics" anchor;
INV-04's no-`{not in manifest}`-on-disabled composition is non-negotiable.

---

## Claude's Discretion

- Disabled-partial row reasons (conservative default: canonical-disabled parity; catalog-precedent decides at planning)
- Enable on manifest-absent partial (existing resolve-failure semantics, pinned)
- Predicate location/name; test organization

## Deferred Ideas

- Coverage-sweep todo — out of scope, pending
- notify.ts stale comments — Phase 98 DOC-08
