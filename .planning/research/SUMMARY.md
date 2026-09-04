# Project Research Summary — v1.19 Unit Test Refactor

**Project:** pi-claude-marketplace
**Domain:** Brownfield TypeScript unit-test ownership and direct-coverage refactor
**Researched:** 2026-08-28
**Confidence:** HIGH

## Executive Summary

v1.19 is a proof-oriented refactor of an existing Pi extension, not a product
feature milestone. The repository has 204 production TypeScript modules at HEAD,
and all 204 source-test pairs remain open. The audit results—59 direct passes, 83
coverage failures, 60 missing mirrored tests, and two focused-test failures—are
triage signals only. A pair closes only after a new plan proves current
guideline compliance. The proof requires one mirrored owner test, complete
direct coverage, preserved public behavior, and one pair-specific implementation
commit.

Keep the current production architecture and test stack. Use Node 24,
node:test, node:assert/strict, built-in V8 coverage, and strong-mock only for
behavior-heavy ports. Sequence the work from domain and platform contracts toward
the extension entry point so consumers depend on already-proven seams. The
resolver pair must add installable: true | false as the primary safety
discriminant while retaining the three-way state field as secondary product
detail. Preserve all public, persistence, adapter, atomicity, containment,
network, retry, and output contracts.

The main risks are false completion, behavior drift, non-hermetic tests, and
multi-pair changes hidden inside cleanup. Prevent these risks with one
source-test pair per executable plan and commit. Use public-surface assertions,
case-owned state, negative controls, and contract-carrier pairs for cross-cutting
work. Start at Phase 108. Phase 106 and Phase 107 artifacts remain history only.
They provide no completion credit.

## Key Findings

### Recommended Stack

No new package or test framework is required. The existing native ESM,
strict-TypeScript stack already provides every needed capability.

**Core technologies:**

- **Node.js 24.x in CI:** The authoritative v1.19 proof runtime. The local audit
  ran on Node 26.7.0, so closure coverage must be regenerated on Node 24.
- **TypeScript 6.0.3:** Keep strict NodeNext, noEmit, explicit TypeScript import
  extensions, exact optional properties, and unchecked-index protection. Add
  erasableSyntaxOnly and verbatimModuleSyntax validation for native execution.
- **node:test and node:assert/strict:** Use for every mirrored owner test, with
  case-scoped mocks, timers, cleanup, and globals.
- **strong-mock 9.2.2:** Use only when exact calls, arguments, or ordering form
  part of the exported contract.
- **Real temporary filesystems:** Use case-owned temporary directories for path,
  rename, permission, containment, and cleanup behavior.
- **Built-in V8 coverage plus exact LCOV selection:** Require one complete
  function, line, and branch record for the paired source. Recognize genuine
  type-only modules explicitly.
- **Existing TypeScript compiler API, ESLint 10.8.1, Fallow 3.17.0, Prettier
  3.9.6, and Sonar LCOV flow:** Retain these quality and structural tools.

Do not add Jest, Vitest, Sinon, c8, nyc, or a filesystem emulator. Do not use
aggregate coverage as pair proof.

### Expected Features

**Must have for v1.19:**

- A fresh compliance decision for every one of the 204 HEAD production modules.
- One mirrored owner test per source with a direct import, including type-only
  modules and barrels.
- Meaningful public-behavior cases with independent expected values and complete
  direct function, line, and branch coverage.
- Case-owned mutable state, paths, timers, environment changes, transports, and
  cleanup.
- Real production seams when testability needs improvement. Do not add test-only
  exports or reset hooks.
- An additive resolver boolean: both materializable arms have installable: true.
  The unavailable arm has installable: false and no pluginRoot. The existing
  three-way state retains full, partial, and unavailable meaning.
- Preservation of public command behavior, exact output grammar, error identity,
  persisted formats, adapter promises, atomic writes, containment, offline
  rules, scope behavior, and retry safety.
- Public-behavior proof for the eight named corrections. These corrections
  include update preloads, staging warnings, hook invariants, reconcile behavior,
  and device-flow HTTP.
- Fail-closed correspondence and direct-coverage gates with planted negative
  controls.
- Exactly one source-test pair per executable plan and implementation commit.
- A final Node 24 repository closure run with correspondence, direct-all
  coverage, negative controls, and the normal quality gate.

**Add where the pair needs it:**

- Contract suites shared by real and fake Git, credential, or device-flow
  adapters, including a deliberately broken-fake negative control.
- Explicit disposition of useful behavior from supplemental or legacy tests:
  transfer source-owned cases, retain genuine cross-module contracts, and remove
  only proven duplication.
- Small production-useful ports or dependency seams instead of module
  replacement or process-wide mocking.
- Measured bounded concurrency for direct-all coverage only if Node 24 CI timing
  requires it.

**Defer beyond v1.19:**

- New product features, adapters, or supported component types discovered during
  the refactor.
- A different test runner, coverage package, or mocking stack.
- Additional static style enforcement without repeated evidence of a gap.
- Runtime-floor and dependency migrations unrelated to pair ownership.

### Architecture Approach

Keep the production tree at HEAD and overlay one-to-one test ownership on it.
Follow the live dependency direction: foundational domain and platform contracts,
shared values, durable state, bridges, orchestrators, edge commands, then root
composition. Supplemental architecture and integration suites remain valuable
cross-module evidence, but they never replace a mirrored owner or its direct
coverage.

**Major boundaries:**

1. **Domain and platform:** Resolution, manifests, identities, versions,
   authentication, Git, credentials, and Pi-facing ports.
2. **Shared contracts:** Errors, notifications, paths, configuration,
   concurrency, formatting, and common values.
3. **Persistence and transaction:** Atomic durable stores, migrations, ledgers,
   settings, caches, snapshots, rollback, and retry behavior.
4. **Component bridges:** Independent agents, commands, skills, MCP, and hooks
   translation and staging families.
5. **Orchestrators:** Support seams, presenters, lifecycle workflows, import,
   reconcile, bootstrap, and composition.
6. **Edge and entry:** Command parsing and dispatch, followed by extension
   registration and reload composition.
7. **Mirrored owner tests:** One direct test owner per production module.
   Supplemental suites prove only cross-module contracts.
8. **Carrier-pair gates:** Resolver safety, adapter parity, notification grammar,
   structural enforcement, and final package-script wiring travel with the pair
   that owns the contract.

### Critical Pitfalls

1. **Crediting baseline evidence:** Open all 204 pairs. Neither an audit pass nor
   an existing commit closes a pair.
2. **Confusing correspondence with ownership:** Require the mirrored test to
   import and exercise its source directly. Give type-only modules compiler
   contracts and barrels binding-identity checks.
3. **Optimizing for LCOV instead of behavior:** Write mutation-sensitive
   assertions for exported promises first. Use coverage only to find remaining
   paths, and never add coverage ignores or test-only exports.
4. **Drifting product contracts during cleanup:** Resolve mismatches against
   authoritative public, persistence, adapter, and output contracts before
   changing code or expected bytes.
5. **Leaking machine or process state:** Use case-owned temporary resources,
   injected clocks and transports, local-only boundaries, and test-context
   restoration.
6. **Hiding several pairs in one refactor:** Trace callers before edits. A plan
   and commit must own one production source and one mirrored test. Shared
   support changes remain pair-specific and trigger wider impact checks.
7. **Leaving gates outside completion:** Run focused ownership and coverage
   checks for every pair. Make the clean-tree full gates acceptance criteria of
   the final root pair, not a separate executable plan.

## Implications for Roadmap

Use the following ten dependency-aware phases. Their pair-plan counts total
exactly 204:

| Phase | Group                               | Pair plans |
| ----: | ----------------------------------- | ---------: |
|   108 | Domain and Platform                 |         23 |
|   109 | Shared Contracts                    |         19 |
|   110 | Persistence and Transaction         |         12 |
|   111 | Non-Hook Component Bridges          |         31 |
|   112 | Hook Runtime                        |         31 |
|   113 | Orchestrator Support and Presenters |         35 |
|   114 | Plugin and Marketplace Lifecycle    |         14 |
|   115 | Composition Orchestrators           |          8 |
|   116 | Edge Surface                        |         30 |
|   117 | Extension Entry and Final Gate      |          1 |
|       | **Total**                           |    **204** |

Every pair plan uses this evidence sequence:

1. Declare one source and its mirrored test.
2. Trace the exports and callers.
3. Consolidate the source-owned assertions.
4. Make only the smallest production-useful seam change.
5. Prove the focused test and direct coverage.
6. Run the normal quality gate.
7. Commit that pair alone.

### Phase 108: Domain and Platform — 23 Pair Plans

**Rationale:** Stabilize the lowest-level values and external ports before their
consumers.
**Delivers:** Direct ownership for all 20 domain and three platform modules,
including resolver narrowing, Git and credential parity, version privacy, and
device-flow HTTP reachability. The first carrier pair revalidates focused
fail-closed gate behavior.
**Features:** Boolean resolver safety, adapter contracts, private internals,
hermetic process and network boundaries.
**Avoids:** False completion, test-only exports, machine-state leakage, and broad
gate-only work.

### Phase 109: Shared Contracts — 19 Pair Plans

**Rationale:** Errors, paths, configuration, and notification grammar are
consumed across all later layers.
**Delivers:** Direct tests for every shared module, with exact public values,
error identity, output bytes, severity, and routing behavior.
**Features:** Public-behavior assertions, notification contract preservation,
case-owned shared state.
**Avoids:** Snapshot drift, implementation-built expectations, and accidental
public-surface expansion.

### Phase 110: Persistence and Transaction — 12 Pair Plans

**Rationale:** Durable formats and rollback behavior must be stable before bridge
and lifecycle work.
**Delivers:** Nine persistence and three transaction owner pairs covering absent
and corrupt input, atomic replacement, migrations, ledger isolation,
idempotency, rollback, and retries.
**Features:** Persistence compatibility, atomic writes, containment, retry
safety.
**Avoids:** Fragment-only assertions, shared filesystem fixtures, and
multi-module transaction rewrites.

### Phase 111: Non-Hook Component Bridges — 31 Pair Plans

**Rationale:** Agents, commands, skills, and MCP are independent bridge families
that can build on proven lower seams.
**Delivers:** Nine agents, five commands, eight skills, and nine MCP owner pairs
for discovery, conversion, staging, unstage, rollback, naming, and
foreign-content preservation.
**Features:** Bridge atomicity, component conversion, exact warning propagation,
and adapter parity.
**Avoids:** Cross-bridge coupling, shared mutable fixtures, and hidden staging
contract changes.

### Phase 112: Hook Runtime — 31 Pair Plans

**Rationale:** Hooks form a larger isolated subsystem and can proceed alongside
Phase 111 after Phase 110.
**Delivers:** Direct ownership for conversion, matcher, routing state, dispatch,
payload, process execution, async behavior, and hook lifecycle modules.
**Features:** Hook metadata and diagnostic preservation, private internal tables,
case-owned router and process state.
**Avoids:** Global mock state, private constant assertions, timer flakiness, and
event-contract drift.

### Phase 113: Orchestrator Support and Presenters — 35 Pair Plans

**Rationale:** Prove small helpers, classifiers, planners, and message producers
before the state-changing workflows that compose them.
**Delivers:** Owner pairs for top-level support, plugin and marketplace support,
import helpers, reconcile planning, and all current messaging modules.
**Features:** Exact output grammar, deterministic classification, discovery and
planning seams, no-network read behavior.
**Avoids:** Presenter/workflow coupling, duplicated expectations, and
cross-scope ordering drift.

### Phase 114: Plugin and Marketplace Lifecycle — 14 Pair Plans

**Rationale:** These large state-changing workflows depend on every lower
contract and presenter.
**Delivers:** Eight plugin workflow pairs and six marketplace workflow pairs,
including update preload and staging-warning preservation, rollback effects,
offline behavior, and the marketplace-add socket boundary.
**Features:** Lifecycle contract preservation, exact causes and notifications,
atomicity, cache behavior, and safe retries.
**Avoids:** Blind expectation updates, live network or credentials, environment
misdiagnosis, and incidental product changes.

### Phase 115: Composition Orchestrators — 8 Pair Plans

**Rationale:** Import, reconcile, bootstrap, and dependency composition follow
the lifecycle primitives that they invoke.
**Delivers:** Edge-dependency composition, two import composers, plugin
bootstrap, and four reconcile composers.
**Features:** Reconcile failure isolation and complete arm application,
multi-scope composition, stable orchestration effects.
**Avoids:** Aggregate-only evidence, stopped-on-first-failure behavior, and
missing composition arms.

### Phase 116: Edge Surface — 30 Pair Plans

**Rationale:** Test command parsing and dispatch after the invoked workflows and
their output contracts are stable.
**Delivers:** Mirrored ownership for all edge modules, including parsing,
validation, scope selection, completion, LLM tools, and user-facing dispatch.
**Features:** Public command grammar, argument errors, scope rules, output-channel
discipline, network boundaries.
**Avoids:** Parser tests that bypass dispatch, direct stdout/stderr, and
implementation-coupled command expectations.

### Phase 117: Extension Entry and Final Gate — 1 Pair Plan

**Rationale:** Root registration and reload composition depend on every lower
layer and are the natural carrier for final repository enforcement.
**Delivers:** The root index.ts owner pair plus the final Node 24 correspondence,
direct-all coverage, negative-control, and normal quality-gate proof. If package
script wiring is still needed, it travels as supporting acceptance work in this
pair.
**Features:** Extension composition, registration, reload behavior, and
project-wide closure.
**Avoids:** A closure-only plan, early permanently-red gates, and aggregate
coverage standing in for pair evidence.

### Phase Ordering Rationale

- Phases 108–110 establish leaf contracts and durable state before any bridge or
  lifecycle consumer.
- Phases 111 and 112 are independent bridge groups and may use parallel waves,
  while every plan and commit retains exclusive pair ownership.
- Phase 113 proves helper and presentation seams before the large lifecycle pairs
  in Phase 114.
- Phase 115 composes lifecycle workflows. Phase 116 then proves the command
  surface over stable orchestrators.
- Phase 117 closes the root pair and global gates. There is no non-pair
  executable closure plan.
- Cross-cutting checks are acceptance criteria or carrier-pair support work
  throughout. They never become extra executable plans.

### Research Flags

**Targeted research before planning:**

- **Phase 108:** Confirm the resolver schema and caller narrowing for the additive
  boolean. Validate the credential/device-flow ports and rerun the
  sandbox-sensitive Unix-socket case with the required permission before
  classifying it as a product defect.
- **Phase 114:** Resolve the plugin-update reason mismatch from authoritative
  lifecycle and network contracts before changing either implementation or
  expected bytes.
- **Phase 117:** Measure direct-all duration on Node 24 and inspect final package
  script wiring. Add bounded concurrency only if the 15-minute CI limit requires
  it.

**Established repository patterns. Skip broad research:**

- **Phases 109–113 and 115–116:** The live callers, existing contracts, current
  scripts, and unit-test guidelines provide sufficient implementation patterns.
  Individual large pairs still require caller tracing during plan creation.

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                                                                |
| ------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH       | Versions and scripts come from the current repository and lockfile. External tool semantics use primary documentation but must be proven on Node 24. |
| Features     | HIGH       | The milestone scope, testing guidelines, active decisions, and complete 204-row audit agree on the completion contract.                              |
| Architecture | HIGH       | The ten groups derive from the live 204-module tree and sum exactly to 204. Dependencies and carrier pairs are repository-local.                     |
| Pitfalls     | HIGH       | Findings are supported by current structural violations, focused failures, caller patterns, and preserved product contracts.                         |

**Overall confidence:** HIGH

### Gaps to Address

- **Final inventory drift:** A production extraction changes the pair inventory.
  Treat that as a stop-and-replan event. Do not silently expand a one-pair plan.
  The proposed roadmap covers exactly the 204 modules at researched HEAD.
- **Unexpected tests:** Classify all 43 current unmatched tests. Transfer
  source-owned assertions, retain genuine cross-module suites, and remove only
  proven duplication.
- **Update reason authority:** Decide whether the three update mismatches are a
  stale test or a product regression before the Phase 114 pair begins.
- **Socket environment:** Re-run marketplace add with listener permission before
  changing product code.
- **Support-test correspondence:** Refine the reverse structural rule so valid
  concern-local support modules can exist without weakening the one-owner rule.
- **Node 24 closure cost:** Measure 204 isolated coverage processes before
  choosing bounded concurrency.
- **Runtime-floor alignment:** Fallow and current dependencies require a newer
  runtime than the advertised product floor in some paths. Track this outside
  the pair refactor unless it blocks required v1.19 proof.

## Sources

### Primary — HIGH Confidence

- .planning/PROJECT.md — v1.19 goal, constraints, active requirements, locked
  D-UTR decisions, and Phase 108 boundary.
- .planning/research/STACK.md — current toolchain, direct-pair mechanics,
  compiler settings, and closure commands.
- .planning/research/FEATURES.md — completion features, anti-features,
  dependencies, and pair contract.
- .planning/research/ARCHITECTURE.md — live component inventory,
  dependency-aware phase grouping, carrier pairs, and verification boundaries.
- .planning/research/PITFALLS.md — failure modes, warning signs, recovery, and
  phase mapping.
- /tmp/pi-cm-pair-audit.CJWiph/results.tsv — 204-row HEAD audit: 59 PASS, 83
  COVERAGE_FAIL, 60 MISSING, and two TEST_FAIL.
- package.json, package-lock.json, tsconfig.json, .fallowrc.json, ESLint config,
  CI workflows, current production sources, and current tests.
- docs/guidelines/typescript-unit-testing-guidelines.md and the repository's
  enforced TypeScript unit-test rules.
- scripts/check-corresponding-tests.mjs and
  scripts/test-coverage-direct.mjs, including their negative controls.

### External Primary Documentation — MEDIUM Confidence Until Local Proof

- Node.js 24 test runner, TypeScript execution, and command-line coverage
  documentation.
- TypeScript compiler option documentation.
- Fallow configuration documentation.
- strong-mock documentation.

---

_Research completed: 2026-08-28_
_Milestone: v1.19 Unit Test Refactor_
_Ready for roadmap: yes_
