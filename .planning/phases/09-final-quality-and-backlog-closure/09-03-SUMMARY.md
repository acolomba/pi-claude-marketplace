---
phase: 09-final-quality-and-backlog-closure
plan: 03
subsystem: testing
tags: [requirements-seal, revalidation, fail-closed-gate, planning-contract, node-test]

# Dependency graph
requires:
  - phase: 09-final-quality-and-backlog-closure
    provides: "09-01's injected hooks read port — the last production change on this tree, without which the suite measurement below would describe a tree nobody ships"
  - phase: 09-final-quality-and-backlog-closure
    provides: "09-02's re-measured coverage surface — 230 pairs, strict arm exit 0, pin byte-identical — the evidence RCOV-01/RCOV-02 cite"
  - phase: 08-direct-coverage
    provides: "08-09's planting proof that a single-ID flip exits 1, which is why each ID's carriers move as one commit"
provides:
  - "All eight sealed requirement IDs at `Complete` in every carrier: GGAT-01, GGAT-03, GGAT-04, RCOV-01, RCOV-02, RCOV-03, CLOSE-01, CLOSE-02"
  - "Zero `Pending` requirement status left in either enforced surface — `.planning/REQUIREMENTS.md` and `SEALED_REQUIREMENT_ROUTES`"
  - "A verbatim `npm run check` measurement taken on the committed change-A tree (da08a749), the evidence that licensed CLOSE-01's flip"
  - "Two planted literals in `tests/architecture/revalidation.test.ts` updated in the same commit as the flip that invalidated each, so neither case plants a no-op"
affects: [09-04 window ledger, 09-05 backlog dispositions, 09-06 closure ledger, phase verification]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate`.
actuals:
  tokens: 5100
  tasks: 3
  commits: 2
plan_head_before: 5bc0e71f8c62b266137fccc293a11060f0c82d1f

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A fail-closed contract flip lands as one commit per internally-consistent ID set, with every carrier — including the test literals the flip invalidates — moving inside that commit"
    - "A claim about a tree is measured on that tree before the claim is written down: the assertion and the work it asserts over never share a commit"

key-files:
  created:
    - .planning/phases/09-final-quality-and-backlog-closure/09-03-SUMMARY.md
  modified:
    - .planning/REQUIREMENTS.md
    - scripts/revalidation.mjs
    - tests/architecture/revalidation.test.ts

key-decisions:
  - "No clause signature was recomputed and `01-REVALIDATION.json` was not opened: a status flip leaves every clause hash intact, proven again here by the ledger blob coming back at `66218013acf1a69bd28b2380fdcf0c531556dff0` after both commits"
  - "`gsd-tools requirements mark-complete` was not used: it writes the checkbox and the traceability row, knows nothing of `SEALED_REQUIREMENT_ROUTES`, and would have reported success over a red gate"
  - "Two plan-supplied grep literals are wrong about this tree and were replaced with corrected ones rather than treated as findings — the off-by-one CLOSE row padding, and the over-broad bare `Pending` scan that matches the checker's own status vocabulary"
  - "Task 2's clean-tree precondition was read over the surface `npm run check` measures, not over the whole checkout, because the checkout carries pre-existing session-external residue this plan may not touch"

patterns-established:
  - "Before editing a hand-maintained markdown table, assert column width by measuring every row's character length and requiring a single distinct value — cheaper and more reliable than counting spaces"
  - "A planted-literal test that copies a live file is itself a carrier of that file's contract; grep the test for every ID being changed before committing, not after the suite goes red"

requirements-completed: [CLOSE-01, CLOSE-02]

coverage:
  - id: D1
    description: "Seal change A moved GGAT-01, GGAT-03, GGAT-04, RCOV-01, RCOV-02 and RCOV-03 to `Complete` across all four carriers in one commit"
    requirement: CLOSE-01
    verification:
      - kind: other
        ref: "node scripts/revalidation.mjs scope-impact --check -> `Scope impact valid: 40 records.`, exit 0"
        status: pass
      - kind: unit
        ref: "node --test tests/architecture/revalidation.test.ts -> tests 136, pass 136, fail 0"
        status: pass
      - kind: other
        ref: "grep -c over the six IDs -> 6 checked clauses, 6 `Complete` traceability rows, 6 `Complete` sealed routes, 0 unchecked"
        status: pass
    human_judgment: false
  - id: D2
    description: "The complete project quality suite was measured green on the committed change-A tree before any CLOSE claim was written"
    requirement: CLOSE-01
    verification:
      - kind: other
        ref: "npm run check at da08a749 -> exit 0 in 249s; unit `tests 6007 / pass 6007 / fail 0 / skipped 0`; integration `tests 32 / pass 32 / fail 0`"
        status: pass
    human_judgment: false
  - id: D3
    description: "Seal change B moved CLOSE-01 and CLOSE-02 to `Complete`, leaving no `Pending` requirement status in either enforced surface"
    requirement: CLOSE-02
    verification:
      - kind: other
        ref: "node scripts/revalidation.mjs scope-impact --check -> `Scope impact valid: 40 records.`, exit 0"
        status: pass
      - kind: unit
        ref: "node --test tests/architecture/revalidation.test.ts -> tests 136, pass 136, fail 0"
        status: pass
      - kind: other
        ref: "grep -c '^- \\[ \\] \\*\\*' .planning/REQUIREMENTS.md -> 0; grep -c 'Pending' .planning/REQUIREMENTS.md -> 0; grep -c 'status: \"Pending\"' scripts/revalidation.mjs -> 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both invalidated planted literals were updated inside the commit that invalidated them, so each case still plants a real violation"
    requirement: CLOSE-01
    verification:
      - kind: unit
        ref: "tests/architecture/revalidation.test.ts#RVAL-04 scope-impact rejects an evidence ID with an active definition (marker now `- [x] **GGAT-03**:`)"
        status: pass
      - kind: unit
        ref: "tests/architecture/revalidation.test.ts#RVAL-04 scope-impact ignores content after a four-space fence pseudo-closer (row literal now `| CLOSE-02 | Phase 9 | Complete |`)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The scope-change ledger was not touched — no clause signature was recomputed for a pure status flip"
    requirement: CLOSE-01
    verification:
      - kind: other
        ref: "git hash-object .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json -> 66218013acf1a69bd28b2380fdcf0c531556dff0, unchanged after both commits"
        status: pass
    human_judgment: false

# Metrics
duration: 25 min
completed: 2026-09-11
status: complete
---

# Phase 9 Plan 03: The Requirement Seal Flip Summary

**Eight sealed requirement IDs moved from `Pending` to `Complete` in two commits, with the complete quality suite measured green on the tree in between — so `CLOSE-01`'s claim was true before it was written.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-11T21:03Z
- **Completed:** 2026-09-11T21:28Z
- **Tasks:** 3 of 3
- **Files modified:** 3 (plus this SUMMARY)

## Accomplishments

- **Seal change A (`da08a749`)** moved `GGAT-01`, `GGAT-03`, `GGAT-04`, `RCOV-01`, `RCOV-02` and
  `RCOV-03` across all four carriers in one commit: the `- [ ]` → `- [x]` checkbox, the
  `## Traceability` status cell, the `SEALED_REQUIREMENT_ROUTES` entry, and the one planted literal
  in `tests/architecture/revalidation.test.ts` the flip invalidated.
- **The complete quality suite was measured on the committed change-A tree**, exit 0, and its real
  output is quoted below. That measurement — not an inherited one — is what licensed change B.
- **Seal change B (`d391d058`)** moved `CLOSE-01` and `CLOSE-02` the same way. No requirement clause
  in `.planning/REQUIREMENTS.md` still reads unchecked, and no `Pending` status remains in either
  enforced surface.
- **The scope-change ledger was never opened.** `01-REVALIDATION.json` carries the same blob it
  carried on entry, which is the measured confirmation that a status flip leaves clause signatures
  alone (D-09-03, corrected).

## Task 2: the measurement, verbatim

Taken on the committed change-A tree. Commit `da08a749a22c78b7da21e34915496700cea22c02`, dated
2026-09-11, carrying change A and **not** change B — `CLOSE-01` and `CLOSE-02` still read `Pending`
in all three of their carriers at the moment of the run, confirmed by grep immediately before it.

```
$ npm run check
> pi-claude-marketplace@0.18.1 check
> npm run typecheck && npm run lint && npm run fallow && npm run format:check && npm run test:corresponding && npm run test:corresponding:negative && npm run test:coverage:direct:negative && npm test && npm run test:integration
```

Final exit status: **0**. Wall clock: **249s** (measured 2026-09-11T21:17:25Z → 21:21:34Z).

Unit suite (`npm test`, `node --test` over the ten suite directories plus `tests/index.test.ts`):

```
ℹ tests 6007
ℹ suites 301
ℹ pass 6007
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 33945.474719
```

Integration suite (`npm run test:integration`):

```
ℹ tests 32
ℹ suites 0
ℹ pass 32
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10544.316836
```

The intermediate gates in the chain, verbatim:

```
Checking formatting...
All matched files use Prettier code style!

Corresponding-test gate passed.
Corresponding-test negative controls passed.
Direct-coverage negative controls passed.
1 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly.
```

`typecheck`, `lint` and `fallow` each exited 0 with no issue rows; the fallow `dupes` line reports
the standing `✗ 915 lines (1.1%) duplicated across 38 files (0.15s)` informational count, which is
below the configured threshold and does not fail the run — the chain continued past it to
`format:check`.

This run replaces every earlier suite reading in this phase. It is not carried over from 09-01,
09-02, or any phase-8 artifact.

## Gate results, per change

| After | `scope-impact --check` | `revalidation.test.ts` | `01-REVALIDATION.json` blob |
| --- | --- | --- | --- |
| baseline (pre-edit) | `Scope impact valid: 40 records.` exit 0 | tests 136 / pass 136 / fail 0 | `66218013…` |
| change A (`da08a749`) | `Scope impact valid: 40 records.` exit 0 | tests 136 / pass 136 / fail 0 | `66218013…` |
| change B (`d391d058`) | `Scope impact valid: 40 records.` exit 0 | tests 136 / pass 136 / fail 0 | `66218013…` |

`SKIP=trufflehog pre-commit run --files .planning/REQUIREMENTS.md scripts/revalidation.mjs tests/architecture/revalidation.test.ts`
passed clean before each commit, first try both times — `npm lint`, `npm format check`,
`npm typecheck`, `npm fallow` and `npm direct coverage (changed pairs)` all `Passed`, TruffleHog
`Skipped` as this checkout is a linked worktree.

## The four carriers, end state

| ID | Checkbox | Traceability row | `SEALED_REQUIREMENT_ROUTES` | Commit |
| --- | --- | --- | --- | --- |
| GGAT-01 | `- [x]` | `Phase 7` / `Complete` | `Phase 7` / `Complete` | `da08a749` |
| GGAT-03 | `- [x]` | `Phase 7` / `Complete` | `Phase 7` / `Complete` | `da08a749` |
| GGAT-04 | `- [x]` | `Phase 7` / `Complete` | `Phase 7` / `Complete` | `da08a749` |
| RCOV-01 | `- [x]` | `Phase 8` / `Complete` | `Phase 8` / `Complete` | `da08a749` |
| RCOV-02 | `- [x]` | `Phase 8` / `Complete` | `Phase 8` / `Complete` | `da08a749` |
| RCOV-03 | `- [x]` | `Phase 8` / `Complete` | `Phase 8` / `Complete` | `da08a749` |
| CLOSE-01 | `- [x]` | `Phase 9` / `Complete` | `Phase 9` / `Complete` | `d391d058` |
| CLOSE-02 | `- [x]` | `Phase 9` / `Complete` | `Phase 9` / `Complete` | `d391d058` |

Every `route` value is untouched; only `status` moved, which is why roadmap phase membership is
unaffected and `validatePhaseRequirements` stayed quiet through both commits.

Column widths in the hand-maintained `## Traceability` table were preserved by construction: the
`Pending` + 7 spaces cell became `Complete` + 6 spaces, and every one of the 34 table lines from 161
to 194 measures 69 characters both before and after — checked by
`sed -n '161,194p' … | awk '{print length}' | sort -u` returning a single value.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] Task 1's `CLOSE-0[12]` verify literal has one space too many**

- **Found during:** Task 1 acceptance verification
- **Issue:** The plan's check
  `grep -c 'CLOSE-0[12]     | Phase 9                             | Pending       |' .planning/REQUIREMENTS.md`
  expects `2` but printed `0`. The literal carries five spaces after the ID; the file's rows carry
  four (`| CLOSE-01    | …`), because the ID column is eleven characters wide and `CLOSE-01` is
  eight. The plan's literal is off by one, not the file.
- **Fix:** Re-ran the check with the corrected four-space literal, which printed `2`, and
  independently confirmed the substance the criterion is reaching for — that change A left both
  CLOSE IDs untouched — on all three of their carriers: `grep -c '^- \[ \] \*\*CLOSE-0[12]\*\*:'`
  → `2`, and `grep -c '"CLOSE-0[12]": Object.freeze({ route: "Phase 9", status: "Pending" })'` →
  `2`.
- **Files modified:** none — the tree was correct; the check was wrong.
- **Commit:** n/a

**2. [Rule 1 — Bug] The plan-level `grep -c 'Pending' scripts/revalidation.mjs` cannot reach 0**

- **Found during:** plan-level verification after Task 3
- **Issue:** The plan asserts this prints `0` for both files. `.planning/REQUIREMENTS.md` does print
  `0`. `scripts/revalidation.mjs` prints `4`, and all four hits are structural rather than status
  data: line 55 `const ACTIVE_REQUIREMENT_STATUSES = new Set(["Complete", "Pending"])` is the
  checker's own accepted-status vocabulary, and lines 970, 1278 and 1569 are the unrelated
  `allowPendingDecisions` flag. Driving that count to `0` would mean deleting the vocabulary the
  gate validates against — it would break the gate, not satisfy it.
- **Fix:** Used Task 3's own narrower acceptance literal, `grep -c 'status: "Pending"'`, which
  prints `0` — the real statement of "no `Pending` requirement status remains in the enforced
  surface."
- **Files modified:** none.
- **Commit:** n/a

### Precondition read narrowly, and why

Task 2's precondition and acceptance both require `git status --porcelain` to print nothing. The
whole-checkout reading is non-empty and was so at dispatch, before this plan touched anything:
modified `.claude/settings.json` and `.codex/config.toml`, and untracked `.claude/CLAUDE.md`,
`.codegraph/`, `.mcp.json`, `AGENTS.md`, and ten `.planning/phases/**` review and verification files
from phases 01 and 08. None of it belongs to this plan, and the scope boundary forbids cleaning up
somebody else's working state.

The reading that makes the measurement valid is over the surface `npm run check` actually reads, and
that one is empty — before the run and again after it:

```
$ git status --porcelain extensions tests scripts package.json package-lock.json .planning/REQUIREMENTS.md .planning/ROADMAP.md
(no output)
```

So the suite measured a committed tree whose every measured byte is the byte at `da08a749`. This is
the same reading 09-02 recorded for the same reason and by the same argument.

**Total deviations:** 2 auto-fixed (2 × Rule 1, both plan-literal defects rather than tree defects),
plus 1 precondition narrowed with its justification recorded. **Impact:** none on the delivered
contract. No acceptance criterion's substance went unverified; two were verified through corrected
literals and the correction is written down here so the next reader does not re-derive it.

## Issues Encountered

None. Both seal changes passed their gate, their control suite and pre-commit on the first attempt.

## Requirements

`CLOSE-01` and `CLOSE-02` are declared by this plan and also by 09-01, 09-02, 09-04, 09-05 and
09-06. `requirements.ready-ids` reports `0/2 requirement(s) ready to mark complete`, because 09-04,
09-05 and 09-06 have no SUMMARY yet — so `gsd-tools requirements mark-complete` was **not** run, and
would in any case have been the wrong instrument here (it writes two of the three surfaces and
leaves the route contract red).

The flip nonetheless landed, because `D-09-01` and `D-09-02` direct it to: the seal is a
milestone-level contract that must be internally consistent as a single change, and the eight IDs
are pinned rather than unfinished — `07-VERIFICATION.md` reads `passed` 7/7 with all three `GGAT`
rows `SATISFIED`, and `08-VERIFICATION.md` reads `passed` 8/8. Stated plainly so nobody has to infer
it: the remaining phase-9 plans (09-04 window ledger, 09-05 backlog dispositions, 09-06 closure
ledger) are bookkeeping over work that is already done, and `CLOSE-02`'s clause is about records
carrying honest dispositions. **If any of them turns up work that changes the tree, `CLOSE-01`'s
claim becomes a statement about a tree that no longer exists and the suite must be re-measured.**
That is the one condition under which this plan's central assertion would need revisiting.

## Next Phase Readiness

- **09-04 can proceed.** Its window-ledger repair touches `.planning/WINDOWS.md` only, which no
  measured gate reads, so it does not invalidate the measurement above.
- **09-05 and 09-06 likewise** operate on `.planning/BACKLOG.md` and a new ledger document.
- **The seal is closed.** Any future requirement status change must move all four carriers together;
  the two test literals updated here are now part of that set and are documented in the
  patterns-established block.
- **No blockers.**

---
*Phase: 09-final-quality-and-backlog-closure*
*Completed: 2026-09-11*

## Self-Check: PASSED

- `.planning/phases/09-final-quality-and-backlog-closure/09-03-SUMMARY.md` exists on disk.
- Both task commits exist: `da08a749` (`docs(requirements): mark the gate-integrity and coverage IDs
  complete`) and `d391d058` (`docs(requirements): mark the closure IDs complete`). Neither deleted a
  tracked file — `git diff --diff-filter=D --name-only HEAD~1 HEAD` printed nothing after each.
- All four plan-level `<verification>` commands were re-run after the last commit:
  `scope-impact --check` → `Scope impact valid: 40 records.` exit 0; `revalidation.test.ts` → 136/136;
  `git hash-object … 01-REVALIDATION.json` → `66218013acf1a69bd28b2380fdcf0c531556dff0`; the bare
  `Pending` scan → `0` for `.planning/REQUIREMENTS.md` and `4` structural non-status hits for
  `scripts/revalidation.mjs`, dispositioned as deviation 2 above.
- **Commit accounting.** `commits: 2` is the measured value from `plan_head_before` (`5bc0e71f`):
  `git rev-list --count 5bc0e71f..HEAD` returned `2` at SUMMARY-write time. The documentation commit
  carrying this file and the state pointer follows it.
- **No stubs, no skipped tests, no unrun `<verify>`.** Every `<verify>` command in all three tasks
  was executed on this tree and its real output is recorded above.
