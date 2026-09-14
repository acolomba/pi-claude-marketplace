---
milestone: refine-unit-tests
audited: 2026-09-12
status: tech_debt
scores:
  requirements: 30/30
  phases: 9/9
  integration: 6/6
  flows: n/a
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: cross-phase
    items:
      - "RCOV-01: ROADMAP.md and ci.yml carried a stale 230 pair count against an actual 233. FIXED in this audit; both are unsealed prose carriers that no gate reads."
      - "Requirement seal: the `- [x]` checkbox is an UNSEALED carrier. Phase 9's seal is described as four carriers flipping together; only three are fail-closed."
  - phase: 01-live-evidence-revalidation
    items:
      - "`revalidation.mjs validate` exits 1 with 945 unsafe-reference violations -- expected staleness of a historical ledger; tooling retires with the milestone."
  - phase: 08-direct-coverage
    items:
      - "The `direct-coverage` CI job has never executed on a real event; first run is on the PR."
      - "The coverage pin's `reasons` are claims about unreachability that no gate can falsify."
  - phase: 09-final-quality-and-backlog-closure
    items:
      - "13 waived WINDOWS.md entries, each with a measured reason."
      - "Code-review findings IN-01, IN-03, IN-04 recorded as deliberate non-actions. IN-03 carries real risk: NFR-10 containment depends on an injected collaborator honoring a prose-only contract."
      - "GAUTH-01's named prescription and the unused-type-member todo deferred to v1.19."
---

# Milestone Audit — refine-unit-tests

**Status: `tech_debt`.** No blockers. Every requirement is satisfied and the gate chain holds;
what remains is deferred work that was dispositioned deliberately, plus one correction made here.

## Requirements — 30/30 satisfied

Cross-referenced across three independent sources: the `REQUIREMENTS.md` checkbox block, every
phase `VERIFICATION.md`, and the `requirements-completed` frontmatter of 211 of 213 `SUMMARY.md`
files. No partials. No orphans. The FAIL gate did not trip.

`GGAT-02` and `RCOV-04` sit in the traceability table as `Evidence only` rows, which is why the
table carries 32 rows against 30 checkboxes. Both are deliberate and both are pinned in
`SEALED_REQUIREMENT_ROUTES`.

## Phases — 9/9 passed

58/58 must-haves verified, one override (Phase 06). Phase 01 was re-verified during this session
after its two gaps were closed, moving from `gaps_found` 9/10 to `passed` 10/10.

## Integration — verified by fault injection

The integration check planted faults and measured the response rather than reading phase reports:
a vanished registry target (`no-orchestrator-network` 4 fail, `gate-targets` 1 fail), a tampered
`RCOV-01` count (`requirement-clause` violation), a regressed traceability status
(`invalid-requirement-route`), and a tampered ROADMAP phase title (`phase-title-contract`). Each
fired. Each was reverted.

Verified wired end-to-end: Phase 7's registry to its gates with no pin collapse (the multi-consumer
groups are type-level membership annotations, which fail to compile on drift rather than merging
two obligations into one pin); Phase 7's scanner contract, which rethrows every non-`ENOENT` error
so a vanished target fails instead of silently skipping; Phase 5's `RemovalOps` and
`HooksHydrationDeps` threaded as real parameters with no defaulted fallback; Phase 8's
`direct-coverage` job blocking `package` via `needs:`, with `pipefail` explicitly defusing the
`| tee` exit-code trap; and Phase 1's seal firing on title and status tampering.

## The two findings

### W1 — stale pair count in unsealed prose. FIXED here.

`63d35406` re-sealed the pair count 230 -> 233 across three carriers. `ROADMAP.md:784` and
`.github/workflows/ci.yml:143` still read 230. Phase 1's seal reads `ROADMAP.md` for phase titles
and canonical actions only, so success-criteria prose is an unsealed fourth carrier -- proven by
planting `999` and watching the gate pass. The gate itself was honest at 233; only the narrative
disagreed. Corrected in this audit.

### W2 — the checkbox carrier is unsealed. RECORDED, not fixed.

Un-ticking `- [x] **CLOSE-01**` while its traceability row still reads `Complete` leaves
`scope-impact --check` green at 40 records and the revalidation suite at 147/0. The two halves of
`REQUIREMENTS.md` can disagree about the same requirement with no gate noticing. Reproduced twice
independently.

**Why this is not being fixed:** the fix is a new validator plus negative controls inside
`scripts/revalidation.mjs` -- tooling scheduled for deletion in the very next step of this
milestone close (see `STATE.md`, `## At Milestone Close`). Writing, sealing and then deleting a
validator in one session is waste, and after retirement no scope-impact gate exists for the
checkbox to be unsealed against.

**What IS corrected is the claim.** Phase 9's narrative and `STATE.md` describe the requirement
seal as four carriers flipping together. Three are fail-closed: the traceability row,
`SEALED_REQUIREMENT_ROUTES`, and the clause signature. The checkbox is not one of them. A future
milestone inheriting the four-carrier belief would trust a seal that is weaker than advertised --
that correction is the durable part, and it outlives the tooling.

## Note on this file's path

The milestone is named, not versioned, so this report is `refine-unit-tests-MILESTONE-AUDIT.md`.
Automated paths that grep for `.planning/v<version>-MILESTONE-AUDIT.md` will not find it.
