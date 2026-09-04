---
milestone: workflows
audited: 2026-08-16
status: passed
scores:
  requirements: 35/35
  phases: 5/5
  integration: 5/5
  flows: 6/6
gaps: {}
tech_debt:
  - phase: 104-workflow-lifecycle-completion
    items:
      - "The commit's double-fault branch (a restore failure during a rollback) has no automated test; every construction was a race. A reachable guard pins the non-fault half."
      - "A narrow update double fault: a WR-06 refusal AND a finalize save failure in the same run persists a record over-claiming a foreign name. Needs two independent failures."
      - "Two re-stage-window tests are POSIX-only and SKIP as root (0555 directory mode), so container CI running as root skips them silently."
      - "`unplaceWorkflows` failures surface only as leak strings on the manual-recovery message; no structured channel."
  - phase: 105-workflow-degradation-and-documentation
    items:
      - "Producer coverage is not type-enforced. A seventh component kind that satisfies the typecheck gate and the lock test but misses one of the two `components` producers is caught only by a hand-written whole-inventory test."
      - "A workflows cross-plugin name collision surfaces as a mid-ledger rollback rather than a pre-disk-write `CrossPluginConflictError` — a decided trade, rationale written at the exclusion site."
  - phase: milestone
    items:
      - "All five VALIDATION.md files are `status: draft` — seeded by plan-phase, never reconciled by validate-phase. A coverage TODO, not a compliance failure."
      - "A pre-existing bare planning-artifact token at `tests/orchestrators/reconcile/backfill.test.ts:320` predates this milestone (commit `c695bdab3`)."
nyquist:
  compliant_phases: 0
  partial_phases: 0
  not_validated_phases: 5
  missing_phases: 0
  overall: not-validated
---

# Milestone `workflows` — Audit

**Claude `workflows` Component-Kind Bridge** — 5 phases, 20 plans, 35 requirements.

## Verdict

**Passed.** All 35 requirements satisfied across three independent sources
(REQUIREMENTS.md traceability, phase VERIFICATION.md files, SUMMARY frontmatter).
All five phases verified `passed`. Cross-phase integration verified at all five named
seams. All six end-to-end flows complete.

Two blockers were found *during* this audit and fixed before it closed. Neither is
carried.

## Requirements Coverage

| Group | IDs | Status |
|---|---|---|
| Component kind recognition | WFLW-01..04 | satisfied |
| Naming | WNAM-01..06 | satisfied |
| Pre-validation | WVAL-01..03 | satisfied |
| Workflow artifact | WBRG-01..04 | satisfied |
| Paths and containment | WPTH-01..05 | satisfied |
| Lifecycle | WLIF-01..06 | satisfied |
| Soft dependency | WDEP-01..04 | satisfied |
| Documentation | WDOC-01..03 | satisfied |

No orphaned requirements — every ID appears in a phase VERIFICATION.md.

## Phase Verifications

| Phase | Plans | Verification | Code review |
|---|---|---|---|
| 101 Workflow component-kind recognition | 4/4 | passed 4/4 | 1 blocker, 2 warnings — **reviewed during this audit**, all fixed |
| 102 Workflow naming and script admission | 2/2 | passed 6/6 | resolved |
| 103 Workflow artifact materialization | 4/4 | passed 7/7 | 16 findings — in-scope fixed, 5 deferred to 104 and closed there |
| 104 Workflow lifecycle completion | 6/6 | passed 4/4 | 12 findings, all fixed |
| 105 Workflow degradation and documentation | 4/4 | passed 6/6 | 6 findings, all fixed |

Phase 101 entered this audit as the milestone's one unreviewed phase — an earlier
autonomous run was interrupted at that dispatch and the gap had been carried in STATE.md
ever since. It was reviewed here rather than shipped unreviewed.

## What the audit found, and why it matters

Two independent audits ran: a retroactive code review of Phase 101, and a cross-phase
integration check. **They converged on the same blocker without knowledge of each other.**

### Blocker — the record-backed `info` row dropped `workflows`

`composeStateOnlyComponents` read five `resources` arrays and never read
`record.resources.workflows`. It compiled clean because the field is optional on
`PluginInfoComponentsResolved`.

The break: a plugin whose marketplace manifest loaded but no longer declares it renders
through the record-backed arm. That row emitted `agents:` / `commands:` / `hooks:` /
`mcp:` / `skills:` and no `workflows:` line — while `resources.workflows` named envelopes
that were on disk. Those envelopes live **outside every scope root**, so that row is the
user's only remaining inventory of them, and it emitted `componentsResolved: true`. Not a
gap in the output: a positive, wrong claim.

Fixed, with the test gap that hid it closed. `seedPathMarketplace` declared a
`resources.workflows` override in its options type and then hard-coded `workflows: []`
when building the record — so no fixture in that file *could* have seeded a non-empty
value. The replacement seeds all six kinds non-empty in one row, so a producer that drops
any kind fails as a missing line rather than as a kind nobody wrote a fixture for.
Reverting the fix reddens it.

### The finding that explains why it survived

Phase 101 recorded a `COMPONENT_KINDS` "exact-length tuple" as its renderer-side closure
proof, and three later phases relied on it. **It did not close anything.** `ComponentKind`
is a union, so a widened union still accepts all six literals at arity six. The Phase 101
reviewer established this empirically rather than by reading: it reduced the declaration
and ran the repo's own strict typecheck — exit 0.

That is the more important of the two findings. The blocker was one instance; the false
closure proof is why instances were possible at all, and this milestone shipped the same
shape three times (`degradationFromEnable`, the seven `Dependency[]` derivations, and this
one).

It is now a real gate: adding a seventh key to the components interface produces
`TS2322`, verified both ways against the identical change that the old construct passed.
`COMPONENT_KINDS` is exported and pinned alongside `REASONS` / `STATUS_TOKENS`. The honest
limit is written into the test rather than left implied — the type system closes *tuple*
coverage, not *producer* coverage, and a kind that reaches both the interface and the
tuple but no producer still renders on no row. That residual is carried as tech debt above.

## Integration

| Seam | Status |
|---|---|
| 102 → 103 — verdict union consumed by discover and stage | wired; all four arms handled, no orphan arm |
| 103 → 104 — `resources.workflows` as the only inventory of out-of-scope-root files | wired; written by install/update/reinstall/enable, read by every removal path, backfilled on pre-existing records |
| 101 → 103/105 — convention axis reaches install, not just render | wired |
| 104 → 105 — the two new reason tokens share one closed set and one byte gate | wired; deterministic ordering, both individually pinned |
| Six-kind symmetry across all ten verbs | wired after the blocker fix |

### End-to-end flows

| Flow | Status |
|---|---|
| Install with engine present → envelope written → engine finds it after `/reload` | complete, **proven live** against engine 3.5.1 |
| Install with engine ABSENT → still written, row says why, later engine install + `/reload` works with no reinstall | complete, **proven live** (canary W1/W2/W3) |
| Install → update add/remove/rename → only the new version's artifacts remain | complete |
| Install → disable → enable → artifacts round-trip | complete |
| Install → uninstall → nothing left under the engine's storage root | complete, **proven live** (canary R1/R2, both scopes) |
| Install → manifest drops the plugin → `info` | complete after the blocker fix |

The live canary runs against a real `@quintinshaw/pi-dynamic-workflows` 3.5.1 installed
into a disposable scratch prefix. Its ability to FAIL was established by a negative
control (one uninstall skipped → named surviving envelope), so its pass is meaningful
rather than merely quiet. The engine appears in no dependency manifest and `npm run check`
stays offline and uncoupled from it.

## Quality gate

`npm run check` at HEAD: **exit 0** — typecheck, lint, format, 3698 unit tests passing
(1 skip: the known pi-subagents global-peer environment skip, unrelated to this
milestone), 18 integration tests passing, 0 failures.

## Nyquist coverage

All five phases are NOT-VALIDATED — every `VALIDATION.md` reads `status: draft`, meaning
it was seeded by plan-phase and never reconciled by validate-phase. Per the audit
contract this is a coverage TODO, not a compliance failure: `nyquist_compliant` is not
authoritative in the draft state. Running `/gsd-validate-phase <N>` on each phase would
yield the real COMPLIANT/PARTIAL verdict.

| Phase | VALIDATION.md | Status | Action |
|---|---|---|---|
| 101 | exists | draft | `/gsd-validate-phase 101` |
| 102 | exists | draft | `/gsd-validate-phase 102` |
| 103 | exists | draft | `/gsd-validate-phase 103` |
| 104 | exists | draft | `/gsd-validate-phase 104` |
| 105 | exists | draft | `/gsd-validate-phase 105` |

## Carried forward

Nothing blocking. The tech-debt items in the frontmatter are recorded decisions with
written rationale, not discovered gaps. The milestone-close work — version bump,
CHANGELOG entry, PR — remains outstanding and is deliberately not phase work.
