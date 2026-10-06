---
phase: 261004-tbe
plan: 01
subsystem: build-verification
tags: [tests, ci, check-changed, documentation]
status: complete
requires: []
provides:
  - "docs/output-catalog.md as the only documentation build input"
affects:
  - tests/architecture
  - .github/workflows/ci.yml
  - scripts/check-changed.mjs
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - tests/architecture/partial-vocabulary-guard.test.ts
    - tests/architecture/gate-targets.ts
    - docs/messaging-style-guide.md
    - .github/workflows/ci.yml
    - scripts/check-changed.mjs
    - skills/local-verification/SKILL.md
    - CHANGELOG.md
  deleted:
    - tests/architecture/workflows-doc-pins.test.ts
    - tests/architecture/dependency-doc-agreement.test.ts
    - tests/architecture/messaging-guide-doc-pins.test.ts
decisions:
  - "Changelog sub-bullet reworded to avoid the word `check`, which the simple-english self-check flags"
metrics:
  completed: 2026-10-04
commits: 2
plan_head_before: a8928ece
plan_head_after: b1094171
actuals:
  tasks: 2
  commits: 2
---

# Quick Task 261004-tbe: Remove the documentation-agreement tests Summary

Three architecture suites that pinned README and design-doc prose are deleted, the retired-vocabulary guard now scans only the extension tree, the unit tests, and `docs/output-catalog.md`, and that catalog is the only document CI and the commit-time selector treat as a build input.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 1 (tracer) | ce38da6a | test(architecture): remove documentation agreement tests |
| 2 | b1094171 | perf(checks): keep only the output catalog as a documentation input |

Diff a8928ece..b1094171: 10 files changed, 23 insertions, 1427 deletions.

## Task 1

- `git rm` of `workflows-doc-pins`, `dependency-doc-agreement`, and `messaging-guide-doc-pins`.
- `partial-vocabulary-guard.test.ts`: header now names only the catalog as a doc; `collectGuardedSources` reads only the catalog; the sanity case drops the style-guide clause; the two `mapping` waivers and the `mapping` category are gone ("Two categories"); the `ABSENT_SOFT_DEP_PROSE` comment now says no guarded file may spell the retired sentences; the whole PRD section (11 cases) is removed.
- `gate-targets.ts`: `VOCABULARY_GUARD_DOC_TARGETS` is `[docs/output-catalog.md, catalog-contract.test.ts]`; doc comment names the catalog only.
- `docs/messaging-style-guide.md`: the MSGDOC-01 citation sentence is removed.
- Tracer gate: the five catalog readers passed (78/78), and the task `<verify>` passed after the commit.

## Task 2

- `ci.yml`: both `paths` lists name `docs/output-catalog.md` as their only document.
- `check-changed.mjs`: `documentationFiles = new Set(["docs/output-catalog.md"])`; `selectDocumentation` still adds `test:architecture`.
- `skills/local-verification/SKILL.md`: names only the catalog as a documentation input.
- CHANGELOG #236 sub-bullet (final wording): "Tests no longer compare the READMEs or other documents with the code, so `docs/output-catalog.md` is the only document that is a build input."
- CONTRIBUTING.md and `.planning/codebase/` needed no edit (grep for the deleted suites found nothing).

## Evidence (last line of each tmp/tbe log)

| Log | Last line |
| --- | --- |
| node-test-1.log | NODE_TEST_EXIT=0 |
| typecheck-1.log | TYPECHECK_EXIT=0 |
| lint-1.log | LINT_EXIT=0 |
| fallow-1.log | FALLOW_EXIT=0 |
| precommit-1.log | PRECOMMIT_EXIT=0 |
| selection-1.json | LIST_EXIT=0 (scope `broad`, from the deleted suites) |
| lint-2.log | LINT_EXIT=0 |
| selection-2.json | LIST_EXIT=0 (scope `broad`, from `ci.yml` and `check-changed.mjs`) |
| precommit-2.log | PRECOMMIT_EXIT=0 |

- Pre-commit scope: Task 1 selected `broad` (deleted suites; runs format:check, typecheck, lint, lint:workflows, fallow, test:corresponding, test:architecture). Task 2 selected `broad` (`ci.yml`, `check-changed.mjs`).
- Fallow audit verdicts: Task 1 `pass`, Task 2 `pass`.
- gitlint passed on both commit messages.
- `tmp/tbe/` was removed after the run.

Focused task verification passed; full phase/PR verification pending.

## Deviations from Plan

**1. [Rule 1 - Wording] Changelog sub-bullet reworded**
- **Found during:** Task 2 step 5
- **Issue:** The simple-english self-check lists `check` as a word to fix, and the planned wording was "Tests no longer check documentation wording, ...".
- **Fix:** Used "Tests no longer compare the READMEs or other documents with the code, so `docs/output-catalog.md` is the only document that is a build input." (23 words).
- **Commit:** b1094171

Otherwise the plan ran as written.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- ce38da6a and b1094171 exist on `features/faster-precommit`.
- The three suites are absent; the seven modified files are committed.
- Both task `<verify>` commands printed their OK markers.
