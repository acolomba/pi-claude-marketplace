# Phase 9: Reload installs missing declared dependencies - Pattern Map

**Mapped:** 2026-09-21
**Files analyzed:** 11 production + 9 test files
**Analogs found:** 11 / 11 (every new/modified file has a same-file or same-module sibling analog; no analog gap)

RESEARCH.md's "Architecture Patterns" §§1-9 already contain file:line-cited
excerpts for the underlying mechanism (verdict shape, cascade options, install
entry point, apply step, closed-set checklist). This document does not repeat
those; it adds (a) a file classification table, (b) the exact **test**
templates to mirror per paired test file (not covered by RESEARCH.md), (c) the
comment-policy note for this phase's decision IDs, and (d) a tight
per-file "copy this, not that" pointer back into RESEARCH.md's patterns.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog (same file unless noted) | Match Quality |
|---|---|---|---|---|
| `orchestrators/reconcile/dependency-verdict.ts` (extend `UnsatisfiedDeclaration`) | domain/utility (pure, fs-adjacent) | transform | same file, `out-of-range` arm's `range` field | exact |
| `orchestrators/reconcile/plan.ts` (`buildDependencyInstallBucket`) | planner (pure) | CRUD-bucket transform | same file, `buildDependencyDisableBucket` (lines 651-694) | exact |
| `orchestrators/reconcile/plan.ts` (D-09-08 lift walk) | planner (pure) | CRUD-bucket transform | same file, `buildUninstallBucket` (lines 543-586) | exact |
| `orchestrators/reconcile/types.ts` (`PlannedDependencyInstall`, bucket field, `ApplyReconcileOptions.reason`) | model/types | n/a | same file, `PlannedPluginInstall` (93-98) + `emptyReconcilePlan` (252-280) | exact |
| `orchestrators/reconcile/apply.ts` (`applyDependencyInstalls`) | apply-step / orchestrator | request-response (transaction) | same file, `applyPluginInstalls` (535-657) | exact |
| `orchestrators/reconcile/apply.ts` (D-09-07 re-plan) | orchestrator control-flow | event-driven (conditional re-read) | same file, `readPassForScope` call site (`applyReconcileWithReader`, 1071-1180) | exact |
| `orchestrators/reconcile/notify.ts` (preview fold + emptiness count) | renderer (dumb) | transform | same file, `pluginsToDependencyDisable` fold (~439-442) + `isReconcilePlanListEmpty` (491-502) | exact |
| `orchestrators/plugin/install-flow.ts` (new entry point) | service (transaction) | CRUD (install) | same file, `installPluginWithTransaction` (1268-1949), specifically the locked-transaction arm (1330-1480) | exact minus promotion/config-write/DFEN arms |
| `orchestrators/plugin/operations.ts` (`createDependencyInstallOperation`) | service composition | request-response | same file, `createInstallOperation` (82-87) | exact |
| `orchestrators/plugin/install-cascade.ts` (`treatDisabledAsWall`, root-range input) | domain service | transform | same file, `InstallCascadeOptions.installedKeys` / `liveInstalledKeys` call (1123) and `resolveMemberConstraints` (692, 786) | exact |
| `index.ts` (thread `event.reason`) | event handler | event-driven | same file, `event.cwd` thread at the `applyReconcile({ ctx, pi, cwd: event.cwd, ... })` call (line 116) | exact |
| `shared/notification-types.ts` / `shared/notify-reasons.ts` (new `"dependency installed"` literal) | config/closed-set vocabulary | transform | commit `40717eedc39503e2188a0b7e3963bcc568bb7076` (Phase 8, D-08-02) | exact precedent, different commit |

## Pattern Assignments

Each entry below points to the RESEARCH.md pattern that already carries the
concrete excerpt, plus anything RESEARCH.md did not already extract
(test-file templates, comment-policy wording).

### `orchestrators/reconcile/dependency-verdict.ts`

**Analog / excerpt:** RESEARCH.md Pattern 1 (verbatim lines 222-238, 80-89).
Add the optional `ranges?: readonly string[]` field exactly as shown there;
populate only in the `missing` arm using the `ranges` variable already in
scope in the `for (const [key, ranges] of constraintsByKey(declared))` loop.

**Test analog:** `tests/orchestrators/reconcile/dependency-verdict.test.ts` --
find the existing case(s) asserting the `missing` arm's shape (`kind:
"missing"` with no `range`); add a sibling case with multiple declarers of
the same missing key asserting `ranges` carries each declarer's raw text
(not folded -- folding is `install-cascade.ts`'s job per Pattern 2 step 5).

---

### `orchestrators/reconcile/plan.ts` -- `buildDependencyInstallBucket`

**Analog:** `buildDependencyDisableBucket` (`plan.ts:651-694`, reproduced
verbatim in RESEARCH.md's "Code Examples" section). Mirror its shape exactly:
`if (!verdict.ok) return [];` guard, loop `verdict.unsatisfied`, dedupe with
a `Set`, `parsePluginKey` split, push into the bucket array. The one
structural difference: dedupe/group by `entry.dependency` (not
`entry.dependent` -- D-09-05 requires one cascade per missing KEY, not per
holder), and additionally apply D-09-02's three-armed "will be enabled"
predicate against `entry.dependent` before counting a candidate, subtracting
`claimed` (the same set `buildDependencyDisableBucket` already receives,
`plan.ts:596-613`).

**Test template to mirror (verbatim, read this session):**
`tests/orchestrators/reconcile/plan.test.ts:927-965` --
`test("buckets a held-down declarer and plans no enable for it", ...)`. It:
1. builds `merged`/`state` with helper factories (`mergedConfig`,
   `stateWith`, `marketplaceRecord`, `pluginRecord`) already defined at the
   top of the file,
2. constructs a literal `ScopeSatisfactionVerdict` inline (not through
   `buildScopeSatisfactionVerdict` -- LOAD-01's own comment at line 925-926
   says why: "the load-time verdict arrives as precomputed data (D-06-04), so
   every case below states the whole verdict rather than deriving one"),
3. calls `planReconcile(merged, state, "project", verdict)`,
4. asserts the WHOLE plan object via `assert.deepStrictEqual` against every
   field including the untouched buckets as `[]`.

The multi-declarer-dedup case should mirror
`tests/orchestrators/reconcile/plan.test.ts:1003-1020` ("buckets one entry
per held-down declarer however many of its declarations are unsatisfied") but
inverted: two DIFFERENT dependents each declaring the SAME missing
`dependency` key collapse to ONE `pluginsToDependencyInstall` entry carrying
both declarers' `ranges`.

The range-carry case should mirror
`tests/orchestrators/reconcile/plan.test.ts:967-1001` ("carries the declared
range of an out-of-range dependency onto the bucket entry") -- same shape,
but the new bucket carries `ranges: readonly string[]` (raw, unfolded per
RESEARCH.md Pattern 2 step 5), not a single folded `range`.

---

### `orchestrators/reconcile/plan.ts` -- D-09-08 lift walk

**Analog:** `buildUninstallBucket` (`plan.ts:543-586`) for the record-walk
shape (iterate `state.marketplaces`, not declared config); reuse
`isHeldByUnsatisfiedDependency` (`plan.ts:423-425`, already used by
`buildDependencyDisableBucket`'s `isAlreadyDependencyDisabled` check) to test
whether the live verdict still holds a record down.

**Test template:** the apply-level end-to-end analog already exists and is
close enough to double as the plan-level unit test's fixture shape --
`tests/orchestrators/reconcile/apply.test.ts:4095-4160` ("LOAD-02: a
satisfied dependency lifts the hold and the marker leaves the record") seeds
a record with `dependencyDisabled: true`, its dependency now recorded and
enabled, and asserts the marker is gone and the record re-enabled. The
Phase 9 addition is the same lift but for a `provenance: "dependency"`
record (never in config) -- write the `plan.test.ts` unit case first (assert
`pluginsToEnable` contains the record even though `merged` config never
names it), then a `apply.test.ts` end-to-end case mirroring lines 4095-4160
but with the dependent recorded via `provenance: "dependency"` and no config
entry for it, proving D-09-08's "provenance-independent" claim.

---

### `orchestrators/reconcile/types.ts`

**Analog:** `PlannedPluginInstall` (`types.ts:93-98`) for
`PlannedDependencyInstall`'s shape (RESEARCH.md Pattern 2, "Recommended
`PlannedDependencyInstall` type"); `emptyReconcilePlan` (`types.ts:252-280`)
for the new bucket's `[]` default. No dedicated test file -- covered by every
`plan.test.ts` / `apply.test.ts` case that constructs a full plan literal
(all of them, per the `assert.deepStrictEqual(plan, {...})` pattern above --
every existing case needs `pluginsToDependencyInstall: []` added to its
expected object, exactly as the LOAD-01 migration added
`pluginsToDependencyDisable: []` to every pre-existing case; grep count: ~20
sites per the earlier grep of `pluginsToDependencyDisable: [],` in
`plan.test.ts` alone).

---

### `orchestrators/reconcile/apply.ts` -- `applyDependencyInstalls`

**Analog:** `applyPluginInstalls` (`apply.ts:535-657`); RESEARCH.md Pattern 6
gives the exact divergence points (per-member outcome loop over
`result.members`, `dependencyInstalled?: true` boolean signal field on the
outcome, failure path reuses `classifyOrchestratorThrow` /
`redactedDependencyCascadeError` verbatim from `apply.ts:636-655`).

**D-09-07 re-plan:** RESEARCH.md Pattern 7 gives the extraction shape
(`applyToggleSteps` helper, called once per round) and Pattern 7's own
"Lock safety" subsection is the load-bearing proof that a second
`readPassForScope` call is safe -- copy that reasoning into the plan's
task description rather than re-deriving it.

**Test template:** `tests/orchestrators/reconcile/apply.test.ts:1997-2183`
(the `RESV-06` block) is the closest analog for a per-member success/failure
outcome assertion against a real cascade (uses `createOfflineGitOps` /
`createNotificationBoundary` / `seedState` / `writeMarketplaceSource`
helpers already defined in the file -- reuse them, do not redefine). The
`LOAD-02` block (`4095-4360`, four consecutive cases) is the closest analog
for the "second pass over the SAME reload" shape D-09-07 needs -- mirror
`"LOAD-02: a second reload over an unchanged unsatisfied tree re-plans
nothing and is silent"` (4162+) for the "nothing installed -> read-pass plan
stands" idempotent case, and `"LOAD-02: restoring the dependency lifts the
whole chain in one pass"` (4287+) for the multi-hop success case this phase's
D-09-08 lift interacts with.

**Failure-row test:** write this FIRST per RESEARCH.md's Pitfall 2 --
assert the ACTUAL `reason` a synthetic `constraint-failed` cascade result
produces (likely the generic `{dependency failed}` token per **Contradictions
/ risks R1** in RESEARCH.md, not the specific per-kind tokens D-09-10's prose
names) before writing any PLAN.md bullet describing the row's wording.

---

### `orchestrators/reconcile/notify.ts`

**Analog:** the `pluginsToDependencyDisable` -> `will disable` preview fold,
and the `installedRowFromOutcome` reasons-derivation pattern (`notify.ts:549-560`,
RESEARCH.md Pattern 6's third bullet) for reading a new boolean-ish outcome
field (`dependencyInstalled`) the same way `orphanRewake` /`degradedKinds`
are read today.

**Test template (verbatim, read this session):**
`tests/orchestrators/reconcile/notify.test.ts:1622-1649` -- the
table-driven case list (`{ bucket, actions, expectedRow }`) that already has
a `pluginsToDependencyDisable` row; add a `pluginsToDependencyInstall` row
to the SAME table with `expectedRow: { status: "will install", name: ... }`
per D-09-12. For the `{dependency installed}` outcome-row test, find (not
yet located this session -- verify during planning) the case(s) asserting
`orphanRewake` reasons on a `plugin-installed` outcome and mirror that shape
for the new `dependencyInstalled` field.

**Emptiness-count test:** `tests/orchestrators/reconcile/notify.test.ts:1963-1984`
(`describe("isReconcilePlanListEmpty", ...)`) -- add a case with only
`pluginsToDependencyInstall` populated, asserting `planListEmpty === false`,
mirroring the existing all-empty-plans case's shape.

---

### `orchestrators/plugin/install-flow.ts` -- new entry point

**Analog:** RESEARCH.md Pattern 5 gives the complete 8-step recipe (skip
`selectDeclaringConfigWriteTarget` / `promoteDependencyRecord`, unconditional
`provenance: "dependency"`, skip the DFEN-04 arm, reuse `unwrapCascade` /
`handleCascadeThrow` / `handleInstallThrow` verbatim). The `treatDisabledAsWall`
cascade option and `effectiveRanges` helper are Pattern 5's own recommended
mechanism for D-09-04's wall behavior and D-09-05's root range, respectively
-- do not re-derive; copy the `effectiveRanges` function shown there
verbatim as the starting point.

**Comment-policy note:** any comment anchoring this new function to a
decision cites `D-09-05` / `D-09-04` / `D-04-01` etc. (allowed per
`skills/typescript-comments/SKILL.md`'s "Allowed ... traceability anchors"
list) but never `Phase 9` or a bare `Pitfall N` / `Pattern N` (both
forbidden by the same skill file -- RESEARCH.md's own "Pitfall 1" / "Pattern
5" numbering is a RESEARCH.md-local index, not a citable token in source).
Where a comment would explain "why not reuse `installPluginWithTransaction`
verbatim," state the present-tense fact (no config write, no promotion for a
dependency-provenance record) rather than narrating "unlike the existing
function" framing that references removed/alternate code shapes.

**Test analog:** `tests/orchestrators/plugin/install-flow.test.ts` -- locate
the existing `installPluginWithTransaction` success/failure case pairs
(promotion arm, DFEN-04 landed-disabled arm) and write the new entry point's
cases by REMOVING assertions on config write / promotion / landed-disabled
from copies of those cases, per D-09-05's "this arm minus promotion, config
selection/write and the DFEN arms" framing.

---

### `orchestrators/plugin/install-cascade.ts` -- root-range + wall option

**Analog:** RESEARCH.md Pattern 5's `effectiveRanges` helper and the three
read sites it replaces (`install-cascade.ts:504,692,786`); the
`treatDisabledAsWall` gate at the `liveInstalledKeys` call
(`install-cascade.ts:1123`).

**Test template:** `tests/orchestrators/plugin/install-cascade.test.ts:606`
(`installedKeys: new Set([\`bar@${MARKETPLACE}\`])`) is the existing pattern
for asserting a pre-seeded `installedKeys` set changes closure behavior --
mirror it for `treatDisabledAsWall: true` with a DISABLED (not absent)
member in `installedKeys`, asserting the closure treats it as already
satisfied (a wall) rather than walking through it. For the root-range input,
find the existing member-constraint-folding test (`resolveMemberConstraints`
/ `intersectDependencyRanges` cases) and add a root-keyed case asserting
`effectiveRanges` folds the caller-supplied `rootRange` into the root
member's own (empty) `ranges` before intersection.

---

### `index.ts`

**Analog:** the `event.cwd` thread at the `applyReconcile({ ctx, pi, cwd:
event.cwd, hooksRouting, completionCache })` call (`index.ts:116` per
RESEARCH.md Pattern 8). Add `reason: event.reason` alongside it, one new
property on the same object literal -- no control flow change in `index.ts`
itself; the gate lives in `apply.ts`.

**Test analog:** `tests/index.test.ts:534` already defines a
`resourcesDiscoverEvent` helper returning `{ type: "resources_discover",
cwd, reason: "startup" }` -- this event shape already carries `reason`, so
the test-side plumbing exists; verify (during planning) whether any
`index.test.ts` case asserts the exact `applyReconcile` call arguments (spy)
and, if so, add `reason: "startup"` / `reason: "reload"` to that assertion.

---

### `shared/notification-types.ts` / `shared/notify-reasons.ts` / the closed-set checklist

**Analog:** commit `40717eedc39503e2188a0b7e3963bcc568bb7076` ("feat(08-03):
the row says so, and dependency disabled leaves the closed set"), file list
and checklist fully enumerated in RESEARCH.md Pattern 9 (9 numbered steps).
Do not re-derive the file list -- RESEARCH.md already ran `git show --stat`
this session and the 12-file list there is verbatim. Where RESEARCH.md's
Assumptions Log (A1-A5) flags an unread exact line for
`compat-01-no-expansion.test.ts`, `notification-types.test.ts`,
`check-unused-type-members.contracts.json`, and the exact fixture file, read
those files during planning before writing the corresponding task (do not
carry the uncertainty into PLAN.md as a TODO).

**Comment-policy note for `notify-reasons.ts`'s new paragraph:** the header
docstring convention there cites decision IDs (`D-08-02`'s paragraph is the
template per RESEARCH.md) -- the new paragraph for `"dependency installed"`
cites `D-09-09`, never `Phase 9` or `(Phase 8 precedent)`.

## Shared Patterns

### Fail-closed verdict guard
**Source:** every `plan.ts` bucket builder's `if (!verdict.ok) return [];`
(e.g. `buildDependencyDisableBucket`, `plan.ts:657-659`).
**Apply to:** `buildDependencyInstallBucket` and the D-09-08 lift walk --
both must return/skip on an incomplete verdict rather than acting on partial
data (D-05-07 fail-closed posture, cited in RESEARCH.md Pattern 3).

### RECON-03 per-step try/catch discipline
**Source:** every existing `applyPlan` step function in `apply.ts` (uninstall,
marketplace add/remove, install, toggle, dependency-disable, source-mismatch),
each wrapped so one step's failure does not abort the others.
**Apply to:** `applyDependencyInstalls` and the D-09-07 re-plan wrapper --
per Claude's Discretion in CONTEXT.md, extract as another step function
under the same discipline, never widen an existing `if`.

### `notify.ts` is a dumb renderer
**Source:** `notify.ts` module header comment (`notify.ts:515-528`, cited in
RESEARCH.md Pattern 6) and the project MEMORY note "notify.ts is a dumb
renderer" -- commands/orchestrators stamp status, reasons and severity;
`notify.ts` only maps outcome shape to row.
**Apply to:** `installedRowFromOutcome`'s new `dependencyInstalled` read and
the new bucket's preview fold -- add a boolean/enum signal field to the
outcome type; do not add branching logic that inspects cascade internals
inside `notify.ts`.

### Closed-set amendment mechanism (D-04-07 / D-05-11 / D-08-02 precedent)
**Source:** RESEARCH.md Pattern 9, the full 9-step checklist and the Phase 8
commit's 12-file list.
**Apply to:** the single new `"dependency installed"` `Reason` literal --
every one of the 9 checklist steps is load-bearing; a partial edit fails CI
(five-plus independent architecture/unit gates per RESEARCH.md's "Don't
Hand-Roll" table), not silently.

### One fold site for range intersection
**Source:** `intersectDependencyRanges` (`domain/dependency-range.ts:203`),
already the sole caller inside `install-cascade.ts` (lines 692, 786).
**Apply to:** `buildDependencyInstallBucket` must NOT call
`intersectDependencyRanges` itself -- carry raw `ranges: readonly string[]`
through the bucket entry and let the cascade's existing fold site (via the
new `effectiveRanges` helper) do the one fold, per RESEARCH.md's explicit
Anti-Pattern warning.

## No Analog Found

None. Every file in RESEARCH.md's "Recommended Project Structure" has a
same-file or same-repo sibling analog (the closed-set amendment is the one
item without a same-file analog, but has a full commit-level precedent,
Phase 8's `40717eedc3950`).

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/orchestrators/`,
`extensions/pi-claude-marketplace/shared/`, `extensions/pi-claude-marketplace/index.ts`,
`tests/orchestrators/`, `tests/integration/reconcile-plan-convergence.test.ts`,
`tests/index.test.ts`, git history for commit `40717eedc39503e2188a0b7e3963bcc568bb7076`.
**Files scanned this session:** `09-CONTEXT.md`, `09-RESEARCH.md` (full),
`orchestrators/reconcile/plan.test.ts` (targeted ranges 1-40, 920-1020),
`orchestrators/reconcile/apply.test.ts` (targeted ranges around LOAD-01/02
and RESV-06 blocks, 4095-4165), `orchestrators/reconcile/notify.test.ts`
(targeted ranges 1620-1655, 1960-1984), `tests/index.test.ts` (grep only,
line 534 helper), `install-cascade.test.ts` / `install-flow.test.ts` (grep
only), `skills/typescript-comments/SKILL.md` (full), `.claude/rules/typescript-style.md`.
**Pattern extraction date:** 2026-09-21

## PATTERN MAPPING COMPLETE
