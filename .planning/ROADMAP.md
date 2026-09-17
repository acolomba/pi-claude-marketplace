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
- [x] **Phase 3: Reachable Agent Collision Contract** — AGCOL-01
- [x] **Phase 4: Strict Command Arguments** — ARGS-01
- [x] **Phase 5: Production Export Ownership** — FLOW-09
- [x] **Phase 6: Unused Type Member Gate** — 2026-09-02-detect-unused-code-and-type-members.md
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

**Plans:** 03-01 through 03-04 complete in `b663bc68`; review clean, independent verification 18/18 on 2026-09-14.

### Phase 4: Strict Command Arguments

**Goal:** Every current verb rejects unknown flags and excess positionals before doing work.
**Depends on:** Phase 3
**Requirements:** ARGS-01, ARGS-02, ARGS-03
**Success Criteria:**

1. Every current verb rejects unknown flags and excess positionals before doing work.
2. The three marketplace verbs enforce the approved --local policy and usage strings.
3. The flag catalog and drift controls cover both plugin and marketplace families.

**Plans:** 04-01 parser, 04-02 merged local reads, 04-03 catalog/completion complete in `a8ef0dac`; review clean, independent verification 7/7 on 2026-09-14.

### Phase 5: Production Export Ownership

**Goal:** Each current production-mode finding has an evidence-backed disposition and public-contract tests.
**Depends on:** Phase 4
**Requirements:** EXPORT-01, EXPORT-02
**Success Criteria:**

1. Each current production-mode finding has an evidence-backed disposition and public-contract tests.
2. Fallow runs in production mode with offender and benign controls; no test-only exports or mechanical helper modules are introduced.

**Plans:** 05-01 through 05-28 approved in eleven dependency waves; sixteen plans complete. Wave 5 source writing is done (05-07, 05-12, 05-24); next is the wave census reconciliation, then Wave 6.

### Phase 6: Unused Type Member Gate

**Goal:** An unread optional EdgeDeps member fails an automated static-analysis gate.
**Depends on:** Phase 5
**Requirements:** MEMBER-01, MEMBER-02
**Success Criteria:**

1. An unread optional EdgeDeps member fails an automated static-analysis gate.
2. Read, write-only, structural, external-contract, type-only, alias, and computed-access controls establish scope and limitations.

**Plans:** 06-01 through 06-08 approved after independent plan review; live triage waits for Phase 5 completion. 06-01 landed the runnable gate: compiler inventory, syntax-first read classification and a three-way exit contract. 06-02 landed directed value transfers, so a read is credited back to the member that supplied it through arguments, returns, callbacks and containers; the live population moved from 614 findings to 468. 06-03 landed the contract engine: four evidence categories, identity settled through the inventory's declaration map, and every stale, broad or redundant entry refused as a setup failure; the repository contract file ships empty until the live reconciliation. 06-04 landed whole-object operations: serialization, copies, enumeration and deep comparison, each settled by the declaration the checker resolved and each with its real eligible-key semantics, plus the container members 06-02 left open. Unsupported analysis is now zero and the live population moved from 468 findings to 261. 06-05 landed the closure audit and recorded the live population; 06-06 reconciled it, taking 261 unread to an honest 138 through two directed-flow corrections and 81 validated contracts, each remaining row carrying a recorded disposition and a named owner repair plan. 06-07 landed the live sensitivity proof: an unread optional member planted into the REAL `EdgeDeps` declaration through a compiler read overlay is reported by exact declaration identity above that baseline, a real receiver read clears it, an unrelated same-spelling read does not, a run the gate cannot complete stays exit 2 with no report, and the runner itself is shown to reject an always-passing gate and five other defective ones. The six repair plans (06-09 through 06-14) and the three that followed them (06-15, 06-16, 06-17) drained the 138 to 6. 06-08 activated the gate: `lint:type-members` and `lint:type-members:negative` are both in the mandatory `npm run check` chain CI runs, two local pre-commit hooks invoke the same pair over the whole project on deliberately different triggers, and a per-row recorded-decision layer carries the residual by exact member coordinate and measured mechanism with no count, threshold or path glob expressible. Its own bounded cleanup took the population 6 -> 5 with zero findings gained. All 17 plans are complete; the phase awaits `/gsd-verify-work 06`.

- [x] 06-01-PLAN.md
- [x] 06-02-PLAN.md
- [x] 06-03-PLAN.md
- [x] 06-04-PLAN.md
- [x] 06-05-PLAN.md
- [x] 06-06-PLAN.md
- [x] 06-07-PLAN.md
- [x] 06-09-PLAN.md
- [x] 06-14-PLAN.md
- [x] 06-10-PLAN.md
- [x] 06-11-PLAN.md
- [x] 06-13-PLAN.md
- [x] 06-12-PLAN.md
- [x] 06-15-PLAN.md
- [x] 06-16-PLAN.md
- [x] 06-17-PLAN.md
- [x] 06-08-PLAN.md

### Phase 7: Reliable Coverage Metrics

**Goal:** Unit coverage converts to valid Istanbul data with measured source/function correspondence and no clamped coordinates.
**Depends on:** Phase 6
**Requirements:** METRIC-01, METRIC-02
**Success Criteria:**

1. Unit coverage converts to valid Istanbul data with measured source/function correspondence and no clamped coordinates.
2. Fallow health consumes verified coverage under a measured CRAP policy; offender and benign controls reject missing or misleading inputs.

**Plans:** 07-01 through 07-08 approved after independent plan review; producer qualification and production acceptance wait for the stable Phase 5/6 tree.

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
| 3. Reachable Agent Collision Contract | 4/4 | Complete | 2026-09-14 |
| 4. Strict Command Arguments | 3/3 | Complete | 2026-09-14 |
| 5. Production Export Ownership | 28/28 | Complete | 2026-09-15 |
| 6. Unused Type Member Gate | 17/17 | Complete | 2026-09-17 |
| 7. Reliable Coverage Metrics | 0/8 | Plans approved | - |
| 8. Final Verification and Reconciliation | 0/TBD | Not started | - |
