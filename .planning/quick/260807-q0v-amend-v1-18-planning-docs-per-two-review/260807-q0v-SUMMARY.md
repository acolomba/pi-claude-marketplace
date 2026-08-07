---
quick_id: 260807-q0v
description: amend v1.18 planning docs per two-review validation findings
date: 2026-08-07
status: complete
---

# Quick Task 260807-q0v: Summary

Doc-only amendment of the v1.18 planning artifacts after two independent reviews
were validated against the codebase. No source files changed.

## What changed

**`.planning/REQUIREMENTS.md`**

- INV-02 lost a false premise. It claimed manifest-absent partial records would
  otherwise be flattened to `(installed)` or omitted; neither happens, because
  partial classification reads `compatibility.unsupported` alone, which is
  manifest-independent. Adding the reason is the only change.
- INV-03, INV-04, BOUND-02, LIFE-04, LIFE-05, and LIFE-06 now state plainly that
  they already hold and that their deliverable is coverage.
- INV-04 narrowed to the canonical disabled shape (`enabled: false` with
  `compatibility.installable: true`).
- BOUND-03 added for the cross-scope orphan-fold manifest-provenance constraint.
- BOUND-01 now names the output catalog and tests as authoritative and flags the
  PRD row as stale.
- INFO-10 disambiguated: it governs the installation-record-backed arm, and
  v1.18 does not unify the path-source arm's live-resolver derivation with the
  persisted-record derivation used elsewhere.
- INFO-11 rewritten. The sorting clause no longer implies sorted hooks; the
  name-fidelity limit (generated versus source names) and the hook-fidelity limit
  (supported subset only) are stated, along with the containment-guard obligation.
- INFO-12 now records that it becomes a real guard after the Phase 96 reorder
  rather than a property inherited for free.
- COMPAT-01 gained the `grep`-versus-`readFile` constraint for any new
  source-scanning gate.
- DOC-08 expanded to name four specific documentation defects.
- Out of Scope gained three rows: the disabled-plus-partial defect, full-fidelity
  hook reconstruction, and LLM tool-surface reason exposure.
- Coverage 15/15 to 16/16; missing DOC numbering comment added.

**`.planning/ROADMAP.md`**

- Phases rebalanced. Phase 95 is characterization-first with two production
  changes; Phase 96 is named the substantive phase; Phase 97 expects no lifecycle
  production changes.
- Success criteria updated across all three phases.
- Open Decisions block added with three entries.
- npm 0.14.0 recorded as the release target.

**`.planning/STATE.md`**

- Open decisions section added and mirrored into Decisions.
- Roadmap Summary rewritten to reflect the already-satisfied split.
- Operator Next Steps now leads with resolving the open decisions.
- Quick task row and activity fields updated.

**`docs/plans/2026-08-07-…-design.md`**

- The unconditional "every list is sorted" assertion, which would have mandated
  sorting hooks and broken two byte-exact tests, narrowed to the four name-list
  kinds.
- Hook containment guard and supported-subset caveat added.
- The `--fetch` rationale corrected: the installation record carries
  `resolvedSource`, so network-free behavior needs an explicit guard rather than
  an argument from absence.
- Fold-path provenance constraint added to section 1.
- Contract table's disabled row narrowed.
- Test strategy now separates characterization tests from new-behavior tests.

## Decisions recorded, not resolved

1. Reason braces on installed inventory rows (INV-01 reverses a deliberate
   suppression).
2. Component name fidelity on the state-only info arm.
3. LLM tool-surface reason exposure.

## Verification

`pre-commit run --files …` clean across all edited files. No source changes, so
`npm run check` was not re-run.

## Notes for whoever plans Phase 96

`extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` contains a
literal NUL byte, so shell `grep` and `git grep` classify it as binary and
silently skip it. Use `grep -a` or read it directly. This nearly produced a false
"info.ts has no manifest handling" conclusion during validation.
