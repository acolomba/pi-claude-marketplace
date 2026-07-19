---
phase: 69-force-path-severity
plan: 01
subsystem: api
tags: [notify, severity, resolver, error-shape, force-install, output-catalog]

# Dependency graph
requires:
  - phase: 64-resolver-three-way-state
    provides: the installable/unsupported/unavailable three-way discriminant and the requireInstallable / requireForceInstallable gates
  - phase: 65-force-install-update
    provides: D-65-01 deferral of the --force pointer message that this plan completes
provides:
  - forceable discriminant on the not-installable / no-longer-installable PluginShapeError variants
  - resolver throw sites stamp forceable from r.state === unsupported
  - install no-force failure renders a --force hint trailer on the force-degradable unsupported arm only
  - failure-structural-unavailable catalog state proving the structural arm stays byte-frozen
affects: [70-spec-documentation-reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-way error conditioning: thread a typed discriminant through the thrown shape, never substring-match .message"
    - "Render-row trailer for conditional hints: optional message field consumed by composePluginLinesWith, REASONS tuple untouched"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/plugin/install.test.ts

key-decisions:
  - "Hint renders as a 4-space trailer line (RESEARCH A2), not a new REASONS member -- closed-set counts stay 22/17/7"
  - "Structural unavailable arm kept byte-frozen at info severity (no hint, no summary prefix) per the orchestrator byte-freeze constraint; final severity reconcile deferred to the DOC pass"

patterns-established:
  - "PluginUnavailableMessage.forceHint optional field drives a conditional --force trailer in composePluginLinesWith"

requirements-completed: [SEV-02]

# Metrics
duration: ~40min
completed: 2026-06-28
---

# Phase 69 Plan 01: Force-Path Severity (SEV-02) Summary

**The no-force install failure now points at `--force` exactly on the force-degradable `unsupported` arm via a typed `forceable` discriminant threaded from the resolver throw to the rendered row, while the structural `unavailable` arm stays byte-frozen.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-06-28
- **Tasks:** 2
- **Files modified:** 7 (4 source, 1 doc, 2 test) plus 3 additional test files updated for the new required `forceable` constructor field

## Accomplishments
- Added a `readonly forceable: boolean` discriminant to the `not-installable` / `no-longer-installable` `PluginShapeErrorShape` variants; `requireInstallable` stamps it from `r.state === "unsupported"`, `requireForceInstallable` always stamps `false`.
- Kept `buildPluginShapeMessage` byte-frozen -- the `.message.includes("is not installable")` / `is no longer installable` assertions stay green.
- Threaded `forceable` through `EntityErrorRow` and `composeInstallFailureMessage` (new `composeUnavailableMessage` helper) so the force-degradable arm renders at error severity AND carries a 4-space `--force` hint trailer; the structural arm renders byte-frozen.
- Landed the `failure-unsupported-features` catalog block edit + a new `failure-structural-unavailable` block + matching catalog-uat fixtures in lockstep with the `install.ts` / `notify.ts` producer change (no RED window on the byte-equality gate).

## Task Commits

1. **Task 1: Carry the three-way `forceable` discriminant on the thrown PluginShapeError** - `fa6252e9` (feat)
2. **Task 2: Render the `--force` hint on the unsupported arm; catalog + fixture in lockstep** - `2cbd0df1` (feat)

_Task 2 is tagged `tdd="true"`; the lockstep byte-equality constraint (no RED window on the catalog-uat gate) required producer + catalog + fixture in a single commit, so RED/GREEN collapsed into one GREEN commit per the plan's explicit "ONE commit" acceptance criterion._

## Files Created/Modified
- `extensions/pi-claude-marketplace/shared/errors.ts` - `forceable` field on the two not-installable shape variants
- `extensions/pi-claude-marketplace/domain/resolver.ts` - both throw sites stamp `forceable`
- `extensions/pi-claude-marketplace/shared/notify.ts` - `PluginUnavailableMessage.forceHint`, the `FORCE_INSTALL_HINT_TRAILER` literal, and the trailer render in `composePluginLinesWith`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - `EntityErrorRow.forceable`, classify threading, `composeUnavailableMessage` helper, `__test_composeInstallFailureMessage` export
- `docs/output-catalog.md` - updated `failure-unsupported-features` block (now error + hint) and new `failure-structural-unavailable` block
- `tests/architecture/catalog-uat.test.ts` - updated + new fixtures with `expectedSeverity`
- `tests/orchestrators/plugin/install.test.ts` - producer-level SEV-02 threading tests
- `tests/shared/errors.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`, `tests/orchestrators/import/execute.test.ts` - supplied `forceable` at existing shape construction sites (typechecker-flagged)

## Decisions Made
- **Hint surface = trailer line, not a REASONS member** (RESEARCH A2). Keeps the closed `REASONS` tuple and the 22/17/7 STATUS/PLUGIN/MARKETPLACE token counts unchanged; the tripwire test (`notify-closed-set-locks.test.ts`) stays green untouched.
- **Placeholder hint wording:** `"Re-run with --force to install the supported components."` References the user's own `--force` flag only, no plugin/marketplace interpolation (T-69-01). The byte-exact form is reconciled in the DOC pass (DOC-01..03).

## Deviations from Plan

### Interpretation deviation (documented, not auto-fixed code)

**1. Structural `unavailable` arm kept at info severity (byte-frozen), not error**
- **Found during:** Task 2 (compose/catalog wiring)
- **Issue:** The plan's must_have truth #2 says the `unavailable` (structural) install "renders at error ... byte-identical to today." Today that surface renders at **info** (the pre-change `failure-unsupported-features` fixture carried no `expectedSeverity`, and `composeInstallFailureMessage` branch 3 stamped no severity). "Renders at error" and "byte-identical to today" are mutually exclusive for that arm, because stamping error adds a leading `A plugin operation has failed.` summary-line prefix.
- **Resolution:** Honored the operative orchestrator constraint -- "the `unavailable` arm stays byte-frozen (NO --force suggestion)" -- and the Task 2 acceptance criterion "renders byte-identical to today with NO `--force` hint." The structural arm therefore stays info (no hint, no summary prefix). Only the force-degradable `unsupported` arm flips to error severity (per truth #1 and the explicit `expectedSeverity: "error"` acceptance criterion). Final severity-row reconcile is owned by Phase 70 (CONTEXT.md deferred section).
- **Files modified:** install.ts (conditional severity stamp on the forceable arm only)
- **Verification:** catalog-uat byte-equality + `expectedSeverity` gates green for both the unsupported (error) and structural (info) fixtures.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cognitive-complexity lint failure in `composeInstallFailureMessage`**
- **Found during:** Task 2 (`npm run check`)
- **Issue:** Adding the conditional `forceHint`/`severity` spread pushed `composeInstallFailureMessage` cognitive complexity from 15 to 16 (sonarjs cap is 15).
- **Fix:** Extracted the `(unavailable)` row construction into a `composeUnavailableMessage` helper.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
- **Verification:** `npx eslint` clean; `npm run typecheck` green.
- **Committed in:** `2cbd0df1` (Task 2 commit)

---

**Total deviations:** 1 documented interpretation choice + 1 auto-fixed (Rule 3 blocking lint).
**Impact on plan:** No scope creep. The interpretation choice resolves an internal contradiction in the plan's must_haves in favor of the explicit, gate-enforced byte-freeze constraint; flagged here for the verifier.

## Issues Encountered
- **Known parallel flake:** `tests/orchestrators/marketplace/autoupdate.test.ts` hit `ENOTEMPTY` once under the parallel `npm test` run. Confirmed NOT a regression -- the file passes 20/20 in isolation (`node --test ...autoupdate.test.ts`). Integration suite (`npm run test:integration`) passes 16/16.

## Closed-set token counts
Unchanged at **22 / 17 / 7** (STATUS_TOKENS / PLUGIN_STATUSES / MARKETPLACE_STATUSES); REASONS unchanged at 32. No tripwire bump needed -- the hint is a trailer line, not a new token.

## Next Phase Readiness
- SEV-02 conditioning logic and the clear placeholder hint are in place. Phase 70 freezes the byte-exact hint wording and reconciles the structural-arm severity against the catalog.
- Remaining SEV items (SEV-01 missing-companion, SEV-03 autoupdate-takes-force, SEV-04 targeted/bulk, SEV-05 backfill brace) are unaffected by this plan and remain for the later 69 plans.

## Self-Check: PASSED

All modified source/doc/test files exist; both task commits (`fa6252e9`, `2cbd0df1`) are present in git history.

---
*Phase: 69-force-path-severity*
*Completed: 2026-06-28*
