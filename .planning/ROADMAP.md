# Roadmap: pi-claude-marketplace

## Milestones

- 🚧 **refine-unit-tests — Refine Unit Tests** — Phases 1-9 (planning)
- ✅ **v1.19 Unit Test Refactor** — Phases 108-117 (shipped 2026-09-04)

Earlier milestones are recorded in [`.planning/MILESTONES.md`](MILESTONES.md);
each one's full phase detail is archived under
[`.planning/milestones/`](milestones/).

## Phases

<details>
<summary>✅ v1.19 Unit Test Refactor (Phases 108-117) — SHIPPED 2026-09-04</summary>

Every production TypeScript module now has exactly one mirrored owner test that
imports it directly. 204 pairs, corresponding-test gate at zero violations.

- [x] Phase 108: Domain and Platform (24/24 plans) — completed 2026-08-29
- [x] Phase 109: Shared Contracts (19/19 plans) — completed 2026-08-29
- [x] Phase 110: Persistence and Transaction (12/12 plans) — completed 2026-08-30
- [x] Phase 111: Non-Hook Component Bridges (31/31 plans) — completed 2026-08-30
- [x] Phase 112: Hook Runtime (31/31 plans) — completed 2026-08-31
- [x] Phase 113: Orchestrator Support and Presenters (35/35 plans) — completed 2026-09-01
- [x] Phase 114: Plugin and Marketplace Lifecycle (17/17 plans) — completed 2026-09-01
- [x] Phase 115: Composition Orchestrators (8/8 plans) — completed 2026-09-02
- [x] Phase 116: Edge Surface (31/31 plans) — completed 2026-09-03
- [x] Phase 117: Extension Entry and Final Gate (12/12 plans) — completed 2026-09-04

**Archive:** [`milestones/v1.19-ROADMAP.md`](milestones/v1.19-ROADMAP.md) ·
[`milestones/v1.19-REQUIREMENTS.md`](milestones/v1.19-REQUIREMENTS.md) ·
[`milestones/v1.19-MILESTONE-AUDIT.md`](milestones/v1.19-MILESTONE-AUDIT.md)

</details>

## Carried Forward

Two things the next milestone inherits, both deliberate rather than unfinished:

- **Seven accepted D-116-01a shortfalls** — `edge/args.ts`, `edge/completions/data.ts`,
  `edge/completions/provider.ts`, `edge/handlers/marketplace/update.ts`,
  `edge/handlers/plugin/import.ts`, `edge/handlers/plugin/pending.ts` and
  `edge/handlers/shared.ts` each fall exactly one branch short. Five are
  compiler-forced, two structurally unreachable, and `!`/`as` are barred
  throughout `extensions/`, so each closes only by a production rewrite. They are
  pinned by identity in their own pairs and filed as ledger entries 15-19, 21 and
  22. While any of them stands, `npm run test:coverage:direct:all` exits 1 on a
  clean tree by design.
- **Documentation drift from the relocations** — five ledger entries naming test
  paths that phases 117-02/04/05 vacated, plus `.planning/codebase/TESTING.md`
  and `CONVENTIONS.md` describing the pre-refactor tree. None affects a gate; two
  live under `extensions/`, which phase 117 had no licence to touch.

Full ledger: [`.planning/WINDOWS.md`](WINDOWS.md).

## 🚧 Milestone refine-unit-tests — Refine Unit Tests

This milestone begins with an evidence gate. Phase 1 revalidates the complete
adversarial-review corpus against the post-v1.19 tree. Before Phase 2 is
planned, requirements and later phases whose premises no longer reproduce must
be narrowed or moved out of scope with evidence.

### Phase 1: Live Evidence Revalidation

**Goal:** Establish the complete reproducible scope before changing code.
**Depends on:** Nothing
**Requirements:** RVAL-01, RVAL-02, RVAL-03, RVAL-04
**Plans:** 69/69 plans complete

**Success Criteria**:

1. A manifest enumerates 110 unique corpus files: 45 first-pass reports, 58
   adversarial reports, and 7 briefs, synthesis documents, or controls.
2. Every recorded finding has a current disposition, current source and test
   references, and reproduction evidence where applicable.
3. The nine operator decisions in `META-FINDINGS.md` are recorded only after
   their premises have been checked against the live tree.
4. Stale, struck, and superseded claims are removed from active scope, and the
   requirements and remaining roadmap are revised before Phase 2 planning.

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Build the production-quality evidence-gate tracer and its complete validator foundation

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Individually revalidate corpus paths 001-002 into one bounded exclusive shard
- [x] 01-03-PLAN.md — Individually revalidate corpus paths 003-005 into one bounded exclusive shard
- [x] 01-04-PLAN.md — Individually revalidate corpus paths 006-007 into one bounded exclusive shard
- [x] 01-05-PLAN.md — Individually revalidate corpus path 008 into one bounded exclusive shard
- [x] 01-06-PLAN.md — Individually revalidate corpus paths 009-010 into one bounded exclusive shard
- [x] 01-07-PLAN.md — Individually revalidate corpus path 011 into one bounded exclusive shard
- [x] 01-08-PLAN.md — Individually revalidate corpus paths 012-013 into one bounded exclusive shard
- [x] 01-09-PLAN.md — Individually revalidate corpus paths 014-015 into one bounded exclusive shard
- [x] 01-10-PLAN.md — Individually revalidate corpus paths 016-017 into one bounded exclusive shard
- [x] 01-11-PLAN.md — Individually revalidate corpus path 018 into one bounded exclusive shard
- [x] 01-12-PLAN.md — Individually revalidate corpus paths 019-020 into one bounded exclusive shard
- [x] 01-13-PLAN.md — Individually revalidate corpus path 021 into one bounded exclusive shard
- [x] 01-14-PLAN.md — Individually revalidate corpus paths 022-023 into one bounded exclusive shard
- [x] 01-15-PLAN.md — Individually revalidate corpus path 024 into one bounded exclusive shard
- [x] 01-16-PLAN.md — Individually revalidate corpus paths 025-026 into one bounded exclusive shard
- [x] 01-17-PLAN.md — Individually revalidate corpus paths 027-028 into one bounded exclusive shard
- [x] 01-18-PLAN.md — Individually revalidate corpus paths 029-030 into one bounded exclusive shard
- [x] 01-19-PLAN.md — Individually revalidate corpus path 031 into one bounded exclusive shard
- [x] 01-20-PLAN.md — Individually revalidate corpus paths 032-033 into one bounded exclusive shard
- [x] 01-21-PLAN.md — Individually revalidate corpus paths 034-035 into one bounded exclusive shard
- [x] 01-22-PLAN.md — Individually revalidate corpus path 036 into one bounded exclusive shard
- [x] 01-23-PLAN.md — Individually revalidate corpus paths 037-038 into one bounded exclusive shard
- [x] 01-24-PLAN.md — Individually revalidate corpus paths 039-040 into one bounded exclusive shard
- [x] 01-25-PLAN.md — Individually revalidate corpus path 041 into one bounded exclusive shard
- [x] 01-26-PLAN.md — Individually revalidate corpus paths 042-043 into one bounded exclusive shard
- [x] 01-27-PLAN.md — Individually revalidate corpus paths 044-045 into one bounded exclusive shard
- [x] 01-28-PLAN.md — Individually revalidate corpus paths 046-047 into one bounded exclusive shard
- [x] 01-29-PLAN.md — Individually revalidate corpus paths 048-049 into one bounded exclusive shard
- [x] 01-30-PLAN.md — Individually revalidate corpus paths 050-051 into one bounded exclusive shard
- [x] 01-31-PLAN.md — Individually revalidate corpus paths 052-053 into one bounded exclusive shard
- [x] 01-32-PLAN.md — Individually revalidate corpus path 054 into one bounded exclusive shard
- [x] 01-33-PLAN.md — Individually revalidate corpus paths 055-056 into one bounded exclusive shard
- [x] 01-34-PLAN.md — Individually revalidate corpus paths 057-058 into one bounded exclusive shard
- [x] 01-35-PLAN.md — Individually revalidate corpus paths 059-060 into one bounded exclusive shard
- [x] 01-36-PLAN.md — Individually revalidate corpus path 061 into one bounded exclusive shard
- [x] 01-37-PLAN.md — Individually revalidate corpus paths 062-063 into one bounded exclusive shard
- [x] 01-38-PLAN.md — Individually revalidate corpus paths 064-065 into one bounded exclusive shard
- [x] 01-39-PLAN.md — Individually revalidate corpus path 066 into one bounded exclusive shard
- [x] 01-40-PLAN.md — Individually revalidate corpus paths 067-069 into one bounded exclusive shard
- [x] 01-41-PLAN.md — Individually revalidate corpus paths 070-072 into one bounded exclusive shard
- [x] 01-42-PLAN.md — Individually revalidate corpus paths 073-075 into one bounded exclusive shard
- [x] 01-43-PLAN.md — Individually revalidate corpus paths 076-078 into one bounded exclusive shard
- [x] 01-44-PLAN.md — Individually revalidate corpus paths 079-081 into one bounded exclusive shard
- [x] 01-45-PLAN.md — Individually revalidate corpus paths 082-084 into one bounded exclusive shard
- [x] 01-46-PLAN.md — Individually revalidate corpus paths 085-087 into one bounded exclusive shard
- [x] 01-47-PLAN.md — Individually revalidate corpus paths 088-090 into one bounded exclusive shard
- [x] 01-48-PLAN.md — Individually revalidate corpus paths 091-093 into one bounded exclusive shard
- [x] 01-49-PLAN.md — Individually revalidate corpus paths 094-096 into one bounded exclusive shard
- [x] 01-50-PLAN.md — Individually revalidate corpus paths 097-099 into one bounded exclusive shard
- [x] 01-51-PLAN.md — Individually revalidate corpus paths 100-102 into one bounded exclusive shard
- [x] 01-52-PLAN.md — Individually revalidate corpus paths 103-105 into one bounded exclusive shard
- [x] 01-53-PLAN.md — Individually revalidate corpus paths 106-108 into one bounded exclusive shard
- [x] 01-54-PLAN.md — Individually revalidate corpus paths 109-110 into one bounded exclusive shard

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-55-PLAN.md — Repair bounded shard/schema defects and publish the transport-complete canonical evidence ledger

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-56-PLAN.md — Canonicalize duplicates and resolve every evidence-method conflict in the merged ledger

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-57-PLAN.md — Close all 109 remaining evidence gaps with current terminal proof while preserving the nine pending operator decisions

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01-58-PLAN.md — Select trace-preserving removal for MF-DEC-01 from 24 terminal premise roots

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 01-59-PLAN.md — Close MF-DEC-04 evidence-only from stale sole premise SNC-F001

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 01-60-PLAN.md — Select one-to-one source-claim mapping for MF-DEC-05

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 01-61-PLAN.md — Resolve MF-DEC-06 as one evidence dossier and blocking checkpoint

**Wave 10** *(blocked on Wave 9 completion)*

- [x] 01-62-PLAN.md — Resolve MF-DEC-02 as one evidence dossier and blocking checkpoint

**Wave 11** *(blocked on Wave 10 completion)*

- [x] 01-63-PLAN.md — Resolve MF-DEC-03 as one evidence dossier and blocking checkpoint

**Wave 12** *(blocked on Wave 11 completion)*

- [x] 01-64-PLAN.md — Resolve MF-DEC-07 as one evidence dossier and blocking checkpoint

**Wave 13** *(blocked on Wave 12 completion)*

- [x] 01-65-PLAN.md — Resolve MF-DEC-08 as one evidence dossier and blocking checkpoint

**Wave 14** *(blocked on Wave 13 completion)*

- [x] 01-66-PLAN.md — Resolve MF-DEC-09 as one evidence dossier and blocking checkpoint

**Wave 15** *(blocked on Wave 14 completion)*

- [x] 01-67-PLAN.md — Derive the complete evidence-backed scope-impact crosswalk before editing planning contracts

**Wave 16** *(blocked on Wave 15 completion)*

- [x] 01-68-PLAN.md — Apply the validated crosswalk to requirements and Phase 2-9 roadmap contracts with explicit history

**Wave 17** *(blocked on Wave 16 completion)*

- [x] 01-69-PLAN.md — Rewrite the active milestone scope from the completed ledger and seal Phase 1 as the hard evidence gate

**Cross-cutting constraints:**

- Evidence uses the D-11 ladder and D-12 positive stale proof; mutations run only in repository-local isolated copies and never alter live source/test files (D-14).
- The normalized files/sourceClaims/findings ledger contract is used exactly, with evidence status independent from routing (D-01, D-05 through D-07).
- This plan owns one exclusive shard and cannot write the canonical ledger or another plan's shard.
- Only decisions with surviving current premises reach the operator; stale premises close as evidence-only (D-15).
- Dossiers are presented one at a time in risk/dependency order and never batched (D-15, D-16).
- Recommendations favor safety and guideline conformity, including removing test-only exports, dead branches, and dishonest cases (D-17).
- Every choice records evidence, selected and rejected alternatives, affected finding IDs, and exact downstream consequences (D-18).
- Stale-only or unsupported historical work moves to evidence without an implementation claim, while mixed requirements retain only terminally supported clauses (D-19, D-21).
- Later phase numbers and requirement IDs remain stable; a phase retires in place only if no terminal work remains (D-20).
- New active work requires a terminal finding inside the current unit-test-quality boundary, and planning contracts must round-trip to the canonical crosswalk (D-22, D-23).

### Phase 2: Containment and Input Safety

**Goal:** Correct confirmed defects in path containment, MCP input, and lifecycle recovery.
**Depends on:** Phase 1
**Requirements:** PDEF-02, PDEF-03, PDEF-04
**Plans:** 1/3 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Make malformed MCP field classification truthful, shared, typed, and fail-closed

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-02-PLAN.md — Normalize shared path containment and prove affected live consumers

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 02-03-PLAN.md — Contain discovery failures, preserve progress, and prove reload recovery

**Success Criteria**:

1. Direct owner regressions prove that each terminal manifest- and state-derived
   path flow preserves its allowed root and rejects traversal, symlink escape,
   and lenient-read escape.
2. The terminal malformed-MCP input case returns its typed stable failure
   without an unexpected throw or configuration write.
3. Terminal resource-discovery and lifecycle-mutation failures preserve exact
   partial state, and `/reload` restores a usable plugin without restarting Pi.

### Phase 3: Production Defect Corrections

**Goal:** Fix each remaining confirmed production defect with regression evidence.
**Depends on:** Phase 2
**Requirements:** PDEF-01, PDEF-05, PDEF-06, PDEF-07, PDEF-08
**Plans:** TBD

**Success Criteria**:

1. Every terminal production defect routed here has a direct owner regression
   that fails without its correction and passes with it; stale or evidence-only
   claims authorize no implementation.
2. Terminal lock-contention, sibling-sweep, and malformed-input reasons use
   explicit typed classifications without message-substring control flow.
3. Terminal cleanup, warning, and diagnostic paths preserve the primary error,
   attach cleanup context, and leave no persistent artifact.
4. Dynamic lookup rejects unsupported values, and unreachable test-shaped
   branches are removed without weakening real guards.
5. The reconcile-alias source-claim map is one-to-one and fail-closed while
   preserving manifest-derived state identity; independently terminal agent,
   compact, and rollback behavior keeps its own contract.

### Phase 4: Hermetic Test Infrastructure

**Goal:** Make confirmed test infrastructure isolated, typed, and faithful to production collaborators.
**Depends on:** Phase 3
**Requirements:** AUTH-01, TREF-01, TREF-02, TREF-03
**Plans:** TBD

**Success Criteria**:

1. Terminal hermeticity cases use case-owned temporary filesystem state and
   cannot read or write the developer's real home, Pi agent directory, or MCP
   configuration.
2. Shared external-failure doubles preserve function-bearing collaborators,
   including the authentication bundle observed by the code under test.
3. Auth tests cover hostile-host rejection, optional collaborator behavior,
   and realistic authentication-failure propagation.
4. Typed production-domain values and exact role-named doubles replace broad-
   cast laundering and test-helper terminology in production while preserving
   behavior and typings.

### Phase 5: Injection and Ownership Design

**Goal:** Expose legitimate test seams with correctly owned runtime state and public contracts.
**Depends on:** Phase 4
**Requirements:** TREF-04, TREF-05, TREF-06
**Plans:** TBD

**Success Criteria**:

1. Each terminal hidden dependency uses real temporary filesystem state by
   default or a narrow production-owned port only for irreproducible faults or
   timing; the two selected composition exceptions retain public-result and
   complete state assertions without test-only seams.
2. Terminal mutable module state moves to legitimate lifecycle or factory
   ownership without reset exports created only for tests.
3. Tests exercise public contracts, and terminal test-only exports, reset
   hooks, and test-shaped branches follow their trace-preserving removal route.

### Phase 6: Assertion and Module Refinement

**Goal:** Strengthen assertions and simplify confirmed problem modules without weakening contracts.
**Depends on:** Phase 5
**Requirements:** TREF-07, TREF-08, TREF-09
**Plans:** TBD

**Success Criteria**:

1. Observable assertions use complete exact outcomes, including structural
   single/plural cardinality and newly visible plural tallies, while documented
   caveats remain protected.
2. Global prototype and builtin-module patches and dishonest dense-index cases
   are removed through real case-owned state or narrow production-owned ports,
   with no ignore pragma or test-only export.
3. After Phase 2 and 3 prerequisites, the approved resolver, notify, install,
   update, reinstall, list, and catalog splits land at named seams with paired
   tests, one end-to-end proof per flow, and gate, documentation, ownership, and
   completeness repointing; uninstall and the deferred info split remain out.

### Phase 7: Gate Integrity

**Goal:** Make structural gates prove that they scan and enforce real production contracts.
**Depends on:** Phase 6
**Requirements:** GGAT-01, GGAT-03, GGAT-04
**Plans:** TBD

**Success Criteria**:

1. Every terminal scanning-gate gap proves target visitation and passes a
   synthetic offender and a benign control; changed-pair discovery also proves
   deterministic base selection and a fail-closed zero-selection case.
2. `FLOW-07` varies effective config sources and broad overrides across its
   terminal ESLint/Fallow boundary gaps and proves target visitation.
3. Terminal closed-set and delegated-contract gates exercise their real
   production consumers and any public seams created by approved splits.

**Evidence/history:** `GGAT-02`/`AGCOL-01` retains its stable identity and former
Phase 7 trace, but no dedicated terminal finding supports active implementation.
It can return only after current revalidation; it is not marked implemented.

### Phase 8: Direct Coverage

**Goal:** Re-establish honest direct coverage for every source-test pair and resolve shortfalls.
**Depends on:** Phase 7
**Requirements:** RCOV-01, RCOV-02, RCOV-03
**Plans:** TBD

**Success Criteria**:

1. The milestone branch has one regenerated baseline for all 204 current source-
   test pairs, including the two historical `COV-01` orchestrators, and every
   refusal is reported without stale counts or a false pass.
2. All seven terminal shortfalls are reclassified; the two removable dense-
   index guards are honestly rewritten and the five genuinely compiler-forced
   cases retain current evidence without an allowlist or exclusion.
3. The same strict changed-pair gate runs in scoped local pre-commit and a
   dedicated authoritative CI job with fail-closed base and pair selection;
   coverage remains reachability evidence only.

**Evidence/history:** `RCOV-04`/`COV-01` retains its stable identity and former
Phase 8 trace. Its standalone remeasurement is superseded by `RCOV-01`'s full
baseline, which still includes both pairs; neither is a terminal shortfall.

### Phase 9: Final Quality and Backlog Closure

**Goal:** Prove the confirmed work as a whole and close the bundled backlog with an audit trail.
**Depends on:** Phase 8
**Requirements:** CLOSE-01, CLOSE-02
**Plans:** TBD

**Success Criteria**:

1. The complete project quality suite passes after every terminal work item,
   selected control, focused owner test, and independent assertion-strength
   requirement is complete.
2. `TESTQ-01`, `FLOW-09`, `REASON-01`, and `FLOW-07` record their shipped
   terminal routes; `COV-01`, `AGCOL-01`, the unused-type-member todo, and the
   named `GAUTH-01` prescription retain explicit evidence-only or deferred
   histories.
3. Final milestone artifacts distinguish implemented fixes from stale,
   unsupported, and evidence-only records and verify the selected local and CI
   coverage controls without treating reachability as assertion strength.

## Progress

| Phase | Plans Complete | Status | Completed |
| ----- | -------------- | ------ | --------- |
| 1. Live Evidence Revalidation | 69/69 | Complete | 2026-09-05 |
| 2. Containment and Input Safety | 1/3 | In Progress | — |
| 3. Production Defect Corrections | 0/0 | Not started | — |
| 4. Hermetic Test Infrastructure | 0/0 | Not started | — |
| 5. Injection and Ownership Design | 0/0 | Not started | — |
| 6. Assertion and Module Refinement | 0/0 | Not started | — |
| 7. Gate Integrity | 0/0 | Not started | — |
| 8. Direct Coverage | 0/0 | Not started | — |
| 9. Final Quality and Backlog Closure | 0/0 | Not started | — |
