---
phase: 99-post-audit-tech-debt-closure
plan: 06
subsystem: orchestrators
tags: [update, disabled-record, guard, refresh]
status: complete

requires:
  - "99-04: the update row composer landed before this plan changed which row a disabled record gets"
  - "99-05: update's manifest-absence judgment already rewired, so the preflight edit met no conflicting change"
provides:
  - "a disabled record self-heals its resolvedSource and compatibility block under an unchanged version"
  - "refreshDisabledRecord returns whether it wrote, and writes nothing when nothing moved"
  - "runDisabledRecordRefresh: the disabled arm extracted out of the three-phase body"
affects:
  - "a later `enable` of a disabled record -- it now re-materializes from the current pluginRoot and gates on a current availability discriminant"

tech-stack:
  added: []
  patterns:
    - "a normalized positional projection compared with `===` instead of a recursive deep compare"
    - "withLockedStateTransaction with an explicit save, so a no-op mutation leaves state.json untouched (withStateGuard persists unconditionally)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - tests/orchestrators/plugin/update.test.ts

decisions:
  - "The reordering is expressed as a SCOPING of the short-circuit (`toVersion === fromVersion && !isRecordedButDisabled(record)`) rather than a move of the disabled branch. An enabled record's unchanged update returns from the same line it returned from before."
  - "The row does not move: a disabled record at an unchanged version keeps the byte-pinned `(skipped) {up-to-date}` row even when the pin moved. Recorded as an explicit call in code, not left as an ordering side effect."
  - "The reverted guard draft was NOT in the history; `git log -S` over all refs finds only the two commits that touched the function, neither carrying a guard. The plan's sanctioned alternative -- a normalized projection -- was used instead of reinventing a recursive compare."
  - "The clone GC sweep is now gated on the refresh having written. A refresh that wrote nothing un-referenced nothing, so the no-op path stays free of I/O as well as of writes."

requirements-completed: [D-99-05a]

metrics:
  duration: ~40m
  completed: 2026-08-10

actuals:
  tokens: 7000
  tasks: 2
  commits: 2
---

# Phase 99 Plan 06: Disabled-Record Refresh Under an Unchanged Version Summary

**A disabled record now repairs its source and its availability discriminant when they move under a version that did not, and the guard that keeps a repeated update from rewriting it has a test that fails without it.**

## What Was Built

`refreshDisabledRecord` exists so a disabled record's pin stays current for a later `enable`. It never ran on the case it was most needed for: `preflightUpdate` returned the `unchanged` outcome the moment `toVersion === fromVersion`, and the disabled branch sat past that return. Version equality is the whole answer for an enabled record, whose every other field is rewritten by the materialization the version gates. It is not the answer for a disabled record, which also carries `resolvedSource` and a `compatibility` block that move on their own — a path-source marketplace re-added from another directory, or a manifest entry that gains or loses an unsupported kind with no version bump.

The short-circuit is now scoped to enabled records. A disabled record falls through to `runDisabledRecordRefresh`, which refreshes the record, sweeps the clone the refresh un-referenced, and re-derives the row from the same version equality the preflight used to answer with.

## Task Commits

| Task | Name | Commit |
| --- | --- | --- |
| 1 (tracer) | Moved source under an unchanged version, end to end | `ab6274b0` |
| 2 | The guard pinned load-bearing, plus the drift pair | `c1c06024` |

## The Guard: Where It Came From

The plan asked for the guard drafted and reverted during the earlier fix pass, recoverable via `git log -S refreshDisabledRecord`. **It is not in the history.** That search over all refs returns exactly two commits touching the function — `5f1d0c57` (which introduced it) and `d1287a30` (the WR-01 partial-gate narrowing) — and neither carries a guard. `git log --all -S` on candidate identifiers and a grep of `.planning/` for the draft found nothing either; 99-RESEARCH.md had already marked the recovery `[ASSUMED]` at line 770. The plan's stated alternative was used: compare a normalized projection.

The shipped form is a positional projection reduced to one string, so equality is `===` and no key ordering can make equal records compare unequal:

- fields compared: `version`, `resolvedSource`, `resolvedSha`, `compatibility.installable`, `compatibility.notes`, `compatibility.supported`, `compatibility.unsupported` — exactly the set the refresh writes.
- `updatedAt` is excluded on purpose. The refresh derives it from the wall clock, so a projection carrying it would differ from itself on every call and the guard could never hold.
- the compared `resolvedSha` is the one the record would END UP with (`resolvedSha ?? sRecord.resolvedSha`), because a path / github-name source carries no pin and leaves the recorded value alone; comparing against a bare `undefined` would read every such refresh as a move.

The function also moved from `withStateGuard` to `withLockedStateTransaction`. `withStateGuard` saves unconditionally, so a guard inside its callback would still have rewritten state.json with identical bytes and a fresh mtime — the exact no-op write RECON-05 forbids. The transaction's explicit `save()` is what makes "nothing moved" mean no write at all.

## The Observed Red

Removing the guard (replacing `if (next === current) { return false; }` with a no-op) and re-running the disabled-record cases:

```text
not ok 4 - ENBL-09: update --partial on a disabled PARTIAL is idempotent ...
    a no-op refresh must not touch state.json (RECON-05 mtime stability)
    + actual   1786380680375.1753
    - expected 1786380680361.175

not ok 6 - D-99-05a: a disabled record with nothing to move performs NO write
    a refresh with nothing to move must leave state.json byte-identical
    +   '          "updatedAt": "2026-08-10T16:51:20.455Z"'
    -   '          "updatedAt": "2026-08-10T16:51:20.443Z"'

# pass 7
# fail 2
```

Two things this pins beyond "a test failed". First, the moved-source, drift and promote cases stayed GREEN — only the nothing-moved controls went red, so the guard is doing one job and the reordering is doing the other. Second, the pre-existing ENBL-09 idempotency case failed alongside the new one: after the reordering its guarantee genuinely rests on the guard rather than on the ordering, which is what its comment now says. `update.ts` was restored and confirmed byte-identical to its pre-experiment copy (`diff` clean) before the test commit.

## The Row Contract: An Explicit Call

A disabled record at an unchanged version keeps `(skipped) {up-to-date}`, byte for byte, even when the refresh moved its source or its compatibility block. **No catalog state was added and no fixture byte moved.**

The reason, recorded in a comment at the branch citing D-99-05a: the row reports the ARTIFACT state, and that state genuinely is unchanged — a disabled record materializes nothing either way. Moving a byte-pinned row here would buy the reader no new fact and cost a catalog amendment. The comment exists because an unexplained non-change reads as an oversight to the next reader.

The other arm is unchanged: when the version DID move, the row is still `(skipped) {already disabled}` (WR-02), because `up-to-date` would be a false claim about a version the refresh just rewrote. Both rows now come from the same version equality, one arm of `runDisabledRecordRefresh` each.

## The Enabled-Plugin Path Is Untouched

The change is a scoping of the existing condition, not a move of the branch:

```ts
if (toVersion === fromVersion && !isRecordedButDisabled(record)) {
```

An enabled record returns the `unchanged` outcome from the same line, with the same body, before any of this plan's code is reachable. `isRecordedButDisabled` is the single ENBL-05 predicate, so the added conjunct introduces no second reading of disabled-ness.

The control is the pre-existing `PUP-3` case, unedited: an enabled record at an equal version reaches `partition: "unchanged"`, renders `● mp [project]\n  ⊘ hello (skipped) {up-to-date}`, and asserts *state.json must NOT be rewritten on unchanged path*. That assertion is load-bearing here — an enabled record cannot enter the disabled branch, so had the scoping leaked it would have run the full three-phase update and both the row and the state write would have moved. It passes unchanged.

## Complexity: The Suppression Count Did Not Grow

`grep -c eslint-disable` on `update.ts` returns **4** at HEAD and **4** before this plan — the same four (`finalizeUpdateRecord`, `runThreePhaseUpdate`, and the two unrelated ones at the file's tail). The disabled arm was extracted into the named helper `runDisabledRecordRefresh` rather than adding a branch to `runThreePhaseUpdate`, whose body shrank by ~40 lines. `npm run lint` exits 0 with no new finding at `preflightUpdate`.

## No Test Assertion Was Edited

Two comments inside the pre-existing ENBL-09 idempotency case were rewritten because they narrated the ordering this plan inverts — the falsified-comment class the previous phase spent a plan removing. One claimed *the `toVersion === fromVersion` short-circuit ... returns the `unchanged` outcome BEFORE the disabled-record branch is reached*, which is now false. No assertion, fixture, expected string or title was touched in that case or in any other pre-existing case; the diff on the test file is otherwise pure addition (171 inserted lines, 0 deleted, in the test commit).

## Deviations from Plan

### Auto-fixed Issues

None. No bug, missing critical functionality or blocker was hit.

### Non-deviations worth recording

- The guard's recovery failed for a documented reason (above) and the plan's sanctioned alternative was taken. This is a plan-anticipated branch, not a deviation.
- Task 2 is marked `tdd="true"`. Its RED obligation was met by the guard-removal experiment rather than by a RED commit: the three cases assert behavior Task 1 had already made correct, so a RED commit would have required deliberately shipping a broken tree. The observed red is recorded above.
- Prettier reformatted `update.ts` during the Task 1 pre-commit run (the multi-line import it collapsed, among others). The diff was inspected hunk by hunk to confirm it touched only this plan's regions, and the suite was re-run green before committing.

## Verification

| Gate | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 — suppression count 4, unchanged from HEAD |
| `node --test tests/orchestrators/plugin/update.test.ts` | 91/91 (baseline 87 + 4 new), every pre-existing case green and unedited |
| Guard removed | the nothing-moved case and the ENBL-09 idempotency case RED; the three refresh cases still green |
| `node --test .../marketplace/update.test.ts .../plugin/enable-disable.test.ts` | green and unedited — no cascade row moved |
| `node --test tests/architecture/catalog-uat.test.ts` | green, both walk directions — the up-to-date row's bytes did not move |
| `PI_SUBAGENTS_ROOT=... npm run check` | **exit 0** — 3402 unit (3401 pass, 1 pre-existing platform-conditional skip, 0 fail) + 18 integration (0 fail) |

Every exit code was read directly from a redirected file, never through a pipe.

## Known Stubs

None.

## Threat Flags

None.

- `T-99-06-01` (tampering, persisted resolved source): reduced, not added to. The value written is `installable.pluginRoot` from the same resolver the pre-existing moved-version path already wrote, and it is written by the same function through the same containment-validated resolution. The reordering changed WHEN that value is written, never WHETHER it was validated.
- `T-99-06-02` (the shared unchanged partition): mitigated as planned — the disabled-only scoping is asserted, and the full update, cascade and enable suites ran unedited.
- `T-99-06-03` (the up-to-date row): accepted as planned, and now documented in code as well as here.
- `T-99-06-04` (repeated no-op writes): mitigated — the guard is the control, and the nothing-moved case is its proof.
- `T-99-06-SC`: not applicable; no package was installed.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — FOUND, modified
- `tests/orchestrators/plugin/update.test.ts` — FOUND, modified
- `.planning/phases/99-post-audit-tech-debt-closure/99-06-SUMMARY.md` — FOUND
- Commits `ab6274b0`, `c1c06024` — both FOUND in `git log`
- `.planning/STATE.md` / `.planning/ROADMAP.md` — unmodified by this plan
