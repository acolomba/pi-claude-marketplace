# Phase 70: Spec & Documentation Reconcile - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

The final milestone phase: reconcile the byte-level output-contract docs and the
PRD to the FINAL token set, derived-state severity, and force-upgradable rules,
and remove the dropped-scope items. Also finalizes the small residual code item
that Phase 69 deliberately deferred here (the `unavailable`-arm severity), and
freezes the placeholder `--force` hint trailer.

- DOC-01: PRD §11 documents `--force` install/update, the three-way resolver
  state, the new status tokens, and the force-upgradable rules, and FULLY
  REMOVES the dropped items (global force default, manual `complete` command).
- DOC-02: `docs/output-catalog.md` + `docs/messaging-style-guide.md` reflect the
  reconciled token set (`force-installed`, `unsupported`, `force-upgradable`),
  the derived-state severity, and the exact byte forms — catalog-UAT GREEN.
- DOC-03: no stale comment claims idempotent autoupdate is "warning"; such cases
  are documented as info/benign.

Builds on Phases 64-69 (the final shipped behavior this phase documents) and
65.1 (the corrected will-grammar).

Requirements DOC-01, DOC-02, DOC-03 are locked by the ROADMAP — discussion below
is HOW (the specific reconcile decisions), not WHAT.

</domain>

<decisions>
## Implementation Decisions

### SEV-02 `--force` hint wording (freeze)
- **D-70-01:** Keep the Phase 69 trailer EXACTLY as shipped —
  `Re-run with --force to install the supported components.` — and freeze it.
  Drop the `placeholder` comment markers around `FORCE_INSTALL_HINT_TRAILER`
  (notify.ts ~2167, ~3352) and lock the byte-form into `docs/output-catalog.md`
  and `docs/messaging-style-guide.md`. No wording change.

### `unavailable`-arm severity (finalize the SEV-02 residual)
- **D-70-02:** Stamp the no-`--force` install of an `unavailable` (structural)
  plugin at **error** severity with NO `--force` suggestion — completing the
  half of SEV-02 that Phase 69 deferred here (the `unsupported` arm already
  stamps `forceHint: true, severity: "error"` at install.ts:1525; the
  `unavailable` arm was left byte-frozen). This is a SMALL code change plus its
  byte/test/catalog updates. Planning MUST first verify the unavailable arm's
  current rendered severity (it may already be error via the structural
  "always-error" path at notify.ts ~465) — if it is already error, this reduces
  to documenting it; if not, stamp it.

### WR-01 autoupdate companion warning (leave + document)
- **D-70-03:** Do NOT add the missing-soft-dep-companion warning to the
  marketplace autoupdate cascade. SEV-01's companion-warning is scoped to
  `install` (and manual `update`) success; autoupdate severity is governed by
  SEV-03, and autoupdate's actionable signal (new degradation) is already a
  warning. Keep the Phase 69 scoping; document it in the docs/PRD and keep the
  auditable comment at `outcomeToCascadePluginMessage`.

### Dropped-scope removal (DOC-01)
- **D-70-04:** FULLY REMOVE "global force default" and the manual `complete`
  command from PRD §11 and any other spec text — not deprecation notes. The
  authoritative spec should read as if they were never planned, describing only
  the shipped design.

### Claude's Discretion
- The exact PRD §11 prose structure and which sub-sections document `--force`,
  the three-way state, the new tokens, and force-upgradable — left to planning,
  provided DOC-01/02/03 are satisfied and catalog-UAT stays GREEN.
- Whether the unavailable-arm severity change (if needed per D-70-02) is one
  task or folded with the doc updates.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Docs being reconciled (the deliverables)
- `docs/prd/pi-claude-marketplace-prd.md` §11 — DOC-01 target (document force
  feature set; remove dropped scope).
- `docs/output-catalog.md` — DOC-02 byte-exact row/token catalog (catalog-UAT
  asserts against it).
- `docs/messaging-style-guide.md` — DOC-02 token grammar + severity legend.

### Code touched / verified
- `extensions/pi-claude-marketplace/shared/notify.ts` — `FORCE_INSTALL_HINT_TRAILER`
  (~2167, render ~3352), the structural "always error" path (~465), the
  closed-set token list (22/17/7).
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — the
  forceable vs unavailable arm stamping (~1509-1553) for D-70-02.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` —
  the `outcomeToCascadePluginMessage` comment for D-70-03 + DOC-03 stale-comment
  scrub.
- `tests/architecture/catalog-uat.test.ts` — the byte-equality gate that must
  stay GREEN.

### Milestone behavior being documented
- `.planning/REQUIREMENTS.md` — the full force-install requirement set
  (RSTATE/FORCE/WILL/FSTAT/LIST/RINST/BFILL/SEV/DOC); cross-check the docs
  against shipped behavior.
- The prior phase CONTEXT.md files (64..69, 65.1) — the locked decisions whose
  outcomes the docs must reflect.

### Requirements & specs
- `.planning/REQUIREMENTS.md` — DOC-01, DOC-02, DOC-03.
- `.planning/ROADMAP.md` — Phase 70 goal + success criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The catalog-UAT byte-equality runner — the green-gate this phase reconciles
  the docs against; the milestone has updated it in lockstep each phase.
- The frozen `FORCE_INSTALL_HINT_TRAILER` constant — just drop its placeholder
  framing (D-70-01).

### Established Patterns
- This milestone updated output-catalog + style-guide in lockstep every phase
  (65.1/66/67/69), so most byte forms are already reconciled — Phase 70 is the
  final sweep (PRD §11 + any residual + dropped-scope removal + stale comments),
  not a from-scratch rewrite.
- Comment/test-title policy: D-70-NN / DOC-NN / SEV-NN / NFR-N IDs, never GSD
  phase/plan references.

### Integration Points
- D-70-02 may touch install.ts severity stamping (verify first); everything else
  is docs/comments. catalog-UAT must end GREEN.

</code_context>

<specifics>
## Specific Ideas

Most of the byte contract was kept current phase-by-phase, so this phase is the
authoritative final reconcile: PRD §11 rewritten to the shipped force design
(dropped scope struck entirely), the `--force` hint frozen, the unavailable-arm
severity finalized to error, and a DOC-03 sweep for stale "autoupdate is
warning" comments. It is the freeze point before milestone audit/complete.

</specifics>

<deferred>
## Deferred Ideas

None — this is the final phase; remaining items are the milestone lifecycle
(audit → complete → cleanup), not new scope.

Known tech-debt to carry forward (NOT this phase): the pre-existing tmpdir
`ENOTEMPTY` teardown flake in autoupdate/update/hooks-exec tests under parallel
runs — passes serialized/in-isolation; a candidate for a post-milestone cleanup.

</deferred>

---

*Phase: 70-spec-documentation-reconcile*
*Context gathered: 2026-06-28*
