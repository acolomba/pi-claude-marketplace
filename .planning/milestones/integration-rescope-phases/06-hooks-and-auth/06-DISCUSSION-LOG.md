# Phase 6: Hooks and Auth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-11-22
**Phase:** 6-Hooks and Auth
**Areas discussed:** Print driver, Tags, Device Flow, Unchanged checks, Breaks, Deletion, Async flake, Bugs, Parallelism

Smart discuss (autonomous mode) classified every question as a reversible technical choice: the phase changes tests and test harness code; behavior is pinned by the hook and auth decisions the scenarios cite. No question was presented to the user.

## Decided autonomously

[auto] [Print driver] — Q: "How do scenarios run Pi in print mode?" → Selected: "New features/lib module modelled on pi-json-mode.ts" (reversible technical — decided autonomously: ROADMAP note)
[auto] [Tags] — Q: "How are the scenarios tagged?" → Selected: "Untagged unless MCP" (reversible technical — decided autonomously: DUAL-02)
[auto] [Device Flow] — Q: "How are eviction and sign-in shown?" → Selected: "device-flow stand-ins" (reversible technical — decided autonomously)
[auto] [Unchanged checks] — Q: "How are 'leaves nothing' claims proved?" → Selected: "Whole-directory checks" (reversible technical — decided autonomously: review lessons)
[auto] [Breaks] — Q: "How is each replaced case checked?" → Selected: "One break per behavior, failing on When/Then" (reversible technical — decided autonomously)
[auto] [Deletion] — Q: "What happens to the four files?" → Selected: "One deleted, others trimmed to internal cases" (reversible technical — decided autonomously)
[auto] [Async flake] — Q: "Look at the async.feature:261 teardown flake?" → Selected: "Yes, in research; fix if harness race" (reversible technical — decided autonomously: affects every gate)
[auto] [Bugs] — Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4" (reversible technical — decided autonomously: milestone rule)
[auto] [Parallelism] — Q: "How are plans split?" → Selected: "By feature-file ownership" (reversible technical — decided autonomously)
