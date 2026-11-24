# Phase 7: Path-Source Dependency Tags - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-11-22
**Phase:** 7-Path-Source Dependency Tags
**Areas discussed:** Tag step, Placement, Tags, CR-01, Content checks, Breaks, Deletion, Bugs

Smart discuss (autonomous mode) classified every question as a reversible technical choice: the phase changes tests and test harness code; behavior is pinned by TAGS-01..03 and CR-01. No question was presented to the user.

## Decided autonomously

[auto] [Tag step] — Q: "Where does the marketplace-tag step go?" → Selected: "publishing.steps.ts with a shared builder" (reversible technical — decided autonomously)
[auto] [Placement] — Q: "Which feature file?" → Selected: "The existing owner" (reversible technical — decided autonomously)
[auto] [Tags] — Q: "How are scenarios tagged?" → Selected: "Untagged" (reversible technical — decided autonomously: DUAL-02)
[auto] [CR-01] — Q: "Scenario for the untracked file?" → Selected: "Only if user-visible" (reversible technical — decided autonomously: ROADMAP note)
[auto] [Content checks] — Q: "How is tag content proved?" → Selected: "Whole rows and artifact text" (reversible technical — decided autonomously)
[auto] [Breaks] — Q: "How is each case checked?" → Selected: "One break per behavior on When/Then" (reversible technical — decided autonomously)
[auto] [Deletion] — Q: "What happens to the file?" → Selected: "Keeps internal cases" (reversible technical — decided autonomously)
[auto] [Bugs] — Q: "Product bug?" → Selected: "Rule 4" (reversible technical — decided autonomously)
