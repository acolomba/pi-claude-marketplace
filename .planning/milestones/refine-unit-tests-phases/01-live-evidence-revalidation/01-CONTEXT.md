# Phase 1: Live Evidence Revalidation - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 establishes the authoritative post-v1.19 scope before production or
test implementation begins. It individually reviews all 110 Markdown files in
the unit-test adversarial corpus, revalidates every actionable claim against
the live tree, resolves the surviving operator decisions, and rewrites the
remaining milestone from that evidence. This phase produces evidence and
planning artifacts; later phases own confirmed implementation work.

</domain>

<decisions>
## Implementation Decisions

### Manifest structure

- **D-01:** Use a file index plus a linked finding ledger. One file record is
  required for each of the 110 locked corpus paths, including files with no
  live findings.
- **D-02:** The canonical structured source is phase-owned
  `01-REVALIDATION.json`; generate a human-readable `01-REVALIDATION.md` view
  from it and fail validation if the view drifts.
- **D-03:** A file counts toward 110/110 only after its claims are enumerated,
  linked, and reconciled. Its derived outcome is one of `live findings`, `no
  live findings`, `control document`, or `superseded`.
- **D-04:** Lock the corpus path inventory, ordered by full relative path. Do
  not content-hash the files. If a corpus document is corrected during Phase
  1, reopen and re-review that file before completion.
- **D-05:** Preserve report-local finding labels under a corpus-path namespace;
  use a deterministic local ordinal only for unlabeled claims. Preserve every
  historical claim, and link duplicates to one canonical finding rather than
  deleting their source records.
- **D-06:** Separate evidence status (`confirmed`, `stale`, `superseded`,
  `duplicate`, or `inconclusive`) from routing (`Phase N`, evidence-only
  closure, deferred backlog, or operator decision).
- **D-07:** Every finding record carries current source and test references,
  validation method, command or probe result, disposition rationale, and
  destination. An unavailable field requires an explicit `N/A` reason.
- **D-08:** Extract actionable factual or prescriptive claims from briefs,
  synthesis files, and controls. Purely administrative text needs only a
  completed file record.
- **D-09:** Current evidence resolves disagreements between passes. The new
  ledger is authoritative; the old reports remain historical evidence even
  when corrected for clarity.
- **D-10:** A blocking validator must prove exactly 110 unique paths, unique
  identities, valid dispositions, complete claim links, and all mandatory
  evidence before Phase 1 passes.

### Confirmation threshold

- **D-11:** Apply an evidence ladder: failing behavioral probes for production
  defects, surviving mutations for test-strength claims, and current
  call-graph or static proof only for structural claims that cannot be
  executed.
- **D-12:** Mark a finding stale only with positive stale proof: locate the
  current symbol or replacement, rerun the original or an equivalent probe,
  and explain which premise no longer holds. Missing line references or green
  tests alone are insufficient.
- **D-13:** An `inconclusive` record blocks Phase 1 until the evidence gap is
  resolved or the user explicitly defers it out of active scope with a reason.
- **D-14:** Reproduction is hermetic by default. Use temporary roots and
  injected collaborators; probes involving real user state, credentials,
  network access, or destructive access require explicit approval or remain
  unresolved.

### Operator decisions

- **D-15:** Surface only operator decisions whose premises survive
  revalidation. Present one evidence dossier at a time with current proof,
  viable choices, affected findings, and a recommendation.
- **D-16:** Order surviving decisions by risk and dependency: safety and
  production contracts first, followed by decisions that unblock test
  architecture, gates, and coverage.
- **D-17:** Recommendations prioritize unit-test guideline conformity,
  specifically eliminating test-only exports, dead branches, and dishonest
  cases. Safety defects remain highest priority. Current evidence may justify
  public API or behavior changes rather than preserving them mechanically.
- **D-18:** Record each choice durably with its evidence, selected option,
  rejected alternatives, affected findings, and exact downstream requirement
  and phase changes.

### Scope rewriting

- **D-19:** When all premises behind a requirement are stale, move it out of
  active scope while preserving its ID and evidence trail. Do not delete it or
  mark it implemented.
- **D-20:** If that leaves a later phase empty, retire it from active execution
  without renumbering subsequent phases.
- **D-21:** Split mixed requirements: retain only confirmed clauses in active
  scope and move stale clauses into the evidence trail.
- **D-22:** A newly discovered issue may add a requirement and later-phase
  route only when it directly fits this milestone's unit-test-quality
  boundary. Defer unrelated discoveries.
- **D-23:** Before Phase 2 planning, update `REQUIREMENTS.md` and `ROADMAP.md`
  from the completed ledger so later execution contains only confirmed work.

### the agent's Discretion

- Exact JSON field names and normalization details, provided the locked
  evidence semantics and blocking validation remain machine-checkable.
- How the 110 files are divided into execution plans and review batches.
- Which safe command or probe satisfies each rung of the evidence ladder.

### Folded Todos

- **No gate detects an unused type member:** revalidate the pending todo's
  premise during Phase 1. If it remains live, implementation stays assigned to
  Phase 7 with offender and benign controls; Phase 1 records evidence only.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone contract

- `.planning/PROJECT.md` — milestone goal, scope, and post-v1.19 authority rule.
- `.planning/REQUIREMENTS.md` — RVAL-01 through RVAL-04 and the conditional
  downstream requirements Phase 1 must revalidate.
- `.planning/ROADMAP.md` — Phase 1 boundary, success criteria, and evidence-gate
  dependency for Phases 2-9.
- `.planning/milestones/v1.19-ROADMAP.md` — the refactor that changed the tree
  after the corpus was produced.
- `.planning/milestones/v1.19-REQUIREMENTS.md` — the shipped source-test-pair
  contract against which old findings may now be stale.
- `.planning/milestones/v1.19-MILESTONE-AUDIT.md` — final v1.19 verification and
  carried evidence.

### Review corpus and guidelines

- `.planning/reviews/unit-test-adversarial/` — all 110 Markdown files are
  mandatory individual inputs; selective reading is not sufficient.
- `.planning/reviews/unit-test-adversarial/README.md` — corpus provenance,
  counts, and historical reading order.
- `.planning/reviews/unit-test-adversarial/META-FINDINGS.md` — consolidated
  claims, nine operator decisions, struck findings, and historical sequencing.
- `.planning/reviews/unit-test-adversarial/_AUDIT.md` — reviewer calibration and
  corpus-wide tallies that must themselves be revalidated.
- `.claude/rules/typescript-unit-testing.md` — project unit-test rules whose
  violations the corpus claims to identify.
- `.agents/skills/typescript-unit-testing-review/SKILL.md` — current review
  rubric used to interpret the project rules.

### Backlog and prior evidence

- `.planning/BACKLOG.md` — definitions and status of `TESTQ-01` and the bundled
  backlog items.
- `.planning/WINDOWS.md` — D-116-01a coverage-shortfall ledger referenced by
  the operator-decision synthesis.
- `.planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md` —
  the Phase 7 gate candidate whose premise Phase 1 revalidates.

### Discovery maps

- `.planning/codebase/TESTING.md` — pre-refactor testing map; use only as a lead
  and verify every relevant claim against the current tree.
- `.planning/codebase/CONVENTIONS.md` — pre-refactor conventions and known
  naming conflict; not current authority by itself.
- `.planning/codebase/STRUCTURE.md` — pre-refactor source/test structure; use
  only to locate current integration points.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- Node's built-in test runner and `node:assert/strict` provide the behavioral
  reproduction surface; real filesystem cases use case-owned temporary roots.
- `tests/helpers/source-scan.ts` is the established source-scanning seam for
  architecture gates and planted offender controls.
- `scripts/test-coverage-direct.mjs` and the v1.19 D-116-01a ledger provide the
  current per-pair coverage measurement path.
- CodeGraph is indexed for this repository and is the first stop for current
  symbols and call paths before text search.

### Established Patterns

- Each production TypeScript module now has one mirrored owner test importing
  it directly; old test paths and helper assumptions may therefore be stale.
- Public-interface testing, explicit dependency injection, case-owned mutable
  state, typed errors, and exact structured outcomes are the intended rules.
- Architecture gates must prove target visitation and demonstrate both an
  offender and a benign control, not merely inspect configuration.

### Integration Points

- `01-REVALIDATION.json` is the canonical output consumed by the generated
  Markdown view, the Phase 1 validator, operator-decision dossiers, and later
  phase planning.
- Phase 1 ends by reconciling `.planning/REQUIREMENTS.md` and
  `.planning/ROADMAP.md`; no Phase 2 plan is valid before that rewrite.
- `.planning/spikes/MANIFEST.md` exists without a packaged findings skill, so
  raw spike notes are non-authoritative unless independently revalidated.

</code_context>

<specifics>
## Specific Ideas

- The 110/110 count is a proof obligation: 45 first-pass reports, 58
  adversarial reports, and 7 briefs, synthesis documents, or controls.
- Historical `file:line` references point at `c8417fbc`; current line numbers
  and behavior must be derived again from this branch.
- Guideline conformity can justify real design changes, but no archived claim
  authorizes a change without current evidence.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1's evidence and scope-gate boundary.

</deferred>

---

*Phase: 01-live-evidence-revalidation*
*Context gathered: 2026-09-04*
