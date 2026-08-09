---
created: 2026-08-08
resolves_phase: 96
source: 95-REVIEW.md WR-05(b), deferred by 95-REVIEW-FIX.md iteration 2
---

# Folded-row manifest choice for upgradable/description (BOUND-01/02 axis)

Phase 95's fix loop made `{not in manifest}`, `(upgradable)`, and the PL-4
description all derive coherently from the record's OWN manifest via the
`ManifestLookup` discriminated value (`manifestLookupFor`, `list.ts`). The
question deliberately left open: which manifest a cross-scope FOLDED row should
describe at all — the project-side record's manifest (current behavior) or the
user block header's manifest it renders under.

Also on the same axis (pre-existing, noted in 95-REVIEW.md info items): folded
rows are discarded wholesale when the owning manifest fails to load
(`list.ts` fold path, ~923-935 pre-fix numbering) — same failure class BOUND-03
fixed one level down.

Carrier: bring this into Phase 96 discuss (BOUND-01/BOUND-02). The
`docs/output-catalog.md` manifest-absent-inventory paragraph explicitly marks
this as open so Phase 96 does not read it as settled contract.
