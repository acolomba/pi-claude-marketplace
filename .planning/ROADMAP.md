# Roadmap: Unit Test Refactor

**Milestone:** v1.19
**Created:** 2026-08-28
**Phases:** 11
**Requirements:** 38

## Execution Rule

Work on one production module at a time. Read the module and trace its callers
before editing its corresponding test.

For each source-test pair:

1. Run the current focused test.
2. Refactor the test through exported behavior.
3. Run the focused test again.
4. Run direct coverage for the pair.
5. Continue only when the pair has complete coverage.

Use `TRANSFORMATIONS.yaml` only to find evidence for the current module. Do not
copy the old file layout or the abandoned patch.

## Phase Summary

| Phase | Name | Goal | Requirements |
| --- | --- | --- | --- |
| 106 | Test Architecture Foundation | Establish one fail-closed pair map and one direct-coverage path. | PAIR-01, PAIR-02, PAIR-03, PAIR-04, COV-02, COV-03 |
| 107 | Domain and Platform | Refactor 20 domain and platform source-test pairs and resolve NFR-7. | MOD-01, RES-01 |
| 108 | Persistence and Transactions | Refactor 12 persistence and transaction source-test pairs. | MOD-02 |
| 109 | Shared and Composition | Refactor 19 shared pairs and the extension entry pair. | MOD-03 |
| 110 | Component Bridges | Refactor 31 agent, command, MCP, and skill bridge pairs. | MOD-04 |
| 111 | Hook Bridge | Refactor 31 hook bridge pairs. | MOD-05 |
| 112 | Edge Surface | Refactor 30 edge source-test pairs. | MOD-06 |
| 113 | Core Orchestrators | Refactor 25 root, import, and marketplace orchestrator pairs. | MOD-07 |
| 114 | Plugin Orchestrators | Refactor 24 plugin orchestrator pairs. | MOD-08 |
| 115 | Reconcile and Cross-Cutting Tests | Refactor eight reconcile pairs, adapter contracts, and structural tests. | MOD-09, PRES-03, PRES-04 |
| 116 | Suite Closure | Prove the full guideline, preservation, and quality contracts. | CASE-01, CASE-02, CASE-03, CASE-04, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, COV-01, COV-04, DES-01, DES-02, PRES-01, PRES-02, SUITE-01, SUITE-02, SUITE-03, SUITE-04, SUITE-05 |

## Phase Details

### Phase 106: Test Architecture Foundation

**Goal:** The repository has one deterministic corresponding-test map and one
focused direct-coverage command.

**Requirements:** PAIR-01, PAIR-02, PAIR-03, PAIR-04, COV-02, COV-03

**Success criteria:**

1. Every production TypeScript path maps to exactly one mirrored test path.
2. The gate reports all missing and ambiguous pairs without an exemption list.
3. A focused coverage command accepts either member of one pair.
4. Changed-pair and all-pair commands use the focused command's rules.
5. The test toolchain contains only `node:test`, `node:assert/strict`, the test
   context mocks, and `strong-mock`.

### Phase 107: Domain and Platform

**Goal:** The domain and platform layers have compliant direct tests.

**Requirements:** MOD-01, RES-01

**Success criteria:**

1. All 17 domain pairs pass focused direct coverage.
2. All three platform pairs pass focused direct coverage.
3. Resolver results expose the required boolean discriminant.
4. The unavailable resolver arm does not expose `pluginRoot`.
5. Adapter tests use only local or replaced boundaries.

### Phase 108: Persistence and Transactions

**Goal:** Persistence and transaction behavior has isolated direct tests.

**Requirements:** MOD-02

**Success criteria:**

1. All nine persistence pairs pass focused direct coverage.
2. All three transaction pairs pass focused direct coverage.
3. Each filesystem case owns and removes its temporary directory.
4. State, configuration, index, and migration wire formats remain unchanged.

### Phase 109: Shared and Composition

**Goal:** Shared utilities and extension composition have direct public tests.

**Requirements:** MOD-03

**Success criteria:**

1. All 19 shared pairs pass focused direct coverage.
2. The extension entry pair passes focused direct coverage.
3. Notification tests compare complete rendered values and explicit severities.
4. The tests contain no private-surface assertions.

### Phase 110: Component Bridges

**Goal:** Agent, command, MCP, and skill bridges have isolated direct tests.

**Requirements:** MOD-04

**Success criteria:**

1. All nine agent bridge pairs pass focused direct coverage.
2. All five command bridge pairs pass focused direct coverage.
3. All nine MCP bridge pairs pass focused direct coverage.
4. All eight skill bridge pairs pass focused direct coverage.
5. Each staging case uses a private temporary tree.

### Phase 111: Hook Bridge

**Goal:** The hook bridge has direct tests for each exported module surface.

**Requirements:** MOD-05

**Success criteria:**

1. All 31 hook bridge pairs pass focused direct coverage.
2. Scheduling cases use the test context's timers.
3. Dispatch interactions use strict mocks only when the interaction is public.
4. Process and session state is fresh or restored for each case.

### Phase 112: Edge Surface

**Goal:** Routing, completion, handler, and edge types have direct tests.

**Requirements:** MOD-06

**Success criteria:**

1. All 30 edge pairs pass focused direct coverage.
2. Router tests preserve the full command and alias grammar.
3. Handler tests assert user-visible notifications before interactions.
4. Type-only edge modules have compiler-owned corresponding tests.

### Phase 113: Core Orchestrators

**Goal:** Root, import, and marketplace orchestrators have direct tests.

**Requirements:** MOD-07

**Success criteria:**

1. All six root orchestrator pairs pass focused direct coverage.
2. All seven import pairs pass focused direct coverage.
3. All 12 marketplace pairs pass focused direct coverage.
4. Network-free operations remain offline in every case.
5. Interaction order is asserted through one shared operation log when required.

### Phase 114: Plugin Orchestrators

**Goal:** Plugin lifecycle orchestrators have direct tests without helper-owned
subjects.

**Requirements:** MOD-08

**Success criteria:**

1. All 24 plugin orchestrator pairs pass focused direct coverage.
2. Install, update, and reinstall preserve agent skill preloads and warnings.
3. List, info, uninstall, and warm-cache paths remain network-free.
4. Expected lifecycle results do not come from a test harness computation.
5. Each stateful lifecycle case owns its graph and temporary tree.

### Phase 115: Reconcile and Cross-Cutting Tests

**Goal:** Reconcile, adapter parity, and structural tests use the applicable
guidelines.

**Requirements:** MOD-09, PRES-03, PRES-04

**Success criteria:**

1. All eight reconcile pairs pass focused direct coverage.
2. Reconcile tests prove that one entry failure does not stop other entries.
3. Git, credential, and device-flow production adapters share contracts with
   their concern-local fakes.

4. Each adapter contract fails against its private broken fake.
5. Cross-cutting tests remain structural gates and do not become second owners
   of a production module.

### Phase 116: Suite Closure

**Goal:** The complete tree obeys the guidelines and preserves public behavior.

**Requirements:** CASE-01, CASE-02, CASE-03, CASE-04, TEST-01, TEST-02, TEST-03,
TEST-04, TEST-05, COV-01, COV-04, DES-01, DES-02, PRES-01, PRES-02, SUITE-01,
SUITE-02, SUITE-03, SUITE-04, SUITE-05

**Success criteria:**

1. The all-pair command reports complete function, line, and branch coverage.
2. Each structural gate rejects its planted violation and accepts the clean tree.
3. All replay contracts and oracle scenarios pass.
4. The dropped mechanisms and migration-history comments are absent.
5. `npm run check` passes.

## Requirement Coverage

Every v1.19 requirement maps to exactly one phase. No requirement is unmapped.

| Phase | Requirement count |
| --- | ---: |
| 106 | 6 |
| 107 | 2 |
| 108 | 1 |
| 109 | 1 |
| 110 | 1 |
| 111 | 1 |
| 112 | 1 |
| 113 | 1 |
| 114 | 1 |
| 115 | 3 |
| 116 | 20 |
| **Total** | **38** |
