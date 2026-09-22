---
phase: 10-constraint-aware-update
plan: 03
subsystem: dependency-management
tags: [update-preflight, constraint-gate, notification-grammar, semver, catalog]

# Dependency graph
requires:
  - phase: 10-constraint-aware-update
    provides: "plan 10-01's constraint gate scaffolding (the held arm, the 'dependents constrain' token, PluginSkippedMessage.cause) and plan 10-02's stage-one tag probing (the admits/pin verdict shape, the fellBackToCurrentCopy-less admits arm, run-scoped tag memos)"
provides:
  - "admitResolvedVersion -- stage two's pure post-fetch guard, re-checking a no-tag or current-copy-fallback candidate's derived version against the SAME intersected range stage one already computed"
  - "UpdateConstraintDisclosure -- the required-but-nullable disclosure carrier on PreparedPluginUpdate, PluginUpdateUpdatedOutcome and PluginUpdateUnchangedOutcome (D-10-17a), swept across all 51+ construction sites and proven complete by npm run typecheck"
  - "the {dependency current copy} success-row axis (D-10-14/D-10-15) and the {up-to-date} ceiling disclosure (D-10-13), both read through the widened constraintCauseFor carrier"
  - "the autoupdate cascade's held row at the same token, cause line and warning severity the manual cascade renders (D-10-12), with the severity divergence stated in full at both cascades' severity-setting sites"
  - "four new catalog states (223 -> 227): update-held-out-of-range, update-current-copy, update-up-to-date-constrained, autoupdate-held-by-dependents"
affects: [10-04-docs-and-regression]

# Actuals (#2632)
actuals:
  tokens: 25034
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One composer, two version-bearing arms: describeConstraint gained an optional `version` parameter (raw, never renderConstraintRange-bounded, prefixed ahead of the fixed arm clause) so stage two's out-of-range hold and D-10-13's already-resolved disclosure both extend the SAME cause-line composer plan 10-01 built, rather than writing a second one."
    - "Disclosure composed once per verdict at the choke point (admitsRange), not per consumer: every admits arm -- pinned, no-pin, plain, or current-copy fallback -- carries a ready UpdateConstraintDisclosure, so PreparedPluginUpdate.constraint and the two unchanged-outcome sites all read the SAME precomputed value instead of re-deriving it."
    - "Required-but-nullable member sweep proven by the compiler, not by grep: exactOptionalPropertyTypes plus a non-optional `T | undefined` member makes every omitting construction site a TS2741/2739 error; npm run typecheck exiting 0 is the completeness proof for the 51+ site sweep, not the plan's stated grep count (see Deviations)."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - docs/output-catalog.md
    - scripts/check-unused-type-members.contracts.json
    - tests/orchestrators/plugin/update-constraint-gate.test.ts
    - tests/orchestrators/plugin/update-preflight.test.ts
    - tests/orchestrators/plugin/update-swap.test.ts
    - tests/orchestrators/plugin/update-row.test.ts
    - tests/orchestrators/plugin/update-cascade.test.ts
    - tests/orchestrators/marketplace/update.messaging.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/types.test.ts
    - tests/edge/types.test.ts
    - tests/edge/handlers/marketplace/update.test.ts
    - tests/e2e/import-command.test.ts
    - tests/shared/notify-reasons.test.ts
    - tests/architecture/catalog-uat/fixtures/plugin-update.ts
    - tests/architecture/catalog-uat/fixtures/marketplace-update.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts

key-decisions:
  - "describeConstraint's version parameter is raw and unbounded (never renderConstraintRange-transformed), prefixed as `version <v> ` ahead of the fixed arm clause, so the out-of-range hold and the already-resolved disclosure both interpolate the fetched/ceiling version without a second cause-line composer."
  - "admitsRange composes `disclosure` unconditionally on every admits verdict via the already-resolved arm, so PreparedPluginUpdate.constraint, the unchanged outcome inside preparePluginUpdate, and refreshDisabledPluginUpdate's unchanged outcome all read one precomputed value rather than three independent compositions."
  - "refreshDisabledPluginUpdate takes constraint as a required third positional parameter, computed by the caller from the SAME verdict local via constraintFromVerdict(verdict) -- never read back off `preflight.constraint` -- keeping update-swap.ts's updated-outcome literal the single justified consumer of the prepared slot (D-10-17a), verified by a filtered grep that update-preflight.ts never reads `preflight.constraint`."
  - "postFetchGuard, buildUpdateAuth and constraintFromVerdict were extracted out of preparePluginUpdate as Rule-3 blocking fixes: fallow's own cognitive-complexity gate (max 15) flagged 17 after the stage-two branch was added inline, even though ESLint's sonarjs rule stayed clean -- the two tools compute the metric differently, and fallow is a required plan-level `<verify>` gate."

requirements-completed: [UPDT-01, UPDT-02]

coverage:
  - id: D1
    description: "A no-tag repository (or a path source that fell back to the marketplace's current copy) has its derived version re-checked against the same intersected range; out of range it is held naming only the rejecting dependent(s), in range it proceeds"
    requirement: "UPDT-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-constraint-gate.test.ts#UPDT-02: the out-of-range hold names only the rejecting dependents"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-preflight.test.ts#UPDT-01: a no-tag repository is still gated by the post-fetch guard"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-preflight.test.ts#UPDT-01: a no-tag repository proceeds when the fetched version satisfies the range"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-preflight.test.ts#UPDT-01: a pinned verdict skips the post-fetch guard entirely"
        status: pass
      - kind: integration
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 20 fixture modules to 227 exact documented states"
        status: pass
    human_judgment: false
  - id: D2
    description: "An inclusive upper bound admits the boundary version; an exclusive upper bound holds it -- the adjacency edge stage two must get right"
    requirement: "UPDT-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-constraint-gate.test.ts#UPDT-02: an inclusive upper bound admits the boundary version"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-constraint-gate.test.ts#UPDT-02: an exclusive upper bound holds the boundary version"
        status: pass
    human_judgment: false
  - id: D3
    description: "A constrained path source with no satisfying marketplace tag falls back to the marketplace's current copy and, landing in range, reuses the existing {dependency current copy} token as the FIRST axis in the success row's brace"
    requirement: "UPDT-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-constraint-gate.test.ts#D-10-14: a path source with no satisfying tag falls back and is re-checked"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-row.test.ts#D-10-15: an in-range current-copy fallback names itself on the success row"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-swap.test.ts#D-10-17a: the updated outcome forwards the preflight's own constraint, key always present"
        status: pass
    human_judgment: false
  - id: D4
    description: "A plugin already at the ceiling its dependents admit keeps its {up-to-date} brace and discloses the effective range and its holders on the cause line, on both the manual and autoupdate cascades; an unconstrained up-to-date plugin stays byte-identical"
    requirement: "UPDT-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-row.test.ts#D-10-13: constraintCauseFor composes an Error from an unchanged outcome's disclosure"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-cascade.test.ts#D-10-13: the ceiling version discloses its range and holders"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.messaging.test.ts#D-10-13: an unchanged outcome with a constraint discloses its range and holders"
        status: pass
    human_judgment: false
  - id: D5
    description: "The held row is warning on both the manual cascade and the autoupdate cascade, through skipSeverity's default alone with no bespoke branch, and the held token stays out of IDEMPOTENT_REASONS"
    requirement: "UPDT-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-cascade.test.ts#D-10-12: the held row is warning on the manual cascade"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.messaging.test.ts#D-10-12: the held row is warning on the autoupdate cascade"
        status: pass
      - kind: unit
        ref: "tests/shared/notify-reasons.test.ts#D-10-12: classifies the held-update token as an actionable skip, never idempotent"
        status: pass
      - kind: integration
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: Reason is the closed 62-entry reason set"
        status: pass
    human_judgment: false
  - id: D6
    description: "A bulk run holding one plugin updates the rest unchanged, and the disclosure member is required-but-nullable (never optional) on all three types, with every construction site spelling it"
    requirement: "UPDT-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-cascade.test.ts#UPDT-02: a bulk run holds one plugin and updates the rest"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/types.test.ts (two @ts-expect-error negatives: omitted constraint key, half-filled disclosure sub-object)"
        status: pass
      - kind: other
        ref: "npm run typecheck (exit 0) -- the completeness proof for the required-but-nullable sweep"
        status: pass
    human_judgment: false

duration: 56min
completed: 2026-09-22
status: complete
---

# Phase 10 Plan 03: Stage Two, the Current-Copy Row, and the Autoupdate Cascade's Held Row Summary

**Closes the constraint gate's second stage (`admitResolvedVersion`) so a no-tag repository or a drifted current-copy fallback is still checked against the intersected range, threads the resulting disclosure through `PreparedPluginUpdate` and both cascades' success/up-to-date rows, and gives the autoupdate cascade the same held-row token, cause line and `warning` severity the manual cascade already renders -- moving the catalog from 223 to 227 documented states.**

## Performance

- **Duration:** 56 min (commit-timestamp span, first task commit to last)
- **Started:** 2026-09-22T14:23:11-04:00
- **Completed:** 2026-09-22T15:19:17-04:00
- **Tasks:** 3
- **Files modified:** 26

## Accomplishments

- `admitResolvedVersion` (`update-constraint-gate.ts`) is a pure stage-two re-check: it tests the derived `toVersion` against the SAME intersected range stage one already folded, and on a hold names only the holders whose OWN declared range rejects the fetched version -- a holder whose range the version satisfies never appears on the cause line. `preparePluginUpdate` calls it through a new `postFetchGuard` extraction, skipping the check entirely when a pin was applied (the tag was already selected from the range).
- `UpdateConstraintDisclosure` (`orchestrators/types.ts`) is declared required-but-nullable (`readonly constraint: UpdateConstraintDisclosure | undefined`, never `constraint?:`) on `PreparedPluginUpdate`, `PluginUpdateUpdatedOutcome` and `PluginUpdateUnchangedOutcome`, with an atomically-shaped two-field sub-object -- two independent compile-time guards (D-10-17a) proven by a filtered grep (0 occurrences of `constraint?:`) and two new `@ts-expect-error` negatives in `types.test.ts`. `admitsRange` composes the disclosure once per verdict (the "already-resolved" arm of `describeConstraint`, extended with an optional raw `version` parameter shared by stage two's out-of-range arm) so every consumer reads one precomputed value.
- `update-row.ts::updatedRowFromOutcome` gained a fourth, independent degradation axis: `{dependency current copy}` renders FIRST in the brace when a constrained path source fell back to its marketplace's current copy and landed in range (D-10-14/D-10-15), reusing Phase 7's existing token with no catalog amendment to that token itself. `constraintCauseFor` widened to accept `PluginUpdateUnchangedOutcome`, reading the D-10-13 ceiling disclosure the same way it already reads the held-update cause.
- The manual cascade's `unchanged` arm and the autoupdate cascade's `skipped`/`unchanged` arms all read the SAME `constraintCauseFor` carrier -- `update.messaging.ts` imports it from `update-row.ts`, never the constraint gate leaf, confirmed by `no-orchestrator-network.test.ts` and a filtered import-count grep. Both cascades reach `warning` for the held token through `skipSeverity`'s default alone; the divergence from the `(updated)` partition's info-for-autoupdate split is stated in full at both severity sites, closing with the instruction that the token must never join `IDEMPOTENT_REASONS`.
- Four catalog states landed with byte-exact fenced blocks (223 -> 224 -> 226 -> 227): `update-held-out-of-range`, `update-current-copy`, `update-up-to-date-constrained`, `autoupdate-held-by-dependents`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Stage two -- re-check the version that actually landed, and hold on the dependents that reject it** - `786592c2` (feat)
2. **Task 2: Say where the tree came from -- the current-copy fallback on the success row, and the ceiling on the up-to-date row** - `f7d8cdf8` (feat)
3. **Task 3: The same row on the autoupdate cascade, and the severity divergence stated where it is set** - `e50ec025` (feat)

**Plan metadata:** pending (this commit)

_Note: TDD tasks -- test coverage for each task's new code was written and verified alongside its production code within the same commit, per this repo's convention of one commit per task rather than separate RED/GREEN commits._

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts` - `admitResolvedVersion`, the `out-of-range`/`already-resolved` `describeConstraint` arms, `admitsRange`'s unconditional disclosure composition and `fellBackToCurrentCopy` options object
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` - `postFetchGuard`, `buildUpdateAuth`, `constraintFromVerdict` extractions; `PreparedPluginUpdate.constraint`; `refreshDisabledPluginUpdate`'s required third parameter
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts` - the `updated`-outcome literal's `constraint: preflight.constraint` plain assignment, the slot's single justified consumer
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts` - the fourth `{dependency current copy}` axis; `constraintCauseFor` widened to `PluginUpdateUnchangedOutcome`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts` - the manual cascade's `unchanged` arm now spreads the D-10-13 cause
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts` - the autoupdate cascade's `skipped`/`unchanged` arms read `constraintCauseFor`; both severity comments state the D-10-12 divergence in full
- `extensions/pi-claude-marketplace/orchestrators/types.ts` - `UpdateConstraintDisclosure`; the required-but-nullable `constraint` member on both update outcome types
- `docs/output-catalog.md` - four new catalog states, byte-verified against the fenced blocks
- `scripts/check-unused-type-members.contracts.json` - two `update-preflight.ts` anchors remapped (161:56/162:5 -> 174:56/175:5; 450:63/450:6 -> 463:63/462:6)
- `tests/orchestrators/plugin/update-constraint-gate.test.ts`, `update-preflight.test.ts`, `update-swap.test.ts`, `update-row.test.ts`, `update-cascade.test.ts`, `tests/orchestrators/marketplace/update.messaging.test.ts`, `update.test.ts`, `tests/orchestrators/types.test.ts`, `tests/edge/types.test.ts`, `tests/edge/handlers/marketplace/update.test.ts`, `tests/e2e/import-command.test.ts`, `tests/shared/notify-reasons.test.ts`, `tests/orchestrators/plugin/update-flow.test.ts` - the required-but-nullable sweep plus new behavior cases for every verbatim title the plan names
- `tests/architecture/catalog-uat/fixtures/plugin-update.ts`, `fixtures/marketplace-update.ts`, `catalog-contract.test.ts`, `catalog-parser.test.ts` - four new fixtures and the moved state/byte counts

## Decisions Made

- `describeConstraint` gained one optional `version` parameter (raw, prefixed ahead of the fixed arm clause, never passed through `renderConstraintRange`) rather than a second composer, so stage two's out-of-range hold and D-10-13's ceiling disclosure both extend plan 10-01's one cause-line composer.
- `admitsRange` composes `disclosure` unconditionally on every `admits` verdict (pinned, unpinned, plain, or current-copy fallback), so `PreparedPluginUpdate.constraint` and both `unchanged` outcome sites read one precomputed value instead of three independent compositions.
- `refreshDisabledPluginUpdate` takes `constraint` as a required third positional parameter, computed by the caller from the SAME `verdict` local via `constraintFromVerdict(verdict)` -- never read back off `preflight.constraint` -- which is what keeps `update-swap.ts`'s `updated`-outcome literal the single justified consumer of the prepared slot (D-10-17a); a filtered grep confirms `preflight.constraint` never appears inside `update-preflight.ts`.
- `postFetchGuard`, `buildUpdateAuth` and `constraintFromVerdict` were extracted out of `preparePluginUpdate` as Rule-3 blocking fixes: fallow's own cognitive-complexity gate (max 15) reported 17 after the stage-two branch was added inline, even though ESLint's `sonarjs/cognitive-complexity` rule stayed clean on the same code -- the two tools compute the metric differently, and `npm run fallow` is one of this plan's own required `<verify>` commands.
- Task 1's commit already wires `update-swap.ts`'s `constraint: preflight.constraint` and the gate's `fellBackToCurrentCopy` fallback-flagging logic, since both were natural consequences of the type/verdict shape Task 1 introduces; Task 2's commit completes the remaining preflight-side (`unchanged` outcomes, `refreshDisabledPluginUpdate`) and row-side (`update-row.ts`, `update-cascade.ts`) wiring. The plan's task boundary blurred slightly here without any functional gap -- every acceptance criterion is satisfied by the task named to satisfy it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `preparePluginUpdate`'s cognitive complexity exceeded fallow's cap after the inline stage-two branch**
- **Found during:** Task 1 (`npm run fallow`)
- **Issue:** `fallow health --complexity` reported `preparePluginUpdate` at 17 cognitive (cap 15) after the stage-two `if` was added inline, though ESLint's own `sonarjs/cognitive-complexity` rule reported no violation on the identical code.
- **Fix:** Extracted `postFetchGuard` (the stage-two branch), `buildUpdateAuth` (the three-conditional-spread auth bundle), and `constraintFromVerdict` (the verdict-to-disclosure ternary) as module-private helpers, mirroring the existing `resolvePinnedUpdateCandidate` / `constraintGateOptions` extraction precedent from plan 10-02.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts`
- **Verification:** `fallow health --complexity` reports `No functions exceed complexity thresholds`; `npm run fallow` exits 0.
- **Committed in:** `786592c2`

**2. [Rule 1 - Bug] Two pre-existing `update-constraint-gate.test.ts` cases needed their `fellBackToCurrentCopy` expectation corrected from `false` to `true`**
- **Found during:** Task 1 (`node --test`)
- **Issue:** `"UPDT-01: two overlapping declared ranges admit their intersection"` and `"a declarer's other declarations do not hold the target"` both use the shared `options()` helper, which defaults to a `path` entry source and a seam whose `probeMarketplaceTags` answers `no-matching-tag`. Under D-10-14's new fallback logic this legitimately sets `fellBackToCurrentCopy: true`, but the tests' hand-written expected verdicts (written before D-10-14 existed) still asserted `false`.
- **Fix:** Updated both expected verdicts to `fellBackToCurrentCopy: true` with a comment explaining why the default fixture now hits the fallback arm.
- **Files modified:** `tests/orchestrators/plugin/update-constraint-gate.test.ts`
- **Verification:** Both cases pass; the assertion change reflects genuinely new, correct behavior, not a relaxed check.
- **Committed in:** `786592c2`

**3. [Rule 1 - Bug] A "Phase 7" GSD-planning-step reference in new comments, forbidden by the project's comment policy**
- **Found during:** Task 2 (self-review against `skills/typescript-comments/SKILL.md`)
- **Issue:** New doc comments in `update-row.ts` and `tests/architecture/catalog-uat/fixtures/plugin-update.ts` referenced "Phase 7's existing `{dependency current copy}` token" -- a GSD milestone-phase citation, which the project's comment policy forbids in `.ts` source (`docs/output-catalog.md`'s own prose is exempt; it is markdown, not a source comment, and already cites phase numbers throughout as an established convention).
- **Fix:** Reworded both to "the install cascade's existing `{dependency current copy}` token."
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts`, `tests/architecture/catalog-uat/fixtures/plugin-update.ts`
- **Verification:** `grep -En 'Phase [0-9]|Pitfall [0-9]|Pattern [0-9]'` over every `.ts` file this plan touches prints nothing.
- **Committed in:** `f7d8cdf8`

**4. [Rule 3 - Blocking] Two `check-unused-type-members.contracts.json` anchors invalidated by Task 1's line insertions**
- **Found during:** Task 1 (`npm run lint:type-members`)
- **Issue:** `PartialableUpdateShapeError`'s `kind`/`partialable` anchors (previously `161:56`/`162:5`) and `StaticPreflightRowOptions`'s `fromVersion` anchor (previously `450:63`, refining `450:6`) shifted when the new interface members and helper functions were inserted above them in `update-preflight.ts`.
- **Fix:** Remapped to their current positions (`174:56`/`175:5`; `463:63`, refining `462:6`), verified against the tool's own line:column report -- the same remap-and-verify pattern plan 10-02 documented.
- **Files modified:** `scripts/check-unused-type-members.contracts.json`
- **Verification:** `npm run lint:type-members` stops cleanly at the SAME pre-existing, out-of-scope stale entry (`notification-types.ts:550:48`) it stopped at before plan 10-02's own remap -- confirming completeness.
- **Committed in:** `786592c2`

**5. [Rule 1 - Bug] Two ESLint `@stylistic/padding-line-between-statements` findings in the new `case "unchanged"` blocks**
- **Found during:** Task 2 and Task 3 (`npx eslint`)
- **Issue:** The new `const cause = constraintCauseFor(outcome);` statement immediately followed by a `return` inside a `case` block, in both `update-cascade.ts` and `update.messaging.ts`, tripped the missing-blank-line rule.
- **Fix:** `npx eslint --fix` inserted the required blank line in both files.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts`
- **Verification:** `npx eslint` clean on both files; full `node --test` re-run confirms no behavior change.
- **Committed in:** `f7d8cdf8`, `e50ec025`

---

**Total deviations:** 5 auto-fixed (1 Rule-1 test-expectation correction reflecting new correct behavior, 2 further Rule-1 bug/style fixes, 2 Rule-3 blocking fixes for gate compliance)
**Impact on plan:** All five were necessary corrections surfaced by the plan's own verify gates (fallow, ESLint, lint:type-members) or by genuinely new, correct behavior the plan's own decisions (D-10-14) introduce. No scope creep -- no production behavior beyond what Tasks 1-3 specify.

## Issues Encountered

**The plan's stated grep count for the required-but-nullable sweep drifted from 51 to 62.** Task 1's acceptance criteria state `grep -rn 'partition: "updated"\|partition: "unchanged"' extensions tests` should return 51 matches (4 production + 47 test literals) after the sweep. The actual count is 62: Task 1 itself adds 2 new `@ts-expect-error` negative-test literals proving the required-but-nullable and atomic-shape guarantees (a genuine strengthening the plan's own `<behavior>` list asks for), and Tasks 2/3 add further behavior-proving cases (`D-10-14`, `D-10-15`, `D-10-13` x3, `D-10-12` x2) that necessarily construct more `partition: "updated"/"unchanged"` literals to exercise the new axes. The qualitative guarantee the grep count was a proxy for -- every construction site spells `constraint` -- is proven directly by `npm run typecheck` exiting 0 throughout, per this plan's own phase-specific guidance ("`npm run typecheck` exiting 0 is the completeness proof -- no grep substitutes for it"). Not treated as a deviation requiring a fix; documented here because the literal acceptance-criterion number does not match the final tree.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Stage two closes UPDT-01/UPDT-02's remaining gap (a no-tag repository or a drifted path-source current copy); plan 10-04 can now write `docs/dependency-resolution.md`'s constraint-aware update section against a feature-complete implementation, per its own `must_haves`.
- `update-flow.ts` and `update-preflight.ts` remain the only orchestrator git consumers (`no-orchestrator-network.test.ts` green); the constraint gate leaf stays absent from `NETWORK_FREE_TARGETS`.
- The catalog carries 227 states (223 at the start of this plan); `EXPECTED_STATE_COUNT`/`EXPECTED_UTF8_BYTES` in `catalog-contract.test.ts` and the parallel count in `catalog-parser.test.ts` are both current.
- `scripts/test-coverage-direct.pin.json` still holds an empty `rows: []` -- every module this plan touched or created reached 100% direct coverage with no new exemption.
- No blockers. `npm run typecheck`, `npm run lint`, `npm run fallow`, `npm run test:corresponding`, and `npm run test:coverage:direct:commit` are all green on the plan's final tree; `npx prettier --check docs/output-catalog.md` passes; the full regression set named in `<carried_forward>` (`update-flow.test.ts`, `update-swap.test.ts`, `update-cascade.test.ts`, `update-row.test.ts`, `marketplace/update.test.ts`, `marketplace/update.messaging.test.ts`) is green, including the previously-flagged `PDEF-01` case.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts` — FOUND, contains `admitResolvedVersion`
- `extensions/pi-claude-marketplace/orchestrators/types.ts` — FOUND, contains `UpdateConstraintDisclosure`
- `docs/output-catalog.md` — FOUND, contains all four new `catalog-state:` anchors
- Commit `786592c2` — FOUND in `git log`
- Commit `f7d8cdf8` — FOUND in `git log`
- Commit `e50ec025` — FOUND in `git log`
- `npm run typecheck`, `npm run lint`, `npm run fallow`, `npm run test:corresponding`, `npm run test:coverage:direct:commit` — all exit 0 on the final tree

---
*Phase: 10-constraint-aware-update*
*Completed: 2026-09-22*
