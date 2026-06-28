---
milestone: force-install
audited: 2026-06-28T12:50:00-04:00
status: tech_debt
scores:
  requirements: 30/30
  phases: 8/8
  integration: 26/26
  flows: 3/3
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: cross-milestone (pre-existing, NOT force-install)
    items:
      - "Parallel-run-only test flakes: ENOTEMPTY tmpdir teardown race (autoupdate/update/hooks-exec) and hooks-async-rewake D-62-05 PID-count race (2 != 1). Both predate this milestone (Phase 62 / v0.6.0 hooks bridge), pass serialized/in-isolation. Confirmed: full hooks-async-rewake.test.ts = 37 pass / 0 fail in isolation."
  - phase: 66-derived-force-state-glyphs
    items:
      - "WR-02 (RESOLVED -- audit note corrected post-audit): the list/info force-installed divergence for non-path (github/npm/url) sources was FIXED in commit 82cb9d8c (`fix(66): WR-02 align non-path info force-installed with list`; marked resolved in 913869af). info.ts now derives force-installed from the persisted compatibility record for non-path sources, so list and info agree. The original audit text mischaracterized this as deferred; not a gap."
      - "WR-03 (RESOLVED): force-install success rows gained soft-dep markers via commit cc8818e5. IN-01 / IN-02: deferred per phase brief, not phase-goal blockers."
  - phase: 69-force-path-severity
    items:
      - "WR-01 (intentional, documented): SEV-01 soft-dep companion warning scoped to install + manual update success only; deliberately NOT wired into the marketplace autoupdate cascade. Settled in Phase 70 D-70-03, recorded in PRD L403 with auditable comment at marketplace/update.ts:648-671. Intentional and shipped, not a gap."
  - phase: nyquist-coverage (all phases)
    items:
      - "All 7 VALIDATION.md files (64, 65, 65.1, 66, 67, 68, 69) are status: draft / nyquist_compliant: false; Phase 70 has no VALIDATION.md. Nyquist validate-phase was scaffolded but not completed for any phase. Discovery-only -- run /gsd-validate-phase per phase if Nyquist sign-off is required before archive."
  - phase: doc-hygiene (non-blocking)
    items:
      - "SUMMARY frontmatter omission: 65.1-01/02 and 70-03 carry empty requirements_completed; WILL-01..04 and DOC-03 are nonetheless VERIFIED/SATISFIED in their phase VERIFICATION requirement tables and [x] in the traceability table."
      - "Stale VERIFICATION docs (intermediate-state, code is correct): 67-VERIFICATION says completion-cache schemaVersion 2 / 7-status union; code is v3 / 8-status (force-installed-upgradable WR-02 fix applied post-verification). 65.1-VERIFICATION says closed-set 20/15; code is 22/17 (Phase 66 added force-installed/force-upgradable). Both are documentation lag, not code defects; closed-set tripwire asserts final 22/17/7."
---

# Milestone Audit: force-install (Phases 64-70 + inserted 65.1)

**Audited:** 2026-06-28
**Status:** tech_debt -- all requirements satisfied, all cross-phase seams wired, no critical blockers; accumulated non-blocking deferred items warrant review before archive.

## Milestone Goal

Let a Pi user `install` / `update --force` a *partially*-supported Claude plugin -- install the supported components, degrade the unsupported ones, never block -- built on a **derived** force-state (no persisted flag, no migration) and the **desired-state** severity model, with consistent status, list, completion, and load-time-backfill behaviour. Clean-room rebuild superseding the earlier sticky-flag attempt.

## Verdict

| Dimension | Result |
|-----------|--------|
| Requirements satisfied | 30 / 30 |
| Phases verified (VERIFICATION.md = passed) | 8 / 8 |
| Cross-phase seams wired | 26 / 26 (0 orphaned, 0 missing) |
| E2E flows complete | 3 / 3 (0 broken) |
| `npm run check` | typecheck/lint/prettier clean; integration 16/16; unit pass except 1 pre-existing parallel-run flake (passes in isolation) |
| Critical blockers | 0 |

## Requirements Coverage (3-source cross-reference)

All 30 REQ-IDs cross-referenced across VERIFICATION.md status, SUMMARY.md `requirements_completed` frontmatter, and the REQUIREMENTS.md traceability table.

| Family | REQ-IDs | Phase | VERIFICATION | SUMMARY frontmatter | Traceability | Final |
|--------|---------|-------|--------------|---------------------|--------------|-------|
| RSTATE | 01-05 | 64 | passed | listed | [x] | satisfied |
| FORCE | 01-05 | 65 | passed | listed | [x] | satisfied |
| WILL | 01-04 | 65.1 | passed | **empty** | [x] | satisfied (verified manually -- WILL-01..04 SATISFIED in 65.1-VERIFICATION requirement table) |
| FSTAT | 01-07 | 66 | passed | listed | [x] | satisfied |
| LIST/RINST | LIST-01,02 / RINST-01 | 67 | passed | listed | [x] | satisfied |
| BFILL | 01-02 | 68 | passed | listed | [x] | satisfied |
| SEV | 01-05 | 69 | passed | listed | [x] | satisfied |
| DOC | 01-03 | 70 | passed | DOC-01,02 listed; **DOC-03 empty** | [x] | satisfied (DOC-03 SATISFIED in 70-VERIFICATION requirement table) |

**Orphan detection:** None. Every REQ-ID in the traceability table appears in its phase VERIFICATION requirement table.

**Frontmatter note:** WILL-01..04 (65.1-01/02 summaries) and DOC-03 (70-03 summary) have empty `requirements_completed` frontmatter. Per the status-determination matrix this is "passed + missing frontmatter -> partial (verify manually)." Manual verification of both phase VERIFICATION.md requirement tables confirms all five are VERIFIED/SATISFIED with codebase evidence, so they resolve to **satisfied**. The omission is a frontmatter-hygiene issue, not a coverage gap.

## Cross-Phase Integration

Integration checker (gsd-integration-checker) verified the seam chain 64 -> 65 -> 65.1 -> 66 -> 67 -> 68 -> 69 -> 70:

- **64->65**: `requireForceInstallable` / `MaterializablePlugin` exported, consumed in install + update orchestrators. WIRED.
- **64->66**: three-way resolver state -> `classifyInstalledRecord` -> list force derivation. WIRED.
- **64->69**: `forceable: r.state === "unsupported"` -> errors.ts -> `composeUnavailableMessage` forceHint. WIRED.
- **65->68**: force-capable reinstall via `requireForceInstallable` -> backfill chain. WIRED.
- **65.1/66/67/69->70**: closed-set 22/17/7 in notify.ts, tripwire asserts final values; docs reconciled. WIRED.
- **66->67**: `plugin-state-classifier.ts` single source of truth imported by list + edge-deps. WIRED.
- **66->69**: `narrowUnsupportedKinds` shared seam for {reasons} braces across list/install/update/backfill. WIRED.
- **68->69**: `PluginBackfilledOutcome.unsupported` set by apply.ts -> consumed by reconcile/notify via `narrowUnsupportedKinds` (SEV-05). WIRED.

**E2E flows traced complete:**
1. `install --force <plugin>@<marketplace>` -> force-installed state with glyph + reasons brace.
2. `/reload` backfill promotion (force-installed -> installed) gated on `lastReconciledExtensionVersion`.
3. `update --force` / autoupdate force cascade with SEV-01/03/04 severity stamping.

0 orphaned exports, 0 missing connections, 0 broken flows.

## Nyquist Compliance

| Phase | VALIDATION.md | nyquist_compliant | Status |
|-------|---------------|-------------------|--------|
| 64 | exists | false (draft) | PARTIAL |
| 65 | exists | false (draft) | PARTIAL |
| 65.1 | exists | false (draft) | PARTIAL |
| 66 | exists | false (draft) | PARTIAL |
| 67 | exists | false (draft) | PARTIAL |
| 68 | exists | false (draft) | PARTIAL |
| 69 | exists | false (draft) | PARTIAL |
| 70 | missing | -- | MISSING |

**Overall:** 0 compliant / 7 partial / 1 missing. The validate-phase step was scaffolded but never carried to `nyquist_compliant: true` for any phase. Discovery-only -- this does not force `gaps_found`. If Nyquist sign-off is required before archive, run `/gsd-validate-phase {64,65,65.1,66,67,68,69,70}`.

## Tech Debt Summary

| Source | Item | Severity | Disposition |
|--------|------|----------|-------------|
| Cross-milestone (pre-existing) | Parallel-run-only test flakes: ENOTEMPTY tmpdir teardown + hooks-async-rewake D-62-05 PID race | Non-blocking | Predate force-install (Phase 62 / v0.6.0); pass in isolation. Not milestone-attributable. |
| Phase 66 | WR-02 force-installed list/info divergence (non-path sources) | RESOLVED | Fixed in 82cb9d8c (info reads persisted force-state for non-path sources; list/info agree). Audit text corrected post-audit. |
| Phase 69 | WR-01 SEV-01 companion warning absent from autoupdate cascade | By design | Intentional, documented (D-70-03, PRD L403, auditable comment). Not a gap. |
| All phases | Nyquist VALIDATION.md coverage | RESOLVED | Validation sweep completed post-audit: all 8 phases (64-70) nyquist_compliant=true; 0 tests needed (coverage pre-existed). |
| Doc hygiene | Stale VERIFICATION docs (67 cache schema, 65.1 closed-set counts) | RESOLVED | Forward-reference notes added to 65.1/67 VERIFICATION clarifying the point-in-time snapshots vs final 22/17/7. |
| Cross-milestone (pre-existing) | Parallel-run test flakes (ENOTEMPTY tmpdir + hooks PID race) | Tracked | Predate force-install (Phase 62/v0.6.0); being fixed before close at the user's request. |

## Conclusion

The force-install milestone delivered its definition of done: all 30 requirements are satisfied with codebase evidence, every cross-phase seam is wired, and all three primary E2E flows complete end-to-end. There are **no critical blockers** and **no unsatisfied requirements**, so the FAIL gate is not triggered. Status is **tech_debt** (not `passed`) because of accumulated non-blocking deferred items worth a review before archive -- principally the incomplete Nyquist validation across all phases and the Phase 66 WR-02 source-divergence deferral. None of these block completion.

> **Post-audit update (2026-06-28):** The two actionable debt items have been
> resolved before archive at the user's direction: (1) the Nyquist validation
> sweep ran across all 8 phases -- every phase is now `nyquist_compliant=true`
> (0 tests needed; coverage pre-existed); (2) the doc-hygiene staleness in the
> 65.1/67 VERIFICATION docs is annotated, and the Phase 66 WR-02 note above is
> corrected (it was fixed in 82cb9d8c, not deferred). The pre-existing
> parallel-run test flakes (Phase 62/v0.6.0, not force-install) are being fixed
> in a dedicated pass before the milestone closes.
