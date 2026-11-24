---
phase: 08-integration-suite-rescope
plan: "04"
subsystem: testing
tags: [docs, skills, integration-tests, charter]
status: complete

requires: []
provides:
  - "The `## Where a test goes` section of the typescript-unit-tests skill and of the cucumber skill"
  - "The same rule nested under the `**Integration Tests:**` bullet of .planning/codebase/TESTING.md"
affects: [integration-rescope, typescript-unit-tests, cucumber]

actuals:
  tokens: 1836
  tasks: 2
  commits: 2
plan_head_before: 17fca7ad0a642c66fd01799d08ee233390cc7449
plan_head_after: b0e9ac2536f1aa6bf184ab3c67a1bee786cafcef

tech-stack:
  added: []
  patterns:
    - "One charter text, word for word, in three places, checked by a same-words comparison of the list items"

key-files:
  created: []
  modified:
    - .agents/skills/typescript-unit-tests/SKILL.md
    - .agents/skills/cucumber/SKILL.md
    - .planning/codebase/TESTING.md

key-decisions:
  - "The charter text is the frozen edit lists 08-04-t1.json and 08-04-t2.json, applied unchanged; no wording finding"

patterns-established:
  - "A test case goes where it can observe the behavior it checks: cucumber for what a user sees, the source pair for one module, test/integration/ only for peer conformance, multi-process, internal, or a known bug with a BACKLOG entry"

requirements-completed: [ITSCOPE-03]

duration: 3min
completed: 2026-11-23
---

# Phase 8 Plan 04: Integration Suite Charter Summary

The integration suite's charter, "Where a test goes", now sits word for word in the typescript-unit-tests skill, the cucumber skill, and the integration bullet of TESTING.md, with nine identical list items naming the four integration classes (peer conformance, multi-process, internal, known bug).

## Performance

- Started: 2026-11-23T04:21Z
- Completed: 2026-11-23T04:23Z
- Tasks: 2 (1 tracer, 1 auto)
- Files modified: 3

## Insertion points

| File | Position | Commit |
| --- | --- | --- |
| `.agents/skills/typescript-unit-tests/SKILL.md` | `## Where a test goes` inserted right before `## Review`, after the "Read before you act" table (lines 26 to 38) | 5ddb6dd |
| `.agents/skills/cucumber/SKILL.md` | `## Where a test goes` inserted right before `## Read before you act`, after the intro paragraph (lines 10 to 22) | b0e9ac2 |
| `.planning/codebase/TESTING.md` | the `**Integration Tests:**` bullet (old lines 187 and 188, `16 files` and "exercise multiple layers together") replaced by the same rule nested under the bullet; the dated count block (`**Verified counts (2026-10-05):**`, `- 16 under test/integration/`) is unchanged | b0e9ac2 |

## Checks

Inputs: `$I` = `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/plan-08/inputs`; `sha256sum -c --quiet SHA256SUMS` exit 0; `sha256sum SHA256SUMS` = `9ad855343cdbf5b04dbaff9df15f70f367082a31a171b980cebd5616d1541746` (matches the plan). Plan base (`$D/plan-base`) = 17fca7ad0a642c66fd01799d08ee233390cc7449. The scripts and logs are in `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase08-plan04/` (`setup.sh`, `verify-t1.sh`, `verify-t2.sh`, `edits-check-t1.log`, `edits-check-t2.log`).

| Check | Commit | Exit | Output |
| --- | --- | --- | --- |
| Task 1 precondition: `apply-edits.mjs dry 08-04-t1.json` | 17fca7a | 0 | `EDITS DRY OK` |
| Task 1 verify 1: `apply-edits.mjs check 08-04-t1.json <base>` | 5ddb6dd | 0 | `EDITS CHECK OK` |
| Task 1 verify 2: section check (one heading, before `## Review`, nested multi-process item) | 5ddb6dd | 0 | - |
| Task 1 verify 3: scope check (only the unit test skill changed outside `.planning/`, nothing in `.planning/codebase/`, clean status) | 5ddb6dd | 0 | - |
| Task 1 acceptance: `grep -c '^## Where a test goes$'` / Peer conformance item | 5ddb6dd | - | 1 / 1; title 58 characters |
| Task 2 precondition: `apply-edits.mjs dry 08-04-t2.json` | 5ddb6dd | 0 | `EDITS DRY OK` |
| Task 2 verify 1: `apply-edits.mjs check 08-04-t2.json <base>` | b0e9ac2 | 0 | `EDITS CHECK OK` |
| Task 2 verify 2: same-words check | b0e9ac2 | 0 | `rules=9 same=true` |
| Task 2 verify 3: scope check (the two skills outside `.planning/`, only TESTING.md in `.planning/codebase/`, clean status) | b0e9ac2 | 0 | - |
| Task 2 acceptance: cucumber heading / `16 files` / dated `- 16 under test/integration/` / nested Peer conformance in TESTING.md | b0e9ac2 | - | 1 / 0 / 1 / 1; title 63 characters |
| Tracer gate: Task 1 `<verify>` rerun end to end before Task 2 | 5ddb6dd | 0 | passed, expanded |
| Commit hook (Markdown fixers, mdformat, markdownlint-cli2, texthooks, gitlint) | 5ddb6dd, b0e9ac2 | 0 | all Passed, no file changed; npm check skipped (no build input) |

At b0e9ac2, the Task 1 edits check still passes; the Task 1 scope check fails there by design, because it allows only the one file of Task 1.

## Task Commits

1. **Task 1: Write the charter into the typescript-unit-tests skill** - `5ddb6dd` (docs)
2. **Task 2: Write the same charter into the cucumber skill and TESTING.md** - `b0e9ac2` (docs)

## Deviations from Plan

None - plan executed exactly as written. The Task 1 wording read against the simple-english Plain rules found no defect. The plan base is 17fca7a, not the planner's 9aa92a1; both dry runs and both edits checks passed against it, so the insertion points are the ones the planner measured.

## Parent lines

- `CHANGELOG.md`: None (no user-visible change).
- `.planning/BACKLOG.md`: None.
- Key Decisions table: None (the charter's words are CONTEXT [Charter] and [Charter wording]).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: .agents/skills/typescript-unit-tests/SKILL.md (`## Where a test goes`)
- FOUND: .agents/skills/cucumber/SKILL.md (`## Where a test goes`)
- FOUND: .planning/codebase/TESTING.md (nested Peer conformance item)
- FOUND: 5ddb6dd, b0e9ac2 (ancestors of HEAD)
