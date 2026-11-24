# Phase 4: Prune - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-11-22
**Phase:** 4-Prune
**Areas discussed:** Failed member, Unchanged checks, Steps, Malformed state, Breaks, Deletion, Bugs

Smart discuss (autonomous mode) classified every question as a reversible technical choice; prune behavior is pinned by existing prune decisions and the ROADMAP. No question was presented to the user.

## Decided autonomously

[auto] [Failed member] — Q: "How does a scenario make a prune member fail?" → Selected: "A user-reachable failure if one exists; else keep the case as fault injection for Phase 8" (reversible technical — decided autonomously: follows the ROADMAP note)
[auto] [Unchanged checks] — Q: "How do 'changes nothing' claims get proved?" → Selected: "Whole-scope file steps for every touched scope" (reversible technical — decided autonomously: step reuse)
[auto] [Steps] — Q: "Where do new prune steps go?" → Selected: "New verb module plugin/prune.steps.ts" (reversible technical — decided autonomously: layout rule)
[auto] [Malformed state] — Q: "How is 'without showing its path' checked?" → Selected: "Complete rows plus a check that no absolute path appears" (reversible technical — decided autonomously: test approach)
[auto] [Breaks] — Q: "How is each replaced case checked before deletion?" → Selected: "One reverted break per behavior" (reversible technical — decided autonomously: test approach)
[auto] [Deletion] — Q: "What happens to standalone-prune?" → Selected: "Keeps only internal cases, header says why" (reversible technical — decided autonomously: git history)
[auto] [Bugs] — Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4" (reversible technical — decided autonomously: milestone rule)
