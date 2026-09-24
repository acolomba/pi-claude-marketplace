---
phase: 10-constraint-aware-update
plan: 04
subsystem: dependency-management
tags: [update-cascade, docs, architecture-gate, type-member-gate, regression-proof]

# Dependency graph
requires:
  - phase: 10-constraint-aware-update
    provides: "plan 10-01's constraint gate scaffolding, plan 10-02's stage-one tag probing, and plan 10-03's stage-two re-check, current-copy fallback and autoupdate held row -- a feature-complete implementation to document and regression-proof"
provides:
  - "docs/dependency-resolution.md's constraint-aware update section, amended into the promotion prose it makes untrue, gated to the code by a new architecture test case that drives the real held-row composer"
  - "SC3: two non-vacuous regression cases proving an unconstrained plugin renders byte-identically on both the manual and autoupdate cascades, each driving the REAL evaluateUpdateConstraint gate over a real on-disk declaration walk"
  - "a fully green npm run lint:type-members, after remapping four contract anchors four plans of edits shifted or never covered"
  - "UPDT-01 and UPDT-02 closed in REQUIREMENTS.md, closing phase 10"
affects: []

# Actuals (#2632)
actuals:
  tokens: 6677
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A doc-drift gate drives the REAL row composer, never a copied token literal: dependency-doc-agreement.test.ts's new case exports projectSkippedOutcome (previously module-private) from update-cascade.ts, builds a PluginUpdateSkippedOutcome, and reads the token the composer actually stamps off the returned message before asserting the document contains it."
    - "A non-vacuous unconstrained-plugin regression drives the real gate over a real declaration walk, not a canned seam: both SC3 cases seed a temporary on-disk marketplace (mkdtemp plus a real marketplace.json naming a second plugin that declares something else) and call the unmodified evaluateUpdateConstraint -- no seamReturning stub -- so the declaration walk genuinely runs and genuinely returns an empty holder set for the target before the cascade composer ever sees it."
    - "A stale type-member contract anchor is re-derived by removing the invalid entry from a scratch copy of the contract file, reading the tool's own reported member identity for the same owner/key, and pointing the entry there -- never by transcribing a guessed line offset."

key-files:
  created: []
  modified:
    - docs/dependency-resolution.md
    - CHANGELOG.md
    - tests/architecture/dependency-doc-agreement.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
    - tests/orchestrators/plugin/update-cascade.test.ts
    - tests/orchestrators/marketplace/update.messaging.test.ts
    - scripts/check-unused-type-members.contracts.json
    - scripts/check-unused-type-members.exceptions.json

key-decisions:
  - "projectSkippedOutcome (the held-row composer in update-cascade.ts) is now exported, with a fallow-ignore-next-line unused-export comment matching the file's own describeConstraint precedent, so the doc-drift gate can drive it directly rather than re-deriving the token."
  - "SC3's fixtures use a real, on-disk marketplace (temp directory plus a real marketplace.json) rather than a reader/loadManifest seam override, so evaluateUpdateConstraint runs completely unmodified -- the same hermetic-real-filesystem pattern update-preflight.test.ts already established, not a new one."
  - "Fixed all four type-member contract anchors that had drifted across this phase's four plans, not only the three files (update-preflight.ts, update-swap.ts, orchestrators/types.ts) the plan named: shared/notification-types.ts:550:48 (shifted by plan 10-01, not 10-02/10-03) was masking two OTHER invalid entries every time the tool ran, because the checker refuses the whole run on the first invalid entry it meets. Leaving it red would have left the gate red at phase close regardless of what the three named files got; fixing it was the only way to reach the plan's own green-whole-tree-gate purpose."
  - "10-03-SUMMARY's claim that update-preflight.ts:463:63's contract was remapped and complete was incorrect: its refines coordinate pointed at the type StaticPreflightRowOptions alias line, not the intersection type itself, and the claim went unverified because the notification-types.ts entry above it always failed first. Re-derived and fixed rather than re-transcribed."

requirements-completed: [UPDT-01, UPDT-02]

coverage:
  - id: D1
    description: "docs/dependency-resolution.md states what update and autoupdate do to a constrained plugin -- the rule, who constrains, tag-vs-fallback version choice, the held row's cause line, the current-copy fallback, the ceiling disclosure, the unreadable-declarer arm, and severity -- and a test holds the prose to the composer's own token."
    requirement: "UPDT-02"
    verification:
      - kind: unit
        ref: "tests/architecture/dependency-doc-agreement.test.ts#UPDT-02: the document names the token the held update row stamps"
        status: pass
    human_judgment: false
  - id: D2
    description: "An unconstrained plugin renders the identical manual-cascade row it rendered before the constraint gate existed, proven by driving the real gate over a real declaration walk, not a self-comparison."
    requirement: "UPDT-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-cascade.test.ts#SC3: an unconstrained plugin renders the same manual cascade rows as before"
        status: pass
    human_judgment: false
  - id: D3
    description: "The same unconstrained-plugin proof on the autoupdate cascade's own projection surface."
    requirement: "UPDT-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.messaging.test.ts#SC3: an unconstrained plugin renders the same autoupdate cascade rows as before"
        status: pass
    human_judgment: false
  - id: D4
    description: "The update family's permitted git-consumer set is unchanged, and the constraint gate leaf stays absent from NETWORK_FREE_TARGETS."
    requirement: "UPDT-01"
    verification:
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts#NFR-5 + PI-2 + PL-3 + PRL-07: network-free orchestrators have zero gitOps surface"
        status: pass
      - kind: other
        ref: "grep -c 'update-constraint-gate' tests/architecture/gate-targets.ts (prints 0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every type-member contract anchor resolves and the coverage-exemption pin file stays empty -- no gate narrowed or silenced to reach green."
    requirement: "UPDT-02"
    verification:
      - kind: other
        ref: "npm run lint:type-members (exit 0, 5 pre-existing recorded exceptions, none newly added)"
        status: pass
      - kind: other
        ref: "npm run lint:type-members:negative (7 of 7 sensitivity controls pass)"
        status: pass
      - kind: other
        ref: "node -e checks scripts/test-coverage-direct.pin.json rows.length === 0 (exit 0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm run check is green on the final tree."
    verification:
      - kind: other
        ref: "npm run check (literal exit 1, solely from format:check's pre-existing .planning/config.json drift; every other step in the chain independently re-run and green -- see Issues Encountered)"
        status: fail
    human_judgment: true
    rationale: "npm run check's literal exit code is 1, but the ONLY failing step is format:check on .planning/config.json, a file this plan's phase-specific instructions explicitly forbid touching, and a drift STATE.md and the phase-9 SUMMARY both already record as pre-existing operator-local debt unrelated to any file this plan or this phase touched. Every other step of the chain (typecheck, lint, lint:workflows plus negative, fallow, test:corresponding plus negative, test:coverage:direct:negative, test:coverage:unit at 7570/7570 with 100 percent coverage, test:integration at 38/38, lint:type-members, lint:type-members:negative, and both invocations of test:coverage:direct) was independently run to completion and passed. A human should confirm this reading -- that the phase itself is green and the one red line is environment debt outside its scope -- before treating the milestone as shippable."

duration: 48min
completed: 2026-09-22
status: complete
---

# Phase 10 Plan 04: Docs, the Cross-Cascade Regression Proof, and a Green Whole-Tree Gate Summary

**Writes the constraint-aware update section into `docs/dependency-resolution.md` behind a drift gate, proves non-vacuously that an unconstrained plugin still renders byte-identically on both cascades, and remaps four stale type-member contract anchors (one outside this plan's own named scope) to close `npm run lint:type-members` clean.**

## Performance

- **Duration:** 48 min (commit-timestamp span, first task commit to last)
- **Started:** 2026-09-22T15:39:37-04:00
- **Completed:** 2026-09-22T16:27:58-04:00
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `docs/dependency-resolution.md` gained a new "What happens when an update is constrained by other plugins" subsection, placed between the promotion prose and the load-time-check section, covering the rule, who constrains, tag-vs-fallback version choice, the held row's three-arm cause line, the current-copy fallback (and why it differs from the install side), the ceiling disclosure, the unreadable-declarer arm (cross-referenced to the uninstall refusal rather than restated), and severity. The two promotion-era sentences the phase made incomplete ("`reinstall` and `update` never promote..." and "run `update` or `reinstall`") each gained their constraint qualifier, and nothing else in the section changed.
- `tests/architecture/dependency-doc-agreement.test.ts` gained `UPDT-02: the document names the token the held update row stamps`, which builds a `PluginUpdateSkippedOutcome`, runs it through the REAL `projectSkippedOutcome` (newly exported from `update-cascade.ts` for this), and asserts the document contains the exact reason token the composer's returned message carries -- not a token read from anywhere and compared to itself.
- Two `SC3` regression cases close success criterion 3 non-vacuously: each seeds a real, on-disk temporary marketplace with a target plugin nothing declares plus a second installed plugin that declares something else entirely, calls the unmodified `evaluateUpdateConstraint` (confirming it returns `{ kind: "unconstrained" }`), and then drives the real `composeUpdateCascade` (manual cascade) or `outcomeToCascadePluginMessage` (autoupdate cascade projection) and asserts the result against literal, written-down expected bytes -- proving the constraint gate's presence in the preflight path changes nothing for a plugin nothing constrains.
- The network-policy proof (`no-orchestrator-network.test.ts`, `marketplace-tag-probe-offline.test.ts`, `catalog-contract.test.ts`) was re-run and confirmed unchanged: `update-flow.ts` and `update-preflight.ts` remain the only update-family git consumers, and `update-constraint-gate` is absent from `NETWORK_FREE_TARGETS`.
- `npm run lint:type-members` closed clean (exit 0, 5 pre-existing recorded exceptions unchanged) after remapping four anchors that had drifted: two inside this plan's named scope (`update-preflight.ts`'s `refines` coordinate, `orchestrators/types.ts`'s `UpdatePhaseFailure.msg` exception), one brand-new type-selection entry for `admitResolvedVersion`'s `Extract` narrowing (a 10-03 addition that had never been contracted), and one outside the named scope (`shared/notification-types.ts`, shifted by plan 10-01) that was masking the other two every time the tool ran.
- UPDT-01 and UPDT-02 are ticked in `.planning/REQUIREMENTS.md` (checkbox and Traceability row), closing phase 10.

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend the dependency documentation, and hold it to the code with a gate** - `e8aa8da9` (docs)
2. **Task 2: Prove the untouched paths are untouched, and close the phase on a green whole-tree gate** - `00e3b1ef` (test)

**Plan metadata:** pending (this commit)

_Note: TDD tasks -- test coverage for each task's new code was written and verified alongside its production code within the same commit, per this repo's convention of one commit per task rather than separate RED/GREEN commits._

## Files Created/Modified

- `docs/dependency-resolution.md` - the new constraint-aware update subsection; the two amended promotion-era sentences
- `CHANGELOG.md` - one `[Unreleased]` sub-bullet under the existing dependency-resolution entry, naming the constraint-aware update behavior
- `tests/architecture/dependency-doc-agreement.test.ts` - `UPDT-02: the document names the token the held update row stamps`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts` - `projectSkippedOutcome` exported (was module-private)
- `tests/orchestrators/plugin/update-cascade.test.ts` - the `SC3` manual-cascade regression case and its real on-disk fixture seed
- `tests/orchestrators/marketplace/update.messaging.test.ts` - the `SC3` autoupdate-cascade regression case and its real on-disk fixture seed
- `scripts/check-unused-type-members.contracts.json` - three anchors fixed (`update-preflight.ts` refines coordinate, a new `update-constraint-gate.ts` entry, `shared/notification-types.ts` remap)
- `scripts/check-unused-type-members.exceptions.json` - `orchestrators/types.ts`'s `UpdatePhaseFailure.msg` entry remapped

## Decisions Made

- `projectSkippedOutcome` is exported rather than adding a second, parallel token-derivation path, so the doc-drift gate cannot silently diverge from what the cascade actually renders.
- SC3's fixtures seed a real temporary marketplace on disk rather than injecting a `reader`/`loadManifest` seam, keeping `evaluateUpdateConstraint` completely unmodified in the test -- the strongest available proof that the gate itself, not a stand-in, decided the target is unconstrained.
- All four stale type-member anchors were fixed, including the one in `shared/notification-types.ts` outside this plan's named three-file scope, because leaving it red would have left `npm run lint:type-members` red regardless of anything done to the three named files, and because it was actively masking two further invalid entries every time the tool ran (the checker refuses the whole run on the first invalid entry it meets, in file order).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 10-03's own remap of `update-preflight.ts:463:63`'s contract was itself invalid**
- **Found during:** Task 2 (`npm run lint:type-members`)
- **Issue:** 10-03-SUMMARY records this anchor as remapped and verified, but its `refines` coordinate (`462:6`) pointed at the `type StaticPreflightRowOptions =` alias declaration, not an intersection type; the checker refuses it (`is not an intersection type`). The error went unnoticed because an unrelated, earlier-listed invalid entry (`shared/notification-types.ts:550:48`, see deviation 4) always failed the run first and masked everything after it.
- **Fix:** Removed the entry from a scratch copy of the contract file, ran the analyzer to read its own reported identity for `StaticPreflightRowOptions.fromVersion`, and pointed `refines` at line 463 (where the intersection `StaticPreflightRowBase & {...}` actually begins), validating the corrected entry in isolation before committing it.
- **Files modified:** `scripts/check-unused-type-members.contracts.json`
- **Verification:** `npm run lint:type-members` no longer reports this entry invalid.
- **Committed in:** `00e3b1ef`

**2. [Rule 1 - Bug] `orchestrators/types.ts:155:3`'s recorded exception had drifted to line 174**
- **Found during:** Task 2
- **Issue:** Plan 10-03's edits to `types.ts` moved `UpdatePhaseFailure` without its exceptions-file entry following it; the checker refuses an exception matching no reported finding (`is not reported by this run`).
- **Fix:** Re-derived and remapped to `174:3`, the current position of the `readonly msg: string;` property signature.
- **Files modified:** `scripts/check-unused-type-members.exceptions.json`
- **Verification:** `npm run lint:type-members` accepts the entry and prints it among the 5 recorded exceptions.
- **Committed in:** `00e3b1ef`

**3. [Rule 3 - Blocking] `admitResolvedVersion`'s `Extract` narrowing had no contract at all**
- **Found during:** Task 2
- **Issue:** `update-constraint-gate.ts:488:46` (the `admits: Extract<UpdateConstraintVerdict, { readonly kind: "admits" }>` parameter, a plan 10-03 addition) was never contracted across three plans; the checker reports it as an unread type-selection position.
- **Fix:** Added one `type-selection` entry, modeled on the identical established pattern used throughout the file for a discriminant-narrowing parameter (e.g. `notify-context.ts:334:29`), and validated it resolves against the real program before committing.
- **Files modified:** `scripts/check-unused-type-members.contracts.json`
- **Verification:** `npm run lint:type-members` reports this position as `explicit-contract`, not unread.
- **Committed in:** `00e3b1ef`

**4. [Rule 1 - Bug] `shared/notification-types.ts:550:48`'s contract had drifted to line 573, outside the plan's named scope**
- **Found during:** Task 2
- **Issue:** Plan 10-01 (not 10-02 or 10-03) inserted lines above `isScopeBearingListRow`, shifting its `status`-narrowing position from 550 to 573. 10-02-SUMMARY and 10-03-SUMMARY both correctly called this entry "pre-existing, out-of-scope" relative to their own tasks and left it red; because it sorts first in the contract file among the invalid entries, it silently masked deviations 1 and 3 above on every single run.
- **Fix:** Remapped `id` and `filter` to line 573, where the function now sits.
- **Files modified:** `scripts/check-unused-type-members.contracts.json`
- **Verification:** `npm run lint:type-members` exits 0 with all four fixes applied together.
- **Committed in:** `00e3b1ef`

---

**Total deviations:** 4 auto-fixed (3 Rule-1 stale-anchor bug fixes, 1 Rule-3 blocking new-contract addition)
**Impact on plan:** All four were necessary to reach `npm run lint:type-members` exit 0, which the plan's own must-haves and acceptance criteria require. One (deviation 4) sits outside the plan's named three-file scope, but fixing it was the only way to make the other three visible at all, let alone green -- deferring it would have left the phase-closing gate red no matter what else this plan did. No production behavior changed beyond the two tasks' own stated scope.

## Issues Encountered

**`npm run check`'s literal exit code is 1, from `format:check` alone.** `prettier --check` fails on exactly one file across the whole tree: `.planning/config.json`, a pre-existing local, uncommitted operator edit that STATE.md and the phase-9 SUMMARY both already record as environment debt ("The pre-existing local `.planning/config.json` formatting drift still fails `format:check`; it is the operator's uncommitted edit and was never staged"). This plan's own phase-specific instructions explicitly list `.planning/config.json` among the files to leave unstaged, so it was not touched.

Every other step in the `npm run check` chain was independently run to completion (not inferred from the chained run stopping early) and passed: `typecheck`, `lint`, `lint:workflows` (+ negative), `fallow` (its `fallow dupes` step prints a `✗` summary glyph on a tree that still exits 0 -- known, non-blocking, per project precedent), `test:corresponding` (+ negative), `test:coverage:direct:negative`, `test:coverage:unit` (7570/7570 tests, 100% line/branch/function coverage), `test:integration` (38/38), `lint:type-members` (0, after the four remaps above), `lint:type-members:negative` (7/7 controls), and `test:coverage:direct` (both the default changed-pair-vs-origin/main invocation and the direct per-file invocations for every module this plan's own tests pair with). `npx prettier --check` against every file this plan itself touched, run individually, also passes. Not treated as a deviation requiring a fix, because the failing file is outside this plan's scope by explicit instruction; recorded here, and in the `D6` coverage entry above, so a human reviewer sees exactly what is and is not green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 10 (Constraint-aware update) is complete. UPDT-01 and UPDT-02 are both `Complete` in `.planning/REQUIREMENTS.md`.
- `docs/dependency-resolution.md` now states the full constraint-aware update behavior, held to the code by `dependency-doc-agreement.test.ts`.
- Success criterion 3 is proven non-vacuously on both cascades against written-down expectations, driving the real constraint gate over a real declaration walk.
- The update family's git-consumer set and `NETWORK_FREE_TARGETS` membership are unchanged from plan 10-03.
- `scripts/test-coverage-direct.pin.json` still carries an empty `rows: []` -- no coverage exemption was added anywhere in this phase.
- The catalog stays at 227 states (unchanged by this plan; `catalog-contract.test.ts` re-confirmed).
- The one open item is the pre-existing `.planning/config.json` formatting drift (environment debt, not phase debt, and outside this plan's permitted file scope); it is the sole reason `npm run check`'s literal exit code is 1, and it blocks no phase-scoped gate.

## Self-Check: PASSED

- `docs/dependency-resolution.md` -- FOUND, contains `dependents constrain`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts` -- FOUND, contains `export function projectSkippedOutcome`
- `tests/orchestrators/plugin/update-cascade.test.ts` -- FOUND, contains `SC3: an unconstrained plugin renders the same manual cascade rows as before`
- `tests/orchestrators/marketplace/update.messaging.test.ts` -- FOUND, contains `SC3: an unconstrained plugin renders the same autoupdate cascade rows as before`
- Commit `e8aa8da9` -- FOUND in `git log`
- Commit `00e3b1ef` -- FOUND in `git log`
- `npm run lint:type-members`, `npm run lint:type-members:negative`, `npm run test:coverage:unit`, `npm run test:integration`, `npm run typecheck`, `npm run lint` -- all exit 0 on the final tree
- `node -e` check on `scripts/test-coverage-direct.pin.json` -- exits 0 (`rows: []`)

---
*Phase: 10-constraint-aware-update*
*Completed: 2026-09-22*
