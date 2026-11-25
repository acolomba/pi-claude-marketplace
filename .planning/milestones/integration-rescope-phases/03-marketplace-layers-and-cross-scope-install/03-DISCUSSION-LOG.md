# Phase 3: Marketplace Layers and Cross-Scope Install - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-11-21
**Phase:** 3-Marketplace Layers and Cross-Scope Install
**Areas discussed:** Placement, Unchanged checks, Harness, Breaks, Deletion, Parallelism, Bugs

Smart discuss (autonomous mode) classified every question as a reversible technical choice; product behavior is pinned by recorded decisions (D-09, CFG-03, LAYER-02, LAYER-03, LAYER-07, WR-07, MA-12, MA-13, D-MF-04). No question was presented to the user.

## Decided autonomously

[auto] [Placement] — Q: "Where does each moved case go?" → Selected: "By verb into the marketplace feature files and plugin/cross-scope-install.feature" (reversible technical — decided autonomously: placement)
[auto] [Unchanged checks] — Q: "How does a scenario prove 'changes nothing'?" → Selected: "Whole-scope file steps plus the git-host no-request step" (reversible technical — decided autonomously: step reuse)
[auto] [Harness] — Q: "How are a leftover clone, a foreign tree, and a stale user clone set up?" → Selected: "New Given steps in the marketplace topic modules, named in the plan" (reversible technical — decided autonomously: harness shape)
[auto] [Breaks] — Q: "How is each replaced case checked before deletion?" → Selected: "One reverted break per behavior, recorded in SUMMARY.md" (reversible technical — decided autonomously: test approach)
[auto] [Deletion] — Q: "Which files go?" → Selected: "Three deleted when covered; two keep their internal cases" (reversible technical — decided autonomously: git history)
[auto] [Parallelism] — Q: "How are plans split?" → Selected: "By feature-file ownership; the harness plan comes first" (reversible technical — decided autonomously: wave layout)
[auto] [Bugs] — Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4" (reversible technical — decided autonomously: milestone rule)
