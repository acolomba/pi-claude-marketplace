---
phase: quick-260715-b9u
plan: 01
subsystem: edge
tags: [cli-flags, completions, drift-guard, single-source-of-truth]

# Dependency graph
requires:
  - phase: 80-remote-status
    provides: "list --remote filter bucket (RSTA-07) parsed by the handler"
  - phase: 81-fetch-verb
    provides: "info --fetch warm-cache flag (FTCH-03) parsed by the handler"
provides:
  - "edge/flag-catalog.ts: per-verb CLI flag single source of truth (parse + complete visibility bits)"
  - "flagCompletions, list.ts BOOLEAN_FLAGS, info.ts accepted-flag set all derive from the catalog"
  - "flag-catalog-drift.test.ts: exact-set drift guard reconciling catalog vs completion vs handler per verb"
  - "list --remote now offered by completion (RSTA-07 gap closed); info --fetch now offered (FTCH-03 gap closed)"
affects: [cli-completions, flag-parsing, future verb-flag additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-verb flag catalog with orthogonal parse/complete visibility bits; consumers derive their flag sets from it"
    - "Architecture drift guard reconciles a derived surface (handler BOOLEAN_FLAGS) against the catalog by exact set"

key-files:
  created:
    - extensions/pi-claude-marketplace/edge/flag-catalog.ts
    - tests/architecture/flag-catalog-drift.test.ts
  modified:
    - extensions/pi-claude-marketplace/edge/completions/provider.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
    - tests/edge/completions/provider.test.ts
    - tests/architecture/partial-vocabulary-guard.test.ts

key-decisions:
  - "Catalog models only per-verb EXTRA flags; --scope stays the hard-coded global base entry in flagCompletions (not per-verb, so excluded from catalog and both sides of the drift guard)"
  - "--local carries parse=true/complete=false so the parse-vs-complete divergence is expressed as a visibility bit, not drift"
  - "--remote description = 'Show remote plugins' (list-filter family parity with the (remote) bucket in orchestrators/plugin/list.ts)"
  - "--fetch description = 'Warm the plugin cache before showing info' (FTCH-03 warm-then-resolve semantics)"
  - "Drift guard drives the handler-side reconciliation off the exported list BOOLEAN_FLAGS so the parse-vs-catalog link is a real value comparison, not a tautology"

patterns-established:
  - "Single-source-of-truth catalog + exact-set architecture guard: adding a verb flag forces a catalog update in the same change or the build fails"

requirements-completed: [RSTA-07, FTCH-03, LIST-01, LIST-02, AG-7]

coverage:
  - id: D1
    description: "Per-verb flag catalog module (edge/flag-catalog.ts) with parse/complete visibility bits and derivation helpers"
    requirement: "LIST-01"
    verification:
      - kind: unit
        ref: "tests/architecture/flag-catalog-drift.test.ts#catalog vs handler: list BOOLEAN_FLAGS equals catalog list parse-set (--local excluded)"
        status: pass
      - kind: integration
        ref: "tests/architecture/import-boundaries.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "list -TAB offers --remote (RSTA-07 completion gap closed)"
    requirement: "RSTA-07"
    verification:
      - kind: unit
        ref: "tests/edge/completions/provider.test.ts#TC-3 / RSTA-07 :: list head flag completion is EXACTLY scope + the filter family incl. --remote"
        status: pass
    human_judgment: false
  - id: D3
    description: "info -TAB offers --fetch (FTCH-03 completion gap closed)"
    requirement: "FTCH-03"
    verification:
      - kind: unit
        ref: "tests/edge/completions/provider.test.ts#TC-3 / FTCH-03 :: info head flag completion is EXACTLY scope + fetch"
        status: pass
    human_judgment: false
  - id: D4
    description: "install/update -TAB completion byte-identical (exact-set): scope + map-model + partial only"
    requirement: "AG-7"
    verification:
      - kind: unit
        ref: "tests/edge/completions/provider.test.ts#TC-3 / AG-7 :: install head flag completion is EXACTLY scope + map-model + partial"
        status: pass
    human_judgment: false
  - id: D5
    description: "Exact-set drift guard fails the build if catalog, completion labels, or handler-accepted set diverge per verb"
    requirement: "LIST-02"
    verification:
      - kind: unit
        ref: "tests/architecture/flag-catalog-drift.test.ts#catalog vs completion: per-verb complete-set equals emitted labels (scope excluded)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-07-15
status: complete
---

# Phase quick-260715-b9u Plan 01: Flag-catalog SSOT for CLI flag parsing + completion Summary

**Collapsed the three unlinked per-verb flag copies (handler parse sets, completion candidates, USAGE) into one `edge/flag-catalog.ts` source of truth with parse/complete visibility bits, rewired flagCompletions + list.ts BOOLEAN_FLAGS + info.ts accepted-set to derive from it, and added an exact-set drift guard that closes the `list --remote` (RSTA-07) and `info --fetch` (FTCH-03) completion gaps.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-15T08:21:00Z (approx)
- **Completed:** 2026-07-15T12:45:00Z (wall clock includes long full-gate runs)
- **Tasks:** 3 (plus 1 deviation fix)
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `edge/flag-catalog.ts` is now the single source of truth for per-verb CLI flags, with orthogonal `parse`/`complete` visibility bits and two derivation helpers (`completionFlagEntries`, `parseFlagNames`).
- `flagCompletions`, list.ts `BOOLEAN_FLAGS`, and info.ts accepted-flag set all derive from the catalog — no independent flag copies remain (USAGE strings excepted, hand-written by design).
- `list -TAB` now offers `--remote` (RSTA-07 gap closed); `info -TAB` now offers `--fetch` (FTCH-03 gap closed). Every other verb's completion output is byte-identical, in identical label order.
- New `tests/architecture/flag-catalog-drift.test.ts` reconciles catalog complete-set vs emitted completion labels and catalog list parse-set vs the exported `BOOLEAN_FLAGS`, failing the build on any per-verb divergence.
- provider.test.ts TC-3 flag assertions tightened from inclusion-only to exact-set (sorted deepEqual).

## Task Commits

Each task was committed atomically (code + tests only; docs commit is the orchestrator's):

1. **Task 1: Create the per-verb flag catalog module** - `41e7b283` (feat)
2. **Task 2: Derive completion + handler flag sets from the catalog** - `7e009200` (refactor)
3. **Task 3: Add exact-set drift guard and tighten completion assertions** - `a8d7b037` (test)
4. **Deviation fix: police catalog completion descriptions** - `74534df4` (test) — see Deviations

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/flag-catalog.ts` - Per-verb flag catalog SSOT + `completionFlagEntries` / `parseFlagNames` helpers.
- `extensions/pi-claude-marketplace/edge/completions/provider.ts` - `flagCompletions` spreads catalog completion entries after the hard-coded `--scope` base entry; `ls`→`list` head mapping.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` - `BOOLEAN_FLAGS` derived from `parseFlagNames("list")`.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts` - accepted long-flag membership test derived from `parseFlagNames("info")`.
- `tests/architecture/flag-catalog-drift.test.ts` - exact-set drift guard (created).
- `tests/edge/completions/provider.test.ts` - TC-3 flag assertions tightened to exact-set incl. `list --remote` and `info --fetch`.
- `tests/architecture/partial-vocabulary-guard.test.ts` - D-75-01 guard repointed to police descriptions in their new catalog home (deviation).

## Decisions Made

- Catalog models only per-verb EXTRA flags; `--scope` stays the hard-coded global base entry in `flagCompletions` and is excluded from the catalog and both sides of the drift guard (it never varies per verb).
- `--local` is expressed as `parse=true / complete=false` so the intentional parse-vs-complete divergence is a visibility bit, not drift.
- New description wording confirmed against the codebase per the plan's flagged item: `--remote` → "Show remote plugins" (matches the `(remote)` bucket family in `orchestrators/plugin/list.ts`); `--fetch` → "Warm the plugin cache before showing info" (FTCH-03 warm-then-resolve semantics).
- The handler-side drift reconciliation is driven off the exported list `BOOLEAN_FLAGS` value so the parse-vs-catalog link is a genuine comparison (verified to bite by injecting a hard-coded divergence during development).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repointed the D-75-01 completion-description vocabulary guard**
- **Found during:** Full-gate `npm run check` after Task 3 (test `D-75-01 guard: completion-description extractor finds the --partial rows`).
- **Issue:** That guard's extractor scanned `provider.ts` for the `--partial` completion `description:` literals ("partially available", "unsupported components"). Task 2 moved those literals into `edge/flag-catalog.ts`, so the extractor matched zero rows and the sanity test failed.
- **Fix:** Added `edge/flag-catalog.ts` to `COMPLETION_DESCRIPTION_FILES` (so the plugin-level "unsupported" and retired-"force" prose guards still police the descriptions in their new home) and repointed the sanity extractor test at the catalog file.
- **Files modified:** tests/architecture/partial-vocabulary-guard.test.ts
- **Verification:** `node --test tests/architecture/partial-vocabulary-guard.test.ts` → 52/52 pass.
- **Committed in:** `74534df4`

---

**Total deviations:** 1 auto-fixed (1 blocking test breakage from the intended refactor).
**Impact on plan:** The fix preserves the guard's intent (descriptions are policed wherever they live) and is consistent with the single-source-of-truth goal. No scope creep.

## Issues Encountered

- The completion-side drift reconciliation (a) is partly tautological because both `getArgumentCompletions` and the catalog's `completionFlagEntries` derive from the same catalog. The real independent guard is the tightened exact-set provider.test.ts (hand-written expected label lists) plus the handler-side reconciliation (b), which was verified to fail on injected divergence. Documented in the drift-test header comment.

## Full Gate Result

`npm run check` (typecheck + ESLint + Prettier + `npm test` + `npm run test:integration`): GREEN. The lone pre-fix failure (`D-75-01 guard` sanity test) was resolved by the deviation fix above; the subsequent full-suite rerun showed 0 failures. (See Self-Check below for the confirming run.)

## Next Phase Readiness

- Flag catalog is the canonical home for CLI flags. Any future verb flag must be added to `edge/flag-catalog.ts` or the drift guard fails the build.
- USAGE strings remain hand-written by design (deriving them was out of scope); a future task could fold them into the catalog if desired.
- No blockers.

## Self-Check: PASSED

- Created files present: `edge/flag-catalog.ts`, `tests/architecture/flag-catalog-drift.test.ts`, this SUMMARY.
- Task commits present in git history: `41e7b283`, `7e009200`, `a8d7b037`, `74534df4`.

---
*Phase: quick-260715-b9u*
*Completed: 2026-07-15*
