# Phase 89: Documentation reconcile - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 89-documentation-reconcile
**Areas discussed:** Version framing, Stop/StopFailure rows, Reconcile breadth, Research-doc style

---

## Version framing

| Option | Description | Selected |
|--------|-------------|----------|
| Version-neutral | Re-frame `hooks-compatibility.md` as describing the current bridge; drop v1.13 from title/columns/prose | ✓ |
| Bump to v1.16 | Replace v1.13 references with v1.16 | |
| Keep v1.13 + annotations | Keep frame, annotate new rows "since v1.16" | |

**User's choice:** "remove milestone versions from the hooks compatibility doc"
**Notes:** No milestone version anywhere in the doc; git history carries lineage (D-89-01).

---

## Stop/StopFailure rows

| Option | Description | Selected |
|--------|-------------|----------|
| ✓ with caveat subsection | Flip rows to ✓; timing shift documented in a short dedicated subsection + row note + pointer to issue-103 doc | ✓ (Claude's pick) |
| ⚠ partial | Mark rows ⚠ for the timing shift | |
| Row note only | ✓ with one-line note, no subsection | |

**User's choice:** "you decide"
**Notes:** Claude resolved: ✓ because the divergence is not hook-observable (⚠ is reserved for contract restrictions authors must code around). Peer-floor rider (D-87-02) resolved as no doc mention — floor is package-level (D-89-02, D-89-03).

---

## Reconcile breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Surgical | Only DOC-04-named edits | |
| Consistency sweep | Also fix rows the shipping made false | |
| Full-doc audit | Verify every table row against current code | ✓ |

**User's choice:** "you decide, but full doc would be fine"
**Notes:** Claude chose the full-doc audit since the user sanctioned it (D-89-04).

---

## Research-doc style

| Option | Description | Selected |
|--------|-------------|----------|
| Correct in place | Amend rows/counts to current truth; no preserved-history relics | ✓ |
| Superseded markers | Keep old text, mark superseded | |
| Banner + minimal edits | Top banner, touch only the named rows | |

**User's choice:** "edit so the doc is consistent. we don't need to preserve history, so amend by correcting"
**Notes:** Inventory becomes 31 with `agent_settled`; counts corrected where falsified; pointers to issue-103 doc retained per DOC-05 (D-89-05).

---

## Claude's Discretion

- Exact wording/placement of the timing-shift subsection and row notes.
- Stop no-matcher disposition presentation (matcher-table row vs events-row note).
- Replacement event for the output-catalog Stop example (D-89-07).
- Research-doc amended date/status line phrasing.
- Row-level add-vs-annotate calls during the full-doc audit.

## Deferred Ideas

- Full re-basing of the research doc's feasibility projections onto v1.16 beyond consistency.
- `docs/research/claude-hook-config-syntax.md` refresh (cross-check only this phase).
- UPSTREAM-SETTLE timing-shift erasure (v2).
- Reviewed todo not folded: coverage-sweep rare-failure-arms (unrelated; also reviewed in Phase 87).
