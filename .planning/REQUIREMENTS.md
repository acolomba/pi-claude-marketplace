# Requirements: pi-claude-marketplace

**Defined:** 2026-06-07
**Milestone:** v1.10 Error Attribution & Message-Type Consistency
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Source:** `.planning/research/v1.10-attribution-audit.md` (23-finding three-part audit) plus two BACKLOG items. **Scoping decision:** the canonical reason for "marketplace not present in scope" is the existing `not added` REASONS member (no new member added).

## v1 Requirements

Requirements for milestone v1.10. Each maps to exactly one roadmap phase.

### Attribution Correctness (ATTR)

Themes 1-3: every operation reports the true blocker on the correct subject with a canonical, truthful, closed-set reason.

- [ ] **ATTR-01**: `install <plugin>@<marketplace>` with a missing marketplace reports `{not added}` on the marketplace subject, not `{not in manifest}` on the plugin row (backlog #1)
- [ ] **ATTR-02**: `update` (single-plugin `<plugin>@<mp>` and `@<mp>` forms) reports a missing marketplace as a structured `(failed) {not added}` on the marketplace subject -- no `{not found}` misattribution, no raw throw past the orchestrator
- [ ] **ATTR-03**: `reinstall` reports a missing marketplace as `{not added}` consistently across explicit-scope and bare forms (not `{not installed}` or `{not found}` depending on form)
- [ ] **ATTR-04**: `uninstall` of a marketplace that was never added reports it explicitly (`{not added}`), distinct from the silent converge used when a plugin record is merely already gone
- [ ] **ATTR-05**: `marketplace autoupdate`/`noautoupdate` of a missing marketplace reports `{not added}` consistently whether the scope is explicit or the name is missing in every scope (no reason-less failed row, no `{not found}`)
- [ ] **ATTR-06**: `marketplace remove` of a missing marketplace renders a structured `(failed) {not added}` row instead of throwing `MarketplaceNotFoundError` raw past the orchestrator boundary
- [ ] **ATTR-07**: `marketplace add` surfaces its precondition failures (duplicate name, stale clone, unsupported source, missing path source, invalid manifest) as structured `(failed)` rows with closed-set reasons, instead of raw throws
- [ ] **ATTR-08**: `install` distinguishes "marketplace absent" (`{not added}`) from "plugin absent from a present manifest" (`{not in manifest}`) -- the two conditions emit different reasons
- [ ] **ATTR-09**: cleanup/cascade failures (foreign content, IO) during `uninstall`/`reinstall`/`marketplace remove` surface a truthful reason instead of degrading to `{not in manifest}`
- [ ] **ATTR-10**: a path-source manifest failure during `marketplace update` reports a manifest-specific reason, never `{network unreachable}` (honors NFR-5: path-source operations touch no network)

### Cross-Scope Reporting (SCOPE)

Theme 4: stop treating "wrong scope" as "does not exist."

- [ ] **SCOPE-01**: when a target marketplace/plugin is absent in the requested explicit scope but present in the other scope, the failure reports that it exists in the other scope (install/uninstall/reinstall/update) instead of misattributing as not-in-manifest/not-installed

### Message-Type Model (TYPE)

Theme 5: make the message shapes that allowed the attribution drift unrepresentable.

- [x] **TYPE-01**: the marketplace-not-added row is a dedicated `NotificationMessage` variant carrying only the fields it renders -- no placeholder `marketplaceScope`/`marketplaceDetails`, no runtime-only renderer carve-out (backlog #2)
- [x] **TYPE-02**: structural reasons (`not added`) cannot be type-combined with content reasons -- illegal reason mixes (e.g. `["not added", "permission denied"]`) are unrepresentable, not merely guarded at render time
- [x] **TYPE-03**: the info-`kind` set is enumerated in exactly one place; adding a new `NotificationMessage` kind is a compile error in every consumer (`computeSeverity`, `buildSummaryLine`, `shouldEmitReloadHint`, dispatch) via a single `isInfoKind` guard + `assertNever`
- [x] **TYPE-04**: `MarketplaceNotificationMessage` co-occurrence is type-constrained (reasons only on the skipped arm, details only on the list surface) via a discriminated union

## Future Requirements

Type-model cleanups surfaced by the audit, deferred from v1.10 (lower-severity foot-guns; no current user-visible defect).

### Message-Type Model (TYPE)

- **TYPE-F1**: replace empty-array `reasons: []` render-time sentinels with optional `reasons?` (B-4)
- **TYPE-F2**: thread the full `Reason[]` through outcome mappers instead of `reasons[0]`-only narrowing in `update`/`reinstall` (B-5)
- **TYPE-F3**: build the final `MarketplaceBlock` status/reasons via a single reducer rather than mutating optionals across import passes (B-6)
- **TYPE-F4**: narrow the cascade producers' entry point so info-kind guards do not leak into cascade-only paths (B-8 union over-breadth)

## Out of Scope

Explicitly excluded for v1.10. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| New `marketplace not added` REASONS member | Scoping decision: reuse the existing `not added`; no new closed-set member (less catalog churn, info is the model) |
| Telemetry / metrics / event sink | IL-4 -- no telemetry in V1 |
| Message catalogs / i18n / locale negotiation | IL-1 -- English only in V1 |
| State migration of already-installed records | No on-disk state shape changes; this milestone is output/attribution + type-model only |
| New user-facing commands or flags | v1.10 corrects existing operations; no new surface area |

## Traceability

Which phases cover which requirements. Each requirement maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ATTR-01 | Phase 47 | Pending |
| ATTR-02 | Phase 47 | Pending |
| ATTR-03 | Phase 47 | Pending |
| ATTR-04 | Phase 47 | Pending |
| ATTR-05 | Phase 48 | Pending |
| ATTR-06 | Phase 48 | Pending |
| ATTR-07 | Phase 48 | Pending |
| ATTR-08 | Phase 47 | Pending |
| ATTR-09 | Phase 47 | Pending |
| ATTR-10 | Phase 48 | Pending |
| SCOPE-01 | Phase 47 | Pending |
| TYPE-01 | Phase 46 | Complete |
| TYPE-02 | Phase 46 | Complete |
| TYPE-03 | Phase 46 | Complete |
| TYPE-04 | Phase 46 | Complete |

Phase 49 (Cross-Op Convergence & GREEN-Gate Close) is a verification + closure phase with no new requirement closure; it proves the Phase 46-48 fixes converge across the full operation matrix (audit Class C) and gates the milestone GREEN.

**Coverage:**

- v1 requirements: 15 total
- Mapped to phases: 15 (Phase 46: TYPE-01..04; Phase 47: ATTR-01/02/03/04/08/09 + SCOPE-01; Phase 48: ATTR-05/06/07/10)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-07*
*Last updated: 2026-06-07 after v1.10 roadmap creation (phases 46-49 mapped)*
