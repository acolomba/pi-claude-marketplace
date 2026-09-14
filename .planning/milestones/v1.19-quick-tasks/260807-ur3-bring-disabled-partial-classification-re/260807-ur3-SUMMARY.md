---
quick_id: 260807-ur3
description: bring disabled-partial classification repair into v1.18 scope
date: 2026-08-07
status: complete
---

# Quick Task 260807-ur3: Summary

Operator decision: the `disabled-partial-record-unrecognized` defect joins
milestone v1.18 instead of being tracked separately. Doc-only; the repair itself
is Phase 97 work.

## Framing that shaped the edits

The defect is not new scope. v1.12 shipped **ENBL-04** — "disabled status renders
distinct from soft-degraded `unavailable` on list/info surfaces (declared /
enabled / available are orthogonal facts)" — and marked it complete. The buggy
conjunct `compatibility.installable && !enabled` couples enabled-ness to
available-ness, which is the exact orthogonality ENBL-04 asserts, so a disabled
partially-installed record violates an already-shipped requirement.

The new requirements therefore continue that family at ENBL-05 rather than
opening a new prefix. `DIS-` was checked and free, but ENBL is both semantically
precise and consistent with how INFO and LIFE continued their v1.8 and v1.13
numbering.

## What changed

**`.planning/REQUIREMENTS.md`** — 16 requirements to 21.

- New "Enable/Disable State Classification" section, ENBL-05..09, with the
  numbering comment continuing from v1.12 and the ENBL-04 framing stated inline.
- ENBL-05 predicate consolidation, ENBL-06 list/info rendering, ENBL-07
  enable/disable idempotency, ENBL-08 reconcile steady state, ENBL-09 update
  short-circuit — one per affected surface, plus the predicate itself.
- Noted that the repair is read-time, so existing on-disk records reclassify with
  no migration or schema bump.
- Out-of-Scope row for the defect removed.
- INV-04's forward reference repointed from Out of Scope to ENBL-06, and it now
  says explicitly not to pin the current partial-disabled rendering as correct.
- Traceability re-mapped: ENBL-05..09 to Phase 97, and LIFE-04..06, COMPAT-01,
  DOC-08 moved to Phase 98.
- DOC-08 extended to cover the repaired behavior and the false invariant in the
  reconcile comment.

**`.planning/ROADMAP.md`** — three phases to four.

- New Phase 97 with goal, dependencies, five requirements, and six success
  criteria including the no-migration constraint.
- The documentation phase renumbered 97 to 98 across the phase list, phase
  details, and progress table, so docs still come last and describe the repaired
  behavior. Renumbering was free: `.planning/phases/` is empty, so no phase
  artifact referenced the old number.
- Phase 97 depends on Phase 95 (it widens the disabled-row coverage) and is
  independent of Phase 96.

**`.planning/STATE.md`** — deferred-items row removed, the exclusion decision
reversed with its reasoning, roadmap summary rewritten for four phases,
`total_phases` 3 to 4, activity fields updated.

**`.planning/PROJECT.md`** — milestone goal widened, a target-features bullet
added describing the defect and its five-surface fallout, in-progress and
last-updated notes rewritten.

**`.planning/debug/disabled-partial-record-unrecognized.md`** — now records that
it is scheduled into Phase 97 as ENBL-05..09. Status stays `diagnosed`; the note
says to move it to `resolved/` and add a knowledge-base entry once the fix lands.

## Verification

21 requirements, 22 traceability rows including the header, phase distribution
5/6/5/5 summing to 21. Phases 95-98 consistent across the phase list, phase
details, and progress table with no duplicate or missing number. No document
still describes the defect as deferred or out of scope. `pre-commit` clean apart
from the known worktree trufflehog limitation.

## Unchanged

The three open decisions from 260807-q0v remain open. Phase 95 still cannot be
planned until the first two are settled.
