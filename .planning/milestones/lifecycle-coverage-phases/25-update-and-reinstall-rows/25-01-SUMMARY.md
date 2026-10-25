---
phase: 25-update-and-reinstall-rows
plan: 01
subsystem: dependency-constraints
tags: [update, reinstall, reconcile, dependency-range, cause-line, INR-05]

requires:
  - phase: 27-install-and-reconcile-reason-residue
    provides: install's declared-range cause form (INR-05) and the private join-and-bound helper
provides:
  - renderDeclaredRanges exported from domain/dependency-range.ts, the one join-and-bound helper
  - update/reinstall constraint cause lines and disclosures that print declared ranges
  - reconcile's {dependency version unsatisfied} remedy that prints declared ranges, bounded once
affects: [25-08 constraint cause line on updated/reinstalled rows]

actuals:
  tokens: 14700
  tasks: 2
  commits: 2
plan_head_before: 56068df8
plan_head_after: 0ef67e204af9f65f18ed45cee3d5309673643cc7

tech-stack:
  added: []
  patterns:
    - "describeConstraint takes a discriminated ConstraintLine, so only the transport arm can carry free detail"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/dependency-range.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - docs/output-catalog.md
    - docs/dependency-resolution.md
    - features/plugin/update.feature
    - features/plugin/reconcile.feature

key-decisions:
  - "renderDeclaredRanges lives in domain/dependency-range.ts, the layer plugin and reconcile orchestrators both import (no BLOCK C edge)"
  - "describeConstraint(holders, line) derives the range text from the holders it names; the transport arm alone passes a classification"
  - "The reconcile verdict bounds the joined ranges once; the remedy prints them verbatim"

requirements-completed: [INR-05]

duration: 45min
completed: 2026-10-23
status: complete
---

# Phase 25 Plan 01: Declared-range cause lines Summary

**Update, reinstall, and reconcile cause lines now print the dependents' declared ranges joined with `, ` (`(^1.0.0, ^2.0.0)`), through one domain helper that install also uses, instead of the folded intersection or a fold diagnostic.**

## Performance

- Duration: about 45 min
- Tasks: 2 of 2
- Files modified: 23 (13 in task 1, 10 in task 2; `docs/output-catalog.md`, `docs/dependency-resolution.md`, and the catalog contract test in both)

## Accomplishments

- `renderDeclaredRanges` moved from `install-cascade.ts` into `domain/dependency-range.ts` as an export. Install imports it and keeps its exact bytes.
- `update-constraint-gate.ts::describeConstraint` now takes `(holders, ConstraintLine)`. Every range-naming arm (disjoint, invalid, too-complex, out-of-range, already-resolved, range-only) prints the declared ranges of the holders the line names. The transport arm keeps its classification. The verdict's `range`, the tag probes' input, and every admit or hold decision are unchanged.
- `reconcile/dependency-verdict.ts::unsatisfiedRange` returns `renderDeclaredRanges(ranges)` on both reported arms. The fold still decides. `apply-outcomes.ts::dependencyRemedy` no longer bounds a second time.

## Task Commits

1. Task 1: update and reinstall constraint cause lines print the declared ranges. Commit `528d6aca`.
2. Task 2: reconcile's version remedy prints the declared ranges. Commit `0ef67e20`.

## Tests whose expected strings changed because the real gate or verdict produces them

- `test/orchestrators/plugin/update-constraint-gate.test.ts`: the two disjoint causes (`(^1.0.0, ^2.0.0)`), and seven disclosures (`(^1.0.0)`, `(^1.0.0, >=1.2.0)`). The invalid and too-complex loop and the transport case now assert the whole verdict. New cases: a holder without a range is named but adds nothing, and an out-of-range hold prints the rejecting holder's declared range instead of the fold.
- `test/orchestrators/plugin/update-flow.test.ts`: one case, "D-10-13: an up-to-date constrained plugin discloses the range that admits it" (line 9001, `(^1.0.0)`).
- `test/orchestrators/plugin/update-preflight.test.ts`: needed no change. Its real-gate strings use a holder whose declared range equals the fold (`<=2.0.0`), and its other disclosures are injected input.
- `test/domain/dependency-range.test.ts`: new `renderDeclaredRanges` cases (one range, two ranges, a `||` range, the 200-character bound).
- `test/orchestrators/reconcile/dependency-verdict.test.ts`: four expected ranges (`^2.0.0`, `>=1.0.0, <1.5.0`, `>=2.0.0, <1.0.0`, and the bounded cap-trip text). One case was renamed because it no longer reports a fold. One case is new: a foldable list longer than 200 characters is bounded once.
- `test/orchestrators/reconcile/apply-outcomes.test.ts`: the double-bound case now checks the new contract. The remedy prints the verdict's already-bounded range verbatim.
- `test/architecture/catalog-uat/catalog-contract.test.ts`: `EXPECTED_UTF8_BYTES` 48_699 -> 48_633 -> 48_623 (the catalog blocks got shorter).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Catalog contract byte total**
- Found during: Task 1 and Task 2 (`npm run test:architecture`)
- Issue: `catalog-contract.test.ts` pins the total UTF-8 bytes of every catalog block. The plan's file list left it out.
- Fix: updated `EXPECTED_UTF8_BYTES` to the new totals (-66 bytes, then -10 bytes). The new totals match the string changes exactly.
- Commits: `528d6aca`, `0ef67e20`

**2. [Rule 3 - Blocking] markdownlint MD038 on a `, ` code span**
- Found during: Task 1 pre-commit
- Issue: markdownlint rejects a code span with leading or trailing spaces, so the docs cannot show the separator as code.
- Fix: the docs and catalog prose say "separated by commas as Claude Code prints them" and leave out the code span.

No other deviations. No file owned by Phase 26 was staged.

## Verification

- `npm run test:coverage:direct` on every touched source pair: exit 0.
- `npm run test:architecture`: exit 0.
- Cucumber: the held update scenario, all of `update.feature` and `reconcile.feature` (27 scenarios), and `install-dependencies.feature` (11 scenarios, not edited): all passed.
- `npm run check` at `0ef67e20`: exit 0.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-25-01 is mitigated as planned: declared ranges are checked against the allowlist and the 64-character bound at parse time, and the join is bounded once to 200 characters with an exact overflow count. Unit tests check this in the helper and in the verdict.

## Self-Check: PASSED

- Commits `528d6aca` and `0ef67e20` are ancestors of HEAD.
- `export function renderDeclaredRanges` is in `domain/dependency-range.ts`. There is no local copy in `install-cascade.ts`.
- `>=1.0.0 <2.0.0-0` does not appear in `update.feature`. `>=2.0.0 <3.0.0-0` does not appear in `reconcile.feature`, `dependency-resolution.md`, or `output-catalog.md`. `ranges.join(" ")` does not appear in `dependency-verdict.ts`.
