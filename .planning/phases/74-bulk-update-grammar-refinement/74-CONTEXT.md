# Phase 74: Bulk Update Grammar Refinement - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning
**Source:** force-install milestone UAT (2026-06-29) — bucket B findings

<domain>
## Phase Boundary

The force-install milestone UAT surfaced two pre-existing bulk-`update` grammar problems (these predate force-install — v1.5 UXG-05 cascade + v1.11/Phase 50 summary line — and are NOT force-install-specific):

1. A bulk `update` renders **every** already-up-to-date plugin as its own `(skipped) {up-to-date}` row — noise the project suppresses elsewhere (UXG-02 benign-no-op suppression).
2. The summary line `Plugin update: N successes` counts **info-severity (at-desired-state) rows**, so up-to-date no-ops inflate the count — e.g. "5 successes" when only 1 plugin was actually updated. It reads as "N updated" but means "N at desired state."

In scope: the bulk-`update` cascade rendering + the summary-line count, plus the byte-exact catalog/style-guide and update tests.

Out of scope:
- Force-install token/severity surfaces (that is Phase 73, XSURF-01..03).
- The general summary-line grammar for OTHER operations (install/reinstall/marketplace) — this phase narrows to the `update` operation's bulk cascade + count. Do NOT broadly re-architect `summaryLine`/`countRowsBySeverity`; make a surgical, update-scoped change (the planner should confirm whether the count change can be update-local or needs a shared-helper parameter).

</domain>

<decisions>
## Implementation Decisions

### UGRM-01 — suppress up-to-date no-op rows (LOCKED by maintainer)
- A bulk `update` does NOT emit a per-plugin `(skipped) {up-to-date}` row for each unchanged plugin. Show only the plugins it actually changed.
- The all-up-to-date case still communicates the no-op clearly via a single summary line (e.g. "nothing to update" / "N up-to-date") — never zero output that looks like a hang.
- This aligns with the existing UXG-02 benign-no-op suppression philosophy.

### UGRM-02 — headline counts updates only (LOCKED by maintainer)
- The summary headline reports **operations performed (updates)**, not at-desired-state rows: `Plugin update: 1 updated` (not "5 successes").
- Up-to-date no-ops are excluded from the headline count (and suppressed per UGRM-01). The "count updates only" choice means the headline does not carry an up-to-date tally; the all-up-to-date no-op line (UGRM-01) is the place a "nothing to update / N up-to-date" message lives.
- The planner must reconcile UGRM-01 and UGRM-02 into a single coherent grammar: suppressed up-to-date rows + an updates-only headline + a clear all-up-to-date no-op line. Settle the exact strings (e.g. "Plugin update: 1 updated" vs pluralization, and the all-up-to-date wording) in the plan/spec and lock them in the catalog.

### Scope discipline
- This is a render/grammar change only — `update` orchestration logic (what gets updated) is unchanged. The plugins that were skipped as up-to-date are still skipped; only their *rendering* and the *count* change.
- Severity is unchanged (up-to-date no-ops stay info / benign).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Surfaces to change
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — the bulk-update cascade that emits `(skipped) {up-to-date}` PluginSkippedMessage rows (~lines 1601, 1664-1671, catalog state `all-up-to-date-noop`). Determine where to suppress the unchanged rows for the bulk path.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts` — update cascade messaging (`UPDATE_MP_STATUSES`, the skipped row composer).
- `extensions/pi-claude-marketplace/shared/notify.ts` — the summary-line builder (~lines 2543-2604): `countRowsBySeverity(message.marketplaces, "info")` and the `successes` tally + `tallyCategory(...)`. The "N successes" headline is built here. Determine whether the update operation can carry an "updated count" distinct from the info-row count without disturbing other operations' summaries.

### Read-only contract / precedent
- `docs/output-catalog.md` (state `all-up-to-date-noop`, ~lines 528-532) + `docs/messaging-style-guide.md` — current update no-op + summary byte forms to reconcile.
- v1.5 UXG-05 (update no-op renders `(skipped)`) and UXG-02 (benign no-ops suppressed) — the prior grammar decisions this phase revisits.
- Phase 50 / v1.11 summary-line grammar — the `N success(es)` contract being refined.

### Byte-form contract
- The byte-exact catalog UAT (`tests/architecture/catalog-uat.test.ts`) and update notify tests must be updated in lockstep; `npm run check` stays green.

</canonical_refs>

<specifics>
## Specific Ideas

UAT-observed before-state this phase fixes (`/claude:plugin update --force`, 1 of 5 plugins changed):
```
● claude-plugins-official [user]
   ⊘ code-review (skipped) {up-to-date}
   ⊘ hookify (skipped) {up-to-date}
   ⊘ security-guidance (skipped) {up-to-date}
   ⊘ asana (skipped) {up-to-date}
 ● demo-local [user]
   ◉ demo-tool v1.1.0 (force-installed) {lsp}
 Plugin update: 5 successes        <- should be "1 updated"
```
Target: suppress the four `(skipped) {up-to-date}` rows; headline `Plugin update: 1 updated`.

</specifics>

<deferred>
## Deferred Ideas

- Applying the same no-op-suppression / count refinement to install/reinstall/marketplace summaries is NOT in scope — narrow to `update`. If the planner finds the cleanest implementation is a shared-helper change that incidentally benefits other ops, surface it but keep the requirement scoped to `update`.

</deferred>

---

*Phase: 74-bulk-update-grammar-refinement*
*Context captured: 2026-06-29 via force-install milestone UAT findings*
