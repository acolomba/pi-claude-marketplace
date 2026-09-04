# Phase 113: Orchestrator Support and Presenters - Research

**Researched:** 2026-08-31
**Domain:** TypeScript unit-test refactor for orchestrator support modules and command presenters
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Milestone test contract carried forward

- **D-01:** Normalize and re-prove all 35 owners, including accepted-HEAD `PASS` tests.
  Baseline triage is input, not completion evidence.
- **D-02:** Every runtime case uses separate lowercase `// arrange`, `// act`, and
  `// assert` phases with the canonical blank lines. Lowercase `// act & assert` is
  limited to one `assert.throws()` or `assert.rejects()` expression. Data rows use
  separate phases.
- **D-03:** Every case constructs complete, case-local inputs and independently authored
  complete expectations. Small concern-local factories may return fresh setup values but
  must not calculate expected results or become shared scenario oracles.
- **D-04:** Type-only modules and contracts stay at module scope through positive
  `satisfies` checks and targeted negative `@ts-expect-error` checks. Do not invent
  runtime assertions for erased types or widen production exports for tests.

### Classifiers and planners

- **D-05:** Use partition-complete behavior matrices. Cover every meaningful decision
  branch and boundary, and exhaustively enumerate a state space only when it is small and
  closed. Do not multiply behaviorally equivalent input combinations.
- **D-06:** Assert the complete structured return value for every case, including action
  or classification, codes, reasons, severity, scope, ordering, diagnostics, and true
  omission of optional fields. Downstream effects are not a substitute for the direct
  helper contract.
- **D-07:** Exercise malformed and unexpected values only where they can enter through a
  real untrusted boundary such as files, environment, subprocess results, or external
  data. Do not use casts to fabricate impossible internal union members merely to reach
  an `assertNever` or defensive default.
- **D-08:** Express large matrices as named literal table cases. Each row carries its
  input and complete expected result; input factories may reduce setup noise, but no
  test-side reference implementation may derive the answer.

### Message producers

- **D-09:** Prove both owned layers: the complete structured message or command context
  and the exact rendered row bytes produced by that module. Shared notification behavior
  stays in its owner unless the presenter controls the label, cardinality, trailer, or
  other final bytes.
- **D-10:** Ordering is contract-specific. Alphabetize inventories and presentation-only
  collections. Preserve caller input, scope precedence, outer-loop order, reason order,
  and lifecycle operation order wherever sequence carries behavior.
- **D-11:** Cover the complete reload and trailer matrix: exact presence or absence,
  wording, blank-line placement, relationship to tallies, and singular/plural behavior.
- **D-12:** Cover every status arm and every reasons, dependencies, causes, scope, and
  severity variation that changes output or severity. Leave impossible field/status
  combinations to the discriminated TypeScript types rather than forcing them with casts.

### Offline collaborator boundaries

- **D-13:** Use a fresh real temporary filesystem for owned file semantics. Use injected,
  hand-written fakes for git, network, subprocess, credentials, and Pi API boundaries.
  Never mock the production module under test.
- **D-14:** Prove read-only paths stay offline in two layers: owner cases use fail-fast
  external fakes that reject any unexpected call, and architecture tests prohibit direct
  network imports. Successful execution alone is not sufficient offline evidence.
- **D-15:** Assert collaborator arguments, counts, and order when they define public
  behavior, including scope precedence, cache reuse, host selection, or once-only
  authentication. Avoid freezing incidental call structure that can change without
  changing the contract.
- **D-16:** Inject failures at every semantically distinct collaborator operation,
  including selected later calls in multi-call schedules. Assert the complete result or
  diagnostic, cleanup, and whether remaining work continues or stops.

### Ordering and isolation

- **D-17:** Alphabetize user-facing inventories, static catalogs, and non-behavioral test
  tables. Preserve execution, scope, declaration, and lifecycle sequences whose order is
  behavior. Document the reason when a visibly unsorted expectation is intentional.
- **D-18:** Every case owns its temporary tree, fake state, inputs, and expectations.
  Capture exact environment-property existence and value before mutation, restore it in
  `finally`, and never depend on another case's execution or cleanup.
- **D-19:** Create fresh maps, authentication memos, caches, and collaborators per case.
  Exercise unavoidable persistent module state through existing public lifecycle APIs or
  process isolation. Do not add test-only reset exports or cache-busting imports.
- **D-20:** Move single-module assertions into the mirrored owner. Retain supplemental
  tests only for genuine cross-module, integration, parity, or architecture contracts,
  and remove redundant fixtures or assertions that would create a competing owner. —
  **Reversibility:** costly — restoring duplicate suites would weaken the milestone's
  one-source-to-one-owner contract.

### the agent's Discretion

- Choose exact case names and the smallest partition table that proves every distinct
  result while honoring the locked completeness rules.
- Choose concern-local input factories and hand-written fake shapes, provided every call
  returns fresh state and no helper derives expected outcomes.
- Decide which exact presenter assertions belong in a messaging owner versus the shared
  notification owner, using module responsibility and direct coverage as the boundary.
- Choose which existing supplemental tests remain, and document the distinct cross-module
  contract for every retained suite.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| MOD-06 | DATA_8M2K4Q_START “All 35 orchestrator support and presenter pairs complete the pair contract.” DATA_8M2K4Q_END [VERIFIED: .planning/REQUIREMENTS.md:119-120] | The ownership matrix below maps all 35 pairs, the measured baseline distinguishes missing from incomplete owners, and the validation architecture defines focused execution plus direct function/line/branch coverage for every pair. [VERIFIED: .planning/ROADMAP.md:394-447; .planning/REQUIREMENTS.md:330-368] |
</phase_requirements>

## Summary

Phase 113 is a test-ownership refactor, not a workflow redesign. It must deliver exactly 35 mirrored owners, including the one pair currently marked `PASS`; 23 owner files are absent and 12 exist but require normalization or re-proof. The phase acceptance contract is that every owner runs alone and directly covers only its paired source at 100 percent function, line, and branch coverage. [VERIFIED: .planning/ROADMAP.md:394-447; .planning/REQUIREMENTS.md:330-368]

The main planning risk is not raw test count. It is preserving four distinct contracts while consolidating ownership: complete structured returns, exact command-owned row bytes, offline external boundaries, and behavior-specific ordering. The current tests also contain competing ownership (barrel imports, helper assertions in lifecycle tests, and support-module assertions in supplemental files), so each plan must inventory and either move or explicitly retain those assertions before it writes new cases. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:24-111; code/test import audit on 2026-08-31]

**Primary recommendation:** Keep the roadmap's one-plan-per-pair shape; inside every plan, perform ownership consolidation first, build a literal partition matrix second, run the focused owner, then run `test:coverage:direct` against that exact source before any broader suite. [VERIFIED: .planning/REQUIREMENTS.md:94-106; .claude/rules/typescript-unit-testing.md:24-32]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Auth host selection and clone auth bundles | API / Backend | External credential and Device Flow ports | The orchestrator selects a host, binds injected credential/Device Flow collaborators, and memoizes per host; it must not persist credentials. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/auth-host.ts:59-150] |
| Filesystem discovery, settings import, clone/path support | API / Backend | Database / Storage | These modules coordinate local filesystem/state/config reads and return deterministic domain values; external git/subprocess work stays behind explicit ports. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/discover.ts:17-127; extensions/pi-claude-marketplace/orchestrators/import/settings.ts:28-142; extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:158-579] |
| Classifiers, update-row composition, reconcile planning | API / Backend | — | These are pure or near-pure decision functions over resolved inputs and structured state. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts:120-196; extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts:93-147; extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:409-448] |
| Command-specific message production | API / Backend | Browser / Client (Pi UI consumer) | Each messaging module owns typed status projection and row rendering; shared notify code owns generic cascade reduction, tallies, and trailers. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:153-156,189-196] |
| Scope fan-out and import/reconcile composition data | API / Backend | Database / Storage | The support layer reads per-scope state/config and preserves project-before-user or lifecycle order for downstream orchestrators. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts:42-98; extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts:211-238] |

## Project Constraints (from AGENTS.md)

- A `.codegraph/` index exists, so code discovery and source tracing must use `codegraph explore` before grep/find or direct file inspection. This research followed that sequence for the orchestrator clusters. [VERIFIED: AGENTS.md:1-12; `.codegraph/` existence check on 2026-08-31]
- CodeGraph indexing remains a user decision; do not rebuild or replace the index as phase work. [VERIFIED: AGENTS.md:4-10]
- No other actionable project-specific directives are present in `AGENTS.md`. [VERIFIED: AGENTS.md:1-12]

## Standard Stack

### Core

| Library / tool | Version | Purpose | Why standard here |
|---|---:|---|---|
| Node.js `node:test` | Local `v26.7.0`; CI Node `24` | Runner, per-test lifecycle, context-local mocks, coverage | The canonical rule requires `node:test`; CI intentionally runs a single Node 24 lane. Node documents that every test context owns a `MockTracker` and that its tracker is reset after the test. [VERIFIED: .claude/rules/typescript-unit-testing.md:12-22; .github/workflows/ci.yml:46-78] [CITED: https://nodejs.org/download/release/v24.15.0/docs/api/test.html] |
| `node:assert/strict` | Built into Node | Complete structural and exact byte assertions | The canonical rule requires strict Node assertions and whole-value comparisons. [VERIFIED: .claude/rules/typescript-unit-testing.md:12-20,89-109] |
| TypeScript | `^6.0.3` (installed `6.0.3`) | Strict compile-time contracts and type-only owners | The repository enables `strict`, `noEmit`, `noImplicitReturns`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. [VERIFIED: package.json:14-30; tsconfig.json:2-20] |
| `strong-mock` | `^9.2.2` | Exact interaction mocks when interaction is public behavior | It is already the mandated strict-mock tool; no new test library is needed. [VERIFIED: package.json:14-30; .claude/rules/typescript-unit-testing.md:111-151] |

### Supporting

| Tool / asset | Version | Purpose | When to use |
|---|---:|---|---|
| `scripts/test-coverage-direct.mjs` | Repository script | Maps one production path to its mirrored owner, executes it with LCOV, and rejects any incomplete branch/function/line count | Run after the focused test for every runtime pair; it recognizes erased type-only modules as `type-only`. [VERIFIED: scripts/test-coverage-direct.mjs:25-69,176-235,237-288] |
| Real Node filesystem temporary directories | Built in | File, path, encoding, cleanup, and ordering behavior | Use one new directory per case for discovery, settings, path, clone metadata, state, and GC semantics. [VERIFIED: .claude/rules/typescript-unit-testing.md:221-229] |
| Existing architecture gates | Repository tests | Structural offline, credential-leak, planner-purity, catalog, and producer-wire guarantees | Retain when they prove a cross-module or architecture property; do not duplicate their assertions inside a single-module owner. [VERIFIED: tests/architecture/no-orchestrator-network.test.ts:1-140; tests/architecture/no-credential-leak.test.ts:1-140; tests/architecture/reconcile-planner-purity.test.ts:1-70; tests/architecture/notify-producer-wire-coverage.test.ts:1-75] |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| `node:test` + `node:assert/strict` | Another runner/assertion library | Forbidden by the canonical project rule and would add migration surface without improving the pair contract. [VERIFIED: .claude/rules/typescript-unit-testing.md:12-22] |
| Real temp filesystem | Function-graph filesystem mocks | Cannot faithfully prove stored bytes, path semantics, permissions, or cleanup and is explicitly disallowed for filesystem behavior. [VERIFIED: .claude/rules/typescript-unit-testing.md:122-126,221-229] |
| Injected hand fakes / strict mocks | Module replacement or cache-busting imports | Violates the no-module-replacement and no-test-reset contract and risks cross-case state. [VERIFIED: .claude/rules/typescript-unit-testing.md:151,182-209] |

**Installation:** None. This phase uses the existing dependency graph and must not add a runner, assertion library, or mocking library. [VERIFIED: package.json:8-30; .claude/rules/typescript-unit-testing.md:12-22]

## Package Legitimacy Audit

Not applicable: Phase 113 installs no external packages. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:7-15; package.json:8-30]

## Current Ownership and Coverage Baseline

The inventory currently contains 12 mirrored owner files and 23 missing owner files. All 12 existing owners have zero canonical lowercase arrange/act/assert markers, so none should be treated as normalized merely because it passes its current cases. The three import owners also import through `orchestrators/import/index.ts` instead of their concrete paired modules. [VERIFIED: filesystem and test-source audit on 2026-08-31; .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:24-35]

Focused direct-coverage measurements for the 12 present owners give the planner a starting point, not acceptance evidence: [VERIFIED: `node scripts/test-coverage-direct.mjs <source>` runs on 2026-08-31]

| Pair | Current direct result | Most useful first gap |
|---|---|---|
| P113-01 | FAIL — functions `4/5`, lines `133/150` | `buildCloneAuth()` is not directly covered. [VERIFIED: direct-coverage run; extensions/pi-claude-marketplace/orchestrators/auth-host.ts:133-150] |
| P113-02 | FAIL — branches `25/27`, functions `6/7`, lines `119/129` | Missing entry filtering and `lstat`/symlink failure paths around lines 80-96. [VERIFIED: direct-coverage run; extensions/pi-claude-marketplace/orchestrators/discover.ts:74-99] |
| P113-04 | FAIL — branches `42/43`, lines `166/168` | One planner branch remains uncovered; replace barrel imports before closing it. [VERIFIED: direct-coverage run; import audit on 2026-08-31] |
| P113-05 | PASS — branches `17/17`, functions `4/4`, lines `79/79` | Re-author as direct-import, lowercase-AAA, complete-return cases despite the accepted coverage baseline. [VERIFIED: direct-coverage run; .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:24-35] |
| P113-06 | FAIL — branches `25/27`; functions and lines complete | Close the remaining environment/path alternatives and restore exact property existence/value in `finally`. [VERIFIED: direct-coverage run; extensions/pi-claude-marketplace/orchestrators/import/settings.ts:28-142] |
| P113-12 | FAIL — branches `11/13`, functions `2/11`, lines `390/652` | The current owner concentrates on refresh/cascade behavior; most exported scope, visibility, autoupdate, and failure-narrowing seams are not owned directly. [VERIFIED: direct-coverage run; extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:191-625] |
| P113-15 | FAIL — branches `38/45`, functions `6/11`, lines `412/579` | Cover cold/warm clone, mirror refresh, same-repository seeding, pin resolution, subdir validation, auth propagation, and each injected git failure. [VERIFIED: direct-coverage run; extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:158-579] |
| P113-16 | FAIL — branches `17/18`, lines `107/110` | A non-`ENOENT` directory read error currently remains uncovered. [VERIFIED: direct-coverage run; extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts:75-110] |
| P113-20 | FAIL — branches `34/39`, functions `5/6`, lines `239/262` | Consolidate mirror-head error suites and cover upgrade-candidate plus resolver/probe failure folds. [VERIFIED: direct-coverage run; extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts:56-262] |
| P113-24 | FAIL — branches `19/20`, lines `196/197` | The only uncovered runtime is the exhaustive `assertNever` default; D-07 forbids an impossible cast, so the pair should remove or structurally eliminate dead runtime code while preserving compile-time exhaustiveness. [VERIFIED: direct-coverage run; extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts:172-196; .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:46-49] |
| P113-26 | FAIL — branches `58/62`, functions `10/30`, lines `921/1243` | Most shared resolution/config/adoption/conflict/removal/fold/warning functions still need owner cases. [VERIFIED: direct-coverage run; extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:121-1243] |
| P113-31 | FAIL — branches `52/54`, lines `437/448` | Cover recorded-source claim selection and the claimed-record branch without deriving the expected plan. [VERIFIED: direct-coverage run; extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:125-171,409-448] |

## All 35 Pair Research Map

Each row below is one executable plan and one eventual pair-atomic commit; do not merge rows because they share a directory or a presenter vocabulary. [VERIFIED: .planning/REQUIREMENTS.md:94-106; .planning/ROADMAP.md:409-447]

| Pair | Mirrored owner | HEAD | Prescriptive owner focus and likely gap |
|---|---|---:|---|
| P113-01 `auth-host.ts` | `tests/orchestrators/auth-host.test.ts` | COVERAGE_FAIL | Partition clone URL host extraction, unsupported provider cause, credential hit/miss, Device Flow success/failure, host-keyed memo reuse/isolation, and `buildCloneAuth`; assert no credential value reaches notifications or persisted state. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/auth-host.ts:59-150; .planning/REQUIREMENTS.md:334] |
| P113-02 `discover.ts` | `tests/orchestrators/discover.test.ts` | COVERAGE_FAIL | Use a fresh real tree for user/project resources, alphabetical directory reads, file-vs-directory-vs-symlink filtering, benign missing roots, aggregated hard errors, frozen output, and fixed user-then-project / skills-then-prompts sequencing. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/discover.ts:10-129; .planning/REQUIREMENTS.md:335] |
| P113-03 `import/execute.messaging.ts` | `tests/orchestrators/import/execute.messaging.test.ts` | MISSING | Cover every `IMPORT_CONTEXT` render arm with complete typed messages and exact bytes; vary causes, versions, scopes, reasons, severity, and reload only where the module owns them. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts:53-119; .planning/REQUIREMENTS.md:336] |
| P113-04 `import/marketplaces.ts` | `tests/orchestrators/import/marketplaces.test.ts` | COVERAGE_FAIL | Import the concrete module and prove source mapping, deduplication, skipped/unmappable refs, diagnostics, both scopes, and deterministic output order with whole import plans. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts:98-168; .planning/REQUIREMENTS.md:337] |
| P113-05 `import/refs.ts` | `tests/orchestrators/import/refs.test.ts` | PASS | Re-prove parsing and extraction through direct imports: valid refs, malformed refs, non-boolean entries, enabled/disabled selection, ordering, and complete diagnostics rather than counts or single properties. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/import/refs.ts:10-79; .planning/REQUIREMENTS.md:338] |
| P113-06 `import/settings.ts` | `tests/orchestrators/import/settings.test.ts` | COVERAGE_FAIL | Prove path resolution and precedence, missing files, malformed JSON, wrong shapes, merge diagnostics, and exact environment restoration using one temporary tree per case. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/import/settings.ts:28-142; .planning/REQUIREMENTS.md:339] |
| P113-07 `import/types.ts` | `tests/orchestrators/import/types.test.ts` | MISSING | Compile-only owner: positive `satisfies` checks for every public contract plus targeted negatives for diagnostic codes, parse-result discriminants, scope plans, and required/omitted fields; zero invented runtime cases. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/import/types.ts:3-99; .planning/REQUIREMENTS.md:340] |
| P113-08 `marketplace/add.messaging.ts` | `tests/orchestrators/marketplace/add.messaging.test.ts` | MISSING | Prove the context label and every owned row/reason arm, including the intentionally empty render set where applicable; compare exact output bytes rather than reusing shared render helpers for expectations. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts:36-55; .planning/REQUIREMENTS.md:341] |
| P113-09 `marketplace/autoupdate.messaging.ts` | `tests/orchestrators/marketplace/autoupdate.messaging.test.ts` | MISSING | Cover both enable and disable contexts, success/failure message shapes, scope and cause variations, exact labels/rows, and any reload difference between the two commands. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.messaging.ts:44-65; .planning/REQUIREMENTS.md:342] |
| P113-10 `marketplace/list.messaging.ts` | `tests/orchestrators/marketplace/list.messaging.test.ts` | MISSING | Prove list context identity and its empty per-row renderer contract; keep inventory ordering assertions with the lifecycle/list owner if this module does not sort. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts:22-29; .planning/REQUIREMENTS.md:343] |
| P113-11 `marketplace/remove.messaging.ts` | `tests/orchestrators/marketplace/remove.messaging.test.ts` | MISSING | Cover uninstalled and failed rows, private reason narrowing, scope/cause/severity, exact bytes, and reload/trailer ownership without re-testing the generic notify reducer. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts:33-57; .planning/REQUIREMENTS.md:344] |
| P113-12 `marketplace/shared.ts` | `tests/orchestrators/marketplace/shared.test.ts` | COVERAGE_FAIL | One top-level `describe` per export: refresh auth/subprocess schedules; cascade cleanup and later-call failures; autoupdate classification; project-before-user scope resolution; visible marketplace loading; and failure narrowing. Never let the live `DEFAULT_GIT_OPS` run in owner cases. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:57-625; .planning/REQUIREMENTS.md:345] |
| P113-13 `marketplace/update.messaging.ts` | `tests/orchestrators/marketplace/update.messaging.test.ts` | MISSING | Cover all context arms plus `outcomeToCascadePluginMessage`, including clean/partial/skip/failure projections, complete structured rows, exact bytes, severity, dependencies, reason order, and reload. Move direct projection assertions out of `marketplace/update.test.ts`. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts:51-168; supplemental import audit on 2026-08-31] |
| P113-14 `plugin-path.ts` | `tests/orchestrators/plugin-path.test.ts` | MISSING | Consolidate the old `tests/shared/plugin-path.test.ts` assertions; prove enabled-record filtering, invalid sources, user/project path contribution order, PATH ledger no-op/apply behavior, and per-scope read failures with exact skipped diagnostics. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin-path.ts:35-115; supplemental import audit on 2026-08-31] |
| P113-15 `plugin/clone-cache.ts` | `tests/orchestrators/plugin/clone-cache.test.ts` | COVERAGE_FAIL | Build explicit git/auth fakes and cover every exported operation across cold/warm/cache-miss/cache-hit, pin/subdir, seed reuse, cleanup, and semantically distinct git failures; consolidate single-module default/seed supplementals. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:158-579; .planning/REQUIREMENTS.md:348] |
| P113-16 `plugin/clone-gc.ts` | `tests/orchestrators/plugin/clone-gc.test.ts` | COVERAGE_FAIL | Use real state/cache trees; prove absent cache, live-key retention, safe deletion, per-delete leak diagnostics/continuation, and non-`ENOENT` read propagation. Move probe assertions out of this owner. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts:75-110; competing import audit on 2026-08-31] |
| P113-17 `plugin/discover-names.ts` | `tests/orchestrators/plugin/discover-names.test.ts` | MISSING | Prove skills → commands → agents call order, exact arguments, complete combined output, selected agent source directory, and failure stop/continuation behavior at each call. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts:25-67; .planning/REQUIREMENTS.md:350] |
| P113-18 `plugin/enable-disable.messaging.ts` | `tests/orchestrators/plugin/enable-disable.messaging.test.ts` | MISSING | Cover both contexts, every status arm, stale-gate drop and enable/disable failure narrowing, all output-changing reason/cause/dependency/severity variants, and exact bytes; move direct helper assertions out of lifecycle tests. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts:47-215; supplemental import audit on 2026-08-31] |
| P113-19 `plugin/fetch.messaging.ts` | `tests/orchestrators/plugin/fetch.messaging.test.ts` | MISSING | Cover the six-arm typed context, full probe/reason/scope/dependency shapes, exact rows, severity, and reload behavior; do not call the fetch lifecycle or network from this presenter owner. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts:37-96; .planning/REQUIREMENTS.md:352] |
| P113-20 `plugin/git-source-probe.ts` | `tests/orchestrators/plugin/git-source-probe.test.ts` | COVERAGE_FAIL | Consolidate mirror-head and upgrade supplementals; prove filesystem-only mirror presence, SHA parsing/errors, cold git → remote, strict-resolver results, resolver/probe failure folds, and `undefined` upgrade candidates with fail-fast no-git/network evidence. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts:43-262; supplemental import audit on 2026-08-31] |
| P113-21 `plugin/info.messaging.ts` | `tests/orchestrators/plugin/info.messaging.test.ts` | MISSING | Prove the skip-only cascade context, exact label and row bytes, reasons/scope/severity variations, and type rejection of impossible non-skip shapes. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts:56-84; .planning/REQUIREMENTS.md:354] |
| P113-22 `plugin/install.messaging.ts` | `tests/orchestrators/plugin/install.messaging.test.ts` | MISSING | Cover all context arms and the five exported failure/composition helpers with literal matrices for entity-shape, resolver reasons, formatted causes, partial/full failure, dependencies, severity, and omission. Move direct helper assertions from `plugin/install.test.ts`; retain only lifecycle integration there. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts:79-641; supplemental import audit on 2026-08-31] |
| P113-23 `plugin/list.messaging.ts` | `tests/orchestrators/plugin/list.messaging.test.ts` | MISSING | Exercise every typed render-map arm and exact row bytes, including clean, partial, remote, disabled, failed, and upgrade variants; alphabetize only presentation inventories while preserving reason order. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts:69-166; .planning/REQUIREMENTS.md:356] |
| P113-24 `plugin/plugin-state-classifier.ts` | `tests/orchestrators/plugin/plugin-state-classifier.test.ts` | COVERAGE_FAIL | Replace scenario-oracle fixtures with literal partition rows; prove disabled precedence, degraded/candidate combinations, all valid resolver states, and complete string returns. Do not fabricate a fourth resolver union arm for the dead default. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts:44-196; .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:39-52] |
| P113-25 `plugin/reinstall.messaging.ts` | `tests/orchestrators/plugin/reinstall.messaging.test.ts` | MISSING | Cover the context plus partition renderer, outcome projections, and reason narrowing; assert grouping/order/cardinality, exact rows, manual-recovery/failure variations, tallies/trailers owned here, and move direct helpers from lifecycle tests. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts:59-449; supplemental import audit on 2026-08-31] |
| P113-26 `plugin/shared.ts` | `tests/orchestrators/plugin/shared.test.ts` | COVERAGE_FAIL | Partition every exported shared seam: cross-scope target/source resolution, target-scope cloning, declaring config selection/adoption, installed target lookup, version/source-dir choice, conflict detection, record removal/writeback, partial cascade fold, marketplace-not-added emission, and warning splitting/surfacing. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:121-1243; .planning/REQUIREMENTS.md:359] |
| P113-27 `plugin/uninstall.messaging.ts` | `tests/orchestrators/plugin/uninstall.messaging.test.ts` | MISSING | Cover uninstalled/failure rows, exact fields and bytes, scope/cause/severity/reload behavior, and compile-time rejection of impossible shapes. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts:50-61; .planning/REQUIREMENTS.md:360] |
| P113-28 `plugin/update-row.ts` | `tests/orchestrators/plugin/update-row.test.ts` | MISSING | Use a literal cross-product only for output-changing axes: orphan rewake, malformed kinds, dropped kinds, agent/MCP dependencies, and caller severity policy; assert reason order, full row, `needsReload`, and true absence of `reasons`. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts:43-147; .planning/REQUIREMENTS.md:361] |
| P113-29 `plugin/update.messaging.ts` | `tests/orchestrators/plugin/update.messaging.test.ts` | MISSING | Prove every update status arm, exact rows, clean/partial/degraded/failed variations, dependency/reason ordering, severity, reload, and type-only impossible combinations without invoking lifecycle update. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts:33-97; .planning/REQUIREMENTS.md:362] |
| P113-30 `reconcile/apply-outcomes.ts` | `tests/orchestrators/reconcile/apply-outcomes.test.ts` | MISSING | Combine compile-time coverage of the large outcome union with runtime literal matrices for subject projection, orchestrator/read-pass throw classification, typed migration save errors, and dependency extraction; assert complete error fields and omission. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:36-452; .planning/REQUIREMENTS.md:363] |
| P113-31 `reconcile/plan.ts` | `tests/orchestrators/reconcile/plan.test.ts` | COVERAGE_FAIL | Keep the owner purely behavioral: literal inputs and full seven-bucket plans for add/remove/enable/disable/mismatch/dangling/malformed/invalid, source identity claims, claim order, and deterministic output. Retain the separate architecture purity gate. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:409-448; tests/architecture/reconcile-planner-purity.test.ts:1-70] |
| P113-32 `reconcile/reconcile.messaging.ts` | `tests/orchestrators/reconcile/reconcile.messaging.test.ts` | MISSING | Cover both pending and applied contexts, every valid status, exact structured rows and rendered bytes, reason/scope/severity/reload variants, and command-owned labels/cardinality; leave shared reducer tallies/trailers in notify owners unless this context changes final bytes. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts:68-231; .planning/REQUIREMENTS.md:365] |
| P113-33 `reconcile/types.ts` | `tests/orchestrators/reconcile/types.test.ts` | MISSING | Use runtime cases only for `plannedSourceMismatchSubject()` and `emptyReconcilePlan()`; cover the remaining planned-outcome/config/read contracts at module scope with positive and negative type checks. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts:50-295; .planning/REQUIREMENTS.md:366] |
| P113-34 `scope-fanout.ts` | `tests/orchestrators/scope-fanout.test.ts` | MISSING | Use real per-scope state/config trees; prove explicit-scope and absent-scope paths, project-before-user outer-loop order, skip-without-config-read for absent records, autoupdate defaulting, declared-enabled omission, and each later-scope read failure. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts:24-99; .planning/REQUIREMENTS.md:367] |
| P113-35 `orchestrators/types.ts` | `tests/orchestrators/types.test.ts` | MISSING | Compile-only owner for reinstall/update/install outcome unions and bridge/failure contracts; use `satisfies` positives and narrow `@ts-expect-error` negatives with zero runtime assertions. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/types.ts:15-469; .planning/REQUIREMENTS.md:368] |

## Architecture Patterns

### System Architecture Diagram

```text
filesystem / env / persisted state          injected credentials / git / subprocess / Pi ports
                |                                             |
                v                                             v
      support owner modules ------------------------> explicit boundary seams
                |                                  (fail fast in offline tests)
                v
     classifiers / import planners / reconcile planner / update-row composer
                |
                +-------------------- decision branch ---------------------+
                |                                                         |
                v                                                         v
       complete structured value                              typed status-specific message
                                                                          |
                                                                          v
                                                           module-owned render-map row bytes
                                                                          |
                                                                          v
                                                          shared notify reducer / Pi UI wire
```

The diagram reflects the current responsibility split: support modules own local I/O and boundary coordination, pure functions own decisions, messaging modules own status projection and row bytes, and shared notify modules own generic cascade reduction. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:151-199]

### Recommended Project Structure

```text
extensions/pi-claude-marketplace/orchestrators/
├── <support>.ts                       # paired production source
├── import/
├── marketplace/
├── plugin/
└── reconcile/

tests/orchestrators/
├── <support>.test.ts                  # sole mirrored owner
├── import/
├── marketplace/
├── plugin/
└── reconcile/
```

The mirrored path mapping is mechanical: the direct-coverage script converts a production path under the extension root into the same relative path under `tests/` with `.test.ts`. [VERIFIED: scripts/test-coverage-direct.mjs:10-69]

### Pattern 1: One Concrete Source, One Mirrored Owner

**What:** Import the concrete paired module, not a barrel, and place all single-module assertions in that mirrored owner. [VERIFIED: .claude/rules/typescript-unit-testing.md:24-32,221]

**When to use:** Every P113 row, including message modules, type-only modules, and the already-passing refs pair. [VERIFIED: .planning/ROADMAP.md:413-447]

**Planning rule:** Begin each plan with a repository import scan for its source. Classify every other test as `move`, `retain-cross-module`, or `remove-duplicate`, and record the distinct contract for every retained supplemental. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:96-111]

### Pattern 2: Literal Partition Matrix with Independent Answers

**What:** One sibling `test()` per named row; the row contains the behavior-driving input and the complete expected return or row bytes. Do not compute expected results using production-like branching. [VERIFIED: .claude/rules/typescript-unit-testing.md:153-179; .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:39-52]

**When to use:** Classifiers, import/ref planners, update-row, reconcile plan, apply outcomes, and every presenter render map. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts:120-196; extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts:93-147; extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:409-448]

### Pattern 3: Two-Layer Presenter Proof

**What:** First deep-compare the complete status-specific structured message or exported context. Then call the module's owned render-map arm and compare the exact row string. Use the shared notify wire only when the module owns label, cardinality, tally, trailer, or final blank-line placement. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:54-67,189-196]

**When to use:** All 15 messaging owners: P113-03, 08-11, 13, 18-19, 21-23, 25, 27, 29, and 32. [VERIFIED: .planning/ROADMAP.md:415-445]

### Pattern 4: Two-Layer Offline Proof

**What:** Owner cases inject fail-fast collaborators for every external surface and assert no unexpected call. Existing architecture tests separately prohibit forbidden git/network imports on read-only modules. One layer cannot substitute for the other. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:69-83; tests/architecture/no-orchestrator-network.test.ts:1-140]

**When to use:** Auth, marketplace shared, clone cache, probe, and any read-only path whose transitive collaborators could otherwise reach git/network/subprocess/credentials/Pi. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/auth-host.ts:78-150; extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:106-191; extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts:117-262]

### Pattern 5: Compile-Only Type Owner

**What:** Keep positive `satisfies` and targeted `@ts-expect-error` expressions at module scope. A type-only test may run with zero Node test cases; the direct-coverage script treats a fully erased source as `type-only`. [VERIFIED: .claude/rules/typescript-unit-testing.md:211-219; scripts/test-coverage-direct.mjs:166-235]

**When to use:** P113-07 and P113-35 entirely; P113-30 and P113-33 for their type surfaces alongside runtime tests for actual functions/classes. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/import/types.ts:3-99; extensions/pi-claude-marketplace/orchestrators/types.ts:15-469; extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:292-452; extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts:202-238]

### Anti-Patterns to Avoid

- **Coverage-first impossible casts:** Do not cast a fabricated union member into an exhaustive default. Remove dead runtime structure or prove a real untrusted boundary instead. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:46-49; .claude/rules/typescript-unit-testing.md:30-31]
- **Barrel-based owner imports:** The three existing import owners currently hide the concrete ownership edge through `import/index.ts`; direct owners must import their actual paired modules. [VERIFIED: current test import audit on 2026-08-31; .claude/rules/typescript-unit-testing.md:221]
- **Presenter snapshots or shared formatter expectations:** They can reproduce a wrong formatter and hide byte regressions. Author expected strings independently. [VERIFIED: .claude/rules/typescript-unit-testing.md:89-109]
- **A generic orchestrator test helper directory:** Concern-local factories are allowed only when they return fresh setup and do not calculate answers; generic `helpers`, `utils`, or `mocks` support is forbidden. [VERIFIED: .claude/rules/typescript-unit-testing.md:190-192; .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:30-32]
- **Process-wide mock/reset state:** Use the current test context or a fresh in-case strict mock; do not use global registries, test-only reset exports, or cache-busting imports. [VERIFIED: .claude/rules/typescript-unit-testing.md:128-151; .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:90-95]

## Direct-Coverage Methodology

Use the following per pair, in this order: [VERIFIED: .claude/rules/typescript-unit-testing.md:24-32,233-256; scripts/test-coverage-direct.mjs:237-288]

1. Run the mirrored owner alone with `node --test <owner-test-path>`. [VERIFIED: .claude/rules/typescript-unit-testing.md:30-32]
2. Run `npm run test:coverage:direct -- <production-source-path>`. The script resolves the exact owner, executes only that file with Node coverage, selects exactly one LCOV record for the source, and requires `hit === found` for branches, functions, and lines. [VERIFIED: package.json:82-90; scripts/test-coverage-direct.mjs:197-235,237-288]
3. For a truly erased type-only module, run `npm run typecheck` and the direct script; zero runtime cases are correct and the script returns `type-only`. [VERIFIED: scripts/test-coverage-direct.mjs:166-195,207-235; .claude/rules/typescript-unit-testing.md:211-219]
4. After a shared contract, fake, harness, or architecture carrier changes, run `npm run test:coverage:direct:all`; otherwise keep the plan's mandatory proof focused on its one pair. [VERIFIED: .claude/rules/typescript-unit-testing.md:30-32; package.json:88-90]
5. Run the full quality gate before phase completion. The repository's `check` script includes typecheck, lint, fallow, formatting, unit tests, and integration tests; CI executes it on Node 24. [VERIFIED: package.json:75-88; .github/workflows/ci.yml:58-78]

Node's official coverage interface exposes per-file and total line, branch, and function data, and threshold failures can exit nonzero. The repository's LCOV script is stricter for this milestone because it maps one owner to one source rather than accepting aggregate percentages. [CITED: https://nodejs.org/download/release/v24.15.0/docs/api/test.html] [VERIFIED: scripts/test-coverage-direct.mjs:197-235]

## Reusable Seams and Ownership Boundaries

| Seam | Reuse | Boundary to preserve |
|---|---|---|
| Test-context `t.mock` | One-shot sequences, spies, timers, and automatic per-case restoration | Never import the process-wide tracker; Node resets the context tracker after each test. [CITED: https://nodejs.org/download/release/v24.15.0/docs/api/test.html] [VERIFIED: .claude/rules/typescript-unit-testing.md:22,124-151] |
| `strong-mock` | Git, credential, subprocess, Pi, notification, and callback interactions whose exact call is public behavior | Create and verify inside each case; use exact parameters and no unconstrained count. [VERIFIED: .claude/rules/typescript-unit-testing.md:128-147] |
| Real temporary filesystem | Discovery, settings, state/config, clone metadata, path, and GC semantics | One directory per case, cleanup in `finally` or `t.after`, never repository/home/fixed paths. [VERIFIED: .claude/rules/typescript-unit-testing.md:221-229] |
| Exported command contexts | Direct access to module-owned status projection and render map | Assert exact owned rows; do not duplicate generic notify tally/trailer behavior unless the context changes it. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:153-156,189-196] |
| `tests/helpers/source-scan.ts` | Existing architecture scans such as forbidden network surface | Architecture only; do not use source scanning as a substitute for runtime owner behavior. [VERIFIED: tests/architecture/no-orchestrator-network.test.ts:1-140] |
| `test-coverage-direct.mjs` | Pair mapping and exact LCOV acceptance | It is the acceptance gate, not a case generator; cases must still discriminate behavior. [VERIFIED: scripts/test-coverage-direct.mjs:25-69,197-288; .claude/rules/typescript-unit-testing.md:8-10] |

## Supplemental-Test Consolidation

| Existing supplemental location | Required disposition |
|---|---|
| `tests/shared/plugin-path.test.ts` | Move single-module `plugin-path.ts` assertions to P113-14 and remove the competing owner. [VERIFIED: supplemental import audit on 2026-08-31; D-20] |
| Mirror-head and git-probe supplementals, plus probe imports in `clone-gc.test.ts` | Move direct `git-source-probe.ts` assertions to P113-20; leave P113-16 with clone-GC behavior only. [VERIFIED: supplemental import audit on 2026-08-31; D-20] |
| Clone-cache defaults/seed supplementals | Move direct clone-cache assertions to P113-15; retain install/update/reinstall cases only when they prove a distinct lifecycle/auth integration. [VERIFIED: supplemental import audit on 2026-08-31; D-20] |
| `marketplace/update.test.ts` presenter projection assertions | Move `outcomeToCascadePluginMessage()` direct cases to P113-13; retain lifecycle orchestration only. [VERIFIED: supplemental import audit on 2026-08-31; D-20] |
| Enable/disable, install, and reinstall lifecycle tests importing messaging helpers | Move helper classification/projection cases to P113-18, P113-22, and P113-25; retain end-to-end lifecycle composition where independently valuable. [VERIFIED: supplemental import audit on 2026-08-31; D-20] |
| `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | Retain only if it compares two real surfaces; document that parity contract and remove any duplicate one-module fixtures/assertions. [VERIFIED: supplemental import audit on 2026-08-31; D-20] |
| Reconcile notify/apply/backfill and plan-convergence/config-consistency suites | Retain genuine cross-module projection, convergence, and architecture contracts; move direct PENDING status/render or pure planner assertions into P113-32/P113-31. [VERIFIED: supplemental import audit on 2026-08-31; tests/architecture/reconcile-planner-purity.test.ts:1-70] |
| Catalog UAT, producer-wire coverage, no-network, no-credential-leak, planner-purity | Retain as architecture/parity owners; do not reproduce their full wire or scan assertions inside each mirrored owner. [VERIFIED: tests/architecture/catalog-uat.test.ts; tests/architecture/notify-producer-wire-coverage.test.ts:1-75; tests/architecture/no-orchestrator-network.test.ts:1-140; tests/architecture/no-credential-leak.test.ts:1-140] |

## Edge and Failure Matrices

### Local Filesystem, Environment, and Scope

| Boundary | Minimum distinct cases | Required complete assertions |
|---|---|---|
| Discovery directories | Present files; absent root; non-directory entry; symlink/lstat behavior; `ENOENT`/`ENOTDIR`; another read error; later scope failure | Full frozen resource object or typed aggregate error, exact error collection/order, and whether remaining directories/scopes were visited. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/discover.ts:17-129] |
| Claude settings | Default and overridden paths; one/both files absent; malformed JSON; wrong root shape; non-boolean plugin entry; user/project merge | Full paths/merged object/diagnostics in emitted order, plus exact prior environment-property existence/value restored in `finally`. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/import/settings.ts:28-142; .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:90-92] |
| Plugin PATH | Enabled/disabled record; valid/invalid resolved source; no bins; one/both scopes; state-read failure; no-op vs ledger application | Complete bin list or recompute result, preserved user/project contribution order, exact skipped scopes/causes, and PATH ledger calls only when behavior requires them. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin-path.ts:35-115] |
| Clone GC | Cache absent; live vs stale keys; multiple stale targets; selected delete failure; directory read hard failure | Complete leak diagnostics, exact surviving/deleted tree, continue-after-delete-failure, stop-on-read-failure. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts:75-110] |
| Scope fan-out | Explicit scope; no scope; record absent in first/second/both scopes; config flag present/absent; first/second read failure | Whole rows, project-before-user outer-loop order, default autoupdate, truly omitted/undefined declaration semantics, and no config read for an absent record. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts:42-99] |

### Credentials, Git, Cache, and Probe

| Boundary | Minimum distinct cases | Required complete assertions |
|---|---|---|
| Auth host | GitHub/url/git-subdir host extraction; provider absent; credential hit; Device Flow fallback/success/failure; repeated same host; different hosts | Complete bundle/absence, exact selected host, once-only auth per memo key, no cross-host reuse, and redacted notification/error behavior. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/auth-host.ts:59-150] |
| Marketplace git operations | Auth/no-auth; clone/refresh success; each subprocess step failure; cleanup/unstage later-call failure | Full return/typed error, exact behavioral call schedule and arguments, cleanup result, and continue/stop policy. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:106-390] |
| Clone cache | Cold materialize; warm reuse; mutable refresh; same-repo seeding; pin hit/miss; valid/invalid subdir; selected git operation failure | Full resolved paths/pins, exact cache tree, host auth propagation, no extra git calls on warm/offline paths, cleanup on failed cold materialization. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:158-579] |
| Git-source probe | Mirror absent/present; head SHA valid/missing/invalid; cold git source; resolver installable/partial/unavailable; resolver/probe throws; upgrade candidate success/failure | Full classification/result or `undefined`, exact cause/reason shape, and zero imports/calls to live git/network. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts:56-262] |

### Pure Decisions and Plans

| Owner | Partition axes | Ordering/omission assertions |
|---|---|---|
| Plugin state classifier | Enabled vs explicitly disabled; clean vs unsupported; no candidate vs candidate; candidate resolution clean/partial/unavailable/unprobeable | Exact classification string; disabled precedence; no impossible fourth resolver state. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts:44-196] |
| Update row | Orphan rewake; malformed component kinds; dropped kinds; agents/MCP declarations; clean/partial caller severity | Exact whole row; reason order is orphan → malformed → dropped; dependency order is agents → MCP; `reasons` key absent on clean rows; reload true. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts:93-147] |
| Reconcile plan | Config/state presence; enabled mismatch; source identity/mismatch; dangling/malformed key; invalid config block; claimed stored record | Full plan with every bucket; deterministic claim and bucket order; no I/O or notification surface. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:1-448; tests/architecture/reconcile-planner-purity.test.ts:1-70] |
| Apply outcomes | Each source-mismatch arm; recognized orchestrator error vs unknown throw; migration save error; read-pass error; install dependency flags | Exact subject/classification/error class and fields/dependency tuple; compile-time rejection of invalid discriminant/field combinations. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:258-452] |

### Presenter Matrix

For each messaging owner, build the matrix from its exported discriminated union and render map rather than a global guessed list. Every valid status gets at least one exact whole-message and exact-row case; add rows only when reasons, dependencies, causes, scope, severity, or reload changes output. Invalid field/status combinations stay compile-time-only. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:54-67]

The reconcile pending status source-of-truth is DATA_R5J2N8_START `"will install"`, `"will uninstall"`, `"will enable"`, `"will disable"`, `"failed"` DATA_R5J2N8_END. The applied source-of-truth is DATA_K3D9W1_START `"installed" | "uninstalled" | "disabled" | "failed" | "partially-installed"` DATA_K3D9W1_END. Test only these valid arms and field variations admitted by their unions. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts:68-82,152-159]

For reload/trailer cases, separate four questions: whether any row has `needsReload`, whether the command context changes trailer wording, whether a tally precedes the trailer, and whether singular/plural text changes with cardinality. Assert blank lines as bytes. The output catalog and messaging style guide are the acceptance sources, not a test-side formatter. [VERIFIED: docs/messaging-style-guide.md:1-185; docs/output-catalog.md:1-2754; .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:56-67]

## Ordering, Offline, and Isolation Constraints

| Contract | Preserve | Do not normalize |
|---|---|---|
| Presentation inventories | Alphabetical names and static/nonbehavioral case tables | Do not alphabetize causal reason arrays or lifecycle operations. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:60-62,87-89] |
| Scope search | Project before user when the source defines that precedence | Do not sort returned rows after the outer loop. DATA_3H7Q9P_START `opts.scope === undefined ? ["project", "user"] : [opts.scope]` DATA_3H7Q9P_END is the fan-out source of truth. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts:55-68] |
| Discovery composition | User locations before project locations and each module's declared resource traversal | Do not infer alphabetical ordering across scopes from alphabetical directory entries. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/discover.ts:17-65] |
| Update reasons | Orphan rewake, then malformed kinds, then dropped kinds | Do not sort reasons alphabetically; order communicates how the row was composed. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts:80-84,98-115] |
| Update dependencies | Agents before MCP | Do not preserve arbitrary input booleans as a different tuple order. DATA_6V4C2T_START `...(declaresAgents ? (["agents"] as const) : []), ...(declaresMcp ? (["mcp"] as const) : [])` DATA_6V4C2T_END. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts:137-147] |
| Auth/cache | One fresh memo/cache per case; same-host reuse inside that case only | Do not share module-scope maps or add reset exports. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:93-95; extensions/pi-claude-marketplace/orchestrators/auth-host.ts:78-131] |
| Environment | Capture property existence and value, mutate, restore in `finally` | Do not equate an absent property with a property present as `undefined`. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:90-92; tsconfig.json:2-18] |
| External surfaces | Fail-fast fakes in owner cases plus architecture import gates | A passing read-only case without an injected fail-fast port is not offline proof. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:71-83; tests/architecture/no-orchestrator-network.test.ts:1-140] |

## Recommended Plan and Wave Shape

Every plan remains pair-atomic even when executed in a wave. The following ordering is a planner recommendation derived from runtime/type dependencies; independent rows within a wave can execute in parallel if they do not touch the same supplemental file. [VERIFIED: .planning/REQUIREMENTS.md:94-106; dependency/import audit on 2026-08-31]

| Wave | Pairs | Why |
|---|---|---|
| 1 — Type and pure leaves | P113-05, 07, 24, 28, 30, 33, 35 | These owners establish type contracts and pure projections used by later message/reconcile owners; P113-24 also resolves the dead exhaustive branch policy early. [VERIFIED: source import graph inspected with CodeGraph on 2026-08-31] |
| 2 — Local support and planners | P113-01, 02, 04, 06, 14-17, 20, 31, 34 | These are filesystem/boundary/planner seams consumed by lifecycle/composition phases and mostly independent of message contexts. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:157-174,191-199] |
| 3 — Large shared seams | P113-12, 26 | Each source has many exports and substantial uncovered behavior; isolate them from competing supplemental edits and run direct-all only if shared harness/contract files change. [VERIFIED: direct-coverage runs; extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:57-625; extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:121-1243] |
| 4 — Presenters | P113-03, 08-11, 13, 18-19, 21-23, 25, 27, 29, 32 | Presenter owners can reuse the now-stable type/projection leaves; specifically P113-13 follows P113-28 and P113-32 follows P113-30/P113-33 if source edits occur. [VERIFIED: source import graph inspected with CodeGraph on 2026-08-31] |

Within each plan, use the same task order: ownership/import inventory → literal matrix and fresh support → focused test → direct coverage → relevant architecture/parity tests → typecheck/lint/format → pair-atomic commit during execution. The research task itself must not commit. [VERIFIED: .claude/rules/typescript-unit-testing.md:233-256; .planning/REQUIREMENTS.md:94-106]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Pair coverage | A new coverage parser or aggregate percentage script | Existing `test-coverage-direct.mjs` | It already owns mirrored mapping, type-only detection, LCOV selection, and exact hit/found checks. [VERIFIED: scripts/test-coverage-direct.mjs:25-69,145-235] |
| Message expectations | A reference renderer, snapshot serializer, or output normalizer | Independently authored exact strings plus the exported render map as the action | A shared bug between production and expected formatter would make the test vacuous. [VERIFIED: .claude/rules/typescript-unit-testing.md:89-109] |
| Filesystem semantics | A graph of fs mocks | One real temporary tree per case | Paths, stored bytes, missing entries, and cleanup are the behavior. [VERIFIED: .claude/rules/typescript-unit-testing.md:122-126,221-229] |
| Git/network/process boundary | A partial emulation of isomorphic-git or a live remote | Narrow injected fake/strict mock; existing architecture scan | Tests remain offline and failure schedules are explicit. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:71-83] |
| Type-only runtime proof | Dummy assertions or widened exports | `satisfies`, `@ts-expect-error`, strict `tsc` | Erased contracts are compiler behavior, not runtime behavior. [VERIFIED: .claude/rules/typescript-unit-testing.md:211-219] [CITED: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html] [CITED: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html] |
| Cross-case cleanup | Reset registries, test-only reset exports, cache-busting imports | Fresh construction, context-local mocks, `finally`, or process isolation | Shared mutable cleanup is itself an ordering dependency and violates locked D-19. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:90-95; .claude/rules/typescript-unit-testing.md:36-42,151] |

**Key insight:** This phase should remove duplicated test ownership and hidden state, not create a second orchestration or rendering implementation inside the test tree. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:24-35,96-111]

## Runtime State Inventory

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | None requiring migration. The phase preserves public state formats and uses case-owned temporary state/config/clone files only. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:7-15,71-73] | No data migration; create and remove fresh temporary trees inside each case. [VERIFIED: .claude/rules/typescript-unit-testing.md:221-229] |
| Live service config | None. Read-only owner tests must not contact external services, and this phase does not edit configuration held in a UI/database outside git. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:69-83] | Use fail-fast injected external ports and retain architecture network gates. [VERIFIED: tests/architecture/no-orchestrator-network.test.ts:1-140] |
| OS-registered state | None. No systemd/launchd/task/process registration or system PATH mutation is part of the phase; plugin PATH behavior is tested through its existing ledger seam. [VERIFIED: phase source inventory in .planning/ROADMAP.md:413-447; extensions/pi-claude-marketplace/orchestrators/plugin-path.ts:35-115] | No OS migration; do not mutate the developer's global PATH. [VERIFIED: .claude/rules/typescript-unit-testing.md:182-188] |
| Secrets/env vars | No key rename or secret migration. Settings/auth cases can observe process environment or credentials, but must capture/restore environment properties and keep credential values in memory. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:71-76,90-92; tests/architecture/no-credential-leak.test.ts:1-140] | Restore environment in `finally`; use injected credentials; never serialize or print secret material. [VERIFIED: .claude/rules/typescript-unit-testing.md:229; tests/architecture/no-credential-leak.test.ts:1-140] |
| Build artifacts / installed packages | No package or emitted-build change. TypeScript is `noEmit`; direct coverage creates an isolated temporary LCOV directory and removes it in `finally`. [VERIFIED: tsconfig.json:2-20; scripts/test-coverage-direct.mjs:237-264] | No artifact migration; leave package manifests/lockfile unchanged unless an independently justified production dependency appears, which current scope does not require. [VERIFIED: package.json:8-30] |

**Canonical runtime-state answer:** After every repository test/source edit is complete, no external runtime system should retain a renamed or migrated value because Phase 113 introduces no rename, schema migration, service registration, or package installation. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:7-15]

## Common Pitfalls

### Pitfall 1: Treating `PASS` as Finished

**What goes wrong:** P113-05 keeps weak, barrel-based, noncanonical tests because its current coverage is complete. [VERIFIED: direct-coverage and import audit on 2026-08-31]

**Why it happens:** Coverage answers reachability, not ownership, expectation independence, or case structure. [VERIFIED: .claude/rules/typescript-unit-testing.md:8-10,24-42]

**How to avoid:** Re-author the accepted pair under D-01 through D-04 and rerun direct coverage. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:22-35]

**Warning signs:** Barrel import, partial property assertions, missing lowercase phases, or generic names such as `result`. [VERIFIED: current test audit; .claude/rules/typescript-unit-testing.md:34-52,89-109]

### Pitfall 2: Chasing an Unreachable Branch with an Impossible Value

**What goes wrong:** A test casts a fake fourth resolver state to hit `assertNever`, weakening type safety and testing no real boundary. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts:172-196]

**Why it happens:** Direct coverage reports the defensive default as uncovered. [VERIFIED: direct-coverage run on 2026-08-31]

**How to avoid:** In P113-24, make exhaustiveness compile-time structural and remove dead runtime coverage where safe; never widen the public input. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:46-49; .claude/rules/typescript-unit-testing.md:30-31,194-209]

**Warning signs:** `as unknown as`, `as any`, or a test title mentioning an impossible internal state. [VERIFIED: .claude/rules/typescript-unit-testing.md:182-188,194-209]

### Pitfall 3: Re-testing Shared Notify Instead of the Presenter

**What goes wrong:** A message owner only calls the whole notification wire or only asserts one rendered substring, leaving its structured status map unproved and duplicating shared tallies/trailers. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:54-67,189-196]

**Why it happens:** The final user output is visible at the wire, but responsibility is split across producer, render map, and shared reducer. [VERIFIED: tests/architecture/notify-producer-wire-coverage.test.ts:1-75]

**How to avoid:** Assert the whole typed message and exact owned row first; add wire assertions only for command-owned final bytes. [VERIFIED: D-09 in .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:56-59]

**Warning signs:** Importing `shared/notify.ts` to build expected strings, snapshot assertions, or asserting only severity/trailer from a presenter owner. [VERIFIED: .claude/rules/typescript-unit-testing.md:89-109]

### Pitfall 4: Sorting Behavioral Order

**What goes wrong:** A cleanup alphabetizes scope precedence, update reasons, dependency order, or a failure schedule and changes public behavior. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts:55-68; extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts:98-147]

**Why it happens:** The phase also mandates alphabetical presentation inventories and nonbehavioral tables. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:60-62,87-89]

**How to avoid:** Every visibly unsorted expectation must name the behavioral order it preserves; sort only inventories/static catalogs/presentation-only collections. [VERIFIED: D-17 in .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:87-89]

**Warning signs:** `.sort()` in an owner test's expected-value construction or an alphabetized reason array that differs from source emission order. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts:98-115]

### Pitfall 5: Proving Offline Only by Observing Success

**What goes wrong:** A read-only case passes while a default live git/network collaborator remains reachable on a different branch. [VERIFIED: tests/architecture/no-orchestrator-network.test.ts:1-140]

**Why it happens:** Several support modules expose live defaults or are consumed by network-capable lifecycle orchestrators. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:106-191; extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:158-579]

**How to avoid:** Inject a collaborator that throws on any call for offline paths and retain the static import gate. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:71-83]

**Warning signs:** An owner case omits a boundary dependency because the happy path “should not call it,” or imports `DEFAULT_GIT_OPS`. [VERIFIED: tests/architecture/no-orchestrator-network.test.ts:104-140]

### Pitfall 6: Shared Fixtures Becoming an Oracle

**What goes wrong:** A broad production-shaped factory decides the expected classification/plan/message, so the same bug can exist in production and test support. [VERIFIED: existing classifier/plan test audit on 2026-08-31]

**Why it happens:** Large closed matrices create setup repetition. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:39-52]

**How to avoid:** Keep complete expected literals on each named row; factories may create only fresh setup inputs. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:30-32,50-52]

**Warning signs:** Helper names containing `expected`, `scenario`, `classify`, `plan`, or `render`, or a row with no literal expected value. [VERIFIED: .claude/rules/typescript-unit-testing.md:107-109,153-179]

## Code Examples

Verified patterns from the canonical project rule follow. The examples are illustrative shapes; pair-specific literals must come from each source contract and the output catalog. [VERIFIED: .claude/rules/typescript-unit-testing.md:6-10]

### Runtime Data Row with Canonical Phases

```typescript
// DATA_T8B4L2_START
for (const { lines, total } of [
  { lines: [], total: 0 },
  { lines: [{ sku: 'sku-a', quantity: 2, unitPrice: 10 }], total: 20 },
]) {
  test(`totals ${lines.length} line(s) as ${total}`, () => {
    // arrange
    const expectedTotal = total

    // act
    const calculatedTotal = cartTotal(lines)

    // assert
    assert.strictEqual(calculatedTotal, expectedTotal)
  })
}
// DATA_T8B4L2_END
```

[VERIFIED: .claude/rules/typescript-unit-testing.md:160-180]

### Compile-Only Type Contract

```typescript
// DATA_C6P1Z9_START
void ({ type: 'order.placed', orderId: 'order-123', total: 25 } satisfies OrderEvent)
// @ts-expect-error an event carries its discriminant
void ({ orderId: 'order-123' } satisfies OrderEvent)
// DATA_C6P1Z9_END
```

[VERIFIED: .claude/rules/typescript-unit-testing.md:211-219]

The `satisfies` operator checks compatibility without changing the expression's inferred type, `@ts-expect-error` reports an error if the expected compiler error disappears, and `exactOptionalPropertyTypes` distinguishes a missing key from a key explicitly present with `undefined`. [CITED: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html] [CITED: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html] [CITED: https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html]

## State of the Art

| Old approach in current owners | Required Phase 113 approach | Impact |
|---|---|---|
| Aggregate or incidental coverage | One source + one mirrored owner + exact direct LCOV | Coverage cannot be borrowed from lifecycle/integration tests. [VERIFIED: scripts/test-coverage-direct.mjs:25-69,197-288] |
| Uppercase/missing AAA or grouped scenario setup | Lowercase case-local phases and fresh state | Cases become order-independent and reviewable against the canonical rule. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:24-35,90-95] |
| Partial property/length assertions | Complete structured return or exact bytes | Preserves optional omission, diagnostics, ordering, severity, and reload fields. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:42-45,56-67] |
| Duplicate helper assertions in supplemental/lifecycle suites | Single mirrored owner plus named cross-module retainers | Removes competing owners without deleting real parity/architecture contracts. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:96-111] |
| Runtime assertions for type surfaces | Compile-only `satisfies` and targeted negatives | Tests erased contracts at the correct layer without widening production. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:33-35] |

**Deprecated/outdated:**

- The older `.planning/codebase/TESTING.md` statements that no mocking library or helper support is used are stale relative to the current normative rule, which explicitly mandates `strong-mock` for interaction mocks and permits concern-local fakes/seeds/contracts. Follow the canonical rule dated in the current milestone context. [VERIFIED: .planning/codebase/TESTING.md; .claude/rules/typescript-unit-testing.md:12-22,111-151,190-192]
- `/* node:coverage ignore */` is not an acceptable way to close Phase 113. Remove dead code or cover reachable public behavior. [VERIFIED: .claude/rules/typescript-unit-testing.md:30-31]

## Assumptions Log

All implementation-affecting claims in this research were verified from the current repository, measured test/coverage runs, or cited official Node/TypeScript/OWASP documentation. No `[ASSUMED]` claim is used to lock a plan decision.

## Open Questions

1. **How should P113-24 preserve exhaustive compile-time checking while removing the uncovered runtime default?**
   - What we know: the valid resolver discriminant is a closed three-arm union and current focused coverage misses only the `assertNever` default. D-07 forbids fabricating another arm. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts:172-196; direct-coverage run on 2026-08-31]
   - What's unclear: whether the smallest compiling pair-local change is a switch with no runtime default or another compile-time-only exhaustiveness form under TypeScript 6.0.3. [VERIFIED: tsconfig.json:2-20; local `tsc --version` on 2026-08-31]
   - Recommendation: Make this the first task in P113-24, prove it with `npm run typecheck`, and do not widen the public union or add a coverage exception. [VERIFIED: .claude/rules/typescript-unit-testing.md:30-31,194-209]

2. **How will final Node 24 parity be executed from the current Node 26 workstation?**
   - What we know: local Node is `v26.7.0`, while CI runs Node 24 only. [VERIFIED: local environment probe on 2026-08-31; .github/workflows/ci.yml:46-78]
   - What's unclear: whether a local Node 24 manager/runtime is available outside the current shell. [VERIFIED: environment probe on 2026-08-31]
   - Recommendation: Use local Node 26 for focused iteration, but require the existing Node 24 CI gate before milestone acceptance. [VERIFIED: .github/workflows/ci.yml:58-78]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---:|---|
| Node.js | All tests and direct coverage | ✓ | `v26.7.0` local; Node `24` CI | Existing CI is the parity authority. [VERIFIED: environment probe; .github/workflows/ci.yml:58-78] |
| npm | Script orchestration | ✓ | `11.19.0` | Direct `node` commands for focused diagnostics only. [VERIFIED: environment probe; package.json:75-90] |
| TypeScript | Type-only owners and full typecheck | ✓ | `6.0.3` | None required. [VERIFIED: environment probe; package.json:29] |
| Git | Repository/import inventory and normal execution commits | ✓ | `2.55.0` | Read-only research does not require network access. [VERIFIED: environment probe] |
| CodeGraph | Source/call-path research | ✓ | `1.6.0` | `rg`/direct reads only after CodeGraph, per AGENTS.md. [VERIFIED: environment probe; AGENTS.md:1-12] |
| External network/services/credentials | Owner execution | Not required | — | Hand-written fail-fast fakes and architecture gates. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:69-83] |

**Missing dependencies with no fallback:** None identified. [VERIFIED: environment probe on 2026-08-31]

**Missing dependencies with fallback:** Local Node 24 is not confirmed; existing CI supplies the required Node 24 lane. [VERIFIED: .github/workflows/ci.yml:58-78]

## Validation Architecture

Nyquist validation is enabled for this project. DATA_F2N8S4_START `"nyquist_validation": true` DATA_F2N8S4_END. [VERIFIED: .planning/config.json:16-33]

### Test Framework

| Property | Value |
|---|---|
| Framework | Node.js built-in `node:test`; local Node `v26.7.0`, CI Node `24`. [VERIFIED: .claude/rules/typescript-unit-testing.md:12-22; .github/workflows/ci.yml:58-78] |
| Config file | No separate runner config; scripts are in `package.json`, compiler checks in `tsconfig.json`. [VERIFIED: package.json:75-90; tsconfig.json:1-20] |
| Quick run command | `node --test <mirrored-owner.test.ts>` [VERIFIED: .claude/rules/typescript-unit-testing.md:30-32] |
| Direct gate | `npm run test:coverage:direct -- <paired-source.ts>` [VERIFIED: package.json:88; scripts/test-coverage-direct.mjs:267-288] |
| Full suite command | `npm run check` [VERIFIED: package.json:75-88] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| MOD-06 / P113-01-06 | Auth, discovery, import presenters/planners/refs/settings | Unit + direct coverage | `node --test tests/orchestrators/{auth-host,discover}.test.ts` and each concrete import owner; then direct gate per source | P113-01,02,04,05,06 exist; P113-03 missing. [VERIFIED: .planning/REQUIREMENTS.md:334-339; filesystem audit on 2026-08-31] |
| MOD-06 / P113-07 | Import contracts | Compile-only | `npm run typecheck` plus direct gate | ❌ Wave 0. [VERIFIED: .planning/REQUIREMENTS.md:340] |
| MOD-06 / P113-08-14 | Marketplace presenters/shared and plugin PATH | Unit + exact-byte + direct coverage | One focused owner and direct gate per source | Only P113-12 exists; seven owner files missing. [VERIFIED: .planning/REQUIREMENTS.md:341-347; filesystem audit on 2026-08-31] |
| MOD-06 / P113-15-29 | Plugin cache/GC/discovery/probe/classifier/shared/update row and presenters | Unit + filesystem/fake-boundary + compile-time + exact-byte + direct coverage | One focused owner and direct gate per source | P113-15,16,20,24,26 exist; ten owner files missing. [VERIFIED: .planning/REQUIREMENTS.md:348-362; filesystem audit on 2026-08-31] |
| MOD-06 / P113-30-34 | Reconcile contracts/planner/presenters and scope fan-out | Unit + compile-time + filesystem + exact-byte + direct coverage | One focused owner and direct gate per source | Only P113-31 exists; four owner files missing. [VERIFIED: .planning/REQUIREMENTS.md:363-367; filesystem audit on 2026-08-31] |
| MOD-06 / P113-35 | Shared orchestrator outcome contracts | Compile-only | `npm run typecheck` plus direct gate | ❌ Wave 0. [VERIFIED: .planning/REQUIREMENTS.md:368] |
| MOD-06 architecture | Offline, credential safety, planner purity, output catalog, producer wire | Architecture/parity | Relevant `node --test tests/architecture/<gate>.test.ts` plus `npm run check` | ✅ Existing. [VERIFIED: tests/architecture/no-orchestrator-network.test.ts; tests/architecture/no-credential-leak.test.ts; tests/architecture/reconcile-planner-purity.test.ts; tests/architecture/catalog-uat.test.ts; tests/architecture/notify-producer-wire-coverage.test.ts] |

### Sampling Rate

- **Per task iteration:** focused mirrored owner. [VERIFIED: .claude/rules/typescript-unit-testing.md:30-32]
- **Per pair completion:** focused owner plus exact direct-coverage gate and any affected architecture/parity supplemental. [VERIFIED: .claude/rules/typescript-unit-testing.md:233-256]
- **Per wave merge:** all changed-pair direct gates; run `:all` after shared support/harness changes. [VERIFIED: .claude/rules/typescript-unit-testing.md:30-32]
- **Phase gate:** all 35 direct records complete, full `npm run check` green, and Node 24 CI green before verification. [VERIFIED: .planning/ROADMAP.md:402-407; .github/workflows/ci.yml:58-78]

### Wave 0 Gaps

- [ ] Create the 23 missing mirrored owner files listed as `MISSING` in the all-pair map. [VERIFIED: .planning/REQUIREMENTS.md:330-368; filesystem audit on 2026-08-31]
- [ ] Rework the 12 present owners to the lowercase AAA, direct-import, complete-expectation contract before accepting their existing cases. [VERIFIED: current test audit on 2026-08-31; .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:24-35]
- [ ] Resolve P113-24's unreachable runtime default without an impossible cast or coverage ignore. [VERIFIED: direct-coverage run; extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts:172-196]
- [ ] Complete the supplemental ownership move/retain/remove inventory before editing any pair that shares those assertions. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:96-111]

No framework installation or new global fixture layer is required. [VERIFIED: package.json:8-30; .claude/rules/typescript-unit-testing.md:12-22]

## Security Domain

Security enforcement is enabled by default because `.planning/config.json` does not set `security_enforcement` to `false`. [VERIFIED: .planning/config.json:1-53]

OWASP's current ASVS page identifies ASVS 5.0.0 as the latest stable version and recommends versioned requirement identifiers because chapter numbering can change. The legacy V2-V6 labels below are retained only to satisfy this project's research template; Phase 113 is a local CLI unit-test refactor, not a web authentication/session/access-control change. [CITED: https://owasp.org/www-project-application-security-verification-standard/]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | Limited | P113-01 verifies injected credential/Device Flow host selection and no cross-host memo leakage; no new authentication mechanism is designed. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/auth-host.ts:59-150] |
| V3 Session Management | No | The phase owns no HTTP/browser session or token-session lifecycle. [VERIFIED: phase source inventory in .planning/ROADMAP.md:413-447] |
| V4 Access Control | No | The phase does not add authorization decisions; user/project scope precedence is orchestration ordering, not identity-based access control. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts:42-99] |
| V5 Input Validation | Yes | Exercise malformed values only at real file, environment, subprocess, or external-data boundaries; use typed internal unions for impossible states. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:39-52] |
| V6 Cryptography | No | No cryptographic primitive, secret storage scheme, or key lifecycle changes in this phase; credentials remain injected/in-memory. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:69-83; tests/architecture/no-credential-leak.test.ts:1-140] |

### Known Threat Patterns for the Stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Credential disclosure in error/notification/state | Information Disclosure | Inject credentials, assert redacted structured results, and retain the no-credential-leak architecture scan. [VERIFIED: tests/architecture/no-credential-leak.test.ts:1-140] |
| Unexpected live git/network/process execution | Spoofing / Information Disclosure / Denial of Service | Fail-fast fakes in owner cases plus forbidden-import architecture gates. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:71-83; tests/architecture/no-orchestrator-network.test.ts:1-140] |
| Path/state contamination across cases | Tampering | One real temporary tree per case, cleanup in `finally`/`t.after`, never repository/home/global paths. [VERIFIED: .claude/rules/typescript-unit-testing.md:182-188,221-229] |
| Environment or memo leakage across tests | Tampering / Information Disclosure | Capture exact environment property state and restore it; construct fresh maps, caches, and collaborators per case. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:90-95] |
| Malformed untrusted file/subprocess/external data | Tampering | Partition real boundary failures and assert typed diagnostics/complete results; do not cast impossible internal values. [VERIFIED: .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:39-52,81-83] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md` — locked decisions, boundaries, reusable seams, and canonical references. [VERIFIED: file read 2026-08-31]
- `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` — all 35 pairs, success criteria, triage, dependency, and MOD-06. [VERIFIED: files read 2026-08-31]
- `.planning/PROJECT.md` — milestone intent and locked refactor invariants. [VERIFIED: file read 2026-08-31]
- `.claude/rules/typescript-unit-testing.md` and `docs/guidelines/typescript-unit-testing-guidelines.md` — normative test design, doubles, isolation, type-only, filesystem, and completion rules. [VERIFIED: files read 2026-08-31]
- `docs/messaging-style-guide.md` and `docs/output-catalog.md` — structured output grammar and accepted user-visible bytes. [VERIFIED: files read 2026-08-31]
- Current P113 source/test files — exports, control flow, imports, current ownership, and uncovered branches; inspected with CodeGraph first and direct reads second. [VERIFIED: CodeGraph/source audit 2026-08-31]
- `scripts/test-coverage-direct.mjs`, `package.json`, `tsconfig.json`, `.github/workflows/ci.yml`, `.planning/config.json` — coverage gate, commands, strict compiler settings, CI runtime, and workflow flags. [VERIFIED: files read 2026-08-31]

### Secondary (MEDIUM confidence)

- [Node.js test runner documentation](https://nodejs.org/download/release/v24.15.0/docs/api/test.html) — test-context mocks and coverage reporting. [CITED: official Node.js docs]
- [TypeScript 4.9 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html) — `satisfies`. [CITED: official TypeScript docs]
- [TypeScript 3.9 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html) — `@ts-expect-error`. [CITED: official TypeScript docs]
- [TypeScript exact optional property types](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html) — missing-vs-present-undefined semantics. [CITED: official TypeScript docs]
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) — current stable version and versioned citation guidance. [CITED: official OWASP project]

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — mandated by current repository rules/config and confirmed in the installed environment. [VERIFIED: package.json:14-30; .claude/rules/typescript-unit-testing.md:12-22; environment probe]
- Architecture: HIGH — derived from current source exports/call paths, the Phase 113 context, and existing architecture gates. [VERIFIED: CodeGraph/source audit; .planning/phases/113-orchestrator-support-and-presenters/113-CONTEXT.md:147-199]
- Pair inventory and likely gaps: HIGH — all 35 roadmap pairs, current file existence, supplemental imports, and all 12 focused direct-coverage baselines were inspected. [VERIFIED: .planning/REQUIREMENTS.md:330-368; filesystem/import/direct-coverage audit]
- Pitfalls: HIGH — grounded in current owner patterns and the normative test contract. [VERIFIED: current test audit; .claude/rules/typescript-unit-testing.md:1-256]
- External documentation: MEDIUM — official Node/TypeScript/OWASP sources fetched through web search because the research seam selected Context7 but no Context7 tool was available in this runtime. [CITED: official sources listed above]

**Research date:** 2026-08-31
**Valid until:** 2026-09-30 (repository-local refactor guidance is stable for this milestone; remeasure coverage after any source/test edit). [VERIFIED: phase scope and measured baseline date]
