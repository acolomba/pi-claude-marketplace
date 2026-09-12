---
phase: 260912-fp1
plan: 01
subsystem: testing
tags: [typescript, comments, traceability, windows-ledger, wr-05, surf-01]
status: complete

# Dependency graph
requires:
  - phase: 09-final-quality-and-backlog-closure
    provides: WINDOWS.md ledger entries 23 and 26 naming the two stale test-path citations
provides:
  - The isHooksResolverNote parity citation resolves in git ls-files
  - The SessionStart ensureSharedDataDir gate cites the live WR-05 clean-reconcile assertion
  - Evidence for sibling item 260912-fp3 to dispose WINDOWS entries 23 and 26 as fixed
affects: [260912-fp3, windows-ledger-disposition]

actuals:
  tokens: 582
  tasks: 3
  commits: 1
plan_head_before: b6f1e037

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A comment citing a test carries a phrase from that test's own title, so the citation stays greppable if the suite relocates again"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts

key-decisions:
  - "Entry 26 was repointed, not retracted: the WR-05 clean-reconcile invariant is alive and green in tests/index.test.ts, only its old pin file was deleted"
  - "The WR-05 token stays on its original line untouched; the reflow is confined to the lines after it"
  - "The reflowed comment carries `both scope roots untouched` verbatim from the surviving test title as a grep handle"

patterns-established:
  - "Comment repoints are gated by a comment-only diff filter (zero changed non-comment lines) so a prose edit cannot smuggle a behavior change"

requirements-completed: []
---

# Quick Item 260912-fp1: Repoint Two Stale Test Path References Summary

Repointed two production comments that cited test files which had moved or been deleted, with a
comment-only diff that leaves executable behavior byte-unchanged.

## Accomplishments

- **Both ledger entries were closed by a real source edit, not found stale.** Entries 23 and 26
  each named a genuine defect: the cited path was absent from `git ls-files` in both cases,
  confirmed before editing.
- **Entry 23 — `install.messaging.ts`.** The `isHooksResolverNote` JSDoc cited
  `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`. The suite now lives at
  `tests/architecture/cross-surface-reason-parity.test.ts`, so only the directory segment
  changed — a one-line, one-substring edit. The unrelated and accurate
  `orchestrators/import/execute.ts` citation elsewhere in the file was not touched.
- **Entry 26 — `event-router.ts`.** The `D-60-06` block above the SessionStart
  `ensureSharedDataDir` gate cited `tests/edge/index-handler.test.ts`, which was deleted. The
  invariant it pinned survives, so the citation was repointed at `tests/index.test.ts` and the
  block's tail was reflowed to absorb the length change. The new text names the assertion in
  substance: a pristine workspace reconcile leaves both scope roots untouched and emits nothing.
- **Traceability anchors all survive.** `SURF-01`, `HOOK-03`, `LIFE-01` in
  `install.messaging.ts`; `WR-05` (still exactly once, still on its original line) and
  `D-60-06` (still twice) in `event-router.ts`. No planning reference was introduced in either
  file.

## Task Commits

| Task | Name                                        | Commit    |
| ---- | ------------------------------------------- | --------- |
| 1-3  | Both comment repoints, gated and committed  | `2673a589` |

Tasks 1 and 2 were committed together as Task 3 prescribed: they are one change, repointing
citations at moved and deleted test files.

## Gate Readings (measured)

| Gate | Reading |
| ---- | ------- |
| Cited `tests/` paths resolve in `git ls-files` | PASS (`tests/architecture/cross-surface-reason-parity.test.ts`, `tests/index.test.ts`) — RED at HEAD before the edits |
| Committed non-comment lines changed | **0** across both files |
| `node --test tests/architecture/cross-surface-reason-parity.test.ts` | 17 pass / 0 fail |
| `node --test --test-name-pattern "pristine workspace reconciles" tests/index.test.ts` | 1 pass / 0 fail |
| `npx prettier --check` both files | formatted |
| `tests/` citation count per file | 1 each, unchanged |
| `SessionStart` token count | 23 file-wide, 3 in-block, unchanged |
| Max comment line length in the reflowed block | 75 columns |
| Commit subject | Conventional Commits, 61 chars; 0 body lines over 80; no planning reference |
| `.planning/WINDOWS.md` | unmodified |

## Deviations from Plan

None. The plan was executed exactly as written.

## Pre-commit Notes

`pre-commit run --files` over both paths passed every hook that can run here, including
`npm-lint`, `npm-typecheck`, `npm-fallow`, and `npm-coverage-direct` (changed pairs). Two hooks
were skipped for sanctioned, pre-existing reasons, both named in the item constraints:

- `trufflehog` — cannot run in this linked worktree (`.git` is a file, so
  `<root>/.git/index` does not exist). CLAUDE.md sanctions `SKIP=trufflehog` for worktree
  commits.
- `npm-format-check` — `pass_filenames: false`, so it runs prettier repo-wide and warns on the
  coordinator-owned untracked file `.planning/quick-batches/260912-foz/BATCH.json`. That was the
  sole reported failure; `BATCH.json` was not written or reformatted. Both touched files pass
  prettier individually.

`gitlint` was run against the commit message before committing and passed. The commit itself was
prefixed `SKIP=trufflehog,npm-format-check`. The working tree is clean for both files after the
commit — no hook rewrote a file, so no follow-up commit was needed.

`npm run check` was deliberately not run; the batch coordinator runs the suite once after every
item lands.

## Known Stubs

None.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` — FOUND
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` — FOUND
- Commit `2673a589` — FOUND in `git log`
