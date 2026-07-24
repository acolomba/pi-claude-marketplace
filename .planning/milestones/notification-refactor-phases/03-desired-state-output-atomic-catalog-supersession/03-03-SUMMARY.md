---
phase: 03-desired-state-output-atomic-catalog-supersession
plan: 03
subsystem: docs
tags: [catalog, output-grammar, present-installed-collapse, OUT-08, GATE-02, D-06]
requires:
  - "Phase 2 (RLD-04 / D-08): runtime present->installed status collapse already shipped (PluginInstalledMessage absorbed the list-surface inventory row)."
  - "03-01, 03-02: prior Phase-3 catalog rewrites on docs/output-catalog.md (leading sentence + trailing tally) landed before this plan to avoid same-file contention."
provides:
  - "docs/output-catalog.md prose + status-token reference table with the present discriminator collapsed into installed."
affects:
  - "docs/output-catalog.md (the hand-authored user-contract byte catalog; prose/table only)."
tech-stack:
  added: []
  patterns:
    - "Atomic catalog supersession: prose/table-only edit with ZERO catalog-uat fixture-byte change (the fenced render was already (installed))."
key-files:
  created:
    - ".planning/workstreams/notification-refactor/phases/03-desired-state-output-atomic-catalog-supersession/03-03-SUMMARY.md"
  modified:
    - "docs/output-catalog.md"
decisions:
  - "Merged the two status-token table rows ((installed) and (installed) (via present discriminator)) into a single (installed) row carrying both the steady-state-inventory and the install/cascade-transition descriptions, with the list-surface no-reload-hint note (SNM-15 / G-21-01) folded into the merged cell."
  - "Reframed the reload-hint trailer prose (catalog L73) around the installed token's inventory-vs-transition straddle (resolved structurally at the KIND level), replacing the present-vs-installed distinction language; the disabled-token straddle paragraph stays intact."
  - "mdformat (pre-commit auto-fix) re-tabulated the status-token table column widths after the wide (via present discriminator) row label was removed -- a mechanical consequence of the row merge, not unrelated churn; no fenced block touched."
metrics:
  duration: "~9 min"
  tasks_completed: 1
  files_changed: 1
  completed: 2026-06-24
---

# Phase 3 Plan 03: Catalog present->installed grammar collapse Summary

Collapsed the stale `present` discriminator references in `docs/output-catalog.md` prose and the status-token reference table into `installed`, catching the hand-authored user-contract catalog up to the Phase-2 runtime collapse (RLD-04 / D-08) -- a prose/table-only edit with zero catalog-uat fixture-byte change.

## What Was Built

Task 1 (OUT-08 / D-06): edited six prose/table lines in `docs/output-catalog.md`:

- **Status-token reference table (L131-132 -> single row):** merged `(installed) (via present discriminator)` into the single `(installed)` row. The merged cell now states the list-surface steady-state-inventory render is the same `(installed)` token (no separate `present` discriminator), and that on the list surface it does not trigger the reload-hint (SNM-15 / G-21-01) while the install/cascade transition does.
- **Reload-hint trailer prose (L73):** reframed around the `installed` token's inventory-vs-transition straddle resolved structurally at the KIND level (hint-free on kind-less / `cascade` payloads, trigger on the install cascade), dropping the `present`-vs-`installed` distinction language. The `disabled`-token straddle sentence is unchanged.
- **Failed-marketplace prose (L247):** the other marketplace's list row is now described as the `installed` steady-state inventory token (was `present`).
- **Hash-version list prose (L289):** "The `installed` inventory row carries no `/reload` trailer on the list surface" (was "The `present` inventory discriminator ...").
- **PL-4 description prose (L318):** the four list-surface variants are now `installed`/`upgradable`/`available`/`unavailable` (dropped `present`); the cascade-only set drops `installed`.

## Verification

- `node --test tests/architecture/catalog-uat.test.ts tests/architecture/notify-grammar-invariant.test.ts` -> 9/9 pass (GATE-02 green; zero fixture-byte change; no lingering `present`-token assumption).
- `npm run check` -> exit 0 (typecheck + ESLint + Prettier + tests, including integration).
- `pre-commit run --files docs/output-catalog.md` -> exit 0 (mdformat reflowed prose + re-tabulated the table; re-ran clean; fix-unicode-dashes passed -- ASCII-only).
- Fence safety: `git diff -U0` shows changes only on prose/table lines, never inside a ```text fence body; `grep '(present)'` and `grep '`present`'` both return no matches.

## Deviations from Plan

None -- plan executed exactly as written. RESEARCH Assumption A4 (no fenced block emits the literal `(present)` token) was confirmed before editing; the catalog-uat two-direction walk is unaffected.

The plan named the table merge as L131-132 and listed prose lines L73/L247/L289/L318. All six lines were edited as specified. The pre-commit mdformat hook then auto-reflowed the surrounding prose paragraphs and re-tabulated the table column widths (mechanical, no semantic change, no fence touched), which the gate tests and pre-commit confirmed clean.

## Self-Check: PASSED

- FOUND: docs/output-catalog.md (modified)
- FOUND: .planning/workstreams/notification-refactor/phases/03-desired-state-output-atomic-catalog-supersession/03-03-SUMMARY.md
- FOUND commit: 15032eb7 (docs(03-03): collapse present into installed in catalog grammar)
