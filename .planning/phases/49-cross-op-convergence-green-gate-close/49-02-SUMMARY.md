---
phase: 49-cross-op-convergence-green-gate-close
plan: 02
subsystem: notify
tags: [probe-classifiers, narrowProbeError, invalid-manifest, catalog-uat, cross-surface-parity]

# Dependency graph
requires:
  - phase: 48-marketplace-add-attribution
    provides: InvalidMarketplaceManifestError typed error + classifyAddError write-path `invalid manifest` mapping (the parity target)
  - phase: 49-01
    provides: prior wave of the cross-op convergence close (committed)
provides:
  - "narrowProbeError classifies a schema-invalid InvalidMarketplaceManifestError (no SyntaxError cause) as `invalid manifest` -- read/write cross-surface parity for the same on-disk condition"
  - "The malformed-JSON `{unparseable}` arm collapsed into the single InvalidMarketplaceManifestError branch and preserved (cause IS SyntaxError)"
  - "Widened narrowProbeError return-type union threaded through ListReason; info.ts consumers compile with no casts"
  - "A marketplace-info `manifest-invalid` catalog state + paired catalog-uat fixture byte-locking the `{invalid manifest}` read-surface form"
affects: [49-03, milestone-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closed-set probe classifier widening via a single typed-error branch with an Error.cause ternary (malformed-JSON => unparseable; schema-invalid => invalid manifest)"
    - "Byte-additive catalog supersession: new read-surface state lands WITH its fixture and prose in one independently-GREEN change"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/list.test.ts

key-decisions:
  - "Schema-invalid manifest -> `invalid manifest` on read surfaces (D-48-B IN-02 close): the user-facing reason describes the manifest's state, identical regardless of read vs write -- the prior `{unreadable}` asymmetry was a leak of the classifier's internal ladder."
  - "No new REASONS member -- `invalid manifest` was already member of the 29-tuple and a ContentReason; the change is a classifier widening, not a vocabulary addition."
  - "Catalog `manifest-invalid` byte body authored to match the REAL render of buildManifestFailureMessage (componentsResolved:false emits the `components: not resolved` 4-space line), not the plan's illustrative two-line sketch."

patterns-established:
  - "Pattern: collapse two adjacent typed-error arms into one `instanceof` branch + an Error.cause ternary when they share a parent error type but diverge on cause shape."

requirements-completed: []

# Metrics
duration: ~18min
completed: 2026-06-08
---

# Phase 49 Plan 02: Cross-Surface Manifest Reason Parity (IN-02 Close) Summary

**`narrowProbeError` now maps a schema-invalid `InvalidMarketplaceManifestError` to `{invalid manifest}` on the read-only `marketplace info` / `plugin info` / `list` surfaces -- parity with the `marketplace add` write path -- while preserving `{unparseable}` for malformed JSON, with the new read-surface byte form catalog-documented and fixture-locked.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-06-08
- **Tasks:** 2 (both `auto`, Task 1 `tdd`)
- **Files modified:** 6

## Accomplishments

- **Task 1 (classifier widening):** Collapsed the two manifest arms of `narrowProbeError` into a single `InvalidMarketplaceManifestError` branch returning `err.cause instanceof SyntaxError ? "unparseable" : "invalid manifest"`. Kept the bare-`SyntaxError` arm at the top and the EACCES/EPERM, ENOENT/ENOTDIR, and generic `unreadable` fallback arms untouched. Widened the return-type union to `"invalid manifest" | "permission denied" | "source missing" | "unparseable" | "unreadable"` and threaded `"invalid manifest"` into `list.ts`'s `ListReason` union. `info.ts` consumers (`marketplace/info.ts::buildManifestFailureMessage`, `plugin/info.ts`'s `readonly ContentReason[]` sites) accept the widened return with NO casts -- verified by `npm run typecheck` exit 0.
- **Task 2 (catalog + fixtures + unit cases):** Added a `manifest-invalid` catalog state to the `marketplace info <name>` section documenting the `{invalid manifest}` read-surface byte form, paired with a `kind:"plugin-info"` fixture in `catalog-uat.test.ts` (status `failed`, reasons `["invalid manifest"]`, `componentsResolved:false`). Added four `__test_narrowProbeError` unit cases (two per read-surface test file) asserting schema-invalid -> `invalid manifest` and malformed-JSON -> `unparseable`.

## Task Verification

1. **Task 1: Widen narrowProbeError + thread the return type** - committed by orchestrator (test → feat collapsed; byte-additive, independently GREEN)
   - `node --test tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/list.test.ts` -> 67 pass / 0 fail (was 63; +4 cases)
   - `npm run typecheck` -> exit 0 (consumers compile without casts)
2. **Task 2: Read-surface unit cases + marketplace-info manifest-invalid catalog state + fixture** - committed by orchestrator
   - `node --test tests/architecture/catalog-uat.test.ts tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/list.test.ts` -> 70 pass / 0 fail

**Plan metadata:** committed by orchestrator

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` - Collapsed the manifest arms into one `InvalidMarketplaceManifestError` branch with a cause ternary; widened the `narrowProbeError` return-type union to add `"invalid manifest"`; updated the docstring ladder (cites D-48-B IN-02 + SC#1 manifest cross-surface parity).
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - Added `"invalid manifest"` to the local `ListReason` union so the `sharedNarrowProbeError` wrapper's widened return is assignable; comment updated.
- `docs/output-catalog.md` - Added the `manifest-invalid` catalog state block to the `marketplace info <name>` section (prose + `<!-- catalog-state: manifest-invalid -->` discriminator + 3-line byte body); updated the section severity-routing note to include the new error state.
- `tests/architecture/catalog-uat.test.ts` - Added the `manifest-invalid` fixture under the `"/claude:plugin marketplace info <name>"` outer key (mirrors `buildManifestFailureMessage`, `expectedSeverity: "error"`).
- `tests/orchestrators/plugin/info.test.ts` - Added `InvalidMarketplaceManifestError` import + two `__test_narrowProbeError` cases (schema-invalid -> invalid manifest; malformed-JSON -> unparseable).
- `tests/orchestrators/plugin/list.test.ts` - Same two unit cases + import (import placed after `state-io.ts` to satisfy `import-x/order`).

## Decisions Made

- See `key-decisions` frontmatter. Notably: the catalog byte body for `manifest-invalid` includes the `    components: not resolved` 4-space line because `buildManifestFailureMessage` sets `componentsResolved:false`, which the `renderPluginInfo` `case false:` arm renders. The plan's illustrative example was a two-line sketch; per the plan's own instruction ("author the catalog body to match the fixture's render"), the catalog matches the real render.

## Deviations from Plan

None - plan executed exactly as written. (One small in-scope adjustment within Task 2: the catalog byte body was authored to include the `components: not resolved` line to match the actual `buildManifestFailureMessage` render, exactly as the plan's `<action>` directed -- "Determine the EXACT bytes by reading renderPluginInfo... author the catalog body to match the fixture's render." This is the plan's intended authoring discipline, not a deviation.)

## Issues Encountered

- **Initial catalog byte mismatch:** the first catalog body omitted the `    components: not resolved` line; catalog-uat flagged the byte mismatch. Resolved by reading the actual render (`renderPluginInfo` `componentsResolved:false` arm) and authoring the catalog body + prose to match. catalog-uat then GREEN.
- **Lint import-order:** the new `errors.ts` import in `list.test.ts` violated `import-x/order` (shared/ must follow persistence/). Reordered; `npm run check` GREEN.

## Final Gate

- `npm run check` -> **exit 0** (typecheck + eslint + prettier format:check + 1507 tests pass / 0 fail). Test count 1502 -> 1507 (+4 classifier unit cases, +1 catalog state).
- `pre-commit run mdformat --files docs/output-catalog.md` -> Passed (no reformat); catalog-uat re-confirmed GREEN.
- `docs/output-catalog.md` diff stat: 1 file changed, 13 insertions(+), 1 deletion(-).
- REASONS still **29** members (no new member; `invalid manifest` was already present).

## Self-Check

- Files modified all present on disk (verified by edits succeeding + check run).
- Nothing committed by this executor (orchestrator owns commits); `.planning/STATE.md` and `.planning/ROADMAP.md` untouched by this executor (STATE.md's working-tree modification predates this plan -- it is the orchestrator's execution-start record).

## Next Phase Readiness

- Plan 49-03 (cross-op convergence breadth matrix + SC#3 inverse-walk + traceability/close) can build on this: `invalid manifest` read-surface parity is locked. The `manifest-invalid` fixture is catalog-paired (passes the existing catalog->fixture walk); when 49-03 adds the FIXTURES->catalog inverse-walk assertion, this entry will satisfy it.

---
*Phase: 49-cross-op-convergence-green-gate-close*
*Completed: 2026-06-08*
