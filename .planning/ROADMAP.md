# Roadmap: test-backlog

## Milestones

- **test-backlog** — active, Phases 1-8, branch `features/test-backlog`
- **refine-unit-tests** — shipped 2026-09-13; [archive](milestones/refine-unit-tests-ROADMAP.md)
- **v1.19 Unit Test Refactor** — shipped 2026-09-04; [archive](milestones/v1.19-ROADMAP.md)

Earlier milestones remain in [MILESTONES.md](MILESTONES.md). The inherited root
roadmap is preserved in [PRE-MILESTONE-ROADMAP.md](inputs/test-backlog/PRE-MILESTONE-ROADMAP.md).

## Phases

- [x] **Phase 1: Reliable Negative Controls** — NEGCTL-01, E2EIMP-01, TESTQ-01, FLOW-07, COV-01
- [x] **Phase 2: Sonar Rules for Tests** — SWTEST-01
- [ ] **Phase 3: Reachable Agent Collision Contract** — AGCOL-01
- [ ] **Phase 4: Strict Command Arguments** — ARGS-01
- [ ] **Phase 5: Production Export Ownership** — FLOW-09
- [ ] **Phase 6: Unused Type Member Gate** — 2026-09-02-detect-unused-code-and-type-members.md
- [ ] **Phase 7: Reliable Coverage Metrics** — FLOW-05
- [ ] **Phase 8: Final Verification and Reconciliation** — All authorized items

## Phase Details

### Phase 1: Reliable Negative Controls

**Goal:** The CLI negative control observes the intended failure and rejects launch errors or missing diagnostics.
**Depends on:** Nothing (first phase)
**Requirements:** NEG-01, NEG-02, HIST-01
**Success Criteria:**
1. The CLI negative control observes the intended failure and rejects launch errors or missing diagnostics.
2. The Node 26 cause is reproduced, fixed, and similar uses are checked.
3. Stale import and completed backlog records are reconciled from current tests and archived evidence.
**Plans:** 01-01 negative controls; 01-02 completed-item reconciliation. Both complete; verification passed 2026-09-14.

### Phase 2: Sonar Rules for Tests

**Goal:** The three assertion rules reject planted violations without meaningless assertions in type-only owners.
**Depends on:** Phase 1
**Requirements:** SONAR-01, SONAR-02
**Success Criteria:**
1. The three assertion rules reject planted violations without meaningless assertions in type-only owners.
2. Helper and strict-mock assertions remain strong; other recommended-rule clusters have measured dispositions.
**Plans:** 02-01 complete; review and independent verification passed 2026-09-14.

### Phase 3: Reachable Agent Collision Contract

**Goal:** Real discovery and staging prove the chosen collision behavior and complete warning text.
**Depends on:** Phase 2
**Requirements:** AGENT-01, AGENT-02
**Success Criteria:**
1. Real discovery and staging prove the chosen collision behavior and complete warning text.
2. AG-12, RN-6, source comments, and tests agree; unreachable guards and manufactured inputs are removed.
**Plans:** To be planned after discussion and live investigation.

### Phase 4: Strict Command Arguments

**Goal:** Every current verb rejects unknown flags and excess positionals before doing work.
**Depends on:** Phase 3
**Requirements:** ARGS-01, ARGS-02, ARGS-03
**Success Criteria:**
1. Every current verb rejects unknown flags and excess positionals before doing work.
2. The three marketplace verbs enforce the approved --local policy and usage strings.
3. The flag catalog and drift controls cover both plugin and marketplace families.
**Plans:** To be planned after discussion and live investigation.

### Phase 5: Production Export Ownership

**Goal:** Each current production-mode finding has an evidence-backed disposition and public-contract tests.
**Depends on:** Phase 4
**Requirements:** EXPORT-01, EXPORT-02
**Success Criteria:**
1. Each current production-mode finding has an evidence-backed disposition and public-contract tests.
2. Fallow runs in production mode with offender and benign controls; no test-only exports or mechanical helper modules are introduced.
**Plans:** To be planned after discussion and live investigation.

### Phase 6: Unused Type Member Gate

**Goal:** An unread optional EdgeDeps member fails an automated static-analysis gate.
**Depends on:** Phase 5
**Requirements:** MEMBER-01, MEMBER-02
**Success Criteria:**
1. An unread optional EdgeDeps member fails an automated static-analysis gate.
2. Read, write-only, structural, external-contract, type-only, alias, and computed-access controls establish scope and limitations.
**Plans:** To be planned after discussion and live investigation.

### Phase 7: Reliable Coverage Metrics

**Goal:** Unit coverage converts to valid Istanbul data with measured source/function correspondence and no clamped coordinates.
**Depends on:** Phase 6
**Requirements:** METRIC-01, METRIC-02
**Success Criteria:**
1. Unit coverage converts to valid Istanbul data with measured source/function correspondence and no clamped coordinates.
2. Fallow health consumes verified coverage under a measured CRAP policy; offender and benign controls reject missing or misleading inputs.
**Plans:** To be planned after discussion and live investigation.

### Phase 8: Final Verification and Reconciliation

**Goal:** The complete quality, unit, integration, and applicable e2e gates pass, with aggregate unit production coverage at 100%.
**Depends on:** Phase 7
**Requirements:** FINAL-01, FINAL-02
**Success Criteria:**
1. The complete quality, unit, integration, and applicable e2e gates pass, with aggregate unit production coverage at 100%.
2. Every authorized item has verified implementation or a current disposition agreed here; archives and completed work are preserved.
**Plans:** To be planned after discussion and live investigation.

## Progress

| Phase | Plans Complete | Status | Completed |
| --- | --- | --- | --- |
| 1. Reliable Negative Controls | 2/2 | Complete | 2026-09-14 |
| 2. Sonar Rules for Tests | 1/1 | Complete | 2026-09-14 |
| 3. Reachable Agent Collision Contract | 1/4 | In progress | - |
| 4. Strict Command Arguments | 0/TBD | Not started | - |
| 5. Production Export Ownership | 0/TBD | Not started | - |
| 6. Unused Type Member Gate | 0/TBD | Not started | - |
| 7. Reliable Coverage Metrics | 0/TBD | Not started | - |
| 8. Final Verification and Reconciliation | 0/TBD | Not started | - |
