# Requirements: Unit Test Refactor

**Defined:** 2026-08-28
**Core Value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

## v1.19 Requirements

### Corresponding Tests

- [x] **PAIR-01**: A structural gate derives one mirrored test path for each
  production TypeScript module.
- [x] **PAIR-02**: The gate verifies that each mirror imports its paired
  production module.
- [x] **PAIR-03**: The gate gives type-only modules and barrels no exemptions.
- [x] **PAIR-04**: The gate rejects missing mirrors and unit tests without a
  mirrored production module.

### Test Cases

- [ ] **CASE-01**: Each runtime case has arrange, act, and assert phases in the
  required order.
- [ ] **CASE-02**: Each case title states public behavior, and each value uses a
  production-role name.
- [ ] **CASE-03**: Each case owns its mutable state, dependencies, timers, global
  changes, and temporary directories.
- [ ] **CASE-04**: Each test module uses independent `test()` cases without
  `only`, `skip`, or `todo` markers.

### Assertions and Doubles

- [ ] **TEST-01**: Each case asserts the complete public result or state with an
  expected value that is independent from production code.
- [ ] **TEST-02**: Each error case asserts the error type and its stable fields.
- [ ] **TEST-03**: Each fake, stub, spy, and mock matches its role in the case.
- [ ] **TEST-04**: Each interaction mock uses `strong-mock`, exact parameters,
  complete expectations, and an explicit final verification.
- [ ] **TEST-05**: Each Node test double comes from the current test context.

### Coverage and Enforcement

- [ ] **COV-01**: Each source-test pair reaches 100 percent function, line, and
  branch coverage when that test runs alone.
- [x] **COV-02**: The direct-coverage command accepts one source or test path and
  fails for a missing, ambiguous, or unmapped path.
- [x] **COV-03**: The changed-pair and all-pair commands use the same mapping and
  coverage rules as the focused command.
- [ ] **COV-04**: Each structural gate has a small negative control that proves
  that the gate rejects its target violation.

### Production Design

- [ ] **DES-01**: Production code exposes no symbol, reset hook, state reader, or
  test mode only for a test.
- [ ] **DES-02**: A production change for testability only extracts a concern,
  injects a dependency, narrows a port, or removes hidden global state.
- [ ] **RES-01**: Each resolver result exposes `installable: true | false`, and
  the `installable: false` arm does not expose `pluginRoot`.

### Module Migration

- [ ] **MOD-01**: All domain and platform modules have compliant corresponding
  tests.
- [ ] **MOD-02**: All persistence and transaction modules have compliant
  corresponding tests.
- [ ] **MOD-03**: All shared modules and the extension entry module have
  compliant corresponding tests.
- [ ] **MOD-04**: All agent, command, MCP, and skill bridge modules have
  compliant corresponding tests.
- [ ] **MOD-05**: All hook bridge modules have compliant corresponding tests.
- [ ] **MOD-06**: All edge modules have compliant corresponding tests.
- [ ] **MOD-07**: All root, import, and marketplace orchestrator modules have
  compliant corresponding tests.
- [ ] **MOD-08**: All plugin orchestrator modules have compliant corresponding
  tests.
- [ ] **MOD-09**: All reconcile modules and cross-cutting unit-runner tests
  comply with the applicable guidelines.

### Preserved Behavior

- [ ] **PRES-01**: The refactor preserves all replay contracts in the behavior,
  public-surface, and persistence manifests.
- [ ] **PRES-02**: The refactor preserves the eight product corrections listed in
  the handoff decisions.
- [ ] **PRES-03**: The production and fake Git, credential, and device-flow
  adapters pass the same public contracts.
- [ ] **PRES-04**: Each adapter contract has an independent negative control.

### Suite Quality

- [ ] **SUITE-01**: Unit tests run offline without developer credentials or a
  shared external service.
- [ ] **SUITE-02**: Test support stays beside its concern and does not use a
  generic helper directory.
- [ ] **SUITE-03**: Test files contain no migration notes, relocation history, or
  work-session comments.
- [ ] **SUITE-04**: The replacement does not restore the dropped exemption,
  ownership-registry, sharded-coverage, or generic-helper mechanisms.
- [ ] **SUITE-05**: Focused tests, direct coverage for all pairs, and
  `npm run check` pass on the completed tree.

## Future Requirements

None. This milestone covers the complete unit-test refactor.

## Out of Scope

| Feature | Reason |
| --- | --- |
| New product features | The milestone preserves product behavior except for the required resolver discriminant. |
| Live remote services in tests | The unit testing guidelines require hermetic tests. |
| The abandoned patch | The handoff marks the patch as unverified evidence. |
| The abandoned module layout | Each module boundary requires a new production-responsibility decision. |
| The abandoned coverage mechanisms | The handoff decisions require a small replacement design. |

## Traceability

| Requirement | Phase | Status |
| --- | --- | --- |
| PAIR-01 | Phase 106 | Complete |
| PAIR-02 | Phase 106 | Complete |
| PAIR-03 | Phase 106 | Complete |
| PAIR-04 | Phase 106 | Complete |
| CASE-01 | Phase 116 | Pending |
| CASE-02 | Phase 116 | Pending |
| CASE-03 | Phase 116 | Pending |
| CASE-04 | Phase 116 | Pending |
| TEST-01 | Phase 116 | Pending |
| TEST-02 | Phase 116 | Pending |
| TEST-03 | Phase 116 | Pending |
| TEST-04 | Phase 116 | Pending |
| TEST-05 | Phase 116 | Pending |
| COV-01 | Phase 116 | Pending |
| COV-02 | Phase 106 | Complete |
| COV-03 | Phase 106 | Complete |
| COV-04 | Phase 116 | Pending |
| DES-01 | Phase 116 | Pending |
| DES-02 | Phase 116 | Pending |
| RES-01 | Phase 107 | Pending |
| MOD-01 | Phase 107 | Pending |
| MOD-02 | Phase 108 | Pending |
| MOD-03 | Phase 109 | Pending |
| MOD-04 | Phase 110 | Pending |
| MOD-05 | Phase 111 | Pending |
| MOD-06 | Phase 112 | Pending |
| MOD-07 | Phase 113 | Pending |
| MOD-08 | Phase 114 | Pending |
| MOD-09 | Phase 115 | Pending |
| PRES-01 | Phase 116 | Pending |
| PRES-02 | Phase 116 | Pending |
| PRES-03 | Phase 115 | Pending |
| PRES-04 | Phase 115 | Pending |
| SUITE-01 | Phase 116 | Pending |
| SUITE-02 | Phase 116 | Pending |
| SUITE-03 | Phase 116 | Pending |
| SUITE-04 | Phase 116 | Pending |
| SUITE-05 | Phase 116 | Pending |

**Coverage:**

- v1.19 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

---

*Requirements defined: 2026-08-28*
*Last updated: 2026-08-28 after the v1.19 requirements definition*
