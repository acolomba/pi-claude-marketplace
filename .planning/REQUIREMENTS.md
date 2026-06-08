# Requirements: pi-claude-marketplace

**Defined:** 2026-06-08
**Milestone:** v1.11 Notification Summary-Line Grammar
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Source:** Operator bug report -- `/claude:plugin install x@y` against a missing marketplace renders `Error: ⊘ y [user] (failed) {not added}`: the host `Error:` label is glued directly onto the cascade row with no summary message. Root cause in `shared/notify.ts`: `dispatchInfoMessage` emits error/warning-severity standalone kinds body-only (it never calls `buildSummaryLine`, which returns `""` for these kinds), while the cascade path prepends `{summary}\n\n`. `docs/output-catalog.md` encoded the violation ("NO summary line. Severity error") across ~6 sections, so the `catalog-uat` byte-equality test verified the broken output GREEN.

## v1 Requirements

Requirements for milestone v1.11. Each maps to exactly one roadmap phase.

### Notification Grammar (GRAM)

Every error/warning-severity notification carries a summary message on the host label line, with the cascade always rendered as its own separate block.

- [x] **GRAM-01**: Every error/warning-severity notification renders a non-empty summary message on the host `Error:`/`Warning:` label line, with the cascade/detail rendered as its own separate block below -- no notification emits the label glued directly onto a detail row (fixes the reported `Error: ⊘ y [user] (failed) {not added}`).
- [x] **GRAM-02**: The summary subject follows the nature of the failure (the failed-row subject), not the invoking command: a marketplace-subject failure reads `N marketplace operation(s) failed`, a plugin-subject failure reads `N plugin operation(s) failed` -- the same subject-attribution principle as the v1.10 ATTR-08 split (`{not added}` on the marketplace vs `{not in manifest}` on the plugin).
- [x] **GRAM-03**: Every `marketplace-not-added` emission (install, uninstall, reinstall, update, marketplace update, marketplace remove, autoupdate/noautoupdate) and every failed `plugin-info` surface (e.g. `plugin info` on an unreadable manifest) renders the corrected summary line followed by its detail block.
- [x] **GRAM-04**: Standalone and cascade notifications emit their summary through a single shared code path; no standalone-kind path bypasses `buildSummaryLine`, so the summary/no-summary divergence that caused the v1.10 defect cannot recur.
- [x] **GRAM-05**: A cross-cutting grammar-invariant test asserts that every error/warning notification's emitted message has a non-empty summary first line distinct from the cascade block, across all catalog fixtures; `docs/output-catalog.md` and the `catalog-uat` fixtures are corrected to the new byte forms in lockstep.

## Future Requirements

(None -- this is a focused, single-category correctness milestone.)

## Out of Scope

Explicitly excluded for v1.11. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| New commands or flags | v1.11 corrects existing output only; no new surface area |
| Changing severity routing (`computeSeverity`) | The error/warning classification is correct; only the missing summary-line emission is the defect |
| Info-severity output | Read-only info surfaces (`marketplace info`, `plugin info` success, `list`) correctly carry no label and no summary -- unchanged |
| New REASONS / status tokens / row bytes | The `{not added}` reason and the `⊘ <mp> [scope] (failed) {not added}` row are correct; only the absent summary line is added above them |
| Telemetry / i18n / message catalogs | IL-1 / IL-4 -- deferred beyond V1 |

## Traceability

Which phases cover which requirements. Finalized during roadmap creation (2026-06-08): all 5 requirements map to Phase 50.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GRAM-01 | Phase 50 | Complete |
| GRAM-02 | Phase 50 | Complete |
| GRAM-03 | Phase 50 | Complete |
| GRAM-04 | Phase 50 | Complete |
| GRAM-05 | Phase 50 | Complete |

**Coverage:**

- v1 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-08*
*Last updated: 2026-06-08 after v1.11 roadmap creation (Phase 50; GRAM-01..05 mapped)*
