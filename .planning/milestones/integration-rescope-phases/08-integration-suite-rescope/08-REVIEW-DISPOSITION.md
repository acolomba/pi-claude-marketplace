---
phase: 08-integration-suite-rescope
review_path: .planning/phases/08-integration-suite-rescope/08-REVIEW.md
fix_report_path: .planning/phases/08-integration-suite-rescope/08-REVIEW-FIX.md
updated: 2026-11-23
open_critical: 0
open_warning: 0
---

# Phase 8: Code Review Disposition (wave 1)

Three review passes (--auto loop) over plans 08-01 to 08-04. Final review: 0 critical, 0 warning, 4 info; three fixed by the orchestrator afterwards.

| Finding | Severity | Disposition | Where |
|---------|----------|-------------|-------|
| WR-01 (iter 1) | warning | fixed | 7d76c64: the built-in-only encoding rows moved beside `bridges/mcp/builtin-entry.ts` |
| WR-02..WR-04, IN-02, IN-03 (iter 1) | warning/info | fixed | 761cb6c, fad4b1a, 5ee23f1, 03b7423: headers claim only what their cases assert |
| WR-05, IN-05 (iter 1) | warning/info | fixed | 9403a1c, dc8aa81: charter gains `test/architecture/` and narrows the earlier-release class |
| IN-01, IN-04 (iter 1) | info | fixed | d3d1fb0, bd558ea |
| WR-01 (iter 2) | warning | fixed | 79a6244: built-in row titles say what each case asserts |
| WR-02, WR-03 (iter 2) | warning | fixed | 1823efd, 2b1d839: conformance and race headers reworded |
| IN-01 (iter 2) | info | fixed | f63bc50: ASTAT-01 user override row became an `@adapter-only` scenario (red-proved); the integration case was deleted |
| IN-02..IN-06 (iter 2) | info | fixed | b90ca44, 90016ae, f9edc23, 5dc96ce |
| IN-01, IN-02, IN-03 (iter 3) | info | fixed | df66399 (orchestrator): the status header says the case adds the adapter's constants over Pi's real bus; the race comment says it cannot tell one writer from two; the earlier-release writer rule names what all writers share |
| IN-04 (iter 3) | info | open | expansion row titles show the table's internal label `env-builtin` |

Plan 08-05 (the `docs/hooks-compatibility.md:77` claim and the ITSCOPE-04 gate) runs after Phase 6.1 completes.
