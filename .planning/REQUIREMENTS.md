# Requirements: refine-unit-tests

**Defined:** 2026-09-04
**Core Value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

## refine-unit-tests Requirements

### Live Revalidation

- [x] **RVAL-01**: Maintainers individually inspect all 110 files under
      `.planning/reviews/unit-test-adversarial/`: 45 first-pass reports, 58
      adversarial reports, and 7 briefs, synthesis documents, or controls.
- [x] **RVAL-02**: A 110/110 coverage manifest maps every report and recorded
      finding to a current disposition, live source and test references, and
      reproduction evidence where applicable; archived line references alone never
      authorize implementation.
- [x] **RVAL-03**: The nine operator decisions in `META-FINDINGS.md` are resolved
      only after their current premises are revalidated.
- [x] **RVAL-04**: Stale, struck, or superseded findings and bundled backlog
      claims move out of active scope with explicit current evidence before
      implementation planning.

### Production Correctness

- [x] **PDEF-01**: Each terminally confirmed production defect routed to Phase 3
      has a direct owner regression that fails without the correction and passes
      with it; stale, struck, and evidence-only claims authorize no implementation.
- [x] **PDEF-02**: Terminal manifest- and state-derived path flows preserve their
      allowed root and reject traversal, symlink escape, and lenient-read escape.
- [x] **PDEF-03**: The terminal malformed-MCP input case returns its typed stable
      failure without an unexpected throw or configuration write.
- [x] **PDEF-04**: Terminal resource-discovery and lifecycle-mutation failures
      preserve their exact partial state and remain recoverable through `/reload`.
- [x] **PDEF-05**: Terminal lock-contention, sibling-sweep, and malformed-input
      reasons use explicit typed classifications instead of message-substring flow.
- [x] **PDEF-06**: Terminal update cleanup, warning, and diagnostic paths preserve
      the primary error, attach cleanup context, and leave no persistent artifact.
- [x] **PDEF-07**: Terminal dynamic lookups reject unsupported values safely and
      unreachable test-shaped branches are removed without weakening real guards.
- [x] **PDEF-08**: The one-to-one reconcile-alias source-claim map fails closed
      while preserving manifest-derived state identity; independently terminal
      agent-discovery, compact-trigger, and rollback behavior keeps its own route.
- [x] **AUTH-01**: Terminal auth tests cover hostile-host rejection, optional
      collaborator behavior, and realistic authentication-failure propagation.

### Test Architecture

- [x] **TREF-01**: Terminal hermeticity gaps use case-owned temporary filesystem
      state and cannot read or write the developer's real home, Pi agent directory,
      or MCP configuration.
- [x] **TREF-02**: Shared external-failure doubles preserve function-bearing
      collaborators, including authentication bundles, with production-faithful
      behavior.
- [x] **TREF-03**: Tests use typed production-domain values and exact role-named
      doubles without broad-cast laundering or test-helper terminology in
      production.
- [x] **TREF-04**: Each terminal hidden dependency is classified: use real
      temporary filesystem state by default and a narrow production-owned port only
      for irreproducible faults or timing; preserve the two selected behavioral
      composition exceptions without test-only seams.
- [x] **TREF-05**: Terminal mutable module state moves to legitimate lifecycle or
      factory ownership without reset exports created only for tests.
- [x] **TREF-06**: Tests exercise public contracts, and terminal test-only
      exports, reset hooks, and test-shaped branches follow the trace-preserving
      removal disposition.
- [ ] **TREF-07**: Observable assertions use complete exact outcomes, including
      structural single/plural cardinality and visible plural tallies, while
      documented caveats remain protected.
- [ ] **TREF-08**: Global prototype and builtin-module patching and dishonest
      dense-index cases are removed through real case-owned state or narrow
      production-owned ports without ignore pragmas.
- [ ] **TREF-09**: After Phase 2 and 3 prerequisites, the approved resolver,
      notify, install, update, reinstall, list, and catalog splits land at named
      seams with paired tests, one end-to-end proof per flow, and the four-part gate,
      documentation, ownership, and completeness checklist; uninstall and the
      independently deferred info split remain outside this requirement.

### Gate Integrity

- [ ] **GGAT-01**: Each terminal scanning-gate gap proves target visitation and
      carries a synthetic offender and benign control; changed-pair discovery also
      proves deterministic base selection and a fail-closed zero-selection case.
- [ ] **GGAT-03**: `FLOW-07` varies effective config sources and broad overrides
      across the terminal ESLint/Fallow boundary gaps and proves target visitation.
- [ ] **GGAT-04**: Terminal closed-set and delegated-contract gates cover their
      real production consumers and any public seams created by approved splits,
      with visitation, offender, and benign controls.

### Direct Coverage

- [ ] **RCOV-01**: One honest per-pair coverage baseline is regenerated from the
      milestone branch for all 204 current source-test pairs and records every
      refusal without stale counts or a false pass.
- [ ] **RCOV-02**: All seven terminal shortfalls are reclassified; the two
      removable dense-index guards are honestly rewritten and the five genuinely
      compiler-forced cases retain current explicit evidence without an allowlist.
- [ ] **RCOV-03**: The same strict changed-pair gate runs in scoped local
      pre-commit and dedicated authoritative CI with fail-closed base and pair
      selection, while coverage remains reachability evidence only.

### Closure

- [ ] **CLOSE-01**: The complete project quality suite passes after all terminal
      work, selected controls, focused owner tests, and independent assertion-
      strength requirements are complete.
- [ ] **CLOSE-02**: `TESTQ-01`, `FLOW-09`, `REASON-01`, and `FLOW-07` record their
      shipped terminal routes; `COV-01`, `AGCOL-01`, the unused-type-member todo, and
      the named `GAUTH-01` prescription retain explicit evidence-only or deferred
      histories without being described as implemented.

## Evidence and History

These stable requirement IDs no longer authorize active implementation. Their
history remains here and in the canonical scope-impact records.

- **GGAT-02** (`SCOPE-REQ-GGAT-02`, formerly Phase 7): `AGCOL-01` asserted that
  the agents-collision gate was dead, but exhaustive canonical mapping found no
  dedicated terminal finding for that premise. Revalidation is required before
  this requirement can return to active scope; it is not implemented.
- **RCOV-04** (`SCOPE-REQ-RCOV-04`, formerly Phase 8): the standalone `COV-01`
  remeasurement is superseded by `RCOV-01`'s complete 204-pair baseline. Its two
  orchestrators remain included in that baseline and neither is a terminal
  current shortfall; this is not a flattering exclusion or an implementation
  claim.

The folded unused-type-member todo and the named `GAUTH-01` sentinel-wiring
prescription likewise have no dedicated terminal finding. They remain traceable
backlog history and cannot create active milestone work under D-22 without new
terminal evidence inside the unit-test-quality boundary.

## Future Requirements

None. Findings that revalidation confirms but this milestone deliberately
defers must be added here or returned to the backlog with a concrete reason.

## Out of Scope

| Feature                                                    | Reason                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Ecosystem or competitor research                           | This milestone audits existing local code and archived local evidence.        |
| `FLOW-05` CRAP integration                                 | It requires a separate coverage-format conversion and metric-policy decision. |
| `FMBOM-01` and unrelated parser-fidelity work              | Important, but independent of the unit-test review corpus.                    |
| `ENWARN-01`, `UPCASC-01`, and `WCHAN-01`                   | The warning-channel product decisions form a separate coherent workstream.    |
| Fixing findings that no longer reproduce                   | Stale evidence is closed or superseded, not reimplemented.                    |
| Behavior changes unrelated to confirmed production defects | Test refinement must preserve established product contracts.                  |

## Traceability

Roadmap creation assigns each requirement to exactly one phase.

| Requirement | Phase                               | Status        |
| ----------- | ----------------------------------- | ------------- |
| RVAL-01     | Phase 1                             | Complete      |
| RVAL-02     | Phase 1                             | Complete      |
| RVAL-03     | Phase 1                             | Complete      |
| RVAL-04     | Phase 1                             | Complete      |
| PDEF-01     | Phase 3                             | Complete      |
| PDEF-02     | Phase 2                             | Complete      |
| PDEF-03     | Phase 2                             | Complete      |
| PDEF-04     | Phase 2                             | Complete      |
| PDEF-05     | Phase 3                             | Complete      |
| PDEF-06     | Phase 3                             | Complete      |
| PDEF-07     | Phase 3                             | Complete      |
| PDEF-08     | Phase 3                             | Complete      |
| AUTH-01     | Phase 4                             | Complete      |
| TREF-01     | Phase 4                             | Complete      |
| TREF-02     | Phase 4                             | Complete      |
| TREF-03     | Phase 4                             | Complete      |
| TREF-04     | Phase 5                             | Complete      |
| TREF-05     | Phase 5                             | Complete      |
| TREF-06     | Phase 5                             | Complete      |
| TREF-07     | Phase 6                             | Pending       |
| TREF-08     | Phase 6                             | Pending       |
| TREF-09     | Phase 6                             | Pending       |
| GGAT-01     | Phase 7                             | Pending       |
| GGAT-02     | Evidence/history (formerly Phase 7) | Evidence only |
| GGAT-03     | Phase 7                             | Pending       |
| GGAT-04     | Phase 7                             | Pending       |
| RCOV-01     | Phase 8                             | Pending       |
| RCOV-02     | Phase 8                             | Pending       |
| RCOV-03     | Phase 8                             | Pending       |
| RCOV-04     | Evidence/history (formerly Phase 8) | Evidence only |
| CLOSE-01    | Phase 9                             | Pending       |
| CLOSE-02    | Phase 9                             | Pending       |

**Coverage:**

- refine-unit-tests requirements: 32 total
- Active or completed requirements mapped to phases: 30
- Evidence/history requirements: 2
- Unmapped: 0

---

_Requirements defined: 2026-09-04_
_Last updated: 2026-09-05 from the terminal evidence crosswalk_
