# Phase 2: Plugin Layers, Names, and List Fold - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-21
**Phase:** 2-Plugin Layers, Names, and List Fold
**Areas discussed:** LAYER-04 shape, LAYER-04 harness, ITMIG-02 cases, Reserved names file, Reserved names steps, List fold, Breaks, Deletion, Bugs, Parallelism

Smart discuss (autonomous mode) classified every question as a reversible technical choice: the phase changes tests, test harness code, and docs; product behavior is pinned by existing decisions (LAYER-04, CFG-03, D-08-07, D-PL5-28, CMC-21, D-13-17). No question was presented to the user.

## Decided autonomously

[auto] [LAYER-04 shape] — Q: "How are the 12 LAYER-04 cases written?" → Selected: "One Scenario Outline per verb in its own feature file, two Examples rows for the two directions" (reversible technical — decided autonomously: scenario layout)
[auto] [LAYER-04 harness] — Q: "Which steps do the refusals use?" → Selected: "Existing config and byte steps; a staged-artifact check goes in a shared topic module if missing" (reversible technical — decided autonomously: step reuse)
[auto] [ITMIG-02 cases] — Q: "Which plugin-layer-consistency cases become scenarios?" → Selected: "All seven, placed by the verb they exercise" (reversible technical — decided autonomously: placement)
[auto] [Reserved names file] — Q: "Where do the constructor and __proto__ scenarios go?" → Selected: "New features/plugin/reserved-names.feature covering the whole ITMIG-03 list" (reversible technical — decided autonomously: one file, easy to split)
[auto] [Reserved names steps] — Q: "Where do new steps go?" → Selected: "Existing modules first; otherwise a named verb-free topic module" (reversible technical — decided autonomously: module placement)
[auto] [List fold] — Q: "How is the unfiltered list fold shown?" → Selected: "Two plugin/list.feature scenarios checking the complete output" (reversible technical — decided autonomously: wording)
[auto] [Breaks] — Q: "How is each replaced case checked before deletion?" → Selected: "One reverted deliberate break per behavior, recorded in SUMMARY.md" (reversible technical — decided autonomously: test approach)
[auto] [Deletion] — Q: "Which files go?" → Selected: "fold-adoption, reserved-record-keys, plugin-layer-consistency when covered; plugin-layer-verbs keeps LAYER-06" (reversible technical — decided autonomously: git history)
[auto] [Bugs] — Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4" (reversible technical — decided autonomously: milestone rule)
[auto] [Parallelism] — Q: "How are plans split?" → Selected: "By feature-file ownership, disjoint files per wave" (reversible technical — decided autonomously: wave layout)

## Claude's Discretion

- Scenario titles, step wording, table columns; break edits; plan count and waves.

## Deferred Ideas

None.
