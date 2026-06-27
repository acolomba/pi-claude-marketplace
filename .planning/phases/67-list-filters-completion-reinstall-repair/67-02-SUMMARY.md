---
phase: 67-list-filters-completion-reinstall-repair
plan: 02
subsystem: api
tags: [list, filters, cli, flags, completion, edge-handler, orchestrator]

# Dependency graph
requires:
  - phase: 66-derived-force-state-glyphs
    provides: "the derived force-installed / force-upgradable render statuses the widened --installed spans"
  - phase: 67-list-filters-completion-reinstall-repair
    plan: 01
    provides: "reinstall --force retirement (merged base for this wave)"
provides:
  - "list --unsupported filter: NOT-installed plugins that resolve unsupported, keyed on an internal resolver-state bucket (the row still renders the (unavailable) token)"
  - "list --installed widened to span installed + force-installed + force-upgradable (all installed-inventory render statuses)"
  - "list --unavailable narrowed to structural-unavailable only (clean four-way partition; no --upgradable filter)"
  - "completion provider surfaces --unsupported under the list/ls heads"
affects: [list-filters-completion, force-install-severity, prd-section-11-reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Internal resolver-state bucket: availableRowMessage returns { message, bucket } so the filter keys on the pre-collapse classification (available | unsupported | unavailable) without changing the rendered (unavailable) token"
    - "Data-driven edge flag scan: the list handler recognizes filter flags via the exported BOOLEAN_FLAGS set instead of a per-flag parse branch (keeps each new filter a one-line set + spread change)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
    - extensions/pi-claude-marketplace/edge/completions/provider.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/edge/handlers/plugin/list.test.ts
    - tests/edge/completions/provider.test.ts
    - docs/output-catalog.md

key-decisions:
  - "--unsupported keys on an internal FilterBucket (available | unsupported | unavailable | installed-inventory) threaded from availableRowMessage to shouldShow, NOT on the render status -- because availableRowMessage collapses both resolver unsupported and structural unavailable into the same (unavailable) token (D-64-01). No new render status; closed-set tripwire stays 22/17/7."
  - "Installed-inventory rows pass the installed-inventory bucket and are matched by render status; the resolver bucket is only consulted for not-installed rows."

patterns-established:
  - "Pattern: when a render token is many-to-one over the underlying classification, thread the pre-collapse bucket alongside the render status to the filter predicate instead of splitting out a new render status"

requirements-completed: [LIST-01]

# Metrics
duration: 13min
completed: 2026-06-27
---

# Phase 67 Plan 02: List --unsupported Filter & Widened --installed Summary

**`list --unsupported` now selects not-installed plugins that resolve `unsupported` (keyed on an internal resolver-state bucket so the row keeps its `(unavailable)` byte form), `--installed` spans the full installed inventory including the derived force states, and `--unavailable` narrows to structural-unavailable only -- a clean four-way partition with no `--upgradable` filter and no rendered byte change.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-06-27T21:37:50Z
- **Completed:** 2026-06-27T21:50:20Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added a `FilterBucket` (`installed-inventory | available | unsupported | unavailable`) and threaded it from `availableRowMessage` (now returning `{ message, bucket }`) to a widened `shouldShow(opts, status, bucket)`. The bucket derives from the existing `switch (resolved.state)` WITHOUT changing the returned row's render status, so a not-installed `unsupported` plugin still emits the `(unavailable)` token.
- Added `ListPluginsOptions.unsupported` and widened `filtersPassive` with `&& opts.unsupported !== true`.
- In `shouldShow`: widened the `--installed` arm to admit `force-installed` + `force-upgradable` (A1); added the `--unsupported` arm keyed on bucket `unsupported`; narrowed the `--unavailable` arm to bucket `unavailable` only (A2). Updated the `PluginRenderStatus` doc comment (the force-state "later phase" note is now this phase).
- Edge handler: `--unsupported` added to `BOOLEAN_FLAGS`, USAGE (`[--unsupported]`), and the forwarding spread; the flag parse loop was refactored to a data-driven `BOOLEAN_FLAGS.has(token)` scan.
- Completion provider surfaces `--unsupported` under the `list` / `ls` heads.
- Docs: `output-catalog.md` gained list-filter prose for the four-way partition (D-67-04); no `catalog-state` block, no rendered byte change.
- `npm run check` green; closed-set tripwire unchanged at 22 / 17 / 7.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add --unsupported / widened --installed filter tests (RED)** - `bdea06cc` (test)
2. **Task 2: Thread the resolver bucket to shouldShow; add --unsupported, widen --installed, narrow --unavailable** - `26ba37d6` (feat)
3. **Task 3: List-filter prose docs lockstep + full-suite byte gate** - `c07852a3` (docs)

**Plan metadata:** committed separately with this SUMMARY.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - New `FilterBucket` type; `availableRowMessage` returns `{ message, bucket }`; `shouldShow` takes the bucket and implements the LIST-01 / D-67-01 partition (widened `--installed`, new `--unsupported`, narrowed `--unavailable`); `ListPluginsOptions.unsupported`; widened `filtersPassive`; updated `PluginRenderStatus` doc comment.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` - `--unsupported` in `BOOLEAN_FLAGS` + USAGE + forwarding spread; data-driven flag scan keyed on `BOOLEAN_FLAGS`.
- `extensions/pi-claude-marketplace/edge/completions/provider.ts` - `--unsupported` flag completion under the `list` / `ls` heads.
- `tests/orchestrators/plugin/list.test.ts` - Five LIST-01 / D-67-01 partition tests (not-installed unsupported, structural unavailable, force-installed, force-upgradable, passive byte-stability).
- `tests/edge/handlers/plugin/list.test.ts` - `--unsupported` propagation + unknown-flag-error-with-USAGE-carries-`[--unsupported]` tests.
- `tests/edge/completions/provider.test.ts` - `--unsupported` added to the list/ls flag-set expectations and the install/update must-not-leak guards.
- `docs/output-catalog.md` - List-filter prose paragraph under `## /claude:plugin list`.

## Decisions Made

- The `--unsupported` / `--unavailable` split keys on an internal resolver-state **bucket**, not the render token, because `availableRowMessage` collapses both resolver `unsupported` and structural `unavailable` into the same `(unavailable)` row (D-64-01). This resolves the phase's biggest open design point (67-PATTERNS §A) WITHOUT introducing a new render status, so the closed-set tripwire stays 22/17/7 and no rendered byte changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RED tests had substring-collision assertions**
- **Found during:** Task 2 (GREEN run)
- **Issue:** Two negative assertions used bare plugin names that are substrings of rendered tokens: `out.includes("avail")` false-positived on `(unavailable)`, and `out.includes("unsup")` false-positived on the `{unsupported source}` reason.
- **Fix:** Renamed the available fixture plugin `avail` -> `clean`, and tightened the `unsup` negative assertions to the row token `unsup v1.0.0`.
- **Files modified:** tests/orchestrators/plugin/list.test.ts
- **Committed in:** 26ba37d6 (folded into the Task 2 commit, since it is a correction to the same-feature RED tests)

**2. [Rule 3 - Blocking] provider.ts source edit required for the planned provider test to pass**
- **Found during:** Task 2
- **Issue:** The plan directed adding `--unsupported` to the `provider.test.ts` list-flag-set expectation and required that test GREEN after Task 2, but `provider.ts` (the source that hardcodes the list completion flags) was not in the plan's `files_modified`. The test cannot pass unless the provider emits the flag.
- **Fix:** Added `{ name: "--unsupported", description: "Show unsupported (not-installed) plugins" }` to the `list`/`ls` flag completions. Within LIST-01 scope (the list filter surface).
- **Files modified:** extensions/pi-claude-marketplace/edge/completions/provider.ts
- **Committed in:** 26ba37d6

**3. [Rule 3 - Blocking] Edge handler cognitive complexity tripped ESLint**
- **Found during:** Task 2 (pre-commit)
- **Issue:** Adding the `--unsupported` `else if` branch pushed `makeListHandler`'s cognitive complexity to 16 (limit 15), failing `sonarjs/cognitive-complexity`.
- **Fix:** Refactored the per-flag `if/else if` chain into a data-driven scan over the already-exported `BOOLEAN_FLAGS` set (`filterFlags.has(...)` at the spread). Complexity drops below the limit and each future filter becomes a one-line change.
- **Files modified:** extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
- **Committed in:** 26ba37d6

### Documented No-ops

**4. [Note - No-op] router.test.ts and messaging-style-guide.md needed no change**
- **router.test.ts** is in the plan's `files_modified`, but the `TOP_LEVEL_USAGE` list line (`list [<marketplace>] [--scope user|project]`) does not enumerate the boolean filter flags, so there is no `[--unsupported]` to add there (the plan's directive was conditional: "if router.test.ts asserts a list usage line").
- **messaging-style-guide.md** does not enumerate CLI list filters (it documents the `notify()` rendering contract / status tokens), so the lockstep D-67-04 doc update lands entirely in `output-catalog.md`.

---

**Total deviations:** 1 test bug + 2 blocking fixes auto-fixed; 2 documented no-ops
**Impact on plan:** All fixes necessary to keep `npm run check` green and to satisfy the plan's own acceptance criteria (the provider flag-set GREEN gate). No scope creep -- every touched file is within the LIST-01 list-filter surface.

## Closed-set tripwire evidence

- `tests/architecture/notify-closed-set-locks.test.ts` passes: `STATUS_TOKENS.length === 22`, `PLUGIN_STATUSES.length === 17`, `MARKETPLACE_STATUSES.length === 7`. No token bump (none expected for 67-02 -- the filter keys on an internal bucket, not a new render token).
- `tests/architecture/catalog-uat.test.ts` and `tests/architecture/no-orchestrator-network.test.ts` green (no rendered-byte drift; the bucket reuses the existing no-network `resolveStrict`, NFR-5).
- `npm run check` exits 0 (typecheck + ESLint + Prettier + tests + integration).

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The four list filters partition cleanly. The internal `FilterBucket` classification is the same Phase 66 derived-state read that the LIST-02 completion candidate sets will reuse (D-67-02), so the next plan can source `available + unsupported` / `upgradable + force-upgradable` from the list orchestrator's classifier rather than a second classifier.

## Self-Check: PASSED

- `.planning/phases/67-list-filters-completion-reinstall-repair/67-02-SUMMARY.md` exists.
- Task commits `bdea06cc` (test), `26ba37d6` (feat), `c07852a3` (docs) exist in history.
- All seven modified files verified present on disk.

---
*Phase: 67-list-filters-completion-reinstall-repair*
*Completed: 2026-06-27*
