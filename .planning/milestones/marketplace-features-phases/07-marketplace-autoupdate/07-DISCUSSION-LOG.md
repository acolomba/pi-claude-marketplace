# Phase 7: Marketplace Autoupdate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-19
**Phase:** 7-Marketplace Autoupdate
**Areas discussed:** Mixed-state row order, --local-added default, Scoped-miss coverage

---

## Mixed-state row order

| Option | Description | Selected |
|--------|-------------|----------|
| Changed first (Recommended) | Pin today's contract: changed rows, then 'already …' rows, each in insertion order. Already unit-tested; no production change. | ✓ |
| Insertion order | One row per marketplace in record order regardless of outcome, like list and update. Needs a production change. | |

**User's choice:** Changed first.
**Notes:** None.

---

## --local-added default

Question 1: for a marketplace declared only in the local config, what should `noautoupdate --local` do when the entry has no value?

| Option | Description | Selected |
|--------|-------------|----------|
| Pin today (Recommended) | Report 'autoupdate disabled' and write an explicit false (layer moves from 'inherit' to a per-machine off). Literal D-07; no production change. | |
| Skip as already off | When the base does not declare the marketplace, read the missing local value as off: skipped, nothing written. Production change, test-first. | ✓ |

Question 2: when the base declares the marketplace (off) and the local entry has no value, what should `noautoupdate --local` do?

| Option | Description | Selected |
|--------|-------------|----------|
| Write override (Recommended) | Keep D-07 here: write an explicit local false and report 'autoupdate disabled'. | |
| Skip as already off | Judge the local entry by the value it inherits; an override is created only when the effective value changes. | ✓ |

Question 3: in a nameless flip without `--local` that changes the base value, should a local entry with no value also be written?

| Option | Description | Selected |
|--------|-------------|----------|
| Base only (Recommended) | Write the base only; the empty local entry inherits the new value. Rewrites one Phase 3.2 scenario. | ✓ |
| Write both | Keep today's D-06 behavior: write base and local. | |

**User's choice:** Skip as already off; Skip as already off; Base only.
**Notes:** The user chose a single principle across the three answers: a local entry without a value is judged by what it inherits. The orchestrator derived D-05 (an invalid base config fails a local flip that needs the inherited value) from CFG-03 and the project's fail-closed rule.

---

## Scoped-miss coverage

Question 1: should Phase 7 also pin the scoped misses?

| Option | Description | Selected |
|--------|-------------|----------|
| Pin both directions (Recommended) | `--scope user` when only the project holds the name, and the reverse, expecting `{marketplace not added to <scope> scope}` and unchanged configs. | ✓ |
| AU-08 only | Pin only the name neither scope holds. | |

Question 2: for an unscoped flip of a name neither scope holds, which form should AU-08 pin?

| Option | Description | Selected |
|--------|-------------|----------|
| No scope (Recommended) | Align with remove, info, and update: no scope on the not-added result. Production change, test-first. | ✓ |
| Pin [project] | Keep today's form naming the first scope tried. | |

**User's choice:** Pin both directions; No scope.
**Notes:** The inconsistency surfaced while scouting: remove, info, and update report an unscoped miss with no scope, and autoupdate names `[project]` (ATTR-05, catalog S2).

---

## D-05 proof (after research)

Research found that no scenario can make a config invalid, so D-05 had no cucumber coverage.

| Option | Description | Selected |
|--------|-------------|----------|
| Integration + unit (Recommended) | A case beside the existing CFG-03 integration test, plus paired unit tests. | |
| Unit tests only | Paired unit tests in autoupdate.test.ts only. | |

**User's choice (free text):** "unit as usual and cucumber tests. everything we've discussed has been in the process of writing cucumber tests, right"
**Notes:** Recorded as D-09. A second config-writing step writes raw layer-config text (a hand edit that breaks the file), and the steps.md rule is amended to name both writers.

---

## Claude's Discretion

- Scenario wording, fixtures, step boundaries, and plan split.
- How AU-05 proves persistence, as long as the default cannot produce the asserted value.
- Whether AU-09 uses different starting values per scope.
- Separate scenarios or Outlines for the two verbs.
- Whether a new autoupdate step module is needed.

## Deferred Ideas

- None new. The `@url`/`@github` rows stay with Phases 9 and 10, and the session-start autoupdate run stays deferred in PROJECT.md.
