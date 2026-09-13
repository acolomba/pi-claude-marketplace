---
phase: 260912-fp3
plan: 01
subsystem: testing
tags: [windows-ledger, disposition, broken-windows, ship-gate, shell-quoting]
status: complete

# Dependency graph
requires:
  - phase: 260912-fp0
    provides: The edge/register.ts cwd-lifetime comment correction that makes entry 20 truthfully fixed
  - phase: 260912-fp1
    provides: The install.messaging.ts and event-router.ts test-path repoints behind entries 23 and 26
  - phase: 260912-fp2
    provides: The output-catalog and TESTING.md corrections behind entries 24 and 25, plus the measurement that entry 29 was ledger-stale rather than a document defect
provides:
  - .planning/WINDOWS.md holds no open entry, so the /gsd-ship window gate stops blocking
  - Thirteen waived entries each carry the measured reason recorded for them, verbatim
  - Six entries read fixed, with entry 29 recorded as fixed by an earlier unrelated docs pass rather than by this batch
affects: [gsd-ship, windows-ledger-disposition]

actuals:
  tokens: 5737
  tasks: 3
  commits: 1
plan_head_before: beacfe7ab7ac840182337a0404a1ac78ab98fc75

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reason prose crosses into argv only as a double-quoted parameter expansion read out of derived JSON; bash does not re-scan an expansion for command substitution, so backticks and apostrophes survive byte-identical"
    - "Waive reasons are derived mechanically from the authoritative spec table and asserted equal to an independent re-parse of that same table, so a paraphrase cannot reach the ledger"
    - "The ledger's own write-time drift predicate (extractTableRegion(raw, total_count) === renderTable(entries)) is run as a read-time gate after every batch, so a desync surfaces as a failed assertion instead of as a refusal that bricks the next verb"

key-files:
  created: []
  modified:
    - .planning/WINDOWS.md

key-decisions:
  - "Entry 29 was marked fixed although this batch made no edit and no sibling made one either: commit a64d00a4 replaced the exact wording the entry quotes six days after the entry was recorded, so the ledger row was the stale artifact"
  - "Every one of the 19 dispositions went through windows waive / windows fixed; the rendered markdown table was never hand-edited, because the fenced JSON is the sole source of truth and a disagreement makes every windows verb refuse"
  - "Entry 30 was left untouched: it already reads fixed and its resolved_at is a rendered column that a hand-supplied timestamp would desync"
  - "The verbs were run one id at a time with a fail-fast loop rather than as a batch, because markWaived and markFixed both call assertOpen and a re-run exits windows_already_resolved"
  - "No new ledger entry was appended for this item: appending would re-open the ledger that the item exists to close, and this item recorded no new defect"

patterns-established:
  - "Where a spec table is the authoritative text for a field that will be stored verbatim, derive it with a parser rather than transcribing it, and pair the id with its own first column rather than with its row position -- the spec's rows were not in numeric order"
  - "Undo exactly the escapes the transport applied and no others: section B escaped one pipe for its own markdown table, and renderTable's cell() re-escapes on write, so the stored value must carry the bare character"

requirements-completed: []
---

# Quick Item 260912-fp3: Dispose Every Remaining Open Ledger Entry Summary

All 19 open entries in `.planning/WINDOWS.md` are disposed through the `windows` verbs -- six
`fixed` because their corrections landed in the sibling items, thirteen `waived` carrying the
measured reason recorded for each. The ledger now reports `open 0 / waived 13 / fixed 18 /
total 31`, so the ship window gate has nothing left to block on.

## What Was Built

**The reason text was derived, not transcribed.** `$SCRATCH/derive-reasons.mjs` reads the
disposition spec, bounds section B between its heading and the next horizontal rule, and matches
each table row for its leading integer and its reason column. It emits a flat object keyed by id
string and refuses on a duplicate id, on a residual backslash, or on any id set other than the
expected thirteen. Section B's rows run 9, 7, 8, 10, 13, 14, 15, 16, 17, 18, 1, 2, 3 -- not in
numeric order -- so pairing by row position would have waived ten entries with the wrong text.

**One escape was undone and no others.** Section B is itself a markdown table, so id 16's reason
renders its pipe as `\|`. The derivation replaces that pair with a lone pipe, because
`renderTable`'s `cell()` escapes `\` and then `|` on its own at write time. The stored reason
carries the bare character and the rendered table carries the escaped one, which is what makes
the drift comparison pass. "No reason contains a backslash" holds as an invariant and the checker
asserts it on every run.

**`$SCRATCH/ledger-check.mjs` is the gate all three tasks verified through.** It requires the
repository's own `broken-windows.cjs` and asserts, on every invocation: `parseLedger` accepts the
file (which is the frontmatter-counts cross-check, since it throws when the counts disagree with
the entries); `extractTableRegion(raw, total_count)` is non-null and byte-equal to
`renderTable(entries)` -- the same predicate `writeLedgerAtomic` enforces on write, and therefore
the early warning that the next verb would be refused; no waived entry has an empty reason; and no
waived reason contains a backslash. It then takes the four counts, the exact waived id set, the
required-fixed id set and a reasons file as flags, and compares every stored reason against the
derived text.

**Id 16 was the tracer.** Its reason is the only one carrying a raw pipe, so a single waive
exercised reason authoring, the argv crossing, `cell()`'s table escaping, the atomic write and the
read-back in one shot. It came back with the pipe bare in the JSON, escaped in the table, and the
drift gate green at `18/1/12/31`.

**The remaining eighteen went one id at a time, fail-fast.** Twelve waives (1, 2, 3, 7, 8, 9, 10,
13, 14, 15, 17, 18) then six `fixed` (20, 23, 24, 25, 26, 29). Each reason was read out of the
derived JSON with a node one-liner into a shell variable and passed as `"$REASON"`. No reason was
ever inlined into a shell literal: twelve of the thirteen carry backticks, which bash runs as
command substitution inside double quotes, and four carry an apostrophe, which terminates a
single-quoted string. A double-quoted parameter expansion is the one path that survives both,
because bash does not re-scan an expansion for command substitution.

## Final Distribution

Read from the `windows status` verb's own JSON output, not from the rendered table:

| count | value |
|---|---|
| open | 0 |
| waived | 13 |
| fixed | 18 |
| total | 31 |

The 18 `fixed` are the 12 that were already fixed before this pass plus the 6 marked here.

**Drift gate:** PASS. `extractTableRegion(raw, 31)` is byte-equal to `renderTable(entries)` of the
on-disk fenced JSON, both immediately after the dispositions and again after the pre-commit hooks
ran, so the next `windows` verb is admitted rather than refused.

**Entry 30:** untouched. Still `fixed`, `resolved_at` still `null`.

## Dispositions

### Marked `fixed` (6)

| id | file | closed by |
|---|---|---|
| 20 | `extensions/pi-claude-marketplace/edge/register.ts` | real edit, `b6f1e037` (260912-fp0) |
| 23 | `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` | real edit, `2673a589` (260912-fp1) |
| 24 | `docs/output-catalog.md` | real edit, `c10cf7f3` (260912-fp2) |
| 25 | `.planning/codebase/TESTING.md` | real edit, `beacfe7a` (260912-fp2) |
| 26 | `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` | real edit, `2673a589` (260912-fp1) |
| 29 | `.planning/codebase/CONVENTIONS.md` | **no edit -- see below** |

### Fixed with no source edit

**Entry 29 was a stale ledger row, not a stale document.** `.planning/codebase/CONVENTIONS.md`
already read correctly when 260912-fp2 checked it: commit `a64d00a4` (2026-09-09) replaced the
exact wording entry 29 quotes about an aggregate `bridges/index.ts` barrel, six days after the
entry was recorded on 2026-09-03. The entry was accurate when written and was resolved
incidentally by an unrelated documentation pass. No edit was made by 260912-fp2 and none was
warranted; the entry is nonetheless genuinely resolved, so it is marked `fixed` rather than
waived.

Entry 25 is worth one further note: the ledger **under-described** it. Two of the four modules the
row called "pre-move" had been retired outright rather than moved, and the file's "no mocking
library" claim had gone false. 260912-fp2 corrected the document to current reality rather than
performing the path swap the row described.

### Waived (13)

Each carries its section B reason byte for byte, asserted equal to an independent re-parse of the
same spec table.

| id | file | substance of the waive |
|---|---|---|
| 1 | `bridges/skills/stage.ts` | SKILL-01 backstop needs a live Pi session; outside unit-test boundary |
| 2 | `bridges/hooks/settle.ts` | stub retained deliberately; scoped to unshipped STOP-07 |
| 3 | `bridges/hooks/payloads/stop-failure.ts` | stub retained deliberately; scoped to unshipped SFAIL-03 |
| 7 | `tests/orchestrators/reconcile/backfill.test.ts` | vacuous, not unmet: the entrypoint touches no filesystem, HOME or agent dir |
| 8 | `tests/orchestrators/reconcile/pending.test.ts` | two guards reachable but behaviorally redundant; no public behavior discriminates them |
| 9 | `orchestrators/reconcile/apply.ts` | operator accepted the exposure 2026-09-02; no test can prove the loops safe (static imports, no injection seam) |
| 10 | `orchestrators/reconcile/apply.ts` | remove-before-add ordering not discriminated by any input; the two orderings that are, are pinned |
| 13 | `orchestrators/marketplace/add.ts` | WR-01: mode-discriminated overloads are unchecked assertions, confirmed by planting |
| 14 | `orchestrators/import/execute.ts` | WR-04: a headerless row is ruled out by an invariant spanning four functions, not by a type |
| 15 | `edge/handlers/marketplace/update.ts` | one branch short; usage-string collapse arm dead here, live for siblings; closes only by a rewrite |
| 16 | `edge/completions/data.ts` | compiler-forced: `Array.prototype.at()` is typed `T \| undefined`; closes only by a rewrite |
| 17 | `edge/completions/provider.ts` | structural, not compiler-forced: declared element type keeps a supplied field optional |
| 18 | `edge/handlers/plugin/import.ts` | compiler-forced: `unknown` catch binding under `useUnknownInCatchVariables`, and assertions are barred in `extensions/` |

## Key Implementation Details

- **Shell quoting was the one real hazard and it was handled by construction.** The plan measured
  the crossing during planning against a probe carrying a backtick, an apostrophe, a pipe and an
  em dash; all reached argv byte-identical through a double-quoted parameter expansion. Every
  verb invocation used that path and the read-back reason equality assertion confirms nothing was
  mangled.
- **The verbs are not idempotent.** `markWaived` and `markFixed` both call `assertOpen`, so a
  second run against a disposed id exits `windows_already_resolved`. The loops echo each id and
  stop on the first non-zero exit, so a mid-batch failure would have been resumable from the
  failing id rather than needing a blind replay. Nothing failed: 12/12 waives and 6/6 fixed
  succeeded on the first attempt.
- **Nothing outside the ledger was staged.** The working tree carries pre-existing unrelated
  modifications and untracked files belonging to the operator and the batch coordinator. Only
  `.planning/WINDOWS.md` was added, by explicit path. `git diff-tree` on `HEAD` confirms the
  commit touches that one file.

## Verification Performed

| Check | Result |
|---|---|
| `windows status` open_count | 0 (read from the verb's JSON, not the table) |
| Distribution | open 0 / waived 13 / fixed 18 / total 31 |
| Waived id set | exactly 1, 2, 3, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18 |
| Every waived reason vs derived spec text | byte-equal |
| Derived reasons vs independent re-parse of spec section B | 13/13 match, no backslashes, id 16's pipe bare |
| Required-fixed ids 20, 23, 24, 25, 26, 29 | all read `fixed` |
| Entry 30 | `fixed`, `resolved_at` null, unmutated |
| `parseLedger` | accepts (frontmatter counts agree with entries) |
| Drift gate `extractTableRegion === renderTable` | PASS, before and after the hooks |
| `pre-commit run --files .planning/WINDOWS.md` | clean; `trailing-whitespace`, `end-of-file-fixer`, `fix-spaces`, `forbid-bidi-controls`, `check-merge-conflict` all Passed with no rewrite |
| `git status` residue after commit | none |
| `HEAD` file set | `.planning/WINDOWS.md` only |
| Commit subject | Conventional Commits, 56 chars, names no planning artifact |

`trufflehog` was skipped (`SKIP=trufflehog`) for both the hook run and the commit, as CLAUDE.md
requires when committing from inside a linked worktree -- this checkout's `.git` is a file.
`npm-format-check` reported "no files to check" and did not fire, so the known
`BATCH.json` environment issue never arose. `npm run check` was deliberately not run; the batch
coordinator runs it once after this item.

## Deviations from Plan

None. The plan executed exactly as written: the derivation produced 13 reasons matching section B,
the tracer on id 16 passed on the first attempt, all 18 remaining verbs succeeded fail-fast, and
the pre-commit hooks made no rewrite.

## Commits

| Commit | Subject | Files |
|---|---|---|
| `408ae717` | `docs(windows): dispose every remaining open ledger entry` | `.planning/WINDOWS.md` |

## Known Stubs

None. This item recorded verdicts and edited no source, so it introduced no stub, no skipped test
and no unrun verification. No new entry was appended to `.planning/WINDOWS.md`: an append would
re-open the ledger this item exists to close.

## Self-Check: PASSED

- `.planning/WINDOWS.md` exists and parses; `open_count` is 0.
- `.planning/quick/260912-fp3-dispose-every-remaining-open-entry-in-th/260912-fp3-SUMMARY.md` exists.
- Commit `408ae717` exists in `features/refine-unit-tests` and touches only the ledger.
