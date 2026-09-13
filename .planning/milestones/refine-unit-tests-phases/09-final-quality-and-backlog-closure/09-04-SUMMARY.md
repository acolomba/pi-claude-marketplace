---
phase: 09-final-quality-and-backlog-closure
plan: 04
subsystem: planning
tags: [window-ledger, closure, fail-closed-gate, record-integrity, terminal-evidence]

# Dependency graph
requires:
  - phase: 08-direct-coverage
    provides: "08-02's rewrite of the three dense-index guards to typed iteration — the production change entries 19, 21 and 22 each named as their sole closure condition"
  - phase: 09-final-quality-and-backlog-closure
    provides: "09-03's requirement seal, which moved RCOV-02 to `Complete` and is the record that the rewrite landed"
provides:
  - "A window ledger whose rendered table and fenced JSON agree on every field of all 31 entries — zero mismatches, measured"
  - "Unblocked `windows` write verbs: the table-drift guard and the frontmatter-counts check both pass, proven by three verb runs at exit 0"
  - "`open_count` 23 → 19, with entries 19, 21 and 22 closed on terminal evidence read from the production source, not from narrative"
  - "Entry 9's `DECIDED 2026-09-02` resolution prose preserved inside the JSON, where regeneration cannot destroy it"
affects: [09-05 backlog dispositions, 09-06 closure ledger, /gsd-ship windows gate]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate`.
actuals:
  tokens: 5488
  tasks: 2
  commits: 2
plan_head_before: 2aae7e024e9f590ab5bf75a145a0fe400cc7c8be

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "When one representation of a record is generated from another, the authoritative prose is copied INTO the source of truth before any regeneration runs — the generator then overwrites a byte-identical copy of what was saved"
    - "A record is closed against the current production source, read directly, rather than against the requirement prose that claims the source changed"

key-files:
  created:
    - .planning/phases/09-final-quality-and-backlog-closure/09-04-SUMMARY.md
  modified:
    - .planning/WINDOWS.md

key-decisions:
  - "Entry 30's `resolved_at` was left `null`, against the plan's explicit instruction to populate it. `resolved_at` is a RENDERED table column, so writing a timestamp the table's cell does not carry re-creates the very drift the repair exists to clear — measured both ways against a scratch copy (populated → exit 1 naming row 30; null → exit 0)."
  - "The table's authoritative text was extracted programmatically from the rendered row and written into the JSON as an exact string, never retyped, so the copy is verbatim by construction rather than by proofreading"
  - "Entries 19, 21 and 22 were closed only after reading the three production files and confirming no guard they name survives — RCOV-02's prose was treated as a pointer to evidence, not as the evidence"
  - "Nothing beyond 19, 21 and 22 was closed. The 19 remaining open entries keep their terminal-evidence requirement, per D-09-13 and D-22."

patterns-established:
  - "Before hand-editing a tool-owned file, reproduce the tool's own guard against a scratch copy — a research claim that an edit 'passes the gate' is a claim about the guard's implementation and is cheap to falsify"
  - "Verify a generated/source pair field-by-field across every record, not only the records believed to differ; the mismatch count is the proof, and zero is the only passing value"

requirements-completed: []

coverage:
  - id: D1
    description: "The rows 9 and 30 desync is repaired losslessly — the rendered table's authoritative resolution prose now lives inside the fenced JSON, where regeneration cannot destroy it"
    requirement: CLOSE-02
    verification:
      - kind: other
        ref: "field-by-field comparison of all 31 table rows against all 31 JSON entries across all 10 fields -> MISMATCH_COUNT=0"
        status: pass
      - kind: other
        ref: "entry 9 description tail now `...Resolution recorded in 115-VERIFICATION.md human_verification item 2.`; entry 30 description tail now `...blocks nothing.`"
        status: pass
      - kind: other
        ref: "git diff of the Task 1 commit touches only frontmatter lines 3/5 and JSON lines 154/406-407 — zero rendered-table lines (`git diff | grep -c '^[+-]| [0-9]* | '` -> 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The ledger's write verbs are unblocked — both the table-drift guard and the frontmatter-counts check pass"
    requirement: CLOSE-02
    verification:
      - kind: other
        ref: "`node .claude/gsd-core/bin/gsd-tools.cjs windows fixed 19 | 21 | 22` -> exit 0, exit 0, exit 0"
        status: pass
      - kind: other
        ref: "pre-repair reproduction against a scratch copy -> exit 1, `Ledger table ... disagrees with the fenced JSON entries ... for row id(s): 30`"
        status: pass
    human_judgment: false
  - id: D3
    description: "Entries 19, 21 and 22 are closed through the verb that owns the file, on terminal evidence read from the production source"
    requirement: CLOSE-02
    verification:
      - kind: other
        ref: "extensions/pi-claude-marketplace/edge/args.ts -> `for (const [index, token] of tokens.entries())`; no index-read guard at 34-37"
        status: pass
      - kind: other
        ref: "extensions/pi-claude-marketplace/edge/handlers/shared.ts -> `for (const tok of tokens)`; no flag-scanner index guard at 53-55"
        status: pass
      - kind: other
        ref: "extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts -> `const [first] = parsed.positional; if (first !== undefined)`; no nullish fallback"
        status: pass
      - kind: other
        ref: "`windows status` -> open_count 19, fixed_count 12, waived_count 0, total_count 31"
        status: pass
    human_judgment: false
  - id: D4
    description: "Entry 9 stayed `open` and nothing outside the sanctioned set changed status"
    requirement: CLOSE-02
    verification:
      - kind: other
        ref: "entry 9 after both commits -> `status: open`, `resolved_at: null`; only its description changed"
        status: pass
      - kind: other
        ref: "status diff across the whole plan (plan_head_before..HEAD) -> exactly {19, 21, 22, 30} changed; 30 is the sanctioned desync repair (its table cell already read `fixed`)"
        status: pass
    human_judgment: false

# Metrics
duration: 9 min
completed: 2026-09-11
status: complete
---

# Phase 9 Plan 04: The Window Ledger Repair Summary

**The ledger's two representations now agree on every field of all 31 entries, its write verbs run again, and the three entries whose named production rewrite had already landed are closed — leaving 19 open, phase 116 still the largest group at 5.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-11T21:31Z
- **Completed:** 2026-09-11T21:40Z
- **Tasks:** 2 of 2
- **Files modified:** 1 (plus this SUMMARY)

## Accomplishments

- **The rows 9 and 30 desync is repaired losslessly (`f0fa6adb`).** The rendered table carried
  resolution prose the fenced JSON did not, and the JSON is the sole source of truth from which the
  table is regenerated — so a bare regeneration would have destroyed it. Both descriptions were
  extracted from the rendered rows **programmatically** and written into the JSON as exact strings,
  so the copy is verbatim by construction. The measured delta matched the research exactly: entry 9
  was a final-sentence replacement (`This needs an operator decision.` → the `DECIDED 2026-09-02`
  paragraph, 2326 → 2750 chars), entry 30 a pure append (1198 → 1566 chars) plus `open` → `fixed`.
- **The second fail-closed check was satisfied in the same edit.** Moving entry 30 out of `open`
  makes the frontmatter disagree with the entries, and `parseLedger` refuses on exactly that, so
  `open_count: 23` → `22` and `fixed_count: 8` → `9` were hand-written alongside the status flip.
- **Entries 19, 21 and 22 closed through the verb (`3ef41e24`).** Each said it "closes only by a
  production rewrite"; each rewrite has landed. Verified by reading the three production files
  rather than by trusting the requirement prose that claims it.
- **Zero mismatches, measured.** A field-by-field comparison of all 31 rendered rows against all 31
  JSON entries across all ten fields reports `MISMATCH_COUNT=0`.

## The three closures, and the evidence for each

Each entry's own text names the guard it calls unreachable. None of the three survives:

| id | file | what the entry claimed | what the source reads now |
|----|------|------------------------|---------------------------|
| 19 | `edge/handlers/plugin/pending.ts` | nullish-fallback arm on the first positional | `const [first] = parsed.positional; if (first !== undefined)` — destructured, no fallback |
| 21 | `edge/args.ts` | index-read guard at 34-37 | `for (const [index, token] of tokens.entries())` — typed iteration |
| 22 | `edge/handlers/shared.ts` | flag-scanner guard at 53-55 | `for (const tok of tokens)` — typed iteration |

This is what `RCOV-02` records as "honestly rewritten to typed iteration." The requirement prose was
treated as a pointer to the evidence, not as the evidence itself — closing on narrative is the
defect class `D-22` bars.

## Post-closure open distribution by phase

19 entries remain open. **Phase 116 is still the largest remaining group**, at 5:

| phase | open ids | count |
|-------|----------|------:|
| 86 | 1 | 1 |
| 88 | 2, 3 | 2 |
| 115 | 7, 8, 9, 10, 13, 14 | 6 |
| **116** | **15, 16, 17, 18, 20** | **5** |
| 117 | 23, 24, 25, 26, 29 | 5 |

Entry 9 is deliberately among them. Its own repaired text says it stays `open` "as the durable
record of the residual risk rather than as a pending action" (D-09-12b), so only its description
moved. Whether open windows should block `/gsd-ship` stays the operator's call at ship time.

## Deviations from Plan

### 1. [Rule 3 - Blocker] Entry 30's `resolved_at` left `null` — populating it re-creates the drift

- **Found during:** Task 1, at the field-by-field verification step
- **Issue:** The plan's Edit 3 instructs setting entry 30's `resolved_at` to
  `2026-09-04T01:03:42.619Z`, and one acceptance criterion and one `<verify>` command require it.
  The stated rationale rests on 09-RESEARCH.md §4.4's claim that "either passes the gate." **That
  claim is inverted.** `resolved_at` is a column `renderTable` emits, and the drift guard compares
  `renderTable(<on-disk JSON>)` byte-for-byte against the on-disk table. The table's row 30 carries
  an EMPTY `resolved_at` cell, so writing a timestamp into the JSON makes the two disagree on a
  rendered field and re-creates the drift the repair exists to clear.
- **Measured both ways, against a scratch copy, with the real ledger untouched:**
  - `resolved_at` populated → `windows fixed 19` exits **1**: `Ledger table ... disagrees with the
    fenced JSON entries (the sole source of truth) for row id(s): 30.`
  - `resolved_at: null` → `windows fixed 19` exits **0** (open 21, fixed 10).
- **Why no other route exists.** The table may not be hand-edited (plan prohibition, and it is the
  behaviour the guard exists to catch), so the JSON must be made to match the table exactly —
  `fixed` with an empty `resolved_at`. Nor can the verb stamp it later: `markFixed` calls
  `assertOpen`, so `windows fixed 30` refuses an already-`fixed` entry. Populating the field is
  therefore impossible without either leaving the ledger permanently unwritable or violating the
  prohibition.
- **Fix:** reverted that one field to `null`; all other edits stand.
- **Residual, stated plainly:** entry 30 is the only `fixed` entry in the file whose `resolved_at`
  is null. The loss is smaller than the plan's rationale implies — the plan argued a null would
  "make the closed row the only one in the file that cannot say when it closed," but the row's own
  description opens its final paragraph with `RESOLVED 2026-09-04 by operator decision:`, so the
  file does record when it closed, in prose rather than in the field.
- **Files modified:** `.planning/WINDOWS.md`
- **Commit:** `f0fa6adb`

**Total deviations:** 1 auto-fixed (1 × Rule 3 blocker). **Impact:** one acceptance criterion and
one `<verify>` command in Task 1 are unsatisfiable as written and were not satisfied; every other
criterion in both tasks passes. The plan's own success criteria — table and JSON agree, write verbs
unblocked, exactly three entries closed, entry 9 untouched — are all met.

## Verification

Plan-level `<verification>`, run after both commits:

- `windows status` → `open_count: 19`, `waived_count: 0`, `fixed_count: 12`, `total_count: 31` — exit 0
- field-by-field table-vs-JSON comparison across all 31 entries → `MISMATCH_COUNT=0`
- `git log --stat -- .planning/WINDOWS.md` → exactly two commits from this plan (`f0fa6adb`, `3ef41e24`)

Task-level `<verify>` results:

| command | expected | actual |
|---------|----------|--------|
| `windows status` open_count (Task 1) | 22 | 22 ✅ |
| `grep -c '"status": "open"'` (Task 1) | 22 | 22 ✅ |
| `grep -c '"resolved_at": "2026-09-04T01:03:42.619Z"'` (Task 1) | ≥1 | **0 — see Deviation 1** ❌ |
| `windows status` open_count (Task 2) | 19 | 19 ✅ |
| `grep -c '"status": "open"'` (Task 2) | 19 | 19 ✅ |
| `windows status` fixed_count (Task 2) | 12 | 12 ✅ |

## Note for 09-06

`.planning/WINDOWS.md` is **not** read by anything `npm run check` runs — a grep for `WINDOWS.md`
across `tests/`, `scripts/`, `extensions/`, `eslint.config.js`, `.fallowrc.json` and `package.json`
returns nothing. 09-03's measurement (exit 0 in 249s at `da08a749`) therefore stands; this plan does
not oblige a retake.

## Issues Encountered

None beyond Deviation 1, which is recorded above with its measurement rather than carried forward.

## Next

Ready for `09-05` — the backlog terminal dispositions.

## Self-Check: PASSED

- `.planning/phases/09-final-quality-and-backlog-closure/09-04-SUMMARY.md` — FOUND
- `.planning/WINDOWS.md` — FOUND
- commit `f0fa6adb` — FOUND
- commit `3ef41e24` — FOUND
- all `<acceptance_criteria>` re-run; one Task 1 criterion fails as documented in Deviation 1, all others pass
