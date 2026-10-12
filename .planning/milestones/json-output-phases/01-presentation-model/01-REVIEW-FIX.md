---
phase: 01-presentation-model
fixed_at: 2026-10-01T16:45:08Z
review_path: .planning/phases/01-presentation-model/01-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-10-01T16:45:08Z
**Source review:** .planning/phases/01-presentation-model/01-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 6 (WR-01 and IN-01 through IN-05)
- Fixed: 6
- Skipped: 0

This report addresses the six findings in the current incremental review.
The seven findings covered by the previous report remain in git history.

## Fixed Issues

### WR-01: The merged `marketplace add` leftover advisory is redacted and indented in the orchestrator, not in the resolve step

**Status:** fixed
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`, `extensions/pi-claude-marketplace/shared/notification-summary.ts`, `tests/shared/notification-summary.test.ts`, `scripts/check-unused-type-members.contracts.json`
**Commit:** ffbfec7a
**Applied fix:** Selected the review's minimum presentation-layer fix.
`composeLeftoverRemovalAdvisories` owns path redaction and indentation beside
the retained-workflow advisory composer. The orchestrator identifies the
cleanup error and passes its leak to that composer. A direct test pins the
complete advisory line. The new import moved the `isInfoKind` contract pin
from line 41 to line 43; both its declaration and filter pins were updated.

The advisory remains a formatted string under the existing presentation
contract. This fix moves its composition out of the orchestrator; it does
not introduce a typed leak member on the marketplace row.

### IN-01: The strict corpus hook still misses some `notify` spellings, and it rewrites inside string literals

**Status:** fixed
**Files modified:** `scripts/notify-corpus.hook.mjs`, `scripts/notify-corpus.negative.mjs`
**Commit:** a5ab3b9c
**Applied fix:** Selected the review's documentation option. The hook now
states that its refusal applies to exact `ui.notify(` spellings. It explicitly
records the optional-chain, whitespace, `.call`, and destructured-function
limits, plus the risk of rewriting matching text inside strings and templates.
The Control 6 comment describes that same boundary.

The hook remains a raw-text rewrite. Its documented restrictions still apply
to future source edits.

### IN-02: `capture --files` with no values silently captures the whole suite

**Status:** fixed: requires human verification
**Files modified:** `scripts/notify-corpus.mjs`, `scripts/notify-corpus.negative.mjs`
**Commit:** be5f6855
**Applied fix:** Capture rejects an explicitly empty `--files` list and
unknown flags before starting a test run. Negative controls cover empty lists
before and after `--out`, an unknown flag interrupting a file list, and an
unknown short flag. They assert the complete error and confirm the existing
capture remains unchanged. The existing argument-order controls still pass.

The status flags the parser logic for review under the fixer's verification
policy; the focused negative controls passed.

### IN-03: The SC-5 context scan doc says an unexported pin is labelled `(unexported)`, but it can take a preceding export's name

**Status:** fixed: requires human verification
**Files modified:** `tests/architecture/soft-dep-marker-policy.test.ts`
**Commit:** 018cd502
**Applied fix:** Each pin takes the last top-level const declaration before
it, including that declaration's export status. An unexported context carries
its own name with an `(unexported)` prefix. A planted control places an
unexported context after an exported render map and asserts the complete
discovered label list. The doc also states the trailing-comment limitation:
only block and whole-line comments are removed by the shared text scanner.

The status flags the labeling logic for review under the fixer's verification
policy; all 23 architecture cases passed.

### IN-04: Comments next to the IN-01 edits still describe removed or incomplete surfaces

**Status:** fixed
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts`
**Commit:** 24f57967
**Applied fix:** The update comment includes `declaresWorkflows` and
`{requires pi-dynamic-workflows}`. Marketplace-list comments name
`notifyWithContext`, `LIST_CONTEXT`, the cascade emitter's empty sentinel, and
resolve's reload-hint computation. These edits change comments only.

### IN-05: `installedLikeRow` takes `reasons` as a separate parameter, which the D-13 refusal does not cover

**Status:** fixed
**Files modified:**

- `extensions/pi-claude-marketplace/shared/notification-grammar.ts`
- `extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts`
- `tests/shared/notification-grammar.test.ts`
- `scripts/check-unused-type-members.contracts.json`

**Commit:** 7e953528
**Applied fix:** `installedLikeRow` reads `p.reasons` from the guarded row.
Its separate reasons parameter is removed, and all seven production callers
use the five-argument signature. The direct byte assertion passes its reasons
on the row. The `dependencies?: never` exception remains at line 615.
Formatting moved two other contract locations: `DISABLE_RENDER` from 103 to
96, and the reinstall manual-recovery type guard from 218 to 211. Their pins
were updated to the actual declarations.

## Verification

All verification ran in the assigned `features/json` checkout at
`/home/acolomba/src/pi-claude-marketplace-json`. A briefly created, unused
nested review-fix worktree and its branch were removed before source edits;
no verification ran there.

- Re-read each changed section and checked the final diffs.
- WR-01: notification-summary and marketplace-add suites passed, 125 tests.
  The sandboxed marketplace suite initially failed without useful diagnostics;
  the run with required filesystem/process permissions passed.
- IN-03: the marker-policy architecture suite passed, 23 tests.
- IN-05: notification-grammar and all seven changed messaging suites passed,
  244 tests.
- Corpus scripts passed `node --check`. `node scripts/notify-corpus.negative.mjs`
  passed, including the four new malformed-argument controls.
- Required pre-commit hooks passed before the scoped commits: formatting,
  lint, typecheck, Fallow, changed-pair direct coverage, type-member analysis,
  and type-member negative controls where selected by the file rules.
  `SKIP=trufflehog` followed the repository's worktree rule.
- The initial WR-01 type-member run found the shifted `isInfoKind` pin; it
  was corrected. Early concurrent edits invalidated the pre-commit snapshots
  for WR-01's member hook and IN-01/IN-03's lint hook. The affected lint hook
  was rerun on the stable tree; the whole-project member hook passed on the
  stable tree in the subsequent IN-03 and IN-04 runs. WR-01's negative
  controls also passed. No source edits ran during the final IN-02/IN-05 gates,
  which both completed with exit 0.
- A fresh `fallow audit --format json --quiet --explain --gate-marker agent`
  ran before every commit. Every verdict was `warn`, with no blocking error.
- CodeGraph and direct searches traced the callers before signature changes.
  Fallow's type-aware symbol-impact query timed out; caller tracing did not
  rely on that incomplete result.

The parent workflow owns the full `npm run check`, corpus re-diff, verification
refresh, and documentation commit. This fixer leaves the report uncommitted.
The parent's intentional `.planning/active-workstream` deletion was not staged
by any fix commit.

---

_Fixed: 2026-10-01T16:45:08Z_
_Fixer: Codex (gsd-code-fixer)_
_Iteration: 1_
