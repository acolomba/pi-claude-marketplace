---
phase: 101-workflow-component-kind-recognition
plan: 04
subsystem: orchestrators
tags: [reconcile, backfill, update, disabled-record, compatibility, workflows]

# Dependency graph
requires:
  - phase: 101-01
    provides: "`workflows` in both resolver tuples -- the boundary move whose two consequences this plan pins"
provides:
  - "backfill pins for both sides of the `compatibility.installable` scan threshold plus the equal-set idempotence case"
  - "the state-level proof that `compatibility.supported` records `\"workflows\"` after a record refreshes"
  - "the disabled-record compatibility-refresh pin: correct, non-materializing, one-time"
  - "a `workflows` convention-directory flag on both test fixtures (`PluginTree`, `seedPathMarketplace`)"
affects: [workflow-materialization]

actuals:
  tokens: 3500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "boundary pins come in pairs: the positive case plus one step to the other side of the gate, because silence alone also passes against a scan that ran and wrote without emitting"
    - "idempotence of a guarded write is asserted by bytes + mtime, never by the rendered row -- the row is identical whether the guard held or a rewrite produced the same values"

key-files:
  created: []
  modified:
    - tests/orchestrators/reconcile/backfill.test.ts
    - tests/orchestrators/plugin/update.test.ts

key-decisions:
  - "no production file was edited -- both consequences of the moved boundary behaved exactly as the phase's design assumption predicted, on the first run of every case"
  - "`compatibility.supported` stays in `disabledPinProjection`; the refresh it triggers is the mechanism that keeps a disabled record's pin honest, not churn to be suppressed"
  - "case 2 of the backfill group asserts the untouched record as well as the silence, because silence alone cannot distinguish a skipped scan from a scan that wrote without emitting"
  - "REQUIREMENTS.md rows WFLW-01..04 marked complete here -- this is the phase's last plan, which is the granularity those Phase-101-scoped rows carry"

patterns-established:
  - "Admitting a component kind moves two boundaries at once (the reconcile self-heal and the disabled-record pin). Both are pinned in the admitting phase so the next kind's reviewer meets a test, not a surprise."

requirements-completed: [WFLW-01, WFLW-02, WFLW-03, WFLW-04]

coverage:
  - id: D1
    description: "A partially-installed record whose re-resolved supported set grew by `workflows` is re-materialized exactly once, records the kind, and stays partial while a genuinely unsupported kind remains"
    requirement: WFLW-03
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/backfill.test.ts#WFLW-03 / BFILL-01: a partially-installed plugin whose supported set grew by `workflows` is re-materialized once"
        status: pass
    human_judgment: false
  - id: D2
    description: "The same fixture recorded `installable: true` is never scanned -- no reinstall, no cascade row, no record change"
    requirement: WFLW-03
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/backfill.test.ts#WFLW-03 / D-68-03: the same plugin recorded installable is never scanned -- no row, no record change"
        status: pass
    human_judgment: false
  - id: D3
    description: "A record whose recorded supported set already equals the re-resolved one produces no backfill -- growth is strict-superset only, so the self-heal is one-time"
    requirement: WFLW-03
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/backfill.test.ts#WFLW-03 / BFILL-01: a record already listing `workflows` produces no backfill -- growth is strict-superset only"
        status: pass
    human_judgment: false
  - id: D4
    description: "`compatibility.supported` records `\"workflows\"` after a record refreshes -- the state-level satisfaction of the `list` half of the phase's third success criterion"
    requirement: WFLW-04
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/backfill.test.ts (case 1) and tests/orchestrators/plugin/update.test.ts#WFLW-04 / D-99-05a: a disabled record whose supported set gained `workflows` is refreshed"
        status: pass
    human_judgment: false
  - id: D5
    description: "`update` against a disabled record whose only moved fact is the grown supported set writes the refreshed block, keeps the record disabled, leaves every `resources` array empty, and renders an existing sibling's row"
    requirement: WFLW-04
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/update.test.ts#WFLW-04 / D-99-05a: a disabled record whose supported set gained `workflows` is refreshed"
        status: pass
    human_judgment: false
  - id: D6
    description: "The disabled-record refresh is idempotent -- a second `update` leaves state.json byte-identical with its mtime untouched"
    requirement: WFLW-04
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/update.test.ts#WFLW-04 / D-99-05a: the refresh for a gained `workflows` kind is one-time"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-14
status: complete
---

# Phase 101 Plan 04: Workflow component-kind recognition Summary

**The two behaviors that shift as a consequence of admitting `workflows` -- the reconcile self-heal and the disabled-record pin refresh -- are pinned as intended, one-time, and non-materializing, with no production file edited**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-14T19:26:00Z
- **Completed:** 2026-08-14T19:46:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Both sides of the backfill scan's `compatibility.installable` threshold are pinned against the same on-disk fixture. A partial record whose supported set grew by `workflows` re-materializes once and records the kind; the identical plugin recorded as cleanly installed is never scanned at all, so a user whose install already works sees nothing on the next load.
- The equal-set case pins that growth is strict-superset only. That is what bounds the self-heal to one pass rather than re-materializing on every load, and it is the assertion behind the denial-of-service disposition in the plan's threat register.
- `compatibility.supported` recording `"workflows"` is asserted on two independent write paths (the reconcile re-materialize and the disabled-record refresh). That is the state-level satisfaction of the third success criterion's `list` clause: `list` renders no component enumeration, so no `list` byte changes anywhere in this phase.
- The `disabled-record-refresh` that `update` now performs on a disabled workflow-bearing record is pinned as correct rather than "fixed". The refresh writes the grown supported set, keeps `enabled: false`, leaves all five `resources` arrays empty, and renders the same byte-pinned `⊘ hello (skipped) {up-to-date}` row its two siblings assert -- no new reason token, no new catalog state.
- Idempotence is asserted by bytes and mtime, not by the row. The row renders identically whether the second refresh no-ops or rewrites the record with identical values, so a row assertion cannot tell a guarded no-op from an unguarded rewrite.

## Task Commits

1. **Task 1: Pin the reconcile backfill boundary** — `7e145b41` (test)
2. **Task 2: Pin the disabled-record compatibility refresh** — `8578356b` (test)

## Files Created/Modified

- `tests/orchestrators/reconcile/backfill.test.ts` — a `workflows` flag on `PluginTree` / `writePluginTree` laying down a convention directory with one `.js` script, plus three cases (grown-set re-materialize, the `installable: true` early return, the equal-set no-op). 20 tests → 23.
- `tests/orchestrators/plugin/update.test.ts` — a `hasWorkflows` flag on `seedPathMarketplace`'s per-plugin spec, plus two cases (the disabled-record refresh, and its one-time settle). 99 tests → 101.

## Decisions Made

- **No production file was touched, and none needed to be.** Every case passed on its first run against the code as 101-01 left it. The plan named the alternative explicitly — a case that could not go green without a production edit would have meant the boundary move carried a real defect — so recording that the branch never came up is the finding.
- **`compatibility.supported` stays in `disabledPinProjection`.** The refresh it triggers is one-time and idempotent; excluding the field to silence it would break the D-99-05a guarantee that a disabled record's pin describes what a later `enable` will install.
- **Case 2 of the backfill group asserts the record, not only the silence.** Zero notifications alone would also pass against a scan that ran, wrote, and emitted nothing. Pinning `supported` still equal to `["skills"]` is what makes it a threshold assertion.
- **The refresh case isolates exactly one moving fact.** `resolvedSource` is pre-seeded to the real resolved plugin root and `compatibility` is overridden to the pre-admission set, so the gained kind is the only difference between the record's projection and the resolver's. Leaving the helper's `/tmp` placeholder would have made the source the mover and proved nothing about the supported set.
- **REQUIREMENTS.md rows marked complete here.** 101-01 deliberately left WFLW-01..04 `Pending` because all four plans carry the same four IDs while the rows are scoped to the phase. This is the phase's last plan and every sibling summary is on disk, so the rows are now honest.

## Deviations from Plan

None — the plan executed exactly as written. No auto-fix rule fired, no checkpoint was reached, and no scope boundary was approached: `git diff --stat extensions/` is empty across both commits.

One tool-level correction worth recording: the first `npm run check` after Task 2 failed `format:check` on the new update-test block (Prettier reflowed one over-width object literal). Ran `npx prettier --write` on the file and re-ran; the full gate is green. That is formatting, not a behavior deviation.

## Issues Encountered

- **Pre-existing comment-policy debt, deliberately not touched.** `tests/orchestrators/reconcile/backfill.test.ts:320` carries a bare `Pitfall 4 /` token, which the current comment rule forbids. It is not in this plan's blast radius and fixing it would enlarge the diff for no behavior change. Logged here rather than silently corrected or silently ignored.
- **The trufflehog pre-commit hook fails structurally from this worktree**, as documented in CLAUDE.md (`.git` is a file, so the git-mode scan cannot read the index). Both commits were preceded by a filesystem-mode scan over the exact changed path — `verified_secrets: 0`, `unverified_secrets: 0` both times — and used `SKIP=trufflehog` with no other hook skipped.

## User Setup Required

None — no external service configuration required. No package was installed; the only new fixture content is an inert `.js` file written into a temp directory by the test harness.

## Next Phase Readiness

- **Phase 101 is complete.** `npm run check` is green (typecheck, ESLint, Prettier, 3462 unit tests, 18 integration tests).
- **Recognition is closed, materialization is not.** The next phase in the milestone owns `meta.name` extraction; the one after owns the `bridges/workflows/` triplet and the NFR-10 containment-root amendment. Nothing in this plan constrains either — the re-materialize asserted here deliberately writes no workflow artifact, because there is no bridge to write one.
- **A signal for the materialization phase:** once a workflows bridge exists, the backfill case pinned here changes meaning. The same re-materialize will then also stage workflow artifacts, and case 1's "no artifact is written" comment becomes stale. It is worth re-reading at that point rather than assuming the case still says what it says today.
- **REQUIREMENTS.md** rows WFLW-01..04 are marked complete, with the phase's traceability rows updated.

## Self-Check: PASSED

Both modified files verified present on disk; both commit hashes verified in `git log`.

---
*Phase: 101-workflow-component-kind-recognition*
*Completed: 2026-08-14*
