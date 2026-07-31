---
phase: 89-documentation-reconcile
plan: 01
subsystem: docs
tags: [hooks, stop, stopfailure, agent_settled, output-catalog, issue-103, markdown]

# Dependency graph
requires:
  - phase: 88-agent-settled-dispatcher-stop-contract-stopfailure
    provides: shipped Stop/StopFailure promotion (bucket-A admission, agent_settled dispatcher, >=0.80.5 peer floor)
provides:
  - "output-catalog.md partial-hook example re-pointed from Stop (now supported) to Notification (still unsupported) — byte-safe, coupled tests green (D-89-07)"
  - "issue-103 authority doc agent_settled version attribution corrected 0.80.4 -> 0.80.5 at all four cited sites, with the npm-release nuance preserved (D-89-06)"
  - "issue-103 doc stale-doc inventory bullets reconciled to read as done, so DOC-04/DOC-05 pointer authority stays consistent"
affects: [89-02 (DOC-04 hooks-compatibility reconcile), 89-03 (DOC-05 research-doc amend)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tracer-first for a docs phase: prove the only test-coupled doc edit byte-safe against the full npm run check gate before the larger narrative reconciles begin"
    - "Version-nuance without the stale literal: express the 'npm never released 0.80.4' history as prose (0.80.3 -> 0.80.5) so the doc carries the nuance while grep for 0.80.4 returns zero"

key-files:
  created:
    - .planning/phases/89-documentation-reconcile/deferred-items.md
  modified:
    - docs/output-catalog.md
    - docs/research/issue-103-stop-stopfailure-promotion.md

key-decisions:
  - "Chose Notification as the still-unsupported replacement event (the suite's canonical non-bucket-A example per D-87-06); any non-bucket-A event is contract-valid"
  - "Did NOT mark DOC-04/DOC-05 complete: plan 01 lands only the riders; the substantive reconcile of hooks-compatibility.md (DOC-04, plan 02) and claude-hooks-vs-pi-events.md (DOC-05, plan 03) is still pending"
  - "Preserved the D-89-06 nuance without writing the literal 0.80.4 (grep-zero requirement) by describing the unreleased patch as prose on the cost line"

patterns-established:
  - "Prose-vs-fenced-block byte-safety: single-token prose edits to output-catalog.md stay outside every <!-- catalog-state: --> fenced block; catalog-uat / hooks-cap-notify / partial-vocabulary-guard confirm no byte drift"

requirements-completed: []

coverage:
  - id: D1
    description: "output-catalog.md:390 partial-hook example re-points Stop -> Notification as the unsupportable-event example (D-89-07), byte-safe against the three coupled tests"
    requirement: ""
    verification:
      - kind: integration
        ref: "node --test tests/architecture/catalog-uat.test.ts tests/architecture/hooks-cap-notify.test.ts tests/architecture/partial-vocabulary-guard.test.ts (61 pass)"
        status: pass
      - kind: other
        ref: "grep -cF 'non-bucket-A event such as `Notification`' docs/output-catalog.md == 1; git diff shows a single one-token prose hunk, no fenced lines"
        status: pass
    human_judgment: false
  - id: D2
    description: "issue-103 doc agent_settled version corrected 0.80.4 -> 0.80.5 at all four sites; the npm-release nuance preserved; stale-doc inventory reconciled; line 73 classifier prose untouched (D-89-06)"
    requirement: ""
    verification:
      - kind: other
        ref: "grep -Ec '0\\.80\\.4' == 0 AND grep -Ec '0\\.80\\.5' == 4; cost line keeps >=0.74.0 from-side; diff hunks at 5-11/18/34/97-101 (line 73 untouched)"
        status: pass
    human_judgment: true
    rationale: "The nuance-preservation prose (CHANGELOG attributes to a patch npm never released; typings first ship in 0.80.5) and the reconciled-inventory reads are prose-quality judgment — the plan carries a <human-check> for exactly this. Confirmed at /gsd-verify-work."

# Metrics
duration: ~20min
completed: 2026-07-31
status: complete
---

# Phase 89 Plan 01: Version/example riders + byte-safety proof Summary

**Re-pointed the output-catalog partial-hook example off the now-supported `Stop` to `Notification` (byte-safe, three coupled tests green) and corrected the issue-103 authority doc's `agent_settled` attribution to the installable `0.80.5` floor at all four sites, nuance intact.**

## Performance

- **Duration:** ~20 min (includes the full `npm run check` green-bar run)
- **Started:** 2026-07-31T10:10Z (approx)
- **Completed:** 2026-07-31T10:29Z
- **Tasks:** 2
- **Files modified:** 2 (+1 created: deferred-items.md)

## Accomplishments
- D-89-07: `docs/output-catalog.md:390` partial-hook prose now names `Notification` (a still-unsupported, non-bucket-A event) instead of `Stop`, which Phase 87 promoted to bucket-A. Single inline-code token change, outside every byte-pinned fenced block.
- D-89-06: `docs/research/issue-103-stop-stopfailure-promotion.md` now attributes `agent_settled` to `0.80.5` at all four cited sites (executive summary, cost line, sources table, Pi API surface). Zero `0.80.4` strings remain anywhere in `docs/`.
- The version nuance is preserved on the cost line without re-introducing the stale literal: the upstream CHANGELOG labels a patch npm never released (0.80.3 → 0.80.5) and the typings first ship in 0.80.5, so `>=0.80.5` is the correct installable floor.
- The issue-103 doc's § "Stale-doc inventory" bullets were reconciled to read as done (DOC-04/DOC-05 described as reconciled, not dangling future-tense), keeping the pointer-target authority consistent for plans 02/03.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Re-point the output-catalog partial-hook example (D-89-07)** — `d703e97f` (docs)
2. **Task 2: Correct issue-103 version attribution to 0.80.5 + reconcile stale-doc inventory (D-89-06)** — `3fb242f2` (docs)

_The tracer feedback gate (autonomous): the tracer's `<verify>` — the three output-catalog-coupled tests plus the grep — was re-run end-to-end and passed before Task 2 began._

## Files Created/Modified
- `docs/output-catalog.md` — line 390 partial-hook prose: `Stop` → `Notification` (one token).
- `docs/research/issue-103-stop-stopfailure-promotion.md` — four `0.80.4` → `0.80.5` corrections (lines 8, 12, 21, 37) + two reconciled stale-doc-inventory bullets (lines 100-101).
- `.planning/phases/89-documentation-reconcile/deferred-items.md` — logged the pre-existing environmental integration failures (see Issues Encountered).

## Decisions Made
- **Notification** as the replacement event: it is the suite's canonical non-bucket-A drop example (D-87-06); any non-bucket-A event is contract-valid, so this is the low-surprise choice (research Assumptions Log A1).
- **DOC-04/DOC-05 NOT marked complete** in this plan (see Deviations) — those requirements are owned by plans 02 and 03, whose target docs are still untouched.
- Nuance-without-literal on the cost line to satisfy both the grep-zero requirement and the D-89-06 nuance.

## Deviations from Plan

### 1. [Scope decision] Did not mark DOC-04 / DOC-05 complete despite plan-01 frontmatter listing them
- **Found during:** State-update step.
- **Issue:** Plan 01's frontmatter carries `requirements: [DOC-04, DOC-05]`, but plan 01 only lands the two riders (D-89-06, D-89-07). The substantive DOC-04 reconcile (`docs/hooks-compatibility.md`) is plan 02 (`requirements: [DOC-04]`) and DOC-05 (`docs/research/claude-hooks-vs-pi-events.md`) is plan 03 (`requirements: [DOC-05]`); both target docs are still untouched.
- **Decision:** Left DOC-04/DOC-05 as Pending. Marking them complete now would falsely signal the two edit-target docs are reconciled. Plans 02/03 own the completion.
- **Impact:** Correctness-preserving; the final phase state is identical once 02/03 run. No scope creep.

## Issues Encountered

**Pre-existing, environmental integration-test failures (out of scope).** During the full `npm run check` green-bar run, 2 subtests in `tests/integration/skill-path-resolution.test.ts` failed (`resolveSkillsWithFallback must resolve the generated skill by name via the emitted skillPath`). Root cause: these subtests resolve the `pi-subagents` peer from the global npm install; the global `@earendil-works/pi-coding-agent` is `0.80.10` (drifted), and the tests are CI-skipped but fail locally on version mismatch — a documented environmental condition, not a branch regression. My commits touched only markdown docs, and the failing test reads neither edited doc — there is no causal path from a prose edit to skill resolution. Logged to `deferred-items.md`; not fixed (SCOPE BOUNDARY).

**Plan-relevant gate status:** the three `output-catalog.md`-coupled tests (`catalog-uat`, `hooks-cap-notify`, `partial-vocabulary-guard`) plus `typecheck`, `lint`, and `format:check` all passed. The docs edits are byte-safe.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The two authority/reference docs are consistent with shipped v1.16 Stop/StopFailure behavior, de-risking the larger reconciles.
- Plan 02 (DOC-04, `hooks-compatibility.md` full-doc audit) and plan 03 (DOC-05, `claude-hooks-vs-pi-events.md` correct-in-place) can proceed; neither is test-coupled.
- No blockers. The pre-existing skill-path-resolution integration failures are environmental and unrelated to this phase.

## Self-Check: PASSED

- Files verified present: `docs/output-catalog.md`, `docs/research/issue-103-stop-stopfailure-promotion.md`, `89-01-SUMMARY.md`, `deferred-items.md`.
- Commits verified in git log: `d703e97f`, `3fb242f2`.

---
*Phase: 89-documentation-reconcile*
*Completed: 2026-07-31*
