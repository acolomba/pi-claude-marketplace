---
phase: 99-post-audit-tech-debt-closure
plan: 07
subsystem: tests
tags: [coverage, failure-arms, rollback, update, reinstall, install]
status: complete

requires:
  - "99-04, 99-05, 99-06: all three edited the orchestrators this plan measures, so the measurement had to run last"
provides:
  - "a measured residual-arm list for update / reinstall / install, dated and expressed as named arms"
  - "seven cases covering the reachable rare-failure and rollback arms inside D-99-05b's bound"
  - "a recorded finding that the wiring module the carrier flagged at 49.7% is now fully covered"
affects:
  - "any future edit to the intent-mark guards, the bare-form enumerate path, or the hooks bridge's undo -- each now has a case that goes red alone"

tech-stack:
  added: []
  patterns:
    - "a racing writer injected through the existing clone-cache seam, which lands between the preflight state read and the intent-mark's re-read"
    - "a leftover directory at an atomic-rename target as the obstacle that fails exactly one bridge"
    - "mutation checks (neuter the guard, run the subset) as the evidence a new case is load-bearing"

key-files:
  created:
    - .planning/todos/pending/2026-08-10-coverage-exclusion-versus-tests-for-the-out-of-bound-orchestr.md
  modified:
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/orchestrators/plugin/install.test.ts

decisions:
  - "The scope was fixed by measurement, not by the carrier's table. The 2026-06-12 percentages were wrong in both directions -- the wiring module had gone from 49.7% to 100%, while update.ts had MORE uncovered lines (247) than the 213 recorded."
  - "Three named arms turned out to be defensive code no product state can produce, and were left with the reason recorded rather than reached for by fabricating state: the bulk-reinstall per-target catch, and both per-entry schema re-checks."
  - "The mcp slot of the phase-3a fail-continue contract was left uncovered on purpose. The only obstacle that fails the mcp COMMIT without first failing the mcp PREPARE is a permission trick that must skip as root and off POSIX; the hooks case pins the same contract with a clean obstacle."
  - "No coverage-exclusion entry was added. The question was re-filed as a fresh todo carrying the reasoning, because an exclusion raises the reported number without executing one additional line."

requirements-completed: [D-99-05b]

metrics:
  duration: ~35m
  completed: 2026-08-10

actuals:
  tokens: 7000
  tasks: 3
  commits: 3
---

# Phase 99 Plan 07: Bounded Rare-Failure Coverage Sweep Summary

**The residual was measured against the tree this phase actually left rather than the year-old table, and the seven arms the measurement named as reachable now have cases that assert what the failure left behind — not that the line ran.**

## Why the Measurement Came First

The carrier's per-file table was captured 2026-06-12. Four phases of coverage work have landed on exactly these three modules since, three of them within hours of this plan. Writing tests from that table would have been guesswork, and the measurement proved it: the table was wrong in **both** directions.

| File | 2026-06-12 capture | Measured 2026-08-10 | After the sweep |
| --- | --- | --- | --- |
| orchestrators/plugin/update.ts | 87.9%, 213 uncovered | 91.89%, **247** uncovered | 93.89%, 186 uncovered |
| orchestrators/plugin/reinstall.ts | 93.1%, 83 uncovered | 93.92%, **125** uncovered | 95.77%, 87 uncovered |
| orchestrators/plugin/install.ts | 93.4%, 77 uncovered | 96.35%, **88** uncovered | 96.43%, 86 uncovered |
| orchestrators/edge-deps.ts | 49.7%, 94 uncovered | **100.00%, 0 uncovered** | not touched |

The percentages rose everywhere while the absolute uncovered counts also rose — the files grew faster than the tests did. That is the number the carrier's ordering instruction ("biggest absolute chunk first") actually needed, and it is not derivable from a percentage.

**The wiring module is the clearest finding.** `orchestrators/edge-deps.ts` measures 100.00% with zero uncovered lines against the 49.7% that motivated the exclusion question. It needs neither tests nor an exclusion. That is a finding, and it was dropped from scope rather than carried as a gap.

## Task Commits

| Task | Name | Commit |
| --- | --- | --- |
| 1 | Measure the residual and fix the scope | `12df9542` |
| 2 | Cover the update verb's measured failure arms | `dc171adb` |
| 3 | Cover the reinstall and install rollback arms | `9ecc46e6` |

## The Arms Covered

Seven cases, one arm each, each asserting an observable consequence.

**update.ts — the bare-form enumerate failure (WR-05).** The largest single contiguous uncovered region in the module, ~34 lines. The bare form has no marketplace identity to attribute a target-resolution failure to, so the synthetic `(update)` placeholder occupies both the header and the row slot. A truncated `state.json` is the real producer. The case pins the placeholder in both slots, the closed-set reason, the error severity, and the cause trailer naming the file that could not be read.

**update.ts — the hooks slot of the phase-3a fail-continue contract.** A leftover directory at the hook-config target makes the atomic rename fail while every other bridge commits. The case asserts the aggregation and the recovery hint, that the version does **not** advance, that the in-progress mark survives on the record, and that the skills bridge still landed — the fail-continue half that a bare "it threw" assertion would miss.

**update.ts — both intent-mark concurrency guards (ST-9).** A racing writer, injected through the existing clone-cache seam so it lands in the real window between the preflight state read and the intent-mark's re-read, either advances the version or removes the record. Each case asserts its own closed-set reason (`{concurrently updated}` / `{concurrently uninstalled}`) and, more importantly, that the racing write **survives**: no half-applied swap, no in-progress mark left behind, no resurrection of a record the user just removed.

**reinstall.ts — the config write-back that could not parse (S5).** The artifacts reinstall and the config entry does not get written. The case pins the second half being reported at all, the basename-only wording, and that the absolute scope-root path does not leak into an operator-facing row.

**reinstall.ts — a source that stopped being installable.** Rewriting the manifest entry to an unrecognized source kind after a path-source install raises a typed shape error. The case pins the typed reason (`{source mismatch}`) winning over the notes-substring fallback — which would land on the permissive `not in manifest` and misdescribe the failure — and pins the failed reinstall leaving the record and the old artifacts intact.

**install.ts — the hooks bridge's undo.** The hooks bridge writes atomically with no staging dir, so its undo is a real removal rather than the discard the other bridges perform. Failing the phase after it is what makes that removal run. The case asserts the hook config is gone, the earlier phase's skills are gone, and no record was written.

## The Cases Are Load-Bearing

Two mutation checks, each run against the exact file and restored byte-identical afterwards (`diff` clean both times):

- Neutering the ST-9 stale-version comparison in `update.ts` turned **exactly one** of the four update cases red (`# pass 3 # fail 1`). The other three stayed green, so the case discriminates rather than merely covering.
- Neutering the `removeHookConfig` call in `install.ts`'s hooks undo turned the install case red.

Per-line confirmation from the re-measurement: every named arm's line moved from 0 hits to non-zero — `update.ts:492`, `:1357`, `:1362`, `:1898`, `:2730`, `:2734`, `:2766`, `:2788`, and `install.ts:1084`.

## Arms Deliberately Left, With Reasons

**Defensive code no product state can produce.** Reaching these would require fabricating a state the product cannot reach, which the plan explicitly forbids:

- *The bulk-reinstall per-target catch* (`reinstall.ts:510-535`, 26 lines — the second-largest chunk in the module). `reinstallPlugin` wraps its whole transaction and converts every failure into a returned failed outcome via `handleSinglePluginFailure`; it never throws. The only remaining throw sources are post-success maintenance, whose errors are deliberately swallowed. The catch is unreachable defence.
- *Both per-entry schema re-checks* (`reinstall.ts:1339-1343`, `install.ts:777-781`). `MARKETPLACE_SCHEMA` validates every entry with `PLUGIN_ENTRY_SCHEMA` at manifest load, so a schema-invalid entry rejects the whole manifest before either re-check runs. These are the defence-in-depth re-validation the architecture notes describe; they cannot fail.
- *The install internal-error arm* (`install.ts:1619-1652`, 34 lines — the single largest chunk in that module). It fires only if the state guard returns cleanly without populating the install context, which is an internal-invariant violation, not a reachable input.

**Reachable, but only through a conditionally-skipped mechanism:**

- *The mcp slot of the phase-3a fail-continue contract* (`update.ts:1904-1905`). Occupying `mcp.json` with a directory fails the mcp **prepare** (EISDIR on read) before the commit, landing on the already-covered direct-failure path instead. The only obstacle that fails the commit alone is a filesystem-permission trick, which must skip as root and off POSIX. The adjacent hooks case pins the same fail-continue contract with a clean, unconditional obstacle, so a skipped near-duplicate would add a broken window without adding safety.

**Unreachable back-compat:**

- *The notes-substring skip and fail narrowers* (`update.ts:2808-2864`, ~54 lines). Every one of the eight skipped producers sets a non-empty closed-set `reasons`, and every failed outcome that reaches the cascade renderer carries one, so both fallbacks are dead back-compat paths. They are the largest remaining block in `update.ts` and the reason its after-number is 93.89% rather than higher.

**Not reached for, for want of an injection seam:** the staging-cleanup leak accumulators and the state-finalize failure in `update.ts`, and the rollback-partial and unstage-leak arms in `install.ts`. Each needs a mid-flight failure injected into a bridge that has no dependency seam. Recorded rather than forced.

## Non-Goals, Recorded

Named by the 2026-06-12 carrier but outside D-99-05b's locked bound, so measured and recorded rather than tested:

| Module | Measured 2026-08-10 | Disposition |
| --- | --- | --- |
| orchestrators/import/execute.ts | 94.53%, 59 uncovered | out of bound; recorded in the fresh todo |
| orchestrators/marketplace/update.ts | 95.49%, 50 uncovered | out of bound; recorded in the fresh todo |
| orchestrators/edge-deps.ts | 100.00%, 0 uncovered | question dissolved by measurement |

**No `sonar.coverage.exclusions` entry was added.** The decision was re-filed with its reasoning at `.planning/todos/pending/2026-08-10-coverage-exclusion-versus-tests-for-the-out-of-bound-orchestr.md`, so the next reader inherits the argument rather than the conclusion: an exclusion raises the reported percentage without executing one additional line, trading a true statement about the tree for a flattering one.

## Deviations from Plan

### Auto-fixed Issues

None. No bug, missing critical functionality or blocker was hit — this plan changed no production line.

### Non-deviations worth recording

- Tasks 2 and 3 are marked `tdd="true"`. Their RED obligation was met by the two mutation checks recorded above rather than by RED commits: every case asserts behavior the product already implements correctly, so a RED commit would have required deliberately shipping a broken tree.
- The plan's Task 3 asked for cases in reinstall **and** install. Install received one case rather than a set, because its measured residual is dominated by the defensive and seam-less arms enumerated above. That is the plan's own "stop when a remaining arm is unreachable without fabricating a state the product cannot produce" branch, not a shortfall.
- Prettier reformatted the new block in `update.test.ts` during its pre-commit run. The diff stayed pure addition (237 inserted, 0 deleted) and the cases were re-run green before committing.

## Verification

| Gate | Result |
| --- | --- |
| Coverage measured before any test was written | `coverage/unit.lcov` at `12df9542`'s tree, exit 0 |
| `node --test tests/orchestrators/plugin/update.test.ts` | 95/95 (baseline 91 + 4 new) |
| `node --test .../reinstall.test.ts .../install.test.ts` | 183/183 (3 new) |
| `npm run lint` | exit 0 — no identical-function finding |
| ST-9 guard neutered | exactly 1 of 4 update cases red; restored `diff`-clean |
| hooks undo neutered | the install case red; restored `diff`-clean |
| Re-measurement | every named arm's line moved from 0 hits to non-zero |
| `PI_SUBAGENTS_ROOT=... npm run check` | **exit 0** — 3409 unit (3408 pass, 1 pre-existing platform-conditional skip, 0 fail) + 18 integration (0 fail) |

Every exit code was read directly from a redirected file, never through a pipe. No coverage artifact was staged (`coverage/` is gitignored). `STATE.md` and `ROADMAP.md` were not modified.

## Known Stubs

None.

## Threat Flags

None. This plan added test cases only — no production line changed, and no new input, path or persisted value was introduced.

- `T-99-07-01` (tampering, rollback correctness): mitigated as planned. The new cases assert restored state — the racing writer surviving, the hook config removed, the skills gone, no record written — not merely that a throw occurred.
- `T-99-07-02` (repudiation, the coverage metric): mitigated. No exclusion was added; the decision was re-filed with its reasoning attached, and the arms left uncovered are enumerated above rather than hidden behind a number.
- `T-99-07-03` (information disclosure, fixtures): mitigated. TruffleHog filesystem-mode scan over every committed path returned `verified_secrets: 0, unverified_secrets: 0`. One case asserts positively that an absolute scope-root path does **not** leak into an operator-facing row.
- `T-99-07-SC`: not applicable; no package was installed.

## Self-Check: PASSED

- `tests/orchestrators/plugin/update.test.ts` — FOUND, modified
- `tests/orchestrators/plugin/reinstall.test.ts` — FOUND, modified
- `tests/orchestrators/plugin/install.test.ts` — FOUND, modified
- `.planning/todos/pending/2026-08-10-coverage-exclusion-versus-tests-for-the-out-of-bound-orchestr.md` — FOUND
- `.planning/phases/99-post-audit-tech-debt-closure/99-07-SUMMARY.md` — FOUND
- Commits `12df9542`, `dc171adb`, `9ecc46e6` — all FOUND in `git log`
- `.planning/STATE.md` / `.planning/ROADMAP.md` — unmodified by this plan
