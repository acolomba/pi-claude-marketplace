---
milestone: force-install
audited: 2026-06-30
status: passed
scores:
  requirements: 42/42
  phases: 12/12
  integration: clean
  flows: 4/4
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 74-bulk-update-grammar-refinement
    items:
      - "WR-03 (deferred): dispatchRow writes a readonly severity field inside an empty catch {} (silent-failure seam). Pre-existing — not introduced by this milestone; Phase 74 only widened the set of emitters reaching it."
      - "IN-01 (deferred): composeTally trusts tally.count without a non-negative guard (count is >= 0 by construction today; harden with a clamp or invariant comment)."
      - "IN-02 (deferred): notifyUpdateNoOpWithContext duplicates the envelope-build + widening-cast boilerplate from notifyWithContext (extract a shared buildCascadeEnvelope helper)."
---

# Milestone Audit: force-install

**Audited:** 2026-06-30
**Status:** PASSED
**Scope:** Phases 64–74 (12 phases)

## Definition of Done

A derived three-way resolver state (`installed` / `unsupported` / `unavailable`)
drives a consistent force-install / force-upgrade UX across every user-facing
surface. `--force` degrades unsupported components while hard failures still
block; force-state is derived (no persisted flag, no migration); severity is
desired-state vs end-state.

## Requirements Coverage — 42/42 satisfied

3-source cross-reference (phase VERIFICATION.md status + SUMMARY
`requirements-completed` frontmatter + REQUIREMENTS.md traceability) agrees for
every REQ-ID. No unsatisfied, partial, or orphaned requirements.

| Group | IDs | Phase | Status |
|-------|-----|-------|--------|
| RSTATE | 01–05 | 64 | satisfied |
| FORCE | 01–05 | 65 | satisfied |
| FSTAT | 01–07 | 66 | satisfied |
| LIST | 01–02 | 67 | satisfied |
| RINST | 01 | 67 | satisfied |
| BFILL | 01–02 | 68 | satisfied |
| SEV | 01–05 | 69 | satisfied |
| DOC | 01–02 | 70 | satisfied |
| PHOOK | 01–05 | 71 | satisfied |
| USTAT | 01–02 | 72 | satisfied |
| XSURF | 01–03 | 73 | satisfied |
| UGRM | 01–02 | 74 | satisfied |

## Phase Verification — 12/12 passed

Every phase (64, 65, 65.1, 66, 67, 68, 69, 70, 71, 72, 73, 74) has a
VERIFICATION.md with `status: passed`. No unverified phases.

## Cross-Phase Integration — clean

A dedicated `gsd-integration-checker` pass found **0 orphaned exports, 0 missing
connections, 0 broken flows**. All 4 cross-surface E2E flows are wired:

1. **List** `⊖ (unsupported)` vs `⊘ (unavailable)` — derived from resolver state (RSTATE + USTAT-01).
2. **Info** non-resolvable arm derives status/reason from `resolved.state` (XSURF-02).
3. **Install-failure** renders `⊖ (unsupported)` + `--force` hint, `forceable` sourced from `err.shape` at the throw site (XSURF-01).
4. **Update-decline** renders `force-upgradable` + `--force` hint, `unsupportedKinds` sourced from `err.shape` (XSURF-03).

The shared `narrowUnsupportedKinds` helper (`shared/probe-classifiers.ts`) is the
single cross-surface byte-parity anchor, imported by all four surfaces. SEV-01..05
severities are orthogonal to and preserved through the Phase 73/74 token/reason
changes. UGRM-01 bulk no-op suppression is partition-discriminated (`unchanged`
only), so the info-severity `force-upgradable` (`skipped` partition) decline row
still survives in bulk cascades.

## Quality Gate

`npm run check` (typecheck + ESLint + Prettier + tests) green at HEAD:
2506 unit + 16 integration, 0 failures. Closed sets unchanged
(REASONS, STATUS_TOKENS, PLUGIN_STATUSES).

## Tech Debt (deferred, non-blocking)

Three Phase-74 code-review items were intentionally deferred (operator decision,
surgical-changes guideline):

- **WR-03** — pre-existing `dispatchRow` readonly-mutation + empty `catch {}` seam (not introduced by this milestone).
- **IN-01** — `composeTally` non-negative guard (info-level hardening).
- **IN-02** — `notify*WithContext` envelope-build duplication (info-level maintainability).

None block the milestone definition of done. The real Phase-74 bug (WR-01,
contradictory `nothing to update` headline after a phase-3a abort) was fixed with
a regression test.

## Verdict

All 42 requirements satisfied, all 12 phases verified, cross-phase integration
clean, all E2E flows complete. **Milestone force-install is ready to complete.**
