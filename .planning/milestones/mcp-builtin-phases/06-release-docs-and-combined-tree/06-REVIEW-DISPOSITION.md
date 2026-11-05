# Phase 6 — Review Disposition

One row per finding in `06-REVIEW.md`. Iteration 1 (`8a2ccd9`) had 3 warnings and 7
info items. Iteration 2 (`506b2cd`) re-reviewed the fix commits: 0 warnings and 8 info
items, two of them new (IN-08, IN-09). Fix details and checks are in `06-REVIEW-FIX.md`.
The fix scope was critical plus warning, so the info items stay deferred for the user's
review.

| Finding | Severity | Disposition | Commit | Note |
|---------|----------|-------------|--------|------|
| WR-01 | warning | fixed | 4ef28fa | the README remedy for `{requires builtin mcp}` says to remove pi-mcp-adapter first, then turn on built-in MCP |
| WR-02 | warning | fixed | 970f5e2 | `list` and completion share `classifyInstalledForImplementation`; the classifier header no longer cites a missing test |
| WR-03 | warning | fixed | 4dc6a36 | records and comments only: D-P6-22 amended to the stamped single cache file (P6-PLN-03); the cache design is unchanged |
| IN-01 | info | deferred | — | the cucumber completion step injects the profile's implementation; the per-lookup snapshot is covered by a unit test only |
| IN-02 | info | deferred | — | phase-scoped IDs (D-P6-18, D-P6-22, P2-DC-53, P2-DC-77) are cited in code, features and two test titles but have no Key Decisions row |
| IN-03 | info | fixed | 970f5e2 | completion no longer reads the MCP verdict of a disabled record |
| IN-04 | info | deferred | — | the CHANGELOG names `install` and `update --partial` only; plain `update`, `fetch` and `install --partial` completion change too |
| IN-05 | info | deferred | — | the cache schema repeats the implementation literals instead of deriving them |
| IN-06 | info | deferred | — | the direct-swap grant test sets the run and the argument to the same implementation |
| IN-07 | info | deferred | — | the cache stamp option is optional only for test fixtures |
| IN-08 | info | deferred | — | `classifyInstalledRecord`'s disabled branch no longer runs in production; its comments say completion relies on it |
| IN-09 | info | deferred | — | the new edge-deps cases add a fourth `describe`, a ternary in the loop body, and titles that say "verdict read" |
