# Phase 5: MCP Install, Legacy Move, and Overrides - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-11-22
**Phase:** 5-MCP Install, Legacy Move, and Overrides
**Areas discussed:** Placement, Tags, Earlier records, Group B fields, Unchanged checks, Breaks, Deletion, Bugs, Parallelism

Smart discuss (autonomous mode) classified every question as a reversible technical choice: the phase changes tests and test harness code; product behavior is pinned by the MCP decisions the scenarios cite. No question was presented to the user.

## Decided autonomously

[auto] [Placement] — Q: "Which feature file gets each case?" → Selected: "The existing owner file; new only if none" (reversible technical — decided autonomously)
[auto] [Tags] — Q: "How are the scenarios tagged?" → Selected: "@mcp or a licensed pair; @adapter-only with ID for adapter behavior" (reversible technical — decided autonomously: ROADMAP note)
[auto] [Earlier records] — Q: "How do scenarios get earlier-release records?" → Selected: "The two earlier-record libs" (reversible technical — decided autonomously)
[auto] [Group B fields] — Q: "Do scenarios read internal record fields?" → Selected: "No; field-only checks stay for Phase 8" (reversible technical — decided autonomously: user-visible contract)
[auto] [Unchanged checks] — Q: "How are 'leaves alone' claims proved?" → Selected: "Whole file content" (reversible technical — decided autonomously: review lessons)
[auto] [Breaks] — Q: "How is each replaced case checked?" → Selected: "One reverted break per behavior, per selected profile" (reversible technical — decided autonomously)
[auto] [Deletion] — Q: "What happens to the seven files?" → Selected: "Two deleted, five trimmed to internal cases" (reversible technical — decided autonomously)
[auto] [Bugs] — Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4" (reversible technical — decided autonomously: milestone rule)
[auto] [Parallelism] — Q: "How are plans split?" → Selected: "By feature-file ownership" (reversible technical — decided autonomously)
