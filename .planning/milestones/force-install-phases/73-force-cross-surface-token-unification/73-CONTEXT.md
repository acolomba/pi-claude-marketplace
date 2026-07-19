# Phase 73: Force Cross-Surface Token Unification - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning
**Source:** force-install milestone UAT (2026-06-29) — code-review finding IN-01 + UAT observations

<domain>
## Phase Boundary

Phase 72 de-collapsed the `list` and `info` surfaces so a not-installed force-installable plugin renders `⊖ (unsupported)` (distinct from `⊘ (unavailable)`). The force-install milestone UAT surfaced that **other** user-facing surfaces still describe the same plugin with the old `⊘ (unavailable)` framing, creating cross-surface inconsistency. This phase extends the resolver-state-driven render to those surfaces.

In scope (three findings):
1. **Install-failure surface (XSURF-01):** installing an `unsupported` plugin without `--force` errors; the row token should be `⊖ (unsupported)` consistent with list/info, not `⊘ (unavailable)`. The `--force` hint (SEV-02) already fires and must stay.
2. **info.ts non-resolvable arm (XSURF-02 / IN-01):** the non-locally-resolvable branch hardcodes `status: "unavailable"` regardless of `resolved.state`, unlike the list surface which keys on `resolved.state`. Make it derive from `resolved.state`. Masked today (GitHub sources never resolve `unsupported` without network) — latent divergence.
3. **Update-decline reason (XSURF-03):** a manual `update` of a force-upgradable plugin without `--force` renders `(skipped) {no longer installable}` — which reads as "cannot install at all," contradicting list's `(force-upgradable)`, and offers no `--force` affordance. Replace the reason with a force-aware one and point at `--force`.

Out of scope:
- **Severity is NOT changed.** SEV-02 (install error +/- hint) and SEV-04 (update decline: targeted=warning, bulk=info) are correct and verified — this phase only moves the token + reason *wording*, never the severity.
- The resolver, the `list`/`info` not-installed rows (Phase 72, already correct), and the filter logic are untouched.

</domain>

<decisions>
## Implementation Decisions

### Resolver-state-driven token everywhere (LOCKED — extends Phase 72 / D-64-01)
- The render token follows `resolved.state`: an `unsupported` plugin → `⊖ (unsupported)`; a structurally-`unavailable` plugin → `⊘ (unavailable)`. This is already true on `list`/`info` not-installed rows; this phase brings the install-failure and update-decline surfaces (and the info.ts non-resolvable arm) into line.
- `⊘` / `ICON_UNINSTALLABLE` stays reserved for genuine `unavailable` / blocked / failed rows.

### XSURF-01 — install-failure surface
- When `install` (no `--force`) fails on an `unsupported` plugin, the cascade row renders `⊖ (unsupported)` (not `⊘ (unavailable)`), and KEEPS the SEV-02 `--force` hint trailer. A genuinely `unavailable` install failure keeps `⊘ (unavailable)` with no hint (test 4 — unchanged).

### XSURF-02 — info.ts non-resolvable arm (IN-01)
- The non-locally-resolvable branch in `info.ts` derives its status from `resolved.state` (mirroring the list-surface split) instead of the hardcoded `"unavailable"`. Same de-collapse rule as Phase 72.

### XSURF-03 — update-decline framing (LOCKED by maintainer)
- A force-upgradable `update` decline (no `--force`) must NOT render `(skipped) {no longer installable}` (misleading — the plugin IS installable with `--force`).
- **Decision: reuse the `force-upgradable` framing** rather than minting a new `(skipped)` reason. The declined update renders consistently with how `list` already describes the same plugin (`(force-upgradable)` concept), and guides the user to `--force`. This is the larger, most cross-surface-consistent option (maintainer chose it over a minimal `{needs --force}` / `{would degrade}` reason-brace swap).
- Planning must determine the exact render: a force-upgradable-decline row (token + glyph reused from the `force-upgradable` inventory render where it fits) plus the `--force` guidance, reconciled byte-exact in the catalog. The `force-upgradable` token/`ICON_INSTALLED` precedent and the existing decline cascade shape are the anchors.
- Severity stays per SEV-04 (targeted=warning, bulk=info) — do NOT touch `decideUpdateSkipSeverity` cardinality logic. Only the token/reason framing changes, not the severity.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Surfaces to change
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` + `install.messaging.ts` — the install-failure cascade row for an `unsupported` plugin (XSURF-01). Find where the no-force `unsupported` install failure composes its row/token.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — the non-locally-resolvable arm (~line 1045-1056 per the Phase 72 code review IN-01) that hardcodes `"unavailable"` (XSURF-02).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — the force-upgradable decline path (~lines 495-548, 752-773, 1569-1596, 1664-1694) that emits `(skipped) {no longer installable}` and `decideUpdateSkipSeverity` (XSURF-03). Change the REASON, keep the cardinality severity.

### Read-only precedent / contract
- `extensions/pi-claude-marketplace/shared/notify.ts` — `ICON_UNSUPPORTED = "⊖"`, the status union, the `renderPluginRow` switch, and `REASONS` closed set + its architecture tripwire (`tests/architecture/notify-closed-set-locks.test.ts`).
- `extensions/pi-claude-marketplace/domain/resolver.ts` — three-way `ResolvedPlugin` state (read-only).
- Phase 72 artifacts: `.planning/phases/72-unsupported-render-token/72-RESEARCH.md` (the cross-surface Open Question 1 that scoped this phase) and `72-VERIFICATION.md` (IN-01).

### Byte-form contract
- `docs/output-catalog.md` + `docs/messaging-style-guide.md` — install-failure and update-skip catalog states must be reconciled to the new tokens/reason.

</canonical_refs>

<specifics>
## Specific Ideas

UAT-observed before-states this phase fixes:
- install (no --force) of an `unsupported` plugin → currently `⊘ … (unavailable)` + --force hint → target `⊖ … (unsupported)` + --force hint.
- `update demo-tool@demo-local` (no --force) on a force-upgradable plugin → currently `⊘ demo-tool v1.0.0 (skipped) {no longer installable}` (warning, targeted) with no --force affordance → target: force-aware reason + --force guidance, same warning severity.

</specifics>

<deferred>
## Deferred Ideas

- Bulk-update grammar (up-to-date no-op suppression, success-count semantics) is Phase 74 (UGRM-01..02), not this phase.

</deferred>

---

*Phase: 73-force-cross-surface-token-unification*
*Context captured: 2026-06-29 via force-install milestone UAT findings*
