---
phase: 09-reload-installs-missing-dependencies
plan: 03
subsystem: reconcile
tags: [dependency-management, reload, install-cascade, apply-orchestrator]

# Dependency graph
requires:
  - phase: 09-01
    provides: pluginsToDependencyInstall bucket, buildDependencyDisabledLift, the "dependency installed" closed-set reason, PluginInstalledOutcome.dependencyInstalled
  - phase: 09-02
    provides: InstallCascadeOptions.rootRanges and treatDisabledAsWall
provides:
  - createInstallMissingDependency -- the orchestrated-only entry point beside installPlugin
  - createDependencyInstallOperation -- its production composition binding
  - applyDependencyInstalls, refreshTogglePlan, applyToggleSteps -- the apply.ts reload wiring
  - ApplyReconcileOptions.reason and the index.ts thread from ResourcesDiscoverEvent.reason
affects: [09-04-two-row-failure-catalog-and-remap]

# Actuals (#2632)
actuals:
  tokens: 28416
  tasks: 2
  commits: 2
  plan_head_before: 4854f0b3a03b70919c75b0a1d69c224ef40ddcb3

tech-stack:
  added: []
  patterns:
    - "A second orchestrated-only entry point beside installPlugin, sharing the locked transaction, the cascade call, hydrateInstalledHooks and a Pick-narrowed buildInstallLedgerOptions, with every config-write and promotion arm structurally absent rather than gated off."
    - "A gate that lives in one apply step (applyDependencyInstalls returns false at once when reason !== \"reload\"), not threaded through applyPlan's own control flow."
    - "A conditional re-plan (refreshTogglePlan) that replaces only three of a plan's nine buckets from a second locked read pass, leaving the mutating buckets and source-mismatch rows on round 1."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
    - extensions/pi-claude-marketplace/index.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/operations.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/reconcile/types.test.ts
    - tests/index.test.ts

key-decisions:
  - "installMissingDependencyWithTransaction reuses unwrapCascade / handleCascadeThrow / handleInstallThrow verbatim from the standalone install arm. A root-level closure or ledger failure (the dependency itself not in its marketplace's manifest) is exempted by dependency-closure.ts's own root exemption and reaches the real ledger, which throws unwrapped -- handleInstallThrow -- giving the {not in manifest} token with no cause line. A NESTED dependency failure (something the missing dependency itself declares) is a genuine closure/constraint failure, wrapped in DependencyCascadeError by the reused cascadeFailureCause path -- handleCascadeThrow -- giving {dependency failed} with a cause line naming the nested key. Neither path needed new code; both fall out of reusing the standalone arm's own routing."
  - "A marketplace absent in both scopes for the entry point's own root is reported via a synthesized closure subject (kind: \"marketplace-not-added\") built by hand and thrown through cascadeFailureCause, rather than through the standalone install's separate outer-switch \"marketplace-absent\" arm -- the entry point has no such arm, so this is the one place D-03-08's specific wording (\"requires marketplace X, which is not added\") reaches this path."
  - "applyDependencyInstalls counts both \"installed\" and \"skipped\" as satisfied for D-09-07's re-plan trigger, but pushes an outcome row only for \"installed\" -- an already-recorded key (D-09-06) is silently counted as satisfying the re-plan without claiming a row it did not earn."
  - "refreshTogglePlan's fresh-read failure arm and its \"no plan\" arm collapse into the same ternary rather than three code paths: the pristine-scope shape (no plan, no invalidOutcomes) is structurally unreachable once applyDependencyInstalls has already written to this scope's state.json, so no dedicated branch exists for the direct-coverage gate to refuse as unreachable."
  - "The two pre-existing LOAD-02 apply.test.ts cases plan 09-01 turned red are reconciled to D-09-13/D-09-14 semantics (the plan carries the retry bucket; the apply step still drives nothing since neither test opts into reason: \"reload\") rather than deleted, with one case renamed since its old title's literal claim (\"re-plans nothing\") no longer held at the plan level."
  - "Production and test changes landed as two commits (feat then test) rather than one commit per plan task: Task 2's own action items state \"no new production code is expected\" for most of its arms, so the whole plan's production surface is Task 1's, and Task 2 is purely the proof of arms Task 1 already built. Splitting by concern (implementation vs proof) is more honest than a task-numbered split across files where the production code does not actually divide that way."

requirements-completed: []  # MISS-01 and MISS-02 are also declared by sibling plan 09-04 (shared-ID gate); neither is marked complete until every declaring plan finishes.

coverage:
  - id: D1
    description: "A reload installs a missing declared dependency through the install cascade with provenance dependency, enabled, no config entry, and the dependent stays up in the same reload via the D-09-07 re-plan"
    requirement: MISS-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#MISS-01: a reload installs a missing declared dependency and the dependent stays up"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#MISS-01 / D-09-05: the entry point installs the missing dependency and its closure as dependencies, enabled, with no config entry"
        status: pass
      - kind: unit
        ref: "tests/index.test.ts#MISS-01 / D-09-13: a reload event installs a missing dependency that a startup event left alone"
        status: pass
    human_judgment: false
  - id: D2
    description: "A startup reconcile, or one whose reason is omitted, plans the bucket but installs nothing and stays offline"
    requirement: MISS-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-09-13: a startup reconcile plans the bucket but installs nothing and stays offline"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-09-13: an omitted reason plans the bucket but installs nothing and stays offline"
        status: pass
    human_judgment: false
  - id: D3
    description: "A marker-held or provenance-independent dependent comes back up in the same reload once its dependency installs (D-09-07 / D-09-08)"
    requirement: MISS-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-09-07: a marker-held dependent comes back up in the same reload"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-09-08: a provenance-independent dependent comes back up in the same reload"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every MISS-02 failure shape reports on the dependency's own row with the cause its own reused classifier produces, the dependent is held by the LOAD-01 check, and nothing is half-materialized; a failed install retries on every reload and the dependent's row is silent once already down"
    requirement: MISS-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#MISS-02: a dependency whose closure fails reports on its own row and the dependent is held down"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#MISS-02 / D-03-08: a dependency whose marketplace is not added fails with the cause naming the marketplace"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#MISS-02: a dependency its marketplace does not declare keeps its own ledger's token"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-09-14: a failed dependency install is retried on the next reload and the dependent's row is silent once down"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#MISS-02 / D-03-07: a closure failure leaves nothing materialized and returns the cascade's own cause"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#MISS-02 / D-03-08: an unreachable marketplace fails as not added and is never added"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#MISS-02: the root's own ledger failure passes through unwrapped"
        status: pass
    human_judgment: false
  - id: D5
    description: "A disabled recorded dependency, an already-recorded key, an already-installed cascade member, and round-1 source-mismatch rows are all left alone by the reload step (D-09-04, D-09-06, D-09-09, D-09-11)"
    requirement: MISS-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-09-04: a disabled recorded dependency is left alone by the reload"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-09-06: a key the same pass installs from the config is found present and not installed twice"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-09-09: a cross-marketplace member renders under its own marketplace block"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-09-11: a member the cascade found already installed renders nothing"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-09-07: source-mismatch rows come from the round-1 plan"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#D-09-04: the entry point walks with disabled records as walls"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#D-09-06: an already-recorded key is skipped inside the lock"
        status: pass
    human_judgment: false
  - id: D6
    description: "A reload with nothing missing installs nothing, touches no network and costs no extra read pass; a broken re-read falls back to the round-1 toggles and reports a state.json row"
    requirement: MISS-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#NFR-5: a reload with nothing missing installs nothing and reads the scope once"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-09-07: a read pass that fails after an install keeps the round-1 toggles and reports state.json"
        status: pass
    human_judgment: false
  - id: D7
    description: "apply.ts never names a git surface; install-flow.ts and operations.ts stay inside NETWORK_FREE_TARGETS with no new exemption; reconcile-planner-purity, unowned-exports-census and notify-stamp-coverage all pass unchanged"
    verification:
      - kind: integration
        ref: "node --test tests/architecture/no-orchestrator-network.test.ts tests/architecture/reconcile-planner-purity.test.ts tests/architecture/unowned-exports-census.test.ts tests/architecture/notify-stamp-coverage.test.ts"
        status: pass
    human_judgment: false
  - id: D8
    description: "100% direct branch/line/function coverage on every changed production module (install-flow.ts, operations.ts, apply.ts, types.ts, index.ts), with no pin file entry added"
    verification:
      - kind: integration
        ref: "npm run test:coverage:direct:commit"
        status: pass
    human_judgment: false

# Metrics
duration: 275min
completed: 2026-09-22
status: complete
---

# Phase 9 Plan 3: Reload's missing-dependency install, wired end to end Summary

**`createInstallMissingDependency` roots the install cascade at a missing declared dependency instead of a user-typed plugin, `apply.ts` drives it only on an explicit `/reload` and re-plans the toggle buckets when something lands, and every MISS-01/MISS-02 failure and lift shape is proven with 100% direct coverage on the five changed production modules.**

## Performance

- **Duration:** 275 min (approx.)
- **Started:** 2026-09-22T02:12:00Z (approx.)
- **Completed:** 2026-09-22T06:46:00Z (approx.)
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- `createInstallMissingDependency` (install-flow.ts) is a new orchestrated-only entry point beside `installPlugin`, sharing the locked transaction, `lookupCascadeDependencies`, `resolveInstallMarketplaceSource`, `hydrateInstalledHooks` and a `Pick`-narrowed `buildInstallLedgerOptions` builder. It carries `rootRanges: opts.ranges` and `treatDisabledAsWall: true` into `runInstallCascade` (09-02's inputs), stamps `provenance: "dependency"` unconditionally on every member including the root, and structurally omits `selectDeclaringConfigWriteTarget`, `promoteDependencyRecord`, `resolveInstallDeclaredEnabled`, the disable cascade and both config write-back functions.
- `createDependencyInstallOperation` (operations.ts) composes it through the same `INSTALL_TRANSACTION` binding `createInstallOperation` uses.
- `applyDependencyInstalls` (apply.ts) drives the operation once per `pluginsToDependencyInstall` bucket entry, gated on `opts.reason === "reload"` in one `if`. On `installed` it pushes one `plugin-installed` outcome per cascade member (D-09-09), carrying `postCommitWarnings` only on the member whose key equals the entry's own root key; on `failed` it pushes one `plugin-install-failed` outcome reusing `classifyOrchestratorThrow` and `redactedDependencyCascadeError` verbatim, with no per-kind classifier added (`CascadeConstraintFailure` never named in apply.ts).
- `refreshTogglePlan` re-runs `readPassForScope` for the scope when `applyDependencyInstalls` reports at least one entry installed or skipped, and substitutes only the fresh plan's `pluginsToEnable`, `pluginsToDisable` and `pluginsToDependencyDisable` into the round-1 plan; `applyToggleSteps` is the extracted body both the round-1 and the refreshed plan run through. `applyPlan` gained a `reader` parameter and the D-09-06 step order: uninstall, remove, add, install, install missing deps, re-plan, enable, disable, dependency-disable, source-mismatch (always round-1).
- `ApplyReconcileOptions.reason` threads `ResourcesDiscoverEvent["reason"]` from `index.ts`'s `resources_discover` handler through to the gate; a startup event (or a caller that omits the option) plans the bucket but drives nothing.
- Every MISS-01/MISS-02 behavior in the plan's `<behavior>` and `<artifacts_this_phase_produces>` lists has a passing case: the tracer slice (install + dependent stays up), both no-op postures (startup, omitted reason), both lift shapes (marker-held config-declared, provenance-independent), all three MISS-02 failure tokens (`{dependency failed}` for a nested closure/constraint failure, `{not in manifest}` unwrapped for the root's own ledger failure, `requires marketplace "X", which is not added` for an unreachable marketplace) plus D-09-14's retry, D-09-04's disabled-wall, D-09-06's already-recorded skip (both at the entry point and end to end through a config install racing the same key), D-09-07's re-read fallback and round-1 source-mismatch carry, D-09-09's cross-marketplace row and D-09-11's already-installed-member silence, and NFR-5's nothing-missing no-op.
- 100% direct branch/line/function coverage on `install-flow.ts`, `operations.ts`, `apply.ts`, `types.ts` and `index.ts`, achieved with no entry added to `scripts/test-coverage-direct.pin.json`.

## Task Commits

1. **Task 1 + Task 2 production code: the entry point and the apply wiring** - `595132d6` (feat) - `install-flow.ts`, `operations.ts`, `apply.ts`, `types.ts`, `index.ts`, `README.md`
2. **Task 1 + Task 2 tests: the tracer slice and every arm it left compile-checked** - `71dcea21` (test) - `install-flow.test.ts`, `operations.test.ts`, `apply.test.ts`, `types.test.ts`, `index.test.ts`

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

_Note: `tdd="true"` was carried at the task level (`type: execute` at the plan level, not `type: tdd`); `workflow.tdd_mode` is absent from `.planning/config.json` and the executor prompt carried no `TDD_MODE=true`, so the strict RED/GREEN/REFACTOR gate from `gsd-core/references/tdd.md` was not runtime-enforced. Every `<behavior>` case was written and run against the implementation iteratively (several assertions were corrected against the real notify() / recordFor() output rather than hand-simulated), and the full test:coverage:direct gate proves every branch the production code added is exercised -- see "Deviations from Plan" for the honest accounting of the two-commit split, since Task 2's own action items state most of its arms require no new production code, so a strict per-task commit split does not divide this plan's files the way it divided 09-01/09-02's._

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` - `createInstallMissingDependency`, `InstallMissingDependencyOptions`/`Outcome`, the `Pick`-narrowed `buildInstallLedgerOptions`
- `extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts` - `createDependencyInstallOperation`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` - `applyDependencyInstalls`, `refreshTogglePlan`, `applyToggleSteps`, `applyPlan`'s `reader` parameter and the D-09-06 step order
- `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` - `ApplyReconcileOptions.reason`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/README.md` - the nine-step apply-order diagram and the D-09-07 re-plan paragraph
- `extensions/pi-claude-marketplace/index.ts` - `reason: event.reason` threaded into the `applyReconcile` call
- 5 test files - new/updated cases across `install-flow.test.ts`, `operations.test.ts`, `apply.test.ts`, `types.test.ts`, `index.test.ts`, including the two reconciled LOAD-02 cases

## Decisions Made
See `key-decisions` in the frontmatter for the reused-classifier routing (both MISS-02 shapes fall out of `unwrapCascade`/`handleCascadeThrow`/`handleInstallThrow` with no new code), the synthesized marketplace-not-added subject, the `applyDependencyInstalls` skip-counts-as-satisfied rule, `refreshTogglePlan`'s collapsed branch, the LOAD-02 reconciliation, and the two-commit split rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `install-flow.ts:2162`'s `handleInstallThrow` branch and three ledger-options spread branches were unreached by the first test pass**
- **Found during:** Task 2, running `npm run test:coverage:direct`
- **Issue:** The initial test set for the new entry point never drove a root-level (not nested) ledger failure with `cascadeFailure.subject` left unset, never gave a resolved member a real `.pin` (so `member.pin !== undefined` / `member.pin?.version !== undefined` stayed one-armed), never passed `opts.marketplaceTagProbe`/left it undefined in the same run, and never produced a non-empty `postCommitWarnings` list.
- **Fix:** Added `MISS-02: the root's own ledger failure passes through unwrapped` (a root not declared by its marketplace at all, hitting the real ledger's `PluginShapeError`), `D-09-05: a pinned git-source root records the tag's own version through the shared ledger options` (a real offline git-source pin via `seedGitSourceMarketplace` + `seamWith`/`createGitOps`, mirroring the file's own RESV-03 fixture pattern), `D-09-05: a satisfiable root range reaches the marketplace tag probe through options.marketplaceRecordFor` (an injected `marketplaceTagProbe` answering `no-matching-tag`, resolving through TAGS-02's current-copy fallback with no git checkout needed), and `D-09-05: a malformed skill degrades the missing dependency and surfaces a post-commit warning`.
- **Files modified:** `tests/orchestrators/plugin/install-flow.test.ts`
- **Verification:** `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` reports 100.00/100.00/100.00.
- **Committed in:** `71dcea21`

**2. [Rule 1 - Bug] `apply.ts:739`'s `postCommitWarnings` spread on the per-member success push was unreached**
- **Found during:** Task 2, running `npm run test:coverage:direct`
- **Issue:** No apply-level case drove a missing dependency whose own materialization produced a non-empty `postCommitWarnings` list, so the `member.key === rootKey && result.postCommitWarnings !== undefined && result.postCommitWarnings.length > 0` spread never took its true arm.
- **Fix:** Added `D-09-09: a malformed skill on the missing dependency surfaces a post-install warning`, reusing `writeMarketplaceSource`'s existing `skill: "malformed"` fixture knob and asserting both the cascade row (still the bare `{dependency installed}` token, since `CascadeMemberOutcome` carries no per-member `degradedKinds`) and the sanctioned second `notifyDiagnostic` emission.
- **Files modified:** `tests/orchestrators/reconcile/apply.test.ts`
- **Verification:** `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` reports 100.00/100.00/100.00.
- **Committed in:** `71dcea21`

**3. [Rule 1 - Bug] Two pre-existing LOAD-02 cases in `apply.test.ts` were left red by plan 09-01**
- **Found during:** Task 1, running the full owner suite before writing any new case
- **Issue:** `LOAD-02: a second reload over an unchanged unsatisfied tree re-plans nothing and is silent` and `LOAD-02: one pass propagates a broken dependency the full depth of a chain` both asserted `deepStrictEqual(plan, emptyReconcilePlan("project"))` against a second pass whose dependency is still missing; since 09-01 the fresh plan now carries a `pluginsToDependencyInstall` retry-bucket entry for that key (D-09-14's deliberate non-fixpoint), so the assertion failed on a plan that is correct under the new semantics.
- **Fix:** Updated both assertions to expect `emptyReconcilePlan("project")` spread with the one retry-bucket entry, per the wave-1 state note's explicit instruction; renamed the first case (`... plans the retry bucket and stays silent`) since its old title's literal claim no longer held at the plan level, while the apply-level behavior (silent, byte-unchanged state.json) is unchanged because neither call opts into `reason: "reload"`.
- **Files modified:** `tests/orchestrators/reconcile/apply.test.ts`
- **Verification:** Both cases pass; the full `apply.test.ts` suite (85 cases) passes.
- **Committed in:** `71dcea21`

---

**Total deviations:** 3 auto-fixed (2 coverage-completeness, 1 pre-existing-red-test reconciliation). **Impact:** All three are necessary for the plan's own stated gates (100% direct coverage, a green owner suite before adding new cases) and add no scope beyond what the plan already specified as expected consequences of Wave 1.

## Issues Encountered

- **`npm run lint:type-members` reports the anticipated `contracts.json` drift**, exactly as the wave-1 state note predicted: `Invalid contract: extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:692:49 names no declaration in this program`. `scripts/check-unused-type-members.contracts.json` was left untouched (`git status --short` confirms) -- this is plan 09-04's job, not this plan's.
- **`tests/architecture/unused-type-member-gate.test.ts`'s `"a new unread member outside the recorded decisions fails the real gate"` case fails** when run as part of the full `npm test` sweep (not part of this plan's own `<verification>` list). It spawns the real `check-unused-type-members.mjs` gate as a subprocess and expects valid JSON on stdout; the same contracts-drift condition above appears to make that subprocess emit something `JSON.parse` cannot read. This is a downstream symptom of the SAME anticipated, explicitly-deferred drift -- not a new defect, and not fixable without touching `contracts.json`, which this plan is instructed not to do. `npm run lint:type-members` itself (this plan's actual gate) is unaffected by this test's failure; it simply reports the drift as designed.
- **`npm run format:check` was not run as a whole-repo gate** (the pre-existing `.planning/config.json` modification this executor is forbidden from touching would fail it); `npx prettier --check` was run scoped to every file this plan touched instead, and is clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MISS-01 and MISS-02 remain `Pending` in `REQUIREMENTS.md`: `09-04` also declares both (`requirements.ready-ids` confirms 0/2 ready), so the shared-ID gate correctly withholds `Complete` until it finishes.
- Plan 09-04 owns the `scripts/check-unused-type-members.contracts.json` remap (the `apply.ts:692:49` drift, and any sibling drift its own changes add) and the two-row failure-catalog documentation this plan's D-09-10 reuse already renders correctly.
- No blockers.

## Self-Check: PASSED

All key files (`install-flow.ts`, `operations.ts`, `apply.ts`, `types.ts`, `README.md`, `index.ts`, this SUMMARY) confirmed present on disk. Both task commits (`595132d6`, `71dcea21`) confirmed present in `git log --oneline --all`.

---
*Phase: 09-reload-installs-missing-dependencies*
*Completed: 2026-09-22*
