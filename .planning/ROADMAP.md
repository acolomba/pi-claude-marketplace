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
**Plans:** 17 plans

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
- [ ] 01-01-PLAN.md — Build the validator, schema, planted tracer, and exact live inventory
- [ ] 01-02-PLAN.md — Review corpus paths 001-010 into an exclusive shard
- [ ] 01-03-PLAN.md — Review corpus paths 011-020 into an exclusive shard
- [ ] 01-04-PLAN.md — Review corpus paths 021-030 into an exclusive shard
- [ ] 01-05-PLAN.md — Review corpus paths 031-040 into an exclusive shard
- [ ] 01-06-PLAN.md — Review corpus paths 041-050 into an exclusive shard
- [ ] 01-07-PLAN.md — Review corpus paths 051-060 into an exclusive shard
- [ ] 01-08-PLAN.md — Review corpus paths 061-070 into an exclusive shard
- [ ] 01-09-PLAN.md — Review corpus paths 071-080 into an exclusive shard
- [ ] 01-10-PLAN.md — Review corpus paths 081-090 into an exclusive shard
- [ ] 01-11-PLAN.md — Review corpus paths 091-100 into an exclusive shard
- [ ] 01-12-PLAN.md — Review corpus paths 101-110 into an exclusive shard
- [ ] 01-13-PLAN.md — Merge all evidence and clear inconclusive gaps
- [ ] 01-14-PLAN.md — Resolve operator decisions 1-3 one dossier at a time
- [ ] 01-15-PLAN.md — Resolve operator decisions 4-6 one dossier at a time
- [ ] 01-16-PLAN.md — Resolve operator decisions 7-9 one dossier at a time
- [ ] 01-17-PLAN.md — Rewrite requirements and roadmap, then seal the hard gate

### Phase 2: Containment and Input Safety

**Goal:** Correct confirmed defects in path containment, MCP input, and lifecycle recovery.
**Depends on:** Phase 1
**Requirements:** PDEF-02, PDEF-03, PDEF-04
**Plans:** TBD

**Success Criteria**:

1. Regression tests prove that confirmed manifest- and state-derived path flows
   reject traversal, symlink escape, and lenient-read escape cases.
2. Malformed MCP values return stable failures and cannot cause unexpected
   throws or configuration writes.
3. Expected lifecycle failures stay contained, and `/reload` restores a usable
   plugin without restarting Pi.

### Phase 3: Production Defect Corrections

**Goal:** Fix each remaining confirmed production defect with regression evidence.
**Depends on:** Phase 2
**Requirements:** PDEF-01, PDEF-05, PDEF-06, PDEF-07, PDEF-08
**Plans:** TBD

**Success Criteria**:

1. Every confirmed production defect has a regression that fails without its
   fix and passes with it.
2. Failure handling uses typed classifications, including the confirmed
   `REASON-01` cases, without message-substring control flow.
3. Confirmed cleanup leaks, warnings, and returned diagnostics remain visible
   to their callers.
4. Confirmed dynamic-lookup, exhaustiveness, agent-discovery, alias,
   compact-trigger, and rollback defects behave safely at their public seams.

### Phase 4: Hermetic Test Infrastructure

**Goal:** Make confirmed test infrastructure isolated, typed, and faithful to production collaborators.
**Depends on:** Phase 3
**Requirements:** AUTH-01, TREF-01, TREF-02, TREF-03
**Plans:** TBD

**Success Criteria**:

1. Tests cannot read or write the developer's real home, Pi agent directory,
   or MCP configuration.
2. Shared fakes preserve function-bearing collaborators, including the actual
   authentication bundle observed by the code under test.
3. Revalidated auth paths produce host-specific no-provider guidance through
   tests that observe the real authentication collaborator.
4. Invalid fixtures and interactions are represented without broad-cast
   laundering or inexact doubles.

### Phase 5: Injection and Ownership Design

**Goal:** Expose legitimate test seams with correctly owned runtime state and public contracts.
**Depends on:** Phase 4
**Requirements:** TREF-04, TREF-05, TREF-06
**Plans:** TBD

**Success Criteria**:

1. Every confirmed hidden dependency used by tests has an explicit injection
   seam with unchanged production defaults.
2. Confirmed module-global mutable state is moved to factory-owned state and is
   isolated between instances and tests.
3. Tests exercise public contracts, and every test-only export named by
   `FLOW-09` is removed or retained with a recorded evidence-based disposition.

### Phase 6: Assertion and Module Refinement

**Goal:** Strengthen assertions and simplify confirmed problem modules without weakening contracts.
**Depends on:** Phase 5
**Requirements:** TREF-07, TREF-08, TREF-09
**Plans:** TBD

**Success Criteria**:

1. Confirmed fragment assertions are replaced with complete outcomes while the
   three documented caveats remain protected.
2. Confirmed prototype and builtin-module patches are replaced by case-owned
   seams wherever those seams can express the behavior.
3. Any approved module split occurs only after its prerequisites and updates
   the relevant gates, documentation, ownership, and completeness evidence.

### Phase 7: Gate Integrity

**Goal:** Make structural gates prove that they scan and enforce real production contracts.
**Depends on:** Phase 6
**Requirements:** GGAT-01, GGAT-02, GGAT-03, GGAT-04
**Plans:** TBD

**Success Criteria**:

1. Every confirmed scanning gate proves target visitation and passes both a
   synthetic offender and a benign control.
2. The agents collision gate is removed or retained from current discovery
   behavior, and the chosen public behavior has direct tests.
3. `FLOW-07` has an edge-by-edge ESLint/Fallow boundary matrix and a recorded
   keep, change, or close decision.
4. Closed-set and delegated-contract gates exercise their real production
   consumers rather than configuration alone.

### Phase 8: Direct Coverage

**Goal:** Re-establish honest direct coverage for every source-test pair and resolve shortfalls.
**Depends on:** Phase 7
**Requirements:** RCOV-01, RCOV-02, RCOV-03, RCOV-04
**Plans:** TBD

**Success Criteria**:

1. The milestone branch has a regenerated per-pair coverage baseline.
2. All seven carried shortfalls are reclassified; removable branches are
   rewritten, and retained compiler-forced cases have explicit evidence.
3. Direct coverage runs at the approved enforcement cadence without being
   represented as proof of assertion strength.
4. Both `COV-01` orchestrators have current measurements and either adequate
   tests or an explicit evidence-based disposition without exclusions that
   flatter the result.

### Phase 9: Final Quality and Backlog Closure

**Goal:** Prove the confirmed work as a whole and close the bundled backlog with an audit trail.
**Depends on:** Phase 8
**Requirements:** CLOSE-01, CLOSE-02
**Plans:** TBD

**Success Criteria**:

1. The complete project quality suite passes on the final milestone tree.
2. `TESTQ-01`, `COV-01`, `FLOW-09`, `AGCOL-01`, `REASON-01`, `GAUTH-01`, and
   the `FLOW-07` closure task each record whether they shipped, proved stale,
   or remain deliberately deferred.
3. Final milestone artifacts distinguish implemented fixes from stale findings
   and evidence-only closures.

## Progress

| Phase | Plans Complete | Status | Completed |
| ----- | -------------- | ------ | --------- |
| 1. Live Evidence Revalidation | 0/17 | Planned | — |
| 2. Containment and Input Safety | 0/0 | Not started | — |
| 3. Production Defect Corrections | 0/0 | Not started | — |
| 4. Hermetic Test Infrastructure | 0/0 | Not started | — |
| 5. Injection and Ownership Design | 0/0 | Not started | — |
| 6. Assertion and Module Refinement | 0/0 | Not started | — |
| 7. Gate Integrity | 0/0 | Not started | — |
| 8. Direct Coverage | 0/0 | Not started | — |
| 9. Final Quality and Backlog Closure | 0/0 | Not started | — |
