---
phase: 90-session-environment-initialization
plan: 03
subsystem: api
tags: [resolver, reason-tokens, cross-surface-parity, install, typescript]

# Dependency graph
requires:
  - phase: 90-session-environment-initialization
    provides: "90-02 D-90-06 (bin install-by-default) + D-90-05 (unsupported component token); PENV-01 runtime PATH ledger"
provides:
  - "Arm-aware install reason classifier: narrowResolverReasons threads the partialable discriminant so a `contains <kind>` note renders {unsupported source} on the structural unavailable arm and routes per-kind ({unsupported component}) on the partially-available arm"
  - "SURF-01 cross-surface byte-parity invariant restored: install/list/info agree on the reason set for a structurally unavailable plugin carrying a non-carve-out contains-note"
  - "Note-axis unavailable-arm parity pin in cross-surface-reason-parity.test.ts (previously untested)"
affects: [91-hook-environment-parity, 92-mcp-staging-parity]

# Actuals (#2632)
actuals:
  tokens: 3600
  tasks: 2
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Arm discriminant threaded through a reason classifier (partialable boolean) to pick the correct closed-set token axis per resolver state"

key-files:
  created:
    - .planning/phases/90-session-environment-initialization/90-03-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
    - tests/orchestrators/plugin/install.test.ts

key-decisions:
  - "WR-01 Option 2 (single truthful axis): the structural unavailable arm keeps its {unsupported source} note-axis catch-all; only install's narrowResolverReasons became arm-aware. shared/probe-classifiers.ts is untouched."
  - "No REASONS token minted — both {unsupported source} and {unsupported component} already exist; the closed-set length lock stays 38."

patterns-established:
  - "Two-axis reason architecture (docs/output-catalog.md:1489): structural unavailable arm sources reasons via the note axis; the partially-available arm via the per-kind unsupported[] list. A classifier serving both arms must branch on the resolver-state discriminant, never special-case a renderer."

requirements-completed: [PENV-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "install's narrowResolverReasons is arm-aware (partialable discriminant): a `contains <kind>` note on the structural unavailable arm renders {unsupported source} byte-identically with list/info; the partially-available per-kind {unsupported component} axis is unchanged; closed-set length lock stays 38; shared/probe-classifiers.ts untouched."
    requirement: PENV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/cross-surface-reason-parity.test.ts (note-axis unavailable-arm parity + arm-threaded per-kind/multi-kind cases)"
        status: pass
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts (REASONS length lock =38) + catalog-uat.test.ts + partial-vocabulary-guard.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live-Pi G-90-3 retest of UAT Test 3: a bin-only plugin installs by default (no --partial, no (partially-available) row); a non-carve-out kind renders {unsupported component} on install/list/info; the both-defects case renders byte-identical {unsupported source} across surfaces."
    requirement: PENV-01
    verification:
      - kind: manual_procedural
        ref: ".planning/phases/90-session-environment-initialization/90-UAT.md Test 3 (result: pass, retested 2026-08-04)"
        status: pass
    human_judgment: true
    rationale: "Requires a running Pi session — install/list/info surface rendering and PATH honoring cannot be exercised by the unit suite; confirmed live by the operator (checkpoint approved)."

# Metrics
duration: 15min
completed: 2026-08-04
status: complete
---

# Phase 90 Plan 03: SURF-01 arm-aware install reason classifier + G-90-3 live retest Summary

**Made install's `narrowResolverReasons` arm-aware (partialable discriminant) so a `contains <non-carve-out-kind>` note renders `{unsupported source}` byte-identically across install/list/info on the structural unavailable arm, restoring the SURF-01 cross-surface reason-parity invariant without minting a closed-set token; live-Pi G-90-3 retest confirmed passing.**

## Performance

- **Duration:** ~15 min (continuation session; Task 1 executed in a prior session)
- **Completed:** 2026-08-04
- **Tasks:** 2 (1 code TDD tracer + 1 human-verify checkpoint)
- **Files modified:** 3 code/test + 2 planning docs

## Accomplishments

- Added a `partialable: boolean = false` arm discriminant to install's `narrowResolverReasons`; the `contains <kind>` note handler now pushes `{unsupported source}` on the structural `unavailable` arm (mirroring `classifyResolverNote`'s catch-all) and routes through `narrowUnsupportedKinds` (→ `{unsupported component}`) only on the partially-available arm. Production call site passes `err.shape.partialable`.
- Pinned the previously-untested note-axis unavailable-arm agreement: for `["malformed mcp reference: ...", "contains monitors"]` both `narrowResolverNotes(...)` and `__test_narrowResolverReasons(..., [], false)` return `["malformed mcp", "unsupported source"]` byte-identically; added a `PARITY_CASES` row `{ contains monitors → unsupported source }` and threaded the arm discriminant through `PER_KIND_PARITY_CASES` / multi-kind cases.
- `shared/probe-classifiers.ts` untouched (90-02 prohibition honored); `probe-classifiers` reason axis unchanged; REASONS closed-set length lock stays 38 (no token minted).
- Closed the G-90-3 loop: live-Pi retest passed (bin-only installs by default; non-carve-out kind → `{unsupported component}` on install/list/info; both-defects case → byte-identical `{unsupported source}`). UAT Test 3 `issue → pass`, gap `resolved`, debug session moved to `.planning/debug/resolved/`.

## Task Commits

1. **Task 1 (RED): pin structural-arm note-axis reason parity (SURF-01)** — `333f30e6` (test)
2. **Task 1 (GREEN): make install reason classifier arm-aware (SURF-01 / WR-01 Option 2)** — `8085c6d7` (fix)
3. **Checkpoint position recorded (paused at Task 2)** — `9c0ce500` (docs)
4. **G-90-3 live retest pass + debug session closed** — `7d98d1b7` (test)

**Plan metadata:** _(this SUMMARY + STATE + ROADMAP)_ — `docs(90-03): complete plan`

_Note: Task 1 is a TDD tracer — RED (test) then GREEN (fix) commits._

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — `narrowResolverReasons` gains the `partialable` arm discriminant; `contains <kind>` handler branches on the arm; call site passes `err.shape.partialable`.
- `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` — note-axis unavailable-arm parity pin + `PARITY_CASES` row + arm-threaded per-kind/multi-kind cases.
- `tests/orchestrators/plugin/install.test.ts` — 3 pre-existing cases updated (they encoded pre-fix behavior); see Deviations.
- `.planning/phases/90-session-environment-initialization/90-UAT.md` — Test 3 `issue → pass`, Summary 3/0, G-90-3 `resolved`, frontmatter `resolved`.
- `.planning/debug/resolved/bin-unsupported-classification.md` — moved from `.planning/debug/` with a `## Resolution` section.

## Decisions Made

- **WR-01 Option 2 (single truthful axis):** the structural `unavailable` arm keeps its `{unsupported source}` note-axis catch-all; the component-axis `{unsupported component}` token belongs to the partially-available arm only (D-64-07 structural precedence). Option 1 (adding a `contains <kind>` arm to `classifyResolverNote`) was rejected — it would violate the 90-02 prohibition and leak the component-axis token onto the structural arm.
- **No REASONS token minted** — both tokens already exist; closed-set length lock stays 38 (`_ReasonsCoverageProof` stays total).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `install.test.ts` updated but absent from `files_modified`**
- **Found during:** Task 1 (GREEN)
- **Issue:** Three pre-existing `install.test.ts` cases encoded the pre-fix behavior (a `contains <kind>` note on the structural arm expecting `{unsupported component}`). The plan's `files_modified` listed only `install.ts` and `cross-surface-reason-parity.test.ts`, so this file was under-specified.
- **Fix:** Updated the three cases to the corrected arm-aware expectation (`{unsupported source}` on the structural arm). Behavior change is the intended SURF-01 fix, not a test-loosening.
- **Files modified:** `tests/orchestrators/plugin/install.test.ts`
- **Verification:** `npm run check` green; full `npm test` 3234 pass / 1 skip / 0 fail.
- **Committed in:** `8085c6d7` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug — under-specified `files_modified`).
**Impact on plan:** Necessary to make the SURF-01 fix consistent across the install test surface. No scope creep — `shared/probe-classifiers.ts` untouched, no token minted.

## Issues Encountered

- **Pre-existing environment failure (not a regression, deferred):** two `pi-subagents` global-peer integration tests in `tests/integration/skill-path-resolution.test.ts` fail locally against a stale global peer install; they skip in CI (peer absent) and pass on a fresh global peer. Unrelated to the install reason-classifier change. Recorded in `deferred-items.md`; not chased.

## Task 2 Checkpoint Resolution

- **Type:** `checkpoint:human-verify` (gate=blocking), G-90-3 live-Pi retest of UAT Test 3.
- **Outcome:** Operator performed the live retest and approved. All three behaviors held: (1) a bin-only plugin installs by DEFAULT with no `--partial` and no `(partially-available)` row; (2) a non-carve-out unsupported kind renders `{unsupported component}` on install/list/info; (3) the SURF-01 both-defects case renders byte-identical `{unsupported source}` across surfaces.
- **Recorded:** UAT Test 3 → `pass`, G-90-3 → `resolved`, debug session closed.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — FOUND (arm-aware `narrowResolverReasons`, commit `8085c6d7`)
- `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` — FOUND (parity pins, commits `333f30e6`/`8085c6d7`)
- Commit `333f30e6` — FOUND
- Commit `8085c6d7` — FOUND
- Commit `9c0ce500` — FOUND
- Commit `7d98d1b7` — FOUND
- `.planning/debug/resolved/bin-unsupported-classification.md` — FOUND (moved, Resolution section appended)

## Next Phase Readiness

- Phase 90 gap-closure complete (all 3 plans executed, G-90-3 / SURF-01 resolved). Ready for phase re-verification (`/gsd-verify-work 90` deferred-verification entry).
- Phase 91 (hook environment parity) leans on the shared session-env groundwork established in 90-01; no blockers from this plan.

---
*Phase: 90-session-environment-initialization*
*Completed: 2026-08-04*
