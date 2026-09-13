---
quick_id: 260808-dhm
description: amend v1.18 requirements for LLM tool-surface reason widening
date: 2026-08-08
mode: quick
---

# Quick Task 260808-dhm: Amend v1.18 requirements for LLM tool-surface reason widening

## Why

The Phase 95 discuss session (2026-08-08) resolved open decision 3 by widening
the LLM tool surface's reason projection — reversing a row that
`REQUIREMENTS.md` § Out of Scope still carries. Planning for Phase 95 is blocked
until the requirement documents agree with the decision, otherwise `gsd-planner`
reads a spec that contradicts `95-CONTEXT.md`.

Rationale and decision records: D-95-06, D-95-07, D-95-10 in
`.planning/phases/95-manifest-independent-installed-inventory/95-CONTEXT.md`.

Documentation-only. No source files change.

## Tasks

### Task 1 — Add INV-05 to REQUIREMENTS.md and retire the superseded exclusion

- **files:** `.planning/REQUIREMENTS.md`
- **action:** Add `INV-05` under § Installed Inventory covering `pluginReasons`
  forwarding reasons for `installed` and `partially-installed`. Record the
  pre-existing `projectRowStatus` flattening loss it also closes, the required
  vs optional `reasons` field asymmetry between the two message types, and that
  COMPAT-01 still holds. Replace the "Extending the LLM tool surface to carry
  the new reason" Out of Scope row with the narrower "An `info` tool on the LLM
  surface" exclusion, which remains genuinely out of scope.
- **verify:** `INV-05` present; no Out of Scope row mentions widening the
  reason projection.
- **done:** Requirement text states the behavior, the rationale, and the
  COMPAT-01 consequence.

### Task 2 — Reconcile traceability and coverage counts

- **files:** `.planning/REQUIREMENTS.md`
- **action:** Add `| INV-05 | Phase 95 | Pending |` to the traceability table.
  Move counts 21 → 22 for both total and mapped. Update the
  "Eight of the twenty-one" sentence and add `INV-05` to the net-new work list.
  Update the last-updated footer, preserving the prior entry.
- **verify:** Traceability row count equals 22; `Unmapped: 0` still holds.
- **done:** Counts, prose, and table agree.

### Task 3 — Reconcile ROADMAP.md

- **files:** `.planning/ROADMAP.md`
- **action:** Add `INV-05` to the Phase 95 milestone bullet and to the Phase
  Details Requirements line. Add success criterion 5 for the tool payload,
  asserted on tool output rather than inferred from the row builder. Append the
  criterion-2 correction recording that no render-map suppression exists.
  Rewrite the open-decisions block: mark 1 and 3 resolved with their decision
  IDs, re-gate 2 to Phase 96, and drop the "resolve before Phase 95 planning"
  gate from the heading.
- **verify:** Phase 95 lists six requirements and five success criteria; the
  open-decisions block carries no unresolved Phase 95 gate.
- **done:** ROADMAP and REQUIREMENTS agree with 95-CONTEXT.md.

## Out of Scope

- Any change to `extensions/` or `tests/` — INV-05 is implemented in Phase 95,
  not here.
- Open decision 2 (component name fidelity) — deferred to Phase 96 discuss.
- `docs/output-catalog.md` and PRD reconciliation — that is DOC-08 in Phase 98.
