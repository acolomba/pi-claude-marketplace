---
milestone: workflows-replay
audited: 2026-09-09
status: tech_debt
scores:
  requirements: 46/46
  phases: 9/9
  integration: 8/8
  flows: 4/4
gaps: {}
nyquist:
  compliant_phases: [114, 115, 116, 117]
  partial_phases: []
  not_validated_phases: [109, 110, 111, 112, 113]
  missing_phases: []
  overall: partial
tech_debt:
  - phase: 114-degradation-and-documentation
    items:
      - "`docs/messaging-style-guide.md` lines 25-26 claim a 16-variant `PluginNotificationMessage` / 16-literal `PluginStatus`; `PLUGIN_STATUSES` carries 19. Re-measured at audit: still 19."
      - "The same document's union listing (lines 36-54) names the retired `PluginPresentMessage` (0 references in `shared/notify.ts`) and omits `partially-installed` and `partially-upgradable`."
  - phase: 110-domain-and-platform-modules
    items:
      - "2 of 13 code-review findings redirected rather than fixed: WR-07 refiled, WR-09 deferred."
  - phase: 112-install-and-removal-lifecycle
    items:
      - "WR-03 deferred with a carrier (`update` never re-stages workflows) — closed by Phase 113's WLIF-02."
  - phase: 116-load-time-workflow-convergence
    items:
      - "WR-03 skipped: the fix would reverse an operator-locked decision."
  - phase: cross-milestone
    items:
      - "10 open Broken Windows entries, all tagged `[workflows-replay]`: #34, #37, #39, #40, #41, #42, #43, #44, #45, #46."
      - "Phases 109-113 carry no SECURITY.md; the security capability produced one only from Phase 114 onward."
      - "Phases 109-113 sit at VALIDATION.md `status: draft` — never reconciled by validate-phase (#2117 coverage TODO, not a compliance failure)."
---

# Milestone Audit: workflows-replay — Workflow Bridge Replay onto main

**Audited:** 2026-09-09
**Phases:** 109-117 (9 phases, 39 plans)
**Status:** `tech_debt` — no blockers; accumulated debt needs a decision

## Verdict

Every requirement is satisfied, every phase verified `passed`, and cross-phase
integration is clean. What remains is deferred work that was filed rather than
dropped, plus two coverage gaps in the earlier phases (no SECURITY.md, unreconciled
VALIDATION.md) that stem from when each capability became active rather than from
anything the phases got wrong.

## Requirements Coverage

46 of 46 satisfied. Zero unsatisfied. Zero orphaned.

Coverage was cross-referenced across three independent sources: the REQUIREMENTS.md
traceability table, each phase's VERIFICATION.md requirements table, and each
SUMMARY.md's `requirements_completed` frontmatter.

| Requirement group | Count | Phase | Verdict |
|---|---|---|---|
| WINV-01..05 | 5 | 109 | satisfied |
| WNAM-01..06 | 6 | 110 (WNAM-03 closes in 111) | satisfied |
| WPTH-01..05 | 5 | 110/111 (WPTH-02 closes in 111) | satisfied |
| WBRG-01..04 | 4 | 111 | satisfied |
| WLIF-01..06 | 6 | 112/113 | satisfied |
| WFLW-04 | 1 | 113 | satisfied |
| WDEP-01..04 | 4 | 114 | satisfied |
| WDOC-01..03 | 3 | 114 | satisfied |
| WGATE-01..05 | 5 | 115 | satisfied |
| WDOCS-01 | 1 | 115 | satisfied |
| WCONV-01..03 | 3 | 116 | satisfied |
| WEVID-01..02 | 2 | 117 | satisfied |
| WDOCS-02 | 1 | 117 | satisfied |

### Nine requirements resolved by manual check

Nine REQ-IDs appear in no SUMMARY.md `requirements_completed` field, which the
status matrix marks `partial — verify manually`. All nine were checked directly
against their phase's VERIFICATION.md and are **satisfied**; the omission is
bookkeeping, not coverage:

- **WDEP-01..04, WDOC-01..03** (Phase 114) — all seven carry an explicit
  `✓ SATISFIED` row with evidence in `114-VERIFICATION.md`, several re-proved
  mechanically by `tests/architecture/workflows-doc-pins.test.ts` rather than by
  re-reading the doc.
- **WNAM-03, WPTH-02** — split requirements. `110-VERIFICATION.md` records each as
  "Partial, honestly disclosed" with the owed half named; `111-VERIFICATION.md`
  closes both at `✓ SATISFIED` under its split-closure check.

## Phase Verification

| Phase | Score | Status | Overrides |
|---|---|---|---|
| 109 Kind inversion | 12/12 | passed | 0 |
| 110 Domain and platform modules | 20/20 | passed | 1 (evidenced) |
| 111 Workflows bridge | 9/9 | passed | 0 |
| 112 Install and removal lifecycle | 7/7 | passed | 0 |
| 113 Update, enable/disable, reconcile | 9/9 | passed | 2 (operator pre-authorized) |
| 114 Degradation and documentation | 7/7 | passed | 0 |
| 115 Install-time admission-gate warnings | 6/6 | passed | 0 |
| 116 Load-time workflow convergence | 4/4 | passed | 0 |
| 117 Measured `agent()` failure evidence | 5/5 | passed | 0 |

`behavior_unverified: 0` on every phase. No phase carries an open gap or an
outstanding human-verification item.

The three overrides are each recorded with a reason and an acceptor. Phase 110's
loosens an over-strict name gate the module's own doc comment forbade exceeding,
re-verified against engine 3.10.1 with a 31-row differential. Phase 113's two
replace a grep threshold whose two-helper shape no longer exists, and extend a
stamp set from four verbs to six.

## Cross-Phase Integration

**Verdict: `integration_clean`** — 0 critical, 0 warnings, 2 info observations that
resolved to non-issues on trace.

| Seam | Evidence | Status |
|---|---|---|
| 109→111 `componentPaths.workflows` | declared `domain/resolver.ts:369,417`; consumed `bridges/workflows/discover.ts:417` | WIRED |
| 111 bridge triplet exports | `bridges/workflows/index.ts:9-11` | WIRED |
| 111→112 sixth ledger phase | `orchestrators/plugin/install.ts:1195-1217,1385` | WIRED |
| Unwind paths (install rollback, uninstall, reinstall, disable, update) | `install.ts` abort; `uninstall.ts:440-704`; `reinstall.ts:1418`; `update.ts:1436-1452`; `enable-disable.ts:437` | WIRED — no omitted arm |
| 115 warnings channel | `discover.ts` → `install.ts:989,1032,1242` → `:1689` → `:2567`; reused by `reinstall.ts:613`, `update.ts:503` | WIRED, non-fatal |
| 116 one-time bound vs lifecycle | `reconcile/backfill.ts:76` version stamp; `backfill.test.ts` run live, 64/64 | WIRED |
| Closed-set coherence | `notify-closed-set-locks`, `catalog-uat`, `compat-01-no-expansion` run live, all pass | WIRED — gates fire |
| WFLW-04 info surface | `orchestrators/plugin/info.ts:717,1298` | WIRED |

Three architecture-gate test files and the full backfill suite were executed rather
than inspected, so the gates are proved to fire rather than merely to exist.

### E2E Flows

| Flow | Verdict |
|---|---|
| Install workflow-bearing plugin → 6 ledger phases → envelopes outside every scope root → record carries names | COMPLETE |
| Reload with engine absent → install still succeeds, degradation reason carried | COMPLETE |
| Pre-inversion record + reload → converges once, row says so, second reload is a no-op | COMPLETE |
| Uninstall / disable / reinstall / update → envelopes removed or re-staged, no orphans | COMPLETE |

## Tech Debt

### Deferred items still open: 1

Phase 114 logged `docs/messaging-style-guide.md`'s variant enumeration as stale and
out of its plan's scope. **Re-measured at audit — still open, and the drift has
grown:** lines 25-26 claim 16 variants and 16 literals; `PLUGIN_STATUSES`
(`shared/notify.ts:559`) carries 19. The union listing still names
`PluginPresentMessage`, which has 0 references in `notify.ts`, and still omits
`partially-installed` and `partially-upgradable`.

Fixing it means re-deriving the whole 19-row listing, not editing a count — the same
document's line 33 already forbids re-enumerating a count in prose.

The other five items the open-artifact scan surfaced are Phase 115's, and all five
are recorded `closed`: the `HANDOFF.json` formatting failure and the
discovery-warning header contradiction were both fixed during that phase's
code-review pass and re-measured at its goal-verification gate.

### Unresolved code-review findings: 4 of 60

All four are filed with a carrier rather than dropped.

| Phase | Finding | Disposition |
|---|---|---|
| 110 | WR-07 | refiled |
| 110 | WR-09 | deferred |
| 112 | WR-03 (`update` never re-stages workflows) | deferred — closed by Phase 113's WLIF-02 |
| 116 | WR-03 | skipped — the fix reverses an operator-locked decision |

Every other phase closed at `all_fixed`. Phase 117 fixed all 14 of its findings,
including 2 criticals.

### Broken Windows: 10 open

All ten are tagged `[workflows-replay]` and were recorded during phases 114-117.

| # | Phase | Kind | Subject |
|---|---|---|---|
| 34 | 114 | unmet-truth | 15 line-range citations into an unvendored engine; no gate can detect an upgrade moved them |
| 37 | 115 | unmet-truth | `PathContainmentError` interpolates the untrusted resolved path raw into its message |
| 39 | 115 | unrun-verify | a `covered_files` list naming a file a later pass rewrites makes its phase permanently un-completable |
| 40 | 116 | deviation | catalog state id `backfill-partially-installed-no-reasons` now under-describes its row |
| 41 | 116 | deviation | ENBL-08 case does not gate the filter it names |
| 42 | 116 | unmet-truth | same ENBL-08 case stays green when its named filter is deleted |
| 43 | 116 | unmet-truth | two ungated line-number citations drifted; caught only by the security audit |
| 44 | 116 | todo | `scanForceInstalledBackfills` / `hasForceInstalledPlugin` still assert a deleted filter |
| 45 | 117 | unrun-verify | the W1/W2/W3 storage assertions were never driven against a live engine |
| 46 | 117 | unmet-truth | the canaries' `PI_CODING_AGENT_DIR` guard is a substring test, not containment |

### Capability coverage gaps in phases 109-113

| Phase | SECURITY.md | VALIDATION.md |
|---|---|---|
| 109-113 | absent | `status: draft` — never reconciled |
| 114-117 | `verified`, `threats_open: 0` | `validated`, `nyquist_compliant: true` |

Both gaps track when each capability became active in this workstream, not a phase
that skipped its gate. Per #2117, a `draft` VALIDATION.md is a coverage TODO —
`nyquist_compliant` is not authoritative there — rather than a compliance failure.
Closing them retroactively is `/gsd-secure-phase N` and `/gsd-validate-phase N` per
phase; neither blocks the milestone.

## Note for the completion step

`ROADMAP.md` carries these 9 phases under **two** milestone headings — `### In
progress workflows-replay` (Phases 109-114) and `### Planned workflow-hardening`
(Phases 115-117) — while `gsd-tools` resolves all 9 as one milestone,
`workflows-replay` (`phase_count: 9`). All 9 are checked `[x]` and the Progress
table marks all 9 Complete.

This decides what `complete-milestone` archives and whether `workflow-hardening`
survives as an open milestone. It needs an operator decision before the archive
runs, not a silent choice by the tooling.
