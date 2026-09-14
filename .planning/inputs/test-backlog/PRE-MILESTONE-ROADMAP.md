# Roadmap: pi-claude-marketplace

## Milestones

- ✅ **refine-unit-tests — Refine Unit Tests** — Phases 1-9 (shipped 2026-09-13)
- ✅ **v1.19 Unit Test Refactor** — Phases 108-117 (shipped 2026-09-04)

Earlier milestones are recorded in [`.planning/MILESTONES.md`](MILESTONES.md);
each one's full phase detail is archived under
[`.planning/milestones/`](milestones/).

## Phases

<details>
<summary>✅ refine-unit-tests — Refine Unit Tests (Phases 1-9) — SHIPPED 2026-09-13</summary>

v1.19 gave every production module an owner test. This milestone asked whether
those tests actually prove anything, starting from an evidence gate rather than
from a fix list: Phase 1 revalidated the entire adversarial-review corpus against
the post-v1.19 tree, and later phases were allowed to proceed only on premises
that still reproduced.

- [x] Phase 1: Live Evidence Revalidation (72/72 plans) — completed 2026-09-12
- [x] Phase 2: Containment and Input Safety (3/3 plans) — completed 2026-09-05
- [x] Phase 3: Production Defect Corrections (14/14 plans) — completed 2026-09-07
- [x] Phase 4: Hermetic Test Infrastructure (7/7 plans) — completed 2026-09-07
- [x] Phase 5: Injection and Ownership Design (34/34 plans) — completed 2026-09-08
- [x] Phase 6: Assertion and Module Refinement (52/52 plans) — completed 2026-09-10
- [x] Phase 7: Gate Integrity (16/16 plans) — completed 2026-09-10
- [x] Phase 8: Direct Coverage (9/9 plans) — completed 2026-09-11
- [x] Phase 9: Final Quality and Backlog Closure (6/6 plans) — completed 2026-09-11

**Archive:** [`milestones/refine-unit-tests-ROADMAP.md`](milestones/refine-unit-tests-ROADMAP.md) ·
[`milestones/refine-unit-tests-REQUIREMENTS.md`](milestones/refine-unit-tests-REQUIREMENTS.md) ·
[`milestones/refine-unit-tests-MILESTONE-AUDIT.md`](milestones/refine-unit-tests-MILESTONE-AUDIT.md)

</details>

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

What the next milestone inherits. All of it is deliberate rather than unfinished,
and each item names the evidence rather than a recollection.

- **Two accepted direct-coverage shortfalls, down from seven.** The pin in
  `scripts/test-coverage-direct.pin.json` now holds
  `bridges/commands/discover.ts` (`branches 55/57, lines 412/414`) and
  `orchestrators/plugin/install-outcome.ts`
  (`branches 109/111, lines 1043/1049`). The five v1.19 entries that were
  compiler-forced or structurally unreachable closed during Phase 8. The gate
  compares the WHOLE reading string, so it fails on an improvement exactly as on
  a regression — a shortfall that gets better still has to be re-pinned.
- **The window ledger is fully disposed.** `windows status` reads
  **open 0 / waived 13 / fixed 18 / total 31**. The 13 waives each carry a
  measured reason. Entry 9 is the operator-accepted `reconcile/apply.ts`
  exposure signed off 2026-09-02 — a durable record of residual risk, not a
  pending action. Entries 2 and 3 are stubs whose substance belongs to unshipped
  `STOP-07` / `SFAIL-03` work.
- **Three code-review findings left open by choice** — `IN-01`, `IN-03` and
  `IN-04` in the Phase 9 review. **`IN-03` is the one worth revisiting:** NFR-10
  path containment now rests on an injected collaborator honoring a prose-only
  contract that nothing type-enforces.
- **Two newly promoted backlog items** — `NEGCTL-01` (the direct-coverage
  negative control cannot capture its child's stderr on Node 26, so it cannot
  observe its own failure signal; latent because CI pins Node 24) and
  `E2EIMP-01` (three `import` e2e tests assert a summary header the command no
  longer emits). Both in [`.planning/BACKLOG.md`](BACKLOG.md).
- **PR #181 is open and unmerged by operator decision.** The milestone closed
  with its branch unmerged. All nine checks pass, the SonarCloud gate reads `OK`,
  and the pull request carries zero open issues.

Full ledger: [`.planning/WINDOWS.md`](WINDOWS.md).
Deferred and acknowledged artifacts: [`.planning/STATE.md`](STATE.md).

## Progress

No active milestone. Start the next one with `/gsd-new-milestone`.
