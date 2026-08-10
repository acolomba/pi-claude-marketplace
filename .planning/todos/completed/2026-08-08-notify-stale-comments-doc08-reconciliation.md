---
created: 2026-08-08
resolves_phase: 98
source: 95-REVIEW.md WR-02, deferred per 95-CONTEXT.md (no notify.ts comment sweep in Phase 95)
---

# Stale notify.ts / tools.ts comments for DOC-08 reconciliation

Two sites in `shared/notify.ts` (the `PluginInstalledMessage` doc block and the
central `renderPluginRow` `installed` arm, ~2171-2193) still state that the
list orchestrator omits `reasons` on inventory rows and that the inventory row
renders byte-identically to a bare `(installed)`. INV-01 (Phase 95) falsified
both: `list.ts` stamps `reasons` and `LIST_RENDER.installed` forwards them.

Also: `tools.ts` still cites retired `RLD-04 / D-08` anchors on untouched
lines; `docs/output-catalog.md` line ~411 claims on-disk materialization the
list surface never checks (IN-07).

The two catalog states added in Phase 95 (`manifest-absent-inventory`,
`manifest-absent-partially-installed-inventory`, `docs/output-catalog.md`) are
the byte-level authority for what the corrected comments should say.

Carrier: Phase 98 DOC-08 (output catalog / PRD / design doc reconciliation).
