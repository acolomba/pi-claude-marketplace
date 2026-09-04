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

- [ ] **PDEF-01**: Every production defect confirmed by revalidation has a
  regression test that fails without the fix and a verified implementation fix.
- [ ] **PDEF-02**: Manifest- or state-derived paths cannot escape their owning
  root through symlinks, `..`, or lenient read paths.
- [ ] **PDEF-03**: Malformed MCP structures fail cleanly without unexpected
  throws or corrupt configuration writes.
- [ ] **PDEF-04**: Lifecycle callbacks contain expected failures and remain
  recoverable through `/reload` without restarting Pi.
- [ ] **PDEF-05**: Failure reasons use typed classifications rather than message
  substring matching, including the revalidated `REASON-01` malformed-input
  family.
- [ ] **PDEF-06**: Cleanup leaks, warning data, and other returned diagnostics
  are not silently discarded.
- [ ] **PDEF-07**: Dynamic lookups, predicates, and closed-union switches reject
  unsupported values safely and exhaustively.
- [ ] **PDEF-08**: Confirmed agent-discovery, reconcile-alias, compact-trigger,
  and rollback defects are resolved according to their live behavior.
- [ ] **AUTH-01**: All revalidated auth paths provide host-specific no-provider
  guidance, and their tests can observe the actual authentication collaborator.

### Test Architecture

- [ ] **TREF-01**: Tests never read or write the developer's real home, Pi agent
  directory, or MCP configuration.
- [ ] **TREF-02**: Shared fakes preserve function-bearing collaborators such as
  authentication bundles.
- [ ] **TREF-03**: Tests use typed values and exact interaction doubles without
  laundering invalid fixtures through broad casts.
- [ ] **TREF-04**: Confirmed hidden dependencies have explicit injection seams.
- [ ] **TREF-05**: Mutable runtime state is factory-owned wherever revalidation
  confirms module-global coupling.
- [ ] **TREF-06**: Tests exercise public contracts; exports that exist only for
  tests follow the revalidated `FLOW-09` disposition.
- [ ] **TREF-07**: Fragment assertions are replaced where they permit sibling
  drift, while the review's three stated caveats remain protected.
- [ ] **TREF-08**: Prototype and builtin-module patching is removed wherever a
  case-owned seam can express the behavior.
- [ ] **TREF-09**: Module splits occur only after their prerequisites and carry
  the required gate, documentation, ownership, and completeness updates.

### Gate Integrity

- [ ] **GGAT-01**: Every confirmed scanning gate proves that it visited its
  targets and carries synthetic offender and benign controls.
- [ ] **GGAT-02**: The agents collision gate is removed or retained according to
  current discovery behavior, with the public behavior tested.
- [ ] **GGAT-03**: `FLOW-07` is settled through an edge-by-edge comparison of the
  ESLint and Fallow boundary matrices.
- [ ] **GGAT-04**: Closed-set and delegated-contract gates cover their real
  production consumers rather than only their configuration.

### Direct Coverage

- [ ] **RCOV-01**: The per-pair coverage baseline is regenerated from the
  milestone branch.
- [ ] **RCOV-02**: All seven carried shortfalls are reclassified; removable
  branches are rewritten and genuinely compiler-forced cases retain explicit
  evidence.
- [ ] **RCOV-03**: Direct coverage is enforced at an approved cadence without
  treating coverage as proof of assertion strength.
- [ ] **RCOV-04**: The two `COV-01` orchestrators are remeasured and addressed
  through tests or an explicit evidence-based disposition, never a flattering
  exclusion.

### Closure

- [ ] **CLOSE-01**: The complete project quality suite passes after all confirmed
  work is complete.
- [ ] **CLOSE-02**: `TESTQ-01` and every bundled backlog item record what shipped,
  what was stale, and what remains deliberately deferred.

## Future Requirements

None. Findings that revalidation confirms but this milestone deliberately
defers must be added here or returned to the backlog with a concrete reason.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Ecosystem or competitor research | This milestone audits existing local code and archived local evidence. |
| `FLOW-05` CRAP integration | It requires a separate coverage-format conversion and metric-policy decision. |
| `FMBOM-01` and unrelated parser-fidelity work | Important, but independent of the unit-test review corpus. |
| `ENWARN-01`, `UPCASC-01`, and `WCHAN-01` | The warning-channel product decisions form a separate coherent workstream. |
| Fixing findings that no longer reproduce | Stale evidence is closed or superseded, not reimplemented. |
| Behavior changes unrelated to confirmed production defects | Test refinement must preserve established product contracts. |

## Traceability

Roadmap creation assigns each requirement to exactly one phase.

| Requirement | Phase | Status |
| ----------- | ----- | ------ |
| RVAL-01 | Phase 1 | Complete |
| RVAL-02 | Phase 1 | Complete |
| RVAL-03 | Phase 1 | Complete |
| RVAL-04 | Phase 1 | Complete |
| PDEF-01 | Phase 3 | Pending |
| PDEF-02 | Phase 2 | Pending |
| PDEF-03 | Phase 2 | Pending |
| PDEF-04 | Phase 2 | Pending |
| PDEF-05 | Phase 3 | Pending |
| PDEF-06 | Phase 3 | Pending |
| PDEF-07 | Phase 3 | Pending |
| PDEF-08 | Phase 3 | Pending |
| AUTH-01 | Phase 4 | Pending |
| TREF-01 | Phase 4 | Pending |
| TREF-02 | Phase 4 | Pending |
| TREF-03 | Phase 4 | Pending |
| TREF-04 | Phase 5 | Pending |
| TREF-05 | Phase 5 | Pending |
| TREF-06 | Phase 5 | Pending |
| TREF-07 | Phase 6 | Pending |
| TREF-08 | Phase 6 | Pending |
| TREF-09 | Phase 6 | Pending |
| GGAT-01 | Phase 7 | Pending |
| GGAT-02 | Phase 7 | Pending |
| GGAT-03 | Phase 7 | Pending |
| GGAT-04 | Phase 7 | Pending |
| RCOV-01 | Phase 8 | Pending |
| RCOV-02 | Phase 8 | Pending |
| RCOV-03 | Phase 8 | Pending |
| RCOV-04 | Phase 8 | Pending |
| CLOSE-01 | Phase 9 | Pending |
| CLOSE-02 | Phase 9 | Pending |

**Coverage:**

- refine-unit-tests requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---

_Requirements defined: 2026-09-04_
_Last updated: 2026-09-04 after roadmap creation_
