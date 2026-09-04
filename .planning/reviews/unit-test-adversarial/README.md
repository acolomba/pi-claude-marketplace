# Unit-test review corpus (two passes, 2026-09)

Archived evidence for backlog item **TESTQ-01** (`.planning/BACKLOG.md`). Do not
re-file individual findings from here into the backlog -- this corpus IS the
detail; TESTQ-01 is the single tracking item.

**Tree reviewed:** branch `features/unit-test-refactor` at commit `c8417fbc`.
All `file:line` references in the reports refer to that tree. If commits land
before the fixing pass starts, re-anchor line numbers against that SHA.

**Contents:**

- 45 first-pass area reports (`*.md` in this directory) -- produced by a
  Sonnet-tier 45-way partitioned review.
- 58 adversarial second-pass reports (`adversarial/*.md`) -- produced by an
  Opus-tier pass that attacked the first pass's clean lists (mutation testing,
  export/branch censuses) and graded every first-pass finding
  (CONFIRMED/UNDERSTATED/OVERSTATED/REFUTED/DUPLICATE-OF). Large areas were
  split (`-a`/`-b`/`-c` suffixes); each sub-report states its line range.
- `META-FINDINGS.md` -- the consolidated document to plan from: production-bug
  table, ranked leverage items, gates-that-do-not-gate table, patterns to
  propagate, struck findings, operator decisions, sequencing.
- `_AUDIT.md` -- corpus-wide tallies and the per-reviewer calibration table
  (whose clean verdicts held under attack, whose collapsed).
- `_FIRST-PASS-BRIEF.md`, `_ADVERSARIAL-BRIEF.md`, `_AREAS.md`,
  `_CLEAN-LIST-REPAIR.md` -- the briefs and dispatch records for both passes.

Reports internally reference paths as `unit-test-findings/...` -- that was this
directory's name at the repo root while the passes ran; it maps 1:1 onto this
directory.

Reading order for a fixing pass: `META-FINDINGS.md` first (it reconciles
counting disputes between reports and carries the calibration rulings), then
`_AUDIT.md` for whose unexamined claims to trust, then area files as needed.
