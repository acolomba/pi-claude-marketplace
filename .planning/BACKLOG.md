# Backlog

Ideas surfaced during planning that are deferred from active scope but worth retaining for future milestones.

## Manifest cache (NFR-8)

**Tracked in:** REQUIREMENTS.md NFR-8 (v1 pending) + PRD §11 backlog.
Phase 7 lands the seam (single chokepoint where `marketplace.json` is read) so a future caching layer can wrap it without orchestrator changes.

## v1.4 UAT findings (output-grammar / severity UX)

**Surfaced by:** the 2026-05-30 full hands-on UAT sweep (see `.planning/v1.4-MILESTONE-UAT.md`).
**Status:** PR #22 shipped the verified v2 contract as-is; these are product/UX change-requests for a follow-up milestone, not byte-contract bugs. Acting on them means updating `docs/output-catalog.md` + the renderer (`shared/notify.ts`) and re-running the catalog UAT gate.

1. **Drop `<last-updated <iso>>` from `marketplace list`.** The raw ISO timestamp is noise and is meaningless for path-source marketplaces. Remove the marker (or gate it tightly). Touches the marketplace-header shape + catalog.
2. **Benign skips should not be `warning` severity.** `{up-to-date}` / `{already …}` no-ops currently route at `warning` (D-16-11: all skipped -> warning). Route benign skips at info; reserve warning for actionable skips. Severity-routing change.
3. **Suppress the `Error:`/`Warning:` label on multi-line cascade output.** The host's `ctx.ui.notify(body, severity)` label is fine for single-line messages (usage errors) but (a) breaks the 0/2 indent ladder and (b) duplicates the inline per-row status on multi-row cascades. Want: no label on structured/multi-line notifications, keep the severity color. Likely needs an upstream `@earendil-works/pi-coding-agent` capability (color without label, or a structured-notify mode) -- not a pure in-extension fix.
4. **Autoupdate marker grammar.** Represent autoupdate state with marker tokens, unifying the flip command with the `list` surface: `marketplace autoupdate` -> `<autoupdate>`, `marketplace noautoupdate` -> `<no autoupdate>` (introduce an explicit off-marker; today off = marker absence), idempotent -> `<autoupdate> {already autoupdate}` / `<no autoupdate> {already no autoupdate}`. Replaces the `(autoupdate enabled/disabled)` / `(skipped) {already enabled}` status forms.
5. **`marketplace update` no-op status.** A manifest refresh with no plugin change renders `(updated)`, implying a change occurred; prefer `(skipped) {up-to-date}` to mirror the plugin-level no-op. Requires the orchestrator to detect "no actual change" vs "refreshed".
6. **Catalog correction (doc-only):** the `marketplace add` github-source section wrongly states github sources default autoupdate ON. Actual v2 behavior (confirmed in `add.ts` -- no `autoupdate` write for any source): `marketplace add` never enables autoupdate; it is opt-in via `bootstrap` or explicit `marketplace autoupdate`. Correct the catalog prose. Doc nit alongside: the autoupdate command heading reads `marketplace autoupdate <enable|disable>` but the real verbs are `autoupdate` / `noautoupdate`.
