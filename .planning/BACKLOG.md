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
3. ~~**Suppress the `Error:`/`Warning:` label on multi-line cascade output.**~~ **CLOSED 2026-06-03.** Resolved structurally by UXG-07 (v1.5 Phase 29): `notify()` now prepends a summary line (`N plugin operation(s) failed/skipped.`) so the host `Error:`/`Warning:` label has a meaningful sentence on the first line, with the cascade body following on subsequent lines at the documented indent ladder. No upstream `@earendil-works/pi-coding-agent` capability change required.
4. **Autoupdate marker grammar.** Represent autoupdate state with marker tokens, unifying the flip command with the `list` surface: `marketplace autoupdate` -> `<autoupdate>`, `marketplace noautoupdate` -> `<no autoupdate>` (introduce an explicit off-marker; today off = marker absence), idempotent -> `<autoupdate> {already autoupdate}` / `<no autoupdate> {already no autoupdate}`. Replaces the `(autoupdate enabled/disabled)` / `(skipped) {already enabled}` status forms.
5. **`marketplace update` no-op status.** A manifest refresh with no plugin change renders `(updated)`, implying a change occurred; prefer `(skipped) {up-to-date}` to mirror the plugin-level no-op. Requires the orchestrator to detect "no actual change" vs "refreshed".
6. **Catalog correction (doc-only):** the `marketplace add` github-source section wrongly states github sources default autoupdate ON. Actual v2 behavior (confirmed in `add.ts` -- no `autoupdate` write for any source): `marketplace add` never enables autoupdate; it is opt-in via `bootstrap` or explicit `marketplace autoupdate`. Correct the catalog prose. Doc nit alongside: the autoupdate command heading reads `marketplace autoupdate <enable|disable>` but the real verbs are `autoupdate` / `noautoupdate`.

## Install error misattribution when marketplace is missing

**Surfaced by:** 2026-06-03 v1.8 scoping discussion.

When `/claude:plugin install foo@bar` is invoked and marketplace `bar` does not exist, current output is:

```text
Error: 1 plugin operation failed.

 ● bla [user]
   ⊘ bla (failed) {not in manifest}
     cause: Plugin "bla" not found in marketplace "bla".
```

The reason `{not in manifest}` and the cause string both blame the plugin, but the real blocker is the missing marketplace. Should instead report the marketplace as missing -- likely a new reason in the closed set (`{marketplace not added}` or similar) on a `(failed)` plugin row, or a bare failed marketplace header. The same misattribution likely applies to `uninstall`, `reinstall`, `update`, and the `info` commands once they land. Decide the canonical shape during the v1.8 `info` planning since both surfaces share the precondition check.
