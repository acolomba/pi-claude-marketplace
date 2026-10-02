---
phase: 03-dependency-resolution
plan: 05
subsystem: orchestrators/plugin
tags: [dependency-resolution, version-constraints, range-intersection, git-tags, nfr-5, resv-05]

requires:
  - phase: 03-dependency-resolution
    plan: 01
    provides: "install-cascade.ts, ClosureMember.ranges and the closure's alreadyInstalled array -- the accumulator and the two lists this step consumes"
  - phase: 03-dependency-resolution
    plan: 02
    provides: "domain/dependency-range.ts -- the only intersection, satisfaction and range-rendering evaluator"
  - phase: 03-dependency-resolution
    plan: 04
    provides: "probeDependencyTags and its per-URL memo contract -- the tag resolution this step composes"
provides:
  - "resolveMemberConstraints: every closure member's accumulated ranges turned into a pin or into one of six named constraint failures, decided before any Phase exists"
  - "ResolvedCascadeMember.pinnedRef / pinnedOid -- the selected release tag and the commit it resolves to, delivered through the caller's own ledger options builder"
  - "InstallLedgerOptions.sourcePinOverride -- the field that makes a constrained dependency materialize the selected commit instead of the ref its marketplace entry names"
  - "domain/dependency-range.ts::isUnconstrainedRange -- the wildcard test by canonicalization, so range semantics stay in one module"
  - "the RESV-05 conflict check: an already-installed dependency is checked against the constraint and never touched"
affects:
  [
    per-member outcome reporting,
    the closed REASONS vocabulary,
    install provenance,
  ]

actuals:
  tokens: 16397
  tasks: 2
  commits: 2
plan_head_before: ca080b30d414c2429b8de56869611f0dafcf1b97

tech-stack:
  added: []
  patterns:
    - "A constraint verdict reached between the graph walk and the ledger array, so a failure arm needs no rollback story at all"
    - "A network-touching leaf reached from a gated owner's sibling, with the credential bundle lifted from the same options builder that threads it into the install"
    - "A wildcard test written as canonicalization rather than string identity, so two separately declared wildcards do not become a constraint"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/domain/dependency-range.ts
    - tests/orchestrators/plugin/install-cascade.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/install-outcome.test.ts
    - tests/domain/dependency-range.test.ts
    - tests/architecture/gate-targets.ts
    - scripts/test-coverage-direct.pin.json

key-decisions:
  - "D-03-27: the cascade resolves a constrained member's SOURCE itself, from the marketplace record the closure already proved present, rather than taking a caller-supplied source seam. The caller has no source resolution to hand over, and a second injected field would have had an undefined-behaviour arm for the case where nothing is injected."
  - "D-03-28: isUnconstrainedRange lives in domain/dependency-range.ts. The wildcard test is a question about what a range MEANS, and deriving it in the cascade would have been the second evaluator this phase's key link forbids."
  - "D-03-29: the re-pin is delivered as InstallLedgerOptions.sourcePinOverride, applied as the git source's `sha` in the resolve callback. That routes the clone probe down its EXISTING already-pinned arm, so a constrained install adds no second materialization path."
  - "The already-installed members are checked BEFORE the members this run would install, because that check makes no query at all -- a cascade that will fail on disk state never reaches a remote."
  - "A member with no git-backed source reports the same no-matching-tag its constrained siblings report. D-03-09's rule applied one step earlier: one no-match answer, no branch on how the source parsed, no path to a repository head."

patterns-established:
  - "A verdict placed before the ledger array needs no rollback proof, only a footprint proof -- and the footprint comparison is what shows the placement is real."
  - "An optional seam whose absence would have no defined answer is the wrong shape; give the module the inputs to build its own default instead."
  - "A pin file that records a READING, not just a file name, catches a coverage surface that moved even when the shortfall set did not."

requirements-completed: [RESV-05]

coverage:
  - id: D1
    description: "A dependency declared with no version constraint anywhere in the graph resolves to the wildcard and makes no tag query at all"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-03 a dependency declared with no version at all makes no tag query"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-03 a dependency declared with the bare wildcard makes no tag query"
        status: pass
      - kind: unit
        ref: "tests/domain/dependency-range.test.ts#RESV-03 two separately declared wildcards, whose product spells two of them is an unconstrained range"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two declarations of one dependency accumulate and intersect before anything is queried"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-03 two declarations of one dependency intersect before anything is queried"
        status: pass
    human_judgment: false
  - id: D3
    description: "Contradictory, over-cap and unparseable accumulations each fail the cascade naming the constraint, with no tag query made on any arm"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-03 a contradictory pair fails as a conflict, and no tag query is made"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-03 an unparseable declaration fails as invalid, and no tag query is made"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#T-03-19 a declaration past the input-size cap fails as too complex with no query"
        status: pass
    human_judgment: false
  - id: D4
    description: "A satisfiable range re-pins the member's install to the selected release tag's commit, through the caller's ledger options builder and into a real checkout"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-03 a satisfiable range pins the member and the pin reaches its ledger options"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#RESV-03: a constrained dependency is materialized at the tag the probe selected"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-outcome.test.ts#RESV-03: a source pin override materializes the pinned commit, not the entry's own ref"
        status: pass
    human_judgment: false
  - id: D5
    description: "A constraint no tag satisfies, and a tag listing that could not be read, each fail the cascade on their own named arm carrying the constraint"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-03 a no-matching-tag answer fails the cascade with the constraint named"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-03 a listing failure surfaces as its own arm carrying the classified cause"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#RESV-03: a dependency whose constraint no release tag satisfies fails the install whole"
        status: pass
    human_judgment: false
  - id: D6
    description: "One listing serves two members whose sources share a repository, through the one memo the run threads"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-03 one listing serves two members whose sources share a repository"
        status: pass
    human_judgment: false
  - id: D7
    description: "An already-installed dependency that satisfies its constraint is left exactly as it was -- no query, no ledger phase, no footprint change"
    requirement: RESV-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-05 an already-installed dependency that carries no constraint at all is left exactly as it was"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-05 an already-installed dependency that carries a constraint its recorded version satisfies is left exactly as it was"
        status: pass
    human_judgment: false
  - id: D8
    description: "An already-installed dependency whose recorded version does not satisfy the constraint fails the cascade naming both, with the whole two-scope footprint unchanged"
    requirement: RESV-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-05 a plain recorded version below the constraint fails the cascade naming both the version and the constraint"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-05 an already-installed dependency's contradictory declarations fail before any query"
        status: pass
    human_judgment: false
  - id: D9
    description: "This project's content-hash and git-sha recorded version forms run the same unguarded normalization ladder as any other candidate (D-03-04)"
    requirement: RESV-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-05 an already-installed dependency that carries a constraint a content-hash recorded version satisfies through the unguarded ladder is left exactly as it was"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-05 a content-hash recorded version whose coerced digits miss the constraint fails the cascade naming both the version and the constraint"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#RESV-05 a git-sha recorded version that normalizes to nothing fails the cascade naming both the version and the constraint"
        status: pass
    human_judgment: false
  - id: D10
    description: "A constraint declared by an installed plugin outside this install's own graph never affects the install (D-03-10)"
    requirement: RESV-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#D-03-10 a constraint declared outside this install's graph never reaches a member"
        status: pass
    human_judgment: false
  - id: D11
    description: "Neither install owner gained a git surface, and every constraint failure arm carries the member key and a bounded constraint with no filesystem path"
    requirement: RESV-03
    verification:
      - kind: architecture
        ref: "node --test tests/architecture/no-orchestrator-network.test.ts tests/architecture/import-boundaries.test.ts tests/architecture/no-credential-leak.test.ts tests/architecture/unowned-exports-census.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#T-03-22 the cause text for ... names only allowlisted tokens (6 cases)"
        status: pass
    human_judgment: false
  - id: D12
    description: "Live tag resolution against a real remote for a real constrained dependency, end to end"
    verification: []
    human_judgment: true
    rationale: "Every case here drives a faulted probe or a faulted listing seam; nothing in this plan has been run against a live git host. Whether a real marketplace's dependency source advertises `<pluginName>--v<semver>` tags, and what a real constrained install does on a cold cache, are only observable in a runtime UAT."

duration: 78min
completed: 2026-09-15
status: complete
---

# Phase 3 Plan 5: Constraint resolution in the cascade Summary

**A dependency that carries a real version constraint is now resolved against it -- its accumulated ranges intersected, a satisfying release tag selected, and its install re-pinned to that tag's commit -- while a dependency with no constraint still makes no network query at all, and an already-installed one is checked rather than touched.**

## Performance

- **Duration:** ~78 min
- **Started:** 2026-09-15T06:18Z
- **Completed:** 2026-09-15T07:36Z
- **Tasks:** 2
- **Files modified:** 10 (0 created, 10 modified)

## Accomplishments

- **`resolveMemberConstraints`** sits between the closure walk and the ledger phase array. That position is the whole rollback story: every constraint verdict is reached before a single `Phase` exists, so no failure arm has anything to unwind. Six of the nine test groups prove it by comparing the whole two-scope footprint before and after.
- **The wildcard short-circuit keeps the common case offline.** An empty accumulator, a bare `*`, an `x`-range, a `>=0.0.0`, and even two separately declared wildcards all resolve with the probe invoked zero times. That last one is why `isUnconstrainedRange` tests canonicalization rather than string identity: `intersectDependencyRanges(["*", "x"])` yields `"* *"`, and a string comparison would have turned two authors both writing "any version" into a network query and, for a source with no release tags, into a failed install.
- **A constrained member is re-pinned end to end.** The probe's selected tag rides `ResolvedCascadeMember.pinnedOid` into the caller's own ledger options builder, out as `InstallLedgerOptions.sourcePinOverride`, and into the git-source resolve callback as the source's `sha` -- which routes the existing clone probe down its already-pinned arm. `install-flow.test.ts` proves the whole chain against a fake git transport: one checkout, at the tag's commit, and the recorded version is `sha-<12hex>` of it.
- **`RESV-05` is a check, never a touch.** An already-installed dependency is not in the closure, so it never becomes a phase; a satisfying recorded version leaves it untouched, and an unsatisfied one fails the whole cascade carrying the recorded version, the rendered constraint and a `why` that distinguishes it from a contradiction between declarations. No tag is ever queried for one.
- **Six failure discriminants, all path-free.** `range-conflict` (two `why` values), `range-too-complex`, `range-invalid`, `no-matching-tag` and `tag-listing-failed`, each carrying the member key and a `renderConstraintRange`-bounded constraint. A 5,390-character declared union reports its constraint truncated at 200 characters with the drop named.
- **`install-cascade.ts` carries complete direct line, branch and function coverage** (branches 97/97, functions 14/14, lines 711/711), and `npm run check` exits 0.

## Task Commits

1. **Task 1: Resolve each member's accumulated constraint to a pin, or fail** - `071d7ff1` (feat)
2. **Task 2: Check an already-installed dependency against the constraint** - `97dde264` (feat)

**Plan metadata:** the `docs(03-05): complete the constraint resolution plan` commit, which carries this file (a commit cannot record its own hash).

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` - the constraint step, its six failure discriminants, `formatConstraintFailure`, the injected `tagProbe`, and the module header's placement and D-03-04 rationale.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` - routes the `constraint-failed` arm into the existing failed-row catch, threads a member's pin into `buildInstallLedgerOptions`, and exposes the `tagProbe` seam.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` - `sourcePinOverride` and the one conditional in the git-source resolve callback that applies it.
- `extensions/pi-claude-marketplace/domain/dependency-range.ts` - `isUnconstrainedRange`.
- `tests/orchestrators/plugin/install-cascade.test.ts` - 33 new cases (48 total in the file).
- `tests/orchestrators/plugin/install-flow.test.ts` - the constraint-failure and end-to-end re-pin cases, plus the fixture knobs both need.
- `tests/orchestrators/plugin/install-outcome.test.ts` - the source-pin override case.
- `tests/domain/dependency-range.test.ts` - 7 cases over the wildcard predicate.
- `tests/architecture/gate-targets.ts` - the inherited `domain/dependency-range.ts` census entry removed; `install-cascade.ts#resolveMemberConstraints` added.
- `scripts/test-coverage-direct.pin.json` - the moved `install-outcome.ts` reading, with the reason recorded.

## Decisions Made

- **D-03-27: the cascade resolves a constrained member's SOURCE itself.** The plan described `resolveMemberConstraints` as taking "the source resolution the cascade already has for each member" -- it had none. The alternative, a second caller-supplied seam, would have needed a defined answer for the case where nothing is injected, and every candidate answer was bad: installing blind defeats the objective, and throwing a composition error puts a wiring defect in front of a user. Reading the member's own marketplace record from the locked snapshot (the closure already proved it present for every non-root member) and parsing its entry's `source` removes the question entirely. The auth bundle comes from `ledgerOptionsFor(member)`, so a tag query and the clone that follows it cannot authenticate differently.
- **D-03-28: `isUnconstrainedRange` belongs to the algebra.** See the accomplishment above -- the string comparison a caller would naturally write is wrong for a real input shape, and the plan's own key link forbids a second evaluator.
- **D-03-29: the re-pin is `sourcePinOverride`, applied as the source's `sha`.** `InstallLedgerOptions` carried no source-ref pin, only `pinVersionOverride` (a recorded version string). Overriding `sha` was chosen over a new probe branch because the clone probe ALREADY has an already-pinned arm: `resolvePluginPin` then `materializePluginClone` at that exact commit. A constrained install therefore adds one conditional and zero new materialization paths, and `deriveInstallVersion` records `sha-<12hex>` of the selected commit with no change of its own.
- **Already-installed members are checked first.** Ordering is not specified by the plan. Checking them before the members this run would install means a cascade that is going to fail on what is already on disk never reaches a remote at all, which is the T-03-19 guard-before-the-work discipline applied at the step level.
- **A non-git-backed source reports `no-matching-tag`.** A path-sourced dependency has no release tags, so a constraint can select none. Giving it a distinct discriminant would have re-introduced exactly the branch-on-source-shape asymmetry D-03-09 declined to port from upstream.
- **`install-cascade.ts` is NOT added to `CREDENTIAL_LEAK_TARGETS`,** on the same reasoning D-03-26 recorded for the probe: it composes a bundle and threads it, and never reads, stores, or renders a credential value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The plan's file list could not carry its own headline truth**

- **Found during:** Task 1
- **Issue:** `files_modified` named `install-cascade.ts` and its test only. Three things made that insufficient. Adding `constraint-failed` to `InstallCascadeResult` broke `install-flow.ts`'s `unwrapCascade` narrowing outright (a type error, Rule 3). More substantially, the plan's own must-have truth is that a constrained dependency "has its install re-pinned to the tag the probe selected" -- and `InstallLedgerOptions` carried no field able to express a source pin, so stopping at the cascade boundary would have shipped a probe whose answer nothing acted on.
- **Fix:** Four production lines outside the plan's list: the `constraint-failed` arm in `unwrapCascade`, the pin spread in `buildInstallLedgerOptions`, `sourcePinOverride` on `InstallLedgerOptions`, and the one conditional in the git-source resolve callback that applies it. Each carries its own test.
- **Files modified:** `install-flow.ts`, `install-outcome.ts`, and their two test files.
- **Verification:** `tests/orchestrators/plugin/install-flow.test.ts#RESV-03: a constrained dependency is materialized at the tag the probe selected` drives the whole chain against a fake git transport and asserts the checkout ref.
- **Commit:** `071d7ff1`

**2. [Rule 2 - Missing critical functionality] The wildcard test by string identity is wrong for a real input**

- **Found during:** Task 1
- **Issue:** The obvious implementation compares the intersected range to `"*"`. `intersectDependencyRanges(["*", "x"])` returns `"* *"`, so a diamond in which two parents both declare `version: "*"` would have been treated as constrained -- querying a repository and, for any source not following the release-tag convention, failing the install over a constraint that constrains nothing.
- **Fix:** `isUnconstrainedRange` in `domain/dependency-range.ts`, testing `validRange(range) === "*"`, which collapses every unconstrained spelling. Seven cases, including the two-wildcard product and the `["*", "^1.0.0"]` control that must NOT read as unconstrained.
- **Files modified:** `extensions/pi-claude-marketplace/domain/dependency-range.ts`, `tests/domain/dependency-range.test.ts`
- **Verification:** `tests/domain/dependency-range.test.ts` -- 7 cases; `dependency-range.ts` stays at complete direct coverage (branches 41/41, functions 13/13, lines 283/283).
- **Commit:** `071d7ff1`

**3. [Rule 3 - Blocker] The census gate failed in a third direction the inherited debt did not name**

- **Found during:** Task 1 (at the architecture-gate verification)
- **Issue:** Deleting the inherited `domain/dependency-range.ts` entry was correct and necessary, but `resolveMemberConstraints` -- exported per the plan's artifact list -- immediately took its place in the census, and the D-07-20 control run (where test files count as entry points) also went red, because nothing at all read the export: the tests all drove `runInstallCascade`.
- **Fix:** The census records `install-cascade.ts#resolveMemberConstraints` with its justification, and a direct unit case now drives the step as a unit, which is what the export is for. Both census cases pass.
- **Files modified:** `tests/architecture/gate-targets.ts`, `tests/orchestrators/plugin/install-cascade.test.ts`
- **Verification:** `node --test tests/architecture/unowned-exports-census.test.ts` -- 3/3 pass.
- **Commit:** `071d7ff1`

**4. [Rule 3 - Blocker] The coverage pin records a reading, not just a file name**

- **Found during:** Task 1 (at `npm run test:coverage:direct`)
- **Issue:** Two separate gate arms fired. `install-flow.ts` fell short by two branches -- the pinned sides of the two new conditional spreads, unreachable from any existing fixture because every install-flow dependency fixture is a path source. And `install-outcome.ts` was already pinned, but the pin stores a `reading` string; adding one covered conditional moved it, which the gate reports as a distinct failure from an unpinned shortfall.
- **Fix:** `InstallPluginOptions` gained the `tagProbe` seam so an install-flow case can resolve a constrained member without a network, and `seedGitSourceMarketplace` gained a `dependentPlugin` knob so the root can be path-sourced while its dependency is git-sourced. That one case covers both branches and is also the end-to-end re-pin proof. The `install-outcome.ts` pin reading was updated with a reason recording that both sides of the new conditional are covered and the deficit is unchanged.
- **Files modified:** `install-flow.ts`, `tests/orchestrators/plugin/install-flow.test.ts`, `scripts/test-coverage-direct.pin.json`
- **Verification:** `npm run test:coverage:direct` exits 0 with "3 pinned shortfall(s) matched ... exactly".
- **Commit:** `071d7ff1`

**5. [Rule 3 - Blocker] Task 2's code had to be pulled back out of task 1's commit**

- **Found during:** Task 1 (at the coverage gate)
- **Issue:** The constraint step is one function, so the already-installed walk was written alongside the rest. `npm run test:coverage:direct` then reported `install-cascade.ts` at branches 86/92 -- the uncovered lines were exactly task 2's producer, and the pre-commit coverage hook would have refused task 1's commit.
- **Fix:** The producer (`checkInstalledMember`, the `alreadyInstalled` option and its loop, and the module header's D-03-04 paragraph) was removed for task 1 and restored in task 2. The `installed-unsatisfied` failure arm and its formatter branch stayed in task 1, covered by the cause-text table, so the vocabulary landed once rather than churning across two commits.
- **Files modified:** none beyond the plan's own list.
- **Verification:** task 1 committed with `install-cascade.ts` at branches 86/86; task 2 at branches 97/97.
- **Commit:** `071d7ff1`, `97dde264`

---

**Total deviations:** 5 auto-fixed (2 Rule 2, 3 Rule 3).
**Impact:** Deviation 1 is the consequential one -- without it the phase would have shipped a tag probe whose selected commit reached the ledger options boundary and stopped there, leaving RESV-03's own success criterion ("re-pinned to the tag the probe selected") false of the running system. Deviation 2 is a real defect the plan's wording would have produced. The three blockers cost commit boundaries and fixture work and changed no specified behaviour.

## Issues Encountered

- **TruffleHog cannot scan this checkout.** `/home/acolomba/src/pi-claude-marketplace-manifest` is a linked git worktree, so `.git` is a file and TruffleHog fails to read the index. Both commits ran `SKIP=trufflehog`, per the repository's own worktree guidance and this phase's precedent. Every other pre-commit hook passed.
- **The 03-02 summary's recorded coercion outcomes do not generalize.** It reports that both fallback version forms "coerce to `123.0.0`". For the shapes this project actually produces they diverge: `hash-123456789abc` coerces to `123456789.0.0`, while `sha-0123456789ab` coerces to nothing at all and therefore satisfies no range. Both are D-03-04 working as decided -- the point is that the outcome is unpredictable -- but the cases here derive their expectations from the ladder rather than from that summary.

## Known Stubs

None. Every arm this plan declares has a producer and a test, and the re-pin reaches a real checkout.

## Threat Flags

None. The plan's register is addressed in code: the intersection runs to a verdict before any query and every failure arm returns without querying, with the per-URL memo bounding a graph to one listing per repository (T-03-19); a re-pin can only select a tag carrying the dependency's own release prefix on the source its own marketplace ENTRY names, never one a declaration supplied (T-03-20); an already-installed member never becomes a ledger phase, so no path can re-materialize, re-pin or re-declare it (T-03-21); every failure arm carries the member key and a `renderConstraintRange`-bounded range and no filesystem path, proved by six cause-text cases (T-03-22); the accumulator is fed only by this install's own graph, proved by the D-03-10 negative (T-03-23); and T-03-24 stays accepted and is now recorded in the module header as well as the algebra's.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The six constraint discriminants are stable and ready for the closed `REASONS` work.** `range-conflict` (with `why: "contradictory-declarations" | "installed-unsatisfied"`), `range-too-complex`, `range-invalid`, `no-matching-tag` and `tag-listing-failed`. Each carries `key` and a bounded `range`; the two conflict arms add `detail` and `recordedVersion` respectively, and `tag-listing-failed` hands over a `classification` that is already a member of the existing vocabulary (`"network unreachable"` / `"authentication required"`).
- **`formatConstraintFailure` is interim prose,** exactly as `formatClosureFailure` is. The messaging plan should replace both call sites in `install-flow.ts::unwrapCascade` with closed-set reasons rather than extend the prose.
- **`InstallPluginOptions.tagProbe`** is the seam any later test needs to drive a constrained cascade without a network; `seedGitSourceMarketplace`'s `dependentPlugin` knob seeds the shape it needs.
- **RESV-03 stays Pending in REQUIREMENTS.md** because plan 03-06 also declares it. RESV-05 is marked complete: 03-01 and this plan were its only two declarers.
- **Decision IDs through D-03-29 are now allocated;** a later plan should mint from D-03-30.

---

_Phase: 03-dependency-resolution_
_Completed: 2026-09-15_

## Self-Check: PASSED

Both modified production modules and this file exist on disk, and both task commits (`071d7ff1`, `97dde264`) are present in the repository.
