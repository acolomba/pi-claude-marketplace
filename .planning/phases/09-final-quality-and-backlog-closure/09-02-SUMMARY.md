---
phase: 09-final-quality-and-backlog-closure
plan: 02
subsystem: testing
tags: [coverage, measurement, pin, documentation, node-test]

# Dependency graph
requires:
  - phase: 09-final-quality-and-backlog-closure
    provides: "09-01's injected hooks read port — the production change that made every earlier coverage reading stale"
  - phase: 08-direct-coverage
    provides: "the regenerate-and-compare method, `loadCoveragePin` / `assertPinnedReadings`, and the committed pin this plan rebuilt"
provides:
  - "A whole-tree direct-coverage measurement taken on the tree that carries the read port: 230 rows, `accepted-shortfall 2, complete 221, type-only 7`"
  - "`scripts/test-coverage-direct.pin.json` regenerated from that run's own `accepted-shortfall` enumeration and proved byte-identical to the committed file"
  - "`npm run test:coverage:direct:all` at exit 0 over 230 pairs on the ported tree, with `2 pinned shortfall(s) matched ... exactly.`"
  - "A CONTRIBUTING.md coverage section re-read against the fresh readings and confirmed to state them correctly, with no edit needed"
affects: [09-03 requirement seal change A, 09-04 full-suite measurement, 09-06 CLOSE-01/CLOSE-02]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate`.
actuals:
  tokens: 4600
  tasks: 2
  commits: 0
plan_head_before: 2734c30f67762d435d73388523838838f98eec29

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A generated artifact regenerated from a fresh enumeration and compared: empty `git status --porcelain` IS the byte-identity proof, recorded as a result and producing no commit"
    - "The pin's `reading` is carried from the report row's own `coverage` field, never retyped — one declaration (`shortfallReadingOf`) produces both"

key-files:
  created: []
  modified: []

key-decisions:
  - "The pin's `findingIds` and `reasons` are carried forward by `sourcePath` from the committed file; only `sourcePath` and `reading` are rebuilt from the fresh report, because the report records no rationale and inventing one would be the hand-authoring the threat register forbids"
  - "The regeneration script refuses outright on a shortfall row whose `sourcePath` carries no committed rationale, so an unpinned shortfall stops the task instead of silently widening the pin"
  - "Neither task produced a commit: both artifacts came back unchanged, and the plan's prohibitions bar an empty commit standing in for a no-diff outcome"

patterns-established:
  - "Run the report arm and the strict arm as two separate passes with no edit to any measured file in between; the pair costs about sixteen minutes and that cost is the price of a measurement that describes the tree that will be committed"

requirements-completed: []

coverage:
  - id: D1
    description: "The whole-tree report ran for real on the ported tree and enumerated 230 pairs"
    requirement: CLOSE-01
    verification:
      - kind: other
        ref: "npm run test:coverage:direct:report -> exit 0, `All-pair report written: 230 rows in 482.5s on v26.8.2 to coverage/all-pairs-report.ndjson`"
        status: pass
      - kind: other
        ref: "wc -l coverage/all-pairs-report.ndjson -> 230"
        status: pass
    human_judgment: false
  - id: D2
    description: "The fresh report's `accepted-shortfall` set is exactly the pin's two modules and no others"
    requirement: CLOSE-01
    verification:
      - kind: other
        ref: "verdict tally over the 230 report rows -> {complete: 221, type-only: 7, accepted-shortfall: 2}; the two shortfall rows are bridges/commands/discover.ts and orchestrators/plugin/install-outcome.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The pin regenerated from that enumeration is byte-identical to the committed file"
    requirement: RCOV-02
    verification:
      - kind: other
        ref: "rebuild rows from the ndjson `accepted-shortfall` rows, `npx prettier --write scripts/test-coverage-direct.pin.json`, then `git status --porcelain scripts/test-coverage-direct.pin.json` -> empty"
        status: pass
      - kind: other
        ref: "git diff --exit-code scripts/test-coverage-direct.pin.json -> exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The strict all-pair arm exits 0 on the ported tree with the bidirectional pin match confirmed"
    requirement: CLOSE-01
    verification:
      - kind: other
        ref: "npm run test:coverage:direct:all -> exit 0, `2 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly.`, `All-pair run complete: 230 pairs in 479.4s (479408ms) on v26.8.2`"
        status: pass
      - kind: other
        ref: "wc -l coverage/all-pairs.jsonl -> 230 (the strict arm's own per-pair record)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The ported module's own pair reads complete at the re-measured figure"
    requirement: CLOSE-01
    verification:
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/hooks/event-router.ts -> `Direct coverage passed: ... (branches 114/114, functions 43/43, lines 1002/1002)`"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every coverage reading CONTRIBUTING.md states matches the regenerated pin, the reachability boundary is still stated, and the corrected tense was not regressed"
    requirement: RCOV-03
    verification:
      - kind: other
        ref: "diff of the reading strings grepped out of CONTRIBUTING.md and the pin -> no output"
        status: pass
      - kind: other
        ref: "grep -c 'not wired' CONTRIBUTING.md -> 0; CONTRIBUTING.md:81 still carries `A complete reading is reachability evidence only.`"
        status: pass
      - kind: other
        ref: "git status --porcelain CONTRIBUTING.md -> empty"
        status: pass
    human_judgment: false
  - id: D7
    description: "The pin's three failure directions — addition, removal, swap — are asserted by a planted negative control rather than believed"
    requirement: RCOV-02
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct:negative -> exit 0 in 3.9s, naming `an unpinned shortfall, a moved pinned reading, a stale pin row, an emptied pin reporting its readings as additions, a pin row naming a module the tree no longer enumerates`"
        status: pass
    human_judgment: false

# Metrics
duration: 20 min
completed: 2026-09-11
status: complete
---

# Phase 9 Plan 02: Whole-Tree Coverage Re-Measurement Summary

**The whole-tree direct-coverage surface was re-measured on the tree that carries the hooks read port — 230 pairs, `accepted-shortfall 2, complete 221, type-only 7` — the committed pin was rebuilt from that run's own enumeration and came back byte-identical, and CONTRIBUTING.md's stated readings were re-read against it and needed no correction.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-11T20:46Z (first sweep launched 20:48:13Z)
- **Completed:** 2026-09-11T21:05Z
- **Tasks:** 2
- **Files modified:** 0 — both deliverables came back unchanged, which is the result

## The measurements, verbatim

### Pass 1 — the report arm

```
npm run test:coverage:direct:report
All-pair report written: 230 rows in 482.5s on v26.8.2 to coverage/all-pairs-report.ndjson
Verdicts: accepted-shortfall 2, complete 221, type-only 7
real	8m3.316s
```

Exit 0. `wc -l coverage/all-pairs-report.ndjson` prints `230` — the expected count, unchanged from
the pre-port enumeration, because 09-01 put `readHooksJson` in the existing `bridges/hooks/stage.ts`
rather than a new module.

The full `accepted-shortfall` set the fresh report produced, verbatim, and it is exactly the pin's
two rows and no others:

```json
{
  "sourcePath": "extensions/pi-claude-marketplace/bridges/commands/discover.ts",
  "testPath": "tests/bridges/commands/discover.test.ts",
  "verdict": "accepted-shortfall",
  "coverage": "branches 55/57, lines 412/414",
  "exitCode": 1,
  "runtime": "v26.8.2",
  "elapsedMs": 645
}
{
  "sourcePath": "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts",
  "testPath": "tests/orchestrators/plugin/install-outcome.test.ts",
  "verdict": "accepted-shortfall",
  "coverage": "branches 109/111, lines 1034/1040",
  "exitCode": 1,
  "runtime": "v26.8.2",
  "elapsedMs": 3924
}
```

The ported module's own row in the same report:

```json
{
  "sourcePath": "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts",
  "testPath": "tests/bridges/hooks/event-router.test.ts",
  "verdict": "complete",
  "coverage": "branches 114/114, functions 43/43, lines 1002/1002",
  "exitCode": 0,
  "runtime": "v26.8.2",
  "elapsedMs": 3410
}
```

### The two pinned readings, as measured this cycle

| module | reading measured 2026-09-11 on the ported tree |
| --- | --- |
| `extensions/pi-claude-marketplace/bridges/commands/discover.ts` | `branches 55/57, lines 412/414` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` | `branches 109/111, lines 1034/1040` |

These are this run's `coverage` fields, not figures quoted from `08-08-SUMMARY.md`. They agree with
the committed pin, which is the finding.

### Pass 2 — regenerate and compare

The pin has no writer, so the rows were rebuilt from the report: `sourcePath` and `reading` come
from each `accepted-shortfall` row's own `sourcePath` and `coverage` fields, and `findingIds` and
`reasons` are carried by `sourcePath` from the committed file, since the report records no
rationale. Rows were sorted by `sourcePath` and the `version: 1` envelope preserved, then the
result normalized with `npx prettier --write scripts/test-coverage-direct.pin.json`.

```
regenerated 2 row(s) from 230 report rows
$ git status --porcelain scripts/test-coverage-direct.pin.json
$ git diff --exit-code scripts/test-coverage-direct.pin.json ; echo $?
0
```

**The empty output is the result.** The pin was regenerated from a fresh whole-tree enumeration and
the bytes agree, so there is nothing to commit and no commit was manufactured. The regeneration
script throws on a shortfall row whose `sourcePath` carries no committed rationale, so an unpinned
shortfall would have stopped the task rather than widening the pin; it did not fire.

### Pass 3 — the verdict arm

```
npm run test:coverage:direct:all
Direct coverage shortfall recorded: extensions/pi-claude-marketplace/bridges/commands/discover.ts (branches 55/57, lines 412/414)
Direct coverage shortfall recorded: extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts (branches 109/111, lines 1034/1040)
Direct coverage passed: scripts/revalidation.mjs (branches 789/789, functions 202/202, lines 2660/2660)
2 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly.
All-pair run complete: 230 pairs in 479.4s (479408ms) on v26.8.2
real	8m0.250s
```

Exit 0. `coverage/all-pairs.jsonl` holds 230 rows, one per pair, as the strict arm's own record.

### The single-pair arm for the ported module

```
Direct coverage passed: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts (branches 114/114, functions 43/43, lines 1002/1002)
```

## Task 2 — CONTRIBUTING.md re-read against what was measured

Nothing moved, so nothing was edited. The evidence, quoted on both sides:

| source | line |
| --- | --- |
| `scripts/test-coverage-direct.pin.json:6` | `"reading": "branches 55/57, lines 412/414",` |
| `CONTRIBUTING.md:60` | `` | `bridges/commands/discover.ts`            | branches 55/57, lines 412/414     | `` |
| `scripts/test-coverage-direct.pin.json:15` | `"reading": "branches 109/111, lines 1034/1040",` |
| `CONTRIBUTING.md:61` | `` | `orchestrators/plugin/install-outcome.ts` | branches 109/111, lines 1034/1040 | `` |

They agree. The set comparison is stronger than the two greps and also passes:

```
$ diff <(grep -o 'branches [0-9/]*, \(functions [0-9/]*, \)\?lines [0-9/]*' CONTRIBUTING.md | sort) \
       <(grep -o 'branches [0-9/]*, \(functions [0-9/]*, \)\?lines [0-9/]*' scripts/test-coverage-direct.pin.json | sort)
$ echo $?
0
```

Every other stated fact in the section was checked against this cycle's runs:

- **The three failure directions** — "fails on an addition, on a removal, and on a swap" — are
  asserted by a planted negative control, not by the strict arm's silence.
  `npm run test:coverage:direct:negative` exits 0 in 3.9s and names each planted case:
  *an unpinned shortfall, a moved pinned reading, a stale pin row, an emptied pin reporting its
  readings as additions, a pin row naming a module the tree no longer enumerates*.
- **"around eight minutes for the whole tree"** — measured 8m3.3s for the report arm and 8m0.3s for
  the strict arm. Correct.
- **The report tool's contract** — "one JSON row per pair", "its exit code is not a coverage
  verdict", "a `verdict` of `complete`, `type-only` or `accepted-shortfall`". All three were
  observed: 230 rows, exit 0 while two rows were refused, and all three verdict values present
  (221/7/2).
- **`grep -c 'not wired' CONTRIBUTING.md`** prints `0`. The already-corrected tense was not
  regressed, and the wiring sentences were not touched.
- **The reachability boundary is still stated**, at `CONTRIBUTING.md:81`: *"A complete reading is
  reachability evidence only. It says every arm ran under the owner test. It says nothing about
  whether that test asserted anything worth asserting."* This is the `RCOV-03` boundary and it
  stands unedited.

`git status --porcelain CONTRIBUTING.md` prints nothing.

## Accomplishments

- **The coverage surface of the final code tree is measured, not inherited.** Both sweeps ran on the
  tree that carries 09-01's port. No figure in this SUMMARY comes from 08-08's run; the two that
  happen to match it match because the tree still reads that way, and the report rows proving it are
  quoted above.
- **The pin proved itself.** Rebuilding it from the report's own enumeration and getting the same
  bytes back is what makes the committed artifact a measurement rather than a document — the two
  rows the file claims are short are the two rows a fresh whole-tree run refuses, with the same
  readings.
- **The port created no coverage debt.** 09-01 changed four production modules and the shortfall set
  is unchanged at two, neither of which it touched. `event-router.ts` reads complete at the higher
  line count.
- **The documentation agrees with the tree.** Every reading string in CONTRIBUTING.md appears in the
  pin and vice versa, checked as a set rather than row by row.

## Files Created/Modified

None. `scripts/test-coverage-direct.pin.json` was regenerated in place and the bytes were identical;
`CONTRIBUTING.md` was re-read and needed no correction. Both end the plan clean in
`git status --porcelain`.

## Decisions Made

1. **Which fields the regeneration rebuilds.** The report row carries `sourcePath` and `coverage`
   and nothing else a pin row needs; `findingIds` and `reasons` are human-recorded rationale the
   report cannot produce. They are carried forward keyed by `sourcePath`. This keeps the measured
   half measured and the recorded half recorded, and it is why "regenerated" is not "invented".
2. **What an unpinned shortfall does.** The regeneration script throws by name rather than emitting
   a row without rationale, so `T-09-06`'s failure mode — the pin quietly becoming an allow-list —
   cannot happen through this path even by accident.
3. **No commit for either task.** Both prohibitions in the plan are explicit about this, and 08-08
   set the precedent: an artifact that comes back byte-identical is a result, and an empty commit
   claiming otherwise would be the misrepresentation the phase exists to retire.

## Deviations from Plan

None — plan executed exactly as written. No deviation rule was invoked; nothing failed and nothing
needed fixing.

## Issues Encountered

**The precondition's literal form was not met; its stated purpose was.** Task 1's precondition asks
for `git status --porcelain` to print nothing, because "an uncommitted edit makes the recorded
reading a statement about a tree that will never be committed." The checkout carries pre-existing,
session-external dirt: modified `.claude/settings.json` and `.codex/config.toml`, and untracked
`.claude/CLAUDE.md`, `.codegraph/`, `.mcp.json`, `AGENTS.md`, and ten `.planning/phases/**` review
files from phases 01 and 08. None of it is on the measured surface — checked explicitly:

```
$ git status --porcelain | awk '{print $NF}' | grep -E '^(extensions/|tests/|scripts/|package\.json|package-lock\.json|\.planning/REQUIREMENTS\.md)'
NO DIRT ON MEASURED SURFACE
```

In particular `.planning/REQUIREMENTS.md` is unmodified, which is the file the `scripts/revalidation.mjs`
pair reads during the sweep and the specific hazard the precondition's rationale names. The
measurement therefore describes the tree as it will be committed. Recorded here rather than treated
as an unmet precondition, because the condition that makes the reading valid holds.

**No edit was made while either sweep was in flight.** The regeneration ran after pass 1 returned
and the CONTRIBUTING.md comparison is read-only, so `T-09-08` had no opening.

## Requirements

`CLOSE-01` is declared by this plan and by 09-01, 09-03 and 09-06. It is not marked complete here,
for the same reason 09-01 did not mark it: `D-09-02` reserves the `CLOSE-01` flip for change B,
after the full suite has been measured green on a tree that already carries change A. `RCOV-02` and
`RCOV-03` are sealed at `Pending` and their flips belong to change A in 09-03; this plan supplies
the measurement those flips will cite, not the flip.

## Next Phase Readiness

- **09-03 can proceed.** Its input is a coverage surface measured after the production change, and
  it now has one: 230 pairs, strict arm exit 0, pin byte-identical. `D-09-09` step 2 is discharged.
- **`RCOV-02`'s clause text needs no change, so no signature recomputation is in scope.** The clause
  names `bridges/hooks/event-router.ts` among the modules closed by real owner tests without quoting
  a reading for it; the two readings its clause does quote belong to the pinned modules, and neither
  moved. `D-09-03` already records that a pure status flip does not disturb the clause signature.
- **CONTRIBUTING.md needs no follow-up.** Every reading it states was re-verified against the tree
  this cycle.
- **No blockers.**

---
*Phase: 09-final-quality-and-backlog-closure*
*Completed: 2026-09-11*
