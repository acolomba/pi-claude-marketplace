# Phase 8: Integration Suite Rescope - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-11-23
**Phase:** 8-Integration Suite Rescope
**Areas discussed:** Classification, Moves to unit tests, Deletion proof, Headers, Charter, Docs pass, Upstream parity, Bugs, Final gate

Smart discuss (autonomous mode) classified every question as a reversible technical choice: the phase classifies, moves, or deletes tests and writes the charter. No question was presented to the user.

## Decided autonomously

[auto] [Classification] — Q: "How is each case classified?" → Selected: "Per-case class with evidence" (ITSCOPE-01)
[auto] [Moves to unit tests] — Q: "How does a case move?" → Selected: "Beside its source pair, 100% direct coverage" (layout rule)
[auto] [Deletion proof] — Q: "Break before deleting a covered case?" → Selected: "Yes" (milestone rules)
[auto] [Headers] — Q: "What does a header say?" → Selected: "Class and uncovered behavior; fix overclaims" (ITSCOPE-02)
[auto] [Charter] — Q: "Where and what?" → Selected: "Same rule in two skills and TESTING.md" (ITSCOPE-03)
[auto] [Docs pass] — Q: "Fix Phase 1 doc claims?" → Selected: "If confirmed wrong" (cleanup)
[auto] [Upstream parity] — Q: "Unlicensed divergence?" → Selected: "Ask the user" (milestone rule)
[auto] [Bugs] — Q: "Product bug?" → Selected: "Rule 4" (milestone rule)
[auto] [Final gate] — Q: "When is ITSCOPE-04 checked?" → Selected: "After all merges" (ITSCOPE-04)
