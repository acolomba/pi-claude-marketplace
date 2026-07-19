# Phase 68: Load-Time Backfill - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

At load time, re-materialize a force-installed plugin's previously-skipped
components once the extension supports them — promoting it toward `(installed)`
in place, with no upgrade and no manual command. The scan is gated on a new
`lastReconciledExtensionVersion` stamp in `state.json` so it fires only when the
running extension version differs from the last reconciled one (the only thing
that can move the supported-kind boundary).

Builds on Phase 64 (three-way resolver state), Phase 67 (the unconditional
reinstall/always-overwrite repair primitive), and Phase 66 (the derived
force-installed state). This is the one phase in the milestone that adds
PERSISTED state — but only a scan-gate version stamp, not the force state
itself (which stays derived).

Requirements BFILL-01, BFILL-02 and the three success criteria are locked by
the ROADMAP — discussion below is HOW, not WHAT.

</domain>

<decisions>
## Implementation Decisions

### Version-stamp migration (BFILL-02)
- **D-68-01:** Add `lastReconciledExtensionVersion?` as an OPTIONAL top-level
  field on `STATE_SCHEMA`; keep `schemaVersion` at 2 (no bump). The change is
  additive and backward-compatible — an old doc without the field validates
  fine, and the next save writes it. ABSENT stamp = scan-once (treated as
  version-changed). Non-destructive migration: existing state.json loads
  unchanged.

### Backfill materialize scope (BFILL-01)
- **D-68-02:** Re-materialize via the Phase 67 unconditional reinstall
  (always-overwrite) primitive — "reinstall semantics" per BFILL-01. Re-resolve
  the plugin and materialize the now-fuller supported set in place; the
  persisted `compatibility` record updates to the new (possibly empty)
  unsupported set. If the unsupported set becomes empty, the plugin promotes to
  `(installed)`. SAME recorded version (no upgrade), NO network (cache only,
  NFR-5). Reuses the just-built reinstall primitive rather than a bespoke
  partial-materialize path.

### Scan gate granularity (BFILL-02)
- **D-68-03:** The scan fires only when `lastReconciledExtensionVersion` differs
  from the running extension version, then stamps the running version. It scans
  ONLY force-installed plugins (clean/installed plugins have nothing to
  backfill). An absent stamp = scan-once. An unchanged version skips the scan
  entirely (the version is the only thing that can move the supported-kind
  boundary).

### Backfill notification (BFILL-01)
- **D-68-04:** Backfill runs within the load-time reconcile; a promotion
  (force-installed → installed, or a partial re-materialize) surfaces as a row
  in the existing SINGLE `applyReconcile` cascade notification (RECON-04
  single-notify-per-invocation preserved). The severity nuance for these rows is
  deferred to Phase 69; this phase emits the row at a sensible default and lets
  69 stamp the final severity.

### Claude's Discretion
- Whether backfill is a sub-step inside `applyReconcile` or a sibling step at
  `session_start` whose rows fold into the same cascade — left to planning,
  provided the single-notify rule holds and behavior matches D-68-01..04.
- The exact promotion-row token/wording (reconciled against the catalog in
  Phase 70).

</decisions>

<research_questions>
## Research Questions (for gsd-phase-researcher)

1. **Running extension version at runtime.** The extension version lives in
   `package.json` (`0.6.2`) but is not currently read at runtime. Determine the
   cleanest way to obtain it inside the extension (import the JSON, a generated
   constant, or the Pi host API) for the `lastReconciledExtensionVersion`
   comparison.
2. **Load-time reconcile entry.** Confirm where the load-time scan hooks in
   (`session_start` → `applyReconcile` in `orchestrators/reconcile/apply.ts`)
   and how its rows join the single cascade notify (RECON-04).
3. **state.json write seam.** Confirm `persistMigratedState` / `state-io.ts`
   write path and that adding the optional field needs no schemaVersion bump.

</research_questions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### State persistence (the version stamp)
- `extensions/pi-claude-marketplace/persistence/state-io.ts` — `STATE_SCHEMA`
  (~153, `schemaVersion: 1|2`), `PLUGIN_INSTALL_RECORD_SCHEMA` (~54, the
  `compatibility` record), `persistMigratedState`.

### Load-time reconcile (where backfill runs)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` —
  `applyReconcile` (~786), the single-cascade-notify rule (RECON-04, ~855-877),
  the `session_start` ordering note (~34).

### Reinstall primitive (the materialize path)
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` — the
  Phase 67 unconditional always-overwrite repair (D-67-03) reused for backfill.
- `.planning/phases/67-list-filters-completion-reinstall-repair/67-CONTEXT.md`
  — D-67-03 (reinstall is now an unconditional repair primitive).

### Force-state foundation
- `.planning/phases/66-derived-force-state-glyphs/66-CONTEXT.md` — D-66-01
  (force-installed derived from `compatibility.unsupported`).
- `extensions/pi-claude-marketplace/domain/resolver.ts` — three-way state /
  `requireForceInstallable`.

### Requirements & specs
- `.planning/REQUIREMENTS.md` — BFILL-01, BFILL-02.
- `.planning/ROADMAP.md` — Phase 68 goal + success criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The Phase 67 unconditional reinstall primitive — the backfill materialize path
  (D-68-02).
- `applyReconcile`'s single-cascade-notify machinery — the promotion rows join
  it (D-68-04).
- The persisted `compatibility.unsupported` record — already the force-installed
  derivation source (Phase 66); backfill updates it in place.

### Established Patterns
- state.json uses a `schemaVersion` union (1|2) with a non-destructive migration
  cycle; `persistMigratedState` always writes the current shape. Optional
  additive fields need no bump.
- NFR-5: load-time work is offline (cache-only resolve).
- Comment/test-title policy: D-68-NN / BFILL-NN / NFR-N IDs, never GSD phase/plan
  references.

### Integration Points
- Backfill consumes the running extension version (new runtime read) and the
  persisted force-installed records; it writes the stamp + updated compatibility
  via the state-io seam and surfaces rows through applyReconcile.

</code_context>

<specifics>
## Specific Ideas

The correctness lever: the supported-kind boundary can only move when the
extension itself changes, so the version stamp is a sufficient and minimal
gate — no per-plugin re-resolve on an unchanged extension. Backfill is a
promotion, not an upgrade: same recorded version, offline, reusing the repair
primitive so there is exactly one materialize path in the codebase.

</specifics>

<deferred>
## Deferred Ideas

- Force-path severity ladder SEV-01..05, including the backfill/promotion row
  severities — Phase 69.
- Final PRD §11 reconcile + byte-exact promotion-row token — Phase 70.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 68-load-time-backfill*
*Context gathered: 2026-06-27*
